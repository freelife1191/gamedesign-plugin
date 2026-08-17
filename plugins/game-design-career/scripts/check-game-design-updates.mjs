#!/usr/bin/env node

import { constants } from "node:fs";
import * as fs from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { homedir } from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
  canonicalReleaseUrl,
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
const RECOVERY_MARKER = ".recovery.v1.";
const RECOVERY_STAGING_MARKER = ".recovery-staging.";
const INSTALLED_COMPONENT_KEYS = Object.freeze(["id", "repository", "installedTag", "commit"]);
const RELEASE_ENDPOINTS = Object.freeze({
  skillstead: "https://api.github.com/repos/kyungseo/skillstead/releases",
  archify: "https://api.github.com/repos/tt-a1i/archify/releases",
  "im-not-ai": "https://api.github.com/repos/epoko77-ai/im-not-ai/releases",
});
// This file runs from two layouts and the configuration sits at a different depth in each:
// packaged as <plugin>/scripts with <plugin>/references/shared/updates, and in the repository as
// shared/scripts with shared/updates one level higher. A single relative default silently
// resolves to nothing in whichever layout it was not written for, so try both.
const DEFAULT_PLUGIN_ROOTS = Object.freeze([
  fileURLToPath(new URL("..", import.meta.url)),
  fileURLToPath(new URL("../..", import.meta.url)),
]);
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

async function inspectOwnedLockFile(lockPath, fsOps, linkCounts) {
  let entry;
  let handle;
  try {
    entry = await fsOps.lstat(lockPath);
    if (!entry.isFile() || entry.isSymbolicLink() || !linkCounts.includes(entry.nlink) || entry.size > 1024 * 1024) return null;
    handle = await fsOps.open(lockPath, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    const opened = await handle.stat();
    if (!opened.isFile() || !linkCounts.includes(opened.nlink) || !sameFile(entry, opened) || opened.size > 1024 * 1024) return null;
    const metadata = JSON.parse(await handle.readFile({ encoding: "utf8" }));
    const after = await fsOps.lstat(lockPath);
    if (!sameFile(entry, after) || !validLockMetadata(metadata)) return null;
    return { kind: "file", entry, metadata };
  } catch {
    return null;
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

async function inspectOwnedLock(lockPath, fsOps) {
  try {
    const file = await inspectOwnedLockFile(lockPath, fsOps, [1, 2]);
    if (file !== null) return file;
    const entry = await fsOps.lstat(lockPath);
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

function sameGeneration(lock, inspected) {
  return sameLock(lock, inspected) && inspected.metadata.createdAt === lock.createdAt;
}

function recoveryTargetId({ owner, createdAt }) {
  return createHash("sha256").update(`${owner}\0${createdAt}`, "utf8").digest("hex");
}

function validIso(value) {
  if (typeof value !== "string") return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString() === value;
}

function ownerPid(owner) {
  const parsed = LOCK_OWNER.exec(owner)?.groups?.pid;
  const pid = Number(parsed);
  return Number.isSafeInteger(pid) ? pid : null;
}

async function ownerIsProvablyDead(owner) {
  const pid = ownerPid(owner);
  if (pid === null) return false;
  try {
    process.kill(pid, 0);
    return false;
  } catch (error) {
    return error?.code === "ESRCH";
  }
}

async function staleDeadOwner(inspected, leaseMs) {
  const age = Date.now() - Date.parse(inspected.metadata.createdAt);
  if (!Number.isFinite(age) || age < leaseMs) return false;
  return ownerIsProvablyDead(inspected.metadata.owner);
}

function recoveryRecordPath(lockPath, targetId, type, sequence = null) {
  const prefix = `${lockPath}${RECOVERY_MARKER}${targetId}`;
  return type === "retired" ? `${prefix}.retired` : `${prefix}.${type}.${sequence}`;
}

function recoveryRecordKeys(type) {
  return type === "claim"
    ? ["schemaVersion", "targetId", "sequence", "owner", "createdAt", "claimant", "claimedAt"]
    : ["schemaVersion", "targetId", "sequence", "owner", "createdAt", "claimant", "abortedAt"];
}

function validRecoveryRecord(value, { type, targetId, sequence, owner, createdAt }) {
  if (!hasExactKeys(value, recoveryRecordKeys(type))
    || value.schemaVersion !== 1
    || value.targetId !== targetId
    || value.sequence !== sequence
    || value.owner !== owner
    || value.createdAt !== createdAt
    || recoveryTargetId(value) !== targetId
    || typeof value.claimant !== "string"
    || !LOCK_OWNER.test(value.claimant)) return false;
  return type === "claim" ? validIso(value.claimedAt) : validIso(value.abortedAt);
}

async function inspectRecoveryRecord(recordPath, fsOps, validation) {
  let entry;
  let handle;
  try {
    entry = await fsOps.lstat(recordPath);
    if (!entry.isFile() || entry.isSymbolicLink() || ![1, 2].includes(entry.nlink) || entry.size > 1024 * 1024) return null;
    handle = await fsOps.open(recordPath, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    const opened = await handle.stat();
    if (!opened.isFile() || ![1, 2].includes(opened.nlink) || !sameFile(entry, opened) || opened.size > 1024 * 1024) return null;
    const value = JSON.parse(await handle.readFile({ encoding: "utf8" }));
    const after = await fsOps.lstat(recordPath);
    if (!sameFile(entry, after) || !validation(value)) return null;
    return { entry, value };
  } catch {
    return null;
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

async function writeAppendOnlyRecoveryRecord(recordPath, record, fsOps) {
  const lockPath = recordPath.slice(0, recordPath.indexOf(RECOVERY_MARKER));
  const stagingPath = `${lockPath}${RECOVERY_STAGING_MARKER}${process.pid}.${randomUUID()}`;
  let handle;
  let entry;
  let published = false;
  try {
    handle = await fsOps.open(stagingPath, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | (constants.O_NOFOLLOW ?? 0), 0o600);
    entry = await handle.stat();
    if (!entry.isFile() || entry.nlink !== 1) throw new Error("unsafe recovery staging record");
    await handle.writeFile(`${JSON.stringify(record)}\n`, { encoding: "utf8" });
    await handle.sync();
    await handle.close();
    handle = null;
    await fsOps.link(stagingPath, recordPath);
    published = true;
    await fsOps.unlink(stagingPath).catch(() => undefined);
    return true;
  } catch (error) {
    await handle?.close().catch(() => undefined);
    if (entry !== undefined && !published) await fsOps.unlink(stagingPath).catch(() => undefined);
    if (error?.code === "EEXIST") return false;
    throw error;
  }
}

async function recoveryState(lockPath, generation, fsOps) {
  let entries;
  try {
    entries = await fsOps.readdir(path.dirname(lockPath));
  } catch {
    return null;
  }
  const base = path.basename(lockPath);
  const targetId = recoveryTargetId(generation);
  const prefix = `${base}${RECOVERY_MARKER}${targetId}`;
  const markers = [];
  for (const name of entries) {
    if (name.startsWith(`${base}${RECOVERY_STAGING_MARKER}`)) continue;
    if (!name.startsWith(prefix)) continue;
    if (name === `${prefix}.retired`) {
      markers.push({ type: "retired", recordPath: path.join(path.dirname(lockPath), name) });
      continue;
    }
    const match = /^\.(claim|abort)\.([1-9]\d*)$/u.exec(name.slice(prefix.length));
    if (match === null) return null;
    markers.push({ type: match[1], sequence: Number(match[2]), recordPath: path.join(path.dirname(lockPath), name) });
  }
  const claims = new Map();
  const aborts = new Map();
  let retired = null;
  for (const marker of markers) {
    if (marker.type === "retired") {
      const inspected = await inspectOwnedLockFile(marker.recordPath, fsOps, [1, 2, 3]);
      if (!sameGeneration(generation, inspected)) return null;
      if (retired !== null) return null;
      retired = { ...marker, inspected };
      continue;
    }
    const inspected = await inspectRecoveryRecord(marker.recordPath, fsOps, (value) => validRecoveryRecord(value, {
      type: marker.type,
      targetId,
      sequence: marker.sequence,
      owner: generation.owner,
      createdAt: generation.createdAt,
    }));
    if (inspected === null) return null;
    if (marker.type === "claim") claims.set(marker.sequence, { ...marker, record: inspected.value });
    else aborts.set(marker.sequence, { ...marker, record: inspected.value });
  }
  if (claims.size === 0 && (retired !== null || aborts.size !== 0)) return null;
  const sequences = [...claims.keys()].sort((left, right) => left - right);
  if (!sequences.every((sequence, index) => sequence === index + 1)) return null;
  if ([...aborts.entries()].some(([sequence, abort]) => !claims.has(sequence) || abort.record.claimant !== claims.get(sequence).record.claimant)) return null;
  return { targetId, claims, aborts, retired };
}

async function claimStaleGeneration(lockPath, generation, fsOps, leaseMs) {
  const state = await recoveryState(lockPath, generation, fsOps);
  if (state === null) return null;
  const latestSequence = Math.max(0, ...state.claims.keys());
  const latest = state.claims.get(latestSequence);
  if (latest !== undefined) {
    const claimAge = Date.now() - Date.parse(latest.record.claimedAt);
    if (!state.aborts.has(latestSequence)
      && (!Number.isFinite(claimAge) || claimAge < leaseMs || !(await ownerIsProvablyDead(latest.record.claimant)))) return null;
  }
  const sequence = latestSequence + 1;
  const claimant = `game-design-update-check:${process.pid}-${randomUUID()}`;
  const record = {
    schemaVersion: 1,
    targetId: state.targetId,
    sequence,
    owner: generation.owner,
    createdAt: generation.createdAt,
    claimant,
    claimedAt: new Date().toISOString(),
  };
  const recordPath = recoveryRecordPath(lockPath, state.targetId, "claim", sequence);
  try {
    return (await writeAppendOnlyRecoveryRecord(recordPath, record, fsOps)) ? { ...state, sequence, recordPath, claimant } : null;
  } catch {
    return null;
  }
}

async function ownerAnchorPath(lockPath, generation, canonical, fsOps, linkCount) {
  let entries;
  try {
    entries = await fsOps.readdir(path.dirname(lockPath));
  } catch {
    return null;
  }
  const candidates = entries.filter((name) => name.startsWith(`${path.basename(lockPath)}.staging.`));
  const matches = [];
  for (const name of candidates) {
    const anchorPath = path.join(path.dirname(lockPath), name);
    const anchor = await inspectOwnedLockFile(anchorPath, fsOps, [linkCount]);
    if (sameGeneration(generation, anchor) && sameFile(canonical.entry, anchor.entry)) matches.push({ anchorPath, anchor });
  }
  return matches.length === 1 ? matches[0] : null;
}

async function recoveryAuthority(lockPath, generation, claim, fsOps) {
  const state = await recoveryState(lockPath, generation, fsOps);
  if (state === null) return null;
  const latestSequence = Math.max(0, ...state.claims.keys());
  const latest = state.claims.get(latestSequence);
  if (latest === undefined || latest.sequence !== claim.sequence || latest.record.claimant !== claim.claimant || state.aborts.has(latestSequence)) return null;
  return state;
}

async function publishRecoveryAbort(lockPath, generation, claim, fsOps) {
  const record = {
    schemaVersion: 1,
    targetId: recoveryTargetId(generation),
    sequence: claim.sequence,
    owner: generation.owner,
    createdAt: generation.createdAt,
    claimant: claim.claimant,
    abortedAt: new Date().toISOString(),
  };
  try {
    return await writeAppendOnlyRecoveryRecord(recoveryRecordPath(lockPath, record.targetId, "abort", claim.sequence), record, fsOps);
  } catch {
    return false;
  }
}

async function reclaimStaleLock(lockPath, fsOps, leaseMs) {
  const inspected = await inspectOwnedLockFile(lockPath, fsOps, [1, 2, 3]);
  if (inspected === null || !(await staleDeadOwner(inspected, leaseMs))) return false;
  const generation = { lockPath, kind: "file", entry: inspected.entry, owner: inspected.metadata.owner, createdAt: inspected.metadata.createdAt };
  const previous = await recoveryState(lockPath, generation, fsOps);
  if (previous === null) return false;
  if (previous.retired !== null) {
    if (!sameFile(inspected.entry, previous.retired.inspected.entry)) return false;
    if (inspected.entry.nlink === 3) {
      const anchor = await ownerAnchorPath(lockPath, generation, inspected, fsOps, 3);
      if (anchor === null) return false;
    }
  } else if (inspected.entry.nlink === 2) {
    const anchor = await ownerAnchorPath(lockPath, generation, inspected, fsOps, 2);
    if (anchor === null || !sameFile(anchor.anchor.entry, inspected.entry)) return false;
  } else if (inspected.entry.nlink !== 1) {
    return false;
  }
  const claimed = await claimStaleGeneration(lockPath, generation, fsOps, leaseMs);
  if (claimed === null) return false;
  try {
    let state = await recoveryAuthority(lockPath, generation, claimed, fsOps);
    if (state === null) throw new Error("lost recovery claim");
    let retiredPath = state.retired?.recordPath;
    if (retiredPath === undefined) {
      const canonical = await inspectOwnedLockFile(lockPath, fsOps, [1, 2]);
      if (!sameGeneration(generation, canonical) || !(await staleDeadOwner(canonical, leaseMs))) throw new Error("stale canonical changed");
      state = await recoveryAuthority(lockPath, generation, claimed, fsOps);
      if (state === null) throw new Error("lost recovery claim");
      retiredPath = recoveryRecordPath(lockPath, state.targetId, "retired");
      await fsOps.link(lockPath, retiredPath);
    }
    state = await recoveryAuthority(lockPath, generation, claimed, fsOps);
    if (state === null || state.retired === null) throw new Error("lost recovery claim");
    const canonical = await inspectOwnedLockFile(lockPath, fsOps, [2, 3]);
    const retired = await inspectOwnedLockFile(state.retired.recordPath, fsOps, [2, 3]);
    if (!sameGeneration(generation, canonical) || !sameGeneration(generation, retired) || !sameFile(canonical.entry, retired.entry)) throw new Error("canonical changed");
    if (canonical.entry.nlink === 3) {
      const anchor = await ownerAnchorPath(lockPath, generation, canonical, fsOps, 3);
      if (anchor === null || !sameFile(anchor.anchor.entry, canonical.entry)) throw new Error("missing owner anchor");
    }
    state = await recoveryAuthority(lockPath, generation, claimed, fsOps);
    if (state === null) throw new Error("lost recovery claim");
    const finalCanonical = await inspectOwnedLockFile(lockPath, fsOps, [2, 3]);
    const finalRetired = await inspectOwnedLockFile(state.retired.recordPath, fsOps, [2, 3]);
    if (!sameGeneration(generation, finalCanonical) || !sameGeneration(generation, finalRetired) || !sameFile(finalCanonical.entry, finalRetired.entry)) throw new Error("canonical changed");
    await fsOps.unlink(lockPath);
    return true;
  } catch {
    await publishRecoveryAbort(lockPath, generation, claimed, fsOps);
    return false;
  }
}

async function removeUnpublishedAnchor(anchorPath, entry, fsOps) {
  try {
    const current = await fsOps.lstat(anchorPath);
    if (!current.isFile() || current.isSymbolicLink() || !sameFile(current, entry)) return false;
    await fsOps.unlink(anchorPath);
    return true;
  } catch {
    return false;
  }
}

async function createOwnedLock(lockPath, fsOps) {
  const owner = `game-design-update-check:${process.pid}-${randomUUID()}`;
  const createdAt = new Date().toISOString();
  const ownerAnchor = `${lockPath}.staging.${process.pid}.${randomUUID()}`;
  let entry;
  let handle;
  let published = false;
  try {
    handle = await fsOps.open(ownerAnchor, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | (constants.O_NOFOLLOW ?? 0), 0o600);
    entry = await handle.stat();
    if (!entry.isFile() || entry.nlink !== 1) throw new Error("unsafe staging lock");
    await handle.writeFile(`${JSON.stringify({ schemaVersion: 1, owner, createdAt })}\n`, { encoding: "utf8" });
    await handle.sync();
    await handle.close();
    handle = null;
    const staged = await inspectOwnedLockFile(ownerAnchor, fsOps, [1]);
    if (!sameLock({ kind: "file", entry, owner }, staged)) throw new Error("unsafe staging metadata");
    await fsOps.link(ownerAnchor, lockPath);
    published = true;
    const canonical = await inspectOwnedLockFile(lockPath, fsOps, [2]);
    const anchor = await inspectOwnedLockFile(ownerAnchor, fsOps, [2]);
    if (!sameLock({ kind: "file", entry, owner }, canonical) || !sameLock({ kind: "file", entry, owner }, anchor) || !sameFile(canonical.entry, anchor.entry)) throw new Error("unsafe lock metadata");
    return { lockPath, ownerAnchor, kind: "file", entry, owner, createdAt };
  } catch (error) {
    await handle?.close().catch(() => undefined);
    if (entry !== undefined && !published) await removeUnpublishedAnchor(ownerAnchor, entry, fsOps);
    if (error?.code === "EEXIST") return null;
    throw error;
  }
}

async function acquireLock(lockPath, fsOps, leaseMs) {
  const created = await createOwnedLock(lockPath, fsOps);
  if (created !== null) return created;
  if (!(await reclaimStaleLock(lockPath, fsOps, leaseMs))) return null;
  return createOwnedLock(lockPath, fsOps);
}

async function releaseLock(lock, fsOps) {
  if (lock === null || lock === undefined || lock.kind !== "file") return;
  const canonical = await inspectOwnedLockFile(lock.lockPath, fsOps, [2]);
  const anchor = await inspectOwnedLockFile(lock.ownerAnchor, fsOps, [2]);
  if (!sameGeneration(lock, canonical) || !sameGeneration(lock, anchor) || !sameFile(canonical.entry, anchor.entry)) return;
  let canonicalAbsent = false;
  try {
    await fsOps.unlink(lock.lockPath);
    canonicalAbsent = true;
  } catch {
    try {
      await fsOps.lstat(lock.lockPath);
    } catch (error) {
      canonicalAbsent = error?.code === "ENOENT";
    }
  }
  if (canonicalAbsent) await fsOps.unlink(lock.ownerAnchor).catch(() => undefined);
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

async function loadJson(pluginRoots, filename, fsOps) {
  for (const pluginRoot of pluginRoots) {
    for (const relativeDirectory of ["references/shared/updates", "shared/updates"]) {
      try {
        return JSON.parse(await fsOps.readFile(path.join(pluginRoot, relativeDirectory, filename), "utf8"));
      } catch (error) {
        if (error?.code !== "ENOENT") throw error;
      }
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
      url: canonicalReleaseUrl(component.repository, component.installedTag),
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
  pluginRoot = null,
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
  const pluginRoots = pluginRoot === null ? DEFAULT_PLUGIN_ROOTS : [pluginRoot];
  let policy;
  let installed;
  try {
    policy = await loadJson(pluginRoots, "update-policy.json", fsOps);
    installed = installedFromManifest(await loadJson(pluginRoots, "installed-components.json", fsOps));
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
