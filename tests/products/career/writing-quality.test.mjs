import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { buildProduct } from "../../../tooling/lib/build-product.mjs";
import { collectTree } from "../../../tooling/lib/copy-tree.mjs";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const pluginRoot = path.join(repoRoot, "products/game-design-career/plugin");
const validatorUrl = new URL("../../../shared/scripts/validate-writing-revision.mjs", import.meta.url);
const vendorLockPath = path.join(repoRoot, "shared/vendor/im-not-ai/vendor.lock.json");
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
    source: "bundled-im-not-ai-v2.3.0",
    skill: "humanize-korean",
    path: "../humanize-korean/SKILL.md",
  },
  sharedWrapper: "scripts/run-game-design-writing-polish.mjs",
  changeRateGate: {
    reviewAbove: 0.3,
    abortAbove: 0.5,
    comparisonLimit: 1000000,
    maxUtf8BytesPerDocument: 131072,
    maxCodepointsPerDocument: 65536,
    onInputLimitExceeded: "reject-and-split-document",
    onComputationLimitExceeded: "reject-and-split-document",
    receiptFields: ["changeRate", "changeRateStatus"],
  },
  workflow: [
    "lock-protected-content",
    "run-bundled-humanize-korean",
    "apply-game-design-protected-content-validator",
    "write-separate-revision-and-receipt",
    "wait-for-human-review",
  ],
};

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

async function buildInstalledProduct(t) {
  const stagingRoot = await mkdtemp(path.join(tmpdir(), "career-humanize-install-"));
  t.after(() => rm(stagingRoot, { recursive: true, force: true }));
  return buildProduct({ repoRoot, productName: "game-design-career", stagingRoot });
}

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

function parseFrontmatter(markdown) {
  const match = markdown.match(/^---\n([\s\S]*?)\n---\n/u);
  assert.ok(match, "skill frontmatter is missing");
  return Object.fromEntries(match[1].split("\n").map((line) => {
    const separator = line.indexOf(": ");
    assert.notEqual(separator, -1, `frontmatter field: ${line}`);
    return [line.slice(0, separator), line.slice(separator + 2)];
  }));
}

async function assertInstalledHumanizeTree(build) {
  const lock = JSON.parse(await readFile(vendorLockPath, "utf8"));
  const [installed, packaged] = await Promise.all([
    collectTree(path.join(build.outputDir, "skills/humanize-korean"), { label: "Career installed humanize-korean" }),
    collectTree(build.outputDir, { label: "Career installed package" }),
  ]);
  assert.deepEqual(installed.map(({ relativePath, bytes }) => ({ path: relativePath, size: bytes.length, sha256: sha256(bytes) })), lock.tree.files);
  assert.deepEqual(packaged.filter(({ relativePath }) => relativePath.endsWith("/sync-im-not-ai.mjs") || relativePath === "sync-im-not-ai.mjs").map(({ relativePath }) => relativePath), []);
}

test("Career registry exposes bundled humanize-korean and a dedicated writing specialist pass", async () => {
  const routing = JSON.parse(await readFile(path.join(pluginRoot, "references/routing.json"), "utf8"));

  assert.ok(routing.skillIds.includes(skillId));
  assert.ok(routing.skillIds.includes("humanize-korean"));
  assert.deepEqual(routing.writingSpecialistIds, [specialistId]);
  assert.deepEqual(routing.writingWorkflow, {
    skill: skillId,
    role: specialistId,
    placement: "after-content-domain-review-before-export",
    reviewerBound: "dedicated-specialist-pass-outside-primary-reviewer-cap",
    humanizeKoreanSkill: "humanize-korean",
  });
  for (const route of routing.routes) {
    assert.ok(route.roles.length <= 3, `${route.id}: primary reviewer cap`);
    assert.equal(route.roles.includes(specialistId), false, `${route.id}: writing specialist is not a primary reviewer`);
  }
});

test("Career writing-polish skill is directly discoverable through parsed skill metadata", async () => {
  const [skill, openai] = await Promise.all([
    readFile(path.join(pluginRoot, `skills/${skillId}/SKILL.md`), "utf8"),
    readFile(path.join(pluginRoot, `skills/${skillId}/agents/openai.yaml`), "utf8"),
  ]);

  assert.deepEqual(parseFrontmatter(skill), {
    name: skillId,
    description: "Use when a Korean game design document needs a minimal readability revision that preserves protected content and approval state.",
  });
  assert.match(openai, /^interface:\n  display_name: "Polish Game Design Writing"\n  short_description: "[^"]{25,64}"\n  default_prompt: "Use \$polish-game-design-writing [^"]+"\n$/u);
});

test("Career writing-polish wrapper uses bundled humanize-korean before the stricter validator", async () => {
  const skill = await readFile(path.join(pluginRoot, `skills/${skillId}/SKILL.md`), "utf8");

  assert.deepEqual(extractJsonContract(skill, "game-design-writing-contract"), expectedSkillContract);
});

test("Career install materializes the exact local humanize-korean tree and no updater", async (t) => {
  const build = await buildInstalledProduct(t);
  const installedSkill = path.join(build.outputDir, "skills/humanize-korean/SKILL.md");

  const installedMetadata = parseFrontmatter(await readFile(installedSkill, "utf8"));
  assert.deepEqual(installedMetadata.name, "humanize-korean");
  assert.equal(`$${installedMetadata.name}`, "$humanize-korean", "bundled skill has a direct command");
  await assertInstalledHumanizeTree(build);
});

test("Career writing specialist records bounded revisions without approval authority", async () => {
  const agent = await readFile(path.join(pluginRoot, `agents/${specialistId}.md`), "utf8");

  assert.deepEqual(extractJsonContract(agent, "game-design-writing-editor-contract"), {
    id: specialistId,
    may: ["diagnose-writing", "propose-minimal-revision", "record-findings"],
    mayNot: ["verify-facts", "invent-evidence", "change-approval-state", "overwrite-canonical-document"],
  });
});

test("Career product fixture can use the writing validator without changing a blocked gate", async () => {
  const { validateWritingRevision } = await import(validatorUrl.href);
  const result = validateWritingRevision({
    original: "- stable ID: CAREER-WRITE-01\n- gate: blocked\n- uncertainty: 면접 사례의 결과는 아직 확인되지 않았다.",
    revised: "- stable ID: CAREER-WRITE-01\n- gate: blocked\n- uncertainty: 면접 사례의 결과는 아직 확인되지 않았다.\n\n확인할 근거와 다음 질문을 읽기 쉽게 나눈다.",
  });

  assert.equal(result.valid, true);
  assert.equal(result.receipt.status, "preserved");
});
