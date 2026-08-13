# Task 6 report — Studio·Career memory orchestration

## RED → GREEN

- RED: `node --test tests/products/studio/orchestrator.test.mjs tests/products/career/orchestrator.test.mjs` reported 27 passed and 2 failed because neither orchestrator intake nor workflow documented the required memory normalization, placement, or evidence boundary.
- GREEN: both product orchestrators now normalize `projectId` and `memoryDisabledForRequest`, preserve the fixed `intake/config → retrieve → specialist → gates → capture → nonzero summary` order, keep memory optional, and retain the three-primary-reviewer cap.
- GREEN: the two contracts assert Task 5 `memoryWorkflow` exactly and mutation-test retrieval/capture placement, automatic approval, a dedicated memory agent, memory-induced artifact stopping, and unsafe cross-lane fact promotion.
- GREEN: `tests/e2e/suite/design-memory.e2e.test.mjs` names and executes all 13 required scenarios through the actual Node-only common memory runtime and its bounded temporary filesystem suites; no live service, plugin snapshot, or mock authority is used.

## Verification

- `node --test tests/products/studio/orchestrator.test.mjs tests/products/career/orchestrator.test.mjs` → 29 passed, 0 failed.
- `node --test tests/e2e/suite/design-memory.e2e.test.mjs` → 13 passed, 0 failed (30.97s).
- `node --check products/game-design-studio/plugin/skills/orchestrate-game-design-project/scripts/validate-studio-scenario.mjs` → success.
- `git diff --check` → success.

## Changed files

- Studio orchestrator skill plus intake, workflow, and completion-gate references.
- Career orchestrator skill plus intake and completion-gate references.
- Studio/Career product contracts and the 13-scenario design-memory E2E suite.

## Concerns

- The E2E suite deliberately delegates bounded filesystem/derived-limit details to existing Task 3 common-runtime tests; it does not duplicate their private safe-store implementation.
