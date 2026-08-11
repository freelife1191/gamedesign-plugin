import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { cp, lstat, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { buildProduct } from "../../tooling/lib/build-product.mjs";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const updaterUrl = new URL("../../tooling/sync-diagram-skills.mjs", import.meta.url);
const productNames = ["game-design-studio", "game-design-career"];

const EXPECTED = Object.freeze({
  skillstead: Object.freeze({
    root: "shared/vendor/skillstead",
    treeRoot: "svg-infographic/0.9.0",
    files: 55,
    treeDigest: "36ea6022bdc2d534fd54cc239c96eb739bac82618ba88ee49e2d8265f232337b",
    lock: Object.freeze({
      schemaVersion: 1,
      upstream: Object.freeze({
        repository: "https://github.com/kyungseo/skillstead",
        tag: "svg-infographic/v0.9.0",
        commit: "6e5b850f66716af9eb3c6a79f60e4f8ff5716dee",
        releasedAt: "2026-08-08T16:41:59Z",
        skillPath: "skills/svg-infographic",
      }),
      license: Object.freeze({
        spdx: "Apache-2.0",
        path: "LICENSE.txt",
        sha256: "4739c79c8017b90a46ab26f8972fd4ac56c9ea459b89bf9671359b462f62a4a6",
      }),
    }),
    requiredRuntimePaths: Object.freeze([
      "SKILL.md",
      "scripts/check-svg.mjs",
      "scripts/render.mjs",
      "scripts/render.sh",
      "references/authoring.md",
    ]),
  }),
  archify: Object.freeze({
    root: "shared/vendor/archify",
    treeRoot: "archify/2.13.0",
    files: 60,
    treeDigest: "695f85131e0f0313d83046380ea308a3e93566a0289dbe7ccba23638082b62ea",
    lock: Object.freeze({
      schemaVersion: 1,
      upstream: Object.freeze({
        repository: "https://github.com/tt-a1i/archify",
        tag: "v2.13.0",
        commit: "2c1f8ac2ca28a26d0b68043ec80c9554e20ff0e3",
        releasedAt: "2026-08-03T02:33:34Z",
        releaseAsset: Object.freeze({
          name: "archify.zip",
          url: "https://github.com/tt-a1i/archify/releases/download/v2.13.0/archify.zip",
          sha256: "9aca2bc07812cbef2a7c177f4d3ef74669814c980621daea6e0fd9ee7ed8fd21",
        }),
        skillPath: "archify",
      }),
      license: Object.freeze({
        spdx: "MIT",
        path: "LICENSE",
        sha256: "2f724fa953b4eaa8ec75fa56919ce474b57adce54d2456a3791510bc53735cbd",
      }),
    }),
    requiredRuntimePaths: Object.freeze([
      "SKILL.md",
      "bin/archify.mjs",
      "assets/template.html",
      "renderers/shared/generated-validators.mjs",
      "renderers/architecture/render-architecture.mjs",
      "renderers/workflow/render-workflow.mjs",
      "renderers/sequence/render-sequence.mjs",
      "renderers/dataflow/render-dataflow.mjs",
      "renderers/lifecycle/render-lifecycle.mjs",
      "schemas/architecture.schema.json",
      "schemas/workflow.schema.json",
      "schemas/sequence.schema.json",
      "schemas/dataflow.schema.json",
      "schemas/lifecycle.schema.json",
    ]),
  }),
});

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

async function listRegularFiles(root, prefix = "") {
  const entries = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
    const absolutePath = path.join(root, entry.name);
    const stats = await lstat(absolutePath);
    assert.equal(stats.isSymbolicLink(), false, `symlink is forbidden: ${relativePath}`);
    if (stats.isDirectory()) entries.push(...await listRegularFiles(absolutePath, relativePath));
    else {
      assert.equal(stats.isFile(), true, `regular file required: ${relativePath}`);
      const bytes = await readFile(absolutePath);
      entries.push({ path: relativePath, size: bytes.length, sha256: sha256(bytes) });
    }
  }
  return entries.sort((left, right) => left.path.localeCompare(right.path));
}

function normalizedFiles(files) {
  return files.map(({ path: relativePath, size, sha256: digest }) => ({ path: relativePath, size, sha256: digest }));
}

function expectedLockShape(contract) {
  return {
    schemaVersion: contract.lock.schemaVersion,
    upstream: contract.lock.upstream,
    license: contract.lock.license,
    tree: { root: contract.treeRoot },
  };
}

async function assertVendorClosure(name, root = path.join(repoRoot, EXPECTED[name].root)) {
  const contract = EXPECTED[name];
  const lock = JSON.parse(await readFile(path.join(root, "vendor.lock.json"), "utf8"));
  assert.deepEqual({ ...lock, tree: { root: lock.tree?.root } }, expectedLockShape(contract), `${name}: pinned release identity`);
  assert.ok(Array.isArray(lock.tree?.files), `${name}: vendor lock declares the complete file closure`);
  const declared = normalizedFiles(lock.tree.files).sort((left, right) => left.path.localeCompare(right.path));
  assert.equal(declared.length, contract.files, `${name}: exact file count`);
  assert.equal(sha256(JSON.stringify(declared)), contract.treeDigest, `${name}: exact path, byte-size, and SHA-256 closure`);

  const tree = path.join(root, contract.treeRoot);
  const actual = normalizedFiles(await listRegularFiles(tree));
  assert.deepEqual(actual, declared, `${name}: vendor bytes exactly match the lock without additions`);
  for (const required of contract.requiredRuntimePaths) {
    assert.ok(actual.some((entry) => entry.path === required), `${name}: runtime closure retains ${required}`);
  }

  const rootFiles = await listRegularFiles(root);
  const expectedPaths = ["THIRD_PARTY_NOTICES.md", "vendor.lock.json", ...actual.map(({ path: relativePath }) => `${contract.treeRoot}/${relativePath}`)].sort((left, right) => left.localeCompare(right));
  assert.deepEqual(rootFiles.map(({ path: relativePath }) => relativePath), expectedPaths, `${name}: vendor root has no extra or executable updater`);
  const notices = await readFile(path.join(root, "THIRD_PARTY_NOTICES.md"), "utf8");
  for (const literal of [contract.lock.upstream.repository, contract.lock.upstream.tag, contract.lock.license.spdx, contract.lock.license.sha256]) {
    assert.ok(notices.includes(literal), `${name}: third-party notice preserves ${literal}`);
  }
}

async function copiedVendor(t, name) {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), `diagram-vendor-${name}-`));
  t.after(() => rm(temporaryRoot, { recursive: true, force: true }));
  const destination = path.join(temporaryRoot, name);
  await cp(path.join(repoRoot, EXPECTED[name].root), destination, { recursive: true });
  return destination;
}

async function copiedVendorWorkspace(t, name) {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), `diagram-vendor-workspace-${name}-`));
  t.after(() => rm(temporaryRoot, { recursive: true, force: true }));
  const vendorRoot = path.join(temporaryRoot, "shared/vendor", name);
  await cp(path.join(repoRoot, EXPECTED[name].root), vendorRoot, { recursive: true });
  return { workspaceRoot: temporaryRoot, vendorRoot };
}

async function loadUpdaterOrFail() {
  assert.equal(existsSync(fileURLToPath(updaterUrl)), true, "diagram skill updater must exist before its behavior is evaluated");
  return import(updaterUrl.href);
}

test("Skillstead v0.9.0 vendor lock pins the official Apache-2.0 exact 55-file runtime closure", async () => {
  await assertVendorClosure("skillstead");
});

test("Archify v2.13.0 vendor lock pins the release asset and MIT exact 60-file runtime closure", async () => {
  await assertVendorClosure("archify");
});

test("offline diagram vendor verifier rejects a changed payload byte, symlink, and extra updater", async (t) => {
  if (!existsSync(fileURLToPath(updaterUrl))) {
    await loadUpdaterOrFail();
    return;
  }
  const { verifyDiagramSkillVendor } = await loadUpdaterOrFail();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("offline verification must not use network"); };
  try {
    for (const [name, mutation, expected] of [
      ["skillstead", async (root) => writeFile(path.join(root, EXPECTED.skillstead.treeRoot, "SKILL.md"), "tampered\n"), { code: "DIAGRAM_VENDOR_FILE_HASH_MISMATCH", path: "svg-infographic/0.9.0/SKILL.md" }],
      ["archify", async (root) => { const target = path.join(root, EXPECTED.archify.treeRoot, "schemas/common.schema.json"); await rm(target); await symlink("architecture.schema.json", target); }, { code: "DIAGRAM_VENDOR_SYMLINK", path: "archify/2.13.0/schemas/common.schema.json" }],
      ["archify", async (root) => writeFile(path.join(root, EXPECTED.archify.treeRoot, "bin/unreviewed-update.mjs"), "export {};\n"), { code: "DIAGRAM_VENDOR_UNREGISTERED_FILE", path: "archify/2.13.0/bin/unreviewed-update.mjs" }],
    ]) {
      const root = await copiedVendor(t, name);
      await mutation(root);
      await assert.rejects(verifyDiagramSkillVendor({ root, name }), (error) => {
        assert.deepEqual({ code: error.code, path: error.path }, expected);
        return true;
      });
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("diagram vendor updater keeps check offline and latest/update explicit", async () => {
  if (!existsSync(fileURLToPath(updaterUrl))) {
    await loadUpdaterOrFail();
    return;
  }
  const { parseDiagramSkillUpdaterArgs } = await loadUpdaterOrFail();
  assert.deepEqual(parseDiagramSkillUpdaterArgs(["--check"]), { mode: "check", network: false, skill: "all" });
  assert.deepEqual(parseDiagramSkillUpdaterArgs(["--check-latest"]), { mode: "check-latest", network: true, skill: "all" });
  assert.deepEqual(parseDiagramSkillUpdaterArgs(["--update", "archify"]), { mode: "update", network: true, skill: "archify" });
});

test("injected latest check is read-only and injected update atomically stages a verified future closure", async (t) => {
  const { checkLatestDiagramSkills, updateDiagramSkill, verifyDiagramSkillVendor } = await loadUpdaterOrFail();
  const { workspaceRoot, vendorRoot } = await copiedVendorWorkspace(t, "archify");
  const before = await readFile(path.join(vendorRoot, "vendor.lock.json"));
  const futureRelease = { tag: "v2.13.1", commit: "1".repeat(40), releasedAt: "2026-08-12T00:00:00Z" };
  const latest = await checkLatestDiagramSkills({
    root: workspaceRoot,
    skill: "archify",
    fetchRelease: async ({ name, repository }) => {
      assert.equal(name, "archify");
      assert.equal(repository, "https://github.com/tt-a1i/archify");
      return futureRelease;
    },
  });
  assert.deepEqual(latest, [{ name: "archify", status: "outdated", installedTag: "v2.13.0", latestTag: "v2.13.1", updateAvailable: true }]);
  assert.deepEqual(await readFile(path.join(vendorRoot, "vendor.lock.json")), before, "latest check never changes the installed vendor");

  const lock = JSON.parse(before);
  const archive = {
    files: await Promise.all(lock.tree.files.map(async ({ path: relativePath }) => ({
      path: relativePath,
      bytes: await readFile(path.join(vendorRoot, lock.tree.root, relativePath)),
    }))),
  };
  const stagingRoot = path.join(path.dirname(vendorRoot), "archify-stage");
  const result = await updateDiagramSkill({
    root: vendorRoot,
    name: "archify",
    stagingRoot,
    fetchRelease: async () => futureRelease,
    fetchArchive: async (release) => {
      assert.deepEqual(release, futureRelease);
      return archive;
    },
  });
  assert.deepEqual(result, { name: "archify", tag: "v2.13.1", verifiedFiles: 60 });
  const updated = JSON.parse(await readFile(path.join(vendorRoot, "vendor.lock.json"), "utf8"));
  assert.equal(updated.upstream.tag, "v2.13.1");
  assert.equal(updated.tree.root, "archify/2.13.1");
  assert.deepEqual(await verifyDiagramSkillVendor({ root: vendorRoot, name: "archify" }), result);
});

test("both product builds retain both direct skills and their complete local runtime closures", async (t) => {
  for (const productName of productNames) {
    const stagingRoot = await mkdtemp(path.join(tmpdir(), "diagram-skill-package-"));
    t.after(() => rm(stagingRoot, { recursive: true, force: true }));
    const build = await buildProduct({ repoRoot, productName, stagingRoot, sourceDateEpoch: 0 });
    for (const [name, contract] of Object.entries(EXPECTED)) {
      const packagePrefix = name === "skillstead" ? "skills/svg-infographic" : "skills/archify";
      const paths = build.files.filter((file) => file.startsWith(`${packagePrefix}/`));
      assert.equal(paths.length, contract.files, `${productName}: ${name} direct discovery includes every vendored runtime file`);
      assert.ok(paths.includes(`${packagePrefix}/SKILL.md`), `${productName}: ${name} direct discovery entry`);
      for (const required of contract.requiredRuntimePaths) assert.ok(paths.includes(`${packagePrefix}/${required}`), `${productName}: ${name} local runtime closure ${required}`);
    }
    assert.equal(build.files.some((file) => file.endsWith("sync-diagram-skills.mjs")), false, `${productName}: updater is never shipped in a plugin package`);
    const routing = JSON.parse(await readFile(path.join(repoRoot, "products", productName, "plugin/references/routing.json"), "utf8"));
    assert.ok(routing.skillIds.includes("archify"), `${productName}: natural-language orchestration can choose Archify`);
  }
});
