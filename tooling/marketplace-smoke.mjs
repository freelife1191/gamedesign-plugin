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

const MARKETPLACE = "game-design-suite";
const PRODUCTS = Object.freeze([
  { name: "game-design-career", skillName: "orchestrate-game-design-career", skill: "$game-design-career:orchestrate-game-design-career" },
  { name: "game-design-studio", skillName: "orchestrate-game-design-project", skill: "$game-design-studio:orchestrate-game-design-project" },
]);
const SKILL_PROVER = `import { createHash } from "node:crypto";
import { lstat, readFile, realpath } from "node:fs/promises";
if (process.argv.length !== 3) throw new Error("Usage: prove-installed-skill.mjs <SKILL.md>");
const target = process.argv[2];
const stats = await lstat(target);
if (!stats.isFile() || stats.isSymbolicLink()) throw new Error("SKILL.md must be a regular file");
await realpath(target);
const sha256 = createHash("sha256").update(await readFile(target)).digest("hex");
process.stdout.write(JSON.stringify({ ok: true, sha256 }) + "\\n");
`;

function safeJson(source, label) {
  try {
    return JSON.parse(source);
  } catch {
    throw new Error(`${label} returned invalid JSON`);
  }
}

function isExactCommandPath(command, target) {
  const escaped = target.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return new RegExp(`(?:^|[\\s'\"])${escaped}(?=$|[\\s'\"])`, "u").test(command);
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

async function isCanonicalDirectory(target) {
  const [stats, canonical] = await Promise.all([lstat(target).catch(() => null), realpath(target).catch(() => null)]);
  return Boolean(stats?.isDirectory() && !stats.isSymbolicLink() && canonical);
}

function jsonObjectStream(source) {
  const outputs = [];
  const text = String(source ?? "");
  let cursor = 0;
  while (cursor < text.length) {
    while (/\s/u.test(text[cursor] ?? "")) cursor += 1;
    if (cursor >= text.length) break;
    if (text[cursor] !== "{") return null;
    const start = cursor;
    let depth = 0;
    let quoted = false;
    let escaped = false;
    for (; cursor < text.length; cursor += 1) {
      const character = text[cursor];
      if (quoted) {
        if (escaped) escaped = false;
        else if (character === "\\") escaped = true;
        else if (character === '"') quoted = false;
      } else if (character === '"') quoted = true;
      else if (character === "{") depth += 1;
      else if (character === "}" && --depth === 0) {
        try {
          const parsed = safeJson(text.slice(start, cursor + 1), "command trace");
          if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
          outputs.push(parsed);
        } catch { return null; }
        cursor += 1;
        break;
      }
    }
    if (depth !== 0 || quoted) return null;
  }
  return outputs;
}

function isSkillProofOutput(output, expectedSha256) {
  return JSON.stringify(Object.keys(output).sort()) === '["ok","sha256"]'
    && output.ok === true && output.sha256 === expectedSha256;
}

function isValidatorOutput(output) {
  return JSON.stringify(Object.keys(output).sort()) === '["errors","files","ok","requestedFormats","warnings"]'
    && output.ok === true && Array.isArray(output.errors) && output.errors.length === 0
    && Array.isArray(output.warnings) && Array.isArray(output.files)
    && JSON.stringify(output.requestedFormats) === '["md"]';
}

export async function parseExecJsonl(source, { cacheRoot, proofPath, skillPath, skillSha256, validatorPath: expectedValidator, artifactPath }) {
  const events = source.split(/\r?\n/u).filter(Boolean).map((line) => safeJson(line, "codex exec"));
  if (events.some((event) => event.type === "turn.failed" || event.type === "error"
      || /(?:401|unauthorized)/iu.test(JSON.stringify(event)))) {
    throw new Error("codex exec incomplete: failure event");
  }
  if (!events.some((event) => event.type === "turn.completed")) throw new Error("codex exec incomplete: no completed turn");
  if (!await isCanonicalRegularFile(proofPath, path.dirname(artifactPath))
      || !await isCanonicalRegularFile(skillPath, cacheRoot)
      || !await isCanonicalRegularFile(expectedValidator, cacheRoot)
      || !await isCanonicalDirectory(artifactPath)) {
    throw new Error("codex exec unverifiable: installed skill or canonical paths");
  }
  const digestCandidates = events.filter((event) => event.type === "item.completed" && event.item?.type === "command_execution")
    .map(({ item }) => {
      const outputs = jsonObjectStream(item.aggregated_output);
      return {
        success: item.status === "completed" && item.exit_code === 0,
        path: typeof item.command === "string" && isExactCommandPath(item.command, skillPath),
        operation: typeof item.command === "string" && isExactCommandPath(item.command, proofPath),
        output: outputs?.some((parsed) => isSkillProofOutput(parsed, skillSha256)) === true,
        outputs,
      };
    });
  const proofMatches = digestCandidates.filter((candidate) => candidate.success && candidate.path && candidate.operation)
    .flatMap((candidate) => candidate.outputs ?? []).filter((output) => isSkillProofOutput(output, skillSha256));
  const installedSkillDigest = proofMatches.length === 1;
  const validatorCandidates = events.filter((event) => event.type === "item.completed" && event.item?.type === "command_execution")
    .map(({ item }) => {
      const outputs = jsonObjectStream(item.aggregated_output);
      return {
        success: item.status === "completed" && item.exit_code === 0,
        path: typeof item.command === "string" && isExactCommandPath(item.command, expectedValidator),
        artifact: typeof item.command === "string" && isExactCommandPath(item.command, artifactPath),
        output: outputs?.some(isValidatorOutput) === true,
        outputs,
      };
    });
  const validatorMatches = validatorCandidates.filter((candidate) => candidate.success && candidate.path && candidate.artifact)
    .flatMap((candidate) => candidate.outputs ?? []).filter(isValidatorOutput);
  const artifactValidatorTrace = validatorMatches.length === 1;
  if (!installedSkillDigest || !artifactValidatorTrace) {
    const seen = (key) => digestCandidates.some((candidate) => candidate[key]);
    const validatorSeen = (key) => validatorCandidates.some((candidate) => candidate[key]);
    throw new Error(`codex exec unverifiable: digest=${installedSkillDigest ? 1 : 0}(s=${seen("success") ? 1 : 0},p=${seen("path") ? 1 : 0},o=${seen("operation") ? 1 : 0},h=${seen("output") ? 1 : 0}),validator=${artifactValidatorTrace ? 1 : 0}(s=${validatorSeen("success") ? 1 : 0},p=${validatorSeen("path") ? 1 : 0},a=${validatorSeen("artifact") ? 1 : 0},o=${validatorSeen("output") ? 1 : 0})`);
  }
  return { completed: true, installedSkillDigest: true, artifactValidatorTrace: true };
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
  let sanitized = source;
  for (const key of ["OPENAI_API_KEY", "CODEX_API_KEY"]) {
    const value = environment[key];
    if (typeof value === "string" && value.length > 0) sanitized = sanitized.replaceAll(value, "[REDACTED]");
  }
  return sanitized.length <= 240 && !/(?:api[_-]?key|bearer|token)/iu.test(sanitized) ? sanitized : "command failed (details redacted)";
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
      const proofPath = path.join(workspace, "prove-installed-skill.mjs");
      await writeFile(proofPath, SKILL_PROVER, { mode: 0o700 });
      const skillPath = path.join(cacheRoot, "skills", product.skillName, "SKILL.md");
      const packageValidator = path.join(cacheRoot, "scripts/validate-artifact.mjs");
      const skillSha256 = sha256(await readFile(skillPath));
      const skillDigestCommand = `node ${JSON.stringify(proofPath)} ${JSON.stringify(skillPath)}`;
      const artifactValidatorCommand = `node ${JSON.stringify(packageValidator)} ${JSON.stringify(artifactPath)} md`;
      const prompt = [
        `명시적으로 설치된 스킬 ${product.skill} 을 호출하세요.`,
        `한 번의 짧은 작업으로 canonical game-design MD artifact를 ${artifactPath} 에 생성하세요.`,
        "필수 파일과 디렉터리를 만든 뒤 아래 두 명령을 쉘에서 정확히 한 번씩 실행하세요.",
        `1. ${skillDigestCommand}`,
        `2. ${artifactValidatorCommand}`,
        "두 명령 모두 성공한 뒤 짧게 완료만 보고하세요.",
      ].join("\n");
      const jsonl = run(codex, ["exec", "--ephemeral", "--json", "--sandbox", "workspace-write", "--skip-git-repo-check", "-C", workspace, prompt], {
        cwd: workspace,
        env,
        timeout: 180000,
      });
      await parseExecJsonl(jsonl, { cacheRoot, proofPath, skillPath, skillSha256, validatorPath: packageValidator, artifactPath });
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
