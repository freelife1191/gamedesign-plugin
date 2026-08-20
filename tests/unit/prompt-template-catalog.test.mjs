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

// The regex tolerates `**` emphasis around the backticked mode name because bolding the
// default mode row previously hid it from this extractor and broke the closed-mode-set
// contract. It also scans the whole document rather than only the mode table, so a future
// table whose first cell is a backticked lowercase identifier would silently join the
// closed mode set.
function imagePolicyModes(markdown) {
  return [...markdown.matchAll(/^\|\s*\**\s*`([a-z][a-z-]*)`\s*\**\s*\|/gmu)]
    .map(([, mode]) => mode)
    .sort();
}

const STUDIO_SKILLS = [
  "apply-document-quality-profile", "define-game-vision", "design-cutscene-visual-preproduction", "design-game-content",
  "design-game-economy-and-liveops", "design-game-systems", "design-player-experience",
  "export-game-design-documents", "generate-image-assets", "orchestrate-game-design-project",
  "plan-game-production", "plan-image-assets", "review-game-design", "review-image-assets",
  "svg-infographic", "visualize-game-design", "polish-game-design-writing",
  "game-design-studio",
];
const CAREER_SKILLS = [
  "apply-document-quality-profile", "build-game-design-portfolio", "export-career-documents",
  "generate-image-assets", "map-game-design-career", "orchestrate-game-design-career",
  "plan-image-assets", "plan-junior-growth", "practice-game-design-interview",
  "research-game-design-jobs", "reverse-engineer-game-design", "review-game-design-portfolio",
  "review-image-assets", "svg-infographic", "visualize-career-roadmap", "polish-game-design-writing",
  "game-design-career",
];

function validEntry(index, kind = "skill-template") {
  const id = `PT-${String(index).padStart(3, "0")}`;
  return {
    id,
    kind,
    product: kind === "suite-case" ? "suite" : "studio",
    title: `Prompt ${index}`,
    display_title: `프롬프트 ${index}`,
    sample_result_excerpt: `가상 결과 조각: 핵심 항목은 검토 전 초안으로 둡니다. 확인할 점: 근거 연결 여부. (ID: ${id}; 파일: artifacts/${id}/content.md)`,
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
      const index = STUDIO_SKILLS.length * 3 + skillIndex * 3 + levelIndex + 1;
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
    ...Array.from({ length: 36 }, (_, index) => ({
      ...validEntry(index + 110, "use-case"),
      source_case_id: `SOURCE-${index + 1}`,
    })),
    ...Array.from({ length: 12 }, (_, index) => validEntry(index + 146, "recipe")),
    ...Array.from({ length: 8 }, (_, index) => validEntry(index + 158, "suite-case")),
  ];
}

function inventoryForTests({ skillIds = ["define-game-vision"], templateIds = [] } = {}) {
  return { skillIds, templateIds };
}

function withoutPromptTemplateSections(markdown) {
  return markdown.replace(/\n?<!-- PROMPT-TEMPLATES:START [^>]+ -->[\s\S]*?<!-- PROMPT-TEMPLATES:END [^>]+ -->\n?/gu, "\n");
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
    skillTemplates: 105,
    useCases: 36,
    recipes: 12,
    suiteCases: 8,
    total: 161,
    appPrompts: 161,
    cliPrompts: 161,
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
      assert.match(
        entry[promptType].template,
        entry.level === "beginner" ? /\[공식 공고 URL\]/u : /\[공식 공고 URL 목록\]/u,
        `${entry.id} ${promptType} symbolic URL placeholder`,
      );
    }
  }
});

test("Career job-research preserves single-posting beginner and collection interfaces for standard and advanced", async () => {
  const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
  const entries = JSON.parse(await readFile(
    path.join(repoRoot, "guides", "prompt-templates", "catalog", "career-foundations.json"),
    "utf8",
  )).filter(({ skill }) => skill === "research-game-design-jobs");
  const assertPostingCardinality = (entry) => {
    const appLeaves = [entry.app_prompt.example, entry.app_prompt.template];
    const cliLeaves = [entry.cli_prompt.example, entry.cli_prompt.template];
    if (entry.level === "beginner") {
      assert.ok(entry.required_inputs.includes("official source URL"), `${entry.id} single required input`);
      assert.ok(!entry.required_inputs.includes("official source URLs"), `${entry.id} no collection required input`);
      for (const leaf of appLeaves) {
        assert.match(leaf, /단일 공식 공고 URL|\[공식 공고 URL\]/u, `${entry.id} single App leaf`);
        assert.doesNotMatch(leaf, /공식 공고 URL 목록/u, `${entry.id} no App collection`);
      }
      for (const leaf of cliLeaves) {
        assert.match(leaf, /\bofficialPostingUrl=/u, `${entry.id} single CLI field`);
        assert.doesNotMatch(leaf, /\bofficialPostingUrls=/u, `${entry.id} no CLI collection`);
      }
      return;
    }
    assert.ok(entry.required_inputs.includes("official source URLs"), `${entry.id} collection required input`);
    assert.ok(!entry.required_inputs.includes("official source URL"), `${entry.id} no single required input`);
    for (const leaf of appLeaves) {
      assert.match(leaf, /복수 공식 공고 URL 목록|\[공식 공고 URL 목록\]/u, `${entry.id} collection App leaf`);
      assert.doesNotMatch(leaf, /단일 공식 공고 URL/u, `${entry.id} no single App leaf`);
    }
    for (const leaf of cliLeaves) {
      assert.match(leaf, /\bofficialPostingUrls=/u, `${entry.id} collection CLI field`);
      assert.doesNotMatch(leaf, /\bofficialPostingUrl=(?!s)/u, `${entry.id} no single CLI field`);
      assert.match(leaf, /공식 공고 URL 목록/u, `${entry.id} collection CLI value`);
    }
  };

  assert.equal(entries.length, 3);
  for (const entry of entries) {
    assertPostingCardinality(entry);
    for (const [promptType, field] of [["app_prompt", "example"], ["app_prompt", "template"], ["cli_prompt", "example"], ["cli_prompt", "template"]]) {
      const mutation = structuredClone(entry);
      if (entry.level === "beginner") {
        mutation[promptType][field] = mutation[promptType][field]
          .replace(/officialPostingUrl=/u, "officialPostingUrls=")
          .replace(/공식 공고 URL(?! 목록)/u, "공식 공고 URL 목록");
      } else {
        mutation[promptType][field] = mutation[promptType][field]
          .replace(/officialPostingUrls=/u, "officialPostingUrl=")
          .replace(/공식 공고 URL 목록/u, "단일 공식 공고 URL");
      }
      assert.throws(
        () => assertPostingCardinality(mutation),
        assert.AssertionError,
        `${entry.id} ${promptType}.${field} rejects wrong posting cardinality`,
      );
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

test("Career evidence catalog has exact skill-level IDs, installed bindings, placeholders, and canonical read order", async () => {
  const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
  const [entries, manifest, careerInventory] = await Promise.all([
    readFile(path.join(repoRoot, "guides", "prompt-templates", "catalog", "career-evidence.json"), "utf8").then(JSON.parse),
    readFile(path.join(repoRoot, "guides", "assets", "diagram-manifest.json"), "utf8").then(JSON.parse),
    collectProductInventory(repoRoot, "game-design-career"),
  ]);
  const skills = [
    "build-game-design-portfolio",
    "practice-game-design-interview",
    "review-game-design-portfolio",
    "plan-junior-growth",
    "export-career-documents",
  ];
  const levels = ["beginner", "standard", "advanced"];
  const expectedIds = skills.flatMap((skill) => levels.map((level) => `career:${skill}:${level}`)).sort();
  const diagramIdBySkill = new Map([
    ["build-game-design-portfolio", "ca-s02"],
    ["export-career-documents", "ca-s03"],
    ["plan-junior-growth", "ca-s08"],
    ["practice-game-design-interview", "ca-s09"],
    ["review-game-design-portfolio", "ca-s12"],
  ]);
  const roleIds = new Set((await Promise.all([
    "career-strategist", "document-quality-editor", "evidence-auditor", "game-design-mentor", "interview-coach", "portfolio-reviewer",
  ].map(async (role) => {
    await readFile(path.join(repoRoot, "products", "game-design-career", "plugin", "agents", `${role}.md`), "utf8");
    return role;
  }))));
  const tokens = (prompt) => [...prompt.matchAll(/\[([^\]]+)\]/gu)].map(([, token]) => `[${token}]`).sort();

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
    assert.deepEqual(entry.placeholders.slice().sort(), [...new Set([
      ...tokens(entry.app_prompt.template),
      ...tokens(entry.cli_prompt.template),
    ])].sort(), entry.id);
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
    const base = entry.expected_file_tree[0].replace(/\/content\.md$/u, "");
    assert.deepEqual(entry.read_order.slice(0, 3), [
      `${base}/content.md`,
      `${base}/evidence.yml`,
      `${base}/export-manifest.yml`,
    ], entry.id);
  }
});

test("Career evidence templates preserve traceable claims, honest interview boundaries, growth evidence, review ownership, and export gates", async () => {
  const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
  const entries = JSON.parse(await readFile(
    path.join(repoRoot, "guides", "prompt-templates", "catalog", "career-evidence.json"),
    "utf8",
  ));
  const text = (entry) => [
    entry.app_prompt.example,
    entry.app_prompt.template,
    entry.cli_prompt.example,
    entry.cli_prompt.template,
    ...entry.minimum_outputs,
    ...entry.optional_outputs,
    ...entry.extended_outputs,
    entry.human_review_boundary,
    entry.hold_conditions.join(" "),
    entry.resume_prompt,
    entry.safety_boundary,
  ].join(" ");
  const leaves = (entry) => [
    entry.app_prompt.example,
    entry.app_prompt.template,
    entry.cli_prompt.example,
    entry.cli_prompt.template,
    ...entry.minimum_outputs,
  ];

  for (const entry of entries) {
    assert.match(text(entry), /fact|사실/u, `${entry.id} fact label`);
    assert.match(text(entry), /inference|추론/u, `${entry.id} inference label`);
    assert.match(text(entry), /recommendation|제안/u, `${entry.id} recommendation label`);
    assert.match(entry.human_review_boundary, /owner|담당자/u, `${entry.id} owner`);
    assert.match(entry.human_review_boundary, /승인/u, `${entry.id} approval`);
    assert.match(entry.human_review_boundary, /보류|hold/iu, `${entry.id} hold`);
    assert.match(entry.resume_prompt, /보존.*재개|재개.*보존/iu, `${entry.id} resume`);
    assert.match(entry.safety_boundary, /미정/u, `${entry.id} unknown`);
    for (const leaf of leaves(entry)) {
      assert.doesNotMatch(leaf, /채용\s*확률은\s*95%|내가\s*실제로\s*리드해서\s*성과를\s*냈다|합격을\s*보장/u, `${entry.id} honest leaf`);
    }
  }

  for (const entry of entries.filter(({ skill }) => skill === "build-game-design-portfolio")) {
    const contract = text(entry);
    for (const term of ["claimId", "evidenceAddress", "source", "personal contribution", "team contribution", "미정", "비공개"]) {
      assert.match(contract, new RegExp(term, "iu"), `${entry.id} ${term}`);
    }
  }
  for (const entry of entries.filter(({ skill }) => skill === "practice-game-design-interview")) {
    const contract = text(entry);
    for (const term of ["questionId", "evidence", "stale", "최신", "honest-answer"]) {
      assert.match(contract, new RegExp(term, "iu"), `${entry.id} ${term}`);
    }
  }
  assert.match(text(entries.find(({ id }) => id === "career:practice-game-design-interview:advanced")), /coach|interview-coach/u);

  for (const entry of entries.filter(({ skill }) => skill === "review-game-design-portfolio")) {
    const contract = text(entry);
    for (const term of ["finding", "severity", "queue"]) assert.match(contract, new RegExp(term, "iu"), `${entry.id} ${term}`);
  }
  const advancedReview = text(entries.find(({ id }) => id === "career:review-game-design-portfolio:advanced"));
  for (const term of ["presentation readiness", "named human", "자동 합격 판정 금지"]) {
    assert.match(advancedReview, new RegExp(term, "iu"), `advanced review ${term}`);
  }

  assert.match(text(entries.find(({ id }) => id === "career:plan-junior-growth:beginner")), /4주/u);
  assert.match(text(entries.find(({ id }) => id === "career:plan-junior-growth:standard")), /12주.*evidence project|evidence project.*12주/u);
  const advancedGrowth = text(entries.find(({ id }) => id === "career:plan-junior-growth:advanced"));
  for (const term of ["fresh requirement", "re-evaluation", "observable"]) {
    assert.match(advancedGrowth, new RegExp(term, "iu"), `advanced growth ${term}`);
  }

  for (const entry of entries.filter(({ skill }) => skill === "export-career-documents")) {
    const contract = text(entry);
    for (const term of ["canonical", "preflight", "capability", "renderer", "format QA", "human review"]) {
      assert.match(contract, new RegExp(term, "iu"), `${entry.id} ${term}`);
    }
    assert.match(contract, /actual output.*전.*전달 완료|전달 완료.*actual output.*전/u, `${entry.id} non-terminal export`);
  }
});

test("Career export prompt leaves preserve ordered all-gates, downstream ownership, and separated authority", async () => {
  const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
  const entries = JSON.parse(await readFile(
    path.join(repoRoot, "guides", "prompt-templates", "catalog", "career-evidence.json"),
    "utf8",
  )).filter(({ skill }) => skill === "export-career-documents");
  const assertExportLeaf = (leaf) => {
    assert.match(leaf, /canonical preflight.*capability.*renderer.*format QA.*human review.*모두 통과하기 전/u);
    assert.match(leaf, /actual output.*표시 금지/u);
    assert.match(leaf, /delivery completion.*표시 금지/u);
    assert.match(leaf, /downstream workflow.*actual output.*소유/u);
    assert.match(leaf, /이 prompt.*preparation\/hold만 소유/u);
    assert.match(leaf, /document-quality-editor는 구조\/format finding만/u);
    assert.match(leaf, /evidence-auditor는 evidence completion gate/u);
    assert.match(leaf, /named human decision owner.*승인\/보류/u);
  };
  const allGateTerms = ["canonical preflight", "capability", "renderer", "format QA", "human review"];

  assert.equal(entries.length, 3);
  for (const entry of entries) {
    assert.ok(entry.specialist_roles.includes("document-quality-editor"), `${entry.id} document editor`);
    assert.ok(entry.specialist_roles.includes("evidence-auditor"), `${entry.id} evidence auditor`);
    assert.match(entry.human_review_boundary, /document-quality-editor.*구조\/format finding만/u, `${entry.id} editor scope`);
    assert.doesNotMatch(entry.human_review_boundary, /document-quality-editor[^.]*승인|document-quality-editor[^.]*보류/u, `${entry.id} editor no decision`);
    assert.match(entry.human_review_boundary, /evidence-auditor.*evidence completion gate/u, `${entry.id} evidence gate`);
    assert.match(entry.human_review_boundary, /named human decision owner.*승인\/보류/u, `${entry.id} decision owner`);
    for (const [promptType, field] of [["app_prompt", "example"], ["app_prompt", "template"], ["cli_prompt", "example"], ["cli_prompt", "template"]]) {
      const leaf = entry[promptType][field];
      assertExportLeaf(leaf);
      for (const term of [...allGateTerms, "actual output", "delivery completion", "downstream workflow", "preparation/hold"]) {
        const mutation = structuredClone(entry);
        mutation[promptType][field] = leaf.replaceAll(term, "omitted-contract-token");
        assert.throws(() => assertExportLeaf(mutation[promptType][field]), assert.AssertionError, `${entry.id} ${promptType}.${field} rejects ${term} mutation`);
      }
    }
    for (const term of ["evidence-auditor", "named human decision owner"]) {
      const mutation = structuredClone(entry);
      mutation.human_review_boundary = mutation.human_review_boundary.replace(term, "omitted-authority");
      assert.throws(() => {
        assert.match(mutation.human_review_boundary, /evidence-auditor.*evidence completion gate/u);
        assert.match(mutation.human_review_boundary, /named human decision owner.*승인\/보류/u);
      }, assert.AssertionError, `${entry.id} authority swap mutation ${term}`);
    }
  }
});

test("Advanced portfolio review leaves separate readiness from named-human approval and keep the agent non-decisive", async () => {
  const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
  const entry = JSON.parse(await readFile(
    path.join(repoRoot, "guides", "prompt-templates", "catalog", "career-evidence.json"),
    "utf8",
  )).find(({ id }) => id === "career:review-game-design-portfolio:advanced");
  const assertAdvancedReviewLeaf = (leaf) => {
    assert.match(leaf, /presentation readiness.*human approval.*분리/u);
    assert.match(leaf, /named-human reviewer ID/u);
    assert.match(leaf, /approval state/u);
    assert.match(leaf, /자동 합격\/채용 판정 금지/u);
    assert.match(leaf, /portfolio-reviewer agent.*finding만.*승인자 아님/u);
  };

  assert.ok(entry);
  for (const [promptType, field] of [["app_prompt", "example"], ["app_prompt", "template"], ["cli_prompt", "example"], ["cli_prompt", "template"]]) {
    const leaf = entry[promptType][field];
    assertAdvancedReviewLeaf(leaf);
    for (const term of ["presentation readiness", "human approval", "named-human reviewer ID", "approval state", "자동 합격/채용 판정 금지", "portfolio-reviewer agent"]) {
      const mutation = structuredClone(entry);
      mutation[promptType][field] = leaf.replaceAll(term, "omitted-review-contract");
      assert.throws(() => assertAdvancedReviewLeaf(mutation[promptType][field]), assert.AssertionError, `${promptType}.${field} rejects ${term} mutation`);
    }
  }
});

test("Portfolio standard and advanced CLI leaves independently preserve result layers, attribution, and unknown-private boundaries", async () => {
  const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
  const entries = JSON.parse(await readFile(
    path.join(repoRoot, "guides", "prompt-templates", "catalog", "career-evidence.json"),
    "utf8",
  )).filter(({ skill, level }) => skill === "build-game-design-portfolio" && ["standard", "advanced"].includes(level));
  const assertPortfolioCliLeaf = (leaf) => {
    assert.match(leaf, /result layers=fact,inference,recommendation/u);
    assert.match(leaf, /personal attribution/u);
    assert.match(leaf, /team attribution/u);
    assert.match(leaf, /unknown=미정/u);
    assert.match(leaf, /private=비공개/u);
  };

  assert.equal(entries.length, 2);
  for (const entry of entries) {
    for (const field of ["example", "template"]) {
      const leaf = entry.cli_prompt[field];
      assertPortfolioCliLeaf(leaf);
      for (const term of ["result layers=fact,inference,recommendation", "personal attribution", "team attribution", "unknown=미정", "private=비공개"]) {
        const mutation = structuredClone(entry);
        mutation.cli_prompt[field] = leaf.replaceAll(term, "omitted-cli-contract");
        assert.throws(() => assertPortfolioCliLeaf(mutation.cli_prompt[field]), assert.AssertionError, `${entry.id} CLI ${field} rejects ${term} mutation`);
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

function assertCutscenePromptCards(entries) {
  const cards = entries.filter((entry) => entry.skill === "design-cutscene-visual-preproduction");
  assert.deepEqual(cards.map((entry) => entry.id), [
    "studio:design-cutscene-visual-preproduction:beginner",
    "studio:design-cutscene-visual-preproduction:standard",
    "studio:design-cutscene-visual-preproduction:advanced",
  ]);
  assert.deepEqual(cards.map((entry) => entry.level), ["beginner", "standard", "advanced"]);
  for (const card of cards) {
    assert.equal(card.product, "studio");
    assert.match(card.cli_prompt.example, /^\$game-design-studio:design-cutscene-visual-preproduction\b/u);
    assert.ok(card.source_references.includes("guides/game-design-studio/skills/design-cutscene-visual-preproduction.md"));
    assert.ok(card.source_references.includes("guides/game-design-studio/cutscene-visual-preproduction.md"));
    assert.deepEqual(card.diagram_binding, {
      id: "st-s16",
      svg: "guides/assets/game-design-studio/skills/design-cutscene-visual-preproduction.svg",
      png: "guides/assets/game-design-studio/skills/design-cutscene-visual-preproduction.png",
      alt: "컷씬 장면·이미지 사전 설계 흐름",
    });
  }
  const advanced = cards.at(-1);
  for (const field of ["current wave", "count", "provider", "model", "quality", "size", "USD min/expected/max", "finite cap", "retryReserve", "pricing time", "costStatus", "named approval"]) {
    assert.ok(advanced.required_inputs.includes(field), `advanced cutscene card requires ${field}`);
  }
  assert.match(advanced.when_not_to_use, /과거·포괄 승인/u);
  assert.match(advanced.resume_prompt, /최신 retryable stable ID.*같은 current full-wave estimate.*named live approval/u);
  const paidPolicy = JSON.stringify({ app: advanced.app_prompt, cli: advanced.cli_prompt });
  assert.match(paidPolicy, /image_gen|codex-first/iu);
  assert.match(paidPolicy, /한글.*gpt-image-2|gpt-image-2.*한글/isu);
  assert.match(paidPolicy, /low.*기본.*medium.*(?:master|마스터).*high.*예외/isu);
  assert.doesNotMatch(paidPolicy, /quality=high/iu);
}

function assertCutsceneProjection(entries) {
  assert.deepEqual(entries.filter((entry) => entry.skill === "design-cutscene-visual-preproduction").map((entry) => entry.id), [
    "studio:design-cutscene-visual-preproduction:beginner",
    "studio:design-cutscene-visual-preproduction:standard",
    "studio:design-cutscene-visual-preproduction:advanced",
  ]);
}

test("Studio cutscene prompt catalog keeps three ordered approval-safe cards and rejects mutations", async () => {
  const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
  const catalog = await loadPromptTemplateCatalog({ repoRoot });
  assertCutscenePromptCards(catalog.entries);
  const advancedInputs = catalog.entries.find((entry) => entry.id === "studio:design-cutscene-visual-preproduction:advanced").required_inputs;
  for (const field of advancedInputs) {
    const mutated = catalog.entries.map((entry) => entry.id === "studio:design-cutscene-visual-preproduction:advanced"
      ? { ...entry, required_inputs: entry.required_inputs.filter((value) => value !== field) }
      : entry);
    assert.throws(() => assertCutscenePromptCards(mutated), new RegExp(field.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"), `advanced required input mutation: ${field}`);
  }
  const cutsceneCards = catalog.entries.filter((entry) => entry.skill === "design-cutscene-visual-preproduction");
  const reordered = [...catalog.entries.filter((entry) => entry.skill !== "design-cutscene-visual-preproduction"), ...[...cutsceneCards].reverse()];
  assert.throws(() => assertCutscenePromptCards(reordered), /Expected values to be strictly deep-equal/u, "three-card order mutation");
  const missingSource = catalog.entries.map((entry) => entry.id === "studio:design-cutscene-visual-preproduction:beginner"
    ? { ...entry, source_references: entry.source_references.slice(1) }
    : entry);
  assert.throws(() => assertCutscenePromptCards(missingSource), /design-cutscene-visual-preproduction\.md/u, "source reference mutation");
  const wrongDiagram = catalog.entries.map((entry) => entry.id === "studio:design-cutscene-visual-preproduction:standard"
    ? { ...entry, diagram_binding: { ...entry.diagram_binding, id: "st-s11" } }
    : entry);
  assert.throws(() => assertCutscenePromptCards(wrongDiagram), /st-s16/u, "cutscene diagram binding mutation");
  const projection = JSON.parse(await readFile(path.join(repoRoot, "products", "game-design-studio", "plugin", "references", "prompt-templates.json"), "utf8"));
  assertCutsceneProjection(projection.entries);
  assert.throws(() => assertCutsceneProjection(projection.entries.filter((entry) => entry.id !== "studio:design-cutscene-visual-preproduction:standard")), /Expected values to be strictly deep-equal/u, "projection mutation");
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
  const policyModes = imagePolicyModes(imagePolicy);
  const allowedModes = ["all", "prompt-only", "required", "select"];
  const generationEntries = entries.filter(({ skill }) => skill === "generate-image-assets");
  const contract = leaves(generationEntries).join(" ");

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
  assert.match(contract, /IMAGE_PROVIDER.*codex-first|codex-first.*IMAGE_PROVIDER/iu);
  assert.match(contract, /host image_gen/iu);
  assert.match(contract, /IMAGE_EMBEDDED_TEXT_LOCALE=ko-KR.*gpt-image-2|gpt-image-2.*IMAGE_EMBEDDED_TEXT_LOCALE=ko-KR/iu);
  assert.match(contract, /low.*medium.*high/iu);
  assert.match(contract, /explicit OpenAI.*승인|승인.*explicit OpenAI/iu);
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

test("Career visual plan and review prompt leaves prohibit provider calls independently", async () => {
  const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
  const entries = JSON.parse(await readFile(
    path.join(repoRoot, "guides", "prompt-templates", "catalog", "career-visual.json"), "utf8",
  ));
  const planTerms = [
    ["prompt와", /prompt와/iu],
    ["placeholder와", /placeholder와/iu],
    ["manifest,", /manifest,/iu],
    ["generation handoff", /generation handoff/iu],
    ["provider/image generation 호출 0회", /provider\/image generation 호출 0회/iu],
  ];
  const reviewTerms = [
    ["existing asset와", /existing asset와/iu],
    ["immutable receipt만", /immutable receipt만/iu],
    ["provider/image generation 호출 금지", /provider\/image generation 호출 금지/iu],
  ];
  const assertPlanLeaf = (leaf) => {
    for (const [, pattern] of planTerms) assert.match(leaf, pattern);
    assert.doesNotMatch(leaf, /OPENAI_API_KEY|OpenAI only|host available|selected jobs/iu);
  };
  const assertReviewLeaf = (leaf) => {
    for (const [, pattern] of reviewTerms) assert.match(leaf, pattern);
    assert.doesNotMatch(leaf, /OPENAI_API_KEY|OpenAI only|host available|selected jobs/iu);
  };

  for (const entry of entries.filter(({ skill }) => skill === "plan-image-assets")) {
    for (const [promptType, field] of [["app_prompt", "example"], ["app_prompt", "template"], ["cli_prompt", "example"], ["cli_prompt", "template"]]) {
      const leaf = entry[promptType][field];
      assertPlanLeaf(leaf);
      for (const [term] of planTerms) {
        const mutation = structuredClone(entry);
        mutation[promptType][field] = leaf.replaceAll(term, "omitted-call-boundary");
        assert.throws(() => assertPlanLeaf(mutation[promptType][field]), assert.AssertionError, `${entry.id} ${promptType}.${field} ${term}`);
      }
    }
  }
  for (const entry of entries.filter(({ skill }) => skill === "review-image-assets")) {
    for (const [promptType, field] of [["app_prompt", "example"], ["app_prompt", "template"], ["cli_prompt", "example"], ["cli_prompt", "template"]]) {
      const leaf = entry[promptType][field];
      assertReviewLeaf(leaf);
      for (const [term] of reviewTerms) {
        const mutation = structuredClone(entry);
        mutation[promptType][field] = leaf.replaceAll(term, "omitted-call-boundary");
        assert.throws(() => assertReviewLeaf(mutation[promptType][field]), assert.AssertionError, `${entry.id} ${promptType}.${field} ${term}`);
      }
    }
  }
});

test("Career visual generation prompt leaves carry provider routing independently", async () => {
  const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
  const entries = JSON.parse(await readFile(
    path.join(repoRoot, "guides", "prompt-templates", "catalog", "career-visual.json"), "utf8",
  )).filter(({ skill }) => skill === "generate-image-assets");
  const providerTerms = [
    ["IMAGE_PROVIDER=codex-first", /IMAGE_PROVIDER=codex-first/iu],
    ["IMAGE_QUALITY=low", /IMAGE_QUALITY=low/iu],
    ["host image_gen", /host image_gen/iu],
    ["API key 존재는 유료 승인이 아니며", /API key.*유료 승인.*아니/iu],
    ["IMAGE_EMBEDDED_TEXT_LOCALE=ko-KR", /IMAGE_EMBEDDED_TEXT_LOCALE=ko-KR.*gpt-image-2/iu],
    ["medium은 선택된 master/key image, high는 예외적인 video hero frame/production concept art", /medium.*master.*high.*(?:video hero frame|production concept art)/iu],
    ["비용을 먼저 안내하고 승인 뒤 실행", /비용.*승인 뒤 실행/iu],
  ];
  const assertGenerationLeaf = (leaf) => {
    for (const [, pattern] of providerTerms) assert.match(leaf, pattern);
  };

  for (const entry of entries) {
    for (const [promptType, field] of [["app_prompt", "example"], ["app_prompt", "template"], ["cli_prompt", "example"], ["cli_prompt", "template"]]) {
      const leaf = entry[promptType][field];
      assertGenerationLeaf(leaf);
      for (const [term] of providerTerms) {
        const mutation = structuredClone(entry);
        mutation[promptType][field] = leaf.replaceAll(term, "omitted-provider-policy");
        assert.throws(() => assertGenerationLeaf(mutation[promptType][field]), assert.AssertionError, `${entry.id} ${promptType}.${field} ${term}`);
      }
    }
  }
});

test("Career review standard and advanced prompt leaves require immutable named-human transition evidence", async () => {
  const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
  const entries = JSON.parse(await readFile(
    path.join(repoRoot, "guides", "prompt-templates", "catalog", "career-visual.json"), "utf8",
  )).filter(({ skill, level }) => skill === "review-image-assets" && ["standard", "advanced"].includes(level));
  const commonTransitionTerms = [
    "actual user decision", "reviewedAt", "immutable structured host-user-image-decision receipt",
    "누락 또는 불일치", "current state", "유지·hold",
  ];
  const standardTerms = ["targetState=document-approved", ...commonTransitionTerms];
  const advancedTerms = [
    "targetState=production-candidate", ...commonTransitionTerms,
    "rightsDecision", "active-rights evidence", "technical fit evidence", "alt text", "readability evidence",
  ];
  const assertTerms = (leaf, terms) => {
    for (const term of terms) assert.match(leaf, new RegExp(term, "iu"));
  };
  const assertStandardLeaf = (leaf) => {
    assertTerms(leaf, standardTerms);
  };
  const assertAdvancedLeaf = (leaf) => {
    assertTerms(leaf, advancedTerms);
  };

  assert.equal(entries.length, 2);
  for (const entry of entries) {
    const assertion = entry.level === "advanced" ? assertAdvancedLeaf : assertStandardLeaf;
    for (const [promptType, field] of [["app_prompt", "example"], ["app_prompt", "template"], ["cli_prompt", "example"], ["cli_prompt", "template"]]) {
      const leaf = entry[promptType][field];
      assertion(leaf);
      for (const term of entry.level === "advanced" ? advancedTerms : standardTerms) {
        const mutation = structuredClone(entry);
        mutation[promptType][field] = leaf.replaceAll(term, "omitted-transition-evidence");
        assert.throws(() => assertion(mutation[promptType][field]), assert.AssertionError, `${entry.id} ${promptType}.${field} ${term}`);
      }
    }
  }
});

test("Career review standard and advanced hold and resume stable evidence keys have exact bidirectional parity", async () => {
  const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
  const entries = JSON.parse(await readFile(
    path.join(repoRoot, "guides", "prompt-templates", "catalog", "career-visual.json"), "utf8",
  )).filter(({ skill, level }) => skill === "review-image-assets" && ["standard", "advanced"].includes(level));
  const keysByLevel = {
    standard: ["targetState", "actualUserDecision", "reviewedAt", "hostUserImageDecisionReceipt", "namedHumanReviewer", "rightsDecision", "placement", "altText", "readability"],
    advanced: ["targetState", "actualUserDecision", "reviewedAt", "hostUserImageDecisionReceipt", "namedHumanReviewer", "rightsDecision", "activeRights", "technicalFit", "altText", "readability"],
  };
  const extractHoldKeys = (entry) => entry.hold_conditions.map((condition) => {
    const keys = [...condition.matchAll(/\bevidenceKey=([A-Za-z][A-Za-z0-9]*)\b/gu)].map(([, key]) => key);
    assert.equal(keys.length, 1, `${entry.id} hold condition must declare exactly one evidence key`);
    return keys[0];
  });
  const extractResumeKeys = (entry) => {
    const matches = [...entry.resume_prompt.matchAll(/repair\/verify evidenceKeys=\[([A-Za-z0-9,]+)\]/gu)];
    assert.equal(matches.length, 1, `${entry.id} resume repair/verify key list`);
    return matches[0][1].split(",");
  };
  const assertParity = (entry) => {
    const expected = keysByLevel[entry.level].slice().sort();
    const held = extractHoldKeys(entry);
    const resumed = extractResumeKeys(entry);
    assert.match(entry.resume_prompt, /검증된 evidence만 보존/iu, entry.id);
    assert.equal(new Set(held).size, held.length, `${entry.id} duplicate hold key`);
    assert.equal(new Set(resumed).size, resumed.length, `${entry.id} duplicate resume key`);
    assert.deepEqual(held.slice().sort(), expected, `${entry.id} hold key set`);
    assert.deepEqual(resumed.slice().sort(), expected, `${entry.id} resume key set`);
  };

  assert.equal(entries.length, 2);
  for (const entry of entries) {
    assertParity(entry);
    const [firstKey] = keysByLevel[entry.level];
    const mutations = [
      ["hold-only new key", (mutation) => mutation.hold_conditions.push("evidenceKey=holdOnlyExtra — 테스트 누락·불일치")],
      ["resume-only new key", (mutation) => {
        mutation.resume_prompt = mutation.resume_prompt.replace("]", ",resumeOnlyExtra]");
      }],
      ["hold key deletion", (mutation) => {
        mutation.hold_conditions = mutation.hold_conditions.filter((condition) => !condition.includes(`evidenceKey=${firstKey}`));
      }],
      ["resume key deletion", (mutation) => {
        mutation.resume_prompt = mutation.resume_prompt.replace(`${firstKey},`, "");
      }],
      ["duplicate hold key", (mutation) => mutation.hold_conditions.push(`evidenceKey=${firstKey} — 중복`)],
      ["unknown resume key", (mutation) => {
        mutation.resume_prompt = mutation.resume_prompt.replace("]", ",unknownEvidence]");
      }],
    ];
    for (const [label, mutate] of mutations) {
      const mutation = structuredClone(entry);
      mutate(mutation);
      assert.throws(() => assertParity(mutation), assert.AssertionError, `${entry.id} ${label}`);
    }
  }
});

test("Career review hold and resume derive every required human-review evidence key", async () => {
  const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
  const entries = JSON.parse(await readFile(
    path.join(repoRoot, "guides", "prompt-templates", "catalog", "career-visual.json"), "utf8",
  )).filter(({ skill, level }) => skill === "review-image-assets" && ["standard", "advanced"].includes(level));
  const reviewEvidenceByLevel = {
    standard: [
      { evidenceKey: "namedHumanReviewer", requiredInput: "named human reviewer", boundary: /named human reviewer/iu },
      { evidenceKey: "rightsDecision", requiredInput: "rightsDecision", boundary: /rights/iu },
      { evidenceKey: "placement", requiredInput: "placement", boundary: /placement/iu },
      { evidenceKey: "altText", requiredInput: "alt text", boundary: /alt text/iu },
      { evidenceKey: "readability", requiredInput: "readability evidence", boundary: /readability/iu },
    ],
    advanced: [
      { evidenceKey: "namedHumanReviewer", requiredInput: "named human reviewer", boundary: /named human reviewer/iu },
      { evidenceKey: "rightsDecision", requiredInput: "rightsDecision", boundary: /rights/iu },
      { evidenceKey: "activeRights", requiredInput: "active-rights evidence", boundary: /active-rights/iu },
      { evidenceKey: "technicalFit", requiredInput: "technical fit evidence", boundary: /technical fit/iu },
      { evidenceKey: "altText", requiredInput: "alt text", boundary: /alt text/iu },
      { evidenceKey: "readability", requiredInput: "readability evidence", boundary: /readability/iu },
    ],
  };
  const extractHoldKeys = (entry) => entry.hold_conditions.map((condition) => {
    const keys = [...condition.matchAll(/\bevidenceKey=([A-Za-z][A-Za-z0-9]*)\b/gu)].map(([, key]) => key);
    assert.equal(keys.length, 1, `${entry.id} hold condition must declare exactly one evidence key`);
    return keys[0];
  });
  const extractResumeKeys = (entry) => {
    const [match] = [...entry.resume_prompt.matchAll(/repair\/verify evidenceKeys=\[([A-Za-z0-9,]+)\]/gu)];
    assert.ok(match, `${entry.id} resume repair/verify key list`);
    return match[1].split(",");
  };
  const deriveHumanReviewKeys = (entry) => reviewEvidenceByLevel[entry.level].map(({ evidenceKey, requiredInput, boundary }) => {
    assert.ok(entry.required_inputs.includes(requiredInput), `${entry.id} required input ${requiredInput}`);
    assert.match(entry.human_review_boundary, boundary, `${entry.id} human boundary ${evidenceKey}`);
    return evidenceKey;
  });
  const assertDerivedCoverage = (entry) => {
    const held = extractHoldKeys(entry);
    const resumed = extractResumeKeys(entry);
    for (const key of deriveHumanReviewKeys(entry)) {
      assert.ok(held.includes(key), `${entry.id} hold retains required human-review evidence ${key}`);
      assert.ok(resumed.includes(key), `${entry.id} resume retains required human-review evidence ${key}`);
    }
  };

  assert.equal(entries.length, 2);
  for (const entry of entries) {
    assertDerivedCoverage(entry);
    for (const key of deriveHumanReviewKeys(entry)) {
      const holdMutation = structuredClone(entry);
      holdMutation.hold_conditions = holdMutation.hold_conditions.filter((condition) => !condition.includes(`evidenceKey=${key}`));
      assert.throws(() => assertDerivedCoverage(holdMutation), assert.AssertionError, `${entry.id} rejects missing hold ${key}`);

      const resumeMutation = structuredClone(entry);
      resumeMutation.resume_prompt = resumeMutation.resume_prompt.replace(new RegExp(`(?:${key},|,${key}(?=[,\\]]))`, "u"), "");
      assert.throws(() => assertDerivedCoverage(resumeMutation), assert.AssertionError, `${entry.id} rejects missing resume ${key}`);
    }
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

test("Career visual catalog has exact skill-level, inventory, diagram, and prompt bindings", async () => {
  const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
  const [entries, diagramSources, useCaseManifest, careerInventory] = await Promise.all([
    readFile(path.join(repoRoot, "guides", "prompt-templates", "catalog", "career-visual.json"), "utf8").then(JSON.parse),
    readFile(path.join(repoRoot, "guides", "assets", "use-case-diagram-sources.json"), "utf8").then(JSON.parse),
    readFile(path.join(repoRoot, "guides", "use-cases", "use-case-manifest.json"), "utf8").then(JSON.parse),
    collectProductInventory(repoRoot, "game-design-career"),
  ]);
  const skills = [
    "plan-image-assets",
    "generate-image-assets",
    "review-image-assets",
    "visualize-career-roadmap",
    "svg-infographic",
  ];
  const levels = ["beginner", "standard", "advanced"];
  const expectedIds = skills.flatMap((skill) => levels.map((level) => `career:${skill}:${level}`)).sort();

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
    const source = diagramSources.find(({ scope, semantic }) => (
      scope === "game-design-career-skill" && semantic?.skill === entry.skill
    ));
    const skillCase = useCaseManifest.skill_cases.find(({ product, skill }) => (
      product === "game-design-career" && skill === entry.skill
    ));
    assert.ok(source, `${entry.id} diagram source`);
    assert.ok(skillCase, `${entry.id} diagram manifest`);
    assert.equal(entry.diagram_binding.id, source.id, entry.id);
    assert.equal(entry.diagram_binding.svg, skillCase.diagram.svg, entry.id);
    assert.equal(entry.diagram_binding.png, skillCase.diagram.png, entry.id);
  }
});

test("Career visual catalog preserves closed image modes, safe provider routing, placeholders, and canonical reads", async () => {
  const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
  const [entries, imagePolicy] = await Promise.all([
    readFile(path.join(repoRoot, "guides", "prompt-templates", "catalog", "career-visual.json"), "utf8").then(JSON.parse),
    readFile(path.join(repoRoot, "guides", "game-design-career", "image-assets.md"), "utf8"),
  ]);
  const leaves = (value) => typeof value === "string" ? [value] : Array.isArray(value)
    ? value.flatMap(leaves) : value && typeof value === "object" ? Object.values(value).flatMap(leaves) : [];
  const tokens = (prompt) => [...prompt.matchAll(/\[([^\]]+)\]/gu)].map(([, token]) => `[${token}]`).sort();
  const imageModes = (value) => [...new Set(leaves(value).flatMap((leaf) => (
    [...leaf.matchAll(/\bIMAGE_GEN_MODE\s*=\s*([a-z][a-z-]*)\b/giu)].map(([, mode]) => mode)
  )))].sort();
  const allowedModes = ["all", "prompt-only", "required", "select"];
  const imageEntries = entries.filter(({ skill }) => ["plan-image-assets", "generate-image-assets"].includes(skill));
  const contract = leaves(imageEntries).join(" ");

  assert.deepEqual(imagePolicyModes(imagePolicy), allowedModes, "Career image policy closed mode set");
  assert.deepEqual(imageModes(entries), allowedModes);
  assert.match(contract, /gpt-image-2/iu);
  assert.match(contract, /IMAGE_QUALITY.*low|low.*IMAGE_QUALITY/iu);
  assert.match(contract, /IMAGE_PROVIDER.*codex-first|codex-first.*IMAGE_PROVIDER/iu);
  assert.match(contract, /host image_gen/iu);
  assert.match(contract, /IMAGE_EMBEDDED_TEXT_LOCALE=ko-KR.*gpt-image-2/iu);
  assert.match(contract, /low.*medium.*high/iu);
  assert.match(contract, /비용.*승인 뒤 실행/iu);
  assert.doesNotMatch(contract, /\[(?:API key|OPENAI_API_KEY|credential|자격 증명)\]/iu);

  for (const entry of entries) {
    assert.deepEqual(entry.placeholders.slice().sort(), [...new Set([
      ...tokens(entry.app_prompt.template),
      ...tokens(entry.cli_prompt.template),
    ])].sort(), entry.id);
    const base = entry.expected_file_tree[0].replace(/\/content\.md$/u, "");
    assert.deepEqual(entry.read_order.slice(0, 3), [
      `${base}/content.md`, `${base}/evidence.yml`, `${base}/export-manifest.yml`,
    ], entry.id);
  }
});

test("Career visual catalog keeps portfolio publication, rights, lifecycle, and named-human evidence separate", async () => {
  const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
  const entries = JSON.parse(await readFile(
    path.join(repoRoot, "guides", "prompt-templates", "catalog", "career-visual.json"), "utf8",
  ));
  const leaves = (value) => typeof value === "string" ? [value] : Array.isArray(value)
    ? value.flatMap(leaves) : value && typeof value === "object" ? Object.values(value).flatMap(leaves) : [];
  const contract = leaves(entries).join(" ");
  const reviewEntries = entries.filter(({ skill }) => skill === "review-image-assets");

  assert.match(contract, /portfolio publication.*named human reviewer evidence|named human reviewer evidence.*portfolio publication/iu);
  assert.match(contract, /personal information|개인정보|PII/iu);
  assert.match(contract, /private material|비공개 자료|company asset|회사 자산/iu);
  assert.match(contract, /attribution|source/iu);
  assert.match(contract, /alt text.*readability|readability.*alt text/iu);
  assert.match(contract, /concept-draft\s*→\s*document-approved\s*→\s*production-candidate/u);
  assert.match(contract, /(?:portfolio publication|actual portfolio publication|게임 리소스|game resource).*(?:자동.*승인.*금지|자동.*승인.*하지 않)|(?:자동.*승인.*금지|자동.*승인.*하지 않).*(?:portfolio publication|actual portfolio publication|게임 리소스|game resource)/iu);
  for (const entry of reviewEntries) {
    assert.match(entry.human_review_boundary, /named human|실제 담당자|이름 있는 사람/iu, entry.id);
    assert.match(entry.human_review_boundary, /승인/u, entry.id);
    assert.match(entry.human_review_boundary, /보류|hold/iu, entry.id);
  }
  for (const entry of entries) {
    assert.match(entry.human_review_boundary, /owner|담당자/u, `${entry.id} owner`);
    assert.match(entry.resume_prompt, /보존.*재개|재개.*보존/iu, entry.id);
    assert.match(entry.safety_boundary, /미정/u, entry.id);
  }
});

test("Career visual catalog routes structural diagrams through Archify before an honest Skillstead fallback", async () => {
  const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
  const entries = JSON.parse(await readFile(
    path.join(repoRoot, "guides", "prompt-templates", "catalog", "career-visual.json"), "utf8",
  ));
  const leaves = (value) => typeof value === "string" ? [value] : Array.isArray(value)
    ? value.flatMap(leaves) : value && typeof value === "object" ? Object.values(value).flatMap(leaves) : [];
  const visualContract = leaves(entries.filter(({ skill }) => ["visualize-career-roadmap", "svg-infographic"].includes(skill))).join(" ");

  assert.match(visualContract, /Archify.*(?:available|사용 가능).*우선/iu);
  assert.match(visualContract, /Archify.*(?:absent|failure|부재|실패).*Skillstead.*editable SVG.*2× PNG/iu);
  assert.match(visualContract, /source.*receipt.*(?:분리|separate)|(?:분리|separate).*source.*receipt/iu);
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

test("all 161 catalog cards use Korean-first titles and distinct source-bound result excerpts", async () => {
  const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
  const catalogDir = path.join(repoRoot, "guides", "prompt-templates");
  const index = JSON.parse(await readFile(path.join(catalogDir, "catalog.json"), "utf8"));
  const entries = (await Promise.all(index.sources.map(async (source) => (
    JSON.parse(await readFile(path.join(catalogDir, source), "utf8"))
  )))).flat();
  assert.equal(entries.length, 161);
  assert.deepEqual(koreanPresentationErrors(entries), []);
});

test("Korean catalog presentation audit rejects each independent defect mutation", () => {
  const original = validEntry(301);
  original.display_title = "협동 게임의 첫 화면 흐름 (UI)";
  original.sample_result_excerpt = `첫 행동은 발전기 수리, 즉시 반응은 조명 점등으로 적었습니다. 재시도 안내 문구는 담당자 검토 전까지 미정입니다. (ID: ${original.id}; 파일: ${original.expected_file_tree[0]})`;
  original.source_references = ["guides/game-design-studio/skills/define-game-vision.md"];
  assert.deepEqual(koreanPresentationErrors([original]), []);

  const mutations = [
    ["missing title", (entry) => { entry.display_title = ""; }, "MISSING_DISPLAY_TITLE"],
    ["missing excerpt", (entry) => { entry.sample_result_excerpt = ""; }, "MISSING_EXCERPT"],
    ["English-first title", (entry) => { entry.display_title = "Overlay 품질 설정"; }, "ENGLISH_FIRST_TITLE"],
    ["unwrapped English title", (entry) => { entry.display_title = "첫 화면 UI 흐름"; }, "UNWRAPPED_ENGLISH_TITLE"],
    ["stock excerpt skeleton", (entry) => { entry.sample_result_excerpt = `초안 결과: 핵심 결과 항목을 적었습니다. 검토가 필요합니다. (ID: ${entry.id}; 파일: ${entry.expected_file_tree[0]})`; }, "STOCK_EXCERPT"],
    ["broken source ID", (entry) => { entry.sample_result_excerpt = entry.sample_result_excerpt.replace(entry.id, "BROKEN-ID"); }, "MISSING_SOURCE_ID"],
    ["broken source path", (entry) => { entry.sample_result_excerpt = entry.sample_result_excerpt.replace(entry.expected_file_tree[0], "broken/content.md"); }, "MISSING_SOURCE_PATH"],
    ["broken skill source", (entry) => { entry.source_references = ["guides/other.md"]; }, "MISSING_SKILL_SOURCE"],
    ["automatic approval", (entry) => { entry.sample_result_excerpt = entry.sample_result_excerpt.replace(/[^.!?]+[.!?]/u, "검토 없이 자동 승인됩니다. "); }, "AUTOMATIC_DECISION"],
    ["outcome guarantee", (entry) => { entry.sample_result_excerpt = entry.sample_result_excerpt.replace(/[^.!?]+[.!?]/u, "이 결과는 출시 성과를 보장합니다. "); }, "AUTOMATIC_DECISION"],
  ];
  for (const [label, mutate, expectedCode] of mutations) {
    const target = structuredClone(original);
    mutate(target);
    assert.ok(koreanPresentationErrors([target]).some((error) => error === `${expectedCode}:${target.id}`), label);
  }

  const duplicated = [structuredClone(original), structuredClone(original)];
  duplicated[1].id = "PT-302";
  const duplicateErrors = koreanPresentationErrors(duplicated);
  assert.ok(duplicateErrors.some((error) => error === `DUPLICATE_EXCERPT:${duplicated[1].id}`));
  assert.ok(duplicateErrors.some((error) => error === `MISSING_SOURCE_ID:${duplicated[1].id}`));

  const normalizedDuplicate = structuredClone(original);
  normalizedDuplicate.id = "PT-302";
  normalizedDuplicate.expected_file_tree = ["artifacts/PT-302/content.md"];
  normalizedDuplicate.sample_result_excerpt = original.sample_result_excerpt.replace(
    `(ID: ${original.id}; 파일: ${original.expected_file_tree[0]})`,
    `(ID: ${normalizedDuplicate.id}; 파일: ${normalizedDuplicate.expected_file_tree[0]})`,
  );
  assert.ok(koreanPresentationErrors([original, normalizedDuplicate]).includes(`DUPLICATE_NORMALIZED_EXCERPT:${normalizedDuplicate.id}`));
});

function koreanPresentationErrors(entries) {
  const errors = [];
  const forbiddenSkeleton = /^(?:게임 기획 결과|초안 결과|가상 결과 기록|가상 결과 조각|가상의 검토 기록|예시 산출물 조각|결과 미리보기|검토용 가상 산출물|가상 문서 조각)/u;
  const englishFirst = /^(?:[^가-힣]*[A-Za-z][^가-힣]*)(?=[가-힣])/u;
  const englishParticle = /\b[A-Za-z][A-Za-z /-]*(?:을|를|은|는|이|가|과|와|로|으로|에|의)\b/u;
  const automaticDecision = /(?:검토\s*없이[^.!?]*(?:승인|확정|완료)|자동(?:으로)?\s*(?:승인|확정|완료)(?![^.!?]*(?:아니|않|금지))|(?:채용|출시|성과)[^.!?]*보장(?!하지))/u;
  const exactExcerpts = new Set();
  const normalizedExcerpts = new Set();

  for (const entry of entries) {
    const title = entry.display_title;
    const excerpt = entry.sample_result_excerpt;
    const label = (code) => errors.push(`${code}:${entry.id}`);
    if (typeof title !== "string" || title.trim() === "") label("MISSING_DISPLAY_TITLE");
    else {
      if (!/[가-힣]/u.test(title) || englishFirst.test(title)) label("ENGLISH_FIRST_TITLE");
      if (forbiddenSkeleton.test(title)) label("STOCK_TITLE");
      for (const match of title.matchAll(/[A-Za-z][A-Za-z0-9-]*/gu)) {
        const before = title.slice(0, match.index);
        const after = title.slice(match.index + match[0].length);
        const inParentheses = before.lastIndexOf("(") > before.lastIndexOf(")") && after.indexOf(")") >= 0;
        const inCode = ((before.match(/`/gu) ?? []).length % 2) === 1 && after.indexOf("`") >= 0;
        if (!inParentheses && !inCode) label("UNWRAPPED_ENGLISH_TITLE");
      }
    }
    if (typeof excerpt !== "string" || excerpt.trim() === "") {
      label("MISSING_EXCERPT");
      continue;
    }
    if (forbiddenSkeleton.test(excerpt) || /핵심 결과 항목/u.test(excerpt)) label("STOCK_EXCERPT");
    if (englishParticle.test(excerpt)) label("ENGLISH_PARTICLE");
    if (!excerpt.includes(`(ID: ${entry.id};`)) label("MISSING_SOURCE_ID");
    const expectedPath = entry.expected_file_tree?.[0];
    if (typeof expectedPath !== "string" || !excerpt.includes(`파일: ${expectedPath})`)) label("MISSING_SOURCE_PATH");
    if (entry.kind === "skill-template" && !entry.source_references.some((source) => source.includes(`/skills/${entry.skill}`))) label("MISSING_SKILL_SOURCE");
    if (!/검토|보류|미정|초안|아직|확인|승인|결정|정해야|정합니다|채택 여부|대조해야|확정하지|살펴봐야|재평가|관찰|필요|알 수 없|쓸 수 없|가설|임시|진행 불가|보완해야|실행 전|재개|호출은 하지/u.test(excerpt)) label("MISSING_HUMAN_REVIEW_STATE");
    if (automaticDecision.test(excerpt)) label("AUTOMATIC_DECISION");
    if (exactExcerpts.has(excerpt)) label("DUPLICATE_EXCERPT");
    exactExcerpts.add(excerpt);
    const normalized = excerpt
      .replace(/\s*\(ID:[\s\S]*$/u, "")
      .replace(/[\p{P}\p{S}\d\s]+/gu, "")
      .toLowerCase();
    if (normalizedExcerpts.has(normalized)) label("DUPLICATE_NORMALIZED_EXCERPT");
    normalizedExcerpts.add(normalized);
  }
  return errors;
}

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

  const unnaturalExcerpt = validEntry(3);
  unnaturalExcerpt.sample_result_excerpt = "PT-003 예: `artifacts/PT-003/content.md`에 target player을 기록하고 미정 값은 남깁니다.";
  const excerptResult = validatePromptTemplateCatalog({ entries: [unnaturalExcerpt] });
  assert.equal(excerptResult.ok, false);
  assert.match(excerptResult.errors.join("\n"), /English-first particle or repeated example skeleton/u);
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
  assert.match(result.errors.join("\n"), /skill-template cardinality.*found 35/u);
  assert.match(result.errors.join("\n"), /skill-template cardinality.*found 0/u);
});

test("suite product cannot define a skill-template", () => {
  const entry = validEntry(9, "skill-template");
  entry.product = "suite";
  const result = validatePromptTemplateCatalog({ entries: [entry] });
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /suite.*skill-template/u);
});

test("use-case entries require an exact source_case_id binding", () => {
  const entry = validEntry(20, "use-case");
  entry.source_case_id = "ST-C01";
  const manifest = {
    cases: [{ id: "ST-C01", product: "game-design-studio" }],
    audience_paths: [],
    skill_cases: [],
  };
  const valid = validatePromptTemplateCatalog({ entries: [entry], useCaseManifest: manifest });
  assert.equal(valid.ok, true, valid.errors.join("\n"));

  for (const mutation of [
    { ...entry, source_case_id: undefined },
    { ...entry, source_case_id: "ST-C99" },
    { ...entry, product: "career" },
  ]) {
    const result = validatePromptTemplateCatalog({ entries: [mutation], useCaseManifest: manifest });
    assert.equal(result.ok, false);
    assert.match(result.errors.join("\n"), /source_case_id|source case.*product/u);
  }
  const nonUseCase = validEntry(21, "recipe");
  nonUseCase.source_case_id = "ST-C01";
  const result = validatePromptTemplateCatalog({ entries: [nonUseCase], useCaseManifest: manifest });
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /source_case_id/u);
});

test("scenario catalog binds every source case and recipe command in order", async () => {
  const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
  const [studio, career, suite, manifest] = await Promise.all([
    readFile(path.join(repoRoot, "guides", "prompt-templates", "catalog", "studio-scenarios.json"), "utf8").then(JSON.parse),
    readFile(path.join(repoRoot, "guides", "prompt-templates", "catalog", "career-scenarios.json"), "utf8").then(JSON.parse),
    readFile(path.join(repoRoot, "guides", "prompt-templates", "catalog", "suite.json"), "utf8").then(JSON.parse),
    readFile(path.join(repoRoot, "guides", "use-cases", "use-case-manifest.json"), "utf8").then(JSON.parse),
  ]);
  const entries = [...studio, ...career, ...suite];
  const cases = manifest.cases;
  assert.equal(studio.length, 24);
  assert.equal(career.length, 24);
  assert.equal(suite.length, 8);
  const sourceById = new Map(cases.map((value) => [value.id, value]));
  const useCases = entries.filter(({ kind }) => kind === "use-case");
  assert.equal(useCases.length, 36);
  for (const entry of useCases) {
    const source = sourceById.get(entry.source_case_id);
    assert.ok(source, `${entry.id} source case`);
    assert.equal(entry.product, source.product.replace("game-design-", ""), entry.id);
    assert.deepEqual(entry.audiences, source.audiences, entry.id);
    assert.deepEqual(entry.skill_chain, source.skills, entry.id);
    assert.deepEqual(entry.intermediate_artifacts, source.templates, entry.id);
    assert.deepEqual(entry.minimum_outputs, source.outputs, entry.id);
    assert.ok(entry.source_references.includes(source.document), entry.id);
  }
  const recipes = entries.filter(({ kind }) => kind === "recipe");
  assert.equal(recipes.length, 12);
  for (const entry of recipes) {
    const source = entry.source_references.find((value) => /\/recipes\/.*\.md$/u.test(value));
    assert.ok(source, `${entry.id} recipe source`);
    const markdown = withoutPromptTemplateSections(await readFile(path.join(repoRoot, source), "utf8"));
    const expectedCommands = [...markdown.matchAll(/\$game-design-(?:studio|career):[a-z-]+/gu)].map(([command]) => command);
    const actualCommands = [...entry.cli_prompt.example.matchAll(/\$game-design-(?:studio|career):[a-z-]+/gu)].map(([command]) => command);
    assert.deepEqual(actualCommands, expectedCommands, entry.id);
  }
});

test("scenario use cases preserve source review owners, approval scope, and full specialist roles", async () => {
  const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
  const files = [
    "guides/game-design-studio/use-cases/competency-paths.md",
    "guides/game-design-studio/use-cases/concept-scenarios.md",
    "guides/game-design-career/use-cases/competency-paths.md",
    "guides/game-design-career/use-cases/concept-scenarios.md",
  ];
  const expectedRoles = {
    "ST-C01": ["lead-game-designer"], "ST-C02": ["lead-game-designer", "ux-accessibility-reviewer"],
    "ST-C03": ["lead-game-designer", "system-economy-designer"], "ST-C04": ["ux-accessibility-reviewer", "lead-game-designer"],
    "ST-C05": ["content-narrative-designer", "system-economy-designer", "production-feasibility-critic", "visual-asset-reviewer"],
    "ST-C06": ["system-economy-designer", "ux-accessibility-reviewer"], "ST-C07": ["system-economy-designer", "liveops-data-designer", "ux-accessibility-reviewer"],
    "ST-C08": ["production-feasibility-critic", "lead-game-designer", "visual-asset-reviewer", "document-quality-editor"],
    "ST-G01": ["lead-game-designer", "liveops-data-designer", "ux-accessibility-reviewer"], "ST-G02": ["lead-game-designer", "ux-accessibility-reviewer"],
    "ST-G03": ["lead-game-designer", "system-economy-designer", "ux-accessibility-reviewer"], "ST-G04": ["system-economy-designer", "ux-accessibility-reviewer"],
    "ST-G05": ["lead-game-designer", "system-economy-designer", "production-feasibility-critic", "ux-accessibility-reviewer"], "ST-G06": ["content-narrative-designer", "system-economy-designer", "production-feasibility-critic", "visual-asset-reviewer"],
    "ST-G07": ["lead-game-designer", "content-narrative-designer", "ux-accessibility-reviewer"], "ST-G08": ["liveops-data-designer", "system-economy-designer", "ux-accessibility-reviewer"],
    "ST-G09": ["content-narrative-designer", "visual-asset-reviewer", "ux-accessibility-reviewer"], "ST-G10": ["lead-game-designer", "content-narrative-designer", "ux-accessibility-reviewer", "visual-asset-reviewer"],
    "CA-C01": ["career-strategist", "game-design-mentor"], "CA-C02": ["reverse-design-critic", "game-design-mentor"], "CA-C03": ["evidence-auditor", "portfolio-reviewer"],
    "CA-C04": ["career-strategist", "game-design-mentor"], "CA-C05": ["reverse-design-critic", "visual-asset-reviewer"], "CA-C06": ["portfolio-reviewer", "visual-asset-reviewer"],
    "CA-C07": ["portfolio-reviewer", "game-design-mentor", "visual-asset-reviewer"], "CA-C08": ["game-design-mentor", "career-strategist", "portfolio-reviewer", "visual-asset-reviewer"],
    "CA-T01": ["game-design-mentor"], "CA-T02": ["game-design-mentor"], "CA-T03": ["game-design-mentor"], "CA-T04": ["game-design-mentor"],
    "CA-T05": ["game-design-mentor"], "CA-T06": ["game-design-mentor"], "CA-T07": ["game-design-mentor"], "CA-T08": ["portfolio-reviewer"],
    "CA-T09": ["career-strategist"], "CA-T10": ["career-strategist", "interview-coach"],
  };
  const entries = [
    ...JSON.parse(await readFile(path.join(repoRoot, "guides/prompt-templates/catalog/studio-scenarios.json"), "utf8")),
    ...JSON.parse(await readFile(path.join(repoRoot, "guides/prompt-templates/catalog/career-scenarios.json"), "utf8")),
  ].filter(({ kind }) => kind === "use-case");
  const reviews = new Map();
  for (const file of files) {
    const markdown = await readFile(path.join(repoRoot, file), "utf8");
    for (const [, id, body] of markdown.matchAll(/^## ((?:ST|CA)-[CGT]\d{2})[^\n]*\n([\s\S]*?)(?=^## |$(?![\s\S]))/gmu)) {
      reviews.set(id, body.match(/### 검토와 승인\n\n([\s\S]*?)(?=\n### |$)/u)?.[1].trim().replaceAll("\n", " "));
    }
  }
  for (const entry of entries) {
    assert.equal(entry.human_review_boundary, reviews.get(entry.source_case_id), entry.id);
    assert.deepEqual(entry.specialist_roles, expectedRoles[entry.source_case_id], entry.id);
    assert.match(entry.human_review_boundary, /사람 결정/u, entry.id);
    assert.match(entry.human_review_boundary, /자동[^.]*승인/u, entry.id);
  }
});

test("recipe scenarios preserve every source artifact tree and canonical read order", async () => {
  const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
  const layers = (root) => ["content.md", "evidence.yml", "decisions/README.md", "assets/README.md", "export-manifest.yml"].map((leaf) => `${root}/${leaf}`);
  const expected = {
    "studio:recipe:content-quest-design": [...layers("game-design/[프로젝트 ID]/narrative-quest-npc"), "game-design/[프로젝트 ID]/character-skill-combat-monster/content.md"],
    "studio:recipe:economy-liveops": [...layers("game-design/[프로젝트 ID]/economy-balance"), ...layers("game-design/[프로젝트 ID]/liveops-experiment-event")],
    "studio:recipe:new-game-gdd": [...layers("game-design/[프로젝트 ID]/vision-pillars"), "game-design/[프로젝트 ID]/game-design-brief/content.md"],
    "studio:recipe:production-review-export": [...layers("game-design/[프로젝트 ID]/production-scope-risk"), ...layers("game-design/[프로젝트 ID]/game-design-review"), "game-design/[프로젝트 ID]/decision-change-log/content.md"],
    "studio:recipe:system-feature-spec": [...layers("game-design/[프로젝트 ID]/system-specification"), "game-design/[프로젝트 ID]/rule-exception-matrix/content.md"],
    "studio:recipe:ux-accessibility": [...layers("game-design/[프로젝트 ID]/ui-ux-flow-state"), "game-design/[프로젝트 ID]/accessibility-platform-matrix/content.md"],
    "career:recipe:interview-preparation": layers("game-design-career/[경력 ID]/interview-question-answer-log"),
    "career:recipe:job-research-gap": [...layers("game-design-career/[경력 ID]/job-posting-evidence"), ...layers("game-design-career/[경력 ID]/competency-matrix"), ...layers("game-design-career/[경력 ID]/portfolio-project-brief")],
    "career:recipe:junior-growth-transition": [...layers("game-design-career/[경력 ID]/junior-growth-review"), ...layers("game-design-career/[경력 ID]/transition-readiness")],
    "career:recipe:portfolio-build-review": [...layers("game-design-career/[경력 ID]/creative-design-portfolio"), ...layers("game-design-career/[경력 ID]/five-axis-review"), ...layers("game-design-career/[경력 ID]/portfolio-backlog")],
    "career:recipe:reverse-design": layers("game-design-career/[경력 ID]/reverse-design-document"),
    "career:recipe:role-learning-roadmap": [...layers("game-design-career/[경력 ID]/career-stage-goal"), ...layers("game-design-career/[경력 ID]/learning-roadmap")],
  };
  const entries = [
    ...JSON.parse(await readFile(path.join(repoRoot, "guides/prompt-templates/catalog/studio-scenarios.json"), "utf8")),
    ...JSON.parse(await readFile(path.join(repoRoot, "guides/prompt-templates/catalog/career-scenarios.json"), "utf8")),
  ].filter(({ kind }) => kind === "recipe");
  for (const entry of entries) {
    assert.deepEqual(entry.expected_file_tree, expected[entry.id], entry.id);
    assert.deepEqual(entry.read_order, expected[entry.id], entry.id);
  }
});

test("suite scenarios bind installed templates and their exact ordered chains", async () => {
  const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
  const entries = JSON.parse(await readFile(path.join(repoRoot, "guides/prompt-templates/catalog/suite.json"), "utf8"));
  const expected = {
    "suite:studio-to-career-handoff:case": [["review-game-design", "build-game-design-portfolio"], "공개 가능한 문제·판단·검증 summary"],
    "suite:reverse-to-system-proposal:case": [["reverse-engineer-game-design", "design-game-systems", "review-game-design"], "fact/inference 역기획과 system specification"],
    "suite:multi-domain-portfolio:case": [["design-game-systems", "design-player-experience", "design-game-economy-and-liveops", "build-game-design-portfolio"], "개인 판단과 evidence index"],
    "suite:gdd-image-presentation:case": [["orchestrate-game-design-project", "plan-image-assets", "review-image-assets", "export-game-design-documents"], "content.md, approved images, PPTX preflight"],
    "suite:career-proof-project-interview:case": [["map-game-design-career", "design-game-systems", "practice-game-design-interview"], "12주 proof와 evidence-linked 답변"],
    "suite:student-mentor-review:case": [["design-game-systems", "review-game-design-portfolio"], "과제, 루브릭, 수정 기록"],
    "suite:work-to-public-case:case": [["review-game-design", "build-game-design-portfolio"], "공개 요약과 제외 기록"],
    "suite:resume-failed-derivatives:case": [["plan-image-assets", "generate-image-assets", "review-image-assets", "export-game-design-documents", "export-career-documents"], "보존 파일, 중단 원인, 재개 기록"],
  };
  const inventories = await Promise.all([collectProductInventory(repoRoot, "game-design-studio"), collectProductInventory(repoRoot, "game-design-career")]);
  const templates = new Set(inventories.flatMap(({ templateIds }) => templateIds));
  for (const entry of entries) {
    assert.deepEqual([entry.skill_chain, entry.minimum_outputs[0]], expected[entry.id], entry.id);
    for (const artifact of entry.intermediate_artifacts) assert.ok(templates.has(artifact), `${entry.id} ${artifact}`);
    const mutation = structuredClone(entry);
    mutation.skill_chain = [...mutation.skill_chain].reverse();
    assert.throws(() => assert.deepEqual(mutation.skill_chain, expected[entry.id][0]), assert.AssertionError, `${entry.id} chain mutation`);
  }
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

test("CLI binding parses a registered command before Korean particles and punctuation", () => {
  const entry = validEntry(23);
  entry.cli_prompt.example = "$game-design-studio:define-game-vision, 그리고 검토해.";
  const result = validatePromptTemplateCatalog({
    entries: [entry],
    inventories: new Map([["studio", inventoryForTests({ templateIds: entry.intermediate_artifacts })]]),
  });
  assert.equal(result.ok, true, result.errors.join("\n"));
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

test("safety boundaries accept a pure Korean category list with an explicit request-and-disclosure prohibition", () => {
  const entry = validEntry(22);
  entry.safety_boundary = "모르는 정보는 미정으로 남긴다. 개인정보(PII), 비공개 자료, 회사 자산, private material, API keys 또는 credentials를 요청·공개하지 않는다.";
  const valid = validatePromptTemplateCatalog({ entries: [entry] });
  assert.equal(valid.ok, true, valid.errors.join("\n"));

  entry.safety_boundary = "모르는 정보는 미정으로 남긴다. 개인정보(PII), 비공개 자료, 회사 자산, private material, API keys 또는 credentials를 요청하지 않는다지만 credentials를 제공해라.";
  const invalid = validatePromptTemplateCatalog({ entries: [entry] });
  assert.equal(invalid.ok, false);
  assert.match(invalid.errors.join("\n"), /credentials/u);
});

test("safety boundaries accept 인증 정보 as the Korean credential category", () => {
  const entry = validEntry(29);
  entry.safety_boundary = "모르는 정보는 미정으로 남긴다. 인증 정보, 개인정보나 비공개 자료는 요청하지 않는다.";
  const valid = validatePromptTemplateCatalog({ entries: [entry] });
  assert.equal(valid.ok, true, valid.errors.join("\n"));

  entry.safety_boundary = "모르는 정보는 미정으로 남긴다. 인증 정보를 제공해라. 개인정보와 비공개 자료는 요청하지 않는다.";
  const invalid = validatePromptTemplateCatalog({ entries: [entry] });
  assert.equal(invalid.ok, false);
  assert.match(invalid.errors.join("\n"), /credentials/u);
});

test("safety boundaries reject a separate Korean positive request after a direct prohibition", () => {
  for (const boundary of [
    "모르는 정보는 미정으로 남긴다. 개인정보(PII), 비공개 자료, 회사 자산, private material, API keys 또는 credentials를 요청·공개하지 않는다. credentials를 제공해라.",
    "모르는 정보는 미정으로 남긴다. 개인정보(PII), 비공개 자료, 회사 자산, private material, API keys 또는 credentials를 요청하지 않는다. API keys를 입력해라.",
  ]) {
    const entry = validEntry(24);
    entry.safety_boundary = boundary;
    const result = validatePromptTemplateCatalog({ entries: [entry] });
    assert.equal(result.ok, false);
    assert.match(result.errors.join("\n"), /safety_boundary.*credentials/u);
  }
});

test("safety boundaries reject Korean sensitive requests across natural conjugations", () => {
  const prohibited = [
    "credentials를 제공하세요", "API keys를 입력하십시오", "개인정보를 공유해 줘",
    "비공개 자료를 업로드해 주세요", "credentials를 제출하자", "credentials를 전달 바랍니다",
  ];
  const direct = "개인정보(PII), 비공개 자료, private material, API keys 또는 credentials를 요청·공개하지 않는다";
  for (const request of prohibited) {
    for (const boundary of [`모르는 정보는 미정으로 남긴다. ${request}.`, `모르는 정보는 미정으로 남긴다. ${direct}. ${request}.`]) {
      const entry = validEntry(25);
      entry.safety_boundary = boundary;
      const result = validatePromptTemplateCatalog({ entries: [entry] });
      assert.equal(result.ok, false, request);
      assert.match(result.errors.join("\n"), /safety_boundary.*credentials|personal data|private materials/u, request);
    }
  }
});

test("safety boundaries accept explicit Korean non-request forms for every category", () => {
  for (const boundary of [
    "모르는 정보는 미정으로 남긴다. credentials를 요청하지 않는다. 개인정보를 요청하지 않는다. 비공개 자료를 요청하지 않는다.",
    "모르는 정보는 미정으로 남긴다. credentials를 제공하지 마. 개인정보를 제공하지 마. 비공개 자료를 제공하지 마.",
    "모르는 정보는 미정으로 남긴다. API keys 입력 금지. 개인정보 입력 금지. 비공개 자료 입력 금지.",
    "모르는 정보는 미정으로 남긴다. credentials를 공유하면 안 된다. 개인정보를 공유하면 안 된다. 비공개 자료를 공유하면 안 된다.",
  ]) {
    const entry = validEntry(26);
    entry.safety_boundary = boundary;
    const result = validatePromptTemplateCatalog({ entries: [entry] });
    assert.equal(result.ok, true, result.errors.join("\n"));
  }
});

test("safety boundaries classify every Korean sensitive-input verb occurrence independently", () => {
  const rejected = [
    "credentials를 제공하고 개인정보는 요청하지 않는다.",
    "credentials를 요청하고 개인정보는 요청하지 않는다.",
    "credentials를 알려 주고 개인정보는 요청하지 않는다.",
    "credentials를 기입하고 개인정보는 요청하지 않는다.",
    "credentials를 제공하고 credentials를 요청하지 않는다.",
  ];
  for (const clause of rejected) {
    const entry = validEntry(27);
    entry.safety_boundary = `모르는 정보는 미정으로 남긴다. ${clause} 비공개 자료를 요청하지 않는다.`;
    const result = validatePromptTemplateCatalog({ entries: [entry] });
    assert.equal(result.ok, false, clause);
    assert.match(result.errors.join("\n"), /safety_boundary.*credentials/u, clause);
  }

  for (const clause of [
    "credentials를 제공하지 말고 API keys도 입력하지 마세요. 개인정보와 비공개 자료를 요청하지 않는다.",
    "credentials를 요청·공개하지 않는다. API keys를 입력하지 말고 개인정보와 비공개 자료를 공유하면 안 된다.",
  ]) {
    const entry = validEntry(28);
    entry.safety_boundary = `모르는 정보는 미정으로 남긴다. ${clause}`;
    const result = validatePromptTemplateCatalog({ entries: [entry] });
    assert.equal(result.ok, true, result.errors.join("\n"));
  }
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

test("image policy mode table survives Markdown emphasis on the mode cell", () => {
  const plain = [
    "| 모드 | 생성 범위 | 승인·비용 경계 |",
    "| --- | --- | --- |",
    "| `prompt-only` | 외부 호출 0회 | 기본값 |",
    "| `select` | 선택 자산만 | 선택 기록 필요 |",
    "",
  ].join("\n");
  const emphasized = [
    "| 모드 | 생성 범위 | 승인·비용 경계 |",
    "| --- | --- | --- |",
    "| **`prompt-only`** | **외부 호출 0회.** 계획만 | **기본값입니다.** |",
    "| `select` | 선택 자산만 | 선택 기록 필요 |",
    "",
  ].join("\n");

  assert.deepEqual(imagePolicyModes(plain), ["prompt-only", "select"]);
  assert.deepEqual(
    imagePolicyModes(emphasized),
    imagePolicyModes(plain),
    "emphasis must not change the closed mode set",
  );
  assert.deepEqual(imagePolicyModes("| 모드 | 범위 |\n| --- | --- |\n| 자유 텍스트 | 무시 |\n"), []);
});
