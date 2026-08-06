# plan-junior-growth

## 목적과 최종 산출물

target-role requirement와 실제 project event를 분기 목표, 증거 프로젝트, feedback cycle과 re-evaluation decision으로 연결합니다.

## 사용할 때

- new-hire·junior의 다음 분기 성장 목표를 만들 때
- transition 준비에서 현재 evidence와 target requirement의 차이를 검토할 때

## 사용하지 않을 때

- 활동 수를 readiness나 승진 증거로 바꿀 때
- source 없는 desired skill을 current market requirement로 단정할 때

## 필수 입력과 선택 입력

- 필수: requirement IDs/status, posting evidence IDs, project-event evidence, owner, feedback source와 review date
- current 채용 근거 필수: stable `sourceId`, official HTTPS `sourceUrl`(source location), `postedDate`, `retrievalDate`, `reviewAfter`와 trusted 기준일
- 선택: target depth/breadth, proof artifact, past feedback와 transition target
- current requirement에는 검색일, 지역, 표본을 기록하고 사실·추론·제안을 분리합니다.

## Codex App 요청 예시

**복사 가능한 요청문**

```text
@Game Design Career 주니어 시스템 기획자의 다음 분기 목표를 만들어. fresh posting requirement와 실제 project event만 연결하고 각 목표에 observable project, owner, 격주 feedback, proof artifact와 재평가 결정을 넣어.
```

## Codex CLI 요청 예시

```text
$game-design-career:plan-junior-growth targetRole=systems-designer, period=quarter, evidence=artifacts/project-events
```

## 내부 진행 흐름

현재 primary posting source가 있는 `requirementId`는 `approved`, 없으면 `provisional`로 둡니다. trusted 기준일이 `reviewAfter`를 넘으면 stale evidence는 current claim에 사용하지 않습니다. 이 경우 `research-game-design-jobs`로 공고를 재수집하고 validator 재검증을 통과한 새 evidence IDs를 해당 `requirementId`에 다시 결합합니다. project event마다 stable `eventId`, attribution, source와 verification status를 기록합니다. goal은 `requirementId`에 연결하고 observable project, owner, cadence, `proofArtifact`와 `continue|revise|replace|approve-ready|retire` 결정을 포함합니다.

## 생성 파일과 결과 구조

target requirement register, project-event evidence ledger, quarterly goal records, feedback calendar, proof-artifact index와 verification tasks를 `junior-growth-review`에 남깁니다. 예상 결과 요약: 다음 분기에 관찰·검토할 수 있는 성장 evidence loop가 생깁니다.

## 관련 템플릿·품질 프로필·전문 역할

기존 Artifact의 템플릿과 선택된 Quality Profile을 그대로 사용하고, 필요 시 관련 전문 역할의 finding을 evidence와 decision record에 연결합니다. 시작점은 [템플릿 카탈로그](../templates.md)와 [문서 품질 프로필](../document-quality.md)입니다.

## 이미지·도식화 조건

템플릿의 image slot이 실제로 필요할 때만 [이미지 자산 흐름](../image-assets.md)으로 계획·생성을 분리합니다. 관계·흐름·상태를 보여 줄 때는 일반 삽화 대신 [Skillstead 도식화](../visualization.md)를 사용하며, 둘 다 필요 없으면 만들지 않습니다.

## 검토·승인 기준

검색일·지역·표본의 freshness와 blind spot을 보여 줍니다. project fact, candidate interpretation, 성장 추론과 다음 행동 제안을 구분합니다. unverified plan은 승진·합격·전환 readiness를 보장하지 않습니다.

## 실패·fallback·재개 방법

requirement source 또는 proof가 없으면 provisional ID와 verification task를 유지합니다. stale evidence의 기존 기록, stale 상태와 한계를 삭제하지 않고 보존합니다. `research-game-design-jobs`의 재수집·validator 재검증 뒤 새 evidence IDs가 downstream growth `requirementId`와 goal에 다시 결합된 후에만 재개합니다. contradictory feedback과 missing proof도 삭제하지 않습니다.

```text
$game-design-career:plan-junior-growth 기존 goalId와 eventId를 유지하고 새 mentor feedback만 연결해 re-evaluation부터 재개해.
```

## 다음 작업 요청문

**복사 가능한 CLI 후속 요청문**

```text
$game-design-career:plan-junior-growth 기존 Canonical Artifact와 decision/evidence 기록을 유지하고, 현재 blocker 또는 미확정 항목만 확인해 다음 검토 가능한 작업을 진행해.
```

## 관련 문서

[스킬 선택표](README.md), [템플릿 카탈로그](../templates.md), [문서 품질](../document-quality.md), [제품 workflow](../workflow.md)
