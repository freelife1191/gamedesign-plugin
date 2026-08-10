#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import { lstat, mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { loadArchifyVisualQa, renderArchifyContactSheets } from "./lib/archify-visual-qa.mjs";
import { cleanupGuardedTempRoot, createGuardedTempRoot } from "./lib/guarded-temp.mjs";
import { comparePaths } from "./lib/paths.mjs";

const OUTPUT_ROOT = "guides/archify-diagrams/visual-qa/contact-sheets";

function parseArguments(argv) {
  if (argv.length === 0) return { check: false };
  if (argv.length === 1 && argv[0] === "--check") return { check: true };
  throw new Error(`Unknown argument: ${argv.join(" ")}`);
}

async function assertDirectoryPath(root, relative, { create } = {}) {
  let current = root;
  for (const segment of relative.split("/")) {
    current = path.join(current, segment);
    let stats = await lstat(current).catch((error) => error?.code === "ENOENT" ? null : Promise.reject(error));
    if (!stats && create) {
      await mkdir(current);
      stats = await lstat(current);
    }
    if (!stats || !stats.isDirectory() || stats.isSymbolicLink()) throw new Error(`contact sheet output directory is unsafe: ${relative}`);
  }
  return current;
}

async function assertExactOutput(directory, sheets) {
  const actual = (await readdir(directory)).sort(comparePaths);
  const expected = [...sheets.keys()].sort(comparePaths);
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error("contact sheet output set is stale or incomplete");
  for (const [name, expectedBytes] of sheets) {
    const filename = path.join(directory, name);
    const stats = await lstat(filename);
    if (!stats.isFile() || stats.isSymbolicLink()) throw new Error(`contact sheet output is unsafe: ${name}`);
    const actualBytes = await readFile(filename, "utf8");
    if (actualBytes !== expectedBytes) throw new Error(`contact sheet bytes are stale: ${name}`);
  }
}

async function writeExactOutput(directory, sheets) {
  await mkdir(directory);
  for (const [name, bytes] of sheets) await writeFile(path.join(directory, name), bytes, "utf8");
  await assertExactOutput(directory, sheets);
}

export async function buildArchifyContactSheets({ repoRoot, check = false, __testHooks = {} } = {}) {
  const { catalog, qa } = await loadArchifyVisualQa({ repoRoot });
  const sheets = renderArchifyContactSheets({ catalog, qa });
  const directory = path.join(repoRoot, OUTPUT_ROOT);
  if (check) {
    await assertDirectoryPath(repoRoot, OUTPUT_ROOT, { create: false });
    await assertExactOutput(directory, sheets);
    return { checked: true, outputs: [...sheets.keys()].sort(comparePaths) };
  }
  const parent = await assertDirectoryPath(repoRoot, path.posix.dirname(OUTPUT_ROOT), { create: true });
  const temporary = await createGuardedTempRoot({ parent, prefix: "contact-sheet-" });
  const candidate = path.join(temporary.root, "contact-sheets");
  const backup = path.join(parent, `.contact-sheets-backup-${randomUUID()}`);
  let movedOld = false;
  let movedNew = false;
  try {
    await writeExactOutput(candidate, sheets);
    const existing = await lstat(directory).catch((error) => error?.code === "ENOENT" ? null : Promise.reject(error));
    if (existing) {
      if (!existing.isDirectory() || existing.isSymbolicLink()) throw new Error("contact sheet output directory is unsafe");
      await rename(directory, backup); movedOld = true;
    }
    await __testHooks.beforePublish?.({ candidate, directory, backup });
    await rename(candidate, directory); movedNew = true;
    await assertExactOutput(directory, sheets);
    await __testHooks.afterPublish?.({ directory, backup });
    await assertExactOutput(directory, sheets);
    if (movedOld) {
      try { await __testHooks.beforeBackupCleanup?.({ directory, backup }); await rm(backup, { recursive: true }); }
      catch (cleanup) { throw new AggregateError([cleanup], `contact sheet committed but backup cleanup failed: ${cleanup.message}`); }
    }
    return { built: true, outputs: [...sheets.keys()].sort(comparePaths) };
  } catch (error) {
    if (error instanceof AggregateError && String(error.message).includes("backup cleanup failed")) throw error;
    const rollback = [];
    if (movedNew) try { await rename(directory, candidate); } catch (rollbackError) { rollback.push(rollbackError); }
    if (movedOld) try { await rename(backup, directory); } catch (rollbackError) { rollback.push(rollbackError); }
    if (rollback.length > 0) throw new AggregateError([error, ...rollback], `contact sheet publish and rollback failed; forensic paths: ${directory}, ${backup}`);
    throw error;
  } finally {
    await cleanupGuardedTempRoot(temporary);
  }
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  try {
    const result = await buildArchifyContactSheets({ repoRoot: process.cwd(), ...parseArguments(process.argv.slice(2)) });
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
