import { createHash, randomUUID } from "node:crypto";
import { constants, readFileSync } from "node:fs";
import { lstat, mkdir, mkdtemp, open, readFile, readdir, realpath, rename, rmdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const OFFICIAL_REPOSITORY = "https://github.com/epoko77-ai/im-not-ai";
const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));
// The pin is the offline second witness for the vendored tree: verification compares the lock against
// it, so a lock that rewrote itself cannot also authorize itself. It lives in a reviewed data file
// rather than in this source, because an upgrade otherwise means hand-transcribing fifteen digests
// into JavaScript before the very check that guards the upgrade will pass again. The file moves only
// through `--update`, and the digests it carries land in a diff a person reads.
export const PIN_PATH = path.join(REPO_ROOT, "tooling/vendor-pins/im-not-ai.json");

function loadPin(pinPath = PIN_PATH) {
  const pin = JSON.parse(readFileSync(pinPath, "utf8"));
  if (pin?.schemaVersion !== 1) throw vendorError("IM_NOT_AI_PIN_SCHEMA_MISMATCH", "schemaVersion");
  if (pin.repository !== OFFICIAL_REPOSITORY) throw vendorError("IM_NOT_AI_UNTRUSTED_REPOSITORY", "pin.repository");
  for (const field of ["tag", "commit", "releasedAt", "skillPath", "referencesSource", "licenseSha256"]) {
    if (typeof pin[field] !== "string" || pin[field] === "") throw vendorError("IM_NOT_AI_PIN_INVALID", field);
  }
  if (!/^v\d+\.\d+\.\d+$/u.test(pin.tag)) throw vendorError("IM_NOT_AI_PIN_INVALID", "tag");
  if (!/^[a-f0-9]{40}$/u.test(pin.commit)) throw vendorError("IM_NOT_AI_PIN_INVALID", "commit");
  if (!/^[a-f0-9]{64}$/u.test(pin.licenseSha256)) throw vendorError("IM_NOT_AI_PIN_INVALID", "licenseSha256");
  if (!Array.isArray(pin.files) || pin.files.length === 0) throw vendorError("IM_NOT_AI_PIN_INVALID", "files");
  const files = pin.files.map((file, index) => {
    if (!file || typeof file.path !== "string" || !/^[a-f0-9]{64}$/u.test(file.sha256 ?? "") || !Number.isInteger(file.size) || file.size < 0) {
      throw vendorError("IM_NOT_AI_PIN_INVALID", `files[${index}]`);
    }
    if (file.path === "" || file.path.startsWith("/") || file.path.includes("\\") || file.path.split("/").includes("..")) {
      throw vendorError("IM_NOT_AI_PIN_INVALID", `files[${index}].path`);
    }
    return Object.freeze({ path: file.path, sha256: file.sha256, size: file.size });
  });
  if (new Set(files.map(({ path: filePath }) => filePath)).size !== files.length) throw vendorError("IM_NOT_AI_PIN_INVALID", "files");
  return Object.freeze({ ...pin, files: Object.freeze(files) });
}

const PINNED = loadPin();
const PINNED_FILES = PINNED.files;

// The upstream paths the pinned reference files came from. Both the fetch list and the archive
// allowlist read this, so the two can never drift apart into two different sets of filenames.
function referenceSourcePaths(referencesSource = PINNED.referencesSource) {
  return PINNED_FILES
    .filter(({ path: file }) => file.startsWith("references/"))
    .map(({ path: file }) => `${referencesSource}/${file.slice("references/".length)}`);
}

// An upstream release may move the directory the references come from, as v2.3.2 did. That is a review
// decision, not something the updater may infer: the operator names the new path on the command line, it
// lands in the pin diff, and every file's bytes are still hashed into both the lock and the pin.
function assertReferencesSource(referencesSource) {
  if (typeof referencesSource !== "string" || referencesSource === "") throw vendorError("IM_NOT_AI_REFERENCE_SOURCE_INVALID", "referencesSource");
  if (referencesSource.startsWith("/") || referencesSource.endsWith("/") || referencesSource.includes("\\") || referencesSource.split("/").includes("..")) {
    throw vendorError("IM_NOT_AI_REFERENCE_SOURCE_INVALID", referencesSource);
  }
  return referencesSource;
}

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

function vendorError(code, target, options) {
  const error = new Error(`${code}: ${target}`, options);
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
    const { path: expectedPath, sha256: expectedHash, size: expectedSize } = PINNED_FILES[index];
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
  const usage = "Usage: node tooling/sync-im-not-ai.mjs --check|--check-latest|--update [--references-source <path>]";
  if (args.length === 0 || !["--check", "--check-latest", "--update"].includes(args[0])) throw new Error(usage);
  const parsed = { mode: args[0].slice(2), network: args[0] !== "--check", referencesSource: undefined };
  if (args.length === 1) return parsed;
  if (parsed.mode !== "update" || args.length !== 3 || args[1] !== "--references-source") throw new Error(usage);
  parsed.referencesSource = assertReferencesSource(args[2]);
  return parsed;
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { accept: "application/vnd.github+json", "user-agent": "game-design-plugin-vendor-sync" } });
  // The status is the whole diagnosis and the body is not: a 403 here is the unauthenticated rate limit,
  // and this repository never reads a token to raise it. The response body stays unread on failure so no
  // remote text reaches a message.
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
  const referencesSource = assertReferencesSource(release.referencesSource ?? PINNED.referencesSource);
  const upstream = await upstreamReferenceNames(release, referencesSource);
  const pinnedNames = PINNED_FILES.filter(({ path: file }) => file.startsWith("references/")).map(({ path: file }) => file.slice("references/".length));
  // Removals are followed and additions are not, and the asymmetry is deliberate. Keeping a file the
  // upstream release deleted would ship something that release does not contain; pulling in a file it
  // added would widen a reviewed allowlist without review. Both are reported either way.
  const removed = pinnedNames.filter((name) => !upstream.has(name));
  const unpinned = [...upstream].filter((name) => !pinnedNames.includes(name)).sort();
  const kept = pinnedNames.filter((name) => !removed.includes(name));
  const paths = ["LICENSE", `${PINNED.skillPath}/SKILL.md`, ...kept.map((name) => `${referencesSource}/${name}`)];
  const files = await Promise.all(paths.map(async (sourcePath) => {
    const response = await fetch(`https://raw.githubusercontent.com/epoko77-ai/im-not-ai/${release.commit}/${sourcePath}`);
    if (!response.ok) throw new Error(`Official im-not-ai archive file unavailable: ${sourcePath}`);
    return { path: sourcePath, bytes: Buffer.from(await response.arrayBuffer()) };
  }));
  const closureFiles = files.map(({ path: filePath, bytes }) => ({ path: filePath, sha256: sha256(bytes), size: bytes.length }));
  return {
    ...release,
    files,
    unpinned,
    removed: removed.map((name) => `references/${name}`),
    referencesSource,
    closure: { files: closureFiles, licenseSha256: sha256(archiveFile({ files }, "LICENSE")), digest: closureDigest(closureFiles) },
  };
}

// The upstream reference directory at the immutable release commit. The upgrade reconciles the pinned
// file set against this listing, so an unavailable listing ends the run: continuing without it would
// mean fetching a pinned file the release may have deleted and reporting the resulting 404 as if the
// download had broken, which is what a rate-limited run did before this stopped it here.
async function upstreamReferenceNames(release, referencesSource) {
  let listing;
  try {
    listing = await fetchJson(`https://api.github.com/repos/epoko77-ai/im-not-ai/contents/${referencesSource}?ref=${release.commit}`);
  } catch (cause) {
    throw vendorError("IM_NOT_AI_UPSTREAM_LISTING_UNAVAILABLE", referencesSource, { cause });
  }
  if (!Array.isArray(listing) || listing.length === 0) throw vendorError("IM_NOT_AI_UPSTREAM_LISTING_UNAVAILABLE", referencesSource);
  return new Set(listing.filter((entry) => entry?.type === "file" && typeof entry.name === "string").map((entry) => entry.name));
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
  // The expectation is the pinned set minus whatever the release declares it removed. A declared removal
  // is only ever allowed to shrink an already-reviewed set — it can never name a path that was not
  // pinned, so it cannot be used to smuggle a different file in.
  const effectiveSource = assertReferencesSource(release.referencesSource ?? PINNED.referencesSource);
  const removedPaths = new Set(release.removed ?? []);
  const pinnedLockPaths = new Set(PINNED_FILES.map(({ path: file }) => file));
  for (const removedPath of removedPaths) {
    if (!pinnedLockPaths.has(removedPath) || !removedPath.startsWith("references/")) throw vendorError("IM_NOT_AI_REMOVAL_NOT_PINNED", removedPath);
  }
  const expectedPaths = new Set([
    "LICENSE",
    `${PINNED.skillPath}/SKILL.md`,
    ...referenceSourcePaths(effectiveSource).filter((sourcePath) => !removedPaths.has(`references/${sourcePath.slice(`${effectiveSource}/`.length)}`)),
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
    upstream: { ...oldLock.upstream, tag: release.tag, commit: release.commit, releasedAt: release.releasedAt, referencesSource: release.referencesSource ?? oldLock.upstream.referencesSource },
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

export async function updateImNotAi({ root = DEFAULT_VENDOR_ROOT, stagingRoot, publish = false, referencesSource, fetchRelease = fetchOfficialLatestImNotAiRelease, fetchArchive = defaultArchive, fsOps: overrides } = {}) {
  const fsOps = mergedFsOps(overrides);
  const rootIdentity = await directoryIdentity(root, fsOps);
  const vendorRoot = rootIdentity.realpath;
  const vendorParent = path.dirname(vendorRoot);
  const oldLock = await readJson(path.join(root, "vendor.lock.json"));
  const release = await fetchRelease();
  if (release.repository !== OFFICIAL_REPOSITORY) throw vendorError("IM_NOT_AI_UNTRUSTED_REPOSITORY", "release.repository");
  if (compareSemver(release.tag, oldLock.upstream.tag) <= 0) return { status: "current", tag: oldLock.upstream.tag, verifiedFiles: oldLock.tree.files.length };
  if (!/^[a-f0-9]{40}$/u.test(release.commit)) throw new Error("Release commit must be an exact SHA-1");
  const requestedSource = referencesSource === undefined ? undefined : assertReferencesSource(referencesSource);
  const archive = await fetchArchive(requestedSource === undefined ? release : { ...release, referencesSource: requestedSource });
  const effectiveSource = archive.referencesSource ?? requestedSource ?? oldLock.upstream.referencesSource;
  const releaseWithClosure = { ...release, closure: release.closure ?? archive.closure, removed: archive.removed ?? [], referencesSource: effectiveSource };
  verifyFutureArchive(archive, releaseWithClosure);
  const dropped = new Set(archive.removed ?? []);
  const files = oldLock.tree.files.filter((file) => !dropped.has(file.path)).map((file) => {
    const sourcePath = file.path === "SKILL.md" ? `${PINNED.skillPath}/SKILL.md` : `${effectiveSource}/${file.path.slice("references/".length)}`;
    return { path: file.path, bytes: archiveFile(archive, sourcePath) };
  });
  const lockedRelease = { ...releaseWithClosure, archive, referencesSource: effectiveSource };
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
    const unpinned = {
      ...(Array.isArray(archive.unpinned) && archive.unpinned.length > 0 ? { unpinnedUpstreamFiles: archive.unpinned } : {}),
      ...(Array.isArray(archive.removed) && archive.removed.length > 0 ? { removedUpstreamFiles: archive.removed } : {}),
    };
    if (publish) return { ...await receipt.publish({ fsOps }), tag: release.tag, ...unpinned };
    return { status: "updated", tag: release.tag, verifiedFiles: files.length, ...unpinned, publish: receipt.publish };
  } catch (error) {
    await removePrivateTree(privateStage, fsOps).catch(() => undefined);
    throw error;
  }
}

// Rewrite the offline witness from the tree that was just published. Verification compares the lock
// against this file, so an upgrade that moved the tree without moving the pin would leave the very
// next `--check` failing. The digests written here are the ones a reviewer reads in the diff.
export async function writeImNotAiPin({ root = DEFAULT_VENDOR_ROOT, pinPath = PIN_PATH } = {}) {
  const lock = await readJson(path.join(root, "vendor.lock.json"));
  const pin = {
    schemaVersion: 1,
    repository: OFFICIAL_REPOSITORY,
    tag: lock.upstream.tag,
    commit: lock.upstream.commit,
    releasedAt: lock.upstream.releasedAt,
    skillPath: lock.upstream.skillPath,
    referencesSource: lock.upstream.referencesSource,
    licenseSha256: lock.license.sha256,
    files: lock.tree.files.map(({ path: file, sha256: hash, size }) => ({ path: file, sha256: hash, size })),
  };
  const temporary = path.join(path.dirname(pinPath), `.${path.basename(pinPath)}.${process.pid}.tmp`);
  await writeFile(temporary, `${JSON.stringify(pin, null, 2)}\n`, { mode: 0o644 });
  await rename(temporary, pinPath);
  return { pinPath, tag: pin.tag, files: pin.files.length };
}

if (process.argv[1] && await realpath(process.argv[1]).catch(() => path.resolve(process.argv[1])) === await realpath(fileURLToPath(import.meta.url))) {
  const { mode, referencesSource } = parseImNotAiUpdaterArgs(process.argv.slice(2));
  let result;
  if (mode === "check") result = await verifyVendoredImNotAi();
  else if (mode === "check-latest") result = await checkLatestImNotAi();
  else {
    result = await updateImNotAi({ publish: true, referencesSource });
    if (result.status === "published") result = { ...result, pin: await writeImNotAiPin() };
  }
  process.stdout.write(`${JSON.stringify(result)}\n`);
}
