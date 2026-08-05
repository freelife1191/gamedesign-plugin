#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { access, copyFile, mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

import { transformQuickLookHtml } from "./lib/docx-qa.mjs";
import { transformQuickLookPptxHtml } from "./lib/pptx-qa.mjs";
import { compareNumericVersions, resolveRuntime } from "./lib/runtime-resolver.mjs";
import { probeChromium } from "../../shared/scripts/capability-probe.mjs";

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

async function resolveExecutableFromPath(names, env = process.env) {
  for (const directory of (env.PATH || "").split(path.delimiter).filter(Boolean)) {
    for (const name of names) {
      const candidate = path.join(directory, name);
      try { await access(candidate, constants.X_OK); return candidate; } catch { /* continue */ }
    }
  }
  return null;
}

export async function resolveChrome({ env = process.env, platform = process.platform } = {}) {
  const probeEnv = { ...env, SVG_INFOGRAPHIC_BROWSER: env.CHROME_BIN || env.SVG_INFOGRAPHIC_BROWSER };
  const capability = await probeChromium({ env: probeEnv, platform });
  if (capability.available) return capability.command;
  throw new Error("Chrome/Chromium is required for format QA rendering; set CHROME_BIN or add a portable binary to PATH");
}

export async function resolveQuickLook({ env = process.env, platform = process.platform } = {}) {
  if (platform !== "darwin") throw new Error("macOS Quick Look (qlmanage) is required for DOCX/PPTX visual QA");
  const candidate = await resolveExecutableFromPath(["qlmanage"], env);
  if (!candidate) throw new Error("macOS Quick Look capability is unavailable: qlmanage was not found on PATH");
  return candidate;
}

export async function renderDocxQa({ chrome, quickLook, docx, qaDir, previewBase, runtime, caseInfo }) {
  const previewRoot = path.join(previewBase, caseInfo.caseId);
  await rm(previewRoot, { recursive: true, force: true });
  await mkdir(previewRoot, { recursive: true });
  try {
    run(quickLook, ["-p", "-o", previewRoot, docx], { capture: true });
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

export async function resolvePluginSkill(kind, { env = process.env, home = os.homedir() } = {}) {
  const codexHome = env.CODEX_HOME || path.join(home, ".codex");
  const root = path.join(codexHome, "plugins", "cache", "openai-primary-runtime", kind);
  const entries = (await readdir(root, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort((a, b) => compareNumericVersions(b, a));
  if (!entries.length) throw new Error(`Official ${kind} skill cache is unavailable`);
  return path.join(root, entries[0], "skills", kind === "presentations" ? "presentations" : "documents");
}

export async function renderSavedPptxQa({ pptx, qaDir, previewBase, quickLook, chrome, runtime, caseInfo }) {
  await mkdir(qaDir, { recursive: true });
  const previewRoot = path.join(previewBase, caseInfo.caseId);
  await rm(previewRoot, { recursive: true, force: true });
  await mkdir(previewRoot, { recursive: true });
  run(quickLook, ["-p", "-o", previewRoot, pptx], { capture: true });
  const quickLookDir = path.join(previewRoot, `${path.basename(pptx)}.qlpreview`);
  const sourceHtml = await readFile(path.join(quickLookDir, "Preview.html"), "utf8");
  const attachments = (await readdir(quickLookDir)).filter((name) => /^Attachment\d+\.pdf$/u.test(name)).sort((left, right) => left.localeCompare(right, "en", { numeric: true }));
  for (const attachment of attachments) {
    run(runtime.commands.pdftoppm, [
      "-png", "-singlefile", "-r", "144",
      path.join(quickLookDir, attachment),
      path.join(quickLookDir, path.basename(attachment, ".pdf")),
    ], { capture: true });
  }
  for (let slideNumber = 1; slideNumber <= caseInfo.expectedSlides; slideNumber += 1) {
    const printable = path.join(quickLookDir, `Printable-${slideNumber}.html`);
    await writeFile(printable, transformQuickLookPptxHtml(sourceHtml, { slideNumber, attachmentNames: attachments }));
    run(chrome, [
      "--headless",
      "--disable-gpu",
      "--no-sandbox",
      "--hide-scrollbars",
      "--force-device-scale-factor=1",
      "--window-size=960,540",
      `--screenshot=${path.join(qaDir, `slide-${slideNumber}.png`)}`,
      pathToFileURL(printable).href,
    ], { capture: true });
  }
  const slides = (await readdir(qaDir)).filter((name) => /^slide-\d+\.png$/u.test(name));
  if (slides.length !== caseInfo.expectedSlides) throw new Error(`PPTX QA slide count ${slides.length} does not match ${caseInfo.expectedSlides}`);
}

export async function commitGeneratedTrees(
  { stagingRoot, outputRoot, qaRoot },
  { renameImpl = rename, rmImpl = rm } = {},
) {
  const backupRoot = path.join(stagingRoot, ".backup");
  const entries = [
    { staged: path.join(stagingRoot, "output"), destination: outputRoot, backup: path.join(backupRoot, "output") },
    { staged: path.join(stagingRoot, "qa"), destination: qaRoot, backup: path.join(backupRoot, "qa") },
  ];
  const backedUp = [];
  const installed = [];
  await mkdir(backupRoot, { recursive: true });
  try {
    for (const entry of entries) {
      try {
        await renameImpl(entry.destination, entry.backup);
        backedUp.push(entry);
      } catch (error) {
        if (error?.code !== "ENOENT") throw error;
      }
    }
    for (const entry of entries) {
      await renameImpl(entry.staged, entry.destination);
      installed.push(entry);
    }
  } catch (error) {
    const rollbackErrors = [];
    for (const entry of installed.reverse()) {
      try { await rmImpl(entry.destination, { recursive: true, force: true }); } catch (rollbackError) { rollbackErrors.push(rollbackError); }
    }
    for (const entry of backedUp.reverse()) {
      try { await renameImpl(entry.backup, entry.destination); } catch (rollbackError) { rollbackErrors.push(rollbackError); }
    }
    if (!rollbackErrors.length) await rmImpl(stagingRoot, { recursive: true, force: true });
    if (rollbackErrors.length) throw new AggregateError([error, ...rollbackErrors], "Generated tree transaction failed and rollback was incomplete");
    throw error;
  }
  try {
    await rmImpl(stagingRoot, { recursive: true, force: true });
  } catch (error) {
    process.stderr.write(`[formats] committed output/qa; stale transaction backup cleanup failed: ${error.message}\n`);
  }
}

async function digest(filename) {
  return createHash("sha256").update(await readFile(filename)).digest("hex");
}

async function listFiles(root, relative = "") {
  const directory = path.join(root, relative);
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const child = path.join(relative, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(root, child));
    else if (entry.isFile()) files.push(child.split(path.sep).join("/"));
  }
  return files.sort();
}

function digestSet(entries) {
  return createHash("sha256").update(entries.map(({ path: filename, sha256 }) => `${filename}:${sha256}`).join("\n")).digest("hex");
}

function fontPath() {
  const output = run("fc-match", ["-f", "%{file}\n%{family}\n", "D2Coding"], { capture: true }).split(/\r?\n/);
  if (!output[0] || !output[1]?.includes("D2Coding")) throw new Error("D2Coding 1.3.2 is required for committed regeneration");
  if (!/D2Coding-Ver1\.3\.2/i.test(path.basename(output[0]))) throw new Error("D2Coding version 1.3.2 was not resolved");
  return output[0];
}

export async function writeManifest(caseInfo, outputDir, qaDir, runtimeMetadata, toolMetadata) {
  const artifacts = {};
  for (const filename of ARTIFACTS) artifacts[filename] = { sha256: await digest(path.join(outputDir, filename)) };
  const qaFiles = [];
  for (const filename of await listFiles(qaDir)) qaFiles.push({ path: filename, sha256: await digest(path.join(qaDir, filename)) });
  const binding = (artifact, prefix) => ({
    artifact,
    artifactSha256: artifacts[artifact].sha256,
    qaFiles: qaFiles.filter((entry) => entry.path.startsWith(prefix)),
  });
  const artifactSet = Object.entries(artifacts).sort(([left], [right]) => left.localeCompare(right)).map(([filename, value]) => ({ path: filename, sha256: value.sha256 }));
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
    renderBinding: {
      pdf: binding("brief.pdf", "pdf/"),
      docx: binding("brief.docx", "docx/"),
      pptx: binding("brief.pptx", "pptx/"),
      visualization: binding("visualization.svg", "visualization."),
    },
    visualAttestation: {
      status: "pending-individual-inspection",
      inspectedImages: [],
      artifactSetSha256: digestSet(artifactSet),
      qaSetSha256: digestSet(qaFiles),
    },
  };
  await writeFile(path.join(outputDir, "artifact-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
}

async function main() {
  const runtime = await resolveRuntime();
  const presentations = await resolvePluginSkill("presentations");
  const font = fontPath();
  const chrome = await resolveChrome();
  const quickLook = await resolveQuickLook();
  const stageRoot = path.join(FORMATS_ROOT, `.stage-${process.pid}`);
  const stageOutputRoot = path.join(stageRoot, "output");
  const stageQaRoot = path.join(stageRoot, "qa");
  await rm(stageRoot, { recursive: true, force: true });
  await mkdir(stageOutputRoot, { recursive: true });
  await mkdir(stageQaRoot, { recursive: true });
  try {
    const workspace = path.join(stageQaRoot, "artifact-tool-workspace");
    const previewBase = path.join(stageQaRoot, ".docx-preview");
    const presentationBuildQa = path.join(stageQaRoot, ".presentation-build");
    run(runtime.commands.node, [path.join(presentations, "container_tools", "setup_artifact_tool_workspace.mjs"), "--workspace", workspace]);
    const pptGenerator = path.join(workspace, "generate_presentation.mjs");
    await copyFile(path.join(FORMATS_ROOT, "generators", "generate_presentation.mjs"), pptGenerator);
    const env = { PATH: `${path.join(runtime.dependenciesRoot, "bin", "override")}${path.delimiter}${process.env.PATH || ""}` };
    const toolMetadata = {
      libreOffice: version(runtime.commands.soffice),
      poppler: version(runtime.commands.pdftoppm, ["-v"]),
      chromium: version(chrome),
      docxVisualRenderer: "macOS-quick-look-html+chromium-print",
      pptxVisualRenderer: "saved-pptx+macOS-quick-look-html+chromium-screenshot",
    };
    for (const caseId of CASE_IDS) {
      const fixture = path.join(FIXTURES_ROOT, caseId);
      const caseInfo = JSON.parse(await readFile(path.join(fixture, "case.json"), "utf8"));
      const outputDir = path.join(stageOutputRoot, caseId);
      const qaDir = path.join(stageQaRoot, caseId);
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
      const transientPptQa = path.join(presentationBuildQa, caseId);
      run(runtime.commands.node, [pptGenerator, path.join(fixture, "presentation.json"), path.join(outputDir, "brief.pptx"), transientPptQa], { env });
      const overflow = run(runtime.commands.python, [path.join(presentations, "container_tools", "slides_test.py"), path.join(outputDir, "brief.pptx")], { env, capture: true });
      process.stdout.write(`${overflow}\n`);
      if (/ERROR:\s*Slides with content overflowing/i.test(overflow)) throw new Error(`${caseId} PPTX overflow gate failed`);
      await rm(path.join(outputDir, "brief.pptx.inspect.ndjson"), { force: true });
      const pptQa = path.join(qaDir, "pptx");
      await renderSavedPptxQa({
        pptx: path.join(outputDir, "brief.pptx"),
        qaDir: pptQa,
        previewBase,
        quickLook,
        chrome,
        runtime,
        caseInfo,
      });
      const pdfQa = path.join(qaDir, "pdf");
      await mkdir(pdfQa, { recursive: true });
      run(runtime.commands.pdftoppm, ["-png", "-r", "120", path.join(outputDir, "brief.pdf"), path.join(pdfQa, "page")], { env });
      const docxQa = path.join(qaDir, "docx");
      await mkdir(docxQa, { recursive: true });
      await renderDocxQa({ chrome, quickLook, docx: path.join(outputDir, "brief.docx"), qaDir: docxQa, previewBase, runtime, caseInfo });
      await copyFile(path.join(outputDir, "visualization.png"), path.join(qaDir, "visualization.png"));
      await copyFile(path.join(outputDir, "visualization.svg"), path.join(qaDir, "visualization.svg"));
      await writeManifest(caseInfo, outputDir, qaDir, runtime.publicMetadata, toolMetadata);
    }
    await rm(workspace, { recursive: true, force: true });
    await rm(previewBase, { recursive: true, force: true });
    await rm(presentationBuildQa, { recursive: true, force: true });
  } catch (error) {
    await rm(stageRoot, { recursive: true, force: true });
    throw error;
  }
  await commitGeneratedTrees({ stagingRoot: stageRoot, outputRoot: OUTPUT_ROOT, qaRoot: QA_ROOT });
  process.stdout.write(`[formats] generated ${CASE_IDS.length} cases atomically\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { process.stderr.write(`${error.stack || error.message}\n`); process.exitCode = 1; });
}
