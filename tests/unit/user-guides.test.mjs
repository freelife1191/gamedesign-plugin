import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  collectHeadingAnchors,
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
    "`unmatched [broken-visible](broken.md#broken)",
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
