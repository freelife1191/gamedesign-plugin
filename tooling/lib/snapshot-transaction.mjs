import { lstat, mkdtemp, readFile, realpath, rename, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { collectTree } from "./copy-tree.mjs";
import { hashFileEntries } from "./hash.mjs";

const PRODUCT_NAMES = Object.freeze(["game-design-career", "game-design-studio"]);

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
  if (product.backupLocation) return `Restore backupLocation to the empty ${productName} plugin destination.`;
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
    const product = { status, originalLocation, backupLocation, installedSnapshotLocation };
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
  if (!sameIdentity(await stat("."), identity)) throw new Error("snapshot worker cwd identity changed");
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
  if (JSON.stringify(JSON.parse(await readFile(markerPath, "utf8"))) !== JSON.stringify(marker)) {
    throw new Error("recovery marker verification failed");
  }
  return marker;
}

function createFaultInjector(faults = []) {
  const pending = faults.map((fault) => ({ ...fault, used: false }));
  return (phase, productName = null) => {
    const fault = pending.find((candidate) => !candidate.used
      && candidate.phase === phase
      && (candidate.productName ?? null) === productName);
    if (!fault) return;
    fault.used = true;
    throw new Error(fault.message ?? `Injected snapshot transaction fault at ${phase}`);
  };
}

export async function runSnapshotTransaction(config, hooks = {}) {
  const {
    repoRoot,
    stagingRoot,
    pluginsRoot,
    pluginsIdentity,
    destinations: destinationEntries,
    faults = [],
  } = config;
  const destinations = new Map(destinationEntries);
  const injectFault = createFaultInjector(faults);
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
  const movedBackups = [];
  const installed = [];
  try {
    await assertAnchoredIdentity(pluginsIdentity);
    await assertVisibleRootIdentity(pluginsRoot, pluginsIdentity);
    await hooks.phase?.("beforeRootBackup", { pluginsRoot, recoveryRoot, stagedPluginsRoot: stagingRoot });
    await assertAnchoredIdentity(pluginsIdentity);
    await assertVisibleRootIdentity(pluginsRoot, pluginsIdentity);
    for (const productName of PRODUCT_NAMES) {
      const backup = path.join(recoveryRoot, productName);
      injectFault("backup", productName);
      await rename(productName, backup);
      const backupEntries = await collectTree(backup, { label: `backup ${productName}` });
      Object.assign(products.get(productName), {
        status: "backed-up",
        originalLocation: backup,
        backupLocation: backup,
        backupTreeSha256: hashFileEntries(backupEntries),
      });
      movedBackups.push({ productName, backup });
    }
    await hooks.phase?.("beforeRootInstall", { pluginsRoot, recoveryRoot, stagedPluginsRoot: stagingRoot });
    await assertAnchoredIdentity(pluginsIdentity);
    await assertVisibleRootIdentity(pluginsRoot, pluginsIdentity);
    for (const productName of PRODUCT_NAMES) {
      injectFault("install", productName);
      await rename(path.join(stagingRoot, productName), productName);
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
    return {
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
      manualCleanup: `Recovery bundle retained at ${recoveryRoot}; remove this exact directory manually only after accepting both installed snapshots.`,
      warnings: [],
    };
  } catch (error) {
    const issues = [];
    for (const productName of [...installed].reverse()) {
      const failedInstall = path.join(recoveryRoot, `failed-${productName}`);
      try {
        injectFault("quarantine", productName);
        await rename(productName, failedInstall);
        Object.assign(products.get(productName), { status: "backed-up", installedSnapshotLocation: failedInstall });
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
          injectFault("restore", productName);
          await rename(backup, productName);
          Object.assign(product, {
            status: "restored",
            originalLocation: path.join(await realpath("."), productName),
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
        state: "rollback-incomplete", recoveryRoot, stagingRoot, products, issues,
      }, error);
    }
    try {
      injectFault("cleanup");
      await rm(recoveryRoot, { recursive: true, force: true });
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
}
