import assert from "node:assert/strict";
import { constants } from "node:fs";
import { chmod, mkdtemp, open, readFile, realpath, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { readWorkspaceEnv } from "../../shared/scripts/lib/load-workspace-env.mjs";

async function workspace(t) {
  const root = await mkdtemp(path.join(tmpdir(), "workspace-env-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  return realpath(root);
}

async function writeEnv(root, contents, mode = 0o600) {
  const envPath = path.join(root, ".env");
  await writeFile(envPath, contents, { mode });
  await chmod(envPath, mode);
  return envPath;
}

test("workspace env returns only declared keys with environment precedence", async (t) => {
  const root = await workspace(t);
  await writeEnv(root, [
    "ALLOWED=file-value",
    "SECOND=from-file",
    "IGNORED=unrelated-secret",
    "LEGACY_KEY=old-value",
    "",
  ].join("\n"));

  const result = await readWorkspaceEnv({
    workspaceRoot: root,
    env: { ALLOWED: " process-value ", SECOND: "  ", LEGACY_KEY: "process-old" },
    supportedKeys: ["ALLOWED", "SECOND"],
    legacyKeys: ["LEGACY_KEY"],
  });

  assert.deepEqual(result, {
    values: { ALLOWED: "process-value", SECOND: "from-file" },
    sources: { ALLOWED: "environment", SECOND: ".env" },
    warnings: [],
    legacyKeys: ["LEGACY_KEY"],
  });
  assert.deepEqual(Object.keys(result.values).sort(), ["ALLOWED", "SECOND"]);
});

test("workspace env opens a regular dotenv with no-follow and pins its identity before and after reading", async (t) => {
  const root = await workspace(t);
  const envPath = await writeEnv(root, "ALLOWED=file-value\n");
  const lstatCalls = [];
  let flags;
  let openStats;

  const result = await readWorkspaceEnv({
    workspaceRoot: root,
    env: {},
    supportedKeys: ["ALLOWED"],
    lstatFn: async (target) => {
      lstatCalls.push(target);
      return (await import("node:fs/promises")).lstat(target);
    },
    openFileFn: async (target, openFlags) => {
      assert.equal(target, envPath);
      flags = openFlags;
      const handle = await open(target, openFlags);
      openStats = await handle.stat();
      return handle;
    },
  });

  assert.equal((flags & constants.O_NOFOLLOW) !== 0, true);
  assert.ok(lstatCalls.filter((target) => target === envPath).length >= 3);
  const pathStats = await (await import("node:fs/promises")).lstat(envPath);
  assert.equal(openStats.dev, pathStats.dev);
  assert.equal(openStats.ino, pathStats.ino);
  assert.deepEqual(result.values, { ALLOWED: "file-value" });
});

test("workspace env reads only the opened file when the dotenv path is swapped and restored during reading", async (t) => {
  const root = await workspace(t);
  const envPath = await writeEnv(root, "ALLOWED=original-value\n");
  const originalPath = path.join(root, "original.env");
  const replacementPath = path.join(root, "replacement.env");
  await writeFile(replacementPath, "ALLOWED=replacement-value\n", { mode: 0o600 });
  let swapped = false;

  const result = await readWorkspaceEnv({
    workspaceRoot: root,
    env: {},
    supportedKeys: ["ALLOWED"],
    readFileFn: async (source, ...args) => {
      if (!swapped) {
        swapped = true;
        await rename(envPath, originalPath);
        await rename(replacementPath, envPath);
      }

      const contents = typeof source === "string"
        ? await readFile(source)
        : await source.read(...args);

      if (swapped) {
        await rename(envPath, replacementPath);
        await rename(originalPath, envPath);
        swapped = false;
      }
      return contents;
    },
  });

  assert.deepEqual(result.values, { ALLOWED: "original-value" });
});

test("workspace env rejects malformed declared values without disclosing values or undeclared keys", async (t) => {
  const root = await workspace(t);
  const privateValue = "private-value-never-report";
  await writeEnv(root, `ALLOWED=\`${privateValue}\`\nNOT_DECLARED=${privateValue}\n`);

  await assert.rejects(
    () => readWorkspaceEnv({ workspaceRoot: root, env: {}, supportedKeys: ["ALLOWED"] }),
    (error) => {
      const output = `${error.message}\n${JSON.stringify(error)}`;
      assert.match(error.message, /invalid \.env/i);
      assert.equal(output.includes(privateValue), false);
      assert.equal(output.includes("NOT_DECLARED"), false);
      return true;
    },
  );
});

test("workspace env rejects duplicate declared keys and NUL bytes", async (t) => {
  const fixtures = [
    "ALLOWED=first\nALLOWED=second\n",
    "ALLOWED=safe\0tail\n",
  ];
  for (const contents of fixtures) {
    const root = await workspace(t);
    await writeEnv(root, contents);
    await assert.rejects(
      () => readWorkspaceEnv({ workspaceRoot: root, env: {}, supportedKeys: ["ALLOWED"] }),
      /invalid \.env/i,
    );
  }
});

test("workspace env rejects files above 64 KiB before a supplied reader runs", async (t) => {
  const root = await workspace(t);
  await writeEnv(root, `#${"x".repeat(64 * 1024)}\n`);
  let reads = 0;
  await assert.rejects(
    () => readWorkspaceEnv({
      workspaceRoot: root,
      env: {},
      supportedKeys: ["ALLOWED"],
      readFileFn: async () => {
        reads += 1;
        throw new Error("reader should not be called");
      },
    }),
    /too large/i,
  );
  assert.equal(reads, 0);
});

test("workspace env rejects unsafe adapter inputs and reports permission warnings", async (t) => {
  const root = await workspace(t);
  await writeEnv(root, "ALLOWED=file-value\n", 0o644);
  const result = await readWorkspaceEnv({ workspaceRoot: root, env: {}, supportedKeys: ["ALLOWED"] });
  assert.ok(result.warnings.some((warning) => warning.code === "insecure_permissions"));

  await assert.rejects(
    () => readWorkspaceEnv({ workspaceRoot: root, env: {}, supportedKeys: ["ALLOWED", "ALLOWED"] }),
    /supportedKeys/i,
  );
});
