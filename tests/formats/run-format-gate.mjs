#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const FORMATS_ROOT = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(FORMATS_ROOT, "../..");

function runNode(args, label) {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const result = spawnSync(process.execPath, args, { cwd: REPO_ROOT, env, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.signal) throw new Error(`${label} terminated by ${result.signal}`);
  if (result.status !== 0) throw new Error(`${label} failed with exit code ${result.status ?? "unknown"}`);
}

async function main() {
  const tests = (await readdir(FORMATS_ROOT))
    .filter((name) => name.endsWith(".test.mjs"))
    .sort()
    .map((name) => path.join(FORMATS_ROOT, name));
  if (!tests.length) throw new Error("format regression tests are unavailable");
  runNode(["--test", ...tests], "format regression tests");
  runNode([path.join(FORMATS_ROOT, "verify-formats.mjs"), path.join(FORMATS_ROOT, "output")], "format artifact verifier");
  process.stdout.write(`[formats] release gate PASS: ${tests.length} regression files + 2 representative cases\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
