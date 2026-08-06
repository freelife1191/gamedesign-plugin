# practice-game-design-interview

## 목적과 산출물

target posting과 portfolio evidence ID에 근거한 4종 질문, 답변 기록, evidence-qualified feedback와 honest-answer pattern을 만듭니다.

## 사용할 때

- 특정 공고의 required·preferred 항목을 기준으로 면접을 연습할 때
- 답변에서 개인 기여, 팀 결과, 선택·대안·결과를 분리할 때

## 사용하지 않을 때

- posting이 없는데 회사별 질문이나 요구를 사실로 만들 때
- 확인되지 않은 metric·ownership·implementation을 설득력 있는 답변으로 포장할 때

## 필수 입력과 선택 입력

- 필수: stable posting evidence IDs, portfolio evidence IDs, target role/level, answer claim
- 선택: previous feedback, objection focus, interviewer context
- current posting에는 검색일, 지역, 표본을 보존하고 사실·추론·제안을 분리합니다.

## Codex App 예시

**복사 가능한 요청문**

```text
@Game Design Career 이 시스템 기획 공고와 portfolio evidence ID로 base, follow-up, objection, situational 질문을 만들어. 답변의 claim·evidence·choice·alternative·result·reflection을 검토해.
```

## Codex CLI 예시

```text
$game-design-career:practice-game-design-interview posting=JP-12, portfolioEvidence=E-07,E-12, questionTypes=base,follow-up,objection,situational
```

## 진행 흐름

posting과 portfolio record를 inventory하고 stable IDs를 유지합니다. 각 question에 `postingEvidenceIds`, `portfolioEvidenceIds`와 `grounded|role-general|blocked` status를 붙입니다. 답변은 claim, evidence, choice, alternative, verified result 또는 `not-verified`, reflection으로 기록합니다.

## 결과와 파일

evidence inventory, ordered question records, answer-feedback records, blocked claims, verification tasks와 honest-answer patterns를 `interview-question-answer-log`에 남깁니다. 예상 결과 요약: 공고와 portfolio 근거를 다시 찾을 수 있는 면접 연습 기록이 생깁니다.

## 검토와 승인

검색일·지역·표본이 한정된 posting evidence임을 표시합니다. 관찰된 사실, candidate 해석, reviewer 추론과 답변 개선 제안을 구분합니다. 답변 연습은 합격을 보장하지 않습니다.

## 실패와 재개

posting이 없으면 posting-specific claim을 `blocked`로 유지하고 role-general question과 posting 확보 task만 만듭니다. missing result에는 “확인할 수 없는 X 대신 내 결정 Y와 evidence E-12를 설명한다” 같은 honest boundary를 씁니다.

```text
$game-design-career:practice-game-design-interview 기존 questionId를 유지하고 새 posting evidence JP-12를 연결해 blocked 질문부터 재개해.
```
