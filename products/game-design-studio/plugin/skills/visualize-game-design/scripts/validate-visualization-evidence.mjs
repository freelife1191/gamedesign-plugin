#!/usr/bin/env node

import { createHash } from "node:crypto";
import { lstat, readFile, realpath } from "node:fs/promises";
import path from "node:path";

const DANGEROUS_KEYS = new Set(["__proto__", "prototype", "constructor"]);
const STATUSES = new Set(["not-requested", "pending", "passed", "failed"]);

function error(errors, message) {
  errors.push(message);
}

function assertPlainTree(value, errors, location = "record") {
  if (value === null || typeof value !== "object") return;
  if (!Array.isArray(value) && ![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    error(errors, `${location} has an unsafe prototype`);
    return;
  }
  for (const key of Object.keys(value)) {
    if (DANGEROUS_KEYS.has(key)) error(errors, `${location}.${key} is prohibited`);
    assertPlainTree(value[key], errors, `${location}.${key}`);
  }
}

function exactKeys(value, required, errors, location) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    error(errors, `${location} must be an object`);
    return false;
  }
  const actual = Object.keys(value).sort();
  const expected = [...required].sort();
  if (actual.join("\0") !== expected.join("\0")) error(errors, `${location} keys must be exactly ${expected.join(", ")}`);
  return true;
}

function stageStatus(stage, errors, location) {
  if (!STATUSES.has(stage?.status)) error(errors, `${location}.status is invalid`);
}

function safeRelativeAsset(value, errors, location) {
  if (typeof value !== "string" || value === "" || value.includes("\0") || path.isAbsolute(value)) {
    error(errors, `${location} must be a safe relative asset path`);
    return null;
  }
  const normalized = path.posix.normalize(value.replaceAll("\\", "/"));
  if (normalized.startsWith("../") || normalized === ".." || !normalized.startsWith("assets/")) {
    error(errors, `${location} must stay inside assets/`);
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
    if (relative === "" || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
      throw new Error("outside artifact root");
    }
    return { path: canonicalTarget, bytes: await readFile(canonicalTarget) };
  } catch (cause) {
    error(errors, `${location} is unavailable or unsafe: ${cause.message}`);
    return null;
  }
}

function digest(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function svgDimensions(bytes, errors) {
  const source = bytes.toString("utf8");
  const match = /\bviewBox\s*=\s*["']\s*([-+\d.eE]+)\s+([-+\d.eE]+)\s+([-+\d.eE]+)\s+([-+\d.eE]+)\s*["']/u.exec(source);
  if (!match) {
    error(errors, "SVG requires a numeric viewBox");
    return null;
  }
  const width = Number(match[3]);
  const height = Number(match[4]);
  if (!(width > 0) || !(height > 0)) {
    error(errors, "SVG viewBox dimensions must be positive");
    return null;
  }
  return { width, height };
}

function pngDimensions(bytes, errors) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (bytes.length < 24 || !bytes.subarray(0, 8).equals(signature) || bytes.toString("ascii", 12, 16) !== "IHDR") {
    error(errors, "PNG requires a valid signature and IHDR");
    return null;
  }
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

function validateEvidenceArray(value, errors, location) {
  if (!Array.isArray(value) || value.length === 0) {
    error(errors, `${location} must be a nonempty evidence array`);
    return;
  }
  value.forEach((entry, index) => {
    exactKeys(entry, ["command", "exitCode"], errors, `${location}[${index}]`);
    if (typeof entry?.command !== "string" || entry.command === "") error(errors, `${location}[${index}].command is required`);
    if (!Number.isInteger(entry?.exitCode)) error(errors, `${location}[${index}].exitCode must be an integer`);
  });
}

export async function validateVisualizationEvidence(record, { artifactRoot } = {}) {
  const errors = [];
  assertPlainTree(record, errors);
  exactKeys(record, ["schemaVersion", "presetId", "requested", "planned", "generated", "linted", "rendered", "verified"], errors, "record");
  exactKeys(record?.requested, ["svg", "png"], errors, "requested");
  exactKeys(record?.planned, ["status", "sourceSectionIds", "svgPath", "pngPath"], errors, "planned");
  exactKeys(record?.generated, ["status", "svgPath", "svgDigest", "evidence"], errors, "generated");
  exactKeys(record?.linted, ["status", "svgPath", "svgDigest", "evidence"], errors, "linted");
  exactKeys(record?.rendered, ["status", "svgPath", "svgDigest", "pngPath", "pngDigest", "scale", "width", "height", "renderer", "evidence"], errors, "rendered");
  exactKeys(record?.verified, ["status", "svgPath", "svgDigest", "pngPath", "pngDigest", "width", "height", "checks"], errors, "verified");
  if (record?.schemaVersion !== 1) error(errors, "schemaVersion must be 1");
  if (typeof record?.presetId !== "string" || record.presetId === "") error(errors, "presetId is required");
  if (typeof record?.requested?.svg !== "boolean" || typeof record?.requested?.png !== "boolean") error(errors, "requested flags must be booleans");
  for (const name of ["planned", "generated", "linted", "rendered", "verified"]) stageStatus(record?.[name], errors, name);
  if (!Array.isArray(record?.planned?.sourceSectionIds) || record.planned.sourceSectionIds.length === 0) error(errors, "planned.sourceSectionIds must be nonempty");

  const stages = [record?.planned, record?.generated, record?.linted, record?.rendered, record?.verified];
  if (record?.requested?.svg !== true && stages.slice(0, 3).some((stage) => stage?.status !== "not-requested")) error(errors, "unrequested SVG stages must be not-requested");
  if (record?.requested?.png !== true && stages.slice(3).some((stage) => stage?.status !== "not-requested")) error(errors, "unrequested PNG stages must be not-requested");
  for (let index = 1; index < stages.length; index += 1) {
    if (stages[index]?.status === "passed" && stages[index - 1]?.status !== "passed") error(errors, `stage ${index} cannot pass before its predecessor`);
  }

  const svgPaths = [record?.planned?.svgPath, record?.generated?.svgPath, record?.linted?.svgPath, record?.rendered?.svgPath, record?.verified?.svgPath];
  const pngPaths = [record?.planned?.pngPath, record?.rendered?.pngPath, record?.verified?.pngPath];
  svgPaths.forEach((value, index) => safeRelativeAsset(value, errors, `svgPath[${index}]`));
  pngPaths.forEach((value, index) => safeRelativeAsset(value, errors, `pngPath[${index}]`));
  if (new Set(svgPaths).size !== 1) error(errors, "all stages must reference the same SVG path");
  if (new Set(pngPaths).size !== 1) error(errors, "all render stages must reference the same PNG path");

  let svgFile;
  let pngFile;
  if (typeof artifactRoot !== "string") error(errors, "artifactRoot is required");
  else {
    svgFile = await verifiedFile(artifactRoot, record?.planned?.svgPath, errors, "planned.svgPath");
    pngFile = await verifiedFile(artifactRoot, record?.planned?.pngPath, errors, "planned.pngPath");
  }
  if (svgFile) {
    const actualDigest = digest(svgFile.bytes);
    for (const [name, stage] of [["generated", record.generated], ["linted", record.linted], ["rendered", record.rendered], ["verified", record.verified]]) {
      if (stage.status === "passed" && stage.svgDigest !== actualDigest) error(errors, `${name}.svgDigest does not match the actual SVG`);
    }
  }
  if (pngFile) {
    const actualDigest = digest(pngFile.bytes);
    for (const [name, stage] of [["rendered", record.rendered], ["verified", record.verified]]) {
      if (stage.status === "passed" && stage.pngDigest !== actualDigest) error(errors, `${name}.pngDigest does not match the actual PNG`);
    }
  }
  if (record?.generated?.status === "passed") validateEvidenceArray(record.generated.evidence, errors, "generated.evidence");
  if (record?.linted?.status === "passed") validateEvidenceArray(record.linted.evidence, errors, "linted.evidence");
  if (record?.rendered?.status === "passed") validateEvidenceArray(record.rendered.evidence, errors, "rendered.evidence");

  if (svgFile && pngFile && record?.rendered?.status === "passed") {
    const svgSize = svgDimensions(svgFile.bytes, errors);
    const pngSize = pngDimensions(pngFile.bytes, errors);
    if (record.rendered.scale !== 2) error(errors, "rendered.scale must be 2");
    if (svgSize && pngSize) {
      if (pngSize.width !== svgSize.width * 2 || pngSize.height !== svgSize.height * 2) error(errors, "actual PNG dimensions must be exactly 2x the SVG viewBox");
      if (record.rendered.width !== pngSize.width || record.rendered.height !== pngSize.height) error(errors, "rendered dimensions must match the actual PNG");
      if (record.verified.width !== pngSize.width || record.verified.height !== pngSize.height) error(errors, "verified dimensions must match the actual PNG");
    }
  }
  if (record?.verified?.status === "passed") {
    const required = ["fit-to-page", "close-up", "alt-text", "source-fidelity"];
    if (!Array.isArray(record.verified.checks) || required.some((check) => !record.verified.checks.includes(check))) error(errors, "verified checks are incomplete");
  }
  return { ok: errors.length === 0, errors, normalized: errors.length === 0 ? structuredClone(record) : null };
}
