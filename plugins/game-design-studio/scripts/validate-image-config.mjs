import { readWorkspaceEnv } from "./lib/load-workspace-env.mjs";

const supportedKeys = Object.freeze({
  IMAGE_GEN_MODE: "mode",
  IMAGE_MODEL: "model",
  IMAGE_QUALITY: "quality",
  IMAGE_REQUEST_TIMEOUT_MS: "requestTimeoutMs",
  OPENAI_API_KEY: "apiKey",
});
const legacyKeys = Object.freeze(["IMAGE_GEN_ENABLE", "IMAGE_GENERATOR"]);
const allowedModes = new Set(["required", "all", "select", "prompt-only"]);
const allowedQualities = new Set(["low", "medium", "high", "auto"]);
const safeModelPattern = /^[A-Za-z0-9](?:[A-Za-z0-9._:-]{0,127})$/u;
const safeSecretPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,511}$/u;
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

function migrationWarnings(keys) {
  return [...keys].sort().map((key) => `${key} is deprecated; migrate to IMAGE_GEN_MODE.`);
}

export async function loadImageConfig({
  workspaceRoot,
  env = process.env,
  readFileFn,
  lstatFn,
  openFileFn,
} = {}) {
  const workspaceEnv = await readWorkspaceEnv({
    workspaceRoot,
    env,
    supportedKeys: Object.keys(supportedKeys),
    legacyKeys,
    readFileFn,
    lstatFn,
    openFileFn,
  });

  const sources = {};
  const resolved = {};
  for (const [key, field] of Object.entries(supportedKeys)) {
    const value = workspaceEnv.values[key];
    if (value !== undefined) {
      resolved[field] = value;
      sources[field] = workspaceEnv.sources[key];
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
    warnings: [
      ...workspaceEnv.warnings.map((warning) => warning.message),
      ...migrationWarnings(workspaceEnv.legacyKeys),
    ],
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
