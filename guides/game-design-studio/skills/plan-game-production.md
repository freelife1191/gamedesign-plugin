# plan-game-production

## 목적과 산출물

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

## Codex App 예시

**복사 가능한 요청문**

```text
@Game Design Studio 4인 협동 RPG vertical slice의 Must/Should 범위, owner, dependency, milestone gate, definition of done과 kill criteria를 계획해. capacity 근거가 없는 일정은 provisional로 남겨 줘.
```

## Codex CLI 예시

```text
$game-design-studio:plan-game-production vertical slice 범위와 prototype hypothesis, owner, gate, DoD, kill criteria를 production-scope-risk로 작성해.
```

## 진행 흐름

각 scope를 core-loop 기여와 target-experience evidence에 연결하고 observable unit과 측정된 rate로 effort range를 만듭니다. 주 템플릿/profile은 `production-scope-risk`/`production-scope-milestone-risk-plan`, 관련 역할은 `production-feasibility-critic`과 `lead-game-designer`, 다음 스킬은 `review-game-design`입니다.

## 결과와 파일

scope, dependency, maintenance, license/outsource risk, prototype, milestone, DoD, kill criterion과 decision owner를 Canonical Artifact에 기록합니다. 예상 결과 요약: 큰 약속 전에 검증할 가장 싼 vertical slice와 중단 조건이 명확해집니다.

## 검토와 승인

target experience, prototype evidence, capacity 근거 또는 owner가 없으면 큰 commitment를 승인하지 않습니다. 자동화는 procurement, staffing, outsourcing과 irreversible scope expansion을 승인하지 않습니다.

## 실패와 재개

근거 부족 항목은 `missing-target-experience`, `missing-prototype-evidence`, `unsupported-large-estimate`로 보존합니다.

```text
$game-design-studio:plan-game-production 기존 production-scope-risk를 유지하고, 새 prototype 결과와 최근 throughput 근거를 연결해 Must 범위와 kill criteria만 재평가해.
```
