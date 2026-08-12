import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { link, lstat, mkdir, open, opendir, realpath, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { canonicalQuarantineMarkerDocument, parseMemoryEventDocument, parseQuarantineMarkerDocument, validateMemoryTransition } from "../validate-design-memory.mjs";

const MAX_BYTES = 256 * 1024;
const MAX_EVENTS = 10000;
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const EVENT_ID = /^mev1-[a-f0-9]{64}$/u;
const MARKER = "# game-design-plugin:memory:begin\n.game-design/memory/\n# game-design-plugin:memory:end\n";
const CLAIM_KEYS = Object.freeze(["schemaVersion", "eventId", "instanceId", "fileSha256", "byteLength"]);
const UTF8 = new TextDecoder("utf-8", { fatal: true });

function fail(message, code = "memory.unsafe_path") { const error = new Error(message); error.code = code; throw error; }
function hash(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
function safeId(value) { return typeof value === "string" && value === value.normalize("NFC") && ID.test(value); }
function safeRelative(value) { return typeof value === "string" && value.length > 0 && value === value.normalize("NFC") && !value.includes("\0") && !value.includes("\\") && !path.posix.isAbsolute(value) && path.posix.normalize(value) === value && !value.startsWith("../") && value !== "." && value !== ".."; }
function plainObject(value) { return value !== null && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype; }
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
  const global = { darwin: ["Library", "Application Support"], linux: [".local", "share"], win32: ["AppData", "Local"] };
  let root; let base;
  if (config.scope === "global") { if (!global[platform] || typeof home !== "string" || !path.isAbsolute(home)) fail("Unsafe memory store path."); if (initialize) await ensureDirectory(home); const homeRoot = await canonicalDirectory(home); root = path.join(homeRoot.path, ...global[platform], "game-design-plugin", "memory"); }
  else { const workspace = await canonicalDirectory(workspaceRoot); root = path.join(workspace.path, ".game-design", "memory"); base = workspace; }
  base ??= await canonicalDirectory(home); const segments = path.relative(base.path, root).split(path.sep).filter(Boolean);
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
  const existing = await readCommitted(store, relativePath, eventId, kind).catch(() => undefined);
  if (existing?.bytes.equals(Buffer.from(eventDocument))) return { status: "present", eventId, relativePath, fileSha256: hash(eventDocument) };
  const staged = await writeSealedFile(store, relativePath, Buffer.from(eventDocument), ".md");
  const claimParent = await parentFor(store, `${relativePath}/claims/.placeholder`, true); const claimPath = path.join(claimParent.path, `${staged.instanceId}.json`);
  const claim = claimBytes({ eventId, ...staged }); const handle = await open(claimPath, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | (constants.O_NOFOLLOW ?? 0), 0o600); try { await handle.writeFile(claim); await handle.sync(); } finally { await handle.close(); }
  const commitParent = await parentFor(store, `${relativePath}/commit.json`, false); const commitPath = commitParent.target;
  try { await link(claimPath, commitPath); await syncDirectory(path.dirname(commitPath)); } catch (error) {
    if (error.code !== "EEXIST") throw error;
    const current = await readCommitted(store, relativePath, eventId, kind).catch(() => undefined);
    if (current?.bytes.equals(Buffer.from(eventDocument))) return { status: "present", eventId, relativePath, fileSha256: staged.fileSha256 };
    fail("A different event already uses this path.", "memory.append_conflict");
  }
  const committed = await readCommitted(store, relativePath, eventId, kind); if (!committed || !committed.bytes.equals(Buffer.from(eventDocument))) fail("Sealed event commit verification failed.");
  return { status: "created", eventId, relativePath, fileSha256: staged.fileSha256 };
}
async function readSealedCommit(store, relativePath, kind = "event") {
  const base = path.join(store.root, relativePath); const commitPath = path.join(base, "commit.json"); const commitStats = await safeFile(commitPath); if (!commitStats) return undefined;
  const commitBytes = await boundedFile(commitPath); const claim = JSON.parse(UTF8.decode(commitBytes));
  const validId = kind === "event" ? EVENT_ID.test(claim?.eventId ?? "") : /^qmv1-[a-f0-9]{64}$/u.test(claim?.eventId ?? "");
  if (!plainObject(claim) || Object.keys(claim).length !== CLAIM_KEYS.length || !CLAIM_KEYS.every((key) => Object.hasOwn(claim, key)) || !claimBytes(claim).equals(commitBytes) || claim.schemaVersion !== 1 || !validId || typeof claim.instanceId !== "string" || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u.test(claim.instanceId) || !/^[a-f0-9]{64}$/u.test(claim.fileSha256) || !Number.isInteger(claim.byteLength)) fail("Invalid sealed commit.", "memory.unbound_seal");
  const claimPath = path.join(base, "claims", `${claim.instanceId}.json`); const claimStats = await safeFile(claimPath); if (!claimStats || !same(commitStats, claimStats) || !(await boundedFile(claimPath)).equals(commitBytes)) fail("Invalid sealed claim.", "memory.unbound_seal");
  const instancePath = path.join(base, "instances", `${claim.instanceId}.md`); const bytes = await boundedFile(instancePath); if (bytes.byteLength !== claim.byteLength || hash(bytes) !== claim.fileSha256) fail("Invalid sealed instance.", "memory.unbound_seal");
  const expectedId = `${kind === "event" ? "mev1" : "qmv1"}-${hash(bytes)}`; if (claim.eventId !== expectedId) fail("Invalid sealed content identifier.", "memory.unbound_seal");
  const source = UTF8.decode(bytes); const parsed = kind === "event" ? parseMemoryEventDocument(source, { sourceName: "sealed event", eventId: claim.eventId }) : parseQuarantineMarkerDocument(source, { markerId: claim.eventId });
  return { claim, bytes, parsed };
}
async function readCommitted(store, relativePath, expectedId, kind = "event") {
  const committed = await readSealedCommit(store, relativePath, kind);
  if (committed && committed.claim.eventId !== expectedId) fail("Invalid sealed commit.", "memory.unbound_seal");
  return committed;
}

export async function appendMemoryEvent({ store, eventDocument } = {}) {
  const bytes = Buffer.isBuffer(eventDocument) ? eventDocument : Buffer.from(eventDocument ?? ""); if (bytes.byteLength > MAX_BYTES) fail("Memory event exceeds the bounded write limit.");
  const eventId = `mev1-${hash(bytes)}`; const parsed = parseMemoryEventDocument(bytes.toString("utf8"), { sourceName: "event document", eventId }); const relativePath = memoryEventRelativePath({ memoryId: parsed.event.memory_id, eventId });
  const scan = await scanMemoryEvents({ store }); if (!scan.complete) fail("Memory scan is incomplete.", "memory.scan_incomplete");
  const duplicate = scan.events.find((item) => item.event.memory_id === parsed.event.memory_id && item.event.operation_id === parsed.event.operation_id);
  if (duplicate?.bytes.equals(bytes)) return { status: "present", eventId, relativePath, fileSha256: hash(bytes) };
  const authorization = authorizeMemoryAppend({ scan, parsed });
  if (duplicate) fail("duplicate-operation: different event bytes.", "duplicate-operation");
  if (parsed.event.event_type === "resolution") {
    const chosen = authorization.byId.get(parsed.event.chosen_parent_event_id); if (!chosen || !resolutionSnapshotAllowed(chosen, { record: parsed.record, sections: parsed.sections })) fail("Resolution snapshot is not authorized.", "memory.resolution_snapshot");
  }
  return sealEvent(store, relativePath, eventId, bytes, "event");
}

function stableSnapshot(from, to) { return ["schema_version", "memory_id", "kind", "lane", "scope", "project_id", "created_at", "artifact_types", "related_ids", "tags", "sources", "instruction_sha256"].every((key) => JSON.stringify(from.record[key]) === JSON.stringify(to.record[key])) && JSON.stringify(from.sections) === JSON.stringify(to.sections); }
function resolutionSnapshotAllowed(chosen, candidate) { return JSON.stringify(chosen.record) === JSON.stringify(candidate.record) && JSON.stringify(chosen.sections) === JSON.stringify(candidate.sections) || stableSnapshot(chosen, candidate) && validateMemoryTransition({ from: chosen.record, to: candidate.record, approvalBasis: candidate.record.approval_basis }).ok; }
function sameEventIds(left, right) { return left.length === right.length && left.every((eventId, index) => eventId === right[index]); }
function authorizeMemoryAppend({ scan, parsed } = {}) {
  if (!scan?.complete) fail("Memory scan is incomplete.", "memory.scan_incomplete");
  const memoryId = parsed?.event?.memory_id;
  if ((scan.quarantines ?? []).some((marker) => marker.memory_id === memoryId) || (scan.taintedMemoryIds ?? []).includes?.(memoryId)) fail("Memory is quarantined.", "memory.quarantined");
  const prior = (scan.events ?? []).filter((item) => item.event.memory_id === memoryId);
  const folded = foldMemoryEvents(scan); const diagnostics = folded.diagnostics.filter((item) => item.memory_id === memoryId);
  if (diagnostics.some((item) => item.code !== "memory.concurrent_conflict")) fail("Memory history is not authorized.", "memory.invalid_event_dag");
  const byId = new Map(prior.map((item) => [item.eventId, item])); const used = new Set(prior.flatMap((item) => item.event.parent_event_ids)); const heads = [...byId.keys()].filter((eventId) => !used.has(eventId)).sort();
  const foldedMemory = folded.memories.get(memoryId);
  if (heads.length === 1 && foldedMemory?.headEventId !== heads[0]) fail("Memory history is not authorized.", "memory.invalid_event_dag");
  if (parsed.event.event_type === "capture") { if (prior.length) fail("Memory already has a capture event.", "memory.capture_exists"); return { prior, heads, byId }; }
  if (parsed.event.event_type === "transition" && (heads.length !== 1 || parsed.event.parent_event_ids[0] !== heads[0])) fail("Transition parent is not the current head.", "memory.transition_heads");
  if (parsed.event.event_type === "resolution" && (!sameEventIds(parsed.event.parent_event_ids, heads) || !heads.includes(parsed.event.chosen_parent_event_id))) fail("Resolution parents are not the current heads.", "memory.resolution_heads");
  return { prior, heads, byId };
}

async function allEntries(root, relative = "", state, traversal, sourceRoot = false) {
  let directoryHandle; try { directoryHandle = await traversal.opendir(root); } catch (error) { if (sourceRoot && error?.code === "ENOENT") return; throw error; }
  const entries = []; try { for await (const entry of directoryHandle) { entries.push(entry); if (entries.length > state.maxEvents - state.count) { state.complete = false; state.diagnostics.push({ code: "memory.scan_limit_exceeded" }); return; } } } finally { await traversal.close(directoryHandle); }
  for (const entry of entries.sort((a, b) => Buffer.compare(Buffer.from(a.name), Buffer.from(b.name)))) { if (state.count === state.maxEvents) { state.complete = false; state.diagnostics.push({ code: "memory.scan_limit_exceeded" }); return; } state.count += 1; const next = path.join(root, entry.name); const pathName = relative ? `${relative}/${entry.name}` : entry.name; const item = await traversal.lstat(next); if (item.isDirectory() && !item.isSymbolicLink()) { await allEntries(next, pathName, state, traversal); if (!state.complete) return; } else if (item.isFile() && entry.name === "commit.json") state.commits.push(pathName); else if (item.isSymbolicLink() || !item.isFile()) { state.complete = false; state.diagnostics.push({ code: "memory.unbound_seal" }); return; } }
}
async function closeTraversalDirectory(handle) { try { await handle.close(); } catch (error) { if (error?.code !== "ERR_DIR_CLOSED") throw error; } }
function markerRelativePath({ targetMemoryId, targetEventId, markerId }) { return `v1/controls/quarantine/${hash(targetMemoryId).slice(0, 2)}/${targetEventId}/${markerId}`; }
export async function scanMemoryEvents({ store, maxEventBytes = MAX_BYTES, maxEvents = MAX_EVENTS, traversal: injectedTraversal } = {}) {
  if (!Number.isInteger(maxEventBytes) || maxEventBytes < 1 || maxEventBytes > MAX_BYTES || !Number.isInteger(maxEvents) || maxEvents < 1 || maxEvents > MAX_EVENTS) fail("Invalid scan limits.");
  await canonicalDirectory(store?.root); const state = { maxEvents, count: 0, complete: true, diagnostics: [], commits: [], taintedMemoryIds: new Set() }; const traversal = { opendir: injectedTraversal?.opendir ?? opendir, lstat: injectedTraversal?.lstat ?? lstat, close: injectedTraversal?.close ?? closeTraversalDirectory };
  const events = []; const quarantines = [];
  const closed = () => ({ complete: false, entriesScanned: state.count, diagnostics: state.diagnostics, taintedMemoryIds: [], events: [], quarantines: [] });
  try { await allEntries(path.join(store.root, "v1", "events"), "events", state, traversal, true); if (state.complete) await allEntries(path.join(store.root, "v1", "controls", "quarantine"), "controls/quarantine", state, traversal, true); } catch { state.complete = false; state.diagnostics.push({ code: "memory.unbound_seal" }); }
  if (!state.complete) return closed();
  const eventCommits = state.commits.filter((item) => item.startsWith("events/")).sort(); const markerCommits = state.commits.filter((item) => item.startsWith("controls/quarantine/")).sort();
  if (eventCommits.length + markerCommits.length !== state.commits.length) { state.diagnostics.push({ code: "memory.unbound_seal" }); return closed(); }
  for (const relativePath of eventCommits) {
    const base = relativePath.slice(0, -"/commit.json".length); try {
      const committed = await readSealedCommit(store, `v1/${base}`); const canonicalPath = memoryEventRelativePath({ memoryId: committed.parsed.event.memory_id, eventId: committed.claim.eventId });
      if (committed.bytes.byteLength > maxEventBytes || `v1/${base}` !== canonicalPath) fail("Memory event path binding failed.", "memory.path_binding");
      events.push({ eventId: committed.claim.eventId, memoryId: committed.parsed.event.memory_id, relativePath: canonicalPath, bytes: committed.bytes, event: committed.parsed.event, record: committed.parsed.record, sections: committed.parsed.sections });
    } catch (error) { state.diagnostics.push({ code: error?.code === "memory.path_binding" ? "memory.path_binding" : "memory.unbound_seal" }); return closed(); }
  }
  const eventById = new Map(); for (const event of events) { if (eventById.has(event.eventId)) { state.diagnostics.push({ code: "memory.unbound_seal" }); return closed(); } eventById.set(event.eventId, event); }
  for (const relativePath of markerCommits) {
    const base = relativePath.slice(0, -"/commit.json".length); try {
      const committed = await readSealedCommit(store, `v1/${base}`, "marker"); const marker = committed.parsed; const canonicalPath = markerRelativePath({ targetMemoryId: marker.memory_id, targetEventId: marker.target_event_id, markerId: committed.claim.eventId });
      if (`v1/${base}` !== canonicalPath) fail("Quarantine marker path binding failed.", "memory.quarantine_binding");
      const target = eventById.get(marker.target_event_id); if (!target) fail("Quarantine marker target is unbound.", "memory.unbound_seal");
      if (target.memoryId !== marker.memory_id || target.relativePath !== marker.target_relative_path || marker.observed_sha256 !== null && marker.observed_sha256 !== hash(target.bytes)) fail("Quarantine marker binding failed.", "memory.quarantine_binding");
      quarantines.push(marker);
    } catch (error) { state.diagnostics.push({ code: error?.code === "memory.quarantine_binding" ? "memory.quarantine_binding" : "memory.unbound_seal" }); return closed(); }
  }
  return { complete: true, entriesScanned: state.count, diagnostics: state.diagnostics, taintedMemoryIds: [], events: events.sort((a, b) => a.eventId.localeCompare(b.eventId)), quarantines };
}

export function foldMemoryEvents(scan, { now = new Date() } = {}) {
  const memories = new Map(); const diagnostics = [...(scan?.diagnostics ?? [])]; if (!scan?.complete) return { complete: false, memories, diagnostics };
  const quarantined = new Set([...(scan.quarantines ?? []).map((item) => item.memory_id), ...(scan.taintedMemoryIds ?? [])]); const groups = new Map();
  for (const item of scan.events ?? []) (groups.get(item.event.memory_id) ?? groups.set(item.event.memory_id, []).get(item.event.memory_id)).push(item);
  const taint = (memoryId, code) => diagnostics.push({ code, memory_id: memoryId });
  for (const [memoryId, items] of groups) {
    if (quarantined.has(memoryId)) { taint(memoryId, scan.taintedMemoryIds?.includes(memoryId) ? "memory.corrupt_seal" : "memory.quarantined"); continue; }
    const byId = new Map(); const children = new Map(); const invalid = new Set(); const operation = new Map();
    for (const item of items) {
      if (byId.has(item.eventId)) invalid.add(item.eventId); else byId.set(item.eventId, item);
      const earlier = operation.get(item.event.operation_id); if (earlier && !earlier.bytes?.equals?.(item.bytes ?? Buffer.alloc(0))) invalid.add(item.eventId), invalid.add(earlier.eventId); else operation.set(item.event.operation_id, item);
    }
    const roots = items.filter((item) => item.event.event_type === "capture"); if (roots.length !== 1) { taint(memoryId, "memory.invalid_root"); continue; }
    for (const item of items) for (const parent of item.event.parent_event_ids ?? []) { if (!byId.has(parent)) invalid.add(item.eventId); else (children.get(parent) ?? children.set(parent, []).get(parent)).push(item.eventId); }
    const ancestorMemo = new Map(); const ancestors = (eventId, stack = new Set()) => { if (ancestorMemo.has(eventId)) return ancestorMemo.get(eventId); if (stack.has(eventId)) return new Set([eventId]); const item = byId.get(eventId); const values = new Set(); for (const parent of item?.event.parent_event_ids ?? []) { values.add(parent); for (const ancestor of ancestors(parent, new Set([...stack, eventId]))) values.add(ancestor); } ancestorMemo.set(eventId, values); return values; };
    const stableIdentity = (from, to, fromSections, toSections) => stableSnapshot({ record: from, sections: fromSections }, { record: to, sections: toSections });
    for (const item of items) {
      const { event } = item;
      if (event.event_type === "capture" && event.parent_event_ids.length !== 0) invalid.add(item.eventId);
      if (event.event_type === "transition") { const parent = byId.get(event.parent_event_ids[0]); if (!parent || event.action !== item.record.status || event.parent_event_ids.length !== 1 || !stableIdentity(parent.record, item.record, parent.sections, item.sections) || !validateMemoryTransition({ from: parent.record, to: item.record, approvalBasis: item.record.approval_basis }).ok) invalid.add(item.eventId); }
      if (event.event_type === "resolution") { if (event.parent_event_ids.length < 2 || !event.parent_event_ids.includes(event.chosen_parent_event_id) || event.parent_event_ids.some((left, index) => event.parent_event_ids.slice(index + 1).some((right) => ancestors(left).has(right) || ancestors(right).has(left)))) invalid.add(item.eventId); const chosen = byId.get(event.chosen_parent_event_id); if (!chosen || !resolutionSnapshotAllowed(chosen, item)) invalid.add(item.eventId); }
      if (item.record.supersedes === memoryId) invalid.add(item.eventId);
    }
    const queue = [...invalid]; while (queue.length) for (const child of children.get(queue.shift()) ?? []) if (!invalid.has(child)) invalid.add(child), queue.push(child);
    if (invalid.size) { taint(memoryId, operation.size < items.length ? "memory.duplicate_operation" : "memory.invalid_event_dag"); continue; }
    const usable = new Set(items.map((item) => item.eventId)); const used = new Set(); for (const item of items) for (const parent of item.event.parent_event_ids) used.add(parent);
    const heads = [...usable].filter((id) => !used.has(id)).map((id) => byId.get(id)).sort((a, b) => a.eventId.localeCompare(b.eventId));
    if (heads.length !== 1) { taint(memoryId, "memory.concurrent_conflict"); continue; }
    memories.set(memoryId, { record: heads[0].record, headEventId: heads[0].eventId, heads: [heads[0].eventId], now: new Date(now).toISOString() });
  }
  for (const memoryId of scan.taintedMemoryIds ?? []) if (!groups.has(memoryId)) taint(memoryId, "memory.corrupt_seal");
  for (const marker of scan.quarantines ?? []) if (!safeId(marker.memory_id)) return { complete: false, memories: new Map(), diagnostics: [...diagnostics, { code: "memory.invalid_quarantine" }] };
  const supersedes = new Map(); for (const [memoryId, value] of memories) if (value.record.supersedes !== null) supersedes.set(memoryId, value.record.supersedes);
  const bad = new Set(); for (const [memoryId, target] of supersedes) { if (!memories.has(target) || target === memoryId) { bad.add(memoryId); if (memories.has(target)) bad.add(target); continue; } const seen = new Set([memoryId]); let cursor = target; while (supersedes.has(cursor)) { if (seen.has(cursor)) { for (const id of seen) bad.add(id); break; } seen.add(cursor); cursor = supersedes.get(cursor); } }
  for (const memoryId of bad) { memories.delete(memoryId); taint(memoryId, "memory.supersedes_graph"); }
  return { complete: true, memories, diagnostics };
}

export async function appendQuarantineMarker({ store, targetMemoryId, targetEventId, targetRelativePath, observedSha256, reasonCode, actor, now = new Date() } = {}) {
  if (!safeId(targetMemoryId) || !EVENT_ID.test(targetEventId ?? "") || targetRelativePath !== memoryEventRelativePath({ memoryId: targetMemoryId, eventId: targetEventId }) || !(observedSha256 === null || /^[a-f0-9]{64}$/u.test(observedSha256)) || typeof reasonCode !== "string" || !reasonCode || typeof actor !== "string" || !actor.trim()) fail("Invalid quarantine marker.");
  const target = await readCommitted(store, targetRelativePath, targetEventId).catch(() => undefined); if (!target) fail("Quarantine target is not a committed event.", "memory.quarantine_target"); const parsed = parseMemoryEventDocument(target.bytes.toString("utf8"), { eventId: targetEventId }); if (parsed.event.memory_id !== targetMemoryId) fail("Quarantine target identity mismatch.", "memory.quarantine_target");
  const marker = { schema_version: 1, memory_id: targetMemoryId, target_event_id: targetEventId, target_relative_path: targetRelativePath, observed_sha256: observedSha256, reason_code: reasonCode, actor, recorded_at: new Date(now).toISOString() }; const bytes = Buffer.from(canonicalQuarantineMarkerDocument(marker)); const markerId = `qmv1-${hash(bytes)}`; return sealEvent(store, markerRelativePath({ targetMemoryId, targetEventId, markerId }), markerId, bytes, "marker");
}

export async function ensureMemoryGitExclusion({ workspaceRoot, gitMode, runGit } = {}) {
  if (gitMode !== "local" || typeof runGit !== "function") return { status: "skipped" }; let common; let exclude;
  try { common = String(await runGit(["rev-parse", "--git-common-dir"], workspaceRoot)).trim(); exclude = String(await runGit(["rev-parse", "--path-format=absolute", "--git-path", "info/exclude"], workspaceRoot)).trim(); } catch { return { status: "skipped" }; }
  try { const root = await canonicalDirectory(workspaceRoot); const commonPath = path.isAbsolute(common) ? common : path.join(root.path, common); const commonRoot = await canonicalDirectory(commonPath); const infoPath = path.join(commonRoot.path, "info"); await mkdir(infoPath, { recursive: false, mode: 0o700 }).catch((error) => error.code === "EEXIST" ? undefined : Promise.reject(error)); await canonicalDirectory(infoPath); const expected = path.join(infoPath, "exclude"); if (path.resolve(exclude) !== path.resolve(expected)) return { status: "warning", code: "memory.git_exclude_path" }; const lock = `${expected}.game-design-memory-exclude.lock`; let lockHandle; try { lockHandle = await open(lock, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | (constants.O_NOFOLLOW ?? 0), 0o600); } catch { return { status: "warning", code: "memory.git_exclude_lock" }; } try { const existingStat = await safeFile(expected); let handle; let existing = Buffer.alloc(0); if (existingStat) { handle = await open(expected, constants.O_RDWR | (constants.O_NOFOLLOW ?? 0)); const opened = await handle.stat(); if (!opened.isFile() || !same(opened, existingStat) || opened.size > MAX_BYTES) fail("Unsafe git exclude."); existing = await handle.readFile(); const afterRead = await handle.stat(); if (!same(opened, afterRead) || afterRead.size !== opened.size) fail("Unsafe git exclude."); } else handle = await open(expected, constants.O_RDWR | constants.O_CREAT | constants.O_EXCL | (constants.O_NOFOLLOW ?? 0), 0o600); try { const text = existing.toString("utf8"); const begin = (text.match(/# game-design-plugin:memory:begin/gu) ?? []).length; const end = (text.match(/# game-design-plugin:memory:end/gu) ?? []).length; if (begin !== end || begin > 1) return { status: "warning", code: "memory.git_exclude_marker" }; if (begin === 0) { const before = await handle.stat(); await handle.write(`${text && !text.endsWith("\n") ? "\n" : ""}${MARKER}`, existing.byteLength); await handle.sync(); const after = await handle.stat(); if (!same(before, after)) fail("Unsafe git exclude."); } return { status: "ready" }; } finally { await handle.close(); } } finally { await lockHandle.close(); await rm(lock, { force: true }); } } catch { return { status: "warning", code: "memory.git_exclude" }; }
}
