#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { loadVendorComponents } from "./lib/vendor-components.mjs";

const PRODUCT_NAMES = Object.freeze(["game-design-career", "game-design-studio"]);

export const repoRoot = fileURLToPath(new URL("..", import.meta.url));
export const manifestPath = path.join(repoRoot, "shared", "updates", "installed-components.json");

// The suite is not a vendored upstream, so it has no vendor.lock.json. Its release pin lives in
// its own lock file, written by the release step, and the tag there has to agree with the version
// both products ship. A silent disagreement would make the advisory compare against a release the
// installed plugin is not.
export function loadSuiteRelease({ repoRoot: root, readLock = readFileSync } = {}) {
  const lock = JSON.parse(readLock(path.join(root, "shared", "updates", "suite-release.lock.json"), "utf8"));
  const productVersions = PRODUCT_NAMES.map((product) => ({
    product,
    version: JSON.parse(readLock(path.join(root, "products", product, "plugin", ".codex-plugin", "plugin.json"), "utf8")).version,
  }));
  const mismatched = productVersions.filter(({ version }) => `v${version}` !== lock.installedTag);
  if (mismatched.length > 0) {
    throw manifestError(
      "SUITE_VERSION_MISMATCH",
      `suite-release.lock.json pins ${lock.installedTag} but ${mismatched.map(({ product, version }) => `${product} ships ${version}`).join(", ")}`,
    );
  }
  return { id: lock.id, repository: lock.repository, installedTag: lock.installedTag, commit: lock.commit };
}

export function installedManifest({ repoRoot: root, loadComponents = loadVendorComponents, loadSuite = loadSuiteRelease } = {}) {
  return {
    schemaVersion: 1,
    components: [
      ...loadComponents({ repoRoot: root }).map(({ id, repository, installedTag, commit }) => ({
        id,
        repository,
        installedTag,
        commit,
      })),
      loadSuite({ repoRoot: root }),
    ],
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
  loadSuite = loadSuiteRelease,
  readManifest = readFile,
  writeManifest = writeFile,
} = {}) {
  const expected = `${JSON.stringify(installedManifest({ repoRoot: root, loadComponents, loadSuite }), null, 2)}\n`;
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

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length > 2 && !(process.argv.length === 3 && process.argv[2] === "--check")) {
    throw new Error("usage: node tooling/generate-update-manifest.mjs [--check]");
  }
  await generateUpdateManifest({ check: process.argv[2] === "--check" });
}
