import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cp, lstat, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import { buildProduct } from "../../../tooling/lib/build-product.mjs";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const marketplace = "game-design-suite";
const products = ["game-design-studio", "game-design-career"];
const expectedInventory = {
  "game-design-studio": { skills: 24, agents: 12 },
  "game-design-career": { skills: 23, agents: 10 },
};
const checkedAt = Date.parse("2026-08-15T00:00:00.000Z");

async function snapshotProjectTree(root) {
  async function visit(relative) {
    const filename = path.join(root, relative);
    const stats = await lstat(filename);
    if (stats.isDirectory()) {
      const children = await readdir(filename);
      return [{ relative, type: "directory" }, ...(await Promise.all(children.sort().map((child) => visit(path.join(relative, child))))).flat()];
    }
    return [{ relative, type: "file", bytes: await readFile(filename) }];
  }
  return visit(".");
}

function localCodex() {
  const probe = spawnSync("which", ["codex"], { encoding: "utf8" });
  assert.equal(probe.status, 0, "local Codex CLI is required for the lifecycle E2E");
  return probe.stdout.trim();
}

function isolatedEnvironment(root) {
  return {
    HOME: path.join(root, "home"),
    CODEX_HOME: path.join(root, "codex-home"),
    XDG_CACHE_HOME: path.join(root, "home", "cache"),
    TMPDIR: path.join(root, "tmp"),
    PATH: process.env.PATH ?? "",
    HTTP_PROXY: "http://127.0.0.1:9",
    HTTPS_PROXY: "http://127.0.0.1:9",
    ALL_PROXY: "http://127.0.0.1:9",
    NO_PROXY: "",
  };
}

function runPluginCommand({ codex, cwd, env, args, commands, stage }) {
  assert.equal(args.includes("exec"), false, `${stage}: advisory lifecycle must not run codex exec`);
  const result = spawnSync(codex, ["plugin", ...args, "--json"], {
    cwd,
    env,
    encoding: "utf8",
    shell: false,
    timeout: 30_000,
  });
  assert.equal(result.error, undefined, `${stage}: CLI launch error`);
  assert.equal(result.signal, null, `${stage}: CLI timed out`);
  assert.equal(result.status, 0, `${stage}: ${result.stderr}`);
  const receipt = JSON.parse(result.stdout);
  commands.push({ stage, args, receipt });
  return receipt;
}

async function assertInstalledPackage(pluginRoot, product) {
  const manifest = JSON.parse(await readFile(path.join(pluginRoot, ".codex-plugin", "plugin.json"), "utf8"));
  const components = JSON.parse(await readFile(path.join(pluginRoot, "references", "shared", "updates", "installed-components.json"), "utf8"));
  assert.equal(manifest.version, "0.1.1", `${product}: installed manifest uses the update-channel version`);
  assert.deepEqual(
    components.components.map(({ id, installedTag }) => [id, installedTag]),
    [["skillstead", "svg-infographic/v0.9.0"], ["archify", "v2.14.0"], ["im-not-ai", "v2.3.0"]],
    `${product}: installed bundles stay pinned`,
  );
  const [skills, agents] = await Promise.all([
    readdir(path.join(pluginRoot, "skills"), { withFileTypes: true }),
    readdir(path.join(pluginRoot, "agents"), { withFileTypes: true }),
  ]);
  assert.equal(skills.filter((entry) => entry.isDirectory()).length, expectedInventory[product].skills, `${product}: skill inventory`);
  assert.equal(agents.filter((entry) => entry.isFile() && entry.name.endsWith(".md")).length, expectedInventory[product].agents, `${product}: agent inventory`);
}

function runInstalledSessionStart({ pluginRoot, workspace, env, now = checkedAt, offline = false }) {
  const probe = pathToFileURL(path.join(pluginRoot, "scripts", "capability-probe.mjs")).href;
  const script = `
    import { runCapabilityProbe } from ${JSON.stringify(probe)};
    const installed = ${JSON.stringify([
      { id: "skillstead", repository: "https://github.com/kyungseo/skillstead", installedTag: "svg-infographic/v0.9.0" },
      { id: "archify", repository: "https://github.com/tt-a1i/archify", installedTag: "v2.14.0" },
      { id: "im-not-ai", repository: "https://github.com/epoko77-ai/im-not-ai", installedTag: "v2.3.0" },
    ])};
    const requests = [];
    globalThis.fetch = async (url) => {
      requests.push(url);
      if (${JSON.stringify(offline)}) throw new Error("offline fixture");
      const component = installed.find(({ repository }) => url === repository.replace("github.com", "api.github.com/repos") + "/releases");
      if (!component) throw new Error("unexpected endpoint: " + url);
      const tag = component.id === "archify" ? "v2.15.0" : component.installedTag;
      return { ok: true, status: 200, url, async json() { return [{ tag_name: tag, draft: false, prerelease: false, html_url: component.repository + "/releases/tag/" + encodeURIComponent(tag) }]; } };
    };
    const result = await runCapabilityProbe({ updateOptions: {
      pluginRoot: ${JSON.stringify(pluginRoot)}, home: ${JSON.stringify(env.HOME)}, now: ${JSON.stringify(now)},
      env: { XDG_CACHE_HOME: ${JSON.stringify(env.XDG_CACHE_HOME)} }, fetchFn: globalThis.fetch,
    } });
    process.stdout.write(JSON.stringify({ result, requests }));
  `;
  const result = spawnSync(process.execPath, ["--input-type=module", "--eval", script], {
    cwd: workspace,
    env: { HOME: env.HOME, CODEX_HOME: env.CODEX_HOME, XDG_CACHE_HOME: env.XDG_CACHE_HOME, PATH: "" },
    encoding: "utf8",
    shell: false,
    timeout: 30_000,
  });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

test("fresh local products advise without implicit updates and preserve the complete marketplace lifecycle", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "plugin-update-advisory-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const env = isolatedEnvironment(root);
  const sourceRoot = path.join(root, "marketplace");
  const workspace = path.join(root, "workspace");
  const commands = [];
  const codex = localCodex();
  await Promise.all([mkdir(workspace, { recursive: true }), mkdir(env.HOME, { recursive: true }), mkdir(env.CODEX_HOME, { recursive: true }), mkdir(env.TMPDIR, { recursive: true }), cp(path.join(repoRoot, ".agents"), path.join(sourceRoot, ".agents"), { recursive: true })]);
  await writeFile(path.join(workspace, "unrelated.txt"), "must not change\n");
  await mkdir(path.join(workspace, ".game-design", "memory"), { recursive: true });
  await writeFile(path.join(workspace, ".game-design", "memory", "sentinel.md"), "project memory must survive\n");
  const before = await snapshotProjectTree(workspace);

  for (const product of products) {
    const build = await buildProduct({ repoRoot, productName: product, stagingRoot: path.join(root, "fresh-builds", product), sourceDateEpoch: 0 });
    await cp(build.outputDir, path.join(sourceRoot, "plugins", product), { recursive: true });
  }

  const command = (stage, args) => runPluginCommand({ codex, cwd: workspace, env, args, commands, stage });
  const selector = (product) => `${product}@${marketplace}`;
  command("marketplace-add", ["marketplace", "add", sourceRoot]);
  for (const product of products) {
    const receipt = command(`${product}-add`, ["add", selector(product)]);
    assert.equal(receipt.version, "0.1.1", `${product}: local marketplace installs the built version`);
    await assertInstalledPackage(path.join(env.CODEX_HOME, "plugins", "cache", marketplace, product, "0.1.1"), product);
  }
  const listed = command("plugin-list", ["list"]);
  for (const product of products) assert.ok(listed.installed.some((entry) => entry.pluginId === selector(product) && entry.version === "0.1.1"), `${product}: list reports exact installed version`);

  const studioCache = path.join(env.CODEX_HOME, "plugins", "cache", marketplace, "game-design-studio", "0.1.1");
  const cacheBeforeSession = await snapshotProjectTree(studioCache);
  const first = runInstalledSessionStart({ pluginRoot: studioCache, workspace, env });
  assert.deepEqual(first.result.updates.notification, { kind: "update-available", prompt: "플러그인 업데이트를 확인해 줘", componentIds: ["archify"] });
  assert.equal(first.result.updates.cache, "miss");
  assert.equal(first.requests.length, 3, "first SessionStart uses only three injected release fixtures");
  assert.deepEqual(await snapshotProjectTree(workspace), before, "first advisory does not touch project files");
  assert.deepEqual(await snapshotProjectTree(studioCache), cacheBeforeSession, "first advisory never edits an installed cache");

  const second = runInstalledSessionStart({ pluginRoot: studioCache, workspace, env, now: checkedAt + 1, offline: true });
  assert.equal(second.result.updates.cache, "hit");
  assert.equal(second.requests.length, 0, "shared fresh cache prevents another network attempt");
  assert.deepEqual(await snapshotProjectTree(workspace), before, "cached advisory does not touch project files");
  assert.deepEqual(await snapshotProjectTree(studioCache), cacheBeforeSession, "cached advisory never edits an installed cache");

  const offline = runInstalledSessionStart({ pluginRoot: studioCache, workspace, env: { ...env, HOME: path.join(root, "offline-home"), XDG_CACHE_HOME: path.join(root, "offline-home", "cache") }, offline: true });
  assert.equal(offline.result.updates.status, "unknown");
  assert.equal(offline.result.updates.notification, null);
  assert.equal(offline.requests.length, 1, "offline fixture fails closed at the first injected request");
  assert.deepEqual(await snapshotProjectTree(workspace), before, "offline check does not touch project files");
  assert.deepEqual(await snapshotProjectTree(studioCache), cacheBeforeSession, "offline check never edits an installed cache");
  assert.equal(commands.every(({ args }) => !args.includes("upgrade") && !args.includes("exec")), true, "no SessionStart path performs an implicit marketplace update or codex exec");

  command("studio-remove", ["remove", selector("game-design-studio")]);
  await assert.rejects(lstat(studioCache), { code: "ENOENT" });
  command("studio-readd", ["add", selector("game-design-studio")]);
  await assertInstalledPackage(studioCache, "game-design-studio");
  for (const product of products) command(`${product}-remove`, ["remove", selector(product)]);
  for (const product of products) await assert.rejects(lstat(path.join(env.CODEX_HOME, "plugins", "cache", marketplace, product, "0.1.1")), { code: "ENOENT" });
  command("marketplace-remove", ["marketplace", "remove", marketplace]);
  assert.deepEqual(command("marketplace-list", ["marketplace", "list"]).marketplaces, []);
  await lstat(path.join(env.XDG_CACHE_HOME, "game-design-suite", "update-advisory-v1.json"));
  assert.deepEqual(await snapshotProjectTree(workspace), before, "install, re-install, removal, and shared advisory cache cleanup policy preserve project memory and unrelated files");
});
