import assert from "node:assert/strict";
import { mkdtemp, readFile, realpath, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { buildProduct } from "../../../tooling/lib/build-product.mjs";
import { importVendored } from "../../lib/vendored.mjs";
import { CHILD_DEADLINE_SCALE } from "../../lib/platform-support.mjs";

const { resolveBrowser } = await importVendored("skillstead", "scripts/render.mjs");

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const temporaryDirectories = [];

test.afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

test("clean-built SessionStart probe and Skillstead renderer report the same real browser identity", async (t) => {
  if (!resolveBrowser()) return t.skip("no Chromium-based browser available for actual render alignment");
  const stagingRoot = await mkdtemp(path.join(os.tmpdir(), "studio-browser-alignment-"));
  temporaryDirectories.push(stagingRoot);
  const build = await buildProduct({ repoRoot, productName: "game-design-studio", stagingRoot, sourceDateEpoch: 0 });
  const pluginRoot = await realpath(build.outputDir);
  const probe = spawnSync(process.execPath, [path.join(pluginRoot, "scripts/capability-probe.mjs")], {
    cwd: pluginRoot,
    env: {
      ...process.env,
      HOME: path.join(stagingRoot, "probe-home"),
      XDG_CACHE_HOME: path.join(stagingRoot, "probe-cache"),
      GAME_DESIGN_UPDATE_CHECKS: "false",
    },
    input: "{}",
    encoding: "utf8",
  });
  assert.equal(probe.status, 0, probe.stderr);
  const output = JSON.parse(probe.stdout);
  assert.equal(output.updates.cache, "disabled");
  assert.equal(output.updates.status, "disabled");
  // resolveBrowser() already found one, so a disagreement here is the probe's, and the probe's own
  // answer is the only thing that can say why.
  assert.equal(output.capabilities.chromium.available, true, `probe disagrees with the renderer: ${JSON.stringify(output.capabilities.chromium)}`);
  assert.deepEqual(Object.keys(output.capabilities.chromium), ["available", "command", "version", "via"]);

  const scripts = path.join(pluginRoot, "skills/svg-infographic/scripts");
  const png = path.join(pluginRoot, "alignment-render.png");
  const render = spawnSync(process.execPath, [path.join(scripts, "render.mjs"), path.join(scripts, "fixtures/valid.svg"), png], {
    cwd: pluginRoot,
    env: { ...process.env },
    encoding: "utf8",
    // A headless Chromium render is several times slower on Windows, and the identity line this test
    // reads had already been printed when the thirty-second bound killed the process.
    timeout: 30000 * CHILD_DEADLINE_SCALE,
  });
  assert.equal(render.status, 0, `${render.stdout}\n${render.stderr}`);
  const identity = render.stdout.match(/^renderer: (.+) \((.+)\) \[via (.+)\]$/mu);
  assert.ok(identity, render.stdout);
  assert.equal(output.capabilities.chromium.command, await realpath(identity[1]));
  assert.equal(output.capabilities.chromium.version, identity[2]);
  assert.equal(output.capabilities.chromium.via, identity[3]);
  const bytes = await readFile(png);
  assert.equal(bytes.readUInt32BE(16), 1200);
  assert.equal(bytes.readUInt32BE(20), 600);
});
