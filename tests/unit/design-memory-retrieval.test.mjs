import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { lstat, mkdir, mkdtemp, opendir, readFile, realpath, rename, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { canonicalMemoryEventDocument, memoryOperationId } from "../../shared/scripts/validate-design-memory.mjs";
import { appendMemoryEvent, resolveMemoryStore } from "../../shared/scripts/lib/safe-memory-store.mjs";
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

const digest = (value) => createHash("sha256").update(value).digest("hex");
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

test("view and log writers reject every malformed Markdown form before derived growth and loaders preserve corruption", async (t) => {
  const { store } = await approvedStore(t); const hash = "a".repeat(64);
  const malformed = [Buffer.from([0xef, 0xbb, 0xbf, 0x23, 0x0a]), Buffer.from([0xff, 0x0a]), Buffer.from("# a\0\n"), Buffer.from("# a\r\n"), Buffer.from("# a"), Buffer.from("# a\n\n")];
  for (const [publish, label] of [[publishMemoryViewGeneration, "view"], [publishMemoryLogGeneration, "log"]]) {
    const before = await treeSnapshot(path.join(store.root, "v1", "derived"));
    for (const bytes of malformed) assert.equal((await publish({ store, sourceTreeSha256: hash, [`${label}Bytes`]: bytes })).complete, false);
    assert.deepEqual(await treeSnapshot(path.join(store.root, "v1", "derived")), before);
    const created = await publish({ store, sourceTreeSha256: hash, [`${label}Bytes`]: Buffer.from(`# ${label}\n`) }); assert.equal(created.complete, true);
    await writeFile(path.join(store.root, "v1", "derived", created.generationPath), Buffer.from([0xff, 0x0a]));
    const loaded = label === "view" ? await loadMemoryView({ store, sourceTreeSha256: hash, viewSha256: created.generationSha256 }) : await loadMemoryLog({ store, sourceTreeSha256: hash, logSha256: created.generationSha256 });
    assert.equal(loaded.status, "corrupt"); assert.equal(loaded.warnings[0].code, "memory.derived_generation_invalid");
  }
});

test("sealed head path, commit, claim, instance, and digest mutations cannot produce guidance or a receipt", async (t) => {
  for (const mutation of ["path", "commit", "claim", "instance", "digest"]) {
    const { root, store } = await approvedStore(t); const rebuilt = await rebuildMemoryIndex({ workspaceRoot: root, config });
    assert.equal(rebuilt.complete, true); const head = rebuilt.index.entries[0]; const eventRoot = path.join(store.root, head.headEventPath); const instanceRelative = (await treeSnapshot(eventRoot)).find((item) => item.path.startsWith("instances/") && item.path.endsWith(".md"))?.path; assert.ok(instanceRelative, mutation); const instancePath = path.join(eventRoot, instanceRelative);
    if (mutation === "path") await rename(eventRoot, path.join(path.dirname(eventRoot), "moved"));
    else if (mutation === "commit") await writeFile(path.join(eventRoot, "commit.json"), "{}\n");
    else if (mutation === "claim" || mutation === "digest") await writeFile(path.join(eventRoot, "claims", `${path.basename(instancePath, ".md")}.json`), mutation === "claim" ? "{}\n" : "{\"schemaVersion\":1}\n");
    else await writeFile(instancePath, "# altered\n");
    const before = await treeSnapshot(path.join(store.root, "v1", "events")); const receiptsBefore = await treeSnapshot(path.join(store.root, "v1", "derived", "receipts"));
    const result = await retrieveApprovedDesignMemory({ workspaceRoot: root, config, requestContext: context });
    assert.equal(result.guidance.length, 0, mutation); assert.notEqual(result.status, "ready", mutation);
    assert.deepEqual(await treeSnapshot(path.join(store.root, "v1", "events")), before, mutation);
    assert.deepEqual(await treeSnapshot(path.join(store.root, "v1", "derived", "receipts")), receiptsBefore, mutation);
  }
});

test("separate Node publishers preserve equivalent history and enforce final local and global slots", async (t) => {
  const { root, store } = await approvedStore(t); const hash = "a".repeat(64); const moduleUrl = new URL("../../shared/scripts/retrieve-design-memory.mjs", import.meta.url).href;
  const contenders = await Promise.all([childPublish({ workspaceRoot: root, moduleUrl, kind: "view", hash }), childPublish({ workspaceRoot: root, moduleUrl, kind: "view", hash })]);
  assert.equal(contenders.every((result) => ["created", "present"].includes(result.status)), true);
  const exact = await loadMemoryView({ store, sourceTreeSha256: hash, viewSha256: contenders[0].generationSha256 }); assert.equal(exact.status, "ready");
  const { root: localRoot } = await approvedStore(t); const localHash = "b".repeat(64); const localLimits = { maxIdentityInstances: 1 };
  const local = await Promise.all([childPublish({ workspaceRoot: localRoot, moduleUrl, kind: "log", hash: localHash, limits: localLimits }), childPublish({ workspaceRoot: localRoot, moduleUrl, kind: "log", hash: localHash, limits: localLimits })]);
  assert.equal(local.filter((result) => result.complete).length, 1, JSON.stringify(local)); assert.equal(local.find((result) => !result.complete).warnings[0].code, "memory.derived_limit_exceeded", JSON.stringify(local));
  const { root: globalRoot } = await approvedStore(t); const globalLimits = { maxGenerationReservations: 1 }; const global = await Promise.all([childPublish({ workspaceRoot: globalRoot, moduleUrl, kind: "view", hash: "c".repeat(64), limits: globalLimits }), childPublish({ workspaceRoot: globalRoot, moduleUrl, kind: "log", hash: "d".repeat(64), limits: globalLimits })]);
  assert.equal(global.filter((result) => result.complete).length, 1); assert.equal(global.find((result) => !result.complete).warnings[0].code, "memory.derived_limit_exceeded");
});

test("reservation corruption and leaks close the complete derived scan with stable diagnostics", async (t) => {
  for (const mutation of ["empty", "oversize", "special", "leak"]) {
    const { store } = await approvedStore(t); const created = await publishMemoryViewGeneration({ store, sourceTreeSha256: "a".repeat(64), viewBytes: Buffer.from("# view\n") }); assert.equal(created.complete, true);
    const global = path.join(store.root, "v1", "derived", ".reservations", "global", "00000.json");
    if (mutation === "empty") await writeFile(global, "");
    else if (mutation === "oversize") await writeFile(global, "x".repeat(4097));
    else if (mutation === "special") { await rm(global); await mkdir(global); }
    else { const localDirectory = path.join(store.root, "v1", "derived", "views", "a".repeat(64), created.generationSha256, "_slots"); const name = (await treeSnapshot(localDirectory))[0]?.path; assert.ok(name); await rm(path.join(localDirectory, name)); }
    const scan = await scanDerivedGenerations({ store }); assert.equal(scan.complete, false, mutation); assert.equal(scan.warnings.some((item) => item.code === "memory.derived_reservation_invalid"), true, mutation);
  }
});

test("receipt history retains distinct exact pairs while corrupt siblings do not replace valid evidence", async (t) => {
  const { root, store } = await approvedStore(t); const rebuilt = await rebuildMemoryIndex({ workspaceRoot: root, config }); const before = rebuilt.sourceTreeSha256; const requestSha256 = "a".repeat(64);
  const receipt = (memoryId) => Buffer.from(`${JSON.stringify({ schemaVersion: 1, requestSha256, sourceTreeSha256: before, projectId: "wind-island", lane: "studio", policy: { scope: "project", maxItems: 5, candidateTtlDays: 30 }, observations: [], applied: [{ memoryId, headEventId: rebuilt.index.entries[0].headEventId, fileSha256: rebuilt.index.entries[0].fileSha256 }], excluded: [] })}\n`);
  const first = await publishMemoryReceiptGeneration({ store, requestSha256, receiptBytes: receipt("memory-a") }); const second = await publishMemoryReceiptGeneration({ store, requestSha256, receiptBytes: receipt("memory-b") }); assert.equal(first.complete && second.complete, true);
  await writeFile(path.join(store.root, "v1", "derived", "receipts", requestSha256, second.receiptSha256, "instances", "00000000-0000-4000-8000-000000000000.json"), "{}\n");
  const exact = await loadMemoryReceipt({ store, requestSha256, receiptSha256: first.receiptSha256 }); assert.equal(exact.status, "ready"); assert.equal(exact.receipt.applied[0].memoryId, "memory-a");
  const history = await listMemoryReceipts({ store, requestSha256 }); assert.equal(history.items.length, 2); assert.equal(history.items.find((item) => item.receiptSha256 === second.receiptSha256).corruptInstanceCount, 1);
  assert.equal((await rebuildMemoryIndex({ workspaceRoot: root, config })).sourceTreeSha256, before);
});

test("runtime validators and packaged schemas share canonical receipt and index boundaries", async (t) => {
  const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../.."); const [indexSchema, receiptSchema] = await Promise.all([readFile(path.join(root, "shared/memory/schema/memory-index.schema.json"), "utf8").then(JSON.parse), readFile(path.join(root, "shared/memory/schema/memory-receipt.schema.json"), "utf8").then(JSON.parse)]);
  assert.equal(indexSchema.properties.entries.items.properties.artifactTypes.uniqueItems, true); assert.equal(receiptSchema.properties.observations.maxItems, 256); assert.equal(receiptSchema.properties.applied.maxItems, 256); assert.equal(receiptSchema.properties.excluded.maxItems, 256); assert.equal(receiptSchema.properties.excluded.items.properties.reason.maxLength, 1024);
  const canonical = { schemaVersion: 1, requestSha256: "a".repeat(64), sourceTreeSha256: "b".repeat(64), projectId: "wind-island", lane: "studio", policy: { scope: "project", maxItems: 5, candidateTtlDays: 30 }, observations: [], applied: [], excluded: [] };
  const bytes = Buffer.from(`${JSON.stringify(canonical)}\n`); const { store } = await approvedStore(t); const valid = await publishMemoryReceiptGeneration({ store, requestSha256: canonical.requestSha256, receiptBytes: bytes, limits: { maxReceiptObservationItems: 1, maxReceiptAppliedItems: 1, maxReceiptExcludedItems: 1 } }); assert.equal(valid.complete, true);
  for (const [key, entry] of [["observations", { memoryId: "memory-a", artifactId: "artifact-a", locator: "a.md#x", expectedSha256: "c".repeat(64), observedSha256: null, status: "missing" }], ["applied", { memoryId: "memory-a", headEventId: "mev1-" + "c".repeat(64), fileSha256: "c".repeat(64) }], ["excluded", { memoryId: "memory-a", reason: "excluded" }]]) {
    const value = { ...canonical, [key]: [entry, { ...entry, memoryId: "memory-b" }] }; const rejected = await publishMemoryReceiptGeneration({ store, requestSha256: canonical.requestSha256, receiptBytes: Buffer.from(`${JSON.stringify(value)}\n`), limits: { [`maxReceipt${key[0].toUpperCase()}${key.slice(1)}Items`]: 1 } }); assert.equal(rejected.complete, false, key);
  }
  const invalidReason = { ...canonical, excluded: [{ memoryId: "memory-a", reason: `bad\uFEFF${"x".repeat(1024)}` }] }; assert.equal((await publishMemoryReceiptGeneration({ store, requestSha256: canonical.requestSha256, receiptBytes: Buffer.from(`${JSON.stringify(invalidReason)}\n`) })).complete, false);
});

test("derived authority self-tamper makes the leak assertion fail", { skip: process.env.DESIGN_MEMORY_RETRIEVAL_SELF_TAMPER_CHILD === "1" }, async (t) => {
  const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../.."); const source = await readFile(path.join(root, "shared/scripts/retrieve-design-memory.mjs"), "utf8"); const anchor = "for (const [slot, item] of global.entries) if (!matchedGlobals.has(slot)) { complete = false; warnings.push(warning(\"memory.derived_reservation_invalid\", { relativePath: item.relativePath })); }"; assert.equal(source.includes(anchor), true);
  const temporary = await mkdtemp(path.join(tmpdir(), "memory-retrieval-mutation-")); t.after(() => rm(temporary, { recursive: true, force: true }));
  const mutated = source.replace(anchor, "for (const [slot, item] of global.entries) { void slot; void item; }").replace('"./lib/safe-memory-store.mjs"', JSON.stringify(new URL("../../shared/scripts/lib/safe-memory-store.mjs", import.meta.url).href)).replace('"./validate-design-memory.mjs"', JSON.stringify(new URL("../../shared/scripts/validate-design-memory.mjs", import.meta.url).href));
  const modulePath = path.join(temporary, "retrieve-design-memory.mjs"); await writeFile(modulePath, mutated);
  const child = spawn(process.execPath, [path.join(root, "tests/unit/design-memory-retrieval.test.mjs")], { cwd: root, env: { ...process.env, DESIGN_MEMORY_RETRIEVAL_MODULE_URL: new URL(`file://${modulePath}`).href, DESIGN_MEMORY_RETRIEVAL_SELF_TAMPER_CHILD: "1" }, stdio: ["ignore", "pipe", "pipe"] }); const stdout = []; const stderr = [];
  const result = await new Promise((resolve, reject) => { child.stdout.on("data", (chunk) => stdout.push(chunk)); child.stderr.on("data", (chunk) => stderr.push(chunk)); child.once("error", reject); child.once("close", (code) => resolve({ code, output: Buffer.concat([...stdout, ...stderr]).toString("utf8") })); });
  assert.equal(result.code, 1); assert.match(result.output, /reservation corruption and leaks close the complete derived scan/u);
});
