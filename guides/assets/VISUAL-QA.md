# 공통 Skillstead 시각 품질 검사

상태: **검증됨** — 2026-08-06에 Studio product wrapper로 lint, Chromium render, 두 단계 픽셀 검사를 완료했습니다. SVG가 편집 가능한 원본이고 PNG는 후처리하지 않은 Chromium 2× 파생물입니다.

## 렌더러와 공통 검사

- 실행 파일: `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`
- 버전: `Google Chrome 151.0.7922.76`
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
| `image-asset-lifecycle` | draft→review→approved→후속 review가 명확함 | reviewer pill·status·하단 strip 모두 containment 정상 | 좌→우 및 하향 단계; shaft/head 정상, endpoint `y=648`에서 target `y=660`까지 12px gap | 두 image-assets guide의 `concept-draft`, `document-approved`, `production-candidate` 및 named human review를 반영 |
| `document-export-flow` | preflight, 공통 상태 rail, MD/PDF/DOCX/PPTX 형식별 검증이 즉시 구분됨 | status pill·형식 label 모두 clipping/overflow 없음 | 공통 상태 arrow tip `y=488`→panel top `y=500`는 12px gap; panel bus `y=540`에서 네 card top `y=590`까지 endpoint `y=578`의 38px branch와 12px target gap으로 연속 분배 | 두 exports guide의 모든 공통 상태 `not-requested`/`blocked`/`pending`/`unavailable`과 MD canonical text, PDF page QA, DOCX OOXML QA, PPTX story/slide QA를 반영 |

초기 lint 경고 하나(`plugin-selection-flow`의 `공통 marketplace 설치` text overflow 추정)는 label을 `marketplace 설치`로 줄인 뒤 재-lint하여 경고 0건으로 해소했습니다. Fix round 1에서는 전체 SVG를 다시 lint/render하고 모든 PNG를 두 단계로 재검사했습니다. Fix round 2에서는 영향을 받은 두 PNG를 canonical Chrome으로 재렌더하고 high/original 두 단계에서 bus·branch·target gap과 canvas containment를 재확인했습니다.

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
