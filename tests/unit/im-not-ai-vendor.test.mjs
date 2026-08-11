import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { cp, lstat, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const vendorRoot = path.join(repoRoot, "shared/vendor/im-not-ai");
const bundleRoot = path.join(vendorRoot, "humanize-korean/v2.3.0");
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
  upstream: {
    repository: "https://github.com/epoko77-ai/im-not-ai",
    tag: "v2.3.0",
    commit: "82137e858763dadb99561f194c5c00465735017b",
    releasedAt: "2026-07-22T06:28:52Z",
    skillPath: "codex/skills/humanize-korean",
    referencesSource: ".claude/skills/humanize-korean/references",
  },
  license: {
    spdx: "MIT",
    path: "LICENSE",
    sha256: "4cc7e8c439fe42f09d98457599c129ea6df9e5d0e622750d75952b441a38343f",
  },
  tree: {
    root: "humanize-korean/v2.3.0",
    files: expectedFiles,
  },
};

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
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
  for (const filename of ["LICENSE", "THIRD_PARTY_NOTICES.md"]) {
    const stat = await lstat(path.join(root, filename));
    assert.equal(stat.isFile() && !stat.isSymbolicLink(), true, `regular attribution file: ${filename}`);
  }
  assert.equal(sha256(await readFile(path.join(root, "LICENSE"))), expectedLock.license.sha256);
  for (const file of expectedFiles) {
    const target = path.join(root, expectedLock.tree.root, file.path);
    const stat = await lstat(target);
    assert.equal(stat.isFile() && !stat.isSymbolicLink(), true, `regular vendored file: ${file.path}`);
    const bytes = await readFile(target);
    assert.equal(bytes.length, file.size, `byte length: ${file.path}`);
    assert.equal(sha256(bytes), file.sha256, `SHA-256: ${file.path}`);
  }
  const notices = await readFile(path.join(root, "THIRD_PARTY_NOTICES.md"), "utf8");
  for (const literal of [
    "https://github.com/epoko77-ai/im-not-ai",
    "v2.3.0",
    "MIT",
    "4cc7e8c439fe42f09d98457599c129ea6df9e5d0e622750d75952b441a38343f",
  ]) assert.ok(notices.includes(literal), `MIT notice retains ${literal}`);
  assert.deepEqual(parseFrontmatter(await readFile(path.join(root, expectedLock.tree.root, "SKILL.md"), "utf8")).name, "humanize-korean");
}

async function copiedVendor(t) {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), "im-not-ai-vendor-"));
  t.after(() => rm(temporaryRoot, { recursive: true, force: true }));
  const fixture = path.join(temporaryRoot, "im-not-ai");
  await cp(vendorRoot, fixture, { recursive: true });
  return fixture;
}

test("im-not-ai vendor lock pins the official release, MIT license, and deterministic tree", async () => {
  await assertLiteralVendorTree();
  const { verifyImNotAiVendorRoot } = await import(updaterUrl.href);
  assert.equal(await verifyImNotAiVendorRoot(vendorRoot), expectedFiles.length);
});

test("im-not-ai verifier rejects each independent trust-boundary mutation", async (t) => {
  const mutations = [
    ["tag", async (root) => {
      const lock = JSON.parse(await readFile(path.join(root, "vendor.lock.json"), "utf8"));
      lock.upstream.tag = "v9.9.9";
      await writeFile(path.join(root, "vendor.lock.json"), `${JSON.stringify(lock, null, 2)}\n`);
    }, /tag/u],
    ["commit", async (root) => {
      const lock = JSON.parse(await readFile(path.join(root, "vendor.lock.json"), "utf8"));
      lock.upstream.commit = "0".repeat(40);
      await writeFile(path.join(root, "vendor.lock.json"), `${JSON.stringify(lock, null, 2)}\n`);
    }, /commit/u],
    ["file hash", async (root) => {
      const lock = JSON.parse(await readFile(path.join(root, "vendor.lock.json"), "utf8"));
      lock.tree.files[0].sha256 = "0".repeat(64);
      await writeFile(path.join(root, "vendor.lock.json"), `${JSON.stringify(lock, null, 2)}\n`);
    }, /hash|digest/u],
    ["license", async (root) => writeFile(path.join(root, "LICENSE"), "tampered license\n"), /license|hash|digest/u],
    ["symlink", async (root) => {
      const target = path.join(root, expectedLock.tree.root, "references/quick-rules.md");
      await rm(target);
      await symlink("../rewriting-playbook.md", target);
    }, /symlink/u],
    ["missing reference", async (root) => rm(path.join(root, expectedLock.tree.root, "references/rewriting-playbook.md")), /missing/u],
    ["untrusted repository", async (root) => {
      const lock = JSON.parse(await readFile(path.join(root, "vendor.lock.json"), "utf8"));
      lock.upstream.repository = "https://example.invalid/untrusted/im-not-ai";
      await writeFile(path.join(root, "vendor.lock.json"), `${JSON.stringify(lock, null, 2)}\n`);
    }, /repository|upstream|trusted/u],
  ];

  for (const [label, mutate, error] of mutations) {
    await t.test(label, async (t) => {
      const { verifyImNotAiVendorRoot } = await import(updaterUrl.href);
      const fixture = await copiedVendor(t);
      await mutate(fixture);
      await assert.rejects(verifyImNotAiVendorRoot(fixture), error, `${label} mutation must be rejected`);
    });
  }
});

test("im-not-ai updater exposes offline verification and explicit networked release modes", async () => {
  const { parseImNotAiUpdaterArgs, runImNotAiUpdater } = await import(updaterUrl.href);
  assert.deepEqual(parseImNotAiUpdaterArgs(["--check"]), { mode: "check", network: false });
  assert.deepEqual(parseImNotAiUpdaterArgs(["--check-latest"]), { mode: "check-latest", network: true });
  assert.deepEqual(parseImNotAiUpdaterArgs(["--update"]), { mode: "update", network: true });
  let fetchCalls = 0;
  await runImNotAiUpdater({
    args: ["--check"],
    repoRoot,
    fetchImpl: async () => {
      fetchCalls += 1;
      throw new Error("offline check must not fetch");
    },
  });
  assert.equal(fetchCalls, 0, "offline --check must not access the network");
});
