#!/usr/bin/env node

import { lstat, readdir, realpath } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

async function collect(directory, files) {
  const entries = await readdir(directory, { withFileTypes: true });
  entries.sort((left, right) => left.name.localeCompare(right.name, "en"));
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    const stats = await lstat(target);
    if (stats.isSymbolicLink()) throw new Error(`test path is a symlink: ${target}`);
    if (stats.isDirectory()) await collect(target, files);
    else if (stats.isFile() && entry.name.endsWith(".test.mjs")) files.push(target);
  }
}

async function main() {
  if (process.argv.length < 3) throw new Error("Usage: node tooling/run-test-group.mjs <tests-relative-directory> [...]");
  const repoRoot = await realpath(path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."));
  const testsRoot = await realpath(path.join(repoRoot, "tests"));
  const files = [];
  for (const argument of process.argv.slice(2)) {
    if (!/^[a-z0-9][a-z0-9/-]*$/u.test(argument) || argument.split("/").includes("..")) throw new Error(`unsafe test group: ${argument}`);
    const directory = await realpath(path.join(testsRoot, ...argument.split("/")));
    const relative = path.relative(testsRoot, directory);
    if (relative === "" || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
      throw new Error(`test group escapes tests root: ${argument}`);
    }
    await collect(directory, files);
  }
  files.sort();
  if (files.length === 0) throw new Error("no test files found for requested groups");
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const result = spawnSync(process.execPath, ["--test", ...files], { cwd: repoRoot, env, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.signal) throw new Error(`test process terminated by ${result.signal}`);
  process.exitCode = result.status ?? 1;
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
