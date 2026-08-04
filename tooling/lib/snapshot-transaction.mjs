import { cp, lstat, mkdtemp, mkdir, open, readFile, realpath, rename, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { collectTree } from "./copy-tree.mjs";
import { hashFileEntries } from "./hash.mjs";

const PRODUCT_NAMES = Object.freeze(["game-design-career", "game-design-studio"]);
const JOURNAL_NAME = "SNAPSHOT-TRANSACTION-JOURNAL.json";

async function fsyncPath(candidate) {
  let handle;
  try {
    handle = await open(candidate, "r");
    await handle.sync();
  } catch (error) {
    if (!["EINVAL", "ENOTSUP", "EBADF", "EISDIR", "EPERM"].includes(error.code)) throw error;
  } finally {
    await handle?.close();
  }
}

async function writeJournal(state) {
  const journalPath = path.join(state.recoveryRoot, JOURNAL_NAME);
  const temporaryPath = path.join(state.recoveryRoot, `.${JOURNAL_NAME}.${process.pid}.tmp`);
  const journal = {
    schemaVersion: 1,
    state: state.state,
    repoRoot: state.repoRoot,
    recoveryRoot: state.recoveryRoot,
    stagingRoot: state.stagingRoot,
    anchoredRoot: state.anchoredRoot,
    leaves: PRODUCT_NAMES,
    products: Object.fromEntries(PRODUCT_NAMES.map((productName) => {
      const product = state.products.get(productName);
      return [productName, {
        status: product.status,
        pendingAction: product.pendingAction ?? null,
        destination: product.destination,
        backupCandidate: product.backupCandidate,
        safetyCandidate: product.safetyCandidate,
        originalTreeSha256: product.originalTreeSha256,
        failedInstallCandidate: product.failedInstallCandidate,
        originalLocation: product.originalLocation,
        backupLocation: product.backupLocation,
        installedSnapshotLocation: product.installedSnapshotLocation,
        manualAction: manualRecoveryAction(productName, product),
      }];
    })),
    issues: state.issues,
  };
  await writeFile(temporaryPath, `${JSON.stringify(journal, null, 2)}\n`, { mode: 0o600 });
  await fsyncPath(temporaryPath);
  await rename(temporaryPath, journalPath);
  await fsyncPath(state.recoveryRoot);
  return journalPath;
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
  const causeMessage = cause instanceof Error ? `: ${cause.message}` : "";
  const error = new Error(`${message}${causeMessage}\nSNAPSHOT_RECOVERY=${JSON.stringify(recovery)}`, { cause });
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

function isExactChild(parent, candidate, leaf) {
  return typeof candidate === "string" && candidate === path.join(parent, leaf);
}

async function assertSafeRecoveryRoot(recoveryRoot, expectedRecoveryRoot) {
  if (recoveryRoot !== expectedRecoveryRoot || typeof recoveryRoot !== "string") {
    throw new Error("snapshot worker recovery root does not match the parent capability");
  }
  const canonicalTemp = await realpath(tmpdir());
  const stats = await lstat(recoveryRoot);
  if (!stats.isDirectory() || stats.isSymbolicLink() || await realpath(recoveryRoot) !== recoveryRoot
    || path.dirname(recoveryRoot) !== canonicalTemp || !path.basename(recoveryRoot).startsWith("snapshot-recovery-")) {
    throw new Error("snapshot worker recovery root is not a canonical safe temporary child");
  }
}

async function parseJournal(recoveryRoot) {
  return JSON.parse(await readFile(path.join(recoveryRoot, JOURNAL_NAME), "utf8"));
}

function exactIdentity(left, right) {
  return left && right && left.path === right.path && left.dev === right.dev && left.ino === right.ino && left.mode === right.mode;
}

export async function validateSnapshotWorkerRegistration(registration, expected) {
  if (!registration || typeof registration !== "object") throw new Error("snapshot worker registration is missing");
  const { recoveryRoot, stagingRoot, pluginsRoot, anchoredRoot, leaves } = registration;
  if (stagingRoot !== expected.stagingRoot || pluginsRoot !== expected.pluginsRoot
    || !exactIdentity(anchoredRoot, { path: expected.pluginsRoot, ...expected.pluginsIdentity })
    || JSON.stringify(leaves) !== JSON.stringify(PRODUCT_NAMES)) {
    throw new Error("snapshot worker registration fields do not match the parent capability");
  }
  await assertSafeRecoveryRoot(recoveryRoot, expected.recoveryRoot);
  if (await realpath(stagingRoot) !== stagingRoot) throw new Error("snapshot worker staging root is not canonical");
  const rootStats = await lstat(pluginsRoot);
  if (!sameIdentity(rootStats, anchoredRoot) || await realpath(pluginsRoot) !== pluginsRoot) {
    throw new Error("snapshot worker registered plugins identity is not current and canonical");
  }
  const journal = await parseJournal(recoveryRoot);
  if (journal.schemaVersion !== 1 || journal.repoRoot !== expected.repoRoot || journal.recoveryRoot !== recoveryRoot
    || journal.stagingRoot !== stagingRoot || !exactIdentity(journal.anchoredRoot, anchoredRoot)
    || JSON.stringify(journal.leaves) !== JSON.stringify(PRODUCT_NAMES)
    || Object.keys(journal.products ?? {}).sort().join("\0") !== [...PRODUCT_NAMES].sort().join("\0")) {
    throw new Error("journal registration fields do not match");
  }
  for (const productName of PRODUCT_NAMES) {
    const recorded = journal.products[productName];
    const expectedHash = expected.originalTreeHashes.get(productName);
    if (recorded.destination !== path.join(pluginsRoot, productName)
      || recorded.backupCandidate !== path.join(recoveryRoot, productName)
      || recorded.safetyCandidate !== path.join(recoveryRoot, "safety", productName)
      || recorded.failedInstallCandidate !== path.join(recoveryRoot, `failed-${productName}`)
      || recorded.originalTreeSha256 !== expectedHash) {
      throw new Error(`${productName}: journal registration product fields do not match`);
    }
    const safetyEntries = await collectTree(recorded.safetyCandidate, { label: `safety copy ${productName}` });
    if (hashFileEntries(safetyEntries) !== expectedHash) throw new Error(`${productName}: safety copy hash does not match original`);
  }
  return Object.freeze({ ...registration });
}

async function verifiedCandidate(candidate, expectedHash, label, issues) {
  try {
    if (await canonicalExistingPath(candidate) !== candidate) return null;
    const entries = await collectTree(candidate, { label });
    if (hashFileEntries(entries) !== expectedHash) {
      issues.push(`${label}: tree hash was rejected`);
      return null;
    }
    return candidate;
  } catch (error) {
    issues.push(`${label}: ${error.message}`);
    return null;
  }
}

export async function readSnapshotRecoveryJournal(expected) {
  const { recoveryRoot, stagingRoot, pluginsRoot, pluginsIdentity, originalTreeHashes, stagedTreeHashes } = expected;
  await assertSafeRecoveryRoot(recoveryRoot, expected.recoveryRoot);
  let journal;
  const issues = [];
  try {
    journal = await parseJournal(recoveryRoot);
    if (journal.schemaVersion !== 1 || journal.recoveryRoot !== recoveryRoot || journal.stagingRoot !== stagingRoot
      || journal.anchoredRoot?.path !== pluginsRoot || JSON.stringify(journal.leaves) !== JSON.stringify(PRODUCT_NAMES)) {
      throw new Error("journal registration fields do not match");
    }
  } catch (error) {
    issues.push(`journal validation: ${error.message}`);
    journal = { products: {} };
  }
  const products = {};
  for (const productName of PRODUCT_NAMES) {
    const recorded = journal.products?.[productName] ?? {};
    const destination = path.join(pluginsRoot, productName);
    const backupCandidate = path.join(recoveryRoot, productName);
    const safetyCandidate = path.join(recoveryRoot, "safety", productName);
    const failedInstallCandidate = path.join(recoveryRoot, `failed-${productName}`);
    if ((recorded.destination && !isExactChild(pluginsRoot, recorded.destination, productName))
      || (recorded.backupCandidate && !isExactChild(recoveryRoot, recorded.backupCandidate, productName))
      || (recorded.safetyCandidate && recorded.safetyCandidate !== safetyCandidate)
      || (recorded.failedInstallCandidate && recorded.failedInstallCandidate !== failedInstallCandidate)) {
      issues.push(`${productName}: journal paths were rejected`);
    }
    const expectedHash = originalTreeHashes.get(productName);
    const stagedHash = stagedTreeHashes.get(productName);
    const backupLocation = await verifiedCandidate(backupCandidate, expectedHash, `${productName} backup`, issues);
    const safetyLocation = await verifiedCandidate(safetyCandidate, expectedHash, `${productName} safety copy`, issues);
    const failedInstall = await verifiedCandidate(failedInstallCandidate, stagedHash, `${productName} failed install`, issues);
    let originalDestination = null;
    let installedDestination = null;
    try {
      const rootStats = await lstat(pluginsRoot);
      if (sameIdentity(rootStats, pluginsIdentity) && await realpath(pluginsRoot) === pluginsRoot) {
        if (recorded.status === "installed" || recorded.pendingAction === "install") {
          installedDestination = await verifiedCandidate(destination, stagedHash, `${productName} installed destination`, issues);
        } else {
          originalDestination = await verifiedCandidate(destination, expectedHash, `${productName} original destination`, issues);
        }
      }
    } catch (error) {
      issues.push(`${productName} visible destination: ${error.message}`);
    }
    const originalLocation = backupLocation ?? safetyLocation ?? originalDestination;
    const installedSnapshotLocation = failedInstall ?? installedDestination;
    let status = recorded.status ?? "recovery-required";
    if ((backupLocation || safetyLocation) && installedSnapshotLocation) status = "recovery-required";
    else if (backupLocation) status = "backed-up";
    else if (originalLocation) status = "restored";
    else if (installedSnapshotLocation) status = "installed";
    else status = "recovery-required";
    const product = { status, originalLocation, backupLocation, installedSnapshotLocation };
    products[productName] = { ...product, manualAction: manualRecoveryAction(productName, product) };
  }
  return {
    state: journal.state ?? "worker-interrupted",
    recoveryRoot: await canonicalExistingPath(recoveryRoot),
    stagingRoot: await canonicalExistingPath(stagingRoot),
    products,
    issues: [...(Array.isArray(journal.issues) ? journal.issues : []), ...issues],
  };
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
  const recoveryRoot = config.recoveryRoot ?? await mkdtemp(path.join(await realpath(tmpdir()), "snapshot-recovery-"));
  await assertSafeRecoveryRoot(recoveryRoot, recoveryRoot);
  const anchoredRoot = { path: await realpath("."), ...pluginsIdentity };
  const products = new Map(PRODUCT_NAMES.map((productName) => [productName, {
    status: "untouched",
    originalLocation: destinations.get(productName),
    backupLocation: null,
    installedSnapshotLocation: null,
    backupTreeSha256: null,
    destination: path.join(anchoredRoot.path, productName),
    backupCandidate: path.join(recoveryRoot, productName),
    safetyCandidate: path.join(recoveryRoot, "safety", productName),
    failedInstallCandidate: path.join(recoveryRoot, `failed-${productName}`),
    originalTreeSha256: null,
    pendingAction: null,
  }]));
  const journalState = {
    state: "registered",
    repoRoot,
    recoveryRoot,
    stagingRoot,
    anchoredRoot,
    products,
    issues: [],
  };
  await mkdir(path.join(recoveryRoot, "safety"), { mode: 0o700 });
  for (const productName of PRODUCT_NAMES) {
    const sourceEntries = await collectTree(productName, { label: `original ${productName}` });
    const sourceHash = hashFileEntries(sourceEntries);
    const safetyCandidate = products.get(productName).safetyCandidate;
    await cp(productName, safetyCandidate, { recursive: true, errorOnExist: true, force: false, preserveTimestamps: true });
    const safetyEntries = await collectTree(safetyCandidate, { label: `safety copy ${productName}` });
    if (hashFileEntries(safetyEntries) !== sourceHash) throw new Error(`${productName}: safety copy verification failed`);
    for (const entry of safetyEntries) await fsyncPath(entry.sourcePath);
    await fsyncPath(safetyCandidate);
    products.get(productName).originalTreeSha256 = sourceHash;
  }
  await fsyncPath(path.join(recoveryRoot, "safety"));
  await writeJournal(journalState);
  await hooks.register?.({
    recoveryRoot,
    stagingRoot,
    pluginsRoot: anchoredRoot.path,
    anchoredRoot,
    leaves: PRODUCT_NAMES,
  });
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
      Object.assign(products.get(productName), { pendingAction: "backup" });
      journalState.state = "backing-up";
      await writeJournal(journalState);
      injectFault("backup", productName);
      await rename(productName, backup);
      const backupEntries = await collectTree(backup, { label: `backup ${productName}` });
      Object.assign(products.get(productName), {
        status: "backed-up",
        originalLocation: backup,
        backupLocation: backup,
        backupTreeSha256: hashFileEntries(backupEntries),
        pendingAction: null,
      });
      movedBackups.push({ productName, backup });
      await writeJournal(journalState);
      await hooks.phase?.("afterBackup", { productName, pluginsRoot, recoveryRoot, stagedPluginsRoot: stagingRoot });
    }
    await hooks.phase?.("beforeRootInstall", { pluginsRoot, recoveryRoot, stagedPluginsRoot: stagingRoot });
    await assertAnchoredIdentity(pluginsIdentity);
    await assertVisibleRootIdentity(pluginsRoot, pluginsIdentity);
    for (const productName of PRODUCT_NAMES) {
      Object.assign(products.get(productName), { pendingAction: "install" });
      journalState.state = "installing";
      await writeJournal(journalState);
      injectFault("install", productName);
      await rename(path.join(stagingRoot, productName), productName);
      installed.push(productName);
      Object.assign(products.get(productName), {
        status: "installed",
        installedSnapshotLocation: destinations.get(productName),
        pendingAction: null,
      });
      await writeJournal(journalState);
      await hooks.phase?.("afterInstall", { productName, pluginsRoot, recoveryRoot, stagedPluginsRoot: stagingRoot });
      await verifyProductTree(expectedTrees.get(productName), productName, `installed ${productName}`);
      await assertAnchoredIdentity(pluginsIdentity);
      await assertVisibleRootIdentity(pluginsRoot, pluginsIdentity);
    }
    const marker = await writeRecoveryMarker({ recoveryRoot, repoRoot, products, expectedTrees });
    journalState.state = marker.state;
    await writeJournal(journalState);
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
        Object.assign(products.get(productName), { pendingAction: "quarantine" });
        journalState.state = "rolling-back";
        await writeJournal(journalState);
        injectFault("quarantine", productName);
        await rename(productName, failedInstall);
        Object.assign(products.get(productName), { status: "backed-up", installedSnapshotLocation: failedInstall, pendingAction: null });
        await writeJournal(journalState);
      } catch (rollbackError) {
        products.get(productName).status = "recovery-required";
        issues.push(`quarantine installed ${productName}: ${rollbackError.message}`);
      }
    }
    for (const { productName, backup } of [...movedBackups].reverse()) {
      const product = products.get(productName);
      try {
        Object.assign(product, { pendingAction: "restore" });
        await writeJournal(journalState);
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
            pendingAction: null,
          });
          await writeJournal(journalState);
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
      journalState.state = "fully-restored-recovery-retained";
      await writeJournal(journalState);
    } catch (cleanupError) {
      throw await recoveryFailure("Snapshot replacement failed; originals were restored but recovery cleanup was partial", {
        state: "fully-restored-cleanup-partial",
        recoveryRoot,
        stagingRoot,
        products,
        issues: [cleanupError.message],
      }, error);
    }
    throw await recoveryFailure("Snapshot replacement failed; originals were restored and recovery evidence was retained", {
      state: journalState.state,
      recoveryRoot,
      stagingRoot,
      products,
      issues: [],
    }, error);
  }
}
