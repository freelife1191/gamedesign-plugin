import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { lstat, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  collectMarkdownHeadings as visibleMarkdownHeadings,
  collectProductInventory,
  extractMarkdownLinks as visibleMarkdownLinks,
} from "../../tooling/lib/user-guides.mjs";
import { loadPromptTemplateCatalog } from "../../tooling/lib/prompt-template-catalog.mjs";

const root = fileURLToPath(new URL("../..", import.meta.url));
const guideRoot = path.join(root, "guides");
const products = ["game-design-studio", "game-design-career"];
const requiredRootHeadings = [
  "목차",
  "30초 안에 플러그인 선택하기",
  "설치하기",
  "5분 안에 첫 결과 만들기",
  "케이스별 프롬프트로 시작하기",
  "스킬별로 바로 실행하기",
  "요청 뒤에 생성되는 결과물",
  "플러그인 구조와 전체 시스템 아키텍처",
  "이미지·도식·문서 내보내기",
  "상세 가이드에서 더 알아보기",
  "안전·권리·사람 승인 경계",
  "문제를 해결하고 작업 재개하기",
  "기술 문서·기여·라이선스",
];
const representativeCards = {
  studio: [
    "studio:case:ST-C01", "studio:case:ST-C02", "studio:case:ST-C03", "studio:case:ST-C04",
    "studio:case:ST-C05", "studio:case:ST-C07", "studio:case:ST-C08",
  ],
  career: [
    "career:case:CA-C01", "career:case:CA-C04", "career:case:CA-C05", "career:case:CA-C06",
    "career:case:CA-C07", "career:case:CA-C08", "career:case:CA-T01",
  ],
  suite: [
    "suite:studio-to-career-handoff:case", "suite:career-proof-project-interview:case",
    "suite:gdd-image-presentation:case", "suite:resume-failed-derivatives:case",
  ],
};
const requiredCardLabels = [
  "사용 시점", "준비 입력", "복사할 요청문", "실행 흐름",
  "예상 결과", "읽는 순서", "사람 검토", "다음 요청",
];
const expectedPluginTreeCounts = {
  "game-design-studio": { agents: 9, skills: 15, templates: 15, scripts: 14 },
  "game-design-career": { agents: 9, skills: 15, templates: 15, scripts: 14 },
};
const resultExampleIds = [
  "game-design-brief", "system-specification", "ui-ux-flow-state", "reverse-design-document",
  "creative-design-portfolio", "export-preparation-manifest",
];
const readmeSkillsteadDiagrams = [
  {
    section: "케이스별 프롬프트로 시작하기",
    id: "prompt-to-result-flow",
    alt: "요청문에서 기획 결과와 다음 요청으로 이어지는 흐름",
  },
  {
    section: "스킬별로 바로 실행하기",
    id: "skill-agent-collaboration",
    alt: "전문 스킬과 위임된 에이전트가 협업하는 흐름",
  },
  {
    section: "요청 뒤에 생성되는 결과물",
    id: "artifact-review-flow",
    alt: "Canonical Artifact를 읽고 사람이 승인하는 순서",
  },
];
const skillsteadCheckSvg = path.join(
  root,
  "plugins/game-design-studio/skills/svg-infographic/scripts/check-svg.mjs",
);
const readableCaseLabels = new Map([
  ["studio:case:ST-C01", ["게임의 방향과 핵심 재미 정의", "게임의 방향을 정하지 못했을 때 대상 플레이어와 검증 기준을 기획 브리프로 정리합니다."]],
  ["studio:case:ST-C02", ["핵심 플레이 루프와 선택 설계", "플레이어가 반복할 행동과 의미 있는 선택을 시스템 명세로 만들 때 사용합니다."]],
  ["studio:case:ST-C03", ["규칙과 예외를 시스템 명세로 정리", "규칙이 충돌하거나 예외가 늘어날 때 상태와 데이터를 검토 가능한 표로 정리합니다."]],
  ["studio:case:ST-C04", ["화면 흐름과 접근성 점검", "온보딩과 UI 흐름이 헷갈릴 때 화면 상태와 접근성 기준을 함께 점검합니다."]],
  ["studio:case:ST-C05", ["퀘스트와 캐릭터 콘텐츠 설계", "퀘스트, NPC, 전투 요소가 얽힐 때 선택과 결과가 보이는 콘텐츠 명세를 만듭니다."]],
  ["studio:case:ST-C07", ["성장·경제·라이브 운영 설계", "성장 보상과 이벤트 운영이 필요한 프로젝트에서 재화 흐름과 측정 기준을 정리합니다."]],
  ["studio:case:ST-C08", ["제작 범위와 출시 위험 점검", "일정과 인력이 불확실할 때 제작 범위, 의존성, 중단 기준을 검토합니다."]],
  ["career:case:CA-C01", ["기획 직무와 전문 분야 탐색", "어떤 기획 직무를 목표로 할지 고민할 때 역할 후보와 학습 과제를 비교합니다."]],
  ["career:case:CA-C04", ["12주 역량 증거 계획 만들기", "목표 직무에 필요한 역량을 12주 동안 증명할 과제로 나눌 때 사용합니다."]],
  ["career:case:CA-C05", ["관찰을 근거로 역기획하기", "공개 플레이 경험을 분석해 관찰과 추론을 구분한 역기획 문서를 만들 때 사용합니다."]],
  ["career:case:CA-C06", ["창작 기획 포트폴리오 만들기", "개인 기여를 보여 줄 새 기획 프로젝트를 포트폴리오 사례로 만들 때 사용합니다."]],
  ["career:case:CA-C07", ["포트폴리오를 다섯 축으로 점검", "포트폴리오의 빈틈을 찾아 수정 순서와 발표 문장을 정리할 때 사용합니다."]],
  ["career:case:CA-C08", ["면접 답변과 성장 과제 정리", "면접 답변의 근거를 보강하고 다음 성장 과제를 정할 때 사용합니다."]],
  ["career:case:CA-T01", ["역할 선택부터 학습 계획까지 설계", "관심 분야를 고른 뒤 역량 격차와 학습 순서를 한 번에 정리할 때 사용합니다."]],
  ["suite:studio-to-career-handoff:case", ["제작 결과를 포트폴리오 증거로 연결", "Studio 기획 결과에서 공개 가능한 문제, 판단, 검증 근거를 포트폴리오로 옮길 때 사용합니다."]],
  ["suite:career-proof-project-interview:case", ["프로젝트 증거를 면접 답변으로 연결", "시스템 기획 과제를 12주 증거 계획과 면접 답변으로 연결할 때 사용합니다."]],
  ["suite:gdd-image-presentation:case", ["기획서와 이미지·발표 자료 함께 준비", "기획서, 승인된 이미지, 발표 자료를 같은 검토 경계 안에서 준비할 때 사용합니다."]],
  ["suite:resume-failed-derivatives:case", ["막힌 이미지·문서 출력 안전하게 재개", "이미지나 내보내기가 막혔을 때 보존 파일과 blocker를 확인해 필요한 작업만 재개합니다."]],
]);
const caseGroupIntroductions = new Map([
  ["Studio 기획 사례 7개", "게임의 규칙, 콘텐츠, 경험과 제작 범위를 설계하려는 기획자가 Studio 사례를 고릅니다. 각 사례는 검토 가능한 기획 Artifact와 사람 검토 지점을 남깁니다."],
  ["Career 학습·취업 사례 7개", "게임 기획을 배우거나 취업을 준비하는 사람은 Career 사례로 역할, 증거와 다음 과제를 정리합니다. 각 사례는 멘토와 함께 검토할 수 있는 학습 또는 포트폴리오 Artifact를 만듭니다."],
  ["Studio와 Career 연계 사례 4개", "제작 기획을 경력 증거, 발표 자료 또는 재개 계획으로 연결하려면 연계 사례를 고릅니다. 각 사례는 공개 범위와 이름 있는 사람의 승인 지점을 보존한 인계 Artifact를 만듭니다."],
]);
const readableResultLabels = new Map([
  ["game-design-brief", "게임 기획 브리프"],
  ["system-specification", "시스템 명세서"],
  ["ui-ux-flow-state", "UI·UX 흐름과 상태표"],
  ["reverse-design-document", "관찰 기반 역기획 문서"],
  ["creative-design-portfolio", "창작 기획 포트폴리오"],
  ["export-preparation-manifest", "문서 내보내기 준비 목록"],
]);
const readableSkillMetadata = new Map([
  ["game-design-studio", new Map([
    ["apply-document-quality-profile", ["문서 품질 기준 적용", "문서 목적과 형식에 맞는 품질 기준을 고정하고 선택 기록을 만듭니다."]],
    ["define-game-vision", ["게임 비전 정의", "대상 플레이어, 핵심 재미와 검증 기준을 정리해 비전 기둥을 만듭니다."]],
    ["design-game-content", ["게임 콘텐츠 설계", "퀘스트, 레벨, 조우와 캐릭터를 제작 가능한 콘텐츠 명세로 만듭니다."]],
    ["design-game-economy-and-liveops", ["경제와 라이브 운영 설계", "재화 흐름, 성장, 보상과 운영 결정을 경제 명세로 만듭니다."]],
    ["design-game-systems", ["게임 시스템 설계", "규칙, 상태, 우선순위, 예외와 데이터 관계를 시스템 명세로 만듭니다."]],
    ["design-player-experience", ["플레이어 경험 설계", "정보 구조, 상호작용, 온보딩과 접근성 흐름을 정리합니다."]],
    ["export-game-design-documents", ["기획 문서 내보내기 준비", "검증된 Artifact의 MD, PDF, DOCX, PPTX 준비 상태를 기록합니다."]],
    ["generate-image-assets", ["이미지 자산 생성", "승인된 목록의 선택 작업만 생성하고 제공자 상태를 기록합니다."]],
    ["orchestrate-game-design-project", ["게임 기획 프로젝트 조율", "여러 기획 분야의 범위, 순서와 검토 지점을 프로젝트 브리프로 묶습니다."]],
    ["plan-game-production", ["게임 제작 계획", "시제품 기준, 의존성, 담당자와 중단 기준을 제작 계획으로 만듭니다."]],
    ["plan-image-assets", ["이미지 자산 계획", "기준 문서에서 이미지 목록, 프롬프트 묶음과 자리표시자를 만듭니다."]],
    ["review-game-design", ["게임 기획 검토", "근거, 위험과 막힌 지점을 검토해 최소 수정이 담긴 검토 문서를 만듭니다."]],
    ["review-image-assets", ["이미지 자산 검토", "시각 품질, 접근성, 권리와 배치를 검토해 사람의 결정을 요청합니다."]],
    ["svg-infographic", ["기획 도식 만들기", "Skillstead 0.8.3에서 번들된 스킬로 편집 가능한 SVG와 검증용 PNG를 만듭니다."]],
    ["visualize-game-design", ["게임 기획 시각화", "루프, 상태, 흐름과 의존성을 접근 가능한 SVG와 PNG 도식으로 만듭니다."]],
  ])],
  ["game-design-career", new Map([
    ["apply-document-quality-profile", ["경력 문서 품질 기준 적용", "경력 문서 목적과 형식에 맞는 품질 기준과 선택 기록을 만듭니다."]],
    ["build-game-design-portfolio", ["기획 포트폴리오 만들기", "공개 가능한 판단, 개인 기여와 검증을 포트폴리오 사례로 만듭니다."]],
    ["export-career-documents", ["경력 문서 내보내기 준비", "Career Artifact의 MD, PDF, DOCX, PPTX 준비 상태를 기록합니다."]],
    ["generate-image-assets", ["경력 이미지 자산 생성", "승인된 이미지 목록의 선택 작업만 생성하고 제공자 상태를 기록합니다."]],
    ["map-game-design-career", ["게임 기획 경력 지도 만들기", "역할군, 목표 수준과 역량 격차를 비교해 경력 지도를 만듭니다."]],
    ["orchestrate-game-design-career", ["게임 기획 경력 조율", "경력 단계, 작업 순서와 검토를 하나의 경력 계획으로 묶습니다."]],
    ["plan-image-assets", ["경력 이미지 자산 계획", "Career Artifact에서 이미지 목록, 프롬프트 묶음과 자리표시자를 만듭니다."]],
    ["plan-junior-growth", ["주니어 성장 계획", "분기 목표, 증거 과제와 피드백 주기를 성장 계획으로 만듭니다."]],
    ["practice-game-design-interview", ["게임 기획 면접 연습", "공고와 포트폴리오 근거를 질문, 답변과 피드백 기록으로 연결합니다."]],
    ["research-game-design-jobs", ["게임 기획 채용 조사", "최신 공고와 회사 근거를 모아 요구사항과 지원자 격차를 기록합니다."]],
    ["reverse-engineer-game-design", ["게임 기획 역기획", "공개 관찰과 추론을 분리해 검토 가능한 역기획 문서를 만듭니다."]],
    ["review-game-design-portfolio", ["기획 포트폴리오 검토", "증거, 개인 기여, 권리와 수정 우선순위를 포트폴리오 검토 문서로 만듭니다."]],
    ["review-image-assets", ["경력 이미지 자산 검토", "시각 품질, 접근성, 권리와 배치를 검토해 사람의 결정을 요청합니다."]],
    ["svg-infographic", ["경력 도식 만들기", "Skillstead 0.8.3에서 번들된 스킬로 편집 가능한 SVG와 검증용 PNG를 만듭니다."]],
    ["visualize-career-roadmap", ["경력 성장 경로 시각화", "역할, 역량, 학습 의존성과 성장 경로를 SVG와 PNG 도식으로 만듭니다."]],
  ])],
]);
const readableAgentMetadata = new Map([
  ["game-design-studio", new Map([
    ["art-brief-director", ["이미지 기획 총괄", "이미지 목적과 프롬프트 초안을 읽고 빠진 요구사항을 찾습니다."]],
    ["content-narrative-designer", ["콘텐츠와 서사 설계자", "콘텐츠 선택이 시스템과 제작 범위에 맞는지 검토합니다."]],
    ["document-quality-editor", ["문서 품질 편집자", "문서 구조와 발표 흐름이 읽기 쉬운지 점검합니다."]],
    ["lead-game-designer", ["수석 게임 기획자", "비전과 결정이 서로 어긋나지 않는지 전체 기준으로 검토합니다."]],
    ["liveops-data-designer", ["라이브 운영 데이터 설계자", "운영 지표와 실험이 성장·경제 설계와 연결되는지 확인합니다."]],
    ["production-feasibility-critic", ["제작 가능성 비평가", "일정, 인력과 의존성을 기준으로 제작 가능한 범위를 점검합니다."]],
    ["system-economy-designer", ["시스템과 경제 설계자", "규칙, 재화와 악용 가능성을 함께 살펴 시스템 균형을 검토합니다."]],
    ["ux-accessibility-reviewer", ["UX와 접근성 검토자", "입력, 피드백과 접근성 문제가 화면 흐름에 없는지 점검합니다."]],
    ["visual-asset-reviewer", ["시각 자산 검토자", "이미지가 읽기 쉽고 권리와 배치 기준을 지키는지 검토합니다."]],
  ])],
  ["game-design-career", new Map([
    ["art-brief-director", ["경력 이미지 기획 총괄", "포트폴리오 이미지의 근거와 프롬프트 초안을 검토합니다."]],
    ["career-strategist", ["경력 전략가", "목표 직무와 현실적인 선택지를 비교해 경력 방향을 점검합니다."]],
    ["document-quality-editor", ["경력 문서 품질 편집자", "증거가 빠지지 않고 문서와 발표 흐름이 읽히는지 확인합니다."]],
    ["evidence-auditor", ["근거 감사자", "출처, 최신성, 권리와 근거 연결이 충분한지 살펴봅니다."]],
    ["game-design-mentor", ["게임 기획 멘토", "학습 목표와 연습 과제가 목표 직무에 맞는지 검토합니다."]],
    ["interview-coach", ["면접 코치", "답변의 주장과 근거가 연결되는지 확인하고 보완 질문을 남깁니다."]],
    ["portfolio-reviewer", ["포트폴리오 검토자", "개인 기여와 공개 가능한 증거가 선명한지 검토합니다."]],
    ["reverse-design-critic", ["역기획 비평가", "관찰과 추론을 구분하고 반례 검증이 가능한지 점검합니다."]],
    ["visual-asset-reviewer", ["경력 시각 자산 검토자", "공개할 이미지의 가독성, 대체 텍스트와 권리를 검토합니다."]],
  ])],
]);
const technicalAppendixMarker = "<details>\n<summary>패키지 기술 inventory</summary>\n";
const requiredUseCaseGuidePaths = [
  "use-cases/README.md",
  "use-cases/audience-paths.md",
  "use-cases/output-catalog.md",
  ...products.flatMap((product) => [
    `${product}/use-cases/README.md`,
    `${product}/use-cases/competency-paths.md`,
    `${product}/use-cases/concept-scenarios.md`,
    `${product}/use-cases/skill-workbench.md`,
    `${product}/faq.md`,
  ]),
];
const representativeCaseIds = [
  "ST-C02", "ST-C03", "CA-T01", "ST-C04", "ST-C05", "CA-C01",
  "ST-C07", "CA-C05", "CA-C06", "CA-C07", "CA-C08", "ST-C08",
];
const representativePromptTemplateIds = [
  "studio:define-game-vision:beginner",
  "studio:design-game-systems:standard",
  "studio:design-player-experience:standard",
  "studio:orchestrate-game-design-project:advanced",
  "career:map-game-design-career:beginner",
  "career:reverse-engineer-game-design:standard",
  "career:build-game-design-portfolio:advanced",
  "suite:career-proof-project-interview:case",
];
const representativePromptCards = [
  ["비전 가설을 시작하는 입문 카드", "studio:define-game-vision:beginner", "guides/prompt-templates/studio/define-game-vision.md#studiodefine-game-visionbeginner"],
  ["규칙·상태·예외를 정리하는 표준 카드", "studio:design-game-systems:standard", "guides/prompt-templates/studio/design-game-systems.md#studiodesign-game-systemsstandard"],
  ["UX·접근성 검토를 시작하는 표준 카드", "studio:design-player-experience:standard", "guides/prompt-templates/studio/design-player-experience.md#studiodesign-player-experiencestandard"],
  ["차단된 프로젝트를 재개하는 고급 카드", "studio:orchestrate-game-design-project:advanced", "guides/prompt-templates/studio/orchestrate-game-design-project.md#studioorchestrate-game-design-projectadvanced"],
  ["직무 가설을 세우는 입문 카드", "career:map-game-design-career:beginner", "guides/prompt-templates/career/map-game-design-career.md#careermap-game-design-careerbeginner"],
  ["관찰 기반 역기획 표준 카드", "career:reverse-engineer-game-design:standard", "guides/prompt-templates/career/reverse-engineer-game-design.md#careerreverse-engineer-game-designstandard"],
  ["개인 기여를 보존하는 포트폴리오 고급 카드", "career:build-game-design-portfolio:advanced", "guides/prompt-templates/career/build-game-design-portfolio.md#careerbuild-game-design-portfolioadvanced"],
  ["프로젝트 증거와 면접을 잇는 사례 카드", "suite:career-proof-project-interview:case", "guides/prompt-templates/suite/career-proof-project-interview.md#suitecareer-proof-project-interviewcase"],
];

function section(markdown, heading) {
  const marker = `## ${heading}\n`;
  const start = markdown.indexOf(marker);
  assert.notEqual(start, -1, `missing section: ${heading}`);
  const bodyStart = start + marker.length;
  const next = markdown.indexOf("\n## ", bodyStart);
  return markdown.slice(bodyStart, next === -1 ? markdown.length : next);
}

function subsection(markdown, heading) {
  const marker = `### ${heading}\n`;
  const start = markdown.indexOf(marker);
  assert.notEqual(start, -1, `missing subsection: ${heading}`);
  const bodyStart = start + marker.length;
  const next = markdown.indexOf("\n### ", bodyStart);
  return markdown.slice(bodyStart, next === -1 ? markdown.length : next);
}

function markdownTableRows(markdown) {
  return markdown.split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("|") && line.endsWith("|"))
    .map((line) => line.slice(1, -1).split("|").map((cell) => cell.trim()))
    .filter((cells) => !cells.every((cell) => /^:?-{3,}:?$/.test(cell)));
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function exactSection(markdown, heading, level = 2) {
  const marker = `${"#".repeat(level)} ${heading}\n`;
  const start = markdown.indexOf(marker);
  assert.notEqual(start, -1, `missing section: ${heading}`);
  const bodyStart = start + marker.length;
  const remainder = markdown.slice(bodyStart);
  const next = remainder.search(new RegExp(`\\n#{1,${level}} `, "u"));
  return remainder.slice(0, next === -1 ? remainder.length : next);
}

function textBlocks(markdown) {
  return [...markdown.matchAll(/```text\n([\s\S]*?)```/gu)].map((match) => match[1]);
}

function renderedPromptCards(markdown) {
  const cards = [];
  const expression = /<details\s+data-prompt-id="([^"]+)">\n([\s\S]*?)<\/details>/gu;
  for (const match of markdown.matchAll(expression)) cards.push({ id: match[1], body: match[2], raw: match[0] });
  return cards;
}

function cardLabelBody(card, label) {
  const escaped = escapeRegExp(label);
  const expression = new RegExp(`^#### ${escaped}\\n`, "gmu");
  const matches = [...card.body.matchAll(expression)];
  assert.equal(matches.length, 1, `${card.id}: visible label must occur exactly once: ${label}`);
  const value = card.body.slice(matches[0].index + matches[0][0].length);
  const nextLabel = /^#### /mu.exec(value);
  return value.slice(0, nextLabel?.index ?? value.length).trim();
}

function assertReadableCaseGroupIntroductions(markdown) {
  for (const [heading, expected] of caseGroupIntroductions) {
    const group = exactSection(markdown, heading, 3);
    const beforeFirstCard = group.slice(0, group.indexOf("<details data-prompt-id="));
    assert.equal(beforeFirstCard.trim(), expected, `${heading}: two-sentence beginner introduction is exact`);
    assert.equal((beforeFirstCard.match(/\./gu) ?? []).length, 2, `${heading}: introduction has two sentences`);
    assert.match(beforeFirstCard, /[가-힣]/u, `${heading}: introduction is visible Korean prose`);
  }
}

function assertReadableCardSummary(card) {
  const expected = readableCaseLabels.get(card.id);
  assert.ok(expected, `${card.id}: readable case metadata exists`);
  const [title, description] = expected;
  const summaryMatch = /^<summary>([^\n]+)<\/summary>\n\n([^\n]+)\n\n#### /u.exec(card.body);
  assert.ok(summaryMatch, `${card.id}: summary is followed immediately by one visible Korean sentence`);
  assert.equal(summaryMatch[1], `${title} (${card.id})`, `${card.id}: Korean task title precedes stable case ID`);
  assert.equal(summaryMatch[2], description, `${card.id}: visible one-sentence description is unique and task-specific`);
  assert.match(title, /[가-힣]/u, `${card.id}: summary begins with Korean task title`);
  assert.match(description, /[가-힣]/u, `${card.id}: visible summary description contains Korean`);
  assert.doesNotMatch(summaryMatch[1], /^(?:studio|career|suite):|^[A-Z]{2}-[A-Z]\d+/u, `${card.id}: summary is not ID-first`);
}

function assertNoGenericTypeError(error, label) {
  assert.ok(error instanceof Error, `${label}: validator must throw an Error`);
  assert.notEqual(error.name, "TypeError", `${label}: mutation must not pass through generic TypeError`);
}

async function assertRejectedForId(work, id, label) {
  try {
    await work();
  } catch (error) {
    assertNoGenericTypeError(error, label);
    assert.match(error.message, new RegExp(escapeRegExp(id), "u"), `${label}: error identifies affected card or row`);
    return;
  }
  assert.fail(`${label}: mutation unexpectedly satisfied the README contract`);
}

function assertExactOrderedValues(value, expected, label) {
  const actual = [...value.matchAll(/`([^`]+)`/gu)].map((match) => match[1]);
  assert.deepEqual(actual, expected, label);
}

function normalizePromptWhitespace(value) {
  return value.trim().replace(/\s+/gu, " ");
}

function promptSurfaceBody(promptBlock, label, nextLabel) {
  const marker = `${label}\n`;
  const start = promptBlock.indexOf(marker);
  assert.notEqual(start, -1, `copyable prompt includes ${label} surface`);
  assert.equal(promptBlock.indexOf(marker, start + marker.length), -1, `copyable prompt includes one ${label} surface`);
  const bodyStart = start + marker.length;
  const end = nextLabel ? promptBlock.indexOf(`\n${nextLabel}\n`, bodyStart) : promptBlock.length;
  assert.ok(end >= bodyStart, `copyable prompt keeps ${label} before ${nextLabel}`);
  return promptBlock.slice(bodyStart, end).trim();
}

function wrapPromptTemplate(value, width = 80) {
  const output = [];
  let line = "";
  for (const word of value.split(/\s+/u)) {
    if (!line) line = word;
    else if (Array.from(`${line} ${word}`).length <= width) line += ` ${word}`;
    else {
      output.push(line);
      line = word;
    }
  }
  if (line) output.push(line);
  return output;
}

function assertPromptCard(card, entry) {
  for (const label of requiredCardLabels) cardLabelBody(card, label);
  const flow = cardLabelBody(card, "실행 흐름");
  assert.equal(flow, entry.skill_chain.map((skill) => `\`${skill}\``).join(" → "), `${entry.id}: skill_chain is source-bound`);
  assertExactOrderedValues(cardLabelBody(card, "예상 결과"), entry.minimum_outputs, `${entry.id}: minimum_outputs are source-bound`);
  assertExactOrderedValues(cardLabelBody(card, "읽는 순서"), entry.read_order, `${entry.id}: read_order is source-bound`);
  assert.equal(cardLabelBody(card, "사람 검토"), entry.human_review_boundary, `${entry.id}: human_review_boundary is source-bound`);
  assert.equal(cardLabelBody(card, "다음 요청"), entry.resume_prompt, `${entry.id}: resume_prompt is source-bound`);

  const copyPrompt = cardLabelBody(card, "복사할 요청문");
  const promptBlocks = textBlocks(copyPrompt);
  assert.equal(promptBlocks.length, 1, `${entry.id}: copyable prompt has one text fence`);
  const appPrompt = promptSurfaceBody(promptBlocks[0], "App", "CLI");
  const cliPrompt = promptSurfaceBody(promptBlocks[0], "CLI");
  assert.equal(normalizePromptWhitespace(appPrompt), normalizePromptWhitespace(entry.app_prompt.template), `${entry.id}: App prompt template is source-bound`);
  assert.equal(normalizePromptWhitespace(cliPrompt), normalizePromptWhitespace(entry.cli_prompt.template), `${entry.id}: CLI prompt template, order, and namespaces are source-bound`);
  for (const line of textBlocks(card.body)) {
    for (const sourceLine of line.split("\n")) {
      if (!sourceLine.trim()) continue;
      assert.ok(Array.from(sourceLine).length <= 80, `${entry.id}: text prompt line exceeds 80 Unicode code points`);
    }
  }
}

async function assertRepresentativePromptCards(markdown) {
  const catalog = await loadPromptTemplateCatalog({ repoRoot: root });
  assert.equal(catalog.counts.total, 146, "production loader reads all nine validated prompt catalog shards");
  const expectedIds = Object.values(representativeCards).flat();
  const cards = renderedPromptCards(markdown);
  const seen = new Set();
  for (const card of cards) {
    assert.ok(!seen.has(card.id), `${card.id}: duplicate data-prompt-id in README`);
    seen.add(card.id);
    for (const label of requiredCardLabels) cardLabelBody(card, label);
    assertReadableCardSummary(card);
  }
  const actualIds = cards.map((card) => card.id);
  const expectedSet = new Set(expectedIds);
  assert.equal(actualIds.length, expectedIds.length, "README renders exactly 18 approved representative prompt cards");
  for (const id of actualIds) assert.ok(expectedSet.has(id), `${id}: invented prompt card is not approved for the README`);
  for (const id of expectedIds) assert.ok(actualIds.includes(id), `${id}: approved representative prompt card is missing`);
  assert.deepEqual(actualIds, expectedIds, "README representative cards preserve the approved source order");
  for (const card of cards) {
    const entry = catalog.byId.get(card.id);
    assert.ok(entry, `${card.id}: representative card exists in production prompt catalog`);
    assertPromptCard(card, entry);
  }
  assertReadableCaseGroupIntroductions(markdown);
}

function assertTableShape(markdown, heading, headers, label) {
  const rows = markdownTableRows(exactSection(markdown, heading, 3));
  assert.ok(rows.length >= 2, `${label}: table has header and rows`);
  assert.deepEqual(rows[0], headers, `${label}: table headers are exact`);
  return rows.slice(1);
}

async function assertResolvableRowLink(sourcePath, cell, expectedTarget, label) {
  const links = visibleMarkdownLinks(cell);
  assert.equal(links.length, 1, `${label}: exactly one detail link`);
  assert.equal(links[0].target, expectedTarget, `${label}: detail link target`);
  await validateVisibleLocalLink(sourcePath, links[0], root);
}

function sourceProductId(product) {
  return product === "game-design-studio" ? "studio" : "career";
}

async function sourceAgentIds(product) {
  return (await readdir(path.join(root, "products", product, "plugin", "agents")))
    .filter((name) => name.endsWith(".md"))
    .map((name) => name.slice(0, -3))
    .sort();
}

function readableMetadata(metadataByProduct, product, id, kind) {
  const productMetadata = metadataByProduct.get(product);
  assert.ok(productMetadata, `${product}: ${kind} display metadata exists`);
  const metadata = productMetadata.get(id);
  assert.ok(metadata, `${product}:${id}: ${kind} display metadata exists`);
  return metadata;
}

async function assertSkillInventoryTable(markdown, product) {
  const sourceProduct = sourceProductId(product);
  const heading = `${sourceProduct === "studio" ? "Studio" : "Career"} 설치 스킬 15개`;
  const rows = assertTableShape(markdown, heading, ["스킬 이름과 ID", "직접 호출", "쉬운 역할 설명", "상세 가이드"], `${product} skills`);
  const inventory = await collectProductInventory(root, product);
  const sourceSkills = (await readdir(path.join(root, "products", product, "plugin", "skills"), { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  assert.equal(sourceSkills.length, 14, `${product}: source product owns exactly 14 skills`);
  assert.ok(!sourceSkills.includes("svg-infographic"), `${product}: svg-infographic is not a product source skill`);
  assert.deepEqual(inventory.skillIds.length, 15, `${product}: production inventory includes 14 source skills plus vendored skill`);
  assert.deepEqual(sourceSkills, inventory.skillIds.filter((id) => id !== "svg-infographic"), `${product}: production inventory derives its 14 product skills from source`);
  const generatedSkills = (await readdir(path.join(root, "plugins", product, "skills"), { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  assert.deepEqual(generatedSkills, inventory.skillIds, `${product}: generated skill snapshot matches production inventory`);
  const expected = inventory.skillIds;
  const actual = [];
  const names = new Set();
  const descriptions = new Set();
  for (const row of rows) {
    assert.equal(row.length, 4, `${product}: skill row has four cells`);
    const [nameCell, command, role, guide] = row;
    const idHint = /`([a-z0-9-]+)`/u.exec(nameCell)?.[1] ?? "unknown-skill";
    const match = /^([^()]+) \(`([a-z0-9-]+)`\)$/u.exec(nameCell);
    assert.ok(match, `${product}:${idHint}: skill name precedes literal installed skill ID`);
    const [, koreanName, id] = match;
    const [expectedName, expectedDescription] = readableMetadata(readableSkillMetadata, product, id, "skill");
    actual.push(id);
    assert.equal(koreanName, expectedName, `${product}:${id}: skill uses its canonical Korean display name`);
    assert.match(koreanName, /[가-힣]/u, `${product}:${id}: Korean skill name is visible first`);
    assert.doesNotMatch(koreanName, /^(?:스킬|기능)\s*\d+$/u, `${product}:${id}: generic numbered skill name is rejected`);
    assert.ok(!names.has(koreanName), `${product}:${id}: Korean skill name is unique within the product`);
    names.add(koreanName);
    assert.equal(command, `\`$game-design-${sourceProduct}:${id}\``, `${product}:${id}: exact direct command`);
    assert.equal(role, expectedDescription, `${product}:${id}: skill uses its source-backed Korean role description`);
    assert.match(role, /[가-힣]/u, `${product}:${id}: plain-Korean role explanation is non-empty`);
    assert.doesNotMatch(role, new RegExp(`${escapeRegExp(id)}\\s*(?:작업|스킬)`, "u"), `${product}:${id}: slug-derived role description is rejected`);
    assert.ok(!descriptions.has(role), `${product}:${id}: role explanation is not a generic repeated sentence`);
    descriptions.add(role);
    await assertResolvableRowLink(path.join(root, "README.md"), guide, `guides/${product}/skills/${id}.md`, `${product}:${id}`);
  }
  for (const id of expected) assert.ok(actual.includes(id), `${product}:${id}: installed skill is missing from README inventory`);
  assert.equal(new Set(actual).size, actual.length, `${product}: duplicate skill ID in README inventory`);
  for (const id of actual) assert.ok(expected.includes(id), `${product}:${id}: invented or cross-product skill ID in README inventory`);
  assert.deepEqual(actual, expected, `${product}: README skill inventory preserves installed snapshot order`);
  const vendorRow = rows.find(([nameCell]) => nameCell.endsWith("(`svg-infographic`)"));
  assert.ok(vendorRow, `${product}: vendored svg-infographic row exists`);
  assert.match(vendorRow[2], /vendored|번들/iu, `${product}: svg-infographic is identified as a vendored installed skill`);
  assert.doesNotMatch(vendorRow[2], /제품 source|제품 원본/u, `${product}: svg-infographic must not be presented as a product source skill`);
  assert.doesNotMatch(markdown, /(?:14개[^\n.]{0,100}(?:제품|source)[^\n.]{0,100}svg-infographic|svg-infographic[^\n.]{0,100}14개[^\n.]{0,100}(?:제품|source))/iu, `${product}: README must not claim vendored svg-infographic is one of 14 product source skills`);
}

async function assertAgentInventoryTable(markdown, product) {
  const sourceProduct = sourceProductId(product);
  const heading = `${sourceProduct === "studio" ? "Studio" : "Career"} 에이전트 9개`;
  const rows = assertTableShape(markdown, heading, ["에이전트 역할과 ID", "쉬운 역할 설명", "검토 초점", "호출 경계", "역할 문서"], `${product} agents`);
  const expected = await sourceAgentIds(product);
  assert.equal(expected.length, 9, `${product}: source product owns exactly nine agents`);
  const generated = (await readdir(path.join(root, "plugins", product, "agents")))
    .filter((name) => name.endsWith(".md"))
    .map((name) => name.slice(0, -3))
    .sort();
  assert.deepEqual(generated, expected, `${product}: generated agent snapshot matches source inventory`);
  const actual = [];
  const names = new Set();
  const descriptions = new Set();
  for (const row of rows) {
    assert.equal(row.length, 5, `${product}: agent row has five cells`);
    const [nameCell, role, focus, boundary, document] = row;
    const idHint = /`([a-z0-9-]+)`/u.exec(nameCell)?.[1] ?? "unknown-agent";
    const match = /^([^()]+) \(`([a-z0-9-]+)`\)$/u.exec(nameCell);
    assert.ok(match, `${product}:${idHint}: Korean agent role precedes literal agent ID`);
    const [, koreanName, id] = match;
    const [expectedName, expectedDescription] = readableMetadata(readableAgentMetadata, product, id, "agent");
    actual.push(id);
    assert.equal(koreanName, expectedName, `${product}:${id}: agent uses its canonical Korean display name`);
    assert.match(koreanName, /[가-힣]/u, `${product}:${id}: Korean agent role is visible first`);
    assert.doesNotMatch(koreanName, /^(?:역할|에이전트)\s*\d+$/u, `${product}:${id}: generic numbered agent role is rejected`);
    assert.ok(!names.has(koreanName), `${product}:${id}: Korean agent role is unique within the product`);
    names.add(koreanName);
    assert.equal(role, expectedDescription, `${product}:${id}: agent uses its source-backed Korean role description`);
    assert.match(role, /[가-힣]/u, `${product}:${id}: plain-Korean role explanation is non-empty`);
    assert.doesNotMatch(role, new RegExp(`${escapeRegExp(id)}\\s*(?:관점|역할|에이전트)`, "u"), `${product}:${id}: slug-derived agent description is rejected`);
    assert.ok(!descriptions.has(role), `${product}:${id}: agent explanation is not a generic repeated sentence`);
    descriptions.add(role);
    assert.ok(focus.length > 0, `${product}:${id}: review focus is non-empty`);
    assert.match(boundary, /오케스트레이터|전문가|specialist|delegat/iu, `${product}:${id}: orchestration or specialist delegation boundary is explicit`);
    await assertResolvableRowLink(path.join(root, "README.md"), document, `plugins/${product}/agents/${id}.md`, `${product}:${id}`);
  }
  for (const id of expected) assert.ok(actual.includes(id), `${product}:${id}: agent is missing from README inventory`);
  assert.equal(new Set(actual).size, actual.length, `${product}: duplicate agent ID in README inventory`);
  for (const id of actual) assert.ok(expected.includes(id), `${product}:${id}: invented or cross-product agent ID in README inventory`);
  assert.deepEqual(actual, expected, `${product}: README agent inventory preserves installed snapshot order`);
}

async function assertPluginTreeContract(markdown, product) {
  const expected = expectedPluginTreeCounts[product];
  const snapshotRoot = path.join(root, "plugins", product);
  const tree = textBlocks(markdown).find((block) => block.startsWith(`plugins/${product}/`));
  assert.ok(tree, `${product}: README has a separate generated plugin tree text block`);
  for (const required of [
    ".codex-plugin/plugin.json", "agents/", "skills/", "assets/templates/", "assets/shared/", "references/",
    "scripts/", "hooks/hooks.json", ".env.example", "README.md", "BUILD-MANIFEST.json",
  ]) assert.ok(tree.includes(required), `${product}: README tree includes ${required}`);
  for (const [directory, count] of Object.entries(expected)) {
    const relative = directory === "templates" ? "assets/templates" : directory;
    const filesystemEntries = await readdir(path.join(snapshotRoot, relative));
    const actual = directory === "scripts"
      ? filesystemEntries.filter((name) => name.endsWith(".mjs")).length
      : filesystemEntries.length;
    assert.equal(actual, count, `${product}: generated ${directory} count`);
  }
  const inventory = await collectProductInventory(root, product);
  assert.equal(inventory.skillIds.length, expected.skills, `${product}: production skill inventory matches generated tree`);
  assert.equal(inventory.templateIds.length, expected.templates, `${product}: production template inventory matches generated tree`);
  const generatedTemplates = (await readdir(path.join(snapshotRoot, "assets", "templates"), { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  assert.deepEqual(generatedTemplates, inventory.templateIds, `${product}: generated template snapshot matches production inventory`);
  assert.equal((await sourceAgentIds(product)).length, expected.agents, `${product}: source agent inventory matches generated tree`);
  assert.match(tree, new RegExp(`products/${escapeRegExp(product)}/plugin/`, "u"), `${product}: tree identifies authoring source`);
  assert.match(tree, new RegExp(`plugins/${escapeRegExp(product)}/`, "u"), `${product}: tree identifies generated snapshot`);
  assert.doesNotMatch(markdown, /BUILD-MANIFEST\.json[^\n]*(?:직접\s*(?:편집|수정)|edit directly)|(?:직접\s*(?:편집|수정)|edit directly)[^\n]*BUILD-MANIFEST\.json/iu, `${product}: README must not instruct readers to edit BUILD-MANIFEST directly`);
  assert.doesNotMatch(tree, /BUILD-MANIFEST\.json[^\n]*(?:직접\s*(?:편집|수정)|edit directly)|(?:직접\s*(?:편집|수정)|edit directly)[^\n]*BUILD-MANIFEST\.json/iu, `${product}: BUILD-MANIFEST is not edited directly`);
}

async function assertResultExamples(markdown) {
  const artifactTree = textBlocks(markdown).find((block) => block.includes("content.md") && block.includes("export-manifest.yml"));
  assert.ok(artifactTree, "README shows a Canonical Artifact tree");
  for (const required of ["content.md", "evidence.yml", "decisions/", "assets/", "export-manifest.yml"]) {
    assert.ok(artifactTree.includes(required), `Canonical Artifact tree contains ${required}`);
  }
  const rows = assertTableShape(markdown, "결과 예시 6종", ["결과 이름과 ID", "핵심 파일", "선택 자산", "읽는 순서", "승인 전 보류 경계"], "result examples");
  const inventories = await Promise.all(products.map((product) => collectProductInventory(root, product)));
  const templateIds = new Set(inventories.flatMap((inventory) => inventory.templateIds));
  const manifest = JSON.parse(await readFile(path.join(root, "guides", "use-cases", "use-case-manifest.json"), "utf8"));
  const manifestOutputs = new Set(manifest.cases.flatMap((entry) => entry.outputs));
  const actual = [];
  for (const row of rows) {
    assert.equal(row.length, 5, "result example row has five cells");
    const [nameCell, coreFile, optionalAsset, readOrder, holdBoundary] = row;
    const idHint = /`([a-z0-9-]+)`/u.exec(nameCell)?.[1] ?? "unknown-result";
    const match = /^([^()]+) \(`([a-z0-9-]+)`\)$/u.exec(nameCell);
    assert.ok(match, `${idHint}: result example shows Korean result name before literal ID`);
    const [, koreanName, id] = match;
    actual.push(id);
    assert.equal(koreanName, readableResultLabels.get(id), `${id}: Korean result name is exact and readable`);
    assert.match(coreFile, /content\.md/u, `${id}: core file is explicit`);
    assert.ok(optionalAsset.length > 0, `${id}: optional asset is explicit`);
    assertExactOrderedValues(
      readOrder,
      ["content.md", "evidence.yml", "decisions/", "assets/", "export-manifest.yml"],
      `${id}: reading order is complete and exact`,
    );
    assert.match(holdBoundary, /승인|보류|hold/iu, `${id}: pre-approval hold boundary is explicit`);
    assert.match(holdBoundary, /자동 승인되지 않/iu, `${id}: images, derivatives, and review findings are not auto-approved before human approval`);
    if (id === "export-preparation-manifest") {
      assert.ok(manifestOutputs.has(id), `${id}: result category is backed by the use-case manifest`);
    } else {
      assert.ok(templateIds.has(id), `${id}: result category is an installed Studio or Career template`);
    }
  }
  assert.deepEqual(actual, resultExampleIds, "README result examples are exact and ordered");
}

function assertSafetyBoundary(markdown) {
  const safety = exactSection(markdown, "안전·권리·사람 승인 경계");
  assert.match(safety, /이미지·파생 문서·검토 결과는 자동 승인되지 않습니다\./u, "safety-boundary: images, derived documents, and review findings require human approval");
  assert.doesNotMatch(safety, /(?:이미지|파생 문서|검토 결과)[^.\n]{0,100}자동 승인(?:됩니다|한다)/u, "safety-boundary: README must reject automatic approval claims");
}

function assertUpdateAndReinstallInstructions(markdown) {
  const instructions = exactSection(markdown, "업데이트·재설치하기", 3);
  for (const phrase of ["Codex App", "Plugins", "Uninstall plugin", "다시 시작", "다시 설치", "설치 확인", "새 채팅"]) {
    assert.ok(instructions.includes(phrase), `App update instructions include ${phrase}`);
  }
  for (const phrase of ["Codex CLI", "npm run build", "npm run validate", "codex plugin list", "새 세션"]) {
    assert.ok(instructions.includes(phrase), `CLI update instructions include ${phrase}`);
  }
  for (const product of products) {
    assert.ok(instructions.includes(`codex plugin remove ${product}@game-design-suite`), `${product}: CLI removal command`);
    assert.ok(instructions.includes(`codex plugin add ${product}@game-design-suite`), `${product}: CLI reinstall command`);
  }
}

const portfolioQuickStartHeading = "완성한 게임 기획을 취업용 포트폴리오 사례로 정리하기";
const portfolioQuickStartLabels = [
  "이럴 때 사용",
  "준비물",
  "실행 순서",
  "얻게 되는 결과",
  "공개 전 확인",
];
const portfolioQuickStartOutputs = [
  ["포트폴리오 사례 본문", "creative-design-portfolio/content.md"],
  ["개인 기여와 선택 근거", "creative-design-portfolio/evidence.yml"],
  ["주요 의사결정 기록", "creative-design-portfolio/decisions/"],
  ["공개 전 확인 목록", "creative-design-portfolio/export-manifest.yml"],
];

function mutatePortfolioPromptSurface(markdown, label, transform) {
  const portfolio = subsection(markdown, portfolioQuickStartHeading);
  const [prompt] = textBlocks(portfolio);
  assert.ok(prompt, `portfolio quick start has one copyable prompt before ${label} mutation`);
  const nextLabel = label === "App" ? "CLI" : undefined;
  const surface = promptSurfaceBody(prompt, label, nextLabel);
  const changedSurface = transform(surface);
  assert.notEqual(changedSurface, surface, `${label}: prompt surface mutation changes the prompt`);
  const changedPrompt = prompt.replace(surface, changedSurface);
  assert.notEqual(changedPrompt, prompt, `${label}: prompt mutation changes the fenced prompt`);
  const changedPortfolio = portfolio.replace(prompt, changedPrompt);
  assert.notEqual(changedPortfolio, portfolio, `${label}: prompt mutation changes the portfolio quick start`);
  return markdown.replace(portfolio, changedPortfolio);
}

function assertPortfolioQuickStartRejected(markdown, label) {
  try {
    assertPortfolioQuickStart(markdown);
  } catch (error) {
    assertNoGenericTypeError(error, label);
    return;
  }
  assert.fail(`${label}: portfolio quick start mutation unexpectedly satisfied the contract`);
}

function assertPortfolioQuickStart(markdown) {
  const quickStart = exactSection(markdown, "5분 안에 첫 결과 만들기");
  const headings = [...quickStart.matchAll(/^### ([^\n]+)$/gmu)].map((match) => match[1]);
  assert.equal(headings.length, 3, "quick start keeps exactly three actionable routes");
  assert.equal(headings[2], portfolioQuickStartHeading, "third quick-start route names the portfolio task");
  assert.doesNotMatch(markdown, /(?:공개\s*)?증거 후보/u, "user-facing README avoids the abstract evidence-candidate term");

  const portfolio = subsection(markdown, portfolioQuickStartHeading);
  for (const label of portfolioQuickStartLabels) {
    assert.match(portfolio, new RegExp(`\\*\\*${escapeRegExp(label)}:\\*\\*`, "u"), `portfolio quick start shows ${label}`);
  }
  const review = "$game-design-studio:review-game-design";
  const portfolioSkill = "$game-design-career:build-game-design-portfolio";
  assert.match(portfolio, /review-game-design/u, "portfolio quick start names the Studio review skill");
  assert.match(portfolio, /build-game-design-portfolio/u, "portfolio quick start names the Career portfolio skill");
  const prompts = textBlocks(portfolio);
  assert.equal(prompts.length, 1, "portfolio quick start has one copyable prompt");
  const appPrompt = promptSurfaceBody(prompts[0], "App", "CLI");
  const cliPrompt = promptSurfaceBody(prompts[0], "CLI");
  for (const [surface, reviewSkill, buildSkill] of [
    [appPrompt, "review-game-design", "build-game-design-portfolio"],
    [cliPrompt, review, portfolioSkill],
  ]) {
    const reviewIndex = surface.indexOf(reviewSkill);
    const portfolioSkillIndex = surface.indexOf(buildSkill);
    assert.notEqual(reviewIndex, -1, "portfolio prompt surface has the Studio review step");
    assert.notEqual(portfolioSkillIndex, -1, "portfolio prompt surface has the Career portfolio step");
    assert.ok(reviewIndex < portfolioSkillIndex, "Studio review precedes portfolio construction on every prompt surface");
  }
  for (const [label, technicalPath] of portfolioQuickStartOutputs) {
    assert.ok(
      portfolio.includes(`**${label}** (\`${technicalPath}\`)`),
      `portfolio quick start shows ${label} with its technical path`,
    );
  }
  assert.match(portfolio, /실제 기여(?:\s*범위)?/u, "author verifies actual contribution");
  assert.match(portfolio, /공개 권한/u, "author verifies publication rights");
  assert.match(portfolio, /자동 승인하지 않/u, "publication is never auto-approved");
  assert.match(portfolio, /별도 면접 연습/u, "portfolio decisions can inform a separate interview practice step");
  assert.doesNotMatch(portfolio, /면접 답변 소재|interview-question-answer-log/u, "portfolio output does not misrepresent durable decisions as interview records");
  for (const block of prompts) {
    for (const line of block.split("\n")) {
      if (line.trim()) assert.ok(Array.from(line).length <= 80, "portfolio prompt line stays within 80 Unicode code points");
    }
  }
}

async function assertStructuredRootReadme(markdown, { validateLinks = true } = {}) {
  assert.deepEqual(h2Headings(markdown), requiredRootHeadings, "root README H2 order is exact");
  const toc = exactSection(markdown, "목차");
  const tocLinks = visibleMarkdownLinks(toc);
  const expectedToc = requiredRootHeadings.slice(1).map((label) => {
    const heading = visibleMarkdownHeadings(markdown).find((candidate) => candidate.level === 2 && candidate.label === label);
    assert.ok(heading, `TOC target heading exists: ${label}`);
    return { label, target: `#${heading.anchor}` };
  });
  assert.deepEqual(tocLinks.map(({ label, target }) => ({ label, target })), expectedToc, "목차 has only ordered links to every following root section");
  await assertRepresentativePromptCards(markdown);
  for (const product of products) {
    await assertPluginTreeContract(markdown, product);
    await assertSkillInventoryTable(markdown, product);
    await assertAgentInventoryTable(markdown, product);
  }
  await assertResultExamples(markdown);
  assertSafetyBoundary(markdown);
  assertUpdateAndReinstallInstructions(markdown);
  if (validateLinks) await assertRootLinks(markdown);
}

async function buildValidStructuredReadmeFixture() {
  const catalog = await loadPromptTemplateCatalog({ repoRoot: root });
  const cards = Object.values(representativeCards).flat().map((id) => {
    const entry = catalog.byId.get(id);
    assert.ok(entry, `${id}: fixture requires production catalog entry`);
    const [title, description] = readableCaseLabels.get(id);
    return [
      `<details data-prompt-id="${id}">`,
      `<summary>${title} (${id})</summary>`,
      "",
      description,
      "",
      "#### 사용 시점",
      entry.when_to_use,
      "#### 준비 입력",
      entry.required_inputs.join(", "),
      "#### 복사할 요청문",
      "```text",
      "App",
      ...wrapPromptTemplate(entry.app_prompt.template),
      "",
      "CLI",
      ...wrapPromptTemplate(entry.cli_prompt.template),
      "```",
      "#### 실행 흐름",
      entry.skill_chain.map((skill) => `\`${skill}\``).join(" → "),
      "#### 예상 결과",
      entry.minimum_outputs.map((output) => `\`${output}\``).join(" "),
      "#### 읽는 순서",
      entry.read_order.map((step) => `\`${step}\``).join(" → "),
      "#### 사람 검토",
      entry.human_review_boundary,
      "#### 다음 요청",
      entry.resume_prompt,
      "</details>",
    ].join("\n");
  });
  const caseGroups = [
    "### Studio 기획 사례 7개",
    caseGroupIntroductions.get("Studio 기획 사례 7개"),
    "",
    ...cards.slice(0, representativeCards.studio.length),
    "",
    "### Career 학습·취업 사례 7개",
    caseGroupIntroductions.get("Career 학습·취업 사례 7개"),
    "",
    ...cards.slice(representativeCards.studio.length, representativeCards.studio.length + representativeCards.career.length),
    "",
    "### Studio와 Career 연계 사례 4개",
    caseGroupIntroductions.get("Studio와 Career 연계 사례 4개"),
    "",
    ...cards.slice(representativeCards.studio.length + representativeCards.career.length),
  ];
  const inventoryTables = [];
  for (const product of products) {
    const productLabel = product === "game-design-studio" ? "Studio" : "Career";
    const namespace = product === "game-design-studio" ? "studio" : "career";
    const inventory = await collectProductInventory(root, product);
    const skillRows = inventory.skillIds.map((id) => {
      const [name, description] = readableMetadata(readableSkillMetadata, product, id, "skill");
      return `| ${name} (\`${id}\`) | \`$game-design-${namespace}:${id}\` | ${description} | [상세 가이드](guides/${product}/skills/${id}.md) |`;
    });
    const agentRows = (await sourceAgentIds(product)).map((id) => {
      const [name, description] = readableMetadata(readableAgentMetadata, product, id, "agent");
      return `| ${name} (\`${id}\`) | ${description} | 검토 초점 | 오케스트레이터가 전문가에게 위임 | [역할 문서](plugins/${product}/agents/${id}.md) |`;
    });
    inventoryTables.push(
      `### ${productLabel} 설치 스킬 15개`,
      "| 스킬 이름과 ID | 직접 호출 | 쉬운 역할 설명 | 상세 가이드 |",
      "| --- | --- | --- | --- |",
      ...skillRows,
      "",
      `### ${productLabel} 에이전트 9개`,
      "| 에이전트 역할과 ID | 쉬운 역할 설명 | 검토 초점 | 호출 경계 | 역할 문서 |",
      "| --- | --- | --- | --- | --- |",
      ...agentRows,
      "",
    );
  }
  const trees = products.flatMap((product) => [
    "```text",
    `plugins/${product}/`,
    "├── .codex-plugin/plugin.json",
    "├── agents/",
    "├── skills/",
    "├── assets/templates/",
    "├── assets/shared/",
    "├── references/",
    "├── scripts/",
    "├── hooks/hooks.json",
    "├── .env.example",
    "├── README.md",
    "└── BUILD-MANIFEST.json",
    `authoring source: products/${product}/plugin/`,
    `generated snapshot: plugins/${product}/`,
    "```",
    "",
  ]);
  const expectedToc = requiredRootHeadings.slice(1).map((heading, index) => `${index + 1}. [${heading}](#${visibleMarkdownHeadings(`## ${heading}`)[0].anchor})`);
  return [
    "# Structured README fixture",
    "",
    "## 목차",
    ...expectedToc,
    "",
    "## 30초 안에 플러그인 선택하기",
    "선택 안내",
    "",
    "## 설치하기",
    "설치 안내",
    "",
    "### 업데이트·재설치하기",
    "Codex App Plugins에서 Uninstall plugin을 선택하고 앱을 다시 시작한 뒤 다시 설치합니다. 설치 확인 후 새 채팅을 엽니다.",
    "Codex CLI에서 npm run build와 npm run validate를 실행합니다.",
    "codex plugin remove game-design-studio@game-design-suite",
    "codex plugin add game-design-studio@game-design-suite",
    "codex plugin remove game-design-career@game-design-suite",
    "codex plugin add game-design-career@game-design-suite",
    "codex plugin list로 확인하고 새 세션을 엽니다.",
    "",
    "## 5분 안에 첫 결과 만들기",
    "첫 결과 안내",
    "",
    "## 케이스별 프롬프트로 시작하기",
    ...caseGroups,
    "",
    "## 스킬별로 바로 실행하기",
    ...inventoryTables,
    "## 요청 뒤에 생성되는 결과물",
    "```text",
    "artifact/",
    "├── content.md",
    "├── evidence.yml",
    "├── decisions/",
    "├── assets/",
    "└── export-manifest.yml",
    "```",
    "",
    "### 결과 예시 6종",
    "| 결과 이름과 ID | 핵심 파일 | 선택 자산 | 읽는 순서 | 승인 전 보류 경계 |",
    "| --- | --- | --- | --- | --- |",
    ...resultExampleIds.map((id) => `| ${readableResultLabels.get(id)} (\`${id}\`) | \`content.md\` | 선택 자산 | \`content.md\` → \`evidence.yml\` → \`decisions/\` → \`assets/\` → \`export-manifest.yml\` | 사람 승인 전 보류하며 자동 승인되지 않습니다. |`),
    "",
    "## 플러그인 구조와 전체 시스템 아키텍처",
    ...trees,
    "## 이미지·도식·문서 내보내기",
    "이미지와 문서 출력은 사람이 검토합니다.",
    "",
    "## 상세 가이드에서 더 알아보기",
    "상세 가이드",
    "",
    "## 안전·권리·사람 승인 경계",
    "이미지·파생 문서·검토 결과는 자동 승인되지 않습니다.",
    "",
    "## 문제를 해결하고 작업 재개하기",
    "재개 안내",
    "",
    "## 기술 문서·기여·라이선스",
    "기술 문서",
    "",
  ].join("\n");
}

function assertNavigationTable(markdown, headers, routes, label) {
  const rows = markdownTableRows(markdown);
  assert.deepEqual(rows[0], headers, `${label} table headers`);
  for (const [goal, targets] of routes) {
    const row = rows.find(([firstCell]) => firstCell.includes(goal));
    assert.ok(row, `${label} table row: ${goal}`);
    for (const target of targets) {
      assert.ok(row.some((cell) => cell.includes(`](${target})`)), `${label} table row ${goal}: ${target}`);
    }
  }
}

function h2Headings(markdown) {
  return visibleMarkdownHeadings(markdown)
    .filter(({ level }) => level === 2)
    .map(({ label }) => label);
}

function assertContainedPath(filename, target, boundary = root) {
  assert.ok(!path.isAbsolute(target) && !path.win32.isAbsolute(target), `absolute local target: ${target}`);
  const resolved = path.resolve(path.dirname(filename), target);
  const relative = path.relative(boundary, resolved);
  assert.ok(relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative)), `local target escapes boundary: ${target}`);
  return resolved;
}

async function assertRegularNonSymlinkFile(filename, boundary = root) {
  const parts = path.relative(boundary, filename).split(path.sep).filter(Boolean);
  let current = boundary;
  for (const part of parts) {
    current = path.join(current, part);
    const stat = await lstat(current);
    assert.ok(!stat.isSymbolicLink(), `symlinked local target: ${filename}`);
  }
  const stat = await lstat(filename);
  assert.ok(stat.isFile(), `local target is not a regular file: ${filename}`);
}

function decodeLinkPart(value, target) {
  try {
    return decodeURIComponent(value);
  } catch {
    assert.fail(`invalid encoded local target: ${target}`);
  }
}

async function validateVisibleLocalLink(sourcePath, link, boundary) {
  const { target } = link;
  if (/^(?:https?|mailto):/iu.test(target)) return undefined;
  assert.ok(!/^[a-z][a-z\d+.-]*:/iu.test(target), `unsupported local link scheme: ${target}`);
  const hash = target.indexOf("#");
  const rawFile = hash === -1 ? target : target.slice(0, hash);
  const rawAnchor = hash === -1 ? "" : target.slice(hash + 1);
  const filename = decodeLinkPart(rawFile, target).split("?", 1)[0];
  const anchor = decodeLinkPart(rawAnchor, target);
  const targetPath = filename ? assertContainedPath(sourcePath, filename, boundary) : sourcePath;
  const extension = path.extname(targetPath).toLowerCase();
  assert.ok([".md", ".png", ".svg", ".json", ".html"].includes(extension), `unsupported local link extension: ${target}`);
  await assertRegularNonSymlinkFile(targetPath, boundary);
  if (anchor) {
    assert.equal(extension, ".md", `anchors require Markdown targets: ${target}`);
    const targetMarkdown = await readFile(targetPath, "utf8");
    assert.ok(visibleMarkdownHeadings(targetMarkdown).some((heading) => heading.anchor === anchor), `missing visible Markdown anchor: ${target}`);
  }
  return targetPath;
}

async function assertRootLinks(markdown) {
  const readmePath = path.join(root, "README.md");
  for (const link of visibleMarkdownLinks(markdown)) await validateVisibleLocalLink(readmePath, link, root);
}

async function assertReadmeSkillsteadDiagrams(markdown) {
  const readmePath = path.join(root, "README.md");
  for (const { section: sectionHeading, id, alt } of readmeSkillsteadDiagrams) {
    const body = exactSection(markdown, sectionHeading);
    const png = `guides/assets/readme/${id}.png`;
    const svg = `guides/assets/readme/${id}.svg`;
    const embed = `[![${alt}](${png})](${svg})`;
    assert.ok(body.includes(embed), `${id}: ${sectionHeading} must embed the exact PNG-to-SVG pair`);

    const pngPath = assertContainedPath(readmePath, png, root);
    const svgPath = assertContainedPath(readmePath, svg, root);
    await assertRegularNonSymlinkFile(pngPath, root);
    await assertRegularNonSymlinkFile(svgPath, root);

    const svgSource = await readFile(svgPath, "utf8");
    assert.match(svgSource, /<svg\b[^>]*\bviewBox="0 0 1400 900"/u, `${id}: SVG viewBox is 1400×900`);
    assert.match(svgSource, /<svg\b[^>]*\bwidth="1400"/u, `${id}: SVG width is 1400`);
    assert.match(svgSource, /<svg\b[^>]*\bheight="900"/u, `${id}: SVG height is 900`);
    const title = /<title>([\s\S]*?)<\/title>/u.exec(svgSource)?.[1] ?? "";
    const description = /<desc>([\s\S]*?)<\/desc>/u.exec(svgSource)?.[1] ?? "";
    assert.match(title, /[가-힣]/u, `${id}: SVG title is Korean`);
    assert.match(description, /[가-힣]/u, `${id}: SVG description is Korean`);
    assert.doesNotMatch(svgSource, /preserveAspectRatio\s*=\s*["']none["']/iu, `${id}: SVG forbids distorted aspect ratio`);
    assert.doesNotMatch(svgSource, /\b(?:scaleX|scaleY)\s*\(/u, `${id}: SVG forbids non-uniform scale transforms`);
    const lint = spawnSync(process.execPath, [skillsteadCheckSvg, svgPath], { encoding: "utf8" });
    assert.equal(lint.status, 0, `${id}: Skillstead source lint passes\n${lint.stdout}\n${lint.stderr}`);
    assert.match(lint.stdout, /0 warning\(s\)/u, `${id}: Skillstead source lint has no warnings\n${lint.stdout}`);

    const pngBytes = await readFile(pngPath);
    assert.ok(pngBytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), `${id}: PNG signature is valid`);
    assert.equal(pngBytes.readUInt32BE(16), 2800, `${id}: PNG width is exactly 2800`);
    assert.equal(pngBytes.readUInt32BE(20), 1800, `${id}: PNG height is exactly 1800`);
  }
}

function assertSharedPngLinks(markdown) {
  const pngEmbeds = [...markdown.matchAll(/!\[[^\]]*\]\((guides\/assets\/shared\/[^)]+\.png)\)/g)]
    .map((match) => ({
      png: match[1],
      start: match.index,
      end: match.index + match[0].length,
    }));
  assert.ok(pngEmbeds.length >= 1 && pngEmbeds.length <= 3, "root README must embed one to three shared PNG diagrams");
  assert.ok(pngEmbeds.some(({ png }) => png === "guides/assets/shared/plugin-selection-flow.png"), "root README must embed plugin-selection-flow.png");
  for (const { png, start, end } of pngEmbeds) {
    const svg = png.replace(/\.png$/, ".svg");
    assert.equal(markdown[start - 1], "[", `shared PNG must begin a link wrapper: ${png}`);
    assert.ok(markdown.startsWith(`](${svg})`, end), `shared PNG occurrence must link to paired editable SVG: ${png}`);
  }
}

function bashBlocks(markdown) {
  return [...markdown.matchAll(/```bash\n([\s\S]*?)```/g)].map((match) => match[1]);
}

function assertRootContentContract(markdown) {
  const technicalAppendixStart = markdown.indexOf(technicalAppendixMarker);
  assert.notEqual(technicalAppendixStart, -1, "root README must include the technical appendix marker");
  assert.equal(markdown.indexOf(technicalAppendixMarker, technicalAppendixStart + 1), -1, "root README must have one technical appendix");
  const technicalHeadingStart = markdown.indexOf("## 기술 문서·기여·라이선스\n");
  assert.notEqual(technicalHeadingStart, -1, "root README must include the technical section");
  assert.ok(technicalHeadingStart < technicalAppendixStart, "technical appendix must follow the technical section");
  const beginnerPortion = markdown.slice(0, technicalAppendixStart);
  assert.deepEqual(h2Headings(beginnerPortion), requiredRootHeadings, "beginner H2 order before the technical appendix must be exact");
  const app = section(markdown, "Codex App 설치");
  const cli = section(markdown, "Codex CLI 설치");
  const quickStart = section(markdown, "5분 빠른 시작");
  const images = section(markdown, "이미지와 도식화");
  const exports = section(markdown, "문서 내보내기");
  const safety = section(markdown, "제한·개인정보·권리·사람 승인");

  assert.match(app, /새 채팅/);
  assert.match(cli, /새 세션/);
  assert.match(cli, /codex plugin marketplace add \./);
  assert.match(cli, /codex plugin marketplace list/);
  assert.match(cli, /codex plugin add game-design-studio@game-design-suite/);
  assert.match(cli, /codex plugin add game-design-career@game-design-suite/);
  assert.match(cli, /필요한 제품 하나만/);
  assert.match(cli, /둘 다 필요.*두 코드 블록 모두/);
  assert.ok(cli.indexOf("codex plugin marketplace add .") < cli.indexOf("codex plugin marketplace list"));
  const installBlocks = bashBlocks(cli).filter((block) => block.includes("codex plugin add"));
  assert.equal(installBlocks.length, 2, "Studio and Career installation choices must use separate code blocks");
  for (const block of installBlocks) {
    const selectors = ["game-design-studio@game-design-suite", "game-design-career@game-design-suite"]
      .filter((selector) => block.includes(selector));
    assert.equal(selectors.length, 1, "each install block must select exactly one product");
  }
  assert.ok(cli.lastIndexOf("codex plugin list") > Math.max(...installBlocks.map((block) => cli.indexOf(block))));
  assert.match(cli, /marketplace.*refresh[\s\S]*설치된 플러그인.*교체하지 않/);
  assert.match(cli, /다시 설치/);

  assert.match(quickStart, /@Game Design Studio/);
  assert.match(quickStart, /@Game Design Career/);
  assert.match(quickStart, /\$game-design-studio:orchestrate-game-design-project/);
  assert.match(quickStart, /\$game-design-career:orchestrate-game-design-career/);
  assert.doesNotMatch(quickStart, /새 App 채팅 또는 새 CLI 세션에 복사/);

  assert.match(markdown, /제품 스킬 14개.*Skillstead.*15개/s);
  assert.match(markdown, /Studio 템플릿 15개/);
  assert.match(markdown, /Career 템플릿 15개/);
  for (const mode of ["prompt-only", "select", "required", "all"]) assert.match(images, new RegExp(mode));
  assert.match(images, /OPENAI_API_KEY/);
  assert.match(images, /OpenAI Images API만 사용/);
  assert.match(images, /prompt-only fallback/);
  for (const status of ["not-requested", "blocked", "pending", "unavailable"]) assert.match(exports, new RegExp(status));
  assert.match(exports, /MD.*renderer capability와 무관/);
  assert.match(exports, /fail-closed/);
  for (const phrase of [
    "API key",
    "개인정보",
    "실명",
    "연락처",
    "비공개 회사 자료",
    "익명화",
    "제3자 권리",
    "consent evidence",
    "자동 승인되지 않습니다",
    "이름 있는 사람",
    "재미",
    "흥행",
    "매출",
    "채용",
    "합격",
    "법률",
    "플랫폼 승인",
  ]) assert.ok(safety.includes(phrase), `missing safety contract: ${phrase}`);
  assertSharedPngLinks(markdown);
}

function representativeCaseEntries(manifest) {
  return representativeCaseIds.map((id) => {
    const entry = manifest.cases.find((candidate) => candidate.id === id);
    assert.ok(entry, `representative case exists in manifest: ${id}`);
    return entry;
  });
}

async function canonicalLinkFromManifestEntry(entry) {
  const document = await readFile(path.join(root, entry.document), "utf8");
  const heading = visibleMarkdownHeadings(document).find(({ anchor }) => anchor === entry.anchor);
  assert.ok(heading, `manifest anchor has a visible heading: ${entry.id}`);
  return {
    product: entry.product,
    label: heading.label,
    target: `${entry.document}#${entry.anchor}`,
    fragment: entry.anchor,
  };
}

async function canonicalRootUseCaseLinks(manifest) {
  const entries = [...manifest.audience_paths, ...representativeCaseEntries(manifest)];
  return Promise.all(entries.map((entry) => canonicalLinkFromManifestEntry(entry)));
}

async function assertRootUseCaseNavigation(markdown, manifest) {
  const headings = h2Headings(markdown);
  assert.deepEqual(headings.slice(0, 4), requiredRootHeadings.slice(0, 4), "root use-case headings precede installation choice");
  const capability = section(markdown, "이 플러그인으로 할 수 있는 일");
  const audience = section(markdown, "사용자 유형별 추천 시작점");
  const exploration = section(markdown, "활용 방법 선택");
  for (const target of ["guides/use-cases/README.md", "guides/use-cases/audience-paths.md", "guides/use-cases/output-catalog.md"]) {
    assert.ok(markdown.includes(`](${target})`), `root shared hub link: ${target}`);
  }
  for (const entry of manifest.audience_paths) assert.ok(audience.includes(entry.id), `root audience label: ${entry.id}`);
  for (const phrase of ["content.md", "evidence.yml", "SVG", "PNG", "MD", "PDF", "DOCX", "PPTX"]) {
    assert.ok(capability.includes(phrase), `root result term: ${phrase}`);
  }
  for (const request of ["입문 요청문", "응용 요청문", "포트폴리오 요청문", "전체 프로젝트 요청문"]) {
    assert.ok(exploration.includes(request), `root request example: ${request}`);
  }
  for (const id of representativePromptTemplateIds) {
    assert.ok(exploration.includes(id), `root prompt-template route: ${id}`);
  }
  const promptCards = subsection(exploration, "난이도별 요청문 카드");
  const rawPromptCardRows = promptCards.split("\n").filter((line) => /^- /u.test(line));
  assert.equal(rawPromptCardRows.length, 8, "root representative prompt card raw row count");
  const visiblePromptCards = rawPromptCardRows.map((row) => {
    const match = /^- \[([^\]]+) — ((?:studio|career|suite):[a-z0-9-]+:(?:beginner|standard|advanced|case))\]\(([^)]+)\)$/u.exec(row);
    assert.ok(match, `root representative prompt card grammar: ${row}`);
    return match.slice(1);
  });
  assert.equal(visiblePromptCards.length, 8, "root representative prompt card count");
  assert.deepEqual(visiblePromptCards, representativePromptCards, "root representative prompt card fields are exact and ordered");
  assert.deepEqual(visiblePromptCards.map(([, id]) => id), representativePromptTemplateIds, "root representative prompt card IDs are exact and ordered");
  const goalStart = subsection(exploration, "목표별 바로 시작");
  const workScale = subsection(exploration, "작업 규모별 사용 예시");
  const outputLayer = subsection(exploration, "요청하면 얻는 결과");
  for (const phrase of ["학습", "규칙·루프·시스템·UX", "전체 GDD", "역기획", "포트폴리오·면접", "현업 검토"]) {
    assert.ok(goalStart.includes(phrase), `root goal start: ${phrase}`);
  }
  for (const phrase of ["10분 실습", "단일 과제", "포트폴리오 프로젝트", "전체 프로젝트"]) {
    assert.ok(workScale.includes(phrase), `root work scale: ${phrase}`);
  }
  for (const phrase of ["최소 결과", "선택 결과", "확장 결과", "사람 검토"]) {
    assert.ok(outputLayer.includes(phrase), `root output layer: ${phrase}`);
  }
  for (const phrase of ["규칙", "루프", "시스템", "UX", "역기획", "면접", "전체 프로젝트"]) {
    assert.ok(markdown.includes(phrase), `root learner balance: ${phrase}`);
  }
  const expectedLinks = await canonicalRootUseCaseLinks(manifest);
  const expectedTargets = new Set(expectedLinks.map(({ target }) => target));
  const actualLinks = visibleMarkdownLinks(markdown)
    .filter(({ target }) => expectedTargets.has(target))
    .map(({ label, target, fragment }) => ({ label, target, fragment }));
  assert.deepEqual(
    actualLinks,
    expectedLinks.map(({ label, target, fragment }) => ({ label, target, fragment })),
    "root audience and representative links preserve canonical visible labels, targets, anchors, and order",
  );
  for (const product of products) {
    const links = actualLinks.filter(({ target }) => expectedLinks.some((expected) => expected.product === product && expected.target === target));
    assert.ok(links.length >= 6, `${product}: six canonical representative case links`);
    assert.equal(new Set(links.map(({ target }) => target)).size, links.length, `${product}: representative case links are unique`);
  }
  for (const { target } of visibleMarkdownLinks(markdown)) {
    if (!target.includes("/use-cases/")) continue;
    const owner = products.find((product) => target.startsWith(`guides/${product}/use-cases/`));
    if (!owner || !target.includes("#")) continue;
    assert.ok(expectedLinks.some((expected) => expected.product === owner && expected.target === target), `root case link is canonical and product-bound: ${target}`);
  }
}

function assertGlobalUseCaseNavigation(markdown) {
  const terminology = section(markdown, "용어");
  for (const term of ["Canonical Artifact", "Quality Profile", "renderer capability"]) assert.ok(terminology.includes(term), `preserved terminology: ${term}`);
  for (const target of ["use-cases/README.md", "use-cases/audience-paths.md", "use-cases/output-catalog.md"]) {
    assert.ok(markdown.includes(`](${target})`), `global shared hub link: ${target}`);
  }
  for (const product of products) {
    for (const target of ["competency-paths.md", "concept-scenarios.md", "skill-workbench.md"]) {
      assert.ok(markdown.includes(`](${product}/use-cases/${target})`), `global exploration link: ${product}/${target}`);
    }
    assert.ok(markdown.includes(`](${product}/faq.md)`), `global product FAQ link: ${product}`);
  }
  for (const target of [
    "game-design-studio/use-cases/competency-paths.md#st-c03-규칙상태예외데이터",
    "game-design-career/use-cases/competency-paths.md#ca-c06-창작-기획-포트폴리오",
  ]) assert.ok(markdown.includes(`](${target})`), `global representative case link: ${target}`);
  const route = section(markdown, "입문에서 포트폴리오까지 읽기");
  assert.ok(route.indexOf("입문") < route.indexOf("포트폴리오"), "global beginner-to-portfolio route order");
}

async function reachableMarkdownPaths(entryPath, boundary = guideRoot) {
  const seen = new Set();
  const queue = [entryPath];
  while (queue.length > 0) {
    const current = queue.shift();
    if (seen.has(current)) continue;
    seen.add(current);
    const markdown = await readFile(current, "utf8");
    for (const link of visibleMarkdownLinks(markdown)) {
      const targetPath = await validateVisibleLocalLink(current, link, boundary);
      if (targetPath && path.extname(targetPath) === ".md") queue.push(targetPath);
    }
  }
  return seen;
}

test("visible Markdown navigation excludes comments, code fences, and inline-code-only headings", () => {
  const markdown = [
    "<!-- [comment](hidden.md#hidden) -->",
    "```md",
    "[fenced](hidden.md#hidden)",
    "## hidden {#hidden}",
    "```",
    "~~~text",
    "[also fenced](hidden.md#hidden)",
    "~~~",
    "## `hidden heading`",
    "## Visible heading",
    "[visible](visible.md#visible-heading)",
  ].join("\n");
  assert.deepEqual(
    visibleMarkdownLinks(markdown),
    [{ label: "visible", target: "visible.md#visible-heading", fragment: "visible-heading", line: 11 }],
  );
  assert.deepEqual(
    visibleMarkdownHeadings(markdown).map(({ label }) => label),
    ["Visible heading"],
    "inline-code-only headings are not anchor targets",
  );
  assert.deepEqual(
    visibleMarkdownLinks(["````md", "[hidden](missing.md)", "```", "[still-hidden](missing.md)", "````"].join("\n")),
    [],
    "a shorter closing fence or a different fence length cannot expose hidden links",
  );
  assert.deepEqual(visibleMarkdownLinks("<!--\n[hidden](missing.md)"), [], "an unclosed comment fails closed");
});

test("visible Markdown guide graph validates every local edge and permits safe cycles", async () => {
  const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), "visible-markdown-guide-"));
  const entry = path.join(fixtureRoot, "entry.md");
  const target = path.join(fixtureRoot, "target.md");
  try {
    await writeFile(entry, [
      "# Start",
      "<!--",
      "[commented](hidden.md#hidden)",
      "-->",
      "```md",
      "[fenced](hidden.md#hidden)",
      "## Hidden",
      "```",
      "~~~yaml",
      "[also-fenced](hidden.md#hidden)",
      "~~~",
      "[external](https://example.com) [email](mailto:guides@example.com)",
      "[target](target.md#target)",
    ].join("\n"));
    await writeFile(target, "## Target\n\n[cycle](entry.md#start)\n");

    const reachable = await reachableMarkdownPaths(entry, fixtureRoot);
    assert.deepEqual(new Set([entry, target]), reachable, "hidden links do not become graph edges and a validated cycle is safe");
    assert.deepEqual(visibleMarkdownLinks("```md\n[hidden](missing.md)"), [], "an unclosed fence fails closed");

    const rejectsTarget = async (label, linkTarget) => {
      await writeFile(entry, `# Start\n\n[unsafe](${linkTarget})\n`);
      await assert.rejects(() => reachableMarkdownPaths(entry, fixtureRoot), undefined, label);
    };
    await rejectsTarget("path traversal outside the guide root", "../outside.md");
    await rejectsTarget("absolute local path", path.join(fixtureRoot, "outside.md"));
    await rejectsTarget("file scheme", "file:///tmp/outside.md");
    await rejectsTarget("unsupported extension", "notes.txt");
    await rejectsTarget("missing target", "missing.md");
    await rejectsTarget("broken visible anchor", "target.md#missing");

    await mkdir(path.join(fixtureRoot, "directory"));
    await rejectsTarget("directory target", "directory");
    await symlink(target, path.join(fixtureRoot, "linked.md"));
    await rejectsTarget("symlink target", "linked.md");
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});

test("root README follows the approved task-oriented information architecture", async () => {
  const readme = await readFile(path.join(root, "README.md"), "utf8");
  await assertStructuredRootReadme(readme);
  assertPortfolioQuickStart(readme);
});

test("root README embeds three machine-linted Skillstead explanation diagrams", async () => {
  const readme = await readFile(path.join(root, "README.md"), "utf8");
  await assertReadmeSkillsteadDiagrams(readme);
});

test("portfolio quick start rejects abstract, unordered, and auto-approved variants", async () => {
  const readme = await readFile(path.join(root, "README.md"), "utf8");
  assert.doesNotThrow(() => assertPortfolioQuickStart(readme), "baseline portfolio route is actionable");
  const mutations = [
    ["wrong task title", readme.replace(portfolioQuickStartHeading, "Studio 결과를 Career로 연결하기")],
    ["missing visible label", readme.replace("**준비물:**", "**입력:**")],
    ["abstract evidence candidate", readme.replace("포트폴리오 사례를 만듭니다.", "공개 증거 후보를 만듭니다.")],
    ["missing Studio review", readme.replace("$game-design-studio:review-game-design", "$game-design-studio:review-removed")],
    ["missing portfolio result path", readme.replace("creative-design-portfolio/evidence.yml", "portfolio/evidence.yml")],
    ["missing human publication boundary", readme.replace("실제 기여 범위와 공개 권한", "자료 범위")],
    ["auto-approved publication", readme.replace("공개를 자동 승인하지 않으며", "공개를 자동 승인하며")],
    [
      "reversed App order",
      mutatePortfolioPromptSurface(readme, "App", (surface) => surface
        .replaceAll("review-game-design", "__studio_review__")
        .replaceAll("build-game-design-portfolio", "review-game-design")
        .replaceAll("__studio_review__", "build-game-design-portfolio"),
      ),
    ],
    [
      "reversed CLI order",
      mutatePortfolioPromptSurface(readme, "CLI", (surface) => surface
        .replaceAll("$game-design-studio:review-game-design", "__studio_review__")
        .replaceAll("$game-design-career:build-game-design-portfolio", "$game-design-studio:review-game-design")
        .replaceAll("__studio_review__", "$game-design-career:build-game-design-portfolio"),
      ),
    ],
  ];
  for (const [label, mutated] of mutations) {
    assert.notEqual(mutated, readme, `${label}: mutation changes the README`);
    assertPortfolioQuickStartRejected(mutated, label);
  }
});

test("structured README contracts reject card, inventory, and generated-tree mutations", async () => {
  const readme = await buildValidStructuredReadmeFixture();
  await assert.doesNotReject(() => assertStructuredRootReadme(readme, { validateLinks: false }), "independent fixture satisfies every structured README contract before mutation");
  const affectedCard = "studio:case:ST-C01";
  const card = renderedPromptCards(readme).find((candidate) => candidate.id === affectedCard);
  assert.ok(card, `${affectedCard}: baseline representative card exists before mutation checks`);
  const replaceCard = (replacement) => readme.replace(card.raw, replacement);
  const missingLabel = replaceCard(card.raw.replace("#### 준비 입력\n", ""));
  const duplicateId = readme.replace(card.raw, `${card.raw}\n${card.raw}`);
  const changedSkill = replaceCard(card.raw.replace("`apply-document-quality-profile`", "`invented-skill`"));
  const reversedReadOrder = replaceCard(card.raw.replace(/(#### 읽는 순서\n)([^\n]+)\n/u, (_, prefix, order) => `${prefix}${order.split(" → ").reverse().join(" → ")}\n`));
  const removedApproval = replaceCard(card.raw.replace(/사람 결정/g, "자동 결정"));
  const inventedCard = readme.replace(card.raw, card.raw.replace(affectedCard, "studio:case:INVENTED"));
  const idFirstSummary = replaceCard(card.raw.replace(
    "게임의 방향과 핵심 재미 정의 (studio:case:ST-C01)",
    "studio:case:ST-C01 게임의 방향과 핵심 재미 정의",
  ));
  const genericCardDescription = replaceCard(card.raw.replace(
    readableCaseLabels.get(affectedCard)[1],
    "필요한 내용을 정리할 때 사용합니다.",
  ));
  for (const [label, mutated, id] of [
    ["missing card label", missingLabel, affectedCard],
    ["duplicate prompt ID", duplicateId, affectedCard],
    ["wrong skill chain", changedSkill, affectedCard],
    ["reversed read order", reversedReadOrder, affectedCard],
    ["missing human approval", removedApproval, affectedCard],
    ["invented prompt card", inventedCard, "studio:case:INVENTED"],
    ["ID-first prompt summary", idFirstSummary, affectedCard],
    ["generic prompt summary description", genericCardDescription, affectedCard],
  ]) await assertRejectedForId(() => assertRepresentativePromptCards(mutated), id, label);

  const suiteId = "suite:studio-to-career-handoff:case";
  const suiteCard = renderedPromptCards(readme).find((candidate) => candidate.id === suiteId);
  assert.ok(suiteCard, `${suiteId}: baseline suite card exists before prompt mutation checks`);
  const duplicateSuiteCommand = readme.replace(
    suiteCard.raw,
    suiteCard.raw.replace(
      "CLI\n$game-design-studio:review-game-design",
      "CLI\n$game-design-studio:review-game-design\n$game-design-studio:review-game-design",
    ),
  );
  assert.notEqual(duplicateSuiteCommand, readme, "duplicate suite CLI command mutation changes the fixture");
  await assertRejectedForId(
    () => assertRepresentativePromptCards(duplicateSuiteCommand),
    suiteId,
    "duplicate suite CLI command",
  );

  const careerSuiteId = "suite:career-proof-project-interview:case";
  const careerSuiteCard = renderedPromptCards(readme).find((candidate) => candidate.id === careerSuiteId);
  assert.ok(careerSuiteCard, `${careerSuiteId}: baseline suite card exists before namespace mutation check`);
  const wrongSuiteNamespace = readme.replace(
    careerSuiteCard.raw,
    careerSuiteCard.raw.replace(
      "$game-design-career:map-game-design-career",
      "$game-design-studio:map-game-design-career",
    ),
  );
  assert.notEqual(wrongSuiteNamespace, readme, "wrong suite namespace mutation changes the fixture");
  await assertRejectedForId(
    () => assertRepresentativePromptCards(wrongSuiteNamespace),
    careerSuiteId,
    "wrong suite CLI namespace",
  );

  const product = "game-design-studio";
  const [visionName, visionDescription] = readableMetadata(readableSkillMetadata, product, "define-game-vision", "skill");
  const [, qualityDescription] = readableMetadata(readableSkillMetadata, product, "apply-document-quality-profile", "skill");
  const [leadName, leadDescription] = readableMetadata(readableAgentMetadata, product, "lead-game-designer", "agent");
  const [, artDescription] = readableMetadata(readableAgentMetadata, product, "art-brief-director", "agent");
  const removedSkill = readme.replace(`${visionName} (\`define-game-vision\`)`, `${visionName} (\`missing-skill\`)`);
  const duplicateSkill = readme.replace(`${visionName} (\`define-game-vision\`)`, `${visionName} (\`apply-document-quality-profile\`)`);
  const crossProductSkill = readme.replace(`${visionName} (\`define-game-vision\`)`, `${visionName} (\`map-game-design-career\`)`);
  const missingKoreanSkillName = readme.replace(`${visionName} (\`define-game-vision\`)`, "(`define-game-vision`)");
  const genericKoreanSkillName = readme.replace(`${visionName} (\`define-game-vision\`)`, "스킬 2 (`define-game-vision`)");
  const slugDerivedSkillDescription = readme.replace(visionDescription, "define-game-vision 작업의 결과와 검토 범위를 안내합니다.");
  const repeatedSkillDescription = readme.replace(visionDescription, qualityDescription);
  const inventedAgent = readme.replace(`${leadName} (\`lead-game-designer\`)`, `${leadName} (\`invented-agent\`)`);
  const missingKoreanAgentRole = readme.replace(`${leadName} (\`lead-game-designer\`)`, "(`lead-game-designer`)");
  const genericKoreanAgentRole = readme.replace(`${leadName} (\`lead-game-designer\`)`, "역할 4 (`lead-game-designer`)");
  const slugDerivedAgentDescription = readme.replace(leadDescription, "lead-game-designer 관점에서 기획 판단을 검토하고 권고를 남깁니다.");
  const repeatedAgentDescription = readme.replace(leadDescription, artDescription);
  for (const [label, mutated, id, validate] of [
    ["missing skill", removedSkill, "missing-skill", assertSkillInventoryTable],
    ["duplicate skill", duplicateSkill, "apply-document-quality-profile", assertSkillInventoryTable],
    ["cross-product skill", crossProductSkill, "map-game-design-career", assertSkillInventoryTable],
    ["missing Korean skill name", missingKoreanSkillName, "define-game-vision", assertSkillInventoryTable],
    ["generic Korean skill name", genericKoreanSkillName, "define-game-vision", assertSkillInventoryTable],
    ["slug-derived skill description", slugDerivedSkillDescription, "define-game-vision", assertSkillInventoryTable],
    ["repeated skill description", repeatedSkillDescription, "define-game-vision", assertSkillInventoryTable],
    ["invented agent", inventedAgent, "invented-agent", assertAgentInventoryTable],
    ["missing Korean agent role", missingKoreanAgentRole, "lead-game-designer", assertAgentInventoryTable],
    ["generic Korean agent role", genericKoreanAgentRole, "lead-game-designer", assertAgentInventoryTable],
    ["slug-derived agent description", slugDerivedAgentDescription, "lead-game-designer", assertAgentInventoryTable],
    ["repeated agent description", repeatedAgentDescription, "lead-game-designer", assertAgentInventoryTable],
  ]) await assertRejectedForId(() => validate(mutated, product), id, label);

  const directManifestEdit = readme.replace(`plugins/${product}/`, `plugins/${product}/\nBUILD-MANIFEST.json을 직접 수정합니다.\n`);
  await assertRejectedForId(() => assertPluginTreeContract(directManifestEdit, product), product, "direct BUILD-MANIFEST edit instruction");

  const autoApprovedResult = readme.replace("사람 승인 전 보류하며 자동 승인되지 않습니다.", "이미지와 파생 문서, 검토 결과는 자동 승인됩니다.");
  await assertRejectedForId(() => assertResultExamples(autoApprovedResult), "game-design-brief", "automatic approval in result example");
  const EnglishFirstResult = readme.replace(
    "게임 기획 브리프 (`game-design-brief`)",
    "`game-design-brief` 게임 기획 브리프",
  );
  await assertRejectedForId(() => assertResultExamples(EnglishFirstResult), "game-design-brief", "English-first result label");
  const incompleteResultReadOrder = readme.replace(
    "`content.md` → `evidence.yml` → `decisions/` → `assets/` → `export-manifest.yml`",
    "`content.md` → `evidence.yml` → `export-manifest.yml`",
  );
  assert.notEqual(incompleteResultReadOrder, readme, "incomplete result read-order mutation changes the fixture");
  await assertRejectedForId(() => assertResultExamples(incompleteResultReadOrder), "game-design-brief", "incomplete result read order");
  const autoApprovedSafety = readme.replace("이미지·파생 문서·검토 결과는 자동 승인되지 않습니다.", "이미지·파생 문서·검토 결과는 자동 승인됩니다.");
  await assertRejectedForId(() => Promise.resolve(assertSafetyBoundary(autoApprovedSafety)), "safety-boundary", "automatic approval in safety boundary");
  const incompleteUpdate = readme.replace("Uninstall plugin", "Remove later");
  assert.notEqual(incompleteUpdate, readme, "incomplete App update mutation changes the fixture");
  assert.throws(() => assertUpdateAndReinstallInstructions(incompleteUpdate), /Uninstall plugin/u, "incomplete App update instructions are rejected");
});

test("global and product indexes reach 30 skills, 30 templates, and 12 recipes", async () => {
  const reachable = await reachableMarkdownPaths(path.join(guideRoot, "README.md"));
  assert.equal(reachable.size, 119, "guide link graph reaches the prompt-template library, curated Archify status index, and all guide documents");
  assert.ok(reachable.has(path.join(guideRoot, "archify-diagrams/README.md")), "curated Archify status index is reachable");
  for (const relative of requiredUseCaseGuidePaths) {
    assert.ok(reachable.has(path.join(guideRoot, relative)), `new use-case guide is unreachable: ${relative}`);
  }
  let recipeCount = 0;
  for (const product of products) {
    const inventory = await collectProductInventory(root, product);
    assert.equal(inventory.skillIds.length, 15);
    assert.equal(inventory.templateIds.length, 15);
    const productRoot = path.join(guideRoot, product);
    const expected = [
      "README.md",
      "installation.md",
      "quick-start.md",
      "workflow.md",
      "document-quality.md",
      "image-assets.md",
      "visualization.md",
      "exports.md",
      "templates.md",
      "troubleshooting.md",
      "skills/README.md",
      ...inventory.skillIds.map((id) => `skills/${id}.md`),
    ];
    const recipes = product === "game-design-studio"
      ? ["new-game-gdd", "system-feature-spec", "content-quest-design", "ux-accessibility", "economy-liveops", "production-review-export"]
      : ["role-learning-roadmap", "job-research-gap", "reverse-design", "portfolio-build-review", "interview-preparation", "junior-growth-transition"];
    recipeCount += recipes.length;
    expected.push(...recipes.map((id) => `recipes/${id}.md`));
    for (const relative of expected) assert.ok(reachable.has(path.join(productRoot, relative)), `${product} index path is unreachable: ${relative}`);
  }
  assert.equal(recipeCount, 12);
});

test("beginner guides use repository-root CLI commands and the real visualization wrappers", async () => {
  for (const product of products) {
    const installation = await readFile(path.join(guideRoot, product, "installation.md"), "utf8");
    assert.match(installation, /codex plugin marketplace add \./);
    assert.doesNotMatch(installation, /<path-to-repository-root>/);
    assert.ok(installation.indexOf("codex plugin add") < installation.lastIndexOf("codex plugin list"));
  }
  const wrappers = [
    ["game-design-studio", "products/game-design-studio/plugin/skills/visualize-game-design/scripts/run-skillstead.mjs"],
    ["game-design-career", "products/game-design-career/plugin/skills/visualize-career-roadmap/scripts/run-skillstead.mjs"],
  ];
  for (const [product, wrapper] of wrappers) {
    const visualization = await readFile(path.join(guideRoot, product, "visualization.md"), "utf8");
    assert.match(visualization, new RegExp(wrapper.replaceAll("/", "\\/")));
    assert.doesNotMatch(visualization, /<svg-path>|<png-path>/);
    assert.match(visualization, /교체 placeholder/);
    await assertRegularNonSymlinkFile(path.join(root, wrapper));
  }
});

test("guide indexes give beginners the same complete reading path", async () => {
  const expectedLinks = [
    "installation.md",
    "quick-start.md",
    "templates.md",
    "skills/README.md",
    "workflow.md",
    "image-assets.md",
    "visualization.md",
    "exports.md",
    "troubleshooting.md",
  ];
  const global = await readFile(path.join(guideRoot, "README.md"), "utf8");
  const globalStart = section(global, "처음 시작하기");
  const readingTable = section(global, "초보자 읽기 경로");
  const goalRouteTable = section(global, "목표에서 다음 문서까지");
  assertNavigationTable(
    goalRouteTable,
    ["목표", "대표 문서", "예상 결과", "다음 상세 문서"],
    [
      ["작은 규칙·루프·시스템·UX를 학습", [
        "game-design-studio/use-cases/README.md",
        "game-design-studio/use-cases/skill-workbench.md",
        "game-design-studio/faq.md",
      ]],
      ["전체 GDD와 제작 검토를 연결", ["game-design-studio/README.md", "use-cases/output-catalog.md"]],
      ["직무 탐색·역기획·포트폴리오·면접 준비", [
        "game-design-career/use-cases/README.md",
        "game-design-career/use-cases/skill-workbench.md",
        "game-design-career/faq.md",
      ]],
      ["현재 상황과 결과 경계를 먼저 확인", ["use-cases/audience-paths.md", "use-cases/README.md", "use-cases/output-catalog.md"]],
    ],
    "global goal route",
  );
  assert.match(readingTable, /처음 시작하기/);
  assert.doesNotMatch(readingTable, /빠른 시작 → 전체 워크플로/);
  for (const product of products) {
    const local = await readFile(path.join(guideRoot, product, "README.md"), "utf8");
    const productStart = section(local, "처음 시작하기");
    const navigation = product === "game-design-studio"
      ? section(local, "작업 규모와 결과")
      : subsection(section(local, "사례 탐색 경로"), "목표별 결과와 다음 문서");
    assertNavigationTable(
      navigation,
      product === "game-design-studio"
        ? ["목표 규모", "권장 시작", "예상 결과", "다음 문서"]
        : ["목표", "예상 결과", "상세 문서"],
      product === "game-design-studio"
        ? [
          ["작은 실습", ["use-cases/README.md", "use-cases/competency-paths.md"]],
          ["단일 명세", ["use-cases/skill-workbench.md", "faq.md"]],
          ["전체 프로젝트", ["recipes/new-game-gdd.md", "../use-cases/output-catalog.md"]],
        ]
        : [
          ["직무 탐색", ["recipes/role-learning-roadmap.md"]],
          ["역기획", ["recipes/reverse-design.md"]],
          ["포트폴리오", ["recipes/portfolio-build-review.md"]],
          ["면접", ["recipes/interview-preparation.md"]],
          ["성장", ["recipes/junior-growth-transition.md"]],
        ],
      `${product} navigation`,
    );
    for (const [label, markdown] of [["global", globalStart], [product, productStart]]) {
      let previous = -1;
      for (const target of [...expectedLinks.slice(0, 4), label === "global" ? "README.md#목적별-레시피" : "#목적별-레시피", ...expectedLinks.slice(4)]) {
        const index = markdown.indexOf(target);
        assert.ok(index > previous, `${label} beginner path is missing or misorders ${target}`);
        previous = index;
      }
    }
    for (const [label, markdown] of [["global", globalStart], [product, productStart]]) {
      assert.match(markdown, /목적에 맞는 템플릿을 고르고.*필요하면.*스킬을 직접 호출/s, `${label} must not imply one-to-one template-to-skill mapping`);
      assert.doesNotMatch(markdown, /템플릿.*스킬.*한 쌍/, `${label} must not describe templates and skills as one-to-one pairs`);
    }
  }
});

test("Career Markdown export stays renderer-independent and validates from pending to passed", async () => {
  const contract = await readFile(path.join(root, "shared/export/qa-contracts/md.md"), "utf8");
  const career = await readFile(path.join(guideRoot, "game-design-career/exports.md"), "utf8");
  assert.match(contract, /always-available export/);
  assert.match(contract, /cannot be `failed` or `unavailable`/);
  assert.match(contract, /starts `pending`.*`passed`/);
  assert.match(career, /MD.*renderer capability와 무관.*항상 사용 가능/);
  assert.match(career, /MD.*`unavailable`.*사용하지 않/);
  assert.match(career, /`pending`.*downstream validation.*`passed`/);
});
