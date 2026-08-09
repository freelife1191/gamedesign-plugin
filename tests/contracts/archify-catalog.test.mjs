import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import {
  discoverArchifySourceDocuments,
  loadArchifyCatalog,
} from "../../tooling/lib/archify-catalog.mjs";

const repoRoot = path.resolve(import.meta.dirname, "../..");

test("production Archify catalog covers the complete declared Markdown corpus", async () => {
  const catalog = await loadArchifyCatalog({ repoRoot });
  const documents = await discoverArchifySourceDocuments({
    repoRoot,
    scanRoots: catalog.scan_roots,
    scanExcludes: catalog.scan_excludes,
  });

  assert.equal(new Set(catalog.entries.map((entry) => entry.source_document)).size, documents.length);
  assert.deepEqual(
    [...new Set(catalog.entries.map((entry) => entry.source_document))].sort(),
    documents,
  );
});

test("production inventory has bounded diagrams and explicit package exclusions", async () => {
  const catalog = await loadArchifyCatalog({ repoRoot });
  for (const document of new Set(catalog.entries.map((entry) => entry.source_document))) {
    const entries = catalog.entries.filter((entry) => entry.source_document === document);
    assert.ok(entries.filter((entry) => entry.priority === "primary").length <= 1, document);
    assert.ok(entries.filter((entry) => entry.priority === "secondary").length <= 1, document);
  }
  for (const entry of catalog.entries.filter((item) => item.source_document.startsWith("products/"))) {
    assert.equal(entry.decision, "excluded");
    assert.match(entry.decision_reason, /package surface|패키지 외부 링크/u);
  }
  for (const entry of catalog.entries.filter((item) => item.source_document.startsWith("plugins/"))) {
    assert.equal(entry.decision, "excluded");
    assert.match(entry.decision_reason, /products\/game-design-(?:studio|career)/u);
  }
});
