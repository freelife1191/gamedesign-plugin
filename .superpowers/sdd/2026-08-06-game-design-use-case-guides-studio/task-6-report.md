# Task 6 — Studio Skillstead diagram pairs

## Status

Fix round 5 완료. Studio use-case 18쌍과 direct-skill 15쌍은 각 5단계 semantic contract와 결정 분기를 갖는 editable SVG 및 2× PNG로 유지됩니다. Builder의 production load 경로는 canonical `routing.json`의 존재를 명시적 Studio capability boundary로 사용하여, 현재 Studio source 존재 여부와 관계없이 exact 33 source와 11 route의 독립 literal batch contract를 검증합니다.

## BASE / HEAD

- BASE: `b4f48e43633a1af22b9af9677d5baedaa1e54041`
- Round 0 implementation: `b48ac7a87f3a2967f9cb54c06193576d7448bf99`

## Fix round 1 findings addressed

- ST-C는 입력→전문 스킬→Canonical Artifact→검토→출력의 정확한 5 stage 및 source semantic의 installed specialist/output/review condition을 갖습니다.
- ST-G는 제약→선택지→판단 기준→결정→검증의 5 stage, 두 choice branch와 판단 기준으로의 재결합을 갖습니다.
- Skill flow는 trigger→필수 입력→skill-owned work→output→next route의 5 stage와 exact installed skill/output/next route를 갖습니다. ST-S09는 `canonical-artifact`와 canonical route skill IDs를 semantic metadata에 보존합니다.
- `--check`는 SVG뿐 아니라 deterministic renderer가 만든 PNG bytes도 비교하며, 완전하지만 다른 2800×1800 PNG regression을 거부합니다.
- 루트 보고서를 이 SDD task 경로로 이동했습니다.

## RED / GREEN

- RED: 5 stage가 없는 Studio source(`ST-C01: 4 !== 5`), branch renderer 부재, complete-but-different PNG가 check를 통과하던 문제를 unit/contract test로 재현했습니다.
- GREEN: source schema fail-closed validation, branch renderer, PNG byte equality 및 wrong-valid skill/output/next-route/branch mutation tests를 추가했습니다. unit 22개와 Studio contract 31개가 통과했습니다.

## 생성 수와 scope

- `game-design-studio-use-case`: 18쌍 (`st-c01`…`st-c08`, `st-g01`…`st-g10`)
- `game-design-studio-skill`: 15쌍 (`st-s01`…`st-s15`; 파일명은 exact installed skill ID)
- 기존 `game-design-studio` recipe scope 6개 manifest entry는 변경하지 않았습니다.

## Visual QA

ST-C03, ST-G01, ST-G06, 가장 긴 skill flow ST-S09를 high/original detail로 재검사했습니다. ST-C03/ST-S09의 5개 stage, ST-G01/ST-G06의 두 branch와 `재결합: 판단 기준`이 물리적으로 판독되며 CJK/Latin glyph, card containment, connector endpoint, 하단 boundary에 clipping·overlap·tofu가 없습니다. 분기형 4·5단계 카드에서 발견한 stage tag/title 겹침은 160px 카드와 분리한 baseline으로 보정 후 재생성했습니다. 상세 결과는 `guides/assets/VISUAL-QA.md`에 기록했습니다.

## Concerns / open

- 없음. 최종 handoff 전 `npm run check:guide-diagrams`, 관련 unit/contract test, 변경 JavaScript의 `node --check`, `git diff --check`를 다시 통과했습니다.

## Fix round 2 findings addressed

- ST-C의 specialist card, Artifact/output card, review card는 source의 exact installed skill ID·output IDs·`review-game-design`을 표시합니다. source contract는 허용 skill 목록의 `includes`가 아니라 C01…C08의 exact persisted mapping을 비교합니다.
- ST-G는 source의 고유 제약, 두 branch label/detail, 판단 기준, 결정, validation과 persisted exact specialist/output mapping을 표시합니다. `대안 두 가지` generic placeholder를 회귀 금지했습니다.
- 모든 ST-S는 trigger, required input, skill-owned work, output IDs, 조건부 next routes를 표시합니다. ST-S09는 `canonical-artifact`와 아홉 canonical route를 card/rail에 모두 보존합니다. `artifact와 경계` placeholder를 회귀 금지했습니다.
- G01 4→5 connector는 upper card bottom에서 lower card top 12px 전까지 수직 shaft를 유지하며, unit geometry assertion으로 고정했습니다.

## Fix round 2 RED / GREEN

- RED: specialist/output/route exact ID가 card에 렌더되지 않는 경우, G01의 4→5 baseline connector, ST-S09 semantic rail의 footer 충돌을 unit/contract assertions로 재현했습니다.
- GREEN: exact-text card rendering과 60px semantic rail을 적용하고 source의 required input·validation을 보강했습니다. wrong-valid specialist/output/route/branch mutation regression은 유지했고, placeholder ban과 visible-source semantics 검증을 추가했습니다.

## Fix round 2 Visual QA

`st-c03`, `st-g01`, `st-g06`, `st-s09` PNG를 high/original detail로 재확인했습니다. exact IDs, 고유 branch/validation, 수직 G01 connector, ST-S09의 9개 route rail이 판독 가능하며 clipping·overlap·tofu·card containment 실패가 없습니다. 상세 기록은 `guides/assets/VISUAL-QA.md`를 따릅니다.

## Fix round 3 — independent production contract

- `tooling/lib/studio-diagram-production-contract.mjs`에 source object에서 계산하지 않은 C01…C08, G01…G10, S01…S15의 literal expected table을 두고 builder의 source-load 경로에서 검증합니다.
- C는 exact specialist/output/review skill·condition, G는 specialist/output·constraint·두 branch label/detail·criterion·decision·validation, S는 owned skill·trigger·required input·output·next route/condition을 모두 exact 비교합니다.
- 별도 literal `routing.json` contract는 11 canonical route의 ID, target skill, requiredInputs, artifactType을 대조합니다. S의 route ID는 그 canonical target과 교차검증하고, boundary skill은 registry `skillIds` target만 허용합니다.
- persisted SVG 검증도 source 값 재검색 대신 위 expected table의 visible trigger/constraint/branch/criterion/decision/input/skill/output/route 값을 비교하고 세 generic phrase를 거부합니다.

## Fix round 3 RED / GREEN

- RED: `st-c01` specialist를 다른 valid installed skill로 바꿔도 이전 schema validator가 통과했습니다 (`Missing expected exception`).
- GREEN: builder production validator를 추가했습니다. 33개 persisted source의 exact table 대조와 177개 wrong-valid/generic mutation(8 C × 4, 10 G × 7, 15 S × 5)을 table-driven으로 실행합니다. C/G/S의 specialist/output/review, branch/validation, input/output/route replacement와 G branch 제거 및 source-visible placeholder 주입을 모두 거부합니다.

## Fix round 3 scope / open

- renderer, source JSON, SVG/PNG asset은 변경하지 않았습니다. 따라서 재생성·시각 QA는 round 2의 검증 결과를 보존하고, 이번 round는 production validation과 contract tests만 확장했습니다.
- Open concerns: 없음. `npm run check:guide-diagrams`는 39 SVG/PNG pair를 통과했고, 전체 Studio contract suite는 34/34를 통과했습니다. 최종 handoff에는 changed-JS `node --check`, `git diff --check`, `git show --check` 증거를 포함합니다.

## Fix round 4 — production batch and canonical routes

- Builder는 Studio scope가 있으면 `guides/assets/use-case-diagram-sources.json`과 `products/game-design-studio/plugin/references/routing.json`을 같은 production load에서 읽습니다. Batch validator는 C01…C08, G01…G10, S01…S15의 exact 33 ID set과 canonical route 11개를 누락·추가·중복 없이 검증합니다.
- 독립 route literal은 각 route의 `id`, 전체 `triggerIntents`, `skill`, `requiredInputs`, `artifactType`을 고정합니다. 배열 정책은 순서와 구성원이 모두 같은 `ordered-exact`이며 route collection 자체는 ID exact set으로 검증합니다.
- 기존 S contract의 `routeIds`를 실제 사용하여 canonical route target이 해당 persisted S source의 owned skill과 같은지 교차검증합니다. 모든 S `semantic.next_routes`와 canonical route target은 실제 registry `skillIds` membership을 통과해야 합니다.
- Source별 independent literal 검증과 177개 wrong-valid/generic mutation은 batch 마지막 단계에서 그대로 실행됩니다. Renderer, source JSON, persisted SVG/PNG는 변경하지 않았습니다.

## Fix round 4 RED / GREEN

- RED: production builder mutation 11개와 production batch cross-contract 2개를 추가했습니다. 기존 global duplicate-source 방어 1개를 제외한 신규 12개가 정확히 실패했으며, 누락 source는 unknown ID로만 실패하고 canonical route mutation은 routing을 읽지 않은 채 이후 manifest load로 진행하는 기존 결함을 재현했습니다.
- GREEN: source 누락·추가·중복, route 누락·추가·중복, trigger replacement·누락, target skill, requiredInputs, artifactType, S routeId target mismatch, 미설치 boundary nextRoutes를 모두 production build/load 또는 production batch 호출에서 fail-closed로 검증합니다. Targeted regression은 13/13, 전체 builder unit은 26/26, focused Studio contract는 34/34를 통과했습니다.

## Fix round 4 verification / scope

- `npm run check:guide-diagrams`: 39 SVG 및 39 PNG의 visible expected, deterministic PNG byte equality, output path/symlink/temp safety를 포함해 통과했습니다.
- 기존 산출물은 재생성하거나 수정하지 않았습니다. 변경 범위는 production contract, builder load, 관련 unit/contract regression, 이 보고서뿐입니다.

## Fix round 5 — capability boundary and builder integration

- Builder는 source 내용의 `parsed.some(Studio scope)`가 아니라 canonical `products/game-design-studio/plugin/references/routing.json` 존재 여부를 Studio production capability boundary로 사용합니다. 따라서 routing contract가 있는 저장소에서는 Studio source가 0개여도 batch validator가 항상 실행되고, routing contract가 없는 임시 일반 repo fixture는 기존 동작을 유지합니다.
- Canonical routing을 보존한 채 Studio source 33개를 모두 삭제하고 non-Studio source만 남긴 디스크 fixture는 exact missing 33 ID `TypeError`로 거부됩니다.
- 기존 helper-level S `routeIds`→canonical target/owned skill mismatch와 uninstalled boundary `nextRoutes` 검증에 각각 실제 source/routing JSON을 mutation하는 production builder fixture를 추가했습니다. Builder load는 고유 오류 `st-s02 routeIds mismatch: vision targets define-game-vision, not design-game-systems`와 `st-s14 nextRoutes target svg-infographic is absent from installed skillIds`를 그대로 전파합니다.

## Fix round 5 RED / GREEN

- RED: all-Studio-missing builder fixture 1개는 expected exact missing 33 ID 대신 이후 manifest load의 `ENOENT`를 받아 1 fail/2 pass로 재현됐습니다. 이는 source-derived gate가 batch 호출을 생략한 직접 증거입니다. 두 cross-contract builder fixture는 기존 load 경로가 이미 고유 batch 오류를 전파함을 확인했습니다.
- GREEN: capability gate 한 곳을 routing contract 존재 검사로 바꾼 뒤 targeted builder fixture 3/3, 전체 builder unit 29/29, focused Studio contract 34/34가 통과했습니다.

## Fix round 5 scope

- Renderer, source JSON, SVG/PNG asset은 변경하지 않았습니다. Production builder와 builder unit regression, 이 보고서만 변경했습니다.

## Fix round 5 verification

- `npm run check:guide-diagrams` → 39 SVG / 39 PNG checked.
- Changed JavaScript `node --check`와 `git diff --check`가 exit 0이며, 변경 파일은 production builder, builder unit test, 이 보고서의 3개뿐입니다.
