# Studio 템플릿 레퍼런스

설치 package의 15개 Canonical Artifact seed를 비교합니다. 각 디렉터리는 `content.md`, `evidence.yml`, `export-manifest.yml`, `decisions/README.md`, `assets/README.md`를 포함합니다.

## 정확한 inventory

| 템플릿 ID | 목적 |
| --- | --- |
| `accessibility-platform-matrix` | 플랫폼·critical action별 동등한 접근과 검증 기록 |
| `character-skill-combat-monster` | 캐릭터·스킬·전투·몬스터의 strategy, rule, telegraph와 balance 계약 |
| `core-motivation-loop` | core/motivation loop와 player protection 검증 |
| `data-schema-table-contract` | design meaning과 schema/runtime/migration 경계 연결 |
| `decision-change-log` | 결정, 대안, 근거, 변경, rollback과 reopen 추적 |
| `economy-balance` | source/sink, progression, price, probability, pity와 recovery 검토 |
| `game-design-brief` | target experience, scope와 production decision 정렬 |
| `game-design-review` | evidence-backed finding과 최소 수정·disagreement 기록 |
| `liveops-experiment-event` | 통제 실험, 보호 지표, stop과 rollback 계획 |
| `narrative-quest-npc` | 퀘스트·NPC의 선택, 상태, 생산, 권리와 consent 연결 |
| `production-scope-risk` | core-loop 기여, capacity, prototype, scope와 kill criteria 계획 |
| `rule-exception-matrix` | rule precedence, concurrency, exception과 test case 결정 |
| `system-specification` | deterministic rule, state, failure, UI와 runtime mapping 명세 |
| `ui-ux-flow-state` | critical flow, UI state, accessible interaction과 recovery 명세 |
| `vision-pillars` | player promise, pillar, anti-pillar와 success signal 정의 |

## 공통 구조와 승인

모든 seed는 도메인별 section 두 개 뒤에 `Working Record`, `Assumptions and Boundaries`, `Owners and Approvals`, `Evidence and Freshness`, `Applicable Safety Gates`, `Output Story Hints`, `Assets`, `Decisions`, `Change History`를 둡니다. material claim은 `evidence.yml`의 source와 limitation에 연결합니다. Current claim은 primary source date, retrieval date, region/scope, review-after date와 refresh owner가 필요합니다. 자동화는 approval, rights와 consent를 부여하지 않습니다.

모든 seed의 format slot은 MD, PDF, DOCX, PPTX입니다. 초기 export manifest는 MD를 `pending`, 나머지를 `unavailable`로 두며 capability와 실제 renderer/QA evidence 없이 상태를 올리지 않습니다. PPTX는 audience·purpose·독립 story를 사용합니다.

## accessibility-platform-matrix

- 좋은 적합: 지원 플랫폼별 critical action, input, focus, visual/audio alternative와 verification을 비교할 때. 나쁜 적합: 단일 화면 mock이나 근거 없는 규정 준수 선언.
- 필수 section/record: `Platform Access Matrix`, `Accessibility Completion Gate`; platform, critical-action, input-method, focus-navigation, visual/audio-alternative, text-scale, performance, offline-interruption, verification.
- Evidence/approval: current platform·accessibility 1차 근거와 accessibility owner 승인이 필요하며 unverified critical path는 blocker입니다.
- Profile: `accessibility-platform-matrix`.
- Slot: image `accessibility-state-image`; Skillstead diagram `skillstead-accessibility-dependency-diagram`.
- Package path: `products/game-design-studio/plugin/assets/templates/accessibility-platform-matrix/`.
- 복사 가능한 요청문: `@Game Design Studio accessibility-platform-matrix로 모바일·PC의 critical action별 input, focus, sensory alternative와 verification을 비교해.`
- 예상 결과: 플랫폼별 누락 접근 경로와 승인 owner가 드러난 review artifact.

## character-skill-combat-monster

- 좋은 적합: character, skill, boss encounter의 role, strategy, telegraph, counterplay와 balance test. 나쁜 적합: 전체 game vision이나 확정되지 않은 system rule.
- 필수 section/record: `Combat Content Contract`, `Fairness and Readability`; entity-id, combat-role, player-strategy, input-timing, state-rule, telegraph, counterplay, failure-recovery, data-key, balance-test.
- Evidence/approval: canonical system/data ID, production/balance evidence와 combat·accessibility reviewer가 필요합니다.
- Profile: `character-skill-combat-monster-specification`.
- Slot: image `combat-telegraph-image`; Skillstead diagram `skillstead-combat-state-diagram`.
- Package path: `products/game-design-studio/plugin/assets/templates/character-skill-combat-monster/`.
- 복사 가능한 요청문: `@Game Design Studio character-skill-combat-monster로 협동 보스의 telegraph, counterplay, state rule과 balance test를 명세해.`
- 예상 결과: 플레이어가 읽고 대응할 수 있으며 data key에 연결된 전투 콘텐츠 계약.

## core-motivation-loop

- 좋은 적합: action, feedback, reward, motivation, meaningful choice와 repeat driver 연결. 나쁜 적합: retention 수치를 발명하거나 coercive loop를 정당화하는 작업.
- 필수 section/record: `Loop Contract`, `Compulsion Safety`; loop-step, player-input, system-response, feedback, reward, motivation-need, meaningful-choice, failure-recovery, metric.
- Evidence/approval: player research 또는 명시적 가정, measurable outcome과 player-protection reviewer가 필요합니다.
- Profile: `core-motivation-loop`.
- Slot: image `loop-moment-image`; Skillstead diagram `skillstead-core-motivation-loop-diagram`.
- Package path: `products/game-design-studio/plugin/assets/templates/core-motivation-loop/`.
- 복사 가능한 요청문: `@Game Design Studio core-motivation-loop로 협동 탐험의 action·feedback·reward·meaningful choice와 stop condition을 연결해.`
- 예상 결과: 관찰 가능한 loop 가설과 compulsion safety 경계.

## data-schema-table-contract

- 좋은 적합: field별 PK/FK, type/range, authority, runtime consumer, migration과 rollback 연결. 나쁜 적합: schema key 없는 일반 UI label 목록.
- 필수 section/record: `Schema Contract`, `Design to Runtime Boundary`; field-id, table, primary-key, foreign-key, type-range, default-null, design-meaning, runtime-consumer, authority-sync, migration-validation.
- Evidence/approval: authoritative schema, compatibility/migration test와 design·engineering owner가 필요합니다.
- Profile: `data-table-contract`.
- Slot: image `data-inspection-image`; Skillstead diagram `skillstead-data-dependency-diagram`.
- Package path: `products/game-design-studio/plugin/assets/templates/data-schema-table-contract/`.
- 복사 가능한 요청문: `@Game Design Studio data-schema-table-contract로 제작 recipe field의 PK/FK, authority, runtime consumer, migration과 rollback을 정의해.`
- 예상 결과: design 의미와 실제 runtime contract가 연결된 schema artifact.

## decision-change-log

- 좋은 적합: 장기간 유지할 design/scope/safety 결정과 변경 영향 추적. 나쁜 적합: 근거·owner 없는 회의 메모.
- 필수 section/record: `Decision Contract`, `Change Traceability`; decision-id, date, owner, status, context, alternatives, evidence-ids, rationale, approver, reopen-condition.
- Evidence/approval: alternatives와 evidence IDs, named approver, rollback과 reopen condition이 필요합니다.
- Profile: `design-review-decision-log`.
- Slot: image `review-annotation-image`; Skillstead diagram `skillstead-decision-dependency-diagram`.
- Package path: `products/game-design-studio/plugin/assets/templates/decision-change-log/`.
- 복사 가능한 요청문: `@Game Design Studio decision-change-log로 스태미나 cap 결정의 대안, evidence, consequences, rollback과 reopen condition을 기록해.`
- 예상 결과: 변경 이유와 다음 재검토 조건을 추적할 수 있는 결정 ledger.

## economy-balance

- 좋은 적합: resource source/sink, target inventory, progression, real price, odds, pity와 inflation 분석. 나쁜 적합: 실제 가격·확률 근거 없는 monetization 승인.
- 필수 section/record: `Economy Contract`, `Price Probability and Recovery Gate`; resource-id, source, sink, target-inventory, progression-time, real-price, probability, pity, inflation-risk, rollback.
- Evidence/approval: current price/probability policy, telemetry와 economy/monetization owner 승인이 필요합니다.
- Profile: `economy-balance-specification`.
- Slot: image `economy-player-view-image`; Skillstead diagram `skillstead-economy-source-sink-diagram`.
- Package path: `products/game-design-studio/plugin/assets/templates/economy-balance/`.
- 복사 가능한 요청문: `@Game Design Studio economy-balance로 골드·토큰의 source/sink, inventory target, price, odds, pity와 rollback을 검토해.`
- 예상 결과: player consequence와 hard No-Go가 드러난 경제 명세.

## game-design-brief

- 좋은 적합: 새 프로젝트의 target player, experience, core loop, scope, non-goals와 owner 정렬. 나쁜 적합: 세부 executable system spec이나 근거 없는 production commitment.
- 필수 section/record: `Brief Contract`, `Release Boundary`; target-player, experience-intent, platform, genre, business-model, core-loop, scope, non-goals, success-metric, owner.
- Evidence/approval: target-experience evidence, prototype plan, success criterion과 product owner가 필요합니다.
- Profile: `game-design-brief`.
- Slot: image `design-context-image`; Skillstead diagram `skillstead-design-flow-diagram`.
- Package path: `products/game-design-studio/plugin/assets/templates/game-design-brief/`.
- 복사 가능한 요청문: `@Game Design Studio game-design-brief로 모바일 협동 RPG의 target experience, core loop, scope, non-goals와 success metric을 정리해.`
- 예상 결과: domain 작업과 production gate의 기준이 되는 project brief.

## game-design-review

- 좋은 적합: stable source를 evidence-backed finding과 최소 수정으로 검토. 나쁜 적합: source 부재 상태에서 hypothetical finding 만들기 또는 artifact 재작성.
- 필수 section/record: `Review Finding Contract`, `Review Boundary`; finding-id, severity, evidence-id, impact, section-id, minimal-fix, role, status, decision-id.
- Evidence/approval: direct locator, owner와 reviewer role이 필요하며 disagreement는 decision owner가 해결합니다.
- Profile: `design-review-decision-log`.
- Slot: image `review-annotation-image`; Skillstead diagram `skillstead-decision-dependency-diagram`.
- Package path: `products/game-design-studio/plugin/assets/templates/game-design-review/`.
- 복사 가능한 요청문: `@Game Design Studio game-design-review로 이 system spec의 launch blocker, impact와 최소 수정만 기록해.`
- 예상 결과: 원본을 보존하는 prioritized findings와 unresolved decisions.

## liveops-experiment-event

- 좋은 적합: one hypothesis, control, changed variable, sample, guardrail, stop과 rollback을 가진 이벤트. 나쁜 적합: 검증되지 않은 rollout이나 여러 변수를 섞은 실험.
- 필수 section/record: `Experiment Contract`, `Protection and Rollback Gate`; experiment-id, hypothesis, control, single-variable, sample, duration, success, guardrail, stop-condition, rollback.
- Evidence/approval: policy/consent basis, sample basis, tested rollback과 live operations owner가 필요합니다.
- Profile: `liveops-event-experiment-plan`.
- Slot: image `event-communication-image`; Skillstead diagram `skillstead-live-service-lifecycle-diagram`.
- Package path: `products/game-design-studio/plugin/assets/templates/liveops-experiment-event/`.
- 복사 가능한 요청문: `@Game Design Studio liveops-experiment-event로 주말 이벤트의 hypothesis, control, 한 변수, guardrail, stop과 tested rollback을 작성해.`
- 예상 결과: 보호 지표와 rollback이 있는 decision-ready experiment plan.

## narrative-quest-npc

- 좋은 적합: quest/NPC의 purpose, system input, choice, state, telegraph, reward, repeatability와 rights 연결. 나쁜 적합: canonical system 없이 서사만 확정하거나 AI/UGC 권리를 추정하는 작업.
- 필수 section/record: `Narrative Content Contract`, `AI and UGC Rights Boundary`; content-id, player-purpose, entry-condition, choice-consequence, quest-state, npc-state, telegraph, reward, repeatability, rights-consent.
- Evidence/approval: system/data dependency, production evidence, provenance·rights·consent와 named approver가 필요합니다.
- Profile: `narrative-quest-npc-specification`.
- Slot: image `npc-story-beat-image`; Skillstead diagram `skillstead-quest-flow-diagram`.
- Package path: `products/game-design-studio/plugin/assets/templates/narrative-quest-npc/`.
- 복사 가능한 요청문: `@Game Design Studio narrative-quest-npc로 폐허 도시 quest와 NPC의 선택·상태·reward·repeatability·rights를 연결해.`
- 예상 결과: system과 production 현실에 연결된 narrative content spec.

## production-scope-risk

- 좋은 적합: scope의 core-loop 기여, MoSCoW, effort range, dependency, prototype와 kill criterion 결정. 나쁜 적합: capacity·prototype 근거 없는 큰 commitment.
- 필수 section/record: `Scope and Risk Contract`, `Commitment Gate`; scope-id, core-loop-contribution, moscow, effort, dependency, maintenance, rights-outsource-risk, prototype-hypothesis, definition-of-done, kill-criterion.
- Evidence/approval: measured throughput, capacity, prototype result, named owner와 product approval이 필요합니다.
- Profile: `production-scope-milestone-risk-plan`.
- Slot: image `scope-reference-image`; Skillstead diagram `skillstead-production-roadmap-dependency-diagram`.
- Package path: `products/game-design-studio/plugin/assets/templates/production-scope-risk/`.
- 복사 가능한 요청문: `@Game Design Studio production-scope-risk로 vertical slice 범위, dependency, owner, DoD, gate와 kill criteria를 정해.`
- 예상 결과: commit/defer/kill 판단이 가능한 evidence-backed scope plan.

## rule-exception-matrix

- 좋은 적합: 동시 rule의 priority, exception, conflict, failure, recovery와 test case 정리. 나쁜 적합: 문서 순서나 직감으로 precedence를 해결하는 작업.
- 필수 section/record: `Rule and Exception Order`, `Conflict Boundary`; rule-id, priority, condition, exception-id, concurrency, authority, failure, recovery, test-case.
- Evidence/approval: authoritative rule owner, conflict decision과 executable test가 필요합니다.
- Profile: `rule-state-exception-matrix`.
- Slot: image `exception-feedback-image`; Skillstead diagram `skillstead-rule-state-diagram`.
- Package path: `products/game-design-studio/plugin/assets/templates/rule-exception-matrix/`.
- 복사 가능한 요청문: `@Game Design Studio rule-exception-matrix로 스태미나 소비와 무료 보너스의 precedence, exception, concurrency와 test case를 정리해.`
- 예상 결과: implementation을 막는 unresolved precedence가 명시된 rule matrix.

## system-specification

- 좋은 적합: mechanic의 input, rule, transition, precedence, failure, UI state와 data mapping 정의. 나쁜 적합: 전체 vision이나 단일 quest 서술.
- 필수 section/record: `System Contract`, `Precedence and Runtime Mapping`; rule-id, input, precondition, state-transition, output, feedback, precedence, exception, failure-recovery, data-runtime-mapping.
- Evidence/approval: balance evidence 또는 provisional validation, engineering mapping과 design owner가 필요합니다.
- Profile: `system-feature-specification`.
- Slot: image `feature-readability-image`; Skillstead diagram `skillstead-feature-state-diagram`.
- Package path: `products/game-design-studio/plugin/assets/templates/system-specification/`.
- 복사 가능한 요청문: `@Game Design Studio system-specification으로 제작 시스템의 rule, state, exception, failure/recovery와 table/runtime mapping을 작성해.`
- 예상 결과: 설계·개발·QA가 공유하는 구현 가능한 mechanic contract.

## ui-ux-flow-state

- 좋은 적합: critical action, first session, loading/empty/error/offline/interruption/recovery state와 accessibility. 나쁜 적합: authoritative game rule이나 schedule 계획.
- 필수 section/record: `Flow and State Contract`, `Access to Critical Actions`; state-id, entry-condition, information-priority, critical-action, input, loading-empty-error, exit-condition, accessibility, telemetry.
- Evidence/approval: platform/accessibility current evidence, test result와 accessibility owner가 필요합니다.
- Profile: `ui-ux-flow-state-specification`.
- Slot: image `ui-key-screen-image`; Skillstead diagram `skillstead-ui-flow-state-diagram`.
- Package path: `products/game-design-studio/plugin/assets/templates/ui-ux-flow-state/`.
- 복사 가능한 요청문: `@Game Design Studio ui-ux-flow-state로 첫 세션의 모든 UI state, input, feedback, recovery와 accessible alternative를 작성해.`
- 예상 결과: 플랫폼별로 테스트 가능한 interaction state 계약.

## vision-pillars

- 좋은 적합: target-player promise, desired emotion, core fun, pillar/anti-pillar와 success signal 정의. 나쁜 적합: 재미 형용사를 evidence로 취급하거나 세부 runtime rule 작성.
- 필수 section/record: `Vision and Pillars`, `Unsupported Fun Boundary`; pillar-id, player-promise, design-rule, anti-pillar, evidence-id, success-signal, owner.
- Evidence/approval: player evidence 또는 explicit assumption, observable validation과 lead design owner가 필요합니다.
- Profile: `vision-one-pager`.
- Slot: image `vision-reference-image`; Skillstead diagram `skillstead-vision-dependency-diagram`.
- Package path: `products/game-design-studio/plugin/assets/templates/vision-pillars/`.
- 복사 가능한 요청문: `@Game Design Studio vision-pillars로 협동 RPG의 player promise, desired emotion, pillar, anti-pillar와 관찰 가능한 success signal을 정의해.`
- 예상 결과: 기능·콘텐츠·scope 결정을 평가할 수 있는 vision contract.
