import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { appendFile, link, lstat, mkdir, open, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { parseMemoryEventDocument, validateMemoryTransition } from "../validate-design-memory.mjs";

const MAX_BYTES = 256 * 1024;
const MAX_EVENTS = 10000;
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const EVENT_ID = /^mev1-[a-f0-9]{64}$/u;
const MARKER = "# game-design-plugin:memory:begin\n.game-design/memory/\n# game-design-plugin:memory:end\n";

function fail(message, code = "memory.unsafe_path") { const error = new Error(message); error.code = code; throw error; }
function hash(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
function safeId(value) { return typeof value === "string" && value === value.normalize("NFC") && ID.test(value); }
function safeRelative(value) { return typeof value === "string" && value.length > 0 && value === value.normalize("NFC") && !value.includes("\0") && !value.includes("\\") && !path.posix.isAbsolute(value) && path.posix.normalize(value) === value && !value.startsWith("../") && value !== "." && value !== ".."; }
function same(left, right) { return left.dev === right.dev && left.ino === right.ino; }
async function stat(candidate) { return lstat(candidate).catch((error) => error.code === "ENOENT" ? undefined : Promise.reject(error)); }
async function directory(candidate) { const current = await stat(candidate); if (!current || current.isSymbolicLink() || !current.isDirectory()) fail("Unsafe memory store path."); return current; }
async function canonicalDirectory(candidate) { if (typeof candidate !== "string" || !path.isAbsolute(candidate) || candidate.includes("\0")) fail("Unsafe memory store path."); const initial = await directory(path.resolve(candidate)); const resolved = await realpath(candidate); const final = await directory(resolved); if (!same(initial, final)) fail("Unsafe memory store path."); return { path: resolved, identity: final }; }
async function ensureDirectory(candidate) { await mkdir(candidate, { recursive: true, mode: 0o700 }); return canonicalDirectory(candidate); }
async function ensureNested(root, segments) { let current = root.path; for (const segment of segments) { const next = path.join(current, segment); await mkdir(next, { recursive: false, mode: 0o700 }).catch((error) => error.code === "EEXIST" ? undefined : Promise.reject(error)); const item = await directory(next); if (await realpath(next) !== next) fail("Unsafe memory store path."); current = next; if (!item.isDirectory()) fail("Unsafe memory store path."); } return canonicalDirectory(current); }
async function parentFor(store, relativePath, create = false) {
  if (!store?.root || !safeRelative(relativePath)) fail("Unsafe memory store path.");
  const root = await canonicalDirectory(store.root); if (!same(root.identity, store.identity)) fail("Unsafe memory store path.");
  let current = root.path; const identities = [{ path: current, identity: root.identity }];
  for (const segment of relativePath.split("/").slice(0, -1)) { const next = path.join(current, segment); if (create) await mkdir(next, { recursive: false, mode: 0o700 }).catch((error) => error.code === "EEXIST" ? undefined : Promise.reject(error)); const item = await directory(next); current = next; identities.push({ path: current, identity: item }); }
  for (const item of identities) { const present = await directory(item.path); if (!same(present, item.identity)) fail("Unsafe memory store path."); }
  return { root, path: current, target: path.join(current, path.posix.basename(relativePath)), identities };
}
async function safeFile(candidate) { const item = await stat(candidate); if (item && (item.isSymbolicLink() || !item.isFile())) fail("Unsafe memory store path."); return item; }
async function syncDirectory(candidate) { const handle = await open(candidate, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0)); try { await handle.sync(); } finally { await handle.close(); } }
async function boundedFile(candidate, maxBytes = MAX_BYTES) { const prior = await safeFile(candidate); if (!prior) fail("Memory file does not exist.", "ENOENT"); if (prior.size > maxBytes) fail("Memory file exceeds the bounded read limit."); const handle = await open(candidate, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0)); try { const opened = await handle.stat(); if (!opened.isFile() || !same(opened, prior) || opened.size > maxBytes) fail("Unsafe memory store path."); const bytes = await handle.readFile(); const after = await handle.stat(); const final = await safeFile(candidate); if (!same(opened, after) || !final || !same(final, prior) || bytes.byteLength > maxBytes) fail("Unsafe memory store path."); return bytes; } finally { await handle.close(); } }

export async function resolveMemoryStore({ workspaceRoot, config, platform, home, initialize = false } = {}) {
  if (!config?.enabled || !safeId(config.projectId)) return null;
  const workspace = await canonicalDirectory(workspaceRoot);
  const global = { darwin: ["Library", "Application Support"], linux: [".local", "share"], win32: ["AppData", "Local"] };
  let root;
  if (config.scope === "global") { if (!global[platform] || typeof home !== "string" || !path.isAbsolute(home)) fail("Unsafe memory store path."); if (initialize) await ensureDirectory(home); const homeRoot = await canonicalDirectory(home); root = path.join(homeRoot.path, ...global[platform], "game-design-plugin", "memory"); }
  else root = path.join(workspace.path, ".game-design", "memory");
  const base = config.scope === "global" ? await canonicalDirectory(home) : workspace; const segments = path.relative(base.path, root).split(path.sep).filter(Boolean);
  const canonical = initialize ? await ensureNested(base, segments) : await canonicalDirectory(root);
  return { root: canonical.path, identity: canonical.identity, scope: config.scope, projectId: config.projectId };
}

export async function readMemoryFile({ store, relativePath, maxBytes = MAX_BYTES } = {}) {
  if (!Number.isInteger(maxBytes) || maxBytes < 1 || maxBytes > MAX_BYTES) fail("Invalid bounded read limit.");
  const parent = await parentFor(store, relativePath); const bytes = await boundedFile(parent.target, maxBytes);
  for (const item of parent.identities) if (!same(await directory(item.path), item.identity)) fail("Unsafe memory store path.");
  return bytes;
}

export function memoryEventRelativePath({ memoryId, eventId } = {}) {
  if (!safeId(memoryId) || !EVENT_ID.test(eventId ?? "")) fail("Invalid memory event path.");
  return `v1/events/${hash(memoryId).slice(0, 2)}/${memoryId}/${eventId}`;
}

async function writeSealedFile(store, relativePath, bytes, extension) {
  if (!Buffer.isBuffer(bytes) || bytes.byteLength > MAX_BYTES) fail("Memory bytes are invalid.");
  const parent = await parentFor(store, `${relativePath}/instances/.placeholder`, true);
  const instanceId = randomUUID(); const instancePath = path.join(parent.path, `${instanceId}${extension}`);
  const flags = constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | (constants.O_NOFOLLOW ?? 0);
  const handle = await open(instancePath, flags, 0o600);
  try { let offset = 0; while (offset < bytes.byteLength) offset += (await handle.write(bytes, offset)).bytesWritten; await handle.sync(); } finally { await handle.close(); }
  const readBack = await boundedFile(instancePath); if (!readBack.equals(bytes)) fail("Sealed file read-back failed.");
  return { instanceId, instancePath, fileSha256: hash(bytes), byteLength: bytes.byteLength };
}

export async function stageImmutableMemoryFile({ store, relativePath, bytes } = {}) { return writeSealedFile(store, relativePath, bytes, ".md"); }

function claimBytes({ eventId, instanceId, fileSha256, byteLength }) { return Buffer.from(`${JSON.stringify({ schemaVersion: 1, eventId, instanceId, fileSha256, byteLength })}\n`); }
async function sealEvent(store, relativePath, eventId, eventDocument, kind = "event") {
  const staged = await writeSealedFile(store, relativePath, Buffer.from(eventDocument), ".md");
  const claimPath = path.join(store.root, relativePath, "claims", `${staged.instanceId}.json`); await mkdir(path.dirname(claimPath), { recursive: true, mode: 0o700 });
  const claim = claimBytes({ eventId, ...staged }); const handle = await open(claimPath, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | (constants.O_NOFOLLOW ?? 0), 0o600); try { await handle.writeFile(claim); await handle.sync(); } finally { await handle.close(); }
  const commitPath = path.join(store.root, relativePath, "commit.json");
  try { await link(claimPath, commitPath); await syncDirectory(path.dirname(commitPath)); } catch (error) {
    if (error.code !== "EEXIST") throw error;
    const current = await readCommitted(store, relativePath, eventId, kind).catch(() => undefined);
    if (current?.bytes.equals(Buffer.from(eventDocument))) return { status: "present", eventId, relativePath, fileSha256: staged.fileSha256 };
    fail("A different event already uses this path.", "memory.append_conflict");
  }
  const committed = await readCommitted(store, relativePath, eventId, kind); if (!committed || !committed.bytes.equals(Buffer.from(eventDocument))) fail("Sealed event commit verification failed.");
  return { status: "created", eventId, relativePath, fileSha256: staged.fileSha256 };
}
async function readCommitted(store, relativePath, expectedId, kind = "event") {
  const base = path.join(store.root, relativePath); const commitPath = path.join(base, "commit.json"); const commitStats = await safeFile(commitPath); if (!commitStats) return undefined;
  const claim = JSON.parse((await boundedFile(commitPath)).toString("utf8"));
  if (!claim || claim.schemaVersion !== 1 || claim.eventId !== expectedId || typeof claim.instanceId !== "string" || !/^[a-f0-9]{64}$/u.test(claim.fileSha256) || !Number.isInteger(claim.byteLength)) fail("Invalid sealed commit.", "memory.invalid_commit");
  const claimPath = path.join(base, "claims", `${claim.instanceId}.json`); const claimStats = await safeFile(claimPath); if (!claimStats || !same(commitStats, claimStats) || !(await boundedFile(claimPath)).equals(await boundedFile(commitPath))) fail("Invalid sealed claim.", "memory.invalid_commit");
  const instancePath = path.join(base, "instances", `${claim.instanceId}.md`); const bytes = await boundedFile(instancePath); if (bytes.byteLength !== claim.byteLength || hash(bytes) !== claim.fileSha256) fail("Invalid sealed instance.", "memory.invalid_commit");
  if (kind === "event") parseMemoryEventDocument(bytes.toString("utf8"), { sourceName: relativePath, eventId: expectedId });
  return { claim, bytes };
}

export async function appendMemoryEvent({ store, eventDocument } = {}) {
  const bytes = Buffer.isBuffer(eventDocument) ? eventDocument : Buffer.from(eventDocument ?? ""); if (bytes.byteLength > MAX_BYTES) fail("Memory event exceeds the bounded write limit.");
  const eventId = `mev1-${hash(bytes)}`; const parsed = parseMemoryEventDocument(bytes.toString("utf8"), { sourceName: "event document", eventId }); const relativePath = memoryEventRelativePath({ memoryId: parsed.event.memory_id, eventId });
  const scan = await scanMemoryEvents({ store }); if (!scan.complete) fail("Memory scan is incomplete.", "memory.scan_limit_exceeded");
  const duplicate = scan.events.find((item) => item.event.memory_id === parsed.event.memory_id && item.event.operation_id === parsed.event.operation_id);
  if (duplicate?.bytes.equals(bytes)) return { status: "present", eventId, relativePath, fileSha256: hash(bytes) };
  if (duplicate) fail("duplicate-operation: different event bytes.", "duplicate-operation");
  return sealEvent(store, relativePath, eventId, bytes, "event");
}

async function allEntries(root, relative = "", state) {
  const entries = await readdir(root, { withFileTypes: true }).catch((error) => error.code === "ENOENT" ? [] : Promise.reject(error));
  for (const entry of entries.sort((a, b) => Buffer.compare(Buffer.from(a.name), Buffer.from(b.name)))) { state.count += 1; if (state.count > state.maxEvents) { state.complete = false; state.diagnostics.push({ code: "memory.scan_limit_exceeded" }); return; } const next = path.join(root, entry.name); const pathName = relative ? `${relative}/${entry.name}` : entry.name; const item = await lstat(next); if (item.isDirectory() && !item.isSymbolicLink()) { await allEntries(next, pathName, state); if (!state.complete) return; } else if (item.isFile() && entry.name === "commit.json") state.commits.push(pathName); else if (!item.isFile()) state.diagnostics.push({ code: "memory.unsafe_entry", path: pathName }); }
}
function markerRelativePath({ targetMemoryId, targetEventId, markerId }) { return `v1/controls/quarantine/${hash(targetMemoryId).slice(0, 2)}/${targetEventId}/${markerId}`; }
export async function scanMemoryEvents({ store, maxEventBytes = MAX_BYTES, maxEvents = MAX_EVENTS } = {}) {
  if (!Number.isInteger(maxEventBytes) || maxEventBytes < 1 || maxEventBytes > MAX_BYTES || !Number.isInteger(maxEvents) || maxEvents < 1 || maxEvents > MAX_EVENTS) fail("Invalid scan limits.");
  await canonicalDirectory(store?.root); const state = { maxEvents, count: 0, complete: true, diagnostics: [], commits: [] }; await allEntries(path.join(store.root, "v1", "events"), "events", state); if (state.complete) await allEntries(path.join(store.root, "v1", "controls", "quarantine"), "controls/quarantine", state);
  const events = []; const quarantines = [];
  if (!state.complete) return { complete: false, entriesScanned: state.count, diagnostics: state.diagnostics, events, quarantines };
  for (const relativePath of state.commits.sort()) {
    const base = relativePath.slice(0, -"/commit.json".length); const name = path.posix.basename(base); try {
      const parts = base.split("/");
      if (parts[0] === "events") { const [, shard, memoryId, eventId] = parts; if (parts.length !== 4 || !safeId(memoryId) || shard !== hash(memoryId).slice(0, 2) || eventId !== name || !EVENT_ID.test(name)) throw new Error(); const committed = await readCommitted(store, `v1/${base}`, name); const parsed = parseMemoryEventDocument(committed.bytes.toString("utf8"), { sourceName: base, eventId: name }); if (committed.bytes.byteLength > maxEventBytes || parsed.event.memory_id !== memoryId) throw new Error(); events.push({ eventId: name, relativePath: `v1/${base}`, bytes: committed.bytes, event: parsed.event, record: parsed.record }); }
      else { const [, kind, shard, targetEventId, markerId] = parts; if (parts.length !== 5 || kind !== "quarantine" || !EVENT_ID.test(targetEventId)) throw new Error(); const committed = await readCommitted(store, `v1/${base}`, markerId, "marker"); const marker = JSON.parse(committed.bytes.toString("utf8")); if (!safeId(marker.memory_id) || shard !== hash(marker.memory_id).slice(0, 2) || marker.target_event_id !== targetEventId) throw new Error(); quarantines.push(marker); }
    } catch { state.diagnostics.push({ code: "memory.invalid_seal", path: base }); }
  }
  return { complete: true, entriesScanned: state.count, diagnostics: state.diagnostics, events: events.sort((a, b) => a.eventId.localeCompare(b.eventId)), quarantines };
}

export function foldMemoryEvents(scan, { now = new Date() } = {}) {
  const memories = new Map(); const diagnostics = [...(scan?.diagnostics ?? [])]; if (!scan?.complete) return { complete: false, memories, diagnostics };
  const quarantined = new Set((scan.quarantines ?? []).map((item) => item.memory_id)); const groups = new Map();
  for (const item of scan.events ?? []) (groups.get(item.event.memory_id) ?? groups.set(item.event.memory_id, []).get(item.event.memory_id)).push(item);
  const taint = (memoryId, code) => diagnostics.push({ code, memory_id: memoryId });
  for (const [memoryId, items] of groups) {
    if (quarantined.has(memoryId)) { taint(memoryId, "memory.quarantined"); continue; }
    const byId = new Map(); const children = new Map(); const invalid = new Set(); const operation = new Map();
    for (const item of items) {
      if (byId.has(item.eventId)) invalid.add(item.eventId); else byId.set(item.eventId, item);
      const earlier = operation.get(item.event.operation_id); if (earlier && !earlier.bytes?.equals?.(item.bytes ?? Buffer.alloc(0))) invalid.add(item.eventId), invalid.add(earlier.eventId); else operation.set(item.event.operation_id, item);
    }
    const roots = items.filter((item) => item.event.event_type === "capture"); if (roots.length !== 1) { taint(memoryId, "memory.invalid_root"); continue; }
    for (const item of items) for (const parent of item.event.parent_event_ids ?? []) { if (!byId.has(parent)) invalid.add(item.eventId); else (children.get(parent) ?? children.set(parent, []).get(parent)).push(item.eventId); }
    const stableIdentity = (from, to) => ["memory_id", "kind", "lane", "scope", "project_id", "created_at", "artifact_types", "related_ids", "tags", "sources"].every((key) => JSON.stringify(from[key]) === JSON.stringify(to[key]));
    for (const item of items) {
      const { event } = item;
      if (event.event_type === "capture" && event.parent_event_ids.length !== 0) invalid.add(item.eventId);
      if (event.event_type === "transition") { const parent = byId.get(event.parent_event_ids[0]); if (!parent || event.parent_event_ids.length !== 1 || !stableIdentity(parent.record, item.record) || !validateMemoryTransition({ from: parent.record, to: item.record, approvalBasis: item.record.approval_basis }).ok) invalid.add(item.eventId); }
      if (event.event_type === "resolution") { if (event.parent_event_ids.length < 2 || !event.parent_event_ids.includes(event.chosen_parent_event_id)) invalid.add(item.eventId); const chosen = byId.get(event.chosen_parent_event_id); if (!chosen || !stableIdentity(chosen.record, item.record)) invalid.add(item.eventId); }
      if (item.record.supersedes === memoryId) invalid.add(item.eventId);
    }
    const queue = [...invalid]; while (queue.length) for (const child of children.get(queue.shift()) ?? []) if (!invalid.has(child)) invalid.add(child), queue.push(child);
    if (invalid.size) { taint(memoryId, operation.size < items.length ? "memory.duplicate_operation" : "memory.invalid_event_dag"); continue; }
    const usable = new Set(items.map((item) => item.eventId)); const used = new Set(); for (const item of items) for (const parent of item.event.parent_event_ids) used.add(parent);
    const heads = [...usable].filter((id) => !used.has(id)).map((id) => byId.get(id)).sort((a, b) => a.eventId.localeCompare(b.eventId));
    if (heads.length !== 1) { taint(memoryId, "memory.concurrent_conflict"); continue; }
    memories.set(memoryId, { record: heads[0].record, headEventId: heads[0].eventId, heads: [heads[0].eventId], now: new Date(now).toISOString() });
  }
  for (const marker of scan.quarantines ?? []) if (!safeId(marker.memory_id)) return { complete: false, memories: new Map(), diagnostics: [...diagnostics, { code: "memory.invalid_quarantine" }] };
  return { complete: true, memories, diagnostics };
}

export async function appendQuarantineMarker({ store, targetMemoryId, targetEventId, targetRelativePath, observedSha256, reasonCode, actor, now = new Date() } = {}) {
  if (!safeId(targetMemoryId) || !EVENT_ID.test(targetEventId ?? "") || !safeRelative(targetRelativePath) || !(observedSha256 === null || /^[a-f0-9]{64}$/u.test(observedSha256)) || typeof reasonCode !== "string" || !reasonCode || typeof actor !== "string" || !actor.trim()) fail("Invalid quarantine marker.");
  const marker = { schema_version: 1, memory_id: targetMemoryId, target_event_id: targetEventId, target_relative_path: targetRelativePath, observed_sha256: observedSha256, reason_code: reasonCode, actor, recorded_at: new Date(now).toISOString() }; const bytes = Buffer.from(`${JSON.stringify(marker)}\n`); const markerId = `qmv1-${hash(bytes)}`; return sealEvent(store, markerRelativePath({ targetMemoryId, targetEventId, markerId }), markerId, bytes, "marker");
}

export async function ensureMemoryGitExclusion({ workspaceRoot, gitMode, runGit } = {}) {
  if (gitMode !== "local" || typeof runGit !== "function") return { status: "skipped" }; let common; let exclude;
  try { common = String(await runGit(["rev-parse", "--git-common-dir"], workspaceRoot)).trim(); exclude = String(await runGit(["rev-parse", "--path-format=absolute", "--git-path", "info/exclude"], workspaceRoot)).trim(); } catch { return { status: "skipped" }; }
  try { const root = await canonicalDirectory(workspaceRoot); const commonPath = path.isAbsolute(common) ? common : path.join(root.path, common); const expected = path.join(await realpath(commonPath), "info", "exclude"); if (path.resolve(exclude) !== path.resolve(expected)) return { status: "warning", code: "memory.git_exclude_path" }; await mkdir(path.dirname(expected), { recursive: true, mode: 0o700 }); const lock = `${expected}.game-design-memory-exclude.lock`; let lockHandle; try { lockHandle = await open(lock, "wx", 0o600); } catch { return { status: "warning", code: "memory.git_exclude_lock" }; } try { const existing = await readFile(expected).catch((error) => error.code === "ENOENT" ? Buffer.alloc(0) : Promise.reject(error)); const text = existing.toString("utf8"); const begin = (text.match(/# game-design-plugin:memory:begin/gu) ?? []).length; const end = (text.match(/# game-design-plugin:memory:end/gu) ?? []).length; if (begin !== end || begin > 1) return { status: "warning", code: "memory.git_exclude_marker" }; if (begin === 0) { await appendFile(expected, `${text && !text.endsWith("\n") ? "\n" : ""}${MARKER}`, { mode: 0o600 }); const file = await open(expected, constants.O_RDONLY); try { await file.sync(); } finally { await file.close(); } } return { status: "ready" }; } finally { await lockHandle.close(); await rm(lock, { force: true }); } } catch { return { status: "warning", code: "memory.git_exclude" }; }
}
