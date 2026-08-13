import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { link, lstat, mkdir, mkdtemp, opendir, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { captureDesignMemory } from "../../shared/scripts/capture-design-memory.mjs";
import { issueCaptureClassificationReceipt, issueMaintenanceHumanReceipt } from "../../shared/scripts/lib/design-memory-capabilities.mjs";
import { appendMemoryEvent, foldMemoryEvents, memoryEventRelativePath, resolveMemoryStore, scanMemoryEvents } from "../../shared/scripts/lib/safe-memory-store.mjs";
import { maintainDesignMemory } from "../../shared/scripts/maintain-design-memory.mjs";
import { rebuildMemoryIndex } from "../../shared/scripts/retrieve-design-memory.mjs";
import { canonicalMemoryEventDocument, memoryOperationId, parseMemoryEventDocument } from "../../shared/scripts/validate-design-memory.mjs";

const config = { enabled: true, scope: "project", projectId: "wind-island", candidateTtlDays: 30, maxItems: 5, gitMode: "tracked" };
const captureTime = new Date("2026-08-01T00:00:00Z");
async function workspace(t) { const root = await realpath(await mkdtemp(path.join(tmpdir(), "memory-maintain-"))); t.after(() => rm(root, { recursive: true, force: true })); return root; }
function digest(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
function eventFixture(bytes, overrides = {}) {
  return { eventId: "playtest-1", type: "playtest-finding", summary: "반격 수단이 없다.", applicability: "보스전", exclusions: "퍼즐", artifactTypes: ["combat"], relatedIds: ["boss"], tags: ["counterplay"], actor: "author", sources: [{ artifact_id: "artifact", locator: "evidence.yml#x", sha256: digest(bytes) }], ...overrides };
}
function captureReceipt(event, now = captureTime) { return issueCaptureClassificationReceipt({ projectId: "wind-island", lane: "studio", scope: "project", candidateTtlDays: 30, event, classification: { classification: "durable-finding" }, now }); }
async function captured(t, { now = captureTime, eventOverrides = {} } = {}) {
  const root = await workspace(t); await mkdir(path.join(root, "artifact")); const bytes = Buffer.from("evidence\n"); await writeFile(path.join(root, "artifact", "evidence.yml"), bytes);
  const event = eventFixture(bytes, eventOverrides); const classificationReceipt = captureReceipt(event, now);
  const capture = await captureDesignMemory({ workspaceRoot: root, config, projectId: "wind-island", lane: "studio", now, event, classificationReceipt });
  return { root, capture, event };
}
function humanReceipt({ action, memoryId, actor = "reviewer", reason = "reviewed", observedParentEventIds, chosenParentEventId, now }) {
  return issueMaintenanceHumanReceipt({ projectId: "wind-island", scope: "project", action, ...(memoryId === undefined ? {} : { memoryId }), actor, reason, observedParentEventIds, ...(chosenParentEventId === undefined ? {} : { chosenParentEventId }), now });
}
async function mutate({ root, action, memoryId, observedParentEventIds, chosenParentEventId, actor = "reviewer", reason = "reviewed", now, humanReceipt: receipt }) {
  const humanReceiptValue = receipt ?? humanReceipt({ action, memoryId, actor, reason, observedParentEventIds, chosenParentEventId, now });
  return maintainDesignMemory({ workspaceRoot: root, config, action, memoryId, actor, reason, observedParentEventIds, chosenParentEventId, now, humanReceipt: humanReceiptValue });
}
async function filesystemSnapshot(root) {
  const result = [];
  async function visit(directory, relative = "") {
    let handle;
    try { handle = await opendir(directory); } catch (error) { if (error?.code === "ENOENT") return; throw error; }
    try {
      for await (const entry of handle) {
        const relativePath = relative ? `${relative}/${entry.name}` : entry.name; const candidate = path.join(directory, entry.name); const stat = await lstat(candidate);
        const type = stat.isFile() ? "file" : stat.isDirectory() ? "directory" : stat.isSymbolicLink() ? "symlink" : "special";
        result.push({ relativePath, type, sha256: type === "file" ? digest(await readFile(candidate)) : null });
        if (type === "directory") await visit(candidate, relativePath);
      }
    } finally { await handle.close().catch(() => {}); }
  }
  await visit(root);
  return result.sort((left, right) => Buffer.compare(Buffer.from(left.relativePath, "utf8"), Buffer.from(right.relativePath, "utf8")));
}
async function sourceTreeSnapshot(store) {
  const root = path.join(store.root, "v1"); const result = [];
  async function visit(directory, relative = "") {
    let handle; try { handle = await opendir(directory); } catch (error) { if (error?.code === "ENOENT") return; throw error; }
    try {
      for await (const entry of handle) {
        if (!relative && entry.name === "derived") continue;
        const next = relative ? `${relative}/${entry.name}` : entry.name; const candidate = path.join(directory, entry.name);
        if (entry.isDirectory() && !entry.isSymbolicLink()) await visit(candidate, next);
        else result.push([next, entry.isFile() ? digest(await readFile(candidate)) : "non-file"]);
      }
    } finally { await handle.close().catch(() => {}); }
  }
  await visit(root); return result.sort((left, right) => left[0].localeCompare(right[0]));
}
async function appendStatus(store, parentEventId, status, effectiveAt) {
  const scan = await scanMemoryEvents({ store }); const parent = scan.events.find((item) => item.eventId === parentEventId); assert.ok(parent);
  const record = { ...parent.record, status, updated_at: effectiveAt, ...(status === "approved" ? { approved_by: "reviewer", approval_basis: "human-review" } : {}) };
  const event = { schema_version: 1, event_type: "transition", action: status, memory_id: parent.memoryId, parent_event_ids: [parent.eventId], effective_at: effectiveAt, actor: "reviewer", reason: status, record };
  event.operation_id = memoryOperationId(event);
  return appendMemoryEvent({ store, eventDocument: canonicalMemoryEventDocument(event, parent.sections) });
}
async function logDocuments(store) {
  const root = path.join(store.root, "v1", "derived", "logs"); const files = [];
  async function visit(directory) { let handle; try { handle = await opendir(directory); } catch (error) { if (error?.code === "ENOENT") return; throw error; } try { for await (const entry of handle) { const candidate = path.join(directory, entry.name); if (entry.isDirectory()) await visit(candidate); else if (entry.isFile() && entry.name.endsWith(".md")) files.push(await readFile(candidate, "utf8")); } } finally { await handle.close().catch(() => {}); } }
  await visit(root); return files;
}
async function sealEventFixture(store, eventDocument) {
  const bytes = Buffer.from(eventDocument); const eventId = `mev1-${digest(bytes)}`; const relativePath = memoryEventRelativePath({ memoryId: parseMemoryEventDocument(eventDocument).event.memory_id, eventId });
  const value = digest(eventId); const instanceId = `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20, 32)}`; const base = path.join(store.root, relativePath);
  await mkdir(path.join(base, "instances"), { recursive: true }); await mkdir(path.join(base, "claims"), { recursive: true }); await writeFile(path.join(base, "instances", `${instanceId}.md`), bytes);
  const claimPath = path.join(base, "claims", `${instanceId}.json`); await writeFile(claimPath, `${JSON.stringify({ schemaVersion: 1, eventId, instanceId, fileSha256: digest(bytes), byteLength: bytes.byteLength })}\n`); await link(claimPath, path.join(base, "commit.json")); return { eventId, relativePath };
}

test("verified candidate with an exact human receipt is the only direct approval path and exact retry is present", async (t) => {
  const { root, capture } = await captured(t); const verifyAt = new Date("2026-08-02T00:00:00Z");
  await assert.rejects(() => mutate({ root, action: "approve", memoryId: capture.memoryId, observedParentEventIds: [capture.eventId], now: verifyAt }), (error) => error?.code === "memory.maintenance");
  const verified = await mutate({ root, action: "verify", memoryId: capture.memoryId, observedParentEventIds: [capture.eventId], reason: "sources current", now: verifyAt });
  const approveAt = new Date("2026-08-03T00:00:00Z"); const request = { root, action: "approve", memoryId: capture.memoryId, observedParentEventIds: [verified.eventId], reason: "human review", now: approveAt };
  await assert.rejects(() => maintainDesignMemory({ workspaceRoot: root, config, ...request, actor: "reviewer" }), (error) => error?.code === "memory.human_authority_required");
  const receipt = humanReceipt({ action: "approve", memoryId: capture.memoryId, actor: "reviewer", reason: "human review", observedParentEventIds: [verified.eventId], now: approveAt });
  const approved = await mutate({ ...request, humanReceipt: receipt }); const retry = await mutate({ ...request, humanReceipt: receipt });
  assert.equal(approved.status, "created"); assert.equal(retry.status, "present");
  assert.equal(foldMemoryEvents(await scanMemoryEvents({ store: capture.store })).memories.get(capture.memoryId).record.status, "approved");
});

test("verify rejects every non-candidate status without event or source-tree growth", async (t) => {
  for (const [status, chain] of [
    ["expired", ["expired"]],
    ["disputed", ["disputed"]],
    ["stale", ["verified", "approved", "stale"]],
    ["rejected", ["rejected"]],
    ["superseded", ["verified", "approved", "superseded"]],
    ["verified", ["verified"]],
  ]) {
    const { root, capture } = await captured(t, { eventOverrides: { eventId: `playtest-${status}` } }); let head = capture.eventId;
    for (const [index, next] of chain.entries()) head = (await appendStatus(capture.store, head, next, `2026-08-${String(index + 2).padStart(2, "0")}T00:00:00.000Z`)).eventId;
    const before = await sourceTreeSnapshot(capture.store);
    await assert.rejects(
      () => mutate({ root, action: "verify", memoryId: capture.memoryId, observedParentEventIds: [head], reason: "must remain terminal", now: new Date("2026-09-01T00:00:00Z") }),
      (error) => error?.code === "memory.maintenance",
      status,
    );
    assert.deepEqual(await sourceTreeSnapshot(capture.store), before, status);
    const folded = foldMemoryEvents(await scanMemoryEvents({ store: capture.store })); assert.equal(folded.memories.get(capture.memoryId).record.status, status);
  }
});

test("maintenance rejects copied authority and every request-field mutation before append", async (t) => {
  const { root, capture } = await captured(t); const now = new Date("2026-08-02T00:00:00Z"); const base = { workspaceRoot: root, config, action: "verify", memoryId: capture.memoryId, actor: "reviewer", reason: "sources current", observedParentEventIds: [capture.eventId], now };
  const receipt = humanReceipt(base); const before = (await scanMemoryEvents({ store: capture.store })).events.length;
  for (const humanReceiptValue of [{ ...receipt }, JSON.parse(JSON.stringify(receipt)), structuredClone(receipt), new Proxy(receipt, {})]) await assert.rejects(() => maintainDesignMemory({ ...base, humanReceipt: humanReceiptValue }), (error) => error?.code === "memory.human_authority_required");
  for (const overrides of [{ actor: "other" }, { reason: "other" }, { action: "reject" }, { memoryId: "memory-other" }, { now: new Date("2026-08-02T00:00:01Z") }, { observedParentEventIds: [`mev1-${"a".repeat(64)}`] }, { chosenParentEventId: capture.eventId }, { config: { ...config, scope: "workspace" } }]) {
    await assert.rejects(() => maintainDesignMemory({ ...base, ...overrides, humanReceipt: receipt }), (error) => error?.code === "memory.human_authority_required");
  }
  assert.equal((await scanMemoryEvents({ store: capture.store })).events.length, before);
});

test("verify refuses source drift", async (t) => {
  const { root, capture } = await captured(t); await writeFile(path.join(root, "artifact", "evidence.yml"), "changed confidential bytes\n");
  await assert.rejects(() => mutate({ root, action: "verify", memoryId: capture.memoryId, observedParentEventIds: [capture.eventId], reason: "check", now: new Date("2026-08-02T00:00:00Z") }), (error) => error?.code === "memory.maintenance");
});

test("lint reports source drift with the exact safe diagnostic shape", async (t) => {
  const { root, capture } = await captured(t); await writeFile(path.join(root, "artifact", "evidence.yml"), "changed confidential bytes\n");
  const linted = await maintainDesignMemory({ workspaceRoot: root, config, action: "lint" });
  assert.deepEqual(linted.diagnostics, [{ code: "memory.stale_source", memory_id: capture.memoryId }]);
});

test("lint leaves drift workspace and store bytes unchanged", async (t) => {
  const { root, capture } = await captured(t); await writeFile(path.join(root, "artifact", "evidence.yml"), "changed confidential bytes\n");
  const workspaceBefore = await filesystemSnapshot(root); const storeBefore = await filesystemSnapshot(capture.store.root);
  await maintainDesignMemory({ workspaceRoot: root, config, action: "lint" });
  assert.deepEqual(await filesystemSnapshot(root), workspaceBefore);
  assert.deepEqual(await filesystemSnapshot(capture.store.root), storeBefore);
});

test("lint reports missing, unreadable, and symlink evidence with the exact safe orphan diagnostic shape", async (t) => {
  for (const mode of ["missing", "unreadable", "symlink"]) {
    const { root, capture } = await captured(t, { eventOverrides: { eventId: `playtest-${mode}` } }); const evidence = path.join(root, "artifact", "evidence.yml");
    await rm(evidence);
    if (mode === "symlink") { const target = path.join(root, "private-evidence.txt"); await writeFile(target, "private evidence bytes\n"); await symlink(target, evidence); }
    if (mode === "unreadable") await mkdir(evidence);
    const linted = await maintainDesignMemory({ workspaceRoot: root, config, action: "lint" });
    assert.deepEqual(linted.diagnostics, [{ code: "memory.orphan_source", memory_id: capture.memoryId }], mode);
  }
});

test("lint leaves missing, unreadable, and symlink workspaces and stores unchanged", async (t) => {
  for (const mode of ["missing", "unreadable", "symlink"]) {
    const { root, capture } = await captured(t, { eventOverrides: { eventId: `playtest-no-write-${mode}` } }); const evidence = path.join(root, "artifact", "evidence.yml");
    await rm(evidence);
    if (mode === "symlink") { const target = path.join(root, "private-evidence.txt"); await writeFile(target, "private evidence bytes\n"); await symlink(target, evidence); }
    if (mode === "unreadable") await mkdir(evidence);
    const workspaceBefore = await filesystemSnapshot(root); const storeBefore = await filesystemSnapshot(capture.store.root);
    await maintainDesignMemory({ workspaceRoot: root, config, action: "lint" });
    assert.deepEqual(await filesystemSnapshot(root), workspaceBefore, mode);
    assert.deepEqual(await filesystemSnapshot(capture.store.root), storeBefore, mode);
  }
});

test("sweep expires candidates and retire maps candidate and approved records without rewriting source events", async (t) => {
  const first = await captured(t); const sweepAt = new Date("2026-10-02T00:00:00Z");
  const sweepReceipt = humanReceipt({ action: "sweep", observedParentEventIds: [first.capture.eventId], reason: "scheduled review", now: sweepAt }); const sweepRequest = { root: first.root, action: "sweep", observedParentEventIds: [first.capture.eventId], reason: "scheduled review", now: sweepAt, humanReceipt: sweepReceipt };
  const swept = await mutate(sweepRequest); const sweepRetry = await mutate(sweepRequest);
  assert.equal(swept.changed.length, 1); assert.equal(sweepRetry.changed[0].status, "present"); assert.equal(foldMemoryEvents(await scanMemoryEvents({ store: first.capture.store })).memories.get(first.capture.memoryId).record.status, "expired");

  const second = await captured(t, { eventOverrides: { eventId: "playtest-2" } }); const retiredCandidate = await mutate({ root: second.root, action: "retire", memoryId: second.capture.memoryId, observedParentEventIds: [second.capture.eventId], now: new Date("2026-08-02T00:00:00Z") });
  assert.equal((await scanMemoryEvents({ store: second.capture.store })).events.find((item) => item.eventId === retiredCandidate.eventId).record.status, "rejected");
  const third = await captured(t, { eventOverrides: { eventId: "playtest-3" } });
  const verified = await mutate({ root: third.root, action: "verify", memoryId: third.capture.memoryId, observedParentEventIds: [third.capture.eventId], now: new Date("2026-08-02T00:00:00Z") });
  const approved = await mutate({ root: third.root, action: "approve", memoryId: third.capture.memoryId, observedParentEventIds: [verified.eventId], now: new Date("2026-08-03T00:00:00Z") });
  const retiredApproved = await mutate({ root: third.root, action: "retire", memoryId: third.capture.memoryId, observedParentEventIds: [approved.eventId], now: new Date("2026-08-04T00:00:00Z") });
  assert.equal((await scanMemoryEvents({ store: third.capture.store })).events.find((item) => item.eventId === retiredApproved.eventId).record.status, "superseded");
});

test("safe absent list and lint are empty read-only results while unsafe and incomplete stores fail closed", async (t) => {
  const root = await workspace(t); const before = await filesystemSnapshot(root);
  assert.deepEqual(await maintainDesignMemory({ workspaceRoot: root, config, action: "list" }), { status: "ready", memories: [], diagnostics: [] });
  assert.deepEqual(await maintainDesignMemory({ workspaceRoot: root, config, action: "lint" }), { status: "ready", memories: [], diagnostics: [] });
  assert.deepEqual(await filesystemSnapshot(root), before);
  const outside = path.join(root, "outside"); await mkdir(outside); await symlink(outside, path.join(root, ".game-design"));
  await assert.rejects(() => maintainDesignMemory({ workspaceRoot: root, config, action: "list" }), (error) => error?.code === "memory.unsafe_path");

  const corrupt = await captured(t); await writeFile(path.join(corrupt.capture.store.root, corrupt.capture.relativePath, "commit.json"), "broken\n");
  await assert.rejects(() => maintainDesignMemory({ workspaceRoot: corrupt.root, config, action: "lint" }), (error) => error?.code === "memory.scan_incomplete");
});

test("quarantine permanently excludes a memory and publishes exact source-time log bytes", async (t) => {
  const { root, capture } = await captured(t); const at = new Date("2026-08-02T00:00:00Z");
  const quarantined = await mutate({ root, action: "quarantine", memoryId: capture.memoryId, observedParentEventIds: [capture.eventId], reason: "unsafe", now: at });
  const scan = await scanMemoryEvents({ store: capture.store }); assert.equal(foldMemoryEvents(scan).memories.has(capture.memoryId), false);
  const marker = scan.quarantines[0];
  const expected = `# design-memory\n${captureTime.toISOString()} event ${capture.eventId} ${capture.memoryId} capture candidate\n${at.toISOString()} quarantine ${marker.markerId} ${capture.memoryId} quarantine quarantined\n`;
  const logs = await logDocuments(capture.store); assert.equal(logs.includes(expected), true, logs.join("\n---\n"));
  assert.equal(expected.includes("reviewer"), false); assert.equal(expected.includes("unsafe"), false); assert.equal(quarantined.warnings.length, 0);
});

test("transition logs use source effective times and exact safe fields", async (t) => {
  const { root, capture } = await captured(t); const at = new Date("2026-08-02T00:00:00Z");
  const verified = await mutate({ root, action: "verify", memoryId: capture.memoryId, observedParentEventIds: [capture.eventId], reason: "sources current", now: at });
  const expected = `# design-memory\n${captureTime.toISOString()} event ${capture.eventId} ${capture.memoryId} capture candidate\n${at.toISOString()} event ${verified.eventId} ${capture.memoryId} verified verified\n`;
  assert.equal((await logDocuments(capture.store)).includes(expected), true);
  assert.equal(expected.includes("reviewer"), false); assert.equal(expected.includes("sources current"), false); assert.equal(expected.includes(root), false);
});

test("resolution with an exact live receipt is idempotent", async (t) => {
  const { root, capture } = await captured(t); const source = (await scanMemoryEvents({ store: capture.store })).events[0];
  const makeTransition = (status, effectiveAt) => { const record = { ...source.record, status, updated_at: effectiveAt }; const event = { schema_version: 1, event_type: "transition", action: status, memory_id: capture.memoryId, parent_event_ids: [capture.eventId], effective_at: effectiveAt, actor: "reviewer", reason: status, record }; event.operation_id = memoryOperationId(event); return canonicalMemoryEventDocument(event, source.sections); };
  const left = await sealEventFixture(capture.store, makeTransition("verified", "2026-08-02T00:00:00.000Z")); const right = await sealEventFixture(capture.store, makeTransition("rejected", "2026-08-02T01:00:00.000Z"));
  const observedParentEventIds = [left.eventId, right.eventId].sort(); const chosenParentEventId = left.eventId; const now = new Date("2026-08-03T00:00:00Z");
  const receipt = humanReceipt({ action: "resolution", memoryId: capture.memoryId, actor: "reviewer", reason: "choose verified", observedParentEventIds, chosenParentEventId, now });
  const request = { root, action: "resolution", memoryId: capture.memoryId, actor: "reviewer", reason: "choose verified", observedParentEventIds, chosenParentEventId, now, humanReceipt: receipt };
  const first = await mutate(request); const retry = await mutate(request); assert.equal(first.status, "created"); assert.equal(retry.status, "present");
});

test("sweep marks an approved external note stale after its review date", async (t) => {
  const root = await workspace(t); await mkdir(path.join(root, "artifact")); const bytes = Buffer.from("external evidence\n"); await writeFile(path.join(root, "artifact", "note.md"), bytes);
  const store = await resolveMemoryStore({ workspaceRoot: root, config, platform: process.platform, home: root, initialize: true }); const effectiveAt = "2026-08-01T00:00:00.000Z";
  const record = { schema_version: 1, memory_id: "memory-studio-external-note-abc", kind: "external-note", lane: "studio", status: "approved", scope: "project", project_id: "wind-island", created_at: effectiveAt, updated_at: effectiveAt, review_after: "2026-08-31", expires_at: "2027-08-01", approved_by: "reviewer", approval_basis: "human-review", supersedes: null, artifact_types: ["combat"], related_ids: [], tags: ["external"], sources: [{ artifact_id: "artifact", locator: "note.md#x", sha256: digest(bytes) }] };
  const event = { schema_version: 1, event_type: "capture", action: "capture", memory_id: record.memory_id, operation_id: "external-note-1", parent_event_ids: [], effective_at: effectiveAt, actor: "reviewer", reason: "capture", record }; const sections = { "발견한 내용": "외부 자료에서 확인한 내용", "적용 조건": "자료가 최신인 경우", "적용하면 안 되는 경우": "자료가 만료된 경우", "근거": "artifact/note.md#x" };
  const capturedExternal = await appendMemoryEvent({ store, eventDocument: canonicalMemoryEventDocument(event, sections) });
  const result = await mutate({ root, action: "sweep", observedParentEventIds: [capturedExternal.eventId], reason: "scheduled review", now: new Date("2026-09-01T00:00:00Z") }); assert.equal(result.changed.length, 1);
  assert.equal(foldMemoryEvents(await scanMemoryEvents({ store })).memories.get(record.memory_id).record.status, "stale");
});

test("Node-only local git metadata writes one idempotent exclusion marker and preserves lock warnings", async (t) => {
  const root = await workspace(t); const exclude = path.join(root, ".git", "info", "exclude");
  await mkdir(path.dirname(exclude), { recursive: true }); await writeFile(exclude, "existing rule\n");
  const local = { ...config, gitMode: "local" };
  assert.deepEqual(await maintainDesignMemory({ workspaceRoot: root, config: local, action: "sync-git-exclusion" }), { status: "ready" });
  const first = await readFile(exclude);
  assert.equal(first.toString("utf8"), "existing rule\n# game-design-plugin:memory:begin\n.game-design/memory/\n# game-design-plugin:memory:end\n");
  assert.deepEqual(await maintainDesignMemory({ workspaceRoot: root, config: local, action: "sync-git-exclusion" }), { status: "ready" });
  assert.deepEqual(await readFile(exclude), first);
  await writeFile(`${exclude}.game-design-memory-exclude.lock`, "stale\n");
  assert.deepEqual(await maintainDesignMemory({ workspaceRoot: root, config: local, action: "sync-git-exclusion" }), { status: "warning", code: "memory.git_exclude_lock" });
  assert.deepEqual(await readFile(exclude), first);
  assert.deepEqual(await maintainDesignMemory({ workspaceRoot: root, config, action: "sync-git-exclusion" }), { status: "skipped" });
});

test("Node-only linked worktree gitdir resolves its common info exclude", async (t) => {
  const root = await workspace(t); const gitDir = path.join(root, "git-common", "worktrees", "memory-maintain"); const common = path.join(root, "git-common");
  await mkdir(gitDir, { recursive: true }); await mkdir(path.join(common, "info"), { recursive: true });
  await writeFile(path.join(root, ".git"), "gitdir: git-common/worktrees/memory-maintain\n");
  await writeFile(path.join(gitDir, "commondir"), "../..\n");
  const result = await maintainDesignMemory({ workspaceRoot: root, config: { ...config, gitMode: "local" }, action: "sync-git-exclusion" });
  assert.deepEqual(result, { status: "ready" });
  assert.match(await readFile(path.join(common, "info", "exclude"), "utf8"), /# game-design-plugin:memory:begin/u);
});

test("unsafe or malformed git metadata warns without creating memory or exclude files", async (t) => {
  for (const [name, createMetadata] of [
    ["missing git metadata", async () => {}],
    ["malformed gitdir", async (root) => writeFile(path.join(root, ".git"), "gitdir: ../metadata\r\n")],
    ["missing gitdir target", async (root) => writeFile(path.join(root, ".git"), "gitdir: ../metadata\n")],
    ["escaped common directory", async (root) => { await mkdir(path.join(root, "metadata")); await mkdir(path.join(root, "outside")); await writeFile(path.join(root, ".git"), "gitdir: metadata\n"); return writeFile(path.join(root, "metadata", "commondir"), "../outside\n"); }],
    ["non-worktrees gitdir layout", async (root) => { const common = path.join(root, "git-common"); await mkdir(path.join(common, "other", "memory-maintain"), { recursive: true }); await writeFile(path.join(root, ".git"), "gitdir: git-common/other/memory-maintain\n"); return writeFile(path.join(common, "other", "memory-maintain", "commondir"), "../..\n"); }],
    ["unsafe gitdir symlink", async (root) => symlink(path.join(root, "outside"), path.join(root, ".git"))],
  ]) await t.test(name, async (t) => {
    const root = await workspace(t); await createMetadata(root);
    assert.deepEqual(
      await maintainDesignMemory({ workspaceRoot: root, config: { ...config, gitMode: "local" }, action: "sync-git-exclusion" }),
      { status: "warning", code: "memory.git_metadata" },
    );
    await assert.rejects(() => lstat(path.join(root, ".game-design")), /ENOENT/);
    await assert.rejects(() => lstat(path.join(root, ".git", "info", "exclude")), /ENOENT|ENOTDIR/);
    if (name === "escaped common directory") await assert.rejects(() => lstat(path.join(root, "outside", "info", "exclude")), /ENOENT/);
    if (name === "non-worktrees gitdir layout") await assert.rejects(() => lstat(path.join(root, "git-common", "info", "exclude")), /ENOENT/);
  });
});

test("log publication failure preserves the already appended source transition", async (t) => {
  const { root, capture } = await captured(t); const logsRoot = path.join(capture.store.root, "v1", "derived", "logs");
  await rm(logsRoot, { recursive: true, force: true }); await symlink(path.join(root, "artifact"), logsRoot);
  const result = await mutate({ root, action: "verify", memoryId: capture.memoryId, observedParentEventIds: [capture.eventId], now: new Date("2026-08-02T00:00:00Z") });
  assert.equal(result.status, "created"); assert.equal(result.warnings.length > 0, true, JSON.stringify(result.warnings));
  assert.equal((await scanMemoryEvents({ store: capture.store })).events.length, 2);
});

test("list is conflict-aware and rebuild is byte-identical to the direct Task 3 result", async (t) => {
  const { root, capture } = await captured(t); const listed = await maintainDesignMemory({ workspaceRoot: root, config, action: "list" });
  assert.deepEqual(listed.memories[0].headEventIds, [capture.eventId]);
  const rebuilt = await maintainDesignMemory({ workspaceRoot: root, config, action: "rebuild", now: new Date("2026-08-03T00:00:00Z") }); const direct = await rebuildMemoryIndex({ workspaceRoot: root, config, now: new Date("2026-08-03T00:00:00Z") });
  assert.equal(rebuilt.complete, true); assert.deepEqual(rebuilt.bytes, direct.bytes);
});

test("maintenance CLI denies JSON-only mutations with one safe error object", async (t) => {
  const root = await workspace(t); const child = spawn(process.execPath, ["shared/scripts/maintain-design-memory.mjs"], { cwd: process.cwd(), stdio: ["pipe", "pipe", "pipe"] });
  const stdout = []; const stderr = []; child.stdout.on("data", (chunk) => stdout.push(chunk)); child.stderr.on("data", (chunk) => stderr.push(chunk));
  child.stdin.end(`${JSON.stringify({ workspaceRoot: root, config, action: "approve", memoryId: "memory-safe", actor: "human", reason: "body must not echo", observedParentEventIds: [`mev1-${"a".repeat(64)}`], now: "2026-08-03T00:00:00Z", humanReceipt: {} })}\n`);
  const code = await new Promise((resolve) => child.once("close", resolve)); const output = Buffer.concat(stdout).toString("utf8");
  assert.equal(code, 1, Buffer.concat(stderr).toString("utf8")); assert.match(output, /^\{[^\n]+\}\n$/u); assert.deepEqual(JSON.parse(output), { code: "memory.human_authority_required", memoryId: "memory-safe" });
  assert.equal(output.includes(root), false); assert.equal(output.includes("body must not echo"), false);
});

test("maintenance command does not re-export capability issuers", async () => {
  const command = await import("../../shared/scripts/maintain-design-memory.mjs");
  assert.equal(Object.hasOwn(command, "issueMaintenanceHumanReceipt"), false);
});
