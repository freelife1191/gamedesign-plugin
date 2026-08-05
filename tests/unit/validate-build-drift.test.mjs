import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readdir, readFile, lstat, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(fileURLToPath(new URL("../../", import.meta.url)));

async function snapshotTree(root) {
  const rootStat = await lstat(root);
  const records = [];
  async function visit(directory, prefix = "") {
    for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      const target = path.join(directory, entry.name);
      const stats = await lstat(target);
      if (stats.isDirectory()) await visit(target, relative);
      else records.push([relative, createHash("sha256").update(await readFile(target)).digest("hex"), stats.size]);
    }
  }
  await visit(root);
  return { identity: [rootStat.dev, rootStat.ino, rootStat.mode, rootStat.mtimeMs], records };
}

test("build drift validation is read-only and creates no recovery entry", async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), "build-drift-read-only-"));
  try {
    const roots = ["game-design-career", "game-design-studio"].map((name) => path.join(repoRoot, "plugins", name));
    const before = await Promise.all(roots.map(snapshotTree));
    const tempBefore = await readdir(temp);
    const result = spawnSync(process.execPath, [path.join(repoRoot, "tooling/validate-build-drift.mjs")], {
      cwd: repoRoot,
      env: { ...process.env, TMPDIR: temp },
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.deepEqual(await Promise.all(roots.map(snapshotTree)), before);
    assert.deepEqual(await readdir(temp), tempBefore);
    assert.doesNotMatch(result.stdout + result.stderr, /SNAPSHOT_RECOVERY|clean game-design/u);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});
