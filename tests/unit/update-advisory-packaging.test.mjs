import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { syncShared } from "../../tooling/sync-shared.mjs";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

test("Studio and Career snapshot-package the shared closed update policy", async (t) => {
  const stagingRoot = await mkdtemp(path.join(tmpdir(), "update-advisory-package-"));
  t.after(() => rm(stagingRoot, { recursive: true, force: true }));

  for (const productName of ["game-design-studio", "game-design-career"]) {
    const build = await syncShared({ repoRoot, productName, stagingRoot, sourceDateEpoch: 0 });
    assert.equal(build.files.includes("references/shared/updates/update-policy.json"), true, `${productName} policy`);
    assert.equal(build.files.includes("references/shared/updates/update-advisory.schema.json"), true, `${productName} schema`);
  }
});
