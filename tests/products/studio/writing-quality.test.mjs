import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { buildProduct } from "../../../tooling/lib/build-product.mjs";
import { collectTree } from "../../../tooling/lib/copy-tree.mjs";
import { packagedVendorFiles } from "../../lib/vendored.mjs";

const bundledImNotAiTag = JSON.parse(readFileSync(new URL("../../../shared/vendor/im-not-ai/vendor.lock.json", import.meta.url), "utf8")).upstream.tag;

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
    // The bundled tag follows the vendor lock; a copy here would break on every upgrade.
    source: `bundled-im-not-ai-${bundledImNotAiTag}`,
    skill: "humanize-korean",
    path: "../humanize-korean/SKILL.md",
  },
  optionalInputs: [
    "reference-intelligence/glossary/terms.json",
    "reference-intelligence/glossary/glossary-receipt.json",
  ],
  terminologyBehavior: "validate-and-report",
  autoReplace: false,
  approvalMutation: false,
  languageRoutes: {
    ko: "humanize-korean-then-human-review",
    "en-US": "english-consistency-findings-then-human-review",
    "en-GB": "english-consistency-findings-then-human-review",
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
  const stagingRoot = await mkdtemp(path.join(tmpdir(), "studio-humanize-install-"));
  t.after(() => rm(stagingRoot, { recursive: true, force: true }));
  return buildProduct({ repoRoot, productName: "game-design-studio", stagingRoot });
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

async function assertInstalledHumanizeTree(build) {
  const [installed, packaged] = await Promise.all([
    collectTree(path.join(build.outputDir, "skills/humanize-korean"), { label: "Studio installed humanize-korean" }),
    collectTree(build.outputDir, { label: "Studio installed package" }),
  ]);
  assert.deepEqual(installed.map(({ relativePath, bytes }) => ({ path: relativePath, size: bytes.length, sha256: sha256(bytes) })), packagedVendorFiles("im-not-ai"));
  assert.deepEqual(packaged.filter(({ relativePath }) => relativePath.endsWith("/sync-im-not-ai.mjs") || relativePath === "sync-im-not-ai.mjs").map(({ relativePath }) => relativePath), []);
}

test("Studio registry exposes bundled humanize-korean and a dedicated writing specialist pass", async () => {
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
    assert.ok(route.maxReviewers <= 3, `${route.id}: primary reviewer cap`);
    assert.equal(route.defaultReviewers.includes(specialistId), false, `${route.id}: writing specialist is not a primary reviewer`);
    for (const selection of route.conditionalReviewers ?? []) {
      assert.equal(selection.reviewers.includes(specialistId), false, `${route.id}: writing specialist is not conditional primary reviewer`);
    }
  }
});

test("Studio writing-polish skill is directly discoverable through parsed skill metadata", async () => {
  const [skill, openai] = await Promise.all([
    readFile(path.join(pluginRoot, `skills/${skillId}/SKILL.md`), "utf8"),
    readFile(path.join(pluginRoot, `skills/${skillId}/agents/openai.yaml`), "utf8"),
  ]);

  assert.deepEqual(parseFrontmatter(skill), {
    name: skillId,
    description: "Use when a Korean game design document needs a minimal readability revision that preserves protected content.",
  });
  assert.match(openai, /^interface:\n  display_name: "Polish Game Design Writing"\n  short_description: "[^"]{25,64}"\n  default_prompt: "Use \$polish-game-design-writing [^"]+"\n$/u);
});

test("Studio writing-polish wrapper uses bundled humanize-korean before the stricter validator", async () => {
  const skill = await readFile(path.join(pluginRoot, `skills/${skillId}/SKILL.md`), "utf8");

  assert.deepEqual(extractJsonContract(skill, "game-design-writing-contract"), expectedSkillContract);
});

test("Studio install materializes the exact local humanize-korean tree and no updater", async (t) => {
  const build = await buildInstalledProduct(t);
  const installedSkill = path.join(build.outputDir, "skills/humanize-korean/SKILL.md");

  const installedMetadata = parseFrontmatter(await readFile(installedSkill, "utf8"));
  assert.deepEqual(installedMetadata.name, "humanize-korean");
  assert.equal(`$${installedMetadata.name}`, "$humanize-korean", "bundled skill has a direct command");
  await assertInstalledHumanizeTree(build);
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
