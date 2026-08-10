import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { loadArchifyCatalog } from "../../tooling/lib/archify-catalog.mjs";

const repoRoot = path.resolve(import.meta.dirname, "../..");
const statusIndex = "guides/archify-diagrams/README.md";
const statusRoutes = Object.freeze([
  "guides/README.md",
  "guides/game-design-studio/README.md",
  "guides/game-design-career/README.md",
]);

function withoutNonRenderedMarkdown(markdown) {
  const withoutComments = markdown.replace(/<!--[\s\S]*?-->/gu, "");
  const withoutHiddenHtml = withoutComments.replace(/<([A-Za-z][\w-]*)(?:\s[^>]*)?\s+hidden(?:\s[^>]*)?>[\s\S]*?<\/\1\s*>/giu, "");
  const visibleLines = [];
  let fence;
  for (const line of withoutHiddenHtml.split(/\r?\n/gu)) {
    const marker = /^(?: {0,3})(`{3,}|~{3,})/u.exec(line)?.[1];
    if (fence) {
      if (marker?.[0] === fence[0] && marker.length >= fence.length) fence = undefined;
      continue;
    }
    if (marker) {
      fence = marker;
      continue;
    }
    visibleLines.push(line.replace(/(`+)(?:[^`]|`(?!\1))*\1/gu, ""));
  }
  return visibleLines.join("\n");
}

function visibleLinks(markdown) {
  const links = [];
  const rendered = withoutNonRenderedMarkdown(markdown);
  const matcher = /(?<!!)(?<!\\)\[[^\]]*\]\((?<destination><[^>]+>|[^\s)]+)(?:\s+[^)]*)?\)/gu;
  for (const match of rendered.matchAll(matcher)) {
    links.push(match.groups.destination.replace(/^<|>$/gu, ""));
  }
  return links;
}

function resolveDestination(document, destination) {
  const target = destination.split("#", 1)[0];
  if (!target || /^[a-z][a-z0-9+.-]*:/iu.test(target) || target.startsWith("/")) return null;
  return path.posix.normalize(path.posix.join(path.posix.dirname(document), target));
}

function productionLinks(documents) {
  return documents.flatMap(({ filename, markdown }) => visibleLinks(markdown)
    .map((destination) => ({ filename, destination: resolveDestination(filename, destination) }))
    .filter((link) => link.destination?.startsWith("guides/assets/archify/")));
}

function assertExactProductionLinks(documents, expected) {
  const links = productionLinks(documents);
  assert.deepEqual(
    links.map((link) => link.destination).sort(),
    [...expected].sort(),
    "visible production links must equal the published-and-passed catalog set",
  );
  for (const link of links) assert.ok(!link.destination.endsWith("/flow.html"), "legacy flow.html must not be linked");
}

function sourceSection(markdown, expectedHeading) {
  const lines = markdown.split(/\r?\n/gu);
  let start = -1;
  let level = 0;
  for (let index = 0; index < lines.length; index += 1) {
    const match = /^(#{1,6})\s+(.+?)(?:\s+#+)?\s*$/u.exec(lines[index]);
    if (match && match[2].trim() === expectedHeading) {
      start = index;
      level = match[1].length;
      break;
    }
  }
  if (start < 0) return null;
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    const match = /^(#{1,6})\s+/u.exec(lines[index]);
    if (match && match[1].length <= level) {
      end = index;
      break;
    }
  }
  return lines.slice(start, end).join("\n");
}

function assertPublishedSourceBindings(documents, published) {
  const documentsByFilename = new Map(documents.map((document) => [document.filename, document]));
  for (const entry of published) {
    const source = documentsByFilename.get(entry.source_document);
    assert.ok(source, `${entry.id} source document must be checked for its production link`);
    const section = sourceSection(source.markdown, entry.source_section);
    assert.ok(section, `${entry.id} catalog source section must exist`);
    assert.ok(
      visibleLinks(section).some((destination) => resolveDestination(entry.source_document, destination) === entry.html),
      `${entry.id} production link must appear in its catalog source section`,
    );
  }
}

function assertedStatusIndex(markdown, blocked, filename = statusIndex) {
  assert.match(markdown, /^## Published\b/mu, "status index must have a separate Published section");
  assert.match(markdown, /(?:Published[^\n]*\n)(?:[\s\S]{0,300}?)(?:0\s*(?:개|items?)|none|없음)/iu, "Published must explicitly report zero items");
  assert.match(markdown, /^## Blocked\b/mu, "status index must have a separate Blocked section");
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
  for (const entry of catalog.entries.filter((item) => item.delivery_status === "published" && item.source_document === "README.md")) filenames.add("README.md");
  return Promise.all([...filenames].map(async (filename) => ({ filename, markdown: await readFile(path.join(repoRoot, filename), "utf8") })));
}

test("curated Archify guide routing exposes only published, visually passed production diagrams", async () => {
  const catalog = await loadArchifyCatalog({ repoRoot });
  const documents = await guideDocuments(catalog);
  const expected = catalog.entries
    .filter((entry) => entry.delivery_status === "published" && entry.visual_review === "passed")
    .map((entry) => entry.html)
    .sort();
  const blocked = catalog.entries.filter((entry) => entry.decision === "selected" && entry.delivery_status.startsWith("blocked-"));

  assertExactProductionLinks(documents, expected);
  assertPublishedSourceBindings(documents, catalog.entries.filter((entry) => entry.delivery_status === "published"));
  assertedStatusIndex(documents.find((document) => document.filename === statusIndex).markdown, blocked);
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

test("production-link parser ignores non-rendered Markdown but rejects visible blocked and legacy links", () => {
  const blocked = "guides/assets/archify/studio/studio-project-workflow.html";
  const visible = "guides/assets/archify/career/career-evidence-workflow.html";
  const onlyVisible = `\`[inline](${blocked})\`\n\n<!-- [comment](${blocked}) -->\n\n<span hidden>[hidden](${blocked})</span>\n\n\`\`\`md\n[code](${blocked})\n\`\`\`\n\n[visible](assets/archify/career/career-evidence-workflow.html)`;
  assert.doesNotThrow(() => assertExactProductionLinks([{ filename: "guides/test.md", markdown: onlyVisible }], [visible]));
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
});

test("status index contract rejects a missing blocked entry", () => {
  const blocked = [{
    id: "career-evidence-workflow", product: "career", diagram_type: "workflow", delivery_status: "blocked-visual",
    spec: "guides/archify-diagrams/specs/career/career-evidence-workflow.json",
  }];
  assert.throws(
    () => assertedStatusIndex("## Published\n\n0개\n\n## Blocked\n\n재시도와 evidence를 확인합니다.", blocked),
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
});
