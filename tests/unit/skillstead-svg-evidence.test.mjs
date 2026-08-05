import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { buildProduct } from "../../tooling/lib/build-product.mjs";
import { syncShared } from "../../tooling/sync-shared.mjs";
import {
  lintWithApprovedSkillstead,
  resolveApprovedSkillsteadWrappers,
} from "../../shared/scripts/lib/skillstead-svg-evidence.mjs";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

async function exists(filename) {
  try {
    await access(filename, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

test("shared and clean-built runtimes do not carry a copied Skillstead linter or raw vendor CLI invocation", async (t) => {
  const copiedLinter = path.join(repoRoot, "shared/scripts/lib/skillstead-svg-lint.mjs");
  assert.equal(await exists(copiedLinter), false, "shared runtime must not copy vendored check-svg.mjs");

  const stagingRoot = await mkdtemp(path.join(tmpdir(), "skillstead-wrapper-boundary-"));
  t.after(() => rm(stagingRoot, { recursive: true, force: true }));
  for (const productName of ["game-design-studio", "game-design-career"]) {
    const { outputDir } = await buildProduct({ repoRoot, productName, stagingRoot, sourceDateEpoch: 0 });
    const runtimeDir = path.join(outputDir, "scripts/lib");
    assert.equal(await exists(path.join(runtimeDir, "skillstead-svg-lint.mjs")), false, `${productName} must not package a copied linter`);
    const stopSource = await readFile(path.join(outputDir, "scripts/stop-artifact-review.mjs"), "utf8");
    assert.doesNotMatch(stopSource, /svg-infographic(?:\/|\\)0\.8\.3(?:\/|\\)scripts(?:\/|\\)check-svg\.mjs/u, `${productName} Stop runtime must use its wrapper, not the raw vendor CLI`);
  }
});

test("source and clean-built Stop runtimes resolve only their canonical product-owned Skillstead wrappers", async (t) => {
  const sourceStop = path.join(repoRoot, "shared/scripts/stop-artifact-review.mjs");
  assert.deepEqual((await resolveApprovedSkillsteadWrappers({ runtimeModulePath: sourceStop })).map(({ wrapperPath }) => path.relative(repoRoot, wrapperPath)), [
    "products/game-design-career/plugin/skills/visualize-career-roadmap/scripts/run-skillstead.mjs",
    "products/game-design-studio/plugin/skills/visualize-game-design/scripts/run-skillstead.mjs",
  ]);

  const stagingRoot = await mkdtemp(path.join(tmpdir(), "skillstead-wrapper-runtime-"));
  t.after(() => rm(stagingRoot, { recursive: true, force: true }));
  for (const [productName, wrapper] of [
    ["game-design-studio", "skills/visualize-game-design/scripts/run-skillstead.mjs"],
    ["game-design-career", "skills/visualize-career-roadmap/scripts/run-skillstead.mjs"],
  ]) {
    const { outputDir } = await buildProduct({ repoRoot, productName, stagingRoot, sourceDateEpoch: 0 });
    const stop = path.join(outputDir, "scripts/stop-artifact-review.mjs");
    const resolved = await resolveApprovedSkillsteadWrappers({ runtimeModulePath: stop });
    assert.deepEqual(resolved.map(({ wrapperPath }) => wrapperPath), [path.join(outputDir, wrapper)]);
  }
});

test("approved lint invokes the wrapper through node arguments and rejects aliases, missing, or ambiguous wrappers", async (t) => {
  const sourceStop = path.join(repoRoot, "shared/scripts/stop-artifact-review.mjs");
  const sourceWrappers = await resolveApprovedSkillsteadWrappers({ runtimeModulePath: sourceStop });
  const calls = [];
  const result = await lintWithApprovedSkillstead("/tmp/diagram.svg", {
    runtimeModulePath: sourceStop,
    wrapperPath: sourceWrappers[0].wrapperPath,
    spawnFn(command, args, options) {
      calls.push({ command, args, options });
      return { status: 0, stdout: "check-svg: 0 error(s)\n", stderr: "" };
    },
  });
  assert.equal(result.ok, true);
  assert.deepEqual(calls, [{
    command: process.execPath,
    args: [sourceWrappers[0].wrapperPath, "lint", "/tmp/diagram.svg"],
    options: { encoding: "utf8", cwd: path.dirname(sourceWrappers[0].wrapperPath) },
  }]);

  const root = await mkdtemp(path.join(tmpdir(), "skillstead-wrapper-hostile-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await assert.rejects(() => resolveApprovedSkillsteadWrappers({ pluginRoot: root }), /exactly one|wrapper/i);
  await mkdir(path.join(root, "skills", "visualize-game-design", "scripts"), { recursive: true });
  const wrapper = path.join(root, "skills/visualize-game-design/scripts/run-skillstead.mjs");
  await writeFile(wrapper, "#!/usr/bin/env node\n");
  await mkdir(path.join(root, "skills", "visualize-career-roadmap", "scripts"), { recursive: true });
  await writeFile(path.join(root, "skills/visualize-career-roadmap/scripts/run-skillstead.mjs"), "#!/usr/bin/env node\n");
  await assert.rejects(() => resolveApprovedSkillsteadWrappers({ pluginRoot: root }), /exactly one|wrapper/i);
  await rm(path.join(root, "skills/visualize-career-roadmap"), { recursive: true, force: true });
  const alias = `${wrapper}.alias`;
  await symlink(wrapper, alias);
  await assert.rejects(() => lintWithApprovedSkillstead("/tmp/diagram.svg", {
    runtimeModulePath: sourceStop, wrapperPath: alias, spawnFn: () => ({ status: 0 }),
  }), /canonical|symbolic|wrapper/i);
});

test("snapshot packaging removes the Studio source-only vendor fallback while retaining the product wrapper", async (t) => {
  const stagingRoot = await mkdtemp(path.join(tmpdir(), "skillstead-wrapper-snapshot-"));
  t.after(() => rm(stagingRoot, { recursive: true, force: true }));
  const { outputDir } = await syncShared({ repoRoot, productName: "game-design-studio", stagingRoot, sourceDateEpoch: 0 });
  const wrapper = await readFile(path.join(outputDir, "skills/visualize-game-design/scripts/run-skillstead.mjs"), "utf8");
  assert.match(wrapper, /skills\/svg-infographic/u);
  assert.doesNotMatch(wrapper, /\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/shared\/vendor\/skillstead/u);
  assert.doesNotMatch(wrapper, /shared\/vendor\/skillstead\/svg-infographic\/0\.8\.3/u);
});
