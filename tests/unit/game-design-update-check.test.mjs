import assert from "node:assert/strict";
import { lstat, mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
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

async function fixture(t) {
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
  })}\n`);
  await writeFile(path.join(pluginRoot, "shared", "updates", "installed-components.json"), `${JSON.stringify({ schemaVersion: 1, components: INSTALLED })}\n`);
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

function cacheValue({ checkedAt = CHECKED_AT, lastNotifiedComponentIds = [], lastNotifiedAt = null } = {}) {
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
    lastNotifiedComponentIds,
  };
}

test("uses the documented OS cache location without exposing it in results", () => {
  assert.equal(resolveUpdateCachePath({ env: { XDG_CACHE_HOME: "/tmp/xdg" }, home: "/home/test", platform: "linux" }), "/tmp/xdg/game-design-suite/update-advisory-v1.json");
  assert.equal(resolveUpdateCachePath({ env: {}, home: "/Users/test", platform: "darwin" }), "/Users/test/Library/Caches/game-design-suite/update-advisory-v1.json");
  assert.equal(resolveUpdateCachePath({ env: { LOCALAPPDATA: "C:\\Cache" }, home: "C:\\Users\\test", platform: "win32" }), path.join("C:\\Cache", "game-design-suite", "update-advisory-v1.json"));
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

test("fails open to closed unknown evidence for HTTP, timeout, malformed JSON, and hostile redirects", async (t) => {
  const { pluginRoot, home } = await fixture(t);
  const hostileCases = [
    ["403", () => response(ENDPOINTS[0], [], { status: 403 })],
    ["404", () => response(ENDPOINTS[0], [], { status: 404 })],
    ["429", () => response(ENDPOINTS[0], [], { status: 429 })],
    ["500", () => response(ENDPOINTS[0], [], { status: 500 })],
    ["timeout", () => { throw Object.assign(new Error("aborted"), { name: "AbortError" }); }],
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
    fsOps: { rename: async () => { throw Object.assign(new Error("rename failed"), { code: "EIO" }); } },
  });

  assert.equal(result.status, "unknown");
  assert.equal(await readFile(cachePath, "utf8"), before);
  assert.equal(calls.length, 3);
});
