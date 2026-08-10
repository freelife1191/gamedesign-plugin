#!/usr/bin/env node

import { lstat, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { loadArchifyVisualQa, renderArchifyContactSheets } from "./lib/archify-visual-qa.mjs";
import { comparePaths } from "./lib/paths.mjs";

const OUTPUT_ROOT = "guides/archify-diagrams/visual-qa/contact-sheets";

function parseArguments(argv) {
  if (argv.length === 0) return { check: false };
  if (argv.length === 1 && argv[0] === "--check") return { check: true };
  throw new Error(`Unknown argument: ${argv.join(" ")}`);
}

async function assertDirectoryPath(root, relative, { create } = {}) {
  let current = root;
  for (const segment of relative.split("/")) {
    current = path.join(current, segment);
    let stats = await lstat(current).catch((error) => error?.code === "ENOENT" ? null : Promise.reject(error));
    if (!stats && create) {
      await mkdir(current);
      stats = await lstat(current);
    }
    if (!stats || !stats.isDirectory() || stats.isSymbolicLink()) throw new Error(`contact sheet output directory is unsafe: ${relative}`);
  }
  return current;
}

async function assertExactOutput(directory, sheets) {
  const actual = (await readdir(directory)).sort(comparePaths);
  const expected = [...sheets.keys()].sort(comparePaths);
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error("contact sheet output set is stale or incomplete");
  for (const [name, expectedBytes] of sheets) {
    const filename = path.join(directory, name);
    const stats = await lstat(filename);
    if (!stats.isFile() || stats.isSymbolicLink()) throw new Error(`contact sheet output is unsafe: ${name}`);
    const actualBytes = await readFile(filename, "utf8");
    if (actualBytes !== expectedBytes) throw new Error(`contact sheet bytes are stale: ${name}`);
  }
}

export async function buildArchifyContactSheets({ repoRoot, check = false } = {}) {
  const { catalog, qa } = await loadArchifyVisualQa({ repoRoot });
  const sheets = renderArchifyContactSheets({ catalog, qa });
  const directory = await assertDirectoryPath(repoRoot, OUTPUT_ROOT, { create: !check });
  if (check) {
    await assertExactOutput(directory, sheets);
    return { checked: true, outputs: [...sheets.keys()].sort(comparePaths) };
  }
  for (const [name, bytes] of sheets) await writeFile(path.join(directory, name), bytes, "utf8");
  await assertExactOutput(directory, sheets);
  return { built: true, outputs: [...sheets.keys()].sort(comparePaths) };
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  try {
    const result = await buildArchifyContactSheets({ repoRoot: process.cwd(), ...parseArguments(process.argv.slice(2)) });
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
