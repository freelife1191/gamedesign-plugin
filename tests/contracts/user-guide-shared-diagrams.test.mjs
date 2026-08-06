import assert from "node:assert/strict";
import { lstat, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const manifestPath = path.join(root, "guides/assets/diagram-manifest.json");
const expectedSharedIds = [
  "app-cli-install-flow",
  "canonical-artifact-lifecycle",
  "document-export-flow",
  "image-asset-lifecycle",
  "image-generation-mode-routing",
  "plugin-selection-flow",
];

function assertContainedRelativePath(value, field) {
  assert.equal(typeof value, "string", field + " must be a string");
  assert.ok(value.length > 0, field + " must be nonempty");
  assert.ok(!path.isAbsolute(value) && !path.win32.isAbsolute(value), field + " must not be absolute");
  const resolved = path.resolve(path.dirname(manifestPath), value);
  const relative = path.relative(root, resolved);
  assert.ok(relative && !relative.startsWith("..") && !path.isAbsolute(relative), field + " must stay inside the repository");
  return resolved;
}

async function assertRegularFile(value, field) {
  const resolved = assertContainedRelativePath(value, field);
  assert.ok((await lstat(resolved)).isFile(), field + " must resolve to a regular file");
  return resolved;
}

test("shared diagram manifest declares six verified diagrams", async () => {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  assert.equal(typeof manifest.version, "number");
  assert.equal(manifest.skillsteadVersion, "0.8.3");
  assert.ok(Array.isArray(manifest.diagrams));
  const shared = manifest.diagrams.filter(({ scope }) => scope === "shared");
  for (const id of expectedSharedIds) assert.equal(shared.filter((diagram) => diagram.id === id).length, 1, id);
  for (const diagram of shared) {
    for (const field of ["id", "scope", "svg", "png", "alt"]) {
      assert.equal(typeof diagram[field], "string", diagram.id + "." + field);
      assert.ok(diagram[field], diagram.id + "." + field + " must be nonempty");
    }
    for (const field of ["sources", "usedBy"]) {
      assert.ok(Array.isArray(diagram[field]) && diagram[field].length > 0, diagram.id + "." + field);
      for (const value of diagram[field]) assertContainedRelativePath(value, diagram.id + "." + field);
    }
    const svgPath = await assertRegularFile(diagram.svg, diagram.id + ".svg");
    await assertRegularFile(diagram.png, diagram.id + ".png");
    const svg = await readFile(svgPath, "utf8");
    assert.match(svg, /^\s*<svg\b[^>]*>\s*<title\b[^>]*>\s*[^<\s][\s\S]*?<\/title>\s*<desc\b[^>]*>\s*[^<\s][\s\S]*?<\/desc>/u, diagram.id + " requires direct-child title and desc");
  }
});

test("document export puts all shared preparation states on one rail", async () => {
  const svg = await readFile(path.join(root, "guides/assets/shared/document-export-flow.svg"), "utf8");
  assert.match(svg, /aria-label="읽기 순서 2: 공통 준비 상태"/u);
  for (const status of ["not-requested", "blocked", "pending", "unavailable"]) {
    assert.match(svg, new RegExp(">" + status + "<", "u"));
  }
});
