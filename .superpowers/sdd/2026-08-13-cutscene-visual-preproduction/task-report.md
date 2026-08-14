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
| E05 | reference tamper | current reference-master bytes changed after approval | valid current package + old authority approval binding stale, provider 0 / pass | E2E, temp removed |
| E06 | stale predecessor | keyframes master state changed | predecessor incomplete, no write / pass | whole-tree snapshot |
| E07 | selection injection | extra storyboard stable ID | selection invalid, provider 0 / pass | E2E |
| E08 | reapproval | separate valid rebound package paired with old approval | old plan/package pair stale before dispatch / pass | E2E |
| E09 | reserve/cap | valid journal with cap/reserve boundary | journal-derived cap/reserve is enforced, provider 0 on rejection / pass | E2E |
| E10 | partial retry | reference-masters: one success, one retryable result | failed-only retry; successful state, bytes, receipt preserved / pass | real temporary FS |
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

## Task 8 — Cutscene guide/use-case/diagram contract closure

### RED

- `node --test tests/contracts/user-guide-use-case-manifest.test.mjs` began at
  **47/58 pass, 11 fail**. The failures exposed the absent Studio direct-use
  entry/source (`ST-S16`/`st-s16`), the omitted canonical
  `cutscene-visual-preproduction` route from the production validator, an
  incomplete Q20 FAQ answer, and stale 15/90/50 inventory expectations.

### GREEN

- Q20 now has the standard six FAQ fields and preserves named real-time
  approval, unavailable-cost provider-0 stop, and stable-ID retry/recovery
  boundaries. Q19's shared-memory shape is selected by its exact heading, not
  by its array index. The contract rejects mutations of every Q20 field and
  its question heading.
- Studio now has exact direct-use `ST-S16`, five skill-owned cutscene outputs,
  and ordered `plan-image-assets` → `generate-image-assets` →
  `review-image-assets` handoff. `st-s16` is source-linked to one embedded
  SVG-wrapped PNG and has the matching independent production oracle.
- The exact canonical route and exact inventory now cover 16 Studio skill
  cases, 91 diagrams, 31 total skill cases, and 51 FAQ headings. No runtime,
  provider, E2E harness, or generated plugin runtime file was changed.

### Validation

- Focused manifest contract: `node --test tests/contracts/user-guide-use-case-manifest.test.mjs` — **58/58 pass** after the RED baseline.
- Contract slices: complete counts, Studio manifest/routing, Q20 mutation
  matrix, and independent production route/source oracle — **7/7 pass**.
- Archify/document-quality contract:
  `node --test tests/contracts/reference-intelligence-guides.test.mjs` —
  **6/6 pass**; only the exact stale catalog digests were refreshed.
- Related Studio/Career diagram geometry contracts:
  `node --test tests/contracts/user-guide-studio-diagrams.test.mjs tests/contracts/user-guide-career-diagrams.test.mjs` —
  **16/16 pass**.
- Diagram generation/check: `npm run build:guide-diagrams` and
  `npm run check:guide-diagrams` completed for the 91-diagram inventory;
  `node tooling/build-use-case-diagrams.mjs --id st-s16 --check` — **1 SVG,
  1 PNG checked**.
- Guide validation: `npm run validate:guides` — PASS
  `{guides:157, skillGuides:47, svg:91, png:91, audiencePaths:6,
  useCases:36, skillCases:31, faq:51}`.

### Remaining lane

- Task 8 remains **not final-approved**. This closure supplies the contract
  evidence required for independent review only.

## Task 8 — Unit-contract closure

### RED

- The focused unit contract set exposed three stale pre-cutscene snapshots:
  Studio source enumeration expected 33 IDs without `st-s16`, package inventory
  expected 46 skills without the Studio cutscene skill, and the trusted Studio
  quality-selection anchor still bound 20 profiles rather than the canonical
  21-profile index.

### GREEN

- Studio source validation now asserts the literal ordered 34-ID source set,
  including `st-s16`, before checking the exact all-missing diagnostic.
- The two-plugin skill contract now pins Career 23 + Studio 24 = 47 skills.
- The trusted Studio selection anchor now pins the canonical 21 IDs and
  SHA-256 `b2333da6f292e71dae29e4198ee7ac3e9d8db4ca7090f89a745065d5b10fd70c`.

### Validation

- Focused unit contracts: diagram builder **31/31**, package inventory **1/1**,
  and quality-profile selection **20/20** pass after the RED baseline.
- Generated package parity: `npm run build` refreshed both product runtime
  mirrors and BUILD-MANIFEST files; `npm run build -- --check` passed.
- Final closure: the combined focused unit set passed **52/52**;
  `validate-packages` passed **2** plugin and **47** skill validators. Shared
  source/package byte parity passed **4** checks, three runtime `node --check`
  checks and two BUILD-MANIFEST JSON parses passed, and `git diff --check` is
  clean.

### Remaining lane

- Task 8 remains **not final-approved**. This closure restores exact unit and
  package contracts; independent final review remains required.
