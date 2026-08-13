import assert from "node:assert/strict";
import { chmod, cp, lstat, mkdir, mkdtemp, readFile, readdir, rm, utimes, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { buildProduct } from "../../../tooling/lib/build-product.mjs";
import { collectTree } from "../../../tooling/lib/copy-tree.mjs";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
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
  const actual = await fileIdentity(filename);
  assert.deepEqual(actual, expected, label);
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

async function assertMemoryPackage(pluginRoot, product) {
  for (const skill of memorySkills) {
    await lstat(path.join(pluginRoot, "skills", skill, "SKILL.md"));
  }
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

  const entries = await collectTree(pluginRoot, { label: `${product} installed plugin` });
  const files = entries.map(({ relativePath }) => relativePath);
  assert.equal(files.some((file) => path.basename(file) === ".env"), false, `${product}: actual .env must not be packaged`);
  assert.equal(files.some((file) => file.startsWith("references/shared/memory/v1/") || file.includes("/derived/")), false, `${product}: local memory data must not be packaged`);
}

test("temporary installs, replacements, and removals preserve local game-design memory without network", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "memory-install-lifecycle-"));
  t.after(() => rm(root, { recursive: true, force: true }));

  const originalFetch = globalThis.fetch;
  let networkCalls = 0;
  globalThis.fetch = async () => {
    networkCalls += 1;
    throw new Error("network is forbidden in local plugin lifecycle verification");
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  for (const product of products) {
    await t.test(product, async () => {
      const workspace = path.join(root, `${product}-workspace`);
      const codexHome = path.join(root, `${product}-codex-home`);
      const stagingRoot = path.join(root, `${product}-build`);
      const memoryFile = path.join(workspace, ".game-design", "memory", "v1", "events", "aa", "memory-sentinel", `mev1-${"a".repeat(64)}.md`);
      const excludeFile = path.join(workspace, ".git", "info", "exclude");
      const siblingFile = path.join(codexHome, "plugins", "unrelated-plugin", "sentinel.txt");
      await mkdir(path.dirname(memoryFile), { recursive: true });
      await mkdir(path.dirname(excludeFile), { recursive: true });
      await mkdir(path.dirname(siblingFile), { recursive: true });
      await writeFile(memoryFile, "local-memory-must-survive\\n");
      await writeFile(excludeFile, "existing local exclusion\\n.game-design/memory/\\n");
      await writeFile(siblingFile, "sibling plugin survives\\n");
      await chmod(memoryFile, 0o640);
      await chmod(excludeFile, 0o600);
      const timestamp = new Date("2026-08-12T00:00:00.000Z");
      await utimes(memoryFile, timestamp, timestamp);
      await utimes(excludeFile, timestamp, timestamp);
      const [memoryBefore, excludeBefore, siblingBefore] = await Promise.all([
        fileIdentity(memoryFile), fileIdentity(excludeFile), fileIdentity(siblingFile),
      ]);

      const firstBuild = await buildProduct({ repoRoot, productName: product, stagingRoot, sourceDateEpoch: 0 });
      const installed = await installBuiltPlugin({ buildDir: firstBuild.outputDir, codexHome, product });
      await assertMemoryPackage(installed, product);
      await assertSameIdentity(memoryFile, memoryBefore, `${product}: install must not touch workspace memory`);
      await assertSameIdentity(excludeFile, excludeBefore, `${product}: install must not touch local git exclusion`);
      await assertSameIdentity(siblingFile, siblingBefore, `${product}: install must preserve sibling plugin`);

      const replacementRoot = path.join(root, `${product}-replacement-build`);
      const replacementBuild = await buildProduct({ repoRoot, productName: product, stagingRoot: replacementRoot, sourceDateEpoch: 0 });
      const replaced = await replaceBuiltPlugin({ buildDir: replacementBuild.outputDir, codexHome, product });
      await assertMemoryPackage(replaced, product);
      await assertSameIdentity(memoryFile, memoryBefore, `${product}: replacement must not touch workspace memory`);
      await assertSameIdentity(excludeFile, excludeBefore, `${product}: replacement must not touch local git exclusion`);
      await assertSameIdentity(siblingFile, siblingBefore, `${product}: replacement must preserve sibling plugin`);

      await removeInstalledPlugin({ codexHome, product });
      await assert.rejects(lstat(replaced), { code: "ENOENT" });
      await assertSameIdentity(memoryFile, memoryBefore, `${product}: removal must not touch workspace memory`);
      await assertSameIdentity(excludeFile, excludeBefore, `${product}: removal must not touch local git exclusion`);
      await assertSameIdentity(siblingFile, siblingBefore, `${product}: removal must preserve sibling plugin`);

      const committedPlugin = path.join(repoRoot, "plugins", product);
      await assertMemoryPackage(committedPlugin, `${product} committed snapshot`);
      const committedSkills = (await readdir(path.join(committedPlugin, "skills"), { withFileTypes: true }))
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name);
      assert.equal(committedSkills.length, 21, `${product}: committed snapshot must expose 21 installable skills`);
    });
  }

  assert.equal(networkCalls, 0, "local lifecycle must not call the network");
});
