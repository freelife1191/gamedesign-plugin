import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { probeArchifyCapability } from "../../shared/scripts/capability-probe.mjs";

const retired = [
  "tooling/build-archify-guides.mjs",
  "tooling/lib/archify-guides.mjs",
  "tests/unit/archify-guides.test.mjs",
  "guides/assets/archify/manifest.json",
];
const legacyArtifactBasenames = new Set(["flow.html", "flow.json", "receipt.json"]);

async function legacyArtifacts(root, directory = path.join(root, "guides", "assets", "archify")) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }

  const artifacts = [];
  for (const entry of entries) {
    const candidate = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      artifacts.push(...await legacyArtifacts(root, candidate));
    } else if (legacyArtifactBasenames.has(entry.name)) {
      artifacts.push(path.relative(root, candidate));
    }
  }
  return artifacts;
}

async function assertRetiredArchifyArtifacts(root) {
  for (const relative of retired) {
    await assert.rejects(access(path.resolve(root, relative)), { code: "ENOENT" });
  }
  assert.deepEqual(await legacyArtifacts(root), [], "legacy Task 13 Archify artifacts must be absent");
}

async function runCapabilityFixture(expected) {
  const home = await mkdtemp(path.join(os.tmpdir(), "archify-retirement-"));
  try {
    const options = { home };
    if (expected === "available") {
      const root = path.join(home, ".agents", "skills", "archify");
      await mkdir(path.join(root, "bin"), { recursive: true });
      await Promise.all([
        writeFile(path.join(root, "SKILL.md"), "---\nname: archify\n---\n"),
        writeFile(path.join(root, "package.json"), JSON.stringify({ version: "2.13.0" })),
        writeFile(path.join(root, "bin", "archify.mjs"), "#!/usr/bin/env node\n"),
      ]);
    } else if (expected === "unknown") {
      options.lstatFn = async () => {
        throw Object.assign(new Error("permission denied"), { code: "EACCES" });
      };
    }
    return { capabilities: { archify: await probeArchifyCapability({}, options) } };
  } finally {
    await rm(home, { recursive: true, force: true });
  }
}

test("old Task 13 Archify surface is absent", async () => {
  await assertRetiredArchifyArtifacts(process.cwd());
  const packageJson = JSON.parse(await readFile("package.json", "utf8"));
  assert.equal(Object.hasOwn(packageJson.scripts, "build:archify-guides"), false);
  assert.equal(Object.hasOwn(packageJson.scripts, "check:archify-guides"), false);
});

test("retirement contract rejects reintroduced nested legacy artifact basenames", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "archify-retirement-mutation-"));
  try {
    for (const basename of ["flow.html", "flow.json", "receipt.json"]) {
      const artifact = path.join(root, "guides", "assets", "archify", "studio", "reintroduced", basename);
      await mkdir(path.dirname(artifact), { recursive: true });
      await writeFile(artifact, "legacy artifact\n");
      await assert.rejects(assertRetiredArchifyArtifacts(root), new RegExp(basename.replace(".", "\\."), "u"));
      await rm(artifact);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("retirement contract permits a future curated Archify directory", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "archify-retirement-curated-"));
  try {
    const artifact = path.join(root, "guides", "assets", "archify", "curated", "diagram.html");
    await mkdir(path.dirname(artifact), { recursive: true });
    await writeFile(artifact, "curated artifact\n");
    await assert.doesNotReject(assertRetiredArchifyArtifacts(root));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("retirement preserves the public Archify capability boundary", async () => {
  for (const expected of ["available", "unavailable", "unknown"]) {
    const context = await runCapabilityFixture(expected);
    assert.equal(context.capabilities.archify.status, expected);
    assert.equal(JSON.stringify(context.capabilities.archify).includes("/Users/"), false);
    assert.equal(Object.hasOwn(context.capabilities.archify, "path"), false);
  }
});
