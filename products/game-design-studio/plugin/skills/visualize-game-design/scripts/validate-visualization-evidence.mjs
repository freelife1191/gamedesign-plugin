#!/usr/bin/env node

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { lstat, mkdtemp, readFile, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";

import { resolveSkillsteadCli } from "./run-skillstead.mjs";

const DANGEROUS_KEYS = new Set(["__proto__", "prototype", "constructor"]);
const STATUSES = new Set(["not-requested", "pending", "passed", "failed", "unavailable"]);
const PRESET_IDS = new Set([
  "core-motivation-loop", "state-rule-flow", "quest-content-progression",
  "economy-source-sink", "liveops-roadmap", "production-role-structure",
]);
const QA_CHECKS = Object.freeze(["fit-to-page", "close-up", "alt-text", "source-fidelity"]);
const STABLE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const LINTER_ID = "Skillstead svg-infographic";
const LINTER_VERSION = "0.8.3";
const WRAPPER_PATH = "skills/visualize-game-design/scripts/run-skillstead.mjs";
const TRUSTED_RUNTIME_DIGESTS = Object.freeze({
  wrapper: "98d897f7c8ee0848592a926a1ccf0865838c2bf71064eda165e2d13f3a157220",
  linter: "3990a96078ce8c0c4692213820ce72fc228a1b827459792d5ccc45932f5f9a41",
  renderer: "5f2d6f43c1c6ee43e4c52c9bdf02053297e13ca3315ea16652741f3fe85e3d8e",
});
const lintCache = new Map();

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
    return { path: canonicalTarget, bytes: await readFile(canonicalTarget) };
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

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function inspectCompletePng(bytes) {
  const errors = [];
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (!Buffer.isBuffer(bytes) || bytes.length < 8 || !bytes.subarray(0, 8).equals(signature)) {
    return { ok: false, errors: ["PNG requires the canonical signature"], width: null, height: null };
  }
  let offset = 8;
  let chunkIndex = 0;
  let width = null;
  let height = null;
  let seenHeader = false;
  let seenData = false;
  let dataEnded = false;
  let seenEnd = false;
  let bitDepth = null;
  let colorType = null;
  let interlace = null;
  const imageData = [];
  while (offset < bytes.length && !seenEnd) {
    if (offset + 12 > bytes.length) {
      add(errors, `PNG chunk ${chunkIndex} is truncated`);
      break;
    }
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString("ascii", offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    const crcOffset = dataEnd;
    if (!/^[A-Za-z]{4}$/u.test(type) || crcOffset + 4 > bytes.length) {
      add(errors, `PNG chunk ${chunkIndex} has invalid framing`);
      break;
    }
    const expectedCrc = bytes.readUInt32BE(crcOffset);
    const actualCrc = crc32(bytes.subarray(offset + 4, dataEnd));
    if (expectedCrc !== actualCrc) add(errors, `PNG ${type} chunk CRC32 mismatch`);
    if (chunkIndex === 0 && type !== "IHDR") add(errors, "PNG IHDR must be the first chunk");
    if (!seenHeader && type !== "IHDR") add(errors, `PNG ${type} appears before IHDR`);
    if (type === "IHDR") {
      if (seenHeader || chunkIndex !== 0 || length !== 13) add(errors, "PNG requires exactly one 13-byte leading IHDR");
      else {
        seenHeader = true;
        width = bytes.readUInt32BE(dataStart);
        height = bytes.readUInt32BE(dataStart + 4);
        bitDepth = bytes[dataStart + 8];
        colorType = bytes[dataStart + 9];
        interlace = bytes[dataStart + 12];
        if (!(width > 0) || !(height > 0)) add(errors, "PNG IHDR dimensions must be positive");
        if (bytes[dataStart + 10] !== 0 || bytes[dataStart + 11] !== 0 || ![0, 1].includes(bytes[dataStart + 12])) add(errors, "PNG IHDR methods are invalid");
        if (interlace !== 0) add(errors, "PNG interlacing is unsupported; the packaged renderer emits non-interlaced PNGs");
      }
    } else if (type === "IDAT") {
      if (dataEnded) add(errors, "PNG IDAT chunks must be consecutive");
      seenData = true;
      imageData.push(bytes.subarray(dataStart, dataEnd));
    } else if (seenData && type !== "IEND") dataEnded = true;
    if (type === "IEND") {
      if (length !== 0 || !seenData) add(errors, "PNG IEND requires prior image data and zero length");
      seenEnd = true;
      if (crcOffset + 4 !== bytes.length) add(errors, "PNG IEND must end exactly at EOF");
    }
    offset = crcOffset + 4;
    chunkIndex += 1;
  }
  if (!seenHeader) add(errors, "PNG IHDR is missing");
  if (!seenData) add(errors, "PNG IDAT is missing");
  if (!seenEnd) add(errors, "PNG IEND is missing or truncated");
  if (seenHeader && seenData) {
    const channels = new Map([[0, 1], [2, 3], [3, 1], [4, 2], [6, 4]]).get(colorType);
    const validDepths = new Map([[0, [1, 2, 4, 8, 16]], [2, [8, 16]], [3, [1, 2, 4, 8]], [4, [8, 16]], [6, [8, 16]]]).get(colorType);
    if (!channels || !validDepths?.includes(bitDepth)) add(errors, "PNG IHDR bit depth and color type are incompatible");
    try {
      const pixels = inflateSync(Buffer.concat(imageData), { maxOutputLength: 256 * 1024 * 1024 });
      if (interlace === 0 && channels && validDepths?.includes(bitDepth)) {
        const rowBytes = Math.ceil((width * channels * bitDepth) / 8);
        const expectedLength = height * (rowBytes + 1);
        if (pixels.length !== expectedLength) add(errors, "PNG decompressed image data length does not match IHDR");
        else {
          for (let row = 0; row < height; row += 1) if (pixels[row * (rowBytes + 1)] > 4) add(errors, `PNG row ${row} has an invalid filter type`);
        }
      }
    } catch (cause) {
      add(errors, `PNG IDAT zlib stream is invalid: ${cause.message}`);
    }
  }
  return { ok: errors.length === 0, errors, width, height };
}

async function canonicalRegularFile(filePath) {
  const canonicalPath = await realpath(filePath);
  const stat = await lstat(canonicalPath);
  if (!stat.isFile()) throw new Error(`${filePath} is not a regular file`);
  return canonicalPath;
}

async function skillsteadRuntime(errors, testRuntime) {
  try {
    const injected = testRuntime && typeof testRuntime === "object" && !Array.isArray(testRuntime);
    const [wrapperPath, linterPath, rendererPath] = injected
      ? await Promise.all([
        canonicalRegularFile(testRuntime.wrapperPath),
        canonicalRegularFile(testRuntime.linterPath),
        canonicalRegularFile(testRuntime.rendererPath),
      ])
      : await Promise.all([
        canonicalRegularFile(fileURLToPath(new URL("./run-skillstead.mjs", import.meta.url))),
        resolveSkillsteadCli("lint"),
        resolveSkillsteadCli("render"),
      ]);
    const [wrapperBytes, linterBytes, rendererBytes] = await Promise.all([readFile(wrapperPath), readFile(linterPath), readFile(rendererPath)]);
    const runtime = {
      wrapperPath,
      linterPath,
      rendererPath,
      wrapperDigest: digest(wrapperBytes),
      linterDigest: digest(linterBytes),
      rendererDigest: digest(rendererBytes),
    };
    if (injected && Object.entries(TRUSTED_RUNTIME_DIGESTS).some(([name, expected]) => runtime[`${name}Digest`] !== expected)) {
      throw new Error("test runtime bytes do not match the pinned packaged runtime");
    }
    return runtime;
  } catch (cause) {
    add(errors, `Packaged Skillstead runtime is unavailable: ${cause.message}`);
    return null;
  }
}

function rendererIdentity(log) {
  const match = /^renderer:\s+(.+?)\s+\((.+?)\)\s+\[via .+\]$/imu.exec(log);
  return match ? { renderer: match[1], rendererVersion: match[2], line: match[0] } : null;
}

async function independentlyRender(svgFile, runtime, errors) {
  const directory = await mkdtemp(path.join(tmpdir(), "studio-independent-render-"));
  const outputPath = path.join(directory, "verified.png");
  let result;
  try {
    const execution = spawnSync(process.execPath, [runtime.wrapperPath, "render", svgFile.path, outputPath], {
      encoding: "utf8",
      maxBuffer: 4 * 1024 * 1024,
      timeout: 150_000,
    });
    const log = `${execution.stdout ?? ""}${execution.stderr ?? ""}`.trim();
    let bytes = null;
    try { bytes = await readFile(outputPath); } catch { /* reported below */ }
    result = {
      status: execution.status,
      error: execution.error?.message ?? null,
      log,
      bytes,
      inspection: bytes ? inspectCompletePng(bytes) : null,
      identity: rendererIdentity(log),
    };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
  if (result.error || result.status !== 0 || !result.bytes || !result.inspection?.ok || !result.identity) {
    add(errors, `Independent Skillstead render failed: ${result.error || result.inspection?.errors.join("; ") || result.log || `exit ${result.status}`}`);
    return null;
  }
  return result;
}

function independentlyLint(svgFile, runtime, errors) {
  const key = `${runtime.linterDigest}:${digest(svgFile.bytes)}`;
  let result = lintCache.get(key);
  if (!result) {
    const execution = spawnSync(process.execPath, [runtime.linterPath, svgFile.path], { encoding: "utf8", maxBuffer: 4 * 1024 * 1024 });
    const log = `${execution.stdout ?? ""}${execution.stderr ?? ""}`.trim();
    result = { status: execution.status, error: execution.error?.message ?? null, log };
    lintCache.set(key, result);
  }
  if (result.error || result.status !== 0 || !/check-svg:\s*0 error\(s\)/iu.test(result.log)) {
    add(errors, `Independent Skillstead lint failed: ${result.error || result.log || `exit ${result.status}`}`);
  }
}

function validateEvidence(stage, expectedKeys, errors, location) {
  const evidence = Array.isArray(stage?.evidence) ? stage.evidence : [];
  if (!Array.isArray(stage?.evidence)) {
    add(errors, `${location}.evidence must be an array`);
    return;
  }
  const active = ["passed", "failed"].includes(stage.status);
  if (active && evidence.length === 0) add(errors, `${location}.evidence must be nonempty`);
  if (!active && evidence.length !== 0) add(errors, `${location} inactive states cannot claim evidence`);
  evidence.forEach((entry, index) => {
    if (!exactKeys(entry, expectedKeys, errors, `${location}.evidence[${index}]`)) return;
    nonempty(entry?.command, errors, `${location}.evidence[${index}].command`);
    if (!Number.isInteger(entry?.exitCode)) add(errors, `${location}.evidence[${index}].exitCode must be an integer`);
    if (stage.status === "passed" && entry?.exitCode !== 0) add(errors, `${location} passed evidence requires exit code 0`);
    if (stage.status === "failed" && entry?.exitCode === 0) add(errors, `${location} failed evidence requires a nonzero exit code`);
  });
}

export async function validateVisualizationEvidence(record, { artifactRoot, testRuntime } = {}) {
  const errors = [];
  assertPlainTree(record, errors);
  exactKeys(record, ["schemaVersion", "presetId", "requested", "planned", "generated", "linted", "rendered", "verified"], errors, "record");
  exactKeys(record?.requested, ["svg", "png"], errors, "requested");
  exactKeys(record?.planned, ["status", "sourceSectionIds", "altText", "svgPath", "pngPath"], errors, "planned");
  exactKeys(record?.generated, ["status", "svgPath", "svgDigest", "evidence"], errors, "generated");
  exactKeys(record?.linted, ["status", "svgPath", "svgDigest", "linter", "linterVersion", "linterDigest", "evidence"], errors, "linted");
  exactKeys(record?.rendered, ["status", "svgPath", "svgDigest", "pngPath", "pngDigest", "scale", "width", "height", "renderer", "rendererVersion", "rendererDigest", "evidence"], errors, "rendered");
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
  validateEvidence(record?.linted, ["command", "exitCode", "log", "linter", "linterVersion", "linterDigest", "svgPath", "svgDigest"], errors, "linted");
  validateEvidence(record?.rendered, ["command", "exitCode", "log", "renderer", "rendererVersion", "rendererDigest", "svgPath", "svgDigest", "pngPath", "pngDigest", "width", "height"], errors, "rendered");
  for (const entry of Array.isArray(record?.generated?.evidence) ? record.generated.evidence : []) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    if (entry.svgPath !== record.generated.svgPath || entry.svgDigest !== record.generated.svgDigest) add(errors, "generated evidence must identify the generated SVG");
    if (!sameArray(entry.sourceSectionIds, record.planned.sourceSectionIds)) add(errors, "generated evidence must preserve the planned source mapping");
  }
  for (const entry of Array.isArray(record?.linted?.evidence) ? record.linted.evidence : []) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    nonempty(entry.log, errors, "linted evidence log");
    if (entry.command !== `node ${WRAPPER_PATH} lint ${record.linted.svgPath}`) add(errors, "lint evidence must use the packaged Skillstead wrapper for the exact SVG");
    if (entry.linter !== record.linted.linter || entry.linterVersion !== record.linted.linterVersion || entry.linterDigest !== record.linted.linterDigest) add(errors, "lint evidence must identify the exact linter");
    if (entry.svgPath !== record.linted.svgPath || entry.svgDigest !== record.linted.svgDigest) add(errors, "lint evidence must identify the linted SVG");
  }
  nonempty(record?.rendered?.renderer, errors, "rendered.renderer");
  nonempty(record?.rendered?.rendererVersion, errors, "rendered.rendererVersion");
  for (const entry of Array.isArray(record?.rendered?.evidence) ? record.rendered.evidence : []) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    nonempty(entry.log, errors, "render evidence log");
    if (entry.command !== `node ${WRAPPER_PATH} render ${record.rendered.svgPath} ${record.planned.pngPath}`) add(errors, "render evidence must use the packaged Skillstead wrapper for the exact assets");
    if (entry.renderer !== record.rendered.renderer || entry.rendererVersion !== record.rendered.rendererVersion || entry.rendererDigest !== record.rendered.rendererDigest) add(errors, "render evidence must identify the renderer and version");
    if (typeof entry.rendererVersion === "string" && !entry.log.includes(entry.rendererVersion)) add(errors, "render log must bind the renderer version");
    for (const field of ["svgPath", "svgDigest", "pngPath", "pngDigest", "width", "height"]) if (entry[field] !== record.rendered[field]) add(errors, `render evidence ${field} must match the render stage`);
  }

  let svgFile;
  let pngFile;
  let runtime;
  if (typeof artifactRoot !== "string") add(errors, "artifactRoot is required");
  else {
    if ([record?.generated, record?.linted, record?.rendered, record?.verified].some((stage) => stage?.status === "passed") || record?.rendered?.status === "failed") svgFile = await verifiedFile(artifactRoot, record?.planned?.svgPath, errors, "planned.svgPath");
    if (record?.rendered?.status === "passed" || record?.verified?.status === "passed") pngFile = await verifiedFile(artifactRoot, record?.planned?.pngPath, errors, "planned.pngPath");
  }
  if (svgFile) {
    runtime = await skillsteadRuntime(errors, testRuntime);
    const actualDigest = digest(svgFile.bytes);
    const metadata = svgMetadata(svgFile.bytes, errors);
    for (const [name, stage] of [["generated", record.generated], ["linted", record.linted], ["rendered", record.rendered], ["verified", record.verified]]) {
      if (["passed", "failed", "unavailable"].includes(stage.status) && stage.svgDigest !== actualDigest) add(errors, `${name}.svgDigest does not match the actual SVG`);
    }
    if (metadata.description !== record?.planned?.altText || metadata.description !== record?.verified?.altText) add(errors, "SVG desc, planned alt text, and verified alt text must match");
    if (!sameArray(record?.verified?.sourceSectionIds, record?.planned?.sourceSectionIds)) add(errors, "verified source mapping must match the planned source mapping");
    if (runtime && record?.linted?.status === "passed") {
      if (record.linted.linter !== LINTER_ID || record.linted.linterVersion !== LINTER_VERSION || record.linted.linterDigest !== runtime.linterDigest) add(errors, "lint stage does not identify the packaged Skillstead linter");
      independentlyLint(svgFile, runtime, errors);
    }
    if (runtime && ["passed", "failed"].includes(record?.rendered?.status) && record.rendered.rendererDigest !== runtime.rendererDigest) add(errors, "render stage does not identify the packaged Skillstead renderer");
    if (pngFile && record?.rendered?.status === "passed") {
      const inspection = inspectCompletePng(pngFile.bytes);
      inspection.errors.forEach((message) => add(errors, message));
      const actualPngDigest = digest(pngFile.bytes);
      if (record.rendered.pngDigest !== actualPngDigest || record.verified.pngDigest !== actualPngDigest) add(errors, "PNG digests must match the actual PNG");
      if (record.rendered.scale !== 2) add(errors, "rendered.scale must be 2");
      if (inspection.ok) {
        if (inspection.width !== metadata.width * 2 || inspection.height !== metadata.height * 2) add(errors, "actual PNG dimensions must be exactly 2x the SVG viewBox");
        if (record.rendered.width !== inspection.width || record.rendered.height !== inspection.height || record.verified.width !== inspection.width || record.verified.height !== inspection.height) add(errors, "recorded dimensions must match the actual PNG");
      }
      if (runtime && errors.length === 0) {
        const independent = await independentlyRender(svgFile, runtime, errors);
        if (independent) {
          if (!pngFile.bytes.equals(independent.bytes)) add(errors, "Independent Skillstead render does not match the claimed PNG bytes");
          if (record.rendered.pngDigest !== digest(independent.bytes)) add(errors, "PNG digest does not match the independent Skillstead render");
          if (record.rendered.renderer !== independent.identity.renderer || record.rendered.rendererVersion !== independent.identity.rendererVersion) add(errors, "render stage does not identify the browser used by the independent Skillstead render");
          for (const entry of Array.isArray(record.rendered.evidence) ? record.rendered.evidence : []) {
            if (entry && typeof entry === "object" && !Array.isArray(entry) && !entry.log?.includes(independent.identity.line)) add(errors, "render evidence log does not contain the independent renderer identity");
          }
        }
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
