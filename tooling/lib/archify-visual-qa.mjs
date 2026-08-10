import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import path from "node:path";

import { inspectCompletePng } from "../../shared/scripts/lib/complete-png-validation.mjs";
import { loadArchifyCatalog } from "./archify-catalog.mjs";
import { comparePaths, joinWithin, normalizeRelativePath } from "./paths.mjs";

const MANIFEST_PATH = "guides/archify-diagrams/visual-qa/manifest.json";
const QA_ROOT = "guides/archify-diagrams/visual-qa";
const REQUIRED_RENDER_KEYS = Object.freeze(["read", "light", "dark", "guided_views"]);
const RENDER_KEYS = Object.freeze(["path", "sha256", "width", "height"]);
const GUIDED_RENDER_KEYS = Object.freeze(["id", ...RENDER_KEYS]);
const ENTRY_KEYS = Object.freeze([
  "id", "specification_sha256", "artifact_sha256", "reviewer", "review_method", "correction_rounds", "verdict",
  "renders", "checks", "defects",
]);
const CHECK_KEYS = Object.freeze([
  "text_clipping", "glyph_distortion", "blur_or_tofu", "node_text_collision", "edge_node_collision",
  "edge_label_collision", "ambiguous_corridor", "branch_merge_retry_resume", "rail_legend_footer",
  "light_dark_contrast", "guided_view_usefulness", "within_product_diversity", "cross_product_distinction",
]);
const DEFECT_KEYS = Object.freeze(["view", "subject", "symptom", "correction_outcome", "round", "correction_evidence"]);

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function nonempty(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function assertExactKeys(value, keys, label) {
  if (!isObject(value)) throw new Error(`${label} must be an object`);
  const expected = new Set(keys);
  for (const key of Object.keys(value)) if (!expected.has(key)) throw new Error(`${label} has unknown field: ${key}`);
  for (const key of keys) if (!Object.hasOwn(value, key)) throw new Error(`${label} is missing required field: ${key}`);
}

function assertDigest(value, label) {
  if (typeof value !== "string" || !/^[0-9a-f]{64}$/u.test(value)) throw new Error(`${label} must be 64 lowercase hex characters`);
}

async function regularContained(root, relative, label) {
  const normalized = normalizeRelativePath(relative, label);
  const filename = joinWithin(root, normalized, label);
  const rootStats = await lstat(path.resolve(root));
  if (rootStats.isSymbolicLink()) throw new Error(`${label} has a symlinked repository root`);
  let current = path.resolve(root);
  for (const segment of normalized.split("/")) {
    current = path.join(current, segment);
    const stats = await lstat(current).catch((error) => {
      if (error?.code === "ENOENT") throw new Error(`missing ${label}: ${normalized}`);
      throw error;
    });
    if (stats.isSymbolicLink()) throw new Error(`${label} must not use a symlink: ${normalized}`);
  }
  const stats = await lstat(filename);
  if (!stats.isFile()) throw new Error(`${label} must be a regular file: ${normalized}`);
  return { normalized, filename };
}

function artifactPath(entry) {
  if (entry.delivery_status === "blocked-visual") {
    return `guides/archify-diagrams/visual-qa/failed-artifacts/${entry.product}/${entry.id}.html`;
  }
  return entry.delivery_status === "published"
    ? entry.html
    : `.tmp/curated-archify/current/${entry.product}/${entry.id}.html`;
}

function validateChecks(entry, label) {
  assertExactKeys(entry.checks, CHECK_KEYS, `${label}.checks`);
  const values = Object.values(entry.checks);
  const invalid = CHECK_KEYS.find((key) => !["passed", "failed", "not-applicable"].includes(entry.checks[key]));
  if (invalid !== undefined) {
    throw new Error(`${label}.${invalid} must use passed, failed, or not-applicable`);
  }
  if (entry.verdict === "passed" && values.some((value) => value !== "passed")) {
    const unchecked = CHECK_KEYS.find((key) => entry.checks[key] !== "passed");
    throw new Error(`${label}.${unchecked} must be passed`);
  }
  if (entry.verdict === "failed" && !values.includes("failed")) throw new Error(`${label}.failed verdict requires a failed check`);
}

function validateDefects(entry, label, views) {
  if (!Array.isArray(entry.defects)) throw new Error(`${label}.defects must be an array`);
  if (entry.verdict === "passed" && entry.defects.some((defect) => ["unresolved", "blocked"].includes(defect.correction_outcome))) throw new Error(`${label}.passed verdict cannot have unresolved defects`);
  if (entry.verdict === "failed" && entry.defects.length === 0) throw new Error(`${label}.failed verdict requires a defect record`);
  for (const [index, defect] of entry.defects.entries()) {
    assertExactKeys(defect, DEFECT_KEYS, `${label}.defects[${index}]`);
    for (const key of ["view", "subject", "symptom", "correction_outcome", "correction_evidence"]) if (!nonempty(defect[key])) throw new Error(`${label}.defects[${index}].${key} must be a non-empty string`);
    if (!Number.isInteger(defect.round) || defect.round < 1 || defect.round > 2) throw new Error(`${label}.defects[${index}].round must be an integer from 1 through 2`);
    if (!views.has(defect.view)) throw new Error(`${label}.defects[${index}].view must name an existing render`);
    if (!["resolved", "unresolved", "blocked"].includes(defect.correction_outcome)) throw new Error(`${label}.defects[${index}].correction_outcome is invalid`);
  }
  if (entry.correction_rounds === 0 && entry.defects.length > 0) throw new Error(`${label} max correction round must be 0 when there are no corrections`);
  if (entry.correction_rounds > 0 && entry.defects.length === 0) throw new Error(`${label} requires correction evidence for each nonzero correction round`);
  if (entry.defects.length > 0 && Math.max(...entry.defects.map((defect) => defect.round)) !== entry.correction_rounds) throw new Error(`${label} max correction round must match correction_rounds`);
  if (entry.verdict === "failed" && !entry.defects.some((defect) => ["unresolved", "blocked"].includes(defect.correction_outcome))) throw new Error(`${label}.failed verdict requires an unresolved or blocked defect`);
}

async function validateRender(root, render, label, usedPaths, { guided = false, renderSnapshots } = {}) {
  assertExactKeys(render, guided ? GUIDED_RENDER_KEYS : RENDER_KEYS, label);
  if (guided && (!/^view-[a-z0-9][a-z0-9-]*$/u.test(render.id))) throw new Error(`${label}.id must be a view-* identifier`);
  if (!Number.isInteger(render.width) || !Number.isInteger(render.height) || render.width < 1 || render.height < 1) {
    throw new Error(`${label} has invalid dimensions`);
  }
  assertDigest(render.sha256, `${label}.sha256`);
  const normalized = normalizeRelativePath(render.path, `${label}.path`);
  if (!normalized.startsWith("renders/") || !normalized.endsWith(".png")) throw new Error(`${label}.path must be a renders/*.png path`);
  if (usedPaths.has(normalized)) throw new Error(`duplicate render path: ${normalized}`);
  usedPaths.add(normalized);
  if (renderSnapshots && !renderSnapshots.has(normalized)) throw new Error(`missing pinned ${label}: ${normalized}`);
  const bytes = renderSnapshots ? renderSnapshots.get(normalized) : await (async () => {
    const { filename } = await regularContained(root, `${QA_ROOT}/${normalized}`, label);
    return readFile(filename);
  })();
  if (!Buffer.isBuffer(bytes)) throw new Error(`missing pinned ${label}: ${normalized}`);
  const inspection = inspectCompletePng(bytes);
  if (!inspection.ok) throw new Error(`${label} PNG validation failed: ${inspection.errors.join("; ")}`);
  if (inspection.width !== render.width || inspection.height !== render.height) throw new Error(`${label} dimensions do not match PNG`);
  if (sha256(bytes) !== render.sha256) throw new Error(`${label} render digest does not match bytes`);
}

async function validateRenders(root, entry, label, usedPaths, renderSnapshots) {
  for (const view of ["read", "light", "dark"]) {
    if (!Object.hasOwn(entry.renders, view)) throw new Error(`${label} is missing ${view} render`);
  }
  if (!Object.hasOwn(entry.renders, "guided_views")) throw new Error(`${label} is missing guided view render`);
  assertExactKeys(entry.renders, REQUIRED_RENDER_KEYS, `${label}.renders`);
  for (const view of ["read", "light", "dark"]) {
    await validateRender(root, entry.renders[view], `${label}.${view}`, usedPaths, { renderSnapshots });
  }
  if (!Array.isArray(entry.renders.guided_views) || entry.renders.guided_views.length === 0) {
    throw new Error(`${label} is missing guided view render`);
  }
  const views = new Set(["read", "light", "dark"]);
  for (const [index, render] of entry.renders.guided_views.entries()) {
    await validateRender(root, render, `${label}.guided_views[${index}]`, usedPaths, { guided: true, renderSnapshots });
    if (views.has(render.id)) throw new Error(`${label} has duplicate guided view id: ${render.id}`);
    views.add(render.id);
  }
  return views;
}

async function validateEntry(root, entry, catalogEntry, index, usedPaths, renderSnapshots) {
  const label = `visual QA entry[${index}]`;
  assertExactKeys(entry, ENTRY_KEYS, label);
  if (!nonempty(entry.id) || entry.id !== catalogEntry.id) throw new Error(`${label}.id must bind a catalog entry`);
  assertDigest(entry.specification_sha256, `${label}.specification_sha256`);
  assertDigest(entry.artifact_sha256, `${label}.artifact_sha256`);
  if (!nonempty(entry.reviewer)) throw new Error(`${label}.reviewer must be a non-empty string`);
  if (entry.review_method !== "headless-agent-browser + original-size image reader") throw new Error(`${label}.review_method must be the required review method`);
  if (!Number.isInteger(entry.correction_rounds) || entry.correction_rounds < 0 || entry.correction_rounds > 2) {
    throw new Error(`${label}.correction_rounds must be an integer from 0 through 2`);
  }
  if (!["passed", "failed"].includes(entry.verdict)) throw new Error(`${label}.verdict must be passed or failed`);
  if (catalogEntry.delivery_status === "published" && entry.verdict !== "passed") throw new Error(`published catalog entry must be passed: ${entry.id}`);
  if (catalogEntry.delivery_status === "passed" && entry.verdict !== "passed") throw new Error(`published or passed catalog entry must be passed: ${entry.id}`);
  if (catalogEntry.delivery_status === "blocked-visual" && entry.verdict !== "failed") throw new Error(`blocked catalog entry may not use verdict: passed: ${entry.id}`);
  if (!["passed", "published", "blocked-visual"].includes(catalogEntry.delivery_status)) {
    throw new Error(`visual QA entry has a non-reviewable catalog state: ${entry.id}`);
  }
  if (catalogEntry.reviewer !== entry.reviewer) throw new Error(`${label}.reviewer does not match catalog reviewer`);
  const spec = await regularContained(root, catalogEntry.spec, `${label} specification`);
  const artifact = await regularContained(root, artifactPath(catalogEntry), `${label} artifact`);
  if (sha256(await readFile(spec.filename)) !== entry.specification_sha256) throw new Error(`${label} specification digest does not match bytes`);
  if (sha256(await readFile(artifact.filename)) !== entry.artifact_sha256) throw new Error(`${label} artifact digest does not match bytes`);
  validateChecks(entry, label);
  const views = await validateRenders(root, entry, label, usedPaths, renderSnapshots);
  validateDefects(entry, label, views);
}

export function collectArchifyVisualQaRenderPaths(manifest) {
  if (!isObject(manifest) || !Array.isArray(manifest.entries)) throw new Error("visual QA manifest entries must be an array");
  const paths = new Set();
  for (const entry of manifest.entries) {
    if (!isObject(entry) || !isObject(entry.renders)) continue;
    for (const render of [entry.renders.read, entry.renders.light, entry.renders.dark, ...(Array.isArray(entry.renders.guided_views) ? entry.renders.guided_views : [])]) {
      if (!isObject(render) || typeof render.path !== "string") continue;
      paths.add(normalizeRelativePath(render.path, "visual QA render path"));
    }
  }
  return [...paths].sort(comparePaths);
}

export async function loadArchifyVisualQa({ repoRoot, manifestPath, catalog: suppliedCatalog, manifestBytes, renderSnapshots } = {}) {
  if (!nonempty(repoRoot)) throw new Error("repoRoot must be a non-empty path");
  const catalog = suppliedCatalog ?? await loadArchifyCatalog({ repoRoot });
  const relative = manifestPath ?? MANIFEST_PATH;
  let qa;
  try {
    const bytes = manifestBytes ?? await readFile((await regularContained(repoRoot, relative, "visual QA manifest")).filename, "utf8");
    qa = JSON.parse(Buffer.isBuffer(bytes) ? bytes.toString("utf8") : bytes);
  } catch (error) { throw new Error(`invalid visual QA manifest JSON: ${error.message}`); }
  assertExactKeys(qa, ["schema_version", "entries", "contact_sheets"], "visual QA manifest");
  if (qa.schema_version !== 1) throw new Error("visual QA manifest schema_version must be 1");
  if (!Array.isArray(qa.entries)) throw new Error("visual QA manifest entries must be an array");
  if (!Array.isArray(qa.contact_sheets)) throw new Error("visual QA manifest contact_sheets must be an array");
  const required = catalog.entries.filter((entry) => entry.decision === "selected" && ["passed", "published"].includes(entry.delivery_status));
  if (qa.entries.length === 0) {
    if (required.length > 0) throw new Error(`visual QA manifest requires passed records: ${required.map((entry) => entry.id).join(", ")}`);
    return { catalog, qa };
  }
  const catalogById = new Map(catalog.entries.filter((entry) => entry.decision === "selected").map((entry) => [entry.id, entry]));
  const seen = new Set();
  const usedPaths = new Set();
  for (const [index, entry] of qa.entries.entries()) {
    if (!isObject(entry) || !nonempty(entry.id)) throw new Error(`visual QA entry[${index}].id must be a non-empty string`);
    if (seen.has(entry.id)) throw new Error(`duplicate visual QA entry id: ${entry.id}`);
    seen.add(entry.id);
    const catalogEntry = catalogById.get(entry.id);
    if (!catalogEntry) throw new Error(`visual QA entry does not exist in selected catalog: ${entry.id}`);
    await validateEntry(repoRoot, entry, catalogEntry, index, usedPaths, renderSnapshots);
  }
  for (const entry of required) if (!seen.has(entry.id)) throw new Error(`missing visual QA passed record: ${entry.id}`);
  return { catalog, qa };
}

function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function compareEntries(left, right) {
  return comparePaths(left.catalog.product, right.catalog.product)
    || comparePaths(left.catalog.diagram_type, right.catalog.diagram_type)
    || comparePaths(left.catalog.id, right.catalog.id);
}

function hrefFromSheet(sheetName, target) {
  const sheetDirectory = path.posix.dirname(`guides/archify-diagrams/visual-qa/contact-sheets/${sheetName}`);
  const relative = path.posix.relative(sheetDirectory, target.replaceAll("\\", "/"));
  return relative.split("/").map(encodeURIComponent).join("/");
}

function renderSheet(title, entries, sheetName) {
  const cards = [...entries].sort(compareEntries).map(({ catalog, qa }) => [
    `<article data-visual-qa-id="${escapeHtml(catalog.id)}">`,
    `  <h2>${escapeHtml(catalog.id)}</h2>`,
    `  <p><strong>Question:</strong> ${escapeHtml(catalog.question)}</p>`,
    `  <p><strong>Type:</strong> ${escapeHtml(catalog.diagram_type)} · <strong>Product:</strong> ${escapeHtml(catalog.product)}</p>`,
    `  <p><a href="${escapeHtml(hrefFromSheet(sheetName, catalog.source_document))}">Source</a></p>`,
    `  <figure><img src="../${escapeHtml(qa.renders.read.path)}" width="${qa.renders.read.width}" height="${qa.renders.read.height}" alt="READ — ${escapeHtml(catalog.id)}"><figcaption>READ</figcaption></figure>`,
    "</article>",
  ].join("\n"));
  return [
    "<!doctype html>", "<html lang=\"en\">", "<meta charset=\"utf-8\">", `<title>${escapeHtml(title)}</title>`,
    `<h1>${escapeHtml(title)}</h1>`, ...cards, "",
  ].join("\n");
}

export function renderArchifyContactSheets({ catalog, qa }) {
  if (!catalog || !Array.isArray(catalog.entries) || !qa || !Array.isArray(qa.entries)) throw new Error("contact sheets require catalog and visual QA entries");
  const catalogById = new Map(catalog.entries.map((entry) => [entry.id, entry]));
  const passed = qa.entries.filter((entry) => entry.verdict === "passed").map((entry) => ({ catalog: catalogById.get(entry.id), qa: entry }));
  if (passed.some((entry) => !entry.catalog)) throw new Error("contact sheet has an unknown catalog entry");
  if (passed.length === 0) return new Map();
  const sheets = new Map([["all.html", renderSheet("All curated Archify diagrams", passed, "all.html")]]);
  for (const product of [...new Set(passed.map((entry) => entry.catalog.product))].sort(comparePaths)) {
    const name = `product-${product}.html`;
    sheets.set(name, renderSheet(`Curated Archify diagrams — ${product}`, passed.filter((entry) => entry.catalog.product === product), name));
  }
  for (const type of [...new Set(passed.map((entry) => entry.catalog.diagram_type))].sort(comparePaths)) {
    const name = `type-${type}.html`;
    sheets.set(name, renderSheet(`Curated Archify diagrams — ${type}`, passed.filter((entry) => entry.catalog.diagram_type === type), name));
  }
  assertArchifyContactSheetCoverage(sheets, passed);
  return sheets;
}

export function assertArchifyContactSheetCoverage(sheets, passed) {
  if (passed.length === 0) {
    if (sheets.size !== 0) throw new Error("empty passed contact sheet set must be empty");
    return;
  }
  const all = sheets.get("all.html");
  if (typeof all !== "string") throw new Error("contact sheet is missing all.html");
  for (const { catalog } of passed) {
    if (!all.includes(`data-visual-qa-id=\"${escapeHtml(catalog.id)}\"`)) throw new Error(`contact sheet omits passed entry: ${catalog.id}`);
  }
}
