import { constants } from "node:fs";
import { link, lstat, open, realpath, rename, unlink } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

function unsafePath() {
  throw new Error("Unsafe artifact write path.");
}

function sameFile(left, right) {
  return left.dev === right.dev && left.ino === right.ino;
}

function safeRelativePath(value) {
  return typeof value === "string" && value.length > 0 && value === value.normalize("NFC")
    && !value.includes("\0") && !value.includes("\\") && !path.posix.isAbsolute(value)
    && path.posix.normalize(value) === value && !value.startsWith("../") && value !== ".";
}

async function regularDirectory(candidate) {
  const stats = await lstat(candidate).catch(() => undefined);
  if (!stats || stats.isSymbolicLink() || !stats.isDirectory()) unsafePath();
  return stats;
}

export async function canonicalArtifactRoot(value) {
  if (typeof value !== "string" || value.length === 0 || value.includes("\0") || !path.isAbsolute(value)) unsafePath();
  const requested = path.resolve(value);
  const requestedStats = await regularDirectory(requested);
  const canonical = await realpath(requested).catch(unsafePath);
  const canonicalStats = await regularDirectory(canonical);
  if (!sameFile(requestedStats, canonicalStats)) unsafePath();
  return { path: canonical, identity: canonicalStats };
}

async function parentDirectory(root, relativePath) {
  let current = root.path;
  const identities = [{ path: current, stats: root.identity }];
  for (const segment of relativePath.split("/").slice(0, -1)) {
    current = path.resolve(current, segment);
    const stats = await regularDirectory(current);
    if (await realpath(current).catch(unsafePath) !== current) unsafePath();
    identities.push({ path: current, stats });
  }
  return { path: current, identities };
}

async function assertIdentities(identities) {
  for (const { path: candidate, stats } of identities) {
    const current = await regularDirectory(candidate);
    if (!sameFile(current, stats)) unsafePath();
  }
}

async function targetIdentity(destination) {
  const stats = await lstat(destination).catch((error) => error?.code === "ENOENT" ? undefined : Promise.reject(error));
  if (stats && (stats.isSymbolicLink() || !stats.isFile())) unsafePath();
  return stats;
}

async function removeTemporary(temporary, identities) {
  try {
    await assertIdentities(identities);
    await unlink(temporary);
  } catch {
    // A changed parent is never traversed for cleanup.
  }
}

export async function safeWriteArtifactFile({ artifactRoot: rootValue, relativePath, data, policy = "replace", mode = 0o600, maxBytes = 2 * 1024 * 1024 } = {}, { beforePublish } = {}) {
  if (!safeRelativePath(relativePath) || !["create-once", "replace"].includes(policy)) unsafePath();
  const bytes = Buffer.isBuffer(data) ? data : Buffer.from(String(data), "utf8");
  if (bytes.byteLength > maxBytes) unsafePath();
  const root = await canonicalArtifactRoot(rootValue);
  const parent = await parentDirectory(root, relativePath);
  const destination = path.resolve(parent.path, path.posix.basename(relativePath));
  const prior = await targetIdentity(destination);
  if (policy === "create-once" && prior) throw new Error("Artifact output already exists.");
  const temporary = path.join(parent.path, `.${path.basename(destination)}.tmp-${randomUUID()}`);
  let handle;
  let temporaryStats;
  try {
    await assertIdentities(parent.identities);
    handle = await open(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | (constants.O_NOFOLLOW ?? 0), mode);
    await handle.writeFile(bytes);
    await handle.sync();
    temporaryStats = await handle.stat();
    await handle.close();
    handle = undefined;
    const pathStats = await lstat(temporary);
    if (pathStats.isSymbolicLink() || !pathStats.isFile() || !sameFile(pathStats, temporaryStats)) unsafePath();
    if (typeof beforePublish === "function") await beforePublish({ destination, temporary });
    await assertIdentities(parent.identities);
    const current = await targetIdentity(destination);
    if (policy === "create-once" ? current !== undefined : Boolean(prior) !== Boolean(current) || prior && !sameFile(prior, current)) unsafePath();
    if (policy === "create-once") await link(temporary, destination);
    else await rename(temporary, destination);
    const published = await targetIdentity(destination);
    if (!published || !sameFile(published, temporaryStats)) unsafePath();
    await assertIdentities(parent.identities);
    if (policy === "create-once") await unlink(temporary);
  } catch (error) {
    await handle?.close().catch(() => {});
    await removeTemporary(temporary, parent.identities);
    throw error;
  }
}
