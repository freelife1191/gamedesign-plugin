#!/usr/bin/env node

import { createHash } from "node:crypto";
import { lstat, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const DOCUMENT_KEYS = [
  "path",
  "sha256",
  "origin",
  "inclusionBasis",
  "pluginMitCoverage",
  "publicRedistributionStatus",
  "redistributableLicenseOrPermissionEvidence",
  "reviewedAt",
  "requiredAction",
];
const EVIDENCE_KEYS = ["type", "path", "sha256", "grantsPublicRedistribution", "reviewedAt"];
const SELECTED_CATEGORIES = new Set(["career", "fun-intent", "systems", "content", "feedback"]);
const LOCAL_MODES = new Set(["local", "private"]);
const PUBLIC_MODES = new Set(["public", "distributable"]);
const SHA256 = /^[a-f0-9]{64}$/u;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/u;
const NOT_CLEARED_ACTION = "obtain-and-record-explicit-redistributable-license-or-permission-evidence-before-public-distribution";
const CLEARED_ACTION = "retain-and-reverify-redistribution-evidence-before-public-distribution";

function assertExactKeys(value, keys, label) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) {
    throw new Error(`${label} must be a plain object`);
  }
  const actual = Object.keys(value);
  if (actual.length !== keys.length || actual.some((key, index) => key !== keys[index])) {
    throw new Error(`${label} must have exact keys in canonical order: ${keys.join(", ")}`);
  }
}

function hash(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function safeRelativePath(value, label) {
  if (typeof value !== "string" || value.length === 0 || value.includes("\0") || path.isAbsolute(value)) {
    throw new Error(`${label} must be a non-empty relative path`);
  }
  const normalized = value.replaceAll("\\", "/");
  if (normalized !== value || normalized.split("/").some((segment) => segment === "" || segment === "." || segment === "..")) {
    throw new Error(`${label} must be a normalized package-relative path`);
  }
  return normalized;
}

async function containedRegularFile(pluginRoot, relativePath, label) {
  const normalized = safeRelativePath(relativePath, label);
  const root = await realpath(pluginRoot);
  let cursor = root;
  for (const segment of normalized.split("/")) {
    cursor = path.join(cursor, segment);
    const stats = await lstat(cursor).catch((error) => {
      if (error.code === "ENOENT") throw new Error(`${label} does not exist: ${normalized}`);
      throw error;
    });
    if (stats.isSymbolicLink()) throw new Error(`${label} traverses a symlink: ${normalized}`);
  }
  const stats = await lstat(cursor);
  if (!stats.isFile()) throw new Error(`${label} is not a regular file: ${normalized}`);
  const canonical = await realpath(cursor);
  const relative = path.relative(root, canonical);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`${label} escapes the plugin root: ${normalized}`);
  }
  return canonical;
}

async function expectedDocuments(pluginRoot) {
  const indexPath = await containedRegularFile(
    pluginRoot,
    "references/shared/knowledge/reference-index.json",
    "reference index",
  );
  const index = JSON.parse(await readFile(indexPath, "utf8"));
  if (!index || !Array.isArray(index.documents)) throw new Error("reference index must contain a documents array");
  return index.documents
    .filter((document) => SELECTED_CATEGORIES.has(document?.category))
    .map((document) => ({
      path: `references/source/${safeRelativePath(document.sourcePath, "reference index sourcePath")}`,
      sha256: document.sha256,
    }))
    .sort((left, right) => left.path.localeCompare(right.path, "en"));
}

async function validateEvidence(pluginRoot, evidence, documentPath, index) {
  assertExactKeys(evidence, EVIDENCE_KEYS, `${documentPath} evidence ${index}`);
  if (!new Set(["license", "permission"]).has(evidence.type)) {
    throw new Error(`${documentPath} evidence ${index} type must be license or permission`);
  }
  if (!evidence.path.startsWith("references/source-document-rights-evidence/")) {
    throw new Error(`${documentPath} evidence ${index} must stay in references/source-document-rights-evidence`);
  }
  if (!SHA256.test(evidence.sha256)) throw new Error(`${documentPath} evidence ${index} must have a SHA-256 digest`);
  if (evidence.grantsPublicRedistribution !== true) {
    throw new Error(`${documentPath} evidence ${index} must explicitly grant public redistribution`);
  }
  if (!ISO_DATE.test(evidence.reviewedAt)) throw new Error(`${documentPath} evidence ${index} must have a review date`);
  const evidenceFile = await containedRegularFile(pluginRoot, evidence.path, `${documentPath} evidence ${index}`);
  if (hash(await readFile(evidenceFile)) !== evidence.sha256) {
    throw new Error(`${documentPath} evidence ${index} digest does not match packaged bytes`);
  }
}

export async function validateSourceDocumentRightsManifest({ pluginRoot, manifest }) {
  assertExactKeys(manifest, ["schemaVersion", "reviewedAt", "documents"], "rights manifest");
  if (manifest.schemaVersion !== 1) throw new Error("rights manifest schemaVersion must be 1");
  if (!ISO_DATE.test(manifest.reviewedAt)) throw new Error("rights manifest reviewedAt must be an ISO date");
  if (!Array.isArray(manifest.documents)) throw new Error("rights manifest documents must be an array");
  const expected = await expectedDocuments(pluginRoot);
  if (expected.length !== 49) throw new Error(`reference index must select exactly 49 source documents; found ${expected.length}`);
  if (manifest.documents.length !== expected.length) {
    throw new Error(`rights manifest must cover exactly ${expected.length} source documents; found ${manifest.documents.length}`);
  }

  const seen = new Set();
  let clearedDocumentCount = 0;
  for (const [index, document] of manifest.documents.entries()) {
    assertExactKeys(document, DOCUMENT_KEYS, `rights manifest document ${index}`);
    const expectedDocument = expected[index];
    if (document.path !== expectedDocument.path) {
      throw new Error(`rights manifest document ${index} path must be ${expectedDocument.path}`);
    }
    if (seen.has(document.path)) throw new Error(`duplicate rights manifest path: ${document.path}`);
    seen.add(document.path);
    if (!SHA256.test(document.sha256) || document.sha256 !== expectedDocument.sha256) {
      throw new Error(`${document.path} digest must match the reference index`);
    }
    const sourceFile = await containedRegularFile(pluginRoot, document.path, "source document");
    if (hash(await readFile(sourceFile)) !== document.sha256) {
      throw new Error(`${document.path} digest does not match packaged bytes`);
    }
    if (document.origin !== "user-provided-workspace") throw new Error(`${document.path} origin is not truthful`);
    if (document.inclusionBasis !== "user-explicitly-requested-local-plugin-construction-and-use") {
      throw new Error(`${document.path} inclusion basis is not truthful`);
    }
    if (document.pluginMitCoverage !== "excluded-not-sublicensed") {
      throw new Error(`${document.path} must be excluded from the plugin MIT license`);
    }
    if (!ISO_DATE.test(document.reviewedAt) || document.reviewedAt !== manifest.reviewedAt) {
      throw new Error(`${document.path} review date must match the manifest review date`);
    }
    if (!Array.isArray(document.redistributableLicenseOrPermissionEvidence)) {
      throw new Error(`${document.path} redistribution evidence must be an array`);
    }

    if (document.publicRedistributionStatus === "not-established") {
      if (document.redistributableLicenseOrPermissionEvidence.length !== 0) {
        throw new Error(`${document.path} cannot carry clearance evidence while status is not-established`);
      }
      if (document.requiredAction !== NOT_CLEARED_ACTION) throw new Error(`${document.path} required action is not fail-closed`);
    } else if (document.publicRedistributionStatus === "established") {
      if (document.redistributableLicenseOrPermissionEvidence.length === 0) {
        throw new Error(`${document.path} requires explicit redistribution evidence`);
      }
      if (document.requiredAction !== CLEARED_ACTION) throw new Error(`${document.path} required action must retain clearance evidence`);
      for (const [evidenceIndex, evidence] of document.redistributableLicenseOrPermissionEvidence.entries()) {
        await validateEvidence(pluginRoot, evidence, document.path, evidenceIndex);
      }
      clearedDocumentCount += 1;
    } else {
      throw new Error(`${document.path} public redistribution status is unsupported`);
    }
  }

  return { documentCount: expected.length, clearedDocumentCount };
}

export async function checkSourceDocumentRelease({ mode, pluginRoot }) {
  if (!LOCAL_MODES.has(mode) && !PUBLIC_MODES.has(mode)) {
    throw new Error("mode must be local, private, public, or distributable");
  }
  const manifestFile = await containedRegularFile(
    pluginRoot,
    "references/source-document-rights.json",
    "rights manifest",
  );
  const manifest = JSON.parse(await readFile(manifestFile, "utf8"));
  const validation = await validateSourceDocumentRightsManifest({ pluginRoot, manifest });
  if (PUBLIC_MODES.has(mode) && validation.clearedDocumentCount !== validation.documentCount) {
    const blocked = validation.documentCount - validation.clearedDocumentCount;
    throw new Error(`${blocked} source document(s) are not cleared for public redistribution`);
  }
  return { ok: true, mode, ...validation };
}

function parseArguments(argv) {
  let mode;
  let pluginRoot;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--mode" && index + 1 < argv.length) mode = argv[++index];
    else if (argument === "--plugin-root" && index + 1 < argv.length) pluginRoot = argv[++index];
    else throw new Error(`unknown or incomplete argument: ${argument}`);
  }
  return {
    mode,
    pluginRoot: pluginRoot ?? fileURLToPath(new URL("../../../", import.meta.url)),
  };
}

async function main() {
  try {
    const result = await checkSourceDocumentRelease(parseArguments(process.argv.slice(2)));
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}

const entryPath = process.argv[1] ? await realpath(process.argv[1]).catch(() => undefined) : undefined;
if (entryPath && pathToFileURL(entryPath).href === import.meta.url) await main();
