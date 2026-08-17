import { lstat, readFile, readdir, realpath } from "node:fs/promises";
import path from "node:path";

import { comparePaths, normalizeRelativePath } from "./paths.mjs";

const utf8 = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
const relativeReference = /(?:^|[('"`\s])((?:\.\.[/\\])+[^)'"`\s]+)/gu;
const vendorCliPath = /(?:^|\/)(?:\.claude\/skills\/svg-infographic|\.agents\/skills\/svg-infographic|skills\/svg-infographic)\/scripts\/(?:check-svg|render)\.mjs$/u;
const sharedUpdateIdentityMatchers = new Map([
  [
    "references/shared/updates/update-policy.json",
    /"productIds":\s*\[\s*"game-design-studio",\s*"game-design-career"\s*\]/u,
  ],
  [
    "scripts/lib/update-advisory.mjs",
    /policy\.productIds\[0\]\s*!==\s*"game-design-studio"\s*\|\|\s*policy\.productIds\[1\]\s*!==\s*"game-design-career"/u,
  ],
  [
    "scripts/inspect-game-design-plugin-updates.mjs",
    /const PLUGINS = new Set\(\["game-design-studio", "game-design-career"\]\);/u,
  ],
]);

export function assertPackagePath(relativePath, seenFoldedPaths) {
  const folded = relativePath.normalize("NFC").toLowerCase();
  const previous = seenFoldedPaths.get(folded);
  if (previous !== undefined) {
    throw new Error(`${relativePath} collides with ${previous} after NFC and case folding`);
  }
  seenFoldedPaths.set(folded, relativePath);
  return relativePath;
}

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

function decodeCommandText(text) {
  let decoded = text;
  for (let attempt = 0; attempt < 32; attempt += 1) {
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) return decoded;
      decoded = next;
    } catch {
      return decoded;
    }
  }
  try {
    if (decodeURIComponent(decoded) !== decoded) {
      throw new Error("Encoded shell path exceeds the 32-pass normalization limit");
    }
  } catch (error) {
    if (/normalization limit/u.test(error.message)) throw error;
    if (/%[0-9a-f]{2}/iu.test(decoded)) {
      throw new Error("Encoded shell path remains ambiguous at the 32-pass normalization limit");
    }
  }
  return decoded;
}

function shellWords(text) {
  const source = text.normalize("NFC").replace(/[\u2044\u2215\uFF0F]/gu, "/");
  const words = [];
  let word = "";
  let hasWord = false;
  let quote = null;

  function finishWord() {
    if (hasWord) words.push(word);
    word = "";
    hasWord = false;
  }

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quote === "'") {
      if (character === "'") quote = null;
      else word += character;
      hasWord = true;
      continue;
    }
    if (quote === '"' || quote === "`") {
      if (character === quote) {
        quote = null;
        hasWord = true;
        continue;
      }
      if (character === "\\") {
        const next = source[index + 1];
        if (next === "\n") {
          index += 1;
          continue;
        }
        if (next === "\r" && source[index + 2] === "\n") {
          index += 2;
          continue;
        }
        if (quote === '"' && next !== undefined && /[$`"\\]/u.test(next)) {
          word += next;
          index += 1;
          hasWord = true;
          continue;
        }
      }
      word += character;
      hasWord = true;
      continue;
    }
    if (/\s/u.test(character)) {
      finishWord();
      continue;
    }
    if (/[|&;<>()]/u.test(character)) {
      finishWord();
      continue;
    }
    if (character === "'" || character === '"' || character === "`") {
      quote = character;
      hasWord = true;
      continue;
    }
    if (character === "$" && (source[index + 1] === "'" || source[index + 1] === '"')) {
      quote = source[index + 1];
      hasWord = true;
      index += 1;
      continue;
    }
    if (character === "\\" || character === "^") {
      const next = source[index + 1];
      if (next === undefined) throw new Error("Malformed shell quoting or trailing escape");
      if (next === "\n") {
        index += 1;
        continue;
      }
      if (next === "\r" && source[index + 2] === "\n") {
        index += 2;
        continue;
      }
      word += next;
      hasWord = true;
      index += 1;
      continue;
    }
    word += character;
    hasWord = true;
  }
  if (quote !== null) throw new Error("Malformed shell quoting: unclosed quote");
  finishWord();
  return words;
}

function containsRawVendorCli(text) {
  const logicalText = text.replace(/\\\r?\n|\^\r?\n/gu, "");
  for (const line of logicalText.split(/\r?\n/u)) {
    let malformedQuoteError;
    for (const variant of [line, line.replaceAll("\\", "/")]) {
      let words;
      try {
        words = shellWords(variant);
      } catch (error) {
        malformedQuoteError = error;
        continue;
      }
      for (const rawToken of words) {
        const token = decodeCommandText(rawToken)
          .replace(/^[('"`<]+|[)'"`>,.;:]+$/gu, "");
        if (vendorCliPath.test(path.posix.normalize(token))) return true;
      }
    }
    if (malformedQuoteError && /svg-infographic/u.test(line.replaceAll("\\", "/"))) {
      throw malformedQuoteError;
    }
  }
  return false;
}

function assertTextIsSafe({ text, relativePath, packageRoot, siblingNames, forbiddenAbsolutePaths, inactiveRelativeReferenceTuples, usedInactiveRelativeReferenceTuples }) {
  const identityMatcher = sharedUpdateIdentityMatchers.get(relativePath);
  const siblingCheckedText = identityMatcher ? text.replace(identityMatcher, "") : text;
  for (const sibling of siblingNames) {
    if (relativePath.includes(sibling) || siblingCheckedText.includes(sibling)) {
      throw new Error(`${relativePath} references sibling package ${sibling}`);
    }
  }
  for (const forbidden of forbiddenAbsolutePaths) {
    if (text.includes(forbidden)) throw new Error(`${relativePath} contains forbidden absolute path ${forbidden}`);
  }
  const isVendoredSkillsteadFile = relativePath.startsWith("skills/svg-infographic/");
  if (relativePath !== "BUILD-MANIFEST.json" && !isVendoredSkillsteadFile && containsRawVendorCli(text)) {
    throw new Error(`${relativePath} contains unsupported raw vendor CLI; use the product wrapper`);
  }

  for (const match of text.matchAll(relativeReference)) {
    const token = match[1].replaceAll("\\", "/").replace(/[>,.;:]+$/u, "");
    const pathPart = token.split(/[?#]/u, 1)[0];
    const resolved = path.resolve(packageRoot, path.dirname(relativePath), pathPart);
    if (!inside(packageRoot, resolved)) {
      const tuple = `${relativePath}\0${pathPart}`;
      if (inactiveRelativeReferenceTuples?.has(tuple)) { usedInactiveRelativeReferenceTuples.add(tuple); continue; }
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
  inactiveRelativeReferenceTuples,
}) {
  if (typeof root !== "string" || typeof packageName !== "string" || packageName.length === 0 || (inactiveRelativeReferenceTuples !== undefined && !(inactiveRelativeReferenceTuples instanceof Set))) {
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
  const usedInactiveRelativeReferenceTuples = new Set();
  const seenFoldedPaths = new Map();

  async function visit(directory, prefix = "") {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => comparePaths(left.name.normalize("NFC"), right.name.normalize("NFC")));
    for (const entry of entries) {
      const rawRelativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
      const relativePath = normalizeRelativePath(rawRelativePath, `package ${packageName}`);
      assertPackagePath(relativePath, seenFoldedPaths);
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
      if (text.startsWith("\uFEFF")) throw new Error(`${relativePath} starts with a UTF-8 BOM`);
      if (text.includes("\r")) throw new Error(`${relativePath} contains a carriage return; packaged text must use LF`);
      assertTextIsSafe({
        text,
        relativePath,
        packageRoot: canonicalRoot,
        siblingNames: siblings,
        forbiddenAbsolutePaths: forbidden,
        inactiveRelativeReferenceTuples,
        usedInactiveRelativeReferenceTuples,
      });
      files += 1;
      utf8Files += 1;
    }
  }

  await visit(canonicalRoot);
  return { files, utf8Files, symlinks: 0, usedInactiveRelativeReferenceTuples: [...usedInactiveRelativeReferenceTuples].sort(comparePaths) };
}
