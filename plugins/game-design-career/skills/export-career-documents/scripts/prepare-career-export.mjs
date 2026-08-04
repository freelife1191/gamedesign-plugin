#!/usr/bin/env node

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
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
const AVAILABILITY = new Set(["unknown", "available", "unavailable"]);
const PREPARATION_STATUSES = new Set(["not-requested", "blocked", "pending", "unavailable"]);
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

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function validatorPath() {
  const candidates = [
    new URL("../../../scripts/validate-artifact.mjs", import.meta.url),
  ];
  for (const candidate of candidates) {
    try {
      const resolved = realpathSync(fileURLToPath(candidate));
      if (existsSync(resolved)) return resolved;
    } catch {}
  }
  throw new Error("shared validateArtifact is unavailable");
}

function validateCanonicalArtifact(root, artifactId, canonicalFile) {
  if (canonicalFile !== "content.md") throw new Error("canonicalValidation.file must be content.md");
  const run = spawnSync(process.execPath, [validatorPath(), root], { encoding: "utf8" });
  let result;
  try {
    result = JSON.parse(run.stdout);
  } catch {
    throw new Error(`canonical validator returned invalid output: ${run.stderr.trim()}`);
  }
  if (run.status !== 0 || !result?.ok) {
    const details = result?.errors?.map(({ code, message }) => `${code}: ${message}`).join("; ") || run.stderr.trim();
    throw new Error(`canonical validation must pass before derivative preparation: ${details}`);
  }
  const bytes = readFileSync(path.join(root, canonicalFile));
  const frontmatter = bytes.toString("utf8").match(/^---\n([\s\S]*?)\n---\n/u)?.[1] ?? "";
  const canonicalId = frontmatter.match(/^artifact_id:\s*([^\n]+)$/mu)?.[1]?.trim();
  if (canonicalId !== artifactId) throw new Error("artifactId must match content.md frontmatter artifact_id");
  return { sha256: sha256(bytes), size: bytes.length };
}

function validateProbeEvidence(format, value) {
  const evidence = requireArray(value, `${format}.evidence`);
  if (evidence.length === 0) return [];
  if (evidence.length !== 1) throw new Error(`${format}.evidence permits at most one capability-probe during preparation`);
  const candidate = requireRecord(evidence[0], `${format}.evidence[0]`);
  if (candidate.kind !== "capability-probe") {
    throw new Error(`${format} preparation rejects generation and qa evidence; terminal verification belongs downstream`);
  }
  const item = exactKeys(candidate, ["kind", "command", "result"], `${format}.evidence[0]`);
  requireText(item.command, `${format}.evidence[0].command`);
  if (!EVIDENCE_RESULTS.has(item.result)) throw new Error(`${format}.evidence[0].result must be passed or failed`);
  return [{ kind: "capability-probe", command: item.command, result: item.result }];
}

function validateTransition(format, requested, availability, status, evidence) {
  if (requested !== (status !== "not-requested")) throw new Error(`${format}.requested must equal status != not-requested`);
  const probe = evidence[0];
  if (status === "not-requested" || status === "blocked") {
    if (availability !== "unknown" || probe) throw new Error(`${format} ${status} requires unknown availability and no evidence`);
    return;
  }
  if (status === "pending") {
    if (availability === "unknown" && !probe) return;
    if (availability === "available" && probe?.result === "passed") return;
    throw new Error(`${format} pending requires unknown/no evidence or available/passed capability-probe`);
  }
  if (availability !== "unavailable" || probe?.result !== "failed") {
    throw new Error(`${format} unavailable requires unavailable availability and one failed capability-probe`);
  }
}

function validatePptx(job, status) {
  if (status === "blocked"
    && job.audience === undefined
    && job.purpose === undefined
    && job.storyOutline === undefined
    && job.outlineSource === undefined) return null;
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

function validateFormat(format, value) {
  const allowed = format === "pptx"
    ? ["requested", "availability", "status", "evidence", "audience", "purpose", "storyOutline", "outlineSource"]
    : ["requested", "availability", "status", "evidence"];
  const input = exactKeys(value, allowed, `formats.${format}`);
  if (typeof input.requested !== "boolean") throw new Error(`${format}.requested must be boolean`);
  if (!AVAILABILITY.has(input.availability)) throw new Error(`${format}.availability is invalid`);
  if (!PREPARATION_STATUSES.has(input.status)) {
    throw new Error(`${format} preparation cannot accept terminal status ${input.status}; use a trusted downstream renderer and format verifier`);
  }
  const evidence = validateProbeEvidence(format, input.evidence);
  validateTransition(format, input.requested, input.availability, input.status, evidence);
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
  const canonicalEvidence = validateCanonicalArtifact(root, input.artifactId, canonicalFile);

  const inputFormats = exactKeys(input.formats, FORMATS, "formats");
  const formats = {};
  for (const format of FORMATS) formats[format] = validateFormat(format, inputFormats[format]);
  return {
    schemaVersion: 1,
    artifactRoot: root,
    artifactId: input.artifactId,
    documentType: input.documentType,
    canonicalValidation: {
      status: "passed",
      command: `node ${path.basename(validatorPath())} ${path.basename(root)}`,
      file: canonicalFile,
      verification: "shared validateArtifact passed against the canonical artifact root",
      validatorId: "shared.validateArtifact/v1",
      sha256: canonicalEvidence.sha256,
      size: canonicalEvidence.size,
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

if (isMainModule()) process.exit(main(process.argv.slice(2)));
