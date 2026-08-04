#!/usr/bin/env node

import {
  existsSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const DOCUMENT_TYPES = new Set([
  "learning-plan",
  "portfolio",
  "reverse-design",
  "review",
  "interview-report",
  "transition-report",
]);
const FORMATS = ["md", "pdf", "docx", "pptx"];
const EXTENSIONS = { md: ".md", pdf: ".pdf", docx: ".docx", pptx: ".pptx" };
const AVAILABILITY = new Set(["unknown", "available", "unavailable"]);
const STATUSES = new Set(["not-requested", "blocked", "pending", "passed", "failed", "unavailable"]);
const EVIDENCE_KINDS = new Set(["capability-probe", "generation", "qa"]);
const EVIDENCE_RESULTS = new Set(["passed", "failed"]);

function requireRecord(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) throw new Error(`${label} has an unsafe prototype`);
  return value;
}

function exactKeys(value, allowed, label) {
  const record = requireRecord(value, label);
  for (const key of Reflect.ownKeys(record)) {
    if (typeof key !== "string" || !allowed.includes(key)) throw new Error(`${label} contains unknown or dangerous key: ${String(key)}`);
  }
  return record;
}

function requireArray(value, label) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) throw new Error(`${label} must be a plain array`);
  for (const key of Object.keys(value)) {
    if (!/^\d+$/u.test(key)) throw new Error(`${label} contains unknown or dangerous key: ${key}`);
  }
  return value;
}

function requireText(value, label) {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${label} must be a non-empty string`);
  return value;
}

function safeExistingFile(root, relativeFile, label) {
  requireText(relativeFile, label);
  if (path.isAbsolute(relativeFile)) throw new Error(`${label} must be a safe relative path`);
  const normalized = path.normalize(relativeFile);
  if (normalized === ".." || normalized.startsWith(`..${path.sep}`)) throw new Error(`${label} must be a safe relative path`);
  const rootReal = realpathSync(root);
  const candidate = path.resolve(rootReal, normalized);
  if (!candidate.startsWith(`${rootReal}${path.sep}`)) throw new Error(`${label} must be a safe relative path`);
  if (!existsSync(candidate)) throw new Error(`${label} does not exist: ${relativeFile}`);
  const candidateReal = realpathSync(candidate);
  if (!candidateReal.startsWith(`${rootReal}${path.sep}`)) throw new Error(`${label} must resolve inside artifactRoot`);
  return normalized.split(path.sep).join("/");
}

function validateDerivativeFile(root, format, file, label) {
  const normalized = safeExistingFile(root, file, label);
  if (path.extname(normalized).toLowerCase() !== EXTENSIONS[format]) {
    throw new Error(`${label} must use the ${EXTENSIONS[format]} extension for ${format}`);
  }
  return normalized;
}

function validateEvidence(root, format, input) {
  const evidence = requireArray(input, `${format}.evidence`);
  const normalized = [];
  const byKind = new Map();
  for (const [index, value] of evidence.entries()) {
    const item = exactKeys(value, ["kind", "command", "file", "result"], `${format}.evidence[${index}]`);
    if (!EVIDENCE_KINDS.has(item.kind)) throw new Error(`${format}.evidence[${index}].kind is invalid`);
    if (byKind.has(item.kind)) throw new Error(`${format}.evidence has contradictory or duplicate ${item.kind} evidence`);
    requireText(item.command, `${format}.evidence[${index}].command`);
    if (!EVIDENCE_RESULTS.has(item.result)) throw new Error(`${format}.evidence[${index}].result must be passed or failed`);
    const record = { kind: item.kind, command: item.command, result: item.result };
    if (item.kind === "generation" || item.kind === "qa") {
      record.file = validateDerivativeFile(root, format, item.file, `${format}.evidence[${index}].file`);
    } else if (item.file !== undefined) {
      record.file = safeExistingFile(root, item.file, `${format}.evidence[${index}].file`);
    }
    byKind.set(item.kind, record);
    normalized.push(record);
  }
  const generation = byKind.get("generation");
  const qa = byKind.get("qa");
  if (generation && qa && generation.file !== qa.file) {
    throw new Error(`${format} generation and qa evidence must reference the same derivative path`);
  }
  return { evidence: normalized, byKind };
}

function is(byKind, kind, result) {
  return byKind.get(kind)?.result === result;
}

function requireOnlyKinds(byKind, expected, label) {
  const actual = [...byKind.keys()].sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((kind, index) => kind !== wanted[index])) {
    throw new Error(`${label} requires exact evidence kinds: ${wanted.join(", ") || "none"}`);
  }
}

function validateTransition(format, requested, availability, status, byKind) {
  if (requested !== (status !== "not-requested")) throw new Error(`${format}.requested must equal status != not-requested`);
  const probe = byKind.get("capability-probe");
  if (availability === "unknown" && probe) throw new Error(`${format} unknown availability cannot have probe evidence`);
  if (availability === "available" && !is(byKind, "capability-probe", "passed")) {
    if (status === "passed") throw new Error(`${format} passed requires capability-probe, generation, and qa evidence`);
    throw new Error(`${format} available requires exactly passed capability-probe evidence`);
  }
  if (availability === "unavailable" && !is(byKind, "capability-probe", "failed")) {
    throw new Error(`${format} unavailable requires exactly failed capability-probe evidence`);
  }

  if (status === "not-requested" || status === "blocked") {
    if (availability !== "unknown") throw new Error(`${format} ${status} requires unknown availability`);
    requireOnlyKinds(byKind, [], `${format} ${status}`);
    return;
  }
  if (status === "unavailable") {
    if (availability !== "unavailable") throw new Error(`${format} status unavailable requires availability unavailable`);
    requireOnlyKinds(byKind, ["capability-probe"], `${format} unavailable`);
    return;
  }
  if (status === "pending") {
    if (availability === "unavailable") throw new Error(`${format} pending cannot use unavailable capability`);
    if (availability === "unknown") {
      requireOnlyKinds(byKind, [], `${format} pending with unknown capability`);
      return;
    }
    if (byKind.has("qa") || is(byKind, "generation", "failed")) {
      throw new Error(`${format} pending cannot contain terminal generation or qa evidence`);
    }
    requireOnlyKinds(byKind, byKind.has("generation") ? ["capability-probe", "generation"] : ["capability-probe"], `${format} pending`);
    return;
  }
  if (status === "passed") {
    if (availability !== "available") throw new Error(`${format} passed requires available capability`);
    requireOnlyKinds(byKind, ["capability-probe", "generation", "qa"], `${format} passed`);
    if (!["capability-probe", "generation", "qa"].every((kind) => is(byKind, kind, "passed"))) {
      throw new Error(`${format} passed rejects any failed probe, generation, or qa evidence`);
    }
    return;
  }
  if (status === "failed") {
    if (availability !== "available") throw new Error(`${format} failed requires available capability`);
    if (is(byKind, "generation", "failed") && !byKind.has("qa")) {
      requireOnlyKinds(byKind, ["capability-probe", "generation"], `${format} failed generation`);
      return;
    }
    if (is(byKind, "generation", "passed") && is(byKind, "qa", "failed")) {
      requireOnlyKinds(byKind, ["capability-probe", "generation", "qa"], `${format} failed qa`);
      return;
    }
    throw new Error(`${format} failed requires either failed generation without qa or passed generation with failed qa`);
  }
}

function validatePptx(job, status) {
  if (status === "blocked") {
    if (job.audience === undefined && job.purpose === undefined && job.storyOutline === undefined && job.outlineSource === undefined) return null;
  }
  requireText(job.audience, "pptx.audience");
  requireText(job.purpose, "pptx.purpose");
  if (job.outlineSource !== "independent-story") throw new Error("PPTX requires an independent story outline, not Markdown headings");
  const outline = requireArray(job.storyOutline, "pptx.storyOutline");
  if (outline.length === 0) throw new Error("PPTX requires a non-empty independent story outline");
  const storyOutline = outline.map((value, index) => {
    const slide = exactKeys(value, ["title", "message"], `pptx.storyOutline[${index}]`);
    requireText(slide.title, `pptx.storyOutline[${index}].title`);
    requireText(slide.message, `pptx.storyOutline[${index}].message`);
    return { title: slide.title, message: slide.message };
  });
  return { audience: job.audience, purpose: job.purpose, outlineSource: "independent-story", storyOutline };
}

function validateFormat(root, format, value) {
  const allowed = format === "pptx"
    ? ["requested", "availability", "status", "evidence", "audience", "purpose", "storyOutline", "outlineSource"]
    : ["requested", "availability", "status", "evidence"];
  const input = exactKeys(value, allowed, `formats.${format}`);
  if (typeof input.requested !== "boolean") throw new Error(`${format}.requested must be boolean`);
  if (!AVAILABILITY.has(input.availability)) throw new Error(`${format}.availability is invalid`);
  if (!STATUSES.has(input.status)) throw new Error(`${format}.status is invalid`);
  const { evidence, byKind } = validateEvidence(root, format, input.evidence);
  validateTransition(format, input.requested, input.availability, input.status, byKind);
  const pptx = format === "pptx" && input.requested ? validatePptx(input, input.status) : null;
  const normalized = {
    requested: input.requested,
    availability: input.availability,
    status: input.status,
    evidence,
  };
  if (pptx) Object.assign(normalized, pptx);
  return normalized;
}

export function prepareCareerExport(value) {
  const input = exactKeys(value, ["schemaVersion", "artifactRoot", "artifactId", "documentType", "canonicalValidation", "formats"], "export job");
  if (input.schemaVersion !== 1) throw new Error("schemaVersion must be 1");
  requireText(input.artifactRoot, "artifactRoot");
  const root = realpathSync(input.artifactRoot);
  requireText(input.artifactId, "artifactId");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(input.artifactId)) throw new Error("artifactId must be kebab-case");
  if (!DOCUMENT_TYPES.has(input.documentType)) throw new Error("documentType is invalid");

  const canonical = exactKeys(input.canonicalValidation, ["status", "command", "file", "verification"], "canonicalValidation");
  if (canonical.status !== "passed") throw new Error("canonical validation must pass before derivative preparation");
  requireText(canonical.command, "canonicalValidation.command");
  requireText(canonical.verification, "canonicalValidation.verification");
  const canonicalFile = safeExistingFile(root, canonical.file, "canonicalValidation.file");

  const inputFormats = exactKeys(input.formats, FORMATS, "formats");
  const formats = {};
  for (const format of FORMATS) formats[format] = validateFormat(root, format, inputFormats[format]);
  return {
    schemaVersion: 1,
    artifactRoot: root,
    artifactId: input.artifactId,
    documentType: input.documentType,
    canonicalValidation: {
      status: "passed",
      command: canonical.command,
      file: canonicalFile,
      verification: canonical.verification,
    },
    formats,
  };
}

function usage() {
  console.error("usage: node prepare-career-export.mjs input.json [output.json]");
}

export function main(argv) {
  if (argv.length < 1 || argv.length > 2) {
    usage();
    return 2;
  }
  try {
    const input = JSON.parse(readFileSync(argv[0], "utf8"));
    const prepared = prepareCareerExport(input);
    const serialized = `${JSON.stringify(prepared, null, 2)}\n`;
    if (argv[1]) writeFileSync(argv[1], serialized, { encoding: "utf8", flag: "wx" });
    else process.stdout.write(serialized);
    return 0;
  } catch (error) {
    console.error(`prepare-career-export: ${error.message}`);
    return 1;
  }
}

export function isMainModule(metaUrl = import.meta.url, argvPath = process.argv[1]) {
  if (typeof argvPath !== "string" || argvPath.length === 0) return false;
  try {
    const modulePath = realpathSync(fileURLToPath(metaUrl));
    const invokedPath = realpathSync(fileURLToPath(pathToFileURL(argvPath)));
    return modulePath === invokedPath;
  } catch {
    return false;
  }
}

if (isMainModule()) {
  process.exit(main(process.argv.slice(2)));
}
