import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { validateQualityProfile } from "../../../shared/scripts/validate-quality-profile.mjs";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const pluginRoot = path.join(repoRoot, "products/game-design-studio/plugin");
const skillRoot = path.join(repoRoot, "shared/reference-intelligence/skills");

async function readRouting() {
  return JSON.parse(await readFile(path.join(pluginRoot, "references/routing.json"), "utf8"));
}

async function readSkill(skillId) {
  return readFile(path.join(skillRoot, skillId, "SKILL.md"), "utf8");
}

function readContract(skill) {
  const match = skill.match(/<!-- reference-intelligence-contract:start -->\s*```json\s*([\s\S]*?)\s*```\s*<!-- reference-intelligence-contract:end -->/u);
  assert.ok(match, "reference-intelligence contract");
  return JSON.parse(match[1]);
}

function readWritingContract(skill) {
  const match = skill.match(/<!-- game-design-writing-contract:start -->\s*```json\s*([\s\S]*?)\s*```\s*<!-- game-design-writing-contract:end -->/u);
  assert.ok(match, "game-design-writing contract");
  return JSON.parse(match[1]);
}

async function readProfile(profileId) {
  return JSON.parse(await readFile(path.join(repoRoot, "shared/document-quality/profiles/studio", `${profileId}.json`), "utf8"));
}

function runRushedAnalysis(contract) {
  assert.equal(contract.externalInstructions, "untrusted-data");
  assert.deepEqual(contract.workflow, [
    "reference-brief",
    "role-based-reference-set",
    "evidence-registry",
    "system-atlas",
    "inventory-without-evaluation",
    "system-maps-and-loops",
    "priority",
    "deep-dives",
    "cross-game-comparison",
    "adopt-adapt-reject-hold",
    "verification-queue",
    "glossary-candidates",
  ]);
  return {
    transferState: contract.transfer.state,
    canonicalArtifactMutation: contract.transfer.canonicalArtifactMutation,
    transferDecisions: contract.transfer.decisions,
  };
}

test("Studio routes reference analysis through common evidence and pending transfer", async () => {
  const routing = await readRouting();
  assert.equal(routing.skillIds.includes("analyze-game-design-references"), true);
  assert.equal(routing.skillIds.includes("maintain-game-design-glossary"), true);
  assert.deepEqual(routing.referenceIntelligenceWorkflow.transferState, "pending-review");
  assert.deepEqual(routing.referenceIntelligenceWorkflow.outputs,
    ["reference-system-analysis", "reference-comparison", "design-transfer-decision"]);
});

test("Studio projects exact routes, review ownership, and quality profiles", async () => {
  const routing = await readRouting();
  const routes = routing.routes.filter(({ id }) => ["reference-game-analysis", "project-glossary-maintenance"].includes(id));
  assert.deepEqual(routes.map(({ id, skill, outputTypes }) => ({ id, skill, outputTypes })), [
    { id: "reference-game-analysis", skill: "analyze-game-design-references", outputTypes: ["reference-system-analysis", "reference-comparison", "design-transfer-decision"] },
    { id: "project-glossary-maintenance", skill: "maintain-game-design-glossary", outputTypes: ["game-design-glossary", "terminology-findings", "glossary-receipt"] },
  ]);
  assert.deepEqual(routing.directUseReviewOwners.filter(({ skill }) => skill === "analyze-game-design-references" || skill === "maintain-game-design-glossary"), [
    { skill: "analyze-game-design-references", owners: ["lead-game-designer"], conditionalOwners: [] },
    { skill: "maintain-game-design-glossary", owners: ["document-quality-editor"], conditionalOwners: [] },
  ]);
  assert.deepEqual(routing.referenceIntelligenceWorkflow.profileIds, ["reference-system-analysis", "reference-comparison", "design-transfer-decision"]);
  for (const profileId of routing.referenceIntelligenceWorkflow.profileIds) {
    const profile = await readProfile(profileId);
    assert.equal(profile.profile_id, profileId);
    assert.equal(profile.version, 1);
    assert.deepEqual(validateQualityProfile(profile, { sourceName: profileId }), { ok: true, errors: [] });
  }
});

test("rushed Studio reference analysis follows the shared contract before it can transfer", async () => {
  const skill = await readSkill("analyze-game-design-references");
  const contract = readContract(skill);
  await access(path.resolve(skillRoot, "analyze-game-design-references", contract.runtime));
  for (const reference of [...contract.references, ...contract.templates, ...contract.schemas]) {
    await access(path.resolve(skillRoot, "analyze-game-design-references", reference));
  }
  assert.deepEqual(runRushedAnalysis(contract), {
    transferState: "pending-review",
    canonicalArtifactMutation: false,
    transferDecisions: ["adopt", "adapt", "reject", "hold"],
  });
});

test("Studio writing polish validates glossary snapshots without replacement or approval mutation", async () => {
  const skill = await readFile(path.join(pluginRoot, "skills/polish-game-design-writing/SKILL.md"), "utf8");
  const contract = readWritingContract(skill);
  assert.deepEqual(contract.optionalInputs, ["reference-intelligence/glossary/terms.json", "reference-intelligence/glossary/glossary-receipt.json"]);
  assert.equal(contract.terminologyBehavior, "validate-and-report");
  assert.equal(contract.autoReplace, false);
  assert.equal(contract.approvalMutation, false);
  assert.deepEqual(contract.languageRoutes, {
    ko: "humanize-korean-then-human-review",
    "en-US": "english-consistency-findings-then-human-review",
    "en-GB": "english-consistency-findings-then-human-review",
  });
});
