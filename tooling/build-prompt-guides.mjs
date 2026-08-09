#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import { lstat, mkdir, open, readFile, realpath, rename, rmdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { createGuardedTempRoot, cleanupGuardedTempRoot } from "./lib/guarded-temp.mjs";
import { productPromptProjection, loadPromptTemplateCatalog } from "./lib/prompt-template-catalog.mjs";
import {
  assertManagedSection,
  renderProductPromptProjection,
  renderPromptCard,
  renderPromptDetailPage,
  renderPromptGuideSummary,
  renderPromptLibrary,
  replaceManagedSection,
  validateRenderedPromptCard,
} from "./lib/prompt-guides.mjs";
import { joinWithin, normalizeRelativePath } from "./lib/paths.mjs";

const LIBRARY_FILE = "guides/prompt-templates/README.md";
const PRODUCT_IDS = Object.freeze(["game-design-studio", "game-design-career"]);
const PRODUCT_BY_SHORT_ID = Object.freeze({ studio: "game-design-studio", career: "game-design-career" });

function parseArguments(argv) {
  if (argv.length === 0) return { check: false };
  if (argv.length === 1 && argv[0] === "--check") return { check: true };
  throw new Error(`Unknown argument: ${argv.join(" ")}`);
}

function projectionFile(productId) {
  return `products/${productId}/plugin/references/prompt-templates.json`;
}

function assertCatalogGraph(catalog) {
  if (!catalog || !Array.isArray(catalog.entries) || catalog.entries.length === 0) {
    throw new Error("prompt catalog must contain at least one validated entry");
  }
  const ids = new Set();
  for (const entry of catalog.entries) {
    if (!entry || typeof entry !== "object" || typeof entry.id !== "string" || entry.id.length === 0) {
      throw new Error("prompt catalog graph has an invalid entry");
    }
    if (ids.has(entry.id)) throw new Error(`prompt catalog graph has duplicate entry ID: ${entry.id}`);
    ids.add(entry.id);
  }
}

function detailFile(entry) {
  if (entry.kind === "suite-case") return `guides/prompt-templates/suite/${entry.id.split(":")[1]}.md`;
  return `guides/prompt-templates/${entry.product}/${entry.skill}.md`;
}

function managedMarkerId(entry) {
  if (entry.kind === "skill-template") return `${PRODUCT_BY_SHORT_ID[entry.product]}:${entry.skill}`;
  if (entry.kind === "recipe") return `${PRODUCT_BY_SHORT_ID[entry.product]}:recipe:${entry.id.split(":").at(-1)}`;
  if (entry.kind === "use-case") return entry.source_case_id.toLowerCase();
  throw new Error(`unsupported managed prompt entry: ${entry.id}`);
}

function markerPair(markerId, body) {
  return [
    `<!-- PROMPT-TEMPLATES:START ${markerId} -->`,
    body.trim(),
    `<!-- PROMPT-TEMPLATES:END ${markerId} -->`,
  ].join("\n");
}

function replaceOrInsertManagedSection(markdown, entry, body) {
  const markerId = managedMarkerId(entry);
  const start = `<!-- PROMPT-TEMPLATES:START ${markerId} -->`;
  const end = `<!-- PROMPT-TEMPLATES:END ${markerId} -->`;
  const starts = markdown.split(start).length - 1;
  const ends = markdown.split(end).length - 1;
  const section = markerPair(markerId, body);
  if (starts === 1 && ends === 1) {
    return replaceManagedSection(markdown, markerId, body);
  }
  if (starts !== 0 || ends !== 0) throw new Error(`expected exactly one prompt-template marker pair: ${markerId}`);
  if (entry.kind !== "use-case") return `${markdown.trimEnd()}\n\n${section}\n`;

  const heading = new RegExp(`^## ${entry.source_case_id}(?:\\s|$).*$`, "mu");
  const match = heading.exec(markdown);
  if (!match || match.index === undefined) throw new Error(`missing use-case section for prompt marker: ${entry.source_case_id}`);
  const next = /^## /gmu;
  next.lastIndex = match.index + match[0].length;
  const nextMatch = next.exec(markdown);
  const insertion = nextMatch?.index ?? markdown.length;
  return `${markdown.slice(0, insertion).trimEnd()}\n\n${section}\n\n${markdown.slice(insertion).trimStart()}`;
}

async function buildOutputPlan(catalog, repoRoot, { includeManaged } = {}) {
  assertCatalogGraph(catalog);
  const outputs = new Map([[LIBRARY_FILE, renderPromptLibrary(catalog)]]);
  const detailGroups = new Map();
  for (const entry of catalog.entries.filter((candidate) => candidate.kind === "skill-template" || candidate.kind === "suite-case")) {
    const relative = detailFile(entry);
    const entries = detailGroups.get(relative) ?? [];
    entries.push(entry);
    detailGroups.set(relative, entries);
  }
  for (const [relative, entries] of detailGroups) {
    outputs.set(relative, renderPromptDetailPage(entries));
  }

  if (includeManaged) {
    const sourceContents = new Map();
    for (const entry of catalog.entries.filter((candidate) => candidate.kind !== "suite-case")) {
      const source = entry.kind === "skill-template"
        ? `guides/${PRODUCT_BY_SHORT_ID[entry.product]}/skills/${entry.skill}.md`
        : entry.source_references[0];
      if (!sourceContents.has(source)) sourceContents.set(source, await readFile(joinWithin(repoRoot, source, "prompt guide source"), "utf8"));
      const card = entry.kind === "skill-template" ? null : renderPromptCard(entry, { headingLevel: 4 });
      if (card) validateRenderedPromptCard(entry, card);
      const body = card ?? renderPromptGuideSummary(catalog.entries.filter((candidate) => (
        candidate.kind === "skill-template" && candidate.product === entry.product && candidate.skill === entry.skill
      )));
      sourceContents.set(source, replaceOrInsertManagedSection(sourceContents.get(source), entry, body));
    }
    for (const entry of catalog.entries.filter((candidate) => candidate.kind === "recipe")) {
      assertManagedSection(sourceContents.get(entry.source_references[0]), managedMarkerId(entry));
    }
    for (const [relative, contents] of sourceContents) outputs.set(relative, `${contents.trimEnd()}\n`);
  }

  for (const productId of PRODUCT_IDS) {
    const relative = projectionFile(productId);
    if (outputs.has(relative)) throw new Error(`duplicate prompt guide output: ${relative}`);
    outputs.set(relative, renderProductPromptProjection(catalog, productId, productPromptProjection(catalog, productId)));
  }
  return outputs;
}

function isContained(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

async function assertSafeDirectory(root, label) {
  const stats = await lstat(root);
  if (!stats.isDirectory() || stats.isSymbolicLink()) throw new Error(`${label} is not a non-symlink directory`);
  return realpath(root);
}

function sameIdentity(left, right) {
  return left.dev === right.dev && left.ino === right.ino;
}

function identity(stats) {
  return { dev: stats.dev, ino: stats.ino };
}

async function directoryRecord(root, directory, label) {
  const stats = await lstat(directory);
  if (!stats.isDirectory() || stats.isSymbolicLink()) throw new Error(`${label} is not a non-symlink directory: ${directory}`);
  if (!isContained(root, await realpath(directory))) throw new Error(`${label} escapes repository: ${directory}`);
  return { directory, identity: identity(stats), label };
}

async function assertDirectoryRecord(root, record) {
  const stats = await lstat(record.directory);
  if (!stats.isDirectory() || stats.isSymbolicLink() || !sameIdentity(record.identity, identity(stats))) {
    throw new Error(`${record.label} identity changed: ${record.directory}`);
  }
  if (!isContained(root, await realpath(record.directory))) throw new Error(`${record.label} escapes repository: ${record.directory}`);
}

async function prepareOutputTarget(root, relative, contents) {
  const normalized = normalizeRelativePath(relative, "prompt guide output");
  const target = joinWithin(root, normalized, "prompt guide output");
  if (!isContained(root, target)) throw new Error(`unsafe prompt guide output: ${relative}`);
  const parentPaths = [];
  const records = [];
  let current = root;
  records.push(await directoryRecord(root, current, "repository root"));
  for (const part of normalized.split("/").slice(0, -1)) {
    current = path.join(current, part);
    parentPaths.push(current);
    const stats = await lstat(current).catch((error) => error?.code === "ENOENT" ? null : Promise.reject(error));
    if (!stats) continue;
    records.push(await directoryRecord(root, current, "prompt guide output parent"));
  }
  const stats = await lstat(target).catch((error) => error?.code === "ENOENT" ? null : Promise.reject(error));
  if (stats && (!stats.isFile() || stats.isSymbolicLink())) throw new Error(`prompt guide output is not a regular file: ${normalized}`);
  if (stats && !isContained(root, await realpath(target))) throw new Error(`prompt guide output escapes repository: ${normalized}`);
  return { normalized, target, contents, parentPaths, records, targetIdentity: stats ? identity(stats) : null, existed: Boolean(stats) };
}

async function assertTargetStable(root, plan) {
  return assertTargetState(root, plan, plan.targetIdentity ? "original" : "absent");
}

async function assertTargetParentsStable(root, plan) {
  for (const record of plan.records) await assertDirectoryRecord(root, record);
}

async function assertTargetState(root, plan, state) {
  await assertTargetParentsStable(root, plan);
  const stats = await lstat(plan.target).catch((error) => error?.code === "ENOENT" ? null : Promise.reject(error));
  if (state === "absent") {
    if (stats) throw new Error(`prompt guide output must remain absent: ${plan.normalized}`);
    return;
  }
  const expectedIdentity = state === "published" ? plan.publishedIdentity : plan.targetIdentity;
  if (!expectedIdentity || !stats || !stats.isFile() || stats.isSymbolicLink() || !sameIdentity(expectedIdentity, identity(stats))) {
    throw new Error(`prompt guide output identity changed: ${plan.normalized}`);
  }
  if (!isContained(root, await realpath(plan.target))) throw new Error(`prompt guide output escapes repository: ${plan.normalized}`);
}

async function ensureTargetParents(root, plan, createdDirectories) {
  for (const directory of plan.parentPaths) {
    const existing = await lstat(directory).catch((error) => error?.code === "ENOENT" ? null : Promise.reject(error));
    if (!existing) {
      await mkdir(directory);
      const record = await directoryRecord(root, directory, "created prompt guide output parent");
      plan.records.push(record);
      createdDirectories.push(record);
      continue;
    }
    await assertDirectoryRecord(root, { directory, identity: identity(existing), label: "prompt guide output parent" });
    if (!plan.records.some((record) => record.directory === directory)) {
      plan.records.push(await directoryRecord(root, directory, "prompt guide output parent"));
    }
  }
}

async function writeExclusiveStageFile(stage, contents) {
  const flags = fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_WRONLY | (fsConstants.O_NOFOLLOW ?? 0);
  const handle = await open(stage, flags, 0o600);
  try {
    await handle.writeFile(contents, "utf8");
  } finally {
    await handle.close();
  }
  const stats = await lstat(stage);
  if (!stats.isFile() || stats.isSymbolicLink()) throw new Error(`prompt guide stage is not a regular file: ${stage}`);
  return identity(stats);
}

async function removeCreatedDirectories(createdDirectories) {
  const errors = [];
  for (const record of [...createdDirectories].reverse()) {
    try {
      const stats = await lstat(record.directory).catch((error) => error?.code === "ENOENT" ? null : Promise.reject(error));
      if (!stats || !stats.isDirectory() || stats.isSymbolicLink() || !sameIdentity(record.identity, identity(stats))) continue;
      await rmdir(record.directory);
    } catch (error) {
      if (error?.code !== "ENOTEMPTY") errors.push(error);
    }
  }
  return errors;
}

async function removeStageRoot(stageRoot) {
  const stats = await lstat(stageRoot).catch((error) => error?.code === "ENOENT" ? null : Promise.reject(error));
  if (!stats) return;
  if (!stats.isDirectory() || stats.isSymbolicLink()) throw new Error(`prompt guide stage root is unsafe: ${stageRoot}`);
  await rm(stageRoot, { recursive: true, force: true });
}

async function invokeRenameHook(hooks, operation) {
  if (hooks?.beforeRename) await hooks.beforeRename(operation);
}

async function invokeRollbackRenameHook(hooks, operation) {
  if (hooks?.beforeRollbackRename) await hooks.beforeRollbackRename(operation);
}

async function assertStageStable(plan) {
  const stats = await lstat(plan.stage);
  if (!stats.isFile() || stats.isSymbolicLink() || !sameIdentity(plan.stageIdentity, identity(stats))) {
    throw new Error(`prompt guide stage identity changed: ${plan.normalized}`);
  }
}

async function recordPublishedTarget(root, plan) {
  const stats = await lstat(plan.target);
  if (!stats.isFile() || stats.isSymbolicLink()) throw new Error(`published prompt guide is not a regular file: ${plan.normalized}`);
  if (!isContained(root, await realpath(plan.target))) throw new Error(`published prompt guide escapes repository: ${plan.normalized}`);
  plan.publishedIdentity = identity(stats);
}

async function rollbackPromotion(root, plans, createdDirectories, stageRoot, hooks) {
  const errors = [];
  for (const plan of [...plans].reverse()) {
    try {
      if (!plan.published && !plan.backedUp) continue;
      if (plan.published) {
        await assertTargetParentsStable(root, plan);
        const stats = await lstat(plan.target).catch((error) => error?.code === "ENOENT" ? null : Promise.reject(error));
        if (!stats || !stats.isFile() || stats.isSymbolicLink() || !sameIdentity(plan.publishedIdentity, identity(stats))) {
          throw new Error(`published target identity changed during rollback: ${plan.normalized}`);
        }
        await rm(plan.target);
      } else {
        await assertTargetState(root, plan, "absent");
      }
      if (plan.backedUp) {
        await invokeRollbackRenameHook(hooks, { phase: "restore", index: plan.index, target: plan.target });
        await assertTargetState(root, plan, "absent");
        await rename(plan.backup, plan.target);
      }
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length === 0) {
    try {
      await removeStageRoot(stageRoot);
    } catch (error) {
      errors.push(error);
    }
  }
  errors.push(...await removeCreatedDirectories(createdDirectories));
  return errors;
}

async function promoteOutputBatch(root, outputs, hooks) {
  const plans = [];
  for (const [relative, contents] of outputs) plans.push(await prepareOutputTarget(root, relative, contents));
  for (const plan of plans) await assertTargetStable(root, plan);
  const stageRoot = path.join(root, `.prompt-guides-stage-${randomUUID()}`);
  await mkdir(stageRoot, { mode: 0o700 });
  const createdDirectories = [];
  try {
    for (const [index, plan] of plans.entries()) {
      plan.index = index;
      plan.stage = path.join(stageRoot, `${index}.stage`);
      plan.backup = path.join(stageRoot, `${index}.backup`);
      plan.stageIdentity = await writeExclusiveStageFile(plan.stage, plan.contents);
    }
    for (const plan of plans) await ensureTargetParents(root, plan, createdDirectories);
    for (const plan of plans) await assertTargetStable(root, plan);
    if (hooks?.beforePublish) await hooks.beforePublish();
    for (const plan of plans) await assertTargetStable(root, plan);

    for (const [index, plan] of plans.entries()) {
      if (plan.existed) {
        await invokeRenameHook(hooks, { phase: "backup", index, target: plan.target });
        await assertTargetState(root, plan, "original");
        await rename(plan.target, plan.backup);
        plan.backedUp = true;
      }
      await invokeRenameHook(hooks, { phase: "publish", index, target: plan.target });
      await assertTargetState(root, plan, "absent");
      await assertStageStable(plan);
      await rename(plan.stage, plan.target);
      await recordPublishedTarget(root, plan);
      plan.published = true;
      if (hooks?.afterRename) await hooks.afterRename({ phase: "publish", index, target: plan.target });
    }
  } catch (error) {
    const recoveryErrors = await rollbackPromotion(root, plans, createdDirectories, stageRoot, hooks);
    if (recoveryErrors.length > 0) throw new AggregateError([error, ...recoveryErrors], "prompt guide promotion failed and rollback encountered errors");
    throw error;
  }
  try {
    if (hooks?.beforeStageCleanup) await hooks.beforeStageCleanup();
    await removeStageRoot(stageRoot);
  } catch (error) {
    throw new AggregateError([error], "prompt guide published but stage cleanup failed");
  }
}

async function writeCheckFiles(root, outputs) {
  for (const [relative, contents] of outputs) {
    const target = joinWithin(root, relative, "temporary prompt guide output");
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, contents, "utf8");
  }
}

export async function buildPromptGuides({ repoRoot, check = false, __testCatalog, __testHooks } = {}) {
  const canonicalRepoRoot = await assertSafeDirectory(path.resolve(repoRoot), "repository root");
  const catalog = __testCatalog ?? await loadPromptTemplateCatalog({ repoRoot: canonicalRepoRoot });
  const outputs = await buildOutputPlan(catalog, canonicalRepoRoot, { includeManaged: !__testCatalog });

  if (check) {
    const temp = await createGuardedTempRoot({ parent: os.tmpdir(), prefix: "prompt-guides-" });
    try {
      await writeCheckFiles(temp.root, outputs);
      for (const [relative] of outputs) {
        const { target } = await prepareOutputTarget(canonicalRepoRoot, relative, "");
        const stats = await lstat(target).catch((error) => error?.code === "ENOENT" ? null : Promise.reject(error));
        if (!stats) throw new Error(`missing generated prompt guide: ${relative}`);
        const temporary = joinWithin(temp.root, relative, "temporary prompt guide output");
        const [expected, actual] = await Promise.all([readFile(temporary), readFile(target)]);
        if (!expected.equals(actual)) throw new Error(`generated prompt guide differs: ${relative}`);
      }
    } finally {
      await cleanupGuardedTempRoot(temp);
    }
  } else {
    await promoteOutputBatch(canonicalRepoRoot, outputs, __testHooks);
  }

  return {
    markdown: [...outputs.keys()].filter((relative) => relative.endsWith(".md")).length,
    managed: includeManagedCount(catalog, __testCatalog),
    projections: PRODUCT_IDS.length,
    checked: check,
  };
}

function includeManagedCount(catalog, testCatalog) {
  if (testCatalog) return 0;
  const files = new Set(catalog.entries.filter((entry) => entry.kind !== "suite-case").map((entry) => (
    entry.kind === "skill-template"
      ? `guides/${PRODUCT_BY_SHORT_ID[entry.product]}/skills/${entry.skill}.md`
      : entry.source_references[0]
  )));
  return files.size;
}

async function isDirectInvocation() {
  return process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

if (await isDirectInvocation()) {
  try {
    const { check } = parseArguments(process.argv.slice(2));
    const result = await buildPromptGuides({ repoRoot: process.cwd(), check });
    console.log(`prompt guides: ${result.markdown} Markdown, ${result.projections} projections${check ? " checked" : " built"}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
