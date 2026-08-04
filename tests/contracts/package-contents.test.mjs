import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { collectTree } from "../../tooling/lib/copy-tree.mjs";
import { hashFileEntries, sha256 } from "../../tooling/lib/hash.mjs";
import { buildProduct } from "../../tooling/lib/build-product.mjs";
import { buildSnapshots } from "../../tooling/build-snapshots.mjs";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const productNames = ["game-design-career", "game-design-studio"];
const vendorLockPath = "references/shared/vendor/skillstead/vendor.lock.json";
const deploymentTransforms = new Map([
  ["skills/export-career-documents/scripts/prepare-career-export.mjs", '    new URL("../../../../../../shared/scripts/validate-artifact.mjs", import.meta.url),\n'],
  ["skills/orchestrate-game-design-career/scripts/validate-career-scenario.mjs", '      new URL("../../../../../../shared/scripts/validate-artifact.mjs", import.meta.url),\n'],
  ["skills/visualize-career-roadmap/scripts/run-skillstead.mjs", '    path.resolve(path.dirname(ownPath), "../../../../../../shared/vendor/skillstead/svg-infographic/0.8.3"),\n'],
]);

async function cleanBuild(t, productName) {
  const stagingRoot = await mkdtemp(path.join(tmpdir(), "package-contents-source-"));
  t.after(() => rm(stagingRoot, { recursive: true, force: true }));
  return buildProduct({ repoRoot, productName, stagingRoot, sourceDateEpoch: 0 });
}

async function packagedEntries(productName) {
  return collectTree(path.join(repoRoot, "plugins", productName), { label: `plugins/${productName}` });
}

function pathsUnder(files, prefix) {
  return files.filter((file) => file.startsWith(prefix));
}

test("generated snapshots contain the exact clean product build plus the suite manifest and vendor lock", async (t) => {
  const vendorLockBytes = await readFile(path.join(repoRoot, "shared/vendor/skillstead/vendor.lock.json"));
  for (const productName of productNames) {
    await t.test(productName, async (t) => {
      const sourceBuild = await cleanBuild(t, productName);
      const entries = await packagedEntries(productName);
      const packagedByPath = new Map(entries.map((entry) => [entry.relativePath, entry.bytes]));
      const packageFiles = entries.map(({ relativePath }) => relativePath);
      const expectedFiles = [...sourceBuild.files, vendorLockPath, "BUILD-MANIFEST.json"].sort();
      assert.deepEqual(packageFiles, expectedFiles);

      const manifest = JSON.parse(await readFile(path.join(sourceBuild.outputDir, ".codex-plugin/plugin.json"), "utf8"));
      const packagedManifest = JSON.parse(await readFile(path.join(repoRoot, "plugins", productName, ".codex-plugin/plugin.json"), "utf8"));
      assert.equal(manifest.name, productName);
      assert.equal(packagedManifest.name, productName);
      assert.equal(packagedManifest.skills, "./skills/");

      assert.equal(pathsUnder(packageFiles, "skills/").filter((file) => file.endsWith("/SKILL.md")).length, 11);
      assert.equal(pathsUnder(packageFiles, "skills/").filter((file) => file.endsWith("/SKILL.md") && !file.startsWith("skills/svg-infographic/")).length, 10);
      assert.equal(pathsUnder(packageFiles, "agents/").filter((file) => file.endsWith(".md")).length, 6);
      assert.equal(pathsUnder(packageFiles, "references/source/docs/").filter((file) => file.endsWith(".md")).length, 49);
      assert.equal(pathsUnder(packageFiles, "references/shared/knowledge/core/").length, 7);
      assert.equal(pathsUnder(packageFiles, "references/shared/knowledge/trends/").length, 2);
      assert.equal(pathsUnder(packageFiles, "assets/templates/").filter((file) => file.endsWith("/content.md")).length, 15);
      for (const required of [
        ".codex-plugin/plugin.json",
        "hooks/hooks.json",
        "scripts/capability-probe.mjs",
        "scripts/stop-artifact-review.mjs",
        "scripts/validate-artifact.mjs",
        "assets/shared/templates/canonical-artifact/content.md",
        "references/shared/responsible-design/gates.json",
        "references/shared/knowledge/reference-index.json",
        "references/shared/knowledge/source-policy.md",
        "references/shared/export/schema/artifact.schema.json",
        "skills/svg-infographic/SKILL.md",
        "skills/svg-infographic/LICENSE.txt",
        "README.md",
        "LICENSE",
        "THIRD_PARTY_NOTICES.md",
        vendorLockPath,
        "BUILD-MANIFEST.json",
      ]) assert.ok(packageFiles.includes(required), `${productName}: missing ${required}`);

      if (productName === "game-design-studio") {
        assert.equal(pathsUnder(packageFiles, "references/profiles/").filter((file) => file.endsWith(".json")).length, 4);
        assert.ok(packageFiles.includes("references/source-document-rights.json"));
        assert.ok(packageFiles.includes("skills/orchestrate-game-design-project/scripts/check-source-document-redistribution.mjs"));
      } else {
        assert.ok(packageFiles.includes("references/career-stages.json"));
      }

      assert.deepEqual(await readFile(path.join(repoRoot, "plugins", productName, vendorLockPath)), vendorLockBytes);
      const sourceEntries = await collectTree(sourceBuild.outputDir, { label: `clean source ${productName}` });
      for (const { relativePath, bytes } of sourceEntries) {
        let expected = bytes;
        const fragment = productName === "game-design-career" ? deploymentTransforms.get(relativePath) : undefined;
        if (fragment) {
          const source = bytes.toString("utf8");
          assert.equal(source.split(fragment).length - 1, 1, `${relativePath}: approved fragment count`);
          expected = Buffer.from(source.replace(fragment, ""));
        }
        assert.deepEqual(packagedByPath.get(relativePath), expected, `${productName}: unexpected deployment rewrite at ${relativePath}`);
      }
      const buildManifest = JSON.parse(await readFile(path.join(repoRoot, "plugins", productName, "BUILD-MANIFEST.json"), "utf8"));
      assert.deepEqual(Object.keys(buildManifest), ["schemaVersion", "name", "sourceDateEpoch", "treeSha256", "files"]);
      assert.equal(buildManifest.schemaVersion, 1);
      assert.equal(buildManifest.name, productName);
      assert.equal(buildManifest.sourceDateEpoch, 0);

      const contentEntries = entries.filter(({ relativePath }) => relativePath !== "BUILD-MANIFEST.json");
      assert.deepEqual(buildManifest.files, contentEntries.map(({ relativePath, bytes }) => ({
        path: relativePath,
        sha256: sha256(bytes),
        size: bytes.length,
      })));
      assert.equal(buildManifest.treeSha256, hashFileEntries(contentEntries));
    });
  }
});

test("clean replacement touches only the two explicit plugin directories and check is read-only", async (t) => {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), "snapshot-destination-contract-"));
  t.after(() => rm(temporaryRoot, { recursive: true, force: true }));
  const fixtureRepo = path.join(temporaryRoot, "repo");
  for (const directory of ["products", "shared", "docs"]) {
    await cp(path.join(repoRoot, directory), path.join(fixtureRepo, directory), { recursive: true });
  }
  for (const productName of productNames) {
    const destination = path.join(fixtureRepo, "plugins", productName);
    await mkdir(destination, { recursive: true });
    await writeFile(path.join(destination, "old.txt"), `${productName} old\n`);
  }
  const unrelated = path.join(fixtureRepo, "plugins", "unrelated-private-plugin", "sentinel.txt");
  await mkdir(path.dirname(unrelated), { recursive: true });
  await writeFile(unrelated, "do not touch\n");

  await buildSnapshots({ repoRoot: fixtureRepo, mode: "clean" });
  assert.equal(await readFile(unrelated, "utf8"), "do not touch\n");
  const before = await Promise.all(productNames.map((name) => collectTree(path.join(fixtureRepo, "plugins", name))));
  await buildSnapshots({ repoRoot: fixtureRepo, mode: "check" });
  const after = await Promise.all(productNames.map((name) => collectTree(path.join(fixtureRepo, "plugins", name))));
  assert.deepEqual(
    after.map((entries) => entries.map(({ relativePath, bytes }) => [relativePath, bytes.toString("hex")])),
    before.map((entries) => entries.map(({ relativePath, bytes }) => [relativePath, bytes.toString("hex")])),
  );
  assert.equal(await readFile(unrelated, "utf8"), "do not touch\n");
});

test("marketplace pointers resolve to the two compatible generated package manifests", async () => {
  const marketplace = JSON.parse(await readFile(path.join(repoRoot, ".agents/plugins/marketplace.json"), "utf8"));
  assert.deepEqual(marketplace.plugins.map(({ name, source }) => [name, source.source, source.path]).sort(), [
    ["game-design-career", "local", "./plugins/game-design-career"],
    ["game-design-studio", "local", "./plugins/game-design-studio"],
  ]);
  for (const { name, source } of marketplace.plugins) {
    const manifest = JSON.parse(await readFile(path.resolve(repoRoot, source.path, ".codex-plugin/plugin.json"), "utf8"));
    assert.equal(manifest.name, name);
  }
});

test("Studio snapshot preserves the fail-closed source-document rights manifest and local/private gate", () => {
  const pluginRoot = path.join(repoRoot, "plugins/game-design-studio");
  const gate = path.join(pluginRoot, "skills/orchestrate-game-design-project/scripts/check-source-document-redistribution.mjs");
  for (const mode of ["local", "private"]) {
    const result = spawnSync(process.execPath, [gate, "--mode", mode, "--plugin-root", pluginRoot], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), { ok: true, mode, documentCount: 49, clearedDocumentCount: 0 });
  }
  for (const mode of ["public", "distributable"]) {
    const result = spawnSync(process.execPath, [gate, "--mode", mode, "--plugin-root", pluginRoot], { encoding: "utf8" });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /49 source document\(s\) are not cleared for public redistribution/u);
  }
});
