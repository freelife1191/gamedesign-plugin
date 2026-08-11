import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { loadArchifyCatalog } from "../../tooling/lib/archify-catalog.mjs";
import {
  extractMarkdownLinks,
  scanVisibleMarkdown,
} from "../../tooling/lib/user-guides.mjs";

const repoRoot = path.resolve(import.meta.dirname, "../..");
const statusIndex = "guides/archify-diagrams/README.md";
const statusRoutes = Object.freeze([
  "README.md",
  "guides/README.md",
  "guides/game-design-studio/README.md",
  "guides/game-design-career/README.md",
]);

function visibleLinks(markdown) {
  return extractMarkdownLinks(markdown).map((link) => link.target);
}

function resolveDestination(document, destination) {
  if (!destination || /^[a-z][a-z0-9+.-]*:/iu.test(destination) || destination.startsWith("/")) return null;
  let target;
  try {
    target = decodeURIComponent(destination);
  } catch {
    return "guides/assets/archify/__invalid-relative-target__";
  }
  return path.posix.normalize(path.posix.join(path.posix.dirname(document), target));
}

function productionLinks(documents) {
  return documents.flatMap(({ filename, markdown }) => visibleLinks(markdown)
    .map((destination) => ({ filename, destination: resolveDestination(filename, destination) }))
    .filter((link) => link.destination?.startsWith("guides/assets/archify/")));
}

function assertExactProductionLinks(documents, expected, expectedReceipts = []) {
  const links = productionLinks(documents);
  const htmlLinks = links.filter((link) => /\.html(?:[?#].*)?$/u.test(link.destination));
  const receiptLinks = links.filter((link) => /\.receipt\.json(?:[?#].*)?$/u.test(link.destination));
  const supportedLinks = new Set([...htmlLinks, ...receiptLinks]);
  assert.equal(supportedLinks.size, links.length, "production assets must be HTML diagrams or delivery receipts");
  assert.deepEqual(
    [...new Set(htmlLinks.map((link) => link.destination))].sort(),
    [...new Set(expected)].sort(),
    "visible production-link targets must equal the published-and-passed catalog set",
  );
  assert.deepEqual(
    [...new Set(receiptLinks.map((link) => link.destination))].sort(),
    [...new Set(expectedReceipts)].sort(),
    "visible receipt targets must equal the published-and-passed catalog receipts",
  );
  for (const link of htmlLinks) assert.ok(!link.destination.endsWith("/flow.html"), "legacy flow.html must not be linked");
  for (const link of receiptLinks) {
    assert.equal(link.filename, statusIndex, "delivery receipts may be linked only from the Archify status index");
  }
}

function sourceSectionBounds(markdown, expectedHeading) {
  const headings = scanVisibleMarkdown(markdown).flatMap(({ blockText, line }) => {
    const match = /^(?: {0,3})(#{1,6})\s+(.+?)\s*#*\s*$/u.exec(blockText);
    return match ? [{ label: match[2].trim(), level: match[1].length, line }] : [];
  });
  const start = headings.findIndex((heading) => heading.label === expectedHeading);
  if (start < 0) return null;
  const heading = headings[start];
  const next = headings.slice(start + 1).find((candidate) => candidate.level <= heading.level);
  return {
    firstLine: heading.line,
    lastLine: next?.line ?? markdown.split(/\r?\n/gu).length + 1,
  };
}

function sourceSection(markdown, expectedHeading) {
  const bounds = sourceSectionBounds(markdown, expectedHeading);
  if (!bounds) return null;
  return markdown.split(/\r?\n/gu).slice(bounds.firstLine - 1, bounds.lastLine).join("\n");
}

function assertPublishedSourceBindings(documents, published) {
  const documentsByFilename = new Map(documents.map((document) => [document.filename, document]));
  for (const entry of published) {
    const source = documentsByFilename.get(entry.source_document);
    assert.ok(source, `${entry.id} source document must be checked for its production link`);
    const section = sourceSectionBounds(source.markdown, entry.source_section);
    assert.ok(section, `${entry.id} catalog source section must exist`);
    assert.ok(
      extractMarkdownLinks(source.markdown).some((link) => link.line >= section.firstLine
        && link.line < section.lastLine
        && resolveDestination(entry.source_document, link.target) === entry.html),
      `${entry.id} production link must appear in its catalog source section`,
    );
  }
}

function assertedStatusIndex(markdown, published, blocked, filename = statusIndex) {
  assert.match(markdown, /^## Published\b/mu, "status index must have a separate Published section");
  for (const entry of published) {
    const detail = sourceSection(markdown, `\`${entry.id}\``);
    assert.ok(detail, `${entry.id} missing from Published`);
    assert.match(detail, new RegExp(`\\b${entry.product}\\b`, "u"), `${entry.id} product missing from index`);
    assert.match(detail, new RegExp(`\\b${entry.diagram_type}\\b`, "u"), `${entry.id} type missing from index`);
    assert.match(detail, /한국어/u, `${entry.id} Korean UI state missing from index`);
    assert.ok(
      visibleLinks(detail).some((destination) => resolveDestination(filename, destination) === entry.html),
      `${entry.id} published HTML link missing from index`,
    );
    assert.ok(
      visibleLinks(detail).some((destination) => resolveDestination(filename, destination) === entry.receipt),
      `${entry.id} delivery receipt link missing from index`,
    );
  }
  assert.match(markdown, /^## Blocked\b/mu, "status index must have a separate Blocked section");
  if (blocked.length === 0) assert.match(markdown, /(?:Blocked[^\n]*\n)(?:[\s\S]{0,300}?)(?:0\s*(?:개|items?)|none|없음)/iu, "Blocked must explicitly report zero items");
  for (const entry of blocked) {
    const detail = sourceSection(markdown, `\`${entry.id}\``);
    assert.ok(detail, `${entry.id} missing from Blocked`);
    assert.match(detail, new RegExp(`\\b${entry.product}\\b`, "u"), `${entry.id} product missing from index`);
    assert.match(detail, new RegExp(`\\b${entry.diagram_type}\\b`, "u"), `${entry.id} type missing from index`);
    assert.match(detail, new RegExp(`\\b${entry.delivery_status}\\b`, "u"), `${entry.id} delivery status missing from index`);
    assert.match(detail, /이유/u, `${entry.id} reason missing from index`);
    assert.ok(
      visibleLinks(detail).some((destination) => resolveDestination(filename, destination) === entry.spec),
      `${entry.id} spec link missing from index`,
    );
    assert.match(detail, /(?:evidence|증거|visual-qa)/iu, `${entry.id} evidence route missing from index`);
    assert.match(detail, /(?:retry|재시도|다시|수정|검증)/iu, `${entry.id} retry boundary missing from index`);
  }
}

function assertCurrentInventoryIntro(markdown, { selectedCount, publishedCount }) {
  const intro = markdown.slice(0, markdown.indexOf("## 증거와 전수 범위"));
  const lines = intro.split(/\r?\n/gu);
  const selectedLines = lines.filter((line) => line.includes("`selected`") && /\d+개/u.test(line));
  const selectedClaims = [...intro.matchAll(/(\d+)개\s+`selected`/gu)]
    .map((match) => Number(match[1]));
  assert.equal(selectedClaims.length, selectedLines.length, "every selected entry count claim must be numeric");
  assert.ok(selectedClaims.length > 0, "inventory intro must state the selected entry count");
  for (const count of selectedClaims) {
    assert.equal(count, selectedCount, "every selected entry count must equal the catalog-derived count");
  }
  const publishedLines = lines.filter((line) => line.includes("`published`") && /\d+개/u.test(line));
  const publishedClaims = [...intro.matchAll(/(?:(\d+)개(?:를)?\s+`published`|`published`(?:는|은)?\s*(\d+)개)/gu)]
    .map((match) => Number(match[1] ?? match[2]));
  assert.equal(publishedClaims.length, publishedLines.length, "every published count claim must be numeric");
  assert.ok(publishedClaims.length > 0, "inventory intro must state the published count");
  for (const count of publishedClaims) {
    assert.equal(count, publishedCount, "every published count must equal the catalog-derived count");
  }
  assert.match(intro, /한국어/u, "inventory intro must state that the published viewer is localized in Korean");
  assert.doesNotMatch(intro, /blocked-validation|blocked-visual/u, "inventory intro must not retain resolved block states");
  assert.doesNotMatch(intro, /아직은\s*`?delivery_status:\s*planned`?/u, "inventory intro must not describe the selected entries as planned");
}

async function markdownFiles(directory) {
  const entries = await readdir(path.join(repoRoot, directory), { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name, "en"))) {
    const filename = path.posix.join(directory, entry.name);
    if (entry.isDirectory() && !entry.isSymbolicLink()) files.push(...await markdownFiles(filename));
    else if (entry.isFile() && entry.name.endsWith(".md")) files.push(filename);
  }
  return files;
}

async function guideDocuments(catalog) {
  const filenames = new Set(await markdownFiles("guides"));
  filenames.add("README.md");
  return Promise.all([...filenames].map(async (filename) => ({ filename, markdown: await readFile(path.join(repoRoot, filename), "utf8") })));
}

test("curated Archify guide routing exposes only published, visually passed production diagrams", async () => {
  const catalog = await loadArchifyCatalog({ repoRoot });
  const documents = await guideDocuments(catalog);
  assert.ok(documents.some((document) => document.filename === "README.md"), "root README must always be checked for production Archify links");
  const expected = catalog.entries
    .filter((entry) => entry.delivery_status === "published" && entry.visual_review === "passed")
    .map((entry) => entry.html)
    .sort();
  const expectedReceipts = catalog.entries
    .filter((entry) => entry.delivery_status === "published" && entry.visual_review === "passed")
    .map((entry) => entry.receipt)
    .sort();
  const blocked = catalog.entries.filter((entry) => entry.decision === "selected" && entry.delivery_status.startsWith("blocked-"));

  assertExactProductionLinks(documents, expected, expectedReceipts);
  assertPublishedSourceBindings(documents, catalog.entries.filter((entry) => entry.delivery_status === "published"));
  const index = documents.find((document) => document.filename === statusIndex).markdown;
  assertCurrentInventoryIntro(index, {
    selectedCount: catalog.entries.filter((entry) => entry.decision === "selected").length,
    publishedCount: catalog.entries.filter((entry) => entry.delivery_status === "published").length,
  });
  assertedStatusIndex(index, catalog.entries.filter((entry) => entry.delivery_status === "published"), blocked);
  for (const document of documents.filter((item) => statusRoutes.includes(item.filename))) {
    assert.ok(
      visibleLinks(document.markdown).some((destination) => resolveDestination(document.filename, destination) === statusIndex),
      `${document.filename} must route readers to the curated Archify status index`,
    );
  }
  for (const entry of catalog.entries.filter((item) => item.delivery_status === "published")) {
    assert.equal(entry.visual_review, "passed", entry.id);
    await access(path.join(repoRoot, entry.html));
    await access(path.join(repoRoot, entry.receipt));
    await access(path.join(repoRoot, entry.spec));
    const receipt = JSON.parse(await readFile(path.join(repoRoot, entry.receipt), "utf8"));
    assert.equal(receipt.input, entry.spec, `${entry.id} receipt must bind its catalog spec`);
    assert.equal(receipt.output, entry.html, `${entry.id} receipt must bind its catalog HTML`);
    assert.equal(receipt.type, entry.diagram_type, `${entry.id} receipt must bind its catalog type`);
  }
});

test("production-link parser covers rendered Markdown references and raw anchors while ignoring hidden content", () => {
  const blocked = "guides/assets/archify/studio/studio-project-workflow.html";
  const visible = "guides/assets/archify/career/career-evidence-workflow.html";
  const onlyVisible = `\`[inline](${blocked})\`\n\n<!-- [comment](${blocked}) -->\n\n<span hidden>[hidden](${blocked})</span>\n\n\`\`\`md\n[code](${blocked})\n\`\`\`\n\n[visible](assets/archify/career/career-evidence-workflow.html)\n\n[reference][visible-reference]\n\n[visible-reference]: assets/archify/career/career-evidence-workflow.html\n\n<a href="assets/archify/career/career-evidence-workflow.html">raw anchor</a>`;
  assert.doesNotThrow(() => assertExactProductionLinks([{ filename: "guides/test.md", markdown: onlyVisible }], [visible, visible, visible]));
  assert.throws(
    () => assertExactProductionLinks([{ filename: "guides/test.md", markdown: "[blocked](assets/archify/studio/studio-project-workflow.html)" }], []),
    /published-and-passed/u,
    "a visible blocked production link must violate the empty published set",
  );
  assert.throws(
    () => assertExactProductionLinks([{ filename: "guides/test.md", markdown: "[legacy](assets/archify/studio/flow.html)" }], ["guides/assets/archify/studio/flow.html"]),
    /legacy flow\.html/u,
    "a visible legacy flow.html link must be rejected",
  );
  const receipt = "guides/assets/archify/career/career-evidence-workflow.receipt.json";
  assert.doesNotThrow(
    () => assertExactProductionLinks([{
      filename: statusIndex,
      markdown: "[receipt](../assets/archify/career/career-evidence-workflow.receipt.json)",
    }], [], [receipt]),
    "an exact published receipt is allowed from the Archify status index",
  );
  assert.throws(
    () => assertExactProductionLinks([{
      filename: "guides/test.md",
      markdown: "[receipt](assets/archify/career/career-evidence-workflow.receipt.json)",
    }], [], [receipt]),
    /only from the Archify status index/u,
    "a delivery receipt must not be exposed from an ordinary guide",
  );
});

test("inventory intro rejects multi-digit and single-claim count drift", () => {
  const intro = [
    "현재 4개 `selected` 항목은 모두 committed `spec`을 가집니다.",
    "한국어 HTML 4개를 `published` 상태로 공개합니다.",
    "현재 4개 `selected` spec은 검증을 통과했습니다.",
    "`published`는 4개입니다.",
    "",
    "## 증거와 전수 범위",
  ].join("\n");
  const expected = { selectedCount: 4, publishedCount: 4 };
  assert.doesNotThrow(() => assertCurrentInventoryIntro(intro, expected));
  for (const [label, markdown] of [
    ["multi-digit selected", intro.replace("현재 4개 `selected` 항목", "현재 14개 `selected` 항목")],
    ["one selected claim", intro.replace("현재 4개 `selected` spec", "현재 5개 `selected` spec")],
    ["one published claim", intro.replace("`published`는 4개", "`published`는 5개")],
  ]) {
    assert.throws(
      () => assertCurrentInventoryIntro(markdown, expected),
      /catalog-derived|selected entry/u,
      label,
    );
  }
});

test("root README rejects rendered reference, raw-anchor, receipt, and fragment/query production-link bypasses", () => {
  const expected = [];
  for (const [label, markdown] of [
    ["reference", "[blocked][r]\n\n[r]: guides/assets/archify/studio/studio-project-workflow.html"],
    ["raw anchor", '<a href="guides/assets/archify/studio/studio-project-workflow.html">blocked</a>'],
    ["receipt", '[receipt](guides/assets/archify/studio/studio-project-workflow.receipt.json)'],
    ["legacy", '[legacy](guides/assets/archify/studio/flow.html)'],
    ["nested raw anchor", '<div><a href="guides/assets/archify/studio/studio-project-workflow.html">blocked</a></div>'],
    ["multiline quoted raw anchor", '<a\nHREF="guides/assets/archify/studio/studio-project-workflow.html">blocked</a>'],
    ["multiline unquoted raw anchor", '<a\nhref=guides/assets/archify/studio/studio-project-workflow.html>blocked</a>'],
    ["pre raw anchor", '<pre><a href="guides/assets/archify/studio/studio-project-workflow.html">blocked</a></pre>'],
    ["code raw anchor", '<code><a href="guides/assets/archify/studio/studio-project-workflow.html">blocked</a></code>'],
    ["first duplicate href", '<a href="guides/assets/archify/studio/studio-project-workflow.html" href="safe.md">blocked</a>'],
  ]) {
    assert.throws(() => assertExactProductionLinks([{ filename: "README.md", markdown }], expected), /published-and-passed|legacy flow/u, label);
  }
  assert.throws(
    () => assertExactProductionLinks([{ filename: "README.md", markdown: '[fragment](guides/assets/archify/studio/published.html#view)' }], ["guides/assets/archify/studio/published.html"]),
    /published-and-passed/u,
    "fragments on production output are rejected instead of normalizing to the published path",
  );
  assert.throws(
    () => assertExactProductionLinks([{ filename: "README.md", markdown: '[query](guides/assets/archify/studio/published.html?view=1)' }], ["guides/assets/archify/studio/published.html"]),
    /published-and-passed/u,
    "queries on production output are rejected instead of normalizing to the published path",
  );
  assert.doesNotThrow(
    () => assertExactProductionLinks([{
      filename: "README.md",
      markdown: '<span hidden>\n[blocked](guides/assets/archify/studio/studio-project-workflow.html)\n</span>',
    }], expected),
    "a multiline hidden container must not make its Markdown link visible",
  );
});

test("status index contract rejects a missing blocked entry", () => {
  const blocked = [{
    id: "career-evidence-workflow", product: "career", diagram_type: "workflow", delivery_status: "blocked-visual",
    spec: "guides/archify-diagrams/specs/career/career-evidence-workflow.json",
  }];
  assert.throws(
    () => assertedStatusIndex("## Published\n\n0개\n\n## Blocked\n\n재시도와 evidence를 확인합니다.", [], blocked),
    /missing from Blocked/u,
  );
});

test("published production links must remain inside the catalog source section", () => {
  const entry = {
    id: "bound-id", source_document: "guides/source.md", source_section: "Expected section",
    html: "guides/assets/archify/studio/bound-id.html",
  };
  assert.throws(
    () => assertPublishedSourceBindings([
      { filename: "guides/source.md", markdown: "# Source\n\n## Expected section\n\nNo production link here.\n" },
      { filename: "guides/other.md", markdown: "[misplaced](assets/archify/studio/bound-id.html)\n" },
    ], [entry]),
    /must appear in its catalog source section/u,
  );
  assert.doesNotThrow(() => assertPublishedSourceBindings([
    { filename: "guides/source.md", markdown: "# Source\n\n## Expected section\n\n[bound](assets/archify/studio/bound-id.html)\n" },
  ], [entry]));
  assert.doesNotThrow(() => assertPublishedSourceBindings([
    { filename: "guides/source.md", markdown: "# Source\n\n## Expected section\n\n[bound][r]\n\n## Definitions\n\n[r]: assets/archify/studio/bound-id.html\n" },
  ], [entry]), "a reference definition outside the source section still binds its rendered link");
});
