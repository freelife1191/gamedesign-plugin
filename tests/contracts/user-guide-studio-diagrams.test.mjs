import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { lstat, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { importVendored } from "../lib/vendored.mjs";

const { isCompletePng, parseViewBox, pngDims } = await importVendored("skillstead", "scripts/render.mjs");

const root = fileURLToPath(new URL("../..", import.meta.url));
const manifestPath = path.join(root, "guides/assets/diagram-manifest.json");
const manifestDir = path.dirname(manifestPath);
const skillsteadWrapperPath = fileURLToPath(new URL(
  "../../products/game-design-studio/plugin/skills/visualize-game-design/scripts/run-skillstead.mjs",
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
const recipeResultHeadings = [
  "예상 파일 트리",
  "대표 내용 예시",
  "완료 기준",
  "포트폴리오 또는 팀 전달 포인트",
];
const recipes = [
  {
    id: "new-game-gdd",
    diagramId: "vision-to-gdd-approval",
    skills: ["orchestrate-game-design-project", "apply-document-quality-profile", "define-game-vision", "review-game-design"],
    artifacts: ["game-design/<project-id>/vision-pillars/"],
    primaryArtifacts: ["vision-pillars"],
    secondaryArtifacts: ["game-design-brief"],
    templates: ["vision-pillars", "game-design-brief"],
    approvers: ["김서윤"],
    exampleTerms: ["Player promise", "Unsupported fun boundary", "prototype"],
  },
  {
    id: "system-feature-spec",
    diagramId: "system-rule-state-exception-flow",
    skills: ["design-game-systems", "design-player-experience", "review-game-design"],
    artifacts: ["game-design/<project-id>/system-specification/"],
    primaryArtifacts: ["system-specification"],
    secondaryArtifacts: ["rule-exception-matrix"],
    templates: ["system-specification", "rule-exception-matrix"],
    approvers: ["박도현", "이민아"],
    exampleTerms: ["R-CRAFT-03", "idle →", "TC-09"],
  },
  {
    id: "content-quest-design",
    diagramId: "content-narrative-quest-map",
    skills: ["design-game-content", "design-game-systems", "plan-game-production"],
    artifacts: ["game-design/<project-id>/narrative-quest-npc/"],
    primaryArtifacts: ["narrative-quest-npc"],
    secondaryArtifacts: ["character-skill-combat-monster"],
    templates: ["narrative-quest-npc", "character-skill-combat-monster"],
    approvers: ["최유진", "한지훈"],
    exampleTerms: ["Q-ARCH-01", "rights-consent", "ATK-GUARD-02"],
  },
  {
    id: "ux-accessibility",
    diagramId: "studio-orchestration-map",
    skills: ["design-player-experience", "apply-document-quality-profile", "review-game-design"],
    artifacts: ["game-design/<project-id>/ui-ux-flow-state/"],
    primaryArtifacts: ["ui-ux-flow-state"],
    secondaryArtifacts: ["accessibility-platform-matrix"],
    templates: ["ui-ux-flow-state", "accessibility-platform-matrix"],
    approvers: ["이민아", "김서윤"],
    exampleTerms: ["UX-ACT-01", "focus", "offline"],
  },
  {
    id: "economy-liveops",
    diagramId: "economy-balance-liveops-loop",
    skills: ["design-game-economy-and-liveops", "design-game-systems", "plan-game-production"],
    artifacts: ["game-design/<project-id>/economy-balance/", "game-design/<project-id>/liveops-experiment-event/"],
    primaryArtifacts: ["economy-balance", "liveops-experiment-event"],
    secondaryArtifacts: [],
    templates: ["economy-balance", "liveops-experiment-event"],
    approvers: ["정하늘", "윤태호"],
    exampleTerms: ["EXP-FEST-01", "guardrail", "rollback"],
  },
  {
    id: "production-review-export",
    diagramId: "production-risk-review-flow",
    skills: ["plan-game-production", "review-game-design", "plan-image-assets", "visualize-game-design", "export-game-design-documents"],
    artifacts: ["game-design/<project-id>/production-scope-risk/", "game-design/<project-id>/game-design-review/"],
    primaryArtifacts: ["production-scope-risk", "game-design-review"],
    secondaryArtifacts: ["decision-change-log"],
    templates: ["production-scope-risk", "game-design-review", "decision-change-log"],
    approvers: ["한지훈", "김서윤", "오지은"],
    exampleTerms: ["SCOPE-04", "F-12", "DEC-08"],
  },
];

function markdownSections(markdown, level) {
  const marker = "#".repeat(level);
  const headings = [...markdown.matchAll(new RegExp(`^${marker} (.+)$`, "gm"))];
  return headings.map((heading, index) => ({
    heading: heading[1],
    body: markdown.slice(heading.index + heading[0].length, headings[index + 1]?.index).trim(),
  }));
}

function fencedCodeBlocks(markdown, language) {
  return [...markdown.matchAll(/^```([^\n]*)\n([\s\S]*?)\n```$/gm)]
    .filter((match) => match[1] === language)
    .map((match) => match[2]);
}

function artifactTreeBody(tree, artifact) {
  const directories = [...tree.matchAll(/^(?:├|└)── (.+)\/$/gm)];
  const index = directories.findIndex((match) => match[1] === artifact);
  const match = directories[index];
  assert.ok(match, "missing artifact directory in file tree: " + artifact);
  return tree.slice(match.index + match[0].length, directories[index + 1]?.index).trim();
}

function assertRecipeExpectedResult({ markdown, recipe }) {
  const result = section(markdown, "예상 결과");
  const parts = markdownSections(result, 3);
  assert.deepEqual(parts.map(({ heading }) => heading), recipeResultHeadings, recipe.id + " expected-result H3 shape");
  const byHeading = new Map(parts.map((part) => [part.heading, part.body]));

  for (const part of parts) {
    assert.ok(part.body.length >= 80, recipe.id + " " + part.heading + " substantive content");
    assert.doesNotMatch(part.body, /^(?:TODO|TBD)(?:\b|$)/iu, recipe.id + " " + part.heading + " placeholder");
  }

  const tree = byHeading.get("예상 파일 트리");
  const trees = fencedCodeBlocks(tree, "text");
  assert.equal(trees.length, 1, recipe.id + " one concrete file tree");
  assert.match(trees[0], /game-design\/<project-id>\//, recipe.id + " file tree project root");
  assert.ok(tree.includes("game-design/<project-id>/"), recipe.id + " file tree project root");
  for (const artifact of recipe.artifacts) {
    const artifactRelative = artifact.replace("game-design/<project-id>/", "");
    assert.ok(tree.includes(artifactRelative), recipe.id + " file tree artifact: " + artifact);
  }
  for (const artifact of recipe.primaryArtifacts) {
    const artifactBody = artifactTreeBody(trees[0], artifact);
    for (const filename of ["content.md", "evidence.yml", "decisions/README.md", "assets/README.md", "export-manifest.yml"]) {
      assert.ok(artifactBody.includes(filename), recipe.id + " primary artifact-local file: " + artifact + "/" + filename);
    }
  }
  for (const artifact of recipe.secondaryArtifacts) {
    assert.match(trees[0], new RegExp(artifact + "/"), recipe.id + " separate secondary artifact: " + artifact);
  }
  assert.doesNotMatch(trees[0], /^(?:├|└)── (?:(?:decisions|assets)\/README\.md|export-manifest\.yml)$/m, recipe.id + " no project-root shared canonical files");

  const excerpt = byHeading.get("대표 내용 예시");
  for (const template of recipe.templates) assert.match(excerpt, new RegExp("`" + template + "`"), recipe.id + " excerpt template: " + template);
  const examples = fencedCodeBlocks(excerpt, "md");
  assert.equal(examples.length, 1, recipe.id + " one representative excerpt block");
  assert.doesNotMatch(examples[0], /\b(?:TODO|TBD|placeholder)\b/iu, recipe.id + " representative excerpt placeholder");
  assert.ok(examples[0].length >= 100, recipe.id + " substantive representative excerpt");
  for (const term of recipe.exampleTerms) assert.ok(examples[0].includes(term), recipe.id + " representative excerpt term: " + term);

  const completion = byHeading.get("완료 기준");
  for (const approver of recipe.approvers) assert.ok(completion.includes(approver), recipe.id + " completion approver: " + approver);
  assert.match(completion, /승인|보류|blocked/u, recipe.id + " human completion boundary");

  const handoff = byHeading.get("포트폴리오 또는 팀 전달 포인트");
  assert.match(handoff, /Canonical Artifact|content\.md/u, recipe.id + " handoff canonical source");
  assert.match(handoff, /결정|근거|미해결|risk|위험/u, recipe.id + " handoff decision boundary");
}

function section(markdown, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = markdown.match(new RegExp(`^## ${escaped}\\n([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, "m"));
  assert.ok(match, "missing section: " + heading);
  return match[1];
}

function assertCleanLintOutput(output, label) {
  assert.match(output, /^check-svg: 0 error\(s\), 0 warning\(s\) across 1 file\(s\)$/m, label + " lint summary");
}

test("Skillstead lint summary rejects warning output", () => {
  assertCleanLintOutput("check-svg: 0 error(s), 0 warning(s) across 1 file(s)\n", "clean fixture");
  assert.throws(
    () => assertCleanLintOutput("diagram.svg:1 warn W-TEXT warning\ncheck-svg: 0 error(s), 1 warning(s) across 1 file(s)\n", "warning fixture"),
    /lint summary/,
  );
});

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

test("Studio recipes have one primary diagram and the complete handoff contract", async () => {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  for (const recipe of recipes) {
    const recipePath = path.join(root, "guides/game-design-studio/recipes", recipe.id + ".md");
    const markdown = await readFile(recipePath, "utf8");
    const headings = [...markdown.matchAll(/^## (.+)$/gm)].map((match) => match[1]);
    assert.deepEqual(headings, recipeHeadings, recipe.id + " heading order and count");
    const imageLinks = [...markdown.matchAll(/!\[[^\]]+\]\(([^)]+\.png)\)/g)].map((match) => match[1]);
    assert.equal(imageLinks.length, 1, recipe.id + " must have exactly one primary diagram image link");
    assert.match(imageLinks[0], new RegExp("game-design-studio/" + recipe.diagramId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\.png$"));
    const diagram = manifest.diagrams.find(({ id }) => id === recipe.diagramId);
    assert.ok(diagram, recipe.id + " primary diagram must be declared in the manifest");
    assert.ok(diagram.usedBy.includes("../game-design-studio/recipes/" + recipe.id + ".md"), recipe.id + " must be a manifest consumer");

    const input = section(markdown, "준비할 입력");
    for (const artifact of recipe.artifacts) {
      assert.ok(input.includes(artifact), recipe.id + " Canonical Artifact path family: " + artifact);
    }
    for (const template of recipe.templates) {
      assert.match(input, new RegExp("`" + template + "`"), recipe.id + " template binding: " + template);
    }

    const request = section(markdown, "복사 가능한 요청문");
    assert.match(request, /@Game Design Studio/, recipe.id + " App natural-language request");
    for (const skill of recipe.skills) {
      assert.match(request, new RegExp("\\$game-design-studio:" + skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), recipe.id + " CLI namespace: " + skill);
    }

    const progress = section(markdown, "단계별 진행");
    for (const mode of ["prompt-only", "select", "required", "all"]) {
      assert.match(progress, new RegExp("`?" + mode + "`?"), recipe.id + " IMAGE_GEN_MODE branch: " + mode);
    }

    const approval = section(markdown, "사람이 결정할 지점");
    for (const approver of recipe.approvers) {
      assert.ok(approval.includes(approver), recipe.id + " named human approval: " + approver);
    }
    const resume = section(markdown, "실패와 재개");
    assert.match(resume, /Chromium|renderer|capability/i, recipe.id + " renderer capability condition");
    assert.match(resume, /없으면|unavailable/i, recipe.id + " renderer fallback condition");
    assert.match(resume, /Canonical Artifact|canonical text/i, recipe.id + " canonical preservation");
    assert.match(resume, /기존.*output|existing output/i, recipe.id + " existing output preservation");
    assert.match(resume, /PNG.*unavailable/i, recipe.id + " PNG non-success fallback");
  }
});

test("Studio recipe expected-result sections contain section-local concrete outputs", async () => {
  for (const recipe of recipes) {
    const recipePath = path.join(root, "guides/game-design-studio/recipes", recipe.id + ".md");
    const markdown = await readFile(recipePath, "utf8");
    assertRecipeExpectedResult({ markdown, recipe });
  }
});

test("Studio recipe expected-result contract rejects empty, placeholder, or cross-recipe sections", async () => {
  const recipe = recipes[0];
  const recipePath = path.join(root, "guides/game-design-studio/recipes", recipe.id + ".md");
  const markdown = await readFile(recipePath, "utf8");
  const result = section(markdown, "예상 결과");
  const emptyTree = markdown.replace(result, result.replace(/(?<=^### 예상 파일 트리\n)[\s\S]*?(?=^### 대표 내용 예시)/m, "TODO\n\n"));
  assert.throws(
    () => assertRecipeExpectedResult({ markdown: emptyTree, recipe }),
    /new-game-gdd 예상 파일 트리 substantive content/,
  );

  const example = fencedCodeBlocks(markdownSections(result, 3).find(({ heading }) => heading === "대표 내용 예시").body, "md")[0];
  const placeholderExample = markdown.replace(example, "TODO");
  assert.throws(
    () => assertRecipeExpectedResult({ markdown: placeholderExample, recipe }),
    /new-game-gdd representative excerpt placeholder/,
  );

  const otherRecipe = recipes[1];
  const otherMarkdown = await readFile(path.join(root, "guides/game-design-studio/recipes", otherRecipe.id + ".md"), "utf8");
  const otherExcerpt = fencedCodeBlocks(markdownSections(section(otherMarkdown, "예상 결과"), 3).find(({ heading }) => heading === "대표 내용 예시").body, "md")[0];
  const wrongExcerpt = markdown.replace(
    example,
    otherExcerpt,
  );
  assert.throws(
    () => assertRecipeExpectedResult({ markdown: wrongExcerpt, recipe }),
    /new-game-gdd representative excerpt term: Player promise/,
  );
});

test("Studio manifest keeps unique global IDs and exactly six complete Studio diagram pairs", async () => {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  assert.equal(manifest.diagrams.length, 96, "global diagram count");
  assert.equal(new Set(manifest.diagrams.map(({ id }) => id)).size, manifest.diagrams.length, "global diagram IDs must be unique");
  const studio = manifest.diagrams.filter(({ scope }) => scope === "game-design-studio");
  assert.equal(studio.length, 6, "Studio diagram count");
  assert.deepEqual(studio.map(({ id }) => id).sort(), recipes.map(({ diagramId }) => diagramId).sort());
  for (const diagram of studio) {
    assert.equal(diagram.svg, "game-design-studio/" + diagram.id + ".svg");
    assert.equal(diagram.png, "game-design-studio/" + diagram.id + ".png");
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
