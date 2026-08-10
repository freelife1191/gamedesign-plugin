import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { loadArchifyCatalog } from "../../tooling/lib/archify-catalog.mjs";
import { loadArchifyVisualQa } from "../../tooling/lib/archify-visual-qa.mjs";

const repoRoot = path.resolve(import.meta.dirname, "../..");

test("production visual QA manifest binds every published entry to passing headless evidence", async () => {
  const manifest = JSON.parse(await readFile(path.join(repoRoot, "guides/archify-diagrams/visual-qa/manifest.json"), "utf8"));
  const catalog = await loadArchifyCatalog({ repoRoot });
  const passed = catalog.entries.filter((entry) => ["passed", "published"].includes(entry.delivery_status)).map((entry) => entry.id).sort();
  assert.deepEqual(manifest.entries.map((entry) => entry.id).sort(), passed);
  assert.deepEqual(manifest.entries.filter((entry) => entry.verdict === "passed").map((entry) => entry.id).sort(), passed);
  assert.deepEqual(manifest.entries.filter((entry) => entry.verdict === "failed").map((entry) => entry.id), []);
  const loaded = await loadArchifyVisualQa({ repoRoot });
  assert.deepEqual(loaded.qa.entries.filter((entry) => entry.verdict === "passed").map((entry) => entry.id).sort(), passed);
  assert.deepEqual(loaded.qa.entries.filter((entry) => entry.verdict === "failed").map((entry) => entry.id), []);
});

test("the Korean suite system architecture has six complete published visual QA views", async () => {
  const catalog = await loadArchifyCatalog({ repoRoot });
  const entry = catalog.entries.find((candidate) => candidate.id === "suite-plugin-system-architecture");
  assert.ok(entry, "suite system architecture catalog record exists");
  assert.equal(entry.delivery_status, "published");
  assert.equal(entry.visual_review, "passed");
  assert.equal(entry.reviewer, "Codex 헤드리스 시각 QA");

  const loaded = await loadArchifyVisualQa({ repoRoot, catalog });
  const qa = loaded.qa.entries.find((candidate) => candidate.id === entry.id);
  assert.ok(qa, "suite system architecture QA record exists");
  assert.equal(qa.verdict, "passed");
  assert.equal(qa.review_method, "headless-original-and-fit");
  assert.deepEqual(
    ["read", "light", "dark", ...qa.renders.guided_views.map((view) => view.id)].sort(),
    ["read", "light", "dark", "view-plugin-boundaries", "view-artifact-validation", "view-human-approval"].sort(),
  );
  assert.ok(qa.readme_preview, "suite system architecture publishes a dedicated README preview capture");
  assert.equal(
    qa.readme_preview.path,
    "renders/suite/suite-plugin-system-architecture/readme-preview.png",
    "README preview is distinct from the full-page READ capture",
  );
  assert.ok(qa.readme_preview.width >= 1200 && qa.readme_preview.height >= 600, "README preview keeps readable architecture occupancy");
  assert.match(qa.readme_preview.sha256, /^[0-9a-f]{64}$/u, "README preview has digest-bound QA evidence");
  for (const render of [qa.renders.read, qa.renders.light, qa.renders.dark, ...qa.renders.guided_views]) {
    assert.equal(render.width, 1600, `${render.path} uses the production viewport width`);
    assert.ok(render.height > 0, `${render.path} has an inspected nonzero height`);
    assert.match(render.sha256, /^[0-9a-f]{64}$/u, `${render.path} has a pinned digest`);
  }
  assert.equal(loaded.qa.contact_sheets.some((sheet) => sheet.html === "product-suite.html"), true);
  assert.equal(loaded.qa.contact_sheets.some((sheet) => sheet.html === "type-architecture.html"), true);
});
