# Task 3 보고서 — 가격 스냅샷과 라이브 승인

## 결과

- `estimateCutsceneImageCost`는 timestamped host-provided 가격 스냅샷만 사용해 wave별 결정적 견적 digest를 만든다. 현재 계약에 request token budget이 없으므로 가격을 추정해 발명하지 않고 0으로 선언된 범위만 낸다.
- `calculateActualCost`는 text/cached-text/image/cached-image/output 다섯 usage category를 모두 받은 경우에만 USD를 계산한다. cached breakdown 또는 가격 스냅샷이 불완전하면 명시적으로 `unavailable`을 반환한다.
- 승인 receipt/capability는 private `WeakMap`의 동일 객체 pair이며, clone, spread reconstruction, proxy-like 대체 capability를 통과시키지 않는다.
- 승인 binding은 generation-ready closed plan/package를 받으면 canonical plan/package hash와 package reference binding을 다시 계산한다. caller wrapper의 SHA 필드는 권한이 아니다.
- host 검증은 wave별 binding, 15분 receipt freshness, 그 후 24시간 가격 freshness를 정해진 code/path 순서로 검사한다.

## TDD 증거

- RED: `node --test tests/unit/cutscene-generation-approval.test.mjs`는 새 비용 모듈이 없어 `ERR_MODULE_NOT_FOUND`로 실패했다.
- GREEN: 새 비용/approval/capability 모듈 구현 뒤 focused Task 3 + cutscene test가 통과했다.
- 적대 테스트: receipt/capability clone, role-like reviewer, actor/event/reviewer mismatch, 9개 binding field의 개별 stale mutation, unsorted IDs, approval/pricing clock boundary, incomplete cached usage, unavailable pricing snapshot을 실행했다.

## 검증

- `node --test tests/unit/cutscene-generation-approval.test.mjs tests/unit/cutscene-visual-preproduction.test.mjs tests/unit/image-assets.test.mjs tests/products/studio/image-assets.test.mjs` — 80 passed, 0 failed.
- `node --check shared/scripts/estimate-cutscene-image-cost.mjs && node --check shared/scripts/lib/cutscene-generation-capabilities.mjs && node --check shared/scripts/lib/cutscene-generation-approval.mjs` — 성공.
- 컷씬 schema JSON 파싱 및 `git diff --check` — 성공.

## 자체 검토

- 네 wave는 estimate의 exact wave ID/asset ID set에 결속되며 global approval을 만들지 않는다.
- receipt가 없고 capability도 없을 때 host wrapper는 해당 `/cutsceneWorkflow/waves/<index>/approval` path로 변환한다.
- 가격은 코드 상수나 network call이 아니라 caller-supplied official evidence로만 입력된다.
- generation-ready authority 입력에서는 오래된 wrapper digest를 유지한 채 actual closed plan을 변경해도 `/planSha256` stale로 재승인된다.

## 위험 / 후속 작업

- 실제 request token budget, retry reserve/cap preflight, provider usage receipt 쓰기는 Task 4 dispatch 경계의 책임이다. 이 Task는 network/provider call을 수행하지 않는다.

## Fix 1 — closed authority and canonical snapshot remediation

### 변경

- public capability mint 모듈을 제거하고, `WeakMap`과 capability 발급을 `issueCutsceneHumanApproval`의 private closure로 이동했다.
- legacy `{sha256,waves}` authority fallback을 제거했다. estimate와 approval binding은 현재 closed plan 및 Task 2 generation-ready prompt package를 함께 검증한다.
- pricing snapshot, cost estimate, prompt package의 digest를 caller SHA가 아니라 exact closed content의 canonical SHA-256으로 재계산한다.
- package의 cutscene ID, plan digest, DAG digest, reference asset set, prompt ID/order/hash를 plan과 대조한다. stale package는 새 approval을 만들 수 없다.
- reviewer/actor는 기존 named-human NFKC/canonical-key 방식에 맞춰 separator·suffix role variants를 차단하고, 모든 approval/pricing timestamp는 RFC3339 validator를 사용한다.

### RED/GREEN

- RED: 실제 plan/package fixture로 전환한 focused suite는 public mint, legacy wrapper acceptance, mutable pricing/estimate digest, stale package, role-like identity, loose timestamp assertions에서 7개 실패했다.
- GREEN: `node --test tests/unit/cutscene-generation-approval.test.mjs` — 9 passed, 0 failed.
- 최종: cutscene/image-assets 관련 80개 테스트, script syntax, schema JSON parsing, `git diff --check`가 통과했다.

### 자체 검토

- capability는 issuer 외부에서 등록하거나 복원할 수 없고, receipt/capability proxy·clone은 live pair 검사에서 거절된다.
- snapshot units/retrievedAt와 estimate minimum/expected/maximum을 각각 같은 caller SHA로 바꾸는 적대 테스트가 canonical digest mismatch를 검출한다.
- 승인 freshness는 정확히 15분까지, pricing freshness는 정확히 24시간까지 허용하며 그 다음 밀리초부터 stale이다.

## Fix 2 — issuer-owned current binding and Task 2 reference order

### 변경

- `issueCutsceneHumanApproval`은 live event와 `{plan,promptPackage,pricingSnapshot,estimate}`만 받고, same current-binding validator를 직접 호출해 receipt를 구성한다. caller `context`는 `cutscene.approval_context_forbidden`으로 거절하며 WeakMap pair를 만들지 않는다.
- generation-ready package의 Task 2 manifest reference order는 type, duplicate, current asset binding만 확인하고 보존한다. approval receipt에는 그 목록을 UTF-8 canonical order의 immutable binding으로 저장한다.
- named-human 판정은 NFKC와 separator-aware token을 사용하되 `ai`는 독립 token으로만 차단한다. 따라서 `image_agent`, `reviewer_01`, `OpenAI`는 거절하고 `Kai`, `Mai`, `Mihai`는 허용한다.

### RED/GREEN

- RED: actual authority fixture와 manifest-order two-reference package를 사용한 focused test는 precomputed context acceptance와 package reference sort rejection으로 실패했다.
- GREEN: `node --test tests/unit/cutscene-generation-approval.test.mjs` — 11 passed, 0 failed.
- 최종: Task 3/cutscene/image-assets 스위트 82 passed, 0 failed; syntax, schema JSON, `git diff --check` 통과.

### 자체 검토

- arbitrary hash context는 발급 API의 authority input이 아니며, invalid plan/package/pricing/estimate는 receipt/capability 생성 이전에 실패한다.
- source reference order가 unsorted여도 valid Task 2 package는 issue 및 host assertion을 통과하고, receipt의 reference binding은 단일 canonical comparison order를 사용한다.
