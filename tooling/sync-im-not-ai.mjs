import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { lstat, mkdir, mkdtemp, open, readFile, readdir, realpath, rename, rmdir, unlink } from "node:fs/promises";
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
const PREPARED_VENDOR = new WeakMap();
const WRITE_NO_FOLLOW = constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW;
const READ_NO_FOLLOW = constants.O_RDONLY | constants.O_NOFOLLOW;
const DEFAULT_FS_OPS = Object.freeze({ lstat, mkdir, mkdtemp, open, readdir, realpath, rename, rmdir, unlink });

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function closureDigest(files) {
  return sha256(Buffer.from(JSON.stringify(files.map(({ path: filePath, sha256: hash, size }) => ({ path: filePath, sha256: hash, size })).sort((a, b) => a.path.localeCompare(b.path)))));
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
  return JSON.parse((await readNoFollow(file)).toString("utf8"));
}

async function readNoFollow(file) {
  const handle = await open(file, READ_NO_FOLLOW);
  try {
    const info = await handle.stat();
    if (!info.isFile()) throw vendorError("IM_NOT_AI_NON_REGULAR_FILE", file);
    return await handle.readFile();
  } finally {
    await handle.close();
  }
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
    else if (stat.isFile()) output.push({ path: relativePath, bytes: await readNoFollow(absolutePath) });
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

async function peelTagObject(object, fetchJsonImpl) {
  if (object?.type === "commit" && /^[a-f0-9]{40}$/u.test(object.sha)) return object.sha;
  if (object?.type !== "tag" || !/^[a-f0-9]{40}$/u.test(object.sha)) throw new Error("Official release tag must resolve to a commit");
  const tag = await fetchJsonImpl(`https://api.github.com/repos/epoko77-ai/im-not-ai/git/tags/${object.sha}`);
  return peelTagObject(tag.object, fetchJsonImpl);
}

/** Resolve a stable GitHub release to the immutable commit behind its tag. */
export async function fetchOfficialLatestImNotAiRelease({ fetchJsonImpl = fetchJson } = {}) {
  const releases = await fetchJsonImpl("https://api.github.com/repos/epoko77-ai/im-not-ai/releases?per_page=100");
  if (!Array.isArray(releases)) throw new Error("Official release response must be an array");
  const stable = releases.filter((release) => !release.draft && !release.prerelease && /^v?\d+\.\d+\.\d+$/u.test(release.tag_name));
  if (stable.length === 0) throw new Error("No stable official im-not-ai release is available");
  stable.sort((left, right) => compareSemver(right.tag_name, left.tag_name));
  const release = stable[0];
  const ref = await fetchJsonImpl(`https://api.github.com/repos/epoko77-ai/im-not-ai/git/ref/tags/${encodeURIComponent(release.tag_name)}`);
  const commit = await peelTagObject(ref.object, fetchJsonImpl);
  return { repository: OFFICIAL_REPOSITORY, tag: release.tag_name, commit, releasedAt: release.published_at };
}

export async function checkLatestImNotAi({ root = DEFAULT_VENDOR_ROOT, fetchRelease = fetchOfficialLatestImNotAiRelease } = {}) {
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
    const response = await fetch(`https://raw.githubusercontent.com/epoko77-ai/im-not-ai/${release.commit}/${sourcePath}`);
    if (!response.ok) throw new Error(`Official im-not-ai archive file unavailable: ${sourcePath}`);
    return { path: sourcePath, bytes: Buffer.from(await response.arrayBuffer()) };
  }));
  const closureFiles = files.map(({ path: filePath, bytes }) => ({ path: filePath, sha256: sha256(bytes), size: bytes.length }));
  return { ...release, files, closure: { files: closureFiles, licenseSha256: sha256(archiveFile({ files }, "LICENSE")), digest: closureDigest(closureFiles) } };
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
  if (!Array.isArray(release.closure?.files) || typeof release.closure?.digest !== "string") throw vendorError("IM_NOT_AI_RELEASE_CLOSURE_MISSING", "release.closure");
  const declared = new Map(release.closure.files.map((file) => [file.path, file]));
  if (declared.size !== expectedPaths.size || [...declared.keys()].some((file) => !expectedPaths.has(file))) throw vendorError("IM_NOT_AI_RELEASE_CLOSURE_INVALID", "release.closure.files");
  if (closureDigest(release.closure.files) !== release.closure.digest) throw vendorError("IM_NOT_AI_RELEASE_CLOSURE_DIGEST_MISMATCH", "release.closure.digest");
  if (release.closure.licenseSha256 !== PINNED.licenseSha256) throw vendorError("IM_NOT_AI_LICENSE_HASH_MISMATCH", "release.closure.licenseSha256");
  if (!Array.isArray(archive.files)) throw vendorError("IM_NOT_AI_ARCHIVE_INVALID", "archive.files");
  for (const entry of archive.files) {
    if (!expectedPaths.has(entry?.path)) throw vendorError("IM_NOT_AI_ARCHIVE_UNREGISTERED_FILE", entry?.path ?? "archive.files");
    if (!Buffer.isBuffer(entry.bytes)) throw vendorError("IM_NOT_AI_ARCHIVE_INVALID", entry.path);
  }
  if (archive.files.length !== expectedPaths.size) throw vendorError("IM_NOT_AI_ARCHIVE_FILE_COUNT_MISMATCH", "archive.files");
  if (sha256(archiveFile(archive, "LICENSE")) !== release.closure.licenseSha256) throw vendorError("IM_NOT_AI_LICENSE_HASH_MISMATCH", "archive/LICENSE");
  for (const sourcePath of expectedPaths) {
    if (sourcePath === "LICENSE") continue;
    const bytes = archiveFile(archive, sourcePath);
    const expected = declared.get(sourcePath);
    if (bytes.length !== expected.size || sha256(bytes) !== expected.sha256) throw vendorError("IM_NOT_AI_ARCHIVE_FILE_HASH_MISMATCH", sourcePath);
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

function mergedFsOps(overrides = {}) {
  return { ...DEFAULT_FS_OPS, ...overrides };
}

function sameIdentity(left, right) {
  return left.realpath === right.realpath && left.dev === right.dev && left.ino === right.ino;
}

async function directoryIdentity(target, fsOps = DEFAULT_FS_OPS) {
  const requested = path.resolve(target);
  const info = await fsOps.lstat(requested);
  if (info.isSymbolicLink()) throw vendorError("IM_NOT_AI_SYMLINK", requested);
  if (!info.isDirectory()) throw vendorError("IM_NOT_AI_NON_REGULAR_FILE", requested);
  const canonical = await fsOps.realpath(requested);
  return { realpath: canonical, dev: info.dev, ino: info.ino };
}

function safeRelative(root, target) {
  const relative = path.relative(root, target);
  if (relative === "" || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw vendorError("IM_NOT_AI_UNSAFE_STAGING_ROOT", target);
}

async function ensurePrivateDirectory(root, target, fsOps) {
  safeRelative(root, target);
  await fsOps.mkdir(target, { recursive: true, mode: 0o700 });
  const info = await fsOps.lstat(target);
  if (info.isSymbolicLink()) throw vendorError("IM_NOT_AI_SYMLINK", target);
  if (!info.isDirectory()) throw vendorError("IM_NOT_AI_NON_REGULAR_FILE", target);
}

async function writePrivateFile(file, bytes, fsOps) {
  const handle = await fsOps.open(file, WRITE_NO_FOLLOW, 0o600);
  try {
    await handle.writeFile(bytes);
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function removePrivateTree(root, fsOps) {
  const info = await fsOps.lstat(root).catch((error) => error.code === "ENOENT" ? undefined : Promise.reject(error));
  if (!info) return;
  if (info.isSymbolicLink()) {
    await fsOps.unlink(root);
    return;
  }
  if (!info.isDirectory()) {
    await fsOps.unlink(root);
    return;
  }
  for (const entry of await fsOps.readdir(root, { withFileTypes: true })) await removePrivateTree(path.join(root, entry.name), fsOps);
  await fsOps.rmdir(root);
}

async function verifyPreparedTree(root, { expectedIdentity, expectedLockHash, expectedClosureHash } = {}) {
  const identity = await directoryIdentity(root);
  if (expectedIdentity && !sameIdentity(identity, expectedIdentity)) throw vendorError("IM_NOT_AI_STAGE_IDENTITY_CHANGED", identity.realpath);
  const lockBytes = await readNoFollow(path.join(identity.realpath, "vendor.lock.json"));
  const lock = JSON.parse(lockBytes.toString("utf8"));
  if (lock?.upstream?.repository !== OFFICIAL_REPOSITORY || !/^v?\d+\.\d+\.\d+$/u.test(lock?.upstream?.tag) || !/^[a-f0-9]{40}$/u.test(lock?.upstream?.commit)) throw vendorError("IM_NOT_AI_STAGE_VERIFICATION_FAILED", "vendor.lock.json");
  if (lock?.license?.spdx !== "MIT" || lock.license.path !== "LICENSE" || !/^[a-f0-9]{64}$/u.test(lock.license.sha256)) throw vendorError("IM_NOT_AI_STAGE_VERIFICATION_FAILED", "license");
  if (typeof lock?.tree?.root !== "string" || lock.tree.root.startsWith("/") || lock.tree.root.includes("..") || !Array.isArray(lock.tree.files)) throw vendorError("IM_NOT_AI_STAGE_VERIFICATION_FAILED", "tree");
  const names = new Set();
  for (const file of lock.tree.files) {
    if (!file || typeof file.path !== "string" || file.path.startsWith("/") || file.path.includes("..") || !/^[a-f0-9]{64}$/u.test(file.sha256) || !Number.isSafeInteger(file.size) || file.size < 0 || names.has(file.path)) throw vendorError("IM_NOT_AI_STAGE_VERIFICATION_FAILED", "tree.files");
    names.add(file.path);
  }
  const expected = new Set(["LICENSE", "THIRD_PARTY_NOTICES.md", "vendor.lock.json", ...lock.tree.files.map((file) => `${lock.tree.root}/${file.path}`)]);
  for (const file of await regularFiles(identity.realpath)) if (!expected.has(file.path)) throw vendorError("IM_NOT_AI_STAGE_VERIFICATION_FAILED", file.path);
  const license = await readNoFollow(path.join(identity.realpath, "LICENSE"));
  if (sha256(license) !== lock.license.sha256) throw vendorError("IM_NOT_AI_STAGE_VERIFICATION_FAILED", "LICENSE");
  const closureFiles = [{ path: "LICENSE", sha256: sha256(license), size: license.length }];
  for (const file of lock.tree.files) {
    const target = path.join(identity.realpath, lock.tree.root, ...file.path.split("/"));
    const info = await lstat(target);
    if (info.isSymbolicLink()) throw vendorError("IM_NOT_AI_SYMLINK", target);
    if (!info.isFile()) throw vendorError("IM_NOT_AI_STAGE_VERIFICATION_FAILED", target);
    const bytes = await readNoFollow(target);
    if (bytes.length !== file.size || sha256(bytes) !== file.sha256) throw vendorError("IM_NOT_AI_STAGE_VERIFICATION_FAILED", target);
    closureFiles.push({ path: `${lock.tree.root}/${file.path}`, sha256: file.sha256, size: file.size });
  }
  const verified = { identity, lockHash: sha256(lockBytes), closureHash: closureDigest(closureFiles), lock };
  if (expectedLockHash && verified.lockHash !== expectedLockHash) throw vendorError("IM_NOT_AI_STAGE_LOCK_CHANGED", "vendor.lock.json");
  if (expectedClosureHash && verified.closureHash !== expectedClosureHash) throw vendorError("IM_NOT_AI_STAGE_CLOSURE_CHANGED", "tree");
  return verified;
}

function createPreparedReceipt({ root, original, staged }) {
  const capability = Object.freeze({});
  PREPARED_VENDOR.set(capability, { root, original, staged });
  return Object.freeze({
    publish: async ({ fsOps } = {}) => publishPreparedImNotAi({ prepared: capability, fsOps }),
  });
}

export async function publishPreparedImNotAi({ prepared, fsOps: overrides } = {}) {
  const preparedState = PREPARED_VENDOR.get(prepared);
  if (!preparedState) throw vendorError("IM_NOT_AI_PREPARED_CAPABILITY_REQUIRED", "prepared");
  const fsOps = mergedFsOps(overrides);
  const vendorRoot = preparedState.root;
  const parent = path.dirname(vendorRoot);
  let stageMoved = false;
  let backupMoved = false;
  let backup;
  try {
    const staged = await verifyPreparedTree(preparedState.staged.identity.realpath, preparedState.staged);
    await verifyPreparedTree(vendorRoot, preparedState.original);
    backup = path.join(parent, `.${path.basename(vendorRoot)}.backup-${randomUUID()}`);
    await fsOps.lstat(backup).then(() => { throw vendorError("IM_NOT_AI_BACKUP_EXISTS", backup); }).catch((error) => {
      if (error.code !== "ENOENT") throw error;
    });
    await fsOps.rename(vendorRoot, backup);
    backupMoved = true;
    try {
      await fsOps.rename(staged.identity.realpath, vendorRoot);
      stageMoved = true;
    } catch (error) {
      await fsOps.rename(backup, vendorRoot);
      backupMoved = false;
      throw error;
    }
    try {
      await verifyPreparedTree(vendorRoot, { expectedLockHash: staged.lockHash, expectedClosureHash: staged.closureHash });
    } catch (error) {
      const rejected = path.join(parent, `.${path.basename(vendorRoot)}.rejected-${randomUUID()}`);
      await fsOps.rename(vendorRoot, rejected);
      await fsOps.rename(backup, vendorRoot);
      backupMoved = false;
      await removePrivateTree(rejected, fsOps);
      throw error;
    }
  } catch (error) {
    if (backupMoved && !stageMoved && backup) {
      await fsOps.rename(backup, vendorRoot).catch(() => undefined);
    }
    if (!stageMoved) await removePrivateTree(preparedState.staged.identity.realpath, fsOps).catch(() => undefined);
    throw error;
  }
  await removePrivateTree(backup, fsOps).catch(() => undefined);
  PREPARED_VENDOR.delete(prepared);
  return { status: "published", root: vendorRoot };
}

export async function updateImNotAi({ root = DEFAULT_VENDOR_ROOT, stagingRoot, publish = false, fetchRelease = fetchOfficialLatestImNotAiRelease, fetchArchive = defaultArchive, fsOps: overrides } = {}) {
  const fsOps = mergedFsOps(overrides);
  const rootIdentity = await directoryIdentity(root, fsOps);
  const vendorRoot = rootIdentity.realpath;
  const vendorParent = path.dirname(vendorRoot);
  const oldLock = await readJson(path.join(root, "vendor.lock.json"));
  const release = await fetchRelease();
  if (release.repository !== OFFICIAL_REPOSITORY) throw vendorError("IM_NOT_AI_UNTRUSTED_REPOSITORY", "release.repository");
  if (compareSemver(release.tag, oldLock.upstream.tag) <= 0) return { status: "current", tag: oldLock.upstream.tag, verifiedFiles: oldLock.tree.files.length };
  if (!/^[a-f0-9]{40}$/u.test(release.commit)) throw new Error("Release commit must be an exact SHA-1");
  const archive = await fetchArchive(release);
  const releaseWithClosure = { ...release, closure: release.closure ?? archive.closure };
  verifyFutureArchive(archive, releaseWithClosure);
  const files = oldLock.tree.files.map((file) => {
    const sourcePath = file.path === "SKILL.md" ? `${PINNED.skillPath}/SKILL.md` : `${PINNED.referencesSource}/${file.path.slice("references/".length)}`;
    return { path: file.path, bytes: archiveFile(archive, sourcePath) };
  });
  const lockedRelease = { ...releaseWithClosure, archive };
  const nextLock = makeLock(lockedRelease, oldLock, files);
  if (stagingRoot !== undefined) throw vendorError("IM_NOT_AI_UNSAFE_STAGING_ROOT", path.resolve(stagingRoot));
  const privateStage = await fsOps.mkdtemp(path.join(vendorParent, `.${path.basename(vendorRoot)}.stage-`));
  try {
    const stageIdentity = await directoryIdentity(privateStage, fsOps);
    if (path.dirname(stageIdentity.realpath) !== vendorParent) throw vendorError("IM_NOT_AI_UNSAFE_STAGING_ROOT", stageIdentity.realpath);
    await ensurePrivateDirectory(stageIdentity.realpath, path.join(stageIdentity.realpath, nextLock.tree.root), fsOps);
    await writePrivateFile(path.join(stageIdentity.realpath, "LICENSE"), archiveFile(archive, "LICENSE"), fsOps);
    await writePrivateFile(path.join(stageIdentity.realpath, "THIRD_PARTY_NOTICES.md"), `# im-not-ai\n\n- Upstream: ${OFFICIAL_REPOSITORY}\n- Pinned release: \`${release.tag}\` (\`${release.commit}\`)\n- License: MIT\n- License SHA-256: \`${nextLock.license.sha256}\`\n`, fsOps);
    await writePrivateFile(path.join(stageIdentity.realpath, "vendor.lock.json"), `${JSON.stringify(nextLock, null, 2)}\n`, fsOps);
    for (const file of files) {
      const destination = path.join(stageIdentity.realpath, nextLock.tree.root, ...file.path.split("/"));
      await ensurePrivateDirectory(stageIdentity.realpath, path.dirname(destination), fsOps);
      await writePrivateFile(destination, file.bytes, fsOps);
    }
    const staged = await verifyPreparedTree(stageIdentity.realpath, { expectedIdentity: stageIdentity });
    const original = await verifyPreparedTree(vendorRoot, { expectedIdentity: rootIdentity });
    const receipt = createPreparedReceipt({ root: vendorRoot, original, staged });
    if (publish) return receipt.publish({ fsOps });
    return { status: "updated", tag: release.tag, verifiedFiles: files.length, publish: receipt.publish };
  } catch (error) {
    await removePrivateTree(privateStage, fsOps).catch(() => undefined);
    throw error;
  }
}

if (process.argv[1] && await realpath(process.argv[1]).catch(() => path.resolve(process.argv[1])) === await realpath(fileURLToPath(import.meta.url))) {
  const { mode } = parseImNotAiUpdaterArgs(process.argv.slice(2));
  const result = mode === "check"
    ? await verifyVendoredImNotAi()
    : mode === "check-latest"
      ? await checkLatestImNotAi()
      : await updateImNotAi({ publish: true });
  process.stdout.write(`${JSON.stringify(result)}\n`);
}
