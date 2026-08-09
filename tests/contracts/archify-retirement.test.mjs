import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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
  for (const relative of retired) {
    await assert.rejects(access(path.resolve(relative)), { code: "ENOENT" });
  }
  const packageJson = JSON.parse(await readFile("package.json", "utf8"));
  assert.equal(Object.hasOwn(packageJson.scripts, "build:archify-guides"), false);
  assert.equal(Object.hasOwn(packageJson.scripts, "check:archify-guides"), false);
});

test("retirement preserves the public Archify capability boundary", async () => {
  for (const expected of ["available", "unavailable", "unknown"]) {
    const context = await runCapabilityFixture(expected);
    assert.equal(context.capabilities.archify.status, expected);
    assert.equal(JSON.stringify(context.capabilities.archify).includes("/Users/"), false);
    assert.equal(Object.hasOwn(context.capabilities.archify, "path"), false);
  }
});
