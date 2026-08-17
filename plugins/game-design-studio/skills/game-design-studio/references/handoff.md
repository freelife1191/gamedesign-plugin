# Suite Handoff Contract

두 제품이 함께 필요한 요청을 처리하는 단방향 계약이다. 최종 산출물을 내는 제품만 owner이고, 상대 제품은 요청받은 증거만 돌려준다. 한 요청에 인계는 한 번이다.

<!-- suite-handoff-contract:start -->
```json
{
  "schemaVersion": 1,
  "requestKind": "suite-handoff-request-v1",
  "returnKind": "suite-handoff-return-v1",
  "products": ["game-design-career", "game-design-studio"],
  "entrySkills": {
    "game-design-career": "game-design-career",
    "game-design-studio": "game-design-studio"
  },
  "requestedOutputs": [
    "system-evidence-summary",
    "content-evidence-summary",
    "production-constraint-summary",
    "career-target-profile"
  ],
  "requestKeys": [
    "schemaVersion",
    "kind",
    "ownerProduct",
    "supplierProduct",
    "requestedOutputs",
    "sourceArtifactIds",
    "returnToSkill"
  ],
  "returnKeys": [
    "schemaVersion",
    "kind",
    "ownerProduct",
    "supplierProduct",
    "facts",
    "inferences",
    "recommendations",
    "unknowns"
  ],
  "maxHandoffsPerRequest": 1
}
```
<!-- suite-handoff-contract:end -->

## 요청 봉투

```json
{
  "schemaVersion": 1,
  "kind": "suite-handoff-request-v1",
  "ownerProduct": "game-design-career",
  "supplierProduct": "game-design-studio",
  "requestedOutputs": ["system-evidence-summary"],
  "sourceArtifactIds": ["combat-spec"],
  "returnToSkill": "game-design-career"
}
```

## 반환 봉투

```json
{
  "schemaVersion": 1,
  "kind": "suite-handoff-return-v1",
  "ownerProduct": "game-design-career",
  "supplierProduct": "game-design-studio",
  "facts": [],
  "inferences": [],
  "recommendations": [],
  "unknowns": []
}
```

## 규칙

1. 최종 산출물을 내는 제품만 owner다. `returnToSkill`은 owner 제품의 대표 스킬과 같아야 한다.
2. 공급 제품은 요청받은 증거만 반환한다. 상대 도메인 결론을 내리거나 승인하지 않는다.
3. 공급 제품은 다시 인계를 시작할 수 없다. 한 요청당 인계는 한 번이다.

소유 제품은 반환된 증거를 자기 기준으로 사실·추론·제안으로 다시 나눈 뒤에만 쓴다. 공급 제품이 붙인 라벨을 그대로 승격하지 않는다.

## 상대 제품이 없을 때

교차가 실제로 필요해진 시점에만 한 번 확인한다. 세션 시작 훅을 건드리지 않는다.

```
node scripts/inspect-game-design-plugin-updates.mjs --products
```

- 둘 다 설치됨: 인계를 진행한다.
- 상대 미설치: 증거를 지어내지 않는다. 자기 제품이 가진 것만으로 부분 완성하고 빠진 근거를 blocker로 남긴다. 설치 명령 한 줄과, 사용자가 직접 근거를 제공하는 대체 경로를 함께 제시한다.
- 확인 불가: 미설치와 같은 degrade를 적용하되 "확인 불가"라고 구분해 말한다.

조회 자체가 실패하면 사용자 환경의 marketplace JSON에 BOM이 있을 수 있다고 진단만 안내한다. 사용자 파일을 자동으로 고치지 않는다.
