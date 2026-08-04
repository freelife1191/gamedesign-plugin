import { lstat } from "node:fs/promises";
import path from "node:path";

export function comparePaths(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function normalizeRelativePath(value, label = "path") {
  if (typeof value !== "string" || value.length === 0 || value.includes("\0")) {
    throw new Error(`Unsafe path for ${label}`);
  }

  const slashPath = value.replaceAll("\\", "/");
  if (
    slashPath.startsWith("/")
    || slashPath.startsWith("//")
    || /^[A-Za-z]:\//u.test(slashPath)
  ) {
    throw new Error(`Unsafe path for ${label}: ${value}`);
  }

  const segments = slashPath.split("/");
  if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) {
    throw new Error(`Unsafe path for ${label}: ${value}`);
  }

  return segments.map((segment) => segment.normalize("NFC")).join("/");
}

export function assertUniqueNormalizedPaths(values, label) {
  const normalized = new Set();
  return values.map((value) => {
    const normalizedPath = normalizeRelativePath(value, label);
    if (normalized.has(normalizedPath)) {
      throw new Error(`Duplicate normalized path in ${label}: ${normalizedPath}`);
    }
    normalized.add(normalizedPath);
    return normalizedPath;
  });
}

export function joinWithin(root, relativePath, label = "path") {
  const normalized = normalizeRelativePath(relativePath, label);
  const absoluteRoot = path.resolve(root);
  const candidate = path.resolve(absoluteRoot, ...normalized.split("/"));
  if (candidate !== absoluteRoot && !candidate.startsWith(`${absoluteRoot}${path.sep}`)) {
    throw new Error(`Unsafe path for ${label}: ${relativePath}`);
  }
  return candidate;
}

export async function assertNoSymlinkPath(root, relativePath, label = "path") {
  const normalized = normalizeRelativePath(relativePath, label);
  let current = path.resolve(root);
  const rootStats = await lstat(current);
  if (rootStats.isSymbolicLink()) throw new Error(`Symlink is not allowed in ${label}: ${root}`);
  for (const segment of normalized.split("/")) {
    current = path.join(current, segment);
    const stats = await lstat(current).catch((error) => {
      if (error.code === "ENOENT") throw new Error(`Missing ${label}: ${normalized}`);
      throw error;
    });
    if (stats.isSymbolicLink()) throw new Error(`Symlink is not allowed in ${label}: ${normalized}`);
  }
  return current;
}
