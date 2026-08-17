import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import { generateUpdateManifest, loadSuiteRelease } from "../../tooling/generate-update-manifest.mjs";

const generatorPath = fileURLToPath(new URL("../../tooling/generate-update-manifest.mjs", import.meta.url));
const generatorUrl = pathToFileURL(generatorPath).href;

const installed = Object.freeze([Object.freeze({
  id: "archify",
  repository: "https://github.com/tt-a1i/archify",
  installedTag: "v2.13.0",
  commit: "2c1f8ac2ca28a26d0b68043ec80c9554e20ff0e3",
})]);

// The suite pin is read from a lock file next to the manifest, so a fixture root that only
// exercises the vendor path has to stub it out the same way loadComponents is stubbed.
const suite = Object.freeze({
  id: "game-design-suite",
  repository: "https://github.com/freelife1191/gamedesign-plugin",
  installedTag: "v0.1.1",
  commit: "973f9a93013471a4fb882dcaea0435e9bd44c130",
});

test("manifest check distinguishes a real missing manifest from stale content", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "update-manifest-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const manifestPath = path.join(root, "missing.json");

  await assert.rejects(
    () => generateUpdateManifest({ repoRoot: root, manifestPath, check: true, loadComponents: () => installed, loadSuite: () => suite }),
    (error) => error?.code === "UPDATE_MANIFEST_MISSING" && error.cause?.code === "ENOENT",
  );
});

test("manifest check propagates an injected non-missing read failure", async () => {
  const denied = Object.assign(new Error("read denied"), { code: "EACCES" });

  await assert.rejects(
    () => generateUpdateManifest({
      repoRoot: "/fixture",
      manifestPath: "/fixture/installed-components.json",
      check: true,
      loadComponents: () => installed,
      loadSuite: () => suite,
      readManifest: async () => { throw denied; },
    }),
    (error) => error === denied,
  );
});

test("consumer process imports the manifest module with unrelated argv", () => {
  const result = spawnSync(process.execPath, [
    "--input-type=module",
    "--eval",
    `import ${JSON.stringify(generatorUrl)}; process.stdout.write("imported");`,
    "consumer.mjs",
    "--consumer-flag",
  ], { encoding: "utf8" });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "imported");
});

test("direct manifest CLI rejects invalid arguments", () => {
  const result = spawnSync(process.execPath, [
    generatorPath,
    "--invalid",
  ], { encoding: "utf8" });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /usage: node tooling\/generate-update-manifest\.mjs \[--check\]/u);
});

// A suite pin that disagrees with the shipped plugin version would make the advisory compare the
// installed plugin against a release it is not, and report current when it is behind.
test("a suite pin that disagrees with the shipped plugin version fails the generator", () => {
  const files = {
    "shared/updates/suite-release.lock.json": JSON.stringify({
      schemaVersion: 1,
      id: "game-design-suite",
      repository: "https://github.com/freelife1191/gamedesign-plugin",
      installedTag: "v0.1.1",
      commit: "973f9a93013471a4fb882dcaea0435e9bd44c130",
    }),
    "products/game-design-career/plugin/.codex-plugin/plugin.json": JSON.stringify({ version: "0.1.1" }),
    "products/game-design-studio/plugin/.codex-plugin/plugin.json": JSON.stringify({ version: "0.1.2" }),
  };
  const readLock = (target) => {
    const key = Object.keys(files).find((relative) => target.endsWith(relative.split("/").join(path.sep)));
    if (key === undefined) throw Object.assign(new Error("missing"), { code: "ENOENT" });
    return files[key];
  };

  assert.throws(
    () => loadSuiteRelease({ repoRoot: "/fixture", readLock }),
    (error) => error?.code === "SUITE_VERSION_MISMATCH" && /game-design-studio ships 0\.1\.2/u.test(error.message),
  );
});

test("a suite pin that matches every shipped plugin version is accepted", () => {
  const version = "0.1.1";
  const readLock = (target) => (target.endsWith("suite-release.lock.json")
    ? JSON.stringify({
      schemaVersion: 1,
      id: "game-design-suite",
      repository: "https://github.com/freelife1191/gamedesign-plugin",
      installedTag: `v${version}`,
      commit: "973f9a93013471a4fb882dcaea0435e9bd44c130",
    })
    : JSON.stringify({ version }));

  assert.deepEqual(loadSuiteRelease({ repoRoot: "/fixture", readLock }), {
    id: "game-design-suite",
    repository: "https://github.com/freelife1191/gamedesign-plugin",
    installedTag: "v0.1.1",
    commit: "973f9a93013471a4fb882dcaea0435e9bd44c130",
  });
});
