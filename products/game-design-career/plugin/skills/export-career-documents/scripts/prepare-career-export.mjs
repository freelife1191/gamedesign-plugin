#!/usr/bin/env node

import {
  existsSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

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
const STATUSES = new Set(["not-requested", "blocked", "pending", "passed", "failed", "unavailable"]);
const EVIDENCE_KINDS = new Set(["capability-probe", "generation", "qa"]);

function requireText(value, label) {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${label} must be a non-empty string`);
  return value;
}

function safeExistingFile(root, relativeFile, label) {
  requireText(relativeFile, label);
  if (path.isAbsolute(relativeFile)) throw new Error(`${label} must be a safe relative path`);
  const normalized = path.normalize(relativeFile);
  if (normalized === ".." || normalized.startsWith(`..${path.sep}`)) {
    throw new Error(`${label} must be a safe relative path`);
  }
  const rootReal = realpathSync(root);
  const candidate = path.resolve(rootReal, normalized);
  if (!candidate.startsWith(`${rootReal}${path.sep}`)) throw new Error(`${label} must be a safe relative path`);
  if (!existsSync(candidate)) throw new Error(`${label} does not exist: ${relativeFile}`);
  const candidateReal = realpathSync(candidate);
  if (!candidateReal.startsWith(`${rootReal}${path.sep}`)) throw new Error(`${label} must resolve inside artifactRoot`);
  return normalized.split(path.sep).join("/");
}

function validateEvidence(root, format, evidence) {
  if (!Array.isArray(evidence)) throw new Error(`${format}.evidence must be an array`);
  return evidence.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error(`${format}.evidence[${index}] must be an object`);
    }
    if (!EVIDENCE_KINDS.has(item.kind)) throw new Error(`${format}.evidence[${index}].kind is invalid`);
    requireText(item.command, `${format}.evidence[${index}].command`);
    if (!new Set(["passed", "failed"]).has(item.result)) {
      throw new Error(`${format}.evidence[${index}].result must be passed or failed`);
    }
    const normalized = { ...item };
    if (item.kind === "generation" || item.kind === "qa") {
      normalized.file = safeExistingFile(root, item.file, `${format}.evidence[${index}].file`);
    } else if (item.file !== undefined) {
      normalized.file = safeExistingFile(root, item.file, `${format}.evidence[${index}].file`);
    }
    return normalized;
  });
}

function hasEvidence(evidence, kind, result) {
  return evidence.some((item) => item.kind === kind && item.result === result);
}

function validatePptx(job) {
  requireText(job.audience, "pptx.audience");
  requireText(job.purpose, "pptx.purpose");
  if (job.outlineSource !== "independent-story") {
    throw new Error("PPTX requires an independently authored independent story outline, not Markdown headings");
  }
  if (!Array.isArray(job.storyOutline) || job.storyOutline.length === 0) {
    throw new Error("PPTX requires a non-empty independent story outline");
  }
  for (const [index, slide] of job.storyOutline.entries()) {
    requireText(slide?.title, `pptx.storyOutline[${index}].title`);
    requireText(slide?.message, `pptx.storyOutline[${index}].message`);
  }
}

function validateFormat(root, format, input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error(`missing ${format} format job`);
  if (typeof input.requested !== "boolean") throw new Error(`${format}.requested must be boolean`);
  if (!AVAILABILITY.has(input.availability)) throw new Error(`${format}.availability is invalid`);
  if (!STATUSES.has(input.status)) throw new Error(`${format}.status is invalid`);
  const evidence = validateEvidence(root, format, input.evidence);
  const probePassed = hasEvidence(evidence, "capability-probe", "passed");
  const probeFailed = hasEvidence(evidence, "capability-probe", "failed");

  if (!input.requested && input.status !== "not-requested") {
    throw new Error(`${format} is not requested and must remain not-requested`);
  }
  if (input.availability === "unknown" && (probePassed || probeFailed)) {
    throw new Error(`${format} availability cannot stay unknown after probe evidence`);
  }
  if (input.status === "passed") {
    const all = ["capability-probe", "generation", "qa"];
    if (input.availability !== "available" || !all.every((kind) => hasEvidence(evidence, kind, "passed"))) {
      throw new Error(`${format} passed requires capability-probe, generation, and qa evidence with files and commands`);
    }
  }
  if (input.availability === "available" && !probePassed && input.requested) {
    throw new Error(`${format} available requires passed capability-probe evidence`);
  }
  if (input.availability === "unavailable" && !probeFailed) {
    throw new Error(`${format} unavailable requires failed probe evidence`);
  }
  if (input.status === "unavailable" && input.availability !== "unavailable") {
    throw new Error(`${format} status unavailable requires availability unavailable`);
  }
  if (input.status === "failed" && !(
    hasEvidence(evidence, "generation", "failed") || hasEvidence(evidence, "qa", "failed")
  )) throw new Error(`${format} failed requires failed generation or qa evidence`);
  if (format === "pptx" && input.requested) validatePptx(input);
  return { ...input, evidence };
}

export function prepareCareerExport(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("export job must be an object");
  if (input.schemaVersion !== 1) throw new Error("schemaVersion must be 1");
  requireText(input.artifactRoot, "artifactRoot");
  const root = realpathSync(input.artifactRoot);
  requireText(input.artifactId, "artifactId");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(input.artifactId)) throw new Error("artifactId must be kebab-case");
  if (!DOCUMENT_TYPES.has(input.documentType)) throw new Error("documentType is invalid");

  const canonical = input.canonicalValidation;
  if (!canonical || canonical.status !== "passed") throw new Error("canonical validation must pass before derivative preparation");
  requireText(canonical.command, "canonicalValidation.command");
  requireText(canonical.verification, "canonicalValidation.verification");
  const canonicalFile = safeExistingFile(root, canonical.file, "canonicalValidation.file");

  const formats = {};
  for (const format of FORMATS) formats[format] = validateFormat(root, format, input.formats?.[format]);
  return {
    schemaVersion: 1,
    artifactRoot: root,
    artifactId: input.artifactId,
    documentType: input.documentType,
    canonicalValidation: { ...canonical, file: canonicalFile },
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

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main(process.argv.slice(2)));
}
