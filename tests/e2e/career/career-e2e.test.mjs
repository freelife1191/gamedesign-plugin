import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
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
