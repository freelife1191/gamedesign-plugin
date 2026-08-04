import assert from "node:assert/strict";
import { access, cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { reviewStopEvent } from "../../shared/scripts/stop-artifact-review.mjs";
import { validateArtifact } from "../../shared/scripts/validate-artifact.mjs";
import { discoverSourceFiles } from "../../tooling/index-references.mjs";
import { buildProduct } from "../../tooling/lib/build-product.mjs";
import { collectTree } from "../../tooling/lib/copy-tree.mjs";
import { loadProductContract, validateProductContract } from "../../tooling/lib/product-contract.mjs";
import { verifyVendorHash } from "../../tooling/verify-vendor-hash.mjs";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const sourceDocumentCategories = ["career", "fun-intent", "systems", "content", "feedback"];
const productLanes = new Map([
  ["game-design-studio", "studio"],
  ["game-design-career", "career"],
]);
const sharedMappings = new Map([
  ["knowledge", ["shared/knowledge", "references/shared/knowledge"]],
  ["templates", ["shared/templates", "assets/shared/templates"]],
  ["responsible-design", ["shared/responsible-design", "references/shared/responsible-design"]],
  ["export", ["shared/export", "references/shared/export"]],
]);

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(repoRoot, relativePath), "utf8"));
}

async function assertBuiltProductContract({ build, product, sourceRoot, referenceIndex, vendorLock }) {
  const builtFiles = new Set(build.files);
  for (const moduleName of product.sharedModules) {
    if (!sharedMappings.has(moduleName)) continue;
    const [source, destination] = sharedMappings.get(moduleName);
    for (const entry of await collectTree(path.join(sourceRoot, source), { label: source })) {
      assert.ok(builtFiles.has(`${destination}/${entry.relativePath}`), `${product.name}: ${destination}/${entry.relativePath}`);
    }
  }
  for (const script of ["capability-probe.mjs", "stop-artifact-review.mjs", "validate-artifact.mjs"]) {
    assert.ok(builtFiles.has(`scripts/${script}`), `${product.name}: scripts/${script}`);
  }
  for (const file of vendorLock.files) {
    assert.ok(builtFiles.has(`skills/svg-infographic/${file.path}`), `${product.name}: vendor ${file.path}`);
  }

  const categories = new Set(product.sourceDocumentCategories ?? []);
  const expectedSources = referenceIndex.documents
    .filter(({ category }) => categories.has(category))
    .map(({ sourcePath }) => `references/source/${sourcePath}`)
    .sort();
  assert.deepEqual(build.files.filter((file) => file.startsWith("references/source/")).sort(), expectedSources);
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
    "tests/e2e/studio/<scenario>/",
    "tests/e2e/career/<scenario>/",
    "`game-design-studio` | `studio` | `tests/e2e/studio/<scenario>/`",
    "`game-design-career` | `career` | `tests/e2e/career/<scenario>/`",
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
  await cp(path.join(repoRoot, "docs"), path.join(fixtureRoot, "docs"), { recursive: true });
  await mkdir(path.join(fixtureRoot, "products"), { recursive: true });
  await cp(
    path.join(repoRoot, "tests/fixtures/minimal-product"),
    path.join(fixtureRoot, "products/minimal-product"),
    { recursive: true },
  );

  const fixtureProduct = await loadProductContract({ repoRoot: fixtureRoot, productName: "minimal-product" });
  assert.deepEqual(validateProductContract(fixtureProduct), fixtureProduct);
  const selectableFixture = {
    ...fixtureProduct,
    sourceDocumentCategories,
  };
  delete selectableFixture.sourceDocuments;
  await writeFile(
    path.join(fixtureRoot, "products/minimal-product/product.json"),
    `${JSON.stringify(selectableFixture, null, 2)}\n`,
  );

  const referenceIndex = await readJson("shared/knowledge/reference-index.json");
  const vendorLock = await readJson("shared/vendor/skillstead/vendor.lock.json");
  const built = await buildProduct({ repoRoot: fixtureRoot, productName: "minimal-product", stagingRoot, sourceDateEpoch: 0 });
  await assertBuiltProductContract({
    build: built,
    product: selectableFixture,
    sourceRoot: fixtureRoot,
    referenceIndex,
    vendorLock,
  });
  assert.equal(built.files.filter((file) => file.startsWith("references/source/docs/")).length, 49);

  for (const productName of productLanes.keys()) {
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
    assert.deepEqual(product.sourceRoots, ["plugin"]);
    assert.deepEqual(product.sourceDocumentCategories, sourceDocumentCategories);
    const productBuild = await buildProduct({ repoRoot, productName, stagingRoot, sourceDateEpoch: 0 });
    await assertBuiltProductContract({
      build: productBuild,
      product,
      sourceRoot: repoRoot,
      referenceIndex,
      vendorLock,
    });
  }

  const artifact = await validateArtifact(path.join(repoRoot, "shared/templates/canonical-artifact"));
  assert.equal(artifact.ok, true, artifact.errors.map(({ message }) => message).join("\n"));

  const hooks = await readJson("shared/hooks/hooks.json");
  assert.notDeepEqual(hooks, {});
  assert.deepEqual(Object.keys(hooks), ["hooks"]);
  assert.deepEqual(Object.keys(hooks.hooks).sort(), ["SessionStart", "Stop"]);
  const hookScripts = {
    SessionStart: "capability-probe.mjs",
    Stop: "stop-artifact-review.mjs",
  };
  for (const [event, scriptName] of Object.entries(hookScripts)) {
    assert.equal(hooks.hooks[event].length, 1);
    assert.equal(hooks.hooks[event][0].hooks.length, 1);
    const hook = hooks.hooks[event][0].hooks[0];
    assert.equal(hook.type, "command");
    assert.equal(hook.command, `node "\${PLUGIN_ROOT}/scripts/${scriptName}"`);
    const result = spawnSync(process.execPath, [path.join(built.outputDir, "scripts", scriptName)], {
      cwd: built.outputDir,
      env: { ...process.env },
      input: JSON.stringify(event === "Stop" ? {
        hook_event_name: "Stop",
        cwd: built.outputDir,
        stop_hook_active: false,
        last_assistant_message: "No artifact marker.",
      } : { hook_event_name: "SessionStart" }),
      encoding: "utf8",
    });
    assert.equal(result.status, 0, `${event}: ${result.stderr}`);
    const output = JSON.parse(result.stdout);
    if (event === "SessionStart") {
      assert.equal(output.hookSpecificOutput.hookEventName, "SessionStart");
      assert.equal(typeof output.hookSpecificOutput.additionalContext, "string");
    } else {
      assert.deepEqual(output, { continue: true, status: "ignored", warnings: [] });
    }
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
  assert.equal(referenceIndex.documents.length, 49);
  assert.equal(new Set(referenceIndex.documents.map(({ id }) => id)).size, 49);
  assert.deepEqual(
    referenceIndex.documents.map(({ sourcePath }) => sourcePath).sort(),
    discovered.map(({ sourcePath }) => sourcePath).sort(),
  );
  await Promise.all(referenceIndex.documents.map(({ sourcePath }) => access(path.join(repoRoot, sourcePath), constants.R_OK)));

  const gates = await readJson("shared/responsible-design/gates.json");
  const gateIds = gates.gates.map(({ id }) => id);
  assert.equal(new Set(gateIds).size, gateIds.length);
  assert.deepEqual(gateIds.sort(), [
    "accessibility",
    "ai-npc-safety",
    "ai-rights-human-approval",
    "economy-transparency",
    "liveops-experiment",
    "scope-control",
    "ugc-safety",
  ]);
  const allowedStates = ["not-applicable", "pending", "blocked", "approved"];
  for (const gate of gates.gates) {
    for (const field of ["applicability_questions", "blocking_findings", "evidence_fields"]) {
      assert.ok(Array.isArray(gate[field]) && gate[field].length > 0, `${gate.id}: ${field}`);
      assert.ok(gate[field].every((value) => typeof value === "string" && value.trim() !== ""), `${gate.id}: ${field}`);
    }
    assert.equal(typeof gate.approver, "string", `${gate.id}: approver`);
    assert.notEqual(gate.approver.trim(), "", `${gate.id}: approver`);
    assert.equal(new Set(gate.allowed_states).size, gate.allowed_states.length, `${gate.id}: duplicate allowed_states`);
    assert.deepEqual([...gate.allowed_states].sort(), [...allowedStates].sort(), `${gate.id}: allowed_states`);
  }

  assert.equal(vendorLock.files.length, 48);
  assert.equal(await verifyVendorHash(repoRoot), 48);
  assert.equal(typeof buildProduct, "function");
  assert.equal(typeof loadProductContract, "function");
  assert.equal(typeof validateProductContract, "function");
});
