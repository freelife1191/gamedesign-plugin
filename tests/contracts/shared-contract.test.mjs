import assert from "node:assert/strict";
import { access, cp, lstat, mkdir, mkdtemp, readFile, readdir, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import { validateArtifact } from "../../shared/scripts/validate-artifact.mjs";
import { discoverSourceFiles } from "../../tooling/index-references.mjs";
import { buildProduct } from "../../tooling/lib/build-product.mjs";
import { collectTree } from "../../tooling/lib/copy-tree.mjs";
import { loadProductContract, validateProductContract } from "../../tooling/lib/product-contract.mjs";
import { verifyDiagramSkillVendor } from "../../tooling/sync-diagram-skills.mjs";
import { scanJavaScriptImports } from "../../tooling/lib/js-import-scanner.mjs";
import { vendorMappings } from "../../tooling/lib/vendor-components.mjs";
import { vendorTag } from "../lib/vendored.mjs";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const sourceDocumentCategories = ["career", "fun-intent", "systems", "content", "feedback"];
const productLanes = new Map([
  ["game-design-studio", "studio"],
  ["game-design-career", "career"],
]);
const sharedMappings = new Map([
  ["knowledge", [["shared/knowledge", "references/shared/knowledge"]]],
  ["templates", [["shared/templates", "assets/shared/templates"]]],
  ["responsible-design", [["shared/responsible-design", "references/shared/responsible-design"]]],
  ["export", [["shared/export", "references/shared/export"]]],
  ["vendor", vendorMappings({ repoRoot }).vendor],
  ["archify", vendorMappings({ repoRoot }).archify],
  ["im-not-ai", vendorMappings({ repoRoot })["im-not-ai"]],
  ["document-quality", [["shared/document-quality", "references/shared/document-quality"]]],
  ["image-assets", [["shared/image-assets", "references/shared/image-assets"]]],
  ["memory", [
    ["shared/memory/skills", "skills"],
    ["shared/memory/schema", "references/shared/memory/schema"],
    ["shared/memory/references", "references/shared/memory/references"],
    ["shared/memory/templates", "references/shared/memory/templates"],
  ]],
  ["reference-intelligence", [
    ["shared/reference-intelligence/skills", "skills"],
    ["shared/reference-intelligence/schema", "references/shared/reference-intelligence/schema"],
    ["shared/reference-intelligence/catalog", "references/shared/reference-intelligence/catalog"],
    ["shared/reference-intelligence/references", "references/shared/reference-intelligence/references"],
    ["shared/reference-intelligence/templates", "references/shared/reference-intelligence/templates"],
  ]],
  ["updates", [["shared/updates", "references/shared/updates"]]],
]);

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(repoRoot, relativePath), "utf8"));
}

test("shared contract documentation has the exact twelve-module mapping and current SessionStart contract", async () => {
  const documentation = await readFile(path.join(repoRoot, "shared/contracts/README.md"), "utf8");
  const modules = [
    "knowledge", "templates", "responsible-design", "export", "vendor", "archify", "im-not-ai", "document-quality", "image-assets", "memory", "reference-intelligence", "updates",
  ];
  assert.match(documentation, /두 제품은 현재 12개 모듈을 모두 선언한다\./u);
  const table = documentation.slice(documentation.indexOf("| Module | Source | Built destination |"), documentation.indexOf("Product files do not silently override shared files."));
  const rows = table.split("\n").slice(2).filter((line) => line.startsWith("| "))
    .map((line) => line.split("|").slice(1, -1).map((cell) => cell.trim()));
  assert.deepEqual(rows.map(([module]) => module?.replaceAll("`", "")), modules);
  assert.equal(rows.length, modules.length);
  for (const [module, source, destination] of rows) {
    assert.match(source, /^`shared\//u, `${module} source`);
    assert.match(destination, /^`(?:references\/shared|assets\/shared|skills\/)/u, `${module} destination`);
  }
  assert.deepEqual(rows.find(([module]) => module === "`document-quality`"), ["`document-quality`", "`shared/document-quality/`", "`references/shared/document-quality/`"]);
  assert.deepEqual(rows.find(([module]) => module === "`image-assets`"), ["`image-assets`", "`shared/image-assets/`", "`references/shared/image-assets/`"]);
  assert.match(documentation, /SessionStart는 `capability-probe\.mjs`, timeout `25`, status message `Detecting optional game-design and image capabilities`/u);
  assert.match(documentation, /top-level output은 `hookSpecificOutput`, `capabilities`, `imageConfig`, `updates`, `warnings`/u);
  assert.match(documentation, /`additionalContext`.*`capabilities`.*`imageConfig`.*`updates`/u);
});

async function mappedTreeFiles(sourceRoot, source, destination) {
  return (await collectTree(path.join(sourceRoot, source), { label: source }))
    .map(({ relativePath }) => `${destination}/${relativePath}`)
    .sort();
}

async function assertBuiltProductContract({ build, product, sourceRoot, referenceIndex, vendorLocks }) {
  const destinationMappings = new Map();
  for (const [moduleName, mappings] of sharedMappings) {
    if (!product.sharedModules.includes(moduleName)) continue;
    for (const [source, destination] of mappings) {
      (destinationMappings.get(destination) ?? destinationMappings.set(destination, []).get(destination)).push(source);
    }
  }
  for (const [destination, sources] of destinationMappings) {
    if (destination === "skills") continue;
    const expected = (await Promise.all(sources.map((source) => mappedTreeFiles(sourceRoot, source, destination)))).flat().sort();
    assert.deepEqual(
      build.files.filter((file) => file.startsWith(`${destination}/`)).sort(),
      expected,
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

async function validateDiscoveredProducts({ sourceRoot, stagingRoot, referenceIndex, vendorLocks }) {
  const productNames = await discoverProductContracts(sourceRoot);
  for (const productName of productNames) {
    if (!productLanes.has(productName)) throw new Error(`Unexpected product contract: products/${productName}/product.json`);
    const product = await loadProductContract({ repoRoot: sourceRoot, productName });
    assert.deepEqual(product.sharedModules, ["knowledge", "templates", "responsible-design", "export", "vendor", "archify", "im-not-ai", "document-quality", "image-assets", "memory", "reference-intelligence", "updates", "suite-update-skill", "suite-handoff"]);
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
      vendorLocks,
    });
  }
  return productNames;
}

function runBuiltHook({ outputDir, scriptName, input }) {
  const result = spawnSync(process.execPath, [path.join(outputDir, "scripts", scriptName)], {
    cwd: outputDir,
    env: {
      PATH: "",
      HOME: path.join(outputDir, "..", "hook-home"),
      XDG_CACHE_HOME: path.join(outputDir, "..", "hook-cache"),
      GAME_DESIGN_UPDATE_CHECKS: "false",
    },
    input: JSON.stringify(input),
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  return JSON.parse(result.stdout);
}

function installedSkillIds(files) {
  return files
    .map((file) => /^skills\/([^/]+)\/SKILL\.md$/u.exec(file)?.[1])
    .filter(Boolean)
    .sort();
}

function isInsideAllowedRoot(candidate, allowedRoots) {
  return allowedRoots.some((root) => {
    const relative = path.relative(root, candidate);
    return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
  });
}

async function assertCompilerlessRuntimeGraph({ root, entryPaths, allowedRoots, label }) {
  const pending = entryPaths.map((relativePath) => path.resolve(root, relativePath));
  const visited = new Set();
  while (pending.length) {
    const current = pending.pop();
    if (visited.has(current)) continue;
    assert.ok(isInsideAllowedRoot(current, allowedRoots), `${label} runtime import escapes allowed roots: ${current}`);
    const stats = await lstat(current);
    assert.equal(stats.isSymbolicLink(), false, `${label} runtime import is a symlink: ${current}`);
    assert.equal(stats.isFile(), true, `${label} runtime import is not a regular file: ${current}`);
    visited.add(current);
    const source = await readFile(current, "utf8");
    assert.doesNotMatch(source, /node:child_process|(?<!\.)\b(?:spawn|exec|fork)(?:Sync|File)?\s*\(|["'][^"']*\.(?:c|cc|cpp|cxx)["']|\b(?:gcc|clang|cc|c\+\+)\s*\(/u);
    const scanned = scanJavaScriptImports(source);
    assert.deepEqual(scanned.errors, [], `${label} runtime has an unresolved dynamic import`);
    const specifiers = scanned.specifiers.map(({ specifier }) => specifier);
    for (const specifier of specifiers) {
      if (specifier.startsWith("node:")) continue;
      assert.ok(specifier.startsWith("."), `${label} runtime uses a non-Node bare specifier: ${specifier}`);
      const target = fileURLToPath(new URL(specifier, pathToFileURL(current)));
      assert.ok(isInsideAllowedRoot(target, allowedRoots), `${label} runtime import escapes allowed roots: ${specifier}`);
      pending.push(target);
    }
  }
  return visited;
}

async function assertCompilerlessSealedAppend({ builds, stagingRoot }) {
  const entryPaths = [
    "scripts/capture-design-memory.mjs",
    "scripts/maintain-design-memory.mjs",
    "scripts/retrieve-design-memory.mjs",
    "scripts/load-memory-config.mjs",
    "scripts/validate-design-memory.mjs",
    "scripts/lib/safe-memory-store.mjs",
  ];
  await assertCompilerlessRuntimeGraph({
    root: repoRoot,
    entryPaths: entryPaths.map((relativePath) => `shared/${relativePath}`),
    allowedRoots: [path.join(repoRoot, "shared/scripts"), path.join(repoRoot, "shared/memory/schema")],
    label: "memory source",
  });
  for (const build of builds) {
    await assertCompilerlessRuntimeGraph({
      root: build.outputDir,
      entryPaths,
      allowedRoots: [path.join(build.outputDir, "scripts"), path.join(build.outputDir, "references/shared/memory/schema")],
      label: `${build.name} memory package`,
    });
  }
  const emptyPath = await mkdtemp(path.join(stagingRoot, "empty-path-"));
  for (const build of builds) {
    const workspaceRoot = await realpath(await mkdtemp(path.join(stagingRoot, "sealed-append-")));
    const script = `
    import { rm } from "node:fs/promises";
    import { resolveMemoryStore, appendMemoryEvent } from ${JSON.stringify(pathToFileURL(path.join(build.outputDir, "scripts/lib/safe-memory-store.mjs")).href)};
    import { canonicalMemoryEventDocument } from ${JSON.stringify(pathToFileURL(path.join(build.outputDir, "scripts/validate-design-memory.mjs")).href)};
    const workspaceRoot = ${JSON.stringify(workspaceRoot)};
    const record = { schema_version: 1, memory_id: "memory-studio-design-lesson-0f2a4c61d9ab34ef", kind: "design-lesson", lane: "studio", status: "candidate", scope: "project", project_id: "wind-island", created_at: "2026-08-12T00:00:00.000Z", updated_at: "2026-08-12T00:00:00.000Z", review_after: "2026-09-11", expires_at: "2026-09-11", approved_by: null, approval_basis: null, supersedes: null, artifact_types: ["artifact"], related_ids: ["related"], tags: ["tag"], sources: [{ artifact_id: "source", locator: "content.md#h", sha256: "${"a".repeat(64)}" }] };
    try {
      const store = await resolveMemoryStore({ workspaceRoot, config: { enabled: true, scope: "project", gitMode: "local", projectId: "wind-island" }, platform: process.platform, home: workspaceRoot, initialize: true });
      const eventDocument = canonicalMemoryEventDocument({ schema_version: 1, event_type: "capture", action: "capture", memory_id: record.memory_id, operation_id: "capture-upstream-1", parent_event_ids: [], effective_at: "2026-08-12T00:00:00.000Z", actor: "author", reason: "capture", record }, { "발견한 내용": "내용", "적용 조건": "조건", "적용하면 안 되는 경우": "제외", "근거": "근거" });
      const created = await appendMemoryEvent({ store, eventDocument });
      const present = await appendMemoryEvent({ store, eventDocument });
      if (created.status !== "created" || present.status !== "present") throw new Error("sealed append retry failed");
      process.stdout.write(JSON.stringify({ created: created.status, present: present.status }));
    } finally { await rm(workspaceRoot, { recursive: true, force: true }); }
    `;
    const result = spawnSync(process.execPath, ["--input-type=module", "--eval", script], {
      cwd: build.outputDir,
      env: {
        PATH: emptyPath,
        CC: "/nonexistent/cc",
        CXX: "/nonexistent/cxx",
        HOME: path.join(stagingRoot, "sealed-append-home"),
        XDG_CACHE_HOME: path.join(stagingRoot, "sealed-append-cache"),
        GAME_DESIGN_UPDATE_CHECKS: "false",
      },
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), { created: "created", present: "present" });
  }
  await rm(emptyPath, { recursive: true, force: true });
}

function assertCapability(capability, availableKeys) {
  assert.equal(typeof capability, "object");
  assert.equal(typeof capability.available, "boolean");
  assert.deepEqual(Object.keys(capability).sort(), capability.available ? availableKeys.sort() : ["available"]);
}

function assertSessionStartOutput(output) {
  assert.deepEqual(Object.keys(output).sort(), ["capabilities", "hookSpecificOutput", "imageConfig", "updates", "warnings"]);
  assert.deepEqual(Object.keys(output.hookSpecificOutput).sort(), ["additionalContext", "hookEventName"]);
  assert.equal(output.hookSpecificOutput.hookEventName, "SessionStart");
  assert.equal(typeof output.hookSpecificOutput.additionalContext, "string");
  assert.deepEqual(Object.keys(output.capabilities), [
    "node", "chromium", "soffice", "documents", "pdf", "presentations", "image_generation", "archify",
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
  assert.ok(["available", "unavailable", "unknown"].includes(output.capabilities.image_generation.status));
  if (output.capabilities.image_generation.status === "available") assert.equal(typeof output.capabilities.image_generation.provider, "string");
  assert.deepEqual(Object.keys(output.imageConfig).sort(), [
    "apiKeyPresent",
    "embeddedTextLocale",
    "mode",
    "model",
    "providerPreference",
    "quality",
    "sources",
    "warnings",
  ]);
  assert.equal(typeof output.imageConfig.apiKeyPresent, "boolean");
  assert.doesNotMatch(JSON.stringify(output.imageConfig), /sk-[A-Za-z0-9]/u);
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
    { capabilities: output.capabilities, imageConfig: output.imageConfig, updates: output.updates },
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
    "hookSpecificOutput`, `capabilities`, `imageConfig`, `updates`, `warnings",
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
    sharedModules: [...fixtureProduct.sharedModules, "archify", "im-not-ai", "document-quality", "image-assets", "memory", "reference-intelligence", "updates", "suite-update-skill", "suite-handoff"],
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
  const vendorLocks = {
    vendor: await readJson("shared/vendor/skillstead/vendor.lock.json"),
    archify: await readJson("shared/vendor/archify/vendor.lock.json"),
    "im-not-ai": await readJson("shared/vendor/im-not-ai/vendor.lock.json"),
  };
  const built = await buildProduct({ repoRoot: fixtureRoot, productName: "game-design-studio", stagingRoot, sourceDateEpoch: 0 });
  await assertBuiltProductContract({
    build: built,
    product: selectableFixture,
    sourceRoot: fixtureRoot,
    referenceIndex,
    vendorLocks,
  });
  assert.equal(built.files.filter((file) => file.startsWith("references/source/docs/")).length, 49);
  for (const skillId of ["capture-game-design-memory", "maintain-game-design-memory", "retrieve-approved-design-memory"]) {
    assert.ok(built.files.includes(`skills/${skillId}/SKILL.md`));
  }
  for (const relativePath of [
    "references/shared/memory/schema/memory-config.schema.json",
    "references/shared/memory/schema/memory-event.schema.json",
    "references/shared/memory/schema/memory-record.schema.json",
    "references/shared/memory/schema/memory-index.schema.json",
    "references/shared/memory/schema/memory-receipt.schema.json",
    "references/shared/memory/references/memory-policy.md",
    "references/shared/memory/references/memory-lifecycle.md",
  ]) assert.ok(built.files.includes(relativePath), relativePath);
  for (const relativePath of [
    "skills/analyze-game-design-references/SKILL.md",
    "skills/maintain-game-design-glossary/SKILL.md",
    "references/shared/reference-intelligence/schema/game-design-glossary.schema.json",
    "references/shared/reference-intelligence/schema/glossary-receipt.schema.json",
    "references/shared/reference-intelligence/schema/reference-analysis.schema.json",
    "references/shared/reference-intelligence/catalog/system-atlas.json",
    "references/shared/reference-intelligence/catalog/source-register.json",
    "references/shared/reference-intelligence/references/evidence-policy.md",
    "references/shared/reference-intelligence/templates/reference-set.yml",
  ]) assert.ok(built.files.includes(relativePath), relativePath);

  await validateDiscoveredProducts({ sourceRoot: repoRoot, stagingRoot, referenceIndex, vendorLocks });
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
  const expectedSharedSkillIds = [
    "analyze-game-design-references",
    "archify",
    "capture-game-design-memory",
    "humanize-korean",
    "maintain-game-design-glossary",
    "maintain-game-design-memory",
    "retrieve-approved-design-memory",
    "svg-infographic",
    "upgrade-game-design-suite",
  ];
  for (const [productName, build] of [["game-design-studio", studioBuild], ["game-design-career", careerBuild]]) {
    const sourceSkillIds = (await readdir(path.join(repoRoot, "products", productName, "plugin", "skills"), { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    const installed = installedSkillIds(build.files);
    const sharedSkillIds = installed.filter((skillId) => !sourceSkillIds.includes(skillId));
    assert.equal(sourceSkillIds.length, productName === "game-design-studio" ? 17 : 16);
    assert.deepEqual(sharedSkillIds, expectedSharedSkillIds);
    assert.equal(installed.length, productName === "game-design-studio" ? 26 : 25);
  }

  const receiptSource = await readFile(path.join(repoRoot, "shared/memory/schema/memory-receipt.schema.json"));
  for (const build of [studioBuild, careerBuild]) {
    assert.deepEqual(
      await readFile(path.join(build.outputDir, "references/shared/memory/schema/memory-receipt.schema.json")),
      receiptSource,
    );
  }
  for (const build of [studioBuild, careerBuild]) {
    for (const relativePath of [
      "skills/analyze-game-design-references/SKILL.md",
      "skills/analyze-game-design-references/agents/openai.yaml",
      "skills/maintain-game-design-glossary/SKILL.md",
      "skills/maintain-game-design-glossary/agents/openai.yaml",
      "references/shared/reference-intelligence/schema/game-design-glossary.schema.json",
      "references/shared/reference-intelligence/schema/glossary-receipt.schema.json",
      "references/shared/reference-intelligence/schema/reference-analysis.schema.json",
      "references/shared/reference-intelligence/catalog/system-atlas.json",
      "references/shared/reference-intelligence/catalog/source-register.json",
      "references/shared/reference-intelligence/references/evidence-policy.md",
      "references/shared/reference-intelligence/templates/reference-set.yml",
    ]) {
      assert.deepEqual(
        await readFile(path.join(build.outputDir, relativePath)),
        await readFile(path.join(repoRoot, relativePath.startsWith("skills/") ? `shared/reference-intelligence/skills/${relativePath.slice("skills/".length)}` : `shared/reference-intelligence/${relativePath.slice("references/shared/reference-intelligence/".length)}`)),
        `${build.name}: ${relativePath} is byte-identical to the shared reference-intelligence source`,
      );
    }
  }
  const [indexSchema, receiptSchema] = await Promise.all([
    readJson("shared/memory/schema/memory-index.schema.json"),
    readJson("shared/memory/schema/memory-receipt.schema.json"),
  ]);
  assert.equal(indexSchema.properties.entries.maxItems, 10000);
  for (const field of ["observations", "applied", "excluded"]) assert.equal(receiptSchema.properties[field].maxItems, 256);
  const policy = await readFile(path.join(repoRoot, "shared/memory/references/memory-policy.md"), "utf8");
  const lifecycle = await readFile(path.join(repoRoot, "shared/memory/references/memory-lifecycle.md"), "utf8");
  for (const text of [policy, lifecycle]) {
    for (const clause of ["derived/receipts/<request-sha256>/<receipt-sha256>/instances/<instance-id>.json", "immutable history", "open('wx')", "global-first/local-second", "opendir()", "100,000", "cache reset", "fail-closed", "1 MiB/256 KiB/1 MiB/1 MiB", "256개", "10,000개"]) assert.match(text, new RegExp(clause.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(lifecycle, /derived\/logs\//u);
  assert.match(lifecycle, /Markdown view/u);

  const expectedWorkflow = {
    retrieveSkill: "retrieve-approved-design-memory",
    captureSkill: "capture-game-design-memory",
    maintenanceSkill: "maintain-game-design-memory",
    retrievePlacement: "after-intake-before-specialist-routing",
    capturePlacement: "after-completion-gates",
    defaultScope: "project",
    defaultMaxItems: 5,
    requiresProjectId: true,
    dedicatedAgent: false,
  };
  const routingOwners = {
    "game-design-studio": {
      "retrieve-approved-design-memory": ["lead-game-designer"],
      "capture-game-design-memory": ["lead-game-designer"],
      "maintain-game-design-memory": ["document-quality-editor"],
    },
    "game-design-career": {
      "retrieve-approved-design-memory": ["career-strategist"],
      "capture-game-design-memory": ["evidence-auditor"],
      "maintain-game-design-memory": ["evidence-auditor"],
    },
  };
  const expectedCareerSkillIds = [
    "game-design-career",
    "orchestrate-game-design-career",
    "map-game-design-career",
    "research-game-design-jobs",
    "build-game-design-portfolio",
    "reverse-engineer-game-design",
    "practice-game-design-interview",
    "review-game-design-portfolio",
    "plan-junior-growth",
    "visualize-career-roadmap",
    "export-career-documents",
    "apply-document-quality-profile",
    "plan-image-assets",
    "generate-image-assets",
    "review-image-assets",
    "polish-game-design-writing",
    "humanize-korean",
    "archify",
    "retrieve-approved-design-memory",
    "capture-game-design-memory",
    "maintain-game-design-memory",
    "analyze-game-design-references",
    "maintain-game-design-glossary",
    "upgrade-game-design-suite",
  ];
  for (const [productName, owners] of Object.entries(routingOwners)) {
    const routing = await readJson(`products/${productName}/plugin/references/routing.json`);
    if (productName === "game-design-career") assert.deepEqual(routing.skillIds, expectedCareerSkillIds);
    assert.deepEqual(routing.memoryWorkflow, expectedWorkflow);
    const expectedPlannedSkills = routing.skillIds.map((skillId) => `skills/${skillId}/SKILL.md`);
    assert.deepEqual(routing.plannedPaths.skills, expectedPlannedSkills, `${productName}: planned skill paths are complete and canonical`);
    assert.equal(new Set(routing.plannedPaths.skills.map((skillPath) => skillPath.normalize("NFC"))).size, routing.plannedPaths.skills.length);
    for (const skillId of Object.keys(owners)) {
      assert.ok(routing.skillIds.includes(skillId));
      assert.deepEqual(routing.directUseReviewOwners.find((entry) => entry.skill === skillId)?.owners, owners[skillId]);
    }
  }
  await assertCompilerlessSealedAppend({ builds: [studioBuild, careerBuild], stagingRoot });
  const referenceEntryPaths = [
    "scripts/analyze-game-design-references.mjs",
    "scripts/manage-game-design-glossary.mjs",
    "scripts/validate-game-design-writing-language.mjs",
    "scripts/validate-reference-intelligence.mjs",
  ];
  await assertCompilerlessRuntimeGraph({
    root: repoRoot,
    entryPaths: referenceEntryPaths.map((relativePath) => `shared/${relativePath}`),
    allowedRoots: [path.join(repoRoot, "shared/scripts"), path.join(repoRoot, "shared/reference-intelligence")],
    label: "reference-intelligence source",
  });
  for (const build of [studioBuild, careerBuild]) {
    await assertCompilerlessRuntimeGraph({
      root: build.outputDir,
      entryPaths: referenceEntryPaths,
      allowedRoots: [path.join(build.outputDir, "scripts"), path.join(build.outputDir, "references/shared/reference-intelligence")],
      label: `${build.name} reference-intelligence package`,
    });
    const emptyPath = await mkdtemp(path.join(stagingRoot, "reference-empty-path-"));
    const smoke = spawnSync(process.execPath, ["--input-type=module", "--eval", `
      await import(${JSON.stringify(pathToFileURL(path.join(build.outputDir, "scripts/analyze-game-design-references.mjs")).href)});
      await import(${JSON.stringify(pathToFileURL(path.join(build.outputDir, "scripts/manage-game-design-glossary.mjs")).href)});
      await import(${JSON.stringify(pathToFileURL(path.join(build.outputDir, "scripts/validate-game-design-writing-language.mjs")).href)});
      const validator = await import(${JSON.stringify(pathToFileURL(path.join(build.outputDir, "scripts/validate-reference-intelligence.mjs")).href)});
      if (validator.validateGameDesignGlossary({})?.ok !== false) throw new Error("installed glossary evaluator smoke failed");
      process.stdout.write(JSON.stringify({ imported: true }));
    `], {
      cwd: build.outputDir,
      env: {
        PATH: emptyPath,
        CC: "/nonexistent/cc",
        CXX: "/nonexistent/cxx",
        HOME: path.join(stagingRoot, "reference-import-home"),
        XDG_CACHE_HOME: path.join(stagingRoot, "reference-import-cache"),
        GAME_DESIGN_UPDATE_CHECKS: "false",
      },
      encoding: "utf8",
    });
    await rm(emptyPath, { recursive: true, force: true });
    assert.equal(smoke.status, 0, smoke.stderr);
    assert.deepEqual(JSON.parse(smoke.stdout), { imported: true });
  }
  await assert.rejects(
    () => validateDiscoveredProducts({ sourceRoot: fixtureRoot, stagingRoot, referenceIndex, vendorLocks }),
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
    () => validateDiscoveredProducts({ sourceRoot: fixtureRoot, stagingRoot, referenceIndex, vendorLocks }),
    /Unsupported products entry: products\/unexpected-product is a symlink/,
  );
  await rm(path.join(fixtureRoot, "products/unexpected-product"), { force: true });
  await cp(
    path.join(fixtureRoot, "products/game-design-studio"),
    path.join(fixtureRoot, "products/game-design-career"),
    { recursive: true },
  );
  await assert.rejects(
    () => validateDiscoveredProducts({ sourceRoot: fixtureRoot, stagingRoot, referenceIndex, vendorLocks }),
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
      vendorLocks,
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
          timeout: 25,
          statusMessage: "Detecting optional game-design and image capabilities",
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

  // The closure has to verify completely; how many files an upstream release happens to contain is the
  // release's business, so it comes from the lock rather than from a number typed here.
  const skillsteadFiles = vendorLocks.vendor.tree.files.length;
  assert.ok(skillsteadFiles > 0);
  assert.deepEqual(await verifyDiagramSkillVendor({ root: path.join(repoRoot, "shared/vendor/skillstead"), name: "skillstead" }), { name: "skillstead", tag: vendorTag("skillstead"), verifiedFiles: skillsteadFiles });
  assert.equal(typeof buildProduct, "function");
  assert.equal(typeof loadProductContract, "function");
  assert.equal(typeof validateProductContract, "function");
});
