import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { loadArchifyCatalog } from "../../tooling/lib/archify-catalog.mjs";
import { loadArchifyVisualQa } from "../../tooling/lib/archify-visual-qa.mjs";

const repoRoot = path.resolve(import.meta.dirname, "../..");

test("production visual QA manifest is an empty pending ledger until a catalog entry passes or publishes", async () => {
  const manifest = JSON.parse(await readFile(path.join(repoRoot, "guides/archify-diagrams/visual-qa/manifest.json"), "utf8"));
  assert.deepEqual(manifest, { schema_version: 1, entries: [] });
  const catalog = await loadArchifyCatalog({ repoRoot });
  assert.equal(catalog.entries.some((entry) => ["passed", "published"].includes(entry.delivery_status)), false);
  const loaded = await loadArchifyVisualQa({ repoRoot });
  assert.deepEqual(loaded.qa.entries, []);
});
