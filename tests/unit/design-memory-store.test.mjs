import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { link, lstat, mkdtemp, mkdir, opendir, readFile, realpath, rename, rm, symlink, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { canonicalMemoryEventDocument, canonicalQuarantineMarkerDocument, memoryOperationId } from "../../shared/scripts/validate-design-memory.mjs";

const storeModuleUrl = process.env.DESIGN_MEMORY_STORE_MODULE_URL ?? new URL("../../shared/scripts/lib/safe-memory-store.mjs", import.meta.url).href;
const { appendMemoryEvent, appendQuarantineMarker, ensureMemoryGitExclusion, foldMemoryEvents, memoryEventRelativePath, readMemoryFile, resolveMemoryStore, scanMemoryEvents, stageImmutableMemoryFile } = await import(storeModuleUrl);

async function workspace(t) { const root = await realpath(await mkdtemp(path.join(tmpdir(), "memory-store-"))); t.after(() => rm(root, { recursive: true, force: true })); return root; }
const config = (overrides = {}) => ({ enabled: true, scope: "project", gitMode: "local", projectId: "wind-island", ...overrides });
const record = { schema_version: 1, memory_id: "memory-studio-design-lesson-0f2a4c61d9ab34ef", kind: "design-lesson", lane: "studio", status: "candidate", scope: "project", project_id: "wind-island", created_at: "2026-08-12T00:00:00.000Z", updated_at: "2026-08-12T00:00:00.000Z", review_after: "2026-09-11", expires_at: "2026-09-11", approved_by: null, approval_basis: null, supersedes: null, artifact_types: ["artifact"], related_ids: ["related"], tags: ["tag"], sources: [{ artifact_id: "source", locator: "content.md#h", sha256: "a".repeat(64) }] };
const sections = { "발견한 내용": "내용", "적용 조건": "조건", "적용하면 안 되는 경우": "제외", "근거": "근거" };
const document = (overrides = {}) => canonicalMemoryEventDocument({ schema_version: 1, event_type: "capture", action: "capture", memory_id: record.memory_id, operation_id: "capture-upstream-1", parent_event_ids: [], effective_at: "2026-08-12T00:00:00.000Z", actor: "author", reason: "capture", record, ...overrides }, sections);
function transitionDocument(parentEventId, action, effectiveAt, { memoryId = record.memory_id, baseRecord = record, recordOverrides = {}, sectionOverrides = {} } = {}) {
  const event = { schema_version: 1, event_type: "transition", action, memory_id: memoryId, parent_event_ids: [parentEventId], effective_at: effectiveAt, actor: "reviewer", reason: action, record: { ...baseRecord, status: action, updated_at: effectiveAt, ...(action === "approved" ? { approved_by: "reviewer", approval_basis: "review" } : {}), ...recordOverrides } };
  return canonicalMemoryEventDocument({ ...event, operation_id: memoryOperationId(event) }, { ...sections, ...sectionOverrides });
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
function eventRelativePathForTest(memoryId, eventId) { return `v1/events/${digest(memoryId).slice(0, 2)}/${memoryId}/${eventId}`; }
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
async function absent(candidate) { await assert.rejects(() => lstat(candidate), (error) => error?.code === "ENOENT"); }
async function runAppendChild(payload, start, { fixtureName = "child-append.mjs", maxOutputBytes = 64 * 1024, childEnv = {} } = {}) {
  const fixture = fileURLToPath(new URL(`../fixtures/design-memory/${fixtureName}`, import.meta.url));
  const child = spawn(process.execPath, [fixture], { env: { ...process.env, ...childEnv }, stdio: ["pipe", "pipe", "pipe"] });
  const stdout = []; const stderr = []; let outputBytes = 0; let settled = false;
  const completed = new Promise((resolve, reject) => {
    const finish = (operation, value) => { if (settled) return; settled = true; clearTimeout(timeout); operation(value); };
    const timeout = setTimeout(() => { child.kill(); finish(reject, new Error("child append timed out")); }, 15_000);
    const collect = (target) => (chunk) => {
      outputBytes += chunk.byteLength;
      if (outputBytes > maxOutputBytes) { child.kill(); finish(reject, new Error("child append output exceeded limit")); return; }
      target.push(chunk);
    };
    child.stdout.on("data", collect(stdout)); child.stderr.on("data", collect(stderr));
    child.once("error", () => finish(reject, new Error("child append failed")));
    child.once("close", (code, signal) => {
      const output = Buffer.concat(stdout).toString("utf8"); const errors = Buffer.concat(stderr).toString("utf8");
      if (code !== 0) finish(reject, new Error(`child append failed with code ${code}, signal ${signal ?? "none"}`));
      else if (!/^[^\r\n]+\n$/u.test(output)) finish(reject, new Error("child append output is not exactly one line"));
      else finish(resolve, { output, errors });
    });
  });
  await start;
  child.stdin.end(`${JSON.stringify(payload)}\n`);
  return completed;
}
async function sealEventForTest(store, eventDocument) {
  const bytes = Buffer.from(eventDocument); const eventId = `mev1-${digest(bytes)}`; const relativePath = eventRelativePathForTest(record.memory_id, eventId);
  await sealCommittedForTest(store, { relativePath, eventId, bytes });
  return { bytes, eventId, relativePath };
}
async function sourceTraversalEntries(root, relative = "") {
  let handle;
  try { handle = await opendir(root); } catch (error) { if (error.code === "ENOENT") return []; throw error; }
  const entries = [];
  try { for await (const entry of handle) entries.push(entry); } finally { await handle.close().catch(() => {}); }
  const result = [];
  for (const entry of entries.sort((left, right) => Buffer.compare(Buffer.from(left.name), Buffer.from(right.name)))) {
    const entryRelative = relative ? `${relative}/${entry.name}` : entry.name; result.push(entryRelative);
    if (entry.isDirectory() && !entry.isSymbolicLink()) result.push(...await sourceTraversalEntries(path.join(root, entry.name), entryRelative));
  }
  return result;
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

test("workspace ancestor symlinks cannot redirect store initialization", async (t) => {
  for (const shape of ["parent", "intermediate"]) {
    const root = await workspace(t); const outside = path.join(root, "outside"); const logical = path.join(root, "logical"); await mkdir(outside);
    if (shape === "parent") { await mkdir(path.join(outside, "workspace")); await symlink(outside, logical); }
    else { await mkdir(path.join(outside, "nested", "workspace"), { recursive: true }); await mkdir(logical); await symlink(path.join(outside, "nested"), path.join(logical, "nested")); }
    const workspaceRoot = shape === "parent" ? path.join(logical, "workspace") : path.join(logical, "nested", "workspace");
    await assert.rejects(() => resolveMemoryStore({ workspaceRoot, config: config(), platform: "linux", home: root, initialize: true }));
    await absent(path.join(outside, shape === "parent" ? "workspace" : "nested", "workspace", ".game-design"));
  }
});

test("home ancestor symlinks cannot redirect global store initialization", async (t) => {
  for (const shape of ["parent", "intermediate"]) {
    const root = await workspace(t); const outside = path.join(root, "outside"); const logical = path.join(root, "logical"); await mkdir(outside);
    if (shape === "parent") { await mkdir(path.join(outside, "home")); await symlink(outside, logical); }
    else { await mkdir(path.join(outside, "nested", "home"), { recursive: true }); await mkdir(logical); await symlink(path.join(outside, "nested"), path.join(logical, "nested")); }
    const home = shape === "parent" ? path.join(logical, "home") : path.join(logical, "nested", "home");
    await assert.rejects(() => resolveMemoryStore({ workspaceRoot: path.join(root, "unused"), config: config({ scope: "global" }), platform: "linux", home, initialize: true }));
    await absent(path.join(outside, shape === "parent" ? "home" : "nested", "home", ".local"));
  }
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
  await assert.rejects(() => appendMemoryEvent({ store, eventDocument: document({ reason: "other" }) }), (error) => error?.code === "duplicate-operation");
});

test("multiprocess same-event append commits one logical event with created and present statuses", { timeout: 20_000 }, async (t) => {
  const root = await workspace(t); const eventDocument = document(); let release;
  const start = new Promise((resolve) => { release = resolve; });
  const children = [runAppendChild({ workspaceRoot: root, eventDocument }, start), runAppendChild({ workspaceRoot: root, eventDocument }, start)];
  release();
  const results = await Promise.all(children); const parsed = results.map(({ output, errors }) => {
    assert.equal(errors, ""); assert.equal(output.split("\n").filter(Boolean).length, 1); assert.equal(output.includes(root), false); assert.equal(output.includes(eventDocument), false); assert.equal(output.includes('"actor"'), false); assert.equal(output.includes('"reason"'), false);
    const value = JSON.parse(output); assert.deepEqual(Object.keys(value).sort(), ["eventId", "relativePath", "status"]); assert.equal(output, `${JSON.stringify(value)}\n`); return value;
  });
  assert.deepEqual(results.map((_, index) => parsed[index].status).sort(), ["created", "present"]);
  const expectedEventId = `mev1-${digest(Buffer.from(eventDocument))}`; const expectedRelativePath = eventRelativePathForTest(record.memory_id, expectedEventId);
  assert.equal(parsed.every((value) => value.eventId === expectedEventId && value.relativePath === expectedRelativePath), true);
  const store = await resolveMemoryStore({ workspaceRoot: root, config: config(), platform: process.platform, home: root }); const scan = await scanMemoryEvents({ store });
  assert.equal(scan.events.filter((item) => item.eventId === expectedEventId).length, 1);
});

test("child output rejects an extra blank line", async () => {
  await assert.rejects(
    () => runAppendChild({ workspaceRoot: "/unused", eventDocument: "unused" }, Promise.resolve(), { fixtureName: "child-output-hostile.mjs", childEnv: { DESIGN_MEMORY_CHILD_OUTPUT_SEAM: "extra-blank" } }),
    (error) => error?.message === "child append output is not exactly one line",
  );
});

test("child output kills an oversized stream at the byte limit", async () => {
  await assert.rejects(
    () => runAppendChild({ workspaceRoot: "/unused", eventDocument: "unused" }, Promise.resolve(), { fixtureName: "child-output-hostile.mjs", maxOutputBytes: 1024, childEnv: { DESIGN_MEMORY_CHILD_OUTPUT_SEAM: "oversized" } }),
    (error) => error?.message === "child append output exceeded limit",
  );
});

test("concurrent transitions and resolutions remain physical conflicts until one current-head resolution", async (t) => {
  const root = await workspace(t); const store = await resolveMemoryStore({ workspaceRoot: root, config: config(), platform: process.platform, home: root, initialize: true }); const captured = await appendMemoryEvent({ store, eventDocument: document() });
  const verifiedDocument = transitionDocument(captured.eventId, "verified", "2026-08-12T01:00:00.000Z"); const disputedDocument = transitionDocument(captured.eventId, "disputed", "2026-08-12T02:00:00.000Z");
  const verified = await sealEventForTest(store, verifiedDocument); const disputed = await sealEventForTest(store, disputedDocument);
  let scan = await scanMemoryEvents({ store }); let fold = foldMemoryEvents(scan);
  assert.equal(scan.events.filter((item) => [verified.eventId, disputed.eventId].includes(item.eventId)).length, 2); assert.equal(fold.memories.has(record.memory_id), false); assert.equal(fold.diagnostics.some((item) => item.code === "memory.concurrent_conflict"), true);
  const verifiedRecord = { ...record, status: "verified", updated_at: "2026-08-12T01:00:00.000Z" }; const disputedRecord = { ...record, status: "disputed", updated_at: "2026-08-12T02:00:00.000Z" };
  const left = await sealEventForTest(store, resolutionDocument([verified.eventId, disputed.eventId], verified.eventId, verifiedRecord, "2026-08-12T03:00:00.000Z"));
  const right = await sealEventForTest(store, resolutionDocument([verified.eventId, disputed.eventId], disputed.eventId, disputedRecord, "2026-08-12T04:00:00.000Z"));
  scan = await scanMemoryEvents({ store }); fold = foldMemoryEvents(scan);
  assert.equal(scan.events.filter((item) => [left.eventId, right.eventId].includes(item.eventId)).length, 2); assert.equal(fold.memories.has(record.memory_id), false); assert.equal(fold.diagnostics.some((item) => item.code === "memory.concurrent_conflict"), true);
  const resolved = await appendMemoryEvent({ store, eventDocument: resolutionDocument([left.eventId, right.eventId], left.eventId, verifiedRecord, "2026-08-12T05:00:00.000Z") });
  assert.equal(resolved.status, "created"); assert.equal(foldMemoryEvents(await scanMemoryEvents({ store })).memories.get(record.memory_id).headEventId, resolved.eventId);
});

test("unsealed failpoint states stay non-authoritative and canonical retry prevents approved resurrection", { timeout: 20_000 }, async (t) => {
  const root = await workspace(t); const store = await resolveMemoryStore({ workspaceRoot: root, config: config(), platform: process.platform, home: root, initialize: true }); const captured = await appendMemoryEvent({ store, eventDocument: document() });
  const verified = await appendMemoryEvent({ store, eventDocument: transitionDocument(captured.eventId, "verified", "2026-08-12T01:00:00.000Z") }); const approved = await appendMemoryEvent({ store, eventDocument: transitionDocument(verified.eventId, "approved", "2026-08-12T02:00:00.000Z") });
  const disputedDocument = transitionDocument(approved.eventId, "disputed", "2026-08-12T03:00:00.000Z", { recordOverrides: { approved_by: "reviewer", approval_basis: "review" } }); const bytes = Buffer.from(disputedDocument); const eventId = `mev1-${digest(bytes)}`; const relativePath = eventRelativePathForTest(record.memory_id, eventId); const base = path.join(store.root, relativePath);
  await mkdir(path.join(base, "instances"), { recursive: true }); await mkdir(path.join(base, "claims"), { recursive: true });
  const candidates = [
    ["11111111-1111-1111-1111-111111111111", "instance-only"],
    ["22222222-2222-2222-2222-222222222222", "valid-claim"],
    ["33333333-3333-3333-3333-333333333333", "wrong-length"],
    ["44444444-4444-4444-4444-444444444444", "wrong-hash"],
  ];
  for (const [instanceId, kind] of candidates) {
    await writeFile(path.join(base, "instances", `${instanceId}.md`), bytes);
    if (kind !== "instance-only") {
      const claim = { schemaVersion: 1, eventId, instanceId, fileSha256: kind === "wrong-hash" ? "b".repeat(64) : digest(bytes), byteLength: kind === "wrong-length" ? bytes.byteLength + 1 : bytes.byteLength };
      const claimPath = path.join(base, "claims", `${instanceId}.json`); await writeFile(claimPath, `${JSON.stringify(claim)}\n`); assert.equal((await lstat(claimPath)).nlink, 1);
    }
  }
  await absent(path.join(base, "commit.json"));
  const before = await scanMemoryEvents({ store }); assert.equal(before.complete, true); assert.equal(before.events.some((item) => item.eventId === eventId), false); assert.equal(foldMemoryEvents(before).memories.get(record.memory_id).record.status, "approved");
  const created = await appendMemoryEvent({ store, eventDocument: disputedDocument }); const afterCreated = await sourceTreeSnapshot(store); const present = await appendMemoryEvent({ store, eventDocument: disputedDocument });
  assert.equal(created.status, "created"); assert.equal(present.status, "present"); assert.deepEqual(await sourceTreeSnapshot(store), afterCreated);
  const recovered = await scanMemoryEvents({ store }); assert.equal(recovered.events.filter((item) => item.eventId === eventId).length, 1); assert.equal(foldMemoryEvents(recovered).memories.get(record.memory_id).record.status, "disputed");
});

test("unsealed quarantine debris stays non-authoritative and canonical retry does not grow source files", { timeout: 20_000 }, async (t) => {
  const root = await workspace(t); const store = await resolveMemoryStore({ workspaceRoot: root, config: config(), platform: process.platform, home: root, initialize: true }); const target = await appendMemoryEvent({ store, eventDocument: document() }); const now = new Date("2026-08-12T06:00:00.000Z");
  const marker = { schema_version: 1, memory_id: record.memory_id, target_event_id: target.eventId, target_relative_path: target.relativePath, observed_sha256: target.fileSha256, reason_code: "memory.bad", actor: "auditor", recorded_at: now.toISOString() }; const bytes = Buffer.from(canonicalQuarantineMarkerDocument(marker)); const markerId = `qmv1-${digest(bytes)}`;
  const relativePath = `v1/controls/quarantine/${digest(record.memory_id).slice(0, 2)}/${target.eventId}/${markerId}`; const base = path.join(store.root, relativePath); await mkdir(path.join(base, "instances"), { recursive: true }); await mkdir(path.join(base, "claims"), { recursive: true });
  const candidates = [
    ["aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "instance-only"],
    ["bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "valid-claim"],
    ["cccccccc-cccc-cccc-cccc-cccccccccccc", "wrong-length"],
    ["dddddddd-dddd-dddd-dddd-dddddddddddd", "wrong-hash"],
  ];
  for (const [instanceId, kind] of candidates) {
    await writeFile(path.join(base, "instances", `${instanceId}.md`), bytes);
    if (kind !== "instance-only") {
      const claim = { schemaVersion: 1, eventId: markerId, instanceId, fileSha256: kind === "wrong-hash" ? "b".repeat(64) : digest(bytes), byteLength: kind === "wrong-length" ? bytes.byteLength + 1 : bytes.byteLength }; const claimPath = path.join(base, "claims", `${instanceId}.json`);
      await writeFile(claimPath, `${JSON.stringify(claim)}\n`); assert.equal((await lstat(claimPath)).nlink, 1);
    }
  }
  await absent(path.join(base, "commit.json")); const before = await scanMemoryEvents({ store }); assert.equal(before.complete, true); assert.equal(before.quarantines.length, 0); assert.equal(foldMemoryEvents(before).memories.has(record.memory_id), true);
  const input = { store, targetMemoryId: record.memory_id, targetEventId: target.eventId, targetRelativePath: target.relativePath, observedSha256: target.fileSha256, reasonCode: "memory.bad", actor: "auditor", now };
  const created = await appendQuarantineMarker(input); const afterCreated = await sourceTreeSnapshot(store); const present = await appendQuarantineMarker(input);
  assert.equal(created.status, "created"); assert.equal(created.eventId, markerId); assert.equal(created.relativePath, relativePath); assert.equal(present.status, "present"); assert.deepEqual(await sourceTreeSnapshot(store), afterCreated);
  const recovered = await scanMemoryEvents({ store }); assert.equal(recovered.complete, true); assert.equal(recovered.quarantines.length, 1); assert.equal(recovered.quarantines[0].target_event_id, target.eventId); assert.equal(foldMemoryEvents(recovered).memories.has(record.memory_id), false);
});

test("the 10001st source-tree entry cannot hide an approval-invalidating event", { timeout: 30_000 }, async (t) => {
  const root = await workspace(t); const store = await resolveMemoryStore({ workspaceRoot: root, config: config(), platform: process.platform, home: root, initialize: true }); const captured = await appendMemoryEvent({ store, eventDocument: document() });
  const verified = await appendMemoryEvent({ store, eventDocument: transitionDocument(captured.eventId, "verified", "2026-08-12T01:00:00.000Z") }); const approved = await appendMemoryEvent({ store, eventDocument: transitionDocument(verified.eventId, "approved", "2026-08-12T02:00:00.000Z") });
  const disputedDocument = transitionDocument(approved.eventId, "disputed", "2026-08-12T03:00:00.000Z", { recordOverrides: { approved_by: "reviewer", approval_basis: "review" } }); const disputed = await sealEventForTest(store, disputedDocument); const sourceRoot = path.join(store.root, "v1", "events");
  const initial = await sourceTraversalEntries(sourceRoot); const disputedCommit = `${disputed.relativePath.slice("v1/events/".length)}/commit.json`; const initialOrdinal = initial.indexOf(disputedCommit) + 1; assert.equal(initialOrdinal > 0, true);
  const fillerCount = 10_000 - initialOrdinal; const fillerRoot = path.join(sourceRoot, "00-budget"); await mkdir(fillerRoot);
  for (let offset = 0; offset < fillerCount; offset += 100) await Promise.all(Array.from({ length: Math.min(100, fillerCount - offset) }, (_, index) => writeFile(path.join(fillerRoot, `${String(offset + index).padStart(5, "0")}.entry`), "")));
  const traversal = await sourceTraversalEntries(sourceRoot); assert.equal(traversal.indexOf(disputedCommit) + 1, 10_001);
  const scan = await scanMemoryEvents({ store }); const folded = foldMemoryEvents(scan);
  assert.equal(folded.memories.size, 0); assert.equal(scan.complete, false); assert.deepEqual(scan.events, []); assert.deepEqual(scan.quarantines, []); assert.equal(scan.entriesScanned <= 10_000, true); assert.deepEqual(scan.diagnostics, [{ code: "memory.scan_limit_exceeded" }]);
});

test("sequential event and quarantine retry cardinality does not grow source files", async (t) => {
  const root = await workspace(t); const store = await resolveMemoryStore({ workspaceRoot: root, config: config(), platform: process.platform, home: root, initialize: true }); const eventDocument = document(); const appended = await appendMemoryEvent({ store, eventDocument }); const afterEvent = await sourceTreeSnapshot(store);
  for (let attempt = 0; attempt < 3; attempt += 1) assert.equal((await appendMemoryEvent({ store, eventDocument })).status, "present");
  assert.deepEqual(await sourceTreeSnapshot(store), afterEvent);
  const markerInput = { store, targetMemoryId: record.memory_id, targetEventId: appended.eventId, targetRelativePath: appended.relativePath, observedSha256: appended.fileSha256, reasonCode: "memory.bad", actor: "auditor", now: new Date("2026-08-12T00:00:00.000Z") }; await appendQuarantineMarker(markerInput); const afterMarker = await sourceTreeSnapshot(store);
  for (let attempt = 0; attempt < 3; attempt += 1) assert.equal((await appendQuarantineMarker(markerInput)).status, "present");
  assert.deepEqual(await sourceTreeSnapshot(store), afterMarker); const scan = await scanMemoryEvents({ store }); assert.equal(scan.events.length, 1); assert.equal(scan.quarantines.length, 1);
});

test("different bytes with an existing capture, transition, or resolution operation reject without creating source files", async (t) => {
  {
    const root = await workspace(t); const store = await resolveMemoryStore({ workspaceRoot: root, config: config(), platform: "linux", home: root, initialize: true }); await appendMemoryEvent({ store, eventDocument: document() });
    await assertRejectedWithoutSourceChange(store, () => appendMemoryEvent({ store, eventDocument: document({ reason: "different capture bytes" }) }), "duplicate-operation");
  }
  {
    const root = await workspace(t); const store = await resolveMemoryStore({ workspaceRoot: root, config: config(), platform: "linux", home: root, initialize: true }); const captured = await appendMemoryEvent({ store, eventDocument: document() }); const transition = transitionDocument(captured.eventId, "verified", "2026-08-12T01:00:00.000Z"); await appendMemoryEvent({ store, eventDocument: transition });
    await assertRejectedWithoutSourceChange(store, () => appendMemoryEvent({ store, eventDocument: transitionDocument(captured.eventId, "verified", "2026-08-12T01:00:00.000Z", { recordOverrides: { tags: ["changed-tag"] } }) }), "duplicate-operation");
  }
  {
    const root = await workspace(t); const store = await resolveMemoryStore({ workspaceRoot: root, config: config(), platform: "linux", home: root, initialize: true }); const captured = await appendMemoryEvent({ store, eventDocument: document() }); const verified = await sealTransitionForTest(store, captured.eventId, "verified", "2026-08-12T01:00:00.000Z"); const disputed = await sealTransitionForTest(store, captured.eventId, "disputed", "2026-08-12T02:00:00.000Z"); const verifiedRecord = { ...record, status: "verified", updated_at: "2026-08-12T01:00:00.000Z" }; const resolution = resolutionDocument([verified.eventId, disputed.eventId], verified.eventId, verifiedRecord); await appendMemoryEvent({ store, eventDocument: resolution });
    await assertRejectedWithoutSourceChange(store, () => appendMemoryEvent({ store, eventDocument: resolutionDocument([verified.eventId, disputed.eventId], verified.eventId, { ...verifiedRecord, tags: ["changed-tag"] }) }), "duplicate-operation");
  }
});

test("quarantined exact retries of capture, transition, and resolution reject without creating source files", async (t) => {
  {
    const root = await workspace(t); const store = await resolveMemoryStore({ workspaceRoot: root, config: config(), platform: "linux", home: root, initialize: true }); const capture = document(); const captured = await appendMemoryEvent({ store, eventDocument: capture });
    await appendQuarantineMarker({ store, targetMemoryId: record.memory_id, targetEventId: captured.eventId, targetRelativePath: captured.relativePath, observedSha256: captured.fileSha256, reasonCode: "memory.bad", actor: "auditor" });
    await assertRejectedWithoutSourceChange(store, () => appendMemoryEvent({ store, eventDocument: capture }), "memory.quarantined");
  }
  {
    const root = await workspace(t); const store = await resolveMemoryStore({ workspaceRoot: root, config: config(), platform: "linux", home: root, initialize: true }); const captured = await appendMemoryEvent({ store, eventDocument: document() }); const transition = transitionDocument(captured.eventId, "verified", "2026-08-12T01:00:00.000Z"); const transitioned = await appendMemoryEvent({ store, eventDocument: transition });
    await appendQuarantineMarker({ store, targetMemoryId: record.memory_id, targetEventId: transitioned.eventId, targetRelativePath: transitioned.relativePath, observedSha256: transitioned.fileSha256, reasonCode: "memory.bad", actor: "auditor" });
    await assertRejectedWithoutSourceChange(store, () => appendMemoryEvent({ store, eventDocument: transition }), "memory.quarantined");
  }
  {
    const root = await workspace(t); const store = await resolveMemoryStore({ workspaceRoot: root, config: config(), platform: "linux", home: root, initialize: true }); const captured = await appendMemoryEvent({ store, eventDocument: document() }); const verified = await sealTransitionForTest(store, captured.eventId, "verified", "2026-08-12T01:00:00.000Z"); const disputed = await sealTransitionForTest(store, captured.eventId, "disputed", "2026-08-12T02:00:00.000Z"); const resolution = resolutionDocument([verified.eventId, disputed.eventId], verified.eventId, { ...record, status: "verified", updated_at: "2026-08-12T01:00:00.000Z" }); const resolved = await appendMemoryEvent({ store, eventDocument: resolution });
    await appendQuarantineMarker({ store, targetMemoryId: record.memory_id, targetEventId: resolved.eventId, targetRelativePath: resolved.relativePath, observedSha256: resolved.fileSha256, reasonCode: "memory.bad", actor: "auditor" });
    await assertRejectedWithoutSourceChange(store, () => appendMemoryEvent({ store, eventDocument: resolution }), "memory.quarantined");
  }
});

test("append rejects invalid transition edges without creating source files", async (t) => {
  const cases = [
    ["action-status", ({ captured }) => transitionDocument(captured.eventId, "verified", "2026-08-12T01:00:00.000Z", { recordOverrides: { status: "candidate" } })],
    ["tags", ({ captured }) => transitionDocument(captured.eventId, "verified", "2026-08-12T01:00:00.000Z", { recordOverrides: { tags: ["changed-tag"] } })],
    ["sources", ({ captured }) => transitionDocument(captured.eventId, "verified", "2026-08-12T01:00:00.000Z", { recordOverrides: { sources: [{ ...record.sources[0], sha256: "b".repeat(64) }] } })],
    ["body", ({ captured }) => transitionDocument(captured.eventId, "verified", "2026-08-12T01:00:00.000Z", { sectionOverrides: { "근거": "changed body" } })],
    ["state", ({ captured }) => transitionDocument(captured.eventId, "approved", "2026-08-12T01:00:00.000Z")],
    ["instruction", async ({ store }) => {
      const styleRecord = { ...record, memory_id: "memory-style-instruction-0f2a4c61d9ab34ef", kind: "style-preference", instruction_sha256: "a".repeat(64) }; const captured = await appendMemoryEvent({ store, eventDocument: document({ memory_id: styleRecord.memory_id, operation_id: "capture-style-1", record: styleRecord }) });
      return transitionDocument(captured.eventId, "verified", "2026-08-12T01:00:00.000Z", { memoryId: styleRecord.memory_id, baseRecord: styleRecord, recordOverrides: { instruction_sha256: "b".repeat(64) } });
    }],
  ];
  for (const [, create] of cases) {
    const root = await workspace(t); const store = await resolveMemoryStore({ workspaceRoot: root, config: config(), platform: "linux", home: root, initialize: true }); const captured = await appendMemoryEvent({ store, eventDocument: document() }); const candidate = await create({ store, captured });
    await assertRejectedWithoutSourceChange(store, () => appendMemoryEvent({ store, eventDocument: candidate }), "memory.invalid_event_edge");
  }
});

test("append rejects a resolution whose chosen snapshot mutates immutable fields", async (t) => {
  const root = await workspace(t); const store = await resolveMemoryStore({ workspaceRoot: root, config: config(), platform: "linux", home: root, initialize: true }); const captured = await appendMemoryEvent({ store, eventDocument: document() }); const verified = await sealTransitionForTest(store, captured.eventId, "verified", "2026-08-12T01:00:00.000Z"); const disputed = await sealTransitionForTest(store, captured.eventId, "disputed", "2026-08-12T02:00:00.000Z");
  const mutated = { ...record, status: "verified", updated_at: "2026-08-12T01:00:00.000Z", tags: ["changed-tag"] };
  await assertRejectedWithoutSourceChange(store, () => appendMemoryEvent({ store, eventDocument: resolutionDocument([verified.eventId, disputed.eventId], verified.eventId, mutated) }), "memory.invalid_event_edge");
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
  const verified = await appendMemoryEvent({ store, eventDocument: transitionDocument(captured.eventId, "verified", "2026-08-12T01:00:00.000Z") }); const approved = await appendMemoryEvent({ store, eventDocument: transitionDocument(verified.eventId, "approved", "2026-08-12T02:00:00.000Z") }); const disputed = await appendMemoryEvent({ store, eventDocument: transitionDocument(approved.eventId, "disputed", "2026-08-12T03:00:00.000Z", { recordOverrides: { approved_by: "reviewer", approval_basis: "review" } }) });
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

test("Git exclusion leaves a hard-link victim and its exclude alias unchanged", async (t) => {
  const root = await workspace(t); const victim = path.join(root, "victim"); const exclude = path.join(root, ".git", "info", "exclude"); await mkdir(path.dirname(exclude), { recursive: true }); await writeFile(victim, "user bytes\n"); await link(victim, exclude);
  const runGit = async (args) => args[1] === "--git-common-dir" ? ".git" : exclude;
  const result = await ensureMemoryGitExclusion({ workspaceRoot: root, gitMode: "local", runGit });
  assert.equal(result.status, "warning"); assert.equal(result.code, "memory.git_exclude"); assert.equal(await readFile(victim, "utf8"), "user bytes\n"); assert.equal(await readFile(exclude, "utf8"), "user bytes\n");
});

test("Git common and info ancestor symlinks cannot redirect exclude writes", async (t) => {
  for (const shape of ["common", "info"]) {
    const root = await workspace(t); const outside = path.join(root, "outside"); const logical = path.join(root, `logical-${shape}`); const common = path.join(logical, "common"); await mkdir(path.join(outside, "common", "info"), { recursive: true }); await symlink(outside, logical);
    const victim = path.join(outside, "common", "info", "exclude"); await writeFile(victim, "user bytes\n");
    const runGit = async (args) => args[1] === "--git-common-dir" ? common : victim;
    const result = await ensureMemoryGitExclusion({ workspaceRoot: root, gitMode: "local", runGit });
    assert.equal(result.status, "warning"); assert.equal(await readFile(victim, "utf8"), "user bytes\n");
  }
});

test("Git exclude identity changes before append leave same-inode user bytes unchanged", async (t) => {
  const root = await workspace(t); const exclude = path.join(root, ".git", "info", "exclude"); await mkdir(path.dirname(exclude), { recursive: true }); await writeFile(exclude, "before\n");
  const runGit = async (args) => args[1] === "--git-common-dir" ? ".git" : exclude;
  const result = await ensureMemoryGitExclusion({ workspaceRoot: root, gitMode: "local", runGit, beforeAppend: async () => writeFile(exclude, "changed user bytes\n") });
  assert.equal(result.status, "warning"); assert.equal(await readFile(exclude, "utf8"), "changed user bytes\n");
});

test("Git exclude pathname swaps never report ready", async (t) => {
  const root = await workspace(t); const exclude = path.join(root, ".git", "info", "exclude"); const original = path.join(root, "original-exclude"); const replacement = path.join(root, "replacement-exclude"); await mkdir(path.dirname(exclude), { recursive: true }); await writeFile(exclude, "before\n"); await writeFile(replacement, "replacement user bytes\n");
  const runGit = async (args) => args[1] === "--git-common-dir" ? ".git" : exclude;
  const result = await ensureMemoryGitExclusion({ workspaceRoot: root, gitMode: "local", runGit, beforeFinalRecheck: async () => { await rename(exclude, original); await rename(replacement, exclude); } });
  assert.equal(result.status, "warning"); assert.equal(await readFile(exclude, "utf8"), "replacement user bytes\n"); assert.match(await readFile(original, "utf8"), /game-design-plugin:memory:begin/u);
});

test("Git exclude metadata changes after sync never report ready", async (t) => {
  const root = await workspace(t); const exclude = path.join(root, ".git", "info", "exclude"); const prefix = "before\n"; const suffix = "# game-design-plugin:memory:begin\n.game-design/memory/\n# game-design-plugin:memory:end\n"; await mkdir(path.dirname(exclude), { recursive: true }); await writeFile(exclude, prefix);
  const runGit = async (args) => args[1] === "--git-common-dir" ? ".git" : exclude;
  const result = await ensureMemoryGitExclusion({ workspaceRoot: root, gitMode: "local", runGit, beforeFinalRecheck: async () => utimes(exclude, new Date("2000-01-01T00:00:00.000Z"), new Date("2000-01-01T00:00:00.000Z")) });
  assert.equal(result.status, "warning"); assert.equal(result.code, "memory.git_exclude"); assert.equal(await readFile(exclude, "utf8"), `${prefix}${suffix}`);
});
