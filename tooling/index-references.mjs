#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const INDEX_PATH = "shared/knowledge/reference-index.json";

const CATEGORY_BY_SOURCE_ROOT = new Map([
  ["docs/01. 게임 기획자 취업 튜토리얼", "career"],
  ["docs/유리링의 게임 기획 이야기", "career"],
  ["docs/02. 게임의 재미와 기획 의도", "fun-intent"],
  ["docs/03. 게임 시스템 기획", "systems"],
  ["docs/04. 게임 콘텐츠 기획", "content"],
  ["docs/기획서 피드백", "feedback"],
]);

const CLAIM_TYPES_BY_CATEGORY = {
  career: ["evergreen", "contextual", "time-sensitive"],
  "fun-intent": ["evergreen", "contextual"],
  systems: ["evergreen", "contextual"],
  content: ["evergreen", "contextual"],
  feedback: ["evergreen", "contextual"],
};

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function categoryFor(sourcePath) {
  for (const [sourceRoot, category] of CATEGORY_BY_SOURCE_ROOT) {
    if (sourcePath.startsWith(`${sourceRoot}/`)) return category;
  }
  throw new Error(`No explicit category mapping for ${sourcePath}`);
}

function titleFor(sourcePath) {
  return path.posix.basename(sourcePath, ".md").replace(/^\d+\.\s*/, "").trim().normalize("NFC");
}

function wordCount(contents) {
  const trimmed = contents.trim();
  return trimmed === "" ? 0 : trimmed.split(/\s+/u).length;
}

export function rejectDuplicateNormalizedPaths(rawPaths) {
  const normalizedPaths = new Map();
  for (const rawPath of rawPaths) {
    const sourcePath = rawPath.normalize("NFC");
    const existing = normalizedPaths.get(sourcePath);
    if (existing) throw new Error(`Duplicate normalized path: ${existing} and ${rawPath}`);
    normalizedPaths.set(sourcePath, rawPath);
  }
}

async function walkDirectory(currentDirectory, readDirectory, files) {
  const entries = await readDirectory(currentDirectory, { withFileTypes: true });
  entries.sort((left, right) => compareStrings(left.name, right.name));
  for (const entry of entries) {
    const absolutePath = path.join(currentDirectory, entry.name);
    if (entry.isDirectory()) {
      await walkDirectory(absolutePath, readDirectory, files);
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(absolutePath);
    }
  }
}

export async function discoverSourceFiles({ repoRoot, readDirectory = readdir }) {
  const docsRoot = path.join(repoRoot, "docs");
  const absolutePaths = [];
  await walkDirectory(docsRoot, readDirectory, absolutePaths);
  const files = [];
  const rawPaths = [];

  for (const absolutePath of absolutePaths) {
    const rawPath = path.relative(repoRoot, absolutePath).split(path.sep).join("/");
    const sourcePath = rawPath.normalize("NFC");
    if (sourcePath.startsWith("docs/superpowers/")) continue;
    rawPaths.push(rawPath);
    files.push({ absolutePath, sourcePath });
  }

  rejectDuplicateNormalizedPaths(rawPaths);

  return files.sort((left, right) => compareStrings(left.sourcePath, right.sourcePath));
}

export async function buildReferenceIndex({ repoRoot }) {
  const files = await discoverSourceFiles({ repoRoot });
  const titles = new Map();
  const documents = [];

  for (const { absolutePath, sourcePath } of files) {
    const bytes = await readFile(absolutePath);
    const contents = bytes.toString("utf8");
    const category = categoryFor(sourcePath);
    const title = titleFor(sourcePath);
    const existingTitle = titles.get(title);
    if (existingTitle) throw new Error(`Duplicate title "${title}": ${existingTitle} and ${sourcePath}`);
    titles.set(title, sourcePath);
    documents.push({
      id: `${category}-${sha256(sourcePath).slice(0, 12)}`,
      sourcePath,
      title,
      category,
      sha256: sha256(bytes),
      wordCount: wordCount(contents),
      claimTypes: [...CLAIM_TYPES_BY_CATEGORY[category]],
      derivedCore: [],
    });
  }

  return { documents };
}

export function serializeReferenceIndex(index) {
  return `${JSON.stringify(index, null, 2)}\n`;
}

export async function writeReferenceIndex({ repoRoot }) {
  const index = await buildReferenceIndex({ repoRoot });
  const destination = path.join(repoRoot, INDEX_PATH);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, serializeReferenceIndex(index));
  return { indexed: index.documents.length, missing: 0, duplicatePaths: 0 };
}

export async function checkReferenceIndex({ repoRoot }) {
  const expected = serializeReferenceIndex(await buildReferenceIndex({ repoRoot }));
  const actual = await readFile(path.join(repoRoot, INDEX_PATH), "utf8").catch((error) => {
    if (error.code === "ENOENT") throw new Error(`Reference index drift: missing ${INDEX_PATH}`);
    throw error;
  });
  if (actual !== expected) throw new Error("Reference index drift: run node tooling/index-references.mjs --write");
  return { indexed: JSON.parse(expected).documents.length, missing: 0, duplicatePaths: 0 };
}

function formatResult({ indexed, missing, duplicatePaths }) {
  return `${indexed} indexed, ${missing} missing, ${duplicatePaths} duplicate paths`;
}

async function main() {
  const mode = process.argv[2];
  if (mode !== "--write" && mode !== "--check") {
    throw new Error("Usage: node tooling/index-references.mjs --write|--check");
  }
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const result = mode === "--write"
    ? await writeReferenceIndex({ repoRoot })
    : await checkReferenceIndex({ repoRoot });
  console.log(formatResult(result));
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
