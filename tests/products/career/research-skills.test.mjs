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

test("Role-map method requires the complete evidence-to-practice contract", async () => {
  const method = await read("references/methods/role-map.md");
  const requiredFields = [
    "roleFamily",
    "currentEvidence",
    "targetLevel",
    "gaps",
    "learningTasks",
    "feedbackCadence",
    "proofArtifacts",
  ];

  for (const field of requiredFields) assert.match(method, new RegExp(`\\b${field}\\b`, "u"));
  assert.match(method, /each learning task.*feedbackCadence/isu);
  assert.match(method, /gap.*observable exercise.*proof artifact/isu);
});

test("Role mapping offers multiple plausible paths and explicit tradeoffs", async () => {
  const skill = await read("skills/map-game-design-career/SKILL.md");

  assert.match(skill, /multiple plausible role paths/iu);
  assert.match(skill, /tradeoffs/iu);
  assert.match(skill, /provisional/iu);
  assert.match(skill, /verification task/iu);
  assert.match(skill, /Never guarantee (?:a )?(?:job|hire|career outcome)/iu);
});

test("Role mapping never ranks suitability by protected or background proxies", async () => {
  const skill = await read("skills/map-game-design-career/SKILL.md");

  assert.match(skill, /Do not rank.*education, age, major, or background/isu);
  assert.match(skill, /Do not infer suitability/iu);
  assert.match(skill, /observable evidence/iu);
});

test("Job evidence schema preserves every required field independently", async () => {
  const schema = await readJson("references/job-evidence-schema.json");
  const required = [
    "company",
    "project",
    "region",
    "employmentType",
    "postedDate",
    "sourceUrl",
    "retrievalDate",
    "responsibilities",
    "requiredSkills",
    "preferredSkills",
    "repeatedSignals",
    "applicantEvidence",
    "gaps",
    "nonGeneralizable",
    "sampleSize",
    "sampleGeography",
    "sourceType",
    "blindSpots",
    "inferenceLimits",
  ];

  assert.equal(schema.type, "object");
  assert.deepEqual(schema.required, required);
  for (const field of required) assert.ok(schema.properties[field], field);
  assert.equal(schema.additionalProperties, false);
  assert.notEqual(schema.properties.applicantEvidence, schema.properties.gaps);
  assert.notEqual(schema.properties.gaps, schema.properties.nonGeneralizable);
});

test("Job evidence records sample scope, provenance, and blind spots", async () => {
  const schema = await readJson("references/job-evidence-schema.json");

  assert.deepEqual(schema.required.slice(-5), [
    "sampleSize",
    "sampleGeography",
    "sourceType",
    "blindSpots",
    "inferenceLimits",
  ]);
  assert.equal(schema.properties.sourceType.enum[0], "official-company-career-page");
  assert.ok(schema.properties.blindSpots);
  assert.ok(schema.properties.inferenceLimits);
});

test("Research method prefers fresh primary sources and retains retrieval metadata", async () => {
  const method = await read("references/methods/job-evidence.md");

  assert.match(method, /official company career pages/iu);
  assert.match(method, /official project or platform sources/iu);
  assert.match(method, /retrievalDate/iu);
  assert.match(method, /postedDate/iu);
  assert.match(method, /sampleSize/iu);
  assert.match(method, /sampleGeography/iu);
  assert.match(method, /blindSpots/iu);
});

test("Research separates posting-specific requirements from repeated signals", async () => {
  const method = await read("references/methods/job-evidence.md");

  assert.match(method, /posting-specific requirement/iu);
  assert.match(method, /repeated market signal/iu);
  assert.match(method, /distinct primary postings/iu);
  assert.match(method, /never infer hiring volume from a single posting/iu);
  assert.match(method, /do not generalize/iu);
});

test("Research skill keeps candidate evidence and gaps honest", async () => {
  const skill = await read("skills/research-game-design-jobs/SKILL.md");

  assert.match(skill, /applicantEvidence/iu);
  assert.match(skill, /gaps/iu);
  assert.match(skill, /nonGeneralizable/iu);
  assert.match(skill, /Do not fabricate/iu);
  assert.match(skill, /missing evidence/iu);
});

test("Both skills use portable trigger-only metadata and progressive references", async () => {
  const mapSkill = await read("skills/map-game-design-career/SKILL.md");
  const researchSkill = await read("skills/research-game-design-jobs/SKILL.md");
  const mapOpenai = await read("skills/map-game-design-career/agents/openai.yaml");
  const researchOpenai = await read("skills/research-game-design-jobs/agents/openai.yaml");

  assert.match(mapSkill, /^---\nname: map-game-design-career\ndescription: Use when[^\n]+\n---\n/u);
  assert.match(researchSkill, /^---\nname: research-game-design-jobs\ndescription: Use when[^\n]+\n---\n/u);
  assert.match(mapSkill, /Read `\.\.\/\.\.\/references\/methods\/role-map\.md`/u);
  assert.match(researchSkill, /Read `\.\.\/\.\.\/references\/methods\/job-evidence\.md`/u);
  assert.match(researchSkill, /Read `\.\.\/\.\.\/references\/job-evidence-schema\.json`/u);
  assert.match(mapOpenai, /default_prompt: "[^"]*\$map-game-design-career[^"]*"/u);
  assert.match(researchOpenai, /default_prompt: "[^"]*\$research-game-design-jobs[^"]*"/u);
  assert.doesNotMatch(`${mapSkill}\n${researchSkill}\n${mapOpenai}\n${researchOpenai}`, /TODO/iu);
});
