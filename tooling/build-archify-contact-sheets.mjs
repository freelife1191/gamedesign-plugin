#!/usr/bin/env node

import { createHash, randomUUID } from "node:crypto";
import { lstat, mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { loadArchifyVisualQa, renderArchifyContactSheets } from "./lib/archify-visual-qa.mjs";
import { cleanupGuardedTempRoot, createGuardedTempRoot } from "./lib/guarded-temp.mjs";
import { comparePaths } from "./lib/paths.mjs";
import { inspectCompletePng } from "../shared/scripts/lib/complete-png-validation.mjs";

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

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function assertContactRecord(record, expectedHtml, expectedReadDigests) {
  if (record === null || typeof record !== "object" || Array.isArray(record)) throw new Error("contact sheet record must be an object");
  const keys = ["html", "html_sha256", "png", "png_sha256", "width", "height", "source_read_sha256"];
  if (Object.keys(record).sort(comparePaths).join("|") !== keys.sort(comparePaths).join("|")) throw new Error("contact sheet record has invalid fields");
  if (record.html !== expectedHtml || record.png !== expectedHtml.replace(/\.html$/u, ".png")) throw new Error(`contact sheet record does not match ${expectedHtml}`);
  for (const field of ["html_sha256", "png_sha256"]) if (!/^[0-9a-f]{64}$/u.test(record[field])) throw new Error(`contact sheet ${field} is invalid`);
  if (!Number.isInteger(record.width) || !Number.isInteger(record.height) || record.width < 1 || record.height < 1) throw new Error("contact sheet dimensions are invalid");
  if (!Array.isArray(record.source_read_sha256) || record.source_read_sha256.length === 0 || record.source_read_sha256.some((digest) => !/^[0-9a-f]{64}$/u.test(digest))) throw new Error("contact sheet source READ digests are invalid");
  if (JSON.stringify([...new Set(record.source_read_sha256)].sort(comparePaths)) !== JSON.stringify([...expectedReadDigests].sort(comparePaths))) throw new Error(`contact sheet source READ digest binding is stale: ${expectedHtml}`);
}

async function assertExactOutput(directory, sheets, qa) {
  const actual = (await readdir(directory)).sort(comparePaths);
  if (!qa || !Array.isArray(qa.contact_sheets)) throw new Error("contact sheet evidence records are required");
  const records = qa.contact_sheets;
  const recordByHtml = new Map(records.map((record) => [record?.html, record]));
  if (records.length !== sheets.size || recordByHtml.size !== sheets.size) throw new Error("contact sheet evidence set is stale or incomplete");
  for (const record of records) {
    if (!sheets.has(record?.html)) throw new Error(`contact sheet record does not match generated sheet: ${record?.html}`);
  }
  const expected = [...sheets.keys(), ...records.map((record) => record?.png)].sort(comparePaths);
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error("contact sheet output set is stale or incomplete");
  for (const [name, expectedBytes] of sheets) {
    const filename = path.join(directory, name);
    const stats = await lstat(filename);
    if (!stats.isFile() || stats.isSymbolicLink()) throw new Error(`contact sheet output is unsafe: ${name}`);
    const actualBytes = await readFile(filename, "utf8");
    if (actualBytes !== expectedBytes) throw new Error(`contact sheet bytes are stale: ${name}`);
    const record = recordByHtml.get(name);
    if (!record) throw new Error(`missing contact sheet record: ${name}`);
    const expectedReadDigests = qa.entries.filter((entry) => expectedBytes.includes(`../${entry.renders.read.path}`)).map((entry) => entry.renders.read.sha256);
    assertContactRecord(record, name, expectedReadDigests);
    if (sha256(Buffer.from(actualBytes, "utf8")) !== record.html_sha256) throw new Error(`contact sheet HTML digest is stale: ${name}`);
    const pngPath = path.join(directory, record.png);
    const pngStats = await lstat(pngPath).catch((error) => error?.code === "ENOENT" ? null : Promise.reject(error));
    if (!pngStats) throw new Error(`missing contact sheet PNG: ${record.png}`);
    if (!pngStats.isFile() || pngStats.isSymbolicLink()) throw new Error(`contact sheet PNG is unsafe: ${record.png}`);
    const png = await readFile(pngPath);
    const inspection = inspectCompletePng(png);
    if (!inspection.ok) throw new Error(`contact sheet PNG validation failed: ${record.png}`);
    if (sha256(png) !== record.png_sha256) throw new Error(`contact sheet PNG digest is stale: ${record.png}`);
    if (inspection.width !== record.width || inspection.height !== record.height) throw new Error(`contact sheet PNG dimensions are stale: ${record.png}`);
  }
}

async function assertGeneratedHtmlOutput(directory, sheets) {
  const actual = (await readdir(directory)).sort(comparePaths);
  const expected = [...sheets.keys()].sort(comparePaths);
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error("contact sheet output set is stale or incomplete");
  for (const [name, expectedBytes] of sheets) {
    const filename = path.join(directory, name);
    const stats = await lstat(filename);
    if (!stats.isFile() || stats.isSymbolicLink()) throw new Error(`contact sheet output is unsafe: ${name}`);
    if (await readFile(filename, "utf8") !== expectedBytes) throw new Error(`contact sheet bytes are stale: ${name}`);
  }
}

async function writeExactOutput(directory, sheets) {
  await mkdir(directory);
  for (const [name, bytes] of sheets) await writeFile(path.join(directory, name), bytes, "utf8");
  await assertGeneratedHtmlOutput(directory, sheets);
}

export async function buildArchifyContactSheets({ repoRoot, check = false, __testHooks = {} } = {}) {
  const { catalog, qa } = await loadArchifyVisualQa({ repoRoot });
  const sheets = renderArchifyContactSheets({ catalog, qa });
  const directory = path.join(repoRoot, OUTPUT_ROOT);
  if (check) {
    await assertDirectoryPath(repoRoot, OUTPUT_ROOT, { create: false });
    await assertExactOutput(directory, sheets, qa);
    return { checked: true, outputs: [...sheets.keys()].sort(comparePaths) };
  }
  const parent = await assertDirectoryPath(repoRoot, path.posix.dirname(OUTPUT_ROOT), { create: true });
  const temporary = await createGuardedTempRoot({ parent, prefix: "contact-sheet-" });
  const candidate = path.join(temporary.root, "contact-sheets");
  const backup = path.join(parent, `.contact-sheets-backup-${randomUUID()}`);
  let movedOld = false;
  let movedNew = false;
  try {
    await writeExactOutput(candidate, sheets);
    const existing = await lstat(directory).catch((error) => error?.code === "ENOENT" ? null : Promise.reject(error));
    if (existing) {
      if (!existing.isDirectory() || existing.isSymbolicLink()) throw new Error("contact sheet output directory is unsafe");
      await rename(directory, backup); movedOld = true;
    }
    await __testHooks.beforePublish?.({ candidate, directory, backup });
    await rename(candidate, directory); movedNew = true;
    await assertGeneratedHtmlOutput(directory, sheets);
    await __testHooks.afterPublish?.({ directory, backup });
    await assertGeneratedHtmlOutput(directory, sheets);
    if (movedOld) {
      try { await __testHooks.beforeBackupCleanup?.({ directory, backup }); await rm(backup, { recursive: true }); }
      catch (cleanup) { throw new AggregateError([cleanup], `contact sheet committed but backup cleanup failed: ${cleanup.message}`); }
    }
    return { built: true, outputs: [...sheets.keys()].sort(comparePaths) };
  } catch (error) {
    if (error instanceof AggregateError && String(error.message).includes("backup cleanup failed")) throw error;
    const rollback = [];
    if (movedNew) try { await rename(directory, candidate); } catch (rollbackError) { rollback.push(rollbackError); }
    if (movedOld) try { await rename(backup, directory); } catch (rollbackError) { rollback.push(rollbackError); }
    if (rollback.length > 0) throw new AggregateError([error, ...rollback], `contact sheet publish and rollback failed; forensic paths: ${directory}, ${backup}`);
    throw error;
  } finally {
    await cleanupGuardedTempRoot(temporary);
  }
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
