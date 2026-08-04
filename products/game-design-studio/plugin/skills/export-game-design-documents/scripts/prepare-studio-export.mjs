#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { lstat, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const FORMATS = Object.freeze(["md", "pdf", "docx", "pptx"]);
const RECIPES = new Set(["gdd", "system-spec", "content-spec", "liveops-plan", "review-report", "executive-presentation"]);
const EXTENSIONS = Object.freeze({ md: "md", pdf: "pdf", docx: "docx", pptx: "pptx" });
const CAPABILITIES = Object.freeze({ md: null, pdf: "pdf", docx: "documents", pptx: "presentations" });
const CAPABILITY_NAMES = Object.freeze(["node", "chromium", "soffice", "documents", "pdf", "presentations"]);
const KEBAB_CASE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

async function assertExistingPath(value, label, expectedType) {
  if (typeof value !== "string" || value.trim() === "" || value.includes("\0")) {
    throw new TypeError(`${label} must be a nonempty path`);
  }
  const resolved = path.resolve(value);
  const stat = await lstat(resolved);
  if (stat.isSymbolicLink()) throw new Error(`${label} must not be a symlink`);
  if (expectedType === "directory" && !stat.isDirectory()) throw new Error(`${label} must be a directory`);
  if (expectedType === "file" && !stat.isFile()) throw new Error(`${label} must be a file`);
  const canonical = await realpath(resolved);
  return canonical;
}

function normalizeFormats(value) {
  if (!Array.isArray(value) || value.length === 0) throw new TypeError("requestedFormats must be a nonempty array");
  const normalized = [];
  for (const format of value) {
    if (!FORMATS.includes(format)) throw new Error(`Unsupported export format: ${format}`);
    if (normalized.includes(format)) throw new Error(`Duplicate export format: ${format}`);
    normalized.push(format);
  }
  return normalized;
}

function normalizedHeading(value) {
  return value.trim().replace(/\s*\{#[a-z0-9-]+\}\s*$/iu, "").toLocaleLowerCase("en-US");
}

function validatePresentation(requestedFormats, presentation, canonicalHeadings) {
  if (!requestedFormats.includes("pptx")) return null;
  const audience = presentation?.audience;
  const purpose = presentation?.purpose;
  const slideOutline = presentation?.slideOutline;
  if (typeof audience !== "string" || audience.trim() === "") throw new Error("PPTX requires an audience");
  if (typeof purpose !== "string" || purpose.trim() === "") throw new Error("PPTX requires a purpose");
  if (!Array.isArray(slideOutline) || slideOutline.length === 0) {
    throw new Error("PPTX requires a nonempty independent slide outline");
  }
  const headingSet = new Set(canonicalHeadings.map(normalizedHeading));
  const ids = new Set();
  const normalizedSlides = slideOutline.map((slide) => {
    if (!slide || typeof slide !== "object" || Array.isArray(slide) || Object.keys(slide).sort().join("\0") !== ["id", "message", "purpose", "title"].sort().join("\0")) {
      throw new Error("PPTX requires a nonempty independent slide outline with id, title, message, and purpose");
    }
    const normalized = {};
    for (const field of ["id", "title", "message", "purpose"]) {
      if (typeof slide[field] !== "string" || slide[field].trim() === "") throw new Error(`PPTX slide outline ${field} is required`);
      normalized[field] = slide[field].trim();
    }
    if (!KEBAB_CASE.test(normalized.id) || ids.has(normalized.id)) throw new Error("PPTX slide outline IDs must be unique kebab-case values");
    ids.add(normalized.id);
    for (const field of ["title", "message", "purpose"]) {
      if (/^\s{0,3}#{1,6}\s+/u.test(normalized[field])) throw new Error("PPTX slide outline must not copy Markdown heading syntax");
    }
    if (headingSet.has(normalizedHeading(normalized.title))) throw new Error("PPTX slide outline must tell an independent story rather than copy structural headings");
    return normalized;
  });
  return { audience: audience.trim(), purpose: purpose.trim(), slideOutline: normalizedSlides };
}

async function runPreflight(validatorPath, artifactDir, requestedFormats) {
  const command = [process.execPath, validatorPath, artifactDir, ...requestedFormats];
  const result = spawnSync(command[0], command.slice(1), { encoding: "utf8" });
  if (![0, 1].includes(result.status)) {
    throw new Error(`Canonical validator failed to execute: ${result.stderr || `exit ${result.status}`}`);
  }
  let validation;
  try {
    validation = JSON.parse(result.stdout);
  } catch {
    throw new Error("Canonical validator returned invalid JSON");
  }
  return {
    status: validation.ok ? "passed" : "failed",
    command,
    exitCode: result.status,
    errors: validation.errors ?? [],
    warnings: validation.warnings ?? [],
    files: validation.files ?? [],
  };
}

async function readArtifactId(artifactDir) {
  const source = await readFile(path.join(artifactDir, "content.md"), "utf8").catch(() => "");
  const artifactId = source.match(/^---\n[\s\S]*?^artifact_id:\s*([^\n]+)$/mu)?.[1]?.trim();
  return artifactId && KEBAB_CASE.test(artifactId) ? artifactId : "invalid-artifact";
}

async function readCanonicalHeadings(artifactDir) {
  const source = await readFile(path.join(artifactDir, "content.md"), "utf8").catch(() => "");
  return [...source.matchAll(/^#{1,6}\s+(.+)$/gmu)].map(([, heading]) => heading.trim());
}

async function pathExists(value) {
  try {
    await lstat(value);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

function capabilitySnapshot(capabilities, capabilityName) {
  if (capabilityName === null) return { name: "canonical-markdown", available: true };
  const source = capabilities?.[capabilityName];
  if (!source || typeof source !== "object" || Array.isArray(source)) return { name: capabilityName, available: false };
  const snapshot = { name: capabilityName, available: source.available === true };
  for (const key of ["provider", "command", "version"]) {
    if (typeof source[key] === "string" && source[key] !== "") snapshot[key] = source[key];
  }
  return snapshot;
}

function normalizeCapabilityProbe(capabilities) {
  if (!capabilities || typeof capabilities !== "object" || Array.isArray(capabilities) || Object.keys(capabilities).length === 0) {
    return { status: "missing", capabilities: {} };
  }
  const normalized = {};
  for (const name of CAPABILITY_NAMES) {
    const source = capabilities[name];
    if (!source || typeof source !== "object" || Array.isArray(source) || source.available !== true) {
      normalized[name] = { available: false };
      continue;
    }
    normalized[name] = { available: true };
    for (const key of ["version", "command", "provider"]) {
      if (typeof source[key] === "string" && source[key] !== "") normalized[name][key] = source[key];
    }
  }
  return { status: "provided", capabilities: normalized };
}

export async function prepareStudioExportJob(options) {
  if (!options || typeof options !== "object" || Array.isArray(options)) throw new TypeError("options must be an object");
  const requestedFormats = normalizeFormats(options.requestedFormats);
  if (!RECIPES.has(options.recipeId)) throw new Error(`Unknown export recipe: ${options.recipeId}`);
  const [artifactDir, outputDir, validatorPath] = await Promise.all([
    assertExistingPath(options.artifactDir, "artifactDir", "directory"),
    assertExistingPath(options.outputDir, "outputDir", "directory"),
    assertExistingPath(options.validatorPath, "validatorPath", "file"),
  ]);
  const presentation = validatePresentation(requestedFormats, options.presentation, await readCanonicalHeadings(artifactDir));
  const preflight = await runPreflight(validatorPath, artifactDir, requestedFormats);
  const artifactId = await readArtifactId(artifactDir);
  const capabilityProbe = normalizeCapabilityProbe(options.capabilities);
  const capabilities = capabilityProbe.capabilities;
  const formatJobs = {};

  for (const format of FORMATS) {
    const requested = requestedFormats.includes(format);
    const capability = capabilitySnapshot(capabilities, CAPABILITIES[format]);
    const plannedOutputPath = path.join(outputDir, `${artifactId}.${EXTENSIONS[format]}`);
    if (requested && await pathExists(plannedOutputPath)) {
      throw new Error(`Unsafe overwrite refused for ${plannedOutputPath}`);
    }
    let status = "not-requested";
    if (requested && preflight.status === "failed") status = "blocked";
    else if (requested && !capability.available) status = "unavailable";
    else if (requested) status = "pending";
    formatJobs[format] = {
      requested,
      extension: EXTENSIONS[format],
      capability,
      status,
      statusHistory: status === "unavailable" ? ["pending", "unavailable"] : [status],
      generationStatus: "not-run",
      rendererStatus: "not-run",
      qaStatus: "not-run",
      plannedOutputPath,
      outputPath: null,
      digest: null,
      pageOrSlideCount: null,
      evidence: [],
      limitations: [],
    };
  }

  return {
    schemaVersion: 1,
    artifact: { id: artifactId, directory: artifactDir },
    preflight,
    recipe: { id: options.recipeId },
    capabilityProbe: {
      status: capabilityProbe.status,
      capabilities,
      evidence: Array.isArray(options.capabilityEvidence) ? structuredClone(options.capabilityEvidence) : [],
    },
    formats: formatJobs,
    ...(presentation ? { presentation } : {}),
    artifactPreservation: { canonicalArtifactMutated: false, existingOutputsOverwritten: false },
  };
}

async function directInvocation() {
  if (!process.argv[1]) return false;
  try {
    return await realpath(process.argv[1]) === await realpath(fileURLToPath(import.meta.url));
  } catch {
    return pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
  }
}

if (await directInvocation()) {
  const jobPath = process.argv[2];
  if (!jobPath || process.argv.length !== 3) {
    console.error("Usage: node prepare-studio-export.mjs <job.json>");
    process.exitCode = 2;
  } else {
    try {
      const safeJobPath = await assertExistingPath(jobPath, "jobPath", "file");
      const job = JSON.parse(await readFile(safeJobPath, "utf8"));
      console.log(JSON.stringify(await prepareStudioExportJob(job), null, 2));
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
  }
}
