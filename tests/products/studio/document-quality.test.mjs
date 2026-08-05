import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const pluginRoot = path.join(repoRoot, "products/game-design-studio/plugin");
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

test("Studio quality skill exposes trigger-only metadata and valid UI metadata", async () => {
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

test("Studio selection is one-primary deterministic and reports unknown overrides without selecting them", async () => {
  const { contract } = await readContract();
  assert.equal(contract.product, "game-design-studio");
  assert.equal(contract.primaryNamespace, "profiles/studio");
  assert.deepEqual(contract.selection.inputs, ["goal", "audience", "artifactType", "requestedFormat"]);
  assert.deepEqual(contract.selection.precedence, [
    "known-explicit-override",
    "compatible-template-map-match",
    "artifact-type-match",
    "requested-format-match",
    "audience-overlap",
    "goal-overlap",
    "profile-id-lexical",
  ]);
  assert.equal(contract.selection.primaryCount, 1);
  assert.deepEqual(contract.selection.unknownOverride, {
    selected: false,
    nearestTieBreak: "profile-id-lexical",
    report: ["requestedProfileId", "nearestProfileId", "differences"],
    fallbackRequiresExplicitRecord: true,
  });
  assert.equal(contract.selection.incompatibleDeliverables, "separate-selection-records");
});

test("Studio composition and progressive loading fail closed", async () => {
  const { contract, skill } = await readContract();
  assert.equal(contract.composition.maxPresets, 1);
  assert.equal(contract.composition.overlays, "known-additive-only");
  assert.deepEqual(contract.composition.reject, ["removal", "identity-leakage", "scalar-contradiction", "unknown-id", "schema-invalid"]);
  assert.deepEqual(contract.progressiveLoading.afterSelection, [
    "selected-primary",
    "requested-overlays",
    "optional-preset",
    "relevant-render-contract",
    "product-template-map",
  ]);
  assert.deepEqual(contract.progressiveLoading.forbidden, ["bulk-catalog-load", "authoring-evidence"]);
  assert.match(skill, /references\/shared\/document-quality\//u);
  assert.doesNotMatch(skill, /authoring\/reference-preset-evidence-map\.json/u);
});

test("Studio output checklist and state machine preserve every quality and approval gate", async () => {
  const { contract } = await readContract();
  assert.deepEqual(contract.output.selectionRecord, [
    "artifactId", "goal", "audience", "artifactType", "requestedFormat", "primaryProfileId",
    "overlayIds", "presetId", "renderContractId", "templateId", "selectionReason", "fallbackRecord",
  ]);
  assert.deepEqual(contract.output.checklist, ["sections", "tables", "diagrams", "images", "acceptanceCriteria"]);
  assert.equal(contract.output.stableIdsRequired, true);
  assert.equal(contract.output.diagrams, "skillstead-compatible-slots-unverified-until-render-qa");
  assert.deepEqual(contract.states, ["draft", "structurally-complete", "evidence-reviewed", "visual-reviewed", "document-approved"]);
  assert.deepEqual(contract.structuralBlockers, ["sections", "tables", "diagrams", "images", "acceptanceCriteria"]);
  assert.deepEqual(contract.neverAutoApproveFrom, ["generated-image", "rendered-file", "requested-diagram", "self-attestation"]);
  assert.deepEqual(contract.preservedGates, ["evidence", "image-rights", "human-approval", "renderer-qa", "responsible-design", "release"]);
});

test("Studio quality editor emits bounded structural findings and cannot approve downstream gates", async () => {
  const role = await read("agents/document-quality-editor.md");
  for (const heading of ["Responsibility", "Required Evidence and Input", "Review Questions", "Scope", "Out of Scope", "Finding Schema", "Completion Signal"]) {
    assert.match(role, new RegExp(`^## ${heading}$`, "mu"), heading);
  }
  for (const field of ["findingId", "stableSectionOrSlotId", "evidence", "impact", "minimalRepair"]) {
    assert.match(role, new RegExp(`\\| \\x60${field}\\x60 \\|`, "u"), field);
  }
  assert.match(role, /document structure.*checklist coverage.*PPT\/story contract/isu);
  assert.match(role, /must not grant.*evidence.*visual.*rights.*production.*release.*document approval/isu);
  assert.match(role, /does not replace.*domain reviewer/iu);
});

test("Studio routing applies quality before generation without changing reviewer bounds", async () => {
  const [routing, orchestrator, gates] = await Promise.all([
    read("references/routing.json").then(JSON.parse),
    read("skills/orchestrate-game-design-project/SKILL.md"),
    read("skills/orchestrate-game-design-project/references/completion-gates.md"),
  ]);
  assert.deepEqual(routing.qualityWorkflow, {
    skill: "apply-document-quality-profile",
    role: "document-quality-editor",
    placement: "before-content-generation-and-asset-planning",
    templateMap: "references/document-quality/template-profile-map.json",
    profileRoot: "references/shared/document-quality/profiles/studio",
    profileIds: [
      "accessibility-platform-matrix", "character-skill-combat-monster-specification", "core-motivation-loop",
      "data-table-contract", "design-review-decision-log", "economy-balance-specification", "executive-pitch",
      "game-design-brief", "liveops-event-experiment-plan", "master-gdd", "narrative-quest-npc-specification",
      "playtest-metrics-report", "production-scope-milestone-risk-plan", "rule-state-exception-matrix",
      "system-feature-specification", "ui-ux-flow-state-specification", "vision-one-pager",
    ],
  });
  assert.ok(routing.routes.every(({ maxReviewers }) => maxReviewers <= 3));
  assert.match(orchestrator, /apply-document-quality-profile.*before content generation and asset planning/isu);
  assert.match(gates, /draft.*structurally-complete.*evidence-reviewed.*visual-reviewed.*document-approved/isu);
  assert.match(gates, /generated images?.*rendered files?.*do not.*approval/isu);
});
