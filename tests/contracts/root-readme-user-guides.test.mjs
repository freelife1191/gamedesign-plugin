import assert from "node:assert/strict";
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
  const namespace = `$game-design-${entry.product === "career" ? "career" : "studio"}:`;
  assert.match(promptBlocks[0], new RegExp(`${escapeRegExp(namespace + entry.skill)}(?:\\s|$)`, "u"), `${entry.id}: fenced prompt invokes the source-bound skill command`);
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

async function assertSkillInventoryTable(markdown, product) {
  const sourceProduct = sourceProductId(product);
  const heading = `${sourceProduct === "studio" ? "Studio" : "Career"} 설치 스킬 15개`;
  const rows = assertTableShape(markdown, heading, ["설치 스킬 ID", "직접 호출", "역할·결과", "상세 가이드"], `${product} skills`);
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
  for (const row of rows) {
    assert.equal(row.length, 4, `${product}: skill row has four cells`);
    const [idCell, command, role, guide] = row;
    const match = /^`([a-z0-9-]+)`$/u.exec(idCell);
    assert.ok(match, `${product}: skill ID cell is a literal installed skill ID`);
    const id = match[1];
    actual.push(id);
    assert.equal(command, `\`$game-design-${sourceProduct}:${id}\``, `${product}:${id}: exact direct command`);
    assert.ok(role.length > 0, `${product}:${id}: role/result description is non-empty`);
    await assertResolvableRowLink(path.join(root, "README.md"), guide, `guides/${product}/skills/${id}.md`, `${product}:${id}`);
  }
  for (const id of expected) assert.ok(actual.includes(id), `${product}:${id}: installed skill is missing from README inventory`);
  assert.equal(new Set(actual).size, actual.length, `${product}: duplicate skill ID in README inventory`);
  for (const id of actual) assert.ok(expected.includes(id), `${product}:${id}: invented or cross-product skill ID in README inventory`);
  assert.deepEqual(actual, expected, `${product}: README skill inventory preserves installed snapshot order`);
  const vendorRow = rows.find(([idCell]) => idCell === "`svg-infographic`");
  assert.ok(vendorRow, `${product}: vendored svg-infographic row exists`);
  assert.match(vendorRow[2], /vendored|번들/iu, `${product}: svg-infographic is identified as a vendored installed skill`);
  assert.doesNotMatch(vendorRow[2], /제품 source|제품 원본/u, `${product}: svg-infographic must not be presented as a product source skill`);
  assert.doesNotMatch(markdown, /(?:14개[^\n.]{0,100}(?:제품|source)[^\n.]{0,100}svg-infographic|svg-infographic[^\n.]{0,100}14개[^\n.]{0,100}(?:제품|source))/iu, `${product}: README must not claim vendored svg-infographic is one of 14 product source skills`);
}

async function assertAgentInventoryTable(markdown, product) {
  const sourceProduct = sourceProductId(product);
  const heading = `${sourceProduct === "studio" ? "Studio" : "Career"} 에이전트 9개`;
  const rows = assertTableShape(markdown, heading, ["에이전트 ID", "역할", "검토 초점", "호출 경계", "역할 문서"], `${product} agents`);
  const expected = await sourceAgentIds(product);
  assert.equal(expected.length, 9, `${product}: source product owns exactly nine agents`);
  const generated = (await readdir(path.join(root, "plugins", product, "agents")))
    .filter((name) => name.endsWith(".md"))
    .map((name) => name.slice(0, -3))
    .sort();
  assert.deepEqual(generated, expected, `${product}: generated agent snapshot matches source inventory`);
  const actual = [];
  for (const row of rows) {
    assert.equal(row.length, 5, `${product}: agent row has five cells`);
    const [idCell, role, focus, boundary, document] = row;
    const match = /^`([a-z0-9-]+)`$/u.exec(idCell);
    assert.ok(match, `${product}: agent ID cell is a literal agent ID`);
    const id = match[1];
    actual.push(id);
    assert.ok(role.length > 0, `${product}:${id}: role is non-empty`);
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
  const rows = assertTableShape(markdown, "결과 예시 6종", ["결과 ID", "핵심 파일", "선택 자산", "읽는 순서", "승인 전 보류 경계"], "result examples");
  const inventories = await Promise.all(products.map((product) => collectProductInventory(root, product)));
  const templateIds = new Set(inventories.flatMap((inventory) => inventory.templateIds));
  const manifest = JSON.parse(await readFile(path.join(root, "guides", "use-cases", "use-case-manifest.json"), "utf8"));
  const manifestOutputs = new Set(manifest.cases.flatMap((entry) => entry.outputs));
  const actual = [];
  for (const row of rows) {
    assert.equal(row.length, 5, "result example row has five cells");
    const [idCell, coreFile, optionalAsset, readOrder, holdBoundary] = row;
    const match = /^`([a-z0-9-]+)`$/u.exec(idCell);
    assert.ok(match, "result example ID is a literal");
    const id = match[1];
    actual.push(id);
    assert.match(coreFile, /content\.md/u, `${id}: core file is explicit`);
    assert.ok(optionalAsset.length > 0, `${id}: optional asset is explicit`);
    assert.match(readOrder, /content\.md[\s\S]*evidence\.yml[\s\S]*export-manifest\.yml/u, `${id}: reading order is explicit`);
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
  if (validateLinks) await assertRootLinks(markdown);
}

async function buildValidStructuredReadmeFixture() {
  const catalog = await loadPromptTemplateCatalog({ repoRoot: root });
  const cards = Object.values(representativeCards).flat().map((id) => {
    const entry = catalog.byId.get(id);
    assert.ok(entry, `${id}: fixture requires production catalog entry`);
    const namespace = entry.product === "career" ? "career" : "studio";
    return [
      `<details data-prompt-id="${id}">`,
      `<summary>${id}</summary>`,
      "#### 사용 시점",
      entry.when_to_use,
      "#### 준비 입력",
      entry.required_inputs.join(", "),
      "#### 복사할 요청문",
      "```text",
      `$game-design-${namespace}:${entry.skill} fixture-request`,
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
  const inventoryTables = [];
  for (const product of products) {
    const productLabel = product === "game-design-studio" ? "Studio" : "Career";
    const namespace = product === "game-design-studio" ? "studio" : "career";
    const inventory = await collectProductInventory(root, product);
    inventoryTables.push(
      `### ${productLabel} 설치 스킬 15개`,
      "| 설치 스킬 ID | 직접 호출 | 역할·결과 | 상세 가이드 |",
      "| --- | --- | --- | --- |",
      ...inventory.skillIds.map((id) => `| \`${id}\` | \`$game-design-${namespace}:${id}\` | ${id === "svg-infographic" ? "vendored 시각화 결과" : "역할과 결과"} | [상세 가이드](guides/${product}/skills/${id}.md) |`),
      "",
      `### ${productLabel} 에이전트 9개`,
      "| 에이전트 ID | 역할 | 검토 초점 | 호출 경계 | 역할 문서 |",
      "| --- | --- | --- | --- | --- |",
      ...(await sourceAgentIds(product)).map((id) => `| \`${id}\` | 역할 | 검토 초점 | 오케스트레이터가 전문가에게 위임 | [역할 문서](plugins/${product}/agents/${id}.md) |`),
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
    "## 5분 안에 첫 결과 만들기",
    "첫 결과 안내",
    "",
    "## 케이스별 프롬프트로 시작하기",
    ...cards,
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
    "| 결과 ID | 핵심 파일 | 선택 자산 | 읽는 순서 | 승인 전 보류 경계 |",
    "| --- | --- | --- | --- | --- |",
    ...resultExampleIds.map((id) => `| \`${id}\` | \`content.md\` | 선택 자산 | \`content.md\` → \`evidence.yml\` → \`export-manifest.yml\` | 사람 승인 전 보류하며 자동 승인되지 않습니다. |`),
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
  for (const [label, mutated, id] of [
    ["missing card label", missingLabel, affectedCard],
    ["duplicate prompt ID", duplicateId, affectedCard],
    ["wrong skill chain", changedSkill, affectedCard],
    ["reversed read order", reversedReadOrder, affectedCard],
    ["missing human approval", removedApproval, affectedCard],
    ["invented prompt card", inventedCard, "studio:case:INVENTED"],
  ]) await assertRejectedForId(() => assertRepresentativePromptCards(mutated), id, label);

  const product = "game-design-studio";
  const removedSkill = readme.replace("| `define-game-vision`", "| `missing-skill`");
  const duplicateSkill = readme.replace("| `define-game-vision`", "| `apply-document-quality-profile`");
  const crossProductSkill = readme.replace("| `define-game-vision`", "| `map-game-design-career`");
  const inventedAgent = readme.replace("| `lead-game-designer`", "| `invented-agent`");
  for (const [label, mutated, id, validate] of [
    ["missing skill", removedSkill, "define-game-vision", assertSkillInventoryTable],
    ["duplicate skill", duplicateSkill, "apply-document-quality-profile", assertSkillInventoryTable],
    ["cross-product skill", crossProductSkill, "map-game-design-career", assertSkillInventoryTable],
    ["invented agent", inventedAgent, "invented-agent", assertAgentInventoryTable],
  ]) await assertRejectedForId(() => validate(mutated, product), id, label);

  const directManifestEdit = readme.replace(`plugins/${product}/`, `plugins/${product}/\nBUILD-MANIFEST.json을 직접 수정합니다.\n`);
  await assertRejectedForId(() => assertPluginTreeContract(directManifestEdit, product), product, "direct BUILD-MANIFEST edit instruction");

  const autoApprovedResult = readme.replace("사람 승인 전 보류하며 자동 승인되지 않습니다.", "이미지와 파생 문서, 검토 결과는 자동 승인됩니다.");
  await assertRejectedForId(() => assertResultExamples(autoApprovedResult), "game-design-brief", "automatic approval in result example");
  const autoApprovedSafety = readme.replace("이미지·파생 문서·검토 결과는 자동 승인되지 않습니다.", "이미지·파생 문서·검토 결과는 자동 승인됩니다.");
  await assertRejectedForId(() => Promise.resolve(assertSafetyBoundary(autoApprovedSafety)), "safety-boundary", "automatic approval in safety boundary");
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
