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

const SCAN_ROOTS = [
  "README.md", "guides", "products/game-design-studio", "products/game-design-career",
  "plugins/game-design-studio", "plugins/game-design-career",
];
const SCAN_EXCLUDES = ["guides/assets/archify", "shared/vendor", ".git", ".worktrees", ".tmp", ".build"];
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
  diagramType = "workflow",
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
    diagram_type: diagramType,
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
    decision_reason: "구조 도식보다 문서 본문이 더 명확하다",
    diagnostics: [],
    spec: null,
    html: null,
    receipt: null,
    delivery_status: "not-applicable",
    visual_review: "not-applicable",
  };
}

function sharedPackageMirrorEntry({
  sourceDocument = "plugins/game-design-studio/skills/archify/SKILL.md",
  originSource = {
    source_document: "shared/vendor/archify/archify/2.13.0/SKILL.md",
    build_mapping: "archify",
  },
} = {}) {
  return {
    ...excludedEntry(sourceDocument),
    exclusion_code: "excluded-package-mirror",
    origin_source: originSource,
  };
}

function blockedDiagnostic() {
  return [{
    code: "render-overflow",
    subject: "stable-id",
    evidence: "overflow: 12px",
    attempted_fix: "label wrap",
    round: 2,
    remaining_error: "overflow: 2px",
  }];
}

function catalogFor(entry) {
  return {
    schema_version: 1,
    scan_roots: SCAN_ROOTS,
    scan_excludes: SCAN_EXCLUDES,
    entries: [entry],
  };
}

async function writeRelative(root, relativePath, content) {
  const filename = path.join(root, ...relativePath.split("/"));
  await mkdir(path.dirname(filename), { recursive: true });
  await writeFile(filename, content);
  return filename;
}

async function catalogFixture(t, {
  documents = ["README.md"],
  entries = [excludedEntry()],
  scanRoots = SCAN_ROOTS,
  scanExcludes = SCAN_EXCLUDES,
} = {}) {
  const repoRoot = await mkdtemp(path.join(os.tmpdir(), "archify-catalog-"));
  t.after(() => rm(repoRoot, { recursive: true, force: true }));
  for (const document of documents) await writeRelative(repoRoot, document, SOURCE_TEXT);
  for (const directory of SCAN_ROOTS.filter((root) => root !== "README.md")) {
    await mkdir(path.join(repoRoot, ...directory.split("/")), { recursive: true });
  }
  await writeRelative(repoRoot, "guides/archify-diagrams/catalog.json", JSON.stringify({
    schema_version: 1,
    scan_roots: scanRoots,
    scan_excludes: scanExcludes,
    entries,
  }));
  return repoRoot;
}

async function sharedPackageMirrorFixture(t, {
  entry = sharedPackageMirrorEntry(),
  originContent = SOURCE_TEXT,
} = {}) {
  const repoRoot = await catalogFixture(t, {
    documents: ["README.md", entry.source_document],
    entries: [excludedEntry("README.md"), entry],
  });
  await writeRelative(repoRoot, entry.origin_source.source_document, originContent);
  await writeRelative(repoRoot, "products/game-design-studio/product.json", JSON.stringify({
    schemaVersion: 1,
    name: "game-design-studio",
    displayName: "Studio",
    description: "Fixture product",
    sharedModules: [entry.origin_source.build_mapping],
    sharedRuntime: true,
    sourceRoots: ["plugin"],
    sourceDocumentCategories: ["fixture"],
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
      diagnostics: blockedDiagnostic(),
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
  await assert.rejects(() => loadArchifyCatalog({ repoRoot: publishedWithoutQa }), /published.*visual_review/u);
});

for (const [name, build, pattern] of [
  ["NFC duplicate ID", nfcDuplicateFixture, /duplicate.*id/u],
  ["duplicate document record", duplicateDocumentFixture, /duplicate.*source document/u],
  ["two primary entries", twoPrimaryFixture, /at most one primary/u],
  ["two secondary entries", twoSecondaryFixture, /at most one secondary/u],
  ["missing secondary rationale", secondaryWithoutReasonFixture, /secondary_reason/u],
  ["stale source digest", staleDigestFixture, /stale-source/u],
  ["missing heading", missingHeadingFixture, /source_section/u],
  ["blocked publishable entry", blockedPublishableFixture, /passed.*diagnostics/u],
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
    { decision: "selected", delivery_status: "blocked-visual", visual_review: "failed", id: "blocked" },
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

test("catalog accepts Suite selected entries with Suite deterministic paths", async (t) => {
  const repoRoot = await catalogFixture(t, {
    entries: [selectedEntry({ id: "suite-map", product: "suite" })],
  });
  const catalog = await loadArchifyCatalog({ repoRoot });
  assert.deepEqual(catalog.entries[0], selectedEntry({ id: "suite-map", product: "suite" }));
});

test("catalog rejects duplicate structures from materialized selected specs", async (t) => {
  const first = selectedEntry({ id: "first", sourceDocument: "README.md" });
  const second = selectedEntry({ id: "second", sourceDocument: "guides/second.md" });
  const repoRoot = await catalogFixture(t, {
    documents: ["README.md", "guides/second.md"],
    entries: [first, second],
  });
  const workflowSpec = (ids, labels) => ({
    schema_version: 1,
    diagram_type: "workflow",
    meta: { title: "검토 흐름", quality_profile: "showcase" },
    lanes: [{ id: "author", label: "작성" }, { id: "reviewer", label: "검토" }],
    nodes: ids.map((id, index) => ({
      id,
      label: labels[index],
      type: index === 1 ? "security" : "backend",
      lane: index === 1 ? "reviewer" : "author",
      col: index,
    })),
    edges: [
      { from: ids[0], to: ids[1], variant: "default" },
      { from: ids[1], to: ids[2], variant: "default" },
    ],
    mainPath: ids,
  });
  await writeRelative(repoRoot, first.spec, JSON.stringify(workflowSpec(["a", "b", "c"], ["입력", "검토", "완료"])));
  await writeRelative(repoRoot, second.spec, JSON.stringify(workflowSpec(["x", "y", "z"], ["자료", "승인", "출력"])));

  await assert.rejects(() => loadArchifyCatalog({ repoRoot }), /duplicate structural signature/u);
});

test("catalog rejects a scan corpus reduced to exclude its only Markdown", async (t) => {
  const repoRoot = await catalogFixture(t, {
    entries: [],
    scanRoots: ["README.md"],
    scanExcludes: ["README.md"],
  });
  await assert.rejects(() => loadArchifyCatalog({ repoRoot }), /scan_roots must exactly match/u);
});

test("excluded entries retain the canonical decision_reason contract", async (t) => {
  const repoRoot = await catalogFixture(t, { entries: [excludedEntry()] });
  await assert.doesNotReject(() => loadArchifyCatalog({ repoRoot }));
});

test("shared package mirrors require an allowed, regular, byte-identical structured origin", async (t) => {
  const valid = await sharedPackageMirrorFixture(t);
  await assert.doesNotReject(() => loadArchifyCatalog({ repoRoot: valid }));

  const missingOrigin = await sharedPackageMirrorFixture(t);
  const missingCatalogPath = path.join(missingOrigin, "guides/archify-diagrams/catalog.json");
  const missingCatalog = JSON.parse(await readFile(missingCatalogPath, "utf8"));
  delete missingCatalog.entries[1].origin_source;
  await writeFile(missingCatalogPath, JSON.stringify(missingCatalog));
  await assert.rejects(() => loadArchifyCatalog({ repoRoot: missingOrigin }), /origin_source/u);

  const wrongMapping = await sharedPackageMirrorFixture(t, {
    entry: sharedPackageMirrorEntry({
      originSource: {
        source_document: "shared/vendor/archify/archify/2.13.0/SKILL.md",
        build_mapping: "im-not-ai",
      },
    }),
  });
  await assert.rejects(() => loadArchifyCatalog({ repoRoot: wrongMapping }), /build_mapping/u);

  const changedBytes = await sharedPackageMirrorFixture(t, { originContent: "different source bytes" });
  await assert.rejects(() => loadArchifyCatalog({ repoRoot: changedBytes }), /byte-identical/u);

  const symlinkedOrigin = await sharedPackageMirrorFixture(t);
  const origin = "shared/vendor/archify/archify/2.13.0/SKILL.md";
  const external = await writeRelative(symlinkedOrigin, "outside.md", SOURCE_TEXT);
  await rm(path.join(symlinkedOrigin, origin));
  await symlink(external, path.join(symlinkedOrigin, origin));
  await assert.rejects(() => loadArchifyCatalog({ repoRoot: symlinkedOrigin }), /symlink.*origin_source/u);
});

for (const [name, entry] of [
  ["blocked schema", selectedEntry({ deliveryStatus: "blocked-schema", visualReview: "not-applicable", diagnostics: blockedDiagnostic() })],
  ["blocked validation", selectedEntry({ deliveryStatus: "blocked-validation", visualReview: "not-applicable", diagnostics: blockedDiagnostic() })],
  ["blocked visual", selectedEntry({ deliveryStatus: "blocked-visual", visualReview: "failed", reviewer: "visual-reviewer", diagnostics: blockedDiagnostic() })],
  ["stale source", selectedEntry({ deliveryStatus: "stale-source", visualReview: "stale-source" })],
  ["passed", selectedEntry({ deliveryStatus: "passed", visualReview: "passed", reviewer: "visual-reviewer" })],
  ["published", selectedEntry({ deliveryStatus: "published", visualReview: "passed", reviewer: "visual-reviewer" })],
]) {
  test(`validator accepts the exact ${name} visual-review state`, async () => {
    assert.deepEqual((await validateArchifyCatalog(catalogFor(entry))).errors, []);
  });
}

for (const [name, entry, pattern] of [
  ["blocked schema pending", selectedEntry({ deliveryStatus: "blocked-schema", visualReview: "pending", diagnostics: blockedDiagnostic() }), /blocked-schema.*visual_review/u],
  ["blocked validation pending", selectedEntry({ deliveryStatus: "blocked-validation", visualReview: "pending", diagnostics: blockedDiagnostic() }), /blocked-validation.*visual_review/u],
  ["blocked visual pending", selectedEntry({ deliveryStatus: "blocked-visual", visualReview: "pending", diagnostics: blockedDiagnostic() }), /blocked-visual.*visual_review/u],
  ["stale source pending", selectedEntry({ deliveryStatus: "stale-source", visualReview: "pending" }), /stale-source.*visual_review/u],
]) {
  test(`validator rejects ${name} visual-review mutation`, async () => {
    assert.match((await validateArchifyCatalog(catalogFor(entry))).errors.join("\n"), pattern);
  });
}

test("catalog rejects diagram types outside the structural adapter vocabulary", async (t) => {
  const repoRoot = await catalogFixture(t, { entries: [selectedEntry({ diagramType: "pie" })] });
  await assert.rejects(() => loadArchifyCatalog({ repoRoot }), /diagram_type/u);
});

test("schema exposes the same fixed corpus, products, diagram types, and visual-review values", async () => {
  const schema = JSON.parse(await readFile(new URL("../../guides/archify-diagrams/catalog.schema.json", import.meta.url), "utf8"));
  assert.deepEqual(schema.properties.scan_roots.const, SCAN_ROOTS);
  assert.deepEqual(schema.properties.scan_excludes.const, SCAN_EXCLUDES);
  assert.deepEqual(schema.$defs.selectedEntry.properties.product.enum, ["studio", "career", "suite"]);
  assert.deepEqual(schema.$defs.selectedEntry.properties.visual_system.enum, ["studio", "career", "suite"]);
  assert.deepEqual(schema.$defs.selectedEntry.properties.diagram_type.enum, ["architecture", "workflow", "sequence", "dataflow", "lifecycle"]);
  assert.deepEqual(schema.$defs.selectedEntry.properties.visual_review.enum, ["pending", "passed", "failed", "stale-source", "not-applicable"]);
});
