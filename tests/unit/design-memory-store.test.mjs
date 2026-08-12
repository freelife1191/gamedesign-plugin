import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
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

test("record paths follow the fixed partition policy", () => {
  const base = { memory_id: "memory-studio-design-lesson-0f2a4c61d9ab34ef", project_id: "wind-island", kind: "design-lesson", status: "candidate" };
  assert.equal(memoryRecordRelativePath(base), "lessons/candidates/memory-studio-design-lesson-0f2a4c61d9ab34ef.md");
  assert.equal(memoryRecordRelativePath({ ...base, kind: "style-preference" }), "preferences/memory-studio-design-lesson-0f2a4c61d9ab34ef.md");
  assert.equal(memoryRecordRelativePath({ ...base, kind: "decision" }), "projects/wind-island/memory-studio-design-lesson-0f2a4c61d9ab34ef.md");
  assert.equal(memoryRecordRelativePath({ ...base, status: "approved" }), "lessons/approved/memory-studio-design-lesson-0f2a4c61d9ab34ef.md");
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
