# Task 6 — Studio Skillstead diagram pairs

## Status

완료. Studio use-case 18쌍과 direct-skill 15쌍, 총 33개의 editable SVG 및 2× PNG를 생성·등록하고 각 문서에 정확히 하나의 paired embed를 추가했습니다.

## BASE / HEAD

- BASE: `b4f48e43633a1af22b9af9677d5baedaa1e54041`
- HEAD: 커밋 후 아래 갱신

## RED / GREEN

- RED: `node --test tests/contracts/user-guide-use-case-manifest.test.mjs`에서 새 Studio diagram 계약이 `Studio case diagram source count: 0 !== 18`로 실패했습니다. 이는 33개 Studio source가 없던 상태를 검증합니다.
- GREEN: 33개 source, manifest registration, SVG/PNG와 문서 paired embed를 추가한 뒤 focused 계약 테스트는 `1 pass, 0 fail`(재렌더 포함 100.7초), 관련 contract suite는 `30 pass, 0 fail`로 통과했습니다.

## 생성 수와 scope

- `game-design-studio-use-case`: 18쌍 (`st-c01`…`st-c08`, `st-g01`…`st-g10`)
- `game-design-studio-skill`: 15쌍 (`st-s01`…`st-s15`; 파일명은 exact installed skill ID)
- 생성기 전체 검사: 39 SVG, 39 PNG (기존 audience 6쌍 포함)
- 기존 `game-design-studio` recipe scope 6개 manifest entry는 변경하지 않았습니다.

## 시각 QA 증거

로컬 `view_image`로 `st-c03.png`, `st-g01.png`, `st-g06.png`, 가장 긴 direct-skill flow인 `orchestrate-game-design-project.png`를 high와 original detail로 검사했습니다. CJK/Latin glyph, title/desc, 4개 순서 card, connector, 결론 strip에서 잘림·겹침·tofu·모호한 연결이 없었습니다. 상세 기록은 `guides/assets/VISUAL-QA.md`에 있습니다.

## 검증

- `node --test --test-name-pattern='Studio case and direct-skill diagrams' tests/contracts/user-guide-use-case-manifest.test.mjs` → 1 pass, 0 fail
- `node --test tests/contracts/user-guide-use-case-manifest.test.mjs tests/contracts/user-guide-studio-diagrams.test.mjs` → 30 pass, 0 fail
- `npm run check:guide-diagrams` → 39 SVG, 39 PNG checked
- `git diff --check` → clean

## Concerns

- 없음. PNG는 생성기와 canonical Chromium wrapper가 만든 파생물이며 수동 편집하지 않았습니다.
