#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, openSync, readFileSync, readSync, closeSync, realpathSync } from "node:fs";
import path from "node:path";
import { TextDecoder } from "node:util";

import { isCompletePngFile, lintSvgSource } from "./run-skillstead.mjs";

const AVAILABILITY = new Set(["unknown", "available", "unavailable"]);
const SKILLSTEAD_WRAPPER = "node run-skillstead.mjs";
const MAX_SVG_BYTES = 8_000_000;
const utf8Decoder = new TextDecoder("utf-8", { fatal: true });

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

function validateXmlCharacters(source) {
  for (const character of source) {
    const codePoint = character.codePointAt(0);
    const xml10Allowed = codePoint === 0x9
      || codePoint === 0xa
      || codePoint === 0xd
      || (codePoint >= 0x20 && codePoint <= 0xd7ff)
      || (codePoint >= 0xe000 && codePoint <= 0xfffd)
      || (codePoint >= 0x10000 && codePoint <= 0x10ffff);
    if (!xml10Allowed) {
      throw new Error(`svgFile contains forbidden XML character U+${codePoint.toString(16).toUpperCase().padStart(4, "0")}`);
    }
  }
}

function decodeSvgBytes(bytes) {
  if (!Buffer.isBuffer(bytes)) throw new Error("svgFile must be read as bytes before UTF-8 decoding");
  if (bytes.length === 0) throw new Error("svgFile must not be empty");
  if (bytes.length > MAX_SVG_BYTES) throw new Error("svgFile exceeds the UTF-8 byte limit");
  let source;
  try {
    source = utf8Decoder.decode(bytes);
  } catch {
    throw new Error("svgFile must contain canonical valid UTF-8 without replacement decoding");
  }
  validateXmlCharacters(source);
  return source;
}

function viewBoxDimensions(svgPath) {
  const source = decodeSvgBytes(readFileSync(svgPath));
  const { attributes } = parseSvgAccessibility(source);
  const match = attributes.viewBox?.match(/^\s*-?[\d.]+[\s,]+-?[\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)\s*$/u);
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

function readMarkupEnd(source, start) {
  let quote = null;
  for (let index = start; index < source.length; index++) {
    const character = source[index];
    if (quote) {
      if (character === quote) quote = null;
    } else if (character === '"' || character === "'") quote = character;
    else if (character === ">") return index;
  }
  throw new Error("svgFile contains an unclosed XML tag");
}

function parseStartTag(raw) {
  let source = raw.trim();
  const selfClosing = source.endsWith("/");
  if (selfClosing) source = source.slice(0, -1).trimEnd();
  const nameMatch = source.match(/^([A-Za-z_][\w:.-]*)/u);
  if (!nameMatch) throw new Error("svgFile contains a malformed XML start tag");
  const name = nameMatch[1];
  const attributes = Object.create(null);
  let index = name.length;
  while (index < source.length) {
    while (/\s/u.test(source[index])) index++;
    if (index >= source.length) break;
    const attributeMatch = source.slice(index).match(/^([A-Za-z_][\w:.-]*)/u);
    if (!attributeMatch) throw new Error(`svgFile contains a malformed attribute on <${name}>`);
    const attribute = attributeMatch[1];
    if (Object.hasOwn(attributes, attribute)) throw new Error(`svgFile contains duplicate attribute ${attribute}`);
    index += attribute.length;
    while (/\s/u.test(source[index])) index++;
    if (source[index] !== "=") throw new Error(`svgFile attribute ${attribute} must have a quoted value`);
    index++;
    while (/\s/u.test(source[index])) index++;
    const quote = source[index];
    if (quote !== '"' && quote !== "'") throw new Error(`svgFile attribute ${attribute} must have a quoted value`);
    const end = source.indexOf(quote, index + 1);
    if (end < 0) throw new Error(`svgFile attribute ${attribute} is unclosed`);
    const value = source.slice(index + 1, end);
    if (value.includes("<") || value.includes("&")) throw new Error("svgFile rejects markup or entity references inside attributes");
    attributes[attribute] = value;
    index = end + 1;
  }
  return { name, attributes, selfClosing };
}

function parseSvgAccessibility(source) {
  if (source.length > 2_000_000) throw new Error("svgFile exceeds the structural accessibility parser limit");
  const stack = [];
  const direct = { title: [], desc: [] };
  let root = null;
  let elements = 0;
  let index = 0;
  while (index < source.length) {
    const rawParent = stack.at(-1)?.name;
    if (rawParent === "script" || rawParent === "style") {
      const closing = new RegExp(`</${rawParent}\\s*>`, "iu").exec(source.slice(index));
      if (!closing) throw new Error(`svgFile contains an unclosed <${rawParent}> element`);
      index += closing.index;
    }
    if (source[index] !== "<") {
      const next = source.indexOf("<", index);
      const end = next < 0 ? source.length : next;
      const text = source.slice(index, end);
      if (text.includes("&")) throw new Error("svgFile rejects entity references in accessibility text");
      if (stack.length === 0 && text.trim() !== "") throw new Error("svgFile contains text outside the root element");
      const parent = stack.at(-1);
      if (parent?.capture) parent.text += text;
      index = end;
      continue;
    }
    if (source.startsWith("<!--", index)) {
      const end = source.indexOf("-->", index + 4);
      if (end < 0 || source.slice(index + 4, end).includes("--")) throw new Error("svgFile contains a malformed XML comment");
      index = end + 3;
      continue;
    }
    if (source.startsWith("<![CDATA[", index)) throw new Error("svgFile rejects CDATA in structural accessibility markup");
    if (/^<!DOCTYPE\b/iu.test(source.slice(index))) throw new Error("svgFile rejects DOCTYPE and entity declarations");
    if (source.startsWith("<!", index)) throw new Error("svgFile rejects unsafe XML declarations");
    if (source.startsWith("<?", index)) {
      const end = source.indexOf("?>", index + 2);
      if (end < 0) throw new Error("svgFile contains an unclosed processing instruction");
      index = end + 2;
      continue;
    }
    const end = readMarkupEnd(source, index + 1);
    const token = source.slice(index + 1, end);
    if (token.startsWith("/")) {
      const closing = token.slice(1).trim();
      if (!/^[A-Za-z_][\w:.-]*$/u.test(closing)) throw new Error("svgFile contains a malformed XML closing tag");
      const opened = stack.pop();
      if (!opened || opened.name !== closing) throw new Error(`svgFile contains mismatched closing tag </${closing}>`);
      if (opened.capture) direct[opened.name].push(opened.text.trim());
      index = end + 1;
      continue;
    }
    const parsed = parseStartTag(token);
    elements++;
    if (elements > 10_000 || stack.length >= 64) throw new Error("svgFile exceeds structural parser limits");
    if (stack.length === 0) {
      if (root || parsed.name !== "svg") throw new Error("svgFile must contain exactly one root <svg> element");
      root = parsed;
    } else if (parsed.name === "svg") throw new Error("svgFile rejects nested <svg> elements");
    const parent = stack.at(-1);
    if ((parsed.name === "title" || parsed.name === "desc") && parent?.name !== "svg") {
      throw new Error(`<${parsed.name}> must be a direct child of the root <svg>`);
    }
    if (parent?.capture) throw new Error(`<${parent.name}> accessibility text cannot contain nested elements`);
    const element = {
      name: parsed.name,
      capture: (parsed.name === "title" || parsed.name === "desc") && parent?.name === "svg",
      text: "",
    };
    if (parsed.selfClosing) {
      if (element.capture) direct[element.name].push("");
      if (parsed.name === "svg") throw new Error("svgFile root <svg> cannot be self-closing");
    } else stack.push(element);
    index = end + 1;
  }
  if (stack.length !== 0) throw new Error(`svgFile contains an unclosed <${stack.at(-1).name}> element`);
  if (!root) throw new Error("svgFile must contain an SVG root");
  if (direct.title.length !== 1 || direct.desc.length !== 1 || !direct.title[0] || !direct.desc[0]) {
    throw new Error("svgFile requires exactly one non-empty direct-child <title> and <desc>");
  }
  return {
    title: direct.title[0],
    description: direct.desc[0],
    ariaLabel: root.attributes["aria-label"]?.trim(),
    attributes: root.attributes,
  };
}

function svgAccessibility(source, altText) {
  const { title, description, ariaLabel } = parseSvgAccessibility(source);
  if (title !== altText || ariaLabel !== altText) {
    throw new Error("altText must exactly match both SVG <title> and aria-label");
  }
  return { title, description };
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function validatePngCrc(pngPath) {
  const bytes = readFileSync(pngPath);
  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const chunkEnd = offset + 12 + length;
    if (chunkEnd > bytes.length) throw new Error("pngFile contains a truncated PNG chunk");
    const type = bytes.toString("latin1", offset + 4, offset + 8);
    const actual = crc32(bytes.subarray(offset + 4, offset + 8 + length));
    const expected = bytes.readUInt32BE(offset + 8 + length);
    if (actual !== expected) throw new Error(`pngFile has an invalid ${type} chunk CRC32`);
    offset = chunkEnd;
  }
  if (offset !== bytes.length) throw new Error("pngFile contains trailing bytes outside PNG chunks");
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
  if (evidence.command !== `${SKILLSTEAD_WRAPPER} probe`) throw new Error("availabilityEvidence.command must use the packaged Skillstead wrapper");
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
    if (evidence.command !== `${SKILLSTEAD_WRAPPER} lint ${lintFile.relative}`) {
      throw new Error("lintEvidence.command must use the packaged Skillstead wrapper for the exact SVG");
    }
    const svgBytes = readFileSync(svg.absolute);
    const svgSource = decodeSvgBytes(svgBytes);
    const actualLint = lintSvgSource(svgSource, lintFile.relative);
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
    if (!isCompletePngFile(png.absolute)) throw new Error("pngFile must be a complete PNG with IEND exactly at EOF");
    validatePngCrc(png.absolute);
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
    if (evidence.command !== `${SKILLSTEAD_WRAPPER} render ${renderSvg.relative} ${renderPng.relative}`) {
      throw new Error("renderEvidence.command must use the packaged Skillstead wrapper for the exact assets");
    }
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
    svgAccessibility(decodeSvgBytes(readFileSync(svg.absolute)), altText);
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
