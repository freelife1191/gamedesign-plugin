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

function fencedRequests(section) {
  return [...section.matchAll(/```text\n([\s\S]*?)\n```/g)].map((match) => match[1]);
}

function assertDirectUseContract(markdown, skillId) {
  const section = extractDirectUseSection(markdown, skillId);
  const labels = [
    "직접 호출 조건",
    "입문 요청문",
    "응용 요청문",
    "고급 요청문",
    "예상 파일과 읽는 순서",
    "다음 스킬 조건",
  ];
  for (const label of labels) assert.match(section, new RegExp(`^#### ${label}$`, "m"), `${skillId}: ${label} subheading`);

  const requests = fencedRequests(section);
  assert.equal(requests.length, 3, `${skillId}: exactly three levelled copyable requests`);
  for (const request of requests) {
    assert.match(request, new RegExp(`\\$game-design-studio:${skillId}\\b`), `${skillId}: direct request target`);
  }
  assert.match(section, /content\.md\s*→\s*evidence\.yml/, `${skillId}: canonical read order`);
  assert.match(section, /if |때만|경우에만/i, `${skillId}: next-skill condition is conditional`);
}

function extractFirstColumnIds(markdown) {
  return [...markdown.matchAll(/^\| (?:`([^`]+)`|\[`([^`]+)`\]\([^)]+\)) \|/gm)]
    .map((match) => match[1] ?? match[2])
    .sort();
}

test("Studio documents every installed skill with the common contract", async () => {
  const inventory = await collectProductInventory(root, "game-design-studio");
  assert.equal(inventory.skillIds.length, 15);

  for (const skillId of inventory.skillIds) {
    const markdown = await readFile(
      path.join(root, "guides/game-design-studio/skills", skillId + ".md"),
      "utf8",
    );
    assertSkillContract(markdown, skillId);
    assertDirectUseContract(markdown, skillId);
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
  const lanes = ["오케스트레이션", "도메인 설계", "품질·검토", "이미지", "시각화", "출력"];
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
});

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
  assert.throws(() => assertRouteCommandRows(apply.replace("$game-design-studio:design-game-systems", "$game-design-studio:define-game-vision"), routes, "game-design-studio", "mutated apply target"));
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
