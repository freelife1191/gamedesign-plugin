import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { cp, lstat, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const vendorRoot = path.join(repoRoot, "shared/vendor/im-not-ai");
const updaterUrl = new URL("../../tooling/sync-im-not-ai.mjs", import.meta.url);

const expectedFiles = [
  { path: "SKILL.md", sha256: "6c34dbf00c23ee52e5cb374273952dab9bb5d38552cf1fb7a90ed42854ee304f", size: 4352 },
  { path: "references/ai-tell-taxonomy.md", sha256: "57b7b40bc90d927d1b76cd4325ae5a58c92d18a20615339b19bc5eac776a6940", size: 77157 },
  { path: "references/baseline.json", sha256: "3880335a2b760fd505531e303ff9fff7f0725f8f2e98dc965a7808c21616d958", size: 6139 },
  { path: "references/baseline_v2.json", sha256: "b5f1725bd02fb4cc40eece68c5b8f1d7c7655775743196d8fd0bc5978f2ed916", size: 13487 },
  { path: "references/design-notes.md", sha256: "e350884ca1cb10c248d247b7fc2b5236211489757bf65a72360434f0254ae293", size: 5940 },
  { path: "references/diagnosis-rules.md", sha256: "0a8d2c1ddf4b7294b66ddc549d0600fd74c41a187d6501869cb8c9c4d7d0456a", size: 13082 },
  { path: "references/empirical-validation.md", sha256: "d23302029934de04baecb48759ca7d804d98e861341edec315ac4a1fc40ce31f", size: 8339 },
  { path: "references/metrics.py", sha256: "a665faef60c88a045e232ac633fe19335d123a58a5dd8e493708c7c5954a5f60", size: 14550 },
  { path: "references/metrics_v2.py", sha256: "97343e74d16d71eeaae773cfb2e3b5970bd395239b1457b9ca6e8bebae2740bd", size: 31314 },
  { path: "references/quick-rules.footer.md", sha256: "933c5300b71fdf6eecc0ec0788910afd9a166ce7969ba129e2029ced000f2335", size: 1920 },
  { path: "references/quick-rules.header.md", sha256: "e129aa91bfe74433d81ff6817e934a233a9a7febd85f1f9484eca1ced33c1c13", size: 1156 },
  { path: "references/quick-rules.md", sha256: "cc8947e145a34af000b3684ef09ed62c51c0b35080f43b96bcd38e2ff98d28ef", size: 10040 },
  { path: "references/rewriting-playbook.md", sha256: "854b9e8fa552747972c319d6b409a00a74ed5afcb69eed019dfc5092238be721", size: 12133 },
  { path: "references/scholarship.md", sha256: "e83346a5b0147a923b725295cbee6b7fa3b22020840b5eee95c35f615b182e64", size: 35541 },
  { path: "references/web-service-spec.md", sha256: "be887c5e60b9a37e63a4aa8156ada0da4298098a51451925a3a22b9a37e25f6a", size: 8010 },
];

const expectedLock = {
  schemaVersion: 1,
  upstream: { repository: "https://github.com/epoko77-ai/im-not-ai", tag: "v2.3.0", commit: "82137e858763dadb99561f194c5c00465735017b", releasedAt: "2026-07-22T06:28:52Z", skillPath: "codex/skills/humanize-korean", referencesSource: ".claude/skills/humanize-korean/references" },
  license: { spdx: "MIT", path: "LICENSE", sha256: "4cc7e8c439fe42f09d98457599c129ea6df9e5d0e622750d75952b441a38343f" },
  tree: { root: "humanize-korean/v2.3.0", files: expectedFiles },
};
const futureClosureFiles = [
  { path: "LICENSE", sha256: "4cc7e8c439fe42f09d98457599c129ea6df9e5d0e622750d75952b441a38343f", size: 1066 },
  ...expectedFiles.map((file) => ({ path: file.path === "SKILL.md" ? "codex/skills/humanize-korean/SKILL.md" : `.claude/skills/humanize-korean/references/${file.path.slice("references/".length)}`, sha256: file.sha256, size: file.size })),
];
const futureClosure = { files: futureClosureFiles, licenseSha256: "4cc7e8c439fe42f09d98457599c129ea6df9e5d0e622750d75952b441a38343f", digest: createHash("sha256").update(Buffer.from(JSON.stringify(futureClosureFiles.map(({ path: filePath, sha256: hash, size }) => ({ path: filePath, sha256: hash, size })).sort((a, b) => a.path.localeCompare(b.path))))).digest("hex") };
const futureRelease = { repository: "https://github.com/epoko77-ai/im-not-ai", tag: "v2.3.1", commit: "1111111111111111111111111111111111111111", releasedAt: "2026-08-12T00:00:00Z", closure: futureClosure };

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

async function listRegularFiles(root, prefix = "") {
  const output = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
    const absolutePath = path.join(root, entry.name);
    const stat = await lstat(absolutePath);
    assert.equal(stat.isSymbolicLink(), false, `non-symlink: ${relativePath}`);
    if (stat.isDirectory()) output.push(...await listRegularFiles(absolutePath, relativePath));
    else {
      assert.equal(stat.isFile(), true, `regular file: ${relativePath}`);
      const bytes = await readFile(absolutePath);
      output.push({ path: relativePath, sha256: sha256(bytes), size: bytes.length });
    }
  }
  return output.sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
}

function parseFrontmatter(markdown) {
  const match = markdown.match(/^---\n([\s\S]*?)\n---\n/u);
  assert.ok(match, "SKILL.md frontmatter is missing");
  return Object.fromEntries(match[1].split("\n").map((line) => {
    const separator = line.indexOf(": ");
    assert.notEqual(separator, -1, `frontmatter field: ${line}`);
    return [line.slice(0, separator), line.slice(separator + 2)];
  }));
}

async function assertLiteralVendorTree(root = vendorRoot) {
  assert.deepEqual(JSON.parse(await readFile(path.join(root, "vendor.lock.json"), "utf8")), expectedLock);
  const actual = await listRegularFiles(root);
  const expected = [
    "LICENSE", "THIRD_PARTY_NOTICES.md", "vendor.lock.json",
    ...expectedFiles.map((file) => `${expectedLock.tree.root}/${file.path}`),
  ].sort();
  assert.deepEqual(actual.map((entry) => entry.path), expected, "vendor tree has no unregistered files");
  assert.deepEqual(actual.filter((entry) => entry.path.startsWith(expectedLock.tree.root)).map((entry) => ({ ...entry, path: entry.path.slice(`${expectedLock.tree.root}/`.length) })), expectedFiles, "bundle path set, sizes, and hashes are exact");
  assert.deepEqual(actual.find((entry) => entry.path === "LICENSE"), { path: "LICENSE", sha256: expectedLock.license.sha256, size: 1067 });
  const notices = await readFile(path.join(root, "THIRD_PARTY_NOTICES.md"), "utf8");
  for (const literal of ["https://github.com/epoko77-ai/im-not-ai", "v2.3.0", "MIT", expectedLock.license.sha256]) assert.ok(notices.includes(literal), `MIT notice retains ${literal}`);
  assert.equal(parseFrontmatter(await readFile(path.join(root, expectedLock.tree.root, "SKILL.md"), "utf8")).name, "humanize-korean");
}

async function copiedVendor(t) {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), "im-not-ai-vendor-"));
  t.after(() => rm(temporaryRoot, { recursive: true, force: true }));
  const fixture = path.join(temporaryRoot, "im-not-ai");
  await cp(vendorRoot, fixture, { recursive: true });
  return fixture;
}

async function assertVerifierRejects(t, mutate, expected) {
  const { verifyVendoredImNotAi } = await import(updaterUrl.href);
  const fixture = await copiedVendor(t);
  await mutate(fixture);
  await assert.rejects(verifyVendoredImNotAi({ root: fixture }), (error) => {
    assert.deepEqual({ code: error.code, path: error.path }, expected);
    return true;
  });
}

async function snapshotVendor(root) {
  return { lock: await readFile(path.join(root, "vendor.lock.json")), files: await listRegularFiles(root) };
}

async function trustedFutureArchive(root) {
  const completeFile = async (sourcePath, targetPath) => {
    const bytes = await readFile(path.join(root, sourcePath));
    return { path: targetPath, bytes, sha256: sha256(bytes) };
  };
  return {
    ...futureRelease,
    files: [
      await completeFile("LICENSE", "LICENSE"),
      await completeFile(`${expectedLock.tree.root}/SKILL.md`, "codex/skills/humanize-korean/SKILL.md"),
      ...await Promise.all(expectedFiles.filter((file) => file.path.startsWith("references/")).map((file) => completeFile(`${expectedLock.tree.root}/${file.path}`, `.claude/skills/humanize-korean/references/${file.path.slice("references/".length)}`))),
    ],
  };
}

function runNode(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (exitCode) => resolve({ exitCode, stderr, stdout }));
  });
}

async function assertArchiveRejectedWithoutWrites(t, mutate, expected) {
  const { updateImNotAi } = await import(updaterUrl.href);
  const fixture = await copiedVendor(t);
  const stagingRoot = path.join(path.dirname(fixture), "rejected-im-not-ai-stage");
  const before = await snapshotVendor(fixture);
  const archive = await trustedFutureArchive(fixture);
  await mutate(archive);
  await assert.rejects(
    updateImNotAi({
      root: fixture,
      stagingRoot,
      fetchRelease: async () => futureRelease,
      fetchArchive: async () => archive,
    }),
    (error) => {
      assert.deepEqual({ code: error.code, path: error.path }, expected);
      return true;
    },
  );
  assert.deepEqual(await snapshotVendor(fixture), before, "rejected archive must not alter the original vendor root");
  await assert.rejects(lstat(stagingRoot), { code: "ENOENT" }, "rejected archive must not create staging output");
}

test("im-not-ai vendor lock pins the official release, MIT license, and exact regular tree", async () => {
  await assertLiteralVendorTree();
});

test("offline verifier module imports only after fetch, HTTP, HTTPS, and child-process sentinels are installed", async (t) => {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), "im-not-ai-import-sentinel-"));
  t.after(() => rm(temporaryRoot, { recursive: true, force: true }));
  const loaderPath = path.join(temporaryRoot, "block-network-loader.mjs");
  const runnerPath = path.join(temporaryRoot, "import-offline-verifier.mjs");
  await writeFile(loaderPath, `
const blocked = new Set(["node:http", "node:https", "node:child_process", "http", "https", "child_process"]);
export async function resolve(specifier, context, nextResolve) {
  if (blocked.has(specifier)) throw new Error("offline verifier import attempted forbidden capability: " + specifier);
  return nextResolve(specifier, context);
}
`);
  await writeFile(runnerPath, `
globalThis.fetch = async () => { throw new Error("offline verifier import attempted global fetch"); };
await import(process.argv[2]);
process.stdout.write("offline-verifier-imported\\n");
`);
  const result = await runNode(["--experimental-loader", loaderPath, runnerPath, updaterUrl.href]);
  assert.equal(result.exitCode, 0, result.stderr);
  assert.equal(result.stdout, "offline-verifier-imported\n");
  assert.match(result.stderr, /ExperimentalWarning/u);
});

test("pure offline verifier accepts the pinned vendor without a network capability", async () => {
  const { verifyVendoredImNotAi } = await import(updaterUrl.href);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("pure verifier must not call global fetch"); };
  try {
    assert.deepEqual(await verifyVendoredImNotAi({ root: vendorRoot }), { verifiedFiles: 15, tag: "v2.3.0" });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("im-not-ai verifier rejects a tampered tag with its exact lock target", async (t) => {
  await assertVerifierRejects(t, async (root) => { const lock = JSON.parse(await readFile(path.join(root, "vendor.lock.json"), "utf8")); lock.upstream.tag = "v9.9.9"; await writeFile(path.join(root, "vendor.lock.json"), `${JSON.stringify(lock, null, 2)}\n`); }, { code: "IM_NOT_AI_UPSTREAM_TAG_MISMATCH", path: "upstream.tag" });
});
test("im-not-ai verifier rejects a tampered commit with its exact lock target", async (t) => {
  await assertVerifierRejects(t, async (root) => { const lock = JSON.parse(await readFile(path.join(root, "vendor.lock.json"), "utf8")); lock.upstream.commit = "0".repeat(40); await writeFile(path.join(root, "vendor.lock.json"), `${JSON.stringify(lock, null, 2)}\n`); }, { code: "IM_NOT_AI_UPSTREAM_COMMIT_MISMATCH", path: "upstream.commit" });
});
test("im-not-ai verifier rejects an altered registered hash with its exact lock target", async (t) => {
  await assertVerifierRejects(t, async (root) => { const lock = JSON.parse(await readFile(path.join(root, "vendor.lock.json"), "utf8")); lock.tree.files[0].sha256 = "0".repeat(64); await writeFile(path.join(root, "vendor.lock.json"), `${JSON.stringify(lock, null, 2)}\n`); }, { code: "IM_NOT_AI_LOCK_FILE_HASH_MISMATCH", path: "tree.files[0].sha256" });
});
test("im-not-ai verifier rejects tampered quick-rules bytes while the lock stays intact", async (t) => {
  await assertVerifierRejects(t, (root) => writeFile(path.join(root, expectedLock.tree.root, "references/quick-rules.md"), "tampered quick rules\n"), { code: "IM_NOT_AI_FILE_HASH_MISMATCH", path: "humanize-korean/v2.3.0/references/quick-rules.md" });
});
test("im-not-ai verifier rejects a tampered MIT license with its exact target", async (t) => {
  await assertVerifierRejects(t, (root) => writeFile(path.join(root, "LICENSE"), "tampered license\n"), { code: "IM_NOT_AI_LICENSE_HASH_MISMATCH", path: "LICENSE" });
});
test("im-not-ai verifier rejects a symlinked reference with its exact target", async (t) => {
  await assertVerifierRejects(t, async (root) => { const target = path.join(root, expectedLock.tree.root, "references/quick-rules.md"); await rm(target); await symlink("rewriting-playbook.md", target); }, { code: "IM_NOT_AI_SYMLINK", path: "humanize-korean/v2.3.0/references/quick-rules.md" });
});
test("im-not-ai verifier rejects a missing reference with its exact target", async (t) => {
  await assertVerifierRejects(t, (root) => rm(path.join(root, expectedLock.tree.root, "references/rewriting-playbook.md")), { code: "IM_NOT_AI_FILE_MISSING", path: "humanize-korean/v2.3.0/references/rewriting-playbook.md" });
});
test("im-not-ai verifier rejects an untrusted repository with its exact target", async (t) => {
  await assertVerifierRejects(t, async (root) => { const lock = JSON.parse(await readFile(path.join(root, "vendor.lock.json"), "utf8")); lock.upstream.repository = "https://example.invalid/untrusted/im-not-ai"; await writeFile(path.join(root, "vendor.lock.json"), `${JSON.stringify(lock, null, 2)}\n`); }, { code: "IM_NOT_AI_UNTRUSTED_REPOSITORY", path: "upstream.repository" });
});
test("im-not-ai verifier rejects an unregistered extra reference with its exact target", async (t) => {
  await assertVerifierRejects(t, (root) => writeFile(path.join(root, expectedLock.tree.root, "references/unreviewed.md"), "unreviewed\n"), { code: "IM_NOT_AI_UNREGISTERED_FILE", path: "humanize-korean/v2.3.0/references/unreviewed.md" });
});
test("im-not-ai verifier rejects an unregistered extra script with its exact target", async (t) => {
  await assertVerifierRejects(t, async (root) => { const scripts = path.join(root, expectedLock.tree.root, "scripts"); await mkdir(scripts); await writeFile(path.join(scripts, "update.mjs"), "export default null;\n"); }, { code: "IM_NOT_AI_UNREGISTERED_FILE", path: "humanize-korean/v2.3.0/scripts/update.mjs" });
});

test("im-not-ai updater parses offline and explicitly networked modes", async () => {
  const { parseImNotAiUpdaterArgs } = await import(updaterUrl.href);
  assert.deepEqual(parseImNotAiUpdaterArgs(["--check"]), { mode: "check", network: false });
  assert.deepEqual(parseImNotAiUpdaterArgs(["--check-latest"]), { mode: "check-latest", network: true });
  assert.deepEqual(parseImNotAiUpdaterArgs(["--update"]), { mode: "update", network: true });
});
test("check-latest uses the injected release capability and leaves the tree and lock unchanged", async (t) => {
  const { checkLatestImNotAi } = await import(updaterUrl.href);
  const fixture = await copiedVendor(t);
  const before = await snapshotVendor(fixture);
  const calls = [];
  const result = await checkLatestImNotAi({ root: fixture, fetchRelease: async () => { calls.push("fetchRelease"); return futureRelease; } });
  assert.deepEqual(calls, ["fetchRelease"]);
  assert.deepEqual(result, { status: "outdated", installedTag: "v2.3.0", latestTag: "v2.3.1", updateAvailable: true });
  assert.deepEqual(await snapshotVendor(fixture), before);
});
test("update writes only a trusted future archive to staging and refreshes its lock", async (t) => {
  const { updateImNotAi } = await import(updaterUrl.href);
  const fixture = await copiedVendor(t);
  const stagingRoot = path.join(path.dirname(fixture), "staged-im-not-ai");
  const before = await snapshotVendor(fixture);
  const archive = await trustedFutureArchive(fixture);
  const calls = [];
  const result = await updateImNotAi({ root: fixture, stagingRoot, fetchRelease: async () => { calls.push("fetchRelease"); return futureRelease; }, fetchArchive: async (release) => { calls.push({ fetchArchive: release }); return archive; } });
  assert.deepEqual(calls, ["fetchRelease", { fetchArchive: futureRelease }]);
  assert.deepEqual(result, { status: "updated", tag: "v2.3.1", verifiedFiles: 15 });
  assert.deepEqual(await snapshotVendor(fixture), before, "successful update must leave the original vendor root byte-for-byte unchanged");
  assert.deepEqual(JSON.parse(await readFile(path.join(stagingRoot, "vendor.lock.json"), "utf8")), { ...expectedLock, upstream: { ...expectedLock.upstream, tag: "v2.3.1", commit: "1111111111111111111111111111111111111111", releasedAt: "2026-08-12T00:00:00Z" }, tree: { ...expectedLock.tree, root: "humanize-korean/v2.3.1" } });
  assert.deepEqual(await listRegularFiles(path.join(stagingRoot, "humanize-korean/v2.3.1")), expectedFiles);
});

test("update rejects an untrusted archive repository without staging or original writes", async (t) => {
  await assertArchiveRejectedWithoutWrites(t, (archive) => { archive.repository = "https://example.invalid/untrusted/im-not-ai"; }, { code: "IM_NOT_AI_UNTRUSTED_REPOSITORY", path: "archive.repository" });
});
test("update rejects an archive tag mismatch without staging or original writes", async (t) => {
  await assertArchiveRejectedWithoutWrites(t, (archive) => { archive.tag = "v9.9.9"; }, { code: "IM_NOT_AI_ARCHIVE_TAG_MISMATCH", path: "archive.tag" });
});
test("update rejects an archive commit mismatch without staging or original writes", async (t) => {
  await assertArchiveRejectedWithoutWrites(t, (archive) => { archive.commit = "2".repeat(40); }, { code: "IM_NOT_AI_ARCHIVE_COMMIT_MISMATCH", path: "archive.commit" });
});
test("update rejects altered archive license bytes without staging or original writes", async (t) => {
  await assertArchiveRejectedWithoutWrites(t, (archive) => { archive.files.find((file) => file.path === "LICENSE").bytes = Buffer.from("altered license\n"); }, { code: "IM_NOT_AI_LICENSE_HASH_MISMATCH", path: "archive/LICENSE" });
});
test("update rejects altered archive payload bytes without staging or original writes", async (t) => {
  await assertArchiveRejectedWithoutWrites(t, (archive) => { archive.files.find((file) => file.path === ".claude/skills/humanize-korean/references/quick-rules.md").bytes = Buffer.from("altered rules\n"); }, { code: "IM_NOT_AI_ARCHIVE_FILE_HASH_MISMATCH", path: ".claude/skills/humanize-korean/references/quick-rules.md" });
});
test("update rejects an extra archive script without staging or original writes", async (t) => {
  await assertArchiveRejectedWithoutWrites(t, (archive) => { const bytes = Buffer.from("export default null;\n"); archive.files.push({ path: "scripts/update.mjs", bytes, sha256: sha256(bytes) }); }, { code: "IM_NOT_AI_ARCHIVE_UNREGISTERED_FILE", path: "scripts/update.mjs" });
});

test("update rejects a staging root outside the vendor parent without deleting it", async (t) => {
  const fixture = await copiedVendor(t);
  const outside = await mkdtemp(path.join(tmpdir(), "unrelated-im-not-ai-"));
  await writeFile(path.join(outside, "keep.txt"), "keep\n");
  const { updateImNotAi } = await import(updaterUrl.href);
  await assert.rejects(updateImNotAi({ root: fixture, stagingRoot: outside, fetchRelease: async () => futureRelease, fetchArchive: async () => trustedFutureArchive(fixture) }), (error) => error.code === "IM_NOT_AI_UNSAFE_STAGING_ROOT");
  assert.equal(await readFile(path.join(outside, "keep.txt"), "utf8"), "keep\n");
});
