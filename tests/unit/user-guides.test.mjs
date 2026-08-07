import assert from "node:assert/strict";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  collectHeadingAnchors,
  collectMarkdownHeadings,
  collectProductInventory,
  extractMarkdownLinks,
  validateUserGuides,
} from "../../tooling/lib/user-guides.mjs";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const productSkillIds = Array.from({ length: 14 }, (_, index) => `skill-${index + 1}`);
const documentedSkillIds = [...productSkillIds, "svg-infographic"];

async function withGuideFixture({ omitCareerSkill = false }, check) {
  const root = await mkdtemp(path.join(tmpdir(), "user-guides-"));
  try {
    const vendorRoot = path.join(root, "shared/vendor/skillstead/svg-infographic/0.8.3");
    await mkdir(vendorRoot, { recursive: true });
    await writeFile(path.join(vendorRoot, "SKILL.md"), "# Skillstead\n");
    await writeFile(path.join(root, "README.md"), "# Root\n\nOPENAI_API_KEY=\n");
    for (const productId of ["game-design-career", "game-design-studio"]) {
      const productRoot = path.join(root, "products", productId, "plugin");
      await mkdir(path.join(productRoot, "assets/templates"), { recursive: true });
      for (const skillId of productSkillIds) {
        const skillRoot = path.join(productRoot, "skills", skillId);
        await mkdir(skillRoot, { recursive: true });
        await writeFile(path.join(skillRoot, "SKILL.md"), "# Skill\n");
      }
      const guidesRoot = path.join(root, "guides", productId, "skills");
      await mkdir(guidesRoot, { recursive: true });
      await writeFile(path.join(guidesRoot, "README.md"), "prompt-only select required all gpt-image-2 low\n");
      for (const skillId of documentedSkillIds) {
        if (omitCareerSkill && productId === "game-design-career" && skillId === "svg-infographic") continue;
        await writeFile(path.join(guidesRoot, `${skillId}.md`), `# ${skillId}\n`);
      }
    }
    await check(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

async function markdownFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) return markdownFiles(filename);
    return entry.isFile() && entry.name.endsWith(".md") ? [filename] : [];
  }));
  return nested.flat();
}

function validAudience(id = "AUD-01") {
  return {
    id,
    slug: "audience",
    document: "guides/use-cases/audience-paths.md",
    anchor: id.toLowerCase(),
    level: "foundation",
    recommended_views: [],
    outputs: [],
    diagram: { svg: "guides/assets/audience.svg", png: "guides/assets/audience.png", alt: "Audience path" },
  };
}

function validCase(overrides = {}) {
  return {
    id: "ST-C01",
    product: "game-design-studio",
    view: "competency",
    audiences: ["AUD-01"],
    level: ["foundation"],
    skills: ["skill-1"],
    templates: [],
    outputs: [],
    document: "guides/use-cases/case.md",
    anchor: "st-c01",
    diagram: { svg: "guides/assets/case.svg", png: "guides/assets/case.png", alt: "Case path" },
    ...overrides,
  };
}

async function writeUseCaseValidationFixture(root, manifest) {
  await mkdir(path.join(root, "guides", "use-cases"), { recursive: true });
  await mkdir(path.join(root, "guides", "assets"), { recursive: true });
  await Promise.all([
    writeFile(path.join(root, "guides", "use-cases", "audience-paths.md"), "# Audience\n"),
    writeFile(path.join(root, "guides", "use-cases", "case.md"), "# Case\n"),
    writeFile(path.join(root, "guides", "assets", "audience.svg"), "<svg/>"),
    writeFile(path.join(root, "guides", "assets", "audience.png"), "png"),
    writeFile(path.join(root, "guides", "assets", "case.svg"), "<svg/>"),
    writeFile(path.join(root, "guides", "assets", "case.png"), "png"),
    writeFile(path.join(root, "guides", "assets", "diagram-manifest.json"), JSON.stringify({ diagrams: [] })),
    writeFile(path.join(root, "guides", "use-cases", "use-case-manifest.json"), JSON.stringify(manifest)),
  ]);
}

test("product inventory includes 14 product skills plus vendored Skillstead", async () => {
  const studio = await collectProductInventory(repoRoot, "game-design-studio");
  const career = await collectProductInventory(repoRoot, "game-design-career");
  assert.equal(studio.skillIds.length, 15);
  assert.equal(career.skillIds.length, 15);
  assert.equal(studio.templateIds.length, 15);
  assert.equal(career.templateIds.length, 15);
  assert.ok(studio.skillIds.includes("svg-infographic"));
  assert.ok(career.skillIds.includes("svg-infographic"));
});

test("Markdown helpers expose only visible links and headings", () => {
  const markdown = [
    "<!-- [comment](missing.md#hidden) -->",
    "```md",
    "[fenced](missing.md#hidden)",
    "## fenced heading",
    "```",
    "~~~yaml",
    "[tilde-fenced](missing.md#hidden)",
    "~~~",
    "    [indented](missing.md#hidden)",
    "\t## indented heading",
    "`matched [inline](missing.md)` [visible](quick-start.md#첫-요청)",
    "``unmatched [broken-visible](broken.md#broken)",
    "![image](image.png) [!visible](bang.md#bang)",
    "[**강조**](emphasis.md#strong) \\[escaped](missing.md#escaped)",
    "[![diagram](image.png)](diagram.svg)",
    "```info ` not-a-fence",
    "[invalid-backtick-info](info.md#info)",
    "## 첫 요청",
  ].join("\n");
  assert.deepEqual(extractMarkdownLinks(markdown), [
    { label: "visible", target: "quick-start.md#첫-요청", fragment: "첫-요청", line: 11 },
    { label: "broken-visible", target: "broken.md#broken", fragment: "broken", line: 12 },
    { label: "!visible", target: "bang.md#bang", fragment: "bang", line: 13 },
    { label: "**강조**", target: "emphasis.md#strong", fragment: "strong", line: 14 },
    { label: "![diagram](image.png)", target: "diagram.svg", fragment: "", line: 15 },
    { label: "invalid-backtick-info", target: "info.md#info", fragment: "info", line: 17 },
  ]);
  assert.deepEqual([...collectHeadingAnchors(markdown)], ["첫-요청"]);
});

test("Markdown helpers preserve token precedence, balanced destinations, and rendered labels", () => {
  const markdown = [
    "`<!--` [visible](visible.md#visible)",
    "<!-- `comment backtick` --> [after-comment](after.md#after)",
    "<!--",
    "    ignored indentation before closer --> [after-indented-comment](indented.md#after)",
    "`multiline inline code",
    "[hidden](hidden.md#hidden)",
    "` [after-inline](after-inline.md#after)",
    "[한국어](guide(초급).md#함수())",
    "[escaped](guide\\(초급\\).md#함수\\(\\))",
    "[`한국어`](inline-label.md#inline)",
    "[angle title](<angle(초급).md#함수()> \"문서 제목\")",
    "[bare title](bare.md#bare '문서 제목')",
    "[reference][unsafe-local]",
  ].join("\n");
  assert.deepEqual(extractMarkdownLinks(markdown), [
    { label: "visible", target: "visible.md#visible", fragment: "visible", line: 1 },
    { label: "after-comment", target: "after.md#after", fragment: "after", line: 2 },
    { label: "after-indented-comment", target: "indented.md#after", fragment: "after", line: 4 },
    { label: "after-inline", target: "after-inline.md#after", fragment: "after", line: 7 },
    { label: "한국어", target: "guide(초급).md#함수()", fragment: "함수()", line: 8 },
    { label: "escaped", target: "guide(초급).md#함수()", fragment: "함수()", line: 9 },
    { label: "한국어", target: "inline-label.md#inline", fragment: "inline", line: 10 },
    { label: "angle title", target: "angle(초급).md#함수()", fragment: "함수()", line: 11 },
    { label: "bare title", target: "bare.md#bare", fragment: "bare", line: 12 },
  ]);
});

test("Markdown helpers stop inline code at paragraph, fence, and HTML block boundaries", () => {
  const markdown = [
    "`paragraph opener",
    "",
    "[after-blank](after-blank.md#visible)",
    "`",
    "",
    "`fence opener",
    "  ````md",
    "[hidden-fence](missing.md#hidden)",
    "~~~ not a closer",
    "  `````",
    "[after-fence](after-fence.md#visible)",
    "`",
    "",
    "same paragraph `multiline code",
    "[hidden-inline](missing.md#hidden)",
    "code` [after-inline](after-inline.md#visible)",
    "",
    "<!--",
    "```md",
    "[hidden-comment](missing.md#hidden)",
    "```",
    "    --> [after-comment](after-comment.md#visible)",
  ].join("\n");

  assert.deepEqual(extractMarkdownLinks(markdown), [
    { label: "after-blank", target: "after-blank.md#visible", fragment: "visible", line: 3 },
    { label: "after-fence", target: "after-fence.md#visible", fragment: "visible", line: 11 },
    { label: "after-inline", target: "after-inline.md#visible", fragment: "visible", line: 16 },
    { label: "after-comment", target: "after-comment.md#visible", fragment: "visible", line: 22 },
  ]);
});

test("Markdown helpers honor escaped comments and render heading inline content", () => {
  const markdown = [
    "\\<!--[escaped-comment](escaped.md#visible)",
    "\\\\<!--[even-comment](missing.md#hidden) --> [after-even](after-even.md#visible)",
    "## 함수 `한국어` 안내",
    "## [링크 **강조**](target.md)와 ` 코드   값 `",
  ].join("\r\n");

  assert.deepEqual(extractMarkdownLinks(markdown), [
    { label: "escaped-comment", target: "escaped.md#visible", fragment: "visible", line: 1 },
    { label: "after-even", target: "after-even.md#visible", fragment: "visible", line: 2 },
    { label: "링크 **강조**", target: "target.md", fragment: "", line: 4 },
  ]);
  assert.deepEqual(collectMarkdownHeadings(markdown), [
    { label: "함수 한국어 안내", anchor: "함수-한국어-안내", level: 2, line: 3 },
    { label: "링크 강조와 코드   값", anchor: "링크-강조와-코드-값", level: 2, line: 4 },
  ]);
});

test("Markdown block recovery keeps hidden blocks closed and unmatched runs literal", () => {
  const cases = [
    ["unclosed fence", "```md\n[hidden](missing.md)\n[still-hidden](missing.md)", []],
    ["unclosed comment", "<!--\n[hidden](missing.md)\n[still-hidden](missing.md)", []],
    ["multiple paragraphs", "`literal\n\n[first](first.md)\n\n``literal\n\n[second](second.md)", ["first.md", "second.md"]],
    ["CRLF paragraph", "`literal\r\n\r\n[visible](visible.md)\r\n`", ["visible.md"]],
    ["matching double run", "``code ` [hidden](missing.md) code`` [visible](visible.md)", ["visible.md"]],
    ["fence-like inline text", "text ``` not a fence [visible](visible.md)", ["visible.md"]],
  ];

  for (const [label, markdown, expected] of cases) {
    assert.deepEqual(extractMarkdownLinks(markdown).map(({ target }) => target), expected, label);
  }
});

test("guide graph respects block boundaries, escaped comments, and rendered heading anchors", async () => {
  await withGuideFixture({}, async (root) => {
    const guideRoot = path.join(root, "guides", "game-design-studio", "skills");
    const guide = path.join(guideRoot, "README.md");
    const target = path.join(guideRoot, "mixed-heading.md");
    const prefix = "prompt-only select required all gpt-image-2 low\n\n";
    await writeFile(target, "## 함수 `한국어` 안내\n");
    await writeFile(guide, `${prefix}[mixed](mixed-heading.md#함수-한국어-안내)\n`);
    assert.equal((await validateUserGuides({ repoRoot: root, requireComplete: false })).ok, true, "rendered heading anchor");

    const wrongVisibleSources = [
      ["paragraph closer", "`open\n\n[broken](missing-paragraph.md)\n`"],
      ["fence recovery", "`open\n```md\n[hidden](missing-hidden.md)\n```\n[broken](missing-after-fence.md)\n`"],
      ["escaped comment", "\\<!--[broken](missing-escaped-comment.md)"],
    ];
    for (const [label, source] of wrongVisibleSources) {
      await writeFile(guide, `${prefix}${source}\n`);
      const result = await validateUserGuides({ repoRoot: root, requireComplete: false });
      assert.equal(result.ok, false, label);
      assert.ok(result.errors.some((error) => error.includes("missing or unsafe local link target")), `${label}: ${result.errors.join("\n")}`);
    }
  });
});

test("guide validation ignores hidden unsafe Markdown but rejects a visible edge", async () => {
  await withGuideFixture({}, async (root) => {
    const guide = path.join(root, "guides", "game-design-studio", "skills", "README.md");
    await writeFile(guide, [
      "prompt-only select required all gpt-image-2 low",
      "<!-- [comment](missing.md) -->",
      "```md",
      "[fenced](missing.md)",
      "```",
      "    [indented](missing.md)",
    ].join("\n"));
    assert.equal((await validateUserGuides({ repoRoot: root, requireComplete: false })).ok, true);

    await writeFile(guide, "prompt-only select required all gpt-image-2 low\n\n[visible](missing.md)\n");
    const result = await validateUserGuides({ repoRoot: root, requireComplete: false });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((error) => error.includes("missing or unsafe local link target missing.md")));
  });
});

test("guide validation decodes anchors exactly without case or punctuation normalization", async () => {
  await withGuideFixture({}, async (root) => {
    const guideRoot = path.join(root, "guides", "game-design-studio", "skills");
    const guide = path.join(guideRoot, "README.md");
    await writeFile(path.join(guideRoot, "guide(초급).md"), "## 첫 요청\n\n## 함수\n\n## case\n");
    const prefix = "prompt-only select required all gpt-image-2 low\n\n";
    await writeFile(guide, `${prefix}[valid](guide\\(초급\\).md#%EC%B2%AB-%EC%9A%94%EC%B2%AD)\n`);
    assert.equal((await validateUserGuides({ repoRoot: root, requireComplete: false })).ok, true);

    for (const [label, target] of [
      ["wrong case", "guide\\(초급\\).md#Case"],
      ["wrong punctuation", "guide\\(초급\\).md#함수()"],
      ["invalid encoding", "guide\\(초급\\).md#%E0%A4%A"],
    ]) {
      await writeFile(guide, `${prefix}[${label}](${target})\n`);
      const result = await validateUserGuides({ repoRoot: root, requireComplete: false });
      assert.equal(result.ok, false, label);
      assert.ok(result.errors.some((error) => error.includes("anchor") || error.includes("invalid encoded")), label);
    }
  });
});

test("production guides expose 866 labeled visible Markdown links", async () => {
  const files = await markdownFiles(path.join(repoRoot, "guides"));
  const links = (await Promise.all(files.map(async (filename) => extractMarkdownLinks(await readFile(filename, "utf8"))))).flat();
  assert.equal(files.length, 79);
  assert.equal(links.length, 866);
  assert.equal(links.filter(({ label }) => label === "").length, 0);
  assert.equal(links.filter(({ target }) => !/^(?:https?|mailto):/iu.test(target)).length, 854);
});

test("complete guide validation excludes skills indexes and counts all 30 installed guides", async () => {
  await withGuideFixture({}, async (root) => {
    const result = await validateUserGuides({ repoRoot: root, requireComplete: true });
    assert.equal(result.counts.skillGuides, 30);
    assert.equal(result.errors.some((error) => error.includes("skill guide inventory mismatch")), false);
  });
});

test("complete guide validation rejects a product whose guide IDs differ from inventory", async () => {
  await withGuideFixture({ omitCareerSkill: true }, async (root) => {
    const result = await validateUserGuides({ repoRoot: root, requireComplete: true });
    assert.ok(result.errors.some((error) => error.includes("game-design-career skill guide inventory mismatch")));
  });
});

test("guide secret scanner includes root README while allowing empty-key examples", async () => {
  await withGuideFixture({}, async (root) => {
    const readme = path.join(root, "README.md");
    assert.equal((await validateUserGuides({ repoRoot: root, requireComplete: false })).ok, true);

    await writeFile(readme, "# Root\n\nExample: sk-proj-01234567890123456789\n");
    let result = await validateUserGuides({ repoRoot: root, requireComplete: false });
    assert.ok(result.errors.some((error) => error.includes("README.md: possible OpenAI secret key")));

    await writeFile(readme, "# Root\n\nOPENAI_API_KEY=not-a-placeholder\n");
    result = await validateUserGuides({ repoRoot: root, requireComplete: false });
    assert.ok(result.errors.some((error) => error.includes("README.md: nonempty OPENAI_API_KEY assignment")));
  });
});

test("aggregate validation prefixes duplicate, shape, and catalog use-case failures without trusting their diagram count", async () => {
  const invalidManifests = [
    ["duplicate", { version: 1, audience_paths: [validAudience(), validAudience()], cases: [], skill_cases: [] }, /duplicate id: AUD-01/u],
    ["shape", { version: 1, audience_paths: [], cases: [validCase({ skills: undefined })], skill_cases: [] }, /cases\[0\]\.skills must be an array/u],
    ["catalog", { version: 1, audience_paths: [], cases: [validCase({ skills: ["unknown-skill"] })], skill_cases: [] }, /unknown game-design-studio skill: unknown-skill/u],
  ];

  for (const [label, manifest, expected] of invalidManifests) {
    await withGuideFixture({}, async (root) => {
      await writeUseCaseValidationFixture(root, manifest);
      const result = await validateUserGuides({ repoRoot: root, requireComplete: true });

      assert.equal(result.ok, false, label);
      assert.ok(result.errors.some((error) => error.startsWith("use-case manifest: ") && expected.test(error)), label);
      assert.equal(result.errors.some((error) => error.includes("diagram manifest must contain exactly")), false, `${label} does not trust malformed dynamic count`);
    });
  }
});

test("Markdown anchors avoid suffix collisions in either heading order", () => {
  assert.deepEqual(
    [...collectHeadingAnchors("# 항목\n# 항목\n# 항목-1\n")],
    ["항목", "항목-1", "항목-1-1"],
  );
  assert.deepEqual(
    [...collectHeadingAnchors("# 항목-1\n# 항목\n# 항목\n")],
    ["항목-1", "항목", "항목-2"],
  );
});
