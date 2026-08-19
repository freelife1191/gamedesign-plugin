// Tests that exercise a vendored upstream have to name its tree, and the tree path carries the version.
// Writing that version into an import specifier makes every upstream bump break the test file for a
// reason that has nothing to do with what the test asserts. These read the vendor lock instead, so the
// bump moves one place and the tests follow it.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

export function vendorLock(id) {
  return JSON.parse(readFileSync(path.join(repoRoot, "shared/vendor", id, "vendor.lock.json"), "utf8"));
}

export function vendorTag(id) {
  return vendorLock(id).upstream.tag;
}

export function vendorTreeRoot(id) {
  return vendorLock(id).tree.root;
}

export function vendorVersion(id) {
  return vendorTag(id).split("/").at(-1).replace(/^v/u, "");
}

export function vendorPath(id, relativePath) {
  return path.join(repoRoot, "shared/vendor", id, vendorTreeRoot(id), relativePath);
}

export function importVendored(id, relativePath) {
  return import(pathToFileURL(vendorPath(id, relativePath)).href);
}
