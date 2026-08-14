import assert from "node:assert/strict";
import { lstat, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import test from "node:test";

import { buildProduct } from "../../tooling/lib/build-product.mjs";

const expectedReferenceFiles = [
  "references/shared/reference-intelligence/catalog/overlays/business-model.json",
  "references/shared/reference-intelligence/catalog/overlays/genre.json",
  "references/shared/reference-intelligence/catalog/overlays/platform.json",
  "references/shared/reference-intelligence/catalog/overlays/play-mode.json",
  "references/shared/reference-intelligence/catalog/source-register.json",
  "references/shared/reference-intelligence/catalog/system-atlas.json",
  "references/shared/reference-intelligence/references/evidence-policy.md",
  "references/shared/reference-intelligence/references/reference-analysis-flow.md",
  "references/shared/reference-intelligence/schema/game-design-glossary.schema.json",
  "references/shared/reference-intelligence/schema/glossary-receipt.schema.json",
  "references/shared/reference-intelligence/schema/reference-analysis.schema.json",
  "references/shared/reference-intelligence/templates/analysis-priority.md",
  "references/shared/reference-intelligence/templates/brief.md",
  "references/shared/reference-intelligence/templates/comparison-matrix.md",
  "references/shared/reference-intelligence/templates/evidence-register.yml",
  "references/shared/reference-intelligence/templates/reference-set.yml",
  "references/shared/reference-intelligence/templates/system-inventory.json",
  "references/shared/reference-intelligence/templates/transfer-decisions.md",
  "references/shared/reference-intelligence/templates/verification-queue.md",
  "skills/analyze-game-design-references/SKILL.md",
  "skills/maintain-game-design-glossary/SKILL.md",
].sort();

const referenceSourceFiles = [
  ["shared/reference-intelligence/skills/analyze-game-design-references/SKILL.md", "analysis skill\n"],
  ["shared/reference-intelligence/skills/maintain-game-design-glossary/SKILL.md", "glossary skill\n"],
  ["shared/reference-intelligence/schema/game-design-glossary.schema.json", "{}\n"],
  ["shared/reference-intelligence/schema/glossary-receipt.schema.json", "{}\n"],
  ["shared/reference-intelligence/schema/reference-analysis.schema.json", "{}\n"],
  ["shared/reference-intelligence/catalog/overlays/business-model.json", "{}\n"],
  ["shared/reference-intelligence/catalog/overlays/genre.json", "{}\n"],
  ["shared/reference-intelligence/catalog/overlays/platform.json", "{}\n"],
  ["shared/reference-intelligence/catalog/overlays/play-mode.json", "{}\n"],
  ["shared/reference-intelligence/catalog/source-register.json", "{}\n"],
  ["shared/reference-intelligence/catalog/system-atlas.json", "{}\n"],
  ["shared/reference-intelligence/references/evidence-policy.md", "policy\n"],
  ["shared/reference-intelligence/references/reference-analysis-flow.md", "flow\n"],
  ["shared/reference-intelligence/templates/analysis-priority.md", "priority\n"],
  ["shared/reference-intelligence/templates/brief.md", "brief\n"],
  ["shared/reference-intelligence/templates/comparison-matrix.md", "matrix\n"],
  ["shared/reference-intelligence/templates/evidence-register.yml", "evidence\n"],
  ["shared/reference-intelligence/templates/reference-set.yml", "references\n"],
  ["shared/reference-intelligence/templates/system-inventory.json", "{}\n"],
  ["shared/reference-intelligence/templates/transfer-decisions.md", "decisions\n"],
  ["shared/reference-intelligence/templates/verification-queue.md", "queue\n"],
];

async function writeText(root, relativePath, contents) {
  const target = path.join(root, relativePath);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, contents);
}

async function writeJson(root, relativePath, value) {
  await writeText(root, relativePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function buildFixture(t) {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), "reference-intelligence-package-"));
  t.after(() => rm(temporaryRoot, { recursive: true, force: true }));
  const repoRoot = path.join(temporaryRoot, "repo");
  const stagingRoot = path.join(temporaryRoot, "staging");
  const outputDir = path.join(stagingRoot, "reference-intelligence-fixture");
  const sharedModules = ["knowledge", "templates", "responsible-design", "export", "vendor", "reference-intelligence"];
  await writeJson(repoRoot, "products/reference-intelligence-fixture/product.json", {
    schemaVersion: 1,
    name: "reference-intelligence-fixture",
    displayName: "Reference Intelligence Fixture",
    description: "Fixture package.",
    sharedModules,
    sharedRuntime: true,
    sourceRoots: ["plugin"],
    sourceDocumentCategories: [],
  });
  await writeJson(repoRoot, "products/reference-intelligence-fixture/plugin/.codex-plugin/plugin.json", { name: "reference-intelligence-fixture" });
  await writeJson(repoRoot, "shared/knowledge/reference-index.json", { schemaVersion: 1, documents: [] });
  await writeText(repoRoot, "shared/templates/template.md", "template\n");
  await writeText(repoRoot, "shared/responsible-design/safety.md", "safety\n");
  await writeText(repoRoot, "shared/export/export.md", "export\n");
  await writeText(repoRoot, "shared/vendor/skillstead/svg-infographic/0.9.0/SKILL.md", "vendor\n");
  await writeText(repoRoot, "shared/hooks/runtime.mjs", "export default {};\n");
  await writeText(repoRoot, "shared/scripts/check.mjs", "export default true;\n");
  await Promise.all(referenceSourceFiles.map(([relativePath, contents]) => writeText(repoRoot, relativePath, contents)));
  return {
    repoRoot,
    outputDir,
    async build() {
      return buildProduct({ repoRoot, productName: "reference-intelligence-fixture", stagingRoot });
    },
  };
}

async function assertNoOutputPublication(fixture, operation, expected) {
  await assert.rejects(operation, expected);
  await assert.rejects(lstat(fixture.outputDir), { code: "ENOENT" });
}

test("reference-intelligence packages the exact skills, schemas, catalogs, references, and templates", async (t) => {
  const fixture = await buildFixture(t);
  const result = await fixture.build();
  assert.deepEqual(
    result.files.filter((file) => file.startsWith("references/shared/reference-intelligence/") || [
      "skills/analyze-game-design-references/SKILL.md",
      "skills/maintain-game-design-glossary/SKILL.md",
    ].includes(file)).sort(),
    expectedReferenceFiles,
  );
  assert.deepEqual(
    await readFile(path.join(result.outputDir, "skills/analyze-game-design-references/SKILL.md")),
    await readFile(path.join(fixture.repoRoot, "shared/reference-intelligence/skills/analyze-game-design-references/SKILL.md")),
  );
});

test("reference-intelligence rejects unsafe source changes before publishing output", async (t) => {
  const cases = [
    ["unexpected file", async (fixture) => writeText(fixture.repoRoot, "shared/reference-intelligence/references/unexpected.md", "blocked\n"), /unexpected shared reference-intelligence package file/iu],
    ["environment file", async (fixture) => writeText(fixture.repoRoot, "shared/reference-intelligence/schema/.env", "SECRET=blocked\n"), /real \.env|secret environment/iu],
    ["credential file", async (fixture) => writeText(fixture.repoRoot, "shared/reference-intelligence/catalog/credentials.json", "{\"token\":\"blocked\"}\n"), /credential|unexpected shared reference-intelligence package file/iu],
    ["symlink", async (fixture) => symlink("evidence-policy.md", path.join(fixture.repoRoot, "shared/reference-intelligence/references/policy-link.md")), /symlink/iu],
    ["special file", async (fixture) => execFileSync("/usr/bin/mkfifo", [path.join(fixture.repoRoot, "shared/reference-intelligence/templates/blocked.fifo")]), /unsupported filesystem entry/iu],
    ["product overlay collision", async (fixture) => writeText(fixture.repoRoot, "products/reference-intelligence-fixture/plugin/skills/analyze-game-design-references/SKILL.md", "overlay\n"), /reference-intelligence destination collision/iu],
  ];
  for (const [label, mutate, expected] of cases) {
    await t.test(label, async (t) => {
      const fixture = await buildFixture(t);
      await mutate(fixture);
      await assertNoOutputPublication(fixture, () => fixture.build(), expected);
    });
  }
});

test("reference-intelligence rejects every product overlay even when bytes match", async (t) => {
  for (const [label, sourceContents, overlayContents] of [
    ["exact bytes", "analysis skill\n", "analysis skill\n"],
    ["zero-byte same hash", "", ""],
    ["different bytes", "analysis skill\n", "different overlay\n"],
  ]) {
    await t.test(label, async (t) => {
      const fixture = await buildFixture(t);
      await writeText(fixture.repoRoot, "shared/reference-intelligence/skills/analyze-game-design-references/SKILL.md", sourceContents);
      await writeText(fixture.repoRoot, "products/reference-intelligence-fixture/plugin/skills/analyze-game-design-references/SKILL.md", overlayContents);
      await assertNoOutputPublication(fixture, () => fixture.build(), /reference-intelligence destination collision/iu);
    });
  }
});
