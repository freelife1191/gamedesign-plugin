#!/usr/bin/env node
import { createHash } from "node:crypto";
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

function vendorError(code, relativePath, message = code) {
  const error = new Error(message);
  error.code = code;
  error.path = relativePath;
  return error;
}

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const compareFiles = (left, right) => left.path.localeCompare(right.path);

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
  if (!lock.license || !["Apache-2.0", "MIT"].includes(lock.license.spdx) || typeof lock.license.path !== "string" || !/^[a-f0-9]{64}$/u.test(lock.license.sha256 ?? "")) throw vendorError("DIAGRAM_VENDOR_LICENSE_INVALID", "license");
  if (!lock.tree || typeof lock.tree.root !== "string" || lock.tree.root.startsWith("/") || lock.tree.root.split("/").includes("..")) throw vendorError("DIAGRAM_VENDOR_TREE_ROOT_INVALID", "tree.root");
}

export async function verifyDiagramSkillVendor({ root, name }) {
  if (!KNOWN_SKILLS.includes(name)) throw vendorError("DIAGRAM_VENDOR_UNKNOWN_SKILL", "name");
  const absoluteRoot = path.resolve(root ?? DEFAULT_ROOTS[name]);
  let lock;
  try {
    lock = JSON.parse(await readFile(path.join(absoluteRoot, "vendor.lock.json"), "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") throw vendorError("DIAGRAM_VENDOR_FILE_MISSING", "vendor.lock.json");
    if (error instanceof SyntaxError) throw vendorError("DIAGRAM_VENDOR_LOCK_INVALID", "vendor.lock.json");
    throw error;
  }
  assertLockIdentity(lock, name);
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

  const rootFiles = await listRegularFiles(absoluteRoot);
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

async function defaultFetchRelease({ name }) {
  const repository = name === "skillstead" ? "kyungseo/skillstead" : "tt-a1i/archify";
  const response = await fetch(`https://api.github.com/repos/${repository}/releases/latest`, { headers: { Accept: "application/vnd.github+json" } });
  if (!response.ok) throw new Error(`Official ${name} release lookup failed: ${response.status}`);
  const release = await response.json();
  return { tag: release.tag_name, commit: release.target_commitish, releasedAt: release.published_at };
}

export async function checkLatestDiagramSkills({ root = repositoryRoot, skill = "all", fetchRelease = defaultFetchRelease } = {}) {
  const names = skill === "all" ? KNOWN_SKILLS : [skill];
  const results = [];
  for (const name of names) {
    if (!KNOWN_SKILLS.includes(name)) throw vendorError("DIAGRAM_VENDOR_UNKNOWN_SKILL", "name");
    const lock = JSON.parse(await readFile(path.join(root, "shared/vendor", name, "vendor.lock.json"), "utf8"));
    assertLockIdentity(lock, name);
    const latest = await fetchRelease({ name, repository: OFFICIAL_REPOSITORIES[name] });
    if (!latest || typeof latest.tag !== "string" || typeof latest.commit !== "string" || !stableTag.test(latest.tag.replace("svg-infographic/", ""))) throw vendorError("DIAGRAM_VENDOR_LATEST_RELEASE_INVALID", name);
    const updateAvailable = compareVersions(latest.tag, lock.upstream.tag) > 0;
    results.push({ name, status: updateAvailable ? "outdated" : "current", installedTag: lock.upstream.tag, latestTag: latest.tag, updateAvailable });
  }
  return results;
}

function vendorTreeRoot(name, tag) {
  const version = tag.split("/").at(-1).replace(/^v/u, "");
  return name === "skillstead" ? `svg-infographic/${version}` : `archify/${version}`;
}

function assertArchiveFiles(archive) {
  if (!archive || !Array.isArray(archive.files) || archive.files.length === 0) throw vendorError("DIAGRAM_VENDOR_ARCHIVE_INVALID", "archive.files");
  const files = archive.files.map((file, index) => {
    if (!file || typeof file.path !== "string" || !(file.bytes instanceof Uint8Array)) throw vendorError("DIAGRAM_VENDOR_ARCHIVE_FILE_INVALID", `archive.files[${index}]`);
    if (file.path.startsWith("/") || file.path.includes("\\") || file.path.split("/").includes("..") || file.path === "") throw vendorError("DIAGRAM_VENDOR_ARCHIVE_PATH_INVALID", `archive.files[${index}].path`);
    return { path: file.path, bytes: file.bytes };
  }).sort((left, right) => left.path.localeCompare(right.path));
  if (new Set(files.map((file) => file.path)).size !== files.length) throw vendorError("DIAGRAM_VENDOR_ARCHIVE_DUPLICATE_FILE", "archive.files");
  return files;
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

export async function updateDiagramSkill({ root, name, stagingRoot, fetchRelease = defaultFetchRelease, fetchArchive } = {}) {
  if (!KNOWN_SKILLS.includes(name)) throw vendorError("DIAGRAM_VENDOR_UNKNOWN_SKILL", "name");
  if (typeof fetchArchive !== "function") throw vendorError("DIAGRAM_VENDOR_ARCHIVE_FETCHER_REQUIRED", "fetchArchive");
  const vendorRoot = path.resolve(root ?? DEFAULT_ROOTS[name]);
  const installed = JSON.parse(await readFile(path.join(vendorRoot, "vendor.lock.json"), "utf8"));
  assertLockIdentity(installed, name);
  await verifyDiagramSkillVendor({ root: vendorRoot, name });
  const release = await fetchRelease({ name, repository: OFFICIAL_REPOSITORIES[name] });
  if (!release || typeof release.tag !== "string" || !stableTag.test(release.tag.replace("svg-infographic/", "")) || !/^[a-f0-9]{40}$/u.test(release.commit ?? "") || typeof release.releasedAt !== "string" || Number.isNaN(Date.parse(release.releasedAt))) {
    throw vendorError("DIAGRAM_VENDOR_LATEST_RELEASE_INVALID", name);
  }
  if (compareVersions(release.tag, installed.upstream.tag) <= 0) throw vendorError("DIAGRAM_VENDOR_RELEASE_NOT_NEWER", "upstream.tag");
  const archive = assertArchiveFiles(await fetchArchive(release));
  const treeRoot = vendorTreeRoot(name, release.tag);
  const licensePath = installed.license.path;
  const license = archive.find((file) => file.path === licensePath);
  if (!license) throw vendorError("DIAGRAM_VENDOR_ARCHIVE_LICENSE_MISSING", licensePath);
  if (!archive.some((file) => file.path === "SKILL.md")) throw vendorError("DIAGRAM_VENDOR_ARCHIVE_SKILL_MISSING", "SKILL.md");
  const lock = {
    schemaVersion: 1,
    upstream: {
      ...installed.upstream,
      tag: release.tag,
      commit: release.commit,
      releasedAt: release.releasedAt,
      ...(release.releaseAsset ? { releaseAsset: release.releaseAsset } : {}),
    },
    license: { ...installed.license, sha256: sha256(license.bytes) },
    tree: { root: treeRoot, files: archive.map((file) => ({ path: file.path, size: file.bytes.length, sha256: sha256(file.bytes) })) },
  };
  const absoluteStagingRoot = path.resolve(stagingRoot ?? path.join(path.dirname(vendorRoot), `.${name}-stage-${process.pid}`));
  if (path.dirname(absoluteStagingRoot) !== path.dirname(vendorRoot)) throw vendorError("DIAGRAM_VENDOR_STAGING_OUTSIDE_PARENT", "stagingRoot");
  await assertMissing(absoluteStagingRoot, "stagingRoot");
  await mkdir(path.join(absoluteStagingRoot, treeRoot), { recursive: true });
  for (const file of archive) {
    const destination = path.resolve(absoluteStagingRoot, treeRoot, file.path);
    if (!destination.startsWith(`${path.resolve(absoluteStagingRoot, treeRoot)}${path.sep}`)) throw vendorError("DIAGRAM_VENDOR_ARCHIVE_PATH_INVALID", file.path);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, file.bytes, { mode: 0o644 });
  }
  await writeFile(path.join(absoluteStagingRoot, "vendor.lock.json"), `${JSON.stringify(lock, null, 2)}\n`, { mode: 0o644 });
  await writeFile(path.join(absoluteStagingRoot, "THIRD_PARTY_NOTICES.md"), noticeFor(lock), { mode: 0o644 });
  const verified = await verifyDiagramSkillVendor({ root: absoluteStagingRoot, name });
  const backupRoot = `${vendorRoot}.previous-${process.pid}`;
  await assertMissing(backupRoot, "backupRoot");
  await rename(vendorRoot, backupRoot);
  try {
    await rename(absoluteStagingRoot, vendorRoot);
  } catch (error) {
    await rename(backupRoot, vendorRoot);
    throw error;
  }
  await rm(backupRoot, { recursive: true, force: true });
  return verified;
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
  throw new Error("--update requires verified release automation and is intentionally unavailable during normal plugin installation.");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    process.stderr.write(`${error.stack ?? error.message}\n`);
    process.exitCode = 1;
  });
}
