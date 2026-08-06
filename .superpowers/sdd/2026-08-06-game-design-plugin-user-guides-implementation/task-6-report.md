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
