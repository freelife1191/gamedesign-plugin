#!/usr/bin/env node

import { readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const scriptDirectory = path.dirname(scriptPath);
const profileDirectory = path.resolve(scriptDirectory, "../../../references/profiles");
const selectableProfileIds = ["live-service-rpg", "mobile", "pc-console"];
const canonicalProfileIds = ["universal-core", ...selectableProfileIds];

function loadProfile(profileId) {
  return JSON.parse(readFileSync(path.join(profileDirectory, `${profileId}.json`), "utf8"));
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
  const conflicts = [];
  const conflictIds = new Set();

  for (const profile of selected) {
    for (const conflict of profile.conflicts) {
      if (conflict.profiles.every((profileId) => selectedSet.has(profileId)) && !conflictIds.has(conflict.id)) {
        conflictIds.add(conflict.id);
        conflicts.push(conflict);
      }
    }
  }

  return {
    profiles: selectedIds,
    questions: unique(selected.flatMap(({ questions }) => questions)),
    requiredSections: unique(selected.flatMap(({ requiredSections }) => requiredSections)),
    gates: unique(selected.flatMap(({ responsibleGates }) => responsibleGates)),
    roles: unique(selected.flatMap(({ reviewRoles }) => reviewRoles)),
    conflicts,
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
