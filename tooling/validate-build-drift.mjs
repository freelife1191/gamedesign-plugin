#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
for (const argument of ["--clean", "--check"]) {
  const result = spawnSync(process.execPath, [path.join(repoRoot, "tooling/build-snapshots.mjs"), argument], { cwd: repoRoot, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.signal) throw new Error(`snapshot build terminated by ${result.signal}`);
  if (result.status !== 0) {
    process.exitCode = result.status ?? 1;
    break;
  }
}
