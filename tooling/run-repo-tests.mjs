#!/usr/bin/env node

import { lstat, readdir, realpath } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

import { comparePaths } from "./lib/paths.mjs";

export async function discoverRepoTests(repoRoot) {
  const requestedRepoRoot = path.resolve(repoRoot);
  const repoStats = await lstat(requestedRepoRoot);
  if (repoStats.isSymbolicLink()) throw new Error(`Repository root is a symlink: ${requestedRepoRoot}`);
  if (!repoStats.isDirectory()) throw new Error(`Repository root is not a directory: ${requestedRepoRoot}`);
  const canonicalRepoRoot = await realpath(requestedRepoRoot);
  const testsRoot = path.join(canonicalRepoRoot, "tests");
  const rootStats = await lstat(testsRoot);
  if (rootStats.isSymbolicLink()) throw new Error(`Canonical tests root is a symlink: ${testsRoot}`);
  if (!rootStats.isDirectory()) throw new Error(`Canonical tests root is not a directory: ${testsRoot}`);
  const testFiles = [];

  async function visit(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => comparePaths(left.name.normalize("NFC"), right.name.normalize("NFC")));
    for (const entry of entries) {
      const entryPath = path.join(directory, entry.name);
      const stats = await lstat(entryPath);
      if (stats.isSymbolicLink()) throw new Error(`Symlink is not allowed in canonical tests: ${entryPath}`);
      if (stats.isDirectory()) {
        await visit(entryPath);
      } else if (stats.isFile()) {
        if (entry.name.endsWith(".test.mjs")) testFiles.push(entryPath);
      } else {
        throw new Error(`Unsupported non-file entry in canonical tests: ${entryPath}`);
      }
    }
  }

  await visit(testsRoot);
  testFiles.sort((left, right) => comparePaths(path.relative(canonicalRepoRoot, left), path.relative(canonicalRepoRoot, right)));
  if (testFiles.length === 0) throw new Error(`No canonical .test.mjs files found under ${testsRoot}`);
  return testFiles;
}

function parseArguments(argv) {
  let repoRoot = fileURLToPath(new URL("..", import.meta.url));
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--repo-root" && argv[index + 1]) repoRoot = argv[++index];
    else throw new Error(`Unknown or incomplete argument: ${argv[index]}`);
  }
  return path.resolve(repoRoot);
}

async function run() {
  const tests = await discoverRepoTests(parseArguments(process.argv.slice(2)));
  const childEnvironment = { ...process.env };
  delete childEnvironment.NODE_TEST_CONTEXT;
  const result = spawnSync(process.execPath, ["--test", "--test-concurrency=1", ...tests], {
    env: childEnvironment,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.signal) {
    process.kill(process.pid, result.signal);
    return;
  }
  process.exitCode = result.status ?? 1;
}

const entryPath = process.argv[1] ? path.resolve(process.argv[1]) : undefined;
if (entryPath && pathToFileURL(entryPath).href === import.meta.url) {
  try {
    await run();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
