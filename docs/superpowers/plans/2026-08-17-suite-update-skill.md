# 스위트 업데이트 스킬 구현 계획 (계획 2/4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 설치 사용자가 suite의 새 GitHub Release를 안내받고, 명시적 승인 아래 `codex plugin` 명령만으로 업데이트할 수 있는 공용 스킬 `upgrade-game-design-suite`를 두 제품에 동일하게 제공한다.

**Architecture:** 새 업데이트 엔진을 만들지 않는다. 이미 구현·검증된 세 층 위에 얹는다. `shared/scripts/check-game-design-updates.mjs`가 7일 주기 릴리스 조회와 캐시를 소유하고, `shared/scripts/inspect-game-design-plugin-updates.mjs`가 `codex plugin list --json`의 폐쇄 필드 검증과 재설치 계획 생성을 소유한다. 이 계획이 추가하는 것은 (1) 조회 대상에 suite 자신을 넣는 정책·엔드포인트 확장, (2) "이 버전 다시 알리지 않기"를 담기 위한 캐시 스키마 2, (3) 두 스크립트를 호출하고 승인 UX와 요약만 소유하는 얇은 스킬이다. Codex 전용 명령 문자열은 스킬의 `references/codex-commands.md` 한 파일에 격리해 다른 호스트 이식 시 그 파일만 교체한다.

**Tech Stack:** Node.js ESM (`"type": "module"`), `node:test` + `node:assert/strict`, 외부 의존성 없음. 스킬 본문은 Markdown.

**Spec:** `docs/superpowers/specs/2026-08-17-suite-entry-upgrade-and-windows-encoding-design.md` (구현 순서 3단계 = A절)

## 선행 상태

착수 시점에 이미 끝나 있는 것이다. 다시 하지 않는다.

- 스펙의 "선행"(이미지 생성 모드 표 계약 복구)과 구현 순서 2단계(D의 tree-audit 확장, 커밋 단계 차단)는 계획 1에서 완료돼 `main`에 병합됐다. `26039c4`.
- 업데이트 안내의 실동작 결함 세 건이 수정돼 병합됐다. `971dbf7`. 실제 설치본에서 `status: outdated`와 알림 생성이 확인된 상태다. 이 계획은 동작하는 감지 층 위에서 시작한다.
- `npm test`가 `main`에서 2308개 중 0 실패다.

## Global Constraints

- Node `>=18` (`package.json`의 `engines`). 로컬 개발 환경은 v24.19.0.
- ESM 전용. `require` 금지.
- 외부 의존성 0. 표준 라이브러리만 사용한다.
- 테스트는 `node:test`의 `test()`와 `node:assert/strict`를 쓰고, 기존 파일의 표 기반 케이스 스타일을 따른다.
- 새로 만드는 모든 파일은 BOM 없는 UTF-8, LF 줄바꿈, 마지막 줄 개행 포함. 계획 1의 게이트가 위반을 빌드에서 차단한다.
- 패키지 상대 경로 예산 150자. 새 스킬 경로 최장값이 이 안에 들어와야 한다.
- 스킬 ID는 `^[a-z0-9-]+$`, 64자 이하. description은 1024자 이하이며 `<`, `>`를 포함할 수 없다.
- 커밋 메시지는 영어로 쓰고 Conventional Commits 접두사를 사용한다.
- 각 태스크 종료 시 `npm run validate`가 통과해야 다음으로 넘어간다.

### 금지 동작 (스펙 A절, 전 태스크 공통)

구현 중 다음을 코드로 만들지 않는다. 태스크 4의 테스트가 각각을 고정한다.

- 무승인 자동 업데이트, `auto_upgrade` 류의 설정 키
- 설치 디렉터리에서 `git reset --hard`, `rm -rf`, 직접 파일 교체, `.bak` 복원
- 설치된 플러그인 캐시나 번들 스킬 디렉터리 직접 수정
- 저장소 checkout의 로컬 변경 자동 stash·삭제
- 검사·계획 단계에서 provider 명령(`marketplace upgrade`, `plugin add`) 호출
- 실패 메시지에 토큰, 사용자 홈 절대 경로, 원격 응답 본문 노출
- GitHub API 토큰이나 사용자 API 키 읽기

## File Structure

| 파일 | 역할 | 변경 |
| --- | --- | --- |
| `shared/updates/update-policy.json` | 업스트림 allowlist와 검사 주기 | 수정 — suite 항목 추가, 4개로 폐쇄 |
| `shared/updates/installed-components.json` | 설치 버전 매니페스트 | 수정 — suite 항목 추가 |
| `shared/scripts/lib/update-advisory.mjs` | 릴리스 판정 순수 로직 | 수정 — `COMPONENTS`에 suite 규칙 추가 |
| `shared/scripts/check-game-design-updates.mjs` | 조회·캐시·알림 | 수정 — 엔드포인트 추가, 캐시 스키마 2와 suppress 키 |
| `tooling/generate-update-manifest.mjs` | 릴리스 시 매니페스트 생성 | 수정 — suite 버전을 플러그인 버전에서 채움 |
| `tooling/lib/tree-audit.mjs` | 패키지 전수 감사 | 수정 — `sharedUpdateIdentityMatchers` 정규식 갱신 |
| `shared/suite-update/skills/upgrade-game-design-suite/SKILL.md` | 공용 업데이트 스킬 | 신규 |
| `shared/suite-update/skills/upgrade-game-design-suite/references/codex-commands.md` | Codex 전용 명령 격리 | 신규 |
| `tooling/lib/build-product.mjs` | 제품 빌드 매핑 | 수정 — `suite-update-skill` 공용 모듈 추가 |
| `products/game-design-studio/product.json` | 제품 구성 | 수정 — `sharedModules`에 추가 |
| `products/game-design-career/product.json` | 제품 구성 | 수정 — `sharedModules`에 추가 |
| `products/game-design-studio/plugin/references/routing.json` | 스킬 목록·경로 | 수정 — `skillIds`, `plannedPaths.skills` |
| `products/game-design-career/plugin/references/routing.json` | 스킬 목록·경로 | 수정 — 동일 |
| `tooling/isolation-smoke.mjs` | 설치 트리 정합성 | 수정 — `EXACT_SKILL_IDS` 두 목록 |
| `tooling/lib/user-guides.mjs` | 가이드 스킬 인벤토리 | 수정 — `sharedSkills`에 추가 |
| `tests/contracts/shared-contract.test.mjs` | 공용 계약 | 수정 — `expectedCareerSkillIds`, 공용 스킬 목록 |
| `tests/unit/suite-update-skill.test.mjs` | 스킬 계약·금지 동작 | 신규 |
| `tests/unit/update-advisory.test.mjs` | 판정 로직 | 수정 — suite 케이스 |
| `tests/unit/game-design-update-check.test.mjs` | 조회·캐시 | 수정 — 4엔드포인트, 스키마 2, suppress |

### 왜 `shared/suite-update/`인가

`shared/updates/`는 `tooling/lib/build-product.mjs:31`에서 `["shared/updates", "references/shared/updates"]`로 디렉터리 통째 복사된다. 여기에 `skills/`를 넣으면 스킬이 `references/shared/updates/skills/`로도 함께 복사돼 패키지에 중복 트리가 생긴다. `shared/updates/`를 파일 단위 인벤토리로 바꾸는 방법도 있으나, 그러면 계획 1에서 고친 리포 레이아웃 기본 `pluginRoot` 폴백(`<repo>` → `shared/updates`)이 함께 깨진다. 스킬만 별도 최상위 디렉터리에 두면 두 문제를 다 피하고 `shared/memory/skills` 선례와도 일치한다.

---

### Task 1: suite를 릴리스 조회 대상에 넣고 allowlist를 넷으로 닫는다

지금 `RELEASE_ENDPOINTS`와 `COMPONENTS`는 번들 세 개(`skillstead`, `archify`, `im-not-ai`)로 폐쇄돼 있다. suite 자신은 조회되지 않으므로 스킬이 비교할 대상이 없다. 네 번째 항목을 추가하되 폐쇄성은 유지한다.

**Files:**
- Modify: `shared/updates/update-policy.json`
- Modify: `shared/updates/installed-components.json`
- Modify: `shared/scripts/lib/update-advisory.mjs:1-5` (`COMPONENTS`)
- Modify: `shared/scripts/check-game-design-updates.mjs:38-42` (`RELEASE_ENDPOINTS`)
- Modify: `tooling/lib/tree-audit.mjs:10-23` (`sharedUpdateIdentityMatchers`)
- Modify: `tooling/generate-update-manifest.mjs`
- Test: `tests/unit/update-advisory.test.mjs`, `tests/unit/game-design-update-check.test.mjs`

**Interfaces:**
- Consumes: 없음
- Produces: 컴포넌트 ID `game-design-suite`. 이후 태스크가 이 ID로 advisory 결과에서 suite 항목을 찾는다. `installedTag`는 `vX.Y.Z` 형태이고 `prefix`는 `"v"`다.

- [ ] **Step 1: 실패하는 테스트를 먼저 추가**

`tests/unit/update-advisory.test.mjs` 맨 아래에 추가한다.

```javascript
test("the suite itself is a comparable component with a closed release rule", () => {
  const advisory = evaluateUpdateAdvisory({
    policy,
    installed: [{
      id: "game-design-suite",
      installedTag: "v0.1.1",
      repository: "https://github.com/freelife1191/gamedesign-plugin",
    }],
    releases: {
      "game-design-suite": [
        releaseFor("https://github.com/freelife1191/gamedesign-plugin", "v0.2.0"),
        releaseFor("https://github.com/freelife1191/gamedesign-plugin", "v0.1.1"),
      ],
    },
    checkedAt,
  });

  assert.equal(advisory.status, "outdated");
  assert.equal(advisory.components[0].latestTag, "v0.2.0");
});

test("a repository outside the four-entry allowlist is refused", () => {
  const advisory = evaluateUpdateAdvisory({
    policy,
    installed: [{
      id: "game-design-suite",
      installedTag: "v0.1.1",
      repository: "https://github.com/attacker/gamedesign-plugin",
    }],
    releases: { "game-design-suite": [] },
    checkedAt,
  });

  assert.equal(advisory.status, "unknown");
});
```

파일 상단 헬퍼 옆에 다음을 추가한다. 기존 `releaseUrl` 헬퍼를 재사용한다.

```javascript
const releaseFor = (repository, tag) => ({
  tag,
  draft: false,
  prerelease: false,
  url: releaseUrl(repository, tag),
});
```

- [ ] **Step 2: 실패 확인**

Run: `node --test tests/unit/update-advisory.test.mjs 2>&1 | grep -E "^(✔|✖)|^ℹ (tests|pass|fail)"`

Expected: 새 케이스 두 개가 `✖`. 첫 번째는 `status`가 `unknown`(컴포넌트 규칙이 없어 `componentRule`이 `null`), 두 번째는 이미 통과할 수도 있으나 첫 번째가 반드시 실패한다.

- [ ] **Step 3: 정책과 매니페스트에 suite를 추가**

`shared/updates/update-policy.json`의 `components` 배열 끝에 추가한다.

```json
    {
      "id": "game-design-suite",
      "repository": "https://github.com/freelife1191/gamedesign-plugin"
    }
```

`shared/updates/installed-components.json`의 `components` 배열 끝에 추가한다. `commit`은 `v0.1.1` 태그가 가리키는 커밋 SHA를 `git rev-list -n 1 v0.1.1`로 확인해 채운다.

```json
    {
      "id": "game-design-suite",
      "repository": "https://github.com/freelife1191/gamedesign-plugin",
      "installedTag": "v0.1.1",
      "commit": "<git rev-list -n 1 v0.1.1 결과>"
    }
```

- [ ] **Step 4: 컴포넌트 규칙과 엔드포인트를 추가**

`shared/scripts/lib/update-advisory.mjs`의 `COMPONENTS`에 항목을 추가한다.

```javascript
  "game-design-suite": Object.freeze({ prefix: "v", repository: "https://github.com/freelife1191/gamedesign-plugin" }),
```

`shared/scripts/check-game-design-updates.mjs`의 `RELEASE_ENDPOINTS`에 항목을 추가한다.

```javascript
  "game-design-suite": "https://api.github.com/repos/freelife1191/gamedesign-plugin/releases",
```

- [ ] **Step 5: tree-audit identity matcher 갱신**

`tooling/lib/tree-audit.mjs:11-14`의 `references/shared/updates/update-policy.json` matcher는 `productIds` 배열만 본다. 정책에 컴포넌트를 추가해도 `productIds`는 그대로이므로 이 matcher는 수정이 필요 없다. 그러나 그 사실을 실제로 확인하고 넘어간다.

Run: `node -e "import('./tooling/lib/tree-audit.mjs').then(async () => { const t = await import('node:fs/promises'); const s = await t.readFile('shared/updates/update-policy.json','utf8'); console.log(/\"productIds\":\s*\[\s*\"game-design-studio\",\s*\"game-design-career\"\s*\]/u.test(s)); })"`

Expected: `true`. `false`가 나오면 matcher와 정책 서식이 어긋난 것이므로 matcher를 실제 서식에 맞춰 갱신한다.

- [ ] **Step 6: 매니페스트 생성기에 suite를 배선**

`tooling/generate-update-manifest.mjs`가 `installed-components.json`을 만든다. suite의 `installedTag`는 벤더처럼 고정 문자열이 아니라 릴리스 버전이므로, `products/game-design-studio/.codex-plugin/plugin.json`의 `version`에 `v` 접두를 붙여 채운다. 두 제품 버전이 다르면 생성기가 `SUITE_VERSION_MISMATCH`로 실패해야 한다. 그 실패를 고정하는 테스트를 `tests/unit/generate-update-manifest.test.mjs`에 추가한다.

- [ ] **Step 7: 테스트 통과 확인**

Run: `node --test tests/unit/update-advisory.test.mjs tests/unit/game-design-update-check.test.mjs tests/unit/generate-update-manifest.test.mjs 2>&1 | grep -E "^ℹ (tests|pass|fail)"`

Expected: `fail 0`.

- [ ] **Step 8: 4엔드포인트 폐쇄와 fail-open을 고정**

`tests/unit/game-design-update-check.test.mjs`의 `ENDPOINTS`/`INSTALLED` 상수에 suite를 추가하고, 기존 "checks only the three literal official release endpoints on a cache miss" 케이스의 이름과 기대값을 넷으로 갱신한다. 여기에 더해 timeout, 403, 404, 429, 500, malformed JSON 각각이 `status: "unknown"`으로 끝나고 예외를 던지지 않음을 표 기반 케이스로 추가한다.

- [ ] **Step 9: 검증과 커밋**

```bash
npm run validate
git add shared/updates tooling/generate-update-manifest.mjs shared/scripts tests/unit
git commit -m "feat: track the suite release alongside the bundled upstreams"
```

---

### Task 2: 캐시 스키마 2와 버전 억제 상태

"이 버전은 다시 알리지 않기"를 저장할 곳이 없다. `CACHE_KEYS`는 폐쇄 목록이므로 키를 추가하고 `schemaVersion`을 2로 올린다. 버전 1 캐시는 신뢰하지 않고 첫 실행으로 재검사한다. 캐시는 재생성 가능하므로 마이그레이션 코드를 만들지 않는다.

**Files:**
- Modify: `shared/scripts/check-game-design-updates.mjs:19-27` (`CACHE_KEYS`), 캐시 검증·기록 경로
- Test: `tests/unit/game-design-update-check.test.mjs`

**Interfaces:**
- Consumes: Task 1의 `game-design-suite` 컴포넌트 ID
- Produces: 캐시 레코드에 `suppressedComponents: Array<{id, installedTag, latestTag}>`. 태스크 4의 스킬이 "다시 알리지 않기" 선택 시 이 배열에 항목을 추가한다. 억제는 그 정확한 3튜플 조합에만 적용된다.

- [ ] **Step 1: 실패하는 테스트를 먼저 추가**

`tests/unit/game-design-update-check.test.mjs`에 추가한다.

```javascript
test("a schemaVersion 1 cache is treated as a first run instead of being trusted", async (t) => {
  const { pluginRoot, home } = await fixture(t);
  await seedCache({ home, record: { ...validRecord(), schemaVersion: 1 } });
  const calls = [];

  const result = await checkGameDesignUpdates({
    pluginRoot, home, now: Date.parse("2026-08-17T00:00:00.000Z"),
    fetchFn: checkingFetch(calls), env: {},
  });

  assert.equal(calls.length, ENDPOINTS.length, "a version 1 cache must not suppress the network check");
  assert.equal(result.cache, "miss");
});

test("a suppressed version combination produces no notification while the advisory stays outdated", async (t) => {
  const { pluginRoot, home } = await fixture(t);
  await seedCache({ home, record: {
    ...outdatedRecord(),
    suppressedComponents: [{ id: "skillstead", installedTag: "svg-infographic/v0.9.0", latestTag: "svg-infographic/v0.10.0" }],
  } });

  const result = await checkGameDesignUpdates({
    pluginRoot, home, now: Date.parse("2026-08-17T00:00:00.000Z"),
    fetchFn: async () => { throw new Error("no network expected on a fresh cache"); },
    env: {},
  });

  assert.equal(result.status, "outdated", "suppression hides the prompt, not the fact");
  assert.equal(result.notification, null);
});

test("suppression does not carry over to a different latest version", async (t) => {
  const { pluginRoot, home } = await fixture(t);
  await seedCache({ home, record: {
    ...outdatedRecord(),
    suppressedComponents: [{ id: "skillstead", installedTag: "svg-infographic/v0.9.0", latestTag: "svg-infographic/v0.10.0" }],
  } });

  const result = await checkGameDesignUpdates({
    pluginRoot, home, now: Date.parse("2026-08-31T00:00:00.000Z"),
    fetchFn: checkingFetch([], () => releaseResponseFor("svg-infographic/v0.11.0")),
    env: {},
  });

  assert.equal(result.notification?.componentIds.includes("skillstead"), true);
});
```

`seedCache`, `validRecord`, `outdatedRecord`, `releaseResponseFor`는 기존 파일에 있는 헬퍼를 재사용하거나, 없으면 기존 `cacheRecordFor` 스타일을 따라 파일 상단에 추가한다.

- [ ] **Step 2: 실패 확인**

Run: `node --test tests/unit/game-design-update-check.test.mjs 2>&1 | grep -E "^✖|^ℹ (tests|pass|fail)"`

Expected: 새 케이스 세 개가 실패한다. `suppressedComponents`가 `CACHE_KEYS` 밖이라 `hasExactKeys`가 레코드를 거부하고 캐시가 무효로 읽히기 때문이다.

- [ ] **Step 3: 스키마 2와 억제 키를 구현**

`CACHE_KEYS`에 `"suppressedComponents"`를 추가하고, 캐시를 쓰는 `cacheRecord()`가 스키마 2를 기록하게 한다. 캐시를 읽는 `cacheAdvisory()`에 다음 조건을 추가한다.

```javascript
  if (record.schemaVersion !== 2) return null;
```

`notificationFor(advisory, previousIdentity, suppressed)`가 억제된 3튜플과 정확히 일치하는 컴포넌트를 알림 대상에서 제외하게 한다. 억제는 `id`, `installedTag`, `latestTag`가 모두 같을 때만 적용한다.

- [ ] **Step 4: 통과 확인**

Run: `node --test tests/unit/game-design-update-check.test.mjs 2>&1 | grep -E "^ℹ (tests|pass|fail)"`

Expected: `fail 0`.

- [ ] **Step 5: 검증과 커밋**

```bash
npm run validate
git add shared/scripts/check-game-design-updates.mjs tests/unit/game-design-update-check.test.mjs
git commit -m "feat: carry per-version notification suppression in a schema 2 cache"
```

---

### Task 3: 공용 스킬 파일과 두 제품 배선

스킬 본문을 만들고 두 제품 패키지에 byte-exact로 설치되게 한다. 이 태스크는 배선만 다룬다. 승인 흐름의 동작 계약은 태스크 4가 고정한다.

**Files:**
- Create: `shared/suite-update/skills/upgrade-game-design-suite/SKILL.md`
- Create: `shared/suite-update/skills/upgrade-game-design-suite/references/codex-commands.md`
- Modify: `tooling/lib/build-product.mjs:10-32` (`staticSharedMappings`), 인벤토리 상수
- Modify: `products/game-design-studio/product.json`, `products/game-design-career/product.json` (`sharedModules`)
- Modify: `products/game-design-studio/plugin/references/routing.json`, `products/game-design-career/plugin/references/routing.json`
- Modify: `tooling/isolation-smoke.mjs:31-46` (`EXACT_SKILL_IDS`)
- Modify: `tooling/lib/user-guides.mjs:63-69` (`sharedSkills`)
- Modify: `tests/contracts/shared-contract.test.mjs:580-602` (`expectedCareerSkillIds`, 공용 스킬 목록)
- Test: `tests/contracts/shared-contract.test.mjs`, `tooling/isolation-smoke.mjs`

**Interfaces:**
- Consumes: Task 1의 `game-design-suite` 컴포넌트, Task 2의 억제 상태
- Produces: 스킬 ID `upgrade-game-design-suite`. 두 제품 패키지의 `skills/upgrade-game-design-suite/SKILL.md`가 byte-exact다. 계획 3의 대표 스킬 문서가 이 ID를 참조한다.

- [ ] **Step 1: 스킬 파일을 만든다**

`shared/suite-update/skills/upgrade-game-design-suite/SKILL.md`:

```markdown
---
name: upgrade-game-design-suite
description: Use when the user asks to check for a Game Design Suite update, install a newer version, or silence update notices, and when a session start notice reported an available release.
---

# Upgrade Game Design Suite

## Overview

Report what is installed, what is available, and what changing it would take. Never change an installation without an explicit human decision in this conversation.

## Workflow

1. Read the current advisory. Run the packaged update check and read its JSON. Do not call any provider command in this step.
2. Read [codex-commands.md](references/codex-commands.md) for the exact host commands. Never invent a command that is not in that file.
3. Inspect the installation with the packaged inspection script. It validates the marketplace snapshot and produces a reinstall plan without executing it.
4. Present the four choices below and stop. Wait for the person to answer.
5. Apply only the chosen option. Report the result.

## Choices

- Update now. Apply the verified plan.
- Later. Leave the seven-day advisory state untouched.
- Do not tell me about this version again. Suppress only this exact installed and latest version combination.
- Turn update checks off. Explain the `GAME_DESIGN_UPDATE_CHECKS=false` contract and stop checking and writing the cache.

## Operating Rules

- A local marketplace cannot be upgraded from a Git release. Explain how to switch to the Git marketplace and never edit marketplace files directly.
- A manifest name mismatch, an equal or lower version, a prerelease, invalid UTF-8, a BOM, a symlink, or a path outside the marketplace ends the run as `current` or `unknown` with no install command.
- A dirty local marketplace checkout stops the update and reports the state. Never stash or discard local changes.
- Never run `git reset --hard`, `rm -rf`, a direct replacement, or a `.bak` restore in an install directory.
- Never edit an installed plugin cache or a bundled vendor directory.
- Never read a GitHub API token or a user API key.
- Never include a token, a user home absolute path, or a remote response body in a failure message.

## Result Report

After a successful update, report the previous version, the new version, the products that changed, bundled component changes, and the verification outcome in no more than seven items, then give the instruction to start a new session. Without evidence for a change list, report only versions and verification results and do not guess at features.

## Completion Signal

Stop when the person has chosen and the chosen action has either completed with a verified result or stopped with a visible blocker. An unavailable release, an unreachable network, and an unsupported marketplace layout are all results, not failures to retry silently.
```

`references/codex-commands.md`:

```markdown
# Codex Host Commands

This file is the only place that names host-specific commands. Replace this file to port the skill to another host; the skill body stays unchanged.

## Read-only, safe before approval

- Advisory: `node scripts/check-game-design-updates.mjs`
- Installation inspection: `node scripts/inspect-game-design-plugin-updates.mjs --inspect`
- Reinstall plan for one plugin: `node scripts/inspect-game-design-plugin-updates.mjs --plan <plugin>`

The plan command prints an ordered argv list. It does not execute anything.

## Applied only after an explicit approval

Run the argv list the plan produced, in order, prefixed with `codex`. For a Git marketplace this is:

1. `codex plugin marketplace upgrade game-design-suite --json`
2. `codex plugin add <plugin>@game-design-suite --json`

For a local marketplace the first command is absent and only step 2 runs. `codex plugin marketplace upgrade` fails on a local marketplace; do not call it there.

## Never run

`codex plugin remove`, any `git` command inside an install directory, and any direct file write under the plugin cache.
```

- [ ] **Step 2: 빌드 매핑을 추가**

`tooling/lib/build-product.mjs`의 `staticSharedMappings`에 항목을 추가한다. `shared/updates`는 건드리지 않는다.

```javascript
  "suite-update-skill": [["shared/suite-update/skills", "skills"]],
```

`sharedMemoryInventory`와 같은 방식으로 폐쇄 인벤토리를 추가하고 기존 인벤토리 검증 지점에 연결한다.

```javascript
const sharedSuiteUpdateInventory = Object.freeze({
  "shared/suite-update/skills": Object.freeze([
    "upgrade-game-design-suite/SKILL.md",
    "upgrade-game-design-suite/references/codex-commands.md",
  ]),
});
```

두 `products/*/product.json`의 `sharedModules` 배열 끝에 `"suite-update-skill"`을 추가한다.

- [ ] **Step 3: 목록 네 곳을 갱신**

같은 스킬 ID를 네 곳이 각각 폐쇄 목록으로 들고 있다. 하나라도 빠지면 다른 테스트가 실패하므로 함께 바꾼다.

1. `products/game-design-studio/plugin/references/routing.json`의 `skillIds`와 `plannedPaths.skills`
2. `products/game-design-career/plugin/references/routing.json`의 같은 두 배열
3. `tooling/isolation-smoke.mjs`의 `EXACT_SKILL_IDS` 두 배열
4. `tests/contracts/shared-contract.test.mjs`의 `expectedCareerSkillIds`와 공용 스킬 기대 목록

`tooling/lib/user-guides.mjs`의 `sharedSkills`에도 추가한다.

```javascript
    ["upgrade-game-design-suite", path.join(repoRoot, "shared/suite-update/skills/upgrade-game-design-suite", "SKILL.md")],
```

- [ ] **Step 4: 빌드하고 byte-exact를 확인**

```bash
npm run build
diff plugins/game-design-studio/skills/upgrade-game-design-suite/SKILL.md \
     plugins/game-design-career/skills/upgrade-game-design-suite/SKILL.md
diff shared/suite-update/skills/upgrade-game-design-suite/SKILL.md \
     plugins/game-design-studio/skills/upgrade-game-design-suite/SKILL.md
```

Expected: 두 `diff` 모두 출력 없음.

- [ ] **Step 5: 경로 예산을 확인**

계획 1이 도입한 150자 예산에 새 경로가 들어오는지 본다.

Run: `node -e "const p='skills/upgrade-game-design-suite/references/codex-commands.md'; console.log(p.normalize('NFC').length)"`

Expected: 150 미만인 값. 실제로는 60 안팎이다.

- [ ] **Step 6: 통합 검증**

```bash
node tooling/isolation-smoke.mjs
node --test tests/contracts/shared-contract.test.mjs
npm run validate
```

Expected: 세 명령 모두 통과. `isolation-smoke`는 두 제품의 정확한 스킬 수가 하나씩 늘어난 것을 보고한다.

- [ ] **Step 7: 커밋**

```bash
git add shared/suite-update tooling products plugins tests/contracts/shared-contract.test.mjs
git commit -m "feat: ship the suite upgrade skill in both products"
```

---

### Task 4: 승인 게이트와 금지 동작을 테스트로 고정

스킬 본문의 규칙은 산문이다. 산문은 회귀를 막지 못한다. 검사·계획 단계가 provider 명령을 부르지 않는다는 것과 금지 동작이 코드 어디에도 없다는 것을 실행 가능한 테스트로 고정한다.

**Files:**
- Create: `tests/unit/suite-update-skill.test.mjs`
- Test: 같은 파일

**Interfaces:**
- Consumes: Task 3의 스킬 파일 경로, `shared/scripts/inspect-game-design-plugin-updates.mjs`의 `inspectPluginUpdates`와 `planApprovedPluginUpdate`
- Produces: 없음. 최종 태스크다.

- [ ] **Step 1: 계약 테스트를 작성**

```javascript
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  inspectPluginUpdates,
  planApprovedPluginUpdate,
} from "../../shared/scripts/inspect-game-design-plugin-updates.mjs";

const skillRoot = new URL("../../shared/suite-update/skills/upgrade-game-design-suite/", import.meta.url);
const skill = await readFile(new URL("SKILL.md", skillRoot), "utf8");
const commands = await readFile(new URL("references/codex-commands.md", skillRoot), "utf8");

test("inspection never runs a command that changes an installation", () => {
  const ran = [];
  inspectPluginUpdates({
    runCommand: (argv) => {
      ran.push(argv.join(" "));
      return listOutputFixture();
    },
  });

  for (const argv of ran) {
    assert.doesNotMatch(argv, /marketplace upgrade|plugin add|plugin remove/u, `inspection ran a mutating command: ${argv}`);
  }
});

test("a git marketplace plan refreshes once and installs once, in that order", () => {
  const plan = planApprovedPluginUpdate({
    marketplace: { name: "game-design-suite", sourceType: "git" },
    plugin: "game-design-studio",
    installedVersion: "0.1.1",
    availableVersion: "0.1.2",
  });

  assert.deepEqual(plan, [
    ["plugin", "marketplace", "upgrade", "game-design-suite", "--json"],
    ["plugin", "add", "game-design-studio@game-design-suite", "--json"],
  ]);
});

test("a local marketplace plan never tries to upgrade the marketplace", () => {
  const plan = planApprovedPluginUpdate({
    marketplace: { name: "game-design-suite", sourceType: "local" },
    plugin: "game-design-studio",
    installedVersion: "0.1.1",
    availableVersion: "0.1.2",
  });

  assert.deepEqual(plan, [["plugin", "add", "game-design-studio@game-design-suite", "--json"]]);
});

test("an equal or lower available version produces no plan at all", () => {
  for (const availableVersion of ["0.1.1", "0.1.0"]) {
    assert.throws(() => planApprovedPluginUpdate({
      marketplace: { name: "game-design-suite", sourceType: "git" },
      plugin: "game-design-studio",
      installedVersion: "0.1.1",
      availableVersion,
    }), `${availableVersion} must not produce an install plan`);
  }
});

// The skill body is prose, so the forbidden actions can only regress silently.
// Naming them here makes a reintroduction fail the suite.
test("the skill body never names a destructive recovery command", () => {
  for (const forbidden of ["git reset --hard", "rm -rf", ".bak", "auto_upgrade", "git stash"]) {
    assert.equal(skill.includes(forbidden), forbidden === "git reset --hard" || forbidden === "rm -rf" || forbidden === ".bak" || forbidden === "auto_upgrade",
      `${forbidden} may appear only inside an explicit prohibition`);
  }
  assert.match(skill, /Never run `git reset --hard`, `rm -rf`, a direct replacement, or a `\.bak` restore/u);
});

test("host commands live only in the reference file", () => {
  assert.doesNotMatch(skill, /codex plugin/u, "the skill body must not name a host command directly");
  assert.match(commands, /codex plugin marketplace upgrade game-design-suite --json/u);
});

test("the skill offers exactly the four approved choices", () => {
  for (const choice of ["Update now", "Later", "Do not tell me about this version again", "Turn update checks off"]) {
    assert.ok(skill.includes(choice), `missing choice: ${choice}`);
  }
});
```

`listOutputFixture()`는 `inspect-game-design-plugin-updates.mjs`가 기대하는 `plugin list --json` 형태를 그대로 만든다. 기존 `tests/unit/plugin-update-inspection.test.mjs`의 픽스처를 읽어 같은 모양으로 맞춘다.

- [ ] **Step 2: 실행하고 실패를 확인**

Run: `node --test tests/unit/suite-update-skill.test.mjs 2>&1 | grep -E "^(✔|✖)|^ℹ (tests|pass|fail)"`

Expected: 스킬 본문 문구와 어긋나는 케이스가 실패한다. 실패가 하나도 없으면 테스트가 아무것도 검증하지 않는 것이므로, 본문에서 문구 하나를 일부러 바꿔 실패를 눈으로 확인한 뒤 되돌린다.

- [ ] **Step 3: 스킬 본문과 테스트를 일치시킨다**

테스트가 요구하는 문구에 맞춰 `SKILL.md`를 수정한다. 문구를 바꾸는 쪽이 옳은 경우에는 테스트를 바꾼다. 어느 쪽이든 두 파일이 같은 계약을 말하게 만든다.

- [ ] **Step 4: 통과 확인**

Run: `node --test tests/unit/suite-update-skill.test.mjs 2>&1 | grep -E "^ℹ (tests|pass|fail)"`

Expected: `fail 0`.

- [ ] **Step 5: 커밋**

```bash
npm run validate
git add tests/unit/suite-update-skill.test.mjs shared/suite-update
git commit -m "test: pin the upgrade skill approval gate and forbidden actions"
```

---

### Task 5: 실설치 왕복으로 확인

단위 테스트는 계약을 고정하지만 설치본에서 스킬이 실제로 보이는지는 말해주지 않는다. 격리된 `CODEX_HOME`으로 왕복을 돌린다.

**Files:**
- 없음. 검증 전용 태스크다.

**Interfaces:**
- Consumes: Task 3의 빌드 산출물
- Produces: 없음

- [ ] **Step 1: 격리 설치**

```bash
export CODEX_HOME="$(mktemp -d)/codex-home"
mkdir -p "$CODEX_HOME"
cp ~/.codex/auth.json "$CODEX_HOME/auth.json"
chmod 600 "$CODEX_HOME/auth.json"
codex plugin marketplace add "$(pwd -P)" --json
codex plugin add game-design-studio@game-design-suite --json
codex plugin add game-design-career@game-design-suite --json
```

`CODEX_HOME`을 반드시 먼저 설정한다. 설정하지 않으면 사용자의 실제 `~/.codex`를 변경한다.

- [ ] **Step 2: 스킬이 두 제품 모두에 노출되는지 확인**

```bash
codex exec --sandbox read-only "사용 가능한 스킬 중 upgrade 로 시작하는 것만 나열해."
```

Expected: `game-design-studio:upgrade-game-design-suite`와 `game-design-career:upgrade-game-design-suite`가 모두 보인다.

- [ ] **Step 3: 검사 단계가 아무것도 바꾸지 않는지 확인**

```bash
S="$CODEX_HOME/plugins/cache/game-design-suite/game-design-studio/0.1.1"
cp "$CODEX_HOME/config.toml" /tmp/config-before.toml
node "$S/scripts/check-game-design-updates.mjs"
node "$S/scripts/inspect-game-design-plugin-updates.mjs" --inspect
diff /tmp/config-before.toml "$CODEX_HOME/config.toml" && echo "no state change during inspection"
```

Expected: advisory JSON이 네 컴포넌트를 보고하고 `diff`가 출력 없이 끝난다.

- [ ] **Step 4: 정리와 사용자 환경 무변경 확인**

```bash
codex plugin remove game-design-studio@game-design-suite
codex plugin remove game-design-career@game-design-suite
codex plugin marketplace remove game-design-suite
rm -f "$CODEX_HOME/auth.json"
stat -f "%Sm" ~/.codex/config.toml
rm -rf ~/Library/Caches/game-design-suite
```

Expected: 실제 `~/.codex/config.toml`의 mtime이 테스트 전과 같다. 마지막 줄은 테스트가 만든 advisory 캐시를 지워 사용자의 첫 실제 실행이 억제되지 않게 한다.

- [ ] **Step 5: 전체 스위트**

Run: `npm test`

Expected: `fail 0`.

---

## Self-Review

**스펙 커버리지.** A절의 각 소절을 태스크에 대응시켰다. 릴리스 권위 → Task 1. SessionStart 안내 확장과 캐시 → Task 1 Step 8, Task 2. 실행 계약 → Task 3의 `codex-commands.md`와 Task 4의 계획 테스트. 사용자 선택 네 개 → Task 3 본문, Task 4 마지막 케이스. 결과 보고 → Task 3 본문. 금지 동작 → Global Constraints와 Task 4. 재사용 → Task 4가 기존 inspect 스크립트를 직접 호출해 확인. 호스트 명령 격리 → Task 3의 참조 파일과 Task 4의 "host commands live only in the reference file".

**빠진 것을 의도적으로 남긴 부분.** 스펙 A절 테스트 전략의 "로컬 fixture `0.1.1 → 0.1.2`에서 `plugin add`가 새 버전을 설치하고 이전 캐시를 제거한다"와 "Git 경로는 로컬 bare 저장소로 승인 전 refresh 0회, 승인 뒤 refresh 1회"는 실제 버전 증가가 필요하다. `0.1.2`가 존재하지 않는 현재로서는 픽스처를 위한 가짜 릴리스를 만들어야 하고, 그것은 릴리스 절차(계획 4의 7단계)와 묶는 편이 정직하다. Task 4는 계획 생성까지만 고정하고 실행 검증은 계획 4로 넘긴다. 이 이월을 계획 4 착수 시 첫 항목으로 다룬다.

**타입 일관성.** Task 1이 만드는 컴포넌트 ID `game-design-suite`를 Task 2의 억제 3튜플과 Task 4의 계획 테스트가 같은 문자열로 쓴다. `installedTag`는 전 구간에서 `v` 접두 SemVer다. `planApprovedPluginUpdate`의 인자 `installedVersion`/`availableVersion`은 접두 없는 SemVer라는 점이 다르다. 기존 스크립트의 계약이므로 바꾸지 않고, Task 4 테스트가 두 형태를 각각 명시적으로 쓴다.

**플레이스홀더 점검.** `<git rev-list -n 1 v0.1.1 결과>` 하나만 남겼다. 이것은 실행 시점에 확인해야 하는 값이고 명령을 함께 적었으므로 미결정 항목이 아니다.
