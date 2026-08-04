# 근거와 최신성

## 주장 단위를 작게 유지한다

```claim
{
  "id": "CORE-EVIDENCE-001",
  "type": "evergreen",
  "basis": "synthesis",
  "guidance": "한 claim에는 독립적으로 반증하거나 갱신할 수 있는 한 가지 지침만 두고, 근거 ID와 적용 범위와 반례를 함께 기록한다.",
  "sourceIds": ["feedback-dae11a5c473c", "systems-ff8425610394"],
  "applicability": "Core 지식, 리뷰 체크리스트, 설계 의사결정 기록을 유지할 때 적용한다.",
  "counterexamples": ["단순 용어 정의는 반례보다 명시적 범위 정의가 더 중요할 수 있다."]
}
```

## 사실·종합·현재 외부 주장을 구별한다

```claim
{
  "id": "CORE-EVIDENCE-002",
  "type": "evergreen",
  "basis": "synthesis",
  "guidance": "원문에 직접 있는 사실은 source-fact, 여러 근거를 엮은 지침은 synthesis, 정책·시장·도구의 현재 상태는 current-external-claim으로 표시한다.",
  "sourceIds": ["feedback-0c5154dada61", "feedback-dae11a5c473c"],
  "applicability": "근거 강도와 갱신 책임을 독자가 구분해야 하는 모든 지식 항목에 적용한다.",
  "counterexamples": ["개인 아이디어 메모는 정식 claim으로 승격하기 전까지 근거 분류를 생략할 수 있다."]
}
```

## 맥락과 시간에 맞춰 재검토한다

```claim
{
  "id": "CORE-FRESHNESS-001",
  "type": "contextual",
  "basis": "synthesis",
  "guidance": "안정 원칙은 evergreen, 사례·조직 의존 조언은 contextual, 정책·법률·플랫폼·시장·현재 도구는 time-sensitive로 분류해 필수 메타데이터와 재검토 시점을 다르게 적용한다. 로컬 원문과 현재 공식 근거가 충돌하면 source-conflict를 기록하고 현재형 주장은 공식 근거를 우선한다. 법률·규제 자료는 준수 판정이 아니라 법무 검토 trigger로 사용한다. reviewAfter가 지나면 재확인 전까지 의사결정 근거로 사용하지 않는다는 경고를 붙인다.",
  "sourceIds": ["career-3b9cabd3bc3a", "career-880924f0c787", "systems-7ccf322de528"],
  "applicability": "서로 다른 수명의 지식을 한 저장소에서 유지할 때 적용한다.",
  "counterexamples": ["프로젝트 내부의 고정된 역사 기록은 최신성보다 변경 불가능한 당시 상태의 보존이 우선이다."],
  "limitations": "분류는 절대적이지 않다. 제품·지역·조직이 바뀌면 evergreen으로 보이던 지침도 contextual로 재분류할 수 있다."
}
```
