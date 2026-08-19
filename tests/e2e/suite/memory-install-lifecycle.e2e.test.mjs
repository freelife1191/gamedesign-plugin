import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmod, cp, lstat, mkdir, mkdtemp, readFile, readdir, readlink, rm, symlink, utimes, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { collectTree } from "../../../tooling/lib/copy-tree.mjs";
import { buildProduct } from "../../../tooling/lib/build-product.mjs";
import { inspectPluginUpdates } from "../../../shared/scripts/inspect-game-design-plugin-updates.mjs";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const marketplace = "game-design-suite";
const products = ["game-design-career", "game-design-studio"];
const memorySkills = [
  "capture-game-design-memory",
  "maintain-game-design-memory",
  "retrieve-approved-design-memory",
];
// One source for the packaged skill inventory. This used to be the same ternary written at five call
// sites, which is how it went stale when each product gained an entry skill. Accepts either a bare
// product name or a stage label that contains one.
const packagedSkillCounts = Object.freeze({ "game-design-career": 25, "game-design-studio": 26 });
// The release moves the packaged version, and a cache path written from a literal points at a directory
// the install never created. `availableVersion` is the synthetic one-patch bump these tests hand the
// marketplace snapshot so a comparison has something to compare against.
const builtVersion = JSON.parse(await readFile(path.join(repoRoot, "products/game-design-studio/plugin/.codex-plugin/plugin.json"), "utf8")).version;
const availableVersion = builtVersion.replace(/(\d+)$/u, (patch) => String(Number(patch) + 1));
function packagedSkillCount(product) {
  return product.includes("studio") ? packagedSkillCounts["game-design-studio"] : packagedSkillCounts["game-design-career"];
}
const referenceSkills = ["analyze-game-design-references", "maintain-game-design-glossary"];
const referenceFiles = [
  "references/shared/reference-intelligence/schema/game-design-glossary.schema.json",
  "references/shared/reference-intelligence/schema/glossary-receipt.schema.json",
  "references/shared/reference-intelligence/schema/reference-analysis.schema.json",
  "references/shared/reference-intelligence/catalog/system-atlas.json",
  "references/shared/reference-intelligence/catalog/source-register.json",
  "references/shared/reference-intelligence/references/evidence-policy.md",
  "references/shared/reference-intelligence/templates/reference-set.yml",
];

async function fileIdentity(filename) {
  const [bytes, stats] = await Promise.all([readFile(filename), lstat(filename)]);
  return { bytes, mode: stats.mode, mtimeMs: stats.mtimeMs };
}

async function assertSameIdentity(filename, expected, label) {
  assert.deepEqual(await fileIdentity(filename), expected, label);
}

async function treeIdentity(root) {
  async function visit(relativePath) {
    const filename = path.join(root, relativePath);
    const stats = await lstat(filename);
    const entry = {
      relativePath,
      type: stats.isDirectory() ? "directory" : stats.isFile() ? "file" : stats.isSymbolicLink() ? "symlink" : "other",
      mode: stats.mode,
      mtimeMs: stats.mtimeMs,
    };
    if (stats.isFile()) entry.bytes = await readFile(filename);
    if (stats.isSymbolicLink()) entry.link = await readlink(filename);
    if (!stats.isDirectory()) return [entry];
    const children = await readdir(filename);
    const nested = await Promise.all(children.sort().map((child) => visit(path.join(relativePath, child))));
    return [entry, ...nested.flat()];
  }
  return visit(".");
}

async function assertIsolatedTreesPreserved(before, { workspace, home, codexHome, cacheRoot }, stage) {
  const actual = await Promise.all([treeIdentity(workspace), treeIdentity(home), treeIdentity(codexHome), treeIdentity(cacheRoot)]);
  for (const [index, label] of ["workspace", "HOME", "CODEX_HOME", "plugin cache"].entries()) {
    assert.deepEqual(actual[index], before[index], `${stage}: ${label}`);
  }
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
    HTTP_PROXY: "http://127.0.0.1:9",
    HTTPS_PROXY: "http://127.0.0.1:9",
    ALL_PROXY: "http://127.0.0.1:9",
    NO_PROXY: "",
  };
}

function hasExternalUrl(value) {
  if (typeof value === "string") return /https?:\/\//iu.test(value);
  if (Array.isArray(value)) return value.some(hasExternalUrl);
  if (value !== null && typeof value === "object") return Object.values(value).some(hasExternalUrl);
  return false;
}

function runLocalPluginCommand({ codex, cwd, args, env, evidence, stage }) {
  assert.equal(args.includes("exec"), false, `${stage}: lifecycle must not run codex exec`);
  assert.equal(hasExternalUrl(args), false, `${stage}: local marketplace input must not contain an external URL`);
  const result = spawnSync(codex, ["plugin", ...args, "--json"], {
    cwd,
    env,
    encoding: "utf8",
    shell: false,
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
  assert.equal(hasExternalUrl(json), false, `${stage}: command receipt must not contain an external URL`);
  evidence.push({ stage, cwd: path.resolve(cwd), args, exitCode: result.status, json });
  return json;
}

async function assertMemoryPackage(pluginRoot, product, { expectedSkillCount = packagedSkillCount(product), requireReferenceIntelligence = false } = {}) {
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
  assert.equal(skills.length, expectedSkillCount, `${product}: cache exposes exactly ${expectedSkillCount} skills`);
  if (requireReferenceIntelligence) {
    for (const skill of referenceSkills) await lstat(path.join(pluginRoot, "skills", skill, "SKILL.md"));
    for (const relativePath of referenceFiles) {
      assert.deepEqual(
        await readFile(path.join(pluginRoot, relativePath)),
        await readFile(path.join(repoRoot, relativePath.startsWith("skills/") ? `shared/reference-intelligence/skills/${relativePath.slice("skills/".length)}` : `shared/reference-intelligence/${relativePath.slice("references/shared/reference-intelligence/".length)}`)),
        `${product}: ${relativePath} is a byte-exact reference-intelligence package file`,
      );
    }
  }
}

async function installBuiltPlugin({ buildDir, codexHome, product }) {
  const destination = path.join(codexHome, "plugins", product);
  await mkdir(path.dirname(destination), { recursive: true });
  await cp(buildDir, destination, { recursive: true, errorOnExist: true, force: false });
  return destination;
}

async function replaceBuiltPlugin({ buildDir, codexHome, product }) {
  const destination = path.join(codexHome, "plugins", product);
  await rm(destination, { recursive: true, force: true });
  await cp(buildDir, destination, { recursive: true, errorOnExist: true, force: false });
  return destination;
}

async function removeInstalledPlugin({ codexHome, product }) {
  await rm(path.join(codexHome, "plugins", product), { recursive: true, force: true });
}

test("explicit plugin update inspection and planning leave isolated Codex state unchanged", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "plugin-update-inspection-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const codex = localCodex();
  const sourceRoot = path.join(root, "marketplace");
  const workspace = path.join(root, "workspace");
  const env = isolatedEnvironment(root);
  await Promise.all([
    cp(path.join(repoRoot, ".agents"), path.join(sourceRoot, ".agents"), { recursive: true }),
    cp(path.join(repoRoot, "plugins", "game-design-studio"), path.join(sourceRoot, "plugins", "game-design-studio"), { recursive: true }),
    cp(path.join(repoRoot, "plugins", "game-design-career"), path.join(sourceRoot, "plugins", "game-design-career"), { recursive: true }),
    mkdir(workspace, { recursive: true }),
    mkdir(env.HOME, { recursive: true }),
    mkdir(env.CODEX_HOME, { recursive: true }),
    mkdir(env.TMPDIR, { recursive: true }),
  ]);
  const workspaceSentinel = path.join(workspace, "workspace-sentinel.txt");
  const wikiSentinel = path.join(workspace, "docs", "LLM WIKI", "temporary-sentinel.txt");
  await mkdir(path.dirname(wikiSentinel), { recursive: true });
  await Promise.all([writeFile(workspaceSentinel, "workspace state must survive\\n"), writeFile(wikiSentinel, "temporary wiki-named state must survive\\n")]);
  await Promise.all([chmod(workspaceSentinel, 0o640), chmod(wikiSentinel, 0o600)]);
  const sentinelTime = new Date("2026-08-15T00:00:00.000Z");
  await Promise.all([utimes(workspaceSentinel, sentinelTime, sentinelTime), utimes(wikiSentinel, sentinelTime, sentinelTime)]);
  const evidence = [];
  const command = ({ stage, args }) => runLocalPluginCommand({ codex, cwd: workspace, env, evidence, stage, args });
  command({ stage: "marketplace-add", args: ["marketplace", "add", sourceRoot] });
  command({ stage: "studio-add", args: ["add", `game-design-studio@${marketplace}`] });

  const installedSourceManifest = path.join(sourceRoot, "plugins", "game-design-studio", ".codex-plugin", "plugin.json");
  const installedSourcePlugin = JSON.parse(await readFile(installedSourceManifest, "utf8"));
  installedSourcePlugin.version = availableVersion;
  await writeFile(installedSourceManifest, `${JSON.stringify(installedSourcePlugin, null, 2)}\n`);
  const codexRuntimeTmp = path.join(root, "codex-cli-runtime-tmp");
  await mkdir(codexRuntimeTmp, { recursive: true });
  await rm(path.join(env.CODEX_HOME, "tmp"), { recursive: true, force: true });
  await symlink(codexRuntimeTmp, path.join(env.CODEX_HOME, "tmp"), "dir");
  command({ stage: "inspection-list-preflight", args: ["list", "--marketplace", marketplace, "--available"] });

  const cacheRoot = path.join(env.CODEX_HOME, "plugins", "cache", marketplace, "game-design-studio", builtVersion);
  const before = await Promise.all([treeIdentity(workspace), treeIdentity(env.HOME), treeIdentity(env.CODEX_HOME), treeIdentity(cacheRoot)]);
  const inspected = inspectPluginUpdates({
    codexPath: codex,
    marketplaceName: marketplace,
    runCommand(commandPath, args, options) {
      return spawnSync(commandPath, args, { ...options, cwd: workspace, env });
    },
  });
  // The host never lists an installed plugin as available, so its own list can only ever say
  // not-comparable for the plugin the user has, and the approved update was unreachable. The
  // comparison version therefore comes from the marketplace snapshot manifest the host named, which
  // is what the bump above changed. `available` still mirrors the host exactly.
  assert.deepEqual(inspected, {
    marketplace: { name: marketplace, sourceType: "local" },
    installed: [{ plugin: "game-design-studio", version: builtVersion }],
    available: [{ plugin: "game-design-career", version: builtVersion }],
    comparisons: [{ plugin: "game-design-studio", installedVersion: builtVersion, availableVersion, status: "comparable" }],
  }, "the marketplace snapshot manifest is the available-version evidence for an installed plugin");
  assert.equal(inspected.available.some((entry) => entry.plugin === "game-design-studio"), false, "--available remains unrelated uninstalled inventory for the installed Studio plugin");
  assert.equal(JSON.stringify(inspected).includes(path.resolve(env.CODEX_HOME)), false, "inspection does not expose the isolated cache path");
  await assertIsolatedTreesPreserved(before, { workspace, home: env.HOME, codexHome: env.CODEX_HOME, cacheRoot }, "API inspection preserves all isolated state");

  const script = path.join(repoRoot, "shared", "scripts", "inspect-game-design-plugin-updates.mjs");
  const inspectRun = spawnSync(process.execPath, [script, "--inspect"], {
    cwd: workspace,
    env: { ...env, CODEX_PATH: codex },
    encoding: "utf8",
    shell: false,
    timeout: 30_000,
  });
  assert.equal(inspectRun.status, 0, inspectRun.stderr);
  assert.deepEqual(JSON.parse(inspectRun.stdout), inspected, "--inspect prints the read-only inspection result");
  await assertIsolatedTreesPreserved(before, { workspace, home: env.HOME, codexHome: env.CODEX_HOME, cacheRoot }, "--inspect preserves all isolated state");

  const planRun = spawnSync(process.execPath, [script, "--plan", "game-design-studio"], {
    cwd: workspace,
    env: { ...env, CODEX_PATH: codex },
    encoding: "utf8",
    shell: false,
    timeout: 30_000,
  });
  assert.equal(planRun.status, 0, planRun.stderr);
  // A local marketplace cannot be upgraded from a published release, so the plan is the install step
  // alone. It is argv only: running it stays the human's decision.
  assert.deepEqual(JSON.parse(planRun.stdout), [["plugin", "add", `game-design-studio@${marketplace}`, "--json"]], "--plan prints the install argv for a newer snapshot");
  await assertIsolatedTreesPreserved(before, { workspace, home: env.HOME, codexHome: env.CODEX_HOME, cacheRoot }, "--plan preserves all isolated state");

  // A missing Codex CLI is the realistic way the host call itself fails, not a missing product: the
  // whole design of this lookup is that a failed listing closes to unknown instead of throwing, so
  // --products must keep exiting 0 with that closed shape rather than surfacing the spawn failure.
  const missingCodexPath = path.join(root, "codex-path-that-does-not-exist");
  const productsRun = spawnSync(process.execPath, [script, "--products"], {
    cwd: workspace,
    env: { ...env, CODEX_PATH: missingCodexPath },
    encoding: "utf8",
    shell: false,
    timeout: 30_000,
  });
  assert.equal(productsRun.status, 0, productsRun.stderr);
  assert.deepEqual(JSON.parse(productsRun.stdout), { status: "unknown", products: [] }, "--products closes to unknown when the host call itself fails");
  await assertIsolatedTreesPreserved(before, { workspace, home: env.HOME, codexHome: env.CODEX_HOME, cacheRoot }, "--products preserves all isolated state");

  // Producing a plan must never be the same thing as applying one: the installed version is still
  // the built one and the cache still holds only that version after both read-only commands.
  const stillInstalled = spawnSync(codex, ["plugin", "list", "--marketplace", marketplace, "--json"], { cwd: workspace, env, encoding: "utf8", shell: false, timeout: 30_000 });
  assert.equal(stillInstalled.status, 0, stillInstalled.stderr);
  assert.deepEqual(JSON.parse(stillInstalled.stdout).installed.map(({ name, version }) => ({ name, version })), [{ name: "game-design-studio", version: builtVersion }], "the plan did not install anything");
  assert.equal(evidence.every((entry) => entry.args.every((argument) => argument !== "upgrade")), true, "test setup never upgrades the marketplace");
});

test("one local Codex workspace preserves project memory while both products install, re-add, and remove", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "memory-install-lifecycle-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const codex = localCodex();
  await Promise.all(products.map((product) => assertMemoryPackage(path.join(repoRoot, "plugins", product), `${product} built source`)));

  const workspace = path.join(root, "workspace");
  const env = isolatedEnvironment(root);
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
    await assertSameIdentity(memoryFile, before[0], `${stage}: workspace memory`);
    await assertSameIdentity(excludeFile, before[1], `${stage}: .git/info/exclude`);
    await assertSameIdentity(siblingFile, before[2], `${stage}: unrelated sibling plugin`);
  };
  const command = ({ stage, args }) => runLocalPluginCommand({ codex, cwd: workspace, env, evidence, stage, args });
  const selector = (product) => `${product}@${marketplace}`;
  const cacheRoot = (product) => path.join(env.CODEX_HOME, "plugins", "cache", marketplace, product, builtVersion);

  const market = command({ stage: "marketplace-add", args: ["marketplace", "add", repoRoot] });
  assert.equal(market.marketplaceName, marketplace, "exact local marketplace name");
  assert.equal(market.installedRoot, path.resolve(repoRoot), "marketplace points to the local repository");
  await assertPreserved("marketplace-add");

  for (const product of products) {
    const installed = command({ stage: `${product}-add`, args: ["add", selector(product)] });
    assert.equal(installed.pluginId, selector(product), `${product}: add receipt binds exact plugin`);
    assert.equal(installed.marketplaceName, marketplace, `${product}: add receipt binds local marketplace`);
    await assertMemoryPackage(cacheRoot(product), product);
    await assertPreserved(`${product}-add`);
  }

  const initialList = command({ stage: "plugin-list-both", args: ["list"] });
  for (const product of products) assert.ok(initialList.installed.some((entry) => entry.pluginId === selector(product)), `${product}: both-product list exposes installed plugin`);
  await assertPreserved("plugin-list-both");

  const studio = "game-design-studio";
  const career = "game-design-career";
  const studioRemoved = command({ stage: "studio-remove-for-update", args: ["remove", selector(studio)] });
  assert.equal(studioRemoved.pluginId, selector(studio), "Studio removal receipt binds exact plugin");
  await assert.rejects(lstat(cacheRoot(studio)), { code: "ENOENT" }, "Studio removal removes only Studio cache");
  await assertMemoryPackage(cacheRoot(career), "Career survives Studio removal");
  await assertPreserved("studio-remove-for-update");

  const studioReadded = command({ stage: "studio-readd", args: ["add", selector(studio)] });
  assert.equal(studioReadded.pluginId, selector(studio), "Studio re-add receipt binds exact plugin");
  await Promise.all(products.map((product) => assertMemoryPackage(cacheRoot(product), `${product} after Studio re-add`)));
  const readdList = command({ stage: "plugin-list-after-studio-readd", args: ["list"] });
  for (const product of products) assert.ok(readdList.installed.some((entry) => entry.pluginId === selector(product)), `${product}: list preserves both after Studio re-add`);
  await assertPreserved("studio-readd");

  command({ stage: "studio-remove-final", args: ["remove", selector(studio)] });
  await assert.rejects(lstat(cacheRoot(studio)), { code: "ENOENT" }, "final Studio removal removes Studio cache");
  await assertMemoryPackage(cacheRoot(career), "Career survives final Studio removal");
  await assertPreserved("studio-remove-final");

  command({ stage: "career-remove-final", args: ["remove", selector(career)] });
  await assert.rejects(lstat(cacheRoot(career)), { code: "ENOENT" }, "final Career removal removes Career cache");
  await assertPreserved("career-remove-final");

  const marketRemoved = command({ stage: "marketplace-remove", args: ["marketplace", "remove", marketplace] });
  assert.equal(marketRemoved.marketplaceName, marketplace, "marketplace removal receipt binds exact name");
  const finalList = command({ stage: "marketplace-list-final", args: ["marketplace", "list"] });
  assert.deepEqual(finalList.marketplaces, [], "isolated marketplace list is empty after removal");
  await assertPreserved("marketplace-remove");

  const evidencePath = path.join(root, "local-cli-lifecycle-evidence.json");
  const externalUrlInCommandEvidence = hasExternalUrl(evidence);
  assert.equal(externalUrlInCommandEvidence, false, "local command evidence has no external URL");
  const networkControl = { proxy: env.HTTPS_PROXY, externalUrlInCommandEvidence, directSocketAccess: "not-measured" };
  await writeFile(evidencePath, JSON.stringify({ networkControl, commands: evidence }, null, 2) + "\n");
  const persisted = JSON.parse(await readFile(evidencePath, "utf8"));
  assert.deepEqual(persisted.networkControl, networkControl, "network control evidence survives serialization");
  assert.deepEqual(persisted.commands, evidence, "command receipts survive evidence serialization");
  assert.equal(evidence.every((entry) => entry.cwd === workspace && entry.exitCode === 0 && !entry.args.includes("exec")), true, "every lifecycle command runs in the sentinel workspace through local plugin CLI only");
});

test("fresh production builds install, replace, and remove without touching local memory or leaving staging artifacts", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "memory-build-install-lifecycle-"));
  t.after(async () => {
    await rm(root, { recursive: true, force: true });
    await assert.rejects(lstat(root), { code: "ENOENT" }, "build lifecycle root is removed after the test");
  });

  for (const product of products) {
    await t.test(product, async () => {
      const workspace = path.join(root, `${product}-workspace`);
      const codexHome = path.join(root, `${product}-codex-home`);
      const firstStagingRoot = path.join(root, `${product}-first-build`);
      const replacementStagingRoot = path.join(root, `${product}-replacement-build`);
      const memoryFile = path.join(workspace, ".game-design", "memory", "v1", "events", "bb", "memory-sentinel", `mev1-${"b".repeat(64)}.md`);
      const excludeFile = path.join(workspace, ".git", "info", "exclude");
      const siblingFile = path.join(codexHome, "plugins", "unrelated-plugin", "sentinel.txt");
      await Promise.all([mkdir(path.dirname(memoryFile), { recursive: true }), mkdir(path.dirname(excludeFile), { recursive: true }), mkdir(path.dirname(siblingFile), { recursive: true })]);
      await writeFile(memoryFile, "built-plugin-lifecycle-memory\n");
      await writeFile(excludeFile, "existing local exclusion\n.game-design/memory/\n");
      await writeFile(siblingFile, "sibling plugin survives\n");
      await chmod(memoryFile, 0o640);
      await chmod(excludeFile, 0o600);
      const timestamp = new Date("2026-08-12T00:00:00.000Z");
      await Promise.all([utimes(memoryFile, timestamp, timestamp), utimes(excludeFile, timestamp, timestamp)]);
      const before = await Promise.all([fileIdentity(memoryFile), fileIdentity(excludeFile), fileIdentity(siblingFile)]);
      const assertPreserved = async (stage) => {
        await assertSameIdentity(memoryFile, before[0], `${product}:${stage}: workspace memory`);
        await assertSameIdentity(excludeFile, before[1], `${product}:${stage}: .git/info/exclude`);
        await assertSameIdentity(siblingFile, before[2], `${product}:${stage}: sibling plugin`);
        for (const privatePath of [
          path.join(workspace, ".game-design", "reference-intelligence"),
          path.join(workspace, ".game-design", "glossary"),
        ]) await assert.rejects(lstat(privatePath), { code: "ENOENT" }, `${product}:${stage}: install does not create private reference cache`);
      };

      try {
        const firstBuild = await buildProduct({ repoRoot, productName: product, stagingRoot: firstStagingRoot, sourceDateEpoch: 0 });
        await assertMemoryPackage(firstBuild.outputDir, `${product} first production build`, { expectedSkillCount: packagedSkillCount(product), requireReferenceIntelligence: true });
        const installed = await installBuiltPlugin({ buildDir: firstBuild.outputDir, codexHome, product });
        await assertMemoryPackage(installed, `${product} installed production build`, { expectedSkillCount: packagedSkillCount(product), requireReferenceIntelligence: true });
        await assertPreserved("install");

        const replacementBuild = await buildProduct({ repoRoot, productName: product, stagingRoot: replacementStagingRoot, sourceDateEpoch: 0 });
        await assertMemoryPackage(replacementBuild.outputDir, `${product} replacement production build`, { expectedSkillCount: packagedSkillCount(product), requireReferenceIntelligence: true });
        const replaced = await replaceBuiltPlugin({ buildDir: replacementBuild.outputDir, codexHome, product });
        await assertMemoryPackage(replaced, `${product} replacement install`, { expectedSkillCount: packagedSkillCount(product), requireReferenceIntelligence: true });
        await assertPreserved("replace");

        await removeInstalledPlugin({ codexHome, product });
        await assert.rejects(lstat(replaced), { code: "ENOENT" }, `${product}: removal removes only the installed build`);
        await assertPreserved("remove");
      } finally {
        await Promise.all([rm(firstStagingRoot, { recursive: true, force: true }), rm(replacementStagingRoot, { recursive: true, force: true })]);
      }
      await Promise.all([
        assert.rejects(lstat(firstStagingRoot), { code: "ENOENT" }, `${product}: first build staging is removed`),
        assert.rejects(lstat(replacementStagingRoot), { code: "ENOENT" }, `${product}: replacement build staging is removed`),
      ]);
    });
  }
});
