import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { canonicalMemoryEventDocument, memoryOperationId } from "../../shared/scripts/validate-design-memory.mjs";
import { appendMemoryEvent, resolveMemoryStore } from "../../shared/scripts/lib/safe-memory-store.mjs";
import {
  loadCurrentMemoryIndex,
  loadMemoryReceipt,
  loadMemoryView,
  listMemoryReceipts,
  publishMemoryIndexGeneration,
  publishMemoryReceiptGeneration,
  publishMemoryViewGeneration,
  rankMemoryEntries,
  rebuildMemoryIndex,
  retrieveApprovedDesignMemory,
  scanDerivedGenerations,
} from "../../shared/scripts/retrieve-design-memory.mjs";

const digest = (value) => createHash("sha256").update(value).digest("hex");
const config = { enabled: true, scope: "project", gitMode: "local", projectId: "wind-island", maxItems: 5, candidateTtlDays: 30 };
const context = { projectId: "wind-island", lane: "studio", artifactIds: ["combat-loop-v3"], artifactTypes: ["character-skill-combat-monster"], tags: ["boss", "counterplay"], disabledForRequest: false };

async function workspace(t) {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), "memory-retrieval-")));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

function record(status = "candidate") {
  return {
    schema_version: 1, memory_id: "memory-studio-design-lesson-0f2a4c61d9ab34ef", kind: "design-lesson", lane: "studio", status, scope: "project", project_id: "wind-island",
    created_at: "2026-08-12T00:00:00.000Z", updated_at: "2026-08-12T00:00:00.000Z", review_after: "2026-09-11", expires_at: "2026-09-11",
    approved_by: status === "approved" ? "reviewer" : null, approval_basis: status === "approved" ? "review" : null, supersedes: null,
    artifact_types: ["character-skill-combat-monster"], related_ids: ["combat-loop-v3"], tags: ["boss", "counterplay"],
    sources: [{ artifact_id: "playtest-session-04", locator: "evidence.yml#finding-07", sha256: digest("finding-07\n") }],
  };
}

const sections = { "발견한 내용": "회피 뒤 반격 수단이 없어 기다리는 시간이 길어졌다.", "적용 조건": "같은 전투 구조와 플레이어 능력을 사용하는 보스전", "적용하면 안 되는 경우": "회피 자체가 핵심 재미인 전투", "근거": "플레이테스트 메모" };
function capture() {
  return canonicalMemoryEventDocument({ schema_version: 1, event_type: "capture", action: "capture", memory_id: record().memory_id, operation_id: "capture-upstream-1", parent_event_ids: [], effective_at: "2026-08-12T00:00:00.000Z", actor: "author", reason: "capture", record: record() }, sections);
}
function transition(parentEventId, status) {
  const event = { schema_version: 1, event_type: "transition", action: status, memory_id: record().memory_id, parent_event_ids: [parentEventId], effective_at: "2026-08-12T01:00:00.000Z", actor: "reviewer", reason: status, record: record(status) };
  return canonicalMemoryEventDocument({ ...event, operation_id: memoryOperationId(event) }, sections);
}
async function approvedStore(t) {
  const root = await workspace(t);
  await writeFile(path.join(root, "evidence.yml"), "finding-07\n");
  const store = await resolveMemoryStore({ workspaceRoot: root, config, platform: process.platform, home: root, initialize: true });
  const captured = await appendMemoryEvent({ store, eventDocument: capture() });
  const verified = await appendMemoryEvent({ store, eventDocument: transition(captured.eventId, "verified") });
  await appendMemoryEvent({ store, eventDocument: transition(verified.eventId, "approved") });
  return { root, store };
}

test("rankMemoryEntries orders equal candidates by kind then UTF-8 memory id", () => {
  const entries = [
    { memoryId: "memory-z", kind: "design-lesson", relatedIds: ["a"], artifactTypes: [], tags: [] },
    { memoryId: "memory-a", kind: "project-fact", relatedIds: ["a"], artifactTypes: [], tags: [] },
  ];
  assert.deepEqual(rankMemoryEntries(entries, { artifactIds: ["a"], artifactTypes: [], tags: [] }).map((item) => item.memoryId), ["memory-a", "memory-z"]);
});

test("rebuild is deterministic from raw fold and derived index is not source authority", async (t) => {
  const { root, store } = await approvedStore(t);
  const first = await rebuildMemoryIndex({ workspaceRoot: root, config, now: new Date("2026-08-12T02:00:00.000Z") });
  const second = await rebuildMemoryIndex({ workspaceRoot: root, config, now: new Date("2030-01-01T00:00:00.000Z") });
  assert.equal(first.complete, true, JSON.stringify(first.warnings)); assert.deepEqual(first.bytes, second.bytes); assert.equal(first.index.entries.length, 1);
  const published = await publishMemoryIndexGeneration({ store, indexBytes: first.bytes, sourceTreeSha256: first.sourceTreeSha256 });
  assert.equal(published.complete, true); assert.match(published.status, /^(created|present)$/);
  const loaded = await loadCurrentMemoryIndex({ store, fold: first.fold });
  assert.equal(loaded.complete, true); assert.deepEqual(loaded.bytes, first.bytes);
});

test("retrieval returns only source-revalidated approved guidance and writes exact receipt history", async (t) => {
  const { root, store } = await approvedStore(t);
  const result = await retrieveApprovedDesignMemory({ workspaceRoot: root, config, requestContext: context, now: new Date("2026-08-12T02:00:00.000Z") });
  assert.equal(result.status, "ready"); assert.equal(result.untrustedMemoryData, true); assert.equal(result.guidance.length, 1);
  assert.equal(result.guidance[0].summary, sections["발견한 내용"]);
  assert.match(result.requestSha256, /^[a-f0-9]{64}$/); assert.match(result.receiptSha256, /^[a-f0-9]{64}$/);
  const receipt = await loadMemoryReceipt({ store, requestSha256: result.requestSha256, receiptSha256: result.receiptSha256 });
  assert.equal(receipt.status, "ready"); assert.equal(receipt.receipt.applied.length, 1);
  const history = await listMemoryReceipts({ store, requestSha256: result.requestSha256 });
  assert.equal(history.complete, true); assert.equal(history.items.length, 1);
});

test("disabled request does not resolve or publish memory", async () => {
  const result = await retrieveApprovedDesignMemory({ workspaceRoot: "/must-not-be-read", config, requestContext: { ...context, disabledForRequest: true } });
  assert.deepEqual(result, { schemaVersion: 1, status: "disabled", projectId: "wind-island", lane: "studio", untrustedMemoryData: true, guidance: [], excluded: [], warnings: [] });
});

test("receipt rejects a mismatched exact pair without selecting another history item", async (t) => {
  const { store } = await approvedStore(t);
  const requestSha256 = "a".repeat(64); const receiptBytes = Buffer.from(`${JSON.stringify({ schemaVersion: 1, requestSha256, sourceTreeSha256: "b".repeat(64), projectId: "wind-island", lane: "studio", policy: { scope: "project", maxItems: 5, candidateTtlDays: 30 }, observations: [], applied: [], excluded: [] })}\n`);
  const published = await publishMemoryReceiptGeneration({ store, requestSha256, receiptBytes });
  assert.equal(published.complete, true);
  const missing = await loadMemoryReceipt({ store, requestSha256, receiptSha256: "c".repeat(64) });
  assert.equal(missing.status, "missing");
});

test("source digest drift excludes a formerly approved item and never treats cached index as authority", async (t) => {
  const { root } = await approvedStore(t);
  const first = await retrieveApprovedDesignMemory({ workspaceRoot: root, config, requestContext: context, now: new Date("2026-08-12T02:00:00.000Z") });
  assert.equal(first.guidance.length, 1);
  await writeFile(path.join(root, "evidence.yml"), "changed evidence\n");
  const second = await retrieveApprovedDesignMemory({ workspaceRoot: root, config, requestContext: context, now: new Date("2026-08-12T02:00:00.000Z") });
  assert.equal(second.status, "ready"); assert.equal(second.guidance.length, 0); assert.deepEqual(second.excluded, [{ memoryId: record().memory_id, reason: "stale-source" }]);
});

test("derived input is exact-bound and bounded census ignores reservation slots", async (t) => {
  const { store } = await approvedStore(t);
  const bytes = Buffer.from(`${JSON.stringify({ schemaVersion: 1, sourceTreeSha256: "b".repeat(64), entries: [] })}\n`);
  const mismatch = await publishMemoryIndexGeneration({ store, indexBytes: bytes, sourceTreeSha256: "a".repeat(64) });
  assert.equal(mismatch.complete, false);
  const view = await publishMemoryViewGeneration({ store, sourceTreeSha256: "a".repeat(64), viewBytes: Buffer.from("# view\n") });
  assert.equal(view.complete, true);
  await mkdir(path.join(store.root, "v1", "derived", ".reservations", "nested"), { recursive: true });
  const census = await scanDerivedGenerations({ store });
  assert.equal(census.complete, true);
});

test("lowered runtime limits and view UTF-8/hash contracts reject before reservation", async (t) => {
  const { root, store } = await approvedStore(t); const rebuilt = await rebuildMemoryIndex({ workspaceRoot: root, config });
  const twoEntries = { ...rebuilt.index, entries: [rebuilt.index.entries[0], { ...rebuilt.index.entries[0], memoryId: "memory-z" }] };
  const index = await publishMemoryIndexGeneration({ store, sourceTreeSha256: rebuilt.sourceTreeSha256, indexBytes: Buffer.from(`${JSON.stringify(twoEntries)}\n`), limits: { maxIndexEntries: 1 } });
  assert.equal(index.complete, false);
  for (const input of [
    { sourceTreeSha256: "not-a-hash", viewBytes: Buffer.from("# view\n") },
    { sourceTreeSha256: "a".repeat(64), viewBytes: Buffer.from([0xff, 0x0a]) },
  ]) assert.equal((await publishMemoryViewGeneration({ store, ...input })).complete, false);
});

test("disabled output never echoes an oversized request field", async () => {
  const result = await retrieveApprovedDesignMemory({ workspaceRoot: "/must-not-be-read", config, requestContext: { ...context, disabledForRequest: true, projectId: "x".repeat(70_000) } });
  assert.equal(Buffer.byteLength(JSON.stringify(result), "utf8") <= 64 * 1024, true);
  assert.equal(result.projectId, null);
});

test("derived root symlink, BOM publisher, and hostile Markdown loader all fail closed", async (t) => {
  const { store } = await approvedStore(t); const hash = "a".repeat(64);
  const first = await publishMemoryViewGeneration({ store, sourceTreeSha256: hash, viewBytes: Buffer.from("# view\n") });
  assert.equal(first.complete, true);
  for (const bytes of [Buffer.from([0xef, 0xbb, 0xbf, 0x23, 0x0a]), Buffer.from([0xff, 0x0a])]) {
    const rejected = await publishMemoryViewGeneration({ store, sourceTreeSha256: hash, viewBytes: bytes }); assert.equal(rejected.complete, false);
  }
  await writeFile(path.join(store.root, "v1", "derived", first.generationPath), Buffer.from([0xff, 0x0a]));
  const hostile = await loadMemoryView({ store, sourceTreeSha256: hash, viewSha256: first.generationSha256 });
  assert.equal(hostile.status, "corrupt");
  await rm(path.join(store.root, "v1", "derived"), { recursive: true }); const outside = await workspace(t); await mkdir(path.join(outside, "derived")); await symlink(path.join(outside, "derived"), path.join(store.root, "v1", "derived"));
  const scan = await scanDerivedGenerations({ store }); assert.equal(scan.complete, false); assert.deepEqual(scan.entries, []);
});

test("lowered receipt loader limit rejects an otherwise canonical history", async (t) => {
  const { store } = await approvedStore(t); const requestSha256 = "a".repeat(64);
  const base = { schemaVersion: 1, requestSha256, sourceTreeSha256: "b".repeat(64), projectId: "wind-island", lane: "studio", policy: { scope: "project", maxItems: 5, candidateTtlDays: 30 }, observations: [
    { memoryId: "memory-a", artifactId: "artifact-a", locator: "a.md#x", expectedSha256: "c".repeat(64), observedSha256: "c".repeat(64), status: "current" },
    { memoryId: "memory-b", artifactId: "artifact-b", locator: "b.md#x", expectedSha256: "c".repeat(64), observedSha256: "c".repeat(64), status: "current" },
  ], applied: [], excluded: [] };
  const bytes = Buffer.from(`${JSON.stringify(base)}\n`); const published = await publishMemoryReceiptGeneration({ store, requestSha256, receiptBytes: bytes }); assert.equal(published.complete, true);
  const loaded = await loadMemoryReceipt({ store, requestSha256, receiptSha256: published.receiptSha256, limits: { maxReceiptObservationItems: 1 } });
  assert.equal(loaded.status, "corrupt");
});
