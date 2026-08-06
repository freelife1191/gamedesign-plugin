# Task 6 실행 보고서

## 범위

- Studio end-to-end recipe 6개와 대응 Skillstead SVG/Chrome PNG pair 6개를 추가했다.
- manifest에 `game-design-studio` scope의 6개 entry를 추가하고, source/usedBy를 repository 내 regular file의 manifest-relative path로 연결했다.
- Studio README와 guide root index에 recipe link를 추가하고, shared visual QA 결과는 변경하지 않고 Studio 행 6개만 append했다.

## RED → GREEN 증거

### RED

```text
node --test tests/contracts/user-guide-studio-diagrams.test.mjs
ENOENT: guides/game-design-studio/recipes/new-game-gdd.md
actual Studio diagrams: []
expected six Studio diagram IDs
```

### GREEN

```text
node --test tests/contracts/user-guides-studio.test.mjs tests/contracts/user-guide-studio-diagrams.test.mjs
pass 6 / fail 0

node tooling/validate-user-guides.mjs
guides: PASS {"guides":60,"skillGuides":30,"templates":30,"svg":0,"png":0}
```

## 도식 검증

- `run-skillstead.mjs lint guides/assets/game-design-studio/*.svg` → 6 files, error 0, warning 0.
- Chrome renderer: `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` (`Google Chrome 151.0.7922.76`).
- 여섯 PNG는 모두 `2800×1800`, SVG `1400×900` viewBox의 정확한 2×다.
- `view_image` high(전체)와 original(상세)로 각 PNG를 점검했다. CJK/Latin glyph, text/card containment, accent contrast, shaft+open-V arrowhead, dashed feedback 및 읽기 순서를 확인했다.
- 픽셀 검사에서 발견한 `vision-to-gdd-approval` footer target 범위와 `production-risk-review-flow` title 폭을 SVG 원본에서 수정하고, lint·Chrome render를 다시 실행했다.

## 최종 위생 검사

```text
git diff --check
exit 0
```

## 범위 외 항목

- 구조 도식에는 imagegen을 사용하지 않았다.
- Career diagrams 또는 기존 shared QA 행은 수정하지 않았다.

## Fix round 1 — 2026-08-06

### RED → GREEN

- 강화한 `user-guide-studio-diagrams` 계약은 기존 `new-game-gdd`의 누락된 `$game-design-studio:apply-document-quality-profile` CLI namespace를 RED로 포착했다.
- CLI 요청문을 명시 namespace 4개로 수정한 뒤 recipe contract 및 image-pair contract가 GREEN이 됐다.
- 계약 테스트는 이제 recipe별 expected skill table, Artifact path family, template, App 요청, four IMAGE_GEN_MODE branch, named approver, renderer fallback, 정확한 8개 heading 순서를 section-scoped로 검사한다.
- 같은 테스트가 shared Skillstead `parseViewBox`, `isCompletePng`, `pngDims`를 사용해 Studio SVG viewBox `1400×900`, PNG IEND 완전성, `2800×1800` exact 2×와 product wrapper lint를 6 pair 모두 자동 검사한다.

### README와 시각 교정

- Studio README에 manifest consumer인 `studio-orchestration-map`과 `vision-to-gdd-approval` PNG 링크를 추가했다.
- `system-rule-state-exception-flow`: dashed feedback은 `(1120,512) → y=570 → (700,608)`으로 `system-specification` card top `y=620`의 12px 앞에 도착한다.
- `content-narrative-quest-map`: production gate에서 owner card 내부 `(1000,608)`으로 재라우팅해 target top `y=620`의 12px gap을 유지한다.
- `economy-balance-liveops-loop`: rollback feedback target `(520,512)`이 economy card bottom `y=500`에서 12px gap을 유지한다.
- 영향받은 세 PNG를 canonical Chrome 151 wrapper로 다시 렌더해 모두 `2800×1800`임을 확인하고 `view_image` high/original로 connector shaft, target gap, CJK glyph와 containment를 재검사했다.

## Fix round 2 — 2026-08-06

### RED → GREEN

- production handoff fixture는 `$game-design-studio:plan-image-assets`와 `$game-design-studio:visualize-game-design` namespace가 누락되어 RED가 됐고, 강화 suite는 recipe fallback이 `실패와 재개` section에 없던 회귀도 포착했다.
- production CLI 요청문에 두 namespace를 추가하고, 여섯 recipe의 `실패와 재개`에 Chromium/renderer/capability unavailable 조건, Canonical Artifact와 기존 owner output 보존, PNG `unavailable` 상태를 함께 기록해 GREEN으로 전환했다.
- recipe expected table은 모든 recipe의 main skills, Artifact path family 배열, template 배열, named approver 배열을 검사한다. economy와 production의 두 Artifact family, production의 세 approver 및 image/visualize/export handoff를 포함한다.

### Lint 출력 계약

- wrapper lint 검사는 exit code뿐 아니라 `spawnSync`으로 stdout/stderr를 캡처해 각 pair의 `check-svg: 0 error(s), 0 warning(s) across 1 file(s)` summary를 요구한다.
- 작은 fixture test는 warning 1건이 있는 summary가 이 parser를 통과하지 못함을 확인한다.
