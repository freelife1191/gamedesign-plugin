import assert from "node:assert/strict";
import { cp, lstat, mkdir, mkdtemp, readFile, rename as fsRename, rm, symlink, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
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

async function createSnapshotFixture(t) {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), "snapshot-boundary-contract-"));
  t.after(() => rm(temporaryRoot, { recursive: true, force: true }));
  const fixtureRepo = path.join(temporaryRoot, "repo");
  for (const directory of ["products", "shared", "docs"]) {
    await cp(path.join(repoRoot, directory), path.join(fixtureRepo, directory), { recursive: true });
  }
  return { fixtureRepo, temporaryRoot };
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
  const { fixtureRepo } = await createSnapshotFixture(t);
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
  assert.equal(await lstat(path.join(fixtureRepo, ".tmp")).then(() => true, (error) => error.code !== "ENOENT"), false);
  const before = await Promise.all(productNames.map((name) => collectTree(path.join(fixtureRepo, "plugins", name))));
  await buildSnapshots({ repoRoot: fixtureRepo, mode: "check" });
  const after = await Promise.all(productNames.map((name) => collectTree(path.join(fixtureRepo, "plugins", name))));
  assert.deepEqual(
    after.map((entries) => entries.map(({ relativePath, bytes }) => [relativePath, bytes.toString("hex")])),
    before.map((entries) => entries.map(({ relativePath, bytes }) => [relativePath, bytes.toString("hex")])),
  );
  assert.equal(await readFile(unrelated, "utf8"), "do not touch\n");
});

test("snapshot installation rejects symlinked plugin boundaries before either destination changes", async (t) => {
  await t.test("plugins root symlink", async (t) => {
    const { fixtureRepo, temporaryRoot } = await createSnapshotFixture(t);
    const externalPlugins = path.join(temporaryRoot, "external-plugins");
    for (const productName of productNames) {
      await mkdir(path.join(externalPlugins, productName), { recursive: true });
      await writeFile(path.join(externalPlugins, productName, "IRREPLACEABLE.txt"), `${productName} external\n`);
    }
    await mkdir(fixtureRepo, { recursive: true });
    await symlink(externalPlugins, path.join(fixtureRepo, "plugins"));
    const before = await Promise.all(productNames.map((name) => readFile(path.join(externalPlugins, name, "IRREPLACEABLE.txt"))));

    await assert.rejects(() => buildSnapshots({ repoRoot: fixtureRepo, mode: "clean" }), /plugins.*symlink|symlink.*plugins/i);
    assert.equal((await lstat(path.join(fixtureRepo, "plugins"))).isSymbolicLink(), true);
    assert.deepEqual(
      await Promise.all(productNames.map((name) => readFile(path.join(externalPlugins, name, "IRREPLACEABLE.txt")))),
      before,
    );
  });

  await t.test("second product destination symlink", async (t) => {
    const { fixtureRepo, temporaryRoot } = await createSnapshotFixture(t);
    const firstSentinel = path.join(fixtureRepo, "plugins/game-design-career/IRREPLACEABLE.txt");
    await mkdir(path.dirname(firstSentinel), { recursive: true });
    await writeFile(firstSentinel, "career original\n");
    const externalStudio = path.join(temporaryRoot, "external-studio");
    await mkdir(externalStudio, { recursive: true });
    await writeFile(path.join(externalStudio, "IRREPLACEABLE.txt"), "studio external\n");
    await symlink(externalStudio, path.join(fixtureRepo, "plugins/game-design-studio"));

    await assert.rejects(() => buildSnapshots({ repoRoot: fixtureRepo, mode: "clean" }), /destination.*symlink|symlink.*destination/i);
    assert.equal(await readFile(firstSentinel, "utf8"), "career original\n");
    assert.equal(await readFile(path.join(externalStudio, "IRREPLACEABLE.txt"), "utf8"), "studio external\n");
    assert.equal((await lstat(path.join(fixtureRepo, "plugins/game-design-studio"))).isSymbolicLink(), true);
  });
});

test("snapshot replacement restores originals when the second install rename fails", async (t) => {
  const { fixtureRepo } = await createSnapshotFixture(t);
  for (const productName of productNames) {
    const destination = path.join(fixtureRepo, "plugins", productName);
    await mkdir(destination, { recursive: true });
    await writeFile(path.join(destination, "IRREPLACEABLE.txt"), `${productName} original\n`);
  }
  let installRenames = 0;
  const renameOperation = async (source, destination) => {
    if (path.basename(path.dirname(source)).startsWith("snapshot-build-") && productNames.includes(path.basename(source))) {
      installRenames += 1;
      if (installRenames === 2) throw new Error("injected second install failure");
    }
    return fsRename(source, destination);
  };

  await assert.rejects(
    () => buildSnapshots({ repoRoot: fixtureRepo, mode: "clean", operations: { rename: renameOperation } }),
    /injected second install failure/i,
  );
  for (const productName of productNames) {
    assert.equal(
      await readFile(path.join(fixtureRepo, "plugins", productName, "IRREPLACEABLE.txt"), "utf8"),
      `${productName} original\n`,
    );
  }
});

test("snapshot transaction preserves originals or an external recovery copy across injected filesystem failures", async (t) => {
  async function fixtureWithOriginals(t) {
    const fixture = await createSnapshotFixture(t);
    for (const productName of productNames) {
      const destination = path.join(fixture.fixtureRepo, "plugins", productName);
      await mkdir(destination, { recursive: true });
      await writeFile(path.join(destination, "IRREPLACEABLE.txt"), `${productName} original\n`);
    }
    return fixture;
  }

  for (const failAt of [1, 2]) {
    await t.test(`backup rename ${failAt}`, async (t) => {
      const { fixtureRepo } = await fixtureWithOriginals(t);
      let renames = 0;
      await assert.rejects(() => buildSnapshots({
        repoRoot: fixtureRepo,
        mode: "clean",
        operations: {
          rename: async (source, destination) => {
            renames += 1;
            if (renames === failAt) throw new Error(`injected rename ${failAt}`);
            return fsRename(source, destination);
          },
        },
      }), new RegExp(`injected rename ${failAt}`, "i"));
      for (const productName of productNames) {
        assert.equal(await readFile(path.join(fixtureRepo, "plugins", productName, "IRREPLACEABLE.txt"), "utf8"), `${productName} original\n`);
      }
    });
  }

  await t.test("installed destination removal failure", async (t) => {
    const { fixtureRepo } = await fixtureWithOriginals(t);
    let installRenames = 0;
    const error = await buildSnapshots({
      repoRoot: fixtureRepo,
      mode: "clean",
      operations: {
        rename: async (source, destination) => {
          if (path.basename(path.dirname(source)).startsWith("snapshot-build-") && productNames.includes(path.basename(source))) {
            installRenames += 1;
            if (installRenames === 2) throw new Error("trigger rollback");
          }
          return fsRename(source, destination);
        },
        rm: async (target, options) => {
          if (path.basename(target) === "game-design-career" && path.basename(path.dirname(target)) === "plugins") {
            throw new Error("injected installed removal failure");
          }
          return rm(target, options);
        },
      },
    }).then(() => undefined, (caught) => caught);

    assert.equal(error?.recovery?.state, "rollback-incomplete");
    assert.match(error.message, /SNAPSHOT_RECOVERY=/u);
    assert.equal(await readFile(path.join(error.recovery.backups["game-design-career"], "IRREPLACEABLE.txt"), "utf8"), "game-design-career original\n");
    await rm(error.recovery.recoveryRoot, { recursive: true, force: true });
    await rm(error.recovery.stagingRoot, { recursive: true, force: true });
  });

  await t.test("backup restore failure", async (t) => {
    const { fixtureRepo } = await fixtureWithOriginals(t);
    let installFailureInjected = false;
    const error = await buildSnapshots({
      repoRoot: fixtureRepo,
      mode: "clean",
      operations: {
        rename: async (source, destination) => {
          if (!installFailureInjected && path.basename(path.dirname(source)).startsWith("snapshot-build-")) {
            installFailureInjected = true;
            throw new Error("trigger restore rollback");
          }
          if (path.basename(path.dirname(source)).startsWith("snapshot-recovery-") && path.basename(source) === "game-design-career") {
            throw new Error("injected restore failure");
          }
          return fsRename(source, destination);
        },
      },
    }).then(() => undefined, (caught) => caught);

    assert.equal(error?.recovery?.state, "rollback-incomplete");
    assert.equal(await readFile(path.join(error.recovery.backups["game-design-career"], "IRREPLACEABLE.txt"), "utf8"), "game-design-career original\n");
    assert.equal(await readFile(path.join(fixtureRepo, "plugins/game-design-studio/IRREPLACEABLE.txt"), "utf8"), "game-design-studio original\n");
    await rm(error.recovery.recoveryRoot, { recursive: true, force: true });
    await rm(error.recovery.stagingRoot, { recursive: true, force: true });
  });

  await t.test("committed backup cleanup failure", async (t) => {
    const { fixtureRepo } = await fixtureWithOriginals(t);
    const error = await buildSnapshots({
      repoRoot: fixtureRepo,
      mode: "clean",
      operations: {
        rm: async (target, options) => {
          if (path.basename(target).startsWith("snapshot-recovery-")) throw new Error("injected backup cleanup failure");
          return rm(target, options);
        },
      },
    }).then(() => undefined, (caught) => caught);

    assert.equal(error?.recovery?.state, "committed-recovery-retained");
    for (const productName of productNames) {
      assert.equal(await readFile(path.join(error.recovery.backups[productName], "IRREPLACEABLE.txt"), "utf8"), `${productName} original\n`);
    }
    await rm(error.recovery.recoveryRoot, { recursive: true, force: true });
    await rm(error.recovery.stagingRoot, { recursive: true, force: true });
  });
});

test("product and snapshot READMEs describe BUILD-MANIFEST in their actual build context", async () => {
  for (const productName of productNames) {
    const sourceReadme = await readFile(path.join(repoRoot, "products", productName, "plugin/README.md"), "utf8");
    const snapshotReadme = await readFile(path.join(repoRoot, "plugins", productName, "README.md"), "utf8");
    assert.match(sourceReadme, /저수준 `buildProduct\(\)` 출력에는 `BUILD-MANIFEST\.json`이 없/u);
    assert.match(sourceReadme, /(?:이 )?suite distribution snapshot에는 `BUILD-MANIFEST\.json`이 있/u);
    assert.match(snapshotReadme, /이 suite distribution snapshot에는 `BUILD-MANIFEST\.json`이 있/u);
    assert.doesNotMatch(snapshotReadme, /미래 (?:배포|release) 산출물/u);
  }
});

test("sync-shared CLI rejects a source-overlapping staging root without changing product.json", async (t) => {
  const { fixtureRepo } = await createSnapshotFixture(t);
  const sentinel = path.join(fixtureRepo, "products/game-design-career/product.json");
  const before = await readFile(sentinel);
  const result = spawnSync(process.execPath, [
    path.join(repoRoot, "tooling/sync-shared.mjs"),
    "--repo-root", fixtureRepo,
    "--product", "game-design-career",
    "--staging-root", path.join(fixtureRepo, "products"),
  ], { encoding: "utf8" });

  assert.notEqual(result.status, 0, result.stdout);
  assert.match(result.stderr, /staging|destination|source|overlap/i);
  assert.deepEqual(await readFile(sentinel), before);
});

test("sync-shared CLI rejects broad and symlinked staging arguments without touching external bytes", async (t) => {
  const { fixtureRepo, temporaryRoot } = await createSnapshotFixture(t);
  const cli = path.join(repoRoot, "tooling/sync-shared.mjs");
  for (const stagingRoot of [path.parse(tmpdir()).root, homedir()]) {
    const result = spawnSync(process.execPath, [
      cli,
      "--repo-root", fixtureRepo,
      "--product", "game-design-career",
      "--staging-root", stagingRoot,
    ], { encoding: "utf8" });
    assert.notEqual(result.status, 0, `${stagingRoot}: ${result.stdout}`);
    assert.match(result.stderr, /root|home|staging/i);
  }

  const external = path.join(temporaryRoot, "external-staging");
  const sentinel = path.join(external, "game-design-career/IRREPLACEABLE/product.json");
  await mkdir(path.dirname(sentinel), { recursive: true });
  await writeFile(sentinel, "external bytes\n");
  const stagingLink = path.join(temporaryRoot, "staging-link");
  await symlink(external, stagingLink);
  const result = spawnSync(process.execPath, [
    cli,
    "--repo-root", fixtureRepo,
    "--product", "game-design-career",
    "--staging-root", stagingLink,
  ], { encoding: "utf8" });
  assert.notEqual(result.status, 0, result.stdout);
  assert.match(result.stderr, /symlink|staging/i);
  assert.equal(await readFile(sentinel, "utf8"), "external bytes\n");
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
