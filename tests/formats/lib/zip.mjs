import { inflateRawSync } from "node:zlib";

const EOCD = 0x06054b50;
const CENTRAL = 0x02014b50;
const LOCAL = 0x04034b50;

const DEFAULT_LIMITS = Object.freeze({
  maxInputBytes: 64 * 1024 * 1024,
  maxEntries: 4096,
  maxEntryUncompressedBytes: 64 * 1024 * 1024,
  maxTotalUncompressedBytes: 256 * 1024 * 1024,
  maxCompressionRatio: 1000,
});

const CRC32_TABLE = Uint32Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  return crc >>> 0;
});

function limitsFrom(options) {
  const limits = { ...DEFAULT_LIMITS, ...options };
  for (const [name, value] of Object.entries(limits)) {
    if (!Number.isSafeInteger(value) || value <= 0) throw new TypeError(`invalid ZIP limit ${name}`);
  }
  return limits;
}

function findEndOfCentralDirectory(bytes) {
  if (bytes.length < 22) throw new Error("invalid zip: end of central directory is missing");
  const first = Math.max(0, bytes.length - 65_557);
  for (let offset = bytes.length - 22; offset >= first; offset -= 1) {
    if (bytes.readUInt32LE(offset) !== EOCD) continue;
    const commentLength = bytes.readUInt16LE(offset + 20);
    if (offset + 22 + commentLength === bytes.length) return offset;
  }
  throw new Error("invalid zip: end of central directory is missing");
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ byte) & 0xff];
  return (crc ^ 0xffffffff) >>> 0;
}

export function openZip(input, options = {}) {
  const limits = limitsFrom(options);
  const inputLength = input?.byteLength;
  if (!Number.isSafeInteger(inputLength)) throw new TypeError("ZIP input must be buffer-like");
  if (inputLength > limits.maxInputBytes) throw new Error(`ZIP input size limit exceeded: ${inputLength} > ${limits.maxInputBytes}`);
  const bytes = Buffer.isBuffer(input) ? input : Buffer.from(input);
  const eocd = findEndOfCentralDirectory(bytes);
  const disk = bytes.readUInt16LE(eocd + 4);
  const centralDisk = bytes.readUInt16LE(eocd + 6);
  const entriesOnDisk = bytes.readUInt16LE(eocd + 8);
  const entryCount = bytes.readUInt16LE(eocd + 10);
  const centralSize = bytes.readUInt32LE(eocd + 12);
  const centralOffset = bytes.readUInt32LE(eocd + 16);
  if (disk !== 0 || centralDisk !== 0 || entriesOnDisk !== entryCount) throw new Error("invalid zip: multi-disk archives are unsupported");
  if (entryCount === 0xffff || centralOffset === 0xffffffff || centralSize === 0xffffffff) throw new Error("invalid zip: ZIP64 archives are unsupported");
  if (entryCount > limits.maxEntries) throw new Error(`ZIP entry count limit exceeded: ${entryCount} > ${limits.maxEntries}`);
  if (centralOffset + centralSize !== eocd) throw new Error("invalid zip: central directory bounds mismatch");

  const records = new Map();
  let offset = centralOffset;
  let totalUncompressedSize = 0;
  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > eocd || bytes.readUInt32LE(offset) !== CENTRAL) throw new Error("invalid zip: central directory is truncated");
    const flags = bytes.readUInt16LE(offset + 8);
    const compression = bytes.readUInt16LE(offset + 10);
    const checksum = bytes.readUInt32LE(offset + 16);
    const compressedSize = bytes.readUInt32LE(offset + 20);
    const uncompressedSize = bytes.readUInt32LE(offset + 24);
    const nameLength = bytes.readUInt16LE(offset + 28);
    const extraLength = bytes.readUInt16LE(offset + 30);
    const commentLength = bytes.readUInt16LE(offset + 32);
    const localOffset = bytes.readUInt32LE(offset + 42);
    const end = offset + 46 + nameLength + extraLength + commentLength;
    if (end > eocd) throw new Error("invalid zip: central directory entry is truncated");
    const name = bytes.toString("utf8", offset + 46, offset + 46 + nameLength);
    if (records.has(name)) throw new Error(`invalid zip: duplicate member ${name}`);
    if ((flags & 1) !== 0) throw new Error(`unsupported encrypted zip member: ${name}`);
    if (uncompressedSize > limits.maxEntryUncompressedBytes) throw new Error(`ZIP entry size limit exceeded: ${name}`);
    totalUncompressedSize += uncompressedSize;
    if (!Number.isSafeInteger(totalUncompressedSize) || totalUncompressedSize > limits.maxTotalUncompressedBytes) {
      throw new Error(`ZIP total uncompressed size limit exceeded: ${totalUncompressedSize} > ${limits.maxTotalUncompressedBytes}`);
    }
    const ratio = uncompressedSize === 0 ? 1 : compressedSize === 0 ? Number.POSITIVE_INFINITY : uncompressedSize / compressedSize;
    if (ratio > limits.maxCompressionRatio) throw new Error(`ZIP compression ratio limit exceeded: ${name}`);
    records.set(name, { flags, compression, checksum, compressedSize, uncompressedSize, localOffset });
    offset = end;
  }
  if (offset !== eocd) throw new Error("invalid zip: central directory size mismatch");

  return {
    members: [...records.keys()],
    read(name) {
      const record = records.get(name);
      if (!record) throw new Error(`missing zip member: ${name}`);
      const local = record.localOffset;
      if (local + 30 > centralOffset || bytes.readUInt32LE(local) !== LOCAL) throw new Error(`invalid zip local header: ${name}`);
      const localFlags = bytes.readUInt16LE(local + 6);
      const localCompression = bytes.readUInt16LE(local + 8);
      const nameLength = bytes.readUInt16LE(local + 26);
      const extraLength = bytes.readUInt16LE(local + 28);
      const start = local + 30 + nameLength + extraLength;
      const end = start + record.compressedSize;
      if (end > centralOffset) throw new Error(`truncated zip member: ${name}`);
      const localName = bytes.toString("utf8", local + 30, local + 30 + nameLength);
      if (localName !== name || localFlags !== record.flags || localCompression !== record.compression) throw new Error(`zip local header mismatch: ${name}`);
      const compressed = bytes.subarray(start, end);
      const data = record.compression === 0
        ? Buffer.from(compressed)
        : record.compression === 8
          ? inflateRawSync(compressed, { maxOutputLength: Math.max(1, record.uncompressedSize) })
          : (() => { throw new Error(`unsupported zip compression ${record.compression}: ${name}`); })();
      if (data.length !== record.uncompressedSize) throw new Error(`zip member size mismatch: ${name}`);
      if (crc32(data) !== record.checksum) throw new Error(`ZIP CRC32 mismatch: ${name}`);
      return data;
    },
  };
}
