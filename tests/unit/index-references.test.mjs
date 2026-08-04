import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  buildReferenceIndex,
  checkReferenceIndex,
  rejectDuplicateNormalizedPaths,
  serializeReferenceIndex,
} from "../../tooling/index-references.mjs";

async function createFixture(t) {
  const repoRoot = await mkdtemp(path.join(tmpdir(), "reference-index-test-"));
  t.after(() => rm(repoRoot, { recursive: true, force: true }));
  return repoRoot;
}

async function writeSource(repoRoot, relativePath, contents) {
  const filePath = path.join(repoRoot, ...relativePath.split("/"));
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, contents);
}

test("index generation normalizes paths to NFC and derives stable metadata", async (t) => {
  const repoRoot = await createFixture(t);
  await writeSource(
    repoRoot,
    "docs/03. 게임 시스템 기획/cafe\u0301.md",
    "# Café rules\n\nalpha beta\n",
  );

  const index = await buildReferenceIndex({ repoRoot });

  assert.deepEqual(index, {
    documents: [{
      id: "systems-c77e19598d34",
      sourcePath: "docs/03. 게임 시스템 기획/café.md",
      title: "café",
      category: "systems",
      sha256: "8ce28f870117cec136f39db7d124f6056aeadd39827f8ef87ca0ccb321ea86e4",
      wordCount: 5,
      claimTypes: ["evergreen", "contextual"],
      derivedCore: [],
    }],
  });
  assert.equal(serializeReferenceIndex(index).endsWith("\n"), true);
});

test("new source groups without an explicit category mapping are rejected", async (t) => {
  const repoRoot = await createFixture(t);
  await writeSource(repoRoot, "docs/unmapped/new.md", "# New source\n");

  await assert.rejects(() => buildReferenceIndex({ repoRoot }), /explicit category mapping.*docs\/unmapped\/new\.md/i);
});

test("duplicate normalized paths and duplicate titles are rejected", async (t) => {
  await t.test("normalized path", async (t) => {
    assert.throws(
      () => rejectDuplicateNormalizedPaths([
        "docs/03. 게임 시스템 기획/café.md",
        "docs/03. 게임 시스템 기획/cafe\u0301.md",
      ]),
      /duplicate normalized path/i,
    );
  });

  await t.test("title", async (t) => {
    const repoRoot = await createFixture(t);
    await writeSource(repoRoot, "docs/03. 게임 시스템 기획/1. Same title.md", "# System heading\n");
    await writeSource(repoRoot, "docs/04. 게임 콘텐츠 기획/2. Same title.md", "# Content heading\n");
    await assert.rejects(() => buildReferenceIndex({ repoRoot }), /duplicate title.*Same title/i);
  });
});

test("check detects byte, added-file, and removed-file drift", async (t) => {
  const repoRoot = await createFixture(t);
  const sourcePath = "docs/03. 게임 시스템 기획/rules.md";
  await writeSource(repoRoot, sourcePath, "# Rules\n\nalpha beta\n");
  const index = await buildReferenceIndex({ repoRoot });
  const indexPath = path.join(repoRoot, "shared/knowledge/reference-index.json");
  await mkdir(path.dirname(indexPath), { recursive: true });
  await writeFile(indexPath, serializeReferenceIndex(index));

  assert.deepEqual(await checkReferenceIndex({ repoRoot }), { indexed: 1, missing: 0, duplicatePaths: 0 });

  await writeSource(repoRoot, sourcePath, "# Rules\n\nchanged bytes\n");
  await assert.rejects(() => checkReferenceIndex({ repoRoot }), /reference index drift/i);

  await writeSource(repoRoot, sourcePath, "# Rules\n\nalpha beta\n");
  await writeSource(repoRoot, "docs/04. 게임 콘텐츠 기획/new.md", "# New content\n");
  await assert.rejects(() => checkReferenceIndex({ repoRoot }), /reference index drift/i);

  await rm(path.join(repoRoot, ...sourcePath.split("/")));
  await assert.rejects(() => checkReferenceIndex({ repoRoot }), /reference index drift/i);
  assert.equal(JSON.parse(await readFile(indexPath, "utf8")).documents.length, 1);
});
