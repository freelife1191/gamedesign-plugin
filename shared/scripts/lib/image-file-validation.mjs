import { createHash, randomUUID } from "node:crypto";
import { link, lstat, mkdir, realpath, rm, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

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

export async function promoteValidatedPng({ prepared, bytes, beforePublish } = {}) {
  const image = validatePngBuffer(bytes, prepared?.output);
  const temporary = `${prepared.destination}.tmp-${randomUUID()}`;
  try {
    await writeFile(temporary, bytes, { flag: "wx", mode: 0o600 });
    await beforePublish?.();
    await link(temporary, prepared.destination);
  } catch {
    await rm(temporary, { force: true }).catch(() => {});
    throw failure("atomic-publish-failed");
  }
  await unlink(temporary).catch(() => {});
  return image;
}
