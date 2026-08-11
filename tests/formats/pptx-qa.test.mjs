import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { transformQuickLookPptxHtml } from "./lib/pptx-qa.mjs";

const SAMPLE = '<html><head><meta charset="utf-8"><style>div.slide { width:960; height:540;} .title {font-size:24;}</style></head><body><div class="slide" style="top:0; left:0;"><p>첫 슬라이드</p><img src="Attachment1.pdf"></div><style>.x{width:200;}</style><div class="slide" style="top:0; left:0;"><p>둘째 슬라이드</p></div></body></html>';

test("Quick Look PPTX HTML becomes one Chromium screenshot page with explicit pixel geometry", () => {
  const transformed = transformQuickLookPptxHtml(SAMPLE, { slideNumber: 2, attachmentNames: ["Attachment1.pdf"] });
  assert.match(transformed, /width:\s*960px/u);
  assert.match(transformed, /height:\s*540px/u);
  assert.match(transformed, /font-size:\s*24px/u);
  assert.match(transformed, /top:\s*0px/u);
  assert.match(transformed, /body\s*>\s*div\.slide:nth-of-type\(2\)/u);
  assert.match(transformed, /Attachment1\.png/u);
  assert.match(transformed, /둘째 슬라이드/u);
});

test("Quick Look PPTX conversion fails closed for unknown attachments and slide bounds", () => {
  assert.throws(() => transformQuickLookPptxHtml(SAMPLE, { slideNumber: 0, attachmentNames: ["Attachment1.pdf"] }), /slide number/i);
  assert.throws(() => transformQuickLookPptxHtml(SAMPLE, { slideNumber: 3, attachmentNames: ["Attachment1.pdf"] }), /slide number/i);
  assert.throws(() => transformQuickLookPptxHtml(SAMPLE, { slideNumber: 1, attachmentNames: [] }), /undeclared attachment/i);
});

test("PPTX generator uses Quick Look-native rectangles for QA-critical geometry", async () => {
  const source = await readFile(new URL("./generators/generate_presentation.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(source, /roundRect/u, "rounded geometry becomes cross-slide PDF attachments in Quick Look");
});

test("representative half-slide copy declares readable phrase-boundary line breaks", async () => {
  for (const caseId of ["studio-live-service-rpg-economy", "career-entry-12-week-roadmap"]) {
    const spec = JSON.parse(await readFile(new URL(`./fixtures/${caseId}/presentation.json`, import.meta.url), "utf8"));
    const half = spec.slides.find(({ layout }) => layout === "half");
    const lines = half.body.split("\n");
    assert.ok(lines.length >= 2, `${caseId}: half-slide body needs deliberate line breaks`);
    assert.ok(lines.every((line) => [...line].length <= 30), `${caseId}: half-slide line exceeds 30 characters`);
    assert.ok(lines.every((line) => !/\s$/u.test(line)), `${caseId}: half-slide line has trailing whitespace`);
  }
});
