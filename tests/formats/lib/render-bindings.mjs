import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { assertKorean, sha256, validateExactSourceSets } from "./inspectors.mjs";
import { renderDocxQa, renderSavedPptxQa, resolveChrome, resolveQuickLook } from "../generate-formats.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function run(command, args, label) {
  if (typeof command !== "string" || !command) throw new Error(`${label} capability is unavailable`);
  const result = spawnSync(command, args, { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
  if (result.error || result.status !== 0) {
    const detail = `${result.stderr || result.stdout || result.error?.message || "unknown error"}`.trim();
    throw new Error(`${label} failed${detail ? `: ${detail}` : ""}`);
  }
  return result.stdout;
}

function sourcePointers(text) {
  return [...String(text).matchAll(/[A-Za-z0-9._/-]+#[A-Za-z0-9_~./-]*/gu)].map((match) => match[0]);
}

export function normalizePdfPageText(text) {
  return String(text)
    .normalize("NFC")
    .replace(/\r\n?/gu, "\n")
    .split("\n")
    .map((line) => line.replace(/[\t ]+$/gu, ""))
    .filter((line) => line !== "")
    .join("\n");
}

export function inspectPdfArtifact({ filename, commands, expectedPages, anchors, expectedPageSources, expectedPageTextSha256 }) {
  const absolute = path.resolve(filename);
  const info = run(commands.pdfinfo, [absolute], "PDF inspection");
  const pages = Number(info.match(/^Pages:\s+(\d+)\s*$/mu)?.[1]);
  if (!Number.isInteger(pages) || pages !== expectedPages) throw new Error(`PDF page count ${pages || "unknown"} does not match ${expectedPages}`);
  if (!/^Encrypted:\s+no\s*$/mu.test(info)) throw new Error("PDF inspection rejects encrypted artifacts");
  if (!/^Page size:\s+612(?:\.\d+)? x 792(?:\.\d+)? pts \(letter\)\s*$/mu.test(info)) throw new Error("PDF page size is not Letter");
  const text = run(commands.pdftotext, ["-layout", absolute, "-"], "PDF text extraction")
    .normalize("NFC")
    .replace(/\r\n?/gu, "\n");
  assertKorean(text, anchors);
  const pageTexts = text.split("\f");
  while (pageTexts.length && normalizePdfPageText(pageTexts.at(-1)) === "") pageTexts.pop();
  if (pageTexts.length !== expectedPages) throw new Error(`PDF text page count ${pageTexts.length} does not match ${expectedPages}`);
  validateExactSourceSets(pageTexts.map(sourcePointers), expectedPageSources, "PDF page sources");
  const pageTextSha256 = pageTexts.map((page) => createHash("sha256").update(normalizePdfPageText(page)).digest("hex"));
  if (JSON.stringify(pageTextSha256) !== JSON.stringify(expectedPageTextSha256)) {
    const mismatch = pageTextSha256.findIndex((digest, index) => digest !== expectedPageTextSha256?.[index]);
    throw new Error(`PDF page text digest mismatch at page ${mismatch + 1}`);
  }
  return { pages, text, pageTextSha256 };
}

function setDigest(digests) {
  return createHash("sha256")
    .update(Object.entries(digests).sort(([left], [right]) => left.localeCompare(right)).map(([filename, digest]) => `${filename}:${digest}`).join("\n"))
    .digest("hex");
}

export function validateRenderBindingManifest({ manifest, artifactDigests, qaDigests }) {
  const specs = {
    pdf: { artifact: "brief.pdf", prefix: "pdf/" },
    docx: { artifact: "brief.docx", prefix: "docx/" },
    pptx: { artifact: "brief.pptx", prefix: "pptx/" },
    visualization: { artifact: "visualization.svg", prefix: "visualization." },
  };
  if (JSON.stringify(Object.keys(manifest.renderBinding ?? {})) !== JSON.stringify(Object.keys(specs))) {
    throw new Error("render binding lane set does not match the required contract");
  }
  for (const [name, spec] of Object.entries(specs)) {
    const lane = manifest.renderBinding[name];
    if (lane?.artifact !== spec.artifact || lane?.artifactSha256 !== artifactDigests[spec.artifact]) {
      throw new Error(`render binding ${name} artifact digest does not match the exact artifact`);
    }
    const expectedQa = Object.entries(qaDigests)
      .filter(([filename]) => filename.startsWith(spec.prefix))
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([filename, digest]) => ({ path: filename, sha256: digest }));
    if (!expectedQa.length || JSON.stringify(lane.qaFiles) !== JSON.stringify(expectedQa)) {
      throw new Error(`render binding ${name} QA digests do not match the exact QA files`);
    }
  }
  if (manifest.visualAttestation?.artifactSetSha256 !== setDigest(artifactDigests)) throw new Error("visual attestation artifact set digest mismatch");
  if (manifest.visualAttestation?.qaSetSha256 !== setDigest(qaDigests)) throw new Error("visual attestation QA set digest mismatch");
}

async function sameDigest(left, right, label) {
  if (sha256(await readFile(left)) !== sha256(await readFile(right))) throw new Error(`fresh render does not match ${label}`);
}

async function compareRenderedImages(freshDir, committedDir, pattern, expectedCount, label) {
  const names = (await readdir(freshDir)).filter((name) => pattern.test(name)).sort((left, right) => left.localeCompare(right, "en", { numeric: true }));
  const committed = (await readdir(committedDir)).filter((name) => pattern.test(name)).sort((left, right) => left.localeCompare(right, "en", { numeric: true }));
  if (names.length !== expectedCount || JSON.stringify(names) !== JSON.stringify(committed)) throw new Error(`fresh render ${label} image set does not match`);
  for (const name of names) await sameDigest(path.join(freshDir, name), path.join(committedDir, name), `${label}/${name}`);
}

export async function verifyFreshRenderBindings({ caseInfo, outputDir, qaDir, runtime, lanes = ["pdf", "docx", "pptx", "visualization"] }) {
  const stage = await mkdtemp(path.join(tmpdir(), "format-render-proof-"));
  try {
    if (lanes.includes("pdf")) {
      const freshDir = path.join(stage, "pdf");
      await mkdir(freshDir, { recursive: true });
      run(runtime.commands.pdftoppm, ["-png", "-r", "120", path.join(outputDir, "brief.pdf"), path.join(freshDir, "page")], "PDF fresh render");
      await compareRenderedImages(freshDir, path.join(qaDir, "pdf"), /^page-\d+\.png$/u, caseInfo.expectedPages.pdf, "pdf");
    }
    if (lanes.includes("docx")) {
      const freshDir = path.join(stage, "docx");
      await mkdir(freshDir, { recursive: true });
      await renderDocxQa({
        chrome: await resolveChrome(),
        quickLook: await resolveQuickLook(),
        docx: path.join(outputDir, "brief.docx"),
        qaDir: freshDir,
        previewBase: path.join(stage, ".docx-preview"),
        runtime,
        caseInfo,
      });
      await compareRenderedImages(freshDir, path.join(qaDir, "docx"), /^page-\d+\.png$/u, caseInfo.expectedPages.docx, "docx");
    }
    if (lanes.includes("pptx")) {
      const freshDir = path.join(stage, "pptx");
      await renderSavedPptxQa({
        pptx: path.join(outputDir, "brief.pptx"),
        qaDir: freshDir,
        previewBase: path.join(stage, ".pptx-preview"),
        quickLook: await resolveQuickLook(),
        chrome: await resolveChrome(),
        runtime,
        caseInfo,
      });
      await compareRenderedImages(freshDir, path.join(qaDir, "pptx"), /^slide-\d+\.png$/u, caseInfo.expectedSlides, "pptx");
    }
    if (lanes.includes("visualization")) {
      const wrapper = caseInfo.product === "studio"
        ? path.join(REPO_ROOT, "plugins/game-design-studio/skills/visualize-game-design/scripts/run-skillstead.mjs")
        : path.join(REPO_ROOT, "plugins/game-design-career/skills/visualize-career-roadmap/scripts/run-skillstead.mjs");
      const fresh = path.join(stage, "visualization.png");
      run(runtime.commands.node, [wrapper, "render", path.join(outputDir, "visualization.svg"), fresh], "Skillstead fresh render");
      await sameDigest(fresh, path.join(qaDir, "visualization.png"), "visualization.png QA");
      await sameDigest(fresh, path.join(outputDir, "visualization.png"), "visualization.png artifact");
      await sameDigest(path.join(outputDir, "visualization.svg"), path.join(qaDir, "visualization.svg"), "visualization.svg QA source");
    }
    return { ok: true, lanes };
  } finally {
    await rm(stage, { recursive: true, force: true });
  }
}
