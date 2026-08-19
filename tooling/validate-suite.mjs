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
  { name: "vendor references", command: [process.execPath, "tooling/sync-vendor-references.mjs", "--check"], rerun: "node tooling/sync-vendor-references.mjs --check" },
  { name: "vendor catalog entries", command: [process.execPath, "tooling/sync-vendor-catalog-entries.mjs", "--check"], rerun: "node tooling/sync-vendor-catalog-entries.mjs --check" },
  { name: "update manifest", command: [process.execPath, "tooling/generate-update-manifest.mjs", "--check"], rerun: "node tooling/generate-update-manifest.mjs --check" },
  // These three call the group runner directly rather than through `npm run`. On Windows `npm` is a
  // .cmd shim, which spawnSync cannot execute without a shell, so the npm form failed instantly there
  // while looking like a test failure. The rerun hints stay in npm form because that is what a person types.
  { name: "unit tests", command: [process.execPath, "tooling/run-test-group.mjs", "unit"], rerun: "npm run test:unit" },
  { name: "contract tests", command: [process.execPath, "tooling/run-test-group.mjs", "contracts"], rerun: "npm run test:contracts" },
  { name: "product tests", command: [process.execPath, "tooling/run-test-group.mjs", "products", "e2e/career", "e2e/studio"], rerun: "npm run test:products" },
  { name: "clean build drift", command: [process.execPath, "tooling/validate-build-drift.mjs"], rerun: "node tooling/validate-build-drift.mjs" },
  { name: "official plugin validators", command: [process.execPath, "tooling/validate-packages.mjs", "plugins"], rerun: "node tooling/validate-packages.mjs plugins" },
  { name: "skill quick validators", command: [process.execPath, "tooling/validate-packages.mjs", "skills"], rerun: "node tooling/validate-packages.mjs skills" },
  // The isolation smoke runs the official plugin validator on each isolated package as one of its
  // steps. When the run has already accounted for that validator being absent, this stage inherits the
  // same accounting instead of failing for a reason the run has openly recorded.
  {
    name: "isolation smoke",
    command: [process.execPath, "tooling/isolation-smoke.mjs"],
    rerun: "node tooling/isolation-smoke.mjs",
    inheritsSkipOf: "official plugin validators",
    inheritedFlag: "--allow-missing-official-validator",
  },
  { name: "diagram render drift", command: [process.execPath, "tooling/build-use-case-diagrams.mjs", "--check"], rerun: "npm run check:guide-diagrams" },
  { name: "format smoke", command: [process.execPath, "tests/formats/run-format-gate.mjs"], rerun: "npm run test:formats" },
]);

// CI cannot run these four. The official plugin and skill validators ship with a Codex install; the
// format smoke imports a host-provided module that is not a dependency of this package; and the diagram
// render drift compares PNG bytes produced by a headless Chromium against the host's fonts, so it only
// means something on a machine whose renderer matches the one that committed them. Leaving them out is
// legitimate; leaving them out quietly is not, because a green run would then read as "everything was
// checked". The set is closed here, and a skip prints on its own line, never as PASS.
export const SKIPPABLE_STAGES = Object.freeze([
  "official plugin validators",
  "skill quick validators",
  "diagram render drift",
  "format smoke",
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
  skip = [],
  runCommand = defaultRunCommand,
} = {}) {
  const absoluteRoot = path.resolve(repoRoot);
  const skipped = [...new Set(skip)];
  for (const name of skipped) {
    if (!SKIPPABLE_STAGES.includes(name)) throw new Error(`${name} is not skippable`);
  }
  if (release && skipped.length > 0) throw new Error("release runs every stage; --skip is refused");
  const isSkipped = (name) => skipped.includes(name);

  for (const stage of STAGES.slice(0, -1)) {
    if (isSkipped(stage.name)) {
      process.stdout.write(`[suite] SKIP: ${stage.name} (run locally before release)\n`);
      continue;
    }
    process.stdout.write(`[suite] ${stage.name}\n`);
    const effective = stage.inheritsSkipOf && isSkipped(stage.inheritsSkipOf)
      ? { ...stage, command: [...stage.command, stage.inheritedFlag] }
      : stage;
    let outcome;
    try {
      outcome = await runCommand(effective, absoluteRoot);
    } catch (error) {
      outcome = { error, status: null, signal: null };
    }
    if (!processPassed(outcome)) {
      process.stderr.write(`[suite] FAIL: ${stage.name}\nRerun: ${stage.rerun}\n`);
      return { ok: false, releaseReady: false, skipped, failedStage: stage.name, rerun: stage.rerun };
    }
    process.stdout.write(`[suite] PASS: ${stage.name}\n`);
  }

  const formatStage = STAGES.at(-1);
  if (isSkipped(formatStage.name)) {
    // Skipping means the stage never runs, so its readiness state is never consulted either. A
    // PARTIAL tree must not fail a run that was told not to look at the tree in the first place.
    process.stdout.write(`[suite] SKIP: ${formatStage.name} (run locally before release)\n`);
    process.stdout.write(`Suite release readiness: INCOMPLETE (skipped: ${skipped.join(", ")})\n`);
    return { ok: true, releaseReady: false, skipped, formatStatus: "SKIPPED" };
  }

  const state = await formatState(absoluteRoot);
  if (state === "UNAVAILABLE") {
    process.stdout.write("[suite] format smoke: UNAVAILABLE (Task 11 not present)\nSuite release readiness: INCOMPLETE\n");
    return { ok: !release, releaseReady: false, skipped, formatStatus: "UNAVAILABLE", failedStage: release ? "format smoke" : undefined, rerun: release ? formatStage.rerun : undefined };
  }
  if (state === "PARTIAL") {
    process.stderr.write(`[suite] FAIL: format smoke (partial Task 11 files)\nRerun: ${formatStage.rerun}\n`);
    return { ok: false, releaseReady: false, skipped, formatStatus: "FAIL", failedStage: "format smoke", rerun: formatStage.rerun };
  }

  let outcome;
  try {
    outcome = await runCommand(formatStage, absoluteRoot);
  } catch (error) {
    outcome = { error, status: null, signal: null };
  }
  if (!processPassed(outcome)) {
    process.stderr.write(`[suite] FAIL: format smoke\nRerun: ${formatStage.rerun}\n`);
    return { ok: false, releaseReady: false, skipped, formatStatus: "FAIL", failedStage: "format smoke", rerun: formatStage.rerun };
  }
  process.stdout.write("[suite] PASS: format smoke\n");
  process.stdout.write(skipped.length === 0
    ? "Suite release readiness: COMPLETE\n"
    : `Suite release readiness: INCOMPLETE (skipped: ${skipped.join(", ")})\n`);
  return { ok: true, releaseReady: skipped.length === 0, skipped, formatStatus: "PASS" };
}

async function main() {
  const usage = "Usage: node tooling/validate-suite.mjs [--release] [--skip <stage>]...";
  const args = process.argv.slice(2);
  const skip = [];
  let release = false;
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--release") {
      if (release) throw new Error(usage);
      release = true;
    } else if (args[index] === "--skip") {
      const name = args[index + 1];
      if (name === undefined) throw new Error("--skip needs a stage name");
      skip.push(name);
      index += 1;
    } else {
      throw new Error(usage);
    }
  }
  const result = await runSuite({ release, skip });
  if (!result.ok) process.exitCode = 1;
}

const entry = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (entry && pathToFileURL(entry).href === import.meta.url) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
