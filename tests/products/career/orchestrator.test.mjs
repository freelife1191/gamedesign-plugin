import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const pluginRoot = path.join(repoRoot, "products/game-design-career/plugin");
const skillRoot = path.join(pluginRoot, "skills/orchestrate-game-design-career");

async function read(relativePath) {
  return readFile(path.join(pluginRoot, relativePath), "utf8");
}

async function readJson(relativePath) {
  return JSON.parse(await read(relativePath));
}

test("Career stages route the four representative career situations deterministically", async () => {
  const { scenarioRoutes } = await readJson("references/career-stages.json");

  assert.deepEqual(scenarioRoutes["undecided-entrant"], {
    stage: "unclear",
    skills: ["map-game-design-career"],
    roles: ["career-strategist", "game-design-mentor"],
    output: "game-design-role-map",
    provisionalPaths: true,
    declareSingleCorrectCareer: false,
  });
  assert.deepEqual(scenarioRoutes["new-graduate-system-design"], {
    stage: "new-hire",
    skills: [
      "research-game-design-jobs",
      "map-game-design-career",
      "build-game-design-portfolio",
      "review-game-design-portfolio",
    ],
    roles: ["career-strategist", "portfolio-reviewer", "evidence-auditor"],
    output: "portfolio-project-brief",
  });
  assert.deepEqual(scenarioRoutes["junior-project-impact"], {
    stage: "junior-growth",
    skills: ["plan-junior-growth"],
    roles: ["game-design-mentor", "career-strategist"],
    output: "junior-growth-review",
  });
  assert.deepEqual(scenarioRoutes["two-year-designer-transition"], {
    stage: "transition",
    skills: ["research-game-design-jobs", "practice-game-design-interview", "plan-junior-growth"],
    roles: ["career-strategist", "interview-coach", "evidence-auditor"],
    output: "transition-readiness",
  });
});

test("Current employer and job facts always select current research", async () => {
  const { intentRoutes } = await readJson("references/career-stages.json");
  const route = intentRoutes["current-employer-or-job-facts"];

  assert.equal(route.skill, "research-game-design-jobs");
  assert.equal(route.freshPrimaryEvidence, true);
  assert.deepEqual(route.requiredSourceMetadata, ["source-url", "posted-date", "retrieval-date"]);
  assert.ok(route.roles.includes("evidence-auditor"));
});

test("Portfolio review always selects Portfolio Reviewer and Evidence Auditor", async () => {
  const { intentRoutes } = await readJson("references/career-stages.json");

  assert.deepEqual(intentRoutes["portfolio-review"], {
    skill: "review-game-design-portfolio",
    roles: ["portfolio-reviewer", "evidence-auditor"],
  });
});

test("Every scenario and intent route stays within the three-role review bound", async () => {
  const { intentRoutes, scenarioRoutes } = await readJson("references/career-stages.json");
  const routes = [...Object.values(scenarioRoutes), ...Object.values(intentRoutes)];

  for (const route of routes) {
    assert.ok(route.roles.length > 0 && route.roles.length <= 3, JSON.stringify(route));
    assert.equal(new Set(route.roles).size, route.roles.length, JSON.stringify(route));
  }
});

test("Intake captures all branching inputs and applies the safe-assumption policy", async () => {
  const intake = await read("references/intake.md");
  const requiredFields = [
    "stage",
    "target role",
    "target industry",
    "target company",
    "target project",
    "current artifacts",
    "current projects",
    "available time",
    "constraints",
    "desired outputs",
  ];

  for (const field of requiredFields) assert.match(intake, new RegExp(`\\b${field}\\b`, "iu"));
  assert.match(intake, /record every safe assumption explicitly/iu);
  assert.match(intake, /ask only when .*materially branches/iu);
});

test("The skill uses the exact shared review envelope", async () => {
  const skill = await read("skills/orchestrate-game-design-career/SKILL.md");
  const envelopeMatch = skill.match(/```json\n([\s\S]*?)\n```/u);

  assert.ok(envelopeMatch, "review envelope JSON block");
  assert.deepEqual(JSON.parse(envelopeMatch[1]), {
    artifact: "artifact-name/content.md",
    role: "portfolio-reviewer",
    questions: [],
    findingsPath: "artifact-name/decisions/review-portfolio-reviewer.md",
  });
});

test("Parallel and sequential review modes preserve roles, questions, and priority", async () => {
  const { reviewDispatch } = await readJson("references/career-stages.json");

  assert.deepEqual(reviewDispatch.parallel.rolesSource, "selectedRoles");
  assert.deepEqual(reviewDispatch.sequential.rolesSource, "selectedRoles");
  assert.deepEqual(reviewDispatch.parallel.questionsSource, "questionsByRole");
  assert.deepEqual(reviewDispatch.sequential.questionsSource, "questionsByRole");
  assert.deepEqual(reviewDispatch.sequential.order, reviewDispatch.rolePriority);
  assert.equal(reviewDispatch.parallel.independentEnvelopes, true);
});

test("Finding merge order is deterministic across review execution modes", async () => {
  const { reviewDispatch } = await readJson("references/career-stages.json");

  assert.deepEqual(reviewDispatch.severityOrder, ["blocker", "high", "medium", "low"]);
  assert.deepEqual(reviewDispatch.mergeKeys, ["severity", "evidence-gap-id", "artifact-section-id", "role-priority"]);
});

test("An unclear stage maps roles and provisional paths without prescribing one career", async () => {
  const { stages } = await readJson("references/career-stages.json");
  const unclear = stages.find(({ id }) => id === "unclear");

  assert.ok(unclear);
  assert.equal(unclear.output, "game-design-role-map");
  assert.equal(unclear.provisionalPaths, true);
  assert.equal(unclear.declareSingleCorrectCareer, false);
  assert.deepEqual(unclear.roles, ["career-strategist", "game-design-mentor"]);
});

test("Completion gates require responsible evidence before handoff", async () => {
  const gates = await read("references/completion-gates.md");
  const requiredContracts = [
    /no hiring outcome is promised/iu,
    /age, education, major, or employment gap/iu,
    /no experience, metric, or interview story is fabricated/iu,
    /fresh primary evidence.*source URL.*retrieval date/isu,
    /third-party.*source.*use purpose.*rights/isu,
    /missing evidence.*does not pass/iu,
    /canonical artifact.*preserved/iu,
  ];

  for (const contract of requiredContracts) assert.match(gates, contract);
});

test("Skill metadata and progressive references remain portable", async () => {
  const skill = await read("skills/orchestrate-game-design-career/SKILL.md");
  const openai = await readFile(path.join(skillRoot, "agents/openai.yaml"), "utf8");

  assert.match(skill, /^---\nname: orchestrate-game-design-career\ndescription: Use when[^\n]+\n---\n/u);
  assert.match(skill, /Read `\.\.\/\.\.\/references\/career-stages\.json`/u);
  assert.match(skill, /Read `\.\.\/\.\.\/references\/intake\.md`/u);
  assert.match(skill, /Read `\.\.\/\.\.\/references\/completion-gates\.md`/u);
  assert.match(openai, /default_prompt: "[^"]*\$orchestrate-game-design-career[^"]*"/u);
  assert.doesNotMatch(`${skill}\n${openai}`, /TODO/iu);
});
