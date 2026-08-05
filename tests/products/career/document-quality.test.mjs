import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const pluginRoot = path.join(repoRoot, "products/game-design-career/plugin");
const skillRoot = path.join(pluginRoot, "skills/apply-document-quality-profile");

async function read(relativePath) {
  return readFile(path.join(pluginRoot, relativePath), "utf8");
}

async function readContract() {
  const skill = await read("skills/apply-document-quality-profile/SKILL.md");
  const match = skill.match(/<!-- document-quality-contract:start -->\s*```json\s*([\s\S]*?)\s*```\s*<!-- document-quality-contract:end -->/u);
  assert.ok(match, "document quality contract");
  return { skill, contract: JSON.parse(match[1]) };
}

test("Career quality skill exposes trigger-only metadata and valid UI metadata", async () => {
  const [skill, openai] = await Promise.all([
    read("skills/apply-document-quality-profile/SKILL.md"),
    readFile(path.join(skillRoot, "agents/openai.yaml"), "utf8"),
  ]);
  const frontmatter = skill.match(/^---\n([\s\S]*?)\n---/u)?.[1];
  assert.ok(frontmatter);
  assert.deepEqual(frontmatter.split("\n").map((line) => line.split(":", 1)[0]), ["name", "description"]);
  assert.match(frontmatter, /^name: apply-document-quality-profile$/mu);
  assert.match(frontmatter, /^description: Use when /mu);
  assert.match(openai, /^interface:\n  display_name: "Apply Document Quality Profile"\n  short_description: "[^"]{25,64}"\n  default_prompt: "Use \$apply-document-quality-profile [^"]+"\n$/u);
});

test("Career selection uses its own namespace, deterministic precedence, and explicit fallback records", async () => {
  const { contract } = await readContract();
  assert.equal(contract.product, "game-design-career");
  assert.equal(contract.primaryNamespace, "profiles/career");
  assert.deepEqual(contract.selection.inputs, ["goal", "audience", "artifactType", "requestedFormat"]);
  assert.deepEqual(contract.selection.precedence, [
    "known-explicit-override", "compatible-template-map-match", "artifact-type-match", "requested-format-match",
    "audience-overlap", "goal-overlap", "profile-id-lexical",
  ]);
  assert.equal(contract.selection.primaryCount, 1);
  assert.equal(contract.selection.incompatibleDeliverables, "separate-selection-records");
  assert.deepEqual(contract.selection.unknownOverride.report, ["requestedProfileId", "nearestProfileId", "differences"]);
  assert.equal(contract.selection.unknownOverride.selected, false);
  assert.equal(contract.selection.unknownOverride.fallbackRequiresExplicitRecord, true);
});

test("Career skill composes only additive known sources and loads a bounded packaged subset", async () => {
  const { contract, skill } = await readContract();
  assert.deepEqual(contract.composition.reject, ["removal", "identity-leakage", "scalar-contradiction", "unknown-id", "schema-invalid"]);
  assert.equal(contract.composition.maxPresets, 1);
  assert.deepEqual(contract.progressiveLoading.afterSelection, ["selected-primary", "requested-overlays", "optional-preset", "relevant-render-contract", "product-template-map"]);
  assert.deepEqual(contract.progressiveLoading.forbidden, ["bulk-catalog-load", "authoring-evidence"]);
  assert.match(skill, /references\/shared\/document-quality\//u);
  assert.doesNotMatch(skill, /authoring\/reference-preset-evidence-map\.json/u);
});

test("Career checklist, Skillstead slots, status transitions, and approval boundaries are exact", async () => {
  const { contract } = await readContract();
  assert.deepEqual(contract.output.checklist, ["sections", "tables", "diagrams", "images", "acceptanceCriteria"]);
  assert.equal(contract.output.stableIdsRequired, true);
  assert.equal(contract.output.diagrams, "skillstead-compatible-slots-unverified-until-render-qa");
  assert.deepEqual(contract.states, ["draft", "structurally-complete", "evidence-reviewed", "visual-reviewed", "document-approved"]);
  assert.deepEqual(contract.structuralBlockers, ["sections", "tables", "diagrams", "images", "acceptanceCriteria"]);
  assert.deepEqual(contract.neverAutoApproveFrom, ["generated-image", "rendered-file", "requested-diagram", "self-attestation"]);
  assert.deepEqual(contract.preservedGates, ["evidence", "image-rights", "human-approval", "renderer-qa", "responsible-design", "release"]);
});

test("Career quality editor has stable findings and no approval authority", async () => {
  const role = await read("agents/document-quality-editor.md");
  for (const field of ["findingId", "stableSectionOrSlotId", "evidence", "impact", "minimalRepair"]) {
    assert.match(role, new RegExp(`\\| \\x60${field}\\x60 \\|`, "u"), field);
  }
  assert.match(role, /document structure.*checklist coverage.*PPT\/story contract/isu);
  assert.match(role, /must not grant.*evidence.*visual.*rights.*production.*release.*document approval/isu);
  assert.match(role, /does not replace.*domain reviewer/iu);
});

test("Career routing inserts quality application before content and preserves review limits and merge order", async () => {
  const [routing, stages, orchestrator, gates] = await Promise.all([
    read("references/routing.json").then(JSON.parse),
    read("references/career-stages.json").then(JSON.parse),
    read("skills/orchestrate-game-design-career/SKILL.md"),
    read("references/completion-gates.md"),
  ]);
  assert.deepEqual(routing.qualityWorkflow, {
    skill: "apply-document-quality-profile",
    role: "document-quality-editor",
    placement: "before-content-generation-and-asset-planning",
    templateMap: "references/document-quality/template-profile-map.json",
    profileRoot: "references/shared/document-quality/profiles/career",
    profileIds: [
      "career-stage-role-map", "competency-matrix", "game-analysis-report", "interview-question-answer-report",
      "job-posting-evidence", "junior-growth-review", "learning-roadmap", "portfolio-case-study",
      "portfolio-project-brief", "portfolio-review-backlog", "recruiter-portfolio-presentation",
      "reverse-design-document", "transition-readiness",
    ],
  });
  assert.equal(stages.preGenerationSkill, "apply-document-quality-profile");
  assert.ok(routing.routes.every(({ roles }) => roles.length <= 3));
  assert.deepEqual(stages.reviewDispatch.mergeKeys, ["severity", "evidence-gap-id", "artifact-section-id", "role-priority"]);
  assert.match(orchestrator, /apply-document-quality-profile.*before content generation and asset planning/isu);
  assert.match(gates, /draft.*structurally-complete.*evidence-reviewed.*visual-reviewed.*document-approved/isu);
  assert.match(gates, /generated images?.*rendered files?.*do not.*approval/isu);
});
