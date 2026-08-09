#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import { lstat, mkdir, readFile, realpath, rename, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { createGuardedTempRoot, cleanupGuardedTempRoot } from "./lib/guarded-temp.mjs";
import { productPromptProjection, loadPromptTemplateCatalog } from "./lib/prompt-template-catalog.mjs";
import { renderProductPromptProjection, renderPromptLibrary } from "./lib/prompt-guides.mjs";
import { joinWithin, normalizeRelativePath } from "./lib/paths.mjs";

const LIBRARY_FILE = "guides/prompt-templates/README.md";
const PRODUCT_IDS = Object.freeze(["game-design-studio", "game-design-career"]);

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

function buildOutputPlan(catalog) {
  assertCatalogGraph(catalog);
  const outputs = new Map([[LIBRARY_FILE, renderPromptLibrary(catalog)]]);
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
  const outputs = buildOutputPlan(catalog);

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
      targets.push({ ...(await assertSafeTarget(canonicalRepoRoot, relative)), contents });
    }
    for (const { target, contents } of targets) {
      await writeAtomically(target, contents);
    }
  }

  return { markdown: 1, projections: PRODUCT_IDS.length, checked: check };
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
