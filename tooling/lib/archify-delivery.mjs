import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { lstat, mkdir, readFile, readdir, realpath, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { resolveArchifyInstallation } from "../../shared/scripts/capability-probe.mjs";
import { loadArchifyCatalog, publishableArchifyEntries } from "./archify-catalog.mjs";
import { toPersistedArchifyReceipt, validateArchifyDeliverReceipt, validateArchifyValidateReceipt } from "./archify-receipt.mjs";
import { createGuardedTempRoot, cleanupGuardedTempRoot } from "./guarded-temp.mjs";
import { sha256 } from "./hash.mjs";
import { comparePaths, joinWithin } from "./paths.mjs";

const STAGE_PARENT = ".tmp";
const STAGE_CURRENT = ".tmp/curated-archify/current";
const QA_MANIFEST = "guides/archify-diagrams/visual-qa/manifest.json";

function identity(stats) {
  return { dev: stats.dev, ino: stats.ino };
}

function sameIdentity(left, right) {
  return left.dev === right.dev && left.ino === right.ino;
}

function isContained(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

async function safeDirectory(directory, label, { create = false, root } = {}) {
  if (create) await mkdir(directory, { recursive: true, mode: 0o700 });
  const stats = await lstat(directory);
  if (!stats.isDirectory() || stats.isSymbolicLink()) throw new Error(`${label} must be a non-symlink directory`);
  const canonical = await realpath(directory);
  if (root && !isContained(root, canonical)) throw new Error(`${label} escapes repository`);
  return Object.freeze({ path: canonical, identity: identity(stats), label });
}

async function assertDirectory(record) {
  const stats = await lstat(record.path);
  if (!stats.isDirectory() || stats.isSymbolicLink() || !sameIdentity(identity(stats), record.identity) || await realpath(record.path) !== record.path) {
    throw new Error(`${record.label} identity changed`);
  }
}

async function safeRegular(filename, label) {
  const stats = await lstat(filename).catch((error) => error.code === "ENOENT" ? null : Promise.reject(error));
  if (!stats || !stats.isFile() || stats.isSymbolicLink()) throw new Error(`${label} must be a regular file`);
  return stats;
}

async function assertRepoRoot(repoRoot) {
  const absolute = path.resolve(repoRoot);
  const stats = await lstat(absolute);
  if (!stats.isDirectory() || stats.isSymbolicLink()) throw new Error("repository root must be a non-symlink directory");
  const canonical = await realpath(absolute);
  return safeDirectory(canonical, "repository root", { root: canonical });
}

function selectedEntries(catalog, { ids = [], product = null, publishable = false } = {}) {
  if (!Array.isArray(ids) || ids.some((id) => typeof id !== "string" || id.length === 0)) throw new Error("ids must be non-empty strings");
  if (product !== null && !["studio", "career", "suite"].includes(product)) throw new Error("product must be studio, career, or suite");
  const allowed = new Set(ids);
  const entries = (publishable ? publishableArchifyEntries(catalog) : catalog.entries.filter((entry) => entry.decision === "selected"))
    .filter((entry) => (allowed.size === 0 || allowed.has(entry.id)) && (product === null || entry.product === product));
  if (allowed.size > 0 && entries.length !== allowed.size) throw new Error("requested Archify id is not selected for this operation");
  return entries.sort((left, right) => comparePaths(left.id, right.id));
}

async function readCommittedSpec(repoRoot, entry) {
  const filename = joinWithin(repoRoot, entry.spec, "committed Archify spec");
  const stats = await lstat(filename).catch((error) => error.code === "ENOENT" ? null : Promise.reject(error));
  if (!stats) throw new Error(`missing committed Archify spec: ${entry.spec}`);
  if (!stats.isFile() || stats.isSymbolicLink()) throw new Error(`committed Archify spec must be a regular file: ${entry.spec}`);
  const bytes = await readFile(filename);
  // Parsing proves this is an authored JSON source; its topology is deliberately opaque here.
  try { JSON.parse(bytes.toString("utf8")); } catch { throw new Error(`committed Archify spec is invalid JSON: ${entry.spec}`); }
  return Object.freeze({ path: filename, bytes, sha256: sha256(bytes), size: bytes.byteLength });
}

async function pinArchifyCli({ env, archifyOptions }) {
  const installation = await resolveArchifyInstallation(env, archifyOptions);
  if (installation.status !== "available") throw new Error(`Archify CLI is ${installation.status}`);
  return installation.cli;
}

async function assertPinnedArchifyCli(cli) {
  const [stats, canonical, bytes] = await Promise.all([
    lstat(cli.path, { bigint: true }), realpath(cli.path), readFile(cli.path),
  ]);
  if (!stats.isFile() || stats.isSymbolicLink() || canonical !== cli.realpath || stats.dev !== cli.dev || stats.ino !== cli.ino
    || stats.size !== cli.size || sha256(bytes) !== cli.sha256) throw new Error("Archify CLI identity changed");
}

async function runArchify(cli, args) {
  await assertPinnedArchifyCli(cli);
  const result = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cli.path, ...args], { shell: false, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("close", (code, signal) => resolve({ code, signal, stdout, stderr }));
  });
  await assertPinnedArchifyCli(cli);
  if (result.code !== 0 || result.signal) throw new Error(`Archify ${args[0]} failed: ${result.stderr || result.signal || result.code}`);
  try { return JSON.parse(result.stdout); } catch { throw new Error(`Archify ${args[0]} emitted invalid JSON`); }
}

function outputRelative(entry, field) {
  const prefix = "guides/assets/archify/";
  const source = entry[field];
  if (!source.startsWith(prefix)) throw new Error(`invalid managed ${field} path`);
  return source.slice(prefix.length);
}

async function invoke(hooks, name, context) {
  await hooks?.[name]?.(context);
}

async function deliverEntry({ cli, temp, entry, spec, hooks }) {
  const workflow = await safeDirectory(path.join(temp.root, "workflow"), "delivery workflow", { create: true, root: temp.root });
  const html = path.join(workflow.path, `${entry.id}.html`);
  await assertDirectory(workflow);
  const validation = validateArchifyValidateReceipt(await runArchify(cli, ["validate", entry.diagram_type, spec.path, "--quality", "showcase", "--json"]));
  await invoke(hooks, "after-validate", { cli: cli.path, entry, stage: workflow.path });
  await invoke(hooks, "replace-cli-after-validate", { cli: cli.path, entry, stage: workflow.path });
  await assertDirectory(workflow);
  await invoke(hooks, "before-deliver", { cli: cli.path, entry, stage: workflow.path, html });
  await invoke(hooks, "swap-stage-parent-and-restore", { cli: cli.path, entry, stage: workflow.path, html });
  await assertDirectory(workflow);
  const deliver = await runArchify(cli, ["deliver", entry.diagram_type, spec.path, html, "--quality", "showcase", "--json"]);
  await invoke(hooks, "after-deliver", { cli: cli.path, entry, stage: workflow.path, html });
  await invoke(hooks, "symlink-delivered-html", { cli: cli.path, entry, stage: workflow.path, html });
  await invoke(hooks, "nondeterministic-deliver", { cli: cli.path, entry, stage: workflow.path, html });
  await assertDirectory(workflow);
  await safeRegular(html, "delivered Archify HTML");
  const artifact = await readFile(html);
  validateArchifyDeliverReceipt(deliver, { specification: spec.bytes, artifact });
  const stablePaths = { input: entry.spec, output: entry.html };
  const receipt = toPersistedArchifyReceipt(deliver, stablePaths, { specification: spec.bytes, artifact });
  return Object.freeze({ entry, spec, validation, artifact, receipt });
}

async function createTemporaryRoot(repoRoot) {
  const tmp = await safeDirectory(path.join(repoRoot, STAGE_PARENT), ".tmp", { create: true, root: repoRoot });
  await assertDirectory(tmp);
  return createGuardedTempRoot({ parent: tmp.path, prefix: "curated-archify-" });
}

async function writeRecords(root, records) {
  const expected = [];
  for (const record of records) {
    const html = outputRelative(record.entry, "html");
    const receipt = outputRelative(record.entry, "receipt");
    expected.push(html, receipt);
    await mkdir(path.dirname(path.join(root, html)), { recursive: true, mode: 0o700 });
    await writeFile(path.join(root, html), record.artifact, { flag: "wx" });
    await writeFile(path.join(root, receipt), `${JSON.stringify(record.receipt, null, 2)}\n`, { flag: "wx" });
  }
  return expected.sort(comparePaths);
}

async function removeSafeTree(directory) {
  const stats = await lstat(directory).catch((error) => error.code === "ENOENT" ? null : Promise.reject(error));
  if (!stats) return;
  if (!stats.isDirectory() || stats.isSymbolicLink()) throw new Error(`managed tree is unsafe: ${directory}`);
  await rm(directory, { recursive: true });
}

async function commitStageCandidate({ repoRoot, temp, records, hooks }) {
  const stage = path.join(temp.root, "candidate");
  await mkdir(stage, { mode: 0o700 });
  const expected = await writeRecords(stage, records);
  const parent = await safeDirectory(path.join(repoRoot, ".tmp/curated-archify"), "curated stage parent", { create: true, root: repoRoot });
  const current = path.join(parent.path, "current");
  const backup = path.join(parent.path, `.current-backup-${randomUUID()}`);
  const existing = await lstat(current).catch((error) => error.code === "ENOENT" ? null : Promise.reject(error));
  if (existing) {
    if (!existing.isDirectory() || existing.isSymbolicLink()) throw new Error("current stage is unsafe");
    await rename(current, backup);
  }
  try {
    await assertDirectory(parent);
    await rename(stage, current);
    await invoke(hooks, "after-stage-commit", { current });
    if (existing) await removeSafeTree(backup);
  } catch (error) {
    const failures = [error];
    try {
      const currentStats = await lstat(current).catch(() => null);
      if (currentStats) await rename(current, stage);
      if (existing) await rename(backup, current);
    } catch (rollback) { failures.push(rollback); }
    if (failures.length > 1) throw new AggregateError(failures, "staging commit and rollback failed");
    throw error;
  }
  return Object.freeze({ root: current, expected });
}

async function produce({ repoRoot, ids, product, env, archifyOptions, hooks, publishable = false }) {
  const root = await assertRepoRoot(repoRoot);
  const catalog = await loadArchifyCatalog({ repoRoot: root.path });
  const entries = selectedEntries(catalog, { ids, product, publishable });
  if (entries.length === 0) throw new Error("no Archify entries selected");
  const cli = await pinArchifyCli({ env, archifyOptions });
  const temp = await createTemporaryRoot(root.path);
  try {
    const records = [];
    for (const entry of entries) {
      const spec = await readCommittedSpec(root.path, entry);
      const record = await deliverEntry({ cli, temp, entry, spec, hooks });
      records.push(record);
    }
    return { root: root.path, catalog, entries, records, temp };
  } catch (error) {
    try { await cleanupGuardedTempRoot(temp); } catch (cleanup) { throw new AggregateError([error, cleanup], "Archify delivery and temporary cleanup failed"); }
    throw error;
  }
}

export async function stageCuratedArchify({ repoRoot, ids = [], product = null, env = process.env, archifyOptions = {}, __testHooks } = {}) {
  const produced = await produce({ repoRoot, ids, product, env, archifyOptions, hooks: __testHooks });
  try {
    const staged = await commitStageCandidate({ repoRoot: produced.root, temp: produced.temp, records: produced.records, hooks: __testHooks });
    return { staged: staged.root, entries: produced.records.map((record) => record.entry.id) };
  } finally {
    await cleanupGuardedTempRoot(produced.temp).catch((error) => { throw new AggregateError([error], "staging temporary cleanup failed"); });
  }
}

async function listFiles(root, prefix = "") {
  const entries = await readdir(root, { withFileTypes: true });
  const output = [];
  for (const entry of entries.sort((a, b) => comparePaths(a.name, b.name))) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    const target = path.join(root, entry.name);
    const stats = await lstat(target);
    if (stats.isSymbolicLink()) throw new Error(`managed output contains a symlink: ${relative}`);
    if (stats.isDirectory()) output.push(...await listFiles(target, relative));
    else if (stats.isFile()) output.push(relative);
    else throw new Error(`managed output has unsupported entry: ${relative}`);
  }
  return output;
}

async function compareManagedTree(root, records) {
  const expected = [];
  for (const record of records) expected.push(outputRelative(record.entry, "html"), outputRelative(record.entry, "receipt"));
  expected.sort(comparePaths);
  const actual = await listFiles(root);
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error("managed output exact set is stale or incomplete");
  for (const record of records) {
    const [html, receipt] = await Promise.all([
      readFile(path.join(root, outputRelative(record.entry, "html"))),
      readFile(path.join(root, outputRelative(record.entry, "receipt"))),
    ]);
    if (!html.equals(record.artifact) || !receipt.equals(Buffer.from(`${JSON.stringify(record.receipt, null, 2)}\n`))) {
      throw new Error(`managed output bytes drift: ${record.entry.id}`);
    }
  }
}

export async function checkCuratedArchify({ repoRoot, ids = [], product = null, env = process.env, archifyOptions = {}, __testHooks } = {}) {
  const produced = await produce({ repoRoot, ids, product, env, archifyOptions, hooks: __testHooks });
  try {
    const stage = path.join(produced.root, STAGE_CURRENT);
    await safeDirectory(stage, "curated stage", { root: produced.root });
    await compareManagedTree(stage, produced.records);
    const published = publishableArchifyEntries(produced.catalog);
    await loadQaBindings(produced.root, produced.records.filter((record) => published.some((entry) => entry.id === record.entry.id)));
    if (published.length > 0) await compareManagedTree(path.join(produced.root, "guides/assets/archify"), produced.records.filter((record) => published.some((entry) => entry.id === record.entry.id)));
    return { checked: true, entries: produced.records.map((record) => record.entry.id) };
  } finally {
    await cleanupGuardedTempRoot(produced.temp);
  }
}

async function loadQaBindings(repoRoot, records) {
  if (records.length === 0) return;
  const manifestPath = joinWithin(repoRoot, QA_MANIFEST, "visual QA manifest");
  await safeRegular(manifestPath, "visual QA manifest").catch(() => { throw new Error("visual QA manifest is required for publication"); });
  const bytes = await readFile(manifestPath);
  let manifest;
  try { manifest = JSON.parse(bytes); } catch { throw new Error("visual QA manifest is invalid JSON"); }
  if (manifest?.schema_version !== 1 && manifest?.schemaVersion !== 1) throw new Error("visual QA manifest schema version is invalid");
  const rows = Array.isArray(manifest.entries) ? manifest.entries : [];
  for (const record of records) {
    const row = rows.find((candidate) => candidate?.id === record.entry.id);
    if (!row || row.reviewer !== record.entry.reviewer || row.specification_sha256 !== record.spec.sha256 || row.artifact_sha256 !== sha256(record.artifact)) {
      throw new Error(`visual QA binding does not match: ${record.entry.id}`);
    }
  }
}

async function publishTree({ repoRoot, records, temp, hooks }) {
  const candidate = path.join(temp.root, "publish");
  await mkdir(candidate, { mode: 0o700 });
  await writeRecords(candidate, records);
  const assets = await safeDirectory(path.join(repoRoot, "guides/assets"), "assets parent", { create: true, root: repoRoot });
  const target = path.join(assets.path, "archify");
  const backup = path.join(assets.path, `.curated-archify-backup-${randomUUID()}`);
  const original = await lstat(target).catch((error) => error.code === "ENOENT" ? null : Promise.reject(error));
  if (original && (!original.isDirectory() || original.isSymbolicLink())) throw new Error("managed publish target is unsafe");
  let backedUp = false;
  let published = false;
  try {
    if (original) {
      await invoke(hooks, "before-backup-rename", { target, backup });
      await invoke(hooks, "fail-backup-rename", { target, backup });
      await rename(target, backup); backedUp = true;
    }
    await invoke(hooks, "before-publish-rename", { target, candidate });
    await invoke(hooks, "fail-without-prior-output", { target, candidate });
    await invoke(hooks, "fail-publish-rename", { target, candidate });
    await assertDirectory(assets);
    await rename(candidate, target); published = true;
    await compareManagedTree(target, records);
    await invoke(hooks, "after-publish-verification", { target });
    await invoke(hooks, "rollback-without-private-siblings", { target });
    await invoke(hooks, "fail-post-publish-verification", { target });
  } catch (error) {
    const rollbackErrors = [];
    try {
      if (published) await rename(target, candidate);
      if (backedUp) {
        await invoke(hooks, "before-rollback-restore", { target, backup });
        await invoke(hooks, "fail-rollback-restore", { target, backup });
        await rename(backup, target);
      }
    } catch (rollback) { rollbackErrors.push(rollback); }
    if (rollbackErrors.length) throw new AggregateError([error, ...rollbackErrors], "publication failed and rollback failed");
    throw error;
  }
  try {
    if (backedUp) {
      await invoke(hooks, "before-backup-cleanup", { backup });
      await invoke(hooks, "partially-fail-backup-cleanup", { backup });
      await removeSafeTree(backup);
    }
    await invoke(hooks, "before-temp-cleanup", { candidate });
    await invoke(hooks, "fail-temp-cleanup", { candidate });
  } catch (cleanup) {
    throw new AggregateError([cleanup], "published Archify tree but cleanup failed");
  }
}

export async function publishCuratedArchify({ repoRoot, ids = [], product = null, env = process.env, archifyOptions = {}, __testHooks } = {}) {
  const produced = await produce({ repoRoot, ids, product, env, archifyOptions, hooks: __testHooks, publishable: true });
  try {
    const allPassed = publishableArchifyEntries(produced.catalog);
    if (produced.records.length !== allPassed.length) throw new Error("publish must include the complete passed Archify set");
    await loadQaBindings(produced.root, produced.records);
    await publishTree({ repoRoot: produced.root, records: produced.records, temp: produced.temp, hooks: __testHooks });
    return { published: true, entries: produced.records.map((record) => record.entry.id) };
  } finally {
    await cleanupGuardedTempRoot(produced.temp).catch((error) => { throw new AggregateError([error], "publication temporary cleanup failed"); });
  }
}
