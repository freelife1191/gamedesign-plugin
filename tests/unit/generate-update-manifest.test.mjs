import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { generateUpdateManifest } from "../../tooling/generate-update-manifest.mjs";

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
