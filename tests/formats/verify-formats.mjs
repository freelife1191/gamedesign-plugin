#!/usr/bin/env node

import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  assertKorean,
  inspectPng,
  sha256,
  validateAttestation,
  validateOrderedMarkers,
  validatePdfSignature,
  validateSourceDigests,
  validateZipMembers,
} from "./lib/inspectors.mjs";
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
  for (const filename of relative) {
    const bytes = await readFile(path.join(qaDir, filename));
    const expected = filename === "visualization.png" ? { width: 1920, height: 1080 } : undefined;
    inspectPng(bytes, expected);
    hashes.push(sha256(bytes));
  }
  if (new Set(hashes).size !== hashes.length) throw new Error(`${caseInfo.caseId} QA images contain a duplicate render`);
  validatePdfSignature(await readFile(path.join(qaDir, "docx", "brief.pdf")));
  return relative.length;
}

async function validateCase({ caseId, outputRoot, fixtureRoot, qaRoot }) {
  const outputDir = path.join(outputRoot, caseId);
  const fixtureDir = path.join(fixtureRoot, caseId);
  const qaDir = path.join(qaRoot, caseId);
  const manifestPath = path.join(outputDir, "artifact-manifest.json");
  try { await access(manifestPath); } catch { throw new Error(`missing output manifest: ${caseId}/artifact-manifest.json`); }
  const caseInfo = JSON.parse(await readFile(path.join(fixtureDir, "case.json"), "utf8"));
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  if (manifest.schemaVersion !== 1 || manifest.caseId !== caseId) throw new Error(`${caseId} manifest identity mismatch`);
  if (/\/(?:Users|home)\/|[A-Za-z]:\\/u.test(JSON.stringify(manifest))) throw new Error(`${caseId} manifest exposes an absolute host path`);
  sameArray(manifest.canonicalExportManifest?.formats, ["md", "pdf", "docx", "pptx"], `${caseId} canonical formats`);
  sameArray(manifest.visualizationLane?.formats, ["svg", "png"], `${caseId} visualization formats`);
  if (manifest.visualizationLane?.lint !== "passed") throw new Error(`${caseId} Skillstead lint is not passed`);
  if (manifest.presentation?.artifactToolOnly !== true || manifest.presentation?.overflowTest !== "passed") throw new Error(`${caseId} presentation proof is incomplete`);
  if (manifest.runtime?.docxVisualRenderer !== "macOS-quick-look-html+chromium-print") throw new Error(`${caseId} DOCX visual renderer is not bound`);

  sameArray(Object.keys(manifest.artifacts ?? {}), ARTIFACTS, `${caseId} artifact set`);
  for (const filename of ARTIFACTS) {
    const bytes = await readFile(path.join(outputDir, filename));
    if (manifest.artifacts[filename]?.sha256 !== sha256(bytes)) throw new Error(`${caseId} artifact digest mismatch: ${filename}`);
  }
  await validateSourceDigests(path.resolve(REPO_ROOT, caseInfo.sourceRoot), caseInfo.sources);
  if (JSON.stringify(manifest.sourceBinding?.files) !== JSON.stringify(caseInfo.sources)) throw new Error(`${caseId} source binding mismatch`);

  const markdown = await readFile(path.join(outputDir, "brief.md"), "utf8");
  assertKorean(markdown, caseInfo.anchors);
  validateOrderedMarkers(markdown, caseInfo.sourcePointers);
  await validateMarkdownLinks(markdown, outputDir);

  const svg = await readFile(path.join(outputDir, "visualization.svg"), "utf8");
  if (!/viewBox=["']0 0 960 540["']/u.test(svg)) throw new Error(`${caseId} SVG viewBox mismatch`);
  assertKorean(svg, caseInfo.anchors);
  inspectPng(await readFile(path.join(outputDir, "visualization.png")), { width: 1920, height: 1080 });
  validatePdfSignature(await readFile(path.join(outputDir, "brief.pdf")));

  const docx = openZip(await readFile(path.join(outputDir, "brief.docx")));
  validateZipMembers(docx.members, "docx");
  const documentText = xmlText(docx.read("word/document.xml"));
  assertKorean(documentText, caseInfo.documentAnchors);
  validateOrderedMarkers(documentText, caseInfo.expectedSectionSources.flat());

  const pptx = openZip(await readFile(path.join(outputDir, "brief.pptx")));
  validateZipMembers(pptx.members, "pptx", caseInfo.expectedSlides);
  const slideMembers = pptx.members.filter((name) => /^ppt\/slides\/slide\d+\.xml$/u.test(name));
  const slideText = slideMembers.map((name) => xmlText(pptx.read(name))).join("\n");
  assertKorean(slideText, caseInfo.presentationAnchors);
  const notes = pptx.members.filter((name) => /^ppt\/notesSlides\/notesSlide\d+\.xml$/u.test(name));
  if (notes.length !== caseInfo.expectedSlides) throw new Error(`${caseId} speaker notes count mismatch`);
  const noteText = notes.map((name) => xmlText(pptx.read(name))).join("\n");
  if ((noteText.match(/\[Sources\]/gu) ?? []).length !== caseInfo.expectedSlides) throw new Error(`${caseId} speaker notes sources are incomplete`);

  validateAttestation(manifest.visualAttestation, { pageCount: caseInfo.expectedPages.pdf, slideCount: caseInfo.expectedSlides });
  const inspectedImages = await validateQa(caseInfo, qaDir, manifest.visualAttestation);
  return { caseId, validatedArtifacts: ARTIFACTS.length, inspectedImages };
}

export async function verifyFormats(outputRoot = path.resolve("tests/formats/output")) {
  const root = path.resolve(outputRoot);
  const formatsRoot = path.dirname(root);
  const cases = [];
  for (const caseId of CASE_IDS) cases.push(await validateCase({ caseId, outputRoot: root, fixtureRoot: path.join(formatsRoot, "fixtures"), qaRoot: path.join(formatsRoot, "qa") }));
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
