#!/usr/bin/env node

import { chmod, lstat, mkdir, readFile, realpath, utimes, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { homedir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";

import { buildProduct } from "./lib/build-product.mjs";
import { collectTree } from "./lib/copy-tree.mjs";
import { hashFileEntries, sha256 } from "./lib/hash.mjs";
import { classifyInactiveReferenceIntelligenceSourcePaths, parseReferenceIntelligenceContract, referenceIntelligenceContractLayouts } from "./lib/reference-intelligence-contract.mjs";
import { auditTree } from "./lib/tree-audit.mjs";
import { packagedBinaryFiles, vendorDestinationRoots } from "./lib/vendor-components.mjs";

const PRODUCT_NAMES = Object.freeze(["game-design-career", "game-design-studio"]);
const VENDOR_LOCK_DESTINATION = "references/shared/vendor/skillstead/vendor.lock.json";
const DEPLOYMENT_TRANSFORMS = Object.freeze({
  "game-design-career": Object.freeze([
    Object.freeze({
      path: "skills/export-career-documents/scripts/prepare-career-export.mjs",
      remove: '    new URL("../../../../../../shared/scripts/validate-artifact.mjs", import.meta.url),\n',
    }),
    Object.freeze({
      path: "skills/orchestrate-game-design-career/scripts/validate-career-scenario.mjs",
      remove: '      new URL("../../../../../../shared/scripts/validate-artifact.mjs", import.meta.url),\n',
    }),
  ]),
  "game-design-studio": Object.freeze([]),
});

function isInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

async function inactiveReferenceIntelligenceSourceRuntimes(packageRoot) {
  const inactive = [];
  for (const skillId of Object.keys(referenceIntelligenceContractLayouts)) {
    const relativeSkill = `skills/${skillId}/SKILL.md`;
    const skillPath = path.join(packageRoot, relativeSkill);
    const stats = await lstat(skillPath);
    if (stats.isSymbolicLink() || !stats.isFile()) throw new Error(`${skillId} reference-intelligence skill identity mismatch`);
    const contract = parseReferenceIntelligenceContract(await readFile(skillPath, "utf8"));
    const installedCounterparts = new Set();
    for (const relativePath of Object.values(contract.layouts?.installed ?? {}).flat()) {
      const target = path.resolve(path.dirname(skillPath), relativePath);
      if (!isInside(packageRoot, target)) throw new Error(`${skillId} reference-intelligence installed contract escapes package root`);
      const targetStats = await lstat(target);
      if (targetStats.isSymbolicLink() || !targetStats.isFile()) throw new Error(`${skillId} reference-intelligence installed contract target is not a regular file`);
      installedCounterparts.add(target);
    }
    inactive.push(...classifyInactiveReferenceIntelligenceSourcePaths({ packageRoot, skillPath, contract, installedCounterparts }));
  }
  return inactive;
}

function occurrences(source, needle) {
  let count = 0;
  let offset = 0;
  while ((offset = source.indexOf(needle, offset)) !== -1) {
    count += 1;
    offset += needle.length;
  }
  return count;
}

async function normalizeFile(filePath, sourceDateEpoch) {
  await chmod(filePath, 0o644);
  const timestamp = new Date(sourceDateEpoch * 1000);
  await utimes(filePath, timestamp, timestamp);
}

async function normalizeDirectoryChain(root, directory, sourceDateEpoch) {
  const timestamp = new Date(sourceDateEpoch * 1000);
  let cursor = directory;
  while (cursor.startsWith(root)) {
    await chmod(cursor, 0o755);
    await utimes(cursor, timestamp, timestamp);
    if (cursor === root) break;
    cursor = path.dirname(cursor);
  }
}

async function applyDeploymentTransforms(outputDir, productName, sourceDateEpoch) {
  const transformed = [];
  for (const transform of DEPLOYMENT_TRANSFORMS[productName]) {
    const filePath = path.join(outputDir, ...transform.path.split("/"));
    const source = await readFile(filePath, "utf8");
    const count = occurrences(source, transform.remove);
    if (count !== 1) {
      throw new Error(`${productName}: deployment transform expected exactly one approved source fragment in ${transform.path}; found ${count}`);
    }
    await writeFile(filePath, source.replace(transform.remove, ""), { mode: 0o644 });
    await normalizeFile(filePath, sourceDateEpoch);
    transformed.push(transform.path);
  }
  return transformed;
}

async function addVendorLock({ repoRoot, outputDir, sourceDateEpoch }) {
  const source = path.join(repoRoot, "shared/vendor/skillstead/vendor.lock.json");
  const destination = path.join(outputDir, ...VENDOR_LOCK_DESTINATION.split("/"));
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, await readFile(source), { mode: 0o644 });
  await normalizeFile(destination, sourceDateEpoch);
  await normalizeDirectoryChain(outputDir, path.dirname(destination), sourceDateEpoch);
}

async function writeBuildManifest({ outputDir, productName, sourceDateEpoch }) {
  const entries = await collectTree(outputDir, { label: `staged ${productName}` });
  if (entries.some(({ relativePath }) => relativePath === "BUILD-MANIFEST.json")) {
    throw new Error(`${productName}: BUILD-MANIFEST.json must not exist before manifest generation`);
  }
  const manifest = {
    schemaVersion: 1,
    name: productName,
    sourceDateEpoch,
    treeSha256: hashFileEntries(entries),
    files: entries.map(({ relativePath, bytes }) => ({
      path: relativePath,
      sha256: sha256(bytes),
      size: bytes.length,
    })),
  };
  const manifestPath = path.join(outputDir, "BUILD-MANIFEST.json");
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o644 });
  await normalizeFile(manifestPath, sourceDateEpoch);
  await normalizeDirectoryChain(outputDir, outputDir, sourceDateEpoch);
  return manifest;
}

export async function syncShared({ repoRoot, productName, stagingRoot, stagingCapability, sourceDateEpoch = 0 }) {
  if (!PRODUCT_NAMES.includes(productName)) throw new Error(`Unsupported snapshot product: ${productName}`);
  const build = await buildProduct({ repoRoot, productName, stagingRoot, stagingCapability, sourceDateEpoch });
  const transformed = await applyDeploymentTransforms(build.outputDir, productName, sourceDateEpoch);
  await addVendorLock({ repoRoot, outputDir: build.outputDir, sourceDateEpoch });
  const manifest = await writeBuildManifest({
    outputDir: build.outputDir,
    productName,
    sourceDateEpoch,
  });
  const inactiveSourceRuntimes = await inactiveReferenceIntelligenceSourceRuntimes(build.outputDir);
  const inactiveRelativeReferenceTuples = new Set(inactiveSourceRuntimes.map(({ tuple }) => tuple));
  if (inactiveRelativeReferenceTuples.size !== 3) throw new Error("reference-intelligence inactive source tuple contract mismatch");
  const audit = await auditTree({
    root: build.outputDir,
    packageName: productName,
    siblingNames: PRODUCT_NAMES.filter((name) => name !== productName),
    forbiddenAbsolutePaths: [path.resolve(repoRoot), path.dirname(path.resolve(repoRoot)), homedir()],
    inactiveRelativeReferenceTuples,
    binaryFiles: packagedBinaryFiles({ repoRoot, productName }),
    vendorRoots: vendorDestinationRoots({ repoRoot, productName }),
  });
  if (JSON.stringify(audit.usedInactiveRelativeReferenceTuples) !== JSON.stringify([...inactiveRelativeReferenceTuples].sort())) {
    throw new Error("reference-intelligence inactive source tuple consumption mismatch");
  }
  return { ...build, files: [...manifest.files.map(({ path: file }) => file), "BUILD-MANIFEST.json"], manifest, transformed, audit };
}

function parseArguments(argv) {
  let productName;
  let stagingRoot;
  let repoRoot = fileURLToPath(new URL("..", import.meta.url));
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--product" && argv[index + 1]) productName = argv[++index];
    else if (argument === "--staging-root" && argv[index + 1]) stagingRoot = argv[++index];
    else if (argument === "--repo-root" && argv[index + 1]) repoRoot = argv[++index];
    else throw new Error(`Unknown or incomplete argument: ${argument}`);
  }
  if (!productName || !stagingRoot) throw new Error("--product and --staging-root are required");
  return { repoRoot: path.resolve(repoRoot), productName, stagingRoot: path.resolve(stagingRoot) };
}

async function main() {
  const result = await syncShared(parseArguments(process.argv.slice(2)));
  process.stdout.write(`${result.name}: ${result.files.length} files, ${result.manifest.treeSha256}\n`);
}

const entryPath = process.argv[1] ? await realpath(process.argv[1]).catch(() => undefined) : undefined;
if (entryPath && pathToFileURL(entryPath).href === import.meta.url) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
