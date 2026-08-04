import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import { buildProduct } from "../../../tooling/lib/build-product.mjs";

const fixtureRoot = fileURLToPath(new URL(".", import.meta.url));
const runnerPath = path.join(
  fixtureRoot,
  "../../../products/game-design-studio/plugin/skills/orchestrate-game-design-project/scripts/validate-studio-scenario.mjs",
);

async function loadRunner(url = pathToFileURL(runnerPath)) {
  return import(`${url.href}?e2e=${Date.now()}-${Math.random()}`);
}

async function fixtureJson(fixtureId, file = "result.json") {
  return JSON.parse(await readFile(path.join(fixtureRoot, fixtureId, file), "utf8"));
}

async function validate(fixtureId, resultOverride, root = path.join(fixtureRoot, fixtureId), requestOverride) {
  const { validateStudioScenario } = await loadRunner();
  return validateStudioScenario(root, { resultOverride, requestOverride });
}

function messages(result) {
  return result.errors.map(({ code, message }) => `${code}: ${message}`).join("\n");
}

test("live-service RPG economy executes routing, profiles, canonical templates, gates, rollback, and export", async () => {
  const result = await validate("live-service-rpg-economy");
  assert.equal(result.ok, true, messages(result));
  assert.deepEqual(result.routeIds, ["economy", "liveops", "export"]);
  assert.deepEqual(result.skillIds, ["design-game-economy-and-liveops", "design-game-economy-and-liveops", "export-game-design-documents"]);
  assert.deepEqual(result.profileIds, ["universal-core", "live-service-rpg"]);
  assert.deepEqual(result.validatedTemplateIds, ["economy-balance", "liveops-experiment-event"]);
  assert.equal(result.acceptance.economyRollbackReady, true);
  assert.equal(result.outputs.md, "pending");
  assert.equal(result.outputs.pdf, "unavailable");
});

test("mobile onboarding executes UX, LiveOps, Skillstead visualization routing, and guardrails", async () => {
  const result = await validate("mobile-onboarding-liveops");
  assert.equal(result.ok, true, messages(result));
  assert.deepEqual(result.routeIds, ["player-experience", "liveops", "visualization", "export"]);
  assert.deepEqual(result.profileIds, ["universal-core", "mobile"]);
  assert.deepEqual(result.validatedTemplateIds, ["ui-ux-flow-state", "liveops-experiment-event"]);
  assert.equal(result.acceptance.liveopsGuardrailReady, true);
  assert.equal(result.acceptance.visualizationPresetId, "state-rule-flow");
  assert.equal(result.visualizationEvidence.path, "onboarding-flow.svg");
  assert.equal(result.visualizationEvidence.exitCode, 0);
  assert.match(result.visualizationEvidence.svgDigest, /^[a-f0-9]{64}$/u);
  assert.match(result.visualizationEvidence.linterDigest, /^[a-f0-9]{64}$/u);
  assert.match(result.visualizationEvidence.log, /0 error\(s\), 0 warning\(s\)/u);
  assert.equal(result.outputs.pptx, "unavailable");
});

test("PC/console AI NPC executes content, systems, review, rights, safety fallback, and kill switch", async () => {
  const result = await validate("pc-console-ai-npc");
  assert.equal(result.ok, true, messages(result));
  assert.deepEqual(result.routeIds, ["content", "systems", "review", "export"]);
  assert.deepEqual(result.profileIds, ["universal-core", "pc-console"]);
  assert.deepEqual(result.validatedTemplateIds, ["narrative-quest-npc", "system-specification", "game-design-review"]);
  assert.equal(result.acceptance.aiRightsConsentReady, true);
  assert.equal(result.acceptance.aiFallbackReady, true);
  assert.equal(result.acceptance.aiKillSwitchReady, true);
  assert.equal(result.outputs.docx, "unavailable");
});

test("missing rollback, LiveOps guardrail, or any AI rights/safety field fails closed", async () => {
  const economy = await fixtureJson("live-service-rpg-economy");
  economy.domain.rollback.enabled = false;
  let result = await validate("live-service-rpg-economy", economy);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(({ code }) => code === "economy.rollback"), messages(result));

  const mobile = await fixtureJson("mobile-onboarding-liveops");
  delete mobile.domain.liveops.guardrail;
  result = await validate("mobile-onboarding-liveops", mobile);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(({ code }) => code === "liveops.guardrail"), messages(result));

  for (const mutate of [
    (value) => { delete value.domain.rightsConsent.rightsStatus; },
    (value) => { delete value.domain.rightsConsent.consentStatus; },
    (value) => { delete value.domain.npc.fallback; },
    (value) => { value.domain.npc.killSwitch.enabled = false; },
  ]) {
    const ai = await fixtureJson("pc-console-ai-npc");
    mutate(ai);
    result = await validate("pc-console-ai-npc", ai);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some(({ code }) => code.startsWith("ai.")), messages(result));
  }
});

test("semantic contradictions, malformed schemas, forged approvals, and self-attestation fail closed", async () => {
  const economy = await fixtureJson("live-service-rpg-economy");
  economy.domain.rollback.action = "do-not-rollback";
  let result = await validate("live-service-rpg-economy", economy);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(({ code }) => code === "economy.rollback"), messages(result));

  const mobile = await fixtureJson("mobile-onboarding-liveops");
  mobile.domain.liveops.guardrail.direction = "may-increase";
  result = await validate("mobile-onboarding-liveops", mobile);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(({ code }) => code === "liveops.guardrail"), messages(result));

  const ai = await fixtureJson("pc-console-ai-npc");
  ai.responsibleGates[0].evidenceIds = ["forged-rights-proof"];
  result = await validate("pc-console-ai-npc", ai);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(({ code }) => code === "approval.gate-mismatch"), messages(result));

  const malformed = await validate("mobile-onboarding-liveops", []);
  assert.equal(malformed.ok, false);
  assert.ok(malformed.errors.some(({ code }) => code === "scenario.schema"), messages(malformed));

  const malformedNested = await fixtureJson("live-service-rpg-economy");
  malformedNested.roleIds = null;
  malformedNested.evidenceRegistry = [null];
  malformedNested.responsibleGates = [null, null];
  result = await validate("live-service-rpg-economy", malformedNested);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(({ code }) => code === "review.roles"), messages(result));
  assert.ok(result.errors.some(({ code }) => code === "approval.evidence-mismatch"), messages(result));

  const malformedRequest = await validate("live-service-rpg-economy", undefined, undefined, []);
  assert.equal(malformedRequest.ok, false);
  assert.ok(malformedRequest.errors.some(({ code }) => code === "scenario.request-schema"), messages(malformedRequest));

  const nonArrayEvidenceIds = await fixtureJson("mobile-onboarding-liveops");
  nonArrayEvidenceIds.responsibleGates[0].evidenceIds = null;
  result = await validate("mobile-onboarding-liveops", nonArrayEvidenceIds);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(({ code }) => code === "approval.gate-mismatch"), messages(result));

  const selfAttested = await fixtureJson("pc-console-ai-npc");
  selfAttested.actualSkills = ["content-is-valid"];
  result = await validate("pc-console-ai-npc", selfAttested);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(({ code }) => code === "scenario.result-keys"), messages(result));
});

test("trusted approval snapshots reject candidate evidence addition removal replacement and decision drift", async () => {
  for (const mutate of [
    (value) => { value.evidenceRegistry.push(structuredClone(value.evidenceRegistry[0])); value.evidenceRegistry.at(-1).evidenceId = "forged-extra-evidence"; },
    (value) => { value.evidenceRegistry.pop(); },
    (value) => { value.evidenceRegistry[0].assertion = "not-satisfied"; },
    (value) => { value.responsibleGates[0].decisionId = "forged-decision"; },
    (value) => { value.responsibleGates[0].approvalDate = "2099-01-01"; },
    (value) => { value.responsibleGates[0].approver = "self-attested-owner"; },
  ]) {
    const candidate = await fixtureJson("live-service-rpg-economy");
    mutate(candidate);
    const result = await validate("live-service-rpg-economy", candidate);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some(({ code }) => code.startsWith("approval.")), messages(result));
  }
});

test("protective LiveOps and AI fields use exact executable meanings", async () => {
  for (const mutate of [
    (value) => { value.domain.liveops.stopCondition = "continue-after-guardrail-breach"; },
    (value) => { value.domain.liveops.rollback = "retain-experiment-treatment"; },
  ]) {
    const candidate = await fixtureJson("mobile-onboarding-liveops");
    mutate(candidate);
    const result = await validate("mobile-onboarding-liveops", candidate);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some(({ code }) => code === "liveops.guardrail"), messages(result));
  }
  for (const mutate of [
    (value) => { value.domain.npc.fallback.trigger = "ignore-model-failure"; },
    (value) => { value.domain.rightsConsent.privacy = "collect-player-personal-data"; },
    (value) => { value.domain.rightsConsent.moderation = "no-generation-filters"; },
    (value) => { value.domain.rightsConsent.approver = "self-attested-owner"; },
    (value) => { value.domain.rightsConsent.revocationPath = "no-revocation"; },
  ]) {
    const candidate = await fixtureJson("pc-console-ai-npc");
    mutate(candidate);
    const result = await validate("pc-console-ai-npc", candidate);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some(({ code }) => code.startsWith("ai.")), messages(result));
  }
});

test("Task 8 hashes reject token-preserving template reversals and export recipes reject wrong source templates", async () => {
  const { validateTemplateContentIntegrity, validateExportTemplateContract } = await loadRunner();
  const source = await readFile(path.join(
    fixtureRoot,
    "../../../products/game-design-studio/plugin/assets/templates/economy-balance/content.md",
  ), "utf8");
  const reversed = source.replace("Release approval is blocked until", "Release approval is allowed even when");
  const integrity = await validateTemplateContentIntegrity("economy-balance", reversed);
  assert.equal(integrity.valid, false);
  assert.equal(validateExportTemplateContract({
    recipeId: "liveops-plan",
    exportTemplateId: "economy-balance",
    templates: ["economy-balance", "liveops-experiment-event"],
  }), false);
  assert.equal(validateExportTemplateContract({
    recipeId: "content-spec",
    exportTemplateId: "narrative-quest-npc",
    templates: ["narrative-quest-npc", "system-specification", "game-design-review"],
  }), true);
});

test("review selection is capped at three and deterministic sequential fallback preserves registry priority", async () => {
  const baseline = await validate("live-service-rpg-economy");
  assert.equal(baseline.ok, true, messages(baseline));
  assert.equal(baseline.roleIds.length, 3);
  assert.deepEqual(baseline.fallback, { mode: "sequential", order: baseline.roleIds, preservesRolesAndQuestions: true });

  const tooMany = await fixtureJson("live-service-rpg-economy");
  tooMany.roleIds.push("production-feasibility-critic");
  const result = await validate("live-service-rpg-economy", tooMany);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(({ code }) => code === "review.roles"), messages(result));
});

test("path traversal and symlink traversal cannot escape or alias scenario evidence", async () => {
  const traversed = await fixtureJson("live-service-rpg-economy");
  traversed.outputManifestPath = "../mobile-onboarding-liveops/output-manifest.json";
  let result = await validate("live-service-rpg-economy", traversed);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(({ code }) => code === "output.manifest"), messages(result));

  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "studio-e2e-symlink-"));
  try {
    const request = path.join(fixtureRoot, "live-service-rpg-economy/request.json");
    const fixtureResult = path.join(fixtureRoot, "live-service-rpg-economy/result.json");
    await symlink(request, path.join(temporaryRoot, "request.json"));
    await symlink(fixtureResult, path.join(temporaryRoot, "result.json"));
    result = await validate("live-service-rpg-economy", undefined, temporaryRoot);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some(({ code }) => code === "scenario.files"), messages(result));

    const requestOverride = await fixtureJson("live-service-rpg-economy", "request.json");
    requestOverride.approvalSnapshotPath = "../mobile-onboarding-liveops/approval-snapshot.json";
    result = await validate("live-service-rpg-economy", undefined, undefined, requestOverride);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some(({ code }) => code === "approval.snapshot-file"), messages(result));
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("clean-built plugin runs the same professional workflow without repository-only imports", async () => {
  const stagingRoot = await mkdtemp(path.join(os.tmpdir(), "studio-e2e-build-"));
  try {
    const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
    const build = await buildProduct({ repoRoot, productName: "game-design-studio", stagingRoot, sourceDateEpoch: 0 });
    const builtRunner = pathToFileURL(path.join(
      build.outputDir,
      "skills/orchestrate-game-design-project/scripts/validate-studio-scenario.mjs",
    ));
    const { validateStudioScenario } = await loadRunner(builtRunner);
    const result = await validateStudioScenario(path.join(fixtureRoot, "pc-console-ai-npc"));
    assert.equal(result.ok, true, messages(result));
    assert.equal(build.files.includes("skills/orchestrate-game-design-project/scripts/validate-studio-scenario.mjs"), true);
    const cli = spawnSync(process.execPath, [fileURLToPath(builtRunner), path.join(fixtureRoot, "pc-console-ai-npc")], { encoding: "utf8" });
    assert.equal(cli.status, 0, cli.stderr || cli.stdout);
    assert.equal(JSON.parse(cli.stdout).ok, true);

    await rm(path.join(build.outputDir, "skills/svg-infographic/scripts/check-svg.mjs"));
    const brokenMobile = await validateStudioScenario(path.join(fixtureRoot, "mobile-onboarding-liveops"));
    assert.equal(brokenMobile.ok, false);
    assert.ok(brokenMobile.errors.some(({ code }) => code === "visualization.lint"), messages(brokenMobile));
  } finally {
    await rm(stagingRoot, { recursive: true, force: true });
  }
});
