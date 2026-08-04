import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(new URL("../..", import.meta.url).pathname);

async function discoverSourcePaths() {
  const docsRoot = path.join(repoRoot, "docs");
  const entries = await readdir(docsRoot, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => path.relative(repoRoot, path.join(entry.parentPath, entry.name)).split(path.sep).join("/").normalize("NFC"))
    .filter((sourcePath) => !sourcePath.startsWith("docs/superpowers/"))
    .sort((left, right) => left.localeCompare(right, "en"));
}

test("the canonical reference index covers every one of the 49 source documents", async () => {
  const sourcePaths = await discoverSourcePaths();
  const index = JSON.parse(await readFile(path.join(repoRoot, "shared/knowledge/reference-index.json"), "utf8"));

  assert.equal(sourcePaths.length, 49);
  assert.deepEqual(Object.keys(index), ["documents"]);
  assert.equal(index.documents.length, 49);

  const indexedPaths = index.documents.map((document) => document.sourcePath);
  assert.equal(new Set(indexedPaths).size, 49);
  assert.deepEqual(indexedPaths.toSorted((left, right) => left.localeCompare(right, "en")), sourcePaths);
  assert.equal(new Set(index.documents.map((document) => document.id)).size, 49);
  assert.equal(new Set(index.documents.map((document) => document.title)).size, 49);

  for (const document of index.documents) {
    assert.deepEqual(Object.keys(document), [
      "id", "sourcePath", "title", "category", "sha256", "wordCount", "claimTypes", "derivedCore",
    ]);
    assert.equal(document.sourcePath, document.sourcePath.normalize("NFC"));
    assert.match(document.sourcePath, /^docs\//);
    assert.match(document.id, /^(career|fun-intent|systems|content|feedback)-[a-f0-9]{12}$/);
    assert.match(document.sha256, /^[a-f0-9]{64}$/);
    assert.equal(Number.isInteger(document.wordCount) && document.wordCount > 0, true);
    assert.equal(Array.isArray(document.claimTypes) && document.claimTypes.length > 0, true);
    assert.equal(Array.isArray(document.derivedCore), true);
  }
});
