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
  if (!isRecord(value)) return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor && Object.hasOwn(descriptor, "value") ? descriptor.value : undefined;
}

function validEvidenceId(value) {
  return typeof value === "string" && evidenceIdPattern.test(value);
}

function validTieredEvidence(value) {
  return isRecord(value)
    && typeof value.sourceType === "string"
    && Object.hasOwn(tierBySourceType, value.sourceType)
    && value.tier === tierBySourceType[value.sourceType];
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
    if (record.availability === "unavailable" && !nonEmptyText(record.limitation)) fail("limitation");
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
  if (!isRecord(safeClaim) || !claimKinds.has(safeClaim.kind) || !Array.isArray(safeClaim.evidenceIds) || safeClaim.evidenceIds.length === 0) {
    return { ok: false, code: "invalid_claim" };
  }
  if (!(evidenceById instanceof Map)) return { ok: false, code: "evidence_missing" };
  const evidence = [];
  for (const evidenceId of safeClaim.evidenceIds) {
    if (!validEvidenceId(evidenceId) || !evidenceById.has(evidenceId)) return { ok: false, code: "evidence_missing" };
    let item;
    try {
      item = canonicalCopy(evidenceById.get(evidenceId));
    } catch {
      return { ok: false, code: "invalid_evidence" };
    }
    if (!validTieredEvidence(item)) return { ok: false, code: "invalid_evidence" };
    evidence.push(item);
  }
  if (safeClaim.causal === true && evidence.every(({ tier }) => tier === "discovery")) {
    return { ok: false, code: "unsupported_causal_claim" };
  }
  return { ok: true, code: "supported" };
}
