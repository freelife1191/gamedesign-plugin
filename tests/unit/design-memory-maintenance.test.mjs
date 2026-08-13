import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { captureDesignMemory } from "../../shared/scripts/capture-design-memory.mjs";
import { maintainDesignMemory } from "../../shared/scripts/maintain-design-memory.mjs";
import { foldMemoryEvents, scanMemoryEvents } from "../../shared/scripts/lib/safe-memory-store.mjs";
import { rebuildMemoryIndex } from "../../shared/scripts/retrieve-design-memory.mjs";

const config = { enabled: true, scope: "project", projectId: "wind-island", candidateTtlDays: 30, maxItems: 5, gitMode: "tracked" };
async function workspace(t) { const root = await realpath(await mkdtemp(path.join(tmpdir(), "memory-maintain-"))); t.after(() => rm(root, { recursive: true, force: true })); return root; }
async function captured(t) {
  const root = await workspace(t); await mkdir(path.join(root, "artifact")); const bytes = Buffer.from("evidence\n"); await writeFile(path.join(root, "artifact", "evidence.yml"), bytes);
  const capture = await captureDesignMemory({ workspaceRoot: root, config, projectId: "wind-island", lane: "studio", now: new Date("2026-08-01T00:00:00Z"), event: { eventId: "playtest-1", type: "playtest-finding", classification: "durable-finding", actorType: "human", humanAttested: true, summary: "반격 수단이 없다.", applicability: "보스전", exclusions: "퍼즐", artifactTypes: ["combat"], relatedIds: ["boss"], tags: ["counterplay"], actor: "author", sources: [{ artifact_id: "artifact", locator: "evidence.yml#x", sha256: (await import("node:crypto")).createHash("sha256").update(bytes).digest("hex") }] } });
  return { root, capture };
}

test("verified candidate with human actor and reason is the only direct approval path", async (t) => {
  const { root, capture } = await captured(t);
  await assert.rejects(() => maintainDesignMemory({ workspaceRoot: root, config, action: "approve", memoryId: capture.memoryId, actor: "human", reason: "reviewed", now: new Date("2026-08-02T00:00:00Z") }), (error) => error?.code === "memory.maintenance");
  await maintainDesignMemory({ workspaceRoot: root, config, action: "verify", memoryId: capture.memoryId, actor: "ChatGPT", actorType: "human", humanAttested: true, reason: "sources current", now: new Date("2026-08-02T00:00:00Z") });
  await assert.rejects(() => maintainDesignMemory({ workspaceRoot: root, config, action: "approve", memoryId: capture.memoryId, actor: "reviewer", actorType: "system", humanAttested: true, reason: "reviewed", now: new Date("2026-08-03T00:00:00Z") }), (error) => error?.code === "memory.maintenance");
  const approved = await maintainDesignMemory({ workspaceRoot: root, config, action: "approve", memoryId: capture.memoryId, actor: "reviewer", actorType: "human", humanAttested: true, reason: "human review", now: new Date("2026-08-03T00:00:00Z") });
  assert.match(approved.eventId, /^mev1-/); const scan = await scanMemoryEvents({ store: capture.store }); assert.equal(foldMemoryEvents(scan).memories.get(capture.memoryId).record.status, "approved");
});

test("verify refuses source drift without appending a transition", async (t) => {
  const { root, capture } = await captured(t); await writeFile(path.join(root, "artifact", "evidence.yml"), "changed\n");
  const before = (await scanMemoryEvents({ store: capture.store })).events.length;
  await assert.rejects(() => maintainDesignMemory({ workspaceRoot: root, config, action: "verify", memoryId: capture.memoryId, actor: "reviewer", reason: "check", now: new Date("2026-08-02T00:00:00Z") }), (error) => error?.code === "memory.maintenance");
  assert.equal((await scanMemoryEvents({ store: capture.store })).events.length, before);
});

test("sweep appends expired and stale transitions without rewriting prior records", async (t) => {
  const { root, capture } = await captured(t);
  const result = await maintainDesignMemory({ workspaceRoot: root, config, action: "sweep", actor: "reviewer", actorType: "human", humanAttested: true, reason: "scheduled review", now: new Date("2026-10-02T00:00:00Z") });
  assert.equal(result.changed.length, 1);
  const folded = foldMemoryEvents(await scanMemoryEvents({ store: capture.store }));
  assert.equal(folded.memories.get(capture.memoryId).record.status, "expired");
});

test("list and lint are read-only, quarantine permanently excludes the complete memory, and rebuild matches retrieval bytes", async (t) => {
  const { root, capture } = await captured(t); const before = await readFile(path.join(root, "artifact", "evidence.yml"));
  const listed = await maintainDesignMemory({ workspaceRoot: root, config, action: "list" }); const linted = await maintainDesignMemory({ workspaceRoot: root, config, action: "lint" });
  assert.equal(listed.memories.length, 1); assert.ok(Array.isArray(linted.diagnostics)); assert.deepEqual(await readFile(path.join(root, "artifact", "evidence.yml")), before);
  await maintainDesignMemory({ workspaceRoot: root, config, action: "quarantine", memoryId: capture.memoryId, actor: "reviewer", actorType: "human", humanAttested: true, reason: "unsafe", now: new Date("2026-08-02T00:00:00Z") });
  const scan = await scanMemoryEvents({ store: capture.store }); assert.equal(foldMemoryEvents(scan).memories.has(capture.memoryId), false);
  const rebuilt = await maintainDesignMemory({ workspaceRoot: root, config, action: "rebuild", now: new Date("2026-08-03T00:00:00Z") }); const direct = await rebuildMemoryIndex({ workspaceRoot: root, config, now: new Date("2026-08-03T00:00:00Z") }); assert.equal(rebuilt.complete, true); assert.deepEqual(rebuilt.bytes, direct.bytes);
});

test("maintenance CLI consumes one JSON object and emits one JSON result", async () => {
  const child = spawn(process.execPath, ["shared/scripts/maintain-design-memory.mjs"], { cwd: process.cwd(), stdio: ["pipe", "pipe", "pipe"] });
  const stdout = []; const stderr = []; child.stdout.on("data", (chunk) => stdout.push(chunk)); child.stderr.on("data", (chunk) => stderr.push(chunk));
  child.stdin.end(`${JSON.stringify({ config: { ...config, enabled: false }, action: "list" })}\n`);
  const code = await new Promise((resolve) => child.once("close", resolve)); const output = Buffer.concat(stdout).toString("utf8");
  assert.equal(code, 0, Buffer.concat(stderr).toString("utf8")); assert.match(output, /^\{[^\n]+\}\n$/u); assert.deepEqual(JSON.parse(output), { status: "disabled" });
});
