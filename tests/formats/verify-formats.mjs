#!/usr/bin/env node

import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  assertPortableManifest,
  assertKorean,
  inspectPng,
  resolveJsonSourcePointers,
  sha256,
  validateAttestation,
  validateExactSourceSets,
  validateOrderedMarkers,
  validatePdfSignature,
  validateSourceDigests,
} from "./lib/inspectors.mjs";
import { validateOoxmlArchive } from "./lib/ooxml.mjs";
import { inspectPdfArtifact, validateRenderBindingManifest, verifyFreshRenderBindings } from "./lib/render-bindings.mjs";
import { resolveRuntime } from "./lib/runtime-resolver.mjs";
import { openZip } from "./lib/zip.mjs";

const CASE_IDS = ["studio-live-service-rpg-economy", "career-entry-12-week-roadmap"];
const ARTIFACTS = ["brief.md", "brief.pdf", "brief.docx", "brief.pptx", "visualization.svg", "visualization.png"];
const FORMATS_ROOT = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(FORMATS_ROOT, "../..");

function sameArray(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${label} does not match the required contract`);
}

function xmlText(bytes) {
  return Buffer.from(bytes).toString("utf8")
    .replace(/<[^>]+>/gu, " ")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'");
}

async function filenames(root, pattern) {
  return (await readdir(root)).filter((name) => pattern.test(name)).sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
}

async function validateMarkdownLinks(markdown, outputDir) {
  for (const match of markdown.matchAll(/\]\(([^)]+)\)/gu)) {
    const target = match[1].trim();
    if (!target || /^(?:https?:|#)/iu.test(target)) continue;
    const absolute = path.resolve(outputDir, target);
    if (!absolute.startsWith(`${outputDir}${path.sep}`)) throw new Error(`Markdown link escapes output root: ${target}`);
    try { await access(absolute); } catch { throw new Error(`Markdown link target is missing: ${target}`); }
  }
}

async function validateQa(caseInfo, qaDir, attestation) {
  const pdfNames = await filenames(path.join(qaDir, "pdf"), /^page-\d+\.png$/u);
  const docxNames = await filenames(path.join(qaDir, "docx"), /^page-\d+\.png$/u);
  const slideNames = await filenames(path.join(qaDir, "pptx"), /^slide-\d+\.png$/u);
  if (pdfNames.length !== caseInfo.expectedPages.pdf) throw new Error(`${caseInfo.caseId} PDF QA page count mismatch`);
  if (docxNames.length !== caseInfo.expectedPages.docx) throw new Error(`${caseInfo.caseId} DOCX QA page count mismatch`);
  if (slideNames.length !== caseInfo.expectedSlides) throw new Error(`${caseInfo.caseId} PPTX QA slide count mismatch`);
  const relative = [
    ...pdfNames.map((name) => `pdf/${name}`),
    ...docxNames.map((name) => `docx/${name}`),
    ...slideNames.map((name) => `pptx/${name}`),
    "visualization.png",
  ];
  sameArray(attestation.inspectedImages, relative, `${caseInfo.caseId} inspected image list`);
  const hashes = [];
  const qaDigests = {};
  for (const filename of relative) {
    const bytes = await readFile(path.join(qaDir, filename));
    const expected = filename === "visualization.png" ? { width: 1920, height: 1080 } : undefined;
    inspectPng(bytes, expected);
    const digest = sha256(bytes);
    hashes.push(digest);
    qaDigests[filename] = digest;
  }
  if (new Set(hashes).size !== hashes.length) throw new Error(`${caseInfo.caseId} QA images contain a duplicate render`);
  const docxPdf = await readFile(path.join(qaDir, "docx", "brief.pdf"));
  validatePdfSignature(docxPdf);
  qaDigests["docx/brief.pdf"] = sha256(docxPdf);
  qaDigests["visualization.svg"] = sha256(await readFile(path.join(qaDir, "visualization.svg")));
  return { inspectedImages: relative.length, qaDigests };
}

function pointerList(text) {
  return [...String(text).matchAll(/[A-Za-z0-9._/-]+#[A-Za-z0-9_~./-]*/gu)].map((match) => match[0]);
}

function docxPageSourceSets(documentXml, expectedPages) {
  const pages = documentXml.split(/<w:br\b[^>]*\bw:type=["']page["'][^>]*\/?\s*>/gu);
  if (pages.length !== expectedPages) throw new Error(`DOCX page source split ${pages.length} does not match ${expectedPages}`);
  return pages.map((page) => pointerList(xmlText(page)));
}

function noteSourceSets(pptx, notes) {
  return notes.map((name) => {
    const text = xmlText(pptx.read(name));
    if (!text.includes("[Sources]")) throw new Error(`speaker notes sources are missing: ${name}`);
    return pointerList(text);
  });
}

async function validateCase({ caseId, outputRoot, fixtureRoot, qaRoot, runtime }) {
  const outputDir = path.join(outputRoot, caseId);
  const fixtureDir = path.join(fixtureRoot, caseId);
  const qaDir = path.join(qaRoot, caseId);
  const manifestPath = path.join(outputDir, "artifact-manifest.json");
  try { await access(manifestPath); } catch { throw new Error(`missing output manifest: ${caseId}/artifact-manifest.json`); }
  const caseInfo = JSON.parse(await readFile(path.join(fixtureDir, "case.json"), "utf8"));
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  if (manifest.schemaVersion !== 1 || manifest.caseId !== caseId) throw new Error(`${caseId} manifest identity mismatch`);
  assertPortableManifest(manifest);
  sameArray(manifest.canonicalExportManifest?.formats, ["md", "pdf", "docx", "pptx"], `${caseId} canonical formats`);
  sameArray(manifest.visualizationLane?.formats, ["svg", "png"], `${caseId} visualization formats`);
  if (manifest.visualizationLane?.lint !== "passed") throw new Error(`${caseId} Skillstead lint is not passed`);
  if (manifest.presentation?.artifactToolOnly !== true || manifest.presentation?.overflowTest !== "passed") throw new Error(`${caseId} presentation proof is incomplete`);
  if (manifest.runtime?.docxVisualRenderer !== "macOS-quick-look-html+chromium-print") throw new Error(`${caseId} DOCX visual renderer is not bound`);

  sameArray(Object.keys(manifest.artifacts ?? {}), ARTIFACTS, `${caseId} artifact set`);
  const artifactDigests = {};
  for (const filename of ARTIFACTS) {
    const bytes = await readFile(path.join(outputDir, filename));
    artifactDigests[filename] = sha256(bytes);
    if (manifest.artifacts[filename]?.sha256 !== artifactDigests[filename]) throw new Error(`${caseId} artifact digest mismatch: ${filename}`);
  }
  const sourceRoot = path.resolve(REPO_ROOT, caseInfo.sourceRoot);
  await validateSourceDigests(sourceRoot, caseInfo.sources);
  if (JSON.stringify(manifest.sourceBinding?.files) !== JSON.stringify(caseInfo.sources)) throw new Error(`${caseId} source binding mismatch`);
  sameArray(manifest.sourceBinding?.pointers, caseInfo.sourcePointers, `${caseId} declared source pointers`);
  const presentation = JSON.parse(await readFile(path.join(fixtureDir, "presentation.json"), "utf8"));
  validateExactSourceSets(presentation.slides?.map((slide) => slide.sources), caseInfo.expectedSlideSources, `${caseId} presentation source sets`);
  const usedPointers = [
    ...caseInfo.sourcePointers,
    ...caseInfo.expectedMarkdownSources,
    ...caseInfo.expectedSectionSources.flat(),
    ...caseInfo.expectedSlideSources.flat(),
  ];
  await resolveJsonSourcePointers(sourceRoot, [...new Set(usedPointers)], Object.keys(caseInfo.sources));

  const markdown = await readFile(path.join(outputDir, "brief.md"), "utf8");
  assertKorean(markdown, caseInfo.anchors);
  validateOrderedMarkers(markdown, caseInfo.expectedMarkdownSources);
  await validateMarkdownLinks(markdown, outputDir);

  const svg = await readFile(path.join(outputDir, "visualization.svg"), "utf8");
  if (!/viewBox=["']0 0 960 540["']/u.test(svg)) throw new Error(`${caseId} SVG viewBox mismatch`);
  assertKorean(svg, caseInfo.anchors);
  inspectPng(await readFile(path.join(outputDir, "visualization.png")), { width: 1920, height: 1080 });
  const pdf = await readFile(path.join(outputDir, "brief.pdf"));
  validatePdfSignature(pdf);
  inspectPdfArtifact({
    filename: path.join(outputDir, "brief.pdf"),
    commands: runtime.commands,
    expectedPages: caseInfo.expectedPages.pdf,
    anchors: caseInfo.documentAnchors,
    expectedPageSources: caseInfo.expectedSectionSources,
    expectedPageTextSha256: caseInfo.expectedPdfPageTextSha256,
  });

  const docx = openZip(await readFile(path.join(outputDir, "brief.docx")));
  const docxGraph = validateOoxmlArchive(docx, "docx");
  const documentXml = docx.read(docxGraph.root).toString("utf8");
  const documentText = xmlText(documentXml);
  assertKorean(documentText, caseInfo.documentAnchors);
  validateExactSourceSets(docxPageSourceSets(documentXml, caseInfo.expectedPages.docx), caseInfo.expectedSectionSources, `${caseId} DOCX page sources`);

  const pptx = openZip(await readFile(path.join(outputDir, "brief.pptx")));
  const pptxGraph = validateOoxmlArchive(pptx, "pptx", { expectedSlides: caseInfo.expectedSlides });
  const slideText = pptxGraph.slides.map((name) => xmlText(pptx.read(name))).join("\n");
  assertKorean(slideText, caseInfo.presentationAnchors);
  validateExactSourceSets(noteSourceSets(pptx, pptxGraph.notes), caseInfo.expectedSlideSources, `${caseId} speaker note sources`);

  validateAttestation(manifest.visualAttestation, { pageCount: caseInfo.expectedPages.pdf, slideCount: caseInfo.expectedSlides });
  const qa = await validateQa(caseInfo, qaDir, manifest.visualAttestation);
  validateRenderBindingManifest({ manifest, artifactDigests, qaDigests: qa.qaDigests });
  await verifyFreshRenderBindings({ caseInfo, outputDir, qaDir, runtime });
  return { caseId, validatedArtifacts: ARTIFACTS.length, inspectedImages: qa.inspectedImages };
}

export async function verifyFormats(outputRoot = path.resolve("tests/formats/output")) {
  const root = path.resolve(outputRoot);
  const formatsRoot = path.dirname(root);
  const runtime = await resolveRuntime();
  const cases = [];
  for (const caseId of CASE_IDS) cases.push(await validateCase({ caseId, outputRoot: root, fixtureRoot: path.join(formatsRoot, "fixtures"), qaRoot: path.join(formatsRoot, "qa"), runtime }));
  return { ok: true, cases };
}

const entry = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (entry && pathToFileURL(entry).href === import.meta.url) {
  verifyFormats(process.argv[2]).then((result) => {
    process.stdout.write(`[formats] PASS: ${result.cases.length} cases\n`);
  }).catch((error) => {
    process.stderr.write(`[formats] FAIL: ${error.message}\n`);
    process.exitCode = 1;
  });
}
