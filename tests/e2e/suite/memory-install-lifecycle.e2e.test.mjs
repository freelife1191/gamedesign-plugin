import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmod, lstat, mkdir, mkdtemp, readFile, readdir, rm, utimes, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { collectTree } from "../../../tooling/lib/copy-tree.mjs";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const marketplace = "game-design-suite";
const products = ["game-design-career", "game-design-studio"];
const memorySkills = [
  "capture-game-design-memory",
  "maintain-game-design-memory",
  "retrieve-approved-design-memory",
];

async function fileIdentity(filename) {
  const [bytes, stats] = await Promise.all([readFile(filename), lstat(filename)]);
  return { bytes, mode: stats.mode, mtimeMs: stats.mtimeMs };
}

async function assertSameIdentity(filename, expected, label) {
  assert.deepEqual(await fileIdentity(filename), expected, label);
}

function localCodex() {
  const probe = spawnSync("which", ["codex"], { encoding: "utf8" });
  assert.equal(probe.status, 0, "local Codex CLI is required for the lifecycle E2E");
  const executable = probe.stdout.trim();
  assert.ok(executable, "local Codex CLI path is non-empty");
  return executable;
}

function isolatedEnvironment(root) {
  return {
    HOME: path.join(root, "home"),
    CODEX_HOME: path.join(root, "codex-home"),
    TMPDIR: path.join(root, "tmp"),
    PATH: process.env.PATH ?? "",
  };
}

function runLocalPluginCommand({ codex, args, env, evidence, stage }) {
  assert.equal(args.includes("exec"), false, `${stage}: lifecycle must not run codex exec`);
  const result = spawnSync(codex, ["plugin", ...args, "--json"], {
    cwd: repoRoot,
    env,
    encoding: "utf8",
    timeout: 30_000,
  });
  assert.equal(result.error, undefined, `${stage}: CLI launch error`);
  assert.equal(result.signal, null, `${stage}: CLI must not time out`);
  assert.equal(result.status, 0, `${stage}: ${result.stderr}`);
  let json;
  try {
    json = JSON.parse(result.stdout);
  } catch (error) {
    assert.fail(`${stage}: invalid CLI JSON: ${error.message}`);
  }
  evidence.push({ stage, args, exitCode: result.status, json });
  return json;
}

async function assertMemoryPackage(pluginRoot, product) {
  for (const skill of memorySkills) await lstat(path.join(pluginRoot, "skills", skill, "SKILL.md"));
  for (const required of [
    "references/shared/memory/schema/memory-config.schema.json",
    "references/shared/memory/schema/memory-event.schema.json",
    "references/shared/memory/schema/memory-index.schema.json",
    "references/shared/memory/schema/memory-receipt.schema.json",
    "references/shared/memory/schema/memory-record.schema.json",
    "references/shared/memory/references/memory-policy.md",
    "references/shared/memory/references/memory-lifecycle.md",
    "scripts/load-memory-config.mjs",
    "scripts/capture-design-memory.mjs",
    "scripts/maintain-design-memory.mjs",
    "scripts/retrieve-design-memory.mjs",
    "scripts/validate-design-memory.mjs",
  ]) await lstat(path.join(pluginRoot, required));

  const files = (await collectTree(pluginRoot, { label: `${product} installed plugin` })).map(({ relativePath }) => relativePath);
  assert.equal(files.some((file) => path.basename(file) === ".env"), false, `${product}: actual .env must not be packaged`);
  assert.equal(files.some((file) => file.startsWith("references/shared/memory/v1/") || file.includes("/derived/")), false, `${product}: local memory data must not be packaged`);
  const skills = (await readdir(path.join(pluginRoot, "skills"), { withFileTypes: true })).filter((entry) => entry.isDirectory());
  assert.equal(skills.length, 21, `${product}: cache exposes exactly 21 skills`);
}

test("local Codex CLI install, re-add, and removal preserve project memory and local Git exclusion", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "memory-install-lifecycle-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const codex = localCodex();

  for (const product of products) {
    await t.test(product, async () => {
      const productRoot = path.join(root, product);
      const workspace = path.join(productRoot, "workspace");
      const env = isolatedEnvironment(productRoot);
      const memoryFile = path.join(workspace, ".game-design", "memory", "v1", "events", "aa", "memory-sentinel", `mev1-${"a".repeat(64)}.md`);
      const excludeFile = path.join(workspace, ".git", "info", "exclude");
      const siblingFile = path.join(env.CODEX_HOME, "plugins", "unrelated-plugin", "sentinel.txt");
      await Promise.all([mkdir(path.dirname(memoryFile), { recursive: true }), mkdir(path.dirname(excludeFile), { recursive: true }), mkdir(path.dirname(siblingFile), { recursive: true }), mkdir(env.HOME, { recursive: true }), mkdir(env.TMPDIR, { recursive: true })]);
      await writeFile(memoryFile, "local-memory-must-survive\n");
      await writeFile(excludeFile, "existing local exclusion\n.game-design/memory/\n");
      await writeFile(siblingFile, "sibling plugin survives\n");
      await chmod(memoryFile, 0o640);
      await chmod(excludeFile, 0o600);
      const timestamp = new Date("2026-08-12T00:00:00.000Z");
      await Promise.all([utimes(memoryFile, timestamp, timestamp), utimes(excludeFile, timestamp, timestamp)]);
      const before = await Promise.all([fileIdentity(memoryFile), fileIdentity(excludeFile), fileIdentity(siblingFile)]);
      const evidence = [];
      const assertPreserved = async (stage) => {
        await assertSameIdentity(memoryFile, before[0], `${product}:${stage}: workspace memory`);
        await assertSameIdentity(excludeFile, before[1], `${product}:${stage}: .git/info/exclude`);
        await assertSameIdentity(siblingFile, before[2], `${product}:${stage}: sibling plugin`);
      };

      const market = runLocalPluginCommand({ codex, env, evidence, stage: "marketplace-add", args: ["marketplace", "add", repoRoot] });
      assert.equal(market.marketplaceName, marketplace, `${product}: exact local marketplace name`);
      assert.equal(market.installedRoot, path.resolve(repoRoot), `${product}: marketplace points to the local repository`);
      await assertPreserved("marketplace-add");

      const selector = `${product}@${marketplace}`;
      const installed = runLocalPluginCommand({ codex, env, evidence, stage: "plugin-add", args: ["add", selector] });
      assert.equal(installed.pluginId, selector, `${product}: add receipt binds exact plugin`);
      assert.equal(installed.marketplaceName, marketplace, `${product}: add receipt binds local marketplace`);
      const cacheRoot = path.join(env.CODEX_HOME, "plugins", "cache", marketplace, product, "0.1.0");
      await assertMemoryPackage(cacheRoot, product);
      await assertPreserved("plugin-add");

      const listed = runLocalPluginCommand({ codex, env, evidence, stage: "plugin-list-initial", args: ["list"] });
      assert.ok(listed.installed.some((entry) => entry.pluginId === selector), `${product}: list exposes installed plugin`);
      await assertPreserved("plugin-list-initial");

      const removed = runLocalPluginCommand({ codex, env, evidence, stage: "plugin-remove-for-update", args: ["remove", selector] });
      assert.equal(removed.pluginId, selector, `${product}: remove receipt binds exact plugin`);
      await assert.rejects(lstat(cacheRoot), { code: "ENOENT" }, `${product}: removal removes only its cache`);
      await assertPreserved("plugin-remove-for-update");

      const readded = runLocalPluginCommand({ codex, env, evidence, stage: "plugin-readd", args: ["add", selector] });
      assert.equal(readded.pluginId, selector, `${product}: re-add receipt binds exact plugin`);
      await assertMemoryPackage(cacheRoot, product);
      await assertPreserved("plugin-readd");

      runLocalPluginCommand({ codex, env, evidence, stage: "plugin-remove-final", args: ["remove", selector] });
      await assert.rejects(lstat(cacheRoot), { code: "ENOENT" }, `${product}: final removal removes cache`);
      await assertPreserved("plugin-remove-final");

      const marketRemoved = runLocalPluginCommand({ codex, env, evidence, stage: "marketplace-remove", args: ["marketplace", "remove", marketplace] });
      assert.equal(marketRemoved.marketplaceName, marketplace, `${product}: marketplace removal receipt binds exact name`);
      const finalList = runLocalPluginCommand({ codex, env, evidence, stage: "marketplace-list-final", args: ["marketplace", "list"] });
      assert.deepEqual(finalList.marketplaces, [], `${product}: isolated marketplace list is empty after removal`);
      await assertPreserved("marketplace-remove");

      const evidencePath = path.join(productRoot, "local-cli-lifecycle-evidence.json");
      await writeFile(evidencePath, JSON.stringify({ network: "none", commands: evidence }, null, 2) + "\n");
      const persisted = JSON.parse(await readFile(evidencePath, "utf8"));
      assert.deepEqual(persisted.commands, evidence, `${product}: command receipts survive evidence serialization`);
      assert.equal(evidence.every((entry) => entry.exitCode === 0 && !entry.args.includes("exec")), true, `${product}: every lifecycle command is local plugin CLI only`);
    });
  }
});
