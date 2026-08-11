import { createHash } from "node:crypto";
import { lstat, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const OFFICIAL_REPOSITORY = "https://github.com/epoko77-ai/im-not-ai";
const PINNED = Object.freeze({
  tag: "v2.3.0",
  commit: "82137e858763dadb99561f194c5c00465735017b",
  releasedAt: "2026-07-22T06:28:52Z",
  skillPath: "codex/skills/humanize-korean",
  referencesSource: ".claude/skills/humanize-korean/references",
  licenseSha256: "4cc7e8c439fe42f09d98457599c129ea6df9e5d0e622750d75952b441a38343f",
});
const PINNED_FILES = Object.freeze([
  ["SKILL.md", "6c34dbf00c23ee52e5cb374273952dab9bb5d38552cf1fb7a90ed42854ee304f", 4352],
  ["references/ai-tell-taxonomy.md", "57b7b40bc90d927d1b76cd4325ae5a58c92d18a20615339b19bc5eac776a6940", 77157],
  ["references/baseline.json", "3880335a2b760fd505531e303ff9fff7f0725f8f2e98dc965a7808c21616d958", 6139],
  ["references/baseline_v2.json", "b5f1725bd02fb4cc40eece68c5b8f1d7c7655775743196d8fd0bc5978f2ed916", 13487],
  ["references/design-notes.md", "e350884ca1cb10c248d247b7fc2b5236211489757bf65a72360434f0254ae293", 5940],
  ["references/diagnosis-rules.md", "0a8d2c1ddf4b7294b66ddc549d0600fd74c41a187d6501869cb8c9c4d7d0456a", 13082],
  ["references/empirical-validation.md", "d23302029934de04baecb48759ca7d804d98e861341edec315ac4a1fc40ce31f", 8339],
  ["references/metrics.py", "a665faef60c88a045e232ac633fe19335d123a58a5dd8e493708c7c5954a5f60", 14550],
  ["references/metrics_v2.py", "97343e74d16d71eeaae773cfb2e3b5970bd395239b1457b9ca6e8bebae2740bd", 31314],
  ["references/quick-rules.footer.md", "933c5300b71fdf6eecc0ec0788910afd9a166ce7969ba129e2029ced000f2335", 1920],
  ["references/quick-rules.header.md", "e129aa91bfe74433d81ff6817e934a233a9a7febd85f1f9484eca1ced33c1c13", 1156],
  ["references/quick-rules.md", "cc8947e145a34af000b3684ef09ed62c51c0b35080f43b96bcd38e2ff98d28ef", 10040],
  ["references/rewriting-playbook.md", "854b9e8fa552747972c319d6b409a00a74ed5afcb69eed019dfc5092238be721", 12133],
  ["references/scholarship.md", "e83346a5b0147a923b725295cbee6b7fa3b22020840b5eee95c35f615b182e64", 35541],
  ["references/web-service-spec.md", "be887c5e60b9a37e63a4aa8156ada0da4298098a51451925a3a22b9a37e25f6a", 8010],
]);
const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));
const DEFAULT_VENDOR_ROOT = path.join(REPO_ROOT, "shared/vendor/im-not-ai");

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function vendorError(code, target) {
  const error = new Error(`${code}: ${target}`);
  error.code = code;
  error.path = target;
  return error;
}

function compareSemver(left, right) {
  const parse = (tag) => {
    const match = /^v?(\d+)\.(\d+)\.(\d+)$/u.exec(tag);
    if (!match) throw new Error(`Stable SemVer tag required: ${tag}`);
    return match.slice(1).map(Number);
  };
  const a = parse(left);
  const b = parse(right);
  for (let index = 0; index < a.length; index += 1) if (a[index] !== b[index]) return a[index] - b[index];
  return 0;
}

async function readJson(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

async function regularFiles(root, prefix = "") {
  const output = [];
  const entries = await readdir(root, { withFileTypes: true }).catch((error) => {
    if (error.code === "ENOENT") throw vendorError("IM_NOT_AI_FILE_MISSING", prefix || ".");
    throw error;
  });
  for (const entry of entries) {
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
    const absolutePath = path.join(root, entry.name);
    const stat = await lstat(absolutePath);
    if (stat.isSymbolicLink()) throw vendorError("IM_NOT_AI_SYMLINK", relativePath);
    if (stat.isDirectory()) output.push(...await regularFiles(absolutePath, relativePath));
    else if (stat.isFile()) output.push({ path: relativePath, bytes: await readFile(absolutePath) });
    else throw vendorError("IM_NOT_AI_NON_REGULAR_FILE", relativePath);
  }
  return output.sort((left, right) => left.path.localeCompare(right.path));
}

function expectedLockRecord(index) {
  return { path: `tree.files[${index}].sha256`, code: "IM_NOT_AI_LOCK_FILE_HASH_MISMATCH" };
}

/** Verify the pinned vendor tree without accepting a network capability. */
export async function verifyVendoredImNotAi({ root = DEFAULT_VENDOR_ROOT } = {}) {
  const lock = await readJson(path.join(root, "vendor.lock.json"));
  if (lock?.upstream?.repository !== OFFICIAL_REPOSITORY) throw vendorError("IM_NOT_AI_UNTRUSTED_REPOSITORY", "upstream.repository");
  if (lock?.upstream?.tag !== PINNED.tag) throw vendorError("IM_NOT_AI_UPSTREAM_TAG_MISMATCH", "upstream.tag");
  if (lock?.upstream?.commit !== PINNED.commit) throw vendorError("IM_NOT_AI_UPSTREAM_COMMIT_MISMATCH", "upstream.commit");
  if (lock?.upstream?.releasedAt !== PINNED.releasedAt) throw vendorError("IM_NOT_AI_RELEASE_TIME_MISMATCH", "upstream.releasedAt");
  if (lock?.upstream?.skillPath !== PINNED.skillPath) throw vendorError("IM_NOT_AI_SKILL_PATH_MISMATCH", "upstream.skillPath");
  if (lock?.upstream?.referencesSource !== PINNED.referencesSource) throw vendorError("IM_NOT_AI_REFERENCE_SOURCE_MISMATCH", "upstream.referencesSource");
  if (lock?.license?.spdx !== "MIT") throw vendorError("IM_NOT_AI_LICENSE_MISMATCH", "license.spdx");
  if (lock?.license?.path !== "LICENSE") throw vendorError("IM_NOT_AI_LICENSE_PATH_MISMATCH", "license.path");
  if (lock?.license?.sha256 !== PINNED.licenseSha256) throw vendorError("IM_NOT_AI_LICENSE_HASH_MISMATCH", "license.sha256");
  if (!Array.isArray(lock?.tree?.files)) throw vendorError("IM_NOT_AI_LOCK_TREE_INVALID", "tree.files");
  if (lock.tree.root !== `humanize-korean/${PINNED.tag}`) throw vendorError("IM_NOT_AI_TREE_ROOT_MISMATCH", "tree.root");

  const files = lock.tree.files;
  if (files.length !== PINNED_FILES.length) throw vendorError("IM_NOT_AI_LOCK_FILE_COUNT_MISMATCH", "tree.files");
  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    const [expectedPath, expectedHash, expectedSize] = PINNED_FILES[index];
    if (!file || file.path !== expectedPath || file.sha256 !== expectedHash || file.size !== expectedSize) {
      throw vendorError(expectedLockRecord(index).code, expectedLockRecord(index).path);
    }
    const source = path.join(root, lock.tree.root, ...file.path.split("/"));
    const stat = await lstat(source).catch((error) => {
      if (error.code === "ENOENT") throw vendorError("IM_NOT_AI_FILE_MISSING", `${lock.tree.root}/${file.path}`);
      throw error;
    });
    if (stat.isSymbolicLink()) throw vendorError("IM_NOT_AI_SYMLINK", `${lock.tree.root}/${file.path}`);
    if (!stat.isFile()) throw vendorError("IM_NOT_AI_NON_REGULAR_FILE", `${lock.tree.root}/${file.path}`);
    const bytes = await readFile(source);
    if (bytes.length !== file.size || sha256(bytes) !== file.sha256) throw vendorError("IM_NOT_AI_FILE_HASH_MISMATCH", `${lock.tree.root}/${file.path}`);
  }

  const license = await readFile(path.join(root, "LICENSE")).catch((error) => {
    if (error.code === "ENOENT") throw vendorError("IM_NOT_AI_FILE_MISSING", "LICENSE");
    throw error;
  });
  if (sha256(license) !== lock.license.sha256) throw vendorError("IM_NOT_AI_LICENSE_HASH_MISMATCH", "LICENSE");

  const expected = new Set([
    "LICENSE",
    "THIRD_PARTY_NOTICES.md",
    "vendor.lock.json",
    ...files.map((file) => `${lock.tree.root}/${file.path}`),
  ]);
  for (const file of await regularFiles(root)) if (!expected.has(file.path)) throw vendorError("IM_NOT_AI_UNREGISTERED_FILE", file.path);
  return { verifiedFiles: files.length, tag: lock.upstream.tag };
}

export function parseImNotAiUpdaterArgs(args) {
  if (args.length !== 1 || !["--check", "--check-latest", "--update"].includes(args[0])) {
    throw new Error("Usage: node tooling/sync-im-not-ai.mjs --check|--check-latest|--update");
  }
  return { mode: args[0].slice(2), network: args[0] !== "--check" };
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { accept: "application/vnd.github+json", "user-agent": "game-design-plugin-vendor-sync" } });
  if (!response.ok) throw new Error(`Official im-not-ai request failed: ${response.status}`);
  return response.json();
}

async function officialLatestRelease() {
  const release = await fetchJson("https://api.github.com/repos/epoko77-ai/im-not-ai/releases/latest");
  const ref = await fetchJson(`https://api.github.com/repos/epoko77-ai/im-not-ai/git/ref/tags/${encodeURIComponent(release.tag_name)}`);
  const commit = ref.object?.type === "commit" ? ref.object.sha : undefined;
  if (!commit || !/^[a-f0-9]{40}$/u.test(commit)) throw new Error("Official release tag must resolve to a commit");
  return { repository: OFFICIAL_REPOSITORY, tag: release.tag_name, commit, releasedAt: release.published_at };
}

export async function checkLatestImNotAi({ root = DEFAULT_VENDOR_ROOT, fetchRelease = officialLatestRelease } = {}) {
  const lock = await readJson(path.join(root, "vendor.lock.json"));
  const latest = await fetchRelease();
  if (latest.repository !== OFFICIAL_REPOSITORY) throw vendorError("IM_NOT_AI_UNTRUSTED_REPOSITORY", "release.repository");
  const updateAvailable = compareSemver(latest.tag, lock.upstream.tag) > 0;
  return { status: updateAvailable ? "outdated" : "current", installedTag: lock.upstream.tag, latestTag: latest.tag, updateAvailable };
}

async function defaultArchive(release) {
  const paths = [
    "LICENSE",
    `${PINNED.skillPath}/SKILL.md`,
    ...["ai-tell-taxonomy.md", "baseline.json", "baseline_v2.json", "design-notes.md", "diagnosis-rules.md", "empirical-validation.md", "metrics.py", "metrics_v2.py", "quick-rules.footer.md", "quick-rules.header.md", "quick-rules.md", "rewriting-playbook.md", "scholarship.md", "web-service-spec.md"].map((file) => `${PINNED.referencesSource}/${file}`),
  ];
  const files = await Promise.all(paths.map(async (sourcePath) => {
    const response = await fetch(`https://raw.githubusercontent.com/epoko77-ai/im-not-ai/${encodeURIComponent(release.tag)}/${sourcePath}`);
    if (!response.ok) throw new Error(`Official im-not-ai archive file unavailable: ${sourcePath}`);
    return { path: sourcePath, bytes: Buffer.from(await response.arrayBuffer()) };
  }));
  return { ...release, files };
}

function archiveFile(archive, sourcePath) {
  const entry = archive.files?.find((file) => file.path === sourcePath);
  if (!entry || !Buffer.isBuffer(entry.bytes)) throw new Error(`Trusted archive is missing ${sourcePath}`);
  return entry.bytes;
}

function verifyFutureArchive(archive, release) {
  if (archive.repository !== OFFICIAL_REPOSITORY) throw vendorError("IM_NOT_AI_UNTRUSTED_REPOSITORY", "archive.repository");
  if (archive.tag !== release.tag) throw vendorError("IM_NOT_AI_ARCHIVE_TAG_MISMATCH", "archive.tag");
  if (archive.commit !== release.commit) throw vendorError("IM_NOT_AI_ARCHIVE_COMMIT_MISMATCH", "archive.commit");
  const expectedPaths = new Set([
    "LICENSE",
    `${PINNED.skillPath}/SKILL.md`,
    ...PINNED_FILES.filter(([file]) => file.startsWith("references/")).map(([file]) => `${PINNED.referencesSource}/${file.slice("references/".length)}`),
  ]);
  if (!Array.isArray(archive.files)) throw vendorError("IM_NOT_AI_ARCHIVE_INVALID", "archive.files");
  for (const entry of archive.files) {
    if (!expectedPaths.has(entry?.path)) throw vendorError("IM_NOT_AI_ARCHIVE_UNREGISTERED_FILE", entry?.path ?? "archive.files");
    if (!Buffer.isBuffer(entry.bytes)) throw vendorError("IM_NOT_AI_ARCHIVE_INVALID", entry.path);
  }
  if (archive.files.length !== expectedPaths.size) throw vendorError("IM_NOT_AI_ARCHIVE_FILE_COUNT_MISMATCH", "archive.files");
  if (sha256(archiveFile(archive, "LICENSE")) !== PINNED.licenseSha256) throw vendorError("IM_NOT_AI_LICENSE_HASH_MISMATCH", "archive/LICENSE");
  for (const [relativePath, expectedHash, expectedSize] of PINNED_FILES) {
    const sourcePath = relativePath === "SKILL.md" ? `${PINNED.skillPath}/SKILL.md` : `${PINNED.referencesSource}/${relativePath.slice("references/".length)}`;
    const bytes = archiveFile(archive, sourcePath);
    if (bytes.length !== expectedSize || sha256(bytes) !== expectedHash) throw vendorError("IM_NOT_AI_ARCHIVE_FILE_HASH_MISMATCH", sourcePath);
  }
}

function makeLock(release, oldLock, files) {
  return {
    ...oldLock,
    upstream: { ...oldLock.upstream, tag: release.tag, commit: release.commit, releasedAt: release.releasedAt },
    tree: {
      ...oldLock.tree,
      root: `humanize-korean/${release.tag}`,
      files: files.map((file) => ({ path: file.path, sha256: sha256(file.bytes), size: file.bytes.length })),
    },
    license: { ...oldLock.license, sha256: sha256(archiveFile(release.archive, "LICENSE")) },
  };
}

export async function updateImNotAi({ root = DEFAULT_VENDOR_ROOT, stagingRoot, fetchRelease = officialLatestRelease, fetchArchive = defaultArchive } = {}) {
  if (typeof stagingRoot !== "string") throw new Error("stagingRoot is required for a non-destructive vendor update");
  const oldLock = await readJson(path.join(root, "vendor.lock.json"));
  const release = await fetchRelease();
  if (release.repository !== OFFICIAL_REPOSITORY) throw vendorError("IM_NOT_AI_UNTRUSTED_REPOSITORY", "release.repository");
  if (compareSemver(release.tag, oldLock.upstream.tag) <= 0) return { status: "current", tag: oldLock.upstream.tag, verifiedFiles: oldLock.tree.files.length };
  if (!/^[a-f0-9]{40}$/u.test(release.commit)) throw new Error("Release commit must be an exact SHA-1");
  const archive = await fetchArchive(release);
  verifyFutureArchive(archive, release);
  const files = oldLock.tree.files.map((file) => {
    const sourcePath = file.path === "SKILL.md" ? `${PINNED.skillPath}/SKILL.md` : `${PINNED.referencesSource}/${file.path.slice("references/".length)}`;
    return { path: file.path, bytes: archiveFile(archive, sourcePath) };
  });
  const lockedRelease = { ...release, archive };
  const nextLock = makeLock(lockedRelease, oldLock, files);
  await rm(stagingRoot, { recursive: true, force: true });
  await mkdir(path.join(stagingRoot, nextLock.tree.root), { recursive: true });
  await writeFile(path.join(stagingRoot, "LICENSE"), archiveFile(archive, "LICENSE"));
  await writeFile(path.join(stagingRoot, "THIRD_PARTY_NOTICES.md"), `# im-not-ai\n\n- Upstream: ${OFFICIAL_REPOSITORY}\n- Pinned release: \`${release.tag}\` (\`${release.commit}\`)\n- License: MIT\n- License SHA-256: \`${nextLock.license.sha256}\`\n`);
  await writeFile(path.join(stagingRoot, "vendor.lock.json"), `${JSON.stringify(nextLock, null, 2)}\n`);
  for (const file of files) {
    const destination = path.join(stagingRoot, nextLock.tree.root, ...file.path.split("/"));
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, file.bytes);
  }
  return { status: "updated", tag: release.tag, verifiedFiles: files.length };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { mode } = parseImNotAiUpdaterArgs(process.argv.slice(2));
  const result = mode === "check"
    ? await verifyVendoredImNotAi()
    : mode === "check-latest"
      ? await checkLatestImNotAi()
      : await updateImNotAi({ stagingRoot: path.join(REPO_ROOT, ".vendor-staging", "im-not-ai") });
  process.stdout.write(`${JSON.stringify(result)}\n`);
}
