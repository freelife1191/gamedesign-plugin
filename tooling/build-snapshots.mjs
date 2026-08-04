#!/usr/bin/env node

import { mkdir, mkdtemp, readdir, realpath, rename, rm, rmdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

import { collectTree } from "./lib/copy-tree.mjs";
import { syncShared } from "./sync-shared.mjs";

const PRODUCT_NAMES = Object.freeze(["game-design-career", "game-design-studio"]);

async function compareSnapshot(expectedRoot, actualRoot, productName) {
  const [expected, actual] = await Promise.all([
    collectTree(expectedRoot, { label: `expected ${productName}` }),
    collectTree(actualRoot, { label: `committed plugins/${productName}` }).catch((error) => {
      if (/Missing source root/u.test(error.message)) throw new Error(`${productName}: committed snapshot is missing`);
      throw error;
    }),
  ]);
  const expectedPaths = expected.map(({ relativePath }) => relativePath);
  const actualPaths = actual.map(({ relativePath }) => relativePath);
  if (JSON.stringify(actualPaths) !== JSON.stringify(expectedPaths)) {
    const expectedSet = new Set(expectedPaths);
    const actualSet = new Set(actualPaths);
    const missing = expectedPaths.filter((file) => !actualSet.has(file));
    const unexpected = actualPaths.filter((file) => !expectedSet.has(file));
    throw new Error(`${productName}: snapshot file drift (missing: ${missing.join(", ") || "none"}; unexpected: ${unexpected.join(", ") || "none"})`);
  }
  for (let index = 0; index < expected.length; index += 1) {
    if (!expected[index].bytes.equals(actual[index].bytes)) {
      throw new Error(`${productName}: snapshot byte drift at ${expected[index].relativePath}`);
    }
  }
  return expected.length;
}

function explicitDestination(repoRoot, productName) {
  if (!PRODUCT_NAMES.includes(productName)) throw new Error(`Unsupported snapshot destination: ${productName}`);
  const pluginsRoot = path.join(repoRoot, "plugins");
  const destination = path.join(pluginsRoot, productName);
  if (path.dirname(destination) !== pluginsRoot) throw new Error(`Unsafe snapshot destination: ${destination}`);
  return destination;
}

async function replaceSnapshots({ repoRoot, stagingRoot }) {
  const backupRoot = path.join(stagingRoot, ".backups");
  await mkdir(backupRoot, { recursive: true });
  const movedBackups = [];
  const installed = [];
  try {
    for (const productName of PRODUCT_NAMES) {
      const destination = explicitDestination(repoRoot, productName);
      const backup = path.join(backupRoot, productName);
      await rename(destination, backup);
      movedBackups.push({ destination, backup });
    }
    for (const productName of PRODUCT_NAMES) {
      const destination = explicitDestination(repoRoot, productName);
      await rename(path.join(stagingRoot, productName), destination);
      installed.push(destination);
    }
  } catch (error) {
    for (const destination of installed.reverse()) await rm(destination, { recursive: true, force: true });
    for (const { destination, backup } of movedBackups.reverse()) await rename(backup, destination);
    throw error;
  }
  await rm(backupRoot, { recursive: true, force: true });
}

export async function buildSnapshots({ repoRoot, mode = "clean", sourceDateEpoch = 0 }) {
  const absoluteRepoRoot = path.resolve(repoRoot);
  const temporaryParent = path.join(absoluteRepoRoot, ".tmp");
  await mkdir(temporaryParent, { recursive: true });
  const stagingRoot = await mkdtemp(path.join(temporaryParent, "snapshot-build-"));
  try {
    const builds = [];
    for (const productName of PRODUCT_NAMES) {
      builds.push(await syncShared({
        repoRoot: absoluteRepoRoot,
        productName,
        stagingRoot,
        sourceDateEpoch,
      }));
    }
    if (mode === "check") {
      for (const productName of PRODUCT_NAMES) {
        await compareSnapshot(
          path.join(stagingRoot, productName),
          explicitDestination(absoluteRepoRoot, productName),
          productName,
        );
      }
    } else if (mode === "clean") {
      await replaceSnapshots({ repoRoot: absoluteRepoRoot, stagingRoot });
    } else {
      throw new Error(`Unsupported snapshot mode: ${mode}`);
    }
    return builds;
  } finally {
    await rm(stagingRoot, { recursive: true, force: true });
    if ((await readdir(temporaryParent)).length === 0) await rmdir(temporaryParent);
  }
}

function parseMode(argv) {
  if (argv.length === 0 || (argv.length === 1 && argv[0] === "--clean")) return "clean";
  if (argv.length === 1 && argv[0] === "--check") return "check";
  throw new Error("Usage: node tooling/build-snapshots.mjs [--clean|--check]");
}

async function main() {
  const repoRoot = fileURLToPath(new URL("..", import.meta.url));
  const mode = parseMode(process.argv.slice(2));
  const builds = await buildSnapshots({ repoRoot, mode });
  for (const build of builds) {
    process.stdout.write(`${mode} ${build.name}: ${build.files.length} files, ${build.manifest.treeSha256}\n`);
  }
}

const entryPath = process.argv[1] ? await realpath(process.argv[1]).catch(() => undefined) : undefined;
if (entryPath && pathToFileURL(entryPath).href === import.meta.url) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
