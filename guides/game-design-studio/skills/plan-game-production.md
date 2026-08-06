# plan-game-production

## 목적과 최종 산출물

vertical slice의 범위, owner, gate와 kill criteria를 근거에 묶은 `production-scope-risk` 계획으로 만듭니다.

## 사용할 때

- prototype, milestone, effort range, dependency와 scope 우선순위를 정할 때
- commit, defer, reduce, outsource, license 또는 kill 결정을 준비할 때

## 사용하지 않을 때

- target experience가 없으면 `define-game-vision`을 먼저 사용합니다.
- mechanic 규칙이나 economy balance 자체를 설계하지 않습니다.

## 필수 입력과 선택 입력

- 필수: target experience, core loop, approved scope, team capacity, throughput, constraints, dependency, owner
- 선택: maintenance horizon, license/outsource terms, prototype evidence, 기존 production plan, review questions
- 인원·일정·비용·성능 수치는 source, range basis와 validation gate가 없으면 provisional입니다.

## Codex App 요청 예시

**복사 가능한 요청문**

```text
@Game Design Studio 4인 협동 RPG vertical slice의 Must/Should 범위, owner, dependency, milestone gate, definition of done과 kill criteria를 계획해. capacity 근거가 없는 일정은 provisional로 남겨 줘.
```

## Codex CLI 요청 예시

```text
$game-design-studio:plan-game-production vertical slice 범위와 prototype hypothesis, owner, gate, DoD, kill criteria를 production-scope-risk로 작성해.
```

## 내부 진행 흐름

각 scope를 core-loop 기여와 target-experience evidence에 연결하고 observable unit과 측정된 rate로 effort range를 만듭니다. 주 템플릿/profile은 `production-scope-risk`/`production-scope-milestone-risk-plan`, 관련 역할은 `production-feasibility-critic`과 `lead-game-designer`, 다음 스킬은 `review-game-design`입니다.

## 생성 파일과 결과 구조

scope, dependency, maintenance, license/outsource risk, prototype, milestone, DoD, kill criterion과 decision owner를 Canonical Artifact에 기록합니다. 예상 결과 요약: 큰 약속 전에 검증할 가장 싼 vertical slice와 중단 조건이 명확해집니다.

## 관련 템플릿·품질 프로필·전문 역할

기존 Artifact의 템플릿과 선택된 Quality Profile을 그대로 사용하고, 필요 시 관련 전문 역할의 finding을 evidence와 decision record에 연결합니다. 시작점은 [템플릿 카탈로그](../templates.md)와 [문서 품질 프로필](../document-quality.md)입니다.

## 이미지·도식화 조건

템플릿의 image slot이 실제로 필요할 때만 [이미지 자산 흐름](../image-assets.md)으로 계획·생성을 분리합니다. 관계·흐름·상태를 보여 줄 때는 일반 삽화 대신 [Skillstead 도식화](../visualization.md)를 사용하며, 둘 다 필요 없으면 만들지 않습니다.

## 검토·승인 기준

target experience, prototype evidence, capacity 근거 또는 owner가 없으면 큰 commitment를 승인하지 않습니다. 자동화는 procurement, staffing, outsourcing과 irreversible scope expansion을 승인하지 않습니다.

## 실패·fallback·재개 방법

근거 부족 항목은 `missing-target-experience`, `missing-prototype-evidence`, `unsupported-large-estimate`로 보존합니다.

```text
$game-design-studio:plan-game-production 기존 production-scope-risk를 유지하고, 새 prototype 결과와 최근 throughput 근거를 연결해 Must 범위와 kill criteria만 재평가해.
```

## 다음 작업 요청문

**복사 가능한 CLI 후속 요청문**

```text
$game-design-studio:plan-game-production 기존 Canonical Artifact와 decision/evidence 기록을 유지하고, 현재 blocker 또는 미확정 항목만 확인해 다음 검토 가능한 작업을 진행해.
```

## 관련 문서

[스킬 선택표](README.md), [템플릿 카탈로그](../templates.md), [문서 품질](../document-quality.md), [제품 workflow](../workflow.md)
