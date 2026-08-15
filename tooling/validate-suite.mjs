#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { lstat, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

export const FORMAT_RESULT_FILES = Object.freeze([
  "tests/formats/run-format-gate.mjs",
  "tests/formats/verify-formats.mjs",
  "tests/formats/FORMAT-RESULTS.md",
]);

const STAGES = Object.freeze([
  { name: "reference drift", command: [process.execPath, "tooling/index-references.mjs", "--check"], rerun: "node tooling/index-references.mjs --check" },
  { name: "evidence audit", command: [process.execPath, "tooling/audit-evidence.mjs", "--check"], rerun: "node tooling/audit-evidence.mjs --check" },
  { name: "vendor hash", command: [process.execPath, "tooling/verify-vendor-hash.mjs"], rerun: "node tooling/verify-vendor-hash.mjs" },
  { name: "update manifest", command: [process.execPath, "tooling/generate-update-manifest.mjs", "--check"], rerun: "node tooling/generate-update-manifest.mjs --check" },
  { name: "unit tests", command: ["npm", "run", "test:unit"], rerun: "npm run test:unit" },
  { name: "contract tests", command: ["npm", "run", "test:contracts"], rerun: "npm run test:contracts" },
  { name: "product tests", command: ["npm", "run", "test:products"], rerun: "npm run test:products" },
  { name: "clean build drift", command: [process.execPath, "tooling/validate-build-drift.mjs"], rerun: "node tooling/validate-build-drift.mjs" },
  { name: "official plugin validators", command: [process.execPath, "tooling/validate-packages.mjs", "plugins"], rerun: "node tooling/validate-packages.mjs plugins" },
  { name: "skill quick validators", command: [process.execPath, "tooling/validate-packages.mjs", "skills"], rerun: "node tooling/validate-packages.mjs skills" },
  { name: "isolation smoke", command: [process.execPath, "tooling/isolation-smoke.mjs"], rerun: "node tooling/isolation-smoke.mjs" },
  { name: "format smoke", command: [process.execPath, "tests/formats/run-format-gate.mjs"], rerun: "npm run test:formats" },
]);

async function formatState(repoRoot) {
  const formatsRoot = path.join(repoRoot, "tests/formats");
  const entries = await readdir(formatsRoot).catch((error) => {
    if (error.code === "ENOENT") return [];
    throw error;
  });
  if (entries.length === 0) return "UNAVAILABLE";
  const required = await Promise.all(FORMAT_RESULT_FILES.map(async (relative) => {
    const stats = await lstat(path.join(repoRoot, relative)).catch((error) => error.code === "ENOENT" ? null : Promise.reject(error));
    return Boolean(stats?.isFile() && !stats.isSymbolicLink());
  }));
  return required.every(Boolean) ? "READY" : "PARTIAL";
}

function defaultRunCommand(stage, repoRoot) {
  const [command, ...args] = stage.command;
  return spawnSync(command, args, { cwd: repoRoot, env: { ...process.env }, stdio: "inherit" });
}

function processPassed(outcome) {
  return !outcome?.error && outcome?.signal == null && outcome?.status === 0;
}

export async function runSuite({
  repoRoot = fileURLToPath(new URL("..", import.meta.url)),
  release = false,
  runCommand = defaultRunCommand,
} = {}) {
  const absoluteRoot = path.resolve(repoRoot);
  for (const stage of STAGES.slice(0, -1)) {
    process.stdout.write(`[suite] ${stage.name}\n`);
    let outcome;
    try {
      outcome = await runCommand(stage, absoluteRoot);
    } catch (error) {
      outcome = { error, status: null, signal: null };
    }
    if (!processPassed(outcome)) {
      process.stderr.write(`[suite] FAIL: ${stage.name}\nRerun: ${stage.rerun}\n`);
      return { ok: false, releaseReady: false, failedStage: stage.name, rerun: stage.rerun };
    }
    process.stdout.write(`[suite] PASS: ${stage.name}\n`);
  }

  const state = await formatState(absoluteRoot);
  const formatStage = STAGES.at(-1);
  if (state === "UNAVAILABLE") {
    process.stdout.write("[suite] format smoke: UNAVAILABLE (Task 11 not present)\nSuite release readiness: INCOMPLETE\n");
    return { ok: !release, releaseReady: false, formatStatus: "UNAVAILABLE", failedStage: release ? "format smoke" : undefined, rerun: release ? formatStage.rerun : undefined };
  }
  if (state === "PARTIAL") {
    process.stderr.write(`[suite] FAIL: format smoke (partial Task 11 files)\nRerun: ${formatStage.rerun}\n`);
    return { ok: false, releaseReady: false, formatStatus: "FAIL", failedStage: "format smoke", rerun: formatStage.rerun };
  }

  let outcome;
  try {
    outcome = await runCommand(formatStage, absoluteRoot);
  } catch (error) {
    outcome = { error, status: null, signal: null };
  }
  if (!processPassed(outcome)) {
    process.stderr.write(`[suite] FAIL: format smoke\nRerun: ${formatStage.rerun}\n`);
    return { ok: false, releaseReady: false, formatStatus: "FAIL", failedStage: "format smoke", rerun: formatStage.rerun };
  }
  process.stdout.write("[suite] PASS: format smoke\nSuite release readiness: COMPLETE\n");
  return { ok: true, releaseReady: true, formatStatus: "PASS" };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== "--release") || args.filter((arg) => arg === "--release").length > 1) {
    throw new Error("Usage: node tooling/validate-suite.mjs [--release]");
  }
  const result = await runSuite({ release: args.includes("--release") });
  if (!result.ok) process.exitCode = 1;
}

const entry = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (entry && pathToFileURL(entry).href === import.meta.url) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
