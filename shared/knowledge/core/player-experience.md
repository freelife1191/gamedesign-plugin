# 플레이어 경험

## 정보 위계를 행동 순서에 맞춘다

```claim
{
  "id": "CORE-UX-001",
  "type": "evergreen",
  "basis": "synthesis",
  "guidance": "플레이어가 지금 알아야 할 정보, 곧 필요할 정보, 요청할 때 볼 정보를 구분하고 주요 행동의 시선·입력 순서에 맞춰 배치한다.",
  "sourceIds": ["systems-081b21e5d10c", "systems-18eb9d83c8c2", "systems-91d23bacb462"],
  "applicability": "HUD, 메뉴, 튜토리얼, 전투 텔레그래프의 정보 밀도와 우선순위를 정할 때 적용한다.",
  "counterexamples": ["정보 해석 자체가 퍼즐인 게임은 일부 정보를 의도적으로 분산할 수 있다."]
}
```
## 실패를 다음 선택의 정보로 만든다

```claim
{
  "id": "CORE-UX-002",
  "type": "evergreen",
  "basis": "synthesis",
  "guidance": "실패 피드백은 무엇이 일어났는지, 어떤 규칙 때문인지, 다음 시도에서 무엇을 바꿀 수 있는지를 구분해 전달한다.",
  "sourceIds": ["systems-91d23bacb462", "feedback-dae11a5c473c"],
  "applicability": "전투 패배, 입력 오류, 구매 실패, 진행 조건 미충족처럼 재시도가 예상되는 경험에 적용한다.",
  "counterexamples": ["서사적 미스터리에서는 원인을 즉시 모두 공개하지 않되 플레이어가 추론할 단서는 남긴다."]
}
```

## 접근성 선택을 핵심 설계와 함께 다룬다

```claim
{
  "id": "CORE-UX-003",
  "type": "contextual",
  "basis": "synthesis",
  "guidance": "정보를 색 하나에만 의존하지 않고 텍스트, 모양, 소리, 진동 등 대체 신호로 전달하며 입력·카메라·난이도 옵션을 목표 플레이어와 검증한다.",
  "sourceIds": ["systems-7a15bf57b0e2", "systems-18eb9d83c8c2"],
  "applicability": "플랫폼과 입력 장치가 다양하거나 폭넓은 플레이어를 대상으로 하는 제품에 적용한다.",
  "counterexamples": ["특정 감각 제약을 작품의 주제로 삼는 경험도 대체 경로가 작품 의도를 훼손하는지 별도 검토해야 한다."],
  "limitations": "구체 기능 목록은 장애 경험, 장르, 장치, 플랫폼 기준에 따라 달라진다. 당사자 테스트와 최신 플랫폼 지침을 대체하지 않는다."
}
```
