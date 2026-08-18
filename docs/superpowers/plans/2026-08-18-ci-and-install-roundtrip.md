# CI 신설과 설치 왕복 검증 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PR·push CI를 신설하고, 인증 없이 돌아가는 설치 왕복 검증기를 만들어 Windows·한글 경로에서 두 제품 설치가 바이트 단위로 온전함을 게이트로 고정한다.

**Architecture:** 검증 로직은 전부 `tooling/`의 Node 모듈에 두고 워크플로 YAML은 그 모듈을 호출만 한다. 오프라인 게이트는 기존 `npm run validate` 체인을 재사용하되, CI에서 실행 불가능한 세 스테이지를 조용히 건너뛰는 대신 `validate-suite.mjs`가 `SKIPPED`로 명시 기록하게 확장한다. 설치 왕복 검증은 `marketplace-smoke.mjs`에서 모델 호출(`codex exec`)을 제거한 부분집합에 D절이 요구하는 인코딩·경로·불변성 검사를 더한 신규 모듈 `tooling/install-roundtrip.mjs`로 만든다.

**Tech Stack:** Node.js >= 18 (의존성 0, 락파일 없음), `node:test`, GitHub Actions (`ubuntu-latest`, `windows-latest`), `@openai/codex` CLI.

**Spec:** `docs/superpowers/specs/2026-08-17-suite-entry-upgrade-and-windows-encoding-design.md` (D절 "설치 왕복 검증", "CI 신설", 구현 순서 6단계)

## Global Constraints

스펙 A절 "금지 동작"과 이전 계획의 Global Constraints가 그대로 적용된다. 이 계획에서 특히 걸리는 항목:

- 무승인 자동 업데이트 금지. `auto_upgrade` 류의 설정 키를 만들지 않는다.
- 설치 디렉터리에서 `git reset --hard`, `rm -rf`, 직접 파일 교체, `.bak` 복원 금지.
- 설치된 플러그인 캐시나 번들 스킬 디렉터리를 직접 수정하지 않는다.
- 실패 메시지에 토큰, 사용자 홈 절대 경로, 원격 응답 본문을 노출하지 않는다.
- GitHub API 토큰이나 사용자 API 키를 읽지 않는다.
- 워크플로 권한은 `contents: read`로 폐쇄한다. `persist-credentials: false`를 유지한다.
- 검증기는 실사용자 `~/.codex`를 읽거나 쓰지 않는다. 격리 `HOME`·`CODEX_HOME`만 쓰고, 실행 전후 실사용자 상태 지문이 같아야 한다.
- CI에서 실행할 수 없는 스테이지는 조용히 통과시키지 않고 `SKIPPED`로 기록하며 릴리스 전 로컬 실행을 문서에 필수로 남긴다.
- 플러그인 상대 경로 최대 150자, BOM·CRLF·NFC 충돌·대소문자 충돌 0건 (`tooling/lib/tree-audit.mjs`가 이미 강제).

## File Structure

| 파일 | 책임 |
| --- | --- |
| `tooling/validate-suite.mjs` (수정) | `--skip <stage>` 수용, `SKIPPED` 명시 기록, `--release`와 상호 배타 |
| `tests/unit/validate-suite.test.mjs` (수정) | skip 계약 회귀 |
| `tooling/install-roundtrip.mjs` (신규) | 인증 없는 설치 왕복 검증기. 순수 헬퍼를 export해 단위 테스트 가능하게 유지 |
| `tests/unit/install-roundtrip.test.mjs` (신규) | 순수 헬퍼(NFC 비교, U+FFFD 검사, 지문 비교, 실패 리댁션) 회귀 |
| `.github/workflows/ci.yml` (신규) | 오프라인 게이트·설치 게이트 두 레인 |
| `tests/unit/ci-workflow.test.mjs` (신규) | 워크플로가 스펙 표와 일치하는지 계약 고정 |
| `architecture/plugin-suite.md` (수정) | CI 레인과 `SKIPPED` 스테이지의 릴리스 전 로컬 실행 의무 문서화 |
| `package.json` (수정) | `verify:install-roundtrip` 스크립트 |

---

### Task 1: `validate-suite`의 명시적 SKIPPED 회계

**Files:**
- Modify: `tooling/validate-suite.mjs`
- Test: `tests/unit/validate-suite.test.mjs`

**Interfaces:**
- Consumes: 없음
- Produces: `SKIPPABLE_STAGES` (frozen 배열), `runSuite({ repoRoot, release, skip, runCommand })` → `{ ok, releaseReady, skipped, formatStatus?, failedStage?, rerun? }`

CI에서 돌릴 수 없는 스테이지는 세 개다. `official plugin validators`와 `skill quick validators`는 `tooling/validate-packages.mjs`가 Codex 설치 산출물인 공식 검증기를 요구하고 없으면 예외를 던진다. `format smoke`는 `tests/formats/generators/generate_presentation.mjs`가 `package.json`에 없는 호스트 제공 모듈 `@oai/artifact-tool`을 임포트한다. 이 셋을 워크플로에서 조용히 빼면 CI 통과가 "전부 검증됐다"로 읽힌다. `validate-suite`가 스스로 기록하게 만든다.

- [ ] **Step 1: 실패 테스트 작성**

`tests/unit/validate-suite.test.mjs` 끝에 추가한다. 기존 파일의 import와 헬퍼를 먼저 읽고 이름을 맞춘다.

```js
test("skippable stages are a closed set and a skip is never reported as a pass", async () => {
  const { runSuite, SKIPPABLE_STAGES } = await import(suiteUrl.href);
  assert.deepEqual([...SKIPPABLE_STAGES], [
    "official plugin validators",
    "skill quick validators",
    "format smoke",
  ]);

  const ran = [];
  const result = await runSuite({
    repoRoot,
    skip: ["official plugin validators", "skill quick validators", "format smoke"],
    runCommand: (stage) => {
      ran.push(stage.name);
      return { status: 0, signal: null };
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.releaseReady, false);
  assert.deepEqual(result.skipped, [
    "official plugin validators",
    "skill quick validators",
    "format smoke",
  ]);
  for (const skipped of result.skipped) assert.equal(ran.includes(skipped), false);
});

test("an unknown skip name is refused rather than silently ignored", async () => {
  const { runSuite } = await import(suiteUrl.href);
  await assert.rejects(
    () => runSuite({ repoRoot, skip: ["unit tests"], runCommand: () => ({ status: 0, signal: null }) }),
    /not skippable/u,
  );
});

test("release mode refuses to run with any stage skipped", async () => {
  const { runSuite } = await import(suiteUrl.href);
  await assert.rejects(
    () => runSuite({ repoRoot, release: true, skip: ["format smoke"], runCommand: () => ({ status: 0, signal: null }) }),
    /release runs every stage/u,
  );
});
```

- [ ] **Step 2: 실패 확인**

Run: `node --test tests/unit/validate-suite.test.mjs`
Expected: FAIL — `SKIPPABLE_STAGES` 미정의, `skip` 옵션 무시.

- [ ] **Step 3: 구현**

`tooling/validate-suite.mjs`의 `STAGES` 아래에 추가한다.

```js
// CI에서 이 셋은 실행할 수 없다. 공식 plugin·skill 검증기는 Codex 설치 산출물이고, format smoke는
// package.json에 없는 호스트 제공 모듈을 임포트한다. 빼는 것 자체는 정당하지만 조용히 빼면 CI 통과가
// "전부 검증됐다"로 읽힌다. 목록을 여기 폐쇄해 두고, 건너뛴 사실을 PASS와 다른 줄로 남긴다.
export const SKIPPABLE_STAGES = Object.freeze([
  "official plugin validators",
  "skill quick validators",
  "format smoke",
]);
```

`runSuite` 시그니처를 `{ repoRoot, release = false, skip = [], runCommand = defaultRunCommand }`로 바꾸고 본문 맨 앞에 검증을 넣는다.

```js
  const skipped = [...new Set(skip)];
  for (const name of skipped) {
    if (!SKIPPABLE_STAGES.includes(name)) throw new Error(`${name} is not skippable`);
  }
  if (release && skipped.length > 0) throw new Error("release runs every stage; --skip is refused");
  const isSkipped = (name) => skipped.includes(name);
```

`STAGES.slice(0, -1)` 루프의 첫 줄을 바꾼다.

```js
  for (const stage of STAGES.slice(0, -1)) {
    if (isSkipped(stage.name)) {
      process.stdout.write(`[suite] SKIP: ${stage.name} (run locally before release)\n`);
      continue;
    }
    process.stdout.write(`[suite] ${stage.name}\n`);
```

format smoke 블록 진입 전에 분기를 추가한다. `formatState` 조회 자체를 건너뛰어야 한다 — 스킵인데 PARTIAL로 실패하면 안 된다.

```js
  const formatStage = STAGES.at(-1);
  if (isSkipped(formatStage.name)) {
    process.stdout.write(`[suite] SKIP: ${formatStage.name} (run locally before release)\n`);
    process.stdout.write(`Suite release readiness: INCOMPLETE (skipped: ${skipped.join(", ")})\n`);
    return { ok: true, releaseReady: false, skipped, formatStatus: "SKIPPED" };
  }

  const state = await formatState(absoluteRoot);
```

기존 `const state = ...`와 `const formatStage = ...` 두 줄은 위 블록으로 대체된다 (`formatStage`가 먼저 선언되도록 순서가 바뀐다).

남은 반환 지점에 `skipped`를 실어 준다. 이른 실패 반환 세 곳과 최종 성공 반환에 `skipped`를 추가하고, 최종 성공 줄을 스킵 여부에 따라 바꾼다.

```js
  process.stdout.write("[suite] PASS: format smoke\n");
  process.stdout.write(skipped.length === 0
    ? "Suite release readiness: COMPLETE\n"
    : `Suite release readiness: INCOMPLETE (skipped: ${skipped.join(", ")})\n`);
  return { ok: true, releaseReady: skipped.length === 0, skipped, formatStatus: "PASS" };
```

`main()`의 인자 파서를 교체한다.

```js
async function main() {
  const args = process.argv.slice(2);
  const skip = [];
  let release = false;
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--release") {
      if (release) throw new Error("Usage: node tooling/validate-suite.mjs [--release] [--skip <stage>]...");
      release = true;
    } else if (args[index] === "--skip") {
      const name = args[index + 1];
      if (name === undefined) throw new Error("--skip needs a stage name");
      skip.push(name);
      index += 1;
    } else {
      throw new Error("Usage: node tooling/validate-suite.mjs [--release] [--skip <stage>]...");
    }
  }
  const result = await runSuite({ release, skip });
  if (!result.ok) process.exitCode = 1;
}
```

- [ ] **Step 4: 통과 확인**

Run: `node --test tests/unit/validate-suite.test.mjs`
Expected: PASS (신규 3건 포함 전부)

- [ ] **Step 5: 전체 게이트**

Run: `npm run validate`
Expected: `EXIT=0`, `Suite release readiness: COMPLETE` — 스킵 없이 호출하면 동작이 이전과 동일해야 한다.

- [ ] **Step 6: 커밋**

```bash
git add tooling/validate-suite.mjs tests/unit/validate-suite.test.mjs
git commit -m "feat: record a skipped validation stage instead of passing it silently"
```

---

### Task 2: 인증 없는 설치 왕복 검증기

**Files:**
- Create: `tooling/install-roundtrip.mjs`
- Create: `tests/unit/install-roundtrip.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: `tooling/lib/guarded-temp.mjs`의 `createGuardedTempRoot`/`cleanupGuardedTempRoot`, `tooling/lib/hash.mjs`의 `sha256`, `tooling/lib/copy-tree.mjs`의 `copyTree`
- Produces: `runInstallRoundtrip({ repoRoot, tempParent, requireCodex, findExecutableImpl })` → `{ status, products, skipped?, productionStateUnchanged, temporaryStateCleanup, failure }`, 그리고 순수 헬퍼 `samePathAfterNfc`, `assertNoReplacementCharacter`, `treeFingerprint`, `redactInstallFailure`

`marketplace-smoke.mjs`는 `codex exec`로 모델을 호출하므로 인증이 필요하고 CI에서 못 쓴다. 이 모듈은 그 앞부분 — 마켓플레이스 등록, `plugin add`, `plugin list --json`, 캐시 검증 — 만 남기고 D절이 요구하는 검사를 더한다. `marketplace-smoke.mjs`를 임포트하지 않는다. 그쪽은 스크립트로도 실행되는 큰 모듈이고, 여기서 필요한 것은 작은 부분집합이다.

한글·공백 경로는 임시 루트 안에서 만든다. 실제 디렉터리 이름은 아래 상수를 그대로 쓴다.

**Step 1: 실패 테스트 작성**

- [ ] `tests/unit/install-roundtrip.test.mjs`를 만든다.

```js
import assert from "node:assert/strict";
import { chmod, mkdir, writeFile } from "node:fs/promises";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

const moduleUrl = new URL("../../tooling/install-roundtrip.mjs", import.meta.url);

test("path comparison normalizes to NFC before deciding two paths differ", async () => {
  const { samePathAfterNfc } = await import(moduleUrl.href);
  // macOS readdir can hand back the decomposed form; the bytes differ, the path does not.
  const composed = "게임/기획.md";
  const decomposed = composed.normalize("NFD");
  assert.notEqual(composed, decomposed);
  assert.equal(samePathAfterNfc(composed, decomposed), true);
  assert.equal(samePathAfterNfc(composed, "게임/기획서.md"), false);
});

test("a replacement character anywhere in the round-tripped text is a failure", async () => {
  const { assertNoReplacementCharacter } = await import(moduleUrl.href);
  assert.doesNotThrow(() => assertNoReplacementCharacter("한글 그대로", "plugin list"));
  assert.throws(() => assertNoReplacementCharacter("한글 � 깨짐", "plugin list"), /plugin list/u);
});

test("the tree fingerprint covers content and mode, and misses neither", async () => {
  const { treeFingerprint } = await import(moduleUrl.href);
  const root = await mkdtemp(path.join(tmpdir(), "install-roundtrip-fingerprint-"));
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
});

test("failure messages never carry a home path, a token, or a response body", async () => {
  const { redactInstallFailure } = await import(moduleUrl.href);
  const raw = `failed at /Users/someone/.codex with token sk-abc123: {"error":"boom"}`;
  const redacted = redactInstallFailure(raw);
  assert.doesNotMatch(redacted, /Users|\.codex|sk-|boom/u);
  assert.match(redacted, /details redacted/u);
});
```

- [ ] **Step 2: 실패 확인**

Run: `node --test tests/unit/install-roundtrip.test.mjs`
Expected: FAIL — `Cannot find module .../tooling/install-roundtrip.mjs`

- [ ] **Step 3: 구현 — 순수 헬퍼**

`tooling/install-roundtrip.mjs`를 만들고 헤더와 헬퍼를 먼저 쓴다.

```js
#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstat, mkdir, readFile, readdir, realpath } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

import { copyTree } from "./lib/copy-tree.mjs";
import { cleanupGuardedTempRoot, createGuardedTempRoot } from "./lib/guarded-temp.mjs";
import { sha256 } from "./lib/hash.mjs";

const MARKETPLACE = "game-design-suite";
const PRODUCTS = Object.freeze(["game-design-career", "game-design-studio"]);
// Every path the round trip touches carries a Hangul syllable and a space, because that pair is what
// breaks on a Windows code page and in a shell that was handed an unquoted argument. A run over ASCII
// paths proves nothing about the environment this suite actually installs into.
const HANGUL_DIRECTORIES = Object.freeze({
  home: "홈 디렉터리",
  codexHome: "코덱스 홈",
  marketplace: "마켓플레이스 소스",
  workspace: "작업 공간",
  temp: "임시 파일",
});
// The three files that must survive byte-for-byte: the Korean README is the largest Hangul payload in
// the package, plugin.json is what the host parses, and the product's entry skill is what a user first
// runs. If any of these three drifts between source and cache, the install is not the package.
const COMPARED_FILES = Object.freeze({
  "game-design-career": Object.freeze(["README.md", "plugin.json", "skills/game-design-career/SKILL.md"]),
  "game-design-studio": Object.freeze(["README.md", "plugin.json", "skills/game-design-studio/SKILL.md"]),
});

export function samePathAfterNfc(left, right) {
  return String(left).normalize("NFC") === String(right).normalize("NFC");
}

export function assertNoReplacementCharacter(text, label) {
  if (String(text).includes("�")) throw new Error(`${label} returned a U+FFFD replacement character`);
}

export function redactInstallFailure(message) {
  const source = String(message);
  if (/ENOENT/u.test(source)) return "a required file was missing (details redacted)";
  if (/timed out|ETIMEDOUT/iu.test(source)) return "a command timed out (details redacted)";
  return "command failed (details redacted)";
}

// Content plus mode plus the NFC-normalized relative path. The spec requires bytes AND mode to be
// unchanged across install, update, and reinstall, so a fingerprint that only hashes content would
// pass a run that quietly flipped a file to 0600.
export async function treeFingerprint(root) {
  const hash = createHash("sha256");
  const walk = async (directory, prefix) => {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries.sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0))) {
      const absolute = path.join(directory, entry.name);
      const relative = path.posix.join(prefix, entry.name).normalize("NFC");
      const stats = await lstat(absolute);
      if (stats.isSymbolicLink()) throw new Error("fingerprinted tree contains a symlink");
      if (stats.isDirectory()) {
        hash.update(`D ${relative} ${(stats.mode & 0o7777).toString(8)}\n`);
        await walk(absolute, relative);
        continue;
      }
      if (!stats.isFile()) throw new Error("fingerprinted tree contains a non-regular file");
      hash.update(`F ${relative} ${(stats.mode & 0o7777).toString(8)} ${sha256(await readFile(absolute))}\n`);
    }
  };
  await walk(root, ".");
  return hash.digest("hex");
}
```

- [ ] **Step 4: 순수 헬퍼 테스트 통과 확인**

Run: `node --test tests/unit/install-roundtrip.test.mjs`
Expected: PASS (4건)

- [ ] **Step 5: 구현 — 실행부**

같은 파일에 이어 쓴다.

```js
function run(command, args, { cwd, env, timeout = 180_000, json = false }) {
  const result = spawnSync(command, args, { cwd, env, encoding: "utf8", shell: false, timeout });
  if (result.error) throw result.error;
  if (result.signal) throw new Error(`${path.basename(command)} terminated by ${result.signal}`);
  if (result.status !== 0) throw new Error(`${path.basename(command)} exited ${result.status}`);
  assertNoReplacementCharacter(result.stdout, `${path.basename(command)} stdout`);
  assertNoReplacementCharacter(result.stderr, `${path.basename(command)} stderr`);
  if (!json) return result.stdout;
  try {
    return JSON.parse(result.stdout);
  } catch {
    throw new Error(`${path.basename(command)} returned invalid JSON`);
  }
}

async function findExecutable(name) {
  const extensions = process.platform === "win32" ? [".cmd", ".exe", ".bat", ""] : [""];
  for (const directory of (process.env.PATH ?? "").split(path.delimiter).filter(Boolean)) {
    for (const extension of extensions) {
      const candidate = path.join(directory, `${name}${extension}`);
      const stats = await lstat(candidate).catch(() => null);
      if (stats?.isFile()) return candidate;
    }
  }
  return null;
}

// The user's real Codex home is never an input to this check, but a bug that wrote into it would be
// the worst possible failure, so we prove it did not move.
async function productionFingerprint() {
  const root = process.env.CODEX_HOME ? path.resolve(process.env.CODEX_HOME) : path.join(homedir(), ".codex");
  const entries = await readdir(root, { withFileTypes: true }).catch(() => null);
  if (entries === null) return "absent";
  return sha256(Buffer.from(entries.map((entry) => `${entry.name.normalize("NFC")}:${entry.isDirectory() ? "d" : "f"}`).sort().join("\n"), "utf8"));
}

function isolatedEnvironment(root) {
  return {
    HOME: path.join(root, HANGUL_DIRECTORIES.home),
    USERPROFILE: path.join(root, HANGUL_DIRECTORIES.home),
    CODEX_HOME: path.join(root, HANGUL_DIRECTORIES.codexHome),
    TMPDIR: path.join(root, HANGUL_DIRECTORIES.temp),
    TEMP: path.join(root, HANGUL_DIRECTORIES.temp),
    TMP: path.join(root, HANGUL_DIRECTORIES.temp),
    PATH: process.env.PATH ?? "",
    // The spec pins the round trip to the C locale on purpose: it is the environment where a decoder
    // that guesses the code page instead of using UTF-8 produces U+FFFD, which is what we assert against.
    LANG: "C",
    LC_ALL: "C",
    GAME_DESIGN_UPDATE_CHECKS: "false",
  };
}

async function stageMarketplaceSource(repoRoot, destination) {
  await mkdir(destination, { recursive: true });
  await copyTree(path.join(repoRoot, ".agents"), path.join(destination, ".agents"), { label: "marketplace manifest" });
  await copyTree(path.join(repoRoot, "plugins"), path.join(destination, "plugins"), { label: "marketplace plugins" });
}

export async function runInstallRoundtrip({
  repoRoot = fileURLToPath(new URL("..", import.meta.url)),
  tempParent = tmpdir(),
  requireCodex = false,
  findExecutableImpl = findExecutable,
} = {}) {
  const codex = await findExecutableImpl("codex");
  if (!codex) {
    if (requireCodex) throw new Error("codex CLI is required for the install gate but was not found on PATH");
    return { status: "SKIPPED", reason: "codex-unavailable", products: [], productionStateUnchanged: true, temporaryStateCleanup: true, failure: null };
  }

  const canonicalRepoRoot = path.resolve(repoRoot);
  const before = await productionFingerprint();
  const registration = await createGuardedTempRoot({ parent: tempParent, prefix: "game-design-install-roundtrip-" });
  const env = isolatedEnvironment(registration.root);
  const marketplaceRoot = path.join(registration.root, HANGUL_DIRECTORIES.marketplace);
  const workspace = path.join(registration.root, HANGUL_DIRECTORIES.workspace);
  const products = [];
  let status = "INCOMPLETE";
  let failure = null;
  let temporaryStateCleanup = false;

  try {
    await Promise.all([env.HOME, env.CODEX_HOME, env.TMPDIR, workspace].map((directory) => mkdir(directory, { recursive: true })));
    await mkdir(path.join(workspace, ".game-design"), { recursive: true });
    await stageMarketplaceSource(canonicalRepoRoot, marketplaceRoot);

    run(codex, ["plugin", "marketplace", "add", marketplaceRoot, "--json"], { cwd: workspace, env, json: true });
    const workspaceBefore = await treeFingerprint(workspace);

    for (const product of PRODUCTS) {
      const manifest = JSON.parse(await readFile(path.join(marketplaceRoot, "plugins", product, "plugin.json"), "utf8"));
      const version = manifest.version;
      const cacheRoot = path.join(env.CODEX_HOME, "plugins", "cache", MARKETPLACE, product, version);

      // Install, reinstall, install again. The spec requires the workspace to be untouched across all
      // three, and requires the second install to be a real no-op rather than a partial rewrite.
      for (const attempt of ["install", "reinstall"]) {
        run(codex, ["plugin", "add", `${product}@${MARKETPLACE}`, "--json"], { cwd: workspace, env, json: true });
        if (!samePathAfterNfc(await realpath(cacheRoot), cacheRoot)) {
          throw new Error(`${attempt} resolved the plugin cache outside its declared path`);
        }
      }

      const listed = run(codex, ["plugin", "list", "--json"], { cwd: workspace, env, json: true });
      assertNoReplacementCharacter(JSON.stringify(listed), "plugin list");

      const compared = [];
      for (const relative of COMPARED_FILES[product]) {
        const sourceBytes = await readFile(path.join(marketplaceRoot, "plugins", product, relative));
        const cachedBytes = await readFile(path.join(cacheRoot, relative));
        const digest = sha256(sourceBytes);
        if (digest !== sha256(cachedBytes)) throw new Error(`${product}/${relative} differs between source and install cache`);
        assertNoReplacementCharacter(sourceBytes.toString("utf8"), `${product}/${relative}`);
        compared.push({ path: relative, sha256: digest });
      }

      products.push({ product, version, compared });
    }

    if (await treeFingerprint(workspace) !== workspaceBefore) {
      throw new Error("the workspace changed across install and reinstall");
    }
    status = "PASS";
  } catch (error) {
    failure = { code: "install-roundtrip-failed", message: redactInstallFailure(error instanceof Error ? error.message : error) };
  } finally {
    try {
      await cleanupGuardedTempRoot(registration);
      temporaryStateCleanup = true;
    } catch {
      status = "INCOMPLETE";
      failure ??= { code: "temporary-cleanup-failed", message: "temporary state could not be removed" };
    }
  }

  const productionStateUnchanged = (await productionFingerprint()) === before;
  if (!productionStateUnchanged) {
    status = "INCOMPLETE";
    failure = { code: "production-state-changed", message: "the real Codex home changed during the round trip" };
  }
  return { status, products, productionStateUnchanged, temporaryStateCleanup, failure };
}

async function main() {
  const args = process.argv.slice(2);
  let requireCodex = false;
  let tempParent = tmpdir();
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--require-codex") requireCodex = true;
    else if (args[index] === "--temp-parent" && args[index + 1] !== undefined) {
      tempParent = args[index + 1];
      index += 1;
    } else throw new Error("Usage: node tooling/install-roundtrip.mjs [--require-codex] [--temp-parent <directory>]");
  }
  const result = await runInstallRoundtrip({ requireCodex, tempParent });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (result.status === "INCOMPLETE") process.exitCode = 1;
}

const entry = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (entry && pathToFileURL(entry).href === import.meta.url) {
  main().catch((error) => {
    process.stderr.write(`${redactInstallFailure(error instanceof Error ? error.message : error)}\n`);
    process.exitCode = 1;
  });
}
```

- [ ] **Step 6: `copyTree` 시그니처 확인 후 호출부 정정**

`tooling/lib/copy-tree.mjs`의 `copyTree(sourceRoot, destinationRoot, options)`를 읽고 실제 필수 옵션에 맞춘다. 위 코드의 `{ label }`은 가정이다. 시그니처가 다르면 호출을 고치고, `copyTree`가 이 용도에 맞지 않으면 `node:fs/promises`의 `cp(source, destination, { recursive: true, verbatimSymlinks: false })`로 대체한다.

- [ ] **Step 7: npm 스크립트 추가**

`package.json`의 `smoke:marketplace` 바로 아래에 넣는다.

```json
    "verify:install-roundtrip": "node tooling/install-roundtrip.mjs",
```

- [ ] **Step 8: 로컬 실행**

Run: `npm run verify:install-roundtrip`
Expected: `codex`가 PATH에 있으면 `"status": "PASS"`와 제품 2개의 비교 결과. 없으면 `"status": "SKIPPED"`, exit 0.

실패하면 원인을 고친다. 특히 확인할 것: `plugin.json`의 `version` 필드명, 대표 스킬 경로 `skills/<product>/SKILL.md`의 실재, `codex plugin add`가 한글 `CODEX_HOME`을 받아들이는지.

- [ ] **Step 9: 전체 게이트**

Run: `npm run validate`
Expected: `EXIT=0`. 신규 `tooling/*.mjs`가 reference drift·evidence audit·package-contents 게이트에 걸리면 그 게이트가 요구하는 등록을 마친다.

- [ ] **Step 10: 커밋**

```bash
git add tooling/install-roundtrip.mjs tests/unit/install-roundtrip.test.mjs package.json
git commit -m "feat: verify a Hangul-path install round trip without model authentication"
```

---

### Task 3: CI 워크플로와 그 계약

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `tests/unit/ci-workflow.test.mjs`
- Modify: `architecture/plugin-suite.md`

**Interfaces:**
- Consumes: Task 1의 `validate-suite --skip`, Task 2의 `tooling/install-roundtrip.mjs --require-codex`
- Produces: 없음

워크플로 YAML은 사람이 손으로 고치기 쉽고 조용히 약해지기 쉽다. 스펙 표의 두 레인·두 OS·세 스킵 스테이지를 계약 테스트로 못 박는다.

- [ ] **Step 1: 실패 테스트 작성**

`tests/unit/ci-workflow.test.mjs`를 만든다. YAML 파서를 새로 쓰지 않고 원문에 직접 정규식을 건다. 파싱 계층이 얇을수록 계약이 무엇을 보장하는지 읽기 쉽다.

```js
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const workflowPath = path.join(repoRoot, ".github/workflows/ci.yml");

test("CI runs both lanes on both operating systems with read-only credentials", async () => {
  const workflow = await readFile(workflowPath, "utf8");

  assert.match(workflow, /^on:$/mu, "CI must be event-driven, not schedule-only");
  assert.match(workflow, /^  pull_request:$/mu);
  assert.match(workflow, /^  push:$/mu);
  assert.match(workflow, /^permissions:\n  contents: read$/mu, "the workflow must not be able to write to the repository");
  assert.equal(/persist-credentials: false/gu.test(workflow), true);

  for (const lane of ["offline-gate", "install-gate"]) {
    assert.match(workflow, new RegExp(`^  ${lane}:$`, "mu"), `the ${lane} lane must exist`);
  }
  for (const runner of ["ubuntu-latest", "windows-latest"]) {
    assert.equal(
      (workflow.match(new RegExp(runner, "gu")) ?? []).length,
      2,
      `${runner} must appear once per lane matrix`,
    );
  }
});

test("the offline lane names every stage it skips, and skips only what CI genuinely cannot run", async () => {
  const workflow = await readFile(workflowPath, "utf8");
  const { SKIPPABLE_STAGES } = await import(new URL("../../tooling/validate-suite.mjs", import.meta.url).href);

  const skipped = [...workflow.matchAll(/--skip "([^"]+)"/gu)].map((match) => match[1]);
  assert.deepEqual(skipped, [...SKIPPABLE_STAGES], "the workflow's skip list and the tool's skippable set must be the same closed set");
  assert.match(workflow, /run locally before release/u, "the workflow must say out loud that a skipped stage is still owed");
});

test("the install lane forces the round trip to fail rather than skip when codex is missing", async () => {
  const workflow = await readFile(workflowPath, "utf8");
  assert.match(workflow, /install-roundtrip\.mjs --require-codex/u);
  assert.match(workflow, /npm install -g @openai\/codex/u);
  assert.doesNotMatch(workflow, /OPENAI_API_KEY|CODEX_API_KEY|secrets\./u, "the install gate must not need or touch credentials");
});
```

- [ ] **Step 2: 실패 확인**

Run: `node --test tests/unit/ci-workflow.test.mjs`
Expected: FAIL — `ENOENT .github/workflows/ci.yml`

- [ ] **Step 3: 워크플로 작성**

`.github/workflows/ci.yml`:

```yaml
name: CI

on:
  pull_request:
  push:
    branches:
      - main
  workflow_dispatch:

permissions:
  contents: read

jobs:
  offline-gate:
    name: Offline gate (${{ matrix.os }})
    runs-on: ${{ matrix.os }}
    strategy:
      fail-fast: false
      matrix:
        os:
          - ubuntu-latest
          - windows-latest
    steps:
      - uses: actions/checkout@v4
        with:
          persist-credentials: false
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      # The official plugin and skill validators ship with a Codex install, and the format smoke
      # imports a host-provided module that is not a dependency of this package. Neither can run
      # here. validate-suite records them as SKIPPED so a green CI run is never read as a full pass.
      - name: Validate suite
        run: >-
          node tooling/validate-suite.mjs
          --skip "official plugin validators"
          --skip "skill quick validators"
          --skip "format smoke"
      - name: Note the stages CI could not run
        if: always()
        run: |
          echo "Skipped in CI, run locally before release:" >> "$GITHUB_STEP_SUMMARY"
          echo "- official plugin validators" >> "$GITHUB_STEP_SUMMARY"
          echo "- skill quick validators" >> "$GITHUB_STEP_SUMMARY"
          echo "- format smoke" >> "$GITHUB_STEP_SUMMARY"
        shell: bash

  install-gate:
    name: Install gate (${{ matrix.os }})
    runs-on: ${{ matrix.os }}
    strategy:
      fail-fast: false
      matrix:
        os:
          - ubuntu-latest
          - windows-latest
    steps:
      - uses: actions/checkout@v4
        with:
          persist-credentials: false
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - name: Install the Codex CLI
        run: npm install -g @openai/codex
      # No model is called, so no credential is needed and none is provided. The round trip installs
      # both products under a Hangul, space-containing CODEX_HOME and workspace and compares bytes.
      - name: Install round trip
        run: node tooling/install-roundtrip.mjs --require-codex
```

- [ ] **Step 4: 통과 확인**

Run: `node --test tests/unit/ci-workflow.test.mjs`
Expected: PASS (3건)

- [ ] **Step 5: 문서화**

`architecture/plugin-suite.md`의 183행 부근 검증 문단 바로 뒤에 넣는다. 앞뒤 문장을 먼저 읽고 문체를 맞춘다.

```markdown
CI는 `.github/workflows/ci.yml`에서 두 레인을 `ubuntu-latest`와 `windows-latest` 양쪽으로 실행합니다. 오프라인 게이트는 `npm run validate`와 같은 체인을 돌리되 CI에서 실행할 수 없는 세 스테이지 — 공식 plugin 검증기, skill quick 검증기, format smoke — 를 `--skip`으로 넘기고 `SKIPPED`로 기록합니다. 설치 게이트는 `@openai/codex`를 설치한 뒤 `node tooling/install-roundtrip.mjs --require-codex`로 한글·공백 경로에서 두 제품 설치를 왕복 검증합니다. 모델을 호출하지 않으므로 인증이 필요 없습니다.

CI가 `SKIPPED`로 남긴 세 스테이지는 릴리스 전에 로컬에서 반드시 실행합니다. `npm run validate:release`는 `--skip`을 거부하므로 이 세 스테이지를 건너뛴 채로 릴리스 게이트를 통과할 수 없습니다. 인증이 필요한 라이브 스모크 `npm run smoke:marketplace`도 로컬 수동 실행으로 남습니다.
```

- [ ] **Step 6: 전체 게이트**

Run: `npm run validate`
Expected: `EXIT=0`, `Suite release readiness: COMPLETE`

- [ ] **Step 7: 커밋**

```bash
git add .github/workflows/ci.yml tests/unit/ci-workflow.test.mjs architecture/plugin-suite.md
git commit -m "ci: gate every push and pull request on both operating systems"
```

---

### Task 4: CI 실측과 수렴

**Files:**
- Modify: 앞선 세 태스크가 만든 파일 중 CI가 깨뜨리는 것

**Interfaces:**
- Consumes: Task 3의 워크플로
- Produces: 초록 CI 실행 기록

이 저장소에는 지금까지 PR·push CI가 없었다. Windows 러너와 `ubuntu-latest`에서 전체 스위트가 도는 것은 이번이 처음이므로, 첫 실행이 통과할 것으로 가정하지 않는다. 이 태스크의 산출물은 코드가 아니라 초록 실행이다.

- [ ] **Step 1: 푸시 승인 요청**

워크플로를 푸시하면 GitHub Actions가 즉시 실행된다. 저장소 밖으로 나가는 동작이므로 사용자 승인 없이 하지 않는다. 브랜치와 실행될 레인 4개(오프라인 ubuntu·windows, 설치 ubuntu·windows)를 알리고 승인을 받는다.

- [ ] **Step 2: 푸시**

```bash
git push -u origin feature/ci-and-install-roundtrip
```

- [ ] **Step 3: 실행 관찰**

```bash
gh run list --branch feature/ci-and-install-roundtrip --limit 4
gh run watch
```

- [ ] **Step 4: 실패 분류와 수정**

실패는 세 종류로 나뉜다. 분류를 먼저 하고 고친다.

1. **테스트가 POSIX를 가정한 경우** — 경로 구분자, `chmod`/mode 비트, 셸 의존. 테스트를 플랫폼 중립으로 고친다. Windows에서 mode 비트는 의미가 제한적이므로 `treeFingerprint`의 mode 비교를 `process.platform === "win32"`에서 완화해야 할 수 있다. 완화한다면 그 사실을 주석과 테스트로 남기고, 조용히 빼지 않는다.
2. **제품 코드가 진짜로 Windows에서 깨지는 경우** — 이것이 이 게이트를 만든 이유다. 수정하고 회귀 테스트를 붙인다.
3. **러너 환경 문제** — `@openai/codex` 설치 실패, 타임아웃. 워크플로를 고친다.

각 수정은 자체 커밋으로 남기고 푸시해 재실행한다.

- [ ] **Step 5: 4개 레인 전부 초록 확인**

Expected: `offline-gate (ubuntu-latest)`, `offline-gate (windows-latest)`, `install-gate (ubuntu-latest)`, `install-gate (windows-latest)` 모두 성공.

일부가 끝내 통과하지 못하면 조용히 지우거나 `continue-on-error`로 덮지 않는다. 사용자에게 무엇이 왜 실패하는지 보고하고 판단을 받는다.

- [ ] **Step 6: 최종 로컬 게이트**

Run: `npm run validate`
Expected: `EXIT=0`, `Suite release readiness: COMPLETE`

---

## 실제 결말

Step 5의 기대는 4레인이었으나 3레인으로 끝났습니다. 계획이 틀렸다기보다, 계획이 알 수 없던 것을 CI가 알려준 결과입니다.

다섯 라운드 동안 CI는 macOS에서 단 하나도 보이지 않던 결함 열한 개를 드러냈습니다. Windows spawn 실패 둘(`npm.cmd`, `codex.cmd`), Linux 고유 동작 둘(inode 재사용, Node 버전에 따라 갈리는 이벤트 루프 종료), 호스트 의존 공백 셋(Archify 호스트 CLI, PNG 래스터, isolation smoke의 내장 검증기), 진단 가능성 결함 하나(과도한 redaction), 행 가시성 결함 하나(파일당 천장 부재), 그리고 그 천장을 너무 낮게 잡아 정상적으로 느린 파일을 잘라낸 후속 결함 하나입니다.

Windows 오프라인 레인은 만들어 돌린 뒤 의도적으로 뺐습니다. 실패 272건 중 77건이 출하 코드 결함(`load-workspace-env`의 `O_NOFOLLOW` 거부, `safe-memory-store`의 디렉터리 fsync)이고, 이는 하드닝 원시 함수 재설계라는 별도 작업입니다. 근거는 `.github/workflows/ci.yml`의 해당 레인 위, `architecture/plugin-suite.md`의 부류별 표, 그리고 레인별 매트릭스를 각각 읽는 `tests/unit/ci-workflow.test.mjs` 세 곳에 남겼습니다. 스펙 D절이 요구하는 Windows 계약 — Windows checkout과 설치가 다른 플랫폼과 같은 바이트를 만든다 — 은 설치 게이트가 Windows에서 매 실행마다 증명합니다.

최종 상태는 `offline-gate (ubuntu-latest)`, `install-gate (ubuntu-latest)`, `install-gate (windows-latest)` 세 레인 성공입니다.

---

## Self-Review

**스펙 커버리지**

| 스펙 요구 | 태스크 |
| --- | --- |
| 오프라인 게이트 레인 (ubuntu + windows) | Task 3 |
| 설치 게이트 레인 (ubuntu + windows, codex 설치 → marketplace add → plugin add → plugin list --json) | Task 2, Task 3 |
| 한글·공백 `CODEX_HOME`과 workspace | Task 2 (`HANGUL_DIRECTORIES`) |
| 라이브 스모크는 로컬·수동 유지 | Task 3 Step 5 문서화 |
| 실행 불가 스테이지를 `SKIPPED`로 기록, 릴리스 전 로컬 실행 문서화 | Task 1, Task 3 |
| source 대 설치 캐시 SHA-256 대조 (README, 대표 SKILL.md, plugin.json) | Task 2 (`COMPARED_FILES`) |
| 경로는 NFC 정규화 후 비교 | Task 2 (`samePathAfterNfc`, `treeFingerprint`) |
| `U+FFFD` 부재 | Task 2 (`assertNoReplacementCharacter`) |
| 설치·업데이트·재설치 전후 workspace·`.game-design/`·sibling 바이트와 mode 동일 | Task 2 (`treeFingerprint`, install/reinstall 루프) |
| 자식 프로세스 stdout·stderr를 `utf8`로 읽고 `shell: false` | Task 2 (`run`) |
| 실패 메시지에 토큰·홈 경로·응답 본문 미노출 | Task 2 (`redactInstallFailure`) |
| `LANG=C`, `LC_ALL=C` | Task 2 (`isolatedEnvironment`) |
| Windows 러너에서 설치 게이트 통과 | Task 4 |

**남는 위험**

- Task 2의 `copyTree` 옵션과 `plugin.json`의 버전 필드명은 코드를 읽고 확정해야 하는 가정이다. Step 6과 Step 8이 그 확정 지점이다.
- Windows에서 mode 비트 비교는 의미가 약하다. Task 4 Step 4가 그 처리를 명시적으로 다룬다.
- `codex plugin add`가 한글 `CODEX_HOME`을 거부할 가능성이 남는다. 그렇다면 그것 자체가 D절이 찾으려던 결함이고, 보고 대상이지 우회 대상이 아니다.
