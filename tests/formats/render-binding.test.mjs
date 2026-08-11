import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmod, copyFile, cp, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { inspectPdfArtifact, validateRenderBindingManifest, verifyFreshRenderBindings } from "./lib/render-bindings.mjs";
import { resolveRuntime } from "./lib/runtime-resolver.mjs";

test("PDF inspection binds exact page count, Korean text, and page source sets", async () => {
  const runtime = await resolveRuntime();
  const result = inspectPdfArtifact({
    filename: path.resolve("tests/formats/output/career-entry-12-week-roadmap/brief.pdf"),
    commands: runtime.commands,
    expectedPages: 4,
    anchors: ["12주", "주 8시간", "시스템 디자인", "증거 대기"],
    expectedPageSources: [
      ["request.json#/availableHoursPerWeek"],
      ["result.json#/roleCandidates", "result.json#/evidenceGaps"],
      ["result.json#/weeks"],
      ["result.json#/firstPortfolioBrief"],
    ],
    expectedPageTextSha256: [
      "ea4c96250de1fff51cbcfacb7022720ad3625b25257f8f9fc2ce88a3d89b91ba",
      "03984676058b865fe69988b79c0aa08e5afa081b3ac79408878cdf863412cbce",
      "139094522dc58f80e61e78a485b92cf0a0e991839b64ccd447013074c673176b",
      "de7fc4033ecb57819afabd89be4ba34cc8bf8f573b3763536fbfb92a1ce6f81d",
    ],
  });
  assert.equal(result.pages, 4);
});

test("PDF inspection rejects semantic text changes that preserve anchors and source pointers", async (t) => {
  const runtime = await resolveRuntime();
  const filename = path.resolve("tests/formats/output/career-entry-12-week-roadmap/brief.pdf");
  const extracted = execFileSync(runtime.commands.pdftotext, ["-layout", filename, "-"], { encoding: "utf8" });
  const expectedPageTextSha256 = [
    "ea4c96250de1fff51cbcfacb7022720ad3625b25257f8f9fc2ce88a3d89b91ba",
    "03984676058b865fe69988b79c0aa08e5afa081b3ac79408878cdf863412cbce",
    "139094522dc58f80e61e78a485b92cf0a0e991839b64ccd447013074c673176b",
    "de7fc4033ecb57819afabd89be4ba34cc8bf8f573b3763536fbfb92a1ce6f81d",
  ];
  const inspect = (pdftotext) => inspectPdfArtifact({
    filename,
    commands: { ...runtime.commands, pdftotext },
    expectedPages: 4,
    anchors: ["12주", "주 8시간", "시스템 디자인", "증거 대기"],
    expectedPageSources: [
      ["request.json#/availableHoursPerWeek"],
      ["result.json#/roleCandidates", "result.json#/evidenceGaps"],
      ["result.json#/weeks"],
      ["result.json#/firstPortfolioBrief"],
    ],
    expectedPageTextSha256,
  });
  assert.doesNotThrow(() => inspect(runtime.commands.pdftotext));

  const fakeExtractor = async (label, text) => {
    const root = await mkdtemp(path.join(tmpdir(), `format-pdf-text-${label}-`));
    const executable = path.join(root, "pdftotext.mjs");
    await writeFile(executable, `#!/usr/bin/env node\nprocess.stdout.write(${JSON.stringify(text)});\n`);
    await chmod(executable, 0o755);
    return executable;
  };
  const noisy = extracted.normalize("NFD").replaceAll("\n", " \t\r\n\r\n");
  const noisyExtractor = await fakeExtractor("noise", noisy);
  assert.doesNotThrow(() => inspect(noisyExtractor));

  const mutations = [
    ["body", "One resource only", "Unlimited resources"],
    ["number", "three observed sessions", "zero observed sessions"],
    ["negation", "cannot predict recovery", "can predict recovery"],
  ];
  for (const [label, original, replacement] of mutations) {
    await t.test(label, async () => {
      assert.match(extracted, new RegExp(original, "u"));
      const fakePdftotext = await fakeExtractor(label, extracted.replace(original, replacement));
      assert.throws(() => inspect(fakePdftotext), /PDF page text digest/i);
    });
  }
});

test("PDF inspection rejects a signature-only fake instead of trusting its manifest digest", async () => {
  const runtime = await resolveRuntime();
  const root = await mkdtemp(path.join(tmpdir(), "format-fake-pdf-"));
  const filename = path.join(root, "brief.pdf");
  await writeFile(filename, "%PDF-1.7\n%%EOF\n");
  assert.throws(() => inspectPdfArtifact({
    filename,
    commands: runtime.commands,
    expectedPages: 4,
    anchors: ["12주"],
    expectedPageSources: [["request.json#/availableHoursPerWeek"]],
  }), /PDF (inspection|page|text)/i);
});

function setDigest(entries) {
  return createHash("sha256").update(entries.map(([filename, digest]) => `${filename}:${digest}`).sort().join("\n")).digest("hex");
}

test("render binding couples every QA digest and attestation set to the exact artifact digest", () => {
  const artifactDigests = { "brief.pdf": "a".repeat(64), "brief.docx": "b".repeat(64), "brief.pptx": "c".repeat(64), "visualization.svg": "d".repeat(64) };
  const qaDigests = { "pdf/page-1.png": "1".repeat(64), "docx/page-1.png": "2".repeat(64), "pptx/slide-1.png": "3".repeat(64), "visualization.png": "4".repeat(64) };
  const lane = (artifact, qaPath) => ({ artifact, artifactSha256: artifactDigests[artifact], qaFiles: [{ path: qaPath, sha256: qaDigests[qaPath] }] });
  const manifest = {
    renderBinding: {
      pdf: lane("brief.pdf", "pdf/page-1.png"),
      docx: lane("brief.docx", "docx/page-1.png"),
      pptx: lane("brief.pptx", "pptx/slide-1.png"),
      visualization: lane("visualization.svg", "visualization.png"),
    },
    visualAttestation: {
      artifactSetSha256: setDigest(Object.entries(artifactDigests)),
      qaSetSha256: setDigest(Object.entries(qaDigests)),
    },
  };
  assert.doesNotThrow(() => validateRenderBindingManifest({ manifest, artifactDigests, qaDigests }));
  manifest.renderBinding.pdf.artifactSha256 = "f".repeat(64);
  assert.throws(() => validateRenderBindingManifest({ manifest, artifactDigests, qaDigests }), /render binding.*artifact digest/i);
});

test("fresh Skillstead rerender rejects a substituted PNG even if editable proof files changed with it", async () => {
  const runtime = await resolveRuntime();
  const outputDir = path.resolve("tests/formats/output/career-entry-12-week-roadmap");
  const qaDir = path.resolve("tests/formats/qa/career-entry-12-week-roadmap");
  await assert.doesNotReject(verifyFreshRenderBindings({ caseInfo: { product: "career" }, outputDir, qaDir, runtime, lanes: ["visualization"] }));

  const substituted = await mkdtemp(path.join(tmpdir(), "format-substituted-qa-"));
  await mkdir(substituted, { recursive: true });
  await copyFile(path.join(qaDir, "visualization.svg"), path.join(substituted, "visualization.svg"));
  await copyFile(path.resolve("tests/formats/qa/studio-live-service-rpg-economy/visualization.png"), path.join(substituted, "visualization.png"));
  await assert.rejects(
    verifyFreshRenderBindings({ caseInfo: { product: "career" }, outputDir, qaDir: substituted, runtime, lanes: ["visualization"] }),
    /fresh render.*visualization\.png/i,
  );
});

test("fresh PDF rerender rejects a substituted committed page image", async () => {
  const runtime = await resolveRuntime();
  const outputDir = path.resolve("tests/formats/output/career-entry-12-week-roadmap");
  const qaDir = path.resolve("tests/formats/qa/career-entry-12-week-roadmap");
  await assert.doesNotReject(verifyFreshRenderBindings({
    caseInfo: { product: "career", expectedPages: { pdf: 4 } }, outputDir, qaDir, runtime, lanes: ["pdf"],
  }));

  const substituted = await mkdtemp(path.join(tmpdir(), "format-substituted-pdf-"));
  await cp(path.join(qaDir, "pdf"), path.join(substituted, "pdf"), { recursive: true });
  await copyFile(path.resolve("tests/formats/qa/studio-live-service-rpg-economy/pdf/page-1.png"), path.join(substituted, "pdf", "page-1.png"));
  await assert.rejects(
    verifyFreshRenderBindings({ caseInfo: { product: "career", expectedPages: { pdf: 4 } }, outputDir, qaDir: substituted, runtime, lanes: ["pdf"] }),
    /fresh render.*pdf\/page-1\.png/i,
  );
});

test("fresh DOCX rerender rejects a substituted committed page image", async () => {
  const runtime = await resolveRuntime();
  const outputDir = path.resolve("tests/formats/output/career-entry-12-week-roadmap");
  const qaDir = path.resolve("tests/formats/qa/career-entry-12-week-roadmap");
  await assert.doesNotReject(verifyFreshRenderBindings({
    caseInfo: { product: "career", caseId: "career-entry-12-week-roadmap", title: "입문 게임 디자이너 12주 로드맵", expectedPages: { docx: 4 } }, outputDir, qaDir, runtime, lanes: ["docx"],
  }));
  const substituted = await mkdtemp(path.join(tmpdir(), "format-substituted-docx-"));
  await cp(path.join(qaDir, "docx"), path.join(substituted, "docx"), { recursive: true });
  await copyFile(path.resolve("tests/formats/qa/studio-live-service-rpg-economy/docx/page-1.png"), path.join(substituted, "docx", "page-1.png"));
  await assert.rejects(
    verifyFreshRenderBindings({ caseInfo: { product: "career", caseId: "career-entry-12-week-roadmap", title: "입문 게임 디자이너 12주 로드맵", expectedPages: { docx: 4 } }, outputDir, qaDir: substituted, runtime, lanes: ["docx"] }),
    /fresh render.*docx\/page-1\.png/i,
  );
});

test("fresh saved-PPTX rerender rejects a substituted committed slide image", async () => {
  const runtime = await resolveRuntime();
  const outputDir = path.resolve("tests/formats/output/career-entry-12-week-roadmap");
  const qaDir = path.resolve("tests/formats/qa/career-entry-12-week-roadmap");
  await assert.doesNotReject(verifyFreshRenderBindings({
    caseInfo: { product: "career", caseId: "career-entry-12-week-roadmap", expectedSlides: 6 }, outputDir, qaDir, runtime, lanes: ["pptx"],
  }));
  const substituted = await mkdtemp(path.join(tmpdir(), "format-substituted-pptx-"));
  await cp(path.join(qaDir, "pptx"), path.join(substituted, "pptx"), { recursive: true });
  await copyFile(path.resolve("tests/formats/qa/studio-live-service-rpg-economy/pptx/slide-1.png"), path.join(substituted, "pptx", "slide-1.png"));
  await assert.rejects(
    verifyFreshRenderBindings({ caseInfo: { product: "career", caseId: "career-entry-12-week-roadmap", expectedSlides: 6 }, outputDir, qaDir: substituted, runtime, lanes: ["pptx"] }),
    /fresh render.*pptx\/slide-1\.png/i,
  );
});
