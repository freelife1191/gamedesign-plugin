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

## Fix round 2 — serial predecessor dispatch guard

### Baseline and RED

- The forward test found that a fully current cost schedule and live approval
  could dispatch `keyframes` before `reference-masters`, or `storyboard`
  before `keyframes`; explicit retry read its journal before enforcing serial
  completion. Three new public tests reproduced those paths.

### Forward result

- `runApprovedCutsceneImageWave` and `retryCutsceneFailedAssets` share the
  `assertCurrent` predecessor guard. Before any journal/artifact I/O or
  provider dispatch, every earlier wave must be `completed` and have an exact
  `{kind:"completed", assetIds}` set. Missing state rejects with stable
  `cutscene.predecessor_wave_incomplete` and the exact plan wave-state path.
- The regressions prove keyframes/reference-masters, storyboard/keyframes, and
  retry all make zero provider calls and leave the complete artifact snapshot,
  including journal contents, unchanged. Existing full predecessor completion
  still permits storyboard dispatch and the reference-wave public retry.

### Limit

- This guard enforces serial state authority only; existing plan validation,
  request binding, approval, cost-cap, journal, and continuity gates retain
  responsibility for their own closed contracts. No live provider or network
  call was made by this fix.

### Fix validation

- Task 4/6 plus Studio/Career source matrix → 238 passing, 0 failing,
  including temporary Studio/Career shared runtime/schema parity.

## Fix round 3 — hostile predecessor snapshot boundary

### Baseline and RED

- The Fix 2 predecessor guard read raw `state` and `completion` before the
  existing safe plan boundary. A public getter could write
  `getter-write.txt`; Proxy and unsafe-descriptor paths could reach dispatch.
  Its filesystem snapshot also ignored empty directories, symlinks, and file
  type information. Completion failures all reported the same asset-ID path.

### Forward result

- `assertCurrent` now calls the existing `snapshotCutscenePlainData(plan)` as
  its first plan operation and passes only that copy to predecessor checking,
  authority validation, approval validation, and dispatch. Getter, Proxy,
  symbol, cycle, and unsafe-descriptor plans fail with
  `cutscene.hostile_input` before provider or journal/artifact I/O.
- Whole-tree snapshots now retain directory, regular-file bytes, symlink target,
  and other file-type evidence. Missing completion, wrong completion kind, and
  stale completion asset IDs return distinct stable code/path pairs.

### Limit

- The public request wrapper itself remains the existing API boundary; this
  repair snapshots the validated `plan` payload before predecessor reflection.
  It does not expand authority or introduce any provider/network call.

### Fix validation

- Task 4/5/6 plus Studio/Career source matrix → 240 passing, 0 failing,
  including temporary Studio/Career shared runtime/schema parity.

## Fix round 4 — hostile public envelope boundary

### Baseline and RED

- The predecessor snapshot protected the nested `plan`, but both exported
  entrypoints still observed their outer input first: initial dispatch read
  `input.plan`, and retry destructured/rest-spread raw input. An outer getter
  or Proxy could therefore write an artifact marker before the guard; symbols,
  non-enumerable fields, and accessors were not closed at this public boundary.
- The forward RED contracts reproduced those side effects for initial and retry
  and showed that deleted and `undefined` predecessor completions did not both
  return the stable missing-completion diagnostic.

### Forward result

- Both public APIs now accept one raw argument and first copy only an explicit
  allowlist of enumerable data descriptors after `types.isProxy` rejection.
  Symbols, non-enumerable fields, accessors, unknown keys, and Proxy input fail
  `cutscene.hostile_input` at stable paths without evaluating a getter. Opaque
  callback, capability, and receipt values remain data values and are never
  cloned or invoked by this envelope step.
- Explicit retry now uses a private boolean path instead of destructuring or
  spreading raw input. Revalidation continues to use the same safe envelope,
  current plan snapshot, approval, cost, journal, and predecessor checks.
- Missing predecessor completion is normalized for deleted, `undefined`, and
  `null` values at `/completion`; wrong kind and asset-set mismatch retain their
  precise `/completion/kind` and `/completion/assetIds` diagnostics.

### Fix validation

- New real-filesystem public tests cover initial and retry plan getters,
  transparent Proxy traps, symbol, non-enumerable, and accessor envelopes:
  each returns `cutscene.hostile_input`, has zero provider calls/traps/journal
  writes, and preserves files, directories, symlinks, types, and bytes.
- Focused Task 4/5/6 plus Studio/Career source matrix → 240 passing, 0 failing,
  including normal callback/authority, initial/retry, and temporary
  Studio/Career shared runtime/schema byte-parity coverage. No live calls.

## Fix round 5 — root plan presence boundary

### Baseline and RED

- Allowing nested `undefined` in the safe plan snapshot accidentally also
  admitted an `undefined` root. Consequently `runApprovedCutsceneImageWave({})`,
  retry with `{}`, an own `plan: undefined`, a missing own plan, and an
  inherited-only plan could reach a raw `plan.mode` TypeError.

### Forward result

- `assertCurrent` now requires an own, defined `plan` on the already-normalized
  envelope before snapshotting and returns `cutscene.hostile_input` at `/plan`.
  `snapshotCutscenePlainData` again rejects an undefined root while retaining
  safe nested `undefined`, so the predecessor guard still reports deleted,
  undefined, and null completion as its stable missing-completion diagnostic.

### Fix validation

- New real-filesystem public contracts cover empty, own-undefined, missing-own,
  and inherited-only root plans for initial and retry; all have provider 0 and
  full-tree equality. Relevant Task 4/5/6 plus Studio/Career matrix → 167
  passing, 0 failing, including temporary package schema/runtime parity. No live
  calls.
