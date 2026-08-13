import { createHash } from "node:crypto";
import { types } from "node:util";

const CAPTURE_TYPES = new Set(["human-decision", "playtest-finding", "review-finding", "lesson-revision"]);
const LANES = new Set(["common", "studio", "career"]);
const SCOPES = new Set(["project", "workspace", "global"]);
const HUMAN_ACTIONS = new Set(["verify", "approve", "reject", "retire", "sweep", "resolution", "quarantine"]);
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const EVENT_ID = /^mev1-[a-f0-9]{64}$/u;
const CONTROL = /[\u0000-\u001f\u007f-\u009f\uFEFF]/u;
const captureTokens = new WeakMap();
const maintenanceTokens = new WeakMap();

function failure(code) {
  const error = new Error("Memory capability request was rejected.");
  error.code = code;
  return error;
}

function safeString(value) {
  return typeof value === "string" && value.length > 0 && value === value.normalize("NFC") && !CONTROL.test(value);
}

function safeId(value) {
  return safeString(value) && ID.test(value);
}

function utf8Compare(left, right) {
  return Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}

function detached(value, seen = new Set()) {
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (!safeString(value)) throw failure("memory.capability_request");
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw failure("memory.capability_request");
    return value;
  }
  if (typeof value !== "object" || types.isProxy(value) || seen.has(value)) throw failure("memory.capability_request");
  seen.add(value);
  let result;
  if (Array.isArray(value)) {
    if (Object.getPrototypeOf(value) !== Array.prototype) throw failure("memory.capability_request");
    const keys = Reflect.ownKeys(value);
    if (keys.some((key) => typeof key !== "string") || keys.length !== value.length + 1) throw failure("memory.capability_request");
    result = [];
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor?.enumerable || !Object.hasOwn(descriptor, "value")) throw failure("memory.capability_request");
      result.push(detached(descriptor.value, seen));
    }
    const encoded = result.map((item) => JSON.stringify(item));
    if (encoded.some((item, index) => index > 0 && utf8Compare(encoded[index - 1], item) >= 0)) throw failure("memory.capability_request");
  } else {
    if (Object.getPrototypeOf(value) !== Object.prototype) throw failure("memory.capability_request");
    const keys = Reflect.ownKeys(value);
    if (keys.some((key) => typeof key !== "string" || !safeString(key))) throw failure("memory.capability_request");
    result = Object.create(null);
    for (const key of keys.sort(utf8Compare)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor?.enumerable || !Object.hasOwn(descriptor, "value")) throw failure("memory.capability_request");
      result[key] = detached(descriptor.value, seen);
    }
  }
  return Object.freeze(result);
}

function requestObject(value, allowed) {
  if (value === null || typeof value !== "object" || Array.isArray(value) || types.isProxy(value) || Object.getPrototypeOf(value) !== Object.prototype) throw failure("memory.capability_request");
  const result = Object.create(null);
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string" || !allowed.has(key)) throw failure("memory.capability_request");
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor?.enumerable || !Object.hasOwn(descriptor, "value")) throw failure("memory.capability_request");
    result[key] = descriptor.value;
  }
  return result;
}

function instant(value) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) throw failure("memory.capability_request");
  return date.toISOString();
}

function digest(value) {
  return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}

function opaqueToken(map, authority) {
  const token = Object.freeze(Object.create(null));
  map.set(token, Object.freeze(authority));
  return token;
}

function captureRequest(input) {
  const value = requestObject(input, new Set(["projectId", "lane", "scope", "candidateTtlDays", "event", "now"]));
  if (!safeId(value.projectId) || !LANES.has(value.lane) || !SCOPES.has(value.scope) || !Number.isInteger(value.candidateTtlDays) || value.candidateTtlDays < 1 || value.candidateTtlDays > 365) throw failure("memory.capability_request");
  return detached({ projectId: value.projectId, lane: value.lane, scope: value.scope, candidateTtlDays: value.candidateTtlDays, event: value.event, effectiveAt: instant(value.now) });
}

function classificationValue(value) {
  if (typeof value === "string") return { classification: value, instructionContext: null };
  const snapshot = detached(value);
  const keys = Object.keys(snapshot);
  if (!keys.every((key) => ["classification", "instructionContext"].includes(key)) || !Object.hasOwn(snapshot, "classification")) throw failure("memory.classification_rejected");
  return { classification: snapshot.classification, instructionContext: snapshot.instructionContext ?? null };
}

function assertCaptureClassification(request, classification) {
  const event = request.event;
  const substantive = (value) => safeString(value) && Array.from(value.trim()).length >= 2;
  const common = safeId(event?.eventId) && substantive(event?.summary) && substantive(event?.applicability) && substantive(event?.exclusions)
    && Array.isArray(event?.artifactTypes) && Array.isArray(event?.relatedIds) && Array.isArray(event?.tags) && substantive(event?.actor);
  const durable = classification.classification === "durable-finding" && CAPTURE_TYPES.has(event?.type) && Array.isArray(event?.sources) && event.sources.length > 0;
  const explicit = classification.classification === "explicit-user-preference" && event?.type === "explicit-preference" && substantive(classification.instructionContext);
  if (!common || !(durable || explicit)) throw failure("memory.classification_rejected");
}

export function issueCaptureClassificationReceipt(input = {}) {
  const value = requestObject(input, new Set(["projectId", "lane", "scope", "candidateTtlDays", "event", "classification", "now"]));
  const request = captureRequest({ projectId: value.projectId, lane: value.lane, scope: value.scope, candidateTtlDays: value.candidateTtlDays, event: value.event, now: value.now });
  const classification = classificationValue(value.classification);
  assertCaptureClassification(request, classification);
  return opaqueToken(captureTokens, { requestSha256: digest(request), classification: classification.classification, effectiveAt: request.effectiveAt });
}

export function verifyCaptureClassificationReceipt(receipt, input = {}) {
  if (!receipt || types.isProxy(receipt)) return null;
  const authority = captureTokens.get(receipt);
  if (!authority) return null;
  try {
    const request = captureRequest(input);
    return digest(request) === authority.requestSha256 ? authority : null;
  } catch {
    return null;
  }
}

function maintenanceRequest(input) {
  const value = requestObject(input, new Set(["projectId", "scope", "action", "memoryId", "actor", "reason", "observedParentEventIds", "chosenParentEventId", "now"]));
  if (!safeId(value.projectId) || !SCOPES.has(value.scope) || !HUMAN_ACTIONS.has(value.action) || !safeId(value.memoryId) || !safeString(value.actor) || !safeString(value.reason)) throw failure("memory.capability_request");
  const observed = detached(value.observedParentEventIds);
  if (!Array.isArray(observed) || observed.some((item) => !EVENT_ID.test(item))) throw failure("memory.capability_request");
  if (value.action === "resolution") {
    if (observed.length < 2 || !EVENT_ID.test(value.chosenParentEventId ?? "") || !observed.includes(value.chosenParentEventId)) throw failure("memory.capability_request");
  } else if (observed.length !== 1 || value.chosenParentEventId !== undefined) throw failure("memory.capability_request");
  return detached({ projectId: value.projectId, scope: value.scope, action: value.action, memoryId: value.memoryId, actor: value.actor, reason: value.reason, observedParentEventIds: observed, ...(value.chosenParentEventId === undefined ? {} : { chosenParentEventId: value.chosenParentEventId }), effectiveAt: instant(value.now) });
}

export function issueMaintenanceHumanReceipt(input = {}) {
  const request = maintenanceRequest(input);
  return opaqueToken(maintenanceTokens, { requestSha256: digest(request), effectiveAt: request.effectiveAt });
}

export function verifyMaintenanceHumanReceipt(receipt, input = {}) {
  if (!receipt || types.isProxy(receipt)) return null;
  const authority = maintenanceTokens.get(receipt);
  if (!authority) return null;
  try {
    const request = maintenanceRequest(input);
    return digest(request) === authority.requestSha256 ? authority : null;
  } catch {
    return null;
  }
}
