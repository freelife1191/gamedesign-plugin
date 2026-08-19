import assert from "node:assert/strict";
import { constants } from "node:fs";
import { chmod, mkdtemp, readFile, readdir, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import { canonicalMemoryEventDocument } from "../../shared/scripts/validate-design-memory.mjs";
import { relocateModuleImports } from "../lib/relocated-module-source.mjs";
import { directoryHandleSupported, directorySyncSupported, noFollowOpenFlag, openDirectoryHandle, posixPermissionBitsMeaningful, syncDirectory } from "../../shared/scripts/lib/platform-file-hardening.mjs";

const hardeningPath = fileURLToPath(new URL("../../shared/scripts/lib/platform-file-hardening.mjs", import.meta.url));
const storePath = fileURLToPath(new URL("../../shared/scripts/lib/safe-memory-store.mjs", import.meta.url));
const workspaceEnvPath = fileURLToPath(new URL("../../shared/scripts/lib/load-workspace-env.mjs", import.meta.url));
const POSIX_PLATFORMS = ["linux", "darwin", "freebsd", "openbsd", "sunos", "aix"];

async function scratch(t, prefix) {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), prefix)));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

// The point of the suite is what happens on Windows, and the suite does not run there. So rather than
// hand-writing a Windows-shaped stub — which would only prove the stub — this drives the real module
// with Windows inputs and hands the result to the real consumer. Any consumer that reached around the
// primitive to `constants.O_NOFOLLOW` or opened a directory itself fails these two tests on any host.
async function windowsShapedModule(root, consumerPath, name) {
  const stubPath = path.join(root, "windows-hardening.mjs");
  const realUrl = JSON.stringify(pathToFileURL(hardeningPath).href);
  await writeFile(stubPath, [
    `import { directorySyncSupported, noFollowOpenFlag, posixPermissionBitsMeaningful, syncDirectory } from ${realUrl};`,
    'const windows = { platform: "win32", fsConstants: {} };',
    "const noFollow = () => noFollowOpenFlag(windows);",
    "const supported = () => directorySyncSupported(windows.platform);",
    "const permissions = () => posixPermissionBitsMeaningful(windows.platform);",
    'const refuse = () => { throw new Error("Windows cannot open a directory handle."); };',
    "const sync = (candidate) => syncDirectory(candidate, { platform: windows.platform, openFn: refuse });",
    "export { noFollow as noFollowOpenFlag, supported as directorySyncSupported, permissions as posixPermissionBitsMeaningful, sync as syncDirectory };",
  ].join("\n"));
  const relocated = relocateModuleImports(await readFile(consumerPath, "utf8"), path.dirname(consumerPath));
  const hardeningUrl = JSON.stringify(pathToFileURL(hardeningPath).href);
  assert.equal(relocated.split(hardeningUrl).length - 1, 1, `${name} must reach no-follow and directory sync through the primitive`);
  const modulePath = path.join(root, name);
  await writeFile(modulePath, relocated.split(hardeningUrl).join(JSON.stringify(pathToFileURL(stubPath).href)));
  return import(pathToFileURL(modulePath).href);
}

// Windows defines neither `O_NOFOLLOW` nor `O_DIRECTORY`, so reading them off the host's `constants`
// there compares `undefined` against `undefined` and proves nothing — and asserting the shipped
// function returns `undefined` would assert the opposite of what it must do. Where the host defines
// them the real numbers are used; where it does not, a POSIX-shaped set stands in so the flag
// combination is still the subject on every host.
const HOST_DEFINES_POSIX_OPEN_FLAGS = Number.isInteger(constants.O_NOFOLLOW) && Number.isInteger(constants.O_DIRECTORY);
const POSIX_CONSTANTS = HOST_DEFINES_POSIX_OPEN_FLAGS
  ? constants
  : { ...constants, O_RDONLY: 0, O_NOFOLLOW: 0x0100, O_DIRECTORY: 0x10000 };

test("the no-follow flag is the real constant wherever the platform defines one", () => {
  if (Number.isInteger(constants.O_NOFOLLOW)) {
    assert.equal(noFollowOpenFlag(), constants.O_NOFOLLOW);
    for (const platform of [...POSIX_PLATFORMS, "win32"]) {
      assert.equal(noFollowOpenFlag({ platform }), constants.O_NOFOLLOW);
    }
    return;
  }
  // A host whose own fs constants omit the flag — Windows. The exemption applies to this host and to
  // win32 as an argument; every POSIX platform named on such a host is a broken host and still fails.
  assert.equal(noFollowOpenFlag(), 0, "the running platform must be one the exemption covers");
  assert.equal(noFollowOpenFlag({ platform: "win32" }), 0);
  for (const platform of POSIX_PLATFORMS) {
    assert.throws(
      () => noFollowOpenFlag({ platform }),
      (error) => error instanceof Error && error.message === "Secure no-follow file opening is unavailable.",
      `${platform} must not silently drop the no-follow guarantee`,
    );
  }
});

test("a platform that never defines the no-follow flag resolves it to zero, and every other platform fails closed", () => {
  for (const missing of [{}, { O_NOFOLLOW: undefined }, { O_NOFOLLOW: null }, { O_NOFOLLOW: "256" }, { O_NOFOLLOW: 1.5 }, { O_NOFOLLOW: Number.NaN }]) {
    assert.equal(noFollowOpenFlag({ platform: "win32", fsConstants: missing }), 0);
    for (const platform of POSIX_PLATFORMS) {
      assert.throws(
        () => noFollowOpenFlag({ platform, fsConstants: missing }),
        (error) => error instanceof Error && error.message === "Secure no-follow file opening is unavailable.",
        `${platform} must not silently drop the no-follow guarantee`,
      );
    }
  }
});

test("permission bits are read as permissions only where they are permissions", () => {
  assert.equal(posixPermissionBitsMeaningful(), process.platform !== "win32");
  assert.equal(posixPermissionBitsMeaningful("win32"), false);
  for (const platform of POSIX_PLATFORMS) assert.equal(posixPermissionBitsMeaningful(platform), true);
});

test("directory sync is available on every platform except the one that cannot offer it", () => {
  assert.equal(directorySyncSupported(), process.platform !== "win32");
  assert.equal(directorySyncSupported("win32"), false);
  for (const platform of POSIX_PLATFORMS) assert.equal(directorySyncSupported(platform), true);
});

test("a Windows directory sync opens nothing and reports the platform as the reason", async () => {
  const opens = [];
  const result = await syncDirectory("/any/directory", {
    platform: "win32",
    openFn: (...args) => { opens.push(args); throw new Error("must not open"); },
  });
  assert.deepEqual(result, { synced: false, reason: "platform_unsupported" });
  assert.deepEqual(opens, []);
});

test("a POSIX directory sync opens read-only with no-follow, syncs, and closes even when the sync fails", async (t) => {
  const root = await scratch(t, "directory-sync-");
  const calls = [];
  const closes = [];
  const handle = {
    sync: async () => { calls.push("sync"); },
    close: async () => { closes.push("close"); },
  };
  const result = await syncDirectory(root, {
    platform: "linux",
    fsConstants: POSIX_CONSTANTS,
    openFn: async (target, flags) => { calls.push([target, flags]); return handle; },
  });
  assert.deepEqual(result, { synced: true });
  assert.deepEqual(calls, [[root, POSIX_CONSTANTS.O_RDONLY | POSIX_CONSTANTS.O_NOFOLLOW], "sync"]);
  assert.deepEqual(closes, ["close"]);

  await assert.rejects(
    () => syncDirectory(root, { platform: "linux", fsConstants: POSIX_CONSTANTS, openFn: async () => ({ sync: async () => { throw new Error("EPERM"); }, close: async () => { closes.push("close-after-failure"); } }) }),
    (error) => error.message === "EPERM",
  );
  assert.deepEqual(closes, ["close", "close-after-failure"]);
});

test("a directory handle is available on every platform except the one that cannot return one", () => {
  assert.equal(directoryHandleSupported(), process.platform !== "win32");
  assert.equal(directoryHandleSupported("win32"), false);
  for (const platform of POSIX_PLATFORMS) assert.equal(directoryHandleSupported(platform), true);
});

test("a Windows directory open returns no handle and opens nothing, while a POSIX one fails closed without the constant", async () => {
  const opens = [];
  assert.equal(
    await openDirectoryHandle("/any/directory", { platform: "win32", openFn: (...args) => { opens.push(args); throw new Error("must not open"); }, fsConstants: {} }),
    null,
    "a platform with no directory handle must report that, not attempt an open that fails inside the caller",
  );
  assert.deepEqual(opens, []);

  // Same shape as the no-follow flag: a POSIX host missing the constant is a broken host, not an exempt
  // one, and must keep failing rather than opening without the guarantee.
  for (const platform of POSIX_PLATFORMS) {
    await assert.rejects(
      () => openDirectoryHandle("/any/directory", { platform, openFn: async () => { throw new Error("must not open"); }, fsConstants: {} }),
      (error) => error instanceof Error && error.message === "Secure directory opening is unavailable.",
      `${platform} must not silently drop the directory-handle guarantee`,
    );
  }
});

test("a POSIX directory open asks for read-only, directory, and no-follow together", async (t) => {
  const root = await scratch(t, "directory-handle-");
  const calls = [];
  const sentinel = { stat: async () => ({}), close: async () => {} };
  const handle = await openDirectoryHandle(root, {
    platform: "linux",
    fsConstants: POSIX_CONSTANTS,
    openFn: async (target, flags) => { calls.push([target, flags]); return sentinel; },
  });
  assert.equal(handle, sentinel);
  assert.deepEqual(calls, [[root, POSIX_CONSTANTS.O_RDONLY | POSIX_CONSTANTS.O_DIRECTORY | POSIX_CONSTANTS.O_NOFOLLOW]]);
});

test("this host really pins a real directory by handle", { skip: process.platform === "win32" }, async (t) => {
  const root = await scratch(t, "directory-handle-real-");
  await writeFile(path.join(root, "entry"), "contents");
  const handle = await openDirectoryHandle(root);
  try {
    const stats = await handle.stat();
    assert.equal(stats.isDirectory(), true);
  } finally {
    await handle.close();
  }
});

test("this host really syncs a real directory", { skip: process.platform === "win32" }, async (t) => {
  const root = await scratch(t, "directory-sync-real-");
  await writeFile(path.join(root, "entry"), "contents");
  assert.deepEqual(await syncDirectory(root), { synced: true });
});

test("the workspace dotenv reader still reads and still rejects a symlink with no no-follow flag available", async (t) => {
  const root = await scratch(t, "windows-workspace-env-");
  const { readWorkspaceEnv } = await windowsShapedModule(root, workspaceEnvPath, "load-workspace-env.mjs");

  const good = await scratch(t, "windows-env-good-");
  await writeFile(path.join(good, ".env"), "ALLOWED=file-value\n", { mode: 0o600 });
  let flags;
  const result = await readWorkspaceEnv({
    workspaceRoot: good,
    env: {},
    supportedKeys: ["ALLOWED"],
    openFileFn: async (target, openFlags) => {
      flags = openFlags;
      return (await import("node:fs/promises")).open(target, openFlags);
    },
  });
  assert.equal(flags, constants.O_RDONLY, "a Windows open carries the read-only flag and nothing else");
  assert.deepEqual(result.values, { ALLOWED: "file-value" });

  // The lstat that precedes the open is what refuses this, not the flag — which is the whole argument
  // for letting the flag be zero on the one platform that cannot supply it.
  const hostile = await scratch(t, "windows-env-symlink-");
  await writeFile(path.join(hostile, "target.env"), "ALLOWED=stolen\n", { mode: 0o600 });
  await symlink(path.join(hostile, "target.env"), path.join(hostile, ".env"));
  await assert.rejects(
    () => readWorkspaceEnv({ workspaceRoot: hostile, env: {}, supportedKeys: ["ALLOWED"] }),
    (error) => error.message === "Workspace .env symlinks are not allowed.",
  );

  // A world-readable dotenv is a real finding on POSIX and an unanswerable question on Windows, where
  // the same mode number appears whatever the ACL is. The reader says so by warning on one and not the
  // other, rather than emitting advice a Windows user has no way to act on.
  const exposed = await scratch(t, "windows-env-mode-");
  await writeFile(path.join(exposed, ".env"), "ALLOWED=file-value\n", { mode: 0o644 });
  await chmod(path.join(exposed, ".env"), 0o644);
  const windowsShaped = await readWorkspaceEnv({ workspaceRoot: exposed, env: {}, supportedKeys: ["ALLOWED"] });
  assert.deepEqual(windowsShaped.warnings, []);
  const { readWorkspaceEnv: hostReader } = await import("../../shared/scripts/lib/load-workspace-env.mjs");
  const hostShaped = await hostReader({ workspaceRoot: exposed, env: {}, supportedKeys: ["ALLOWED"] });
  assert.deepEqual(hostShaped.warnings.map(({ code }) => code), process.platform === "win32" ? [] : ["insecure_permissions"]);
});

test("the design memory store commits a sealed event with no no-follow flag and no directory sync", async (t) => {
  const root = await scratch(t, "windows-memory-store-");
  const store = await windowsShapedModule(root, storePath, "safe-memory-store.mjs");
  const workspaceRoot = await scratch(t, "windows-memory-workspace-");

  const record = {
    schema_version: 1,
    memory_id: "memory-studio-design-lesson-0f2a4c61d9ab34ef",
    kind: "design-lesson",
    lane: "studio",
    status: "candidate",
    scope: "project",
    project_id: "wind-island",
    created_at: "2026-08-12T00:00:00.000Z",
    updated_at: "2026-08-12T00:00:00.000Z",
    review_after: "2026-09-11",
    expires_at: "2026-09-11",
    approved_by: null,
    approval_basis: null,
    supersedes: null,
    artifact_types: ["artifact"],
    related_ids: ["related"],
    tags: ["tag"],
    sources: [{ artifact_id: "source", locator: "content.md#h", sha256: "a".repeat(64) }],
  };
  const sections = { "발견한 내용": "내용", "적용 조건": "조건", "적용하면 안 되는 경우": "제외", "근거": "근거" };
  const eventDocument = canonicalMemoryEventDocument({
    schema_version: 1,
    event_type: "capture",
    action: "capture",
    memory_id: record.memory_id,
    operation_id: "capture-upstream-1",
    parent_event_ids: [],
    effective_at: "2026-08-12T00:00:00.000Z",
    actor: "author",
    reason: "capture",
    record,
  }, sections);

  const resolved = await store.resolveMemoryStore({
    workspaceRoot,
    config: { enabled: true, scope: "project", gitMode: "local", projectId: "wind-island" },
    platform: "linux",
    home: workspaceRoot,
    initialize: true,
  });
  const appended = await store.appendMemoryEvent({ store: resolved, eventDocument });
  assert.equal(appended.status, "created");

  // The commit is only real if it reads back through the store's own bounded, identity-pinned reader.
  const committed = await store.readCommittedMemoryEvent({
    store: resolved,
    relativePath: appended.relativePath,
    eventId: appended.eventId,
  });
  assert.equal(committed.bytes.toString("utf8"), eventDocument);

  const scan = await store.scanMemoryEvents({ store: resolved });
  assert.equal(scan.complete, true);
  assert.deepEqual(scan.diagnostics ?? [], []);
});

test("no shipped module reaches around the primitive for a no-follow flag or a directory sync", async () => {
  const shippedRoot = fileURLToPath(new URL("../../shared/scripts", import.meta.url));
  const shipped = (await readdir(shippedRoot, { recursive: true, withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith(".mjs"))
    .map((entry) => path.join(entry.parentPath ?? entry.path, entry.name))
    .filter((candidate) => candidate !== hardeningPath)
    .sort();
  assert.ok(shipped.length > 20, "the shipped runtime scan found suspiciously few modules");

  const importers = [];
  for (const candidate of shipped) {
    const source = await readFile(candidate, "utf8");
    // The expected importer list is a repo-relative path list, and repo-relative paths are written with
    // forward slashes wherever they appear in this suite. `path.relative` answers in the host's
    // separator, so Windows would report `lib\\safe-memory-store.mjs` against an expectation that has
    // nothing to do with the platform.
    const label = path.relative(shippedRoot, candidate).split(path.sep).join("/");
    // The raw constant is `undefined` on Windows, and `flags | undefined` quietly becomes `flags` — so
    // naming it directly does not fail there, it drops the guarantee and says nothing. Routing every
    // shipped open through the primitive is what turns that into one declared, allowlisted exemption.
    assert.doesNotMatch(source, /O_NOFOLLOW/u, `${label} must not name the raw no-follow constant`);
    assert.doesNotMatch(source, /O_DIRECTORY/u, `${label} must not name a constant Windows does not define`);
    // `os.homedir()` reads $HOME on POSIX and %USERPROFILE% on Windows. Reading the variable directly
    // resolves to nothing on Windows, and the design memory store's global scope — which has a win32
    // branch — then falls back to the workspace and writes the global store into the wrong place.
    assert.doesNotMatch(source, /process\.env\.HOME\b/u, `${label} must resolve the home directory through os.homedir()`);
    if (/from ["']\.{1,2}(?:\/lib)?\/platform-file-hardening\.mjs["']/u.test(source)) importers.push(label);
  }

  assert.deepEqual(importers, [
    "capability-probe.mjs",
    "check-game-design-updates.mjs",
    "lib/image-reference-loader.mjs",
    "lib/load-workspace-env.mjs",
    "lib/safe-artifact-write.mjs",
    "lib/safe-memory-store.mjs",
    "resolve-quality-profile.mjs",
    "retrieve-design-memory.mjs",
    "validate-design-memory.mjs",
  ]);

  // Only one call site ever needed a directory `fsync`, and it is the one Windows returns EPERM for.
  const storeSource = await readFile(storePath, "utf8");
  assert.equal(storeSource.split("syncDirectory(").length - 1, 1);
  assert.match(storeSource, /await link\(claimPath, commitPath\); await syncDirectory\(path\.dirname\(commitPath\)\);/u);
});
