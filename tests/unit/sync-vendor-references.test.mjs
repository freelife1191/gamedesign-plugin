import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { parseVendorReferenceArgs, syncVendorReferences, vendorReferenceState } from "../../tooling/sync-vendor-references.mjs";

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));

const TOUCHED = Object.freeze([
  "products/game-design-studio/plugin/THIRD_PARTY_NOTICES.md",
  "products/game-design-career/plugin/THIRD_PARTY_NOTICES.md",
  "products/game-design-studio/plugin/README.md",
  "products/game-design-career/plugin/README.md",
  "products/game-design-studio/plugin/skills/polish-game-design-writing/SKILL.md",
  "products/game-design-career/plugin/skills/polish-game-design-writing/SKILL.md",
  "products/game-design-studio/plugin/skills/visualize-game-design/scripts/validate-visualization-evidence.mjs",
  "guides/archify-diagrams/catalog.json",
  "guides/assets/diagram-manifest.json",
  "shared/contracts/README.md",
  "shared/scripts/capability-probe.mjs",
  "architecture/plugin-suite.md",
  "architecture/knowledge-and-evidence.md",
  "guides/game-design-studio/skills/svg-infographic.md",
  "guides/game-design-career/skills/svg-infographic.md",
  "README.md",
]);

async function checkout(t) {
  const root = await mkdtemp(path.join(tmpdir(), "vendor-references-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const relative of [...TOUCHED, "products/game-design-studio/plugin/skills/visualize-game-design/scripts/run-skillstead.mjs"]) {
    await cp(path.join(repoRoot, relative), path.join(root, relative), { recursive: true, force: true });
  }
  for (const name of ["skillstead", "archify", "im-not-ai"]) {
    await cp(path.join(repoRoot, "shared/vendor", name, "vendor.lock.json"), path.join(root, "shared/vendor", name, "vendor.lock.json"), { force: true });
  }
  await cp(path.join(repoRoot, "shared/vendor/skillstead/svg-infographic"), path.join(root, "shared/vendor/skillstead/svg-infographic"), { recursive: true });
  return root;
}

test("the committed documents already agree with the vendor locks", async () => {
  assert.deepEqual(await syncVendorReferences({ check: true }), { status: "current", rules: 29, drifted: [] });
});

test("every stated version comes from a lock, not from the document", async () => {
  const state = await vendorReferenceState();
  const notices = await readFile(path.join(repoRoot, "products/game-design-studio/plugin/THIRD_PARTY_NOTICES.md"), "utf8");
  assert.ok(notices.includes(`\`${state.skillstead.tag}\`, \`${state.skillstead.commit}\``), "skillstead line is written from its lock");
  assert.ok(notices.includes(`\`${state.archify.tag}\`, \`${state.archify.commit}\``), "archify line is written from its lock");
  assert.ok(notices.includes(`\`${state.imNotAi.tag}\` (\`${state.imNotAi.commit}\`)`), "im-not-ai line is written from its lock");
  for (const digest of Object.values(state.runtime)) assert.match(digest, /^[a-f0-9]{64}$/u);
});

// This is the whole point of the tool: an upstream bump moves the lock, and every document that states
// the version follows without anyone hunting for literals.
test("a bumped lock drives every document, and --check refuses to let one lag", async (t) => {
  const root = await checkout(t);
  const lockPath = path.join(root, "shared/vendor/archify/vendor.lock.json");
  const lock = JSON.parse(await readFile(lockPath, "utf8"));
  lock.upstream.tag = "v9.9.9";
  lock.upstream.commit = "f".repeat(40);
  await writeFile(lockPath, `${JSON.stringify(lock, null, 2)}\n`);

  const pending = await syncVendorReferences({ root, check: true });
  assert.equal(pending.status, "drifted");
  assert.equal(pending.drifted.length, 6, JSON.stringify(pending.drifted));

  const written = await syncVendorReferences({ root });
  assert.equal(written.status, "written");
  for (const product of ["game-design-studio", "game-design-career"]) {
    const notices = await readFile(path.join(root, `products/${product}/plugin/THIRD_PARTY_NOTICES.md`), "utf8");
    assert.ok(notices.includes(`- Version: 9.9.9 (\`v9.9.9\`, \`${"f".repeat(40)}\`)`), `${product} notices follow the lock`);
    const readme = await readFile(path.join(root, `products/${product}/plugin/README.md`), "utf8");
    assert.ok(readme.includes("# vendored Archify 9.9.9"), `${product} README follows the lock`);
  }
  // The Archify diagram catalog cites the vendored tree by path, and the path carries the version.
  const catalog = await readFile(path.join(root, "guides/archify-diagrams/catalog.json"), "utf8");
  assert.ok(catalog.includes("shared/vendor/archify/archify/9.9.9/"), "catalog citations follow the lock");
  assert.equal(catalog.includes("shared/vendor/archify/archify/2.15.0/"), false, "no citation lags behind");
  // The shared contract README states the same build mapping in a table, and it lagged two bumps behind
  // before it was pinned here.
  const contracts = await readFile(path.join(root, "shared/contracts/README.md"), "utf8");
  assert.ok(contracts.includes("shared/vendor/archify/archify/9.9.9/"), "the shared contract mapping follows the lock");
  assert.deepEqual(await syncVendorReferences({ root, check: true }), { status: "current", rules: 29, drifted: [] });
});

// The renderer version is stated in prose on five more surfaces than the tables cover. Those five had
// drifted to two different stale versions before they were pinned here, so a bump has to reach them too.
test("a skillstead bump reaches the architecture notes, the guide pages, the contract and the probe", async (t) => {
  const root = await checkout(t);
  const lockPath = path.join(root, "shared/vendor/skillstead/vendor.lock.json");
  const lock = JSON.parse(await readFile(lockPath, "utf8"));
  lock.upstream.tag = "svg-infographic/v9.9.9";
  lock.upstream.commit = "e".repeat(40);
  lock.tree.files = lock.tree.files.slice(0, 7);
  // The validator digests the renderer scripts of whichever tree the lock names, so the bumped tree has
  // to exist before the sync can be asked what the new digests are.
  const vendorRoot = path.join(root, "shared/vendor/skillstead");
  await cp(path.join(vendorRoot, lock.tree.root, "scripts"), path.join(vendorRoot, "svg-infographic/9.9.9/scripts"), { recursive: true });
  lock.tree.root = "svg-infographic/9.9.9";
  await writeFile(lockPath, `${JSON.stringify(lock, null, 2)}\n`);

  assert.equal((await syncVendorReferences({ root })).status, "written");
  for (const [relative, expected] of [
    ["architecture/knowledge-and-evidence.md", "Skillstead `svg-infographic` 9.9.9"],
    ["architecture/plugin-suite.md", "Skillstead 9.9.9"],
    ["guides/game-design-studio/skills/svg-infographic.md", "vendored Skillstead 9.9.9"],
    ["guides/game-design-career/skills/svg-infographic.md", "vendored Skillstead 9.9.9"],
    ["shared/scripts/capability-probe.mjs", "vendored Skillstead 9.9.9"],
    ["shared/contracts/README.md", "vendored Skillstead 9.9.9"],
    // The reserved-destination clause counts the lock's paths, so a lock that carries seven says seven.
    ["shared/contracts/README.md", "Skillstead lock의 7개 path"],
  ]) {
    const document = await readFile(path.join(root, relative), "utf8");
    assert.ok(document.includes(expected), `${relative} must state ${expected}`);
  }
  assert.deepEqual(await syncVendorReferences({ root, check: true }), { status: "current", rules: 29, drifted: [] });
});

// A document that no longer states a version is not a synced document. Reporting it clean would let a
// restructure quietly delete the provenance this tool exists to keep accurate.
test("a document that lost its version line fails instead of passing silently", async (t) => {
  const root = await checkout(t);
  const notices = path.join(root, "products/game-design-career/plugin/THIRD_PARTY_NOTICES.md");
  const source = await readFile(notices, "utf8");
  await writeFile(notices, source.replace(/^- Version: `v\d+\.\d+\.\d+` \(`[a-f0-9]{40}`\)$/mu, "- Version: (removed)"));
  await assert.rejects(() => syncVendorReferences({ root, check: true }), (error) => {
    assert.equal(error.code, "VENDOR_REFERENCE_ANCHOR_MISSING");
    assert.match(error.path, /game-design-career/u);
    return true;
  });
});

test("the argument parser accepts nothing beyond --check", () => {
  assert.deepEqual(parseVendorReferenceArgs([]), { check: false });
  assert.deepEqual(parseVendorReferenceArgs(["--check"]), { check: true });
  assert.throws(() => parseVendorReferenceArgs(["--write"]), /Usage/u);
});
