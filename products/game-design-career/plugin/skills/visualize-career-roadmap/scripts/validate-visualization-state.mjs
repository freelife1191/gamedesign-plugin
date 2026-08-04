#!/usr/bin/env node

import { existsSync, openSync, readFileSync, readSync, closeSync, realpathSync } from "node:fs";
import path from "node:path";

const AVAILABILITY = new Set(["unknown", "available", "unavailable"]);

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

function requireText(value, label) {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${label} must be a non-empty string`);
  return value;
}

function safeExistingFile(root, relativeFile, extension, label) {
  requireText(relativeFile, label);
  if (path.isAbsolute(relativeFile)) throw new Error(`${label} must be a safe relative path`);
  const normalized = path.normalize(relativeFile);
  if (normalized === ".." || normalized.startsWith(`..${path.sep}`)) throw new Error(`${label} must be a safe relative path`);
  if (path.extname(normalized).toLowerCase() !== extension) throw new Error(`${label} must use ${extension}`);
  const rootReal = realpathSync(root);
  const candidate = path.resolve(rootReal, normalized);
  if (!candidate.startsWith(`${rootReal}${path.sep}`)) throw new Error(`${label} must be a safe relative path`);
  if (!existsSync(candidate)) throw new Error(`${label} does not exist: ${relativeFile}`);
  const candidateReal = realpathSync(candidate);
  if (!candidateReal.startsWith(`${rootReal}${path.sep}`)) throw new Error(`${label} must resolve inside artifactRoot`);
  return { relative: normalized.split(path.sep).join("/"), absolute: candidateReal };
}

function viewBoxDimensions(svgPath) {
  const source = readFileSync(svgPath, "utf8");
  const match = source.match(/<svg\b[^>]*\bviewBox=["']\s*-?[\d.]+[\s,]+-?[\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)\s*["']/iu);
  if (!match) throw new Error("svgFile must contain a positive root viewBox");
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!(width > 0 && height > 0)) throw new Error("svgFile must contain a positive root viewBox");
  return { width, height };
}

function pngDimensions(pngPath) {
  const header = Buffer.alloc(24);
  const fd = openSync(pngPath, "r");
  try {
    if (readSync(fd, header, 0, 24, 0) !== 24) throw new Error("pngFile is too short for IHDR evidence");
  } finally {
    closeSync(fd);
  }
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (!header.subarray(0, 8).equals(signature) || header.toString("latin1", 12, 16) !== "IHDR") {
    throw new Error("pngFile has no valid PNG IHDR");
  }
  return { width: header.readUInt32BE(16), height: header.readUInt32BE(20) };
}

function validateAvailability(value, availability) {
  if (availability === "unknown") {
    if (value !== undefined) throw new Error("unknown PNG availability cannot have availabilityEvidence");
    return null;
  }
  const evidence = exactKeys(value, ["command", "result", "reason"], "availabilityEvidence");
  requireText(evidence.command, "availabilityEvidence.command");
  requireText(evidence.reason, "availabilityEvidence.reason");
  const expected = availability === "available" ? "passed" : "failed";
  if (evidence.result !== expected) throw new Error(`${availability} PNG availability requires ${expected} evidence`);
  return { command: evidence.command, result: expected, reason: evidence.reason };
}

export function validateVisualizationState(value) {
  const allowed = [
    "artifactRoot", "requested", "planned", "generated", "linted", "rendered", "verified",
    "svgFile", "pngFile", "pngAvailability", "availabilityEvidence", "lintEvidence", "renderEvidence",
    "altText", "visualQa",
  ];
  const input = exactKeys(value, allowed, "visualization state");
  requireText(input.artifactRoot, "artifactRoot");
  const root = realpathSync(input.artifactRoot);
  for (const state of ["requested", "planned", "generated", "linted", "rendered", "verified"]) {
    if (typeof input[state] !== "boolean") throw new Error(`${state} must be boolean`);
  }
  if (!AVAILABILITY.has(input.pngAvailability)) throw new Error("pngAvailability is invalid");
  if (input.planned && !input.requested) throw new Error("planned requires requested");
  if (input.generated && !input.planned) throw new Error("generated requires planned");
  if (input.linted && !input.generated) throw new Error("linted requires generated");
  if (input.rendered && !input.linted) throw new Error("rendered requires linted");
  if (input.verified && !input.rendered) throw new Error("verified requires rendered");

  const availabilityEvidence = validateAvailability(input.availabilityEvidence, input.pngAvailability);
  let svg = null;
  let lintEvidence = null;
  let png = null;
  let renderEvidence = null;

  if (input.generated) svg = safeExistingFile(root, input.svgFile, ".svg", "svgFile");
  else if (input.svgFile !== undefined) throw new Error("svgFile requires generated");

  if (input.linted) {
    const evidence = exactKeys(input.lintEvidence, ["command", "file", "result", "warningsDisposition"], "lintEvidence");
    requireText(evidence.command, "lintEvidence.command");
    requireText(evidence.warningsDisposition, "lintEvidence.warningsDisposition");
    if (evidence.result !== "passed") throw new Error("linted requires passed lintEvidence");
    const lintFile = safeExistingFile(root, evidence.file, ".svg", "lintEvidence.file");
    if (lintFile.relative !== svg.relative) throw new Error("lintEvidence.file must match svgFile");
    lintEvidence = {
      command: evidence.command,
      file: lintFile.relative,
      result: "passed",
      warningsDisposition: evidence.warningsDisposition,
    };
  } else if (input.lintEvidence !== undefined) throw new Error("lintEvidence requires linted");

  if (input.rendered) {
    if (input.pngAvailability !== "available") throw new Error("rendered requires available PNG capability");
    png = safeExistingFile(root, input.pngFile, ".png", "pngFile");
    const evidence = exactKeys(input.renderEvidence, [
      "command", "svgFile", "pngFile", "browser", "result", "scale",
      "sourceWidth", "sourceHeight", "outputWidth", "outputHeight",
    ], "renderEvidence");
    requireText(evidence.command, "renderEvidence.command");
    requireText(evidence.browser, "renderEvidence.browser");
    if (evidence.result !== "passed") throw new Error("rendered requires passed renderEvidence");
    const renderSvg = safeExistingFile(root, evidence.svgFile, ".svg", "renderEvidence.svgFile");
    const renderPng = safeExistingFile(root, evidence.pngFile, ".png", "renderEvidence.pngFile");
    if (renderSvg.relative !== svg.relative) throw new Error("renderEvidence.svgFile must match svgFile");
    if (renderPng.relative !== png.relative) throw new Error("renderEvidence.pngFile must match pngFile");
    const viewBox = viewBoxDimensions(svg.absolute);
    const dimensions = pngDimensions(png.absolute);
    if (evidence.scale !== 2) throw new Error("renderEvidence.scale must be exactly 2");
    if (evidence.sourceWidth !== viewBox.width || evidence.sourceHeight !== viewBox.height) {
      throw new Error("renderEvidence source dimensions must match the SVG viewBox");
    }
    if (evidence.outputWidth !== dimensions.width || evidence.outputHeight !== dimensions.height) {
      throw new Error("renderEvidence output dimensions must match the actual PNG IHDR");
    }
    if (dimensions.width !== viewBox.width * 2 || dimensions.height !== viewBox.height * 2) {
      throw new Error("verified PNG dimensions must be exactly 2x the SVG viewBox width and height");
    }
    renderEvidence = {
      command: evidence.command,
      svgFile: renderSvg.relative,
      pngFile: renderPng.relative,
      browser: evidence.browser,
      result: "passed",
      scale: 2,
      sourceWidth: viewBox.width,
      sourceHeight: viewBox.height,
      outputWidth: dimensions.width,
      outputHeight: dimensions.height,
    };
  } else {
    if (input.renderEvidence !== undefined || input.pngFile !== undefined) throw new Error("PNG files and renderEvidence require rendered");
    if (input.pngAvailability === "unavailable" && input.verified) throw new Error("unavailable PNG cannot be verified");
  }

  let altText;
  let visualQa;
  if (input.verified) {
    altText = requireText(input.altText, "altText");
    visualQa = requireText(input.visualQa, "visualQa");
  } else if (input.altText !== undefined || input.visualQa !== undefined) {
    throw new Error("altText and visualQa require verified");
  }

  const normalized = {
    artifactRoot: root,
    requested: input.requested,
    planned: input.planned,
    generated: input.generated,
    linted: input.linted,
    rendered: input.rendered,
    verified: input.verified,
    pngAvailability: input.pngAvailability,
  };
  if (availabilityEvidence) normalized.availabilityEvidence = availabilityEvidence;
  if (svg) normalized.svgFile = svg.relative;
  if (lintEvidence) normalized.lintEvidence = lintEvidence;
  if (png) normalized.pngFile = png.relative;
  if (renderEvidence) normalized.renderEvidence = renderEvidence;
  if (altText) normalized.altText = altText;
  if (visualQa) normalized.visualQa = visualQa;
  return normalized;
}
