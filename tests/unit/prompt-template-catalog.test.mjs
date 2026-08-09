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
import { collectProductInventory } from "../../tooling/lib/user-guides.mjs";

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

test("Career foundation catalog has the exact IDs, levels, namespaces, and installed bindings", async () => {
  const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
  const [entries, manifest, careerInventory] = await Promise.all([
    readFile(path.join(repoRoot, "guides", "prompt-templates", "catalog", "career-foundations.json"), "utf8").then(JSON.parse),
    readFile(path.join(repoRoot, "guides", "assets", "diagram-manifest.json"), "utf8").then(JSON.parse),
    collectProductInventory(repoRoot, "game-design-career"),
  ]);
  const skills = [
    "apply-document-quality-profile",
    "map-game-design-career",
    "research-game-design-jobs",
    "reverse-engineer-game-design",
    "orchestrate-game-design-career",
  ];
  const levels = ["beginner", "standard", "advanced"];
  const expectedIds = skills.flatMap((skill) => levels.map((level) => `career:${skill}:${level}`)).sort();
  const diagramIdBySkill = new Map([
    ["apply-document-quality-profile", "ca-s01"],
    ["map-game-design-career", "ca-s05"],
    ["research-game-design-jobs", "ca-s10"],
    ["reverse-engineer-game-design", "ca-s11"],
    ["orchestrate-game-design-career", "ca-s06"],
  ]);
  const roleIds = new Set((await Promise.all([
    "document-quality-editor", "career-strategist", "game-design-mentor", "evidence-auditor", "reverse-design-critic", "portfolio-reviewer",
  ].map(async (role) => {
    await readFile(path.join(repoRoot, "products", "game-design-career", "plugin", "agents", `${role}.md`), "utf8");
    return role;
  }))));

  assert.equal(entries.length, 15);
  assert.deepEqual(entries.map(({ id }) => id).sort(), expectedIds);
  assert.deepEqual(entries.map(({ skill, level }) => `${skill}:${level}`).sort(), expectedIds.map((id) => id.replace(/^career:/u, "")));
  for (const entry of entries) {
    assert.equal(entry.kind, "skill-template", entry.id);
    assert.equal(entry.product, "career", entry.id);
    assert.match(entry.app_prompt.example, /@Game Design Career/u, entry.id);
    assert.match(entry.app_prompt.template, /@Game Design Career/u, entry.id);
    const command = new RegExp(`\\$game-design-career:${entry.skill}(?:\\s|$)`, "u");
    assert.match(entry.cli_prompt.example, command, entry.id);
    assert.match(entry.cli_prompt.template, command, entry.id);
    assert.ok(careerInventory.skillIds.includes(entry.skill), `${entry.id} installed skill`);
    for (const artifact of entry.intermediate_artifacts) {
      assert.ok(careerInventory.templateIds.includes(artifact), `${entry.id} installed template ${artifact}`);
    }
    for (const role of entry.specialist_roles) assert.ok(roleIds.has(role), `${entry.id} installed role ${role}`);
    const diagram = manifest.diagrams.find(({ id }) => id === diagramIdBySkill.get(entry.skill));
    assert.ok(diagram, `${entry.id} diagram manifest`);
    assert.equal(entry.diagram_binding.id, diagram.id, entry.id);
    assert.equal(entry.diagram_binding.svg, `guides/assets/${diagram.svg}`, entry.id);
    assert.equal(entry.diagram_binding.png, `guides/assets/${diagram.png}`, entry.id);
  }
});

test("Career foundation catalog keeps reusable placeholders, Artifact read order, and handoff ownership complete", async () => {
  const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
  const entries = JSON.parse(await readFile(
    path.join(repoRoot, "guides", "prompt-templates", "catalog", "career-foundations.json"),
    "utf8",
  ));
  const tokens = (prompt) => [...prompt.matchAll(/\[([^\]]+)\]/gu)].map(([, token]) => `[${token}]`).sort();

  for (const entry of entries) {
    assert.deepEqual(entry.placeholders.slice().sort(), [...new Set([
      ...tokens(entry.app_prompt.template),
      ...tokens(entry.cli_prompt.template),
    ])].sort(), entry.id);
    const base = entry.expected_file_tree[0].replace(/\/content\.md$/u, "");
    assert.deepEqual(entry.read_order.slice(0, 3), [
      `${base}/content.md`,
      `${base}/evidence.yml`,
      `${base}/export-manifest.yml`,
    ], entry.id);
    assert.match(entry.human_review_boundary, /owner|담당자/u, `${entry.id} owner`);
    assert.match(entry.human_review_boundary, /승인/u, `${entry.id} approval`);
    assert.match(entry.human_review_boundary, /보류|hold/iu, `${entry.id} hold`);
    assert.match(entry.resume_prompt, /보존.*재개|재개.*보존/iu, entry.id);
    assert.match(entry.safety_boundary, /미정/u, entry.id);
  }
});

test("Career foundation catalog requires fresh fact boundaries, separates fact and inference, and never promises hiring", async () => {
  const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
  const entries = JSON.parse(await readFile(
    path.join(repoRoot, "guides", "prompt-templates", "catalog", "career-foundations.json"),
    "utf8",
  ));
  const leaves = (value) => typeof value === "string" ? [value] : Array.isArray(value)
    ? value.flatMap(leaves) : value && typeof value === "object" ? Object.values(value).flatMap(leaves) : [];
  const positiveHiringGuarantee = /(?:(?:채용|합격|적합성|채용 확률)(?:을|를)?\s*(?:(?:반드시|확실히)\s*)?보장(?:한다(?!고)|합니다|함|됩니다|될 것이다)|\b(?:hiring|employment|job offer|fit)\s+is\s+guaranteed\b|\bguarantee(?:s|d)?\s+(?:hiring|employment|a job offer|fit)\b)/iu;

  for (const entry of entries) {
    const contract = leaves(entry).join(" ");
    assert.match(contract, /fact|사실/u, `${entry.id} fact label`);
    assert.match(contract, /inference|추론/u, `${entry.id} inference label`);
    assert.match(contract, /recommendation|제안/u, `${entry.id} recommendation label`);
    assert.match(contract, /현재.*(?:job|company|고용주|공고).*사용.*때만.*source URL.*retrieval.*as[- ]?of.*region.*sample|source URL.*retrieval.*as[- ]?of.*region.*sample.*현재.*(?:job|company|고용주|공고)/iu, `${entry.id} conditional current-fact boundary`);
    assert.doesNotMatch(contract, positiveHiringGuarantee, entry.id);
  }

  for (const entry of entries.filter(({ skill }) => skill === "research-game-design-jobs")) {
    const contract = leaves(entry).join(" ");
    for (const term of ["source URL", "retrieval", "as-of", "region", "sample", "blind spot"]) {
      assert.match(contract, new RegExp(term, "iu"), `${entry.id} ${term}`);
    }
  }
  for (const entry of entries.filter(({ skill }) => skill === "reverse-engineer-game-design")) {
    const contract = leaves(entry).join(" ");
    for (const term of ["observation", "rule", "UI", "economy", "counterexample", "rights", "alternative"]) {
      assert.match(contract, new RegExp(term, "iu"), `${entry.id} ${term}`);
    }
  }
  const careerMap = entries.find(({ id }) => id === "career:map-game-design-career:advanced");
  assert.ok(careerMap);
  assert.match(leaves(careerMap).join(" "), /multiple|복수.*path|path.*복수/u);
  assert.match(leaves(careerMap).join(" "), /tradeoff|교환/u);
  assert.match(leaves(careerMap).join(" "), /re-evaluat|재평가/u);
});

test("Career job-research prompt leaves independently declare every current-fact boundary", async () => {
  const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
  const entries = JSON.parse(await readFile(
    path.join(repoRoot, "guides", "prompt-templates", "catalog", "career-foundations.json"),
    "utf8",
  ));
  const boundaries = [
    /(?:source URL|공식 공고 URL)/iu,
    /retrieval date/iu,
    /as-of date/iu,
    /region/iu,
    /sample scope/iu,
    /blind spots?/iu,
  ];
  const researchEntries = entries.filter(({ skill }) => skill === "research-game-design-jobs");

  assert.equal(researchEntries.length, 3);
  for (const entry of researchEntries) {
    for (const [promptType, prompt] of Object.entries({
      "App example": entry.app_prompt.example,
      "App template": entry.app_prompt.template,
      "CLI example": entry.cli_prompt.example,
      "CLI template": entry.cli_prompt.template,
    })) {
      for (const boundary of boundaries) assert.match(prompt, boundary, `${entry.id} ${promptType} ${boundary}`);
      assert.doesNotMatch(prompt, /careers\.example\.com/iu, `${entry.id} ${promptType} invented official URL`);
    }
    for (const promptType of ["app_prompt", "cli_prompt"]) {
      assert.match(entry[promptType].template, /\[공식 공고 URL\]/u, `${entry.id} ${promptType} symbolic URL placeholder`);
    }
  }
});

test("Career reverse-engineering standard and advanced reusable prompt and output leaves independently label claims", async () => {
  const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
  const entries = JSON.parse(await readFile(
    path.join(repoRoot, "guides", "prompt-templates", "catalog", "career-foundations.json"),
    "utf8",
  ));
  const labels = [/observation/iu, /fact/iu, /inference/iu, /recommendation/iu];
  const assertClaimLabels = (entry) => {
    for (const [field, text] of Object.entries({
      "App template": entry.app_prompt.template,
      "CLI template": entry.cli_prompt.template,
    })) {
      for (const label of labels) assert.match(text, label, `${entry.id} ${field} ${label}`);
    }
    for (const [index, output] of entry.minimum_outputs.entries()) {
      for (const label of labels) assert.match(output, label, `${entry.id} minimum_outputs[${index}] ${label}`);
    }
  };

  for (const entry of entries.filter(({ skill, level }) => (
    skill === "reverse-engineer-game-design" && ["standard", "advanced"].includes(level)
  ))) {
    assertClaimLabels(entry);
    for (const [promptType, field] of [["app_prompt", "template"], ["cli_prompt", "template"]]) {
      const mutation = structuredClone(entry);
      mutation[promptType][field] = mutation[promptType][field].replace(/recommendation/iu, "claim-label-omitted");
      assert.throws(() => assertClaimLabels(mutation), assert.AssertionError, `${entry.id} ${promptType}.${field} label mutation`);
    }
    for (const index of entry.minimum_outputs.keys()) {
      const mutation = structuredClone(entry);
      mutation.minimum_outputs[index] = mutation.minimum_outputs[index].replace(/recommendation/iu, "claim-label-omitted");
      assert.throws(() => assertClaimLabels(mutation), assert.AssertionError, `${entry.id} minimum_outputs[${index}] label mutation`);
    }
  }
});

test("Career foundation user-facing prompt and minimum-output fields reject invented career claims independently", async () => {
  const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
  const entries = JSON.parse(await readFile(
    path.join(repoRoot, "guides", "prompt-templates", "catalog", "career-foundations.json"),
    "utf8",
  ));
  const unsafeClaims = [
    /채용\s*확률은\s*95%/u,
    /내가\s*실제로\s*리드해서\s*성과를\s*냈다/u,
    /이\s*직무가\s*개인에게\s*가장\s*적합하다/u,
    /(?:합격|채용)을?\s*보장(?:한다|합니다|함|됩니다)/u,
  ];
  const safeBoundaryLanguage = "합격을 보장하지 않는다. 모르는 정보는 미정으로 남기고 evidence가 필요하다.";
  const assertUserFacingSafety = (entry) => {
    const fields = [
      ["App example", entry.app_prompt.example],
      ["App template", entry.app_prompt.template],
      ["CLI example", entry.cli_prompt.example],
      ["CLI template", entry.cli_prompt.template],
      ...entry.minimum_outputs.map((output, index) => [`minimum_outputs[${index}]`, output]),
    ];
    for (const [field, text] of fields) {
      for (const unsafe of unsafeClaims) assert.doesNotMatch(text, unsafe, `${entry.id} ${field}`);
    }
  };

  for (const entry of entries) {
    assertUserFacingSafety(entry);
    assertUserFacingSafety({
      ...entry,
      app_prompt: { ...entry.app_prompt, example: `${entry.app_prompt.example} ${safeBoundaryLanguage}` },
    });
    for (const unsafeText of ["채용 확률은 95%다", "내가 실제로 리드해서 성과를 냈다", "이 직무가 개인에게 가장 적합하다", "합격을 보장한다"]) {
      for (const [promptType, field] of [["app_prompt", "example"], ["app_prompt", "template"], ["cli_prompt", "example"], ["cli_prompt", "template"]]) {
        const mutation = structuredClone(entry);
        mutation[promptType][field] = `${mutation[promptType][field]} ${unsafeText}`;
        assert.throws(() => assertUserFacingSafety(mutation), assert.AssertionError, `${entry.id} ${promptType}.${field} rejects ${unsafeText}`);
      }
      for (const index of entry.minimum_outputs.keys()) {
        const mutation = structuredClone(entry);
        mutation.minimum_outputs[index] = `${mutation.minimum_outputs[index]} ${unsafeText}`;
        assert.throws(() => assertUserFacingSafety(mutation), assert.AssertionError, `${entry.id} minimum_outputs[${index}] rejects ${unsafeText}`);
      }
    }
  }
});

test("Studio visual catalog has exact skill-level bindings and matching Studio prompt namespaces", async () => {
  const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
  const entries = JSON.parse(await readFile(
    path.join(repoRoot, "guides", "prompt-templates", "catalog", "studio-visual.json"),
    "utf8",
  ));
  const skills = [
    "plan-image-assets",
    "generate-image-assets",
    "review-image-assets",
    "visualize-game-design",
    "svg-infographic",
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
    assert.match(entry.app_prompt.example, /@Game Design Studio/u, entry.id);
    assert.match(entry.app_prompt.template, /@Game Design Studio/u, entry.id);
    assert.match(entry.cli_prompt.example, new RegExp(`\\$game-design-studio:${entry.skill}(?:\\s|$)`, "u"), entry.id);
    assert.match(entry.cli_prompt.template, new RegExp(`\\$game-design-studio:${entry.skill}(?:\\s|$)`, "u"), entry.id);
  }
});

test("Studio visual catalog preserves image mode routing, no-key capability boundaries, and defaults", async () => {
  const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
  const [entries, imagePolicy] = await Promise.all([
    readFile(path.join(repoRoot, "guides", "prompt-templates", "catalog", "studio-visual.json"), "utf8").then(JSON.parse),
    readFile(path.join(repoRoot, "guides", "game-design-studio", "image-assets.md"), "utf8"),
  ]);
  const leaves = (value) => typeof value === "string" ? [value] : Array.isArray(value)
    ? value.flatMap(leaves) : value && typeof value === "object" ? Object.values(value).flatMap(leaves) : [];
  const imageModes = (value) => [...new Set(leaves(value).flatMap((leaf) => (
    [...leaf.matchAll(/\bIMAGE_GEN_MODE\s*=\s*([a-z][a-z-]*)\b/giu)].map(([, mode]) => mode)
  )))].sort();
  const policyModes = [...imagePolicy.matchAll(/^\|\s*`([a-z][a-z-]*)`\s*\|/gmu)]
    .map(([, mode]) => mode)
    .sort();
  const allowedModes = ["all", "prompt-only", "required", "select"];
  const imageEntries = entries.filter(({ skill }) => ["plan-image-assets", "generate-image-assets"].includes(skill));
  const contract = leaves(imageEntries).join(" ");

  assert.deepEqual(policyModes, allowedModes, "source image policy closed mode set");
  assert.deepEqual(imageModes(entries), allowedModes, "Studio visual IMAGE_GEN_MODE values");
  const autoModeMutation = structuredClone(entries);
  autoModeMutation.find(({ id }) => id === "studio:generate-image-assets:advanced")
    .app_prompt.template += " IMAGE_GEN_MODE=auto";
  assert.throws(
    () => assert.deepEqual(imageModes(autoModeMutation), allowedModes),
    assert.AssertionError,
    "IMAGE_GEN_MODE=auto must fail the closed mode set",
  );
  assert.match(contract, /IMAGE_MODEL.*gpt-image-2|gpt-image-2.*IMAGE_MODEL/iu);
  assert.match(contract, /IMAGE_QUALITY.*low|low.*IMAGE_QUALITY/iu);
  assert.match(contract, /OPENAI_API_KEY.*OpenAI only.*(?:fallback|전환).*(?:금지|하지 않)|OpenAI only.*(?:fallback|전환).*(?:금지|하지 않)/iu);
  assert.match(contract, /key가 없.*host.*available.*(?:사용|전달).*unknown.*unavailable.*(?:호출하지 않|prompt.*placeholder.*보존)/iu);
  assert.doesNotMatch(contract, /\[(?:API key|OPENAI_API_KEY|credential|자격 증명)\]/iu);
});

test("Studio visual catalog placeholders exactly match both reusable prompt templates", async () => {
  const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
  const entries = JSON.parse(await readFile(
    path.join(repoRoot, "guides", "prompt-templates", "catalog", "studio-visual.json"),
    "utf8",
  ));
  const tokens = (prompt) => [...prompt.matchAll(/\[([^\]]+)\]/gu)].map(([, token]) => `[${token}]`).sort();
  const expectedPlaceholders = (entry) => [...new Set([
    ...tokens(entry.app_prompt.template),
    ...tokens(entry.cli_prompt.template),
  ])].sort();
  const assertPlaceholders = (entry) => {
    assert.deepEqual(entry.placeholders.slice().sort(), expectedPlaceholders(entry), entry.id);
  };

  for (const entry of entries) {
    assertPlaceholders(entry);

    const missingMutation = structuredClone(entry);
    missingMutation.placeholders = missingMutation.placeholders.slice(1);
    assert.throws(
      () => assertPlaceholders(missingMutation),
      assert.AssertionError,
      `${entry.id} rejects a missing placeholder`,
    );

    const extraMutation = structuredClone(entry);
    extraMutation.placeholders = [...extraMutation.placeholders, "[extra placeholder]"];
    assert.throws(
      () => assertPlaceholders(extraMutation),
      assert.AssertionError,
      `${entry.id} rejects an extra placeholder`,
    );
  }
});

test("Studio visual catalog separates asset lifecycle approval from generation and game-resource promotion", async () => {
  const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
  const entries = JSON.parse(await readFile(
    path.join(repoRoot, "guides", "prompt-templates", "catalog", "studio-visual.json"),
    "utf8",
  ));
  const leaves = (value) => typeof value === "string" ? [value] : Array.isArray(value)
    ? value.flatMap(leaves) : value && typeof value === "object" ? Object.values(value).flatMap(leaves) : [];
  const contract = leaves(entries).join(" ");
  const reviewEntries = entries.filter(({ skill }) => skill === "review-image-assets");

  assert.match(contract, /concept-draft\s*→\s*document-approved\s*→\s*production-candidate/u);
  assert.match(contract, /generation.*(?:승인.*아님|승인이 아니다)|생성.*(?:승인.*아님|승인이 아니다)/iu);
  assert.match(contract, /production-candidate.*(?:release|legal|production approval).*아님|production-candidate.*(?:출시|법무|production).*아님/iu);
  assert.match(contract, /(?:game resource|게임 리소스).*(?:자동.*승격.*금지|자동.*승격.*하지 않)|(?:자동.*승격.*금지|자동.*승격.*하지 않).*(?:game resource|게임 리소스)/iu);
  for (const entry of reviewEntries) {
    assert.match(entry.human_review_boundary, /named human|실제 담당자|이름 있는 사람/iu, entry.id);
    assert.match(entry.human_review_boundary, /승인/u, entry.id);
    assert.match(entry.human_review_boundary, /보류|hold/iu, entry.id);
  }
});

test("Studio visual catalog records Archify priority, honest Skillstead fallback, canonical read order, and diagram bindings", async () => {
  const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
  const [entries, diagramSources, useCaseManifest] = await Promise.all([
    readFile(path.join(repoRoot, "guides", "prompt-templates", "catalog", "studio-visual.json"), "utf8").then(JSON.parse),
    readFile(path.join(repoRoot, "guides", "assets", "use-case-diagram-sources.json"), "utf8").then(JSON.parse),
    readFile(path.join(repoRoot, "guides", "use-cases", "use-case-manifest.json"), "utf8").then(JSON.parse),
  ]);
  const visualEntries = entries.filter(({ skill }) => ["visualize-game-design", "svg-infographic"].includes(skill));
  const leaves = (value) => typeof value === "string" ? [value] : Array.isArray(value)
    ? value.flatMap(leaves) : value && typeof value === "object" ? Object.values(value).flatMap(leaves) : [];

  for (const entry of entries) {
    const base = entry.expected_file_tree[0].replace(/\/content\.md$/u, "");
    assert.deepEqual(entry.read_order.slice(0, 3), [
      `${base}/content.md`,
      `${base}/evidence.yml`,
      `${base}/export-manifest.yml`,
    ], entry.id);
    const source = diagramSources.find(({ semantic }) => semantic?.skill === entry.skill);
    const skillCase = useCaseManifest.skill_cases.find(({ skill }) => skill === entry.skill);
    assert.ok(source, entry.id);
    assert.ok(skillCase, entry.id);
    assert.equal(entry.diagram_binding.id, source.id, entry.id);
    assert.equal(entry.diagram_binding.svg, skillCase.diagram.svg, entry.id);
    assert.equal(entry.diagram_binding.png, skillCase.diagram.png, entry.id);
  }
  const visualContract = leaves(visualEntries).join(" ");
  assert.match(visualContract, /Archify.*(?:available|사용 가능).*우선/iu);
  assert.match(visualContract, /Archify.*(?:absent|failure|부재|실패).*Skillstead.*editable SVG.*2× PNG/iu);
  assert.match(visualContract, /fallback.*Archify 결과로.*표시.*않|Skillstead.*자동 승인.*않/iu);
  assert.match(visualContract, /lint.*0.*warning.*error.*2×.*(?:accessibility|접근성).*human approval/iu);
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

test("Studio economy levels retain required and forbidden topics in independent required leaves", async () => {
  const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
  const entries = JSON.parse(await readFile(
    path.join(repoRoot, "guides", "prompt-templates", "catalog", "studio-production.json"),
    "utf8",
  ));
  const topicRules = new Map([
    ["beginner", {
      required: [/source/iu, /sink/iu],
      forbidden: [/progression/iu, /experiment/iu, /telemetry/iu, /player protection/iu],
      requiredInputs: ["resource ID", "known source", "known sink", "보유 한도", "economy owner"],
      requiredInputTopics: [
        { leaf: "known source", topic: /source/iu },
        { leaf: "known sink", topic: /sink/iu },
      ],
    }],
    ["standard", {
      required: [/progression/iu, /guardrail/iu, /rollback/iu],
      forbidden: [/experiment/iu],
      requiredInputs: ["progression target", "guardrail", "stop 조건", "tested rollback", "economy owner"],
      requiredInputTopics: [
        { leaf: "progression target", topic: /progression/iu },
        { leaf: "guardrail", topic: /guardrail/iu },
        { leaf: "tested rollback", topic: /rollback/iu },
      ],
    }],
    ["advanced", {
      required: [/experiment/iu, /telemetry/iu, /player protection/iu],
      forbidden: [/source/iu, /sink/iu, /progression/iu, /guardrail/iu, /rollback/iu],
      requiredInputs: ["economy Artifact version", "experiment hypothesis", "telemetry 정의", "price/probability/pity 근거 상태", "player protection owner", "decision owner"],
      requiredInputTopics: [
        { leaf: "experiment hypothesis", topic: /experiment/iu },
        { leaf: "telemetry 정의", topic: /telemetry/iu },
        { leaf: "player protection owner", topic: /player protection/iu },
      ],
    }],
  ]);

  const assertTopicContract = (entry) => {
    const rules = topicRules.get(entry.level);
    assert.deepEqual(entry.required_inputs, rules.requiredInputs, `${entry.id} required input contract`);
    const requiredTextLeaves = new Map([
      ["title", entry.title],
      ["purpose", entry.purpose],
      ["App example", entry.app_prompt.example],
      ["App template", entry.app_prompt.template],
      ["CLI example", entry.cli_prompt.example],
      ["CLI template", entry.cli_prompt.template],
      ["diagram alt", entry.diagram_binding.alt],
    ]);
    for (const [field, text] of requiredTextLeaves) {
      for (const topic of rules.required) assert.match(text, topic, `${entry.id} ${field}`);
      for (const topic of rules.forbidden) assert.doesNotMatch(text, topic, `${entry.id} ${field}`);
    }
    for (const [index, input] of entry.required_inputs.entries()) {
      for (const topic of rules.forbidden) assert.doesNotMatch(input, topic, `${entry.id} required_inputs[${index}]`);
    }
    for (const topic of rules.required) {
      assert.ok(entry.required_inputs.some((input) => topic.test(input)), `${entry.id} required input topic ${topic}`);
    }
    for (const [index, output] of entry.minimum_outputs.entries()) {
      for (const topic of rules.required) assert.match(output, topic, `${entry.id} minimum_outputs[${index}]`);
      for (const topic of rules.forbidden) assert.doesNotMatch(output, topic, `${entry.id} minimum_outputs[${index}]`);
    }
    // optional_outputs와 extended_outputs는 level 확장 표현용이며 brief 필수 주제 계약에 포함하지 않는다.
  };

  for (const entry of entries.filter(({ skill }) => skill === "design-game-economy-and-liveops")) {
    assertTopicContract(entry);
    for (const promptKind of ["app_prompt", "cli_prompt"]) {
      for (const field of ["example", "template"]) {
        const mutation = structuredClone(entry);
        mutation[promptKind][field] = "@Game Design Studio required topic omitted";
        assert.throws(() => assertTopicContract(mutation), assert.AssertionError, `${entry.id} ${promptKind}.${field} topic omission`);
      }
    }
    for (const { leaf, topic } of topicRules.get(entry.level).requiredInputTopics) {
      const mutation = structuredClone(entry);
      const topicLeafIndex = mutation.required_inputs.indexOf(leaf);
      const duplicateLeafIndex = mutation.required_inputs.findIndex((input, index) => index !== topicLeafIndex && !topic.test(input));
      mutation.required_inputs[topicLeafIndex] = "topic omitted";
      mutation.required_inputs[duplicateLeafIndex] = `${mutation.required_inputs[duplicateLeafIndex]}; ${leaf}`;
      assert.throws(
        () => assertTopicContract(mutation),
        assert.AssertionError,
        `${entry.id} required input ${leaf} cannot be replaced by a duplicate topic in another leaf`,
      );
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
  const positiveGuarantee = /(?:(?:성공률?|수익|출시|채용)(?:을|를)\s*(?:(?:확실히|반드시)\s*)?보장(?!하지|되지|할 수 없)|\b(?:this|we|it)\s+guarantees?\s+(?:success(?: rate)?|revenue|launch)\b|(?<!no )\b(?:success(?: rate)?|revenue|launch)\s+is\s+guaranteed\b)/iu;
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
  for (const nonGuarantee of ["성공을 보장하지 않는다", "This is not guaranteed", "We cannot guarantee revenue", "No success is guaranteed"]) {
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
