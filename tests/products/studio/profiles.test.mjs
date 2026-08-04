import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const pluginRoot = path.join(repoRoot, "products/game-design-studio/plugin");
const profileRoot = path.join(pluginRoot, "references/profiles");
const composerRelativePath = "skills/orchestrate-game-design-project/scripts/compose-profiles.mjs";
const composerPath = path.join(pluginRoot, composerRelativePath);
const profileIds = ["universal-core", "live-service-rpg", "mobile", "pc-console"];
const profileOrder = new Map(profileIds.map((id, index) => [id, index]));

function compose(...profiles) {
  const result = spawnSync(process.execPath, [composerPath, ...profiles], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  return {
    ...result,
    json: result.status === 0 ? JSON.parse(result.stdout) : undefined,
  };
}

async function readProfile(profileId) {
  return JSON.parse(await readFile(path.join(profileRoot, `${profileId}.json`), "utf8"));
}

test("profile composer is bundled with the orchestrator instead of forbidden top-level product scripts", async () => {
  await assert.doesNotReject(access(composerPath));
  await assert.rejects(access(path.join(pluginRoot, "scripts/compose-profiles.mjs")), { code: "ENOENT" });
});

test("every profile encodes assumptions as questions, evidence triggers, and responsible gates", async () => {
  for (const profileId of profileIds) {
    const profile = await readProfile(profileId);
    assert.deepEqual(Object.keys(profile).sort(), [
      "assumptions",
      "conflicts",
      "evidenceTriggers",
      "id",
      "questions",
      "requiredSections",
      "responsibleGates",
      "reviewRoles",
      "schemaVersion",
    ]);
    assert.equal(profile.schemaVersion, 1);
    assert.equal(profile.id, profileId);
    for (const field of ["assumptions", "questions", "requiredSections", "responsibleGates", "reviewRoles", "evidenceTriggers"]) {
      assert.ok(Array.isArray(profile[field]) && profile[field].length > 0, `${profileId}: ${field}`);
    }
    assert.ok(Array.isArray(profile.conflicts), `${profileId}: conflicts`);
    assert.ok(profile.assumptions.every((assumption) => /\b(?:may|can)\b/iu.test(assumption)), `${profileId}: assumptions remain hypotheses`);
    assert.ok(profile.questions.every((question) => question.endsWith("?")), `${profileId}: questions remain open`);
  }
});

test("single-profile composition always starts with universal core and returns the exact public shape", () => {
  const result = compose("mobile");
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(Object.keys(result.json), ["profiles", "questions", "requiredSections", "gates", "roles", "conflicts"]);
  assert.deepEqual(result.json.profiles, ["universal-core", "mobile"]);
  for (const field of ["questions", "requiredSections", "gates", "roles"]) {
    assert.ok(result.json[field].length > 0, field);
    assert.equal(new Set(result.json[field]).size, result.json[field].length, `${field} deduplicated`);
  }
  assert.deepEqual(result.json.conflicts, []);
});

test("composition deduplicates requested profiles and uses canonical order independent of arguments", () => {
  const forward = compose("live-service-rpg", "mobile", "pc-console", "mobile");
  const reverse = compose("pc-console", "mobile", "live-service-rpg");
  assert.equal(forward.status, 0, forward.stderr);
  assert.equal(reverse.status, 0, reverse.stderr);
  assert.deepEqual(forward.json, reverse.json);
  assert.deepEqual(forward.json.profiles, profileIds);
  assert.ok(forward.json.profiles.every((id, index, items) => index === 0 || profileOrder.get(items[index - 1]) < profileOrder.get(id)));
});

test("live-service RPG plus mobile exposes session-length and authority conflicts without resolving them", () => {
  const result = compose("live-service-rpg", "mobile");
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.json.conflicts.map(({ id }) => id), [
    "session-length-short-vs-long-form",
    "client-vs-server-authority",
  ]);
  for (const conflict of result.json.conflicts) {
    assert.equal(conflict.status, "decision-record-required");
    assert.deepEqual(conflict.profiles, ["live-service-rpg", "mobile"]);
    assert.deepEqual(conflict.requiredDecisionRecordFields, ["decision", "rationale", "evidenceIds", "owner", "approvalDate"]);
    assert.equal(Object.keys(conflict.positions).length, 2);
    assert.ok(!("resolution" in conflict));
  }
});

test("mobile plus PC-console exposes touch/controller and monetization/platform-policy conflicts", () => {
  const result = compose("mobile", "pc-console");
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.json.conflicts.map(({ id }) => id), [
    "touch-vs-controller-first-input",
    "monetization-vs-platform-policy",
  ]);
  assert.ok(result.json.conflicts.every(({ status }) => status === "decision-record-required"));
});

test("unknown profile IDs are rejected exactly instead of guessed or ignored", () => {
  const result = compose("mobile-ish");
  assert.notEqual(result.status, 0);
  assert.equal(result.stdout, "");
  assert.equal(result.stderr.trim(), "Unknown profile: mobile-ish. Allowed profiles: live-service-rpg, mobile, pc-console");
});

test("empty invocation composes only the universal baseline", () => {
  const result = compose();
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.json.profiles, ["universal-core"]);
  assert.deepEqual(result.json.conflicts, []);
});
