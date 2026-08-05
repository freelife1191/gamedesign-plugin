import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import { buildProduct } from "../../tooling/lib/build-product.mjs";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

test("clean Studio and Career builds import and execute the packaged quality runtime", async (t) => {
  for (const [productName, namespace, profileId, request] of [
    ["game-design-studio", "studio", "game-design-brief", { artifactId: "brief", goal: "game design brief", audience: ["production"], artifactType: "design-document", requestedFormat: "md" }],
    ["game-design-career", "career", "portfolio-case-study", { artifactId: "case-study", goal: "portfolio case study", audience: ["recruiter"], artifactType: "career-document", requestedFormat: "md" }],
  ]) {
    await t.test(productName, async (t) => {
      const stagingRoot = await mkdtemp(path.join(tmpdir(), "quality-runtime-build-"));
      t.after(() => rm(stagingRoot, { recursive: true, force: true }));
      const build = await buildProduct({ repoRoot, productName, stagingRoot, sourceDateEpoch: 0 });
      const runtime = await import(`${pathToFileURL(path.join(build.outputDir, "scripts/resolve-quality-profile.mjs")).href}?test=${Date.now()}`);
      const validator = await import(`${pathToFileURL(path.join(build.outputDir, "scripts/validate-reference-preset.mjs")).href}?test=${Date.now()}`);
      const preset = JSON.parse(await readFile(path.join(build.outputDir, "references/shared/document-quality/presets/function-first.json"), "utf8"));
      assert.deepEqual(validator.validateReferencePreset(preset), { ok: true, errors: [] });

      const selectionIndex = JSON.parse(await readFile(path.join(build.outputDir, `references/shared/document-quality/indexes/${namespace}.json`), "utf8"));
      const application = await runtime.applyDocumentQualityProfile({ namespace, selectionIndex, pluginRoot: build.outputDir, request: { ...request, explicitPrimaryId: profileId } });
      assert.equal(application.selection.primaryProfileId, profileId);
      assert.ok(application.requirementManifest.requiredItemIds.length > 0);
    });
  }
});
