#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { lstat, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { loadUseCaseManifest } from "./lib/use-case-guides.mjs";
import { validateCareerDiagramProductionBatch } from "./lib/career-diagram-production-contract.mjs";
import { renderDiagramSvg, validateDiagramSource } from "./lib/use-case-diagrams.mjs";
import { validateStudioDiagramProductionBatch } from "./lib/studio-diagram-production-contract.mjs";

const sourceFile = "guides/assets/use-case-diagram-sources.json";
const careerRoutingFile = "products/game-design-career/plugin/references/routing.json";
const studioRoutingFile = "products/game-design-studio/plugin/references/routing.json";
const wrapperFile = "products/game-design-studio/plugin/skills/visualize-game-design/scripts/run-skillstead.mjs";
const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function isContained(root, target) {
  const relative = path.relative(root, target);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

async function assertSafeDirectory(root, label) {
  const stats = await lstat(root);
  if (!stats.isDirectory() || stats.isSymbolicLink()) throw new Error(`${label} is not a non-symlink directory`);
  return realpath(root);
}

async function assertSafeOutputFile(root, filename, { createParents }) {
  if (!isContained(root, filename)) throw new Error(`unsafe output path: ${filename}`);
  let current = root;
  const parts = path.relative(root, filename).split(path.sep).filter(Boolean);
  for (const part of parts.slice(0, -1)) {
    current = path.join(current, part);
    let entry = await lstat(current).catch((error) => error?.code === "ENOENT" ? null : Promise.reject(error));
    if (!entry && createParents) {
      await mkdir(current);
      entry = await lstat(current);
    }
    if (!entry) throw new Error(`missing output parent: ${current}`);
    if (!entry.isDirectory() || entry.isSymbolicLink()) throw new Error(`output parent is a symlink or not a directory: ${current}`);
    const canonical = await realpath(current);
    if (!isContained(root, canonical)) throw new Error(`output parent resolves outside repository: ${current}`);
  }
  const existing = await lstat(filename).catch((error) => error?.code === "ENOENT" ? null : Promise.reject(error));
  if (existing) {
    if (!existing.isFile() || existing.isSymbolicLink()) throw new Error(`output file is a symlink or not a regular file: ${filename}`);
    const canonical = await realpath(filename);
    if (!isContained(root, canonical)) throw new Error(`output file resolves outside repository: ${filename}`);
  }
}

async function lstatIfPresent(filename, lstatFn = lstat) {
  try {
    return await lstatFn(filename);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

async function assertSafeExistingFile(root, filename, { optionalLstat = lstat } = {}) {
  await assertSafeOutputFile(root, filename, { createParents: false });
  const entry = await lstatIfPresent(filename, optionalLstat);
  if (!entry) throw new Error(`missing generated output: ${filename}`);
}

function parseArguments(argv) {
  const ids = [];
  let check = false;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--check") {
      check = true;
    } else if (argument === "--id") {
      const id = argv[index + 1];
      if (!id || id.startsWith("--")) throw new Error("--id requires a diagram ID");
      ids.push(id);
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }
  return { ids, check };
}

async function loadSources(repoRoot) {
  const filename = path.join(repoRoot, sourceFile);
  const parsed = JSON.parse(await readFile(filename, "utf8"));
  if (!Array.isArray(parsed)) throw new TypeError("use-case diagram sources must be an array");
  const seen = new Set();
  for (const source of parsed) {
    validateDiagramSource(source);
    if (seen.has(source.id)) throw new Error(`duplicate use-case diagram source ID: ${source.id}`);
    seen.add(source.id);
  }
  const routingFilename = path.join(repoRoot, studioRoutingFile);
  if (await lstatIfPresent(routingFilename)) {
    const routing = JSON.parse(await readFile(routingFilename, "utf8"));
    validateStudioDiagramProductionBatch(parsed, routing);
  }
  const careerRoutingFilename = path.join(repoRoot, careerRoutingFile);
  if (await lstatIfPresent(careerRoutingFilename)) {
    const routing = JSON.parse(await readFile(careerRoutingFilename, "utf8"));
    validateCareerDiagramProductionBatch(parsed, routing);
  }
  return parsed;
}

function outputForSource(source, manifest, repoRoot) {
  const matches = [
    ...manifest.audience_paths,
    ...manifest.cases,
    ...manifest.skill_cases,
  ].filter((entry) => entry?.id?.toLowerCase() === source.id);
  if (matches.length !== 1) {
    throw new Error(`expected exactly one explicit manifest output for ${source.id}, found ${matches.length}`);
  }
  const svg = path.resolve(repoRoot, matches[0].diagram.svg);
  const png = path.resolve(repoRoot, matches[0].diagram.png);
  if (!isContained(repoRoot, svg) || !isContained(repoRoot, png)) throw new Error(`unsafe output path for ${source.id}`);
  return { svg, png };
}

function invokeWrapper(wrapper, command, args) {
  const execution = spawnSync(process.execPath, [wrapper, command, ...args], { encoding: "utf8" });
  if (execution.error) throw execution.error;
  const output = `${execution.stdout ?? ""}${execution.stderr ?? ""}`;
  if (execution.status !== 0) throw new Error(`Skillstead ${command} failed: ${output.trim()}`);
  if (command === "lint" && !/0 error\(s\), 0 warning\(s\)/u.test(output)) {
    throw new Error(`Skillstead lint did not report zero errors and warnings: ${output.trim()}`);
  }
}

async function assertCompletePng(filename) {
  const data = await readFile(filename);
  if (data.length < 33 || !data.subarray(0, 8).equals(pngSignature)) throw new Error(`incomplete PNG: ${filename}`);
  if (data.readUInt32BE(16) !== 2800 || data.readUInt32BE(20) !== 1800) {
    throw new Error(`PNG must be 2800x1800: ${filename}`);
  }
  let offset = 8;
  let hasIend = false;
  while (offset + 12 <= data.length) {
    const length = data.readUInt32BE(offset);
    const type = data.subarray(offset + 4, offset + 8).toString("ascii");
    const end = offset + 12 + length;
    if (end > data.length) throw new Error(`truncated PNG chunk: ${filename}`);
    offset = end;
    if (type === "IEND") {
      hasIend = length === 0 && offset === data.length;
      break;
    }
  }
  if (!hasIend) throw new Error(`incomplete PNG: ${filename}`);
}

async function writeSvg(filename, svg, outputRoot) {
  await assertSafeOutputFile(outputRoot, filename, { createParents: true });
  await writeFile(filename, svg, "utf8");
}

async function buildOne({ source, manifest, repoRoot, outputRoot, check, optionalLstat }) {
  const output = outputForSource(source, manifest, repoRoot);
  const relativeSvg = path.relative(repoRoot, output.svg);
  const relativePng = path.relative(repoRoot, output.png);
  const svgPath = check ? path.join(outputRoot, relativeSvg) : output.svg;
  const pngPath = check ? path.join(outputRoot, relativePng) : output.png;
  if (check) {
    await assertSafeExistingFile(repoRoot, output.svg, { optionalLstat });
    await assertSafeExistingFile(repoRoot, output.png, { optionalLstat });
    await assertSafeOutputFile(outputRoot, pngPath, { createParents: true });
  } else {
    await assertSafeOutputFile(repoRoot, output.svg, { createParents: true });
    await assertSafeOutputFile(repoRoot, output.png, { createParents: true });
  }
  const svg = renderDiagramSvg(source);
  await writeSvg(svgPath, svg, outputRoot);
  await assertSafeExistingFile(outputRoot, svgPath, { optionalLstat });
  const wrapper = path.join(repoRoot, wrapperFile);
  await assertSafeExistingFile(repoRoot, wrapper, { optionalLstat });
  invokeWrapper(wrapper, "lint", [svgPath]);
  invokeWrapper(wrapper, "render", [svgPath, pngPath]);
  await assertSafeExistingFile(outputRoot, pngPath, { optionalLstat });
  await assertCompletePng(pngPath);
  if (check) {
    const [existingSvg, existingPng] = await Promise.all([readFile(output.svg, "utf8"), readFile(output.png)]);
    if (existingSvg !== svg) throw new Error(`generated SVG differs: ${relativeSvg}`);
    if (!existingPng.equals(await readFile(pngPath))) throw new Error(`generated PNG differs: ${relativePng}`);
    await assertCompletePng(output.png);
  }
  return { svg: 1, png: 1 };
}

export async function buildUseCaseDiagrams({ repoRoot, ids = [], check = false, __testLstat = lstat }) {
  const requestedRepoRoot = path.resolve(repoRoot);
  const canonicalRepoRoot = await assertSafeDirectory(requestedRepoRoot, "repository root");
  const sources = await loadSources(canonicalRepoRoot);
  const selected = ids.length === 0
    ? sources
    : ids.map((id) => {
      const source = sources.find((candidate) => candidate.id === id.toLowerCase());
      if (!source) throw new Error(`unknown use-case diagram ID: ${id}`);
      return source;
    });
  const manifest = await loadUseCaseManifest({ repoRoot: canonicalRepoRoot });
  const outputRoot = check
    ? await assertSafeDirectory(await realpath(await mkdtemp(path.join(os.tmpdir(), "use-case-diagrams-"))), "temporary output root")
    : canonicalRepoRoot;
  try {
    let counts = { svg: 0, png: 0 };
    for (const source of selected) {
      const result = await buildOne({ source, manifest, repoRoot: canonicalRepoRoot, outputRoot, check, optionalLstat: __testLstat });
      counts = { svg: counts.svg + result.svg, png: counts.png + result.png };
    }
    return counts;
  } finally {
    if (check) await rm(outputRoot, { recursive: true, force: true });
  }
}

async function isDirectInvocation() {
  return process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

if (await isDirectInvocation()) {
  try {
    const { ids, check } = parseArguments(process.argv.slice(2));
    const result = await buildUseCaseDiagrams({ repoRoot: process.cwd(), ids, check });
    console.log(`use-case diagrams: ${result.svg} SVG, ${result.png} PNG${check ? " checked" : " built"}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
