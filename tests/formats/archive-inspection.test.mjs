import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { deflateRawSync } from "node:zlib";

import { validateOoxmlArchive } from "./lib/ooxml.mjs";
import { openZip } from "./lib/zip.mjs";

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeZip(entries) {
  const locals = [];
  const centrals = [];
  let localOffset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const data = Buffer.from(entry.data ?? "");
    const compression = entry.compression ?? 0;
    const compressed = compression === 8 ? deflateRawSync(data) : data;
    const declaredCompressed = entry.compressedSize ?? compressed.length;
    const declaredUncompressed = entry.uncompressedSize ?? data.length;
    const checksum = entry.crc ?? crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(compression, 8);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(declaredCompressed, 18);
    local.writeUInt32LE(declaredUncompressed, 22);
    local.writeUInt16LE(name.length, 26);
    locals.push(local, name, compressed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(compression, 10);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(declaredCompressed, 20);
    central.writeUInt32LE(declaredUncompressed, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(localOffset, 42);
    centrals.push(central, name);
    localOffset += local.length + name.length + compressed.length;
  }
  const centralBytes = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralBytes.length, 12);
  eocd.writeUInt32LE(localOffset, 16);
  return Buffer.concat([...locals, centralBytes, eocd]);
}

function relationship(id, type, target) {
  return `<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${type}" Target="${target}"/>`;
}

function relationships(...items) {
  return `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${items.join("")}</Relationships>`;
}

const OOXML_CONTENT_TYPES = {
  "word/document.xml": "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml",
  "ppt/presentation.xml": "application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml",
};

function contentTypeFor(part) {
  if (OOXML_CONTENT_TYPES[part]) return OOXML_CONTENT_TYPES[part];
  if (/^ppt\/slides\/slide\d+\.xml$/u.test(part)) return "application/vnd.openxmlformats-officedocument.presentationml.slide+xml";
  if (/^ppt\/notesSlides\/notesSlide\d+\.xml$/u.test(part)) return "application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml";
  return "application/xml";
}

function contentTypeOverride(part, type = contentTypeFor(part)) {
  return `<Override PartName="/${part}" ContentType="${type}"/>`;
}

function contentTypeDocument(...overrides) {
  return `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">${overrides.join("")}</Types>`;
}

function contentTypes(...parts) {
  return contentTypeDocument(...parts.map((part) => contentTypeOverride(part)));
}

function minimalPptx(overrides = {}) {
  const entries = {
    "[Content_Types].xml": contentTypes("ppt/presentation.xml", "ppt/slides/slide1.xml", "ppt/slides/slide2.xml", "ppt/notesSlides/notesSlide1.xml", "ppt/notesSlides/notesSlide2.xml"),
    "_rels/.rels": relationships(relationship("root", "officeDocument", "ppt/presentation.xml")),
    "ppt/presentation.xml": '<p:presentation xmlns:p="p" xmlns:r="r"><p:sldIdLst><p:sldId id="256" r:id="slide-two"/><p:sldId id="257" r:id="slide-one"/></p:sldIdLst></p:presentation>',
    "ppt/_rels/presentation.xml.rels": relationships(relationship("slide-one", "slide", "slides/slide1.xml"), relationship("slide-two", "slide", "slides/slide2.xml")),
    "ppt/slides/slide1.xml": "<p:sld xmlns:p=\"p\"/>",
    "ppt/slides/slide2.xml": "<p:sld xmlns:p=\"p\"/>",
    "ppt/slides/_rels/slide1.xml.rels": relationships(relationship("notes-one", "notesSlide", "../notesSlides/notesSlide1.xml")),
    "ppt/slides/_rels/slide2.xml.rels": relationships(relationship("notes-two", "notesSlide", "../notesSlides/notesSlide2.xml")),
    "ppt/notesSlides/notesSlide1.xml": "<p:notes xmlns:p=\"p\"/>",
    "ppt/notesSlides/notesSlide2.xml": "<p:notes xmlns:p=\"p\"/>",
    "ppt/notesSlides/_rels/notesSlide1.xml.rels": relationships(relationship("back-one", "slide", "../slides/slide1.xml")),
    "ppt/notesSlides/_rels/notesSlide2.xml.rels": relationships(relationship("back-two", "slide", "../slides/slide2.xml")),
    ...overrides,
  };
  return openZip(makeZip(Object.entries(entries).map(([name, data]) => ({ name, data }))));
}

test("OOXML archives expose members and their real UTF-8 document payload", async () => {
  const archive = openZip(await readFile(path.resolve("tests/formats/output/career-entry-12-week-roadmap/brief.docx")));
  assert.equal(validateOoxmlArchive(archive, "docx").root, "word/document.xml");
  assert.ok(archive.members.includes("word/document.xml"));
  const document = archive.read("word/document.xml").toString("utf8");
  assert.match(document, /입문 게임 디자이너 12주 로드맵/u);
  assert.match(document, /result\.json#\/firstPortfolioBrief/u);
});

test("reading a missing OOXML member fails closed", async () => {
  const archive = openZip(await readFile(path.resolve("tests/formats/output/studio-live-service-rpg-economy/brief.pptx")));
  assert.equal(validateOoxmlArchive(archive, "pptx", { expectedSlides: 6 }).notes.length, 6);
  assert.throws(() => archive.read("ppt/missing.xml"), /missing zip member/i);
});

test("ZIP parsing rejects input and entry-count limits before extraction", () => {
  const bytes = makeZip([{ name: "a", data: "a" }, { name: "b", data: "b" }]);
  assert.throws(() => openZip(bytes, { maxInputBytes: bytes.length - 1 }), /input size limit/i);
  assert.throws(() => openZip(bytes, { maxEntries: 1 }), /entry count limit/i);
});

test("ZIP parsing rejects declared single-entry and total uncompressed limits", () => {
  const bytes = makeZip([{ name: "a", data: "12345" }, { name: "b", data: "67890" }]);
  assert.throws(() => openZip(bytes, { maxEntryUncompressedBytes: 4 }), /entry size limit.*a/i);
  assert.throws(() => openZip(bytes, { maxTotalUncompressedBytes: 9 }), /total uncompressed size limit/i);
});

test("ZIP parsing rejects an excessive declared compression ratio", () => {
  const bytes = makeZip([{ name: "bomb", data: "x", uncompressedSize: 101 }]);
  assert.throws(() => openZip(bytes, { maxCompressionRatio: 100 }), /compression ratio limit.*bomb/i);
});

test("deflate extraction is bounded by the declared uncompressed size", () => {
  const bytes = makeZip([{ name: "oversized", data: "A".repeat(4096), compression: 8, uncompressedSize: 8 }]);
  const archive = openZip(bytes, { maxCompressionRatio: 1000 });
  assert.throws(() => archive.read("oversized"), /output length|buffer larger|size mismatch/i);
});

test("ZIP extraction rejects a member whose CRC32 does not match", () => {
  const archive = openZip(makeZip([{ name: "bad-crc", data: "hello", crc: 0 }]));
  assert.throws(() => archive.read("bad-crc"), /CRC32 mismatch.*bad-crc/i);
});

test("OOXML validation follows presentation slide order and paired notes relationships", () => {
  const result = validateOoxmlArchive(minimalPptx(), "pptx", { expectedSlides: 2 });
  assert.deepEqual(result.slides, ["ppt/slides/slide2.xml", "ppt/slides/slide1.xml"]);
  assert.deepEqual(result.notes, ["ppt/notesSlides/notesSlide2.xml", "ppt/notesSlides/notesSlide1.xml"]);
});

test("OOXML validation rejects missing content-type and relationship targets", () => {
  const missingPart = minimalPptx({
    "[Content_Types].xml": contentTypes("ppt/presentation.xml", "ppt/slides/missing.xml"),
  });
  assert.throws(() => validateOoxmlArchive(missingPart, "pptx"), /content types.*missing/i);

  const missingRelationshipTarget = minimalPptx({
    "ppt/slides/_rels/slide1.xml.rels": relationships(relationship("notes-one", "notesSlide", "../notesSlides/missing.xml")),
  });
  assert.throws(() => validateOoxmlArchive(missingRelationshipTarget, "pptx"), /relationship target.*missing/i);
});

test("OOXML validation rejects broken presentation order IDs and notes back-references", () => {
  const duplicateSlideId = minimalPptx({
    "ppt/_rels/presentation.xml.rels": relationships(relationship("slide-two", "slide", "slides/slide1.xml"), relationship("slide-two", "slide", "slides/slide2.xml")),
  });
  assert.throws(() => validateOoxmlArchive(duplicateSlideId, "pptx"), /duplicate relationship ID.*slide-two/i);

  const missingSlideId = minimalPptx({
    "ppt/presentation.xml": '<p:presentation xmlns:p="p" xmlns:r="r"><p:sldIdLst><p:sldId id="256" r:id="unknown"/></p:sldIdLst></p:presentation>',
  });
  assert.throws(() => validateOoxmlArchive(missingSlideId, "pptx"), /slide relationship.*unknown/i);

  const crossedNotes = minimalPptx({
    "ppt/slides/_rels/slide1.xml.rels": relationships(relationship("notes-one", "notesSlide", "../notesSlides/notesSlide2.xml")),
  });
  assert.throws(() => validateOoxmlArchive(crossedNotes, "pptx"), /notes.*back-reference/i);
});

test("OOXML validation checks root and Word document internal relationships", () => {
  const archive = openZip(makeZip([
    { name: "[Content_Types].xml", data: contentTypes("word/document.xml") },
    { name: "_rels/.rels", data: relationships(relationship("root", "officeDocument", "word/document.xml")) },
    { name: "word/document.xml", data: "<w:document xmlns:w=\"w\"/>" },
    { name: "word/_rels/document.xml.rels", data: relationships(relationship("image", "image", "media/missing.png")) },
  ]));
  assert.throws(() => validateOoxmlArchive(archive, "docx"), /relationship target.*word\/media\/missing\.png/i);
});

test("OOXML validation rejects empty, incomplete, incorrect, and duplicate required content-type overrides", () => {
  const entries = {
    "[Content_Types].xml": contentTypes("word/document.xml"),
    "_rels/.rels": relationships(relationship("root", "officeDocument", "word/document.xml")),
    "word/document.xml": "<w:document xmlns:w=\"w\"/>",
    "word/header1.xml": "<w:hdr xmlns:w=\"w\"/>",
  };
  const archiveWith = (contentTypeXml) => openZip(makeZip(Object.entries({ ...entries, "[Content_Types].xml": contentTypeXml }).map(([name, data]) => ({ name, data }))));

  assert.throws(() => validateOoxmlArchive(archiveWith(contentTypes()), "docx"), /content type.*word\/document\.xml/i);
  assert.throws(() => validateOoxmlArchive(archiveWith(contentTypes("word/header1.xml")), "docx"), /content type.*word\/document\.xml/i);
  assert.throws(() => validateOoxmlArchive(archiveWith(contentTypeDocument(contentTypeOverride("word/document.xml", "application/xml"))), "docx"), /content type.*word\/document\.xml/i);
  assert.throws(() => validateOoxmlArchive(archiveWith(contentTypeDocument(contentTypeOverride("word/document.xml"), contentTypeOverride("word/document.xml"))), "docx"), /duplicate content type.*word\/document\.xml/i);
});

test("OOXML validation requires exact presentation, slide, and notes MIME overrides", () => {
  const parts = ["ppt/presentation.xml", "ppt/slides/slide1.xml", "ppt/slides/slide2.xml", "ppt/notesSlides/notesSlide1.xml", "ppt/notesSlides/notesSlide2.xml"];
  const archiveWithWrongType = (wrongPart) => minimalPptx({
    "[Content_Types].xml": contentTypeDocument(...parts.map((part) => contentTypeOverride(part, part === wrongPart ? "application/xml" : contentTypeFor(part)))),
  });

  for (const part of ["ppt/presentation.xml", "ppt/slides/slide1.xml", "ppt/notesSlides/notesSlide1.xml"]) {
    assert.throws(() => validateOoxmlArchive(archiveWithWrongType(part), "pptx"), new RegExp(`content type.*${part.replaceAll("/", "\\/").replaceAll(".", "\\.")}`, "i"));
  }
});

test("OOXML validation reads every member and rejects a bad CRC in non-XML media", () => {
  const archive = openZip(makeZip([
    { name: "[Content_Types].xml", data: contentTypes("word/document.xml") },
    { name: "_rels/.rels", data: relationships(relationship("root", "officeDocument", "word/document.xml")) },
    { name: "word/document.xml", data: "<w:document xmlns:w=\"w\"/>" },
    { name: "word/_rels/document.xml.rels", data: relationships(relationship("image", "image", "media/image1.png")) },
    { name: "word/media/image1.png", data: Buffer.from([0x89, 0x50, 0x4e, 0x47]), crc: 0 },
  ]));

  assert.throws(() => validateOoxmlArchive(archive, "docx"), /CRC32 mismatch.*word\/media\/image1\.png/i);
});

test("OOXML validation traverses nested part relationships and rejects their missing targets", () => {
  const archive = openZip(makeZip([
    { name: "[Content_Types].xml", data: contentTypes("word/document.xml") },
    { name: "_rels/.rels", data: relationships(relationship("root", "officeDocument", "word/document.xml")) },
    { name: "word/document.xml", data: "<w:document xmlns:w=\"w\"/>" },
    { name: "word/_rels/document.xml.rels", data: relationships(relationship("header", "header", "header1.xml")) },
    { name: "word/header1.xml", data: "<w:hdr xmlns:w=\"w\"/>" },
    { name: "word/_rels/header1.xml.rels", data: relationships(relationship("image", "image", "media/missing.png")) },
  ]));

  assert.throws(() => validateOoxmlArchive(archive, "docx"), /relationship target.*word\/media\/missing\.png/i);
});

test("OOXML validation rejects commented spoof elements and malformed XML", () => {
  const base = {
    "word/document.xml": "<w:document xmlns:w=\"w\"/>",
  };
  const archiveWith = (contentTypesXml, rootRelationshipsXml) => openZip(makeZip(Object.entries({
    ...base,
    "[Content_Types].xml": contentTypesXml,
    "_rels/.rels": rootRelationshipsXml,
  }).map(([name, data]) => ({ name, data }))));

  assert.throws(
    () => validateOoxmlArchive(archiveWith(
      contentTypes("word/document.xml"),
      relationships("<!--", relationship("root", "officeDocument", "word/document.xml"), "-->"),
    ), "docx"),
    /XML|comment/i,
  );
  assert.throws(
    () => validateOoxmlArchive(archiveWith(
      contentTypeDocument(`<!--${contentTypeOverride("word/document.xml")}-->`),
      relationships(relationship("root", "officeDocument", "word/document.xml")),
    ), "docx"),
    /XML|comment|content type/i,
  );
  assert.throws(
    () => validateOoxmlArchive(archiveWith(
      "<Types><Override PartName=\"/word/document.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml\"></Types>",
      relationships(relationship("root", "officeDocument", "word/document.xml")),
    ), "docx"),
    /XML|mismatch|unclosed/i,
  );
  assert.throws(
    () => validateOoxmlArchive(archiveWith(
      `${contentTypes("word/document.xml")}<extra/>`,
      relationships(relationship("root", "officeDocument", "word/document.xml")),
    ), "docx"),
    /XML|root/i,
  );
});
