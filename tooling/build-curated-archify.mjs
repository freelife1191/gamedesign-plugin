#!/usr/bin/env node

import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { checkCuratedArchify, publishCuratedArchify, stageCuratedArchify } from "./lib/archify-delivery.mjs";

export function parseCuratedArchifyArguments(argv) {
  const result = { mode: null, ids: [], product: null };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (["--stage", "--check", "--publish"].includes(argument)) {
      if (result.mode) throw new Error("exactly one of --stage, --check, or --publish is required");
      result.mode = argument.slice(2);
      continue;
    }
    if (argument === "--id") {
      const id = argv[index + 1];
      if (typeof id !== "string" || id.length === 0 || id.startsWith("--")) throw new Error("--id requires a value");
      result.ids.push(id); index += 1; continue;
    }
    if (argument === "--product") {
      const product = argv[index + 1];
      if (!["studio", "career", "suite"].includes(product) || result.product !== null) throw new Error("--product accepts one of studio, career, suite exactly once");
      result.product = product; index += 1; continue;
    }
    throw new Error(`unknown argument: ${argument}`);
  }
  if (!result.mode) throw new Error("exactly one of --stage, --check, or --publish is required");
  if (new Set(result.ids).size !== result.ids.length) throw new Error("--id must not be repeated");
  return Object.freeze(result);
}

export async function buildCuratedArchify(argv = process.argv.slice(2), { repoRoot = process.cwd() } = {}) {
  const { mode, ids, product } = parseCuratedArchifyArguments(argv);
  const options = { repoRoot, ids, product };
  if (mode === "stage") return stageCuratedArchify(options);
  if (mode === "check") return checkCuratedArchify(options);
  return publishCuratedArchify(options);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    console.log(JSON.stringify(await buildCuratedArchify()));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
