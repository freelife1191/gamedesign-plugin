# plan-junior-growth

## 목적과 산출물

target-role requirement와 실제 project event를 분기 목표, 증거 프로젝트, feedback cycle과 re-evaluation decision으로 연결합니다.

## 사용할 때

- new-hire·junior의 다음 분기 성장 목표를 만들 때
- transition 준비에서 현재 evidence와 target requirement의 차이를 검토할 때

## 사용하지 않을 때

- 활동 수를 readiness나 승진 증거로 바꿀 때
- source 없는 desired skill을 current market requirement로 단정할 때

## 필수 입력과 선택 입력

- 필수: requirement IDs/status, posting evidence IDs, project-event evidence, owner, feedback source와 review date
- 선택: target depth/breadth, proof artifact, past feedback와 transition target
- current requirement에는 검색일, 지역, 표본을 기록하고 사실·추론·제안을 분리합니다.

## Codex App 예시

**복사 가능한 요청문**

```text
@Game Design Career 주니어 시스템 기획자의 다음 분기 목표를 만들어. fresh posting requirement와 실제 project event만 연결하고 각 목표에 observable project, owner, 격주 feedback, proof artifact와 재평가 결정을 넣어.
```

## Codex CLI 예시

```text
$game-design-career:plan-junior-growth targetRole=systems-designer, period=quarter, evidence=artifacts/project-events
```

## 진행 흐름

현재 primary posting source가 있는 `requirementId`는 `approved`, 없으면 `provisional`로 둡니다. project event마다 stable `eventId`, attribution, source와 verification status를 기록합니다. goal은 `requirementId`에 연결하고 observable project, owner, cadence, `proofArtifact`와 `continue|revise|replace|approve-ready|retire` 결정을 포함합니다.

## 결과와 파일

target requirement register, project-event evidence ledger, quarterly goal records, feedback calendar, proof-artifact index와 verification tasks를 `junior-growth-review`에 남깁니다. 예상 결과 요약: 다음 분기에 관찰·검토할 수 있는 성장 evidence loop가 생깁니다.

## 검토와 승인

검색일·지역·표본의 freshness와 blind spot을 보여 줍니다. project fact, candidate interpretation, 성장 추론과 다음 행동 제안을 구분합니다. unverified plan은 승진·합격·전환 readiness를 보장하지 않습니다.

## 실패와 재개

requirement source 또는 proof가 없으면 provisional ID와 verification task를 유지합니다. contradictory feedback과 missing proof를 삭제하지 않습니다.

```text
$game-design-career:plan-junior-growth 기존 goalId와 eventId를 유지하고 새 mentor feedback만 연결해 re-evaluation부터 재개해.
```
