# Task 5 Report — Studio recipes and FAQ

## Status

Task 5와 Fix round 1이 완료되었습니다. 여섯 Studio recipe의 `예상 결과`는 section-local 결과 예시를 제공하고, Studio FAQ는 승인된 18개 질문에 실행 가능한 경계형 답변을 제공합니다. 이 문서는 renderer 결과나 사람 승인을 자동으로 보장하지 않습니다.

## BASE / HEAD

- BASE: `0bb24cd52b349512ab4b941f459b5dac5734a985`
- HEAD: Task 5 commit containing this report; confirm with `git rev-parse HEAD` after commit.

## Fix round 1

- BASE: `79004d119ce8c704605b794242b6e89c7c7e9dbb`
- HEAD: Fix round 1 commit containing this update; confirm with `git rev-parse HEAD` after commit.
- 해결 범위: 모든 primary Canonical Artifact 디렉터리에 `content.md`, `evidence.yml`, `decisions/README.md`, `assets/README.md`, `export-manifest.yml`을 tree 안에서 artifact-local로 표시했습니다. secondary artifact는 별도 디렉터리로 표시했으며, production export preparation은 별도 Canonical Artifact filename이 아닌 승인된 Artifact의 `export-manifest.yml`을 읽는 논리 결과로 명시했습니다.
- 결과 예시 계약: fenced Markdown block을 직접 검사해 substantive 내용, TODO/TBD/placeholder 부재, recipe별 semantic term을 요구합니다. block-only TODO 교체와 다른 recipe block-only 교체가 모두 실패합니다.
- FAQ 경계: H1/H2/H3 계층을 인식해 각 H3 답변이 중간 H2를 넘지 않게 했고, H2 삽입으로 남은 필드를 옮기는 mutation을 거부합니다.
- Open: 없음.

## Changed files

- `guides/game-design-studio/recipes/new-game-gdd.md`
- `guides/game-design-studio/recipes/system-feature-spec.md`
- `guides/game-design-studio/recipes/content-quest-design.md`
- `guides/game-design-studio/recipes/ux-accessibility.md`
- `guides/game-design-studio/recipes/economy-liveops.md`
- `guides/game-design-studio/recipes/production-review-export.md`
- `guides/game-design-studio/faq.md`
- `tests/contracts/user-guide-studio-diagrams.test.mjs`
- `tests/contracts/user-guide-use-case-manifest.test.mjs`

## RED / GREEN

- RED: `node --test tests/contracts/user-guide-studio-diagrams.test.mjs` failed because every existing recipe lacked the required four `예상 결과` H3 sections.
- RED: `node --test tests/contracts/user-guide-use-case-manifest.test.mjs` failed because `guides/game-design-studio/faq.md` did not exist.
- GREEN: recipe contract verifies four ordered, substantive, recipe-local output sections while preserving `recipeHeadings` and exactly one primary diagram.
- GREEN: FAQ contract requires the exact 18 approved Q headings; substantive conclusion/reason/request/result/related/safety fields; executable Studio request; related case/skill/template. It rejects an empty request, swapped valid answers, and a wrong question.
- RED (Fix round 1): recipe trees lacked artifact-local `assets/README.md` and other Canonical Artifact files; the FAQ parser accepted a Q answer split by an inserted H2.
- GREEN (Fix round 1): focused contracts reject shared project-root canonical files, non-substantive or cross-recipe fenced examples, and H2-split FAQ answers.

## Tests

- `node --test tests/contracts/user-guide-studio-diagrams.test.mjs` → 5 passed, 0 failed.
- `node --test tests/contracts/user-guide-use-case-manifest.test.mjs` → 24 passed, 0 failed.
- `node --check tests/contracts/user-guide-studio-diagrams.test.mjs` → passed.
- `node --check tests/contracts/user-guide-use-case-manifest.test.mjs` → passed.
- `git diff --check` → passed.
- Fix round 1 uses the same focused test commands; their fresh results are recorded with the fix commit.

## Concerns

Open concerns: none. Recipes still describe renderer-unavailable fallbacks without presenting PNG or derived formats as approved output, and the FAQ continues to keep human approval, rights, evidence, and policy boundaries explicit.
