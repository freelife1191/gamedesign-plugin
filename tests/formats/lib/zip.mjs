import { inflateRawSync } from "node:zlib";

const EOCD = 0x06054b50;
const CENTRAL = 0x02014b50;
const LOCAL = 0x04034b50;

function findEndOfCentralDirectory(bytes) {
  const first = Math.max(0, bytes.length - 65_557);
  for (let offset = bytes.length - 22; offset >= first; offset -= 1) {
    if (bytes.readUInt32LE(offset) === EOCD) return offset;
  }
  throw new Error("invalid zip: end of central directory is missing");
}

export function openZip(input) {
  const bytes = Buffer.from(input);
  const eocd = findEndOfCentralDirectory(bytes);
  const disk = bytes.readUInt16LE(eocd + 4);
  const centralDisk = bytes.readUInt16LE(eocd + 6);
  const entriesOnDisk = bytes.readUInt16LE(eocd + 8);
  const entryCount = bytes.readUInt16LE(eocd + 10);
  const centralOffset = bytes.readUInt32LE(eocd + 16);
  if (disk !== 0 || centralDisk !== 0 || entriesOnDisk !== entryCount) throw new Error("invalid zip: multi-disk archives are unsupported");
  if (entryCount === 0xffff || centralOffset === 0xffffffff) throw new Error("invalid zip: ZIP64 archives are unsupported");

  const records = new Map();
  let offset = centralOffset;
  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > bytes.length || bytes.readUInt32LE(offset) !== CENTRAL) throw new Error("invalid zip: central directory is truncated");
    const compression = bytes.readUInt16LE(offset + 10);
    const compressedSize = bytes.readUInt32LE(offset + 20);
    const uncompressedSize = bytes.readUInt32LE(offset + 24);
    const nameLength = bytes.readUInt16LE(offset + 28);
    const extraLength = bytes.readUInt16LE(offset + 30);
    const commentLength = bytes.readUInt16LE(offset + 32);
    const localOffset = bytes.readUInt32LE(offset + 42);
    const end = offset + 46 + nameLength + extraLength + commentLength;
    if (end > bytes.length) throw new Error("invalid zip: central directory entry is truncated");
    const name = bytes.toString("utf8", offset + 46, offset + 46 + nameLength);
    if (records.has(name)) throw new Error(`invalid zip: duplicate member ${name}`);
    records.set(name, { compression, compressedSize, uncompressedSize, localOffset });
    offset = end;
  }

  return {
    members: [...records.keys()],
    read(name) {
      const record = records.get(name);
      if (!record) throw new Error(`missing zip member: ${name}`);
      const local = record.localOffset;
      if (local + 30 > bytes.length || bytes.readUInt32LE(local) !== LOCAL) throw new Error(`invalid zip local header: ${name}`);
      const nameLength = bytes.readUInt16LE(local + 26);
      const extraLength = bytes.readUInt16LE(local + 28);
      const start = local + 30 + nameLength + extraLength;
      const end = start + record.compressedSize;
      if (end > bytes.length) throw new Error(`truncated zip member: ${name}`);
      const compressed = bytes.subarray(start, end);
      const data = record.compression === 0
        ? Buffer.from(compressed)
        : record.compression === 8
          ? inflateRawSync(compressed)
          : (() => { throw new Error(`unsupported zip compression ${record.compression}: ${name}`); })();
      if (data.length !== record.uncompressedSize) throw new Error(`zip member size mismatch: ${name}`);
      return data;
    },
  };
}
