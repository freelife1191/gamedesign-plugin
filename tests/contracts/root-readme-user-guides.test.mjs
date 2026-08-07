import assert from "node:assert/strict";
import { lstat, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  collectHeadingAnchors,
  collectProductInventory,
  extractMarkdownLinks,
} from "../../tooling/lib/user-guides.mjs";

const root = fileURLToPath(new URL("../..", import.meta.url));
const guideRoot = path.join(root, "guides");
const products = ["game-design-studio", "game-design-career"];
const requiredRootHeadings = [
  "이 플러그인으로 할 수 있는 일",
  "사용자 유형별 추천 시작점",
  "활용 방법 선택",
  "어떤 플러그인을 설치할까",
  "지원 환경",
  "Codex App 설치",
  "Codex CLI 설치",
  "5분 빠른 시작",
  "기획 문서 템플릿",
  "이미지와 도식화",
  "문서 내보내기",
  "상세 사용 가이드",
  "제한·개인정보·권리·사람 승인",
  "문제 해결",
  "기술 문서·기여·라이선스",
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

function section(markdown, heading) {
  const marker = `## ${heading}\n`;
  const start = markdown.indexOf(marker);
  assert.notEqual(start, -1, `missing section: ${heading}`);
  const bodyStart = start + marker.length;
  const next = markdown.indexOf("\n## ", bodyStart);
  return markdown.slice(bodyStart, next === -1 ? markdown.length : next);
}

function h2Headings(markdown) {
  return [...markdown.matchAll(/^## (.+)$/gm)].map((match) => match[1]);
}

function assertContainedPath(filename, target) {
  assert.ok(!path.isAbsolute(target) && !path.win32.isAbsolute(target), `absolute local target: ${target}`);
  const resolved = path.resolve(path.dirname(filename), target);
  const relative = path.relative(root, resolved);
  assert.ok(relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative)), `local target escapes repository: ${target}`);
  return resolved;
}

async function assertRegularNonSymlinkFile(filename) {
  const parts = path.relative(root, filename).split(path.sep).filter(Boolean);
  let current = root;
  for (const part of parts) {
    current = path.join(current, part);
    const stat = await lstat(current);
    assert.ok(!stat.isSymbolicLink(), `symlinked local target: ${filename}`);
  }
  const stat = await lstat(filename);
  assert.ok(stat.isFile(), `local target is not a regular file: ${filename}`);
}

async function assertRootLinks(markdown) {
  const readmePath = path.join(root, "README.md");
  for (const { target } of extractMarkdownLinks(markdown)) {
    if (/^https?:/i.test(target)) continue;
    assert.ok(!/^[a-z][a-z\d+.-]*:/i.test(target), `unsupported local link scheme: ${target}`);
    const hash = target.indexOf("#");
    const rawFile = hash === -1 ? target : target.slice(0, hash);
    const rawAnchor = hash === -1 ? "" : target.slice(hash + 1);
    const filename = decodeURIComponent(rawFile).split("?", 1)[0];
    const anchor = decodeURIComponent(rawAnchor);
    const targetPath = filename ? assertContainedPath(readmePath, filename) : readmePath;
    await assertRegularNonSymlinkFile(targetPath);
    if (anchor) {
      const targetMarkdown = await readFile(targetPath, "utf8");
      assert.ok(collectHeadingAnchors(targetMarkdown).has(anchor), `missing root local anchor: ${target}`);
    }
  }
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

function canonicalCaseTargets(manifest, product) {
  return new Set(manifest.cases
    .filter((entry) => entry.product === product)
    .map((entry) => `${entry.document}#${entry.anchor}`));
}

function representativeCaseTargets(manifest) {
  return representativeCaseIds.map((id) => {
    const entry = manifest.cases.find((candidate) => candidate.id === id);
    assert.ok(entry, `representative case exists in manifest: ${id}`);
    return `${entry.document}#${entry.anchor}`;
  });
}

function assertRootUseCaseNavigation(markdown, manifest) {
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
  for (const phrase of ["규칙", "루프", "시스템", "UX", "역기획", "면접", "전체 프로젝트"]) {
    assert.ok(markdown.includes(phrase), `root learner balance: ${phrase}`);
  }
  const representativeTargets = representativeCaseTargets(manifest);
  const caseLinks = extractMarkdownLinks(markdown)
    .map(({ target }) => target)
    .filter((target) => products.some((product) => canonicalCaseTargets(manifest, product).has(target)));
  assert.deepEqual(caseLinks, representativeTargets, "root representative case links preserve canonical order and product binding");
  for (const product of products) {
    const targets = canonicalCaseTargets(manifest, product);
    const links = caseLinks.filter((target) => targets.has(target));
    assert.ok(links.length >= 6, `${product}: six canonical representative case links`);
    assert.equal(new Set(links).size, links.length, `${product}: representative case links are unique`);
  }
  for (const { target } of extractMarkdownLinks(markdown)) {
    if (!target.includes("/use-cases/")) continue;
    const owner = products.find((product) => target.startsWith(`guides/${product}/use-cases/`));
    if (!owner || !target.includes("#")) continue;
    assert.ok(canonicalCaseTargets(manifest, owner).has(target), `root case link is canonical and product-bound: ${target}`);
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

function localMarkdownTargets(markdownPath, markdown) {
  return extractMarkdownLinks(markdown)
    .map(({ target }) => target.split("#", 1)[0].split("?", 1)[0])
    .filter((target) => target && !/^[a-z][a-z\d+.-]*:/i.test(target))
    .map((target) => path.resolve(path.dirname(markdownPath), target));
}

async function reachableMarkdownPaths(entryPath) {
  const seen = new Set();
  const queue = [entryPath];
  while (queue.length > 0) {
    const current = queue.shift();
    if (seen.has(current)) continue;
    seen.add(current);
    const markdown = await readFile(current, "utf8");
    for (const { target } of extractMarkdownLinks(markdown)) {
      if (/^[a-z][a-z\d+.-]*:/i.test(target)) continue;
      const [rawTarget, rawAnchor = ""] = target.split("#", 2);
      const resolved = rawTarget ? path.resolve(path.dirname(current), rawTarget.split("?", 1)[0]) : current;
      if (!resolved.startsWith(guideRoot + path.sep)) continue;
      await assertRegularNonSymlinkFile(resolved);
      if (rawAnchor) {
        const targetMarkdown = await readFile(resolved, "utf8");
        assert.ok(collectHeadingAnchors(targetMarkdown).has(rawAnchor), `guide link anchor resolves: ${target}`);
      }
      const targetPath = resolved;
      if (path.extname(targetPath) === ".md" && targetPath.startsWith(guideRoot + path.sep)) queue.push(targetPath);
    }
    for (const target of localMarkdownTargets(current, markdown)) {
      if (path.extname(target) === ".md" && target.startsWith(guideRoot + path.sep)) queue.push(target);
    }
  }
  return seen;
}

test("root README is a safe beginner landing page for both App and CLI", async () => {
  const [readme, manifestSource, globalGuide] = await Promise.all([
    readFile(path.join(root, "README.md"), "utf8"),
    readFile(path.join(guideRoot, "use-cases/use-case-manifest.json"), "utf8"),
    readFile(path.join(guideRoot, "README.md"), "utf8"),
  ]);
  assertRootContentContract(readme);
  assertRootUseCaseNavigation(readme, JSON.parse(manifestSource));
  assertGlobalUseCaseNavigation(globalGuide);
  await assertRootLinks(readme);
});

test("root README contract rejects unsafe mutations in memory", async () => {
  const [readme, manifestSource] = await Promise.all([
    readFile(path.join(root, "README.md"), "utf8"),
    readFile(path.join(guideRoot, "use-cases/use-case-manifest.json"), "utf8"),
  ]);
  const manifest = JSON.parse(manifestSource);
  const mutations = [
    ["both CLI prompts removed", (value) => value
      .replace(/\$game-design-studio:orchestrate-game-design-project/g, "")
      .replace(/\$game-design-career:orchestrate-game-design-career/g, "")],
    ["Studio CLI namespace swapped", (value) => value.replace("$game-design-studio:orchestrate-game-design-project", "$game-design-career:orchestrate-game-design-career")],
    ["safety section deleted", (value) => value.replace(/## 제한·개인정보·권리·사람 승인[\s\S]*?(?=\n## 문제 해결)/, "")],
    ["shared PNG no longer links to SVG", (value) => value.replace("guides/assets/shared/plugin-selection-flow.svg", "guides/README.md")],
    ["marketplace refresh is collapsed into plugin update", (value) => value.replace("refresh할 뿐 설치된 플러그인을 교체하지 않습니다", "설치된 플러그인을 자동 업데이트합니다")],
    ["two products are installed in one mandatory block", (value) => value.replace("codex plugin add game-design-studio@game-design-suite", "codex plugin add game-design-studio@game-design-suite\ncodex plugin add game-design-career@game-design-suite")],
    ["three unpaired shared PNG embeds are added", (value) => value + "\n![A](guides/assets/shared/a.png)\n![B](guides/assets/shared/b.png)\n![C](guides/assets/shared/c.png)\n"],
    ["paired shared PNG gains a bare duplicate", (value) => value + "\n![bare duplicate](guides/assets/shared/plugin-selection-flow.png)\n"],
    ["use-case heading is removed", (value) => value.replace(/## 활용 방법 선택[\s\S]*?(?=\n## 어떤 플러그인을 설치할까)/, "")],
  ];
  for (const [label, mutate] of mutations) {
    assert.throws(() => assertRootContentContract(mutate(readme)), undefined, label);
  }
  const brokenLink = readme.replace("guides/game-design-studio/README.md", "guides/missing.md");
  await assert.rejects(() => assertRootLinks(brokenLink));

  const [studioTarget, , careerTarget] = representativeCaseTargets(manifest);
  const unknownCase = readme.replace(studioTarget, `${studioTarget.split("#", 1)[0]}#unknown-case`);
  const brokenCase = readme.replace(studioTarget, "guides/game-design-studio/use-cases/missing.md#unknown-case");
  const traversalCase = readme.replace(studioTarget, "guides/../README.md#unknown-case");
  const crossProductCase = readme.replace(studioTarget, careerTarget);
  const swappedCases = readme.replace(studioTarget, "__CASE_SWAP__")
    .replace(careerTarget, studioTarget)
    .replace("__CASE_SWAP__", careerTarget);
  for (const [label, mutation] of [
    ["unknown case anchor", unknownCase],
    ["broken case target", brokenCase],
    ["path traversal case link", traversalCase],
    ["cross-product case link", crossProductCase],
    ["representative case links swapped", swappedCases],
  ]) {
    assert.throws(() => assertRootUseCaseNavigation(mutation, manifest), label);
  }
  await assert.rejects(() => assertRootLinks(brokenCase), "broken case target must not resolve");
  await assert.rejects(() => assertRootLinks(traversalCase), "traversal target must not resolve");
});

test("global and product indexes reach 30 skills, 30 templates, and 12 recipes", async () => {
  const reachable = await reachableMarkdownPaths(path.join(guideRoot, "README.md"));
  assert.equal(reachable.size, 79, "guide link graph reaches exactly 79 Markdown documents");
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
  assert.match(readingTable, /처음 시작하기/);
  assert.doesNotMatch(readingTable, /빠른 시작 → 전체 워크플로/);
  for (const product of products) {
    const local = await readFile(path.join(guideRoot, product, "README.md"), "utf8");
    const productStart = section(local, "처음 시작하기");
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
