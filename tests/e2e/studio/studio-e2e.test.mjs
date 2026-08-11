import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import { buildProduct } from "../../../tooling/lib/build-product.mjs";

const fixtureRoot = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const runnerPath = path.join(
  fixtureRoot,
  "../../../products/game-design-studio/plugin/skills/orchestrate-game-design-project/scripts/validate-studio-scenario.mjs",
);
let sourceTestRuntimePromise;
let sourceRuntimeBuildRoot;

test.after(async () => {
  if (sourceRuntimeBuildRoot) await rm(sourceRuntimeBuildRoot, { recursive: true, force: true });
});

function sourceTestRuntime() {
  sourceTestRuntimePromise ??= (async () => {
    const validatorPath = path.join(repoRoot, "shared/scripts/validate-artifact.mjs");
    const { validateArtifact } = await import(pathToFileURL(validatorPath).href);
    sourceRuntimeBuildRoot = await mkdtemp(path.join(os.tmpdir(), "studio-e2e-source-runtime-"));
    const build = await buildProduct({ repoRoot, productName: "game-design-studio", stagingRoot: sourceRuntimeBuildRoot, sourceDateEpoch: 0 });
    return {
      validateArtifact,
      validatorPath,
      gateRegistry: JSON.parse(await readFile(path.join(repoRoot, "shared/responsible-design/gates.json"), "utf8")),
      skillsteadLinterPath: path.join(
        build.outputDir,
        "skills/visualize-game-design/scripts/run-skillstead.mjs",
      ),
    };
  })();
  return sourceTestRuntimePromise;
}

async function loadRunner(url = pathToFileURL(runnerPath)) {
  return import(`${url.href}?e2e=${Date.now()}-${Math.random()}`);
}

async function fixtureJson(fixtureId, file = "result.json") {
  return JSON.parse(await readFile(path.join(fixtureRoot, fixtureId, file), "utf8"));
}

async function validate(fixtureId, resultOverride, root = path.join(fixtureRoot, fixtureId), requestOverride) {
  const { validateStudioScenario } = await loadRunner();
  return validateStudioScenario(root, { resultOverride, requestOverride, testRuntime: await sourceTestRuntime() });
}

function messages(result) {
  return result.errors.map(({ code, message }) => `${code}: ${message}`).join("\n");
}

function setAtPath(root, segments, mutate) {
  let parent = root;
  for (const segment of segments.slice(0, -1)) parent = parent[segment];
  mutate(parent, segments.at(-1));
}

function domainAttackMutations(value, segments = []) {
  const attacks = [];
  if (Array.isArray(value)) {
    attacks.push((root) => setAtPath(root, segments, (parent, key) => { parent[key] = [...parent[key], "forged-array-item"]; }));
    if (value.length > 0) attacks.push((root) => setAtPath(root, segments, (parent, key) => { parent[key] = parent[key].slice(0, -1); }));
    if (value.length > 1) attacks.push((root) => setAtPath(root, segments, (parent, key) => { parent[key] = [...parent[key]].reverse(); }));
    value.forEach((item, index) => attacks.push(...domainAttackMutations(item, [...segments, index])));
    return attacks;
  }
  if (value !== null && typeof value === "object") {
    attacks.push((root) => setAtPath(root, segments, (parent, key) => {
      const target = segments.length === 0 ? root : parent[key];
      target.forgedField = "forged";
    }));
    for (const [key, child] of Object.entries(value)) {
      attacks.push((root) => setAtPath(root, [...segments, key], (parent, field) => { delete parent[field]; }));
      attacks.push(...domainAttackMutations(child, [...segments, key]));
    }
    return attacks;
  }
  attacks.push((root) => setAtPath(root, segments, (parent, key) => {
    if (typeof parent[key] === "string") parent[key] = `${parent[key]}-forged`;
    else if (typeof parent[key] === "number") parent[key] += 1;
    else if (typeof parent[key] === "boolean") parent[key] = !parent[key];
    else parent[key] = "forged";
  }));
  return attacks;
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

  const digestAttested = await fixtureJson("pc-console-ai-npc");
  digestAttested.approvedDomainSha256 = "0".repeat(64);
  result = await validate("pc-console-ai-npc", digestAttested);
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

test("approved domain payloads reject plausible self-consistent design substitutions", async () => {
  const attacks = [
    ["live-service-rpg-economy", (value) => { value.domain.economy.source = "forged-premium-source"; }],
    ["live-service-rpg-economy", (value) => { value.domain.economy.sink = "forged-pressure-sink"; }],
    ["live-service-rpg-economy", (value) => { value.domain.economy.targetInventory = 999999; }],
    ["live-service-rpg-economy", (value) => { value.domain.experiment.hypothesis = "forged-retention-claim"; }],
    ["live-service-rpg-economy", (value) => { value.domain.rollback.owner = "forged-operator"; }],
    ["mobile-onboarding-liveops", (value) => { value.domain.onboarding.touchPath = "tap-only-no-alternative"; }],
    ["mobile-onboarding-liveops", (value) => { value.domain.onboarding.interruptionRecovery = "restart-session"; }],
    ["mobile-onboarding-liveops", (value) => { value.domain.liveops.hypothesis = "forged-ftue-claim"; }],
    ["mobile-onboarding-liveops", (value) => { value.domain.liveops.guardrail.metric = "revenue-only"; }],
    ["pc-console-ai-npc", (value) => { value.domain.npc.playerPurpose = "unbounded-persuasion"; }],
    ["pc-console-ai-npc", (value) => { value.domain.npc.fallback.owner = "forged-model-owner"; }],
    ["pc-console-ai-npc", (value) => { value.domain.npc.killSwitch.owner = "forged-reviewer"; }],
    ["pc-console-ai-npc", (value) => { value.domain.rightsConsent.creator = "unapproved-external-corpus"; }],
  ];
  for (const [scenarioId, mutate] of attacks) {
    const candidate = await fixtureJson(scenarioId);
    mutate(candidate);
    const result = await validate(scenarioId, candidate);
    assert.equal(result.ok, false, `${scenarioId}: ${messages(result)}`);
    assert.ok(result.errors.some(({ code }) => code === "approval.domain-mismatch"), messages(result));
  }
});

test("every approved domain field rejects change addition removal and meaningful array reorder", async () => {
  for (const scenarioId of ["live-service-rpg-economy", "mobile-onboarding-liveops", "pc-console-ai-npc"]) {
    const baseline = await fixtureJson(scenarioId);
    const attacks = domainAttackMutations(baseline.domain);
    assert.ok(attacks.length >= 20, `${scenarioId} mutation coverage`);
    for (const mutate of attacks) {
      const candidate = structuredClone(baseline);
      mutate(candidate.domain);
      const result = await validate(scenarioId, candidate);
      assert.equal(result.ok, false, `${scenarioId}: ${messages(result)}`);
      assert.ok(result.errors.some(({ code }) => code === "approval.domain-mismatch"), messages(result));
    }
  }
});

test("domain approval boundary rejects accessors without executing them", async () => {
  const candidate = await fixtureJson("live-service-rpg-economy");
  let accesses = 0;
  Object.defineProperty(candidate.domain.economy, "source", {
    enumerable: true,
    get() { accesses += 1; return "forged-source"; },
  });
  const result = await validate("live-service-rpg-economy", candidate);
  assert.equal(result.ok, false);
  assert.equal(accesses, 0);
  assert.ok(result.errors.some(({ code }) => code === "scenario.files"), messages(result));
});

test("approval snapshot selection is registry-anchored and canonical bytes are digest-pinned", async () => {
  const temporaryParent = await mkdtemp(path.join(os.tmpdir(), "studio-approval-anchor-"));
  const scenarioRoot = path.join(temporaryParent, "scenario");
  try {
    await cp(path.join(fixtureRoot, "live-service-rpg-economy"), scenarioRoot, { recursive: true });
    const [snapshot, synchronizedResult, request] = await Promise.all([
      fixtureJson("live-service-rpg-economy", "approval-snapshot.json"),
      fixtureJson("live-service-rpg-economy"),
      fixtureJson("live-service-rpg-economy", "request.json"),
    ]);
    snapshot.evidenceRegistry[0].assertion = "not-satisfied";
    synchronizedResult.evidenceRegistry = structuredClone(snapshot.evidenceRegistry);
    synchronizedResult.responsibleGates = structuredClone(snapshot.responsibleGates);
    await Promise.all([
      writeFile(path.join(scenarioRoot, "alternate-approval-snapshot.json"), `${JSON.stringify(snapshot, null, 2)}\n`),
      writeFile(path.join(scenarioRoot, "result.json"), `${JSON.stringify(synchronizedResult, null, 2)}\n`),
    ]);

    request.approvalSnapshotPath = "alternate-approval-snapshot.json";
    let result = await validate("live-service-rpg-economy", undefined, scenarioRoot, request);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some(({ code }) => code === "scenario.request-keys"), messages(result));

    delete request.approvalSnapshotPath;
    await writeFile(path.join(scenarioRoot, "approval-snapshot.json"), `${JSON.stringify(snapshot, null, 2)}\n`);
    result = await validate("live-service-rpg-economy", undefined, scenarioRoot, request);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some(({ code }) => code === "approval.snapshot-integrity"), messages(result));

    const crossScenarioBytes = await readFile(path.join(fixtureRoot, "mobile-onboarding-liveops/approval-snapshot.json"));
    await writeFile(path.join(scenarioRoot, "approval-snapshot.json"), crossScenarioBytes);
    result = await validate("live-service-rpg-economy", undefined, scenarioRoot, request);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some(({ code }) => code === "approval.snapshot-integrity"), messages(result));
  } finally {
    await rm(temporaryParent, { recursive: true, force: true });
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
  const reversed = source.replace(
    "현행 정책 근거가 연결되기 전에는 출시를 승인하지 않는다.",
    "현행 정책 근거가 연결되지 않아도 출시를 승인한다.",
  );
  assert.notEqual(reversed, source, "한국어 출시 경계 변조가 실제 템플릿 바이트를 바꿔야 한다");
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

test("release runner contains no repository sibling or host-absolute runtime fallback", async () => {
  const source = await readFile(runnerPath, "utf8");
  assert.doesNotMatch(source, /(?:\.\.\/)+shared(?:\/|["'])/u);
  assert.doesNotMatch(source, /(?:\.\.\/)+products\//u);
  assert.doesNotMatch(source, /\/Users\/|[A-Za-z]:\\/u);
  assert.match(source, /scripts\/validate-artifact\.mjs/u);
  assert.match(source, /references\/shared\/responsible-design\/gates\.json/u);

  const { validateStudioScenario } = await loadRunner();
  const withoutInjection = await validateStudioScenario(path.join(fixtureRoot, "live-service-rpg-economy"));
  assert.equal(withoutInjection.ok, false);
  assert.ok(withoutInjection.errors.some(({ code }) => code === "template.runtime"), messages(withoutInjection));
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

  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("clean-built plugin runs the same professional workflow without repository-only imports", async () => {
  const stagingRoot = await mkdtemp(path.join(os.tmpdir(), "studio-e2e-build-"));
  try {
    const build = await buildProduct({ repoRoot, productName: "game-design-studio", stagingRoot, sourceDateEpoch: 0 });
    const builtRunner = pathToFileURL(path.join(
      build.outputDir,
      "skills/orchestrate-game-design-project/scripts/validate-studio-scenario.mjs",
    ));
    const builtSource = await readFile(fileURLToPath(builtRunner), "utf8");
    assert.doesNotMatch(builtSource, /(?:\.\.\/)+shared(?:\/|["'])/u);
    assert.doesNotMatch(builtSource, /(?:\.\.\/)+products\//u);
    assert.doesNotMatch(builtSource, /\/Users\/|[A-Za-z]:\\/u);
    const { validateStudioScenario } = await loadRunner(builtRunner);
    const result = await validateStudioScenario(path.join(fixtureRoot, "pc-console-ai-npc"));
    assert.equal(result.ok, true, messages(result));
    assert.equal(build.files.includes("skills/orchestrate-game-design-project/scripts/validate-studio-scenario.mjs"), true);
    const cli = spawnSync(process.execPath, [fileURLToPath(builtRunner), path.join(fixtureRoot, "pc-console-ai-npc")], { encoding: "utf8" });
    assert.equal(cli.status, 0, cli.stderr || cli.stdout);
    assert.equal(JSON.parse(cli.stdout).ok, true);

    const [sourceMobile, builtMobile] = await Promise.all([
      validate("mobile-onboarding-liveops"),
      validateStudioScenario(path.join(fixtureRoot, "mobile-onboarding-liveops")),
    ]);
    assert.deepEqual(builtMobile, sourceMobile, "source and clean-built runners must return identical validated state");

    const builtAttack = await fixtureJson("live-service-rpg-economy");
    builtAttack.domain.economy.source = "forged-built-source";
    const builtAttackResult = await validateStudioScenario(
      path.join(fixtureRoot, "live-service-rpg-economy"),
      { resultOverride: builtAttack },
    );
    assert.equal(builtAttackResult.ok, false);
    assert.ok(builtAttackResult.errors.some(({ code }) => code === "approval.domain-mismatch"), messages(builtAttackResult));

    await rm(path.join(build.outputDir, "skills/svg-infographic/scripts/check-svg.mjs"));
    const brokenMobile = await validateStudioScenario(path.join(fixtureRoot, "mobile-onboarding-liveops"));
    assert.equal(brokenMobile.ok, false);
    assert.ok(brokenMobile.errors.some(({ code }) => code === "visualization.lint"), messages(brokenMobile));
  } finally {
    await rm(stagingRoot, { recursive: true, force: true });
  }
});

test("clean-built Studio plugin performs prompt-only image planning without a provider or source dependency", async () => {
  const stagingRoot = await mkdtemp(path.join(os.tmpdir(), "studio-e2e-image-plan-"));
  const artifactRoot = path.join(stagingRoot, "artifact");
  try {
    const build = await buildProduct({ repoRoot, productName: "game-design-studio", stagingRoot, sourceDateEpoch: 0 });
    await mkdir(artifactRoot);
    const workflowPath = path.join(build.outputDir, "scripts/run-image-asset-workflow.mjs");
    const source = await readFile(workflowPath, "utf8");
    assert.doesNotMatch(source, /(?:\.\.\/)+(?:shared|products)\//u);
    const { runImageAssetWorkflow } = await import(`${pathToFileURL(workflowPath).href}?prompt-only=${Date.now()}`);
    let hostCalls = 0;
    let openAiCalls = 0;
    const result = await runImageAssetWorkflow({
      artifactRoot,
      artifact: { artifact_id: "studio-e2e-image", image_needs: [{ slot_id: "hero", type: "character", scene: "A neutral scene.", subject: "An original silhouette.", composition: "Centered.", visual_style: "Original illustration.", readability: "Readable.", width: 1024, height: 1024 }] },
      qualityProfile: { profile_id: "studio-e2e-image", version: 1, artifact_types: ["design-document"], audiences: ["design"], required_sections: [{ id: "visuals", title: "Visuals" }], required_tables: [{ id: "visual-table", section_id: "visuals", columns: ["Signal"] }], required_diagrams: [{ id: "diagram", section_id: "visuals", purpose: "Explain visual intent.", alt_text: "Visual diagram." }], required_images: [{ id: "hero", section_id: "visuals", purpose: "Explain visual intent.", alt_text: "Visual planning placeholder." }], recommended_images: [], length_guidance: { min_words: 1, max_words: 10 }, ppt_story_contract: {}, acceptance_criteria: ["Readable"], export_rules: { required_formats: ["md"], forbidden_formats: [] }, quality_checks: ["visual"] },
      config: { mode: "prompt-only", model: "gpt-image-2", quality: "low", apiKeyPresent: true, apiKey: "test-key" }, codexCapability: { status: "available" },
      hostGenerate: async () => { hostCalls += 1; return { results: [], failures: [] }; },
      generateOpenAIImagesFn: async () => { openAiCalls += 1; return { results: [], failures: [] }; },
    });
    const [manifest, markdown, prompts] = await Promise.all([
      readFile(path.join(artifactRoot, "assets/image-assets.yml"), "utf8").then(JSON.parse),
      readFile(path.join(artifactRoot, "assets/prompts/image-prompts.md"), "utf8"),
      readFile(path.join(artifactRoot, "assets/prompts/image-prompts.json"), "utf8").then(JSON.parse),
    ]);
    assert.equal(hostCalls, 0);
    assert.equal(openAiCalls, 0);
    assert.equal(result.decision.provider, "none");
    assert.equal(manifest.assets[0].generation_state, "prompt-ready");
    assert.equal(manifest.assets[0].approval_state, "concept-draft");
    assert.match(markdown, /Expected count: 1/u);
    assert.equal(prompts.expected_count, 1);
  } finally {
    await rm(stagingRoot, { recursive: true, force: true });
  }
});
