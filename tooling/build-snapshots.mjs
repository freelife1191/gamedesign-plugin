#!/usr/bin/env node

import { chmod, lstat, mkdir, mkdtemp, readFile, readdir, realpath, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

import { collectTree } from "./lib/copy-tree.mjs";
import { createSnapshotStaging } from "./lib/build-product.mjs";
import { sha256 } from "./lib/hash.mjs";
import { comparePaths, normalizeRelativePath } from "./lib/paths.mjs";
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
  return { repoRoot: canonicalRepoRoot, pluginsRoot, destinations };
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

async function inventoryPluginsRoot(root, label) {
  const rootStats = await lstat(root);
  if (rootStats.isSymbolicLink()) throw new Error(`${label} is a symlink`);
  if (!rootStats.isDirectory()) throw new Error(`${label} is not a directory`);
  const entries = [];

  async function visit(directory, prefix = "") {
    const children = await readdir(directory, { withFileTypes: true });
    children.sort((left, right) => comparePaths(left.name.normalize("NFC"), right.name.normalize("NFC")));
    for (const child of children) {
      const rawRelativePath = prefix ? `${prefix}/${child.name}` : child.name;
      const relativePath = normalizeRelativePath(rawRelativePath, label);
      const childPath = path.join(directory, child.name);
      const stats = await lstat(childPath);
      if (stats.isSymbolicLink()) throw new Error(`${label} contains symlink ${relativePath}`);
      const mode = stats.mode & 0o777;
      if (stats.isDirectory()) {
        entries.push({ kind: "directory", mode, path: relativePath });
        await visit(childPath, rawRelativePath);
      } else if (stats.isFile()) {
        const bytes = await readFile(childPath);
        entries.push({ kind: "file", mode, path: relativePath, sha256: sha256(bytes), size: bytes.length });
      } else {
        throw new Error(`${label} contains unsupported filesystem entry ${relativePath}`);
      }
    }
  }

  await visit(root);
  return entries;
}

async function copyPreservedEntry(source, destination, label) {
  const stats = await lstat(source);
  if (stats.isSymbolicLink()) throw new Error(`${label} is a symlink; non-target plugin entries must be regular files or directories`);
  const mode = stats.mode & 0o777;
  if (stats.isDirectory()) {
    await mkdir(destination, { mode });
    const children = await readdir(source, { withFileTypes: true });
    children.sort((left, right) => comparePaths(left.name.normalize("NFC"), right.name.normalize("NFC")));
    for (const child of children) {
      await copyPreservedEntry(path.join(source, child.name), path.join(destination, child.name), `${label}/${child.name}`);
    }
    await chmod(destination, mode);
    return;
  }
  if (!stats.isFile()) throw new Error(`${label} is an unsupported filesystem entry`);
  await writeFile(destination, await readFile(source), { mode });
  await chmod(destination, mode);
}

async function createCompletePluginsRoot({ stagingRoot, pluginsRoot, renameEntry }) {
  const completeRoot = path.join(stagingRoot, ".complete-plugins-root");
  await mkdir(completeRoot);
  const entries = await readdir(pluginsRoot, { withFileTypes: true });
  entries.sort((left, right) => comparePaths(left.name.normalize("NFC"), right.name.normalize("NFC")));
  for (const entry of entries) {
    if (PRODUCT_NAMES.includes(entry.name)) continue;
    await copyPreservedEntry(
      path.join(pluginsRoot, entry.name),
      path.join(completeRoot, entry.name),
      `plugins/${entry.name}`,
    );
  }
  for (const productName of PRODUCT_NAMES) {
    await renameEntry(path.join(stagingRoot, productName), path.join(completeRoot, productName));
  }
  return completeRoot;
}

function inventoriesMatch(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

async function replaceSnapshots({ stagingRoot, pluginsRoot, destinations, operations = {} }) {
  const renameEntry = operations.rename ?? rename;
  const removeEntry = operations.rm ?? rm;
  const recoveryRoot = await mkdtemp(path.join(await realpath(tmpdir()), "snapshot-recovery-"));
  const backupRoot = path.join(recoveryRoot, "plugins");
  const failedInstallRoot = path.join(recoveryRoot, "failed-install");
  const unexpectedRootEntry = path.join(recoveryRoot, "unexpected-plugins-entry");
  const products = new Map(PRODUCT_NAMES.map((productName) => [productName, {
    status: "untouched",
    originalLocation: destinations.get(productName),
    backupLocation: null,
    installedSnapshotLocation: null,
  }]));
  let completeRoot;
  let backupMoved = false;
  let installed = false;
  try {
    const inventoryBeforeCopy = await inventoryPluginsRoot(pluginsRoot, "plugins root before staging");
    completeRoot = await createCompletePluginsRoot({ stagingRoot, pluginsRoot, renameEntry });
    const inventoryAfterCopy = await inventoryPluginsRoot(pluginsRoot, "plugins root after staging");
    if (!inventoriesMatch(inventoryBeforeCopy, inventoryAfterCopy)) {
      throw new Error("plugins root changed while the complete staged root was assembled");
    }
    const stagedInventory = await inventoryPluginsRoot(completeRoot, "complete staged plugins root");

    await operations.beforeRootBackup?.({ pluginsRoot, recoveryRoot, stagedPluginsRoot: completeRoot });
    await renameEntry(pluginsRoot, backupRoot);
    backupMoved = true;
    for (const productName of PRODUCT_NAMES) {
      const backup = path.join(backupRoot, productName);
      Object.assign(products.get(productName), {
        status: "backed-up",
        originalLocation: backup,
        backupLocation: backup,
      });
    }
    const movedInventory = await inventoryPluginsRoot(backupRoot, "moved plugins root");
    if (!inventoriesMatch(inventoryAfterCopy, movedInventory)) {
      throw new Error("plugins root entry changed after preflight and before backup");
    }

    await operations.beforeRootInstall?.({ pluginsRoot, recoveryRoot, stagedPluginsRoot: completeRoot });
    if (await pathExists(pluginsRoot)) {
      await renameEntry(pluginsRoot, unexpectedRootEntry);
      throw new Error("unexpected plugins root entry appeared before install");
    }
    await renameEntry(completeRoot, pluginsRoot);
    installed = true;
    for (const productName of PRODUCT_NAMES) {
      const destination = destinations.get(productName);
      Object.assign(products.get(productName), {
        status: "installed",
        installedSnapshotLocation: destination,
      });
    }
    const installedStats = await lstat(pluginsRoot);
    if (installedStats.isSymbolicLink() || !installedStats.isDirectory() || await realpath(pluginsRoot) !== pluginsRoot) {
      throw new Error("installed plugins root is not the expected real directory");
    }
    const installedInventory = await inventoryPluginsRoot(pluginsRoot, "installed plugins root");
    if (!inventoriesMatch(stagedInventory, installedInventory)) throw new Error("installed plugins root differs from staged root");
  } catch (error) {
    const issues = [];
    if (installed) {
      try {
        await renameEntry(pluginsRoot, failedInstallRoot);
        installed = false;
        for (const productName of PRODUCT_NAMES) {
          Object.assign(products.get(productName), {
            status: "backed-up",
            installedSnapshotLocation: path.join(failedInstallRoot, productName),
          });
        }
      } catch (rollbackError) {
        for (const productName of PRODUCT_NAMES) products.get(productName).status = "recovery-required";
        issues.push(`quarantine installed plugins root ${pluginsRoot}: ${rollbackError.message}`);
      }
    }
    if (backupMoved) {
      try {
        if (await pathExists(pluginsRoot)) {
          for (const productName of PRODUCT_NAMES) products.get(productName).status = "recovery-required";
          issues.push(`restore blocked because plugins root still exists: ${pluginsRoot}`);
        } else {
          await renameEntry(backupRoot, pluginsRoot);
          backupMoved = false;
          for (const productName of PRODUCT_NAMES) {
            Object.assign(products.get(productName), {
              status: "restored",
              originalLocation: destinations.get(productName),
              backupLocation: null,
              installedSnapshotLocation: null,
            });
          }
        }
      } catch (rollbackError) {
        for (const productName of PRODUCT_NAMES) products.get(productName).status = "recovery-required";
        issues.push(`restore ${backupRoot} -> ${pluginsRoot}: ${rollbackError.message}`);
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
      throw await recoveryFailure("Snapshot replacement failed; originals were restored but recovery cleanup failed", {
        state: "fully-restored-recovery-retained",
        recoveryRoot,
        stagingRoot,
        products,
        issues: [cleanupError.message],
      }, error);
    }
    throw error;
  }
  try {
    await removeEntry(recoveryRoot, { recursive: true, force: true });
  } catch (error) {
    throw await recoveryFailure("Snapshots were committed but original backups could not be removed", {
      state: "committed-recovery-retained",
      recoveryRoot,
      stagingRoot,
      products,
      issues: [error.message],
    }, error);
  }
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
      await replaceSnapshots({
        stagingRoot,
        pluginsRoot: installPreflight.pluginsRoot,
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
}

const entryPath = process.argv[1] ? await realpath(process.argv[1]).catch(() => undefined) : undefined;
if (entryPath && pathToFileURL(entryPath).href === import.meta.url) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
