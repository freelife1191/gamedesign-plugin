# Task 8 — Cutscene visual lifecycle UltraQA report

## Scope and safety boundary

- Public surface: planner, estimator, human approval, approved-wave dispatch/retry,
  overlay, continuity review/gate, and derived lifecycle.
- Every fixture has `env: {}` and installs a failing default network/host callback.
  No live provider, credential, or network call is used.
- Runtime authority (`receipt`, `capability`) and callbacks stay outside the mutable
  input. The public stage receives only its allowlisted input fields.
- Temporary artifact roots use the `cutscene-e2e-` prefix and each test removes its
  own root. Mutation children have a 15-second timeout, 64 KiB combined ordinary
  output bound, 4 KiB dedicated-FD evidence bound, allowlisted environment, and
  process-group cleanup.

## Scenario matrix

| Scenario ID | Intent / attacker | Setup and harness | Expected / actual | Evidence / cleanup |
| --- | --- | --- | --- | --- |
| E01 | prompt-only | complete fixture, planner | template only, provider 0 / pass | E2E, temp removed |
| E02 | estimate-only | complete bound fixture | estimate, provider 0 / pass | E2E, temp removed |
| E03 | unavailable quote | missing finite ceilings | unavailable, provider 0 / pass | E2E, temp removed |
| E04 | no approval | receipt/capability omitted | approval required, provider 0 / pass | E2E, temp removed |
| E05 | reference tamper | generation-ready reference digest changed | package invalid, provider 0 / pass | E2E, temp removed |
| E06 | stale predecessor | keyframes master state changed | predecessor incomplete, no write / pass | whole-tree snapshot |
| E07 | selection injection | extra storyboard stable ID | selection invalid, provider 0 / pass | E2E |
| E08 | reapproval | plan beat altered | plan invalid before dispatch / pass | E2E |
| E09 | reserve/cap | sealed estimate reserve changed | stale/invalid estimate, provider 0 / pass | E2E |
| E10 | partial retry | retryable fake provider response | unrelated bytes retained / pass | real temporary FS |
| E11 | dialogue overlay | dialogue change | no image ID / pass | pure API |
| E12 | visual overlay | blocking change | new derivative outside base IDs / pass | pure API |
| E13 | continuity drift | blocking screen-direction finding | gate rejects; lifecycle blocked / pass | pure API |
| E14 | lifecycle | completed current plan+manifest, then blocker | candidate true then false / pass | current receipt |
| E15 | usage ambiguity | cached-token details omitted | unavailable actual cost / pass | estimator API |
| M01–M11 | authority, binding, selection, cap/reserve, mode, usage, and continuity tampering | one worker per named mutation | exact rejection, provider 0, write 0 / pass | one FD JSON record each |

Exact mutation names: `approval-authority`, `approval-binding`,
`reference-binding`, `stage-selection`, `cost-cap`, `retry-reserve`,
`mode-boundary`, `usage-completeness`, `continuity-wave-splice`,
`continuity-unrelated-manifest`, `continuity-receipt-stale`.

## Results

- RED: `node --test tests/e2e/suite/cutscene-visual-preproduction.e2e.test.mjs`
  failed because the suite did not yet exist.
- RED follow-up: direct plan-derived prompt/output mutation fails closed before
  binding; the final rebind scenarios use valid observed-master bytes instead.
- GREEN: latest focused suites passed **28/28** (15 top-level E2E and 13
  mutation-harness tests; 11 mutation workers, skip 0).
- Source integration: selected Task 1–8/public product matrix passed **133/133**.
- Snapshot: standard `npm run build` ran **twice**: the first was pre-review;
  the second was the accepted post-fix snapshot refresh. Its `--check` passed.
- `npm run test:contracts` passed after the contract integration lane landed.

## Known limits

- Implementation evidence is complete; final contract review remains pending.

## Task 8 — Fix round 4 (reservation and E10 non-vacuity)

### RED

- A public `generateImageAssetWorkflow` temporary-filesystem test supplied the
  cutscene-style `beforeProvider` callback with no Codex host generator and
  then with no provider available. Both reached
  `writeGenerationReceipts` with `reservation === undefined` and failed at
  `reservation.path`.
- The strengthened E10 retry fixture keeps `asset.output` at literal
  `1536×1024, 3:2` while the approved `planning.target_output` is literal
  `1024×1024, 1:1`. Before the fix, the retry publication retained the stale
  `3:2` aspect ratio even though the provider request used `1024×1024`.

### GREEN

- The shared workflow now creates exactly one bounded, create-once attempt
  reservation immediately before persisted receipt creation if a terminal
  result did not cross `beforeProvider`. A thrown authorization still exits
  before that point, with zero reservation and receipt writes.
- Result publication falls back to the planned target output for omitted
  provider fields, so a cutscene retry persists the approved target path,
  dimensions, aspect ratio, format, and background rather than stale mutable
  `asset.output` metadata.
- E10 records the literal three-call initial OpenAI request order (environment
  retry, environment success, prop failure), then the literal one-call failed
  prop retry. It snapshots the successful asset's complete manifest state,
  output SHA-256, persisted generation receipt, and latest journal outcome;
  all remain deeply equal after retry. Changed paths are limited to the failed
  asset plus its bounded receipt/journal paths and manifest update.

### Validation and generated parity

- Focused reservation tests: **4/4** pass. E10 focused test: **1/1** pass.
- Full cutscene E2E: **15/15** pass. Mutation harness: **13/13** pass.
- Relevant cutscene/image matrix (approval, image-assets/config/provider,
  OpenAI generator, Studio image suite): **146/146** pass.
- `npm run build` ran **exactly once** in this Fix4 and refreshed both generated
  product runtime copies and BUILD-MANIFEST files. One subsequent
  `npm run build -- --check` passed. Shared and both generated runtime files
  pass `node --check`; both BUILD-MANIFEST JSON files parse; `git diff --check`
  passes.
- Career image suite is still **29/31**: the two known host-throw cases fail
  identically at baseline `f020d81` (**29/31**, `host unavailable` and
  `throw-secret-never-persist`), so they are not attributed to Fix4.

### Remaining lane

- Task 8 is not marked final-complete here. Independent contract review remains
  the required final lane.
