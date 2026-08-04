import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const pluginRoot = path.join(repoRoot, "products/game-design-studio/plugin");
const readmePath = path.join(pluginRoot, "README.md");

const skillIds = [
  "orchestrate-game-design-project",
  "define-game-vision",
  "design-game-systems",
  "design-game-content",
  "design-player-experience",
  "design-game-economy-and-liveops",
  "plan-game-production",
  "review-game-design",
  "visualize-game-design",
  "export-game-design-documents",
];

const roleIds = [
  "lead-game-designer",
  "system-economy-designer",
  "content-narrative-designer",
  "ux-accessibility-reviewer",
  "liveops-data-designer",
  "production-feasibility-critic",
];

const templateIds = [
  "game-design-brief",
  "vision-pillars",
  "core-motivation-loop",
  "system-specification",
  "rule-exception-matrix",
  "ui-ux-flow-state",
  "data-schema-table-contract",
  "narrative-quest-npc",
  "character-skill-combat-monster",
  "economy-balance",
  "liveops-experiment-event",
  "accessibility-platform-matrix",
  "production-scope-risk",
  "game-design-review",
  "decision-change-log",
];

function tableIds(markdown, heading) {
  const start = markdown.indexOf(`## ${heading}`);
  assert.notEqual(start, -1, `missing section: ${heading}`);
  const section = markdown.slice(start + heading.length + 3).split("\n## ")[0];
  return [...section.matchAll(/^\| `([^`]+)` \|/gm)].map((match) => match[1]);
}

test("release documentation ships the plugin license and third-party notices", async () => {
  await Promise.all([
    access(readmePath),
    access(path.join(pluginRoot, "LICENSE")),
    access(path.join(pluginRoot, "THIRD_PARTY_NOTICES.md")),
  ]);

  const [license, notices] = await Promise.all([
    readFile(path.join(pluginRoot, "LICENSE"), "utf8"),
    readFile(path.join(pluginRoot, "THIRD_PARTY_NOTICES.md"), "utf8"),
  ]);
  assert.match(license, /MIT License/);
  assert.match(notices, /Skillstead svg-infographic/);
  assert.match(notices, /0\.8\.3/);
  assert.match(notices, /Apache-2\.0/);
  assert.match(notices, /Copyright 2026 Kyungseo Park/);
  assert.match(notices, /49/);
  assert.match(notices, /docs\//);
});

test("README exposes every shipped skill, role asset, profile, and canonical template", async () => {
  const readme = await readFile(readmePath, "utf8");
  assert.deepEqual(tableIds(readme, "스킬 카탈로그"), skillIds);
  assert.deepEqual(tableIds(readme, "전문 역할 프롬프트"), roleIds);
  assert.deepEqual(tableIds(readme, "Canonical Artifact 템플릿"), templateIds);

  const [actualSkills, actualRoles, actualTemplates, actualProfiles] = await Promise.all([
    readdir(path.join(pluginRoot, "skills"), { withFileTypes: true }),
    readdir(path.join(pluginRoot, "agents"), { withFileTypes: true }),
    readdir(path.join(pluginRoot, "assets/templates"), { withFileTypes: true }),
    readdir(path.join(pluginRoot, "references/profiles"), { withFileTypes: true }),
  ]);
  assert.deepEqual(
    actualSkills.filter((entry) => entry.isDirectory()).map(({ name }) => name).sort(),
    [...skillIds].sort(),
  );
  assert.deepEqual(
    actualRoles.filter((entry) => entry.isFile() && entry.name.endsWith(".md")).map(({ name }) => name.slice(0, -3)).sort(),
    [...roleIds].sort(),
  );
  assert.deepEqual(
    actualTemplates.filter((entry) => entry.isDirectory()).map(({ name }) => name).sort(),
    [...templateIds].sort(),
  );
  assert.deepEqual(
    actualProfiles.filter((entry) => entry.isFile() && entry.name.endsWith(".json")).map(({ name }) => name.slice(0, -5)).sort(),
    ["live-service-rpg", "mobile", "pc-console", "universal-core"],
  );
  for (const profile of ["universal-core", "live-service-rpg", "mobile", "pc-console"]) {
    assert.ok(readme.includes(`| \`${profile}\` |`), `missing profile: ${profile}`);
  }
});

test("README documents truthful installation, workflow, safety, visualization, export, and support boundaries", async () => {
  const readme = await readFile(readmePath, "utf8");
  const requiredHeadings = [
    "설치",
    "업데이트와 제거",
    "플러그인 구조",
    "작동 방식",
    "프로필 합성",
    "근거와 최신성 정책",
    "Canonical Artifact",
    "사용 예시",
    "Skillstead 도식화",
    "MD, PDF, DOCX, PPTX 내보내기",
    "책임 있는 설계 게이트",
    "제한 사항",
    "문제 해결",
    "검증",
    "라이선스",
  ];
  for (const heading of requiredHeadings) {
    assert.match(readme, new RegExp(`^## ${heading}$`, "m"));
  }

  for (const command of [
    "codex plugin marketplace add <path-to-repository-root>",
    "codex plugin add game-design-studio@game-design-suite",
    "codex plugin remove game-design-studio@game-design-suite",
  ]) {
    assert.ok(readme.includes(command), `missing verified CLI command: ${command}`);
  }

  for (const phrase of [
    "최대 3개",
    "병렬",
    "순차 fallback",
    "결정론",
    "universal-core",
    "conflict decision record",
    "1차 출처",
    "검색일",
    "조작하지",
    "hard No-Go",
    "fail-closed",
    "SVG lint",
    "정확한 2× PNG",
    "네이티브 자동 발견을 보장하지",
  ]) {
    assert.ok(readme.includes(phrase), `missing operational boundary: ${phrase}`);
  }

  for (const example of [
    "새 GDD",
    "시스템 명세",
    "경제와 LiveOps 리뷰",
    "AI NPC 안전 검토",
    "게임 기획 도식화",
    "문서 내보내기",
  ]) {
    assert.match(readme, new RegExp(`^### ${example}$`, "m"));
  }
});

test("README local links resolve inside the source plugin or repository", async () => {
  const readme = await readFile(readmePath, "utf8");
  const links = [...readme.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)]
    .map((match) => match[1])
    .filter((target) => !target.startsWith("http") && !target.startsWith("#"));
  assert.ok(links.length > 0, "README must link to inspectable local contracts");
  for (const target of links) {
    assert.ok(!path.isAbsolute(target), `local link must be relative: ${target}`);
    await access(path.resolve(pluginRoot, target));
  }
});

test("README explains the source overlay and complete independent built-plugin structure", async () => {
  const readme = await readFile(readmePath, "utf8");
  for (const pathOrCount of [
    "products/game-design-studio/plugin",
    "plugins/game-design-studio",
    ".codex-plugin/plugin.json",
    "skills/ (11개)",
    "skills/svg-infographic/",
    "agents/ (6개)",
    "hooks/hooks.json",
    "scripts/",
    "references/shared/knowledge/core/",
    "references/shared/knowledge/trends/",
    "references/source/docs/ (49개)",
    "references/shared/export/schema/",
    "references/profiles/",
    "assets/templates/ (15개)",
    "assets/product-mark.svg",
    "BUILD-MANIFEST.json",
  ]) {
    assert.ok(readme.includes(pathOrCount), `missing packaged structure: ${pathOrCount}`);
  }

  for (const contract of [
    "source overlay",
    "generated independent snapshot",
    "suite build",
    "SessionStart",
    "capability-probe",
    "Stop",
    "one-retry",
    "artifact review",
    "shared runtime",
    "product helper",
    "생성 결과를 직접 편집하지",
  ]) {
    assert.ok(readme.includes(contract), `missing structure boundary: ${contract}`);
  }
});
