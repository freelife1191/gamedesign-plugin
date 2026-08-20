import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const workflowRoot = path.join(repoRoot, ".github", "workflows");

test("the repository registers only the bounded release note gate", async () => {
  const entries = await readdir(workflowRoot, { withFileTypes: true }).catch((error) => {
    if (error.code === "ENOENT") return [];
    throw error;
  });
  const workflows = entries
    .filter((entry) => entry.isFile() && /\.ya?ml$/u.test(entry.name))
    .map((entry) => entry.name)
    .sort();

  assert.deepEqual(workflows, ["release-notes.yml"]);

  const source = await readFile(path.join(workflowRoot, workflows[0]), "utf8");
  assert.match(source, /^name: Release note gate$/mu);
  assert.match(source, /^\s*runs-on: ubuntu-latest$/mu);
  assert.match(source, /npm run validate:release-notes/u);
  assert.match(source, /persist-credentials: false/u);
  assert.doesNotMatch(source, /windows-latest|npm test|npm run validate:release(?:\s|$)|gh release (?:create|edit)|update:vendors/u);
});

test("the full verification surfaces remain available for local macOS runs", async () => {
  const packageJson = JSON.parse(await readFile(path.join(repoRoot, "package.json"), "utf8"));

  assert.equal(packageJson.scripts.test, "node tooling/run-repo-tests.mjs");
  assert.equal(packageJson.scripts["validate:release"], "node tooling/validate-suite.mjs --release");
  assert.equal(packageJson.scripts["validate:release-notes"], "node tooling/validate-release-notes.mjs");
  assert.equal(packageJson.scripts["verify:install-roundtrip"], "node tooling/install-roundtrip.mjs");
  assert.equal(packageJson.scripts["smoke:marketplace"], "node tooling/marketplace-smoke.mjs");
});
