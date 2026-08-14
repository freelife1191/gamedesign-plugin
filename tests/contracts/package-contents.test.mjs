import assert from "node:assert/strict";
import { chmod, cp, lstat, mkdir, mkdtemp, readFile, readdir, realpath, rename as fsRename, rm, symlink, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { collectTree } from "../../tooling/lib/copy-tree.mjs";
import { hashFileEntries, sha256 } from "../../tooling/lib/hash.mjs";
import { buildProduct } from "../../tooling/lib/build-product.mjs";
import { buildSnapshots } from "../../tooling/build-snapshots.mjs";
import { findPolicyLeak, findPolicyLeakInBytes, readNeutralPresetPolicy } from "./neutral-preset-policy.mjs";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const productNames = ["game-design-career", "game-design-studio"];
const vendorLockPath = "references/shared/vendor/skillstead/vendor.lock.json";
const neutralPresetIds = [
  "competitive-live-service", "replayable-coop", "evolving-world", "function-first",
  "player-validated-small-team", "cinematic-narrative", "ugc-production-tooling",
];
const deploymentTransforms = new Map([
  ["skills/export-career-documents/scripts/prepare-career-export.mjs", '    new URL("../../../../../../shared/scripts/validate-artifact.mjs", import.meta.url),\n'],
  ["skills/orchestrate-game-design-career/scripts/validate-career-scenario.mjs", '      new URL("../../../../../../shared/scripts/validate-artifact.mjs", import.meta.url),\n'],
]);

async function cleanBuild(t, productName) {
  const stagingRoot = await mkdtemp(path.join(tmpdir(), "package-contents-source-"));
  t.after(() => rm(stagingRoot, { recursive: true, force: true }));
  return buildProduct({ repoRoot, productName, stagingRoot, sourceDateEpoch: 0 });
}

async function packagedEntries(productName) {
  return collectTree(path.join(repoRoot, "plugins", productName), { label: `plugins/${productName}` });
}

test("repository root publishes the canonical image configuration example", async () => {
  const canonicalExample = await readFile(path.join(repoRoot, "shared/image-assets/.env.example"));
  const rootExample = await readFile(path.join(repoRoot, ".env.example"));
  assert.deepEqual(rootExample, canonicalExample);
});

test("temporary product builds package exact image configuration examples without a real .env", async (t) => {
  const sourceExample = await readFile(path.join(repoRoot, "shared/image-assets/.env.example"));
  for (const productName of productNames) {
    const build = await cleanBuild(t, productName);
    const rootExample = await readFile(path.join(build.outputDir, ".env.example"));
    const referenceExample = await readFile(path.join(build.outputDir, "references/shared/image-assets/.env.example"));
    assert.deepEqual(rootExample, sourceExample, `${productName}: root example bytes`);
    assert.deepEqual(referenceExample, sourceExample, `${productName}: reference example bytes`);
    assert.equal(build.files.some((file) => path.basename(file) === ".env"), false, `${productName}: real .env`);
    assert.ok(build.files.includes("references/shared/image-assets/schema/image-config.schema.json"));
    assert.ok(build.files.includes("scripts/validate-image-config.mjs"));
  }
});

test("temporary product builds package neutral presets without authoring evidence paths or source URL bytes", async (t) => {
  const policy = await readNeutralPresetPolicy(repoRoot);
  for (const productName of productNames) {
    const build = await cleanBuild(t, productName);
    const entries = await collectTree(build.outputDir, { label: `temporary ${productName}` });
    const paths = entries.map(({ relativePath }) => relativePath);
    for (const id of neutralPresetIds) {
      assert.ok(paths.includes(`references/shared/document-quality/presets/${id}.json`), `${productName}: ${id}`);
    }
    const namespace = productName === "game-design-studio" ? "studio" : "career";
    assert.ok(paths.includes(`references/shared/document-quality/indexes/${namespace}.json`), `${productName}: selection index`);
    assert.ok(paths.includes("scripts/validate-reference-preset.mjs"), `${productName}: production reference preset validator`);

    for (const { relativePath, bytes } of entries) {
      const fullBuildOptions = { includeAliases: false };
      assert.equal(findPolicyLeak([relativePath], policy, fullBuildOptions), undefined, `${productName}: authoring label or URL in path ${relativePath}`);
      assert.equal(relativePath.includes(policy.evidenceFilename), false, `${productName}: authoring path ${relativePath}`);
      assert.equal(bytes.includes(Buffer.from(policy.evidenceFilename)), false, `${productName}: authoring filename raw bytes in ${relativePath}`);
      assert.equal(findPolicyLeakInBytes(bytes, policy, fullBuildOptions), undefined, `${productName}: exact authoring label or URL raw bytes in ${relativePath}`);
      assert.equal(findPolicyLeak([bytes.toString("utf8")], policy, fullBuildOptions), undefined, `${productName}: authoring label or URL bytes in ${relativePath}`);

      const isPresetContract = relativePath.startsWith("references/shared/document-quality/presets/")
        || relativePath === "references/shared/document-quality/schema/reference-preset.schema.json";
      if (isPresetContract) {
        assert.equal(findPolicyLeak([relativePath], policy), undefined, `${productName}: preset alias in path ${relativePath}`);
        assert.equal(findPolicyLeakInBytes(bytes, policy), undefined, `${productName}: exact preset alias raw bytes in ${relativePath}`);
        assert.equal(findPolicyLeak([bytes.toString("utf8")], policy), undefined, `${productName}: preset alias bytes in ${relativePath}`);
      }
    }
  }
});

async function createSnapshotFixture(t) {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), "snapshot-boundary-contract-"));
  t.after(() => rm(temporaryRoot, { recursive: true, force: true }));
  const fixtureRepo = path.join(temporaryRoot, "repo");
  for (const directory of ["products", "shared", "docs"]) {
    await cp(path.join(repoRoot, directory), path.join(fixtureRepo, directory), { recursive: true });
  }
  return { fixtureRepo, temporaryRoot };
}

async function assertCanonicalExisting(location) {
  assert.equal(typeof location, "string");
  await lstat(location);
  assert.equal(await realpath(location), location);
}

async function assertProcessExited(pid) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      process.kill(pid, 0);
    } catch (error) {
      if (error.code === "ESRCH") return;
      throw error;
    }
    await delay(10);
  }
  assert.fail(`snapshot worker ${pid} remained alive`);
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
      const sourceWorkflow = await readFile(path.join(repoRoot, "shared/scripts/run-image-asset-workflow.mjs"), "utf8");
      const packagedWorkflow = packagedByPath.get("scripts/run-image-asset-workflow.mjs").toString("utf8");
      for (const workflow of [sourceWorkflow, packagedWorkflow]) {
        assert.match(workflow, /references\/shared\/image-assets\/prompt-patterns/u);
        assert.doesNotMatch(workflow, /\.\.\/image-assets\//u);
      }

      assert.equal(pathsUnder(packageFiles, "skills/").filter((file) => file.endsWith("/SKILL.md")).length, productName === "game-design-studio" ? 24 : 23);
      assert.equal(pathsUnder(packageFiles, "skills/").filter((file) => file.endsWith("/SKILL.md") && !file.startsWith("skills/svg-infographic/")).length, productName === "game-design-studio" ? 23 : 22);
      assert.equal(pathsUnder(packageFiles, "scripts/").filter((file) => /^scripts\/[^/]+\.mjs$/u.test(file)).length, 30);
      assert.equal(
        pathsUnder(packageFiles, "agents/").filter((file) => file.endsWith(".md")).length,
        productName === "game-design-studio" ? 12 : 10,
      );
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
        "scripts/build-image-asset-plan.mjs",
        "scripts/compile-image-prompts.mjs",
        "scripts/generate-openai-images.mjs",
        "scripts/run-image-asset-workflow.mjs",
        "scripts/validate-image-assets.mjs",
        "scripts/validate-image-config.mjs",
        "scripts/lib/image-provider.mjs",
        "scripts/lib/image-file-validation.mjs",
        "scripts/lib/complete-png-validation.mjs",
        "scripts/lib/skillstead-svg-evidence.mjs",
        "scripts/lib/safe-artifact-write.mjs",
        ".env.example",
        "references/shared/image-assets/.env.example",
        "references/shared/image-assets/schema/image-config.schema.json",
        "references/shared/image-assets/schema/image-assets.schema.json",
        "references/shared/image-assets/schema/image-review.schema.json",
        "references/shared/image-assets/qa-contracts/provider-routing.md",
        "references/shared/image-assets/qa-contracts/generated-image.md",
        "references/shared/image-assets/qa-contracts/production-candidate.md",
        "references/shared/image-assets/prompt-patterns/base.json",
        "references/shared/image-assets/prompt-patterns/character.json",
        "skills/plan-image-assets/SKILL.md",
        "skills/generate-image-assets/SKILL.md",
        "skills/review-image-assets/SKILL.md",
        "agents/art-brief-director.md",
        "agents/visual-asset-reviewer.md",
        "assets/shared/templates/canonical-artifact/content.md",
        "references/shared/responsible-design/gates.json",
        "references/shared/knowledge/reference-index.json",
        "references/shared/knowledge/source-policy.md",
        "references/shared/export/schema/artifact.schema.json",
        "references/shared/document-quality/schema/quality-profile.schema.json",
        "references/shared/document-quality/render-contracts/long-form-document.json",
        "references/document-quality/template-profile-map.json",
        "scripts/resolve-quality-profile.mjs",
        "scripts/validate-quality-profile.mjs",
        "skills/apply-document-quality-profile/SKILL.md",
        "agents/document-quality-editor.md",
        "skills/svg-infographic/SKILL.md",
        "skills/svg-infographic/LICENSE.txt",
        "skills/archify/SKILL.md",
        "skills/archify/bin/archify.mjs",
        "skills/humanize-korean/SKILL.md",
        "README.md",
        "LICENSE",
        "THIRD_PARTY_NOTICES.md",
        vendorLockPath,
        "BUILD-MANIFEST.json",
      ]) assert.ok(packageFiles.includes(required), `${productName}: missing ${required}`);

      if (productName === "game-design-studio") {
        for (const required of [
          "agents/combat-encounter-reviewer.md",
          "agents/level-puzzle-reviewer.md",
        ]) assert.ok(packageFiles.includes(required), `${productName}: missing ${required}`);
      }

      for (const forbidden of [
        ".env",
        "fixtures/secret.env",
        "references/source/authoring-map.json",
        "scripts/lib/skillstead-svg-lint.mjs",
      ]) assert.equal(packageFiles.includes(forbidden), false, `${productName}: forbidden ${forbidden}`);
      for (const { relativePath, bytes } of entries) {
        assert.equal(
          /(?:^|\/)\.env(?:\.[^/]+)?$/u.test(relativePath) && relativePath !== ".env.example" && relativePath !== "references/shared/image-assets/.env.example",
          false,
          `${productName}: real env ${relativePath}`,
        );
        assert.equal(/(?:^|\/)(?:authoring[-_])?(?:source[-_])?map(?:\.json)?$/iu.test(relativePath), false, `${productName}: authoring source map ${relativePath}`);
        assert.doesNotMatch(bytes.toString("utf8"), /(?:\/Users\/|\/home\/|[A-Za-z]:\\Users\\)/u, `${productName}: absolute host path ${relativePath}`);
        assert.doesNotMatch(bytes.toString("utf8"), new RegExp(productName === "game-design-studio" ? "game-design-career" : "game-design-studio", "u"), `${productName}: sibling reference ${relativePath}`);
      }

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
  await chmod(path.join(fixtureRepo, "plugins"), 0o711);
  const pluginsBefore = await lstat(path.join(fixtureRepo, "plugins"));
  const unrelatedBefore = await lstat(path.dirname(unrelated));

  const builds = await buildSnapshots({ repoRoot: fixtureRepo, mode: "clean" });
  t.after(() => rm(builds.recovery.recoveryRoot, { recursive: true, force: true }));
  const pluginsAfter = await lstat(path.join(fixtureRepo, "plugins"));
  const unrelatedAfter = await lstat(path.dirname(unrelated));
  assert.equal(pluginsAfter.mode & 0o777, 0o711);
  assert.deepEqual([pluginsAfter.dev, pluginsAfter.ino], [pluginsBefore.dev, pluginsBefore.ino]);
  assert.deepEqual([unrelatedAfter.dev, unrelatedAfter.ino], [unrelatedBefore.dev, unrelatedBefore.ino]);
  assert.equal(await readFile(unrelated, "utf8"), "do not touch\n");
  assert.equal(builds.recovery?.state, "committed-recovery-retained");
  await assertCanonicalExisting(builds.recovery?.recoveryRoot);
  const marker = JSON.parse(await readFile(path.join(builds.recovery.recoveryRoot, "SNAPSHOT-RECOVERY.json"), "utf8"));
  assert.equal(marker.repoRoot, await realpath(fixtureRepo));
  assert.deepEqual(marker.products, productNames);
  for (const productName of productNames) {
    assert.equal(
      await readFile(path.join(builds.recovery.recoveryRoot, productName, "old.txt"), "utf8"),
      `${productName} old\n`,
    );
  }
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

test("successful cleans never garbage-collect self-attested recovery markers", async (t) => {
  const { fixtureRepo, temporaryRoot } = await createSnapshotFixture(t);
  for (const productName of productNames) {
    const destination = path.join(fixtureRepo, "plugins", productName);
    await mkdir(destination, { recursive: true });
    await writeFile(path.join(destination, "generation.txt"), "generation one\n");
  }
  const forged = await mkdtemp(path.join(await realpath(tmpdir()), "snapshot-recovery-forged-"));
  const partial = await mkdtemp(path.join(await realpath(tmpdir()), "snapshot-recovery-partial-"));
  const symlinkName = path.join(await realpath(tmpdir()), `snapshot-recovery-link-${path.basename(temporaryRoot)}`);
  const external = path.join(temporaryRoot, "external-recovery-target");
  await mkdir(external);
  await writeFile(path.join(external, "sentinel.txt"), "symlink target unchanged\n");
  await writeFile(path.join(forged, "sentinel.txt"), "forged must remain\n");
  await writeFile(path.join(partial, "SNAPSHOT-RECOVERY.json"), '{"schemaVersion":1');
  await writeFile(path.join(forged, "SNAPSHOT-RECOVERY.json"), `${JSON.stringify({
    schemaVersion: 1,
    state: "committed-recovery-retained",
    repoRoot: await realpath(fixtureRepo),
    recoveryRoot: forged,
  })}\n`);
  await symlink(external, symlinkName);
  t.after(() => Promise.all([
    rm(forged, { recursive: true, force: true }),
    rm(partial, { recursive: true, force: true }),
    rm(symlinkName, { force: true }),
  ]));
  let gcCalls = 0;
  const builds = await buildSnapshots({
    repoRoot: fixtureRepo,
    mode: "clean",
    operations: {
      gcRm: async (target, options) => {
        gcCalls += 1;
        return rm(target, options);
      },
    },
  });
  t.after(() => rm(builds.recovery.recoveryRoot, { recursive: true, force: true }));
  assert.equal(gcCalls, 0);
  assert.equal(await readFile(path.join(forged, "sentinel.txt"), "utf8"), "forged must remain\n");
  assert.equal(await readFile(path.join(partial, "SNAPSHOT-RECOVERY.json"), "utf8"), '{"schemaVersion":1');
  assert.equal((await lstat(symlinkName)).isSymbolicLink(), true);
  assert.equal(await readFile(path.join(external, "sentinel.txt"), "utf8"), "symlink target unchanged\n");
  await assertCanonicalExisting(builds.recovery.recoveryRoot);
  assert.ok(builds.recovery.manualCleanup.includes(builds.recovery.recoveryRoot));
  for (const productName of productNames) {
    assert.equal((await lstat(path.join(fixtureRepo, "plugins", productName))).isDirectory(), true);
    await assertCanonicalExisting(path.join(builds.recovery.recoveryRoot, productName));
  }
});

test("concurrent snapshot builds do not change the parent cwd or unrelated relative I/O", async (t) => {
  const leakedProductRoots = productNames.map((productName) => path.join(repoRoot, productName));
  for (const leakedRoot of leakedProductRoots) {
    assert.equal(await lstat(leakedRoot).then(() => true, (error) => error.code !== "ENOENT"), false);
  }
  t.after(() => Promise.all(leakedProductRoots.map((leakedRoot) => rm(leakedRoot, { recursive: true, force: true }))));
  const fixtures = await Promise.all([createSnapshotFixture(t), createSnapshotFixture(t)]);
  for (const { fixtureRepo } of fixtures) {
    for (const productName of productNames) {
      const destination = path.join(fixtureRepo, "plugins", productName);
      await mkdir(destination, { recursive: true });
      await writeFile(path.join(destination, "IRREPLACEABLE.txt"), `${path.basename(fixtureRepo)} ${productName}\n`);
    }
  }
  const originalCwd = process.cwd();
  const relativeReads = [];
  const timer = setInterval(() => {
    relativeReads.push(readFile("package.json", "utf8"));
  }, 1);
  let builds;
  try {
    builds = await Promise.all(fixtures.map(({ fixtureRepo }) => buildSnapshots({ repoRoot: fixtureRepo, mode: "clean" })));
  } finally {
    clearInterval(timer);
  }
  await Promise.all(relativeReads);
  assert.equal(process.cwd(), originalCwd);
  assert.ok(relativeReads.length > 0);
  for (const leakedRoot of leakedProductRoots) {
    assert.equal(await lstat(leakedRoot).then(() => true, (error) => error.code !== "ENOENT"), false);
  }
  for (const build of builds) {
    t.after(() => rm(build.recovery.recoveryRoot, { recursive: true, force: true }));
    await assertCanonicalExisting(build.recovery.recoveryRoot);
  }
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

test("snapshot replacement binds the plugins root entry across preflight and root renames", async (t) => {
  await t.test("root swapped to external symlink before backup", async (t) => {
    const { fixtureRepo, temporaryRoot } = await createSnapshotFixture(t);
    for (const productName of productNames) {
      const destination = path.join(fixtureRepo, "plugins", productName);
      await mkdir(destination, { recursive: true });
      await writeFile(path.join(destination, "IRREPLACEABLE.txt"), `${productName} original\n`);
    }
    const unrelated = path.join(fixtureRepo, "plugins/unrelated-private-plugin/sentinel.txt");
    await mkdir(path.dirname(unrelated), { recursive: true });
    await writeFile(unrelated, "unrelated original\n");
    const displacedPlugins = path.join(fixtureRepo, "plugins-original");
    const externalPlugins = path.join(temporaryRoot, "external-plugins");
    for (const productName of productNames) {
      await mkdir(path.join(externalPlugins, productName), { recursive: true });
      await writeFile(path.join(externalPlugins, productName, "IRREPLACEABLE.txt"), `${productName} external\n`);
    }
    await writeFile(path.join(externalPlugins, "external-sentinel.txt"), "external root\n");

    await assert.rejects(() => buildSnapshots({
      repoRoot: fixtureRepo,
      mode: "clean",
      operations: {
        beforeRootBackup: async () => {
          await fsRename(path.join(fixtureRepo, "plugins"), displacedPlugins);
          await symlink(externalPlugins, path.join(fixtureRepo, "plugins"));
        },
      },
    }), /symlink|plugins root|changed/i);

    assert.equal((await lstat(path.join(fixtureRepo, "plugins"))).isSymbolicLink(), true);
    assert.equal(await readFile(path.join(externalPlugins, "external-sentinel.txt"), "utf8"), "external root\n");
    for (const productName of productNames) {
      assert.equal(await readFile(path.join(externalPlugins, productName, "IRREPLACEABLE.txt"), "utf8"), `${productName} external\n`);
      assert.equal(await readFile(path.join(displacedPlugins, productName, "IRREPLACEABLE.txt"), "utf8"), `${productName} original\n`);
    }
    assert.equal(await readFile(path.join(displacedPlugins, "unrelated-private-plugin/sentinel.txt"), "utf8"), "unrelated original\n");
  });

  await t.test("external symlink inserted before root install", async (t) => {
    const { fixtureRepo, temporaryRoot } = await createSnapshotFixture(t);
    for (const productName of productNames) {
      const destination = path.join(fixtureRepo, "plugins", productName);
      await mkdir(destination, { recursive: true });
      await writeFile(path.join(destination, "IRREPLACEABLE.txt"), `${productName} original\n`);
    }
    const unrelated = path.join(fixtureRepo, "plugins/unrelated-private-plugin/sentinel.txt");
    await mkdir(path.dirname(unrelated), { recursive: true });
    await writeFile(unrelated, "unrelated original\n");
    const externalPlugins = path.join(temporaryRoot, "external-install-target");
    await mkdir(externalPlugins, { recursive: true });
    await writeFile(path.join(externalPlugins, "external-sentinel.txt"), "external install\n");

    await assert.rejects(() => buildSnapshots({
      repoRoot: fixtureRepo,
      mode: "clean",
      operations: {
        beforeRootInstall: async () => {
          await symlink(externalPlugins, path.join(fixtureRepo, "plugins"));
        },
      },
    }), /unexpected|symlink|plugins root/i);

    assert.equal((await lstat(path.join(fixtureRepo, "plugins"))).isDirectory(), true);
    assert.equal(await readFile(path.join(externalPlugins, "external-sentinel.txt"), "utf8"), "external install\n");
    for (const productName of productNames) {
      assert.equal(await readFile(path.join(fixtureRepo, "plugins", productName, "IRREPLACEABLE.txt"), "utf8"), `${productName} original\n`);
    }
    assert.equal(await readFile(unrelated, "utf8"), "unrelated original\n");
  });

  await t.test("late empty plugins directory cannot capture child installs", async (t) => {
    const { fixtureRepo } = await createSnapshotFixture(t);
    for (const productName of productNames) {
      const destination = path.join(fixtureRepo, "plugins", productName);
      await mkdir(destination, { recursive: true });
      await writeFile(path.join(destination, "IRREPLACEABLE.txt"), `${productName} original\n`);
    }
    const displacedPlugins = path.join(fixtureRepo, "plugins-displaced");
    await assert.rejects(() => buildSnapshots({
      repoRoot: fixtureRepo,
      mode: "clean",
      operations: {
        beforeRootInstall: async () => {
          await fsRename(path.join(fixtureRepo, "plugins"), displacedPlugins);
          await mkdir(path.join(fixtureRepo, "plugins"));
        },
      },
    }), /plugins root|identity|visible/i);

    assert.deepEqual(await readdir(path.join(fixtureRepo, "plugins")), []);
    for (const productName of productNames) {
      assert.equal(
        await readFile(path.join(displacedPlugins, productName, "IRREPLACEABLE.txt"), "utf8"),
        `${productName} original\n`,
      );
    }
  });

  await t.test("root swapped immediately after worker spawn is rejected before child validation", async (t) => {
    const { fixtureRepo, temporaryRoot } = await createSnapshotFixture(t);
    for (const productName of productNames) {
      const destination = path.join(fixtureRepo, "plugins", productName);
      await mkdir(destination, { recursive: true });
      await writeFile(path.join(destination, "IRREPLACEABLE.txt"), `${productName} original\n`);
    }
    const displacedPlugins = path.join(fixtureRepo, "plugins-before-worker");
    const externalPlugins = path.join(temporaryRoot, "external-after-spawn");
    await mkdir(externalPlugins);
    await writeFile(path.join(externalPlugins, "sentinel.txt"), "external unchanged\n");
    await assert.rejects(() => buildSnapshots({
      repoRoot: fixtureRepo,
      mode: "clean",
      operations: {
        afterWorkerSpawn: async () => {
          await fsRename(path.join(fixtureRepo, "plugins"), displacedPlugins);
          await symlink(externalPlugins, path.join(fixtureRepo, "plugins"));
        },
      },
    }), /identity|worker|plugins root/i);
    assert.equal(await readFile(path.join(externalPlugins, "sentinel.txt"), "utf8"), "external unchanged\n");
    for (const productName of productNames) {
      assert.equal(
        await readFile(path.join(displacedPlugins, productName, "IRREPLACEABLE.txt"), "utf8"),
        `${productName} original\n`,
      );
    }
  });
});

test("snapshot replacement restores originals when a child install rename fails", async (t) => {
  const { fixtureRepo } = await createSnapshotFixture(t);
  for (const productName of productNames) {
    const destination = path.join(fixtureRepo, "plugins", productName);
    await mkdir(destination, { recursive: true });
    await writeFile(path.join(destination, "IRREPLACEABLE.txt"), `${productName} original\n`);
  }
  const error = await buildSnapshots({
    repoRoot: fixtureRepo,
    mode: "clean",
    operations: { faults: [{ phase: "install", productName: "game-design-studio", message: "injected child install failure" }] },
  })
    .then(() => undefined, (caught) => caught);
  assert.match(error.message, /injected child install failure/i);
  assert.equal(error.recovery.state, "fully-restored-recovery-retained");
  assert.equal(error.preserveStaging, true);
  for (const productName of productNames) {
    assert.equal(
      await readFile(path.join(fixtureRepo, "plugins", productName, "IRREPLACEABLE.txt"), "utf8"),
      `${productName} original\n`,
    );
  }
  await rm(error.recovery.recoveryRoot, { recursive: true, force: true });
  await rm(error.recovery.stagingRoot, { recursive: true, force: true });
});

test("snapshot worker interruption always restores or reports every original", async (t) => {
  async function runInterrupted(t, operations) {
    const { fixtureRepo } = await createSnapshotFixture(t);
    for (const productName of productNames) {
      const destination = path.join(fixtureRepo, "plugins", productName);
      await mkdir(destination, { recursive: true });
      await writeFile(path.join(destination, "IRREPLACEABLE.txt"), `${productName} original\n`);
    }
    const unrelated = path.join(fixtureRepo, "plugins/unrelated-private-plugin/sentinel.txt");
    await mkdir(path.dirname(unrelated), { recursive: true });
    await writeFile(unrelated, "external untouched\n");

    const error = await buildSnapshots({ repoRoot: fixtureRepo, mode: "clean", operations })
      .then(() => undefined, (caught) => caught);
    assert.equal(error?.preserveStaging, true);
    assert.match(error?.message ?? "", /SNAPSHOT_RECOVERY=/u);
    await assertCanonicalExisting(error?.recovery?.recoveryRoot);
    await assertCanonicalExisting(error?.recovery?.stagingRoot);
    assert.equal(await readFile(unrelated, "utf8"), "external untouched\n");
    for (const productName of productNames) {
      const product = error.recovery.products[productName];
      await assertCanonicalExisting(product.originalLocation);
      assert.equal(
        await readFile(path.join(product.originalLocation, "IRREPLACEABLE.txt"), "utf8"),
        `${productName} original\n`,
      );
    }
    await rm(error.recovery.recoveryRoot, { recursive: true, force: true });
    await rm(error.recovery.stagingRoot, { recursive: true, force: true });
  }

  const milestones = [
    ["afterBackup", "game-design-career"],
    ["afterBackup", "game-design-studio"],
    ["afterInstall", "game-design-career"],
    ["afterInstall", "game-design-studio"],
  ];
  for (const signal of ["SIGTERM", "SIGKILL"]) {
    for (const [phase, productName] of milestones) {
      await t.test(`${signal} ${phase} ${productName}`, async (t) => {
        await runInterrupted(t, {
          [phase]: ({ productName: currentProduct, workerPid }) => {
            if (currentProduct === productName) process.kill(workerPid, signal);
          },
        });
      });
    }
  }

  await t.test("phase callback never replies", async (t) => {
    await runInterrupted(t, {
      beforeRootInstall: () => new Promise(() => {}),
      deadlines: { phaseMs: 50, rollbackGraceMs: 500 },
    });
  });

  for (const action of ["malformed", "disconnect", "send-failure"]) {
    await t.test(`${action} IPC`, async (t) => {
      await runInterrupted(t, {
        protocolFaults: [{ action, phase: "afterBackup", productName: "game-design-career" }],
        deadlines: { rollbackGraceMs: 500 },
      });
    });
  }

  await t.test("displaced visible root after first backup still reports both originals after SIGKILL", async (t) => {
    const { fixtureRepo } = await createSnapshotFixture(t);
    for (const productName of productNames) {
      const destination = path.join(fixtureRepo, "plugins", productName);
      await mkdir(destination, { recursive: true });
      await writeFile(path.join(destination, "IRREPLACEABLE.txt"), `${productName} original\n`);
    }
    const unrelated = path.join(fixtureRepo, "plugins/unrelated-private-plugin/sentinel.txt");
    await mkdir(path.dirname(unrelated), { recursive: true });
    await writeFile(unrelated, "unrelated original\n");
    const displacedPlugins = path.join(fixtureRepo, "plugins-displaced-after-backup");
    let workerPid;
    const error = await buildSnapshots({
      repoRoot: fixtureRepo,
      mode: "clean",
      operations: {
        afterBackup: async ({ productName, workerPid: pid }) => {
          if (productName !== "game-design-career") return;
          workerPid = pid;
          await fsRename(path.join(fixtureRepo, "plugins"), displacedPlugins);
          await mkdir(path.join(fixtureRepo, "plugins"));
          process.kill(pid, "SIGKILL");
        },
      },
    }).then(() => undefined, (caught) => caught);
    assert.equal(error?.preserveStaging, true);
    assert.match(error?.message ?? "", /SNAPSHOT_RECOVERY=/u);
    await assertCanonicalExisting(error?.recovery?.recoveryRoot);
    await assertCanonicalExisting(error?.recovery?.stagingRoot);
    for (const productName of productNames) {
      const originalLocation = error.recovery.products[productName].originalLocation;
      await assertCanonicalExisting(originalLocation);
      assert.equal(await readFile(path.join(originalLocation, "IRREPLACEABLE.txt"), "utf8"), `${productName} original\n`);
    }
    assert.equal(await readFile(path.join(displacedPlugins, "unrelated-private-plugin/sentinel.txt"), "utf8"), "unrelated original\n");
    assert.deepEqual(await readdir(path.join(fixtureRepo, "plugins")), []);
    await assertProcessExited(workerPid);
    await rm(error.recovery.recoveryRoot, { recursive: true, force: true });
    await rm(error.recovery.stagingRoot, { recursive: true, force: true });
  });

  await t.test("afterWorkerSpawn never resolves but start deadline kills and reaps worker", async (t) => {
    const { fixtureRepo } = await createSnapshotFixture(t);
    for (const productName of productNames) {
      const destination = path.join(fixtureRepo, "plugins", productName);
      await mkdir(destination, { recursive: true });
      await writeFile(path.join(destination, "IRREPLACEABLE.txt"), `${productName} original\n`);
    }
    let workerPid;
    const error = await buildSnapshots({
      repoRoot: fixtureRepo,
      mode: "clean",
      operations: {
        afterWorkerSpawn: ({ workerPid: pid }) => {
          workerPid = pid;
          return new Promise(() => {});
        },
        deadlines: { startMs: 40, rollbackGraceMs: 40 },
      },
    }).then(() => undefined, (caught) => caught);
    assert.match(error?.message ?? "", /start timed out/i);
    assert.equal(error?.preserveStaging, true);
    assert.match(error?.message ?? "", /SNAPSHOT_RECOVERY=/u);
    await assertCanonicalExisting(error?.recovery?.recoveryRoot);
    await assertCanonicalExisting(error?.recovery?.stagingRoot);
    await assertProcessExited(workerPid);
    await rm(error.recovery.recoveryRoot, { recursive: true, force: true });
    await rm(error.recovery.stagingRoot, { recursive: true, force: true });
  });

  for (const [label, workerFaults, deadlines, expected] of [
    ["spawn", [{ phase: "spawn", action: "withhold" }], { spawnMs: 40 }, /spawn timed out/i],
    ["register", [{ phase: "register", action: "withhold" }], { registerMs: 40 }, /registration timed out/i],
    ["final", [{ phase: "final", action: "withhold" }], { finalMs: 40 }, /final result timed out/i],
  ]) {
    await t.test(`${label} never resolves but deadline kills and reaps worker`, async (t) => {
      const { fixtureRepo } = await createSnapshotFixture(t);
      for (const productName of productNames) {
        const destination = path.join(fixtureRepo, "plugins", productName);
        await mkdir(destination, { recursive: true });
        await writeFile(path.join(destination, "IRREPLACEABLE.txt"), `${productName} original\n`);
      }
      let workerPid;
      const error = await buildSnapshots({
        repoRoot: fixtureRepo,
        mode: "clean",
        operations: {
          afterFork: ({ workerPid: pid }) => { workerPid = pid; },
          workerFaults,
          deadlines: { ...deadlines, rollbackGraceMs: 40 },
        },
      }).then(() => undefined, (caught) => caught);
      assert.match(error?.message ?? "", expected);
      assert.equal(error?.preserveStaging, true);
      assert.match(error?.message ?? "", /SNAPSHOT_RECOVERY=/u);
      await assertCanonicalExisting(error?.recovery?.recoveryRoot);
      await assertCanonicalExisting(error?.recovery?.stagingRoot);
      await assertProcessExited(workerPid);
      await rm(error.recovery.recoveryRoot, { recursive: true, force: true }).catch(() => {});
      await rm(error.recovery.stagingRoot, { recursive: true, force: true });
    });
  }

  for (const action of ["malformed-registration", "missing-journal", "wrong-staging-registration", "wrong-product-journal"]) {
    await t.test(`${action} is rejected before registration ACK`, async (t) => {
      const { fixtureRepo } = await createSnapshotFixture(t);
      for (const productName of productNames) {
        const destination = path.join(fixtureRepo, "plugins", productName);
        await mkdir(destination, { recursive: true });
        await writeFile(path.join(destination, "IRREPLACEABLE.txt"), `${productName} original\n`);
      }
      const error = await buildSnapshots({
        repoRoot: fixtureRepo,
        mode: "clean",
        operations: {
          workerFaults: [{ phase: "register", action }],
          deadlines: { rollbackGraceMs: 40 },
        },
      }).then(() => undefined, (caught) => caught);
      assert.match(error?.message ?? "", /registration was rejected|malformed registration|journal/i);
      assert.equal(error?.preserveStaging, true);
      assert.match(error?.message ?? "", /SNAPSHOT_RECOVERY=/u);
      await assertCanonicalExisting(error?.recovery?.recoveryRoot);
      await assertCanonicalExisting(error?.recovery?.stagingRoot);
      await rm(error.recovery.recoveryRoot, { recursive: true, force: true }).catch(() => {});
      await rm(error.recovery.stagingRoot, { recursive: true, force: true });
    });
  }

  await t.test("actual process.send callback failure reports recovery and reaps worker", async (t) => {
    const { fixtureRepo } = await createSnapshotFixture(t);
    for (const productName of productNames) {
      const destination = path.join(fixtureRepo, "plugins", productName);
      await mkdir(destination, { recursive: true });
      await writeFile(path.join(destination, "IRREPLACEABLE.txt"), `${productName} original\n`);
    }
    let workerPid;
    const error = await buildSnapshots({
      repoRoot: fixtureRepo,
      mode: "clean",
      operations: {
        afterFork: ({ workerPid: pid }) => { workerPid = pid; },
        protocolFaults: [{ action: "send-callback-error", phase: "afterBackup", productName: "game-design-career" }],
        deadlines: { rollbackGraceMs: 40 },
      },
    }).then(() => undefined, (caught) => caught);
    assert.match(error?.message ?? "", /send callback|phase reply failed|worker/i);
    assert.equal(error?.preserveStaging, true);
    assert.match(error?.message ?? "", /SNAPSHOT_RECOVERY=/u);
    await assertCanonicalExisting(error?.recovery?.recoveryRoot);
    await assertProcessExited(workerPid);
    await rm(error.recovery.recoveryRoot, { recursive: true, force: true });
    await rm(error.recovery.stagingRoot, { recursive: true, force: true });
  });
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

  for (const phase of ["backup", "install"]) {
    await t.test(`${phase} child rename failure`, async (t) => {
      const { fixtureRepo } = await fixtureWithOriginals(t);
      const error = await buildSnapshots({
        repoRoot: fixtureRepo,
        mode: "clean",
        operations: {
          faults: [{ phase, productName: "game-design-career", message: `injected ${phase} child rename` }],
        },
      }).then(() => undefined, (caught) => caught);
      assert.match(error.message, new RegExp(`injected ${phase} child rename`, "i"));
      assert.equal(error.recovery.state, "fully-restored-recovery-retained");
      assert.equal(error.preserveStaging, true);
      for (const productName of productNames) {
        assert.equal(await readFile(path.join(fixtureRepo, "plugins", productName, "IRREPLACEABLE.txt"), "utf8"), `${productName} original\n`);
      }
      await rm(error.recovery.recoveryRoot, { recursive: true, force: true });
      await rm(error.recovery.stagingRoot, { recursive: true, force: true });
    });
  }

  await t.test("installed child quarantine failure", async (t) => {
    const { fixtureRepo } = await fixtureWithOriginals(t);
    const error = await buildSnapshots({
      repoRoot: fixtureRepo,
      mode: "clean",
      operations: {
        beforeRootInstall: async ({ stagedPluginsRoot }) => {
          await writeFile(path.join(stagedPluginsRoot, "game-design-career/post-audit-mutation.txt"), "trigger rollback\n");
        },
        faults: [{ phase: "quarantine", productName: "game-design-career", message: "injected installed child quarantine failure" }],
      },
    }).then(() => undefined, (caught) => caught);

    assert.equal(error?.recovery?.state, "rollback-incomplete");
    assert.match(error.message, /SNAPSHOT_RECOVERY=/u);
    assert.deepEqual(Object.keys(error.recovery.products), productNames);
    const career = error.recovery.products["game-design-career"];
    const studio = error.recovery.products["game-design-studio"];
    assert.equal(career.status, "recovery-required");
    assert.equal(studio.status, "restored");
    await assertCanonicalExisting(career.originalLocation);
    await assertCanonicalExisting(career.backupLocation);
    await assertCanonicalExisting(career.installedSnapshotLocation);
    assert.equal(career.originalLocation, career.backupLocation);
    assert.match(career.manualAction, /remove.*installed.*restore|restore.*backup/i);
    await assertCanonicalExisting(studio.originalLocation);
    assert.equal(studio.backupLocation, null);
    assert.equal(studio.installedSnapshotLocation, null);
    assert.match(studio.manualAction, /no manual recovery required/i);
    assert.equal(await readFile(path.join(career.originalLocation, "IRREPLACEABLE.txt"), "utf8"), "game-design-career original\n");
    assert.equal(await readFile(path.join(studio.originalLocation, "IRREPLACEABLE.txt"), "utf8"), "game-design-studio original\n");
    await rm(error.recovery.recoveryRoot, { recursive: true, force: true });
    await rm(error.recovery.stagingRoot, { recursive: true, force: true });
  });

  await t.test("backup restore failure", async (t) => {
    const { fixtureRepo } = await fixtureWithOriginals(t);
    const error = await buildSnapshots({
      repoRoot: fixtureRepo,
      mode: "clean",
      operations: {
        faults: [
          { phase: "install", productName: "game-design-career", message: "trigger restore rollback" },
          { phase: "restore", productName: "game-design-career", message: "injected restore failure" },
        ],
      },
    }).then(() => undefined, (caught) => caught);

    assert.equal(error?.recovery?.state, "rollback-incomplete");
    const career = error.recovery.products["game-design-career"];
    const studio = error.recovery.products["game-design-studio"];
    assert.equal(career.status, "recovery-required");
    await assertCanonicalExisting(career.originalLocation);
    assert.equal(career.originalLocation, career.backupLocation);
    assert.equal(career.installedSnapshotLocation, null);
    assert.match(career.manualAction, /restore.*backup/i);
    assert.equal(studio.status, "restored");
    await assertCanonicalExisting(studio.originalLocation);
    assert.equal(studio.backupLocation, null);
    assert.equal(studio.installedSnapshotLocation, null);
    assert.equal(await readFile(path.join(career.originalLocation, "IRREPLACEABLE.txt"), "utf8"), "game-design-career original\n");
    assert.equal(await readFile(path.join(studio.originalLocation, "IRREPLACEABLE.txt"), "utf8"), "game-design-studio original\n");
    await rm(error.recovery.recoveryRoot, { recursive: true, force: true });
    await rm(error.recovery.stagingRoot, { recursive: true, force: true });
  });

  await t.test("committed backup is retained without destructive current cleanup", async (t) => {
    const { fixtureRepo } = await fixtureWithOriginals(t);
    const builds = await buildSnapshots({ repoRoot: fixtureRepo, mode: "clean" });

    assert.equal(builds.recovery.state, "committed-recovery-retained");
    for (const productName of productNames) {
      const product = builds.recovery.products[productName];
      assert.equal(product.status, "installed");
      await assertCanonicalExisting(product.originalLocation);
      await assertCanonicalExisting(product.backupLocation);
      await assertCanonicalExisting(product.installedSnapshotLocation);
      assert.equal(product.originalLocation, product.backupLocation);
      assert.match(product.manualAction, /verify.*installed.*remove.*backup/i);
      assert.equal(await readFile(path.join(product.originalLocation, "IRREPLACEABLE.txt"), "utf8"), `${productName} original\n`);
    }
    await rm(builds.recovery.recoveryRoot, { recursive: true, force: true });
  });

  await t.test("fully restored recovery cleanup failure", async (t) => {
    const { fixtureRepo } = await fixtureWithOriginals(t);
    const error = await buildSnapshots({
      repoRoot: fixtureRepo,
      mode: "clean",
      operations: {
        faults: [
          { phase: "install", productName: "game-design-career", message: "trigger fully restored rollback" },
          { phase: "cleanup", message: "injected restored cleanup failure" },
        ],
      },
    }).then(() => undefined, (caught) => caught);

    assert.equal(error?.recovery?.state, "fully-restored-cleanup-partial");
    for (const productName of productNames) {
      const product = error.recovery.products[productName];
      assert.equal(product.status, "restored");
      await assertCanonicalExisting(product.originalLocation);
      assert.equal(product.backupLocation, null);
      assert.equal(product.installedSnapshotLocation, null);
      assert.match(product.manualAction, /no manual recovery required/i);
    }
    await assertCanonicalExisting(error.recovery.recoveryRoot);
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
