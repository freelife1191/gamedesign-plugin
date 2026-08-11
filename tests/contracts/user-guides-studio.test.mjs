import assert from "node:assert/strict";
import { lstat, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { collectProductInventory } from "../../tooling/lib/user-guides.mjs";

const root = fileURLToPath(new URL("../..", import.meta.url));
const requiredHeadings = [
  "목적과 최종 산출물",
  "사용할 때",
  "사용하지 않을 때",
  "필수 입력과 선택 입력",
  "Codex App 요청 예시",
  "Codex CLI 요청 예시",
  "내부 진행 흐름",
  "생성 파일과 결과 구조",
  "관련 템플릿·품질 프로필·전문 역할",
  "이미지·도식화 조건",
  "검토·승인 기준",
  "실패·fallback·재개 방법",
  "다음 작업 요청문",
  "관련 문서",
];
const sourceExceptions = {
  "generate-image-assets": { reason: "provider-helper", sourcePath: "products/game-design-studio/plugin/skills/generate-image-assets/SKILL.md", sourceSection: "Workflow", sourceTerms: ["prompt-only", "review-image-assets"], guideTerms: ["current artifact profile", "review-image-assets"] },
  "plan-image-assets": { reason: "image-planning-helper", sourcePath: "products/game-design-studio/plugin/skills/plan-image-assets/SKILL.md", sourceSection: "Workflow", sourceTerms: ["planning does not generate SVG or PNG bytes", "generate-image-assets"], guideTerms: ["prompt-only", "generate-image-assets", "visualize-game-design"] },
  "review-image-assets": { reason: "human-approval-helper", sourcePath: "products/game-design-studio/plugin/skills/review-image-assets/SKILL.md", sourceSection: "Workflow", sourceTerms: ["named human", "document-approved"], guideTerms: ["document-approved", "export-game-design-documents"] },
  "svg-infographic": { reason: "vendored-wrapper", sourcePath: "products/game-design-studio/plugin/skills/visualize-game-design/SKILL.md", sourceSection: "Workflow", sourceTerms: ["skills/svg-infographic", "visual QA"], guideTerms: ["lead-game-designer", "visualize-game-design"] },
};
const sourceExceptionReasons = new Set(["provider-helper", "image-planning-helper", "human-approval-helper", "vendored-wrapper"]);
const DIRECT_USE_OUTPUTS = Object.freeze({
  "apply-document-quality-profile": ["content.md", "evidence.yml", "export-manifest.yml"],
  "define-game-vision": ["content.md", "evidence.yml", "export-manifest.yml"],
  "design-game-content": ["content.md", "evidence.yml", "export-manifest.yml"],
  "design-game-economy-and-liveops": ["content.md", "evidence.yml", "export-manifest.yml"],
  "design-game-systems": ["content.md", "evidence.yml", "export-manifest.yml"],
  "design-player-experience": ["content.md", "evidence.yml", "export-manifest.yml"],
  "export-game-design-documents": ["content.md", "evidence.yml", "export-manifest.yml", "not-run", "evidence는 비어 있음"],
  "generate-image-assets": ["content.md", "evidence.yml", "export-manifest.yml", "assets/image-assets.yml", "assets/receipts/image-generation-<asset-id>-<attempt-id>.json"],
  "orchestrate-game-design-project": ["content.md", "evidence.yml", "export-manifest.yml"],
  "plan-game-production": ["content.md", "evidence.yml", "export-manifest.yml"],
  "plan-image-assets": ["content.md", "evidence.yml", "export-manifest.yml", "assets/image-assets.yml", "assets/prompts/image-prompts.md", "assets/prompts/image-prompts.json"],
  "review-game-design": ["content.md", "evidence.yml", "export-manifest.yml"],
  "review-image-assets": ["content.md", "evidence.yml", "export-manifest.yml", "assets/image-assets.yml", "assets/receipts/image-generation-<asset-id>-<attempt-id>.json", "decisions/image-review-<event-id>.json"],
  "svg-infographic": ["content.md", "evidence.yml", "export-manifest.yml", "assets/ 아래 source-mapped editable SVG"],
  "visualize-game-design": ["content.md", "evidence.yml", "export-manifest.yml", "assets/ 아래 source-mapped editable SVG"],
});
const NONEXISTENT_DIRECT_USE_PATHS = /(?:quality\/(?:selection-record|requirement-manifest)\.yml|narrative-quest-npc\.yml|character-skill-combat-monster\.yml|economy-balance\.yml|liveops-experiment-event\.yml|system-specification\.yml|rule-exception-matrix\.yml|ui-ux-flow-state\.yml|accessibility-platform-matrix\.yml|game-design-review\.yml|decision-change-log\.yml|production-scope-risk\.yml|qa-manifest\.yml|assets\/provenance\/|assets\/lifecycle-receipt\.yml|assets\/diagram(?:-index)?\.yml|assets\/render-evidence\.yml)/;
const DIRECT_USE_HANDOFFS = Object.freeze({
  "apply-document-quality-profile": [["비전 입력", "define-game-vision"], ["규칙 범위", "design-game-systems"], ["여러 route", "orchestrate-game-design-project"]],
  "define-game-vision": [["player verb", "design-game-systems"]],
  "design-game-content": [["콘텐츠가 시스템", "review-game-design"]],
  "design-game-economy-and-liveops": [["보호 기준", "review-game-design"]],
  "design-game-systems": [["rule precedence", "review-game-design"]],
  "design-player-experience": [["critical action", "review-game-design"]],
  "export-game-design-documents": [["정상적으로 검증된 preparation manifest의 요청 job이 `pending`", "downstream"], ["`unavailable` job의 capability가 `available`로 바뀌었", "export-game-design-documents"]],
  "generate-image-assets": [["named human approval", "review-image-assets"]],
  "orchestrate-game-design-project": [["선택된 route", "<selected-skill>"]],
  "plan-game-production": [["scope·risk", "review-game-design"]],
  "plan-image-assets": [["finite illustration job", "generate-image-assets"], ["Skillstead diagram slot", "visualize-game-design"]],
  "review-game-design": [["minimum fix", "review-game-design"], ["diagram gap", "visualize-game-design"], ["all blocker", "export-game-design-documents"]],
  "review-image-assets": [["format preflight", "export-game-design-documents"]],
  "svg-infographic": [["semantic validation", "visualize-game-design"]],
  "visualize-game-design": [["review finding", "review-game-design"], ["모든 blocker", "export-game-design-documents"]],
});
const WORKBENCH_LANES = Object.freeze({
  "orchestrate-game-design-project": "오케스트레이션",
  "define-game-vision": "도메인 설계",
  "design-game-systems": "도메인 설계",
  "design-game-content": "도메인 설계",
  "design-player-experience": "도메인 설계",
  "design-game-economy-and-liveops": "도메인 설계",
  "plan-game-production": "도메인 설계",
  "apply-document-quality-profile": "품질·검토",
  "humanize-korean": "품질·검토",
  "polish-game-design-writing": "품질·검토",
  "review-game-design": "품질·검토",
  "plan-image-assets": "이미지",
  "generate-image-assets": "이미지",
  "review-image-assets": "이미지",
  "visualize-game-design": "시각화",
  "archify": "시각화",
  "svg-infographic": "시각화",
  "export-game-design-documents": "출력",
});

function h2Headings(markdown) {
  return [...markdown.matchAll(/^## (.+)$/gm)].map((match) => match[1]);
}

function extractSection(markdown, heading) {
  const marker = `## ${heading}\n`;
  const start = markdown.indexOf(marker);
  assert.notEqual(start, -1, `missing section: ${heading}`);
  const bodyStart = start + marker.length;
  const next = markdown.indexOf("\n## ", bodyStart);
  return markdown.slice(bodyStart, next === -1 ? markdown.length : next).trim();
}

function extractSourceSection(markdown, heading) {
  const pattern = new RegExp(`^## ${heading}\\n`, "m");
  const match = pattern.exec(markdown);
  assert.ok(match, `missing source section: ${heading}`);
  const bodyStart = match.index + match[0].length;
  const next = markdown.slice(bodyStart).search(/^## /m);
  return markdown.slice(bodyStart, next === -1 ? markdown.length : bodyStart + next).trim();
}

function assertConditionalCommand(section, { condition, command, product, label }) {
  const escaped = command.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  assert.match(
    section,
    new RegExp(`${condition}[\\s\\S]{0,450}\\$${product}:${escaped}`, "i"),
    `${label}: condition must bind to ${command}`,
  );
}

function assertRouteCommandRows(markdown, routes, product, label) {
  const rows = extractSection(markdown, "내부 진행 흐름").split("\n").filter((line) => line.startsWith("|"));
  for (const { id, skill } of routes) {
    assert.ok(
      rows.some((row) => row.includes(`\`${id}\``) && row.includes(`$${product}:${skill}`)),
      `${label}: ${id} condition and ${skill} CLI target must share a table row`,
    );
  }
}

function assertSkillContract(markdown, skillId) {
  assert.deepEqual(h2Headings(markdown), requiredHeadings, `${skillId}: H2 contract/order`);
  for (const heading of requiredHeadings) {
    assert.ok(markdown.includes(`## ${heading}\n\n`), `${skillId}: H2 must be followed by a blank line: ${heading}`);
  }
  for (const heading of [
    "관련 템플릿·품질 프로필·전문 역할",
    "이미지·도식화 조건",
    "관련 문서",
  ]) {
    const body = extractSection(markdown, heading);
    assert.ok(body, `${skillId}: ${heading} must not be empty`);
    assert.match(body, /\[[^\]]+\]\([^)]+\)/, `${skillId}: ${heading} needs a Markdown link`);
  }
  assert.match(extractSection(markdown, "다음 작업 요청문"), /자리표시자[\s\S]*공통 규칙/, `${skillId}: next request must explain placeholders`);
}

function extractDirectUseSection(markdown, skillId) {
  const heading = `### 직접 호출 활용 — ${skillId}`;
  const start = markdown.indexOf(`${heading}\n`);
  assert.notEqual(start, -1, `${skillId}: missing direct-use H3`);
  const bodyStart = start + heading.length;
  const next = markdown.slice(bodyStart).search(/^### |^## /m);
  return markdown.slice(bodyStart, next === -1 ? markdown.length : bodyStart + next).trim();
}

function directUseFields(section, skillId) {
  const matches = [...section.matchAll(/^#### (.+)$/gm)];
  const expected = ["직접 호출 조건", "입문 요청문", "응용 요청문", "고급 요청문", "예상 파일과 읽는 순서", "다음 스킬 조건"];
  assert.deepEqual(matches.map((match) => match[1]), expected, `${skillId}: direct-use H4 order`);
  return Object.fromEntries(matches.map((match, index) => [
    match[1],
    section.slice(match.index + match[0].length, matches[index + 1]?.index ?? section.length).trim(),
  ]));
}

function fencedRequests(section) {
  return [...section.matchAll(/```text\n([\s\S]*?)\n```/g)].map((match) => match[1]);
}

function assertConditionalDirectHandoff(section, { condition, target, skillId }) {
  const command = target === "downstream" ? "downstream renderer-and-QA workflow" : `$game-design-studio:${target}`;
  const escaped = command.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  assert.match(section, new RegExp(`${condition}[\\s\\S]{0,300}(?:때만|경우에만|if )[\\s\\S]{0,120}${escaped}`, "i"), `${skillId}: ${condition} must conditionally bind to ${target}`);
}

function assertDirectUseContract(markdown, skillId) {
  const section = extractDirectUseSection(markdown, skillId);
  const fields = directUseFields(section, skillId);

  const requests = fencedRequests([fields["입문 요청문"], fields["응용 요청문"], fields["고급 요청문"]].join("\n"));
  assert.equal(requests.length, 3, `${skillId}: exactly three levelled copyable requests`);
  for (const request of requests) {
    assert.match(request, new RegExp(`\\$game-design-studio:${skillId}\\b`), `${skillId}: direct request target`);
  }
  const readOrder = fields["예상 파일과 읽는 순서"];
  assert.match(readOrder, /content\.md\s*→\s*evidence\.yml\s*→\s*export-manifest\.yml/, `${skillId}: canonical read order`);
  for (const path of DIRECT_USE_OUTPUTS[skillId]) assert.ok(readOrder.includes(path), `${skillId}: real output path or state ${path}`);
  assert.doesNotMatch(readOrder, NONEXISTENT_DIRECT_USE_PATHS, `${skillId}: must not invent a logical output as a file`);
  for (const [condition, target] of DIRECT_USE_HANDOFFS[skillId]) {
    assertConditionalDirectHandoff(fields["다음 스킬 조건"], { condition, target, skillId });
  }
  return fields;
}

function workbenchLaneMap(markdown) {
  const map = {};
  let lane = null;
  for (const line of markdown.split("\n")) {
    const heading = /^## (.+)$/.exec(line);
    if (heading) lane = heading[1];
    const row = /^\| `([-a-z]+)` \|/.exec(line);
    if (row) map[row[1]] = lane;
  }
  return map;
}

function extractFirstColumnIds(markdown) {
  return [...markdown.matchAll(/^\| (?:`([^`]+)`|\[`([^`]+)`\]\([^)]+\)) \|/gm)]
    .map((match) => match[1] ?? match[2])
    .sort();
}

function extractHeadingBody(markdown, heading) {
  const match = new RegExp(`^## ${heading}$`, "m").exec(markdown);
  assert.ok(match, `missing Studio guide index heading: ${heading}`);
  const bodyStart = match.index + match[0].length;
  const next = markdown.slice(bodyStart).search(/^## /m);
  return markdown.slice(bodyStart, next === -1 ? markdown.length : bodyStart + next).trim();
}

function assertStudioGuideRouting(index, skillIndex) {
  const routing = extractHeadingBody(index, "활용 사례와 진입점");
  for (const user of ["기획 입문 학생", "솔로·인디 개발자", "현업 기획자", "팀 리드·교육자·멘토"]) {
    assert.ok(routing.includes(user), `Studio guide target user missing: ${user}`);
  }
  assert.match(routing, /한 작업.*분명하면[\s\S]{0,180}직접 호출/u, "single-scope work must choose a direct skill");
  assert.match(routing, /복수.*영역|범위.*불명확/u, "mixed or unclear work must be named");
  assert.match(routing, /복수.*영역[\s\S]{0,180}orchestrate-game-design-project|범위.*불명확[\s\S]{0,180}orchestrate-game-design-project/u, "mixed or unclear work must choose the orchestrator");

  const cases = [
    ["ST-C01", "vision-pillars"],
    ["ST-C03", "system-specification"],
    ["ST-C04", "ui-ux-flow-state"],
    ["ST-C05", "narrative-quest-npc"],
    ["ST-C07", "economy-balance"],
    ["ST-C08", "export-manifest.yml"],
  ];
  for (const [id, output] of cases) {
    assert.match(routing, new RegExp(`${id}[\\s\\S]{0,500}${output}`), `${id}: representative case must name its concrete expected output`);
  }
  assert.equal((routing.match(/^\| ST-C\d\d \|/gm) ?? []).length, 6, "guide index needs six concise representative case rows");

  for (const link of [
    "use-cases/README.md",
    "use-cases/competency-paths.md",
    "use-cases/concept-scenarios.md",
    "use-cases/skill-workbench.md",
    "faq.md",
    "../use-cases/output-catalog.md",
  ]) assert.ok(routing.includes(`](${link})`), `Studio guide routing link missing: ${link}`);

  for (const link of ["installation.md", "quick-start.md", "workflow.md"]) {
    assert.ok(index.includes(`](${link})`), `existing Studio reading path missing: ${link}`);
  }

  const skillRouting = extractHeadingBody(skillIndex, "활용 경로");
  assert.match(skillRouting, /한 작업.*분명하면[\s\S]{0,180}직접 호출/u, "skill index direct-use condition missing");
  assert.match(skillRouting, /복수.*영역[\s\S]{0,180}orchestrate-game-design-project|범위.*불명확[\s\S]{0,180}orchestrate-game-design-project/u, "skill index orchestrator condition missing");
  assert.ok(skillRouting.includes("](../use-cases/skill-workbench.md)"), "skill index must link the workbench");
}

test("Studio documents every installed skill with the common contract", async () => {
  const inventory = await collectProductInventory(root, "game-design-studio");
  assert.equal(inventory.skillIds.length, 18);

  for (const skillId of inventory.skillIds) {
    const markdown = await readFile(
      path.join(root, "guides/game-design-studio/skills", skillId + ".md"),
      "utf8",
    );
    assertSkillContract(markdown, skillId);
    if (Object.hasOwn(DIRECT_USE_OUTPUTS, skillId)) assertDirectUseContract(markdown, skillId);
    assert.match(markdown, /복사 가능한 요청문/);
    assert.match(markdown, /예상 결과/);
  }
});

test("Studio skill workbench routes every direct-use case through its own lane", async () => {
  const inventory = await collectProductInventory(root, "game-design-studio");
  const workbench = await readFile(
    path.join(root, "guides/game-design-studio/use-cases/skill-workbench.md"),
    "utf8",
  );
  const lanes = [...new Set(Object.values(WORKBENCH_LANES))];
  for (const lane of lanes) assert.match(workbench, new RegExp(`^## ${lane}$`, "m"), `workbench lane: ${lane}`);

  const rows = workbench.split("\n").filter((line) => /^\| `[-a-z]+` \|/.test(line));
  assert.equal(rows.length, inventory.skillIds.length, "one workbench row per installed skill");
  assert.deepEqual(rows.map((row) => row.match(/^\| `([-a-z]+)` \|/)[1]).sort(), inventory.skillIds);
  for (const skillId of inventory.skillIds) {
    const row = rows.find((candidate) => candidate.includes(`\`${skillId}\``));
    assert.ok(row, `workbench row: ${skillId}`);
    assert.equal(row.split("|").length, 9, `${skillId}: seven-column decision row`);
    assert.match(row, new RegExp(`\\$game-design-studio:${skillId}\\b`), `${skillId}: direct CLI signal`);
    assert.match(row, new RegExp(`\\.\\./skills/${skillId}\\.md#직접-호출-활용-${skillId}`), `${skillId}: direct-use guide anchor`);
  }
  assert.deepEqual(workbenchLaneMap(workbench), WORKBENCH_LANES, "closed skill-to-lane map");

  const planProductionRow = rows.find((row) => row.includes("`plan-game-production`"));
  const wrongLane = workbench.replace(planProductionRow, "").replace(
    "## 품질·검토\n",
    `## 품질·검토\n\n${planProductionRow}\n`,
  );
  assert.throws(() => assert.deepEqual(workbenchLaneMap(wrongLane), WORKBENCH_LANES), "plan-game-production wrong lane must fail");
});

test("Studio direct-use contract rejects unconditional handoff and invented file paths", async () => {
  const vision = await readFile(path.join(root, "guides/game-design-studio/skills/define-game-vision.md"), "utf8");
  const unconditional = vision.replace("때만 `$game-design-studio:design-game-systems`", "즉시 `$game-design-studio:design-game-systems`");
  assert.throws(() => assertDirectUseContract(unconditional, "define-game-vision"), "unconditional next skill must fail");

  const systems = await readFile(path.join(root, "guides/game-design-studio/skills/design-game-systems.md"), "utf8");
  const inventedPath = systems.replace("export-manifest.yml", "system-specification.yml");
  assert.throws(() => assertDirectUseContract(inventedPath, "design-game-systems"), "invented expected file must fail");
});

test("Studio direct-use boundaries preserve export preparation, image lifecycle, and Node-free SVG fallback", async () => {
  const exportGuide = await readFile(path.join(root, "guides/game-design-studio/skills/export-game-design-documents.md"), "utf8");
  const exportFields = directUseFields(extractDirectUseSection(exportGuide, "export-game-design-documents"), "export-game-design-documents");
  const exportDirectUse = Object.values(exportFields).join("\n");
  assert.match(exportDirectUse, /pending|unavailable|blocked/);
  assert.match(exportFields["예상 파일과 읽는 순서"], /generation.*not-run|not-run.*generation/i);
  assert.match(exportFields["예상 파일과 읽는 순서"], /evidence는 비어 있음/);
  assert.doesNotMatch(
    [exportFields["직접 호출 조건"], exportFields["입문 요청문"], exportFields["응용 요청문"], exportFields["고급 요청문"], exportFields["예상 파일과 읽는 순서"]].join("\n"),
    /terminal validation|format QA/i,
    "preparation must not claim downstream generation or QA",
  );
  const exportHandoff = exportFields["다음 스킬 조건"];
  assertConditionalDirectHandoff(exportHandoff, {
    condition: "정상적으로 검증된 preparation manifest의 요청 job이 `pending`",
    target: "downstream",
    skillId: "export-game-design-documents",
  });
  assertConditionalDirectHandoff(exportHandoff, {
    condition: "`unavailable` job의 capability가 `available`로 바뀌었",
    target: "export-game-design-documents",
    skillId: "export-game-design-documents",
  });
  assert.throws(
    () => assertConditionalDirectHandoff(exportHandoff.replace("`pending`", "`unavailable`"), {
      condition: "정상적으로 검증된 preparation manifest의 요청 job이 `pending`",
      target: "downstream",
      skillId: "mutated export pending handoff",
    }),
    "inverted pending handoff must fail",
  );

  const workbench = await readFile(path.join(root, "guides/game-design-studio/use-cases/skill-workbench.md"), "utf8");
  assert.match(workbench, /`prompt-only`.*생성 없음/);
  assert.match(workbench, /`select`.*사용자가 제공한 ordered exact stable IDs/);
  assert.match(workbench, /host adapter.*immutable selection receipt/);
  assert.doesNotMatch(workbench, /사용자가 제공한[^.\n]*selection receipt/);
  assert.match(workbench, /`required`.*`all`.*finite generation/);
  assert.match(workbench, /named human[\s\S]*concept-draft\s*→\s*document-approved\s*→\s*production-candidate/u);
  const exportRow = workbench.split("\n").find((line) => line.includes("`export-game-design-documents`"));
  assert.match(exportRow, /pending.*downstream.*unavailable.*resume/i, "workbench separates normal export handoff from unavailable resume");

  const svgGuide = await readFile(path.join(root, "guides/game-design-studio/skills/svg-infographic.md"), "utf8");
  const svgFields = directUseFields(extractDirectUseSection(svgGuide, "svg-infographic"), "svg-infographic");
  const svgAdvanced = svgFields["고급 요청문"];
  assert.match(svgAdvanced, /Node 18\+.*부재[\s\S]*manual source checklist[\s\S]*Node-free Chromium[\s\S]*2× PNG/u);
  assert.match(svgAdvanced, /Chromium.*없[\s\S]*SVG-only/u);
  assertVisualizationReadBranches(svgFields["예상 파일과 읽는 순서"], "svg-infographic");

  const visualizationGuide = await readFile(path.join(root, "guides/game-design-studio/skills/visualize-game-design.md"), "utf8");
  const visualizationFields = directUseFields(extractDirectUseSection(visualizationGuide, "visualize-game-design"), "visualize-game-design");
  assertVisualizationReadBranches(visualizationFields["예상 파일과 읽는 순서"], "visualize-game-design");
  assert.throws(
    () => assertVisualizationReadBranches(svgFields["예상 파일과 읽는 순서"].replace("Node-free Chromium branch", "packaged wrapper branch"), "mutated svg branch"),
    "Node-free branch relabeled as wrapper must fail",
  );
});

function assertVisualizationReadBranches(readOrder, skillId) {
  assert.match(readOrder, /Node 18\+ packaged wrapper branch[\s\S]*machine lint[\s\S]*wrapper evidence/u, `${skillId}: wrapper evidence branch`);
  assert.match(readOrder, /Node-free Chromium branch[\s\S]*manual source checklist[\s\S]*machine lint.*않[\s\S]*직접 Chromium[\s\S]*2× PNG/u, `${skillId}: Node-free evidence branch`);
  assert.match(readOrder, /Chromium.*없[\s\S]*SVG-only[\s\S]*PNG visual verification.*미실행/u, `${skillId}: SVG-only branch`);
}

test("Studio skill contract rejects missing or reordered new sections", async () => {
  const markdown = await readFile(
    path.join(root, "guides/game-design-studio/skills/define-game-vision.md"),
    "utf8",
  );
  const missing = markdown.replace(/^## 관련 문서[\s\S]*$/m, "");
  const reordered = markdown.replace(
    "## 이미지·도식화 조건",
    "## __temporary__",
  ).replace(
    "## 검토·승인 기준",
    "## 이미지·도식화 조건",
  ).replace(
    "## __temporary__",
    "## 검토·승인 기준",
  );
  assert.throws(() => assertSkillContract(missing, "missing"));
  assert.throws(() => assertSkillContract(reordered, "reordered"));
});

async function sourceInventory(product) {
  const profiles = [];
  const profileRoot = path.join(root, "shared/document-quality/profiles", product === "game-design-studio" ? "studio" : "career");
  for (const entry of await readdir(profileRoot)) profiles.push(JSON.parse(await readFile(path.join(profileRoot, entry), "utf8")));
  return {
    profiles,
    profileIds: new Set(profiles.map((profile) => profile.profile_id)),
    roleIds: new Set((await readdir(path.join(root, "products", product, "plugin/agents"))).map((entry) => path.basename(entry, ".md"))),
  };
}

test("Studio skill handoffs are derived from canonical routes and source-backed exceptions", async () => {
  const inventory = await collectProductInventory(root, "game-design-studio");
  const sources = await sourceInventory("game-design-studio");
  const routing = JSON.parse(await readFile(path.join(root, "products/game-design-studio/plugin/references/routing.json"), "utf8"));
  const profileMap = JSON.parse(await readFile(path.join(root, "products/game-design-studio/plugin/references/document-quality/template-profile-map.json"), "utf8")).templates;
  const directRoutes = routing.routes.filter(({ skill }) => skill !== "orchestrate-game-design-project" && !sourceExceptions[skill]);
  const directSkills = [...new Set(directRoutes.map(({ skill }) => skill))];
  const allowedNextTargets = new Set([...inventory.skillIds, "downstream"]);

  for (const skillId of directSkills) {
    const routes = directRoutes.filter((route) => route.skill === skillId);
    const markdown = await readFile(path.join(root, "guides/game-design-studio/skills", `${skillId}.md`), "utf8");
    const related = extractSection(markdown, "관련 템플릿·품질 프로필·전문 역할");
    const next = extractSection(markdown, "다음 작업 요청문");
    for (const route of routes) {
      const profileId = profileMap[route.artifactType];
      if (profileId) {
        assert.ok(related.includes(route.artifactType), `${skillId}: missing routed template ${route.artifactType}`);
        assert.ok(sources.profileIds.has(profileId), `${skillId}: unknown mapped profile ${profileId}`);
        assert.ok(related.includes(profileId), `${skillId}: missing mapped profile ${profileId}`);
      }
      for (const roleId of route.defaultReviewers) {
        assert.ok(sources.roleIds.has(roleId), `${skillId}: unknown routed role ${roleId}`);
        assert.ok(related.includes(roleId), `${skillId}: missing routed role ${roleId}`);
      }
    }
    for (const target of next.match(/\$game-design-studio:([a-z-]+)/g) ?? []) assert.ok(allowedNextTargets.has(target.split(":")[1]), `${skillId}: unknown next target ${target}`);
  }

  for (const [skillId, exception] of Object.entries(sourceExceptions)) {
    const markdown = await readFile(path.join(root, "guides/game-design-studio/skills", `${skillId}.md`), "utf8");
    const guide = [extractSection(markdown, "관련 템플릿·품질 프로필·전문 역할"), extractSection(markdown, "다음 작업 요청문")].join("\n");
    assert.ok(sourceExceptionReasons.has(exception.reason), `${skillId}: unsupported source exception reason`);
    const source = await readFile(path.join(root, exception.sourcePath), "utf8");
    const sourceSection = extractSourceSection(source, exception.sourceSection);
    for (const term of exception.sourceTerms) assert.ok(sourceSection.includes(term), `${skillId}: source exception section missing ${term}`);
    for (const term of exception.guideTerms) assert.ok(guide.includes(term), `${skillId}: guide exception missing ${term}`);
  }

  const allRouteTargets = [...new Set(routing.routes.filter(({ skill }) => skill !== "orchestrate-game-design-project").map(({ skill }) => skill))];
  for (const skillId of ["apply-document-quality-profile", "orchestrate-game-design-project"]) {
    const markdown = await readFile(path.join(root, "guides/game-design-studio/skills", `${skillId}.md`), "utf8");
    const scoped = [extractSection(markdown, "내부 진행 흐름"), extractSection(markdown, "Codex App 요청 예시"), extractSection(markdown, "Codex CLI 요청 예시"), extractSection(markdown, "다음 작업 요청문")].join("\n");
    assert.ok(scoped.includes("<selected-skill>"), `${skillId}: selected-skill replacement rule`);
    for (const target of allRouteTargets) assert.ok(scoped.includes(target), `${skillId}: missing routed target ${target}`);
  }

  for (const skillId of inventory.skillIds) {
    const markdown = await readFile(path.join(root, "guides/game-design-studio/skills", `${skillId}.md`), "utf8");
    const documentedIds = extractSection(markdown, "이미지·도식화 조건").match(/\b(?:skillstead-[a-z0-9-]+|[a-z0-9-]+-image)\b/g) ?? [];
    const mappedProfileIds = routing.routes.filter((route) => route.skill === skillId)
      .map((route) => profileMap[route.artifactType]).filter(Boolean);
    const selectedMediaIds = new Set(sources.profiles.filter((profile) => mappedProfileIds.includes(profile.profile_id))
      .flatMap((profile) => [...profile.required_images, ...profile.required_diagrams].map((item) => item.id)));
    for (const id of documentedIds) assert.ok(selectedMediaIds.has(id), `${skillId}: media ID is not selected-profile source-backed: ${id}`);
  }

  const reviewGuide = await readFile(path.join(root, "guides/game-design-studio/skills/review-game-design.md"), "utf8");
  const reviewSource = await readFile(path.join(root, "products/game-design-studio/plugin/skills/review-game-design/SKILL.md"), "utf8");
  assert.ok(reviewSource.includes("visualize-game-design"));
  for (const target of ["review-game-design", "visualize-game-design", "export-game-design-documents"]) assert.ok(extractSection(reviewGuide, "다음 작업 요청문").includes(target));
});

test("Studio direct handoffs and review/image branches bind their source-derived conditions to commands", async () => {
  const systemsGuide = await readFile(path.join(root, "guides/game-design-studio/skills/design-game-systems.md"), "utf8");
  const systemsSource = await readFile(path.join(root, "products/game-design-studio/plugin/skills/design-game-systems/SKILL.md"), "utf8");
  const studioRouting = JSON.parse(await readFile(path.join(root, "products/game-design-studio/plugin/references/routing.json"), "utf8"));
  const systemsNext = extractSection(systemsGuide, "다음 작업 요청문");
  const reviewRoute = studioRouting.routes.find(({ id }) => id === "review");
  assert.ok(extractSourceSection(systemsSource, "Output contract").includes("review findings"));
  assertConditionalCommand(systemsNext, { condition: "rule precedence", command: reviewRoute.skill, product: "game-design-studio", label: "design-game-systems" });
  assert.throws(() => assertConditionalCommand(
    systemsNext.replace("$game-design-studio:review-game-design", "$game-design-studio:define-game-vision"),
    { condition: "rule precedence", command: reviewRoute.skill, product: "game-design-studio", label: "mutated design-game-systems" },
  ));

  const reviewGuide = await readFile(path.join(root, "guides/game-design-studio/skills/review-game-design.md"), "utf8");
  const reviewSource = await readFile(path.join(root, "products/game-design-studio/plugin/skills/review-game-design/SKILL.md"), "utf8");
  const reviewNext = extractSection(reviewGuide, "다음 작업 요청문");
  const reviewContract = [
    ["minimum fix", "review-game-design", "minimal repairs"],
    ["diagram gap", "visualize-game-design", "visualize-game-design"],
    ["all blocker", "export-game-design-documents", "export-game-design-documents"],
  ];
  for (const [condition, command, sourceTerm] of reviewContract) {
    assert.ok(reviewSource.includes(sourceTerm), `review source missing ${sourceTerm}`);
    assertConditionalCommand(reviewNext, { condition, command, product: "game-design-studio", label: "review-game-design" });
  }
  for (const [from, to] of [["review-game-design", "visualize-game-design"], ["visualize-game-design", "export-game-design-documents"]]) {
    assert.throws(() => assertConditionalCommand(reviewNext.replace(`$game-design-studio:${from}`, `$game-design-studio:${to}`), { condition: from === "review-game-design" ? "minimum fix" : "diagram gap", command: from, product: "game-design-studio", label: "mutated review branch" }));
  }
  assert.throws(() => assertConditionalCommand(reviewNext.replace(/all blocker[^.]+\./i, ""), { condition: "all blocker", command: "export-game-design-documents", product: "game-design-studio", label: "deleted review branch condition" }));

  const imagePlan = await readFile(path.join(root, "guides/game-design-studio/skills/plan-image-assets.md"), "utf8");
  const planSource = await readFile(path.join(root, "products/game-design-studio/plugin/skills/plan-image-assets/SKILL.md"), "utf8");
  const imageNext = extractSection(imagePlan, "다음 작업 요청문");
  for (const term of ["prompt-only", "generate-image-assets", "visualization workflow"]) assert.ok(extractSourceSection(planSource, "Workflow").includes(term));
  assert.match(imageNext, /prompt-only[\s\S]*생성 handoff 없이/);
  assertConditionalCommand(imageNext, { condition: "finite illustration job", command: "generate-image-assets", product: "game-design-studio", label: "plan-image-assets generate" });
  assertConditionalCommand(imageNext, { condition: "Skillstead diagram slot", command: "visualize-game-design", product: "game-design-studio", label: "plan-image-assets visualize" });
  assert.throws(() => assertConditionalCommand(imageNext.replace("$game-design-studio:generate-image-assets", "$game-design-studio:visualize-game-design"), { condition: "finite illustration job", command: "generate-image-assets", product: "game-design-studio", label: "mutated image generate branch" }));
});

test("Studio apply and orchestrator bind every canonical route condition to its CLI target", async () => {
  const routing = JSON.parse(await readFile(path.join(root, "products/game-design-studio/plugin/references/routing.json"), "utf8"));
  const routes = routing.routes.filter(({ skill }) => skill !== "orchestrate-game-design-project");
  for (const skillId of ["apply-document-quality-profile", "orchestrate-game-design-project"]) {
    const markdown = await readFile(path.join(root, "guides/game-design-studio/skills", `${skillId}.md`), "utf8");
    assertRouteCommandRows(markdown, routes, "game-design-studio", skillId);
  }
  const apply = await readFile(path.join(root, "guides/game-design-studio/skills/apply-document-quality-profile.md"), "utf8");
  assert.throws(() => assertRouteCommandRows(apply.replace("| `systems` | `$game-design-studio:design-game-systems` |", "| `systems` | `$game-design-studio:define-game-vision` |"), routes, "game-design-studio", "mutated apply target"));
  assert.throws(() => assertRouteCommandRows(apply.replace("`systems`", "systems"), routes, "game-design-studio", "mutated apply condition"));
});

test("Studio indexes every installed skill and template exactly once", async () => {
  const inventory = await collectProductInventory(root, "game-design-studio");
  const skillIndex = await readFile(
    path.join(root, "guides/game-design-studio/skills/README.md"),
    "utf8",
  );
  const templates = await readFile(
    path.join(root, "guides/game-design-studio/templates.md"),
    "utf8",
  );

  assert.deepEqual(extractFirstColumnIds(skillIndex), inventory.skillIds);
  assert.deepEqual(extractFirstColumnIds(templates), inventory.templateIds);
  assert.equal(inventory.templateIds.length, 15);
});

test("Studio guide indexes route target users through direct skills or orchestration without duplicating cases", async () => {
  const [index, skillIndex] = await Promise.all([
    readFile(path.join(root, "guides/game-design-studio/README.md"), "utf8"),
    readFile(path.join(root, "guides/game-design-studio/skills/README.md"), "utf8"),
  ]);
  assertStudioGuideRouting(index, skillIndex);

  assert.throws(
    () => assertStudioGuideRouting(index.replace("`system-specification`", "`economy-balance`"), skillIndex),
    "case/output swaps must fail",
  );
  assert.throws(
    () => assertStudioGuideRouting(index.replace("복수 영역이 얽히거나 범위가 불명확하면", "한 작업 범위가 분명하면"), skillIndex),
    "direct/orchestrator decision inversion must fail",
  );
  assert.throws(
    () => assertStudioGuideRouting(index.replaceAll("use-cases/concept-scenarios.md", "use-cases/competency-paths.md"), skillIndex),
    "wrong but valid Studio guide links must fail",
  );
});

test("Studio template guide separates installed paths, authoring sources, and generated snapshots", async () => {
  const inventory = await collectProductInventory(root, "game-design-studio");
  const templates = await readFile(path.join(root, "guides/game-design-studio/templates.md"), "utf8");
  assert.doesNotMatch(templates, /Package path:/);
  assert.match(templates, /설치 상대 경로/);
  assert.match(templates, /저장소 authoring source/);
  assert.match(templates, /generated snapshot/);
  for (const id of inventory.templateIds) {
    const paths = [
      `assets/templates/${id}/`,
      `products/game-design-studio/plugin/assets/templates/${id}/`,
      `plugins/game-design-studio/assets/templates/${id}/`,
    ];
    for (const relative of paths) {
      assert.ok(templates.includes(`\`${relative}\``), `missing documented template path: ${relative}`);
      const filename = relative.startsWith("assets/")
        ? path.join(root, "products/game-design-studio/plugin", relative)
        : path.join(root, relative);
      assert.ok((await lstat(filename)).isDirectory(), `template path does not exist: ${relative}`);
    }
  }
});

test("Studio topical guides preserve image, visualization, and export policies", async () => {
  const topicalGuides = await Promise.all(
    ["document-quality.md", "image-assets.md", "visualization.md", "exports.md"].map((filename) =>
      readFile(path.join(root, "guides/game-design-studio", filename), "utf8"),
    ),
  );
  const joinedGuides = topicalGuides.join("\n");

  for (const phrase of [
    "prompt-only",
    "select",
    "required",
    "all",
    "gpt-image-2",
    "low",
    "OpenAI only",
    "Codex",
    "SVG",
    "정확한 2× PNG",
    "MD",
    "PDF",
    "DOCX",
    "PPTX",
  ]) {
    assert.ok(joinedGuides.includes(phrase), "missing Studio guide contract: " + phrase);
  }
});

test("Studio image and export guides document runtime precedence and downstream resume", async () => {
  const base = path.join(root, "guides/game-design-studio");
  const images = await readFile(path.join(base, "image-assets.md"), "utf8");
  const exportsGuide = await readFile(path.join(base, "exports.md"), "utf8");
  const exportSkill = await readFile(path.join(base, "skills/export-game-design-documents.md"), "utf8");
  const imagePlan = await readFile(path.join(base, "skills/plan-image-assets.md"), "utf8");
  for (const phrase of ["workflow 호출 때마다", "현재 process environment", ".env보다 우선", "새 채팅", "새 세션"]) {
    assert.ok(images.includes(phrase), `Studio image guide missing ${phrase}`);
  }
  for (const phrase of ["MD terminal validation", "<artifact-path>", "<export-manifest-path>", "새 세션", "downstream workflow"]) {
    assert.ok(exportsGuide.includes(phrase), `Studio exports guide missing ${phrase}`);
  }
  assert.doesNotMatch(exportsGuide, /(?:probe|available)[^.\n]*(?:MD capability|MD\/PDF|MD·PDF)/i, "MD must not be probe-gated");
  const exportNext = extractSection(exportSkill, "다음 작업 요청문");
  assert.ok(exportNext.includes("downstream workflow"));
  assert.match(exportNext, /built-in canonical-markdown[\s\S]*MD.*terminal validation/);
  assert.match(exportNext, /pdf\/documents\/presentations/);
  assert.doesNotMatch(exportNext, /(?:probe|available)[^.\n]*(?:MD capability|MD\/PDF|MD·PDF)/i, "skill MD must not be probe-gated");
  const imageNext = extractSection(imagePlan, "다음 작업 요청문");
  for (const phrase of ["prompt-only", "prompt·placeholder", "generate-image-assets", "visualize-game-design", "Skillstead diagram slot"]) assert.ok(imageNext.includes(phrase), `Studio image-plan branch missing ${phrase}`);
});

test("Studio recipes keep only their local image-mode boundary and link the common guide", async () => {
  const recipes = ["content-quest-design", "economy-liveops", "new-game-gdd", "production-review-export", "system-feature-spec", "ux-accessibility"];
  for (const id of recipes) {
    const markdown = await readFile(path.join(root, "guides/game-design-studio/recipes", `${id}.md`), "utf8");
    assert.match(markdown, /\[이미지 자산 흐름\]\(\.\.\/image-assets\.md\)/, `${id}: missing common image guide`);
    assert.ok((markdown.match(/prompt-only/g) ?? []).length <= 1, `${id}: repeats all image modes`);
  }
});

test("Studio visualization guides preserve the no-Node Skillstead fallback", async () => {
  const guidePaths = [
    "guides/game-design-studio/skills/svg-infographic.md",
    "guides/game-design-studio/skills/visualize-game-design.md",
    "guides/game-design-studio/visualization.md",
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
