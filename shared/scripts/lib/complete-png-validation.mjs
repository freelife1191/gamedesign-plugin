import { inflateSync } from "node:zlib";

const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

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
  if (!Buffer.isBuffer(bytes) || !bytes.subarray(0, 8).equals(signature)) return { ok: false, errors: ["PNG requires the canonical signature"], width: null, height: null };
  let offset = 8;
  let width = null;
  let height = null;
  let channels = null;
  let imageData = [];
  let seenHeader = false;
  let seenEnd = false;
  while (offset < bytes.length && !seenEnd) {
    if (offset + 12 > bytes.length) { errors.push("PNG chunk is truncated"); break; }
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString("ascii", offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (!/^[A-Za-z]{4}$/u.test(type) || dataEnd + 4 > bytes.length) { errors.push("PNG chunk has invalid framing"); break; }
    if (crc32(bytes.subarray(offset + 4, dataEnd)) !== bytes.readUInt32BE(dataEnd)) errors.push(`PNG ${type} chunk CRC32 mismatch`);
    if (!seenHeader && type !== "IHDR") errors.push("PNG IHDR must be the first chunk");
    if (type === "IHDR") {
      if (seenHeader || offset !== 8 || length !== 13) errors.push("PNG requires exactly one leading IHDR");
      else {
        seenHeader = true;
        width = bytes.readUInt32BE(dataStart);
        height = bytes.readUInt32BE(dataStart + 4);
        const colorType = bytes[dataStart + 9];
        channels = colorType === 2 ? 3 : colorType === 6 ? 4 : null;
        if (!(width > 0 && height > 0) || bytes[dataStart + 8] !== 8 || channels === null || bytes[dataStart + 10] !== 0 || bytes[dataStart + 11] !== 0 || bytes[dataStart + 12] !== 0) errors.push("PNG must be non-interlaced 8-bit RGB or RGBA");
      }
    } else if (type === "IDAT") imageData.push(bytes.subarray(dataStart, dataEnd));
    else if (type === "IEND") {
      if (length !== 0 || imageData.length === 0 || dataEnd + 4 !== bytes.length) errors.push("PNG IEND is invalid");
      seenEnd = true;
    }
    offset = dataEnd + 4;
  }
  if (!seenHeader || imageData.length === 0 || !seenEnd) errors.push("PNG is incomplete");
  if (errors.length === 0) {
    try {
      const pixels = inflateSync(Buffer.concat(imageData), { maxOutputLength: 256 * 1024 * 1024 });
      const rowBytes = width * channels + 1;
      if (pixels.length !== height * rowBytes) errors.push("PNG decompressed image data length does not match IHDR");
      else for (let row = 0; row < height; row += 1) if (pixels[row * rowBytes] > 4) errors.push(`PNG row ${row} has an invalid filter type`);
    } catch { errors.push("PNG IDAT zlib stream is invalid"); }
  }
  return { ok: errors.length === 0, errors, width, height };
}
