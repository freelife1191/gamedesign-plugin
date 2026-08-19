import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, open, realpath, rename, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { noFollowOpenFlag } from "../../shared/scripts/lib/platform-file-hardening.mjs";
import {
  loadImageConfig,
  toPublicImageConfig,
  validateImageConfig,
} from "../../shared/scripts/validate-image-config.mjs";
import { PERMISSION_BITS_MEANINGFUL } from "../lib/platform-support.mjs";

const expectedNoFollowFlag = noFollowOpenFlag();

async function workspace(t) {
  const root = await mkdtemp(path.join(tmpdir(), "image-config-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  return realpath(root);
}

async function writeEnv(root, contents, mode = 0o600) {
  const envPath = path.join(root, ".env");
  await writeFile(envPath, contents, { mode });
  await chmod(envPath, mode);
  return envPath;
}

test("safe defaults are used without a workspace .env", async (t) => {
  const root = await workspace(t);
  const config = await loadImageConfig({ workspaceRoot: root, env: {} });

  assert.deepEqual(toPublicImageConfig(config), {
    mode: "prompt-only",
    providerPreference: "codex-first",
    embeddedTextLocale: "none",
    model: "gpt-image-2",
    quality: "low",
    apiKeyPresent: false,
    sources: { mode: "default", providerPreference: "default", embeddedTextLocale: "default", model: "default", quality: "default", apiKey: "none" },
    warnings: [],
  });
  assert.equal(config.apiKey, undefined);
});

test("process values override .env and .env overrides defaults without mutating the supplied environment", async (t) => {
  const root = await workspace(t);
  await writeEnv(root, [
    "IMAGE_GEN_MODE=required",
    "IMAGE_PROVIDER=openai",
    "IMAGE_EMBEDDED_TEXT_LOCALE=ko-KR",
    "IMAGE_MODEL=env-file-model",
    "IMAGE_QUALITY=medium",
    "OPENAI_API_KEY=file-secret-value",
    "",
  ].join("\n"));
  const env = {
    IMAGE_GEN_MODE: " all ",
    IMAGE_PROVIDER: " codex-first ",
    IMAGE_EMBEDDED_TEXT_LOCALE: " none ",
    IMAGE_MODEL: " process-model ",
    IMAGE_QUALITY: " high ",
    OPENAI_API_KEY: " process-secret-value ",
  };
  const before = { ...env };

  const config = await loadImageConfig({ workspaceRoot: root, env });

  assert.deepEqual(
    { mode: config.mode, providerPreference: config.providerPreference, embeddedTextLocale: config.embeddedTextLocale, model: config.model, quality: config.quality, apiKeyPresent: config.apiKeyPresent },
    { mode: "all", providerPreference: "codex-first", embeddedTextLocale: "none", model: "process-model", quality: "high", apiKeyPresent: true },
  );
  assert.deepEqual(config.sources, { mode: "environment", providerPreference: "environment", embeddedTextLocale: "environment", model: "environment", quality: "environment", apiKey: "environment" });
  assert.deepEqual(env, before);
});

test("trimmed-empty values are unset and fall through to .env or defaults", async (t) => {
  const root = await workspace(t);
  await writeEnv(root, "IMAGE_GEN_MODE=select\nIMAGE_MODEL=\nIMAGE_QUALITY=auto\nOPENAI_API_KEY=   \n");

  const config = await loadImageConfig({
    workspaceRoot: root,
    env: { IMAGE_GEN_MODE: "  ", IMAGE_MODEL: "\t", IMAGE_QUALITY: "", OPENAI_API_KEY: " \n " },
  });

  assert.equal(config.mode, "select");
  assert.equal(config.model, "gpt-image-2");
  assert.equal(config.quality, "auto");
  assert.equal(config.apiKeyPresent, false);
  assert.deepEqual(config.sources, { mode: ".env", providerPreference: "default", embeddedTextLocale: "default", model: "default", quality: ".env", apiKey: "none" });
});

test("all closed modes and qualities validate", () => {
  for (const mode of ["required", "all", "select", "prompt-only"]) {
    for (const quality of ["low", "medium", "high", "auto"]) {
      assert.deepEqual(validateImageConfig({ mode, providerPreference: "codex-first", embeddedTextLocale: "none", model: "gpt-image-2", quality }), { ok: true, errors: [] });
    }
  }
});

test("invalid policy values and unsafe model identifiers return value-free structured errors", async (t) => {
  const root = await workspace(t);
  const cases = [
    ["IMAGE_GEN_MODE", "unbounded-mode", "invalid_mode", "mode"],
    ["IMAGE_PROVIDER", "automatic-paid-fallback", "invalid_provider_preference", "providerPreference"],
    ["IMAGE_EMBEDDED_TEXT_LOCALE", "guess-from-prompt", "invalid_embedded_text_locale", "embeddedTextLocale"],
    ["IMAGE_QUALITY", "ultra-costly", "invalid_quality", "quality"],
    ["IMAGE_MODEL", "model/../../escape", "invalid_model", "model"],
  ];

  for (const [name, secretLikeValue, code, field] of cases) {
    await assert.rejects(
      () => loadImageConfig({ workspaceRoot: root, env: { [name]: secretLikeValue } }),
      (error) => {
        assert.equal(String(error).includes(secretLikeValue), false);
        assert.equal(JSON.stringify(error).includes(secretLikeValue), false);
        assert.match(error.message, /invalid image configuration/i);
        assert.ok(error.validation.errors.some((entry) => entry.code === code && entry.path === field));
        return true;
      },
    );
  }
});

test("legacy variables only add migration warnings and cannot alter policy", async (t) => {
  const root = await workspace(t);
  const config = await loadImageConfig({
    workspaceRoot: root,
    env: { IMAGE_GEN_ENABLE: "true", IMAGE_GENERATOR: "codex" },
  });

  assert.equal(config.mode, "prompt-only");
  assert.equal(config.warnings.length, 2);
  assert.ok(config.warnings.every((warning) => warning.includes("IMAGE_GEN_MODE")));
});

test("public configuration structurally omits the key and never serializes any key substring", async (t) => {
  const root = await workspace(t);
  const key = "sk-private-never-expose-42";
  const config = await loadImageConfig({ workspaceRoot: root, env: { OPENAI_API_KEY: key } });
  const publicConfig = toPublicImageConfig(config);
  const serialized = JSON.stringify(publicConfig);

  assert.equal(Object.hasOwn(publicConfig, "apiKey"), false);
  assert.equal(serialized.includes(key), false);
  for (const fragment of ["private", "never-expose", key.slice(-8)]) assert.equal(serialized.includes(fragment), false);
});

test("the parser rejects hostile or ambiguous dotenv syntax without echoing values", async (t) => {
  const cases = [
    ["NUL", "IMAGE_MODEL=safe\0tail\n"],
    ["duplicate", "IMAGE_MODEL=one\nIMAGE_MODEL=two\n"],
    ["command substitution", "IMAGE_MODEL=$(touch nope)\n"],
    ["interpolation", "IMAGE_MODEL=${MODEL}\n"],
    ["quotes", "IMAGE_MODEL=\"gpt-image-2\"\n"],
    ["continuation", "IMAGE_MODEL=gpt-image-\\\n2\n"],
    ["unsupported multiline", " IMAGE_MODEL=gpt-image-2\n"],
  ];
  for (const [name, contents] of cases) {
    await t.test(name, async (t) => {
      const root = await workspace(t);
      await writeEnv(root, contents);
      await assert.rejects(() => loadImageConfig({ workspaceRoot: root, env: {} }), (error) => {
        assert.match(error.message, /invalid \.env/i);
        assert.equal(error.message.includes(contents.trim()), false);
        return true;
      });
    });
  }
});

test("backtick shell syntax is rejected for every supported key without exposing its value", async (t) => {
  for (const keyName of ["IMAGE_GEN_MODE", "IMAGE_PROVIDER", "IMAGE_EMBEDDED_TEXT_LOCALE", "IMAGE_MODEL", "IMAGE_QUALITY", "OPENAI_API_KEY"]) {
    await t.test(keyName, async (t) => {
      const root = await workspace(t);
      const secretLikeValue = `backtick-${keyName.toLowerCase()}-never-print`;
      await writeEnv(root, `${keyName}=\`${secretLikeValue}\`\n`);
      await assert.rejects(() => loadImageConfig({ workspaceRoot: root, env: {} }), (error) => {
        const output = `${error.message}\n${JSON.stringify(error)}`;
        assert.match(error.message, /invalid \.env/i);
        for (const fragment of [secretLikeValue, "backtick", "never-print"]) assert.equal(output.includes(fragment), false);
        return true;
      });
    });
  }
});

test("oversized .env files are rejected before parsing", async (t) => {
  const root = await workspace(t);
  await writeEnv(root, `#${"x".repeat(64 * 1024)}\n`);
  let reads = 0;
  await assert.rejects(() => loadImageConfig({
    workspaceRoot: root,
    env: {},
    readFileFn: async () => {
      reads += 1;
      throw new Error("oversized file was read");
    },
  }), /too large/i);
  assert.equal(reads, 0);
});

test("dotenv failures never expose any substring of an API key on the same file", async (t) => {
  const root = await workspace(t);
  const key = "sk-sensitive-fragment-987654";
  await writeEnv(root, `OPENAI_API_KEY=${key}\nIMAGE_MODEL=$(unsafe)\n`);
  await assert.rejects(() => loadImageConfig({ workspaceRoot: root, env: {} }), (error) => {
    const output = `${error.message}\n${JSON.stringify(error)}`;
    for (const fragment of [key, "sensitive", "fragment", "987654"]) assert.equal(output.includes(fragment), false);
    return true;
  });
});

test("only the workspace-root .env is read", async (t) => {
  const parent = await workspace(t);
  const root = path.join(parent, "workspace");
  await mkdir(root);
  await writeEnv(parent, "IMAGE_GEN_MODE=all\n");
  await writeEnv(root, "IMAGE_GEN_MODE=required\n");
  const reads = new Set();

  const config = await loadImageConfig({
    workspaceRoot: root,
    env: {},
    readFileFn: async (handle, ...args) => {
      reads.add(path.join(root, ".env"));
      return handle.read(...args);
    },
  });

  assert.equal(config.mode, "required");
  assert.deepEqual([...reads], [path.join(root, ".env")]);
});

test("a symlink swapped in after lstat is rejected before outside bytes can be parsed", async (t) => {
  const parent = await workspace(t);
  const root = path.join(parent, "workspace");
  await mkdir(root);
  const envPath = await writeEnv(root, "IMAGE_GEN_MODE=required\n");
  const originalPath = path.join(parent, "original.env");
  const outsidePath = path.join(parent, "outside.env");
  await writeFile(outsidePath, "IMAGE_GEN_MODE=all\n");

  await assert.rejects(() => loadImageConfig({
    workspaceRoot: root,
    env: {},
    openFileFn: async (filePath, flags) => {
      assert.equal(filePath, envPath);
      // Same as the workspace dotenv reader: assert the flag the primitive yields for this platform,
      // not a constant Windows never defines. The rejection below is the subject and runs everywhere.
      assert.equal(flags & expectedNoFollowFlag, expectedNoFollowFlag);
      await rename(filePath, originalPath);
      await symlink(outsidePath, filePath);
      return open(filePath, flags);
    },
  }), /symlink|identity/i);
});

test("a regular file inode swapped in after lstat is rejected and its descriptor is closed", async (t) => {
  const parent = await workspace(t);
  const root = path.join(parent, "workspace");
  await mkdir(root);
  const envPath = await writeEnv(root, "IMAGE_GEN_MODE=required\n");
  const originalPath = path.join(parent, "original.env");
  let closeCount = 0;

  await assert.rejects(() => loadImageConfig({
    workspaceRoot: root,
    env: {},
    openFileFn: async (filePath, flags) => {
      await rename(filePath, originalPath);
      await writeFile(filePath, "IMAGE_GEN_MODE=all\n", { mode: 0o600 });
      const handle = await open(filePath, flags);
      return {
        stat: (...args) => handle.stat(...args),
        read: (...args) => handle.read(...args),
        close: async () => {
          closeCount += 1;
          return handle.close();
        },
      };
    },
  }), /identity/i);
  assert.equal(closeCount, 1);
  assert.equal(envPath, path.join(root, ".env"));
});

test("workspace and .env symlinks are rejected", async (t) => {
  const parent = await workspace(t);
  const realRoot = path.join(parent, "real");
  await mkdir(realRoot);
  await writeEnv(realRoot, "IMAGE_GEN_MODE=all\n");
  const linkedRoot = path.join(parent, "linked");
  await symlink(realRoot, linkedRoot);
  await assert.rejects(() => loadImageConfig({ workspaceRoot: linkedRoot, env: {} }), /symlink/i);

  const secondRoot = path.join(parent, "second");
  await mkdir(secondRoot);
  await symlink(path.join(realRoot, ".env"), path.join(secondRoot, ".env"));
  await assert.rejects(() => loadImageConfig({ workspaceRoot: secondRoot, env: {} }), /symlink/i);
});

test("non-regular .env files are rejected and group/other-readable files warn", async (t) => {
  const root = await workspace(t);
  await mkdir(path.join(root, ".env"));
  await assert.rejects(() => loadImageConfig({ workspaceRoot: root, env: {} }), /regular file/i);
  await rm(path.join(root, ".env"), { recursive: true });

  // The rejection above runs on every platform. The warning below cannot: Windows synthesises
  // Stats.mode from one read-only attribute, so 0o644 and 0o600 are the same number there, chmod is a
  // no-op, and a permission warning would be either always or never emitted regardless of the file.
  if (PERMISSION_BITS_MEANINGFUL) {
    await writeEnv(root, "IMAGE_GEN_MODE=all\n", 0o644);
    const config = await loadImageConfig({ workspaceRoot: root, env: {} });
    assert.ok(config.warnings.some((warning) => /group|other|permission/i.test(warning)));
  }
});
