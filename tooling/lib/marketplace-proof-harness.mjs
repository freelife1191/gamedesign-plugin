#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstat, readFile, readdir, realpath } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

function exactKeys(value, keys) {
  return value && typeof value === "object" && !Array.isArray(value)
    && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());
}

async function fileIdentity(target) {
  const before = await lstat(target);
  if (!before.isFile() || before.isSymbolicLink()) throw new Error("proof file type mismatch");
  const bytes = await readFile(target);
  const after = await lstat(target);
  if (before.dev !== after.dev || before.ino !== after.ino || before.mode !== after.mode || before.size !== after.size) {
    throw new Error("proof file changed during capture");
  }
  return {
    dev: after.dev,
    ino: after.ino,
    mode: after.mode,
    size: after.size,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}

function sameIdentity(left, right) {
  return ["dev", "ino", "mode", "size", "sha256"].every((key) => left[key] === right[key]);
}

function sameStats(left, right) {
  return ["dev", "ino", "mode", "size"].every((key) => left[key] === right[key]);
}

function updateLengthPrefixed(hash, kind, value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(value, "utf8");
  const length = Buffer.alloc(8);
  length.writeBigUInt64BE(BigInt(bytes.length));
  hash.update(Buffer.from([kind]));
  hash.update(length);
  hash.update(bytes);
}

async function canonicalWithin(target, root, expectedType) {
  const [targetReal, rootReal, stats] = await Promise.all([realpath(target), realpath(root), lstat(target)]);
  const relative = path.relative(rootReal, targetReal);
  if (!relative || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error("proof path escaped boundary");
  }
  if (stats.isSymbolicLink() || !stats[expectedType]()) throw new Error("proof path type mismatch");
  return targetReal;
}

export async function artifactTreeIdentity(root) {
  const rootReal = await realpath(root);
  const rootStats = await lstat(root);
  if (!rootStats.isDirectory() || rootStats.isSymbolicLink()) throw new Error("artifact root type mismatch");
  const hash = createHash("sha256");
  updateLengthPrefixed(hash, 1, JSON.stringify([
    "", "directory", rootStats.dev, rootStats.ino, rootStats.mode, rootStats.size,
  ]));
  const visit = async (directory, relativeDirectory = "") => {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name, "en"));
    for (const entry of entries) {
      const relative = path.join(relativeDirectory, entry.name);
      const absolute = path.join(directory, entry.name);
      const before = await lstat(absolute);
      if (before.isSymbolicLink()) throw new Error("artifact tree contains a symlink");
      const canonical = await realpath(absolute);
      const boundary = path.relative(rootReal, canonical);
      if (!boundary || boundary === ".." || boundary.startsWith(`..${path.sep}`) || path.isAbsolute(boundary)) {
        throw new Error("artifact tree escaped boundary");
      }
      const portable = relative.split(path.sep).join("/");
      const type = before.isDirectory() ? "directory" : before.isFile() ? "file" : null;
      if (!type) throw new Error("artifact tree contains an unsupported entry");
      updateLengthPrefixed(hash, 1, JSON.stringify([
        portable, type, before.dev, before.ino, before.mode, before.size,
      ]));
      if (type === "directory") {
        await visit(absolute, relative);
        const after = await lstat(absolute);
        if (!after.isDirectory() || after.isSymbolicLink() || !sameStats(before, after)) {
          throw new Error("artifact directory changed during capture");
        }
      } else {
        const bytes = await readFile(absolute);
        const after = await lstat(absolute);
        if (!after.isFile() || after.isSymbolicLink() || !sameStats(before, after) || bytes.length !== after.size) {
          throw new Error("artifact file changed during capture");
        }
        updateLengthPrefixed(hash, 2, bytes);
      }
    }
  };
  await visit(rootReal);
  const rootAfter = await lstat(root);
  if (!rootAfter.isDirectory() || rootAfter.isSymbolicLink() || !sameStats(rootStats, rootAfter)) {
    throw new Error("artifact root changed during capture");
  }
  return {
    dev: rootAfter.dev,
    ino: rootAfter.ino,
    mode: rootAfter.mode,
    size: rootAfter.size,
    sha256: hash.digest("hex"),
  };
}

export async function runMarketplaceProof(args, { nodePath = process.execPath } = {}) {
  if (!Array.isArray(args) || args.length !== 7 || args.some((value) => typeof value !== "string" || value.length === 0)) {
    throw new Error("Usage: marketplace-proof-harness.mjs <cache-root> <workspace-root> <skill-path> <skill-sha256> <validator-path> <validator-sha256> <artifact-path>");
  }
  const [cacheRoot, workspaceRoot, skillPath, expectedSkillSha256, validatorPath, expectedValidatorSha256, artifactPath] = args;
  if (!/^[a-f0-9]{64}$/u.test(expectedSkillSha256) || !/^[a-f0-9]{64}$/u.test(expectedValidatorSha256)) {
    throw new Error("proof digest contract mismatch");
  }
  const selfPath = fileURLToPath(import.meta.url);
  await Promise.all([
    canonicalWithin(artifactPath, workspaceRoot, "isDirectory"),
    canonicalWithin(selfPath, fileURLToPath(new URL("../", import.meta.url)), "isFile"),
  ]);
  const [selfBefore, skillBefore, validatorBefore] = await Promise.all([
    fileIdentity(selfPath),
    canonicalWithin(skillPath, cacheRoot, "isFile").then(() => fileIdentity(skillPath)),
    canonicalWithin(validatorPath, cacheRoot, "isFile").then(() => fileIdentity(validatorPath)),
  ]);
  if (skillBefore.sha256 !== expectedSkillSha256 || validatorBefore.sha256 !== expectedValidatorSha256) {
    throw new Error("proof input hash mismatch");
  }
  const artifactBefore = await artifactTreeIdentity(artifactPath);
  const validation = spawnSync(nodePath, [validatorPath, artifactPath, "md"], {
    cwd: workspaceRoot,
    encoding: "utf8",
    timeout: 30000,
    maxBuffer: 16 * 1024 * 1024,
    shell: false,
  });
  if (validation.error || validation.signal || validation.status !== 0) throw new Error("artifact validator execution failed");
  const result = JSON.parse(validation.stdout);
  if (!exactKeys(result, ["ok", "errors", "warnings", "files", "requestedFormats"])
      || result.ok !== true || !Array.isArray(result.errors) || result.errors.length !== 0
      || !Array.isArray(result.warnings) || !Array.isArray(result.files)
      || JSON.stringify(result.requestedFormats) !== '["md"]') {
    throw new Error("artifact validator result mismatch");
  }
  const [selfAfter, skillAfter, validatorAfter, artifactAfter] = await Promise.all([
    fileIdentity(selfPath), fileIdentity(skillPath), fileIdentity(validatorPath), artifactTreeIdentity(artifactPath),
  ]);
  if (!sameIdentity(selfBefore, selfAfter) || !sameIdentity(skillBefore, skillAfter)
      || !sameIdentity(validatorBefore, validatorAfter)) throw new Error("proof file changed during execution");
  if (!sameIdentity(artifactBefore, artifactAfter)) throw new Error("artifact tree changed during validation");
  return {
    schemaVersion: 1,
    ok: true,
    skillSha256: skillAfter.sha256,
    validatorSha256: validatorAfter.sha256,
    artifactSha256: artifactAfter.sha256,
    requestedFormats: ["md"],
  };
}

async function main() {
  const result = await runMarketplaceProof(process.argv.slice(2));
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

const entry = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (entry && pathToFileURL(entry).href === import.meta.url) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
