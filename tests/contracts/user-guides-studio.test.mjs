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
const skillHandoffs = {
  "apply-document-quality-profile": ["caller-selected template", "document-quality-editor", "define-game-vision"],
  "define-game-vision": ["vision-pillars", "vision-one-pager", "lead-game-designer", "design-game-systems"],
  "design-game-content": ["narrative-quest-npc", "narrative-quest-npc-specification", "content-narrative-designer", "review-game-design"],
  "design-game-economy-and-liveops": ["economy-balance", "liveops-experiment-event", "system-economy-designer", "plan-game-production"],
  "design-game-systems": ["system-specification", "system-feature-specification", "system-economy-designer", "design-game-content"],
  "design-player-experience": ["ui-ux-flow-state", "ui-ux-flow-state-specification", "ux-accessibility-reviewer", "visualize-game-design"],
  "export-game-design-documents": ["current artifact profile", "production-feasibility-critic", "pdf/documents/presentations"],
  "generate-image-assets": ["current artifact profile", "art-brief-director", "review-image-assets"],
  "orchestrate-game-design-project": ["game-design-brief", "game-design-brief", "lead-game-designer", "define-game-vision"],
  "plan-game-production": ["production-scope-risk", "production-scope-milestone-risk-plan", "production-feasibility-critic", "review-game-design"],
  "plan-image-assets": ["current artifact profile", "art-brief-director", "generate-image-assets"],
  "review-game-design": ["game-design-review", "design-review-decision-log", "lead-game-designer", "plan-image-assets"],
  "review-image-assets": ["current artifact profile", "visual-asset-reviewer", "export-game-design-documents"],
  "svg-infographic": ["no Canonical Artifact template", "Skillstead", "visualize-game-design"],
  "visualize-game-design": ["current artifact profile", "lead-game-designer", "export-game-design-documents"],
};

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

test("Studio skill handoff sections expose route-specific IDs rather than generic placeholders", async () => {
  for (const [skillId, expected] of Object.entries(skillHandoffs)) {
    const markdown = await readFile(path.join(root, "guides/game-design-studio/skills", `${skillId}.md`), "utf8");
    const joined = [
      extractSection(markdown, "관련 템플릿·품질 프로필·전문 역할"),
      extractSection(markdown, "이미지·도식화 조건"),
      extractSection(markdown, "다음 작업 요청문"),
      extractSection(markdown, "관련 문서"),
    ].join("\n");
    assert.doesNotMatch(joined, /기존 Artifact의 템플릿과 선택된 Quality Profile을 그대로 사용/);
    for (const term of expected) assert.ok(joined.includes(term), `${skillId}: missing handoff term ${term}`);
  }
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

test("Studio image and export guides document runtime precedence and downstream resume", async () => {
  const base = path.join(root, "guides/game-design-studio");
  const images = await readFile(path.join(base, "image-assets.md"), "utf8");
  const exportsGuide = await readFile(path.join(base, "exports.md"), "utf8");
  const exportSkill = await readFile(path.join(base, "skills/export-game-design-documents.md"), "utf8");
  for (const phrase of ["workflow 호출 때마다", "현재 process environment", ".env보다 우선", "새 채팅", "새 세션"]) {
    assert.ok(images.includes(phrase), `Studio image guide missing ${phrase}`);
  }
  for (const phrase of ["MD terminal validation", "<artifact-path>", "<export-manifest-path>", "새 세션", "downstream workflow"]) {
    assert.ok(exportsGuide.includes(phrase), `Studio exports guide missing ${phrase}`);
  }
  assert.ok(extractSection(exportSkill, "다음 작업 요청문").includes("downstream workflow"));
});

test("Studio recipes keep only their local image-mode boundary and link the common guide", async () => {
  const recipes = ["content-quest-design", "economy-liveops", "new-game-gdd", "production-review-export", "system-feature-spec", "ux-accessibility"];
  for (const id of recipes) {
    const markdown = await readFile(path.join(root, "guides/game-design-studio/recipes", `${id}.md`), "utf8");
    assert.match(markdown, /\[이미지 자산 흐름\]\(\.\.\/image-assets\.md\)/, `${id}: missing common image guide`);
    assert.ok((markdown.match(/prompt-only/g) ?? []).length <= 1, `${id}: repeats all image modes`);
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
