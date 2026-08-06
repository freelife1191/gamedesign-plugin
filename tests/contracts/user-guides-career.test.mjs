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
  assert.throws(() => assertRouteCommandRows(apply.replace("$game-design-career:build-game-design-portfolio", "$game-design-career:research-game-design-jobs"), routes, "mutated apply target"));
  assert.throws(() => assertRouteCommandRows(apply.replace("`new-hire-portfolio-build`", "new-hire-portfolio-build"), routes, "mutated apply condition"));
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
