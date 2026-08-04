#!/usr/bin/env node

import { createHash } from "node:crypto";
import { lstat, readFile, realpath } from "node:fs/promises";
import path from "node:path";

const DANGEROUS_KEYS = new Set(["__proto__", "prototype", "constructor"]);
const STATUSES = new Set(["not-requested", "pending", "passed", "failed", "unavailable"]);
const PRESET_IDS = new Set([
  "core-motivation-loop", "state-rule-flow", "quest-content-progression",
  "economy-source-sink", "liveops-roadmap", "production-role-structure",
]);
const QA_CHECKS = Object.freeze(["fit-to-page", "close-up", "alt-text", "source-fidelity"]);
const STABLE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

function add(errors, message) { errors.push(message); }

function assertPlainTree(value, errors, location = "record") {
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

function exactKeys(value, required, errors, location) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    add(errors, `${location} must be an object`);
    return false;
  }
  if (Object.keys(value).sort().join("\0") !== [...required].sort().join("\0")) add(errors, `${location} keys must be exactly ${[...required].sort().join(", ")}`);
  return true;
}

function nonempty(value, errors, location) {
  if (typeof value !== "string" || value.trim() === "") add(errors, `${location} must be a nonempty string`);
}

function sameArray(left, right) {
  return Array.isArray(left) && Array.isArray(right) && left.length === right.length && left.every((value, index) => value === right[index]);
}

function validateSourceIds(value, errors, location) {
  if (!Array.isArray(value) || value.length === 0) {
    add(errors, `${location} must be nonempty`);
    return;
  }
  if (value.some((id) => typeof id !== "string" || !STABLE_ID.test(id))) add(errors, `${location} must contain stable kebab-case IDs`);
  if (new Set(value).size !== value.length) add(errors, `${location} must contain unique IDs`);
}

function safeRelativeAsset(value, errors, location, { nullable = false } = {}) {
  if (nullable && value === null) return null;
  if (typeof value !== "string" || value === "" || value.includes("\0") || path.isAbsolute(value)) {
    add(errors, `${location} must be a safe relative asset path`);
    return null;
  }
  const normalized = path.posix.normalize(value.replaceAll("\\", "/"));
  if (normalized.startsWith("../") || normalized === ".." || !normalized.startsWith("assets/")) {
    add(errors, `${location} must stay inside assets/`);
    return null;
  }
  return normalized;
}

async function verifiedFile(root, relativePath, errors, location) {
  const safe = safeRelativeAsset(relativePath, errors, location);
  if (!safe) return null;
  const target = path.resolve(root, safe);
  try {
    const stat = await lstat(target);
    if (stat.isSymbolicLink() || !stat.isFile()) throw new Error("not a regular file");
    const [canonicalRoot, canonicalTarget] = await Promise.all([realpath(root), realpath(target)]);
    const relative = path.relative(canonicalRoot, canonicalTarget);
    if (relative === "" || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw new Error("outside artifact root");
    return { bytes: await readFile(canonicalTarget) };
  } catch (cause) {
    add(errors, `${location} is unavailable or unsafe: ${cause.message}`);
    return null;
  }
}

function digest(bytes) { return createHash("sha256").update(bytes).digest("hex"); }

function svgMetadata(bytes, errors) {
  const source = bytes.toString("utf8");
  const viewBox = /\bviewBox\s*=\s*["']\s*([-+\d.eE]+)\s+([-+\d.eE]+)\s+([-+\d.eE]+)\s+([-+\d.eE]+)\s*["']/u.exec(source);
  const title = /<title(?:\s[^>]*)?>([\s\S]*?)<\/title>/iu.exec(source)?.[1]?.trim();
  const description = /<desc(?:\s[^>]*)?>([\s\S]*?)<\/desc>/iu.exec(source)?.[1]?.trim();
  if (!viewBox) add(errors, "SVG requires a numeric viewBox");
  if (!title) add(errors, "SVG requires a nonempty title");
  if (!description) add(errors, "SVG requires a nonempty desc");
  const width = viewBox ? Number(viewBox[3]) : 0;
  const height = viewBox ? Number(viewBox[4]) : 0;
  if (viewBox && (!(width > 0) || !(height > 0))) add(errors, "SVG viewBox dimensions must be positive");
  return { width, height, description };
}

function pngDimensions(bytes, errors) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (bytes.length < 24 || !bytes.subarray(0, 8).equals(signature) || bytes.toString("ascii", 12, 16) !== "IHDR") {
    add(errors, "PNG requires a valid signature and IHDR");
    return null;
  }
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

function validateEvidence(stage, expectedKeys, errors, location) {
  if (!Array.isArray(stage?.evidence)) {
    add(errors, `${location}.evidence must be an array`);
    return;
  }
  const active = ["passed", "failed"].includes(stage.status);
  if (active && stage.evidence.length === 0) add(errors, `${location}.evidence must be nonempty`);
  if (!active && stage.evidence.length !== 0) add(errors, `${location} inactive states cannot claim evidence`);
  stage.evidence.forEach((entry, index) => {
    exactKeys(entry, expectedKeys, errors, `${location}.evidence[${index}]`);
    nonempty(entry?.command, errors, `${location}.evidence[${index}].command`);
    if (!Number.isInteger(entry?.exitCode)) add(errors, `${location}.evidence[${index}].exitCode must be an integer`);
    if (stage.status === "passed" && entry?.exitCode !== 0) add(errors, `${location} passed evidence requires exit code 0`);
    if (stage.status === "failed" && entry?.exitCode === 0) add(errors, `${location} failed evidence requires a nonzero exit code`);
  });
}

export async function validateVisualizationEvidence(record, { artifactRoot } = {}) {
  const errors = [];
  assertPlainTree(record, errors);
  exactKeys(record, ["schemaVersion", "presetId", "requested", "planned", "generated", "linted", "rendered", "verified"], errors, "record");
  exactKeys(record?.requested, ["svg", "png"], errors, "requested");
  exactKeys(record?.planned, ["status", "sourceSectionIds", "altText", "svgPath", "pngPath"], errors, "planned");
  exactKeys(record?.generated, ["status", "svgPath", "svgDigest", "evidence"], errors, "generated");
  exactKeys(record?.linted, ["status", "svgPath", "svgDigest", "evidence"], errors, "linted");
  exactKeys(record?.rendered, ["status", "svgPath", "svgDigest", "pngPath", "pngDigest", "scale", "width", "height", "renderer", "rendererVersion", "evidence"], errors, "rendered");
  exactKeys(record?.verified, ["status", "svgPath", "svgDigest", "pngPath", "pngDigest", "width", "height", "sourceSectionIds", "altText", "checks"], errors, "verified");
  if (record?.schemaVersion !== 1) add(errors, "schemaVersion must be 1");
  if (!PRESET_IDS.has(record?.presetId)) add(errors, "presetId must identify a packaged visualization preset");
  if (typeof record?.requested?.svg !== "boolean" || typeof record?.requested?.png !== "boolean") add(errors, "requested flags must be booleans");
  for (const name of ["planned", "generated", "linted", "rendered", "verified"]) if (!STATUSES.has(record?.[name]?.status)) add(errors, `${name}.status is invalid`);
  validateSourceIds(record?.planned?.sourceSectionIds, errors, "planned.sourceSectionIds");
  validateSourceIds(record?.verified?.sourceSectionIds, errors, "verified.sourceSectionIds");
  nonempty(record?.planned?.altText, errors, "planned.altText");
  nonempty(record?.verified?.altText, errors, "verified.altText");

  if (record?.requested?.svg !== true && [record?.planned, record?.generated, record?.linted].some((stage) => stage?.status !== "not-requested")) add(errors, "unrequested SVG stages must be not-requested");
  if (record?.requested?.png !== true && [record?.rendered, record?.verified].some((stage) => stage?.status !== "not-requested")) add(errors, "unrequested PNG stages must be not-requested");
  if (record?.generated?.status === "passed" && record?.planned?.status !== "passed") add(errors, "generated cannot pass before planning");
  if (record?.linted?.status === "passed" && record?.generated?.status !== "passed") add(errors, "linted cannot pass before generation");
  if (["passed", "failed"].includes(record?.rendered?.status) && record?.linted?.status !== "passed") add(errors, "rendering requires a passed lint stage");
  if (record?.verified?.status === "passed" && record?.rendered?.status !== "passed") add(errors, "verification cannot pass before rendering");
  if (record?.verified?.status === "unavailable" && record?.rendered?.status !== "failed") add(errors, "unavailable PNG verification requires a failed render stage");

  const svgPaths = [record?.planned?.svgPath, record?.generated?.svgPath, record?.linted?.svgPath, record?.rendered?.svgPath, record?.verified?.svgPath];
  svgPaths.forEach((value, index) => safeRelativeAsset(value, errors, `svgPath[${index}]`));
  if (new Set(svgPaths).size !== 1) add(errors, "all stages must reference the same SVG path");
  safeRelativeAsset(record?.planned?.pngPath, errors, "planned.pngPath");
  safeRelativeAsset(record?.rendered?.pngPath, errors, "rendered.pngPath", { nullable: true });
  safeRelativeAsset(record?.verified?.pngPath, errors, "verified.pngPath", { nullable: true });
  if (record?.rendered?.status === "passed" && (record.rendered.pngPath !== record.planned.pngPath || record?.verified?.pngPath !== record.planned.pngPath)) add(errors, "all passed render stages must reference the planned PNG path");

  validateEvidence(record?.generated, ["command", "exitCode", "svgPath", "svgDigest", "sourceSectionIds"], errors, "generated");
  validateEvidence(record?.linted, ["command", "exitCode", "log", "svgPath", "svgDigest"], errors, "linted");
  validateEvidence(record?.rendered, ["command", "exitCode", "log", "renderer", "rendererVersion", "svgPath", "svgDigest", "pngPath", "pngDigest", "width", "height"], errors, "rendered");
  for (const entry of record?.generated?.evidence ?? []) {
    if (entry.svgPath !== record.generated.svgPath || entry.svgDigest !== record.generated.svgDigest) add(errors, "generated evidence must identify the generated SVG");
    if (!sameArray(entry.sourceSectionIds, record.planned.sourceSectionIds)) add(errors, "generated evidence must preserve the planned source mapping");
  }
  for (const entry of record?.linted?.evidence ?? []) {
    nonempty(entry.log, errors, "linted evidence log");
    if (entry.svgPath !== record.linted.svgPath || entry.svgDigest !== record.linted.svgDigest) add(errors, "lint evidence must identify the linted SVG");
  }
  nonempty(record?.rendered?.renderer, errors, "rendered.renderer");
  nonempty(record?.rendered?.rendererVersion, errors, "rendered.rendererVersion");
  for (const entry of record?.rendered?.evidence ?? []) {
    nonempty(entry.log, errors, "render evidence log");
    if (entry.renderer !== record.rendered.renderer || entry.rendererVersion !== record.rendered.rendererVersion) add(errors, "render evidence must identify the renderer and version");
    for (const field of ["svgPath", "svgDigest", "pngPath", "pngDigest", "width", "height"]) if (entry[field] !== record.rendered[field]) add(errors, `render evidence ${field} must match the render stage`);
  }

  let svgFile;
  let pngFile;
  if (typeof artifactRoot !== "string") add(errors, "artifactRoot is required");
  else {
    if ([record?.generated, record?.linted, record?.rendered, record?.verified].some((stage) => stage?.status === "passed") || record?.rendered?.status === "failed") svgFile = await verifiedFile(artifactRoot, record?.planned?.svgPath, errors, "planned.svgPath");
    if (record?.rendered?.status === "passed" || record?.verified?.status === "passed") pngFile = await verifiedFile(artifactRoot, record?.planned?.pngPath, errors, "planned.pngPath");
  }
  if (svgFile) {
    const actualDigest = digest(svgFile.bytes);
    const metadata = svgMetadata(svgFile.bytes, errors);
    for (const [name, stage] of [["generated", record.generated], ["linted", record.linted], ["rendered", record.rendered], ["verified", record.verified]]) {
      if (["passed", "failed", "unavailable"].includes(stage.status) && stage.svgDigest !== actualDigest) add(errors, `${name}.svgDigest does not match the actual SVG`);
    }
    if (metadata.description !== record?.planned?.altText || metadata.description !== record?.verified?.altText) add(errors, "SVG desc, planned alt text, and verified alt text must match");
    if (!sameArray(record?.verified?.sourceSectionIds, record?.planned?.sourceSectionIds)) add(errors, "verified source mapping must match the planned source mapping");
    if (pngFile && record?.rendered?.status === "passed") {
      const dimensions = pngDimensions(pngFile.bytes, errors);
      const actualPngDigest = digest(pngFile.bytes);
      if (record.rendered.pngDigest !== actualPngDigest || record.verified.pngDigest !== actualPngDigest) add(errors, "PNG digests must match the actual PNG");
      if (record.rendered.scale !== 2) add(errors, "rendered.scale must be 2");
      if (dimensions) {
        if (dimensions.width !== metadata.width * 2 || dimensions.height !== metadata.height * 2) add(errors, "actual PNG dimensions must be exactly 2x the SVG viewBox");
        if (record.rendered.width !== dimensions.width || record.rendered.height !== dimensions.height || record.verified.width !== dimensions.width || record.verified.height !== dimensions.height) add(errors, "recorded dimensions must match the actual PNG");
      }
    }
  }
  if (record?.rendered?.status === "failed" && [record.rendered.pngPath, record.rendered.pngDigest, record.rendered.width, record.rendered.height].some((value) => value !== null)) add(errors, "failed rendering cannot claim a PNG derivative");
  if (record?.verified?.status === "unavailable" && [record.verified.pngPath, record.verified.pngDigest, record.verified.width, record.verified.height].some((value) => value !== null)) add(errors, "unavailable PNG verification cannot claim a PNG derivative");
  if (record?.verified?.status === "passed") {
    if (!Array.isArray(record.verified.checks) || !sameArray([...record.verified.checks].sort(), [...QA_CHECKS].sort())) add(errors, "verified checks must equal the required QA set");
  } else if (!Array.isArray(record?.verified?.checks) || record.verified.checks.length !== 0) add(errors, "non-passed verification cannot claim QA checks");

  return { ok: errors.length === 0, errors, normalized: errors.length === 0 ? structuredClone(record) : null };
}
