# Task 6 — Studio cutscene route and visual-preproduction skill

## Delivered

- Added the Studio-only `design-cutscene-visual-preproduction` skill through
  the official skill initializer, with generated `agents/openai.yaml` and
  trigger-only frontmatter.
- Added the closed Studio route and top-level `cutsceneWorkflow` metadata:
  `style-master → reference-masters → keyframes → storyboard`, with the
  existing planning, approved-generation, and continuity-review handoffs.
- Added the Studio quality profile and index entry. Studio now has 23 routed
  skills, 16 direct skills, and 24 installed skills; Career remains 22 routed,
  15 direct, and 23 installed skills without the Studio cutscene skill/route.
- Documented immutable handoffs: content delegates cutscenes to the new skill,
  the general planner validates only, generation requires the current wave's
  live approval, and review requires the continuity gate without granting
  approval authority.
- Added product contracts for exact route shape, Korean trigger uniqueness,
  mode/wave/cost/approval/variant pressure semantics, quality-profile validity,
  Career absence, and temporary Studio/Career runtime/schema byte parity.

## RED evidence

Before implementation, the Task 6 product matrix failed the new contracts:
Studio had 13 routes and 22 routed skills, the cutscene skill/profile did not
exist, and the direct/installed inventory remained 15/23. The existing generic
image path safely made zero unapproved calls, but did not expose four current
cost-and-approval waves, dialogue-only overlay behavior, failed-ID retry, or
the continuity gate.

## Validation

- `quick_validate.py products/game-design-studio/plugin/skills/design-cutscene-visual-preproduction` → pass.
- `node --test tests/products/studio/cutscene-visual-preproduction.test.mjs` →
  5 passing, including temporary package parity for five shared runtime modules
  and five schemas.
- Focused Task 1–6 source matrix (cutscene unit/approval, Studio route/profile/
  core, shared contract) → 104 passing, 0 failing.
- JSON parse for routing, quality index, and cutscene profile; `git diff --check`
  → pass.

## Known unrelated suite state

The full product image matrix retains two pre-existing Career host-callback
failures in `tests/products/career/image-assets.test.mjs` (`host unavailable`
and `throw-secret-never-persist`). Task 6 changes no Career image runtime or
Career skill; the same two failures occurred in the initial RED matrix. They
remain outside this Studio-only route/skill scope and require their owning image
workflow task before that broader suite can be green.
