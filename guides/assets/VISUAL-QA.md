# Shared Skillstead Visual QA

상태: **verified** — 2026-08-06에 Studio product wrapper로 lint, Chromium render, two-pass pixel review를 완료했습니다. SVG가 authority이고 PNG는 후처리하지 않은 Chromium 2× 파생물입니다.

## Renderer와 공통 검사

- 실행 파일: `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`
- 버전: `Google Chrome 151.0.7922.76`
- wrapper: `products/game-design-studio/plugin/skills/visualize-game-design/scripts/run-skillstead.mjs`
- lint: `node .../run-skillstead.mjs lint guides/assets/shared/*.svg` — 0 error, 0 warning
- render: `node .../run-skillstead.mjs render guides/assets/shared/<id>.svg guides/assets/shared/<id>.png`
- 모든 SVG viewBox: `0 0 1400 900`; 모든 PNG: `2800×1800` (정확히 2×, `sips` 재확인)

`view_image`로 각 PNG를 high detail(전체 보기)와 original detail(원본 해상도)에서 각각 확인했습니다. 모든 항목의 tofu(□), text overflow, clipped glyph, panel/card containment 실패는 없었습니다. 색상 대비는 light canvas와 semantic tinted card 위에서 판독 가능했고, 읽기 순서는 SVG의 `aria-label="읽기 순서 …"` group 순서와 일치했습니다.

| Diagram | Fit-to-page 검사 | Original/close-up 검사 | Connector·reading order | Source fidelity |
| --- | --- | --- | --- | --- |
| `plugin-selection-flow` | 3개 카드와 결론 strip이 즉시 좌→우로 읽힘 | Korean/Latin glyph 정상, overflow·containment 없음 | 36px 이상 shaft와 open-V head, card border에서 12px gap; 목적→제품→marketplace | Studio/Career installation의 제품 선택과 `game-design-suite`를 반영 |
| `app-cli-install-flow` | App/CLI 두 lane이 명확히 분리됨 | pill·카드·명령 label의 clipping/overflow 없음 | 각 lane이 좌→우; 36px shaft와 head, 12px gap | 두 installation guide의 App 새 채팅·CLI 새 세션을 반영 |
| `canonical-artifact-lifecycle` | 작성→검토→사람 결정과 하단 결과가 한 화면에 보임 | gate pill, 상태 문구, 하단 strip containment 정상 | 좌→우 승인 flow 뒤 하향 arrow; shaft/head 접합 정상 | Studio/Career workflow의 Canonical Artifact·전문 검토·사람 결정을 반영 |
| `image-generation-mode-routing` | 기본 `prompt-only`와 생성 mode 선택 rail이 분리되어 보임 | 모든 mode/status glyph 정상, rail·card overflow 없음 | prompt-only arrow는 shaft+head; 하단 rail은 순서를 암시하지 않는 의도적 선택 rail이며 select/required/all을 병렬로 배치 | 두 image-assets guide의 `prompt-only`, `select`, `required`, `all` 및 selection/manifest 경계를 반영 |
| `image-asset-lifecycle` | draft→review→approved→후속 review가 명확함 | reviewer pill·status·하단 strip 모두 containment 정상 | 좌→우 및 하향 단계; 36px 이상 shaft와 open-V head | 두 image-assets guide의 `concept-draft`, `document-approved`, `production-candidate` 및 named human review를 반영 |
| `document-export-flow` | preflight에서 MD/PDF/DOCX/PPTX 네 갈래가 즉시 보임 | format label·status text clipping/overflow 없음 | preflight 하향 arrow는 shaft+head; format bus는 동등한 결과 형식의 비방향 분기 rail | 두 exports guide의 renderer-neutral preflight, `pending`/`blocked`/`unavailable`, format별 QA를 반영 |

초기 lint 경고 하나(`plugin-selection-flow`의 `공통 marketplace 설치` text overflow 추정)는 label을 `marketplace 설치`로 줄인 뒤 재-lint하여 0 warning으로 해소했습니다.
