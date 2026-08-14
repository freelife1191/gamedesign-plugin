import { canonicalJson } from "./reference-intelligence-canonical.mjs";
import {
  evidenceClaimKinds,
  evidenceRecordKeys,
  evidenceSourceTypes,
  tierBySourceType,
  tierForSourceType,
} from "./reference-evidence-contract.mjs";

export { tierBySourceType };

const evidenceIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const claimKinds = new Set(evidenceClaimKinds);
const claimCategories = new Set(["general", "monetization", "retention", "performance"]);
export const claimKindCertainty = Object.freeze({ observation: 3, inference: 2, hypothesis: 1, unknown: 0 });

/** Derives the strongest allowed persisted kind: the least-certain available source wins. */
export function deriveAvailableClaimKind(records) {
  const available = records.filter((record) => record?.availability === "available");
  if (available.length === 0) return "unknown";
  return available.reduce((lowest, record) => claimKindCertainty[record.claimKind] < claimKindCertainty[lowest] ? record.claimKind : lowest, available[0].claimKind);
}

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
  return typeof value === "string" && value.length > 0 && !value.includes("\0") && !value.includes("\r") && value === value.normalize("NFC");
}

function safeLocator(value) {
  if (!isRecord(value) || Object.keys(value).sort().join("\0") !== "kind\0value" || !nonEmptyText(value.value)) return false;
  if (value.kind === "project-relative") return !value.value.startsWith("/") && !value.value.includes("\\") && !value.value.split("/").includes("..");
  if (value.kind === "url") {
    try { const url = new URL(value.value); return url.protocol === "https:" && !url.username && !url.password && !url.hash; } catch { return false; }
  }
  return false;
}

function validProvenance(value) {
  if (!nonEmptyText(value.build) || !nonEmptyText(value.region) || !nonEmptyText(value.accountState) || !nonEmptyText(value.observedAt)
    || Number.isNaN(Date.parse(value.observedAt)) || !safeLocator(value.locator) || !nonEmptyText(value.screen) || !nonEmptyText(value.action) || !nonEmptyText(value.result)) return false;
  if (!Array.isArray(value.transformations) || value.transformations.length !== 2
    || !value.transformations.every((item) => isRecord(item) && Object.keys(item).sort().join("\0") === "from\0to" && ["original", "capture", "summary"].includes(item.from) && ["original", "capture", "summary"].includes(item.to))) return false;
  if (value.transformations[0].from !== "original" || value.transformations[0].to !== "capture" || value.transformations[1].from !== "capture" || value.transformations[1].to !== "summary") return false;
  if (!isRecord(value.rights) || Object.keys(value.rights).sort().join("\0") !== "copyright\0publication\0use" || !["analysis", "internal-review"].includes(value.rights.use) || !["private", "redacted"].includes(value.rights.publication) || !nonEmptyText(value.rights.copyright)) return false;
  return ["none", "conflicting"].includes(value.conflictState) && (value.counterexampleOf === null || validEvidenceId(value.counterexampleOf));
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

function sortedUniqueIds(values) {
  return Array.isArray(values) && values.length > 0 && values.every(validEvidenceId)
    && values.every((value, index) => index === 0 || byteCompare(values[index - 1], value) < 0);
}

function hasExactEvidenceKeys(value, { allowMissingTier = false } = {}) {
  const keys = allowMissingTier ? evidenceRecordKeys.filter((key) => key !== "tier") : evidenceRecordKeys;
  return isRecord(value)
    && Object.keys(value).length === keys.length
    && keys.every((key) => Object.hasOwn(value, key));
}

function validTieredEvidence(value) {
  return hasExactEvidenceKeys(value)
    && validEvidenceId(value.evidenceId)
    && validEvidenceId(value.referenceId)
    && validEvidenceId(value.contextId)
    && sortedUniqueIds(value.systemIds)
    && typeof value.sourceType === "string"
    && evidenceSourceTypes.includes(value.sourceType)
    && value.tier === tierForSourceType(value.sourceType)
    && ["available", "unavailable"].includes(value.availability)
    && claimKinds.has(value.claimKind)
    && nonEmptyText(value.claim)
    && validProvenance(value)
    && ((value.availability === "available" && value.limitation === null && value.verificationQuestion === null)
      || (value.availability === "unavailable" && nonEmptyText(value.limitation) && nonEmptyText(value.verificationQuestion)));
}

function validClaim(value) {
  const keys = ["category", "causal", "claimId", "evidenceIds", "kind", "systemIds"];
  if (!isRecord(value) || Object.keys(value).sort().join("\u0000") !== keys.join("\u0000")) return false;
  if (!validEvidenceId(value.claimId) || !claimKinds.has(value.kind) || !claimCategories.has(value.category) || typeof value.causal !== "boolean") return false;
  return sortedUniqueIds(value.evidenceIds) && sortedUniqueIds(value.systemIds);
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
    if (!hasExactEvidenceKeys(record, { allowMissingTier: true }) && !hasExactEvidenceKeys(record)) fail();
    if (!validEvidenceId(record.evidenceId) || !validEvidenceId(record.referenceId) || !validEvidenceId(record.contextId) || !sortedUniqueIds(record.systemIds) || !evidenceSourceTypes.includes(record.sourceType) || !claimKinds.has(record.claimKind) || !nonEmptyText(record.claim) || !validProvenance(record)) fail();
    const tier = tierForSourceType(record.sourceType);
    if (!tier || (Object.hasOwn(record, "tier") && record.tier !== tier)) fail("tier");
    if (ids.has(record.evidenceId)) fail("duplicate-id");
    ids.add(record.evidenceId);
    if (!["available", "unavailable"].includes(record.availability)) fail("availability");
    if (record.availability === "available" && (record.limitation !== null || record.verificationQuestion !== null)) fail("availability");
    if (record.availability === "unavailable" && (!nonEmptyText(record.limitation) || !nonEmptyText(record.verificationQuestion))) fail("unavailable");
    return {
      evidenceId: record.evidenceId,
      referenceId: record.referenceId,
      contextId: record.contextId,
      systemIds: record.systemIds,
      sourceType: record.sourceType,
      tier,
      claimKind: record.claimKind,
      claim: record.claim,
      availability: record.availability,
      limitation: record.limitation,
      verificationQuestion: record.verificationQuestion,
      build: record.build,
      region: record.region,
      accountState: record.accountState,
      observedAt: record.observedAt,
      locator: record.locator,
      screen: record.screen,
      action: record.action,
      result: record.result,
      transformations: record.transformations,
      rights: record.rights,
      conflictState: record.conflictState,
      counterexampleOf: record.counterexampleOf,
    };
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
    if (!validTieredEvidence(item) || item.evidenceId !== evidenceId) return { ok: false, code: "invalid_evidence" };
    if (!item.systemIds.some((systemId) => safeClaim.systemIds.includes(systemId))) return { ok: false, code: "evidence_system_mismatch" };
    evidence.push(item);
  }
  const available = evidence.filter(({ availability }) => availability === "available");
  if (available.length === 0) return { ok: false, code: "evidence_unavailable" };
  const coveredSystems = new Set(available.flatMap(({ systemIds }) => systemIds));
  if (safeClaim.systemIds.some((systemId) => !coveredSystems.has(systemId))) return { ok: false, code: "evidence_system_mismatch" };
  if (available.some(({ claimKind }) => claimKindCertainty[claimKind] < claimKindCertainty[safeClaim.kind])) return { ok: false, code: "unsupported_claim_kind" };
  if (safeClaim.causal && available.every(({ tier }) => tier === "discovery")) {
    return { ok: false, code: "unsupported_causal_claim" };
  }
  return { ok: true, code: "supported" };
}

/** Validates context and Atlas-system bindings after the shared registry has normalized records. */
export function validateEvidenceBindings({ evidence, contexts, systemIds } = {}) {
  let records;
  let safeContexts;
  let safeSystemIds;
  try {
    records = canonicalCopy(evidence);
    safeContexts = canonicalCopy(contexts);
    safeSystemIds = canonicalCopy(systemIds);
  } catch {
    fail("binding");
  }
  if (!Array.isArray(records) || !Array.isArray(safeContexts) || !Array.isArray(safeSystemIds) || !safeSystemIds.every(validEvidenceId)) fail("binding");
  const contextsById = new Map();
  for (const context of safeContexts) {
    if (!isRecord(context) || Object.keys(context).sort().join("\0") !== ["contextId", "platform", "referenceId", "version"].join("\0")
      || !validEvidenceId(context.contextId) || !validEvidenceId(context.referenceId) || !validEvidenceId(context.platform) || !nonEmptyText(context.version) || contextsById.has(context.contextId)) fail("binding");
    contextsById.set(context.contextId, context);
  }
  const knownSystems = new Set(safeSystemIds);
  for (const record of records) {
    if (!validTieredEvidence(record)) fail("binding");
    const context = contextsById.get(record.contextId);
    if (!context || context.referenceId !== record.referenceId || record.systemIds.some((systemId) => !knownSystems.has(systemId))) fail("binding");
  }
  return true;
}
