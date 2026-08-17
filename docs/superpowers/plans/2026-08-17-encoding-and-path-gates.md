# 인코딩·경로 게이트 구현 계획 (계획 1/4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 현재 실패 중인 이미지 생성 모드 표 계약을 복구하고, BOM·CR·경로 충돌·경로 길이를 패키지 감사에서 차단해 Windows 설치가 인코딩 문제로 깨지지 않게 한다.

**Architecture:** 새 모듈을 만들지 않는다. 기존 `tooling/lib/tree-audit.mjs`의 전수 감사 루프에 경로 게이트와 텍스트 게이트를 얹는다. 이 감사는 `tooling/isolation-smoke.mjs`(생성된 패키지)와 `tooling/sync-shared.mjs`(빌드 산출물) 양쪽에서 이미 호출되므로, 게이트를 한 곳에 추가하면 두 경로가 함께 보호된다. 파일 시스템으로 재현할 수 없는 검사(대소문자·NFC 충돌)는 순수 함수로 분리해 단위 테스트한다.

**Tech Stack:** Node.js ESM (`"type": "module"`), `node:test` + `node:assert/strict`, 외부 의존성 없음.

**Spec:** `docs/superpowers/specs/2026-08-17-suite-entry-upgrade-and-windows-encoding-design.md` (구현 순서 1~2단계)

## Global Constraints

- Node `>=18` (`package.json`의 `engines`). 로컬 개발 환경은 v24.19.0.
- ESM 전용. `require` 금지, `import` 사용.
- 외부 의존성 0. `package.json`에 `dependencies`가 없다. 표준 라이브러리만 사용한다.
- 테스트는 `node:test`의 `test()`와 `node:assert/strict`를 사용한다. 기존 파일의 표 기반(table-driven) 케이스 스타일을 따른다.
- 새로 만드는 모든 파일은 BOM 없는 UTF-8, LF 줄바꿈, 마지막 줄 개행 포함.
- 커밋 메시지는 영어로 쓰고 Conventional Commits 접두사(`fix:`, `feat:`, `test:`, `chore:`)를 사용한다.
- 플러그인 상대 경로 예산은 150자다. 현재 최장값은 100자다.
- 감사 대상 패키지는 `game-design-studio`, `game-design-career` 두 개뿐이다.

## File Structure

| 파일 | 역할 | 변경 |
| --- | --- | --- |
| `tests/unit/prompt-template-catalog.test.mjs` | Studio·Career 프롬프트 카탈로그 계약 | 수정 — 모드 표 추출 헬퍼 도입, 강조 표기 회귀 테스트 추가 |
| `.gitattributes` | 저장소 줄바꿈·공백 정책 | 수정 — `* text=auto eol=lf` 추가 |
| `tests/unit/gitattributes.test.mjs` | 줄바꿈 정책 회귀 게이트 | 신규 |
| `tooling/lib/tree-audit.mjs` | 패키지 전수 감사 | 수정 — BOM·CR 거부, 경로 충돌·길이 게이트, 순수 헬퍼 export |
| `tests/isolation/no-cross-package-paths.test.mjs` | 감사 계약 테스트 | 수정 — BOM·CR·길이 fixture, 충돌 단위 테스트 추가 |

---

### Task 1: 이미지 생성 모드 표 계약 복구

`guides/game-design-studio/image-assets.md:30`과 `guides/game-design-career/image-assets.md:30`이 기본값 모드를 `| **`prompt-only`** |`로 강조하면서, 백틱만 인식하는 추출 정규식이 그 행을 놓쳐 폐쇄 모드 집합 계약이 깨졌다. 문서 강조는 유지하고 추출기를 고친다.

**Files:**
- Modify: `tests/unit/prompt-template-catalog.test.mjs` (Studio 케이스 `:884-886`, Career 케이스 `:1305`)
- Test: `tests/unit/prompt-template-catalog.test.mjs`

**Interfaces:**
- Consumes: 없음
- Produces: 모듈 수준 헬퍼 `imagePolicyModes(markdown: string) => string[]` — 모드 표의 첫 셀에서 모드 이름만 정렬해 반환한다. 이후 태스크는 사용하지 않는다.

- [ ] **Step 1: 현재 실패를 눈으로 확인**

Run: `node --test tests/unit/prompt-template-catalog.test.mjs 2>&1 | grep -E "^(✖|# (pass|fail))"`

Expected: Studio·Career 두 케이스가 `✖`로 실패하고, 차이가 `actual: [ 'all', 'required', 'select' ]` / `expected: [ 'all', 'prompt-only', 'required', 'select' ]`로 나온다.

- [ ] **Step 2: 강조 표기 회귀 테스트를 먼저 추가**

`tests/unit/prompt-template-catalog.test.mjs` 파일 맨 아래에 다음 테스트를 추가한다. 아직 `imagePolicyModes`가 없으므로 실패한다.

```javascript
test("image policy mode table survives Markdown emphasis on the mode cell", () => {
  const plain = [
    "| 모드 | 생성 범위 | 승인·비용 경계 |",
    "| --- | --- | --- |",
    "| `prompt-only` | 외부 호출 0회 | 기본값 |",
    "| `select` | 선택 자산만 | 선택 기록 필요 |",
    "",
  ].join("\n");
  const emphasized = [
    "| 모드 | 생성 범위 | 승인·비용 경계 |",
    "| --- | --- | --- |",
    "| **`prompt-only`** | **외부 호출 0회.** 계획만 | **기본값입니다.** |",
    "| `select` | 선택 자산만 | 선택 기록 필요 |",
    "",
  ].join("\n");

  assert.deepEqual(imagePolicyModes(plain), ["prompt-only", "select"]);
  assert.deepEqual(
    imagePolicyModes(emphasized),
    imagePolicyModes(plain),
    "emphasis must not change the closed mode set",
  );
  assert.deepEqual(imagePolicyModes("| 모드 | 범위 |\n| --- | --- |\n| 자유 텍스트 | 무시 |\n"), []);
});
```

- [ ] **Step 3: 테스트가 실패하는지 확인**

Run: `node --test tests/unit/prompt-template-catalog.test.mjs 2>&1 | grep -A3 "emphasis"`

Expected: FAIL. `ReferenceError: imagePolicyModes is not defined`.

- [ ] **Step 4: 헬퍼를 추가하고 두 호출부를 교체**

`tests/unit/prompt-template-catalog.test.mjs`의 `import` 구문 바로 아래(첫 `test(` 호출 위)에 헬퍼를 추가한다.

```javascript
function imagePolicyModes(markdown) {
  return [...markdown.matchAll(/^\|\s*\**\s*`([a-z][a-z-]*)`\s*\**\s*\|/gmu)]
    .map(([, mode]) => mode)
    .sort();
}
```

Studio 케이스에서 다음 세 줄을 삭제한다.

```javascript
  const policyModes = [...imagePolicy.matchAll(/^\|\s*`([a-z][a-z-]*)`\s*\|/gmu)]
    .map(([, mode]) => mode)
    .sort();
```

대신 같은 자리에 다음 한 줄을 넣는다.

```javascript
  const policyModes = imagePolicyModes(imagePolicy);
```

Career 케이스에서 다음 한 줄을 삭제한다.

```javascript
  assert.deepEqual(imagePolicy.match(/^\|\s*`([a-z][a-z-]*)`\s*\|/gmu)?.map((row) => row.match(/`([a-z][a-z-]*)`/u)[1]).sort(), allowedModes);
```

대신 다음 한 줄을 넣는다.

```javascript
  assert.deepEqual(imagePolicyModes(imagePolicy), allowedModes, "Career image policy closed mode set");
```

- [ ] **Step 5: 파일 전체 테스트가 통과하는지 확인**

Run: `node --test tests/unit/prompt-template-catalog.test.mjs 2>&1 | tail -12`

Expected: `# fail 0`. Studio·Career 두 케이스와 새 강조 회귀 테스트가 모두 통과한다.

- [ ] **Step 6: 유닛 스위트 전체 확인**

Run: `npm run test:unit 2>&1 | tail -8`

Expected: 실패 0.

- [ ] **Step 7: 커밋**

```bash
git add tests/unit/prompt-template-catalog.test.mjs
git commit -m "fix: accept emphasized mode cells in the image policy contract

The closed IMAGE_GEN_MODE set is extracted from the first cell of the mode
table. Bolding the default mode hid that row from the extractor and broke
the Studio and Career catalog contracts. Extract through one helper that
tolerates Markdown emphasis, and lock the behaviour with a regression test.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: 저장소 줄바꿈 정책 고정

Windows 체크아웃에서 `core.autocrlf`가 LF 파일을 CRLF로 바꾸면 Task 4의 CR 게이트가 전부 실패한다. 저장소 차원에서 LF를 고정한다.

**Files:**
- Modify: `.gitattributes`
- Create: `tests/unit/gitattributes.test.mjs`

**Interfaces:**
- Consumes: 없음
- Produces: 없음 (정책 게이트)

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/unit/gitattributes.test.mjs`를 새로 만든다.

```javascript
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

function git(args) {
  const result = spawnSync("git", args, { cwd: repoRoot, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}

test("the repository forces LF checkout so Windows clones keep package text auditable", () => {
  const attributes = git(["check-attr", "text", "eol", "--", "README.md"]);
  assert.match(attributes, /README\.md: text: auto/u);
  assert.match(attributes, /README\.md: eol: lf/u);
});

test("every tracked text file is stored and checked out with LF", () => {
  const offenders = git(["ls-files", "--eol"])
    .split("\n")
    .filter(Boolean)
    .filter((line) => !/^i\/(?:lf|-text)\s+w\/(?:lf|-text)\s/u.test(line));
  assert.deepEqual(offenders, [], "tracked files must be LF or binary");
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `node --test tests/unit/gitattributes.test.mjs 2>&1 | grep -E "✖|✔"`

Expected: 첫 번째 테스트 FAIL (`text: unspecified`, `eol: unspecified`). 두 번째 테스트는 이미 통과한다(현재 추적 파일 2430개가 `w/lf`, 183개가 `w/-text`).

- [ ] **Step 3: `.gitattributes`에 정책 추가**

`.gitattributes` 맨 위에 다음 두 줄을 추가하고, 기존 vendor 줄은 그대로 둔다.

```gitattributes
* text=auto eol=lf

```

적용 후 파일 전체는 다음과 같다.

```gitattributes
* text=auto eol=lf

shared/vendor/im-not-ai/** whitespace=-trailing-space
shared/vendor/skillstead/svg-infographic/0.9.0/** whitespace=-trailing-space
```

- [ ] **Step 4: 재정규화가 무변경인지 확인**

Run: `git add --renormalize . && git status --short`

Expected: `.gitattributes` 한 줄만 변경으로 표시된다. 다른 파일이 변경으로 나오면 그 파일에 CRLF가 있었다는 뜻이므로 멈추고 보고한다.

- [ ] **Step 5: 테스트 통과 확인**

Run: `node --test tests/unit/gitattributes.test.mjs 2>&1 | grep -E "# (pass|fail)"`

Expected: `# fail 0`.

- [ ] **Step 6: 커밋**

```bash
git add .gitattributes tests/unit/gitattributes.test.mjs
git commit -m "chore: force LF checkout for every tracked text file

Windows clones with core.autocrlf enabled would rewrite package text to
CRLF, which the upcoming package audit rejects. Pin the working tree to LF
and gate the policy with a test.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: 패키지 감사에서 BOM 거부

사용자 환경의 marketplace JSON에 있던 UTF-8 BOM이 `codex plugin list` 로딩을 막아 설치가 깨진 사례가 있다. 우리 패키지에 BOM이 섞이면 같은 방식으로 설치가 불가능해지므로 릴리스 차단 게이트로 만든다.

**Files:**
- Modify: `tooling/lib/tree-audit.mjs:248-253` (디코드 직후)
- Test: `tests/isolation/no-cross-package-paths.test.mjs:45-59` (`cases` 배열)

**Interfaces:**
- Consumes: 없음
- Produces: 없음 (`auditTree`의 거부 조건 추가). 오류 메시지에 `UTF-8 BOM` 문자열을 포함한다.

- [ ] **Step 1: 실패하는 케이스 추가**

`tests/isolation/no-cross-package-paths.test.mjs`의 `cases` 배열 첫 항목(`["invalid UTF-8", ...]`) 바로 뒤에 두 줄을 추가한다.

```javascript
    ["BOM in Markdown", "SKILL.md", Buffer.from("\uFEFF---\nname: demo\n---\n", "utf8"), /UTF-8 BOM/u],
    ["BOM in JSON", "plugin.json", Buffer.from("\uFEFF{}\n", "utf8"), /UTF-8 BOM/u],
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `node --test tests/isolation/no-cross-package-paths.test.mjs 2>&1 | grep -B2 -A6 "BOM in Markdown"`

Expected: FAIL. `auditTree`가 예외를 던지지 않아 `assert.rejects`가 `Missing expected rejection`으로 실패한다.

- [ ] **Step 3: 감사에 BOM 거부 추가**

`tooling/lib/tree-audit.mjs`에서 다음 블록을 찾는다.

```javascript
      let text;
      try {
        text = utf8.decode(bytes);
      } catch {
        throw new Error(`${relativePath} is not valid UTF-8`);
      }
      assertTextIsSafe({
```

`assertTextIsSafe({` 호출 바로 앞에 한 줄을 넣는다.

```javascript
      if (text.startsWith("\uFEFF")) throw new Error(`${relativePath} starts with a UTF-8 BOM`);
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `node --test tests/isolation/no-cross-package-paths.test.mjs 2>&1 | grep -E "# (pass|fail)"`

Expected: `# fail 0`. 생성된 두 패키지를 검사하는 첫 테스트도 함께 통과한다(현재 BOM 0건).

- [ ] **Step 5: 커밋**

```bash
git add tooling/lib/tree-audit.mjs tests/isolation/no-cross-package-paths.test.mjs
git commit -m "feat: reject UTF-8 BOM in packaged files

A BOM in a marketplace JSON blocked codex plugin list loading in the field.
The same byte sequence in our own package would make installation
impossible, so treat it as a release blocker.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: 패키지 감사에서 CR 거부

**Files:**
- Modify: `tooling/lib/tree-audit.mjs` (Task 3에서 추가한 BOM 검사 바로 뒤)
- Test: `tests/isolation/no-cross-package-paths.test.mjs` (`cases` 배열)

**Interfaces:**
- Consumes: Task 3이 만든 텍스트 검사 자리
- Produces: 없음. 오류 메시지에 `must use LF` 문자열을 포함한다.

- [ ] **Step 1: 실패하는 케이스 추가**

`cases` 배열의 BOM 항목 두 줄 뒤에 두 줄을 추가한다.

```javascript
    ["CRLF line ending", "README.md", "line one\r\nline two\n", /must use LF/u],
    ["lone CR", "README.md", "line one\rline two\n", /must use LF/u],
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `node --test tests/isolation/no-cross-package-paths.test.mjs 2>&1 | grep -A6 "CRLF line ending"`

Expected: FAIL. `Missing expected rejection`.

- [ ] **Step 3: 감사에 CR 거부 추가**

`tooling/lib/tree-audit.mjs`의 BOM 검사 줄 바로 아래에 한 줄을 넣는다.

```javascript
      if (text.includes("\r")) throw new Error(`${relativePath} contains a carriage return; packaged text must use LF`);
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `node --test tests/isolation/no-cross-package-paths.test.mjs 2>&1 | grep -E "# (pass|fail)"`

Expected: `# fail 0`.

- [ ] **Step 5: 격리 스모크로 실제 패키지 확인**

Run: `node tooling/isolation-smoke.mjs 2>&1 | tail -5`

Expected: 성공. 현재 두 패키지에 CR이 0건이므로 통과해야 한다.

- [ ] **Step 6: 커밋**

```bash
git add tooling/lib/tree-audit.mjs tests/isolation/no-cross-package-paths.test.mjs
git commit -m "feat: reject carriage returns in packaged files

Packaged text must round-trip byte-for-byte across platforms. A CRLF that
slips in from a Windows editor would break that guarantee.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: NFC·대소문자 경로 충돌 거부

Windows와 macOS의 기본 파일 시스템은 대소문자를 구분하지 않고, macOS는 한글 파일명을 NFD로 반환할 수 있다. 정규화 후 같아지는 두 경로가 패키지에 들어가면 플랫폼마다 다른 파일이 설치된다. 파일 시스템이 그런 충돌 생성을 막기 때문에 검사 로직을 순수 함수로 분리해 직접 검증한다.

**Files:**
- Modify: `tooling/lib/tree-audit.mjs` (모듈 상단 export, `auditTree` 본문, `visit` 루프)
- Test: `tests/isolation/no-cross-package-paths.test.mjs`

**Interfaces:**
- Consumes: 없음
- Produces: `assertPackagePath(relativePath: string, seenFoldedPaths: Map<string, string>) => string`. 정규화·폴딩한 키가 이미 있으면 던지고, 없으면 등록한 뒤 입력한 `relativePath`를 그대로 반환한다. Task 6이 같은 함수에 길이 검사를 더한다.

- [ ] **Step 1: 실패하는 단위 테스트 추가**

`tests/isolation/no-cross-package-paths.test.mjs`의 `import { auditTree } ...` 줄을 다음으로 바꾼다.

```javascript
import { assertPackagePath, auditTree } from "../../tooling/lib/tree-audit.mjs";
```

파일 맨 아래에 테스트를 추가한다.

```javascript
test("package paths that collide after NFC and case folding are rejected", () => {
  const nfc = "references/한글.md".normalize("NFC");
  const nfd = "references/한글.md".normalize("NFD");
  assert.notEqual(nfc, nfd, "fixture must use distinct code point sequences");

  const unicodeSeen = new Map();
  assert.equal(assertPackagePath(nfc, unicodeSeen), nfc);
  assert.throws(() => assertPackagePath(nfd, unicodeSeen), /collides with/u);

  const caseSeen = new Map();
  assert.equal(assertPackagePath("skills/demo/SKILL.md", caseSeen), "skills/demo/SKILL.md");
  assert.throws(() => assertPackagePath("skills/demo/Skill.md", caseSeen), /collides with/u);

  const distinctSeen = new Map();
  assert.equal(assertPackagePath("a/one.md", distinctSeen), "a/one.md");
  assert.equal(assertPackagePath("a/two.md", distinctSeen), "a/two.md");
  assert.equal(distinctSeen.size, 2);
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `node --test tests/isolation/no-cross-package-paths.test.mjs 2>&1 | grep -A4 "collide after NFC"`

Expected: FAIL. `SyntaxError` 또는 `assertPackagePath is not a function` — `tree-audit.mjs`가 아직 그 이름을 export하지 않는다.

- [ ] **Step 3: 순수 헬퍼 구현**

`tooling/lib/tree-audit.mjs`의 `function inside(root, candidate) {` 바로 위에 함수를 추가한다.

```javascript
export function assertPackagePath(relativePath, seenFoldedPaths) {
  const folded = relativePath.normalize("NFC").toLowerCase();
  const previous = seenFoldedPaths.get(folded);
  if (previous !== undefined) {
    throw new Error(`${relativePath} collides with ${previous} after NFC and case folding`);
  }
  seenFoldedPaths.set(folded, relativePath);
  return relativePath;
}
```

- [ ] **Step 4: 감사 루프에 연결**

`auditTree` 본문에서 다음 줄을 찾는다.

```javascript
  const usedInactiveRelativeReferenceTuples = new Set();
```

그 아래에 한 줄을 추가한다.

```javascript
  const seenFoldedPaths = new Map();
```

`visit` 루프에서 다음 줄을 찾는다.

```javascript
      const relativePath = normalizeRelativePath(rawRelativePath, `package ${packageName}`);
```

그 아래에 한 줄을 추가한다.

```javascript
      assertPackagePath(relativePath, seenFoldedPaths);
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `node --test tests/isolation/no-cross-package-paths.test.mjs 2>&1 | grep -E "# (pass|fail)"`

Expected: `# fail 0`. 실제 패키지에 충돌이 0건이므로 첫 테스트도 통과한다.

- [ ] **Step 6: 커밋**

```bash
git add tooling/lib/tree-audit.mjs tests/isolation/no-cross-package-paths.test.mjs
git commit -m "feat: reject package paths that collide after NFC and case folding

Windows and macOS default filesystems fold case, and macOS can hand back
Korean filenames in NFD. Two paths that normalize to the same key would
install as different files per platform.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: 경로 길이 예산

Windows 설치 캐시 접두사가 붙어도 `MAX_PATH`에 여유가 남도록 패키지 상대 경로 길이 상한을 둔다. 현재 최장값이 100자이므로 어떤 파일도 이름을 바꾸지 않는다. 이후 증가를 막는 회귀 방지 장치다.

**Files:**
- Modify: `tooling/lib/tree-audit.mjs` (Task 5가 만든 `assertPackagePath`)
- Test: `tests/isolation/no-cross-package-paths.test.mjs`

**Interfaces:**
- Consumes: Task 5의 `assertPackagePath(relativePath, seenFoldedPaths)`
- Produces: `MAX_PACKAGE_PATH_LENGTH = 150` export. `assertPackagePath`가 길이 초과 시 던진다.

- [ ] **Step 1: 실패하는 테스트 추가**

`tests/isolation/no-cross-package-paths.test.mjs`의 import 줄을 다음으로 바꾼다.

```javascript
import { MAX_PACKAGE_PATH_LENGTH, assertPackagePath, auditTree } from "../../tooling/lib/tree-audit.mjs";
```

파일 맨 아래에 테스트를 추가한다.

```javascript
test("package paths stay inside the length budget", async (t) => {
  assert.equal(MAX_PACKAGE_PATH_LENGTH, 150);

  const atBudget = `${"a".repeat(74)}/${"b".repeat(75)}`;
  assert.equal(atBudget.length, MAX_PACKAGE_PATH_LENGTH);
  assert.equal(assertPackagePath(atBudget, new Map()), atBudget);

  const overBudget = `${"a".repeat(74)}/${"b".repeat(76)}`;
  assert.equal(overBudget.length, MAX_PACKAGE_PATH_LENGTH + 1);
  assert.throws(() => assertPackagePath(overBudget, new Map()), /path budget/u);

  const root = await fixture(t, `${"n".repeat(80)}/${"m".repeat(80)}.md`, "over budget\n");
  await assert.rejects(() => auditTree({ root, packageName: "game-design-studio" }), /path budget/u);
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `node --test tests/isolation/no-cross-package-paths.test.mjs 2>&1 | grep -A4 "length budget"`

Expected: FAIL. `MAX_PACKAGE_PATH_LENGTH`가 `undefined`라 첫 `assert.equal`에서 멈춘다.

- [ ] **Step 3: 예산 상수와 검사 추가**

`tooling/lib/tree-audit.mjs`에서 `export function assertPackagePath` 바로 위에 상수를 추가한다.

```javascript
export const MAX_PACKAGE_PATH_LENGTH = 150;
```

`assertPackagePath` 본문 첫 줄에 길이 검사를 넣는다. 적용 후 함수 전체는 다음과 같다.

```javascript
export function assertPackagePath(relativePath, seenFoldedPaths) {
  if (relativePath.length > MAX_PACKAGE_PATH_LENGTH) {
    throw new Error(`${relativePath} exceeds the ${MAX_PACKAGE_PATH_LENGTH} character package path budget`);
  }
  const folded = relativePath.normalize("NFC").toLowerCase();
  const previous = seenFoldedPaths.get(folded);
  if (previous !== undefined) {
    throw new Error(`${relativePath} collides with ${previous} after NFC and case folding`);
  }
  seenFoldedPaths.set(folded, relativePath);
  return relativePath;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `node --test tests/isolation/no-cross-package-paths.test.mjs 2>&1 | grep -E "# (pass|fail)"`

Expected: `# fail 0`.

- [ ] **Step 5: 실제 패키지 여유 확인**

Run: `node --input-type=module -e 'import { readdir } from "node:fs/promises"; import path from "node:path"; let max = 0, worst = ""; for (const pkg of ["game-design-studio", "game-design-career"]) { const walk = async (dir, prefix) => { for (const entry of await readdir(dir, { withFileTypes: true })) { const rel = prefix ? `${prefix}/${entry.name}` : entry.name; if (entry.isDirectory()) { await walk(path.join(dir, entry.name), rel); continue; } if (rel.length > max) { max = rel.length; worst = `${pkg}:${rel}`; } } }; await walk(path.join("plugins", pkg), ""); } console.log(max, worst);'`

Expected: `100` 과 해당 경로가 출력된다. 150자 예산 대비 50자 여유.

- [ ] **Step 6: 커밋**

```bash
git add tooling/lib/tree-audit.mjs tests/isolation/no-cross-package-paths.test.mjs
git commit -m "feat: bound packaged relative path length

Windows resolves MAX_PATH in characters, and the install cache prefix eats
part of that budget. Cap packaged relative paths at 150 characters; the
longest today is 100, so nothing is renamed.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: 전체 게이트 통과 확인

계획 1의 변경이 빌드 산출물 감사(`tooling/sync-shared.mjs`)와 스냅샷 드리프트를 포함한 전 단계에서 통과하는지 확인한다. 계획 2의 착수 조건이다.

**Files:**
- 변경 없음

**Interfaces:**
- Consumes: Task 1~6의 모든 게이트
- Produces: 없음

- [ ] **Step 1: 전체 검증 실행**

Run: `npm run validate 2>&1 | tail -25`

Expected: 모든 스테이지 `PASS`. `[suite] FAIL:` 줄이 없어야 한다.

- [ ] **Step 2: 실패 시 처리**

`clean build drift`에서 실패하면 `node tooling/build-snapshots.mjs`로 재생성한 뒤 `git status --short`로 변경 파일을 확인하고 커밋한다. 다른 스테이지에서 실패하면 출력의 `Rerun:` 명령으로 재현하고, 원인이 계획 1의 변경이면 해당 태스크로 돌아가 고친다. 계획 1과 무관한 기존 실패라면 멈추고 보고한다.

- [ ] **Step 3: 결과 기록**

Run: `npm run validate 2>&1 | grep -E "^\[suite\]" | tail -20`

Expected: `Suite release readiness: COMPLETE` 또는 각 스테이지 `PASS` 목록. 이 출력을 계획 2 착수 근거로 남긴다.

---

## 완료 기준

- `npm run validate`가 전 단계를 통과한다.
- 패키지에 BOM, CR, NFC·대소문자 충돌, 150자 초과 경로를 넣으면 감사가 거부한다.
- 이미지 생성 모드 표를 강조 표기로 바꿔도 폐쇄 모드 집합 계약이 유지된다.
- Windows 체크아웃에서 추적 텍스트 파일이 LF로 유지된다.
