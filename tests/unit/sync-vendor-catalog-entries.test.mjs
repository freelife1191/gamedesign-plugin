import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  generatedCatalogDocuments,
  parseVendorCatalogArgs,
  syncVendorCatalogEntries,
} from "../../tooling/sync-vendor-catalog-entries.mjs";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const CATALOG = "guides/archify-diagrams/catalog.json";
const MIRROR = "plugins/game-design-studio/skills/svg-infographic/SKILL.md";

// The tool reads the vendor locks, the built packages, and the catalog. A checkout carries those three
// and nothing else, so a test that mutates a package cannot touch the repository it was copied from.
async function checkout(t) {
  const root = await mkdtemp(path.join(tmpdir(), "vendor-catalog-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, "guides/archify-diagrams"), { recursive: true });
  await cp(path.join(repoRoot, CATALOG), path.join(root, CATALOG));
  for (const relative of [
    "README.md",
    "guides/assets/diagram-manifest.json",
    "shared/contracts/README.md",
    "products/game-design-studio/product.json",
    "products/game-design-career/product.json",
  ]) {
    await mkdir(path.join(root, path.dirname(relative)), { recursive: true });
    await cp(path.join(repoRoot, relative), path.join(root, relative));
  }
  for (const name of ["skillstead", "archify", "im-not-ai"]) {
    await mkdir(path.join(root, "shared/vendor", name), { recursive: true });
    await cp(path.join(repoRoot, "shared/vendor", name, "vendor.lock.json"), path.join(root, "shared/vendor", name, "vendor.lock.json"));
  }
  await cp(path.join(repoRoot, "shared/vendor/skillstead/svg-infographic"), path.join(root, "shared/vendor/skillstead/svg-infographic"), { recursive: true });
  for (const product of ["game-design-studio", "game-design-career"]) {
    await cp(path.join(repoRoot, "plugins", product), path.join(root, "plugins", product), { recursive: true });
    for (const relative of [
      "THIRD_PARTY_NOTICES.md",
      "README.md",
      "skills/polish-game-design-writing/SKILL.md",
      "skills/visualize-game-design/scripts/validate-visualization-evidence.mjs",
      "skills/visualize-game-design/scripts/run-skillstead.mjs",
      "skills/visualize-career-roadmap/scripts/run-skillstead.mjs",
    ]) {
      const source = path.join(repoRoot, "products", product, "plugin", relative);
      const destination = path.join(root, "products", product, "plugin", relative);
      await mkdir(path.dirname(destination), { recursive: true });
      await cp(source, destination).catch((error) => {
        if (error.code !== "ENOENT") throw error;
      });
    }
  }
  return root;
}

test("the committed catalog already agrees with the packages and the vendor locks", async () => {
  assert.deepEqual(await syncVendorCatalogEntries({ check: true }), { status: "current", added: [], updated: [], removed: [] });
});

test("the generated set is the vendored mirrors plus the lock-written documents, and nothing outside the scan roots", async () => {
  const catalog = JSON.parse(await readFile(path.join(repoRoot, CATALOG), "utf8"));
  const { mirrored, refreshed } = await generatedCatalogDocuments({ root: repoRoot, scanRoots: catalog.scan_roots });
  assert.ok(mirrored.has(MIRROR), "a vendored packaged document is a mirror");
  assert.ok(refreshed.has("plugins/game-design-studio/THIRD_PARTY_NOTICES.md"), "a lock-written package document is refreshed");
  assert.ok(refreshed.has("products/game-design-studio/plugin/THIRD_PARTY_NOTICES.md"), "its product source is refreshed too");
  // Rule targets outside the catalog's corpus have no entry and must not gain one.
  assert.equal(refreshed.has("shared/contracts/README.md"), false);
  for (const document of [...mirrored, ...refreshed]) {
    assert.ok(catalog.scan_roots.some((root) => document === root || document.startsWith(`${root}/`)), document);
  }
});

test("a changed vendored mirror is refreshed, and a removed one loses its entry", async (t) => {
  const root = await checkout(t);
  const mirrorPath = path.join(root, MIRROR);
  const rewritten = `# svg-infographic\n\nupstream rewrote this document.\n`;
  await writeFile(mirrorPath, rewritten);

  const pending = await syncVendorCatalogEntries({ root, check: true });
  assert.deepEqual(pending.added, []);
  assert.deepEqual(pending.updated, [MIRROR]);
  assert.deepEqual(pending.removed, []);

  const written = await syncVendorCatalogEntries({ root });
  assert.equal(written.status, "written");
  const catalog = JSON.parse(await readFile(path.join(root, CATALOG), "utf8"));
  const entry = catalog.entries.find(({ source_document: document }) => document === MIRROR);
  assert.equal(entry.source_digest, createHash("sha256").update(rewritten).digest("hex"));
  assert.deepEqual(await syncVendorCatalogEntries({ root, check: true }), { status: "current", added: [], updated: [], removed: [] });

  await rm(mirrorPath);
  const dropped = await syncVendorCatalogEntries({ root });
  assert.deepEqual(dropped.removed, [MIRROR]);
  const after = JSON.parse(await readFile(path.join(root, CATALOG), "utf8"));
  assert.equal(after.entries.some(({ source_document: document }) => document === MIRROR), false);
});

test("a new vendored document gains an excluded package-mirror entry with its own heading", async (t) => {
  const root = await checkout(t);
  const added = "plugins/game-design-studio/skills/svg-infographic/references/brand-new.md";
  await writeFile(path.join(root, added), "# Brand new upstream reference\n\nbody\n");

  const written = await syncVendorCatalogEntries({ root });
  assert.deepEqual(written.added, [added]);
  const catalog = JSON.parse(await readFile(path.join(root, CATALOG), "utf8"));
  const entry = catalog.entries.find(({ source_document: document }) => document === added);
  assert.equal(entry.id, `excluded-${createHash("sha256").update(added).digest("hex").slice(0, 12)}`);
  assert.equal(entry.product, "studio");
  assert.equal(entry.source_section, "Brand new upstream reference");
  assert.equal(entry.decision, "excluded");
  assert.equal(entry.exclusion_code, "excluded-package-mirror");
  assert.deepEqual([entry.spec, entry.html, entry.receipt], [null, null, null]);
});

// A vendored document with no heading cannot be given a section that the catalog validator would find,
// so the tool refuses rather than writing an entry that fails validation later.
test("a vendored document with no heading stops the run", async (t) => {
  const root = await checkout(t);
  await writeFile(path.join(root, "plugins/game-design-studio/skills/svg-infographic/references/headless.md"), "no heading here\n");
  await assert.rejects(() => syncVendorCatalogEntries({ root }), (error) => {
    assert.equal(error.code, "VENDOR_CATALOG_DOCUMENT_HAS_NO_HEADING");
    return true;
  });
});

test("the argument parser accepts nothing beyond --check", () => {
  assert.deepEqual(parseVendorCatalogArgs([]), { check: false });
  assert.deepEqual(parseVendorCatalogArgs(["--check"]), { check: true });
  assert.throws(() => parseVendorCatalogArgs(["--write"]), /Usage/u);
});
