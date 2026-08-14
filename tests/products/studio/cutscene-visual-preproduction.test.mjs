import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { validateQualityProfile } from "../../../shared/scripts/validate-quality-profile.mjs";
import { buildProduct } from "../../../tooling/lib/build-product.mjs";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const studioRoot = path.join(repoRoot, "products/game-design-studio/plugin");
const careerRoot = path.join(repoRoot, "products/game-design-career/plugin");
const skillRoot = path.join(studioRoot, "skills/design-cutscene-visual-preproduction");
const waves = ["style-master", "reference-masters", "keyframes", "storyboard"];

test("Studio route has the closed cutscene workflow contract while Career exposes neither route nor skill", async () => {
  const [routing, careerRouting] = await Promise.all([
    readFile(path.join(studioRoot, "references/routing.json"), "utf8").then(JSON.parse),
    readFile(path.join(careerRoot, "references/routing.json"), "utf8").then(JSON.parse),
  ]);
  const route = routing.routes.find(({ id }) => id === "cutscene-visual-preproduction");
  assert.equal(routing.routes.length, 14);
  assert.equal(routing.skillIds.length, 23);
  assert.deepEqual(route, {
    artifactType: "cutscene-visual-preproduction",
    completionGates: ["cutscene-continuity-current"],
    defaultReviewers: ["content-narrative-designer", "lead-game-designer"],
    eligibleProfiles: ["live-service-rpg", "mobile", "pc-console"],
    id: "cutscene-visual-preproduction",
    maxReviewers: 3,
    references: ["references/methods/content-specification.md"],
    requiredInputs: ["cutscene brief", "game-state return"],
    skill: "design-cutscene-visual-preproduction",
    triggerIntents: ["컷씬 기획", "스토리보드", "시네마틱 이미지", "마스터 이미지", "컷씬 프롬프트"],
    outputArtifacts: ["cutscene-brief", "cutscene-shot-package", "cutscene-prompt-package", "cutscene-cost-estimate", "cutscene-continuity-review"],
    outputTypes: ["cutscene-visual-preproduction"],
  });
  assert.deepEqual(routing.cutsceneWorkflow, { schemaVersion: 1, waves, downstream: ["plan-image-assets", "generate-image-assets", "review-image-assets"], approval: "stage-by-stage-live-host-user" });
  assert.deepEqual(routing.skillIds.filter((id) => id === "design-cutscene-visual-preproduction"), ["design-cutscene-visual-preproduction"]);
  assert.deepEqual(routing.plannedPaths.skills.filter((value) => value === "skills/design-cutscene-visual-preproduction/SKILL.md"), ["skills/design-cutscene-visual-preproduction/SKILL.md"]);
  assert.equal(careerRouting.skillIds.includes("design-cutscene-visual-preproduction"), false);
  assert.equal(careerRouting.routes.some(({ id }) => id === "cutscene-visual-preproduction"), false);
  assert.equal(existsSync(path.join(careerRoot, "skills/design-cutscene-visual-preproduction")), false);
});

test("cutscene skill makes each mode and paid-wave gate explicit under pressure", async () => {
  const [skill, openai] = await Promise.all([
    readFile(path.join(skillRoot, "SKILL.md"), "utf8"),
    readFile(path.join(skillRoot, "agents/openai.yaml"), "utf8"),
  ]);
  const frontmatter = skill.match(/^---\n([\s\S]*?)\n---/u)?.[1];
  assert.ok(frontmatter);
  assert.deepEqual(frontmatter.split("\n").map((line) => line.split(":", 1)[0]), ["name", "description"]);
  assert.match(frontmatter, /^name: design-cutscene-visual-preproduction$/mu);
  assert.match(frontmatter, /^description: Use when .*컷씬.*시네마틱.*스토리보드.*master image.*prompt.*continuity/mu);
  assert.match(openai, /^interface:\n  display_name: "[^"]+"\n  short_description: "[^"]{25,64}"\n  default_prompt: "Use \$design-cutscene-visual-preproduction [^"]+"\n$/u);
  for (const phrase of [
    "Prompt Only", "Estimate Only", "Generate After Approval", "provider calls: 0", "USD 0",
    "minimum", "expected", "maximum", "costStatus", "finite ceiling", "approval-pending",
    "current exact", "named live host-user approval", "previous or general approval does not carry",
    "style-master", "reference-masters", "keyframes", "storyboard", "per-wave estimate", "per-wave approval",
    "partial success", "latest retryable failed stable IDs", "terminal failure", "continuity gate",
    "document-approved", "production-candidate", "dialogue-only", "no image", "no provider", "no approval",
    "new derivative IDs", "planner", "never overwrite base",
  ]) assert.match(skill, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "iu"), phrase);
});

test("cutscene handoffs preserve existing authorities instead of recreating a general-image bypass", async () => {
  const [content, plan, generate, review] = await Promise.all([
    readFile(path.join(studioRoot, "skills/design-game-content/SKILL.md"), "utf8"),
    readFile(path.join(studioRoot, "skills/plan-image-assets/SKILL.md"), "utf8"),
    readFile(path.join(studioRoot, "skills/generate-image-assets/SKILL.md"), "utf8"),
    readFile(path.join(studioRoot, "skills/review-image-assets/SKILL.md"), "utf8"),
  ]);
  assert.match(content, /design-cutscene-visual-preproduction/u);
  assert.match(plan, /validateCutsceneManifestHandoff\(\{manifest\}\)/u);
  assert.match(plan, /sole authority/u);
  assert.match(plan, /Do not call the general image planner/u);
  assert.match(generate, /run-approved-cutscene-image-stage|design-cutscene-visual-preproduction/u);
  assert.match(generate, /current wave.*approval|approval.*current wave/isu);
  assert.match(review, /review-cutscene-continuity|design-cutscene-visual-preproduction/u);
  assert.match(review, /continuity.*document-approved|document-approved.*continuity/isu);
});

test("cutscene document-quality profile is indexed and structurally valid", async () => {
  const [index, profile] = await Promise.all([
    readFile(path.join(repoRoot, "shared/document-quality/indexes/studio.json"), "utf8").then(JSON.parse),
    readFile(path.join(repoRoot, "shared/document-quality/profiles/studio/cutscene-visual-preproduction.json"), "utf8").then(JSON.parse),
  ]);
  assert.equal(index.profiles.some(({ profile_id }) => profile_id === "cutscene-visual-preproduction"), true);
  assert.equal(profile.profile_id, "cutscene-visual-preproduction");
  assert.deepEqual(validateQualityProfile(profile, { sourceName: profile.profile_id }), { ok: true, errors: [] });
  assert.ok(profile.quality_checks.includes("cutscene-continuity"));
});

test("temporary Studio and Career packages retain byte-identical shared cutscene runtime and schemas", async (t) => {
  const stagingRoot = await mkdtemp(path.join(os.tmpdir(), "cutscene-package-parity-"));
  t.after(() => rm(stagingRoot, { recursive: true, force: true }));
  const [studio, career] = await Promise.all([
    buildProduct({ repoRoot, productName: "game-design-studio", stagingRoot, sourceDateEpoch: 0 }),
    buildProduct({ repoRoot, productName: "game-design-career", stagingRoot, sourceDateEpoch: 0 }),
  ]);
  const runtimeFiles = [
    "plan-cutscene-visual-preproduction.mjs",
    "estimate-cutscene-image-cost.mjs",
    "run-approved-cutscene-image-stage.mjs",
    "review-cutscene-continuity.mjs",
    "validate-cutscene-visual-preproduction.mjs",
  ];
  const schemaFiles = [
    "cutscene-visual-plan.schema.json",
    "cutscene-cost-estimate.schema.json",
    "cutscene-generation-approval.schema.json",
    "cutscene-generation-usage.schema.json",
    "cutscene-continuity-review.schema.json",
  ];
  for (const relative of runtimeFiles.map((name) => `scripts/${name}`).concat(schemaFiles.map((name) => `references/shared/image-assets/schema/${name}`))) {
    const [studioBytes, careerBytes] = await Promise.all([
      readFile(path.join(studio.outputDir, relative)),
      readFile(path.join(career.outputDir, relative)),
    ]);
    assert.deepEqual(studioBytes, careerBytes, relative);
  }
  assert.equal(existsSync(path.join(studio.outputDir, "skills/design-cutscene-visual-preproduction/SKILL.md")), true);
  assert.equal(existsSync(path.join(career.outputDir, "skills/design-cutscene-visual-preproduction/SKILL.md")), false);
});
