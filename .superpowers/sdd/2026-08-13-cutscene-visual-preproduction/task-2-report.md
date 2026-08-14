# Task 2 Report — Sole-writer Cutscene Manifest

## Outcome

Implemented the cutscene visual-preproduction planner, immutable handoff branch, prompt package
binding, and DAG-based dependent invalidation. The planner is the only cutscene caller of the
general image planner and owns stable IDs, DAG hash, prompt hashes, approval-binding hashes, and
the closed manifest workflow. The normal image planning branch remains unchanged when no cutscene
manifest is supplied.

## TDD evidence

- RED: `node --test --test-name-pattern='prompt-only|handoff|preserves handed-off' tests/unit/cutscene-visual-preproduction.test.mjs tests/unit/image-assets.test.mjs`
  failed with `ERR_MODULE_NOT_FOUND` for `shared/scripts/plan-cutscene-visual-preproduction.mjs`.
- GREEN: the same focused command passed after the planner and handoff branch were implemented.
- Full GREEN: `node --test tests/unit/cutscene-visual-preproduction.test.mjs tests/unit/image-assets.test.mjs tests/products/studio/image-assets.test.mjs` passed: 70 tests, 0 failures.

## Files

- Added the cutscene planner, generation policy, six concrete planning templates, and report.
- Extended the image workflow with a validation-only `cutsceneManifest` handoff path.
- Extended image-manifest runtime/schema bindings and storyboard prompt contract.
- Updated Studio handoff guidance and unit/product tests.

## Self-review

- Prompt Only returns expected artifact-relative reference paths without fabricated image hashes.
- Generation-ready binding uses `readSecureReferenceFile`, therefore current regular PNG bytes are
  hashed only after secure artifact-local loading.
- The handoff branch validates and writes the caller-supplied manifest without compiling prompts,
  invoking the general planner, or changing IDs, DAG/prompt/approval hashes.
- `invalidateCutsceneDependents` calls the single forward traversal in
  `findCutsceneImpact`; waves outside the impact closure are cloned unchanged.
- `git diff --check` and syntax checks for changed scripts passed.

## Risks / follow-up

- Later generation/approval tasks must consume the generation-ready package and retain the
  existing wave state machine; this task intentionally makes no provider call.
- Invalidation marks affected waves `invalidated`; the established validator governs the later
  `invalidated → cost-estimated` re-estimation transition.

## Fix 1 — Manifest binding and recursive workflow closure

- RED: `node --test --test-name-pattern='binding reads|plan-derived|symlink|general image planning|optional prompt digests' tests/unit/cutscene-visual-preproduction.test.mjs tests/unit/image-assets.test.mjs` failed four cases: binding attempted future reference paths, plan-derived mutations reached reference loading, symlink input surfaced raw file I/O, and nested cutscene waves were open in runtime/schema validation.
- GREEN: the focused command passed 5/5. Binding now validates the full manifest before reference I/O, derives wave IDs, DAG hash, prompt text/hash, and approval binding solely from the validated plan, and rejects deviations before opening a reference.
- Real-FS tests prove the bound digest equals the master PNG bytes, symlink input is rejected, and a deterministic rename identity swap fails at the pinned-reference verification boundary. Only assets already marked `generated` are consumed; future outputs are never created for binding.
- Public image-manifest runtime validation and JSON Schema now recursively close `cutsceneWorkflow` and wave `{id,assetIds}` records with parity coverage. The no-cutscene general branch is rerun with an existing manifest and retains manifest, summary, and prompt bytes.
- Re-verified full GREEN: 70 tests, 0 failures; syntax checks, JSON parsing, and `git diff --check` passed.
