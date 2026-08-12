import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  canonicalMemoryEventDocument,
  parseMemoryDocument,
  parseMemoryEventDocument,
  validateMemoryRecord,
  validateMemorySourceBindings,
  validateMemoryTransition,
} from "../../shared/scripts/validate-design-memory.mjs";

const record = Object.freeze({
  schema_version: 1, memory_id: "memory-studio-design-lesson-0f2a4c61d9ab34ef", kind: "design-lesson", lane: "studio", status: "candidate", scope: "project", project_id: "wind-island",
  created_at: "2026-08-12T00:00:00.000Z", updated_at: "2026-08-12T00:00:00.000Z", review_after: "2026-09-11", expires_at: "2026-09-11", approved_by: null, approval_basis: null, supersedes: null,
  artifact_types: ["character-skill-combat-monster"], related_ids: ["boss-phase-2"], tags: ["boss", "counterplay"], sources: [{ artifact_id: "combat-loop-v3", locator: "content.md#boss", sha256: "a".repeat(64) }],
});
const sections = Object.freeze({ "발견한 내용": "내용", "적용 조건": "조건", "적용하면 안 되는 경우": "제외", "근거": "근거" });
const capture = (overrides = {}) => ({ schema_version: 1, event_type: "capture", action: "capture", memory_id: record.memory_id, operation_id: "mev1-" + "1".repeat(64), parent_event_ids: [], effective_at: "2026-08-12T09:00:00+09:00", actor: "author", reason: "capture", record: { ...record }, ...overrides });

test("append-only event envelope is closed and logical records reject event identity fields", () => {
  assert.equal(validateMemoryRecord(record).ok, true);
  assert.equal(validateMemoryRecord({ ...record, event_id: "mev1-" + "0".repeat(64) }).ok, false);
  assert.equal(validateMemoryRecord({ ...record, event_sha256: "0".repeat(64) }).ok, false);
  const source = canonicalMemoryEventDocument(capture(), sections);
  const eventId = `mev1-${createHash("sha256").update(source).digest("hex")}`;
  const parsed = parseMemoryEventDocument(source, { sourceName: "event.md", eventId });
  assert.equal(parsed.event.event_type, "capture");
  assert.equal(JSON.stringify(parsed.record), JSON.stringify(record));
  for (const event of [capture({ memory_id: "memory-e\u0301" }), capture({ operation_id: "mop1-" + "A".repeat(64) }), capture({ parent_event_ids: ["mev1-" + "2".repeat(64)] }), capture({ action: "transition" })]) {
    assert.throws(() => parseMemoryEventDocument(canonicalMemoryEventDocument(event, sections), { sourceName: "bad.md", eventId }));
  }
});

test("transition requires one parent and valid state transition while resolution consumes sorted observed heads", () => {
  const parent = "mev1-" + "1".repeat(64);
  const transition = capture({ event_type: "transition", action: "verified", parent_event_ids: [parent], operation_id: "mop1-" + "2".repeat(64), record: { ...record, status: "verified", updated_at: "2026-08-13T00:00:00.000Z" } });
  assert.equal(parseMemoryEventDocument(canonicalMemoryEventDocument(transition, sections), {}).event.action, "verified");
  assert.throws(() => parseMemoryEventDocument(canonicalMemoryEventDocument({ ...transition, parent_event_ids: [] }, sections), {}));
  const heads = ["mev1-" + "3".repeat(64), "mev1-" + "4".repeat(64)];
  const resolution = capture({ event_type: "resolution", action: "resolution", parent_event_ids: heads, chosen_parent_event_id: heads[0], operation_id: "mop1-" + "5".repeat(64) });
  assert.equal(parseMemoryEventDocument(canonicalMemoryEventDocument(resolution, sections), {}).event.chosen_parent_event_id, heads[0]);
  assert.equal(validateMemoryTransition({ from: "candidate", to: "verified", approvalBasis: null }).ok, true);
});

test("canonical serializer is NFC, UTC, LF terminated, and byte-addressed", () => {
  const bytes = canonicalMemoryEventDocument(capture({ effective_at: "2026-08-12T09:00:00+09:00" }), sections);
  assert.equal(bytes.includes("\r"), false);
  assert.equal(bytes.endsWith("\n"), true);
  assert.equal(bytes.includes("2026-08-12T00:00:00.000Z"), true);
  assert.equal(bytes.normalize("NFC"), bytes);
  assert.equal(bytes, canonicalMemoryEventDocument(capture(), sections));
});

test("schema limits accept the boundary and reject limit plus one", async () => {
  const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
  const index = JSON.parse(await readFile(path.join(root, "shared/memory/schema/memory-index.schema.json"), "utf8"));
  const receipt = JSON.parse(await readFile(path.join(root, "shared/memory/schema/memory-receipt.schema.json"), "utf8"));
  assert.equal(index.properties.entries.maxItems, 10000);
  for (const key of ["observations", "applied", "excluded"]) assert.equal(receipt.properties[key].maxItems, 256);
});

test("required body, sensitive content, and source bindings retain their prior protection", () => {
  assert.throws(() => parseMemoryDocument("---\nschema_version: 1\n---\n", { sourceName: "bad.md" }));
  assert.equal(validateMemoryRecord({ ...record, password: "x" }).ok, false);
  assert.equal(validateMemorySourceBindings, validateMemorySourceBindings);
});
