import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { lstat, mkdir, mkdtemp, opendir, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { captureDesignMemory } from "../../shared/scripts/capture-design-memory.mjs";
import { issueCaptureClassificationReceipt, issueMaintenanceHumanReceipt } from "../../shared/scripts/lib/design-memory-capabilities.mjs";
import { foldMemoryEvents, scanMemoryEvents } from "../../shared/scripts/lib/safe-memory-store.mjs";
import { maintainDesignMemory } from "../../shared/scripts/maintain-design-memory.mjs";
import { rebuildMemoryIndex } from "../../shared/scripts/retrieve-design-memory.mjs";

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
async function tree(root, relative = "") {
  const directory = relative ? path.join(root, relative) : root; const result = []; let handle;
  try { handle = await opendir(directory); } catch (error) { if (error?.code === "ENOENT") return result; throw error; }
  try { for await (const entry of handle) { const next = relative ? `${relative}/${entry.name}` : entry.name; result.push(next); if (entry.isDirectory() && !entry.isSymbolicLink()) result.push(...await tree(root, next)); } } finally { await handle.close().catch(() => {}); }
  return result.sort();
}
async function logDocuments(store) {
  const root = path.join(store.root, "v1", "derived", "logs"); const files = [];
  async function visit(directory) { let handle; try { handle = await opendir(directory); } catch (error) { if (error?.code === "ENOENT") return; throw error; } try { for await (const entry of handle) { const candidate = path.join(directory, entry.name); if (entry.isDirectory()) await visit(candidate); else if (entry.isFile() && entry.name.endsWith(".md")) files.push(await readFile(candidate, "utf8")); } } finally { await handle.close().catch(() => {}); } }
  await visit(root); return files;
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

test("maintenance rejects copied authority and every request-field mutation before append", async (t) => {
  const { root, capture } = await captured(t); const now = new Date("2026-08-02T00:00:00Z"); const base = { workspaceRoot: root, config, action: "verify", memoryId: capture.memoryId, actor: "reviewer", reason: "sources current", observedParentEventIds: [capture.eventId], now };
  const receipt = humanReceipt(base); const before = (await scanMemoryEvents({ store: capture.store })).events.length;
  for (const humanReceiptValue of [{ ...receipt }, JSON.parse(JSON.stringify(receipt)), structuredClone(receipt), new Proxy(receipt, {})]) await assert.rejects(() => maintainDesignMemory({ ...base, humanReceipt: humanReceiptValue }), (error) => error?.code === "memory.human_authority_required");
  for (const overrides of [{ actor: "other" }, { reason: "other" }, { action: "reject" }, { memoryId: "memory-other" }, { now: new Date("2026-08-02T00:00:01Z") }, { observedParentEventIds: [`mev1-${"a".repeat(64)}`] }, { chosenParentEventId: capture.eventId }, { config: { ...config, scope: "workspace" } }]) {
    await assert.rejects(() => maintainDesignMemory({ ...base, ...overrides, humanReceipt: receipt }), (error) => error?.code === "memory.human_authority_required");
  }
  assert.equal((await scanMemoryEvents({ store: capture.store })).events.length, before);
});

test("verify refuses source drift and lint reports the stale source without writing", async (t) => {
  const { root, capture } = await captured(t); await writeFile(path.join(root, "artifact", "evidence.yml"), "changed\n"); const before = await tree(root);
  await assert.rejects(() => mutate({ root, action: "verify", memoryId: capture.memoryId, observedParentEventIds: [capture.eventId], reason: "check", now: new Date("2026-08-02T00:00:00Z") }), (error) => error?.code === "memory.maintenance");
  const linted = await maintainDesignMemory({ workspaceRoot: root, config, action: "lint" }); assert.equal(linted.diagnostics.some((item) => item.code === "memory.orphan_source"), true);
  assert.deepEqual(await tree(root), before);
});

test("sweep expires candidates and retire maps candidate and approved records without rewriting source events", async (t) => {
  const first = await captured(t); const sweepAt = new Date("2026-10-02T00:00:00Z");
  const swept = await mutate({ root: first.root, action: "sweep", observedParentEventIds: [first.capture.eventId], reason: "scheduled review", now: sweepAt });
  assert.equal(swept.changed.length, 1); assert.equal(foldMemoryEvents(await scanMemoryEvents({ store: first.capture.store })).memories.get(first.capture.memoryId).record.status, "expired");

  const second = await captured(t, { eventOverrides: { eventId: "playtest-2" } }); const retiredCandidate = await mutate({ root: second.root, action: "retire", memoryId: second.capture.memoryId, observedParentEventIds: [second.capture.eventId], now: new Date("2026-08-02T00:00:00Z") });
  assert.equal((await scanMemoryEvents({ store: second.capture.store })).events.find((item) => item.eventId === retiredCandidate.eventId).record.status, "rejected");
  const third = await captured(t, { eventOverrides: { eventId: "playtest-3" } });
  const verified = await mutate({ root: third.root, action: "verify", memoryId: third.capture.memoryId, observedParentEventIds: [third.capture.eventId], now: new Date("2026-08-02T00:00:00Z") });
  const approved = await mutate({ root: third.root, action: "approve", memoryId: third.capture.memoryId, observedParentEventIds: [verified.eventId], now: new Date("2026-08-03T00:00:00Z") });
  const retiredApproved = await mutate({ root: third.root, action: "retire", memoryId: third.capture.memoryId, observedParentEventIds: [approved.eventId], now: new Date("2026-08-04T00:00:00Z") });
  assert.equal((await scanMemoryEvents({ store: third.capture.store })).events.find((item) => item.eventId === retiredApproved.eventId).record.status, "superseded");
});

test("safe absent list and lint are empty read-only results while unsafe and incomplete stores fail closed", async (t) => {
  const root = await workspace(t); const before = await tree(root);
  assert.deepEqual(await maintainDesignMemory({ workspaceRoot: root, config, action: "list" }), { status: "ready", memories: [], diagnostics: [] });
  assert.deepEqual(await maintainDesignMemory({ workspaceRoot: root, config, action: "lint" }), { status: "ready", memories: [], diagnostics: [] });
  assert.deepEqual(await tree(root), before);
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
