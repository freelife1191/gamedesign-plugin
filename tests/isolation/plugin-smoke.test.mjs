import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  assertSafeTemporaryRoot,
  runIsolationSmoke,
} from "../../tooling/isolation-smoke.mjs";

const repoRoot = path.resolve(fileURLToPath(new URL("../../", import.meta.url)));
const products = ["game-design-career", "game-design-studio"];

test("each generated plugin passes a standalone byte- and process-verified smoke", async () => {
  const report = await runIsolationSmoke({ repoRoot });
  assert.deepEqual(report.map(({ name }) => name), products);
  for (const result of report) {
    assert.equal(result.skillCount, 23);
    assert.deepEqual(result.vendorFiles, [
      { name: "skillstead", files: 55 },
      { name: "archify", files: 60 },
    ]);
    assert.deepEqual(result.hooks, ["SessionStart", "Stop"]);
    assert.deepEqual(result.validation, { ok: true, requestedFormats: ["md"] });
    assert.equal(result.stopStatus, "passed");
    assert.equal(result.officialValidatorOrigin, "isolated-copy");
    assert.equal(result.symlinks, 0);
    assert.deepEqual(result.imagePlan, {
      networkCalls: 0,
      generationCalls: 0,
      placeholders: 1,
      promptFiles: ["assets/prompts/image-prompts.json", "assets/prompts/image-prompts.md"],
    });
    assert.deepEqual(result.qualityProfile, result.name === "game-design-studio"
      ? { namespace: "studio", profileId: "game-design-brief", selectionReason: "compatible-template-map-match", validationOk: true }
      : { namespace: "career", profileId: "portfolio-case-study", selectionReason: "compatible-template-map-match", validationOk: true });
  }
});

test("isolated quality-profile resolution has no repository-source fallback", async () => {
  await assert.rejects(runIsolationSmoke({
    repoRoot,
    mutateCopy: async ({ pluginRoot, productName }) => {
      const [namespace, profileId] = productName === "game-design-studio"
        ? ["studio", "game-design-brief"]
        : ["career", "portfolio-case-study"];
      await rm(path.join(pluginRoot, `references/shared/document-quality/profiles/${namespace}/${profileId}.json`));
    },
  }), /ENOENT|profile|canonical source/ui);
});

for (const [label, mutate, expected] of [
  ["sibling package string", async ({ pluginRoot, productName }) => {
    const sibling = products.find((name) => name !== productName);
    await writeFile(path.join(pluginRoot, "SIBLING.txt"), `${sibling}\n`);
  }, /references sibling package/u],
  ["vendored byte", async ({ pluginRoot }) => {
    const target = path.join(pluginRoot, "skills/svg-infographic/SKILL.md");
    await writeFile(target, `${await readFile(target, "utf8")}mutated\n`);
  }, /modified vendored file/u],
  ["unsafe hook", async ({ pluginRoot }) => {
    const target = path.join(pluginRoot, "hooks/hooks.json");
    const hooks = JSON.parse(await readFile(target, "utf8"));
    hooks.hooks.Stop[0].hooks[0].command = "sh -c 'exit 0'";
    await writeFile(target, `${JSON.stringify(hooks, null, 2)}\n`);
  }, /hook contract mismatch/u],
  ["actual user home string", async ({ pluginRoot, actualHome }) => {
    await writeFile(path.join(pluginRoot, "HOME.txt"), `${actualHome}/private-sentinel\n`);
  }, /forbidden absolute path/u],
]) {
  test(`isolation smoke rejects ${label} mutation`, async () => {
    await assert.rejects(runIsolationSmoke({ repoRoot, mutateCopy: mutate }), expected);
  });
}

test("isolation smoke rejects a symlink introduced after extraction", async () => {
  await assert.rejects(runIsolationSmoke({
    repoRoot,
    mutateCopy: async ({ pluginRoot }) => {
      await symlink(path.join(pluginRoot, "README.md"), path.join(pluginRoot, "escape-link"));
    },
  }), /symlink/u);
});

test("isolation smoke sends a changed reference-intelligence source declaration to the semantic classifier before byte verification", async () => {
  await assert.rejects(runIsolationSmoke({
    repoRoot,
    mutateCopy: async ({ pluginRoot }) => {
      const target = path.join(pluginRoot, "skills/analyze-game-design-references/SKILL.md");
      const source = await readFile(target, "utf8");
      await writeFile(target, source.replace("../../../scripts/analyze-game-design-references.mjs", "../../../scripts/escaped-reference-runtime.mjs"));
    },
  }), /reference-intelligence semantic contract mismatch/u);
});

test("temporary-root guard rejects broad and symlink roots", async () => {
  await assert.rejects(assertSafeTemporaryRoot({ requestedRoot: path.parse(repoRoot).root, prefix: "game-design-isolation-" }), /unsafe temporary root/u);
  const scratch = await mkdtemp(path.join(os.tmpdir(), "game-design-root-guard-"));
  const link = `${scratch}-link`;
  try {
    await symlink(scratch, link);
    await assert.rejects(assertSafeTemporaryRoot({ requestedRoot: link, prefix: "game-design-isolation-" }), /symlink/u);
  } finally {
    await rm(link, { force: true });
    await rm(scratch, { recursive: true, force: true });
  }
});
