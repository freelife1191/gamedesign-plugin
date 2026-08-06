# review-game-design-portfolio

## 목적과 최종 산출물

portfolio 또는 case study를 recruiter 관점의 5축으로 검토해 evidence-qualified score, typed findings와 minimum-repair backlog를 만듭니다.

## 사용할 때

- portfolio의 문제 정의, 설계 추론, 구현 구체성, evidence quality, communication inspectability를 검토할 때
- 지원·mentoring 전 가장 영향 큰 수정 순서를 정할 때

## 사용하지 않을 때

- 접근할 수 없는 항목을 결함 없음으로 처리할 때
- 시각적 polish로 competence, authorship나 impact를 추론할 때

## 필수 입력과 선택 입력

- 필수: stable section IDs, evidence IDs, review audience와 inspectable source
- 선택: target posting, previous findings, scoring purpose와 publication deadline
- unavailable item은 `not-observed`로 남기고 evidence completeness와 candidate ability를 분리합니다.

## Codex App 요청 예시

**복사 가능한 요청문**

```text
@Game Design Career 이 portfolio를 recruiter 관점 5축으로 검토해. finding마다 section/evidence ID, observation state, impact와 가장 작은 repair를 연결해.
```

## Codex CLI 요청 예시

```text
$game-design-career:review-game-design-portfolio artifact=artifacts/system-portfolio, audience=recruiter, axes=all
```

## 내부 진행 흐름

5축을 독립 검토하고 stable `findingId`와 정확히 하나의 `axisId`에 `contradiction`, `unsupported-certainty`, `duplication`, `unclear-scope`, `missing-sources` finding을 기록합니다. 각 `observationState`는 `not-observed|no-defect|defect-observed` 중 하나입니다. score는 section과 evidence IDs가 모두 inspectable할 때만 부여합니다.

## 생성 파일과 결과 구조

evidence inventory, five-axis records, typed findings, evidence-qualified scores, highest-impact repair queue와 verification tasks를 `five-axis-review` 또는 `portfolio-backlog`에 남깁니다. 예상 결과 요약: 다음 review를 가능하게 하는 작은 수정 순서가 생깁니다.

## 관련 템플릿·품질 프로필·전문 역할

- Template ID: `five-axis-review` — [five-axis-review 템플릿](../templates.md#five-axis-review).
- Quality Profile ID: `portfolio-review-backlog`.
- Reviewer/role ID: `portfolio-reviewer · evidence-auditor`.

이 조합은 [문서 품질 프로필](../document-quality.md)의 선택 기록과 함께 유지하며, profile을 새로 고르지 않는 경우는 위처럼 현재 artifact 상속 사유를 명시합니다.

## 이미지·도식화 조건

리뷰는 새로운 illustration을 만들지 않습니다. evidence dependency가 복잡하면 `skillstead-portfolio-dependency-diagram`을 Skillstead로 만들 수 있고, 부족한 image slot은 별도 plan으로 handoff합니다.

[이미지 자산 흐름](../image-assets.md)과 [도식화 안내](../visualization.md)의 승인·검증 경계를 따릅니다.

## 검토·승인 기준

`not-observed`는 `no-defect`가 아니고 score 0은 evidence completeness일 수 있으며 능력 0을 뜻하지 않습니다. 사람이 publication/privacy와 최종 수정 채택을 결정합니다. review는 합격을 보장하지 않습니다.

## 실패·fallback·재개 방법

source가 inaccessible이면 score를 `not-scored`로 유지하고 exact verification task를 남깁니다. 기존 finding ID와 conflicting advice를 보존합니다.

```text
$game-design-career:review-game-design-portfolio 기존 findingId를 유지하고 새 evidence E-19로 not-observed 축만 다시 검토해.
```

## 다음 작업 요청문

> `<artifact-path>`, `<export-manifest-path>`, `<selected-skill>`은 실제 경로·ID로 바꿔야 하는 자리표시자입니다. [공통 규칙](../../README.md#용어)을 따릅니다.

**복사 가능한 다음 handoff**

@Game Design Career build-game-design-portfolio로 현재 Artifact의 검증된 기록을 이어 다음 작업을 진행해.

```text
$game-design-career:build-game-design-portfolio artifact=<artifact-path> 기존 evidence/decision을 보존하고 다음 handoff를 실행해.
```

## 관련 문서

[five-axis-review 템플릿](../templates.md#five-axis-review), [build-game-design-portfolio 스킬](./build-game-design-portfolio.md), [스킬 선택표](README.md), [제품 workflow](../workflow.md)
