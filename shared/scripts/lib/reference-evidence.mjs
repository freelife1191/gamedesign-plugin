import { canonicalJson } from "./reference-intelligence-canonical.mjs";

export const tierBySourceType = Object.freeze({
  "direct-play": "primary",
  "official-site": "primary",
  "official-patch-note": "primary",
  "official-odds": "primary",
  "official-store": "primary",
  "developer-talk": "supporting",
  "curated-wiki": "supporting",
  "expert-guide": "supporting",
  community: "discovery",
  video: "discovery",
  review: "discovery",
  "unofficial-tracker": "discovery",
});

const evidenceIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const claimKinds = new Set(["observation", "inference", "hypothesis", "unknown"]);
const claimCategories = new Set(["general", "monetization", "retention", "performance"]);
const certaintyRank = Object.freeze({ observation: 3, inference: 2, hypothesis: 1, unknown: 0 });

function fail(code = "invalid") {
  const error = new Error("reference evidence is invalid");
  error.code = `reference-evidence.${code}`;
  throw error;
}

function byteCompare(left, right) {
  return Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}

function canonicalCopy(value) {
  try {
    return JSON.parse(canonicalJson(value));
  } catch {
    fail();
  }
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function nonEmptyText(value) {
  return typeof value === "string" && value.length > 0;
}

function dataField(value, key) {
  try {
    if (!isRecord(value)) return undefined;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor && Object.hasOwn(descriptor, "value") ? descriptor.value : undefined;
  } catch {
    return undefined;
  }
}

function validEvidenceId(value) {
  return typeof value === "string" && evidenceIdPattern.test(value);
}

function validTieredEvidence(value) {
  return isRecord(value)
    && typeof value.sourceType === "string"
    && Object.hasOwn(tierBySourceType, value.sourceType)
    && value.tier === tierBySourceType[value.sourceType]
    && ["available", "unavailable"].includes(value.availability)
    && claimKinds.has(value.claimKind)
    && ((value.availability === "available" && value.limitation === null && value.verificationQuestion === null)
      || (value.availability === "unavailable" && nonEmptyText(value.limitation) && nonEmptyText(value.verificationQuestion)));
}

function validClaim(value) {
  const keys = ["category", "causal", "claimId", "evidenceIds", "kind"];
  if (!isRecord(value) || Object.keys(value).sort().join("\u0000") !== keys.join("\u0000")) return false;
  if (!validEvidenceId(value.claimId) || !claimKinds.has(value.kind) || !claimCategories.has(value.category) || typeof value.causal !== "boolean") return false;
  return Array.isArray(value.evidenceIds)
    && value.evidenceIds.length > 0
    && value.evidenceIds.every(validEvidenceId)
    && value.evidenceIds.every((id, index) => index === 0 || byteCompare(value.evidenceIds[index - 1], id) < 0);
}

function isIntrinsicMap(value) {
  try {
    return value !== null && typeof value === "object" && Object.getPrototypeOf(value) === Map.prototype;
  } catch {
    return false;
  }
}

/**
 * Creates a canonical, detached evidence registry and derives every tier from the source type.
 * Optional sources may be recorded as unavailable with a limitation; no network request occurs.
 */
export function registerReferenceEvidence(input = {}) {
  const copy = canonicalCopy(input);
  if (!Array.isArray(copy.records)) fail();
  const ids = new Set();
  const registered = copy.records.map((record) => {
    if (!isRecord(record) || !validEvidenceId(record.evidenceId) || typeof record.sourceType !== "string") fail();
    const tier = tierBySourceType[record.sourceType];
    if (!tier || (Object.hasOwn(record, "tier") && record.tier !== tier)) fail("tier");
    if (ids.has(record.evidenceId)) fail("duplicate-id");
    ids.add(record.evidenceId);
    if (!["available", "unavailable"].includes(record.availability)) fail("availability");
    if (record.availability === "available" && (record.limitation !== null || record.verificationQuestion !== null)) fail("availability");
    if (record.availability === "unavailable" && (!nonEmptyText(record.limitation) || !nonEmptyText(record.verificationQuestion))) fail("unavailable");
    return { ...record, tier };
  });
  return registered.sort((left, right) => byteCompare(left.evidenceId, right.evidenceId));
}

/**
 * Checks whether supplied evidence can support a claim without upgrading discovery material.
 */
export function validateClaimAgainstEvidence(input = {}) {
  const claim = dataField(input, "claim");
  const evidenceById = dataField(input, "evidenceById");
  let safeClaim;
  try {
    safeClaim = canonicalCopy(claim);
  } catch {
    return { ok: false, code: "invalid_claim" };
  }
  if (!validClaim(safeClaim)) {
    return { ok: false, code: "invalid_claim" };
  }
  if (!isIntrinsicMap(evidenceById)) return { ok: false, code: "invalid_evidence" };
  const evidence = [];
  for (const evidenceId of safeClaim.evidenceIds) {
    let found;
    try {
      found = Map.prototype.has.call(evidenceById, evidenceId);
    } catch {
      return { ok: false, code: "invalid_evidence" };
    }
    if (!found) return { ok: false, code: "evidence_missing" };
    let item;
    try {
      item = canonicalCopy(Map.prototype.get.call(evidenceById, evidenceId));
    } catch {
      return { ok: false, code: "invalid_evidence" };
    }
    if (!validTieredEvidence(item)) return { ok: false, code: "invalid_evidence" };
    evidence.push(item);
  }
  const available = evidence.filter(({ availability }) => availability === "available");
  if (available.length === 0) return { ok: false, code: "evidence_unavailable" };
  if (available.some(({ claimKind }) => certaintyRank[claimKind] < certaintyRank[safeClaim.kind])) return { ok: false, code: "unsupported_claim_kind" };
  if (safeClaim.causal && available.every(({ tier }) => tier === "discovery")) {
    return { ok: false, code: "unsupported_causal_claim" };
  }
  return { ok: true, code: "supported" };
}
