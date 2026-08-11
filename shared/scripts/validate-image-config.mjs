import { constants } from "node:fs";
import { lstat, open } from "node:fs/promises";
import path from "node:path";

const supportedKeys = Object.freeze({
  IMAGE_GEN_MODE: "mode",
  IMAGE_MODEL: "model",
  IMAGE_QUALITY: "quality",
  IMAGE_REQUEST_TIMEOUT_MS: "requestTimeoutMs",
  OPENAI_API_KEY: "apiKey",
});
const legacyKeys = new Set(["IMAGE_GEN_ENABLE", "IMAGE_GENERATOR"]);
const allowedModes = new Set(["required", "all", "select", "prompt-only"]);
const allowedQualities = new Set(["low", "medium", "high", "auto"]);
const safeModelPattern = /^[A-Za-z0-9](?:[A-Za-z0-9._:-]{0,127})$/u;
const safeSecretPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,511}$/u;
const safeEnvValuePattern = /^[\t ]*[A-Za-z0-9._:-]*[\t ]*$/u;
const maximumEnvBytes = 64 * 1024;
const defaults = Object.freeze({ mode: "prompt-only", model: "gpt-image-2", quality: "low", requestTimeoutMs: "30000" });

function validationError(code, pathName, message) {
  return { code, path: pathName, message };
}

export function validateImageConfig(value) {
  const errors = [];
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, errors: [validationError("invalid_type", "", "Image configuration must be an object.")] };
  }
  if (!allowedModes.has(value.mode)) {
    errors.push(validationError("invalid_mode", "mode", "Image generation mode is not allowed."));
  }
  if (typeof value.model !== "string" || !safeModelPattern.test(value.model)) {
    errors.push(validationError("invalid_model", "model", "Image model identifier is not safe."));
  }
  if (!allowedQualities.has(value.quality)) {
    errors.push(validationError("invalid_quality", "quality", "Image quality is not allowed."));
  }
  if (value.requestTimeoutMs !== undefined && (!Number.isInteger(value.requestTimeoutMs) || value.requestTimeoutMs < 1_000 || value.requestTimeoutMs > 120_000)) {
    errors.push(validationError("invalid_request_timeout", "requestTimeoutMs", "Image request timeout must be a bounded millisecond integer."));
  }
  if (value.apiKey !== undefined && (typeof value.apiKey !== "string" || !safeSecretPattern.test(value.apiKey))) {
    errors.push(validationError("invalid_api_key", "apiKey", "OpenAI API key contains unsupported characters."));
  }
  return { ok: errors.length === 0, errors };
}

function failInvalidEnv(reason) {
  throw new Error(`Invalid .env: ${reason}.`);
}

function parseEnv(contents) {
  const bytes = Buffer.isBuffer(contents) ? contents : Buffer.from(contents);
  if (bytes.length > maximumEnvBytes) throw new Error("Workspace .env is too large.");
  if (bytes.includes(0)) failInvalidEnv("NUL bytes are not allowed");

  const parsed = Object.create(null);
  const legacy = new Set();
  for (const line of bytes.toString("utf8").split(/\r?\n/u)) {
    if (line === "" || line.startsWith("#")) continue;
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/u.exec(line);
    if (!match) failInvalidEnv("only simple KEY=value lines are supported");
    const [, key, rawValue] = match;
    if (legacyKeys.has(key)) {
      legacy.add(key);
      continue;
    }
    if (!Object.hasOwn(supportedKeys, key)) continue;
    if (Object.hasOwn(parsed, key)) failInvalidEnv("duplicate supported keys are not allowed");
    if (!safeEnvValuePattern.test(rawValue)) {
      failInvalidEnv("supported values use a closed grammar without shell syntax, quoting, interpolation, or continuations");
    }
    parsed[key] = rawValue;
  }
  return { parsed, legacy };
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

function migrationWarnings(keys) {
  return [...keys].sort().map((key) => `${key} is deprecated; migrate to IMAGE_GEN_MODE.`);
}

function nonEmpty(value) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function sameFileIdentity(left, right) {
  return left.dev === right.dev && left.ino === right.ino;
}

async function defaultReadFileChunk(handle, buffer, offset, length, position) {
  return handle.read(buffer, offset, length, position);
}

async function readBoundedHandle(handle, readFileFn) {
  const chunks = [];
  let total = 0;
  while (total <= maximumEnvBytes) {
    const length = Math.min(8192, maximumEnvBytes + 1 - total);
    const buffer = Buffer.alloc(length);
    const result = await readFileFn(handle, buffer, 0, length, total);
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

export async function loadImageConfig({
  workspaceRoot,
  env = process.env,
  readFileFn,
  lstatFn = lstat,
  openFileFn = open,
} = {}) {
  const absoluteRoot = await inspectWorkspacePath(workspaceRoot, lstatFn);
  const envPath = path.join(absoluteRoot, ".env");
  const envStats = await lstatFn(envPath).catch((error) => {
    if (error?.code === "ENOENT") return undefined;
    throw error;
  });

  let fileValues = Object.create(null);
  const warningKeys = new Set();
  const warnings = [];
  if (envStats) {
    if (envStats.isSymbolicLink()) throw new Error("Workspace .env symlinks are not allowed.");
    if (!envStats.isFile()) throw new Error("Workspace .env must be a regular file.");
    if (envStats.size > maximumEnvBytes) throw new Error("Workspace .env is too large.");
    if ((envStats.mode & 0o044) !== 0) warnings.push("Workspace .env is readable by group or other users; restrict permissions.");
    if (typeof openFileFn !== "function" || typeof lstatFn !== "function"
      || (readFileFn !== undefined && typeof readFileFn !== "function")) {
      throw new Error("Image configuration file adapters must be functions.");
    }
    if (!Number.isInteger(constants.O_NOFOLLOW)) throw new Error("Secure no-follow file opening is unavailable.");

    let handle;
    try {
      handle = await openFileFn(envPath, constants.O_RDONLY | constants.O_NOFOLLOW);
      if (handle === null || typeof handle !== "object" || typeof handle.stat !== "function"
        || typeof handle.read !== "function" || typeof handle.close !== "function") {
        throw new Error("Invalid image configuration file handle.");
      }
      const openedStats = await handle.stat();
      const currentPathStats = await lstatFn(envPath);
      assertOpenedEnvIdentity(envStats, openedStats, currentPathStats);
      await inspectWorkspacePath(absoluteRoot, lstatFn);
      if (openedStats.size > maximumEnvBytes) throw new Error("Workspace .env is too large.");
      const contents = readFileFn === undefined
        ? await readBoundedHandle(handle, defaultReadFileChunk)
        : await readFileFn(envPath);
      if (!Buffer.isBuffer(contents) && typeof contents !== "string") {
        throw new Error("Invalid image configuration read adapter result.");
      }
      const [finalOpenedStats, finalPathStats] = await Promise.all([handle.stat(), lstatFn(envPath)]);
      assertOpenedEnvIdentity(envStats, finalOpenedStats, finalPathStats);
      await inspectWorkspacePath(absoluteRoot, lstatFn);
      const parsedFile = parseEnv(contents);
      fileValues = parsedFile.parsed;
      for (const key of parsedFile.legacy) warningKeys.add(key);
    } catch (error) {
      if (error?.code === "ELOOP") throw new Error("Workspace .env symlinks are not allowed.", { cause: error });
      throw error;
    } finally {
      await handle?.close?.();
    }
  }
  for (const key of legacyKeys) {
    if (Object.hasOwn(env ?? {}, key)) warningKeys.add(key);
  }

  const sources = {};
  const resolved = {};
  for (const [key, field] of Object.entries(supportedKeys)) {
    const processValue = nonEmpty(env?.[key]);
    const fileValue = nonEmpty(fileValues[key]);
    if (processValue !== undefined) {
      resolved[field] = processValue;
      sources[field] = "environment";
    } else if (fileValue !== undefined) {
      resolved[field] = fileValue;
      sources[field] = ".env";
    } else if (field === "apiKey") {
      resolved.apiKey = undefined;
      sources.apiKey = "none";
    } else {
      resolved[field] = defaults[field];
      sources[field] = "default";
    }
  }

  const rawTimeout = resolved.requestTimeoutMs;
  if (typeof rawTimeout !== "string" || !/^\d+$/u.test(rawTimeout)) {
    const error = new Error("Invalid image configuration.");
    error.validation = { ok: false, errors: [validationError("invalid_request_timeout", "requestTimeoutMs", "Image request timeout must be a bounded millisecond integer.")] };
    throw error;
  }
  resolved.requestTimeoutMs = Number(rawTimeout);
  delete sources.requestTimeoutMs;

  const validation = validateImageConfig(resolved);
  if (!validation.ok) {
    const error = new Error("Invalid image configuration.");
    error.validation = validation;
    throw error;
  }

  return {
    mode: resolved.mode,
    model: resolved.model,
    quality: resolved.quality,
    requestTimeoutMs: resolved.requestTimeoutMs,
    apiKey: resolved.apiKey,
    apiKeyPresent: resolved.apiKey !== undefined,
    sources,
    warnings: [...warnings, ...migrationWarnings(warningKeys)],
  };
}

export function toPublicImageConfig(config) {
  return {
    mode: config.mode,
    model: config.model,
    quality: config.quality,
    apiKeyPresent: config.apiKeyPresent,
    sources: { ...config.sources },
    warnings: [...config.warnings],
  };
}
