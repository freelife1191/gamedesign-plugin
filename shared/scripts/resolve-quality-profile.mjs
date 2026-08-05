import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import path from "node:path";

import { validateQualityProfile } from "./validate-quality-profile.mjs";
import { assertValidReferencePreset } from "./validate-reference-preset.mjs";

const stableIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const removalKeyPattern = /^(?:remove(?:_|$)|.*_removals?$)/u;
const documentStates = ["draft", "structurally-complete", "evidence-reviewed", "visual-reviewed", "document-approved"];
const scoreKeys = ["templateMatch", "artifactTypeMatch", "formatMatch", "audienceOverlap", "goalOverlap"];
const selectionIndexKeys = ["schema_version", "namespace", "profiles"];
const selectionEntryKeys = ["profile_id", "artifact_types", "audiences", "required_formats", "forbidden_formats"];
const digestPattern = /^[a-f0-9]{64}$/u;
const knownOverlayIds = new Set(["mobile", "live-service", "pc-console"]);
const knownPresetIds = new Set([
  "cinematic-narrative", "competitive-live-service", "evolving-world", "function-first",
  "player-validated-small-team", "replayable-coop", "ugc-production-tooling",
]);
const trustedIndexAnchors = {
  studio: {
    count: 17,
    digest: "a72d061c272d86d6eb3daaf6d8541498765d4474d5b01a494522ec7e10f59ca7",
    ids: [
      "accessibility-platform-matrix", "character-skill-combat-monster-specification", "core-motivation-loop",
      "data-table-contract", "design-review-decision-log", "economy-balance-specification", "executive-pitch",
      "game-design-brief", "liveops-event-experiment-plan", "master-gdd", "narrative-quest-npc-specification",
      "playtest-metrics-report", "production-scope-milestone-risk-plan", "rule-state-exception-matrix",
      "system-feature-specification", "ui-ux-flow-state-specification", "vision-one-pager",
    ],
  },
  career: {
    count: 13,
    digest: "3e72b4f8d261f987d6577d35155e77076a28ba924fad512266baed299caba408",
    ids: [
      "career-stage-role-map", "competency-matrix", "game-analysis-report", "interview-question-answer-report",
      "job-posting-evidence", "junior-growth-review", "learning-roadmap", "portfolio-case-study",
      "portfolio-project-brief", "portfolio-review-backlog", "recruiter-portfolio-presentation",
      "reverse-design-document", "transition-readiness",
    ],
  },
};
const responsibleGateIds = new Set([
  "ai-rights-human-approval", "accessibility", "economy-transparency", "liveops-experiment",
  "ugc-safety", "ai-npc-safety", "scope-control",
]);

function clone(value) {
  return structuredClone(value);
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function digestValue(value) {
  return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
}

function indexDigest(value) {
  return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}

function hasRemovalDirective(value) {
  if (!value || typeof value !== "object") return false;
  if (!Array.isArray(value) && Object.keys(value).some((key) => removalKeyPattern.test(key))) return true;
  return Object.values(value).some(hasRemovalDirective);
}

function assertPlainObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) {
    throw new Error(`${label} must be a plain object`);
  }
}

function exactKeys(value, expected, label) {
  assertPlainObject(value, label);
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  if (actual.length !== sortedExpected.length || actual.some((key, index) => key !== sortedExpected[index])) {
    throw new Error(`${label} contains an unknown or missing field`);
  }
}

function normalizeText(value) {
  if (typeof value !== "string") throw new Error("document-quality text must be a string");
  return value.normalize("NFC").trim().replace(/\s+/gu, " ").toLocaleLowerCase("en-US");
}

function normalizeId(value) {
  const normalized = normalizeText(value).replace(/[_\s]+/gu, "-").replace(/-+/gu, "-");
  if (!stableIdPattern.test(normalized)) throw new Error(`Invalid document-quality ID: ${String(value)}`);
  return normalized;
}

function textTokens(value) {
  return new Set(normalizeText(value).match(/[\p{L}\p{N}]+/gu) ?? []);
}

function tokenUnion(values) {
  const result = new Set();
  for (const value of values) for (const token of textTokens(value)) result.add(token);
  return result;
}

function overlapCount(left, right) {
  let count = 0;
  for (const value of left) if (right.has(value)) count += 1;
  return count;
}

function levenshtein(left, right) {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[right.length];
}

export function adaptReferencePreset(preset) {
  assertValidReferencePreset(preset);
  return deepFreeze({
    presetId: preset.preset_id,
    emphasis: clone(preset.emphasis),
    reviewQuestions: clone(preset.review_questions),
    recommendedDiagrams: clone(preset.recommended_diagrams),
    storyHints: clone(preset.story_hints),
    additionalAcceptanceCriteria: clone(preset.additional_acceptance_criteria),
  });
}

function entryKey(value) {
  if (value && typeof value === "object" && typeof value.id === "string") return `id:${value.id}`;
  return `value:${JSON.stringify(value)}`;
}

function mergeArray(target, additions) {
  const result = clone(target);
  const seen = new Set(result.map(entryKey));
  for (const addition of additions) {
    const key = entryKey(addition);
    if (!seen.has(key)) {
      result.push(clone(addition));
      seen.add(key);
    }
  }
  return result;
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function mergeObject(target, incoming, basePath, source, conflicts) {
  for (const [key, value] of Object.entries(incoming)) {
    const itemPath = `${basePath}/${key}`;
    if (!Object.hasOwn(target, key)) {
      target[key] = clone(value);
    } else if (Array.isArray(target[key]) && Array.isArray(value)) {
      target[key] = mergeArray(target[key], value);
    } else if (isObject(target[key]) && isObject(value)) {
      mergeObject(target[key], value, itemPath, source, conflicts);
    } else if (JSON.stringify(target[key]) !== JSON.stringify(value)) {
      conflicts.push({ path: itemPath, primary: clone(target[key]), incoming: clone(value), source });
    }
  }
}

function validationDetails(validation) {
  return validation.errors
    .map(({ code, path: errorPath, message }) => `${errorPath || "/"} [${code}] ${message}`)
    .join("; ");
}

function assertUniqueAcceptanceCriteria(source, sourceName) {
  const seen = new Set();
  for (const criterion of source.acceptance_criteria ?? []) {
    const normalized = normalizeText(criterion);
    if (seen.has(normalized)) throw new Error(`Duplicate normalized acceptance criterion in ${sourceName}`);
    seen.add(normalized);
  }
}

export function composeQualityProfile({ primary, overlays = [], preset = null, referencePreset = null }) {
  if (!primary || typeof primary !== "object" || Array.isArray(primary)) throw new Error("primary profile must be an object");
  if (!Array.isArray(overlays)) throw new Error("overlays must be an array");
  const sources = [...overlays, ...(preset === null ? [] : [preset])];
  for (const source of sources) {
    if (!source || typeof source !== "object" || Array.isArray(source)) throw new Error("composed profile source must be an object");
    if (hasRemovalDirective(source)) throw new Error(`Removal directive is not allowed in ${String(source.profile_id ?? "profile source")}`);
  }
  assertUniqueAcceptanceCriteria(primary, primary.profile_id ?? "primary");
  for (const source of sources) assertUniqueAcceptanceCriteria(source, source.profile_id ?? "anonymous");

  const primaryValidation = validateQualityProfile(primary, { sourceName: "primary quality profile" });
  if (!primaryValidation.ok) throw new Error(`Invalid primary quality profile: ${validationDetails(primaryValidation)}`);

  let profile = clone(primary);
  let conflicts = [];
  for (const source of sources) {
    const additions = Object.fromEntries(Object.entries(source).filter(([key]) => key !== "profile_id" && key !== "version"));
    const sourceName = source.profile_id ?? "anonymous";
    const candidate = clone(profile);
    const candidateConflicts = clone(conflicts);
    mergeObject(candidate, additions, "", sourceName, candidateConflicts);
    const candidateValidation = validateQualityProfile(candidate, { sourceName: `composed quality profile after ${sourceName}` });
    if (!candidateValidation.ok) {
      throw new Error(`Invalid composed quality profile after ${sourceName}: ${validationDetails(candidateValidation)}`);
    }
    profile = candidate;
    conflicts = candidateConflicts;
  }
  const baseResult = {
    profile,
    provenance: {
      primary: primary.profile_id,
      overlays: overlays.map(({ profile_id }) => profile_id),
      preset: preset?.profile_id ?? null,
    },
    conflicts,
  };
  if (referencePreset === null) return deepFreeze(baseResult);

  const guidance = adaptReferencePreset(referencePreset);
  const normalizedReferenceCriteria = new Set();
  for (const criterion of guidance.additionalAcceptanceCriteria) {
    const normalized = normalizeText(criterion);
    if (normalizedReferenceCriteria.has(normalized)) {
      throw new Error(`Duplicate normalized acceptance criterion in ${guidance.presetId}`);
    }
    normalizedReferenceCriteria.add(normalized);
  }
  const acceptanceCriterionSources = [];
  const seenCriteria = new Set();
  for (const source of [primary, ...sources]) {
    for (const criterion of source.acceptance_criteria ?? []) {
      const normalized = normalizeText(criterion);
      if (!seenCriteria.has(normalized)) {
        acceptanceCriterionSources.push({ sourceId: source.profile_id, text: criterion });
        seenCriteria.add(normalized);
      }
    }
  }
  for (const criterion of guidance.additionalAcceptanceCriteria) {
    const normalized = normalizeText(criterion);
    if (!seenCriteria.has(normalized)) {
      acceptanceCriterionSources.push({ sourceId: guidance.presetId, text: criterion });
      seenCriteria.add(normalized);
    }
  }
  return deepFreeze({
    ...baseResult,
    guidance,
    acceptanceCriterionSources,
    referencePresetProvenance: { preset: guidance.presetId },
  });
}

function compatibleProfile(profile, artifactType, requestedFormat) {
  return profile.artifact_types.map(normalizeId).includes(artifactType)
    && !profile.forbidden_formats.map(normalizeId).includes(requestedFormat)
    && profile.required_formats.map(normalizeId).includes(requestedFormat);
}

function scoreProfile(profile, request, mappedProfileId) {
  const profileTokens = tokenUnion([profile.profile_id, ...profile.artifact_types, ...profile.audiences]);
  const goalTokens = textTokens(request.goal);
  const audienceTokens = tokenUnion(request.audience);
  const profileAudienceTokens = tokenUnion(profile.audiences);
  return {
    templateMatch: profile.profile_id === mappedProfileId ? 1 : 0,
    artifactTypeMatch: profile.artifact_types.map(normalizeId).includes(request.artifactType) ? 1 : 0,
    formatMatch: profile.required_formats.map(normalizeId).includes(request.requestedFormat) ? 1 : 0,
    audienceOverlap: overlapCount(audienceTokens, profileAudienceTokens),
    goalOverlap: overlapCount(goalTokens, profileTokens),
  };
}

function compareCandidates(left, right) {
  for (const key of scoreKeys) {
    if (left.score[key] !== right.score[key]) return right.score[key] - left.score[key];
  }
  return left.profile.profile_id.localeCompare(right.profile.profile_id, "en-US");
}

function renderContractId(profile, requestedFormat) {
  if (requestedFormat === "pptx" || profile.artifact_types.includes("presentation")) return "presentation";
  if (profile.artifact_types.includes("review-report")) return "review-report";
  return "long-form-document";
}

function differenceRecord(profile, request) {
  return {
    artifactType: profile.artifact_types.includes(request.artifactType) ? [] : [request.artifactType, ...profile.artifact_types],
    requestedFormat: profile.required_formats.includes(request.requestedFormat) ? [] : [request.requestedFormat, ...profile.required_formats],
    audience: [...request.audience].filter((audience) => !profile.audiences.includes(audience)),
  };
}

export function validateQualitySelectionIndex(value) {
  const errors = [];
  const add = (pathValue, message) => errors.push({ path: pathValue, message });
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) {
    return { ok: false, errors: [{ path: "", message: "Selection index must be a plain object." }] };
  }
  try { exactKeys(value, selectionIndexKeys, "selection index"); } catch (error) { add("", error.message); }
  if (value.schema_version !== 1) add("/schema_version", "Selection index schema_version must be 1.");
  if (!["studio", "career"].includes(value.namespace)) add("/namespace", "Selection index namespace is unknown.");
  if (!Array.isArray(value.profiles) || value.profiles.length === 0) add("/profiles", "Selection index profiles must be non-empty.");
  const ids = new Set();
  for (const [index, entry] of (Array.isArray(value.profiles) ? value.profiles : []).entries()) {
    try { exactKeys(entry, selectionEntryKeys, `selection index profile ${index}`); } catch (error) { add(`/profiles/${index}`, error.message); continue; }
    try {
      if (normalizeId(entry.profile_id) !== entry.profile_id) add(`/profiles/${index}/profile_id`, "Selection index profile ID must already be normalized.");
    } catch (error) { add(`/profiles/${index}/profile_id`, error.message); }
    if (ids.has(entry.profile_id)) add(`/profiles/${index}/profile_id`, "Selection index profile ID is duplicated.");
    ids.add(entry.profile_id);
    for (const key of ["artifact_types", "audiences", "required_formats", "forbidden_formats"]) {
      if (!Array.isArray(entry[key]) || (key !== "forbidden_formats" && entry[key].length === 0)) {
        add(`/profiles/${index}/${key}`, `${key} must be an array with the required cardinality.`);
        continue;
      }
      const normalized = [];
      for (const item of entry[key]) {
        try {
          const normalizedItem = normalizeId(item);
          normalized.push(normalizedItem);
          if (normalizedItem !== item) add(`/profiles/${index}/${key}`, `${key} values must already be normalized.`);
        } catch (error) { add(`/profiles/${index}/${key}`, error.message); }
      }
      if (new Set(normalized).size !== normalized.length) add(`/profiles/${index}/${key}`, `${key} contains duplicates.`);
    }
  }
  const anchor = trustedIndexAnchors[value.namespace];
  if (anchor && Array.isArray(value.profiles)) {
    const profileIds = value.profiles.map((entry) => entry && typeof entry === "object" && !Array.isArray(entry) ? entry.profile_id : null);
    if (value.profiles.length !== anchor.count) add("/profiles", `Canonical ${value.namespace} selection index count mismatch.`);
    if (JSON.stringify(profileIds) !== JSON.stringify(anchor.ids)) {
      add("/profiles", `Canonical ${value.namespace} selection index profile order or namespace ID set mismatch.`);
    }
    if (indexDigest(value) !== anchor.digest) add("", `Canonical ${value.namespace} selection index digest mismatch.`);
  }
  return { ok: errors.length === 0, errors };
}

function completeSelectionRecord(request, values) {
  return {
    ...request,
    overlayIds: request.overlayIds,
    presetId: request.presetId,
    tieBreak: [...scoreKeys, "profileIdLexical"],
    ...values,
  };
}

export function selectQualityProfiles({ selectionIndex, templateMap, requests, profiles }) {
  if (profiles !== undefined || selectionIndex === undefined) throw new Error("Selection requires a closed selection index; profile body preload is forbidden");
  const indexValidation = validateQualitySelectionIndex(selectionIndex);
  if (!indexValidation.ok) throw new Error(`Invalid selection index: ${indexValidation.errors.map(({ path: errorPath, message }) => `${errorPath || "/"} ${message}`).join("; ")}`);
  if (!Array.isArray(requests) || requests.length === 0) throw new Error("requests must be a non-empty array");
  const indexProfiles = selectionIndex.profiles;
  const byId = new Map();
  for (const profile of indexProfiles) byId.set(profile.profile_id, profile);
  return requests.map((rawRequest) => {
    assertPlainObject(rawRequest, "request");
    const request = {
      artifactId: normalizeId(rawRequest.artifactId),
      goal: normalizeText(rawRequest.goal),
      audience: (Array.isArray(rawRequest.audience) ? rawRequest.audience : [rawRequest.audience]).map(normalizeId),
      artifactType: normalizeId(rawRequest.artifactType),
      requestedFormat: normalizeId(rawRequest.requestedFormat),
      templateId: rawRequest.templateId === undefined ? null : normalizeId(rawRequest.templateId),
      overlayIds: (rawRequest.overlayIds ?? []).map(normalizeId),
      presetId: rawRequest.presetId === undefined || rawRequest.presetId === null ? null : normalizeId(rawRequest.presetId),
    };
    const explicitId = rawRequest.explicitPrimaryId === undefined ? null : normalizeId(rawRequest.explicitPrimaryId);
    const fallbackId = rawRequest.fallbackPrimaryId === undefined ? null : normalizeId(rawRequest.fallbackPrimaryId);
    if (fallbackId !== null && explicitId === null) throw new Error("Fallback is allowed only after an unknown explicit override");
    if (fallbackId !== null && byId.has(explicitId)) throw new Error("Fallback is allowed only after an unknown explicit override");
    if (explicitId !== null && !byId.has(explicitId)) {
      const nearestProfile = [...indexProfiles]
        .map((profile) => ({ profile, distance: levenshtein(explicitId, profile.profile_id) }))
        .sort((left, right) => left.distance - right.distance || left.profile.profile_id.localeCompare(right.profile.profile_id, "en-US"))[0].profile;
      if (fallbackId === null) {
        return deepFreeze(completeSelectionRecord(request, {
          status: "fallback-required",
          primaryProfileId: null,
          renderContractId: null,
          selectionReason: "unknown-explicit-override",
          score: null,
          fallbackRecord: {
            requestedProfileId: explicitId,
            nearestProfileId: nearestProfile.profile_id,
            differences: differenceRecord(nearestProfile, request),
          },
        }));
      }
      const fallback = byId.get(fallbackId);
      if (!fallback) throw new Error(`Unknown fallback profile: ${fallbackId}`);
      if (!compatibleProfile(fallback, request.artifactType, request.requestedFormat)) {
        throw new Error(`Fallback profile ${fallbackId} is incompatible with the artifact type or requested format`);
      }
      return deepFreeze(completeSelectionRecord(request, {
        status: "selected",
        primaryProfileId: fallback.profile_id,
        score: scoreProfile(fallback, request, null),
        renderContractId: renderContractId(fallback, request.requestedFormat),
        selectionReason: "explicit-fallback-after-unknown-override",
        fallbackRecord: {
          requestedProfileId: explicitId,
          nearestProfileId: nearestProfile.profile_id,
          differences: differenceRecord(nearestProfile, request),
          selectedFallbackProfileId: fallbackId,
        },
      }));
    }
    if (explicitId !== null) {
      const selected = byId.get(explicitId);
      if (!compatibleProfile(selected, request.artifactType, request.requestedFormat)) {
        throw new Error(`Explicit profile ${explicitId} is incompatible with the artifact type or requested format`);
      }
      return deepFreeze(completeSelectionRecord(request, {
        status: "selected",
        primaryProfileId: selected.profile_id,
        score: scoreProfile(selected, request, null),
        renderContractId: renderContractId(selected, request.requestedFormat),
        selectionReason: "known-explicit-override",
        fallbackRecord: null,
      }));
    }
    const mappedProfileId = request.templateId === null ? null : templateMap?.templates?.[request.templateId] ?? null;
    const candidates = indexProfiles
      .filter((profile) => compatibleProfile(profile, request.artifactType, request.requestedFormat))
      .map((profile) => ({ profile, score: scoreProfile(profile, request, mappedProfileId) }))
      .sort(compareCandidates);
    if (candidates.length === 0) throw new Error(`No compatible quality profile for ${request.artifactId}`);
    const [{ profile: selected, score }] = candidates;
    return deepFreeze(completeSelectionRecord(request, {
      status: "selected",
      primaryProfileId: selected.profile_id,
      score,
      renderContractId: renderContractId(selected, request.requestedFormat),
      selectionReason: mappedProfileId === selected.profile_id ? "compatible-template-map-match" : "ranked-compatible-candidate",
      fallbackRecord: null,
    }));
  });
}

function indexEntryMatchesProfile(entry, profile) {
  return profile.profile_id === entry.profile_id
    && JSON.stringify(profile.artifact_types) === JSON.stringify(entry.artifact_types)
    && JSON.stringify(profile.audiences) === JSON.stringify(entry.audiences)
    && JSON.stringify(profile.export_rules.required_formats) === JSON.stringify(entry.required_formats)
    && JSON.stringify(profile.export_rules.forbidden_formats) === JSON.stringify(entry.forbidden_formats);
}

async function loadIndexedBody({ selectionIndex, namespace, profileId, purpose, profileLoader }) {
  const entry = selectionIndex.profiles.find((candidate) => candidate.profile_id === profileId);
  if (!entry) throw new Error(`Unknown indexed profile: ${profileId}`);
  const profile = await profileLoader({ namespace, profileId, purpose });
  const validation = validateQualityProfile(profile, { sourceName: `${purpose} profile` });
  if (!validation.ok) throw new Error(`Invalid ${purpose} profile: ${validationDetails(validation)}`);
  if (!indexEntryMatchesProfile(entry, profile)) throw new Error(`Selection index drift for ${profileId}`);
  return profile;
}

function normalizeClosedSourceIds(overlayIds, presetId) {
  if (!Array.isArray(overlayIds)) throw new Error("overlayIds must be an array");
  const normalizedOverlayIds = overlayIds.map((overlayId) => {
    const normalized = normalizeId(overlayId);
    if (normalized !== overlayId) throw new Error("Overlay ID must already be normalized");
    if (!knownOverlayIds.has(normalized)) throw new Error(`Unknown overlay: ${normalized}`);
    return normalized;
  });
  if (new Set(normalizedOverlayIds).size !== normalizedOverlayIds.length) throw new Error("Duplicate overlay ID");
  if (presetId === null || presetId === undefined) return { overlayIds: normalizedOverlayIds, presetId: null };
  const normalizedPresetId = normalizeId(presetId);
  if (normalizedPresetId !== presetId) throw new Error("Preset ID must already be normalized");
  if (!knownPresetIds.has(normalizedPresetId)) throw new Error(`Unknown preset: ${normalizedPresetId}`);
  return { overlayIds: normalizedOverlayIds, presetId: normalizedPresetId };
}

async function loadClosedSource({ sourceLoader, sourceType, sourceId }) {
  if (typeof sourceLoader !== "function") throw new Error("A safe sourceLoader or pluginRoot is required for requested overlays and presets");
  const body = await sourceLoader({ sourceType, sourceId, purpose: `selected-${sourceType}` });
  assertPlainObject(body, `${sourceType} body`);
  const identityKey = sourceType === "overlay" ? "profile_id" : "preset_id";
  if (body[identityKey] !== sourceId) throw new Error(`${sourceType} ID mismatch: expected ${sourceId}, received ${String(body[identityKey])}`);
  if (sourceType === "preset") assertValidReferencePreset(body);
  return body;
}

function resolveDocumentQualityRoot({ documentQualityRoot, pluginRoot }) {
  if (documentQualityRoot !== undefined && pluginRoot !== undefined) throw new Error("Use either documentQualityRoot or pluginRoot, not both");
  if (documentQualityRoot !== undefined) return documentQualityRoot;
  if (pluginRoot !== undefined) return path.join(pluginRoot, "references", "shared", "document-quality");
  return undefined;
}

export async function applyDocumentQualityProfile(options) {
  assertPlainObject(options, "document quality application options");
  for (const rawKey of ["overlays", "preset", "referencePreset"]) {
    if (Object.hasOwn(options, rawKey)) throw new Error(`Upper apply rejects raw ${rawKey}; use closed overlayIds and presetId`);
  }
  const {
    namespace, selectionIndex, templateMap, profileLoader, sourceLoader, documentQualityRoot, pluginRoot, request,
    overlayIds = [], presetId = null,
  } = options;
  const qualityRoot = resolveDocumentQualityRoot({ documentQualityRoot, pluginRoot });
  const effectiveLoader = profileLoader ?? createQualityProfileBodyLoader({ documentQualityRoot: qualityRoot });
  if (typeof effectiveLoader !== "function") throw new Error("profileLoader must be a function");
  if (selectionIndex?.namespace !== namespace) throw new Error("Selection index namespace mismatch");
  const sources = normalizeClosedSourceIds(overlayIds, presetId);
  const effectiveSourceLoader = sourceLoader ?? (qualityRoot === undefined ? null : createQualitySourceLoader({ documentQualityRoot: qualityRoot }));
  const [selection] = selectQualityProfiles({
    selectionIndex,
    templateMap,
    requests: [{ ...request, overlayIds: sources.overlayIds, presetId: sources.presetId }],
  });
  if (selection.fallbackRecord?.nearestProfileId) {
    await loadIndexedBody({ selectionIndex, namespace, profileId: selection.fallbackRecord.nearestProfileId, purpose: "nearest-comparison", profileLoader: effectiveLoader });
  }
  if (selection.status !== "selected") return deepFreeze({ selection, composed: null, checklist: null, requirementManifest: null });
  const primary = await loadIndexedBody({ selectionIndex, namespace, profileId: selection.primaryProfileId, purpose: "selected-primary", profileLoader: effectiveLoader });
  const loadedOverlays = [];
  for (const overlayId of sources.overlayIds) {
    loadedOverlays.push(await loadClosedSource({ sourceLoader: effectiveSourceLoader, sourceType: "overlay", sourceId: overlayId }));
  }
  const referencePreset = sources.presetId === null
    ? null
    : await loadClosedSource({ sourceLoader: effectiveSourceLoader, sourceType: "preset", sourceId: sources.presetId });
  const composed = composeQualityProfile({ primary, overlays: loadedOverlays, referencePreset });
  if (composed.conflicts.length > 0) {
    throw new Error(`Document-quality composition conflict: ${composed.conflicts.map(({ path: conflictPath }) => conflictPath).join(", ")}`);
  }
  const checklist = buildQualityChecklist(composed);
  const requirementManifest = buildRequirementManifest(composed, checklist);
  return deepFreeze({ selection, composed, checklist, requirementManifest });
}

function derivedId(sourceId, kind, text) {
  const normalized = normalizeText(text);
  const digest = createHash("sha256").update(normalized, "utf8").digest("hex").slice(0, 16);
  return `${normalizeId(sourceId)}-${kind}-${digest}`;
}

function requiredItems(values) {
  return values.map((value) => ({ ...clone(value), required: true, status: "missing" }));
}

export function buildQualityChecklist(composed) {
  assertPlainObject(composed, "composed profile result");
  const profile = composed.profile;
  const diagrams = requiredItems(profile.required_diagrams);
  for (const suggestion of composed.guidance?.recommendedDiagrams ?? []) {
    diagrams.push({
      id: derivedId(composed.guidance.presetId, "diagram", suggestion),
      source_id: composed.guidance.presetId,
      purpose: suggestion,
      required: false,
      status: "suggested",
    });
  }
  const criterionSources = composed.acceptanceCriterionSources ?? profile.acceptance_criteria.map((text) => ({
    sourceId: composed.provenance.primary,
    text,
  }));
  const checklist = {
    sections: requiredItems(profile.required_sections),
    tables: requiredItems(profile.required_tables),
    diagrams,
    images: requiredItems(profile.required_images),
    acceptanceCriteria: criterionSources.map(({ sourceId, text }) => ({
      id: derivedId(sourceId, "acceptance", text), source_id: sourceId, text, required: true, status: "missing",
    })),
  };
  const ids = Object.values(checklist).flat().map(({ id }) => id);
  if (new Set(ids).size !== ids.length) throw new Error("Duplicate checklist ID after normalized stable-ID generation");
  return deepFreeze(checklist);
}

function buildRequirementManifest(composed, suppliedChecklist = buildQualityChecklist(composed)) {
  const itemIds = Object.values(suppliedChecklist).flat()
    .filter(({ required }) => required === true)
    .map(({ id }) => id)
    .sort((left, right) => left.localeCompare(right, "en-US"));
  return deepFreeze({
    schemaVersion: 1,
    contractDigest: digestValue(composed),
    checklistDigest: digestValue(suppliedChecklist),
    requiredItemIds: itemIds,
  });
}

function validateRequirementManifest(manifest) {
  exactKeys(manifest, ["schemaVersion", "contractDigest", "checklistDigest", "requiredItemIds"], "requirement manifest");
  if (manifest.schemaVersion !== 1) throw new Error("Requirement manifest schemaVersion must be 1");
  assertDigest(manifest.contractDigest, "requirement manifest contractDigest");
  assertDigest(manifest.checklistDigest, "requirement manifest checklistDigest");
  if (!Array.isArray(manifest.requiredItemIds) || manifest.requiredItemIds.length === 0) {
    throw new Error("Requirement manifest requiredItemIds must be non-empty");
  }
  for (const itemId of manifest.requiredItemIds) {
    if (normalizeId(itemId) !== itemId) throw new Error("Requirement manifest item ID must already be normalized");
  }
  if (new Set(manifest.requiredItemIds).size !== manifest.requiredItemIds.length) throw new Error("Requirement manifest item IDs contain a duplicate");
  const sorted = [...manifest.requiredItemIds].sort((left, right) => left.localeCompare(right, "en-US"));
  if (JSON.stringify(sorted) !== JSON.stringify(manifest.requiredItemIds)) throw new Error("Requirement manifest item IDs must be canonical ordered");
}

function unsignedReceipt(record) {
  const unsigned = clone(record);
  delete unsigned.receiptDigest;
  return unsigned;
}

function validateReceiptDigest(record, label) {
  assertDigest(record.receiptDigest, `${label} receiptDigest`);
  if (record.receiptDigest !== digestValue(unsignedReceipt(record))) throw new Error(`${label} receipt digest mismatch`);
}

function validateInspectionReceipt(requirementManifest, receipt) {
  exactKeys(receipt, [
    "schemaVersion", "artifactDigest", "contractDigest", "checklistDigest", "observations", "verifierIdentity", "receiptDigest",
  ], "artifact inspection receipt");
  if (receipt.schemaVersion !== 1) throw new Error("Artifact inspection receipt schemaVersion must be 1");
  for (const key of ["artifactDigest", "contractDigest", "checklistDigest"]) assertDigest(receipt[key], `artifact inspection ${key}`);
  assertText(receipt.verifierIdentity, "artifact inspection verifierIdentity");
  if (receipt.contractDigest !== requirementManifest.contractDigest || receipt.checklistDigest !== requirementManifest.checklistDigest) {
    throw new Error("Artifact inspection receipt manifest digest mismatch");
  }
  if (!Array.isArray(receipt.observations)) throw new Error("Artifact inspection observations must be an array");
  const observedIds = receipt.observations.map((observation, index) => {
    exactKeys(observation, ["itemId", "observed", "passed"], `artifact inspection observation ${index}`);
    if (normalizeId(observation.itemId) !== observation.itemId) throw new Error("Artifact inspection observation item ID must already be normalized");
    if (observation.observed !== true || observation.passed !== true) throw new Error("Every required item must be observed and passed");
    return observation.itemId;
  });
  if (new Set(observedIds).size !== observedIds.length) throw new Error("Artifact inspection observations contain a duplicate");
  if (JSON.stringify(observedIds) !== JSON.stringify(requirementManifest.requiredItemIds)) {
    throw new Error("Artifact inspection observations have missing, replaced, or reordered IDs");
  }
  validateReceiptDigest(receipt, "artifact inspection receipt");
}

export function createStructuralCompletionEvidence({ requirementManifest, inspectionReceipt } = {}) {
  validateRequirementManifest(requirementManifest);
  validateInspectionReceipt(requirementManifest, inspectionReceipt);
  return deepFreeze({
    schemaVersion: 1,
    artifactDigest: inspectionReceipt.artifactDigest,
    contractDigest: requirementManifest.contractDigest,
    checklistDigest: requirementManifest.checklistDigest,
    inspectionReceipt: clone(inspectionReceipt),
  });
}

export function verifyStructuralCompletionEvidence(requirementManifest, evidence) {
  validateRequirementManifest(requirementManifest);
  exactKeys(evidence, [
    "schemaVersion", "artifactDigest", "contractDigest", "checklistDigest", "inspectionReceipt",
  ], "structural completion receipt");
  if (evidence.schemaVersion !== 1) throw new Error("Structural completion receipt schemaVersion must be 1");
  for (const key of ["artifactDigest", "contractDigest", "checklistDigest"]) {
    assertDigest(evidence[key], `structural completion ${key}`);
  }
  if (evidence.contractDigest !== requirementManifest.contractDigest || evidence.checklistDigest !== requirementManifest.checklistDigest) {
    throw new Error("Structural completion receipt manifest digest mismatch");
  }
  validateInspectionReceipt(requirementManifest, evidence.inspectionReceipt);
  if (evidence.artifactDigest !== evidence.inspectionReceipt.artifactDigest) {
    throw new Error("Structural completion receipt artifact digest mismatch");
  }
  return deepFreeze({ ready: true, missingIds: [] });
}

export function evaluateStructuralCompleteness(requirementManifest, structuralReceipt) {
  return verifyStructuralCompletionEvidence(requirementManifest, structuralReceipt);
}

function assertText(value, label) {
  if (typeof value !== "string" || value.trim() === "" || value !== value.normalize("NFC")) {
    throw new Error(`${label} must be non-empty Unicode NFC text`);
  }
}

function assertDigest(value, label) {
  if (typeof value !== "string" || !digestPattern.test(value)) throw new Error(`${label} must be a SHA-256 digest`);
}

function assertStringList(value, label) {
  if (!Array.isArray(value) || value.length === 0) throw new Error(`${label} must be a non-empty array`);
  for (const item of value) assertText(item, label);
  if (new Set(value).size !== value.length) throw new Error(`${label} must be unique`);
}

function assertReceiptBinding(record, expected, label) {
  for (const key of ["artifactDigest", "contractDigest", "checklistDigest"]) {
    assertDigest(record[key], `${label} ${key}`);
    if (record[key] !== expected[key]) throw new Error(`${label} must bind to the same artifact and manifest digests`);
  }
}

function validateEvidenceReview(record, expected) {
  exactKeys(record, [
    "schemaVersion", "reviewerRole", "verifierIdentity", "status", "evidenceIds",
    "artifactDigest", "contractDigest", "checklistDigest", "receiptDigest",
  ], "evidence review receipt");
  if (record.schemaVersion !== 1 || record.reviewerRole !== "evidence-auditor" || record.status !== "verified") {
    throw new Error("Evidence review receipt is not verified by evidence-auditor");
  }
  assertText(record.verifierIdentity, "evidence review verifierIdentity");
  assertStringList(record.evidenceIds, "evidence review evidenceIds");
  assertReceiptBinding(record, expected, "evidence review receipt");
  validateReceiptDigest(record, "evidence review receipt");
}

function validateVisualReview(composed, record, expected) {
  exactKeys(record, [
    "schemaVersion", "reviewerRole", "verifierIdentity", "rendererStatus", "qaStatus",
    "artifactDigest", "contractDigest", "checklistDigest", "skillsteadSlots", "receiptDigest",
  ], "visual review receipt");
  if (record.schemaVersion !== 1 || record.reviewerRole !== "renderer-qa" || record.rendererStatus !== "passed" || record.qaStatus !== "passed") {
    throw new Error("Visual review receipt requires passed renderer QA");
  }
  assertText(record.verifierIdentity, "visual review verifierIdentity");
  assertReceiptBinding(record, expected, "visual review receipt");
  if (!Array.isArray(record.skillsteadSlots)) throw new Error("Visual review Skillstead slots must be an array");
  const slots = record.skillsteadSlots.map((slot, index) => {
    exactKeys(slot, ["slotId", "artifactDigest", "verifierIdentity", "receiptDigest"], `visual review Skillstead slot receipt ${index}`);
    normalizeId(slot.slotId);
    assertText(slot.verifierIdentity, `visual review Skillstead slot ${index} verifierIdentity`);
    assertDigest(slot.artifactDigest, `visual review Skillstead slot ${index} artifactDigest`);
    if (slot.artifactDigest !== expected.artifactDigest) throw new Error("Skillstead slot receipt must bind to the same artifact digest");
    validateReceiptDigest(slot, `visual review Skillstead slot ${index}`);
    return slot.slotId;
  });
  if (new Set(slots).size !== slots.length) throw new Error("Visual review Skillstead slots contain duplicates");
  const expectedSlotIds = composed.profile.required_diagrams.map(({ id }) => id).sort((left, right) => left.localeCompare(right, "en-US"));
  if (JSON.stringify([...slots].sort((left, right) => left.localeCompare(right, "en-US"))) !== JSON.stringify(expectedSlotIds)) {
    throw new Error("Visual review must verify every Skillstead slot");
  }
  validateReceiptDigest(record, "visual review receipt");
}

function assertDate(value, label) {
  const [year, month, day] = typeof value === "string" ? value.split("-").map(Number) : [];
  const canonical = Number.isInteger(year) && Number.isInteger(month) && Number.isInteger(day)
    ? new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10)
    : "";
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(value) || canonical !== value) {
    throw new Error(`${label} must be a valid ISO date`);
  }
}

function validateDocumentApproval(record, expected) {
  exactKeys(record, [
    "schemaVersion", "artifactDigest", "contractDigest", "checklistDigest", "rightsApproval",
    "responsibleGates", "humanApprovalReceipt", "receiptDigest",
  ], "document approval receipt");
  if (record.schemaVersion !== 1) throw new Error("Document approval schemaVersion must be 1");
  assertReceiptBinding(record, expected, "document approval receipt");
  exactKeys(record.rightsApproval, [
    "source_provenance", "rights_or_consent_record", "human_approver", "approval_date", "artifactDigest", "receiptDigest",
  ], "rights approval receipt");
  for (const key of ["source_provenance", "rights_or_consent_record", "human_approver"]) assertText(record.rightsApproval[key], `rights approval ${key}`);
  assertDate(record.rightsApproval.approval_date, "rights approval approval_date");
  assertDigest(record.rightsApproval.artifactDigest, "rights approval artifactDigest");
  if (record.rightsApproval.artifactDigest !== expected.artifactDigest) throw new Error("Rights approval must bind to the same artifact digest");
  validateReceiptDigest(record.rightsApproval, "rights approval receipt");
  if (!Array.isArray(record.responsibleGates) || record.responsibleGates.length === 0) throw new Error("Responsible gates must be non-empty");
  const gateIds = new Set();
  for (const [index, gate] of record.responsibleGates.entries()) {
    exactKeys(gate, ["gateId", "state", "evidenceIds", "human_approver", "artifactDigest", "receiptDigest"], `responsible gate ${index}`);
    normalizeId(gate.gateId);
    if (!responsibleGateIds.has(gate.gateId)) throw new Error("Responsible gate ID is not in the canonical registry");
    if (!["approved", "not-applicable"].includes(gate.state)) throw new Error("Responsible gate is not approved or not-applicable");
    assertStringList(gate.evidenceIds, `responsible gate ${index} evidenceIds`);
    assertText(gate.human_approver, `responsible gate ${index} human_approver`);
    assertDigest(gate.artifactDigest, `responsible gate ${index} artifactDigest`);
    if (gate.artifactDigest !== expected.artifactDigest) throw new Error("Responsible gate must bind to the same artifact digest");
    validateReceiptDigest(gate, `responsible gate ${index}`);
    if (gateIds.has(gate.gateId)) throw new Error("Responsible gate is duplicated");
    gateIds.add(gate.gateId);
  }
  if (gateIds.size !== responsibleGateIds.size || [...responsibleGateIds].some((gateId) => !gateIds.has(gateId))) {
    throw new Error("Document approval must record every canonical responsible gate");
  }
  exactKeys(record.humanApprovalReceipt, ["human_approver", "approval_date", "artifactDigest", "receiptDigest"], "human approval receipt");
  assertText(record.humanApprovalReceipt.human_approver, "human approval receipt human_approver");
  assertDate(record.humanApprovalReceipt.approval_date, "human approval receipt approval_date");
  assertDigest(record.humanApprovalReceipt.artifactDigest, "human approval receipt artifactDigest");
  if (record.humanApprovalReceipt.artifactDigest !== expected.artifactDigest) throw new Error("Human approval must bind to the same artifact digest");
  validateReceiptDigest(record.humanApprovalReceipt, "human approval receipt");
  validateReceiptDigest(record, "document approval receipt");
}

function validateStateEnvelope(stateEnvelope, requirementManifest, composed) {
  validateRequirementManifest(requirementManifest);
  exactKeys(stateEnvelope, ["schemaVersion", "state", "artifactDigest", "contractDigest", "checklistDigest", "receipts"], "document quality state envelope");
  if (stateEnvelope.schemaVersion !== 1) throw new Error("State envelope schemaVersion must be 1");
  const currentIndex = documentStates.indexOf(stateEnvelope.state);
  if (currentIndex < 0) throw new Error("State envelope state is unknown");
  assertReceiptBinding(stateEnvelope, {
    artifactDigest: stateEnvelope.artifactDigest,
    contractDigest: requirementManifest.contractDigest,
    checklistDigest: requirementManifest.checklistDigest,
  }, "state envelope");
  if (composed !== undefined && digestValue(composed) !== requirementManifest.contractDigest) {
    throw new Error("State envelope composed contract digest mismatch");
  }
  if (!Array.isArray(stateEnvelope.receipts) || stateEnvelope.receipts.length !== currentIndex) {
    throw new Error("State envelope receipt chain length does not match state");
  }
  const expected = stateEnvelope;
  const expectedStages = documentStates.slice(1, currentIndex + 1);
  for (const [index, wrapper] of stateEnvelope.receipts.entries()) {
    exactKeys(wrapper, ["stage", "record"], `state envelope receipt ${index}`);
    if (wrapper.stage !== expectedStages[index]) throw new Error("State envelope receipts are not in canonical ordered stages");
    if (wrapper.stage === "structurally-complete") {
      verifyStructuralCompletionEvidence(requirementManifest, wrapper.record);
      if (wrapper.record.artifactDigest !== expected.artifactDigest) throw new Error("Structural receipt must bind to the same artifact digest");
    } else if (wrapper.stage === "evidence-reviewed") {
      validateEvidenceReview(wrapper.record, expected);
    } else if (wrapper.stage === "visual-reviewed") {
      if (composed === undefined) throw new Error("Composed contract is required to revalidate visual receipts");
      validateVisualReview(composed, wrapper.record, expected);
    } else if (wrapper.stage === "document-approved") {
      validateDocumentApproval(wrapper.record, expected);
    }
  }
  return currentIndex;
}

export function createDocumentQualityStateEnvelope({ artifactDigest, requirementManifest } = {}) {
  validateRequirementManifest(requirementManifest);
  assertDigest(artifactDigest, "state envelope artifactDigest");
  return deepFreeze({
    schemaVersion: 1,
    state: "draft",
    artifactDigest,
    contractDigest: requirementManifest.contractDigest,
    checklistDigest: requirementManifest.checklistDigest,
    receipts: [],
  });
}

export function transitionDocumentQualityState(options) {
  assertPlainObject(options, "document quality transition options");
  if (Object.hasOwn(options, "currentState")) throw new Error("currentState strings are forbidden; provide a state envelope");
  const {
    stateEnvelope, targetState, requirementManifest, composed, structuralReceipt, evidenceReview, visualReview, documentApproval,
  } = options;
  const currentIndex = validateStateEnvelope(stateEnvelope, requirementManifest, composed);
  const targetIndex = documentStates.indexOf(targetState);
  if (currentIndex < 0 || targetIndex !== currentIndex + 1) throw new Error("target must be the exact next state");
  let record;
  if (targetState === "structurally-complete") {
    verifyStructuralCompletionEvidence(requirementManifest, structuralReceipt);
    if (structuralReceipt.artifactDigest !== stateEnvelope.artifactDigest) throw new Error("Structural receipt must bind to the same artifact digest");
    record = structuralReceipt;
  } else if (targetState === "evidence-reviewed") {
    validateEvidenceReview(evidenceReview, stateEnvelope);
    record = evidenceReview;
  } else if (targetState === "visual-reviewed") {
    if (composed === undefined) throw new Error("Composed contract is required for visual review");
    validateVisualReview(composed, visualReview, stateEnvelope);
    record = visualReview;
  } else if (targetState === "document-approved") {
    validateDocumentApproval(documentApproval, stateEnvelope);
    record = documentApproval;
  }
  return deepFreeze({
    ...clone(stateEnvelope),
    state: targetState,
    receipts: [...clone(stateEnvelope.receipts), { stage: targetState, record: clone(record) }],
  });
}

export function selectBoundedReviewRoles({
  candidateRoles, requiredRoles = [], rolePriority, qualityEditorRole, maxReviewers = 3,
}) {
  if (!Array.isArray(candidateRoles) || !Array.isArray(requiredRoles) || !Array.isArray(rolePriority)) {
    throw new Error("review roles must be arrays");
  }
  if (!rolePriority.includes(qualityEditorRole)) throw new Error("quality editor is absent from role priority");
  for (const role of requiredRoles) {
    if (!candidateRoles.includes(role)) throw new Error(`required role is absent from candidates: ${role}`);
  }
  const domainLimit = maxReviewers - 1;
  if (requiredRoles.length > domainLimit) throw new Error("required domain roles exceed the total reviewer limit");
  const selectedDomain = [...new Set(requiredRoles)];
  for (const role of rolePriority) {
    if (role === qualityEditorRole || selectedDomain.includes(role) || !candidateRoles.includes(role)) continue;
    if (selectedDomain.length < domainLimit) selectedDomain.push(role);
  }
  selectedDomain.sort((left, right) => {
    const leftIndex = rolePriority.indexOf(left);
    const rightIndex = rolePriority.indexOf(right);
    return leftIndex - rightIndex || left.localeCompare(right, "en-US");
  });
  const selected = [...selectedDomain, qualityEditorRole];
  if (selected.length > maxReviewers) throw new Error("reviewer limit exceeded");
  return selected;
}

async function assertSafeFile(root, relativePath) {
  let cursor = path.resolve(root);
  const rootStats = await lstat(cursor);
  if (rootStats.isSymbolicLink() || !rootStats.isDirectory()) throw new Error("plugin root must be a non-symlink directory");
  const parsed = path.parse(cursor);
  let ancestor = parsed.root;
  const rootSegments = path.relative(parsed.root, cursor).split(path.sep);
  for (let index = 0; index < rootSegments.length; index += 1) {
    ancestor = path.join(ancestor, rootSegments[index]);
    if (index > 0 && (await lstat(ancestor)).isSymbolicLink()) throw new Error("plugin root contains a symlink ancestor");
  }
  for (const segment of relativePath.split("/")) {
    cursor = path.join(cursor, segment);
    const stats = await lstat(cursor).catch((error) => {
      if (error.code === "ENOENT") throw new Error(`Missing quality profile: ${relativePath}`);
      throw error;
    });
    if (stats.isSymbolicLink()) throw new Error(`Symlink is not allowed in quality profile path: ${relativePath}`);
  }
  if (!(await lstat(cursor)).isFile()) throw new Error(`Quality profile is not a file: ${relativePath}`);
  return cursor;
}

export function createQualityProfileBodyLoader({ documentQualityRoot, onLoad } = {}) {
  if (typeof documentQualityRoot !== "string") throw new Error("documentQualityRoot must be a path");
  if (onLoad !== undefined && typeof onLoad !== "function") throw new Error("onLoad must be a function");
  return async ({ namespace, profileId, purpose }) => {
    if (!["studio", "career"].includes(namespace)) throw new Error(`Unknown quality profile namespace: ${String(namespace)}`);
    const normalizedProfileId = normalizeId(profileId);
    if (normalizedProfileId !== profileId) throw new Error("Quality profile ID must already be normalized");
    const relativePath = `profiles/${namespace}/${profileId}.json`;
    const filePath = await assertSafeFile(documentQualityRoot, relativePath);
    onLoad?.({ namespace, profileId, purpose, relativePath });
    let profile;
    try {
      profile = JSON.parse(await readFile(filePath, "utf8"));
    } catch (error) {
      throw new Error(`Invalid quality profile JSON: ${error.message}`, { cause: error });
    }
    const validation = validateQualityProfile(profile, { sourceName: relativePath });
    if (!validation.ok) throw new Error(`Invalid quality profile ${profileId}: ${validationDetails(validation)}`);
    if (profile.profile_id !== profileId) throw new Error(`Quality profile ID mismatch: expected ${profileId}, received ${String(profile.profile_id)}`);
    return deepFreeze(clone(profile));
  };
}

export function createQualitySourceLoader({ documentQualityRoot, onLoad } = {}) {
  if (typeof documentQualityRoot !== "string") throw new Error("documentQualityRoot must be a path");
  if (onLoad !== undefined && typeof onLoad !== "function") throw new Error("onLoad must be a function");
  return async ({ sourceType, sourceId, purpose }) => {
    const registry = sourceType === "overlay" ? knownOverlayIds : sourceType === "preset" ? knownPresetIds : null;
    if (registry === null) throw new Error(`Unknown document-quality source type: ${String(sourceType)}`);
    const normalizedSourceId = normalizeId(sourceId);
    if (normalizedSourceId !== sourceId) throw new Error("Document-quality source ID must already be normalized");
    if (!registry.has(sourceId)) throw new Error(`Unknown ${sourceType}: ${sourceId}`);
    const relativePath = `${sourceType === "overlay" ? "overlays" : "presets"}/${sourceId}.json`;
    const filePath = await assertSafeFile(documentQualityRoot, relativePath);
    onLoad?.({ sourceType, sourceId, purpose, relativePath });
    let body;
    try {
      body = JSON.parse(await readFile(filePath, "utf8"));
    } catch (error) {
      throw new Error(`Invalid document-quality source JSON: ${error.message}`, { cause: error });
    }
    const identityKey = sourceType === "overlay" ? "profile_id" : "preset_id";
    if (body?.[identityKey] !== sourceId) {
      throw new Error(`${sourceType} ID mismatch: expected ${sourceId}, received ${String(body?.[identityKey])}`);
    }
    if (sourceType === "preset") assertValidReferencePreset(body);
    return deepFreeze(clone(body));
  };
}

export async function loadQualityProfile({ pluginRoot, profileId }) {
  if (typeof pluginRoot !== "string") throw new Error("pluginRoot must be a path");
  if (typeof profileId !== "string" || !stableIdPattern.test(profileId)) throw new Error(`Invalid quality profile ID: ${String(profileId)}`);
  const relativePath = `references/quality-profiles/${profileId}.json`;
  const filePath = await assertSafeFile(pluginRoot, relativePath);
  let value;
  try {
    value = JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    throw new Error(`Invalid quality profile JSON: ${error.message}`, { cause: error });
  }
  const validation = validateQualityProfile(value, { sourceName: relativePath });
  if (!validation.ok) {
    throw new Error(`Invalid quality profile ${profileId}: ${validationDetails(validation)}`);
  }
  if (value.profile_id !== profileId) throw new Error(`Quality profile ID mismatch: expected ${profileId}, received ${String(value.profile_id)}`);
  return deepFreeze(clone(value));
}
