import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  renderPromptCard,
  renderPromptLibrary,
  replaceManagedSection,
} from "../../tooling/lib/prompt-guides.mjs";
import { buildPromptGuides } from "../../tooling/build-prompt-guides.mjs";

function validSkillEntry({ id = "PT-001", title = "Vision prompt", product = "studio", skill = "define-game-vision" } = {}) {
  return {
    id,
    kind: "skill-template",
    product,
    title,
    purpose: "A concise purpose.",
    audiences: ["game designer"],
    intents: ["create a game vision"],
    level: "beginner",
    when_to_use: "Use when a game vision needs a first draft.",
    when_not_to_use: "Do not use for unapproved production changes.",
    required_inputs: ["target player"],
    optional_inputs: ["reference game"],
    placeholders: ["{{target_player}}"],
    app_prompt: {
      example: "@Game Design Studio create a game vision for cozy players.",
      template: "@Game Design Studio create a game vision for {{target_player}}.",
    },
    cli_prompt: {
      example: "$game-design-studio:define-game-vision create a game vision for cozy players.",
      template: "$game-design-studio:define-game-vision create a game vision for {{target_player}}.",
    },
    skill,
    skill_chain: [skill, "review-game-design"],
    specialist_roles: ["lead-game-designer"],
    intermediate_artifacts: ["vision-pillars"],
    minimum_outputs: ["game vision"],
    optional_outputs: ["decision log"],
    extended_outputs: ["review plan"],
    expected_file_tree: ["artifacts/vision/content.md"],
    read_order: ["artifacts/vision/content.md"],
    human_review_boundary: "A design lead approves the direction.",
    hold_conditions: ["Hold when target players are unknown."],
    resume_prompt: "Resume with confirmed non-sensitive target-player evidence only.",
    safety_boundary: "Leave unknown information as 미정; do not request secrets, API keys, personal data, or private materials.",
    diagram_binding: {
      id: "prompt-flow-001",
      svg: "guides/assets/prompt-flow/PT-001.svg",
      png: "guides/assets/prompt-flow/PT-001.png",
      alt: "Vision prompt flow",
    },
    related_use_cases: [],
    related_recipes: [],
    source_references: ["guides/game-design-studio/skills/define-game-vision.md"],
  };
}

function assertOrdered(value, fragments) {
  let offset = -1;
  for (const fragment of fragments) {
    const next = value.indexOf(fragment);
    assert.ok(next > offset, `expected ${JSON.stringify(fragment)} after offset ${offset}`);
    offset = next;
  }
}

async function temporaryRepo(t) {
  const repoRoot = await mkdtemp(path.join(os.tmpdir(), "prompt-guides-test-"));
  t.after(() => rm(repoRoot, { recursive: true, force: true }));
  await mkdir(path.join(repoRoot, "guides", "prompt-templates"), { recursive: true });
  await mkdir(path.join(repoRoot, "products", "game-design-studio", "plugin", "references"), { recursive: true });
  await mkdir(path.join(repoRoot, "products", "game-design-career", "plugin", "references"), { recursive: true });
  return repoRoot;
}

test("renderPromptCard emits the fixed readable order and exactly five text blocks", () => {
  const markdown = renderPromptCard(validSkillEntry());

  assertOrdered(markdown, [
    "### 사용하는 경우", "### 준비 입력", "### 바꿀 자리표시자",
    "### Codex App 완성 예시", "### Codex App 재사용 템플릿",
    "### Codex CLI 완성 예시", "### Codex CLI 재사용 템플릿",
    "### 스킬·전문 역할 흐름", "### 예상 결과물",
    "### 사람 검토", "### 실패와 재개",
  ]);
  assert.equal((markdown.match(/^```text$/gmu) ?? []).length, 5);
  assert.match(markdown, /#### 최소 결과물[\s\S]*#### 선택 결과물[\s\S]*#### 확장 결과물/u);
  assert.match(markdown, /#### 승인 경계[\s\S]*#### 보류 조건[\s\S]*#### 안전 경계/u);
});

test("renderPromptLibrary keeps cards in stable product, skill, level and ID order", () => {
  const catalog = {
    entries: [
      validSkillEntry({ id: "PT-003", title: "Zed", skill: "z-skill" }),
      validSkillEntry({ id: "PT-002", title: "Alpha", skill: "a-skill" }),
      { ...validSkillEntry({ id: "PT-001", product: "career", title: "Career", skill: "career-skill" }), cli_prompt: {
        example: "$game-design-studio:define-game-vision example",
        template: "$game-design-studio:define-game-vision template",
      } },
    ],
  };

  const markdown = renderPromptLibrary(catalog);
  assertOrdered(markdown, ["PT-002", "PT-003", "PT-001"]);
});

test("managed sections require one exact ordered marker pair", () => {
  assert.throws(() => replaceManagedSection("no markers", "studio:vision", "new"), /exactly one/u);
  assert.throws(
    () => replaceManagedSection("<!-- PROMPT-TEMPLATES:START studio:vision --><!-- PROMPT-TEMPLATES:START studio:vision --><!-- PROMPT-TEMPLATES:END studio:vision -->", "studio:vision", "new"),
    /exactly one/u,
  );
  assert.throws(
    () => replaceManagedSection("<!-- PROMPT-TEMPLATES:END studio:vision --><!-- PROMPT-TEMPLATES:START studio:vision -->", "studio:vision", "new"),
    /ordered/u,
  );
  assert.equal(
    replaceManagedSection("before\n<!-- PROMPT-TEMPLATES:START studio:vision -->\nstale\n<!-- PROMPT-TEMPLATES:END studio:vision -->\nafter", "studio:vision", "fresh\nbody"),
    "before\n<!-- PROMPT-TEMPLATES:START studio:vision -->\nfresh\nbody\n<!-- PROMPT-TEMPLATES:END studio:vision -->\nafter",
  );
});

test("buildPromptGuides writes all derived files only after an in-memory graph is complete and check detects byte drift", async (t) => {
  const repoRoot = await temporaryRepo(t);
  const catalog = { entries: [validSkillEntry()] };

  const result = await buildPromptGuides({ repoRoot, __testCatalog: catalog });
  assert.deepEqual(result, { markdown: 2, managed: 0, projections: 2, checked: false });

  const libraryPath = path.join(repoRoot, "guides", "prompt-templates", "README.md");
  const projectionPath = path.join(repoRoot, "products", "game-design-studio", "plugin", "references", "prompt-templates.json");
  assert.match(await readFile(libraryPath, "utf8"), /PT-001/u);
  assert.deepEqual(JSON.parse(await readFile(projectionPath, "utf8")).entries.map(({ id }) => id), ["PT-001"]);

  assert.deepEqual(await buildPromptGuides({ repoRoot, __testCatalog: catalog, check: true }), { markdown: 2, managed: 0, projections: 2, checked: true });
  await writeFile(libraryPath, "drift\n");
  await assert.rejects(
    () => buildPromptGuides({ repoRoot, __testCatalog: catalog, check: true }),
    /generated prompt guide differs/u,
  );
});

test("buildPromptGuides rejects an incomplete graph before it writes any target", async (t) => {
  const repoRoot = await temporaryRepo(t);
  const catalog = { entries: [validSkillEntry(), validSkillEntry()] };

  await assert.rejects(
    () => buildPromptGuides({ repoRoot, __testCatalog: catalog }),
    /duplicate entry ID/u,
  );
  await assert.rejects(
    () => readFile(path.join(repoRoot, "guides", "prompt-templates", "README.md")),
    { code: "ENOENT" },
  );
});
