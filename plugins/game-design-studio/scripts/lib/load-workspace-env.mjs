import { constants } from "node:fs";
import { lstat, open } from "node:fs/promises";
import path from "node:path";

import { noFollowOpenFlag, posixPermissionBitsMeaningful } from "./platform-file-hardening.mjs";

const maximumEnvBytes = 64 * 1024;
const environmentKeyPattern = /^[A-Za-z_][A-Za-z0-9_]*$/u;
const safeEnvValuePattern = /^[\t ]*[A-Za-z0-9._:-]*[\t ]*$/u;

function nonEmpty(value) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function failInvalidEnv(reason) {
  throw new Error(`Invalid .env: ${reason}.`);
}

function validateKeys(keys, optionName) {
  if (!Array.isArray(keys) || new Set(keys).size !== keys.length
    || !keys.every((key) => typeof key === "string" && environmentKeyPattern.test(key))) {
    throw new Error(`${optionName} must be an array of unique environment variable names.`);
  }
}

function sameFileIdentity(left, right) {
  return left.dev === right.dev && left.ino === right.ino;
}

async function inspectWorkspacePath(workspaceRoot, lstatFn) {
  if (typeof workspaceRoot !== "string" || workspaceRoot.length === 0 || workspaceRoot.includes("\0")) {
    throw new Error("workspaceRoot must be a valid path.");
  }
  const absoluteRoot = path.resolve(workspaceRoot);
  const parsedPath = path.parse(absoluteRoot);
  let current = parsedPath.root;
  const segments = absoluteRoot.slice(parsedPath.root.length).split(path.sep).filter(Boolean);
  for (const segment of segments) {
    current = path.join(current, segment);
    const stats = await lstatFn(current).catch((error) => {
      if (error?.code === "ENOENT") throw new Error("Workspace root does not exist.");
      throw error;
    });
    if (stats.isSymbolicLink()) throw new Error("Workspace root contains a symlink path component.");
    if (!stats.isDirectory()) throw new Error("Workspace root path component is not a directory.");
  }
  return absoluteRoot;
}

function parseEnv(contents, supportedKeys, legacyKeys) {
  const bytes = Buffer.isBuffer(contents) ? contents : Buffer.from(contents);
  if (bytes.length > maximumEnvBytes) throw new Error("Workspace .env is too large.");
  if (bytes.includes(0)) failInvalidEnv("NUL bytes are not allowed");

  const parsed = Object.create(null);
  const observedLegacyKeys = new Set();
  for (const line of bytes.toString("utf8").split(/\r?\n/u)) {
    if (line === "" || line.startsWith("#")) continue;
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/u.exec(line);
    if (!match) failInvalidEnv("only simple KEY=value lines are supported");
    const [, key, rawValue] = match;
    if (legacyKeys.has(key)) {
      observedLegacyKeys.add(key);
      continue;
    }
    if (!supportedKeys.has(key)) continue;
    if (Object.hasOwn(parsed, key)) failInvalidEnv("duplicate supported keys are not allowed");
    if (!safeEnvValuePattern.test(rawValue)) {
      failInvalidEnv("supported values use a closed grammar without shell syntax, quoting, interpolation, or continuations");
    }
    parsed[key] = rawValue;
  }
  return { parsed, observedLegacyKeys };
}

async function defaultReadFileChunk(handle, buffer, offset, length, position) {
  return handle.read(buffer, offset, length, position);
}

async function readBoundedHandle(handle, readChunkFn = defaultReadFileChunk) {
  const chunks = [];
  let total = 0;
  while (total <= maximumEnvBytes) {
    const length = Math.min(8192, maximumEnvBytes + 1 - total);
    const buffer = Buffer.alloc(length);
    const result = await readChunkFn(handle, buffer, 0, length, total);
    if (result === null || typeof result !== "object" || !Number.isInteger(result.bytesRead)
      || result.bytesRead < 0 || result.bytesRead > length) {
      throw new Error("Invalid bounded .env read adapter result.");
    }
    if (result.bytesRead === 0) break;
    chunks.push(buffer.subarray(0, result.bytesRead));
    total += result.bytesRead;
  }
  if (total > maximumEnvBytes) throw new Error("Workspace .env is too large.");
  return Buffer.concat(chunks, total);
}

function assertOpenedEnvIdentity(inspectedStats, openedStats, pathStats) {
  if (!openedStats.isFile() || pathStats.isSymbolicLink() || !pathStats.isFile()
    || !sameFileIdentity(inspectedStats, openedStats) || !sameFileIdentity(openedStats, pathStats)) {
    throw new Error("Workspace .env path identity changed during open.");
  }
}

function validateAdapters({ lstatFn, openFileFn, readFileFn }) {
  if (typeof lstatFn !== "function" || typeof openFileFn !== "function"
    || (readFileFn !== undefined && typeof readFileFn !== "function")) {
    throw new Error("Workspace environment file adapters must be functions.");
  }
}

export async function readWorkspaceEnv({
  workspaceRoot,
  env = process.env,
  supportedKeys,
  legacyKeys = [],
  lstatFn = lstat,
  openFileFn = open,
  readFileFn,
  platform = process.platform,
} = {}) {
  validateKeys(supportedKeys, "supportedKeys");
  validateKeys(legacyKeys, "legacyKeys");
  validateAdapters({ lstatFn, openFileFn, readFileFn });
  // Resolved before anything is opened so a host that cannot supply the guarantee fails before it
  // touches the workspace. On Windows the flag resolves to zero and the identity re-verification below
  // is what holds; see platform-file-hardening.mjs for why that is sound and what it costs.
  const noFollow = noFollowOpenFlag({ platform });

  const supportedKeySet = new Set(supportedKeys);
  const legacyKeySet = new Set(legacyKeys);
  const absoluteRoot = await inspectWorkspacePath(workspaceRoot, lstatFn);
  const envPath = path.join(absoluteRoot, ".env");
  const envStats = await lstatFn(envPath).catch((error) => {
    if (error?.code === "ENOENT") return undefined;
    throw error;
  });

  const warnings = [];
  const observedLegacyKeys = new Set();
  let fileValues = Object.create(null);
  if (envStats) {
    if (envStats.isSymbolicLink()) throw new Error("Workspace .env symlinks are not allowed.");
    if (!envStats.isFile()) throw new Error("Workspace .env must be a regular file.");
    if (envStats.size > maximumEnvBytes) throw new Error("Workspace .env is too large.");
    if (posixPermissionBitsMeaningful(platform) && (envStats.mode & 0o044) !== 0) {
      warnings.push({
        code: "insecure_permissions",
        path: ".env",
        message: "Workspace .env is readable by group or other users; restrict permissions.",
      });
    }

    let handle;
    try {
      handle = await openFileFn(envPath, constants.O_RDONLY | noFollow);
      if (handle === null || typeof handle !== "object" || typeof handle.stat !== "function"
        || typeof handle.read !== "function" || typeof handle.close !== "function") {
        throw new Error("Invalid workspace environment file handle.");
      }
      const openedStats = await handle.stat();
      const currentPathStats = await lstatFn(envPath);
      assertOpenedEnvIdentity(envStats, openedStats, currentPathStats);
      await inspectWorkspacePath(absoluteRoot, lstatFn);
      if (openedStats.size > maximumEnvBytes) throw new Error("Workspace .env is too large.");
      const contents = await readBoundedHandle(handle, readFileFn);
      const [finalOpenedStats, finalPathStats] = await Promise.all([handle.stat(), lstatFn(envPath)]);
      assertOpenedEnvIdentity(envStats, finalOpenedStats, finalPathStats);
      await inspectWorkspacePath(absoluteRoot, lstatFn);
      const parsed = parseEnv(contents, supportedKeySet, legacyKeySet);
      fileValues = parsed.parsed;
      for (const key of parsed.observedLegacyKeys) observedLegacyKeys.add(key);
    } catch (error) {
      if (error?.code === "ELOOP") throw new Error("Workspace .env symlinks are not allowed.", { cause: error });
      throw error;
    } finally {
      await handle?.close?.();
    }
  }

  for (const key of legacyKeySet) {
    if (Object.hasOwn(env ?? {}, key)) observedLegacyKeys.add(key);
  }

  const values = {};
  const sources = {};
  for (const key of supportedKeys) {
    const processValue = nonEmpty(env?.[key]);
    const fileValue = nonEmpty(fileValues[key]);
    if (processValue !== undefined) {
      values[key] = processValue;
      sources[key] = "environment";
    } else if (fileValue !== undefined) {
      values[key] = fileValue;
      sources[key] = ".env";
    } else {
      sources[key] = "unset";
    }
  }

  return { values, sources, warnings, legacyKeys: [...observedLegacyKeys].sort() };
}
