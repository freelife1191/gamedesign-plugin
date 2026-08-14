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

## Fix round 1 — retry journal and discovery narrowing

### Baseline and RED

- Reviewer final recorded C0/I2/M0: the skill and generation handoff promised a
  new/subset retry estimate even though the frozen v2 journal accepts only the
  still-current full-wave estimate, pricing snapshot, request schedule, and
  remaining reserve. The cutscene description also triggered on generic
  `prompt`/`continuity`, while game-content did not explicitly exclude cutscene
  work.
- The forward RED product contract failed three checks: the broad cutscene
  frontmatter, the non-exclusive content frontmatter, and the stale retry
  handoff wording. The existing public runtime already failed pricing/estimate
  drift closed; a new regression proves that result without a provider call or
  journal mutation.

### Forward result

- The Studio skill and `generate-image-assets` now state that a retry reuses
  the same still-current full-wave estimate, pricing snapshot, and request
  schedule; it never creates a subset estimate. A stale receipt needs fresh
  named live approval for that exact current estimate. Drift or expiry remains
  provider-0 fail-closed because a new journal epoch/replan is unsupported by
  the current runtime. Both handoffs show remaining approved worst-case and
  `retryReserve` as current cost status.
- New public runtime contracts prove changed pricing/estimate with an existing
  journal returns `cutscene.usage_receipt_corrupt`, makes zero provider calls,
  and leaves the journal snapshot unchanged; a fresh named approval with the identical
  full-wave authority retries only the failed ID and preserves successful bytes.
- Discovery is now constrained to qualified 컷씬/시네마틱 visual-preproduction
  prompt/continuity work. The executable corpus accepts cutscene master-image
  prompt, cinematic storyboard, and cutscene continuity requests, while
  rejecting generic prompts, gameplay continuity, and quest dialogue.

### Fix validation

- Forward retry public-runtime tests → 2 passing, 0 failing.
- Focused Task 1–6 and Studio/Career product matrix → 130 passing, 0 failing,
  including source core/image/contracts and temporary Studio/Career runtime and
  schema byte parity.
- `quick_validate.py` → pass. The Career image suite was re-run unchanged and
  still has the same two pre-existing host-callback failures documented above
  (29 passing, 2 failing); Fix round 1 does not touch that runtime or product.
