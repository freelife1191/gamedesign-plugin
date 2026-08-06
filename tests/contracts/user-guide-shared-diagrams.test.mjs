import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));

test("shared diagram manifest declares six verified diagrams", async () => {
  const manifest = JSON.parse(await readFile(
    path.join(root, "guides/assets/diagram-manifest.json"),
    "utf8",
  ));
  const shared = manifest.diagrams.filter(({ scope }) => scope === "shared");
  assert.deepEqual(shared.map(({ id }) => id).sort(), [
    "app-cli-install-flow",
    "canonical-artifact-lifecycle",
    "document-export-flow",
    "image-asset-lifecycle",
    "image-generation-mode-routing",
    "plugin-selection-flow",
  ]);
  for (const diagram of shared) {
    assert.ok(diagram.alt);
    assert.ok(diagram.sources.length > 0);
    assert.ok(diagram.usedBy.length > 0);
  }
});
