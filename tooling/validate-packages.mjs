#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const codexHome = process.env.CODEX_HOME ? path.resolve(process.env.CODEX_HOME) : path.join(homedir(), ".codex");
const creators = {
  plugins: path.join(codexHome, "skills/.system/plugin-creator/scripts/validate_plugin.py"),
  skills: path.join(codexHome, "skills/.system/skill-creator/scripts/quick_validate.py"),
};

export async function discoverPackagedTargets(root, mode) {
  if (mode === "plugins") {
    return ["game-design-career", "game-design-studio"]
      .map((product) => path.join(root, "plugins", product));
  }
  if (mode !== "skills") throw new Error("mode must be plugins or skills");
  const targets = [];
  for (const product of ["game-design-career", "game-design-studio"]) {
    const skillsRoot = path.join(root, "plugins", product, "skills");
    const entries = await readdir(skillsRoot, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
      const target = path.join(skillsRoot, entry.name);
      if (existsSync(path.join(target, "SKILL.md"))) targets.push(target);
    }
  }
  return targets.sort();
}

function run(script, target) {
  const result = spawnSync("python3", [script, target], { cwd: repoRoot, encoding: "utf8" });
  process.stdout.write(result.stdout ?? "");
  process.stderr.write(result.stderr ?? "");
  if (result.error) throw result.error;
  if (result.signal) throw new Error(`validator terminated by ${result.signal}`);
  if (result.status !== 0) throw new Error(`validator failed for ${path.relative(repoRoot, target)}`);
}

async function main() {
  const mode = process.argv[2];
  if (!Object.hasOwn(creators, mode)) throw new Error("Usage: node tooling/validate-packages.mjs plugins|skills");
  if (!existsSync(creators[mode])) throw new Error(`official validator unavailable: ${creators[mode]}`);
  const targets = await discoverPackagedTargets(repoRoot, mode);
  for (const target of targets) run(creators[mode], target);
  const count = targets.length;
  process.stdout.write(`${mode}: PASS (${count} validators)\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
