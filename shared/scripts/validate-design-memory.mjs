import { createHash } from "node:crypto";
import { lstat, open, realpath } from "node:fs/promises";
import path from "node:path";

import { parseRestrictedYaml } from "./validate-artifact.mjs";

export const MEMORY_KINDS = Object.freeze(["project-fact", "decision", "design-lesson", "style-preference", "career-lesson", "external-note"]);
export const MEMORY_STATUSES = Object.freeze(["candidate", "verified", "approved", "expired", "rejected", "disputed", "superseded", "stale"]);
export const MEMORY_LANES = Object.freeze(["common", "studio", "career"]);
export const MEMORY_SCOPES = Object.freeze(["project", "workspace", "global"]);

const RECORD_KEYS = Object.freeze(["schema_version", "memory_id", "event_sha256", "kind", "lane", "status", "scope", "project_id", "created_at", "updated_at", "review_after", "expires_at", "approved_by", "approval_basis", "supersedes", "artifact_types", "related_ids", "tags", "sources", "instruction_sha256"]);
const SHA256 = /^[a-f0-9]{64}$/u;
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const RFC3339 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u;
const DATE = /^\d{4}-\d{2}-\d{2}$/u;
const forbiddenMemoryContent = Object.freeze([/(?:api[_ -]?key|authorization|bearer|access[_ -]?token|password)/iu, /\b(?:sk|rk|pk)_[A-Za-z0-9_-]{8,}\b/u, /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/iu, /\b01[016789]-?\d{3,4}-?\d{4}\b/u, /\b\d{6}-?[1-4]\d{6}\b/u]);
const transitions = Object.freeze({ candidate: ["verified", "expired", "rejected", "disputed"], verified: ["approved", "expired", "rejected", "disputed"], approved: ["disputed", "superseded", "stale"], disputed: ["verified", "rejected", "superseded"], stale: ["verified", "rejected", "superseded"], expired: ["verified", "rejected"], rejected: [], superseded: [] });

function error(code, pathName, message) { return { code, path: pathName, message }; }
function object(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
function safeId(value) { return typeof value === "string" && value === value.normalize("NFC") && ID.test(value); }
function sortedUnique(values, predicate) { return Array.isArray(values) && values.every(predicate) && values.every((value, index) => index === 0 || values[index - 1] < value); }
function addSensitiveError(errors, value) { if (typeof value === "string" && forbiddenMemoryContent.some((pattern) => pattern.test(value))) errors.push(error("memory.prohibited_content", "", "Memory content contains prohibited sensitive information.")); }
function scanSensitive(value, errors) { if (typeof value === "string") addSensitiveError(errors, value); else if (Array.isArray(value)) value.forEach((item) => scanSensitive(item, errors)); else if (object(value)) Object.values(value).forEach((item) => scanSensitive(item, errors)); }

export function validateMemoryRecord(record) {
  const errors = [];
  if (!object(record)) return { ok: false, errors: [error("memory.invalid_record", "", "Memory record must be an object.")] };
  for (const key of Object.keys(record)) if (!RECORD_KEYS.includes(key)) errors.push(error("schema.additional_property", key, "Unknown memory record field."));
  for (const key of RECORD_KEYS.filter((key) => key !== "instruction_sha256")) if (!Object.hasOwn(record, key)) errors.push(error("schema.required", key, "Required memory record field is missing."));
  if (record.schema_version !== 1) errors.push(error("schema.version", "schema_version", "Memory schema version must be 1."));
  for (const key of ["memory_id", "project_id"]) if (!safeId(record[key])) errors.push(error("schema.identifier", key, "Identifier must be normalized lowercase kebab-case."));
  if (!SHA256.test(record.event_sha256 ?? "")) errors.push(error("schema.sha256", "event_sha256", "Hash must be lowercase SHA-256."));
  if (!MEMORY_KINDS.includes(record.kind)) errors.push(error("schema.kind", "kind", "Memory kind is not allowed."));
  if (!MEMORY_LANES.includes(record.lane)) errors.push(error("schema.lane", "lane", "Memory lane is not allowed."));
  if (!MEMORY_STATUSES.includes(record.status)) errors.push(error("schema.status", "status", "Memory status is not allowed."));
  if (!MEMORY_SCOPES.includes(record.scope)) errors.push(error("schema.scope", "scope", "Memory scope is not allowed."));
  for (const key of ["created_at", "updated_at"]) if (typeof record[key] !== "string" || !RFC3339.test(record[key])) errors.push(error("schema.timestamp", key, "Timestamp must be RFC 3339."));
  for (const key of ["review_after", "expires_at"]) if (typeof record[key] !== "string" || !DATE.test(record[key])) errors.push(error("schema.date", key, "Date must be ISO calendar date."));
  for (const key of ["artifact_types", "related_ids", "tags"]) if (!sortedUnique(record[key], safeId)) errors.push(error("schema.sorted_unique", key, "Values must be normalized, unique, and sorted."));
  if (!Array.isArray(record.sources) || !record.sources.every((source) => object(source) && Object.keys(source).every((key) => ["artifact_id", "locator", "sha256"].includes(key)) && safeId(source.artifact_id) && typeof source.locator === "string" && source.locator.length > 0 && SHA256.test(source.sha256))) {
    errors.push(error("schema.sources", "sources", "Sources must be closed source bindings."));
  } else {
    const order = record.sources.map((source) => `${source.artifact_id}\u0000${source.locator}`);
    if (!order.every((value, index) => index === 0 || order[index - 1] < value)) errors.push(error("schema.sorted_unique", "sources", "Sources must be unique and sorted."));
  }
  if (record.kind !== "style-preference" && record.sources?.length === 0) errors.push(error("memory.sources_required", "sources", "Non-style memories require sources."));
  if (Object.hasOwn(record, "instruction_sha256") && (record.kind !== "style-preference" || !SHA256.test(record.instruction_sha256 ?? ""))) errors.push(error("memory.instruction_provenance", "instruction_sha256", "Only style preferences may carry an instruction hash."));
  if (record.kind === "style-preference" && Object.hasOwn(record, "instruction_sha256") && record.approval_basis !== "explicit-user-instruction") errors.push(error("memory.instruction_approval", "approval_basis", "Direct preference approval requires explicit-user-instruction."));
  if (record.status === "approved" && (typeof record.approved_by !== "string" || record.approved_by.trim() === "" || typeof record.approval_basis !== "string" || record.approval_basis.trim() === "")) errors.push(error("memory.approval_required", "approval_basis", "Approved memories require actor and basis."));
  if (record.status !== "approved" && (record.approved_by !== null || record.approval_basis !== null)) errors.push(error("memory.approval_state", "approval_basis", "Only approved memories may contain approval provenance."));
  scanSensitive(record, errors);
  return { ok: errors.length === 0, errors };
}

export function validateMemoryTransition({ from, to, approvalBasis } = {}) {
  const errors = [];
  if (!MEMORY_STATUSES.includes(from) || !MEMORY_STATUSES.includes(to) || !transitions[from]?.includes(to)) errors.push(error("memory.invalid_transition", "status", "Memory status transition is not allowed."));
  if (to === "approved" && (typeof approvalBasis !== "string" || approvalBasis.trim() === "")) errors.push(error("memory.approval_required", "approvalBasis", "Approval transition requires a basis."));
  return { ok: errors.length === 0, errors };
}

export function parseMemoryDocument(source, { sourceName = "memory document" } = {}) {
  if (typeof source !== "string") throw new TypeError(`${sourceName} must be text.`);
  if (forbiddenMemoryContent.some((pattern) => pattern.test(source))) { const failure = new Error("Memory content contains prohibited sensitive information."); failure.code = "memory.prohibited_content"; throw failure; }
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/u.exec(source);
  if (!match) throw new Error("Memory document requires closed YAML frontmatter.");
  const record = parseRestrictedYaml(match[1], sourceName);
  const validation = validateMemoryRecord(record);
  if (!validation.ok) { const failure = new Error("Memory document metadata is invalid."); failure.code = validation.errors[0].code; failure.validation = validation; throw failure; }
  const sections = Object.create(null);
  for (const section of ["발견한 내용", "적용 조건", "적용하면 안 되는 경우", "근거"]) {
    const marker = new RegExp(`^## ${section}\\s*$`, "mu");
    const found = marker.exec(match[2]);
    if (!found) throw new Error(`Memory document is missing required section: ${section}.`);
    const next = /^## /mu; next.lastIndex = found.index + found[0].length;
    const tail = match[2].slice(found.index + found[0].length);
    const nextFound = next.exec(tail);
    sections[section] = tail.slice(0, nextFound?.index).trim();
    if (!sections[section]) throw new Error(`Memory document section is empty: ${section}.`);
  }
  return { record, sections };
}

function safeRelative(value) { return typeof value === "string" && value.length > 0 && value === value.normalize("NFC") && !value.includes("\0") && !value.includes("\\") && !path.posix.isAbsolute(value) && path.posix.normalize(value) === value && !value.startsWith("../") && value !== "."; }
async function regularDirectory(candidate) { const stats = await lstat(candidate); if (stats.isSymbolicLink() || !stats.isDirectory()) throw new Error("Unsafe memory path."); return stats; }

export async function validateMemorySourceBindings(record, { workspaceRoot } = {}) {
  const errors = [];
  let root;
  try { await regularDirectory(workspaceRoot); root = await realpath(workspaceRoot); } catch { return { ok: false, errors: [error("memory.source_workspace", "workspaceRoot", "Workspace root is not a safe directory.")] }; }
  for (const [index, source] of (record?.sources ?? []).entries()) {
    try {
      const filePart = typeof source.locator === "string" ? source.locator.split("#", 1)[0] : "";
      if (!safeRelative(filePart)) throw new Error();
      let current = root;
      for (const segment of filePart.split("/")) { current = path.join(current, segment); const stats = await lstat(current); if (stats.isSymbolicLink() || (!stats.isDirectory() && segment !== filePart.split("/").at(-1))) throw new Error(); }
      const stats = await lstat(current); if (stats.isSymbolicLink() || !stats.isFile()) throw new Error();
      const handle = await open(current, "r"); let bytes; try { bytes = await handle.readFile(); const opened = await handle.stat(); if (opened.dev !== stats.dev || opened.ino !== stats.ino || !opened.isFile()) throw new Error(); } finally { await handle.close(); }
      if (createHash("sha256").update(bytes).digest("hex") !== source.sha256) throw new Error();
    } catch { errors.push(error("memory.source_binding", `sources.${index}`, "Source must be an in-workspace regular file matching its hash.")); }
  }
  return { ok: errors.length === 0, errors };
}
