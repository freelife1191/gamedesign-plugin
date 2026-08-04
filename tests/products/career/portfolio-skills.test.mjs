import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const pluginRoot = path.join(repoRoot, "products/game-design-career/plugin");

async function read(relativePath) {
  return readFile(path.join(pluginRoot, relativePath), "utf8");
}

async function readJson(relativePath) {
  return JSON.parse(await read(relativePath));
}

test("portfolio: method preserves the exact evidence-design sequence", async () => {
  const method = await read("references/methods/portfolio-evidence.md");
  const sequence =
    "target competency → problem/user → evidence → hypothesis/intent → rules/UI/data/content → constraints/alternatives → implementation/test → result/decision → retrospective";

  assert.match(method, new RegExp(sequence, "u"));
  assert.match(method, /Follow this order exactly/iu);
});

test("portfolio: every claim is addressable, recoverable, and reviewable", async () => {
  const method = await read("references/methods/portfolio-evidence.md");
  const requiredFields = [
    "claimId",
    "evidenceAddress",
    "provenance",
    "strength",
    "status",
    "recoveryOwner",
    "recoveryAction",
    "inspectabilityGate",
  ];

  for (const field of requiredFields) assert.match(method, new RegExp(`\\b${field}\\b`, "u"));
  assert.match(method, /missing.*same record.*recoveryOwner.*recoveryAction/isu);
  assert.match(method, /reviewer.*locate.*verify.*without.*author/isu);
});

test("portfolio: skill makes competence inspectable instead of substituting visual polish", async () => {
  const skill = await read("skills/build-game-design-portfolio/SKILL.md");
  const capabilities = [
    "design judgment",
    "implementation handoff",
    "data reasoning",
    "playtest learning",
    "scope control",
    "collaboration",
    "iteration",
  ];

  for (const capability of capabilities) assert.match(skill, new RegExp(capability, "iu"));
  assert.match(skill, /Visual polish (?:must|does) not substitute/iu);
  assert.match(skill, /Read `\.\.\/\.\.\/references\/methods\/portfolio-evidence\.md`/u);
  assert.match(skill, /inspectabilityGate/iu);
});

test("reverse: schema stores every material claim as an independent fact-inference record", async () => {
  const schema = await readJson("references/fact-inference-schema.json");
  const required = [
    "claimId",
    "domain",
    "observation",
    "inference",
    "confidence",
    "counterexample",
    "alternative",
    "validationMethod",
  ];

  assert.equal(schema.type, "object");
  assert.deepEqual(schema.required, required);
  for (const field of required) assert.ok(schema.properties[field], field);
  assert.deepEqual(schema.properties.domain.enum, ["UI", "rules", "data", "operations", "uncertainty"]);
  assert.equal(schema.properties.alternative.minItems, 1);
  assert.equal(schema.properties.validationMethod.minLength, 1);
  assert.equal(schema.additionalProperties, false);
});

test("reverse: schema blocks unsupported likelihood when observation is absent", async () => {
  const schema = await readJson("references/fact-inference-schema.json");
  const zeroEvidenceRule = schema.allOf.find(
    (rule) => rule.if?.properties?.observation?.maxItems === 0,
  );

  assert.ok(zeroEvidenceRule, "missing zero-evidence rule");
  assert.deepEqual(zeroEvidenceRule.if.required, ["observation"]);
  assert.equal(zeroEvidenceRule.then.properties.inference.const, null);
  assert.equal(zeroEvidenceRule.then.properties.confidence.const, "unassessed");
});

test("reverse: schema requires evidence and falsification fields for a non-null inference", async () => {
  const schema = await readJson("references/fact-inference-schema.json");
  const inferenceRule = schema.allOf.find(
    (rule) => rule.if?.properties?.inference?.type === "string",
  );

  assert.ok(inferenceRule, "missing inference evidence rule");
  assert.equal(inferenceRule.then.properties.observation.minItems, 1);
  assert.equal(inferenceRule.then.properties.counterexample.minItems, 1);
  assert.equal(inferenceRule.then.properties.alternative.minItems, 1);
  assert.equal(inferenceRule.then.properties.validationMethod.minLength, 1);
});

test("reverse: method covers system surfaces and falsifiable claim boundaries", async () => {
  const method = await read("references/methods/reverse-design.md");
  const fields = [
    "observation",
    "inference",
    "confidence",
    "counterexample",
    "alternative",
    "validationMethod",
  ];

  for (const field of fields) assert.match(method, new RegExp(`\\b${field}\\b`, "u"));
  assert.match(method, /one material claim per record/iu);
  assert.match(method, /UI states/iu);
  assert.match(method, /rules.*exceptions/isu);
  assert.match(method, /data/iu);
  assert.match(method, /operations/iu);
  assert.match(method, /uncertainty/iu);
  assert.match(method, /not a user manual/iu);
});

test("reverse: skill keeps facts observed and intent or implementation inferential", async () => {
  const skill = await read("skills/reverse-engineer-game-design/SKILL.md");

  assert.match(skill, /observed behavior.*cited material.*facts/isu);
  assert.match(skill, /internal intent.*data structures.*economy purpose.*production constraints.*inferences/isu);
  assert.match(skill, /Do not assign.*most likely.*zero game-specific evidence/isu);
  assert.match(skill, /Read `\.\.\/\.\.\/references\/methods\/reverse-design\.md`/u);
  assert.match(skill, /Read `\.\.\/\.\.\/references\/fact-inference-schema\.json`/u);
});

test("metadata: both skills use trigger-only frontmatter and generated UI metadata", async () => {
  const portfolioSkill = await read("skills/build-game-design-portfolio/SKILL.md");
  const reverseSkill = await read("skills/reverse-engineer-game-design/SKILL.md");
  const portfolioOpenai = await read("skills/build-game-design-portfolio/agents/openai.yaml");
  const reverseOpenai = await read("skills/reverse-engineer-game-design/agents/openai.yaml");

  assert.match(portfolioSkill, /^---\nname: build-game-design-portfolio\ndescription: Use when[^\n]+\n---\n/u);
  assert.match(reverseSkill, /^---\nname: reverse-engineer-game-design\ndescription: Use when[^\n]+\n---\n/u);
  assert.match(portfolioOpenai, /default_prompt: "[^"]*\$build-game-design-portfolio[^"]*"/u);
  assert.match(reverseOpenai, /default_prompt: "[^"]*\$reverse-engineer-game-design[^"]*"/u);
  assert.doesNotMatch(
    `${portfolioSkill}\n${reverseSkill}\n${portfolioOpenai}\n${reverseOpenai}`,
    /TODO/iu,
  );
});
