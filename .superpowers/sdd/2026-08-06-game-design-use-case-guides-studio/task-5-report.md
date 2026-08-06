# Task 5 Report — Studio recipes and FAQ

## Status

Complete. Six Studio recipe `예상 결과` sections now contain section-local concrete output guidance, and Studio FAQ provides all 18 approved questions with executable, bounded answers.

## BASE / HEAD

- BASE: `0bb24cd52b349512ab4b941f459b5dac5734a985`
- HEAD: Task 5 commit containing this report; confirm with `git rev-parse HEAD` after commit.

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

## Tests

- `node --test tests/contracts/user-guide-studio-diagrams.test.mjs` → 5 passed, 0 failed.
- `node --test tests/contracts/user-guide-use-case-manifest.test.mjs` → 24 passed, 0 failed.
- `node --check tests/contracts/user-guide-studio-diagrams.test.mjs` → passed.
- `node --check tests/contracts/user-guide-use-case-manifest.test.mjs` → passed.
- `git diff --check` → passed.

## Concerns

None. The recipes describe renderer-unavailable fallbacks without presenting PNG or derived formats as approved output, and the FAQ keeps human approval, rights, evidence, and policy boundaries explicit.
