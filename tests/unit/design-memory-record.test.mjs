import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, realpath, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  canonicalMemoryEventDocument,
  canonicalQuarantineMarkerDocument,
  memoryOperationId,
  parseMemoryDocument,
  parseMemoryEventDocument,
  parseQuarantineMarkerDocument,
  validateMemoryEvent,
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
const capture = (overrides = {}) => ({ schema_version: 1, event_type: "capture", action: "capture", memory_id: record.memory_id, operation_id: "capture-upstream-1", parent_event_ids: [], effective_at: "2026-08-12T09:00:00+09:00", actor: "author", reason: "capture", record: { ...record }, ...overrides });
const marker = () => ({ schema_version: 1, memory_id: record.memory_id, target_event_id: "mev1-" + "1".repeat(64), target_relative_path: "v1/events/aa/x/y", observed_sha256: null, reason_code: "memory.bad", actor: "auditor", recorded_at: "2026-08-12T09:00:00+09:00" });
const assertNoncanonicalWithout = (operation, raw) => assert.throws(operation, (error) => error.code === "memory.noncanonical" && !String(error).includes(raw));

const supportedSchemaKeywords = new Set(["$schema", "$id", "$ref", "type", "additionalProperties", "required", "properties", "const", "enum", "pattern", "uniqueItems", "items", "format", "minLength", "minItems", "maxItems", "allOf", "if", "then", "not"]);
const schemaDate = /^\d{4}-\d{2}-\d{2}$/u;
const schemaDateTime = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u;

function schemaCalendarDate(value) {
  if (!schemaDate.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  return month >= 1 && month <= 12 && day >= 1 && day <= new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function schemaFormatAccepts(value, format) {
  if (format === "date") return schemaCalendarDate(value);
  if (format === "date-time") {
    if (!schemaDateTime.test(value)) return false;
    const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|([+-])(\d{2}):(\d{2}))$/u.exec(value);
    return schemaCalendarDate(match?.[1]) && Number(match[2]) <= 23 && Number(match[3]) <= 59 && Number(match[4]) <= 59 && (match[5] === "Z" || (Number(match[7]) <= 14 && Number(match[8]) <= 59 && !(Number(match[7]) === 14 && Number(match[8]) !== 0)));
  }
  throw new Error(`Unsupported JSON Schema format: ${format}`);
}

function assertSupportedSchema(schema, schemas, seen = new Set()) {
  if (schema === null || typeof schema !== "object" || Array.isArray(schema) || seen.has(schema)) return;
  seen.add(schema);
  for (const key of Object.keys(schema)) if (!supportedSchemaKeywords.has(key)) throw new Error(`Unsupported JSON Schema keyword: ${key}`);
  if (schema.$ref && !schemas.has(schema.$ref)) throw new Error(`Unsupported schema reference: ${schema.$ref}`);
  if (schema.format && !["date", "date-time"].includes(schema.format)) throw new Error(`Unsupported JSON Schema format: ${schema.format}`);
  for (const child of Object.values(schema.properties ?? {})) assertSupportedSchema(child, schemas, seen);
  for (const child of [schema.additionalProperties, schema.items, schema.if, schema.then, schema.not]) if (child && typeof child === "object") assertSupportedSchema(child, schemas, seen);
  for (const child of schema.allOf ?? []) assertSupportedSchema(child, schemas, seen);
  if (schema.$ref) assertSupportedSchema(schemas.get(schema.$ref), schemas, seen);
}

function schemaAccepts(value, schema, schemas) {
  assertSupportedSchema(schema, schemas);
  return schemaAcceptsUnchecked(value, schema, schemas);
}

function schemaAcceptsUnchecked(value, schema, schemas) {
  if (schema.$ref) return schemaAcceptsUnchecked(value, schemas.get(schema.$ref), schemas);
  if (schema.allOf && !schema.allOf.every((part) => schemaAcceptsUnchecked(value, part, schemas))) return false;
  if (schema.if && schemaAcceptsUnchecked(value, schema.if, schemas) && schema.then && !schemaAcceptsUnchecked(value, schema.then, schemas)) return false;
  if (schema.not && schemaAcceptsUnchecked(value, schema.not, schemas)) return false;
  if (schema.const !== undefined && JSON.stringify(value) !== JSON.stringify(schema.const)) return false;
  if (schema.enum && !schema.enum.some((candidate) => JSON.stringify(value) === JSON.stringify(candidate))) return false;
  const types = schema.type === undefined ? undefined : Array.isArray(schema.type) ? schema.type : [schema.type];
  if (types && !types.some((type) => (type === "object" && value !== null && typeof value === "object" && !Array.isArray(value)) || (type === "array" && Array.isArray(value)) || (type === "string" && typeof value === "string") || (type === "null" && value === null))) return false;
  if (typeof value === "string") return value.length >= (schema.minLength ?? 0) && (!schema.pattern || new RegExp(schema.pattern, "u").test(value)) && (!schema.format || schemaFormatAccepts(value, schema.format));
  if (Array.isArray(value)) return value.length >= (schema.minItems ?? 0) && value.length <= (schema.maxItems ?? Number.POSITIVE_INFINITY) && (!schema.uniqueItems || new Set(value.map((item) => JSON.stringify(item))).size === value.length) && (!schema.items || value.every((item) => schemaAcceptsUnchecked(item, schema.items, schemas)));
  if (value !== null && typeof value === "object") return !(schema.required ?? []).some((key) => !Object.hasOwn(value, key)) && !(schema.additionalProperties === false && Object.keys(value).some((key) => !Object.hasOwn(schema.properties ?? {}, key))) && Object.entries(value).every(([key, item]) => !schema.properties?.[key] || schemaAcceptsUnchecked(item, schema.properties[key], schemas));
  return true;
}

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
  const transitionBase = { memory_id: record.memory_id, event_type: "transition", action: "verified", parent_event_ids: [parent], effective_at: "2026-08-12T09:00:00+09:00", actor: "author", reason: "capture" };
  const transition = capture({ ...transitionBase, operation_id: memoryOperationId(transitionBase), record: { ...record, status: "verified", updated_at: "2026-08-13T00:00:00.000Z" } });
  assert.equal(parseMemoryEventDocument(canonicalMemoryEventDocument(transition, sections), {}).event.action, "verified");
  assert.throws(() => parseMemoryEventDocument(canonicalMemoryEventDocument({ ...transition, parent_event_ids: [] }, sections), {}));
  const heads = ["mev1-" + "3".repeat(64), "mev1-" + "4".repeat(64)];
  const resolutionBase = { memory_id: record.memory_id, event_type: "resolution", action: "resolution", parent_event_ids: heads, chosen_parent_event_id: heads[0], effective_at: "2026-08-12T09:00:00+09:00", actor: "author", reason: "capture" };
  const resolution = capture({ ...resolutionBase, operation_id: memoryOperationId(resolutionBase) });
  assert.equal(parseMemoryEventDocument(canonicalMemoryEventDocument(resolution, sections), {}).event.chosen_parent_event_id, heads[0]);
  assert.equal(validateMemoryTransition({ from: "candidate", to: "verified", approvalBasis: null }).ok, true);
});

test("canonical serializer is NFC, UTC, LF terminated, and byte-addressed", () => {
  const bytes = canonicalMemoryEventDocument(capture({ effective_at: "2026-08-12T09:00:00+09:00" }), sections);
  assert.equal(bytes.includes("\r"), false);
  assert.equal(bytes.endsWith("\n"), true);
  assert.equal(bytes.endsWith("\n\n"), false);
  assert.equal(bytes.includes("2026-08-12T00:00:00.000Z"), true);
  assert.equal(bytes.normalize("NFC"), bytes);
  assert.equal(bytes, canonicalMemoryEventDocument(capture(), sections));
});

test("canonical event input rejects NUL and NFD strings without disclosing values", () => {
  for (const mutation of [
    { actor: "author\0hidden" },
    { reason: "e\u0301vidence" },
    { record: { ...record, approval_basis: "review\0hidden" } },
  ]) {
    assert.equal(validateMemoryEvent(capture(mutation)).errors[0].code, "memory.noncanonical");
    assert.throws(
      () => canonicalMemoryEventDocument(capture(mutation), sections),
      (error) => error.code === "memory.noncanonical" && !String(error).includes("hidden"),
    );
  }
  assert.equal(validateMemoryRecord({ ...record, approval_basis: "review\0hidden" }).errors[0].code, "memory.noncanonical");
});

test("canonical event sections reject NUL and NFD before whitespace normalization", () => {
  for (const value of ["e\u0301vidence", "safe\0section-hidden"]) {
    assertNoncanonicalWithout(() => canonicalMemoryEventDocument(capture(), { ...sections, "근거": value }), "section-hidden");
  }
});

test("canonical writers snapshot own data properties before validation and serialization", () => {
  const raw = "raw-input-sentinel";
  const changingEvent = capture();
  let eventReads = 0;
  Object.defineProperty(changingEvent, "actor", { enumerable: true, get: () => ++eventReads > 5 ? `author\0${raw}` : "author" });
  assertNoncanonicalWithout(() => canonicalMemoryEventDocument(changingEvent, sections), raw);

  const changingMarker = marker();
  let markerReads = 0;
  Object.defineProperty(changingMarker, "actor", { enumerable: true, get: () => ++markerReads > 5 ? `auditor\0${raw}` : "auditor" });
  assertNoncanonicalWithout(() => canonicalQuarantineMarkerDocument(changingMarker), raw);
});

test("canonical writers reject inherited, cyclic, accessor, and Proxy inputs without leaks", () => {
  const raw = "raw-input-sentinel";
  const inheritedMarker = Object.create({ ...marker(), reason_code: `password ${raw}` });
  assertNoncanonicalWithout(() => canonicalQuarantineMarkerDocument(inheritedMarker), raw);

  const cyclic = capture();
  cyclic.record.loop = cyclic.record;
  assertNoncanonicalWithout(() => canonicalMemoryEventDocument(cyclic, sections), raw);

  const throwingEvent = capture();
  Object.defineProperty(throwingEvent, "actor", { enumerable: true, get: () => { throw new Error(raw); } });
  assertNoncanonicalWithout(() => canonicalMemoryEventDocument(throwingEvent, sections), raw);

  const throwingProxy = new Proxy(marker(), { ownKeys: () => { throw new Error(raw); } });
  assertNoncanonicalWithout(() => canonicalQuarantineMarkerDocument(throwingProxy), raw);
});

test("canonical quarantine marker input rejects NUL and NFD strings", () => {
  const marker = { schema_version: 1, memory_id: record.memory_id, target_event_id: "mev1-" + "1".repeat(64), target_relative_path: "v1/events/aa/x/y", observed_sha256: null, reason_code: "memory.bad", actor: "auditor", recorded_at: "2026-08-12T09:00:00+09:00" };
  for (const mutation of [
    { reason_code: "memory.bad\0hidden" },
    { actor: "audite\u0301r" },
  ]) {
    assert.throws(
      () => canonicalQuarantineMarkerDocument({ ...marker, ...mutation }),
      (error) => error.code === "memory.noncanonical" && !String(error).includes("hidden"),
    );
  }
});

test("event runtime validator and JSON Schema agree on canonical event-type fixtures", async () => {
  const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
  const [eventSchema, recordSchema] = await Promise.all([
    readFile(path.join(root, "shared/memory/schema/memory-event.schema.json"), "utf8").then(JSON.parse),
    readFile(path.join(root, "shared/memory/schema/memory-record.schema.json"), "utf8").then(JSON.parse),
  ]);
  const schemas = new Map([["memory-record.schema.json", recordSchema]]);
  const parent = "mev1-" + "1".repeat(64);
  const transitionBase = { memory_id: record.memory_id, event_type: "transition", action: "verified", parent_event_ids: [parent], effective_at: "2026-08-12T09:00:00+09:00", actor: "author", reason: "capture" };
  const transition = capture({ ...transitionBase, operation_id: memoryOperationId(transitionBase), record: { ...record, status: "verified", updated_at: "2026-08-13T00:00:00.000Z" } });
  const heads = ["mev1-" + "3".repeat(64), "mev1-" + "4".repeat(64)];
  const resolutionBase = { memory_id: record.memory_id, event_type: "resolution", action: "resolution", parent_event_ids: heads, chosen_parent_event_id: heads[0], effective_at: "2026-08-12T09:00:00+09:00", actor: "author", reason: "capture" };
  const resolution = capture({ ...resolutionBase, operation_id: memoryOperationId(resolutionBase) });
  const forbiddenTransitionParent = { ...transition, chosen_parent_event_id: parent };
  forbiddenTransitionParent.operation_id = memoryOperationId(forbiddenTransitionParent);
  const oneParentResolution = { ...resolution, parent_event_ids: [heads[0]] };
  oneParentResolution.operation_id = memoryOperationId(oneParentResolution);
  for (const [fixture, expected] of [
    [capture(), true],
    [transition, true],
    [resolution, true],
    [capture({ operation_id: "mop1-" + "0".repeat(64) }), false],
    [capture({ actor: "author\0hidden" }), false],
    [capture({ actor: "author\nreviewer", reason: "review\naccepted" }), true],
    [capture({ actor: "author\n\0hidden" }), false],
    [capture({ effective_at: "not-a-time" }), false],
    [forbiddenTransitionParent, false],
    [oneParentResolution, false],
  ]) {
    assert.equal(validateMemoryEvent(fixture).ok, expected);
    assert.equal(schemaAccepts(fixture, eventSchema, schemas), expected);
  }
  assert.throws(() => schemaAccepts(capture(), { ...eventSchema, unknown_keyword: true }, schemas), /Unsupported JSON Schema keyword/);
});

test("capture uses a safe upstream operation id while derived events require mop1", () => {
  assert.doesNotThrow(() => canonicalMemoryEventDocument(capture({ operation_id: "capture-upstream-1" }), sections));
  assert.throws(() => canonicalMemoryEventDocument(capture({ operation_id: "mev1-" + "1".repeat(64) }), sections));
});

test("transition and resolution operation ids use the fixed length-prefixed tuple", () => {
  const parent = "mev1-" + "1".repeat(64);
  const event = capture({ event_type: "transition", action: "verified", parent_event_ids: [parent], operation_id: memoryOperationId({ memory_id: record.memory_id, event_type: "transition", action: "verified", effective_at: "2026-08-12T00:00:00.000Z", actor: "author", reason: "review", parent_event_ids: [parent] }), record: { ...record, status: "verified" }, reason: "review" });
  assert.throws(() => canonicalMemoryEventDocument({ ...event, operation_id: "mop1-" + "0".repeat(64) }, sections));
  assert.doesNotThrow(() => canonicalMemoryEventDocument(event, sections));
});

test("event sections reject NUL and sensitive content without echoing it", () => {
  const secret = "sk_this_is_not_a_memory_value";
  assert.throws(() => canonicalMemoryEventDocument(capture(), { ...sections, "근거": secret }), (error) => !String(error).includes(secret));
  assert.throws(() => parseMemoryEventDocument(canonicalMemoryEventDocument(capture(), sections).replace("근거\n\n근거", "근거\n\n\0"), {}), (error) => !String(error).includes("\\0"));
});

test("quarantine marker is canonical Markdown and byte-addressed", () => {
  const marker = { schema_version: 1, memory_id: record.memory_id, target_event_id: "mev1-" + "1".repeat(64), target_relative_path: "v1/events/aa/x/y", observed_sha256: null, reason_code: "memory.bad", actor: "auditor", recorded_at: "2026-08-12T09:00:00+09:00" };
  const bytes = canonicalQuarantineMarkerDocument(marker); const id = `qmv1-${createHash("sha256").update(bytes).digest("hex")}`;
  assert.equal(canonicalQuarantineMarkerDocument(parseQuarantineMarkerDocument(bytes, { markerId: id })), bytes);
  assert.throws(() => parseQuarantineMarkerDocument(bytes.replace("actor:", "actor: unquoted"), { markerId: id }));
});

test("quarantine marker rejects secret actor and reason without disclosure", () => {
  const marker = { schema_version: 1, memory_id: record.memory_id, target_event_id: "mev1-" + "1".repeat(64), target_relative_path: "v1/events/aa/x/y", observed_sha256: null, reason_code: "password proof", actor: "sk_this_marker_secret", recorded_at: "2026-08-12T09:00:00+09:00" };
  assert.throws(() => canonicalQuarantineMarkerDocument(marker), (error) => !String(error).includes("sk_this_marker_secret"));
});

test("schema limits accept the boundary and reject limit plus one", async () => {
  const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
  const index = JSON.parse(await readFile(path.join(root, "shared/memory/schema/memory-index.schema.json"), "utf8"));
  const receipt = JSON.parse(await readFile(path.join(root, "shared/memory/schema/memory-receipt.schema.json"), "utf8"));
  assert.equal(index.properties.entries.maxItems, 10000);
  for (const key of ["observations", "applied", "excluded"]) assert.equal(receipt.properties[key].maxItems, 256);
});

test("required body and sensitive content retain their prior protection", () => {
  assert.throws(() => parseMemoryDocument("---\nschema_version: 1\n---\n", { sourceName: "bad.md" }));
  assert.equal(validateMemoryRecord({ ...record, password: "x" }).ok, false);
});

for (const status of ["candidate", "verified", "expired", "rejected", "disputed", "superseded", "stale"]) test(`record status ${status} remains closed`, () => assert.equal(validateMemoryRecord({ ...record, status }).ok, true));
for (const lane of ["common", "studio", "career"]) test(`record lane ${lane} remains closed`, () => assert.equal(validateMemoryRecord({ ...record, lane }).ok, true));
for (const scope of ["project", "workspace", "global"]) test(`record scope ${scope} remains closed`, () => assert.equal(validateMemoryRecord({ ...record, scope }).ok, true));
for (const [field, value] of [["memory_id", "Memory"], ["tags", ["z", "a"]], ["sources", []], ["review_after", "2026-02-30"]]) test(`record rejects invalid ${field}`, () => assert.equal(validateMemoryRecord({ ...record, [field]: value }).ok, false));

test("source binding fixtures reject changed bytes and final inode swaps", async (t) => {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), "memory-source-"))); t.after(() => rm(root, { recursive: true, force: true })); await mkdir(path.join(root, "docs")); await writeFile(path.join(root, "docs", "source.md"), "trusted"); await writeFile(path.join(root, "docs", "replacement.md"), "other");
  const source = { artifact_id: "source", locator: "docs/source.md#heading", sha256: createHash("sha256").update("trusted").digest("hex") };
  assert.equal((await validateMemorySourceBindings({ ...record, sources: [source] }, { workspaceRoot: root })).ok, true);
  assert.equal((await validateMemorySourceBindings({ ...record, sources: [source] }, { workspaceRoot: root, beforeFinalRecheck: () => rename(path.join(root, "docs", "replacement.md"), path.join(root, "docs", "source.md")) })).ok, false);
});
