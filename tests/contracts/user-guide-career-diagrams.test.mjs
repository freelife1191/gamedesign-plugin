import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
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
    artifacts: ["game-design-career/<career-id>/job-posting-evidence/", "game-design-career/<career-id>/competency-matrix/"],
    templates: ["job-posting-evidence", "competency-matrix", "portfolio-backlog"],
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
    artifacts: ["game-design-career/<career-id>/creative-design-portfolio/", "game-design-career/<career-id>/five-axis-review/"],
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
    const imageLinks = [...markdown.matchAll(/!\[[^\]]+\]\(([^)]+\.png)\)/g)].map((match) => match[1]);
    assert.equal(imageLinks.length, 1, recipe.id + " must have exactly one primary diagram image link");
    assert.match(imageLinks[0], new RegExp("game-design-career/" + recipe.diagramId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\.png$"));
    const diagram = manifest.diagrams.find(({ id }) => id === recipe.diagramId);
    assert.ok(diagram, recipe.id + " primary diagram must be declared in the manifest");
    assert.ok(diagram.usedBy.includes("../game-design-career/recipes/" + recipe.id + ".md"), recipe.id + " must be a manifest consumer");

    const input = section(markdown, "준비할 입력");
    for (const artifact of recipe.artifacts) assert.ok(input.includes(artifact), recipe.id + " Canonical Artifact path family: " + artifact);
    for (const template of recipe.templates) assert.match(input, new RegExp("`" + template + "`"), recipe.id + " template binding: " + template);

    const request = section(markdown, "복사 가능한 요청문");
    assert.match(request, /@Game Design Career/, recipe.id + " App natural-language request");
    assert.match(request, /개인정보|비공개|privacy/i, recipe.id + " privacy-safe request");
    for (const skill of recipe.skills) assert.match(request, new RegExp("\\$game-design-career:" + skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), recipe.id + " CLI namespace: " + skill);

    const progress = section(markdown, "단계별 진행");
    for (const mode of ["prompt-only", "select", "required", "all"]) assert.match(progress, new RegExp("`?" + mode + "`?"), recipe.id + " IMAGE_GEN_MODE branch: " + mode);
    for (const phrase of ["관찰 사실", "추론", "제안", "sourceUrl", "location", "retrievalDate", "region", "sample boundary", "reviewAfter", "stale", "재검색"]) assert.ok(progress.includes(phrase), recipe.id + " current-evidence boundary: " + phrase);

    const approval = section(markdown, "사람이 결정할 지점");
    for (const approver of recipe.approvers) assert.ok(approval.includes(approver), recipe.id + " named human approval: " + approver);
    const resume = section(markdown, "실패와 재개");
    for (const phrase of ["Chromium", "renderer", "capability", "unavailable", "Canonical Artifact", "기존 output", "PNG unavailable"]) assert.ok(resume.includes(phrase), recipe.id + " fallback: " + phrase);
    assert.doesNotMatch(markdown, /합격\s*(을|률|보장)|취업\s*(을|률|보장)/, recipe.id + " must not promise hiring");
  }
});

test("Career manifest completes the unique 18-diagram inventory with complete pairs", async () => {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  assert.equal(manifest.diagrams.length, 18, "diagram inventory count");
  assert.equal(new Set(manifest.diagrams.map(({ id }) => id)).size, 18, "diagram IDs must be unique");
  const career = manifest.diagrams.filter(({ scope }) => scope === "game-design-career");
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
    assert.match(svg, /^\s*<svg\b[^>]*>\s*<title\b[^>]*>\s*[^<\s][\s\S]*?<\/title>\s*<desc\b[^>]*>\s*[^<\s][\s\S]*?<\/desc>/u, diagram.id + " requires title and desc");
    assert.deepEqual(parseViewBox(svg), { w: 1400, h: 900 }, diagram.id + " viewBox");
    assert.ok(isCompletePng(pngPath), diagram.id + " PNG must end at IEND");
    assert.deepEqual(pngDims(pngPath), { w: 2800, h: 1800 }, diagram.id + " PNG must be exact 2×");
    const lint = spawnSync(process.execPath, [skillsteadWrapperPath, "lint", svgPath], { encoding: "utf8" });
    assert.equal(lint.status, 0, diagram.id + " wrapper lint exit code: " + lint.stderr);
    assertCleanLintOutput(lint.stdout + lint.stderr, diagram.id);
  }
});
