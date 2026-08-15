# Task 5 — Overlay, continuity, and derived lifecycle

## Delivered

- `buildVariantOverlay` is a pure, closed planner API. It validates canonical
  trigger/change data, rejects duplicate `(shotId, kind)` changes, preserves
  dialogue-only image identity, and emits one deterministic derivative ID per
  affected shot without colliding with base storyboard IDs.
- Public `findCutsceneImpact` remains exactly `{waveIds,assetIds}`. Its private
  per-wave projection makes the seed wave exact and downstream waves complete;
  invalidation records each wave's own intersection while retaining estimate,
  approval, and attempt evidence.
- Continuity review creates a closed receipt bound to current plan and manifest
  projections. It accepts only real style/reference master assets and produces
  literal safe finding IDs, codes, paths, affected IDs, and sorted blockers.
- Continuity gate and lifecycle require canonical plan waves, current manifest
  bindings, receipt digests, no blockers, completed waves, and human
  production-candidate readiness. They do not transition approvals or touch
  artifacts, journals, providers, or hosts.
- The continuity schema now requires `manifestSha256`; runtime/schema parity
  and temporary Studio/Career package-byte parity cover it.

## Validation

RED checks observed the expected missing planner export, multiple derivatives
for one shot, open impact shape, forged review manifest, and completed-wave
splice behavior before their corresponding GREEN changes.

`node --test tests/unit/cutscene-visual-preproduction.test.mjs tests/unit/cutscene-generation-approval.test.mjs tests/unit/generate-openai-images.test.mjs tests/unit/image-asset-plan.test.mjs tests/unit/image-assets.test.mjs tests/unit/image-config.test.mjs tests/unit/image-prompts.test.mjs tests/unit/image-provider.test.mjs tests/unit/smoke-openai-image.test.mjs tests/products/studio/image-assets.test.mjs`

Result: **189 passing, 0 failing**. The matrix uses injected fixtures only; no
live provider, host, or network call ran.

`node --check` passed for the three modified runtime modules. The continuity
schema parses, temporary Studio/Career builds contain byte-identical continuity
and usage schemas, and `git diff --check` passed.

## Limits

- Task 5 intentionally does not dispatch variants or modify Task 4's append-only
  journal. A visual variant remains metadata until a later approved generation
  stage consumes it.

## Fix round 1 — review closure

- A wave with both a direct changed asset and an upstream dependency now receives
  the conservative full downstream asset set. Repeated invalidation appends the
  prior record to closed `invalidationHistory`, retaining reason and affected
  IDs while avoiding an invalid `invalidated → invalidated` transition.
- Overlay and review begin with descriptor-only plain-data snapshots. Accessor,
  proxy, symbol, cyclic, and non-finite inputs fail as deterministic hostile
  input before a getter can run.
- Completed waves require a closed `completion` whose IDs exactly equal that
  wave's IDs. Gate also checks that invariant independently. Receipt cutscene
  identity now binds to the current plan in both gate and derived lifecycle.
- Continuity review rejects repeated `(shotId, kind)` observations before
  constructing its canonical, self-validated receipt.

Fix validation: the Task 1–5 plus Task 4 regression matrix passed **193/193**;
schema parse, runtime syntax checks, temporary Studio/Career schema parity, and
diff checks passed. Tests use injected fixtures only.

## Fix round 2 — transparent Proxy input boundary

- `snapshotCutscenePlainData` now uses `node:util` `types.isProxy` before any
  reflective, prototype, or descriptor operation. A transparent Proxy is
  rejected as `cutscene.hostile_input` at its stable path without running a
  trap.
- Public `findCutsceneImpact` and `invalidateCutsceneDependents` now snapshot
  their complete input before accessing `plan`, `changedAssetIds`, or `reason`.
  Their pre-snapshot boundary also rejects top-level accessors, symbols, and
  cycles deterministically.
- Public overlay, review, impact, and invalidation regressions prove zero Proxy
  trap and getter executions. Existing descriptor, symbol, and cycle checks
  remain covered.

Fix validation: a fresh Task 1–5 plus Task 4 regression matrix passed
**195/195**. All three runtime modules passed `node --check`; visual-plan,
continuity, and usage schemas parsed; the temporary Studio/Career package-byte
parity test passed; and `git diff --check` passed. Tests use injected fixtures
only; hostile-input regressions make no live provider, host, or network call.
