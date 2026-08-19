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
// CI runs the stages as four jobs instead of one queue, because the whole run is roughly eight minutes
// and three quarters of it is three stages that have nothing to say to each other. Splitting them costs
// runner minutes and buys back wall clock. The partition is total and disjoint — a stage in no shard would
// be a stage CI silently stopped running, which is the exact failure this file's other comments guard
// against — and `tests/unit/validate-suite.test.mjs` holds it to that.
export const STAGE_SHARDS = Object.freeze({
  checks: Object.freeze([
    "reference drift", "evidence audit", "vendor hash", "vendor references", "vendor catalog entries",
    "update manifest", "clean build drift", "official plugin validators", "skill quick validators",
    "isolation smoke", "diagram render drift", "format smoke",
  ]),
  unit: Object.freeze(["unit tests"]),
  contracts: Object.freeze(["contract tests"]),
  products: Object.freeze(["product tests"]),
});

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
  shard = null,
  runCommand = defaultRunCommand,
} = {}) {
  const absoluteRoot = path.resolve(repoRoot);
  const skipped = [...new Set(skip)];
  for (const name of skipped) {
    if (!SKIPPABLE_STAGES.includes(name)) throw new Error(`${name} is not skippable`);
  }
  if (release && skipped.length > 0) throw new Error("release runs every stage; --skip is refused");
  // A shard is a piece of a run. Release readiness is a claim about the whole of it, so the two cannot be
  // asked for together without one of them being a lie.
  if (release && shard !== null) throw new Error("release runs every stage; --shard is refused");
  if (shard !== null && !Object.hasOwn(STAGE_SHARDS, shard)) throw new Error(`unknown shard: ${shard}`);
  const inShard = (name) => shard === null || STAGE_SHARDS[shard].includes(name);
  const label = shard === null ? "Suite release readiness" : `Suite shard ${shard}`;
  const isSkipped = (name) => skipped.includes(name);

  for (const stage of STAGES.slice(0, -1)) {
    if (!inShard(stage.name)) continue;
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
  if (!inShard(formatStage.name)) {
    process.stdout.write(`${label}: COMPLETE\n`);
    return { ok: true, releaseReady: false, skipped, shard, formatStatus: "OTHER-SHARD" };
  }
  if (isSkipped(formatStage.name)) {
    // Skipping means the stage never runs, so its readiness state is never consulted either. A
    // PARTIAL tree must not fail a run that was told not to look at the tree in the first place.
    process.stdout.write(`[suite] SKIP: ${formatStage.name} (run locally before release)\n`);
    process.stdout.write(`${label}: INCOMPLETE (skipped: ${skipped.join(", ")})\n`);
    return { ok: true, releaseReady: false, skipped, shard, formatStatus: "SKIPPED" };
  }

  const state = await formatState(absoluteRoot);
  if (state === "UNAVAILABLE") {
    process.stdout.write(`[suite] format smoke: UNAVAILABLE (Task 11 not present)\n${label}: INCOMPLETE\n`);
    return { ok: !release, releaseReady: false, skipped, shard, formatStatus: "UNAVAILABLE", failedStage: release ? "format smoke" : undefined, rerun: release ? formatStage.rerun : undefined };
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
    ? `${label}: COMPLETE\n`
    : `${label}: INCOMPLETE (skipped: ${skipped.join(", ")})\n`);
  return { ok: true, releaseReady: shard === null && skipped.length === 0, skipped, shard, formatStatus: "PASS" };
}

async function main() {
  const usage = "Usage: node tooling/validate-suite.mjs [--release] [--shard <name>] [--skip <stage>]...";
  const args = process.argv.slice(2);
  const skip = [];
  let release = false;
  let shard = null;
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--release") {
      if (release) throw new Error(usage);
      release = true;
    } else if (args[index] === "--shard") {
      if (shard !== null) throw new Error(usage);
      shard = args[index + 1];
      if (shard === undefined) throw new Error("--shard needs a shard name");
      index += 1;
    } else if (args[index] === "--skip") {
      const name = args[index + 1];
      if (name === undefined) throw new Error("--skip needs a stage name");
      skip.push(name);
      index += 1;
    } else {
      throw new Error(usage);
    }
  }
  const result = await runSuite({ release, skip, shard });
  if (!result.ok) process.exitCode = 1;
}

const entry = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (entry && pathToFileURL(entry).href === import.meta.url) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
