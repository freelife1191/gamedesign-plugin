# 시스템 설계

## 규칙을 상태 전이로 쓴다

```claim
{
  "id": "CORE-SYSTEM-001",
  "type": "evergreen",
  "basis": "synthesis",
  "guidance": "각 규칙을 입력, 선행조건, 처리 규칙, 상태 변화, 출력, 플레이어 피드백으로 분해하고 실패 경로도 함께 정의한다.",
  "sourceIds": ["systems-261c6a2eecb9", "systems-6ea849b1b848", "systems-36de174a60ce"],
  "applicability": "전투, 성장, 제작, 상점, 매칭처럼 상태를 바꾸는 모든 시스템에 적용한다.",
  "counterexamples": ["순수 장식 연출은 상태 전이보다 트리거, 지속시간, 중단 조건만으로 충분할 수 있다."]
}
```
## 예외의 우선순위를 명시한다

```claim
{
  "id": "CORE-SYSTEM-002",
  "type": "evergreen",
  "basis": "synthesis",
  "guidance": "일반 규칙과 예외 규칙이 충돌할 때 적용 순서, 동률 처리, 취소와 롤백, 상한과 하한을 명시한다.",
  "sourceIds": ["systems-6ea849b1b848", "systems-ff8425610394", "systems-fdf0a6081a21"],
  "applicability": "버프 중첩, 피해 계산, 자원 소비, 퀘스트 조건처럼 규칙 조합이 늘어나는 영역에 적용한다.",
  "counterexamples": ["규칙이 하나뿐인 초기 종이 프로토타입에서는 우선순위 표보다 사례 몇 개가 더 경제적이다."]
}
```

## 규칙·UI·데이터를 같은 이름으로 연결한다

```claim
{
  "id": "CORE-SYSTEM-003",
  "type": "contextual",
  "basis": "synthesis",
  "guidance": "기획 용어, UI 표시, 데이터 키, 로그 이벤트가 같은 개념을 가리키도록 매핑 표를 유지하고 소유자와 변경 영향을 기록한다.",
  "sourceIds": ["systems-7a15bf57b0e2", "systems-7afc52eaadf0", "systems-f88fbb6e2ff0", "systems-7ccf322de528"],
  "applicability": "여러 직군이 같은 기능을 구현하고 운영 데이터까지 연결하는 팀에 적용한다.",
  "counterexamples": ["한 사람이 폐기 가능한 프로토타입을 만드는 동안에는 최소 이름 규칙만으로 충분할 수 있다."],
  "limitations": "표 형식과 문서 소유 방식은 엔진, 조직, 데이터 파이프라인에 따라 달라진다. 특정 원문의 양식을 표준으로 강제하지 않는다."
}
```
