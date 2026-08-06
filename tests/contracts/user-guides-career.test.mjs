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
const expectedTemplateIds = [
  "career-stage-goal",
  "competency-matrix",
  "creative-design-portfolio",
  "five-axis-review",
  "game-analysis-report",
  "game-design-role-map",
  "interview-question-answer-log",
  "introduction-motivation",
  "job-posting-evidence",
  "junior-growth-review",
  "learning-roadmap",
  "portfolio-backlog",
  "portfolio-project-brief",
  "reverse-design-document",
  "transition-readiness",
];

function extractFirstColumnIds(markdown) {
  return [...markdown.matchAll(/^\| (?:`([^`]+)`|\[`([^`]+)`\]\([^)]+\)) \|/gm)]
    .map((match) => match[1] ?? match[2])
    .sort();
}

function extractSection(markdown, heading) {
  const marker = `## ${heading}\n`;
  const start = markdown.indexOf(marker);
  assert.notEqual(start, -1, `missing section: ${heading}`);
  const bodyStart = start + marker.length;
  const next = markdown.indexOf("\n## ", bodyStart);
  return markdown.slice(bodyStart, next === -1 ? markdown.length : next).trim();
}

function h2Headings(markdown) {
  return [...markdown.matchAll(/^## (.+)$/gm)].map((match) => match[1]);
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

test("Career documents every installed skill with the common contract", async () => {
  const inventory = await collectProductInventory(root, "game-design-career");
  assert.equal(inventory.skillIds.length, 15);

  for (const skillId of inventory.skillIds) {
    const markdown = await readFile(
      path.join(root, "guides/game-design-career/skills", skillId + ".md"),
      "utf8",
    );
    assertSkillContract(markdown, skillId);
    assert.match(markdown, /복사 가능한 요청문/);
    assert.match(markdown, /예상 결과/);
  }
});

test("Career skill contract rejects missing or reordered new sections", async () => {
  const markdown = await readFile(
    path.join(root, "guides/game-design-career/skills/map-game-design-career.md"),
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

test("Career indexes every installed skill and canonical template exactly once", async () => {
  const inventory = await collectProductInventory(root, "game-design-career");
  const skillIndex = await readFile(
    path.join(root, "guides/game-design-career/skills/README.md"),
    "utf8",
  );
  const templates = await readFile(
    path.join(root, "guides/game-design-career/templates.md"),
    "utf8",
  );

  assert.deepEqual(extractFirstColumnIds(skillIndex), inventory.skillIds);
  assert.deepEqual(inventory.templateIds, expectedTemplateIds);
  assert.deepEqual(extractFirstColumnIds(templates), expectedTemplateIds);
});

test("Career template guide separates installed paths, authoring sources, and generated snapshots", async () => {
  const inventory = await collectProductInventory(root, "game-design-career");
  const templates = await readFile(path.join(root, "guides/game-design-career/templates.md"), "utf8");
  assert.doesNotMatch(templates, /Package path:/);
  assert.match(templates, /설치 상대 경로/);
  assert.match(templates, /저장소 authoring source/);
  assert.match(templates, /generated snapshot/);
  for (const id of inventory.templateIds) {
    const paths = [
      `assets/templates/${id}/`,
      `products/game-design-career/plugin/assets/templates/${id}/`,
      `plugins/game-design-career/assets/templates/${id}/`,
    ];
    for (const relative of paths) {
      assert.ok(templates.includes(`\`${relative}\``), `missing documented template path: ${relative}`);
      const filename = relative.startsWith("assets/")
        ? path.join(root, "products/game-design-career/plugin", relative)
        : path.join(root, relative);
      assert.ok((await lstat(filename)).isDirectory(), `template path does not exist: ${relative}`);
    }
  }
});

test("Career current-claim workflows preserve named evidence and inference limits", async () => {
  const guideIds = [
    "map-game-design-career",
    "orchestrate-game-design-career",
    "plan-junior-growth",
    "practice-game-design-interview",
    "research-game-design-jobs",
  ];

  for (const skillId of guideIds) {
    const markdown = await readFile(
      path.join(root, "guides/game-design-career/skills", skillId + ".md"),
      "utf8",
    );
    for (const phrase of ["사실", "추론", "제안", "검색일", "지역", "표본"] ) {
      assert.ok(markdown.includes(phrase), `${skillId}: missing current-claim boundary: ${phrase}`);
    }
  }
});

test("Career evidence workflows name the source record identifiers", async () => {
  const evidenceContracts = {
    "build-game-design-portfolio": ["claimId", "evidence address", "inspectabilityGate"],
    "map-game-design-career": ["currentEvidence", "targetLevel", "feedbackCadence"],
    "plan-junior-growth": ["requirementId", "eventId", "proofArtifact"],
    "practice-game-design-interview": ["questionId", "postingEvidenceIds", "portfolioEvidenceIds"],
    "research-game-design-jobs": ["sourceId", "retrievalDate", "reviewAfter"],
    "reverse-engineer-game-design": ["observation", "inference", "validationMethod"],
    "review-game-design-portfolio": ["findingId", "axisId", "observationState"],
  };

  for (const [skillId, fields] of Object.entries(evidenceContracts)) {
    const markdown = await readFile(
      path.join(root, "guides/game-design-career/skills", skillId + ".md"),
      "utf8",
    );
    for (const field of fields) {
      assert.ok(markdown.includes(field), `${skillId}: missing named evidence field: ${field}`);
    }
  }
});

test("Career growth and interview guides refresh stale posting evidence before current claims", async () => {
  const contracts = {
    "plan-junior-growth": "requirementId",
    "practice-game-design-interview": "questionId",
  };

  for (const [skillId, downstreamId] of Object.entries(contracts)) {
    const markdown = await readFile(
      path.join(root, "guides/game-design-career/skills", skillId + ".md"),
      "utf8",
    );
    const scopedContract = [
      "필수 입력과 선택 입력",
      "내부 진행 흐름",
      "실패·fallback·재개 방법",
    ].map((heading) => extractSection(markdown, heading)).join("\n");

    for (const phrase of [
      "sourceId",
      "sourceUrl",
      "official HTTPS",
      "postedDate",
      "retrievalDate",
      "reviewAfter",
      "research-game-design-jobs",
      "stale evidence는 current claim에 사용하지 않습니다",
      "기존 기록",
      "보존",
      "validator 재검증",
      "새 evidence IDs",
      downstreamId,
    ]) {
      assert.ok(scopedContract.includes(phrase), `${skillId}: missing scoped stale-evidence contract: ${phrase}`);
    }
  }
});

test("Career interview workflow binds question and answer records by stable questionId", async () => {
  const markdown = await readFile(
    path.join(root, "guides/game-design-career/skills/practice-game-design-interview.md"),
    "utf8",
  );
  const workflow = extractSection(markdown, "내부 진행 흐름");
  const result = extractSection(markdown, "생성 파일과 결과 구조");

  for (const field of [
    "questionId",
    "questionType",
    "postingEvidenceIds",
    "portfolioEvidenceIds",
    "prompt",
    "verificationStatus",
  ]) {
    assert.ok(workflow.includes(field), `interview workflow missing question field: ${field}`);
  }
  assert.match(workflow, /answer[^.\n]*feedback[^.\n]*같은 `questionId`를 재사용/);
  for (const phrase of ["question record", "answer-feedback record", "stable `questionId`", "결합"] ) {
    assert.ok(result.includes(phrase), `interview result missing question linkage: ${phrase}`);
  }
});

test("Career guides preserve evidence, image, visualization, and export contracts", async () => {
  const guidePaths = [
    "guides/game-design-career/document-quality.md",
    "guides/game-design-career/image-assets.md",
    "guides/game-design-career/visualization.md",
    "guides/game-design-career/exports.md",
  ];
  const joinedGuides = (
    await Promise.all(guidePaths.map((guidePath) => readFile(path.join(root, guidePath), "utf8")))
  ).join("\n");

  for (const phrase of [
    "사실", "추론", "제안", "검색일", "지역", "표본",
    "합격을 보장하지", "prompt-only", "select", "required", "all",
    "SVG", "2× PNG", "MD", "PDF", "DOCX", "PPTX",
  ]) {
    assert.ok(joinedGuides.includes(phrase), "missing Career guide contract: " + phrase);
  }
});

test("Career visualization guides preserve the no-Node Skillstead fallback", async () => {
  const guidePaths = [
    "guides/game-design-career/skills/svg-infographic.md",
    "guides/game-design-career/skills/visualize-career-roadmap.md",
    "guides/game-design-career/visualization.md",
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
