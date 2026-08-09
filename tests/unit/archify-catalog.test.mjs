import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  discoverArchifySourceDocuments,
  hashArchifySource,
  loadArchifyCatalog,
  publishableArchifyEntries,
  validateArchifyCatalog,
} from "../../tooling/lib/archify-catalog.mjs";

const SCAN_ROOTS = ["README.md", "guides"];
const SCAN_EXCLUDES = ["guides/assets/archify", ".git", ".worktrees", ".tmp", ".build"];
const SOURCE_TEXT = "# Document\n\n## Exact heading\n\nSource body.\n";

function digest(value) {
  return createHash("sha256").update(value).digest("hex");
}

function selectedEntry({
  id = "stable-id",
  product = "studio",
  sourceDocument = "README.md",
  sourceSection = "Exact heading",
  sourceDigest = digest(SOURCE_TEXT),
  priority = "primary",
  secondaryReason = null,
  deliveryStatus = "planned",
  visualReview = "pending",
  reviewer = null,
  diagnostics = [],
} = {}) {
  return {
    id,
    product,
    source_document: sourceDocument,
    source_section: sourceSection,
    source_digest: sourceDigest,
    question: "이 도식이 답하는 한 문장 질문",
    decision: "selected",
    decision_reason: "텍스트보다 관계를 더 명확하게 보여 주는 근거",
    diagram_type: "workflow",
    diagram_type_reason: "역할별 단계와 승인 분기가 핵심이기 때문",
    priority,
    secondary_reason: secondaryReason,
    visual_system: product,
    composition_rationale: "문서 근거에 맞춘 주 경로와 분기 설명",
    shared_process_with: null,
    shared_process_reason: null,
    diagnostics,
    spec: `guides/archify-diagrams/specs/${product}/${id}.json`,
    html: `guides/assets/archify/${product}/${id}.html`,
    receipt: `guides/assets/archify/${product}/${id}.receipt.json`,
    delivery_status: deliveryStatus,
    visual_review: visualReview,
    reviewer,
  };
}

function excludedEntry(sourceDocument = "README.md") {
  return {
    id: `excluded-${path.basename(sourceDocument, ".md")}`,
    product: "studio",
    source_document: sourceDocument,
    source_section: "Exact heading",
    source_digest: digest(SOURCE_TEXT),
    decision: "excluded",
    exclusion_code: "non-structural-content",
    exclusion_reason: "구조 도식보다 문서 본문이 더 명확하다",
    diagnostics: [],
    spec: null,
    html: null,
    receipt: null,
    delivery_status: "not-applicable",
    visual_review: "not-applicable",
  };
}

async function writeRelative(root, relativePath, content) {
  const filename = path.join(root, ...relativePath.split("/"));
  await mkdir(path.dirname(filename), { recursive: true });
  await writeFile(filename, content);
  return filename;
}

async function catalogFixture(t, { documents = ["README.md"], entries = [excludedEntry()] } = {}) {
  const repoRoot = await mkdtemp(path.join(os.tmpdir(), "archify-catalog-"));
  t.after(() => rm(repoRoot, { recursive: true, force: true }));
  for (const document of documents) await writeRelative(repoRoot, document, SOURCE_TEXT);
  await writeRelative(repoRoot, "guides/archify-diagrams/catalog.json", JSON.stringify({
    schema_version: 1,
    scan_roots: SCAN_ROOTS,
    scan_excludes: SCAN_EXCLUDES,
    entries,
  }));
  return repoRoot;
}

async function unknownFieldFixture(t) {
  const root = await catalogFixture(t);
  const catalogPath = path.join(root, "guides/archify-diagrams/catalog.json");
  const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
  catalog.entries[0].injected = true;
  await writeFile(catalogPath, JSON.stringify(catalog));
  return root;
}

async function symlinkSourceFixture(t) {
  const root = await catalogFixture(t, { documents: [] });
  await writeRelative(root, "outside.md", SOURCE_TEXT);
  await symlink(path.join(root, "outside.md"), path.join(root, "README.md"));
  return root;
}

async function traversalFixture(t) {
  const root = await catalogFixture(t);
  const catalogPath = path.join(root, "guides/archify-diagrams/catalog.json");
  const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
  catalog.entries[0].source_document = "../outside.md";
  await writeFile(catalogPath, JSON.stringify(catalog));
  return root;
}

async function publishedWithoutQaFixture(t) {
  return catalogFixture(t, {
    entries: [selectedEntry({ deliveryStatus: "published" })],
  });
}

async function nfcDuplicateFixture(t) {
  return catalogFixture(t, {
    entries: [
      selectedEntry({ id: "café", priority: "primary" }),
      selectedEntry({ id: "cafe\u0301", priority: "secondary", secondaryReason: "보조 관계" }),
    ],
  });
}

async function duplicateDocumentFixture(t) {
  return catalogFixture(t, {
    entries: [
      selectedEntry({ id: "one", priority: "primary" }),
      selectedEntry({ id: "two", priority: "secondary", secondaryReason: "보조 관계" }),
    ],
  });
}

async function twoPrimaryFixture(t) {
  return catalogFixture(t, {
    entries: [
      selectedEntry({ id: "one", sourceSection: "Document", priority: "primary" }),
      selectedEntry({ id: "two", priority: "primary" }),
    ],
  });
}

async function twoSecondaryFixture(t) {
  return catalogFixture(t, {
    entries: [
      selectedEntry({ id: "one", sourceSection: "Document", priority: "secondary", secondaryReason: "보조 관계 1" }),
      selectedEntry({ id: "two", priority: "secondary", secondaryReason: "보조 관계 2" }),
    ],
  });
}

async function secondaryWithoutReasonFixture(t) {
  return catalogFixture(t, {
    entries: [selectedEntry({ priority: "secondary" })],
  });
}

async function staleDigestFixture(t) {
  return catalogFixture(t, {
    entries: [selectedEntry({ sourceDigest: "0".repeat(64) })],
  });
}

async function missingHeadingFixture(t) {
  return catalogFixture(t, {
    entries: [selectedEntry({ sourceSection: "없는 제목" })],
  });
}

async function blockedPublishableFixture(t) {
  return catalogFixture(t, {
    entries: [selectedEntry({
      deliveryStatus: "passed",
      visualReview: "passed",
      reviewer: "reviewer",
      diagnostics: [{
        code: "render-overflow",
        subject: "stable-id",
        evidence: "overflow: 12px",
        attempted_fix: "label wrap",
        round: 2,
        remaining_error: "overflow: 2px",
      }],
    })],
  });
}

test("catalog requires one analysis record for every scanned Markdown", async (t) => {
  const repoRoot = await catalogFixture(t, {
    documents: ["README.md", "guides/a.md"],
    entries: [excludedEntry("README.md")],
  });
  await assert.rejects(
    () => loadArchifyCatalog({ repoRoot }),
    /uncovered source document: guides\/a\.md/u,
  );
});

test("catalog rejects unknown fields, symlinks, unsafe paths, and illegal states", async (t) => {
  const [unknownField, symlinkSource, traversal, publishedWithoutQa] = await Promise.all([
    unknownFieldFixture(t),
    symlinkSourceFixture(t),
    traversalFixture(t),
    publishedWithoutQaFixture(t),
  ]);
  await assert.rejects(() => loadArchifyCatalog({ repoRoot: unknownField }), /unknown field/u);
  await assert.rejects(() => loadArchifyCatalog({ repoRoot: symlinkSource }), /symlink/u);
  await assert.rejects(() => loadArchifyCatalog({ repoRoot: traversal }), /contained/u);
  await assert.rejects(() => loadArchifyCatalog({ repoRoot: publishedWithoutQa }), /published.*visual review/u);
});

for (const [name, build, pattern] of [
  ["NFC duplicate ID", nfcDuplicateFixture, /duplicate.*id/u],
  ["duplicate document record", duplicateDocumentFixture, /duplicate.*source document/u],
  ["two primary entries", twoPrimaryFixture, /at most one primary/u],
  ["two secondary entries", twoSecondaryFixture, /at most one secondary/u],
  ["missing secondary rationale", secondaryWithoutReasonFixture, /secondary_reason/u],
  ["stale source digest", staleDigestFixture, /stale-source/u],
  ["missing heading", missingHeadingFixture, /source_section/u],
  ["blocked publishable entry", blockedPublishableFixture, /blocked.*publish/u],
]) {
  test(`catalog rejects ${name}`, async (t) => {
    const repoRoot = await build(t);
    await assert.rejects(() => loadArchifyCatalog({ repoRoot }), pattern);
  });
}

test("safe discovery and hashing return normalized repository-relative Markdown paths", async (t) => {
  const repoRoot = await catalogFixture(t, { documents: ["README.md", "guides/café.md"] });
  assert.deepEqual(await discoverArchifySourceDocuments({ repoRoot, scanRoots: SCAN_ROOTS, scanExcludes: SCAN_EXCLUDES }), [
    "README.md", "guides/café.md",
  ]);
  assert.equal(await hashArchifySource(path.join(repoRoot, "README.md")), digest(SOURCE_TEXT));
});

test("validation projects only reviewed passed and published selected entries", async (t) => {
  const repoRoot = await catalogFixture(t, { entries: [excludedEntry()] });
  const loaded = await loadArchifyCatalog({ repoRoot });
  assert.deepEqual((await validateArchifyCatalog(loaded)).errors, []);
  assert.deepEqual(publishableArchifyEntries({ entries: [
    { decision: "selected", delivery_status: "passed", visual_review: "passed", id: "passed" },
    { decision: "selected", delivery_status: "published", visual_review: "passed", id: "published" },
    { decision: "selected", delivery_status: "blocked-visual", visual_review: "blocked", id: "blocked" },
  ] }).map(({ id }) => id), ["passed", "published"]);
});

test("loader resolves an explicit fixture catalog path from the repository root", async (t) => {
  const repoRoot = await catalogFixture(t, { entries: [excludedEntry()] });
  const catalog = await loadArchifyCatalog({
    repoRoot,
    catalogPath: "guides/archify-diagrams/catalog.json",
  });
  assert.equal(catalog.entries[0].id, "excluded-README");
});
