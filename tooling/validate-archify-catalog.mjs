#!/usr/bin/env node

import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { loadArchifyCatalog } from "./lib/archify-catalog.mjs";

async function main() {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== "--list-uncovered" && arg !== "--json") || new Set(args).size !== args.length) {
    throw new Error("Usage: node tooling/validate-archify-catalog.mjs [--list-uncovered] [--json]");
  }
  const listUncovered = args.includes("--list-uncovered");
  const json = args.includes("--json");
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  try {
    const catalog = await loadArchifyCatalog({ repoRoot });
    if (json) process.stdout.write(`${JSON.stringify({ ok: true, catalog })}\n`);
    else if (!listUncovered) process.stdout.write("archify catalog: PASS\n");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const uncovered = Array.isArray(error?.uncovered) ? error.uncovered : [];
    if (listUncovered && uncovered.length > 0) {
      process.stdout.write(`${uncovered.join("\n")}\n`);
    }
    if (json) process.stdout.write(`${JSON.stringify({ ok: false, errors: message.split("\n"), uncovered })}\n`);
    else if (!listUncovered || uncovered.length === 0) process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
