# 공통 Skillstead 시각 품질 검사

상태: **검증됨** — 2026-08-16에 Studio product wrapper로 lint, Chromium render, 두 단계 픽셀 검사를 완료했습니다. SVG가 편집 가능한 원본이고 PNG는 후처리하지 않은 Chromium 2× 파생물입니다.

## 렌더러와 공통 검사

- 실행 파일: `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`
- 버전: `Google Chrome 151.0.7922.138`
- wrapper: `products/game-design-studio/plugin/skills/visualize-game-design/scripts/run-skillstead.mjs`
- lint: `node .../run-skillstead.mjs lint guides/assets/shared/*.svg` — 오류 0건, 경고 0건
- render: `node .../run-skillstead.mjs render guides/assets/shared/<id>.svg guides/assets/shared/<id>.png`
- 모든 SVG viewBox: `0 0 1400 900`; 모든 PNG: `2800×1800` (정확히 2×, `sips` 재확인)

`view_image`로 각 PNG를 high detail(전체 보기)와 original detail(원본 해상도)에서 각각 확인했습니다. 모든 항목에서 tofu(□), 텍스트 넘침, 잘린 glyph, panel/card containment 실패가 없었습니다. 색상 대비는 밝은 canvas와 의미별 tinted card 위에서 판독 가능했고, 읽기 순서는 SVG의 `aria-label="읽기 순서 …"` group 순서와 일치했습니다.

| 도식 | 전체 보기 검사 | 원본 해상도 검사 | 연결선·읽기 순서 | 출처 충실도 |
| --- | --- | --- | --- | --- |
| `plugin-selection-flow` | 3개 카드와 결론 strip이 즉시 좌→우로 읽힘 | Korean/Latin glyph 정상, 넘침·containment 실패 없음 | 36px 이상 shaft와 open-V head, card border에서 12px gap; 목적→제품→marketplace | Studio/Career installation의 제품 선택과 `game-design-suite`를 반영 |
| `app-cli-install-flow` | App/CLI 두 lane이 명확히 분리됨 | pill·카드·명령 label의 clipping/overflow 없음 | 각 lane이 좌→우; 36px shaft와 head, 12px gap | 두 installation guide의 App 새 채팅·CLI 새 세션을 반영 |
| `canonical-artifact-lifecycle` | 작성→검토→사람 결정과 하단 결과가 한 화면에 보임 | gate pill, 상태 문구, 하단 strip containment 정상 | 좌→우 승인 흐름 뒤 하향 arrow; shaft/head 접합 정상, endpoint `y=664`에서 target `y=676`까지 12px gap | Studio/Career workflow의 Canonical Artifact·전문 검토·사람 결정을 반영 |
| `image-generation-mode-routing` | `생성 요청?` decision에서 no/default와 yes 분기가 즉시 구분됨 | 모든 mode glyph 정상, 카드·merge/footer strip overflow 없음 | yes는 bus center `x=880, y=375`로 연결되고 `select`/`required`/`all` center `x=640/880/1120`에 33px branch와 12px target gap으로 동등 분기; 네 결과가 하단 공통 경계로 merge됨 | 두 image-assets guide의 `prompt-only`, `select`, `required`, `all`, selection receipt 및 manifest 경계를 반영 |
| `image-provider-cost-routing` | 한글 여부와 무료 결과 검토에서 무료·유료 경로가 분명히 갈림 | 한글·영문 model/quality 글리프, 카드와 승인 pill의 clipping·overflow 없음 | prompt-only 하향 분기와 image_gen→결과 확인 경로를 분리하고, 한글 필요·반복 실패만 유료 제안과 사람 승인으로 연결 | 두 image-assets guide의 image_gen 우선, gpt-image-2 사용 제안, low 기본·medium 선택·high 예외와 승인 전 유료 호출 0회 경계를 반영 |
| `image-asset-lifecycle` | draft→review→approved→후속 review가 명확함 | reviewer pill·status·하단 strip 모두 containment 정상 | 좌→우 및 하향 단계; shaft/head 정상, endpoint `y=648`에서 target `y=660`까지 12px gap | 두 image-assets guide의 `concept-draft`, `document-approved`, `production-candidate` 및 named human review를 반영 |
| `document-export-flow` | preflight, 공통 상태 rail, MD/PDF/DOCX/PPTX 형식별 검증이 즉시 구분됨 | status pill·형식 label 모두 clipping/overflow 없음 | 공통 상태 arrow tip `y=488`→panel top `y=500`는 12px gap; panel bus `y=540`에서 네 card top `y=590`까지 endpoint `y=578`의 38px branch와 12px target gap으로 연속 분배 | 두 exports guide의 모든 공통 상태 `not-requested`/`blocked`/`pending`/`unavailable`과 MD canonical text, PDF page QA, DOCX OOXML QA, PPTX story/slide QA를 반영 |
| `project-memory-reuse-flow` | 설정→조회→재검증→현재 작업 참고→후보 검토의 주 경로와 비활성·제외 분기가 구분됨 | `.env`, 경로, Studio·Career 글리프와 모든 카드의 containment 정상 | 승인 기록만 주 경로로 보내고 비활성·오류와 부적합 기록은 하향 분기; 사람 결정 뒤 로컬 기록에서 다음 요청 조회로 되먹임 | 프로젝트 기억 가이드의 LLM Wiki 제한, 출처·범위 재검증, 사람 승인, `.game-design/memory/` 추가 전용 기록과 자동 전송 없음 경계를 반영 |

초기 lint 경고 하나(`plugin-selection-flow`의 `공통 marketplace 설치` text overflow 추정)는 label을 `marketplace 설치`로 줄인 뒤 재-lint하여 경고 0건으로 해소했습니다. Fix round 1에서는 전체 SVG를 다시 lint/render하고 모든 PNG를 두 단계로 재검사했습니다. Fix round 2에서는 영향을 받은 두 PNG를 canonical Chrome으로 재렌더하고 high/original 두 단계에서 bus·branch·target gap과 canvas containment를 재확인했습니다. 2026-08-16에는 새 이미지 제공자·비용 경로와 프로젝트 기억 재사용 흐름을 원본 해상도로 확인했으며, 첫 렌더에서 붐비던 분기 레이블과 화살표 끝점을 정리한 뒤 오류·경고 0건으로 다시 렌더했습니다.

## Studio recipe 도식 검사 — 2026-08-06

| 도식 | 전체 보기 검사 | 원본 해상도 검사 | 연결선·읽기 순서 | 출처 충실도 |
| --- | --- | --- | --- | --- |
| `studio-orchestration-map` | 중심 Artifact와 좌·우 도메인, 상·하 gate가 한 화면에서 즉시 읽힘 | CJK/Latin glyph, card containment, accent 대비 정상 | orchestrator→Artifact→도메인·검토의 명확한 화살표와 10px target gap | workflow와 orchestrate skill의 Canonical Artifact, pending gate, UX·systems·review route를 반영 |
| `vision-to-gdd-approval` | 비전→profile→artifact→승인→GDD 순서가 좌→우·하향으로 읽힘 | pill text와 GDD footer의 clipping·tofu·overflow 없음 | 2px shaft와 6px open-V, 승인에서 footer로 12px target gap | vision skill의 assumption 경계와 named Lead Designer gate를 반영 |
| `system-rule-state-exception-flow` | 네 단계와 하단 feedback·명세 artifact가 즉시 구분됨 | status, Korean glyph, footer containment 정상 | normal path는 좌→우; dashed feedback은 source `(1120,512)`→bus `y=570`→artifact target `(700,608)`으로, card top `y=620` 전 12px gap을 유지 | systems skill의 input, state, precedence, recovery, review contract를 반영 |
| `content-narrative-quest-map` | quest→content→state→production gate와 owner 결정이 한 화면에서 읽힘 | 긴 owner label과 rights/consent text의 clipping·overflow 없음 | 네 stage arrow와 production source `(1120,517)`→owner target `(1000,608)` 연결이 target card top `y=620` 전 12px gap을 유지 | content·systems·production skill의 quest, state, capacity, rights/consent 경계를 반영 |
| `economy-balance-liveops-loop` | source/sink→balance→experiment→rollback과 feedback loop가 명확함 | 상태·owner·hard No-Go 문구와 dashed loop의 판독성 정상 | normal arrow와 dashed rollback/recalibrate feedback을 분리; feedback target `(520,512)`은 economy card bottom `y=500`에서 12px gap | economy/LiveOps skill의 evidence, guardrail, stop, rollback, human approval을 반영 |
| `production-risk-review-flow` | scope→review→decision→export 준비와 fallback이 한 화면에서 읽힘 | title, gate pill, format status, fallback 문구의 clipping·tofu 없음 | ordered main path와 renderer fallback strip이 독립적으로 읽힘 | production·review·export guide의 hard No-Go, named decision, renderer-neutral 상태를 반영 |

## Career recipe 도식 검사 — 2026-08-06

| 도식 | 전체 보기 검사 | 원본 해상도 검사 | 연결선·읽기 순서 | 출처 충실도 |
| --- | --- | --- | --- | --- |
| `career-stage-routing` | 현재 단계→실제 event→전환 상태→경로 gate가 icon placeholder 없이 즉시 좌→우로 읽힘 | high/original에서 CJK/Latin glyph, non-icon card text, footer/status pill의 clipping·tofu·overflow 없음 | 각 40px corridor에서 2px shaft와 open-V가 명확하고 endpoint는 다음 card 10px 앞, gate→artifact는 12px target gap | workflow·주니어 성장 guide의 project event, alternative path, 사람 결정과 export state를 반영 |
| `role-gap-learning-roadmap` | current evidence→역할 gap→학습 과제→재평가가 빈 circle 없이 구분됨 | high/original에서 retrievalDate·region·sample boundary locator, footer label의 containment 정상 | main rail의 10px target gap과 충분한 shaft, 하향 connector의 12px target gap을 확인 | map guide의 current evidence metadata, learning roadmap의 proof task·cadence를 반영 |
| `job-research-evidence-flow` | 공식 공고에서 표본 경계와 역량 gap·project brief로 가는 경로가 명확함 | high/original에서 sourceUrl·retrievalDate·sample boundary와 reviewer pill의 overflow 없음 | ordered rail과 human review gate가 분리되어 읽히며 모든 target gap은 10px/12px | research guide의 official source, region, reviewAfter와 portfolio-project-brief handoff를 반영 |
| `reverse-design-portfolio-flow` | 공개 관찰→가설·반례→검증 queue→권리 gate 순서가 빈 circle 없이 명확함 | high/original에서 build/platform, counterexample, rights boundary의 CJK/Latin glyph와 footer containment 정상 | 네 main connector는 10px target gap과 읽을 수 있는 shaft를 유지하고 gate→artifact는 12px gap | reverse-engineer guide의 observation/inference/validation과 source rights boundary를 반영 |
| `portfolio-review-loop` | claim 근거→5축 검토→portfolio backlog→공개 gate가 빈 circle 없이 즉시 구분됨 | high/original에서 findingId·observationState, attribution·inspectability text의 clipping·tofu 없음 | 좌→우 rail과 하향 재검토 artifact connector의 open-V/shaft/10px·12px gap 정상 | portfolio build/review guide의 claim evidence, attribution, rights/privacy와 portfolio-backlog handoff를 반영 |
| `interview-growth-transition-flow` | current evidence→질문 record→답변 feedback→Coach gate가 빈 circle 없이 즉시 읽힘 | high/original에서 retrievalDate·region·sample boundary locator, questionId/evidence IDs/footer의 containment 정상 | main rail의 10px target gap, gate에서 footer의 12px gap 및 충분한 shaft를 확인 | interview·job research·portfolio review guide의 stable questionId, fresh evidence와 feedback cycle을 반영 |

## Audience learning-path 도식 검사 — 2026-08-06

- wrapper: `products/game-design-studio/plugin/skills/visualize-game-design/scripts/run-skillstead.mjs`
- browser: `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` — `Google Chrome 151.0.7922.76`
- 자동 검사: wrapper로 `aud-01.svg`부터 `aud-06.svg`까지 lint하여 `0 error(s), 0 warning(s) across 6 file(s)`를 확인했고, `npm run check:guide-diagrams`는 여섯 SVG/PNG 쌍의 source overflow, PNG 완결 IEND, 정확한 2× 렌더를 통과시켰습니다.
- PNG 치수: `sips`로 `aud-01.png` … `aud-06.png` 모두 `2800×1800`을 재확인했습니다.
- 수동 검사: `view_image` high detail로 `aud-01.png`을 확인했습니다. 제목·설명·4개 card·화살표·하단 사람 검토 경계가 즉시 읽히고 tofu, clipping, overflow, card containment 실패가 없습니다.
- 수동 검사: `view_image` original detail로 `aud-06.png`을 확인했습니다. 4개 card의 Korean/Latin glyph, 2px connector와 open-V arrowhead, 하단 경계 strip의 텍스트와 테두리에 잘림·겹침·overflow가 없습니다.
- 결론: 여섯 audience 도식은 모두 자동 overflow·PNG completion·2× 검사와 위의 지정 수동 검사를 통과했습니다. PNG는 wrapper가 생성한 파생물이며 수동 편집하지 않았습니다.

## Studio use-case 및 direct-skill 도식 검사 — 2026-08-06

- 범위: `game-design-studio-use-case` 18쌍(ST-C01…ST-C08, ST-G01…ST-G10)과 `game-design-studio-skill` 15쌍(ST-S01…ST-S15), 총 33 SVG/PNG 쌍입니다. 기존 `game-design-studio` recipe scope 6항목은 변경하지 않았습니다.
- 자동 검사: `npm run check:guide-diagrams`와 Studio 다이어그램 계약은 각 source의 Skillstead lint(오류 0·경고 0), 생성 SVG 동등성, PNG IEND 완결성과 정확한 `2800×1800` 치수를 확인합니다. 모든 SVG는 `0 0 1400 900` viewBox와 title/desc를 가집니다.
- 수동 검사: 로컬 `view_image`로 `st-c03.png`, `st-g01.png`, `st-g06.png`, 가장 긴 direct-skill flow인 `orchestrate-game-design-project.png`를 high와 original detail에서 각각 확인했습니다. 제목·설명·5개 순서 card·open-V connector·하단 다음 경계가 판독 가능하며, CJK/Latin glyph tofu, card/text overflow, 잘림, 겹침 또는 모호한 연결선이 없습니다.
- 출처 충실도: ST-C03은 authority→규칙 전이→예외 우선순위→데이터 계약, ST-G01은 수집 동기→경제 가설→guardrail→이벤트 검증, ST-G06은 선택→state delta→모순 확인→제작 결정, ST-S09는 복합 요청→필수 입력→route 선택→브리프 결과로 각 가이드의 실제 경계와 다음 route를 반영합니다.

## Studio Task 6 Fix round 1 재검사 — 2026-08-06

- `st-c03.png`: high/original에서 입력→전문 스킬→Canonical Artifact→검토→출력의 5개 card와 순서 connector를 확인했습니다. text/card containment와 하단 boundary가 정상입니다.
- `st-g01.png`, `st-g06.png`: high/original에서 제약→선택지의 두 branch→`재결합: 판단 기준`→결정→검증을 확인했습니다. 두 선택지 box와 색상 구분 connector가 판독 가능하며 clipping·tofu·모호한 endpoint가 없습니다.
- `orchestrate-game-design-project.png` (ST-S09): high/original에서 trigger→필수 입력→skill-owned work→output→next route 5 stage를 확인했습니다. Canonical Artifact output과 selected canonical route의 조건부 handoff가 분리되어 읽힙니다.
- 자동 증거: `npm run check:guide-diagrams`는 39 SVG/PNG 쌍의 deterministic SVG 및 PNG byte equality, Skillstead lint, 2× size, IEND completion을 통과했습니다.

## Studio Task 6 Fix round 2 재검사 — 2026-08-06

- `st-c03.png`: high/original에서 두 번째 card의 `design-game-systems`, Artifact card의 `system-specification`·`rule-exception-matrix`·`data-schema-table-contract`, 검토 card의 `review-game-design`을 각각 확인했습니다. 같은 exact ID가 하단 semantic rail에도 남아 있어 축소 화면에서도 specialist·output·review mapping이 판독됩니다.
- `st-g01.png`, `st-g06.png`: high/original에서 각 source의 고유 제약, 두 선택지와 detail, 판단 기준, 결정, 검증 문구를 확인했습니다. G01의 4→5 connector는 상단 card bottom에서 시작해 하단 card top 12px 전에 끝나는 수직 shaft/open-V이며, 이전의 baseline 횡단선이나 card overlap이 없습니다.
- `orchestrate-game-design-project.png` (ST-S09): `canonical-artifact`, installed skill ID, output ID와 아홉 canonical next route가 card/semantic rail에 모두 표시됩니다. 두 줄 route rail의 마지막 baseline은 footer 시작선 위에 있어 clipping·overlap이 없습니다.
- 자동 증거: 최종 `npm run check:guide-diagrams`는 Studio 33쌍과 전체 39쌍의 deterministic SVG/PNG, Skillstead lint, 2× size, IEND completion을 통과했습니다. 계약 테스트는 specialist/output/review·branch/validation·trigger/input/owned-work/output/next-route의 exact source 값을 비교하고 `전문 판단을 적용`, `대안 두 가지`, `artifact와 경계` placeholder를 거부합니다.

## Career use-case 및 direct-skill 도식 검사 — 2026-08-07

- 범위: `game-design-career-use-case` 18쌍(CA-C01…CA-C08, CA-T01…CA-T10)과 `game-design-career-skill` 15쌍(CA-S01…CA-S15), 총 33 SVG/PNG 쌍입니다. 기존 `game-design-career` recipe scope 6개는 변경하지 않았습니다.
- 자동 근거: `npm run build:guide-diagrams`가 72 SVG/PNG를 생성했고, Career 계약 테스트는 source/manifest/anchor/embed·Skillstead lint·IEND·정확한 `1400×900`/`2800×1800` 치수를 확인합니다. `npm run check:guide-diagrams`는 생성 SVG/PNG byte 동등성과 lint·render를 재검증합니다.
- 대표 수동 검사: `ca-c05.png`, `ca-t01.png`, `ca-t09.png`, 그리고 실제 source 텍스트 최대 길이(83자)의 `review-image-assets.png`(CA-S13)를 각각 `view_image`의 high와 original detail에서 확인했습니다. 네 도식 모두 제목·5 stage·open-V connector·semantic rail·footer의 순서와 source 의미가 일치하며, CJK/Latin tofu, 잘림, 겹침, 낮은 대비, 카드 containment 또는 connector endpoint 결함이 없습니다.
- 경계 확인: CA-C05는 공개 build/evidence→public-rights review→권리 제외→CA-C06/07, CA-T01은 상태 전이/예외→시스템 멘토→합격 비보장, CA-T09는 전이 가능 경험→Career 검토→이직 비보장, CA-S13은 stable asset ID/decisionReceipt→lifecycle review→export 조건을 표시합니다. 이는 승인 또는 채용·이직 결과의 보장이 아닙니다.

## Career Task 6 Fix round 1 재검사 — 2026-08-07

- `apply-document-quality-profile.png`(CA-S01): high/original에서 trigger·input·owned work·ordered outputs와 `map`·`research`·`selected` 조건부 route를 확인했습니다. rail/footer에는 reviewer·boundary·failure·preserve·human confirmation·resume·next condition 원문이 잘림 없이 남습니다.
- `ca-t01.png`, `ca-t02.png`: high/original 첫 검사에서 5번 card의 output/route 중복 표시가 card 아래로 내려가는 결함을 발견했습니다. output은 rail에 보존하고 card는 두 ordered route target만 한 줄로 표시하도록 교정한 뒤 다시 high/original로 확인했습니다. 두 branch, review owner, non-guarantee boundary, failure→preserve→confirm→resume footer가 겹침 없이 판독됩니다.
- `practice-game-design-interview.png`(CA-S09): 변경 후 semantic source 문자열이 가장 긴 Career skill입니다. high/original에서 fresh posting·stable questionId 확인, 기존 stale 기록 보존, answer-feedback 재개, growth/portfolio review route와 채용 비보장 경계를 확인했습니다.
- 자동 증거: Career 33개 임시 SVG lint는 오류 0·경고 0, 전체 `npm run check:guide-diagrams`는 72 SVG/PNG 동등성·2× 치수·IEND를 통과했습니다. 시각 QA 후 교정된 CA-T01…CA-T10은 공식 builder `--id` 단일 프로세스로 재생성했습니다.

## Career Task 6 Fix round 2 재검사 — 2026-08-07

- `apply-document-quality-profile.png`(CA-S01), `orchestrate-game-design-career.png`(CA-S06): high/original에서 각각 authority guide의 ordered route 10개와 9개를 확인했습니다. 5번 card는 전체 개수와 footer 위치만 안내하고, footer의 4줄/3줄에는 모든 `condition→installed skill ID`가 순서대로 남아 있습니다. `<selected-skill>` placeholder, 강제 가로 확대, card/footer overflow, clipping·겹침이 없습니다.
- 시각 교정: 첫 high 검사에서 CA-S01의 마지막 단일 route 줄이 `textLength`로 과도하게 늘어나는 문제를 발견해 footer route 전용 자연 폭 텍스트로 교정했습니다. original 검사에서 10/9개 route, next condition, reviewer·boundary·failure·preserve·confirmation·resume 의미가 containment 안에서 판독됨을 다시 확인했습니다.
- 계약/회귀: CA-S01/S06 source와 production contract는 authority guide의 정확한 route 조건·대상을 비교하며 각 조건/대상 mutation을 거부합니다. 일반 non-Career `decision-flow`는 정확히 두 branch만 허용하고 기존 두 branch 좌표 `[298, 505]`를 보존해 세 번째 branch가 `y=505`에 겹치는 경로를 fail-closed로 차단합니다.
- 자동 증거: 최종 Career 33개 build/check와 `npm run check:guide-diagrams`가 종료 코드 0으로 통과했고 전체 72 SVG/PNG의 deterministic byte equality, Skillstead lint, `2800×1800`, IEND 완결성을 확인했습니다. 기준 `fb0402ee5eebf008d567f4cec5bcb7784941ff5e` 대비 CA-S01/S06 4개 asset 외 예상 밖 drift는 0입니다.

## Integration Final QA — 2026-08-07

- 도구 신원: local `view_image`만 사용했고 browser는 열지 않았습니다. renderer는 `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` (`Google Chrome 151.0.7922.108`)이며, `products/game-design-studio/plugin/skills/visualize-game-design/scripts/run-skillstead.mjs`는 `shared/vendor/skillstead/svg-infographic/0.8.3`을 해석합니다. `vendor.lock.json`의 패키지 버전도 `0.8.3`입니다.
- 자동 검사: `npm run check:guide-diagrams`와 `npm run validate:guides`는 종료 코드 0입니다. 독립 인벤토리는 생성 source 72개, `diagram-manifest.json` 90개를 확인했습니다. wrapper로 72 SVG를 한 번에 lint하여 `check-svg: 0 error(s), 0 warning(s) across 72 file(s)`를 확인했습니다. 90 SVG 모두 `viewBox`/size `1400×900`, `role="img"`/`aria-label`, active content 없음이며 생성 72개는 추가로 `<title>/<desc>`를 가집니다. 90 PNG 모두 `2800×1800`, PNG signature, 단일·정확한 IEND 종료를 만족합니다.
- longest 선정 방법: 각 skill source를 `renderDiagramSvg`로 렌더한 뒤 실제 `<text>` 노드의 XML-decoded Unicode code point를 합산하고, 내림차순 후 ID 오름차순으로 동률을 해소했습니다. Studio 15개 중 `ST-S01`은 710자, Career 15개 중 `CA-S01`은 1,384자로 가장 길었습니다. 이 방식은 실제 card·semantic rail·footer의 line pressure를 포함합니다.

| ID | high 검사 | original 검사 | 관찰 |
| --- | --- | --- | --- |
| `AUD-01` | 통과 | 통과 | 4개 학습 card와 footer가 좌→우 계층으로 읽히며 glyph/tofu·overflow 없음 |
| `AUD-06` | 통과 | 통과 | 평가→기준→큐→피드백 순서, 대비와 open-V connector가 명확함 |
| `ST-C03` | 통과 | 통과 | 5개 competency card, exact artifact IDs와 semantic rail이 card/rail 안에 보존됨 |
| `ST-G01` | 통과 | 통과 | 두 선택지 branch가 재결합 기준으로 향하고 수직 4→5 connector도 12px target gap을 유지함 |
| `ST-S01` | 통과 | 통과 | Studio longest: trigger→입력→work→output→next route 및 9개 route rail이 잘림 없이 읽힘 |
| `CA-C05` | 통과 | 통과 | evidence→owned work→human review→boundary→output 흐름, 좌·우 semantic rail과 footer의 source 의미가 모두 containment 안에 있음 |
| `CA-T09` | 통과 | 통과 | 두 branch, Career reviewer, non-guarantee boundary와 failure/preserve/confirm/resume footer가 겹치지 않음 |
| `CA-S01` | 통과 | 통과 | Career longest: 10 ordered authority route와 reviewer·boundary·failure·resume rail/route footer가 완전하며, 압축된 작은 rail text도 누락·잘림 없음 |

- 공통 시각 판정: 8개 모두 high/original에서 CJK·Latin tofu, clipping, card overlap, connector endpoint 결함을 발견하지 못했습니다. connector는 충분한 shaft와 open-V head, card border 전 12px gap을 유지하며 제목/eyebrow/전체 route와 footer/semantic rail의 source fidelity 및 대비가 정상입니다.
- 수정: 없음. source와 manifest는 변경하지 않았고 QA evidence만 추가했습니다.
