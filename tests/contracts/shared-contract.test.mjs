import assert from "node:assert/strict";
import { access, cp, lstat, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

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
  ["document-quality", ["shared/document-quality", "references/shared/document-quality"]],
  ["image-assets", ["shared/image-assets", "references/shared/image-assets"]],
]);

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(repoRoot, relativePath), "utf8"));
}

async function mappedTreeFiles(sourceRoot, source, destination) {
  return (await collectTree(path.join(sourceRoot, source), { label: source }))
    .map(({ relativePath }) => `${destination}/${relativePath}`)
    .sort();
}

async function assertBuiltProductContract({ build, product, sourceRoot, referenceIndex, vendorLock }) {
  for (const [moduleName, [source, destination]] of sharedMappings) {
    if (!product.sharedModules.includes(moduleName)) continue;
    assert.deepEqual(
      build.files.filter((file) => file.startsWith(`${destination}/`)).sort(),
      await mappedTreeFiles(sourceRoot, source, destination),
      `${product.name}: reserved ${destination}`,
    );
  }
  assert.deepEqual(
    build.files.filter((file) => file.startsWith("hooks/")).sort(),
    await mappedTreeFiles(sourceRoot, "shared/hooks", "hooks"),
    `${product.name}: reserved hooks`,
  );
  assert.deepEqual(
    build.files.filter((file) => file.startsWith("scripts/")).sort(),
    await mappedTreeFiles(sourceRoot, "shared/scripts", "scripts"),
    `${product.name}: reserved scripts`,
  );
  assert.deepEqual(
    build.files.filter((file) => file.startsWith("skills/svg-infographic/")).sort(),
    vendorLock.files.map(({ path: vendorPath }) => `skills/svg-infographic/${vendorPath}`).sort(),
    `${product.name}: reserved Skillstead vendor`,
  );

  const categories = new Set(product.sourceDocumentCategories ?? []);
  const expectedSources = referenceIndex.documents
    .filter(({ category }) => categories.has(category))
    .map(({ sourcePath }) => `references/source/${sourcePath}`)
    .sort();
  assert.deepEqual(build.files.filter((file) => file.startsWith("references/source/")).sort(), expectedSources);
}

async function discoverProductContracts(sourceRoot) {
  const productsRoot = path.join(sourceRoot, "products");
  let entries;
  try {
    entries = await readdir(productsRoot, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
  const names = [];
  for (const entry of entries) {
    const childPath = path.join(productsRoot, entry.name);
    const child = await lstat(childPath);
    if (child.isSymbolicLink()) throw new Error(`Unsupported products entry: products/${entry.name} is a symlink`);
    if (!child.isDirectory()) throw new Error(`Unsupported products entry: products/${entry.name} is not a directory`);
    try {
      await lstat(path.join(childPath, "product.json"));
      names.push(entry.name);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  return names.sort();
}

async function validateDiscoveredProducts({ sourceRoot, stagingRoot, referenceIndex, vendorLock }) {
  const productNames = await discoverProductContracts(sourceRoot);
  for (const productName of productNames) {
    if (!productLanes.has(productName)) throw new Error(`Unexpected product contract: products/${productName}/product.json`);
    const product = await loadProductContract({ repoRoot: sourceRoot, productName });
    assert.deepEqual(product.sharedModules, ["knowledge", "templates", "responsible-design", "export", "vendor", "document-quality", "image-assets"]);
    assert.equal(product.sharedRuntime, true);
    assert.deepEqual(product.sourceRoots, ["plugin"]);
    assert.deepEqual(product.sourceDocumentCategories, sourceDocumentCategories);
    const productStagingRoot = await mkdtemp(path.join(stagingRoot, "discovered-"));
    const productBuild = await buildProduct({ repoRoot: sourceRoot, productName, stagingRoot: productStagingRoot, sourceDateEpoch: 0 });
    await assertBuiltProductContract({
      build: productBuild,
      product,
      sourceRoot,
      referenceIndex,
      vendorLock,
    });
  }
  return productNames;
}

function runBuiltHook({ outputDir, scriptName, input }) {
  const result = spawnSync(process.execPath, [path.join(outputDir, "scripts", scriptName)], {
    cwd: outputDir,
    env: { ...process.env },
    input: JSON.stringify(input),
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  return JSON.parse(result.stdout);
}

function assertCapability(capability, availableKeys) {
  assert.equal(typeof capability, "object");
  assert.equal(typeof capability.available, "boolean");
  assert.deepEqual(Object.keys(capability).sort(), capability.available ? availableKeys.sort() : ["available"]);
}

function assertSessionStartOutput(output) {
  assert.deepEqual(Object.keys(output).sort(), ["capabilities", "hookSpecificOutput", "warnings"]);
  assert.deepEqual(Object.keys(output.hookSpecificOutput).sort(), ["additionalContext", "hookEventName"]);
  assert.equal(output.hookSpecificOutput.hookEventName, "SessionStart");
  assert.equal(typeof output.hookSpecificOutput.additionalContext, "string");
  assert.deepEqual(Object.keys(output.capabilities), [
    "node", "chromium", "soffice", "documents", "pdf", "presentations",
  ]);
  assertCapability(output.capabilities.node, ["available", "version"]);
  assert.equal(output.capabilities.node.available, true);
  assert.equal(typeof output.capabilities.node.version, "string");
  assertCapability(output.capabilities.chromium, ["available", "command", "version", "via"]);
  if (output.capabilities.chromium.available) {
    assert.equal(typeof output.capabilities.chromium.command, "string");
    assert.equal(path.isAbsolute(output.capabilities.chromium.command), true);
    assert.equal(typeof output.capabilities.chromium.version, "string");
    assert.notEqual(output.capabilities.chromium.version.trim(), "");
    assert.equal(typeof output.capabilities.chromium.via, "string");
    assert.notEqual(output.capabilities.chromium.via.trim(), "");
  }
  assertCapability(output.capabilities.soffice, ["available", "command"]);
  if (output.capabilities.soffice.available) assert.equal(typeof output.capabilities.soffice.command, "string");
  for (const name of ["documents", "pdf", "presentations"]) {
    assertCapability(output.capabilities[name], ["available", "provider"]);
    if (output.capabilities[name].available) assert.equal(output.capabilities[name].provider, "codex-bundled");
  }
  assert.ok(Array.isArray(output.warnings));
  const optionalCapabilities = ["chromium", "soffice", "documents", "pdf", "presentations"];
  assert.deepEqual(
    output.warnings.map(({ code }) => code),
    optionalCapabilities
      .filter((name) => !output.capabilities[name].available)
      .map((name) => `capability.${name}.absent`),
  );
  for (const warning of output.warnings) {
    assert.deepEqual(Object.keys(warning).sort(), ["code", "message"]);
    assert.equal(typeof warning.message, "string");
    assert.notEqual(warning.message.trim(), "");
  }
  assert.deepEqual(
    JSON.parse(output.hookSpecificOutput.additionalContext),
    { capabilities: output.capabilities },
  );
}

test("shared-contract-v1 exposes the complete product-lane contract", async (t) => {
  const packageJson = await readJson("package.json");
  assert.equal(packageJson.scripts["test:shared-contract"], "node --test tests/contracts/shared-contract.test.mjs");

  const contractReadme = await readFile(path.join(repoRoot, "shared/contracts/README.md"), "utf8");
  for (const requiredClause of [
    "shared-contract-v1",
    "products/<product-name>/product.json",
    "products/*/product.json",
    "symlink와 file/device/socket 같은 special entry",
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
    "reserved destination",
    "matcher 없이",
    "hookSpecificOutput`, `capabilities`, `warnings",
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

  const qualitySchema = await readJson("shared/document-quality/schema/quality-profile.schema.json");
  const selectionSchema = await readJson("shared/document-quality/schema/quality-profile-selection.schema.json");
  assert.equal(qualitySchema.additionalProperties, false);
  assert.equal(selectionSchema.additionalProperties, false);
  assert.deepEqual(selectionSchema.required, ["primary_profile_id"]);

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
    path.join(fixtureRoot, "products/game-design-studio"),
    { recursive: true },
  );
  await cp(
    path.join(repoRoot, "tests/fixtures/minimal-product"),
    path.join(fixtureRoot, "products/unexpected-product"),
    { recursive: true },
  );

  const fixtureProduct = await readJson("tests/fixtures/minimal-product/product.json");
  const selectableFixture = {
    ...fixtureProduct,
    name: "game-design-studio",
    sharedModules: [...fixtureProduct.sharedModules, "document-quality", "image-assets"],
    sourceDocumentCategories,
  };
  delete selectableFixture.sourceDocuments;
  await writeFile(
    path.join(fixtureRoot, "products/game-design-studio/product.json"),
    `${JSON.stringify(selectableFixture, null, 2)}\n`,
  );
  const loadedFixture = await loadProductContract({ repoRoot: fixtureRoot, productName: "game-design-studio" });
  assert.deepEqual(validateProductContract(loadedFixture), loadedFixture);
  const unexpectedFixture = { ...selectableFixture, name: "unexpected-product" };
  await writeFile(
    path.join(fixtureRoot, "products/unexpected-product/product.json"),
    `${JSON.stringify(unexpectedFixture, null, 2)}\n`,
  );

  const referenceIndex = await readJson("shared/knowledge/reference-index.json");
  const vendorLock = await readJson("shared/vendor/skillstead/vendor.lock.json");
  const built = await buildProduct({ repoRoot: fixtureRoot, productName: "game-design-studio", stagingRoot, sourceDateEpoch: 0 });
  await assertBuiltProductContract({
    build: built,
    product: selectableFixture,
    sourceRoot: fixtureRoot,
    referenceIndex,
    vendorLock,
  });
  assert.equal(built.files.filter((file) => file.startsWith("references/source/docs/")).length, 49);

  await validateDiscoveredProducts({ sourceRoot: repoRoot, stagingRoot, referenceIndex, vendorLock });
  const [studioBuild, careerBuild] = await Promise.all([
    buildProduct({
      repoRoot,
      productName: "game-design-studio",
      stagingRoot: await mkdtemp(path.join(stagingRoot, "studio-quality-")),
      sourceDateEpoch: 0,
    }),
    buildProduct({
      repoRoot,
      productName: "game-design-career",
      stagingRoot: await mkdtemp(path.join(stagingRoot, "career-quality-")),
      sourceDateEpoch: 0,
    }),
  ]);
  const qualityFiles = studioBuild.files.filter((file) => file.startsWith("references/shared/document-quality/"));
  assert.deepEqual(qualityFiles, careerBuild.files.filter((file) => file.startsWith("references/shared/document-quality/")));
  for (const relativePath of qualityFiles) {
    assert.deepEqual(
      await readFile(path.join(studioBuild.outputDir, relativePath)),
      await readFile(path.join(careerBuild.outputDir, relativePath)),
      `${relativePath}: products receive byte-identical shared quality contracts`,
    );
  }
  await assert.rejects(
    () => validateDiscoveredProducts({ sourceRoot: fixtureRoot, stagingRoot, referenceIndex, vendorLock }),
    /Unexpected product contract: products\/unexpected-product\/product\.json/,
  );
  await rm(path.join(fixtureRoot, "products/unexpected-product"), { recursive: true, force: true });
  await cp(
    path.join(fixtureRoot, "products/game-design-studio"),
    path.join(fixtureRoot, "unexpected-product-target"),
    { recursive: true },
  );
  await symlink("../unexpected-product-target", path.join(fixtureRoot, "products/unexpected-product"));
  await assert.rejects(
    () => validateDiscoveredProducts({ sourceRoot: fixtureRoot, stagingRoot, referenceIndex, vendorLock }),
    /Unsupported products entry: products\/unexpected-product is a symlink/,
  );
  await rm(path.join(fixtureRoot, "products/unexpected-product"), { force: true });
  await cp(
    path.join(fixtureRoot, "products/game-design-studio"),
    path.join(fixtureRoot, "products/game-design-career"),
    { recursive: true },
  );
  await assert.rejects(
    () => validateDiscoveredProducts({ sourceRoot: fixtureRoot, stagingRoot, referenceIndex, vendorLock }),
    /Product name mismatch: expected game-design-career, received game-design-studio/,
  );
  await rm(path.join(fixtureRoot, "products/game-design-career"), { recursive: true, force: true });

  await mkdir(path.join(fixtureRoot, "products/game-design-studio/plugin/hooks"), { recursive: true });
  await writeFile(path.join(fixtureRoot, "products/game-design-studio/plugin/hooks/rogue.json"), "{}\n");
  const rogueStagingRoot = await mkdtemp(path.join(stagingRoot, "rogue-"));
  const rogueBuild = await buildProduct({
    repoRoot: fixtureRoot,
    productName: "game-design-studio",
    stagingRoot: rogueStagingRoot,
    sourceDateEpoch: 0,
  });
  await assert.rejects(
    () => assertBuiltProductContract({
      build: rogueBuild,
      product: selectableFixture,
      sourceRoot: fixtureRoot,
      referenceIndex,
      vendorLock,
    }),
    /reserved hooks/,
  );

  const artifact = await validateArtifact(path.join(repoRoot, "shared/templates/canonical-artifact"));
  assert.equal(artifact.ok, true, artifact.errors.map(({ message }) => message).join("\n"));

  const hooks = JSON.parse(await readFile(path.join(built.outputDir, "hooks/hooks.json"), "utf8"));
  assert.deepEqual(hooks, {
    hooks: {
      SessionStart: [{
        hooks: [{
          type: "command",
          command: 'node "${PLUGIN_ROOT}/scripts/capability-probe.mjs"',
          timeout: 10,
          statusMessage: "Detecting optional game-design capabilities",
        }],
      }],
      Stop: [{
        hooks: [{
          type: "command",
          command: 'node "${PLUGIN_ROOT}/scripts/stop-artifact-review.mjs"',
          timeout: 30,
          statusMessage: "Reviewing canonical game-design artifact",
        }],
      }],
    },
  });
  const sessionStart = runBuiltHook({
    outputDir: built.outputDir,
    scriptName: "capability-probe.mjs",
    input: { hook_event_name: "SessionStart" },
  });
  assertSessionStartOutput(sessionStart);
  const sessionMutations = [
    { ...sessionStart, junk: true },
    { ...sessionStart, capabilities: undefined },
    { ...sessionStart, hookSpecificOutput: { ...sessionStart.hookSpecificOutput, junk: true } },
    { ...sessionStart, hookSpecificOutput: { ...sessionStart.hookSpecificOutput, additionalContext: "{}" } },
    { ...sessionStart, warnings: [{ code: "junk", message: "junk", extra: true }] },
  ];
  for (const mutation of sessionMutations) {
    assert.throws(() => assertSessionStartOutput(mutation));
  }

  const invalidArtifact = path.join(fixtureRoot, "invalid-artifact");
  await mkdir(invalidArtifact);
  const marker = '<!-- game-design-plugin:artifact {"path":"invalid-artifact","formats":[]} -->';
  const stopInput = {
    hook_event_name: "Stop",
    cwd: fixtureRoot,
    stop_hook_active: false,
    last_assistant_message: marker,
  };
  const firstReview = runBuiltHook({
    outputDir: built.outputDir,
    scriptName: "stop-artifact-review.mjs",
    input: stopInput,
  });
  const retryReview = runBuiltHook({
    outputDir: built.outputDir,
    scriptName: "stop-artifact-review.mjs",
    input: { ...stopInput, stop_hook_active: true },
  });
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
