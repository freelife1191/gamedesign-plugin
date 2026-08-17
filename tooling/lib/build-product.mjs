import { chmod, lstat, mkdir, mkdtemp, readFile, readdir, realpath, utimes, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import path from "node:path";

import { collectTree } from "./copy-tree.mjs";
import { hashFileEntries } from "./hash.mjs";
import { assertNoSymlinkPath, comparePaths, joinWithin, normalizeRelativePath } from "./paths.mjs";
import { loadProductContract } from "./product-contract.mjs";
import { vendorMappings } from "./vendor-components.mjs";

const staticSharedMappings = {
  knowledge: [["shared/knowledge", "references/shared/knowledge"]],
  templates: [["shared/templates", "assets/shared/templates"]],
  "responsible-design": [["shared/responsible-design", "references/shared/responsible-design"]],
  export: [["shared/export", "references/shared/export"]],
  "document-quality": [["shared/document-quality", "references/shared/document-quality"]],
  "image-assets": [["shared/image-assets", "references/shared/image-assets"]],
  memory: [
    ["shared/memory/skills", "skills"],
    ["shared/memory/schema", "references/shared/memory/schema"],
    ["shared/memory/references", "references/shared/memory/references"],
    ["shared/memory/templates", "references/shared/memory/templates"],
  ],
  "reference-intelligence": [
    ["shared/reference-intelligence/skills", "skills"],
    ["shared/reference-intelligence/schema", "references/shared/reference-intelligence/schema"],
    ["shared/reference-intelligence/catalog", "references/shared/reference-intelligence/catalog"],
    ["shared/reference-intelligence/references", "references/shared/reference-intelligence/references"],
    ["shared/reference-intelligence/templates", "references/shared/reference-intelligence/templates"],
  ],
  updates: [["shared/updates", "references/shared/updates"]],
  // The upgrade skill lives outside shared/updates on purpose. That directory is copied whole into
  // references/shared/updates, so a skills subdirectory there would also ship as a duplicate tree.
  "suite-update-skill": [["shared/suite-update/skills", "skills"]],
};
const sharedSuiteUpdateInventory = Object.freeze({
  "shared/suite-update/skills": Object.freeze([
    "upgrade-game-design-suite/SKILL.md",
    "upgrade-game-design-suite/references/codex-commands.md",
  ]),
});
const sharedMemoryInventory = Object.freeze({
  "shared/memory/skills": Object.freeze([
    "capture-game-design-memory/SKILL.md",
    "maintain-game-design-memory/SKILL.md",
    "retrieve-approved-design-memory/SKILL.md",
  ]),
  "shared/memory/schema": Object.freeze([
    "memory-config.schema.json",
    "memory-event.schema.json",
    "memory-index.schema.json",
    "memory-receipt.schema.json",
    "memory-record.schema.json",
  ]),
  "shared/memory/references": Object.freeze([
    "memory-lifecycle.md",
    "memory-policy.md",
  ]),
  "shared/memory/templates": Object.freeze([
    "index.md",
    "log.md",
    "memory-record.md",
  ]),
});
const sharedReferenceIntelligenceInventory = Object.freeze({
  "shared/reference-intelligence/skills": Object.freeze([
    "analyze-game-design-references/SKILL.md",
    "analyze-game-design-references/agents/openai.yaml",
    "maintain-game-design-glossary/SKILL.md",
    "maintain-game-design-glossary/agents/openai.yaml",
  ]),
  "shared/reference-intelligence/schema": Object.freeze([
    "game-design-glossary.schema.json",
    "glossary-receipt.schema.json",
    "reference-analysis.schema.json",
  ]),
  "shared/reference-intelligence/catalog": Object.freeze([
    "overlays/business-model.json",
    "overlays/genre.json",
    "overlays/platform.json",
    "overlays/play-mode.json",
    "source-register.json",
    "system-atlas.json",
  ]),
  "shared/reference-intelligence/references": Object.freeze([
    "evidence-policy.md",
    "reference-analysis-flow.md",
  ]),
  "shared/reference-intelligence/templates": Object.freeze([
    "analysis-priority.md",
    "atlas-selection.json",
    "brief.json",
    "brief.md",
    "comparison-matrix.md",
    "evidence-register.yml",
    "reference-set.yml",
    "system-inventory.json",
    "transfer-decisions.md",
    "verification-queue.md",
  ]),
});
const sourceOnlySkillsteadFallbacks = Object.freeze({
  "game-design-career": Object.freeze({
    path: "skills/visualize-career-roadmap/scripts/run-skillstead.mjs",
  }),
  "game-design-studio": Object.freeze({
    path: "skills/visualize-game-design/scripts/run-skillstead.mjs",
  }),
});
const packageLinkProjections = Object.freeze({
  "game-design-career": Object.freeze([
    Object.freeze({
      path: /^README\.md$/u,
      source: "../../../shared/reference-intelligence/skills/analyze-game-design-references/SKILL.md",
      package: "skills/analyze-game-design-references/SKILL.md",
    }),
    Object.freeze({
      path: /^README\.md$/u,
      source: "../../../shared/reference-intelligence/skills/maintain-game-design-glossary/SKILL.md",
      package: "skills/maintain-game-design-glossary/SKILL.md",
    }),
  ]),
  "game-design-studio": Object.freeze([
    Object.freeze({
      path: /^README\.md$/u,
      source: "../../../shared/reference-intelligence/skills/analyze-game-design-references/SKILL.md",
      package: "skills/analyze-game-design-references/SKILL.md",
    }),
    Object.freeze({
      path: /^README\.md$/u,
      source: "../../../shared/reference-intelligence/skills/maintain-game-design-glossary/SKILL.md",
      package: "skills/maintain-game-design-glossary/SKILL.md",
    }),
    Object.freeze({
      path: /^skills\/[^/]+\/SKILL\.md$/u,
      source: "../../../../../shared/responsible-design/gates.json",
      package: "../../references/shared/responsible-design/gates.json",
    }),
    Object.freeze({
      path: /^references\/methods\/[^/]+\.md$/u,
      source: "../../../../../shared/responsible-design/gates.json",
      package: "../shared/responsible-design/gates.json",
    }),
    Object.freeze({
      path: /^references\/methods\/[^/]+\.md$/u,
      source: "../../../../../shared/knowledge/trends/2026-current-practices.md",
      package: "../shared/knowledge/trends/2026-current-practices.md",
    }),
    Object.freeze({
      path: /^references\/methods\/[^/]+\.md$/u,
      source: "../../../../../shared/knowledge/trends/source-register.json",
      package: "../shared/knowledge/trends/source-register.json",
    }),
    Object.freeze({
      path: /^skills\/review-game-design\/SKILL\.md$/u,
      source: "../../../../../shared/templates/review-finding.md",
      package: "../../assets/shared/templates/review-finding.md",
    }),
  ]),
});
const snapshotStagingCapabilities = new WeakSet();

function isInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

async function assertPathComponentsAreDirectoriesWithoutSymlinks(base, candidate, label) {
  const relative = path.relative(base, candidate);
  if (relative === "" || relative.startsWith(`..${path.sep}`) || relative === ".." || path.isAbsolute(relative)) {
    throw new Error(`${label} is outside its approved root: ${candidate}`);
  }
  let cursor = base;
  for (const segment of relative.split(path.sep)) {
    cursor = path.join(cursor, segment);
    const stats = await lstat(cursor).catch((error) => {
      if (error.code === "ENOENT") return undefined;
      throw error;
    });
    if (!stats) break;
    if (stats.isSymbolicLink()) throw new Error(`${label} contains a symlink ancestor: ${cursor}`);
    if (!stats.isDirectory()) throw new Error(`${label} ancestor is not a directory: ${cursor}`);
  }
}

async function canonicalTemporaryRoot() {
  return realpath(tmpdir());
}

async function temporaryRootCandidates() {
  const requested = [...new Set([path.resolve(tmpdir()), path.resolve(path.parse(tmpdir()).root, "tmp")])];
  return Promise.all(requested.map(async (root) => ({ requested: root, canonical: await realpath(root) })));
}

async function canonicalizeProspectivePath(candidate) {
  const suffix = [];
  let cursor = candidate;
  while (true) {
    const stats = await lstat(cursor).catch((error) => {
      if (error.code === "ENOENT") return undefined;
      throw error;
    });
    if (stats) return path.join(await realpath(cursor), ...suffix.reverse());
    const parent = path.dirname(cursor);
    if (parent === cursor) throw new Error(`Cannot resolve an existing ancestor for ${candidate}`);
    suffix.push(path.basename(cursor));
    cursor = parent;
  }
}

async function assertExistingAncestorsHaveNoSymlinks(candidate, label) {
  let cursor = candidate;
  while (true) {
    const stats = await lstat(cursor).catch((error) => {
      if (error.code === "ENOENT") return undefined;
      throw error;
    });
    if (stats?.isSymbolicLink()) throw new Error(`${label} contains a symlink ancestor: ${cursor}`);
    const parent = path.dirname(cursor);
    if (parent === cursor) return;
    cursor = parent;
  }
}

export async function createSnapshotStaging({ repoRoot }) {
  const absoluteRepoRoot = path.resolve(repoRoot);
  const canonicalRepoRoot = await realpath(absoluteRepoRoot);
  const temporaryRoot = await canonicalTemporaryRoot();
  const stagingRoot = await mkdtemp(path.join(temporaryRoot, "snapshot-build-"));
  const capability = Object.freeze({ repoRoot: canonicalRepoRoot, stagingRoot });
  snapshotStagingCapabilities.add(capability);
  return capability;
}

async function prepareOutputDestination({ repoRoot, productName, stagingRoot, stagingCapability }) {
  const canonicalRepoRoot = await realpath(repoRoot);
  let absoluteStagingRoot;
  if (stagingCapability !== undefined) {
    if (!snapshotStagingCapabilities.has(stagingCapability)) throw new Error("Invalid snapshot staging capability");
    if (stagingCapability.repoRoot !== canonicalRepoRoot) throw new Error("Snapshot staging capability belongs to another repository");
    if (stagingRoot !== undefined && path.resolve(stagingRoot) !== stagingCapability.stagingRoot) {
      throw new Error("stagingRoot does not match the snapshot staging capability");
    }
    absoluteStagingRoot = stagingCapability.stagingRoot;
  } else {
    if (typeof stagingRoot !== "string") throw new Error("stagingRoot must be a path");
    absoluteStagingRoot = path.resolve(stagingRoot);
  }

  const requestedCandidate = path.resolve(absoluteStagingRoot);
  const temporaryRoots = stagingCapability === undefined
    ? await temporaryRootCandidates()
    : [{ requested: await canonicalTemporaryRoot(), canonical: await canonicalTemporaryRoot() }];
  const temporaryRoot = temporaryRoots.find(({ requested }) => isInside(requested, requestedCandidate) && requestedCandidate !== requested);
  if (temporaryRoot) {
    await assertPathComponentsAreDirectoriesWithoutSymlinks(temporaryRoot.requested, requestedCandidate, "staging root");
  } else {
    if (stagingCapability !== undefined) throw new Error(`Snapshot staging capability escaped the OS temporary root: ${absoluteStagingRoot}`);
    if (requestedCandidate === path.parse(requestedCandidate).root) throw new Error("Filesystem root cannot be a staging root");
    await assertExistingAncestorsHaveNoSymlinks(requestedCandidate, "staging root");
  }
  const canonicalCandidate = await canonicalizeProspectivePath(requestedCandidate);
  if (temporaryRoot && (!isInside(temporaryRoot.canonical, canonicalCandidate) || canonicalCandidate === temporaryRoot.canonical)) {
    throw new Error(`Staging root escapes the canonical OS temporary root: ${absoluteStagingRoot}`);
  }
  const canonicalHome = await realpath(homedir());
  if (isInside(canonicalHome, canonicalCandidate) || isInside(canonicalCandidate, canonicalHome)) {
    throw new Error(`Staging root must not be the home directory or overlap it: ${absoluteStagingRoot}`);
  }
  if (isInside(canonicalRepoRoot, canonicalCandidate) || isInside(canonicalCandidate, canonicalRepoRoot)) {
    throw new Error(`Staging root overlaps repository sources: ${absoluteStagingRoot}`);
  }

  const stagingStats = await lstat(canonicalCandidate).catch((error) => {
    if (error.code === "ENOENT") return undefined;
    throw error;
  });
  if (stagingStats?.isSymbolicLink()) throw new Error(`Staging root is a symlink: ${canonicalCandidate}`);
  if (stagingStats && !stagingStats.isDirectory()) throw new Error(`Staging root is not a directory: ${canonicalCandidate}`);

  const outputDir = path.join(canonicalCandidate, productName);
  if (path.dirname(outputDir) !== canonicalCandidate || path.basename(outputDir) !== productName) {
    throw new Error(`Unsafe product destination: ${outputDir}`);
  }
  const outputStats = await lstat(outputDir).catch((error) => {
    if (error.code === "ENOENT") return undefined;
    throw error;
  });
  if (outputStats?.isSymbolicLink()) throw new Error(`Product destination is a symlink: ${outputDir}`);
  if (outputStats && !outputStats.isDirectory()) throw new Error(`Product destination is not a directory: ${outputDir}`);
  if (outputStats && (await readdir(outputDir)).length !== 0) {
    throw new Error(`Product destination must be absent or empty: ${outputDir}`);
  }

  return outputDir;
}

function indexDocuments(index) {
  if (Array.isArray(index.documents)) return index.documents;
  throw new Error("Reference index must contain a documents array");
}

async function assertRegularFileWithoutSymlink(root, relativePath, label) {
  let current = path.resolve(root);
  for (const segment of relativePath.split("/")) {
    current = path.join(current, segment);
    const stats = await lstat(current).catch((error) => {
      if (error.code === "ENOENT") throw new Error(`Missing indexed source document: ${relativePath}`);
      throw error;
    });
    if (stats.isSymbolicLink()) throw new Error(`Symlink is not allowed in ${label}: ${relativePath}`);
  }
  const stats = await lstat(current);
  if (!stats.isFile()) throw new Error(`Indexed source document is not a file: ${relativePath}`);
  return current;
}

async function resolveSourceDocuments(repoRoot, product) {
  const selectsDocuments = product.sourceDocuments !== undefined;
  const selectors = selectsDocuments ? product.sourceDocuments : product.sourceDocumentCategories;
  if (selectors.length === 0) return [];

  const indexPath = path.join(repoRoot, "shared/knowledge/reference-index.json");
  await assertNoSymlinkPath(repoRoot, "shared/knowledge/reference-index.json", "reference index");
  const indexStats = await lstat(indexPath).catch((error) => {
    if (error.code === "ENOENT") throw new Error("Missing reference index: shared/knowledge/reference-index.json");
    throw error;
  });
  if (indexStats.isSymbolicLink()) throw new Error("Symlink is not allowed: shared/knowledge/reference-index.json");
  const documents = indexDocuments(JSON.parse(await readFile(indexPath, "utf8")));
  const selected = [];

  for (const selector of selectors) {
    const matches = documents.filter((document) => document?.[selectsDocuments ? "id" : "category"] === selector);
    if (matches.length === 0) {
      throw new Error(`${selectsDocuments ? "Missing source ID" : "Missing source category"}: ${selector}`);
    }
    if (selectsDocuments && matches.length > 1) throw new Error(`Ambiguous source ID: ${selector}`);
    selected.push(...matches);
  }

  const seenPaths = new Set();
  const entries = [];
  for (const document of selected) {
    const sourcePath = normalizeRelativePath(document.sourcePath, "reference index sourcePath");
    if (sourcePath !== "docs" && !sourcePath.startsWith("docs/")) {
      throw new Error(`Unsafe path outside docs in reference index: ${document.sourcePath}`);
    }
    if (seenPaths.has(sourcePath)) throw new Error(`Duplicate normalized path in selected source documents: ${sourcePath}`);
    seenPaths.add(sourcePath);
    const sourceFile = await assertRegularFileWithoutSymlink(repoRoot, sourcePath, "indexed source documents");
    entries.push({
      bytes: await readFile(sourceFile),
      relativePath: `references/source/${sourcePath}`,
      sourcePath: sourceFile,
    });
  }
  return entries.sort((left, right) => comparePaths(left.relativePath, right.relativePath));
}

function addEntry(targets, entry, destinationPrefix, sourceLabel) {
  const relativePath = normalizeRelativePath(
    destinationPrefix ? `${destinationPrefix}/${entry.relativePath}` : entry.relativePath,
    "package destination",
  );
  const existing = targets.get(relativePath);
  if (existing) {
    if (isReferenceIntelligenceDestination(relativePath)) {
      throw new Error(`Reference-intelligence destination collision at ${relativePath} between ${existing.sourceLabel} and ${sourceLabel}`);
    }
    if (!existing.bytes.equals(entry.bytes)) {
      throw new Error(`Content collision at ${relativePath} between ${existing.sourceLabel} and ${sourceLabel}`);
    }
    return;
  }
  targets.set(relativePath, { bytes: entry.bytes, relativePath, sourceLabel });
}

function isReferenceIntelligenceDestination(relativePath) {
  return relativePath.startsWith("skills/analyze-game-design-references/")
    || relativePath.startsWith("skills/maintain-game-design-glossary/")
    || relativePath.startsWith("references/shared/reference-intelligence/");
}

function removeSourceOnlySkillsteadFallback(entry, productName, skillsteadSourceRoot) {
  const fallback = sourceOnlySkillsteadFallbacks[productName];
  if (!fallback || entry.relativePath !== fallback.path) return entry;
  const sourceFallback = `    path.resolve(path.dirname(ownPath), "../../../../../../${skillsteadSourceRoot}"),\n`;
  const source = entry.bytes.toString("utf8");
  const count = source.split(sourceFallback).length - 1;
  if (count !== 1) throw new Error(`Expected one source-only Skillstead fallback in ${fallback.path}; found ${count}`);
  return { ...entry, bytes: Buffer.from(source.replace(sourceFallback, "")) };
}

function projectPackageLocalLinks(entry, productName) {
  const projections = packageLinkProjections[productName];
  if (!projections) return entry;

  let source = entry.bytes.toString("utf8");
  for (const projection of projections) {
    if (!projection.path.test(entry.relativePath)) continue;
    source = source.replaceAll(`](${projection.source})`, `](${projection.package})`);
  }
  return { ...entry, bytes: Buffer.from(source) };
}

function isRealEnvironmentFile(relativePath) {
  const name = path.posix.basename(relativePath);
  return name === ".env" || (name.startsWith(".env.") && name !== ".env.example");
}

function assertNoRealEnvironmentFiles(entries, sourceLabel) {
  if (entries.some(({ relativePath }) => isRealEnvironmentFile(relativePath))) {
    throw new Error(`Real .env or secret environment variant is not allowed in ${sourceLabel}`);
  }
}

function assertExactSharedMemoryInventory(sourceRelative, entries) {
  const expected = sharedMemoryInventory[sourceRelative];
  if (!expected) throw new Error(`Unknown shared memory package root: ${sourceRelative}`);
  const actual = entries.map(({ relativePath }) => relativePath).sort(comparePaths);
  if (actual.length !== expected.length || actual.some((relativePath, index) => relativePath !== expected[index])) {
    throw new Error(`Unexpected shared memory package file in ${sourceRelative}`);
  }
}

function assertExactSharedSuiteUpdateInventory(sourceRelative, entries) {
  const expected = sharedSuiteUpdateInventory[sourceRelative];
  if (!expected) throw new Error(`Unknown shared suite-update package root: ${sourceRelative}`);
  const actual = entries.map(({ relativePath }) => relativePath).sort(comparePaths);
  if (actual.length !== expected.length || actual.some((relativePath, index) => relativePath !== expected[index])) {
    throw new Error(`Unexpected shared suite-update package file in ${sourceRelative}`);
  }
}

function assertExactSharedReferenceIntelligenceInventory(sourceRelative, entries) {
  const expected = sharedReferenceIntelligenceInventory[sourceRelative];
  if (!expected) throw new Error(`Unknown shared reference-intelligence package root: ${sourceRelative}`);
  const actual = entries.map(({ relativePath }) => relativePath).sort(comparePaths);
  if (actual.length !== expected.length || actual.some((relativePath, index) => relativePath !== expected[index])) {
    throw new Error(`Unexpected shared reference-intelligence package file in ${sourceRelative}`);
  }
}

function rejectFileDirectoryCollisions(entries) {
  const files = new Set(entries.map(({ relativePath }) => relativePath));
  for (const { relativePath } of entries) {
    const segments = relativePath.split("/");
    for (let index = 1; index < segments.length; index += 1) {
      const ancestor = segments.slice(0, index).join("/");
      if (files.has(ancestor)) throw new Error(`Content collision between file and directory at ${ancestor}`);
    }
  }
}

async function normalizeOutputMetadata(outputDir, entries, sourceDateEpoch) {
  const timestamp = new Date(sourceDateEpoch * 1000);
  const directories = new Set([outputDir]);
  for (const { relativePath } of entries) {
    const destination = path.join(outputDir, ...relativePath.split("/"));
    await chmod(destination, 0o644);
    await utimes(destination, timestamp, timestamp);
    let directory = path.dirname(destination);
    while (directory.startsWith(outputDir)) {
      directories.add(directory);
      if (directory === outputDir) break;
      directory = path.dirname(directory);
    }
  }
  for (const directory of [...directories].sort((left, right) => right.length - left.length || comparePaths(left, right))) {
    await chmod(directory, 0o755);
    await utimes(directory, timestamp, timestamp);
  }
}

export async function buildProduct({ repoRoot, productName, stagingRoot, stagingCapability, sourceDateEpoch = 0 }) {
  if (typeof repoRoot !== "string") {
    throw new Error("repoRoot must be a path");
  }
  if (!Number.isInteger(sourceDateEpoch) || sourceDateEpoch < 0) {
    throw new Error("sourceDateEpoch must be a non-negative integer");
  }

  const absoluteRepoRoot = path.resolve(repoRoot);
  const outputDir = await prepareOutputDestination({
    repoRoot: absoluteRepoRoot,
    productName,
    stagingRoot,
    stagingCapability,
  });
  const product = await loadProductContract({ repoRoot: absoluteRepoRoot, productName });
  const productRoot = path.join(absoluteRepoRoot, "products", productName);
  const sharedMappings = { ...staticSharedMappings, ...vendorMappings({ repoRoot: absoluteRepoRoot }) };
  const targets = new Map();

  for (const moduleName of product.sharedModules) {
    const moduleEntries = [];
    for (const [sourceRelative, destinationPrefix] of sharedMappings[moduleName]) {
      await assertNoSymlinkPath(absoluteRepoRoot, sourceRelative, "shared module");
      const entries = await collectTree(joinWithin(absoluteRepoRoot, sourceRelative), { label: sourceRelative });
      assertNoRealEnvironmentFiles(entries, sourceRelative);
      if (moduleName === "memory") assertExactSharedMemoryInventory(sourceRelative, entries);
      if (moduleName === "reference-intelligence") assertExactSharedReferenceIntelligenceInventory(sourceRelative, entries);
      if (moduleName === "suite-update-skill") assertExactSharedSuiteUpdateInventory(sourceRelative, entries);
      moduleEntries.push(...entries);
      for (const entry of entries) addEntry(targets, entry, destinationPrefix, `shared:${moduleName}`);
    }
    if (moduleName === "image-assets") {
      const example = moduleEntries.find(({ relativePath }) => relativePath === ".env.example");
      if (!example) throw new Error("Missing shared/image-assets/.env.example");
      addEntry(targets, example, "", "shared:image-assets-root-example");
    }
    if (moduleName === "im-not-ai") {
      const license = await readFile(path.join(absoluteRepoRoot, "shared/vendor/im-not-ai/LICENSE"));
      addEntry(targets, { relativePath: "LICENSE", bytes: license }, "third-party/im-not-ai", "shared:im-not-ai-license");
    }
    if (moduleName === "archify") {
      const lock = await readFile(path.join(absoluteRepoRoot, "shared/vendor/archify/vendor.lock.json"));
      addEntry(
        targets,
        { relativePath: "vendor.lock.json", bytes: lock },
        "references/shared/vendor/archify",
        "shared:archify-lock",
      );
    }
  }

  for (const [sourceRelative, destinationPrefix] of [["shared/hooks", "hooks"], ["shared/scripts", "scripts"]]) {
    await assertNoSymlinkPath(absoluteRepoRoot, sourceRelative, "shared runtime");
    const entries = await collectTree(joinWithin(absoluteRepoRoot, sourceRelative), { label: sourceRelative });
    assertNoRealEnvironmentFiles(entries, sourceRelative);
    for (const entry of entries) addEntry(targets, entry, destinationPrefix, "shared:runtime");
  }

  for (const entry of await resolveSourceDocuments(absoluteRepoRoot, product)) {
    addEntry(targets, { ...entry, relativePath: entry.relativePath }, "", "shared:source-documents");
  }

  for (const sourceRoot of product.sourceRoots) {
    await assertNoSymlinkPath(absoluteRepoRoot, `products/${productName}/${sourceRoot}`, "source root");
    const sourceDirectory = joinWithin(productRoot, sourceRoot, "product source root");
    const entries = await collectTree(sourceDirectory, { label: `products/${productName}/${sourceRoot}` });
    assertNoRealEnvironmentFiles(entries, `products/${productName}/${sourceRoot}`);
    for (const entry of entries) {
      addEntry(
        targets,
        projectPackageLocalLinks(removeSourceOnlySkillsteadFallback(entry, productName, sharedMappings.vendor[0][0]), productName),
        "",
        `product:${sourceRoot}`,
      );
    }
  }

  const entries = [...targets.values()].sort((left, right) => comparePaths(left.relativePath, right.relativePath));
  rejectFileDirectoryCollisions(entries);

  await mkdir(outputDir, { recursive: true });
  for (const entry of entries) {
    const destination = path.join(outputDir, ...entry.relativePath.split("/"));
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, entry.bytes, { mode: 0o644 });
  }
  await normalizeOutputMetadata(outputDir, entries, sourceDateEpoch);

  return {
    name: product.name,
    outputDir,
    files: entries.map(({ relativePath }) => relativePath),
    sha256: hashFileEntries(entries),
    sources: ["shared", "product"],
  };
}
