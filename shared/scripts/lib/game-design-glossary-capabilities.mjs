import { types } from "node:util";
import { canonicalJson, sha256Canonical } from "./reference-intelligence-canonical.mjs";

const issuedCapabilities = new WeakMap();
const issuedReceipts = new WeakMap();
const actions = new Set(["approve", "deprecate", "replace"]);
const roleLike = /^(?:chatgpt|assistant|agent|bot|model|system)$/iu;
const id = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const termId = /^TERM-[A-Z0-9]+(?:-[A-Z0-9]+)*$/u;
const hash = /^[a-f0-9]{64}$/u;
const control = /[\u0000-\u001f\u007f-\u009f\uFEFF]/u;
const compare = (left, right) => Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));

function reject() { throw new Error("A live human glossary decision is required."); }
function text(value) { return typeof value === "string" && value.length > 0 && value === value.normalize("NFC") && !control.test(value); }
function ownPlain(value, keys) {
  if (!value || typeof value !== "object" || Array.isArray(value) || types.isProxy(value) || Object.getPrototypeOf(value) !== Object.prototype || Reflect.ownKeys(value).some((key) => typeof key !== "string" || !keys.includes(key))) reject();
  const result = Object.create(null);
  for (const key of keys) if (Object.hasOwn(value, key)) { const descriptor = Object.getOwnPropertyDescriptor(value, key); if (!descriptor?.enumerable || !Object.hasOwn(descriptor, "value")) reject(); result[key] = descriptor.value; }
  return result;
}
function timestamp(value) { if (!text(value) || Number.isNaN(new Date(value).valueOf()) || new Date(value).toISOString() !== value) reject(); return value; }
function decision(input) {
  const value = ownPlain(input, ["action", "termIds", "replacementTermId", "actor", "eventId", "glossarySha256", "glossaryVersion", "changedAt", "channel"]);
  if (!actions.has(value.action) || !text(value.actor) || roleLike.test(value.actor) || value.channel !== undefined || !id.test(value.eventId ?? "") || !hash.test(value.glossarySha256 ?? "") || !Number.isInteger(value.glossaryVersion) || value.glossaryVersion < 1 || !Array.isArray(value.termIds) || value.termIds.length === 0 || value.termIds.some((item) => !termId.test(item)) || value.termIds.some((item, index) => index > 0 && compare(value.termIds[index - 1], item) >= 0)) reject();
  const replacement = value.replacementTermId ?? null;
  if ((value.action === "approve" && replacement !== null) || ((value.action === "deprecate" || value.action === "replace") && (!termId.test(replacement ?? "") || value.termIds.includes(replacement)))) reject();
  return Object.freeze({ action: value.action, actor: value.actor, changedAt: timestamp(value.changedAt), eventId: value.eventId, glossarySha256: value.glossarySha256, glossaryVersion: value.glossaryVersion, replacementTermId: replacement, termIds: Object.freeze([...value.termIds]) });
}

export function issueGlossaryHumanDecision(input = {}) {
  const receipt = decision(input);
  const capability = Object.freeze(Object.create(null));
  issuedCapabilities.set(capability, sha256Canonical(receipt));
  issuedReceipts.set(receipt, capability);
  return Object.freeze({ receipt, capability });
}

export function assertGlossaryHumanDecision(receipt, capability) {
  try {
    if (!receipt || !capability || types.isProxy(receipt) || types.isProxy(capability) || issuedReceipts.get(receipt) !== capability || issuedCapabilities.get(capability) !== sha256Canonical(receipt)) reject();
    return receipt;
  } catch { reject(); }
}

export function canonicalGlossaryDecision(input = {}) { return canonicalJson(decision(input)); }
