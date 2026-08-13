# Task 6 report — Studio·Career memory orchestration

## RED → GREEN

- RED: `node --test tests/products/studio/orchestrator.test.mjs tests/products/career/orchestrator.test.mjs` reported 27 passed and 2 failed because neither orchestrator intake nor workflow documented the required memory normalization, placement, or evidence boundary.
- GREEN: both product orchestrators now normalize `projectId` and `memoryDisabledForRequest`, preserve the fixed `intake/config → retrieve → specialist → gates → capture → nonzero summary` order, keep memory optional, and retain the three-primary-reviewer cap.
- GREEN: the two contracts assert Task 5 `memoryWorkflow` exactly and mutation-test retrieval/capture placement, automatic approval, a dedicated memory agent, memory-induced artifact stopping, and unsafe cross-lane fact promotion.
- RED (fix round 1): the original E2E created unused temporary roots and spawned existing unit suites, so it did not directly establish the 13 scenario fixtures or filesystem outcomes. A one-test direct-fixture placeholder then failed as expected before replacement.
- GREEN (fix round 1): `tests/e2e/suite/design-memory.e2e.test.mjs` now contains exactly 13 direct `node:test` cases. Each case calls public production APIs against its own real temporary filesystem and uses the actual opaque capture/maintenance issuers. It neither imports test files nor spawns a child test runner.

## Verification

- `node --test tests/products/studio/orchestrator.test.mjs tests/products/career/orchestrator.test.mjs` → 29 passed, 0 failed.
- `node --test tests/e2e/suite/design-memory.e2e.test.mjs` → 13 passed, 0 failed (59.15s). This includes the exact default 257-child, 100,001-entry, and 9,999-global-slot boundaries.
- `node --check products/game-design-studio/plugin/skills/orchestrate-game-design-project/scripts/validate-studio-scenario.mjs` → success.
- `git diff --check` → success.

## Changed files

- Studio orchestrator skill plus intake, workflow, and completion-gate references.
- Career orchestrator skill plus intake and completion-gate references.
- Studio/Career product contracts and the 13-scenario design-memory E2E suite.

## Concerns

- The E2E uses observable black-box behavior only for unavailable public seams: scenario 6 proves unchanged tree/nonexistent workspace rather than an adapter-call counter; scenario 13 proves post-commit cache closure and a manual derived-only reset rather than a commit barrier or reset API. When no guidance remains after stale-source exclusion, the current runtime does not publish a receipt; scenario 5 obtains expected/observed drift through the public source-binding observer instead.
