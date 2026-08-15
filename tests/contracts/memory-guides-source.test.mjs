import assert from "node:assert/strict";
import { lstat, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { extractMarkdownLinks } from "../../tooling/lib/user-guides.mjs";

const root = fileURLToPath(new URL("../..", import.meta.url));
const products = ["game-design-studio", "game-design-career"];
const commonSkillIds = [
  "analyze-game-design-references",
  "archify",
  "capture-game-design-memory",
  "humanize-korean",
  "maintain-game-design-glossary",
  "maintain-game-design-memory",
  "retrieve-approved-design-memory",
  "svg-infographic",
];
const productSkillIds = Object.freeze({
  "game-design-studio": [
    "apply-document-quality-profile", "define-game-vision", "design-cutscene-visual-preproduction", "design-game-content", "design-game-economy-and-liveops", "design-game-systems", "design-player-experience", "export-game-design-documents", "generate-image-assets", "orchestrate-game-design-project", "plan-game-production", "plan-image-assets", "polish-game-design-writing", "review-game-design", "review-image-assets", "visualize-game-design",
  ],
  "game-design-career": [
    "apply-document-quality-profile", "build-game-design-portfolio", "export-career-documents", "generate-image-assets", "map-game-design-career", "orchestrate-game-design-career", "plan-image-assets", "plan-junior-growth", "polish-game-design-writing", "practice-game-design-interview", "research-game-design-jobs", "reverse-engineer-game-design", "review-game-design-portfolio", "review-image-assets", "visualize-career-roadmap",
  ],
});
const topLevelScripts = [
  "analyze-game-design-references.mjs", "build-image-asset-plan.mjs", "capability-probe.mjs", "capture-design-memory.mjs", "compile-image-prompts.mjs", "data-only-snapshot.mjs", "estimate-cutscene-image-cost.mjs", "generate-openai-images.mjs", "load-memory-config.mjs", "maintain-design-memory.mjs", "manage-game-design-glossary.mjs", "plan-cutscene-visual-preproduction.mjs", "quality-source-anchors.mjs", "resolve-quality-profile.mjs", "retrieve-design-memory.mjs", "review-cutscene-continuity.mjs", "run-approved-cutscene-image-stage.mjs", "run-game-design-writing-polish.mjs", "run-image-asset-workflow.mjs", "stop-artifact-review.mjs", "validate-artifact.mjs", "validate-cutscene-visual-preproduction.mjs", "validate-design-memory.mjs", "validate-game-design-writing-language.mjs", "validate-image-assets.mjs", "validate-image-config.mjs", "validate-quality-profile.mjs", "validate-reference-intelligence.mjs", "validate-reference-preset.mjs", "validate-writing-revision.mjs",
];
const memoryHeadings = [
  "어떤 기록을 기억하는가",
  "기억하지 않는 내용",
  "기본 작업 흐름",
  "후보 확인·승인·거부·폐기 예시",
  ".env 설정과 완전 비활성화",
  "로컬 Git 제외와 프로젝트 이동",
  "손상·충돌·출처 변경 복구",
];
const rootH2 = [
  "목차",
  "플러그인 소개",
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
const changedMarkdown = [
  "README.md",
  "products/game-design-studio/plugin/README.md",
  "products/game-design-career/plugin/README.md",
  ...products.flatMap((product) => [
    `guides/${product}/README.md`,
    `guides/${product}/installation.md`,
    `guides/${product}/quick-start.md`,
    `guides/${product}/workflow.md`,
    `guides/${product}/faq.md`,
    `guides/${product}/memory.md`,
    `guides/${product}/skills/README.md`,
  ]),
];
const cutsceneGuideRequests = [
  "컷씬 brief와 beat만 작성",
  "shot list와 continuity bible 작성",
  "마스터 프롬프트 패키지만 작성",
  "스타일 마스터 비용과 승인",
  "승인한 스타일 master 생성",
  "reference master bound prompt 재계산",
  "reference master 비용과 승인",
  "keyframe 비용과 승인",
  "storyboard와 variant 비용과 승인",
  "continuity 검토와 실패 ID 재시도",
];

async function directoryIds(relative) {
  const entries = await readdir(path.join(root, relative), { withFileTypes: true });
  return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
}

function headingNames(markdown, level) {
  const pattern = new RegExp(`^#{${level}} (.+)$`, "gmu");
  return [...markdown.matchAll(pattern)].map((match) => match[1]);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function listedSkillIds(markdown) {
  return [...markdown.matchAll(/^\| \[`([a-z0-9-]+)`\]\([^)]*\) \|/gmu)].map((match) => match[1]).sort();
}

function listedTopLevelScripts(markdown) {
  const section = markdown.split("## 설치된 top-level scripts\n", 2)[1]?.split("\n## ", 1)[0];
  assert.ok(section, "product README keeps the top-level scripts section");
  return [...section.matchAll(/^\| `([a-z0-9-]+\.mjs)` \|/gmu)].map((match) => match[1]).sort();
}

function parseCutsceneGuide(markdown) {
  return {
    headings: [...markdown.matchAll(/^## (.+)$/gmu)].map(([, heading]) => heading),
    requestBlocks: [...markdown.matchAll(/```text\n([^`]+)```/gmu)].map(([, request]) => request.trim()),
  };
}

function assertExactInstallInventory({ product, actualProductSkillIds, actualCommonSkillIds, actualScripts, skillGuide, productReadme }) {
  const expectedSkills = [...productSkillIds[product], ...commonSkillIds].sort();
  assert.deepEqual(actualProductSkillIds, [...productSkillIds[product]].sort(), `${product}: source product skill IDs`);
  assert.deepEqual(actualCommonSkillIds, [...commonSkillIds].sort(), `${product}: source common skill IDs`);
  assert.deepEqual(actualScripts, [...topLevelScripts].sort(), `${product}: source top-level scripts`);
  const expectedSkillCount = product === "game-design-studio" ? 24 : 23;
  assert.equal(expectedSkills.length, expectedSkillCount, `${product}: expected installed skills`);
  assert.equal(topLevelScripts.length, 30, `${product}: expected top-level scripts`);
  assert.deepEqual(listedSkillIds(skillGuide), expectedSkills, `${product}: skill guide lists exactly the installed skill IDs`);
  assert.deepEqual(listedTopLevelScripts(productReadme), [...topLevelScripts].sort(), `${product}: README lists exactly the 30 top-level scripts`);
}

function assertKoreanMemoryContract(markdown, label, laneHeading) {
  for (const heading of [...memoryHeadings, laneHeading]) {
    assert.match(markdown, new RegExp(`^## ${escapeRegExp(heading)}$`, "mu"), `${label}: ${heading}`);
  }
  const ordered = headingNames(markdown, 2);
  assert.deepEqual(ordered, [...memoryHeadings, laneHeading], `${label}: eight sections stay ordered`);

  const required = [
    /현재 프로젝트를 뜻하는 `project`가 기본 범위/u,
    /로컬에만 보관/u,
    /자동으로 Git에 커밋하거나 원격 저장소로 보내지/u,
    /`GAME_DESIGN_MEMORY_ENABLED=false`/u,
    /이번 작업에서는 이전 기억을 사용하지 마/u,
    /검토 대기 후보\(`candidate`\)/u,
    /후보를 자동 승인하지 않습니다/u,
    /이름이 확인된 사람/u,
    /검토·만료 시점/u,
    /출처 파일/u,
    /충돌/u,
    /목록에 표시된 기억 ID\(memory-\.\.\.\)/u,
    /현재 충돌한 최신 기록 갈래/u,
    /기억 없이 기존 기획 작업을 계속/u,
    /기준 (?:기획 |작업 )?결과(?:물)? 폴더/u,
  ];
  for (const pattern of required) assert.match(markdown, pattern, `${label}: ${pattern}`);

  const forbidden = [
    /비활성화(?:해도|한 상태에서도).*후보(?:를|가) (?:만듭니다|작성)/u,
    /후보를 자동 승인합니다/u,
    /`global`이 기본 범위/u,
    /자동으로 Git에 커밋(?:하고|하거나) 원격 저장소로 보냅니다/u,
    /기억 (?:오류|장애).*(?:기획|작업).*(?:중단|멈춤)/u,
  ];
  for (const pattern of forbidden) assert.doesNotMatch(markdown, pattern, `${label}: ${pattern}`);
  assert.doesNotMatch(markdown, /(?:^|\s)(?:candidate|approved|rejected|discarded|stale|scope)(?:\s*[,/→]|\s*$)/gmu, `${label}: internal states need Korean explanations`);
}

test("memory guides are Korean-first, local-only, human-approved, and fail-open", async () => {
  for (const product of products) {
    const markdown = await readFile(path.join(root, "guides", product, "memory.md"), "utf8");
    const laneHeading = product === "game-design-studio" ? "Studio 전용 경계" : "Career 전용 경계";
    assertKoreanMemoryContract(markdown, product, laneHeading);
  }
});

test("source inventories and product documentation list the frozen cutscene inventory", async () => {
  const buildSource = await readFile(path.join(root, "tooling/lib/build-product.mjs"), "utf8");
  for (const id of ["svg-infographic", "archify", "humanize-korean"]) {
    assert.match(buildSource, new RegExp(`skills/${id.replace(/-/gu, "\\-")}`), id);
  }
  assert.match(buildSource, /\["shared\/memory\/skills", "skills"\]/u);
  assert.match(buildSource, /\["shared\/reference-intelligence\/skills", "skills"\]/u);

  const memoryIds = await directoryIds("shared/memory/skills");
  const actualCommonSkillIds = ["analyze-game-design-references", "archify", ...memoryIds, "humanize-korean", "maintain-game-design-glossary", "svg-infographic"].sort();

  const scripts = (await readdir(path.join(root, "shared/scripts"), { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith(".mjs"))
    .map((entry) => entry.name)
    .sort();
  assert.equal(scripts.filter((name) => /(?:capture|maintain|retrieve|validate-design-memory|load-memory-config)/u.test(name)).length, 5);

  for (const product of products) {
    const actualProductSkillIds = await directoryIds(`products/${product}/plugin/skills`);

    const skillGuide = await readFile(path.join(root, "guides", product, "skills/README.md"), "utf8");
    const productReadme = await readFile(path.join(root, "products", product, "plugin/README.md"), "utf8");
    assertExactInstallInventory({ product, actualProductSkillIds, actualCommonSkillIds, actualScripts: scripts, skillGuide, productReadme });
    for (const markdown of [skillGuide, productReadme]) {
      assert.match(markdown, product === "game-design-studio" ? /제품 스킬 16개/u : /제품 스킬 15개/u);
      assert.match(markdown, /공통 스킬 8개/u);
      assert.match(markdown, product === "game-design-studio" ? /설치 스킬(?:은)? 24개/u : /설치 스킬(?:은)? 23개/u);
    }
    const visibleLinks = extractMarkdownLinks(productReadme);
    for (const [label, target] of [
      ["레퍼런스 분석 스킬", "../../../shared/reference-intelligence/skills/analyze-game-design-references/SKILL.md"],
      ["용어 사전 스킬", "../../../shared/reference-intelligence/skills/maintain-game-design-glossary/SKILL.md"],
    ]) {
      assert.ok(visibleLinks.some((link) => link.label === label && link.target === target), `${product}: visible source link ${label}`);
    }
    assert.match(productReadme, /기존 16개와 기억 스크립트 5개, 레퍼런스 인텔리전스 스크립트 4개, 컷씬 프리프로덕션 스크립트 5개/u);
    assert.match(productReadme, /최상위 실행 스크립트 30개/u);
    assert.match(productReadme, /`scripts\/lib\/\*\.mjs`.*내부 도구/u);
  }
});

test("cutscene guide keeps copyable requests and frozen Studio/Career inventories", async () => {
  const guide = parseCutsceneGuide(await readFile(path.join(root, "guides/game-design-studio/cutscene-visual-preproduction.md"), "utf8"));
  assert.deepEqual(guide.headings.slice(0, 5), [
    "제공자와 품질을 먼저 고르기",
    "컷씬 비주얼 프리프로덕션",
    "Prompt Only",
    "Estimate Only",
    "Generate After Approval",
  ]);
  assert.deepEqual(guide.requestBlocks, cutsceneGuideRequests);

  const inventories = {};
  for (const product of products) {
    const routing = JSON.parse(await readFile(path.join(root, "products", product, "plugin/references/routing.json"), "utf8"));
    const installed = [...(await directoryIds(`products/${product}/plugin/skills`)), ...commonSkillIds].sort();
    inventories[product === "game-design-studio" ? "studio" : "career"] = {
      routing: routing.skillIds.length,
      installed: installed.length,
      topLevelScripts: (await readdir(path.join(root, "shared/scripts"))).filter((name) => name.endsWith(".mjs")).length,
    };
  }
  assert.deepEqual(inventories, {
    studio: { routing: 23, installed: 24, topLevelScripts: 30 },
    career: { routing: 22, installed: 23, topLevelScripts: 30 },
  });
});

test("cutscene guide contracts reject reordered requests and unsafe generation wording", async () => {
  const source = await readFile(path.join(root, "guides/game-design-studio/cutscene-visual-preproduction.md"), "utf8");
  const reordered = source.replace(cutsceneGuideRequests[0], "임시 요청").replace(cutsceneGuideRequests[1], cutsceneGuideRequests[0]).replace("임시 요청", cutsceneGuideRequests[1]);
  assert.notEqual(reordered, source, "request-order mutation changes the fixture");
  assert.notDeepEqual(parseCutsceneGuide(reordered).requestBlocks, cutsceneGuideRequests);
  const unsafe = source.replace("이름을 기록한 실시간 승인", "자동 승인");
  assert.notEqual(unsafe, source, "approval mutation changes the fixture");
  assert.doesNotMatch(source, /자동 승인/u);
  assert.match(source, /이름을 기록한 실시간 승인/u);
});

test("entry, install, quick-start, workflow, FAQ, and skill guides link to product memory guidance", async () => {
  const rootReadme = await readFile(path.join(root, "README.md"), "utf8");
  assert.match(rootReadme, /guides\/game-design-studio\/memory\.md/u);
  assert.match(rootReadme, /guides\/game-design-career\/memory\.md/u);
  assert.match(rootReadme, /@Game Design Studio 지난 플레이테스트 결과와 승인된 프로젝트 교훈/u);
  assert.match(rootReadme, /이번 작업에서는 이전 기억을 사용하지 마/u);
  assert.match(rootReadme, /기억 후보를 보여줘/u);
  assert.match(rootReadme, /이 교훈은 앞으로 이 프로젝트에 적용해/u);

  for (const product of products) {
    for (const filename of ["README.md", "installation.md", "quick-start.md", "workflow.md", "faq.md"]) {
      const markdown = await readFile(path.join(root, "guides", product, filename), "utf8");
      const target = filename === "README.md" ? "memory.md" : "memory.md";
      assert.match(markdown, new RegExp(`\\(${target.replace(".", "\\.")}\\)`, "u"), `${product}/${filename}`);
    }
  }
});

test("root README keeps its H2 order, TOC, and 18 representative cards", async () => {
  const markdown = await readFile(path.join(root, "README.md"), "utf8");
  assert.deepEqual(headingNames(markdown, 2), rootH2);
  for (const heading of rootH2.slice(1)) {
    assert.match(markdown, new RegExp(`\\[${escapeRegExp(heading)}\\]\\(#`, "u"), heading);
  }
  assert.equal((markdown.match(/<details data-prompt-id=/gu) ?? []).length, 18);
  assert.equal((markdown.match(/data-prompt-id="studio:case:/gu) ?? []).length, 7);
  assert.equal((markdown.match(/data-prompt-id="career:case:/gu) ?? []).length, 7);
  assert.equal((markdown.match(/data-prompt-id="suite:[^"]+:case"/gu) ?? []).length, 4);
});

test("changed guides keep relative Markdown links resolvable", async () => {
  for (const relative of changedMarkdown) {
    const filename = path.join(root, relative);
    const markdown = await readFile(filename, "utf8");
    for (const match of markdown.matchAll(/!?(?:\[[^\]]*\])\(([^)]+)\)/gu)) {
      const rawTarget = match[1].trim().replace(/^<|>$/gu, "");
      if (/^(?:https?:|mailto:|#)/u.test(rawTarget) || rawTarget.includes("<")) continue;
      const pathname = decodeURIComponent(rawTarget.split("#", 1)[0]);
      const target = path.resolve(path.dirname(filename), pathname);
      const fromRoot = path.relative(root, target);
      assert.ok(fromRoot === "" || (!fromRoot.startsWith(`..${path.sep}`) && fromRoot !== ".." && !path.isAbsolute(fromRoot)), `${relative}: ${rawTarget}`);
      await lstat(target).catch((error) => assert.fail(`${relative}: broken link ${rawTarget}: ${error.code}`));
    }
  }
});

test("new Korean guides pass the humanize quick-rule guard", async () => {
  for (const product of products) {
    const markdown = await readFile(path.join(root, "guides", product, "memory.md"), "utf8");
    for (const pattern of [/에 있어(?:서)?/u, /되어진/u, /지게 된다/u, /시사하는 바/u, /주목할 만/u, /결론적으로/u, /요약하면/u]) {
      assert.doesNotMatch(markdown, pattern, `${product}: ${pattern}`);
    }
    assert.equal((markdown.match(/^[^#\n]*[\p{Extended_Pictographic}]/gmu) ?? []).length, 0, product);
    assert.equal((markdown.match(/^---$/gmu) ?? []).length, 0, product);
    assert.ok(markdown.split(/\n{2,}/u).filter((paragraph) => !/^(?:#|```|\|)/u.test(paragraph)).some((paragraph) => (paragraph.match(/[.!?](?:\s|$)/gu) ?? []).length >= 2), `${product}: paragraph rhythm`);
  }
});

test("cutscene Korean source keeps quick-rule boundaries and the runtime dispatch order", async () => {
  const files = [
    "guides/game-design-studio/cutscene-visual-preproduction.md",
    "guides/game-design-studio/skills/design-cutscene-visual-preproduction.md",
    "guides/prompt-templates/catalog/studio-cutscene.json",
    "guides/prompt-templates/studio/design-cutscene-visual-preproduction.md",
  ];
  const sources = await Promise.all(files.map((relative) => readFile(path.join(root, relative), "utf8")));
  for (const [index, source] of sources.entries()) {
    const quickRuleSource = files[index] === "guides/game-design-studio/skills/design-cutscene-visual-preproduction.md"
      ? source.replace("### 직접 호출 활용 — design-cutscene-visual-preproduction", "### 직접 호출 활용: design-cutscene-visual-preproduction")
      : source;
    for (const pattern of [/에 있어(?:서)?/u, /되어진/u, /지게 된다/u, /시사하는 바/u, /주목할 만/u, /결론적으로/u, /요약하면/u, /—/u]) {
      assert.doesNotMatch(quickRuleSource, pattern, `${files[index]}: ${pattern}`);
    }
    assert.doesNotMatch(source, /자동 승인/u, `${files[index]}: no automatic approval`);
    assert.match(source, /컷씬|style-master/u, `${files[index]}: meaningful cutscene source`);
  }
  const [howTo, skillGuide, catalog] = sources;
  assert.match(howTo, /견적 초안은 미리 만들 수 있습니다[\s\S]*style-master.*current estimate.*이름을 기록한 실시간 승인[\s\S]*style-master.*선행 wave가 없/u);
  assert.match(howTo, /style-master.*뒤의 wave[\s\S]*직전 모든 wave가 완료/u);
  assert.match(howTo, /keyframes.*완료.*storyboard의 generation-ready binding과 유료 dispatch에만 필요/u);
  assert.match(howTo, /storyboard의 기획·검토·견적 초안은 먼저 만들 수 있/u);
  assert.match(skillGuide, /style-master.*current estimate.*이름 있는 실시간 승인[\s\S]*style-master.*선행 조건이 없/u);
  assert.match(skillGuide, /뒤의 wave.*모든 선행 wave 완료/u);
  assert.match(catalog, /paid dispatch.*current estimate.*named approval[\s\S]*style-master 뒤의 wave.*선행 wave 완료/u);
});

test("hostile documentation mutations are non-vacuously rejected", async () => {
  const source = await readFile(path.join(root, "guides/game-design-studio/memory.md"), "utf8");
  const mutations = [
    source.replace("비활성화하면 저장소를 읽거나 쓰지 않으며 후보도 만들지 않습니다.", "비활성화해도 후보를 만듭니다."),
    source.replace("후보를 자동 승인하지 않습니다.", "후보를 자동 승인합니다."),
    source.replace("현재 프로젝트를 뜻하는 `project`가 기본 범위", "모든 프로젝트를 뜻하는 `global`이 기본 범위"),
    source.replace("자동으로 Git에 커밋하거나 원격 저장소로 보내지", "자동으로 Git에 커밋하고 원격 저장소로 보내"),
    source.replace("기억 없이 기존 기획 작업을 계속", "기억 장애가 생기면 기존 기획 작업을 중단"),
    source.replace("검토 대기 후보(`candidate`)", "candidate"),
  ];
  for (const [index, mutated] of mutations.entries()) {
    assert.notEqual(mutated, source, `mutation ${index + 1} changed the fixture`);
    assert.throws(() => assertKoreanMemoryContract(mutated, `mutation ${index + 1}`, "Studio 전용 경계"));
  }

  const actualCommonSkillIds = ["analyze-game-design-references", "archify", ...(await directoryIds("shared/memory/skills")), "humanize-korean", "maintain-game-design-glossary", "svg-infographic"].sort();
  const actualScripts = (await readdir(path.join(root, "shared/scripts"), { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith(".mjs"))
    .map((entry) => entry.name)
    .sort();
  for (const product of products) {
    const actualProductSkillIds = await directoryIds(`products/${product}/plugin/skills`);
    const skillGuide = await readFile(path.join(root, "guides", product, "skills/README.md"), "utf8");
    const productReadme = await readFile(path.join(root, "products", product, "plugin/README.md"), "utf8");
    for (const id of [...productSkillIds[product], ...commonSkillIds]) {
      const mutated = skillGuide.replace("[`" + id + "`]", "[`" + id + "-mutated`]");
      assert.notEqual(mutated, skillGuide, `${product}: skill mutation changed ${id}`);
      assert.throws(() => assertExactInstallInventory({ product, actualProductSkillIds, actualCommonSkillIds, actualScripts, skillGuide: mutated, productReadme }), `${product}: skill mutation rejects ${id}`);
    }
    for (const script of topLevelScripts) {
      const mutated = productReadme.replace("| `" + script + "` |", "| `" + script + "-mutated` |");
      assert.notEqual(mutated, productReadme, `${product}: script mutation changed ${script}`);
      assert.throws(() => assertExactInstallInventory({ product, actualProductSkillIds, actualCommonSkillIds, actualScripts, skillGuide, productReadme: mutated }), `${product}: script mutation rejects ${script}`);
    }
    for (const id of ["analyze-game-design-references", "maintain-game-design-glossary"]) {
      const row = skillGuide.split("\n").find((line) => line.startsWith("| [`" + id + "`]("));
      assert.ok(row, `${product}: source skill row exists for ${id}`);
      const missing = skillGuide.replace(row + "\n", "");
      assert.notEqual(missing, skillGuide, `${product}: missing skill mutation changed ${id}`);
      assert.throws(() => assertExactInstallInventory({ product, actualProductSkillIds, actualCommonSkillIds, actualScripts, skillGuide: missing, productReadme }), `${product}: missing skill rejects ${id}`);
    }
    for (const script of ["analyze-game-design-references.mjs", "manage-game-design-glossary.mjs", "validate-game-design-writing-language.mjs", "validate-reference-intelligence.mjs"]) {
      const row = productReadme.split("\n").find((line) => line.startsWith("| `" + script + "` |"));
      assert.ok(row, `${product}: source script row exists for ${script}`);
      const missing = productReadme.replace(row + "\n", "");
      assert.notEqual(missing, productReadme, `${product}: missing script mutation changed ${script}`);
      assert.throws(() => assertExactInstallInventory({ product, actualProductSkillIds, actualCommonSkillIds, actualScripts, skillGuide, productReadme: missing }), `${product}: missing script rejects ${script}`);
    }
  }
});
