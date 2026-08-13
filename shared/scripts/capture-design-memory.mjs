import { createHash } from "node:crypto";

import { appendMemoryEvent, foldMemoryEvents, resolveMemoryStore, scanMemoryEvents } from "./lib/safe-memory-store.mjs";
import { publishMemoryLogGeneration, rebuildMemoryIndex } from "./retrieve-design-memory.mjs";
import { canonicalMemoryEventDocument, validateMemorySourceBindings } from "./validate-design-memory.mjs";

const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const TYPE = Object.freeze({ "explicit-preference": "style-preference", "human-decision": "decision", "playtest-finding": "design-lesson", "review-finding": "design-lesson", "lesson-revision": "design-lesson" });
const LANES = new Set(["common", "studio", "career"]);
function safeId(value) { return typeof value === "string" && value === value.normalize("NFC") && ID.test(value); }
function safeText(value) { return typeof value === "string" && value.trim() && value === value.normalize("NFC") && !value.includes("\0"); }
function sortedIds(values) { return Array.isArray(values) && values.every(safeId) ? [...new Set(values)].sort() : null; }
function stamp(now) { const date = new Date(now); if (Number.isNaN(date.valueOf())) throw new Error("Invalid capture time."); return date.toISOString(); }
function dayAfter(iso, days) { const date = new Date(iso); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10); }
function sectionsFor(event) { return { "발견한 내용": event.summary, "적용 조건": event.applicability, "적용하면 안 되는 경우": event.exclusions, "근거": (event.sources ?? []).map((source) => `${source.artifact_id}/${source.locator}`).join("\n") || "interactive-user instruction" }; }
function sourceList(event) { return Array.isArray(event.sources) ? event.sources.map((source) => ({ artifact_id: source?.artifact_id, locator: source?.locator, sha256: source?.sha256 })).sort((a, b) => `${a.artifact_id}\0${a.locator}`.localeCompare(`${b.artifact_id}\0${b.locator}`)) : []; }

export function memoryIdForEvent({ lane, kind, projectId, eventId } = {}) {
  const digest = createHash("sha256").update(`${projectId}\0${eventId}`, "utf8").digest("hex").slice(0, 16);
  return `memory-${lane}-${kind}-${digest}`;
}

async function publishFoldLog({ workspaceRoot, config, now }) {
  const rebuilt = await rebuildMemoryIndex({ workspaceRoot, config, now });
  if (!rebuilt.complete) return rebuilt.warnings ?? [];
  const lines = [...rebuilt.fold.memories.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([memoryId, value]) => `- ${memoryId}: ${value.record.status}`);
  const published = await publishMemoryLogGeneration({ store: rebuilt.store, sourceTreeSha256: rebuilt.sourceTreeSha256, logBytes: Buffer.from(`# design-memory\n${lines.join("\n")}\n`, "utf8") });
  return published.complete ? [] : published.warnings ?? [];
}

export async function captureDesignMemory({ workspaceRoot, config, projectId, lane, event, now = new Date(), disabledForRequest = false } = {}) {
  if (!config?.enabled || disabledForRequest || !safeId(projectId) || projectId !== config.projectId || !LANES.has(lane) || !event || !safeId(event.eventId) || !Object.hasOwn(TYPE, event.type)) return { status: "skipped" };
  const kind = TYPE[event.type]; const explicit = event.type === "explicit-preference";
  const lists = [sortedIds(event.artifactTypes), sortedIds(event.relatedIds), sortedIds(event.tags)];
  if (![event.summary, event.applicability, event.exclusions].every(safeText) || lists.some((item) => item === null) || (!explicit && !Array.isArray(event.sources))) return { status: "skipped" };
  const effectiveAt = stamp(now); const memoryId = memoryIdForEvent({ lane, kind, projectId, eventId: event.eventId });
  const record = { schema_version: 1, memory_id: memoryId, kind, lane, status: explicit ? "approved" : "candidate", scope: config.scope, project_id: projectId, created_at: effectiveAt, updated_at: effectiveAt, review_after: dayAfter(effectiveAt, config.candidateTtlDays ?? 30), expires_at: dayAfter(effectiveAt, config.candidateTtlDays ?? 30), approved_by: explicit ? "interactive-user" : null, approval_basis: explicit ? "explicit-user-instruction" : null, supersedes: null, artifact_types: lists[0], related_ids: lists[1], tags: lists[2], sources: explicit ? [] : sourceList(event), ...(explicit ? { instruction_sha256: createHash("sha256").update(JSON.stringify({ eventId: event.eventId, summary: event.summary }), "utf8").digest("hex") } : {}) };
  const envelope = { schema_version: 1, event_type: "capture", action: "capture", memory_id: memoryId, operation_id: event.eventId, parent_event_ids: [], effective_at: effectiveAt, actor: explicit ? "interactive-user" : event.actor, reason: explicit ? "explicit-user-instruction" : "capture", record };
  let eventDocument;
  try { eventDocument = canonicalMemoryEventDocument(envelope, sectionsFor(event)); } catch { return { status: "skipped" }; }
  if (!explicit) { const sources = await validateMemorySourceBindings(record, { workspaceRoot }); if (!sources.ok) return { status: "skipped" }; }
  let store;
  try { store = await resolveMemoryStore({ workspaceRoot, config, platform: process.platform, home: process.env.HOME ?? workspaceRoot, initialize: true }); } catch { return { status: "skipped" }; }
  try {
    const appended = await appendMemoryEvent({ store, eventDocument });
    let warnings = [];
    try { warnings = await publishFoldLog({ workspaceRoot, config, now }); } catch { warnings = [{ code: "memory.log_publish" }]; }
    return { status: appended.status, memoryId, eventId: appended.eventId, relativePath: appended.relativePath, store, warnings };
  } catch (error) { if (["duplicate-operation", "memory.append_conflict"].includes(error?.code)) return { status: "conflict", memoryId, store }; return { status: "skipped", memoryId, store }; }
}
