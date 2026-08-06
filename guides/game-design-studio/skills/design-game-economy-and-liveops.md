# design-game-economy-and-liveops

## 목적과 최종 산출물

두 통화의 source·sink와 LiveOps 이벤트 실험을 투명하고 되돌릴 수 있는 `economy-balance` 또는 `liveops-experiment-event`로 만듭니다.

## 사용할 때

- currency, inventory target, progression, real price, probability와 pity를 설계할 때
- hypothesis, control, 단일 변수, guardrail, stop과 rollback이 필요한 이벤트 실험을 준비할 때

## 사용하지 않을 때

- 단일 mechanic의 state/precedence는 `design-game-systems`를 사용합니다.
- tutorial·input·accessibility flow는 `design-player-experience`를 사용합니다.

## 필수 입력과 선택 입력

- 필수: business model, currencies, sources/sinks, progression target, 가격·확률·pity 근거, regions, owner/approver
- 실험 필수: hypothesis, control/treatment, sample basis, duration, success/guardrail, stop, tested rollback
- 선택: 기존 economy 문서, segmentation, AI/UGC provenance와 consent

## Codex App 요청 예시

**복사 가능한 요청문**

```text
@Game Design Studio 골드와 프리미엄 토큰의 source·sink, target inventory와 inflation risk를 설계하고, 주말 이벤트는 control·한 변수·guardrail·stop·tested rollback이 있는 실험으로 작성해.
```

## Codex CLI 요청 예시

```text
$game-design-studio:design-game-economy-and-liveops 두 통화 economy-balance와 이벤트 liveops-experiment-event를 분리해 작성하고 누락된 가격·확률·rollback을 hard No-Go로 표시해.
```

## 내부 진행 흐름

monetization 전에 source/sink와 inventory 흐름을 모델링하고, 실제 가격·확률·pity·eligibility를 추적합니다. 실험은 한 가설과 변수, 보호 지표, stop/rollback을 고정합니다. 주 profile은 `economy-balance-specification` 또는 `liveops-event-experiment-plan`; 관련 역할은 `system-economy-designer`, `liveops-data-designer`, `ux-accessibility-reviewer`; 다음 스킬은 `review-game-design`입니다.

## 생성 파일과 결과 구조

Canonical Artifact에 value flow, 실험 계약, assumptions, evidence, gates와 owners를 남깁니다. 예상 결과 요약: 경제 결정과 LiveOps 변경의 player consequence와 복구 경계가 보입니다.

## 관련 템플릿·품질 프로필·전문 역할

- Template ID: `economy-balance` 또는 `liveops-experiment-event` — [economy-balance 템플릿](../templates.md#economy-balance), [liveops-experiment-event 템플릿](../templates.md#liveops-experiment-event).
- Quality Profile ID: `economy-balance-specification 또는 liveops-event-experiment-plan`.
- Reviewer/role ID: `system-economy-designer · liveops-data-designer · ux-accessibility-reviewer`.

이 조합은 [문서 품질 프로필](../document-quality.md)의 선택 기록과 함께 유지하며, profile을 새로 고르지 않는 경우는 위처럼 현재 artifact 상속 사유를 명시합니다.

## 이미지·도식화 조건

경제 player-view illustration은 `economy-player-view-image` slot이 있을 때만 계획합니다. source/sink·experiment loop는 `skillstead-economy-source-sink-diagram` 또는 `skillstead-live-service-lifecycle-diagram`으로 관계가 복잡할 때만 도식화합니다.

[이미지 자산 흐름](../image-assets.md)과 [도식화 안내](../visualization.md)의 승인·검증 경계를 따릅니다.

## 검토·승인 기준

실가격 누락은 `missing-real-price`, 확률 누락은 `missing-probability`, rollback 누락은 `missing-rollback`, 안전하지 않은 실험은 `unsafe-liveops-experiment` blocker입니다. 수치·법적 지위·guardrail은 만들지 않습니다.

## 실패·fallback·재개 방법

blocker가 있으면 해당 release/experiment를 No-Go로 두고 관계없는 분석은 보존합니다.

```text
$game-design-studio:design-game-economy-and-liveops 기존 economy와 이벤트 문서를 유지하고, 새 odds 공개 자료와 rollback rehearsal 증거를 연결해 hard No-Go만 다시 평가해.
```

## 다음 작업 요청문

**복사 가능한 다음 handoff**

@Game Design Studio review-game-design로 현재 Artifact의 검증된 기록을 이어 price/probability·rollback blocker를 검토해.

```text
$game-design-studio:review-game-design artifact=<artifact-path> 기존 evidence/decision을 보존하고 다음 handoff를 실행해.
```

## 관련 문서

[economy-balance 템플릿](../templates.md#economy-balance), [liveops-experiment-event 템플릿](../templates.md#liveops-experiment-event), [review-game-design 스킬](./review-game-design.md), [제품 workflow](../workflow.md)
