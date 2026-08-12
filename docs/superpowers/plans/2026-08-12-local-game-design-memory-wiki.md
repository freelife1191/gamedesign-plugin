# Local Game Design Memory Wiki Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Studio와 Career가 승인된 프로젝트 기억만 로컬에서 안전하게 다시 사용하고, 의미 있는 작업 결과만 검토 대기 교훈으로 축적하도록 구현한다.

**Architecture:** 한 번만 추가하는 Markdown 기억 이벤트를 유일한 원본으로 두고 결정적 접기(`fold`)에서 현재 `head`와 변경 불가 JSON 색인 세대를 만든다. 공통 설정·검사·추가·접기·검색·상태 전이 런타임을 두 제품에 동일하게 패키징하고, 각 오케스트레이터는 작업 시작 전 검색과 결과 검증 후 후보 작성을 호출한다. 기억은 보조 기능이므로 읽기·저장 장애에서는 기존 기획을 계속하지만, 검증되지 않은 기억을 적용했다고 주장하는 경로는 실패 처리한다.

**Tech Stack:** Node.js `>=18`, ESM `.mjs`, `node:test`, 제한된 YAML 앞부분, Markdown, JSON Schema, SHA-256, Git 로컬 제외 파일, 기존 재현 가능한 product builder

## Global Constraints

- 기본 설정은 `GAME_DESIGN_MEMORY_ENABLED=true`, `GAME_DESIGN_MEMORY_SCOPE=project`, `GAME_DESIGN_MEMORY_MAX_ITEMS=5`, `GAME_DESIGN_MEMORY_CANDIDATE_TTL_DAYS=30`, `GAME_DESIGN_MEMORY_GIT_MODE=local`이다.
- `GAME_DESIGN_MEMORY_ENABLED=false`와 요청 단위 제외에서는 기억 저장소 읽기·쓰기·생성, 후보, 색인과 영수증이 0건이어야 한다.
- append-only Markdown 이벤트와 quarantine marker가 기억의 유일한 원본이며 JSON·Markdown 파생 세대(`derived generation`)는 삭제 후 재생성 가능한 캐시다.
- AI가 추론한 교훈과 플레이테스트·검토 결과는 `candidate`까지만 만들 수 있다. 명시적인 사용자 지속 선호만 `explicit-user-instruction` 근거로 바로 승인할 수 있다.
- 기억은 프로젝트 결과물의 근거를 대신하지 않는다. 적용된 사실과 결정은 기존 `evidence.yml` 또는 `decisions/` 원본에도 연결한다.
- 프로젝트 ID를 기존 결과물이나 사용자 입력에서 확인하지 못하면 추측하지 않고 해당 실행의 기억 검색·후보 작성을 건너뛴다.
- Studio 기획 교훈과 Career 학습·취업 교훈을 서로의 설계 원칙으로 사용하지 않는다. 공통 사실·결정만 양쪽에서 참조한다.
- 기억 문서는 기본적으로 `.game-design/` 아래 로컬에만 보관하고 자동 커밋·원격 전송하지 않는다.
- 플러그인 설치·업데이트·제거는 작업 공간의 `.game-design/`을 만들거나 삭제하지 않는다. 기억 초기화는 실제 후보 작성이나 명시적 유지 관리 요청에서만 일어난다.
- API 키, 자격 증명, 개인 식별 정보와 비공개 원문 전체를 기억·색인·영수증·오류에 기록하지 않는다.
- 기억 본문은 신뢰하지 않는 자료다. 본문에 들어 있는 스킬 호출, 승인 변경, 파일 조작 또는 네트워크 명령을 실행하지 않는다.
- 현재 `SessionStart`와 `Stop` Hook 계약은 변경하지 않는다. SQLite, 임베딩과 외부 검색 서비스는 이 계획에 포함하지 않는다.
- 현재 Node `>=18`과 외부 런타임 의존성 0개를 유지한다.
- Node `>=18` 표준 라이브러리만 사용한다. runtime compiler, C helper와 외부
  dependency는 허용하지 않는다.
- 모든 runtime `now` 인자는 유효한 `Date` 객체다. 저장 시각은
  `toISOString()` UTC로 기록하고 테스트는 고정된 `Date`를 주입한다.
- `plugins/game-design-studio`와 `plugins/game-design-career`는 직접 수정하지 않고 마지막 통합 작업에서 표준 빌드로 재생성한다.
- 작업 트리의 사용자 소유 변경과 추적되지 않은 파일을 보존한다. 각 커밋은 해당 작업의 원천·테스트만 포함한다.

---

## File Structure

### 공통 설정

- `shared/scripts/lib/load-workspace-env.mjs`: 작업 공간 루트 `.env`를 경계·크기·파일 정체성 검증과 함께 한 번 읽고, 호출자가 선언한 키만 반환한다.
- `shared/scripts/validate-image-config.mjs`: 공통 `.env` 읽기를 사용하도록 기존 이미지 설정 로더를 이관한다. 공개 API와 기존 오류 의미를 유지한다.
- `shared/scripts/load-memory-config.mjs`: 기억 환경 변수의 우선순위, 안전한 축소값과 공개 설정을 제공한다.
- `shared/memory/schema/memory-config.schema.json`: 닫힌 기억 설정 결과 스키마다.
- `shared/image-assets/.env.example`, `.env.example`: 이미지와 기억 설정을 함께 설명하는 동일한 안전 예시다.

### 기억 원본과 안전한 저장

- `shared/memory/schema/memory-record.schema.json`: 기억 종류, 상태, 범위, lane, 출처와 승인 근거의 닫힌 스키마다.
- `shared/memory/schema/memory-event.schema.json`: capture·transition·resolution envelope와 완전한 record snapshot의 닫힌 스키마다.
- `shared/memory/schema/memory-index.schema.json`: fold source tree digest, head event와 정렬된 검색 항목 스키마다.
- `shared/memory/schema/memory-receipt.schema.json`: 적용·제외·후보 수와 사용한 ID·해시만 허용하는 로컬 영수증 스키마다.
- `shared/memory/templates/memory-record.md`: 한국어 기억 문서 골격이다.
- `shared/memory/templates/index.md`: 사람이 읽는 기억 목록 골격이다.
- `shared/memory/templates/log.md`: 시간순 변경 기록 골격이다.
- `shared/scripts/validate-design-memory.mjs`: Markdown event 파싱, 순수 레코드 검사, 상태 전이와 출처 검증을 담당한다.
- `shared/scripts/lib/safe-memory-store.mjs`: 프로젝트·작업 공간·전역 로컬 루트 해석, 심볼릭 링크 없는 제한 읽기, sealed instance append와 별도 best-effort Git 로컬 제외를 담당한다.

### 색인과 작업

- `shared/scripts/retrieve-design-memory.mjs`: raw 이벤트와 marker를 scan/fold해 결정적 색인 세대를 만들고 승인된 관련 기억만 제한적으로 반환한다.
- `shared/scripts/capture-design-memory.mjs`: 허용된 사건을 content-addressed capture event로 append한다.
- `shared/scripts/maintain-design-memory.mjs`: 승인·거부·폐기·만료 transition, branch resolution, quarantine marker와 derived generation 생성을 수행한다.

### 공통 스킬과 제품 통합

- `shared/memory/skills/retrieve-approved-design-memory/SKILL.md`: 작업 시작 전 읽기 전용 검색 계약이다.
- `shared/memory/skills/capture-game-design-memory/SKILL.md`: 결과 검증 후 사건 선별·후보 작성 계약이다.
- `shared/memory/skills/maintain-game-design-memory/SKILL.md`: 사용자가 후보를 확인·승인·폐기하고 저장소를 점검하는 계약이다.
- `shared/memory/references/memory-policy.md`: 적용 자격, Studio·Career 경계와 개인정보 규칙이다.
- `shared/memory/references/memory-lifecycle.md`: 허용 상태 전이와 보존 정책이다.
- `tooling/lib/build-product.mjs`: 공통 기억 스킬은 `skills/`, 나머지는 `references/shared/memory/`로 재현 가능하게 패키징한다.
- `tooling/lib/product-contract.mjs`, `shared/contracts/product.schema.json`, `shared/contracts/README.md`: `memory` 공통 모듈 계약을 등록한다.
- `products/game-design-{studio,career}/product.json`: 두 제품이 `memory` 모듈을 선언한다.
- 두 제품 `references/routing.json`: 기억 스킬, 직접 검토 담당과 고정 `memoryWorkflow`를 등록한다.
- 두 제품 오케스트레이터 `SKILL.md`: 검색·적용·후보 작성 순서와 요청 단위 제외를 명시한다.

### 사용자 문서와 검증

- `README.md`, 제품 README, 설치·빠른 시작·workflow·FAQ·skills 가이드: 기본 로컬 기억, 비활성화, 관리 예시, 설치 스킬 21개와 top-level 실행 스크립트 21개를 설명한다.
- `guides/game-design-{studio,career}/memory.md`: 제품별 기억 적용 범위와 직접 관리 예시를 제공한다.
- `tests/unit/design-memory-*.test.mjs`: 설정, 레코드, 저장, 검색과 상태 전이 단위 계약이다.
- `tests/contracts/shared-contract.test.mjs`, `tests/contracts/package-contents.test.mjs`: 공통 모듈과 설치 트리를 검증한다.
- `tests/products/{studio,career}/orchestrator.test.mjs`: 제품별 순서와 lane 경계를 검증한다.
- `tests/e2e/suite/design-memory.e2e.test.mjs`: 자연어 작업, 비활성화, 출처 변경, 충돌과 장애 우회를 실제 공통 런타임으로 검증한다.
- `tests/e2e/suite/memory-install-lifecycle.e2e.test.mjs`: 설치·업데이트·제거가 로컬 기억을 보존하는지 격리 환경에서 검증한다.

---

### Task 1: 안전한 `.env` 읽기와 기억 설정 계약

**Files:**
- Create: `shared/scripts/lib/load-workspace-env.mjs`
- Create: `shared/scripts/load-memory-config.mjs`
- Create: `shared/memory/schema/memory-config.schema.json`
- Create: `tests/unit/workspace-env.test.mjs`
- Create: `tests/unit/design-memory-config.test.mjs`
- Modify: `shared/scripts/validate-image-config.mjs`
- Modify: `tests/unit/image-config.test.mjs`
- Modify: `shared/image-assets/.env.example`
- Modify: `.env.example`

**Interfaces:**
- Produces: `readWorkspaceEnv({ workspaceRoot, env, supportedKeys, legacyKeys, lstatFn, openFileFn, readFileFn }) -> Promise<{ values, sources, warnings, legacyKeys }>`
- Produces: `validateMemoryConfig(value) -> { ok, errors }`
- Produces: `loadMemoryConfig({ workspaceRoot, env, lstatFn, openFileFn, readFileFn }) -> Promise<MemoryConfig>`
- Produces: `toPublicMemoryConfig(config) -> { enabled, scope, maxItems, candidateTtlDays, gitMode, sources, warnings }`
- Preserves: `loadImageConfig()` and `toPublicImageConfig()`의 현재 export, 반환 필드, 우선순위와 오류 비공개 계약

- [ ] **Step 1: 기억 설정의 실패 테스트를 작성한다**

`tests/unit/design-memory-config.test.mjs`에 다음 행위를 고정한다.

```js
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { loadMemoryConfig } from "../../shared/scripts/load-memory-config.mjs";

test("memory configuration defaults to enabled project-local memory", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "memory-config-"));
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

test("disabled memory ignores invalid subordinate values without widening scope", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "memory-config-"));
  await writeFile(path.join(root, ".env"), [
    "GAME_DESIGN_MEMORY_ENABLED=false",
    "GAME_DESIGN_MEMORY_SCOPE=internet",
    "GAME_DESIGN_MEMORY_MAX_ITEMS=999999",
    "GAME_DESIGN_MEMORY_CANDIDATE_TTL_DAYS=0",
    "GAME_DESIGN_MEMORY_GIT_MODE=publish",
    "",
  ].join("\n"));
  const config = await loadMemoryConfig({ workspaceRoot: root, env: {} });
  assert.equal(config.enabled, false);
  assert.equal(config.scope, "project");
  assert.equal(config.maxItems, 5);
  assert.equal(config.candidateTtlDays, 30);
  assert.equal(config.gitMode, "local");
});
```

같은 파일에 다음 mutation을 독립 fixture로 추가한다.

- 프로세스 환경이 `.env`보다 우선한다.
- 빈 프로세스 값은 `.env`로 내려간다.
- `ENABLED=maybe`는 기억을 끄고 값 원문을 출력하지 않는다.
- `SCOPE=global`은 명시한 경우만 유지된다.
- 최대 개수 0·11과 후보 기간 0·366은 기본값으로 축소된다.
- `.env` 심볼릭 링크, NUL, 중복 지원 키, 셸 치환과 64 KiB 초과는 거부된다.

- [ ] **Step 2: 실패를 확인한다**

Run:

```bash
node --test tests/unit/design-memory-config.test.mjs
```

Expected: `ERR_MODULE_NOT_FOUND`로 실패한다.

- [ ] **Step 3: 공통 작업 공간 환경 읽기 도구의 실패 테스트와 최소 구현을 작성한다**

`tests/unit/workspace-env.test.mjs`는 정규 파일을 `O_NOFOLLOW`로 열고 열기 전·후
`dev`와 `ino`가 같아야 하며, 지정하지 않은 키와 실제 값이 오류에 나타나지
않음을 검사한다.

`shared/scripts/lib/load-workspace-env.mjs`의 공개 형태를 다음으로 고정한다.

```js
export async function readWorkspaceEnv({
  workspaceRoot,
  env = process.env,
  supportedKeys,
  legacyKeys = [],
  lstatFn,
  openFileFn,
  readFileFn,
} = {}) {
  // Return only caller-declared keys after bounded, no-follow, identity-pinned reading.
  return { values, sources, warnings, legacyKeys: observedLegacyKeys };
}
```

구현 규칙은 다음과 같이 닫는다.

- `supportedKeys`는 중복 없는 환경 변수 이름 배열이다.
- 문법은 빈 줄, `#`로 시작하는 주석, 단순 `KEY=value`만 허용한다.
- 값은 기존과 같이 따옴표·역따옴표·보간·연속 줄을 허용하지 않는다.
- 64 KiB를 넘기 전에 중단한다.
- 환경 값이 비어 있지 않으면 `.env`보다 우선한다.
- 반환 `sources[key]`는 `environment`, `.env`, `unset` 중 하나다.

- [ ] **Step 4: 이미지 설정을 공통 읽기 도구로 이관하고 회귀를 확인한다**

`validate-image-config.mjs`의 자체 `.env` 열기·파싱을 제거하고
`readWorkspaceEnv()` 결과를 기존 `mode`, `model`, `quality`,
`requestTimeoutMs`, `apiKey`로 변환한다. 기존 공개 반환에서
`sources.requestTimeoutMs`가 제거되는 동작과 legacy warning을 유지한다.

Run:

```bash
node --test tests/unit/workspace-env.test.mjs tests/unit/image-config.test.mjs
```

Expected: 모든 기존 이미지 설정 테스트와 새 작업 공간 경계 테스트가 PASS한다.

- [ ] **Step 5: 기억 설정 로더와 스키마를 구현한다**

`load-memory-config.mjs`는 다음 닫힌 값을 사용한다.

```js
const defaults = Object.freeze({
  enabled: true,
  scope: "project",
  maxItems: 5,
  candidateTtlDays: 30,
  gitMode: "local",
});

const supportedKeys = Object.freeze([
  "GAME_DESIGN_MEMORY_ENABLED",
  "GAME_DESIGN_MEMORY_SCOPE",
  "GAME_DESIGN_MEMORY_MAX_ITEMS",
  "GAME_DESIGN_MEMORY_CANDIDATE_TTL_DAYS",
  "GAME_DESIGN_MEMORY_GIT_MODE",
]);
```

잘못된 `enabled`는 `false`, 범위는 `project`, 숫자는 기본값, Git 모드는
`local`로 축소하고 구조화된 warning code만 반환한다. 오류와 warning에 입력값을
복제하지 않는다.

- [ ] **Step 6: 두 `.env.example`에 동일한 한국어 기억 설정 주석을 추가한다**

두 파일의 bytes가 같아야 한다. 기존 이미지 설정은 보존하고 그 아래에 설계
문서의 다섯 기억 변수를 허용 값, 기본값, 완전 비활성화 의미와 함께 추가한다.

- [ ] **Step 7: Task 1 검증을 실행한다**

Run:

```bash
node --test tests/unit/workspace-env.test.mjs tests/unit/design-memory-config.test.mjs tests/unit/image-config.test.mjs
node --check shared/scripts/lib/load-workspace-env.mjs
node --check shared/scripts/load-memory-config.mjs
cmp .env.example shared/image-assets/.env.example
git diff --check
```

Expected: 모든 명령이 exit 0이다.

- [ ] **Step 8: Task 1을 커밋한다**

```bash
git add .env.example shared/image-assets/.env.example shared/memory/schema/memory-config.schema.json shared/scripts/lib/load-workspace-env.mjs shared/scripts/load-memory-config.mjs shared/scripts/validate-image-config.mjs tests/unit/workspace-env.test.mjs tests/unit/design-memory-config.test.mjs tests/unit/image-config.test.mjs
git commit -m "feat: add safe game design memory settings"
```

---

### Task 2: 변경 불가 기억 이벤트와 안전한 추가 저장소

**Files:**
- Create: `shared/memory/schema/memory-event.schema.json`
- Create: `shared/memory/schema/memory-record.schema.json`
- Create: `shared/memory/schema/memory-index.schema.json`
- Create: `shared/memory/schema/memory-receipt.schema.json`
- Create: `shared/memory/templates/memory-record.md`
- Create: `shared/memory/templates/index.md`
- Create: `shared/memory/templates/log.md`
- Create: `shared/scripts/validate-design-memory.mjs`
- Create: `shared/scripts/lib/safe-memory-store.mjs`
- Delete: `shared/scripts/lib/memory-store-posix-helper.c`
- Create: `tests/unit/design-memory-record.test.mjs`
- Create: `tests/unit/design-memory-store.test.mjs`

**Interfaces:**
- Consumes: Task 1 `MemoryConfig`
- Retains: `resolveMemoryStore`, immutable bounded `readMemoryFile`, `parseMemoryDocument`, `validateMemoryRecord`, `validateMemoryTransition`, `validateMemorySourceBindings`
- Produces: `memoryEventRelativePath({ memoryId, eventId }) -> string`
- Produces: `stageImmutableMemoryFile({ store, relativePath, bytes }) -> Promise<{ instancePath, fileSha256, byteLength }>`
- Produces: `parseMemoryEventDocument(source, { sourceName, eventId }) -> { event, record, sections }`
- Produces: `appendMemoryEvent({ store, eventDocument }) -> Promise<{ status: "created"|"present", eventId, relativePath, fileSha256 }>`
- Produces: `scanMemoryEvents({ store, maxEventBytes = 262144, maxEvents = 10000 }) -> Promise<MemoryEventScan>`
- Produces: `foldMemoryEvents(scan, { now }) -> MemoryFold`
- Produces: `appendQuarantineMarker({ store, targetMemoryId, targetEventId, targetRelativePath, observedSha256, reasonCode, actor, now }) -> Promise<AppendResult>`
- Retains separately: `ensureMemoryGitExclusion(...) -> Promise<{ status: "ready"|"warning"|"skipped", code? }>`
- Removes: `MEMORY_PLATFORM_CAPABILITIES`, `createMemoryStorePlatformAdapter`, `writeMemoryFileAtomic`, `moveMemoryFileAtomic`, `memoryRecordRelativePath`

- [ ] **Step 1: 이벤트 구조와 record RED를 작성한다**

`memory-event.schema.json`은 `schema_version: 1`, `event_type:
capture|transition|resolution`, `action`, `memory_id`, `operation_id`, 정렬되고 중복 없는
`parent_event_ids`, `effective_at`, `actor`, `reason`, resolution 전용
`chosen_parent_event_id`와 완전한 record snapshot을 닫힌 필드로 고정한다.

capture는 parent 0개, transition은 parent 1개, resolution은 작성 시 관찰한 head
집합을 parent로 가져야 한다. `action`은 capture에서 `capture`,
transition에서 전이 이름, resolution에서 `resolution`이다. logical record에서
`event_sha256`과 `event_id`를 제거하고 record schema, template과 validator가 두
필드를 unknown key로 거부하게 한다. 기존 record의 kind·lane·scope·status·source·
민감정보와 필수 본문 검사는 유지한다. 비-NFC ID, 잘못된 SHA-256, 정렬되지 않은
배열과 승인 근거 누락을 각각 실패 fixture로 둔다.

- [ ] **Step 2: event ID, operation ID와 fold RED를 확인한다**

`event-id = mev1-<sha256(canonical UTF-8 Markdown bytes)>`이며 `event_id`와
`event_sha256`은 문서 안에 넣지 않는다. canonical serializer fixture는 NFC,
BOM 없는 UTF-8, LF, 정확히 한 trailing LF, frontmatter delimiter와 고정 key 순서,
JSON double-quoted string, literal null, base-10 integer, 정렬된 block array/source,
조건부 key 생략, 고정 본문 section 순서와 blank-line 규칙을 byte fixture로 고정한다.

capture `operation_id`는 검증된 upstream `eventId`다. transition과 resolution은
8-byte unsigned big-endian length 뒤 UTF-8 value를 붙인 tuple
`["memory-operation-v1", memory_id, event_type, action, effective_at, actor, reason,
decimal(parent_count), ...sorted_parent_event_ids, chosen_parent_or_empty]`의 SHA-256을
`mop1-<sha256>`으로 쓴다. uniqueness는 `(memory_id, operation_id)` 범위다. 같은
memory에서 같은 operation ID의 다른 bytes는 `duplicate-operation`이다. orphan parent,
duplicate root, 불법 전이, snapshot identity·본문 변경과 supersedes cycle도
제외해야 한다.

Run:

```bash
node --test tests/unit/design-memory-record.test.mjs
```

Expected: event parser와 fold가 없어 RED다.

- [ ] **Step 3: 결정적 scan과 fold를 구현한다**

물리 저장 구조는 다음으로 고정한다.

```text
<store-root>/v1/
├── events/<memory-shard>/<memory-id>/<event-id>/
│   ├── instances/<instance-id>.md
│   ├── claims/<instance-id>.json
│   └── commit.json
├── controls/quarantine/<target-shard>/<target-event-id>/<marker-event-id>/
│   ├── instances/<instance-id>.md
│   ├── claims/<instance-id>.json
│   └── commit.json
└── derived/
    ├── indexes/<source-tree-sha256>/<index-sha256>/<instance-id>.json
    ├── views/<source-tree-sha256>/<view-sha256>/<instance-id>.md
    └── logs/<source-tree-sha256>/<log-sha256>/<instance-id>.md
```

`memory-shard = sha256(memory_id).slice(0,2)`다.
scanner는 NFC/UTF-8 byte 순으로 읽고 symlink, 특수 파일, oversize, 비정규 경로와
commit claim·instance hash 불일치를 진단한다. 유효한 `commit.json`이 seal한
instance만 logical event/control이다. fold는 유효 event DAG만 사용한다. head 1개는
현재 record, head 2개 이상은 `concurrent-conflict`이며 memory 전체를 검색에서
제외한다. human actor·reason·chosen head가 있는 resolution은 작성 시 기록한
pairwise-incomparable parent head만 소비한다. 이후 concurrent transition은 별도
head로 남고, 같은 parent의 동시 resolution도 두 head를 만든다. mtime, wall clock과
순회 순서로 winner를 고르지 않는다.

`maxEvents` 기본값과 hard maximum은 10,000이다. 1~10,000만 허용하며 source
`events/`와 `controls/quarantine/` 아래의 모든 directory·regular file·symlink·
special entry를 유효·sealed 여부와 관계없이 센다. 10,001번째를 처리하기 전에
`complete:false`, `memory.scan_limit_exceeded`로 중단한다. 불완전 scan은 store
전체를 승인 검색과 index generation publish에서 제외한다.

- [ ] **Step 4: 변경 불가 추가 연산의 적대적 RED를 작성한다**

`APPEND-IDEMPOTENT`, `APPEND-CONFLICT`, `APPEND-PARALLEL`, `BRANCH`, `PATH`,
`FAILPOINT`, `SCAN-LIMIT` fixture를 만든다. 두 프로세스가 같은 bytes/event ID를 쓰면 하나는
`created`, 하나는 `present`여야 한다. 같은 경로의 다른 bytes는 원본을 그대로
둔 채 conflict다. 서로 다른 이벤트는 둘 다 남아야 한다. 절대 경로, `..`,
역슬래시, NUL, 비-NFC, ancestor·final symlink, FIFO·socket, oversize와 pre-existing
identity swap은 파일을 만들지 않는다.

instance·claim write, sync와 commit hard link 전후 중단을 주입한다. unsealed
partial은 scanner 권한을 얻지 못하고 같은 event 재시도가 `created|present`로
회복해야 한다. 10,001번째 source entry 뒤에 approved 상태를 무효화하는 transition을
두면 scan이 불완전 상태로 끝나며 이전 approved head를 반환하거나 index를
publish하지 않아야 한다.

transition과 resolution 동시 실행, 같은 parent 집합의 resolution 두 개도 만든다.
resolution은 기록한 parent만 소비하며 나중 event는 별도 head로 남아 검색에서
제외돼야 한다.

같은 OS 계정의 악의적 프로세스가 syscall 사이 디렉터리를 swap하는 race는
Node 18 path API가 보장하지 않는 non-goal이다. 이 injected case는 skipped 경계
문서화로만 남기고 보안 PASS로 세지 않는다.

- [ ] **Step 5: Node 전용 추가 연산을 구현한다**

경로·크기 검증, 기존 ancestor `lstat/realpath`, 고정 디렉터리
`mkdir({ recursive: true, mode: 0o700 })`와 ancestor 재검사 뒤 random
`instances/<uuid>.md`를 `O_WRONLY|O_CREAT|O_EXCL|O_NOFOLLOW`, mode `0o600`으로
연다. write loop, `FileHandle.sync()`, close 뒤 bytes의 ID·schema를 read-back
검증한다. event ID, instance ID, file SHA-256과 byte length만 담은 canonical JSON을
`claims/<uuid>.json`에 완전히 쓰고 sync한다. claim은 `schemaVersion`, `eventId`,
`instanceId`, `fileSha256`, `byteLength` key 순서, 공백 없는 JSON과 trailing LF
한 개로 고정한다.

완전히 sync한 claim을 `link(claimPath, commit.json)`로 hard link해 create-once
commit한다. 성공 뒤 parent best-effort sync와 commit/instance read-back 검증을
마쳐야 `created`다. `EEXIST`이면 기존 commit claim과 sealed instance의 exact
canonical bytes를 bounded read로 검증해 같으면 `present`, 다르면 conflict다.
instance·claim partial과 commit 없는 완성본은 scanner가 무시하며 재시도는 새
UUID를 사용한다. commit marker는 sync된 claim의 hard link여서 partial일 수 없다.

plugin API는 source event/control에 truncate, rename, unlink를 호출하거나
overwrite/delete 기능을 노출하지 않는다. runtime compiler, C helper, external
process, replace, move와 current pointer를 모두 제거한다.

전역 저장소는 임의 환경 경로를 받지 않고 `home`과 `platform`으로만 정한다.
`project`와 `workspace`는 작업 공간 저장소를 공유하되 `project_id`로 구분한다.

- [ ] **Step 6: quarantine marker, 출처와 Git trust separation을 구현한다**

손상은 overwrite하거나 이동하지 않는다. scanner 오류는 안전한 상대 path,
reason code와 가능한 observed digest만 포함한다. marker는
`v1/controls/quarantine/<target-shard>/<target-event-id>/<marker-event-id>/`에 Task 2의
sealed instance protocol로 append하며 target memory ID, event ID·상대 path,
observed digest|null, reason, actor, `recorded_at`만 저장한다. marker ID는 canonical
marker Markdown bytes의 `qmv1-<sha256>`이다. 유효 marker는 해당 `memory_id`
전체를 영구 fail-closed한다. approved
ancestor와 이후 event도 검색·색인·resolution 입력에서 제외한다. v1에는
`unquarantine`과 `repair` action이 없다. 복구는 격리 DAG를 parent로 삼지 않는 새
memory ID capture만 허용한다.

`validateMemorySourceBindings()`와 민감정보 거부 규칙은 기존 계약을 유지한다.
Git 제외는 기억 append 성공 뒤 별도 best-effort 단계다. repo별
`.git/info/.game-design-memory-exclude.lock`를 `open('wx')`로 얻은 프로세스만
bounded read와 marker 검증 뒤 `info/exclude` 끝에 한 번 append하고 sync한다.
lock 충돌·stale lock·사용자 파일 변화·malformed marker는 warning이며 기억
event를 rollback하지 않는다.

- [ ] **Step 7: Task 2 검증을 실행한다**

Run:

```bash
node --test tests/unit/design-memory-record.test.mjs tests/unit/design-memory-store.test.mjs
node --check shared/scripts/validate-design-memory.mjs
node --check shared/scripts/lib/safe-memory-store.mjs
test ! -e shared/scripts/lib/memory-store-posix-helper.c
! rg 'MEMORY_PLATFORM_CAPABILITIES|createMemoryStorePlatformAdapter|writeMemoryFileAtomic|moveMemoryFileAtomic|memoryRecordRelativePath' shared tests
git diff --check
```

Expected: 모두 PASS하며 runtime compiler, helper, replace·move 공개 계약이 없다.

- [ ] **Step 8: Task 2를 커밋한다**

```bash
git add shared/memory/schema/memory-event.schema.json shared/memory/schema/memory-record.schema.json shared/memory/schema/memory-index.schema.json shared/memory/schema/memory-receipt.schema.json shared/memory/templates/memory-record.md shared/memory/templates/index.md shared/memory/templates/log.md shared/scripts/validate-design-memory.mjs shared/scripts/lib/safe-memory-store.mjs shared/scripts/lib/memory-store-posix-helper.c tests/unit/design-memory-record.test.mjs tests/unit/design-memory-store.test.mjs
git commit -m "feat: define append-only design memory events"
```

---

### Task 3: 결정적 접기(`fold`) 색인 세대와 승인 기억 검색

**Files:**
- Create: `shared/scripts/retrieve-design-memory.mjs`
- Create: `tests/unit/design-memory-retrieval.test.mjs`
- Modify: `shared/memory/schema/memory-index.schema.json`
- Modify: `shared/memory/schema/memory-receipt.schema.json`

**Interfaces:**
- Consumes: Task 1 `MemoryConfig`, Task 2 event/store/fold APIs
- Produces: `rebuildMemoryIndex({ workspaceRoot, config, now }) -> Promise<MemoryIndex>`
- Produces: `publishMemoryIndexGeneration({ store, indexBytes, sourceTreeSha256 }) -> Promise<{ status, generationPath, indexSha256 }>`
- Produces: `loadCurrentMemoryIndex({ store, fold }) -> Promise<{ index, bytes, sourceTreeSha256, indexSha256, warnings }>`
- Produces: `rankMemoryEntries(entries, requestContext) -> MemoryIndexEntry[]`
- Produces: `retrieveApprovedDesignMemory({ workspaceRoot, config, requestContext, now }) -> Promise<MemoryRetrievalResult>`
- Defines: `requestContext = { projectId, lane, artifactIds, artifactTypes, tags, disabledForRequest }`

- [ ] **Step 1: 검색 계약의 실패 테스트를 작성한다**

`tests/unit/design-memory-retrieval.test.mjs`의 정상 요청은 다음 형태를 사용한다.

```js
const requestContext = {
  projectId: "wind-island",
  lane: "studio",
  artifactIds: ["combat-loop-v3"],
  artifactTypes: ["character-skill-combat-monster"],
  tags: ["boss", "counterplay"],
  disabledForRequest: false,
};
```

다음 결과를 고정한다.

- 같은 raw event/control 입력 트리는 파일 생성 순서와 무관하게 같은
  `sourceTreeSha256`과 JSON bytes를 만든다.
- index entry는 `memoryId` 오름차순으로 저장된다.
- 검색 결과는 exact related ID, artifact type, tag, kind priority,
  `memoryId` 순으로 결정된다.
- `approved`, 범위 일치, lane 일치, 현재 출처만 적용한다.
- candidate·expired·stale·disputed·superseded와 해시가 바뀐 항목은 제외 이유만
  남긴다.
- 프로젝트 ID가 없거나 `disabledForRequest=true`이면 저장소 adapter 호출이
  0회이고 `status=disabled`다.
- 손상·누락·복수 JSON generation을 권위로 쓰지 않고 raw fold에서 재생성한다.
- index의 상태를 `approved`로 변조해도 head event와 fold 재검증에서 거부한다.
- branch, quarantine marker가 지정한 memory ID, orphan과 손상 event가 있는
  memory는 전체 제외한다. 격리 전 approved ancestor도 다시 사용하지 않는다.
- `complete:false` scan은 store 전체를 승인 검색에서 제외하고 generation을
  publish하지 않는다.
- 최대 항목 수 5와 전체 반환 본문 64 KiB를 넘지 않는다.

- [ ] **Step 2: 검색 테스트의 RED를 확인한다**

Run:

```bash
node --test tests/unit/design-memory-retrieval.test.mjs
```

Expected: 검색 모듈과 generation resolver가 없어 실패한다.

- [ ] **Step 3: 결정적 색인 생성을 구현한다**

`sourceTreeSha256`은 NFC/UTF-8 byte 순으로 정렬한 `(relativePath,
observedSha256, classification)` tuple의 canonical JSON hash다. corrupt entry도
입력 트리 정체성에 포함한다. 색인 형식은 다음으로 고정한다.

```js
{
  schemaVersion: 1,
  sourceTreeSha256: "a".repeat(64),
  entries: [{
    memoryId: "memory-studio-design-lesson-0f2a4c61d9ab34ef",
    headEventId: `mev1-${"b".repeat(64)}`,
    headEventPath: `v1/events/91/memory-studio-design-lesson-0f2a4c61d9ab34ef/mev1-${"b".repeat(64)}`,
    fileSha256: "b".repeat(64),
    kind: "design-lesson",
    lane: "studio",
    status: "approved",
    scope: "project",
    projectId: "wind-island",
    artifactTypes: ["character-skill-combat-monster"],
    relatedIds: ["boss-phase-2"],
    tags: ["boss", "counterplay"],
  }],
}
```

`rebuildMemoryIndex`는 언제나 raw events와 quarantine controls를 scan/fold한다.
scan이 `complete:false`면 index를 반환·publish하지 않고 안전한 warning 상태로
끝난다.
canonical index bytes와 `indexSha256`을 만든 뒤
`v1/derived/indexes/<source-tree-sha256>/<index-sha256>/<randomUUID>.json`에
create-once append한다. current pointer는 만들지 않는다. 같은 입력이면 wall
clock, 실행 시각과 UUID에 관계없이 반환 JSON bytes가 같다. `index.md`와 `log.md`
derived generation도 같은 결정성 규칙을 따른다.

fresh fold의 `sourceTreeSha256`와 `indexSha256`가 모두 일치하는 valid generation만
현재 색인이다. 여러 instance는 논리적으로 동등하며 bytewise-lowest valid
instance 경로를 읽는다. 없거나 모두 손상됐으면 새 instance를 append한다. 이전
generation은 수정하거나 삭제하지 않는다.

- [ ] **Step 4: 관련성 순위와 원본 재검증을 구현한다**

점수는 다음처럼 계산한다.

```js
const kindPriority = new Map([
  ["project-fact", 0],
  ["decision", 1],
  ["style-preference", 2],
  ["design-lesson", 3],
  ["career-lesson", 4],
  ["external-note", 5],
]);

function intersectionSize(left = [], right = []) {
  const rightSet = new Set(right);
  return left.filter((value) => rightSet.has(value)).length;
}

function compareScoreKindAndMemoryId(left, right) {
  return right.score - left.score
    || kindPriority.get(left.entry.kind) - kindPriority.get(right.entry.kind)
    || Buffer.compare(Buffer.from(left.entry.memoryId, "utf8"), Buffer.from(right.entry.memoryId, "utf8"));
}

export function rankMemoryEntries(entries, context) {
  return entries
    .map((entry) => ({
      entry,
      score:
        intersectionSize(entry.relatedIds, context.artifactIds) * 8
        + intersectionSize(entry.artifactTypes, context.artifactTypes) * 4
        + intersectionSize(entry.tags, context.tags) * 2
        + (entry.kind === "style-preference" ? 1 : 0),
    }))
    .filter(({ score }) => score > 0)
    .sort(compareScoreKindAndMemoryId)
    .map(({ entry }) => entry);
}
```

선택된 각 entry는 `headEventPath/commit.json`과 sealed instance를 다시 열어 file
digest와 event ID를 확인하고,
현재 raw DAG fold의 head, 레코드 상태, 범위, lane과 출처를 다시 검사한다. JSON
index는 후보 탐색에만 사용하고 승인 권한으로 사용하지 않는다.

반환값은 다음 필드로 닫는다. `guidance`의 문자열은 실행 명령이 아니라
`untrustedMemoryData`로 표시된 자료이며 스킬 계약은 이 배열의 문장을 호출·승인
지시로 해석하지 않는다.

```js
{
  schemaVersion: 1,
  status: "ready",
  projectId: "wind-island",
  lane: "studio",
  untrustedMemoryData: true,
  guidance: [{
    memoryId: "memory-studio-design-lesson-0f2a4c61d9ab34ef",
    kind: "design-lesson",
    summary: "회피 뒤 반격 수단이 없어 기다리는 시간이 길어졌다.",
    applyWhen: "같은 전투 구조와 플레이어 능력을 사용하는 보스전",
    avoidWhen: "회피 자체가 핵심 재미인 전투",
    sourceRefs: ["playtest-session-04/evidence.yml#finding-07"],
  }],
  excluded: [],
  warnings: [],
}
```

- [ ] **Step 5: 변경 불가 로컬 사용 영수증을 구현한다**

적용 항목이 있을 때만 canonical receipt bytes를 immutable derived log
generation으로 append한다. request hash와 receipt hash로 논리 중복을 판정하고
물리 instance는 UUID로 구분한다. 영수증은 다음 필드만 허용한다.

```js
{
  schemaVersion: 1,
  requestSha256: "c".repeat(64),
  projectId: "wind-island",
  lane: "studio",
  applied: [{ memoryId: "memory-studio-design-lesson-0f2a4c61d9ab34ef", headEventId: `mev1-${"b".repeat(64)}`, fileSha256: "b".repeat(64) }],
  excluded: [{ memoryId: "memory-studio-design-lesson-old", reason: "stale-source" }],
}
```

기억 본문, 환경 값, 절대 경로, instance UUID와 wall clock은 논리 영수증에 넣지
않는다. 기존 receipt나 log를 전체 교체하지 않는다.

- [ ] **Step 6: Task 3 검증을 실행한다**

Run:

```bash
node --test tests/unit/design-memory-retrieval.test.mjs tests/unit/design-memory-record.test.mjs tests/unit/design-memory-store.test.mjs
node --check shared/scripts/retrieve-design-memory.mjs
git diff --check
```

Expected: 모두 PASS한다.

- [ ] **Step 7: Task 3을 커밋한다**

```bash
git add shared/scripts/retrieve-design-memory.mjs shared/memory/schema/memory-index.schema.json shared/memory/schema/memory-receipt.schema.json tests/unit/design-memory-retrieval.test.mjs
git commit -m "feat: retrieve verified project design memories"
```

---

### Task 4: 교훈 후보 작성과 기억 상태 관리

**Files:**
- Create: `shared/scripts/capture-design-memory.mjs`
- Create: `shared/scripts/maintain-design-memory.mjs`
- Create: `tests/unit/design-memory-capture.test.mjs`
- Create: `tests/unit/design-memory-maintenance.test.mjs`
- Modify: `shared/memory/schema/memory-event.schema.json`
- Modify: `shared/memory/schema/memory-record.schema.json`

**Interfaces:**
- Consumes: Task 1 config, Task 2 append/validator/fold, Task 3 generation rebuild
- Produces: `captureDesignMemory({ workspaceRoot, config, projectId, lane, event, now, disabledForRequest }) -> Promise<CaptureResult>`
- Retains: `CaptureResult.status = created | present | conflict | skipped`
- Produces: `maintainDesignMemory({ workspaceRoot, config, action, memoryId, actor, reason, chosenParentEventId, now }) -> Promise<MaintenanceResult>`
- Defines: `event.type = explicit-preference | human-decision | playtest-finding | review-finding | lesson-revision`
- Defines: `action = list | lint | verify | approve | reject | retire | sweep | resolution | quarantine | rebuild | sync-git-exclusion`

- [ ] **Step 1: 후보 작성의 실패 테스트를 작성한다**

정상 사건 fixture를 다음으로 고정한다.

```js
const evidenceBytes = Buffer.from(
  "finding-07: 회피 뒤 반격 수단이 없어 기다리는 시간이 길어졌다.\n",
  "utf8",
);
await writeFile(
  path.join(workspaceRoot, "playtest-session-04/evidence.yml"),
  evidenceBytes,
);

const playtestEvent = {
  eventId: "playtest-session-04-finding-07",
  type: "playtest-finding",
  summary: "회피 뒤 반격 수단이 없어 기다리는 시간이 길어졌다.",
  applicability: "같은 전투 구조와 플레이어 능력을 사용하는 보스전",
  exclusions: "회피 자체가 핵심 재미이거나 반격 규칙이 정해지지 않은 전투",
  artifactTypes: ["character-skill-combat-monster"],
  relatedIds: ["boss-phase-2"],
  tags: ["boss", "counterplay"],
  sources: [{
    artifact_id: "playtest-session-04",
    locator: "evidence.yml#finding-07",
    sha256: createHash("sha256").update(evidenceBytes).digest("hex"),
  }],
  actor: "김기획자",
};
```

다음을 검증한다.

- playtest/review/decision 사건은 `candidate`다.
- explicit preference만 `approved`, `explicit-user-instruction`,
  `interactive-user`로 기록한다.
- 이벤트 ID와 프로젝트 ID로 만든 기억 ID는 재실행해도 같다.
- 같은 canonical event의 동일 content-addressed ID는 `present`이고, 같은 event
  경로의 다른 bytes와 같은 `(memory_id, operation_id)`의 다른 event는 conflict다.
- 맞춤법 수정, 일반 대화, 알 수 없는 사건 유형은 `skipped`이고 파일을 만들지
  않는다.
- 비활성화·요청 단위 제외·프로젝트 ID 없음은 저장소 호출 0회다.
- 민감정보, 누락 출처, 변조 출처는 event와 derived log를 만들지 않는다.

- [ ] **Step 2: 후보 작성 RED를 확인한다**

Run:

```bash
node --test tests/unit/design-memory-capture.test.mjs
```

Expected: capture 모듈이 없어 실패한다.

- [ ] **Step 3: 안정 memory ID와 capture event append를 구현한다**

기억 ID는 다음 규칙을 사용한다.

```js
export function memoryIdForEvent({ lane, kind, projectId, eventId }) {
  const digest = createHash("sha256")
    .update(`${projectId}\0${eventId}`, "utf8")
    .digest("hex")
    .slice(0, 16);
  return `memory-${lane}-${kind}-${digest}`;
}
```

capture의 `operation_id`는 upstream `eventId`다. `action: capture`를 포함한 event
envelope와 `event_sha256`이 없는 완전한 record snapshot을 canonical Markdown으로
만든 뒤 bytes SHA-256에서 event ID와 경로를
계산한다. `appendMemoryEvent`가 `created|present`를 반환하면 기억 저장은
성공이다. 같은 operation ID의 다른 event bytes는 자동 winner 없이 conflict다.

사용 기록은 Task 3의 immutable derived log generation으로 별도 append한다. log
실패는 이미 저장된 event를 rollback·rewrite하지 않고 warning으로 반환한다.
기존 event, log와 index를 replace하거나 이동하지 않는다.

- [ ] **Step 4: 상태 관리의 실패 테스트를 작성한다**

`tests/unit/design-memory-maintenance.test.mjs`는 다음을 검증한다.

- `approve`는 actor와 reason이 있는 verified 후보만 승인한다.
- candidate 직접 approve, AI actor의 approve와 빈 reason을 거부한다.
- `verify`는 모든 source binding을 다시 확인한 candidate만 verified로 바꾼다.
- 같은 parent에서 나온 승인·거부 transition은 둘 다 보존하고
  `concurrent-conflict`로 검색 제외한다.
- `resolution`은 human actor·reason, 작성 시 관찰한 head 집합과 선택한 head를
  요구한다. recorded parent만 소비하므로
  concurrent transition은 별도 head로 남는다. 같은 parent의 동시 resolution 두
  개도 두 head다. snapshot은 선택한 head와 같거나 그 head에서 허용된 전이 하나를
  적용한 값이어야 한다. 자동 병합하거나 mtime으로 고르지 않는다.
- `sweep`은 후보 30일 경과를 `expired`, 외부 정보 review date 경과를
  `stale`로 바꾸고 다른 기록은 수정하지 않는다.
- `retire`는 `superseded` 또는 `rejected`만 만들고 파일을 삭제하지 않는다.
- `quarantine`은 원본 bytes를 옮기거나 고치지 않고 content-addressed marker를
  sealed append해 해당 memory ID 전체를 영구 격리한다. 이전 approved ancestor와
  이후 event도 제외하며 v1에는 `unquarantine`·`repair`가 없다. 복구는 새 memory
  ID capture만 허용한다.
- `sync-git-exclusion`은 `local`에서 lock을 얻었을 때 exact marker를 끝에 한 번
  append한다. `tracked`, lock 충돌, stale lock과 사용자 파일 변화는 skip/warning이며
  기존 `info/exclude`를 rewrite하거나 marker를 자동 제거하지 않는다.
- `list`와 `lint`는 어떤 파일도 수정하지 않는다.
- `rebuild` 결과는 Task 3 색인과 byte 동일하다.
- `lint`는 수정 없이 중복 ID, orphan source, cycle과 stale source code를
  반환한다.

- [ ] **Step 5: 유지 관리 action을 구현한다**

CLI와 import 경로가 같은 함수를 사용한다. CLI는 stdin의 단일 JSON 객체만
받고 stdout에는 결과 JSON 한 개만 쓴다.

```js
export async function maintainDesignMemory({
  workspaceRoot,
  config,
  action,
  memoryId,
  actor,
  reason,
  chosenParentEventId,
  now,
} = {}) {
  if (action === "list") return listMemoryRecords({ workspaceRoot, config });
  if (action === "lint") return lintMemoryStore({ workspaceRoot, config, now });
  if (action === "rebuild") return rebuildMemoryIndex({ workspaceRoot, config, now });
  if (action === "sync-git-exclusion") return ensureMemoryGitExclusion({ workspaceRoot, gitMode: config.gitMode });
  if (action === "quarantine") return appendQuarantineMarkerForTarget({ workspaceRoot, config, memoryId, actor, reason, now });
  return appendMemoryTransition({ workspaceRoot, config, action, memoryId, actor, reason, chosenParentEventId, now });
}
```

오류 JSON은 code와 안전한 상대 ID만 포함하며 절대 경로·문서 본문·환경 값을
포함하지 않는다. approve·reject·retire·sweep·resolution은 기존 파일을 고치지
않고 transition 또는 resolution event를 append한다. `rebuild`는 raw fold에서
generation을 publish하며 current pointer를 만들지 않는다.

- [ ] **Step 6: Task 4 검증을 실행한다**

Run:

```bash
node --test tests/unit/design-memory-capture.test.mjs tests/unit/design-memory-maintenance.test.mjs tests/unit/design-memory-retrieval.test.mjs
node --check shared/scripts/capture-design-memory.mjs
node --check shared/scripts/maintain-design-memory.mjs
git diff --check
```

Expected: 모두 PASS한다.

- [ ] **Step 7: Task 4를 커밋한다**

```bash
git add shared/scripts/capture-design-memory.mjs shared/scripts/maintain-design-memory.mjs shared/memory/schema/memory-event.schema.json shared/memory/schema/memory-record.schema.json tests/unit/design-memory-capture.test.mjs tests/unit/design-memory-maintenance.test.mjs
git commit -m "feat: capture and review project design lessons"
```

---

### Task 5: 공통 기억 스킬 패키징과 제품 계약 등록

**Files:**
- Create: `shared/memory/skills/retrieve-approved-design-memory/SKILL.md`
- Create: `shared/memory/skills/capture-game-design-memory/SKILL.md`
- Create: `shared/memory/skills/maintain-game-design-memory/SKILL.md`
- Create: `shared/memory/references/memory-policy.md`
- Create: `shared/memory/references/memory-lifecycle.md`
- Modify: `tooling/lib/build-product.mjs`
- Modify: `tooling/lib/product-contract.mjs`
- Modify: `shared/contracts/product.schema.json`
- Modify: `shared/contracts/README.md`
- Modify: `products/game-design-studio/product.json`
- Modify: `products/game-design-career/product.json`
- Modify: `products/game-design-studio/plugin/references/routing.json`
- Modify: `products/game-design-career/plugin/references/routing.json`
- Modify: `tests/unit/build-product.test.mjs`
- Modify: `tests/contracts/shared-contract.test.mjs`

**Interfaces:**
- Consumes: Tasks 1–4 runtime and schemas
- Produces: shared module `memory`
- Produces: installed skills `retrieve-approved-design-memory`, `capture-game-design-memory`, `maintain-game-design-memory`
- Produces: routing `memoryWorkflow` with exact skill IDs and placement
- Changes installed inventory: product source skills 15 + shared skills 6 = 21 per product

- [ ] **Step 1: 패키징 계약의 실패 테스트를 작성한다**

두 temporary product build에서 다음 exact paths를 요구한다.

```js
const memorySkillIds = [
  "capture-game-design-memory",
  "maintain-game-design-memory",
  "retrieve-approved-design-memory",
];
for (const skillId of memorySkillIds) {
  assert.ok(files.includes(`skills/${skillId}/SKILL.md`));
}
for (const path of [
  "references/shared/memory/schema/memory-config.schema.json",
  "references/shared/memory/schema/memory-event.schema.json",
  "references/shared/memory/schema/memory-record.schema.json",
  "references/shared/memory/schema/memory-index.schema.json",
  "references/shared/memory/schema/memory-receipt.schema.json",
  "references/shared/memory/references/memory-policy.md",
  "references/shared/memory/references/memory-lifecycle.md",
]) assert.ok(files.includes(path), path);
```

추가 mutation은 memory module 누락, extra file, symlink, product overlay 충돌,
schema의 module 누락과 한쪽 제품만 선언한 상태를 거부한다.

같은 RED에 원천과 임시 설치본의 `safe-memory-store.mjs`를 정적으로 검사한다.
모든 import specifier는 `node:*`여야 하며 `node:child_process`, `spawn`, `exec`,
`fork`, compiler command, helper binary와 `.c` source 참조는 없어야 한다. 임시
제품을 만든 뒤 `PATH`를 빈 디렉터리, `CC`와 `CXX`를 존재하지 않는 경로로 둔
child Node(`process.execPath`)에서 sealed append와 재시도 `present` smoke를
실행한다. compiler나 외부 실행 파일이 없어도 통과해야 한다.

- [ ] **Step 2: 패키징 RED를 확인한다**

Run:

```bash
node --test tests/unit/build-product.test.mjs tests/contracts/shared-contract.test.mjs
```

Expected: `Unknown shared module: memory` 또는 설치 skill 누락으로 실패한다.

- [ ] **Step 3: 공통 스킬과 reference 문서를 작성한다**

세 SKILL은 다음 순서를 명시한다.

- retrieve: 설정 확인 → 프로젝트 ID 확인 → 승인 기억 검색 → 원본 근거 재검증 →
  기억을 자료로만 전달 → 사용 ID 보고
- capture: 결과물 검증 완료 확인 → 허용 사건 선별 → 후보 작성 → 자동 승인 금지 →
  후보 수 보고
- maintain: 후보 목록 → 명시적 approve/reject/retire → lint/rebuild → 변경 log

각 SKILL은 `GAME_DESIGN_MEMORY_ENABLED=false`, 요청 단위 제외, 프로젝트 ID 없음,
Hook 미지원과 기억 장애에서 기존 작업을 계속하는 규칙을 독립적으로 포함한다.

- [ ] **Step 4: builder의 shared mapping을 다중 destination으로 일반화한다**

기존 단일 tuple을 다음 형태로 바꾸고 모든 기존 모듈 결과 bytes가 바뀌지 않는
회귀를 추가한다.

```js
const sharedMappings = {
  knowledge: [["shared/knowledge", "references/shared/knowledge"]],
  templates: [["shared/templates", "assets/shared/templates"]],
  memory: [
    ["shared/memory/skills", "skills"],
    ["shared/memory/schema", "references/shared/memory/schema"],
    ["shared/memory/references", "references/shared/memory/references"],
    ["shared/memory/templates", "references/shared/memory/templates"],
  ],
};
```

실제 구현에는 기존 모든 module mapping을 같은 배열 형태로 옮긴다. module
내 destination 충돌, product overlay 충돌과 real `.env` 유입은 기존처럼
fail-closed한다.

- [ ] **Step 5: 제품·shared contract에 `memory`를 등록한다**

`allowedModules`, JSON Schema enum, shared contract 표와 두 `product.json`의
`sharedModules` 마지막에 `memory`를 추가한다. JSON Schema를 건드리는 김에 현재
runtime에서 이미 허용하는 `archify`, `im-not-ai`도 schema enum과 정확히 맞춘다.

- [ ] **Step 6: routing에 기억 스킬과 workflow를 등록한다**

두 routing JSON에 다음 구조를 추가한다.

```json
"memoryWorkflow": {
  "retrieveSkill": "retrieve-approved-design-memory",
  "captureSkill": "capture-game-design-memory",
  "maintenanceSkill": "maintain-game-design-memory",
  "retrievePlacement": "after-intake-before-specialist-routing",
  "capturePlacement": "after-completion-gates",
  "defaultScope": "project",
  "defaultMaxItems": 5,
  "requiresProjectId": true,
  "dedicatedAgent": false
}
```

세 스킬을 `skillIds`, `plannedPaths.skills`와 direct-use owner registry에 추가한다.
Studio owner는 retrieve/capture에 `lead-game-designer`, maintain에
`document-quality-editor`; Career owner는 retrieve에 `career-strategist`,
capture/maintain에 `evidence-auditor`를 사용한다. 이 owner는 검토 책임이며 상태
승인 권한을 자동으로 얻지 않는다.

- [ ] **Step 7: 임시 빌드의 설치 inventory를 21개로 고정한다**

Task 5의 temporary build 계약에서 제품 원천 스킬과 공통 스킬의 분해를 검사한다.
Committed `plugins/*`를 읽는 aggregate inventory assertion은 snapshot 재생성 직전
Task 8에서 갱신한다.

```js
assert.equal(sourceSkillIds.length, 15);
assert.deepEqual(sharedSkillIds, [
  "archify",
  "capture-game-design-memory",
  "humanize-korean",
  "maintain-game-design-memory",
  "retrieve-approved-design-memory",
  "svg-infographic",
]);
assert.equal(installedSkillIds.length, 21);
```

- [ ] **Step 8: Task 5 검증을 실행한다**

Run:

```bash
node --test tests/unit/build-product.test.mjs tests/contracts/shared-contract.test.mjs
node --check tooling/lib/build-product.mjs
git diff --check
```

Expected: temporary build와 source contract가 PASS한다. Snapshot 자체와 이를 읽는
aggregate package/isolation tests는 아직 실행하지 않는다. package exact path에
`memory-event.schema.json`이 포함되고, compiler 없는 sealed append smoke도 PASS한다.

- [ ] **Step 9: Task 5를 커밋한다**

```bash
git add shared/memory/skills shared/memory/references tooling/lib/build-product.mjs tooling/lib/product-contract.mjs shared/contracts/product.schema.json shared/contracts/README.md products/game-design-studio/product.json products/game-design-career/product.json products/game-design-studio/plugin/references/routing.json products/game-design-career/plugin/references/routing.json tests/unit/build-product.test.mjs tests/contracts/shared-contract.test.mjs
git commit -m "feat: package shared game design memory skills"
```

---

### Task 6: Studio·Career 오케스트레이터와 실제 작업 흐름 통합

**Files:**
- Modify: `products/game-design-studio/plugin/skills/orchestrate-game-design-project/SKILL.md`
- Modify: `products/game-design-studio/plugin/skills/orchestrate-game-design-project/references/intake.md`
- Modify: `products/game-design-studio/plugin/skills/orchestrate-game-design-project/references/workflow.md`
- Modify: `products/game-design-studio/plugin/skills/orchestrate-game-design-project/references/completion-gates.md`
- Modify: `products/game-design-career/plugin/skills/orchestrate-game-design-career/SKILL.md`
- Modify: `products/game-design-career/plugin/references/intake.md`
- Modify: `products/game-design-career/plugin/references/completion-gates.md`
- Modify: `tests/products/studio/orchestrator.test.mjs`
- Modify: `tests/products/career/orchestrator.test.mjs`
- Create: `tests/e2e/suite/design-memory.e2e.test.mjs`

**Interfaces:**
- Consumes: installed memory skills and routing `memoryWorkflow` from Task 5
- Produces: normalized intake fields `projectId`, `memoryDisabledForRequest`
- Produces: deterministic order `intake -> retrieve -> specialist workflow -> gates -> capture`
- Preserves: maximum three primary review roles and all existing artifact approval gates

- [ ] **Step 1: Studio·Career orchestration RED 계약을 작성한다**

두 product test에서 오케스트레이터 본문과 routing metadata가 다음 순서를 정확히
공유하는지 검사한다.

```js
assert.deepEqual(routing.memoryWorkflow, {
  retrieveSkill: "retrieve-approved-design-memory",
  captureSkill: "capture-game-design-memory",
  maintenanceSkill: "maintain-game-design-memory",
  retrievePlacement: "after-intake-before-specialist-routing",
  capturePlacement: "after-completion-gates",
  defaultScope: "project",
  defaultMaxItems: 5,
  requiresProjectId: true,
  dedicatedAgent: false,
});
```

문서 mutation으로 retrieve를 specialist 뒤로 이동, capture를 gate 앞으로 이동,
후보 자동 승인, 기억 전용 agent 추가, 기억 장애 시 artifact 중단, Career 기억을
Studio 원칙으로 사용하는 문장을 각각 거부한다.

- [ ] **Step 2: orchestration RED를 확인한다**

Run:

```bash
node --test tests/products/studio/orchestrator.test.mjs tests/products/career/orchestrator.test.mjs
```

Expected: 현재 오케스트레이터에 memory 단계가 없어 실패한다.

- [ ] **Step 3: intake와 오케스트레이터 순서를 구현한다**

intake에 다음 두 필드를 추가한다.

```json
{
  "projectId": "existing-artifact-or-explicit-user-id",
  "memoryDisabledForRequest": false
}
```

프로젝트 ID가 없으면 memory만 `skipped-project-id-missing`으로 건너뛰며 질문이
현재 기획 route를 바꾸지 않는 한 작업을 막지 않는다. “이번 작업에서는 이전
기억을 사용하지 마”와 같은 명시적 요청은 `memoryDisabledForRequest=true`로
정규화하며 해당 실행의 검색과 후보 작성을 모두 건너뛴다.

오케스트레이터 본문에는 다음 고정 순서를 넣는다.

1. intake와 설정 확인
2. 승인 기억 검색
3. specialist route와 기존 quality/image/reviewer workflow
4. completion gates
5. 허용 사건이 있을 때만 후보 작성
6. 적용·후보·제외 건수가 있을 때만 한 줄 요약

- [ ] **Step 4: 기억이 결과물의 독립 근거를 침해하지 않는 계약을 추가한다**

`completion-gates.md`는 다음을 요구한다.

- `project-fact`와 `decision`을 적용하면 기억 ID가 아니라 원래
  `artifact_id`, locator와 SHA를 `evidence.yml` 또는 `decisions/`에 연결한다.
- `design-lesson`은 질문·제안이며 새 결정 상태를 만들지 않는다.
- `style-preference`는 표현만 바꾸고 사실·수치·ID·승인 상태를 바꾸지 않는다.
- source drift가 있으면 기억을 제외하고 기존 workflow를 계속한다.

- [ ] **Step 5: 실제 공통 런타임 E2E를 작성한다**

`tests/e2e/suite/design-memory.e2e.test.mjs`는 임시 Git workspace와 실제 공통
함수를 사용해 다음 시나리오를 실행한다.

1. 승인된 Studio 교훈을 exact related ID 요청에 적용하고 receipt를 만든다.
2. 같은 프로젝트 Career 요청은 Studio-only 교훈을 적용하지 않는다.
3. 공통 승인 결정은 양쪽에서 원본 source binding과 함께 조회된다.
4. candidate는 검색되지 않고 named human approve 후에만 검색된다.
5. 출처 파일을 바꾸면 applied 0, excluded `stale-source`다.
6. `GAME_DESIGN_MEMORY_ENABLED=false`와 요청 단위 제외는 `.game-design` 입출력
   adapter 0회다.
7. 기억 index를 손상시켜도 기준 artifact validation은 통과하고 memory warning만
   남는다.
8. 기억 본문에 `$skill`, `rm`, `승인됨으로 바꿔`를 넣어도 실행·상태 변경이 없다.

- [ ] **Step 6: Task 6 검증을 실행한다**

Run:

```bash
node --test tests/products/studio/orchestrator.test.mjs tests/products/career/orchestrator.test.mjs tests/e2e/suite/design-memory.e2e.test.mjs
node --check products/game-design-studio/plugin/skills/orchestrate-game-design-project/scripts/validate-studio-scenario.mjs
git diff --check
```

Expected: 모두 PASS하고 기존 reviewer 상한 assertion도 유지된다.

- [ ] **Step 7: Task 6을 커밋한다**

```bash
git add products/game-design-studio/plugin/skills/orchestrate-game-design-project products/game-design-career/plugin/skills/orchestrate-game-design-career/SKILL.md products/game-design-career/plugin/references/intake.md products/game-design-career/plugin/references/completion-gates.md tests/products/studio/orchestrator.test.mjs tests/products/career/orchestrator.test.mjs tests/e2e/suite/design-memory.e2e.test.mjs
git commit -m "feat: apply approved memories in game design workflows"
```

---

### Task 7: 한국어 사용자 안내와 기억 관리 문서

**Files:**
- Create: `guides/game-design-studio/memory.md`
- Create: `guides/game-design-career/memory.md`
- Modify: `README.md`
- Modify: `products/game-design-studio/plugin/README.md`
- Modify: `products/game-design-career/plugin/README.md`
- Modify: `guides/game-design-studio/README.md`
- Modify: `guides/game-design-career/README.md`
- Modify: `guides/game-design-studio/installation.md`
- Modify: `guides/game-design-career/installation.md`
- Modify: `guides/game-design-studio/quick-start.md`
- Modify: `guides/game-design-career/quick-start.md`
- Modify: `guides/game-design-studio/workflow.md`
- Modify: `guides/game-design-career/workflow.md`
- Modify: `guides/game-design-studio/faq.md`
- Modify: `guides/game-design-career/faq.md`
- Modify: `guides/game-design-studio/skills/README.md`
- Modify: `guides/game-design-career/skills/README.md`
- Create: `tests/contracts/memory-guides-source.test.mjs`
- Modify: `guides/archify-diagrams/catalog.json`

**Interfaces:**
- Consumes: Task 5 installed inventory 21 and Task 6 user behavior
- Produces: 한국어 우선 기억 설명, 설정 예시, 직접 관리 명령과 문제 해결 경로
- Preserves: 기존 README H2 순서, TOC, 18개 대표 사례 카드와 Archify selected 4개

- [ ] **Step 1: 문서 계약의 실패 테스트를 작성한다**

새 `memory-guides-source.test.mjs`에서 루트와 제품 원천 가이드에 다음
문구·링크·수량을 source-bound로 요구한다. 이 테스트는 committed `plugins/*`를
읽지 않는다.

- `장기 기억` 또는 `프로젝트 기억` 설명
- 기본값 `project`, 로컬 전용, 자동 커밋·원격 전송 없음
- `GAME_DESIGN_MEMORY_ENABLED=false`와 요청 단위 제외 예시
- 후보, 승인, 만료, 출처 변경과 충돌의 한글 설명
- 기억 없이 기존 기능이 그대로 동작한다는 경계
- Studio·Career `memory.md` 링크
- 제품별 `제품 스킬 15개 + 공통 스킬 6개 = 설치 스킬 21개`
- 제품별 top-level `scripts/*.mjs`는 기존 16개와 새 기억 스크립트 5개를 합친
  21개이며 `scripts/lib/*.mjs`는 별도 내부 도구로 설명한다.

Mutation은 `false`인데도 후보 작성, 후보 자동 승인, global 기본값, Git 자동
커밋, 기억 장애 시 기획 중단, 영문 상태명만 나열한 문서를 거부한다.

- [ ] **Step 2: 문서 계약 RED를 확인한다**

Run:

```bash
node --test tests/contracts/memory-guides-source.test.mjs
```

Expected: memory 안내와 21-skill inventory가 없어 실패한다.

- [ ] **Step 3: 루트와 제품 README를 보강한다**

루트 README에는 기존 소개와 구조를 중복하지 않는 `프로젝트 기억` 하위 절을
추가한다. 다음 짧은 예시를 포함한다.

```text
@Game Design Studio 지난 플레이테스트 결과와 승인된 프로젝트 교훈을 참고해서
보스전 기획을 다듬어줘.

이번 작업에서는 이전 기억을 사용하지 마.
기억 후보를 보여줘.
이 교훈은 앞으로 이 프로젝트에 적용해.
```

기억은 그냥 AI에게 반복 질문하는 것과 달리 출처·상태·범위·사람 승인을
확인하지만, 재미나 성공을 보장하지 않는다는 한계를 같은 절에서 밝힌다.

- [ ] **Step 4: 제품별 `memory.md`와 기존 가이드를 작성한다**

각 `memory.md`는 다음 순서다.

1. 어떤 기록을 기억하는가
2. 기억하지 않는 내용
3. 기본 작업 흐름
4. 후보 확인·승인·거부·폐기 예시
5. `.env` 설정과 완전 비활성화
6. 로컬 Git 제외와 프로젝트 이동
7. 손상·충돌·출처 변경 복구
8. Studio 또는 Career 전용 경계

내부 ID는 한글 설명 뒤 코드로만 표시하고 `Artifact`, `memory candidate`,
`stale`, `scope`를 한국어 설명 없이 단독 사용하지 않는다.

- [ ] **Step 5: 가이드 inventory와 링크 수를 production에서 파생한다**

원천 가이드의 21개 ID는 routing과 shared memory skill tree에서 계산한다.
Committed snapshot과 전체 가이드 링크 그래프를 읽는 aggregate 테스트 갱신은
Task 8에서 수행한다. 18개 대표 사례 카드 수는 기억 스킬 추가와 무관하므로
그대로 유지한다.

- [ ] **Step 6: 한국어 문장과 Archify catalog 정합성을 검증한다**

새 문서의 한국어 의미를 먼저 쓰고 과도한 이모지·구분선·한 문장씩 끊는 개행을
피한다. `humanize-korean` quick rules의 기계적 병렬, 번역투, 근거 없는 과장을
수동·계약 검사로 확인한다. README와 가이드 bytes가 바뀌면 Archify catalog의
해당 source digest만 현재 bytes로 갱신하고 selected spec·HTML·receipt는 source
section 의미가 바뀌지 않은 경우 손대지 않는다.

- [ ] **Step 7: Task 7 검증을 실행한다**

Run:

```bash
node --test tests/contracts/memory-guides-source.test.mjs
npm run validate:archify-catalog
cmp .env.example shared/image-assets/.env.example
git diff --check
```

Expected: 모두 PASS한다.

- [ ] **Step 8: Task 7을 커밋한다**

```bash
git add README.md products/game-design-studio/plugin/README.md products/game-design-career/plugin/README.md guides/game-design-studio guides/game-design-career tests/contracts/memory-guides-source.test.mjs guides/archify-diagrams/catalog.json
git commit -m "docs: explain local project design memory"
```

---

### Task 8: 설치·업데이트·제거와 전체 회귀 검증

**Files:**
- Create: `tests/e2e/suite/memory-install-lifecycle.e2e.test.mjs`
- Create: `guides/reviews/2026-08-12-memory-wiki-ultraqa-report.md`
- Modify: `tests/e2e/suite/dirty-worktree-preservation.e2e.test.mjs`
- Modify: `tests/contracts/package-contents.test.mjs`
- Modify: `tests/contracts/root-readme-user-guides.test.mjs`
- Modify: `tests/contracts/user-guides-studio.test.mjs`
- Modify: `tests/contracts/user-guides-career.test.mjs`
- Modify: `tests/unit/user-guides.test.mjs`
- Modify: `tests/unit/validate-packages.test.mjs`
- Modify: `tests/isolation/plugin-smoke.test.mjs`
- Regenerate: `plugins/game-design-studio/**`
- Regenerate: `plugins/game-design-career/**`

**Interfaces:**
- Consumes: Tasks 1–7 complete source tree
- Produces: generated snapshots with 21 installed skills and exact memory runtime
- Produces: install/update/remove preservation evidence and final QA report

- [ ] **Step 1: 설치 생명주기 RED E2E를 작성한다**

`memory-install-lifecycle.e2e.test.mjs`는 실제 `buildProduct()` 결과를 임시
Codex plugin home에 설치하는 격리 fixture를 사용한다.

```js
const memorySentinel = Buffer.from("local-memory-must-survive\n", "utf8");
const memorySentinelPath = path.join(
  workspace,
  `.game-design/memory/v1/events/aa/memory-sentinel/mev1-${"a".repeat(64)}.md`,
);
await mkdir(path.dirname(memorySentinelPath), { recursive: true });
await writeFile(memorySentinelPath, memorySentinel);

await installBuiltPlugin({ product: "game-design-studio", codexHome });
await replaceBuiltPlugin({ product: "game-design-studio", codexHome });
await removeInstalledPlugin({ product: "game-design-studio", codexHome });

assert.deepEqual(
  await readFile(memorySentinelPath),
  memorySentinel,
);
```

`installBuiltPlugin`, `replaceBuiltPlugin`, `removeInstalledPlugin`은 이 테스트 파일
안의 helper다. 첫 두 helper는 `buildProduct()`의 임시 결과만 plugin home의 정확한
제품 디렉터리에 복사·교체하고, 마지막 helper는 그 설치 디렉터리만 제거한다.
세 helper는 workspace 경로를 인자로 받지 않는다.

Studio와 Career 각각 다음을 검증한다.

- 설치 전 workspace memory를 읽거나 변경하지 않는다.
- 설치본에 세 기억 스킬, schema, reference와 runtime script가 존재한다.
- 업데이트는 installed plugin만 교체하고 memory bytes·mode·mtime을 보존한다.
- 제거는 installed plugin만 삭제하고 memory와 `.git/info/exclude`를 보존한다.
- 실제 `.env`, memory event·control·derived generation은 plugin package에 포함되지 않는다.
- 네트워크 호출 수는 0이다.
- committed `plugins/game-design-studio/skills/`와
  `plugins/game-design-career/skills/`에도 공통 기억 스킬 세 개가 존재한다.

같은 RED 단계에서 aggregate package·guide·isolation 테스트의 설치 수량을 다음
근거로 갱신한다.

```js
assert.equal(productSourceSkillIds.length, 15);
assert.equal(sharedInstalledSkillIds.length, 6);
assert.equal(installedSkillIds.length, 21);
assert.equal(topLevelInstalledScriptIds.length, 21);
```

전체 guide link 수는 새 `memory.md` 두 파일을 포함한 실제 그래프에서 다시
계산하고, 누락·중복 memory link mutation을 추가한다.

- [ ] **Step 2: 설치 생명주기 RED를 확인한다**

Run:

```bash
node --test tests/e2e/suite/memory-install-lifecycle.e2e.test.mjs
```

Expected: 아직 generated snapshot에 memory package가 없어 실패한다.

- [ ] **Step 3: 표준 snapshot을 한 번 재생성한다**

먼저 작업 트리에서 사용자 소유 변경을 기록하고 `plugins/*` 외의 변경이 안정된
상태인지 확인한다. 그 뒤 표준 명령만 사용한다.

```bash
git status --porcelain=v1
npm run build
npm run build -- --check
```

Expected: Career와 Studio snapshot이 새 source와 exact 일치하고 각 제품에 설치
스킬 21개가 있다.

- [ ] **Step 4: dirty-worktree 보존 회귀를 확대한다**

기존 dirty fixture에 추적되지 않은 `.game-design/memory/v1/events/` 이벤트와 수정
중인 `.git/info/exclude` bytes를 추가한다. build, memory retrieval,
capture 실패와 install lifecycle 전후에 정확한 bytes가 유지되는지 검사한다.

- [ ] **Step 5: 전체 정적·동적 검증을 실행한다**

먼저 집중 테스트를 실행한다.

```bash
node --test \
  tests/unit/workspace-env.test.mjs \
  tests/unit/design-memory-config.test.mjs \
  tests/unit/design-memory-record.test.mjs \
  tests/unit/design-memory-store.test.mjs \
  tests/unit/design-memory-retrieval.test.mjs \
  tests/unit/design-memory-capture.test.mjs \
  tests/unit/design-memory-maintenance.test.mjs \
  tests/e2e/suite/design-memory.e2e.test.mjs \
  tests/e2e/suite/memory-install-lifecycle.e2e.test.mjs \
  tests/e2e/suite/dirty-worktree-preservation.e2e.test.mjs
```

그 다음 repository gate를 실행한다.

```bash
npm run test:unit
npm run test:contracts
npm run test:products
npm run test:formats
npm run validate:guides
npm run validate:archify-catalog
npm run check:curated-archify
npm run check:guide-diagrams
npm run check:prompt-guides
npm run check:im-not-ai
npm run check:diagram-skills
npm run build -- --check
git diff --check
```

Expected: 모든 명령이 exit 0이다. 실제 OpenAI 이미지 호출과 외부 네트워크는
발생하지 않는다.

- [ ] **Step 6: 실패 주입과 결과 품질을 UltraQA 보고서에 기록한다**

보고서에는 다음 시나리오별 명령, 기대 신호, 실제 결과와 cleanup을 기록한다.

- MEM-OFF: 환경·요청 단위 완전 비활성화
- MEM-SCOPE: project/workspace/global 명시 범위와 자동 승격 금지
- MEM-STATE: candidate/approved/expired/stale/disputed/superseded transition fold
- MEM-SOURCE: missing, digest drift, symlink, path escape
- MEM-INJECT: 기억 본문의 명령·승인 변경·민감정보
- MEM-LANE: Studio/Career/common 경계
- MEM-APPEND: 동일 이벤트의 created/present 멱등성과 다른 bytes conflict
- MEM-SEAL-RECOVERY: instance·claim·commit failpoint 뒤 unsealed partial 무시와 재시도 회복
- MEM-BRANCH: 동시 approve/reject, transition+resolution, resolution+resolution head
- MEM-CORRUPT: 손상 event 원본 보존, sealed marker와 memory ID 전체 영구 fail-closed
- MEM-SCAN-LIMIT: 10,001번째 entry와 한도 뒤 invalidating transition에서 store fail-closed
- MEM-INDEX-GEN: missing·corrupt·concurrent generation의 raw fold 재생성
- MEM-GIT-ISOLATION: lock·stale lock·사용자 변경 warning과 event 성공 분리
- MEM-NODE-ONLY: 빈 compiler PATH에서 append smoke와 helper·외부 실행 정적 부재
- MEM-FAILOPEN: append·generation·marker 실패 뒤 artifact와 기존 event 보존
- MEM-INSTALL: install/update/remove 뒤 local memory byte 보존
- MEM-DIRTY: tracked·untracked 사용자 변경 보존
- MEM-THREAT-BOUNDARY: pre-existing swap은 차단하고 악의적 same-user
  between-syscall directory swap은 skipped non-goal로 기록

보고서는 실행하지 않은 live API 검사와 non-goal 공격을 PASS로 표시하지 않는다.

- [ ] **Step 7: 생성 snapshot과 최종 검증 증거를 커밋한다**

```bash
git add plugins/game-design-studio plugins/game-design-career tests/e2e/suite/memory-install-lifecycle.e2e.test.mjs tests/e2e/suite/dirty-worktree-preservation.e2e.test.mjs tests/contracts/package-contents.test.mjs tests/contracts/root-readme-user-guides.test.mjs tests/contracts/user-guides-studio.test.mjs tests/contracts/user-guides-career.test.mjs tests/unit/user-guides.test.mjs tests/unit/validate-packages.test.mjs tests/isolation/plugin-smoke.test.mjs guides/reviews/2026-08-12-memory-wiki-ultraqa-report.md
git commit -m "test: verify local design memory lifecycle"
```

- [ ] **Step 8: 커밋 후 clean-state 검증을 반복한다**

```bash
npm run build -- --check
node --test tests/e2e/suite/design-memory.e2e.test.mjs tests/e2e/suite/memory-install-lifecycle.e2e.test.mjs
git show --check --stat HEAD
git status --short --branch
```

Expected: build check와 두 E2E가 PASS한다. `git status`에는 구현 전부터 있던 사용자
소유 파일 외에 계획 작업의 미커밋 변경이 없다.

---

## Final Review Checklist

- [ ] 설계 문서의 프로젝트별 기본값, 로컬 보관, 승인 기반 적용이 Task 1–8에 모두 연결된다.
- [ ] 기억 비활성화는 설정 로더, 세 작업 함수, 두 오케스트레이터, 문서와 E2E에서 각각 검증된다.
- [ ] append-only Markdown event/control과 derived generation의 권한 차이가 구현과 적대적 mutation에 고정된다.
- [ ] Studio·Career·common lane 경계와 원래 artifact evidence 결속이 동적 테스트에 포함된다.
- [ ] 후보 30일, external review date, 충돌, 대체와 명시적 사용자 선호 상태 전이가 모두 닫혀 있다.
- [ ] 프로젝트 ID가 없을 때 기억만 건너뛰고 기존 작업을 계속한다.
- [ ] Hook, SQLite, 임베딩, 자동 커밋과 원격 동기화가 구현 범위에 들어오지 않았다.
- [ ] 설치·업데이트·제거, dirty worktree, symlink, pre-existing path swap, secret와 prompt injection이 검증된다.
- [ ] 악의적 same-user between-syscall directory swap은 non-goal이며 테스트가 보장을 과장하지 않는다.
- [ ] 변경된 모든 사용자 문서는 한국어 의미를 먼저 쓰고 내부 ID를 보조 표기로 사용한다.
- [ ] generated snapshot은 마지막 작업에서만 표준 빌드로 재생성된다.
