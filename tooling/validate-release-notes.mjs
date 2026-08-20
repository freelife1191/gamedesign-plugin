#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { lstat, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const SEMVER_TAG = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u;
const GITHUB_START = "<!-- github-release:start -->";
const GITHUB_END = "<!-- github-release:end -->";
const REQUIRED_GITHUB_HEADINGS = Object.freeze([
  "## GitHub 게시용 요약",
  "### 주요 변경",
  "### 업데이트 안내",
  "### 검증 요약",
  "### 알려진 제한",
]);
const REQUIRED_DETAIL_HEADINGS = Object.freeze([
  "## 상세 릴리스 노트",
  "### 변경 배경과 목표",
  "### 기능별 상세",
  "### 설치 및 업그레이드",
  "### 호환성과 운영",
  "### 검증 근거",
  "### 변경 이력",
]);

function runGit(repoRoot, args, { allowFailure = false } = {}) {
  const result = spawnSync("git", args, { cwd: repoRoot, encoding: "utf8" });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    if (allowFailure) return null;
    throw new Error(`git ${args.join(" ")} failed: ${(result.stderr || result.stdout).trim()}`);
  }
  return result.stdout.trim();
}

function compareTags(left, right) {
  const leftParts = SEMVER_TAG.exec(left)?.slice(1).map(Number);
  const rightParts = SEMVER_TAG.exec(right)?.slice(1).map(Number);
  if (!leftParts || !rightParts) return left.localeCompare(right);
  for (let index = 0; index < leftParts.length; index += 1) {
    if (leftParts[index] !== rightParts[index]) return leftParts[index] - rightParts[index];
  }
  return 0;
}

async function readSuiteReleaseLock(repoRoot) {
  const source = await readFile(path.join(repoRoot, "shared", "updates", "suite-release.lock.json"), "utf8").catch((error) => {
    if (error.code === "ENOENT") return null;
    throw error;
  });
  if (source === null) return null;
  const lock = JSON.parse(source);
  if (!SEMVER_TAG.test(lock.installedTag ?? "")) throw new Error("suite release lock has an invalid installedTag");
  if (!/^[a-f0-9]{40}$/u.test(lock.commit ?? "")) throw new Error("suite release lock has an invalid commit");
  return { tag: lock.installedTag, commit: lock.commit };
}

function resolveTag(repoRoot, tag, fallbackCommit = null) {
  const commit = runGit(repoRoot, ["rev-parse", `${tag}^{}`], { allowFailure: true }) ?? fallbackCommit;
  if (!commit || !/^[a-f0-9]{40}$/u.test(commit)) throw new Error(`${tag}: commit could not be resolved`);
  const date = runGit(repoRoot, ["show", "-s", "--format=%as", commit], { allowFailure: true });
  return { tag, commit, date: /^\d{4}-\d{2}-\d{2}$/u.test(date ?? "") ? date : null };
}

export async function discoverReleaseRefs({
  repoRoot = fileURLToPath(new URL("..", import.meta.url)),
  additionalTags = [],
} = {}) {
  const listed = runGit(repoRoot, ["tag", "--list", "v[0-9]*"]);
  const tags = new Set(listed.split(/\r?\n/u).filter((tag) => SEMVER_TAG.test(tag)));
  const lock = await readSuiteReleaseLock(repoRoot);
  if (lock) tags.add(lock.tag);
  for (const tag of additionalTags) {
    if (!SEMVER_TAG.test(tag)) throw new Error(`invalid release tag: ${tag}`);
    tags.add(tag);
  }
  return [...tags]
    .sort(compareTags)
    .map((tag) => resolveTag(repoRoot, tag, lock?.tag === tag ? lock.commit : null));
}

function metadataValue(source, name) {
  return new RegExp(`^<!-- ${name}: (.+) -->$`, "mu").exec(source)?.[1]?.trim() ?? null;
}

function titleSummary(title, tag) {
  const prefix = `${tag} — `;
  if (!title?.startsWith(prefix)) return null;
  const summary = title
    .slice(prefix.length)
    .normalize("NFKC")
    .replace(/\s+/gu, " ")
    .trim();
  if (summary === "" || summary.length > 100) return null;
  if (/[<>:"/\\|?*\u0000-\u001f]/u.test(summary) || /[. ]$/u.test(summary)) return null;
  return summary;
}

export function extractGithubReleaseBody(source) {
  const start = source.indexOf(GITHUB_START);
  const end = source.indexOf(GITHUB_END);
  if (start === -1 || end === -1 || end <= start) return null;
  if (source.indexOf(GITHUB_START, start + GITHUB_START.length) !== -1) return null;
  if (source.indexOf(GITHUB_END, end + GITHUB_END.length) !== -1) return null;
  const body = source.slice(start + GITHUB_START.length, end).trim();
  return body === "" ? null : `${body}\n`;
}

function validateNoteSource({ source, releaseRef, relativePath }) {
  const errors = [];
  const title = metadataValue(source, "release-title");
  const date = metadataValue(source, "release-date");
  const commit = metadataValue(source, "release-commit");
  const status = metadataValue(source, "release-status");
  const firstHeading = /^# (.+)$/mu.exec(source)?.[1]?.trim() ?? null;
  const githubBody = extractGithubReleaseBody(source);

  if (!title?.startsWith(`${releaseRef.tag} — `)) errors.push(`${relativePath}: release-title must start with ${releaseRef.tag} —`);
  if (firstHeading !== title) errors.push(`${relativePath}: H1 must equal release-title`);
  if (releaseRef.date !== null && date !== releaseRef.date) errors.push(`${relativePath}: release-date must be ${releaseRef.date}`);
  if (commit !== releaseRef.commit) errors.push(`${relativePath}: release-commit must be ${releaseRef.commit}`);
  if (!new Set(["draft", "historical", "published"]).has(status)) {
    errors.push(`${relativePath}: release-status must be draft, historical, or published`);
  }
  if (githubBody === null) {
    errors.push(`${relativePath}: ${GITHUB_START}와 ${GITHUB_END} 경계가 정확히 한 쌍 필요합니다`);
  } else {
    for (const heading of REQUIRED_GITHUB_HEADINGS) {
      if (!githubBody.includes(`${heading}\n`)) errors.push(`${relativePath}: GitHub 게시 구간에 "${heading}"이 필요합니다`);
    }
  }
  for (const heading of REQUIRED_DETAIL_HEADINGS) {
    if (!source.includes(`\n${heading}\n`)) errors.push(`${relativePath}: 상세 구간에 "${heading}"이 필요합니다`);
  }
  if (source.charCodeAt(0) === 0xfeff) errors.push(`${relativePath}: UTF-8 BOM is not allowed`);
  if (source.includes("\r")) errors.push(`${relativePath}: CR line endings are not allowed`);
  return { errors, title, date, commit, status, githubBody };
}

export async function validateReleaseNotes({
  repoRoot = fileURLToPath(new URL("..", import.meta.url)),
  releaseRefs,
} = {}) {
  const refs = releaseRefs ?? await discoverReleaseRefs({ repoRoot });
  const releaseRoot = path.join(repoRoot, "release");
  const errors = [];
  const notes = [];
  const entries = await readdir(releaseRoot).catch((error) => error.code === "ENOENT" ? [] : Promise.reject(error));
  const index = await readFile(path.join(releaseRoot, "README.md"), "utf8").catch((error) => {
    if (error.code === "ENOENT") return null;
    throw error;
  });
  if (index === null) errors.push("release/README.md: 릴리스 노트 색인이 없습니다");

  for (const releaseRef of refs) {
    const prefix = releaseRef.date === null ? null : `${releaseRef.date}-${releaseRef.tag}-`;
    const candidates = entries.filter((name) => {
      if (!name.endsWith(".md")) return false;
      if (prefix !== null) return name.startsWith(prefix);
      return name.includes(`-${releaseRef.tag}-`);
    });
    if (candidates.length !== 1) {
      errors.push(`release/: ${releaseRef.tag} 릴리스 노트는 YYYY-MM-DD-${releaseRef.tag}-자연스러운 릴리스 요약.md 형식으로 정확히 하나여야 합니다`);
      continue;
    }
    const filename = candidates[0];
    const relativePath = `release/${filename}`;
    const absolutePath = path.join(repoRoot, relativePath);
    const stats = await lstat(absolutePath).catch((error) => error.code === "ENOENT" ? null : Promise.reject(error));
    if (!stats?.isFile() || stats.isSymbolicLink()) {
      errors.push(`${relativePath}: 릴리스 노트 파일이 없습니다`);
      continue;
    }
    const source = await readFile(absolutePath, "utf8");
    const validated = validateNoteSource({ source, releaseRef, relativePath });
    errors.push(...validated.errors);
    const summary = titleSummary(validated.title, releaseRef.tag);
    const expectedFilename = summary === null || releaseRef.date === null
      ? null
      : `${releaseRef.date}-${releaseRef.tag}-${summary}.md`;
    if (expectedFilename !== filename) {
      errors.push(`${relativePath}: 파일명은 ${expectedFilename ?? `YYYY-MM-DD-${releaseRef.tag}-자연스러운 릴리스 요약.md`}와 일치해야 합니다`);
    }
    const indexedPlain = `[${releaseRef.tag}](./${filename})`;
    const indexedWithSpaces = `[${releaseRef.tag}](<./${filename}>)`;
    if (index !== null && !index.includes(indexedPlain) && !index.includes(indexedWithSpaces)) {
      errors.push(`release/README.md: ${releaseRef.tag} 색인 링크가 없습니다`);
    }
    notes.push({ ...releaseRef, path: relativePath, ...validated });
  }

  const known = new Set(notes.map(({ path: notePath }) => path.basename(notePath)));
  for (const entry of entries.filter((name) => /^(?:\d{4}-\d{2}-\d{2}-)?v\d+\.\d+\.\d+(?:-.+)?\.md$/u.test(name))) {
    if (!known.has(entry)) errors.push(`release/${entry}: 대응하는 Git 태그나 suite release lock이 없거나 파일명 규칙이 잘못됐습니다`);
  }
  return { ok: errors.length === 0, errors, notes };
}

function parseArgs(argv) {
  const additionalTags = [];
  let json = false;
  let githubTag = null;
  let output = null;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--json") json = true;
    else if (argument === "--github") {
      githubTag = argv[index + 1];
      if (!SEMVER_TAG.test(githubTag ?? "")) throw new Error("--github needs vX.Y.Z");
      additionalTags.push(githubTag);
      index += 1;
    } else if (argument === "--output") {
      output = argv[index + 1];
      if (!output) throw new Error("--output needs a file path");
      index += 1;
    }
    else if (argument === "--tag") {
      const tag = argv[index + 1];
      if (!tag) throw new Error("--tag needs vX.Y.Z");
      additionalTags.push(tag);
      index += 1;
    } else throw new Error(`unknown argument: ${argument}`);
  }
  if (output !== null && githubTag === null) throw new Error("--output requires --github vX.Y.Z");
  if (json && githubTag !== null) throw new Error("--json and --github cannot be combined");
  return { additionalTags, json, githubTag, output };
}

async function main() {
  const { additionalTags, json, githubTag, output } = parseArgs(process.argv.slice(2));
  const repoRoot = fileURLToPath(new URL("..", import.meta.url));
  const releaseRefs = await discoverReleaseRefs({ repoRoot, additionalTags });
  const result = await validateReleaseNotes({ repoRoot, releaseRefs });
  if (githubTag !== null && result.ok) {
    const note = result.notes.find(({ tag }) => tag === githubTag);
    if (!note?.githubBody) throw new Error(`${githubTag}: GitHub 게시 구간을 찾을 수 없습니다`);
    if (output === null) process.stdout.write(note.githubBody);
    else {
      await writeFile(path.resolve(output), note.githubBody, { encoding: "utf8", flag: "w" });
      process.stdout.write(`GitHub release note: PASS (${githubTag} -> ${path.resolve(output)})\n`);
    }
  }
  else if (json) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  else if (result.ok) {
    process.stdout.write(`Release notes: PASS (${result.notes.length} versions: ${result.notes.map(({ tag }) => tag).join(", ")})\n`);
  } else {
    for (const error of result.errors) process.stderr.write(`Release notes: FAIL: ${error}\n`);
  }
  process.exitCode = result.ok ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error.stack ?? error.message}\n`);
    process.exitCode = 1;
  });
}
