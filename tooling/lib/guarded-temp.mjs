import { randomUUID } from "node:crypto";
import { lstat, mkdtemp, realpath, rename, rm } from "node:fs/promises";
import path from "node:path";

function sameIdentity(stats, identity) {
  return stats.dev === identity.dev && stats.ino === identity.ino && stats.mode === identity.mode;
}

async function directoryIdentity(target, label) {
  const stats = await lstat(target);
  if (stats.isSymbolicLink()) throw new Error(`${label} is a symlink; preserved path: ${target}`);
  if (!stats.isDirectory()) throw new Error(`${label} is not a directory; preserved path: ${target}`);
  return { dev: stats.dev, ino: stats.ino, mode: stats.mode };
}

export async function createGuardedTempRoot({ parent, prefix }) {
  if (typeof prefix !== "string" || prefix.length < 8 || prefix.includes(path.sep)) throw new Error("unsafe temporary prefix");
  const requestedParent = path.resolve(parent);
  const parentIdentity = await directoryIdentity(requestedParent, "temporary parent");
  const canonicalParent = await realpath(requestedParent);
  const root = await mkdtemp(path.join(canonicalParent, prefix));
  const canonicalRoot = await realpath(root);
  const relative = path.relative(canonicalParent, canonicalRoot);
  if (relative === "" || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`temporary root escaped its parent; preserved path: ${canonicalRoot}`);
  }
  const rootIdentity = await directoryIdentity(canonicalRoot, "temporary root");
  return Object.freeze({
    parent: canonicalParent,
    parentIdentity: Object.freeze(parentIdentity),
    root: canonicalRoot,
    rootIdentity: Object.freeze(rootIdentity),
    prefix,
  });
}

async function assertRegisteredParent(registration) {
  const canonical = await realpath(registration.parent).catch(() => null);
  const stats = await lstat(registration.parent).catch(() => null);
  if (canonical !== registration.parent || !stats?.isDirectory() || stats.isSymbolicLink()
      || !sameIdentity(stats, registration.parentIdentity)) {
    throw new Error(`temporary parent identity changed; preserved path: ${registration.root}`);
  }
}

export async function cleanupGuardedTempRoot(registration, operations = {}) {
  if (!registration || typeof registration.root !== "string" || typeof registration.parent !== "string") {
    throw new Error("invalid temporary registration");
  }
  await assertRegisteredParent(registration);
  await operations.beforeQuarantine?.({ ...registration });
  await assertRegisteredParent(registration);
  const rootStats = await lstat(registration.root).catch(() => null);
  const rootCanonical = await realpath(registration.root).catch(() => null);
  if (rootCanonical !== registration.root || !rootStats?.isDirectory() || rootStats.isSymbolicLink()
      || !sameIdentity(rootStats, registration.rootIdentity)) {
    throw new Error(`temporary root identity changed; preserved path: ${registration.root}`);
  }

  const quarantine = path.join(registration.parent, `.${registration.prefix}quarantine-${randomUUID()}`);
  await rename(registration.root, quarantine);
  await operations.beforeDelete?.({ ...registration, quarantine });
  await assertRegisteredParent(registration);
  const quarantineStats = await lstat(quarantine).catch(() => null);
  const quarantineCanonical = await realpath(quarantine).catch(() => null);
  if (quarantineCanonical !== quarantine || !quarantineStats?.isDirectory() || quarantineStats.isSymbolicLink()
      || !sameIdentity(quarantineStats, registration.rootIdentity)) {
    throw new Error(`quarantine identity changed; preserved paths: ${registration.root}, ${quarantine}`);
  }
  await rm(quarantine, { recursive: true });
  return { deleted: true, quarantine };
}
