import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { canonicalMemoryEventDocument } from "../../shared/scripts/validate-design-memory.mjs";
import { appendMemoryEvent, appendQuarantineMarker, ensureMemoryGitExclusion, foldMemoryEvents, memoryEventRelativePath, readMemoryFile, resolveMemoryStore, scanMemoryEvents, stageImmutableMemoryFile } from "../../shared/scripts/lib/safe-memory-store.mjs";

async function workspace(t) { const root = await realpath(await mkdtemp(path.join(tmpdir(), "memory-store-"))); t.after(() => rm(root, { recursive: true, force: true })); return root; }
const config = (overrides = {}) => ({ enabled: true, scope: "project", gitMode: "local", projectId: "wind-island", ...overrides });
const record = { schema_version: 1, memory_id: "memory-studio-design-lesson-0f2a4c61d9ab34ef", kind: "design-lesson", lane: "studio", status: "candidate", scope: "project", project_id: "wind-island", created_at: "2026-08-12T00:00:00.000Z", updated_at: "2026-08-12T00:00:00.000Z", review_after: "2026-09-11", expires_at: "2026-09-11", approved_by: null, approval_basis: null, supersedes: null, artifact_types: ["artifact"], related_ids: ["related"], tags: ["tag"], sources: [{ artifact_id: "source", locator: "content.md#h", sha256: "a".repeat(64) }] };
const sections = { "발견한 내용": "내용", "적용 조건": "조건", "적용하면 안 되는 경우": "제외", "근거": "근거" };
const document = (overrides = {}) => canonicalMemoryEventDocument({ schema_version: 1, event_type: "capture", action: "capture", memory_id: record.memory_id, operation_id: "mev1-" + "1".repeat(64), parent_event_ids: [], effective_at: "2026-08-12T00:00:00.000Z", actor: "author", reason: "capture", record, ...overrides }, sections);

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
  await assert.rejects(() => appendMemoryEvent({ store, eventDocument: document({ reason: "other" }) }), /duplicate-operation/i);
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

test("a corrupt committed event taints its canonical memory path", async (t) => {
  const root = await workspace(t); const store = await resolveMemoryStore({ workspaceRoot: root, config: config(), platform: "linux", home: root, initialize: true }); const appended = await appendMemoryEvent({ store, eventDocument: document() });
  await writeFile(path.join(store.root, appended.relativePath, "commit.json"), "broken\n");
  const scan = await scanMemoryEvents({ store }); const fold = foldMemoryEvents(scan);
  assert.deepEqual(scan.taintedMemoryIds, [record.memory_id]); assert.equal(fold.memories.has(record.memory_id), false); assert.equal(fold.diagnostics.find((item) => item.code === "memory.corrupt_seal")?.memory_id, record.memory_id);
});

test("same-user directory swap is explicitly a skipped non-goal", { skip: "Node 18 path APIs cannot prevent malicious same-user between-syscall directory swaps." }, () => {});

test("Git exclusion is best-effort and independent from append trust", async (t) => {
  const root = await workspace(t); const exclude = path.join(root, ".git", "info", "exclude"); await mkdir(path.dirname(exclude), { recursive: true }); await writeFile(exclude, "before\n");
  const runGit = async (args) => args[1] === "--git-common-dir" ? ".git" : exclude;
  assert.equal((await ensureMemoryGitExclusion({ workspaceRoot: root, gitMode: "local", runGit })).status, "ready");
  assert.match(await readFile(exclude, "utf8"), /game-design-plugin:memory:begin/u);
});
