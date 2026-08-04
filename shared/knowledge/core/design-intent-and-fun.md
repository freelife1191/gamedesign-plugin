# 기획 의도와 재미

이 문서는 원문을 대체하지 않는다. 서로 다른 사례에서 반복되는 판단 틀만 추출하며, 아래 `claim` 블록이 근거와 적용 한계를 기계가 읽을 수 있게 보존한다.

## 목표 경험을 먼저 문장으로 고정한다

```claim
{
  "id": "CORE-INTENT-001",
  "type": "evergreen",
  "basis": "synthesis",
  "guidance": "기능을 나열하기 전에 대상 플레이어, 반복해서 느끼게 할 감정, 그 감정을 만드는 선택과 피드백을 한 문장으로 정의한다. 후보 기능이 목표 경험에 기여하는 플레이어 행동을 설명하지 못하면 축소하거나 검증 실험으로 돌린다.",
  "sourceIds": ["fun-intent-e0ecc16c96ef", "fun-intent-f9540b5f5892", "fun-intent-d1898c8bfe41"],
  "applicability": "새 기능, 전투, 퀘스트, 경제, UX를 동일한 목표 경험 아래 정렬할 때 적용한다.",
  "counterexamples": ["의도적으로 서로 충돌하는 감정을 다루는 실험작은 단일 감정 문장보다 장면별 긴장 구조가 적합하다."]
}
```

## 재미 가설을 행동 고리로 번역한다

```claim
{
  "id": "CORE-FUN-001",
  "type": "evergreen",
  "basis": "synthesis",
  "guidance": "재미를 추상 명사로 끝내지 말고 목표, 선택, 행동, 상태 변화, 즉시 피드백, 다음 목표로 이어지는 검증 가능한 고리로 표현한다.",
  "sourceIds": ["fun-intent-431ba5a7f4d6", "fun-intent-0244c5d1fe29", "fun-intent-c111efe374ce"],
  "applicability": "핵심 루프를 설계하거나 플레이테스트 관찰 항목을 만들 때 적용한다.",
  "counterexamples": ["관조형 경험처럼 반복 루프보다 해석과 분위기가 중심인 작품은 장면 전환과 감각 변화로 가설을 표현할 수 있다."]
}
```

## 동기와 몰입은 플레이어마다 다르게 검증한다

```claim
{
  "id": "CORE-MOTIVATION-001",
  "type": "contextual",
  "basis": "synthesis",
  "guidance": "보상, 숙련, 서사, 사회적 관계 중 어떤 동기가 목표 플레이어에게 작동하는지 가정하고 관찰 가능한 행동과 이탈 신호로 검증한다.",
  "sourceIds": ["fun-intent-6ec9ec1a4048", "fun-intent-c111efe374ce"],
  "applicability": "진행 구조, 장기 목표, 세션 복귀 동기를 설계할 때 적용한다.",
  "counterexamples": ["짧은 일회성 작품에서는 장기 잔존보다 한 세션의 완결감이 우선일 수 있다."],
  "limitations": "동기 유형과 선호는 장르, 문화, 숙련도, 플레이 맥락에 따라 달라지며 원문 사례를 보편 심리 법칙으로 취급하지 않는다."
}
```
