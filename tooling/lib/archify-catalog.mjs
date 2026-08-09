import { createHash } from "node:crypto";
import { lstat, readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { comparePaths, joinWithin, normalizeRelativePath } from "./paths.mjs";

export const DELIVERY_STATES = Object.freeze([
  "not-applicable", "planned", "spec-authored", "auto-validated",
  "blocked-schema", "blocked-validation", "blocked-visual",
  "stale-source", "passed", "published",
]);

const CATALOG_PATH = "guides/archify-diagrams/catalog.json";
const APPROVED_SCAN_ROOTS = Object.freeze([
  "README.md", "guides", "products/game-design-studio", "products/game-design-career",
  "plugins/game-design-studio", "plugins/game-design-career",
]);
const APPROVED_SCAN_EXCLUDES = Object.freeze([
  "guides/assets/archify", "shared/vendor", ".git", ".worktrees", ".tmp", ".build",
]);
const CATALOG_KEYS = new Set(["schema_version", "scan_roots", "scan_excludes", "entries"]);
const SELECTED_KEYS = new Set([
  "id", "product", "source_document", "source_section", "source_digest", "question",
  "decision", "decision_reason", "diagram_type", "diagram_type_reason", "priority",
  "secondary_reason", "visual_system", "composition_rationale", "shared_process_with",
  "shared_process_reason", "diagnostics", "spec", "html", "receipt", "delivery_status",
  "visual_review", "reviewer",
]);
const EXCLUDED_KEYS = new Set([
  "id", "product", "source_document", "source_section", "source_digest", "decision",
  "exclusion_code", "decision_reason", "diagnostics", "spec", "html", "receipt",
  "delivery_status", "visual_review",
]);
const DIAGNOSTIC_KEYS = new Set(["code", "subject", "evidence", "attempted_fix", "round", "remaining_error"]);
const PRODUCTS = new Set(["studio", "career", "suite"]);
const DIAGRAM_TYPES = new Set(["architecture", "workflow", "sequence", "dataflow", "lifecycle"]);
const SPEC_REQUIRED_STATES = new Set(["spec-authored", "auto-validated", "stale-source", "passed", "published"]);
const STATE_CONTRACTS = Object.freeze({
  planned: { visualReview: "pending", reviewer: "null", diagnostics: "empty" },
  "spec-authored": { visualReview: "pending", reviewer: "null", diagnostics: "empty" },
  "auto-validated": { visualReview: "pending", reviewer: "null", diagnostics: "empty" },
  "blocked-schema": { visualReview: "not-applicable", reviewer: "null", diagnostics: "required" },
  "blocked-validation": { visualReview: "not-applicable", reviewer: "null", diagnostics: "required" },
  "blocked-visual": { visualReview: "failed", reviewer: "required", diagnostics: "required" },
  "stale-source": { visualReview: "stale-source", reviewer: "null", diagnostics: "empty" },
  passed: { visualReview: "passed", reviewer: "required", diagnostics: "empty" },
  published: { visualReview: "passed", reviewer: "required", diagnostics: "empty" },
});

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isNonemptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function normal(value) {
  return typeof value === "string" ? value.normalize("NFC") : value;
}

function assertExactKeys(value, keys, label, errors) {
  if (!isObject(value)) {
    errors.push(`${label} must be an object`);
    return false;
  }
  for (const key of Object.keys(value)) {
    if (!keys.has(key)) errors.push(`${label} has unknown field: ${key}`);
  }
  for (const key of keys) {
    if (!Object.hasOwn(value, key)) errors.push(`${label} is missing required field: ${key}`);
  }
  return true;
}

function safeRelative(value, label, errors) {
  try {
    return normalizeRelativePath(value, label);
  } catch {
    errors.push(`${label} must be repository-contained`);
    return undefined;
  }
}

function requireString(value, label, errors) {
  if (!isNonemptyString(value)) errors.push(`${label} must be a non-empty string`);
}

function expectedPaths(entry) {
  return {
    spec: `guides/archify-diagrams/specs/${entry.product}/${entry.id}.json`,
    html: `guides/assets/archify/${entry.product}/${entry.id}.html`,
    receipt: `guides/assets/archify/${entry.product}/${entry.id}.receipt.json`,
  };
}

function headingExists(markdown, heading) {
  const expected = normal(heading.trim());
  return markdown.split(/\r?\n/u).some((line) => {
    const match = /^(?: {0,3})(?:#{1,6})\s+(.+?)(?:\s+#+)?\s*$/u.exec(line);
    return match !== null && normal(match[1].trim()) === expected;
  });
}

function validateDiagnostic(diagnostic, label, errors) {
  if (!assertExactKeys(diagnostic, DIAGNOSTIC_KEYS, label, errors)) return;
  for (const key of ["code", "subject", "evidence", "attempted_fix", "remaining_error"]) {
    requireString(diagnostic[key], `${label}.${key}`, errors);
  }
  if (!Number.isInteger(diagnostic.round) || diagnostic.round < 1) {
    errors.push(`${label}.round must be a positive integer`);
  }
}

function validatePathList(value, label, errors) {
  if (!Array.isArray(value) || value.length === 0) {
    errors.push(`${label} must be a non-empty array`);
    return [];
  }
  const seen = new Set();
  const values = [];
  for (const item of value) {
    const normalized = safeRelative(item, label, errors);
    if (normalized === undefined) continue;
    if (seen.has(normalized)) errors.push(`${label} has duplicate normalized path: ${normalized}`);
    seen.add(normalized);
    values.push(normalized);
  }
  return values;
}

function hasExactOrder(values, expected) {
  return values.length === expected.length && values.every((value, index) => value === expected[index]);
}

function validateSelectedEntry(entry, index, errors, seenIds, seenRecords, priorities) {
  const label = `entry[${index}]`;
  if (!assertExactKeys(entry, SELECTED_KEYS, label, errors)) return;
  validateCommonEntry(entry, label, errors, seenIds, seenRecords);
  for (const key of ["question", "decision_reason", "diagram_type", "diagram_type_reason", "composition_rationale"]) {
    requireString(entry[key], `${label}.${key}`, errors);
  }
  if (entry.decision !== "selected") errors.push(`${label}.decision must be selected`);
  if (!PRODUCTS.has(entry.product)) errors.push(`${label}.product is unknown`);
  if (entry.visual_system !== entry.product) errors.push(`${label}.visual_system must match product`);
  if (!DIAGRAM_TYPES.has(entry.diagram_type)) errors.push(`${label}.diagram_type is invalid`);
  if (!['primary', 'secondary'].includes(entry.priority)) errors.push(`${label}.priority is invalid`);
  if (entry.priority === "secondary" && !isNonemptyString(entry.secondary_reason)) {
    errors.push(`${label}.secondary_reason is required for a secondary entry`);
  }
  if (entry.priority === "primary" && entry.secondary_reason !== null) {
    errors.push(`${label}.secondary_reason must be null for a primary entry`);
  }
  const source = normal(entry.source_document);
  if (["primary", "secondary"].includes(entry.priority)) {
    const key = `${source}\u0000${entry.priority}`;
    if (priorities.has(key)) errors.push(`${source} has at most one ${entry.priority} entry`);
    priorities.add(key);
  }
  const sharedTogether = entry.shared_process_with === null && entry.shared_process_reason === null;
  const sharedComplete = isNonemptyString(entry.shared_process_with) && isNonemptyString(entry.shared_process_reason);
  if (!sharedTogether && !sharedComplete) errors.push(`${label}.shared_process_with and shared_process_reason must both be null or non-empty`);
  if (!Array.isArray(entry.diagnostics)) {
    errors.push(`${label}.diagnostics must be an array`);
  } else {
    entry.diagnostics.forEach((diagnostic, diagnosticIndex) => validateDiagnostic(diagnostic, `${label}.diagnostics[${diagnosticIndex}]`, errors));
  }
  const paths = expectedPaths(entry);
  for (const field of ["spec", "html", "receipt"]) {
    const normalized = safeRelative(entry[field], `${label}.${field}`, errors);
    if (normalized !== undefined && normalized !== paths[field]) errors.push(`${label}.${field} must be ${paths[field]}`);
  }
  validateSelectedState(entry, label, errors);
}

function validateCommonEntry(entry, label, errors, seenIds, seenRecords) {
  requireString(entry.id, `${label}.id`, errors);
  if (isNonemptyString(entry.id)) {
    const id = normal(entry.id);
    if (seenIds.has(id)) errors.push(`duplicate catalog id: ${id}`);
    seenIds.add(id);
  }
  if (!PRODUCTS.has(entry.product)) errors.push(`${label}.product is unknown`);
  const source = safeRelative(entry.source_document, `${label}.source_document`, errors);
  requireString(entry.source_section, `${label}.source_section`, errors);
  if (source !== undefined && isNonemptyString(entry.source_section)) {
    const record = `${source}\u0000${normal(entry.source_section)}`;
    if (seenRecords.has(record)) errors.push(`duplicate source document record: ${source}`);
    seenRecords.add(record);
  }
  if (typeof entry.source_digest !== "string" || !/^[0-9a-f]{64}$/u.test(entry.source_digest)) {
    errors.push(`${label}.source_digest must be 64 lowercase hex characters`);
  }
}

function validateSelectedState(entry, label, errors) {
  const contract = STATE_CONTRACTS[entry.delivery_status];
  if (!DELIVERY_STATES.includes(entry.delivery_status) || contract === undefined) {
    errors.push(`${label}.delivery_status is invalid for a selected entry`);
    return;
  }
  if (entry.visual_review !== contract.visualReview) {
    errors.push(`${label}.${entry.delivery_status}.visual_review must be ${contract.visualReview}`);
  }
  if (contract.reviewer === "null" && entry.reviewer !== null) {
    errors.push(`${label}.${entry.delivery_status}.reviewer must be null`);
  }
  if (contract.reviewer === "required" && !isNonemptyString(entry.reviewer)) {
    errors.push(`${label}.${entry.delivery_status}.reviewer must be a non-empty string`);
  }
  if (contract.diagnostics === "empty" && entry.diagnostics.length !== 0) {
    errors.push(`${label}.${entry.delivery_status}.diagnostics must be empty`);
  }
  if (contract.diagnostics === "required" && entry.diagnostics.length === 0) {
    errors.push(`${label}.${entry.delivery_status}.diagnostics are required`);
  }
}

function validateExcludedEntry(entry, index, errors, seenIds, seenRecords) {
  const label = `entry[${index}]`;
  if (!assertExactKeys(entry, EXCLUDED_KEYS, label, errors)) return;
  validateCommonEntry(entry, label, errors, seenIds, seenRecords);
  if (entry.decision !== "excluded") errors.push(`${label}.decision must be excluded`);
  requireString(entry.exclusion_code, `${label}.exclusion_code`, errors);
  requireString(entry.decision_reason, `${label}.decision_reason`, errors);
  if (!Array.isArray(entry.diagnostics) || entry.diagnostics.length !== 0) errors.push(`${label}.excluded diagnostics must be empty`);
  for (const field of ["spec", "html", "receipt"]) {
    if (entry[field] !== null) errors.push(`${label}.${field} must be null for an excluded entry`);
  }
  if (entry.delivery_status !== "not-applicable" || entry.visual_review !== "not-applicable") {
    errors.push(`${label}.excluded entry must be not-applicable`);
  }
}

async function assertRegularContained(repoRoot, relativePath, label, { required = true } = {}) {
  let filename;
  try {
    filename = joinWithin(repoRoot, relativePath, label);
  } catch {
    throw new Error(`${label} must be repository-contained`);
  }
  const rootStats = await lstat(path.resolve(repoRoot));
  if (rootStats.isSymbolicLink()) throw new Error(`symlink is not allowed in repository root`);
  const parts = normalizeRelativePath(relativePath, label).split("/");
  let current = path.resolve(repoRoot);
  for (let index = 0; index < parts.length; index += 1) {
    current = path.join(current, parts[index]);
    const stats = await lstat(current).catch((error) => {
      if (error.code === "ENOENT" && !required) return undefined;
      if (error.code === "ENOENT") throw new Error(`missing ${label}: ${relativePath}`);
      throw error;
    });
    if (stats === undefined) return undefined;
    if (stats.isSymbolicLink()) throw new Error(`symlink is not allowed in ${label}: ${relativePath}`);
    if (index === parts.length - 1 && !stats.isFile()) throw new Error(`${label} must be a regular file: ${relativePath}`);
  }
  return filename;
}

function isExcluded(relativePath, excludes) {
  return excludes.some((excluded) => relativePath === excluded || relativePath.startsWith(`${excluded}/`));
}

async function walkMarkdown(repoRoot, relativePath, excludes, found) {
  if (isExcluded(relativePath, excludes)) return;
  const filename = await assertRegularOrDirectory(repoRoot, relativePath, "scan root");
  const stats = await lstat(filename);
  if (stats.isFile()) {
    if (relativePath.endsWith(".md")) found.add(normal(relativePath));
    return;
  }
  const children = await readdir(filename);
  for (const child of children.sort(comparePaths)) {
    const childPath = `${relativePath}/${child}`;
    if (isExcluded(childPath, excludes)) continue;
    await walkMarkdown(repoRoot, childPath, excludes, found);
  }
}

async function assertRegularOrDirectory(repoRoot, relativePath, label) {
  let filename;
  try {
    filename = joinWithin(repoRoot, relativePath, label);
  } catch {
    throw new Error(`${label} must be repository-contained`);
  }
  const rootStats = await lstat(path.resolve(repoRoot));
  if (rootStats.isSymbolicLink()) throw new Error("symlink is not allowed in repository root");
  const parts = normalizeRelativePath(relativePath, label).split("/");
  let current = path.resolve(repoRoot);
  for (const part of parts) {
    current = path.join(current, part);
    const stats = await lstat(current).catch((error) => {
      if (error.code === "ENOENT") throw new Error(`missing ${label}: ${relativePath}`);
      throw error;
    });
    if (stats.isSymbolicLink()) throw new Error(`symlink is not allowed in ${label}: ${relativePath}`);
  }
  const stats = await lstat(filename);
  if (!stats.isFile() && !stats.isDirectory()) throw new Error(`${label} must be a regular file or directory: ${relativePath}`);
  return filename;
}

export async function discoverArchifySourceDocuments({ repoRoot, scanRoots, scanExcludes }) {
  const errors = [];
  const roots = validatePathList(scanRoots, "scan_roots", errors);
  const excludes = validatePathList(scanExcludes, "scan_excludes", errors);
  if (errors.length > 0) throw new Error(errors.join("\n"));
  const found = new Set();
  for (const root of roots.sort(comparePaths)) await walkMarkdown(repoRoot, root, excludes, found);
  return [...found].sort(comparePaths);
}

export async function hashArchifySource(filename) {
  return createHash("sha256").update(await readFile(filename)).digest("hex");
}

export function publishableArchifyEntries(catalog) {
  return catalog.entries.filter((entry) =>
    entry.decision === "selected"
    && ["passed", "published"].includes(entry.delivery_status)
    && entry.visual_review === "passed");
}

export async function validateArchifyCatalog(catalog, { repoRoot } = {}) {
  const errors = [];
  const uncovered = [];
  if (!assertExactKeys(catalog, CATALOG_KEYS, "catalog", errors)) return { ok: false, errors, uncovered };
  if (catalog.schema_version !== 1) errors.push("catalog.schema_version must be 1");
  const scanRoots = validatePathList(catalog.scan_roots, "catalog.scan_roots", errors);
  const scanExcludes = validatePathList(catalog.scan_excludes, "catalog.scan_excludes", errors);
  if (!hasExactOrder(scanRoots, APPROVED_SCAN_ROOTS)) {
    errors.push("catalog.scan_roots must exactly match the approved ordered corpus");
  }
  if (!hasExactOrder(scanExcludes, APPROVED_SCAN_EXCLUDES)) {
    errors.push("catalog.scan_excludes must exactly match the approved ordered exclusions");
  }
  if (!Array.isArray(catalog.entries)) {
    errors.push("catalog.entries must be an array");
    return { ok: false, errors, uncovered };
  }
  const seenIds = new Set();
  const seenRecords = new Set();
  const priorities = new Set();
  for (const [index, entry] of catalog.entries.entries()) {
    if (!isObject(entry)) {
      errors.push(`entry[${index}] must be an object`);
      continue;
    }
    if (entry.decision === "selected") validateSelectedEntry(entry, index, errors, seenIds, seenRecords, priorities);
    else if (entry.decision === "excluded") validateExcludedEntry(entry, index, errors, seenIds, seenRecords);
    else errors.push(`entry[${index}].decision is invalid`);
  }
  if (repoRoot !== undefined && errors.length === 0) {
    let documents;
    try {
      documents = await discoverArchifySourceDocuments({ repoRoot, scanRoots, scanExcludes });
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
      return { ok: false, errors, uncovered };
    }
    const analyzed = new Set(catalog.entries.map((entry) => normal(entry.source_document)));
    for (const document of documents) {
      if (!analyzed.has(document)) uncovered.push(document);
    }
    for (const entry of catalog.entries) {
      const label = `entry ${entry.id}`;
      const source = safeRelative(entry.source_document, `${label}.source_document`, errors);
      if (source === undefined) continue;
      if (!documents.includes(source)) {
        errors.push(`${label}.source_document is not a scanned Markdown document: ${source}`);
        continue;
      }
      try {
        const sourceFile = await assertRegularContained(repoRoot, source, `${label}.source_document`);
        const [content, actualDigest] = await Promise.all([readFile(sourceFile, "utf8"), hashArchifySource(sourceFile)]);
        if (!headingExists(content, entry.source_section)) errors.push(`${label}.source_section does not exist in ${source}`);
        if (entry.source_digest !== actualDigest) errors.push(`stale-source: ${source}`);
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }
      if (entry.decision === "selected") {
        const specRequired = SPEC_REQUIRED_STATES.has(entry.delivery_status);
        try {
          await assertRegularContained(repoRoot, entry.spec, `${label}.spec`, { required: specRequired });
        } catch (error) {
          errors.push(error instanceof Error ? error.message : String(error));
        }
        if (entry.delivery_status === "published") {
          for (const field of ["html", "receipt"]) {
            try {
              await assertRegularContained(repoRoot, entry[field], `${label}.${field}`);
            } catch (error) {
              errors.push(error instanceof Error ? error.message : String(error));
            }
          }
        }
      }
    }
    for (const document of uncovered) errors.push(`uncovered source document: ${document}`);
  }
  return { ok: errors.length === 0, errors, uncovered };
}

function catalogRelativePath(repoRoot, catalogPath) {
  const absoluteRoot = path.resolve(repoRoot);
  const absoluteCatalog = catalogPath === undefined
    ? path.join(absoluteRoot, CATALOG_PATH)
    : path.resolve(absoluteRoot, catalogPath);
  if (absoluteCatalog === absoluteRoot || !absoluteCatalog.startsWith(`${absoluteRoot}${path.sep}`)) {
    throw new Error("catalog path must be repository-contained");
  }
  return path.relative(absoluteRoot, absoluteCatalog).split(path.sep).join("/").normalize("NFC");
}

export async function loadArchifyCatalog({ repoRoot, catalogPath } = {}) {
  if (!isNonemptyString(repoRoot)) throw new Error("repoRoot must be a non-empty path");
  const relativeCatalog = catalogRelativePath(repoRoot, catalogPath);
  const filename = await assertRegularContained(repoRoot, relativeCatalog, "catalog");
  let catalog;
  try {
    catalog = JSON.parse(await readFile(filename, "utf8"));
  } catch (error) {
    throw new Error(`invalid catalog JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  const result = await validateArchifyCatalog(catalog, { repoRoot });
  if (!result.ok) {
    const error = new Error(result.errors.join("\n"));
    error.uncovered = result.uncovered;
    throw error;
  }
  return catalog;
}
