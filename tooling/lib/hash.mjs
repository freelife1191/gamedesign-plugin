import { createHash } from "node:crypto";

export function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function hashFileEntries(entries) {
  const hash = createHash("sha256");
  for (const { relativePath, bytes } of entries) {
    const pathBytes = Buffer.from(relativePath, "utf8");
    const pathLength = Buffer.alloc(4);
    pathLength.writeUInt32BE(pathBytes.length);
    const contentLength = Buffer.alloc(8);
    contentLength.writeBigUInt64BE(BigInt(bytes.length));
    hash.update(pathLength).update(pathBytes).update(contentLength).update(bytes);
  }
  return hash.digest("hex");
}
