#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { access, copyFile, mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

import { transformQuickLookHtml } from "./lib/docx-qa.mjs";
import { compareNumericVersions, resolveRuntime } from "./lib/runtime-resolver.mjs";

const FORMATS_ROOT = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(FORMATS_ROOT, "../..");
const FIXTURES_ROOT = path.join(FORMATS_ROOT, "fixtures");
const OUTPUT_ROOT = path.join(FORMATS_ROOT, "output");
const QA_ROOT = path.join(FORMATS_ROOT, "qa");
const CASE_IDS = ["studio-live-service-rpg-economy", "career-entry-12-week-roadmap"];
const ARTIFACTS = ["brief.md", "brief.pdf", "brief.docx", "brief.pptx", "visualization.svg", "visualization.png"];

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: REPO_ROOT, encoding: "utf8", env: { ...process.env, ...options.env }, stdio: options.capture ? "pipe" : "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${path.basename(command)} failed (${result.status}): ${(result.stderr || result.stdout || "").trim()}`);
  return `${result.stdout || ""}${result.stderr || ""}`.trim();
}

function version(command, args = ["--version"]) {
  return run(command, args, { capture: true }).split(/\r?\n/)[0].replace(/^v/, "");
}

async function resolveChrome() {
  const candidates = [process.env.CHROME_BIN, "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].filter(Boolean);
  for (const candidate of candidates) {
    try { await access(candidate); return candidate; } catch { /* try the next deterministic candidate */ }
  }
  throw new Error("Google Chrome is required for format QA rendering");
}

async function renderDocxQa({ chrome, docx, qaDir, runtime, caseInfo }) {
  const previewRoot = path.join(QA_ROOT, ".docx-preview", caseInfo.caseId);
  await rm(previewRoot, { recursive: true, force: true });
  await mkdir(previewRoot, { recursive: true });
  try {
    run("qlmanage", ["-p", "-o", previewRoot, docx], { capture: true });
    const quickLookDir = path.join(previewRoot, `${path.basename(docx)}.qlpreview`);
    const sourceHtml = await readFile(path.join(quickLookDir, "Preview.html"), "utf8");
    const printable = path.join(quickLookDir, "Printable.html");
    await writeFile(printable, transformQuickLookHtml(sourceHtml));
    const pdf = path.join(qaDir, "brief.pdf");
    run(chrome, [
      "--headless",
      "--disable-gpu",
      "--no-sandbox",
      "--no-pdf-header-footer",
      `--print-to-pdf=${pdf}`,
      pathToFileURL(printable).href,
    ], { capture: true });
    run(runtime.commands.pdftoppm, ["-png", "-r", "120", pdf, path.join(qaDir, "page")]);
    const pages = (await readdir(qaDir)).filter((name) => /^page-\d+\.png$/u.test(name));
    if (pages.length !== caseInfo.expectedPages.docx) throw new Error(`${caseInfo.caseId} DOCX QA page count ${pages.length} does not match ${caseInfo.expectedPages.docx}`);
  } finally {
    await rm(previewRoot, { recursive: true, force: true });
  }
}

async function resolvePluginSkill(kind) {
  const root = path.join(os.homedir(), ".codex", "plugins", "cache", "openai-primary-runtime", kind);
  const entries = (await readdir(root, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort((a, b) => compareNumericVersions(b, a));
  if (!entries.length) throw new Error(`Official ${kind} skill cache is unavailable`);
  return path.join(root, entries[0], "skills", kind === "presentations" ? "presentations" : "documents");
}

async function digest(filename) {
  return createHash("sha256").update(await readFile(filename)).digest("hex");
}

function fontPath() {
  const output = run("fc-match", ["-f", "%{file}\n%{family}\n", "D2Coding"], { capture: true }).split(/\r?\n/);
  if (!output[0] || !output[1]?.includes("D2Coding")) throw new Error("D2Coding 1.3.2 is required for committed regeneration");
  if (!/D2Coding-Ver1\.3\.2/i.test(path.basename(output[0]))) throw new Error("D2Coding version 1.3.2 was not resolved");
  return output[0];
}

async function writeManifest(caseInfo, outputDir, runtimeMetadata, toolMetadata) {
  const artifacts = {};
  for (const filename of ARTIFACTS) artifacts[filename] = { sha256: await digest(path.join(outputDir, filename)) };
  const manifest = {
    schemaVersion: 1,
    caseId: caseInfo.caseId,
    sourceBinding: { rootClass: "repository-e2e-fixture", files: caseInfo.sources, pointers: caseInfo.sourcePointers },
    canonicalExportManifest: { formats: ["md", "pdf", "docx", "pptx"] },
    visualizationLane: { formats: ["svg", "png"], svgViewBox: "0 0 960 540", pngDimensions: { width: 1920, height: 1080 }, renderer: "packaged-skillstead-chromium-2x", lint: "passed" },
    artifacts,
    runtime: { ...runtimeMetadata, ...toolMetadata },
    font: { family: "D2Coding", version: "1.3.2", license: "SIL OFL 1.1", sourceClass: "locally-installed-official-upstream-match" },
    document: { pdfPages: caseInfo.expectedPages.pdf, docxPages: caseInfo.expectedPages.docx, pptxSlides: caseInfo.expectedSlides },
    presentation: { slideSize: { width: 1280, height: 720 }, artifactToolOnly: true, layoutInspiration: ["Codex Grid slide-08", "Codex Grid slide-10", "Codex Grid slide-14", "Codex Grid slide-19", "Codex Grid slide-25"], speakerNotesSources: true, diagramSlide: 3, overflowTest: "passed" },
    visualAttestation: { status: "pending-individual-inspection", inspectedImages: [] },
  };
  await writeFile(path.join(outputDir, "artifact-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
}

async function main() {
  const runtime = await resolveRuntime();
  const presentations = await resolvePluginSkill("presentations");
  const font = fontPath();
  const chrome = await resolveChrome();
  const stageRoot = path.join(FORMATS_ROOT, `.stage-${process.pid}`);
  await rm(stageRoot, { recursive: true, force: true });
  await rm(QA_ROOT, { recursive: true, force: true });
  await mkdir(stageRoot, { recursive: true });
  await mkdir(QA_ROOT, { recursive: true });
  const workspace = path.join(QA_ROOT, "artifact-tool-workspace");
  run(runtime.commands.node, [path.join(presentations, "container_tools", "setup_artifact_tool_workspace.mjs"), "--workspace", workspace]);
  const pptGenerator = path.join(workspace, "generate_presentation.mjs");
  await copyFile(path.join(FORMATS_ROOT, "generators", "generate_presentation.mjs"), pptGenerator);
  const env = { PATH: `${path.join(runtime.dependenciesRoot, "bin", "override")}${path.delimiter}${process.env.PATH || ""}` };
  const toolMetadata = {
    libreOffice: version(runtime.commands.soffice),
    poppler: version(runtime.commands.pdftoppm, ["-v"]),
    chromium: version(chrome),
    docxVisualRenderer: "macOS-quick-look-html+chromium-print",
  };
  for (const caseId of CASE_IDS) {
    const fixture = path.join(FIXTURES_ROOT, caseId);
    const caseInfo = JSON.parse(await readFile(path.join(fixture, "case.json"), "utf8"));
    const outputDir = path.join(stageRoot, caseId);
    const qaDir = path.join(QA_ROOT, caseId);
    await mkdir(outputDir, { recursive: true });
    await mkdir(qaDir, { recursive: true });
    const markdown = (await readFile(path.join(fixture, "artifact", "content.md"), "utf8"))
      .replaceAll("(assets/visualization.svg)", "(visualization.svg)");
    await writeFile(path.join(outputDir, "brief.md"), markdown);
    await copyFile(path.join(fixture, "artifact", "assets", "visualization.svg"), path.join(outputDir, "visualization.svg"));
    const wrapper = caseInfo.product === "studio"
      ? path.join(REPO_ROOT, "plugins/game-design-studio/skills/visualize-game-design/scripts/run-skillstead.mjs")
      : path.join(REPO_ROOT, "plugins/game-design-career/skills/visualize-career-roadmap/scripts/run-skillstead.mjs");
    run(runtime.commands.node, [wrapper, "lint", path.join(outputDir, "visualization.svg")]);
    run(runtime.commands.node, [wrapper, "render", path.join(outputDir, "visualization.svg"), path.join(outputDir, "visualization.png")]);
    run(runtime.commands.python, [path.join(FORMATS_ROOT, "generators", "generate_documents.py"), path.join(fixture, "case.json"), font, outputDir], { env });
    const pptQa = path.join(qaDir, "pptx");
    run(runtime.commands.node, [pptGenerator, path.join(fixture, "presentation.json"), path.join(outputDir, "brief.pptx"), pptQa], { env });
    const overflow = run(runtime.commands.python, [path.join(presentations, "container_tools", "slides_test.py"), path.join(outputDir, "brief.pptx")], { env, capture: true });
    process.stdout.write(`${overflow}\n`);
    if (/ERROR:\s*Slides with content overflowing/i.test(overflow)) throw new Error(`${caseId} PPTX overflow gate failed`);
    await rm(path.join(outputDir, "brief.pptx.inspect.ndjson"), { force: true });
    const pdfQa = path.join(qaDir, "pdf");
    await mkdir(pdfQa, { recursive: true });
    run(runtime.commands.pdftoppm, ["-png", "-r", "120", path.join(outputDir, "brief.pdf"), path.join(pdfQa, "page")], { env });
    const docxQa = path.join(qaDir, "docx");
    await mkdir(docxQa, { recursive: true });
    await renderDocxQa({ chrome, docx: path.join(outputDir, "brief.docx"), qaDir: docxQa, runtime, caseInfo });
    await copyFile(path.join(outputDir, "visualization.png"), path.join(qaDir, "visualization.png"));
    await copyFile(path.join(outputDir, "visualization.svg"), path.join(qaDir, "visualization.svg"));
    await writeManifest(caseInfo, outputDir, runtime.publicMetadata, toolMetadata);
  }
  await rm(workspace, { recursive: true, force: true });
  await rm(path.join(QA_ROOT, ".docx-preview"), { recursive: true, force: true });
  await rm(OUTPUT_ROOT, { recursive: true, force: true });
  await rename(stageRoot, OUTPUT_ROOT);
  process.stdout.write(`[formats] generated ${CASE_IDS.length} cases atomically\n`);
}

main().catch((error) => { process.stderr.write(`${error.stack || error.message}\n`); process.exitCode = 1; });
