import assert from "node:assert/strict";
import { mkdtemp, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  loadMemoryConfig,
  toPublicMemoryConfig,
  validateMemoryConfig,
} from "../../shared/scripts/load-memory-config.mjs";

async function workspace(t) {
  const root = await mkdtemp(path.join(tmpdir(), "memory-config-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  return realpath(root);
}

async function writeEnv(root, lines) {
  await writeFile(path.join(root, ".env"), `${lines.join("\n")}\n`, { mode: 0o600 });
}

test("memory configuration defaults to enabled project-local memory", async (t) => {
  const root = await workspace(t);
  const config = await loadMemoryConfig({ workspaceRoot: root, env: {} });

  assert.deepEqual(
    {
      enabled: config.enabled,
      scope: config.scope,
      maxItems: config.maxItems,
      candidateTtlDays: config.candidateTtlDays,
      gitMode: config.gitMode,
    },
    { enabled: true, scope: "project", maxItems: 5, candidateTtlDays: 30, gitMode: "local" },
  );
});

test("disabled memory ignores invalid subordinate values without widening scope", async (t) => {
  const root = await workspace(t);
  await writeEnv(root, [
    "GAME_DESIGN_MEMORY_ENABLED=false",
    "GAME_DESIGN_MEMORY_SCOPE=internet",
    "GAME_DESIGN_MEMORY_MAX_ITEMS=999999",
    "GAME_DESIGN_MEMORY_CANDIDATE_TTL_DAYS=0",
    "GAME_DESIGN_MEMORY_GIT_MODE=publish",
  ]);

  const config = await loadMemoryConfig({ workspaceRoot: root, env: {} });

  assert.equal(config.enabled, false);
  assert.equal(config.scope, "project");
  assert.equal(config.maxItems, 5);
  assert.equal(config.candidateTtlDays, 30);
  assert.equal(config.gitMode, "local");
});

test("non-empty process values override .env while empty process values fall through", async (t) => {
  const root = await workspace(t);
  await writeEnv(root, [
    "GAME_DESIGN_MEMORY_ENABLED=true",
    "GAME_DESIGN_MEMORY_SCOPE=workspace",
    "GAME_DESIGN_MEMORY_MAX_ITEMS=7",
    "GAME_DESIGN_MEMORY_CANDIDATE_TTL_DAYS=50",
    "GAME_DESIGN_MEMORY_GIT_MODE=tracked",
  ]);

  const config = await loadMemoryConfig({
    workspaceRoot: root,
    env: {
      GAME_DESIGN_MEMORY_ENABLED: "false",
      GAME_DESIGN_MEMORY_SCOPE: "  ",
      GAME_DESIGN_MEMORY_MAX_ITEMS: "3",
      GAME_DESIGN_MEMORY_CANDIDATE_TTL_DAYS: "",
      GAME_DESIGN_MEMORY_GIT_MODE: "local",
    },
  });

  assert.deepEqual(
    {
      enabled: config.enabled,
      scope: config.scope,
      maxItems: config.maxItems,
      candidateTtlDays: config.candidateTtlDays,
      gitMode: config.gitMode,
      sources: config.sources,
    },
    {
      enabled: false,
      scope: "project",
      maxItems: 5,
      candidateTtlDays: 30,
      gitMode: "local",
      sources: {
        enabled: "environment",
        scope: ".env",
        maxItems: "environment",
        candidateTtlDays: ".env",
        gitMode: "environment",
      },
    },
  );
});

test("invalid enabled disables memory without exposing its value", async (t) => {
  const root = await workspace(t);
  const unsafeValue = "maybe-private-value";
  const config = await loadMemoryConfig({
    workspaceRoot: root,
    env: { GAME_DESIGN_MEMORY_ENABLED: unsafeValue },
  });
  const serialized = JSON.stringify(config);

  assert.equal(config.enabled, false);
  assert.ok(config.warnings.some((warning) => warning.code === "invalid_enabled"));
  assert.equal(serialized.includes(unsafeValue), false);
});

test("global scope is retained only when explicitly valid", async (t) => {
  const root = await workspace(t);
  const explicit = await loadMemoryConfig({
    workspaceRoot: root,
    env: { GAME_DESIGN_MEMORY_SCOPE: "global" },
  });
  const invalid = await loadMemoryConfig({
    workspaceRoot: root,
    env: { GAME_DESIGN_MEMORY_SCOPE: "internet" },
  });

  assert.equal(explicit.scope, "global");
  assert.equal(invalid.scope, "project");
  assert.ok(invalid.warnings.some((warning) => warning.code === "invalid_scope"));
});

test("out-of-range counts and candidate TTLs fall back to safe defaults", async (t) => {
  const root = await workspace(t);
  for (const [maxItems, candidateTtlDays] of [["0", "0"], ["11", "366"]]) {
    const config = await loadMemoryConfig({
      workspaceRoot: root,
      env: {
        GAME_DESIGN_MEMORY_MAX_ITEMS: maxItems,
        GAME_DESIGN_MEMORY_CANDIDATE_TTL_DAYS: candidateTtlDays,
      },
    });
    assert.equal(config.maxItems, 5);
    assert.equal(config.candidateTtlDays, 30);
  }
});

test("memory dotenv attacks are rejected without exposing values", async (t) => {
  const fixtures = [
    ["NUL", "GAME_DESIGN_MEMORY_SCOPE=project\0hidden"],
    ["duplicate", "GAME_DESIGN_MEMORY_SCOPE=project\nGAME_DESIGN_MEMORY_SCOPE=global"],
    ["shell substitution", "GAME_DESIGN_MEMORY_SCOPE=$(whoami)"],
    ["oversized", `#${"x".repeat(64 * 1024)}`],
  ];

  for (const [name, contents] of fixtures) {
    await t.test(name, async (t) => {
      const root = await workspace(t);
      await writeFile(path.join(root, ".env"), `${contents}\n`, { mode: 0o600 });
      await assert.rejects(() => loadMemoryConfig({ workspaceRoot: root, env: {} }), (error) => {
        assert.equal(`${error.message}\n${JSON.stringify(error)}`.includes("hidden"), false);
        return true;
      });
    });
  }
});

test("memory dotenv symlinks are rejected", async (t) => {
  const root = await workspace(t);
  const source = path.join(root, "source.env");
  await writeFile(source, "GAME_DESIGN_MEMORY_SCOPE=global\n", { mode: 0o600 });
  await symlink(source, path.join(root, ".env"));
  await assert.rejects(() => loadMemoryConfig({ workspaceRoot: root, env: {} }), /symlink/i);
});

test("public memory configuration omits no settings and clones diagnostics", async (t) => {
  const root = await workspace(t);
  const config = await loadMemoryConfig({ workspaceRoot: root, env: {} });
  const publicConfig = toPublicMemoryConfig(config);

  assert.deepEqual(publicConfig, {
    enabled: true,
    scope: "project",
    maxItems: 5,
    candidateTtlDays: 30,
    gitMode: "local",
    sources: {
      enabled: "unset",
      scope: "unset",
      maxItems: "unset",
      candidateTtlDays: "unset",
      gitMode: "unset",
    },
    warnings: [],
  });
  assert.notEqual(publicConfig.sources, config.sources);
  assert.notEqual(publicConfig.warnings, config.warnings);
});

test("memory config schema validation returns structured value-free errors", () => {
  assert.deepEqual(
    validateMemoryConfig({ enabled: true, scope: "project", maxItems: 5, candidateTtlDays: 30, gitMode: "local" }),
    { ok: true, errors: [] },
  );
  const validation = validateMemoryConfig({ enabled: "yes", scope: "internet", maxItems: 0, candidateTtlDays: 366, gitMode: "publish" });
  assert.equal(validation.ok, false);
  assert.deepEqual(validation.errors.map((entry) => entry.code), [
    "invalid_enabled",
    "invalid_scope",
    "invalid_max_items",
    "invalid_candidate_ttl_days",
    "invalid_git_mode",
  ]);
  assert.equal(JSON.stringify(validation).includes("internet"), false);
});
