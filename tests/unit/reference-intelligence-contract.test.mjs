import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { classifyInactiveReferenceIntelligenceSourcePaths, parseReferenceIntelligenceContract, referenceIntelligenceContractLayouts } from "../../tooling/lib/reference-intelligence-contract.mjs";
import { syncShared } from "../../tooling/sync-shared.mjs";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

function counterparts(packageRoot, skillPath, layout) {
  return new Set(Object.values(layout.installed).flat().map((relativePath) => path.resolve(path.dirname(skillPath), relativePath)));
}

test("classifier returns exactly the three closed inactive source-runtime tuples", async () => {
  const tuples = [];
  for (const [skillId, layout] of Object.entries(referenceIntelligenceContractLayouts)) {
    const skillPath = path.join(repoRoot, "skills", skillId, "SKILL.md");
    const contract = parseReferenceIntelligenceContract(await readFile(path.join(repoRoot, "shared/reference-intelligence/skills", skillId, "SKILL.md"), "utf8"));
    tuples.push(...classifyInactiveReferenceIntelligenceSourcePaths({ packageRoot: repoRoot, skillPath, contract, installedCounterparts: counterparts(repoRoot, skillPath, layout) }));
  }
  assert.deepEqual(tuples.map(({ tuple }) => tuple).sort(), [
    "skills/analyze-game-design-references/SKILL.md\0../../../scripts/analyze-game-design-references.mjs",
    "skills/maintain-game-design-glossary/SKILL.md\0../../../scripts/manage-game-design-glossary.mjs",
    "skills/maintain-game-design-glossary/SKILL.md\0../../../scripts/validate-game-design-writing-language.mjs",
  ]);
});

test("snapshot staging audits closed inactive source runtimes without weakening package paths", async (t) => {
  const stagingRoot = await mkdtemp(path.join(tmpdir(), "reference-intelligence-sync-audit-"));
  t.after(() => rm(stagingRoot, { recursive: true, force: true }));
  const result = await syncShared({ repoRoot, productName: "game-design-studio", stagingRoot, sourceDateEpoch: 0 });
  assert.deepEqual(result.audit.usedInactiveRelativeReferenceTuples, [
    "skills/analyze-game-design-references/SKILL.md\0../../../scripts/analyze-game-design-references.mjs",
    "skills/maintain-game-design-glossary/SKILL.md\0../../../scripts/manage-game-design-glossary.mjs",
    "skills/maintain-game-design-glossary/SKILL.md\0../../../scripts/validate-game-design-writing-language.mjs",
  ]);
});

test("classifier rejects changed contracts and missing installed counterparts", async () => {
  const skillId = "analyze-game-design-references";
  const skillPath = path.join(repoRoot, "skills", skillId, "SKILL.md");
  const contract = parseReferenceIntelligenceContract(await readFile(path.join(repoRoot, "shared/reference-intelligence/skills", skillId, "SKILL.md"), "utf8"));
  const layout = referenceIntelligenceContractLayouts[skillId];
  const installedCounterparts = counterparts(repoRoot, skillPath, layout);
  const changed = structuredClone(contract);
  changed.layouts.source.runtimes[0] = "../../../scripts/escape.mjs";
  assert.throws(() => classifyInactiveReferenceIntelligenceSourcePaths({ packageRoot: repoRoot, skillPath, contract: changed, installedCounterparts }), /semantic contract mismatch/u);
  installedCounterparts.delete([...installedCounterparts][0]);
  assert.throws(() => classifyInactiveReferenceIntelligenceSourcePaths({ packageRoot: repoRoot, skillPath, contract, installedCounterparts }), /installed counterpart mismatch/u);
});

function assertRecursivelyFrozen(value) {
  assert.equal(Object.isFrozen(value), true);
  for (const nested of Object.values(value)) {
    if (nested && typeof nested === "object") assertRecursivelyFrozen(nested);
  }
}

test("closed classifier authority is recursively immutable and cannot be poisoned", async () => {
  assertRecursivelyFrozen(referenceIntelligenceContractLayouts);
  assert.throws(() => { referenceIntelligenceContractLayouts["analyze-game-design-references"].source.runtimes[0] = "../../../scripts/poison.mjs"; }, TypeError);
  const skillId = "analyze-game-design-references";
  const skillPath = path.join(repoRoot, "skills", skillId, "SKILL.md");
  const contract = parseReferenceIntelligenceContract(await readFile(path.join(repoRoot, "shared/reference-intelligence/skills", skillId, "SKILL.md"), "utf8"));
  assert.deepEqual(
    classifyInactiveReferenceIntelligenceSourcePaths({
      packageRoot: repoRoot,
      skillPath,
      contract,
      installedCounterparts: counterparts(repoRoot, skillPath, referenceIntelligenceContractLayouts[skillId]),
    }).map(({ sourcePath }) => sourcePath),
    ["../../../scripts/analyze-game-design-references.mjs"],
  );
});
