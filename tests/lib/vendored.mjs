// Tests that exercise a vendored upstream have to name its tree, and the tree path carries the version.
// Writing that version into an import specifier makes every upstream bump break the test file for a
// reason that has nothing to do with what the test asserts. These read the vendor lock instead, so the
// bump moves one place and the tests follow it.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { loadVendorComponents } from "../../tooling/lib/vendor-components.mjs";
import { applyVendorDescriptionOverlay, loadVendorDescriptionOverlays } from "../../tooling/lib/vendor-description-overlay.mjs";

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

// A packaged vendored file is the upstream byte with one declared exception: the description overlay
// rewrites the frontmatter description of one SKILL.md as the build projects it, because the upstream
// text runs past the router's catalog budget. A gate that compares a packaged tree against the lock
// therefore has to expect the overlaid digest on that one path, and the lock digest everywhere else.
// The overlay is applied here to the locked source, so the lock still governs what it was applied to.
export function packagedVendorFiles(id) {
  const lock = vendorLock(id);
  const component = loadVendorComponents({ repoRoot }).find((candidate) => candidate.id === id);
  const overlay = loadVendorDescriptionOverlays({ repoRoot }).get(component.module);
  if (!overlay) return lock.tree.files;
  const source = readFileSync(vendorPath(id, overlay.path));
  const { bytes } = applyVendorDescriptionOverlay({ relativePath: overlay.path, bytes: source }, overlay);
  const overlaid = { path: overlay.path, size: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") };
  return lock.tree.files.map((file) => (file.path === overlay.path ? { ...file, ...overlaid } : file));
}
