import assert from "node:assert/strict";
import { lstat, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { auditGameDesignDocs, formatAuditReport, validateAuditEvidenceRegister } from "../../tooling/audit-game-design-docs.mjs";
import { renderPromptCard, validateRenderedPromptCard } from "../../tooling/lib/prompt-guides.mjs";

async function temporaryRepo(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), "game-design-doc-audit-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

async function write(root, relativePath, contents) {
  const target = path.join(root, relativePath);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, contents);
}

async function contentTemplateFiles(root) {
  const roots = [
    "products/game-design-studio/plugin/assets/templates",
    "products/game-design-career/plugin/assets/templates",
  ];
  const files = [];
  for (const templateRoot of roots) {
    for (const entry of await readdir(path.join(root, templateRoot), { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      files.push(path.join(templateRoot, entry.name, "content.md"));
    }
  }
  return files.sort();
}

async function templateContractFiles(root) {
  const contentFiles = await contentTemplateFiles(root);
  const files = contentFiles.flatMap((contentFile) => {
    const directory = path.dirname(contentFile);
    return ["content.md", "evidence.yml", "export-manifest.yml"].map((name) => path.join(directory, name));
  }).sort();
  for (const file of files) {
    const stats = await lstat(path.join(root, file));
    assert.equal(stats.isSymbolicLink(), false, `${file}: symbolic links are not template contracts`);
    assert.equal(stats.isFile(), true, `${file}: regular file`);
  }
  return files;
}

function promptEntry() {
  return {
    id: "studio:define-game-vision:beginner",
    kind: "skill-template",
    product: "studio",
    title: "게임 비전 초안",
    display_title: "게임 비전 초안",
    sample_result_excerpt: "studio:define-game-vision:beginner 예: `game-design/island/vision/content.md`에 협동 섬 복구의 핵심 경험과 검증 질문을 기록하고 미정 값은 남깁니다.",
    purpose: "한 문장 게임 아이디어를 검토 가능한 비전 초안으로 정리한다.",
    audiences: ["game-designer"],
    intents: ["게임 비전 작성"],
    level: "beginner",
    when_to_use: "핵심 경험을 처음 설명할 때 사용한다.",
    when_not_to_use: "승인된 제작 범위를 바꿀 때는 사용하지 않는다.",
    required_inputs: ["게임 아이디어"],
    optional_inputs: ["플랫폼"],
    placeholders: ["[게임 아이디어]"],
    app_prompt: {
      example: "@Game Design Studio 협동 섬 복구 게임의 핵심 경험과 검증 질문을 정리해 줘.",
      template: "@Game Design Studio [게임 아이디어]의 핵심 경험과 검증 질문을 정리해 줘.",
    },
    cli_prompt: {
      example: "$game-design-studio:define-game-vision 협동 섬 복구 게임의 핵심 경험과 검증 질문을 정리해.",
      template: "$game-design-studio:define-game-vision [게임 아이디어]의 핵심 경험과 검증 질문을 정리해.",
    },
    skill: "define-game-vision",
    skill_chain: ["define-game-vision", "review-game-design"],
    specialist_roles: ["lead-game-designer"],
    intermediate_artifacts: ["vision-pillars"],
    minimum_outputs: ["핵심 경험", "검증 질문"],
    optional_outputs: ["플랫폼 가정"],
    extended_outputs: ["검토 기록"],
    expected_file_tree: ["game-design/island/vision/content.md"],
    read_order: ["game-design/island/vision/content.md"],
    human_review_boundary: "lead-game-designer가 초안을 검토하며 자동 결과는 승인하지 않는다.",
    hold_conditions: ["검토자가 없음"],
    resume_prompt: "확인된 플레이어 관찰만 반영해 재개해.",
    safety_boundary: "모르는 정보는 미정으로 남긴다.",
    diagram_binding: { id: "st-s02", svg: "guides/assets/st-s02.svg", png: "guides/assets/st-s02.png", alt: "비전 흐름" },
    related_use_cases: [],
    related_recipes: [],
    source_references: ["guides/game-design-studio/skills/define-game-vision.md"],
  };
}

test("auditGameDesignDocs reports only deterministic high-severity Korean documentation defects", async (t) => {
  const root = await temporaryRepo(t);
  await write(root, "shared/templates/quality.md", [
    "## Result {#result}",
    "문서는 자동으로 생성됩니다.",
    "이 방식은 최고의 결과를 보장합니다.",
    "결론적으로 검토가 필요합니다.",
    "결론적으로 사람의 검토가 필요합니다.",
  ].join("\n"));
  await write(root, "shared/templates/allowed.md", "UX, UI, LiveOps, API, prompt, token은 게임 문맥에서 그대로 쓸 수 있습니다.\n");
  await write(root, "plugins/game-design-studio/generated.md", "## Result\n이 방식은 최고의 결과를 보장합니다.\n");
  await write(root, "shared/vendor/upstream.md", "## Result\n이 방식은 최고의 결과를 보장합니다.\n");

  const result = await auditGameDesignDocs({ repoRoot: root });

  assert.deepEqual(result.issues, [
    { code: "ENGLISH_FIRST_LABEL", path: "shared/templates/quality.md", line: 1, severity: "high", text: "Result" },
    { code: "TRANSLATION_LIKE_PASSIVE", path: "shared/templates/quality.md", line: 2, severity: "high", text: "문서는 자동으로 생성됩니다." },
    { code: "UNSUPPORTED_HYPE", path: "shared/templates/quality.md", line: 3, severity: "high", text: "이 방식은 최고의 결과를 보장합니다." },
    { code: "REPEATED_CONCLUSION", path: "shared/templates/quality.md", line: 5, severity: "high", text: "결론적으로" },
  ]);
  assert.deepEqual(result.files, [
    { path: "shared/templates/allowed.md", issueCount: 0 },
    { path: "shared/templates/quality.md", issueCount: 4 },
  ]);
  assert.equal(formatAuditReport(result), [
    "# 게임 기획 문서 언어 감사",
    "",
    "검사 파일: 2개",
    "고심각도 이슈: 4개",
    "",
    "## shared/templates/quality.md",
    "",
    "- L1 `ENGLISH_FIRST_LABEL`: Result",
    "- L2 `TRANSLATION_LIKE_PASSIVE`: 문서는 자동으로 생성됩니다.",
    "- L3 `UNSUPPORTED_HYPE`: 이 방식은 최고의 결과를 보장합니다.",
    "- L5 `REPEATED_CONCLUSION`: 결론적으로",
    "",
  ].join("\n"));
});

test("auditGameDesignDocs rejects Korean-prefix heading workarounds and English artifact prose", async (t) => {
  const root = await temporaryRepo(t);
  await write(root, "products/game-design-career/plugin/assets/templates/report/content.md", [
    "---",
    "title: stable machine metadata",
    "artifact_id: report",
    "---",
    "# 게임 분석 보고서 {#report}",
    "## 기획 항목: Analysis Claims {#analysis-claims}",
    "설명: For each stable claim, record observation, source address, scope, and confidence.",
    "| 항목 ID | 현재 상태 | 근거 또는 다음 작업 | 담당자 |",
    "| --- | --- | --- | --- |",
    "| `claim-id` | not-observed | Record a project-specific value before approval. | artifact-owner |",
  ].join("\n"));

  const result = await auditGameDesignDocs({ repoRoot: root });

  assert.deepEqual(result.issues, [
    {
      code: "MIXED_PREFIX_LABEL",
      path: "products/game-design-career/plugin/assets/templates/report/content.md",
      line: 6,
      severity: "high",
      text: "기획 항목: Analysis Claims",
    },
    {
      code: "ENGLISH_DOMINANT_PROSE",
      path: "products/game-design-career/plugin/assets/templates/report/content.md",
      line: 7,
      severity: "high",
      text: "설명: For each stable claim, record observation, source address, scope, and confidence.",
    },
    {
      code: "ENGLISH_DOMINANT_PROSE",
      path: "products/game-design-career/plugin/assets/templates/report/content.md",
      line: 10,
      severity: "high",
      text: "| `claim-id` | not-observed | Record a project-specific value before approval. | artifact-owner |",
    },
  ]);
});

test("artifact prose audit rejects one-word mixed headings and short English instructions", async (t) => {
  const root = await temporaryRepo(t);
  await write(root, "products/game-design-studio/plugin/assets/templates/assets/content.md", [
    "---",
    "artifact_id: assets",
    "---",
    "# 이미지 자료 {#assets}",
    "## 기획 항목: Assets {#asset-list}",
    "안내: Record value before approval.",
    "벡터 도식(SVG)은 그대로 표시합니다.",
    "참조: `asset-id`",
  ].join("\n"));

  const result = await auditGameDesignDocs({ repoRoot: root });

  assert.deepEqual(result.issues, [
    {
      code: "MIXED_PREFIX_LABEL",
      path: "products/game-design-studio/plugin/assets/templates/assets/content.md",
      line: 5,
      severity: "high",
      text: "기획 항목: Assets",
    },
    {
      code: "ENGLISH_DOMINANT_PROSE",
      path: "products/game-design-studio/plugin/assets/templates/assets/content.md",
      line: 6,
      severity: "high",
      text: "안내: Record value before approval.",
    },
  ]);
});

test("renderPromptCard keeps a Korean-first request and result excerpt before collapsed advanced contracts", () => {
  const markdown = renderPromptCard(promptEntry());

  assert.match(markdown, /### 간단 요청 예시\n[\s\S]*협동 섬 복구 게임/u);
  assert.match(markdown, /### 짧은 흐름\n[\s\S]*define-game-vision → review-game-design/u);
  assert.match(markdown, /### 이 요청으로 받는 결과\n[\s\S]*핵심 경험/u);
  assert.match(markdown, /<details>\n<summary>고급 정보: 명령어·안전 경계·재개 기록<\/summary>/u);
  assert.ok(markdown.indexOf("### 간단 요청 예시") < markdown.indexOf("<details>"));
  assert.match(markdown, /\$game-design-studio:define-game-vision/u);
  assert.match(markdown, /lead-game-designer가 초안을 검토/u);
  assert.match(markdown, /studio:define-game-vision:beginner 예: `game-design\/island\/vision\/content\.md`/u);
});

test("rendered simple work order and reviewer are exact catalog contracts while advanced text fences remain intact", () => {
  const entry = promptEntry();
  const card = renderPromptCard(entry);
  assert.equal(validateRenderedPromptCard(entry, card), true);

  assert.throws(
    () => validateRenderedPromptCard(entry, card.replace("- 작업 순서: define-game-vision → review-game-design", "- 작업 순서: review-game-design → define-game-vision")),
    /missing required contract: studio:define-game-vision:beginner/u,
  );
  assert.throws(
    () => validateRenderedPromptCard(entry, card.replace(entry.human_review_boundary, "자동 승인됨")),
    /missing required contract: studio:define-game-vision:beginner/u,
  );
  assert.throws(
    () => validateRenderedPromptCard(entry, card.replace(entry.resume_prompt, "검토를 생략하고 재개해.")),
    /text block differs from catalog: studio:define-game-vision:beginner:5/u,
  );
});

test("representative Studio and Career artifact templates present Korean-first labels without changing stable IDs", async () => {
  const repoRoot = path.resolve(import.meta.dirname, "../..");
  const [studio, career] = await Promise.all([
    readFile(path.join(repoRoot, "products/game-design-studio/plugin/assets/templates/game-design-brief/content.md"), "utf8"),
    readFile(path.join(repoRoot, "products/game-design-career/plugin/assets/templates/game-analysis-report/content.md"), "utf8"),
  ]);

  assert.match(studio, /^artifact_id: game-design-brief$/mu);
  assert.match(studio, /^# 게임 기획 요약서 \{#game-design-brief\}$/mu);
  assert.match(studio, /^## 작업 기록 \{#working-record\}$/mu);
  assert.match(studio, /^\| 항목 ID \| 상태 \| 근거 또는 다음 작업 \| 담당자 \|$/mu);
  assert.match(career, /^artifact_id: game-analysis-report$/mu);
  assert.match(career, /^# 게임 분석 보고서 \{#game-analysis-report\}$/mu);
  assert.match(career, /^## 작업 기록 \{#working-record\}$/mu);
  assert.match(career, /^\| 항목 ID \| 현재 상태 \| 근거 또는 다음 작업 \| 담당자 \|$/mu);
});

test("beginner-facing Studio entry points explain planning terms in plain Korean", async () => {
  const repoRoot = path.resolve(import.meta.dirname, "../..");
  const entryPoints = [
    "README.md",
    "guides/game-design-studio/README.md",
    "guides/game-design-studio/quick-start.md",
    "guides/sample-results/studio/st-c01.md",
    "guides/sample-results/suite/resume-failed-derivatives.md",
    "products/game-design-studio/plugin/README.md",
  ];
  const awkwardDisplayTerms = /비전 기둥|게임 기획 브리프|player promise|anti-pillar|non-goals?|blocker receipt|resume receipt|rights owner|design owner/u;

  for (const pathname of entryPoints) {
    const body = await readFile(path.join(repoRoot, pathname), "utf8");
    assert.doesNotMatch(body, awkwardDisplayTerms, `${pathname}: plain Korean display terms`);
  }

  const rootReadme = await readFile(path.join(repoRoot, "README.md"), "utf8");
  assert.match(rootReadme, /게임 방향 원칙 \(`vision-pillars`\)/u);
  assert.match(rootReadme, /게임 기획 요약서 \(`game-design-brief`\)/u);
});

test("all 30 artifact content templates keep anchored visible headings and table labels Korean-first", async () => {
  const repoRoot = path.resolve(import.meta.dirname, "../..");
  const files = await contentTemplateFiles(repoRoot);
  assert.equal(files.length, 30);
  assert.equal((await templateContractFiles(repoRoot)).length, 90, "30 template roots × content/evidence/export contracts");
  for (const file of files) {
    const body = await readFile(path.join(repoRoot, file), "utf8");
    const headings = [...body.matchAll(/^#{1,6}\s+(.+?)\s*$/gmu)].map(([, label]) => label.replace(/\s+\{#[a-z0-9-]+\}\s*$/u, ""));
    assert.ok(headings.length > 0, `${file}: visible heading`);
    for (const heading of headings) assert.match(heading, /[가-힣]/u, `${file}: ${heading}`);
    assert.doesNotMatch(body, /^#{1,6}\s+기획 항목:/mu, `${file}: no Korean-prefix workaround`);
    assert.match(body, /^## (?:작업|작성) 기록 \{#working-record\}$/mu, `${file}: working record heading`);
    assert.match(body, /^\| 항목 ID \| (?:현재 )?상태 \| 근거 또는 다음 작업 \| 담당자 \|$/mu, `${file}: work table labels`);
    assert.match(body, /^\| 버전 \| 날짜 \| 담당자 \| 변경 내용 \| 승인 \|$/mu, `${file}: history table labels`);
  }

  const audit = await auditGameDesignDocs({ repoRoot });
  const templateIssues = audit.issues.filter((issue) => /\/assets\/templates\/[^/]+\/content\.md$/u.test(issue.path));
  assert.deepEqual(templateIssues, [], "artifact content templates contain no mixed-prefix labels or English-dominant prose");
});

test("audit evidence keeps the top-level and every source at the same retrieval date", async () => {
  const repoRoot = path.resolve(import.meta.dirname, "../..");
  const register = JSON.parse(await readFile(path.join(repoRoot, "shared/knowledge/trends/source-register.json"), "utf8"));
  assert.equal(validateAuditEvidenceRegister(register), true);

  const drifted = structuredClone(register);
  drifted.sources[0].retrievedAt = "2026-08-10";
  assert.throws(
    () => validateAuditEvidenceRegister(drifted),
    /audit evidence source retrievedAt must equal 2026-08-11: EXT-NIST-AI-600-1/u,
  );
});
