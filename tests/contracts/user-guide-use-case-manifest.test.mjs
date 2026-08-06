import assert from "node:assert/strict";
import { lstat, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { loadUseCaseManifest } from "../../tooling/lib/use-case-guides.mjs";
import { collectHeadingAnchors } from "../../tooling/lib/user-guides.mjs";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

const FAQ_ANSWER_FIELDS = [
  "결론",
  "이유와 경계",
  "지금 실행할 요청문",
  "예상 결과물",
  "관련 가이드",
  "권리·근거·승인",
];
const AUDIENCE_SECTION_HEADINGS = [
  "현재 상황과 성공 신호",
  "권장 경로와 사례",
  "실행 요청",
  "결과와 검토·재개 경계",
];
const OUTPUT_TABLE_HEADINGS = [
  "사용자 요청",
  "템플릿",
  "최소 파일",
  "선택 이미지·도식 자산",
  "파생 형식",
  "사람 검토",
  "포트폴리오·팀 활용",
];

function markdownSections(markdown, level) {
  const marker = "#".repeat(level);
  const headings = [...markdown.matchAll(new RegExp(`^${marker} (.+)$`, "gm"))];
  return headings.map((heading, index) => ({
    heading: heading[1],
    body: markdown.slice(heading.index + heading[0].length, headings[index + 1]?.index).trim(),
  }));
}

function sectionByHeading(markdown, level, heading) {
  const section = markdownSections(markdown, level).find((entry) => entry.heading === heading);
  assert.ok(section, `missing H${level} section: ${heading}`);
  return section.body;
}

function fieldLabels(markdown) {
  return [...markdown.matchAll(/^\*\*([^*\n]+):\*\*/gm)].map((match) => match[1]);
}

function inlineFieldLabels(markdown) {
  return inlineFields(markdown).map(({ label }) => label);
}

function inlineFields(markdown) {
  const matches = [...markdown.matchAll(/\*\*([^*\n]+):\*\*/g)];
  return matches.map((match, index) => ({
    label: match[1],
    value: markdown.slice(match.index + match[0].length, matches[index + 1]?.index).trim(),
  }));
}

function tableHeadings(markdown, sectionHeading) {
  const body = sectionByHeading(markdown, 2, sectionHeading);
  const [header, separator, ...rows] = body.split("\n").filter((line) => line.startsWith("|"));
  assert.match(separator, /^\|(?:\s*:?-+:?\s*\|)+$/);
  assert.ok(rows.length > 0, `${sectionHeading} must contain data rows`);
  return header.split("|").slice(1, -1).map((value) => value.trim());
}

async function readCommonGuides() {
  const useCaseRoot = path.join(repoRoot, "guides", "use-cases");
  const filenames = {
    hub: path.join(useCaseRoot, "README.md"),
    audiencePaths: path.join(useCaseRoot, "audience-paths.md"),
    outputCatalog: path.join(useCaseRoot, "output-catalog.md"),
  };
  for (const filename of Object.values(filenames)) {
    const stat = await lstat(filename);
    assert.ok(stat.isFile() && !stat.isSymbolicLink(), `expected regular file: ${filename}`);
  }
  const [hub, audiencePaths, outputCatalog] = await Promise.all([
    readFile(filenames.hub, "utf8"),
    readFile(filenames.audiencePaths, "utf8"),
    readFile(filenames.outputCatalog, "utf8"),
  ]);
  return { hub, audiencePaths, outputCatalog };
}

test("use-case manifest exposes the versioned three-lane contract", async () => {
  const manifest = await loadUseCaseManifest({ repoRoot });
  assert.equal(manifest.version, 1);
  assert.ok(Array.isArray(manifest.audience_paths));
  assert.ok(Array.isArray(manifest.cases));
  assert.ok(Array.isArray(manifest.skill_cases));
});

test("common use-case hub has the exact H2 navigation and twelve FAQ IDs", async () => {
  const manifest = await loadUseCaseManifest({ repoRoot });
  const { hub, audiencePaths } = await readCommonGuides();

  assert.deepEqual(
    [...hub.matchAll(/^## (.+)$/gm)].map((match) => match[1]),
    [
      "무엇을 할 수 있나요",
      "누구를 위한 가이드인가요",
      "역량·콘셉트·스킬 중 선택하기",
      "작업 규모 선택하기",
      "결과물 먼저 보기",
      "공통 FAQ",
      "제품별 상세 가이드",
    ],
  );
  assert.deepEqual(
    [...hub.matchAll(/^### Q(\d{2})\b/gm)].map((match) => match[1]),
    ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"],
  );
  for (const entry of manifest.audience_paths) {
    assert.ok(collectHeadingAnchors(audiencePaths).has(entry.anchor), entry.id + " anchor");
  }
});

test("each common FAQ answer provides the six executable and evidence fields", async () => {
  const { hub } = await readCommonGuides();
  const faq = sectionByHeading(hub, 2, "공통 FAQ");
  const answers = markdownSections(faq, 3);

  assert.equal(answers.length, 12);
  for (const answer of answers) {
    assert.match(answer.heading, /^Q(?:0[1-9]|1[0-2])\. /, `invalid FAQ ID: ${answer.heading}`);
    assert.deepEqual(fieldLabels(answer.body), FAQ_ANSWER_FIELDS, `${answer.heading} answer shape`);
  }
});

test("each audience route preserves its executable case, output, review, and resume contract", async () => {
  const manifest = await loadUseCaseManifest({ repoRoot });
  const { audiencePaths } = await readCommonGuides();
  const routes = markdownSections(audiencePaths, 2).filter(({ heading }) => heading.startsWith("AUD-"));

  assert.equal(routes.length, manifest.audience_paths.length);
  const routeIds = new Set();
  for (const route of routes) {
    const id = /^((?:AUD)-\d{2})\b/.exec(route.heading)?.[1];
    assert.ok(id, `audience ID heading: ${route.heading}`);
    assert.ok(!routeIds.has(id), `duplicate audience route: ${id}`);
    routeIds.add(id);
    const entry = manifest.audience_paths.find((candidate) => candidate.id === id);
    assert.ok(entry, `manifest audience entry: ${id}`);
    const sections = markdownSections(route.body, 3);
    assert.deepEqual(sections.map(({ heading }) => heading), AUDIENCE_SECTION_HEADINGS, `${entry.id} section shape`);

    const byHeading = new Map(sections.map((section) => [section.heading, section.body]));
    for (const section of sections) assert.ok(section.body.length > 0, `${entry.id} ${section.heading} content`);
    const routeBody = byHeading.get("권장 경로와 사례");
    for (const phase of ["입문", "기초", "응용", "포트폴리오", "전체 프로젝트"]) {
      assert.match(routeBody, new RegExp(phase), `${entry.id} ${phase} route`);
    }
    assert.match(routeBody, /`(?:ST|CA)-(?:C|T)\d{2}`/, `${entry.id} recommended case ID`);

    const requestBody = byHeading.get("실행 요청");
    assert.match(requestBody, /^\*\*App 요청:\*\* `@Game Design (?:Studio|Career) .+`$/m, `${entry.id} App request`);
    assert.match(requestBody, /^\*\*CLI 요청:\*\* `\$game-design-(?:studio|career):[\w-]+ .+`$/m, `${entry.id} CLI request`);

    const resultBody = byHeading.get("결과와 검토·재개 경계");
    assert.deepEqual(inlineFieldLabels(resultBody), [
      "최소 결과",
      "선택 결과",
      "확장 결과",
      "사람 검토·승인 경계",
      "재개 조건·요청",
    ], `${entry.id} result levels and review/resume fields`);
    const resultFields = new Map(inlineFields(resultBody).map((field) => [field.label, field.value]));
    const reviewBoundary = resultFields.get("사람 검토·승인 경계");
    assert.match(reviewBoundary, /(사람|담당자|교사|멘토).*(검토|승인)/, `${entry.id} human review boundary`);
    assert.match(reviewBoundary, /(전에는|전까지)/, `${entry.id} approval gate`);
    const resume = resultFields.get("재개 조건·요청");
    assert.match(resume, /`[^`]+`/, `${entry.id} resume request`);
    assert.match(resume.slice(0, resume.indexOf("`")), /(하면|이면|으면|전에는)/, `${entry.id} resume condition`);
  }
});

test("output catalog keeps exact H2 result levels and request-table routing", async () => {
  const { outputCatalog } = await readCommonGuides();
  assert.deepEqual(
    markdownSections(outputCatalog, 2).slice(0, 3).map(({ heading }) => heading),
    ["최소 결과", "선택 결과", "확장 결과"],
  );
  assert.deepEqual(tableHeadings(outputCatalog, "Studio 요청과 결과"), OUTPUT_TABLE_HEADINGS);
  assert.deepEqual(tableHeadings(outputCatalog, "Career 요청과 결과"), OUTPUT_TABLE_HEADINGS);
});

test("output catalog preserves canonical reading order and renderer quality boundary", async () => {
  const { outputCatalog } = await readCommonGuides();
  const readingOrder = sectionByHeading(outputCatalog, 2, "Canonical Artifact 읽는 순서");
  const codeBlock = /```text\n([\s\S]*?)\n```/.exec(readingOrder);

  assert.ok(codeBlock, "canonical reading order text block");
  assert.deepEqual(codeBlock[1].split("\n"), [
    "content.md",
    "→ evidence.yml",
    "→ decisions/",
    "→ assets/",
    "→ export-manifest.yml",
  ]);
  assert.match(sectionByHeading(outputCatalog, 2, "최소 결과"), /renderer/);
  assert.match(sectionByHeading(outputCatalog, 2, "선택 결과"), /`concept-draft`/);
  assert.match(
    sectionByHeading(outputCatalog, 2, "확장 결과"),
    /PDF·DOCX·PPTX.*downstream renderer.*format\/visual QA/,
  );
  assert.match(readingOrder, /MD.*renderer 부재/);
});

test("Studio to Career handoff transfers public evidence only and excludes unsafe material", async () => {
  const { outputCatalog } = await readCommonGuides();
  const handoff = sectionByHeading(outputCatalog, 2, "Studio → Career handoff");
  const exclusions = handoff.split("\n").filter((line) => line.startsWith("- "));

  assert.match(handoff, /Studio Canonical Artifact와 Career Canonical Artifact는 분리/);
  assert.match(handoff, /공개 가능한.*문제.*결정.*검증 evidence/);
  assert.ok(exclusions.some((line) => /NDA/.test(line)), "excludes NDA material");
  assert.ok(exclusions.some((line) => /팀 PII/.test(line)), "excludes team PII");
  assert.ok(exclusions.some((line) => /소유권.*확인되지 않은/.test(line)), "excludes rights-unknown assets");
  assert.ok(exclusions.some((line) => /확인되지 않은 팀 성과/.test(line)), "excludes unverified team outcomes");
});

test("use-case manifest rejects duplicate IDs and traversal diagram paths", async (t) => {
  const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), "use-case-manifest-"));
  t.after(() => rm(fixtureRoot, { recursive: true, force: true }));
  await mkdir(path.join(fixtureRoot, "guides", "use-cases"), { recursive: true });
  await writeFile(path.join(fixtureRoot, "guides", "use-cases", "use-case-manifest.json"), JSON.stringify({
    version: 1,
    audience_paths: [
      {
        id: "AUD-01",
        slug: "game-design-student",
        document: "guides/use-cases/audience-paths.md",
        anchor: "aud-01",
        level: "foundation",
        recommended_views: [],
        outputs: [],
        diagram: { svg: "../../escape.svg", png: "guides/assets/aud-01.png", alt: "Audience path" },
      },
      {
        id: "AUD-01",
        slug: "job-seeking-student",
        document: "guides/use-cases/audience-paths.md",
        anchor: "aud-02",
        level: "foundation",
        recommended_views: [],
        outputs: [],
        diagram: { svg: "guides/assets/aud-02.svg", png: "guides/assets/aud-02.png", alt: "Audience path" },
      },
    ],
    cases: [],
    skill_cases: [],
  }, null, 2));

  const { validateUseCaseGuides } = await import("../../tooling/lib/use-case-guides.mjs");
  const result = await validateUseCaseGuides({ repoRoot: fixtureRoot });

  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes("duplicate id: AUD-01")));
  assert.ok(result.errors.some((error) => error.includes("unsafe path: ../../escape.svg")));
});

test("use-case manifest reports malformed case skills with injected inventories", async (t) => {
  const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), "use-case-manifest-"));
  t.after(() => rm(fixtureRoot, { recursive: true, force: true }));
  await mkdir(path.join(fixtureRoot, "guides", "use-cases"), { recursive: true });
  await writeFile(path.join(fixtureRoot, "guides", "use-cases", "use-case-manifest.json"), JSON.stringify({
    version: 1,
    audience_paths: [],
    cases: [{
      id: "ST-C01",
      product: "game-design-studio",
      view: "competency",
      audiences: ["AUD-01"],
      level: ["foundation"],
      document: "guides/game-design-studio/use-cases/competency-paths.md",
      anchor: "st-c01",
      templates: [],
      outputs: [],
      diagram: { svg: "guides/assets/st-c01.svg", png: "guides/assets/st-c01.png", alt: "Studio case" },
    }],
    skill_cases: [],
  }, null, 2));

  const { validateUseCaseGuides } = await import("../../tooling/lib/use-case-guides.mjs");
  const result = await validateUseCaseGuides({
    repoRoot: fixtureRoot,
    inventories: new Map([["game-design-studio", { skillIds: [], templateIds: [] }]]),
  });

  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes("cases[0].skills must be an array")));
});
