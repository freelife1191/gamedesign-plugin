import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { lstat, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { deflateSync } from "node:zlib";

import { loadArchifyVisualQa, renderArchifyContactSheets } from "../../tooling/lib/archify-visual-qa.mjs";
import { buildArchifyContactSheets } from "../../tooling/build-archify-contact-sheets.mjs";

const SCAN_ROOTS = [
  "README.md", "guides", "products/game-design-studio", "products/game-design-career",
  "plugins/game-design-studio", "plugins/game-design-career",
];
const SCAN_EXCLUDES = ["guides/assets/archify", "shared/vendor", ".git", ".worktrees", ".tmp", ".build"];
const CHECKS = [
  "text_clipping", "glyph_distortion", "blur_or_tofu", "node_text_collision", "edge_node_collision",
  "edge_label_collision", "ambiguous_corridor", "branch_merge_retry_resume", "rail_legend_footer",
  "light_dark_contrast", "guided_view_usefulness", "within_product_diversity", "cross_product_distinction",
];
const SOURCE = "# Visual fixture\n\n## Exact heading\n\nSource.\n";
const SPEC = "{\"nodes\":[{\"id\":\"start\",\"type\":\"step\",\"lane\":\"review\",\"col\":0}],\"edges\":[],\"lanes\":[{\"id\":\"review\"}]}\n";

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBytes = Buffer.from(type, "ascii");
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  typeBytes.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), 8 + data.length);
  return chunk;
}

function png(width = 2, height = 2) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", header), pngChunk("IDAT", deflateSync(Buffer.concat(Array.from({ length: height }, () => Buffer.alloc(width * 4 + 1))))), pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function pngWithoutIdat() {
  const header = Buffer.from([0, 0, 0, 2, 0, 0, 0, 2, 8, 6, 0, 0, 0]);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), pngChunk("IHDR", header), pngChunk("IEND", Buffer.alloc(0))]);
}

async function writeRelative(root, relative, bytes) {
  const filename = path.join(root, ...relative.split("/"));
  await mkdir(path.dirname(filename), { recursive: true });
  await writeFile(filename, bytes);
  return filename;
}

function catalogEntry({ deliveryStatus = "passed", visualReview = "passed" } = {}) {
  return {
    id: "stable-id", product: "studio", source_document: "README.md", source_section: "Exact heading",
    source_digest: sha256(SOURCE), question: "What is the review path?", decision: "selected",
    decision_reason: "The flow has meaningful relationships.", diagram_type: "workflow",
    diagram_type_reason: "It is a workflow.", priority: "primary", secondary_reason: null,
    visual_system: "studio", composition_rationale: "Clear flow.", shared_process_with: null,
    shared_process_reason: null, diagnostics: deliveryStatus === "blocked-visual" ? [{
      code: "visual-defect", subject: "stable-id", evidence: "review failed", attempted_fix: "label adjustment", round: 1, remaining_error: "overlap",
    }] : [], spec: "guides/archify-diagrams/specs/studio/stable-id.json",
    html: "guides/assets/archify/studio/stable-id.html", receipt: "guides/assets/archify/studio/stable-id.receipt.json",
    delivery_status: deliveryStatus, visual_review: visualReview, reviewer: ["passed", "published", "blocked-visual"].includes(deliveryStatus) ? "reviewer" : null,
  };
}

function qaEntry(renderFiles, { verdict = "passed", checks = Object.fromEntries(CHECKS.map((key) => [key, "passed"])) } = {}) {
  const render = (name) => ({ path: renderFiles[name].relative, sha256: sha256(renderFiles[name].bytes), width: 2, height: 2 });
  return {
    id: "stable-id", specification_sha256: sha256(SPEC), artifact_sha256: sha256("<main>artifact</main>\n"),
    reviewer: "reviewer", review_method: "headless-original-and-fit", correction_rounds: 0,
    verdict, renders: { read: render("read"), light: render("light"), dark: render("dark"), guided_views: [{ id: "view-focus", ...render("guided") }] },
    checks, defects: [],
  };
}

async function visualQaFixture(t, { omit, checks, deliveryStatus = "passed", visualReview = "passed" } = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), "archify-visual-qa-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeRelative(root, "README.md", SOURCE);
  for (const directory of SCAN_ROOTS.filter((item) => item !== "README.md")) await mkdir(path.join(root, directory), { recursive: true });
  await writeRelative(root, "guides/archify-diagrams/specs/studio/stable-id.json", SPEC);
  const artifact = deliveryStatus === "blocked-visual"
    ? "guides/archify-diagrams/visual-qa/failed-artifacts/studio/stable-id.html"
    : ".tmp/curated-archify/current/studio/stable-id.html";
  await writeRelative(root, artifact, "<main>artifact</main>\n");
  const renderFiles = {};
  for (const name of ["read", "light", "dark", "guided"]) {
    const relative = `guides/archify-diagrams/visual-qa/renders/studio/stable-id/${name}.png`;
    const bytes = png();
    await writeRelative(root, relative, bytes);
    renderFiles[name] = { relative: relative.replace("guides/archify-diagrams/visual-qa/", ""), bytes };
  }
  const qa = { schema_version: 1, entries: [qaEntry(renderFiles, { checks })], contact_sheets: [] };
  if (omit === "guided") qa.entries[0].renders.guided_views = [];
  else if (omit) delete qa.entries[0].renders[omit];
  const catalog = { schema_version: 1, scan_roots: SCAN_ROOTS, scan_excludes: SCAN_EXCLUDES, entries: [catalogEntry({ deliveryStatus, visualReview })] };
  await writeRelative(root, "guides/archify-diagrams/catalog.json", `${JSON.stringify(catalog, null, 2)}\n`);
  const manifest = "guides/archify-diagrams/visual-qa/manifest.json";
  await writeRelative(root, manifest, `${JSON.stringify(qa, null, 2)}\n`);
  return { root, qa, manifest, renderFiles };
}

async function rewrite(fixture) {
  await writeFile(path.join(fixture.root, fixture.manifest), `${JSON.stringify(fixture.qa, null, 2)}\n`);
}

async function bindContactCaptures(fixture) {
  const directory = path.join(fixture.root, "guides/archify-diagrams/visual-qa/contact-sheets");
  const sourceRead = fixture.qa.entries[0].renders.read.sha256;
  fixture.qa.contact_sheets = ["all", "product-studio", "type-workflow"].map((base) => ({
    html: `${base}.html`, html_sha256: "",
    png: `${base}.png`, png_sha256: sha256(fixture.renderFiles.read.bytes), width: 2, height: 2,
    source_read_sha256: [sourceRead],
  }));
  for (const record of fixture.qa.contact_sheets) {
    record.html_sha256 = sha256(await readFile(path.join(directory, record.html)));
    await writeFile(path.join(directory, record.png), fixture.renderFiles.read.bytes);
  }
  await rewrite(fixture);
}

async function visualQaMutationFixture(t, mutate) {
  const fixture = await visualQaFixture(t);
  await mutate(fixture);
  await rewrite(fixture);
  return fixture.root;
}

async function replacePngWithText(fixture) {
  await writeFile(path.join(fixture.root, "guides/archify-diagrams/visual-qa/renders/studio/stable-id/read.png"), "not a png\n");
}

function corruptReadDigest(fixture) { fixture.qa.entries[0].renders.read.sha256 = "0".repeat(64); }
function removeRequiredGuidedView(fixture) { fixture.qa.entries[0].renders.guided_views = []; }
function corruptSpecificationDigest(fixture) { fixture.qa.entries[0].specification_sha256 = "0".repeat(64); }
function corruptArtifactDigest(fixture) { fixture.qa.entries[0].artifact_sha256 = "0".repeat(64); }
function markFailedEntryPublished(fixture) {
  fixture.qa.entries[0].verdict = "failed";
  fixture.qa.entries[0].correction_rounds = 1;
  fixture.qa.entries[0].checks.text_clipping = "failed";
  fixture.qa.entries[0].defects = [{ view: "read", subject: "label", symptom: "clipped", correction_outcome: "blocked", round: 1, correction_evidence: "recorded failure" }];
  fixture.qa.entries[0].reviewer = "reviewer";
}
async function markEntryStale(fixture) {
  const filename = path.join(fixture.root, "guides/archify-diagrams/catalog.json");
  const catalog = JSON.parse(await readFile(filename, "utf8"));
  catalog.entries[0].source_digest = "0".repeat(64);
  await writeFile(filename, `${JSON.stringify(catalog, null, 2)}\n`);
}
function duplicateRenderPath(fixture) { fixture.qa.entries[0].renders.light.path = fixture.qa.entries[0].renders.read.path; }

for (const view of ["read", "light", "dark", "guided"]) {
  test(`passed visual review requires the ${view} view`, async (t) => {
    const fixture = await visualQaFixture(t, { omit: view });
    await assert.rejects(() => loadArchifyVisualQa({ repoRoot: fixture.root }), new RegExp(`missing ${view === "guided" ? "guided view" : view} render`, "u"));
  });
}

test("visual review cannot pass with an unchecked defect class", async (t) => {
  const fixture = await visualQaFixture(t, { checks: { ...Object.fromEntries(CHECKS.map((key) => [key, "passed"])), edge_node_collision: null } });
  await assert.rejects(() => loadArchifyVisualQa({ repoRoot: fixture.root }), /edge_node_collision/u);
});

test("visual QA requires the exact review method, valid guided defect view, and closed defect outcomes", async (t) => {
  const fixture = await visualQaFixture(t, { deliveryStatus: "blocked-visual", visualReview: "failed" });
  fixture.qa.entries[0].verdict = "failed";
  fixture.qa.entries[0].checks.text_clipping = "failed";
  fixture.qa.entries[0].defects = [{ view: "view-focus", subject: "node", symptom: "overlap", correction_outcome: "blocked", round: 1, correction_evidence: "recorded failure" }];
  fixture.qa.entries[0].review_method = "manual";
  await rewrite(fixture);
  await assert.rejects(() => loadArchifyVisualQa({ repoRoot: fixture.root }), /review_method/u);
  fixture.qa.entries[0].review_method = "headless-original-and-fit";
  fixture.qa.entries[0].verdict = "failed";
  fixture.qa.entries[0].checks.text_clipping = "failed";
  fixture.qa.entries[0].defects = [{ view: "view-missing", subject: "node", symptom: "overlap", correction_outcome: "blocked", round: 1, correction_evidence: "recorded failure" }];
  await rewrite(fixture);
  await assert.rejects(() => loadArchifyVisualQa({ repoRoot: fixture.root }), /existing render/u);
  fixture.qa.entries[0].defects[0].view = "view-focus";
  fixture.qa.entries[0].defects[0].correction_outcome = "later";
  await rewrite(fixture);
  await assert.rejects(() => loadArchifyVisualQa({ repoRoot: fixture.root }), /correction_outcome/u);
});

test("visual QA binds every correction round to a resolved defect and evidence", async (t) => {
  const fixture = await visualQaFixture(t);
  fixture.qa.entries[0].correction_rounds = 1;
  fixture.qa.entries[0].defects = [{ view: "read", subject: "label", symptom: "clipped", correction_outcome: "resolved", round: 1, correction_evidence: "recaptured read.png" }];
  await rewrite(fixture);
  await assert.doesNotReject(() => loadArchifyVisualQa({ repoRoot: fixture.root }));
  fixture.qa.entries[0].correction_rounds = 0;
  await rewrite(fixture);
  await assert.rejects(() => loadArchifyVisualQa({ repoRoot: fixture.root }), /max correction round/u);
  fixture.qa.entries[0].correction_rounds = 1;
  fixture.qa.entries[0].defects = [];
  await rewrite(fixture);
  await assert.rejects(() => loadArchifyVisualQa({ repoRoot: fixture.root }), /requires correction evidence/u);
});

test("visual QA rejects missing and corrupted PNG IDAT payloads through the shared complete-PNG inspector", async (t) => {
  const fixture = await visualQaFixture(t);
  const filename = path.join(fixture.root, "guides/archify-diagrams/visual-qa/renders/studio/stable-id/read.png");
  const missing = pngWithoutIdat();
  await writeFile(filename, missing);
  fixture.qa.entries[0].renders.read.sha256 = sha256(missing);
  await rewrite(fixture);
  await assert.rejects(() => loadArchifyVisualQa({ repoRoot: fixture.root }), /PNG validation/u);
  const corrupt = png(); corrupt[45] ^= 0xff;
  await writeFile(filename, corrupt);
  fixture.qa.entries[0].renders.read.sha256 = sha256(corrupt);
  await rewrite(fixture);
  await assert.rejects(() => loadArchifyVisualQa({ repoRoot: fixture.root }), /PNG validation/u);
});

for (const [name, mutate, pattern] of [
  ["PNG signature", replacePngWithText, /signature/u],
  ["zero dimensions", (q) => { q.qa.entries[0].renders.read.width = 0; }, /dimensions/u],
  ["render digest", corruptReadDigest, /render digest/u],
  ["guided view", removeRequiredGuidedView, /guided view/u],
  ["spec digest", corruptSpecificationDigest, /specification digest/u],
  ["artifact digest", corruptArtifactDigest, /artifact digest/u],
  ["third correction", (q) => { q.qa.entries[0].correction_rounds = 3; }, /correction_rounds/u],
  ["reviewer", (q) => { q.qa.entries[0].reviewer = ""; }, /reviewer/u],
  ["published failure", markFailedEntryPublished, /published.*passed/u],
  ["stale source", markEntryStale, /stale-source/u],
  ["duplicate render path", duplicateRenderPath, /duplicate render/u],
]) {
  test(`visual QA rejects ${name}`, async (t) => {
    const root = await visualQaMutationFixture(t, mutate);
    await assert.rejects(() => loadArchifyVisualQa({ repoRoot: root }), pattern);
  });
}

test("contact sheets escape data, order entries, and include every passed READ render", async (t) => {
  const fixture = await visualQaFixture(t);
  const { catalog, qa } = await loadArchifyVisualQa({ repoRoot: fixture.root });
  catalog.entries[0].question = "<unsafe & question>";
  const sheets = renderArchifyContactSheets({ catalog, qa });
  const all = sheets.get("all.html");
  assert.match(all, /<html lang="ko">/u);
  assert.match(all, /<strong>질문:<\/strong>/u);
  assert.match(all, /<strong>유형:<\/strong>/u);
  assert.match(all, />원문<\/a>/u);
  assert.match(all, /&lt;unsafe &amp; question&gt;/u);
  assert.match(all, /renders\/studio\/stable-id\/read\.png/u);
  for (const name of ["all.html", "product-studio.html", "type-workflow.html"]) {
    assert.match(sheets.get(name), /href="\.\.\/\.\.\/\.\.\/\.\.\/README\.md"/u);
  }
  assert.ok(sheets.has("product-studio.html"));
  assert.ok(sheets.has("type-workflow.html"));
  assert.equal(sheets.get("all.html"), renderArchifyContactSheets({ catalog, qa }).get("all.html"));
});

test("contact sheet builder checks exact bytes and rejects an omitted passed entry", async (t) => {
  const fixture = await visualQaFixture(t);
  await buildArchifyContactSheets({ repoRoot: fixture.root });
  await bindContactCaptures(fixture);
  await assert.doesNotReject(() => buildArchifyContactSheets({ repoRoot: fixture.root, check: true }));
  const output = path.join(fixture.root, "guides/archify-diagrams/visual-qa/contact-sheets/all.html");
  await writeFile(output, (await readFile(output, "utf8")).replaceAll("stable-id", "removed-id"));
  await assert.rejects(() => buildArchifyContactSheets({ repoRoot: fixture.root, check: true }), /contact sheet bytes/u);
});

test("contact sheet check binds the exact HTML and PNG capture set to READ evidence", async (t) => {
  const fixture = await visualQaFixture(t);
  await buildArchifyContactSheets({ repoRoot: fixture.root });
  const directory = path.join(fixture.root, "guides/archify-diagrams/visual-qa/contact-sheets");
  const sourceRead = fixture.qa.entries[0].renders.read.sha256;
  fixture.qa.contact_sheets = ["all", "product-studio", "type-workflow"].map((base) => ({
    html: `${base}.html`, html_sha256: "0".repeat(64),
    png: `${base}.png`, png_sha256: sha256(fixture.renderFiles.read.bytes), width: 2, height: 2,
    source_read_sha256: [sourceRead],
  }));
  for (const record of fixture.qa.contact_sheets) {
    record.html_sha256 = sha256(await readFile(path.join(directory, record.html)));
    await writeFile(path.join(directory, record.png), fixture.renderFiles.read.bytes);
  }
  await rewrite(fixture);
  await assert.doesNotReject(() => buildArchifyContactSheets({ repoRoot: fixture.root, check: true }));
  await rm(path.join(directory, "all.png"));
  await assert.rejects(() => buildArchifyContactSheets({ repoRoot: fixture.root, check: true }), /output set|missing contact sheet PNG/u);
  await writeFile(path.join(directory, "all.png"), png(3, 2));
  await assert.rejects(() => buildArchifyContactSheets({ repoRoot: fixture.root, check: true }), /PNG digest|dimensions/u);
  await writeFile(path.join(directory, "all.png"), fixture.renderFiles.read.bytes);
  await writeFile(path.join(directory, "all.html"), "stale\n");
  await assert.rejects(() => buildArchifyContactSheets({ repoRoot: fixture.root, check: true }), /HTML digest|bytes/u);
  fixture.qa.contact_sheets[0].html = "bogus.html";
  fixture.qa.contact_sheets[0].png = "bogus.png";
  await rewrite(fixture);
  await assert.rejects(() => buildArchifyContactSheets({ repoRoot: fixture.root, check: true }), /record does not match|evidence set|output set/u);
});

test("contact sheet builder removes every managed output when no visual review passed", async (t) => {
  const fixture = await visualQaFixture(t, { deliveryStatus: "blocked-visual", visualReview: "failed" });
  fixture.qa.entries[0].verdict = "failed";
  fixture.qa.entries[0].correction_rounds = 1;
  fixture.qa.entries[0].checks.text_clipping = "failed";
  fixture.qa.entries[0].defects = [{ view: "read", subject: "frame", symptom: "cropped", correction_outcome: "unresolved", round: 1, correction_evidence: "original inspection" }];
  await rewrite(fixture);
  const directory = path.join(fixture.root, "guides/archify-diagrams/visual-qa/contact-sheets");
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, "stale.html"), "stale\n");
  await writeFile(path.join(directory, "stale.png"), fixture.renderFiles.read.bytes);
  assert.deepEqual(await buildArchifyContactSheets({ repoRoot: fixture.root }), { built: true, outputs: [] });
  assert.deepEqual(await readdir(directory), []);
  await assert.doesNotReject(() => buildArchifyContactSheets({ repoRoot: fixture.root }));
});

test("contact sheet builder transactionally replaces stale groups with a bounded visibility gap and restores on failure", async (t) => {
  const fixture = await visualQaFixture(t);
  await buildArchifyContactSheets({ repoRoot: fixture.root });
  const directory = path.join(fixture.root, "guides/archify-diagrams/visual-qa/contact-sheets");
  await writeFile(path.join(directory, "stale.html"), "stale\n");
  await buildArchifyContactSheets({ repoRoot: fixture.root });
  await assert.rejects(readFile(path.join(directory, "stale.html")), { code: "ENOENT" });
  const before = await readFile(path.join(directory, "all.html"), "utf8");
  await assert.rejects(() => buildArchifyContactSheets({ repoRoot: fixture.root, __testHooks: { beforePublish: async () => { throw new Error("stop"); } } }), /stop/u);
  assert.equal(await readFile(path.join(directory, "all.html"), "utf8"), before);
  const qaDirectory = path.dirname(directory);
  assert.equal((await readdir(qaDirectory)).some((name) => name.startsWith(".contact-sheets-backup-") || name.startsWith("contact-sheet-")), false);
  await assert.rejects(() => buildArchifyContactSheets({ repoRoot: fixture.root, __testHooks: { beforeBackupCleanup: async () => { throw new Error("cleanup stop"); } } }), /backup cleanup failed/u);
  await assert.doesNotReject(() => buildArchifyContactSheets({ repoRoot: fixture.root }));
});

test("contact sheet build collision preserves the original backup for forensics", async (t) => {
  const fixture = await visualQaFixture(t);
  await buildArchifyContactSheets({ repoRoot: fixture.root });
  const directory = path.join(fixture.root, "guides/archify-diagrams/visual-qa/contact-sheets");
  let backup;
  let failure;
  try {
    await buildArchifyContactSheets({ repoRoot: fixture.root, __testHooks: { beforePublish: async ({ backup: value }) => {
      backup = value; await mkdir(directory); await writeFile(path.join(directory, "concurrent.html"), "collision\n");
    } } });
  } catch (error) { failure = error; }
  assert.ok(failure instanceof AggregateError);
  assert.match(failure.message, /forensic paths/u);
  assert.ok((await lstat(backup)).isDirectory());
  assert.equal(await readFile(path.join(directory, "concurrent.html"), "utf8"), "collision\n");
});

test("blocked visual entries require a failed verdict and a complete defect record", async (t) => {
  const fixture = await visualQaFixture(t, { deliveryStatus: "blocked-visual", visualReview: "failed" });
  fixture.qa.entries[0].verdict = "failed";
  fixture.qa.entries[0].correction_rounds = 1;
  fixture.qa.entries[0].checks.text_clipping = "failed";
  fixture.qa.entries[0].defects = [{ view: "read", subject: "node", symptom: "overlap", correction_outcome: "blocked", round: 1, correction_evidence: "recorded failure" }];
  await rewrite(fixture);
  await assert.doesNotReject(() => loadArchifyVisualQa({ repoRoot: fixture.root }));
  fixture.qa.entries[0].verdict = "passed";
  fixture.qa.entries[0].checks.text_clipping = "passed";
  fixture.qa.entries[0].defects = [];
  await rewrite(fixture);
  await assert.rejects(() => loadArchifyVisualQa({ repoRoot: fixture.root }), /blocked.*passed/u);
});

test("render paths are contained regular non-symlink PNG files", async (t) => {
  const fixture = await visualQaFixture(t);
  const filename = path.join(fixture.root, "guides/archify-diagrams/visual-qa/renders/studio/stable-id/read.png");
  assert.ok((await lstat(filename)).isFile());
  await assert.doesNotReject(() => loadArchifyVisualQa({ repoRoot: fixture.root }));
});

test("pinned render validation never falls back to the live filesystem", async (t) => {
  const fixture = await visualQaFixture(t);
  const loaded = await loadArchifyVisualQa({ repoRoot: fixture.root });
  await assert.rejects(() => loadArchifyVisualQa({
    repoRoot: fixture.root, catalog: loaded.catalog,
    manifestBytes: Buffer.from(JSON.stringify(fixture.qa)), renderSnapshots: new Map(),
  }), /missing pinned/u);
});
