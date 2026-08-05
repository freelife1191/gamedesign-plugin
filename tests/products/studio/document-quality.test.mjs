import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

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
  assert.deepEqual(contract.selection.scoreTuple, ["templateMatch", "artifactTypeMatch", "formatMatch", "audienceOverlap", "goalOverlap"]);
  assert.equal(contract.selection.indexPath, "../../references/shared/document-quality/indexes/studio.json");
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
  assert.equal(contract.composition.presetMode, "validated-separate-guidance");
  assert.equal(contract.composition.overlays, "known-additive-only");
  assert.deepEqual(contract.composition.upperApply, {
    overlays: "closed-overlayIds-only",
    preset: "closed-neutral-presetId-or-null",
    loader: "packaged-pluginRoot-exact-non-symlink-paths",
    sourceBodies: "canonical-version-semantic-and-raw-byte-digest-bound",
    rawObjects: "rejected",
    scalarConflicts: "fail-closed",
  });
  assert.deepEqual(contract.composition.reject, ["removal", "identity-leakage", "scalar-contradiction", "unknown-id", "schema-invalid"]);
  assert.deepEqual(contract.progressiveLoading.preSelection, ["profile-id-index", "product-template-map"]);
  assert.deepEqual(contract.progressiveLoading.unknownComparison, ["nearest-profile-body"]);
  assert.deepEqual(contract.progressiveLoading.postSelection, [
    "selected-primary",
    "requested-overlays",
    "optional-neutral-preset",
    "relevant-render-contract",
    "selection-and-profile-schemas",
  ]);
  assert.deepEqual(contract.progressiveLoading.forbidden, ["bulk-catalog-load", "authoring-evidence"]);
  assert.match(skill, /references\/shared\/document-quality\//u);
  assert.doesNotMatch(skill, /authoring\/reference-preset-evidence-map\.json/u);
});

test("Studio output checklist and state machine preserve every quality and approval gate", async () => {
  const { contract } = await readContract();
  assert.deepEqual(contract.output.selectionRecord, [
    "artifactId", "goal", "audience", "artifactType", "requestedFormat", "primaryProfileId",
    "overlayIds", "presetId", "renderContractId", "templateId", "selectionReason", "score", "tieBreak", "fallbackRecord",
  ]);
  assert.deepEqual(contract.output.checklist, ["sections", "tables", "diagrams", "images", "acceptanceCriteria"]);
  assert.equal(contract.output.stableIdsRequired, true);
  assert.equal(contract.output.acceptanceIdRule, "source-id-plus-normalized-sha256-16");
  assert.equal(contract.output.diagrams, "skillstead-compatible-slots-unverified-until-render-qa");
  assert.deepEqual(contract.output.requirementManifest, ["schemaVersion", "sourceBindings", "contractDigest", "checklistDigest", "requiredItemIds", "manifestDigest"]);
  assert.deepEqual(contract.stateEnvelope, {
    binding: ["artifactDigest", "manifestDigest", "contractDigest", "checklistDigest"],
    receipts: "exact-ordered-cumulative-revalidated",
    callerStateStrings: "rejected",
  });
  assert.equal(contract.structuralCompletion, "external-artifact-inspection-receipt-only");
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
  for (const field of ["findingId", "role", "severity", "affectedSectionId", "findingType", "summary", "evidenceIds", "impact", "assumptions", "applicableGate", "minimalFix"]) {
    assert.match(role, new RegExp(`\\| \\x60${field}\\x60 \\|`, "u"), field);
  }
  assert.match(role, /document structure.*checklist coverage.*PPT\/story contract/isu);
  assert.match(role, /must not grant.*evidence.*visual.*rights.*production.*release.*document approval/isu);
  assert.match(role, /does not replace.*domain reviewer/iu);
});

test("Studio editor finding is accepted by the real merger API and CLI without blocker authority", async () => {
  const mergerPath = path.join(pluginRoot, "skills/orchestrate-game-design-project/scripts/merge-role-findings.mjs");
  const { mergeRoleFindings } = await import(`${pathToFileURL(mergerPath).href}?quality=${Date.now()}`);
  const finding = {
    findingId: "quality-structure-1",
    role: "document-quality-editor",
    severity: "high",
    affectedSectionId: "skillstead-gdd-dependency-diagram",
    findingType: "missing-diagram-slot",
    summary: "The required diagram slot is absent.",
    evidenceIds: ["quality-checklist-1"],
    impact: "The dependency decision cannot be reviewed.",
    assumptions: ["The selected profile is current."],
    applicableGate: "none",
    minimalFix: "Add the declared diagram slot without claiming render approval.",
  };
  const input = { schemaVersion: 1, findings: [finding] };
  assert.equal(mergeRoleFindings(input).findings[0].role, "document-quality-editor");
  assert.throws(() => mergeRoleFindings({ schemaVersion: 1, findings: [{ ...finding, severity: "blocker" }] }), /blocker authority/i);
  const cli = spawnSync(process.execPath, [mergerPath], { input: JSON.stringify(input), encoding: "utf8" });
  assert.equal(cli.status, 0, cli.stderr);
  assert.equal(JSON.parse(cli.stdout).findings[0].affectedSectionId, finding.affectedSectionId);
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
  assert.match(gates, /state envelope.*artifact-inspection.*receipt/isu);
  assert.match(gates, /generated images?.*rendered files?.*do not.*approval/isu);
});
