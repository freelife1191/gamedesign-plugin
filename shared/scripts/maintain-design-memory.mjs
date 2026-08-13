import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";

import { verifyMaintenanceHumanReceipt } from "./lib/design-memory-capabilities.mjs";
import { appendMemoryEvent, appendQuarantineMarker, ensureMemoryGitExclusion, foldMemoryEvents, resolveMemoryStore, scanMemoryEvents } from "./lib/safe-memory-store.mjs";
import { rebuildMemoryIndex } from "./retrieve-design-memory.mjs";
import { canonicalMemoryEventDocument, memoryOperationId, validateMemorySourceBindings } from "./validate-design-memory.mjs";
import { publishDesignMemoryLog } from "./capture-design-memory.mjs";

const exec = promisify(execFile);
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const HUMAN_ACTIONS = new Set(["verify", "approve", "reject", "retire", "sweep", "resolution", "quarantine"]);

function fail(code = "memory.maintenance") { const error = new Error("Memory maintenance request was rejected."); error.code = code; throw error; }
function safeId(value) { return typeof value === "string" && value === value.normalize("NFC") && ID.test(value); }
function byteCompare(left, right) { return Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8")); }
function sameIds(left, right) { return left.length === right.length && left.every((value, index) => value === right[index]); }
function heads(events) { const used = new Set(events.flatMap((item) => item.event.parent_event_ids)); return events.filter((item) => !used.has(item.eventId)).sort((left, right) => byteCompare(left.eventId, right.eventId)); }
function update(record, status, time, actor = null, basis = null) { return { ...record, status, updated_at: time, approved_by: status === "approved" ? actor : record.approved_by, approval_basis: status === "approved" ? basis : record.approval_basis }; }
async function storeFor(workspaceRoot, config, initialize) { return resolveMemoryStore({ workspaceRoot, config, platform: process.platform, home: process.env.HOME ?? workspaceRoot, initialize }); }
async function scanned(store) { const scan = await scanMemoryEvents({ store }); if (!scan.complete) fail("memory.scan_incomplete"); return scan; }
function authorityFor({ config, action, memoryId, actor, reason, observedParentEventIds, chosenParentEventId, now, humanReceipt }) {
  const authority = verifyMaintenanceHumanReceipt(humanReceipt, { projectId: config?.projectId, scope: config?.scope, action, ...(memoryId === undefined ? {} : { memoryId }), actor, reason, observedParentEventIds, ...(chosenParentEventId === undefined ? {} : { chosenParentEventId }), now });
  if (!authority) fail("memory.human_authority_required");
  return authority;
}
async function withLog(result, workspaceRoot, config, now) { try { return { ...result, warnings: await publishDesignMemoryLog({ workspaceRoot, config, now }) }; } catch { return { ...result, warnings: [{ code: "memory.log_publish" }] }; } }
function transitionTarget(action, base) {
  if (action === "verify") return "verified";
  if (action === "approve") { if (base.status !== "verified") fail(); return "approved"; }
  if (action === "reject") return "rejected";
  if (action === "retire") return ["approved", "disputed", "stale"].includes(base.status) ? "superseded" : "rejected";
  fail();
}
function transitionDocument({ action, memoryId, parent, actor, reason, effectiveAt }) {
  const target = transitionTarget(action, parent.record);
  const record = update(parent.record, target, effectiveAt, target === "approved" ? actor : null, target === "approved" ? "human-review" : null);
  const event = { schema_version: 1, event_type: "transition", action: target, memory_id: memoryId, parent_event_ids: [parent.eventId], effective_at: effectiveAt, actor, reason, record };
  event.operation_id = memoryOperationId(event);
  return { event, eventDocument: canonicalMemoryEventDocument(event, parent.sections) };
}
async function appendTransition({ store, scan, action, memoryId, parentEventId, actor, reason, effectiveAt, workspaceRoot }) {
  const parent = scan.events.find((item) => item.memoryId === memoryId && item.eventId === parentEventId); if (!parent) fail();
  const built = transitionDocument({ action, memoryId, parent, actor, reason, effectiveAt });
  if (action === "verify") {
    const source = await validateMemorySourceBindings(parent.record, { workspaceRoot });
    const exactRetry = scan.events.some((item) => item.event.operation_id === built.event.operation_id && item.bytes.equals(Buffer.from(built.eventDocument)));
    if (!source.ok && !exactRetry) fail();
  }
  return appendMemoryEvent({ store, eventDocument: built.eventDocument });
}
async function transition(input) {
  const authority = authorityFor(input); const store = await storeFor(input.workspaceRoot, input.config, true); const scan = await scanned(store);
  const appended = await appendTransition({ store, scan, action: input.action, memoryId: input.memoryId, parentEventId: input.observedParentEventIds[0], actor: input.actor, reason: input.reason, effectiveAt: authority.effectiveAt, workspaceRoot: input.workspaceRoot });
  return withLog({ ...appended, memoryId: input.memoryId, store }, input.workspaceRoot, input.config, input.now);
}
async function resolution(input) {
  const authority = authorityFor(input); const store = await storeFor(input.workspaceRoot, input.config, true); const scan = await scanned(store);
  const events = scan.events.filter((item) => item.memoryId === input.memoryId); const currentHeads = heads(events).map((item) => item.eventId);
  if (!input.observedParentEventIds.every((eventId) => currentHeads.includes(eventId))) fail("memory.resolution_heads");
  const chosen = events.find((item) => item.eventId === input.chosenParentEventId); if (!chosen) fail();
  const event = { schema_version: 1, event_type: "resolution", action: "resolution", memory_id: input.memoryId, parent_event_ids: input.observedParentEventIds, chosen_parent_event_id: input.chosenParentEventId, effective_at: authority.effectiveAt, actor: input.actor, reason: input.reason, record: chosen.record };
  event.operation_id = memoryOperationId(event);
  const appended = await appendMemoryEvent({ store, eventDocument: canonicalMemoryEventDocument(event, chosen.sections) });
  return withLog({ ...appended, memoryId: input.memoryId, store }, input.workspaceRoot, input.config, input.now);
}
async function lintMemoryStore({ workspaceRoot, config, now }) {
  const store = await storeFor(workspaceRoot, config, false); if (!store) return { status: "ready", memories: [], diagnostics: [] };
  const scan = await scanned(store); const fold = foldMemoryEvents(scan, { now }); const diagnostics = [...scan.diagnostics, ...fold.diagnostics]; const orphaned = new Set();
  for (const item of scan.events) { const checked = await validateMemorySourceBindings(item.record, { workspaceRoot }); if (!checked.ok && !orphaned.has(item.memoryId)) { diagnostics.push({ code: "memory.orphan_source", memory_id: item.memoryId }); orphaned.add(item.memoryId); } }
  return { status: "ready", memories: [...fold.memories.keys()].sort(byteCompare), diagnostics };
}
async function listMemoryRecords({ workspaceRoot, config }) {
  const store = await storeFor(workspaceRoot, config, false); if (!store) return { status: "ready", memories: [], diagnostics: [] };
  const scan = await scanned(store); const fold = foldMemoryEvents(scan); const all = new Map();
  for (const item of scan.events) (all.get(item.memoryId) ?? all.set(item.memoryId, []).get(item.memoryId)).push(item);
  return { status: "ready", memories: [...all.entries()].map(([memoryId, events]) => { const current = heads(events); const memory = fold.memories.get(memoryId); return { memoryId, status: memory?.record.status ?? "concurrent-conflict", headEventIds: current.map((item) => item.eventId), headStatuses: current.map((item) => item.record.status) }; }).sort((left, right) => byteCompare(left.memoryId, right.memoryId)), diagnostics: [...scan.diagnostics, ...fold.diagnostics] };
}
async function sweep(input) {
  const authority = authorityFor(input); const store = await storeFor(input.workspaceRoot, input.config, true); const scan = await scanned(store); const allHeads = heads(scan.events).map((item) => item.eventId);
  if (!sameIds(input.observedParentEventIds, allHeads)) fail("memory.sweep_heads");
  const fold = foldMemoryEvents(scan, { now: authority.effectiveAt }); const date = authority.effectiveAt.slice(0, 10); const changed = [];
  for (const [memoryId, value] of fold.memories) {
    const action = value.record.status === "candidate" && value.record.expires_at < date ? "expired" : value.record.kind === "external-note" && value.record.review_after < date ? "stale" : null;
    if (!action) continue;
    const parent = scan.events.find((item) => item.eventId === value.headEventId); const record = update(parent.record, action, authority.effectiveAt); const event = { schema_version: 1, event_type: "transition", action, memory_id: memoryId, parent_event_ids: [parent.eventId], effective_at: authority.effectiveAt, actor: input.actor, reason: input.reason, record }; event.operation_id = memoryOperationId(event);
    changed.push({ ...await appendMemoryEvent({ store, eventDocument: canonicalMemoryEventDocument(event, parent.sections) }), memoryId });
  }
  return withLog({ status: "ready", changed, store }, input.workspaceRoot, input.config, input.now);
}
async function quarantine(input) {
  authorityFor(input); const store = await storeFor(input.workspaceRoot, input.config, true); const scan = await scanned(store); const events = scan.events.filter((item) => item.memoryId === input.memoryId); const currentHeads = heads(events).map((item) => item.eventId);
  if (!sameIds(input.observedParentEventIds, currentHeads)) fail("memory.quarantine_heads");
  const target = events.sort((left, right) => byteCompare(left.eventId, right.eventId))[0]; if (!target) fail();
  const appended = await appendQuarantineMarker({ store, targetMemoryId: input.memoryId, targetEventId: target.eventId, targetRelativePath: target.relativePath, observedSha256: createHash("sha256").update(target.bytes).digest("hex"), reasonCode: "memory.user-quarantine", actor: input.actor, now: input.now });
  return withLog({ ...appended, memoryId: input.memoryId, store }, input.workspaceRoot, input.config, input.now);
}
async function syncGit(workspaceRoot, config) { return ensureMemoryGitExclusion({ workspaceRoot, gitMode: config.gitMode, runGit: async (args, cwd) => (await exec("git", args, { cwd, encoding: "utf8", maxBuffer: 64 * 1024 })).stdout }); }

export async function maintainDesignMemory({ workspaceRoot, config, action, memoryId, actor, reason, observedParentEventIds, chosenParentEventId, now = new Date(), humanReceipt } = {}) {
  if (!config?.enabled) return { status: "disabled" };
  if (action === "list") return listMemoryRecords({ workspaceRoot, config });
  if (action === "lint") return lintMemoryStore({ workspaceRoot, config, now });
  if (action === "rebuild") return rebuildMemoryIndex({ workspaceRoot, config, now });
  if (action === "sync-git-exclusion") return syncGit(workspaceRoot, config);
  if (!HUMAN_ACTIONS.has(action)) fail();
  const input = { workspaceRoot, config, action, memoryId, actor, reason, observedParentEventIds, chosenParentEventId, now, humanReceipt };
  if (action === "quarantine") return quarantine(input);
  if (action === "sweep") return sweep(input);
  if (action === "resolution") return resolution(input);
  if (!safeId(memoryId)) fail();
  return transition(input);
}

async function cli() {
  let input = ""; for await (const chunk of process.stdin) input += chunk; let value;
  try { if (!/^\{[\s\S]*\}\n?$/u.test(input)) fail(); value = JSON.parse(input); if (!value || Array.isArray(value) || typeof value !== "object") fail(); } catch (error) { process.stdout.write(`${JSON.stringify({ code: error?.code ?? "memory.maintenance" })}\n`); process.exitCode = 1; return; }
  try { process.stdout.write(`${JSON.stringify(await maintainDesignMemory(value))}\n`); } catch (error) { process.stdout.write(`${JSON.stringify({ code: error?.code ?? "memory.maintenance", memoryId: safeId(value.memoryId) ? value.memoryId : undefined })}\n`); process.exitCode = 1; }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await cli();
