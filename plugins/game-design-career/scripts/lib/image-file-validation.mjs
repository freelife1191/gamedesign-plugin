import { createHash, randomUUID } from "node:crypto";
import { link, lstat, mkdir, realpath, rm, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { inspectCompletePng } from "./complete-png-validation.mjs";

const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
export const maximumImageBytes = 12 * 1024 * 1024;

function failure(code) {
  const error = new Error("Image output failed validation.");
  error.code = code;
  return error;
}

function safeOutputPath(output) {
  if (!output || typeof output !== "object" || output.format !== "png"
    || typeof output.path !== "string" || output.path.includes("\0") || path.isAbsolute(output.path)) return false;
  const normalized = path.posix.normalize(output.path);
  return normalized === output.path && /^assets\/generated\/[A-Za-z0-9][A-Za-z0-9._-]*\.png$/u.test(output.path);
}

async function assertRegularDirectory(directory) {
  const stats = await lstat(directory).catch((error) => error?.code === "ENOENT" ? undefined : Promise.reject(error));
  if (!stats) {
    await mkdir(directory);
    return assertRegularDirectory(directory);
  }
  if (stats.isSymbolicLink() || !stats.isDirectory()) throw failure("unsafe-staging-path");
}

async function assertNoSymlinkComponents(absolutePath) {
  const parsed = path.parse(absolutePath);
  let current = parsed.root;
  for (const segment of absolutePath.slice(parsed.root.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    const stats = await lstat(current).catch((error) => error?.code === "ENOENT" ? undefined : Promise.reject(error));
    if (stats?.isSymbolicLink()) throw failure("unsafe-staging-path");
  }
}

async function prepareDirectories(stagingRoot) {
  if (typeof stagingRoot !== "string" || stagingRoot.length === 0 || stagingRoot.includes("\0")) throw failure("unsafe-staging-path");
  const requestedRoot = path.resolve(stagingRoot);
  const requestedStats = await lstat(requestedRoot).catch(() => undefined);
  if (!requestedStats || requestedStats.isSymbolicLink() || !requestedStats.isDirectory()) throw failure("unsafe-staging-path");
  const root = await realpath(requestedRoot).catch(() => { throw failure("unsafe-staging-path"); });
  await assertNoSymlinkComponents(root);
  await assertRegularDirectory(root);
  const assets = path.join(root, "assets");
  await assertRegularDirectory(assets);
  const generated = path.join(assets, "generated");
  await assertRegularDirectory(generated);
  return { root, generated };
}

export function validatePngBuffer(buffer, { width, height } = {}) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 33 || buffer.length > maximumImageBytes) throw failure("invalid-image-output");
  if (!buffer.subarray(0, pngSignature.length).equals(pngSignature)) throw failure("invalid-image-output");
  if (buffer.readUInt32BE(8) !== 13 || buffer.subarray(12, 16).toString("ascii") !== "IHDR") throw failure("invalid-image-output");
  const actualWidth = buffer.readUInt32BE(16);
  const actualHeight = buffer.readUInt32BE(20);
  if (actualWidth < 1 || actualHeight < 1 || actualWidth !== width || actualHeight !== height) throw failure("invalid-image-output");
  return { bytes: buffer.length, width: actualWidth, height: actualHeight, digest: createHash("sha256").update(buffer).digest("hex") };
}

function inspectJpeg(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4 || buffer.length > maximumImageBytes || buffer[0] !== 0xff || buffer[1] !== 0xd8) return { ok: false };
  let offset = 2;
  let width;
  let height;
  let ended = false;
  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) return { ok: false };
    while (offset < buffer.length && buffer[offset] === 0xff) offset += 1;
    if (offset >= buffer.length) return { ok: false };
    const marker = buffer[offset++];
    if (marker === 0xd9) { ended = true; break; }
    if (marker === 0x00 || marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > buffer.length) return { ok: false };
    const length = buffer.readUInt16BE(offset);
    if (length < 2 || offset + length > buffer.length) return { ok: false };
    if ((marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker))) {
      if (length < 8) return { ok: false };
      height = buffer.readUInt16BE(offset + 3);
      width = buffer.readUInt16BE(offset + 5);
      if (!width || !height) return { ok: false };
    }
    if (marker === 0xda) {
      offset += length;
      while (offset < buffer.length - 1) {
        if (buffer[offset++] !== 0xff) continue;
        const next = buffer[offset];
        if (next === 0x00) { offset += 1; continue; }
        if (next >= 0xd0 && next <= 0xd7) { offset += 1; continue; }
        if (next === 0xd9) { ended = true; offset += 1; break; }
        return { ok: false };
      }
      break;
    }
    offset += length;
  }
  return { ok: ended && Number.isInteger(width) && Number.isInteger(height), width, height };
}

function inspectWebp(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 20 || buffer.length > maximumImageBytes || buffer.toString("ascii", 0, 4) !== "RIFF"
    || buffer.toString("ascii", 8, 12) !== "WEBP" || buffer.readUInt32LE(4) + 8 !== buffer.length) return { ok: false };
  let offset = 12;
  let width;
  let height;
  while (offset + 8 <= buffer.length) {
    const type = buffer.toString("ascii", offset, offset + 4);
    const length = buffer.readUInt32LE(offset + 4);
    const start = offset + 8;
    const end = start + length;
    if (end > buffer.length) return { ok: false };
    if (type === "VP8X" && length >= 10) {
      width = buffer.readUIntLE(start + 4, 3) + 1;
      height = buffer.readUIntLE(start + 7, 3) + 1;
    } else if (type === "VP8 " && length >= 10 && buffer.subarray(start + 3, start + 6).equals(Buffer.from([0x9d, 0x01, 0x2a]))) {
      width = buffer.readUInt16LE(start + 6) & 0x3fff;
      height = buffer.readUInt16LE(start + 8) & 0x3fff;
    } else if (type === "VP8L" && length >= 5 && buffer[start] === 0x2f) {
      const bits = buffer.readUInt32LE(start + 1);
      width = (bits & 0x3fff) + 1;
      height = ((bits >>> 14) & 0x3fff) + 1;
    }
    offset = end + (length % 2);
  }
  return { ok: offset === buffer.length && Number.isInteger(width) && Number.isInteger(height) && width > 0 && height > 0, width, height };
}

export function inspectRasterBuffer(buffer, { format, width, height } = {}) {
  let inspection;
  if (format === "png") inspection = inspectCompletePng(buffer);
  else if (format === "jpeg") inspection = inspectJpeg(buffer);
  else if (format === "webp") inspection = inspectWebp(buffer);
  else return { ok: false };
  return { ok: inspection.ok === true && inspection.width === width && inspection.height === height, width: inspection.width, height: inspection.height };
}

export function decodeOpenAIImage(value) {
  if (typeof value !== "string" || value.length === 0 || value.length > Math.ceil(maximumImageBytes * 4 / 3) + 4
    || value.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/u.test(value)) throw failure("invalid-image-output");
  const bytes = Buffer.from(value, "base64");
  if (bytes.length === 0 || bytes.toString("base64") !== value) throw failure("invalid-image-output");
  return bytes;
}

export async function prepareImageOutput({ stagingRoot, output } = {}) {
  if (!safeOutputPath(output) || !Number.isInteger(output.width) || output.width < 1 || output.width > 8192
    || !Number.isInteger(output.height) || output.height < 1 || output.height > 8192) throw failure("unsafe-staging-path");
  const { root, generated } = await prepareDirectories(stagingRoot);
  const destination = path.resolve(root, ...output.path.split("/"));
  if (path.dirname(destination) !== generated || !destination.startsWith(`${generated}${path.sep}`)) throw failure("unsafe-staging-path");
  const existing = await lstat(destination).catch((error) => error?.code === "ENOENT" ? undefined : Promise.reject(error));
  if (existing) throw failure(existing.isSymbolicLink() ? "unsafe-staging-path" : "output-already-exists");
  return { destination, output: { path: output.path, width: output.width, height: output.height, format: "png" } };
}

export async function promoteValidatedPng({ prepared, bytes } = {}) {
  const image = validatePngBuffer(bytes, prepared?.output);
  const temporary = `${prepared.destination}.tmp-${randomUUID()}`;
  try {
    await writeFile(temporary, bytes, { flag: "wx", mode: 0o600 });
    await link(temporary, prepared.destination);
  } catch {
    await rm(temporary, { force: true }).catch(() => {});
    throw failure("atomic-publish-failed");
  }
  await unlink(temporary).catch(() => {});
  return image;
}
