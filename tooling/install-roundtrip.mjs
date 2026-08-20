#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstat, mkdir, readFile, readdir, realpath, stat, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

import { copyTree } from "./lib/copy-tree.mjs";
import { cleanupGuardedTempRoot, createGuardedTempRoot } from "./lib/guarded-temp.mjs";
import { sha256 } from "./lib/hash.mjs";

const MARKETPLACE = "game-design-suite";
const PRODUCTS = Object.freeze(["game-design-career", "game-design-studio"]);

// Every path this round trip touches carries a Hangul syllable and a space, because that pair is what
// breaks on a Windows code page and in a command line that was handed an unquoted argument. A run over
// ASCII paths proves nothing about the environment this suite actually installs into.
const HANGUL_DIRECTORIES = Object.freeze({
  home: "홈 디렉터리",
  codexHome: "코덱스 홈",
  marketplace: "마켓플레이스 소스",
  workspace: "작업 공간",
  temp: "임시 파일",
});

// The report calls out these three user-critical files separately: the Korean README is the largest
// Hangul payload, plugin.json is what the host parses, and the entry skill is what a user first runs.
// A full-tree fingerprint below additionally proves every packaged file and mode survived unchanged.
const COMPARED_FILES = Object.freeze(Object.fromEntries(PRODUCTS.map((product) => [
  product,
  Object.freeze(["README.md", ".codex-plugin/plugin.json", `skills/${product}/SKILL.md`]),
])));

// A precondition failure is our own message, not a child process's, so it carries nothing to redact and
// is the one thing a failing install gate most needs to read.
export class PreconditionError extends Error {}

// Our own diagnostics, written here in this file, describing what we checked and what we found. They
// name a stage, a product, or a package-relative path — never a user home, a credential, or a remote
// body — so they survive redaction intact. Anything thrown by the filesystem or by a child process is
// foreign text and gets redacted.
export class DiagnosticError extends Error {}

export function samePathAfterNfc(left, right) {
  return String(left).normalize("NFC") === String(right).normalize("NFC");
}

export function assertNoReplacementCharacter(text, label) {
  if (String(text).includes("�")) throw new DiagnosticError(`${label} returned a U+FFFD replacement character`);
}

// Failure text from a child process can carry the user's home path, a credential, or a remote response
// body. None of that is needed to act on a failure, and all of it ends up in a public CI log.
export function redactInstallFailure(error) {
  if (error instanceof DiagnosticError) return error.message;
  const source = String(error instanceof Error ? error.message : error);
  // A libuv error code names the kind of failure without naming anything about the machine, and a
  // failure that says only "command failed" costs a whole CI round to diagnose.
  const code = typeof error?.code === "string" ? error.code : (/\b(E[A-Z]{3,})\b/u.exec(source)?.[1] ?? null);
  if (code) return `${code} (details redacted)`;
  if (/timed out|timeout/iu.test(source)) return "a command timed out (details redacted)";
  return "command failed (details redacted)";
}

// Content plus mode plus the NFC-normalized relative path. The spec requires bytes AND mode to be
// unchanged across install, update, and reinstall, so a fingerprint that hashed content alone would
// pass a run that quietly flipped a file to 0600.
export async function treeFingerprint(root) {
  const hash = createHash("sha256");
  const walk = async (directory, prefix) => {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0));
    for (const entry of entries) {
      const absolute = path.join(directory, entry.name);
      const relative = path.posix.join(prefix, entry.name).normalize("NFC");
      const stats = await lstat(absolute);
      if (stats.isSymbolicLink()) throw new DiagnosticError("fingerprinted tree contains a symlink");
      const mode = (stats.mode & 0o7777).toString(8);
      if (stats.isDirectory()) {
        hash.update(`D ${relative} ${mode}\n`);
        await walk(absolute, relative);
        continue;
      }
      if (!stats.isFile()) throw new DiagnosticError("fingerprinted tree contains a non-regular file");
      hash.update(`F ${relative} ${mode} ${sha256(await readFile(absolute))}\n`);
    }
  };
  await walk(root, ".");
  return hash.digest("hex");
}

// Extracted so the mismatch path is testable. An install check that has only ever been run against a
// matching pair proves the two hashes were computed, not that a difference would have been caught.
export async function compareInstalledFiles(sourceRoot, cacheRoot, relativePaths, label) {
  const compared = [];
  for (const relative of relativePaths) {
    const sourceBytes = await readFile(path.join(sourceRoot, relative));
    const cachedBytes = await readFile(path.join(cacheRoot, relative));
    const digest = sha256(sourceBytes);
    if (digest !== sha256(cachedBytes)) throw new DiagnosticError(`${label}/${relative} differs between source and install cache`);
    assertNoReplacementCharacter(sourceBytes.toString("utf8"), `${label}/${relative}`);
    compared.push({ path: relative, sha256: digest });
  }
  return compared;
}

function installedPlugins(listing) {
  if (!listing || typeof listing !== "object" || !Array.isArray(listing.installed)) {
    throw new DiagnosticError("plugin list returned no installed collection");
  }
  return listing.installed;
}

function pluginIsListed(listing, product) {
  return installedPlugins(listing).some((entry) => entry?.pluginId === `${product}@${MARKETPLACE}`
    || (entry?.name === product && entry?.marketplaceName === MARKETPLACE));
}

function marketplaceIsListed(listing) {
  if (!listing || typeof listing !== "object" || !Array.isArray(listing.marketplaces)) {
    throw new DiagnosticError("marketplace list returned no marketplaces collection");
  }
  return listing.marketplaces.some((entry) => entry?.name === MARKETPLACE);
}

async function pathExists(target) {
  return lstat(target).then(() => true).catch(() => false);
}

async function stateJsonFiles(root) {
  const files = [];
  const walk = async (directory) => {
    const entries = await readdir(directory, { withFileTypes: true }).catch((error) => {
      if (error?.code === "ENOENT") return [];
      throw error;
    });
    for (const entry of entries) {
      const absolute = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) throw new DiagnosticError("Codex state contains a symlink");
      if (entry.isDirectory()) {
        await walk(absolute);
      } else if (entry.isFile() && entry.name.endsWith(".json")) {
        files.push(absolute);
      }
    }
  };
  await walk(root);
  return files;
}

export async function assertNoProductStateResidue(codexHome, productSources) {
  const cacheRoot = path.join(codexHome, "plugins", "cache", MARKETPLACE);
  for (const product of PRODUCTS) {
    if (await pathExists(path.join(cacheRoot, product))) {
      throw new DiagnosticError(`${product} cache remains after marketplace removal`);
    }
  }
  const needles = PRODUCTS.flatMap((product) => [
    `${product}@${MARKETPLACE}`,
    ...(Array.isArray(productSources.get(product)) ? productSources.get(product) : [productSources.get(product)]),
  ]);
  for (const stateFile of await stateJsonFiles(codexHome)) {
    const text = await readFile(stateFile, "utf8");
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      continue;
    }
    const serialized = JSON.stringify(parsed).normalize("NFC");
    if (needles.some((needle) => needle && serialized.includes(needle.normalize("NFC")))) {
      throw new DiagnosticError("product identifier or source path remains in Codex state JSON after removal");
    }
  }
}

// A launcher is either a native executable we spawn directly, or a JavaScript entry we hand to node.
// Never a Windows .cmd/.bat shim: Node refuses to spawn those without a shell, and a shell would have to
// re-quote the Hangul, space-containing paths this whole check exists to exercise.
function launcher(executable) {
  return /\.[cm]?js$/u.test(executable) ? [process.execPath, executable] : [executable];
}

function run(executable, args, { cwd, env, timeout = 180_000, json = false }) {
  const [command, ...prefix] = launcher(executable);
  const label = path.basename(executable);
  const result = spawnSync(command, [...prefix, ...args], { cwd, env, encoding: "utf8", shell: false, timeout });
  if (result.error) throw result.error;
  if (result.signal) throw new DiagnosticError(`${label} terminated by ${result.signal}`);
  if (result.status !== 0) throw new DiagnosticError(`${label} exited ${result.status}`);
  assertNoReplacementCharacter(result.stdout ?? "", `${label} stdout`);
  assertNoReplacementCharacter(result.stderr ?? "", `${label} stderr`);
  if (!json) return result.stdout;
  try {
    return JSON.parse(result.stdout);
  } catch {
    throw new DiagnosticError(`${label} returned invalid JSON`);
  }
}

async function findExecutable(name) {
  // .cmd and .bat are deliberately absent: see launcher(). On Windows a PATH lookup finds only a real
  // executable, and a shim-only installation is reported as a missing CLI rather than spawned unsafely.
  const extensions = process.platform === "win32" ? [".exe", ".com", ""] : [""];
  for (const directory of (process.env.PATH ?? "").split(path.delimiter).filter(Boolean)) {
    for (const extension of extensions) {
      const candidate = path.join(directory, `${name}${extension}`);
      // stat, not lstat: both Homebrew and a global npm install put a symlink on PATH, and an lstat
      // here reports "not a file" and turns a present CLI into a skipped gate.
      const stats = await stat(candidate).catch(() => null);
      if (stats?.isFile()) return candidate;
    }
  }
  return null;
}

// The user's real Codex home is never an input here, but a bug that wrote into it would be the worst
// failure this tool could have, so we prove it did not move.
async function productionFingerprint() {
  const root = process.env.CODEX_HOME ? path.resolve(process.env.CODEX_HOME) : path.join(homedir(), ".codex");
  const entries = await readdir(root, { withFileTypes: true }).catch(() => null);
  if (entries === null) return "absent";
  const listing = entries
    .map((entry) => `${entry.name.normalize("NFC")}:${entry.isDirectory() ? "d" : "f"}`)
    .sort()
    .join("\n");
  return sha256(Buffer.from(listing, "utf8"));
}

function isolatedEnvironment(root) {
  const home = path.join(root, HANGUL_DIRECTORIES.home);
  const temp = path.join(root, HANGUL_DIRECTORIES.temp);
  return {
    HOME: home,
    USERPROFILE: home,
    CODEX_HOME: path.join(root, HANGUL_DIRECTORIES.codexHome),
    TMPDIR: temp,
    TEMP: temp,
    TMP: temp,
    PATH: process.env.PATH ?? "",
    // The C locale is the point, not an accident: it is the environment where a decoder that guesses
    // the code page instead of committing to UTF-8 emits U+FFFD, which is what this run asserts against.
    LANG: "C",
    LC_ALL: "C",
    GAME_DESIGN_UPDATE_CHECKS: "false",
  };
}

async function stageMarketplaceSource(repoRoot, destination) {
  await mkdir(destination, { recursive: true });
  await copyTree(path.join(repoRoot, ".agents"), path.join(destination, ".agents"), { label: "marketplace manifest" });
  await copyTree(path.join(repoRoot, "plugins"), path.join(destination, "plugins"), { label: "marketplace plugins" });
}

export async function runInstallRoundtrip({
  repoRoot = fileURLToPath(new URL("..", import.meta.url)),
  tempParent = tmpdir(),
  requireCodex = false,
  codexPath = null,
  findExecutableImpl = findExecutable,
  runImpl = run,
} = {}) {
  const codex = codexPath ?? await findExecutableImpl("codex");
  if (!codex) {
    if (requireCodex) {
      throw new PreconditionError("codex CLI is required for the install gate but was not found on PATH; pass --codex <path to the executable or to bin/codex.js>");
    }
    return {
      status: "SKIPPED",
      reason: "codex-unavailable",
      products: [],
      productionStateUnchanged: true,
      temporaryStateCleanup: true,
      failure: null,
    };
  }

  const canonicalRepoRoot = path.resolve(repoRoot);
  const before = await productionFingerprint();
  const registration = await createGuardedTempRoot({ parent: tempParent, prefix: "game-design-install-roundtrip-" });
  const env = isolatedEnvironment(registration.root);
  const marketplaceRoot = path.join(registration.root, HANGUL_DIRECTORIES.marketplace);
  const workspace = path.join(registration.root, HANGUL_DIRECTORIES.workspace);
  const products = [];
  const productSources = new Map();
  let status = "INCOMPLETE";
  let failure = null;
  let temporaryStateCleanup = false;
  // The redaction below is deliberate, and it leaves a CI failure with nothing to act on unless we say
  // where we were. A stage name is our own literal, so it carries no path, credential, or remote body.
  let stage = "prepare-workspace";

  try {
    await Promise.all([env.HOME, env.CODEX_HOME, env.TMPDIR, workspace].map((directory) => mkdir(directory, { recursive: true })));
    // A design-memory directory and an unrelated sibling: the spec requires both to be untouched, and a
    // check over an empty workspace could not tell an untouched tree from an ignored one.
    await mkdir(path.join(workspace, ".game-design"), { recursive: true });
    await writeFile(path.join(workspace, ".game-design", "메모 파일.md"), "설치 전 상태\n", "utf8");
    await writeFile(path.join(workspace, "무관한 이웃 파일.txt"), "install must not touch this\n", "utf8");
    stage = "stage-marketplace-source";
    await stageMarketplaceSource(canonicalRepoRoot, marketplaceRoot);

    stage = "marketplace-add";
    await runImpl(codex, ["plugin", "marketplace", "add", marketplaceRoot, "--json"], { cwd: workspace, env, json: true });
    stage = "workspace-fingerprint-before";
    const workspaceBefore = await treeFingerprint(workspace);

    for (const product of PRODUCTS) {
      stage = `read-manifest:${product}`;
      const manifestPath = path.join(marketplaceRoot, "plugins", product, ".codex-plugin/plugin.json");
      const { version } = JSON.parse(await readFile(manifestPath, "utf8"));
      if (typeof version !== "string" || version.length === 0) throw new DiagnosticError(`${product} manifest has no version`);
      const cacheRoot = path.join(env.CODEX_HOME, "plugins", "cache", MARKETPLACE, product, version);

      // Install, then install again. The spec requires the workspace to survive both, and requires the
      // second run to be a real no-op rather than a partial rewrite of the cache.
      for (const attempt of ["install", "reinstall"]) {
        stage = `plugin-add:${product}:${attempt}`;
        await runImpl(codex, ["plugin", "add", `${product}@${MARKETPLACE}`, "--json"], { cwd: workspace, env, json: true });
        if (!samePathAfterNfc(await realpath(cacheRoot), cacheRoot)) {
          throw new DiagnosticError(`${attempt} resolved the plugin cache outside its declared path`);
        }
      }

      stage = `plugin-list:${product}`;
      const listed = await runImpl(codex, ["plugin", "list", "--json"], { cwd: workspace, env, json: true });
      assertNoReplacementCharacter(JSON.stringify(listed), "plugin list");
      if (!pluginIsListed(listed, product)) throw new DiagnosticError(`${product} is absent from plugin list after reinstall`);

      stage = `compare-installed-files:${product}`;
      const compared = await compareInstalledFiles(
        path.join(marketplaceRoot, "plugins", product),
        cacheRoot,
        COMPARED_FILES[product],
        product,
      );

      stage = `compare-installed-tree:${product}`;
      const sourceFingerprint = await treeFingerprint(path.join(marketplaceRoot, "plugins", product));
      const cacheFingerprint = await treeFingerprint(cacheRoot);
      if (sourceFingerprint !== cacheFingerprint) {
        throw new DiagnosticError(`${product} tree differs between source and install cache`);
      }

      productSources.set(product, [path.join(marketplaceRoot, "plugins", product), cacheRoot]);
      products.push({ product, version, compared, fingerprint: sourceFingerprint });
    }

    stage = "plugin-remove:game-design-studio";
    await runImpl(codex, ["plugin", "remove", `game-design-studio@${MARKETPLACE}`, "--json"], { cwd: workspace, env, json: true });
    stage = "plugin-list:career-survives-studio-removal";
    const studioRemoved = await runImpl(codex, ["plugin", "list", "--json"], { cwd: workspace, env, json: true });
    assertNoReplacementCharacter(JSON.stringify(studioRemoved), "plugin list after Studio removal");
    if (pluginIsListed(studioRemoved, "game-design-studio")) {
      throw new DiagnosticError("game-design-studio remains listed after its removal");
    }
    if (!pluginIsListed(studioRemoved, "game-design-career")) {
      throw new DiagnosticError("game-design-career did not survive game-design-studio removal");
    }

    stage = "plugin-readd:game-design-studio";
    await runImpl(codex, ["plugin", "add", `game-design-studio@${MARKETPLACE}`, "--json"], { cwd: workspace, env, json: true });
    const studioReadded = await runImpl(codex, ["plugin", "list", "--json"], { cwd: workspace, env, json: true });
    if (!pluginIsListed(studioReadded, "game-design-studio") || !pluginIsListed(studioReadded, "game-design-career")) {
      throw new DiagnosticError("both products are not listed after game-design-studio re-add");
    }

    for (const product of PRODUCTS) {
      stage = `plugin-remove:${product}:final`;
      await runImpl(codex, ["plugin", "remove", `${product}@${MARKETPLACE}`, "--json"], { cwd: workspace, env, json: true });
    }
    stage = "marketplace-remove";
    await runImpl(codex, ["plugin", "marketplace", "remove", MARKETPLACE, "--json"], { cwd: workspace, env, json: true });
    stage = "plugin-list:final";
    const finalPlugins = await runImpl(codex, ["plugin", "list", "--json"], { cwd: workspace, env, json: true });
    assertNoReplacementCharacter(JSON.stringify(finalPlugins), "final plugin list");
    if (PRODUCTS.some((product) => pluginIsListed(finalPlugins, product))) {
      throw new DiagnosticError("a removed product remains in the final plugin list");
    }
    stage = "marketplace-list:final";
    const finalMarketplaces = await runImpl(codex, ["plugin", "marketplace", "list", "--json"], { cwd: workspace, env, json: true });
    assertNoReplacementCharacter(JSON.stringify(finalMarketplaces), "final marketplace list");
    if (marketplaceIsListed(finalMarketplaces)) throw new DiagnosticError("marketplace remains in the final marketplace list");
    stage = "state-cleanup:final";
    await assertNoProductStateResidue(env.CODEX_HOME, productSources);

    stage = "workspace-fingerprint-after";
    if (await treeFingerprint(workspace) !== workspaceBefore) {
      throw new DiagnosticError("the workspace changed across install and reinstall");
    }
    status = "PASS";
  } catch (error) {
    failure = {
      code: "install-roundtrip-failed",
      stage,
      message: redactInstallFailure(error),
    };
  } finally {
    try {
      await cleanupGuardedTempRoot(registration);
      temporaryStateCleanup = true;
    } catch {
      status = "INCOMPLETE";
      failure ??= { code: "temporary-cleanup-failed", message: "temporary state could not be removed" };
    }
  }

  const productionStateUnchanged = (await productionFingerprint()) === before;
  if (!productionStateUnchanged) {
    status = "INCOMPLETE";
    failure = { code: "production-state-changed", message: "the real Codex home changed during the round trip" };
  }
  return { status, products, productionStateUnchanged, temporaryStateCleanup, failure };
}

async function main() {
  const usage = "Usage: node tooling/install-roundtrip.mjs [--require-codex] [--codex <path>] [--temp-parent <directory>]";
  const args = process.argv.slice(2);
  let requireCodex = false;
  let tempParent = tmpdir();
  let codexPath = null;
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--require-codex") {
      requireCodex = true;
    } else if (args[index] === "--temp-parent" && args[index + 1] !== undefined) {
      tempParent = args[index + 1];
      index += 1;
    } else if (args[index] === "--codex" && args[index + 1] !== undefined) {
      codexPath = path.resolve(args[index + 1]);
      index += 1;
    } else {
      throw new PreconditionError(usage);
    }
  }
  const result = await runInstallRoundtrip({ requireCodex, tempParent, codexPath });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (result.status === "INCOMPLETE") process.exitCode = 1;
}

const entry = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (entry && pathToFileURL(entry).href === import.meta.url) {
  main().catch((error) => {
    const message = error instanceof PreconditionError
      ? error.message
      : redactInstallFailure(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
