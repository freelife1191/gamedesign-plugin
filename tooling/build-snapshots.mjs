#!/usr/bin/env node

import { fork } from "node:child_process";
import { lstat, realpath, rm } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

import { collectTree } from "./lib/copy-tree.mjs";
import { createSnapshotStaging } from "./lib/build-product.mjs";
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

async function replaceSnapshots({ repoRoot, stagingRoot, pluginsRoot, pluginsIdentity, destinations, operations = {} }) {
  const workerPath = fileURLToPath(new URL("./snapshot-transaction-worker.mjs", import.meta.url));
  const child = fork(workerPath, [], {
    cwd: pluginsRoot,
    stdio: ["ignore", "ignore", "pipe", "ipc"],
  });
  let stderr = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => { stderr += chunk; });

  return new Promise((resolve, reject) => {
    let settled = false;
    function finish(error, recovery) {
      if (settled) return;
      settled = true;
      if (child.connected) child.disconnect();
      if (error) reject(error);
      else resolve(recovery);
    }
    child.on("message", async (message) => {
      if (message?.type === "spawned") {
        try {
          await operations.afterWorkerSpawn?.({ pluginsRoot, stagedPluginsRoot: stagingRoot });
          child.send({
            type: "start",
            config: {
              repoRoot,
              stagingRoot,
              pluginsRoot,
              pluginsIdentity,
              destinations: [...destinations],
              faults: operations.faults ?? [],
            },
          });
        } catch (error) {
          child.kill();
          finish(error);
        }
        return;
      }
      if (message?.type === "phase") {
        try {
          await operations[message.phase]?.(message.payload);
          child.send({ type: "phase-result", requestId: message.requestId });
        } catch (error) {
          child.send({ type: "phase-result", requestId: message.requestId, error: error.message });
        }
        return;
      }
      if (message?.type === "result") finish(null, message.recovery);
      if (message?.type === "error") {
        const error = new Error(message.message);
        error.recovery = message.recovery;
        error.preserveStaging = message.preserveStaging === true;
        finish(error);
      }
    });
    child.on("error", (error) => finish(error));
    child.on("exit", (code, signal) => {
      if (!settled) finish(new Error(`Snapshot transaction worker exited before reporting a result (${signal ?? code})${stderr ? `: ${stderr}` : ""}`));
    });
  });
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
