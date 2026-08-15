import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { generateUpdateManifest } from "../../tooling/generate-update-manifest.mjs";

const generatorUrl = pathToFileURL(path.resolve(import.meta.dirname, "../../tooling/generate-update-manifest.mjs")).href;

const installed = Object.freeze([Object.freeze({
  id: "archify",
  repository: "https://github.com/tt-a1i/archify",
  installedTag: "v2.13.0",
  commit: "2c1f8ac2ca28a26d0b68043ec80c9554e20ff0e3",
})]);

test("manifest check distinguishes a real missing manifest from stale content", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "update-manifest-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const manifestPath = path.join(root, "missing.json");

  await assert.rejects(
    () => generateUpdateManifest({ repoRoot: root, manifestPath, check: true, loadComponents: () => installed }),
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
    path.resolve(import.meta.dirname, "../../tooling/generate-update-manifest.mjs"),
    "--invalid",
  ], { encoding: "utf8" });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /usage: node tooling\/generate-update-manifest\.mjs \[--check\]/u);
});
