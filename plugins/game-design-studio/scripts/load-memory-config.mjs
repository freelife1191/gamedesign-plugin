import { readWorkspaceEnv } from "./lib/load-workspace-env.mjs";

const defaults = Object.freeze({
  enabled: true,
  scope: "project",
  maxItems: 5,
  candidateTtlDays: 30,
  gitMode: "local",
});

const supportedKeys = Object.freeze([
  "GAME_DESIGN_MEMORY_ENABLED",
  "GAME_DESIGN_MEMORY_SCOPE",
  "GAME_DESIGN_MEMORY_MAX_ITEMS",
  "GAME_DESIGN_MEMORY_CANDIDATE_TTL_DAYS",
  "GAME_DESIGN_MEMORY_GIT_MODE",
]);

const allowedScopes = new Set(["project", "workspace", "global"]);
const allowedGitModes = new Set(["local", "tracked"]);

function validationError(code, pathName, message) {
  return { code, path: pathName, message };
}

function warning(code, pathName, message) {
  return { code, path: pathName, message };
}

function integerInRange(value, minimum, maximum) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < minimum || value > maximum) return false;
  return true;
}

export function validateMemoryConfig(value) {
  const errors = [];
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, errors: [validationError("invalid_type", "", "Memory configuration must be an object.")] };
  }
  if (typeof value.enabled !== "boolean") {
    errors.push(validationError("invalid_enabled", "enabled", "Memory enabled must be a boolean."));
  }
  if (!allowedScopes.has(value.scope)) {
    errors.push(validationError("invalid_scope", "scope", "Memory scope is not allowed."));
  }
  if (!integerInRange(value.maxItems, 1, 10)) {
    errors.push(validationError("invalid_max_items", "maxItems", "Memory max items must be an integer between 1 and 10."));
  }
  if (!integerInRange(value.candidateTtlDays, 1, 365)) {
    errors.push(validationError("invalid_candidate_ttl_days", "candidateTtlDays", "Memory candidate TTL must be an integer between 1 and 365."));
  }
  if (!allowedGitModes.has(value.gitMode)) {
    errors.push(validationError("invalid_git_mode", "gitMode", "Memory git mode is not allowed."));
  }
  return { ok: errors.length === 0, errors };
}

function parseBoundedInteger(value, defaultValue, code, pathName, message, warnings) {
  if (value === undefined) return defaultValue;
  if (!/^\d+$/u.test(value)) {
    warnings.push(warning(code, pathName, message));
    return defaultValue;
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || !integerInRange(parsed, 1, pathName === "maxItems" ? 10 : 365)) {
    warnings.push(warning(code, pathName, message));
    return defaultValue;
  }
  return parsed;
}

export async function loadMemoryConfig({
  workspaceRoot,
  env = process.env,
  lstatFn,
  openFileFn,
  readFileFn,
} = {}) {
  const workspaceEnv = await readWorkspaceEnv({
    workspaceRoot,
    env,
    supportedKeys,
    lstatFn,
    openFileFn,
    readFileFn,
  });
  const warnings = [...workspaceEnv.warnings];
  const values = workspaceEnv.values;

  let enabled = defaults.enabled;
  if (values.GAME_DESIGN_MEMORY_ENABLED !== undefined) {
    if (values.GAME_DESIGN_MEMORY_ENABLED === "true") enabled = true;
    else if (values.GAME_DESIGN_MEMORY_ENABLED === "false") enabled = false;
    else {
      enabled = false;
      warnings.push(warning("invalid_enabled", "enabled", "Memory enabled must be true or false; memory was disabled."));
    }
  }

  const sources = {
    enabled: workspaceEnv.sources.GAME_DESIGN_MEMORY_ENABLED,
    scope: workspaceEnv.sources.GAME_DESIGN_MEMORY_SCOPE,
    maxItems: workspaceEnv.sources.GAME_DESIGN_MEMORY_MAX_ITEMS,
    candidateTtlDays: workspaceEnv.sources.GAME_DESIGN_MEMORY_CANDIDATE_TTL_DAYS,
    gitMode: workspaceEnv.sources.GAME_DESIGN_MEMORY_GIT_MODE,
  };

  if (!enabled) {
    return { ...defaults, enabled: false, sources, warnings };
  }

  let scope = defaults.scope;
  const rawScope = values.GAME_DESIGN_MEMORY_SCOPE;
  if (rawScope !== undefined) {
    if (allowedScopes.has(rawScope)) scope = rawScope;
    else warnings.push(warning("invalid_scope", "scope", "Memory scope is not allowed; project scope was used."));
  }

  const maxItems = parseBoundedInteger(
    values.GAME_DESIGN_MEMORY_MAX_ITEMS,
    defaults.maxItems,
    "invalid_max_items",
    "maxItems",
    "Memory max items is invalid; the default was used.",
    warnings,
  );
  const candidateTtlDays = parseBoundedInteger(
    values.GAME_DESIGN_MEMORY_CANDIDATE_TTL_DAYS,
    defaults.candidateTtlDays,
    "invalid_candidate_ttl_days",
    "candidateTtlDays",
    "Memory candidate TTL is invalid; the default was used.",
    warnings,
  );

  let gitMode = defaults.gitMode;
  const rawGitMode = values.GAME_DESIGN_MEMORY_GIT_MODE;
  if (rawGitMode !== undefined) {
    if (allowedGitModes.has(rawGitMode)) gitMode = rawGitMode;
    else warnings.push(warning("invalid_git_mode", "gitMode", "Memory git mode is not allowed; local mode was used."));
  }

  const config = { enabled, scope, maxItems, candidateTtlDays, gitMode, sources, warnings };
  const validation = validateMemoryConfig(config);
  if (!validation.ok) {
    const error = new Error("Invalid memory configuration.");
    error.validation = validation;
    throw error;
  }
  return config;
}

export function toPublicMemoryConfig(config) {
  return {
    enabled: config.enabled,
    scope: config.scope,
    maxItems: config.maxItems,
    candidateTtlDays: config.candidateTtlDays,
    gitMode: config.gitMode,
    sources: { ...config.sources },
    warnings: [...config.warnings],
  };
}
