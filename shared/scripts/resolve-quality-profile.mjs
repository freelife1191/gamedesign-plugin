import { lstat, readFile } from "node:fs/promises";
import path from "node:path";

import { validateQualityProfile } from "./validate-quality-profile.mjs";

const stableIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const removalKeyPattern = /^(?:remove(?:_|$)|.*_removals?$)/u;

function clone(value) {
  return structuredClone(value);
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function hasRemovalDirective(value) {
  if (!value || typeof value !== "object") return false;
  if (!Array.isArray(value) && Object.keys(value).some((key) => removalKeyPattern.test(key))) return true;
  return Object.values(value).some(hasRemovalDirective);
}

function entryKey(value) {
  if (value && typeof value === "object" && typeof value.id === "string") return `id:${value.id}`;
  return `value:${JSON.stringify(value)}`;
}

function mergeArray(target, additions) {
  const result = clone(target);
  const seen = new Set(result.map(entryKey));
  for (const addition of additions) {
    const key = entryKey(addition);
    if (!seen.has(key)) {
      result.push(clone(addition));
      seen.add(key);
    }
  }
  return result;
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function mergeObject(target, incoming, basePath, source, conflicts) {
  for (const [key, value] of Object.entries(incoming)) {
    const itemPath = `${basePath}/${key}`;
    if (!Object.hasOwn(target, key)) {
      target[key] = clone(value);
    } else if (Array.isArray(target[key]) && Array.isArray(value)) {
      target[key] = mergeArray(target[key], value);
    } else if (isObject(target[key]) && isObject(value)) {
      mergeObject(target[key], value, itemPath, source, conflicts);
    } else if (JSON.stringify(target[key]) !== JSON.stringify(value)) {
      conflicts.push({ path: itemPath, primary: clone(target[key]), incoming: clone(value), source });
    }
  }
}

export function composeQualityProfile({ primary, overlays = [], preset = null }) {
  if (!primary || typeof primary !== "object" || Array.isArray(primary)) throw new Error("primary profile must be an object");
  if (!Array.isArray(overlays)) throw new Error("overlays must be an array");
  const sources = [...overlays, ...(preset === null ? [] : [preset])];
  for (const source of sources) {
    if (!source || typeof source !== "object" || Array.isArray(source)) throw new Error("composed profile source must be an object");
    if (hasRemovalDirective(source)) throw new Error(`Removal directive is not allowed in ${String(source.profile_id ?? "profile source")}`);
  }

  const profile = clone(primary);
  const conflicts = [];
  for (const source of sources) {
    const additions = Object.fromEntries(Object.entries(source).filter(([key]) => key !== "profile_id" && key !== "version"));
    mergeObject(profile, additions, "", source.profile_id ?? "anonymous", conflicts);
  }
  return deepFreeze({
    profile,
    provenance: {
      primary: primary.profile_id,
      overlays: overlays.map(({ profile_id }) => profile_id),
      preset: preset?.profile_id ?? null,
    },
    conflicts,
  });
}

async function assertSafeFile(root, relativePath) {
  let cursor = path.resolve(root);
  const rootStats = await lstat(cursor);
  if (rootStats.isSymbolicLink() || !rootStats.isDirectory()) throw new Error("plugin root must be a non-symlink directory");
  const parsed = path.parse(cursor);
  let ancestor = parsed.root;
  const rootSegments = path.relative(parsed.root, cursor).split(path.sep);
  for (let index = 0; index < rootSegments.length; index += 1) {
    ancestor = path.join(ancestor, rootSegments[index]);
    if (index > 0 && (await lstat(ancestor)).isSymbolicLink()) throw new Error("plugin root contains a symlink ancestor");
  }
  for (const segment of relativePath.split("/")) {
    cursor = path.join(cursor, segment);
    const stats = await lstat(cursor).catch((error) => {
      if (error.code === "ENOENT") throw new Error(`Missing quality profile: ${relativePath}`);
      throw error;
    });
    if (stats.isSymbolicLink()) throw new Error(`Symlink is not allowed in quality profile path: ${relativePath}`);
  }
  if (!(await lstat(cursor)).isFile()) throw new Error(`Quality profile is not a file: ${relativePath}`);
  return cursor;
}

export async function loadQualityProfile({ pluginRoot, profileId }) {
  if (typeof pluginRoot !== "string") throw new Error("pluginRoot must be a path");
  if (typeof profileId !== "string" || !stableIdPattern.test(profileId)) throw new Error(`Invalid quality profile ID: ${String(profileId)}`);
  const relativePath = `references/quality-profiles/${profileId}.json`;
  const filePath = await assertSafeFile(pluginRoot, relativePath);
  let value;
  try {
    value = JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    throw new Error(`Invalid quality profile JSON: ${error.message}`, { cause: error });
  }
  const validation = validateQualityProfile(value, { sourceName: relativePath });
  if (!validation.ok) {
    const details = validation.errors.map(({ code, path: errorPath, message }) => `${errorPath || "/"} [${code}] ${message}`).join("; ");
    throw new Error(`Invalid quality profile ${profileId}: ${details}`);
  }
  return deepFreeze(clone(value));
}
