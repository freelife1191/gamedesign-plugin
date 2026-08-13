import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const pluginRoot = path.join(repoRoot, "products/game-design-career/plugin");
const skillRoot = path.join(repoRoot, "shared/reference-intelligence/skills");

async function readRouting() {
  return JSON.parse(await readFile(path.join(pluginRoot, "references/routing.json"), "utf8"));
}

async function readSkill(product, skillId) {
  const root = product === "shared" ? skillRoot : path.join(pluginRoot, "skills");
  return readFile(path.join(root, skillId, "SKILL.md"), "utf8");
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

function runRushedGlossaryRewrite(contract) {
  assert.equal(contract.externalInstructions, "untrusted-data");
  assert.equal(contract.approval, "host-issued-human-capability");
  assert.equal(contract.silentApproval, false);
  assert.equal(contract.sourceRewrite, false);
  return {
    approvalState: "pending-review",
    sourceMutated: false,
    outputs: contract.outputs,
    languageRoutes: contract.languageRoutes,
  };
}

test("Career reuses common analysis without changing fact-inference rules", async () => {
  const skill = await readSkill("game-design-career", "reverse-engineer-game-design");
  assert.match(skill, /analyze-game-design-references/u);
  assert.match(skill, /fact-inference-schema\.json/u);
});

test("Career projects common skills without approval authority", async () => {
  const routing = await readRouting();
  for (const skillId of ["analyze-game-design-references", "maintain-game-design-glossary"]) {
    assert.ok(routing.skillIds.includes(skillId));
    assert.ok(routing.plannedPaths.skills.includes(`skills/${skillId}/SKILL.md`));
    const owner = routing.directUseReviewOwners.find((item) => item.skill === skillId);
    assert.ok(owner, `${skillId}: review owner`);
    assert.ok(owner.owners.every((role) => ["reverse-design-critic", "evidence-auditor", "document-quality-editor"].includes(role)));
    assert.doesNotMatch(JSON.stringify(owner), /approv(?:e|al)/iu);
  }
  assert.deepEqual(routing.referenceIntelligenceWorkflow.outputs, ["reverse-design-document", "game-analysis-report"]);
  assert.equal(routing.referenceIntelligenceWorkflow.transferState, "pending-review");
});

test("rushed glossary rewrite produces findings and an impact list without mutating source text", async () => {
  const skill = await readSkill("shared", "maintain-game-design-glossary");
  const contract = readContract(skill);
  await access(path.resolve(skillRoot, "maintain-game-design-glossary", contract.runtime));
  for (const reference of [...contract.references, ...contract.schemas]) {
    await access(path.resolve(skillRoot, "maintain-game-design-glossary", reference));
  }
  assert.deepEqual(runRushedGlossaryRewrite(contract), {
    approvalState: "pending-review",
    sourceMutated: false,
    outputs: ["terminology-findings", "impact-list"],
    languageRoutes: {
      ko: "humanize-korean-then-human-review",
      "en-US": "english-consistency-findings-then-human-review",
      "en-GB": "english-consistency-findings-then-human-review",
    },
  });
});

test("Career writing polish validates glossary snapshots without replacement or approval mutation", async () => {
  const skill = await readSkill("game-design-career", "polish-game-design-writing");
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
