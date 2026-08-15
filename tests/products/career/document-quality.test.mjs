import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as qualityWorkflow from "../../../shared/scripts/resolve-quality-profile.mjs";

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
  assert.deepEqual(contract.selection.scoreTuple, ["templateMatch", "artifactTypeMatch", "formatMatch", "audienceOverlap", "goalOverlap"]);
  assert.equal(contract.selection.indexPath, "../../references/shared/document-quality/indexes/career.json");
  assert.equal(contract.selection.incompatibleDeliverables, "separate-selection-records");
  assert.deepEqual(contract.selection.unknownOverride.report, ["requestedProfileId", "nearestProfileId", "differences"]);
  assert.equal(contract.selection.unknownOverride.selected, false);
  assert.equal(contract.selection.unknownOverride.fallbackRequiresExplicitRecord, true);
});

test("Career skill composes only additive known sources and loads a bounded packaged subset", async () => {
  const { contract, skill } = await readContract();
  assert.deepEqual(contract.composition.reject, ["removal", "identity-leakage", "scalar-contradiction", "unknown-id", "schema-invalid"]);
  assert.equal(contract.composition.maxPresets, 1);
  assert.equal(contract.composition.presetMode, "validated-separate-guidance");
  assert.deepEqual(contract.composition.upperApply, {
    overlays: "closed-overlayIds-only",
    preset: "closed-neutral-presetId-or-null",
    loader: "packaged-pluginRoot-exact-non-symlink-paths",
    sourceBodies: "canonical-version-semantic-and-raw-byte-digest-bound",
    rawObjects: "rejected",
    scalarConflicts: "fail-closed",
  });
  assert.deepEqual(contract.progressiveLoading.preSelection, ["profile-id-index", "product-template-map"]);
  assert.deepEqual(contract.progressiveLoading.unknownComparison, ["nearest-profile-body"]);
  assert.deepEqual(contract.progressiveLoading.postSelection, ["selected-primary", "requested-overlays", "optional-neutral-preset", "relevant-render-contract", "selection-and-profile-schemas"]);
  assert.deepEqual(contract.progressiveLoading.forbidden, ["bulk-catalog-load", "authoring-evidence"]);
  assert.match(skill, /references\/shared\/document-quality\//u);
  assert.doesNotMatch(skill, /authoring\/reference-preset-evidence-map\.json/u);
});

test("Career checklist, Skillstead slots, status transitions, and approval boundaries are exact", async () => {
  const { contract } = await readContract();
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

test("Career quality editor has stable findings and no approval authority", async () => {
  const role = await read("agents/document-quality-editor.md");
  for (const field of ["findingId", "role", "severity", "evidenceGapId", "artifactSectionId", "findingType", "summary", "evidenceIds", "minimumRepair"]) {
    assert.match(role, new RegExp(`\\| \\x60${field}\\x60 \\|`, "u"), field);
  }
  assert.match(role, /document structure.*checklist coverage.*PPT\/story contract/isu);
  assert.match(role, /must not grant.*evidence.*visual.*rights.*production.*release.*document approval/isu);
  assert.match(role, /does not replace.*domain reviewer/iu);
});

function careerQualityFinding(findingId = "quality-career-1") {
  return {
    findingId,
    role: "document-quality-editor",
    severity: "high",
    evidenceGapId: "quality-gap-1",
    artifactSectionId: "skillstead-reverse-system-loop-diagram",
    findingType: "missing-diagram-slot",
    summary: "The required diagram slot is absent.",
    evidenceIds: ["quality-checklist-1"],
    minimumRepair: "Add the declared diagram slot without claiming render approval.",
  };
}

test("Career editor finding is accepted by the real merger API and CLI", async () => {
  const mergerPath = path.join(pluginRoot, "skills/orchestrate-game-design-career/scripts/merge-role-findings.mjs");
  const { mergeRoleFindings } = await import(`${pathToFileURL(mergerPath).href}?quality=${Date.now()}`);
  const input = { schemaVersion: 1, findings: [careerQualityFinding()] };
  assert.equal(mergeRoleFindings(input).findings[0].role, "document-quality-editor");
  const cli = spawnSync(process.execPath, [mergerPath], { input: JSON.stringify(input), encoding: "utf8" });
  assert.equal(cli.status, 0, cli.stderr);
  assert.equal(JSON.parse(cli.stdout).findings[0].artifactSectionId, "skillstead-reverse-system-loop-diagram");

  const blocker = { schemaVersion: 1, findings: [{ ...careerQualityFinding("quality-blocker"), severity: "blocker" }] };
  assert.throws(() => mergeRoleFindings(blocker), /document-quality-editor.*blocker|severity authority/iu);
  const rejected = spawnSync(process.execPath, [mergerPath], { input: JSON.stringify(blocker), encoding: "utf8" });
  assert.notEqual(rejected.status, 0);
  assert.match(rejected.stderr, /document-quality-editor.*blocker|severity authority/iu);
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
  assert.deepEqual(stages.reviewDispatch.rolePriority.at(-1), "document-quality-editor");
  assert.deepEqual(stages.reviewDispatch.sequential.order, stages.reviewDispatch.rolePriority);
  assert.ok(stages.reviewDispatch.questionsByRole["document-quality-editor"].length > 0);
  assert.deepEqual(stages.reviewDispatch.qualityEditorPolicy, {
    role: "document-quality-editor",
    maxReviewers: 3,
    maxDomainReviewers: 2,
    allowedSeverities: ["high", "medium", "low"],
    requiredRoleSets: { "portfolio-review": ["portfolio-reviewer", "evidence-auditor"] },
  });
  assert.ok(routing.routes.every(({ roles }) => roles.length <= 3));
  assert.deepEqual(stages.reviewDispatch.mergeKeys, ["severity", "evidence-gap-id", "artifact-section-id", "role-priority"]);
  assert.match(orchestrator, /select the ordered skill chain, quality\/image work/isu);
  assert.match(gates, /draft.*structurally-complete.*evidence-reviewed.*visual-reviewed.*document-approved/isu);
  assert.match(gates, /state envelope.*artifact-inspection.*receipt/isu);
  assert.match(gates, /generated images?.*rendered files?.*do not.*approval/isu);
});

test("Career reviewer selection counts the editor in three and preserves portfolio required roles across modes", async () => {
  assert.equal(typeof qualityWorkflow.selectBoundedReviewRoles, "function");
  const stages = JSON.parse(await read("references/career-stages.json"));
  const policy = stages.reviewDispatch.qualityEditorPolicy;
  const selectedRoles = qualityWorkflow.selectBoundedReviewRoles({
    candidateRoles: ["career-strategist", "portfolio-reviewer", "evidence-auditor"],
    requiredRoles: policy.requiredRoleSets["portfolio-review"],
    rolePriority: stages.reviewDispatch.rolePriority,
    qualityEditorRole: policy.role,
    maxReviewers: policy.maxReviewers,
  });
  assert.deepEqual(selectedRoles, ["portfolio-reviewer", "evidence-auditor", "document-quality-editor"]);
  assert.equal(selectedRoles.length, 3);
  assert.deepEqual(qualityWorkflow.selectBoundedReviewRoles({
    candidateRoles: [...policy.requiredRoleSets["portfolio-review"]].reverse(),
    requiredRoles: [...policy.requiredRoleSets["portfolio-review"]].reverse(),
    rolePriority: stages.reviewDispatch.rolePriority,
    qualityEditorRole: policy.role,
    maxReviewers: policy.maxReviewers,
  }), selectedRoles);

  const mergerPath = path.join(pluginRoot, "skills/orchestrate-game-design-career/scripts/merge-role-findings.mjs");
  const { mergeRoleFindings } = await import(`${pathToFileURL(mergerPath).href}?dispatch=${Date.now()}`);
  const findingByRole = {
    "portfolio-reviewer": { ...careerQualityFinding("portfolio-1"), role: "portfolio-reviewer" },
    "evidence-auditor": { ...careerQualityFinding("evidence-1"), role: "evidence-auditor" },
    "document-quality-editor": careerQualityFinding("quality-1"),
  };
  const parallel = mergeRoleFindings({ schemaVersion: 1, findings: selectedRoles.map((role) => findingByRole[role]) });
  const sequential = mergeRoleFindings({ schemaVersion: 1, findings: [...selectedRoles].reverse().map((role) => findingByRole[role]) });
  assert.deepEqual(parallel, sequential);
  assert.deepEqual(new Set(parallel.findings.flatMap(({ provenance }) => provenance.map(({ role }) => role))), new Set(selectedRoles));
});
