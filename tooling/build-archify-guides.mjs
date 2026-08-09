#!/usr/bin/env node

import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { buildArchifyGuides } from "./lib/archify-guides.mjs";

function parseArguments(argv) {
  if (argv.length === 0) return { check: false };
  if (argv.length === 1 && argv[0] === "--check") return { check: true };
  throw new Error(`Unknown argument: ${argv.join(" ")}`);
}

export async function main(argv = process.argv.slice(2)) {
  const { check } = parseArguments(argv);
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const result = await buildArchifyGuides({ repoRoot, check });
  process.stdout.write(`archify-guides: ${check ? "PASS" : "BUILT"} ${JSON.stringify(result)}\n`);
  return result;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    process.stderr.write(`archify-guides: FAIL ${error.message}\n`);
    process.exitCode = 1;
  });
}
