import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import path from "node:path";

import { inspectCompletePng } from "./complete-png-validation.mjs";
import { noFollowOpenFlag } from "./platform-file-hardening.mjs";

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

function identity(stats) {
  return {
    dev: stats.dev, ino: stats.ino, mode: stats.mode, size: stats.size,
    ctimeMs: stats.ctimeMs, mtimeMs: stats.mtimeMs,
  };
}

function sameIdentity(left, right) {
  return left?.dev === right?.dev && left?.ino === right?.ino && left?.mode === right?.mode
    && left?.size === right?.size && left?.ctimeMs === right?.ctimeMs && left?.mtimeMs === right?.mtimeMs;
}

function sameFileIdentity(left, right) {
  return left?.dev === right?.dev && left?.ino === right?.ino && left?.mode === right?.mode && left?.size === right?.size;
}

function sameDirectoryIdentity(left, right) {
  return left?.dev === right?.dev && left?.ino === right?.ino && left?.mode === right?.mode;
}

async function pinPath(absolutePath, { directory = false, allowMetadataChange = false } = {}) {
  const stats = await lstat(absolutePath);
  const canonical = await realpath(absolutePath);
  if (stats.isSymbolicLink() || canonical !== absolutePath || (directory && !stats.isDirectory())) throw new Error("unsafe reference path");
  return { path: absolutePath, identity: identity(stats), directory, allowMetadataChange };
}

async function verifyPin(pin) {
  const stats = await lstat(pin.path);
  const canonical = await realpath(pin.path);
  const current = identity(stats);
  const matches = pin.directory && pin.allowMetadataChange ? sameDirectoryIdentity(pin.identity, current) : sameIdentity(pin.identity, current);
  if (stats.isSymbolicLink() || canonical !== pin.path || !matches) throw new Error("reference identity changed");
}

async function pinRoot(root) {
  if (typeof root !== "string" || root.length === 0 || root.includes("\0")) throw new Error("unsafe reference root");
  const requested = path.resolve(root);
  const requestedStats = await lstat(requested);
  if (!requestedStats.isDirectory() || requestedStats.isSymbolicLink()) throw new Error("unsafe reference root");
  const canonical = await realpath(requested);
  const pin = await pinPath(canonical, { directory: true, allowMetadataChange: true });
  return { root: canonical, pins: [pin] };
}

async function pinContainedPath(root, relativePath) {
  if (!safeReferencePath(relativePath)) throw new Error("unsafe reference path");
  const destination = path.resolve(root, ...relativePath.split("/"));
  const relative = path.relative(root, destination);
  if (relative === "" || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw new Error("unsafe reference path");
  const pins = [];
  let cursor = root;
  const segments = relativePath.split("/");
  for (const [index, segment] of segments.entries()) {
    cursor = path.resolve(cursor, segment);
    if (index < segments.length - 1) pins.push(await pinPath(cursor, { directory: true }));
  }
  return { destination, pins };
}

async function verifyPins(pins) {
  for (const pin of pins) await verifyPin(pin);
}

async function verifyReferenceFile(destination, expectedIdentity, expectedDigest) {
  let handle;
  try {
    handle = await open(destination, constants.O_RDONLY | noFollowOpenFlag());
    const before = await handle.stat();
    if (!before.isFile() || !sameIdentity(expectedIdentity, identity(before))) throw new Error("reference identity changed");
    const bytes = await handle.readFile();
    const after = await handle.stat();
    const current = await lstat(destination);
    const canonical = await realpath(destination);
    if (!sameIdentity(expectedIdentity, identity(after)) || !sameIdentity(expectedIdentity, identity(current))
      || current.isSymbolicLink() || canonical !== destination || bytes.length !== before.size
      || createHash("sha256").update(bytes).digest("hex") !== expectedDigest) throw new Error("reference identity changed");
  } finally {
    await handle?.close().catch(() => {});
  }
}

export async function readSecureReferenceFile({ artifactRoot, path: referencePath } = {}) {
  const { root, pins: rootPins } = await pinRoot(artifactRoot);
  const { destination, pins: pathPins } = await pinContainedPath(root, referencePath);
  const pins = [...rootPins, ...pathPins];
  let handle;
  try {
    await verifyPins(pins);
    handle = await open(destination, constants.O_RDONLY | noFollowOpenFlag());
    const before = await handle.stat();
    if (!before.isFile() || before.size < 1 || before.size > maximumReferenceImageBytes) throw new Error("unsafe reference file");
    const bytes = await handle.readFile();
    const after = await handle.stat();
    const current = await lstat(destination);
    const canonical = await realpath(destination);
    if (!sameFileIdentity(identity(before), identity(after)) || !sameFileIdentity(identity(before), identity(current))
      || current.isSymbolicLink() || canonical !== destination || bytes.length !== before.size) throw new Error("reference identity changed");
    await verifyPins(pins);
    const inspection = inspectCompletePng(bytes);
    if (!inspection.ok) throw new Error("invalid reference png");
    const fileIdentity = identity(before);
    const digest = createHash("sha256").update(bytes).digest("hex");
    return {
      path: referencePath,
      bytes,
      digest,
      filename: path.posix.basename(referencePath),
      verify: async () => { await verifyPins(pins); await verifyReferenceFile(destination, fileIdentity, digest); await verifyPins(pins); },
    };
  } finally {
    await handle?.close().catch(() => {});
  }
}

export async function loadSecureReferenceInputs({ artifactRoot, references } = {}) {
  if (!Array.isArray(references) || references.length > maximumReferenceImages) throw new Error("invalid references");
  const seen = new Set();
  const inputs = [];
  const verifiers = [];
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
    verifiers.push(file.verify);
  }
  return { inputs, verify: async () => { for (const verify of verifiers) await verify(); } };
}
