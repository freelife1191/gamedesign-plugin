import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
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

test("clean-built plugin runs the same scenario contract without repository-only imports", async () => {
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
    const result = await validateCareerScenario(path.join(fixtureRoot, "entry-12-week-roadmap"));

    assert.equal(result.ok, true, messages(result));
    assert.equal(build.files.includes("skills/orchestrate-game-design-career/scripts/validate-career-scenario.mjs"), true);
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
    const validation = await validateJobEvidenceRecords(records);
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
