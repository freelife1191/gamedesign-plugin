#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { loadVendorComponents } from "./lib/vendor-components.mjs";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const manifestPath = path.join(repoRoot, "shared", "updates", "installed-components.json");

function installedManifest({ repoRoot: root }) {
  return {
    schemaVersion: 1,
    components: loadVendorComponents({ repoRoot: root }).map(({ id, repository, installedTag, commit }) => ({
      id,
      repository,
      installedTag,
      commit,
    })),
  };
}

const expected = `${JSON.stringify(installedManifest({ repoRoot }), null, 2)}\n`;
if (process.argv.length > 2 && !(process.argv.length === 3 && process.argv[2] === "--check")) {
  throw new Error("usage: node tooling/generate-update-manifest.mjs [--check]");
}

if (process.argv[2] === "--check") {
  const actual = await readFile(manifestPath, "utf8").catch(() => "");
  if (actual !== expected) throw new Error("installed-components.json is not generated from vendor locks");
} else {
  await writeFile(manifestPath, expected);
}
