import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const pluginRoot = path.join(repoRoot, "products/game-design-studio/plugin");
const skillRoot = path.join(pluginRoot, "skills/orchestrate-game-design-project");
const routingPath = path.join(pluginRoot, "references/routing.json");
const careerRoutingPath = path.join(repoRoot, "products/game-design-career/plugin/references/routing.json");

const roleIds = [
  "lead-game-designer",
  "system-economy-designer",
  "content-narrative-designer",
  "ux-accessibility-reviewer",
  "liveops-data-designer",
  "production-feasibility-critic",
  "combat-encounter-reviewer",
  "level-puzzle-reviewer",
];

const studioOnlyReviewRoles = ["combat-encounter-reviewer", "level-puzzle-reviewer"];
const expectedRolePriority = [...roleIds, "document-quality-editor"];
const domainRouteFixtures = [
  {
    role: "combat-encounter-reviewer",
    triggerIntents: ["combat", "boss", "encounter"],
  },
  {
    role: "level-puzzle-reviewer",
    triggerIntents: ["puzzle", "level design", "secret route", "soft lock", "reset", "retry"],
  },
];

const contentRoutingFixture = {
  id: "content",
  maxReviewers: 3,
  defaultReviewers: ["content-narrative-designer", "lead-game-designer"],
  conditionalReviewers: domainRouteFixtures.map(({ role, triggerIntents }) => ({ role, triggerIntents, reviewers: [role] })),
};

const conditionalReviewerSelectionContract = {
  intentInput: "conditionalIntent",
  selectionSource: "routing.routes[].conditionalReviewers",
  matchRule: "conditionalReviewers[].triggerIntents includes conditionalIntent",
  finalReviewerSet: "unique(defaultReviewers + selectedConditionalReviewers)",
  deduplicate: true,
  maxReviewers: 3,
};

async function readSkill(relativePath) {
  return readFile(path.join(skillRoot, relativePath), "utf8");
}

async function readRouting() {
  return JSON.parse(await readFile(routingPath, "utf8"));
}

async function readCareerRouting() {
  return JSON.parse(await readFile(careerRoutingPath, "utf8"));
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

function reviewerLists(route) {
  return [
    { label: `${route.id}.defaultReviewers`, reviewers: route.defaultReviewers },
    ...(route.conditionalReviewers ?? []).map(({ reviewers }, index) => ({
      label: `${route.id}.conditionalReviewers[${index}].reviewers`,
      reviewers,
    })),
  ];
}

function assertReviewerBounds(route) {
  assert.ok(Number.isInteger(route.maxReviewers), `${route.id}: maxReviewers`);
  assert.ok(route.maxReviewers <= 3, `${route.id}: maxReviewers`);
  for (const { label, reviewers } of reviewerLists(route)) {
    assert.ok(Array.isArray(reviewers), `${label}: reviewer list`);
    assert.ok(reviewers.length <= route.maxReviewers, `${label}: route max`);
    assert.ok(reviewers.length <= 3, `${label}: three-reviewer bound`);
  }
}

function selectedReviewers(route, role) {
  const selection = route.conditionalReviewers?.find((candidate) => candidate.role === role);
  assert.ok(selection, `${role}: conditional selection`);
  return [...new Set([...route.defaultReviewers, ...selection.reviewers])];
}

function assertDomainIntentRouting(route) {
  assert.equal(route.id, "content");
  assertReviewerBounds(route);
  assert.ok(Array.isArray(route.conditionalReviewers), "content: conditional reviewer list");
  for (const { role, triggerIntents } of domainRouteFixtures) {
    const selection = route.conditionalReviewers.find((candidate) => candidate.role === role);
    assert.deepEqual(selection.triggerIntents, triggerIntents, `${role}: trigger intents`);
    assert.deepEqual(selection.reviewers, [role], `${role}: exact reviewer selection`);
    assert.ok(selectedReviewers(route, role).length <= 3, `${role}: selected reviewer bound`);
  }
}

function assertConditionalReviewerSelectionContract(contract) {
  assert.deepEqual(contract, conditionalReviewerSelectionContract);
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

test("authoritative routing registry maps all ten direct route variants", async () => {
  const routing = await readRouting();
  const directRoutes = routing.routes.filter(({ id }) => id !== "project-orchestration");
  const routeMap = Object.fromEntries(directRoutes.map(({ id, skill }) => [id, skill]));

  assert.deepEqual(routeMap, {
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
  assert.equal(directRoutes.length, 10);
  assert.deepEqual([...new Set(directRoutes.map(({ skill }) => skill))], [
    "define-game-vision",
    "design-game-systems",
    "design-game-content",
    "design-player-experience",
    "design-game-economy-and-liveops",
    "plan-game-production",
    "review-game-design",
    "visualize-game-design",
    "export-game-design-documents",
  ]);
});

test("authoritative routing registry includes Studio-only domain reviewers", async () => {
  const routing = await readRouting();

  assert.deepEqual(routing.roleIds, expectedRolePriority);
  assert.deepEqual(routing.rolePriority, expectedRolePriority);
});

test("Career routing does not adopt Studio-only combat and level reviewers", async () => {
  const careerRouting = await readCareerRouting();

  for (const role of studioOnlyReviewRoles) {
    assert.equal(careerRouting.roleIds.includes(role), false, `Career roleIds: ${role}`);
  }
});

test("content routing fixture rejects missing intents and a fourth selected reviewer", () => {
  assert.doesNotThrow(() => assertDomainIntentRouting(contentRoutingFixture));
  for (const { role, triggerIntents } of domainRouteFixtures) {
    for (const triggerIntent of triggerIntents) {
      const mutation = structuredClone(contentRoutingFixture);
      const selection = mutation.conditionalReviewers.find((candidate) => candidate.role === role);
      selection.triggerIntents = selection.triggerIntents.filter((intent) => intent !== triggerIntent);
      assert.throws(() => assertDomainIntentRouting(mutation), undefined, `${role}: ${triggerIntent} mutation survived`);
    }
  }
  const mutation = structuredClone(contentRoutingFixture);
  mutation.defaultReviewers.push("production-feasibility-critic");
  assert.throws(() => assertDomainIntentRouting(mutation), undefined, "default three plus conditional one survived");
});

test("conditional reviewer workflow contract rejects missing or incorrect selection semantics", () => {
  assert.doesNotThrow(() => assertConditionalReviewerSelectionContract(conditionalReviewerSelectionContract));
  for (const field of Object.keys(conditionalReviewerSelectionContract)) {
    const mutation = structuredClone(conditionalReviewerSelectionContract);
    delete mutation[field];
    assert.throws(
      () => assertConditionalReviewerSelectionContract(mutation),
      undefined,
      `conditional reviewer workflow: ${field} removal survived`,
    );
  }

  for (const [label, matchRule] of [
    ["intent matched against role", "conditionalReviewers[].role includes conditionalIntent"],
    ["role matched against trigger intents", "conditionalReviewers[].triggerIntents includes conditionalRole"],
    ["all conditional roles selected unconditionally", "select all conditionalReviewers"],
  ]) {
    const mutation = { ...conditionalReviewerSelectionContract, matchRule };
    assert.throws(
      () => assertConditionalReviewerSelectionContract(mutation),
      undefined,
      `conditional reviewer workflow: ${label} mutation survived`,
    );
  }
});

test("workflow consumes conditional intents into a deduplicated bounded final reviewer set", async () => {
  const workflow = await readSkill("references/workflow.md");
  const contract = extractJsonContract(workflow, "conditional-reviewer-selection");

  assertConditionalReviewerSelectionContract(contract);
});

test("Studio content route selects domain reviewers for combat and puzzle intents", async () => {
  const routing = await readRouting();
  const contentRoute = routing.routes.find(({ id }) => id === "content");

  assert.ok(contentRoute, "content route");
  assertDomainIntentRouting(contentRoute);
});

test("authoritative routing registry caps every route and conditional selection at three reviewers", async () => {
  const routing = await readRouting();

  for (const route of routing.routes) assertReviewerBounds(route);
});

test("workflow loads routing decisions from the registry instead of copying them", async () => {
  const workflow = await readSkill("references/workflow.md");

  assert.match(workflow, /read `\.\.\/\.\.\/\.\.\/references\/routing\.json` before (?:routing|selecting)/iu);
  for (const field of ["routes", "skill", "defaultReviewers", "maxReviewers", "rolePriority"]) {
    assert.match(workflow, new RegExp(`\\b${field}\\b`, "u"), field);
  }
  assert.doesNotMatch(workflow, /<!-- direct-routing:start -->/u);
  assert.doesNotMatch(workflow, /"rolePriority"\s*:\s*\[/u);
  for (const skillId of [
    "define-game-vision",
    "design-game-systems",
    "design-game-content",
    "design-player-experience",
    "design-game-economy-and-liveops",
    "plan-game-production",
    "review-game-design",
    "visualize-game-design",
    "export-game-design-documents",
  ]) {
    assert.doesNotMatch(workflow, new RegExp(`\\b${skillId}\\b`, "u"), skillId);
  }
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
  const [workflow, routing] = await Promise.all([readSkill("references/workflow.md"), readRouting()]);
  const review = extractJsonContract(workflow, "review-policy");
  const reviewRoute = routing.routes.find(({ id }) => id === "review");

  assert.deepEqual(Object.keys(review).sort(), [
    "envelope",
    "fallback",
    "mergeKeys",
    "parallel",
    "severityOrder",
  ]);
  assert.deepEqual(review.envelope, {
    artifact: "artifact-name/content.md",
    role: "lead-game-designer",
    questions: [],
    findingsPath: "artifact-name/decisions/review-lead-game-designer.md",
  });
  assert.ok(reviewRoute.defaultReviewers.every((role) => routing.roleIds.includes(role)));
  assert.ok(reviewRoute.defaultReviewers.length <= reviewRoute.maxReviewers);
  assert.ok(reviewRoute.maxReviewers <= 3);
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
  const [workflow, gates, routing] = await Promise.all([
    readSkill("references/workflow.md"),
    readSkill("references/completion-gates.md"),
    readRouting(),
  ]);
  const reviewRoute = routing.routes.find(({ id }) => id === "review");

  assert.deepEqual(reviewRoute.defaultReviewers, [
    "lead-game-designer",
    "production-feasibility-critic",
    "ux-accessibility-reviewer",
  ]);
  assert.match(workflow, /mixed launch-readiness[^\n]*review[^\n]*defaultReviewers/iu);
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
