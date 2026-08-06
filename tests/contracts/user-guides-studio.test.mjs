import assert from "node:assert/strict";
import { lstat, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { collectProductInventory } from "../../tooling/lib/user-guides.mjs";

const root = fileURLToPath(new URL("../..", import.meta.url));
const requiredHeadings = [
  "목적과 최종 산출물",
  "사용할 때",
  "사용하지 않을 때",
  "필수 입력과 선택 입력",
  "Codex App 요청 예시",
  "Codex CLI 요청 예시",
  "내부 진행 흐름",
  "생성 파일과 결과 구조",
  "관련 템플릿·품질 프로필·전문 역할",
  "이미지·도식화 조건",
  "검토·승인 기준",
  "실패·fallback·재개 방법",
  "다음 작업 요청문",
  "관련 문서",
];

function h2Headings(markdown) {
  return [...markdown.matchAll(/^## (.+)$/gm)].map((match) => match[1]);
}

function extractSection(markdown, heading) {
  const marker = `## ${heading}\n`;
  const start = markdown.indexOf(marker);
  assert.notEqual(start, -1, `missing section: ${heading}`);
  const bodyStart = start + marker.length;
  const next = markdown.indexOf("\n## ", bodyStart);
  return markdown.slice(bodyStart, next === -1 ? markdown.length : next).trim();
}

function assertSkillContract(markdown, skillId) {
  assert.deepEqual(h2Headings(markdown), requiredHeadings, `${skillId}: H2 contract/order`);
  for (const heading of [
    "관련 템플릿·품질 프로필·전문 역할",
    "이미지·도식화 조건",
    "관련 문서",
  ]) {
    const body = extractSection(markdown, heading);
    assert.ok(body, `${skillId}: ${heading} must not be empty`);
    assert.match(body, /\[[^\]]+\]\([^)]+\)/, `${skillId}: ${heading} needs a Markdown link`);
  }
}

function extractFirstColumnIds(markdown) {
  return [...markdown.matchAll(/^\| (?:`([^`]+)`|\[`([^`]+)`\]\([^)]+\)) \|/gm)]
    .map((match) => match[1] ?? match[2])
    .sort();
}

test("Studio documents every installed skill with the common contract", async () => {
  const inventory = await collectProductInventory(root, "game-design-studio");
  assert.equal(inventory.skillIds.length, 15);

  for (const skillId of inventory.skillIds) {
    const markdown = await readFile(
      path.join(root, "guides/game-design-studio/skills", skillId + ".md"),
      "utf8",
    );
    assertSkillContract(markdown, skillId);
    assert.match(markdown, /복사 가능한 요청문/);
    assert.match(markdown, /예상 결과/);
  }
});

test("Studio skill contract rejects missing or reordered new sections", async () => {
  const markdown = await readFile(
    path.join(root, "guides/game-design-studio/skills/define-game-vision.md"),
    "utf8",
  );
  const missing = markdown.replace(/^## 관련 문서[\s\S]*$/m, "");
  const reordered = markdown.replace(
    "## 이미지·도식화 조건",
    "## __temporary__",
  ).replace(
    "## 검토·승인 기준",
    "## 이미지·도식화 조건",
  ).replace(
    "## __temporary__",
    "## 검토·승인 기준",
  );
  assert.throws(() => assertSkillContract(missing, "missing"));
  assert.throws(() => assertSkillContract(reordered, "reordered"));
});

test("Studio indexes every installed skill and template exactly once", async () => {
  const inventory = await collectProductInventory(root, "game-design-studio");
  const skillIndex = await readFile(
    path.join(root, "guides/game-design-studio/skills/README.md"),
    "utf8",
  );
  const templates = await readFile(
    path.join(root, "guides/game-design-studio/templates.md"),
    "utf8",
  );

  assert.deepEqual(extractFirstColumnIds(skillIndex), inventory.skillIds);
  assert.deepEqual(extractFirstColumnIds(templates), inventory.templateIds);
  assert.equal(inventory.templateIds.length, 15);
});

test("Studio template guide separates installed paths, authoring sources, and generated snapshots", async () => {
  const inventory = await collectProductInventory(root, "game-design-studio");
  const templates = await readFile(path.join(root, "guides/game-design-studio/templates.md"), "utf8");
  assert.doesNotMatch(templates, /Package path:/);
  assert.match(templates, /설치 상대 경로/);
  assert.match(templates, /저장소 authoring source/);
  assert.match(templates, /generated snapshot/);
  for (const id of inventory.templateIds) {
    const paths = [
      `assets/templates/${id}/`,
      `products/game-design-studio/plugin/assets/templates/${id}/`,
      `plugins/game-design-studio/assets/templates/${id}/`,
    ];
    for (const relative of paths) {
      assert.ok(templates.includes(`\`${relative}\``), `missing documented template path: ${relative}`);
      const filename = relative.startsWith("assets/")
        ? path.join(root, "products/game-design-studio/plugin", relative)
        : path.join(root, relative);
      assert.ok((await lstat(filename)).isDirectory(), `template path does not exist: ${relative}`);
    }
  }
});

test("Studio topical guides preserve image, visualization, and export policies", async () => {
  const topicalGuides = await Promise.all(
    ["document-quality.md", "image-assets.md", "visualization.md", "exports.md"].map((filename) =>
      readFile(path.join(root, "guides/game-design-studio", filename), "utf8"),
    ),
  );
  const joinedGuides = topicalGuides.join("\n");

  for (const phrase of [
    "prompt-only",
    "select",
    "required",
    "all",
    "gpt-image-2",
    "low",
    "OpenAI only",
    "Codex",
    "SVG",
    "정확한 2× PNG",
    "MD",
    "PDF",
    "DOCX",
    "PPTX",
  ]) {
    assert.ok(joinedGuides.includes(phrase), "missing Studio guide contract: " + phrase);
  }
});

test("Studio visualization guides preserve the no-Node Skillstead fallback", async () => {
  const guidePaths = [
    "guides/game-design-studio/skills/svg-infographic.md",
    "guides/game-design-studio/skills/visualize-game-design.md",
    "guides/game-design-studio/visualization.md",
  ];

  for (const guidePath of guidePaths) {
    const markdown = await readFile(path.join(root, guidePath), "utf8");
    for (const phrase of [
      "node --version",
      "Node 18+",
      "SVG authoring",
      "machine-linted",
      "신뢰 가능한 package manager",
      "정확한 설치 명령",
      "명시적 승인",
      "curl | sh",
      "elevated privilege",
      "다른 source",
      "manual source checklist",
      "render.sh",
      "Node-free Chromium",
      "정확한 2× PNG",
      "visual QA",
      "SVG-only",
      "automated source lint",
      "PNG visual verification",
    ]) {
      assert.ok(markdown.includes(phrase), `${guidePath}: missing no-Node contract: ${phrase}`);
    }
  }
});
