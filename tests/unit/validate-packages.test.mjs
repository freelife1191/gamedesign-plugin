import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { discoverPackagedTargets } from "../../tooling/validate-packages.mjs";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

test("package validator discovers two plugins and thirty installed skills", async () => {
  assert.equal((await discoverPackagedTargets(repoRoot, "plugins")).length, 2);
  assert.equal((await discoverPackagedTargets(repoRoot, "skills")).length, 30);
});
