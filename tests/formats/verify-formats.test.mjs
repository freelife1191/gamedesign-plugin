import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  assertKorean,
  inspectPng,
  validateAttestation,
  validateOrderedMarkers,
  validatePdfSignature,
  validateSourceDigests,
  validateZipMembers,
} from "./lib/inspectors.mjs";
import { verifyFormats } from "./verify-formats.mjs";

test("missing committed outputs are rejected", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "format-empty-"));
  await assert.rejects(verifyFormats(root), /missing.*output|manifest/i);
});

test("committed representative outputs pass complete artifact and visual proof", async () => {
  const result = await verifyFormats();
  assert.equal(result.ok, true);
  assert.deepEqual(result.cases.map(({ validatedArtifacts }) => validatedArtifacts), [6, 6]);
  assert.deepEqual(result.cases.map(({ inspectedImages }) => inspectedImages), [15, 15]);
});

test("source drift is rejected", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "format-source-"));
  await writeFile(path.join(root, "source.json"), "{}\n");
  await assert.rejects(validateSourceDigests(root, { "source.json": "0".repeat(64) }), /source drift/i);
});

test("PDF signature and Korean anchors are hard gates", () => {
  assert.throws(() => validatePdfSignature(Buffer.from("not pdf")), /PDF signature/);
  assert.doesNotThrow(() => validatePdfSignature(Buffer.from("%PDF-1.7\n")));
  assert.throws(() => assertKorean("ascii only", ["한국어"]), /Korean anchor/);
});

test("truncated PNG and wrong dimensions are rejected", async () => {
  const fixture = path.resolve("tests/e2e/career/entry-12-week-roadmap/competency-map.svg");
  assert.ok((await readFile(fixture)).length > 0);
  assert.throws(() => inspectPng(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), /truncated PNG/);
  const root = await mkdtemp(path.join(tmpdir(), "format-png-"));
  const png = Buffer.from("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000049454e44ae426082", "hex");
  await writeFile(path.join(root, "tiny.png"), png);
  assert.throws(() => inspectPng(png, { width: 1920, height: 1080 }), /PNG dimensions/);
});

test("broken OOXML relationships and missing required members are rejected", () => {
  assert.throws(() => validateZipMembers(["[Content_Types].xml"], "docx"), /word\/document.xml/);
  assert.throws(() => validateZipMembers(["[Content_Types].xml", "ppt/presentation.xml", "ppt/slides/slide1.xml"], "pptx", 6), /slide count/);
});

test("page, slide, dimension, Korean, and visual attestation must be bound", () => {
  assert.throws(() => validateAttestation({ status: "approved", pageCount: 3, slideCount: 6, png: { width: 1920, height: 1080 }, inspectedImages: [] }, { pageCount: 4, slideCount: 6 }), /page count/);
  assert.throws(() => validateAttestation({ status: "approved", pageCount: 4, slideCount: 5, png: { width: 1920, height: 1080 }, inspectedImages: [] }, { pageCount: 4, slideCount: 6 }), /slide count/);
  assert.throws(() => validateAttestation({ status: "approved", pageCount: 4, slideCount: 6, png: { width: 960, height: 540 }, inspectedImages: [] }, { pageCount: 4, slideCount: 6 }), /PNG dimensions/);
  assert.throws(() => validateAttestation({ status: "approved", pageCount: 4, slideCount: 6, png: { width: 1920, height: 1080 }, inspectedImages: [] }, { pageCount: 4, slideCount: 6 }), /visual attestation/);
});

test("section source markers reject an off-by-one mapping", () => {
  const expected = [
    "result.json#/domain/economy",
    "result.json#/domain/economy",
    "result.json#/domain/experiment",
    "result.json#/domain/rollback",
  ];
  assert.doesNotThrow(() => validateOrderedMarkers(expected.join("\n"), expected));
  assert.throws(
    () => validateOrderedMarkers([
      "result.json#/domain/economy",
      "result.json#/domain/experiment",
      "result.json#/domain/rollback",
      "approval-snapshot.json#/responsibleGates",
    ].join("\n"), expected),
    /source marker/i,
  );
});
