#!/usr/bin/env node

// Several contract tests validate their specs against a real Archify CLI, resolved the way the running
// host resolves it: `$CODEX_HOME/skills/archify` or `~/.agents/skills/archify`. A CI runner has neither,
// so those contracts reported "resolver status: unavailable" and failed.
//
// This places the copy this repository already vendors — hash-locked, and verified by the vendor hash
// stage of the same suite run — at the location the resolver looks in. It is the same CLI a developer
// has installed, not a stand-in, so the contracts assert against the real thing rather than being
// weakened to accommodate the runner.

import { lstat, mkdir, readFile, rm } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

import { copyTree } from "./lib/copy-tree.mjs";

const VENDOR_ROOT = "shared/vendor/archify/archify";

export async function resolveVendoredArchify(repoRoot) {
  const lock = JSON.parse(await readFile(path.join(repoRoot, "shared/vendor/archify/vendor.lock.json"), "utf8"));
  // The lock names the upstream release tag; the vendored tree is laid out under the bare version.
  const version = /^v(\d+\.\d+\.\d+)$/u.exec(lock.upstream?.tag ?? "")?.[1];
  if (!version) throw new Error("the archify vendor lock does not name a plain vX.Y.Z upstream tag");
  const source = path.join(repoRoot, VENDOR_ROOT, version);
  const stats = await lstat(source);
  if (!stats.isDirectory() || stats.isSymbolicLink()) throw new Error(`vendored archify ${version} is not a directory`);
  return { version, source };
}

export function hostArchifyDestination(env = process.env, home = homedir()) {
  // The resolver checks CODEX_HOME first and the home-directory .agents tree second. Staging into the
  // second keeps a runner's CODEX_HOME free for whatever else the job does with it.
  void env;
  return path.join(home, ".agents", "skills", "archify");
}

export async function stageHostArchify({ repoRoot = fileURLToPath(new URL("..", import.meta.url)), destination = hostArchifyDestination() } = {}) {
  const canonicalRepoRoot = path.resolve(repoRoot);
  const { version, source } = await resolveVendoredArchify(canonicalRepoRoot);
  // The resolver rejects symlinks and compares realpaths, so this has to be a plain copy, and a stale
  // partial copy from an earlier run would be indistinguishable from a tampered install.
  await rm(destination, { recursive: true, force: true });
  await mkdir(path.dirname(destination), { recursive: true });
  const files = await copyTree(source, destination, { label: `vendored archify ${version}` });
  return { version, destination, files: files.length };
}

async function main() {
  if (process.argv.length > 2) throw new Error("Usage: node tooling/stage-host-archify.mjs");
  const result = await stageHostArchify();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

const entry = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (entry && pathToFileURL(entry).href === import.meta.url) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
