import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { collectTree } from "./lib/copy-tree.mjs";
import { sha256 } from "./lib/hash.mjs";

const PINNED_PACKAGE = Object.freeze({
  name: "svg-infographic",
  version: "0.8.3",
  upstream: "https://github.com/kyungseo/skillstead",
  license: "Apache-2.0",
  copyright: "Copyright 2026 Kyungseo Park",
});

function parseArgs(args) {
  if (args.length === 0) return {};
  if (args.length === 2 && args[0] === "--root" && args[1]) return { root: args[1] };
  throw new Error("Usage: node tooling/verify-vendor-hash.mjs [--root <repository-root>]");
}

function assertPinnedMetadata(metadata) {
  for (const [key, expected] of Object.entries(PINNED_PACKAGE)) {
    if (metadata?.[key] !== expected) {
      throw new Error(`vendor lock package ${key} mismatch: expected ${expected}`);
    }
  }
}

export async function verifyVendorRoot(vendorRoot) {
  const lockPath = path.join(vendorRoot, "vendor.lock.json");
  const lock = JSON.parse(await readFile(lockPath, "utf8"));
  assertPinnedMetadata(lock.package);
  if (!Array.isArray(lock.files)) throw new Error("vendor lock files must be an array");

  const packageRoot = path.join(vendorRoot, PINNED_PACKAGE.name, PINNED_PACKAGE.version);
  const actualEntries = await collectTree(packageRoot, { label: "vendored svg-infographic" });
  const actual = new Map(actualEntries.map((entry) => [entry.relativePath, entry]));
  const locked = new Set();

  for (const file of lock.files) {
    if (!file || typeof file.path !== "string" || typeof file.sha256 !== "string" || !Number.isSafeInteger(file.size)) {
      throw new Error("vendor lock contains a malformed file entry");
    }
    if (locked.has(file.path)) throw new Error(`vendor lock contains duplicate path: ${file.path}`);
    locked.add(file.path);
    const entry = actual.get(file.path);
    if (!entry) throw new Error(`missing vendored file: ${file.path}`);
    if (entry.bytes.length !== file.size || sha256(entry.bytes) !== file.sha256) {
      throw new Error(`modified vendored file: ${file.path}`);
    }
  }

  for (const file of actual.keys()) {
    if (!locked.has(file)) throw new Error(`unexpected vendored file: ${file}`);
  }
  if (lock.files.length !== actual.size) throw new Error("vendor lock file count mismatch");

  return actual.size;
}

export async function verifyVendorHash(repositoryRoot) {
  return verifyVendorRoot(path.join(repositoryRoot, "shared/vendor/skillstead"));
}

const modulePath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === modulePath) {
  try {
    const { root } = parseArgs(process.argv.slice(2));
    const repositoryRoot = root ? path.resolve(root) : path.resolve(path.dirname(modulePath), "..");
    const count = await verifyVendorHash(repositoryRoot);
    console.log(`Skillstead vendor verified ${count} files`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
