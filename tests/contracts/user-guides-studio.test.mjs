import assert from "node:assert/strict";
import { lstat, readFile, readdir } from "node:fs/promises";
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
  "apply-document-quality-profile": { terms: ["caller-selected template"], templateIds: [], profileIds: [], roleIds: ["document-quality-editor"], nextTargets: ["design-game-systems"], mediaIds: [] },
  "define-game-vision": { templateIds: ["vision-pillars"], profileIds: ["vision-one-pager"], roleIds: ["lead-game-designer", "content-narrative-designer"], nextTargets: ["design-game-systems"], mediaIds: ["vision-reference-image", "skillstead-vision-dependency-diagram"] },
  "design-game-content": { templateIds: ["narrative-quest-npc", "character-skill-combat-monster"], profileIds: ["narrative-quest-npc-specification", "character-skill-combat-monster-specification"], roleIds: ["content-narrative-designer", "lead-game-designer", "production-feasibility-critic"], nextTargets: ["review-game-design"], mediaIds: ["npc-story-beat-image", "skillstead-quest-flow-diagram"] },
  "design-game-economy-and-liveops": { templateIds: ["economy-balance", "liveops-experiment-event"], profileIds: ["economy-balance-specification", "liveops-event-experiment-plan"], roleIds: ["system-economy-designer", "liveops-data-designer", "ux-accessibility-reviewer"], nextTargets: ["review-game-design"], mediaIds: ["economy-player-view-image", "skillstead-economy-source-sink-diagram", "skillstead-live-service-lifecycle-diagram"] },
  "design-game-systems": { templateIds: ["system-specification"], profileIds: ["system-feature-specification"], roleIds: ["system-economy-designer", "ux-accessibility-reviewer"], nextTargets: ["review-game-design"], mediaIds: ["feature-readability-image", "skillstead-feature-state-diagram"] },
  "design-player-experience": { templateIds: ["ui-ux-flow-state"], profileIds: ["ui-ux-flow-state-specification"], roleIds: ["ux-accessibility-reviewer", "lead-game-designer"], nextTargets: ["review-game-design"], mediaIds: ["ui-key-screen-image", "skillstead-ui-flow-state-diagram"] },
  "export-game-design-documents": { terms: ["current artifact profile", "pdf/documents/presentations"], templateIds: [], profileIds: [], roleIds: ["production-feasibility-critic"], nextTargets: ["downstream"], mediaIds: [] },
  "generate-image-assets": { terms: ["current artifact profile"], templateIds: [], profileIds: [], roleIds: ["art-brief-director"], nextTargets: ["review-image-assets"], mediaIds: [] },
  "orchestrate-game-design-project": { templateIds: ["game-design-brief"], profileIds: ["game-design-brief"], roleIds: ["lead-game-designer", "production-feasibility-critic"], nextTargets: ["define-game-vision", "design-game-systems"], mediaIds: ["design-context-image", "skillstead-design-flow-diagram"] },
  "plan-game-production": { templateIds: ["production-scope-risk"], profileIds: ["production-scope-milestone-risk-plan"], roleIds: ["production-feasibility-critic", "lead-game-designer"], nextTargets: ["review-game-design"], mediaIds: ["scope-reference-image", "skillstead-production-roadmap-dependency-diagram"] },
  "plan-image-assets": { terms: ["current artifact profile", "prompt-only", "select/required/all"], templateIds: [], profileIds: [], roleIds: ["art-brief-director"], nextTargets: ["generate-image-assets"], mediaIds: [] },
  "review-game-design": { templateIds: ["game-design-review"], profileIds: ["design-review-decision-log"], roleIds: ["lead-game-designer", "production-feasibility-critic", "ux-accessibility-reviewer"], nextTargets: ["review-game-design", "export-game-design-documents"], mediaIds: [] },
  "review-image-assets": { terms: ["document-approved"], templateIds: [], profileIds: [], roleIds: ["visual-asset-reviewer", "art-brief-director"], nextTargets: ["export-game-design-documents"], mediaIds: [] },
  "svg-infographic": { terms: ["no Canonical Artifact template"], templateIds: [], profileIds: [], roleIds: ["lead-game-designer"], nextTargets: ["visualize-game-design"], mediaIds: [] },
  "visualize-game-design": { terms: ["current artifact profile", "visual QA"], templateIds: [], profileIds: [], roleIds: ["lead-game-designer"], nextTargets: ["review-game-design", "export-game-design-documents"], mediaIds: [] },
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
  for (const heading of requiredHeadings) {
    assert.ok(markdown.includes(`## ${heading}\n\n`), `${skillId}: H2 must be followed by a blank line: ${heading}`);
  }
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

async function sourceInventory(product) {
  const profiles = [];
  const profileRoot = path.join(root, "shared/document-quality/profiles", product === "game-design-studio" ? "studio" : "career");
  for (const entry of await readdir(profileRoot)) profiles.push(JSON.parse(await readFile(path.join(profileRoot, entry), "utf8")));
  return {
    profiles,
    profileIds: new Set(profiles.map((profile) => profile.profile_id)),
    roleIds: new Set((await readdir(path.join(root, "products", product, "plugin/agents"))).map((entry) => path.basename(entry, ".md"))),
  };
}

test("Studio skill handoffs are source-backed and match documented flow targets", async () => {
  const inventory = await collectProductInventory(root, "game-design-studio");
  const sources = await sourceInventory("game-design-studio");
  const templateIds = new Set(inventory.templateIds);
  const allowedNextTargets = new Set([...inventory.skillIds, "downstream"]);
  const sourceMediaIds = new Set(sources.profiles.flatMap((profile) => [
    ...profile.required_images,
    ...profile.required_diagrams,
  ].map((item) => item.id)));

  for (const [skillId, handoff] of Object.entries(skillHandoffs)) {
    const markdown = await readFile(path.join(root, "guides/game-design-studio/skills", `${skillId}.md`), "utf8");
    const related = extractSection(markdown, "관련 템플릿·품질 프로필·전문 역할");
    const media = extractSection(markdown, "이미지·도식화 조건");
    const next = extractSection(markdown, "다음 작업 요청문");
    const joined = [
      related,
      media,
      next,
      extractSection(markdown, "관련 문서"),
    ].join("\n");
    assert.doesNotMatch(joined, /기존 Artifact의 템플릿과 선택된 Quality Profile을 그대로 사용/);
    for (const id of handoff.templateIds) {
      assert.ok(templateIds.has(id), `${skillId}: unknown template ID ${id}`);
      assert.ok(related.includes(id), `${skillId}: missing template ID ${id}`);
    }
    for (const id of handoff.profileIds) {
      assert.ok(sources.profileIds.has(id), `${skillId}: unknown profile ID ${id}`);
      assert.ok(related.includes(id), `${skillId}: missing profile ID ${id}`);
    }
    for (const id of handoff.roleIds) {
      assert.ok(sources.roleIds.has(id), `${skillId}: unknown role ID ${id}`);
      assert.ok(related.includes(id), `${skillId}: missing role ID ${id}`);
    }
    for (const id of handoff.nextTargets) {
      assert.ok(allowedNextTargets.has(id), `${skillId}: unknown next target ${id}`);
      assert.ok(next.includes(id), `${skillId}: next request does not expose ${id}`);
    }
    const selectedProfileMediaIds = new Set(sources.profiles
      .filter((profile) => handoff.profileIds.includes(profile.profile_id))
      .flatMap((profile) => [...profile.required_images, ...profile.required_diagrams].map((item) => item.id)));
    for (const id of handoff.mediaIds) {
      assert.ok(sourceMediaIds.has(id), `${skillId}: undocumented profile media ID ${id}`);
      assert.ok(selectedProfileMediaIds.has(id), `${skillId}: media ID is not required by the selected profile`);
      assert.ok(media.includes(id), `${skillId}: missing media ID ${id}`);
    }
    for (const term of handoff.terms ?? []) assert.ok(joined.includes(term), `${skillId}: missing handoff term ${term}`);
    for (const id of media.match(/\b(?:skillstead-[a-z0-9-]+|[a-z0-9-]+-image)\b/g) ?? []) {
      assert.ok(sourceMediaIds.has(id), `${skillId}: media section invented ${id}`);
    }
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
  assert.doesNotMatch(exportsGuide, /(?:probe|available)[^.\n]*(?:MD capability|MD\/PDF|MD·PDF)/i, "MD must not be probe-gated");
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
