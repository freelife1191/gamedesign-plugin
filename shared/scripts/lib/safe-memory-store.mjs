import { constants } from "node:fs";
import { link, lstat, mkdir, open, realpath, rename, unlink } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

const MAX_BYTES = 256 * 1024;
const MARKER_START = "# game-design-plugin:memory:begin";
const MARKER_END = "# game-design-plugin:memory:end";
const MARKER = `${MARKER_START}\n.game-design/memory/\n${MARKER_END}\n`;
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

function unsafe() { throw new Error("Unsafe memory store path."); }
function same(left, right) { return left.dev === right.dev && left.ino === right.ino; }
function sameFileVersion(left, right) { return same(left, right) && left.size === right.size && left.mtimeMs === right.mtimeMs && left.ctimeMs === right.ctimeMs; }
function safeRelative(value) { return typeof value === "string" && value.length > 0 && value === value.normalize("NFC") && !value.includes("\0") && !value.includes("\\") && !path.posix.isAbsolute(value) && path.posix.normalize(value) === value && !value.startsWith("../") && value !== "."; }
async function directory(candidate) { const stats = await lstat(candidate); if (stats.isSymbolicLink() || !stats.isDirectory()) unsafe(); return stats; }
async function canonicalDirectory(candidate) { if (typeof candidate !== "string" || !path.isAbsolute(candidate) || candidate.includes("\0")) unsafe(); const requested = path.resolve(candidate); const initial = await directory(requested); const canonical = await realpath(requested); const final = await directory(canonical); if (!same(initial, final)) unsafe(); return { path: canonical, identity: final }; }
async function assertIdentities(values) { for (const item of values) { const current = await directory(item.path); if (!same(current, item.identity)) unsafe(); } }
async function createDirectory(root, segments) { let current = root.path; const identities = [{ path: current, identity: root.identity }]; for (const segment of segments) { current = path.join(current, segment); let stats = await lstat(current).catch((error) => error.code === "ENOENT" ? undefined : Promise.reject(error)); if (!stats) { await assertIdentities(identities); await mkdir(current).catch((error) => error.code === "EEXIST" ? undefined : Promise.reject(error)); stats = await directory(current); } if (stats.isSymbolicLink() || !stats.isDirectory() || await realpath(current) !== current) unsafe(); identities.push({ path: current, identity: stats }); } await assertIdentities(identities); return { path: current, identity: identities.at(-1).identity }; }
async function parentFor(store, relativePath, create = false) { if (!safeRelative(relativePath)) unsafe(); const root = await canonicalDirectory(store?.root); if (!store?.identity || !same(root.identity, store.identity)) unsafe(); let current = root.path; const identities = [{ path: current, identity: root.identity }]; for (const segment of relativePath.split("/").slice(0, -1)) { const next = path.join(current, segment); let stats = await lstat(next).catch((error) => error.code === "ENOENT" ? undefined : Promise.reject(error)); if (!stats && create) { await assertIdentities(identities); await mkdir(next).catch((error) => error.code === "EEXIST" ? undefined : Promise.reject(error)); stats = await directory(next); } if (!stats || stats.isSymbolicLink() || !stats.isDirectory() || await realpath(next) !== next) unsafe(); current = next; identities.push({ path: current, identity: stats }); } await assertIdentities(identities); return { path: current, identities, target: path.join(current, path.posix.basename(relativePath)) }; }
async function targetFile(candidate) { const stats = await lstat(candidate).catch((error) => error.code === "ENOENT" ? undefined : Promise.reject(error)); if (stats && (stats.isSymbolicLink() || !stats.isFile())) unsafe(); return stats; }
async function syncDirectory(candidate) { const handle = await open(candidate, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0)); try { await handle.sync(); } finally { await handle.close(); } }
async function safeReplace(parent, destination, bytes, { beforePublish } = {}) {
  const original = await targetFile(destination); const temporary = path.join(parent.path, `.${path.basename(destination)}.tmp-${randomUUID()}`); let handle;
  try {
    await assertIdentities(parent.identities); handle = await open(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | (constants.O_NOFOLLOW ?? 0), 0o600); await handle.writeFile(bytes); await handle.sync(); const temporaryStats = await handle.stat(); await handle.close(); handle = undefined;
    const temporaryPathStats = await targetFile(temporary); if (!temporaryPathStats || !same(temporaryPathStats, temporaryStats)) unsafe(); if (typeof beforePublish === "function") await beforePublish({ destination, temporary }); await assertIdentities(parent.identities); const current = await targetFile(destination); if ((original === undefined) !== (current === undefined) || original && !sameFileVersion(original, current)) unsafe(); if (original) await rename(temporary, destination); else { await link(temporary, destination); await unlink(temporary); } const published = await targetFile(destination); if (!published || !same(published, temporaryStats)) unsafe(); await syncDirectory(parent.path); await assertIdentities(parent.identities);
  } catch (error) { await handle?.close().catch(() => {}); try { await assertIdentities(parent.identities); await unlink(temporary); } catch {} throw error; }
}

export function memoryRecordRelativePath(record) {
  if (!record || Object.keys(record).some((key) => !["memory_id", "project_id", "kind", "status"].includes(key)) || !safeId(record.memory_id) || !safeId(record.project_id) || !["style-preference", "project-fact", "decision", "design-lesson", "career-lesson", "external-note"].includes(record.kind) || !["candidate", "verified", "approved", "expired", "rejected", "disputed", "superseded", "stale"].includes(record.status)) unsafe();
  if (record.kind === "style-preference") return `preferences/${record.memory_id}.md`;
  if (["project-fact", "decision", "external-note"].includes(record.kind)) return `projects/${record.project_id}/${record.memory_id}.md`;
  if (record.status === "approved") return `lessons/approved/${record.memory_id}.md`;
  if (["expired", "rejected", "superseded", "stale"].includes(record.status)) return `lessons/retired/${record.memory_id}.md`;
  return `lessons/candidates/${record.memory_id}.md`;
}

export async function resolveMemoryStore({ workspaceRoot, config, platform, home, initialize = false } = {}) {
  if (!config?.enabled || !safeId(config.projectId)) return null;
  const workspace = await canonicalDirectory(workspaceRoot);
  const global = { darwin: ["Library", "Application Support", "game-design-plugin", "memory"], linux: [".local", "share", "game-design-plugin", "memory"], win32: ["AppData", "Local", "game-design-plugin", "memory"] };
  let root;
  if (config.scope === "global") { if (!global[platform] || typeof home !== "string" || !path.isAbsolute(home)) unsafe(); let homeRoot; try { homeRoot = await canonicalDirectory(home); } catch (error) { if (!initialize || error?.code !== "ENOENT") throw error; await mkdir(home, { recursive: true, mode: 0o700 }); homeRoot = await canonicalDirectory(home); } root = initialize ? await createDirectory(homeRoot, global[platform]) : { path: path.join(homeRoot.path, ...global[platform]) }; }
  else { root = initialize ? await createDirectory(workspace, [".game-design", "memory"]) : { path: path.join(workspace.path, ".game-design", "memory") }; }
  if (!initialize) { const stats = await lstat(root.path).catch((error) => error.code === "ENOENT" ? undefined : Promise.reject(error)); if (!stats) throw new Error("Memory store is not initialized."); }
  const canonical = await canonicalDirectory(root.path);
  return { root: canonical.path, identity: canonical.identity, scope: config.scope, projectId: config.projectId };
}
function safeId(value) { return typeof value === "string" && value === value.normalize("NFC") && ID.test(value); }

export async function readMemoryFile({ store, relativePath, maxBytes = MAX_BYTES } = {}) {
  if (!store?.root || !Number.isInteger(maxBytes) || maxBytes < 1 || maxBytes > MAX_BYTES) unsafe();
  const parent = await parentFor(store, relativePath); const prior = await targetFile(parent.target); if (!prior) throw new Error("Memory file does not exist.");
  const handle = await open(parent.target, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try { const opened = await handle.stat(); if (!opened.isFile() || !sameFileVersion(opened, prior) || opened.size > maxBytes) unsafe(); const bytes = await handle.readFile(); const after = await handle.stat(); await assertIdentities(parent.identities); const current = await targetFile(parent.target); if (!sameFileVersion(after, opened) || !current || !sameFileVersion(current, prior) || bytes.byteLength > maxBytes) unsafe(); return bytes; } finally { await handle.close(); }
}

export async function writeMemoryFileAtomic({ store, relativePath, bytes, policy = "replace" } = {}) {
  if (!Buffer.isBuffer(bytes) || bytes.byteLength > MAX_BYTES) unsafe(); const createOnce = policy === "create-once" || policy?.mode === "create-once"; if (!(policy === "replace" || policy === "create-once" || (policy && typeof policy === "object" && [undefined, "replace", "create-once"].includes(policy.mode)))) unsafe();
  const parent = await parentFor(store, relativePath, true); const original = await targetFile(parent.target); if (createOnce && original) throw new Error("Memory file already exists.");
  const temporary = path.join(parent.path, `.${path.basename(parent.target)}.tmp-${randomUUID()}`); let handle;
  try { await assertIdentities(parent.identities); handle = await open(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | (constants.O_NOFOLLOW ?? 0), 0o600); await handle.writeFile(bytes); await handle.sync(); const temporaryStats = await handle.stat(); await handle.close(); handle = undefined; const tempPathStats = await targetFile(temporary); if (!tempPathStats || !same(tempPathStats, temporaryStats)) unsafe(); if (typeof policy?.beforeRename === "function") await policy.beforeRename({ destination: parent.target, temporary }); if (typeof policy?.beforePublish === "function") await policy.beforePublish({ destination: parent.target, temporary }); await assertIdentities(parent.identities); const current = await targetFile(parent.target); if ((original === undefined) !== (current === undefined) || original && !sameFileVersion(original, current)) unsafe(); if (original) await rename(temporary, parent.target); else { await link(temporary, parent.target); await unlink(temporary); } const published = await targetFile(parent.target); if (!published || !same(published, temporaryStats)) unsafe(); await syncDirectory(parent.path); await assertIdentities(parent.identities); } catch (error) { await handle?.close().catch(() => {}); try { await assertIdentities(parent.identities); await unlink(temporary); } catch {} throw error; }
}

export async function moveMemoryFileAtomic({ store, from, to, policy = {} } = {}) {
  const source = await parentFor(store, from); const sourceStats = await targetFile(source.target); if (!sourceStats) throw new Error("Memory file does not exist."); const destination = await parentFor(store, to, true); if (await targetFile(destination.target)) throw new Error("Memory destination already exists."); if (typeof policy?.beforePublish === "function") await policy.beforePublish({ source: source.target, destination: destination.target }); await assertIdentities([...source.identities, ...destination.identities]); const current = await targetFile(source.target); if (!current || !sameFileVersion(current, sourceStats) || await targetFile(destination.target)) unsafe(); await link(source.target, destination.target); const moved = await targetFile(destination.target); if (!moved || !same(moved, sourceStats)) unsafe(); await unlink(source.target); await syncDirectory(source.path); if (destination.path !== source.path) await syncDirectory(destination.path); await assertIdentities([...source.identities, ...destination.identities]);
}

export async function ensureMemoryGitExclusion({ workspaceRoot, gitMode, runGit, beforePublish } = {}) {
  if (gitMode !== "local") return { status: "skipped" }; if (typeof runGit !== "function") return { status: "skipped" };
  let common; let exclude;
  try { common = String(await runGit(["rev-parse", "--git-common-dir"], workspaceRoot)).trim(); exclude = String(await runGit(["rev-parse", "--path-format=absolute", "--git-path", "info/exclude"], workspaceRoot)).trim(); } catch { return { status: "skipped" }; }
  let workspace; let commonRoot;
  try { workspace = await canonicalDirectory(workspaceRoot); const commonPath = path.isAbsolute(common) ? path.resolve(common) : path.resolve(workspace.path, common); commonRoot = await canonicalDirectory(commonPath); } catch { return { status: "skipped" }; }
  const expected = path.resolve(commonRoot.path, "info", "exclude");
  if (!path.isAbsolute(exclude) || path.resolve(exclude) !== expected) return { status: "skipped" };
  let info; try { info = await createDirectory(commonRoot, ["info"]); } catch { return { status: "skipped" }; }
  const parent = { path: info.path, identities: [{ path: commonRoot.path, identity: commonRoot.identity }, { path: info.path, identity: info.identity }] };
  const existing = await readMemoryLikeFile(parent, exclude).catch((error) => error?.code === "ENOENT" ? Buffer.alloc(0) : Promise.reject(error)); const text = existing.toString("utf8"); const blocks = [...text.matchAll(/^# game-design-plugin:memory:begin\n\.game-design\/memory\/\n# game-design-plugin:memory:end\n?$/gmu)]; const markerLines = (text.match(/^# game-design-plugin:memory:(?:begin|end)$/gmu) ?? []).length;
  if (blocks.length === 1 && markerLines === 2) return { status: "present" }; if (blocks.length !== 0 || markerLines !== 0) throw new Error("Malformed game-design memory exclusion marker.");
  const separator = existing.byteLength === 0 || text.endsWith("\n") ? "" : "\n"; await safeReplace(parent, exclude, Buffer.concat([existing, Buffer.from(`${separator}${MARKER}`)]), { beforePublish }); return { status: "added" };
}

async function readMemoryLikeFile(parent, target) {
  const prior = await targetFile(target); if (!prior) { const missing = new Error("missing"); missing.code = "ENOENT"; throw missing; }
  const handle = await open(target, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try { const opened = await handle.stat(); if (!opened.isFile() || !sameFileVersion(opened, prior) || opened.size > MAX_BYTES) unsafe(); const bytes = await handle.readFile(); const after = await handle.stat(); await assertIdentities(parent.identities); const current = await targetFile(target); if (!sameFileVersion(after, opened) || !current || !sameFileVersion(current, prior) || bytes.byteLength > MAX_BYTES) unsafe(); return bytes; } finally { await handle.close(); }
}
