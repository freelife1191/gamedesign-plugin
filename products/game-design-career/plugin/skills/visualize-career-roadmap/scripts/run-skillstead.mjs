#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { lstat, realpath } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const COMMANDS = Object.freeze({ lint: "check-svg.mjs", render: "render.mjs" });

function inside(root, target) {
  const relative = path.relative(root, target);
  return relative !== "" && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

async function packageRoots() {
  const ownPath = await realpath(fileURLToPath(import.meta.url));
  const pluginRoot = path.resolve(path.dirname(ownPath), "../../..");
  return [
    path.join(pluginRoot, "skills/svg-infographic"),
    path.resolve(path.dirname(ownPath), "../../../../../../shared/vendor/skillstead/svg-infographic/0.9.0"),
  ];
}

export async function resolveSkillsteadCli(command) {
  const filename = COMMANDS[command];
  if (!filename) throw new Error(`Unsupported Skillstead command: ${command}`);
  for (const candidate of await packageRoots()) {
    try {
      const packageRoot = await realpath(candidate);
      const cliPath = await realpath(path.join(packageRoot, "scripts", filename));
      const stat = await lstat(cliPath);
      if (!stat.isFile() || !inside(packageRoot, cliPath)) throw new Error("unsafe Skillstead CLI path");
      return cliPath;
    } catch (error) {
      if (!["ENOENT", "ENOTDIR"].includes(error?.code)) throw error;
    }
  }
  throw new Error(`Packaged Skillstead ${command} CLI is unavailable`);
}

async function loadApi(command, exportName) {
  const cliPath = await resolveSkillsteadCli(command);
  const module = await import(pathToFileURL(cliPath).href);
  if (typeof module[exportName] !== "function") throw new Error(`Packaged Skillstead ${exportName} export is unavailable`);
  return module[exportName];
}

const lintSvg = await loadApi("lint", "lintSvg");
const isCompletePng = await loadApi("render", "isCompletePng");

export function lintSvgSource(source, filename) {
  return lintSvg(source, filename);
}

export function isCompletePngFile(filename) {
  return isCompletePng(filename);
}

export async function probeSkillsteadRenderer() {
  const resolveBrowser = await loadApi("render", "resolveBrowser");
  return resolveBrowser();
}

export async function runSkillstead(command, args, {
  spawn = spawnSync,
  stdout = process.stdout,
  stderr = process.stderr,
} = {}) {
  const validArity = command === "lint"
    ? Array.isArray(args) && args.length >= 1
    : command === "render" && Array.isArray(args) && args.length === 2;
  if (!validArity || args.some((value) => typeof value !== "string" || value === "")) {
    throw new TypeError("Skillstead arguments do not match the supported command shape");
  }
  const cliPath = await resolveSkillsteadCli(command);
  const execution = spawn(process.execPath, [cliPath, ...args], { encoding: "utf8" });
  if (execution.error) throw execution.error;
  const capturedStdout = typeof execution.stdout === "string" ? execution.stdout : "";
  const capturedStderr = typeof execution.stderr === "string" ? execution.stderr : "";
  if (!Number.isInteger(execution.status) || execution.status !== 0) {
    throw new Error(`Skillstead ${command} failed with exit ${execution.status ?? "unknown"}: ${(capturedStderr || capturedStdout).trim() || "no output"}`);
  }
  if (`${capturedStdout}${capturedStderr}`.trim() === "") throw new Error(`Skillstead ${command} returned no output`);
  if (capturedStdout) stdout.write(capturedStdout);
  if (capturedStderr) stderr.write(capturedStderr);
  return 0;
}

export async function isMainModule(metaUrl = import.meta.url, argvPath = process.argv[1]) {
  if (typeof argvPath !== "string" || argvPath.length === 0) return false;
  try {
    return await realpath(fileURLToPath(metaUrl)) === await realpath(argvPath);
  } catch {
    return false;
  }
}

export async function main(argv = process.argv.slice(2)) {
  const [command, ...args] = argv;
  if (command === "probe" && args.length === 0) {
    try {
      const browser = await probeSkillsteadRenderer();
      const result = { ok: Boolean(browser), available: Boolean(browser), browser: browser?.path ?? null };
      (browser ? process.stdout : process.stderr).write(`${JSON.stringify(result)}\n`);
      return browser ? 0 : 1;
    } catch (error) {
      process.stderr.write(`${JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) })}\n`);
      return 1;
    }
  }
  const validArity = command === "lint" ? args.length >= 1 : command === "render" ? args.length === 2 : false;
  if (!validArity) {
    process.stderr.write(`${JSON.stringify({ ok: false, error: "Usage: node run-skillstead.mjs lint <svg...> | render <svg> <png> | probe" })}\n`);
    return 2;
  }
  try {
    return await runSkillstead(command, args);
  } catch (error) {
    process.stderr.write(`${JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) })}\n`);
    return 1;
  }
}

if (await isMainModule()) process.exitCode = await main();
