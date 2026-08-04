import { lstat, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { comparePaths, normalizeRelativePath } from "./paths.mjs";

export async function collectTree(sourceRoot, { label = sourceRoot } = {}) {
  const rootStats = await lstat(sourceRoot).catch((error) => {
    if (error.code === "ENOENT") throw new Error(`Missing source root: ${label}`);
    throw error;
  });
  if (rootStats.isSymbolicLink()) throw new Error(`Symlink is not allowed in ${label}`);
  if (!rootStats.isDirectory()) throw new Error(`Source root is not a directory: ${label}`);

  const collected = [];
  const normalizedPaths = new Set();

  async function visit(directory, prefix) {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => comparePaths(left.name.normalize("NFC"), right.name.normalize("NFC")));
    for (const entry of entries) {
      const sourcePath = path.join(directory, entry.name);
      const rawRelativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
      const relativePath = normalizeRelativePath(rawRelativePath, label);
      if (entry.isSymbolicLink()) throw new Error(`Symlink is not allowed in ${label}: ${relativePath}`);
      if (entry.isDirectory()) {
        await visit(sourcePath, rawRelativePath);
      } else if (entry.isFile()) {
        if (normalizedPaths.has(relativePath)) {
          throw new Error(`Duplicate normalized path in ${label}: ${relativePath}`);
        }
        normalizedPaths.add(relativePath);
        collected.push({ bytes: await readFile(sourcePath), relativePath, sourcePath });
      } else {
        throw new Error(`Unsupported filesystem entry in ${label}: ${relativePath}`);
      }
    }
  }

  await visit(sourceRoot, "");
  return collected.sort((left, right) => comparePaths(left.relativePath, right.relativePath));
}

export async function copyTree(sourceRoot, destinationRoot, options) {
  const entries = await collectTree(sourceRoot, options);
  for (const entry of entries) {
    const destination = path.join(destinationRoot, ...entry.relativePath.split("/"));
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, entry.bytes);
  }
  return entries.map(({ relativePath }) => relativePath);
}
