# review-game-design-portfolio

## 목적과 산출물

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

## Codex App 예시

**복사 가능한 요청문**

```text
@Game Design Career 이 portfolio를 recruiter 관점 5축으로 검토해. finding마다 section/evidence ID, observation state, impact와 가장 작은 repair를 연결해.
```

## Codex CLI 예시

```text
$game-design-career:review-game-design-portfolio artifact=artifacts/system-portfolio, audience=recruiter, axes=all
```

## 진행 흐름

5축을 독립 검토하고 stable `findingId`와 정확히 하나의 `axisId`에 `contradiction`, `unsupported-certainty`, `duplication`, `unclear-scope`, `missing-sources` finding을 기록합니다. 각 `observationState`는 `not-observed|no-defect|defect-observed` 중 하나입니다. score는 section과 evidence IDs가 모두 inspectable할 때만 부여합니다.

## 결과와 파일

evidence inventory, five-axis records, typed findings, evidence-qualified scores, highest-impact repair queue와 verification tasks를 `five-axis-review` 또는 `portfolio-backlog`에 남깁니다. 예상 결과 요약: 다음 review를 가능하게 하는 작은 수정 순서가 생깁니다.

## 검토와 승인

`not-observed`는 `no-defect`가 아니고 score 0은 evidence completeness일 수 있으며 능력 0을 뜻하지 않습니다. 사람이 publication/privacy와 최종 수정 채택을 결정합니다. review는 합격을 보장하지 않습니다.

## 실패와 재개

source가 inaccessible이면 score를 `not-scored`로 유지하고 exact verification task를 남깁니다. 기존 finding ID와 conflicting advice를 보존합니다.

```text
$game-design-career:review-game-design-portfolio 기존 findingId를 유지하고 새 evidence E-19로 not-observed 축만 다시 검토해.
```
