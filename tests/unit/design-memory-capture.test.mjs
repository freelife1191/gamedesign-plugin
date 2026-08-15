import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { scanMemoryEvents } from "../../shared/scripts/lib/safe-memory-store.mjs";
import { captureDesignMemory, memoryIdForEvent } from "../../shared/scripts/capture-design-memory.mjs";
import { issueCaptureClassificationReceipt } from "../../shared/scripts/lib/design-memory-capabilities.mjs";
import { retrieveApprovedDesignMemory } from "../../shared/scripts/retrieve-design-memory.mjs";

const config = (overrides = {}) => ({ enabled: true, scope: "project", projectId: "wind-island", candidateTtlDays: 30, maxItems: 5, gitMode: "tracked", ...overrides });
const captureNow = new Date("2026-08-12T00:00:00Z");
function receiptFor(event, classification = { classification: "durable-finding" }, overrides = {}) {
  return issueCaptureClassificationReceipt({ projectId: "wind-island", lane: "studio", scope: "project", candidateTtlDays: 30, event, classification, now: captureNow, ...overrides });
}
async function workspace(t) { const root = await realpath(await mkdtemp(path.join(tmpdir(), "memory-capture-"))); t.after(() => rm(root, { recursive: true, force: true })); return root; }
async function fixture(t) {
  const root = await workspace(t); const evidenceBytes = Buffer.from("finding-07: 회피 뒤 반격 수단이 없어 기다리는 시간이 길어졌다.\n", "utf8");
  await mkdir(path.join(root, "playtest-session-04")); await writeFile(path.join(root, "playtest-session-04", "evidence.yml"), evidenceBytes);
  const event = { eventId: "playtest-session-04-finding-07", type: "playtest-finding", summary: "회피 뒤 반격 수단이 없어 기다리는 시간이 길어졌다.", applicability: "같은 전투 구조와 플레이어 능력을 사용하는 보스전", exclusions: "회피 자체가 핵심 재미이거나 반격 규칙이 정해지지 않은 전투", artifactTypes: ["character-skill-combat-monster"], relatedIds: ["boss-phase-2"], tags: ["boss", "counterplay"], sources: [{ artifact_id: "playtest-session-04", locator: "evidence.yml#finding-07", sha256: createHash("sha256").update(evidenceBytes).digest("hex") }], actor: "김기획자" }; return { root, event, classificationReceipt: receiptFor(event) };
}
async function localGit(root, contents = "before\n") {
  const exclude = path.join(root, ".git", "info", "exclude");
  await mkdir(path.dirname(exclude), { recursive: true });
  await writeFile(exclude, contents);
  return exclude;
}

test("capture creates a stable candidate and idempotently recognizes the same source event", async (t) => {
  const { root, event, classificationReceipt } = await fixture(t);
  const first = await captureDesignMemory({ workspaceRoot: root, config: config(), projectId: "wind-island", lane: "studio", event, classificationReceipt, now: captureNow });
  const second = await captureDesignMemory({ workspaceRoot: root, config: config(), projectId: "wind-island", lane: "studio", event, classificationReceipt, now: captureNow });
  assert.equal(first.status, "created"); assert.equal(second.status, "present");
  assert.equal(first.memoryId, "memory-studio-design-lesson-945f2ab4d06b882d");
  assert.equal(memoryIdForEvent({ lane: "studio", kind: "design-lesson", projectId: "wind-island", eventId: event.eventId }), first.memoryId);
  const scan = await scanMemoryEvents({ store: first.store }); assert.equal(scan.complete, true); assert.equal(scan.events.length, 1); assert.equal(scan.events[0].record.status, "candidate"); assert.equal(scan.events[0].record.sources[0].locator, "evidence.yml#finding-07");
});

test("only an explicit preference is directly approved with interactive-user provenance", async (t) => {
  const root = await workspace(t);
  const event = { eventId: "user-pref-1", type: "explicit-preference", actor: "사용자", summary: "대사는 짧고 선명하게 쓴다.", applicability: "전투 튜토리얼", exclusions: "서사 장면", artifactTypes: ["dialogue"], relatedIds: [], tags: ["style"] };
  const classificationReceipt = receiptFor(event, { classification: "explicit-user-preference", instructionContext: "user instruction" });
  const result = await captureDesignMemory({ workspaceRoot: root, config: config(), projectId: "wind-island", lane: "studio", event, classificationReceipt, now: captureNow });
  assert.equal(result.status, "created"); const scan = await scanMemoryEvents({ store: result.store }); const record = scan.events[0].record;
  assert.equal(record.status, "approved"); assert.equal(record.approved_by, "interactive-user"); assert.equal(record.approval_basis, "explicit-user-instruction");
});

test("capture rejects a missing artifact even when workspace root has matching bytes and has no receipt", async (t) => {
  const root = await workspace(t); const bytes = Buffer.from("same bytes\n"); await writeFile(path.join(root, "evidence.yml"), bytes);
  const event = { eventId: "finding-missing-artifact", type: "playtest-finding", actor: "human", summary: "반격이 없다.", applicability: "보스전", exclusions: "퍼즐", artifactTypes: ["combat"], relatedIds: [], tags: ["boss"], sources: [{ artifact_id: "missing-artifact", locator: "evidence.yml#x", sha256: createHash("sha256").update(bytes).digest("hex") }] };
  assert.equal((await captureDesignMemory({ workspaceRoot: root, config: config({ gitMode: "local" }), projectId: "wind-island", lane: "studio", event })).status, "skipped");
  await assert.rejects(() => import("node:fs/promises").then(({ lstat }) => lstat(path.join(root, ".git"))), (error) => error?.code === "ENOENT");
});

test("an approved explicit preference remains retrievable after candidate TTL", async (t) => {
  const root = await workspace(t); const event = { eventId: "user-pref-ttl", type: "explicit-preference", actor: "사용자", summary: "짧게 쓴다.", applicability: "튜토리얼", exclusions: "서사", artifactTypes: ["dialogue"], relatedIds: [], tags: ["style"] };
  const classificationReceipt = receiptFor(event, { classification: "explicit-user-preference", instructionContext: "user instruction" });
  await captureDesignMemory({ workspaceRoot: root, config: config(), projectId: "wind-island", lane: "studio", event, classificationReceipt, now: captureNow });
  const result = await retrieveApprovedDesignMemory({ workspaceRoot: root, config: config(), requestContext: { projectId: "wind-island", lane: "studio", artifactIds: [], artifactTypes: ["dialogue"], tags: ["style"] }, now: new Date("2026-09-12T00:00:00Z") });
  assert.equal(result.guidance.length, 1);
});

test("disabled, missing project identity, invalid kinds, sensitive input, and source drift do not create a store event", async (t) => {
  const { root, event, classificationReceipt } = await fixture(t); const cases = [
    { config: config({ enabled: false }) }, { config: config(), projectId: null }, { config: config(), event: { ...event, type: "chat" } },
    { config: config(), event: { ...event, summary: "password secret" } }, { config: config(), event: { ...event, sources: [{ ...event.sources[0], sha256: "0".repeat(64) }] } },
  ];
  for (const options of cases) {
    const result = await captureDesignMemory({ workspaceRoot: root, config: options.config, projectId: options.projectId === undefined ? "wind-island" : options.projectId, lane: "studio", event: options.event ?? event, classificationReceipt, disabledForRequest: options.config.enabled === false, now: captureNow });
    assert.equal(result.status, "skipped");
  }
  await assert.rejects(() => import("node:fs/promises").then(({ lstat }) => lstat(path.join(root, ".game-design"))), (error) => error?.code === "ENOENT");
});

test("capture rejects copied, serialized, forged, proxied, and request-mutated receipts before creating a store", async (t) => {
  const { root, event, classificationReceipt } = await fixture(t);
  const hostileReceipts = [{ ...classificationReceipt }, JSON.parse(JSON.stringify(classificationReceipt)), structuredClone(classificationReceipt), Object.freeze(Object.create(null)), new Proxy(classificationReceipt, {})];
  for (const receipt of hostileReceipts) assert.equal((await captureDesignMemory({ workspaceRoot: root, config: config(), projectId: "wind-island", lane: "studio", event, classificationReceipt: receipt, now: captureNow })).status, "skipped");
  for (const overrides of [
    { projectId: "other-project" },
    { lane: "career" },
    { config: config({ scope: "workspace" }) },
    { config: config({ candidateTtlDays: 31 }) },
    { event: { ...event, summary: "다른 요약" } },
    { now: new Date("2026-08-12T00:00:01Z") },
  ]) assert.equal((await captureDesignMemory({ workspaceRoot: root, config: config(), projectId: "wind-island", lane: "studio", event, classificationReceipt, now: captureNow, ...overrides })).status, "skipped");
  await assert.rejects(() => import("node:fs/promises").then(({ lstat }) => lstat(path.join(root, ".game-design"))), (error) => error?.code === "ENOENT");
});

test("capture command does not re-export capability issuers", async () => {
  const command = await import("../../shared/scripts/capture-design-memory.mjs");
  assert.equal(Object.hasOwn(command, "issueCaptureClassificationReceipt"), false);
  assert.equal(Object.hasOwn(command, "issueDurableCaptureReceipt"), false);
});

test("every durable event type captures as a candidate and same operation bytes conflict", async (t) => {
  for (const [type, kind] of [["human-decision", "decision"], ["playtest-finding", "design-lesson"], ["review-finding", "design-lesson"], ["lesson-revision", "design-lesson"]]) {
    const { root, event } = await fixture(t); const typed = { ...event, eventId: `${type}-1`, type }; const classificationReceipt = receiptFor(typed);
    const result = await captureDesignMemory({ workspaceRoot: root, config: config(), projectId: "wind-island", lane: "studio", event: typed, classificationReceipt, now: captureNow });
    assert.equal(result.status, "created"); const sealed = (await scanMemoryEvents({ store: result.store })).events[0]; assert.equal(sealed.record.status, "candidate"); assert.equal(sealed.record.kind, kind);
  }
  const { root, event, classificationReceipt } = await fixture(t);
  const first = await captureDesignMemory({ workspaceRoot: root, config: config(), projectId: "wind-island", lane: "studio", event, classificationReceipt, now: captureNow }); assert.equal(first.status, "created");
  const changed = { ...event, summary: "반격 기회를 더 명확하게 제공해야 한다." }; const changedReceipt = receiptFor(changed);
  const conflict = await captureDesignMemory({ workspaceRoot: root, config: config(), projectId: "wind-island", lane: "studio", event: changed, classificationReceipt: changedReceipt, now: captureNow }); assert.equal(conflict.status, "conflict");
  assert.equal((await scanMemoryEvents({ store: first.store })).events.length, 1);
});

test("capture log publication failure preserves the committed source event", async (t) => {
  const { root, event, classificationReceipt } = await fixture(t);
  const { resolveMemoryStore } = await import("../../shared/scripts/lib/safe-memory-store.mjs");
  const store = await resolveMemoryStore({ workspaceRoot: root, config: config(), platform: process.platform, home: root, initialize: true });
  await mkdir(path.join(store.root, "v1", "derived"), { recursive: true }); await symlink(path.join(root, "playtest-session-04"), path.join(store.root, "v1", "derived", "logs"));
  const result = await captureDesignMemory({ workspaceRoot: root, config: config(), projectId: "wind-island", lane: "studio", event, classificationReceipt, now: captureNow });
  assert.equal(result.status, "created"); assert.deepEqual(result.warnings, [{ code: "memory.log_publish" }]); assert.equal((await scanMemoryEvents({ store })).events.length, 1);
});

test("a successful local capture adds exactly one Git exclusion marker and retries idempotently", async (t) => {
  const { root, event, classificationReceipt } = await fixture(t); const exclude = await localGit(root);
  const first = await captureDesignMemory({ workspaceRoot: root, config: config({ gitMode: "local" }), projectId: "wind-island", lane: "studio", event, classificationReceipt, now: captureNow });
  const second = await captureDesignMemory({ workspaceRoot: root, config: config({ gitMode: "local" }), projectId: "wind-island", lane: "studio", event, classificationReceipt, now: captureNow });
  assert.equal(first.status, "created"); assert.equal(second.status, "present"); assert.deepEqual(first.warnings, []); assert.deepEqual(second.warnings, []);
  const text = await readFile(exclude, "utf8");
  assert.equal((text.match(/# game-design-plugin:memory:begin/g) ?? []).length, 1); assert.equal((text.match(/# game-design-plugin:memory:end/g) ?? []).length, 1); assert.match(text, /\.game-design\/memory\//u);
});

test("tracked capture does not create or alter a Git exclusion marker", async (t) => {
  const { root, event, classificationReceipt } = await fixture(t); const exclude = await localGit(root, "user exclusion\n");
  const result = await captureDesignMemory({ workspaceRoot: root, config: config({ gitMode: "tracked" }), projectId: "wind-island", lane: "studio", event, classificationReceipt, now: captureNow });
  assert.equal(result.status, "created"); assert.deepEqual(result.warnings, []); assert.equal(await readFile(exclude, "utf8"), "user exclusion\n");
});

test("local Git exclusion warnings preserve successful capture events without disclosure", async (t) => {
  for (const setup of [
    async (root) => localGit(root, "# game-design-plugin:memory:begin\n"),
    async (root) => { const exclude = await localGit(root); await writeFile(`${exclude}.game-design-memory-exclude.lock`, "held\n"); },
    async (root) => { await mkdir(path.join(root, ".git")); await symlink(path.join(root, "outside"), path.join(root, ".git", "info")); },
    async () => {},
  ]) {
    const { root, event, classificationReceipt } = await fixture(t); await setup(root);
    const result = await captureDesignMemory({ workspaceRoot: root, config: config({ gitMode: "local" }), projectId: "wind-island", lane: "studio", event, classificationReceipt, now: captureNow });
    assert.equal(result.status, "created"); assert.equal((await scanMemoryEvents({ store: result.store })).events.length, 1); assert.equal(result.warnings.length, 1); assert.match(result.warnings[0].code, /^memory\.git_(?:exclude|exclude_lock|exclude_marker|metadata)$/u); assert.equal(JSON.stringify(result.warnings).includes(root), false);
  }
});
