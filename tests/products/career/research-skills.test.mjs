import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const pluginRoot = path.join(repoRoot, "products/game-design-career/plugin");

async function read(relativePath) {
  return readFile(path.join(pluginRoot, relativePath), "utf8");
}

async function readJson(relativePath) {
  return JSON.parse(await read(relativePath));
}

async function validateCollection(records, options) {
  const validatorUrl = pathToFileURL(
    path.join(pluginRoot, "skills/research-game-design-jobs/scripts/validate-job-evidence.mjs"),
  );
  const { validateJobEvidenceCollection } = await import(validatorUrl.href);
  return validateJobEvidenceCollection(records, options);
}

function posting(sourceId, repeatedSignals = [], overrides = {}) {
  return {
    sourceId,
    company: `Studio ${sourceId}`,
    region: "KR",
    postedDate: "2026-07-01",
    sourceUrl: `https://careers.example.com/jobs/${sourceId}`,
    retrievalDate: "2026-08-01",
    reviewAfter: "2026-09-01",
    responsibilities: ["Design combat systems"],
    requiredSkills: ["Write clear specifications"],
    preferredSkills: [],
    repeatedSignals,
    sampleSize: 3,
    sampleGeography: ["KR"],
    sourceType: "official-company-career-page",
    ...overrides,
  };
}

function repeatedSignal(overrides = {}) {
  return {
    signalId: "signal-design-combat-systems",
    signal: "design combat systems",
    normalizedValue: "design combat systems",
    count: 2,
    denominator: 3,
    sourceRefs: [
      {
        sourceId: "posting-a",
        field: "responsibilities",
        index: 0,
        statement: "Design combat systems",
        normalizedValue: "design combat systems",
        requirementId: "posting-a:responsibilities:0",
      },
      {
        sourceId: "posting-b",
        field: "responsibilities",
        index: 0,
        statement: "Design combat systems",
        normalizedValue: "design combat systems",
        requirementId: "posting-b:responsibilities:0",
      },
    ],
    ...overrides,
  };
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
    "sourceId",
    "company",
    "project",
    "region",
    "employmentType",
    "postedDate",
    "sourceUrl",
    "retrievalDate",
    "reviewAfter",
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
  const signal = schema.properties.repeatedSignals.items;
  assert.deepEqual(signal.required, ["signalId", "signal", "normalizedValue", "count", "denominator", "sourceRefs"]);
  assert.deepEqual(signal.properties.sourceRefs.items.required, [
    "sourceId", "field", "index", "statement", "normalizedValue", "requirementId",
  ]);
  assert.deepEqual(signal.properties.sourceRefs.items.properties.field.enum, [
    "responsibilities", "requiredSkills", "preferredSkills",
  ]);
});

test("Collection validator accepts linked repeated-signal evidence", async () => {
  const result = await validateCollection([
    posting("posting-a", [repeatedSignal()]),
    posting("posting-b"),
    posting("posting-c"),
  ], { asOfDate: "2026-08-04" });

  assert.deepEqual(result, { valid: true, errors: [] });
});

test("Collection validator rejects orphan repeated-signal source IDs", async () => {
  const signal = repeatedSignal();
  signal.sourceRefs[1].sourceId = "missing-posting";
  signal.sourceRefs[1].requirementId = "missing-posting:responsibilities:0";
  const result = await validateCollection([
    posting("posting-a", [signal], { sampleSize: 2 }),
    posting("posting-b", [], { sampleSize: 2 }),
  ], { asOfDate: "2026-08-04" });

  assert.ok(result.errors.some(({ code }) => code === "orphan-source-id"));
});

test("Collection validator rejects missing and duplicate posting source IDs", async () => {
  const result = await validateCollection([
    posting("posting-a"),
    posting("posting-a"),
    posting(""),
  ]);
  const codes = result.errors.map(({ code }) => code);

  assert.ok(codes.includes("duplicate-source-id"));
  assert.ok(codes.includes("missing-source-id"));
});

test("Collection validator rejects duplicate IDs inside one repeated signal", async () => {
  const signal = repeatedSignal({ denominator: 2 });
  signal.sourceRefs[1] = { ...signal.sourceRefs[0] };
  const result = await validateCollection([
    posting("posting-a", [signal], { sampleSize: 2 }),
    posting("posting-b", [], { sampleSize: 2 }),
  ], { asOfDate: "2026-08-04" });

  assert.ok(result.errors.some(({ code }) => code === "duplicate-signal-source-ref"));
});

test("Collection validator rejects count and denominator mismatches", async () => {
  const result = await validateCollection([
    posting("posting-a", [repeatedSignal({ count: 3, denominator: 4 })]),
    posting("posting-b"),
    posting("posting-c"),
  ], { asOfDate: "2026-08-04" });
  const codes = result.errors.map(({ code }) => code);

  assert.ok(codes.includes("signal-count-mismatch"));
  assert.ok(codes.includes("signal-denominator-mismatch"));
});

test("Collection validator rejects counts larger than the deduplicated sample", async () => {
  const result = await validateCollection([
    posting("posting-a", [repeatedSignal({ count: 3, denominator: 2 })], { sampleSize: 2 }),
    posting("posting-b", [], { sampleSize: 2 }),
  ], { asOfDate: "2026-08-04" });

  assert.ok(result.errors.some(({ code }) => code === "signal-count-exceeds-denominator"));
});

test("Collection validator binds every repeated signal to exact primary posting requirements", async () => {
  for (const [label, mutate, expectedCode] of [
    ["wrong field", (signal) => { signal.sourceRefs[0].field = "requiredSkills"; }, "signal-statement-mismatch"],
    ["wrong index", (signal) => { signal.sourceRefs[0].index = 9; signal.sourceRefs[0].requirementId = "posting-a:responsibilities:9"; }, "signal-source-index"],
    ["wrong statement", (signal) => { signal.sourceRefs[0].statement = "Invented market claim"; }, "signal-statement-mismatch"],
    ["wrong requirement ID", (signal) => { signal.sourceRefs[0].requirementId = "forged"; }, "signal-requirement-id"],
    ["invented normalized signal", (signal) => { signal.signal = "monetization"; signal.normalizedValue = "monetization"; for (const ref of signal.sourceRefs) ref.normalizedValue = "monetization"; }, "signal-normalization-mismatch"],
  ]) {
    const signal = repeatedSignal();
    mutate(signal);
    const result = await validateCollection([
      posting("posting-a", [signal]), posting("posting-b"), posting("posting-c"),
    ], { asOfDate: "2026-08-04" });
    assert.equal(result.valid, false, label);
    assert.ok(result.errors.some(({ code }) => code === expectedCode), `${label}: ${JSON.stringify(result.errors)}`);
  }
});

test("Collection validator rejects secondary, file, stale, and reversed cited sources", async () => {
  for (const [label, override, expectedCode] of [
    ["secondary", { sourceType: "secondary-context" }, "signal-source-not-primary"],
    ["file URL", { sourceUrl: "file:///tmp/forged-posting.json" }, "signal-source-url"],
    ["posted after retrieval", { postedDate: "2026-08-02", retrievalDate: "2026-08-01" }, "signal-source-date-order"],
    ["retrieval after review", { retrievalDate: "2026-09-02", reviewAfter: "2026-09-01" }, "signal-source-date-order"],
    ["stale", { reviewAfter: "2026-08-03" }, "signal-source-stale"],
  ]) {
    const result = await validateCollection([
      posting("posting-a", [repeatedSignal()], override), posting("posting-b"), posting("posting-c"),
    ], { asOfDate: "2026-08-04" });
    assert.equal(result.valid, false, label);
    assert.ok(result.errors.some(({ code }) => code === expectedCode), `${label}: ${JSON.stringify(result.errors)}`);
  }
});

test("Collection validator rejects forged large secondary samples and inconsistent scope", async () => {
  const forged = repeatedSignal({ count: 2000, denominator: 999 });
  forged.sourceRefs = Array.from({ length: 2000 }, (_, index) => ({
    sourceId: index % 2 === 0 ? "posting-a" : "posting-b",
    field: "responsibilities",
    index: 0,
    statement: "Design combat systems",
    normalizedValue: "design combat systems",
    requirementId: `${index % 2 === 0 ? "posting-a" : "posting-b"}:responsibilities:0`,
  }));
  const result = await validateCollection([
    posting("posting-a", [forged], { sourceType: "secondary-context", sourceUrl: "file:///tmp/a.json", sampleSize: 999, sampleGeography: ["GLOBAL"] }),
    posting("posting-b", [], { sourceType: "secondary-context", sourceUrl: "file:///tmp/b.json", sampleSize: 999, sampleGeography: ["GLOBAL"] }),
    posting("posting-c", [], { sourceType: "secondary-context", sourceUrl: "file:///tmp/c.json", sampleSize: 999, sampleGeography: ["GLOBAL"] }),
  ], { asOfDate: "2026-08-04" });
  const codes = new Set(result.errors.map(({ code }) => code));
  assert.ok(codes.has("duplicate-signal-source-ref"));
  assert.ok(codes.has("signal-count-mismatch"));
  assert.ok(codes.has("signal-denominator-mismatch"));
  assert.ok(codes.has("sample-size-mismatch"));
  assert.ok(codes.has("sample-geography-mismatch"));
  assert.ok(codes.has("signal-source-not-primary"));
  assert.ok(codes.has("signal-source-url"));
});

test("Collection validator requires an explicit valid as-of date for repeated signals", async () => {
  const records = [posting("posting-a", [repeatedSignal()]), posting("posting-b"), posting("posting-c")];
  assert.ok((await validateCollection(records)).errors.some(({ code }) => code === "missing-as-of-date"));
  assert.ok((await validateCollection(records, { asOfDate: "2026-02-30" })).errors.some(({ code }) => code === "invalid-as-of-date"));
});

test("Collection validator preserves empty repeated signals and rejects undersized or duplicate signals", async () => {
  const empty = await validateCollection([
    posting("posting-a", [], { sampleSize: 2 }), posting("posting-b", [], { sampleSize: 2 }),
  ]);
  assert.deepEqual(empty, { valid: true, errors: [] });

  const undersized = repeatedSignal();
  undersized.sourceRefs.pop();
  undersized.count = 1;
  const undersizedResult = await validateCollection([
    posting("posting-a", [undersized], { sampleSize: 2 }), posting("posting-b", [], { sampleSize: 2 }),
  ], { asOfDate: "2026-08-04" });
  assert.ok(undersizedResult.errors.some(({ code }) => code === "signal-source-ref-minimum"));

  const duplicateResult = await validateCollection([
    posting("posting-a", [repeatedSignal(), repeatedSignal()], { sampleSize: 3 }),
    posting("posting-b"), posting("posting-c"),
  ], { asOfDate: "2026-08-04" });
  assert.ok(duplicateResult.errors.some(({ code }) => code === "duplicate-signal-id"));
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
  assert.match(method, /reviewAfter/iu);
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
  assert.match(skill, /validate-job-evidence\.mjs/iu);
  assert.match(skill, /sourceRefs/iu);
  assert.match(skill, /byte-exact/iu);
  assert.match(skill, /--as-of/iu);
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
