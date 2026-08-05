import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rename, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { cleanupGuardedTempRoot, createGuardedTempRoot } from "../../tooling/lib/guarded-temp.mjs";

test("guarded cleanup quarantines the registered identity before deleting it", async () => {
  const parent = await mkdtemp(path.join(os.tmpdir(), "guarded-parent-"));
  try {
    const registration = await createGuardedTempRoot({ parent, prefix: "game-design-test-" });
    await writeFile(path.join(registration.root, "owned.txt"), "owned\n");
    const result = await cleanupGuardedTempRoot(registration);
    assert.equal(result.deleted, true);
    await assert.rejects(readFile(registration.root), /ENOENT/u);
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
});

test("guarded cleanup supports NFC Korean and spaced temporary parents", async () => {
  const outer = await mkdtemp(path.join(os.tmpdir(), "guarded-unicode-"));
  const parent = path.join(outer, "게임 기획 é space".normalize("NFC"));
  try {
    await mkdir(parent);
    const registration = await createGuardedTempRoot({ parent, prefix: "game-design-test-" });
    assert.equal(registration.root, registration.root.normalize("NFC"));
    assert.equal((await cleanupGuardedTempRoot(registration)).deleted, true);
  } finally {
    await rm(outer, { recursive: true, force: true });
  }
});

for (const phase of ["beforeQuarantine", "beforeDelete"]) {
  test(`guarded cleanup preserves unrelated external bytes on ${phase} identity race`, async () => {
    const parent = await mkdtemp(path.join(os.tmpdir(), "guarded-parent-"));
    const external = await mkdtemp(path.join(os.tmpdir(), "guarded-external-"));
    const sentinel = path.join(external, "sentinel.txt");
    await writeFile(sentinel, "unchanged\n");
    const registration = await createGuardedTempRoot({ parent, prefix: "game-design-test-" });
    const displaced = `${registration.root}-preserved`;
    try {
      const seam = async ({ quarantine }) => {
        if (phase === "beforeQuarantine") {
          await rename(registration.root, displaced);
          await symlink(external, registration.root);
        } else {
          await rename(quarantine, displaced);
          await symlink(external, quarantine);
        }
      };
      await assert.rejects(cleanupGuardedTempRoot(registration, { [phase]: seam }), /preserved/u);
      assert.equal(await readFile(sentinel, "utf8"), "unchanged\n");
    } finally {
      await rm(registration.root, { force: true });
      await rm(displaced, { recursive: true, force: true });
      await rm(parent, { recursive: true, force: true });
      await rm(external, { recursive: true, force: true });
    }
  });
}
