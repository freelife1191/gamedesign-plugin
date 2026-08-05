import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
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
