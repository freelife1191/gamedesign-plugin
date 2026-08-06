import assert from "node:assert/strict";
import { lstat, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { loadUseCaseManifest } from "../../tooling/lib/use-case-guides.mjs";
import { collectHeadingAnchors } from "../../tooling/lib/user-guides.mjs";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

test("use-case manifest exposes the versioned three-lane contract", async () => {
  const manifest = await loadUseCaseManifest({ repoRoot });
  assert.equal(manifest.version, 1);
  assert.ok(Array.isArray(manifest.audience_paths));
  assert.ok(Array.isArray(manifest.cases));
  assert.ok(Array.isArray(manifest.skill_cases));
});

test("common use-case guides provide the audience anchors, result taxonomy, and FAQ contract", async () => {
  const manifest = await loadUseCaseManifest({ repoRoot });
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
  for (const heading of ["최소 결과", "선택 결과", "확장 결과"]) {
    assert.ok(outputCatalog.includes("## " + heading));
  }
  for (const entry of manifest.audience_paths) {
    assert.ok(collectHeadingAnchors(audiencePaths).has(entry.anchor), entry.id + " anchor");
  }
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
