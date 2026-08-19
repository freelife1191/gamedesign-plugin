import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cp, lstat, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { importVendored } from "../lib/vendored.mjs";

const { isCompletePng, parseViewBox, pngDims } = await importVendored("skillstead", "scripts/render.mjs");
import { validateVisualizationState } from "../../products/game-design-career/plugin/skills/visualize-career-roadmap/scripts/validate-visualization-state.mjs";

const root = fileURLToPath(new URL("../..", import.meta.url));
const manifestPath = path.join(root, "guides/assets/diagram-manifest.json");
const manifestDir = path.dirname(manifestPath);
const routingPath = path.join(root, "products/game-design-career/plugin/references/routing.json");
const routing = JSON.parse(await readFile(routingPath, "utf8"));
const recipeContracts = Object.freeze(routing.recipeContracts ?? []);
const skillSourceRoot = path.join(root, "products/game-design-career/plugin/skills");
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
const recipes = recipeContracts.map((contract) => ({
  ...contract,
  skills: [contract.primarySkill, ...contract.relatedSkills],
  artifacts: contract.artifactContracts.map(({ path: artifactPath }) => `${artifactPath}/`),
  templates: contract.inputTemplateIds,
}));
const recipeResultHeadings = ["예상 파일 트리", "대표 내용 예시", "완료 기준", "포트폴리오·면접 활용", "읽는 순서"];
const templateSourceRoot = path.join(root, "products/game-design-career/plugin/assets/templates");

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
  const tree = byHeading.get("예상 파일 트리");
  for (const artifact of recipe.artifactContracts) {
    assert.ok(tree.includes(`${artifact.artifactId}/`), `${recipe.id} artifact-relative file tree: ${artifact.artifactId}`);
    const example = artifactExampleSegment(byHeading.get("대표 내용 예시"), artifact.artifactId);
    for (const field of artifact.fields) assert.ok(example.includes(`\`${field}\``), `${recipe.id} representative field: ${artifact.artifactId}.${field}`);
  }
  for (const { skill, tokens } of recipe.completionContracts) {
    for (const token of tokens) assert.ok(byHeading.get("완료 기준").includes(token), `${recipe.id} completion token: ${skill}.${token}`);
  }
  assert.ok(byHeading.get("포트폴리오·면접 활용").includes("portfolio"), recipe.id + " portfolio use");
  assert.ok(byHeading.get("포트폴리오·면접 활용").includes("interview"), recipe.id + " interview use");
}

async function recursiveTemplateInventory(directory, prefix = "") {
  const inventory = [];
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort((left, right) => left.name.localeCompare(right.name))) {
    const relative = `${prefix}${entry.name}`;
    if (entry.isDirectory()) {
      inventory.push(`${relative}/`);
      inventory.push(...await recursiveTemplateInventory(path.join(directory, entry.name), `${relative}/`));
    } else inventory.push(relative);
  }
  const rank = (item) => item === "content.md" ? 0
    : item === "evidence.yml" ? 1
      : item.startsWith("decisions/") ? 2
        : item.startsWith("assets/") ? 3
          : item === "export-manifest.yml" ? 5
            : 4;
  return inventory.sort((left, right) => rank(left) - rank(right) || left.length - right.length || left.localeCompare(right));
}

function templateLeafReadOrder(inventory) {
  return inventory.filter((item) => !item.endsWith("/"));
}

function artifactExampleSegment(example, artifactId) {
  const marker = `${artifactId}/content.md`;
  const start = example.indexOf(marker);
  if (start < 0) return example;
  const next = example.slice(start + marker.length).search(/`[a-z0-9-]+\/content\.md`/);
  return next < 0 ? example.slice(start) : example.slice(start, start + marker.length + next);
}

function markdownSectionBody(markdown, anchor) {
  const escaped = anchor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = markdown.match(new RegExp(`^## [^\\r\\n]* \\{#${escaped}\\}\\s*$([\\s\\S]*?)(?=^## |$(?![\\s\\S]))`, "m"));
  assert.ok(match, `missing markdown section anchor: ${anchor}`);
  return match[1];
}

function skillSection(markdown, headingPattern) {
  const match = markdown.match(new RegExp(`^## ${headingPattern}\\s*$\\n([\\s\\S]*?)(?=^## |$(?![\\s\\S]))`, "im"));
  assert.ok(match, `missing skill section: ${headingPattern}`);
  return match[1].trim();
}

async function assertRecipeMetadata(sourceRouting, {
  sourceRoot = templateSourceRoot,
  skillRoot = skillSourceRoot,
} = {}) {
  const contracts = sourceRouting.recipeContracts;
  assert.ok(Array.isArray(contracts), "routing.json recipeContracts array");
  assert.equal(contracts.length, 6, "routing.json recipe contract count");
  assert.deepEqual(contracts.map(({ id }) => id), [
    "role-learning-roadmap",
    "job-research-gap",
    "reverse-design",
    "portfolio-build-review",
    "interview-preparation",
    "junior-growth-transition",
  ], "ordered recipe contract IDs");
  assert.equal(new Set(contracts.map(({ id }) => id)).size, contracts.length, "unique recipe contract IDs");
  const installedSkills = new Set(sourceRouting.skillIds);
  for (const contract of contracts) {
    assert.equal(contract.path, `recipes/${contract.id}.md`, `${contract.id} canonical recipe path`);
    const recipePath = path.join(root, "guides/game-design-career", contract.path);
    const recipeStat = await lstat(recipePath);
    assert.ok(recipeStat.isFile() && !recipeStat.isSymbolicLink(), `${contract.id} canonical recipe source`);
    assert.ok(typeof contract.diagramId === "string" && contract.diagramId.length > 0, `${contract.id} diagram ID`);
    assert.ok(Array.isArray(contract.approvers) && contract.approvers.length > 0, `${contract.id} approvers`);
    assert.equal(new Set(contract.approvers).size, contract.approvers.length, `${contract.id} unique approvers`);
    assert.ok(installedSkills.has(contract.primarySkill), `${contract.id} installed primary skill`);
    assert.ok(Array.isArray(contract.relatedSkills), `${contract.id} related skills`);
    assert.equal(new Set(contract.relatedSkills).size, contract.relatedSkills.length, `${contract.id} unique related skills`);
    assert.ok(!contract.relatedSkills.includes(contract.primarySkill), `${contract.id} primary skill excluded from related skills`);
    for (const skill of contract.relatedSkills) assert.ok(installedSkills.has(skill), `${contract.id} installed related skill: ${skill}`);
    assert.ok(Array.isArray(contract.inputTemplateIds) && contract.inputTemplateIds.length > 0, `${contract.id} input templates`);
    assert.equal(new Set(contract.inputTemplateIds).size, contract.inputTemplateIds.length, `${contract.id} unique input templates`);
    for (const templateId of contract.inputTemplateIds) {
      const templateStat = await lstat(path.join(sourceRoot, templateId, "content.md"));
      assert.ok(templateStat.isFile() && !templateStat.isSymbolicLink(), `${contract.id} installed input template: ${templateId}`);
    }
    assert.ok(Array.isArray(contract.artifactContracts) && contract.artifactContracts.length > 0, `${contract.id} artifact contracts`);
    assert.equal(new Set(contract.artifactContracts.map(({ artifactId }) => artifactId)).size, contract.artifactContracts.length, `${contract.id} unique artifact IDs`);
    const recipeSkills = new Set([contract.primarySkill, ...contract.relatedSkills]);
    for (const artifact of contract.artifactContracts) {
      assert.equal(artifact.expectedOutputId, artifact.artifactId, `${contract.id} artifact/output identity: ${artifact.artifactId}`);
      assert.equal(artifact.path, `game-design-career/<career-id>/${artifact.artifactId}`, `${contract.id} canonical artifact path: ${artifact.artifactId}`);
      assert.ok(recipeSkills.has(artifact.ownerSkill), `${contract.id} output owner is a recipe skill: ${artifact.ownerSkill}`);
      assert.ok(Array.isArray(artifact.fields) && artifact.fields.length > 0, `${contract.id} artifact fields: ${artifact.artifactId}`);
      assert.equal(new Set(artifact.fields).size, artifact.fields.length, `${contract.id} unique artifact fields: ${artifact.artifactId}`);
      const template = await readFile(path.join(sourceRoot, artifact.artifactId, "content.md"), "utf8");
      const workingRecord = markdownSectionBody(template, "working-record");
      for (const field of artifact.fields) assert.match(workingRecord, new RegExp("`" + field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "`"), `${contract.id} source-owned Working Record field: ${artifact.artifactId}.${field}`);
      const skillSource = await readFile(path.join(skillRoot, artifact.ownerSkill, "SKILL.md"), "utf8");
      const outputContract = skillSection(skillSource, "Output contract");
      assert.match(outputContract, new RegExp("`" + artifact.expectedOutputId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "`"), `${contract.id} source-owned expected output: ${artifact.expectedOutputId}`);
    }
    assert.ok(Array.isArray(contract.completionContracts) && contract.completionContracts.length > 0, `${contract.id} completion contracts`);
    assert.equal(new Set(contract.completionContracts.map(({ skill }) => skill)).size, contract.completionContracts.length, `${contract.id} unique completion skills`);
    for (const completion of contract.completionContracts) {
      assert.ok(recipeSkills.has(completion.skill), `${contract.id} completion skill is a recipe skill: ${completion.skill}`);
      assert.ok(Array.isArray(completion.tokens) && completion.tokens.length > 0, `${contract.id} completion tokens: ${completion.skill}`);
      assert.equal(new Set(completion.tokens).size, completion.tokens.length, `${contract.id} unique completion tokens: ${completion.skill}`);
      const source = await readFile(path.join(skillRoot, completion.skill, "SKILL.md"), "utf8");
      const sourceCompletion = skillSection(source, "Completion(?: Criteria)?");
      for (const token of completion.tokens) {
        assert.ok(typeof token === "string" && token.trim().length > 0, `${contract.id} nonempty completion token: ${completion.skill}`);
        assert.ok(sourceCompletion.includes(token), `${contract.id} source-owned Completion token: ${completion.skill}.${token}`);
      }
    }
    for (const ownerSkill of new Set(contract.artifactContracts.map(({ ownerSkill }) => ownerSkill))) {
      assert.ok(contract.completionContracts.some(({ skill }) => skill === ownerSkill), `${contract.id} output owner Completion source: ${ownerSkill}`);
    }
  }
}

async function assertRecipeTemplateResult(recipe, markdown, sourceRoot = templateSourceRoot) {
  const result = section(markdown, "예상 결과");
  const byHeading = new Map(h3Sections(result).map(({ heading, body }) => [heading, body]));
  const expected = recipe.artifactContracts;
  for (const { artifactId, expectedOutputId, fields } of expected) {
    const templateDirectory = path.join(sourceRoot, artifactId);
    const template = await readFile(path.join(templateDirectory, "content.md"), "utf8");
    for (const field of fields) assert.match(template, new RegExp("`" + field + "`"), recipe.id + " canonical template field: " + artifactId + "." + field);
    const inventory = await recursiveTemplateInventory(templateDirectory);
    const tree = byHeading.get("예상 파일 트리");
    const artifactTreeStart = tree.indexOf(`${artifactId}/`);
    assert.ok(artifactTreeStart >= 0, recipe.id + " artifact subtree: " + artifactId);
    assert.ok(tree.includes(`${expectedOutputId}/`), `${recipe.id} expected output token: ${expectedOutputId}`);
    const nextArtifactStart = expected.map(({ artifactId: candidate }) => tree.indexOf(`${candidate}/`, artifactTreeStart + artifactId.length + 1)).filter((index) => index > artifactTreeStart).sort((left, right) => left - right)[0] ?? tree.length;
    const artifactTree = tree.slice(artifactTreeStart, nextArtifactStart);
    for (const item of inventory) {
      const token = item.endsWith("/") ? item.slice(0, -1) + "/" : path.basename(item);
      const requiredCount = inventory.filter((candidate) => (candidate.endsWith("/") ? candidate.slice(0, -1) + "/" : path.basename(candidate)) === token).length;
      assert.ok(artifactTree.split(token).length - 1 >= requiredCount, recipe.id + " recursive template inventory item: " + artifactId + "/" + item);
    }
    const exampleSegment = artifactExampleSegment(byHeading.get("대표 내용 예시"), artifactId);
    for (const field of fields) assert.ok(exampleSegment.includes("`" + field + "`"), recipe.id + " representative canonical field: " + artifactId + "." + field);
    const order = templateLeafReadOrder(inventory).map((item) => `game-design-career/<career-id>/${artifactId}/${item}`).join(" → ");
    assert.ok(byHeading.get("읽는 순서").includes(order), recipe.id + " canonical artifact read order: " + artifactId);
  }
  const completion = byHeading.get("완료 기준");
  for (const { skill, tokens } of recipe.completionContracts) {
    for (const token of tokens) assert.ok(completion.includes(token), `${recipe.id} source-backed completion criterion: ${skill}.${token}`);
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

test("Career routing owns all six ordered recipe source contracts", async () => {
  await assertRecipeMetadata(routing);
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
  assert.doesNotThrow(() => assertRecipeResult(recipe, markdown));
  const entries = h3Sections(result);
  const swappedHeadings = result
    .replace("### 예상 파일 트리", "### __TREE__")
    .replace("### 대표 내용 예시", "### 예상 파일 트리")
    .replace("### __TREE__", "### 대표 내용 예시");
  assert.throws(() => assertRecipeResult(recipe, markdown.replace(result, swappedHeadings)), /heading order/);

  const example = entries.find(({ heading }) => heading === "대표 내용 예시");
  const completion = entries.find(({ heading }) => heading === "완료 기준");
  const semanticSwap = result
    .replace(example.body, "__EXAMPLE__")
    .replace(completion.body, example.body)
    .replace("__EXAMPLE__", completion.body);
  assert.throws(() => assertRecipeResult(recipe, markdown.replace(result, semanticSwap)), /representative field|completion token/);
});

test("Career recipe results derive every artifact, field, and read order from template sources", async () => {
  for (const recipe of recipes) {
    const markdown = await readFile(path.join(root, "guides/game-design-career/recipes", recipe.id + ".md"), "utf8");
    await assertRecipeTemplateResult(recipe, markdown);
  }
});

test("Career recipe source contracts reject every wrong-valid field, artifact, and read-order mutation", async () => {
  const allArtifactIds = [...new Set(recipes.flatMap(({ artifactContracts }) => artifactContracts.map(({ artifactId }) => artifactId)))];
  const allFields = [...new Set(recipes.flatMap(({ artifactContracts }) => artifactContracts.flatMap(({ fields }) => fields)))];
  const allCompletionTokens = [...new Set(recipes.flatMap(({ completionContracts }) => completionContracts.flatMap(({ tokens }) => tokens)))];
  for (const recipe of recipes) {
    const markdown = await readFile(path.join(root, "guides/game-design-career/recipes", recipe.id + ".md"), "utf8");
    const result = section(markdown, "예상 결과");
    const entries = new Map(h3Sections(result).map(({ heading, body }) => [heading, body]));
    for (const { artifactId, fields } of recipe.artifactContracts) {
      const wrongArtifact = allArtifactIds.find((candidate) => !recipe.artifactContracts.some(({ artifactId: expected }) => expected === candidate));
      await assert.rejects(() => assertRecipeTemplateResult(recipe, markdown.replace(result, result.replaceAll(artifactId, ""))), /artifact subtree|canonical artifact read order/, `${recipe.id} ${artifactId} output omission`);
      await assert.rejects(() => assertRecipeTemplateResult(recipe, markdown.replace(result, result.replaceAll(artifactId, wrongArtifact))), /artifact subtree|canonical artifact read order/, `${recipe.id} ${artifactId} wrong-valid output mutation`);
      for (const field of fields) {
        const example = entries.get("대표 내용 예시");
        const segment = artifactExampleSegment(example, artifactId);
        const wrongField = allFields.find((candidate) => !fields.includes(candidate));
        await assert.rejects(() => assertRecipeTemplateResult(recipe, markdown.replace(example, example.replace(segment, segment.replace("`" + field + "`", "")))), /representative canonical field/, `${recipe.id} ${artifactId}.${field} omission`);
        await assert.rejects(() => assertRecipeTemplateResult(recipe, markdown.replace(example, example.replace(segment, segment.replace("`" + field + "`", "`" + wrongField + "`")))), /representative canonical field/, `${recipe.id} ${artifactId}.${field} wrong-valid mutation`);
      }
      const inventory = await recursiveTemplateInventory(path.join(templateSourceRoot, artifactId));
      const readOrder = templateLeafReadOrder(inventory).map((item) => `game-design-career/<career-id>/${artifactId}/${item}`);
      for (const item of inventory) {
        const exactPath = `game-design-career/<career-id>/${artifactId}/${item}`;
        const token = item.endsWith("/") ? item : exactPath;
        await assert.rejects(() => assertRecipeTemplateResult(recipe, markdown.replace(result, result.replace(token, ""))), /recursive template inventory item|canonical artifact read order/, `${recipe.id} ${artifactId}/${item} inventory omission`);
      }
      for (let index = 0; index < readOrder.length - 1; index += 1) {
        const swapped = [...readOrder];
        [swapped[index], swapped[index + 1]] = [swapped[index + 1], swapped[index]];
        await assert.rejects(() => assertRecipeTemplateResult(recipe, markdown.replace(readOrder.join(" → "), swapped.join(" → "))), /canonical artifact read order/, `${recipe.id} ${artifactId} adjacent read-order mutation ${index}`);
      }
    }
    for (const { skill, tokens } of recipe.completionContracts) {
      for (const token of tokens) {
        const wrongToken = allCompletionTokens.find((candidate) => !tokens.includes(candidate));
        await assert.rejects(
          () => assertRecipeTemplateResult(recipe, markdown.replace(entries.get("완료 기준"), entries.get("완료 기준").replace(token, ""))),
          /source-backed completion criterion/,
          `${recipe.id} completion criterion omission: ${skill}.${token}`,
        );
        await assert.rejects(
          () => assertRecipeTemplateResult(recipe, markdown.replace(entries.get("완료 기준"), entries.get("완료 기준").replace(token, wrongToken))),
          /source-backed completion criterion/,
          `${recipe.id} completion criterion wrong-valid swap: ${skill}.${token}`,
        );
      }
    }
  }
});

test("Career recipe metadata rejects malformed artifact, skill, and completion relations", async () => {
  const mutate = (change) => {
    const sourceRouting = structuredClone(routing);
    change(sourceRouting);
    return sourceRouting;
  };
  for (const [label, change, error] of [
    ["missing recipe", (sourceRouting) => sourceRouting.recipeContracts.pop(), /recipe contract count/],
    ["duplicate recipe", (sourceRouting) => { sourceRouting.recipeContracts[1].id = sourceRouting.recipeContracts[0].id; }, /ordered recipe contract IDs|unique recipe contract IDs/],
    ["unknown primary skill", (sourceRouting) => { sourceRouting.recipeContracts[0].primarySkill = "not-installed"; }, /installed primary skill/],
    ["unknown related skill", (sourceRouting) => { sourceRouting.recipeContracts[0].relatedSkills[0] = "not-installed"; }, /installed related skill/],
    ["artifact output mismatch", (sourceRouting) => { sourceRouting.recipeContracts[0].artifactContracts[0].expectedOutputId = "learning-roadmap"; }, /artifact\/output identity/],
    ["duplicate artifact field", (sourceRouting) => { const fields = sourceRouting.recipeContracts[0].artifactContracts[0].fields; fields.push(fields[0]); }, /unique artifact fields/],
    ["empty completion token", (sourceRouting) => { sourceRouting.recipeContracts[0].completionContracts[0].tokens = [""]; }, /nonempty completion token/],
    ["duplicate completion token", (sourceRouting) => { const tokens = sourceRouting.recipeContracts[0].completionContracts[0].tokens; tokens.push(tokens[0]); }, /unique completion tokens/],
    ["unknown completion token", (sourceRouting) => { sourceRouting.recipeContracts[0].completionContracts[0].tokens = ["falsifiable"]; }, /source-owned Completion token/],
  ]) await assert.rejects(() => assertRecipeMetadata(mutate(change)), error, label);
});

test("Career recipe rejects every template inventory and Working Record source mutation", async () => {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "career-recipe-templates-"));
  const sourceRoot = path.join(temporaryRoot, "templates");
  const allFields = [...new Set(recipes.flatMap(({ artifactContracts }) => artifactContracts.flatMap(({ fields }) => fields)))];
  try {
    await cp(templateSourceRoot, sourceRoot, { recursive: true });
    for (const recipe of recipes) {
      const markdown = await readFile(path.join(root, "guides/game-design-career/recipes", recipe.id + ".md"), "utf8");
      for (const artifact of recipe.artifactContracts) {
        const artifactRoot = path.join(sourceRoot, artifact.artifactId);
        const addedFile = path.join(artifactRoot, "new-required-record.md");
        await writeFile(addedFile, "# Required record\n", "utf8");
        await assert.rejects(() => assertRecipeTemplateResult(recipe, markdown, sourceRoot), /recursive template inventory item|canonical artifact read order/, `${recipe.id} ${artifact.artifactId} new source file`);
        await rm(addedFile);

        const addedDirectory = path.join(artifactRoot, "new-required-directory");
        await mkdir(addedDirectory);
        await assert.rejects(() => assertRecipeTemplateResult(recipe, markdown, sourceRoot), /recursive template inventory item/, `${recipe.id} ${artifact.artifactId} empty source directory`);
        await rm(addedDirectory, { recursive: true });

        const contentPath = path.join(artifactRoot, "content.md");
        const canonical = await readFile(contentPath, "utf8");
        for (const field of artifact.fields) {
          const wrongField = allFields.find((candidate) => !artifact.fields.includes(candidate));
          const fieldPattern = new RegExp("^\\| `" + field.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&") + "` \\|", "mu");
          assert.match(canonical, fieldPattern, `${recipe.id} Working Record row precondition: ${artifact.artifactId}.${field}`);
          const mutated = canonical.replace(fieldPattern, `| \`${wrongField}\` |`);
          assert.notEqual(mutated, canonical, `${recipe.id} Working Record mutation precondition: ${artifact.artifactId}.${field}`);
          await writeFile(contentPath, mutated, "utf8");
          await assert.rejects(() => assertRecipeMetadata(routing, { sourceRoot }), /source-owned Working Record field/, `${recipe.id} ${artifact.artifactId}.${field} Working Record mutation`);
          await writeFile(contentPath, canonical, "utf8");
        }
      }
    }
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("Career recipe rejects every product SKILL Output and Completion source mutation", async () => {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "career-recipe-skills-"));
  const skillRoot = path.join(temporaryRoot, "skills");
  const allOutputIds = [...new Set(recipes.flatMap(({ artifactContracts }) => artifactContracts.map(({ expectedOutputId }) => expectedOutputId)))];
  const allCompletionTokens = [...new Set(recipes.flatMap(({ completionContracts }) => completionContracts.flatMap(({ tokens }) => tokens)))];
  try {
    await cp(skillSourceRoot, skillRoot, { recursive: true });
    for (const artifact of new Map(recipes.flatMap(({ artifactContracts }) => artifactContracts).map((entry) => [`${entry.ownerSkill}:${entry.expectedOutputId}`, entry])).values()) {
      const sourcePath = path.join(skillRoot, artifact.ownerSkill, "SKILL.md");
      const canonical = await readFile(sourcePath, "utf8");
      const outputSection = skillSection(canonical, "Output contract");
      const wrongOutput = allOutputIds.find((candidate) => candidate !== artifact.expectedOutputId && !outputSection.includes(`\`${candidate}\``));
      for (const [label, replacement] of [["omission", ""], ["wrong-valid swap", `\`${wrongOutput}\``]]) {
        const mutatedSection = outputSection.replace(`\`${artifact.expectedOutputId}\``, replacement);
        assert.notEqual(mutatedSection, outputSection, `Output mutation precondition: ${artifact.ownerSkill}.${artifact.expectedOutputId}`);
        await writeFile(sourcePath, canonical.replace(outputSection, mutatedSection), "utf8");
        await assert.rejects(() => assertRecipeMetadata(routing, { skillRoot }), /source-owned expected output/, `${artifact.ownerSkill}.${artifact.expectedOutputId} Output ${label}`);
        await writeFile(sourcePath, canonical, "utf8");
      }
    }

    const uniqueCompletionContracts = new Map();
    for (const recipe of recipes) for (const completion of recipe.completionContracts) {
      for (const token of completion.tokens) uniqueCompletionContracts.set(`${completion.skill}:${token}`, { skill: completion.skill, token });
    }
    for (const { skill, token } of uniqueCompletionContracts.values()) {
      const sourcePath = path.join(skillRoot, skill, "SKILL.md");
      const canonical = await readFile(sourcePath, "utf8");
      const completionSection = skillSection(canonical, "Completion(?: Criteria)?");
      const wrongToken = allCompletionTokens.find((candidate) => candidate !== token && !completionSection.includes(candidate));
      for (const [label, replacement] of [["omission", ""], ["wrong-valid swap", wrongToken]]) {
        const mutatedSection = completionSection.replace(token, replacement);
        assert.notEqual(mutatedSection, completionSection, `Completion mutation precondition: ${skill}.${token}`);
        await writeFile(sourcePath, canonical.replace(completionSection, mutatedSection), "utf8");
        await assert.rejects(() => assertRecipeMetadata(routing, { skillRoot }), /source-owned Completion token/, `${skill}.${token} Completion ${label}`);
        await writeFile(sourcePath, canonical, "utf8");
      }
    }
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("Career manifest keeps unique global IDs and exactly six complete Career diagram pairs", async () => {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  assert.equal(manifest.diagrams.length, 96, "global diagram count");
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
