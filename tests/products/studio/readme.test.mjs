import assert from "node:assert/strict";
import { createHash } from "node:crypto";
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
const canonicalSourceLinks = new Map([
  ["README.md", new Map([
    ["../../../shared/reference-intelligence/skills/analyze-game-design-references/SKILL.md", "reference-intelligence/skills/analyze-game-design-references/SKILL.md"],
    ["../../../shared/reference-intelligence/skills/maintain-game-design-glossary/SKILL.md", "reference-intelligence/skills/maintain-game-design-glossary/SKILL.md"],
  ])],
  ["skills/define-game-vision/SKILL.md", new Map([["../../../../../shared/responsible-design/gates.json", "responsible-design/gates.json"]])],
  ["skills/design-game-content/SKILL.md", new Map([["../../../../../shared/responsible-design/gates.json", "responsible-design/gates.json"]])],
  ["skills/design-game-economy-and-liveops/SKILL.md", new Map([["../../../../../shared/responsible-design/gates.json", "responsible-design/gates.json"]])],
  ["skills/design-game-systems/SKILL.md", new Map([["../../../../../shared/responsible-design/gates.json", "responsible-design/gates.json"]])],
  ["skills/design-player-experience/SKILL.md", new Map([["../../../../../shared/responsible-design/gates.json", "responsible-design/gates.json"]])],
  ["skills/plan-game-production/SKILL.md", new Map([["../../../../../shared/responsible-design/gates.json", "responsible-design/gates.json"]])],
  ["skills/review-game-design/SKILL.md", new Map([["../../../../../shared/templates/review-finding.md", "templates/review-finding.md"]])],
  ["references/methods/content-specification.md", new Map([["../../../../../shared/responsible-design/gates.json", "responsible-design/gates.json"]])],
  ["references/methods/economy-liveops.md", new Map([
    ["../../../../../shared/responsible-design/gates.json", "responsible-design/gates.json"],
    ["../../../../../shared/knowledge/trends/2026-current-practices.md", "knowledge/trends/2026-current-practices.md"],
    ["../../../../../shared/knowledge/trends/source-register.json", "knowledge/trends/source-register.json"],
  ])],
  ["references/methods/player-experience.md", new Map([
    ["../../../../../shared/responsible-design/gates.json", "responsible-design/gates.json"],
    ["../../../../../shared/knowledge/trends/2026-current-practices.md", "knowledge/trends/2026-current-practices.md"],
    ["../../../../../shared/knowledge/trends/source-register.json", "knowledge/trends/source-register.json"],
  ])],
  ["references/methods/production.md", new Map([
    ["../../../../../shared/responsible-design/gates.json", "responsible-design/gates.json"],
    ["../../../../../shared/knowledge/trends/2026-current-practices.md", "knowledge/trends/2026-current-practices.md"],
    ["../../../../../shared/knowledge/trends/source-register.json", "knowledge/trends/source-register.json"],
  ])],
  ["references/methods/system-specification.md", new Map([["../../../../../shared/responsible-design/gates.json", "responsible-design/gates.json"]])],
  ["references/methods/vision.md", new Map([["../../../../../shared/responsible-design/gates.json", "responsible-design/gates.json"]])],
]);

test.afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

const skillIds = [
  "orchestrate-game-design-project",
  "apply-document-quality-profile",
  "define-game-vision",
  "design-game-systems",
  "design-game-content",
  "design-cutscene-visual-preproduction",
  "design-player-experience",
  "design-game-economy-and-liveops",
  "plan-game-production",
  "review-game-design",
  "visualize-game-design",
  "export-game-design-documents",
  "plan-image-assets",
  "generate-image-assets",
  "review-image-assets",
  "polish-game-design-writing",
];

const roleIds = [
  "lead-game-designer",
  "document-quality-editor",
  "system-economy-designer",
  "content-narrative-designer",
  "ux-accessibility-reviewer",
  "liveops-data-designer",
  "production-feasibility-critic",
  "combat-encounter-reviewer",
  "level-puzzle-reviewer",
  "game-design-writing-editor",
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
  "analyze-game-design-references.mjs",
  "build-image-asset-plan.mjs",
  "capability-probe.mjs",
  "capture-design-memory.mjs",
  "check-game-design-updates.mjs",
  "compile-image-prompts.mjs",
  "data-only-snapshot.mjs",
  "estimate-cutscene-image-cost.mjs",
  "generate-openai-images.mjs",
  "inspect-game-design-plugin-updates.mjs",
  "load-memory-config.mjs",
  "maintain-design-memory.mjs",
  "manage-game-design-glossary.mjs",
  "plan-cutscene-visual-preproduction.mjs",
  "quality-source-anchors.mjs",
  "resolve-quality-profile.mjs",
  "retrieve-design-memory.mjs",
  "review-cutscene-continuity.mjs",
  "run-approved-cutscene-image-stage.mjs",
  "run-game-design-writing-polish.mjs",
  "run-image-asset-workflow.mjs",
  "stop-artifact-review.mjs",
  "validate-artifact.mjs",
  "validate-cutscene-visual-preproduction.mjs",
  "validate-design-memory.mjs",
  "validate-game-design-writing-language.mjs",
  "validate-image-assets.mjs",
  "validate-image-config.mjs",
  "validate-quality-profile.mjs",
  "validate-reference-intelligence.mjs",
  "validate-reference-preset.mjs",
  "validate-writing-revision.mjs",
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

function tableIds(markdown, heading, level = 2) {
  const marker = `${"#".repeat(level)} ${heading}`;
  const start = markdown.indexOf(marker);
  assert.notEqual(start, -1, `missing section: ${heading}`);
  const remainder = markdown.slice(start + marker.length);
  const nextHeading = remainder.search(new RegExp(`\\n#{1,${level}} `, "u"));
  const section = nextHeading < 0 ? remainder : remainder.slice(0, nextHeading);
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

async function assertCanonicalSourceLink(markdownFile, target, expectedRelativePath) {
  const sharedRoot = await realpath(path.join(repoRoot, "shared"));
  const targetReal = await realpath(path.resolve(path.dirname(markdownFile), target));
  assert.equal(
    path.relative(sharedRoot, targetReal),
    expectedRelativePath,
    `source-only canonical link must resolve to the approved shared input: ${target}`,
  );
}

async function assertAllMarkdownLinksContained(root, sourceLinks = new Map()) {
  const markdownFiles = (await walkFiles(root)).filter((file) => file.endsWith(".md"));
  for (const markdownFile of markdownFiles) {
    const markdown = await readFile(markdownFile, "utf8");
    const relativeMarkdownFile = path.relative(root, markdownFile).split(path.sep).join("/");
    for (const target of localMarkdownLinks(markdown)) {
      const expectedCanonicalTarget = sourceLinks.get(relativeMarkdownFile)?.get(target);
      if (expectedCanonicalTarget) {
        await assertCanonicalSourceLink(markdownFile, target, expectedCanonicalTarget);
      } else {
        await assertContainedLink(root, markdownFile, target);
      }
    }
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
  ["규칙·핵심 루프", { competencyHeading: "ST-C01 플레이어 경험과 게임 비전", minimum: ["vision-pillars", "game-design-brief", "game-design-review"] }],
  ["시스템", { competencyHeading: "ST-C03 규칙·상태·예외·데이터", minimum: ["system-specification", "rule-exception-matrix", "data-schema-table-contract"] }],
  ["UX·접근성", { competencyHeading: "ST-C04 UI·UX·온보딩·접근성", minimum: ["ui-ux-flow-state", "accessibility-platform-matrix", "game-design-review"] }],
  ["콘텐츠·퀘스트", { competencyHeading: "ST-C05 콘텐츠·내러티브·퀘스트·NPC", minimum: ["narrative-quest-npc", "character-skill-combat-monster", "game-design-review"] }],
  ["경제·LiveOps", { competencyHeading: "ST-C07 성장·경제·밸런스·LiveOps", minimum: ["economy-balance", "liveops-experiment-event", "game-design-review"] }],
  ["전체 프로젝트", { competencyHeading: "ST-C08 제작·검토·이미지·출력", minimum: ["production-scope-risk", "game-design-review", "export-preparation-manifest"] }],
]);

const studioRouteSnapshot = new Map([
  ["규칙·핵심 루프", ["ST-C01 플레이어 경험과 게임 비전", "762cb46b68d03b05870e32df687a8ce81196056ca2e47d1a0ac12424ada9aff1", "38a70ec770ea16754f76f0a4d3bf1e32e118b458a019f1c58b070fd52c162ad8", "16dcb91bee726bad9f69aa6422bdb9cc979cafc09394251abefd0a22705ab221", "f1d19c03b47e8783b21ba1ba32d630fcac645ae7fb41ebe3a0093e4802ec565f", "9c1a1846afa35a90455baa1e8c129d757421f437c871f7af97800483d093aeed", "750bb598d39be97df5e599a6bdaf13a15871fc5e44c511c3d5da82836bd8f6e2"]],
  ["시스템", ["ST-C03 규칙·상태·예외·데이터", "a06353e36fa9f3f465ea283796f2d400a51d789fdac45536d9b9fcfcb4b01b71", "c018994c23be32c294a2d88ab53570aa9879ae4e9259737be6de328d83ee44d5", "af08f7b4af35c8a47e4f291d5c3f84ade8fb0b70374f1d711d4206315e111fcd", "79b3bf803bf2757880723a94b761676111e008f928da737b6adcaeabe4d9ba0a", "d055b03ac1881532a52c4761a23c13f0649d5e0622e6bf24eaa994341637ff4d", "9b2365ecb61e2bb4355a13875482b54ef94183b1604ed5063ac51f394553c394"]],
  ["UX·접근성", ["ST-C04 UI·UX·온보딩·접근성", "a1b41bcc8ff1564476f1c649ca7cd46a1d3177dec142297dcfcabddc96c43d1b", "df5317d373d9b83a5b3c8a98b6a5f2b24079414ece84a1deec520c597801ee49", "bdd95d8dade7e63f8f6e12f28a4e2e2a2033ad535258b9408a88b44690f2a3b7", "1c6d347d284b6ab68d9358c52108717956465b9ef544d1fae466519dc5c09fb2", "658f38f1ad521b9d08adc3d02849f933a45181595c626760e42211161ccf8f3a", "d22e1843374c35ae4830425993518187ae5ec327b97936ba373d0b30a130b1b6"]],
  ["콘텐츠·퀘스트", ["ST-C05 콘텐츠·내러티브·퀘스트·NPC", "3067580859b32ae9790688b9ff6fe30ede2b5c8c38a5b24273c7cd8d34ac2bdd", "b8ceb125947c1b22b1b3eebb2add7e1a120132f6a81a8aac6a9dd8a2b7745321", "90d6cd23158e43cc88339e9b5a52dd902295fbb16c60176b236f9a2e5d66f6b3", "f0be1e0265318c241d274af4f3744c18ae56fddad26a9b2585a0cf012077d0e2", "18e58edf90ff467026491de0ff3b65f9792aa17e6da5e954d4c3b3f950a3d2ad", "54c90232303ecefca2e81740e7861afad6afd9146ef3258348fe82abaccf47f5"]],
  ["경제·LiveOps", ["ST-C07 성장·경제·밸런스·LiveOps", "9787c90c1d6f65692bff340b4657518c5b175ae3a6e6a1d23176c1e6649fca35", "7cfa812f9af6ff440803459fac7d5da123a109c27afcdab8c38c44e64dd5be2e", "259f3649898c9ecb6dd7e2e30f13b28a5e7e47d91b3bf409a56f682b52a930d4", "e1aa8bbf6696132cb86d578ef68dbe9b690fec3fdf15fd09f6f2c2579092784c", "805e5767dc3abb86f5860ff8c560e61d72faa362a29ca366439b89c0dae09df6", "73872bbcbb68cc6bcd83e7b045bc9878670844a2bd4933962073056e02bb6350"]],
  ["전체 프로젝트", ["ST-C08 제작·검토·이미지·출력", "1a6b13c519879b0bf3c13911d028e7a2ab78323f61e756d8e8a4eaa0044eab2c", "9dd9732790d2e1b29fad9cbe3c2cf6be2e328d3e0ce8bd876709399d16ee221f", "6ab10636b16381bb34f74297b2ce7e7f92a3f2254ba74e42a554986de33f344b", "3e895f1afdf89ac642bcf84d0b22ccebeffb0238647911e0bf518ea5d68f73f9", "d3265ea853c8b75e774daa8ec819689240ece8cd77762cc3dce6ad75a1590e73", "d623d61bec8afa412d7cd25c8fece231c36382f4219fc081f1d6606c3134d6a0"]],
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
  "| 새 게임 GDD | `$game-design-studio:orchestrate-game-design-project 4인 협동 탐험 게임의 대상 플레이어, 플레이 경험의 약속, 핵심 플레이 흐름, 제외 목표와 시험 제작 질문을 정리해.` | 게임 기획 요약서(`game-design-brief`)와 게임 방향 원칙(`vision-pillars`)을 담은 기준 기획 폴더 초안 |",
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
    .map((line) => ({ line, cells: splitMarkdownTableRow(line) }))
    .filter(({ cells }) => cells.length === 3);
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

function markdownSubsection(markdown, heading, depth) {
  const marker = `${"#".repeat(depth)} ${heading}\n`;
  const start = markdown.indexOf(marker);
  assert.notEqual(start, -1, `missing ${heading}`);
  const bodyStart = start + marker.length;
  const next = markdown.slice(bodyStart).search(new RegExp(`^#{1,${depth}} `, "m"));
  return markdown.slice(bodyStart, next === -1 ? markdown.length : bodyStart + next).trim();
}

function normalizedCardText(value) {
  return value.replace(/\s+/gu, " ").trim();
}

function snapshotDigest(value) {
  return createHash("sha256").update(normalizedCardText(value)).digest("hex");
}

function resultField(value, label) {
  const match = new RegExp(`\\*\\*${label}:\\*\\* (.+)$`, "mu").exec(value);
  assert.ok(match, `missing ${label}`);
  return match[1];
}

function routeCard(section, title) {
  const marker = `### ${title}\n`;
  const start = section.indexOf(marker);
  const next = section.indexOf("\n### ", start + marker.length);
  assert.notEqual(start, -1, `route card ${title}`);
  return section.slice(start + marker.length, next === -1 ? undefined : next).trim();
}

async function assertGoalOutputSummary(section, goals, product, competencySourceOverride) {
  assert.match(section, /^### 대표 작업 경로$/mu, `${product}: readable work-route heading`);
  assert.match(section, /^\| 목표 \| 시작 스킬 \|$/mu, `${product}: concise route summary table`);
  const competencySource = competencySourceOverride ?? await readFile(path.join(repoRoot, "guides/game-design-studio/use-cases/competency-paths.md"), "utf8");
  const cardsStart = section.indexOf("### 대표 작업 경로\n");
  const cardsEnd = section.indexOf("\n### 대표 요청과 예상 결과", cardsStart);
  assert.notEqual(cardsStart, -1, `${product}: route-card start`);
  assert.notEqual(cardsEnd, -1, `${product}: route-card end`);
  const actualTitles = [...section.slice(cardsStart, cardsEnd).matchAll(/^### (.+)$/gmu)].map((match) => match[1]).slice(1);
  assert.deepEqual(actualTitles, [...goals.keys()], `${product}: six route cards keep their exact ordered headings`);
  assert.deepEqual([...studioRouteSnapshot.keys()], [...goals.keys()], `${product}: independent six-card snapshot order`);
  for (const [title, layers] of goals) {
    const body = routeCard(section, title);
    for (const heading of ["준비 입력", "연결 흐름", "예상 결과"]) assert.match(body, new RegExp(`^#### ${heading}$`, "mu"), `${product}: ${title} ${heading} card`);
    assert.match(body, /^#### 사람 검토(?:·근거)?$/mu, `${product}: ${title} human-review card`);
    const source = competencyBlock(competencySource, layers.competencyHeading);
    const sourceInput = markdownSubsection(source, "준비 입력", 3);
    const sourceChain = markdownSubsection(source, "스킬·템플릿 흐름", 3);
    const sourceResults = markdownSubsection(source, "결과물", 3);
    const sourceReview = markdownSubsection(source, "검토와 승인", 3);
    const cardInput = markdownSubsection(body, "준비 입력", 4);
    const cardChain = markdownSubsection(body, "연결 흐름", 4);
    const cardResults = markdownSubsection(body, "예상 결과", 4);
    const reviewHeading = /^#### 사람 검토·근거$/mu.test(body) ? "사람 검토·근거" : "사람 검토";
    const cardReview = markdownSubsection(body, reviewHeading, 4);
    const [sourceHeading, inputHash, chainHash, minimumHash, optionalHash, expandedHash, reviewHash] = studioRouteSnapshot.get(title);
    assert.equal(layers.competencyHeading, sourceHeading, `${product}: ${title} independent source heading`);
    for (const [field, value, expectedHash] of [["input", sourceInput, inputHash], ["chain", sourceChain, chainHash], ["minimum", resultField(sourceResults, "최소 결과"), minimumHash], ["optional", resultField(sourceResults, "선택 결과"), optionalHash], ["expanded", resultField(sourceResults, "확장 결과"), expandedHash], ["review", sourceReview, reviewHash]]) {
      assert.equal(snapshotDigest(value), expectedHash, `${product}: ${title} source ${field} snapshot`);
    }
    assert.equal(normalizedCardText(cardInput), normalizedCardText(sourceInput), `${product}: ${title} source-derived inputs`);
    assert.equal(normalizedCardText(cardChain), normalizedCardText(sourceChain), `${product}: ${title} full source-derived skill chain`);
    const fields = /^- 최소: (?<minimum>.+)\n- 선택: (?<optional>.+)\n- 확장: (?<expanded>.+)$/mu.exec(cardResults)?.groups;
    assert.ok(fields, `${product}: ${title} output layers stay separate`);
    assert.equal(normalizedCardText(fields.minimum), normalizedCardText(resultField(sourceResults, "최소 결과")), `${product}: ${title} source-derived minimum result`);
    assert.equal(normalizedCardText(fields.optional), normalizedCardText(resultField(sourceResults, "선택 결과")), `${product}: ${title} source-derived optional result`);
    assert.equal(normalizedCardText(fields.expanded), normalizedCardText(resultField(sourceResults, "확장 결과")), `${product}: ${title} source-derived expanded result`);
    assert.deepEqual(artifactIds(fields.minimum), layers.minimum, `${product}: ${title} independent minimum-output manifest`);
    assert.equal(normalizedCardText(cardReview.replace(/^- /mu, "")), normalizedCardText(sourceReview), `${product}: ${title} source-derived human review`);
    for (const [field, value, expectedHash] of [["input", cardInput, inputHash], ["chain", cardChain, chainHash], ["minimum", fields.minimum, minimumHash], ["optional", fields.optional, optionalHash], ["expanded", fields.expanded, expandedHash], ["review", cardReview.replace(/^- /mu, ""), reviewHash]]) {
      assert.equal(snapshotDigest(value), expectedHash, `${product}: ${title} README ${field} snapshot`);
    }
  }
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
  assert.match(notices, /0\.9\.0/);
  assert.match(notices, /Apache-2\.0/);
  assert.match(notices, /Copyright 2026 Kyungseo Park/);
  assert.match(notices, /49/);
  assert.match(notices, /docs\//);
});

test("README exposes every shipped skill, role asset, profile, and canonical template", async () => {
  const readme = await readFile(readmePath, "utf8");
  assert.match(readme, /제품 스킬 16개/u, "README states the direct product-skill count");
  assert.match(readme, /설치 스킬(?:은|이) 24개/u, "README states the complete installed-skill count");
  assert.doesNotMatch(readme, /Skillstead `svg-infographic` 0\.8\.3/u, "README does not advertise the superseded Skillstead release");
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
    assertGoalOutputSummary(section.replace("- 최소: `vision-pillars`, `game-design-brief`, `game-design-review` 내용을 담은 기획 기준 문서와 근거·결정 기록.", "- 최소: `game-design-brief`, `game-design-review` 내용을 담은 기획 기준 문서와 근거·결정 기록."), studioGoalOutputLayers, "mutated Studio product README"),
    "vision-pillars must remain a minimum result",
  );
  const economySkill = await readFile(path.join(pluginRoot, "skills/design-game-economy-and-liveops/SKILL.md"), "utf8");
  assert.throws(() => assertCanonicalOutputContract(directOutputOwnership[0], economySkill.replace("Produce either", "Deprecated: Produce either")), "output-contract prefixes must fail exact section-local matching");
});

test("Studio goal summaries reject swapped outcome layers, auto-approval, and a removed reviewer", async () => {
  const section = readmeSection(await readFile(readmePath, "utf8"), "활용 경로와 결과");
  await assert.rejects(
    assertGoalOutputSummary(section.replace("- 선택: 검토 목적이 분명한 이미지 요청문 또는 근거가 연결된 도식 계획. 이미지 생성과 도식 변환 성공은 승인이 아닙니다.", "- 확장: 검토 목적이 분명한 이미지 요청문 또는 근거가 연결된 도식 계획. 이미지 생성과 도식 변환 성공은 승인이 아닙니다."), studioGoalOutputLayers, "mutated Studio product README"),
    "Studio cards must retain the optional result card",
  );
  await assert.rejects(
    assertGoalOutputSummary(section.replace("실제 기획 책임자가 대상 플레이어, 지킬 설계 원칙, 하지 않을 설계 원칙, 이번에 다루지 않을 목표와 다음 시험 제작 범위를 승인·수정·보류합니다.", "자동 승인"), studioGoalOutputLayers, "mutated Studio product README"),
    "Studio cards must reject auto approval",
  );
  await assert.rejects(
    assertGoalOutputSummary(section.replace("실제 기획 책임자가 대상 플레이어, 지킬 설계 원칙, 하지 않을 설계 원칙, 이번에 다루지 않을 목표와 다음 시험 제작 범위를 승인·수정·보류합니다.", "설계 원칙과 제외 목표를 검토"), studioGoalOutputLayers, "mutated Studio product README"),
    "Studio cards must retain a named reviewer",
  );
  await assert.rejects(
    assertGoalOutputSummary(section.replace("### 시스템", "### 규칙·핵심 루프"), studioGoalOutputLayers, "mutated Studio product README"),
    "Studio cards must retain exactly six ordered headings",
  );
  await assert.rejects(
    assertGoalOutputSummary(section.replace("\n### 대표 요청과 예상 결과", "\n### 추가 목표\n\n누락된 카드.\n\n### 대표 요청과 예상 결과"), studioGoalOutputLayers, "mutated Studio product README"),
    "Studio cards must reject an additional route heading",
  );
  const competencySource = await readFile(path.join(repoRoot, "guides/game-design-studio/use-cases/competency-paths.md"), "utf8");
  const sourceMinimum = "**최소 결과:** `vision-pillars`, `game-design-brief`, `game-design-review` 내용을 담은 기획 기준 문서와 근거·결정 기록.";
  await assert.rejects(
    assertGoalOutputSummary(
      section.replace("- 최소: `vision-pillars`, `game-design-brief`, `game-design-review` 내용을 담은 기획 기준 문서와 근거·결정 기록.", "- 최소: `game-design-brief`, `game-design-review` 내용을 담은 기획 기준 문서와 근거·결정 기록."),
      studioGoalOutputLayers,
      "concurrently shrunken Studio product README",
      competencySource.replace(sourceMinimum, "**최소 결과:** `game-design-brief`, `game-design-review` 내용을 담은 기획 기준 문서와 근거·결정 기록."),
    ),
    "independent minimum-output manifest rejects concurrent source and README shrinking",
  );
  const firstSource = competencyBlock(competencySource, "ST-C01 플레이어 경험과 게임 비전");
  const firstCard = routeCard(section, "규칙·핵심 루프");
  const sourceResults = markdownSubsection(firstSource, "결과물", 3);
  const cardResults = markdownSubsection(firstCard, "예상 결과", 4);
  const sourceFields = [
    ["input", markdownSubsection(firstSource, "준비 입력", 3), markdownSubsection(firstCard, "준비 입력", 4)],
    ["chain", markdownSubsection(firstSource, "스킬·템플릿 흐름", 3), markdownSubsection(firstCard, "연결 흐름", 4)],
    ["minimum", resultField(sourceResults, "최소 결과"), /^- 최소: (.+)$/mu.exec(cardResults)[1]],
    ["optional", resultField(sourceResults, "선택 결과"), /^- 선택: (.+)$/mu.exec(cardResults)[1]],
    ["expanded", resultField(sourceResults, "확장 결과"), /^- 확장: (.+)$/mu.exec(cardResults)[1]],
    ["review", markdownSubsection(firstSource, "검토와 승인", 3), markdownSubsection(firstCard, "사람 검토", 4).replace(/^- /mu, "")],
  ];
  for (const [field, sourceValue, cardValue] of sourceFields) {
    await assert.rejects(
      assertGoalOutputSummary(section.replace(cardValue, `${cardValue} 축소`), studioGoalOutputLayers, `concurrently shrunken ${field} README`, competencySource.replace(sourceValue, `${sourceValue} 축소`)),
      `independent Studio snapshot rejects concurrent ${field} source and README shrinking`,
    );
  }
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
    "IMAGE_PROVIDER=codex-first",
    "IMAGE_PROVIDER=openai를 명시적으로 선택했을 때만 사용합니다",
    "IMAGE_EMBEDDED_TEXT_LOCALE=ko-KR",
    "image_gen",
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
  assert.deepEqual(tableIds(readme, "설치된 최상위 스크립트 (top-level scripts)", 3), topLevelScriptIds);
  assert.deepEqual(tableIds(readme, "설치된 문서 품질 경로 (document-quality)", 3), documentQualityPaths);
  for (const contract of [
    /Studio 17개/u,
    /Career 13개/u,
    /추가형 오버레이\s*\(additive overlay\) 3개/u,
    /중립 참고 사전 설정\s*\(neutral reference preset\) 7개/u,
    /저작용 전용 출처\s*\(authoring-only source\)/u,
    /추천·보증\s*\(공식 endorsement\)/u,
    /plugins\/game-design-studio\/references\/shared\/document-quality\//u,
    /plugins\/game-design-career\/references\/shared\/document-quality\//u,
  ]) {
    assert.match(readme, contract, `missing root quality-profile contract: ${contract}`);
  }
});

test("README local links resolve inside the source plugin root", async () => {
  const links = localMarkdownLinks(await readFile(readmePath, "utf8"));
  assert.ok(links.length > 0, "README must link to inspectable local contracts");
  for (const target of links) {
    const expectedCanonicalTarget = canonicalSourceLinks.get("README.md")?.get(target);
    if (expectedCanonicalTarget) await assertCanonicalSourceLink(readmePath, target, expectedCanonicalTarget);
    else await assertContainedLink(pluginRoot, readmePath, target);
  }
});

test("source and clean-built Markdown links stay inside their own plugin roots", async () => {
  await assertAllMarkdownLinksContained(pluginRoot, canonicalSourceLinks);
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

test("source-local links do not shadow canonical shared template inputs", async () => {
  const prohibitedProductCopies = [
    "assets/shared/templates/review-finding.md",
    "references/shared/responsible-design/gates.json",
    "references/shared/knowledge/trends/2026-current-practices.md",
    "references/shared/knowledge/trends/source-register.json",
  ];
  for (const relativePath of prohibitedProductCopies) await assert.rejects(
    access(path.join(pluginRoot, relativePath)),
    { code: "ENOENT" },
    `${relativePath} must be supplied only by the canonical shared module during buildProduct`,
  );
});

test("review skill projects the canonical finding template into the package", async () => {
  const sourceLink = "../../../../../shared/templates/review-finding.md";
  const packagedLink = "../../assets/shared/templates/review-finding.md";
  const canonicalTemplate = await readFile(path.join(repoRoot, "shared/templates/review-finding.md"));
  const sourceSkillPath = path.join(pluginRoot, "skills/review-game-design/SKILL.md");
  const sourceSkill = await readFile(sourceSkillPath, "utf8");
  assert.match(sourceSkill, new RegExp(`\\[review-finding\\.md\\]\\(${sourceLink.replaceAll(".", "\\.")}\\)`, "u"));
  assert.deepEqual(await readFile(path.resolve(path.dirname(sourceSkillPath), sourceLink)), canonicalTemplate);

  const stagingRoot = await mkdtemp(path.join(os.tmpdir(), "studio-review-template-"));
  temporaryDirectories.push(stagingRoot);
  const build = await buildProduct({ repoRoot, productName: "game-design-studio", stagingRoot, sourceDateEpoch: 0 });
  const packagedSkillPath = path.join(build.outputDir, "skills/review-game-design/SKILL.md");
  const packagedSkill = await readFile(packagedSkillPath, "utf8");
  assert.match(packagedSkill, new RegExp(`\\[review-finding\\.md\\]\\(${packagedLink.replaceAll(".", "\\.")}\\)`, "u"));
  assert.deepEqual(await readFile(path.resolve(path.dirname(packagedSkillPath), packagedLink)), canonicalTemplate);
});

test("README explains the source overlay and complete independent built-plugin structure", async () => {
  const readme = await readFile(readmePath, "utf8");
  assert.doesNotMatch(readme, /agents\/ \(9개\)/u, "Studio README must not retain the stale nine-agent count");
  for (const pathOrCount of [
    "products/game-design-studio/plugin",
    "plugins/game-design-studio",
    ".codex-plugin/plugin.json",
    "skills/ (24개)",
    "<16개 Studio 제품 스킬>",
    "svg-infographic/",
    "agents/ (12개)",
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
  assert.ok(readme.includes("4개: universal core 1 + 선택 프로필 3"));
  assert.ok(readme.includes("저수준 `buildProduct()` 출력에는 `BUILD-MANIFEST.json`이 없습니다"));
  assert.ok(readme.includes("이 suite distribution snapshot에는 `BUILD-MANIFEST.json`이 있으며"));
});

test("Studio guide keeps the first-start checklist in a single ordered sequence", async () => {
  const guide = await readFile(path.join(repoRoot, "guides/game-design-studio/README.md"), "utf8");
  const section = guide.match(/## 처음 시작하기\n\n([\s\S]*?)\n\n---/u)?.[1] ?? "";
  const numbers = [...section.matchAll(/^(\d+)\./gmu)].map((match) => Number(match[1]));
  assert.deepEqual(numbers, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
});
