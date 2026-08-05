import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { transformQuickLookHtml } from "./lib/docx-qa.mjs";
import { openZip } from "./lib/zip.mjs";

test("Quick Look DOCX HTML becomes paged Chromium input without losing Korean", () => {
  const source = '<html><head><meta charset="utf-8"></head><body><p>첫 페이지</p><p><span>\f</span></p><p>둘째 페이지</p><p class="x"><span class="y">\f</span></p><p>셋째 페이지</p></body></html>';
  const transformed = transformQuickLookHtml(source);

  assert.match(transformed, /@page\s*\{\s*size:\s*8\.5in 11in;\s*margin:\s*0/);
  assert.equal((transformed.match(/break-after:\s*page/g) ?? []).length, 2);
  assert.doesNotMatch(transformed, /\f/);
  assert.match(transformed, /첫 페이지/);
  assert.match(transformed, /셋째 페이지/);
});

test("Quick Look DOCX HTML rejects input without a document head", () => {
  assert.throws(() => transformQuickLookHtml("<p>문서</p>"), /head/i);
});

test("Career DOCX week table preserves explicit week labels and cell margins at column boundaries", async () => {
  const docx = openZip(await readFile(path.resolve("tests/formats/output/career-entry-12-week-roadmap/brief.docx")));
  const document = docx.read("word/document.xml").toString("utf8");
  assert.match(document, /<w:t>10주<\/w:t>/u);
  assert.match(document, /<w:tcMar>.*?<w:left\b[^>]*w:w="120".*?<w:right\b[^>]*w:w="120".*?<\/w:tcMar>/u);
});
