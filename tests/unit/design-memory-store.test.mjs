import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { link, lstat, mkdtemp, mkdir, opendir, readFile, realpath, rename, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { canonicalMemoryEventDocument, canonicalQuarantineMarkerDocument, memoryOperationId } from "../../shared/scripts/validate-design-memory.mjs";
import { appendMemoryEvent, appendQuarantineMarker, ensureMemoryGitExclusion, foldMemoryEvents, memoryEventRelativePath, readMemoryFile, resolveMemoryStore, scanMemoryEvents, stageImmutableMemoryFile } from "../../shared/scripts/lib/safe-memory-store.mjs";

async function workspace(t) { const root = await realpath(await mkdtemp(path.join(tmpdir(), "memory-store-"))); t.after(() => rm(root, { recursive: true, force: true })); return root; }
const config = (overrides = {}) => ({ enabled: true, scope: "project", gitMode: "local", projectId: "wind-island", ...overrides });
const record = { schema_version: 1, memory_id: "memory-studio-design-lesson-0f2a4c61d9ab34ef", kind: "design-lesson", lane: "studio", status: "candidate", scope: "project", project_id: "wind-island", created_at: "2026-08-12T00:00:00.000Z", updated_at: "2026-08-12T00:00:00.000Z", review_after: "2026-09-11", expires_at: "2026-09-11", approved_by: null, approval_basis: null, supersedes: null, artifact_types: ["artifact"], related_ids: ["related"], tags: ["tag"], sources: [{ artifact_id: "source", locator: "content.md#h", sha256: "a".repeat(64) }] };
const sections = { "발견한 내용": "내용", "적용 조건": "조건", "적용하면 안 되는 경우": "제외", "근거": "근거" };
const document = (overrides = {}) => canonicalMemoryEventDocument({ schema_version: 1, event_type: "capture", action: "capture", memory_id: record.memory_id, operation_id: "capture-upstream-1", parent_event_ids: [], effective_at: "2026-08-12T00:00:00.000Z", actor: "author", reason: "capture", record, ...overrides }, sections);
function transitionDocument(parentEventId, action, effectiveAt) {
  const event = { schema_version: 1, event_type: "transition", action, memory_id: record.memory_id, parent_event_ids: [parentEventId], effective_at: effectiveAt, actor: "reviewer", reason: action, record: { ...record, status: action, updated_at: effectiveAt, ...(action === "approved" ? { approved_by: "reviewer", approval_basis: "review" } : {}) } };
  return canonicalMemoryEventDocument({ ...event, operation_id: memoryOperationId(event) }, sections);
}
function resolutionDocument(parentEventIds, chosenParentEventId, chosenRecord, effectiveAt = "2026-08-12T04:00:00.000Z") {
  const event = { schema_version: 1, event_type: "resolution", action: "resolution", memory_id: record.memory_id, parent_event_ids: [...parentEventIds].sort(), chosen_parent_event_id: chosenParentEventId, effective_at: effectiveAt, actor: "resolver", reason: "resolution", record: chosenRecord };
  return canonicalMemoryEventDocument({ ...event, operation_id: memoryOperationId(event) }, sections);
}
async function sealMarkerForTest(store, marker, physicalTarget = marker) {
  const bytes = Buffer.from(canonicalQuarantineMarkerDocument(marker)); const markerId = `qmv1-${createHash("sha256").update(bytes).digest("hex")}`; const instanceHash = createHash("sha256").update(markerId).digest("hex"); const instanceId = `${instanceHash.slice(0, 8)}-${instanceHash.slice(8, 12)}-${instanceHash.slice(12, 16)}-${instanceHash.slice(16, 20)}-${instanceHash.slice(20, 32)}`;
  const relativePath = `v1/controls/quarantine/${createHash("sha256").update(physicalTarget.memory_id).digest("hex").slice(0, 2)}/${physicalTarget.target_event_id}/${markerId}`; const base = path.join(store.root, relativePath);
  await mkdir(path.join(base, "instances"), { recursive: true }); await mkdir(path.join(base, "claims"), { recursive: true }); await writeFile(path.join(base, "instances", `${instanceId}.md`), bytes);
  const claimPath = path.join(base, "claims", `${instanceId}.json`); await writeFile(claimPath, `${JSON.stringify({ schemaVersion: 1, eventId: markerId, instanceId, fileSha256: createHash("sha256").update(bytes).digest("hex"), byteLength: bytes.byteLength })}\n`); await link(claimPath, path.join(base, "commit.json"));
}
function assertClosedScan(scan, memoryId, code) {
  const fold = foldMemoryEvents(scan);
  assert.equal(scan.complete, false); assert.deepEqual(scan.events, []); assert.deepEqual(scan.quarantines, []); assert.equal(fold.memories.has(memoryId), false); assert.equal(scan.diagnostics.some((item) => item.code === code), true);
}
function digest(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
function sealedInstanceId(eventId) { const value = digest(eventId); return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20, 32)}`; }
async function sealCommittedForTest(store, { relativePath, eventId, bytes, persistedClaim } = {}) {
  const base = path.join(store.root, relativePath); const instanceId = sealedInstanceId(eventId); const claim = { schemaVersion: 1, eventId, instanceId, fileSha256: digest(bytes), byteLength: bytes.byteLength };
  await mkdir(path.join(base, "instances"), { recursive: true }); await mkdir(path.join(base, "claims"), { recursive: true }); await writeFile(path.join(base, "instances", `${instanceId}.md`), bytes);
  const claimPath = path.join(base, "claims", `${instanceId}.json`); await writeFile(claimPath, persistedClaim ?? `${JSON.stringify(claim)}\n`); await link(claimPath, path.join(base, "commit.json"));
  return claim;
}
async function sealTransitionForTest(store, parentEventId, action, effectiveAt) {
  const bytes = Buffer.from(transitionDocument(parentEventId, action, effectiveAt)); const eventId = `mev1-${digest(bytes)}`; const relativePath = memoryEventRelativePath({ memoryId: record.memory_id, eventId });
  await sealCommittedForTest(store, { relativePath, eventId, bytes }); return { eventId, relativePath };
}
async function sourceTreeSnapshot(store) {
  const root = path.join(store.root, "v1"); const files = [];
  async function visit(directory, relative = "") {
    let handle;
    try { handle = await opendir(directory); } catch (error) { if (error.code === "ENOENT") return; throw error; }
    try {
      for await (const entry of handle) {
        const entryPath = path.join(directory, entry.name); const entryRelative = relative ? `${relative}/${entry.name}` : entry.name;
        if (entry.isDirectory()) await visit(entryPath, entryRelative);
        else if (entry.isFile()) { const bytes = await readFile(entryPath); files.push([entryRelative, bytes.byteLength, digest(bytes)]); }
        else files.push([entryRelative, "non-file"]);
      }
    } finally { await handle.close().catch(() => {}); }
  }
  await visit(root); return files.sort((left, right) => left[0].localeCompare(right[0]));
}
async function assertRejectedWithoutSourceChange(store, operation, code) {
  const before = await sourceTreeSnapshot(store);
  await assert.rejects(operation, (error) => error?.code === code);
  assert.deepEqual(await sourceTreeSnapshot(store), before);
}

test("store roots and bounded reads retain safe local behavior", async (t) => {
  const root = await workspace(t); const store = await resolveMemoryStore({ workspaceRoot: root, config: config(), platform: "linux", home: root, initialize: true });
  assert.equal(store.root, path.join(root, ".game-design", "memory"));
  await assert.rejects(() => readMemoryFile({ store, relativePath: "../escape" }));
  await mkdir(path.join(store.root, "v1")); await symlink(root, path.join(store.root, "v1", "link"));
  await assert.rejects(() => readMemoryFile({ store, relativePath: "v1/link/x" }));
});

test("a pre-existing .game-design symlink cannot redirect store initialization", async (t) => {
  const root = await workspace(t); const outside = path.join(root, "outside"); await mkdir(outside); await symlink(outside, path.join(root, ".game-design"));
  await assert.rejects(() => resolveMemoryStore({ workspaceRoot: root, config: config(), platform: "linux", home: root, initialize: true }));
  await assert.rejects(() => readFile(path.join(outside, "memory")));
});

test("global storage does not require a workspace path", async (t) => {
  const home = await workspace(t);
  const store = await resolveMemoryStore({ workspaceRoot: path.join(home, "missing-workspace"), config: config({ scope: "global" }), platform: "linux", home, initialize: true });
  assert.equal(store.root, path.join(home, ".local", "share", "game-design-plugin", "memory"));
});

test("sealed append is idempotent, conflict preserving, and uses event shard paths", async (t) => {
  const root = await workspace(t); const store = await resolveMemoryStore({ workspaceRoot: root, config: config(), platform: "linux", home: root, initialize: true }); const bytes = document();
  const first = await appendMemoryEvent({ store, eventDocument: bytes }); const second = await appendMemoryEvent({ store, eventDocument: bytes });
  assert.equal(first.status, "created"); assert.equal(second.status, "present"); assert.equal(first.relativePath, memoryEventRelativePath({ memoryId: record.memory_id, eventId: first.eventId }));
  await assert.rejects(() => appendMemoryEvent({ store, eventDocument: document({ reason: "other" }) }), (error) => error?.code === "memory.capture_exists");
});

test("quarantined append rejects transition and resolution without creating source files", async (t) => {
  for (const eventType of ["transition", "resolution"]) {
    const root = await workspace(t); const store = await resolveMemoryStore({ workspaceRoot: root, config: config(), platform: "linux", home: root, initialize: true }); const captured = await appendMemoryEvent({ store, eventDocument: document() });
    const verified = await sealTransitionForTest(store, captured.eventId, "verified", "2026-08-12T01:00:00.000Z"); const disputed = await sealTransitionForTest(store, captured.eventId, "disputed", "2026-08-12T02:00:00.000Z");
    await appendQuarantineMarker({ store, targetMemoryId: record.memory_id, targetEventId: captured.eventId, targetRelativePath: captured.relativePath, observedSha256: captured.fileSha256, reasonCode: "memory.bad", actor: "auditor", now: new Date("2026-08-12T03:00:00.000Z") });
    const candidate = eventType === "transition" ? transitionDocument(verified.eventId, "approved", "2026-08-12T04:00:00.000Z") : resolutionDocument([verified.eventId, disputed.eventId], verified.eventId, { ...record, status: "verified", updated_at: "2026-08-12T01:00:00.000Z" });
    await assertRejectedWithoutSourceChange(store, () => appendMemoryEvent({ store, eventDocument: candidate }), "memory.quarantined");
  }
});

test("incomplete scan append rejects before creating source files", async (t) => {
  const root = await workspace(t); const store = await resolveMemoryStore({ workspaceRoot: root, config: config(), platform: "linux", home: root, initialize: true }); const captured = await appendMemoryEvent({ store, eventDocument: document() });
  await writeFile(path.join(store.root, captured.relativePath, "commit.json"), "broken\n");
  await assertRejectedWithoutSourceChange(store, () => appendMemoryEvent({ store, eventDocument: transitionDocument(captured.eventId, "verified", "2026-08-12T01:00:00.000Z") }), "memory.scan_incomplete");
});

test("capture exists rejects a second capture without creating source files", async (t) => {
  const root = await workspace(t); const store = await resolveMemoryStore({ workspaceRoot: root, config: config(), platform: "linux", home: root, initialize: true }); await appendMemoryEvent({ store, eventDocument: document() });
  await assertRejectedWithoutSourceChange(store, () => appendMemoryEvent({ store, eventDocument: document({ operation_id: "capture-upstream-2", reason: "second capture" }) }), "memory.capture_exists");
});

test("transition heads and resolution heads reject stale, missing, and extra parent sets without creating source files", async (t) => {
  const root = await workspace(t); const store = await resolveMemoryStore({ workspaceRoot: root, config: config(), platform: "linux", home: root, initialize: true }); const captured = await appendMemoryEvent({ store, eventDocument: document() });
  const verified = await sealTransitionForTest(store, captured.eventId, "verified", "2026-08-12T01:00:00.000Z");
  const disputed = await sealTransitionForTest(store, captured.eventId, "disputed", "2026-08-12T02:00:00.000Z");
  const expired = await sealTransitionForTest(store, captured.eventId, "expired", "2026-08-12T03:00:00.000Z");
  await assertRejectedWithoutSourceChange(store, () => appendMemoryEvent({ store, eventDocument: transitionDocument(captured.eventId, "verified", "2026-08-12T04:00:00.000Z") }), "memory.transition_heads");
  const verifiedRecord = { ...record, status: "verified", updated_at: "2026-08-12T01:00:00.000Z" };
  await assertRejectedWithoutSourceChange(store, () => appendMemoryEvent({ store, eventDocument: resolutionDocument([verified.eventId, disputed.eventId], verified.eventId, verifiedRecord, "2026-08-12T05:00:00.000Z") }), "memory.resolution_heads");
  await assertRejectedWithoutSourceChange(store, () => appendMemoryEvent({ store, eventDocument: resolutionDocument([verified.eventId, disputed.eventId, expired.eventId, captured.eventId], captured.eventId, record, "2026-08-12T06:00:00.000Z") }), "memory.resolution_heads");
  await assertRejectedWithoutSourceChange(store, () => appendMemoryEvent({ store, eventDocument: resolutionDocument([verified.eventId, disputed.eventId, captured.eventId], captured.eventId, record, "2026-08-12T07:00:00.000Z") }), "memory.resolution_heads");
  const resolved = await appendMemoryEvent({ store, eventDocument: resolutionDocument([verified.eventId, disputed.eventId, expired.eventId], verified.eventId, verifiedRecord, "2026-08-12T08:00:00.000Z") });
  assert.equal(resolved.status, "created"); assert.equal(foldMemoryEvents(await scanMemoryEvents({ store })).memories.get(record.memory_id).headEventId, resolved.eventId);
});

test("staged files are immutable, commit claims seal only complete events, and fold is deterministic", async (t) => {
  const root = await workspace(t); const store = await resolveMemoryStore({ workspaceRoot: root, config: config(), platform: "linux", home: root, initialize: true });
  const staged = await stageImmutableMemoryFile({ store, relativePath: "v1/events/aa/test/mev1-test", bytes: Buffer.from("x") });
  assert.equal(staged.byteLength, 1); assert.equal(staged.fileSha256, createHash("sha256").update("x").digest("hex"));
  const result = await appendMemoryEvent({ store, eventDocument: document() }); const scan = await scanMemoryEvents({ store }); const fold = foldMemoryEvents(scan, { now: new Date("2026-08-13T00:00:00.000Z") });
  assert.equal(scan.complete, true); assert.equal(fold.memories.get(record.memory_id).record.memory_id, record.memory_id); assert.equal(result.eventId.startsWith("mev1-"), true);
});

test("scan is fail-closed at maxEvents and quarantine permanently excludes a memory", async (t) => {
  const root = await workspace(t); const store = await resolveMemoryStore({ workspaceRoot: root, config: config(), platform: "linux", home: root, initialize: true }); const appended = await appendMemoryEvent({ store, eventDocument: document() });
  const marker = await appendQuarantineMarker({ store, targetMemoryId: record.memory_id, targetEventId: appended.eventId, targetRelativePath: appended.relativePath, observedSha256: appended.fileSha256, reasonCode: "memory.bad", actor: "auditor", now: new Date("2026-08-12T00:00:00.000Z") });
  assert.equal(marker.status, "created"); const before = (await scanMemoryEvents({ store })).entriesScanned; const repeated = await appendQuarantineMarker({ store, targetMemoryId: record.memory_id, targetEventId: appended.eventId, targetRelativePath: appended.relativePath, observedSha256: appended.fileSha256, reasonCode: "memory.bad", actor: "auditor", now: new Date("2026-08-12T00:00:00.000Z") }); assert.equal(repeated.status, "present"); assert.equal((await scanMemoryEvents({ store })).entriesScanned, before); assert.equal(foldMemoryEvents(await scanMemoryEvents({ store }), { now: new Date() }).memories.has(record.memory_id), false);
  const limited = await scanMemoryEvents({ store, maxEvents: 1 }); assert.equal(limited.complete, false); assert.equal(limited.diagnostics[0].code, "memory.scan_limit_exceeded");
});

test("moved disputed event closes the scan instead of restoring approved memory", async (t) => {
  const root = await workspace(t); const store = await resolveMemoryStore({ workspaceRoot: root, config: config(), platform: "linux", home: root, initialize: true }); const captured = await appendMemoryEvent({ store, eventDocument: document() });
  const verified = await appendMemoryEvent({ store, eventDocument: transitionDocument(captured.eventId, "verified", "2026-08-12T01:00:00.000Z") }); const approved = await appendMemoryEvent({ store, eventDocument: transitionDocument(verified.eventId, "approved", "2026-08-12T02:00:00.000Z") }); const disputed = await appendMemoryEvent({ store, eventDocument: transitionDocument(approved.eventId, "disputed", "2026-08-12T03:00:00.000Z") });
  const moved = path.join(store.root, "v1", "events", "zz", "invalid-memory", disputed.eventId); await mkdir(path.dirname(moved), { recursive: true }); await rename(path.join(store.root, disputed.relativePath), moved);
  assertClosedScan(await scanMemoryEvents({ store }), record.memory_id, "memory.path_binding");
});

test("marker binding closes the scan when a sealed marker target tuple is forged", async (t) => {
  const forgeries = ["target_relative_path", "target_event_id", "memory_id", "observed_sha256"];
  for (const forged of forgeries) {
    const root = await workspace(t); const store = await resolveMemoryStore({ workspaceRoot: root, config: config(), platform: "linux", home: root, initialize: true }); const target = await appendMemoryEvent({ store, eventDocument: document() }); const otherEventId = `mev1-${"b".repeat(64)}`;
    const marker = { schema_version: 1, memory_id: record.memory_id, target_event_id: target.eventId, target_relative_path: target.relativePath, observed_sha256: target.fileSha256, reason_code: "memory.bad", actor: "auditor", recorded_at: "2026-08-12T00:00:00.000Z" };
    if (forged === "target_relative_path") marker.target_relative_path = memoryEventRelativePath({ memoryId: "other-memory", eventId: target.eventId });
    if (forged === "target_event_id") marker.target_event_id = otherEventId;
    if (forged === "memory_id") marker.memory_id = "other-memory";
    if (forged === "observed_sha256") marker.observed_sha256 = "b".repeat(64);
    await sealMarkerForTest(store, marker, { memory_id: record.memory_id, target_event_id: target.eventId }); assertClosedScan(await scanMemoryEvents({ store }), record.memory_id, "memory.quarantine_binding");
  }
});

test("unbound sealed marker target closes the entire scan", async (t) => {
  const root = await workspace(t); const store = await resolveMemoryStore({ workspaceRoot: root, config: config(), platform: "linux", home: root, initialize: true }); await appendMemoryEvent({ store, eventDocument: document() }); const missingEventId = `mev1-${"c".repeat(64)}`;
  await sealMarkerForTest(store, { schema_version: 1, memory_id: record.memory_id, target_event_id: missingEventId, target_relative_path: memoryEventRelativePath({ memoryId: record.memory_id, eventId: missingEventId }), observed_sha256: null, reason_code: "memory.bad", actor: "auditor", recorded_at: "2026-08-12T00:00:00.000Z" });
  assertClosedScan(await scanMemoryEvents({ store }), record.memory_id, "memory.unbound_seal");
});

test("raw sealed event and marker bytes require fatal UTF-8 and raw content IDs", async (t) => {
  const rawEvent = Buffer.from(document()); rawEvent[rawEvent.indexOf(Buffer.from("내용"))] = 0xff; const decodedEventId = `mev1-${digest(Buffer.from(rawEvent.toString("utf8")))}`;
  {
    const root = await workspace(t); const store = await resolveMemoryStore({ workspaceRoot: root, config: config(), platform: "linux", home: root, initialize: true });
    await sealCommittedForTest(store, { relativePath: memoryEventRelativePath({ memoryId: record.memory_id, eventId: decodedEventId }), eventId: decodedEventId, bytes: rawEvent }); assertClosedScan(await scanMemoryEvents({ store }), record.memory_id, "memory.unbound_seal");
  }
  {
    const root = await workspace(t); const store = await resolveMemoryStore({ workspaceRoot: root, config: config(), platform: "linux", home: root, initialize: true }); const target = await appendMemoryEvent({ store, eventDocument: document() }); const marker = { schema_version: 1, memory_id: record.memory_id, target_event_id: target.eventId, target_relative_path: target.relativePath, observed_sha256: null, reason_code: "memory.bad", actor: "auditor", recorded_at: "2026-08-12T00:00:00.000Z" };
    const rawMarker = Buffer.from(canonicalQuarantineMarkerDocument(marker)); rawMarker[rawMarker.indexOf(Buffer.from("auditor"))] = 0x80; const decodedMarkerId = `qmv1-${digest(Buffer.from(rawMarker.toString("utf8")))}`;
    await sealCommittedForTest(store, { relativePath: `v1/controls/quarantine/${digest(record.memory_id).slice(0, 2)}/${target.eventId}/${decodedMarkerId}`, eventId: decodedMarkerId, bytes: rawMarker }); assertClosedScan(await scanMemoryEvents({ store }), record.memory_id, "memory.unbound_seal");
  }
});

test("sealed claims require an exact canonical envelope", async (t) => {
  const malformed = [
    (claim) => `${JSON.stringify({ ...claim, unexpected: "extra-field" })}\n`,
    (claim) => `${JSON.stringify({ schemaVersion: claim.schemaVersion, eventId: claim.eventId, instanceId: claim.instanceId, fileSha256: claim.fileSha256 })}\n`,
    (claim) => `{\"schemaVersion\":1,\"schemaVersion\":1,\"eventId\":${JSON.stringify(claim.eventId)},\"instanceId\":${JSON.stringify(claim.instanceId)},\"fileSha256\":${JSON.stringify(claim.fileSha256)},\"byteLength\":${claim.byteLength}}\n`,
    (claim) => ` ${JSON.stringify(claim)}\n`,
    () => "[]\n",
  ];
  for (const persist of malformed) {
    const root = await workspace(t); const store = await resolveMemoryStore({ workspaceRoot: root, config: config(), platform: "linux", home: root, initialize: true }); const bytes = Buffer.from(document()); const eventId = `mev1-${digest(bytes)}`;
    await sealCommittedForTest(store, { relativePath: memoryEventRelativePath({ memoryId: record.memory_id, eventId }), eventId, bytes, persistedClaim: persist({ schemaVersion: 1, eventId, instanceId: sealedInstanceId(eventId), fileSha256: digest(bytes), byteLength: bytes.byteLength }) }); assertClosedScan(await scanMemoryEvents({ store }), record.memory_id, "memory.unbound_seal");
  }
});

test("scan diagnostics do not expose untrusted physical path components", async (t) => {
  const attackers = ["sk-live-DO-NOT-EXPOSE", "line\ncontrol-\u0001", "x".repeat(240), "invalid-\uD800-component"];
  for (const attacker of attackers) {
    const root = await workspace(t); const store = await resolveMemoryStore({ workspaceRoot: root, config: config(), platform: "linux", home: root, initialize: true }); const appended = await appendMemoryEvent({ store, eventDocument: document() }); const moved = path.join(store.root, "v1", "events", attacker, "wrong-memory", appended.eventId);
    await mkdir(path.dirname(moved), { recursive: true }); await rename(path.join(store.root, appended.relativePath), moved); const scan = await scanMemoryEvents({ store }); assertClosedScan(scan, record.memory_id, "memory.path_binding"); const diagnostics = JSON.stringify(scan.diagnostics);
    assert.equal(diagnostics.includes(attacker), false); assert.equal(diagnostics.includes(root), false);
  }
});

test("traversal failures and special entries close scans without leaking filesystem errors", async (t) => {
  for (const failurePoint of ["opendir", "lstat", "close"]) {
    const root = await workspace(t); const store = await resolveMemoryStore({ workspaceRoot: root, config: config(), platform: "linux", home: root, initialize: true }); const attacker = "sk-live-TRAVERSAL-SECRET"; const nested = path.join(store.root, "v1", "events", attacker); await mkdir(nested, { recursive: true }); const failure = Object.assign(new Error(`EACCES ${nested}`), { code: "EACCES", path: nested });
    const traversal = {
      opendir: async (candidate) => { if (failurePoint === "opendir" && candidate === nested) throw failure; return opendir(candidate); },
      lstat: async (candidate) => { if (failurePoint === "lstat" && candidate === nested) throw failure; return lstat(candidate); },
      close: async (handle) => { if (failurePoint === "close") { try { await handle.close(); } catch {} throw failure; } return handle.close().catch((error) => { if (error?.code !== "ERR_DIR_CLOSED") throw error; }); },
    };
    const scan = await scanMemoryEvents({ store, traversal }); assertClosedScan(scan, record.memory_id, "memory.unbound_seal"); const diagnostics = JSON.stringify(scan.diagnostics); assert.equal(diagnostics.includes(attacker), false); assert.equal(diagnostics.includes(root), false);
  }
  {
    const root = await workspace(t); const store = await resolveMemoryStore({ workspaceRoot: root, config: config(), platform: "linux", home: root, initialize: true }); const attacker = "special-sk-live-ENTRY"; await mkdir(path.join(store.root, "v1", "events"), { recursive: true }); await symlink(root, path.join(store.root, "v1", "events", attacker));
    const scan = await scanMemoryEvents({ store }); assertClosedScan(scan, record.memory_id, "memory.unbound_seal"); assert.equal(JSON.stringify(scan.diagnostics).includes(attacker), false);
  }
});

test("fold taints a memory for duplicate roots, descendants of invalid events, and operation collisions", () => {
  const id = (digit) => `mev1-${digit.repeat(64)}`;
  const item = (eventId, event) => ({ eventId, event: { schema_version: 1, memory_id: record.memory_id, operation_id: "mop1-" + "1".repeat(64), event_type: "capture", action: "capture", parent_event_ids: [], actor: "a", reason: "r", ...event }, record });
  for (const events of [[item(id("1"), {}), item(id("2"), {})], [item(id("1"), {}), item(id("2"), { event_type: "transition", action: "approved", parent_event_ids: [id("1")] })], [item(id("1"), {}), item(id("2"), { operation_id: "mop1-" + "2".repeat(64) }), item(id("3"), { operation_id: "mop1-" + "2".repeat(64) })]]) {
    const folded = foldMemoryEvents({ complete: true, diagnostics: [], events, quarantines: [] }, { now: new Date() });
    assert.equal(folded.memories.has(record.memory_id), false);
    assert.equal(folded.diagnostics.some((entry) => entry.code), true);
  }
});

test("cross-memory supersedes cycles taint every involved memory", () => {
  const event = (memoryId, digit, supersedes) => ({ eventId: `mev1-${digit.repeat(64)}`, event: { memory_id: memoryId, operation_id: `mev1-${digit.repeat(64)}`, event_type: "capture", action: "capture", parent_event_ids: [] }, record: { ...record, memory_id: memoryId, supersedes } });
  const left = "memory-left"; const right = "memory-right"; const folded = foldMemoryEvents({ complete: true, diagnostics: [], quarantines: [], events: [event(left, "1", right), event(right, "2", left)] });
  assert.equal(folded.memories.has(left), false); assert.equal(folded.memories.has(right), false); assert.equal(folded.diagnostics.filter((item) => item.code === "memory.supersedes_graph").length, 2);
});

test("transition snapshots cannot mutate instruction provenance, tags, or sources", () => {
  const rootId = `mev1-${"1".repeat(64)}`; const changedId = `mev1-${"2".repeat(64)}`;
  const root = { eventId: rootId, event: { memory_id: record.memory_id, operation_id: "capture-root", event_type: "capture", action: "capture", parent_event_ids: [] }, record, sections };
  for (const mutation of [{ instruction_sha256: "b".repeat(64) }, { tags: ["other"] }, { sources: [{ ...record.sources[0], sha256: "b".repeat(64) }] }]) {
    const changed = { eventId: changedId, event: { memory_id: record.memory_id, operation_id: `mop1-${"2".repeat(64)}`, event_type: "transition", action: "verified", parent_event_ids: [rootId] }, record: { ...record, ...mutation, status: "verified" }, sections };
    const folded = foldMemoryEvents({ complete: true, diagnostics: [], quarantines: [], events: [root, changed] }); assert.equal(folded.memories.has(record.memory_id), false); assert.equal(folded.diagnostics.find((entry) => entry.code === "memory.invalid_event_dag")?.memory_id, record.memory_id);
  }
});

test("a corrupt committed event closes the entire scan", async (t) => {
  const root = await workspace(t); const store = await resolveMemoryStore({ workspaceRoot: root, config: config(), platform: "linux", home: root, initialize: true }); const appended = await appendMemoryEvent({ store, eventDocument: document() });
  await writeFile(path.join(store.root, appended.relativePath, "commit.json"), "broken\n");
  assertClosedScan(await scanMemoryEvents({ store }), record.memory_id, "memory.unbound_seal");
});

test("same-user directory swap is explicitly a skipped non-goal", { skip: "Node 18 path APIs cannot prevent malicious same-user between-syscall directory swaps." }, () => {});

test("Git exclusion is best-effort and independent from append trust", async (t) => {
  const root = await workspace(t); const exclude = path.join(root, ".git", "info", "exclude"); await mkdir(path.dirname(exclude), { recursive: true }); await writeFile(exclude, "before\n");
  const runGit = async (args) => args[1] === "--git-common-dir" ? ".git" : exclude;
  assert.equal((await ensureMemoryGitExclusion({ workspaceRoot: root, gitMode: "local", runGit })).status, "ready");
  assert.match(await readFile(exclude, "utf8"), /game-design-plugin:memory:begin/u);
});

test("Git exclusion leaves a symlink victim unchanged", async (t) => {
  const root = await workspace(t); const victim = path.join(root, "victim"); const exclude = path.join(root, ".git", "info", "exclude"); await mkdir(path.dirname(exclude), { recursive: true }); await writeFile(victim, "user bytes\n"); await symlink(victim, exclude);
  const runGit = async (args) => args[1] === "--git-common-dir" ? ".git" : exclude;
  const result = await ensureMemoryGitExclusion({ workspaceRoot: root, gitMode: "local", runGit });
  assert.equal(result.status, "warning"); assert.equal(await readFile(victim, "utf8"), "user bytes\n");
});
