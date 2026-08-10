import { inflateSync } from "node:zlib";

const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function paeth(left, above, upperLeft) {
  const estimate = left + above - upperLeft;
  const leftDistance = Math.abs(estimate - left);
  const aboveDistance = Math.abs(estimate - above);
  const upperLeftDistance = Math.abs(estimate - upperLeft);
  return leftDistance <= aboveDistance && leftDistance <= upperLeftDistance
    ? left : aboveDistance <= upperLeftDistance ? above : upperLeft;
}

function parsePng(bytes) {
  if (!Buffer.isBuffer(bytes) || !bytes.subarray(0, 8).equals(signature)) return null;
  let offset = 8;
  let width = null;
  let height = null;
  let channels = null;
  const imageData = [];
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString("ascii", offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (dataEnd + 4 > bytes.length) return null;
    if (type === "IHDR") {
      width = bytes.readUInt32BE(dataStart);
      height = bytes.readUInt32BE(dataStart + 4);
      const colorType = bytes[dataStart + 9];
      channels = colorType === 2 ? 3 : colorType === 6 ? 4 : null;
    } else if (type === "IDAT") imageData.push(bytes.subarray(dataStart, dataEnd));
    else if (type === "IEND") break;
    offset = dataEnd + 4;
  }
  return width && height && channels && imageData.length > 0 ? { width, height, channels, imageData } : null;
}

function decodePngPixels({ width, height, channels, imageData }) {
  const rowLength = width * channels;
  const inflated = inflateSync(Buffer.concat(imageData), { maxOutputLength: 256 * 1024 * 1024 });
  const expectedLength = height * (rowLength + 1);
  if (inflated.length !== expectedLength) throw new Error("PNG decompressed image data length does not match IHDR");
  const pixels = Buffer.alloc(width * height * channels);
  for (let row = 0; row < height; row += 1) {
    const sourceOffset = row * (rowLength + 1);
    const filter = inflated[sourceOffset];
    if (filter > 4) throw new Error(`PNG row ${row} has an invalid filter type`);
    const targetOffset = row * rowLength;
    for (let column = 0; column < rowLength; column += 1) {
      const raw = inflated[sourceOffset + 1 + column];
      const left = column >= channels ? pixels[targetOffset + column - channels] : 0;
      const above = row > 0 ? pixels[targetOffset - rowLength + column] : 0;
      const upperLeft = row > 0 && column >= channels ? pixels[targetOffset - rowLength + column - channels] : 0;
      const value = filter === 0 ? raw
        : filter === 1 ? (raw + left) & 0xff
          : filter === 2 ? (raw + above) & 0xff
            : filter === 3 ? (raw + Math.floor((left + above) / 2)) & 0xff
              : (raw + paeth(left, above, upperLeft)) & 0xff;
      pixels[targetOffset + column] = value;
    }
  }
  return pixels;
}

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
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

/**
 * Detects captures that are structurally valid PNGs but contain only the page
 * background. This is intentionally a content floor, not an OCR substitute.
 */
export function inspectPngVisualContent(bytes) {
  const complete = inspectCompletePng(bytes);
  if (!complete.ok) return { ok: false, errors: complete.errors, width: complete.width, height: complete.height };
  const parsed = parsePng(bytes);
  if (!parsed) return { ok: false, errors: ["PNG pixels could not be decoded"], width: complete.width, height: complete.height };
  try {
    const pixels = decodePngPixels(parsed);
    const { width, height, channels } = parsed;
    const samples = [[0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1]];
    const background = [0, 1, 2].map((channel) => median(samples.map(([x, y]) => pixels[(y * width + x) * channels + channel])));
    let foreground = 0;
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const offset = (y * width + x) * channels;
        const alpha = channels === 4 ? pixels[offset + 3] : 255;
        const contrast = Math.max(
          Math.abs(pixels[offset] - background[0]),
          Math.abs(pixels[offset + 1] - background[1]),
          Math.abs(pixels[offset + 2] - background[2]),
        );
        if (alpha >= 32 && contrast >= 18) {
          foreground += 1;
          minX = Math.min(minX, x); minY = Math.min(minY, y);
          maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
        }
      }
    }
    const total = width * height;
    const foregroundRatio = foreground / total;
    const boundingBox = foreground === 0 ? null : { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
    const minimumForeground = total <= 100 ? 1 : Math.max(32, Math.ceil(total * 0.0005));
    const meaningfulBounds = !boundingBox || total <= 100
      || boundingBox.width >= Math.max(16, Math.ceil(width * 0.02))
      || boundingBox.height >= Math.max(16, Math.ceil(height * 0.02));
    if (foreground < minimumForeground || !meaningfulBounds) {
      return {
        ok: false,
        errors: ["PNG is perceptually blank: no meaningful non-background content"],
        width, height, background, foreground, foregroundRatio, boundingBox,
      };
    }
    return { ok: true, errors: [], width, height, background, foreground, foregroundRatio, boundingBox };
  } catch (error) {
    return { ok: false, errors: [error instanceof Error ? error.message : String(error)], width: complete.width, height: complete.height };
  }
}
