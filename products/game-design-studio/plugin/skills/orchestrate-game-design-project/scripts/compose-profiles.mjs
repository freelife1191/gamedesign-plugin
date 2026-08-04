#!/usr/bin/env node

import { readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const scriptDirectory = path.dirname(scriptPath);
const profileDirectory = path.resolve(scriptDirectory, "../../../references/profiles");
const selectableProfileIds = ["live-service-rpg", "mobile", "pc-console"];
const canonicalProfileIds = ["universal-core", ...selectableProfileIds];
const profileKeys = [
  "assumptions",
  "conflicts",
  "evidenceTriggers",
  "id",
  "questions",
  "requiredSections",
  "responsibleGates",
  "reviewRoles",
  "schemaVersion",
];
const conflictKeys = [
  "id",
  "positions",
  "profiles",
  "requiredDecisionRecordFields",
  "status",
  "topic",
];
const stringArrayFields = [
  "assumptions",
  "questions",
  "requiredSections",
  "responsibleGates",
  "reviewRoles",
  "evidenceTriggers",
];
const requiredDecisionRecordFields = ["decision", "rationale", "evidenceIds", "owner", "approvalDate"];

function fail(profileId, field, detail) {
  throw new Error(`Invalid profile ${profileId}: ${field} ${detail}`);
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}

function requireExactKeys(value, expected, profileId, field) {
  if (!isPlainObject(value)) fail(profileId, field, "must be an object");
  const actual = Object.keys(value).sort();
  const exact = [...expected].sort();
  if (actual.length !== exact.length || actual.some((key, index) => key !== exact[index])) {
    const missing = exact.filter((key) => !actual.includes(key));
    const unexpected = actual.filter((key) => !exact.includes(key));
    fail(
      profileId,
      field,
      `must have exact keys: ${exact.join(", ")}; missing: ${missing.join(", ") || "none"}; unexpected: ${unexpected.join(", ") || "none"}`,
    );
  }
}

function requireString(value, profileId, field) {
  if (typeof value !== "string" || value.trim() === "") fail(profileId, field, "must be a non-empty string");
  return value;
}

function requireStringArray(value, profileId, field) {
  if (!Array.isArray(value) || value.length === 0) fail(profileId, field, "must be a non-empty string array");
  const result = value.map((item, index) => requireString(item, profileId, `${field}[${index}]`));
  if (new Set(result).size !== result.length) fail(profileId, field, "must not contain duplicates");
  return result;
}

function validateConflict(value, ownerProfileId, index) {
  const field = `conflicts[${index}]`;
  requireExactKeys(value, conflictKeys, ownerProfileId, field);
  const id = requireString(value.id, ownerProfileId, `${field}.id`);
  const topic = requireString(value.topic, ownerProfileId, `${field}.topic`);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(id)) fail(ownerProfileId, `${field}.id`, "must be kebab-case");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(topic)) fail(ownerProfileId, `${field}.topic`, "must be kebab-case");

  const profiles = requireStringArray(value.profiles, ownerProfileId, `${field}.profiles`);
  if (profiles.length !== 2) fail(ownerProfileId, `${field}.profiles`, "must contain exactly two profiles");
  if (profiles.some((profileId) => !canonicalProfileIds.includes(profileId))) fail(ownerProfileId, `${field}.profiles`, "contains an unknown profile");
  if (!profiles.includes(ownerProfileId)) fail(ownerProfileId, `${field}.profiles`, "must include the owning profile");
  const canonicalProfiles = canonicalProfileIds.filter((profileId) => profiles.includes(profileId));
  if (profiles.some((profileId, profileIndex) => profileId !== canonicalProfiles[profileIndex])) {
    fail(ownerProfileId, `${field}.profiles`, "must use canonical profile order");
  }

  requireExactKeys(value.positions, profiles, ownerProfileId, `${field}.positions`);
  const positions = Object.fromEntries(profiles.map((profileId) => [
    profileId,
    requireString(value.positions[profileId], ownerProfileId, `${field}.positions.${profileId}`),
  ]));
  if (value.status !== "decision-record-required") fail(ownerProfileId, `${field}.status`, "must equal decision-record-required");
  const decisionFields = value.requiredDecisionRecordFields;
  if (
    !Array.isArray(decisionFields)
    || decisionFields.length !== requiredDecisionRecordFields.length
    || decisionFields.some((decisionField, decisionIndex) => decisionField !== requiredDecisionRecordFields[decisionIndex])
  ) {
    fail(
      ownerProfileId,
      `${field}.requiredDecisionRecordFields`,
      `must exactly equal ${requiredDecisionRecordFields.join(", ")}`,
    );
  }

  return {
    id,
    topic,
    profiles,
    positions,
    status: "decision-record-required",
    requiredDecisionRecordFields: [...decisionFields],
  };
}

function validateProfile(value, expectedProfileId) {
  requireExactKeys(value, profileKeys, expectedProfileId, "top-level metadata");
  if (value.schemaVersion !== 1) fail(expectedProfileId, "schemaVersion", "must equal 1");
  if (value.id !== expectedProfileId) fail(expectedProfileId, "id", `must equal filename ID ${expectedProfileId}`);
  const validated = { schemaVersion: 1, id: expectedProfileId };
  for (const field of stringArrayFields) validated[field] = requireStringArray(value[field], expectedProfileId, field);
  if (!Array.isArray(value.conflicts)) fail(expectedProfileId, "conflicts", "must be an array");
  validated.conflicts = value.conflicts.map((conflict, index) => validateConflict(conflict, expectedProfileId, index));
  return validated;
}

function loadProfile(profileId) {
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(path.join(profileDirectory, `${profileId}.json`), "utf8"));
  } catch (error) {
    fail(profileId, "JSON", `could not be parsed: ${error.message}`);
  }
  return validateProfile(parsed, profileId);
}

function unique(items) {
  return [...new Set(items)];
}

export function composeProfiles(requestedProfileIds = []) {
  for (const profileId of requestedProfileIds) {
    if (!selectableProfileIds.includes(profileId)) {
      throw new Error(`Unknown profile: ${profileId}. Allowed profiles: ${selectableProfileIds.join(", ")}`);
    }
  }

  const selectedIds = canonicalProfileIds.filter((profileId) =>
    profileId === "universal-core" || requestedProfileIds.includes(profileId),
  );
  const selected = selectedIds.map(loadProfile);
  const selectedSet = new Set(selectedIds);
  const conflictsById = new Map();

  for (const profile of selected) {
    for (const conflict of profile.conflicts) {
      if (!conflict.profiles.every((profileId) => selectedSet.has(profileId))) continue;
      const prior = conflictsById.get(conflict.id);
      if (prior && JSON.stringify(prior) !== JSON.stringify(conflict)) {
        throw new Error(`Conflicting definitions for conflict ID: ${conflict.id}`);
      }
      if (!prior) conflictsById.set(conflict.id, conflict);
    }
  }

  return {
    profiles: selectedIds,
    questions: unique(selected.flatMap(({ questions }) => questions)),
    requiredSections: unique(selected.flatMap(({ requiredSections }) => requiredSections)),
    gates: unique(selected.flatMap(({ responsibleGates }) => responsibleGates)),
    roles: unique(selected.flatMap(({ reviewRoles }) => reviewRoles)),
    conflicts: [...conflictsById.values()],
  };
}

function isMainModule() {
  if (!process.argv[1]) return false;
  try {
    return realpathSync(process.argv[1]) === realpathSync(scriptPath);
  } catch {
    return false;
  }
}

if (isMainModule()) {
  try {
    process.stdout.write(`${JSON.stringify(composeProfiles(process.argv.slice(2)), null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
