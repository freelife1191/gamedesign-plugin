#!/usr/bin/env node

import { createHash } from "node:crypto";
import { lstat, readFile, realpath } from "node:fs/promises";
import path from "node:path";

const FORMATS = Object.freeze(["md", "pdf", "docx", "pptx"]);
const CAPABILITIES = Object.freeze(["node", "chromium", "soffice", "documents", "pdf", "presentations"]);
const FORMAT_CAPABILITIES = Object.freeze({ md: "canonical-markdown", pdf: "pdf", docx: "documents", pptx: "presentations" });
const DANGEROUS_KEYS = new Set(["__proto__", "prototype", "constructor"]);
const TRANSITIONS = Object.freeze({
  "not-requested": [],
  blocked: [],
  unavailable: [],
  pending: ["passed", "failed", "unavailable"],
  passed: [],
  failed: [],
});

function add(errors, message) {
  errors.push(message);
}

function assertPlainTree(value, errors, location = "manifest") {
  if (value === null || typeof value !== "object") return;
  if (!Array.isArray(value) && ![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    add(errors, `${location} has an unsafe prototype`);
    return;
  }
  for (const key of Object.keys(value)) {
    if (DANGEROUS_KEYS.has(key)) add(errors, `${location}.${key} is prohibited`);
    assertPlainTree(value[key], errors, `${location}.${key}`);
  }
}

function object(value, errors, location) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    add(errors, `${location} must be an object`);
    return false;
  }
  return true;
}

function exactKeys(value, keys, errors, location) {
  if (!object(value, errors, location)) return;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.join("\0") !== expected.join("\0")) add(errors, `${location} keys must be exactly ${expected.join(", ")}`);
}

function allowedKeys(value, allowed, required, errors, location) {
  if (!object(value, errors, location)) return;
  for (const key of Object.keys(value)) if (!allowed.includes(key)) add(errors, `${location}.${key} is not allowed`);
  for (const key of required) if (!Object.hasOwn(value, key)) add(errors, `${location}.${key} is required`);
}

function sameFlatObject(left, right) {
  if (!left || !right || typeof left !== "object" || typeof right !== "object") return false;
  const keys = Object.keys(left).sort();
  return keys.join("\0") === Object.keys(right).sort().join("\0") && keys.every((key) => left[key] === right[key]);
}

function validateStatusHistory(job, errors, location) {
  if (!Array.isArray(job?.statusHistory) || job.statusHistory.length === 0) {
    add(errors, `${location}.statusHistory must be nonempty`);
    return;
  }
  if (job.statusHistory.at(-1) !== job.status) add(errors, `${location}.status must equal the final history state`);
  for (let index = 0; index < job.statusHistory.length; index += 1) {
    const status = job.statusHistory[index];
    if (!Object.hasOwn(TRANSITIONS, status)) {
      add(errors, `${location}.statusHistory contains an invalid state`);
      continue;
    }
    if (index > 0 && !TRANSITIONS[job.statusHistory[index - 1]].includes(status)) {
      add(errors, `${location}.statusHistory contains an invalid or reopened terminal transition`);
    }
  }
  const expected = ["passed", "failed", "unavailable"].includes(job.status) ? ["pending", job.status] : [job.status];
  if (job.statusHistory.join("\0") !== expected.join("\0")) add(errors, `${location}.statusHistory must be exactly ${expected.join(" -> ")}`);
}

function validateCapability(capability, errors, location) {
  allowedKeys(capability, ["name", "available", "version", "command", "provider"], ["name", "available"], errors, location);
  if (typeof capability?.name !== "string" || capability.name === "") add(errors, `${location}.name is required`);
  if (typeof capability?.available !== "boolean") add(errors, `${location}.available must be boolean`);
  if (capability?.available === false && Object.keys(capability).some((key) => !["name", "available"].includes(key))) {
    add(errors, `${location} unavailable state cannot carry provider metadata`);
  }
}

function validateProbe(probe, errors) {
  exactKeys(probe, ["status", "capabilities", "evidence"], errors, "capabilityProbe");
  if (!Array.isArray(probe?.evidence)) add(errors, "capabilityProbe.evidence must be an array");
  if (probe?.status === "missing") {
    if (!object(probe.capabilities, errors, "capabilityProbe.capabilities")) return;
    if (Object.keys(probe.capabilities).length !== 0 || probe.evidence.length !== 0) add(errors, "missing capability probe cannot carry capabilities or evidence");
    return;
  }
  if (probe?.status !== "provided") {
    add(errors, "capabilityProbe.status must be provided or missing");
    return;
  }
  exactKeys(probe.capabilities, CAPABILITIES, errors, "capabilityProbe.capabilities");
  for (const name of CAPABILITIES) {
    const capability = probe.capabilities?.[name];
    allowedKeys(capability, ["available", "version", "command", "provider"], ["available"], errors, `capabilityProbe.capabilities.${name}`);
    if (typeof capability?.available !== "boolean") add(errors, `capabilityProbe.capabilities.${name}.available must be boolean`);
    if (capability?.available === false && Object.keys(capability).some((key) => key !== "available")) add(errors, `unavailable ${name} cannot carry provider metadata`);
  }
  probe.evidence.forEach((entry, index) => {
    allowedKeys(entry, ["command", "exitCode"], ["command", "exitCode"], errors, `capabilityProbe.evidence[${index}]`);
    if (typeof entry?.command !== "string" || entry.command.trim() === "") add(errors, `capabilityProbe.evidence[${index}].command is required`);
    if (!Number.isInteger(entry?.exitCode)) add(errors, `capabilityProbe.evidence[${index}].exitCode must be an integer`);
  });
}

function validatePreflight(preflight, errors) {
  if (!["passed", "failed"].includes(preflight?.status)) add(errors, "preflight.status must be passed or failed");
  if (!Array.isArray(preflight?.command) || preflight.command.some((part) => typeof part !== "string" || part === "")) add(errors, "preflight.command must be a string array");
  if (!Number.isInteger(preflight?.exitCode)) add(errors, "preflight.exitCode must be an integer");
  for (const field of ["errors", "warnings"]) {
    if (!Array.isArray(preflight?.[field])) {
      add(errors, `preflight.${field} must be an array`);
      continue;
    }
    preflight[field].forEach((entry, index) => {
      allowedKeys(entry, ["code", "file", "message"], ["code", "file", "message"], errors, `preflight.${field}[${index}]`);
    });
  }
  if (!Array.isArray(preflight?.files) || preflight.files.some((file) => typeof file !== "string")) add(errors, "preflight.files must be a string array");
  if (preflight?.status === "passed" && (preflight.exitCode !== 0 || preflight.errors?.length !== 0)) add(errors, "passed preflight requires exit code 0 and no errors");
  if (preflight?.status === "failed" && (preflight.exitCode === 0 || !Array.isArray(preflight.errors) || preflight.errors.length === 0)) add(errors, "failed preflight requires a nonzero exit code and errors");
}

function insideRoot(root, target) {
  const relative = path.relative(root, target);
  return relative !== "" && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

async function validateOutputFile(job, format, canonicalRoot, errors, location) {
  if (typeof job.outputPath !== "string" || job.outputPath !== job.plannedOutputPath) {
    add(errors, `${location}.outputPath must equal the planned derivative path`);
    return;
  }
  const resolved = path.resolve(job.outputPath);
  if (!insideRoot(canonicalRoot, resolved)) add(errors, `${location}.outputPath must stay inside outputRoot`);
  if (path.extname(resolved).toLocaleLowerCase("en-US") !== `.${format}`) add(errors, `${location}.outputPath extension must be .${format}`);
  try {
    const stat = await lstat(resolved);
    if (stat.isSymbolicLink() || !stat.isFile()) throw new Error("not a regular file");
    const canonical = await realpath(resolved);
    if (!insideRoot(canonicalRoot, canonical)) throw new Error("outside output root");
    const bytes = await readFile(canonical);
    const actualDigest = createHash("sha256").update(bytes).digest("hex");
    if (job.digest !== actualDigest) add(errors, `${location}.digest does not match the actual derivative`);
  } catch (cause) {
    add(errors, `${location}.outputPath is unavailable or unsafe: ${cause.message}`);
  }
}

function validateEvidence(job, format, errors, location) {
  if (!Array.isArray(job?.evidence)) {
    add(errors, `${location}.evidence must be an array`);
    return;
  }
  const stages = new Set();
  for (const [index, entry] of job.evidence.entries()) {
    allowedKeys(
      entry,
      ["stage", "status", "derivativePath", "digest", "command", "exitCode", "count", "details"],
      ["stage", "status", "derivativePath", "digest", "command", "exitCode"],
      errors,
      `${location}.evidence[${index}]`,
    );
    if (!["generation", "renderer", "qa"].includes(entry?.stage)) add(errors, `${location}.evidence[${index}].stage is invalid`);
    if (!["passed", "failed"].includes(entry?.status)) add(errors, `${location}.evidence[${index}].status is invalid`);
    if (typeof entry?.command !== "string" || entry.command.trim() === "") add(errors, `${location}.evidence[${index}].command is required`);
    if (!Number.isInteger(entry?.exitCode)) add(errors, `${location}.evidence[${index}].exitCode must be an integer`);
    if (entry?.status === "passed" && entry.exitCode !== 0) add(errors, `${location}.evidence[${index}] passed evidence requires exit code 0`);
    if (entry?.status === "failed" && entry.exitCode === 0) add(errors, `${location}.evidence[${index}] failed evidence requires a nonzero exit code`);
    if (entry?.derivativePath !== job.outputPath) add(errors, `${location}.evidence[${index}] must reference the same derivative path`);
    if (entry?.digest !== job.digest) add(errors, `${location}.evidence[${index}] must reference the same derivative digest`);
    if (Object.hasOwn(entry ?? {}, "count") && entry.count !== job.pageOrSlideCount) add(errors, `${location}.evidence[${index}].count must equal pageOrSlideCount`);
    const expectedStatus = { generation: job.generationStatus, renderer: job.rendererStatus, qa: job.qaStatus }[entry?.stage];
    if (entry?.status !== expectedStatus) add(errors, `${location}.evidence[${index}].status must match its stage status`);
    if (stages.has(entry?.stage)) add(errors, `${location} may contain only one evidence entry per stage`);
    stages.add(entry?.stage);
  }
  if (job.status === "passed") {
    if (job.evidence.some(({ status }) => status === "failed")) add(errors, `${location} passed state cannot contain failed evidence`);
    if (!stages.has("generation") || !stages.has("qa")) add(errors, `${location} passed state requires generation and QA evidence`);
    if (format !== "md" && !stages.has("renderer")) add(errors, `${location} passed ${format} requires renderer evidence`);
    if (format === "md" && stages.has("renderer")) add(errors, `${location} Markdown must not claim renderer evidence`);
  }
}

function validateJobShape(job, format, probe, errors) {
  const location = `formats.${format}`;
  exactKeys(job, [
    "requested", "extension", "capability", "status", "statusHistory", "generationStatus", "rendererStatus", "qaStatus",
    "plannedOutputPath", "outputPath", "digest", "pageOrSlideCount", "evidence", "limitations",
  ], errors, location);
  if (typeof job?.requested !== "boolean") add(errors, `${location}.requested must be boolean`);
  if (job?.extension !== format) add(errors, `${location}.extension must be ${format}`);
  validateCapability(job?.capability, errors, `${location}.capability`);
  const expectedCapability = FORMAT_CAPABILITIES[format];
  if (job?.capability?.name !== expectedCapability) add(errors, `${location}.capability.name must be ${expectedCapability}`);
  if (format === "md") {
    if (job?.capability?.available !== true || Object.keys(job?.capability ?? {}).some((key) => !["name", "available"].includes(key))) add(errors, `${location} canonical Markdown capability must be built in`);
  } else if (probe?.status === "provided") {
    const expected = probe.capabilities?.[expectedCapability];
    const actual = { ...job?.capability };
    delete actual.name;
    if (!sameFlatObject(actual, expected)) add(errors, `${location}.capability must equal the capability probe snapshot`);
  } else if (job?.capability?.available !== false) add(errors, `${location} cannot claim an available capability without a probe`);
  validateStatusHistory(job, errors, location);
  if (!Array.isArray(job?.limitations)) add(errors, `${location}.limitations must be an array`);
  else if (job.limitations.some((limitation) => typeof limitation !== "string")) add(errors, `${location}.limitations must contain strings`);
  if (typeof job?.plannedOutputPath !== "string" || path.extname(job.plannedOutputPath).toLocaleLowerCase("en-US") !== `.${format}`) {
    add(errors, `${location}.plannedOutputPath must use .${format}`);
  }
  const notRequested = job?.status === "not-requested";
  if (!["not-run", "passed", "failed"].includes(job?.generationStatus)) add(errors, `${location}.generationStatus is invalid`);
  if (!["not-run", "not-required", "passed", "failed"].includes(job?.rendererStatus)) add(errors, `${location}.rendererStatus is invalid`);
  if (!["not-run", "passed", "failed"].includes(job?.qaStatus)) add(errors, `${location}.qaStatus is invalid`);
  if (job?.requested === notRequested) add(errors, `${location}.requested must be the exact inverse of not-requested status`);
  if (["not-requested", "blocked", "unavailable", "pending"].includes(job?.status)) {
    if ([job.generationStatus, job.rendererStatus, job.qaStatus].some((status) => status !== "not-run")) add(errors, `${location} inactive states must remain not-run`);
    if (job.outputPath !== null || job.digest !== null || job.pageOrSlideCount !== null || !Array.isArray(job.evidence) || job.evidence.length !== 0) add(errors, `${location} inactive states cannot claim derivative evidence`);
  }
  if (job?.status === "unavailable" && job.capability?.available !== false) add(errors, `${location} unavailable state requires unavailable capability`);
  if (["pending", "passed"].includes(job?.status) && job.capability?.available !== true) add(errors, `${location} active state requires available capability`);
  if (job?.status === "passed") {
    if (job.generationStatus !== "passed" || job.qaStatus !== "passed") add(errors, `${location} passed state requires passed generation and QA`);
    const expectedRenderer = format === "md" ? "not-required" : "passed";
    if (job.rendererStatus !== expectedRenderer) add(errors, `${location}.rendererStatus must be ${expectedRenderer}`);
    if (!Number.isInteger(job.pageOrSlideCount) || job.pageOrSlideCount < 1) add(errors, `${location}.pageOrSlideCount must be positive`);
  }
  if (job?.status === "failed" && !job.evidence?.some(({ status }) => status === "failed")) add(errors, `${location} failed state requires failed evidence`);
  if (job?.status === "failed" && ![job.generationStatus, job.rendererStatus, job.qaStatus].includes("failed")) add(errors, `${location} failed state requires an exact failed stage`);
  validateEvidence(job, format, errors, location);
}

function normalizedHeading(value) {
  return value.trim().replace(/\s*\{#[a-z0-9-]+\}\s*$/iu, "").toLocaleLowerCase("en-US");
}

function validatePresentation(presentation, canonicalHeadings, errors) {
  exactKeys(presentation, ["audience", "purpose", "slideOutline"], errors, "presentation");
  if (typeof presentation?.audience !== "string" || presentation.audience.trim() === "") add(errors, "presentation.audience is required");
  if (typeof presentation?.purpose !== "string" || presentation.purpose.trim() === "") add(errors, "presentation.purpose is required");
  if (!Array.isArray(presentation?.slideOutline) || presentation.slideOutline.length === 0) {
    add(errors, "presentation.slideOutline must be nonempty");
    return;
  }
  const ids = new Set();
  const headings = new Set(canonicalHeadings.map(normalizedHeading));
  presentation.slideOutline.forEach((slide, index) => {
    const location = `presentation.slideOutline[${index}]`;
    exactKeys(slide, ["id", "title", "message", "purpose"], errors, location);
    for (const field of ["id", "title", "message", "purpose"]) if (typeof slide?.[field] !== "string" || slide[field].trim() === "") add(errors, `${location}.${field} is required`);
    if (typeof slide?.id === "string" && (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(slide.id) || ids.has(slide.id))) add(errors, `${location}.id must be unique kebab-case`);
    ids.add(slide?.id);
    for (const field of ["title", "message", "purpose"]) if (typeof slide?.[field] === "string" && /^\s{0,3}#{1,6}\s+/u.test(slide[field])) add(errors, `${location}.${field} must not use Markdown heading syntax`);
    if (typeof slide?.title === "string" && headings.has(normalizedHeading(slide.title))) add(errors, `${location}.title must not copy a canonical structural heading`);
  });
}

export async function validateStudioExportManifest(manifest, { outputRoot } = {}) {
  const errors = [];
  assertPlainTree(manifest, errors);
  const topKeys = ["schemaVersion", "artifact", "preflight", "recipe", "capabilityProbe", "formats", "artifactPreservation"];
  if (Object.hasOwn(manifest ?? {}, "presentation")) topKeys.push("presentation");
  exactKeys(manifest, topKeys, errors, "manifest");
  if (manifest?.schemaVersion !== 1) add(errors, "schemaVersion must be 1");
  exactKeys(manifest?.artifact, ["id", "directory"], errors, "artifact");
  exactKeys(manifest?.preflight, ["status", "command", "exitCode", "errors", "warnings", "files"], errors, "preflight");
  validatePreflight(manifest?.preflight, errors);
  exactKeys(manifest?.recipe, ["id"], errors, "recipe");
  if (typeof manifest?.artifact?.id !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(manifest.artifact.id)) add(errors, "artifact.id must be kebab-case");
  if (typeof manifest?.artifact?.directory !== "string" || !path.isAbsolute(manifest.artifact.directory)) add(errors, "artifact.directory must be absolute");
  if (typeof manifest?.recipe?.id !== "string" || manifest.recipe.id === "") add(errors, "recipe.id is required");
  exactKeys(manifest?.artifactPreservation, ["canonicalArtifactMutated", "existingOutputsOverwritten"], errors, "artifactPreservation");
  if (manifest?.artifactPreservation?.canonicalArtifactMutated !== false || manifest?.artifactPreservation?.existingOutputsOverwritten !== false) add(errors, "artifact preservation must remain fail-closed");
  validateProbe(manifest?.capabilityProbe, errors);
  exactKeys(manifest?.formats, FORMATS, errors, "formats");
  for (const format of FORMATS) validateJobShape(manifest?.formats?.[format], format, manifest?.capabilityProbe, errors);
  const pptxRequested = manifest?.formats?.pptx?.requested === true;
  if (pptxRequested && !Object.hasOwn(manifest ?? {}, "presentation")) add(errors, "requested PPTX requires presentation");
  if (!pptxRequested && Object.hasOwn(manifest ?? {}, "presentation")) add(errors, "presentation is allowed only when PPTX is requested");
  if (Object.hasOwn(manifest ?? {}, "presentation")) {
    let headings = [];
    try {
      const source = await readFile(path.join(manifest.artifact.directory, "content.md"), "utf8");
      headings = [...source.matchAll(/^#{1,6}\s+(.+)$/gmu)].map(([, heading]) => heading.trim());
    } catch (cause) {
      add(errors, `presentation source headings are unavailable: ${cause.message}`);
    }
    validatePresentation(manifest.presentation, headings, errors);
  }

  let canonicalRoot;
  if (typeof outputRoot !== "string") add(errors, "outputRoot is required");
  else {
    try {
      const stat = await lstat(path.resolve(outputRoot));
      if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error("not a safe directory");
      canonicalRoot = await realpath(path.resolve(outputRoot));
    } catch (cause) {
      add(errors, `outputRoot is unavailable or unsafe: ${cause.message}`);
    }
  }
  if (canonicalRoot) {
    for (const format of FORMATS) {
      const job = manifest?.formats?.[format];
      if (typeof job?.plannedOutputPath === "string" && !insideRoot(canonicalRoot, path.resolve(job.plannedOutputPath))) add(errors, `formats.${format}.plannedOutputPath must stay inside outputRoot`);
      if (job?.status === "passed" || (job?.status === "failed" && typeof job.outputPath === "string")) await validateOutputFile(job, format, canonicalRoot, errors, `formats.${format}`);
    }
  }
  return { ok: errors.length === 0, errors, normalized: errors.length === 0 ? structuredClone(manifest) : null };
}
