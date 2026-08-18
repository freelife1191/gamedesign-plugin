import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  DiagnosticError,
  assertNoReplacementCharacter,
  compareInstalledFiles,
  redactInstallFailure,
  runInstallRoundtrip,
  samePathAfterNfc,
  treeFingerprint,
} from "../../tooling/install-roundtrip.mjs";

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

    await chmod(target, 0o600);
    assert.notEqual(await treeFingerprint(root), before, "mode change must move the fingerprint");
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
