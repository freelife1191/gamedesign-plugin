import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { link, lstat, mkdir, open, opendir, realpath, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { canonicalQuarantineMarkerDocument, parseMemoryEventDocument, parseQuarantineMarkerDocument, validateMemoryTransition } from "../validate-design-memory.mjs";
import { noFollowOpenFlag, syncDirectory } from "./platform-file-hardening.mjs";

const MAX_BYTES = 256 * 1024;
const MAX_GIT_METADATA_BYTES = 8 * 1024;
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
function sameFileState(left, right) { return same(left, right) && left.size === right.size && left.mtimeMs === right.mtimeMs && left.ctimeMs === right.ctimeMs && left.nlink === right.nlink; }
function isInside(root, candidate) { const relative = path.relative(root, candidate); return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative)); }
async function stat(candidate) { return lstat(candidate).catch((error) => error.code === "ENOENT" ? undefined : Promise.reject(error)); }
async function directory(candidate) { const current = await stat(candidate); if (!current || current.isSymbolicLink() || !current.isDirectory()) fail("Unsafe memory store path."); return current; }
async function inspectExistingPathChain(candidate) {
  if (typeof candidate !== "string" || !path.isAbsolute(candidate) || candidate.includes("\0")) fail("Unsafe memory store path.");
  const absolutePath = path.resolve(candidate); const parsed = path.parse(absolutePath); const identities = []; let current = parsed.root;
  const root = await directory(current); identities.push({ path: current, identity: root });
  for (const segment of path.relative(parsed.root, absolutePath).split(path.sep).filter(Boolean)) {
    current = path.join(current, segment); const item = await stat(current); if (!item) break;
    if (item.isSymbolicLink() || !item.isDirectory() || await realpath(current) !== current) fail("Unsafe memory store path.");
    identities.push({ path: current, identity: item });
  }
  return identities;
}
async function canonicalDirectory(candidate) { await inspectExistingPathChain(candidate); const initial = await directory(path.resolve(candidate)); const resolved = await realpath(candidate); const final = await directory(resolved); if (!same(initial, final)) fail("Unsafe memory store path."); return { path: resolved, identity: final }; }
async function ensureDirectory(candidate) { await inspectExistingPathChain(candidate); await mkdir(candidate, { recursive: true, mode: 0o700 }); return canonicalDirectory(candidate); }
async function ensureNested(root, segments) { let current = root.path; for (const segment of segments) { const next = path.join(current, segment); await inspectExistingPathChain(next); await mkdir(next, { recursive: false, mode: 0o700 }).catch((error) => error.code === "EEXIST" ? undefined : Promise.reject(error)); const item = await directory(next); if (await realpath(next) !== next) fail("Unsafe memory store path."); current = next; if (!item.isDirectory()) fail("Unsafe memory store path."); } return canonicalDirectory(current); }
async function parentFor(store, relativePath, create = false) {
  if (!store?.root || !safeRelative(relativePath)) fail("Unsafe memory store path.");
  const root = await canonicalDirectory(store.root); if (!same(root.identity, store.identity)) fail("Unsafe memory store path.");
  let current = root.path; const identities = [{ path: current, identity: root.identity }];
  for (const segment of relativePath.split("/").slice(0, -1)) { const next = path.join(current, segment); if (create) { await inspectExistingPathChain(next); await mkdir(next, { recursive: false, mode: 0o700 }).catch((error) => error.code === "EEXIST" ? undefined : Promise.reject(error)); } const item = await directory(next); current = next; identities.push({ path: current, identity: item }); }
  for (const item of identities) { const present = await directory(item.path); if (!same(present, item.identity)) fail("Unsafe memory store path."); }
  return { root, path: current, target: path.join(current, path.posix.basename(relativePath)), identities };
}
async function safeFile(candidate) { const item = await stat(candidate); if (item && (item.isSymbolicLink() || !item.isFile())) fail("Unsafe memory store path."); return item; }
async function boundedFile(candidate, maxBytes = MAX_BYTES) { const prior = await safeFile(candidate); if (!prior) fail("Memory file does not exist.", "ENOENT"); if (prior.size > maxBytes) fail("Memory file exceeds the bounded read limit."); const handle = await open(candidate, constants.O_RDONLY | noFollowOpenFlag()); try { const opened = await handle.stat(); if (!opened.isFile() || !same(opened, prior) || opened.size > maxBytes) fail("Unsafe memory store path."); const bytes = await handle.readFile(); const after = await handle.stat(); const final = await safeFile(candidate); if (!same(opened, after) || !final || !same(final, prior) || bytes.byteLength > maxBytes) fail("Unsafe memory store path."); return bytes; } finally { await handle.close(); } }

export async function resolveMemoryStore({ workspaceRoot, config, platform, home, initialize = false } = {}) {
  if (!config?.enabled || !safeId(config.projectId)) return null;
  const global = { darwin: ["Library", "Application Support"], linux: [".local", "share"], win32: ["AppData", "Local"] };
  let root; let base;
  if (config.scope === "global") { if (!global[platform] || typeof home !== "string" || !path.isAbsolute(home)) fail("Unsafe memory store path."); if (initialize) await ensureDirectory(home); const homeRoot = await canonicalDirectory(home); root = path.join(homeRoot.path, ...global[platform], "game-design-plugin", "memory"); }
  else { const workspace = await canonicalDirectory(workspaceRoot); root = path.join(workspace.path, ".game-design", "memory"); base = workspace; }
  base ??= await canonicalDirectory(home); const segments = path.relative(base.path, root).split(path.sep).filter(Boolean);
  let canonical;
  if (initialize) canonical = await ensureNested(base, segments);
  else {
    await inspectExistingPathChain(root);
    if (!await stat(root)) return null;
    canonical = await canonicalDirectory(root);
  }
  return { root: canonical.path, identity: canonical.identity, scope: config.scope, projectId: config.projectId };
}

export async function readMemoryFile({ store, relativePath, maxBytes = MAX_BYTES } = {}) {
  if (!Number.isInteger(maxBytes) || maxBytes < 1 || maxBytes > MAX_BYTES) fail("Invalid bounded read limit.");
  const parent = await parentFor(store, relativePath); const bytes = await boundedFile(parent.target, maxBytes);
  for (const item of parent.identities) if (!same(await directory(item.path), item.identity)) fail("Unsafe memory store path.");
  return bytes;
}

export async function readCommittedMemoryEvent({ store, relativePath, eventId } = {}) {
  if (!safeRelative(relativePath) || !EVENT_ID.test(eventId ?? "") || !await matchesStoreIdentity(store)) fail("Unsafe memory store path.");
  const committed = await readSealedCommit(store, relativePath);
  if (!committed || committed.claim.eventId !== eventId || memoryEventRelativePath({ memoryId: committed.parsed.event.memory_id, eventId }) !== relativePath) fail("Invalid sealed event.", "memory.unbound_seal");
  return { eventId, relativePath, bytes: committed.bytes, fileSha256: committed.claim.fileSha256, event: committed.parsed.event, record: committed.parsed.record, sections: committed.parsed.sections };
}

export function memoryEventRelativePath({ memoryId, eventId } = {}) {
  if (!safeId(memoryId) || !EVENT_ID.test(eventId ?? "")) fail("Invalid memory event path.");
  return `v1/events/${hash(memoryId).slice(0, 2)}/${memoryId}/${eventId}`;
}

async function writeSealedFile(store, relativePath, bytes, extension) {
  if (!Buffer.isBuffer(bytes) || bytes.byteLength > MAX_BYTES) fail("Memory bytes are invalid.");
  const parent = await parentFor(store, `${relativePath}/instances/.placeholder`, true);
  const instanceId = randomUUID(); const instancePath = path.join(parent.path, `${instanceId}${extension}`);
  const flags = constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | noFollowOpenFlag();
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
  const claim = claimBytes({ eventId, ...staged }); const handle = await open(claimPath, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | noFollowOpenFlag(), 0o600); try { await handle.writeFile(claim); await handle.sync(); } finally { await handle.close(); }
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
  assertMemoryAppendNotQuarantined(scan, parsed.event.memory_id);
  const duplicate = scan.events.find((item) => item.event.memory_id === parsed.event.memory_id && item.event.operation_id === parsed.event.operation_id);
  if (duplicate?.bytes.equals(bytes)) return { status: "present", eventId, relativePath, fileSha256: hash(bytes) };
  if (duplicate) fail("duplicate-operation: different event bytes.", "duplicate-operation");
  authorizeMemoryAppend({ scan, parsed });
  return sealEvent(store, relativePath, eventId, bytes, "event");
}

function stableSnapshot(from, to) { return ["schema_version", "memory_id", "kind", "lane", "scope", "project_id", "created_at", "artifact_types", "related_ids", "tags", "sources", "instruction_sha256"].every((key) => JSON.stringify(from.record[key]) === JSON.stringify(to.record[key])) && JSON.stringify(from.sections) === JSON.stringify(to.sections); }
function resolutionSnapshotAllowed(chosen, candidate) { return JSON.stringify(chosen.record) === JSON.stringify(candidate.record) && JSON.stringify(chosen.sections) === JSON.stringify(candidate.sections) || stableSnapshot(chosen, candidate) && validateMemoryTransition({ from: chosen.record, to: candidate.record, approvalBasis: candidate.record.approval_basis }).ok; }
function assertMemoryAppendNotQuarantined(scan, memoryId) { if ((scan.quarantines ?? []).some((marker) => marker.memory_id === memoryId) || (scan.taintedMemoryIds ?? []).includes?.(memoryId)) fail("Memory is quarantined.", "memory.quarantined"); }
function validMemoryEventEdge({ item, byId, ancestors, currentHeads } = {}) {
  const { event } = item ?? {};
  if (event?.event_type === "capture") return event.parent_event_ids.length === 0;
  if (event?.event_type === "transition") {
    const parent = byId.get(event.parent_event_ids[0]);
    return Boolean(parent && event.parent_event_ids.length === 1 && event.action === item.record.status && stableSnapshot(parent, item) && validateMemoryTransition({ from: parent.record, to: item.record, approvalBasis: item.record.approval_basis }).ok);
  }
  if (event?.event_type === "resolution") {
    if (event.parent_event_ids.length < 2 || !event.parent_event_ids.includes(event.chosen_parent_event_id) || currentHeads && (!event.parent_event_ids.every((eventId) => currentHeads.includes(eventId)) || !currentHeads.includes(event.chosen_parent_event_id)) || ancestors && event.parent_event_ids.some((left, index) => event.parent_event_ids.slice(index + 1).some((right) => ancestors(left).has(right) || ancestors(right).has(left)))) return false;
    const chosen = byId.get(event.chosen_parent_event_id); return Boolean(chosen && resolutionSnapshotAllowed(chosen, item));
  }
  return false;
}
function authorizeMemoryAppend({ scan, parsed } = {}) {
  if (!scan?.complete) fail("Memory scan is incomplete.", "memory.scan_incomplete");
  const memoryId = parsed?.event?.memory_id;
  assertMemoryAppendNotQuarantined(scan, memoryId);
  const prior = (scan.events ?? []).filter((item) => item.event.memory_id === memoryId);
  const folded = foldMemoryEvents(scan); const diagnostics = folded.diagnostics.filter((item) => item.memory_id === memoryId);
  if (diagnostics.some((item) => item.code !== "memory.concurrent_conflict")) fail("Memory history is not authorized.", "memory.invalid_event_dag");
  const byId = new Map(prior.map((item) => [item.eventId, item])); const used = new Set(prior.flatMap((item) => item.event.parent_event_ids)); const heads = [...byId.keys()].filter((eventId) => !used.has(eventId)).sort();
  const foldedMemory = folded.memories.get(memoryId);
  if (heads.length === 1 && foldedMemory?.headEventId !== heads[0]) fail("Memory history is not authorized.", "memory.invalid_event_dag");
  if (parsed.event.event_type === "capture") { if (prior.length) fail("Memory already has a capture event.", "memory.capture_exists"); return { prior, heads, byId }; }
  if (parsed.event.event_type === "transition" && (heads.length !== 1 || parsed.event.parent_event_ids[0] !== heads[0])) fail("Transition parent is not the current head.", "memory.transition_heads");
  if (parsed.event.event_type === "resolution" && (!parsed.event.parent_event_ids.every((eventId) => heads.includes(eventId)) || !heads.includes(parsed.event.chosen_parent_event_id))) fail("Resolution parents are not the current heads.", "memory.resolution_heads");
  const ancestorMemo = new Map(); const ancestors = (eventId, stack = new Set()) => { if (ancestorMemo.has(eventId)) return ancestorMemo.get(eventId); if (stack.has(eventId)) return new Set([eventId]); const item = byId.get(eventId); const values = new Set(); for (const parent of item?.event.parent_event_ids ?? []) { values.add(parent); for (const ancestor of ancestors(parent, new Set([...stack, eventId]))) values.add(ancestor); } ancestorMemo.set(eventId, values); return values; };
  if (!validMemoryEventEdge({ item: { event: parsed.event, record: parsed.record, sections: parsed.sections }, byId, ancestors, currentHeads: heads })) fail("Memory event edge is not authorized.", "memory.invalid_event_edge");
  return { prior, heads, byId };
}

async function allEntries(root, relative = "", state, sourceRoot = false) {
  let directoryHandle; try { directoryHandle = await opendir(root); } catch (error) { if (sourceRoot && error?.code === "ENOENT") return; throw error; }
  const entries = []; try { for await (const entry of directoryHandle) { entries.push(entry); if (entries.length > state.maxEvents - state.count) { state.complete = false; state.diagnostics.push({ code: "memory.scan_limit_exceeded" }); return; } } } finally { await closeTraversalDirectory(directoryHandle); }
  for (const entry of entries.sort((a, b) => Buffer.compare(Buffer.from(a.name), Buffer.from(b.name)))) { if (state.count === state.maxEvents) { state.complete = false; state.diagnostics.push({ code: "memory.scan_limit_exceeded" }); return; } state.count += 1; const next = path.join(root, entry.name); const pathName = relative ? `${relative}/${entry.name}` : entry.name; const item = await lstat(next); if (item.isDirectory() && !item.isSymbolicLink()) { await allEntries(next, pathName, state); if (!state.complete) return; } else if (item.isFile() && entry.name === "commit.json") state.commits.push(pathName); else if (item.isSymbolicLink() || !item.isFile()) { state.complete = false; state.diagnostics.push({ code: "memory.unbound_seal" }); return; } }
}
async function closeTraversalDirectory(handle) { try { await handle.close(); } catch (error) { if (error?.code !== "ERR_DIR_CLOSED") throw error; } }
async function matchesStoreIdentity(store) {
  try { const root = await canonicalDirectory(store?.root); return Boolean(store?.identity && same(root.identity, store.identity)); } catch { return false; }
}
function markerRelativePath({ targetMemoryId, targetEventId, markerId }) { return `v1/controls/quarantine/${hash(targetMemoryId).slice(0, 2)}/${targetEventId}/${markerId}`; }
export async function scanMemoryEvents({ store, maxEventBytes = MAX_BYTES, maxEvents = MAX_EVENTS } = {}) {
  if (!Number.isInteger(maxEventBytes) || maxEventBytes < 1 || maxEventBytes > MAX_BYTES || !Number.isInteger(maxEvents) || maxEvents < 1 || maxEvents > MAX_EVENTS) fail("Invalid scan limits.");
  const state = { maxEvents, count: 0, complete: true, diagnostics: [], commits: [], taintedMemoryIds: new Set() };
  const events = []; const quarantines = [];
  const closed = () => ({ complete: false, entriesScanned: state.count, diagnostics: state.diagnostics, taintedMemoryIds: [], events: [], quarantines: [], sourceEntries: [] });
  if (!await matchesStoreIdentity(store)) { state.complete = false; state.diagnostics.push({ code: "memory.unbound_seal" }); return closed(); }
  try { await allEntries(path.join(store.root, "v1", "events"), "events", state, true); if (state.complete) await allEntries(path.join(store.root, "v1", "controls", "quarantine"), "controls/quarantine", state, true); } catch { state.complete = false; state.diagnostics.push({ code: "memory.unbound_seal" }); }
  if (!state.complete) return closed();
  if (!await matchesStoreIdentity(store)) { state.diagnostics.push({ code: "memory.unbound_seal" }); return closed(); }
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
      quarantines.push({ ...marker, markerId: committed.claim.eventId, relativePath: `v1/${base}`, bytes: committed.bytes });
    } catch (error) { state.diagnostics.push({ code: error?.code === "memory.quarantine_binding" ? "memory.quarantine_binding" : "memory.unbound_seal" }); return closed(); }
  }
  if (!await matchesStoreIdentity(store)) { state.diagnostics.push({ code: "memory.unbound_seal" }); return closed(); }
  const sourceEntries = [
    ...events.map((item) => ({ relativePath: item.relativePath, observedSha256: hash(item.bytes), classification: "event" })),
    ...quarantines.map((item) => ({ relativePath: item.relativePath, observedSha256: hash(item.bytes), classification: "quarantine" })),
  ].sort((left, right) => Buffer.compare(Buffer.from(left.relativePath, "utf8"), Buffer.from(right.relativePath, "utf8")));
  return { complete: true, entriesScanned: state.count, diagnostics: state.diagnostics, taintedMemoryIds: [], events: events.sort((a, b) => a.eventId.localeCompare(b.eventId)), quarantines, sourceEntries };
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
    for (const item of items) {
      if (!validMemoryEventEdge({ item, byId, ancestors }) || item.record.supersedes === memoryId) invalid.add(item.eventId);
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
  const scan = await scanMemoryEvents({ store }); if (!scan.complete) fail("Memory scan is incomplete.", "memory.scan_incomplete");
  const target = scan.events.find((item) => item.memoryId === targetMemoryId && item.eventId === targetEventId && item.relativePath === targetRelativePath && (observedSha256 === null || observedSha256 === hash(item.bytes))); if (!target) fail("Quarantine target is not a committed event.", "memory.quarantine_target");
  const marker = { schema_version: 1, memory_id: targetMemoryId, target_event_id: targetEventId, target_relative_path: targetRelativePath, observed_sha256: observedSha256, reason_code: reasonCode, actor, recorded_at: new Date(now).toISOString() }; const bytes = Buffer.from(canonicalQuarantineMarkerDocument(marker)); const markerId = `qmv1-${hash(bytes)}`; return sealEvent(store, markerRelativePath({ targetMemoryId, targetEventId, markerId }), markerId, bytes, "marker");
}

async function readGitExcludeSnapshot(handle) {
  const before = await handle.stat(); if (!before.isFile() || before.nlink !== 1 || before.size > MAX_BYTES) fail("Unsafe git exclude.");
  const bytes = Buffer.alloc(before.size); let offset = 0;
  while (offset < bytes.byteLength) { const { bytesRead } = await handle.read(bytes, offset, bytes.byteLength - offset, offset); if (bytesRead === 0) fail("Unsafe git exclude."); offset += bytesRead; }
  const after = await handle.stat(); if (!sameFileState(before, after)) fail("Unsafe git exclude.");
  return { ...after, bytes, digest: hash(bytes) };
}
function sameGitExcludeSnapshot(left, right) { return sameFileState(left, right) && left.digest === right.digest; }
async function verifyGitExcludePathname(expected, handle, expectedSnapshot) { const pathname = await safeFile(expected); const opened = await handle.stat(); if (!pathname || opened.nlink !== 1 || !sameFileState(pathname, opened) || expectedSnapshot && !sameFileState(expectedSnapshot, opened)) fail("Unsafe git exclude."); }

function gitMetadataPath(value) {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_GIT_METADATA_BYTES || value !== value.normalize("NFC") || /[\0-\x1f\x7f]/u.test(value)) fail("Unsafe git metadata.");
  return value;
}
function decodeGitMetadata(bytes) { try { return UTF8.decode(bytes); } catch { fail("Unsafe git metadata."); } }
async function gitDirectoryReference(base, value) { return canonicalDirectory(path.isAbsolute(gitMetadataPath(value)) ? path.resolve(value) : path.resolve(base, value)); }
async function gitMetadataSnapshot(candidate) {
  const initial = await safeFile(candidate); if (!initial) fail("Unsafe git metadata.");
  const bytes = await boundedFile(candidate, MAX_GIT_METADATA_BYTES); const final = await safeFile(candidate);
  if (!final || !sameFileState(initial, final)) fail("Unsafe git metadata.");
  return { path: candidate, identity: final, bytes, digest: hash(bytes) };
}
function sameGitMetadataSnapshot(left, right) { return left.path === right.path && sameFileState(left.identity, right.identity) && left.digest === right.digest; }
function gitMetadataLine(snapshot, expression) {
  const value = expression.exec(decodeGitMetadata(snapshot.bytes))?.[1];
  if (!value) fail("Unsafe git metadata.");
  return gitMetadataPath(value);
}
async function gitCommonDirectory(workspaceRoot) {
  const workspace = await canonicalDirectory(workspaceRoot); const dotGit = path.join(workspace.path, ".git"); const metadata = await stat(dotGit);
  if (!metadata || metadata.isSymbolicLink()) fail("Unsafe git metadata.");
  if (metadata.isDirectory()) return { workspace, commonRoot: await canonicalDirectory(dotGit) };
  if (!metadata.isFile()) fail("Unsafe git metadata.");
  const dotGitSnapshot = await gitMetadataSnapshot(dotGit); const gitdir = gitMetadataLine(dotGitSnapshot, /^gitdir: ([^\n]+)\n$/u);
  const worktreeGit = await gitDirectoryReference(workspace.path, gitdir); const commonMetadata = path.join(worktreeGit.path, "commondir"); const commonStat = await stat(commonMetadata);
  if (!commonStat) fail("Unsafe git metadata.");
  if (commonStat.isSymbolicLink() || !commonStat.isFile()) fail("Unsafe git metadata.");
  const commonSnapshot = await gitMetadataSnapshot(commonMetadata); const common = gitMetadataLine(commonSnapshot, /^([^\n]+)\n$/u);
  const commonRoot = await gitDirectoryReference(worktreeGit.path, common);
  const relation = path.relative(commonRoot.path, worktreeGit.path).split(path.sep);
  if (!isInside(commonRoot.path, worktreeGit.path) || relation.length !== 2 || relation[0] !== "worktrees" || !safeId(relation[1])) fail("Unsafe git metadata.");
  const backlinkSnapshot = await gitMetadataSnapshot(path.join(worktreeGit.path, "gitdir")); const backlink = gitMetadataLine(backlinkSnapshot, /^([^\n]+)\n$/u);
  const backlinkPath = path.isAbsolute(backlink) ? path.resolve(backlink) : path.resolve(worktreeGit.path, backlink);
  if (backlinkPath !== dotGit) fail("Unsafe git metadata.");
  return { workspace, commonRoot, worktreeGit, dotGitSnapshot, commonSnapshot, backlinkSnapshot };
}
async function recheckGitAuthority(authority) {
  const workspace = await canonicalDirectory(authority.workspace.path); const commonRoot = await canonicalDirectory(authority.commonRoot.path);
  if (!same(workspace.identity, authority.workspace.identity) || !same(commonRoot.identity, authority.commonRoot.identity)) fail("Unsafe git metadata.");
  if (!authority.dotGitSnapshot) return;
  const worktreeGit = await canonicalDirectory(authority.worktreeGit.path);
  if (!same(worktreeGit.identity, authority.worktreeGit.identity)) fail("Unsafe git metadata.");
  for (const snapshot of [authority.dotGitSnapshot, authority.commonSnapshot, authority.backlinkSnapshot]) {
    if (!sameGitMetadataSnapshot(snapshot, await gitMetadataSnapshot(snapshot.path))) fail("Unsafe git metadata.");
  }
}

export async function ensureMemoryGitExclusion({ workspaceRoot, beforeAppend, beforeFinalRecheck } = {}) {
  let authority;
  try { authority = await gitCommonDirectory(workspaceRoot); } catch { return { status: "warning", code: "memory.git_metadata" }; }
  try { const infoPath = path.join(authority.commonRoot.path, "info"); await inspectExistingPathChain(infoPath); await mkdir(infoPath, { recursive: false, mode: 0o700 }).catch((error) => error.code === "EEXIST" ? undefined : Promise.reject(error)); await canonicalDirectory(infoPath); const expected = path.join(infoPath, "exclude"); const lock = `${expected}.game-design-memory-exclude.lock`; let lockHandle; try { lockHandle = await open(lock, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | noFollowOpenFlag(), 0o600); } catch { return { status: "warning", code: "memory.git_exclude_lock" }; } try { const existingStat = await safeFile(expected); const handle = existingStat ? await open(expected, constants.O_RDWR | noFollowOpenFlag()) : await open(expected, constants.O_RDWR | constants.O_CREAT | constants.O_EXCL | noFollowOpenFlag(), 0o600); try { if (existingStat) { const opened = await handle.stat(); if (!opened.isFile() || opened.nlink !== 1 || !same(opened, existingStat) || opened.size > MAX_BYTES) fail("Unsafe git exclude."); } const initial = await readGitExcludeSnapshot(handle); await verifyGitExcludePathname(expected, handle, initial); const text = initial.bytes.toString("utf8"); const begin = (text.match(/# game-design-plugin:memory:begin/gu) ?? []).length; const end = (text.match(/# game-design-plugin:memory:end/gu) ?? []).length; if (begin !== end || begin > 1) return { status: "warning", code: "memory.git_exclude_marker" }; if (begin === 0) { if (typeof beforeAppend === "function") await beforeAppend(); await recheckGitAuthority(authority); const beforeAppendSnapshot = await readGitExcludeSnapshot(handle); if (!sameGitExcludeSnapshot(initial, beforeAppendSnapshot)) fail("Unsafe git exclude."); const suffix = Buffer.from(`${text && !text.endsWith("\n") ? "\n" : ""}${MARKER}`); let offset = initial.bytes.byteLength; while (offset < initial.bytes.byteLength + suffix.byteLength) offset += (await handle.write(suffix, offset - initial.bytes.byteLength, suffix.byteLength - (offset - initial.bytes.byteLength), offset)).bytesWritten; await handle.sync(); const expectedFinal = await readGitExcludeSnapshot(handle); if (!expectedFinal.bytes.equals(Buffer.concat([initial.bytes, suffix]))) fail("Unsafe git exclude."); if (typeof beforeFinalRecheck === "function") await beforeFinalRecheck(); const final = await readGitExcludeSnapshot(handle); if (!sameGitExcludeSnapshot(expectedFinal, final)) fail("Unsafe git exclude."); await verifyGitExcludePathname(expected, handle, expectedFinal); } else await verifyGitExcludePathname(expected, handle, initial); return { status: "ready" }; } finally { await handle.close(); } } finally { await lockHandle.close(); await rm(lock, { force: true }); } } catch { return { status: "warning", code: "memory.git_exclude" }; }
}
