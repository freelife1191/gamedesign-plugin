import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  loadPromptTemplateCatalog,
  validatePromptTemplateCatalog,
} from "../../tooling/lib/prompt-template-catalog.mjs";

const STUDIO_SKILLS = [
  "apply-document-quality-profile", "define-game-vision", "design-game-content",
  "design-game-economy-and-liveops", "design-game-systems", "design-player-experience",
  "export-game-design-documents", "generate-image-assets", "orchestrate-game-design-project",
  "plan-game-production", "plan-image-assets", "review-game-design", "review-image-assets",
  "svg-infographic", "visualize-game-design",
];
const CAREER_SKILLS = [
  "apply-document-quality-profile", "build-game-design-portfolio", "export-career-documents",
  "generate-image-assets", "map-game-design-career", "orchestrate-game-design-career",
  "plan-image-assets", "plan-junior-growth", "practice-game-design-interview",
  "research-game-design-jobs", "reverse-engineer-game-design", "review-game-design-portfolio",
  "review-image-assets", "svg-infographic", "visualize-career-roadmap",
];

function validEntry(index, kind = "skill-template") {
  const id = `PT-${String(index).padStart(3, "0")}`;
  return {
    id,
    kind,
    product: kind === "suite-case" ? "suite" : "studio",
    title: `Prompt ${index}`,
    purpose: `Purpose ${index}`,
    audiences: ["game-designer"],
    intents: [`intent-${index}`],
    level: ["beginner", "standard", "advanced"][index % 3],
    when_to_use: `Use when ${index}`,
    when_not_to_use: `Do not use when ${index}`,
    required_inputs: [`required-${index}`],
    optional_inputs: [`optional-${index}`],
    placeholders: [`{{input_${index}}}`],
    app_prompt: {
      example: `@Game Design Studio complete prompt ${index}`,
      template: `@Game Design Studio reusable prompt ${index}`,
    },
    cli_prompt: {
      example: `$game-design-studio:define-game-vision complete prompt ${index}`,
      template: `$game-design-studio:define-game-vision reusable prompt ${index}`,
    },
    skill: "define-game-vision",
    skill_chain: ["define-game-vision"],
    specialist_roles: ["lead-game-designer"],
    intermediate_artifacts: [`artifact-${index}`],
    minimum_outputs: [`minimum-${index}`],
    optional_outputs: [`optional-output-${index}`],
    extended_outputs: [`extended-${index}`],
    expected_file_tree: [`artifacts/${id}/content.md`],
    read_order: [`artifacts/${id}/content.md`],
    human_review_boundary: `Reviewer approves ${index}`,
    hold_conditions: [`hold-${index}`],
    resume_prompt: `Resume ${index} with only non-sensitive inputs.`,
    safety_boundary: `Leave unknown information as 미정 for ${index}; do not request secrets, API keys, personal data, or private materials.`,
    diagram_binding: {
      id: `diagram-${index}`,
      svg: `guides/assets/prompt-flow/${id}.svg`,
      png: `guides/assets/prompt-flow/${id}.png`,
      alt: `Prompt flow ${index}`,
    },
    related_use_cases: [],
    related_recipes: [],
    source_references: [`references/${id}.md`],
  };
}

function completeFixture() {
  const skillTemplates = [
    ...STUDIO_SKILLS.flatMap((skill, skillIndex) => ["beginner", "standard", "advanced"].map((level, levelIndex) => {
      const entry = validEntry(skillIndex * 3 + levelIndex + 1, "skill-template");
      return { ...entry, level, skill, skill_chain: [skill] };
    })),
    ...CAREER_SKILLS.flatMap((skill, skillIndex) => ["beginner", "standard", "advanced"].map((level, levelIndex) => {
      const index = 46 + skillIndex * 3 + levelIndex;
      const entry = validEntry(index, "skill-template");
      return {
        ...entry,
        product: "career",
        level,
        skill,
        skill_chain: [skill],
        app_prompt: {
          example: `@Game Design Career complete prompt ${index}`,
          template: `@Game Design Career reusable prompt ${index}`,
        },
        cli_prompt: {
          example: `$game-design-career:${skill} complete prompt ${index}`,
          template: `$game-design-career:${skill} reusable prompt ${index}`,
        },
      };
    })),
  ];
  return [
    ...skillTemplates,
    ...Array.from({ length: 36 }, (_, index) => validEntry(index + 91, "use-case")),
    ...Array.from({ length: 12 }, (_, index) => validEntry(index + 127, "recipe")),
    ...Array.from({ length: 8 }, (_, index) => validEntry(index + 139, "suite-case")),
  ];
}

function inventoryForTests({ skillIds = ["define-game-vision"], templateIds = [] } = {}) {
  return { skillIds, templateIds };
}

async function fixtureRoot(t, { entries, symlinkShard = false }) {
  const root = await mkdtemp(path.join(os.tmpdir(), "prompt-template-catalog-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const catalogDir = path.join(root, "guides", "prompt-templates", "catalog");
  await mkdir(catalogDir, { recursive: true });
  await writeFile(
    path.join(root, "guides", "prompt-templates", "catalog.json"),
    JSON.stringify({ version: 1, sources: ["catalog/entries.json"] }),
  );
  const shard = path.join(catalogDir, "entries.json");
  if (symlinkShard) {
    const target = path.join(root, "outside.json");
    await writeFile(target, JSON.stringify(entries));
    await symlink(target, shard);
  } else {
    await writeFile(shard, JSON.stringify(entries));
  }
  return root;
}

test("complete catalog has exact kind and prompt counts", () => {
  const entries = completeFixture();
  const templateIds = entries.map((entry) => entry.intermediate_artifacts[0]);
  const result = validatePromptTemplateCatalog({
    entries,
    inventories: new Map([
      ["studio", inventoryForTests({ skillIds: STUDIO_SKILLS, templateIds })],
      ["career", inventoryForTests({ skillIds: CAREER_SKILLS, templateIds })],
    ]),
    requireComplete: true,
  });
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.deepEqual(result.counts, {
    skillTemplates: 90,
    useCases: 36,
    recipes: 12,
    suiteCases: 8,
    total: 146,
    appPrompts: 146,
    cliPrompts: 146,
  });
});

test("Studio foundation catalog has the exact IDs, levels, and Studio namespaces", async () => {
  const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
  const catalogPath = path.join(repoRoot, "guides", "prompt-templates", "catalog", "studio-foundations.json");
  const entries = JSON.parse(await readFile(catalogPath, "utf8"));
  const skills = [
    "apply-document-quality-profile",
    "define-game-vision",
    "design-player-experience",
    "design-game-systems",
    "design-game-content",
  ];
  const levels = ["beginner", "standard", "advanced"];
  const expectedIds = skills.flatMap((skill) => levels.map((level) => `studio:${skill}:${level}`)).sort();

  assert.equal(entries.length, 15);
  assert.deepEqual(entries.map(({ id }) => id).sort(), expectedIds);
  assert.deepEqual(
    entries.map(({ skill, level }) => `${skill}:${level}`).sort(),
    expectedIds.map((id) => id.replace(/^studio:/u, "")).sort(),
  );
  for (const entry of entries) {
    assert.equal(entry.kind, "skill-template");
    assert.equal(entry.product, "studio");
    assert.match(entry.app_prompt.example, /@Game Design Studio/u);
    assert.match(entry.app_prompt.template, /@Game Design Studio/u);
    assert.match(entry.cli_prompt.example, /\$game-design-studio:[a-z-]+/u);
    assert.match(entry.cli_prompt.template, /\$game-design-studio:[a-z-]+/u);
  }
});

test("Studio foundation catalog placeholders exactly match both reusable prompt templates", async () => {
  const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
  const catalogPath = path.join(repoRoot, "guides", "prompt-templates", "catalog", "studio-foundations.json");
  const entries = JSON.parse(await readFile(catalogPath, "utf8"));
  const tokens = (prompt) => [...prompt.matchAll(/\[([^\]]+)\]/gu)].map(([, token]) => `[${token}]`).sort();

  for (const entry of entries) {
    const templateTokens = [...new Set([
      ...tokens(entry.app_prompt.template),
      ...tokens(entry.cli_prompt.template),
    ])].sort();
    assert.deepEqual(entry.placeholders.slice().sort(), templateTokens, entry.id);
  }
});

test("Studio foundation catalog reads canonical Artifact files before optional decisions", async () => {
  const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
  const catalogPath = path.join(repoRoot, "guides", "prompt-templates", "catalog", "studio-foundations.json");
  const entries = JSON.parse(await readFile(catalogPath, "utf8"));

  for (const entry of entries) {
    const base = entry.expected_file_tree[0].replace(/\/content\.md$/u, "");
    assert.deepEqual(entry.read_order.slice(0, 3), [
      `${base}/content.md`,
      `${base}/evidence.yml`,
      `${base}/export-manifest.yml`,
    ], entry.id);
    if (entry.read_order.includes(`${base}/decisions/README.md`)) {
      assert.equal(entry.read_order.at(-1), `${base}/decisions/README.md`, entry.id);
    }
  }
});

test("Studio production catalog has the exact IDs, levels, and Studio namespaces", async () => {
  const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
  const catalogPath = path.join(repoRoot, "guides", "prompt-templates", "catalog", "studio-production.json");
  const entries = JSON.parse(await readFile(catalogPath, "utf8"));
  const skills = [
    "design-game-economy-and-liveops",
    "plan-game-production",
    "orchestrate-game-design-project",
    "review-game-design",
    "export-game-design-documents",
  ];
  const levels = ["beginner", "standard", "advanced"];
  const expectedIds = skills.flatMap((skill) => levels.map((level) => `studio:${skill}:${level}`)).sort();

  assert.equal(entries.length, 15);
  assert.deepEqual(entries.map(({ id }) => id).sort(), expectedIds);
  assert.deepEqual(
    entries.map(({ skill, level }) => `${skill}:${level}`).sort(),
    expectedIds.map((id) => id.replace(/^studio:/u, "")).sort(),
  );
  for (const entry of entries) {
    assert.equal(entry.kind, "skill-template");
    assert.equal(entry.product, "studio");
    assert.match(entry.app_prompt.example, /@Game Design Studio/u);
    assert.match(entry.app_prompt.template, /@Game Design Studio/u);
    assert.match(entry.cli_prompt.example, new RegExp(`\\$game-design-studio:${entry.skill}(?:\\s|$)`, "u"));
    assert.match(entry.cli_prompt.template, new RegExp(`\\$game-design-studio:${entry.skill}(?:\\s|$)`, "u"));
  }
});

test("Studio production catalog placeholders exactly match both reusable prompt templates", async () => {
  const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
  const catalogPath = path.join(repoRoot, "guides", "prompt-templates", "catalog", "studio-production.json");
  const entries = JSON.parse(await readFile(catalogPath, "utf8"));
  const tokens = (prompt) => [...prompt.matchAll(/\[([^\]]+)\]/gu)].map(([, token]) => `[${token}]`).sort();

  for (const entry of entries) {
    const templateTokens = [...new Set([
      ...tokens(entry.app_prompt.template),
      ...tokens(entry.cli_prompt.template),
    ])].sort();
    assert.deepEqual(entry.placeholders.slice().sort(), templateTokens, entry.id);
  }
});

test("Studio production catalog preserves output ownership and renderer capability boundaries", async () => {
  const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
  const catalogPath = path.join(repoRoot, "guides", "prompt-templates", "catalog", "studio-production.json");
  const entries = JSON.parse(await readFile(catalogPath, "utf8"));
  const prohibitedGuarantees = /(?:성공률|수익|출시|채용)을 보장(?:한다|합니다|함)/iu;

  for (const entry of entries) {
    const contract = [
      entry.purpose,
      entry.minimum_outputs.join(" "),
      entry.optional_outputs.join(" "),
      entry.extended_outputs.join(" "),
      entry.human_review_boundary,
      entry.hold_conditions.join(" "),
      entry.resume_prompt,
      entry.safety_boundary,
    ].join(" ");
    assert.match(entry.human_review_boundary, /owner|승인|보류/iu, entry.id);
    assert.match(entry.resume_prompt, /보존.*재개|재개.*보존/iu, entry.id);
    assert.match(entry.safety_boundary, /미정/u, entry.id);
    assert.doesNotMatch(contract, prohibitedGuarantees, entry.id);
  }

  const economyEntries = entries.filter(({ skill }) => skill === "design-game-economy-and-liveops");
  for (const entry of economyEntries) {
    assert.match(
      [entry.purpose, ...entry.minimum_outputs, ...entry.optional_outputs, ...entry.extended_outputs, entry.safety_boundary].join(" "),
      /provisional|미정/iu,
      entry.id,
    );
  }

  const exportEntries = entries.filter(({ skill }) => skill === "export-game-design-documents");
  for (const entry of exportEntries) {
    const contract = [
      ...entry.minimum_outputs,
      ...entry.optional_outputs,
      ...entry.extended_outputs,
      entry.human_review_boundary,
      entry.hold_conditions.join(" "),
    ].join(" ");
    assert.match(contract, /capability.*preflight.*QA|preflight.*capability.*QA|renderer/iu, entry.id);
    assert.match(entry.human_review_boundary, /downstream|renderer|QA/iu, entry.id);
  }
});

test("Studio production catalog reads canonical Artifact files before optional decisions", async () => {
  const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
  const catalogPath = path.join(repoRoot, "guides", "prompt-templates", "catalog", "studio-production.json");
  const entries = JSON.parse(await readFile(catalogPath, "utf8"));

  for (const entry of entries) {
    const base = entry.expected_file_tree[0].replace(/\/content\.md$/u, "");
    assert.deepEqual(entry.read_order.slice(0, 3), [
      `${base}/content.md`,
      `${base}/evidence.yml`,
      `${base}/export-manifest.yml`,
    ], entry.id);
    if (entry.read_order.includes(`${base}/decisions/README.md`)) {
      assert.equal(entry.read_order.at(-1), `${base}/decisions/README.md`, entry.id);
    }
  }
});

test("Studio production diagram bindings resolve the matching manifest skill and SVG/PNG records", async () => {
  const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
  const [entries, diagramSources, useCaseManifest] = await Promise.all([
    readFile(path.join(repoRoot, "guides", "prompt-templates", "catalog", "studio-production.json"), "utf8").then(JSON.parse),
    readFile(path.join(repoRoot, "guides", "assets", "use-case-diagram-sources.json"), "utf8").then(JSON.parse),
    readFile(path.join(repoRoot, "guides", "use-cases", "use-case-manifest.json"), "utf8").then(JSON.parse),
  ]);

  for (const entry of entries) {
    const source = diagramSources.find(({ semantic }) => semantic?.skill === entry.skill);
    const skillCase = useCaseManifest.skill_cases.find(({ skill }) => skill === entry.skill);
    assert.ok(source, entry.id);
    assert.ok(skillCase, entry.id);
    assert.equal(entry.diagram_binding.id, source.id, entry.id);
    assert.equal(entry.diagram_binding.svg, skillCase.diagram.svg, entry.id);
    assert.equal(entry.diagram_binding.png, skillCase.diagram.png, entry.id);
  }
});

test("Studio economy levels retain required and forbidden topics in every major prompt, contract, result, and diagram field", async () => {
  const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
  const entries = JSON.parse(await readFile(
    path.join(repoRoot, "guides", "prompt-templates", "catalog", "studio-production.json"),
    "utf8",
  ));
  const topicRules = new Map([
    ["beginner", {
      required: [/source/iu, /sink/iu],
      forbidden: [/progression/iu, /experiment/iu, /telemetry/iu, /player protection/iu],
    }],
    ["standard", {
      required: [/progression/iu, /guardrail/iu, /rollback/iu],
      forbidden: [/experiment/iu],
    }],
    ["advanced", {
      required: [/experiment/iu, /telemetry/iu, /player protection/iu],
      forbidden: [/source/iu, /sink/iu, /progression/iu, /guardrail/iu, /rollback/iu],
    }],
  ]);

  for (const entry of entries.filter(({ skill }) => skill === "design-game-economy-and-liveops")) {
    const fields = new Map([
      ["title", entry.title],
      ["purpose", entry.purpose],
      ["App prompt", `${entry.app_prompt.example} ${entry.app_prompt.template}`],
      ["CLI prompt", `${entry.cli_prompt.example} ${entry.cli_prompt.template}`],
      ["required inputs", entry.required_inputs.join(" ")],
      ["result layers", [...entry.minimum_outputs, ...entry.optional_outputs, ...entry.extended_outputs].join(" ")],
      ["diagram alt", entry.diagram_binding.alt],
    ]);
    const rules = topicRules.get(entry.level);
    for (const [field, text] of fields) {
      for (const topic of rules.required) assert.match(text, topic, `${entry.id} ${field}`);
      for (const topic of rules.forbidden) assert.doesNotMatch(text, topic, `${entry.id} ${field}`);
    }
  }
});

test("Studio production catalog rejects positive guarantees and requires separate human ownership, approval, and hold contracts", async () => {
  const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
  const entries = JSON.parse(await readFile(
    path.join(repoRoot, "guides", "prompt-templates", "catalog", "studio-production.json"),
    "utf8",
  ));
  const leafStrings = (value) => {
    if (typeof value === "string") return [value];
    if (Array.isArray(value)) return value.flatMap(leafStrings);
    if (value && typeof value === "object") return Object.values(value).flatMap(leafStrings);
    return [];
  };
  const positiveGuarantee = /(?:(?:성공률?|수익|출시|채용)(?:을|를)\s*(?:(?:확실히|반드시)\s*)?보장(?!하지|되지|할 수 없)|\b(?:this|we|it)\s+guarantees?\s+(?:success(?: rate)?|revenue|launch)\b|\b(?:success(?: rate)?|revenue|launch)\s+is\s+guaranteed\b)/iu;
  const positiveGuarantees = [
    "성공을 확실히 보장한다",
    "This guarantees success",
    "Revenue is guaranteed",
    "출시를 보장한다",
  ];

  for (const entry of entries) {
    assert.doesNotMatch(leafStrings(entry).join(" "), positiveGuarantee, entry.id);
    assert.match(entry.human_review_boundary, /owner/iu, `${entry.id} owner`);
    assert.match(entry.human_review_boundary, /(?:lead-game-designer|system-economy-designer|liveops-data-designer|production-feasibility-critic|ux-accessibility-reviewer|document-quality-editor)/u, `${entry.id} human role`);
    assert.match(entry.human_review_boundary, /승인/u, `${entry.id} human approval`);
    assert.match(entry.human_review_boundary, /보류/iu, `${entry.id} hold`);
    const userPromptFields = Object.entries(entry.app_prompt).concat(Object.entries(entry.cli_prompt));
    const contractFields = leafStrings(entry).map((text, index) => [`contract[${index}]`, text]);
    for (const guarantee of positiveGuarantees) {
      for (const [field, text] of userPromptFields.concat(contractFields)) {
        assert.throws(
          () => assert.doesNotMatch(`${text} ${guarantee}`, positiveGuarantee),
          assert.AssertionError,
          `${entry.id} ${field} rejects ${guarantee}`,
        );
      }
    }
  }
  for (const nonGuarantee of ["성공을 보장하지 않는다", "This is not guaranteed", "We cannot guarantee revenue"]) {
    assert.doesNotMatch(nonGuarantee, positiveGuarantee, nonGuarantee);
  }
});

test("Studio export standard and advanced defer actual output until every renderer gate passes", async () => {
  const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
  const entries = JSON.parse(await readFile(
    path.join(repoRoot, "guides", "prompt-templates", "catalog", "studio-production.json"),
    "utf8",
  ));

  for (const entry of entries.filter(({ skill, level }) => (
    skill === "export-game-design-documents" && ["standard", "advanced"].includes(level)
  ))) {
    const contract = leafStrings(entry).join(" ");
    assert.match(
      contract,
      /capability.*canonical preflight.*renderer.*format QA.*모두 통과.*downstream.*actual output.*표시/iu,
      entry.id,
    );
  }

  function leafStrings(value) {
    if (typeof value === "string") return [value];
    if (Array.isArray(value)) return value.flatMap(leafStrings);
    if (value && typeof value === "object") return Object.values(value).flatMap(leafStrings);
    return [];
  }
});

test("loader rejects duplicate IDs and symlink shards", async (t) => {
  const duplicate = validEntry(1);
  const duplicateRoot = await fixtureRoot(t, { entries: [duplicate, { ...duplicate }] });
  await assert.rejects(
    () => loadPromptTemplateCatalog({ repoRoot: duplicateRoot }),
    /duplicate prompt template id/u,
  );

  const symlinkRoot = await fixtureRoot(t, { entries: [validEntry(2)], symlinkShard: true });
  await assert.rejects(
    () => loadPromptTemplateCatalog({ repoRoot: symlinkRoot }),
    /symlink/u,
  );
});

test("validator closes unknown fields and rejects unsafe or sensitive prompt contracts", () => {
  const entry = validEntry(1);
  const result = validatePromptTemplateCatalog({
    entries: [{ ...entry, unexpected: true }],
  });
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /unknown prompt template field/u);

  const unsafe = validEntry(2);
  unsafe.expected_file_tree = ["../escape.md"];
  unsafe.app_prompt.example = "@Game Design Studio enter your API key";
  const unsafeResult = validatePromptTemplateCatalog({ entries: [unsafe] });
  assert.equal(unsafeResult.ok, false);
  assert.match(unsafeResult.errors.join("\n"), /unsafe path|API key/u);
});

test("validator resolves intermediate artifact templates against the product inventory", () => {
  const entry = validEntry(3);
  entry.intermediate_artifacts = ["unknown-template"];
  const result = validatePromptTemplateCatalog({
    entries: [entry],
    inventories: new Map([["studio", {
      skillIds: ["define-game-vision"],
      templateIds: ["known-template"],
    }]]),
    rolesByProduct: new Map([["studio", new Set(["lead-game-designer"])]]),
  });
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /unknown studio template/u);
});

test("validator rejects duplicate resume prompt text", () => {
  const first = validEntry(4);
  const second = validEntry(5);
  second.resume_prompt = first.resume_prompt;
  const result = validatePromptTemplateCatalog({ entries: [first, second] });
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /duplicate prompt text/u);
});

test("complete catalogs require every installed product skill at each level exactly once", () => {
  const entries = completeFixture().map((entry) => entry.kind === "skill-template" ? {
    ...entry,
    product: "studio",
    skill: "define-game-vision",
    skill_chain: ["define-game-vision"],
    app_prompt: {
      example: `@Game Design Studio complete prompt ${entry.id}`,
      template: `@Game Design Studio reusable prompt ${entry.id}`,
    },
    cli_prompt: {
      example: `$game-design-studio:define-game-vision complete prompt ${entry.id}`,
      template: `$game-design-studio:define-game-vision reusable prompt ${entry.id}`,
    },
  } : entry);
  const templateIds = entries.map((entry) => entry.intermediate_artifacts[0]);
  const result = validatePromptTemplateCatalog({
    entries,
    inventories: new Map([
      ["studio", inventoryForTests({ skillIds: ["define-game-vision", "design-game-systems"], templateIds })],
      ["career", inventoryForTests({ skillIds: ["map-game-design-career"], templateIds })],
    ]),
    requireComplete: true,
  });
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /skill-template cardinality.*found 30/u);
  assert.match(result.errors.join("\n"), /skill-template cardinality.*found 0/u);
});

test("suite product cannot define a skill-template", () => {
  const entry = validEntry(9, "skill-template");
  entry.product = "suite";
  const result = validatePromptTemplateCatalog({ entries: [entry] });
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /suite.*skill-template/u);
});

test("suite prompt paths reject arbitrary App mentions and missing or unknown CLI commands", () => {
  const entry = validEntry(6, "suite-case");
  entry.app_prompt.example = "@Unrelated App complete prompt";
  entry.app_prompt.template = "@Unrelated App reusable prompt";
  entry.cli_prompt.example = "$game-design-studio: unknown command";
  entry.cli_prompt.template = "$game-design-career:not-installed reusable prompt";
  const result = validatePromptTemplateCatalog({
    entries: [entry],
    inventories: new Map([
      ["studio", inventoryForTests()],
      ["career", inventoryForTests({ skillIds: ["map-game-design-career"] })],
    ]),
  });
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /suite.*App|suite.*CLI/u);
});

test("product CLI prompts require a registered namespace command", () => {
  const entry = validEntry(7);
  entry.cli_prompt.example = "$game-design-studio:not-installed complete prompt";
  const result = validatePromptTemplateCatalog({
    entries: [entry],
    inventories: new Map([["studio", inventoryForTests({ templateIds: entry.intermediate_artifacts })]]),
  });
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /unknown studio CLI skill/u);
});

test("safety boundary requires 미정 handling and resume prompts cannot request sensitive inputs", () => {
  const entry = validEntry(8);
  entry.safety_boundary = "Keep the work safe.";
  entry.resume_prompt = "Resume after you provide your credentials.";
  const result = validatePromptTemplateCatalog({ entries: [entry] });
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /미정/u);
  assert.match(result.errors.join("\n"), /resume_prompt.*credentials/u);
});

test("resume prompts do not treat an unrelated without phrase as a credential prohibition", () => {
  const entry = validEntry(10);
  entry.resume_prompt = "Resume without delay after you provide your credentials.";
  const result = validatePromptTemplateCatalog({ entries: [entry] });
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /resume_prompt.*credentials/u);
});

test("resume prompts require a prohibition directed at the sensitive input", () => {
  const entry = validEntry(12);
  entry.resume_prompt = "Do not delay, then provide your credentials.";
  const result = validatePromptTemplateCatalog({ entries: [entry] });
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /resume_prompt.*credentials/u);
});

test("safety boundaries prohibit every sensitive-input category independently", () => {
  const entry = validEntry(11);
  entry.safety_boundary = "미정. Provide API keys; do not request personal data.";
  const result = validatePromptTemplateCatalog({ entries: [entry] });
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /safety_boundary.*credential|safety_boundary.*API key/u);
});

test("safety boundaries reject a credential request after a different category prohibition", () => {
  const entry = validEntry(13);
  entry.safety_boundary = "미정. Do not request personal data but provide API keys. Do not request private materials.";
  const result = validatePromptTemplateCatalog({ entries: [entry] });
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /safety_boundary.*credentials/u);
});

test("resume prompts reject a credential request after a different category prohibition", () => {
  const entry = validEntry(14);
  entry.resume_prompt = "Do not request personal data but provide your credentials.";
  const result = validatePromptTemplateCatalog({ entries: [entry] });
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /resume_prompt.*credentials/u);
});

test("safety boundaries reject credential requests appended to a direct prohibition", () => {
  const entry = validEntry(15);
  entry.safety_boundary = "미정. Do not request credentials but ask for credentials. Do not request personal data. Do not request private materials.";
  const result = validatePromptTemplateCatalog({ entries: [entry] });
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /safety_boundary.*credentials/u);
});

test("resume prompts allow direct prohibitions on providing API keys", () => {
  const entry = validEntry(16);
  entry.resume_prompt = "Do not provide API keys.";
  const result = validatePromptTemplateCatalog({ entries: [entry] });
  assert.equal(result.ok, true, result.errors.join("\n"));
});

test("resume prompts allow direct prohibitions on sharing credentials", () => {
  const entry = validEntry(17);
  entry.resume_prompt = "Never share credentials.";
  const result = validatePromptTemplateCatalog({ entries: [entry] });
  assert.equal(result.ok, true, result.errors.join("\n"));
});

test("resume prompts reject credential requests after a credential not-required statement", () => {
  const entry = validEntry(18);
  entry.resume_prompt = "Credentials are not required but provide your credentials.";
  const result = validatePromptTemplateCatalog({ entries: [entry] });
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /resume_prompt.*credentials/u);
});

test("resume prompts reject credential requests after a without-credentials statement", () => {
  const entry = validEntry(19);
  entry.resume_prompt = "Resume without credentials after you provide your credentials.";
  const result = validatePromptTemplateCatalog({ entries: [entry] });
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /resume_prompt.*credentials/u);
});
