import assert from "node:assert/strict";
import { link, lstat, mkdtemp, mkdir, open, readFile, readdir, rename, rmdir as fsRmdir, rm, symlink, unlink, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  checkGameDesignUpdates,
  resolveUpdateCachePath,
} from "../../shared/scripts/check-game-design-updates.mjs";

const CHECKED_AT = "2026-08-15T00:00:00.000Z";
const SIX_DAYS_LATER = Date.parse("2026-08-21T00:00:00.000Z");
const SEVEN_DAYS_LATER = Date.parse("2026-08-22T00:00:00.000Z");
const ENDPOINTS = [
  "https://api.github.com/repos/kyungseo/skillstead/releases",
  "https://api.github.com/repos/tt-a1i/archify/releases",
  "https://api.github.com/repos/epoko77-ai/im-not-ai/releases",
];
const INSTALLED = [
  { id: "skillstead", repository: "https://github.com/kyungseo/skillstead", installedTag: "svg-infographic/v0.9.0", commit: "6e5b850f66716af9eb3c6a79f60e4f8ff5716dee" },
  { id: "archify", repository: "https://github.com/tt-a1i/archify", installedTag: "v2.13.0", commit: "2c1f8ac2ca28a26d0b68043ec80c9554e20ff0e3" },
  { id: "im-not-ai", repository: "https://github.com/epoko77-ai/im-not-ai", installedTag: "v2.3.0", commit: "82137e858763dadb99561f194c5c00465735017b" },
];

function apiRelease(tag, repository, { draft = false, prerelease = false } = {}) {
  return {
    tag_name: tag,
    draft,
    prerelease,
    html_url: `${repository}/releases/tag/${encodeURIComponent(tag)}`,
  };
}

function response(url, body, { status = 200, responseUrl = url } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    url: responseUrl,
    async json() { return body; },
  };
}

function currentResponse(url) {
  const index = ENDPOINTS.indexOf(url);
  const component = INSTALLED[index];
  return response(url, [apiRelease(component.installedTag, component.repository)]);
}

async function fixture(t, { manifest, policyOverrides = {} } = {}) {
  const root = await mkdtemp(path.join(tmpdir(), "game-design-update-check-"));
  const pluginRoot = path.join(root, "plugin");
  const home = path.join(root, "home");
  await mkdir(path.join(pluginRoot, "shared", "updates"), { recursive: true });
  await mkdir(home, { recursive: true });
  await writeFile(path.join(pluginRoot, "shared", "updates", "update-policy.json"), `${JSON.stringify({
    schemaVersion: 1,
    checkIntervalDays: 7,
    totalTimeoutMs: 5000,
    marketplaceName: "game-design-suite",
    productIds: ["game-design-studio", "game-design-career"],
    components: INSTALLED.map(({ id, repository }) => ({ id, repository })),
    stableReleasesOnly: true,
    ...policyOverrides,
  })}\n`);
  await writeFile(path.join(pluginRoot, "shared", "updates", "installed-components.json"), `${JSON.stringify(manifest ?? { schemaVersion: 1, components: INSTALLED })}\n`);
  t.after(() => rm(root, { recursive: true, force: true }));
  return { root, pluginRoot, home };
}

function checkingFetch(calls, transform = currentResponse) {
  return async (url, options) => {
    calls.push({ url, options });
    return transform(url, options);
  };
}

async function writeCache({ home, value }) {
  const cachePath = resolveUpdateCachePath({ env: {}, home, platform: process.platform });
  await mkdir(path.dirname(cachePath), { recursive: true });
  await writeFile(cachePath, `${JSON.stringify(value)}\n`, { mode: 0o600 });
  return cachePath;
}

function notificationIdentity({ latestTag = "v2.14.0" } = {}) {
  return [{ id: "archify", installedTag: "v2.13.0", latestTag }];
}

function cacheValue({ checkedAt = CHECKED_AT, lastNotifiedComponents = [], lastNotifiedAt = null } = {}) {
  return {
    schemaVersion: 1,
    checkedAt,
    status: "current",
    components: INSTALLED.map((component) => ({
      id: component.id,
      installedTag: component.installedTag,
      latestTag: component.installedTag,
      status: "current",
      releaseUrl: `${component.repository}/releases/tag/${encodeURIComponent(component.installedTag)}`,
    })),
    lastNotifiedAt,
    lastNotifiedComponents,
  };
}

function outdatedCacheValue(options = {}) {
  const value = cacheValue(options);
  return {
    ...value,
    status: "outdated",
    components: value.components.map((component) => component.id === "archify" ? {
      ...component,
      latestTag: "v2.14.0",
      status: "outdated",
      releaseUrl: "https://github.com/tt-a1i/archify/releases/tag/v2.14.0",
    } : component),
  };
}

function expectedUnknownResult() {
  return {
    schemaVersion: 1,
    checkedAt: CHECKED_AT,
    cache: "miss",
    status: "unknown",
    components: INSTALLED.map(({ id, installedTag }) => ({ id, installedTag, latestTag: null, status: "unknown", releaseUrl: null })),
    notification: null,
  };
}

function deferred() {
  let resolve;
  const promise = new Promise((next) => { resolve = next; });
  return { promise, resolve };
}

test("uses the documented OS cache location without exposing it in results", () => {
  assert.equal(resolveUpdateCachePath({ env: { XDG_CACHE_HOME: "/tmp/xdg" }, home: "/home/test", platform: "linux" }), "/tmp/xdg/game-design-suite/update-advisory-v1.json");
  assert.equal(resolveUpdateCachePath({ env: {}, home: "/Users/test", platform: "darwin" }), "/Users/test/Library/Caches/game-design-suite/update-advisory-v1.json");
  assert.equal(resolveUpdateCachePath({ env: { LOCALAPPDATA: "C:\\Cache" }, home: "C:\\Users\\test", platform: "win32" }), "C:\\Cache\\game-design-suite\\update-advisory-v1.json");
  assert.equal(resolveUpdateCachePath({ env: { LOCALAPPDATA: "relative-cache" }, home: "C:\\Users\\test", platform: "win32" }), "C:\\Users\\test\\AppData\\Local\\game-design-suite\\update-advisory-v1.json");
});

test("relative Windows LOCALAPPDATA falls back to absolute home cache without writing under cwd", async (t) => {
  const { pluginRoot, home, root } = await fixture(t);
  const cwd = path.join(root, "cwd");
  await mkdir(cwd);
  const before = await readdir(cwd);
  const calls = [];
  const originalCwd = process.cwd();
  t.after(() => process.chdir(originalCwd));
  process.chdir(cwd);

  let result;
  try {
    result = await checkGameDesignUpdates({
      pluginRoot,
      home,
      platform: "win32",
      env: { LOCALAPPDATA: "relative-cache" },
      now: Date.parse(CHECKED_AT),
      fetchFn: checkingFetch(calls),
    });
  } finally {
    process.chdir(originalCwd);
  }

  assert.equal(result.status, "current");
  assert.equal(calls.length, 3);
  assert.deepEqual(await readdir(cwd), before);
  assert.equal((await lstat(path.join(home, "AppData", "Local", "game-design-suite", "update-advisory-v1.json"))).isFile(), true);
});

test("checks only the three literal official release endpoints on a cache miss", async (t) => {
  const { pluginRoot, home } = await fixture(t);
  const calls = [];
  const result = await checkGameDesignUpdates({ pluginRoot, home, now: Date.parse(CHECKED_AT), fetchFn: checkingFetch(calls) });

  assert.deepEqual(calls.map(({ url }) => url), ENDPOINTS);
  assert.ok(calls.every(({ options }) => options.method === "GET" && options.redirect === "error" && options.signal instanceof AbortSignal));
  assert.deepEqual(result, {
    schemaVersion: 1,
    checkedAt: CHECKED_AT,
    cache: "miss",
    status: "current",
    components: cacheValue().components,
    notification: null,
  });
  assert.equal(JSON.stringify(result).includes(home), false);
  assert.equal(JSON.stringify(result).includes(pluginRoot), false);
});

test("reuses a six-day cache without network access", async (t) => {
  const { pluginRoot, home } = await fixture(t);
  await writeCache({ home, value: cacheValue() });
  const fetchFn = () => { throw new Error("network must not run"); };

  const result = await checkGameDesignUpdates({ pluginRoot, home, now: SIX_DAYS_LATER, fetchFn });

  assert.equal(result.cache, "hit");
  assert.equal(result.checkedAt, CHECKED_AT);
});

test("concurrent fresh outdated cache hits atomically claim one notification without network access", async (t) => {
  const { pluginRoot, home } = await fixture(t);
  const cachePath = await writeCache({ home, value: outdatedCacheValue() });
  const calls = [];
  const fetchFn = checkingFetch(calls);

  const results = await Promise.all([
    checkGameDesignUpdates({ pluginRoot, home, now: SIX_DAYS_LATER, fetchFn }),
    checkGameDesignUpdates({ pluginRoot, home, now: SIX_DAYS_LATER, fetchFn }),
  ]);

  assert.equal(calls.length, 0);
  assert.equal(results.filter(({ notification }) => notification !== null).length, 1);
  assert.deepEqual(results.find(({ notification }) => notification !== null)?.notification, {
    kind: "update-available",
    prompt: "플러그인 업데이트를 확인해 줘",
    componentIds: ["archify"],
  });
  const persisted = JSON.parse(await readFile(cachePath, "utf8"));
  assert.deepEqual(persisted.lastNotifiedComponents, notificationIdentity());
  assert.equal(persisted.lastNotifiedAt, "2026-08-21T00:00:00.000Z");
});

test("a previously notified outdated version stays suppressed after a shared-cache refresh", async (t) => {
  const { pluginRoot, home } = await fixture(t);
  const cachePath = await writeCache({
    home,
    value: outdatedCacheValue({ lastNotifiedComponents: notificationIdentity(), lastNotifiedAt: CHECKED_AT }),
  });
  const calls = [];
  const result = await checkGameDesignUpdates({
    pluginRoot,
    home,
    now: SEVEN_DAYS_LATER,
    fetchFn: checkingFetch(calls, (url) => {
      if (url === ENDPOINTS[1]) return response(url, [apiRelease("v2.14.0", INSTALLED[1].repository)]);
      return currentResponse(url);
    }),
  });

  assert.equal(result.status, "outdated");
  assert.equal(result.notification, null);
  assert.equal(calls.length, 3);
  const persisted = JSON.parse(await readFile(cachePath, "utf8"));
  assert.deepEqual(persisted.lastNotifiedComponents, notificationIdentity());
  assert.equal(persisted.lastNotifiedAt, CHECKED_AT);
});

test("a newer tag for the same component is claimed once across concurrent shared-cache refreshes", async (t) => {
  const { pluginRoot, home } = await fixture(t);
  const cachePath = await writeCache({
    home,
    value: outdatedCacheValue({ lastNotifiedComponents: notificationIdentity(), lastNotifiedAt: CHECKED_AT }),
  });
  const calls = [];
  let releaseFirst;
  const firstStarted = new Promise((resolve) => { releaseFirst = resolve; });
  const fetchFn = async (url, options) => {
    calls.push({ url, options });
    if (calls.length === 1) await firstStarted;
    if (url === ENDPOINTS[1]) return response(url, [apiRelease("v2.15.0", INSTALLED[1].repository)]);
    return currentResponse(url);
  };

  const first = checkGameDesignUpdates({ pluginRoot, home, now: SEVEN_DAYS_LATER, fetchFn });
  while (calls.length === 0) await new Promise((resolve) => setTimeout(resolve, 1));
  const second = checkGameDesignUpdates({ pluginRoot, home, now: SEVEN_DAYS_LATER, fetchFn });
  releaseFirst();
  const results = await Promise.all([first, second]);

  assert.equal(calls.length, 3);
  assert.equal(results.filter(({ notification }) => notification !== null).length, 1);
  assert.ok(results.every(({ components }) => components.find(({ id }) => id === "archify")?.latestTag === "v2.15.0"));
  const persisted = JSON.parse(await readFile(cachePath, "utf8"));
  assert.deepEqual(persisted.lastNotifiedComponents, notificationIdentity({ latestTag: "v2.15.0" }));
  assert.equal(persisted.lastNotifiedAt, "2026-08-22T00:00:00.000Z");
});

test("treats exactly seven days as stale and refreshes the cache", async (t) => {
  const { pluginRoot, home } = await fixture(t);
  await writeCache({ home, value: cacheValue() });
  const calls = [];

  const result = await checkGameDesignUpdates({ pluginRoot, home, now: SEVEN_DAYS_LATER, fetchFn: checkingFetch(calls) });

  assert.equal(result.cache, "miss");
  assert.equal(result.checkedAt, "2026-08-22T00:00:00.000Z");
  assert.equal(calls.length, 3);
});

test("refreshes cache entries older than seven days", async (t) => {
  const { pluginRoot, home } = await fixture(t);
  await writeCache({ home, value: cacheValue({ checkedAt: "2026-08-14T23:59:59.999Z" }) });
  const calls = [];

  await checkGameDesignUpdates({ pluginRoot, home, now: SEVEN_DAYS_LATER, fetchFn: checkingFetch(calls) });

  assert.equal(calls.length, 3);
});

test("concurrent Studio and Career checks share one network operation and cache", async (t) => {
  const { pluginRoot, home } = await fixture(t);
  const calls = [];
  let releaseFirst;
  const firstStarted = new Promise((resolve) => { releaseFirst = resolve; });
  const fetchFn = async (url, options) => {
    calls.push({ url, options });
    if (calls.length === 1) await firstStarted;
    return currentResponse(url);
  };
  const studio = checkGameDesignUpdates({ pluginRoot, home, now: Date.parse(CHECKED_AT), fetchFn });
  while (calls.length === 0) await new Promise((resolve) => setTimeout(resolve, 1));
  const career = checkGameDesignUpdates({ pluginRoot, home, now: Date.parse(CHECKED_AT), fetchFn });
  releaseFirst();
  const [studioResult, careerResult] = await Promise.all([studio, career]);

  assert.equal(calls.length, 3);
  assert.deepEqual([studioResult.cache, careerResult.cache].sort(), ["hit", "miss"]);
  assert.deepEqual(studioResult.components, careerResult.components);
});

test("does not trust or replace a symlink cache", async (t) => {
  const { pluginRoot, home, root } = await fixture(t);
  const cachePath = resolveUpdateCachePath({ env: {}, home, platform: process.platform });
  const outside = path.join(root, "outside-cache.json");
  await mkdir(path.dirname(cachePath), { recursive: true });
  await writeFile(outside, "outside\n");
  await symlink(outside, cachePath);
  const calls = [];

  const result = await checkGameDesignUpdates({ pluginRoot, home, now: Date.parse(CHECKED_AT), fetchFn: checkingFetch(calls) });

  assert.equal(result.status, "unknown");
  assert.equal(calls.length, 0);
  assert.equal((await lstat(cachePath)).isSymbolicLink(), true);
  assert.equal(await readFile(outside, "utf8"), "outside\n");
});

test("rejects future, truncated JSON, and unknown-key cache evidence before refreshing", async (t) => {
  const { pluginRoot, home } = await fixture(t);
  for (const [kind, value] of [
    ["json", cacheValue({ checkedAt: "2026-08-16T00:00:00.000Z" })],
    ["raw", '{"schemaVersion":1'],
    ["json", { ...cacheValue(), untrusted: true }],
  ]) {
    const cachePath = resolveUpdateCachePath({ env: {}, home, platform: process.platform });
    await mkdir(path.dirname(cachePath), { recursive: true });
    await writeFile(cachePath, kind === "raw" ? value : `${JSON.stringify(value)}\n`);
    const calls = [];
    const result = await checkGameDesignUpdates({ pluginRoot, home, now: Date.parse(CHECKED_AT), fetchFn: checkingFetch(calls) });
    assert.equal(result.cache, "miss");
    assert.equal(calls.length, 3);
  }
});

test("rejects legacy, partial, future, and non-closed notification state before rechecking", async (t) => {
  const { pluginRoot, home } = await fixture(t);
  for (const value of [
    { ...outdatedCacheValue(), lastNotifiedComponentIds: ["archify"] },
    outdatedCacheValue({ lastNotifiedComponents: notificationIdentity(), lastNotifiedAt: null }),
    outdatedCacheValue({ lastNotifiedComponents: [], lastNotifiedAt: CHECKED_AT }),
    outdatedCacheValue({ lastNotifiedComponents: notificationIdentity(), lastNotifiedAt: "2026-08-14T00:00:00.000Z" }),
    outdatedCacheValue({ lastNotifiedComponents: notificationIdentity(), lastNotifiedAt: "2026-08-22T00:00:00.000Z" }),
    outdatedCacheValue({ lastNotifiedComponents: [{ ...notificationIdentity()[0], extra: true }], lastNotifiedAt: CHECKED_AT }),
    outdatedCacheValue({ lastNotifiedComponents: [{ id: "archify", installedTag: "v2.13.0", latestTag: "v2.99.0" }], lastNotifiedAt: CHECKED_AT }),
  ]) {
    await writeCache({ home, value });
    const calls = [];

    const result = await checkGameDesignUpdates({ pluginRoot, home, now: SIX_DAYS_LATER, fetchFn: checkingFetch(calls) });

    assert.equal(result.cache, "miss");
    assert.equal(calls.length, 3);
  }
});

async function writeLock({ home, createdAt, owner = "game-design-update-check:99999999-test-owner", extra = false }) {
  const cachePath = resolveUpdateCachePath({ env: {}, home, platform: process.platform });
  const lockPath = `${cachePath}.lock`;
  await mkdir(lockPath, { recursive: true, mode: 0o700 });
  await writeFile(path.join(lockPath, "owner.json"), `${JSON.stringify({ schemaVersion: 1, owner, createdAt })}\n`, { mode: 0o600 });
  if (extra) await writeFile(path.join(lockPath, "hostile.txt"), "keep\n");
  return lockPath;
}

async function writeFileLock({ home, createdAt, owner = "game-design-update-check:99999999-test-owner" }) {
  const cachePath = resolveUpdateCachePath({ env: {}, home, platform: process.platform });
  const lockPath = `${cachePath}.lock`;
  await mkdir(path.dirname(cachePath), { recursive: true, mode: 0o700 });
  await writeFile(lockPath, `${JSON.stringify({ schemaVersion: 1, owner, createdAt })}\n`, { mode: 0o600 });
  return lockPath;
}

test("preserves an active task-owned lock and does not start a competing check", async (t) => {
  const { pluginRoot, home } = await fixture(t);
  const lockPath = await writeLock({
    home,
    createdAt: new Date(Date.now() - 120_000).toISOString(),
    owner: `game-design-update-check:${process.pid}-live-owner`,
  });
  const calls = [];

  const result = await checkGameDesignUpdates({ pluginRoot, home, now: Date.parse(CHECKED_AT), fetchFn: checkingFetch(calls) });

  assert.equal(result.status, "unknown");
  assert.equal(calls.length, 0);
  assert.equal((await lstat(lockPath)).isDirectory(), true);
});

test("reclaims a provably stale file lock and completes the check", async (t) => {
  const { pluginRoot, home } = await fixture(t);
  const lockPath = await writeFileLock({ home, createdAt: new Date(Date.now() - 120_000).toISOString() });
  const calls = [];

  const result = await checkGameDesignUpdates({ pluginRoot, home, now: Date.parse(CHECKED_AT), fetchFn: checkingFetch(calls) });

  assert.equal(result.status, "current");
  assert.equal(calls.length, 3);
  await assert.rejects(lstat(lockPath), { code: "ENOENT" });
});

test("keeps stale empty legacy directories unknown because they cannot have a retired hard-link anchor", async (t) => {
  const { pluginRoot, home } = await fixture(t);
  const cachePath = resolveUpdateCachePath({ env: {}, home, platform: process.platform });
  const lockPath = `${cachePath}.lock`;
  await mkdir(path.dirname(cachePath), { recursive: true });
  await mkdir(lockPath, { mode: 0o700 });
  await utimes(lockPath, new Date(Date.now() - 120_000), new Date(Date.now() - 120_000));
  const calls = [];
  const result = await checkGameDesignUpdates({ pluginRoot, home, now: Date.parse(CHECKED_AT), fetchFn: checkingFetch(calls) });

  assert.deepEqual(result, expectedUnknownResult());
  assert.equal(calls.length, 0);
  assert.equal((await lstat(lockPath)).isDirectory(), true);
  assert.deepEqual(await readdir(lockPath), []);
});

test("staging cleanup preserves an externally swapped canonical lock tree", async (t) => {
  const { pluginRoot, home, root } = await fixture(t);
  const cachePath = resolveUpdateCachePath({ env: {}, home, platform: process.platform });
  const lockPath = `${cachePath}.lock`;
  const externalPath = path.join(root, "external-lock");
  const externalOwnerPath = path.join(externalPath, "owner.json");
  await mkdir(path.dirname(cachePath), { recursive: true });
  await mkdir(externalPath);
  await writeFile(externalOwnerPath, "external sentinel bytes\n");
  await writeFile(path.join(externalPath, "keep.txt"), "external tree bytes\n");
  const beforeEntries = await readdir(externalPath);
  const beforeOwner = await readFile(externalOwnerPath, "utf8");
  const beforeKeep = await readFile(path.join(externalPath, "keep.txt"), "utf8");
  const calls = [];
  let swapped = false;

  const result = await checkGameDesignUpdates({
    pluginRoot,
    home,
    now: Date.parse(CHECKED_AT),
    fetchFn: checkingFetch(calls),
    fsOps: {
      open: async (filePath, ...args) => {
        if (filePath === path.join(lockPath, "owner.json")) {
          await rm(lockPath, { recursive: true, force: true });
          await symlink(externalPath, lockPath);
          swapped = true;
          throw Object.assign(new Error("injected canonical swap"), { code: "EIO" });
        }
        return open(filePath, ...args);
      },
      link: async (stagingPath, canonicalPath) => {
        if (!swapped) {
          await symlink(externalPath, canonicalPath);
          swapped = true;
        }
        return link(stagingPath, canonicalPath);
      },
    },
  });

  // Catches createOwnedLock catch cleanup that unlinks lockPath/owner.json after a swap.
  assert.equal(swapped, true);
  assert.deepEqual(result, {
    schemaVersion: 1,
    checkedAt: CHECKED_AT,
    cache: "miss",
    status: "unknown",
    components: INSTALLED.map(({ id, installedTag }) => ({ id, installedTag, latestTag: null, status: "unknown", releaseUrl: null })),
    notification: null,
  });
  assert.equal(calls.length, 0);
  assert.deepEqual(await readdir(externalPath), beforeEntries);
  assert.equal(await readFile(externalOwnerPath, "utf8"), beforeOwner);
  assert.equal(await readFile(path.join(externalPath, "keep.txt"), "utf8"), beforeKeep);
  assert.equal((await lstat(lockPath)).isSymbolicLink(), true);
  assert.deepEqual(await readdir(path.dirname(cachePath)), [path.basename(lockPath)]);
});

for (const [faultPoint, faults] of [
  ["staging rename", {
    rename: async (from, to) => {
      if (from.includes(".staging.")) throw Object.assign(new Error("injected staging rename interruption"), { code: "EIO" });
      return rename(from, to);
    },
  }],
  ["cleanup unlink", {
    unlink: async (filePath) => {
      if (filePath.includes(".staging.")) throw Object.assign(new Error("injected cleanup unlink interruption"), { code: "EIO" });
      return unlink(filePath);
    },
  }],
]) {
  test(`preserves a live task-owned hard-link pair after ${faultPoint} interruption`, async (t) => {
    const { pluginRoot, home } = await fixture(t);
    const cachePath = resolveUpdateCachePath({ env: {}, home, platform: process.platform });
    const lockPath = `${cachePath}.lock`;
    const calls = [];

    const interrupted = await checkGameDesignUpdates({
      pluginRoot,
      home,
      now: Date.parse(CHECKED_AT),
      fetchFn: checkingFetch(calls),
      fsOps: faults,
    });

    // Catches a mutation that treats a live nlink=2 publication as stale crash residue.
    assert.equal(interrupted.status, "current");
    assert.equal(interrupted.cache, "miss");
    assert.equal(calls.length, 3);
    const interruptedEntries = await readdir(path.dirname(cachePath));
    const siblingName = interruptedEntries.find((name) => name.startsWith(`${path.basename(lockPath)}.staging.`));
    assert.deepEqual(interruptedEntries.sort(), [path.basename(cachePath), path.basename(lockPath), siblingName].sort());
    assert.equal(typeof siblingName, "string");
    const canonicalBefore = await lstat(lockPath);
    const siblingBefore = await lstat(path.join(path.dirname(cachePath), siblingName));
    assert.equal(canonicalBefore.isFile(), true);
    assert.equal(siblingBefore.isFile(), true);
    assert.equal(canonicalBefore.dev, siblingBefore.dev);
    assert.equal(canonicalBefore.ino, siblingBefore.ino);
    assert.equal(canonicalBefore.nlink, 2);
    assert.equal(siblingBefore.nlink, 2);

    const contenderCalls = [];
    const contender = await checkGameDesignUpdates({ pluginRoot, home, now: Date.parse(CHECKED_AT), fetchFn: checkingFetch(contenderCalls) });

    assert.equal(contender.status, "current");
    assert.equal(contender.cache, "hit");
    assert.equal(contenderCalls.length, 0);
    const canonicalAfter = await lstat(lockPath);
    assert.equal(canonicalAfter.isFile(), true);
    assert.equal(canonicalAfter.nlink, 2);
    assert.deepEqual((await readdir(path.dirname(cachePath))).sort(), [path.basename(cachePath), path.basename(lockPath), siblingName].sort());
  });
}

test("reclaims an interrupted hard-link publication only after stale owner death is proven", async (t) => {
  const { pluginRoot, home } = await fixture(t);
  const cachePath = resolveUpdateCachePath({ env: {}, home, platform: process.platform });
  const lockPath = `${cachePath}.lock`;
  const owner = "game-design-update-check:99999999-dead-owner";
  const metadata = `${JSON.stringify({ schemaVersion: 1, owner, createdAt: new Date(Date.now() - 120_000).toISOString() })}\n`;
  const stagingPath = `${lockPath}.staging.dead-owner`;
  await mkdir(path.dirname(cachePath), { recursive: true });
  await writeFile(lockPath, metadata, { mode: 0o600 });
  await link(lockPath, stagingPath);
  const calls = [];

  const result = await checkGameDesignUpdates({ pluginRoot, home, now: Date.parse(CHECKED_AT), fetchFn: checkingFetch(calls) });

  // Catches a mutation that never accepts a stale nlink=2 task-owned publication.
  assert.equal(result.status, "current");
  assert.equal(calls.length, 3);
  await assert.rejects(lstat(lockPath), { code: "ENOENT" });
  await assert.rejects(lstat(stagingPath), { code: "ENOENT" });
  assert.deepEqual((await readdir(path.dirname(cachePath))).filter((name) => !name.includes(".recovery.")).sort(), [path.basename(cachePath)]);
});

test("a contender never normalizes a live winner between link publication and cleanup", async (t) => {
  const { pluginRoot, home } = await fixture(t);
  const cachePath = resolveUpdateCachePath({ env: {}, home, platform: process.platform });
  const lockPath = `${cachePath}.lock`;
  const published = deferred();
  const resumeWinner = deferred();
  const contenderWaited = deferred();
  const contenderNormalizeAttempted = deferred();
  const calls = [];
  let winnerStagingPath;
  let contenderLinkFailed = false;
  const winner = checkGameDesignUpdates({
    pluginRoot,
    home,
    now: Date.parse(CHECKED_AT),
    fetchFn: checkingFetch(calls),
    fsOps: {
      link: async (stagingPath, canonicalPath) => {
        await link(stagingPath, canonicalPath);
        winnerStagingPath = stagingPath;
        published.resolve();
        await resumeWinner.promise;
      },
    },
  });
  await published.promise;
  const contender = checkGameDesignUpdates({
    pluginRoot,
    home,
    now: Date.parse(CHECKED_AT),
    fetchFn: checkingFetch(calls),
    fsOps: {
      link: async (stagingPath, canonicalPath) => {
        contenderLinkFailed = true;
        return link(stagingPath, canonicalPath);
      },
      rename: async (from, to) => {
        if (from === winnerStagingPath) contenderNormalizeAttempted.resolve();
        return rename(from, to);
      },
      lstat: async (target) => {
        try {
          return await lstat(target);
        } finally {
          if (target === cachePath && contenderLinkFailed) contenderWaited.resolve();
        }
      },
    },
  });

  const progression = await Promise.race([
    contenderWaited.promise.then(() => "wait"),
    contenderNormalizeAttempted.promise.then(() => "normalize"),
  ]);
  assert.equal(progression, "wait");
  resumeWinner.resolve();
  const results = await Promise.all([winner, contender]);

  // Catches normalizeLinkedStagingLock before a live owner is proved stale and dead.
  assert.equal(calls.length, 3);
  assert.deepEqual(results.map(({ status }) => status), ["current", "current"]);
  assert.deepEqual(results.map(({ cache }) => cache).sort(), ["hit", "miss"]);
  await assert.rejects(lstat(lockPath), { code: "ENOENT" });
  assert.deepEqual(await readdir(path.dirname(cachePath)), [path.basename(cachePath)]);
});

test("preserves ambiguous linked residue and external siblings without network access", async (t) => {
  for (const [name, addAmbiguity] of [
    ["symlink", async ({ root, lockPath, stagingPath }) => {
      const externalPath = path.join(root, "external-sibling");
      await mkdir(externalPath);
      await writeFile(path.join(externalPath, "sentinel.txt"), "external bytes\n");
      await symlink(externalPath, `${stagingPath}.symlink`);
      return { externalPath, before: await readFile(path.join(externalPath, "sentinel.txt"), "utf8") };
    }],
    ["different-inode", async ({ stagingPath }) => {
      await writeFile(`${stagingPath}.different`, "unrelated bytes\n", { mode: 0o600 });
      return null;
    }],
    ["multiple-hard-links", async ({ lockPath, stagingPath }) => {
      await link(lockPath, `${stagingPath}.second`);
      return null;
    }],
  ]) {
    const { pluginRoot, home, root } = await fixture(t);
    const cachePath = resolveUpdateCachePath({ env: {}, home, platform: process.platform });
    const lockPath = `${cachePath}.lock`;
    const stagingPath = `${lockPath}.staging.dead-owner`;
    const metadata = `${JSON.stringify({ schemaVersion: 1, owner: "game-design-update-check:99999999-dead-owner", createdAt: new Date(Date.now() - 120_000).toISOString() })}\n`;
    await mkdir(path.dirname(cachePath), { recursive: true });
    await writeFile(lockPath, metadata, { mode: 0o600 });
    await link(lockPath, stagingPath);
    const external = await addAmbiguity({ root, lockPath, stagingPath });
    const beforeEntries = (await readdir(path.dirname(cachePath))).sort();
    const calls = [];

    const result = await checkGameDesignUpdates({ pluginRoot, home, now: Date.parse(CHECKED_AT), fetchFn: checkingFetch(calls) });

    assert.deepEqual(result, expectedUnknownResult(), name);
    assert.equal(calls.length, 0, name);
    assert.deepEqual((await readdir(path.dirname(cachePath))).sort(), beforeEntries, name);
    assert.equal((await lstat(lockPath)).isFile(), true, name);
    if (external !== null) assert.equal(await readFile(path.join(external.externalPath, "sentinel.txt"), "utf8"), external.before, name);
  }
});

test("preserves a linked owner when PID probing cannot prove ESRCH", async (t) => {
  const { pluginRoot, home } = await fixture(t);
  const cachePath = resolveUpdateCachePath({ env: {}, home, platform: process.platform });
  const lockPath = `${cachePath}.lock`;
  const stagingPath = `${lockPath}.staging-unproven-owner`;
  const metadata = `${JSON.stringify({ schemaVersion: 1, owner: "game-design-update-check:1-unproven-owner", createdAt: new Date(Date.now() - 120_000).toISOString() })}\n`;
  await mkdir(path.dirname(cachePath), { recursive: true });
  await writeFile(lockPath, metadata, { mode: 0o600 });
  await link(lockPath, stagingPath);
  const calls = [];

  const result = await checkGameDesignUpdates({ pluginRoot, home, now: Date.parse(CHECKED_AT), fetchFn: checkingFetch(calls) });

  assert.deepEqual(result, expectedUnknownResult());
  assert.equal(calls.length, 0);
  assert.equal((await lstat(lockPath)).nlink, 2);
  assert.deepEqual((await readdir(path.dirname(cachePath))).sort(), [path.basename(lockPath), path.basename(stagingPath)].sort());
});

test("stale legacy directory recovery performs no canonical mutation", async (t) => {
  const { pluginRoot, home } = await fixture(t);
  const cachePath = resolveUpdateCachePath({ env: {}, home, platform: process.platform });
  const lockPath = `${cachePath}.lock`;
  await mkdir(path.dirname(cachePath), { recursive: true });
  await mkdir(lockPath, { mode: 0o700 });
  await utimes(lockPath, new Date(Date.now() - 120_000), new Date(Date.now() - 120_000));
  const calls = [];
  const result = await checkGameDesignUpdates({ pluginRoot, home, now: Date.parse(CHECKED_AT), fetchFn: checkingFetch(calls) });

  assert.deepEqual(result, expectedUnknownResult());
  assert.equal(calls.length, 0);
  const activeStat = await lstat(lockPath);
  assert.equal(activeStat.isDirectory(), true);
  assert.deepEqual(await readdir(path.dirname(cachePath)), [path.basename(lockPath)]);
});

test("never reclaims symlink or hostile lock directories", async (t) => {
  const { pluginRoot, home, root } = await fixture(t);
  const cachePath = resolveUpdateCachePath({ env: {}, home, platform: process.platform });
  await mkdir(path.dirname(cachePath), { recursive: true });
  const outside = path.join(root, "outside-lock");
  await mkdir(outside);
  await writeFile(path.join(outside, "keep.txt"), "outside\n");
  await symlink(outside, `${cachePath}.lock`);
  const symlinkCalls = [];

  const symlinkResult = await checkGameDesignUpdates({ pluginRoot, home, now: Date.parse(CHECKED_AT), fetchFn: checkingFetch(symlinkCalls) });
  assert.equal(symlinkResult.status, "unknown");
  assert.equal(symlinkCalls.length, 0);
  assert.equal((await lstat(`${cachePath}.lock`)).isSymbolicLink(), true);
  assert.equal(await readFile(path.join(outside, "keep.txt"), "utf8"), "outside\n");

  await rm(`${cachePath}.lock`);
  const hostilePath = await writeLock({ home, createdAt: new Date(Date.now() - 120_000).toISOString(), extra: true });
  const hostileCalls = [];
  const hostileResult = await checkGameDesignUpdates({ pluginRoot, home, now: Date.parse(CHECKED_AT), fetchFn: checkingFetch(hostileCalls) });
  assert.equal(hostileResult.status, "unknown");
  assert.equal(hostileCalls.length, 0);
  assert.deepEqual((await readdir(hostilePath)).sort(), ["hostile.txt", "owner.json"]);
});

test("concurrent contenders recover one stale lock with one network winner", async (t) => {
  const { pluginRoot, home } = await fixture(t);
  await writeFileLock({ home, createdAt: new Date(Date.now() - 120_000).toISOString() });
  const calls = [];
  const fetchFn = checkingFetch(calls);

  const first = checkGameDesignUpdates({ pluginRoot, home, now: Date.parse(CHECKED_AT), fetchFn });
  const second = checkGameDesignUpdates({ pluginRoot, home, now: Date.parse(CHECKED_AT), fetchFn });
  const results = await Promise.all([first, second]);

  assert.equal(calls.length, 3);
  assert.deepEqual(results.map(({ status }) => status), ["current", "current"]);
  assert.deepEqual(results.map(({ cache }) => cache).sort(), ["hit", "miss"]);
});

test("a stale recovery contender cannot move a fresh publisher into its release path", async (t) => {
  const { pluginRoot, home } = await fixture(t);
  const cachePath = resolveUpdateCachePath({ env: {}, home, platform: process.platform });
  const lockPath = `${cachePath}.lock`;
  const staleOwner = "game-design-update-check:99999999-dead-owner";
  const freshOwner = `game-design-update-check:${process.pid}-fresh-publisher`;
  const freshLock = `${JSON.stringify({ schemaVersion: 1, owner: freshOwner, createdAt: new Date().toISOString() })}\n`;
  await mkdir(path.dirname(cachePath), { recursive: true });
  await writeFile(lockPath, `${JSON.stringify({
    schemaVersion: 1,
    owner: staleOwner,
    createdAt: new Date(Date.now() - 120_000).toISOString(),
  })}\n`, { mode: 0o600 });
  const calls = [];
  let legacyReleaseAttempted = false;

  const result = await checkGameDesignUpdates({
    pluginRoot,
    home,
    now: Date.parse(CHECKED_AT),
    fetchFn: checkingFetch(calls),
    fsOps: {
      rename: async (from, to) => {
        if (from === lockPath && to.includes(".release.")) {
          legacyReleaseAttempted = true;
          await unlink(lockPath);
          await writeFile(lockPath, freshLock, { mode: 0o600 });
        }
        return rename(from, to);
      },
    },
  });

  // Catches removeOwnedLock's check-then-rename ABA: a delayed stale contender
  // must have no operation that can move a newer canonical publisher.
  assert.equal(result.status, "current");
  assert.equal(calls.length, 3);
  if (legacyReleaseAttempted) {
    assert.equal(await readFile(lockPath, "utf8"), freshLock);
    assert.equal((await lstat(lockPath)).isFile(), true);
  }
  assert.equal((await readdir(path.dirname(cachePath))).some((name) => name.includes(".release.")), false);
});

test("rejects empty, missing, partial, duplicate, and unknown installed manifests without network or cache publication", async (t) => {
  const manifestCases = [
    ["empty", { schemaVersion: 1, components: [] }],
    ["partial", { schemaVersion: 1, components: INSTALLED.slice(0, 2) }],
    ["duplicate", { schemaVersion: 1, components: [INSTALLED[0], INSTALLED[1], INSTALLED[1]] }],
    ["unknown-id", { schemaVersion: 1, components: [{ ...INSTALLED[0], id: "untrusted-component" }, INSTALLED[1], INSTALLED[2]] }],
    ["unknown-key", { schemaVersion: 1, components: INSTALLED, untrusted: true }],
    ["missing", null],
  ];
  for (const [name, manifest] of manifestCases) {
    const { pluginRoot, home } = await fixture(t, { manifest });
    if (name === "missing") await rm(path.join(pluginRoot, "shared", "updates", "installed-components.json"));
    const calls = [];
    let publications = 0;

    const result = await checkGameDesignUpdates({
      pluginRoot,
      home,
      now: Date.parse(CHECKED_AT),
      fetchFn: checkingFetch(calls),
      fsOps: { rename: async () => { publications += 1; } },
    });

    assert.equal(result.status, "unknown");
    assert.equal(calls.length, 0);
    assert.equal(publications, 0);
    await assert.rejects(lstat(resolveUpdateCachePath({ env: {}, home, platform: process.platform })), { code: "ENOENT" });
  }
});

test("fails open to closed unknown evidence for HTTP, malformed JSON, and hostile redirects", async (t) => {
  const { pluginRoot, home } = await fixture(t);
  const hostileCases = [
    ["403", () => response(ENDPOINTS[0], [], { status: 403 })],
    ["404", () => response(ENDPOINTS[0], [], { status: 404 })],
    ["429", () => response(ENDPOINTS[0], [], { status: 429 })],
    ["500", () => response(ENDPOINTS[0], [], { status: 500 })],
    ["malformed", () => response(ENDPOINTS[0], { releases: [] })],
    ["redirect", () => response(ENDPOINTS[0], [], { responseUrl: "https://untrusted.example/releases" })],
  ];

  for (const [name, firstResponse] of hostileCases) {
    const calls = [];
    const result = await checkGameDesignUpdates({
      pluginRoot,
      home: path.join(home, name),
      now: Date.parse(CHECKED_AT),
      fetchFn: checkingFetch(calls, (url) => url === ENDPOINTS[0] ? firstResponse() : currentResponse(url)),
    });
    assert.deepEqual(result, {
      schemaVersion: 1,
      checkedAt: CHECKED_AT,
      cache: "miss",
      status: "unknown",
      components: INSTALLED.map(({ id, installedTag }) => ({ id, installedTag, latestTag: null, status: "unknown", releaseUrl: null })),
      notification: null,
    }, name);
    assert.equal(calls.length, 1, name);
  }
});

test("aborts a never-resolving fetch at the policy timeout and returns bounded unknown evidence", async (t) => {
  const { pluginRoot, home } = await fixture(t, { policyOverrides: { totalTimeoutMs: 20 } });
  let signal;
  const startedAt = Date.now();
  const result = await checkGameDesignUpdates({
    pluginRoot,
    home,
    now: Date.parse(CHECKED_AT),
    fetchFn: async (_url, options) => {
      signal = options.signal;
      return new Promise(() => undefined);
    },
  });

  assert.equal(result.status, "unknown");
  assert.equal(signal?.aborted, true);
  assert.ok(Date.now() - startedAt < 500);
});

test("opt-out performs neither cache writes nor network calls", async (t) => {
  const { pluginRoot, home } = await fixture(t);
  const calls = [];
  const result = await checkGameDesignUpdates({
    pluginRoot,
    home,
    now: Date.parse(CHECKED_AT),
    env: { GAME_DESIGN_UPDATE_CHECKS: "false" },
    fetchFn: checkingFetch(calls),
  });

  assert.deepEqual(result, {
    schemaVersion: 1,
    checkedAt: CHECKED_AT,
    cache: "disabled",
    status: "disabled",
    components: [],
    notification: null,
  });
  assert.equal(calls.length, 0);
  await assert.rejects(lstat(resolveUpdateCachePath({ env: {}, home, platform: process.platform })), { code: "ENOENT" });
});

test("publishes cache atomically and leaves prior evidence intact when publication fails", async (t) => {
  const { pluginRoot, home } = await fixture(t);
  const cachePath = await writeCache({ home, value: cacheValue({ checkedAt: "2026-08-01T00:00:00.000Z" }) });
  const before = await readFile(cachePath, "utf8");
  const calls = [];
  const result = await checkGameDesignUpdates({
    pluginRoot,
    home,
    now: Date.parse(CHECKED_AT),
    fetchFn: checkingFetch(calls),
    fsOps: {
      rename: async (from, to) => {
        if (from.endsWith(".tmp")) throw Object.assign(new Error("rename failed"), { code: "EIO" });
        return rename(from, to);
      },
    },
  });

  assert.equal(result.status, "unknown");
  assert.equal(await readFile(cachePath, "utf8"), before);
  assert.equal(calls.length, 3);
});
