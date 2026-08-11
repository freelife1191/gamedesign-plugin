import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { auditGameDesignDocs, formatAuditReport } from "../../tooling/audit-game-design-docs.mjs";
import { renderPromptCard } from "../../tooling/lib/prompt-guides.mjs";

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

function promptEntry() {
  return {
    id: "studio:define-game-vision:beginner",
    kind: "skill-template",
    product: "studio",
    title: "게임 비전 초안",
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
    "## Result",
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

test("renderPromptCard keeps a Korean-first request and result excerpt before collapsed advanced contracts", () => {
  const markdown = renderPromptCard(promptEntry());

  assert.match(markdown, /### 간단 요청 예시\n[\s\S]*협동 섬 복구 게임/u);
  assert.match(markdown, /### 짧은 흐름\n[\s\S]*define-game-vision → review-game-design/u);
  assert.match(markdown, /### 이 요청으로 받는 결과\n[\s\S]*핵심 경험/u);
  assert.match(markdown, /<details>\n<summary>고급 정보: 명령어·안전 경계·재개 기록<\/summary>/u);
  assert.ok(markdown.indexOf("### 간단 요청 예시") < markdown.indexOf("<details>"));
  assert.match(markdown, /\$game-design-studio:define-game-vision/u);
  assert.match(markdown, /lead-game-designer가 초안을 검토/u);
});

test("representative Studio and Career artifact templates present Korean-first labels without changing stable IDs", async () => {
  const repoRoot = path.resolve(import.meta.dirname, "../..");
  const [studio, career] = await Promise.all([
    readFile(path.join(repoRoot, "products/game-design-studio/plugin/assets/templates/game-design-brief/content.md"), "utf8"),
    readFile(path.join(repoRoot, "products/game-design-career/plugin/assets/templates/game-analysis-report/content.md"), "utf8"),
  ]);

  assert.match(studio, /^artifact_id: game-design-brief$/mu);
  assert.match(studio, /^# 게임 기획 브리프 \{#game-design-brief\}$/mu);
  assert.match(studio, /^## 작업 기록 \{#working-record\}$/mu);
  assert.match(studio, /^\| 항목 ID \| 현재 상태 \| 근거 또는 다음 작업 \| 담당자 \|$/mu);
  assert.match(career, /^artifact_id: game-analysis-report$/mu);
  assert.match(career, /^# 게임 분석 보고서 \{#game-analysis-report\}$/mu);
  assert.match(career, /^## 작업 기록 \{#working-record\}$/mu);
  assert.match(career, /^\| 항목 ID \| 현재 상태 \| 근거 또는 다음 작업 \| 담당자 \|$/mu);
});
