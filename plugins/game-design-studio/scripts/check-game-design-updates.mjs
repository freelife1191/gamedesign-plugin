#!/usr/bin/env node

import { constants } from "node:fs";
import * as fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { homedir } from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
  createDisabledUpdateAdvisory,
  evaluateUpdateAdvisory,
} from "./lib/update-advisory.mjs";

const CACHE_FILE = "update-advisory-v1.json";
const CACHE_DIRECTORY = "game-design-suite";
const CACHE_KEYS = Object.freeze([
  "schemaVersion",
  "checkedAt",
  "status",
  "components",
  "lastNotifiedAt",
  "lastNotifiedComponents",
]);
const CACHE_COMPONENT_KEYS = Object.freeze(["id", "installedTag", "latestTag", "status", "releaseUrl"]);
const NOTIFICATION_IDENTITY_KEYS = Object.freeze(["id", "installedTag", "latestTag"]);
const LOCK_METADATA_KEYS = Object.freeze(["schemaVersion", "owner", "createdAt"]);
const LOCK_METADATA_FILE = "owner.json";
const LOCK_OWNER = /^game-design-update-check:(?<pid>[1-9]\d*)-[0-9A-Za-z-]+$/u;
const INSTALLED_COMPONENT_KEYS = Object.freeze(["id", "repository", "installedTag", "commit"]);
const RELEASE_ENDPOINTS = Object.freeze({
  skillstead: "https://api.github.com/repos/kyungseo/skillstead/releases",
  archify: "https://api.github.com/repos/tt-a1i/archify/releases",
  "im-not-ai": "https://api.github.com/repos/epoko77-ai/im-not-ai/releases",
});
const LOCK_WAIT_MS = 25;
const LOCK_MAX_WAIT_MS = 1000;
const LOCK_MIN_LEASE_MS = 30_000;

function hasExactKeys(value, keys) {
  if (value === null || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) return false;
  const ownKeys = Reflect.ownKeys(value);
  return ownKeys.length === keys.length
    && ownKeys.every((key) => typeof key === "string" && keys.includes(key))
    && keys.every((key) => {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      return descriptor?.enumerable === true && Object.hasOwn(descriptor, "value");
    });
}

function iso(now) {
  const date = new Date(now);
  if (Number.isNaN(date.valueOf())) throw new TypeError("now must be a valid timestamp");
  return date.toISOString();
}

function sameFile(left, right) {
  return left.dev === right.dev && left.ino === right.ino;
}

function publicResult({ advisory, cache, notification = null }) {
  const result = {
    schemaVersion: 1,
    checkedAt: advisory.checkedAt,
    cache,
    status: advisory.status,
    components: advisory.components.map((component) => ({ ...component })),
    notification,
  };
  return Object.freeze({
    ...result,
    components: Object.freeze(result.components.map(Object.freeze)),
    notification: notification === null ? null : Object.freeze({ ...notification, componentIds: Object.freeze([...notification.componentIds]) }),
  });
}

function unknownResult({ checkedAt, cache, installed = [] }) {
  const advisory = evaluateUpdateAdvisory({ policy: null, installed, releases: null, checkedAt });
  return publicResult({ advisory, cache });
}

function notificationIdentityFor(advisory) {
  return advisory.components
    .filter(({ status }) => status === "outdated")
    .map(({ id, installedTag, latestTag }) => ({ id, installedTag, latestTag }))
    .sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0);
}

function sameNotificationIdentity(left, right) {
  return Array.isArray(left) && Array.isArray(right) && recordsMatch(left, right);
}

function notificationFor(advisory, previousIdentity = []) {
  const identity = notificationIdentityFor(advisory);
  if (identity.length === 0 || sameNotificationIdentity(identity, previousIdentity)) return null;
  return Object.freeze({
    kind: "update-available",
    prompt: "플러그인 업데이트를 확인해 줘",
    componentIds: Object.freeze(identity.map(({ id }) => id)),
  });
}

function cacheRecord({ advisory, notification, now, previous }) {
  const identity = notificationIdentityFor(advisory);
  const preserveClaim = notification === null
    && identity.length > 0
    && sameNotificationIdentity(identity, previous?.lastNotifiedComponents)
    && typeof previous?.lastNotifiedAt === "string";
  return {
    schemaVersion: 1,
    checkedAt: advisory.checkedAt,
    status: advisory.status,
    components: advisory.components.map((component) => ({ ...component })),
    lastNotifiedAt: notification === null ? (preserveClaim ? previous.lastNotifiedAt : null) : now,
    lastNotifiedComponents: notification === null
      ? (preserveClaim ? previous.lastNotifiedComponents.map((component) => ({ ...component })) : [])
      : identity,
  };
}

function recordsMatch(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function cacheAdvisory(record, policy, installed, now) {
  if (!hasExactKeys(record, CACHE_KEYS)
    || record.schemaVersion !== 1
    || typeof record.checkedAt !== "string"
    || !["current", "outdated"].includes(record.status)
    || !Array.isArray(record.components)
    || !(record.lastNotifiedAt === null || typeof record.lastNotifiedAt === "string")
    || !Array.isArray(record.lastNotifiedComponents)
    || !record.lastNotifiedComponents.every((component) => hasExactKeys(component, NOTIFICATION_IDENTITY_KEYS)
      && typeof component.id === "string"
      && typeof component.installedTag === "string"
      && typeof component.latestTag === "string")) return null;
  if (!record.components.every((component) => hasExactKeys(component, CACHE_COMPONENT_KEYS))) return null;
  const releases = {};
  for (const component of record.components) {
    if (component.latestTag === null || typeof component.latestTag !== "string" || typeof component.releaseUrl !== "string") return null;
    releases[component.id] = [{
      tag: component.latestTag,
      draft: false,
      prerelease: false,
      url: component.releaseUrl,
    }];
  }
  let advisory;
  try {
    advisory = evaluateUpdateAdvisory({ policy, installed, releases, checkedAt: record.checkedAt });
  } catch {
    return null;
  }
  if (advisory.status === "unknown" || advisory.status !== record.status || !recordsMatch(advisory.components, record.components)) return null;
  const identity = notificationIdentityFor(advisory);
  if (identity.length === 0) {
    if (record.lastNotifiedComponents.length !== 0 || record.lastNotifiedAt !== null) return null;
    return advisory;
  }
  if (record.lastNotifiedComponents.length === 0) return record.lastNotifiedAt === null ? advisory : null;
  if (!sameNotificationIdentity(record.lastNotifiedComponents, identity) || typeof record.lastNotifiedAt !== "string") return null;
  const notifiedAt = new Date(record.lastNotifiedAt);
  const checkedAt = new Date(record.checkedAt);
  if (Number.isNaN(notifiedAt.valueOf())
    || notifiedAt.toISOString() !== record.lastNotifiedAt
    || notifiedAt.valueOf() < checkedAt.valueOf()
    || notifiedAt.valueOf() > now) return null;
  return advisory;
}

function cacheIsFresh(record, now, intervalMs) {
  const checkedAt = Date.parse(record.checkedAt);
  const age = now - checkedAt;
  if (!Number.isFinite(checkedAt) || age < 0 || age >= intervalMs) return false;
  return true;
}

async function readRegularJson(cachePath, fsOps) {
  let before;
  try {
    before = await fsOps.lstat(cachePath);
  } catch (error) {
    if (error?.code === "ENOENT") return { state: "missing" };
    return { state: "invalid" };
  }
  if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1) return { state: "unsafe" };
  let handle;
  try {
    handle = await fsOps.open(cachePath, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    const opened = await handle.stat();
    if (!opened.isFile() || opened.nlink !== 1 || !sameFile(before, opened) || opened.size > 1024 * 1024) return { state: "invalid" };
    const text = await handle.readFile({ encoding: "utf8" });
    return { state: "present", value: JSON.parse(text) };
  } catch {
    return { state: "invalid" };
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

async function readCache({ cachePath, fsOps, policy, installed, now, intervalMs }) {
  const loaded = await readRegularJson(cachePath, fsOps);
  if (loaded.state !== "present") return { state: loaded.state, record: null, advisory: null, fresh: false };
  const advisory = cacheAdvisory(loaded.value, policy, installed, now);
  if (advisory === null) return { state: "invalid", record: null, advisory: null, fresh: false };
  return {
    state: "valid",
    record: loaded.value,
    advisory,
    fresh: cacheIsFresh(loaded.value, now, intervalMs),
  };
}

async function ensureCacheDirectory(cachePath, fsOps) {
  try {
    await fsOps.mkdir(path.dirname(cachePath), { recursive: true, mode: 0o700 });
    const info = await fsOps.lstat(path.dirname(cachePath));
    return info.isDirectory() && !info.isSymbolicLink();
  } catch {
    return false;
  }
}

function validLockMetadata(value) {
  if (!hasExactKeys(value, LOCK_METADATA_KEYS)
    || value.schemaVersion !== 1
    || typeof value.owner !== "string"
    || !LOCK_OWNER.test(value.owner)
    || typeof value.createdAt !== "string") return false;
  const createdAt = new Date(value.createdAt);
  return !Number.isNaN(createdAt.valueOf()) && createdAt.toISOString() === value.createdAt;
}

async function inspectOwnedLock(lockPath, fsOps) {
  let entry;
  try {
    entry = await fsOps.lstat(lockPath);
    if (entry.isFile() && !entry.isSymbolicLink() && entry.nlink === 1) {
      const loaded = await readRegularJson(lockPath, fsOps);
      const after = await fsOps.lstat(lockPath);
      if (!sameFile(entry, after) || loaded.state !== "present" || !validLockMetadata(loaded.value)) return null;
      return { kind: "file", entry, metadata: loaded.value };
    }
    if (!entry.isDirectory() || entry.isSymbolicLink()) return null;
    const entries = await fsOps.readdir(lockPath);
    if (entries.length !== 1 || entries[0] !== LOCK_METADATA_FILE) return null;
    const loaded = await readRegularJson(path.join(lockPath, LOCK_METADATA_FILE), fsOps);
    const after = await fsOps.lstat(lockPath);
    if (!sameFile(entry, after) || loaded.state !== "present" || !validLockMetadata(loaded.value)) return null;
    return { kind: "directory", entry, metadata: loaded.value };
  } catch {
    return null;
  }
}

function sameLock(lock, inspected) {
  return inspected !== null
    && inspected.kind === lock.kind
    && sameFile(inspected.entry, lock.entry)
    && inspected.metadata.owner === lock.owner;
}

async function removeOwnedLock({ lockPath, kind, entry, owner }, fsOps) {
  const inspected = await inspectOwnedLock(lockPath, fsOps);
  if (!sameLock({ kind, entry, owner }, inspected)) return false;
  const quarantinePath = `${lockPath}.release.${process.pid}.${randomUUID()}`;
  try {
    await fsOps.rename(lockPath, quarantinePath);
    const moved = await inspectOwnedLock(quarantinePath, fsOps);
    if (!sameLock({ kind, entry, owner }, moved)) return false;
    if (kind === "file") {
      await fsOps.unlink(quarantinePath);
    } else {
      await fsOps.unlink(path.join(quarantinePath, LOCK_METADATA_FILE));
      await fsOps.rmdir(quarantinePath);
    }
    return true;
  } catch {
    return false;
  }
}

async function reclaimStaleLock(lockPath, fsOps, leaseMs) {
  const inspected = await inspectOwnedLock(lockPath, fsOps);
  if (inspected === null) return false;
  const age = Date.now() - Date.parse(inspected.metadata.createdAt);
  if (!Number.isFinite(age) || age < leaseMs) return false;
  const ownerPid = Number(LOCK_OWNER.exec(inspected.metadata.owner)?.groups?.pid);
  if (!Number.isSafeInteger(ownerPid)) return false;
  try {
    process.kill(ownerPid, 0);
    return false;
  } catch (error) {
    if (error?.code !== "ESRCH") return false;
  }
  return removeOwnedLock({ lockPath, kind: inspected.kind, entry: inspected.entry, owner: inspected.metadata.owner }, fsOps);
}

async function inspectStaleEmptyLegacyLock(lockPath, fsOps) {
  try {
    const directory = await fsOps.lstat(lockPath);
    if (!directory.isDirectory() || directory.isSymbolicLink()) return null;
    if ((await fsOps.readdir(lockPath)).length !== 0) return null;
    const after = await fsOps.lstat(lockPath);
    return sameFile(directory, after) ? { directory } : null;
  } catch {
    return null;
  }
}

async function reclaimStaleEmptyLegacyLock(lockPath, fsOps, leaseMs) {
  const inspected = await inspectStaleEmptyLegacyLock(lockPath, fsOps);
  if (inspected === null || !Number.isFinite(inspected.directory.mtimeMs) || Date.now() - inspected.directory.mtimeMs < leaseMs) return false;
  const quarantinePath = `${lockPath}.legacy-empty.${process.pid}.${randomUUID()}`;
  try {
    const current = await inspectStaleEmptyLegacyLock(lockPath, fsOps);
    if (current === null || !sameFile(current.directory, inspected.directory)) return false;
    await fsOps.rename(lockPath, quarantinePath);
    const moved = await inspectStaleEmptyLegacyLock(quarantinePath, fsOps);
    if (moved === null || !sameFile(moved.directory, inspected.directory)) return false;
    await fsOps.rmdir(quarantinePath);
    return true;
  } catch {
    return false;
  }
}

async function discardStagingLock({ stagingPath, entry }, fsOps) {
  const quarantinePath = `${stagingPath}.cleanup.${process.pid}.${randomUUID()}`;
  try {
    const current = await fsOps.lstat(stagingPath);
    if (!current.isFile() || current.isSymbolicLink() || !sameFile(current, entry)) return false;
    await fsOps.rename(stagingPath, quarantinePath);
    const moved = await fsOps.lstat(quarantinePath);
    if (!moved.isFile() || moved.isSymbolicLink() || !sameFile(moved, entry)) return false;
    await fsOps.unlink(quarantinePath);
    return true;
  } catch {
    return false;
  }
}

async function createOwnedLock(lockPath, fsOps) {
  const owner = `game-design-update-check:${process.pid}-${randomUUID()}`;
  const stagingPath = `${lockPath}.staging.${process.pid}.${randomUUID()}`;
  let entry;
  let handle;
  try {
    handle = await fsOps.open(stagingPath, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | (constants.O_NOFOLLOW ?? 0), 0o600);
    entry = await handle.stat();
    if (!entry.isFile() || entry.nlink !== 1) throw new Error("unsafe staging lock");
    await handle.writeFile(`${JSON.stringify({ schemaVersion: 1, owner, createdAt: new Date().toISOString() })}\n`, { encoding: "utf8" });
    await handle.sync();
    await handle.close();
    handle = null;
    const staged = await inspectOwnedLock(stagingPath, fsOps);
    if (!sameLock({ kind: "file", entry, owner }, staged)) throw new Error("unsafe staging metadata");
    await fsOps.link(stagingPath, lockPath);
    if (!(await discardStagingLock({ stagingPath, entry }, fsOps))) throw new Error("unsafe staging cleanup");
    const inspected = await inspectOwnedLock(lockPath, fsOps);
    if (!sameLock({ kind: "file", entry, owner }, inspected)) throw new Error("unsafe lock metadata");
    return { lockPath, kind: "file", entry, owner };
  } catch (error) {
    await handle?.close().catch(() => undefined);
    if (entry !== undefined) await discardStagingLock({ stagingPath, entry }, fsOps);
    if (error?.code === "EEXIST") return null;
    throw error;
  }
}

async function acquireLock(lockPath, fsOps, leaseMs) {
  const created = await createOwnedLock(lockPath, fsOps);
  if (created !== null) return created;
  if (!(await reclaimStaleLock(lockPath, fsOps, leaseMs))
    && !(await reclaimStaleEmptyLegacyLock(lockPath, fsOps, leaseMs))) return null;
  return createOwnedLock(lockPath, fsOps);
}

async function releaseLock(lock, fsOps) {
  if (lock !== null && lock !== undefined) await removeOwnedLock(lock, fsOps);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForCache({ cachePath, fsOps, policy, installed, now, intervalMs }) {
  const deadline = Date.now() + LOCK_MAX_WAIT_MS;
  while (Date.now() < deadline) {
    await sleep(LOCK_WAIT_MS);
    const cached = await readCache({ cachePath, fsOps, policy, installed, now, intervalMs });
    if (cached.fresh) return cached;
  }
  return null;
}

async function claimFreshNotification({ cachePath, fsOps, policy, installed, now, intervalMs, lockLeaseMs }) {
  const lockPath = `${cachePath}.lock`;
  let locked;
  try {
    locked = await acquireLock(lockPath, fsOps, lockLeaseMs);
  } catch {
    return null;
  }
  if (!locked) {
    const winner = await waitForCache({ cachePath, fsOps, policy, installed, now, intervalMs });
    return winner === null ? null : { advisory: winner.advisory, notification: null };
  }
  try {
    const cached = await readCache({ cachePath, fsOps, policy, installed, now, intervalMs });
    if (!cached.fresh) return null;
    const notification = notificationFor(cached.advisory, cached.record.lastNotifiedComponents);
    if (notification === null) return { advisory: cached.advisory, notification: null };
    const record = cacheRecord({ advisory: cached.advisory, notification, now: iso(now), previous: cached.record });
    if (!(await publishCache({ cachePath, record, fsOps }))) return null;
    return { advisory: cached.advisory, notification };
  } finally {
    await releaseLock(locked, fsOps);
  }
}

function trustedEndpointFor(component) {
  return RELEASE_ENDPOINTS[component.id] ?? null;
}

async function fetchReleases({ installed, fetchFn, signal, timeout }) {
  const releases = {};
  for (const component of installed) {
    const endpoint = trustedEndpointFor(component);
    if (endpoint === null) throw new Error("untrusted component");
    const response = await Promise.race([
      Promise.resolve(fetchFn(endpoint, {
        method: "GET",
        redirect: "error",
        signal,
        headers: { Accept: "application/vnd.github+json" },
      })),
      timeout,
    ]);
    if (response === null || typeof response !== "object" || response.ok !== true || response.status !== 200 || response.url !== endpoint || typeof response.json !== "function") {
      throw new Error("untrusted response");
    }
    const body = await Promise.race([Promise.resolve(response.json()), timeout]);
    if (!Array.isArray(body)) throw new Error("malformed release response");
    const projected = [];
    for (const release of body) {
      if (release === null || typeof release !== "object" || Array.isArray(release)
        || typeof release.tag_name !== "string"
        || typeof release.draft !== "boolean"
        || typeof release.prerelease !== "boolean"
        || typeof release.html_url !== "string") throw new Error("malformed release evidence");
      projected.push({
        tag: release.tag_name,
        draft: release.draft,
        prerelease: release.prerelease,
        url: release.html_url,
      });
    }
    releases[component.id] = projected;
  }
  return releases;
}

async function publishCache({ cachePath, record, fsOps }) {
  const existing = await readRegularJson(cachePath, fsOps);
  if (existing.state === "unsafe") return false;
  const temporaryPath = `${cachePath}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`;
  let handle;
  try {
    handle = await fsOps.open(temporaryPath, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | (constants.O_NOFOLLOW ?? 0), 0o600);
    await handle.writeFile(`${JSON.stringify(record)}\n`, { encoding: "utf8" });
    await handle.sync();
    await handle.close();
    handle = null;
    await fsOps.rename(temporaryPath, cachePath);
    return true;
  } catch {
    return false;
  } finally {
    await handle?.close().catch(() => undefined);
    await fsOps.rm(temporaryPath, { force: true }).catch(() => undefined);
  }
}

async function loadJson(pluginRoot, filename, fsOps) {
  for (const relativeDirectory of ["references/shared/updates", "shared/updates"]) {
    try {
      return JSON.parse(await fsOps.readFile(path.join(pluginRoot, relativeDirectory, filename), "utf8"));
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
  throw new Error(`missing update configuration: ${filename}`);
}

function installedFromManifest(manifest) {
  if (!hasExactKeys(manifest, ["schemaVersion", "components"]) || manifest.schemaVersion !== 1 || !Array.isArray(manifest.components)) return null;
  if (manifest.components.length !== Object.keys(RELEASE_ENDPOINTS).length) return null;
  if (!manifest.components.every((component) => hasExactKeys(component, INSTALLED_COMPONENT_KEYS)
    && typeof component.id === "string"
    && typeof component.repository === "string"
    && typeof component.installedTag === "string"
    && typeof component.commit === "string"
    && /^[0-9a-f]{40}$/u.test(component.commit))) return null;
  const ids = manifest.components.map(({ id }) => id);
  if (new Set(ids).size !== ids.length || ids.some((id) => !Object.hasOwn(RELEASE_ENDPOINTS, id))) return null;
  return manifest.components.map(({ id, installedTag, repository }) => ({ id, installedTag, repository }));
}

function trustedConfiguration(policy, installed, checkedAt) {
  if (policy === null || typeof policy !== "object" || !Array.isArray(policy.components)) return false;
  const policyRepositories = new Map(policy.components.map((component) => [component?.id, component?.repository]));
  if (policyRepositories.size !== installed.length || !installed.every(({ id, repository }) => policyRepositories.get(id) === repository)) return false;
  const releases = {};
  for (const component of installed) {
    releases[component.id] = [{
      tag: component.installedTag,
      draft: false,
      prerelease: false,
      url: `${component.repository}/releases/tag/${encodeURIComponent(component.installedTag)}`,
    }];
  }
  try {
    const advisory = evaluateUpdateAdvisory({ policy, installed, releases, checkedAt });
    return advisory.status === "current" && advisory.components.length === installed.length;
  } catch {
    return false;
  }
}

function defaultFsOps(overrides) {
  return { ...fs, ...overrides };
}

export function resolveUpdateCachePath({ env = process.env, home = homedir(), platform = process.platform } = {}) {
  const isWindowsAbsolute = (value) => typeof value === "string"
    && (/^[A-Za-z]:[\\/]/u.test(value) || /^\\\\[^\\]/u.test(value));
  const absoluteForPlatform = (value) => typeof value === "string"
    && (platform === "win32" ? isWindowsAbsolute(value) || path.isAbsolute(value) : path.isAbsolute(value));
  const joinForPlatform = (base, ...parts) => platform === "win32" && isWindowsAbsolute(base)
    ? path.win32.join(base, ...parts)
    : path.join(base, ...parts);
  const xdg = absoluteForPlatform(env.XDG_CACHE_HOME) ? env.XDG_CACHE_HOME : null;
  if (!absoluteForPlatform(home)) throw new TypeError("home must be absolute");
  const base = xdg
    ?? (platform === "darwin" ? joinForPlatform(home, "Library", "Caches")
      : platform === "win32" ? (absoluteForPlatform(env.LOCALAPPDATA) ? env.LOCALAPPDATA : joinForPlatform(home, "AppData", "Local"))
        : joinForPlatform(home, ".cache"));
  return joinForPlatform(base, CACHE_DIRECTORY, CACHE_FILE);
}

export async function checkGameDesignUpdates({
  pluginRoot = fileURLToPath(new URL("../..", import.meta.url)),
  env = process.env,
  home = homedir(),
  now = Date.now(),
  fetchFn = globalThis.fetch,
  fsOps: fsOverrides = {},
  platform = process.platform,
} = {}) {
  const checkedAt = iso(now);
  if (env.GAME_DESIGN_UPDATE_CHECKS === "false") {
    return publicResult({ advisory: createDisabledUpdateAdvisory({ checkedAt }), cache: "disabled" });
  }
  const fsOps = defaultFsOps(fsOverrides);
  let policy;
  let installed;
  try {
    policy = await loadJson(pluginRoot, "update-policy.json", fsOps);
    installed = installedFromManifest(await loadJson(pluginRoot, "installed-components.json", fsOps));
    if (installed === null || !trustedConfiguration(policy, installed, checkedAt)) throw new Error("untrusted update configuration");
  } catch {
    return unknownResult({ checkedAt, cache: "miss" });
  }
  const intervalMs = policy.checkIntervalDays * 24 * 60 * 60 * 1000;
  const lockLeaseMs = Math.max(LOCK_MIN_LEASE_MS, policy.totalTimeoutMs + LOCK_MAX_WAIT_MS + 1000);
  let cachePath;
  try {
    cachePath = resolveUpdateCachePath({ env, home, platform });
  } catch {
    return unknownResult({ checkedAt, cache: "miss", installed });
  }
  const initial = await readCache({ cachePath, fsOps, policy, installed, now, intervalMs });
  if (initial.fresh) {
    const notification = notificationFor(initial.advisory, initial.record.lastNotifiedComponents);
    if (notification === null) return publicResult({ advisory: initial.advisory, cache: "hit" });
    const claimed = await claimFreshNotification({ cachePath, fsOps, policy, installed, now, intervalMs, lockLeaseMs });
    return claimed === null
      ? unknownResult({ checkedAt, cache: "hit", installed })
      : publicResult({ advisory: claimed.advisory, cache: "hit", notification: claimed.notification });
  }
  if (initial.state === "unsafe") return unknownResult({ checkedAt, cache: "miss", installed });
  if (!(await ensureCacheDirectory(cachePath, fsOps))) return unknownResult({ checkedAt, cache: "miss", installed });

  const lockPath = `${cachePath}.lock`;
  let locked;
  try {
    locked = await acquireLock(lockPath, fsOps, lockLeaseMs);
  } catch {
    return unknownResult({ checkedAt, cache: "miss", installed });
  }
  if (!locked) {
    const winner = await waitForCache({ cachePath, fsOps, policy, installed, now, intervalMs });
    return winner === null
      ? unknownResult({ checkedAt, cache: "miss", installed })
      : publicResult({ advisory: winner.advisory, cache: "hit", notification: notificationFor(winner.advisory, winner.record.lastNotifiedComponents) });
  }

  try {
    const cached = await readCache({ cachePath, fsOps, policy, installed, now, intervalMs });
    if (cached.fresh) return publicResult({ advisory: cached.advisory, cache: "hit", notification: notificationFor(cached.advisory, cached.record.lastNotifiedComponents) });
    if (cached.state === "unsafe") return unknownResult({ checkedAt, cache: "miss", installed });
    const controller = new AbortController();
    let timeoutId;
    const timeout = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        controller.abort();
        reject(new Error("update check timed out"));
      }, policy.totalTimeoutMs);
    });
    try {
      const releases = await fetchReleases({ installed, fetchFn, signal: controller.signal, timeout });
      const advisory = evaluateUpdateAdvisory({ policy, installed, releases, checkedAt });
      if (advisory.status === "unknown") return unknownResult({ checkedAt, cache: "miss", installed });
      const notification = notificationFor(advisory, cached.record?.lastNotifiedComponents ?? []);
      const record = cacheRecord({ advisory, notification, now: checkedAt, previous: cached.record });
      if (!(await publishCache({ cachePath, record, fsOps }))) return unknownResult({ checkedAt, cache: "miss", installed });
      return publicResult({ advisory, cache: "miss", notification });
    } catch {
      return unknownResult({ checkedAt, cache: "miss", installed });
    } finally {
      clearTimeout(timeoutId);
    }
  } finally {
    await releaseLock(locked, fsOps);
  }
}

async function isDirectInvocation() {
  if (!process.argv[1]) return false;
  try {
    return await fs.realpath(process.argv[1]) === await fs.realpath(fileURLToPath(import.meta.url));
  } catch {
    return path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
  }
}

if (await isDirectInvocation()) {
  const result = await checkGameDesignUpdates();
  process.stdout.write(`${JSON.stringify(result)}\n`);
}
