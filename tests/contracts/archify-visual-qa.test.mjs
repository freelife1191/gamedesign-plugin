import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { loadArchifyCatalog } from "../../tooling/lib/archify-catalog.mjs";
import { loadArchifyVisualQa } from "../../tooling/lib/archify-visual-qa.mjs";

const repoRoot = path.resolve(import.meta.dirname, "../..");

test("production visual QA manifest binds passed entries and preserves blocked-visual failure evidence", async () => {
  const manifest = JSON.parse(await readFile(path.join(repoRoot, "guides/archify-diagrams/visual-qa/manifest.json"), "utf8"));
  const catalog = await loadArchifyCatalog({ repoRoot });
  const passed = catalog.entries.filter((entry) => ["passed", "published"].includes(entry.delivery_status)).map((entry) => entry.id).sort();
  const blocked = catalog.entries.filter((entry) => entry.delivery_status === "blocked-visual").map((entry) => entry.id).sort();
  assert.deepEqual(manifest.entries.map((entry) => entry.id).sort(), [...passed, ...blocked].sort());
  assert.deepEqual(manifest.entries.filter((entry) => entry.verdict === "passed").map((entry) => entry.id).sort(), passed);
  assert.deepEqual(manifest.entries.filter((entry) => entry.verdict === "failed").map((entry) => entry.id).sort(), blocked);
  const loaded = await loadArchifyVisualQa({ repoRoot });
  assert.deepEqual(loaded.qa.entries.filter((entry) => entry.verdict === "passed").map((entry) => entry.id).sort(), passed);
  assert.deepEqual(loaded.qa.entries.filter((entry) => entry.verdict === "failed").map((entry) => entry.id).sort(), blocked);
});
