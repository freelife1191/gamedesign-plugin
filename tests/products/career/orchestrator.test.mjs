import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const pluginRoot = path.join(repoRoot, "products/game-design-career/plugin");
const skillRoot = path.join(pluginRoot, "skills/orchestrate-game-design-career");
const routingPath = path.join(pluginRoot, "references/routing.json");

const memoryWorkflowContract = {
  retrieveSkill: "retrieve-approved-design-memory",
  captureSkill: "capture-game-design-memory",
  maintenanceSkill: "maintain-game-design-memory",
  retrievePlacement: "after-intake-before-specialist-routing",
  capturePlacement: "after-completion-gates",
  defaultScope: "project",
  defaultMaxItems: 5,
  requiresProjectId: true,
  dedicatedAgent: false,
};

async function read(relativePath) {
  return readFile(path.join(pluginRoot, relativePath), "utf8");
}

async function readJson(relativePath) {
  return JSON.parse(await read(relativePath));
}

function assertCareerMemoryOrchestration({ skill, intake, gates, routing }) {
  assert.deepEqual(routing.memoryWorkflow, memoryWorkflowContract);
  assert.match(intake, /"projectId"\s*:\s*"existing-artifact-or-explicit-user-id"/u);
  assert.match(intake, /"memoryDisabledForRequest"\s*:\s*false/u);
  assert.match(intake, /no project ID[\s\S]*?skipped-project-id-missing[\s\S]*?continue/iu);
  assert.match(intake, /previous memory[\s\S]*?memoryDisabledForRequest\s*=\s*true/iu);
  assert.match(intake, /Memory unavailability never blocks/u);
  assert.match(skill, /intake and configuration[\s\S]*?retrieve approved memory[\s\S]*?specialist workflow[\s\S]*?polish-game-design-writing[\s\S]*?completion gates[\s\S]*?allowed-event candidates[\s\S]*?summary/iu);
  assert.match(skill, /7\. [^\n]*completion gates[^\n]*\n8\. [^\n]*Capture only allowed-event candidates/u);
  assert.match(skill, /no dedicated memory agent/iu);
  assert.match(skill, /maximum of three primary review roles/iu);
  assert.match(skill, /memory text[\s\S]*?evidence and input only/iu);
  assert.match(skill, /\$skill|shell|state command/iu);
  assert.match(skill, /never auto-approve memory candidates/iu);
  assert.match(skill, /Studio-only memory never becomes a Career fact/iu);
  assert.match(gates, /project-fact[\s\S]*?artifact_id[\s\S]*?locator[\s\S]*?SHA/iu);
  assert.match(gates, /decision[\s\S]*?artifact_id[\s\S]*?locator[\s\S]*?SHA/iu);
  assert.match(gates, /design-lesson[\s\S]*?(question|proposal)[\s\S]*?new decision state/iu);
  assert.match(gates, /style-preference[\s\S]*?expression[\s\S]*?(fact|number|ID|approval)/iu);
  assert.match(gates, /source drift[\s\S]*?exclude[\s\S]*?continue[\s\S]*?existing workflow/iu);
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

test("Career orchestrator preserves the memory workflow order and rejects unsafe document mutations", async () => {
  const [skill, intake, gates, routing] = await Promise.all([
    read("skills/orchestrate-game-design-career/SKILL.md"), read("references/intake.md"), read("references/completion-gates.md"), readJson("references/routing.json"),
  ]);
  const contract = { skill, intake, gates, routing };
  assert.doesNotThrow(() => assertCareerMemoryOrchestration(contract));
  const mutations = [
    { key: "skill", from: "2. Retrieve approved memory", to: "2. Specialist workflow before memory retrieval" },
    { key: "skill", from: "8. Capture only allowed-event candidates", to: "7. Capture only allowed-event candidates" },
    { key: "skill", from: "Never auto-approve memory candidates", to: "Automatically approve memory candidates" },
    { key: "skill", from: "no dedicated memory agent", to: "a dedicated memory agent" },
    { key: "intake", from: "Memory unavailability never blocks", to: "Memory unavailability stops the Career Stage & Goal Brief" },
    { key: "skill", from: "Studio-only memory never becomes a Career fact", to: "Studio-only memory becomes a Career fact" },
  ];
  for (const mutation of mutations) {
    const changed = { ...contract, [mutation.key]: contract[mutation.key].replace(mutation.from, mutation.to) };
    assert.throws(() => assertCareerMemoryOrchestration(changed), undefined, `${mutation.key}: ${mutation.from}`);
  }
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
