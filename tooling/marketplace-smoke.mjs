#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { constants } from "node:fs";
import { access, chmod, copyFile, lstat, mkdir, readFile, readdir, realpath, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

import { cleanupGuardedTempRoot, createGuardedTempRoot } from "./lib/guarded-temp.mjs";
import { sha256 } from "./lib/hash.mjs";
import { artifactTreeIdentity } from "./lib/marketplace-proof-harness.mjs";

const MARKETPLACE = "game-design-suite";
const PRODUCTS = Object.freeze([
  { name: "game-design-career", skillName: "orchestrate-game-design-career", skill: "$game-design-career:orchestrate-game-design-career" },
  { name: "game-design-studio", skillName: "orchestrate-game-design-project", skill: "$game-design-studio:orchestrate-game-design-project" },
]);
export const PROOF_HARNESS_PATH = fileURLToPath(new URL("./lib/marketplace-proof-harness.mjs", import.meta.url));
const TOOLING_ROOT = fileURLToPath(new URL(".", import.meta.url));

function safeJson(source, label) {
  try {
    return JSON.parse(source);
  } catch {
    throw new Error(`${label} returned invalid JSON`);
  }
}

function shellQuote(value) {
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}

export function buildProofCommand(nodePath, proofPath, ...args) {
  return [nodePath, proofPath, ...args].map(shellQuote).join(" ");
}

function simpleShellWords(source) {
  if (typeof source !== "string" || /[\u0000\r\n]/u.test(source)) return null;
  const words = [];
  let word = "";
  let started = false;
  let quote = null;
  let escaped = false;
  for (const character of source) {
    if (escaped) {
      word += character;
      started = true;
      escaped = false;
    } else if (quote === "'") {
      if (character === "'") quote = null;
      else word += character;
    } else if (quote === '"') {
      if (character === '"') quote = null;
      else if (character === "\\") escaped = true;
      else if (character === "$" || character === "`") return null;
      else word += character;
    } else if (character === "'" || character === '"') {
      quote = character;
      started = true;
    } else if (character === "\\") {
      escaped = true;
      started = true;
    } else if (/\s/u.test(character)) {
      if (started) words.push(word);
      word = "";
      started = false;
    } else if (/[;|&<>$`]/u.test(character)) return null;
    else {
      word += character;
      started = true;
    }
  }
  if (quote || escaped) return null;
  if (started) words.push(word);
  return words;
}

async function isExactProofCommand(command, expected, trustedShellPaths) {
  const expectedWords = simpleShellWords(expected);
  const outer = simpleShellWords(command);
  if (!expectedWords || !outer) return false;
  if (JSON.stringify(outer) === JSON.stringify(expectedWords)) return true;
  if (outer.length !== 3 || outer[1] !== "-lc") return false;
  const shell = await realpath(outer[0]).catch(() => null);
  if (!shell || !trustedShellPaths.includes(shell)) return false;
  const inner = simpleShellWords(outer[2]);
  return inner !== null && JSON.stringify(inner) === JSON.stringify(expectedWords);
}

export async function captureFileIdentity(target) {
  const before = await lstat(target);
  if (!before.isFile() || before.isSymbolicLink()) throw new Error("proof identity requires a regular file");
  const digest = sha256(await readFile(target));
  const after = await lstat(target);
  if (before.dev !== after.dev || before.ino !== after.ino || before.mode !== after.mode) throw new Error("proof identity changed during capture");
  return { dev: after.dev, ino: after.ino, mode: after.mode, sha256: digest };
}

async function identityMatches(target, expected) {
  try {
    const actual = await captureFileIdentity(target);
    return ["dev", "ino", "mode", "sha256"].every((key) => actual[key] === expected?.[key]);
  } catch { return false; }
}

async function isCanonicalRegularFile(target, root) {
  const [stats, canonicalTarget, canonicalRoot] = await Promise.all([
    lstat(target).catch(() => null),
    realpath(target).catch(() => null),
    realpath(root).catch(() => null),
  ]);
  if (!stats?.isFile() || stats.isSymbolicLink() || !canonicalTarget || !canonicalRoot) return false;
  const relative = path.relative(canonicalRoot, canonicalTarget);
  return relative !== "" && !relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative);
}

async function isCanonicalDirectory(target, root) {
  const [stats, canonical, canonicalRoot] = await Promise.all([
    lstat(target).catch(() => null), realpath(target).catch(() => null), realpath(root).catch(() => null),
  ]);
  if (!stats?.isDirectory() || stats.isSymbolicLink() || !canonical || !canonicalRoot) return false;
  const relative = path.relative(canonicalRoot, canonical);
  return relative !== "" && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

export async function parseExecJsonl(source, {
  cacheRoot, workspaceRoot, proofIdentity, trustedShellPaths = [], nodePath = process.execPath,
  skillPath, skillSha256, validatorPath: expectedValidator, validatorSha256, artifactPath,
}) {
  const events = source.split(/\r?\n/u).filter(Boolean).map((line) => safeJson(line, "codex exec"));
  if (events.some((event) => event.type === "turn.failed" || event.type === "error"
      || /(?:401|unauthorized)/iu.test(JSON.stringify(event)))) {
    throw new Error("codex exec incomplete: failure event");
  }
  if (!events.some((event) => event.type === "turn.completed")) throw new Error("codex exec incomplete: no completed turn");
  if (!await isCanonicalRegularFile(PROOF_HARNESS_PATH, TOOLING_ROOT)
      || !await isCanonicalRegularFile(skillPath, cacheRoot)
      || !await isCanonicalRegularFile(expectedValidator, cacheRoot)
      || !await isCanonicalDirectory(artifactPath, workspaceRoot)
      || !await identityMatches(PROOF_HARNESS_PATH, proofIdentity)
      || sha256(await readFile(skillPath)) !== skillSha256
      || sha256(await readFile(expectedValidator)) !== validatorSha256) {
    throw new Error("codex exec unverifiable: installed skill or canonical paths");
  }
  const proofArgs = [cacheRoot, workspaceRoot, skillPath, skillSha256, expectedValidator, validatorSha256, artifactPath];
  const expectedCommand = buildProofCommand(nodePath, PROOF_HARNESS_PATH, ...proofArgs);
  const matches = [];
  for (const event of events) {
    if (event.type === "item.completed" && event.item?.type === "command_execution"
        && event.item.status === "completed" && event.item.exit_code === 0
        && await isExactProofCommand(event.item.command, expectedCommand, trustedShellPaths)) matches.push(event);
  }
  if (matches.length !== 1) throw new Error("codex exec unverifiable: exact proof command missing");
  let receipt;
  try { receipt = safeJson(String(matches[0].item.aggregated_output ?? "").trim(), "proof harness"); }
  catch { throw new Error("codex exec unverifiable: proof receipt malformed"); }
  assertExactKeys(receipt, ["schemaVersion", "ok", "skillSha256", "validatorSha256", "artifactSha256", "requestedFormats"], "proof receipt");
  const artifactIdentity = await artifactTreeIdentity(artifactPath).catch(() => null);
  if (receipt.schemaVersion !== 1 || receipt.ok !== true || receipt.skillSha256 !== skillSha256
      || receipt.validatorSha256 !== validatorSha256 || receipt.artifactSha256 !== artifactIdentity?.sha256
      || JSON.stringify(receipt.requestedFormats) !== '["md"]') {
    throw new Error("codex exec unverifiable: proof receipt mismatch");
  }
  return { completed: true, proofHarness: true };
}

function assertExactKeys(value, keys, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)
      || JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...keys].sort())) {
    throw new Error(`${label} contract mismatch`);
  }
}

function mismatch(kind) {
  throw new Error(`${kind} contract mismatch`);
}

export function validateCliJson(kind, payload, { repoRoot, productName, cacheRoot }) {
  const pluginId = `${productName}@${MARKETPLACE}`;
  try {
    if (kind === "marketplaceAdd") {
      assertExactKeys(payload, ["marketplaceName", "installedRoot", "alreadyAdded"], kind);
      if (payload.marketplaceName !== MARKETPLACE || payload.installedRoot !== repoRoot || payload.alreadyAdded !== false) mismatch(kind);
    } else if (kind === "pluginAdd") {
      assertExactKeys(payload, ["pluginId", "name", "marketplaceName", "version", "installedPath", "authPolicy"], kind);
      if (payload.pluginId !== pluginId || payload.name !== productName || payload.marketplaceName !== MARKETPLACE
          || payload.version !== "0.1.0" || payload.installedPath !== cacheRoot || payload.authPolicy !== "ON_USE") mismatch(kind);
    } else if (kind === "pluginList") {
      assertExactKeys(payload, ["installed", "available"], kind);
      if (!Array.isArray(payload.installed) || payload.installed.length !== 1 || !Array.isArray(payload.available) || payload.available.length !== 0) mismatch(kind);
      const plugin = payload.installed[0];
      assertExactKeys(plugin, ["pluginId", "name", "marketplaceName", "version", "installed", "enabled", "source", "marketplaceSource", "installPolicy", "authPolicy"], kind);
      assertExactKeys(plugin.source, ["source", "path"], kind);
      assertExactKeys(plugin.marketplaceSource, ["sourceType", "source"], kind);
      if (plugin.pluginId !== pluginId || plugin.name !== productName || plugin.marketplaceName !== MARKETPLACE
          || plugin.version !== "0.1.0" || plugin.installed !== true || plugin.enabled !== true
          || plugin.source.source !== "local" || plugin.source.path !== path.join(repoRoot, "plugins", productName)
          || plugin.marketplaceSource.sourceType !== "local" || plugin.marketplaceSource.source !== repoRoot
          || plugin.installPolicy !== "AVAILABLE" || plugin.authPolicy !== "ON_USE") mismatch(kind);
    } else if (kind === "pluginRemove") {
      assertExactKeys(payload, ["pluginId", "name", "marketplaceName"], kind);
      if (payload.pluginId !== pluginId || payload.name !== productName || payload.marketplaceName !== MARKETPLACE) mismatch(kind);
    } else if (kind === "marketplaceRemove") {
      assertExactKeys(payload, ["marketplaceName", "installedRoot"], kind);
      if (payload.marketplaceName !== MARKETPLACE || payload.installedRoot !== null) mismatch(kind);
    } else if (kind === "marketplaceList") {
      assertExactKeys(payload, ["marketplaces"], kind);
      if (!Array.isArray(payload.marketplaces) || payload.marketplaces.length !== 0) mismatch(kind);
    } else mismatch(kind);
  } catch (error) {
    if (error instanceof Error && /contract mismatch/u.test(error.message)) throw error;
    mismatch(kind);
  }
  return payload;
}

export function redactFailure(message, environment = process.env) {
  const source = String(message);
  if (/(?:401|unauthorized)/iu.test(source)) return "authentication failed (401)";
  if (/turn\.failed/iu.test(source)) return "codex turn failed";
  const credentialPattern = /(?:auth\.json|credentials?\.json|api[_-]?key|bearer|token|authorization\s*:?\s*(?:basic|bearer)|(?:client[_-]?)?secret\s*=|password\s*=)/iu;
  let decoded = source;
  try { decoded = decodeURIComponent(source); } catch {}
  if (credentialPattern.test(source) || credentialPattern.test(decoded)) {
    return "command failed (details redacted)";
  }
  let sanitized = decoded;
  for (const key of ["OPENAI_API_KEY", "CODEX_API_KEY"]) {
    const value = environment[key];
    if (typeof value === "string" && value.length > 0) sanitized = sanitized.replaceAll(value, "[REDACTED]");
  }
  const knownRoots = [
    [environment.CODEX_HOME, "[CODEX_HOME]"],
    [environment.HOME, "[HOME]"],
    [homedir(), "[HOME]"],
  ].filter(([value]) => typeof value === "string" && value.length > 1)
    .sort(([left], [right]) => right.length - left.length);
  for (const [root, placeholder] of knownRoots) sanitized = sanitized.replaceAll(root, placeholder);
  sanitized = sanitized
    .replace(/(^|[\s=:('"`\[])file:\/\/[^;\n\r,)\]}]*/giu, "$1[ABSOLUTE_PATH]")
    .replace(/(^|[\s=:('"`\[])(?:\\\\|\/\/)[^;\n\r,)\]}]*/gu, "$1[ABSOLUTE_PATH]")
    .replace(/(^|[\s=:('"`\[])\/[^;\n\r,)\]}]*/gu, "$1[ABSOLUTE_PATH]")
    .replace(/(^|[\s=:('"`\[])[A-Za-z]:\\[^;\n\r,)\]}]*/gu, "$1[ABSOLUTE_PATH]");
  return sanitized.length <= 240 && !credentialPattern.test(sanitized) ? sanitized : "command failed (details redacted)";
}

export async function bridgeLocalAuth({ source, destination }) {
  const before = await lstat(source);
  if (!before.isFile() || before.isSymbolicLink()) throw new Error("local session auth source is not a regular file");
  const sourceIdentity = { dev: before.dev, ino: before.ino, mode: before.mode };
  await mkdir(path.dirname(destination), { recursive: true });
  await copyFile(source, destination, constants.COPYFILE_EXCL);
  await chmod(destination, 0o600);
  const [afterSource, copied] = await Promise.all([lstat(source), lstat(destination)]);
  if (afterSource.dev !== sourceIdentity.dev || afterSource.ino !== sourceIdentity.ino || afterSource.mode !== sourceIdentity.mode) {
    throw new Error("local session auth source identity changed");
  }
  if (!copied.isFile() || copied.isSymbolicLink() || (copied.mode & 0o777) !== 0o600) {
    throw new Error("temporary session auth is not a regular 0600 file");
  }
  return { authSource: "local-session" };
}

async function findExecutable(name) {
  const extensions = process.platform === "win32" ? (process.env.PATHEXT ?? ".EXE;.CMD;.BAT").split(";") : [""];
  for (const directory of (process.env.PATH ?? "").split(path.delimiter).filter(Boolean)) {
    for (const extension of extensions) {
      const candidate = path.join(directory, `${name}${extension}`);
      const stats = await lstat(candidate).catch(() => null);
      if (!stats?.isFile() && !stats?.isSymbolicLink()) continue;
      const canonical = await realpath(candidate).catch(() => null);
      if (!canonical || !(await lstat(canonical)).isFile()) continue;
      try {
        await access(canonical, constants.X_OK);
        return canonical;
      } catch {}
    }
  }
  throw new Error(`${name} executable unavailable`);
}

async function findTrustedShells() {
  const trusted = new Set();
  for (const candidate of ["/bin/sh", "/bin/bash", "/bin/zsh"]) {
    const canonical = await realpath(candidate).catch(() => null);
    const stats = canonical ? await lstat(canonical).catch(() => null) : null;
    if (!canonical || !stats?.isFile()) continue;
    try {
      await access(canonical, constants.X_OK);
      trusted.add(canonical);
    } catch {}
  }
  return [...trusted];
}

async function validatorPath() {
  const homes = [process.env.CODEX_HOME, path.join(homedir(), ".codex")].filter(Boolean);
  for (const home of homes) {
    const candidate = path.resolve(home, "skills/.system/plugin-creator/scripts/validate_plugin.py");
    const stats = await lstat(candidate).catch(() => null);
    if (stats?.isFile() && !stats.isSymbolicLink()) return realpath(candidate);
  }
  throw new Error("official plugin validator unavailable");
}

async function fingerprintProductionState() {
  const realHome = process.env.CODEX_HOME ? path.resolve(process.env.CODEX_HOME) : path.join(homedir(), ".codex");
  const targets = ["config.toml", "plugins/installed.json", "plugins/marketplaces.json"];
  const state = {};
  for (const relative of targets) {
    const target = path.join(realHome, relative);
    const stats = await lstat(target).catch(() => null);
    state[relative] = stats?.isFile() && !stats.isSymbolicLink() ? sha256(await readFile(target)) : null;
  }
  return state;
}

function run(command, args, { cwd, env, input, timeout = 30000, json = false }) {
  const result = spawnSync(command, args, { cwd, env, input, timeout, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
  if (result.error) throw new Error(`command failed to start: ${result.error.message}`);
  if (result.signal) throw new Error(`command terminated by ${result.signal}`);
  if (result.status !== 0) throw new Error(`command exited ${result.status}: ${result.stderr || result.stdout}`);
  return json ? safeJson(result.stdout, args.join(" ")) : result.stdout;
}

async function countSkills(cacheRoot) {
  const entries = await readdir(path.join(cacheRoot, "skills"), { withFileTypes: true });
  let count = 0;
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if ((await lstat(path.join(cacheRoot, "skills", entry.name, "SKILL.md"))).isFile()) count += 1;
  }
  return count;
}

function isolatedEnvironment(registration) {
  const env = {
    HOME: path.join(registration.root, "home"),
    CODEX_HOME: path.join(registration.root, "codex-home"),
    TMPDIR: path.join(registration.root, "tmp"),
    PATH: process.env.PATH ?? "",
  };
  if (process.env.OPENAI_API_KEY) env.OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  return env;
}

export async function runMarketplaceSmoke({
  repoRoot = fileURLToPath(new URL("..", import.meta.url)),
  tempParent = tmpdir(),
} = {}) {
  const before = await fingerprintProductionState();
  const registration = await createGuardedTempRoot({ parent: tempParent, prefix: "game-design-marketplace-" });
  const env = isolatedEnvironment(registration);
  const isolatedValidator = path.join(registration.root, "official-validate-plugin.py");
  const results = [];
  let status = "INCOMPLETE";
  let failure = null;
  let authSource = process.env.OPENAI_API_KEY ? "api-key-env" : "unavailable";
  let temporaryStateCleanup = false;
  let productionStateUnchanged = false;
  try {
    await Promise.all([env.HOME, env.CODEX_HOME, env.TMPDIR].map((directory) => mkdir(directory, { recursive: true })));
    const realCodexHome = process.env.CODEX_HOME ? path.resolve(process.env.CODEX_HOME) : path.join(homedir(), ".codex");
    const localAuth = path.join(realCodexHome, "auth.json");
    const localAuthStats = await lstat(localAuth).catch(() => null);
    if (localAuthStats?.isFile() && !localAuthStats.isSymbolicLink()) {
      ({ authSource } = await bridgeLocalAuth({ source: localAuth, destination: path.join(env.CODEX_HOME, "auth.json") }));
      delete env.OPENAI_API_KEY;
    }
    const codex = await findExecutable("codex");
    const python = await findExecutable("python3");
    const trustedShellPaths = await findTrustedShells();
    const proofIdentity = await captureFileIdentity(PROOF_HARNESS_PATH);
    await writeFile(isolatedValidator, await readFile(await validatorPath()));
    const canonicalRepoRoot = path.resolve(repoRoot);
    const marketplace = run(codex, ["plugin", "marketplace", "add", canonicalRepoRoot, "--json"], { cwd: repoRoot, env, json: true });
    validateCliJson("marketplaceAdd", marketplace, { repoRoot: canonicalRepoRoot });

    for (const product of PRODUCTS) {
      const added = run(codex, ["plugin", "add", `${product.name}@${MARKETPLACE}`, "--json"], { cwd: repoRoot, env, json: true });
      const cacheRoot = path.join(env.CODEX_HOME, "plugins/cache", MARKETPLACE, product.name, "0.1.0");
      const cliContext = { repoRoot: canonicalRepoRoot, productName: product.name, cacheRoot };
      validateCliJson("pluginAdd", added, cliContext);
      if (await realpath(cacheRoot) !== cacheRoot || await countSkills(cacheRoot) !== 11) throw new Error(`${product.name} cache mismatch`);
      run(python, [isolatedValidator, cacheRoot], { cwd: registration.root, env });
      validateCliJson("pluginList", run(codex, ["plugin", "list", "--json"], { cwd: repoRoot, env, json: true }), cliContext);

      const workspace = path.join(registration.root, `workspace-${product.name}`);
      await mkdir(workspace);
      const artifactPath = path.join(workspace, `${product.name}-artifact`);
      const skillPath = path.join(cacheRoot, "skills", product.skillName, "SKILL.md");
      const packageValidator = path.join(cacheRoot, "scripts/validate-artifact.mjs");
      const skillSha256 = sha256(await readFile(skillPath));
      const validatorSha256 = sha256(await readFile(packageValidator));
      const proofCommand = buildProofCommand(
        process.execPath,
        PROOF_HARNESS_PATH,
        cacheRoot,
        workspace,
        skillPath,
        skillSha256,
        packageValidator,
        validatorSha256,
        artifactPath,
      );
      const prompt = [
        `명시적으로 설치된 스킬 ${product.skill} 을 호출하세요.`,
        `한 번의 짧은 작업으로 canonical game-design MD artifact를 ${artifactPath} 에 생성하세요.`,
        "필수 파일과 디렉터리를 모두 만든 뒤 아래 명령 하나만 정확히 한 번 실행하세요.",
        proofCommand,
        "이 명령을 다른 명령과 연결하거나 리다이렉션하거나 인수를 변경하지 마세요.",
        "명령이 성공한 뒤 짧게 완료만 보고하세요.",
      ].join("\n");
      const jsonl = run(codex, ["exec", "--ephemeral", "--json", "--sandbox", "workspace-write", "--skip-git-repo-check", "-C", workspace, prompt], {
        cwd: workspace,
        env,
        timeout: 180000,
      });
      await parseExecJsonl(jsonl, {
        cacheRoot,
        workspaceRoot: workspace,
        proofIdentity,
        trustedShellPaths,
        nodePath: process.execPath,
        skillPath,
        skillSha256,
        validatorPath: packageValidator,
        validatorSha256,
        artifactPath,
      });
      const artifactStats = await lstat(artifactPath).catch(() => null);
      if (!artifactStats?.isDirectory() || artifactStats.isSymbolicLink()) throw new Error(`${product.name} artifact missing`);
      const validation = safeJson(run(process.execPath, [packageValidator, artifactPath, "md"], {
        cwd: workspace,
        env,
      }), `${product.name} artifact validator`);
      if (validation.ok !== true || JSON.stringify(validation.requestedFormats) !== '["md"]') throw new Error(`${product.name} artifact validation failed`);
      results.push({ product: product.name, pluginId: added.pluginId, skill: product.skill, skills: 11, artifact: "validated-md", exec: "completed" });
      const removedPlugin = run(codex, ["plugin", "remove", `${product.name}@${MARKETPLACE}`, "--json"], { cwd: repoRoot, env, json: true });
      validateCliJson("pluginRemove", removedPlugin, cliContext);
      if (await lstat(cacheRoot).catch(() => null)) throw new Error(`${product.name} removal mismatch`);
    }
    const removed = run(codex, ["plugin", "marketplace", "remove", MARKETPLACE, "--json"], { cwd: repoRoot, env, json: true });
    validateCliJson("marketplaceRemove", removed, { repoRoot: canonicalRepoRoot });
    const finalList = run(codex, ["plugin", "marketplace", "list", "--json"], { cwd: repoRoot, env, json: true });
    validateCliJson("marketplaceList", finalList, { repoRoot: canonicalRepoRoot });
    status = "PASS";
  } catch (error) {
    failure = redactFailure(error instanceof Error ? error.message : String(error), env);
  } finally {
    const after = await fingerprintProductionState();
    productionStateUnchanged = JSON.stringify(after) === JSON.stringify(before);
    if (!productionStateUnchanged) {
      status = "INCOMPLETE";
      failure = "production Codex state changed";
    }
    try {
      await cleanupGuardedTempRoot(registration);
      temporaryStateCleanup = true;
    } catch (error) {
      status = "INCOMPLETE";
      failure = error instanceof Error ? error.message : String(error);
    }
  }
  return { status, marketplace: MARKETPLACE, products: results, authSource, productionStateUnchanged, temporaryStateCleanup, failure };
}

async function main() {
  let tempParent = tmpdir();
  const args = process.argv.slice(2);
  if (args.length === 2 && args[0] === "--temp-parent") tempParent = args[1];
  else if (args.length !== 0) throw new Error("Usage: node tooling/marketplace-smoke.mjs [--temp-parent <directory>]");
  const result = await runMarketplaceSmoke({ tempParent });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (result.status !== "PASS") process.exitCode = 1;
}

const entry = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (entry && pathToFileURL(entry).href === import.meta.url) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
