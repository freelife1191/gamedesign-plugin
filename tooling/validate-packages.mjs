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
  const products = ["game-design-career", "game-design-studio"];
  let count = 0;
  if (mode === "plugins") {
    for (const product of products) {
      run(creators.plugins, path.join(repoRoot, "plugins", product));
      count += 1;
    }
  } else {
    for (const product of products) {
      const skillsRoot = path.join(repoRoot, "plugins", product, "skills");
      const entries = (await readdir(skillsRoot, { withFileTypes: true }))
        .filter((entry) => entry.isDirectory()).map(({ name }) => name).sort();
      for (const skill of entries) {
        run(creators.skills, path.join(skillsRoot, skill));
        count += 1;
      }
    }
    if (count !== 22) throw new Error(`expected 22 packaged skills, found ${count}`);
  }
  process.stdout.write(`${mode}: PASS (${count} validators)\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
