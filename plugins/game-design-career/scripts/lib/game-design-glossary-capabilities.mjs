import { types } from "node:util";
import { canonicalJson, sha256Canonical } from "./reference-intelligence-canonical.mjs";

const decisionCapabilities = new WeakMap();
const decisionReceipts = new WeakMap();
const overrideCapabilities = new WeakMap();
const overrideReceipts = new WeakMap();
const mappingCapabilities = new WeakMap();
const mappingObservations = new WeakMap();
const actions = new Set(["approve", "deprecate", "replace"]);
const roleLike = /(?:^|\s)(?:chatgpt|assistant|agent|bot|model|system)(?:\s|$)/iu;
const id = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const termId = /^TERM-[A-Z0-9]+(?:-[A-Z0-9]+)*$/u;
const hash = /^[a-f0-9]{64}$/u;
const unsafe = /[\u0000-\u0009\u000b-\u001f\u007f-\u009f\uFEFF\r]/u;
const sensitive = [/(?:sk|pk)_(?:live|test)_[A-Za-z0-9_-]+/iu, /(?:api[_-]?key|password|secret|token)\s*[=:]/iu, /(?:^|\s)\/[\w./-]+/u];
const compare = (left, right) => Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));

function reject() { throw new Error("A live human glossary decision is required."); }
function text(value, max = 4096) { return typeof value === "string" && value.length > 0 && Buffer.byteLength(value, "utf8") <= max && value === value.normalize("NFC") && !unsafe.test(value) && !sensitive.some((pattern) => pattern.test(value)); }
function timestamp(value) { return text(value) && !Number.isNaN(new Date(value).valueOf()) && new Date(value).toISOString() === value; }
function plain(value, keys) {
  if (!value || typeof value !== "object" || Array.isArray(value) || types.isProxy(value) || Object.getPrototypeOf(value) !== Object.prototype || Reflect.ownKeys(value).some((key) => typeof key !== "string" || !keys.includes(key))) reject();
  const output = Object.create(null);
  for (const key of keys) if (Object.hasOwn(value, key)) { const descriptor = Object.getOwnPropertyDescriptor(value, key); if (!descriptor?.enumerable || !Object.hasOwn(descriptor, "value")) reject(); output[key] = descriptor.value; }
  return output;
}
function sortedTermIds(value) { return Array.isArray(value) && value.length > 0 && value.every((item) => termId.test(item)) && value.every((item, index) => index === 0 || compare(value[index - 1], item) < 0); }
function glossary(value) { return value && typeof value === "object" && !types.isProxy(value) ? sha256Canonical(value) : reject(); }
function opaque(receipts, capabilities, receipt) { const capability = Object.freeze(Object.create(null)); capabilities.set(capability, sha256Canonical(receipt)); receipts.set(receipt, capability); return Object.freeze({ receipt, capability }); }

function normalizeDecision(input) {
  const value = plain(input, ["action", "termIds", "replacementTermId", "actor", "eventId", "glossarySha256", "glossaryVersion", "changedAt", "channel"]);
  if (!actions.has(value.action) || !text(value.actor) || roleLike.test(value.actor) || value.channel !== undefined || !id.test(value.eventId ?? "") || !hash.test(value.glossarySha256 ?? "") || !Number.isInteger(value.glossaryVersion) || value.glossaryVersion < 1 || !sortedTermIds(value.termIds) || !timestamp(value.changedAt)) reject();
  const replacementTermId = value.replacementTermId ?? null;
  if ((value.action === "approve" && replacementTermId !== null) || (value.action !== "approve" && (!termId.test(replacementTermId ?? "") || value.termIds.includes(replacementTermId)))) reject();
  return Object.freeze({ action: value.action, actor: value.actor, changedAt: value.changedAt, eventId: value.eventId, glossarySha256: value.glossarySha256, glossaryVersion: value.glossaryVersion, replacementTermId, termIds: Object.freeze([...value.termIds]) });
}

export function issueGlossaryHumanDecision(input = {}) { return opaque(decisionReceipts, decisionCapabilities, normalizeDecision(input)); }
export function assertGlossaryHumanDecision(receipt, capability) {
  try { if (!receipt || !capability || types.isProxy(receipt) || types.isProxy(capability) || decisionReceipts.get(receipt) !== capability || decisionCapabilities.get(capability) !== sha256Canonical(receipt)) reject(); return receipt; } catch { reject(); }
}

function normalizeMappingObservation(input) {
  const value = plain(input, ["documentId", "glossarySha256", "status", "targetLanguage", "termId", "termIds"]);
  if (!id.test(value.documentId ?? "") || !hash.test(value.glossarySha256 ?? "") || value.status !== "missing" || !["ko", "en"].includes(value.targetLanguage) || !termId.test(value.termId ?? "") || !sortedTermIds(value.termIds) || !value.termIds.includes(value.termId)) reject();
  return Object.freeze({ documentId: value.documentId, glossarySha256: value.glossarySha256, status: value.status, targetLanguage: value.targetLanguage, termId: value.termId, termIds: Object.freeze([...value.termIds]) });
}

/** Issues an opaque, live observation only after closed plain-data canonicalization. */
export function issueGlossaryMappingObservation(input = {}) {
  const issued = opaque(mappingObservations, mappingCapabilities, normalizeMappingObservation(input));
  return Object.freeze({ receipt: issued.receipt, observation: issued.receipt, capability: issued.capability });
}

export function assertGlossaryMappingObservation(observation, capability, { documentId, effectiveGlossary, termIds, targetLanguage } = {}) {
  try {
    if (!observation || !capability || types.isProxy(observation) || types.isProxy(capability) || mappingObservations.get(observation) !== capability || mappingCapabilities.get(capability) !== sha256Canonical(observation)) reject();
    if (!id.test(documentId ?? "") || observation.documentId !== documentId || observation.glossarySha256 !== glossary(effectiveGlossary) || !sortedTermIds(termIds) || canonicalJson(observation.termIds) !== canonicalJson(termIds) || observation.targetLanguage !== targetLanguage) reject();
    return observation;
  } catch { reject(); }
}

function normalizeOverride(input) {
  const value = plain(input, ["sharedGlossary", "projectOverlay", "termIds", "reason", "actor", "eventId", "changedAt"]);
  if (!text(value.reason, 1024) || !text(value.actor) || roleLike.test(value.actor) || !id.test(value.eventId ?? "") || !timestamp(value.changedAt) || !sortedTermIds(value.termIds)) reject();
  return Object.freeze({ actor: value.actor, changedAt: value.changedAt, eventId: value.eventId, overlaySha256: glossary(value.projectOverlay), reason: value.reason, sharedSha256: glossary(value.sharedGlossary), termIds: Object.freeze([...value.termIds]) });
}

export function issueGlossaryOverrideDecision(input = {}) { return opaque(overrideReceipts, overrideCapabilities, normalizeOverride(input)); }
export function assertGlossaryOverrideDecision(receipt, capability, { sharedGlossary, projectOverlay, termIds, reason } = {}) {
  try {
    if (!receipt || !capability || types.isProxy(receipt) || types.isProxy(capability) || overrideReceipts.get(receipt) !== capability || overrideCapabilities.get(capability) !== sha256Canonical(receipt)) reject();
    if (sharedGlossary !== undefined && (receipt.sharedSha256 !== glossary(sharedGlossary) || receipt.overlaySha256 !== glossary(projectOverlay) || receipt.reason !== reason || canonicalJson(receipt.termIds) !== canonicalJson(termIds))) reject();
    return receipt;
  } catch { reject(); }
}

export function canonicalGlossaryDecision(input = {}) { return canonicalJson(normalizeDecision(input)); }
