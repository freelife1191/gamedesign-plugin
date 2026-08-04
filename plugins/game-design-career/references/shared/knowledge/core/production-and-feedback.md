# 제작과 피드백

## 피드백 질문을 평가 축으로 분리한다

```claim
{
  "id": "CORE-FEEDBACK-001",
  "type": "evergreen",
  "basis": "synthesis",
  "guidance": "리뷰와 플레이테스트 질문을 의도 전달, 재미 가설, 구현 가능성, 가독성, 차별성으로 나누고 관찰 사실과 해석을 따로 기록한다.",
  "sourceIds": ["feedback-e5efb2a71d59", "feedback-0c5154dada61", "feedback-dae11a5c473c"],
  "applicability": "기획서 리뷰, 프로토타입 테스트, 역기획 피드백에서 의견을 실행 가능한 문제로 바꿀 때 적용한다.",
  "counterexamples": ["초기 발산 회의에서는 평가를 늦추고 아이디어 양을 늘리는 시간이 따로 필요할 수 있다."]
}
```
## 가장 싼 검증물부터 만든다

```claim
{
  "id": "CORE-PRODUCTION-001",
  "type": "evergreen",
  "basis": "synthesis",
  "guidance": "가장 불확실한 가설을 식별하고 종이 규칙, 표, 클릭 더미, 회색 상자 등 그 가설만 검증할 수 있는 최소 산출물을 선택한다.",
  "sourceIds": ["career-7143bd076592", "systems-36de174a60ce", "feedback-dae11a5c473c"],
  "applicability": "일정과 인력이 제한된 초기 제작, 기능 승인, 위험 축소에 적용한다.",
  "counterexamples": ["네트워크 지연이나 실제 장치 성능이 핵심 위험이면 저충실도 모형만으로 검증할 수 없다."]
}
```

## 변경 결정과 되돌림 조건을 남긴다

```claim
{
  "id": "CORE-PRODUCTION-002",
  "type": "contextual",
  "basis": "synthesis",
  "guidance": "변경마다 해결하려는 문제, 가설, 성공 신호, 부작용 지표, 책임자, 적용 범위, 되돌림 조건을 기록한다.",
  "sourceIds": ["feedback-0c5154dada61", "career-bb96738f8af9"],
  "applicability": "여러 직군이 병렬로 작업하거나 라이브 제품을 반복 개선할 때 적용한다.",
  "counterexamples": ["개인 탐색용 일회성 스케치는 간단한 실험 노트로 충분하다."],
  "limitations": "결정 기록의 양식과 승인 단계는 조직 규모 및 배포 위험에 맞춰 줄이거나 늘려야 한다."
}
```
