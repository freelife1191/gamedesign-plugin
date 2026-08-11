#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { lstat, realpath } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

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

export async function runSkillstead(command, args, { stdio = "inherit" } = {}) {
  if (!Array.isArray(args) || args.length === 0 || args.some((value) => typeof value !== "string" || value === "")) {
    throw new TypeError("Skillstead arguments must be nonempty path strings");
  }
  const cliPath = await resolveSkillsteadCli(command);
  const execution = spawnSync(process.execPath, [cliPath, ...args], { stdio });
  if (execution.error) throw execution.error;
  return Number.isInteger(execution.status) ? execution.status : 1;
}

async function isDirectInvocation() {
  if (!process.argv[1]) return false;
  try {
    return await realpath(process.argv[1]) === await realpath(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (await isDirectInvocation()) {
  const [command, ...args] = process.argv.slice(2);
  const validArity = command === "lint" ? args.length >= 1 : command === "render" ? args.length === 2 : false;
  if (!validArity) {
    console.error("Usage: node run-skillstead.mjs lint <svg...> | render <svg> <png>");
    process.exitCode = 2;
  } else {
    try {
      process.exitCode = await runSkillstead(command, args);
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
  }
}
