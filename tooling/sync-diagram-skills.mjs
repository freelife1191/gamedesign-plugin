#!/usr/bin/env node
import { createHash, randomBytes } from "node:crypto";
import { inflateRawSync } from "node:zlib";
import { lstat, mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const stableTag = /^v?\d+\.\d+\.\d+$/u;
const KNOWN_SKILLS = Object.freeze(["skillstead", "archify"]);
const DEFAULT_ROOTS = Object.freeze({
  skillstead: path.join(repositoryRoot, "shared/vendor/skillstead"),
  archify: path.join(repositoryRoot, "shared/vendor/archify"),
});
const OFFICIAL_REPOSITORIES = Object.freeze({
  skillstead: "https://github.com/kyungseo/skillstead",
  archify: "https://github.com/tt-a1i/archify",
});
const TRUSTED_LICENSES = Object.freeze({
  skillstead: Object.freeze({ spdx: "Apache-2.0", path: "LICENSE.txt", sha256: "4739c79c8017b90a46ab26f8972fd4ac56c9ea459b89bf9671359b462f62a4a6" }),
  archify: Object.freeze({ spdx: "MIT", path: "LICENSE", sha256: "2f724fa953b4eaa8ec75fa56919ce474b57adce54d2456a3791510bc53735cbd" }),
});
const JOURNAL_FILENAME = ".vendor-update.json";
const OPERATION_LOCK_DIRECTORY = ".vendor-operation.lock";
const OPERATION_STALE_MS = 5 * 60 * 1000;
const LOCK_BACKUP_FILENAME = ".vendor-update-lock-backup.json";
const NOTICES_BACKUP_FILENAME = ".vendor-update-notices-backup.md";

function vendorError(code, relativePath, message = code) {
  const error = new Error(message);
  error.code = code;
  error.path = relativePath;
  return error;
}

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const gitBlobSha = (bytes) => createHash("sha1").update(`blob ${Buffer.byteLength(bytes)}\0`).update(bytes).digest("hex");
const compareFiles = (left, right) => left.path.localeCompare(right.path);

function assertContained(root, relativePath, code, label) {
  if (typeof relativePath !== "string" || relativePath === "" || path.isAbsolute(relativePath) || relativePath.includes("\\") || relativePath.split("/").includes("..")) {
    throw vendorError(code, label);
  }
  const absoluteRoot = path.resolve(root);
  const resolved = path.resolve(absoluteRoot, relativePath);
  if (!resolved.startsWith(`${absoluteRoot}${path.sep}`)) throw vendorError(code, label);
  return resolved;
}

function assertVersionedTreeRoot(name, treeRoot, code, label) {
  const prefix = name === "skillstead" ? "svg-infographic" : "archify";
  if (typeof treeRoot !== "string" || !new RegExp(`^${prefix}/\\d+\\.\\d+\\.\\d+$`, "u").test(treeRoot)) {
    throw vendorError(code, label);
  }
  return treeRoot;
}

function normalizeFiles(files) {
  if (!Array.isArray(files)) throw vendorError("DIAGRAM_VENDOR_LOCK_TREE_INVALID", "tree.files");
  return files.map((file, index) => {
    if (!file || typeof file.path !== "string" || !Number.isInteger(file.size) || file.size < 0 || !/^[a-f0-9]{64}$/u.test(file.sha256 ?? "")) {
      throw vendorError("DIAGRAM_VENDOR_LOCK_FILE_INVALID", `tree.files[${index}]`);
    }
    if (file.path.startsWith("/") || file.path.includes("\\") || file.path.split("/").includes("..") || file.path === "") {
      throw vendorError("DIAGRAM_VENDOR_LOCK_FILE_PATH_INVALID", `tree.files[${index}].path`);
    }
    return { path: file.path, size: file.size, sha256: file.sha256 };
  }).sort(compareFiles);
}

async function listRegularFiles(root, prefix = "", treeRoot = "") {
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") throw vendorError("DIAGRAM_VENDOR_FILE_MISSING", treeRoot || prefix || ".");
    throw error;
  }
  const files = [];
  for (const entry of entries) {
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
    const absolutePath = path.join(root, entry.name);
    const stats = await lstat(absolutePath);
    const reportedPath = treeRoot ? `${treeRoot}/${relativePath}` : relativePath;
    if (stats.isSymbolicLink()) throw vendorError("DIAGRAM_VENDOR_SYMLINK", reportedPath);
    if (stats.isDirectory()) files.push(...await listRegularFiles(absolutePath, relativePath, treeRoot));
    else if (stats.isFile()) {
      const bytes = await readFile(absolutePath);
      files.push({ path: relativePath, size: bytes.length, sha256: sha256(bytes) });
    } else throw vendorError("DIAGRAM_VENDOR_NON_REGULAR_FILE", reportedPath);
  }
  return files.sort(compareFiles);
}

function assertLockIdentity(lock, name) {
  if (!lock || typeof lock !== "object" || Array.isArray(lock)) throw vendorError("DIAGRAM_VENDOR_LOCK_INVALID", "vendor.lock.json");
  if (lock.schemaVersion !== 1) throw vendorError("DIAGRAM_VENDOR_LOCK_SCHEMA_MISMATCH", "schemaVersion");
  if (!lock.upstream || lock.upstream.repository !== OFFICIAL_REPOSITORIES[name]) throw vendorError("DIAGRAM_VENDOR_UNTRUSTED_REPOSITORY", "upstream.repository");
  if (typeof lock.upstream.tag !== "string" || !stableTag.test(lock.upstream.tag.replace("svg-infographic/", ""))) throw vendorError("DIAGRAM_VENDOR_UNSTABLE_TAG", "upstream.tag");
  if (!/^[a-f0-9]{40}$/u.test(lock.upstream.commit ?? "")) throw vendorError("DIAGRAM_VENDOR_COMMIT_INVALID", "upstream.commit");
  if (typeof lock.upstream.releasedAt !== "string" || Number.isNaN(Date.parse(lock.upstream.releasedAt))) throw vendorError("DIAGRAM_VENDOR_RELEASE_TIME_INVALID", "upstream.releasedAt");
  const trustedLicense = TRUSTED_LICENSES[name];
  if (!lock.license || lock.license.spdx !== trustedLicense.spdx || lock.license.path !== trustedLicense.path || lock.license.sha256 !== trustedLicense.sha256) throw vendorError("DIAGRAM_VENDOR_LICENSE_INVALID", "license");
  if (!lock.tree) throw vendorError("DIAGRAM_VENDOR_TREE_ROOT_INVALID", "tree.root");
  assertContained("/vendor-root", lock.tree.root, "DIAGRAM_VENDOR_TREE_ROOT_INVALID", "tree.root");
  assertVersionedTreeRoot(name, lock.tree.root, "DIAGRAM_VENDOR_TREE_ROOT_INVALID", "tree.root");
}

async function pathExists(filename) {
  try {
    await lstat(filename);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

async function atomicWriteFile(filename, contents, { renamePath = rename, writePath = writeFile } = {}) {
  const temporary = path.join(path.dirname(filename), `.${path.basename(filename)}.${process.pid}.tmp`);
  await assertMissing(temporary, path.basename(temporary));
  try {
    await writePath(temporary, contents, { mode: 0o644 });
    await renamePath(temporary, filename);
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => undefined);
    throw error;
  }
}

async function readVendorLock(absoluteRoot, name) {
  let lock;
  try {
    lock = JSON.parse(await readFile(path.join(absoluteRoot, "vendor.lock.json"), "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") throw vendorError("DIAGRAM_VENDOR_FILE_MISSING", "vendor.lock.json");
    if (error instanceof SyntaxError) throw vendorError("DIAGRAM_VENDOR_LOCK_INVALID", "vendor.lock.json");
    throw error;
  }
  assertLockIdentity(lock, name);
  return lock;
}

async function readOperationOwner(lockRoot, name) {
  const lockStats = await lstat(lockRoot).catch((error) => error.code === "ENOENT" ? undefined : Promise.reject(error));
  if (!lockStats) return undefined;
  if (lockStats.isSymbolicLink() || !lockStats.isDirectory()) throw vendorError("DIAGRAM_VENDOR_OPERATION_LOCK_INVALID", OPERATION_LOCK_DIRECTORY);
  const ownerPath = path.join(lockRoot, "owner.json");
  const ownerStats = await lstat(ownerPath).catch(() => undefined);
  if (!ownerStats || ownerStats.isSymbolicLink() || !ownerStats.isFile()) throw vendorError("DIAGRAM_VENDOR_OPERATION_LOCK_INVALID", `${OPERATION_LOCK_DIRECTORY}/owner.json`);
  let owner;
  try {
    owner = JSON.parse(await readFile(ownerPath, "utf8"));
  } catch {
    throw vendorError("DIAGRAM_VENDOR_OPERATION_LOCK_INVALID", `${OPERATION_LOCK_DIRECTORY}/owner.json`);
  }
  if (!owner || Object.keys(owner).sort().join(",") !== "name,nonce,schemaVersion,startedAt" || owner.schemaVersion !== 1 || owner.name !== name
      || !/^[a-f0-9]{32}$/u.test(owner.nonce ?? "") || typeof owner.startedAt !== "string" || Number.isNaN(Date.parse(owner.startedAt))) {
    throw vendorError("DIAGRAM_VENDOR_OPERATION_LOCK_INVALID", `${OPERATION_LOCK_DIRECTORY}/owner.json`);
  }
  return owner;
}

async function acquireOperationLock({ root, name, now = Date.now(), staleAfterMs = OPERATION_STALE_MS }) {
  const lockRoot = path.join(root, OPERATION_LOCK_DIRECTORY);
  const existing = await readOperationOwner(lockRoot, name);
  if (existing) {
    if (now - Date.parse(existing.startedAt) <= staleAfterMs) throw vendorError("DIAGRAM_VENDOR_OPERATION_ACTIVE", OPERATION_LOCK_DIRECTORY);
    await rm(lockRoot, { recursive: true, force: true });
  }
  try {
    await mkdir(lockRoot);
  } catch (error) {
    if (error.code === "EEXIST") throw vendorError("DIAGRAM_VENDOR_OPERATION_ACTIVE", OPERATION_LOCK_DIRECTORY);
    throw error;
  }
  const owner = { schemaVersion: 1, name, nonce: randomBytes(16).toString("hex"), startedAt: new Date(now).toISOString() };
  await writeFile(path.join(lockRoot, "owner.json"), `${JSON.stringify(owner)}\n`, { mode: 0o600 });
  return owner;
}

async function releaseOperationLock({ root, name, owner }) {
  const lockRoot = path.join(root, OPERATION_LOCK_DIRECTORY);
  const current = await readOperationOwner(lockRoot, name).catch((error) => error.code === "DIAGRAM_VENDOR_OPERATION_LOCK_INVALID" ? undefined : Promise.reject(error));
  if (current?.nonce === owner.nonce) await rm(lockRoot, { recursive: true, force: true });
}

async function withOperationLock({ root, name, now, staleAfterMs, operation }) {
  const owner = await acquireOperationLock({ root, name, now, staleAfterMs });
  try {
    return await operation(owner);
  } finally {
    await releaseOperationLock({ root, name, owner });
  }
}

async function assertJournal(absoluteRoot, name, { expectedOwnerNonce } = {}) {
  const journalPath = path.join(absoluteRoot, JOURNAL_FILENAME);
  const stats = await lstat(journalPath).catch((error) => error.code === "ENOENT" ? undefined : Promise.reject(error));
  if (!stats) return undefined;
  if (stats.isSymbolicLink() || !stats.isFile()) throw vendorError("DIAGRAM_VENDOR_RECOVERY_JOURNAL_INVALID", JOURNAL_FILENAME);
  let journal;
  try {
    journal = JSON.parse(await readFile(journalPath, "utf8"));
  } catch {
    throw vendorError("DIAGRAM_VENDOR_RECOVERY_JOURNAL_INVALID", JOURNAL_FILENAME);
  }
  if (!journal || Object.keys(journal).sort().join(",") !== "lockBackup,name,newRoot,noticesBackup,oldRoot,ownerNonce,schemaVersion" || journal.schemaVersion !== 2 || journal.name !== name
      || !/^[a-f0-9]{32}$/u.test(journal.ownerNonce ?? "")) {
    throw vendorError("DIAGRAM_VENDOR_RECOVERY_JOURNAL_INVALID", JOURNAL_FILENAME);
  }
  for (const [label, candidate] of [["oldRoot", journal.oldRoot], ["newRoot", journal.newRoot]]) {
    assertContained(absoluteRoot, candidate, "DIAGRAM_VENDOR_RECOVERY_JOURNAL_INVALID", `${JOURNAL_FILENAME}.${label}`);
    assertVersionedTreeRoot(name, candidate, "DIAGRAM_VENDOR_RECOVERY_JOURNAL_INVALID", `${JOURNAL_FILENAME}.${label}`);
  }
  if (journal.oldRoot === journal.newRoot) throw vendorError("DIAGRAM_VENDOR_RECOVERY_JOURNAL_INVALID", JOURNAL_FILENAME);
  if (journal.lockBackup !== LOCK_BACKUP_FILENAME || journal.noticesBackup !== NOTICES_BACKUP_FILENAME) {
    throw vendorError("DIAGRAM_VENDOR_RECOVERY_JOURNAL_INVALID", JOURNAL_FILENAME);
  }
  if (expectedOwnerNonce && journal.ownerNonce !== expectedOwnerNonce) throw vendorError("DIAGRAM_VENDOR_RECOVERY_JOURNAL_INVALID", JOURNAL_FILENAME);
  return journal;
}

async function assertSymlinkFreeDirectory(directory, label) {
  const stats = await lstat(directory).catch((error) => error.code === "ENOENT" ? undefined : Promise.reject(error));
  if (!stats || stats.isSymbolicLink() || !stats.isDirectory()) throw vendorError("DIAGRAM_VENDOR_RECOVERY_JOURNAL_INVALID", label);
  await listRegularFiles(directory, "", label);
}

async function recoverWithinOperation({ root, name, owner, expectedJournalOwnerNonce = owner.nonce }) {
  const journal = await assertJournal(root, name, { expectedOwnerNonce: expectedJournalOwnerNonce });
  if (!journal) return false;
  const oldPath = assertContained(root, journal.oldRoot, "DIAGRAM_VENDOR_RECOVERY_JOURNAL_INVALID", "oldRoot");
  const newPath = assertContained(root, journal.newRoot, "DIAGRAM_VENDOR_RECOVERY_JOURNAL_INVALID", "newRoot");
  await assertSymlinkFreeDirectory(oldPath, journal.oldRoot);
  const lockBackup = assertContained(root, journal.lockBackup, "DIAGRAM_VENDOR_RECOVERY_JOURNAL_INVALID", "lockBackup");
  const noticesBackup = assertContained(root, journal.noticesBackup, "DIAGRAM_VENDOR_RECOVERY_JOURNAL_INVALID", "noticesBackup");
  for (const [label, filename] of [[journal.lockBackup, lockBackup], [journal.noticesBackup, noticesBackup]]) {
    const stats = await lstat(filename).catch((error) => error.code === "ENOENT" ? undefined : Promise.reject(error));
    if (!stats || stats.isSymbolicLink() || !stats.isFile()) throw vendorError("DIAGRAM_VENDOR_RECOVERY_JOURNAL_INVALID", label);
  }
  const oldLock = await readFile(lockBackup, "utf8");
  const oldNotices = await readFile(noticesBackup, "utf8");
  let parsedOldLock;
  try { parsedOldLock = JSON.parse(oldLock); } catch { throw vendorError("DIAGRAM_VENDOR_RECOVERY_JOURNAL_INVALID", journal.lockBackup); }
  assertLockIdentity(parsedOldLock, name);
  if (parsedOldLock.tree.root !== journal.oldRoot) throw vendorError("DIAGRAM_VENDOR_RECOVERY_JOURNAL_INVALID", journal.lockBackup);
  const newStats = await lstat(newPath).catch((error) => error.code === "ENOENT" ? undefined : Promise.reject(error));
  if (newStats && (newStats.isSymbolicLink() || !newStats.isDirectory())) throw vendorError("DIAGRAM_VENDOR_RECOVERY_JOURNAL_INVALID", journal.newRoot);
  if (newStats) await assertSymlinkFreeDirectory(newPath, journal.newRoot);
  await atomicWriteFile(path.join(root, "vendor.lock.json"), oldLock);
  await atomicWriteFile(path.join(root, "THIRD_PARTY_NOTICES.md"), oldNotices);
  if (newStats) await rm(newPath, { recursive: true, force: true });
  await rm(lockBackup, { force: true });
  await rm(noticesBackup, { force: true });
  await rm(path.join(root, JOURNAL_FILENAME), { force: true });
  return true;
}

export async function recoverDiagramSkillVendor({ root, name, now, staleAfterMs } = {}) {
  if (!KNOWN_SKILLS.includes(name)) throw vendorError("DIAGRAM_VENDOR_UNKNOWN_SKILL", "name");
  const absoluteRoot = path.resolve(root ?? DEFAULT_ROOTS[name]);
  const journal = await assertJournal(absoluteRoot, name);
  if (!journal) return false;
  const lockRoot = path.join(absoluteRoot, OPERATION_LOCK_DIRECTORY);
  const staleOwner = await readOperationOwner(lockRoot, name);
  if (!staleOwner) throw vendorError("DIAGRAM_VENDOR_RECOVERY_OWNER_REQUIRED", OPERATION_LOCK_DIRECTORY);
  const timestamp = now ?? Date.now();
  if (timestamp - Date.parse(staleOwner.startedAt) <= (staleAfterMs ?? OPERATION_STALE_MS)) throw vendorError("DIAGRAM_VENDOR_OPERATION_ACTIVE", OPERATION_LOCK_DIRECTORY);
  if (journal.ownerNonce !== staleOwner.nonce) throw vendorError("DIAGRAM_VENDOR_RECOVERY_JOURNAL_INVALID", JOURNAL_FILENAME);
  await rm(lockRoot, { recursive: true, force: true });
  return withOperationLock({
    root: absoluteRoot,
    name,
    now: timestamp,
    staleAfterMs,
    operation: (owner) => recoverWithinOperation({ root: absoluteRoot, name, owner, expectedJournalOwnerNonce: staleOwner.nonce }),
  });
}

async function verifyVendorClosure({ root: absoluteRoot, name }) {
  const lock = await readVendorLock(absoluteRoot, name);
  const declared = normalizeFiles(lock.tree.files);
  if (new Set(declared.map((file) => file.path)).size !== declared.length) throw vendorError("DIAGRAM_VENDOR_LOCK_DUPLICATE_FILE", "tree.files");

  const actual = await listRegularFiles(path.join(absoluteRoot, lock.tree.root), "", lock.tree.root);
  const declaredByPath = new Map(declared.map((file) => [file.path, file]));
  const actualByPath = new Map(actual.map((file) => [file.path, file]));
  for (const file of actual) if (!declaredByPath.has(file.path)) throw vendorError("DIAGRAM_VENDOR_UNREGISTERED_FILE", `${lock.tree.root}/${file.path}`);
  for (const file of declared) {
    const actualFile = actualByPath.get(file.path);
    if (!actualFile) throw vendorError("DIAGRAM_VENDOR_FILE_MISSING", `${lock.tree.root}/${file.path}`);
    if (actualFile.size !== file.size || actualFile.sha256 !== file.sha256) throw vendorError("DIAGRAM_VENDOR_FILE_HASH_MISMATCH", `${lock.tree.root}/${file.path}`);
  }

  const rootFiles = (await listRegularFiles(absoluteRoot)).filter((file) => !file.path.startsWith(`${OPERATION_LOCK_DIRECTORY}/`));
  const allowedRootFiles = new Set(["vendor.lock.json", "THIRD_PARTY_NOTICES.md", ...declared.map((file) => `${lock.tree.root}/${file.path}`)]);
  for (const file of rootFiles) if (!allowedRootFiles.has(file.path)) throw vendorError("DIAGRAM_VENDOR_UNREGISTERED_FILE", file.path);
  for (const allowed of allowedRootFiles) if (!rootFiles.some((file) => file.path === allowed)) throw vendorError("DIAGRAM_VENDOR_FILE_MISSING", allowed);
  const licenseFile = actualByPath.get(lock.license.path);
  if (!licenseFile || licenseFile.sha256 !== lock.license.sha256) throw vendorError("DIAGRAM_VENDOR_LICENSE_HASH_MISMATCH", `${lock.tree.root}/${lock.license.path}`);
  const notices = await readFile(path.join(absoluteRoot, "THIRD_PARTY_NOTICES.md"), "utf8");
  for (const value of [lock.upstream.repository, lock.upstream.tag, lock.license.spdx, lock.license.sha256]) {
    if (!notices.includes(value)) throw vendorError("DIAGRAM_VENDOR_NOTICE_INCOMPLETE", "THIRD_PARTY_NOTICES.md");
  }
  return { name, tag: lock.upstream.tag, verifiedFiles: declared.length };
}

export async function verifyDiagramSkillVendor({ root, name, now, staleAfterMs } = {}) {
  if (!KNOWN_SKILLS.includes(name)) throw vendorError("DIAGRAM_VENDOR_UNKNOWN_SKILL", "name");
  const absoluteRoot = path.resolve(root ?? DEFAULT_ROOTS[name]);
  if (await pathExists(path.join(absoluteRoot, JOURNAL_FILENAME))) {
    await recoverDiagramSkillVendor({ root: absoluteRoot, name, now, staleAfterMs });
  }
  return withOperationLock({
    root: absoluteRoot,
    name,
    now,
    staleAfterMs,
    operation: async (owner) => {
      return verifyVendorClosure({ root: absoluteRoot, name });
    },
  });
}

export function parseDiagramSkillUpdaterArgs(args) {
  if (args.length === 1 && args[0] === "--check") return { mode: "check", network: false, skill: "all" };
  if (args.length === 1 && args[0] === "--check-latest") return { mode: "check-latest", network: true, skill: "all" };
  if (args.length === 2 && args[0] === "--update" && KNOWN_SKILLS.includes(args[1])) return { mode: "update", network: true, skill: args[1] };
  throw new Error("Usage: sync-diagram-skills.mjs --check | --check-latest | --update <skillstead|archify>");
}

function versionOf(tag) {
  const match = tag.match(/v(\d+)\.(\d+)\.(\d+)$/u);
  return match ? match.slice(1).map(Number) : undefined;
}

function compareVersions(leftTag, rightTag) {
  const left = versionOf(leftTag);
  const right = versionOf(rightTag);
  if (!left || !right) return 0;
  for (let index = 0; index < left.length; index += 1) if (left[index] !== right[index]) return left[index] - right[index];
  return 0;
}

function githubRepository(name) {
  return name === "skillstead" ? "kyungseo/skillstead" : "tt-a1i/archify";
}

async function fetchGithubJson(url, label) {
  const response = await fetch(url, { headers: { Accept: "application/vnd.github+json" } });
  if (!response.ok) throw new Error(`${label} failed: ${response.status}`);
  return response.json();
}

function releaseAsset(release) {
  const asset = release?.assets?.find(({ name }) => name === "archify.zip");
  const digest = typeof asset?.digest === "string" ? asset.digest.replace(/^sha256:/u, "") : undefined;
  if (!asset || typeof asset.browser_download_url !== "string" || !/^[a-f0-9]{64}$/u.test(digest ?? "")) {
    throw vendorError("DIAGRAM_VENDOR_RELEASE_ASSET_INVALID", "release.assets");
  }
  return { name: asset.name, url: asset.browser_download_url, sha256: digest };
}

function normalizeRelease(name, release) {
  if (!release || typeof release.tag_name !== "string" || typeof release.published_at !== "string") {
    throw vendorError("DIAGRAM_VENDOR_LATEST_RELEASE_INVALID", name);
  }
  return {
    tag: release.tag_name,
    releasedAt: release.published_at,
    ...(name === "archify" ? { releaseAsset: releaseAsset(release) } : {}),
  };
}

export function selectNewestSkillsteadRelease(releases) {
  if (!Array.isArray(releases)) throw vendorError("DIAGRAM_VENDOR_LATEST_RELEASE_INVALID", "skillstead");
  const stable = releases
    .filter((release) => release?.draft !== true && release?.prerelease !== true && /^svg-infographic\/v\d+\.\d+\.\d+$/u.test(release?.tag_name ?? ""))
    .map((release) => normalizeRelease("skillstead", release));
  if (stable.length === 0) throw vendorError("DIAGRAM_VENDOR_LATEST_RELEASE_INVALID", "skillstead");
  return stable.sort((left, right) => compareVersions(right.tag, left.tag))[0];
}

async function defaultFetchRelease({ name }) {
  const repository = githubRepository(name);
  if (name === "skillstead") {
    const releases = [];
    for (let page = 1; ; page += 1) {
      const response = await fetchGithubJson(
        `https://api.github.com/repos/${repository}/releases?per_page=100&page=${page}`,
        "Official Skillstead release lookup",
      );
      if (!Array.isArray(response)) throw vendorError("DIAGRAM_VENDOR_LATEST_RELEASE_INVALID", name);
      releases.push(...response);
      if (response.length < 100) break;
    }
    return selectNewestSkillsteadRelease(releases);
  }
  return normalizeRelease(name, await fetchGithubJson(`https://api.github.com/repos/${repository}/releases/latest`, "Official Archify release lookup"));
}

async function defaultResolveTagCommit({ name, tag }) {
  const repository = githubRepository(name);
  let object = (await fetchGithubJson(
    `https://api.github.com/repos/${repository}/git/ref/tags/${encodeURIComponent(tag)}`,
    "Official tag reference lookup",
  ))?.object;
  for (let depth = 0; depth < 4; depth += 1) {
    if (!object || !/^[a-f0-9]{40}$/u.test(object.sha ?? "")) throw vendorError("DIAGRAM_VENDOR_TAG_REFERENCE_INVALID", tag);
    if (object.type === "commit") return object.sha;
    if (object.type !== "tag" || typeof object.url !== "string" || !object.url.startsWith(`https://api.github.com/repos/${repository}/git/tags/`)) {
      throw vendorError("DIAGRAM_VENDOR_TAG_REFERENCE_INVALID", tag);
    }
    object = (await fetchGithubJson(object.url, "Official annotated tag lookup"))?.object;
  }
  throw vendorError("DIAGRAM_VENDOR_TAG_REFERENCE_INVALID", tag);
}

function assertRelease(name, release) {
  if (!release || typeof release.tag !== "string" || !stableTag.test(release.tag.replace("svg-infographic/", "")) || typeof release.releasedAt !== "string" || Number.isNaN(Date.parse(release.releasedAt))) {
    throw vendorError("DIAGRAM_VENDOR_LATEST_RELEASE_INVALID", name);
  }
  if (name === "skillstead" && !/^svg-infographic\/v\d+\.\d+\.\d+$/u.test(release.tag)) throw vendorError("DIAGRAM_VENDOR_LATEST_RELEASE_INVALID", name);
  if (name === "archify") {
    if (!release.releaseAsset || release.releaseAsset.name !== "archify.zip" || !/^https:\/\/github\.com\/tt-a1i\/archify\/releases\/download\/v\d+\.\d+\.\d+\/archify\.zip$/u.test(release.releaseAsset.url ?? "") || !/^[a-f0-9]{64}$/u.test(release.releaseAsset.sha256 ?? "")) {
      throw vendorError("DIAGRAM_VENDOR_RELEASE_ASSET_INVALID", "releaseAsset");
    }
  }
}

export async function checkLatestDiagramSkills({ root = repositoryRoot, skill = "all", fetchRelease = defaultFetchRelease, resolveTagCommit = defaultResolveTagCommit } = {}) {
  const names = skill === "all" ? KNOWN_SKILLS : [skill];
  const results = [];
  for (const name of names) {
    if (!KNOWN_SKILLS.includes(name)) throw vendorError("DIAGRAM_VENDOR_UNKNOWN_SKILL", "name");
    const lock = JSON.parse(await readFile(path.join(root, "shared/vendor", name, "vendor.lock.json"), "utf8"));
    assertLockIdentity(lock, name);
    const latest = await fetchRelease({ name, repository: OFFICIAL_REPOSITORIES[name] });
    assertRelease(name, latest);
    await resolveTagCommit({ name, tag: latest.tag, repository: OFFICIAL_REPOSITORIES[name] });
    const updateAvailable = compareVersions(latest.tag, lock.upstream.tag) > 0;
    results.push({ name, status: updateAvailable ? "outdated" : "current", installedTag: lock.upstream.tag, latestTag: latest.tag, updateAvailable });
  }
  return results;
}

function vendorTreeRoot(name, tag) {
  const version = tag.split("/").at(-1).replace(/^v/u, "");
  return name === "skillstead" ? `svg-infographic/${version}` : `archify/${version}`;
}

function assertArchiveFiles(archiveFiles, name) {
  if (!Array.isArray(archiveFiles) || archiveFiles.length === 0) throw vendorError("DIAGRAM_VENDOR_ARCHIVE_INVALID", "archive.files");
  const files = archiveFiles.map((file, index) => {
    if (!file || typeof file.path !== "string" || !(file.bytes instanceof Uint8Array)) throw vendorError("DIAGRAM_VENDOR_ARCHIVE_FILE_INVALID", `archive.files[${index}]`);
    if (file.path.startsWith("/") || file.path.includes("\\") || file.path.split("/").includes("..") || file.path === "") throw vendorError("DIAGRAM_VENDOR_ARCHIVE_PATH_INVALID", `archive.files[${index}].path`);
    return { path: file.path, bytes: file.bytes };
  }).sort((left, right) => left.path.localeCompare(right.path));
  if (new Set(files.map((file) => file.path)).size !== files.length) throw vendorError("DIAGRAM_VENDOR_ARCHIVE_DUPLICATE_FILE", "archive.files");
  if (files.some((file) => /(?:^|\/)(?:update|sync|install)(?:[-_.].*)?\.(?:mjs|js|sh|py)$/iu.test(file.path))) {
    throw vendorError("DIAGRAM_VENDOR_ARCHIVE_UPDATER_FORBIDDEN", "archive.files");
  }
  return files;
}

function zipFiles(bytes) {
  const buffer = Buffer.from(bytes);
  let end = -1;
  for (let offset = buffer.length - 22; offset >= Math.max(0, buffer.length - 65_557); offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) {
      end = offset;
      break;
    }
  }
  if (end < 0) throw vendorError("DIAGRAM_VENDOR_ARCHIVE_INVALID", "zip.end-of-central-directory");
  const count = buffer.readUInt16LE(end + 10);
  const directorySize = buffer.readUInt32LE(end + 12);
  const directoryOffset = buffer.readUInt32LE(end + 16);
  if (directoryOffset + directorySize > buffer.length) throw vendorError("DIAGRAM_VENDOR_ARCHIVE_INVALID", "zip.central-directory");
  const decoder = new TextDecoder();
  const files = [];
  let cursor = directoryOffset;
  for (let index = 0; index < count; index += 1) {
    if (cursor + 46 > buffer.length || buffer.readUInt32LE(cursor) !== 0x02014b50) throw vendorError("DIAGRAM_VENDOR_ARCHIVE_INVALID", "zip.central-entry");
    const method = buffer.readUInt16LE(cursor + 10);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const uncompressedSize = buffer.readUInt32LE(cursor + 24);
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const externalAttributes = buffer.readUInt32LE(cursor + 38);
    const localOffset = buffer.readUInt32LE(cursor + 42);
    const nameStart = cursor + 46;
    const nameEnd = nameStart + nameLength;
    if (nameEnd > buffer.length) throw vendorError("DIAGRAM_VENDOR_ARCHIVE_INVALID", "zip.entry-name");
    const filename = decoder.decode(buffer.subarray(nameStart, nameEnd));
    cursor = nameEnd + extraLength + commentLength;
    if (filename.endsWith("/")) continue;
    if (((externalAttributes >>> 16) & 0o170000) === 0o120000) throw vendorError("DIAGRAM_VENDOR_ARCHIVE_SYMLINK", filename);
    if (localOffset + 30 > buffer.length || buffer.readUInt32LE(localOffset) !== 0x04034b50) throw vendorError("DIAGRAM_VENDOR_ARCHIVE_INVALID", filename);
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > buffer.length) throw vendorError("DIAGRAM_VENDOR_ARCHIVE_INVALID", filename);
    let content;
    if (method === 0) content = buffer.subarray(dataStart, dataEnd);
    else if (method === 8) content = inflateRawSync(buffer.subarray(dataStart, dataEnd));
    else throw vendorError("DIAGRAM_VENDOR_ARCHIVE_COMPRESSION_UNSUPPORTED", filename);
    if (content.length !== uncompressedSize) throw vendorError("DIAGRAM_VENDOR_ARCHIVE_INVALID", filename);
    files.push({ path: filename, bytes: content });
  }
  return files;
}

function removeArchiveTopLevel(files, requiredPrefix) {
  const matching = files.flatMap((file) => {
    const offset = file.path.indexOf(requiredPrefix);
    if (offset < 0 || (offset > 0 && file.path[offset - 1] !== "/")) return [];
    const relativePath = file.path.slice(offset + requiredPrefix.length);
    if (relativePath === "") return [];
    return [{ ...file, path: relativePath }];
  });
  if (matching.length === 0) throw vendorError("DIAGRAM_VENDOR_ARCHIVE_SKILL_MISSING", requiredPrefix);
  return matching;
}

function archiveFilesFromBytes({ name, bytes }) {
  if (!(bytes instanceof Uint8Array)) throw vendorError("DIAGRAM_VENDOR_ARCHIVE_INVALID", "archive.bytes");
  const archiveFiles = zipFiles(bytes);
  const files = name === "skillstead"
    ? removeArchiveTopLevel(archiveFiles, "skills/svg-infographic/")
    : removeArchiveTopLevel(archiveFiles, "archify/");
  return assertArchiveFiles(files, name);
}

async function defaultFetchArchive({ name, release, commit }) {
  const url = name === "archify"
    ? release.releaseAsset.url
    : `https://github.com/${githubRepository(name)}/archive/${commit}.zip`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Official ${name} archive download failed: ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

export async function defaultFetchOfficialTree({ name, commit, fetchJson = fetchGithubJson }) {
  const repository = githubRepository(name);
  const tree = await fetchJson(`https://api.github.com/repos/${repository}/git/trees/${commit}?recursive=1`, "Official immutable tree lookup");
  if (!tree || tree.truncated === true || !Array.isArray(tree.tree)) throw vendorError("DIAGRAM_VENDOR_OFFICIAL_TREE_INVALID", "tree");
  const prefix = "skills/svg-infographic/";
  const matching = tree.tree.filter((entry) => typeof entry?.path === "string" && entry.path.startsWith(prefix));
  if (name !== "skillstead" || matching.length === 0) throw vendorError("DIAGRAM_VENDOR_OFFICIAL_TREE_INVALID", "tree");
  const files = [];
  for (const entry of matching) {
    // A recursive listing names directories alongside files, and the skill has had subdirectories since
    // before it was first vendored. Passing those to the blob check rejected every real tree, which left
    // this cross-check — the one that proves the downloaded archive is the bytes GitHub records for the
    // tagged commit — failing closed and therefore never actually run. Directories are skipped; anything
    // that is neither a blob nor a directory, a submodule above all, still ends the run.
    if (entry.type === "tree" && entry.mode === "040000") continue;
    if (entry.type !== "blob" || entry.mode === "120000" || !/^[a-f0-9]{40}$/u.test(entry.sha ?? "")) {
      throw vendorError("DIAGRAM_VENDOR_OFFICIAL_TREE_INVALID", entry.path);
    }
    files.push({ path: entry.path.slice(prefix.length), sha: entry.sha });
  }
  if (files.length === 0) throw vendorError("DIAGRAM_VENDOR_OFFICIAL_TREE_INVALID", "tree");
  return files.sort(compareFiles);
}

function assertSkillsteadOfficialTree(files, officialTree) {
  if (!Array.isArray(officialTree) || officialTree.length === 0) throw vendorError("DIAGRAM_VENDOR_OFFICIAL_TREE_INVALID", "tree");
  const expected = officialTree.map((entry, index) => {
    if (!entry || typeof entry.path !== "string" || !/^[a-f0-9]{40}$/u.test(entry.sha ?? "")) throw vendorError("DIAGRAM_VENDOR_OFFICIAL_TREE_INVALID", `tree[${index}]`);
    return entry;
  }).sort(compareFiles);
  if (new Set(expected.map(({ path: filePath }) => filePath)).size !== expected.length) throw vendorError("DIAGRAM_VENDOR_OFFICIAL_TREE_INVALID", "tree");
  if (files.length !== expected.length) throw vendorError("DIAGRAM_VENDOR_ARCHIVE_TREE_MISMATCH", "tree.files");
  for (let index = 0; index < expected.length; index += 1) {
    if (files[index].path !== expected[index].path || gitBlobSha(files[index].bytes) !== expected[index].sha) {
      throw vendorError("DIAGRAM_VENDOR_ARCHIVE_TREE_MISMATCH", files[index].path);
    }
  }
}

function noticeFor(lock) {
  return [
    `# ${lock.upstream.skillPath === "archify" ? "Archify" : "Skillstead svg-infographic"} Vendor Notice`,
    "",
    `- Upstream: ${lock.upstream.repository}`,
    `- Release: \`${lock.upstream.tag}\``,
    `- Commit: \`${lock.upstream.commit}\``,
    `- License: ${lock.license.spdx}`,
    `- License SHA-256: \`${lock.license.sha256}\``,
    "",
    `The complete upstream license is retained in \`${lock.tree.root}/${lock.license.path}\`.`,
    "",
  ].join("\n");
}

async function assertMissing(pathname, label) {
  try {
    await lstat(pathname);
  } catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }
  throw vendorError("DIAGRAM_VENDOR_STAGING_EXISTS", label);
}

export async function updateDiagramSkill({ root, name, stagingRoot, fetchRelease = defaultFetchRelease, resolveTagCommit = defaultResolveTagCommit, fetchOfficialTree = defaultFetchOfficialTree, fetchArchive = defaultFetchArchive, renamePath = rename, writePath = writeFile, afterNotices, now, staleAfterMs } = {}) {
  if (!KNOWN_SKILLS.includes(name)) throw vendorError("DIAGRAM_VENDOR_UNKNOWN_SKILL", "name");
  if (typeof fetchArchive !== "function") throw vendorError("DIAGRAM_VENDOR_ARCHIVE_FETCHER_REQUIRED", "fetchArchive");
  const vendorRoot = path.resolve(root ?? DEFAULT_ROOTS[name]);
  if (await pathExists(path.join(vendorRoot, JOURNAL_FILENAME))) {
    await recoverDiagramSkillVendor({ root: vendorRoot, name, now, staleAfterMs });
  }
  return withOperationLock({ root: vendorRoot, name, now, staleAfterMs, operation: async (owner) => {
    const installed = await readVendorLock(vendorRoot, name);
    await verifyVendorClosure({ root: vendorRoot, name });
    const release = await fetchRelease({ name, repository: OFFICIAL_REPOSITORIES[name] });
    assertRelease(name, release);
    const commit = await resolveTagCommit({ name, tag: release.tag, repository: OFFICIAL_REPOSITORIES[name] });
    if (!/^[a-f0-9]{40}$/u.test(commit ?? "")) throw vendorError("DIAGRAM_VENDOR_TAG_REFERENCE_INVALID", release.tag);
    if (compareVersions(release.tag, installed.upstream.tag) <= 0) throw vendorError("DIAGRAM_VENDOR_RELEASE_NOT_NEWER", "upstream.tag");
    const rawArchive = await fetchArchive({ name, release, commit, repository: OFFICIAL_REPOSITORIES[name] });
    if (!(rawArchive instanceof Uint8Array)) throw vendorError("DIAGRAM_VENDOR_ARCHIVE_INVALID", "archive.bytes");
    if (name === "archify" && sha256(rawArchive) !== release.releaseAsset.sha256) throw vendorError("DIAGRAM_VENDOR_ARCHIVE_HASH_MISMATCH", "releaseAsset.sha256");
    const archive = archiveFilesFromBytes({ name, bytes: rawArchive });
    const treeRoot = vendorTreeRoot(name, release.tag);
    const licensePath = installed.license.path;
    const license = archive.find((file) => file.path === licensePath);
    if (!license) throw vendorError("DIAGRAM_VENDOR_ARCHIVE_LICENSE_MISSING", licensePath);
    if (!archive.some((file) => file.path === "SKILL.md")) throw vendorError("DIAGRAM_VENDOR_ARCHIVE_SKILL_MISSING", "SKILL.md");
    if (sha256(license.bytes) !== TRUSTED_LICENSES[name].sha256) throw vendorError("DIAGRAM_VENDOR_ARCHIVE_LICENSE_HASH_MISMATCH", licensePath);
    if (name === "skillstead") assertSkillsteadOfficialTree(archive, await fetchOfficialTree({ name, commit, repository: OFFICIAL_REPOSITORIES[name] }));
    const lock = {
      schemaVersion: 1,
      upstream: {
        ...installed.upstream,
        tag: release.tag,
        commit,
        releasedAt: release.releasedAt,
        ...(release.releaseAsset ? { releaseAsset: release.releaseAsset } : {}),
      },
      license: { ...TRUSTED_LICENSES[name] },
      tree: { root: treeRoot, files: archive.map((file) => ({ path: file.path, size: file.bytes.length, sha256: sha256(file.bytes) })) },
    };
    const absoluteStagingRoot = path.resolve(stagingRoot ?? path.join(path.dirname(vendorRoot), `.${name}-stage-${process.pid}`));
    if (path.dirname(absoluteStagingRoot) !== path.dirname(vendorRoot)) throw vendorError("DIAGRAM_VENDOR_STAGING_OUTSIDE_PARENT", "stagingRoot");
    await assertMissing(absoluteStagingRoot, "stagingRoot");
    const stagedTree = assertContained(absoluteStagingRoot, treeRoot, "DIAGRAM_VENDOR_ARCHIVE_PATH_INVALID", "tree.root");
    await mkdir(stagedTree, { recursive: true });
    for (const file of archive) {
      const destination = assertContained(stagedTree, file.path, "DIAGRAM_VENDOR_ARCHIVE_PATH_INVALID", file.path);
      await mkdir(path.dirname(destination), { recursive: true });
      await writeFile(destination, file.bytes, { mode: 0o644 });
    }
    await writeFile(path.join(absoluteStagingRoot, "vendor.lock.json"), `${JSON.stringify(lock, null, 2)}\n`, { mode: 0o644 });
    await writeFile(path.join(absoluteStagingRoot, "THIRD_PARTY_NOTICES.md"), noticeFor(lock), { mode: 0o644 });
    const verified = await verifyVendorClosure({ root: absoluteStagingRoot, name });
    const newTree = assertContained(vendorRoot, treeRoot, "DIAGRAM_VENDOR_ARCHIVE_PATH_INVALID", "tree.root");
    await assertMissing(newTree, "newTree");
    const journalPath = path.join(vendorRoot, JOURNAL_FILENAME);
    await assertMissing(journalPath, "journal");
    const journal = {
      schemaVersion: 2,
      name,
      oldRoot: installed.tree.root,
      newRoot: treeRoot,
      ownerNonce: owner.nonce,
      lockBackup: LOCK_BACKUP_FILENAME,
      noticesBackup: NOTICES_BACKUP_FILENAME,
    };
    const lockBackupPath = path.join(vendorRoot, LOCK_BACKUP_FILENAME);
    const noticesBackupPath = path.join(vendorRoot, NOTICES_BACKUP_FILENAME);
    await assertMissing(lockBackupPath, "lockBackup");
    await assertMissing(noticesBackupPath, "noticesBackup");
    try {
      await atomicWriteFile(lockBackupPath, await readFile(path.join(vendorRoot, "vendor.lock.json"), "utf8"));
      await atomicWriteFile(noticesBackupPath, await readFile(path.join(vendorRoot, "THIRD_PARTY_NOTICES.md"), "utf8"));
      await atomicWriteFile(journalPath, `${JSON.stringify(journal)}\n`, { renamePath });
      await renamePath(stagedTree, newTree);
      await atomicWriteFile(path.join(vendorRoot, "vendor.lock.json"), `${JSON.stringify(lock, null, 2)}\n`, { renamePath, writePath });
      await atomicWriteFile(path.join(vendorRoot, "THIRD_PARTY_NOTICES.md"), noticeFor(lock), { renamePath, writePath });
      if (afterNotices) await afterNotices({ root: vendorRoot, name, lock });
      await rm(assertContained(vendorRoot, installed.tree.root, "DIAGRAM_VENDOR_ARCHIVE_PATH_INVALID", "oldRoot"), { recursive: true, force: true });
      await rm(journalPath, { force: true });
      await rm(lockBackupPath, { force: true });
      await rm(noticesBackupPath, { force: true });
      await rm(absoluteStagingRoot, { recursive: true, force: true });
    } catch (error) {
      if (await pathExists(journalPath)) {
        await recoverWithinOperation({ root: vendorRoot, name, owner }).catch(() => undefined);
      } else {
        await rm(lockBackupPath, { force: true }).catch(() => undefined);
        await rm(noticesBackupPath, { force: true }).catch(() => undefined);
      }
      throw error;
    }
    return verified;
  }});
}

async function main() {
  const options = parseDiagramSkillUpdaterArgs(process.argv.slice(2));
  if (options.mode === "check") {
    process.stdout.write(`${JSON.stringify(await Promise.all(KNOWN_SKILLS.map((name) => verifyDiagramSkillVendor({ name }))))}\n`);
    return;
  }
  if (options.mode === "check-latest") {
    process.stdout.write(`${JSON.stringify(await checkLatestDiagramSkills())}\n`);
    return;
  }
  process.stdout.write(`${JSON.stringify(await updateDiagramSkill({ name: options.skill }))}\n`);
}

// Compare resolved paths, not a hand-built file:// string: import.meta.url percent-encodes anything a
// URL must escape, so a checkout under a path with a space or a non-ASCII character never matches the
// concatenated form. The guard then silently declines to run main, and the caller reads exit 0 as done.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error.stack ?? error.message}\n`);
    process.exitCode = 1;
  });
}
