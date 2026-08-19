import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { writeSync } from "node:fs";
import { lstat, mkdir, mkdtemp, opendir, readFile, realpath, rename, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import nodeTest from "node:test";
import { fileURLToPath } from "node:url";

import { canonicalMemoryEventDocument, memoryOperationId } from "../../shared/scripts/validate-design-memory.mjs";
import { appendMemoryEvent, resolveMemoryStore } from "../../shared/scripts/lib/safe-memory-store.mjs";
const schemaEvaluatorModuleUrl = process.env.DESIGN_MEMORY_SCHEMA_EVALUATOR_MODULE_URL ?? new URL("../../shared/scripts/lib/memory-schema-evaluator.mjs", import.meta.url).href;
const { validateMemoryIndexSchema, validateMemoryReceiptSchema } = await import(schemaEvaluatorModuleUrl);
const retrievalModuleUrl = process.env.DESIGN_MEMORY_RETRIEVAL_MODULE_URL ?? new URL("../../shared/scripts/retrieve-design-memory.mjs", import.meta.url).href;
const {
  loadCurrentMemoryIndex,
  loadMemoryReceipt,
  loadMemoryLog,
  loadMemoryView,
  listMemoryReceipts,
  publishMemoryIndexGeneration,
  publishMemoryReceiptGeneration,
  publishMemoryLogGeneration,
  publishMemoryViewGeneration,
  rankMemoryEntries,
  rebuildMemoryIndex,
  retrieveApprovedDesignMemory,
  scanDerivedGenerations,
} = await import(retrievalModuleUrl);

const selectedTestName = process.env.DESIGN_MEMORY_RETRIEVAL_SELECTED_TEST;
function test(name, optionsOrFunction, maybeFunction) {
  if (!selectedTestName || name === selectedTestName) return maybeFunction === undefined ? nodeTest(name, optionsOrFunction) : nodeTest(name, optionsOrFunction, maybeFunction);
  const options = typeof optionsOrFunction === "function" ? {} : optionsOrFunction; const operation = typeof optionsOrFunction === "function" ? optionsOrFunction : maybeFunction;
  return nodeTest(name, { ...options, skip: true }, operation);
}

function mutationEvidenceMatches(error, { mutationId, testId, sentinel }, actual, expected) {
  return error instanceof assert.AssertionError && error.code === "ERR_ASSERTION" && error.operator === "strictEqual" && error.message.startsWith(`${sentinel}\n`)
    && Object.is(error.actual, actual) && Object.is(error.expected, expected)
    && process.env.DESIGN_MEMORY_RETRIEVAL_MUTATION_EVIDENCE === "fd-json-v2" && process.env.DESIGN_MEMORY_RETRIEVAL_MUTATION_ID === mutationId
    && process.env.DESIGN_MEMORY_RETRIEVAL_MUTATION_TEST_ID === testId && process.env.DESIGN_MEMORY_RETRIEVAL_MUTATION_SENTINEL === sentinel;
}
function mutationEqual({ mutationId, testId, sentinel }, actual, expected) {
  try { assert.equal(actual, expected, sentinel); } catch (error) { if (mutationEvidenceMatches(error, { mutationId, testId, sentinel }, actual, expected)) writeSync(3, `${JSON.stringify({ mutationId, testId, sentinel, operator: "strictEqual", expected: error.expected, actual: error.actual })}\n`); throw error; }
}

const digest = (value) => createHash("sha256").update(value).digest("hex");
const canonicalBytes = (value) => Buffer.from(`${JSON.stringify(value)}\n`, "utf8");
const config = { enabled: true, scope: "project", gitMode: "local", projectId: "wind-island", maxItems: 5, candidateTtlDays: 30 };
const context = { projectId: "wind-island", lane: "studio", artifactIds: ["combat-loop-v3"], artifactTypes: ["character-skill-combat-monster"], tags: ["boss", "counterplay"], disabledForRequest: false };

async function childPublish({ workspaceRoot, moduleUrl, kind, hash, limits }) {
  const source = `import { ${kind === "view" ? "publishMemoryViewGeneration" : "publishMemoryLogGeneration"} } from ${JSON.stringify(moduleUrl)}; import { resolveMemoryStore } from ${JSON.stringify(new URL("../../shared/scripts/lib/safe-memory-store.mjs", import.meta.url).href)}; const store = await resolveMemoryStore({ workspaceRoot: ${JSON.stringify(workspaceRoot)}, config: ${JSON.stringify(config)}, platform: process.platform, home: ${JSON.stringify(workspaceRoot)} }); const result = await ${kind === "view" ? "publishMemoryViewGeneration" : "publishMemoryLogGeneration"}({ store, sourceTreeSha256: ${JSON.stringify(hash)}, ${kind}Bytes: Buffer.from(${JSON.stringify(`# ${kind}\n`)}), limits: ${JSON.stringify(limits)} }); process.stdout.write(JSON.stringify(result));`;
  const child = spawn(process.execPath, ["--input-type=module", "--eval", source], { stdio: ["ignore", "pipe", "pipe"] }); const stdout = []; const stderr = [];
  return await new Promise((resolve, reject) => { child.stdout.on("data", (chunk) => stdout.push(chunk)); child.stderr.on("data", (chunk) => stderr.push(chunk)); child.once("error", reject); child.once("close", (code) => { if (code !== 0) reject(new Error(Buffer.concat(stderr).toString("utf8"))); else resolve(JSON.parse(Buffer.concat(stdout).toString("utf8"))); }); });
}

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
function capture(sectionValues = sections) {
  return canonicalMemoryEventDocument({ schema_version: 1, event_type: "capture", action: "capture", memory_id: record().memory_id, operation_id: "capture-upstream-1", parent_event_ids: [], effective_at: "2026-08-12T00:00:00.000Z", actor: "author", reason: "capture", record: record() }, sectionValues);
}

function derivedIdentity(kind, first, generationSha256) {
  const chunks = ["memory-derived-identity-v1", kind, first, generationSha256].map((part) => Buffer.from(part, "utf8"));
  return digest(Buffer.concat(chunks.map((chunk) => { const size = Buffer.alloc(8); size.writeBigUInt64BE(BigInt(chunk.byteLength)); return Buffer.concat([size, chunk]); })));
}

async function resealMarkdownGeneration({ store, kind, first, created, bytes }) {
  const root = path.join(store.root, "v1", "derived"); const collection = `${kind}s`; const oldBase = path.join(root, collection, first, created.generationSha256); const generationSha256 = digest(bytes); const newBase = path.join(root, collection, first, generationSha256);
  const instanceId = path.basename(created.generationPath, ".md"); const oldLocal = JSON.parse(await readFile(path.join(oldBase, "_slots", "000.json"), "utf8"));
  await writeFile(path.join(oldBase, "instances", `${instanceId}.md`), bytes); await rename(oldBase, newBase);
  const identitySha256 = derivedIdentity(kind, first, generationSha256); const local = { ...oldLocal, identitySha256, generationSha256 };
  await writeFile(path.join(newBase, "_slots", "000.json"), canonicalBytes(local));
  const globalPath = path.join(root, ".reservations", "global", `${String(local.globalSlot).padStart(5, "0")}.json`); const global = JSON.parse(await readFile(globalPath, "utf8"));
  await writeFile(globalPath, canonicalBytes({ ...global, identitySha256, generationSha256 }));
  return generationSha256;
}

async function resealReceiptGeneration({ store, requestSha256, created, bytes }) {
  const root = path.join(store.root, "v1", "derived"); const oldBase = path.join(root, "receipts", requestSha256, created.receiptSha256); const receiptSha256 = digest(bytes); const newBase = path.join(root, "receipts", requestSha256, receiptSha256);
  const instanceId = path.basename(created.generationPath, ".json"); const oldLocal = JSON.parse(await readFile(path.join(oldBase, "_slots", "000.json"), "utf8"));
  await writeFile(path.join(oldBase, "instances", `${instanceId}.json`), bytes); await rename(oldBase, newBase);
  const identitySha256 = derivedIdentity("receipt", requestSha256, receiptSha256); const local = { ...oldLocal, identitySha256, generationSha256: receiptSha256 };
  await writeFile(path.join(newBase, "_slots", "000.json"), canonicalBytes(local));
  const globalPath = path.join(root, ".reservations", "global", `${String(local.globalSlot).padStart(5, "0")}.json`); const global = JSON.parse(await readFile(globalPath, "utf8"));
  await writeFile(globalPath, canonicalBytes({ ...global, identitySha256, generationSha256: receiptSha256 }));
  return receiptSha256;
}

async function mutateReservation({ store, created, kind = "view", first = "a".repeat(64), scope, mutate }) {
  const root = path.join(store.root, "v1", "derived"); const base = path.join(root, `${kind}s`, first, created.generationSha256); const localPath = path.join(base, "_slots", "000.json"); const local = JSON.parse(await readFile(localPath, "utf8"));
  const candidate = scope === "global" ? path.join(root, ".reservations", "global", `${String(local.globalSlot).padStart(5, "0")}.json`) : localPath;
  const value = JSON.parse(await readFile(candidate, "utf8")); await writeFile(candidate, canonicalBytes(mutate(value)));
  return candidate;
}

function receiptFixture(overrides = {}) {
  return { schemaVersion: 1, requestSha256: "a".repeat(64), sourceTreeSha256: "b".repeat(64), projectId: "wind-island", lane: "studio", policy: { scope: "project", maxItems: 5, candidateTtlDays: 30 }, observations: [], applied: [], excluded: [], ...overrides };
}

function observation(memoryId) { return { memoryId, artifactId: `artifact-${memoryId.slice(-1)}`, locator: `${memoryId}.md#x`, expectedSha256: "c".repeat(64), observedSha256: null, status: "missing" }; }
function applied(memoryId) { return { memoryId, headEventId: `mev1-${"c".repeat(64)}`, fileSha256: "c".repeat(64) }; }
function excluded(memoryId, reason = "excluded") { return { memoryId, reason }; }
function indexEntryFixture(overrides = {}) { return { memoryId: "memory-a", headEventId: `mev1-${"c".repeat(64)}`, headEventPath: "v1/events/a", fileSha256: "c".repeat(64), kind: "decision", lane: "studio", status: "approved", scope: "project", projectId: "wind-island", artifactTypes: [], relatedIds: [], tags: [], ...overrides }; }
function transition(parentEventId, status, sectionValues = sections) {
  const event = { schema_version: 1, event_type: "transition", action: status, memory_id: record().memory_id, parent_event_ids: [parentEventId], effective_at: "2026-08-12T01:00:00.000Z", actor: "reviewer", reason: status, record: record(status) };
  return canonicalMemoryEventDocument({ ...event, operation_id: memoryOperationId(event) }, sectionValues);
}
async function approvedStore(t, sectionValues = sections) {
  const root = await workspace(t);
  await mkdir(path.join(root, "playtest-session-04"));
  await writeFile(path.join(root, "playtest-session-04", "evidence.yml"), "finding-07\n");
  const store = await resolveMemoryStore({ workspaceRoot: root, config, platform: process.platform, home: root, initialize: true });
  const captured = await appendMemoryEvent({ store, eventDocument: capture(sectionValues) });
  const verified = await appendMemoryEvent({ store, eventDocument: transition(captured.eventId, "verified", sectionValues) });
  await appendMemoryEvent({ store, eventDocument: transition(verified.eventId, "approved", sectionValues) });
  return { root, store };
}

async function treeSnapshot(root, relative = "") {
  const directory = relative ? path.join(root, relative) : root; const result = [];
  let handle;
  try { handle = await opendir(directory); } catch (error) { if (error?.code === "ENOENT") return result; throw error; }
  try {
    for await (const entry of handle) {
      const next = relative ? `${relative}/${entry.name}` : entry.name; const absolute = path.join(root, next); const stat = await lstat(absolute);
      if (stat.isDirectory() && !stat.isSymbolicLink()) result.push(...await treeSnapshot(root, next));
      else result.push({ path: next, type: stat.isSymbolicLink() ? "link" : stat.isFile() ? "file" : "other", digest: stat.isFile() ? digest(await readFile(absolute)) : null });
    }
  } finally { await handle.close().catch((error) => error?.code === "ERR_DIR_CLOSED" ? undefined : Promise.reject(error)); }
  return result.sort((left, right) => left.path.localeCompare(right.path));
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
  const census = await scanDerivedGenerations({ store }); assert.equal(census.complete, true, JSON.stringify(census)); const loaded = await loadCurrentMemoryIndex({ store, fold: first.fold });
  assert.equal(loaded.complete, true, JSON.stringify(loaded)); assert.deepEqual(loaded.bytes, first.bytes, JSON.stringify(loaded));
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
  await writeFile(path.join(root, "playtest-session-04", "evidence.yml"), "changed evidence\n");
  const second = await retrieveApprovedDesignMemory({ workspaceRoot: root, config, requestContext: context, now: new Date("2026-08-12T02:00:00.000Z") });
  assert.equal(second.status, "ready"); assert.equal(second.guidance.length, 0); assert.deepEqual(second.excluded, [{ memoryId: record().memory_id, reason: "stale-source" }]);
});

test("retrieval treats a crafted legacy workspace-root fallback source as stale", async (t) => {
  const root = await workspace(t);
  await writeFile(path.join(root, "evidence.yml"), "finding-07\n");
  const store = await resolveMemoryStore({ workspaceRoot: root, config, platform: process.platform, home: root, initialize: true });
  const captured = await appendMemoryEvent({ store, eventDocument: capture() });
  const verified = await appendMemoryEvent({ store, eventDocument: transition(captured.eventId, "verified") });
  await appendMemoryEvent({ store, eventDocument: transition(verified.eventId, "approved") });
  const result = await retrieveApprovedDesignMemory({ workspaceRoot: root, config, requestContext: context, now: new Date("2026-08-12T02:00:00.000Z") });
  assert.equal(result.guidance.length, 0);
  assert.deepEqual(result.excluded, [{ memoryId: record().memory_id, reason: "stale-source" }]);
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

test("global quota namespace symlink is never accepted as derived authority", async (t) => {
  const { store } = await approvedStore(t); const hash = "a".repeat(64);
  const created = await publishMemoryViewGeneration({ store, sourceTreeSha256: hash, viewBytes: Buffer.from("# view\n") }); assert.equal(created.complete, true);
  const outside = await workspace(t); await mkdir(path.join(outside, "reservations", "global"), { recursive: true });
  await rm(path.join(store.root, "v1", "derived", ".reservations"), { recursive: true }); await symlink(path.join(outside, "reservations"), path.join(store.root, "v1", "derived", ".reservations"));
  const scan = await scanDerivedGenerations({ store }); assert.equal(scan.complete, false);
  const loaded = await loadMemoryView({ store, sourceTreeSha256: hash, viewSha256: created.generationSha256 }); assert.equal(loaded.complete, false);
});

test("local quota namespace symlink is never accepted as derived authority", async (t) => {
  const { store } = await approvedStore(t); const hash = "a".repeat(64);
  const created = await publishMemoryViewGeneration({ store, sourceTreeSha256: hash, viewBytes: Buffer.from("# view\n") });
  assert.equal(created.complete, true);
  const localSlots = path.join(store.root, "v1", "derived", "views", hash, created.generationSha256, "_slots");
  const outside = await workspace(t); await mkdir(path.join(outside, "slots"));
  await rm(localSlots, { recursive: true }); await symlink(path.join(outside, "slots"), localSlots);
  const scan = await scanDerivedGenerations({ store });
  assert.equal(scan.complete, false); assert.equal(scan.warnings.some((item) => item.code === "memory.derived_reservation_invalid"), true);
  const loaded = await loadMemoryView({ store, sourceTreeSha256: hash, viewSha256: created.generationSha256 });
  assert.equal(loaded.complete, false);
});

test("a local reservation relocated across source request or generation bases grants neither side authority", async (t) => {
  for (const [kind, movedPart] of [["view", "first"], ["view", "generation"], ["receipt", "first"], ["receipt", "generation"]]) {
    const { store } = await approvedStore(t); const first = "a".repeat(64); const bytes = kind === "view" ? Buffer.from("# view\n") : canonicalBytes(receiptFixture());
    const created = kind === "view" ? await publishMemoryViewGeneration({ store, sourceTreeSha256: first, viewBytes: bytes }) : await publishMemoryReceiptGeneration({ store, requestSha256: first, receiptBytes: bytes }); const generation = kind === "view" ? created.generationSha256 : created.receiptSha256; assert.equal(created.complete, true);
    const collection = kind === "view" ? "views" : "receipts"; const targetFirst = movedPart === "first" ? "b".repeat(64) : first; const targetGeneration = movedPart === "generation" ? "b".repeat(64) : generation;
    const derived = path.join(store.root, "v1", "derived"); const local = path.join(derived, collection, first, generation, "_slots", "000.json"); const target = path.join(derived, collection, targetFirst, targetGeneration, "_slots", "000.json"); await mkdir(path.dirname(target), { recursive: true }); await rename(local, target);
    if (movedPart === "first") { const instanceName = path.basename(created.generationPath); const targetInstance = path.join(derived, collection, targetFirst, targetGeneration, "instances", instanceName); await mkdir(path.dirname(targetInstance), { recursive: true }); await writeFile(targetInstance, bytes); }
    const scan = await scanDerivedGenerations({ store }); assert.equal(scan.complete, true, `${kind}/${movedPart}`); assert.equal(scan.warnings.some((item) => item.code === "memory.derived_reservation_invalid"), true, `${kind}/${movedPart}`);
    const original = kind === "view" ? await loadMemoryView({ store, sourceTreeSha256: first, viewSha256: generation }) : await loadMemoryReceipt({ store, requestSha256: first, receiptSha256: generation }); mutationEqual({ mutationId: "local-path", testId: "relocated-local-path", sentinel: "MEM-RET-MUT-LOCAL-PATH" }, original.status, "corrupt");
    const moved = kind === "view" ? await loadMemoryView({ store, sourceTreeSha256: targetFirst, viewSha256: targetGeneration }) : await loadMemoryReceipt({ store, requestSha256: targetFirst, receiptSha256: targetGeneration }); assert.notEqual(moved.status, "ready", `${kind}/${movedPart}`);
  }
});

test("one global reservation grants only the bytewise-lowest exact local path authority", async (t) => {
  const { store } = await approvedStore(t); const first = "a".repeat(64); const created = await publishMemoryViewGeneration({ store, sourceTreeSha256: first, viewBytes: Buffer.from("# view\n") }); assert.equal(created.complete, true);
  const base = path.join(store.root, "v1", "derived", "views", first, created.generationSha256); const original = JSON.parse(await readFile(path.join(base, "_slots", "000.json"), "utf8"));
  for (const localSlot of [2, 1]) await writeFile(path.join(base, "_slots", `${String(localSlot).padStart(3, "0")}.json`), canonicalBytes({ ...original, localSlot }));
  const scan = await scanDerivedGenerations({ store });
  assert.equal(scan.complete, true); mutationEqual({ mutationId: "local-path", testId: "duplicate-global-local-path", sentinel: "MEM-RET-MUT-LOCAL-PATH" }, scan.warnings.filter((item) => item.code === "memory.derived_reservation_invalid").length >= 2, true);
  const loaded = await loadMemoryView({ store, sourceTreeSha256: first, viewSha256: created.generationSha256 });
  assert.equal(loaded.status, "ready"); assert.equal(loaded.generationPath, created.generationPath);
});

test("view and log writers reject six malformed Markdown forms without derived growth", async (t) => {
  const { store } = await approvedStore(t); const hash = "a".repeat(64);
  const malformed = [Buffer.from([0xef, 0xbb, 0xbf, 0x23, 0x0a]), Buffer.from([0xff, 0x0a]), Buffer.from("# a\0\n"), Buffer.from("# a\r\n"), Buffer.from("# a"), Buffer.from("# a\n\n")];
  for (const [publish, label] of [[publishMemoryViewGeneration, "view"], [publishMemoryLogGeneration, "log"]]) for (const bytes of malformed) {
    const before = await treeSnapshot(path.join(store.root, "v1", "derived")); const rejected = await publish({ store, sourceTreeSha256: hash, [`${label}Bytes`]: bytes });
    assert.equal(rejected.complete, false, label); assert.deepEqual(await treeSnapshot(path.join(store.root, "v1", "derived")), before, label);
  }
});

test("view and log loaders reach the Markdown validator for six consistently resealed malformed forms", async (t) => {
  const malformed = [Buffer.from([0xef, 0xbb, 0xbf, 0x23, 0x0a]), Buffer.from([0xff, 0x0a]), Buffer.from("# a\0\n"), Buffer.from("# a\r\n"), Buffer.from("# a"), Buffer.from("# a\n\n")];
  for (const [publish, loadGeneration, kind] of [[publishMemoryViewGeneration, loadMemoryView, "view"], [publishMemoryLogGeneration, loadMemoryLog, "log"]]) for (const bytes of malformed) {
    const { store } = await approvedStore(t); const first = "a".repeat(64); const created = await publish({ store, sourceTreeSha256: first, [`${kind}Bytes`]: Buffer.from(`# ${kind}\n`) }); assert.equal(created.complete, true);
    const generationSha256 = await resealMarkdownGeneration({ store, kind, first, created, bytes }); const beforeLoad = await treeSnapshot(path.join(store.root, "v1", "derived"));
    const loaded = kind === "view" ? await loadGeneration({ store, sourceTreeSha256: first, viewSha256: generationSha256 }) : await loadGeneration({ store, sourceTreeSha256: first, logSha256: generationSha256 });
    mutationEqual({ mutationId: "markdown-loader", testId: "resealed-markdown-loader", sentinel: "MEM-RET-MUT-MARKDOWN-LOADER" }, loaded.status, "corrupt"); assert.equal(loaded.warnings[0].code, "memory.derived_generation_invalid", kind); assert.deepEqual(await treeSnapshot(path.join(store.root, "v1", "derived")), beforeLoad, kind);
  }
});

test("sealed head path, commit, claim, instance, and fileSha256-only claim mutations cannot produce guidance or a receipt", async (t) => {
  for (const mutation of ["path", "commit", "claim", "instance", "digest"]) {
    const { root, store } = await approvedStore(t); const rebuilt = await rebuildMemoryIndex({ workspaceRoot: root, config });
    assert.equal(rebuilt.complete, true); const head = rebuilt.index.entries[0]; const eventRoot = path.join(store.root, head.headEventPath); const instanceRelative = (await treeSnapshot(eventRoot)).find((item) => item.path.startsWith("instances/") && item.path.endsWith(".md"))?.path; assert.ok(instanceRelative, mutation); const instancePath = path.join(eventRoot, instanceRelative);
    if (mutation === "path") await rename(eventRoot, path.join(path.dirname(eventRoot), "moved"));
    else if (mutation === "commit") await writeFile(path.join(eventRoot, "commit.json"), "{}\n");
    else if (mutation === "claim") await writeFile(path.join(eventRoot, "claims", `${path.basename(instancePath, ".md")}.json`), "{}\n");
    else if (mutation === "digest") { const claimPath = path.join(eventRoot, "claims", `${path.basename(instancePath, ".md")}.json`); const claim = JSON.parse(await readFile(claimPath, "utf8")); await writeFile(claimPath, canonicalBytes({ ...claim, fileSha256: "0".repeat(64) })); }
    else await writeFile(instancePath, "# altered\n");
    const before = await treeSnapshot(path.join(store.root, "v1", "events")); const receiptsBefore = await treeSnapshot(path.join(store.root, "v1", "derived", "receipts"));
    const result = await retrieveApprovedDesignMemory({ workspaceRoot: root, config, requestContext: context });
    assert.equal(result.guidance.length, 0, mutation); assert.notEqual(result.status, "ready", mutation);
    assert.deepEqual(await treeSnapshot(path.join(store.root, "v1", "events")), before, mutation);
    assert.deepEqual(await treeSnapshot(path.join(store.root, "v1", "derived", "receipts")), receiptsBefore, mutation);
  }
});

test("separate Node publishers preserve equivalent history and enforce final local and global slots", async (t) => {
  const { root, store } = await approvedStore(t); const hash = "a".repeat(64); const moduleUrl = new URL("../../shared/scripts/retrieve-design-memory.mjs", import.meta.url).href; const leak = path.join(store.root, "v1", "derived", ".reservations", "global", "00000.json"); await mkdir(path.dirname(leak), { recursive: true }); await writeFile(leak, "leak\n");
  const limits = { maxGenerationReservations: 3 }; const contenders = await Promise.all([childPublish({ workspaceRoot: root, moduleUrl, kind: "view", hash, limits }), childPublish({ workspaceRoot: root, moduleUrl, kind: "view", hash, limits })]);
  assert.equal(contenders.every((result) => result.complete && ["created", "present"].includes(result.status)), true, JSON.stringify(contenders)); assert.equal(new Set(contenders.map((result) => result.generationSha256)).size, 1); assert.equal(contenders[0].generationSha256, digest("# view\n"));
  const exact = await loadMemoryView({ store, sourceTreeSha256: hash, viewSha256: contenders[0].generationSha256, limits }); assert.equal(exact.status, "ready"); assert.deepEqual(exact.bytes, Buffer.from("# view\n"));
  const concurrentTree = await treeSnapshot(path.join(store.root, "v1", "derived")); const physicalInstances = concurrentTree.filter((item) => item.path.startsWith(`views/${hash}/${contenders[0].generationSha256}/instances/`)).length; const physicalLocalSlots = concurrentTree.filter((item) => item.path.startsWith(`views/${hash}/${contenders[0].generationSha256}/_slots/`)).length;
  assert.equal(physicalInstances >= 1 && physicalInstances <= contenders.length, true); assert.equal(physicalLocalSlots, physicalInstances); assert.equal(concurrentTree.filter((item) => item.path.startsWith(".reservations/global/")).length <= limits.maxGenerationReservations, true); assert.deepEqual(await readFile(leak), Buffer.from("leak\n"));
  const sequential = await childPublish({ workspaceRoot: root, moduleUrl, kind: "view", hash, limits }); assert.equal(sequential.status, "present"); assert.equal(sequential.generationPath, exact.generationPath); assert.deepEqual(await treeSnapshot(path.join(store.root, "v1", "derived")), concurrentTree); assert.deepEqual(await readFile(leak), Buffer.from("leak\n"));
  const { root: localRoot } = await approvedStore(t); const localHash = "b".repeat(64); const localLimits = { maxIdentityInstances: 1 };
  const local = await Promise.all([childPublish({ workspaceRoot: localRoot, moduleUrl, kind: "log", hash: localHash, limits: localLimits }), childPublish({ workspaceRoot: localRoot, moduleUrl, kind: "log", hash: localHash, limits: localLimits })]);
  assert.equal(local.filter((result) => result.status === "created").length, 1, JSON.stringify(local)); assert.equal(local.every((result) => result.complete && ["created", "present"].includes(result.status) || !result.complete && result.warnings[0].code === "memory.derived_limit_exceeded"), true, JSON.stringify(local)); const localTree = await treeSnapshot(path.join(localRoot, ".game-design", "memory", "v1", "derived")); const localSequential = await childPublish({ workspaceRoot: localRoot, moduleUrl, kind: "log", hash: localHash, limits: localLimits }); assert.equal(localSequential.status, "present"); assert.deepEqual(await treeSnapshot(path.join(localRoot, ".game-design", "memory", "v1", "derived")), localTree);
  const { root: globalRoot } = await approvedStore(t); const globalLimits = { maxGenerationReservations: 1 }; const global = await Promise.all([childPublish({ workspaceRoot: globalRoot, moduleUrl, kind: "view", hash: "c".repeat(64), limits: globalLimits }), childPublish({ workspaceRoot: globalRoot, moduleUrl, kind: "log", hash: "d".repeat(64), limits: globalLimits })]);
  assert.equal(global.filter((result) => result.complete).length, 1); assert.equal(global.find((result) => !result.complete).warnings[0].code, "memory.derived_limit_exceeded");
});

test("fixed reservation slot leaks consume quota without making the derived census incomplete", async (t) => {
  for (const mutation of ["empty", "oversize", "special", "leak"]) {
    const { store } = await approvedStore(t); const created = await publishMemoryViewGeneration({ store, sourceTreeSha256: "a".repeat(64), viewBytes: Buffer.from("# view\n") }); assert.equal(created.complete, true);
    const global = path.join(store.root, "v1", "derived", ".reservations", "global", "00000.json");
    if (mutation === "empty") await writeFile(global, "");
    else if (mutation === "oversize") await writeFile(global, "x".repeat(4097));
    else if (mutation === "special") { await rm(global); await mkdir(global); }
    else { const localDirectory = path.join(store.root, "v1", "derived", "views", "a".repeat(64), created.generationSha256, "_slots"); const name = (await treeSnapshot(localDirectory))[0]?.path; assert.ok(name); await rm(path.join(localDirectory, name)); }
    const scan = await scanDerivedGenerations({ store }); mutationEqual({ mutationId: "leak-complete", testId: "reservation-leak-complete", sentinel: "MEM-RET-MUT-LEAK-COMPLETE" }, scan.complete, true); assert.equal(scan.warnings.some((item) => item.code === "memory.derived_reservation_invalid"), true, mutation);
    const healthy = await publishMemoryLogGeneration({ store, sourceTreeSha256: "b".repeat(64), logBytes: Buffer.from("# unrelated\n") });
    assert.equal(healthy.complete, true, mutation);
  }
});

test("receipt history retains distinct exact pairs while corrupt siblings do not replace valid evidence", async (t) => {
  const { root, store } = await approvedStore(t); const rebuilt = await rebuildMemoryIndex({ workspaceRoot: root, config }); const before = rebuilt.sourceTreeSha256; const requestSha256 = "a".repeat(64);
  const receipt = (memoryId) => Buffer.from(`${JSON.stringify({ schemaVersion: 1, requestSha256, sourceTreeSha256: before, projectId: "wind-island", lane: "studio", policy: { scope: "project", maxItems: 5, candidateTtlDays: 30 }, observations: [], applied: [{ memoryId, headEventId: rebuilt.index.entries[0].headEventId, fileSha256: rebuilt.index.entries[0].fileSha256 }], excluded: [] })}\n`);
  const first = await publishMemoryReceiptGeneration({ store, requestSha256, receiptBytes: receipt("memory-a") }); const second = await publishMemoryReceiptGeneration({ store, requestSha256, receiptBytes: receipt("memory-b") }); assert.equal(first.complete && second.complete, true);
  const instances = path.join(store.root, "v1", "derived", "receipts", requestSha256, second.receiptSha256, "instances");
  await writeFile(path.join(instances, "00000000-0000-4000-8000-000000000000.json"), "{}\n");
  await symlink(path.join(root, "evidence.yml"), path.join(instances, "00000000-0000-4000-8000-000000000001.json"));
  await mkdir(path.join(instances, "00000000-0000-4000-8000-000000000002.json"));
  await writeFile(path.join(instances, "00000000-0000-4000-8000-000000000003.json"), Buffer.from([0xff]));
  await writeFile(path.join(instances, "00000000-0000-4000-8000-000000000004.json"), Buffer.alloc(256 * 1024 + 1, 0x78));
  await writeFile(path.join(instances, "00000000-0000-4000-8000-000000000005.json"), Buffer.concat([receipt("memory-b"), Buffer.from("\n")]));
  await writeFile(path.join(instances, "00000000-0000-4000-8000-000000000006.json"), receipt("memory-c"));
  const exact = await loadMemoryReceipt({ store, requestSha256, receiptSha256: first.receiptSha256 }); assert.equal(exact.status, "ready"); assert.equal(exact.receipt.applied[0].memoryId, "memory-a");
  const history = await listMemoryReceipts({ store, requestSha256 }); assert.equal(history.items.length, 2); mutationEqual({ mutationId: "receipt-physical-count", testId: "receipt-physical-siblings", sentinel: "MEM-RET-MUT-RECEIPT-COUNT" }, history.items.find((item) => item.receiptSha256 === second.receiptSha256).corruptInstanceCount, 7);
  assert.deepEqual(history.warnings.filter((item) => item.code === "memory.derived_generation_invalid").map((item) => item.relativePath).sort(), Array.from({ length: 7 }, (_, index) => `receipts/${requestSha256}/${second.receiptSha256}/instances/00000000-0000-4000-8000-00000000000${index}.json`));
  assert.equal((await rebuildMemoryIndex({ workspaceRoot: root, config })).sourceTreeSha256, before);
});

test("runtime validators execute packaged schemas with canonical Unicode and semantic array parity", async (t) => {
  const root = fileURLToPath(new URL("../..", import.meta.url)); const [indexSchema, receiptSchema] = await Promise.all([readFile(path.join(root, "shared/memory/schema/memory-index.schema.json"), "utf8").then(JSON.parse), readFile(path.join(root, "shared/memory/schema/memory-receipt.schema.json"), "utf8").then(JSON.parse)]);
  assert.equal(indexSchema.properties.entries.items.properties.artifactTypes.uniqueItems, true); assert.equal(receiptSchema.properties.observations.maxItems, 256); assert.equal(receiptSchema.properties.applied.maxItems, 256); assert.equal(receiptSchema.properties.excluded.maxItems, 256); assert.equal(receiptSchema.properties.excluded.items.properties.reason.maxLength, 1024);
  const canonical = { schemaVersion: 1, requestSha256: "a".repeat(64), sourceTreeSha256: "b".repeat(64), projectId: "wind-island", lane: "studio", policy: { scope: "project", maxItems: 5, candidateTtlDays: 30 }, observations: [], applied: [], excluded: [] };
  const bytes = Buffer.from(`${JSON.stringify(canonical)}\n`); const { store } = await approvedStore(t); assert.equal(validateMemoryReceiptSchema(canonical), true); const valid = await publishMemoryReceiptGeneration({ store, requestSha256: canonical.requestSha256, receiptBytes: bytes, limits: { maxReceiptObservationItems: 1, maxReceiptAppliedItems: 1, maxReceiptExcludedItems: 1 } }); assert.equal(valid.complete, true);
  for (const [key, entry] of [["observations", { memoryId: "memory-a", artifactId: "artifact-a", locator: "a.md#x", expectedSha256: "c".repeat(64), observedSha256: null, status: "missing" }], ["applied", { memoryId: "memory-a", headEventId: "mev1-" + "c".repeat(64), fileSha256: "c".repeat(64) }], ["excluded", { memoryId: "memory-a", reason: "excluded" }]]) {
    const value = { ...canonical, [key]: [entry, { ...entry, memoryId: "memory-b" }] }; const rejected = await publishMemoryReceiptGeneration({ store, requestSha256: canonical.requestSha256, receiptBytes: Buffer.from(`${JSON.stringify(value)}\n`), limits: { [`maxReceipt${key[0].toUpperCase()}${key.slice(1)}Items`]: 1 } }); assert.equal(rejected.complete, false, key);
  }
  const exactEmojiReason = { ...canonical, excluded: [{ memoryId: "memory-a", reason: "😀".repeat(1024) }] };
  mutationEqual({ mutationId: "schema-code-points", testId: "emoji-code-point-limit", sentinel: "MEM-RET-MUT-SCHEMA-CODE-POINTS" }, validateMemoryReceiptSchema(exactEmojiReason), true); assert.equal((await publishMemoryReceiptGeneration({ store, requestSha256: canonical.requestSha256, receiptBytes: Buffer.from(`${JSON.stringify(exactEmojiReason)}\n`) })).complete, true);
  for (const value of [
    { ...canonical, extra: true },
    { ...canonical, excluded: [{ memoryId: "memory-a", reason: "😀".repeat(1025) }] },
    { ...canonical, excluded: [{ memoryId: "memory-a", reason: "e\u0301" }] },
    { ...canonical, applied: [{ memoryId: "memory-b", headEventId: "mev1-" + "c".repeat(64), fileSha256: "c".repeat(64) }, { memoryId: "memory-a", headEventId: "mev1-" + "c".repeat(64), fileSha256: "c".repeat(64) }] },
  ]) { assert.equal(validateMemoryReceiptSchema(value), false); assert.equal((await publishMemoryReceiptGeneration({ store, requestSha256: canonical.requestSha256, receiptBytes: Buffer.from(`${JSON.stringify(value)}\n`) })).complete, false); }
  const validIndex = { schemaVersion: 1, sourceTreeSha256: "a".repeat(64), entries: [] }; assert.equal(validateMemoryIndexSchema(validIndex), true); assert.equal(validateMemoryIndexSchema({ ...validIndex, entries: [{ memoryId: "memory-b", headEventId: "mev1-" + "b".repeat(64), headEventPath: "v1/events/a", fileSha256: "b".repeat(64), kind: "decision", lane: "studio", status: "approved", scope: "project", projectId: "wind-island", artifactTypes: ["z", "a"], relatedIds: [], tags: [] }] }), false);
});

test("receipt observation status and digest matrix is identical for evaluator publisher and loader", async (t) => {
  const { store } = await approvedStore(t); const requestSha256 = "a".repeat(64); const expectedSha256 = "c".repeat(64); const differentSha256 = "d".repeat(64);
  const variants = [["equal", expectedSha256], ["different", differentSha256], ["null", null]];
  const validFor = { current: "equal", drift: "different", missing: "null", symlink: "null", unreadable: "null" };
  for (const status of Object.keys(validFor)) for (const [variant, observedSha256] of variants) {
    const candidate = receiptFixture({ observations: [{ memoryId: "memory-a", artifactId: "artifact-a", locator: "a.md#x", expectedSha256, observedSha256, status }] }); const expected = variant === validFor[status];
    mutationEqual({ mutationId: "receipt-observation-semantic", testId: "observation-status-digest-matrix", sentinel: "MEM-RET-MUT-OBSERVATION-SEMANTIC" }, validateMemoryReceiptSchema(candidate), expected);
    const published = await publishMemoryReceiptGeneration({ store, requestSha256, receiptBytes: canonicalBytes(candidate) });
    assert.equal(published.complete, expected, `${status}/${variant}/publisher`);
    if (expected) {
      assert.equal((await loadMemoryReceipt({ store, requestSha256, receiptSha256: published.receiptSha256 })).status, "ready", `${status}/${variant}/loader`);
    } else {
      const valid = receiptFixture({ observations: [{ ...candidate.observations[0], observedSha256: validFor[status] === "null" ? null : validFor[status] === "equal" ? expectedSha256 : differentSha256 }] });
      const base = await publishMemoryReceiptGeneration({ store, requestSha256, receiptBytes: canonicalBytes(valid) }); assert.equal(base.complete, true, `${status}/${variant}/base`);
      const receiptSha256 = await resealReceiptGeneration({ store, requestSha256, created: base, bytes: canonicalBytes(candidate) });
      assert.equal((await loadMemoryReceipt({ store, requestSha256, receiptSha256 })).status, "corrupt", `${status}/${variant}/loader`);
    }
  }
});

test("receipt evaluator returns false for null and non-object observations", () => {
  for (const observationValue of [null, "not-an-observation", 1, true]) {
    assert.equal(validateMemoryReceiptSchema(receiptFixture({ observations: [observationValue] })), false);
  }
});

test("schema evaluator imports from an installed layout when authoring schemas are absent", async (t) => {
  const root = fileURLToPath(new URL("../..", import.meta.url)); const installed = await workspace(t); const evaluator = path.join(installed, "scripts", "lib", "memory-schema-evaluator.mjs"); const schemaRoot = path.join(installed, "references", "shared", "memory", "schema");
  await mkdir(path.dirname(evaluator), { recursive: true }); await mkdir(schemaRoot, { recursive: true });
  await writeFile(evaluator, await readFile(path.join(root, "shared", "scripts", "lib", "memory-schema-evaluator.mjs")));
  for (const name of ["memory-index.schema.json", "memory-receipt.schema.json"]) await writeFile(path.join(schemaRoot, name), await readFile(path.join(root, "shared", "memory", "schema", name)));
  const installedEvaluator = await import(`${new URL(`file://${evaluator}`).href}?smoke=${Date.now()}`);
  assert.equal(installedEvaluator.validateMemoryIndexSchema({ schemaVersion: 1, sourceTreeSha256: "a".repeat(64), entries: [] }), true);
  assert.equal(installedEvaluator.validateMemoryReceiptSchema(receiptFixture()), true);
});

test("packaged observation digest relation annotation is mandatory evaluator authority", async (t) => {
  const root = fileURLToPath(new URL("../..", import.meta.url)); const installed = await workspace(t); const evaluator = path.join(installed, "scripts", "lib", "memory-schema-evaluator.mjs"); const schemaRoot = path.join(installed, "references", "shared", "memory", "schema");
  await mkdir(path.dirname(evaluator), { recursive: true }); await mkdir(schemaRoot, { recursive: true }); await writeFile(evaluator, await readFile(path.join(root, "shared", "scripts", "lib", "memory-schema-evaluator.mjs")));
  for (const name of ["memory-index.schema.json", "memory-receipt.schema.json"]) { const schema = JSON.parse(await readFile(path.join(root, "shared", "memory", "schema", name), "utf8")); if (name === "memory-receipt.schema.json") schema.properties.observations.items["x-memory-observation-digest-relation"] = false; await writeFile(path.join(schemaRoot, name), canonicalBytes(schema)); }
  await assert.rejects(() => import(`${new URL(`file://${evaluator}`).href}?missing-relation=${Date.now()}`), /memory schema unavailable/u);
});

test("receipt arrays accept exactly 256 items and reject limit plus one in schema and publisher", async (t) => {
  const { store } = await approvedStore(t);
  for (const [key, make] of [["observations", observation], ["applied", applied], ["excluded", excluded]]) {
    const exact = receiptFixture({ [key]: Array.from({ length: 256 }, (_, index) => make(`memory-${String(index).padStart(3, "0")}`)) }); const overflow = receiptFixture({ [key]: [...exact[key], make("memory-256")] });
    assert.equal(validateMemoryReceiptSchema(exact), true, key); assert.equal((await publishMemoryReceiptGeneration({ store, requestSha256: exact.requestSha256, receiptBytes: canonicalBytes(exact) })).complete, true, key);
    assert.equal(validateMemoryReceiptSchema(overflow), false, key); assert.equal((await publishMemoryReceiptGeneration({ store, requestSha256: overflow.requestSha256, receiptBytes: canonicalBytes(overflow) })).complete, false, key);
  }
});

test("receipt arrays reject semantic duplicates and reordering in schema and publisher", async (t) => {
  const { store } = await approvedStore(t);
  for (const [key, make] of [["observations", observation], ["applied", applied], ["excluded", excluded]]) for (const value of [receiptFixture({ [key]: [make("memory-a"), make("memory-a")] }), receiptFixture({ [key]: [make("memory-b"), make("memory-a")] })]) {
    assert.equal(validateMemoryReceiptSchema(value), false, key); assert.equal((await publishMemoryReceiptGeneration({ store, requestSha256: value.requestSha256, receiptBytes: canonicalBytes(value) })).complete, false, key);
  }
});

test("packaged index and receipt schemas reject closed-key canonical field violations at runtime", async (t) => {
  const { store } = await approvedStore(t); const receiptCases = [
    { ...receiptFixture(), extra: true }, receiptFixture({ requestSha256: "x".repeat(64) }), receiptFixture({ sourceTreeSha256: "x".repeat(64) }), receiptFixture({ projectId: "Bad" }), receiptFixture({ lane: "unknown" }),
    receiptFixture({ observations: [{ ...observation("memory-a"), locator: "../a.md" }] }), receiptFixture({ observations: [{ ...observation("memory-a"), expectedSha256: "x".repeat(64) }] }), receiptFixture({ observations: [{ ...observation("memory-a"), status: "unknown" }] }),
    receiptFixture({ excluded: [excluded("memory-a", "e\u0301")] }), receiptFixture({ excluded: [excluded("memory-a", "nul\0")] }), receiptFixture({ excluded: [excluded("memory-a", "cr\r")] }), receiptFixture({ excluded: [excluded("memory-a", "bom\uFEFF")] }), receiptFixture({ excluded: [excluded("memory-a", "")] }),
  ];
  for (const value of receiptCases) { assert.equal(validateMemoryReceiptSchema(value), false); assert.equal((await publishMemoryReceiptGeneration({ store, requestSha256: value.requestSha256 === "x".repeat(64) ? "a".repeat(64) : value.requestSha256, receiptBytes: canonicalBytes(value) })).complete, false); }
  const validIndex = { schemaVersion: 1, sourceTreeSha256: "a".repeat(64), entries: [indexEntryFixture()] }; const indexCases = [
    { ...validIndex, extra: true }, { ...validIndex, sourceTreeSha256: "x".repeat(64) }, { ...validIndex, entries: [{ ...indexEntryFixture(), extra: true }] }, { ...validIndex, entries: [indexEntryFixture({ memoryId: "Bad" })] },
    { ...validIndex, entries: [indexEntryFixture({ headEventId: "bad" })] }, { ...validIndex, entries: [indexEntryFixture({ headEventPath: "../bad" })] }, { ...validIndex, entries: [indexEntryFixture({ fileSha256: "bad" })] }, { ...validIndex, entries: [indexEntryFixture({ tags: ["z", "a"] })] },
  ];
  for (const value of indexCases) { assert.equal(validateMemoryIndexSchema(value), false); assert.equal((await publishMemoryIndexGeneration({ store, sourceTreeSha256: "a".repeat(64), indexBytes: canonicalBytes(value) })).complete, false); }
});

test("reservation files preserve the approved seven-key global-first local-second format", async (t) => {
  const { store } = await approvedStore(t); const first = "a".repeat(64); const created = await publishMemoryViewGeneration({ store, sourceTreeSha256: first, viewBytes: Buffer.from("# view\n") }); const root = path.join(store.root, "v1", "derived");
  const global = JSON.parse(await readFile(path.join(root, ".reservations", "global", "00000.json"), "utf8")); const local = JSON.parse(await readFile(path.join(root, "views", first, created.generationSha256, "_slots", "000.json"), "utf8"));
  assert.deepEqual(Object.keys(global), ["schemaVersion", "kind", "identitySha256", "generationSha256", "globalSlot", "localSlot", "instanceId"]); assert.equal(global.localSlot, null); assert.equal(global.globalSlot, 0);
  assert.deepEqual(Object.keys(local), Object.keys(global)); assert.equal(local.globalSlot, 0); assert.equal(local.localSlot, 0); assert.equal(local.instanceId, global.instanceId);
});

test("global and local malformed reservation matrix consumes slots without granting authority", async (t) => {
  const mutations = [
    ["empty", async (candidate) => writeFile(candidate, "")], ["oversize", async (candidate) => writeFile(candidate, "x".repeat(4097))], ["malformed-json", async (candidate) => writeFile(candidate, "{\n")],
    ["symlink", async (candidate, root) => { await rm(candidate); await symlink(path.join(root, "evidence.yml"), candidate); }], ["special", async (candidate) => { await rm(candidate); await mkdir(candidate); }],
  ];
  const fieldMutations = [["schemaVersion", () => 2], ["kind", () => "log"], ["identitySha256", () => "f".repeat(64)], ["generationSha256", () => "f".repeat(64)], ["globalSlot", (value) => value === 0 ? 1 : 0], ["localSlot", (value) => value === null ? 0 : 1], ["instanceId", () => "00000000-0000-4000-8000-000000000000"]];
  for (const scope of ["global", "local"]) {
    for (const [name, mutateFile] of mutations) {
      const { root, store } = await approvedStore(t); const first = "a".repeat(64); const created = await publishMemoryViewGeneration({ store, sourceTreeSha256: first, viewBytes: Buffer.from("# view\n") }); const candidate = await mutateReservation({ store, created, first, scope, mutate: (value) => value }); await mutateFile(candidate, root);
      const scan = await scanDerivedGenerations({ store, limits: { maxGenerationReservations: 2, maxIdentityInstances: 2 } }); assert.equal(scan.complete, true, `${scope}/${name}`); assert.equal(scan.warnings.some((item) => item.code === "memory.derived_reservation_invalid"), true, `${scope}/${name}`);
      assert.equal((await loadMemoryView({ store, sourceTreeSha256: first, viewSha256: created.generationSha256, limits: { maxGenerationReservations: 2, maxIdentityInstances: 2 } })).status, "corrupt", `${scope}/${name}`);
      const beforePublish = await scanDerivedGenerations({ store, limits: { maxGenerationReservations: 2, maxIdentityInstances: 2 } }); const healthy = await publishMemoryLogGeneration({ store, sourceTreeSha256: "b".repeat(64), logBytes: Buffer.from("# healthy\n"), limits: { maxGenerationReservations: 2, maxIdentityInstances: 2 } }); assert.equal(healthy.complete, true, `${scope}/${name}: publish ${JSON.stringify(healthy)} after scan ${JSON.stringify(beforePublish.complete)}/${JSON.stringify(beforePublish.warnings)}`);
    }
    for (const [field, replacement] of fieldMutations) {
      const { store } = await approvedStore(t); const first = "a".repeat(64); const created = await publishMemoryViewGeneration({ store, sourceTreeSha256: first, viewBytes: Buffer.from("# view\n") }); await mutateReservation({ store, created, first, scope, mutate: (value) => ({ ...value, [field]: replacement(value[field]) }) });
      const scan = await scanDerivedGenerations({ store }); assert.equal(scan.complete, true, `${scope}/${field}`); assert.equal(scan.warnings.some((item) => item.code === "memory.derived_reservation_invalid"), true, `${scope}/${field}`); assert.equal((await loadMemoryView({ store, sourceTreeSha256: first, viewSha256: created.generationSha256 })).status, "corrupt", `${scope}/${field}`);
    }
  }
});

test("one-sided reservation pairs consume only their physical slots and do not grant authority", async (t) => {
  for (const missing of ["global", "local"]) {
    const { store } = await approvedStore(t); const first = "a".repeat(64); const created = await publishMemoryViewGeneration({ store, sourceTreeSha256: first, viewBytes: Buffer.from("# view\n") }); const root = path.join(store.root, "v1", "derived"); const local = path.join(root, "views", first, created.generationSha256, "_slots", "000.json"); const global = path.join(root, ".reservations", "global", "00000.json"); await rm(missing === "global" ? global : local);
    const scan = await scanDerivedGenerations({ store, limits: { maxGenerationReservations: 2, maxIdentityInstances: 2 } }); assert.equal(scan.complete, true, missing); assert.equal(scan.warnings.some((item) => item.code === "memory.derived_reservation_invalid"), true, missing); assert.equal((await loadMemoryView({ store, sourceTreeSha256: first, viewSha256: created.generationSha256 })).status, "corrupt", missing);
    assert.equal((await publishMemoryLogGeneration({ store, sourceTreeSha256: "b".repeat(64), logBytes: Buffer.from("# healthy\n"), limits: { maxGenerationReservations: 2, maxIdentityInstances: 2 } })).complete, true, missing);
  }
});

test("global and local reservation leaks consume the exact final quota slot", async (t) => {
  const globalCase = await approvedStore(t); const globalLeak = path.join(globalCase.store.root, "v1", "derived", ".reservations", "global", "00000.json"); await mkdir(path.dirname(globalLeak), { recursive: true }); await writeFile(globalLeak, "");
  const globalBlocked = await publishMemoryViewGeneration({ store: globalCase.store, sourceTreeSha256: "a".repeat(64), viewBytes: Buffer.from("# view\n"), limits: { maxGenerationReservations: 1 } }); assert.equal(globalBlocked.complete, false); assert.equal(globalBlocked.warnings[0].code, "memory.derived_limit_exceeded");
  const localCase = await approvedStore(t); const first = "b".repeat(64); const created = await publishMemoryLogGeneration({ store: localCase.store, sourceTreeSha256: first, logBytes: Buffer.from("# log\n"), limits: { maxIdentityInstances: 1, maxGenerationReservations: 2 } }); const localLeak = path.join(localCase.store.root, "v1", "derived", "logs", first, created.generationSha256, "_slots", "000.json"); await writeFile(localLeak, "");
  const localBlocked = await publishMemoryLogGeneration({ store: localCase.store, sourceTreeSha256: first, logBytes: Buffer.from("# log\n"), limits: { maxIdentityInstances: 1, maxGenerationReservations: 2 } }); assert.equal(localBlocked.complete, false); assert.equal(localBlocked.warnings[0].code, "memory.derived_limit_exceeded"); assert.deepEqual(await readFile(localLeak), Buffer.alloc(0));
});

test("reservations whose generation instance is missing remain occupied without granting authority", async (t) => {
  const { store } = await approvedStore(t); const first = "a".repeat(64); const created = await publishMemoryViewGeneration({ store, sourceTreeSha256: first, viewBytes: Buffer.from("# view\n") }); await rm(path.join(store.root, "v1", "derived", created.generationPath));
  const scan = await scanDerivedGenerations({ store, limits: { maxGenerationReservations: 2 } }); assert.equal(scan.complete, true); assert.equal(scan.warnings.some((item) => item.code === "memory.derived_reservation_invalid"), true); assert.notEqual((await loadMemoryView({ store, sourceTreeSha256: first, viewSha256: created.generationSha256 })).status, "ready");
  assert.equal((await publishMemoryLogGeneration({ store, sourceTreeSha256: "b".repeat(64), logBytes: Buffer.from("# healthy\n"), limits: { maxGenerationReservations: 2 } })).complete, true);
});

test("index view log and receipt publication leave the raw source tree hash unchanged", async (t) => {
  for (const kind of ["index", "view", "log", "receipt"]) {
    const { root, store } = await approvedStore(t); const rebuilt = await rebuildMemoryIndex({ workspaceRoot: root, config }); const before = rebuilt.sourceTreeSha256;
    if (kind === "index") await publishMemoryIndexGeneration({ store, sourceTreeSha256: before, indexBytes: rebuilt.bytes });
    else if (kind === "view") await publishMemoryViewGeneration({ store, sourceTreeSha256: before, viewBytes: Buffer.from("# view\n") });
    else if (kind === "log") await publishMemoryLogGeneration({ store, sourceTreeSha256: before, logBytes: Buffer.from("# log\n") });
    else await publishMemoryReceiptGeneration({ store, requestSha256: "a".repeat(64), receiptBytes: canonicalBytes(receiptFixture({ sourceTreeSha256: before })) });
    assert.equal((await rebuildMemoryIndex({ workspaceRoot: root, config })).sourceTreeSha256, before, kind);
  }
});

test("a canonical result at exactly 64 KiB publishes a truthful receipt and limit plus one publishes none", async (t) => {
  const baseline = await approvedStore(t); const small = await retrieveApprovedDesignMemory({ workspaceRoot: baseline.root, config, requestContext: context }); const delta = 64 * 1024 - canonicalBytes(small).byteLength; assert.equal(delta > 0, true);
  const exactSections = { ...sections, "발견한 내용": sections["발견한 내용"] + "x".repeat(delta) }; const exactStore = await approvedStore(t, exactSections); const exact = await retrieveApprovedDesignMemory({ workspaceRoot: exactStore.root, config, requestContext: context });
  mutationEqual({ mutationId: "result-preflight", testId: "result-exact-limit", sentinel: "MEM-RET-MUT-RESULT-PREFLIGHT" }, canonicalBytes(exact).byteLength, 64 * 1024); assert.equal(exact.status, "ready"); const receipt = await loadMemoryReceipt({ store: exactStore.store, requestSha256: exact.requestSha256, receiptSha256: exact.receiptSha256 }); assert.equal(receipt.status, "ready"); assert.equal(receipt.receipt.applied[0].memoryId, exact.guidance[0].memoryId);
  const overflowSections = { ...exactSections, "발견한 내용": `${exactSections["발견한 내용"]}x` }; const overflowStore = await approvedStore(t, overflowSections); const before = await treeSnapshot(path.join(overflowStore.store.root, "v1", "derived", "receipts")); const overflow = await retrieveApprovedDesignMemory({ workspaceRoot: overflowStore.root, config, requestContext: context });
  assert.equal(overflow.status, "unavailable"); assert.equal(overflow.warnings[0].code, "memory.result_limit_exceeded"); assert.deepEqual(await treeSnapshot(path.join(overflowStore.store.root, "v1", "derived", "receipts")), before);
});

// A reservation slot whose name is held by a symlink must never be claimed by writing through it. On
// POSIX the exclusive create refuses the name; on Windows it follows the link and creates the link's
// target, which would claim the slot AND put this store's bytes wherever the link points — outside the
// store, at a path something else chose. The reservation now refuses a taken name before it writes,
// whichever way the platform reports the collision, so the publish steps to the next slot and the
// link's target is never created.
test("a reservation slot held by a symlink is stepped over, and nothing is written through the link", async (t) => {
  const { root, store } = await approvedStore(t);
  const outside = path.join(root, "outside-the-store.json");
  const globalDirectory = path.join(store.root, "v1", "derived", ".reservations", "global");
  await mkdir(globalDirectory, { recursive: true });
  await symlink(outside, path.join(globalDirectory, "00000.json"));

  const published = await publishMemoryLogGeneration({
    store,
    sourceTreeSha256: "c".repeat(64),
    logBytes: Buffer.from("# healthy\n"),
    limits: { maxGenerationReservations: 2, maxIdentityInstances: 2 },
  });

  assert.equal(published.complete, true, JSON.stringify(published));
  assert.equal(published.status, "created");
  assert.equal(await lstat(outside).then(() => true, () => false), false, "the link target must not exist");
  assert.equal((await lstat(path.join(globalDirectory, "00000.json"))).isSymbolicLink(), true, "the occupied slot is left exactly as it was found");
  assert.equal((await lstat(path.join(globalDirectory, "00001.json"))).isFile(), true, "the reservation lands in the next slot");
});
