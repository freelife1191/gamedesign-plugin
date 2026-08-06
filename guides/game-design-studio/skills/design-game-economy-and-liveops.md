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

기존 Artifact의 템플릿과 선택된 Quality Profile을 그대로 사용하고, 필요 시 관련 전문 역할의 finding을 evidence와 decision record에 연결합니다. 시작점은 [템플릿 카탈로그](../templates.md)와 [문서 품질 프로필](../document-quality.md)입니다.

## 이미지·도식화 조건

템플릿의 image slot이 실제로 필요할 때만 [이미지 자산 흐름](../image-assets.md)으로 계획·생성을 분리합니다. 관계·흐름·상태를 보여 줄 때는 일반 삽화 대신 [Skillstead 도식화](../visualization.md)를 사용하며, 둘 다 필요 없으면 만들지 않습니다.

## 검토·승인 기준

실가격 누락은 `missing-real-price`, 확률 누락은 `missing-probability`, rollback 누락은 `missing-rollback`, 안전하지 않은 실험은 `unsafe-liveops-experiment` blocker입니다. 수치·법적 지위·guardrail은 만들지 않습니다.

## 실패·fallback·재개 방법

blocker가 있으면 해당 release/experiment를 No-Go로 두고 관계없는 분석은 보존합니다.

```text
$game-design-studio:design-game-economy-and-liveops 기존 economy와 이벤트 문서를 유지하고, 새 odds 공개 자료와 rollback rehearsal 증거를 연결해 hard No-Go만 다시 평가해.
```

## 다음 작업 요청문

**복사 가능한 CLI 후속 요청문**

```text
$game-design-studio:design-game-economy-and-liveops 기존 Canonical Artifact와 decision/evidence 기록을 유지하고, 현재 blocker 또는 미확정 항목만 확인해 다음 검토 가능한 작업을 진행해.
```

## 관련 문서

[스킬 선택표](README.md), [템플릿 카탈로그](../templates.md), [문서 품질](../document-quality.md), [제품 workflow](../workflow.md)
