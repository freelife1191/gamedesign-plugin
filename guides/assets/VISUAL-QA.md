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
| `image-generation-mode-routing` | `생성 요청?` decision에서 no/default와 yes 분기가 즉시 구분됨 | 모든 mode glyph 정상, 카드·merge/footer strip overflow 없음 | no/default→`prompt-only`; yes→`select`/`required`/`all`; 네 결과가 하단 공통 경계로 merge됨 | 두 image-assets guide의 `prompt-only`, `select`, `required`, `all`, selection receipt 및 manifest 경계를 반영 |
| `image-asset-lifecycle` | draft→review→approved→후속 review가 명확함 | reviewer pill·status·하단 strip 모두 containment 정상 | 좌→우 및 하향 단계; shaft/head 정상, endpoint `y=648`에서 target `y=660`까지 12px gap | 두 image-assets guide의 `concept-draft`, `document-approved`, `production-candidate` 및 named human review를 반영 |
| `document-export-flow` | preflight, 공통 상태 rail, MD/PDF/DOCX/PPTX 형식별 검증이 즉시 구분됨 | status pill·형식 label 모두 clipping/overflow 없음 | preflight 하향 arrow는 shaft+head; format bus는 4개 동등 형식으로 분기 | 두 exports guide의 모든 공통 상태 `not-requested`/`blocked`/`pending`/`unavailable`과 MD canonical text, PDF page QA, DOCX OOXML QA, PPTX story/slide QA를 반영 |

초기 lint 경고 하나(`plugin-selection-flow`의 `공통 marketplace 설치` text overflow 추정)는 label을 `marketplace 설치`로 줄인 뒤 재-lint하여 경고 0건으로 해소했습니다. Fix round 1에서는 전체 SVG를 다시 lint/render하고 모든 PNG를 두 단계로 재검사했습니다.
