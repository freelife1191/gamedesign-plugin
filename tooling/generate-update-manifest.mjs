#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { loadVendorComponents } from "./lib/vendor-components.mjs";

export const repoRoot = fileURLToPath(new URL("..", import.meta.url));
export const manifestPath = path.join(repoRoot, "shared", "updates", "installed-components.json");

export function installedManifest({ repoRoot: root, loadComponents = loadVendorComponents } = {}) {
  return {
    schemaVersion: 1,
    components: loadComponents({ repoRoot: root }).map(({ id, repository, installedTag, commit }) => ({
      id,
      repository,
      installedTag,
      commit,
    })),
  };
}

function manifestError(code, message, cause) {
  const error = new Error(message, { cause });
  error.code = code;
  return error;
}

export async function generateUpdateManifest({
  repoRoot: root = repoRoot,
  manifestPath: destination = manifestPath,
  check = false,
  loadComponents = loadVendorComponents,
  readManifest = readFile,
  writeManifest = writeFile,
} = {}) {
  const expected = `${JSON.stringify(installedManifest({ repoRoot: root, loadComponents }), null, 2)}\n`;
  if (!check) {
    await writeManifest(destination, expected);
    return expected;
  }
  let actual;
  try {
    actual = await readManifest(destination, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") {
      throw manifestError("UPDATE_MANIFEST_MISSING", "installed-components.json is missing", error);
    }
    throw error;
  }
  if (actual !== expected) throw new Error("installed-components.json is not generated from vendor locks");
  return expected;
}

if (process.argv.length > 2 && !(process.argv.length === 3 && process.argv[2] === "--check")) {
  throw new Error("usage: node tooling/generate-update-manifest.mjs [--check]");
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await generateUpdateManifest({ check: process.argv[2] === "--check" });
}
