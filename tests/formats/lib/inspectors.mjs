import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function containsEmbeddedPosixHostPath(value) {
  const withoutPortableSyntax = value
    .replace(/\bhttps?:\/\/[^\s<>"']+/giu, "")
    .replace(/[A-Za-z0-9._/-]+#[A-Za-z0-9_~./-]*/gu, "");
  return /(?:^|[^\p{L}\p{N}_.#-])\/(?!\/)(?=$|[^\s"'<>()[\]{}])/u.test(withoutPortableSyntax);
}

function isAbsoluteHostPath(value) {
  return /^file:/iu.test(value)
    || path.posix.isAbsolute(value)
    || path.win32.isAbsolute(value)
    || /^[A-Za-z]:[\\/]/u.test(value)
    || /^\\\\/u.test(value)
    || /(?:^|[^\p{L}\p{N}_])(?:file:|[A-Za-z]:[\\/]|\\\\|\/(?:Applications|Users|private|tmp|home|var|etc|opt|Library|System|Volumes|usr|bin|sbin|dev)(?:[\\/]|$))/iu.test(value)
    || containsEmbeddedPosixHostPath(value);
}

function decodePercentEncodedAscii(value) {
  let decoded = value;
  for (let remaining = value.length; remaining > 0; remaining -= 1) {
    const next = decoded.replace(/%([0-7][0-9A-F])/giu, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)));
    if (next === decoded) break;
    decoded = next;
  }
  return decoded;
}

export function assertPortableManifest(value) {
  const pending = [value];
  const seen = new Set();
  while (pending.length) {
    const current = pending.pop();
    if (typeof current === "string") {
      if (isAbsoluteHostPath(current) || isAbsoluteHostPath(decodePercentEncodedAscii(current))) {
        throw new Error("manifest exposes an absolute host path");
      }
      continue;
    }
    if (!current || typeof current !== "object" || seen.has(current)) continue;
    seen.add(current);
    if (Array.isArray(current)) pending.push(...current);
    else pending.push(...Object.values(current));
  }
}

function decodePointerToken(token, pointer) {
  if (/~(?:[^01]|$)/u.test(token)) throw new Error(`JSON pointer is malformed: ${pointer}`);
  return token.replaceAll("~1", "/").replaceAll("~0", "~");
}

function resolvePointer(document, fragment, pointer) {
  if (fragment === "") return document;
  if (!fragment.startsWith("/")) throw new Error(`JSON pointer is malformed: ${pointer}`);
  let current = document;
  for (const encodedToken of fragment.slice(1).split("/")) {
    const token = decodePointerToken(encodedToken, pointer);
    if (Array.isArray(current)) {
      if (!/^(?:0|[1-9]\d*)$/u.test(token) || Number(token) >= current.length) throw new Error(`JSON pointer does not resolve: ${pointer}`);
      current = current[Number(token)];
    } else if (current && typeof current === "object" && Object.hasOwn(current, token)) {
      current = current[token];
    } else {
      throw new Error(`JSON pointer does not resolve: ${pointer}`);
    }
  }
  return current;
}

export async function resolveJsonSourcePointers(root, pointers, declaredSources) {
  const allowed = new Set(declaredSources);
  const documents = new Map();
  for (const pointer of pointers) {
    if (typeof pointer !== "string") throw new Error("JSON pointer must be a string");
    const separator = pointer.indexOf("#");
    if (separator <= 0 || pointer.indexOf("#", separator + 1) !== -1) throw new Error(`JSON pointer is malformed: ${pointer}`);
    const filename = pointer.slice(0, separator);
    if (!allowed.has(filename)) throw new Error(`JSON pointer uses an undeclared source: ${pointer}`);
    let document = documents.get(filename);
    if (!document) {
      const absolute = path.resolve(root, filename);
      const relative = path.relative(path.resolve(root), absolute);
      if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw new Error(`JSON pointer escapes source root: ${pointer}`);
      document = JSON.parse(await readFile(absolute, "utf8"));
      documents.set(filename, document);
    }
    let fragment;
    try { fragment = decodeURIComponent(pointer.slice(separator + 1)); } catch { throw new Error(`JSON pointer is malformed: ${pointer}`); }
    resolvePointer(document, fragment, pointer);
  }
}

export async function validateSourceDigests(root, expected) {
  for (const [relative, digest] of Object.entries(expected)) {
    const actual = sha256(await readFile(path.join(root, relative)));
    if (actual !== digest) throw new Error(`source drift: ${relative}`);
  }
}

export function validatePdfSignature(bytes) {
  if (!Buffer.from(bytes).subarray(0, 5).equals(Buffer.from("%PDF-"))) throw new Error("PDF signature is invalid");
}

export function assertKorean(text, anchors) {
  for (const anchor of anchors) if (!String(text).normalize("NFC").includes(anchor.normalize("NFC"))) throw new Error(`Korean anchor missing: ${anchor}`);
}

export function inspectPng(bytes, expected) {
  const data = Buffer.from(bytes);
  if (data.length < 33 || !data.subarray(0, 8).equals(PNG_SIGNATURE)) throw new Error("truncated PNG or invalid signature");
  let offset = 8;
  let width;
  let height;
  let iend = false;
  while (offset + 12 <= data.length) {
    const length = data.readUInt32BE(offset);
    const type = data.toString("ascii", offset + 4, offset + 8);
    const end = offset + 12 + length;
    if (end > data.length) throw new Error("truncated PNG chunk");
    if (offset === 8 && (type !== "IHDR" || length !== 13)) throw new Error("truncated PNG IHDR");
    if (type === "IHDR") { width = data.readUInt32BE(offset + 8); height = data.readUInt32BE(offset + 12); }
    if (type === "IEND") { if (length !== 0 || end !== data.length) throw new Error("truncated PNG IEND"); iend = true; }
    offset = end;
  }
  if (!iend) throw new Error("truncated PNG: IEND missing");
  if (expected && (width !== expected.width || height !== expected.height)) throw new Error(`PNG dimensions ${width}x${height} do not match ${expected.width}x${expected.height}`);
  return { width, height };
}

export function validateZipMembers(members, kind, expectedSlides) {
  const set = new Set(members);
  const required = kind === "docx" ? ["[Content_Types].xml", "word/document.xml"] : ["[Content_Types].xml", "ppt/presentation.xml"];
  for (const member of required) if (!set.has(member)) throw new Error(`broken OOXML: missing ${member}`);
  if (kind === "pptx" && expectedSlides !== undefined) {
    const count = members.filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name)).length;
    if (count !== expectedSlides) throw new Error(`slide count ${count} does not match ${expectedSlides}`);
  }
}

export function validateAttestation(attestation, expected) {
  if (attestation.status !== "approved") throw new Error("visual attestation is not approved");
  if (attestation.pageCount !== expected.pageCount) throw new Error("page count attestation mismatch");
  if (attestation.slideCount !== expected.slideCount) throw new Error("slide count attestation mismatch");
  if (attestation.png?.width !== 1920 || attestation.png?.height !== 1080) throw new Error("PNG dimensions attestation mismatch");
  const required = expected.pageCount * 2 + expected.slideCount + 1;
  if (!Array.isArray(attestation.inspectedImages) || attestation.inspectedImages.length < required) throw new Error("visual attestation is incomplete");
}

export function validateOrderedMarkers(text, expected) {
  let offset = 0;
  for (const marker of expected) {
    const index = String(text).indexOf(marker, offset);
    if (index < 0) throw new Error(`source marker missing or out of order: ${marker}`);
    offset = index + marker.length;
  }
}

export function validateExactSourceSets(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${label} does not match the required source binding`);
}
