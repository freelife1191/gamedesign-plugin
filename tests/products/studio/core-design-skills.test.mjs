import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const pluginRoot = path.join(repoRoot, "products/game-design-studio/plugin");

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

test("every skill declares the complete operating and completion contract", async () => {
  for (const [skillId, contract] of Object.entries(contracts)) {
    const skill = await readSkill(skillId);

    for (const section of [
      "Triggers",
      "Non-triggers",
      "Required input",
      "Assumption policy",
      "Workflow",
      "Output contract",
      "Responsible-design gates",
      "Role reviewers",
      "Completion checks",
    ]) {
      assert.match(skill, new RegExp(`^## ${section}$`, "mu"), `${skillId}: ${section}`);
    }
    assert.match(skill, new RegExp(`\.\./\.\./references/methods/${contract.method.replaceAll(".", "\\.")}`, "u"));
    for (const reviewer of contract.reviewers) {
      assert.match(skill, new RegExp(`\\b${reviewer}\\b`, "u"), `${skillId}: ${reviewer}`);
    }
    assert.match(skill, /approved|blocked/iu, `${skillId}: completion state`);
  }
});

test("vision output is testable and keeps unsupported demographic and metric claims provisional", async () => {
  const [skill, method] = await Promise.all([
    readSkill("define-game-vision"),
    readMethod(contracts["define-game-vision"].method),
  ]);
  const text = `${skill}\n${method}`;

  for (const field of contracts["define-game-vision"].fields) {
    assert.match(text, new RegExp(`\\b${field}\\b`, "iu"), field);
  }
  for (const evidenceField of ["source", "baseline", "calibration owner", "validation plan"]) {
    assert.match(text, new RegExp(`\\b${evidenceField}\\b`, "iu"), evidenceField);
  }
  assert.match(text, /age|demographic/iu);
  assert.match(text, /unsupported[^\n]*(?:age|demographic|success threshold)[^\n]*(?:assumption|provisional)/iu);
  assert.match(text, /core fun[^\n]*(?:verb|decision|tension|feedback)/iu);
  assert.match(text, /unsupported[^\n]*fun adjective|fun adjective[^\n]*unsupported/iu);
});

test("system output specifies executable state and data behavior", async () => {
  const [skill, method] = await Promise.all([
    readSkill("design-game-systems"),
    readMethod(contracts["design-game-systems"].method),
  ]);
  const text = `${skill}\n${method}`;

  for (const field of contracts["design-game-systems"].fields) {
    assert.match(text, new RegExp(`\\b${field.replaceAll("/", "\\/")}\\b`, "iu"), field);
  }
  assert.match(text, /timings|ratios|costs|balance values/iu);
  assert.match(text, /(?:timings|ratios|costs|balance values)[^\n]*(?:provisional|assumption)/iu);
  assert.match(text, /validation task/iu);
  assert.match(text, /rules without precedence|precedence[^\n]*(?:missing|undefined|blocked)/iu);
});

test("content output remains attached to canonical systems, data, and observable production evidence", async () => {
  const [skill, method] = await Promise.all([
    readSkill("design-game-content"),
    readMethod(contracts["design-game-content"].method),
  ]);
  const text = `${skill}\n${method}`;

  for (const field of contracts["design-game-content"].fields) {
    assert.match(text, new RegExp(`\\b${field}\\b`, "iu"), field);
  }
  assert.match(text, /person-days?/iu);
  assert.match(text, /team|pipeline/iu);
  assert.match(text, /person-days?[^\n]*(?:evidence|assumption|provisional)/iu);
  assert.match(text, /canonical[^\n]*(?:system|data)[^\n]*(?:ID|dependency)/iu);
  assert.match(text, /content[^\n]*(?:detached|disconnect)[^\n]*(?:production cost|system data)/iu);
});

test("methods define applicable responsible-design gates and evidence states", async () => {
  const methods = await Promise.all(Object.values(contracts).map(({ method }) => readMethod(method)));
  const text = methods.join("\n");

  for (const token of ["applicable", "not-applicable", "pending", "blocked", "approved", "evidence", "owner"]) {
    assert.match(text, new RegExp(`\\b${token}\\b`, "iu"), token);
  }
  for (const gate of ["accessibility", "scope-control", "ugc-safety", "ai-npc-safety", "economy-transparency"]) {
    assert.match(text, new RegExp(`\\b${gate}\\b`, "u"), gate);
  }
  assert.match(text, /missing evidence[^\n]*(?:not|never)[^\n]*approved/iu);
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
