import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { buildProduct } from "../../../tooling/lib/build-product.mjs";
import {
  checkSourceDocumentRelease,
  validateSourceDocumentRightsManifest,
} from "../../../products/game-design-studio/plugin/skills/orchestrate-game-design-project/scripts/check-source-document-redistribution.mjs";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const pluginRoot = path.join(repoRoot, "products/game-design-studio/plugin");
const manifestPath = path.join(pluginRoot, "references/source-document-rights.json");
const referenceIndexPath = path.join(repoRoot, "shared/knowledge/reference-index.json");
const temporaryDirectories = [];
const selectedCategories = new Set(["career", "fun-intent", "systems", "content", "feedback"]);

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

test.afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

async function expectedDocuments() {
  const index = JSON.parse(await readFile(referenceIndexPath, "utf8"));
  return index.documents
    .filter((document) => selectedCategories.has(document.category))
    .map((document) => ({
      path: `references/source/${document.sourcePath}`,
      sha256: document.sha256,
      sourcePath: document.sourcePath,
    }))
    .sort((left, right) => left.path.localeCompare(right.path, "en"));
}

async function buildStudio() {
  const stagingRoot = await mkdtemp(path.join(os.tmpdir(), "studio-rights-build-"));
  temporaryDirectories.push(stagingRoot);
  return buildProduct({ repoRoot, productName: "game-design-studio", stagingRoot, sourceDateEpoch: 0 });
}

test("rights manifest exactly covers all 49 selected source documents and current bytes", async () => {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const expected = await expectedDocuments();
  assert.equal(expected.length, 49);
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.reviewedAt, "2026-08-05");
  assert.equal(manifest.documents.length, 49);
  assert.deepEqual(
    manifest.documents.map(({ path: documentPath, sha256: digest }) => ({ path: documentPath, sha256: digest })),
    expected.map(({ path: documentPath, sha256: digest }) => ({ path: documentPath, sha256: digest })),
  );
  for (const [index, document] of manifest.documents.entries()) {
    assert.deepEqual(Object.keys(document), [
      "path",
      "sha256",
      "origin",
      "inclusionBasis",
      "pluginMitCoverage",
      "publicRedistributionStatus",
      "redistributableLicenseOrPermissionEvidence",
      "reviewedAt",
      "requiredAction",
    ]);
    assert.equal(document.origin, "user-provided-workspace");
    assert.equal(document.inclusionBasis, "user-explicitly-requested-local-plugin-construction-and-use");
    assert.equal(document.pluginMitCoverage, "excluded-not-sublicensed");
    assert.equal(document.publicRedistributionStatus, "not-established");
    assert.deepEqual(document.redistributableLicenseOrPermissionEvidence, []);
    assert.equal(document.reviewedAt, "2026-08-05");
    assert.equal(document.requiredAction, "obtain-and-record-explicit-redistributable-license-or-permission-evidence-before-public-distribution");
    const sourceBytes = await readFile(path.join(repoRoot, expected[index].sourcePath));
    assert.equal(sha256(sourceBytes), document.sha256, document.path);
  }
});

test("manifest validator rejects omission, duplicate, unknown path, and hash drift", async () => {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const build = await buildStudio();
  await assert.doesNotReject(validateSourceDocumentRightsManifest({ pluginRoot: build.outputDir, manifest }));
  const mutations = [
    { label: "omission", mutate: (candidate) => candidate.documents.pop() },
    { label: "duplicate", mutate: (candidate) => candidate.documents.push(structuredClone(candidate.documents[0])) },
    { label: "unknown", mutate: (candidate) => { candidate.documents[0].path = "references/source/docs/unknown.md"; } },
    { label: "hash drift", mutate: (candidate) => { candidate.documents[0].sha256 = "0".repeat(64); } },
  ];
  for (const { label, mutate } of mutations) {
    const candidate = structuredClone(manifest);
    mutate(candidate);
    await assert.rejects(
      validateSourceDocumentRightsManifest({ pluginRoot: build.outputDir, manifest: candidate }),
      undefined,
      label,
    );
  }
});

test("local and private snapshots pass while public and distributable modes fail closed", async () => {
  const build = await buildStudio();
  for (const mode of ["local", "private"]) {
    const result = await checkSourceDocumentRelease({ mode, pluginRoot: build.outputDir });
    assert.equal(result.ok, true, mode);
    assert.equal(result.documentCount, 49);
  }
  for (const mode of ["public", "distributable"]) {
    await assert.rejects(
      checkSourceDocumentRelease({ mode, pluginRoot: build.outputDir }),
      /49 source document\(s\).*not cleared for public redistribution/iu,
      mode,
    );
  }
});

test("public mode requires explicit package-contained permission or license evidence for every document", async () => {
  const build = await buildStudio();
  const manifestFile = path.join(build.outputDir, "references/source-document-rights.json");
  const manifest = JSON.parse(await readFile(manifestFile, "utf8"));
  const evidenceRelative = "references/source-document-rights-evidence/test-permission.txt";
  const evidenceFile = path.join(build.outputDir, evidenceRelative);
  const evidenceBytes = Buffer.from("Test-only explicit permission evidence for all indexed source documents.\n");
  await mkdir(path.dirname(evidenceFile), { recursive: true });
  await writeFile(evidenceFile, evidenceBytes);
  for (const document of manifest.documents) {
    document.publicRedistributionStatus = "established";
    document.requiredAction = "retain-and-reverify-redistribution-evidence-before-public-distribution";
    document.redistributableLicenseOrPermissionEvidence = [{
      type: "permission",
      path: evidenceRelative,
      sha256: sha256(evidenceBytes),
      grantsPublicRedistribution: true,
      reviewedAt: "2026-08-05",
    }];
  }
  await writeFile(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
  const result = await checkSourceDocumentRelease({ mode: "public", pluginRoot: build.outputDir });
  assert.equal(result.ok, true);
  assert.equal(result.clearedDocumentCount, 49);
});

test("source and clean build carry identical rights manifest, guard, and truthful documentation links", async () => {
  const build = await buildStudio();
  const relativeFiles = [
    "references/source-document-rights.json",
    "skills/orchestrate-game-design-project/scripts/check-source-document-redistribution.mjs",
  ];
  for (const relativeFile of relativeFiles) {
    assert.deepEqual(
      await readFile(path.join(pluginRoot, relativeFile)),
      await readFile(path.join(build.outputDir, relativeFile)),
      relativeFile,
    );
  }
  const [readme, license, notices] = await Promise.all([
    readFile(path.join(pluginRoot, "README.md"), "utf8"),
    readFile(path.join(pluginRoot, "LICENSE"), "utf8"),
    readFile(path.join(pluginRoot, "THIRD_PARTY_NOTICES.md"), "utf8"),
  ]);
  for (const document of [readme, license, notices]) {
    assert.match(document, /source document|원문/iu);
    assert.match(document, /not sublicensed|재허가되지/iu);
    assert.match(document, /public redistribution|공개 재배포/iu);
  }
  assert.match(readme, /references\/source-document-rights\.json/u);
  assert.match(readme, /check-source-document-redistribution\.mjs/u);
  assert.match(readme, /local.*private/isu);
  assert.match(readme, /public.*distributable/isu);
});
