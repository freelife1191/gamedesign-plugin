# Local Game Design Memory Authority Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 손상되거나 격리된 기억이 과거 승인 상태를 되살리거나 새 전이의 권한을 얻지 못하도록 append-only 기억 저장소의 판정 경계를 닫는다.

**Architecture:** sealed claim과 instance를 읽은 뒤 물리 경로·문서 정체성·marker target을 한 번에 결속하는 scanner를 사용한다. 항목 하나라도 손상되면 해당 scan 전체를 닫고 어떤 기억도 권한 입력으로 반환하지 않는다. append는 완전한 scan과 fold만 사용하며, Git 제외 보정은 기억 권한과 분리된 best-effort 단계로 유지한다.

**Tech Stack:** Node.js 18 이상, ESM, `node:test`, Node 표준 라이브러리, JSON Schema Draft 2020-12

## Global Constraints

- 외부 런타임, 네이티브 helper와 새 npm dependency를 추가하지 않는다.
- 기억은 기본 `project` 범위의 로컬 파일이며 `MEMORY_ENABLED=false`로 완전히 끌 수 있다.
- source event와 quarantine marker를 수정·이동·삭제하는 production API를 만들지 않는다.
- 승인 기억만 검색에 쓰며 quarantine, conflict와 incomplete scan은 fail-closed한다.
- 오류, 진단과 receipt에 비밀값, raw 문서와 절대 경로를 넣지 않는다.
- 호출 전에 존재하는 root·ancestor·final symlink는 거부한다.
- 같은 OS 계정의 악의적 between-syscall path swap은 명시적 non-goal 한 건으로만 남긴다.
- 구현과 문서는 자연스러운 한국어를 사용하되 API 이름, 오류 코드와 schema key는 바꾸지 않는다.

---

## File Structure

- Modify: `shared/scripts/validate-design-memory.mjs` — event·marker의 canonical string tree와 schema/runtime 의미 검증
- Modify: `shared/memory/schema/memory-event.schema.json` — runtime과 같은 event-type 조건 고정
- Modify: `shared/scripts/lib/safe-memory-store.mjs` — sealed content-first scan, append authority, path/Git identity
- Modify: `tests/unit/design-memory-record.test.mjs` — canonical object와 schema/runtime parity
- Modify: `tests/unit/design-memory-store.test.mjs` — scanner, quarantine, append, path와 Git 적대 회귀
- Create: `tests/fixtures/design-memory/child-append.mjs` — 다중 프로세스 append 실행 fixture
- Modify: `.superpowers/sdd/2026-08-12-local-game-design-memory-wiki/task-2-append-only-report.md` — 실제 증거와 superseded 기록
- Modify: `.superpowers/sdd/2026-08-12-local-game-design-memory-wiki/progress.md` — 원 계획의 unblock 근거

---

### Task 1: Canonical event와 marker 입력 경계

**Files:**
- Modify: `shared/scripts/validate-design-memory.mjs`
- Modify: `shared/memory/schema/memory-event.schema.json`
- Modify: `tests/unit/design-memory-record.test.mjs`

**Interfaces:**
- Retains: `canonicalMemoryEventDocument(event, sections) -> string`
- Retains: `parseMemoryEventDocument(source, options) -> { event, record, sections }`
- Retains: `canonicalQuarantineMarkerDocument(marker) -> string`
- Retains: `parseQuarantineMarkerDocument(source, options) -> marker`
- Produces internally: `validateCanonicalStringTree(value) -> { ok, path? }`

- [ ] **Step 1: NUL·NFD와 schema/runtime 불일치 RED를 작성한다**

다음 production mutation을 잡는 실행형 assertion을 추가한다.

```js
for (const mutation of [
  { actor: "author\0hidden" },
  { reason: "e\u0301vidence" },
  { record: { ...record, approval_basis: "review\0hidden" } },
]) {
  assert.throws(
    () => canonicalMemoryEventDocument(capture(mutation), sections),
    (error) => error.code === "memory.noncanonical" && !String(error).includes("hidden"),
  );
}

for (const mutation of [
  { reason_code: "memory.bad\0hidden" },
  { actor: "audite\u0301r" },
]) {
  assert.throws(
    () => canonicalQuarantineMarkerDocument({ ...marker, ...mutation }),
    (error) => error.code === "memory.noncanonical",
  );
}
```

같은 capture, transition과 resolution fixture를 runtime validator와 저장소의 기존 JSON
Schema validator에 넣고 결과가 모두 같아야 한다. capture의 `mop1-*`, transition의
chosen parent와 resolution의 parent 1개를 각각 거부한다.

- [ ] **Step 2: RED를 확인한다**

Run:

```bash
node --test tests/unit/design-memory-record.test.mjs
```

Expected: 기존 production이 event actor/reason과 marker reason code의 논리 NUL 또는
NFD를 허용해 새 assertion이 실패한다.

- [ ] **Step 3: canonical string tree를 한곳에서 검증한다**

`validateCanonicalStringTree()`는 object key와 모든 중첩 string value를 재귀로
검사한다. 문자열은 NFC와 같고 NUL이 없어야 한다. 위반 시 입력값을 오류에 넣지 않고
`memory.noncanonical`을 반환한다. `validateMemoryRecord`, `validateMemoryEvent`,
`canonicalMemoryEventDocument`와 `canonicalQuarantineMarkerDocument`가 이 함수를
공유한다. 본문 section은 기존 LF·trailing whitespace 정규화를 유지하되 NUL을
거부한다.

JSON Schema fixture는 실제 schema validator를 사용해 runtime과 같은 정상·실패
결과를 내도록 `memory-event.schema.json` 조건을 보정한다.

- [ ] **Step 4: GREEN과 mutation을 확인한다**

Run:

```bash
node --test tests/unit/design-memory-record.test.mjs
node --check shared/scripts/validate-design-memory.mjs
```

Expected: 모든 테스트가 통과하며 canonical guard를 제거하면 NUL·NFD 테스트가
실패한다.

- [ ] **Step 5: 커밋한다**

```bash
git add shared/scripts/validate-design-memory.mjs shared/memory/schema/memory-event.schema.json tests/unit/design-memory-record.test.mjs
git commit -m "fix: close memory canonical input boundaries"
```

---

### Task 2: Sealed 내용 우선 scanner

**Files:**
- Modify: `shared/scripts/lib/safe-memory-store.mjs`
- Modify: `tests/unit/design-memory-store.test.mjs`

**Interfaces:**
- Retains: `scanMemoryEvents({ store, maxEventBytes, maxEvents }) -> MemoryEventScan`
- Produces internally: `readSealedCommit(store, baseRelativePath, kind) -> { claim, bytes, parsed }`
- `MemoryEventScan.complete === false` with empty `events` and `quarantines` for any malformed event or marker

- [ ] **Step 1: moved event와 forged marker RED를 작성한다**

`approved → disputed`를 정상 append한 뒤 disputed event directory를
`events/zz/INVALID-MEMORY/<event-id>`로 옮긴다. 기대값은 다음 literal이다.

```js
assert.equal(scan.complete, false);
assert.deepEqual(scan.events, []);
assert.deepEqual(scan.quarantines, []);
assert.equal(fold.memories.has(memoryId), false);
assert.equal(scan.diagnostics.some((item) => item.code === "memory.path_binding"), true);
```

테스트 전용 helper로 canonical marker bytes와 정확한 claim/instance/commit hard link를
직접 만든다. marker의 `target_relative_path`만 다른 memory 경로로 바꾼 fixture는
`scan.quarantines`에 들어가면 안 되며 scan 전체가 `complete:false`여야 한다. target
event가 없거나 sealed bytes를 파싱할 수 없는 경우도 `complete:false`와
`memory.unbound_seal|memory.quarantine_binding`이어야 한다.

- [ ] **Step 2: RED를 확인한다**

Run:

```bash
node --test --test-name-pattern="moved|marker binding|unbound" tests/unit/design-memory-store.test.mjs
```

Expected: moved disputed event 뒤 기존 구현이 `approved`를 반환하고 forged marker를
받아들여 실패한다.

- [ ] **Step 3: scan을 두 단계로 바꾼다**

`readCommitted()`를 expected path ID에 의존하지 않는 `readSealedCommit()`으로
나눈다. claim의 ID로 instance를 검증하고 canonical 문서를 파싱한 다음, 논리
정체성에서 계산한 경로와 실제 경로를 비교한다.

events를 먼저 확정해 `eventId -> { memoryId, relativePath, bytes }` lookup을 만든다.
markers는 그 lookup과 다음 세 값을 정확히 비교한다.

```js
marker.target_relative_path === memoryEventRelativePath({
  memoryId: marker.memory_id,
  eventId: marker.target_event_id,
});
target.eventId === marker.target_event_id;
target.memoryId === marker.memory_id;
marker.observed_sha256 === null || marker.observed_sha256 === sha256(target.bytes);
```

경로·seal·문서·target 결속 중 하나라도 실패하면 `state.complete = false`로 바꾸고
events와 quarantines를 빈 배열로 반환한다. 부분적으로 읽힌 정상 event도 권한
입력으로 넘기지 않는다.

- [ ] **Step 4: GREEN과 전체 store 회귀를 확인한다**

Run:

```bash
node --test tests/unit/design-memory-store.test.mjs
node --check shared/scripts/lib/safe-memory-store.mjs
```

Expected: moved path, marker binding, canonical corruption과 기존 idempotence·fold·scan
테스트가 모두 통과한다.

- [ ] **Step 5: 커밋한다**

```bash
git add shared/scripts/lib/safe-memory-store.mjs tests/unit/design-memory-store.test.mjs
git commit -m "fix: bind sealed memory content before paths"
```

---

### Task 3: Append 권한을 scan/fold와 통합

**Files:**
- Modify: `shared/scripts/lib/safe-memory-store.mjs`
- Modify: `tests/unit/design-memory-store.test.mjs`

**Interfaces:**
- Produces internally: `authorizeMemoryAppend({ scan, parsed }) -> { prior, heads }`
- `appendMemoryEvent()` rejects `memory.scan_incomplete`, `memory.quarantined`, `memory.capture_exists`, `memory.transition_heads`, `memory.resolution_heads`

- [ ] **Step 1: 격리·incomplete scan·stale parent RED를 작성한다**

두 transition head를 만든 뒤 capture event에 quarantine marker를 추가한다. 같은 두
head의 resolution append는 다음을 만족해야 한다.

```js
await assert.rejects(
  () => appendMemoryEvent({ store, eventDocument: resolutionDocument }),
  (error) => error.code === "memory.quarantined",
);
```

canonical path의 commit을 손상시킨 뒤 transition은 `memory.scan_incomplete`여야
한다. 기존 memory ID의 두 번째 capture는
`memory.capture_exists`, 현재 head가 아닌 ancestor를 parent로 쓰는 transition은
`memory.transition_heads`여야 한다.

- [ ] **Step 2: RED를 확인한다**

Run:

```bash
node --test --test-name-pattern="quarantined append|incomplete scan append|capture exists|transition heads" tests/unit/design-memory-store.test.mjs
```

Expected: 기존 append가 quarantine을 무시하거나 stale parent를 저장해 실패한다.

- [ ] **Step 3: 공통 권한 판정을 구현한다**

`authorizeMemoryAppend()`는 incomplete scan을 먼저 거부한다. parsed memory ID가
quarantine 집합에 있으면 event type과 관계없이 거부한다. capture는 해당
memory event가 없을 때만 허용한다. transition parent는 관찰한 현재 head 하나여야
한다. resolution parent는 두 개 이상의 정렬된 고유 ID로 이루어진 관찰 집합이며,
모두 현재 head이고 서로 비교 불가능해야 한다. 관찰 집합은 현재 head 전체의 진부분집합일
수 있다. 이때 관찰하지 못한 late head는 resolution에 소비되지 않고 새 resolution head와
함께 남으므로 fold는 계속 conflict로 닫힌다.

append가 scan한 뒤 다른 process가 먼저 저장하는 것은 정상 race다. create-once seal은
두 event를 모두 남기고 다음 fold에서 conflict로 닫는다. mtime이나 순회 순서로
winner를 고르지 않는다.

- [ ] **Step 4: GREEN을 확인한다**

Run:

```bash
node --test tests/unit/design-memory-store.test.mjs
```

Expected: 권한 거부와 기존 정상 branch/resolution이 모두 통과한다.

- [ ] **Step 5: 커밋한다**

```bash
git add shared/scripts/lib/safe-memory-store.mjs tests/unit/design-memory-store.test.mjs
git commit -m "fix: authorize memory appends from trusted folds"
```

---

### Task 4: 기존 path symlink와 Git exclude identity

**Files:**
- Modify: `shared/scripts/lib/safe-memory-store.mjs`
- Modify: `tests/unit/design-memory-store.test.mjs`

**Interfaces:**
- Produces internally: `inspectExistingPathChain(absolutePath) -> Array<{ path, identity }>`
- Retains: `ensureMemoryGitExclusion(...) -> { status, code? }`
- Adds optional test seam: `ensureMemoryGitExclusion({ ..., beforeAppend, beforeFinalRecheck })`

- [ ] **Step 1: pre-existing ancestor와 same-inode Git 변경 RED를 작성한다**

workspace의 부모 중간 경로를 symlink로 만들고 `resolveMemoryStore(..., initialize:true)`가
외부에 `.game-design`을 만들지 않는지 검사한다. home과 Git common directory에도 같은
fixture를 적용한다.

Git exclude는 `beforeAppend`에서 열린 같은 inode의 bytes를 바꾼다. 기대값은 warning과
사용자 bytes 보존이다. `beforeFinalRecheck`에서 pathname을 다른 regular file로 바꾸면
`ready`를 반환하면 안 된다.

- [ ] **Step 2: RED를 확인한다**

Run:

```bash
node --test --test-name-pattern="ancestor symlink|Git exclude identity" tests/unit/design-memory-store.test.mjs
```

Expected: 기존 `canonicalDirectory()`가 중간 ancestor symlink를 받아들여 실패한다.

- [ ] **Step 3: 기존 path chain과 exclude bytes를 고정한다**

root에서 대상까지 호출 전에 존재하는 각 component를 `lstat()`한다. symlink와 예상과
다른 file type을 거부하고 dev/ino를 저장한다. 생성 뒤 각 component를 다시 검사한다.

exclude는 `O_NOFOLLOW` handle로 bounded read하고 dev/ino/size/mtime/ctime과 SHA-256을
저장한다. 쓰기 직전 동일 handle을 position 0에서 다시 읽어 snapshot과 비교한다.
정확히 기대한 offset에 marker를 쓰고 sync한 뒤 전체 bytes가
`original + separator + MARKER`와 같은지 확인한다. 마지막으로 pathname `lstat()`과
handle stat의 dev/ino/size/mtime/ctime을 비교한다. 실패는 warning이며 기억 event를
수정하지 않는다.

- [ ] **Step 4: GREEN을 확인한다**

Run:

```bash
node --test tests/unit/design-memory-store.test.mjs
```

Expected: 기존 정상 Git 제외와 symlink victim 테스트를 포함해 모두 통과한다.

- [ ] **Step 5: 커밋한다**

```bash
git add shared/scripts/lib/safe-memory-store.mjs tests/unit/design-memory-store.test.mjs
git commit -m "fix: pin memory and git path identities"
```

---

### Task 5: Hostile 증거 복구와 Task 2 승인

**Files:**
- Create: `tests/fixtures/design-memory/child-append.mjs`
- Modify: `tests/unit/design-memory-store.test.mjs`
- Modify: `tests/unit/design-memory-record.test.mjs`
- Modify: `.superpowers/sdd/2026-08-12-local-game-design-memory-wiki/task-2-append-only-report.md`
- Modify: `.superpowers/sdd/2026-08-12-local-game-design-memory-wiki/progress.md`

**Interfaces:**
- Child fixture stdin: one JSON line `{ workspaceRoot, eventDocument }`
- Child fixture stdout: one JSON line `{ status, eventId, relativePath }`
- Child fixture never prints event bytes, actor, reason or absolute store paths

- [ ] **Step 1: 다중 프로세스와 failpoint RED를 작성한다**

두 Node child process가 같은 event를 동시에 append하면 결과 status를 정렬했을 때
`["created", "present"]`이며 committed logical event는 하나여야 한다. 서로 다른
transition 두 개와 resolution 두 개는 모두 물리적으로 남고 fold에서는
`memory.concurrent_conflict`여야 한다.

instance only, instance+claim, 잘못된 claim length/hash와 commit 없는 hard-link 전
상태를 실제 디렉터리에 만든다. scanner는 어느 것도 event로 반환하지 않는다. 같은
canonical event append 재시도는 `created|present`로 끝나고 기존 승인 기억을
재노출하지 않는다.

- [ ] **Step 2: scan limit RED를 작성한다**

source tree에 정확히 10,000개 entry를 만든 뒤 approved를 무효화하는 disputed event의
commit을 10,001번째 byte-order 위치에 둔다. `scan.complete`는 `false`, fold memories는
빈 Map이어야 한다. `entriesScanned`는 10,000을 넘지 않는다.

- [ ] **Step 3: RED를 확인한다**

Run:

```bash
node --test --test-name-pattern="multiprocess|unsealed failpoint|10001" tests/unit/design-memory-store.test.mjs
```

Expected: 누락된 child fixture나 회귀 assertion 때문에 실패한다.

- [ ] **Step 4: 최소 fixture와 테스트 helper를 구현한다**

child fixture는 실제 `resolveMemoryStore()`와 `appendMemoryEvent()`만 호출한다. 테스트
helper는 expected literal을 생산 코드 helper로 계산하지 않고, SHA-256과 canonical
경로를 독립 계산하거나 고정 fixture 값과 비교한다. cleanup은 test `t.after()`에 둔다.

- [ ] **Step 5: 과거 보고서를 바로잡는다**

`task-2-append-only-report.md`에 새 계획 경로, RED 명령·실패 원인, GREEN 명령·정확한
pass/fail/skip 수와 commit을 기록한다. C helper 기반 `task-2-report.md`는 첫 문단에
`Superseded by portable append-only Task 2`를 표시하되 과거 기록은 삭제하지 않는다.
실행하지 않은 LSP, failpoint나 동시성 검사를 통과했다고 쓰지 않는다.

원 계획 ledger에는 기존 cap을 유지하고 다음 새 줄을 추가한다.

```text
Task 2 authority reset: complete (plan docs/superpowers/plans/2026-08-12-local-game-design-memory-authority.md, review clean)
Task 2: complete (append-only authority review clean; resume Task 3)
```

- [ ] **Step 6: 전체 Task 2 검증을 실행한다**

Run:

```bash
node --test tests/unit/workspace-env.test.mjs tests/unit/design-memory-config.test.mjs tests/unit/image-config.test.mjs
node --test tests/unit/design-memory-record.test.mjs tests/unit/design-memory-store.test.mjs
node --check shared/scripts/validate-design-memory.mjs
node --check shared/scripts/lib/safe-memory-store.mjs
node --check tests/fixtures/design-memory/child-append.mjs
test ! -e shared/scripts/lib/memory-store-posix-helper.c
! rg 'MEMORY_PLATFORM_CAPABILITIES|createMemoryStorePlatformAdapter|writeMemoryFileAtomic|moveMemoryFileAtomic|memoryRecordRelativePath|memory-store-posix-helper' shared tests
git diff --check
```

Expected: 실패 0, 의도적 between-syscall non-goal skip 1개, retired API 검색 결과 0이다.

- [ ] **Step 7: 커밋한다**

```bash
git add tests/fixtures/design-memory/child-append.mjs tests/unit/design-memory-record.test.mjs tests/unit/design-memory-store.test.mjs
git commit -m "test: prove append-only memory trust boundaries"
```

SDD report와 ledger는 git-ignored 작업 기록이므로 해당 plan workspace에만 남긴다.

---

## Final Review Gate

새 계획의 모든 Task는 개별 implementer와 reviewer를 거친다. 마지막에는
`d4d69ef..HEAD` 전체를 별도 `code-reviewer`가 검토한다. Critical 또는 Important가
하나라도 남으면 원 계획 Task 3으로 넘어가지 않는다. 최종 리뷰가 깨끗한 경우에만
원 계획의 Task 3부터 실행을 재개한다.
