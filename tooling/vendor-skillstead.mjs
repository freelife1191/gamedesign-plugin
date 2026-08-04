import * as defaultFs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { collectTree } from "./lib/copy-tree.mjs";
import { sha256 } from "./lib/hash.mjs";
import { verifyVendorHash, verifyVendorRoot } from "./verify-vendor-hash.mjs";

const VERSION = "0.8.3";
const REQUIRED_FILES = ["SKILL.md", "LICENSE.txt", "scripts/check-svg.mjs", "scripts/render.mjs"];
const PACKAGE = Object.freeze({
  name: "svg-infographic",
  version: VERSION,
  upstream: "https://github.com/kyungseo/skillstead",
  license: "Apache-2.0",
  copyright: "Copyright 2026 Kyungseo Park",
});

function parseArgs(args) {
  if (args.length === 0) return { update: false };
  if (args.length === 4 && args[0] === "--update-from" && args[1] && args[2] === "--version" && args[3]) {
    return { source: path.resolve(args[1]), update: true, version: args[3] };
  }
  throw new Error(
    "Usage: node tooling/vendor-skillstead.mjs [--update-from <source> --version 0.8.3]",
  );
}

function declaredVersion(skill) {
  const frontMatter = skill.match(/^---\n([\s\S]*?)\n---/);
  return frontMatter?.[1].match(/^\s*version:\s*([^\s]+)\s*$/m)?.[1];
}

function validateSourceEntries(entries, requestedVersion) {
  if (requestedVersion !== VERSION) {
    throw new Error(`version mismatch: this vendor lock only permits ${VERSION}, received ${requestedVersion}`);
  }
  const byPath = new Map(entries.map((entry) => [entry.relativePath, entry]));
  for (const required of REQUIRED_FILES) {
    if (!byPath.has(required)) throw new Error(`missing required upstream file: ${required}`);
  }
  const skill = byPath.get("SKILL.md").bytes.toString("utf8");
  const sourceVersion = declaredVersion(skill);
  if (sourceVersion !== requestedVersion) {
    throw new Error(`version mismatch: source declares ${sourceVersion ?? "no version"}, expected ${requestedVersion}`);
  }
}

function lockFor(entries) {
  return {
    package: PACKAGE,
    files: entries.map((entry) => ({
      path: entry.relativePath,
      sha256: sha256(entry.bytes),
      size: entry.bytes.length,
    })),
  };
}

function noticesForPackage() {
  return `# Third-Party Notices

## Skillstead svg-infographic

- Upstream: ${PACKAGE.upstream}
- Version: ${PACKAGE.version}
- License: ${PACKAGE.license}
- ${PACKAGE.copyright}

The complete Apache License 2.0 text is preserved in \`${PACKAGE.name}/${PACKAGE.version}/LICENSE.txt\`.
`;
}

function sameSnapshot(left, right) {
  if (left.length !== right.length) return false;
  return left.every((entry, index) => {
    const other = right[index];
    return entry.relativePath === other.relativePath && entry.bytes.equals(other.bytes);
  });
}

async function writeSnapshot(entries, destination, fs) {
  for (const entry of entries) {
    const target = path.join(destination, ...entry.relativePath.split("/"));
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, entry.bytes);
  }
}

async function retryRename(fs, from, to, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await fs.rename(from, to);
      return;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

function recoveryError(message, recoveryPath, cause) {
  const error = new Error(`${message}; recovery data preserved at ${recoveryPath}`, { cause });
  error.recoveryPath = recoveryPath;
  return error;
}

async function assertGeneration(root, expectedEntries) {
  await verifyVendorRoot(root);
  const actualEntries = await collectTree(root, { label: "rollback generation" });
  if (!sameSnapshot(expectedEntries, actualEntries)) {
    throw new Error("rollback generation differs from the pre-install byte snapshot");
  }
}

async function rollbackInstall({ backup, destination, fs, installed, previousEntries, workRoot }) {
  try {
    await assertGeneration(backup, previousEntries);
  } catch (error) {
    throw recoveryError("backup is not safe to restore", backup, error);
  }

  if (installed) {
    try {
      await retryRename(fs, destination, path.join(workRoot, "failed-next"));
    } catch (error) {
      throw recoveryError("could not move the failed installed generation aside", backup, error);
    }
  }

  try {
    await retryRename(fs, backup, destination);
  } catch (error) {
    throw recoveryError("could not restore the prior vendor generation", backup, error);
  }

  try {
    await assertGeneration(destination, previousEntries);
  } catch (error) {
    throw recoveryError("restored vendor generation failed verification", destination, error);
  }

  try {
    await fs.rm(workRoot, { recursive: true, force: true });
  } catch (error) {
    throw recoveryError("restored vendor generation but could not remove failed update data", workRoot, error);
  }
}

function cleanupWarning(cleanupPath, cause) {
  return {
    code: "VENDOR_CLEANUP_PENDING",
    message: `vendor update committed; cleanup pending at ${cleanupPath}: ${cause.message}`,
    path: cleanupPath,
  };
}

async function createCleanupTombstone(workRoot, fs) {
  const suffix = path.basename(workRoot).slice(".skillstead-update-".length);
  const tombstone = path.join(path.dirname(workRoot), `.skillstead-cleanup-${suffix}`);
  await fs.rename(workRoot, tombstone);
  return tombstone;
}

async function cleanupCommittedGeneration(tombstone, fs) {
  try {
    await fs.rm(tombstone, { recursive: true, force: true });
  } catch (error) {
    const warning = cleanupWarning(tombstone, error);
    return { committed: true, cleanupPending: tombstone, warnings: [warning] };
  }
  return { committed: true, cleanupPending: null, warnings: [] };
}

export async function updateVendor(repositoryRoot, source, requestedVersion, options = {}) {
  const fs = options.fs ?? defaultFs;
  const hooks = options.hooks ?? {};
  const sourceEntries = await collectTree(source, { label: "Skillstead update source" });
  validateSourceEntries(sourceEntries, requestedVersion);

  const vendorParent = path.join(repositoryRoot, "shared/vendor");
  const vendorRoot = path.join(vendorParent, "skillstead");
  await fs.mkdir(vendorParent, { recursive: true });
  const workRoot = await fs.mkdtemp(path.join(vendorParent, ".skillstead-update-"));
  const stagedVendorRoot = path.join(workRoot, "next");
  const stagedPackageRoot = path.join(stagedVendorRoot, PACKAGE.name, VERSION);
  const backup = path.join(workRoot, "previous");

  try {
    await writeSnapshot(sourceEntries, stagedPackageRoot, fs);
    const stagedEntries = await collectTree(stagedPackageRoot, { label: "staged Skillstead snapshot" });
    await fs.writeFile(path.join(stagedVendorRoot, "vendor.lock.json"), `${JSON.stringify(lockFor(stagedEntries), null, 2)}\n`);
    await fs.writeFile(path.join(stagedVendorRoot, "THIRD_PARTY_NOTICES.md"), noticesForPackage());
    await verifyVendorRoot(stagedVendorRoot);
    await hooks.afterSnapshot?.({ stagedVendorRoot, workRoot });

    const currentSourceEntries = await collectTree(source, { label: "Skillstead update source recheck" });
    if (!sameSnapshot(sourceEntries, currentSourceEntries)) {
      throw new Error("source changed during update; refusing mixed-generation install");
    }
    await hooks.beforeInstall?.({ stagedVendorRoot, workRoot });
    await verifyVendorRoot(stagedVendorRoot);
  } catch (error) {
    await fs.rm(workRoot, { recursive: true, force: true });
    throw error;
  }

  let oldMoved = false;
  let installed = false;
  let previousEntries;
  let cleanupTombstone;
  try {
    const hasExistingGeneration = await fs.lstat(vendorRoot).then(
      () => true,
      (error) => {
        if (error.code === "ENOENT") return false;
        throw error;
      },
    );
    if (hasExistingGeneration) {
      await verifyVendorRoot(vendorRoot);
      previousEntries = await collectTree(vendorRoot, { label: "pre-install vendor generation" });
      await fs.rename(vendorRoot, backup);
      oldMoved = true;
    }
    await fs.rename(stagedVendorRoot, vendorRoot);
    installed = true;
    await hooks.afterInstall?.({ backup, vendorRoot, workRoot });
    await verifyVendorRoot(vendorRoot);
    cleanupTombstone = await createCleanupTombstone(workRoot, fs);
  } catch (error) {
    if (oldMoved) {
      try {
        await rollbackInstall({
          backup,
          destination: vendorRoot,
          fs,
          installed,
          previousEntries,
          workRoot,
        });
      } catch (rollbackError) {
        throw new AggregateError(
          [error, rollbackError],
          `${rollbackError.message}; original failure: ${error.message}`,
        );
      }
    } else {
      await fs.rm(workRoot, { recursive: true, force: true });
    }
    throw error;
  }

  return cleanupCommittedGeneration(cleanupTombstone, fs);
}

const modulePath = fileURLToPath(import.meta.url);
const repositoryRoot = path.resolve(path.dirname(modulePath), "..");

if (process.argv[1] && path.resolve(process.argv[1]) === modulePath) {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.update) {
      const result = await updateVendor(repositoryRoot, options.source, options.version);
      console.log(`Updated Skillstead ${VERSION} vendor tree`);
      for (const warning of result.warnings) console.warn(`warning: ${warning.message}`);
    }
    const count = await verifyVendorHash(repositoryRoot);
    console.log(`Skillstead vendor verified ${count} files`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
