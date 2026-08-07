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
const expectedTemplateIds = [
  "career-stage-goal",
  "competency-matrix",
  "creative-design-portfolio",
  "five-axis-review",
  "game-analysis-report",
  "game-design-role-map",
  "interview-question-answer-log",
  "introduction-motivation",
  "job-posting-evidence",
  "junior-growth-review",
  "learning-roadmap",
  "portfolio-backlog",
  "portfolio-project-brief",
  "reverse-design-document",
  "transition-readiness",
];
const sourceExceptions = {
  "generate-image-assets": { reason: "provider-helper", sourcePath: "products/game-design-career/plugin/skills/generate-image-assets/SKILL.md", sourceSection: "Workflow", sourceTerms: ["prompt-only", "review-image-assets"], guideTerms: ["current artifact profile", "review-image-assets"] },
  "plan-image-assets": { reason: "image-planning-helper", sourcePath: "products/game-design-career/plugin/skills/plan-image-assets/SKILL.md", sourceSection: "Workflow", sourceTerms: ["planning creates no SVG or PNG bytes", "generate-image-assets"], guideTerms: ["prompt-only", "generate-image-assets", "visualize-career-roadmap"] },
  "review-image-assets": { reason: "human-approval-helper", sourcePath: "products/game-design-career/plugin/skills/review-image-assets/SKILL.md", sourceSection: "Workflow", sourceTerms: ["named human", "document-approved"], guideTerms: ["document-approved", "export-career-documents"] },
  "svg-infographic": { reason: "vendored-wrapper", sourcePath: "products/game-design-career/plugin/skills/visualize-career-roadmap/SKILL.md", sourceSection: "Load Contracts", sourceTerms: ["skills/svg-infographic", "run-skillstead.mjs"], guideTerms: ["game-design-mentor", "visualize-career-roadmap"] },
};
const sourceExceptionReasons = new Set(["provider-helper", "image-planning-helper", "human-approval-helper", "vendored-wrapper"]);

function extractFirstColumnIds(markdown) {
  return [...markdown.matchAll(/^\| (?:`([^`]+)`|\[`([^`]+)`\]\([^)]+\)) \|/gm)]
    .map((match) => match[1] ?? match[2])
    .sort();
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

function assertConditionalCommand(section, { condition, command, label }) {
  const escaped = command.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  assert.match(section, new RegExp(`${condition}[\\s\\S]{0,450}\\$game-design-career:${escaped}`, "i"), `${label}: condition must bind to ${command}`);
}

function scenarioAdjacency(routing) {
  const adjacency = new Map();
  for (const { id, skillChain } of routing.scenarioChains) {
    for (let index = 0; index < skillChain.length - 1; index += 1) {
      const source = routing.routeSkills[skillChain[index]];
      const target = routing.routeSkills[skillChain[index + 1]];
      const links = adjacency.get(source) ?? [];
      links.push({ scenarioId: id, target });
      adjacency.set(source, links);
    }
  }
  return adjacency;
}

function assertRouteCommandRows(markdown, routes, label) {
  const rows = extractSection(markdown, "내부 진행 흐름").split("\n").filter((line) => line.startsWith("|"));
  for (const { id, skill } of routes) {
    assert.ok(
      rows.some((row) => row.includes(`\`${id}\``) && row.includes(`$game-design-career:${skill}`)),
      `${label}: ${id} condition and ${skill} CLI target must share a table row`,
    );
  }
}

function h2Headings(markdown) {
  return [...markdown.matchAll(/^## (.+)$/gm)].map((match) => match[1]);
}

function extractH3Section(markdown, heading) {
  const marker = `### ${heading}\n`;
  const start = markdown.indexOf(marker);
  assert.notEqual(start, -1, `missing H3 section: ${heading}`);
  const bodyStart = start + marker.length;
  const nextH3 = markdown.indexOf("\n### ", bodyStart);
  const nextH2 = markdown.indexOf("\n## ", bodyStart);
  const next = [nextH3, nextH2].filter((index) => index !== -1).sort((left, right) => left - right)[0];
  return markdown.slice(bodyStart, next ?? markdown.length).trim();
}

const CAREER_DIRECT_USE_CONTRACT = Object.freeze([
  ["apply-document-quality-profile", "한 Career Artifact의 template·quality profile 선택만", "content.md → evidence.yml → export-manifest.yml", "document-quality-editor", "unknown ID", "여러 route가 함께 남았을 때만", "선택 기록은 승인 자체가 아닙니다"],
  ["build-game-design-portfolio", "한 portfolio project의 claim·evidence 구조만", "content.md → evidence.yml → decisions/ → export-manifest.yml", "portfolio-reviewer", "claim 또는 evidence ID가 없으면", "여러 artifact의 우선순위가 섞였을 때만", "합격을 보장하지 않습니다"],
  ["export-career-documents", "하나의 승인 대기 Artifact의 export 준비만", "content.md → evidence.yml → decisions/ → export-manifest.yml", "document-quality-editor", "renderer 또는 capability가 없으면", "여러 artifact·형식 우선순위가 섞였을 때만", "실제 renderer 실행이나 파일 생성을 약속하지 않습니다"],
  ["generate-image-assets", "선택 receipt가 있는 finite image job만", "content.md → evidence.yml → assets/image-assets.yml → assets/prompts/image-prompts.md", "visual-asset-reviewer", "provider 또는 selection receipt가 없으면", "여러 artifact의 image·review 범위가 섞였을 때만", "AI 생성 결과는 자동 최종 승인되지 않습니다"],
  ["map-game-design-career", "한 목표 역할의 current evidence와 competency gap만", "content.md → evidence.yml → decisions/ → export-manifest.yml", "career-strategist", "current evidence가 stale이면", "여러 역할·단계의 우선순위가 섞였을 때만", "사실·추론·제안을 분리합니다"],
  ["orchestrate-game-design-career", "여러 Career 단계와 completion gate를 하나의 brief로", "content.md → evidence.yml → decisions/ → export-manifest.yml", "career-strategist", "route 또는 stage가 불명확하면", "한 output과 입력이 분명할 때는 해당 specialist를 직접", "사실·추론·제안을 분리합니다"],
  ["plan-image-assets", "선택된 profile의 finite image 또는 Skillstead slot만", "content.md → evidence.yml → export-manifest.yml → assets/image-assets.yml → assets/prompts/image-prompts.md", "art-brief-director", "slot mismatch 또는 필수 입력 누락이면", "여러 artifact의 image 범위가 섞였을 때만", "계획은 bytes 생성이나 승인 상태 변경을 하지 않습니다"],
  ["plan-junior-growth", "한 target requirement의 gap과 proof task만", "content.md → evidence.yml → decisions/ → export-manifest.yml", "game-design-mentor", "stale evidence 또는 requirement가 있으면", "여러 단계·역할의 우선순위가 섞였을 때만", "사실·추론·제안을 분리합니다"],
  ["practice-game-design-interview", "한 posting·portfolio evidence set의 question record만", "content.md → evidence.yml → decisions/ → export-manifest.yml", "career-strategist", "stale posting evidence 또는 questionId가 없으면", "여러 준비 단계와 proof task가 섞였을 때만", "합격을 보장하지 않습니다"],
  ["research-game-design-jobs", "한 role·level·region의 current posting sample만", "content.md → evidence.yml → decisions/ → export-manifest.yml", "evidence-auditor", "sourceUrl 또는 retrievalDate가 없으면", "여러 role·stage의 우선순위가 섞였을 때만", "stale evidence는 current claim에 사용하지 않습니다"],
  ["reverse-engineer-game-design", "하나의 공개 build 관찰과 validation queue만", "content.md → evidence.yml → decisions/ → export-manifest.yml", "game-design-mentor", "observation 또는 source가 없으면", "여러 분석·portfolio 범위가 섞였을 때만", "관찰·추론·제안을 분리합니다"],
  ["review-game-design-portfolio", "하나의 portfolio artifact의 five-axis finding만", "content.md → evidence.yml → decisions/ → export-manifest.yml", "portfolio-reviewer", "inspectable source가 없으면", "여러 portfolio·interview 우선순위가 섞였을 때만", "합격을 보장하지 않습니다"],
  ["review-image-assets", "검증된 `assets/image-assets.yml`의 한 stable asset ID", "content.md → evidence.yml → assets/image-assets.yml", "visual-asset-reviewer", "actual user decision, named reviewer, review time, artifact-local evidence paths 또는 rights decision이 없으면", "여러 artifact의 image·export 우선순위가 섞였을 때만", "agent 권고와 asset bytes는 actual user decision이나 승인 증거가 아닙니다"],
  ["svg-infographic", "하나의 source-mapped 구조 SVG와 검증 상태만", "content.md → evidence.yml → decisions/ → export-manifest.yml", "game-design-mentor", "Node 또는 Chromium fallback이 막히면", "여러 Career route와 source priority가 섞였을 때만", "Node-free Chromium fallback을 보존합니다"],
  ["visualize-career-roadmap", "하나의 source-mapped relationship과 diagram slot만", "content.md → evidence.yml → decisions/ → export-manifest.yml", "game-design-mentor", "source mapping 또는 renderer fallback이 없으면", "여러 Career route와 source priority가 섞였을 때만", "Node-free Chromium fallback을 보존합니다"],
].map(([skill, condition, readOrder, reviewOwner, failure, orchestrator, boundary]) => ({
  skill, condition, readOrder, reviewOwner, failure, orchestrator, boundary,
})));

function directUseHeading(entry) {
  return `${entry.anchor.startsWith("career-") ? "Career " : ""}직접 호출 활용 — ${entry.skill}`;
}

function assertCareerDirectUseCard(markdown, entry, contract) {
  const heading = directUseHeading(entry);
  const section = extractH3Section(markdown, heading);
  assert.match(section, /#### 직접 호출 조건/, `${entry.skill}: direct-use condition heading`);
  assert.ok(section.includes(contract.condition), `${entry.skill}: exact direct-use condition`);
  assert.ok(section.includes(contract.orchestrator), `${entry.skill}: conditional orchestrator boundary`);
  assert.ok(section.includes(contract.boundary), `${entry.skill}: scope boundary`);
  assert.doesNotMatch(section, /TODO|항상\s*\$game-design-career:orchestrate-game-design-career/, `${entry.skill}: no TODO or unconditional orchestrator handoff`);

  for (const level of ["입문", "응용", "고급"]) {
    assert.match(section, new RegExp(`#### ${level} App 요청문[\\s\\S]{0,600}@Game Design Career`, "u"), `${entry.skill}: ${level} App request`);
    assert.match(section, new RegExp(`#### ${level} CLI 요청문[\\s\\S]{0,600}\\$game-design-career:${entry.skill}`, "u"), `${entry.skill}: ${level} exact CLI request`);
  }
  assert.match(section, new RegExp(`\\$game-design-career:${entry.skill}`, "u"), `${entry.skill}: installed command`);
  assert.ok(section.includes(contract.readOrder), `${entry.skill}: exact read order`);
  assert.ok(section.includes(contract.failure), `${entry.skill}: failure-resume condition`);
  assert.ok(section.includes("재개:"), `${entry.skill}: explicit resume`);

  const outputLine = entry.outputs.map((output) => `\`${output}\``).join(", ");
  assert.ok(section.includes(outputLine), `${entry.skill}: manifest output order`);
  for (const nextSkill of entry.next_skills) {
    assert.ok(section.includes(`$game-design-career:${nextSkill}`), `${entry.skill}: manifest next route ${nextSkill}`);
  }
  assert.doesNotMatch(section, /\[!\[/, `${entry.skill}: Task 6 diagram embed is absent`);
}

function canonicalReviewerSet(routing, skill) {
  return [...new Set(routing.routes.filter((route) => route.skill === skill).flatMap((route) => route.roles))].sort();
}

function assertReviewImageDirectContract(section, source) {
  for (const [sourcePhrase, guidePhrase] of [
    ["validated `assets/image-assets.yml`", "검증된 `assets/image-assets.yml`"],
    ["actual user decision", "actual user decision"],
    ["named human reviewer", "named reviewer"],
    ["review time", "review time"],
    ["artifact-local evidence paths", "artifact-local evidence paths"],
    ["rights decision", "rights decision"],
    ["receipt", "lifecycle receipt"],
    ["concept-draft` → `document-approved` → `production-candidate", "`concept-draft` → `document-approved` → `production-candidate`"],
  ]) {
    assert.ok(source.replaceAll("`", "").includes(sourcePhrase.replaceAll("`", "")), `review-image source contract: ${sourcePhrase}`);
    assert.ok(section.includes(guidePhrase), `review-image direct contract: ${guidePhrase}`);
  }
  assert.doesNotMatch(section, /provider routing|IMAGE_GEN_MODE|prompt package|finite image job/u, "review-image excludes generation-only tokens");
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

test("Career documents every installed skill with the common contract", async () => {
  const inventory = await collectProductInventory(root, "game-design-career");
  assert.equal(inventory.skillIds.length, 15);

  for (const skillId of inventory.skillIds) {
    const markdown = await readFile(
      path.join(root, "guides/game-design-career/skills", skillId + ".md"),
      "utf8",
    );
    assertSkillContract(markdown, skillId);
    assert.match(markdown, /복사 가능한 요청문/);
    assert.match(markdown, /예상 결과/);
  }
});

test("Career direct-use cards bind manifest outputs, requests, and conditional routes", async () => {
  const manifest = JSON.parse(await readFile(path.join(root, "guides/use-cases/use-case-manifest.json"), "utf8"));
  const entries = manifest.skill_cases.filter(({ product }) => product === "game-design-career");
  assert.equal(entries.length, 15, "Career direct-use manifest count");
  assert.deepEqual(entries.map(({ skill }) => skill), CAREER_DIRECT_USE_CONTRACT.map(({ skill }) => skill), "Career direct-use contract inventory");

  const cards = new Map();
  for (const entry of entries) {
    const markdown = await readFile(path.join(root, entry.document), "utf8");
    const contract = CAREER_DIRECT_USE_CONTRACT.find(({ skill }) => skill === entry.skill);
    assert.ok(contract, `${entry.skill}: independent literal contract`);
    assertCareerDirectUseCard(markdown, entry, contract);
    cards.set(entry.skill, extractH3Section(markdown, directUseHeading(entry)));
  }

  const apply = cards.get("apply-document-quality-profile");
  const map = cards.get("map-game-design-career");
  const applyCard = `### Career 직접 호출 활용 — apply-document-quality-profile\n\n${apply}`;
  const mapCard = `### 직접 호출 활용 — map-game-design-career\n\n${map}`;
  assert.throws(
    () => assertCareerDirectUseCard(
      applyCard.replace("### Career 직접 호출 활용 — apply-document-quality-profile", "### 공유 호출 활용 — apply-document-quality-profile"),
      entries.find(({ skill }) => skill === "apply-document-quality-profile"),
      CAREER_DIRECT_USE_CONTRACT[0],
    ),
    /missing H3 section|direct-use condition heading/,
    "shared-anchor drift",
  );
  assert.throws(
    () => assertCareerDirectUseCard(
      mapCard.replace("### 직접 호출 활용 — map-game-design-career", "### Career 직접 호출 활용 — apply-document-quality-profile"),
      entries.find(({ skill }) => skill === "apply-document-quality-profile"),
      CAREER_DIRECT_USE_CONTRACT[0],
    ),
    /direct-use condition|exact CLI request|read order|review owner/,
    "guide body swap",
  );
  assert.throws(
    () => assertCareerDirectUseCard(
      applyCard.replaceAll("$game-design-career:apply-document-quality-profile", "$game-design-career:map-game-design-career"),
      entries.find(({ skill }) => skill === "apply-document-quality-profile"),
      CAREER_DIRECT_USE_CONTRACT[0],
    ),
    /exact CLI request|installed command/,
    "valid wrong CLI",
  );
  assert.throws(
    () => assertCareerDirectUseCard(
      applyCard.replace("`selection-record`, `quality-checklist`, `requirement-manifest`", "`quality-checklist`, `selection-record`, `requirement-manifest`"),
      entries.find(({ skill }) => skill === "apply-document-quality-profile"),
      CAREER_DIRECT_USE_CONTRACT[0],
    ),
    /manifest output order/,
    "output read-order swap",
  );
  assert.throws(
    () => assertCareerDirectUseCard(
      applyCard.replace(CAREER_DIRECT_USE_CONTRACT[0].orchestrator, "항상 $game-design-career:orchestrate-game-design-career"),
      entries.find(({ skill }) => skill === "apply-document-quality-profile"),
      CAREER_DIRECT_USE_CONTRACT[0],
    ),
    /conditional orchestrator boundary|unconditional orchestrator handoff/,
    "unconditional orchestrator handoff",
  );
  assert.throws(
    () => assertCareerDirectUseCard(
      applyCard + "\nTODO: direct route",
      entries.find(({ skill }) => skill === "apply-document-quality-profile"),
      CAREER_DIRECT_USE_CONTRACT[0],
    ),
    /no TODO/,
    "TODO",
  );
});

test("Career direct-use cards retain evidence, image, fallback, and export boundaries", async () => {
  const base = path.join(root, "guides/game-design-career/skills");
  const research = extractH3Section(await readFile(path.join(base, "research-game-design-jobs.md"), "utf8"), "직접 호출 활용 — research-game-design-jobs");
  const generate = extractH3Section(await readFile(path.join(base, "generate-image-assets.md"), "utf8"), "Career 직접 호출 활용 — generate-image-assets");
  const visual = ["svg-infographic", "visualize-career-roadmap"].map(async (skill) => extractH3Section(await readFile(path.join(base, `${skill}.md`), "utf8"), `${skill === "svg-infographic" ? "Career " : ""}직접 호출 활용 — ${skill}`));
  const exported = extractH3Section(await readFile(path.join(base, "export-career-documents.md"), "utf8"), "직접 호출 활용 — export-career-documents");

  assert.match(research, /sourceUrl[\s\S]*location[\s\S]*retrievalDate[\s\S]*region[\s\S]*sample boundary[\s\S]*reviewAfter/u);
  assert.match(research, /stale evidence는 current claim에 사용하지 않습니다/u);
  assert.throws(() => assert.match(research + "\nstale evidence는 current claim에 사용해도 됩니다.", /^(?![\s\S]*stale evidence는 current claim에 사용해도 됩니다.)[\s\S]*$/u), /did not match/i, "evidence freshness polarity");
  for (const phrase of ["provider routing", "IMAGE_GEN_MODE", "prompt·placeholder", "AI 생성 결과는 자동 최종 승인되지 않습니다"]) assert.ok(generate.includes(phrase), `generation boundary: ${phrase}`);
  for (const section of await Promise.all(visual)) {
    assert.match(section, /Skillstead[\s\S]*Node-free Chromium fallback[\s\S]*manual source checklist/u);
    assert.throws(() => assert.match(section.replaceAll("Node-free Chromium fallback", "renderer fallback"), /Node-free Chromium fallback/u), /did not match/i, "no-Node fallback removal");
  }
  for (const phrase of ["export 준비", "renderer", "재개", "실제 renderer 실행이나 파일 생성을 약속하지 않습니다"]) assert.ok(exported.includes(phrase), `export boundary: ${phrase}`);
  assert.throws(() => assert.match(exported + "\nPDF 생성 성공을 보장합니다.", /^(?![\s\S]*PDF 생성 성공을 보장합니다.)[\s\S]*$/u), /did not match/i, "export preclaim");
});

test("Career direct-use review owners are derived from canonical routing and role sources", async () => {
  const routing = JSON.parse(await readFile(path.join(root, "products/game-design-career/plugin/references/routing.json"), "utf8"));
  const expectedSkills = ["export-career-documents", "practice-game-design-interview", "reverse-engineer-game-design"];
  const expected = {
    "export-career-documents": ["evidence-auditor", "reverse-design-critic"],
    "practice-game-design-interview": ["evidence-auditor", "interview-coach"],
    "reverse-engineer-game-design": ["evidence-auditor", "reverse-design-critic"],
  };

  for (const skill of expectedSkills) {
    const reviewers = canonicalReviewerSet(routing, skill);
    assert.deepEqual(reviewers, expected[skill], `${skill}: canonical routing reviewer set`);
    for (const reviewer of reviewers) {
      const roleSource = await readFile(path.join(root, "products/game-design-career/plugin/agents", `${reviewer}.md`), "utf8");
      assert.match(roleSource, /^# .+\n\n## Responsibility/m, `${reviewer}: canonical role source`);
    }
    const markdown = await readFile(path.join(root, "guides/game-design-career/skills", `${skill}.md`), "utf8");
    const section = extractH3Section(markdown, `직접 호출 활용 — ${skill}`);
    for (const reviewer of reviewers) assert.ok(section.includes(`\`${reviewer}\``), `${skill}: canonical reviewer ${reviewer}`);
  }

  const exportCard = extractH3Section(await readFile(path.join(root, "guides/game-design-career/skills/export-career-documents.md"), "utf8"), "직접 호출 활용 — export-career-documents");
  assert.match(exportCard, /new-hire-reverse-design-export[\s\S]*reverse-design-critic/u, "export: reverse route conditional reviewer");
  assert.match(exportCard, /evidence-auditor[\s\S]*completion gate[\s\S]*대체하지 않습니다/u, "export: auditor non-substitution boundary");

  const interview = extractH3Section(await readFile(path.join(root, "guides/game-design-career/skills/practice-game-design-interview.md"), "utf8"), "직접 호출 활용 — practice-game-design-interview");
  assert.throws(() => assert.ok(interview.replace("`evidence-auditor`", "`career-strategist`").includes("`evidence-auditor`"), "interview owner mutation"), /interview owner mutation/, "wrong-valid interview owner swap");
  const reverse = extractH3Section(await readFile(path.join(root, "guides/game-design-career/skills/reverse-engineer-game-design.md"), "utf8"), "직접 호출 활용 — reverse-engineer-game-design");
  assert.throws(() => assert.ok(reverse.replace("`reverse-design-critic`", "`game-design-mentor`").includes("`reverse-design-critic`"), "reverse owner mutation"), /reverse owner mutation/, "wrong-valid reverse owner swap");
});

test("Career image generation and review cards keep their source-owned contracts separate", async () => {
  const skillRoot = path.join(root, "products/game-design-career/plugin/skills");
  const guideRoot = path.join(root, "guides/game-design-career/skills");
  const generate = extractH3Section(await readFile(path.join(guideRoot, "generate-image-assets.md"), "utf8"), "Career 직접 호출 활용 — generate-image-assets");
  const review = extractH3Section(await readFile(path.join(guideRoot, "review-image-assets.md"), "utf8"), "Career 직접 호출 활용 — review-image-assets");
  const reviewSource = await readFile(path.join(skillRoot, "review-image-assets/SKILL.md"), "utf8");

  for (const phrase of ["provider routing", "IMAGE_GEN_MODE", "prompt·placeholder"]) assert.ok(generate.includes(phrase), `generate-image contract: ${phrase}`);
  assertReviewImageDirectContract(review, reviewSource);
  assert.throws(() => assertReviewImageDirectContract(review + "\nprovider routing", reviewSource), /generation-only tokens/, "review rejects provider token spray");
  assert.throws(() => assertReviewImageDirectContract(review.replaceAll("named reviewer", "reviewer"), reviewSource), /named reviewer/, "review rejects removed named-human receipt field");
});

test("Career skill workbench inventories every installed skill once by lane", async () => {
  const inventory = await collectProductInventory(root, "game-design-career");
  const workbench = await readFile(path.join(root, "guides/game-design-career/use-cases/skill-workbench.md"), "utf8");
  const expectedGroups = {
    "역할·근거 lane": ["apply-document-quality-profile", "map-game-design-career", "orchestrate-game-design-career", "research-game-design-jobs"],
    "역기획·포트폴리오 lane": ["reverse-engineer-game-design", "build-game-design-portfolio", "review-game-design-portfolio"],
    "면접·성장 lane": ["practice-game-design-interview", "plan-junior-growth"],
    "이미지·시각화 lane": ["plan-image-assets", "generate-image-assets", "review-image-assets", "svg-infographic", "visualize-career-roadmap"],
    "export lane": ["export-career-documents"],
  };
  const observed = [];
  for (const [heading, skills] of Object.entries(expectedGroups)) {
    const section = extractSection(workbench, heading);
    for (const skill of skills) {
      const link = "[`" + skill + "`](../skills/" + skill + ".md)";
      assert.ok(section.includes(link), `${heading}: ${skill}`);
      observed.push(skill);
    }
  }
  assert.deepEqual(observed.sort(), inventory.skillIds, "workbench exact skill inventory once");
  for (const skill of inventory.skillIds) {
    const link = "[`" + skill + "`](../skills/" + skill + ".md)";
    assert.equal(workbench.split(link).length - 1, 1, `${skill}: no missing or duplicate workbench entry`);
  }
  const assertWorkbenchInventory = (candidate) => {
    for (const skill of inventory.skillIds) {
      const link = "[`" + skill + "`](../skills/" + skill + ".md)";
      assert.equal(candidate.split(link).length - 1, 1, `${skill}: workbench inventory mutation`);
    }
  };
  const applyLink = "[`apply-document-quality-profile`](../skills/apply-document-quality-profile.md)";
  const mapLink = "[`map-game-design-career`](../skills/map-game-design-career.md)";
  assert.throws(() => assertWorkbenchInventory(workbench.replace(applyLink, "")), /workbench inventory mutation/, "workbench missing skill mutation");
  assert.throws(() => assertWorkbenchInventory(workbench.replace(applyLink, mapLink)), /workbench inventory mutation/, "workbench skill swap/duplicate mutation");
  assert.match(workbench, /직접 스킬.*입력과 output이 하나로 확정/);
  assert.match(workbench, /여러 단계.*우선순위.*오케스트레이터|오케스트레이터.*여러 단계.*우선순위/);
});

test("Career skill contract rejects missing or reordered new sections", async () => {
  const markdown = await readFile(
    path.join(root, "guides/game-design-career/skills/map-game-design-career.md"),
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

test("Career skill handoffs are derived from canonical routes and source-backed exceptions", async () => {
  const inventory = await collectProductInventory(root, "game-design-career");
  const sources = await sourceInventory("game-design-career");
  const routing = JSON.parse(await readFile(path.join(root, "products/game-design-career/plugin/references/routing.json"), "utf8"));
  const profileMap = JSON.parse(await readFile(path.join(root, "products/game-design-career/plugin/references/document-quality/template-profile-map.json"), "utf8")).templates;
  const directRoutes = routing.routes.filter(({ skill }) => skill !== "orchestrate-game-design-career" && !sourceExceptions[skill]);
  const directSkills = [...new Set(directRoutes.map(({ skill }) => skill))];
  const allowedNextTargets = new Set([...inventory.skillIds, "downstream"]);

  for (const skillId of directSkills) {
    const routes = directRoutes.filter((route) => route.skill === skillId);
    const markdown = await readFile(path.join(root, "guides/game-design-career/skills", `${skillId}.md`), "utf8");
    const related = extractSection(markdown, "관련 템플릿·품질 프로필·전문 역할");
    const next = extractSection(markdown, "다음 작업 요청문");
    for (const route of routes) {
      const profileId = profileMap[route.artifactType];
      if (profileId) {
        assert.ok(related.includes(route.artifactType), `${skillId}: missing routed template ${route.artifactType}`);
        assert.ok(sources.profileIds.has(profileId), `${skillId}: unknown mapped profile ${profileId}`);
        assert.ok(related.includes(profileId), `${skillId}: missing mapped profile ${profileId}`);
      }
      for (const roleId of route.roles) {
        assert.ok(sources.roleIds.has(roleId), `${skillId}: unknown routed role ${roleId}`);
        assert.ok(related.includes(roleId), `${skillId}: missing routed role ${roleId}`);
      }
    }
    for (const target of next.match(/\$game-design-career:([a-z-]+)/g) ?? []) assert.ok(allowedNextTargets.has(target.split(":")[1]), `${skillId}: unknown next target ${target}`);
  }

  for (const [skillId, exception] of Object.entries(sourceExceptions)) {
    const markdown = await readFile(path.join(root, "guides/game-design-career/skills", `${skillId}.md`), "utf8");
    const guide = [extractSection(markdown, "관련 템플릿·품질 프로필·전문 역할"), extractSection(markdown, "다음 작업 요청문")].join("\n");
    assert.ok(sourceExceptionReasons.has(exception.reason), `${skillId}: unsupported source exception reason`);
    const source = await readFile(path.join(root, exception.sourcePath), "utf8");
    const sourceSection = extractSourceSection(source, exception.sourceSection);
    for (const term of exception.sourceTerms) assert.ok(sourceSection.includes(term), `${skillId}: source exception section missing ${term}`);
    for (const term of exception.guideTerms) assert.ok(guide.includes(term), `${skillId}: guide exception missing ${term}`);
  }

  const scenarioTargets = [...new Set(routing.scenarioChains.flatMap(({ skillChain }) => skillChain.map((id) => routing.routeSkills[id])).filter((skill) => skill !== "orchestrate-game-design-career"))];
  for (const skillId of ["apply-document-quality-profile", "orchestrate-game-design-career"]) {
    const markdown = await readFile(path.join(root, "guides/game-design-career/skills", `${skillId}.md`), "utf8");
    const scoped = [extractSection(markdown, "내부 진행 흐름"), extractSection(markdown, "Codex App 요청 예시"), extractSection(markdown, "Codex CLI 요청 예시"), extractSection(markdown, "다음 작업 요청문")].join("\n");
    assert.ok(scoped.includes("<selected-skill>"), `${skillId}: selected-skill replacement rule`);
    for (const target of scenarioTargets) assert.ok(scoped.includes(target), `${skillId}: missing scenario target ${target}`);
  }

  for (const skillId of inventory.skillIds) {
    const markdown = await readFile(path.join(root, "guides/game-design-career/skills", `${skillId}.md`), "utf8");
    const documentedIds = extractSection(markdown, "이미지·도식화 조건").match(/\b(?:skillstead-[a-z0-9-]+|[a-z0-9-]+-image)\b/g) ?? [];
    const mappedProfileIds = routing.routes.filter((route) => route.skill === skillId)
      .map((route) => profileMap[route.artifactType]).filter(Boolean);
    const selectedMediaIds = new Set(sources.profiles.filter((profile) => mappedProfileIds.includes(profile.profile_id))
      .flatMap((profile) => [...profile.required_images, ...profile.required_diagrams].map((item) => item.id)));
    for (const id of documentedIds) assert.ok(selectedMediaIds.has(id), `${skillId}: media ID is not selected-profile source-backed: ${id}`);
  }
});

test("Career scenario handoffs bind canonical scenario adjacency to each command", async () => {
  const routing = JSON.parse(await readFile(path.join(root, "products/game-design-career/plugin/references/routing.json"), "utf8"));
  const adjacency = scenarioAdjacency(routing);
  for (const skillId of ["map-game-design-career", "research-game-design-jobs"]) {
    const next = extractSection(await readFile(path.join(root, "guides/game-design-career/skills", `${skillId}.md`), "utf8"), "다음 작업 요청문");
    for (const { scenarioId, target } of adjacency.get(skillId)) {
      assertConditionalCommand(next, { condition: scenarioId, command: target, label: skillId });
    }
  }

  const mapNext = extractSection(await readFile(path.join(root, "guides/game-design-career/skills/map-game-design-career.md"), "utf8"), "다음 작업 요청문");
  assert.throws(() => assertConditionalCommand(
    mapNext.replace("$game-design-career:build-game-design-portfolio", "$game-design-career:research-game-design-jobs"),
    { condition: "new-graduate-system-design", command: "build-game-design-portfolio", label: "mutated map scenario" },
  ));
});

test("Career image-plan branches bind prompt-only, generation, and visualization semantics", async () => {
  const guide = await readFile(path.join(root, "guides/game-design-career/skills/plan-image-assets.md"), "utf8");
  const source = await readFile(path.join(root, "products/game-design-career/plugin/skills/plan-image-assets/SKILL.md"), "utf8");
  const next = extractSection(guide, "다음 작업 요청문");
  const workflow = extractSourceSection(source, "Workflow");
  for (const term of ["prompt-only", "generate-image-assets", "visualization workflow"]) assert.ok(workflow.includes(term));
  assert.match(next, /prompt-only[\s\S]*생성 handoff 없이/);
  assertConditionalCommand(next, { condition: "finite illustration job", command: "generate-image-assets", label: "plan-image-assets generate" });
  assertConditionalCommand(next, { condition: "Skillstead diagram slot", command: "visualize-career-roadmap", label: "plan-image-assets visualize" });
  assert.throws(() => assertConditionalCommand(next.replace("$game-design-career:visualize-career-roadmap", "$game-design-career:generate-image-assets"), { condition: "Skillstead diagram slot", command: "visualize-career-roadmap", label: "mutated image visualization branch" }));
});

test("Career apply and orchestrator bind every canonical route condition to its CLI target", async () => {
  const routing = JSON.parse(await readFile(path.join(root, "products/game-design-career/plugin/references/routing.json"), "utf8"));
  const routes = routing.routes.filter(({ skill }) => skill !== "orchestrate-game-design-career");
  for (const skillId of ["apply-document-quality-profile", "orchestrate-game-design-career"]) {
    const markdown = await readFile(path.join(root, "guides/game-design-career/skills", `${skillId}.md`), "utf8");
    assertRouteCommandRows(markdown, routes, skillId);
  }
  const apply = await readFile(path.join(root, "guides/game-design-career/skills/apply-document-quality-profile.md"), "utf8");
  const applyFlow = extractSection(apply, "내부 진행 흐름");
  assert.throws(() => assertRouteCommandRows(apply.replace(applyFlow, applyFlow.replace("$game-design-career:build-game-design-portfolio", "$game-design-career:research-game-design-jobs")), routes, "mutated apply target"));
  assert.throws(() => assertRouteCommandRows(apply.replace(applyFlow, applyFlow.replace("`new-hire-portfolio-build`", "new-hire-portfolio-build")), routes, "mutated apply condition"));
});

test("Career indexes every installed skill and canonical template exactly once", async () => {
  const inventory = await collectProductInventory(root, "game-design-career");
  const skillIndex = await readFile(
    path.join(root, "guides/game-design-career/skills/README.md"),
    "utf8",
  );
  const templates = await readFile(
    path.join(root, "guides/game-design-career/templates.md"),
    "utf8",
  );

  assert.deepEqual(extractFirstColumnIds(skillIndex), inventory.skillIds);
  assert.deepEqual(inventory.templateIds, expectedTemplateIds);
  assert.deepEqual(extractFirstColumnIds(templates), expectedTemplateIds);
});

test("Career template guide separates installed paths, authoring sources, and generated snapshots", async () => {
  const inventory = await collectProductInventory(root, "game-design-career");
  const templates = await readFile(path.join(root, "guides/game-design-career/templates.md"), "utf8");
  assert.doesNotMatch(templates, /Package path:/);
  assert.match(templates, /설치 상대 경로/);
  assert.match(templates, /저장소 authoring source/);
  assert.match(templates, /generated snapshot/);
  for (const id of inventory.templateIds) {
    const paths = [
      `assets/templates/${id}/`,
      `products/game-design-career/plugin/assets/templates/${id}/`,
      `plugins/game-design-career/assets/templates/${id}/`,
    ];
    for (const relative of paths) {
      assert.ok(templates.includes(`\`${relative}\``), `missing documented template path: ${relative}`);
      const filename = relative.startsWith("assets/")
        ? path.join(root, "products/game-design-career/plugin", relative)
        : path.join(root, relative);
      assert.ok((await lstat(filename)).isDirectory(), `template path does not exist: ${relative}`);
    }
  }
});

test("Career current-claim workflows preserve named evidence and inference limits", async () => {
  const guideIds = [
    "map-game-design-career",
    "orchestrate-game-design-career",
    "plan-junior-growth",
    "practice-game-design-interview",
    "research-game-design-jobs",
  ];

  for (const skillId of guideIds) {
    const markdown = await readFile(
      path.join(root, "guides/game-design-career/skills", skillId + ".md"),
      "utf8",
    );
    for (const phrase of ["사실", "추론", "제안", "검색일", "지역", "표본"] ) {
      assert.ok(markdown.includes(phrase), `${skillId}: missing current-claim boundary: ${phrase}`);
    }
  }
});

test("Career evidence workflows name the source record identifiers", async () => {
  const evidenceContracts = {
    "build-game-design-portfolio": ["claimId", "evidence address", "inspectabilityGate"],
    "map-game-design-career": ["currentEvidence", "targetLevel", "feedbackCadence"],
    "plan-junior-growth": ["requirementId", "eventId", "proofArtifact"],
    "practice-game-design-interview": ["questionId", "postingEvidenceIds", "portfolioEvidenceIds"],
    "research-game-design-jobs": ["sourceId", "retrievalDate", "reviewAfter"],
    "reverse-engineer-game-design": ["observation", "inference", "validationMethod"],
    "review-game-design-portfolio": ["findingId", "axisId", "observationState"],
  };

  for (const [skillId, fields] of Object.entries(evidenceContracts)) {
    const markdown = await readFile(
      path.join(root, "guides/game-design-career/skills", skillId + ".md"),
      "utf8",
    );
    for (const field of fields) {
      assert.ok(markdown.includes(field), `${skillId}: missing named evidence field: ${field}`);
    }
  }
});

test("Career growth and interview guides refresh stale posting evidence before current claims", async () => {
  const contracts = {
    "plan-junior-growth": "requirementId",
    "practice-game-design-interview": "questionId",
  };

  for (const [skillId, downstreamId] of Object.entries(contracts)) {
    const markdown = await readFile(
      path.join(root, "guides/game-design-career/skills", skillId + ".md"),
      "utf8",
    );
    const scopedContract = [
      "필수 입력과 선택 입력",
      "내부 진행 흐름",
      "실패·fallback·재개 방법",
    ].map((heading) => extractSection(markdown, heading)).join("\n");

    for (const phrase of [
      "sourceId",
      "sourceUrl",
      "official HTTPS",
      "postedDate",
      "retrievalDate",
      "reviewAfter",
      "research-game-design-jobs",
      "stale evidence는 current claim에 사용하지 않습니다",
      "기존 기록",
      "보존",
      "validator 재검증",
      "새 evidence IDs",
      downstreamId,
    ]) {
      assert.ok(scopedContract.includes(phrase), `${skillId}: missing scoped stale-evidence contract: ${phrase}`);
    }
  }
});

test("Career interview workflow binds question and answer records by stable questionId", async () => {
  const markdown = await readFile(
    path.join(root, "guides/game-design-career/skills/practice-game-design-interview.md"),
    "utf8",
  );
  const workflow = extractSection(markdown, "내부 진행 흐름");
  const result = extractSection(markdown, "생성 파일과 결과 구조");

  for (const field of [
    "questionId",
    "questionType",
    "postingEvidenceIds",
    "portfolioEvidenceIds",
    "prompt",
    "verificationStatus",
  ]) {
    assert.ok(workflow.includes(field), `interview workflow missing question field: ${field}`);
  }
  assert.match(workflow, /answer[^.\n]*feedback[^.\n]*같은 `questionId`를 재사용/);
  for (const phrase of ["question record", "answer-feedback record", "stable `questionId`", "결합"] ) {
    assert.ok(result.includes(phrase), `interview result missing question linkage: ${phrase}`);
  }
});

test("Career guides preserve evidence, image, visualization, and export contracts", async () => {
  const guidePaths = [
    "guides/game-design-career/document-quality.md",
    "guides/game-design-career/image-assets.md",
    "guides/game-design-career/visualization.md",
    "guides/game-design-career/exports.md",
  ];
  const joinedGuides = (
    await Promise.all(guidePaths.map((guidePath) => readFile(path.join(root, guidePath), "utf8")))
  ).join("\n");

  for (const phrase of [
    "사실", "추론", "제안", "검색일", "지역", "표본",
    "합격을 보장하지", "prompt-only", "select", "required", "all",
    "SVG", "2× PNG", "MD", "PDF", "DOCX", "PPTX",
  ]) {
    assert.ok(joinedGuides.includes(phrase), "missing Career guide contract: " + phrase);
  }
});

test("Career image and export guides document runtime precedence and downstream resume", async () => {
  const base = path.join(root, "guides/game-design-career");
  const images = await readFile(path.join(base, "image-assets.md"), "utf8");
  const exportsGuide = await readFile(path.join(base, "exports.md"), "utf8");
  const exportSkill = await readFile(path.join(base, "skills/export-career-documents.md"), "utf8");
  const imagePlan = await readFile(path.join(base, "skills/plan-image-assets.md"), "utf8");
  const glossary = await readFile(path.join(root, "guides/README.md"), "utf8");
  for (const phrase of ["workflow 호출 때마다", "현재 process environment", ".env보다 우선", "새 채팅", "새 세션"]) {
    assert.ok(images.includes(phrase), `Career image guide missing ${phrase}`);
  }
  for (const phrase of ["MD terminal validation", "<artifact-path>", "<export-manifest-path>", "새 세션", "downstream workflow"]) {
    assert.ok(exportsGuide.includes(phrase), `Career exports guide missing ${phrase}`);
  }
  assert.doesNotMatch(exportsGuide, /(?:probe|available)[^.\n]*(?:MD capability|MD\/PDF|MD·PDF)/i, "MD must not be probe-gated");
  const exportNext = extractSection(exportSkill, "다음 작업 요청문");
  assert.ok(exportNext.includes("downstream workflow"));
  assert.match(exportNext, /built-in canonical-markdown[\s\S]*MD.*terminal validation/);
  assert.match(exportNext, /pdf\/documents\/presentations/);
  assert.doesNotMatch(exportNext, /(?:probe|available)[^.\n]*(?:MD capability|MD\/PDF|MD·PDF)/i, "skill MD must not be probe-gated");
  const imageNext = extractSection(imagePlan, "다음 작업 요청문");
  for (const phrase of ["prompt-only", "prompt·placeholder", "generate-image-assets", "visualize-career-roadmap", "Skillstead diagram slot"]) assert.ok(imageNext.includes(phrase), `Career image-plan branch missing ${phrase}`);
  for (const term of ["host", "probe", "preflight", "downstream workflow"]) assert.ok(glossary.includes(term), `missing glossary term: ${term}`);
});

test("Career recipes keep only their local image-mode boundary and link the common guide", async () => {
  const recipes = ["interview-preparation", "job-research-gap", "junior-growth-transition", "portfolio-build-review", "reverse-design", "role-learning-roadmap"];
  for (const id of recipes) {
    const markdown = await readFile(path.join(root, "guides/game-design-career/recipes", `${id}.md`), "utf8");
    assert.match(markdown, /\[이미지 자산 흐름\]\(\.\.\/image-assets\.md\)/, `${id}: missing common image guide`);
    assert.ok((markdown.match(/prompt-only/g) ?? []).length <= 1, `${id}: repeats all image modes`);
  }
});

test("Career visualization guides preserve the no-Node Skillstead fallback", async () => {
  const guidePaths = [
    "guides/game-design-career/skills/svg-infographic.md",
    "guides/game-design-career/skills/visualize-career-roadmap.md",
    "guides/game-design-career/visualization.md",
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
