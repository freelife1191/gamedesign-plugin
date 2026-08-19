import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { cp, lstat, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
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

// What must hold across upgrades is the identity of the upstream and the shape of the closure, not the
// particular version that happens to be vendored. Version-shaped values are read from the installed
// lock; everything a bump must never change stays a literal here.
const installedLock = (id) => JSON.parse(readFileSync(path.join(repoRoot, "shared/vendor", id, "vendor.lock.json"), "utf8"));

const INVARIANTS = Object.freeze({
  skillstead: Object.freeze({
    root: "shared/vendor/skillstead",
    repository: "https://github.com/kyungseo/skillstead",
    skillPath: "skills/svg-infographic",
    tagShape: /^svg-infographic\/v\d+\.\d+\.\d+$/u,
    license: Object.freeze({ spdx: "Apache-2.0", path: "LICENSE.txt", sha256: "4739c79c8017b90a46ab26f8972fd4ac56c9ea459b89bf9671359b462f62a4a6" }),
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
    repository: "https://github.com/tt-a1i/archify",
    skillPath: "archify",
    tagShape: /^v\d+\.\d+\.\d+$/u,
    license: Object.freeze({ spdx: "MIT", path: "LICENSE", sha256: "2f724fa953b4eaa8ec75fa56919ce474b57adce54d2456a3791510bc53735cbd" }),
    requiredRuntimePaths: Object.freeze([
      "SKILL.md",
      "bin/archify.mjs",
      "assets/template.html",
      "renderers/shared/generated-validators.mjs",
      "renderers/architecture/render-architecture.mjs",
      "renderers/workflow/render-workflow.mjs",
      "schemas/architecture.schema.json",
    ]),
  }),
});

const EXPECTED = Object.freeze(Object.fromEntries(Object.entries(INVARIANTS).map(([id, invariants]) => {
  const lock = installedLock(id);
  return [id, Object.freeze({
    ...invariants,
    treeRoot: vendorTreeRoot(id),
    files: lock.tree.files.length,
    installedTag: lock.upstream.tag,
    nextTag: nextTagAfter(id, lock.upstream.tag),
  })];
})));

// A release strictly newer than the vendored one, so the update fixtures stay valid across upgrades.
function nextTagAfter(id, tag) {
  const version = tag.split("/").at(-1).replace(/^v/u, "").split(".");
  const bumped = `v${version[0]}.${version[1]}.${Number(version[2]) + 1}`;
  return id === "skillstead" ? `svg-infographic/${bumped}` : bumped;
}

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

function assertLockIdentity(name, lock, contract) {
  assert.equal(lock.schemaVersion, 1, `${name}: lock schema`);
  assert.equal(lock.upstream.repository, contract.repository, `${name}: official repository`);
  assert.equal(lock.upstream.skillPath, contract.skillPath, `${name}: upstream skill path`);
  assert.match(lock.upstream.tag, contract.tagShape, `${name}: stable release tag`);
  assert.match(lock.upstream.commit, /^[a-f0-9]{40}$/u, `${name}: immutable commit`);
  assert.ok(!Number.isNaN(Date.parse(lock.upstream.releasedAt)), `${name}: release time`);
  assert.deepEqual(lock.license, contract.license, `${name}: license identity survives every upgrade`);
  assert.equal(lock.tree.root, contract.treeRoot, `${name}: tree root follows the tag`);
  if (name === "archify") {
    assert.equal(lock.upstream.releaseAsset.name, "archify.zip", `${name}: pinned release asset`);
    assert.equal(lock.upstream.releaseAsset.url, `https://github.com/tt-a1i/archify/releases/download/${lock.upstream.tag}/archify.zip`, `${name}: asset url follows the tag`);
    assert.match(lock.upstream.releaseAsset.sha256, /^[a-f0-9]{64}$/u, `${name}: asset digest`);
  }
}

async function assertVendorClosure(name, root = path.join(repoRoot, EXPECTED[name].root)) {
  const contract = EXPECTED[name];
  const lock = JSON.parse(await readFile(path.join(root, "vendor.lock.json"), "utf8"));
  assertLockIdentity(name, lock, contract);
  assert.ok(Array.isArray(lock.tree?.files), `${name}: vendor lock declares the complete file closure`);
  const declared = normalizedFiles(lock.tree.files).sort((left, right) => left.path.localeCompare(right.path));
  assert.equal(declared.length, contract.files, `${name}: exact file count`);
  assert.equal(new Set(declared.map(({ path: relativePath }) => relativePath)).size, declared.length, `${name}: no duplicate path in the closure`);
  for (const entry of declared) assert.match(entry.sha256, /^[a-f0-9]{64}$/u, `${name}: ${entry.path} carries a digest`);

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
  for (const literal of [contract.repository, lock.upstream.tag, contract.license.spdx, contract.license.sha256]) {
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

test("the Skillstead vendor lock pins the official Apache-2.0 exact runtime closure", async () => {
  await assertVendorClosure("skillstead");
});

test("the Archify vendor lock pins its release asset and an exact MIT runtime closure", async () => {
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
    oldRoot: EXPECTED.archify.treeRoot,
    newRoot: `archify/${EXPECTED.archify.nextTag.slice(1)}`,
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
  await writeFile(path.join(vendorRoot, ".vendor-update.json"), `${JSON.stringify({ schemaVersion: 2, name: "archify", oldRoot: EXPECTED.archify.treeRoot, newRoot: `archify/${EXPECTED.archify.nextTag.slice(1)}`, ownerNonce: "b".repeat(32), lockBackup: ".vendor-update-lock-backup.json", noticesBackup: ".vendor-update-notices-backup.md" })}\n`);
  await mkdir(path.join(vendorRoot, `archify/${EXPECTED.archify.nextTag.slice(1)}`), { recursive: true });
  await writeFile(path.join(vendorRoot, `archify/${EXPECTED.archify.nextTag.slice(1)}`, "candidate.txt"), "do not delete");
  for (const operation of [recoverDiagramSkillVendor, verifyDiagramSkillVendor]) {
    await assert.rejects(operation({ root: vendorRoot, name: "archify" }), (error) => error.code === "DIAGRAM_VENDOR_OPERATION_ACTIVE");
  }
  assert.deepEqual(await vendorState(vendorRoot, "archify"), before, "live owner cannot change active closure");
  assert.equal(await readFile(path.join(vendorRoot, `archify/${EXPECTED.archify.nextTag.slice(1)}`, "candidate.txt"), "utf8"), "do not delete");
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
        tag: EXPECTED.archify.nextTag,
        releasedAt: "2026-08-12T00:00:00Z",
        releaseAsset: { name: "archify.zip", url: `https://github.com/tt-a1i/archify/releases/download/${EXPECTED.archify.nextTag}/archify.zip`, sha256: sha256(Buffer.from("independent official asset")) },
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
        fetchRelease: async () => ({ tag: EXPECTED.skillstead.nextTag, releasedAt: "2026-08-12T00:00:00Z" }),
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
  await writeFile(path.join(vendorRoot, ".vendor-update.json"), `${JSON.stringify({ schemaVersion: 2, name: "archify", oldRoot: EXPECTED.archify.treeRoot, newRoot: `archify/${EXPECTED.archify.nextTag.slice(1)}`, ownerNonce: "c".repeat(32), lockBackup: ".vendor-update-lock-backup.json", noticesBackup: ".vendor-update-notices-backup.md" })}\n`);
  await mkdir(path.join(vendorRoot, `archify/${EXPECTED.archify.nextTag.slice(1)}`), { recursive: true });
  await writeFile(path.join(vendorRoot, `archify/${EXPECTED.archify.nextTag.slice(1)}`, "candidate.txt"), "discard stale candidate");
  assert.equal(await recoverDiagramSkillVendor({ root: vendorRoot, name: "archify", now: Date.parse("2000-01-01T00:10:00.000Z") }), true);
  assert.equal(existsSync(lockRoot), false, "stale lock is removed only after its owner schema is verified");
  assert.equal(existsSync(path.join(vendorRoot, `archify/${EXPECTED.archify.nextTag.slice(1)}`)), false, "only stale inactive tree is removed");
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
      tag: EXPECTED.archify.nextTag,
      releasedAt: "2026-08-12T00:00:00Z",
      releaseAsset: { name: "archify.zip", url: `https://github.com/tt-a1i/archify/releases/download/${EXPECTED.archify.nextTag}/archify.zip`, sha256: sha256(rawArchive) },
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
  assert.deepEqual(updated, { name: "archify", tag: EXPECTED.archify.nextTag, verifiedFiles: EXPECTED.archify.files });
  assert.equal(existsSync(path.join(vendorRoot, `archify/${EXPECTED.archify.nextTag.slice(1)}`)), true, "interleaving verifier never removes the committed new tree");
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
      tag: EXPECTED.archify.nextTag,
      commit: "f".repeat(40),
      releasedAt: "2026-08-12T00:00:00Z",
      releaseAsset: { name: "archify.zip", url: `https://github.com/tt-a1i/archify/releases/download/${EXPECTED.archify.nextTag}/archify.zip`, sha256: "a".repeat(64) },
    }),
    resolveTagCommit: async ({ name, tag }) => {
      calls.push({ name, tag });
      return "2".repeat(40);
    },
  });
  assert.deepEqual(calls, [{ name: "archify", tag: EXPECTED.archify.nextTag }]);
  assert.deepEqual(latest, [{ name: "archify", status: "outdated", installedTag: EXPECTED.archify.installedTag, latestTag: EXPECTED.archify.nextTag, updateAvailable: true }]);
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
        tag: EXPECTED.archify.nextTag,
        releasedAt: "2026-08-12T00:00:00Z",
        releaseAsset: { name: "archify.zip", url: `https://github.com/tt-a1i/archify/releases/download/${EXPECTED.archify.nextTag}/archify.zip`, sha256: "a".repeat(64) },
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
  const release = { tag: EXPECTED.skillstead.nextTag, releasedAt: "2026-08-12T00:00:00Z" };
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
    tag: EXPECTED.archify.nextTag,
    releasedAt: "2026-08-12T00:00:00Z",
    releaseAsset: { name: "archify.zip", url: `https://github.com/tt-a1i/archify/releases/download/${EXPECTED.archify.nextTag}/archify.zip`, sha256: sha256(archive) },
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
  assert.deepEqual(await verifyDiagramSkillVendor({ root: vendorRoot, name: "archify" }), { name: "archify", tag: EXPECTED.archify.installedTag, verifiedFiles: EXPECTED.archify.files });
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
      tag: EXPECTED.archify.nextTag,
      releasedAt: "2026-08-12T00:00:00Z",
      releaseAsset: { name: "archify.zip", url: `https://github.com/tt-a1i/archify/releases/download/${EXPECTED.archify.nextTag}/archify.zip`, sha256: sha256(archive) },
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
    tag: EXPECTED.archify.nextTag,
    releasedAt: "2026-08-12T00:00:00Z",
    releaseAsset: { name: "archify.zip", url: `https://github.com/tt-a1i/archify/releases/download/${EXPECTED.archify.nextTag}/archify.zip`, sha256: sha256(archive) },
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
  assert.deepEqual(latest, [{ name: "archify", status: "outdated", installedTag: EXPECTED.archify.installedTag, latestTag: EXPECTED.archify.nextTag, updateAvailable: true }]);
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
  assert.deepEqual(result, { name: "archify", tag: EXPECTED.archify.nextTag, verifiedFiles: EXPECTED.archify.files });
  const updated = JSON.parse(await readFile(path.join(vendorRoot, "vendor.lock.json"), "utf8"));
  assert.equal(updated.upstream.tag, EXPECTED.archify.nextTag);
  assert.equal(updated.tree.root, `archify/${EXPECTED.archify.nextTag.slice(1)}`);
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

// The upstream skill has had subdirectories since before it was first vendored, and a recursive tree
// listing names them. Rejecting them rejected every real tree, so this cross-check — the one that proves
// the downloaded archive matches the bytes GitHub records for the tagged commit — could never pass.
test("the official tree cross-check reads through directory entries and still refuses a submodule", async () => {
  const { defaultFetchOfficialTree } = await import(updaterUrl.href);
  const sha = (seed) => seed.repeat(40).slice(0, 40);
  const listing = (extra = []) => ({
    truncated: false,
    tree: [
      { path: "skills/svg-infographic/SKILL.md", type: "blob", mode: "100644", sha: sha("a") },
      { path: "skills/svg-infographic/scripts", type: "tree", mode: "040000", sha: sha("b") },
      { path: "skills/svg-infographic/scripts/render.mjs", type: "blob", mode: "100644", sha: sha("c") },
      ...extra,
    ],
  });

  assert.deepEqual(
    await defaultFetchOfficialTree({ name: "skillstead", commit: sha("d"), fetchJson: async () => listing() }),
    [{ path: "scripts/render.mjs", sha: sha("c") }, { path: "SKILL.md", sha: sha("a") }],
  );

  for (const hostile of [
    { path: "skills/svg-infographic/vendored", type: "commit", mode: "160000", sha: sha("e") },
    { path: "skills/svg-infographic/link.md", type: "blob", mode: "120000", sha: sha("f") },
  ]) {
    await assert.rejects(
      () => defaultFetchOfficialTree({ name: "skillstead", commit: sha("d"), fetchJson: async () => listing([hostile]) }),
      (error) => {
        assert.equal(error.code, "DIAGRAM_VENDOR_OFFICIAL_TREE_INVALID");
        assert.equal(error.path, hostile.path);
        return true;
      },
    );
  }
});
