#!/usr/bin/env node

// The Archify diagram catalog must carry a decision for every Markdown document in the scanned corpus,
// and each entry pins the digest of the document it decided against. Two slices of that corpus are not
// decisions anybody makes: the vendored upstream documents a product package mirrors, and the documents
// this repository generates from the vendor locks. Both move on every upstream bump, and transcribing
// their digests by hand is what used to make a bump a day of work. This writes those entries from the
// packages and the locks; everything else in the catalog stays hand-reviewed, because everything else
// records a judgement about our own writing.

import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

import { vendorDestinationRoots } from "./lib/vendor-components.mjs";
import { vendorReferenceFiles } from "./sync-vendor-references.mjs";

export const repoRoot = fileURLToPath(new URL("..", import.meta.url));

const CATALOG = "guides/archify-diagrams/catalog.json";
const PRODUCTS = Object.freeze([
  Object.freeze({ product: "career", packageName: "game-design-career" }),
  Object.freeze({ product: "studio", packageName: "game-design-studio" }),
]);

function catalogError(code, target) {
  const error = new Error(`${code}: ${target}`);
  error.code = code;
  error.path = target;
  return error;
}

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const entryId = (sourceDocument) => `excluded-${sha256(sourceDocument).slice(0, 12)}`;

// The catalog matches a section by heading text, so the section a generated entry names has to be a
// heading that is really in the file. The first one is the document's own title in every case here.
function firstHeading(markdown, sourceDocument) {
  for (const line of markdown.split(/\r?\n/u)) {
    const match = /^(?: {0,3})(?:#{1,6})\s+(.+?)(?:\s+#+)?\s*$/u.exec(line);
    if (match) return match[1].trim();
  }
  throw catalogError("VENDOR_CATALOG_DOCUMENT_HAS_NO_HEADING", sourceDocument);
}

async function markdownUnder(root, relativeRoot) {
  const found = [];
  async function walk(relative) {
    let entries;
    try {
      entries = await readdir(path.join(root, relative), { withFileTypes: true });
    } catch (error) {
      if (error.code === "ENOENT") return;
      throw error;
    }
    for (const entry of entries) {
      const next = `${relative}/${entry.name}`;
      if (entry.isDirectory()) await walk(next);
      else if (entry.isFile() && entry.name.endsWith(".md")) found.push(next);
    }
  }
  await walk(relativeRoot);
  return found.sort();
}

function withinScanRoots(scanRoots, document) {
  return scanRoots.some((scanRoot) => document === scanRoot || document.startsWith(`${scanRoot}/`));
}

// Two kinds of document belong to this tool. Mirrored vendored documents appear and disappear with the
// upstream release, so their entries are created and removed here. Generated documents always exist, so
// only their digest is refreshed — deleting one would be a defect, not a bump.
export async function generatedCatalogDocuments({ root = repoRoot, scanRoots } = {}) {
  const mirrored = new Set();
  const refreshed = new Set();
  for (const { product, packageName } of PRODUCTS) {
    for (const destinationRoot of vendorDestinationRoots({ repoRoot: root, productName: packageName })) {
      for (const document of await markdownUnder(root, `plugins/${packageName}/${destinationRoot}`)) {
        mirrored.add(document);
      }
    }
    void product;
  }
  for (const file of await vendorReferenceFiles({ root })) {
    if (!file.endsWith(".md")) continue;
    refreshed.add(file);
    const match = /^products\/(game-design-(?:studio|career))\/plugin\/(.+)$/u.exec(file);
    if (match) refreshed.add(`plugins/${match[1]}/${match[2]}`);
  }
  // The catalog only decides about the corpus it scans. A generated document outside those roots — the
  // shared contract README, say — has no entry and must not gain one here.
  for (const document of [...refreshed]) if (!withinScanRoots(scanRoots, document)) refreshed.delete(document);
  return { mirrored, refreshed };
}

function productOf(sourceDocument) {
  for (const { product, packageName } of PRODUCTS) {
    if (sourceDocument.startsWith(`plugins/${packageName}/`) || sourceDocument.startsWith(`products/${packageName}/`)) {
      return { product, packageName };
    }
  }
  return null;
}

function mirrorEntry({ sourceDocument, sourceSection, sourceDigest }) {
  const owner = productOf(sourceDocument);
  if (owner === null) throw catalogError("VENDOR_CATALOG_DOCUMENT_HAS_NO_PRODUCT", sourceDocument);
  return {
    id: entryId(sourceDocument),
    product: owner.product,
    source_document: sourceDocument,
    source_section: sourceSection,
    source_digest: sourceDigest,
    decision: "excluded",
    exclusion_code: "excluded-package-mirror",
    decision_reason: `이 문서는 products/${owner.packageName}의 배포 mirror이므로 패키지 외부 링크를 만들지 않는다.`,
    diagnostics: [],
    spec: null,
    html: null,
    receipt: null,
    delivery_status: "not-applicable",
    visual_review: "not-applicable",
  };
}

export async function syncVendorCatalogEntries({ root = repoRoot, check = false } = {}) {
  const catalogPath = path.join(root, CATALOG);
  const original = await readFile(catalogPath, "utf8");
  const catalog = JSON.parse(original);
  if (!Array.isArray(catalog.entries)) throw catalogError("VENDOR_CATALOG_ENTRIES_INVALID", CATALOG);
  const scanRoots = catalog.scan_roots;
  if (!Array.isArray(scanRoots) || scanRoots.some((value) => typeof value !== "string")) {
    throw catalogError("VENDOR_CATALOG_SCAN_ROOTS_INVALID", CATALOG);
  }
  const { mirrored, refreshed } = await generatedCatalogDocuments({ root, scanRoots });

  const byDocument = new Map(catalog.entries.map((entry) => [entry.source_document, entry]));
  const added = [];
  const updated = [];
  const removed = [];

  for (const sourceDocument of [...mirrored, ...refreshed].sort()) {
    const bytes = await readFile(path.join(root, sourceDocument));
    const digest = sha256(bytes);
    const existing = byDocument.get(sourceDocument);
    if (existing === undefined) {
      if (!mirrored.has(sourceDocument)) throw catalogError("VENDOR_CATALOG_GENERATED_DOCUMENT_UNCATALOGUED", sourceDocument);
      added.push(mirrorEntry({
        sourceDocument,
        sourceSection: firstHeading(bytes.toString("utf8"), sourceDocument),
        sourceDigest: digest,
      }));
      continue;
    }
    if (existing.source_digest === digest) continue;
    // A vendored document can be retitled by its upstream, which moves the heading the entry names. Our
    // own generated documents keep their title, so a section that no longer exists there is a real
    // defect and the catalog validator reports it rather than this tool papering over it.
    const section = mirrored.has(sourceDocument)
      ? firstHeading(bytes.toString("utf8"), sourceDocument)
      : existing.source_section;
    updated.push({ ...existing, source_section: section, source_digest: digest });
  }

  for (const entry of catalog.entries) {
    const document = entry.source_document;
    if (typeof document !== "string" || mirrored.has(document)) continue;
    const isVendorMirrorPath = PRODUCTS.some(({ packageName }) =>
      vendorDestinationRoots({ repoRoot: root, productName: packageName })
        .some((destinationRoot) => document.startsWith(`plugins/${packageName}/${destinationRoot}/`)));
    if (isVendorMirrorPath) removed.push(entry);
  }

  if (added.length === 0 && updated.length === 0 && removed.length === 0) {
    return { status: "current", added: [], updated: [], removed: [] };
  }
  if (check) {
    return {
      status: "drifted",
      added: added.map(({ source_document: document }) => document),
      updated: updated.map(({ source_document: document }) => document),
      removed: removed.map(({ source_document: document }) => document),
    };
  }

  const removedIds = new Set(removed.map(({ id }) => id));
  const updatedByDocument = new Map(updated.map((entry) => [entry.source_document, entry]));
  const entries = catalog.entries
    .filter((entry) => !removedIds.has(entry.id))
    .map((entry) => updatedByDocument.get(entry.source_document) ?? entry);
  entries.push(...added);
  await writeFile(catalogPath, `${JSON.stringify({ ...catalog, entries }, null, 2)}\n`);
  return {
    status: "written",
    added: added.map(({ source_document: document }) => document),
    updated: updated.map(({ source_document: document }) => document),
    removed: removed.map(({ source_document: document }) => document),
  };
}

export function parseVendorCatalogArgs(args) {
  if (args.length === 0) return { check: false };
  if (args.length === 1 && args[0] === "--check") return { check: true };
  throw new Error("Usage: node tooling/sync-vendor-catalog-entries.mjs [--check]");
}

async function main() {
  const { check } = parseVendorCatalogArgs(process.argv.slice(2));
  const result = await syncVendorCatalogEntries({ check });
  process.stdout.write(`${JSON.stringify({
    status: result.status,
    added: result.added.length,
    updated: result.updated.length,
    removed: result.removed.length,
  })}\n`);
  if (result.status === "drifted") {
    for (const [label, documents] of [["add", result.added], ["refresh", result.updated], ["remove", result.removed]]) {
      for (const document of documents) process.stderr.write(`VENDOR_CATALOG_DRIFT ${label} ${document}\n`);
    }
    process.stderr.write("Run `node tooling/sync-vendor-catalog-entries.mjs` to write them from the packages and the vendor locks.\n");
    process.exitCode = 1;
  }
}

const entry = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (entry && pathToFileURL(entry).href === import.meta.url) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
