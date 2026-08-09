#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import { lstat, mkdir, readFile, realpath, rename, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { createGuardedTempRoot, cleanupGuardedTempRoot } from "./lib/guarded-temp.mjs";
import { productPromptProjection, loadPromptTemplateCatalog } from "./lib/prompt-template-catalog.mjs";
import {
  renderProductPromptProjection,
  renderPromptCard,
  renderPromptDetailPage,
  renderPromptGuideSummary,
  renderPromptLibrary,
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
    const startOffset = markdown.indexOf(start);
    const endOffset = markdown.indexOf(end);
    if (endOffset < startOffset) throw new Error(`prompt-template marker pair must be ordered: ${markerId}`);
    return markdown.slice(0, startOffset) + section + markdown.slice(endOffset + end.length);
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

async function assertSafeTarget(root, relative, { requireExisting = false } = {}) {
  const normalized = normalizeRelativePath(relative, "prompt guide output");
  const target = joinWithin(root, normalized, "prompt guide output");
  if (!isContained(root, target)) throw new Error(`unsafe prompt guide output: ${relative}`);
  let current = root;
  for (const part of normalized.split("/").slice(0, -1)) {
    current = path.join(current, part);
    const stats = await lstat(current).catch((error) => error?.code === "ENOENT" ? null : Promise.reject(error));
    if (!stats?.isDirectory() || stats.isSymbolicLink()) throw new Error(`prompt guide output parent is not a non-symlink directory: ${current}`);
    if (!isContained(root, await realpath(current))) throw new Error(`prompt guide output parent escapes repository: ${current}`);
  }
  const existing = await lstat(target).catch((error) => error?.code === "ENOENT" ? null : Promise.reject(error));
  if (requireExisting && !existing) throw new Error(`missing generated prompt guide: ${normalized}`);
  if (existing && (!existing.isFile() || existing.isSymbolicLink())) {
    throw new Error(`prompt guide output is not a regular file: ${normalized}`);
  }
  if (existing && !isContained(root, await realpath(target))) throw new Error(`prompt guide output escapes repository: ${normalized}`);
  return { normalized, target };
}

async function ensureSafeTargetParents(root, relative) {
  const normalized = normalizeRelativePath(relative, "prompt guide output");
  let current = root;
  for (const part of normalized.split("/").slice(0, -1)) {
    current = path.join(current, part);
    const stats = await lstat(current).catch((error) => error?.code === "ENOENT" ? null : Promise.reject(error));
    if (!stats) {
      await mkdir(current);
      continue;
    }
    if (!stats.isDirectory() || stats.isSymbolicLink()) throw new Error(`prompt guide output parent is not a non-symlink directory: ${current}`);
    if (!isContained(root, await realpath(current))) throw new Error(`prompt guide output parent escapes repository: ${current}`);
  }
}

async function writeAtomically(target, contents) {
  const temporary = path.join(path.dirname(target), `.${path.basename(target)}.prompt-guides-${randomUUID()}`);
  await writeFile(temporary, contents, "utf8");
  try {
    await rename(temporary, target);
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => {});
    throw error;
  }
}

async function writeCheckFiles(root, outputs) {
  for (const [relative, contents] of outputs) {
    const target = joinWithin(root, relative, "temporary prompt guide output");
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, contents, "utf8");
  }
}

export async function buildPromptGuides({ repoRoot, check = false, __testCatalog } = {}) {
  const canonicalRepoRoot = await assertSafeDirectory(path.resolve(repoRoot), "repository root");
  const catalog = __testCatalog ?? await loadPromptTemplateCatalog({ repoRoot: canonicalRepoRoot });
  const outputs = await buildOutputPlan(catalog, canonicalRepoRoot, { includeManaged: !__testCatalog });

  if (check) {
    const temp = await createGuardedTempRoot({ parent: os.tmpdir(), prefix: "prompt-guides-" });
    try {
      await writeCheckFiles(temp.root, outputs);
      for (const [relative] of outputs) {
        const { target } = await assertSafeTarget(canonicalRepoRoot, relative, { requireExisting: true });
        const temporary = joinWithin(temp.root, relative, "temporary prompt guide output");
        const [expected, actual] = await Promise.all([readFile(temporary), readFile(target)]);
        if (!expected.equals(actual)) throw new Error(`generated prompt guide differs: ${relative}`);
      }
    } finally {
      await cleanupGuardedTempRoot(temp);
    }
  } else {
    const targets = [];
    for (const [relative, contents] of outputs) {
      await ensureSafeTargetParents(canonicalRepoRoot, relative);
      targets.push({ ...(await assertSafeTarget(canonicalRepoRoot, relative)), contents });
    }
    for (const { target, contents } of targets) {
      await writeAtomically(target, contents);
    }
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
