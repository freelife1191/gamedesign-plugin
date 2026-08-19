import { createHash } from "node:crypto";
import { lstat, readFile, readdir, realpath } from "node:fs/promises";
import path from "node:path";

import { comparePaths, normalizeRelativePath } from "./paths.mjs";

// ignoreBOM keeps a leading U+FEFF in the decoded text so the BOM gate below can see it.
const utf8 = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
const relativeReference = /(?:^|[('"`\s])((?:\.\.[/\\])+[^)'"`\s]+)/gu;
const vendorCliPath = /(?:^|\/)(?:\.claude\/skills\/svg-infographic|\.agents\/skills\/svg-infographic|skills\/svg-infographic)\/scripts\/(?:check-svg|render)\.mjs$/u;
// Exact package-relative path to a regex whose matches are stripped before the sibling check, for the
// few shared files that must legitimately declare both product IDs. Two kinds live here, and they are
// not equally narrow. The first three are declaration-pinned: each permits one exact line, so every
// other sibling mention in that file still fails. The last two are token-class matchers that permit the
// quoted product identifier anywhere in one specific file — the handoff contract is projected
// byte-identically into both packages, so it necessarily names the sibling throughout. That exemption is
// still bounded three ways: it is keyed to those two paths and reaches no other file, it strips only the
// quoted form so prose and unquoted mentions still fail, and tests/isolation/plugin-smoke.test.mjs pins
// both of those edges. Widening either matcher means re-checking those pins.
const sharedIdentityMatchers = new Map([
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
  ["skills/game-design-studio/references/handoff.md", /"game-design-(?:studio|career)"/gu],
  ["skills/game-design-career/references/handoff.md", /"game-design-(?:studio|career)"/gu],
]);

// A packaged tree is text by contract, and that contract is what lets this audit read every byte we
// ship. Vendored upstreams do ship the occasional font or image, and those bytes decode as nothing, so
// the text gate needs a lane rather than an exception. The lane is not a path prefix and not an
// extension allowlist: a file skips the UTF-8 decode only when the caller registered it by exact path
// with the size and digest the vendor lock declares, the bytes hash to that digest, and the leading
// bytes carry the signature its extension claims. Everything else still applies — the path gates, the
// symlink gate, and a raw-byte search for sibling package names and forbidden absolute paths — so the
// lane buys an upstream its fonts without buying anyone a place to hide a script.
export const BINARY_SIGNATURES = new Map([
  [".ttf", [[0x00, 0x01, 0x00, 0x00], [0x74, 0x72, 0x75, 0x65]]],
  [".otf", [[0x4f, 0x54, 0x54, 0x4f]]],
  [".ttc", [[0x74, 0x74, 0x63, 0x66]]],
  [".woff", [[0x77, 0x4f, 0x46, 0x46]]],
  [".woff2", [[0x77, 0x4f, 0x46, 0x32]]],
  [".png", [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]]],
  [".jpg", [[0xff, 0xd8, 0xff]]],
  [".jpeg", [[0xff, 0xd8, 0xff]]],
  [".gif", [[0x47, 0x49, 0x46, 0x38]]],
  [".webp", [[0x52, 0x49, 0x46, 0x46]]],
  [".ico", [[0x00, 0x00, 0x01, 0x00]]],
  [".pdf", [[0x25, 0x50, 0x44, 0x46, 0x2d]]],
].map(([extension, signatures]) => [extension, signatures.map((bytes) => Buffer.from(bytes))]));

function assertRegisteredBinary({ bytes, relativePath, expected, siblingNames, forbiddenAbsolutePaths }) {
  if (bytes.length !== expected.size) {
    throw new Error(`${relativePath} is registered as binary at ${expected.size} bytes but is ${bytes.length}`);
  }
  if (createHash("sha256").update(bytes).digest("hex") !== expected.sha256) {
    throw new Error(`${relativePath} does not match its registered binary digest`);
  }
  const extension = path.posix.extname(relativePath).toLowerCase();
  const signatures = BINARY_SIGNATURES.get(extension);
  if (!signatures) {
    throw new Error(`${relativePath} is registered as binary but ${extension || "an extensionless name"} has no known signature`);
  }
  if (!signatures.some((signature) => bytes.subarray(0, signature.length).equals(signature))) {
    throw new Error(`${relativePath} does not start with a ${extension} signature`);
  }
  // The text checks that still make sense on undecodable bytes run against the raw buffer, so a name
  // or a host path smuggled into a font table is caught even though the file never becomes a string.
  for (const sibling of siblingNames) {
    if (relativePath.includes(sibling) || bytes.includes(Buffer.from(sibling, "utf8"))) {
      throw new Error(`${relativePath} references sibling package ${sibling}`);
    }
  }
  for (const forbidden of forbiddenAbsolutePaths) {
    if (bytes.includes(Buffer.from(forbidden, "utf8"))) {
      throw new Error(`${relativePath} contains forbidden absolute path ${forbidden}`);
    }
  }
}

function normalizeBinaryRegister(binaryFiles) {
  if (binaryFiles === undefined) return new Map();
  if (!(binaryFiles instanceof Map)) throw new TypeError("binaryFiles must be a Map of package path to {size, sha256}");
  for (const [relativePath, expected] of binaryFiles) {
    if (typeof relativePath !== "string" || relativePath.length === 0) throw new TypeError("binaryFiles keys must be package paths");
    if (!expected || !Number.isInteger(expected.size) || expected.size < 0 || !/^[a-f0-9]{64}$/u.test(expected.sha256 ?? "")) {
      throw new TypeError(`binaryFiles entry for ${relativePath} must declare an integer size and a sha256`);
    }
  }
  return binaryFiles;
}

export const MAX_PACKAGE_PATH_LENGTH = 150;

export function assertPackagePath(relativePath, seenFoldedPaths) {
  const normalized = relativePath.normalize("NFC");
  if (normalized.length > MAX_PACKAGE_PATH_LENGTH) {
    throw new Error(`${relativePath} exceeds the ${MAX_PACKAGE_PATH_LENGTH} character package path budget`);
  }
  // toLowerCase() alone is ECMAScript simple case mapping, which leaves fold-equivalent pairs
  // (ſ/S, ς/Σ, ß/SS, ﬁ/fi) distinct even though NTFS and APFS collapse them. Upper-casing first
  // reaches those mappings; the trailing NFC pass re-composes what the round trip decomposed.
  const folded = normalized.toUpperCase().toLowerCase().normalize("NFC");
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

function assertTextIsSafe({ text, relativePath, packageRoot, siblingNames, forbiddenAbsolutePaths, inactiveRelativeReferenceTuples, usedInactiveRelativeReferenceTuples, vendorRoots }) {
  const identityMatcher = sharedIdentityMatchers.get(relativePath);
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

  // The escaping-reference gate exists to catch our own build shipping a file that still reaches back
  // into the repository. A vendored file cannot: its bytes are the upstream tag's, verified against the
  // upstream tree and pinned by digest in the vendor lock, and we never edit them — so an upstream test
  // fixture that quotes an escaping import path is a string in a test, not a leak we could repair. The
  // repo-only `shared/` fallback below stays live for vendored files, because that pattern names this
  // repository specifically and no upstream has any business writing it.
  const isVendoredFile = vendorRoots.some((vendorRoot) => relativePath.startsWith(`${vendorRoot}/`));
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
      if (isVendoredFile) continue;
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
  binaryFiles,
  vendorRoots = [],
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
  const binaryRegister = normalizeBinaryRegister(binaryFiles);
  const vendorPrefixes = [...new Set(vendorRoots)].sort(comparePaths);
  const usedBinaryPaths = new Set();
  let files = 0;
  let utf8Files = 0;
  let binaryFileCount = 0;
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
      const registeredBinary = binaryRegister.get(relativePath);
      if (registeredBinary) {
        assertRegisteredBinary({
          bytes,
          relativePath,
          expected: registeredBinary,
          siblingNames: siblings,
          forbiddenAbsolutePaths: forbidden,
        });
        usedBinaryPaths.add(relativePath);
        files += 1;
        binaryFileCount += 1;
        continue;
      }
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
        vendorRoots: vendorPrefixes,
      });
      files += 1;
      utf8Files += 1;
    }
  }

  await visit(canonicalRoot);
  // A register entry that never matched a file means the caller and the package disagree about what is
  // in the tree. Left unreported it would be a standing permission to skip the text gate on a path that
  // some later build actually creates.
  const unusedBinaryPaths = [...binaryRegister.keys()].filter((relativePath) => !usedBinaryPaths.has(relativePath));
  if (unusedBinaryPaths.length > 0) {
    throw new Error(`registered binary files are absent from ${packageName}: ${unusedBinaryPaths.sort(comparePaths).join(", ")}`);
  }
  return {
    files,
    utf8Files,
    binaryFiles: binaryFileCount,
    symlinks: 0,
    usedInactiveRelativeReferenceTuples: [...usedInactiveRelativeReferenceTuples].sort(comparePaths),
  };
}
