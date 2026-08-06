import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { collectProductInventory } from "../../tooling/lib/user-guides.mjs";

const root = fileURLToPath(new URL("../..", import.meta.url));
const requiredHeadings = [
  "목적과 산출물",
  "사용할 때",
  "사용하지 않을 때",
  "필수 입력과 선택 입력",
  "Codex App 예시",
  "Codex CLI 예시",
  "진행 흐름",
  "결과와 파일",
  "검토와 승인",
  "실패와 재개",
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
  return [...markdown.matchAll(/^\| `([^`]+)` \|/gm)].map((match) => match[1]).sort();
}

test("Career documents every installed skill with the common contract", async () => {
  const inventory = await collectProductInventory(root, "game-design-career");
  assert.equal(inventory.skillIds.length, 15);

  for (const skillId of inventory.skillIds) {
    const markdown = await readFile(
      path.join(root, "guides/game-design-career/skills", skillId + ".md"),
      "utf8",
    );
    for (const heading of requiredHeadings) {
      assert.match(markdown, new RegExp("^## " + heading + "$", "m"), skillId + ": " + heading);
    }
    assert.match(markdown, /복사 가능한 요청문/);
    assert.match(markdown, /예상 결과/);
  }
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
