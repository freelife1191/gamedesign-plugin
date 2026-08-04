import assert from "node:assert/strict";
import { access, cp, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { constants } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

import { reviewStopEvent } from "../../shared/scripts/stop-artifact-review.mjs";
import { validateArtifact } from "../../shared/scripts/validate-artifact.mjs";
import { discoverSourceFiles } from "../../tooling/index-references.mjs";
import { buildProduct } from "../../tooling/lib/build-product.mjs";
import { loadProductContract, validateProductContract } from "../../tooling/lib/product-contract.mjs";
import { verifyVendorHash } from "../../tooling/verify-vendor-hash.mjs";

const repoRoot = path.resolve(new URL("../..", import.meta.url).pathname);
const productNames = ["game-design-studio", "game-design-career"];

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(repoRoot, relativePath), "utf8"));
}

test("shared-contract-v1 exposes the complete product-lane contract", async (t) => {
  const packageJson = await readJson("package.json");
  assert.equal(packageJson.scripts["test:shared-contract"], "node --test tests/contracts/shared-contract.test.mjs");

  const contractReadme = await readFile(path.join(repoRoot, "shared/contracts/README.md"), "utf8");
  for (const requiredClause of [
    "shared-contract-v1",
    "products/<product-name>/product.json",
    "products/<product-name>/plugin/",
    "agents/<role-id>.md",
    "skills/<skill-name>/SKILL.md",
    "sourceDocuments",
    "sourceDocumentCategories",
    "assets/templates/<template-name>/",
    "tests/e2e/<product-name>/fixtures/",
    "plugins/game-design-studio",
    "plugins/game-design-career",
    "<!-- game-design-plugin:artifact {\"path\":\"<artifact-path>\",\"formats\":[]} -->",
  ]) {
    assert.match(contractReadme, new RegExp(requiredClause.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  const schema = await readJson("shared/contracts/product.schema.json");
  assert.equal(schema.additionalProperties, false);
  assert.deepEqual(schema.required, [
    "schemaVersion", "name", "displayName", "description", "sharedModules", "sharedRuntime", "sourceRoots",
  ]);
  assert.equal(schema.oneOf.length, 2);

  const fixtureRoot = await mkdtemp(path.join(tmpdir(), "shared-contract-product-"));
  const stagingRoot = await mkdtemp(path.join(tmpdir(), "shared-contract-build-"));
  t.after(() => Promise.all([
    rm(fixtureRoot, { recursive: true, force: true }),
    rm(stagingRoot, { recursive: true, force: true }),
  ]));
  await cp(path.join(repoRoot, "shared"), path.join(fixtureRoot, "shared"), { recursive: true });
  await mkdir(path.join(fixtureRoot, "products"), { recursive: true });
  await cp(
    path.join(repoRoot, "tests/fixtures/minimal-product"),
    path.join(fixtureRoot, "products/minimal-product"),
    { recursive: true },
  );

  const fixtureProduct = await loadProductContract({ repoRoot: fixtureRoot, productName: "minimal-product" });
  assert.deepEqual(validateProductContract(fixtureProduct), fixtureProduct);
  for (const productName of productNames) {
    const productPath = path.join(repoRoot, "products", productName, "product.json");
    try {
      await access(productPath, constants.R_OK);
    } catch (error) {
      if (error.code === "ENOENT") continue;
      throw error;
    }
    const product = await loadProductContract({ repoRoot, productName });
    assert.equal(product.name, productName);
    assert.deepEqual(product.sharedModules, ["knowledge", "templates", "responsible-design", "export", "vendor"]);
    assert.equal(product.sharedRuntime, true);
  }

  const artifact = await validateArtifact(path.join(repoRoot, "shared/templates/canonical-artifact"));
  assert.equal(artifact.ok, true, artifact.errors.map(({ message }) => message).join("\n"));

  const hooks = await readJson("shared/hooks/hooks.json");
  assert.deepEqual(Object.keys(hooks.hooks).sort(), ["SessionStart", "Stop"]);
  const built = await buildProduct({ repoRoot: fixtureRoot, productName: "minimal-product", stagingRoot, sourceDateEpoch: 0 });
  for (const event of ["SessionStart", "Stop"]) {
    const hook = hooks.hooks[event][0].hooks[0];
    const command = hook.command.replaceAll("${PLUGIN_ROOT}", built.outputDir);
    const result = spawnSync(command, {
      cwd: built.outputDir,
      env: { PATH: process.env.PATH ?? "" },
      input: event === "Stop" ? JSON.stringify({ cwd: built.outputDir, last_assistant_message: "No artifact marker." }) : "{}",
      encoding: "utf8",
      shell: true,
    });
    assert.equal(result.status, 0, `${event}: ${result.stderr}`);
    assert.doesNotThrow(() => JSON.parse(result.stdout), `${event}: ${result.stdout}`);
  }

  const invalidArtifact = path.join(fixtureRoot, "invalid-artifact");
  await mkdir(invalidArtifact);
  const marker = '<!-- game-design-plugin:artifact {"path":"invalid-artifact","formats":[]} -->';
  const firstReview = await reviewStopEvent({ cwd: fixtureRoot, last_assistant_message: marker });
  const retryReview = await reviewStopEvent({ cwd: fixtureRoot, last_assistant_message: marker, stop_hook_active: true });
  assert.equal(firstReview.decision, "block");
  assert.equal(firstReview.status, "corrective-pass-requested");
  assert.equal(retryReview.continue, true);
  assert.equal(retryReview.status, "invalid-after-corrective-pass");
  assert.equal(Object.hasOwn(retryReview, "decision"), false);

  const discovered = await discoverSourceFiles({ repoRoot });
  const referenceIndex = await readJson("shared/knowledge/reference-index.json");
  assert.equal(referenceIndex.documents.length, 49);
  assert.equal(new Set(referenceIndex.documents.map(({ id }) => id)).size, 49);
  assert.deepEqual(
    referenceIndex.documents.map(({ sourcePath }) => sourcePath).sort(),
    discovered.map(({ sourcePath }) => sourcePath).sort(),
  );
  await Promise.all(referenceIndex.documents.map(({ sourcePath }) => access(path.join(repoRoot, sourcePath), constants.R_OK)));

  const gates = await readJson("shared/responsible-design/gates.json");
  assert.deepEqual(gates.gates.map(({ id }) => id).sort(), [
    "accessibility",
    "ai-npc-safety",
    "ai-rights-human-approval",
    "economy-transparency",
    "liveops-experiment",
    "scope-control",
    "ugc-safety",
  ]);
  for (const gate of gates.gates) {
    for (const field of ["applicability_questions", "blocking_findings", "evidence_fields", "approver", "allowed_states"]) {
      assert.ok(Object.hasOwn(gate, field), `${gate.id}: ${field}`);
    }
  }

  const vendorLock = await readJson("shared/vendor/skillstead/vendor.lock.json");
  assert.equal(vendorLock.files.length, 48);
  assert.equal(await verifyVendorHash(repoRoot), 48);
  assert.equal(typeof buildProduct, "function");
  assert.equal(typeof loadProductContract, "function");
  assert.equal(typeof validateProductContract, "function");
});
