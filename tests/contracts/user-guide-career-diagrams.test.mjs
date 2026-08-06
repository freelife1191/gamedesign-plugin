import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  isCompletePng,
  parseViewBox,
  pngDims,
} from "../../shared/vendor/skillstead/svg-infographic/0.8.3/scripts/render.mjs";
import { validateVisualizationState } from "../../products/game-design-career/plugin/skills/visualize-career-roadmap/scripts/validate-visualization-state.mjs";

const root = fileURLToPath(new URL("../..", import.meta.url));
const manifestPath = path.join(root, "guides/assets/diagram-manifest.json");
const manifestDir = path.dirname(manifestPath);
const skillsteadWrapperPath = fileURLToPath(new URL(
  "../../products/game-design-career/plugin/skills/visualize-career-roadmap/scripts/run-skillstead.mjs",
  import.meta.url,
));
const recipeHeadings = [
  "완료 목표",
  "준비할 입력",
  "복사 가능한 요청문",
  "단계별 진행",
  "사람이 결정할 지점",
  "예상 결과",
  "실패와 재개",
  "관련 기능",
];
const recipes = [
  {
    id: "role-learning-roadmap",
    diagramId: "role-gap-learning-roadmap",
    skills: ["orchestrate-game-design-career", "map-game-design-career", "apply-document-quality-profile"],
    artifacts: ["game-design-career/<career-id>/career-stage-goal/", "game-design-career/<career-id>/learning-roadmap/"],
    templates: ["career-stage-goal", "game-design-role-map", "learning-roadmap"],
    approvers: ["김서윤", "박도현"],
  },
  {
    id: "job-research-gap",
    diagramId: "job-research-evidence-flow",
    skills: ["research-game-design-jobs", "map-game-design-career", "build-game-design-portfolio"],
    artifacts: ["game-design-career/<career-id>/job-posting-evidence/", "game-design-career/<career-id>/competency-matrix/", "game-design-career/<career-id>/portfolio-project-brief/"],
    templates: ["job-posting-evidence", "competency-matrix", "portfolio-project-brief"],
    approvers: ["이민아", "최유진"],
  },
  {
    id: "reverse-design",
    diagramId: "reverse-design-portfolio-flow",
    skills: ["reverse-engineer-game-design", "visualize-career-roadmap", "export-career-documents"],
    artifacts: ["game-design-career/<career-id>/reverse-design-document/"],
    templates: ["reverse-design-document", "game-analysis-report"],
    approvers: ["한지훈", "오지은"],
  },
  {
    id: "portfolio-build-review",
    diagramId: "portfolio-review-loop",
    skills: ["build-game-design-portfolio", "review-game-design-portfolio", "plan-image-assets"],
    artifacts: ["game-design-career/<career-id>/creative-design-portfolio/", "game-design-career/<career-id>/five-axis-review/", "game-design-career/<career-id>/portfolio-backlog/"],
    templates: ["creative-design-portfolio", "five-axis-review", "portfolio-backlog"],
    approvers: ["정하늘", "윤태호"],
  },
  {
    id: "interview-preparation",
    diagramId: "interview-growth-transition-flow",
    skills: ["practice-game-design-interview", "research-game-design-jobs", "review-game-design-portfolio"],
    artifacts: ["game-design-career/<career-id>/interview-question-answer-log/"],
    templates: ["interview-question-answer-log", "job-posting-evidence", "five-axis-review"],
    approvers: ["최유진", "박도현"],
  },
  {
    id: "junior-growth-transition",
    diagramId: "career-stage-routing",
    skills: ["plan-junior-growth", "map-game-design-career", "review-game-design-portfolio", "export-career-documents"],
    artifacts: ["game-design-career/<career-id>/junior-growth-review/", "game-design-career/<career-id>/transition-readiness/"],
    templates: ["junior-growth-review", "transition-readiness", "career-stage-goal"],
    approvers: ["김서윤", "한지훈", "오지은"],
  },
];

function section(markdown, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = markdown.match(new RegExp(`^## ${escaped}\\n([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, "m"));
  assert.ok(match, "missing section: " + heading);
  return match[1];
}

function assertCleanLintOutput(output, label) {
  assert.match(output, /^check-svg: 0 error\(s\), 0 warning\(s\) across 1 file\(s\)$/m, label + " lint summary");
}

function visualizationState({ assetRoot, id, altText, svgBytes }) {
  return {
    artifactRoot: assetRoot,
    requested: true,
    planned: true,
    generated: true,
    linted: true,
    rendered: true,
    verified: true,
    svgFile: id + ".svg",
    pngFile: id + ".png",
    pngAvailability: "available",
    availabilityEvidence: { command: "node run-skillstead.mjs probe", result: "passed", reason: "canonical Chrome 151 available" },
    lintEvidence: {
      command: "node run-skillstead.mjs lint " + id + ".svg",
      file: id + ".svg",
      result: "passed",
      sha256: createHash("sha256").update(svgBytes).digest("hex"),
      errors: [],
      warnings: [],
      warningsDisposition: "No warnings.",
    },
    renderEvidence: {
      command: "node run-skillstead.mjs render " + id + ".svg " + id + ".png",
      svgFile: id + ".svg",
      pngFile: id + ".png",
      browser: "Google Chrome 151.0.7922.76",
      result: "passed",
      scale: 2,
      sourceWidth: 1400,
      sourceHeight: 900,
      outputWidth: 2800,
      outputHeight: 1800,
    },
    altText,
    visualQa: "high와 original에서 텍스트, containment, connector를 확인했습니다.",
  };
}

function assertSafeRecipeSections({ request, progress, resume, goal }) {
  const combined = goal + "\n" + request + "\n" + progress + "\n" + resume;
  assert.doesNotMatch(
    combined,
    /개인정보를 전부 입력해|stale evidence를 계속 사용하고 재검색하지 않는다|모든 IMAGE_GEN_MODE에서 무제한 생성한다|기존 output을 삭제한다/u,
    "unsafe handoff language is forbidden",
  );
  assert.match(request, /개인정보·실명·회사기밀 raw input은 입력하지 말고 익명화/, "privacy-safe raw-input boundary");
  for (const [mode, action] of [
    ["prompt-only", "prompt와 placeholder만"],
    ["select", "사람이 제출한 receipt의 stable ID만"],
    ["required", "finite required asset만"],
    ["all", "declared asset만"],
  ]) assert.match(progress, new RegExp("`?" + mode + "`?[^\\n]*" + action), mode + " action boundary");
  assert.match(progress, /stale evidence는 재검색 전에는 current claim에 사용하지 않습니다\./, "stale evidence must be re-retrieved");
  for (const phrase of ["관찰 사실", "추론", "제안"]) assert.ok(progress.includes(phrase), "fact/inference/proposal boundary: " + phrase);
  assert.match(resume, /Chromium renderer 또는 필요한 capability가 unavailable이면 PNG unavailable 상태로 남기고 Canonical Artifact와 기존 output을 보존합니다\./, "renderer fallback preserves output");
  assert.match(goal, /채용 결과를 보장하지 않습니다\./, "hiring guarantee denial");
  assert.doesNotMatch(
    combined,
    /(?:채용|입사|합격|취업|승진|전환)[^.\n]*(?:보장합니다|보장해|보장될|확실합니다|약속합니다)/u,
    "positive hiring guarantee is forbidden",
  );
}

function resolveManifestPath(value, field) {
  assert.equal(typeof value, "string", field + " must be a string");
  assert.ok(value.length > 0, field + " must be nonempty");
  assert.ok(!path.isAbsolute(value) && !path.win32.isAbsolute(value), field + " must be relative");
  const resolved = path.resolve(manifestDir, value);
  const relative = path.relative(root, resolved);
  assert.ok(relative && !relative.startsWith("..") && !path.isAbsolute(relative), field + " must stay inside the repository");
  return resolved;
}

async function assertRegularFile(value, field) {
  const resolved = resolveManifestPath(value, field);
  const stats = await lstat(resolved);
  assert.ok(!stats.isSymbolicLink(), field + " must not be a symlink");
  assert.ok(stats.isFile(), field + " must be a regular file");
  return resolved;
}

test("Skillstead lint summary rejects warning output", () => {
  assertCleanLintOutput("check-svg: 0 error(s), 0 warning(s) across 1 file(s)\n", "clean fixture");
  assert.throws(
    () => assertCleanLintOutput("diagram.svg:1 warn W-TEXT warning\ncheck-svg: 0 error(s), 1 warning(s) across 1 file(s)\n", "warning fixture"),
    /lint summary/,
  );
});

test("Career recipes have one primary diagram and the complete handoff contract", async () => {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  for (const recipe of recipes) {
    const recipePath = path.join(root, "guides/game-design-career/recipes", recipe.id + ".md");
    const markdown = await readFile(recipePath, "utf8");
    const headings = [...markdown.matchAll(/^## (.+)$/gm)].map((match) => match[1]);
    assert.deepEqual(headings, recipeHeadings, recipe.id + " heading order and count");
    const imageLinks = [...markdown.matchAll(/!\[([^\]]+)\]\(([^)]+\.png)\)/g)];
    assert.equal(imageLinks.length, 1, recipe.id + " must have exactly one primary diagram image link");
    assert.match(imageLinks[0][2], new RegExp("game-design-career/" + recipe.diagramId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\.png$"));
    const diagram = manifest.diagrams.find(({ id }) => id === recipe.diagramId);
    assert.ok(diagram, recipe.id + " primary diagram must be declared in the manifest");
    assert.ok(diagram.usedBy.includes("../game-design-career/recipes/" + recipe.id + ".md"), recipe.id + " must be a manifest consumer");
    assert.equal(imageLinks[0][1], diagram.alt, recipe.id + " recipe image alt must be canonical manifest alt");

    const input = section(markdown, "준비할 입력");
    for (const artifact of recipe.artifacts) assert.ok(input.includes(artifact), recipe.id + " Canonical Artifact path family: " + artifact);
    for (const template of recipe.templates) assert.match(input, new RegExp("`" + template + "`"), recipe.id + " template binding: " + template);

    const request = section(markdown, "복사 가능한 요청문");
    assert.match(request, /@Game Design Career/, recipe.id + " App natural-language request");
    for (const skill of recipe.skills) assert.match(request, new RegExp("\\$game-design-career:" + skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), recipe.id + " CLI namespace: " + skill);

    const progress = section(markdown, "단계별 진행");
    for (const phrase of ["관찰 사실", "추론", "제안", "sourceUrl", "location", "retrievalDate", "region", "sample boundary", "reviewAfter", "stale", "재검색"]) assert.ok(progress.includes(phrase), recipe.id + " current-evidence boundary: " + phrase);

    const approval = section(markdown, "사람이 결정할 지점");
    for (const approver of recipe.approvers) assert.ok(approval.includes(approver), recipe.id + " named human approval: " + approver);
    const resume = section(markdown, "실패와 재개");
    assertSafeRecipeSections({ request, progress, resume, goal: section(markdown, "완료 목표") });
  }
});

test("Career manifest keeps unique global IDs and exactly six complete Career diagram pairs", async () => {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  assert.equal(new Set(manifest.diagrams.map(({ id }) => id)).size, manifest.diagrams.length, "global diagram IDs must be unique");
  const career = manifest.diagrams.filter(({ scope }) => scope === "game-design-career");
  assert.equal(career.length, 6, "Career diagram count");
  assert.deepEqual(career.map(({ id }) => id).sort(), recipes.map(({ diagramId }) => diagramId).sort());
  for (const diagram of career) {
    assert.equal(diagram.svg, "game-design-career/" + diagram.id + ".svg");
    assert.equal(diagram.png, "game-design-career/" + diagram.id + ".png");
    const svgPath = await assertRegularFile(diagram.svg, diagram.id + ".svg");
    const pngPath = await assertRegularFile(diagram.png, diagram.id + ".png");
    for (const field of ["sources", "usedBy"]) {
      assert.ok(Array.isArray(diagram[field]) && diagram[field].length > 0, diagram.id + "." + field);
      for (const value of diagram[field]) await assertRegularFile(value, diagram.id + "." + field);
    }
    const svg = await readFile(svgPath, "utf8");
    const svgBytes = await readFile(svgPath);
    assert.doesNotMatch(svg, /<style\b/i, diagram.id + " must not use a style element");
    assert.match(svg, /^\s*<svg\b[^>]*>\s*<title\b[^>]*>\s*[^<\s][\s\S]*?<\/title>\s*<desc\b[^>]*>\s*[^<\s][\s\S]*?<\/desc>/u, diagram.id + " requires title and desc");
    assert.deepEqual(parseViewBox(svg), { w: 1400, h: 900 }, diagram.id + " viewBox");
    assert.ok(isCompletePng(pngPath), diagram.id + " PNG must end at IEND");
    assert.deepEqual(pngDims(pngPath), { w: 2800, h: 1800 }, diagram.id + " PNG must be exact 2×");
    const lint = spawnSync(process.execPath, [skillsteadWrapperPath, "lint", svgPath], { encoding: "utf8" });
    assert.equal(lint.status, 0, diagram.id + " wrapper lint exit code: " + lint.stderr);
    assertCleanLintOutput(lint.stdout + lint.stderr, diagram.id);
    assert.doesNotThrow(
      () => validateVisualizationState(visualizationState({ assetRoot: path.dirname(svgPath), id: diagram.id, altText: diagram.alt, svgBytes })),
      diagram.id + " must pass the real Career visualization state validator",
    );
  }
});

test("Career recipe safety helper rejects unsafe semantic mutations", () => {
  const safe = {
    request: "개인정보·실명·회사기밀 raw input은 입력하지 말고 익명화된 공개 evidence ID만 사용해.",
    progress: "관찰 사실과 추론, 제안을 분리합니다. `prompt-only`는 prompt와 placeholder만 만듭니다. `select`는 사람이 제출한 receipt의 stable ID만 처리합니다. `required`는 finite required asset만 처리합니다. `all`은 declared asset만 처리합니다. stale evidence는 재검색 전에는 current claim에 사용하지 않습니다.",
    resume: "Chromium renderer 또는 필요한 capability가 unavailable이면 PNG unavailable 상태로 남기고 Canonical Artifact와 기존 output을 보존합니다.",
    goal: "채용 결과를 보장하지 않습니다.",
  };
  assert.doesNotThrow(() => assertSafeRecipeSections(safe));
  for (const [field, unsafe] of [
    ["request", "개인정보를 전부 입력해"],
    ["progress", "stale evidence를 계속 사용하고 재검색하지 않는다"],
    ["progress", "모든 IMAGE_GEN_MODE에서 무제한 생성한다"],
    ["resume", "기존 output을 삭제한다"],
    ["goal", "취업을 보장합니다"],
  ]) assert.throws(() => assertSafeRecipeSections({ ...safe, [field]: unsafe }), undefined, field + " unsafe mutation survived");
});
