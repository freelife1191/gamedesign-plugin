import assert from "node:assert/strict";
import { chmod, cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  DiagnosticError,
  assertNoProductStateResidue,
  assertNoReplacementCharacter,
  compareInstalledFiles,
  redactInstallFailure,
  runInstallRoundtrip,
  samePathAfterNfc,
  treeFingerprint,
} from "../../tooling/install-roundtrip.mjs";
import { PERMISSION_BITS_MEANINGFUL } from "../lib/platform-support.mjs";

test("path comparison normalizes to NFC before deciding two paths differ", () => {
  // macOS readdir can hand back the decomposed form; the bytes differ, the path does not.
  const composed = "게임/기획.md";
  const decomposed = composed.normalize("NFD");
  assert.notEqual(composed, decomposed);
  assert.equal(samePathAfterNfc(composed, decomposed), true);
  assert.equal(samePathAfterNfc(composed, "게임/기획서.md"), false);
});

test("a replacement character anywhere in the round-tripped text is a failure", () => {
  assert.doesNotThrow(() => assertNoReplacementCharacter("한글 그대로", "plugin list"));
  assert.throws(() => assertNoReplacementCharacter("한글 � 깨짐", "plugin list"), /plugin list/u);
});

test("the tree fingerprint covers content and mode, and misses neither", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "install-roundtrip-fingerprint-"));
  try {
    await mkdir(path.join(root, "게임 자료"), { recursive: true });
    const target = path.join(root, "게임 자료", "메모.md");
    await writeFile(target, "원본\n", "utf8");
    await chmod(target, 0o644);

    const before = await treeFingerprint(root);
    await writeFile(target, "변조\n", "utf8");
    assert.notEqual(await treeFingerprint(root), before, "content change must move the fingerprint");

    await writeFile(target, "원본\n", "utf8");
    assert.equal(await treeFingerprint(root), before, "restoring the content must restore the fingerprint");

    // The content half above runs everywhere. The mode half needs a mode the platform actually stores:
    // 0o644 and 0o600 differ only in bits Windows does not keep, so the fingerprint there is unchanged and
    // rightly so — there was no mode change to detect.
    if (PERMISSION_BITS_MEANINGFUL) {
      await chmod(target, 0o600);
      assert.notEqual(await treeFingerprint(root), before, "mode change must move the fingerprint");
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("failure messages never carry a home path, a token, or a response body", () => {
  const foreign = new Error(`failed at /Users/someone/.codex with token sk-abc123: {"error":"boom"}`);
  const redacted = redactInstallFailure(foreign);
  assert.doesNotMatch(redacted, /Users|\.codex|sk-|boom/u);
  assert.match(redacted, /details redacted/u);
  // A raw string is foreign too: only text this module authored is allowed through.
  assert.match(redactInstallFailure(foreign.message), /details redacted/u);
});

test("our own diagnostics survive redaction, because a redacted CI failure is unactionable", () => {
  assert.equal(
    redactInstallFailure(new DiagnosticError("game-design-career/README.md differs between source and install cache")),
    "game-design-career/README.md differs between source and install cache",
  );
  assert.throws(() => assertNoReplacementCharacter("깨진 �", "plugin list stdout"), DiagnosticError);
  assert.equal(
    redactInstallFailure(new DiagnosticError("plugin list stdout returned a U+FFFD replacement character")),
    "plugin list stdout returned a U+FFFD replacement character",
  );
});

test("a missing codex CLI is reported as a skip, and refused outright when the gate requires it", async () => {
  const absent = await runInstallRoundtrip({ findExecutableImpl: async () => null });
  assert.equal(absent.status, "SKIPPED");
  assert.equal(absent.reason, "codex-unavailable");
  assert.equal(absent.failure, null);

  await assert.rejects(
    () => runInstallRoundtrip({ requireCodex: true, findExecutableImpl: async () => null }),
    /codex CLI is required/u,
  );
});

test("the source-to-cache comparison catches a one-byte drift, and refuses a cache file that is absent", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "install-roundtrip-compare-"));
  try {
    const source = path.join(root, "원본 패키지");
    const cache = path.join(root, "설치 캐시");
    await mkdir(path.join(source, ".codex-plugin"), { recursive: true });
    await mkdir(path.join(cache, ".codex-plugin"), { recursive: true });
    await writeFile(path.join(source, "README.md"), "게임 기획 스위트\n", "utf8");
    await writeFile(path.join(cache, "README.md"), "게임 기획 스위트\n", "utf8");
    await writeFile(path.join(source, ".codex-plugin/plugin.json"), '{"version":"0.1.1"}\n', "utf8");
    await writeFile(path.join(cache, ".codex-plugin/plugin.json"), '{"version":"0.1.1"}\n', "utf8");

    const relatives = ["README.md", ".codex-plugin/plugin.json"];
    const compared = await compareInstalledFiles(source, cache, relatives, "game-design-career");
    assert.deepEqual(compared.map((entry) => entry.path), relatives);

    await writeFile(path.join(cache, "README.md"), "게임 기획 스위트 \n", "utf8");
    await assert.rejects(
      () => compareInstalledFiles(source, cache, relatives, "game-design-career"),
      /game-design-career\/README\.md differs/u,
    );

    await rm(path.join(cache, "README.md"));
    await assert.rejects(() => compareInstalledFiles(source, cache, relatives, "game-design-career"), /ENOENT/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("a libuv error code survives redaction, because \"command failed\" costs a whole CI round", () => {
  const spawnFailure = Object.assign(new Error("spawnSync C:\\Users\\runner\\AppData\\npm\\codex.cmd EINVAL"), { code: "EINVAL" });
  const redacted = redactInstallFailure(spawnFailure);
  assert.equal(redacted, "EINVAL (details redacted)");
  assert.doesNotMatch(redacted, /Users|codex\.cmd/u);
});

test("state cleanup rejects a removed product ID or source path that survives in Codex JSON", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "install-roundtrip-stale-state-"));
  try {
    const source = path.join(root, "마켓플레이스 소스", "plugins", "game-design-studio");
    await mkdir(path.join(root, "plugins"), { recursive: true });
    await writeFile(
      path.join(root, "plugins", "state.json"),
      JSON.stringify({ installed: [{ pluginId: "game-design-studio@game-design-suite", source: { path: source } }] }),
      "utf8",
    );
    await assert.rejects(
      () => assertNoProductStateResidue(root, new Map([["game-design-studio", source]])),
      /product identifier or source path remains/u,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("the isolated round trip removes each plugin and marketplace without leaving state residue", async () => {
  const tempParent = await mkdtemp(path.join(os.tmpdir(), "install-roundtrip-lifecycle-"));
  const installed = new Map();
  let marketplaceRoot = null;
  const commandLog = [];
  const pluginRecord = (product, source) => ({
    pluginId: `${product}@game-design-suite`,
    name: product,
    marketplaceName: "game-design-suite",
    source: { path: source },
  });
  const writeState = async (env) => {
    await mkdir(path.join(env.CODEX_HOME, "plugins"), { recursive: true });
    await writeFile(
      path.join(env.CODEX_HOME, "plugins", "state.json"),
      JSON.stringify({ installed: [...installed.values()] }),
      "utf8",
    );
  };
  const runImpl = async (_executable, args, { env }) => {
    commandLog.push(args.slice(0, -1));
    if (args[0] !== "plugin") throw new Error(`unexpected command: ${args.join(" ")}`);
    if (args[1] === "marketplace" && args[2] === "add") {
      marketplaceRoot = args[3];
      await mkdir(path.join(env.CODEX_HOME, "marketplaces"), { recursive: true });
      await writeFile(path.join(env.CODEX_HOME, "marketplaces", "game-design-suite.json"), JSON.stringify({ root: marketplaceRoot }), "utf8");
      return { marketplace: "game-design-suite" };
    }
    if (args[1] === "marketplace" && args[2] === "list") {
      return { marketplaces: marketplaceRoot ? [{ name: "game-design-suite", root: marketplaceRoot }] : [] };
    }
    if (args[1] === "marketplace" && args[2] === "remove") {
      marketplaceRoot = null;
      await rm(path.join(env.CODEX_HOME, "marketplaces", "game-design-suite.json"), { force: true });
      await rm(path.join(env.CODEX_HOME, "plugins", "cache", "game-design-suite"), { recursive: true, force: true });
      return { removed: true };
    }
    if (args[1] === "add") {
      const [product] = args[2].split("@");
      const version = JSON.parse(await readFile(path.join(marketplaceRoot, "plugins", product, ".codex-plugin", "plugin.json"), "utf8")).version;
      const source = path.join(marketplaceRoot, "plugins", product);
      const cache = path.join(env.CODEX_HOME, "plugins", "cache", "game-design-suite", product, version);
      await rm(cache, { recursive: true, force: true });
      await mkdir(path.dirname(cache), { recursive: true });
      await cp(source, cache, { recursive: true });
      installed.set(product, pluginRecord(product, source));
      await writeState(env);
      return { installed: true };
    }
    if (args[1] === "remove") {
      const [product] = args[2].split("@");
      installed.delete(product);
      await writeState(env);
      return { removed: true };
    }
    if (args[1] === "list") return { installed: [...installed.values()] };
    throw new Error(`unexpected command: ${args.join(" ")}`);
  };

  try {
    const result = await runInstallRoundtrip({
      repoRoot: fileURLToPath(new URL("../..", import.meta.url)),
      tempParent,
      codexPath: "fake-codex.cmd",
      runImpl,
    });

    assert.equal(result.status, "PASS");
    assert.equal(result.failure, null);
    assert.equal(result.productionStateUnchanged, true);
    assert.equal(result.temporaryStateCleanup, true);
    assert.deepEqual(commandLog.map((args) => args.slice(0, 3)), [
      ["plugin", "marketplace", "add"],
      ["plugin", "add", "game-design-career@game-design-suite"],
      ["plugin", "add", "game-design-career@game-design-suite"],
      ["plugin", "list"],
      ["plugin", "add", "game-design-studio@game-design-suite"],
      ["plugin", "add", "game-design-studio@game-design-suite"],
      ["plugin", "list"],
      ["plugin", "remove", "game-design-studio@game-design-suite"],
      ["plugin", "list"],
      ["plugin", "add", "game-design-studio@game-design-suite"],
      ["plugin", "list"],
      ["plugin", "remove", "game-design-career@game-design-suite"],
      ["plugin", "remove", "game-design-studio@game-design-suite"],
      ["plugin", "marketplace", "remove"],
      ["plugin", "list"],
      ["plugin", "marketplace", "list"],
    ]);
  } finally {
    await rm(tempParent, { recursive: true, force: true });
  }
});
