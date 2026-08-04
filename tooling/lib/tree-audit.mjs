import { lstat, readFile, readdir, realpath } from "node:fs/promises";
import path from "node:path";

import { comparePaths, normalizeRelativePath } from "./paths.mjs";

const utf8 = new TextDecoder("utf-8", { fatal: true });
const rawVendorCli = /(?:\.claude[/\\]skills[/\\]svg-infographic|\.agents[/\\]skills[/\\]svg-infographic|skills[/\\]svg-infographic)[/\\]scripts[/\\](?:check-svg|render)\.mjs/u;
const relativeReference = /(?:^|[('"`\s])((?:\.\.[/\\])+[^)'"`\s]+)/gu;

function inside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

function normalizedForbiddenPaths(paths) {
  return [...new Set(paths
    .filter((value) => typeof value === "string" && value.length > 1)
    .map((value) => path.resolve(value)))]
    .sort((left, right) => right.length - left.length || comparePaths(left, right));
}

function assertTextIsSafe({ text, relativePath, packageRoot, siblingNames, forbiddenAbsolutePaths }) {
  for (const sibling of siblingNames) {
    if (relativePath.includes(sibling) || text.includes(sibling)) {
      throw new Error(`${relativePath} references sibling package ${sibling}`);
    }
  }
  for (const forbidden of forbiddenAbsolutePaths) {
    if (text.includes(forbidden)) throw new Error(`${relativePath} contains forbidden absolute path ${forbidden}`);
  }
  if (relativePath !== "BUILD-MANIFEST.json" && !relativePath.startsWith("skills/svg-infographic/") && rawVendorCli.test(text)) {
    throw new Error(`${relativePath} contains unsupported raw vendor CLI; use the product wrapper`);
  }

  for (const match of text.matchAll(relativeReference)) {
    const token = match[1].replaceAll("\\", "/").replace(/[>,.;:]+$/u, "");
    const pathPart = token.split(/[?#]/u, 1)[0];
    const resolved = path.resolve(packageRoot, path.dirname(relativePath), pathPart);
    if (!inside(packageRoot, resolved)) {
      if (/(?:^|[/\\])shared[/\\]/u.test(token)) {
        throw new Error(`${relativePath} contains repo-only shared fallback: ${token}`);
      }
      throw new Error(`${relativePath} relative reference escapes package root: ${token}`);
    }
  }
}

export async function auditTree({
  root,
  packageName,
  siblingNames = [],
  forbiddenAbsolutePaths = [],
}) {
  if (typeof root !== "string" || typeof packageName !== "string" || packageName.length === 0) {
    throw new TypeError("root and packageName are required");
  }
  const absoluteRoot = path.resolve(root);
  const rootStats = await lstat(absoluteRoot).catch((error) => {
    if (error.code === "ENOENT") throw new Error(`Missing package tree: ${absoluteRoot}`);
    throw error;
  });
  if (rootStats.isSymbolicLink()) throw new Error(`Package root is a symlink: ${absoluteRoot}`);
  if (!rootStats.isDirectory()) throw new Error(`Package root is not a directory: ${absoluteRoot}`);
  const canonicalRoot = await realpath(absoluteRoot);

  const forbidden = normalizedForbiddenPaths(forbiddenAbsolutePaths);
  const siblings = [...new Set(siblingNames)].sort(comparePaths);
  let files = 0;
  let utf8Files = 0;

  async function visit(directory, prefix = "") {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => comparePaths(left.name.normalize("NFC"), right.name.normalize("NFC")));
    for (const entry of entries) {
      const rawRelativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
      const relativePath = normalizeRelativePath(rawRelativePath, `package ${packageName}`);
      const entryPath = path.join(directory, entry.name);
      const stats = await lstat(entryPath);
      if (stats.isSymbolicLink()) throw new Error(`${relativePath} is a symlink`);
      if (stats.isDirectory()) {
        await visit(entryPath, rawRelativePath);
        continue;
      }
      if (!stats.isFile()) throw new Error(`${relativePath} is an unsupported filesystem entry`);
      const canonical = await realpath(entryPath);
      if (!inside(canonicalRoot, canonical)) throw new Error(`${relativePath} escapes package root`);
      const bytes = await readFile(entryPath);
      let text;
      try {
        text = utf8.decode(bytes);
      } catch {
        throw new Error(`${relativePath} is not valid UTF-8`);
      }
      assertTextIsSafe({
        text,
        relativePath,
        packageRoot: canonicalRoot,
        siblingNames: siblings,
        forbiddenAbsolutePaths: forbidden,
      });
      files += 1;
      utf8Files += 1;
    }
  }

  await visit(canonicalRoot);
  return { files, utf8Files, symlinks: 0 };
}
