import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const pluginRoot = path.join(repoRoot, "products/game-design-studio/plugin");
const skillRoot = path.join(pluginRoot, "skills/orchestrate-game-design-project");

const roleIds = [
  "lead-game-designer",
  "system-economy-designer",
  "content-narrative-designer",
  "ux-accessibility-reviewer",
  "liveops-data-designer",
  "production-feasibility-critic",
];

async function readSkill(relativePath) {
  return readFile(path.join(skillRoot, relativePath), "utf8");
}

function extractJsonContract(markdown, contractName) {
  const pattern = new RegExp(
    `<!-- ${contractName}:start -->\\s*` +
      "```json" +
      `\\s*([\\s\\S]*?)\\s*` +
      "```" +
      `\\s*<!-- ${contractName}:end -->`,
    "u",
  );
  const match = markdown.match(pattern);
  assert.ok(match, `${contractName} contract is missing`);
  return JSON.parse(match[1]);
}

test("orchestrator skill uses the official minimal metadata and interface contract", async () => {
  const [skill, openai] = await Promise.all([readSkill("SKILL.md"), readSkill("agents/openai.yaml")]);
  const frontmatter = skill.match(/^---\n([\s\S]*?)\n---/u)?.[1];

  assert.ok(frontmatter, "YAML frontmatter");
  assert.deepEqual(
    frontmatter.split("\n").map((line) => line.split(":", 1)[0]),
    ["name", "description"],
  );
  assert.match(frontmatter, /^name: orchestrate-game-design-project$/mu);
  assert.match(frontmatter, /^description: Use when /mu);
  assert.doesNotMatch(frontmatter, /dispatch|parallel|workflow|merge/iu);
  assert.match(openai, /display_name: "Game Design Project Orchestrator"/u);
  assert.match(openai, /short_description: "[^"]{25,64}"/u);
  assert.match(openai, /default_prompt: "Use \$orchestrate-game-design-project /u);
});

test("direct requests route to all nine game-design domains without guessing", async () => {
  const workflow = await readSkill("references/workflow.md");
  const routing = extractJsonContract(workflow, "direct-routing");

  assert.deepEqual(routing, {
    vision: "define-game-vision",
    systems: "design-game-systems",
    content: "design-game-content",
    "player-experience": "design-player-experience",
    economy: "design-game-economy-and-liveops",
    liveops: "design-game-economy-and-liveops",
    production: "plan-game-production",
    review: "review-game-design",
    visualization: "visualize-game-design",
    export: "export-game-design-documents",
  });
  assert.match(workflow, /unknown or ambiguous intent[\s\S]*orchestrate-game-design-project/iu);
  assert.match(workflow, /never (?:invent|guess)[^\n]*specialist/iu);
});

test("intake captures the full brief and asks only materially consequential questions", async () => {
  const intake = await readSkill("references/intake.md");
  for (const field of [
    "target player",
    "target experience",
    "platform",
    "genre",
    "business model",
    "online mode",
    "development stage",
    "team constraint",
    "schedule constraint",
    "technology constraint",
    "scope",
    "non-goals",
    "requested artifact formats",
    "completion criteria",
  ]) {
    assert.match(intake, new RegExp(`\\b${field}\\b`, "iu"), field);
  }
  assert.match(intake, /safe assumption/iu);
  assert.match(intake, /record[^\n]*assumption/iu);
  assert.match(intake, /ask only when[^\n]*materially changes the result/iu);
  assert.match(intake, /do not assume[^\n]*(rights|consent|approval|price|odds|rollback)/iu);
});

test("review dispatch uses exact envelopes and at most three declared roles", async () => {
  const workflow = await readSkill("references/workflow.md");
  const review = extractJsonContract(workflow, "review-policy");

  assert.equal(review.maxRoles, 3);
  assert.deepEqual(review.rolePriority, roleIds);
  assert.deepEqual(review.envelope, {
    artifact: "artifact-name/content.md",
    role: "lead-game-designer",
    questions: [],
    findingsPath: "artifact-name/decisions/review-lead-game-designer.md",
  });
  assert.ok(review.selectedRoles.every((role) => roleIds.includes(role)));
  assert.ok(review.selectedRoles.length <= 3);
});

test("parallel and no-subagent fallback execute identical reviews deterministically", async () => {
  const workflow = await readSkill("references/workflow.md");
  const review = extractJsonContract(workflow, "review-policy");

  assert.equal(review.parallel.mode, "independent-envelopes");
  assert.equal(review.parallel.envelopeList, "selectedReviews");
  assert.equal(review.fallback.when, "host-without-subagents");
  assert.equal(review.fallback.envelopeList, "selectedReviews");
  assert.equal(review.fallback.order, "rolePriority");
  assert.equal(review.fallback.preserveRolesAndQuestions, true);
  assert.match(workflow, /same roles and questions/iu);
});

test("findings merge by severity, affected stable section ID, then role priority", async () => {
  const workflow = await readSkill("references/workflow.md");
  const review = extractJsonContract(workflow, "review-policy");

  assert.deepEqual(review.mergeKeys, ["severity", "affectedSectionId", "rolePriority"]);
  assert.deepEqual(review.severityOrder, ["blocker", "high", "medium", "low"]);
  assert.match(workflow, /stable section ID/iu);
  assert.match(workflow, /retain conflicting recommendations[^\n]*decision/iu);
});

test("completion gates protect the canonical artifact and requested formats", async () => {
  const gates = await readSkill("references/completion-gates.md");
  for (const member of ["content.md", "evidence.yml", "export-manifest.yml", "decisions/", "assets/"]) {
    assert.match(gates, new RegExp(member.replace(/[./]/gu, "\\$&"), "u"), member);
  }
  assert.match(gates, /validate[^\n]*Canonical Artifact/iu);
  assert.match(gates, /preserve[^\n]*canonical artifact[^\n]*(visualization|export)[^\n]*(fail|unavailable)/iu);
  for (const format of ["MD", "PDF", "DOCX", "PPTX"]) {
    assert.match(gates, new RegExp(`\\b${format}\\b`, "u"), format);
  }
  assert.match(gates, /PPTX[^\n]*audience[^\n]*purpose[^\n]*slide outline/iu);
  assert.match(gates, /failed|unavailable/iu);
});

test("mixed launch readiness applies bounded reviews and responsible-design blockers", async () => {
  const [workflow, gates] = await Promise.all([
    readSkill("references/workflow.md"),
    readSkill("references/completion-gates.md"),
  ]);
  const review = extractJsonContract(workflow, "review-policy");

  assert.deepEqual(review.selectedRoles, [
    "lead-game-designer",
    "ux-accessibility-reviewer",
    "production-feasibility-critic",
  ]);
  assert.match(workflow, /mixed launch-readiness/iu);
  for (const gate of [
    "ai-rights-human-approval",
    "accessibility",
    "economy-transparency",
    "liveops-experiment",
    "ugc-safety",
    "ai-npc-safety",
    "scope-control",
  ]) {
    assert.match(gates, new RegExp(`\\b${gate}\\b`, "u"), gate);
  }
  assert.match(gates, /not-applicable[^\n]*pending[^\n]*blocked[^\n]*approved/iu);
  assert.match(gates, /missing evidence[^\n]*(?:never|not)[^\n]*approval/iu);
  assert.match(gates, /blocked gate[^\n]*stops approval[^\n]*affected scope/iu);
});
