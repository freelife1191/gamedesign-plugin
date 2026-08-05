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
  { name: "game-design-career", skill: "$game-design-career:orchestrate-game-design-career" },
  { name: "game-design-studio", skill: "$game-design-studio:orchestrate-game-design-project" },
]);

function safeJson(source, label) {
  try {
    return JSON.parse(source);
  } catch {
    throw new Error(`${label} returned invalid JSON`);
  }
}

export function parseExecJsonl(source, { skillInvocation, artifactPath }) {
  const events = source.split(/\r?\n/u).filter(Boolean).map((line) => safeJson(line, "codex exec"));
  if (events.some((event) => event.type === "turn.failed" || event.type === "error"
      || /(?:401|unauthorized)/iu.test(JSON.stringify(event)))) {
    throw new Error("codex exec incomplete: failure event");
  }
  if (!events.some((event) => event.type === "turn.completed")) throw new Error("codex exec incomplete: no completed turn");
  const messages = events.filter((event) => event.type === "item.completed" && event.item?.type === "agent_message")
    .map((event) => event.item.text).filter((text) => typeof text === "string").join("\n");
  const provenance = messages.includes(`SKILL_PROVENANCE=${skillInvocation}`);
  const artifactPathReported = messages.includes(`ARTIFACT_PATH=${artifactPath}`);
  if (!provenance || !artifactPathReported) throw new Error("codex exec incomplete: missing skill provenance or artifact path");
  return { completed: true, provenance, artifactPathReported };
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

function assertInstalledList(payload, productName) {
  if (!payload || !Array.isArray(payload.installed) || payload.installed.length !== 1 || payload.available?.length !== 0) {
    throw new Error(`${productName} list contract mismatch`);
  }
  const plugin = payload.installed[0];
  if (plugin.pluginId !== `${productName}@${MARKETPLACE}` || plugin.name !== productName
      || plugin.marketplaceName !== MARKETPLACE || plugin.version !== "0.1.0"
      || plugin.installed !== true || plugin.enabled !== true) {
    throw new Error(`${productName} installed JSON mismatch`);
  }
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
    const marketplace = run(codex, ["plugin", "marketplace", "add", path.resolve(repoRoot), "--json"], { cwd: repoRoot, env, json: true });
    if (marketplace.marketplaceName !== MARKETPLACE || marketplace.alreadyAdded !== false) throw new Error("marketplace add JSON mismatch");

    for (const product of PRODUCTS) {
      const added = run(codex, ["plugin", "add", `${product.name}@${MARKETPLACE}`, "--json"], { cwd: repoRoot, env, json: true });
      if (added.pluginId !== `${product.name}@${MARKETPLACE}` || added.version !== "0.1.0") throw new Error(`${product.name} add JSON mismatch`);
      const cacheRoot = path.join(env.CODEX_HOME, "plugins/cache", MARKETPLACE, product.name, "0.1.0");
      if (added.installedPath !== cacheRoot) throw new Error(`${product.name} installed path mismatch`);
      if (await realpath(cacheRoot) !== cacheRoot || await countSkills(cacheRoot) !== 11) throw new Error(`${product.name} cache mismatch`);
      run(python, [isolatedValidator, cacheRoot], { cwd: registration.root, env });
      assertInstalledList(run(codex, ["plugin", "list", "--json"], { cwd: repoRoot, env, json: true }), product.name);

      const workspace = path.join(registration.root, `workspace-${product.name}`);
      await mkdir(workspace);
      const artifactPath = path.join(workspace, `${product.name}-artifact`);
      const prompt = [
        `명시적으로 설치된 스킬 ${product.skill} 을 호출하세요.`,
        `한 번의 짧은 작업으로 canonical game-design MD artifact를 ${artifactPath} 에 생성하세요.`,
        "필수 파일과 디렉터리를 만들고 md 형식으로 package-local validator를 통과시키세요.",
        `최종 응답 마지막에는 정확히 SKILL_PROVENANCE=${product.skill} 와 ARTIFACT_PATH=${artifactPath} 두 줄을 포함하세요.`,
      ].join("\n");
      const jsonl = run(codex, ["exec", "--ephemeral", "--json", "--sandbox", "workspace-write", "--skip-git-repo-check", "-C", workspace, prompt], {
        cwd: workspace,
        env,
        timeout: 180000,
      });
      parseExecJsonl(jsonl, { skillInvocation: product.skill, artifactPath });
      const artifactStats = await lstat(artifactPath).catch(() => null);
      if (!artifactStats?.isDirectory() || artifactStats.isSymbolicLink()) throw new Error(`${product.name} artifact missing`);
      const validation = safeJson(run(process.execPath, [path.join(cacheRoot, "scripts/validate-artifact.mjs"), artifactPath, "md"], {
        cwd: workspace,
        env,
      }), `${product.name} artifact validator`);
      if (validation.ok !== true || JSON.stringify(validation.requestedFormats) !== '["md"]') throw new Error(`${product.name} artifact validation failed`);
      results.push({ product: product.name, pluginId: added.pluginId, skill: product.skill, skills: 11, artifact: "validated-md", exec: "completed" });
      const removedPlugin = run(codex, ["plugin", "remove", `${product.name}@${MARKETPLACE}`, "--json"], { cwd: repoRoot, env, json: true });
      if (removedPlugin.pluginId !== `${product.name}@${MARKETPLACE}` || await lstat(cacheRoot).catch(() => null)) {
        throw new Error(`${product.name} removal mismatch`);
      }
    }
    const removed = run(codex, ["plugin", "marketplace", "remove", MARKETPLACE, "--json"], { cwd: repoRoot, env, json: true });
    if (removed.marketplaceName !== MARKETPLACE) throw new Error("marketplace remove JSON mismatch");
    const finalList = run(codex, ["plugin", "marketplace", "list", "--json"], { cwd: repoRoot, env, json: true });
    if (!Array.isArray(finalList.marketplaces) || finalList.marketplaces.length !== 0) throw new Error("marketplace final list mismatch");
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
