import { lstat, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { comparePaths, normalizeRelativePath } from "./paths.mjs";

function recordNormalizedTreePath(paths, rawRelativePath, label) {
  const rawPath = rawRelativePath.replaceAll("\\", "/");
  const normalizedPath = normalizeRelativePath(rawPath, label);
  const existing = paths.get(normalizedPath);
  if (existing !== undefined && existing !== rawPath) {
    throw new Error(`Duplicate normalized path in ${label}: ${normalizedPath}`);
  }
  paths.set(normalizedPath, rawPath);
  return normalizedPath;
}

export function assertUniqueNormalizedTreePaths(relativePaths, label = "tree") {
  const paths = new Map();
  return relativePaths.map((relativePath) => {
    const rawPath = relativePath.replaceAll("\\", "/");
    const segments = rawPath.split("/");
    for (let index = 1; index <= segments.length; index += 1) {
      recordNormalizedTreePath(paths, segments.slice(0, index).join("/"), label);
    }
    return normalizeRelativePath(rawPath, label);
  });
}

export async function collectTree(sourceRoot, { label = sourceRoot } = {}) {
  const rootStats = await lstat(sourceRoot).catch((error) => {
    if (error.code === "ENOENT") throw new Error(`Missing source root: ${label}`);
    throw error;
  });
  if (rootStats.isSymbolicLink()) throw new Error(`Symlink is not allowed in ${label}`);
  if (!rootStats.isDirectory()) throw new Error(`Source root is not a directory: ${label}`);

  const collected = [];
  const normalizedPaths = new Map();

  async function visit(directory, prefix) {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => comparePaths(left.name.normalize("NFC"), right.name.normalize("NFC")));
    for (const entry of entries) {
      const sourcePath = path.join(directory, entry.name);
      const rawRelativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
      const relativePath = recordNormalizedTreePath(normalizedPaths, rawRelativePath, label);
      if (entry.isSymbolicLink()) throw new Error(`Symlink is not allowed in ${label}: ${relativePath}`);
      if (entry.isDirectory()) {
        await visit(sourcePath, rawRelativePath);
      } else if (entry.isFile()) {
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
