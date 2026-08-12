import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, realpath, rename, rm, symlink, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  createMemoryStorePlatformAdapter,
  ensureMemoryGitExclusion,
  memoryRecordRelativePath,
  moveMemoryFileAtomic,
  readMemoryFile,
  resolveMemoryStore,
  writeMemoryFileAtomic,
} from "../../shared/scripts/lib/safe-memory-store.mjs";

async function workspace(t) {
  const root = await mkdtemp(path.join(tmpdir(), "memory-store-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  return realpath(root);
}
const config = (overrides = {}) => ({ enabled: true, scope: "project", gitMode: "local", projectId: "wind-island", ...overrides });

test("disabled or unidentified memory does not resolve or create a store", async (t) => {
  const root = await workspace(t);
  assert.equal(await resolveMemoryStore({ workspaceRoot: root, config: config({ enabled: false }), platform: "linux", home: root }), null);
  assert.equal(await resolveMemoryStore({ workspaceRoot: root, config: config({ projectId: undefined }), platform: "linux", home: root }), null);
  await assert.rejects(() => resolveMemoryStore({ workspaceRoot: root, config: config(), platform: "linux", home: root, initialize: false }), /not initialized|missing/i);
});

test("initialization is explicit and scopes determine the root", async (t) => {
  const root = await workspace(t);
  const project = await resolveMemoryStore({ workspaceRoot: root, config: config(), platform: "linux", home: path.join(root, "home"), initialize: true });
  assert.equal(project.root, path.join(root, ".game-design", "memory"));
  const global = await resolveMemoryStore({ workspaceRoot: root, config: config({ scope: "global" }), platform: "linux", home: path.join(root, "home"), initialize: true });
  assert.equal(global.root, path.join(root, "home", ".local", "share", "game-design-plugin", "memory"));
});

test("global storage paths are fixed for each supported operating system", async (t) => {
  const root = await workspace(t);
  for (const [platform, segments] of [["darwin", ["Library", "Application Support"]], ["linux", [".local", "share"]], ["win32", ["AppData", "Local"]]]) {
    const home = path.join(root, platform);
    const store = await resolveMemoryStore({ workspaceRoot: root, config: config({ scope: "global" }), platform, home, initialize: true });
    assert.equal(store.root, path.join(home, ...segments, "game-design-plugin", "memory"));
  }
  await assert.rejects(() => resolveMemoryStore({ workspaceRoot: root, config: config({ scope: "global" }), platform: "freebsd", home: root, initialize: true }));
});

test("record paths follow the fixed partition policy", () => {
  const base = { memory_id: "memory-studio-design-lesson-0f2a4c61d9ab34ef", project_id: "wind-island", kind: "design-lesson", status: "candidate" };
  assert.equal(memoryRecordRelativePath(base), "lessons/candidates/memory-studio-design-lesson-0f2a4c61d9ab34ef.md");
  assert.equal(memoryRecordRelativePath({ ...base, kind: "style-preference" }), "preferences/memory-studio-design-lesson-0f2a4c61d9ab34ef.md");
  assert.equal(memoryRecordRelativePath({ ...base, kind: "decision" }), "projects/wind-island/memory-studio-design-lesson-0f2a4c61d9ab34ef.md");
  assert.equal(memoryRecordRelativePath({ ...base, status: "approved" }), "lessons/approved/memory-studio-design-lesson-0f2a4c61d9ab34ef.md");
  assert.throws(() => memoryRecordRelativePath({ ...base, memory_id: "../escape" }));
  assert.throws(() => memoryRecordRelativePath({ ...base, kind: "unknown" }));
  assert.throws(() => memoryRecordRelativePath({ ...base, unknown: true }));
});

test("replace atomically updates an existing regular memory file", async (t) => {
  const root = await workspace(t);
  const store = await resolveMemoryStore({ workspaceRoot: root, config: config(), platform: "linux", home: root, initialize: true });
  await writeMemoryFileAtomic({ store, relativePath: "lessons/candidates/replace.md", bytes: Buffer.from("old") });
  await writeMemoryFileAtomic({ store, relativePath: "lessons/candidates/replace.md", bytes: Buffer.from("new"), policy: "replace" });
  assert.deepEqual(await readMemoryFile({ store, relativePath: "lessons/candidates/replace.md" }), Buffer.from("new"));
});

test("create-once and move fail closed when a destination appears at publish time", async (t) => {
  const root = await workspace(t);
  const store = await resolveMemoryStore({ workspaceRoot: root, config: config(), platform: "linux", home: root, initialize: true });
  await assert.rejects(() => writeMemoryFileAtomic({
    store, relativePath: "lessons/candidates/race.md", bytes: Buffer.from("new"), policy: {
      mode: "create-once", beforePublish: async ({ destination }) => writeFile(destination, "racer"),
    },
  }));
  assert.equal(await readFile(path.join(store.root, "lessons", "candidates", "race.md"), "utf8"), "racer");
  await writeMemoryFileAtomic({ store, relativePath: "lessons/candidates/move.md", bytes: Buffer.from("source") });
  await assert.rejects(() => moveMemoryFileAtomic({
    store, from: "lessons/candidates/move.md", to: "lessons/approved/move.md", policy: {
      beforePublish: async ({ destination }) => writeFile(destination, "racer"),
    },
  }));
  assert.deepEqual(await readMemoryFile({ store, relativePath: "lessons/candidates/move.md" }), Buffer.from("source"));
});

test("replacement publication rejects a destination inode changed after its snapshot", async (t) => {
  const root = await workspace(t);
  const store = await resolveMemoryStore({ workspaceRoot: root, config: config(), platform: "linux", home: root, initialize: true });
  const target = path.join(store.root, "lessons", "candidates", "replace-race.md");
  const replacement = path.join(store.root, "lessons", "candidates", "replacement.md");
  await writeMemoryFileAtomic({ store, relativePath: "lessons/candidates/replace-race.md", bytes: Buffer.from("old") });
  await assert.rejects(() => writeMemoryFileAtomic({
    store, relativePath: "lessons/candidates/replace-race.md", bytes: Buffer.from("new"), policy: {
      beforePublish: async () => { await writeFile(replacement, "racer"); await rename(replacement, target); },
    },
  }));
  assert.equal(await readFile(target, "utf8"), "racer");
});

test("replacement publication rejects same-inode byte changes after its digest snapshot", async (t) => {
  const root = await workspace(t);
  const store = await resolveMemoryStore({ workspaceRoot: root, config: config(), platform: "linux", home: root, initialize: true });
  const target = path.join(store.root, "lessons", "candidates", "replace-digest-race.md");
  await writeMemoryFileAtomic({ store, relativePath: "lessons/candidates/replace-digest-race.md", bytes: Buffer.from("old") });
  await assert.rejects(() => writeMemoryFileAtomic({
    store, relativePath: "lessons/candidates/replace-digest-race.md", bytes: Buffer.from("new"), policy: { beforePublish: () => writeFile(target, "racer") },
  }));
  assert.equal(await readFile(target, "utf8"), "racer");
});

test("read/write/move reject escaping, symlink, and preserve originals on failed writes", async (t) => {
  const root = await workspace(t);
  const store = await resolveMemoryStore({ workspaceRoot: root, config: config(), platform: "linux", home: root, initialize: true });
  await writeMemoryFileAtomic({ store, relativePath: "lessons/candidates/a.md", bytes: Buffer.from("old") });
  assert.deepEqual(await readMemoryFile({ store, relativePath: "lessons/candidates/a.md" }), Buffer.from("old"));
  for (const unsafe of ["/tmp/x", "../x", "x\\y", "x\0y"]) await assert.rejects(() => readMemoryFile({ store, relativePath: unsafe }));
  await symlink(path.join(store.root, "lessons/candidates/a.md"), path.join(store.root, "link.md"));
  await assert.rejects(() => readMemoryFile({ store, relativePath: "link.md" }));
  await assert.rejects(() => writeMemoryFileAtomic({ store, relativePath: "lessons/candidates/a.md", bytes: Buffer.from("new"), policy: { beforeRename: () => { throw new Error("stop"); } } }));
  assert.deepEqual(await readMemoryFile({ store, relativePath: "lessons/candidates/a.md" }), Buffer.from("old"));
  await moveMemoryFileAtomic({ store, from: "lessons/candidates/a.md", to: "lessons/approved/a.md" });
  assert.deepEqual(await readMemoryFile({ store, relativePath: "lessons/approved/a.md" }), Buffer.from("old"));
});

test("FIFO and Unix-socket targets are rejected without opening special files", async (t) => {
  const root = await workspace(t);
  const store = await resolveMemoryStore({ workspaceRoot: root, config: config(), platform: "linux", home: root, initialize: true });
  const parent = path.join(store.root, "lessons", "candidates");
  await mkdir(parent, { recursive: true });
  const fifo = path.join(parent, "pipe.md");
  assert.equal(spawnSync("/usr/bin/mkfifo", [fifo]).status, 0);
  await assert.rejects(() => readMemoryFile({ store, relativePath: "lessons/candidates/pipe.md" }));
  await assert.rejects(() => writeMemoryFileAtomic({ store, relativePath: "lessons/candidates/pipe.md", bytes: Buffer.from("new") }));
  const socket = path.join(parent, "socket.md");
  const shortSocket = path.join(tmpdir(), `gdm-${process.pid}-${Date.now()}`);
  const server = createServer();
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(shortSocket, resolve); });
  await rename(shortSocket, socket);
  t.after(() => new Promise((resolve) => server.close(resolve)));
  await assert.rejects(() => readMemoryFile({ store, relativePath: "lessons/candidates/socket.md" }));
  await assert.rejects(() => writeMemoryFileAtomic({ store, relativePath: "lessons/candidates/socket.md", bytes: Buffer.from("new") }));
});

test("temporary and publish failures preserve the original namespace", async (t) => {
  const root = await workspace(t);
  const store = await resolveMemoryStore({ workspaceRoot: root, config: config(), platform: "linux", home: root, initialize: true });
  await assert.rejects(() => writeMemoryFileAtomic({ store, relativePath: "lessons/candidates/fail.md", bytes: Buffer.from("new"), policy: { beforeWrite: () => { throw new Error("temp failure"); } } }));
  await assert.rejects(() => readMemoryFile({ store, relativePath: "lessons/candidates/fail.md" }));
  await writeMemoryFileAtomic({ store, relativePath: "lessons/candidates/original.md", bytes: Buffer.from("old") });
  await assert.rejects(() => writeMemoryFileAtomic({ store, relativePath: "lessons/candidates/original.md", bytes: Buffer.from("new"), policy: { beforePublish: () => { throw new Error("publish failure"); } } }));
  assert.deepEqual(await readMemoryFile({ store, relativePath: "lessons/candidates/original.md" }), Buffer.from("old"));
});

test("an adapter without directory-relative atomic capabilities fails before it writes", async (t) => {
  const root = await workspace(t);
  const store = await resolveMemoryStore({ workspaceRoot: root, config: config(), platform: "linux", home: root, initialize: true });
  let publishCalls = 0;
  const unsafeAdapter = createMemoryStorePlatformAdapter({
    capabilities: { directoryRelative: false, atomicNoReplace: false, atomicReplace: false },
    linkFn: async () => { publishCalls += 1; },
    renameFn: async () => { publishCalls += 1; },
  });
  await assert.rejects(() => writeMemoryFileAtomic({ store, relativePath: "lessons/candidates/capability.md", bytes: Buffer.from("new"), platformAdapter: unsafeAdapter }), /capability|unsafe/i);
  assert.equal(publishCalls, 0);
  await assert.rejects(() => readMemoryFile({ store, relativePath: "lessons/candidates/capability.md" }));
});

test("a direct-parent swap after Node's final check cannot redirect publication", async (t) => {
  const root = await workspace(t);
  const store = await resolveMemoryStore({ workspaceRoot: root, config: config(), platform: "linux", home: root, initialize: true });
  const parent = path.join(store.root, "lessons", "candidates");
  const displaced = path.join(store.root, "lessons", "candidates-displaced");
  await writeMemoryFileAtomic({ store, relativePath: "lessons/candidates/original.md", bytes: Buffer.from("old") });
  await assert.rejects(() => writeMemoryFileAtomic({
    store, relativePath: "lessons/candidates/original.md", bytes: Buffer.from("new"), policy: {
      beforePublish: async () => { await rename(parent, displaced); await mkdir(parent); },
    },
  }));
  assert.equal(await readFile(path.join(displaced, "original.md"), "utf8"), "old");
  await assert.rejects(() => readFile(path.join(parent, "original.md")));
});

test("git exclusion changes only the local plugin block exactly once", async (t) => {
  const root = await workspace(t);
  const exclude = path.join(root, ".git", "info", "exclude");
  await mkdir(path.dirname(exclude), { recursive: true });
  await writeFile(exclude, "before\n# keep\n");
  const runGit = async (args) => args[1] === "--git-common-dir" ? ".git" : exclude;
  assert.deepEqual(await ensureMemoryGitExclusion({ workspaceRoot: root, gitMode: "local", runGit }), { status: "added" });
  assert.deepEqual(await ensureMemoryGitExclusion({ workspaceRoot: root, gitMode: "local", runGit }), { status: "present" });
  const bytes = await readFile(exclude, "utf8");
  assert.match(bytes, /^before\n# keep\n/u);
  assert.equal((bytes.match(/game-design-plugin:memory:begin/gu) ?? []).length, 1);
  assert.deepEqual(await ensureMemoryGitExclusion({ workspaceRoot: root, gitMode: "tracked", runGit }), { status: "skipped" });
});

test("git exclusion rejects partial markers and concurrent replacement without overwriting user bytes", async (t) => {
  const root = await workspace(t);
  const exclude = path.join(root, ".git", "info", "exclude");
  await mkdir(path.dirname(exclude), { recursive: true });
  const runGit = async (args) => args[1] === "--git-common-dir" ? ".git" : exclude;
  await writeFile(exclude, "# game-design-plugin:memory:begin\n");
  await assert.rejects(() => ensureMemoryGitExclusion({ workspaceRoot: root, gitMode: "local", runGit }));
  await writeFile(exclude, "before\n");
  await assert.rejects(() => ensureMemoryGitExclusion({ workspaceRoot: root, gitMode: "local", runGit, beforePublish: async () => writeFile(exclude, "concurrent\n") }));
  assert.equal(await readFile(exclude, "utf8"), "concurrent\n");
  await writeFile(exclude, "before-snapshot\n");
  await assert.rejects(() => ensureMemoryGitExclusion({ workspaceRoot: root, gitMode: "local", runGit, beforeSnapshot: () => writeFile(exclude, "read-race\n") }));
  assert.equal(await readFile(exclude, "utf8"), "read-race\n");
  await rm(exclude);
  await assert.rejects(() => ensureMemoryGitExclusion({ workspaceRoot: root, gitMode: "local", runGit, beforePublish: () => writeFile(exclude, "created-after-absence\n") }));
  assert.equal(await readFile(exclude, "utf8"), "created-after-absence\n");
});

test("non-Git workspaces leave exclusion files untouched", async (t) => {
  const root = await workspace(t);
  assert.deepEqual(await ensureMemoryGitExclusion({ workspaceRoot: root, gitMode: "local", runGit: async () => { throw new Error("not a repository"); } }), { status: "skipped" });
  await assert.rejects(() => readFile(path.join(root, ".git", "info", "exclude")));
});
