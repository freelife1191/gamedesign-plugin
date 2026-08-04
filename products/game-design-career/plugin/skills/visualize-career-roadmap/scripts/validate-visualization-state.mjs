#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, openSync, readFileSync, readSync, closeSync, realpathSync } from "node:fs";
import path from "node:path";

async function loadSkillstead() {
  const candidates = [
    {
      check: new URL("../../../skills/svg-infographic/scripts/check-svg.mjs", import.meta.url),
      render: new URL("../../../skills/svg-infographic/scripts/render.mjs", import.meta.url),
    },
    {
      check: new URL("../../../../../../shared/vendor/skillstead/svg-infographic/0.8.3/scripts/check-svg.mjs", import.meta.url),
      render: new URL("../../../../../../shared/vendor/skillstead/svg-infographic/0.8.3/scripts/render.mjs", import.meta.url),
    },
  ];
  let lastError;
  for (const candidate of candidates) {
    try {
      const [check, render] = await Promise.all([import(candidate.check.href), import(candidate.render.href)]);
      if (typeof check.lintSvg !== "function" || typeof render.isCompletePng !== "function") {
        throw new Error("required Skillstead exports are missing");
      }
      return { lintSvg: check.lintSvg, isCompletePng: render.isCompletePng };
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(`Skillstead validators are unavailable: ${lastError?.message ?? "unknown error"}`);
}

const { lintSvg, isCompletePng } = await loadSkillstead();

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

function digest(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function normalizeFindings(findings) {
  return findings.map(({ file: _file, line, rule, message, fix }) => ({ line, rule, message, fix }));
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function svgAccessibility(source, altText) {
  const root = source.match(/<svg\b([^>]*)>/iu);
  if (!root) throw new Error("svgFile must contain an SVG root");
  const title = source.match(/<title(?:\s[^>]*)?>([\s\S]*?)<\/title>/iu)?.[1]?.trim();
  const description = source.match(/<desc(?:\s[^>]*)?>([\s\S]*?)<\/desc>/iu)?.[1]?.trim();
  const ariaLabel = root[1].match(/\baria-label=["']([^"']*)["']/iu)?.[1]?.trim();
  if (!title || !description) throw new Error("svgFile requires non-empty <title> and <desc> accessibility text");
  if (title !== altText || ariaLabel !== altText) {
    throw new Error("altText must exactly match both SVG <title> and aria-label");
  }
  return { title, description };
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
    const evidence = exactKeys(input.lintEvidence, [
      "command", "file", "result", "sha256", "errors", "warnings", "warningsDisposition",
    ], "lintEvidence");
    requireText(evidence.command, "lintEvidence.command");
    requireText(evidence.warningsDisposition, "lintEvidence.warningsDisposition");
    if (evidence.result !== "passed") throw new Error("linted requires passed lintEvidence");
    const lintFile = safeExistingFile(root, evidence.file, ".svg", "lintEvidence.file");
    if (lintFile.relative !== svg.relative) throw new Error("lintEvidence.file must match svgFile");
    const svgBytes = readFileSync(svg.absolute);
    if (svgBytes.length === 0) throw new Error("svgFile must not be empty");
    const actualLint = lintSvg(svgBytes.toString("utf8"), lintFile.relative);
    const errors = normalizeFindings(actualLint.errors);
    const warnings = normalizeFindings(actualLint.warnings);
    const sha256 = digest(svgBytes);
    if (evidence.sha256 !== sha256) throw new Error("lintEvidence.sha256 must match the exact SVG bytes");
    if (!sameJson(evidence.errors, errors) || !sameJson(evidence.warnings, warnings)) {
      throw new Error("lintEvidence errors and warnings must match actual Skillstead lint output");
    }
    if (errors.length > 0) throw new Error("linted requires zero actual Skillstead lint errors");
    const expectedDisposition = warnings.length === 0
      ? "No warnings."
      : `${warnings.length} warning(s): ${[...new Set(warnings.map(({ rule }) => rule))].join(", ")}`;
    if (evidence.warningsDisposition !== expectedDisposition) {
      throw new Error("lintEvidence.warningsDisposition must summarize actual Skillstead warnings");
    }
    lintEvidence = {
      command: evidence.command,
      file: lintFile.relative,
      result: "passed",
      sha256,
      errors,
      warnings,
      warningsDisposition: expectedDisposition,
    };
  } else if (input.lintEvidence !== undefined) throw new Error("lintEvidence requires linted");

  if (input.rendered) {
    if (input.pngAvailability !== "available") throw new Error("rendered requires available PNG capability");
    png = safeExistingFile(root, input.pngFile, ".png", "pngFile");
    if (!isCompletePng(png.absolute)) throw new Error("pngFile must be a complete PNG with IEND exactly at EOF");
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
  if (input.linted) {
    altText = requireText(input.altText, "altText");
    svgAccessibility(readFileSync(svg.absolute, "utf8"), altText);
  }
  if (input.verified) {
    visualQa = requireText(input.visualQa, "visualQa");
  } else if (input.visualQa !== undefined) {
    throw new Error("visualQa requires verified");
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
