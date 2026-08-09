import assert from "node:assert/strict";
import { access, lstat, mkdir, mkdtemp, readFile, readdir, realpath, rm, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { buildProduct } from "../../../tooling/lib/build-product.mjs";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const pluginRoot = path.join(repoRoot, "products/game-design-studio/plugin");
const readmePath = path.join(pluginRoot, "README.md");
const temporaryDirectories = [];

test.afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

const skillIds = [
  "orchestrate-game-design-project",
  "apply-document-quality-profile",
  "define-game-vision",
  "design-game-systems",
  "design-game-content",
  "design-player-experience",
  "design-game-economy-and-liveops",
  "plan-game-production",
  "review-game-design",
  "visualize-game-design",
  "export-game-design-documents",
  "plan-image-assets",
  "generate-image-assets",
  "review-image-assets",
];

const roleIds = [
  "lead-game-designer",
  "document-quality-editor",
  "system-economy-designer",
  "content-narrative-designer",
  "ux-accessibility-reviewer",
  "liveops-data-designer",
  "production-feasibility-critic",
];

const imageRoleIds = ["art-brief-director", "visual-asset-reviewer"];

const templateIds = [
  "game-design-brief",
  "vision-pillars",
  "core-motivation-loop",
  "system-specification",
  "rule-exception-matrix",
  "ui-ux-flow-state",
  "data-schema-table-contract",
  "narrative-quest-npc",
  "character-skill-combat-monster",
  "economy-balance",
  "liveops-experiment-event",
  "accessibility-platform-matrix",
  "production-scope-risk",
  "game-design-review",
  "decision-change-log",
];

const qualityProfileIds = [
  "vision-one-pager",
  "game-design-brief",
  "master-gdd",
  "core-motivation-loop",
  "system-feature-specification",
  "rule-state-exception-matrix",
  "data-table-contract",
  "narrative-quest-npc-specification",
  "character-skill-combat-monster-specification",
  "ui-ux-flow-state-specification",
  "economy-balance-specification",
  "liveops-event-experiment-plan",
  "accessibility-platform-matrix",
  "production-scope-milestone-risk-plan",
  "playtest-metrics-report",
  "design-review-decision-log",
  "executive-pitch",
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

function localMarkdownLinks(markdown) {
  return [...markdown.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)]
    .map((match) => match[1].split("#", 1)[0])
    .filter((target) => target && !/^[a-z][a-z0-9+.-]*:/iu.test(target) && !target.startsWith("#"));
}

async function assertContainedLink(root, markdownFile, target) {
  assert.ok(!path.isAbsolute(target), `local link must be relative: ${target}`);
  const rootReal = await realpath(root);
  const rootLexical = path.resolve(root);
  const markdownRelative = path.relative(rootLexical, path.resolve(markdownFile));
  assert.ok(markdownRelative && !markdownRelative.startsWith("..") && !path.isAbsolute(markdownRelative), `Markdown source escapes plugin root: ${markdownFile}`);
  const resolved = path.resolve(rootReal, path.dirname(markdownRelative), target);
  const relative = path.relative(rootReal, resolved);
  assert.ok(relative && !relative.startsWith("..") && !path.isAbsolute(relative), `local link escapes plugin root: ${target}`);
  let cursor = rootReal;
  for (const segment of relative.split(path.sep)) {
    cursor = path.join(cursor, segment);
    const stat = await lstat(cursor);
    assert.equal(stat.isSymbolicLink(), false, `local link traverses symlink: ${target}`);
  }
  const targetReal = await realpath(resolved);
  const canonicalRelative = path.relative(rootReal, targetReal);
  assert.ok(canonicalRelative && !canonicalRelative.startsWith("..") && !path.isAbsolute(canonicalRelative), `real link target escapes plugin root: ${target}`);
}

async function assertAllMarkdownLinksContained(root) {
  const markdownFiles = (await walkFiles(root)).filter((file) => file.endsWith(".md"));
  for (const markdownFile of markdownFiles) {
    const markdown = await readFile(markdownFile, "utf8");
    for (const target of localMarkdownLinks(markdown)) await assertContainedLink(root, markdownFile, target);
  }
}

const studioRepositoryCheckoutGuides = Object.freeze([
  ["Studio 활용 사례 인덱스", "guides/game-design-studio/use-cases/README.md", "Game Design Studio 활용 사례"],
  ["Studio 역량 사례", "guides/game-design-studio/use-cases/competency-paths.md", "Studio 역량 학습 경로"],
  ["Studio 콘셉트 사례", "guides/game-design-studio/use-cases/concept-scenarios.md", "Studio 콘셉트 시나리오"],
  ["Studio 스킬 워크벤치", "guides/game-design-studio/use-cases/skill-workbench.md", "Studio 스킬 워크벤치"],
  ["Studio FAQ", "guides/game-design-studio/faq.md", "Studio FAQ"],
  ["공통 결과물 카탈로그", "guides/use-cases/output-catalog.md", "결과물 카탈로그"],
]);

const studioGoalOutputLayers = new Map([
  ["규칙·핵심 루프", { minimum: ["game-design-brief", "vision-pillars"], competency: { optionalHeading: "ST-C01 플레이어 경험과 게임 비전", expandedHeading: "ST-C01 플레이어 경험과 게임 비전", reviewHeading: "ST-C01 플레이어 경험과 게임 비전", optional: ["prompt", "visual", "source", "review"], expanded: ["review", "evidence", "deliverable"], reviewers: ["design owner"] } }],
  ["시스템", { minimum: ["system-specification"], competency: { optionalHeading: "ST-C03 규칙·상태·예외·데이터", expandedHeading: "ST-C03 규칙·상태·예외·데이터", reviewHeading: "ST-C03 규칙·상태·예외·데이터", optional: ["visual", "source"], expanded: ["evidence", "deliverable"], reviewers: ["design", "engineering owner"] } }],
  ["UX·접근성", { minimum: ["ui-ux-flow-state"], competency: { optionalHeading: "ST-C04 UI·UX·온보딩·접근성", expandedHeading: "ST-C04 UI·UX·온보딩·접근성", reviewHeading: "ST-C04 UI·UX·온보딩·접근성", optional: ["prompt", "visual", "source", "review"], expanded: ["review", "evidence", "deliverable"], reviewers: ["accessibility", "design owner"] } }],
  ["콘텐츠·퀘스트", { minimum: ["narrative-quest-npc"], competency: { optionalHeading: "ST-C05 콘텐츠·내러티브·퀘스트·NPC", expandedHeading: "ST-C05 콘텐츠·내러티브·퀘스트·NPC", reviewHeading: "ST-C05 콘텐츠·내러티브·퀘스트·NPC", optional: ["prompt", "visual", "source", "review"], expanded: ["review", "deliverable"], reviewers: ["content", /rights|권리/u, "production owner"] } }],
  ["경제·LiveOps", { minimum: ["economy-balance"], competency: { optionalHeading: "ST-C07 성장·경제·밸런스·LiveOps", expandedHeading: "ST-C07 성장·경제·밸런스·LiveOps", reviewHeading: "ST-C07 성장·경제·밸런스·LiveOps", optional: ["prompt", "visual", "source"], expanded: ["review", "evidence"], reviewers: ["economy", "liveops", "policy"] } }],
  ["전체 프로젝트", { minimum: ["production-scope-risk", "export-manifest.yml"], competency: { optionalHeading: "ST-C08 제작·검토·이미지·출력", expandedHeading: "ST-C08 제작·검토·이미지·출력", reviewHeading: "ST-C08 제작·검토·이미지·출력", optional: ["prompt", "visual", "source", "preparation"], expanded: ["review", "evidence", "deliverable"], reviewers: [/production/u, /review/u, "rights", /asset/u, "export owner"] } }],
]);

const directOutputOwnership = Object.freeze([
  {
    label: "경제·LiveOps",
    skillId: "design-game-economy-and-liveops",
    sourceSentence: "Produce either `economy-balance` or `liveops-experiment-event` with stable sections for sources, sinks, target inventory, progression time, inflation, real price, probability, pity, hypothesis, control, single variable, sample, duration, success metrics, guardrail metrics, stop criteria, rollback plan, rights and consent, assumptions, evidence, gates, review findings, and owners.",
    allowedOutputs: ["economy-balance", "liveops-experiment-event"],
    rowOutput: "economy-balance",
  },
  {
    label: "제작 검토·출력",
    skillId: "plan-game-production",
    sourceSentence: "Produce `production-scope-risk` with stable sections for core-loop contribution, effort, dependencies, maintenance burden, licensing risk, outsource risk, prototype hypothesis, milestone, owner, definition of done, kill criterion, MoSCoW scope, assumptions, evidence, validation gates, review findings, decisions, and blockers.",
    allowedOutputs: ["production-scope-risk"],
    rowOutput: "production-scope-risk",
  },
]);

const representativeRequestResultRows = Object.freeze([
  "| 새 게임 GDD | `$game-design-studio:orchestrate-game-design-project 4인 협동 탐험 게임의 대상 플레이어, player promise, core loop, non-goal과 prototype 질문을 정리해.` | `game-design-brief`와 `vision-pillars`를 담은 Canonical Artifact 초안 |",
  "| 시스템 명세 | `$game-design-studio:design-game-systems 장비 강화의 rule ID, state transition, precedence, exception과 data authority를 명세해.` | `system-specification`의 규칙·상태·예외·검증 표 |",
  "| UX·접근성 | `$game-design-studio:design-player-experience 첫 세션의 critical action, 대체 입력, 오류 recovery와 접근성 검토를 연결해.` | `ui-ux-flow-state`와 접근성 검토 큐 |",
  "| 콘텐츠·퀘스트 | `$game-design-studio:design-game-content 협동 복구 퀘스트의 목표, NPC state, choice와 consequence를 작성해.` | `narrative-quest-npc`의 quest state와 제작 handoff |",
  "| 경제·LiveOps | `$game-design-studio:design-game-economy-and-liveops 토큰 source/sink, guardrail, stop 조건과 rollback 증거를 가정으로 정리해.` | `economy-balance`의 source/sink 가정과 guardrail·rollback 질문 |",
  "| 제작 검토·출력 | `$game-design-studio:plan-game-production prototype scope, dependency, kill criteria와 review owner를 정리해.` | `production-scope-risk`의 scope·dependency·kill criteria 초안 |",
]);

function readmeSection(markdown, heading) {
  const match = new RegExp(`^## ${heading}$`, "m").exec(markdown);
  assert.ok(match, `README missing section: ${heading}`);
  const bodyStart = match.index + match[0].length;
  const next = markdown.slice(bodyStart).search(/^## /m);
  return markdown.slice(bodyStart, next === -1 ? markdown.length : bodyStart + next).trim();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractMarkdownSection(markdown, heading) {
  const marker = `## ${heading}\n`;
  const start = markdown.indexOf(marker);
  assert.notEqual(start, -1, `missing section: ${heading}`);
  const bodyStart = start + marker.length;
  const next = markdown.indexOf("\n## ", bodyStart);
  return markdown.slice(bodyStart, next === -1 ? markdown.length : next).trim();
}

function splitMarkdownTableRow(row) {
  assert.match(row, /^\|.*\|$/, `table row must start and end with pipes: ${row}`);
  const cells = [];
  let cell = "";
  let inCodeSpan = false;
  let escaped = false;
  for (const character of row.slice(1, -1)) {
    if (escaped) {
      cell += character;
      escaped = false;
    } else if (character === "\\") {
      cell += character;
      escaped = true;
    } else if (character === "`") {
      cell += character;
      inCodeSpan = !inCodeSpan;
    } else if (character === "|" && !inCodeSpan) {
      cells.push(cell.trim());
      cell = "";
    } else {
      cell += character;
    }
  }
  assert.equal(inCodeSpan, false, `unclosed code span in table row: ${row}`);
  cells.push(cell.trim());
  return cells;
}

function representativeTableRows(section) {
  return section.split("\n")
    .filter((line) => /^\| (?:새 게임 GDD|시스템 명세|UX·접근성|콘텐츠·퀘스트|경제·LiveOps|제작 검토·출력) \|/.test(line))
    .map((line) => ({ line, cells: splitMarkdownTableRow(line) }));
}

function swapRepresentativeTableCells(readme, label) {
  const section = readmeSection(readme, "활용 경로와 결과");
  const row = representativeTableRows(section).find(({ cells }) => cells[0] === label);
  assert.ok(row, `representative table row missing: ${label}`);
  assert.equal(row.cells.length, 3, `${label}: representative row must have three cells`);
  const swapped = `| ${row.cells[0]} | ${row.cells[2]} | ${row.cells[1]} |`;
  return readme.replace(row.line, swapped);
}

function assertCanonicalOutputContract({ skillId, sourceSentence, allowedOutputs }, skillMarkdown) {
  const outputContract = extractMarkdownSection(skillMarkdown, "Output contract");
  const sentence = outputContract.split("\n").find(Boolean);
  assert.equal(sentence, sourceSentence, `${skillId}: exact Output contract sentence`);
  const outputClause = /^Produce (?:either )?(.+?) with stable sections for /.exec(sentence)?.[1];
  assert.ok(outputClause, `${skillId}: output clause must be section-local and complete`);
  const outputs = outputClause.split(" or ").map((output) => output.replaceAll("`", ""));
  assert.deepEqual(outputs, allowedOutputs, `${skillId}: exact allowed output set`);
  return outputs;
}

async function assertRepositoryCheckoutGuides(section, guides = studioRepositoryCheckoutGuides) {
  assert.match(section, /repository checkout only/u, "repository-only guides must not promise a remote URL");
  assert.doesNotMatch(section, /github\.com\/freelife\/game-design-plugin|https?:\/\/[^\s)]+\/tree\//u, "fabricated GitHub repository or tree URL");
  assert.doesNotMatch(section, /\]\((?:\.\.\/)+guides\//u, "packaged README must not use repository-only relative guide links");
  for (const [label, relativePath, expectedFirstH1] of guides) {
    const plainCodePath = `\`${relativePath}\``;
    assert.match(section, new RegExp(`\\| ${escapeRegExp(label)} \\| ${escapeRegExp(plainCodePath)} \\|`), `${label}: checkout-only path must be plain code`);
    assert.equal(section.split(`\`${relativePath}\``).length - 1, 1, `${label}: checkout-only path appears exactly once`);
    assert.doesNotMatch(section, new RegExp(`\\[[^\\]]+\\]\\([^)]*${escapeRegExp(relativePath)}`), `${label}: checkout-only path must not be a Markdown link`);
    const guide = await readFile(path.join(repoRoot, relativePath), "utf8");
    const firstH1 = guide.match(/^# (.+)$/m)?.[1];
    assert.equal(firstH1, expectedFirstH1, `${label}: checkout path must resolve to its exact first H1`);
  }
}

async function assertRepresentativeOutputOwnership() {
  const allowedOutputs = new Map();
  for (const outputContract of directOutputOwnership) {
    const skill = await readFile(path.join(pluginRoot, "skills", outputContract.skillId, "SKILL.md"), "utf8");
    allowedOutputs.set(outputContract.label, assertCanonicalOutputContract(outputContract, skill));
  }
  return allowedOutputs;
}

function assertStudioUseCaseReadme(readme) {
  const section = readmeSection(readme, "활용 경로와 결과");
  for (const user of ["기획 입문 학생", "솔로·인디 개발자", "현업 기획자", "팀 리드·교육자·멘토"]) {
    assert.ok(section.includes(user), `target user missing: ${user}`);
  }
  for (const path of ["역량 중심", "콘셉트 중심", "스킬 중심"]) {
    assert.match(section, new RegExp(`^### ${path}$`, "m"), `exploration path missing: ${path}`);
  }
  assert.match(section, /한 작업.*분명하면[\s\S]{0,220}\$game-design-studio:design-game-systems/u, "direct skill rule must bind a single-system request to its skill");
  assert.match(section, /복수.*영역|범위.*불명확/u, "orchestrator condition missing");
  assert.match(section, /복수.*영역[\s\S]{0,220}\$game-design-studio:orchestrate-game-design-project|범위.*불명확[\s\S]{0,220}\$game-design-studio:orchestrate-game-design-project/u, "orchestrator condition must bind to the orchestrator");

  const tableRows = representativeTableRows(section);
  for (const { cells } of tableRows) assert.equal(cells.length, 3, `${cells[0]}: representative row must parse as three cells`);
  const actualRows = tableRows.map(({ line }) => line);
  assert.deepEqual(actualRows, representativeRequestResultRows, "representative requests and results must keep exact command/output ownership");
  assert.match(section, /content\.md\s*→\s*evidence\.yml\s*→\s*decisions\/\s*→\s*assets\/\s*→\s*export-manifest\.yml/u, "canonical artifact reading order");

  assert.match(section, /\[설치된 스킬\]\(skills\/design-game-systems\/SKILL\.md\)/u, "package-local skill link must remain distinct");
  assert.match(section, /\[설치된 템플릿\]\(assets\/templates\/system-specification\/\)/u, "package-local template link must remain distinct");
}

function artifactIds(field) {
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
    ["prompt", /prompt/iu],
    ["visual", /도식|diagram|svg|png|이미지|image/iu],
    ["source", /source/iu],
    ["review", /검토|review|승인/iu],
    ["evidence", /evidence|proof|rollback|qa|test|usability|current|guardrail/iu],
    ["deliverable", /handoff|brief|artifact|package|사례|case study|전달/iu],
    ["preparation", /준비|job|receipt|mode|export/iu],
  ];
  return signals.filter(([, expression]) => expression.test(value)).map(([meaning]) => meaning);
}

function assertNormalizedOutcomeMeaning(value, expected, label) {
  assert.deepEqual(normalizedOutcomeMeaning(value), expected, `${label}: normalized outcome meaning`);
}

function assertHumanDecision(value, reviewers, label) {
  assert.deepEqual(reviewers.filter((reviewer) => typeof reviewer === "string" ? value.toLowerCase().includes(reviewer) : reviewer.test(value)), reviewers, `${label}: named human decision-makers`);
  assert.match(value, /승인|결정|수정|보류|검토/u, `${label}: human decision action`);
  assert.doesNotMatch(value, /(?:자동|self)[\s-]*(?:승인|approval)\s*(?:됩니다|된다|됨|처리|합니다)/iu, `${label}: automatic approval is forbidden`);
}

async function assertGoalOutputSummary(section, goals, product) {
  assert.match(section, /^### 목표별 대표 요청과 결과$/mu, `${product}: goal/output summary heading`);
  const competencySource = await readFile(path.join(repoRoot, "guides/game-design-studio/use-cases/competency-paths.md"), "utf8");
  const summaries = new Map();
  for (const [goal, layers] of goals) {
    const line = section.split("\n").find((candidate) => candidate.startsWith(`- **${goal}** — `));
    assert.ok(line, `${product}: goal summary missing: ${goal}`);
    const fields = /^- \*\*.+\*\* — 대표 요청: (`\$game-design-studio:[^`]+`); 최소 결과: (?<minimum>[^;]+); 선택 결과: (?<optional>[^;]+); 확장 결과: (?<expanded>[^;]+); 사람 검토 경계: (?<humanReview>.+)$/u.exec(line)?.groups;
    assert.ok(fields, `${product}: ${goal} must keep request, minimum, optional, expanded, and human-review fields separate`);
    assert.deepEqual(artifactIds(fields.minimum), layers.minimum, `${product}: ${goal} minimum artifacts`);
    const optionalCompetency = competencyBlock(competencySource, layers.competency.optionalHeading);
    const expandedCompetency = competencyBlock(competencySource, layers.competency.expandedHeading);
    const reviewCompetency = competencyBlock(competencySource, layers.competency.reviewHeading);
    assertNormalizedOutcomeMeaning(competencyField(optionalCompetency, "선택 결과"), layers.competency.optional, `${goal}: authoritative optional outcome`);
    assertNormalizedOutcomeMeaning(fields.optional, layers.competency.optional, `${product}: ${goal} optional outcome`);
    assertNormalizedOutcomeMeaning(competencyField(expandedCompetency, "확장 결과"), layers.competency.expanded, `${goal}: authoritative expanded outcome`);
    assertNormalizedOutcomeMeaning(fields.expanded, layers.competency.expanded, `${product}: ${goal} expanded outcome`);
    assertHumanDecision(competencyField(reviewCompetency, "사람 결정"), layers.competency.reviewers, `${goal}: authoritative human decision`);
    assertHumanDecision(fields.humanReview, layers.competency.reviewers, `${product}: ${goal} human-review boundary`);
    summaries.set(goal, fields);
  }
  return summaries;
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

test("README exposes every shipped skill, role asset, profile, and canonical template", async () => {
  const readme = await readFile(readmePath, "utf8");
  assert.deepEqual(tableIds(readme, "스킬 카탈로그"), skillIds);
  assert.deepEqual(tableIds(readme, "전문 역할 프롬프트"), roleIds);
  assert.deepEqual(tableIds(readme, "이미지 전문 역할 레지스트리"), imageRoleIds);
  assert.deepEqual(tableIds(readme, "Canonical Artifact 템플릿"), templateIds);

  const [actualSkills, actualRoles, actualTemplates, actualProfiles] = await Promise.all([
    readdir(path.join(pluginRoot, "skills"), { withFileTypes: true }),
    readdir(path.join(pluginRoot, "agents"), { withFileTypes: true }),
    readdir(path.join(pluginRoot, "assets/templates"), { withFileTypes: true }),
    readdir(path.join(pluginRoot, "references/profiles"), { withFileTypes: true }),
  ]);
  assert.deepEqual(
    actualSkills.filter((entry) => entry.isDirectory()).map(({ name }) => name).sort(),
    [...skillIds].sort(),
  );
  assert.deepEqual(
    actualRoles.filter((entry) => entry.isFile() && entry.name.endsWith(".md")).map(({ name }) => name.slice(0, -3)).sort(),
    [...roleIds, ...imageRoleIds].sort(),
  );
  assert.deepEqual(
    actualTemplates.filter((entry) => entry.isDirectory()).map(({ name }) => name).sort(),
    [...templateIds].sort(),
  );
  assert.deepEqual(
    actualProfiles.filter((entry) => entry.isFile() && entry.name.endsWith(".json")).map(({ name }) => name.slice(0, -5)).sort(),
    ["live-service-rpg", "mobile", "pc-console", "universal-core"],
  );
  for (const profile of ["universal-core", "live-service-rpg", "mobile", "pc-console"]) {
    assert.ok(readme.includes(`| \`${profile}\` |`), `missing profile: ${profile}`);
  }
});

test("README documents truthful installation, workflow, safety, visualization, export, and support boundaries", async () => {
  const readme = await readFile(readmePath, "utf8");
  const requiredHeadings = [
    "설치",
    "업데이트와 제거",
    "플러그인 구조",
    "작동 방식",
    "프로필 합성",
    "근거와 최신성 정책",
    "Canonical Artifact",
    "사용 예시",
    "Skillstead 도식화",
    "MD, PDF, DOCX, PPTX 내보내기",
    "책임 있는 설계 게이트",
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
    "codex plugin add game-design-studio@game-design-suite",
    "codex plugin remove game-design-studio@game-design-suite",
  ]) {
    assert.ok(readme.includes(command), `missing verified CLI command: ${command}`);
  }

  for (const phrase of [
    "최대 3개",
    "병렬",
    "순차 fallback",
    "결정론",
    "universal-core",
    "conflict decision record",
    "1차 출처",
    "검색일",
    "조작하지",
    "hard No-Go",
    "fail-closed",
    "SVG lint",
    "정확한 2× PNG",
    "네이티브 자동 발견을 보장하지",
    "IMAGE_GEN_MODE",
    "prompt-only",
    "production-candidate는 release/legal/production approval이 아님",
  ]) {
    assert.ok(readme.includes(phrase), `missing operational boundary: ${phrase}`);
  }

  for (const example of [
    "새 GDD",
    "시스템 명세",
    "경제와 LiveOps 리뷰",
    "AI NPC 안전 검토",
    "게임 기획 도식화",
    "문서 내보내기",
  ]) {
    assert.match(readme, new RegExp(`^### ${example}$`, "m"));
  }
});

test("README provides package-safe Studio exploration paths, requests, outputs, and reading order", async () => {
  const readme = await readFile(readmePath, "utf8");
  assertStudioUseCaseReadme(readme);
  const section = readmeSection(readme, "활용 경로와 결과");
  const [, allowedOutputs] = await Promise.all([assertRepositoryCheckoutGuides(section), assertRepresentativeOutputOwnership()]);
  await assertGoalOutputSummary(section, studioGoalOutputLayers, "Studio product README");
  for (const { label, rowOutput } of directOutputOwnership) {
    const row = representativeTableRows(section).find(({ cells }) => cells[0] === label);
    assert.ok(row, `owned-output table row missing: ${label}`);
    assert.deepEqual(row.cells[2].match(/`([^`]+)`/g)?.map((output) => output.slice(1, -1)), [rowOutput], `${label}: README promises exactly one owned output`);
    assert.equal(allowedOutputs.get(label).find((output) => output === rowOutput), rowOutput, `${label}: README output must be allowed by source skill`);
  }
  assert.deepEqual(splitMarkdownTableRow("| parser smoke | `literal | pipe` | result |"), ["parser smoke", "`literal | pipe`", "result"], "table parser must keep code-span pipes in one cell");

  assert.throws(
    () => assertStudioUseCaseReadme(swapRepresentativeTableCells(readme, "경제·LiveOps")),
    "economy table command/result swaps must fail",
  );
  assert.throws(
    () => assertStudioUseCaseReadme(swapRepresentativeTableCells(readme, "제작 검토·출력")),
    "production table command/result swaps must fail",
  );
  assert.throws(
    () => assertStudioUseCaseReadme(readme.replace("복수 영역이 얽히거나 범위가 불명확하면", "한 작업 범위가 분명하면")),
    "direct/orchestrator inversions must fail",
  );
  await assert.rejects(
    assertRepositoryCheckoutGuides(section.replace("`guides/game-design-studio/use-cases/README.md`", "[Studio 활용 사례 인덱스](../guides/game-design-studio/use-cases/README.md)")),
    /repository-only relative guide links/,
    "repository-only relative links must fail even when they are valid in the repository",
  );
  await assert.rejects(
    assertRepositoryCheckoutGuides(section.replace("`guides/game-design-studio/use-cases/concept-scenarios.md`", "[Studio 콘셉트 사례](https://github.com/freelife/game-design-plugin/tree/main/guides/game-design-studio/use-cases/concept-scenarios.md)")),
    /fabricated GitHub repository or tree URL/,
    "fabricated remote guide links must fail",
  );
  const swappedH1s = studioRepositoryCheckoutGuides.map((entry) => [...entry]);
  [swappedH1s[0][2], swappedH1s[1][2]] = [swappedH1s[1][2], swappedH1s[0][2]];
  await assert.rejects(assertRepositoryCheckoutGuides(section, swappedH1s), /exact first H1/, "wrong-but-valid path/H1 identities must fail");
  const swappedPaths = section
    .replace("`guides/game-design-studio/use-cases/README.md`", "`__temporary__`")
    .replace("`guides/game-design-studio/use-cases/competency-paths.md`", "`guides/game-design-studio/use-cases/README.md`")
    .replace("`__temporary__`", "`guides/game-design-studio/use-cases/competency-paths.md`");
  await assert.rejects(assertRepositoryCheckoutGuides(swappedPaths), /checkout-only path must be plain code/, "wrong-but-valid checkout paths must fail");
  assert.throws(() => assertStudioUseCaseReadme(readme.replace("`economy-balance`의 source/sink 가정과 guardrail·rollback 질문", "`economy-balance`와 `liveops-experiment-event` 초안")), "economy direct row must reject two outputs");
  assert.throws(() => assertStudioUseCaseReadme(readme.replace("`production-scope-risk`의 scope·dependency·kill criteria 초안", "`production-scope-risk`, review 기록과 `export-manifest.yml` 준비 상태")), "production direct row must reject review/export preclaims");
  await assert.rejects(
    assertGoalOutputSummary(section.replace("최소 결과: `game-design-brief`, `vision-pillars`; 선택 결과:", "최소 결과: `game-design-brief`; 선택 결과: `vision-pillars`,"), studioGoalOutputLayers, "mutated Studio product README"),
    "vision-pillars must remain a minimum result",
  );
  const economySkill = await readFile(path.join(pluginRoot, "skills/design-game-economy-and-liveops/SKILL.md"), "utf8");
  assert.throws(() => assertCanonicalOutputContract(directOutputOwnership[0], economySkill.replace("Produce either", "Deprecated: Produce either")), "output-contract prefixes must fail exact section-local matching");
});

test("Studio goal summaries reject swapped outcome layers, auto-approval, and a removed reviewer", async () => {
  const section = readmeSection(await readFile(readmePath, "utf8"), "활용 경로와 결과");
  const swappedLayers = section.replace(
    "선택 결과: 검토 목적이 분명한 이미지 prompt 또는 source-backed 도식 계획; 확장 결과: 사람 검토와 형식별 QA를 통과한 팀 brief 또는 공개 가능한 판단 증거",
    "선택 결과: 사람 검토와 형식별 QA를 통과한 팀 brief 또는 공개 가능한 판단 증거; 확장 결과: 검토 목적이 분명한 이미지 prompt 또는 source-backed 도식 계획",
  );
  await assert.rejects(
    assertGoalOutputSummary(swappedLayers, studioGoalOutputLayers, "mutated Studio product README"),
    "Studio summary must reject an optional/expanded outcome swap",
  );
  await assert.rejects(
    assertGoalOutputSummary(section.replace("실제 design owner가 pillar와 non-goal을 승인·수정·보류합니다.", "자동 승인됩니다."), studioGoalOutputLayers, "mutated Studio product README"),
    "Studio summary must reject auto approval",
  );
  await assert.rejects(
    assertGoalOutputSummary(section.replace("실제 design owner가 pillar와 non-goal을 승인·수정·보류합니다.", "pillar와 non-goal을 검토합니다."), studioGoalOutputLayers, "mutated Studio product README"),
    "Studio summary must reject a removed human decision-maker",
  );
});

test("README documents the closed Studio document-quality workflow and installed contracts", async () => {
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
  for (const imageContract of [
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
  ]) assert.ok(readme.includes(imageContract), `missing image operating contract: ${imageContract}`);
  assert.match(readme, /apply-document-quality-profile.*game-design-brief.*mobile.*function-first/su);
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

  const stagingRoot = await mkdtemp(path.join(os.tmpdir(), "studio-readme-inventory-"));
  temporaryDirectories.push(stagingRoot);
  const build = await buildProduct({ repoRoot, productName: "game-design-studio", stagingRoot, sourceDateEpoch: 0 });
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
});

test("root README describes both packaged quality-profile catalogs without source attribution claims", async () => {
  const readme = await readFile(path.join(repoRoot, "README.md"), "utf8");
  assert.deepEqual(tableIds(readme, "설치된 top-level scripts"), topLevelScriptIds);
  assert.deepEqual(tableIds(readme, "설치된 document-quality 경로"), documentQualityPaths);
  for (const contract of [
    "Studio 17개",
    "Career 13개",
    "additive overlay 3개",
    "neutral reference preset 7개",
    "authoring-only source",
    "공식 endorsement",
    "plugins/game-design-studio/references/shared/document-quality/",
    "plugins/game-design-career/references/shared/document-quality/",
  ]) {
    assert.ok(readme.includes(contract), `missing root quality-profile contract: ${contract}`);
  }
});

test("README local links resolve inside the source plugin root", async () => {
  const links = localMarkdownLinks(await readFile(readmePath, "utf8"));
  assert.ok(links.length > 0, "README must link to inspectable local contracts");
  for (const target of links) await assertContainedLink(pluginRoot, readmePath, target);
});

test("source and clean-built Markdown links stay inside their own plugin roots", async () => {
  await assertAllMarkdownLinksContained(pluginRoot);
  const stagingRoot = await mkdtemp(path.join(os.tmpdir(), "studio-readme-links-"));
  temporaryDirectories.push(stagingRoot);
  const build = await buildProduct({ repoRoot, productName: "game-design-studio", stagingRoot, sourceDateEpoch: 0 });
  await assertAllMarkdownLinksContained(build.outputDir);
});

test("link containment rejects parent traversal and symlink escapes", async () => {
  const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), "studio-link-containment-"));
  temporaryDirectories.push(fixtureRoot);
  const docsRoot = path.join(fixtureRoot, "plugin");
  const outsideRoot = path.join(fixtureRoot, "outside");
  await Promise.all([mkdir(docsRoot, { recursive: true }), mkdir(outsideRoot, { recursive: true })]);
  const markdownFile = path.join(docsRoot, "README.md");
  await assert.rejects(assertContainedLink(docsRoot, markdownFile, "../../../../etc/hosts"), /escapes plugin root/);
  await symlink(outsideRoot, path.join(docsRoot, "escape"));
  await assert.rejects(assertContainedLink(docsRoot, markdownFile, "escape/secret.md"), /traverses symlink/);
});

test("release-bound source and built text contain no user or workspace absolute paths", async () => {
  const stagingRoot = await mkdtemp(path.join(os.tmpdir(), "studio-portable-text-"));
  temporaryDirectories.push(stagingRoot);
  const build = await buildProduct({ repoRoot, productName: "game-design-studio", stagingRoot, sourceDateEpoch: 0 });
  const textExtensions = new Set(["", ".js", ".json", ".md", ".mjs", ".txt", ".yaml", ".yml"]);
  const forbidden = /(?:\/Users\/[A-Za-z0-9._-]+\/|\/home\/[A-Za-z0-9._-]+\/|[A-Za-z]:\\Users\\[^\\\s]+\\)/u;
  for (const root of [pluginRoot, build.outputDir]) {
    for (const file of await walkFiles(root)) {
      if (!textExtensions.has(path.extname(file))) continue;
      assert.doesNotMatch(await readFile(file, "utf8"), forbidden, `machine-specific path in ${path.relative(root, file)}`);
    }
  }
});

test("portable CODEX_HOME shell expansion preserves spaces and honors an override", async () => {
  const command = 'CODEX_ROOT="${CODEX_HOME:-$HOME/.codex}"; printf "%s" "$CODEX_ROOT"';
  const fallback = spawnSync("/bin/sh", ["-c", command], {
    encoding: "utf8",
    env: { HOME: "/tmp/home with spaces", PATH: process.env.PATH },
  });
  assert.equal(fallback.status, 0, fallback.stderr);
  assert.equal(fallback.stdout, "/tmp/home with spaces/.codex");
  const overridden = spawnSync("/bin/sh", ["-c", command], {
    encoding: "utf8",
    env: { HOME: "/tmp/ignored home", CODEX_HOME: "/tmp/custom codex", PATH: process.env.PATH },
  });
  assert.equal(overridden.status, 0, overridden.stderr);
  assert.equal(overridden.stdout, "/tmp/custom codex");

  const readme = await readFile(readmePath, "utf8");
  assert.ok(readme.includes('CODEX_ROOT="${CODEX_HOME:-$HOME/.codex}"'));
  assert.ok(readme.includes('python3 "$CODEX_ROOT/skills/.system/skill-creator/scripts/quick_validate.py"'));
  assert.ok(readme.includes('python3 "$CODEX_ROOT/skills/.system/plugin-creator/scripts/validate_plugin.py"'));
  const validationBlocks = [...readme.matchAll(/```bash\n([\s\S]*?)```/gu)]
    .map((match) => match[1])
    .filter((block) => block.includes("CODEX_ROOT="));
  assert.equal(validationBlocks.length, 2);
  for (const block of validationBlocks) {
    const syntax = spawnSync("/bin/bash", ["-n"], { encoding: "utf8", input: block });
    assert.equal(syntax.status, 0, syntax.stderr);
  }
});

test("source-local shared link mirrors remain byte-identical to canonical shared inputs", async () => {
  const mirrors = [
    ["shared/responsible-design/gates.json", "references/shared/responsible-design/gates.json"],
    ["shared/knowledge/trends/2026-current-practices.md", "references/shared/knowledge/trends/2026-current-practices.md"],
    ["shared/knowledge/trends/source-register.json", "references/shared/knowledge/trends/source-register.json"],
    ["shared/templates/review-finding.md", "assets/shared/templates/review-finding.md"],
  ];
  for (const [canonical, mirror] of mirrors) {
    assert.deepEqual(
      await readFile(path.join(repoRoot, canonical)),
      await readFile(path.join(pluginRoot, mirror)),
      `${mirror} must match ${canonical}`,
    );
  }
});

test("README explains the source overlay and complete independent built-plugin structure", async () => {
  const readme = await readFile(readmePath, "utf8");
  for (const pathOrCount of [
    "products/game-design-studio/plugin",
    "plugins/game-design-studio",
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
    "references/profiles/",
    "assets/templates/ (15개)",
    "assets/product-mark.svg",
    "BUILD-MANIFEST.json",
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
  assert.ok(readme.includes("1개 universal core와 3개 선택 프로필"));
  assert.ok(readme.includes("저수준 `buildProduct()` 출력에는 `BUILD-MANIFEST.json`이 없습니다"));
  assert.ok(readme.includes("이 suite distribution snapshot에는 `BUILD-MANIFEST.json`이 있으며"));
});
