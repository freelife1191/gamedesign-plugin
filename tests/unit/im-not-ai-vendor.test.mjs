import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { cp, lstat, mkdir, mkdtemp, readFile, readdir, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const vendorRoot = path.join(repoRoot, "shared/vendor/im-not-ai");
const updaterUrl = new URL("../../tooling/sync-im-not-ai.mjs", import.meta.url);

// Everything the vendored tree is expected to be comes from the pin, not from literals copied beside it.
// A copied table means every upgrade edits this file too, and an upgrade that forgets it fails here for
// a reason that has nothing to do with the upgrade.
const pin = JSON.parse(await readFile(path.join(repoRoot, "tooling/vendor-pins/im-not-ai.json"), "utf8"));
const expectedFiles = pin.files.map(({ path: file, sha256: hash, size }) => ({ path: file, sha256: hash, size }));
const treeRoot = `humanize-korean/${pin.tag}`;

const expectedLock = {
  schemaVersion: 1,
  upstream: {
    repository: pin.repository,
    tag: pin.tag,
    commit: pin.commit,
    releasedAt: pin.releasedAt,
    skillPath: pin.skillPath,
    referencesSource: pin.referencesSource,
  },
  license: { spdx: "MIT", path: "LICENSE", sha256: pin.licenseSha256 },
  tree: { root: treeRoot, files: expectedFiles },
};

// A release strictly newer than whatever is pinned, so these fixtures stay valid across upgrades.
const futureTag = `v${pin.tag.slice(1).split(".").map((part, index) => (index === 2 ? Number(part) + 1 : part)).join(".")}`;
const sourcePathOf = (file) => (file.path === "SKILL.md" ? `${pin.skillPath}/SKILL.md` : `${pin.referencesSource}/${file.path.slice("references/".length)}`);
const futureClosureFiles = [
  { path: "LICENSE", sha256: pin.licenseSha256, size: 1066 },
  ...expectedFiles.map((file) => ({ path: sourcePathOf(file), sha256: file.sha256, size: file.size })),
];
const futureClosure = { files: futureClosureFiles, licenseSha256: pin.licenseSha256, digest: createHash("sha256").update(Buffer.from(JSON.stringify(futureClosureFiles.map(({ path: filePath, sha256: hash, size }) => ({ path: filePath, sha256: hash, size })).sort((a, b) => a.path.localeCompare(b.path))))).digest("hex") };
const futureRelease = { repository: pin.repository, tag: futureTag, commit: "1111111111111111111111111111111111111111", releasedAt: "2026-08-12T00:00:00Z", closure: futureClosure };

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
  for (const literal of [pin.repository, pin.tag, "MIT", expectedLock.license.sha256]) assert.ok(notices.includes(literal), `MIT notice retains ${literal}`);
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
      ...await Promise.all(expectedFiles.filter((file) => file.path.startsWith("references/")).map((file) => completeFile(`${expectedLock.tree.root}/${file.path}`, sourcePathOf(file)))),
    ],
  };
}

function runNode(args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { stdio: ["ignore", "pipe", "pipe"], ...options });
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
  // --experimental-loader and --import take a module specifier, not a filesystem path. A POSIX
  // absolute path happens to resolve as one; a Windows one is read as the scheme `c:` and the loader
  // refuses it outright.
  const result = await runNode(["--experimental-loader", pathToFileURL(loaderPath).href, runnerPath, updaterUrl.href]);
  assert.equal(result.exitCode, 0, result.stderr);
  assert.equal(result.stdout, "offline-verifier-imported\n");
  assert.match(result.stderr, /ExperimentalWarning/u);
});

test("pure offline verifier accepts the pinned vendor without a network capability", async () => {
  const { verifyVendoredImNotAi } = await import(updaterUrl.href);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("pure verifier must not call global fetch"); };
  try {
    assert.deepEqual(await verifyVendoredImNotAi({ root: vendorRoot }), { verifiedFiles: expectedFiles.length, tag: pin.tag });
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
  await assertVerifierRejects(t, (root) => writeFile(path.join(root, expectedLock.tree.root, "references/quick-rules.md"), "tampered quick rules\n"), { code: "IM_NOT_AI_FILE_HASH_MISMATCH", path: `${treeRoot}/references/quick-rules.md` });
});
test("im-not-ai verifier rejects a tampered MIT license with its exact target", async (t) => {
  await assertVerifierRejects(t, (root) => writeFile(path.join(root, "LICENSE"), "tampered license\n"), { code: "IM_NOT_AI_LICENSE_HASH_MISMATCH", path: "LICENSE" });
});
test("im-not-ai verifier rejects a symlinked reference with its exact target", async (t) => {
  await assertVerifierRejects(t, async (root) => { const target = path.join(root, expectedLock.tree.root, "references/quick-rules.md"); await rm(target); await symlink("rewriting-playbook.md", target); }, { code: "IM_NOT_AI_SYMLINK", path: `${treeRoot}/references/quick-rules.md` });
});
test("im-not-ai verifier rejects a missing reference with its exact target", async (t) => {
  await assertVerifierRejects(t, (root) => rm(path.join(root, expectedLock.tree.root, "references/rewriting-playbook.md")), { code: "IM_NOT_AI_FILE_MISSING", path: `${treeRoot}/references/rewriting-playbook.md` });
});
test("im-not-ai verifier rejects an untrusted repository with its exact target", async (t) => {
  await assertVerifierRejects(t, async (root) => { const lock = JSON.parse(await readFile(path.join(root, "vendor.lock.json"), "utf8")); lock.upstream.repository = "https://example.invalid/untrusted/im-not-ai"; await writeFile(path.join(root, "vendor.lock.json"), `${JSON.stringify(lock, null, 2)}\n`); }, { code: "IM_NOT_AI_UNTRUSTED_REPOSITORY", path: "upstream.repository" });
});
test("im-not-ai verifier rejects an unregistered extra reference with its exact target", async (t) => {
  await assertVerifierRejects(t, (root) => writeFile(path.join(root, expectedLock.tree.root, "references/unreviewed.md"), "unreviewed\n"), { code: "IM_NOT_AI_UNREGISTERED_FILE", path: `${treeRoot}/references/unreviewed.md` });
});
test("im-not-ai verifier rejects an unregistered extra script with its exact target", async (t) => {
  await assertVerifierRejects(t, async (root) => { const scripts = path.join(root, expectedLock.tree.root, "scripts"); await mkdir(scripts); await writeFile(path.join(scripts, "update.mjs"), "export default null;\n"); }, { code: "IM_NOT_AI_UNREGISTERED_FILE", path: `${treeRoot}/scripts/update.mjs` });
});

test("im-not-ai updater parses offline and explicitly networked modes", async () => {
  const { parseImNotAiUpdaterArgs } = await import(updaterUrl.href);
  assert.deepEqual(parseImNotAiUpdaterArgs(["--check"]), { mode: "check", network: false, referencesSource: undefined });
  assert.deepEqual(parseImNotAiUpdaterArgs(["--check-latest"]), { mode: "check-latest", network: true, referencesSource: undefined });
  assert.deepEqual(parseImNotAiUpdaterArgs(["--update"]), { mode: "update", network: true, referencesSource: undefined });
  // An upstream release can move the directory the references come from. That is a reviewed decision an
  // operator types, so it rides on the upgrade and nowhere else.
  assert.deepEqual(
    parseImNotAiUpdaterArgs(["--update", "--references-source", "skills/humanize-korean/references"]),
    { mode: "update", network: true, referencesSource: "skills/humanize-korean/references" },
  );
  assert.throws(() => parseImNotAiUpdaterArgs(["--check", "--references-source", "skills/x"]), /Usage/u);
  for (const hostile of ["/etc", "../escape", "skills\\windows", "skills/../..", ""]) {
    assert.throws(() => parseImNotAiUpdaterArgs(["--update", "--references-source", hostile]), (error) => {
      assert.equal(error.code, "IM_NOT_AI_REFERENCE_SOURCE_INVALID");
      return true;
    }, hostile);
  }
});
test("official latest adapter selects stable SemVer and peels an annotated tag to an immutable commit", async () => {
  const { fetchOfficialLatestImNotAiRelease } = await import(updaterUrl.href);
  const calls = [];
  const result = await fetchOfficialLatestImNotAiRelease({ fetchJsonImpl: async (url) => {
    calls.push(url);
    if (url.endsWith("releases?per_page=100")) return [{ tag_name: "v2.3.0", published_at: "2026-07-22T00:00:00Z", draft: false, prerelease: false }, { tag_name: "v2.4.0-rc.1", draft: false, prerelease: true }, { tag_name: "v2.3.1", published_at: "2026-08-12T00:00:00Z", draft: false, prerelease: false }];
    if (url.endsWith("ref/tags/v2.3.1")) return { object: { type: "tag", sha: "a".repeat(40) } };
    if (url.endsWith(`git/tags/${"a".repeat(40)}`)) return { object: { type: "commit", sha: "b".repeat(40) } };
    throw new Error(url);
  } });
  assert.deepEqual(result, { repository: "https://github.com/epoko77-ai/im-not-ai", tag: "v2.3.1", commit: "b".repeat(40), releasedAt: "2026-08-12T00:00:00Z" });
  assert.equal(calls.some((url) => url.includes("raw.githubusercontent.com")), false);
});
test("check-latest uses the injected release capability and leaves the tree and lock unchanged", async (t) => {
  const { checkLatestImNotAi } = await import(updaterUrl.href);
  const fixture = await copiedVendor(t);
  const before = await snapshotVendor(fixture);
  const calls = [];
  const result = await checkLatestImNotAi({ root: fixture, fetchRelease: async () => { calls.push("fetchRelease"); return futureRelease; } });
  assert.deepEqual(calls, ["fetchRelease"]);
  assert.deepEqual(result, { status: "outdated", installedTag: pin.tag, latestTag: futureTag, updateAvailable: true });
  assert.deepEqual(await snapshotVendor(fixture), before);
});
test("update prepares a private sibling stage and publishes only through its opaque receipt", async (t) => {
  const { updateImNotAi } = await import(updaterUrl.href);
  const fixture = await copiedVendor(t);
  const before = await snapshotVendor(fixture);
  const archive = await trustedFutureArchive(fixture);
  const calls = [];
  const result = await updateImNotAi({ root: fixture, fetchRelease: async () => { calls.push("fetchRelease"); return futureRelease; }, fetchArchive: async (release) => { calls.push({ fetchArchive: release }); return archive; } });
  assert.deepEqual(calls, ["fetchRelease", { fetchArchive: futureRelease }]);
  assert.deepEqual({ status: result.status, tag: result.tag, verifiedFiles: result.verifiedFiles }, { status: "updated", tag: futureTag, verifiedFiles: expectedFiles.length });
  assert.equal(typeof result.publish, "function");
  assert.deepEqual(await snapshotVendor(fixture), before, "successful update must leave the original vendor root byte-for-byte unchanged");
  await result.publish();
  assert.deepEqual(JSON.parse(await readFile(path.join(fixture, "vendor.lock.json"), "utf8")), { ...expectedLock, upstream: { ...expectedLock.upstream, tag: futureTag, commit: "1111111111111111111111111111111111111111", releasedAt: "2026-08-12T00:00:00Z" }, tree: { ...expectedLock.tree, root: `humanize-korean/${futureTag}` } });
  assert.deepEqual(await listRegularFiles(path.join(fixture, `humanize-korean/${futureTag}`)), expectedFiles);
  assert.equal((await readdir(path.dirname(fixture))).some((entry) => entry.startsWith(".im-not-ai.stage-")), false, "published private stage must be removed");
});

test("real --update CLI builds a private sibling stage and atomically publishes the verified archive", async (t) => {
  // Realpath at creation, not at the assertion. Windows hands out the 8.3 form of the temp directory
  // (C:\Users\RUNNER~1\...) while realpath answers the long profile name, so a fixture that keeps the
  // raw mkdtemp path and an expectation that realpaths it are two different strings for one directory.
  const fixtureRoot = await realpath(await mkdtemp(path.join(tmpdir(), "im-not-ai-cli-update-")));
  t.after(() => rm(fixtureRoot, { recursive: true, force: true }));
  await mkdir(path.join(fixtureRoot, "tooling"));
  await mkdir(path.join(fixtureRoot, "shared/vendor"), { recursive: true });
  await cp(new URL("../../tooling/sync-im-not-ai.mjs", import.meta.url), path.join(fixtureRoot, "tooling/sync-im-not-ai.mjs"));
  // The staged tree has to carry everything the staged tool imports, not just the tool. The platform
  // hardening primitive is one of those: the tool asks it which open flags this host can actually offer,
  // so a stage without it fails to resolve a module rather than failing the check it was staged to run.
  await mkdir(path.join(fixtureRoot, "shared/scripts/lib"), { recursive: true });
  await cp(
    new URL("../../shared/scripts/lib/platform-file-hardening.mjs", import.meta.url),
    path.join(fixtureRoot, "shared/scripts/lib/platform-file-hardening.mjs"),
  );
  await cp(vendorRoot, path.join(fixtureRoot, "shared/vendor/im-not-ai"), { recursive: true });
  await mkdir(path.join(fixtureRoot, "tooling/vendor-pins"), { recursive: true });
  await cp(new URL("../../tooling/vendor-pins/im-not-ai.json", import.meta.url), path.join(fixtureRoot, "tooling/vendor-pins/im-not-ai.json"));
  const preload = path.join(fixtureRoot, "mock-official-im-not-ai.mjs");
  await writeFile(preload, `
import { readFile } from "node:fs/promises";
import path from "node:path";
const root = process.env.IM_NOT_AI_CLI_FIXTURE_ROOT;
const vendor = path.join(root, "shared/vendor/im-not-ai");
const tree = "${treeRoot}";
const commit = "${futureRelease.commit}";
globalThis.fetch = async (url) => {
  if (url.includes("/releases?")) return { ok: true, json: async () => [{ tag_name: "${futureTag}", published_at: "2026-08-12T00:00:00Z", draft: false, prerelease: false }] };
  if (url.includes("/git/ref/tags/${futureTag}")) return { ok: true, json: async () => ({ object: { type: "commit", sha: commit } }) };
  // The upstream release drops one pinned reference file and adds one the pin does not carry. The
  // upgrade has to follow the removal and report the addition without pulling it in.
  if (url.includes("/contents/")) {
    const { readdir } = await import("node:fs/promises");
    const names = (await readdir(path.join(vendor, tree, "references")))
      .filter((name) => name !== "metrics.py")
      .map((name) => ({ type: "file", name }));
    return { ok: true, json: async () => [...names, { type: "file", name: "brand-new-reference.md" }] };
  }
  const marker = \`raw.githubusercontent.com/epoko77-ai/im-not-ai/\${commit}/\`;
  const source = url.slice(url.indexOf(marker) + marker.length);
  const local = source === "LICENSE" ? path.join(vendor, "LICENSE")
    : source === "codex/skills/humanize-korean/SKILL.md" ? path.join(vendor, tree, "SKILL.md")
      : path.join(vendor, tree, "references", path.basename(source));
  const bytes = await readFile(local);
  return { ok: true, arrayBuffer: async () => bytes };
};
`);
  const result = await runNode(["--import", pathToFileURL(preload).href, path.join(fixtureRoot, "tooling/sync-im-not-ai.mjs"), "--update"], { env: { ...process.env, IM_NOT_AI_CLI_FIXTURE_ROOT: fixtureRoot } });
  assert.equal(result.exitCode, 0, result.stderr);
  assert.match(result.stdout, /\S/u, `CLI produced no result: ${result.stderr}`);
  const pinPath = path.join(fixtureRoot, "tooling/vendor-pins/im-not-ai.json");
  assert.deepEqual(JSON.parse(result.stdout), {
    status: "published",
    root: path.join(fixtureRoot, "shared/vendor/im-not-ai"),
    tag: futureTag,
    unpinnedUpstreamFiles: ["brand-new-reference.md"],
    removedUpstreamFiles: ["references/metrics.py"],
    pin: { pinPath, tag: futureTag, files: expectedFiles.length - 1 },
  });
  const installed = path.join(fixtureRoot, "shared/vendor/im-not-ai");
  const publishedLock = JSON.parse(await readFile(path.join(installed, "vendor.lock.json"), "utf8"));
  assert.equal(publishedLock.upstream.tag, futureTag);
  // The pin is the witness the next `--check` compares against. An upgrade that moved the tree but left
  // the pin behind would fail that check until someone hand-transcribed fifteen digests, so the upgrade
  // carries the pin with it.
  const published = JSON.parse(await readFile(pinPath, "utf8"));
  assert.equal(published.tag, futureTag);
  assert.equal(published.commit, publishedLock.upstream.commit);
  assert.deepEqual(published.files, publishedLock.tree.files.map(({ path: file, sha256, size }) => ({ path: file, sha256, size })));
  // Following the removal is the point: keeping a file the release deleted would ship something that
  // release does not contain. Not following the addition is equally the point: the allowlist is reviewed.
  assert.equal(published.files.some(({ path: file }) => file === "references/metrics.py"), false, "the deleted file is gone from the pin");
  assert.equal(published.files.some(({ path: file }) => file === "references/brand-new-reference.md"), false, "an added file is reported, never vendored");
  await assert.rejects(readFile(path.join(installed, publishedLock.tree.root, "references/metrics.py")), /ENOENT/u);
  assert.equal((await readdir(path.dirname(installed))).some((entry) => entry.startsWith(".im-not-ai.stage-") || entry.startsWith(".im-not-ai.backup-")), false);
});

test("publish accepts only the opaque prepared receipt and never an arbitrary staging path", async (t) => {
  const { publishPreparedImNotAi } = await import(updaterUrl.href);
  const fixture = await copiedVendor(t);
  const before = await snapshotVendor(fixture);
  const arbitraryStage = path.join(path.dirname(fixture), "attacker-controlled-stage");
  await mkdir(arbitraryStage);
  await writeFile(path.join(arbitraryStage, "vendor.lock.json"), "{}\n");
  await assert.rejects(
    publishPreparedImNotAi({ root: fixture, stagingRoot: arbitraryStage }),
    (error) => error.code === "IM_NOT_AI_PREPARED_CAPABILITY_REQUIRED",
  );
  assert.deepEqual(await snapshotVendor(fixture), before, "untrusted stage rejection must perform zero vendor writes");
  assert.equal((await lstat(arbitraryStage)).isDirectory(), true, "untrusted stage must remain untouched");
});

test("prepared publish rolls back the old vendor and removes its private stage when the final rename fails", async (t) => {
  const { updateImNotAi } = await import(updaterUrl.href);
  const fixture = await copiedVendor(t);
  const before = await snapshotVendor(fixture);
  const prepared = await updateImNotAi({ root: fixture, fetchRelease: async () => futureRelease, fetchArchive: async () => trustedFutureArchive(fixture) });
  let renames = 0;
  await assert.rejects(
    prepared.publish({ fsOps: { rename: async (...args) => {
      renames += 1;
      if (renames === 2) throw Object.assign(new Error("injected final rename failure"), { code: "EIO" });
      return (await import("node:fs/promises")).rename(...args);
    } } }),
    /injected final rename failure/u,
  );
  assert.deepEqual(await snapshotVendor(fixture), before, "failed publish must restore the prior vendor byte-for-byte");
  const siblings = await readdir(path.dirname(fixture));
  assert.equal(siblings.some((entry) => entry.startsWith(".im-not-ai.stage-")), false, "failed publish must clean its private stage");
});

test("a post-rename race that tampers with the new vendor is detected and rolled back", async (t) => {
  const { updateImNotAi } = await import(updaterUrl.href);
  const fixture = await copiedVendor(t);
  const before = await snapshotVendor(fixture);
  const prepared = await updateImNotAi({ root: fixture, fetchRelease: async () => futureRelease, fetchArchive: async () => trustedFutureArchive(fixture) });
  let renames = 0;
  await assert.rejects(
    prepared.publish({ fsOps: { rename: async (...args) => {
      renames += 1;
      await (await import("node:fs/promises")).rename(...args);
      if (renames === 2) await writeFile(path.join(args[1], "LICENSE"), "race-tampered\n");
    } } }),
    (error) => error.code === "IM_NOT_AI_STAGE_VERIFICATION_FAILED",
  );
  assert.deepEqual(await snapshotVendor(fixture), before, "post-rename tampering must restore the old vendor");
  assert.equal((await readdir(path.dirname(fixture))).some((entry) => entry.startsWith(".im-not-ai.backup-") || entry.startsWith(".im-not-ai.rejected-") || entry.startsWith(".im-not-ai.stage-")), false);
});

test("tampered or symlinked private staging is rejected before vendor rename and cleaned up", async (t) => {
  const { updateImNotAi } = await import(updaterUrl.href);
  const fixture = await copiedVendor(t);
  const before = await snapshotVendor(fixture);
  const prepared = await updateImNotAi({ root: fixture, fetchRelease: async () => futureRelease, fetchArchive: async () => trustedFutureArchive(fixture) });
  const parent = path.dirname(fixture);
  const stage = (await readdir(parent)).find((entry) => entry.startsWith(".im-not-ai.stage-"));
  assert.ok(stage, "private stage exists only while its opaque receipt is live");
  const target = path.join(parent, stage, `humanize-korean/${futureTag}/references/quick-rules.md`);
  await rm(target);
  await symlink("rewriting-playbook.md", target);
  await assert.rejects(prepared.publish(), (error) => error.code === "IM_NOT_AI_SYMLINK");
  assert.deepEqual(await snapshotVendor(fixture), before, "stage tampering must perform zero writes to the vendor root");
  assert.equal((await readdir(parent)).some((entry) => entry === stage), false, "rejected private stage must be removed");
});

test("injected private stage write failure preserves the original vendor and cleans the temp directory", async (t) => {
  const { updateImNotAi } = await import(updaterUrl.href);
  const fixture = await copiedVendor(t);
  const before = await snapshotVendor(fixture);
  await assert.rejects(
    updateImNotAi({
      root: fixture,
      fetchRelease: async () => futureRelease,
      fetchArchive: async () => trustedFutureArchive(fixture),
      fsOps: { open: async () => { throw Object.assign(new Error("injected stage write failure"), { code: "EIO" }); } },
    }),
    /injected stage write failure/u,
  );
  assert.deepEqual(await snapshotVendor(fixture), before);
  assert.equal((await readdir(path.dirname(fixture))).some((entry) => entry.startsWith(".im-not-ai.stage-")), false);
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
  await assertArchiveRejectedWithoutWrites(t, (archive) => { archive.files.find((file) => file.path === `${pin.referencesSource}/quick-rules.md`).bytes = Buffer.from("altered rules\n"); }, { code: "IM_NOT_AI_ARCHIVE_FILE_HASH_MISMATCH", path: `${pin.referencesSource}/quick-rules.md` });
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
