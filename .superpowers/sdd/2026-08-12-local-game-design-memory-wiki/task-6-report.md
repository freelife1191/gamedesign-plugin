# Task 6 report — Studio·Career memory orchestration

## RED → GREEN

- RED: `node --test tests/products/studio/orchestrator.test.mjs tests/products/career/orchestrator.test.mjs` reported 27 passed and 2 failed because neither orchestrator intake nor workflow documented the required memory normalization, placement, or evidence boundary.
- GREEN: both product orchestrators now normalize `projectId` and `memoryDisabledForRequest`, preserve the fixed `intake/config → retrieve → specialist → gates → capture → nonzero summary` order, keep memory optional, and retain the three-primary-reviewer cap.
- GREEN: the two contracts assert Task 5 `memoryWorkflow` exactly and mutation-test retrieval/capture placement, automatic approval, a dedicated memory agent, memory-induced artifact stopping, and unsafe cross-lane fact promotion.
- RED (fix round 1): the original E2E created unused temporary roots and spawned existing unit suites, so it did not directly establish the 13 scenario fixtures or filesystem outcomes. A one-test direct-fixture placeholder then failed as expected before replacement.
- GREEN (fix round 1): `tests/e2e/suite/design-memory.e2e.test.mjs` now contains exactly 13 direct `node:test` cases. Each case calls public production APIs against its own real temporary filesystem and uses the actual opaque capture/maintenance issuers. It neither imports test files nor spawns a child test runner.
- RED (fix round 2): a deliberately wrong #7 warning expectation (`memory.derived_reservation_invalid`) failed against the public index loader's actual `memory.derived_generation_invalid` warning. #9's initial receipt-content expectations also failed until the immutable receipt records were asserted against the runtime's actual policy/ranking outcomes.
- GREEN (fix round 2): direct scenarios now use an actual `git init --quiet` temporary workspace; #6 obtains its disabled config through `loadMemoryConfig`; #7 asserts the exact corrupt-generation warning; #9 loads and checks every immutable receipt field; #10 and #13 assert no derived selection when cache health is closed; #11 proves 10,000/256 schema-valid boundaries before rejecting 10,001/257 inputs; and #13 proves the public concurrent-commit/cache-closure observable outcome plus source control continuity.
- RED (fix round 3): #10/#13 intentionally expected the census warning. The direct public APIs instead returned `memory.derived_directory_limit_exceeded`; #13 also retained additional reservation diagnostics after the leading cache-health warning.
- GREEN (fix round 3): #10 now proves direct-child scan `entries: []` plus load/list/publish no-selection behavior and the exact directory-limit warning. #13 checks that every closed normal/fake load, list, and publish has the exact leading directory-limit warning, and compares complete canonical source physical snapshots—including event and quarantine marker IDs, paths, classifications, and bytes hashes—across the manual derived-only reset.

## Verification

- `node --test tests/products/studio/orchestrator.test.mjs tests/products/career/orchestrator.test.mjs` → 29 passed, 0 failed.
- `node --test --test-name-pattern='^6\\.' tests/e2e/suite/design-memory.e2e.test.mjs` → 1 passed, 0 failed (53.85ms): public config-loader disabled path and zero-I/O negative control.
- `node --test --test-name-pattern='^9\\.' tests/e2e/suite/design-memory.e2e.test.mjs` → 1 passed, 0 failed (7.13s): exact immutable receipt-content history.
- `node --test --test-name-pattern='^11\\.' tests/e2e/suite/design-memory.e2e.test.mjs` → 1 passed, 0 failed (3.92s): valid 10,000/256 schema boundaries and limit+1 rejection.
- `node --test --test-name-pattern='^13\\.' tests/e2e/suite/design-memory.e2e.test.mjs` → 1 passed, 0 failed (6.33s): concurrent commit/cache-health/source-control continuity.
- `node --test --test-name-pattern='^10\\.' tests/e2e/suite/design-memory.e2e.test.mjs` → 1 passed, 0 failed (21.55s) with exactly 100,001 physical entries.
- `node --test --test-name-pattern='^(10|13)\\.' tests/e2e/suite/design-memory.e2e.test.mjs` → 2 passed, 0 failed (28.02s) after the direct-child/no-selection and canonical-reset repairs.
- `node --test tests/e2e/suite/design-memory.e2e.test.mjs` → 13 passed, 0 failed (62.88s) with the exact default 257-child, 100,001-entry, and 9,999-global-slot boundaries.
- `node --test tests/unit/design-memory-capabilities.test.mjs tests/unit/design-memory-capture.test.mjs tests/unit/design-memory-config.test.mjs tests/unit/design-memory-maintenance.test.mjs tests/unit/design-memory-mutation-harness.test.mjs tests/unit/design-memory-record.test.mjs tests/unit/design-memory-retrieval.test.mjs tests/unit/design-memory-store.test.mjs` → 219 passed, 0 failed, 1 explicit Node-18 non-goal skip (90.10s).
- `node --check products/game-design-studio/plugin/skills/orchestrate-game-design-project/scripts/validate-studio-scenario.mjs` → success.
- `node --check tests/e2e/suite/design-memory.e2e.test.mjs` → success.
- `git diff --check` → success.

## Changed files

- Studio orchestrator skill plus intake, workflow, and completion-gate references.
- Career orchestrator skill plus intake and completion-gate references.
- Studio/Career product contracts and the 13-scenario design-memory E2E suite.

## Concerns

- The E2E uses observable black-box behavior only for unavailable public seams: scenario 6 proves loader-produced disabled config plus unchanged tree/nonexistent workspace rather than an adapter-call counter; scenario 13 proves post-commit cache closure and documented manual derived-only reset rather than a commit barrier or reset API. The reset itself is intentionally a test-only filesystem action; no public reset API exists. When no guidance remains after stale-source exclusion, the current runtime does not publish a receipt; scenario 5 obtains expected/observed drift through the public source-binding observer instead.
- The sole `node:child_process` import in the E2E is test-only `git init --quiet` for the real temporary Git workspace. The runtime source graph remains untouched; the suite neither starts a child test runner nor imports a test file.
