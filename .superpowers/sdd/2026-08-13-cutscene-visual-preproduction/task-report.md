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
- GREEN: focused E2E plus mutation suite passed **16/16** (15 top-level E2E,
  11 mutation workers, skip 0).
- Source integration: selected Task 1–8/public product matrix passed **133/133**.
- Snapshot: standard `npm run build` ran **once**; subsequent
  `npm run build -- --check` passed. Both package validators passed.
- `npm run test:contracts` currently reports eight unrelated Archify production
  inventory failures; its output names only Archify contracts, not cutscene files.
  This is retained as a validation gap rather than masked.

## Known limits

- The snapshot builder deliberately retained its exact recovery directory under
  `/private/var/folders/99/kpfx0mdj3fvbczqpbncjl0bm0000gn/T/snapshot-recovery-DjPB3c`.
  It is outside the repository and has not been deleted by this task.
