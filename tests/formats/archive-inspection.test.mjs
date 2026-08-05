import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { openZip } from "./lib/zip.mjs";

test("OOXML archives expose members and their real UTF-8 document payload", async () => {
  const archive = openZip(await readFile(path.resolve("tests/formats/output/career-entry-12-week-roadmap/brief.docx")));
  assert.ok(archive.members.includes("word/document.xml"));
  const document = archive.read("word/document.xml").toString("utf8");
  assert.match(document, /입문 게임 디자이너 12주 로드맵/u);
  assert.match(document, /result\.json#\/firstPortfolioBrief/u);
});

test("reading a missing OOXML member fails closed", async () => {
  const archive = openZip(await readFile(path.resolve("tests/formats/output/studio-live-service-rpg-economy/brief.pptx")));
  assert.throws(() => archive.read("ppt/missing.xml"), /missing zip member/i);
});
