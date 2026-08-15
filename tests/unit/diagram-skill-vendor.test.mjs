import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { cp, lstat, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { buildProduct } from "../../tooling/lib/build-product.mjs";
import { loadVendorComponents } from "../../tooling/lib/vendor-components.mjs";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const updaterUrl = new URL("../../tooling/sync-diagram-skills.mjs", import.meta.url);
const productNames = ["game-design-studio", "game-design-career"];
const installedVendorComponents = new Map(loadVendorComponents({ repoRoot }).map((component) => [component.id, component]));
const vendorTreeRoot = (id) => installedVendorComponents.get(id).sourceRoot.slice(`shared/vendor/${id}/`.length);

const EXPECTED = Object.freeze({
  skillstead: Object.freeze({
    root: "shared/vendor/skillstead",
    treeRoot: vendorTreeRoot("skillstead"),
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
    treeRoot: vendorTreeRoot("archify"),
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
const gitBlobSha = (value) => createHash("sha1").update(`blob ${Buffer.byteLength(value)}\0`).update(value).digest("hex");

function storedZip(files) {
  const localEntries = [];
  const centralEntries = [];
  let offset = 0;
  for (const { path: filename, bytes, externalAttributes = 0 } of files) {
    const name = Buffer.from(filename, "utf8");
    const content = Buffer.from(bytes);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt32LE(content.length, 18);
    local.writeUInt32LE(content.length, 22);
    local.writeUInt16LE(name.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt32LE(content.length, 20);
    central.writeUInt32LE(content.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(externalAttributes >>> 0, 38);
    central.writeUInt32LE(offset, 42);
    localEntries.push(local, name, content);
    centralEntries.push(central, name);
    offset += local.length + name.length + content.length;
  }
  const central = Buffer.concat(centralEntries);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(central.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...localEntries, central, end]);
}

async function vendorState(root, name) {
  const lock = await readFile(path.join(root, "vendor.lock.json"));
  const notices = await readFile(path.join(root, "THIRD_PARTY_NOTICES.md"));
  const tree = await listRegularFiles(path.join(root, EXPECTED[name].treeRoot));
  return { lock, notices, tree };
}

async function writeRecoveryBackups(root) {
  await writeFile(path.join(root, ".vendor-update-lock-backup.json"), await readFile(path.join(root, "vendor.lock.json")));
  await writeFile(path.join(root, ".vendor-update-notices-backup.md"), await readFile(path.join(root, "THIRD_PARTY_NOTICES.md")));
}

async function archiveFilesForVendor(root, name, mutate = (files) => files) {
  const lock = JSON.parse(await readFile(path.join(root, "vendor.lock.json"), "utf8"));
  const files = await Promise.all(lock.tree.files.map(async ({ path: relativePath }) => ({
    path: relativePath,
    bytes: await readFile(path.join(root, lock.tree.root, relativePath)),
  })));
  return mutate(files);
}

async function rawArchiveForVendor(root, name, mutate) {
  const prefix = name === "skillstead" ? "skillstead-commit/skills/svg-infographic/" : "archify/";
  return storedZip((await archiveFilesForVendor(root, name, mutate)).map((file) => ({ ...file, path: `${prefix}${file.path}` })));
}

async function officialTreeForVendor(root, name) {
  return (await archiveFilesForVendor(root, name)).map((file) => ({ path: file.path, sha: gitBlobSha(file.bytes) }));
}

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
      ["skillstead", async (root) => writeFile(path.join(root, EXPECTED.skillstead.treeRoot, "SKILL.md"), "tampered\n"), { code: "DIAGRAM_VENDOR_FILE_HASH_MISMATCH", path: `${EXPECTED.skillstead.treeRoot}/SKILL.md` }],
      ["archify", async (root) => { const target = path.join(root, EXPECTED.archify.treeRoot, "schemas/common.schema.json"); await rm(target); await symlink("architecture.schema.json", target); }, { code: "DIAGRAM_VENDOR_SYMLINK", path: `${EXPECTED.archify.treeRoot}/schemas/common.schema.json` }],
      ["archify", async (root) => writeFile(path.join(root, EXPECTED.archify.treeRoot, "bin/unreviewed-update.mjs"), "export {};\n"), { code: "DIAGRAM_VENDOR_UNREGISTERED_FILE", path: `${EXPECTED.archify.treeRoot}/bin/unreviewed-update.mjs` }],
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

test("recovery rejects malformed, escaping, and symlinked journals without changing the active closure", async (t) => {
  const { recoverDiagramSkillVendor } = await loadUpdaterOrFail();
  const valid = {
    schemaVersion: 2,
    name: "archify",
    oldRoot: "archify/2.13.0",
    newRoot: "archify/2.13.1",
    ownerNonce: "a".repeat(32),
    lockBackup: ".vendor-update-lock-backup.json",
    noticesBackup: ".vendor-update-notices-backup.md",
  };
  for (const [label, journal] of [
    ["wrong-schema", { ...valid, schemaVersion: 1 }],
    ["traversal", { ...valid, oldRoot: "../escape" }],
    ["absolute", { ...valid, newRoot: "/tmp/escape" }],
  ]) {
    const { vendorRoot } = await copiedVendorWorkspace(t, "archify");
    const before = await vendorState(vendorRoot, "archify");
    const journalPath = path.join(vendorRoot, ".vendor-update.json");
    await writeFile(journalPath, `${JSON.stringify(journal)}\n`);
    await assert.rejects(recoverDiagramSkillVendor({ root: vendorRoot, name: "archify" }), (error) => error.code === "DIAGRAM_VENDOR_RECOVERY_JOURNAL_INVALID", label);
    assert.deepEqual(await vendorState(vendorRoot, "archify"), before, `${label}: active closure remains byte-identical`);
    assert.equal(await readFile(journalPath, "utf8"), `${JSON.stringify(journal)}\n`, `${label}: invalid journal remains evidence`);
  }

  const { vendorRoot } = await copiedVendorWorkspace(t, "archify");
  const before = await vendorState(vendorRoot, "archify");
  const journalPath = path.join(vendorRoot, ".vendor-update.json");
  const external = path.join(path.dirname(vendorRoot), "external-journal.json");
  await writeFile(external, `${JSON.stringify(valid)}\n`);
  await symlink(external, journalPath);
  await assert.rejects(recoverDiagramSkillVendor({ root: vendorRoot, name: "archify" }), (error) => error.code === "DIAGRAM_VENDOR_RECOVERY_JOURNAL_INVALID");
  assert.deepEqual(await vendorState(vendorRoot, "archify"), before, "symlink journal: active closure remains byte-identical");
  assert.equal((await lstat(journalPath)).isSymbolicLink(), true, "symlink journal is never unlinked by recovery");

  const noOwner = await copiedVendorWorkspace(t, "archify");
  const noOwnerBefore = await vendorState(noOwner.vendorRoot, "archify");
  await writeFile(path.join(noOwner.vendorRoot, ".vendor-update.json"), `${JSON.stringify(valid)}\n`);
  await assert.rejects(recoverDiagramSkillVendor({ root: noOwner.vendorRoot, name: "archify" }), (error) => error.code === "DIAGRAM_VENDOR_RECOVERY_OWNER_REQUIRED");
  assert.deepEqual(await vendorState(noOwner.vendorRoot, "archify"), noOwnerBefore, "missing owner never authorizes recovery");
});

test("a live operation owner blocks recovery and never lets a verifier delete its candidate tree", async (t) => {
  const { recoverDiagramSkillVendor, verifyDiagramSkillVendor } = await loadUpdaterOrFail();
  const { vendorRoot } = await copiedVendorWorkspace(t, "archify");
  const before = await vendorState(vendorRoot, "archify");
  const lockRoot = path.join(vendorRoot, ".vendor-operation.lock");
  await mkdir(lockRoot);
  await writeFile(path.join(lockRoot, "owner.json"), `${JSON.stringify({ schemaVersion: 1, name: "archify", nonce: "b".repeat(32), startedAt: new Date().toISOString() })}\n`);
  await writeFile(path.join(vendorRoot, ".vendor-update.json"), `${JSON.stringify({ schemaVersion: 2, name: "archify", oldRoot: "archify/2.13.0", newRoot: "archify/2.13.1", ownerNonce: "b".repeat(32), lockBackup: ".vendor-update-lock-backup.json", noticesBackup: ".vendor-update-notices-backup.md" })}\n`);
  await mkdir(path.join(vendorRoot, "archify/2.13.1"), { recursive: true });
  await writeFile(path.join(vendorRoot, "archify/2.13.1", "candidate.txt"), "do not delete");
  for (const operation of [recoverDiagramSkillVendor, verifyDiagramSkillVendor]) {
    await assert.rejects(operation({ root: vendorRoot, name: "archify" }), (error) => error.code === "DIAGRAM_VENDOR_OPERATION_ACTIVE");
  }
  assert.deepEqual(await vendorState(vendorRoot, "archify"), before, "live owner cannot change active closure");
  assert.equal(await readFile(path.join(vendorRoot, "archify/2.13.1", "candidate.txt"), "utf8"), "do not delete");
});

test("raw archives are verified internally against independent release metadata before staging", async (t) => {
  const { updateDiagramSkill } = await loadUpdaterOrFail();
  const { vendorRoot } = await copiedVendorWorkspace(t, "archify");
  const before = await vendorState(vendorRoot, "archify");
  const stagingRoot = path.join(path.dirname(vendorRoot), "malicious-raw-stage");
  const malicious = storedZip([
    { path: "archify/SKILL.md", bytes: Buffer.from("malicious\n") },
    { path: "archify/LICENSE", bytes: Buffer.from("fake license\n") },
    { path: "archify/bin/ordinary-extra.mjs", bytes: Buffer.from("export {};\n") },
  ]);
  await assert.rejects(
    updateDiagramSkill({
      root: vendorRoot,
      name: "archify",
      stagingRoot,
      fetchRelease: async () => ({
        tag: "v2.13.1",
        releasedAt: "2026-08-12T00:00:00Z",
        releaseAsset: { name: "archify.zip", url: "https://github.com/tt-a1i/archify/releases/download/v2.13.1/archify.zip", sha256: sha256(Buffer.from("independent official asset")) },
      }),
      resolveTagCommit: async () => "2".repeat(40),
      fetchArchive: async () => malicious,
    }),
    (error) => error.code === "DIAGRAM_VENDOR_ARCHIVE_HASH_MISMATCH",
  );
  assert.deepEqual(await vendorState(vendorRoot, "archify"), before, "matching caller claims cannot self-sign a malicious raw payload");
  assert.equal(existsSync(stagingRoot), false, "unverified bytes never create a staging tree");
});

test("immutable Skillstead tree and ZIP metadata reject ordinary extras and symlinks before staging", async (t) => {
  const { updateDiagramSkill } = await loadUpdaterOrFail();
  for (const [label, rawFactory, expectedCode] of [
    [
      "ordinary-extra",
      async (vendorRoot) => rawArchiveForVendor(vendorRoot, "skillstead", (files) => [...files, { path: "notes/ordinary-extra.txt", bytes: Buffer.from("not in official tree\n") }]),
      "DIAGRAM_VENDOR_ARCHIVE_TREE_MISMATCH",
    ],
    [
      "symlink-metadata",
      async (vendorRoot) => {
        const files = await archiveFilesForVendor(vendorRoot, "skillstead");
        return storedZip([
          ...files.map((file) => ({ ...file, path: `skillstead-commit/skills/svg-infographic/${file.path}` })),
          { path: "skillstead-commit/skills/svg-infographic/notes/link", bytes: Buffer.from("SKILL.md"), externalAttributes: 0o120777 << 16 },
        ]);
      },
      "DIAGRAM_VENDOR_ARCHIVE_SYMLINK",
    ],
  ]) {
    const { vendorRoot } = await copiedVendorWorkspace(t, "skillstead");
    const before = await vendorState(vendorRoot, "skillstead");
    const stagingRoot = path.join(path.dirname(vendorRoot), `${label}-stage`);
    await assert.rejects(
      updateDiagramSkill({
        root: vendorRoot,
        name: "skillstead",
        stagingRoot,
        fetchRelease: async () => ({ tag: "svg-infographic/v0.9.1", releasedAt: "2026-08-12T00:00:00Z" }),
        resolveTagCommit: async () => "2".repeat(40),
        fetchOfficialTree: async () => officialTreeForVendor(vendorRoot, "skillstead"),
        fetchArchive: async () => rawFactory(vendorRoot),
      }),
      (error) => error.code === expectedCode,
      label,
    );
    assert.deepEqual(await vendorState(vendorRoot, "skillstead"), before, `${label}: active closure remains byte-identical`);
    assert.equal(existsSync(stagingRoot), false, `${label}: rejected bytes never create a staging tree`);
  }
});

test("only a stale owner may be recovered, and recovery leaves the valid active root intact", async (t) => {
  const { recoverDiagramSkillVendor, verifyDiagramSkillVendor } = await loadUpdaterOrFail();
  const { vendorRoot } = await copiedVendorWorkspace(t, "archify");
  const before = await vendorState(vendorRoot, "archify");
  const lockRoot = path.join(vendorRoot, ".vendor-operation.lock");
  await mkdir(lockRoot);
  await writeFile(path.join(lockRoot, "owner.json"), `${JSON.stringify({ schemaVersion: 1, name: "archify", nonce: "c".repeat(32), startedAt: "2000-01-01T00:00:00.000Z" })}\n`);
  await writeRecoveryBackups(vendorRoot);
  await writeFile(path.join(vendorRoot, ".vendor-update.json"), `${JSON.stringify({ schemaVersion: 2, name: "archify", oldRoot: "archify/2.13.0", newRoot: "archify/2.13.1", ownerNonce: "c".repeat(32), lockBackup: ".vendor-update-lock-backup.json", noticesBackup: ".vendor-update-notices-backup.md" })}\n`);
  await mkdir(path.join(vendorRoot, "archify/2.13.1"), { recursive: true });
  await writeFile(path.join(vendorRoot, "archify/2.13.1", "candidate.txt"), "discard stale candidate");
  assert.equal(await recoverDiagramSkillVendor({ root: vendorRoot, name: "archify", now: Date.parse("2000-01-01T00:10:00.000Z") }), true);
  assert.equal(existsSync(lockRoot), false, "stale lock is removed only after its owner schema is verified");
  assert.equal(existsSync(path.join(vendorRoot, "archify/2.13.1")), false, "only stale inactive tree is removed");
  assert.deepEqual(await vendorState(vendorRoot, "archify"), before, "active closure is retained exactly");
  await verifyDiagramSkillVendor({ root: vendorRoot, name: "archify" });
});

test("an interleaving verifier is excluded while an updater owns the candidate transition", async (t) => {
  const { updateDiagramSkill, verifyDiagramSkillVendor } = await loadUpdaterOrFail();
  const { vendorRoot } = await copiedVendorWorkspace(t, "archify");
  const rawArchive = await rawArchiveForVendor(vendorRoot, "archify");
  let archiveRequested;
  let releaseArchive;
  const entered = new Promise((resolve) => { archiveRequested = resolve; });
  const release = new Promise((resolve) => { releaseArchive = resolve; });
  const update = updateDiagramSkill({
    root: vendorRoot,
    name: "archify",
    stagingRoot: path.join(path.dirname(vendorRoot), "interleaving-stage"),
    fetchRelease: async () => ({
      tag: "v2.13.1",
      releasedAt: "2026-08-12T00:00:00Z",
      releaseAsset: { name: "archify.zip", url: "https://github.com/tt-a1i/archify/releases/download/v2.13.1/archify.zip", sha256: sha256(rawArchive) },
    }),
    resolveTagCommit: async () => "2".repeat(40),
    fetchArchive: async () => {
      archiveRequested();
      await release;
      return rawArchive;
    },
  });
  await entered;
  await assert.rejects(verifyDiagramSkillVendor({ root: vendorRoot, name: "archify" }), (error) => error.code === "DIAGRAM_VENDOR_OPERATION_ACTIVE");
  releaseArchive();
  const updated = await update;
  assert.deepEqual(updated, { name: "archify", tag: "v2.13.1", verifiedFiles: 60 });
  assert.equal(existsSync(path.join(vendorRoot, "archify/2.13.1")), true, "interleaving verifier never removes the committed new tree");
  assert.deepEqual(await verifyDiagramSkillVendor({ root: vendorRoot, name: "archify" }), updated);
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

test("latest discovery peels the official tag instead of trusting release target metadata", async () => {
  const { checkLatestDiagramSkills } = await loadUpdaterOrFail();
  const calls = [];
  const latest = await checkLatestDiagramSkills({
    root: repoRoot,
    skill: "archify",
    fetchRelease: async () => ({
      tag: "v2.13.1",
      commit: "f".repeat(40),
      releasedAt: "2026-08-12T00:00:00Z",
      releaseAsset: { name: "archify.zip", url: "https://github.com/tt-a1i/archify/releases/download/v2.13.1/archify.zip", sha256: "a".repeat(64) },
    }),
    resolveTagCommit: async ({ name, tag }) => {
      calls.push({ name, tag });
      return "2".repeat(40);
    },
  });
  assert.deepEqual(calls, [{ name: "archify", tag: "v2.13.1" }]);
  assert.deepEqual(latest, [{ name: "archify", status: "outdated", installedTag: "v2.13.0", latestTag: "v2.13.1", updateAvailable: true }]);
});

test("Skillstead latest discovery selects the highest stable svg-infographic release from the complete release set", async () => {
  const { selectNewestSkillsteadRelease } = await loadUpdaterOrFail();
  assert.deepEqual(
    selectNewestSkillsteadRelease([
      { tag_name: "v9.0.0", published_at: "2026-08-12T00:00:00Z" },
      { tag_name: "svg-infographic/v0.10.0-rc.1", published_at: "2026-08-12T00:00:00Z", prerelease: true },
      { tag_name: "svg-infographic/v0.9.0", published_at: "2026-08-08T16:41:59Z" },
      { tag_name: "svg-infographic/v0.10.0", published_at: "2026-08-13T00:00:00Z" },
      { tag_name: "svg-infographic/v0.11.0", published_at: "2026-08-14T00:00:00Z", draft: true },
    ]),
    { tag: "svg-infographic/v0.10.0", releasedAt: "2026-08-13T00:00:00Z" },
  );
});

test("updater rejects an unverified Archify asset digest and does not alter the installed closure", async (t) => {
  const { updateDiagramSkill } = await loadUpdaterOrFail();
  const { vendorRoot } = await copiedVendorWorkspace(t, "archify");
  const before = await readFile(path.join(vendorRoot, "vendor.lock.json"));
  const archive = await rawArchiveForVendor(vendorRoot, "archify");
  await assert.rejects(
    updateDiagramSkill({
      root: vendorRoot,
      name: "archify",
      stagingRoot: path.join(path.dirname(vendorRoot), "asset-mismatch-stage"),
      fetchRelease: async () => ({
        tag: "v2.13.1",
        releasedAt: "2026-08-12T00:00:00Z",
        releaseAsset: { name: "archify.zip", url: "https://github.com/tt-a1i/archify/releases/download/v2.13.1/archify.zip", sha256: "a".repeat(64) },
      }),
      resolveTagCommit: async () => "2".repeat(40),
      fetchArchive: async () => archive,
    }),
    (error) => error.code === "DIAGRAM_VENDOR_ARCHIVE_HASH_MISMATCH",
  );
  assert.deepEqual(await readFile(path.join(vendorRoot, "vendor.lock.json")), before);
});

test("updater rejects a fake license or an archive-supplied updater before writing a new closure", async (t) => {
  const { updateDiagramSkill } = await loadUpdaterOrFail();
  const release = { tag: "svg-infographic/v0.9.1", releasedAt: "2026-08-12T00:00:00Z" };
  for (const [label, mutate, expectedCode] of [
    ["license", (files) => files.map((file) => file.path === "LICENSE.txt" ? { ...file, bytes: Buffer.from("fake license\n") } : file), "DIAGRAM_VENDOR_ARCHIVE_LICENSE_HASH_MISMATCH"],
    ["updater", (files) => [...files, { path: "scripts/update.mjs", bytes: Buffer.from("export {};\n") }], "DIAGRAM_VENDOR_ARCHIVE_UPDATER_FORBIDDEN"],
  ]) {
    const { vendorRoot } = await copiedVendorWorkspace(t, "skillstead");
    const archive = await rawArchiveForVendor(vendorRoot, "skillstead", mutate);
    const officialTree = await officialTreeForVendor(vendorRoot, "skillstead");
    await assert.rejects(
      updateDiagramSkill({
        root: vendorRoot,
        name: "skillstead",
        stagingRoot: path.join(path.dirname(vendorRoot), `${label}-stage`),
      fetchRelease: async () => release,
      resolveTagCommit: async () => "2".repeat(40),
      fetchOfficialTree: async () => officialTree,
      fetchArchive: async () => archive,
      }),
      (error) => error.code === expectedCode,
    );
  }
});

test("failed lock replacement recovers the previous immutable closure", async (t) => {
  const { recoverDiagramSkillVendor, updateDiagramSkill, verifyDiagramSkillVendor } = await loadUpdaterOrFail();
  const { vendorRoot } = await copiedVendorWorkspace(t, "archify");
  const before = await readFile(path.join(vendorRoot, "vendor.lock.json"));
  const archive = await rawArchiveForVendor(vendorRoot, "archify");
  const futureRelease = {
    tag: "v2.13.1",
    releasedAt: "2026-08-12T00:00:00Z",
    releaseAsset: { name: "archify.zip", url: "https://github.com/tt-a1i/archify/releases/download/v2.13.1/archify.zip", sha256: sha256(archive) },
  };
  await assert.rejects(
    updateDiagramSkill({
      root: vendorRoot,
      name: "archify",
      stagingRoot: path.join(path.dirname(vendorRoot), "rename-boundary-stage"),
      fetchRelease: async () => futureRelease,
      resolveTagCommit: async () => "2".repeat(40),
      fetchArchive: async () => archive,
      renamePath: async (from, to) => {
        if (to === path.join(vendorRoot, "vendor.lock.json")) throw new Error("injected lock rename failure");
        const { rename } = await import("node:fs/promises");
        return rename(from, to);
      },
    }),
    /injected lock rename failure/u,
  );
  await recoverDiagramSkillVendor({ root: vendorRoot, name: "archify" });
  assert.deepEqual(await readFile(path.join(vendorRoot, "vendor.lock.json")), before);
  assert.deepEqual(await verifyDiagramSkillVendor({ root: vendorRoot, name: "archify" }), { name: "archify", tag: "v2.13.0", verifiedFiles: 60 });
});

test("notices transaction failures restore the complete previous closure", async (t) => {
  const { updateDiagramSkill, verifyDiagramSkillVendor } = await loadUpdaterOrFail();
  for (const [label, injected] of [
    ["notices-rename", {
      renamePath: async (from, to, vendorRoot) => {
        if (to === path.join(vendorRoot, "THIRD_PARTY_NOTICES.md")) throw new Error("injected notices rename failure");
        return (await import("node:fs/promises")).rename(from, to);
      },
    }],
    ["notices-partial-write", {
      writePath: async (filename, contents) => {
        if (filename.includes("THIRD_PARTY_NOTICES.md")) {
          await writeFile(filename, "partial notices");
          throw new Error("injected notices partial write failure");
        }
        await writeFile(filename, contents);
      },
    }],
    ["after-notices", { afterNotices: async () => { throw new Error("injected after notices failure"); } }],
  ]) {
    const { vendorRoot } = await copiedVendorWorkspace(t, "archify");
    const before = await vendorState(vendorRoot, "archify");
    const archive = await rawArchiveForVendor(vendorRoot, "archify");
    const release = {
      tag: "v2.13.1",
      releasedAt: "2026-08-12T00:00:00Z",
      releaseAsset: { name: "archify.zip", url: "https://github.com/tt-a1i/archify/releases/download/v2.13.1/archify.zip", sha256: sha256(archive) },
    };
    await assert.rejects(
      updateDiagramSkill({
        root: vendorRoot,
        name: "archify",
        stagingRoot: path.join(path.dirname(vendorRoot), `${label}-stage`),
        fetchRelease: async () => release,
        resolveTagCommit: async () => "2".repeat(40),
        fetchArchive: async () => archive,
        ...(injected.renamePath ? { renamePath: (from, to) => injected.renamePath(from, to, vendorRoot) } : {}),
        ...(injected.writePath ? { writePath: injected.writePath } : {}),
        ...(injected.afterNotices ? { afterNotices: injected.afterNotices } : {}),
      }),
      new RegExp(`injected ${label.replaceAll("-", " ")} failure`, "u"),
      label,
    );
    assert.deepEqual(await vendorState(vendorRoot, "archify"), before, `${label}: lock, notices, and old tree are restored together`);
    assert.equal(existsSync(path.join(vendorRoot, ".vendor-update.json")), false, `${label}: journal is removed`);
    assert.equal(existsSync(path.join(vendorRoot, ".vendor-update-lock-backup.json")), false, `${label}: lock backup is removed`);
    assert.equal(existsSync(path.join(vendorRoot, ".vendor-update-notices-backup.md")), false, `${label}: notices backup is removed`);
    await verifyDiagramSkillVendor({ root: vendorRoot, name: "archify" });
  }
});

test("injected latest check is read-only and injected update atomically stages a verified future closure", async (t) => {
  const { checkLatestDiagramSkills, updateDiagramSkill, verifyDiagramSkillVendor } = await loadUpdaterOrFail();
  const { workspaceRoot, vendorRoot } = await copiedVendorWorkspace(t, "archify");
  const before = await readFile(path.join(vendorRoot, "vendor.lock.json"));
  const archive = await rawArchiveForVendor(vendorRoot, "archify");
  const futureRelease = {
    tag: "v2.13.1",
    releasedAt: "2026-08-12T00:00:00Z",
    releaseAsset: { name: "archify.zip", url: "https://github.com/tt-a1i/archify/releases/download/v2.13.1/archify.zip", sha256: sha256(archive) },
  };
  const latest = await checkLatestDiagramSkills({
    root: workspaceRoot,
    skill: "archify",
    fetchRelease: async ({ name, repository }) => {
      assert.equal(name, "archify");
      assert.equal(repository, "https://github.com/tt-a1i/archify");
      return futureRelease;
    },
    resolveTagCommit: async () => "1".repeat(40),
  });
  assert.deepEqual(latest, [{ name: "archify", status: "outdated", installedTag: "v2.13.0", latestTag: "v2.13.1", updateAvailable: true }]);
  assert.deepEqual(await readFile(path.join(vendorRoot, "vendor.lock.json")), before, "latest check never changes the installed vendor");

  const stagingRoot = path.join(path.dirname(vendorRoot), "archify-stage");
  const result = await updateDiagramSkill({
    root: vendorRoot,
    name: "archify",
    stagingRoot,
    fetchRelease: async () => futureRelease,
    resolveTagCommit: async () => "1".repeat(40),
    fetchArchive: async ({ name, release }) => {
      assert.equal(name, "archify");
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

test("both packaged Archify runtimes pass doctor, validate, and deliver without a host skill", async (t) => {
  for (const productName of productNames) {
    const stagingRoot = await mkdtemp(path.join(tmpdir(), "archify-package-smoke-"));
    t.after(() => rm(stagingRoot, { recursive: true, force: true }));
    const build = await buildProduct({ repoRoot, productName, stagingRoot, sourceDateEpoch: 0 });
    const archify = path.join(build.outputDir, "skills/archify/bin/archify.mjs");
    const example = path.join(build.outputDir, "skills/archify/examples/web-app.architecture.json");
    const output = path.join(build.outputDir, "archify-package-smoke.html");
    for (const args of [
      [archify, "doctor"],
      [archify, "validate", "architecture", example, "--quality", "standard", "--json"],
      [archify, "deliver", "architecture", example, output, "--quality", "standard", "--json"],
    ]) {
      const result = spawnSync(process.execPath, args, { cwd: build.outputDir, encoding: "utf8" });
      assert.equal(result.status, 0, `${productName}: ${args.at(-1)}\n${result.stdout}\n${result.stderr}`);
    }
    const receipt = JSON.parse(spawnSync(process.execPath, [archify, "validate", "architecture", example, "--quality", "standard", "--json"], { cwd: build.outputDir, encoding: "utf8" }).stdout);
    assert.equal(receipt.ok, true, `${productName}: delivered runtime validates its own source`);
    assert.equal(existsSync(output), true, `${productName}: delivered checked HTML exists`);
  }
});
