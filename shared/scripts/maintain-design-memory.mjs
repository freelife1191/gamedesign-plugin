import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";

import { appendMemoryEvent, appendQuarantineMarker, ensureMemoryGitExclusion, foldMemoryEvents, resolveMemoryStore, scanMemoryEvents } from "./lib/safe-memory-store.mjs";
import { rebuildMemoryIndex } from "./retrieve-design-memory.mjs";
import { canonicalMemoryEventDocument, memoryOperationId, validateMemorySourceBindings } from "./validate-design-memory.mjs";

const exec = promisify(execFile); const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
function fail(code = "memory.maintenance") { const error = new Error("Memory maintenance request was rejected."); error.code = code; throw error; }
function safeId(value) { return typeof value === "string" && ID.test(value); }
function human(actor) { return typeof actor === "string" && actor.trim() && !/(?:\bai\b|\bbot\b|\bagent\b)/iu.test(actor); }
function reason(value) { return typeof value === "string" && value.trim() && value.length <= 1024 && !value.includes("\0"); }
function iso(now) { const date = new Date(now); if (Number.isNaN(date.valueOf())) fail(); return date.toISOString(); }
function heads(events) { const used = new Set(events.flatMap((item) => item.event.parent_event_ids)); return events.filter((item) => !used.has(item.eventId)).sort((a, b) => a.eventId.localeCompare(b.eventId)); }
function update(record, status, time, actor = null, basis = null) { return { ...record, status, updated_at: time, approved_by: status === "approved" ? actor : record.approved_by, approval_basis: status === "approved" ? basis : record.approval_basis }; }
async function storeFor(workspaceRoot, config, initialize) { try { return await resolveMemoryStore({ workspaceRoot, config, platform: process.platform, home: process.env.HOME ?? workspaceRoot, initialize }); } catch { return null; } }
async function current(store, memoryId) { const scan = await scanMemoryEvents({ store }); if (!scan.complete) fail("memory.scan_incomplete"); const events = scan.events.filter((item) => item.memoryId === memoryId); const currentHeads = heads(events); return { scan, events, currentHeads, fold: foldMemoryEvents(scan), head: currentHeads.length === 1 ? currentHeads[0] : null }; }
async function transition({ workspaceRoot, config, action, memoryId, actor, reason: why, now, chosenParentEventId }) {
  if (!safeId(memoryId) || !human(actor) || !reason(why)) fail(); const store = await storeFor(workspaceRoot, config, true); if (!store) fail(); const state = await current(store, memoryId); const time = iso(now);
  if (action === "resolution") {
    if (state.currentHeads.length < 2 || !state.currentHeads.some((item) => item.eventId === chosenParentEventId)) fail(); const chosen = state.currentHeads.find((item) => item.eventId === chosenParentEventId); const event = { schema_version: 1, event_type: "resolution", action: "resolution", memory_id: memoryId, parent_event_ids: state.currentHeads.map((item) => item.eventId), chosen_parent_event_id: chosenParentEventId, effective_at: time, actor, reason: why, record: chosen.record }; event.operation_id = memoryOperationId(event); const appended = await appendMemoryEvent({ store, eventDocument: canonicalMemoryEventDocument(event, chosen.sections) }); return { ...appended, memoryId, store };
  }
  if (!state.head) fail("memory.concurrent_conflict"); const base = state.head.record; let target;
  if (action === "verify") { if (base.status !== "candidate") fail(); const sourceCheck = await validateMemorySourceBindings(base, { workspaceRoot }); if (!sourceCheck.ok) fail(); target = "verified"; }
  else if (action === "approve") { if (base.status !== "verified") fail(); target = "approved"; }
  else if (action === "reject") target = "rejected";
  else if (action === "retire") target = base.status === "approved" || base.status === "disputed" || base.status === "stale" ? "superseded" : "rejected";
  else if (action === "expired" && base.status === "candidate") target = "expired";
  else if (action === "stale" && base.status === "approved") target = "stale";
  else fail();
  const record = update(base, target, time, target === "approved" ? actor : null, target === "approved" ? "human-review" : null);
  const event = { schema_version: 1, event_type: "transition", action: target, memory_id: memoryId, parent_event_ids: [state.head.eventId], effective_at: time, actor, reason: why, record }; event.operation_id = memoryOperationId(event);
  try { const appended = await appendMemoryEvent({ store, eventDocument: canonicalMemoryEventDocument(event, state.head.sections) }); return { ...appended, memoryId, store }; } catch (error) { if (error?.code) throw error; fail(); }
}
async function lintMemoryStore({ workspaceRoot, config, now }) { const store = await storeFor(workspaceRoot, config, false); if (!store) return { status: "ready", memories: [], diagnostics: [] }; const scan = await scanMemoryEvents({ store }); const fold = foldMemoryEvents(scan, { now }); const diagnostics = [...scan.diagnostics, ...fold.diagnostics]; for (const memory of fold.memories.values()) { const checked = await validateMemorySourceBindings(memory.record, { workspaceRoot }); if (!checked.ok) diagnostics.push({ code: "memory.stale_source" }); } return { status: "ready", memories: [...fold.memories.keys()].sort(), diagnostics }; }
async function listMemoryRecords({ workspaceRoot, config }) { const store = await storeFor(workspaceRoot, config, false); if (!store) return { status: "ready", memories: [] }; const scan = await scanMemoryEvents({ store }); const fold = foldMemoryEvents(scan); return { status: "ready", memories: [...fold.memories.entries()].map(([memoryId, value]) => ({ memoryId, status: value.record.status, headEventId: value.headEventId })).sort((a, b) => a.memoryId.localeCompare(b.memoryId)), diagnostics: [...scan.diagnostics, ...fold.diagnostics] }; }
async function sweep({ workspaceRoot, config, actor, reason: why, now }) { if (!human(actor) || !reason(why)) fail(); const store = await storeFor(workspaceRoot, config, true); if (!store) fail(); const scan = await scanMemoryEvents({ store }); const fold = foldMemoryEvents(scan, { now }); const date = iso(now).slice(0, 10); const changed = []; for (const [memoryId, value] of fold.memories) { const status = value.record.status === "candidate" && value.record.expires_at < date ? "expired" : value.record.kind === "external-note" && value.record.review_after < date ? "stale" : null; if (status) changed.push(await transition({ workspaceRoot, config, action: status, memoryId, actor, reason: why, now })); } return { status: "ready", changed }; }
async function quarantine({ workspaceRoot, config, memoryId, actor, reason: why, now }) { if (!safeId(memoryId) || !human(actor) || !reason(why)) fail(); const store = await storeFor(workspaceRoot, config, true); if (!store) fail(); const state = await current(store, memoryId); const target = state.events.sort((a, b) => a.eventId.localeCompare(b.eventId))[0]; if (!target) fail(); const appended = await appendQuarantineMarker({ store, targetMemoryId: memoryId, targetEventId: target.eventId, targetRelativePath: target.relativePath, observedSha256: createHash("sha256").update(target.bytes).digest("hex"), reasonCode: "memory.user-quarantine", actor, now }); return { ...appended, memoryId, store }; }
async function syncGit(workspaceRoot, config) { return ensureMemoryGitExclusion({ workspaceRoot, gitMode: config.gitMode, runGit: async (args, cwd) => (await exec("git", args, { cwd, encoding: "utf8", maxBuffer: 64 * 1024 })).stdout }); }

export async function maintainDesignMemory({ workspaceRoot, config, action, memoryId, actor, reason, chosenParentEventId, now = new Date() } = {}) {
  if (!config?.enabled) return { status: "disabled" };
  if (action === "list") return listMemoryRecords({ workspaceRoot, config });
  if (action === "lint") return lintMemoryStore({ workspaceRoot, config, now });
  if (action === "rebuild") return rebuildMemoryIndex({ workspaceRoot, config, now });
  if (action === "sync-git-exclusion") return syncGit(workspaceRoot, config);
  if (action === "quarantine") return quarantine({ workspaceRoot, config, memoryId, actor, reason, now });
  if (action === "sweep") return sweep({ workspaceRoot, config, actor, reason, now });
  return transition({ workspaceRoot, config, action, memoryId, actor, reason, chosenParentEventId, now });
}

async function cli() {
  let input = ""; for await (const chunk of process.stdin) input += chunk; let value;
  try { if (!/^\{[\s\S]*\}\n?$/u.test(input)) fail(); value = JSON.parse(input); if (!value || Array.isArray(value) || typeof value !== "object") fail(); } catch (error) { process.stdout.write(`${JSON.stringify({ code: error?.code ?? "memory.maintenance" })}\n`); process.exitCode = 1; return; }
  try { process.stdout.write(`${JSON.stringify(await maintainDesignMemory(value))}\n`); } catch (error) { process.stdout.write(`${JSON.stringify({ code: error?.code ?? "memory.maintenance", memoryId: safeId(value.memoryId) ? value.memoryId : undefined })}\n`); process.exitCode = 1; }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await cli();
