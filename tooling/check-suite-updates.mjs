#!/usr/bin/env node

import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

import { checkLatestDiagramSkills } from "./sync-diagram-skills.mjs";
import { checkLatestImNotAi } from "./sync-im-not-ai.mjs";

export const repoRoot = fileURLToPath(new URL("..", import.meta.url));

const COMPONENT_IDS = Object.freeze(["skillstead", "archify", "im-not-ai"]);
const UPDATE_STATUSES = new Set(["current", "outdated", "unknown"]);

function unknownComponent(id) {
  return { id, status: "unknown", installedTag: null, latestTag: null, updateAvailable: false };
}

function normalizeComponent(id, result) {
  if (!result || result.status === "unknown") return unknownComponent(id);
  if (!UPDATE_STATUSES.has(result.status) || typeof result.installedTag !== "string" || typeof result.latestTag !== "string" || typeof result.updateAvailable !== "boolean") {
    return unknownComponent(id);
  }
  if (result.updateAvailable !== (result.status === "outdated")) return unknownComponent(id);
  return { id, status: result.status, installedTag: result.installedTag, latestTag: result.latestTag, updateAvailable: result.updateAvailable };
}

function normalizeDiagramComponents(results) {
  if (!Array.isArray(results)) return COMPONENT_IDS.slice(0, 2).map(unknownComponent);
  const byName = new Map();
  for (const result of results) {
    if (!result || !["skillstead", "archify"].includes(result.name) || byName.has(result.name)) return COMPONENT_IDS.slice(0, 2).map(unknownComponent);
    byName.set(result.name, result);
  }
  return ["skillstead", "archify"].map((id) => normalizeComponent(id, byName.get(id)));
}

export function updateStatusFor(components) {
  if (!Array.isArray(components) || components.length !== COMPONENT_IDS.length || components.some(({ id, status }, index) => id !== COMPONENT_IDS[index] || !UPDATE_STATUSES.has(status))) {
    return "unknown";
  }
  if (components.some(({ status }) => status === "unknown")) return "unknown";
  return components.some(({ status }) => status === "outdated") ? "outdated" : "current";
}

export function exitCodeForUpdateStatus(status) {
  return status === "current" ? 0 : status === "outdated" ? 2 : 1;
}

export async function checkSuiteUpdates({
  root = repoRoot,
  checkDiagramSkills = checkLatestDiagramSkills,
  checkImNotAi = checkLatestImNotAi,
} = {}) {
  const absoluteRoot = path.resolve(root);
  const [diagram, imNotAi] = await Promise.allSettled([
    checkDiagramSkills({ root: absoluteRoot }),
    checkImNotAi({ root: path.join(absoluteRoot, "shared/vendor/im-not-ai") }),
  ]);
  const components = [
    ...(diagram.status === "fulfilled" ? normalizeDiagramComponents(diagram.value) : COMPONENT_IDS.slice(0, 2).map(unknownComponent)),
    imNotAi.status === "fulfilled" ? normalizeComponent("im-not-ai", imNotAi.value) : unknownComponent("im-not-ai"),
  ];
  return { schemaVersion: 1, status: updateStatusFor(components), components };
}

export function parseCheckSuiteUpdatesArgs(args) {
  if (args.length === 0) return { requireCurrent: false };
  if (args.length === 1 && args[0] === "--require-current") return { requireCurrent: true };
  throw new Error("Usage: node tooling/check-suite-updates.mjs [--require-current]");
}

async function main() {
  parseCheckSuiteUpdatesArgs(process.argv.slice(2));
  const result = await checkSuiteUpdates();
  process.stdout.write(`${JSON.stringify(result)}\n`);
  process.exitCode = exitCodeForUpdateStatus(result.status);
}

const entry = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (entry && pathToFileURL(entry).href === import.meta.url) {
  main().catch((error) => {
    const result = { schemaVersion: 1, status: "unknown", components: COMPONENT_IDS.map(unknownComponent) };
    process.stdout.write(`${JSON.stringify(result)}\n`);
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
