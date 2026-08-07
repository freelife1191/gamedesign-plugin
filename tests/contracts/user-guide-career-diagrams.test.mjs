import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstat, readFile, readdir } from "node:fs/promises";
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
const recipeResultContract = Object.freeze({
  "role-learning-roadmap": ["career-stage-goal/content.md", "learning-roadmap/content.md", "target-role", "proof-artifact", "portfolio", "interview", "career-stage-goal/content.md → learning-roadmap/content.md"],
  "job-research-gap": ["job-posting-evidence/content.md", "competency-matrix/content.md", "source-url", "minimum-repair", "portfolio", "interview", "job-posting-evidence/content.md → competency-matrix/content.md"],
  "reverse-design": ["reverse-design-document/content.md", "evidence.yml", "observation", "validation-method", "portfolio", "interview", "reverse-design-document/content.md → evidence.yml"],
  "portfolio-build-review": ["creative-design-portfolio/content.md", "five-axis-review/content.md", "claim-id", "minimum-repair", "portfolio", "interview", "creative-design-portfolio/content.md → evidence.yml"],
  "interview-preparation": ["interview-question-answer-log/content.md", "evidence.yml", "question-id", "honest-answer", "portfolio", "interview", "interview-question-answer-log/content.md → evidence.yml"],
  "junior-growth-transition": ["junior-growth-review/content.md", "transition-readiness/content.md", "project-event-evidence", "next-review-date", "portfolio", "interview", "junior-growth-review/content.md → transition-readiness/content.md"],
});
const recipeResultHeadings = ["예상 파일 트리", "대표 내용 예시", "완료 기준", "포트폴리오·면접 활용", "읽는 순서"];
const templateSourceRoot = path.join(root, "products/game-design-career/plugin/assets/templates");
const recipeTemplateContract = Object.freeze({
  "role-learning-roadmap": [["career-stage-goal", ["target-role", "success-evidence"]], ["learning-roadmap", ["proof-artifact", "re-evaluation-date"]]],
  "job-research-gap": [["job-posting-evidence", ["source-url", "retrieval-date", "sample-geography"]], ["competency-matrix", ["minimum-repair", "re-evaluation-date"]], ["portfolio-project-brief", ["target-competency", "implementation-test"]]],
  "reverse-design": [["reverse-design-document", ["observation", "inference", "validation-method"]]],
  "portfolio-build-review": [["creative-design-portfolio", ["claim-id", "evidence-id", "attribution"]], ["five-axis-review", ["finding-id", "minimum-repair"]], ["portfolio-backlog", ["backlog-id", "minimum-repair"]]],
  "interview-preparation": [["interview-question-answer-log", ["question-id", "answer-status", "verification-task"]]],
  "junior-growth-transition": [["junior-growth-review", ["project-event-evidence", "next-review-date", "proof-artifact"]], ["transition-readiness", ["target-requirement", "retrieval-date", "verification-task"]]],
});

function section(markdown, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = markdown.match(new RegExp(`^## ${escaped}\\n([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, "m"));
  assert.ok(match, "missing section: " + heading);
  return match[1];
}

function h3Sections(markdown) {
  const headings = [...markdown.matchAll(/^### (.+)$/gm)];
  return headings.map((heading, index) => ({
    heading: heading[1],
    body: markdown.slice(heading.index + heading[0].length, headings[index + 1]?.index).trim(),
  }));
}

function assertRecipeResult(recipe, markdown) {
  const result = section(markdown, "예상 결과");
  const entries = h3Sections(result);
  assert.deepEqual(entries.map(({ heading }) => heading), recipeResultHeadings, recipe.id + " expected-result heading order");
  const byHeading = new Map(entries.map(({ heading, body }) => [heading, body]));
  const [firstFile, secondFile, exampleOne, doneTerm, portfolioTerm, interviewTerm] = recipeResultContract[recipe.id];
  const tree = byHeading.get("예상 파일 트리");
  for (const [label, artifactPath] of [["first", firstFile], ["second", secondFile]]) {
    if (!artifactPath) continue;
    for (const segment of artifactPath.split("/").filter(Boolean)) assert.ok(tree.includes(segment), recipe.id + " artifact-relative file tree " + label + " file segment: " + segment);
  }
  assert.ok(byHeading.get("대표 내용 예시").includes(exampleOne), recipe.id + " representative field example");
  assert.ok(byHeading.get("완료 기준").includes(doneTerm), recipe.id + " verifiable completion criterion");
  assert.ok(byHeading.get("포트폴리오·면접 활용").includes(portfolioTerm), recipe.id + " portfolio use");
  assert.ok(byHeading.get("포트폴리오·면접 활용").includes(interviewTerm), recipe.id + " interview use");
}

async function assertRecipeTemplateResult(recipe, markdown) {
  const result = section(markdown, "예상 결과");
  const byHeading = new Map(h3Sections(result).map(({ heading, body }) => [heading, body]));
  const expected = recipeTemplateContract[recipe.id];
  for (const [artifactId, fields] of expected) {
    const template = await readFile(path.join(templateSourceRoot, artifactId, "content.md"), "utf8");
    for (const field of fields) assert.match(template, new RegExp("`" + field + "`"), recipe.id + " canonical template field: " + artifactId + "." + field);
    const walk = async (directory, prefix = "") => (await readdir(directory, { withFileTypes: true })).flatMap(async (entry) => entry.isDirectory()
      ? [prefix + entry.name + "/", ...(await walk(path.join(directory, entry.name), prefix + entry.name + "/"))]
      : [prefix + entry.name]);
    const inventory = (await Promise.all(await walk(path.join(templateSourceRoot, artifactId)))).flat();
    for (const file of inventory.filter((file) => /^(?:content\.md|evidence\.yml|decisions\/|assets\/README\.md|export-manifest\.yml)$/.test(file))) assert.ok(file.length > 0, recipe.id + " source inventory item");
    const treePattern = new RegExp(artifactId + "/[\\s\\S]{0,220}?content\\.md[\\s\\S]{0,220}?evidence\\.yml[\\s\\S]{0,220}?decisions/[\\s\\S]{0,220}?assets/[\\s\\S]{0,220}?README\\.md[\\s\\S]{0,220}?export-manifest\\.yml");
    assert.match(byHeading.get("예상 파일 트리"), treePattern, recipe.id + " artifact subtree: " + artifactId);
    for (const field of fields) assert.ok(byHeading.get("대표 내용 예시").includes("`" + field + "`"), recipe.id + " representative canonical field: " + field);
    const order = `game-design-career/<career-id>/${artifactId}/content.md → game-design-career/<career-id>/${artifactId}/evidence.yml → game-design-career/<career-id>/${artifactId}/decisions/ → game-design-career/<career-id>/${artifactId}/assets/README.md → game-design-career/<career-id>/${artifactId}/export-manifest.yml`;
    assert.ok(byHeading.get("읽는 순서").includes(order), recipe.id + " canonical artifact read order: " + artifactId);
  }
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
    assertRecipeResult(recipe, markdown);
    const resume = section(markdown, "실패와 재개");
    assertSafeRecipeSections({ request, progress, resume, goal: section(markdown, "완료 목표") });
  }
});

test("Career recipe expected results reject heading and semantic swaps", async () => {
  const recipe = recipes[0];
  const markdown = await readFile(path.join(root, "guides/game-design-career/recipes", recipe.id + ".md"), "utf8");
  const result = section(markdown, "예상 결과");
  const completeResult = `### 예상 파일 트리\n\n\`game-design-career/<career-id>/career-stage-goal/content.md\`\n\`game-design-career/<career-id>/learning-roadmap/content.md\`\n\n### 대표 내용 예시\n\n\`target-role\`\n\n### 완료 기준\n\n\`proof-artifact\`\n\n### 포트폴리오·면접 활용\n\nportfolio와 interview에 사용합니다.\n\n### 읽는 순서\n\ncanonical artifact 순서`;
  const completeMarkdown = markdown.replace(result, completeResult);
  assert.doesNotThrow(() => assertRecipeResult(recipe, completeMarkdown));
  const entries = h3Sections(completeResult);
  const swappedHeadings = completeResult
    .replace("### 예상 파일 트리", "### __TREE__")
    .replace("### 대표 내용 예시", "### 예상 파일 트리")
    .replace("### __TREE__", "### 대표 내용 예시");
  assert.throws(() => assertRecipeResult(recipe, completeMarkdown.replace(completeResult, swappedHeadings)), /heading order/);

  const example = entries.find(({ heading }) => heading === "대표 내용 예시");
  const completion = entries.find(({ heading }) => heading === "완료 기준");
  const semanticSwap = completeResult
    .replace(example.body, "__EXAMPLE__")
    .replace(completion.body, example.body)
    .replace("__EXAMPLE__", completion.body);
  assert.throws(() => assertRecipeResult(recipe, completeMarkdown.replace(completeResult, semanticSwap)), /representative field example/);
});

test("Career recipe results derive every artifact, field, and read order from template sources", async () => {
  for (const recipe of recipes) {
    const markdown = await readFile(path.join(root, "guides/game-design-career/recipes", recipe.id + ".md"), "utf8");
    await assertRecipeTemplateResult(recipe, markdown);
  }
});

test("Career recipe source contracts reject every wrong-valid field, artifact, and read-order mutation", async () => {
  for (const recipe of recipes) {
    const markdown = await readFile(path.join(root, "guides/game-design-career/recipes", recipe.id + ".md"), "utf8");
    const result = section(markdown, "예상 결과");
    const entries = new Map(h3Sections(result).map(({ heading, body }) => [heading, body]));
    for (const [artifactId, fields] of recipeTemplateContract[recipe.id]) {
      const wrongArtifact = artifactId === "career-stage-goal" ? "competency-matrix" : "career-stage-goal";
      await assert.rejects(() => assertRecipeTemplateResult(recipe, markdown.replace(result, result.replace(artifactId, wrongArtifact))), /artifact subtree/, `${recipe.id} ${artifactId} wrong-valid artifact mutation`);
      await assert.rejects(() => assertRecipeTemplateResult(recipe, markdown.replace(entries.get("대표 내용 예시"), entries.get("대표 내용 예시").replace("`" + fields[0] + "`", "`approval-status`"))), /representative canonical field/, `${recipe.id} ${artifactId} wrong-valid field mutation`);
      const order = `game-design-career/<career-id>/${artifactId}/content.md → game-design-career/<career-id>/${artifactId}/evidence.yml → game-design-career/<career-id>/${artifactId}/decisions/ → game-design-career/<career-id>/${artifactId}/assets/README.md → game-design-career/<career-id>/${artifactId}/export-manifest.yml`;
      await assert.rejects(() => assertRecipeTemplateResult(recipe, markdown.replace(order, order.split(" → ").reverse().join(" → "))), /canonical artifact read order/, `${recipe.id} ${artifactId} read-order mutation`);
    }
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
