import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rename, rm, symlink, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { safeWriteArtifactFile } from "../../shared/scripts/lib/safe-artifact-write.mjs";

async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), "safe-artifact-write-"));
  const outside = await mkdtemp(path.join(tmpdir(), "safe-artifact-write-outside-"));
  t.after(() => Promise.all([rm(root, { recursive: true, force: true }), rm(outside, { recursive: true, force: true })]));
  await mkdir(path.join(root, "assets", "prompts"), { recursive: true });
  return { root, outside };
}

test("safe artifact writer rejects root and parent symlinks without touching external sentinels", async (t) => {
  const { root, outside } = await fixture(t);
  const rootLink = `${root}-link`;
  t.after(() => rm(rootLink, { recursive: true, force: true }));
  await writeFile(path.join(outside, "sentinel.txt"), "unchanged\n");
  await symlink(root, rootLink);
  await assert.rejects(() => safeWriteArtifactFile({ artifactRoot: rootLink, relativePath: "assets/prompts/result.json", data: "{}" }), /unsafe/i);
  await rm(path.join(root, "assets", "prompts"), { recursive: true });
  await symlink(outside, path.join(root, "assets", "prompts"));
  await assert.rejects(() => safeWriteArtifactFile({ artifactRoot: root, relativePath: "assets/prompts/result.json", data: "{}" }), /unsafe/i);
  assert.equal(await readFile(path.join(outside, "sentinel.txt"), "utf8"), "unchanged\n");
});

test("safe artifact writer fails closed when its target or parent is swapped before publish", async (t) => {
  const { root, outside } = await fixture(t);
  const target = path.join(root, "assets", "prompts", "result.json");
  const outsideTarget = path.join(outside, "result.json");
  await writeFile(outsideTarget, "outside-target\n");
  await assert.rejects(() => safeWriteArtifactFile({ artifactRoot: root, relativePath: "assets/prompts/result.json", data: "inside" }, {
    beforePublish: async () => symlink(outsideTarget, target),
  }), /unsafe/i);
  assert.equal(await readFile(outsideTarget, "utf8"), "outside-target\n");
  await unlink(target);
  const prompts = path.join(root, "assets", "prompts");
  const parked = path.join(root, "assets", "parked-prompts");
  await assert.rejects(() => safeWriteArtifactFile({ artifactRoot: root, relativePath: "assets/prompts/result.json", data: "inside" }, {
    beforePublish: async () => {
      await rename(prompts, parked);
      await symlink(outside, prompts);
    },
  }), /unsafe/i);
  assert.equal(await readFile(outsideTarget, "utf8"), "outside-target\n");
});
