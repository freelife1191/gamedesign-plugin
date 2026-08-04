#!/usr/bin/env node

import { lstat, mkdtemp, readFile, readdir, realpath, rename, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

import { collectTree } from "./lib/copy-tree.mjs";
import { createSnapshotStaging } from "./lib/build-product.mjs";
import { hashFileEntries } from "./lib/hash.mjs";
import { syncShared } from "./sync-shared.mjs";

const PRODUCT_NAMES = Object.freeze(["game-design-career", "game-design-studio"]);

async function compareSnapshot(expectedRoot, actualRoot, productName) {
  const [expected, actual] = await Promise.all([
    collectTree(expectedRoot, { label: `expected ${productName}` }),
    collectTree(actualRoot, { label: `committed plugins/${productName}` }).catch((error) => {
      if (/Missing source root/u.test(error.message)) throw new Error(`${productName}: committed snapshot is missing`);
      throw error;
    }),
  ]);
  const expectedPaths = expected.map(({ relativePath }) => relativePath);
  const actualPaths = actual.map(({ relativePath }) => relativePath);
  if (JSON.stringify(actualPaths) !== JSON.stringify(expectedPaths)) {
    const expectedSet = new Set(expectedPaths);
    const actualSet = new Set(actualPaths);
    const missing = expectedPaths.filter((file) => !actualSet.has(file));
    const unexpected = actualPaths.filter((file) => !expectedSet.has(file));
    throw new Error(`${productName}: snapshot file drift (missing: ${missing.join(", ") || "none"}; unexpected: ${unexpected.join(", ") || "none"})`);
  }
  for (let index = 0; index < expected.length; index += 1) {
    if (!expected[index].bytes.equals(actual[index].bytes)) {
      throw new Error(`${productName}: snapshot byte drift at ${expected[index].relativePath}`);
    }
  }
  return expected.length;
}

function explicitDestination(repoRoot, productName) {
  if (!PRODUCT_NAMES.includes(productName)) throw new Error(`Unsupported snapshot destination: ${productName}`);
  const pluginsRoot = path.join(repoRoot, "plugins");
  const destination = path.join(pluginsRoot, productName);
  if (path.dirname(destination) !== pluginsRoot) throw new Error(`Unsafe snapshot destination: ${destination}`);
  return destination;
}

async function preflightSnapshotDestinations(repoRoot) {
  const requestedRepoRoot = path.resolve(repoRoot);
  const repoStats = await lstat(requestedRepoRoot);
  if (repoStats.isSymbolicLink()) throw new Error(`Repository root is a symlink: ${requestedRepoRoot}`);
  if (!repoStats.isDirectory()) throw new Error(`Repository root is not a directory: ${requestedRepoRoot}`);
  const canonicalRepoRoot = await realpath(requestedRepoRoot);
  const pluginsRoot = path.join(canonicalRepoRoot, "plugins");
  const pluginsStats = await lstat(pluginsRoot).catch((error) => {
    if (error.code === "ENOENT") throw new Error(`Missing plugins directory: ${pluginsRoot}`);
    throw error;
  });
  if (pluginsStats.isSymbolicLink()) throw new Error(`plugins directory is a symlink: ${pluginsRoot}`);
  if (!pluginsStats.isDirectory()) throw new Error(`plugins path is not a directory: ${pluginsRoot}`);
  if (await realpath(pluginsRoot) !== pluginsRoot) throw new Error(`plugins directory does not resolve exactly inside the repository: ${pluginsRoot}`);

  const destinations = new Map();
  for (const productName of PRODUCT_NAMES) {
    const destination = explicitDestination(canonicalRepoRoot, productName);
    const stats = await lstat(destination).catch((error) => {
      if (error.code === "ENOENT") throw new Error(`Missing snapshot destination: ${destination}`);
      throw error;
    });
    if (stats.isSymbolicLink()) throw new Error(`Snapshot destination is a symlink: ${destination}`);
    if (!stats.isDirectory()) throw new Error(`Snapshot destination is not a directory: ${destination}`);
    if (await realpath(destination) !== destination) {
      throw new Error(`Snapshot destination does not resolve exactly under plugins: ${destination}`);
    }
    destinations.set(productName, destination);
  }
  return {
    repoRoot: canonicalRepoRoot,
    pluginsRoot,
    pluginsIdentity: {
      dev: pluginsStats.dev,
      ino: pluginsStats.ino,
      mode: pluginsStats.mode & 0o777,
    },
    destinations,
  };
}

async function canonicalExistingPath(candidate) {
  if (candidate === null || candidate === undefined) return null;
  const stats = await lstat(candidate).catch((error) => {
    if (error.code === "ENOENT") return undefined;
    throw error;
  });
  if (!stats) return null;
  return realpath(candidate);
}

function manualRecoveryAction(productName, product) {
  if (product.status === "untouched" || product.status === "restored") {
    return `No manual recovery required; the original ${productName} snapshot is at originalLocation.`;
  }
  if (product.status === "installed") {
    return `Verify installedSnapshotLocation for ${productName}, then remove backupLocation only after accepting the installed snapshot.`;
  }
  if (product.backupLocation && product.installedSnapshotLocation) {
    return `Remove installedSnapshotLocation for ${productName}, then restore backupLocation to the empty ${productName} plugin destination.`;
  }
  if (product.backupLocation) {
    return `Restore backupLocation to the empty ${productName} plugin destination.`;
  }
  return `Preserve every reported location for ${productName}; the original snapshot location could not be proven automatically.`;
}

async function recoveryFailure(message, state, cause) {
  const products = {};
  for (const productName of PRODUCT_NAMES) {
    const transaction = state.products.get(productName);
    const backupLocation = await canonicalExistingPath(transaction.backupLocation);
    const installedSnapshotLocation = await canonicalExistingPath(transaction.installedSnapshotLocation);
    let originalLocation = await canonicalExistingPath(transaction.originalLocation);
    if (!originalLocation && backupLocation) originalLocation = backupLocation;
    const status = originalLocation ? transaction.status : "recovery-required";
    const product = {
      status,
      originalLocation,
      backupLocation,
      installedSnapshotLocation,
    };
    products[productName] = { ...product, manualAction: manualRecoveryAction(productName, product) };
  }
  const recovery = {
    state: state.state,
    recoveryRoot: await canonicalExistingPath(state.recoveryRoot),
    stagingRoot: await canonicalExistingPath(state.stagingRoot),
    products,
    issues: state.issues,
  };
  const error = new Error(`${message}\nSNAPSHOT_RECOVERY=${JSON.stringify(recovery)}`, { cause });
  error.recovery = recovery;
  error.preserveStaging = true;
  return error;
}

async function pathExists(candidate) {
  return lstat(candidate).then(() => true, (error) => {
    if (error.code === "ENOENT") return false;
    throw error;
  });
}

function sameIdentity(stats, identity) {
  return stats.isDirectory()
    && !stats.isSymbolicLink()
    && stats.dev === identity.dev
    && stats.ino === identity.ino
    && (stats.mode & 0o777) === identity.mode;
}

async function assertAnchoredIdentity(identity) {
  const stats = await stat(".");
  if (!sameIdentity(stats, identity)) throw new Error("anchored plugins root identity changed");
}

async function assertVisibleRootIdentity(pluginsRoot, identity) {
  const stats = await lstat(pluginsRoot).catch((error) => {
    if (error.code === "ENOENT") throw new Error("visible plugins root is missing");
    throw error;
  });
  if (!sameIdentity(stats, identity) || await realpath(pluginsRoot) !== pluginsRoot) {
    throw new Error("visible plugins root identity changed");
  }
}

async function verifyProductTree(expectedEntries, productName, label) {
  const actual = await collectTree(productName, { label });
  if (hashFileEntries(actual) !== hashFileEntries(expectedEntries)) {
    throw new Error(`${productName}: ${label} differs from staged snapshot`);
  }
}

async function writeRecoveryMarker({ recoveryRoot, repoRoot, products, expectedTrees }) {
  const markerPath = path.join(recoveryRoot, "SNAPSHOT-RECOVERY.json");
  const marker = {
    schemaVersion: 1,
    state: "committed-recovery-retained",
    repoRoot,
    recoveryRoot,
    products: PRODUCT_NAMES,
    backups: Object.fromEntries(PRODUCT_NAMES.map((productName) => [productName, {
      path: path.join(recoveryRoot, productName),
      treeSha256: products.get(productName).backupTreeSha256,
      installedTreeSha256: hashFileEntries(expectedTrees.get(productName)),
    }])),
  };
  const bytes = `${JSON.stringify(marker, null, 2)}\n`;
  await writeFile(markerPath, bytes, { encoding: "utf8", flag: "wx", mode: 0o600 });
  const verified = JSON.parse(await readFile(markerPath, "utf8"));
  if (JSON.stringify(verified) !== JSON.stringify(marker)) throw new Error("recovery marker verification failed");
  return marker;
}

async function garbageCollectOldRecoveries({ currentRecoveryRoot, repoRoot, operations }) {
  const warnings = [];
  const temporaryRoot = await realpath(tmpdir());
  const entries = await readdir(temporaryRoot, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("snapshot-recovery-")) continue;
    const candidate = path.join(temporaryRoot, entry.name);
    if (candidate === currentRecoveryRoot) continue;
    let marker;
    try {
      marker = JSON.parse(await readFile(path.join(candidate, "SNAPSHOT-RECOVERY.json"), "utf8"));
    } catch {
      continue;
    }
    if (marker.schemaVersion !== 1
      || marker.state !== "committed-recovery-retained"
      || marker.repoRoot !== repoRoot
      || marker.recoveryRoot !== candidate) continue;
    try {
      await (operations.gcRm ?? rm)(candidate, { recursive: true, force: true });
    } catch (error) {
      warnings.push(`old recovery GC failure at ${candidate}: ${error.message}`);
    }
  }
  return warnings;
}

async function replaceSnapshots({ repoRoot, stagingRoot, pluginsRoot, pluginsIdentity, destinations, operations = {} }) {
  const renameEntry = operations.rename ?? rename;
  const removeEntry = operations.rm ?? rm;
  const recoveryRoot = await mkdtemp(path.join(await realpath(tmpdir()), "snapshot-recovery-"));
  const products = new Map(PRODUCT_NAMES.map((productName) => [productName, {
    status: "untouched",
    originalLocation: destinations.get(productName),
    backupLocation: null,
    installedSnapshotLocation: null,
    backupTreeSha256: null,
  }]));
  const expectedTrees = new Map();
  for (const productName of PRODUCT_NAMES) {
    expectedTrees.set(productName, await collectTree(path.join(stagingRoot, productName), { label: `staged ${productName}` }));
  }
  const previousCwd = process.cwd();
  const movedBackups = [];
  const installed = [];
  let recovery;
  try {
    try {
      process.chdir(pluginsRoot);
      await assertAnchoredIdentity(pluginsIdentity);
      await operations.beforeRootBackup?.({ pluginsRoot, recoveryRoot, stagedPluginsRoot: stagingRoot });
      await assertAnchoredIdentity(pluginsIdentity);
      await assertVisibleRootIdentity(pluginsRoot, pluginsIdentity);
      for (const productName of PRODUCT_NAMES) {
        const backup = path.join(recoveryRoot, productName);
        await renameEntry(productName, backup);
        const backupEntries = await collectTree(backup, { label: `backup ${productName}` });
        Object.assign(products.get(productName), {
          status: "backed-up",
          originalLocation: backup,
          backupLocation: backup,
          backupTreeSha256: hashFileEntries(backupEntries),
        });
        movedBackups.push({ productName, backup });
      }
      await operations.beforeRootInstall?.({ pluginsRoot, recoveryRoot, stagedPluginsRoot: stagingRoot });
      await assertAnchoredIdentity(pluginsIdentity);
      await assertVisibleRootIdentity(pluginsRoot, pluginsIdentity);
      for (const productName of PRODUCT_NAMES) {
        await renameEntry(path.join(stagingRoot, productName), productName);
        installed.push(productName);
        Object.assign(products.get(productName), {
          status: "installed",
          installedSnapshotLocation: destinations.get(productName),
        });
        await verifyProductTree(expectedTrees.get(productName), productName, `installed ${productName}`);
        await assertAnchoredIdentity(pluginsIdentity);
        await assertVisibleRootIdentity(pluginsRoot, pluginsIdentity);
      }
      const marker = await writeRecoveryMarker({ recoveryRoot, repoRoot, products, expectedTrees });
      await assertAnchoredIdentity(pluginsIdentity);
      await assertVisibleRootIdentity(pluginsRoot, pluginsIdentity);
      recovery = {
        state: marker.state,
        recoveryRoot,
        products: Object.fromEntries(PRODUCT_NAMES.map((productName) => {
          const product = {
            status: "installed",
            originalLocation: path.join(recoveryRoot, productName),
            backupLocation: path.join(recoveryRoot, productName),
            installedSnapshotLocation: destinations.get(productName),
          };
          return [productName, { ...product, manualAction: manualRecoveryAction(productName, product) }];
        })),
        warnings: [],
      };
    } catch (error) {
      const issues = [];
      for (const productName of [...installed].reverse()) {
        const failedInstall = path.join(recoveryRoot, `failed-${productName}`);
        try {
          await renameEntry(productName, failedInstall);
          const product = products.get(productName);
          product.status = "backed-up";
          product.installedSnapshotLocation = failedInstall;
        } catch (rollbackError) {
          products.get(productName).status = "recovery-required";
          issues.push(`quarantine installed ${productName}: ${rollbackError.message}`);
        }
      }
      for (const { productName, backup } of [...movedBackups].reverse()) {
        const product = products.get(productName);
        try {
          if (await pathExists(productName)) {
            product.status = "recovery-required";
            issues.push(`restore blocked because anchored leaf exists: ${productName}`);
          } else {
            await renameEntry(backup, productName);
            const anchoredRoot = await realpath(".");
            Object.assign(product, {
              status: "restored",
              originalLocation: path.join(anchoredRoot, productName),
              backupLocation: null,
              installedSnapshotLocation: null,
            });
          }
        } catch (rollbackError) {
          product.status = "recovery-required";
          issues.push(`restore ${backup} -> anchored ${productName}: ${rollbackError.message}`);
        }
      }
      if (issues.length > 0) {
        throw await recoveryFailure("Snapshot replacement failed and automatic rollback was incomplete", {
          state: "rollback-incomplete",
          recoveryRoot,
          stagingRoot,
          products,
          issues,
        }, error);
      }
      try {
        await removeEntry(recoveryRoot, { recursive: true, force: true });
      } catch (cleanupError) {
        throw await recoveryFailure("Snapshot replacement failed; originals were restored but recovery cleanup was partial", {
          state: "fully-restored-cleanup-partial",
          recoveryRoot,
          stagingRoot,
          products,
          issues: [cleanupError.message],
        }, error);
      }
      throw error;
    }
  } finally {
    process.chdir(previousCwd);
  }
  recovery.warnings = await garbageCollectOldRecoveries({ currentRecoveryRoot: recoveryRoot, repoRoot, operations });
  return recovery;
}

export async function buildSnapshots({ repoRoot, mode = "clean", sourceDateEpoch = 0, operations = {} }) {
  const preflight = await preflightSnapshotDestinations(repoRoot);
  const stagingCapability = await createSnapshotStaging({ repoRoot: preflight.repoRoot });
  const stagingRoot = stagingCapability.stagingRoot;
  let preserveStaging = false;
  try {
    const builds = [];
    for (const productName of PRODUCT_NAMES) {
      builds.push(await syncShared({
        repoRoot: preflight.repoRoot,
        productName,
        stagingRoot,
        stagingCapability,
        sourceDateEpoch,
      }));
    }
    if (mode === "check") {
      for (const productName of PRODUCT_NAMES) {
        await compareSnapshot(
          path.join(stagingRoot, productName),
          preflight.destinations.get(productName),
          productName,
        );
      }
    } else if (mode === "clean") {
      const installPreflight = await preflightSnapshotDestinations(preflight.repoRoot);
      builds.recovery = await replaceSnapshots({
        repoRoot: installPreflight.repoRoot,
        stagingRoot,
        pluginsRoot: installPreflight.pluginsRoot,
        pluginsIdentity: installPreflight.pluginsIdentity,
        destinations: installPreflight.destinations,
        operations,
      });
    } else {
      throw new Error(`Unsupported snapshot mode: ${mode}`);
    }
    return builds;
  } catch (error) {
    preserveStaging = error?.preserveStaging === true;
    throw error;
  } finally {
    if (!preserveStaging) await rm(stagingRoot, { recursive: true, force: true });
  }
}

function parseMode(argv) {
  if (argv.length === 0 || (argv.length === 1 && argv[0] === "--clean")) return "clean";
  if (argv.length === 1 && argv[0] === "--check") return "check";
  throw new Error("Usage: node tooling/build-snapshots.mjs [--clean|--check]");
}

async function main() {
  const repoRoot = fileURLToPath(new URL("..", import.meta.url));
  const mode = parseMode(process.argv.slice(2));
  const builds = await buildSnapshots({ repoRoot, mode });
  for (const build of builds) {
    process.stdout.write(`${mode} ${build.name}: ${build.files.length} files, ${build.manifest.treeSha256}\n`);
  }
  if (builds.recovery) process.stdout.write(`SNAPSHOT_RECOVERY=${JSON.stringify(builds.recovery)}\n`);
}

const entryPath = process.argv[1] ? await realpath(process.argv[1]).catch(() => undefined) : undefined;
if (entryPath && pathToFileURL(entryPath).href === import.meta.url) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
