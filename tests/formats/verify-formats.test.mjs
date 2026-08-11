import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  assertPortableManifest,
  assertKorean,
  inspectPng,
  resolveJsonSourcePointers,
  validateAttestation,
  validateExactSourceSets,
  validateOrderedMarkers,
  validatePdfSignature,
  validateSourceDigests,
  validateZipMembers,
} from "./lib/inspectors.mjs";
import { verifyFormats } from "./verify-formats.mjs";
import { resolveRuntime } from "./lib/runtime-resolver.mjs";

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

test("every declared JSON source pointer resolves against the digest-bound source", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "format-pointers-"));
  await writeFile(path.join(root, "request.json"), '{"availableHoursPerWeek":8,"roles":[{"id":"systems"}]}\n');
  await assert.doesNotReject(resolveJsonSourcePointers(root, [
    "request.json#/availableHoursPerWeek",
    "request.json#/roles/0/id",
  ], ["request.json"]));
  await assert.rejects(
    resolveJsonSourcePointers(root, ["request.json#/", "request.json#/roles/2"], ["request.json"]),
    /JSON pointer.*does not resolve/i,
  );
  await assert.rejects(
    resolveJsonSourcePointers(root, ["other.json#/value"], ["request.json"]),
    /undeclared source/i,
  );
});

test("portable manifests reject POSIX, Windows, UNC, and file URL host paths recursively", () => {
  assert.doesNotThrow(() => assertPortableManifest({ runtime: { sourceClass: "official-cache" }, files: ["brief.pdf"] }));
  for (const exposed of [
    "/private/tmp/render.pdf",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "C:\\Users\\tester\\render.pdf",
    "\\\\server\\share\\render.pdf",
    "file:///tmp/render.pdf",
  ]) {
    assert.throws(() => assertPortableManifest({ nested: { exposed } }), /absolute host path/i, exposed);
  }
});

test("portable manifests reject embedded and encoded host path tokens without rejecting portable text", () => {
  for (const portable of [
    "result.json#/domain/economy",
    "schema version v1.2.3",
    "Render artifacts are reproducible across supported environments.",
    "https://example.com/reference/result.json",
  ]) {
    assert.doesNotThrow(() => assertPortableManifest({ portable }), portable);
  }

  for (const exposed of [
    "renderer=/Applications/Google Chrome.app/Contents/MacOS/Google Chrome (local)",
    "owner home: /Users/tester/project/output.pdf.",
    "temporary output [/private/tmp/render.pdf]",
    "workspace output: /workspace/game-design/render.pdf",
    "root=/workspace",
    "cwd:/workspace/game",
    "renderer=C:\\Users\\tester\\render.exe (local)",
    "artifact=\\\\server\\share\\render.pdf#preview",
    "preview=file:///private/tmp/render.pdf (local)",
    "preview=file%3A%2F%2F%2Fprivate%2Ftmp%2Frender.pdf",
    "temporary output=%2Fprivate%2Ftmp%2Frender.pdf",
    "workspace output=%2Fworkspace%2Fgame-design%2Frender.pdf",
    "root=%2Fworkspace",
    "owner home: %252FUsers%252Ftester%252Fproject",
  ]) {
    assert.throws(() => assertPortableManifest({ nested: { exposed } }), /absolute host path/i, exposed);
  }
});

test("page and slide source bindings reject cross-section and extra pointers", () => {
  const expected = [["request.json#/availableHoursPerWeek"], ["result.json#/roleCandidates"]];
  assert.doesNotThrow(() => validateExactSourceSets(expected, expected, "slide sources"));
  assert.throws(
    () => validateExactSourceSets([["result.json#/roleCandidates"], ["request.json#/availableHoursPerWeek"]], expected, "slide sources"),
    /slide sources.*does not match/i,
  );
  assert.throws(
    () => validateExactSourceSets([[...expected[0], "result.json#/weeks"], expected[1]], expected, "slide sources"),
    /slide sources.*does not match/i,
  );
});

test("PDF signature and Korean anchors are hard gates", () => {
  assert.throws(() => validatePdfSignature(Buffer.from("not pdf")), /PDF signature/);
  assert.doesNotThrow(() => validatePdfSignature(Buffer.from("%PDF-1.7\n")));
  assert.throws(() => assertKorean("ascii only", ["한국어"]), /Korean anchor/);
});

test("Career PDF keeps stable evidence IDs on one visual line", async () => {
  const runtime = await resolveRuntime();
  const result = spawnSync(runtime.commands.pdftotext, [
    "-layout", "-f", "2", "-l", "2",
    path.resolve("tests/formats/output/career-entry-12-week-roadmap/brief.pdf"),
    "-",
  ], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /gap-playtest-learning/u);
  assert.doesNotMatch(result.stdout, /gap-playtest-learnin\s*\ng/u);
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
