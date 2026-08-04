import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const pluginRoot = path.join(repoRoot, "products/game-design-studio/plugin");
const gateRegistryPath = path.join(repoRoot, "shared/responsible-design/gates.json");
const relativeGateRegistry = "../../../../../shared/responsible-design/gates.json";

const contracts = {
  "define-game-vision": {
    method: "vision.md",
    reviewers: ["lead-game-designer", "content-narrative-designer"],
    fields: [
      "target player",
      "experience intent",
      "desired emotion",
      "core fun",
      "design pillars",
      "core loop",
      "motivation loop",
      "meaningful choice",
      "success metrics",
      "assumptions",
      "non-goals",
    ],
  },
  "design-game-systems": {
    method: "system-specification.md",
    reviewers: ["system-economy-designer", "ux-accessibility-reviewer"],
    fields: [
      "input",
      "preconditions",
      "rules",
      "state transitions",
      "output and feedback",
      "exceptions",
      "priority and concurrency",
      "failure and recovery",
      "abuse cases",
      "UI states",
      "data schema",
      "PK",
      "FK",
      "table/runtime mapping",
    ],
  },
  "design-game-content": {
    method: "content-specification.md",
    reviewers: ["content-narrative-designer", "lead-game-designer", "production-feasibility-critic"],
    fields: [
      "purpose",
      "system inputs",
      "production resources",
      "player strategy",
      "telegraph",
      "outcomes",
      "rewards",
      "repeatability",
    ],
  },
};

async function readSkill(skillId, relativePath = "SKILL.md") {
  return readFile(path.join(pluginRoot, "skills", skillId, relativePath), "utf8");
}

async function readMethod(filename) {
  return readFile(path.join(pluginRoot, "references/methods", filename), "utf8");
}

function section(markdown, heading) {
  const marker = `## ${heading}\n`;
  const start = markdown.indexOf(marker);
  assert.notEqual(start, -1, `${heading}: section missing`);
  const remainder = markdown.slice(start + marker.length);
  const end = remainder.indexOf("\n## ");
  return end === -1 ? remainder : remainder.slice(0, end);
}

function assertContains(text, values, label) {
  for (const value of values) {
    assert.match(text, new RegExp(`\\b${value.replaceAll("/", "\\/")}\\b`, "iu"), `${label}: ${value}`);
  }
}

test("core design skills use minimal trigger-only metadata and generated interfaces", async () => {
  for (const skillId of Object.keys(contracts)) {
    const [skill, openai] = await Promise.all([
      readSkill(skillId),
      readSkill(skillId, "agents/openai.yaml"),
    ]);
    const frontmatter = skill.match(/^---\n([\s\S]*?)\n---/u)?.[1];

    assert.ok(frontmatter, `${skillId}: frontmatter`);
    assert.deepEqual(
      frontmatter.split("\n").map((line) => line.split(":", 1)[0]),
      ["name", "description"],
      `${skillId}: metadata keys`,
    );
    assert.match(frontmatter, new RegExp(`^name: ${skillId}$`, "mu"));
    assert.match(frontmatter, /^description: Use when /mu);
    assert.doesNotMatch(frontmatter, /workflow|step|produce|output|review/iu);
    assert.match(openai, /display_name: "[^"]+"/u);
    assert.match(openai, /short_description: "[^"]{25,64}"/u);
    assert.match(openai, new RegExp(`default_prompt: "Use \\$${skillId} `, "u"));
  }
});

test("each skill independently owns its operating, output, review, and gate contracts", async () => {
  for (const [skillId, contract] of Object.entries(contracts)) {
    const skill = await readSkill(skillId);

    for (const heading of [
      "Triggers",
      "Non-triggers",
      "Required input",
      "Assumption policy",
      "Workflow",
      "Output contract",
      "Responsible-design gates",
      "Role reviewers",
      "Completion checks",
    ]) section(skill, heading);

    assert.match(section(skill, "Workflow"), new RegExp(`\.\./\.\./references/methods/${contract.method.replaceAll(".", "\\.")}`, "u"));
    assertContains(section(skill, "Output contract"), contract.fields, `${skillId}: output`);
    assertContains(section(skill, "Role reviewers"), contract.reviewers, `${skillId}: reviewers`);

    const gatePolicy = section(skill, "Responsible-design gates");
    assert.match(gatePolicy, new RegExp(relativeGateRegistry.replaceAll(".", "\\."), "u"));
    assert.match(gatePolicy, /applicability_questions/iu);
    assertContains(gatePolicy, ["not-applicable", "pending", "blocked", "approved"], `${skillId}: states`);
    assert.doesNotMatch(gatePolicy, /(?:state|status)[^\n]*`applicable`|`applicable`[^\n]*(?:state|status)/iu);
  }
});

test("vision method independently defines schema, claim policy, and adversarial repair", async () => {
  const method = await readMethod("vision.md");

  assertContains(section(method, "Output schema"), contracts["define-game-vision"].fields, "vision schema");
  const claims = section(method, "Claim policy");
  assertContains(claims, ["source", "baseline", "calibration owner", "validation plan"], "vision claims");
  assert.match(claims, /unsupported[^\n]*(?:age|demographic|success threshold)[^\n]*(?:assumption|provisional)/iu);
  const adversarial = section(method, "Adversarial example");
  assert.match(adversarial, /unsupported[^\n]*fun adjective|fun adjective[^\n]*unsupported/iu);
  assert.match(adversarial, /\*\*Reject:\*\*[\s\S]*\*\*Repair:\*\*/u);
});

test("system method independently defines executable schema, precedence, and provisional constants", async () => {
  const method = await readMethod("system-specification.md");

  assertContains(section(method, "Output schema"), contracts["design-game-systems"].fields, "systems schema");
  const precedence = section(method, "Rule precedence");
  assertContains(precedence, ["tie-break", "idempotency", "locks", "conflict policy", "late-event handling"], "systems precedence");
  assert.match(precedence, /rules without precedence[^\n]*(?:undefined|blocked)/iu);
  const balance = section(method, "Provisional balance values");
  assertContains(balance, ["timings", "ratios", "costs", "provisional", "validation task", "calibration owner"], "systems balance");
  assert.match(section(method, "Adversarial example"), /\*\*Reject:\*\*[\s\S]*\*\*Repair:\*\*/u);
});

test("content method independently defines schema, dependency map, and observable estimates", async () => {
  const method = await readMethod("content-specification.md");

  assertContains(section(method, "Output schema"), contracts["design-game-content"].fields, "content schema");
  const dependencies = section(method, "Canonical dependency map");
  assertContains(dependencies, ["systemId", "ruleId", "stateId", "eventId", "table.field", "pipelineStageId"], "content dependencies");
  assert.match(dependencies, /(?:disconnected|detached)[^\n]*canonical system data[^\n]*(?:blocked|block)/iu);
  const estimates = section(method, "Observable production estimate");
  assertContains(estimates, ["person-day", "team capacity", "pipeline stages", "measured throughput", "provisional", "validation task"], "content estimates");
  assert.match(section(method, "Adversarial example"), /\*\*Reject:\*\*[\s\S]*\*\*Repair:\*\*/u);
});

test("every skill and method reads the canonical registry and covers every gate and lifecycle state", async () => {
  const registry = JSON.parse(await readFile(gateRegistryPath, "utf8"));
  const allowedStates = ["not-applicable", "pending", "blocked", "approved"];
  const gateIds = [
    "ai-rights-human-approval",
    "accessibility",
    "economy-transparency",
    "liveops-experiment",
    "ugc-safety",
    "ai-npc-safety",
    "scope-control",
  ];

  assert.deepEqual(registry.allowed_states, allowedStates);
  assert.deepEqual(registry.gates.map(({ id }) => id), gateIds);
  for (const gate of registry.gates) assert.deepEqual(gate.allowed_states, allowedStates, gate.id);

  for (const [skillId, { method }] of Object.entries(contracts)) {
    const [skill, methodText] = await Promise.all([readSkill(skillId), readMethod(method)]);
    for (const [label, markdown] of [[`${skillId}: skill`, skill], [`${skillId}: method`, methodText]]) {
      const gatePolicy = section(markdown, "Responsible-design gates");
      assert.match(gatePolicy, new RegExp(relativeGateRegistry.replaceAll(".", "\\."), "u"), `${label}: registry`);
      assert.match(gatePolicy, /applicability_questions/iu, `${label}: applicability questions`);
      assert.match(gatePolicy, /evidence_fields/iu, `${label}: evidence fields`);
      assertContains(gatePolicy, gateIds, `${label}: gates`);
      assertContains(gatePolicy, allowedStates, `${label}: allowed states`);
      assert.match(gatePolicy, /applicable[^\n]*pending/iu, `${label}: applicable initializes pending`);
      assert.doesNotMatch(gatePolicy, /(?:state|status)[^\n]*`applicable`|`applicable`[^\n]*(?:state|status)/iu, `${label}: applicable is not a state`);
    }
  }
});

test("core design skill files contain no template placeholders", async () => {
  for (const [skillId, { method }] of Object.entries(contracts)) {
    const texts = await Promise.all([
      readSkill(skillId),
      readSkill(skillId, "agents/openai.yaml"),
      readMethod(method),
    ]);
    for (const text of texts) assert.doesNotMatch(text, /TODO|PLACEHOLDER|\[TODO/iu, skillId);
  }
});
