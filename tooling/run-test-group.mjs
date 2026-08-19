#!/usr/bin/env node

import { lstat, readdir, realpath } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

export const DEFAULT_TEST_TIMEOUT_MS = 1_200_000;

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
  // A default ceiling for every test that does not set its own, including the per-file wrapper that
  // `node --test` reports for each file it runs. Without it, a test that never returns produces silence
  // until the CI job is killed an hour later, with no way to tell which test it was; with it, the hang
  // names itself. The value has to clear the slowest whole file, not the slowest single assertion:
  // package-contents runs just over three minutes alone on a developer machine and longer on a shared
  // runner, where the files execute concurrently and contend for the same cores. A first attempt at five
  // minutes cut that file off mid-run and reported a timeout for a file whose every subtest had passed.
  // Windows moved the floor again: the same contract suite that finishes in four minutes on Linux takes
  // roughly four times as long there, and fifteen minutes cut off a file that was still working. Twenty
  // minutes clears it and still leaves the thirty-minute lane ten minutes in which a real hang names
  // itself rather than being killed anonymously by the job.
  const result = spawnSync(process.execPath, ["--test", `--test-timeout=${DEFAULT_TEST_TIMEOUT_MS}`, ...files], { cwd: repoRoot, env, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.signal) throw new Error(`test process terminated by ${result.signal}`);
  process.exitCode = result.status ?? 1;
}

// Without this guard, importing the module to read a constant runs the whole test group as a side effect.
const entry = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (entry && pathToFileURL(entry).href === import.meta.url) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
