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
  "facts": ["전투 사양이 피해 유형 세 가지를 이름으로 정의한다"],
  "inferences": ["피해 유형별 대응 역할이 분리되어 있을 가능성이 높다"],
  "recommendations": [],
  "unknowns": ["밸런스 목표 수치는 사양에 공개되어 있지 않다"]
}
```

## 규칙

1. 최종 산출물을 내는 제품만 owner다. `returnToSkill`은 owner 제품의 대표 스킬과 같아야 한다.
2. 공급 제품은 요청받은 증거만 반환한다. 상대 도메인 결론을 내리거나 승인하지 않는다.
3. 공급 제품은 다시 인계를 시작할 수 없다. 한 요청당 인계는 한 번이다 — 요청 하나에 반환도 하나다.
4. 네 리스트가 모두 빈 반환은 답이 아니다. 찾은 것이 없으면 그 사실을 `unknowns`에 적는다. 빈 봉투를 돌려주면 소유 제품이 "증거가 도착했다"로 오해한다.

소유 제품은 반환된 증거를 자기 기준으로 사실·추론·제안으로 다시 나눈 뒤에만 쓴다. 공급 제품이 붙인 라벨을 그대로 승격하지 않는다.

## 상대 제품이 없을 때

제품 간 인계가 실제로 필요한 시점에 한 번만 확인한다. 세션 시작 훅은 건드리지 않는다. 이 확인은 반드시 거쳐야 한다. 인계가 필요하다고 적은 기록은 조회를 실제로 마친 뒤에만 공개한다. 상대 제품이 없는데도 "인계 필요"라고 적으면 사용자는 도착하지 않을 근거를 기다리게 된다. 반대로 공급 단계를 자기 제품의 일감으로 조용히 흡수하면 근거 없이 작업하게 된다.

조회는 자기 제품 패키지 루트에서 실행한다. 사용자 작업 디렉터리에서 상대 경로로 부르면 파일을 찾지 못하고 실패하며, 그 실패는 상대 미설치가 아니다. 패키지 루트는 지금 읽고 있는 이 파일 경로에서 `skills/<제품 id>/references/handoff.md`를 떼어 낸 자리다.

```
node <제품 패키지 루트>/scripts/inspect-game-design-plugin-updates.mjs --products
```

- 둘 다 설치됨: 인계를 진행한다.
- 상대 미설치: 증거를 지어내지 않는다. 자기 제품이 가진 것만으로 부분 완성하고 빠진 근거를 blocker로 남긴다. 설치 명령 한 줄과, 사용자가 직접 근거를 제공하는 대체 경로를 함께 제시한다.
- 상대 비활성: 설치돼 있어도 비활성이면 호스트가 그 스킬을 싣지 않으므로 조회 목록에 나오지 않는다. 조회 결과만으로는 미설치와 구분되지 않으니 같은 degrade를 적용하되, 안내에 활성화를 함께 넣는다. 이미 설치된 제품에 설치 명령만 내밀지 않는다.
- 확인 불가: 미설치와 같은 degrade를 적용하되 "확인 불가"라고 구분해 말한다.

조회가 실패했거나 결과 목록이 형식을 벗어나 신뢰할 수 없으면(항목 누락·중복 등) 확인 불가로 처리하며, 사용자 환경의 marketplace JSON에 BOM이 있을 수 있다고 진단만 안내한다. 사용자 파일을 자동으로 고치지 않는다.
