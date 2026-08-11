import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const pluginRoot = path.join(repoRoot, "products/game-design-studio/plugin");
const validatorUrl = new URL("../../../shared/scripts/validate-writing-revision.mjs", import.meta.url);
const skillId = "polish-game-design-writing";
const specialistId = "game-design-writing-editor";

const expectedSkillContract = {
  directCommand: "$polish-game-design-writing",
  writingSpecialistId: specialistId,
  outputs: {
    revisedDraft: "writing-revision/revised-draft.md",
    findings: "writing-revision/writing-findings.md",
    protectedContentReceipt: "writing-revision/protected-content-receipt.json",
    humanReviewHandoff: "writing-revision/human-review-handoff.md",
  },
  humanizeKorean: {
    host: { skill: "humanize-korean", optional: true },
    bundledFallback: "references/shared/document-quality/game-design-writing-style.md",
  },
};

function extractJsonContract(markdown, name) {
  const match = markdown.match(new RegExp(
    `<!-- ${name}:start -->\\s*` +
      "```json\\s*([\\s\\S]*?)\\s*```\\s*" +
      `<!-- ${name}:end -->`,
    "u",
  ));
  assert.ok(match, `${name} contract is missing`);
  return JSON.parse(match[1]);
}

test("Studio registry exposes writing polish as a dedicated specialist pass, outside primary reviewer bounds", async () => {
  const routing = JSON.parse(await readFile(path.join(pluginRoot, "references/routing.json"), "utf8"));

  assert.ok(routing.skillIds.includes(skillId));
  assert.deepEqual(routing.writingSpecialistIds, [specialistId]);
  assert.deepEqual(routing.writingWorkflow, {
    skill: skillId,
    role: specialistId,
    placement: "after-content-domain-review-before-export",
    reviewerBound: "dedicated-specialist-pass-outside-primary-reviewer-cap",
  });
  for (const route of routing.routes) {
    assert.ok(route.maxReviewers <= 3, `${route.id}: primary reviewer cap`);
    assert.equal(route.defaultReviewers.includes(specialistId), false, `${route.id}: writing specialist is not a primary reviewer`);
    for (const selection of route.conditionalReviewers ?? []) {
      assert.equal(selection.reviewers.includes(specialistId), false, `${route.id}: writing specialist is not conditional primary reviewer`);
    }
  }
});

test("Studio writing-polish skill publishes a direct command, separate outputs, and a safe host fallback", async () => {
  const skill = await readFile(path.join(pluginRoot, `skills/${skillId}/SKILL.md`), "utf8");

  assert.deepEqual(extractJsonContract(skill, "game-design-writing-contract"), expectedSkillContract);
});

test("Studio writing specialist records bounded revisions without approval authority", async () => {
  const agent = await readFile(path.join(pluginRoot, `agents/${specialistId}.md`), "utf8");

  assert.deepEqual(extractJsonContract(agent, "game-design-writing-editor-contract"), {
    id: specialistId,
    may: ["diagnose-writing", "propose-minimal-revision", "record-findings"],
    mayNot: ["verify-facts", "invent-evidence", "change-approval-state", "overwrite-canonical-document"],
  });
});

test("Studio product fixture can use the writing validator without changing a pending gate", async () => {
  const { validateWritingRevision } = await import(validatorUrl.href);
  const result = validateWritingRevision({
    original: "- stable ID: STUDIO-WRITE-01\n- gate: pending\n- uncertainty: 보상 반응은 아직 모른다.",
    revised: "- stable ID: STUDIO-WRITE-01\n- gate: pending\n- uncertainty: 보상 반응은 아직 모른다.\n\n검토자는 보상 반응을 확인할 질문을 남긴다.",
  });

  assert.equal(result.valid, true);
  assert.equal(result.receipt.status, "preserved");
});
