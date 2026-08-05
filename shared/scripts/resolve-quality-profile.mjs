import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import path from "node:path";

import { validateQualityProfile } from "./validate-quality-profile.mjs";

const stableIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const removalKeyPattern = /^(?:remove(?:_|$)|.*_removals?$)/u;
const presetIds = new Set([
  "cinematic-narrative", "competitive-live-service", "evolving-world", "function-first",
  "player-validated-small-team", "replayable-coop", "ugc-production-tooling",
]);
const presetKeys = [
  "preset_id", "version", "emphasis", "review_questions", "recommended_diagrams",
  "story_hints", "additional_acceptance_criteria",
];
const presetListKeys = presetKeys.slice(2);
const documentStates = ["draft", "structurally-complete", "evidence-reviewed", "visual-reviewed", "document-approved"];

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

function validatePresetList(value, key) {
  if (!Array.isArray(value) || value.length === 0) throw new Error(`preset.${key} must be a non-empty array`);
  const seen = new Set();
  for (const item of value) {
    if (typeof item !== "string" || item.trim() === "" || item !== item.normalize("NFC")) {
      throw new Error(`preset.${key} must contain non-empty NFC strings`);
    }
    if (seen.has(item)) throw new Error(`preset.${key} contains a duplicate`);
    seen.add(item);
  }
}

export function adaptReferencePreset(preset) {
  assertPlainObject(preset, "preset");
  if (hasRemovalDirective(preset)) throw new Error("Removal directive is not allowed in preset");
  exactKeys(preset, presetKeys, "preset");
  if (!presetIds.has(preset.preset_id)) throw new Error(`Unknown preset: ${String(preset.preset_id)}`);
  if (!Number.isInteger(preset.version) || preset.version < 1) throw new Error("preset.version must be a positive integer");
  for (const key of presetListKeys) validatePresetList(preset[key], key);
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

export function composeQualityProfile({ primary, overlays = [], preset = null }) {
  if (!primary || typeof primary !== "object" || Array.isArray(primary)) throw new Error("primary profile must be an object");
  if (!Array.isArray(overlays)) throw new Error("overlays must be an array");
  const sources = [...overlays];
  for (const source of [...sources, ...(preset === null ? [] : [preset])]) {
    if (!source || typeof source !== "object" || Array.isArray(source)) throw new Error("composed profile source must be an object");
    if (hasRemovalDirective(source)) throw new Error(`Removal directive is not allowed in ${String(source.profile_id ?? "profile source")}`);
  }

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
  const guidance = preset === null ? null : adaptReferencePreset(preset);
  const acceptanceCriterionSources = [];
  const seenCriteria = new Set();
  for (const source of [primary, ...overlays]) {
    for (const criterion of source.acceptance_criteria ?? []) {
      if (!seenCriteria.has(criterion)) {
        acceptanceCriterionSources.push({ sourceId: source.profile_id, text: criterion });
        seenCriteria.add(criterion);
      }
    }
  }
  for (const criterion of guidance?.additionalAcceptanceCriteria ?? []) {
    if (!seenCriteria.has(criterion)) {
      acceptanceCriterionSources.push({ sourceId: guidance.presetId, text: criterion });
      seenCriteria.add(criterion);
    }
  }
  return deepFreeze({
    profile,
    guidance,
    acceptanceCriterionSources,
    provenance: {
      primary: primary.profile_id,
      overlays: overlays.map(({ profile_id }) => profile_id),
      preset: guidance?.presetId ?? null,
    },
    conflicts,
  });
}

function compatibleProfile(profile, artifactType, requestedFormat) {
  return profile.artifact_types.map(normalizeId).includes(artifactType)
    && !profile.export_rules.forbidden_formats?.map(normalizeId).includes(requestedFormat)
    && profile.export_rules.required_formats?.map(normalizeId).includes(requestedFormat);
}

function scoreProfile(profile, request, mappedProfileId) {
  const profileTokens = tokenUnion([profile.profile_id, ...profile.artifact_types, ...profile.audiences]);
  const goalTokens = textTokens(request.goal);
  const audienceTokens = tokenUnion(request.audience);
  const profileAudienceTokens = tokenUnion(profile.audiences);
  return {
    templateMatch: profile.profile_id === mappedProfileId ? 1 : 0,
    artifactTypeMatch: profile.artifact_types.map(normalizeId).includes(request.artifactType) ? 1 : 0,
    formatMatch: profile.export_rules.required_formats.map(normalizeId).includes(request.requestedFormat) ? 1 : 0,
    audienceOverlap: overlapCount(audienceTokens, profileAudienceTokens),
    goalOverlap: overlapCount(goalTokens, profileTokens),
  };
}

function compareCandidates(left, right) {
  for (const key of ["templateMatch", "artifactTypeMatch", "formatMatch", "audienceOverlap", "goalOverlap"]) {
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
    requestedFormat: profile.export_rules.required_formats.includes(request.requestedFormat) ? [] : [request.requestedFormat, ...profile.export_rules.required_formats],
    audience: [...request.audience].filter((audience) => !profile.audiences.includes(audience)),
  };
}

export function selectQualityProfiles({ profiles, templateMap, requests }) {
  if (!Array.isArray(profiles) || profiles.length === 0) throw new Error("profiles must be a non-empty array");
  if (!Array.isArray(requests) || requests.length === 0) throw new Error("requests must be a non-empty array");
  const byId = new Map();
  for (const profile of profiles) {
    const validation = validateQualityProfile(profile, { sourceName: "selection profile" });
    if (!validation.ok) throw new Error(`Invalid selection profile: ${validationDetails(validation)}`);
    if (byId.has(profile.profile_id)) throw new Error(`Duplicate profile ID: ${profile.profile_id}`);
    byId.set(profile.profile_id, profile);
  }
  return requests.map((rawRequest) => {
    assertPlainObject(rawRequest, "request");
    const request = {
      artifactId: normalizeId(rawRequest.artifactId),
      goal: normalizeText(rawRequest.goal),
      audience: (Array.isArray(rawRequest.audience) ? rawRequest.audience : [rawRequest.audience]).map(normalizeId),
      artifactType: normalizeId(rawRequest.artifactType),
      requestedFormat: normalizeId(rawRequest.requestedFormat),
      templateId: rawRequest.templateId === undefined ? null : normalizeId(rawRequest.templateId),
    };
    const explicitId = rawRequest.explicitPrimaryId === undefined ? null : normalizeId(rawRequest.explicitPrimaryId);
    const fallbackId = rawRequest.fallbackPrimaryId === undefined ? null : normalizeId(rawRequest.fallbackPrimaryId);
    const requestedId = explicitId ?? fallbackId;
    if (explicitId !== null && !byId.has(explicitId)) {
      const nearestProfile = [...profiles]
        .map((profile) => ({ profile, distance: levenshtein(explicitId, profile.profile_id) }))
        .sort((left, right) => left.distance - right.distance || left.profile.profile_id.localeCompare(right.profile.profile_id, "en-US"))[0].profile;
      if (fallbackId === null) {
        return deepFreeze({
          artifactId: request.artifactId,
          status: "fallback-required",
          primaryProfileId: null,
          fallbackRecord: {
            requestedProfileId: explicitId,
            nearestProfileId: nearestProfile.profile_id,
            differences: differenceRecord(nearestProfile, request),
          },
        });
      }
      const fallback = byId.get(fallbackId);
      if (!fallback) throw new Error(`Unknown fallback profile: ${fallbackId}`);
      if (!compatibleProfile(fallback, request.artifactType, request.requestedFormat)) {
        throw new Error(`Fallback profile ${fallbackId} is incompatible with the artifact type or requested format`);
      }
      return deepFreeze({
        ...request,
        status: "selected",
        primaryProfileId: fallback.profile_id,
        score: scoreProfile(fallback, request, null),
        renderContractId: renderContractId(fallback, request.requestedFormat),
        fallbackRecord: { requestedProfileId: explicitId, selectedFallbackProfileId: fallbackId },
      });
    }
    if (requestedId !== null) {
      const selected = byId.get(requestedId);
      if (!selected) throw new Error(`Unknown fallback profile: ${requestedId}`);
      if (!compatibleProfile(selected, request.artifactType, request.requestedFormat)) {
        throw new Error(`Explicit profile ${requestedId} is incompatible with the artifact type or requested format`);
      }
      return deepFreeze({
        ...request,
        status: "selected",
        primaryProfileId: selected.profile_id,
        score: scoreProfile(selected, request, null),
        renderContractId: renderContractId(selected, request.requestedFormat),
        fallbackRecord: fallbackId === null ? null : { requestedProfileId: explicitId, selectedFallbackProfileId: fallbackId },
      });
    }
    const mappedProfileId = request.templateId === null ? null : templateMap?.templates?.[request.templateId] ?? null;
    const candidates = profiles
      .filter((profile) => compatibleProfile(profile, request.artifactType, request.requestedFormat))
      .map((profile) => ({ profile, score: scoreProfile(profile, request, mappedProfileId) }))
      .sort(compareCandidates);
    if (candidates.length === 0) throw new Error(`No compatible quality profile for ${request.artifactId}`);
    const [{ profile: selected, score }] = candidates;
    return deepFreeze({
      ...request,
      status: "selected",
      primaryProfileId: selected.profile_id,
      score,
      renderContractId: renderContractId(selected, request.requestedFormat),
      fallbackRecord: null,
    });
  });
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
  return deepFreeze({
    sections: requiredItems(profile.required_sections),
    tables: requiredItems(profile.required_tables),
    diagrams,
    images: requiredItems(profile.required_images),
    acceptanceCriteria: composed.acceptanceCriterionSources.map(({ sourceId, text }) => ({
      id: derivedId(sourceId, "acceptance", text), source_id: sourceId, text, required: true, status: "missing",
    })),
  });
}

export function evaluateStructuralCompleteness(checklist) {
  assertPlainObject(checklist, "checklist");
  const missingIds = [];
  for (const key of ["sections", "tables", "diagrams", "images", "acceptanceCriteria"]) {
    if (!Array.isArray(checklist[key])) throw new Error(`checklist.${key} must be an array`);
    for (const item of checklist[key]) {
      if (item.required !== false && item.status !== "complete") missingIds.push(item.id);
    }
  }
  return deepFreeze({ ready: missingIds.length === 0, missingIds: missingIds.sort() });
}

export function transitionDocumentQualityState({ currentState, targetState, checklist, approvals = {} }) {
  const currentIndex = documentStates.indexOf(currentState);
  const targetIndex = documentStates.indexOf(targetState);
  if (currentIndex < 0 || targetIndex !== currentIndex + 1) throw new Error("target must be the exact next state");
  if (targetState === "structurally-complete" && !evaluateStructuralCompleteness(checklist).ready) {
    throw new Error("structurally-complete requires every required checklist item");
  }
  if (targetState === "evidence-reviewed" && approvals.evidenceReviewedBy !== "evidence-auditor") {
    throw new Error("evidence-reviewed requires evidence-auditor approval");
  }
  if (targetState === "visual-reviewed" && approvals.visualReviewedBy !== "renderer-qa") {
    throw new Error("visual-reviewed requires renderer-qa approval");
  }
  if (targetState === "document-approved" && approvals.documentApprovedBy !== "human") {
    throw new Error("document-approved requires human approval");
  }
  return targetState;
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
