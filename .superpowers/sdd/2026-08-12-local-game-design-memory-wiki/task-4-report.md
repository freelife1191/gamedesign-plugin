# Task 4 보고서 — 후보 capture와 기억 유지관리

## RED → GREEN 근거

- RED: `node --test tests/unit/design-memory-capture.test.mjs tests/unit/design-memory-maintenance.test.mjs`는 새 capture 모듈 부재로 `ERR_MODULE_NOT_FOUND`가 발생했다.
- GREEN: 실제 프로젝트 임시 디렉터리에서 candidate capture의 재실행 idempotency, explicit preference의 직접 승인, disabled/project-id 없음/민감정보/source drift 무기록을 검증했다.
- RED: `sweep` 테스트는 `expired` 대신 `rejected`가 append되는 것을 검출했다.
- GREEN: sweep은 append-only `expired`/`stale` transition을 생성하고, 검토는 source 재검증·human actor·사유를 요구한다.
- RED: source locator 보존 테스트는 artifact ID가 locator에 중복 결합되는 것을 검출했다.
- GREEN: artifact 디렉터리가 존재할 때만 source validation이 해당 디렉터리를 안전하게 해석하며, sealed record의 locator bytes는 upstream event 그대로 보존한다.

## 변경 파일

- `shared/scripts/capture-design-memory.mjs` — 안정 memory ID, 후보/explicit capture, source 사전검증, append 결과 및 비치명적 log warning.
- `shared/scripts/maintain-design-memory.mjs` — list/lint/rebuild/sync, verify/approve/reject/retire/sweep/resolution/quarantine 및 단일 JSON CLI.
- `shared/scripts/validate-design-memory.mjs` — 빈 canonical YAML 배열 및 artifact-bound source 검증.
- `shared/scripts/validate-artifact.mjs` — 제한 YAML에서 안전한 빈 배열 `[]`만 허용.
- `tests/unit/design-memory-capture.test.mjs`, `tests/unit/design-memory-maintenance.test.mjs` — 실제 파일시스템/public API 회귀 테스트.

## 검증

- `node --test tests/unit/design-memory-capture.test.mjs tests/unit/design-memory-maintenance.test.mjs tests/unit/design-memory-retrieval.test.mjs` → 37 passed, 0 failed.
- `node --test tests/unit/design-memory-record.test.mjs tests/unit/design-memory-store.test.mjs` → 80 passed, 0 failed, 1 documented skip.
- `node --check shared/scripts/capture-design-memory.mjs` → success.
- `node --check shared/scripts/maintain-design-memory.mjs` → success.
- `git diff --check` → success.

## 보안 경계와 남은 우려

- disabled/project-id 없음은 store resolve 이전에 `skipped`로 종료한다. source drift·민감 입력은 append 전에 중단하며, quarantine은 sealed marker만 append한다.
- list/lint는 initialize 없이 scan/fold만 수행한다. CLI 오류는 code와 안전한 memory ID만 출력한다.
- 기존 append-only/complete-scan/root-identity/Git exclusion 권한은 우회하지 않는다. concurrent head는 자동 승자를 정하지 않고 safe store의 conflict 및 resolution 규칙을 따른다.
- 남은 우려: capture 후 파생 log publish 실패는 source event를 rollback하지 않고 `memory.log_publish` warning으로 반환한다.

## Fix 1 — reviewer findings

- RED→GREEN: missing artifact이 workspace-root 같은 bytes로 fallback되는 capture, classification/actor provenance 위장, 30일 후 explicit preference retrieval을 실제 filesystem/public API 테스트로 추가했다.
- capture는 closed `classification`과 `actorType: human`, `humanAttested: true`를 요구하고, artifact directory 존재도 append 전에 확인한다. explicit preference는 100년 review/expiry를 사용한다.
- maintenance human-authority action은 이름 추측 대신 같은 explicit provenance를 요구한다. list/lint/sweep은 unsafe/incomplete store를 ready-empty로 감추지 않는다. list는 concurrent conflict의 exact heads/status를 반환한다.
- transition/quarantine 뒤 source event projection(`eventId action effective_at status`) Markdown log를 재발행하며 실패는 warning으로 보존한다.
- 검증: capture/maintenance/record/store/retrieval targeted suite와 syntax/diff checks 실행.

### Fix2 capability boundary

- capture receipt는 module-private `WeakMap` identity로만 검증하며 payload에 포함되지 않는다.
- trusted issuer는 closed classification result를 확인하고 durable evidence 또는 explicit instruction context 없는 receipt 발급을 거부한다.

## Fix 2 — exact architecture completion

### RED → GREEN evidence

- Capability module RED: `node --test tests/unit/design-memory-capabilities.test.mjs`는 전용 issuer module 부재로 1 file failure였다. GREEN은 opaque null-prototype/frozen token, Proxy·accessor·symbol·custom prototype·sparse/repeated/cyclic/NFD/control 입력, duplicate/order, classification mismatch, proxied clock과 text bound를 6/6 통과했다.
- Capture integration RED: 새 top-level `classificationReceipt` 경계에서 기존 command는 4 failed, 3 passed였고 issuer를 re-export했다. GREEN은 command re-export 제거, project/lane/scope/TTL/event/time exact binding, copy/JSON/spread/clone/Proxy/forgery/reuse mutation 거부, exact retry와 operation conflict, 다섯 event type을 9/9 통과했다.
- Artifact-bound RED: missing artifact의 workspace-root matching bytes가 `validateMemorySourceBindings`에서 current로 판정되어 record suite가 34 passed, 1 failed였다. GREEN은 canonical workspace/artifact/intermediate/final identity pin·recheck, mandatory artifact directory, symlink/special-file 거부, `O_NOFOLLOW`, byte SHA-256 비교를 적용해 record 35/35와 crafted legacy retrieval stale 경계를 통과했다.
- Store RED: safe absence가 `memory.unsafe_path`로 실패하고 late third head가 있는 observed subset resolution이 `memory.resolution_heads`로 거부되어 2/2 failed였다. GREEN은 safe absence `null`/unsafe error 분리와 `(H - P) + resolution` head 보존을 구현해 store 46 passed, 1 documented skip을 통과했다.
- Maintenance RED: live human receipt, safe absent list/lint, quarantine log, log failure preservation, CLI denial 경계에서 7 failed, 3 passed였다. GREEN은 `actorType`/`humanAttested` 제거, exact human receipt, JSON-only mutation denial, exact retry, candidate/approved retire, candidate expiry, external stale, quarantine, Git mode/lock/idempotence, read-only list/lint와 byte-identical rebuild를 14/14 통과했다.
- Retry/log RED: resolution retry와 sweep retry는 각각 stale-head 오류로 실패했고, unsafe log namespace가 warning 없이 통과했다. GREEN은 content-identical append retry를 먼저 인정하고 source event를 보존하며, transition/quarantine source time과 safe field만 포함하는 exact log를 발행한다.
- Clock/text RED: proxied Date가 raw `TypeError`를 노출하고 1025자 reason이 발급되는 1/1 failure를 확인했다. GREEN은 canonical Date/ISO clock과 actor/reason bounds로 6/6 capability suite를 재통과했다.

### Architecture boundary resolution

- `design-memory-capabilities.mjs`만 issuer를 export한다. command module은 issuer를 re-export하지 않으며 persisted event/record schema에는 capability field가 없다.
- capture는 `classificationReceipt`, maintenance mutation은 `humanReceipt`의 live object identity와 canonical request SHA-256/effective time이 모두 일치할 때만 store를 호출한다. CLI는 `list`, `lint`, `rebuild`, `sync-git-exclusion`만 JSON으로 사용할 수 있고 mutation은 `memory.human_authority_required`로 닫힌다.
- resolution은 정렬된 고유 observed parents가 현재 pairwise-incomparable head의 부분집합이면 허용한다. 관찰하지 못한 late head는 그대로 남아 fold가 `memory.concurrent_conflict`를 유지한다. stale/comparable/extra/missing parent와 immutable/chosen snapshot mutation은 기존 store authority가 거부한다.
- `resolveMemoryStore({ initialize:false })`는 안전한 부재만 `null`로 반환한다. existing symlink/file/root identity 문제와 incomplete scan은 error로 닫고, absent `list`/`lint`는 어떤 경로도 만들지 않은 채 ready/empty를 반환한다.
- log는 source event와 quarantine marker를 source time, UTF-8 ID 순으로 투영한다. actor, reason, body, source locator/digest, absolute path, derived time, UUID는 포함하지 않는다. publish 실패는 append된 source event를 rollback/rewrite하지 않는다.

### Commits and final verification

- Commit range: `e65bc6a..01dc383` (`c1fb471`, `ac002ae`, `2cf50ef`, `fc3f29f`, `e56252b`, `01dc383`).
- Task 4 suites: capabilities 6/6, capture 9/9, maintenance 14/14.
- Core memory regression: config 14/14, record 35/35, store 46 passed + 1 documented skip, retrieval 37/37.
- Mutation harness: 39/39 passed.
- `validate-artifact`: 63/63 passed; prior parser behavior remains intact.
- Node syntax checks passed for capture, maintenance, safe store, capability, memory validation, and artifact validation modules. Four persisted memory schemas parsed successfully. `git diff --check` passed. No dependency or persisted schema change was introduced.

### Remaining concern

- Store suite의 기존 documented skip 1건은 Node 18 path API가 악의적인 same-user between-syscall directory swap을 완전히 예방할 수 없다는 플랫폼 제한이다. 이번 Fix 2의 artifact identity swap·final inode swap·root identity 재검사는 통과했으며, 추가 blocker는 없다.
