import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const pluginRoot = path.join(repoRoot, "products/game-design-career/plugin");
const readmePath = path.join(pluginRoot, "README.md");

const skillIds = [
  "orchestrate-game-design-career",
  "map-game-design-career",
  "research-game-design-jobs",
  "build-game-design-portfolio",
  "reverse-engineer-game-design",
  "practice-game-design-interview",
  "review-game-design-portfolio",
  "plan-junior-growth",
  "visualize-career-roadmap",
  "export-career-documents",
];

const roleIds = [
  "career-strategist",
  "game-design-mentor",
  "portfolio-reviewer",
  "reverse-design-critic",
  "interview-coach",
  "evidence-auditor",
];

const templateIds = [
  "career-stage-goal",
  "game-design-role-map",
  "competency-matrix",
  "job-posting-evidence",
  "portfolio-project-brief",
  "reverse-design-document",
  "five-axis-review",
  "interview-question-answer-log",
  "junior-growth-review",
  "transition-readiness",
  "learning-roadmap",
  "portfolio-backlog",
  "creative-design-portfolio",
  "introduction-motivation",
  "game-analysis-report",
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

test("README exposes every shipped skill, role asset, stage, and canonical template", async () => {
  const readme = await readFile(readmePath, "utf8");
  assert.deepEqual(tableIds(readme, "스킬 카탈로그"), skillIds);
  assert.deepEqual(tableIds(readme, "전문 역할 프롬프트"), roleIds);
  assert.deepEqual(tableIds(readme, "Canonical Artifact 템플릿"), templateIds);
  for (const stage of ["entry", "new-hire", "junior-growth", "transition"]) {
    assert.ok(readme.includes(`| \`${stage}\` |`), `missing career stage: ${stage}`);
  }
});

test("README documents truthful installation, workflow, safety, visualization, export, and support boundaries", async () => {
  const readme = await readFile(readmePath, "utf8");
  const requiredHeadings = [
    "설치",
    "업데이트와 제거",
    "작동 방식",
    "근거와 최신성 정책",
    "Canonical Artifact",
    "사용 예시",
    "Skillstead 도식화",
    "MD, PDF, DOCX, PPTX 내보내기",
    "권리, 개인정보와 공정성",
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
    "codex plugin add game-design-career@game-design-suite",
    "codex plugin remove game-design-career@game-design-suite",
  ]) {
    assert.ok(readme.includes(command), `missing verified CLI command: ${command}`);
  }

  for (const phrase of [
    "최대 3개",
    "병렬",
    "순차 fallback",
    "결정론",
    "1차 출처",
    "검색일",
    "표본",
    "지역",
    "일반화",
    "조작하지",
    "합격을 보장하지",
    "독립적인 스토리",
    "fail-closed",
    "SVG lint",
    "2× PNG",
    "네이티브 자동 발견을 보장하지",
  ]) {
    assert.ok(readme.includes(phrase), `missing operational boundary: ${phrase}`);
  }

  for (const example of [
    "진로 미결정 입문자",
    "목표 채용 공고 근거 매트릭스",
    "역기획 포트폴리오",
    "5축 포트폴리오 리뷰",
    "면접 연습",
    "주니어 성장 계획",
    "시각적 로드맵",
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
  assert.match(readme, /^## 플러그인 구조$/m);

  for (const pathOrCount of [
    "products/game-design-career/plugin",
    "plugins/game-design-career",
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
