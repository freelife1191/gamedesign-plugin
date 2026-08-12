import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import path from "node:path";

import { parseRestrictedYaml } from "./validate-artifact.mjs";

export const MEMORY_KINDS = Object.freeze(["project-fact", "decision", "design-lesson", "style-preference", "career-lesson", "external-note"]);
export const MEMORY_STATUSES = Object.freeze(["candidate", "verified", "approved", "expired", "rejected", "disputed", "superseded", "stale"]);
export const MEMORY_LANES = Object.freeze(["common", "studio", "career"]);
export const MEMORY_SCOPES = Object.freeze(["project", "workspace", "global"]);

const RECORD_KEYS = Object.freeze(["schema_version", "memory_id", "kind", "lane", "status", "scope", "project_id", "created_at", "updated_at", "review_after", "expires_at", "approved_by", "approval_basis", "supersedes", "artifact_types", "related_ids", "tags", "sources", "instruction_sha256"]);
const EVENT_KEYS = Object.freeze(["schema_version", "event_type", "action", "memory_id", "operation_id", "parent_event_ids", "chosen_parent_event_id", "effective_at", "actor", "reason", "record"]);
const SHA256 = /^[a-f0-9]{64}$/u;
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const RFC3339 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u;
const DATE = /^\d{4}-\d{2}-\d{2}$/u;
const forbiddenMemoryContent = Object.freeze([/(?:api[_ -]?key|authorization|bearer|access[_ -]?token|password)/iu, /\b(?:sk|rk|pk)_[A-Za-z0-9_-]{8,}\b/u, /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/iu, /\b01[016789]-?\d{3,4}-?\d{4}\b/u, /\b\d{6}-?[1-4]\d{6}\b/u]);
const transitions = Object.freeze({ candidate: ["verified", "expired", "rejected", "disputed"], verified: ["approved", "expired", "rejected", "disputed"], approved: ["disputed", "superseded", "stale"], disputed: ["verified", "rejected", "superseded"], stale: ["verified", "rejected", "superseded"], expired: ["verified", "rejected"], rejected: [], superseded: [] });

function error(code, pathName, message) { return { code, path: pathName, message }; }
function object(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
function snapshotCanonicalInput(value) {
  try { return { ok: true, value: snapshot(value, new Set()) }; } catch { return { ok: false }; }
}
function snapshot(value, ancestors) {
  if (value === null || typeof value !== "object") return value;
  if (ancestors.has(value)) throw new Error();
  ancestors.add(value);
  const prototype = Object.getPrototypeOf(value);
  let copy;
  if (Array.isArray(value)) {
    if (prototype !== Array.prototype) throw new Error();
    const length = Object.getOwnPropertyDescriptor(value, "length");
    if (!length || !Object.hasOwn(length, "value")) throw new Error();
    const keys = Reflect.ownKeys(value);
    if (keys.length !== length.value + 1) throw new Error();
    copy = [];
    for (let index = 0; index < length.value; index += 1) {
      const key = String(index); const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !descriptor.enumerable || !Object.hasOwn(descriptor, "value")) throw new Error();
      copy.push(snapshot(descriptor.value, ancestors));
    }
    if (keys.some((key) => key !== "length" && (!/^(?:0|[1-9]\d*)$/u.test(key) || Number(key) >= length.value))) throw new Error();
  } else {
    if (prototype !== Object.prototype && prototype !== null) throw new Error();
    copy = Object.create(null);
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== "string") throw new Error();
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !descriptor.enumerable || !Object.hasOwn(descriptor, "value")) throw new Error();
      copy[key] = snapshot(descriptor.value, ancestors);
    }
  }
  ancestors.delete(value);
  return Object.freeze(copy);
}
function validateCanonicalStringTree(value, seen = new Set()) {
  if (typeof value === "string") return value.includes("\0") || value.includes("\uFEFF") || value.includes("\r") || value !== value.normalize("NFC") ? { ok: false } : { ok: true };
  if (value === null || typeof value !== "object") return { ok: true };
  if (seen.has(value)) return { ok: false };
  seen.add(value);
  const entries = Array.isArray(value) ? value.map((item, index) => [String(index), item]) : Object.entries(value);
  for (const [key, item] of entries) {
    if (key.includes("\0") || key.includes("\uFEFF") || key.includes("\r") || key !== key.normalize("NFC")) return { ok: false };
    const validation = validateCanonicalStringTree(item, seen);
    if (!validation.ok) return validation;
  }
  seen.delete(value);
  return { ok: true };
}
function safeId(value) { return typeof value === "string" && value === value.normalize("NFC") && ID.test(value); }
function sortedUnique(values, predicate) { return Array.isArray(values) && values.every(predicate) && values.every((value, index) => index === 0 || values[index - 1] < value); }
function addSensitiveError(errors, value) { if (typeof value === "string" && forbiddenMemoryContent.some((pattern) => pattern.test(value))) errors.push(error("memory.prohibited_content", "", "Memory content contains prohibited sensitive information.")); }
function scanSensitive(value, errors) { if (typeof value === "string") addSensitiveError(errors, value); else if (Array.isArray(value)) value.forEach((item) => scanSensitive(item, errors)); else if (object(value)) for (const [key, item] of Object.entries(value)) { addSensitiveError(errors, key); scanSensitive(item, errors); } }
function calendarDate(value) { if (!DATE.test(value ?? "")) return false; const [year, month, day] = value.split("-").map(Number); return month >= 1 && month <= 12 && day >= 1 && day <= new Date(Date.UTC(year, month, 0)).getUTCDate(); }
function timestamp(value) { if (typeof value !== "string" || !RFC3339.test(value)) return false; const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|([+-])(\d{2}):(\d{2}))$/u.exec(value); return calendarDate(match?.[1]) && Number(match[2]) <= 23 && Number(match[3]) <= 59 && Number(match[4]) <= 59 && (match[5] === "Z" || (Number(match[7]) <= 14 && Number(match[8]) <= 59 && !(Number(match[7]) === 14 && Number(match[8]) !== 0))); }

export function validateMemoryRecord(record) {
  const snapshot = snapshotCanonicalInput(record);
  if (!snapshot.ok) return { ok: false, errors: [error("memory.noncanonical", "", "Memory input must be canonical plain data.")] };
  return validateMemoryRecordSnapshot(snapshot.value);
}
function validateMemoryRecordSnapshot(record) {
  const errors = [];
  if (!object(record)) return { ok: false, errors: [error("memory.invalid_record", "", "Memory record must be an object.")] };
  if (!validateCanonicalStringTree(record).ok) return { ok: false, errors: [error("memory.noncanonical", "", "Memory strings must be NFC and cannot contain NUL.")] };
  scanSensitive(record, errors);
  if (errors.length > 0) return { ok: false, errors: [error("memory.prohibited_content", "", "Memory content contains prohibited sensitive information.")] };
  for (const key of Object.keys(record)) if (!RECORD_KEYS.includes(key)) errors.push(error("schema.additional_property", key, "Unknown memory record field."));
  for (const key of RECORD_KEYS.filter((key) => key !== "instruction_sha256")) if (!Object.hasOwn(record, key)) errors.push(error("schema.required", key, "Required memory record field is missing."));
  if (record.schema_version !== 1) errors.push(error("schema.version", "schema_version", "Memory schema version must be 1."));
  for (const key of ["memory_id", "project_id"]) if (!safeId(record[key])) errors.push(error("schema.identifier", key, "Identifier must be normalized lowercase kebab-case."));
  if (!MEMORY_KINDS.includes(record.kind)) errors.push(error("schema.kind", "kind", "Memory kind is not allowed."));
  if (!MEMORY_LANES.includes(record.lane)) errors.push(error("schema.lane", "lane", "Memory lane is not allowed."));
  if (!MEMORY_STATUSES.includes(record.status)) errors.push(error("schema.status", "status", "Memory status is not allowed."));
  if (!MEMORY_SCOPES.includes(record.scope)) errors.push(error("schema.scope", "scope", "Memory scope is not allowed."));
  for (const key of ["created_at", "updated_at"]) if (!timestamp(record[key])) errors.push(error("schema.timestamp", key, "Timestamp must be RFC 3339."));
  for (const key of ["review_after", "expires_at"]) if (!calendarDate(record[key])) errors.push(error("schema.date", key, "Date must be ISO calendar date."));
  for (const key of ["artifact_types", "related_ids", "tags"]) if (!sortedUnique(record[key], safeId)) errors.push(error("schema.sorted_unique", key, "Values must be normalized, unique, and sorted."));
  if (!Array.isArray(record.sources) || !record.sources.every((source) => object(source) && Object.keys(source).every((key) => ["artifact_id", "locator", "sha256"].includes(key)) && safeId(source.artifact_id) && safeLocator(source.locator) && SHA256.test(source.sha256))) {
    errors.push(error("schema.sources", "sources", "Sources must be closed source bindings."));
  } else {
    const order = record.sources.map((source) => `${source.artifact_id}\u0000${source.locator}`);
    if (!order.every((value, index) => index === 0 || order[index - 1] < value)) errors.push(error("schema.sorted_unique", "sources", "Sources must be unique and sorted."));
  }
  if (record.kind !== "style-preference" && record.sources?.length === 0) errors.push(error("memory.sources_required", "sources", "Non-style memories require sources."));
  if (record.kind === "style-preference" && record.sources?.length === 0 && (record.status !== "approved" || !SHA256.test(record.instruction_sha256 ?? "") || record.approval_basis !== "explicit-user-instruction" || typeof record.approved_by !== "string" || record.approved_by.trim() === "")) errors.push(error("memory.instruction_provenance", "instruction_sha256", "Source-less style preferences require an approved instruction event with actor and explicit basis."));
  if (Object.hasOwn(record, "instruction_sha256") && (record.kind !== "style-preference" || !SHA256.test(record.instruction_sha256 ?? ""))) errors.push(error("memory.instruction_provenance", "instruction_sha256", "Only style preferences may carry an instruction hash."));
  if (record.kind === "style-preference" && record.status === "approved" && (!SHA256.test(record.instruction_sha256 ?? "") || record.approval_basis !== "explicit-user-instruction" || typeof record.approved_by !== "string" || record.approved_by.trim() === "")) errors.push(error("memory.instruction_approval", "approval_basis", "Approved style preferences require instruction hash, actor, and explicit-user-instruction."));
  const noApproval = record.approved_by === null && record.approval_basis === null;
  const namedApproval = typeof record.approved_by === "string" && record.approved_by.trim() !== "" && typeof record.approval_basis === "string" && record.approval_basis.trim() !== "";
  if (!noApproval && !namedApproval) errors.push(error("memory.approval_state", "approval_basis", "Approval provenance must be either a named pair or null."));
  if (record.status === "approved" && !namedApproval) errors.push(error("memory.approval_required", "approval_basis", "Approved memories require actor and basis."));
  if (record.status === "candidate" && !noApproval) errors.push(error("memory.approval_state", "approval_basis", "Candidate memories cannot contain approval provenance."));
  if (!(record.supersedes === null || safeId(record.supersedes)) || record.supersedes === record.memory_id) errors.push(error("memory.supersedes", "supersedes", "Superseded memory must reference another normalized memory id."));
  return { ok: errors.length === 0, errors };
}

export function validateMemoryTransition({ from, to, approvalBasis } = {}) {
  const errors = [];
  const fromStatus = typeof from === "string" ? from : from?.status;
  const toStatus = typeof to === "string" ? to : to?.status;
  if (!MEMORY_STATUSES.includes(fromStatus) || !MEMORY_STATUSES.includes(toStatus) || !transitions[fromStatus]?.includes(toStatus)) errors.push(error("memory.invalid_transition", "status", "Memory status transition is not allowed."));
  if (toStatus === "approved" && (typeof approvalBasis !== "string" || approvalBasis.trim() === "")) errors.push(error("memory.approval_required", "approvalBasis", "Approval transition requires a basis."));
  if (object(from) && object(to)) {
    if (from.approved_by !== null && (to.approved_by !== from.approved_by || to.approval_basis !== from.approval_basis)) errors.push(error("memory.approval_history", "approval_basis", "Approved provenance must be retained through a transition."));
    if (to.status === "approved" && (to.approved_by === null || to.approval_basis !== approvalBasis)) errors.push(error("memory.approval_required", "approvalBasis", "Approved transition must retain actor and basis."));
  }
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

function quote(value) { return JSON.stringify(value); }
function yamlRecord(record, indent = "") {
  const scalar = ["schema_version", "memory_id", "kind", "lane", "status", "scope", "project_id", "created_at", "updated_at", "review_after", "expires_at", "approved_by", "approval_basis", "supersedes"];
  const lines = [];
  for (const key of scalar) lines.push(`${indent}${key}: ${record[key] === null ? "null" : typeof record[key] === "number" ? record[key] : quote(normalizeTime(key, record[key]))}`);
  if (Object.hasOwn(record, "instruction_sha256")) lines.push(`${indent}instruction_sha256: ${quote(record.instruction_sha256)}`);
  for (const key of ["artifact_types", "related_ids", "tags"]) { lines.push(`${indent}${key}:`); for (const value of record[key]) lines.push(`${indent}  - ${quote(value)}`); }
  lines.push(`${indent}sources:`); for (const source of record.sources) { lines.push(`${indent}  - artifact_id: ${quote(source.artifact_id)}`, `${indent}    locator: ${quote(source.locator)}`, `${indent}    sha256: ${quote(source.sha256)}`); }
  return lines;
}
function normalizeTime(key, value) { return ["effective_at", "created_at", "updated_at"].includes(key) ? new Date(value).toISOString() : value; }
function eventFailure(message, code = "memory.event") { const failure = new Error(message); failure.code = code; throw failure; }
function sensitiveText(value) { return typeof value !== "string" || value.includes("\0") || forbiddenMemoryContent.some((pattern) => pattern.test(value)); }
function canonicalSection(value) {
  if (typeof value !== "string") return { ok: false, code: "memory.prohibited_content" };
  if (value.includes("\0") || value.includes("\uFEFF") || value.includes("\r") || value !== value.normalize("NFC")) return { ok: false, code: "memory.noncanonical" };
  if (sensitiveText(value)) return { ok: false, code: "memory.prohibited_content" };
  const normalized = value.replace(/\r\n?/gu, "\n").split("\n").map((line) => line.replace(/[ \t]+$/gu, "")).join("\n").replace(/^\n+|\n+$/gu, "");
  return normalized ? { ok: true, value: normalized } : { ok: false, code: "memory.prohibited_content" };
}
function lengthPrefix(value) { const bytes = Buffer.from(value, "utf8"); const length = Buffer.alloc(8); length.writeBigUInt64BE(BigInt(bytes.byteLength)); return Buffer.concat([length, bytes]); }

export function memoryOperationId({ memory_id, event_type, action, effective_at, actor, reason, parent_event_ids, chosen_parent_event_id } = {}) {
  if (!safeId(memory_id) || !["transition", "resolution"].includes(event_type) || typeof action !== "string" || !timestamp(effective_at) || typeof actor !== "string" || !actor.trim() || typeof reason !== "string" || !reason.trim() || !sortedUnique(parent_event_ids, (id) => /^mev1-[a-f0-9]{64}$/u.test(id))) eventFailure("Invalid operation tuple.", "memory.operation");
  const values = ["memory-operation-v1", memory_id, event_type, action, new Date(effective_at).toISOString(), actor, reason, String(parent_event_ids.length), ...parent_event_ids, chosen_parent_event_id ?? ""];
  return `mop1-${createHash("sha256").update(Buffer.concat(values.map(lengthPrefix))).digest("hex")}`;
}

export function canonicalMemoryEventDocument(event, sections) {
  const snapshot = snapshotCanonicalInput({ event, sections });
  if (!snapshot.ok || !validateCanonicalStringTree(snapshot.value).ok) eventFailure("Memory event input is not canonical.", "memory.noncanonical");
  const { event: eventSnapshot, sections: sectionsSnapshot } = snapshot.value;
  const validation = validateMemoryEventSnapshot(eventSnapshot);
  if (!validation.ok) eventFailure("Memory event metadata is invalid.", validation.errors[0].code);
  const canonicalSections = ["발견한 내용", "적용 조건", "적용하면 안 되는 경우", "근거"].map((key) => canonicalSection(sectionsSnapshot?.[key]));
  if (canonicalSections.some((section) => !section.ok)) eventFailure("Memory event sections are invalid.", canonicalSections.find((section) => !section.ok).code);
  const lines = ["---", `schema_version: ${eventSnapshot.schema_version}`, `event_type: ${quote(eventSnapshot.event_type)}`, `action: ${quote(eventSnapshot.action)}`, `memory_id: ${quote(eventSnapshot.memory_id)}`, `operation_id: ${quote(eventSnapshot.operation_id)}`, eventSnapshot.parent_event_ids.length === 0 ? "parent_event_ids: []" : "parent_event_ids:"];
  for (const value of eventSnapshot.parent_event_ids) lines.push(`  - ${quote(value)}`);
  if (eventSnapshot.chosen_parent_event_id !== undefined) lines.push(`chosen_parent_event_id: ${quote(eventSnapshot.chosen_parent_event_id)}`);
  lines.push(`effective_at: ${quote(normalizeTime("effective_at", eventSnapshot.effective_at))}`, `actor: ${quote(eventSnapshot.actor)}`, `reason: ${quote(eventSnapshot.reason)}`, "record:", ...yamlRecord(eventSnapshot.record, "  "), "---", "");
  for (const [index, section] of ["발견한 내용", "적용 조건", "적용하면 안 되는 경우", "근거"].entries()) lines.push(`## ${section}`, "", canonicalSections[index].value, "");
  return `${lines.join("\n").replace(/\n+$/u, "")}\n`;
}

export function validateMemoryEvent(event) {
  const snapshot = snapshotCanonicalInput(event);
  if (!snapshot.ok) return { ok: false, errors: [error("memory.noncanonical", "", "Memory input must be canonical plain data.")] };
  return validateMemoryEventSnapshot(snapshot.value);
}
function validateMemoryEventSnapshot(event) {
  const errors = [];
  if (!object(event)) return { ok: false, errors: [error("memory.event", "", "Memory event must be an object.")] };
  if (!validateCanonicalStringTree(event).ok) return { ok: false, errors: [error("memory.noncanonical", "", "Memory strings must be NFC and cannot contain NUL.")] };
  scanSensitive(event, errors); if (errors.length) return { ok: false, errors: [error("memory.prohibited_content", "", "Memory content contains prohibited sensitive information.")] };
  if (Object.keys(event).some((key) => !EVENT_KEYS.includes(key))) errors.push(error("schema.additional_property", "", "Unknown memory event field."));
  for (const key of EVENT_KEYS.filter((key) => key !== "chosen_parent_event_id")) if (!Object.hasOwn(event, key)) errors.push(error("schema.required", key, "Required memory event field is missing."));
  const captureOperation = /^(?!(?:mev1|mop1)-)[a-z0-9]+(?:-[a-z0-9]+)*$/u;
  if (event.schema_version !== 1 || !["capture", "transition", "resolution"].includes(event.event_type) || !safeId(event.memory_id) || !(event.event_type === "capture" ? captureOperation.test(event.operation_id ?? "") : /^mop1-[a-f0-9]{64}$/u.test(event.operation_id ?? "")) || !timestamp(event.effective_at) || typeof event.actor !== "string" || !event.actor.trim() || typeof event.reason !== "string" || !event.reason.trim()) errors.push(error("memory.event", "", "Memory event metadata is invalid."));
  if (!sortedUnique(event.parent_event_ids, (id) => /^mev1-[a-f0-9]{64}$/u.test(id))) errors.push(error("memory.event_parent", "parent_event_ids", "Parents must be sorted event identifiers."));
  if (event.event_type === "capture" && (event.action !== "capture" || event.parent_event_ids?.length !== 0 || event.chosen_parent_event_id !== undefined)) errors.push(error("memory.capture", "", "Capture must have no parents."));
  if (event.event_type === "transition" && (event.parent_event_ids?.length !== 1 || !MEMORY_STATUSES.includes(event.action) || event.chosen_parent_event_id !== undefined)) errors.push(error("memory.transition", "", "Transition must have one parent and a status action."));
  if (event.event_type === "resolution" && (event.action !== "resolution" || event.parent_event_ids?.length < 2 || !event.parent_event_ids.includes(event.chosen_parent_event_id))) errors.push(error("memory.resolution", "", "Resolution must name an observed parent head."));
  if (["transition", "resolution"].includes(event.event_type)) { try { if (event.operation_id !== memoryOperationId(event)) errors.push(error("memory.operation", "operation_id", "Operation id does not match its tuple.")); } catch { errors.push(error("memory.operation", "operation_id", "Operation id is invalid.")); } }
  const recordValidation = validateMemoryRecordSnapshot(event.record); if (!recordValidation.ok || event.record?.memory_id !== event.memory_id) errors.push(error("memory.event_snapshot", "record", "Event record snapshot is invalid."));
  return { ok: errors.length === 0, errors };
}

export function parseMemoryEventDocument(source, { sourceName = "memory event", eventId } = {}) {
  if (typeof source !== "string" || source !== source.normalize("NFC") || source.startsWith("\uFEFF") || source.includes("\r") || source.includes("\0") || !source.endsWith("\n") || forbiddenMemoryContent.some((pattern) => pattern.test(source))) eventFailure("Memory event must be canonical UTF-8 Markdown.", "memory.prohibited_content");
  if (eventId !== undefined && eventId !== `mev1-${createHash("sha256").update(source).digest("hex")}`) eventFailure("Memory event id does not match its bytes.", "memory.event_id");
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/u.exec(source); if (!match) eventFailure("Memory event requires closed YAML frontmatter.");
  const event = parseRestrictedYaml(match[1].replace(/^parent_event_ids: \[\]$/mu, "parent_event_ids:\n  - __empty__"), sourceName); if (event.parent_event_ids?.length === 1 && event.parent_event_ids[0] === "__empty__") event.parent_event_ids = [];
  const validation = validateMemoryEvent(event); if (!validation.ok) eventFailure("Memory event metadata is invalid.", validation.errors[0].code);
  const sections = Object.create(null); let remainder = match[2].startsWith("\n") ? match[2].slice(1) : match[2];
  for (const section of ["발견한 내용", "적용 조건", "적용하면 안 되는 경우", "근거"]) { const prefix = `## ${section}\n\n`; if (!remainder.startsWith(prefix)) eventFailure(`Memory event is missing required section: ${section}.`); remainder = remainder.slice(prefix.length); const boundary = remainder.indexOf("\n\n## "); const body = boundary === -1 ? remainder.endsWith("\n") ? remainder.slice(0, -1) : remainder : remainder.slice(0, boundary); if (!body || body.includes("\n\0")) eventFailure(`Memory event is missing required section: ${section}.`); sections[section] = body; remainder = boundary === -1 ? "" : remainder.slice(boundary + 2); }
  if (remainder || canonicalMemoryEventDocument(event, sections) !== source) eventFailure("Memory event is not canonical.", "memory.noncanonical");
  return { event, record: event.record, sections };
}

const MARKER_KEYS = Object.freeze(["schema_version", "memory_id", "target_event_id", "target_relative_path", "observed_sha256", "reason_code", "actor", "recorded_at"]);
export function canonicalQuarantineMarkerDocument(marker) {
  const snapshot = snapshotCanonicalInput(marker);
  if (!snapshot.ok || !validateCanonicalStringTree(snapshot.value).ok) eventFailure("Quarantine marker is not canonical.", "memory.noncanonical");
  const markerSnapshot = snapshot.value;
  const markerErrors = []; scanSensitive(markerSnapshot, markerErrors);
  if (!object(markerSnapshot) || markerErrors.length || MARKER_KEYS.some((key) => !Object.hasOwn(markerSnapshot, key)) || Object.keys(markerSnapshot).some((key) => !MARKER_KEYS.includes(key)) || markerSnapshot.schema_version !== 1 || !safeId(markerSnapshot.memory_id) || !/^mev1-[a-f0-9]{64}$/u.test(markerSnapshot.target_event_id ?? "") || !safeRelative(markerSnapshot.target_relative_path) || !(markerSnapshot.observed_sha256 === null || SHA256.test(markerSnapshot.observed_sha256)) || typeof markerSnapshot.reason_code !== "string" || !markerSnapshot.reason_code.trim() || typeof markerSnapshot.actor !== "string" || !markerSnapshot.actor.trim() || !timestamp(markerSnapshot.recorded_at)) eventFailure("Quarantine marker is invalid.", "memory.quarantine_marker");
  return `---\nschema_version: 1\nmemory_id: ${quote(markerSnapshot.memory_id)}\ntarget_event_id: ${quote(markerSnapshot.target_event_id)}\ntarget_relative_path: ${quote(markerSnapshot.target_relative_path)}\nobserved_sha256: ${markerSnapshot.observed_sha256 === null ? "null" : quote(markerSnapshot.observed_sha256)}\nreason_code: ${quote(markerSnapshot.reason_code)}\nactor: ${quote(markerSnapshot.actor)}\nrecorded_at: ${quote(new Date(markerSnapshot.recorded_at).toISOString())}\n---\n\n## Quarantine\n\nsealed quarantine marker\n`;
}
export function parseQuarantineMarkerDocument(source, { markerId } = {}) {
  if (typeof source !== "string" || source.includes("\0") || source.includes("\r") || !source.endsWith("\n") || source.endsWith("\n\n") || source !== source.normalize("NFC")) eventFailure("Quarantine marker is invalid.", "memory.quarantine_marker");
  if (markerId && markerId !== `qmv1-${createHash("sha256").update(source).digest("hex")}`) eventFailure("Quarantine marker id does not match its bytes.", "memory.quarantine_marker");
  const match = /^---\n([\s\S]*?)\n---\n\n## Quarantine\n\nsealed quarantine marker\n$/u.exec(source); if (!match) eventFailure("Quarantine marker is invalid.", "memory.quarantine_marker");
  const marker = parseRestrictedYaml(match[1], "quarantine marker"); if (canonicalQuarantineMarkerDocument(marker) !== source) eventFailure("Quarantine marker is not canonical.", "memory.quarantine_marker");
  return marker;
}

function safeRelative(value) { return typeof value === "string" && value.length > 0 && value === value.normalize("NFC") && !value.includes("\0") && !value.includes("\\") && !path.posix.isAbsolute(value) && path.posix.normalize(value) === value && !value.startsWith("../") && value !== "."; }
function safeLocator(value) {
  if (typeof value !== "string" || value.length === 0 || value !== value.normalize("NFC")) return false;
  const separator = value.indexOf("#");
  const filePart = separator === -1 ? value : value.slice(0, separator);
  return safeRelative(filePart);
}
async function regularDirectory(candidate) { const stats = await lstat(candidate); if (stats.isSymbolicLink() || !stats.isDirectory()) throw new Error("Unsafe memory path."); return stats; }
async function canonicalWorkspace(candidate) { if (typeof candidate !== "string" || !path.isAbsolute(candidate)) throw new Error("Unsafe memory path."); for (let current = path.resolve(candidate); current !== path.dirname(current); current = path.dirname(current)) if ((await lstat(current)).isSymbolicLink()) throw new Error("Unsafe memory path."); const stats = await regularDirectory(candidate); const canonical = await realpath(candidate); const final = await regularDirectory(canonical); if (stats.dev !== final.dev || stats.ino !== final.ino) throw new Error("Unsafe memory path."); return { path: canonical, identity: final }; }

export async function observeMemorySourceBindings(record, { workspaceRoot, beforeFinalRecheck } = {}) {
  const errors = [];
  const observations = [];
  let root;
  let rootIdentity;
  try { ({ path: root, identity: rootIdentity } = await canonicalWorkspace(workspaceRoot)); } catch {
    for (const source of record?.sources ?? []) observations.push({ artifactId: source?.artifact_id ?? "unknown", locator: source?.locator ?? "", expectedSha256: source?.sha256 ?? null, observedSha256: null, status: "unreadable" });
    return { ok: false, errors: [error("memory.source_workspace", "workspaceRoot", "Workspace root is not a safe directory.")], observations };
  }
  for (const [index, source] of (record?.sources ?? []).entries()) {
    let status = "unreadable"; let observedSha256 = null;
    try {
      const filePart = typeof source.locator === "string" ? source.locator.split("#", 1)[0] : "";
      if (!safeRelative(filePart)) throw new Error();
      let current = root; const identities = [{ path: root, stats: rootIdentity }]; const segments = filePart.split("/");
      for (const [part, segment] of segments.entries()) { current = path.join(current, segment); const stats = await lstat(current); if (stats.isSymbolicLink()) { status = "symlink"; throw new Error(); } if (!stats.isDirectory() && part !== segments.length - 1) throw new Error(); if (part !== segments.length - 1) identities.push({ path: current, stats }); }
      const stats = await lstat(current); if (stats.isSymbolicLink()) { status = "symlink"; throw new Error(); } if (!stats.isFile()) throw new Error();
      if (!constants.O_NOFOLLOW) throw new Error();
      const handle = await open(current, constants.O_RDONLY | constants.O_NOFOLLOW); let bytes; let opened; try { opened = await handle.stat(); if (opened.dev !== stats.dev || opened.ino !== stats.ino || !opened.isFile()) throw new Error(); bytes = await handle.readFile(); const after = await handle.stat(); if (after.dev !== opened.dev || after.ino !== opened.ino || after.size !== opened.size || after.mtimeMs !== opened.mtimeMs || after.ctimeMs !== opened.ctimeMs) throw new Error(); } finally { await handle.close(); }
      if (typeof beforeFinalRecheck === "function") await beforeFinalRecheck({ locator: filePart });
      const final = await lstat(current); if (final.isSymbolicLink() || !final.isFile() || final.dev !== opened.dev || final.ino !== opened.ino || final.size !== opened.size || final.mtimeMs !== opened.mtimeMs || final.ctimeMs !== opened.ctimeMs) throw new Error();
      for (const identity of identities) { const currentStats = await regularDirectory(identity.path); if (currentStats.dev !== identity.stats.dev || currentStats.ino !== identity.stats.ino) throw new Error(); }
      observedSha256 = createHash("sha256").update(bytes).digest("hex"); if (observedSha256 !== source.sha256) { status = "drift"; throw new Error(); }
      status = "current";
    } catch (failure) { if (failure?.code === "ENOENT") status = "missing"; errors.push(error("memory.source_binding", `sources.${index}`, "Source must be an in-workspace regular file matching its hash.")); }
    observations.push({ artifactId: source?.artifact_id ?? "unknown", locator: source?.locator ?? "", expectedSha256: source?.sha256 ?? null, observedSha256, status });
  }
  return { ok: errors.length === 0, errors, observations };
}
export async function validateMemorySourceBindings(record, options = {}) { const result = await observeMemorySourceBindings(record, options); return { ok: result.ok, errors: result.errors }; }
