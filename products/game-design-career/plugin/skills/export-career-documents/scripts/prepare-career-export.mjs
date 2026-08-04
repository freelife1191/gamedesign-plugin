#!/usr/bin/env node

import {
  existsSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { inflateRawSync } from "node:zlib";

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
const QA_VALIDATORS = {
  md: "career-export/md-canonical-identity-v1",
  pdf: "career-export/pdf-structure-v1",
  docx: "career-export/docx-ooxml-v1",
  pptx: "career-export/pptx-ooxml-v1",
};

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

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function validatorPath() {
  const candidates = [
    new URL("../../../scripts/validate-artifact.mjs", import.meta.url),
    new URL("../../../../../../shared/scripts/validate-artifact.mjs", import.meta.url),
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
  try { result = JSON.parse(run.stdout); } catch { throw new Error(`canonical validator returned invalid output: ${run.stderr.trim()}`); }
  if (run.status !== 0 || !result?.ok) {
    const details = result?.errors?.map(({ code, message }) => `${code}: ${message}`).join("; ") || run.stderr.trim();
    throw new Error(`canonical validation must pass before derivative preparation: ${details}`);
  }
  const bytes = readFileSync(path.join(root, canonicalFile));
  const frontmatter = bytes.toString("utf8").match(/^---\n([\s\S]*?)\n---\n/u)?.[1] ?? "";
  const canonicalId = frontmatter.match(/^artifact_id:\s*([^\n]+)$/mu)?.[1]?.trim();
  if (canonicalId !== artifactId) throw new Error("artifactId must match content.md frontmatter artifact_id");
  return { bytes, sha256: sha256(bytes), size: bytes.length };
}

function validatePdf(bytes) {
  const text = bytes.toString("latin1");
  if (!/^%PDF-1\.[0-9]/u.test(text) || !/%%EOF\s*$/u.test(text)) throw new Error("PDF requires a valid header and terminal EOF marker");
  if (!/\bxref\b/u.test(text) || !/\btrailer\b/u.test(text) || !/\bstartxref\b/u.test(text)) {
    throw new Error("PDF requires xref, trailer, and startxref structure");
  }
  if (!/\/Type\s*\/Catalog\b/u.test(text) || !/\/Type\s*\/Pages\b/u.test(text) || !/\/Type\s*\/Page\b/u.test(text)) {
    throw new Error("PDF requires catalog, pages, and page objects");
  }
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function readZipEntries(bytes) {
  let eocd = -1;
  for (let offset = Math.max(0, bytes.length - 65_557); offset <= bytes.length - 22; offset++) {
    if (bytes.readUInt32LE(offset) === 0x06054b50) eocd = offset;
  }
  if (eocd < 0 || eocd + 22 > bytes.length || eocd + 22 + bytes.readUInt16LE(eocd + 20) !== bytes.length) {
    throw new Error("OOXML requires an intact ZIP end-of-central-directory record at EOF");
  }
  const count = bytes.readUInt16LE(eocd + 10);
  const centralSize = bytes.readUInt32LE(eocd + 12);
  const centralOffset = bytes.readUInt32LE(eocd + 16);
  if (centralOffset + centralSize !== eocd) throw new Error("OOXML ZIP central directory boundaries are invalid");
  const entries = new Map();
  let cursor = centralOffset;
  for (let index = 0; index < count; index++) {
    if (cursor + 46 > eocd || bytes.readUInt32LE(cursor) !== 0x02014b50) throw new Error("OOXML ZIP central directory entry is invalid");
    const method = bytes.readUInt16LE(cursor + 10);
    const expectedCrc = bytes.readUInt32LE(cursor + 16);
    const compressedSize = bytes.readUInt32LE(cursor + 20);
    const uncompressedSize = bytes.readUInt32LE(cursor + 24);
    const nameLength = bytes.readUInt16LE(cursor + 28);
    const extraLength = bytes.readUInt16LE(cursor + 30);
    const commentLength = bytes.readUInt16LE(cursor + 32);
    const localOffset = bytes.readUInt32LE(cursor + 42);
    const name = bytes.toString("utf8", cursor + 46, cursor + 46 + nameLength);
    if (!name || entries.has(name) || localOffset + 30 > centralOffset || bytes.readUInt32LE(localOffset) !== 0x04034b50) {
      throw new Error("OOXML ZIP local entry identity is invalid");
    }
    const localNameLength = bytes.readUInt16LE(localOffset + 26);
    const localExtraLength = bytes.readUInt16LE(localOffset + 28);
    const localName = bytes.toString("utf8", localOffset + 30, localOffset + 30 + localNameLength);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = bytes.subarray(dataStart, dataStart + compressedSize);
    if (localName !== name || compressed.length !== compressedSize) throw new Error("OOXML ZIP local entry boundaries are invalid");
    let data;
    if (method === 0) data = compressed;
    else if (method === 8) data = inflateRawSync(compressed);
    else throw new Error(`OOXML ZIP compression method ${method} is unsupported`);
    if (data.length !== uncompressedSize) throw new Error("OOXML ZIP uncompressed size is invalid");
    if (crc32(data) !== expectedCrc || bytes.readUInt32LE(localOffset + 14) !== expectedCrc) {
      throw new Error("OOXML ZIP entry CRC is invalid");
    }
    entries.set(name, data);
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  if (cursor !== eocd) throw new Error("OOXML ZIP central directory count is invalid");
  return entries;
}

function validateOoxml(bytes, format) {
  const entries = readZipEntries(bytes);
  const required = format === "docx"
    ? ["[Content_Types].xml", "_rels/.rels", "word/document.xml", "word/_rels/document.xml.rels"]
    : ["[Content_Types].xml", "_rels/.rels", "ppt/presentation.xml", "ppt/_rels/presentation.xml.rels", "ppt/slides/slide1.xml", "ppt/slides/_rels/slide1.xml.rels"];
  for (const name of required) if (!entries.has(name)) throw new Error(`${format.toUpperCase()} package is missing required entry: ${name}`);
  for (const name of required.filter((entry) => entry.endsWith(".rels"))) {
    const relationships = entries.get(name).toString("utf8");
    if (!/<Relationships\b/u.test(relationships) || !/<Relationship\b/u.test(relationships)) {
      throw new Error(`${format.toUpperCase()} relationships are invalid: ${name}`);
    }
  }
  const rootRels = entries.get("_rels/.rels").toString("utf8");
  const packageTarget = format === "docx" ? "word/document.xml" : "ppt/presentation.xml";
  if (!rootRels.includes(`Target="${packageTarget}"`)) throw new Error(`${format.toUpperCase()} root relationship target is invalid`);
  if (format === "docx") {
    if (!/<w:document\b/u.test(entries.get("word/document.xml").toString("utf8"))) throw new Error("DOCX document root is invalid");
  } else {
    const presentationRels = entries.get("ppt/_rels/presentation.xml.rels").toString("utf8");
    if (!presentationRels.includes('Target="slides/slide1.xml"')) throw new Error("PPTX slide relationship target is invalid");
    if (!/<p:presentation\b/u.test(entries.get("ppt/presentation.xml").toString("utf8"))
      || !/<p:sld\b/u.test(entries.get("ppt/slides/slide1.xml").toString("utf8"))) {
      throw new Error("PPTX presentation or slide root is invalid");
    }
  }
}

function validateDerivativeBytes(root, format, relative, canonicalBytes, qa) {
  const bytes = readFileSync(path.join(root, relative));
  if (bytes.length === 0) throw new Error(`${format} derivative must not be empty`);
  if (qa.sha256 !== sha256(bytes) || qa.size !== bytes.length || qa.validatorId !== QA_VALIDATORS[format]) {
    throw new Error(`${format} QA digest, size, and validatorId must match independently recomputed evidence`);
  }
  if (format === "md" && !bytes.equals(canonicalBytes)) throw new Error("Markdown derivative must be byte-identical to canonical content.md");
  if (format === "pdf") validatePdf(bytes);
  if (format === "docx" || format === "pptx") validateOoxml(bytes, format);
}

function validateEvidence(root, format, input) {
  const evidence = requireArray(input, `${format}.evidence`);
  const normalized = [];
  const byKind = new Map();
  for (const [index, value] of evidence.entries()) {
    const item = exactKeys(value, ["kind", "command", "file", "result", "sha256", "size", "validatorId"], `${format}.evidence[${index}]`);
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
    if (item.kind === "qa" && item.result === "passed") {
      requireText(item.sha256, `${format}.evidence[${index}].sha256`);
      requireText(item.validatorId, `${format}.evidence[${index}].validatorId`);
      if (!Number.isSafeInteger(item.size) || item.size < 1) throw new Error(`${format}.evidence[${index}].size must be a positive safe integer`);
      Object.assign(record, { sha256: item.sha256, size: item.size, validatorId: item.validatorId });
    } else if (item.sha256 !== undefined || item.size !== undefined || item.validatorId !== undefined) {
      throw new Error(`${format} digest evidence is allowed only for passed QA`);
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

function validateFormat(root, format, value, canonicalBytes) {
  const allowed = format === "pptx"
    ? ["requested", "availability", "status", "evidence", "audience", "purpose", "storyOutline", "outlineSource"]
    : ["requested", "availability", "status", "evidence"];
  const input = exactKeys(value, allowed, `formats.${format}`);
  if (typeof input.requested !== "boolean") throw new Error(`${format}.requested must be boolean`);
  if (!AVAILABILITY.has(input.availability)) throw new Error(`${format}.availability is invalid`);
  if (!STATUSES.has(input.status)) throw new Error(`${format}.status is invalid`);
  const { evidence, byKind } = validateEvidence(root, format, input.evidence);
  validateTransition(format, input.requested, input.availability, input.status, byKind);
  if (input.status === "passed") validateDerivativeBytes(root, format, byKind.get("qa").file, canonicalBytes, byKind.get("qa"));
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
  for (const format of FORMATS) formats[format] = validateFormat(root, format, inputFormats[format], canonicalEvidence.bytes);
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

if (isMainModule()) {
  process.exit(main(process.argv.slice(2)));
}
