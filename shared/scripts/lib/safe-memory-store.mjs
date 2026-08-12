import { constants } from "node:fs";
import { link, lstat, mkdir, mkdtemp, open, realpath, rename, unlink } from "node:fs/promises";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const MAX_BYTES = 256 * 1024;
const MARKER_START = "# game-design-plugin:memory:begin";
const MARKER_END = "# game-design-plugin:memory:end";
const MARKER = `${MARKER_START}\n.game-design/memory/\n${MARKER_END}\n`;
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

export const MEMORY_PLATFORM_CAPABILITIES = Object.freeze(["directoryRelative", "atomicNoReplace", "atomicReplace"]);

function unsafe() { throw new Error("Unsafe memory store path."); }
function unsupported() { const failure = new Error("Memory store capability is unavailable on this platform."); failure.code = "memory.platform_unsupported"; throw failure; }
function same(left, right) { return left.dev === right.dev && left.ino === right.ino; }
function sameFileVersion(left, right) { return same(left, right) && left.size === right.size && left.mtimeMs === right.mtimeMs && left.ctimeMs === right.ctimeMs; }
function safeRelative(value) { return typeof value === "string" && value.length > 0 && value === value.normalize("NFC") && !value.includes("\0") && !value.includes("\\") && !path.posix.isAbsolute(value) && path.posix.normalize(value) === value && !value.startsWith("../") && value !== "." && value !== ".."; }
async function directory(candidate) { const stats = await lstat(candidate); if (stats.isSymbolicLink() || !stats.isDirectory()) unsafe(); return stats; }
async function canonicalDirectory(candidate) { if (typeof candidate !== "string" || !path.isAbsolute(candidate) || candidate.includes("\0")) unsafe(); const requested = path.resolve(candidate); const initial = await directory(requested); const canonical = await realpath(requested); const final = await directory(canonical); if (!same(initial, final)) unsafe(); return { path: canonical, identity: final }; }
async function assertIdentities(values) { for (const item of values) { const current = await directory(item.path); if (!same(current, item.identity)) unsafe(); } }
async function parentFor(store, relativePath) { if (!safeRelative(relativePath)) unsafe(); const root = await canonicalDirectory(store?.root); if (!store?.identity || !same(root.identity, store.identity)) unsafe(); const segments = relativePath.split("/").slice(0, -1); let current = root.path; const identities = [{ path: current, identity: root.identity }]; for (const segment of segments) { const next = path.join(current, segment); const stats = await lstat(next).catch((error) => error.code === "ENOENT" ? undefined : Promise.reject(error)); if (!stats || stats.isSymbolicLink() || !stats.isDirectory() || await realpath(next) !== next) unsafe(); current = next; identities.push({ path: current, identity: stats }); } await assertIdentities(identities); return { path: current, relative: segments.join("/"), identities, target: path.join(current, path.posix.basename(relativePath)) }; }
async function targetFile(candidate) { const stats = await lstat(candidate).catch((error) => error.code === "ENOENT" ? undefined : Promise.reject(error)); if (stats && (stats.isSymbolicLink() || !stats.isFile())) unsafe(); return stats; }
async function syncDirectory(candidate) { const handle = await open(candidate, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0)); try { await handle.sync(); } finally { await handle.close(); } }

const POSIX_HELPER_SOURCE = fileURLToPath(new URL("./memory-store-posix-helper.c", import.meta.url));
let posixHelper;
function helperError(message) { const failure = new Error(message || "Memory store helper failed."); failure.code = /^memory\.[a-z_]+$/u.test(message ?? "") ? message : "memory.helper_failed"; return failure; }
async function helperBinary() {
  if (!(["darwin", "linux"].includes(process.platform))) unsupported();
  if (!posixHelper) posixHelper = (async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "game-design-memory-helper-"));
    const binary = path.join(directory, "memory-store-posix-helper");
    await new Promise((resolve, reject) => {
      const compiler = spawn("/usr/bin/cc", ["-std=c11", "-D_GNU_SOURCE", "-D_DARWIN_C_SOURCE", POSIX_HELPER_SOURCE, "-o", binary], { stdio: ["ignore", "ignore", "pipe"] }); let stderr = "";
      compiler.stderr.on("data", (chunk) => { stderr += chunk; }); compiler.on("error", () => reject(helperError("memory.platform_unsupported"))); compiler.on("close", (code) => code === 0 ? resolve() : reject(helperError(stderr.includes("renameat") ? "memory.platform_unsupported" : "memory.helper_compile")));
    });
    return binary;
  })();
  return posixHelper;
}
async function runPosixHelper({ root, parent, mode, temporary, destination, bytes, expected, sourceParent, source } = {}) {
  const binary = await helperBinary();
  const args = sourceParent ? ["move", `${root.identity.dev}`, `${root.identity.ino}`, sourceParent.relative, `${sourceParent.identities.at(-1).identity.dev}`, `${sourceParent.identities.at(-1).identity.ino}`, parent.relative, `${parent.identities.at(-1).identity.dev}`, `${parent.identities.at(-1).identity.ino}`, source, destination] : ["write", `${root.identity.dev}`, `${root.identity.ino}`, parent.relative, `${parent.identities.at(-1).identity.dev}`, `${parent.identities.at(-1).identity.ino}`, mode, temporary, destination, `${bytes.byteLength}`, expected ? `${expected.dev}` : "-", expected ? `${expected.ino}` : "-"];
  await new Promise((resolve, reject) => {
    const child = spawn(binary, args, { cwd: root.path, stdio: [bytes ? "pipe" : "ignore", "ignore", "pipe"] }); let stderr = "";
    child.stderr.on("data", (chunk) => { stderr += chunk; }); child.on("error", () => reject(helperError("memory.platform_unsupported"))); child.on("close", (code) => code === 0 ? resolve() : reject(helperError(stderr.trim())));
    if (bytes) child.stdin.end(bytes);
  });
}
async function runPosixMkdir(root, relative) {
  if (!safeRelative(relative)) unsafe();
  const binary = await helperBinary();
  await new Promise((resolve, reject) => {
    const child = spawn(binary, ["mkdir", `${root.identity.dev}`, `${root.identity.ino}`, relative], { cwd: root.path, stdio: ["ignore", "ignore", "pipe"] }); let stderr = "";
    child.stderr.on("data", (chunk) => { stderr += chunk; }); child.on("error", () => reject(helperError("memory.platform_unsupported"))); child.on("close", (code) => code === 0 ? resolve() : reject(helperError(stderr.trim())));
  });
}
function requireCapabilities(adapter) { if (!adapter) return false; if (!adapter.capabilities || !MEMORY_PLATFORM_CAPABILITIES.every((name) => adapter.capabilities[name])) unsupported(); return true; }
export function createMemoryStorePlatformAdapter({ linkFn = link, renameFn = rename, unlinkFn = unlink, syncDirectoryFn = syncDirectory } = {}) {
  return Object.freeze({
    capabilities: Object.freeze({ directoryRelative: false, atomicNoReplace: false, atomicReplace: false }),
    async publishCreate(temporary, destination) { await linkFn(temporary, destination); await unlinkFn(temporary); },
    async publishReplace(temporary, destination) { await renameFn(temporary, destination); },
    async publishMove(source, destination) { await linkFn(source, destination); await unlinkFn(source); },
    syncDirectory: syncDirectoryFn,
  });
}
const defaultPlatformAdapter = undefined;
async function safeReplace(parent, destination, bytes, { beforePublish, expected } = {}) {
  const original = expected?.identity ?? await targetFile(destination); const temporary = path.join(parent.path, `.${path.basename(destination)}.tmp-${randomUUID()}`);
  if (typeof beforePublish === "function") await beforePublish({ destination, temporary });
  await assertIdentities(parent.identities);
  const current = await targetFile(destination);
  if ((original === undefined) !== (current === undefined) || original && !sameFileVersion(original, current)) unsafe();
  if (original && expected?.digest && (await readMemoryLikeFile(parent, destination)).digest !== expected.digest) unsafe();
  await runPosixHelper({ root: parent.root, parent, mode: original ? "replace-existing" : "create", temporary: path.basename(temporary), destination: path.basename(destination), bytes, expected: original });
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
  if (config.scope === "global") { if (!global[platform] || typeof home !== "string" || !path.isAbsolute(home)) unsafe(); let homeRoot; try { homeRoot = await canonicalDirectory(home); } catch (error) { if (!initialize || error?.code !== "ENOENT") throw error; await mkdir(home, { recursive: true, mode: 0o700 }); homeRoot = await canonicalDirectory(home); } if (initialize) await runPosixMkdir(homeRoot, global[platform].join("/")); root = { path: path.join(homeRoot.path, ...global[platform]) }; }
  else { if (initialize) await runPosixMkdir(workspace, ".game-design/memory"); root = { path: path.join(workspace.path, ".game-design", "memory") }; }
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

export async function writeMemoryFileAtomic({ store, relativePath, bytes, policy = "replace", platformAdapter = defaultPlatformAdapter } = {}) {
  if (!Buffer.isBuffer(bytes) || bytes.byteLength > MAX_BYTES) unsafe(); const createOnce = policy === "create-once" || policy?.mode === "create-once"; if (!(policy === "replace" || policy === "create-once" || (policy && typeof policy === "object" && [undefined, "replace", "create-once"].includes(policy.mode)))) unsafe();
  requireCapabilities(platformAdapter);
  const parentPath = relativePath?.split("/").slice(0, -1).join("/"); if (parentPath) await runPosixMkdir({ path: store.root, identity: store.identity }, parentPath);
  const parent = await parentFor(store, relativePath); const original = await targetFile(parent.target); const originalSnapshot = original ? await readMemoryLikeFile(parent, parent.target) : undefined; if (createOnce && original) throw new Error("Memory file already exists.");
  const temporary = path.join(parent.path, `.${path.basename(parent.target)}.tmp-${randomUUID()}`); let handle;
  if (typeof policy?.beforeWrite === "function") await policy.beforeWrite({ temporary });
  if (typeof policy?.beforeRename === "function") await policy.beforeRename({ destination: parent.target, temporary });
  if (typeof policy?.beforePublish === "function") await policy.beforePublish({ destination: parent.target, temporary });
  if (originalSnapshot && (await readMemoryLikeFile(parent, parent.target)).digest !== originalSnapshot.digest) unsafe();
  await runPosixHelper({ root: { path: store.root, identity: store.identity }, parent, mode: original ? "replace-existing" : "create", temporary: path.basename(temporary), destination: path.basename(parent.target), bytes, expected: original });
}

export async function moveMemoryFileAtomic({ store, from, to, policy = {}, platformAdapter = defaultPlatformAdapter } = {}) {
  requireCapabilities(platformAdapter); const source = await parentFor(store, from); const sourceStats = await targetFile(source.target); if (!sourceStats) throw new Error("Memory file does not exist."); const destinationPath = to?.split("/").slice(0, -1).join("/"); if (destinationPath) await runPosixMkdir({ path: store.root, identity: store.identity }, destinationPath); const destination = await parentFor(store, to); if (await targetFile(destination.target)) throw new Error("Memory destination already exists."); if (typeof policy?.beforePublish === "function") await policy.beforePublish({ source: source.target, destination: destination.target });
  await runPosixHelper({ root: { path: store.root, identity: store.identity }, parent: destination, sourceParent: source, source: path.basename(source.target), destination: path.basename(destination.target) });
}

export async function ensureMemoryGitExclusion({ workspaceRoot, gitMode, runGit, beforePublish, beforeSnapshot } = {}) {
  if (gitMode !== "local") return { status: "skipped" }; if (typeof runGit !== "function") return { status: "skipped" };
  let common; let exclude;
  try { common = String(await runGit(["rev-parse", "--git-common-dir"], workspaceRoot)).trim(); exclude = String(await runGit(["rev-parse", "--path-format=absolute", "--git-path", "info/exclude"], workspaceRoot)).trim(); } catch { return { status: "skipped" }; }
  let workspace; let commonRoot;
  try { workspace = await canonicalDirectory(workspaceRoot); const commonPath = path.isAbsolute(common) ? path.resolve(common) : path.resolve(workspace.path, common); commonRoot = await canonicalDirectory(commonPath); } catch { return { status: "skipped" }; }
  const expected = path.resolve(commonRoot.path, "info", "exclude");
  if (!path.isAbsolute(exclude) || path.resolve(exclude) !== expected) return { status: "skipped" };
  let info; try { await runPosixMkdir(commonRoot, "info"); info = await canonicalDirectory(path.join(commonRoot.path, "info")); } catch { return { status: "skipped" }; }
  const parent = { path: info.path, relative: "info", root: commonRoot, identities: [{ path: commonRoot.path, identity: commonRoot.identity }, { path: info.path, identity: info.identity }] };
  const snapshot = await readMemoryLikeFile(parent, exclude).catch((error) => error?.code === "ENOENT" ? { bytes: Buffer.alloc(0), identity: undefined } : Promise.reject(error)); if (typeof beforeSnapshot === "function") await beforeSnapshot({ exclude }); const existing = snapshot.bytes; const text = existing.toString("utf8"); const blocks = [...text.matchAll(/^# game-design-plugin:memory:begin\n\.game-design\/memory\/\n# game-design-plugin:memory:end\n?$/gmu)]; const markerLines = (text.match(/^# game-design-plugin:memory:(?:begin|end)$/gmu) ?? []).length;
  if (blocks.length === 1 && markerLines === 2) return { status: "present" }; if (blocks.length !== 0 || markerLines !== 0) throw new Error("Malformed game-design memory exclusion marker.");
  const separator = existing.byteLength === 0 || text.endsWith("\n") ? "" : "\n"; await safeReplace(parent, exclude, Buffer.concat([existing, Buffer.from(`${separator}${MARKER}`)]), { beforePublish, expected: snapshot }); return { status: "added" };
}

async function readMemoryLikeFile(parent, target) {
  const prior = await targetFile(target); if (!prior) { const missing = new Error("missing"); missing.code = "ENOENT"; throw missing; }
  const handle = await open(target, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try { const opened = await handle.stat(); if (!opened.isFile() || !sameFileVersion(opened, prior) || opened.size > MAX_BYTES) unsafe(); const bytes = await handle.readFile(); const after = await handle.stat(); await assertIdentities(parent.identities); const current = await targetFile(target); if (!sameFileVersion(after, opened) || !current || !sameFileVersion(current, prior) || bytes.byteLength > MAX_BYTES) unsafe(); return { bytes, identity: prior, digest: createHash("sha256").update(bytes).digest("hex") }; } finally { await handle.close(); }
}
