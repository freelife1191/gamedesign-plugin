import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { buildProduct } from "../../../tooling/lib/build-product.mjs";
import { collectProductInventory } from "../../../tooling/lib/user-guides.mjs";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const pluginRoot = path.join(repoRoot, "products/game-design-career/plugin");
const readmePath = path.join(pluginRoot, "README.md");

const skillIds = [
  "orchestrate-game-design-career",
  "apply-document-quality-profile",
  "map-game-design-career",
  "research-game-design-jobs",
  "build-game-design-portfolio",
  "reverse-engineer-game-design",
  "practice-game-design-interview",
  "review-game-design-portfolio",
  "plan-junior-growth",
  "visualize-career-roadmap",
  "export-career-documents",
  "plan-image-assets",
  "generate-image-assets",
  "review-image-assets",
];

const roleIds = [
  "career-strategist",
  "document-quality-editor",
  "game-design-mentor",
  "portfolio-reviewer",
  "reverse-design-critic",
  "interview-coach",
  "evidence-auditor",
];

const imageRoleIds = ["art-brief-director", "visual-asset-reviewer"];

const templateIds = [
  "career-stage-goal",
  "game-design-role-map",
  "competency-matrix",
  "job-posting-evidence",
  "portfolio-project-brief",
  "reverse-design-document",
  "five-axis-review",
  "interview-question-answer-log",
  "junior-growth-review",
  "transition-readiness",
  "learning-roadmap",
  "portfolio-backlog",
  "creative-design-portfolio",
  "introduction-motivation",
  "game-analysis-report",
];

const qualityProfileIds = [
  "career-stage-role-map",
  "competency-matrix",
  "learning-roadmap",
  "job-posting-evidence",
  "reverse-design-document",
  "game-analysis-report",
  "portfolio-project-brief",
  "portfolio-case-study",
  "portfolio-review-backlog",
  "interview-question-answer-report",
  "junior-growth-review",
  "transition-readiness",
  "recruiter-portfolio-presentation",
];

const topLevelScriptIds = [
  "build-image-asset-plan.mjs",
  "capability-probe.mjs",
  "compile-image-prompts.mjs",
  "data-only-snapshot.mjs",
  "generate-openai-images.mjs",
  "quality-source-anchors.mjs",
  "resolve-quality-profile.mjs",
  "run-image-asset-workflow.mjs",
  "stop-artifact-review.mjs",
  "validate-artifact.mjs",
  "validate-image-assets.mjs",
  "validate-image-config.mjs",
  "validate-quality-profile.mjs",
  "validate-reference-preset.mjs",
];

const documentQualityPaths = [
  "indexes/career.json",
  "indexes/studio.json",
  "profiles/career/",
  "profiles/studio/",
  "overlays/",
  "presets/",
  "render-contracts/long-form-document.json",
  "render-contracts/presentation.json",
  "render-contracts/review-report.json",
  "schema/quality-profile-selection.schema.json",
  "schema/quality-profile.schema.json",
  "schema/reference-preset.schema.json",
];

function tableIds(markdown, heading) {
  const start = markdown.indexOf(`## ${heading}`);
  assert.notEqual(start, -1, `missing section: ${heading}`);
  const section = markdown.slice(start + heading.length + 3).split("\n## ")[0];
  return [...section.matchAll(/^\| `([^`]+)` \|/gm)].map((match) => match[1]);
}

const representativeCareerCaseIds = ["CA-T01", "CA-T04", "CA-T05", "CA-C05", "CA-C06", "CA-C08"];

const careerGoalOutputLayers = new Map([
  ["직무 탐색·학습", { minimum: ["game-design-role-map", "learning-roadmap"], competency: { optionalHeading: "CA-C01 기획 직무와 전문 분야 탐색", expandedHeading: "CA-C01 기획 직무와 전문 분야 탐색", reviewHeading: "CA-C01 기획 직무와 전문 분야 탐색", optional: ["review", "evidence"], expanded: ["review", "evidence", "deliverable"], reviewers: ["사용자", "멘토"] } }],
  ["역기획", { minimum: ["reverse-design-document"], competency: { optionalHeading: "CA-C02 게임 분석 언어와 관찰·추론 분리", expandedHeading: "CA-C02 게임 분석 언어와 관찰·추론 분리", reviewHeading: "CA-C02 게임 분석 언어와 관찰·추론 분리", optional: [], expanded: ["review", "deliverable", "rights"], reviewers: ["작성자", "멘토"] } }],
  ["창작 포트폴리오", { minimum: ["creative-design-portfolio"], competency: { optionalHeading: "CA-C06 창작 기획 포트폴리오", expandedHeading: "CA-C06 창작 기획 포트폴리오", reviewHeading: "CA-C06 창작 기획 포트폴리오", optional: ["review"], expanded: ["review", "deliverable", "rights"], reviewers: ["작성자", "portfolio reviewer", "public-rights reviewer"] } }],
  ["포트폴리오 검토", { minimum: ["five-axis-review"], competency: { optionalHeading: "CA-C07 포트폴리오 검토·수정·발표", expandedHeading: "CA-C07 포트폴리오 검토·수정·발표", reviewHeading: "CA-C07 포트폴리오 검토·수정·발표", optional: ["rights"], expanded: ["review", "deliverable"], reviewers: ["작성자", "portfolio reviewer", "public-rights reviewer", "멘토"] } }],
  ["면접", { minimum: ["interview-question-answer-log"], competency: { optionalHeading: "CA-C08 면접·주니어 성장·직무 전환", expandedHeading: "CA-C08 면접·주니어 성장·직무 전환", reviewHeading: "CA-C08 면접·주니어 성장·직무 전환", optional: ["visual", "evidence", "preparation"], expanded: ["review", "evidence", "deliverable", "rights"], reviewers: ["작성자", "멘토", "manager", "career reviewer", "public-rights reviewer"] } }],
  ["성장·전환", { minimum: ["junior-growth-review", "transition-readiness"], competency: { optionalHeading: "CA-C03 현재 채용공고 조사", expandedHeading: "CA-C08 면접·주니어 성장·직무 전환", reviewHeading: "CA-C08 면접·주니어 성장·직무 전환", optional: ["evidence"], expanded: ["rights"], reviewers: ["manager", "career reviewer"] } }],
]);

const careerRepositoryCheckoutGuides = Object.freeze([
  "guides/game-design-career/use-cases/README.md",
  "guides/game-design-career/use-cases/competency-paths.md",
  "guides/game-design-career/use-cases/concept-scenarios.md",
  "guides/game-design-career/use-cases/skill-workbench.md",
  "guides/game-design-career/faq.md",
  "guides/use-cases/output-catalog.md",
]);

function normalizeTableCell(value) {
  return value.trim().replace(/\s+/gu, " ");
}

function readmeSection(markdown, heading) {
  const marker = `## ${heading}\n`;
  const start = markdown.indexOf(marker);
  assert.notEqual(start, -1, `missing README section: ${heading}`);
  const bodyStart = start + marker.length;
  const next = markdown.indexOf("\n## ", bodyStart);
  return markdown.slice(bodyStart, next === -1 ? markdown.length : next).trim();
}

function extractMarkdownTable(markdown, heading) {
  const lines = readmeSection(markdown, heading).split("\n");
  const headerIndex = lines.findIndex((line) => line.startsWith("|"));
  assert.notEqual(headerIndex, -1, `${heading}: missing table`);
  const parseRow = (line) => line.split("|").slice(1, -1).map(normalizeTableCell);
  return {
    headers: parseRow(lines[headerIndex]),
    rows: lines.slice(headerIndex + 2).filter((line) => line.startsWith("|")).map(parseRow),
  };
}

function extractCaseCard(markdown, caseId) {
  const match = new RegExp(`^## ${caseId} .+$`, "mu").exec(markdown);
  assert.ok(match, `${caseId}: canonical case card`);
  const bodyStart = match.index + match[0].length;
  const next = markdown.slice(bodyStart).search(/^## /mu);
  return markdown.slice(bodyStart, next === -1 ? markdown.length : bodyStart + next).trim();
}

function extractCaseSubsection(card, heading) {
  const marker = `### ${heading}\n`;
  const start = card.indexOf(marker);
  assert.notEqual(start, -1, `${heading}: canonical case subsection`);
  const bodyStart = start + marker.length;
  const next = card.indexOf("\n### ", bodyStart);
  return card.slice(bodyStart, next === -1 ? card.length : next).trim();
}

function codeBlock(section, label) {
  const match = /^```text\n([\s\S]*?)\n```$/mu.exec(section);
  assert.ok(match, `${label}: text code block`);
  return normalizeTableCell(match[1]);
}

function outputContractIds(skillSource) {
  if (!/^## Output Contract$/mu.test(skillSource)) return new Set();
  const marker = "## Output Contract\n";
  const start = skillSource.indexOf(marker);
  const bodyStart = start + marker.length;
  const next = skillSource.indexOf("\n## ", bodyStart);
  const outputContract = skillSource.slice(bodyStart, next === -1 ? skillSource.length : next);
  return new Set([...outputContract.matchAll(/`([a-z0-9-]+)`/gu)].map((match) => match[1]));
}

function routingResultContracts(routing) {
  return [
    ...routing.recipeContracts.flatMap((recipe) => recipe.artifactContracts.map((contract) => ({
      id: contract.expectedOutputId,
      owner: contract.ownerSkill,
      path: contract.path,
    }))),
    ...routing.faqContracts.flatMap((faq) => faq.expectedOutputs
      .filter((output) => output.kind === "template")
      .map((output) => ({ id: output.id, owner: faq.primarySkill, path: output.path }))),
  ];
}

async function authorizedRepresentativeResults(entry, routing, skillOutputIds) {
  const resultContracts = routingResultContracts(routing);
  const results = [];
  for (const output of entry.outputs) {
    const owners = entry.skills.filter((skill) => skillOutputIds.get(skill)?.has(output));
    if (owners.length === 0) continue;
    assert.equal(owners.length, 1, `${entry.id}: ${output} has one ordered-path SKILL owner`);
    const owner = owners[0];
    const contracts = resultContracts.filter((contract) => contract.id === output && contract.owner === owner);
    assert.ok(contracts.length > 0, `${entry.id}: ${output} has routing root owned by ${owner}`);
    const roots = [...new Set(contracts.map((contract) => contract.path))];
    assert.equal(roots.length, 1, `${entry.id}: ${output} has one exact routing root`);
    const template = await readFile(path.join(pluginRoot, "assets/templates", output, "content.md"), "utf8");
    assert.match(template, new RegExp(`^artifact_id: ${output}$`, "mu"), `${entry.id}: ${output} registered template`);
    results.push({ id: output, owner, path: roots[0] });
  }
  return results;
}

async function canonicalRepresentativeRoute(entry, source, routing, skillOutputIds) {
  const card = extractCaseCard(source, entry.id);
  const review = extractCaseSubsection(card, "검토와 승인");
  const readOrder = /\*\*읽는 순서:\*\* ([^.]+)입니다\./u.exec(review);
  assert.ok(readOrder, `${entry.id}: canonical read order`);
  const title = new RegExp(`^## ${entry.id} (.+)$`, "mu").exec(source);
  assert.ok(title, `${entry.id}: canonical title`);
  const results = await authorizedRepresentativeResults(entry, routing, skillOutputIds);
  return {
    caseId: entry.id,
    case: `\`${entry.id}\` — ${title[1]} — ${entry.audiences.join(" · ")}`,
    input: extractCaseSubsection(card, "준비 입력").split("\n").map((line) => line.trim()).join("<br>"),
    skills: entry.skills.map((skill) => `$game-design-career:${skill}`).join(" → "),
    directRequest: codeBlock(extractCaseSubsection(card, "Codex CLI 요청문"), `${entry.id}: direct request`),
    results: results.map(({ id, owner, path: resultPath }) => `\`${id}\` ($game-design-career:${owner}) → \`${resultPath}\``).join("<br>"),
    readOrder: readOrder[1],
  };
}

function assertRepresentativeRouteTable(markdown, expected, label) {
  const { headers, rows } = extractMarkdownTable(markdown, "활용 시작점");
  assert.deepEqual(headers, ["대표 사례", "시작점"], `${label}: concise route-table headers`);
  const expectedRows = [
    ["`CA-T01` 시스템 기획 입문", "역할·역량 경로 카드"],
    ["`CA-T04` 경제·밸런스·LiveOps", "역기획·포트폴리오 카드"],
    ["`CA-T05` UI·UX 기획", "역할·역량 경로 카드"],
    ["`CA-C05` 관찰 기반 역기획", "역기획·포트폴리오 카드"],
    ["`CA-C06` 창작 기획 포트폴리오", "역기획·포트폴리오 카드"],
    ["`CA-C08` 면접·주니어 성장·직무 전환", "면접·성장·전환 카드"],
  ];
  assert.deepEqual(rows, expectedRows, `${label}: concise representative route order`);
  assert.deepEqual(rows.map(([entry]) => entry.match(/CA-[A-Z]\d+/u)?.[0]), expected.map(({ caseId }) => caseId), `${label}: canonical representative case IDs`);
  for (const [title, minimum, reviewer] of [
    ["직무 탐색·학습", "game-design-role-map", "멘토"],
    ["역기획·포트폴리오·면접", "reverse-design-document", "public-rights reviewer"],
  ]) {
    const body = new RegExp(`^### ${title}\\n([\\s\\S]*)`, "mu").exec(markdown)?.[1];
    assert.ok(body, `${label}: readable route card ${title}`);
    for (const heading of ["준비 입력", "연결 흐름", "예상 결과", "사람 검토"]) {
      assert.match(body, new RegExp(`^#### ${heading}$`, "mu"), `${label}: ${title} ${heading} card`);
    }
    assert.match(body, new RegExp(`^- 최소: .*${minimum}`, "mu"), `${label}: ${title} minimum result`);
    assert.match(body, new RegExp(reviewer, "iu"), `${label}: ${title} named human reviewer`);
  }
}

function assertNoHiringGuarantee(markdown, label) {
  assert.doesNotMatch(markdown, /(?:합격|취업|채용)[^.\n]{0,24}(?:100%\s*)?(?:보장|약속|확정)(?!(?:하지|할\s*수\s*없|못|되지\s*않))/u, `${label}: no affirmative hiring guarantee`);
}

function careerArtifactIds(field) {
  return [...field.matchAll(/`([^`]+)`/gu)].map((match) => match[1]);
}

function competencyBlock(markdown, heading) {
  const marker = `## ${heading}\n`;
  const start = markdown.indexOf(marker);
  assert.notEqual(start, -1, `authoritative competency block: ${heading}`);
  const next = markdown.indexOf("\n## ", start + marker.length);
  return markdown.slice(start, next === -1 ? markdown.length : next);
}

function competencyField(block, label) {
  const value = new RegExp(`\\*\\*${label}:\\*\\* (.+)$`, "mu").exec(block)?.[1];
  assert.ok(value, `authoritative competency ${label}`);
  return value;
}

function normalizedOutcomeMeaning(value) {
  const signals = [
    ["visual", /도식|diagram|svg|png|이미지|image/iu],
    ["review", /검토|review|승인/iu],
    ["evidence", /evidence|proof|timestamp|feedback|current/iu],
    ["deliverable", /artifact|사례|case study|package/iu],
    ["preparation", /준비|job|receipt|mode|export/iu],
    ["rights", /권리|rights|public-rights|공개/iu],
  ];
  return signals.filter(([, expression]) => expression.test(value)).map(([meaning]) => meaning);
}

function assertNormalizedOutcomeMeaning(value, expected, label) {
  const actual = normalizedOutcomeMeaning(value);
  assert.ok(expected.every((meaning) => actual.includes(meaning)), `${label}: normalized outcome meaning ${JSON.stringify(actual)} must include ${JSON.stringify(expected)}`);
}

function assertHumanDecision(value, reviewers, label) {
  assert.deepEqual(reviewers.filter((reviewer) => value.toLowerCase().includes(reviewer)), reviewers, `${label}: named human decision-makers`);
  assert.match(value, /승인|결정|수정|보류|검토/u, `${label}: human decision action`);
  assert.doesNotMatch(value, /(?:자동|self)[\s-]*(?:승인|approval)\s*(?:됩니다|된다|됨|처리|합니다)/iu, `${label}: automatic approval is forbidden`);
}

async function assertCareerGoalOutputSummary(section) {
  assert.match(section, /^### 목표별 대표 결과$/mu, "Career product README: goal/output summary heading");
  const competencySource = await readFile(path.join(repoRoot, "guides/game-design-career/use-cases/competency-paths.md"), "utf8");
  const summaries = new Map();
  for (const [goal, layers] of careerGoalOutputLayers) {
    const line = section.split("\n").find((candidate) => candidate.startsWith(`- **${goal}** — `));
    assert.ok(line, `Career product README: goal summary missing: ${goal}`);
    const fields = /^- \*\*.+\*\* — 대표 요청: (`\$game-design-career:[^`]+`); 최소 결과: (?<minimum>[^;]+); 선택 결과: (?<optional>[^;]+); 확장 결과: (?<expanded>[^;]+); 사람 검토 경계: (?<humanReview>.+)$/u.exec(line)?.groups;
    assert.ok(fields, `Career product README: ${goal} must keep request, minimum, optional, expanded, and human-review fields separate`);
    assert.deepEqual(careerArtifactIds(fields.minimum), layers.minimum, `Career product README: ${goal} minimum artifacts`);
    const optionalCompetency = competencyBlock(competencySource, layers.competency.optionalHeading);
    const expandedCompetency = competencyBlock(competencySource, layers.competency.expandedHeading);
    const reviewCompetency = competencyBlock(competencySource, layers.competency.reviewHeading);
    assertNormalizedOutcomeMeaning(competencyField(optionalCompetency, "선택 결과"), layers.competency.optional, `${goal}: authoritative optional outcome`);
    assertNormalizedOutcomeMeaning(fields.optional, layers.competency.optional, `Career product README: ${goal} optional outcome`);
    assertNormalizedOutcomeMeaning(competencyField(expandedCompetency, "확장 결과"), layers.competency.expanded, `${goal}: authoritative expanded outcome`);
    assertNormalizedOutcomeMeaning(fields.expanded, layers.competency.expanded, `Career product README: ${goal} expanded outcome`);
    assertHumanDecision(competencyField(reviewCompetency, "사람 결정"), layers.competency.reviewers, `${goal}: authoritative human decision`);
    assertHumanDecision(fields.humanReview, layers.competency.reviewers, `Career product README: ${goal} human-review boundary`);
    summaries.set(goal, fields);
  }
  return summaries;
}

function assertCareerRepositoryCheckoutGuides(section) {
  assert.match(section, /repository checkout only/u, "Career checkout-only guides must be labeled");
  assert.doesNotMatch(section, /\]\((?:\.\.\/)+guides\//u, "Career checkout-only guides must not use package-escaping links");
  for (const guidePath of careerRepositoryCheckoutGuides) {
    assert.equal(section.split(`\`${guidePath}\``).length - 1, 1, `Career checkout-only guide appears exactly once: ${guidePath}`);
    assert.doesNotMatch(section, new RegExp(`\\[[^\\]]+\\]\\([^)]*${guidePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`), `Career checkout-only guide is plain code: ${guidePath}`);
  }
}

function mutateMarkdownTable(markdown, heading, mutate) {
  const marker = `## ${heading}\n`;
  const start = markdown.indexOf(marker);
  assert.notEqual(start, -1, `${heading}: mutation table section`);
  const sectionStart = start + marker.length;
  const nextSection = markdown.indexOf("\n## ", sectionStart);
  const sectionEnd = nextSection === -1 ? markdown.length : nextSection;
  const lines = markdown.slice(sectionStart, sectionEnd).split("\n");
  const headerIndex = lines.findIndex((line) => line.startsWith("|"));
  const dataStart = headerIndex + 2;
  const dataEnd = dataStart + lines.slice(dataStart).findIndex((line) => !line.startsWith("|"));
  const end = dataEnd === dataStart - 1 ? lines.length : dataEnd;
  const rows = lines.slice(dataStart, end).map((line) => line.split("|").slice(1, -1).map(normalizeTableCell));
  mutate(rows);
  lines.splice(dataStart, end - dataStart, ...rows.map((row) => `| ${row.join(" | ")} |`));
  return `${markdown.slice(0, sectionStart)}${lines.join("\n")}${markdown.slice(sectionEnd)}`;
}

function assertRepresentativeMutationMatrix(markdown, expected, label) {
  const { rows } = extractMarkdownTable(markdown, "활용 시작점");
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    for (let cellIndex = 0; cellIndex < rows[rowIndex].length; cellIndex += 1) {
      const deleted = mutateMarkdownTable(markdown, "활용 시작점", (mutated) => { mutated[rowIndex][cellIndex] = ""; });
      assert.throws(() => assertRepresentativeRouteTable(deleted, expected, `${label}: deleted ${rowIndex}/${cellIndex}`), `${label}: deletion ${rowIndex}/${cellIndex}`);
      const partner = rows.findIndex((candidate, index) => index !== rowIndex && candidate[cellIndex] !== rows[rowIndex][cellIndex]);
      assert.notEqual(partner, -1, `${label}: distinct cross-row value ${rowIndex}/${cellIndex}`);
      const swapped = mutateMarkdownTable(markdown, "활용 시작점", (mutated) => {
        [mutated[rowIndex][cellIndex], mutated[partner][cellIndex]] = [mutated[partner][cellIndex], mutated[rowIndex][cellIndex]];
      });
      assert.throws(() => assertRepresentativeRouteTable(swapped, expected, `${label}: cross-row swap ${rowIndex}/${cellIndex}`), `${label}: cross-row swap ${rowIndex}/${cellIndex}`);
    }
    const duplicated = mutateMarkdownTable(markdown, "활용 시작점", (mutated) => { mutated[rowIndex] = [...mutated[(rowIndex + 1) % mutated.length]]; });
    assert.throws(() => assertRepresentativeRouteTable(duplicated, expected, `${label}: duplicate ${rowIndex}`), `${label}: duplicate ${rowIndex}`);
  }
  const reorderedRows = mutateMarkdownTable(markdown, "활용 시작점", (mutated) => { mutated.reverse(); });
  assert.throws(() => assertRepresentativeRouteTable(reorderedRows, expected, `${label}: reordered rows`), `${label}: reordered rows`);
}

async function walkFiles(root) {
  const files = [];
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(file);
      else if (entry.isFile()) files.push(file);
    }
  }
  await visit(root);
  return files.sort();
}

test("release documentation ships the plugin license and third-party notices", async () => {
  await Promise.all([
    access(readmePath),
    access(path.join(pluginRoot, "LICENSE")),
    access(path.join(pluginRoot, "THIRD_PARTY_NOTICES.md")),
  ]);

  const [license, notices] = await Promise.all([
    readFile(path.join(pluginRoot, "LICENSE"), "utf8"),
    readFile(path.join(pluginRoot, "THIRD_PARTY_NOTICES.md"), "utf8"),
  ]);
  assert.match(license, /MIT License/);
  assert.match(notices, /Skillstead svg-infographic/);
  assert.match(notices, /0\.8\.3/);
  assert.match(notices, /Apache-2\.0/);
  assert.match(notices, /Copyright 2026 Kyungseo Park/);
  assert.match(notices, /49/);
  assert.match(notices, /docs\//);
});

test("README exposes every shipped skill, role asset, stage, and canonical template", async () => {
  const readme = await readFile(readmePath, "utf8");
  assert.deepEqual(tableIds(readme, "스킬 카탈로그"), skillIds);
  assert.deepEqual(tableIds(readme, "전문 역할 프롬프트"), roleIds);
  assert.deepEqual(tableIds(readme, "이미지 전문 역할 레지스트리"), imageRoleIds);
  assert.deepEqual(tableIds(readme, "Canonical Artifact 템플릿"), templateIds);
  for (const stage of ["entry", "new-hire", "junior-growth", "transition"]) {
    assert.ok(readme.includes(`| \`${stage}\` |`), `missing career stage: ${stage}`);
  }
});

test("README documents truthful installation, workflow, safety, visualization, export, and support boundaries", async () => {
  const readme = await readFile(readmePath, "utf8");
  const requiredHeadings = [
    "설치",
    "업데이트와 제거",
    "작동 방식",
    "근거와 최신성 정책",
    "Canonical Artifact",
    "사용 예시",
    "Skillstead 도식화",
    "MD, PDF, DOCX, PPTX 내보내기",
    "권리, 개인정보와 공정성",
    "제한 사항",
    "문제 해결",
    "검증",
    "라이선스",
  ];
  for (const heading of requiredHeadings) {
    assert.match(readme, new RegExp(`^## ${heading}$`, "m"));
  }

  for (const command of [
    "codex plugin marketplace add <path-to-repository-root>",
    "codex plugin add game-design-career@game-design-suite",
    "codex plugin remove game-design-career@game-design-suite",
  ]) {
    assert.ok(readme.includes(command), `missing verified CLI command: ${command}`);
  }

  for (const phrase of [
    "최대 3개",
    "병렬",
    "순차 fallback",
    "결정론",
    "1차 출처",
    "검색일",
    "표본",
    "지역",
    "일반화",
    "조작하지",
    "합격을 보장하지",
    "독립적인 스토리",
    "fail-closed",
    "SVG lint",
    "2× PNG",
    "네이티브 자동 발견을 보장하지",
    "IMAGE_GEN_MODE",
    "prompt-only",
    "production-candidate는 release/legal/production approval이 아님",
  ]) {
    assert.ok(readme.includes(phrase), `missing operational boundary: ${phrase}`);
  }

  for (const example of [
    "진로 미결정 입문자",
    "목표 채용 공고 근거 매트릭스",
    "역기획 포트폴리오",
    "5축 포트폴리오 리뷰",
    "면접 연습",
    "주니어 성장 계획",
    "시각적 로드맵",
    "문서 내보내기",
  ]) {
    assert.match(readme, new RegExp(`^### ${example}$`, "m"));
  }
});

test("README documents the isolated image workflow contract", async () => {
  const readme = await readFile(readmePath, "utf8");
  for (const contract of [
    "root `.env.example`",
    "tracked `.env`",
    "IMAGE_MODEL=gpt-image-2",
    "IMAGE_QUALITY=low",
    "OpenAI only",
    "Codex/host",
    "immutable receipt",
    "assets/prompts/image-prompts.md",
    "assets/prompts/image-prompts.json",
    "concept-draft → document-approved → production-candidate",
    "Skillstead SVG",
    "smoke:image:live",
  ]) assert.ok(readme.includes(contract), `missing image operating contract: ${contract}`);
});

test("README documents the closed Career document-quality workflow and installed contracts", async () => {
  const readme = await readFile(readmePath, "utf8");
  assert.match(readme, /^## Document Quality Profiles$/m);
  assert.deepEqual(tableIds(readme, "Document Quality Profiles"), qualityProfileIds);
  for (const contract of [
    "정확히 하나의 primary profile",
    "명시적 override",
    "nearest profile",
    "fallback",
    "mobile`, `pc-console`, `live-service",
    "competitive-live-service`, `replayable-coop`, `evolving-world`, `function-first`, `player-validated-small-team`, `cinematic-narrative`, `ugc-production-tooling",
    "caller-authored production map",
    "stable section/table/Skillstead diagram/image/acceptance checklist ID",
    "draft → structurally-complete → evidence-reviewed → visual-reviewed → document-approved",
    "receipt",
    "generated image와 render는 자동 승인",
    "공식 studio endorsement",
    "references/document-quality/template-profile-map.json",
    "references/shared/document-quality/schema/quality-profile.schema.json",
    "references/shared/document-quality/render-contracts/",
  ]) {
    assert.ok(readme.includes(contract), `missing document-quality contract: ${contract}`);
  }
  assert.match(readme, /apply-document-quality-profile.*portfolio-case-study.*pc-console.*function-first/su);
});

test("README inventories the exact packaged runtime scripts and shared quality subtrees", async () => {
  const readme = await readFile(readmePath, "utf8");
  assert.deepEqual(tableIds(readme, "설치된 top-level scripts"), topLevelScriptIds);
  assert.deepEqual(tableIds(readme, "설치된 document-quality 경로"), documentQualityPaths);

  const sourceScripts = (await readdir(path.join(repoRoot, "shared/scripts"), { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith(".mjs"))
    .map(({ name }) => name)
    .sort();
  assert.deepEqual(sourceScripts, [...topLevelScriptIds].sort());

  const stage = await mkdtemp(path.join(os.tmpdir(), "career-readme-inventory-"));
  try {
    const build = await buildProduct({ repoRoot, productName: "game-design-career", stagingRoot: stage, sourceDateEpoch: 0 });
    const builtScripts = (await readdir(path.join(build.outputDir, "scripts"), { withFileTypes: true }))
      .filter((entry) => entry.isFile() && entry.name.endsWith(".mjs"))
      .map(({ name }) => name)
      .sort();
    assert.deepEqual(builtScripts, [...topLevelScriptIds].sort());
    for (const relativePath of documentQualityPaths) {
      await access(path.join(repoRoot, "shared/document-quality", relativePath));
      await access(path.join(build.outputDir, "references/shared/document-quality", relativePath));
    }
    const sourceQualityRoot = path.join(repoRoot, "shared/document-quality");
    const builtQualityRoot = path.join(build.outputDir, "references/shared/document-quality");
    assert.deepEqual(
      (await walkFiles(sourceQualityRoot)).map((file) => path.relative(sourceQualityRoot, file)),
      (await walkFiles(builtQualityRoot)).map((file) => path.relative(builtQualityRoot, file)),
    );
  } finally {
    await rm(stage, { recursive: true, force: true });
  }
});

test("README local links resolve inside the source plugin or repository", async () => {
  const readme = await readFile(readmePath, "utf8");
  const links = [...readme.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)]
    .map((match) => match[1])
    .filter((target) => !target.startsWith("http") && !target.startsWith("#"));
  assert.ok(links.length > 0, "README must link to inspectable local contracts");
  for (const target of links) {
    assert.ok(!path.isAbsolute(target), `local link must be relative: ${target}`);
    await access(path.resolve(pluginRoot, target));
  }
});

test("README explains the source overlay and complete independent built-plugin structure", async () => {
  const readme = await readFile(readmePath, "utf8");
  assert.match(readme, /^## 플러그인 구조$/m);

  for (const pathOrCount of [
    "products/game-design-career/plugin",
    "plugins/game-design-career",
    ".codex-plugin/plugin.json",
    "skills/ (15개)",
    "skills/svg-infographic/",
    "agents/ (9개)",
    "hooks/hooks.json",
    "scripts/",
    "references/shared/knowledge/core/",
    "references/shared/knowledge/trends/",
    "references/source/docs/ (49개)",
    "references/shared/export/schema/",
    "assets/templates/ (15개)",
    "assets/product-mark.svg",
  ]) {
    assert.ok(readme.includes(pathOrCount), `missing packaged structure: ${pathOrCount}`);
  }

  for (const contract of [
    "source overlay",
    "generated independent snapshot",
    "suite build",
    "SessionStart",
    "capability-probe",
    "Stop",
    "one-retry",
    "artifact review",
    "shared runtime",
    "product helper",
    "생성 결과를 직접 편집하지",
  ]) {
    assert.ok(readme.includes(contract), `missing structure boundary: ${contract}`);
  }
});

test("README keeps Career export preparation non-terminal and delegates trusted terminal verification", async () => {
  const readme = await readFile(readmePath, "utf8");
  const exportSection = readme.split("## MD, PDF, DOCX, PPTX 내보내기\n")[1]
    ?.split("\n## ")[0] ?? "";

  for (const contract of [
    "preflight 전용",
    "`not-requested`, `blocked`, `pending`, `unavailable`",
    "`passed` 또는 `failed`를 수용하거나 생성하지",
    "generation·QA·derivative terminal evidence",
    "trusted bundled renderer",
    "artifact digest",
    "MD/PDF/DOCX/PPTX/SVG/PNG",
    "suite Task 11",
  ]) {
    assert.ok(readme.includes(contract), `missing export trust boundary: ${contract}`);
  }

  assert.doesNotMatch(exportSection, /각 형식은 capability probe, 생성, 파일 존재, 형식별 QA가 모두 통과해야 `passed`/u);
  assert.doesNotMatch(readme, /형식별 capability·생성·QA 증거가 있는 작업 manifest/u);
});

test("README distinguishes the low-level product build from the current suite snapshot and stays machine-portable", async () => {
  const stage = await mkdtemp(path.join(os.tmpdir(), "career-readme-build-"));
  try {
    const result = await buildProduct({
      repoRoot,
      productName: "game-design-career",
      stagingRoot: stage,
      sourceDateEpoch: 0,
    });
    const sourceReadme = await readFile(readmePath, "utf8");
    const builtReadme = await readFile(path.join(result.outputDir, "README.md"), "utf8");

    assert.equal(result.files.includes("BUILD-MANIFEST.json"), false);
    assert.match(sourceReadme, /저수준 `buildProduct\(\)` 출력에는 `BUILD-MANIFEST\.json`이 없습니다/u);
    assert.match(sourceReadme, /이 suite distribution snapshot에는 `BUILD-MANIFEST\.json`이 있으며/u);
    assert.doesNotMatch(sourceReadme, /└── BUILD-MANIFEST\.json\s+# suite build가 만드는 파일 목록·해시/u);

    for (const [label, root, readme] of [
      ["source", pluginRoot, sourceReadme],
      ["built", result.outputDir, builtReadme],
    ]) {
      assert.doesNotMatch(readme, /\/Users\/|\/home\/|[A-Za-z]:\\/u, `${label} README contains a machine absolute path`);
      assert.match(readme, /\$\{CODEX_HOME:-\$HOME\/\.codex\}/u);
      const links = [...readme.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)]
        .map((match) => match[1])
        .filter((target) => !target.startsWith("http") && !target.startsWith("#"));
      for (const target of links) {
        assert.equal(path.isAbsolute(target), false, `${label} README link must be relative: ${target}`);
        const resolved = path.resolve(root, target);
        assert.ok(resolved === root || resolved.startsWith(`${root}${path.sep}`), `${label} README link escapes package: ${target}`);
        await access(resolved);
      }
    }
  } finally {
    await rm(stage, { recursive: true, force: true });
  }
});

test("README validation commands honor a CODEX_HOME override containing spaces", async () => {
  const readme = await readFile(readmePath, "utf8");
  const blocks = [...readme.matchAll(/```bash\n([\s\S]*?)```/g)].map((match) => match[1]);
  const skillCommand = blocks.find((block) => block.includes("CODEX_SKILL_CREATOR_ROOT"));
  const pluginCommand = blocks.find((block) => block.includes("CODEX_PLUGIN_CREATOR_ROOT"));
  assert.ok(skillCommand, "missing portable skill validation command");
  assert.ok(pluginCommand, "missing portable plugin validation command");

  const scratch = await mkdtemp(path.join(os.tmpdir(), "career readme commands-"));
  const codexHome = path.join(scratch, "Codex Home With Spaces");
  try {
    const skillScript = path.join(codexHome, "skills/.system/skill-creator/scripts/quick_validate.py");
    const pluginScript = path.join(codexHome, "skills/.system/plugin-creator/scripts/validate_plugin.py");
    await mkdir(path.dirname(skillScript), { recursive: true });
    await mkdir(path.dirname(pluginScript), { recursive: true });
    await writeFile(skillScript, "import sys\nprint('override-skill:' + sys.argv[1])\n", "utf8");
    await writeFile(pluginScript, "import sys\nprint('override-plugin:' + sys.argv[1])\n", "utf8");

    const environment = { ...process.env, CODEX_HOME: codexHome };
    const skillRun = spawnSync("/bin/bash", ["-c", skillCommand], { cwd: repoRoot, env: environment, encoding: "utf8" });
    assert.equal(skillRun.status, 0, skillRun.stderr);
    assert.equal((skillRun.stdout.match(/^override-skill:/gm) ?? []).length, 14);

    const pluginRun = spawnSync("/bin/bash", ["-c", pluginCommand], { cwd: repoRoot, env: environment, encoding: "utf8" });
    assert.equal(pluginRun.status, 0, pluginRun.stderr);
    assert.match(pluginRun.stdout, /^override-plugin:products\/game-design-career\/plugin$/m);
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
});

test("README binds Career entry users to canonical representative case routes without package-escaping links", async () => {
  const [readme, routingSource, manifestSource, inventory] = await Promise.all([
    readFile(readmePath, "utf8"),
    readFile(path.join(pluginRoot, "references/routing.json"), "utf8"),
    readFile(path.join(repoRoot, "guides/use-cases/use-case-manifest.json"), "utf8"),
    collectProductInventory(repoRoot, "game-design-career"),
  ]);
  const routing = JSON.parse(routingSource);
  const manifest = JSON.parse(manifestSource);
  const careerCases = manifest.cases.filter(({ product }) => product === "game-design-career");
  const skillCases = manifest.skill_cases.filter(({ product }) => product === "game-design-career");

  assert.match(readme, /^## 활용 시작점$/mu);
  for (const audience of ["취업 준비", "주니어", "전환", "멘토"]) assert.ok(readme.includes(audience), `target audience: ${audience}`);
  assert.match(readme, /여러 Career 단계와 산출물이 함께.*orchestrate-game-design-career/su, "orchestrator scope");
  assert.match(readme, /한 산출물.*직접.*스킬/su, "direct-skill scope");
  for (const summary of [
    `${careerCases.length}개 사례`,
    `${inventory.skillIds.length}개 직접 스킬`,
    `${routing.faqContracts.length}개 FAQ`,
    `${careerCases.length + skillCases.length}개 도식`,
  ]) assert.ok(readme.includes(summary), `catalog relationship: ${summary}`);
  await assertCareerGoalOutputSummary(readmeSection(readme, "활용 시작점"));

  const expected = [];
  const skillOutputIds = new Map(await Promise.all(
    [...new Set(representativeCareerCaseIds.flatMap((caseId) => careerCases.find(({ id }) => id === caseId).skills))]
      .map(async (skill) => [skill, outputContractIds(await readFile(path.join(pluginRoot, "skills", skill, "SKILL.md"), "utf8"))]),
  ));
  for (const caseId of representativeCareerCaseIds) {
    const entry = careerCases.find(({ id }) => id === caseId);
    assert.ok(entry, `representative Career case: ${caseId}`);
    const source = await readFile(path.join(repoRoot, entry.document), "utf8");
    expected.push(await canonicalRepresentativeRoute(entry, source, routing, skillOutputIds));
  }
  assertRepresentativeRouteTable(readme, expected, "Career product README");
  assertNoHiringGuarantee(readme, "Career product README");
  assertRepresentativeMutationMatrix(readme, expected, "Career product README");
  for (const positivePromise of [
    "합격을 약속합니다.",
    "합격을 보장할 수 있습니다.",
    "취업을 보장합니다.",
    "채용을 약속합니다.",
    "채용을 100% 확정합니다.",
    "취업 100% 보장",
  ]) {
    assert.throws(() => assertNoHiringGuarantee(`${readme}\n${positivePromise}`, "mutated Career product README"), positivePromise);
  }
  for (const boundary of ["합격을 보장하지 않습니다.", "채용을 약속하지 않습니다.", "취업 결과를 확정하지 않습니다."]) {
    assert.doesNotThrow(() => assertNoHiringGuarantee(`${readme}\n${boundary}`, "Career product README boundary"), boundary);
  }

  const localLinks = [...readme.matchAll(/\[[^\]]+\]\(([^)]+)\)/gu)]
    .map((match) => match[1])
    .filter((target) => !target.startsWith("http") && !target.startsWith("#"));
  for (const target of localLinks) {
    assert.equal(path.isAbsolute(target), false, `README link must be package-relative: ${target}`);
    const resolved = path.resolve(pluginRoot, target);
    assert.ok(resolved === pluginRoot || resolved.startsWith(`${pluginRoot}${path.sep}`), `README link escapes package: ${target}`);
    await access(resolved);
  }

  assertCareerRepositoryCheckoutGuides(readmeSection(readme, "Repository checkout only guides"));
  await Promise.all(careerRepositoryCheckoutGuides.map((guidePath) => access(path.join(repoRoot, guidePath))));
  await assert.rejects(
    assertCareerGoalOutputSummary(readmeSection(readme, "활용 시작점").replace("최소 결과: `game-design-role-map`, `learning-roadmap`; 선택 결과:", "최소 결과: `game-design-role-map`; 선택 결과: `learning-roadmap`,")),
    "learning-roadmap must remain a minimum result",
  );
  await assert.rejects(
    assertCareerGoalOutputSummary(readmeSection(readme, "활용 시작점").replace("최소 결과: `junior-growth-review`, `transition-readiness`; 선택 결과:", "최소 결과: `junior-growth-review`; 선택 결과: `transition-readiness`,")),
    "transition-readiness must remain a minimum result",
  );
});

test("Career goal summaries reject swapped outcome layers, auto-approval, and a removed reviewer", async () => {
  const section = readmeSection(await readFile(readmePath, "utf8"), "활용 시작점");
  const swappedLayers = section.replace(
    "선택 결과: 사람 검토를 위한 공개 가능한 evidence summary; 확장 결과: 검토자가 다음 proof task를 확인한 Career Artifact",
    "선택 결과: 검토자가 다음 proof task를 확인한 Career Artifact; 확장 결과: 사람 검토를 위한 공개 가능한 evidence summary",
  );
  await assert.rejects(
    assertCareerGoalOutputSummary(swappedLayers),
    "Career summary must reject an optional/expanded outcome swap",
  );
  await assert.rejects(
    assertCareerGoalOutputSummary(section.replace("사용자와 멘토가 역할 후보, 공개 범위와 다음 과제를 승인·수정·보류합니다.", "자동 승인됩니다.")),
    "Career summary must reject auto approval",
  );
  await assert.rejects(
    assertCareerGoalOutputSummary(section.replace("사용자와 멘토가 역할 후보, 공개 범위와 다음 과제를 승인·수정·보류합니다.", "역할 후보, 공개 범위와 다음 과제를 검토합니다.")),
    "Career summary must reject a removed human decision-maker",
  );
});
