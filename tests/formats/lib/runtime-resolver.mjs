import { spawnSync } from "node:child_process";
import { constants } from "node:fs";
import { access, lstat, readFile, readdir, realpath } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const ENV_KEYS = ["CODEX_RUNTIME_DEPENDENCIES", "CODEX_WORKSPACE_DEPENDENCIES", "CODEX_DEPENDENCIES"];

export function compareNumericVersions(left, right) {
  const a = String(left).match(/\d+/g)?.map(Number) ?? [0];
  const b = String(right).match(/\d+/g)?.map(Number) ?? [0];
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const delta = (a[index] ?? 0) - (b[index] ?? 0);
    if (delta) return delta;
  }
  return 0;
}

async function exists(filename) {
  try { await access(filename); return true; } catch { return false; }
}

export async function resolvePathExecutable(name, env = process.env, platform = process.platform) {
  if (!/^[A-Za-z0-9._-]+$/u.test(name)) throw new Error(`command ${name} is unavailable`);
  const windows = platform === "win32";
  const pathApi = windows ? path.win32 : path;
  const separator = windows ? ";" : path.delimiter;
  const extensions = windows ? String(env.PATHEXT || ".COM;.EXE;.BAT;.CMD").split(";").filter(Boolean) : [""];
  const roots = String(env.PATH || env.Path || "").split(separator).filter((entry) => entry && entry.length <= 4096).slice(0, 64);
  for (const root of roots) {
    for (const extension of extensions) {
      const candidate = pathApi.join(root, windows ? `${name}${extension.toLowerCase()}` : name);
      try {
        await access(candidate, constants.X_OK);
        const canonical = await realpath(candidate);
        if ((await lstat(canonical)).isFile()) return canonical;
      } catch { /* try the next PATH candidate */ }
    }
  }
  throw new Error(`command ${name} is unavailable`);
}

async function artifactVersion(root) {
  const filename = path.join(root, "node", "node_modules", "@oai", "artifact-tool", "package.json");
  try {
    const value = JSON.parse(await readFile(filename, "utf8"));
    return value.name === "@oai/artifact-tool" && typeof value.version === "string" ? value.version : null;
  } catch { return null; }
}

async function expandCandidate(candidate) {
  const absolute = path.resolve(candidate);
  if (await artifactVersion(absolute)) return [absolute];
  const nested = path.join(absolute, "dependencies");
  if (await artifactVersion(nested)) return [nested];
  const entries = await readdir(absolute, { withFileTypes: true }).catch(() => []);
  const resolved = [];
  for (const entry of entries.filter((item) => item.isDirectory())) {
    const dependencyRoot = path.join(absolute, entry.name, "dependencies");
    if (await artifactVersion(dependencyRoot)) resolved.push(dependencyRoot);
  }
  return resolved;
}

function versionOf(executable, fallback = "unavailable") {
  if (!executable) return fallback;
  const result = spawnSync(executable, ["--version"], { encoding: "utf8" });
  return result.status === 0 ? `${result.stdout}${result.stderr}`.trim().replace(/^v/, "") : fallback;
}

export async function resolveRuntime({ env = process.env, home = os.homedir(), requireCommands = true } = {}) {
  const explicit = [];
  for (const key of ENV_KEYS) {
    if (env[key]) explicit.push(...String(env[key]).split(path.delimiter).filter(Boolean).map((value) => ({ value, sourceClass: "environment" })));
  }
  const official = path.join(home, ".cache", "codex-runtimes", "codex-primary-runtime", "dependencies");
  const inputs = explicit.length ? explicit : [{ value: official, sourceClass: "official-cache" }];
  const candidates = [];
  for (const input of inputs) {
    for (const dependenciesRoot of await expandCandidate(input.value)) {
      candidates.push({ dependenciesRoot: await realpath(dependenciesRoot), sourceClass: input.sourceClass, artifactToolVersion: await artifactVersion(dependenciesRoot) });
    }
  }
  candidates.sort((a, b) => compareNumericVersions(b.artifactToolVersion, a.artifactToolVersion));
  const selected = candidates[0];
  if (!selected) throw new Error("Official Codex runtime dependencies are unavailable");
  const commands = {
    node: path.join(selected.dependenciesRoot, "node", "bin", "node"),
    python: path.join(selected.dependenciesRoot, "python", "bin", "python3"),
    soffice: path.join(selected.dependenciesRoot, "bin", "override", "soffice"),
    pdftoppm: path.join(selected.dependenciesRoot, "bin", "override", "pdftoppm"),
    pdfinfo: path.join(selected.dependenciesRoot, "bin", "override", "pdfinfo"),
    pdftotext: await (async () => {
      const bundled = path.join(selected.dependenciesRoot, "bin", "override", "pdftotext");
      return await exists(bundled) ? bundled : resolvePathExecutable("pdftotext", env).catch(() => null);
    })(),
  };
  if (requireCommands) {
    const missing = [];
    for (const [name, filename] of Object.entries(commands)) if (!(await exists(filename))) missing.push(name);
    if (missing.length) throw new Error(`Official runtime is missing required commands: ${missing.join(", ")}`);
  }
  const publicMetadata = {
    runtimeSourceClass: selected.sourceClass,
    node: versionOf(commands.node),
    python: versionOf(commands.python),
    artifactTool: selected.artifactToolVersion,
  };
  return { ...selected, commands, publicMetadata };
}
