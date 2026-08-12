import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  parseMemoryDocument,
  validateMemoryRecord,
  validateMemorySourceBindings,
  validateMemoryTransition,
} from "../../shared/scripts/validate-design-memory.mjs";

const validRecord = Object.freeze({
  schema_version: 1,
  memory_id: "memory-studio-design-lesson-0f2a4c61d9ab34ef",
  event_sha256: "b".repeat(64),
  kind: "design-lesson",
  lane: "studio",
  status: "candidate",
  scope: "project",
  project_id: "wind-island",
  created_at: "2026-08-12T09:00:00+09:00",
  updated_at: "2026-08-12T09:00:00+09:00",
  review_after: "2026-09-11",
  expires_at: "2026-09-11",
  approved_by: null,
  approval_basis: null,
  supersedes: null,
  artifact_types: ["character-skill-combat-monster"],
  related_ids: ["boss-phase-2"],
  tags: ["boss", "counterplay"],
  sources: [{ artifact_id: "combat-loop-v3", locator: "content.md#보스-전투", sha256: "a".repeat(64) }],
});

function clone(overrides = {}) {
  return { ...validRecord, ...overrides, sources: overrides.sources ?? validRecord.sources.map((source) => ({ ...source })) };
}

function frontmatter(record, body = "## 발견한 내용\n내용\n\n## 적용 조건\n조건\n\n## 적용하면 안 되는 경우\n제외\n\n## 근거\n근거\n") {
  const source = record.sources.map((entry) => `  - artifact_id: ${entry.artifact_id}\n    locator: ${entry.locator}\n    sha256: ${entry.sha256}`).join("\n");
  const scalar = (key, value) => `${key}: ${value === null ? "null" : value}`;
  return [
    "---", scalar("schema_version", record.schema_version), scalar("memory_id", record.memory_id), scalar("event_sha256", record.event_sha256),
    scalar("kind", record.kind), scalar("lane", record.lane), scalar("status", record.status), scalar("scope", record.scope),
    scalar("project_id", record.project_id), scalar("created_at", record.created_at), scalar("updated_at", record.updated_at),
    scalar("review_after", record.review_after), scalar("expires_at", record.expires_at), scalar("approved_by", record.approved_by),
    scalar("approval_basis", record.approval_basis), scalar("supersedes", record.supersedes),
    "artifact_types:", ...record.artifact_types.map((value) => `  - ${value}`), "related_ids:", ...record.related_ids.map((value) => `  - ${value}`),
    "tags:", ...record.tags.map((value) => `  - ${value}`), "sources:", source, "---", "", body,
  ].join("\n");
}

test("valid memory record and required Markdown sections are accepted", () => {
  assert.deepEqual(validateMemoryRecord(clone()), { ok: true, errors: [] });
  const parsed = parseMemoryDocument(frontmatter(validRecord), { sourceName: "memory.md" });
  assert.equal(parsed.record.memory_id, validRecord.memory_id);
  assert.deepEqual(Object.keys(parsed.sections).sort(), ["근거", "발견한 내용", "적용 조건", "적용하면 안 되는 경우"].sort());
});

test("record validation closes enum, key, identifier, hash, and ordering boundaries", () => {
  const mutations = [
    ["unknown key", { unknown: true }], ["unknown status", { status: "new" }], ["unknown kind", { kind: "memo" }],
    ["unknown lane", { lane: "other" }], ["unknown scope", { scope: "machine" }], ["uppercase identifier", { memory_id: "Memory-studio-design-lesson-0f2a4c61d9ab34ef" }],
    ["path identifier", { memory_id: "memory/studio" }], ["non-normalized identifier", { memory_id: "memory-studio-e\u0301" }],
    ["missing hash", { event_sha256: undefined }], ["invalid hash", { event_sha256: "B".repeat(64) }],
    ["unsorted tags", { tags: ["counterplay", "boss"] }], ["duplicate related IDs", { related_ids: ["boss-phase-2", "boss-phase-2"] }],
    ["unsorted artifacts", { artifact_types: ["z", "a"] }], ["unsorted sources", { sources: [{ artifact_id: "z", locator: "z.md", sha256: "a".repeat(64) }, { artifact_id: "a", locator: "a.md", sha256: "a".repeat(64) }] }],
  ];
  for (const [name, overrides] of mutations) assert.equal(validateMemoryRecord(clone(overrides)).ok, false, name);
});

test("approval, source, and instruction provenance rules are enforced", () => {
  assert.equal(validateMemoryRecord(clone({ status: "approved" })).ok, false);
  assert.equal(validateMemoryRecord(clone({ sources: [] })).ok, false);
  assert.equal(validateMemoryRecord(clone({ instruction_sha256: "a".repeat(64) })).ok, false);
  const style = clone({ kind: "style-preference", lane: "common", sources: [], instruction_sha256: "a".repeat(64), approval_basis: "explicit-user-instruction", approved_by: "user", status: "approved" });
  assert.equal(validateMemoryRecord(style).ok, true);
  assert.equal(validateMemoryRecord({ ...style, approval_basis: "review" }).ok, false);
  assert.equal(validateMemoryRecord({ ...style, instruction_sha256: undefined }).ok, false);
  assert.equal(validateMemoryRecord(clone({ kind: "style-preference", lane: "common", sources: [] })).ok, false);
});

test("sensitive unknown metadata is rejected before schema errors without exposing its key", () => {
  const result = validateMemoryRecord({ ...clone(), password: "not-a-secret" });
  assert.deepEqual(result.errors.map((entry) => entry.code), ["memory.prohibited_content"]);
  assert.equal(JSON.stringify(result).includes("password"), false);
});

test("calendar and timestamp values are semantically valid", () => {
  assert.equal(validateMemoryRecord(clone({ review_after: "2026-02-30" })).ok, false);
  assert.equal(validateMemoryRecord(clone({ created_at: "2026-02-30T25:61:61+09:00" })).ok, false);
  assert.equal(validateMemoryRecord(clone({ created_at: "2026-08-12T09:00:00+99:99" })).ok, false);
});

test("approved provenance is retained through an approved-state transition", () => {
  const approved = clone({ status: "approved", approved_by: "reviewer", approval_basis: "review" });
  const disputed = { ...approved, status: "disputed" };
  assert.equal(validateMemoryTransition({ from: approved, to: disputed, approvalBasis: "review" }).ok, true);
  assert.equal(validateMemoryTransition({ from: approved, to: { ...disputed, approved_by: null, approval_basis: null }, approvalBasis: "review" }).ok, false);
});

test("Markdown parsing rejects missing mandatory sections and prohibited content without echoing it", () => {
  assert.throws(() => parseMemoryDocument(frontmatter(validRecord, "## 발견한 내용\n내용\n"), { sourceName: "memory.md" }), /section/i);
  const secret = "sk_this_must_not_appear";
  assert.throws(() => parseMemoryDocument(frontmatter(validRecord, `## 발견한 내용\n${secret}\n\n## 적용 조건\nx\n\n## 적용하면 안 되는 경우\nx\n\n## 근거\nx`), { sourceName: "memory.md" }), (error) => {
    assert.equal(error.code, "memory.prohibited_content");
    assert.equal(`${error.message}${JSON.stringify(error)}`.includes(secret), false);
    return true;
  });
});

test("only declared transitions are accepted", () => {
  assert.equal(validateMemoryTransition({ from: "candidate", to: "verified", approvalBasis: null }).ok, true);
  assert.equal(validateMemoryTransition({ from: "candidate", to: "approved", approvalBasis: "review" }).ok, false);
  assert.equal(validateMemoryTransition({ from: "verified", to: "approved", approvalBasis: null }).ok, false);
  assert.equal(validateMemoryTransition({ from: "verified", to: "approved", approvalBasis: "review" }).ok, true);
});

test("source bindings require regular in-workspace files with matching hashes", async (t) => {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), "memory-source-")));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, "docs"));
  await writeFile(path.join(root, "docs", "source.md"), "source text");
  const sha256 = createHash("sha256").update("source text").digest("hex");
  const record = clone({ sources: [{ artifact_id: "combat-loop-v3", locator: "docs/source.md#heading", sha256 }] });
  assert.deepEqual(await validateMemorySourceBindings(record, { workspaceRoot: root }), { ok: true, errors: [] });
  assert.equal((await validateMemorySourceBindings(clone({ sources: [{ artifact_id: "x", locator: "../outside.md", sha256 }] }), { workspaceRoot: root })).ok, false);
  assert.equal((await validateMemorySourceBindings(clone({ sources: [{ artifact_id: "x", locator: "docs/source.md", sha256: "0".repeat(64) }] }), { workspaceRoot: root })).ok, false);
});

test("source bindings reject a workspace reached through a symlinked ancestor", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "memory-source-parent-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const actual = path.join(root, "actual");
  await mkdir(path.join(actual, "docs"), { recursive: true });
  await writeFile(path.join(actual, "docs", "source.md"), "source text");
  await symlink(actual, path.join(root, "linked"));
  const sha256 = createHash("sha256").update("source text").digest("hex");
  const record = clone({ sources: [{ artifact_id: "combat-loop-v3", locator: "docs/source.md", sha256 }] });
  assert.equal((await validateMemorySourceBindings(record, { workspaceRoot: path.join(root, "linked", "docs", "..") })).ok, false);
});
