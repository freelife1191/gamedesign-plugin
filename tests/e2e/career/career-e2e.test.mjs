import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import { buildProduct } from "../../../tooling/lib/build-product.mjs";

const fixtureRoot = fileURLToPath(new URL(".", import.meta.url));
const runnerUrl = pathToFileURL(path.join(
  fixtureRoot,
  "../../../products/game-design-career/plugin/skills/orchestrate-game-design-career/scripts/validate-career-scenario.mjs",
));

async function loadRunner() {
  return import(`${runnerUrl.href}?e2e=${Date.now()}-${Math.random()}`);
}

async function validate(fixtureId, resultOverride) {
  const { validateCareerScenario } = await loadRunner();
  return validateCareerScenario(path.join(fixtureRoot, fixtureId), { resultOverride });
}

function messages(result) {
  return result.errors.map(({ code, message }) => `${code}: ${message}`).join("\n");
}

async function fixtureJson(fixtureId, file = "result.json") {
  return JSON.parse(await readFile(path.join(fixtureRoot, fixtureId, file), "utf8"));
}

function setReverseObservationDate(result, observationDate) {
  result.analysisScope.observationDate = observationDate;
  for (const source of result.analysisScope.sourceAccess) source.observationDate = observationDate;
}

test("entry: actual route, templates, competency-map SVG, and PDF request form a 12-week evidence roadmap", async () => {
  const result = await validate("entry-12-week-roadmap");

  assert.equal(result.ok, true, messages(result));
  assert.equal(result.scenarioId, "entry-12-week-roadmap");
  assert.deepEqual(result.routeIds, [
    "entry-role-map",
    "entry-competency-visualization",
    "entry-roadmap-export",
  ]);
  assert.deepEqual(result.validatedTemplateIds, [
    "game-design-role-map",
    "competency-matrix",
    "learning-roadmap",
  ]);
  assert.equal(result.acceptance.roleCandidateCount, 2);
  assert.equal(result.acceptance.evidenceGapCount, 2);
  assert.equal(result.acceptance.weekCount, 12);
  assert.equal(result.acceptance.firstPortfolioBriefReady, true);
  assert.equal(result.acceptance.visualizationPresetId, "competency-map");
  assert.equal(result.outputs.svg, "linted");
  assert.equal(result.outputs.pdf, "blocked");
});

test("reverse: actual route rejects user-manual mode and validates falsifiable claims plus DOCX/PPTX requests", async () => {
  const result = await validate("reverse-design-portfolio");

  assert.equal(result.ok, true, messages(result));
  assert.deepEqual(result.routeIds, [
    "new-hire-reverse-design",
    "new-hire-reverse-design-export",
  ]);
  assert.deepEqual(result.validatedTemplateIds, ["reverse-design-document"]);
  assert.deepEqual(result.acceptance.reverseSurfaces, [
    "fact",
    "inference",
    "rules",
    "exceptions",
    "UI",
    "data",
    "economy",
    "operations",
    "alternatives",
    "validation",
  ]);
  assert.equal(result.acceptance.userManualRejected, true);
  assert.equal(result.outputs.docx, "blocked");
  assert.equal(result.outputs.pptx, "blocked");
});

test("transition: primary job evidence grounds project impact, four question types, feedback, and quarterly work", async () => {
  const result = await validate("junior-transition");

  assert.equal(result.ok, true, messages(result));
  assert.deepEqual(result.routeIds, [
    "transition-job-research",
    "transition-interview-practice",
    "transition-growth-plan",
    "transition-readiness-visualization",
    "transition-export",
  ]);
  assert.deepEqual(result.acceptance.questionTypes, ["base", "follow-up", "objection", "situational"]);
  assert.equal(result.acceptance.primaryJobEvidenceCount, 1);
  assert.equal(result.acceptance.projectImpactCount, 1);
  assert.equal(result.acceptance.evidenceGapCount, 2);
  assert.equal(result.acceptance.answerFeedbackCount, 1);
  assert.equal(result.acceptance.quarterlyGoalCount, 2);
  assert.equal(result.acceptance.unverifiedCurrentClaimCount, 0);
  assert.equal(result.outputs.pdf, "blocked");
});

test("transition rejects stale year-2000 job evidence at the trusted scenario snapshot", async () => {
  const stagingRoot = await mkdtemp(path.join(os.tmpdir(), "career-stale-job-"));
  const fixture = path.join(stagingRoot, "junior-transition");
  try {
    await cp(path.join(fixtureRoot, "junior-transition"), fixture, { recursive: true });
    const records = JSON.parse(await readFile(path.join(fixture, "job-evidence.json"), "utf8"));
    records[0].postedDate = "2000-01-01";
    records[0].retrievalDate = "2000-01-02";
    records[0].reviewAfter = "2000-02-01";
    await writeFile(path.join(fixture, "job-evidence.json"), `${JSON.stringify(records, null, 2)}\n`, "utf8");
    const { validateCareerScenario } = await loadRunner();
    const result = await validateCareerScenario(fixture);
    assert.equal(result.ok, false, messages(result));
    assert.ok(result.errors.some(({ code, message }) => (
      code === "transition.job-evidence-schema" && /expired|stale|reviewAfter/iu.test(message)
    )), messages(result));
  } finally {
    await rm(stagingRoot, { recursive: true, force: true });
  }
});

test("scenario as-of dates are registry-bound and reject self-attested or cross-scenario snapshots", async () => {
  const result = await fixtureJson("junior-transition");
  result.asOfDate = "2026-08-04";
  const validation = await validate("junior-transition", result);
  assert.equal(validation.ok, false, messages(validation));
  assert.ok(validation.errors.some(({ code }) => code === "route.as-of-date"), messages(validation));

  const stagingRoot = await mkdtemp(path.join(os.tmpdir(), "career-cross-as-of-"));
  const fixture = path.join(stagingRoot, "junior-transition");
  try {
    await cp(path.join(fixtureRoot, "junior-transition"), fixture, { recursive: true });
    const request = JSON.parse(await readFile(path.join(fixture, "request.json"), "utf8"));
    request.asOfDate = "2026-08-06";
    await writeFile(path.join(fixture, "request.json"), `${JSON.stringify(request, null, 2)}\n`, "utf8");
    const { validateCareerScenario } = await loadRunner();
    const requestValidation = await validateCareerScenario(fixture);
    assert.equal(requestValidation.ok, false, messages(requestValidation));
    assert.ok(requestValidation.errors.some(({ code }) => code === "route.as-of-date"), messages(requestValidation));
  } finally {
    await rm(stagingRoot, { recursive: true, force: true });
  }
});

test("semantic mutations cannot pass the three workflow acceptances", async () => {
  const entry = structuredClone((await import("./entry-12-week-roadmap/result.json", { with: { type: "json" } })).default);
  entry.weeks.pop();
  const entryResult = await validate("entry-12-week-roadmap", entry);
  assert.equal(entryResult.ok, false);
  assert.ok(entryResult.errors.some(({ code }) => code === "entry.week-count"), messages(entryResult));

  const reverse = structuredClone((await import("./reverse-design-portfolio/result.json", { with: { type: "json" } })).default);
  reverse.userManualRejected = false;
  const reverseResult = await validate("reverse-design-portfolio", reverse);
  assert.equal(reverseResult.ok, false);
  assert.ok(reverseResult.errors.some(({ code }) => code === "reverse.user-manual"), messages(reverseResult));

  const unboundExport = await fixtureJson("reverse-design-portfolio");
  unboundExport.artifactTemplateIds = ["learning-roadmap"];
  const unboundExportResult = await validate("reverse-design-portfolio", unboundExport);
  assert.equal(unboundExportResult.ok, false);
  assert.ok(unboundExportResult.errors.some(({ code }) => code === "output.export"), messages(unboundExportResult));

  const transition = structuredClone((await import("./junior-transition/result.json", { with: { type: "json" } })).default);
  transition.unverifiedCurrentClaims.push("The target studio is expanding its design team.");
  const transitionResult = await validate("junior-transition", transition);
  assert.equal(transitionResult.ok, false);
  assert.ok(transitionResult.errors.some(({ code }) => code === "transition.unverified-current-claims"), messages(transitionResult));
});

test("malformed results and cross-fixture paths fail closed", async () => {
  const malformed = await validate("entry-12-week-roadmap", []);
  assert.equal(malformed.ok, false);
  assert.ok(malformed.errors.some(({ code }) => code === "scenario.schema"), messages(malformed));

  const entry = structuredClone((await import("./entry-12-week-roadmap/result.json", { with: { type: "json" } })).default);
  entry.export.jobPath = "../reverse-design-portfolio/export-job.json";
  const escapedExport = await validate("entry-12-week-roadmap", entry);
  assert.equal(escapedExport.ok, false);
  assert.ok(escapedExport.errors.some(({ code }) => code === "output.export"), messages(escapedExport));

  const transition = structuredClone((await import("./junior-transition/result.json", { with: { type: "json" } })).default);
  transition.jobEvidencePath = "../entry-12-week-roadmap/request.json";
  const escapedEvidence = await validate("junior-transition", transition);
  assert.equal(escapedEvidence.ok, false);
  assert.ok(escapedEvidence.errors.some(({ code }) => code === "transition.job-evidence"), messages(escapedEvidence));
});

test("clean-built plugin runs the reverse scenario contract without repository-only imports", async () => {
  const stagingRoot = await mkdtemp(path.join(os.tmpdir(), "career-e2e-build-"));
  try {
    const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
    const build = await buildProduct({
      repoRoot,
      productName: "game-design-career",
      stagingRoot,
      sourceDateEpoch: 0,
    });
    const builtRunner = pathToFileURL(path.join(
      build.outputDir,
      "skills/orchestrate-game-design-career/scripts/validate-career-scenario.mjs",
    ));
    const { validateCareerScenario } = await import(`${builtRunner.href}?built=${Date.now()}`);
    const reverseResult = await validateCareerScenario(path.join(fixtureRoot, "reverse-design-portfolio"));
    const crossVersion = await fixtureJson("reverse-design-portfolio");
    crossVersion.analysisScope.sourceAccess[0].buildVersion = "1.5.0";
    const rejected = await validateCareerScenario(path.join(fixtureRoot, "reverse-design-portfolio"), {
      resultOverride: crossVersion,
    });
    const futureObservation = await fixtureJson("reverse-design-portfolio");
    setReverseObservationDate(futureObservation, "2099-12-31");
    const futureRejected = await validateCareerScenario(path.join(fixtureRoot, "reverse-design-portfolio"), {
      resultOverride: futureObservation,
    });

    assert.equal(reverseResult.ok, true, messages(reverseResult));
    assert.equal(rejected.ok, false);
    assert.ok(rejected.errors.some(({ code }) => code === "reverse.analysis-scope"), messages(rejected));
    assert.equal(futureRejected.ok, false);
    assert.ok(futureRejected.errors.some(({ code }) => code === "reverse.analysis-date"), messages(futureRejected));
    assert.equal(build.files.includes("skills/orchestrate-game-design-career/scripts/validate-career-scenario.mjs"), true);
  } finally {
    await rm(stagingRoot, { recursive: true, force: true });
  }
});

test("scenario CLI runs through canonical, relative, tmp-alias, and symlink paths with normalized output", async () => {
  const tempBase = process.platform === "darwin" ? "/tmp" : os.tmpdir();
  const stagingRoot = await mkdtemp(path.join(tempBase, "career-e2e-cli-"));
  try {
    const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
    const build = await buildProduct({ repoRoot, productName: "game-design-career", stagingRoot, sourceDateEpoch: 0 });
    const relativeScript = "skills/orchestrate-game-design-career/scripts/validate-career-scenario.mjs";
    const tmpAliasScript = path.join(build.outputDir, relativeScript);
    const canonicalScript = await realpath(tmpAliasScript);
    const ancestorAlias = path.join(stagingRoot, "linked-build");
    await symlink(build.outputDir, ancestorAlias, "dir");
    const ancestorScript = path.join(ancestorAlias, relativeScript);
    const fileAlias = path.join(stagingRoot, "validate-career-scenario-link.mjs");
    await symlink(canonicalScript, fileAlias);
    const sourceScript = fileURLToPath(runnerUrl);
    const fixture = path.join(fixtureRoot, "reverse-design-portfolio");
    const modes = [
      ["source-direct", sourceScript, repoRoot],
      ["source-relative", path.relative(repoRoot, sourceScript), repoRoot],
      ["built-canonical", canonicalScript, repoRoot],
      ["built-relative", relativeScript, build.outputDir],
      ["built-tmp-alias", tmpAliasScript, repoRoot],
      ["built-symlink-ancestor", ancestorScript, repoRoot],
      ["built-symlink-file", fileAlias, repoRoot],
    ];
    for (const [label, script, cwd] of modes) {
      const run = spawnSync(process.execPath, [script, fixture], { cwd, encoding: "utf8" });
      assert.equal(run.status, 0, `${label}: ${run.stderr}`);
      assert.equal(run.stderr, "", label);
      assert.ok(run.stdout.trim(), `${label}: missing JSON output`);
      assert.equal(JSON.parse(run.stdout).ok, true, label);
    }

    for (const [label, args, expectedStatus] of [
      ["missing", [], 2],
      ["extra", [fixture, "unexpected"], 2],
      ["invalid", [path.join(stagingRoot, "missing-fixture")], 1],
    ]) {
      const run = spawnSync(process.execPath, [tmpAliasScript, ...args], { encoding: "utf8" });
      assert.equal(run.status, expectedStatus, `${label}: ${run.stderr}`);
      assert.equal(run.stdout, "", label);
      const error = JSON.parse(run.stderr);
      assert.equal(error.ok, false, label);
      assert.ok(error.errors.length > 0, label);
    }
  } finally {
    await rm(stagingRoot, { recursive: true, force: true });
  }
});

test("packaged canonical validator CLI runs through tmp and symlink paths without silent success", async () => {
  const tempBase = process.platform === "darwin" ? "/tmp" : os.tmpdir();
  const stagingRoot = await mkdtemp(path.join(tempBase, "career-artifact-cli-"));
  try {
    const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
    const build = await buildProduct({ repoRoot, productName: "game-design-career", stagingRoot, sourceDateEpoch: 0 });
    const relativeScript = "scripts/validate-artifact.mjs";
    const tmpAliasScript = path.join(build.outputDir, relativeScript);
    const canonicalScript = await realpath(tmpAliasScript);
    const ancestorAlias = path.join(stagingRoot, "linked-build");
    await symlink(build.outputDir, ancestorAlias, "dir");
    const fileAlias = path.join(stagingRoot, "validate-artifact-link.mjs");
    await symlink(canonicalScript, fileAlias);
    const artifact = path.join(build.outputDir, "assets/templates/reverse-design-document");
    const sourceScript = path.join(repoRoot, "shared/scripts/validate-artifact.mjs");
    for (const [label, script, cwd] of [
      ["source-direct", sourceScript, repoRoot],
      ["source-relative", path.relative(repoRoot, sourceScript), repoRoot],
      ["canonical", canonicalScript, repoRoot],
      ["relative", relativeScript, build.outputDir],
      ["tmp-alias", tmpAliasScript, repoRoot],
      ["symlink-ancestor", path.join(ancestorAlias, relativeScript), repoRoot],
      ["symlink-file", fileAlias, repoRoot],
    ]) {
      const run = spawnSync(process.execPath, [script, artifact], { cwd, encoding: "utf8" });
      assert.equal(run.status, 0, `${label}: ${run.stderr}`);
      assert.equal(run.stderr, "", label);
      assert.equal(JSON.parse(run.stdout).ok, true, label);
    }
    for (const [label, args, expectedStatus] of [
      ["missing", [], 2],
      ["invalid", [path.join(stagingRoot, "missing-artifact")], 1],
    ]) {
      const run = spawnSync(process.execPath, [tmpAliasScript, ...args], { encoding: "utf8" });
      assert.equal(run.status, expectedStatus, `${label}: ${run.stderr}`);
      assert.equal(run.stdout, "", label);
      assert.equal(JSON.parse(run.stderr).ok, false, label);
    }
  } finally {
    await rm(stagingRoot, { recursive: true, force: true });
  }
});

test("scenario results reject extra self-attestation fields and embedded user-manual prose", async () => {
  const entry = await fixtureJson("entry-12-week-roadmap");
  entry.actualSkillIds = ["map-game-design-career"];
  const entryResult = await validate("entry-12-week-roadmap", entry);
  assert.equal(entryResult.ok, false);
  assert.ok(entryResult.errors.some(({ code }) => code === "scenario.result-keys"), messages(entryResult));

  const reverse = await fixtureJson("reverse-design-portfolio");
  reverse.userManual = "Press the upgrade button, then confirm the purchase.";
  const reverseResult = await validate("reverse-design-portfolio", reverse);
  assert.equal(reverseResult.ok, false);
  assert.ok(reverseResult.errors.some(({ code }) => code === "scenario.result-keys"), messages(reverseResult));
});

test("reverse claims are unique and every surface is bound to a known evidence-bearing claim", async () => {
  const duplicate = await fixtureJson("reverse-design-portfolio");
  duplicate.claims[1].claimId = duplicate.claims[0].claimId;
  const duplicateResult = await validate("reverse-design-portfolio", duplicate);
  assert.equal(duplicateResult.ok, false);
  assert.ok(duplicateResult.errors.some(({ code }) => code === "reverse.claim-id"), messages(duplicateResult));

  const forged = await fixtureJson("reverse-design-portfolio");
  for (const surface of Object.keys(forged.surfaces)) forged.surfaces[surface] = ["forged-nonexistent-claim"];
  const forgedResult = await validate("reverse-design-portfolio", forged);
  assert.equal(forgedResult.ok, false);
  assert.ok(forgedResult.errors.some(({ code }) => code === "reverse.surface-reference"), messages(forgedResult));
});

test("entry role evidence is exact, nonempty, unique, and bound to the declared registry", async () => {
  for (const [label, mutate] of [
    ["empty", (result) => { result.roleCandidates[0].currentEvidenceIds = []; }],
    ["duplicate", (result) => { result.roleCandidates[0].currentEvidenceIds = ["entry-interest-systems", "entry-interest-systems"]; }],
    ["unknown", (result) => { result.roleCandidates[0].currentEvidenceIds = ["forged-evidence"]; }],
    ["extra", (result) => { result.roleCandidates[0].verified = true; }],
  ]) {
    const result = await fixtureJson("entry-12-week-roadmap");
    mutate(result);
    const validation = await validate("entry-12-week-roadmap", result);
    assert.equal(validation.ok, false, label);
    assert.ok(
      validation.errors.some(({ code }) => code.startsWith("entry.role-candidate")),
      `${label}: ${messages(validation)}`,
    );
  }
});

test("transition evidence and quarterly requirements cannot reference undeclared IDs", async () => {
  for (const [code, mutate] of [
    ["transition.project-impact-evidence", (result) => { result.projectImpact[0].evidenceIds = ["forged-evidence"]; }],
    ["transition.question-evidence", (result) => { result.questions[0].portfolioEvidenceIds = ["forged-evidence"]; }],
    ["transition.quarterly-requirement", (result) => { result.quarterlyPlan[0].requirementId = "forged-requirement"; }],
    ["transition.target-requirement", (result) => { result.targetRequirements[0].postingEvidenceId = "forged-posting"; }],
  ]) {
    const result = await fixtureJson("junior-transition");
    mutate(result);
    const validation = await validate("junior-transition", result);
    assert.equal(validation.ok, false, code);
    assert.ok(validation.errors.some((error) => error.code === code), messages(validation));
  }
});

test("job evidence applies the complete production schema and nested repeated-signal contract", async () => {
  const { validateJobEvidenceRecords } = await loadRunner();
  const baseline = await fixtureJson("junior-transition", "job-evidence.json");
  assert.equal((await validateJobEvidenceRecords(baseline, "2026-08-08")).valid, true);
  const missingTrustedSnapshot = await validateJobEvidenceRecords(baseline);
  assert.equal(missingTrustedSnapshot.valid, false);
  assert.ok(missingTrustedSnapshot.errors.some(({ code }) => code === "job.collection.missing-as-of-date"));
  const mutations = [
    ["sample geography string", (records) => { records[0].sampleGeography = "KR"; }],
    ["extra key", (records) => { records[0].verified = true; }],
    ["missing required", (records) => { delete records[0].retrievalDate; }],
    ["wrong array type", (records) => { records[0].responsibilities = "systems design"; }],
    ["nested extra key", (records) => { records[0].repeatedSignals = [{ signal: "systems", count: 2, denominator: 2, sourceIds: ["posting-transition-1", "posting-transition-2"], verified: true }]; }],
  ];

  for (const [label, mutate] of mutations) {
    const records = structuredClone(baseline);
    mutate(records);
    const validation = await validateJobEvidenceRecords(records, "2026-08-08");
    assert.equal(validation.valid, false, label);
    assert.ok(validation.errors.some(({ code }) => code === "job.schema"), `${label}: ${JSON.stringify(validation.errors)}`);
  }
});

test("reverse claims enforce the complete fact-inference schema", async () => {
  const invalidId = await fixtureJson("reverse-design-portfolio");
  const originalId = invalidId.claims[0].claimId;
  invalidId.claims[0].claimId = " invalid claim id ";
  for (const references of Object.values(invalidId.surfaces)) {
    for (let index = 0; index < references.length; index += 1) {
      if (references[index] === originalId) references[index] = " invalid claim id ";
    }
  }
  const invalidIdResult = await validate("reverse-design-portfolio", invalidId);
  assert.equal(invalidIdResult.ok, false);
  assert.ok(invalidIdResult.errors.some(({ code }) => code === "reverse.claim-schema"), messages(invalidIdResult));

  for (const [label, field] of [["counterexample", "counterexample"], ["alternative", "alternative"]]) {
    const malformed = await fixtureJson("reverse-design-portfolio");
    malformed.claims[0][field] = [null];
    const validation = await validate("reverse-design-portfolio", malformed);
    assert.equal(validation.ok, false, label);
    assert.ok(validation.errors.some(({ code }) => code === "reverse.claim-schema"), `${label}: ${messages(validation)}`);
  }
});

test("target requirements reproduce the exact referenced posting field item", async () => {
  const fabricated = await fixtureJson("junior-transition");
  fabricated.targetRequirements[0].statement = "Lead global live operations strategy.";
  const fabricatedResult = await validate("junior-transition", fabricated);
  assert.equal(fabricatedResult.ok, false);
  assert.ok(fabricatedResult.errors.some(({ code }) => code === "transition.target-requirement-source"), messages(fabricatedResult));

  const wrongAddress = await fixtureJson("junior-transition");
  wrongAddress.targetRequirements[0].sourceField = "preferredSkills";
  wrongAddress.targetRequirements[0].sourceIndex = 9;
  const wrongAddressResult = await validate("junior-transition", wrongAddress);
  assert.equal(wrongAddressResult.ok, false);
  assert.ok(wrongAddressResult.errors.some(({ code }) => code === "transition.target-requirement-source"), messages(wrongAddressResult));
});

test("reverse surface validation is independent of JSON property order", async () => {
  const reordered = await fixtureJson("reverse-design-portfolio");
  reordered.surfaces = Object.fromEntries(Object.entries(reordered.surfaces).reverse());
  const result = await validate("reverse-design-portfolio", reordered);

  assert.equal(result.ok, true, messages(result));
  assert.deepEqual(result.acceptance.reverseSurfaces, [
    "fact", "inference", "rules", "exceptions", "UI", "data", "economy", "operations", "alternatives", "validation",
  ]);
});

test("reverse analysis scope uses an exact typed contract", async () => {
  const mutations = [
    ["missing", (result) => { delete result.analysisScope; }],
    ["extra", (result) => { result.analysisScope.verified = true; }],
    ["wrong type", (result) => { result.analysisScope.sourceAccess = "all captures"; }],
    ["wrong field type", (result) => { result.analysisScope.platform = 42; }],
    ["missing source field", (result) => { delete result.analysisScope.sourceAccess[0].limitations; }],
    ["extra source field", (result) => { result.analysisScope.sourceAccess[0].verified = true; }],
    ["wrong source field type", (result) => { result.analysisScope.sourceAccess[0].observationDate = false; }],
    ["version", (result) => { result.analysisScope.buildVersion = "2.0.0"; }],
    ["region", (result) => { result.analysisScope.region = "GLOBAL"; }],
    ["date", (result) => { result.analysisScope.observationDate = "2026-02-30"; }],
  ];

  for (const [label, mutate] of mutations) {
    const result = await fixtureJson("reverse-design-portfolio");
    mutate(result);
    const validation = await validate("reverse-design-portfolio", result);
    assert.equal(validation.ok, false, label);
    assert.ok(
      validation.errors.some(({ code }) => ["scenario.result-keys", "reverse.analysis-scope"].includes(code)),
      `${label}: ${messages(validation)}`,
    );
  }
});

test("reverse observation dates cannot exceed the trusted scenario snapshot", async () => {
  const equalityBoundary = await fixtureJson("reverse-design-portfolio");
  setReverseObservationDate(equalityBoundary, "2026-08-06");
  const equalityValidation = await validate("reverse-design-portfolio", equalityBoundary);
  assert.equal(equalityValidation.ok, true, messages(equalityValidation));

  const attacks = [
    ["future observation", (result) => { setReverseObservationDate(result, "2099-12-31"); }],
    ["self-attested future snapshot", (result) => {
      result.asOfDate = "2099-12-31";
      setReverseObservationDate(result, "2099-12-31");
    }],
    ["missing snapshot", (result) => {
      delete result.asOfDate;
      setReverseObservationDate(result, "2099-12-31");
    }],
    ["cross-scenario snapshot", (result) => {
      result.asOfDate = "2026-08-08";
      setReverseObservationDate(result, "2026-08-08");
    }],
  ];

  for (const [label, mutate] of attacks) {
    const result = await fixtureJson("reverse-design-portfolio");
    mutate(result);
    const validation = await validate("reverse-design-portfolio", result);
    assert.equal(validation.ok, false, label);
    assert.ok(validation.errors.some(({ code }) => code === "reverse.analysis-date"), `${label}: ${messages(validation)}`);
  }

  const stagingRoot = await mkdtemp(path.join(os.tmpdir(), "career-reverse-as-of-"));
  try {
    for (const [label, assertedDate] of [
      ["missing request and result snapshot", null],
      ["matching self-attested future snapshot", "2099-12-31"],
      ["matching cross-scenario snapshot", "2026-08-08"],
    ]) {
      const fixture = path.join(stagingRoot, label.replaceAll(" ", "-"));
      await cp(path.join(fixtureRoot, "reverse-design-portfolio"), fixture, { recursive: true });
      const request = JSON.parse(await readFile(path.join(fixture, "request.json"), "utf8"));
      const result = JSON.parse(await readFile(path.join(fixture, "result.json"), "utf8"));
      if (assertedDate === null) {
        delete request.asOfDate;
        delete result.asOfDate;
        setReverseObservationDate(result, "2099-12-31");
      } else {
        request.asOfDate = assertedDate;
        result.asOfDate = assertedDate;
        setReverseObservationDate(result, assertedDate);
      }
      await writeFile(path.join(fixture, "request.json"), `${JSON.stringify(request, null, 2)}\n`, "utf8");
      await writeFile(path.join(fixture, "result.json"), `${JSON.stringify(result, null, 2)}\n`, "utf8");
      const { validateCareerScenario } = await loadRunner();
      const validation = await validateCareerScenario(fixture);
      assert.equal(validation.ok, false, label);
      assert.ok(validation.errors.some(({ code }) => code === "route.as-of-date"), `${label}: ${messages(validation)}`);
      assert.ok(validation.errors.some(({ code }) => code === "reverse.analysis-date"), `${label}: ${messages(validation)}`);
    }
  } finally {
    await rm(stagingRoot, { recursive: true, force: true });
  }
});

test("every reverse observation is bound to one declared source in the same build and scope", async () => {
  const attacks = [
    ["unknown address", "reverse.observation-scope", (result) => { result.claims[0].observation[0].sourceAddress = "capture:undeclared"; }],
    ["scope mismatch", "reverse.observation-scope", (result) => { result.claims[0].observation[0].scope = "all platforms and regions"; }],
    ["cross version", "reverse.analysis-scope", (result) => { result.analysisScope.sourceAccess[0].buildVersion = "1.5.0"; }],
    ["cross platform", "reverse.analysis-scope", (result) => { result.analysisScope.sourceAccess[0].platform = "Mobile"; }],
    ["cross region", "reverse.analysis-scope", (result) => { result.analysisScope.sourceAccess[0].region = "US"; }],
    ["cross account state", "reverse.analysis-scope", (result) => { result.analysisScope.sourceAccess[0].accountOrPlayerState = "Fresh account"; }],
    ["cross observation date", "reverse.analysis-scope", (result) => { result.analysisScope.sourceAccess[0].observationDate = "2026-08-05"; }],
    ["cross-version generalization", "reverse.analysis-scope", (result) => {
      result.analysisScope.sourceAccess[0].scope = "all builds";
      result.claims[0].observation[0].scope = "all builds";
    }],
    ["source type mismatch", "reverse.observation-scope", (result) => { result.analysisScope.sourceAccess[0].sourceType = "cited-material"; }],
  ];

  for (const [label, expectedCode, mutate] of attacks) {
    const result = await fixtureJson("reverse-design-portfolio");
    mutate(result);
    const validation = await validate("reverse-design-portfolio", result);
    assert.equal(validation.ok, false, label);
    assert.ok(validation.errors.some(({ code }) => code === expectedCode), `${label}: ${messages(validation)}`);
  }
});

test("clean-built Career plugin performs prompt-only image planning without a provider or source dependency", async () => {
  const stagingRoot = await mkdtemp(path.join(os.tmpdir(), "career-e2e-image-plan-"));
  const artifactRoot = path.join(stagingRoot, "artifact");
  try {
    const build = await buildProduct({ repoRoot: fileURLToPath(new URL("../../..", import.meta.url)), productName: "game-design-career", stagingRoot, sourceDateEpoch: 0 });
    await mkdir(artifactRoot);
    const workflowPath = path.join(build.outputDir, "scripts/run-image-asset-workflow.mjs");
    const source = await readFile(workflowPath, "utf8");
    assert.doesNotMatch(source, /(?:\.\.\/)+(?:shared|products)\//u);
    const { runImageAssetWorkflow } = await import(`${pathToFileURL(workflowPath).href}?prompt-only=${Date.now()}`);
    let hostCalls = 0;
    let openAiCalls = 0;
    const result = await runImageAssetWorkflow({
      artifactRoot,
      artifact: { artifact_id: "career-e2e-image", image_needs: [{ slot_id: "hero", type: "character", scene: "A neutral scene.", subject: "An original silhouette.", composition: "Centered.", visual_style: "Original illustration.", readability: "Readable.", width: 1024, height: 1024 }] },
      qualityProfile: { profile_id: "career-e2e-image", version: 1, artifact_types: ["design-document"], audiences: ["design"], required_sections: [{ id: "visuals", title: "Visuals" }], required_tables: [{ id: "visual-table", section_id: "visuals", columns: ["Signal"] }], required_diagrams: [{ id: "diagram", section_id: "visuals", purpose: "Explain visual intent.", alt_text: "Visual diagram." }], required_images: [{ id: "hero", section_id: "visuals", purpose: "Explain visual intent.", alt_text: "Visual planning placeholder." }], recommended_images: [], length_guidance: { min_words: 1, max_words: 10 }, ppt_story_contract: {}, acceptance_criteria: ["Readable"], export_rules: { required_formats: ["md"], forbidden_formats: [] }, quality_checks: ["visual"] },
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
