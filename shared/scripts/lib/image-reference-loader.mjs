import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import path from "node:path";

import { inspectCompletePng } from "./complete-png-validation.mjs";

export const maximumReferenceImages = 8;
export const maximumReferenceImageBytes = 12 * 1024 * 1024;
export const maximumReferenceBytes = 24 * 1024 * 1024;

const digestPattern = /^[a-f0-9]{64}$/u;
const assetIdPattern = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u;

function safeReferencePath(value) {
  return typeof value === "string" && value.length > 0 && !value.includes("\0") && !value.includes("\\")
    && !path.posix.isAbsolute(value) && path.posix.normalize(value) === value && !value.startsWith("../")
    && value.startsWith("assets/generated/");
}

function sameIdentity(left, right) {
  return left?.dev === right?.dev && left?.ino === right?.ino && left?.size === right?.size;
}

async function assertRegularRoot(root) {
  if (typeof root !== "string" || root.length === 0 || root.includes("\0")) throw new Error("unsafe reference root");
  const requested = path.resolve(root);
  const requestedStats = await lstat(requested).catch(() => undefined);
  if (!requestedStats?.isDirectory() || requestedStats.isSymbolicLink()) throw new Error("unsafe reference root");
  const canonical = await realpath(requested).catch(() => { throw new Error("unsafe reference root"); });
  const canonicalStats = await lstat(canonical).catch(() => undefined);
  if (!canonicalStats?.isDirectory() || canonicalStats.isSymbolicLink()) throw new Error("unsafe reference root");
  return canonical;
}

async function assertContainedNonSymlinkPath(root, relativePath) {
  if (!safeReferencePath(relativePath)) throw new Error("unsafe reference path");
  const destination = path.resolve(root, ...relativePath.split("/"));
  const relative = path.relative(root, destination);
  if (relative === "" || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw new Error("unsafe reference path");
  let cursor = root;
  for (const segment of relativePath.split("/")) {
    cursor = path.resolve(cursor, segment);
    const stats = await lstat(cursor);
    if (stats.isSymbolicLink()) throw new Error("unsafe reference path");
  }
  return destination;
}

export async function readSecureReferenceFile({ artifactRoot, path: referencePath } = {}) {
  const root = await assertRegularRoot(artifactRoot);
  const destination = await assertContainedNonSymlinkPath(root, referencePath);
  let handle;
  try {
    handle = await open(destination, constants.O_RDONLY | constants.O_NOFOLLOW);
    const before = await handle.stat();
    if (!before.isFile() || before.size < 1 || before.size > maximumReferenceImageBytes) throw new Error("unsafe reference file");
    const bytes = await handle.readFile();
    const after = await handle.stat();
    const current = await lstat(destination);
    if (!sameIdentity(before, after) || !sameIdentity(before, current) || bytes.length !== before.size) throw new Error("reference identity changed");
    const inspection = inspectCompletePng(bytes);
    if (!inspection.ok) throw new Error("invalid reference png");
    return {
      path: referencePath,
      bytes,
      digest: createHash("sha256").update(bytes).digest("hex"),
      filename: path.posix.basename(referencePath),
    };
  } finally {
    await handle?.close().catch(() => {});
  }
}

export async function loadSecureReferenceInputs({ artifactRoot, references } = {}) {
  if (!Array.isArray(references) || references.length > maximumReferenceImages) throw new Error("invalid references");
  const seen = new Set();
  const inputs = [];
  let total = 0;
  for (const reference of references) {
    if (!reference || typeof reference !== "object" || JSON.stringify(Object.keys(reference).sort()) !== JSON.stringify(["asset_id", "path", "sha256"])
      || !assetIdPattern.test(reference.asset_id ?? "") || !digestPattern.test(reference.sha256 ?? "") || seen.has(reference.asset_id)) {
      throw new Error("invalid reference");
    }
    seen.add(reference.asset_id);
    const file = await readSecureReferenceFile({ artifactRoot, path: reference.path });
    if (file.digest !== reference.sha256 || total + file.bytes.length > maximumReferenceBytes) throw new Error("stale or oversized reference");
    total += file.bytes.length;
    inputs.push({ ...reference, bytes: file.bytes, filename: file.filename });
  }
  return inputs;
}
