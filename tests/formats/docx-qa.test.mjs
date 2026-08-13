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
  assert.equal((transformed.match(/class="qa-docx-page-top-spacer"/g) ?? []).length, 2);
  assert.doesNotMatch(transformed, /\f/);
  assert.match(transformed, /첫 페이지/);
  assert.match(transformed, /셋째 페이지/);
});

test("Quick Look DOCX HTML rejects input without a document head", () => {
  assert.throws(() => transformQuickLookHtml("<p>문서</p>"), /head/i);
});

test("Quick Look DOCX page furniture repeats through fixed print regions", () => {
  const source = [
    '<html><head><meta charset="utf-8"></head><body><div class="document">',
    '<style>.header{font-size:8px}</style>',
    '<div><p class="header"><span>라이브 서비스 RPG 경제 운영 브리프</span></p></div>',
    '<p>첫 페이지</p><p><span>\f</span></p><p>둘째 페이지</p>',
    '<style>.footer{text-align:right}</style>',
    '<p class="footer"><span>Task 11 · format harness</span></p>',
    '</div></body></html>',
  ].join("");

  const transformed = transformQuickLookHtml(source, {
    headerText: "라이브 서비스 RPG 경제 운영 브리프",
    footerText: "Task 11 · format harness",
  });

  assert.equal((transformed.match(/class="qa-docx-header"/gu) ?? []).length, 1);
  assert.equal((transformed.match(/class="qa-docx-footer"/gu) ?? []).length, 1);
  assert.match(transformed, /\.qa-docx-header\s*\{[^}]*position:\s*fixed[^}]*top:\s*35px/isu);
  assert.match(transformed, /\.qa-docx-footer\s*\{[^}]*position:\s*fixed[^}]*bottom:\s*35px/isu);
  assert.match(transformed, /\.qa-docx-page-top-spacer\s*\{[^}]*height:\s*55px/isu);
  assert.match(transformed, /<header class="qa-docx-header"><p class="header">/u);
  assert.match(transformed, /<footer class="qa-docx-footer"><p class="footer">/u);
  assert.doesNotMatch(transformed, /<div><p class="header">/u);
});

test("Quick Look DOCX page furniture fails closed when an expected region is missing or ambiguous", () => {
  const missingFooter = '<html><head></head><body><div><p><span>문서 제목</span></p></div><p>본문</p></body></html>';
  assert.throws(
    () => transformQuickLookHtml(missingFooter, { headerText: "문서 제목", footerText: "검수 꼬리말" }),
    /footer/i,
  );

  const duplicateHeader = '<html><head></head><body><div><p><span>문서 제목</span></p></div><div><p><span>문서 제목</span></p></div><p><span>검수 꼬리말</span></p></body></html>';
  assert.throws(
    () => transformQuickLookHtml(duplicateHeader, { headerText: "문서 제목", footerText: "검수 꼬리말" }),
    /header/i,
  );
});

test("Career DOCX week table preserves explicit week labels and cell margins at column boundaries", async () => {
  const docx = openZip(await readFile(path.resolve("tests/formats/output/career-entry-12-week-roadmap/brief.docx")));
  const document = docx.read("word/document.xml").toString("utf8");
  assert.match(document, /<w:t>10주<\/w:t>/u);
  assert.match(document, /<w:tcMar>.*?<w:left\b[^>]*w:w="120".*?<w:right\b[^>]*w:w="120".*?<\/w:tcMar>/u);
});

test("Studio DOCX keeps the inventory sentence together with an intentional line break", async () => {
  const docx = openZip(await readFile(path.resolve("tests/formats/output/studio-live-service-rpg-economy/brief.docx")));
  const document = docx.read("word/document.xml").toString("utf8");
  assert.match(
    document,
    /<w:t>일일 미션에서 소프트 재화를 공급하고 업그레이드에서 소비한다\.<\/w:t><\/w:r><w:r><w:br\/><\/w:r><w:r>.*?<w:t>목표 보유량은 5,000이다\.<\/w:t>/u,
  );
});
