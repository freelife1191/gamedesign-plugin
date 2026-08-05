import assert from "node:assert/strict";
import { chmod, mkdir, realpath, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { compareNumericVersions, resolvePathExecutable, resolveRuntime } from "./lib/runtime-resolver.mjs";

async function fakeRuntime(root, version) {
  const runtime = path.join(root, version, "dependencies");
  await mkdir(path.join(runtime, "node", "bin"), { recursive: true });
  await mkdir(path.join(runtime, "node", "node_modules", "@oai", "artifact-tool"), { recursive: true });
  await writeFile(path.join(runtime, "node", "bin", "node"), "node");
  await writeFile(path.join(runtime, "node", "node_modules", "@oai", "artifact-tool", "package.json"), JSON.stringify({ name: "@oai/artifact-tool", version }));
  return runtime;
}

test("numeric version ordering does not treat 2.10 as older than 2.9", () => {
  assert.equal(compareNumericVersions("2.10.0", "2.9.9") > 0, true);
});

test("PATH capability resolution returns a canonical executable and rejects missing commands", async () => {
  const root = await import("node:fs/promises").then(({ mkdtemp }) => mkdtemp(path.join(tmpdir(), "formats-path-")));
  const executable = path.join(root, "pdftotext");
  await writeFile(executable, "#!/bin/sh\nexit 0\n");
  await chmod(executable, 0o755);
  assert.equal(await resolvePathExecutable("pdftotext", { PATH: root }), await realpath(executable));
  await assert.rejects(resolvePathExecutable("missing-command", { PATH: root }), /missing-command.*unavailable/i);
});

test("explicit dependency roots win and the newest valid root is selected", async () => {
  const root = await import("node:fs/promises").then(({ mkdtemp }) => mkdtemp(path.join(tmpdir(), "formats-runtime-")));
  const older = await fakeRuntime(root, "2.9.9");
  const newer = await fakeRuntime(root, "2.10.0");
  const resolved = await resolveRuntime({
    env: { CODEX_RUNTIME_DEPENDENCIES: `${older}${path.delimiter}${newer}` },
    home: path.join(root, "unused-home"),
    requireCommands: false,
  });
  assert.equal(resolved.dependenciesRoot, await realpath(newer));
  assert.equal(resolved.artifactToolVersion, "2.10.0");
});

test("committed runtime metadata never exposes an absolute host path", async () => {
  const root = await import("node:fs/promises").then(({ mkdtemp }) => mkdtemp(path.join(tmpdir(), "formats-runtime-")));
  const runtime = await fakeRuntime(root, "2.10.0");
  const resolved = await resolveRuntime({ env: { CODEX_DEPENDENCIES: runtime }, home: root, requireCommands: false });
  assert.deepEqual(Object.keys(resolved.publicMetadata).sort(), ["artifactTool", "node", "python", "runtimeSourceClass"].sort());
  assert.equal(JSON.stringify(resolved.publicMetadata).includes(root), false);
});
