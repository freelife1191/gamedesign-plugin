# SDD ledger — plan: docs/superpowers/plans/2026-08-13-cutscene-visual-preproduction.md

## Setup

- Worktree: `/Users/freelife/game/gamedesign-plugin/.worktrees/feat-reference-intelligence-cutscene`
- Branch: `feat/reference-intelligence-cutscene`
- Plan base: `c184975`
- Spec: `docs/superpowers/specs/2026-08-13-cutscene-visual-preproduction-design.md`
- Spec state: user-approved; the 2026-08-14 request explicitly authorizes current-contract review, plan adjustment, and continuous implementation.
- Isolation: linked worktree (`git-dir` differs from `git-common-dir`), branch worktree clean at setup.
- Baseline: `node --test tests/unit/image-assets.test.mjs tests/products/studio/image-assets.test.mjs tests/products/career/image-assets.test.mjs` — 72 pass, 0 fail, 0 skip.
- External-call boundary: implementation and automated tests use no live paid image generation. A future real generation run still requires a fresh stage-specific estimate and approval bound to the current prompt/reference/model/size/quality/cost cap.

## Current official OpenAI contract review (2026-08-14)

- `gpt-image-2` remains the current default GPT Image model and supports both `/v1/images/generations` and `/v1/images/edits`; the dated snapshot is `gpt-image-2-2026-04-21`.
- Edit requests support multiple `image[]` inputs. `input_fidelity` must be omitted for `gpt-image-2` because all image inputs are processed at high fidelity.
- `gpt-image-2` sizes are not limited to three presets: both edges must be multiples of 16, each edge at most 3840 px, aspect ratio at most 3:1, and total pixels between 655,360 and 8,294,400. Transparent backgrounds are not supported.
- Current API pricing is token-based and must remain a timestamped host-provided official snapshot, never a runtime constant. Official pricing currently distinguishes text input, cached text input, image input, cached image input, and image output tokens.
- Ruling: keep `gpt-image-2` as the default candidate but validate model capabilities from the supplied snapshot; do not hard-code the dated snapshot as a permanent runtime default. Cost if wrong: aliases or model capabilities can change after release and make a sealed request stale.
- Ruling: Task 1/3 schemas must represent arbitrary valid width/height and official token categories rather than only legacy named sizes or a single aggregate input price. Cost if wrong: estimates can undercount reference-image costs or reject supported sizes.
- Ruling: Task 4 must omit `input_fidelity` for `gpt-image-2`, reject transparent output for that model, and treat incomplete usage as actual-cost unavailable rather than inventing a value. Cost if wrong: requests can be rejected or receipts can overstate cost certainty.

## Preflight task/interface scan

| Producer / consumer | Shared file or interface | Finding | Ruling |
| --- | --- | --- | --- |
| Task 1 → Task 2 | cutscene plan schemas and validator | Prompt Only cannot require hashes for images that do not exist yet. | Split prompt state into template-ready/unbound and generation-ready/bound. |
| Task 1 → Task 3 | cost/approval schemas | Three broad stages cannot enforce style-first approval or partial progress. | Use four approval waves: style-master, reference-masters, keyframes, storyboard. |
| Task 1 → Tasks 4–5 | root state and review schema | A single mutable root approval state conflicts with asset-level approval authority. | Root state is derived from wave progress, current continuity receipt and existing asset approvals. |
| Task 2 → Task 3 | prompt package hash and stage assets | Approval must bind only a package whose actual references have been re-read and hashed. | Only bound packages are approval-eligible; Prompt Only remains complete without invented hashes. |
| Task 2 ↔ existing `plan-image-assets` | `assets/image-assets.yml` | Two writers would rewrite IDs/DAG/prompt hashes. | Cutscene planner is the sole manifest writer; general planner validates/hands off cutscene manifests without replanning. |
| Task 2 ↔ Task 5 | DAG impact traversal | `invalidateCutsceneDependents` and `findCutsceneImpact` duplicate one authority. | Keep one public impact/invalidation implementation and reuse it. |
| Task 3 → Task 4 | approval authority | Caller-created `hostEvent` plus matching strings can forge approval. | Use a private opaque live host-user capability/receipt bound to reviewer, event, plan, estimate and exact wave. |
| Task 3 → Task 4 | pricing snapshot and usage | Current API pricing has cached categories but current Images usage does not prove cached-token breakdown. | Preserve request-level usage; exact actual USD stays unavailable unless every price category is observed. |
| Task 4 ↔ existing retry loop | provider dispatch | One preflight before a three-attempt retry loop can exceed approved reserve/cap. | Reauthorize every provider attempt and block the next attempt when reserve or cost cap is exhausted. |
| Task 4 ↔ current GPT Image runtime | endpoint, images, size, background | Existing runtime already supports generations/edits, ordered image arrays and arbitrary valid sizes; plan omitted its regression suite. | Preserve no-`input_fidelity`, current size constraints, transparent rejection and add `generate-openai-images` regression coverage. |
| Task 4 → Task 5 | generation receipts and partial success | Wave-level receipt alone cannot prove per-asset retry preservation. | Store usage/attempt evidence per provider request and preserve unrelated successful bytes/state/receipts. |
| Tasks 1–5 → Task 6 | frozen public runtime | Route example violates current exact route shape. | Preserve canonical route keys and add separate closed top-level `cutsceneWorkflow` metadata. |
| Task 6 → Task 7 | Studio skill inventory | Current routing 22 differs from installed 23 because `svg-infographic` is build-owned. | Inventory is `routing.skillIds ∪ build-owned vendor skills`; after cutscene Studio is 23/24, Career remains 22/23. |
| Tasks 1–7 → Task 8 | public APIs and package mirrors | Proposed 14 E2E omit actual usage semantics; 9 mutations omit authority and usage completeness. | Use 15 public E2E scenarios and 11 named mutations plus hostile harness tests. |

Task self-consistency:

- Task 1: revise schemas to represent four waves, derived root state, bound/unbound prompts, arbitrary supported dimensions and request-level usage semantics; exact error code/path parity is required.
- Task 2: retain one manifest writer and one DAG invalidation API; Prompt Only must be a complete no-image output.
- Task 3: price snapshots remain external official evidence; approval authority is opaque/live and current for at most the stated freshness window.
- Task 4: add per-attempt authorization and current GPT Image regression tests; all test fixtures structurally block real network.
- Task 5: continuity decisions never self-approve assets; variant tests preserve overlay payload and unrelated physical evidence.
- Task 6: add the Studio-only skill using existing exact route shape; common runtime remains package-compatible for Career.
- Task 7: expand file ownership to every affected guide/product/package contract and derive counts from routing plus vendor inventory.
- Task 8: direct public APIs only, no live generation, exact 15 E2E/11 named mutations, full package/build/final review.

- Preflight review verdict: original plan BLOCKED before implementation due approval authority, retry-cost, manifest-writer and inventory conflicts.
- Ruling: revise spec/plan before Task 1 while preserving the approved product outcome. Cost if wrong: implementing the old interfaces could permit paid calls outside an approved cap or create incompatible approval authorities.
- Ruling: Tasks 1–5 execute serially; Task 6 starts after runtime freeze, Task 7 after routing freeze, Task 8 after all functional contracts. Cost if wrong: shared-file conflicts could leave two different stale/approval rules in production.

- Preflight revision review: REJECT (Critical 4, Important 6, Minor 1) — the compressed plan did not connect immutable handoff to the real image workflow, omitted package/guide contract owners, did not exercise the internal retry loop, and lacked writing-plans-level executable detail.
- Preflight revision fix round 1/5: implementation committed as `215dcfb` over `fdfcfb5`; scoped re-review in progress for all 11 findings.
- Preflight revision fix round 1/5: 7 addressed, 4 original findings open plus 1 new signature mismatch; commits `fdfcfb5..215dcfb`.
- Preflight revision fix round 2/5: implementation committed as `e172004` over `215dcfb`; scoped re-review in progress for the five open findings.
- Preflight revision fix round 2/5: 1 addressed, 4 open; fix diff also introduced four Important fixture/runtime inconsistencies; commits `215dcfb..e172004`.
- Preflight revision fix round 3/5: implementation committed as `afda8c2` over `e172004`; scoped re-review in progress for four open findings and their four concrete breakages.
- Preflight revision fix round 3/5: 6 addressed, 2 open; Critical authority-pair mismatch plus current-context/whole-tree no-write gaps remain; commits `e172004..afda8c2`.
- Preflight revision fix round 4/5: stronger fresh implementer committed `38d44a2` over `afda8c2`; scoped re-review in progress for authority identity/context and whole-tree no-write proof.
- Preflight revision fix round 4/5: 5 addressed, 1 open (`mode-boundary` mutates the wrong object path); commits `afda8c2..38d44a2`.
- Preflight revision fix round 5/5: fresh stronger implementer required; base `38d44a2`, single open finding.
- Preflight revision fix round 5/5: stronger fresh implementer committed `4c9b952` over `38d44a2`; final scoped re-review in progress for canonical plan-mode mutation reachability.
- Preflight revision fix round 5/5: original finding addressed; one new load-bearing Task 4 fixture gap remains; commits `38d44a2..4c9b952`.
- Preflight revision: complete at breaker (commits `c184975..4c9b952`, 1 load-bearing ruling carried forward).
- Ruling: Task 4 `approvedWaveFixture().plan` MUST include `mode: "generate-after-approval"`, and every success/host/stale-binding derivative MUST inherit it before the mode-first guard. The fifth plan-fix re-review proved the gap, but the SDD five-round cap forbids another plan-edit dispatch; carry this exact contract into the Task 4 brief. Cost if wrong: reserve/cap/stale-binding tests would all fail early with `cutscene.mode_generation_forbidden` and would not verify their intended safety boundary.

## Task status

- Task 1: in progress
- Task 1: review found 1 Critical and 8 Important issues in lifecycle authority, mode/state/completion transitions, recursive closed contracts, schema/runtime parity, canonical array accessors, error handling, and non-vacuous schema tests.
- Task 1: fix round 1/5 implementation committed as `2c7c4f0` over `9ce846d`; scoped re-review in progress for 1 Critical and 8 Important findings.
- Task 1: fix round 1/5 (5 addressed, 4 original findings open plus 2 new Important breakages; commits `9ce846d..2c7c4f0`).
- Task 1: Ruling: extend the lifecycle API to `deriveCutsceneLifecycle({plan,manifest,waves,continuityReceipt})` and compute the current digest internally as `cutsceneDocumentSha256(plan)`; never accept a caller-supplied `plan.sha256` as authority. The spec requires a current receipt but the original three-argument plan signature cannot prove currentness. Carry the new exact interface to Tasks 5 and 8. Cost if wrong: later callers must be updated from the written plan, but retaining the old signature permits forged/stale receipt approval.
- Task 1: fix round 2/5 in progress with original implementer; close caller-forged plan hash, schema parity/evaluator coverage, transition equality, malformed-ID throwing, and downstream interface tests.
- Task 1: fix round 2/5 (4 addressed, 3 Important findings remain: continuity finding uniqueness parity, whole-schema evaluator preflight, and non-string IDs on direct UTF-8 comparison paths; commits `2c7c4f0..62cc3e6`).
- Task 1: fix round 3/5 in progress with original implementer; close the three verified findings without broadening the public contract.
- Task 1: fix round 3/5 (3 original findings addressed; 1 new Important malformed-finding canonicalization exception remains; commits `62cc3e6..0c3235e`).
- Task 1: fix round 4/5 requires a fresh stronger implementer; keep scope to deterministic diagnostics for malformed continuity findings before duplicate canonicalization.
- Task 1: fix round 4/5 (open Important addressed, no new Critical/Important; commits `0c3235e..3b2fc97`).
- Task 1: complete (commits `4c9b952..3b2fc97`, independent review clean).
- Task 2: in progress — sole-writer manifest, template/bound prompts, immutable handoff, and one DAG impact/invalidation authority.
- Task 2: review found 1 Important and 3 Minor issues: generation-ready plan/manifest binding was not recomputed, public cutsceneWorkflow closure was incomplete, binding/invalidation tests were partly vacuous, and the valid general branch lacked a regression.
- Task 2: fix round 1/5 in progress with original implementer; close current plan/DAG/prompt/asset/approval binding before I/O and strengthen runtime/schema/test parity.
- Task 2: fix round 1/5 (2 findings addressed, 2 High findings remain: public post-validation seam/live manifest reuse and caller-controlled master output path; commits `9d565a7..b490c36`).
- Task 2: fix round 2/5 in progress with original implementer; remove public seam, freeze pre-await authority snapshot, and bind plan-derived output paths before file I/O.
- Task 2: fix round 2/5 (2 High findings addressed, no new Critical/Important; commits `b490c36..6373d6f`).
- Task 2: complete (commits `3b2fc97..6373d6f`, independent review clean).
- Task 3: in progress — timestamped pricing snapshot, token-category cost estimates, and opaque live host-user approval bound to the current wave package.
- Task 3: review found 1 Critical, 4 Important, and 2 Minor issues: a public live-capability mint, caller digest wrapper fallback, unverified pricing/estimate digests, stale plan/package decoupling, role-like actor bypass, wrong missing-authority path, and loose timestamps.
- Task 3: Ruling: all approval and estimate authority MUST use the actual closed `plan` plus Task 2 `generation-ready` `promptPackage`; legacy `{sha256,waves,...}` digest wrappers are invalid even though the original Task 3 example fixture used one. This follows the approved spec's current bound prompt/reference authority and the Task 1 lifecycle ruling. Cost if wrong: a caller can mint a fresh approval around a stale or forged plan/package digest and authorize paid generation.
- Task 3: fix round 1/5 in progress with original implementer; privatize minting, remove legacy authority, recompute all digests/bindings, harden named-human and timestamp validation, and replace tests with actual closed authority fixtures.
- Task 3: fix round 1/5 (5 findings addressed, 2 High and 1 Medium remain: issuer accepts caller context, Task2 multi-reference order rejected, and `Kai`-like names false-positive; commits `3cbcb21..14863fb`).
- Task 3: Ruling: `issueCutsceneHumanApproval` itself MUST consume the live event fields plus actual `{plan,promptPackage,pricingSnapshot,estimate}` and derive the binding internally; a caller-provided precomputed `context` can never mint authority. Cost if wrong: hiding the mint function is insufficient because a caller can still mint a live pair around forged hashes.
- Task 3: fix round 2/5 in progress with original implementer; bind issuance internally, reconcile Task2 reference order through internal canonical sorting, and narrow role-like AI detection without rejecting real names.
- Task 3: fix round 2/5 (all production findings addressed; 1 Medium integration-proof gap remains because tests hand-built the Task2 package; commits `14863fb..6b93666`).
- Task 3: fix round 3/5 in progress with original implementer; replace the synthetic multi-reference fixture with actual Task2 planner/binder output through estimate and issuance.
- Task 3: fix round 3/5 (actual Task2 binder integrated, but 3 Medium proof gaps remain: self-derived order oracle, no host validation call, and first-element-only freeze assertion; commits `6b93666..04bbe2a`).
- Task 3: fix round 4/5 requires a fresh stronger implementer; production is frozen, strengthen only exact-order, host-path, and all-element immutability evidence.
- Task 3: fix round 4/5 (all code/test findings addressed; 1 Medium report-evidence gap remains because Fix4 controlled mutation REDs were not recorded; commits `04bbe2a..75f0dec`).
- Task 3: fix round 5/5 requires a fresh stronger writer; update only the ignored Task3 report with the actual Fix4 evidence and correct the prior fixture-failure characterization.
- Task 3: fix round 5/5 (report evidence corrected, no production/test change, no new finding; commits `75f0dec..8f4dbef`).
- Task 3: complete at round cap (commits `6373d6f..8f4dbef`, final scoped review APPROVE; no parked load-bearing finding).
- Task 4: in progress — per-attempt approval revalidation, cost-cap enforcement, provider dispatch, and immutable usage receipts with no live calls in tests.
- Task 4: Ruling: `runApprovedCutsceneImageWave` and retry entrypoints MUST NOT accept a caller-supplied `authorizeProviderAttempt`; they construct the per-attempt authorization closure internally from the current actual plan, bound package/manifest, pricing, estimate, live receipt/capability, attempt state and clock, then pass it to the provider retry loop. The plan's callback parameter is an obsolete test seam. Cost if wrong: callers could bypass reserve/cost/approval checks or forge an authorization failure sequence unrelated to production authority.
- Task 4: Ruling carried from preflight: every approved success/host/stale-binding fixture uses an actual closed plan with `mode:"generate-after-approval"`; no fixture may fail early on the mode guard and mask its intended reserve/cap/stale-binding assertion. Cost if wrong: Task 4 tests become vacuous and do not exercise paid-call safety.
- Task 4: review found 5 High and 1 Medium issues: provider attempts were not integrated with create-once usage receipts, retry cost/reserve did not use live ledger state, failed-asset subset retry was impossible, dispatch model/provider/request fields were not bound, host broad catch retried contract errors, and core no-call/no-write tests were absent.
- Task 4: fix round 1/5 in progress with original implementer; make per-dispatch attempt evidence the single source for receipt, budget, retry and partial-success preservation.
- Task 4: fix round 1/5 (all 5 High/2 Medium remain in integration: host exceptions, subset ledger, unrelated digest, dispatch binding, Task2 prompt adapter, premature OpenAI success, missing matrix; commits `1679136..529db87`).
- Task 4: Ruling: adapt Task 2 `prompt_sha256` to the shared generator only through an ephemeral closed dispatch snapshot whose `prompt_digest` equals the validated Task2 digest; never mutate or rewrite the immutable manifest. Provider/model/quality come from the validated manifest and must match the approved pricing/plan context. Cost if wrong: valid cutscene manifests either cannot generate or are silently rewritten under a different request than the approved one.
- Task 4: Ruling: an attempt with unavailable actual usage consumes its approved worst-case attempt cost for future reserve/cap decisions, never zero. Current asset state is the latest valid receipt by ordinal; earlier failure does not make a later successful asset perpetually failed. Cost if wrong: the runtime can overspend after a provider omits usage or can retry already-successful assets.
- Task 4: fix round 2/5 in progress with original implementer; refactor around a wave-wide receipt ledger and one immutable dispatch adapter/state machine.
- Task 4: fix round 2/5 (host exception/transient retry addressed; 5 High/1 Medium remain plus new High reserve double-count and Medium receipt filename mismatch; commits `529db87..63f7e33`).
- Task 4: fix round 3/5 in progress with original implementer; replace partial logic with one latest-receipt wave ledger, immutable Task2 dispatch adapter, final-output attempt recording, and physical unrelated-tree digest.
- Task 4: fix round 3/5 (receipt filename handling addressed; latest sequence/retry consumption/cost math remain incorrect, and adapter/final success/digest/integration are still open; commits `63f7e33..ed0ce85`).
- Task 4: fix round 4/5 requires a fresh stronger implementer after a bounded architecture ruling for attempt sequencing and conservative per-attempt cost authority.
- Task 4: Ruling: promote cost estimates to a closed v2 schedule with per-asset `attemptCeilings` bound to exact request hashes, and promote usage receipts to a v2 authorization/outcome append-only journal with wave-global sequence and per-asset ordinal. Wave totals alone cannot safely allocate heterogeneous unavailable costs. Cost if wrong: missing usage is undercounted, retry reserve can reset, or distinct physical attempts collide.
- Task 4: Ruling: when a finite host-provided per-attempt ceiling cannot be proven, return an unavailable estimate and block USD-capped generation. Do not treat prose approval as authority to accept unbounded host cost. Cost if wrong: generation may incur unbounded or undisclosed charges contrary to the user's approval requirement.
- Task 4: fix round 4/5 (v2 estimate/journal/adapter/outcomes/digest implemented; 3 High and 1 Medium remain: output target absent from request binding, contradictory usage can strand authorization-only records, terminal failure can be retried through the initial API, and unavailable schema/runtime parity; commits `ed0ce85..09bdcc4`).
- Task 4: fix round 5/5 requires a fresh stronger implementer; close the four exact findings without changing the v2 authority model.
- Task 4: fix round 5/5 (`09bdcc4..f519195`) closed the four prior findings, but final independent review found 1 Critical and 1 Important load-bearing gap: the approval hash binds `asset.output` while the provider consumes `asset.planning.target_output`, and the packaged usage schema accepts `providerOutcome:success` with `usage.reason:provider-not-called` although runtime rejects it.
- Task 4 breaker adjudication: both findings are load-bearing paid-call/audit authority defects and MUST be closed before Task 5 despite the five-round cap. The actual provider target is `planning.target_output`; request identity, estimate, approval validation and frozen dispatch MUST consume that same six-field object, with each field mutated independently in provider-zero/whole-tree-no-write tests. For non-`not-called` outcomes, schema/runtime/evaluator MUST all forbid `provider-not-called`. Cost if wrong: a caller can change paid output size/path after approval, or a packaged schema can certify an impossible provider outcome.
- Task 4 breaker closure RED: with `asset.output` held unchanged, each isolated `planning.target_output` mutation retained the old request schedule and reached the public provider path; the packaged usage schema also accepted `providerOutcome: "success"` plus `usage.reason: "provider-not-called"` while the runtime rejected it.
- Task 4 breaker closure GREEN: request hashing, estimate issuance/revalidation, approval binding, and frozen dispatch now all consume `planning.target_output`'s exact six fields. The public real-filesystem matrix rejects every isolated target mutation as stale before provider calls and leaves the artifact root empty; a differing historical `asset.output` cannot alter the provider request. Shared schema, test-local evaluator, runtime validator, and journal reader reject the hostile non-`not-called` reason while the valid `not-called` zero-cost record is accepted. Temporary Studio/Career builds verify exact shared-schema bytes.
- Task 4 breaker closure validation: focused RED observed the expected C1 no-rejection and I1 schema-only acceptance; GREEN matrix `node --test tests/unit/cutscene-visual-preproduction.test.mjs tests/unit/cutscene-generation-approval.test.mjs tests/unit/generate-openai-images.test.mjs tests/unit/image-asset-plan.test.mjs tests/unit/image-assets.test.mjs tests/unit/image-config.test.mjs tests/unit/image-prompts.test.mjs tests/unit/image-provider.test.mjs tests/unit/smoke-openai-image.test.mjs tests/products/studio/image-assets.test.mjs` → 184 pass, 0 fail; five JSON schemas parsed, modified runtime modules passed `node --check`, and `git diff --check` passed.
- Task 2: complete (commits `3b2fc97..6373d6f`, independent review clean).
- Task 3: complete at round cap (commits `6373d6f..8f4dbef`, final scoped review APPROVE).
- Task 4: complete at breaker (`8f4dbef..060c7d3`, final independent review C0/I0/M0 APPROVE).
- Task 5: pending
- Task 5: in progress — overlay, shared invalidation, continuity review, and exact derived lifecycle currentness.
- Task 5 ruling: `assertCutsceneContinuityGate` and `deriveCutsceneLifecycle` consume exact `{plan,manifest,waves,continuityReceipt}`. Supplied waves MUST canonically equal `plan.cutsceneWorkflow.waves`; the manifest MUST bind the plan's exact wave/asset/DAG/prompt/target/generation-receipt projection; the receipt MUST bind both current plan and continuity-projection manifest digests. Cost if wrong: completed waves or an unrelated production-candidate manifest can be spliced onto an older plan to manufacture document approval.
- Task 5 ruling: variants are pure derivative metadata. Dialogue-only changes create no image ID; visual changes create deterministic new derivative IDs disjoint from base IDs and never read/write Task 4 journals, approval capabilities, provider callbacks, or artifact files. Cost if wrong: reusing a successful base ID overwrites approved output and collides with the append-only attempt journal.
- Task 5 ruling: impact closure is seed-exact and downstream-conservative: the changed asset alone is affected in its own wave, while every asset in downstream waves is affected. Per-wave invalidation records only that wave's intersection. Cost if wrong: a single storyboard change invalidates unrelated shots or every wave records an impossible global asset set.
- Task 5 review: C0/I5/M1. Open findings are multi-seed downstream-all closure, repeat invalidation history/validity, accessor/proxy/symbol/cycle snapshot safety, exact completed-wave asset sets, receipt cutscene ID binding, and duplicate finding IDs for the same shot/kind.
- Task 5 fix round 1/5: original implementer resumes; close all six findings with public hostile regressions and preserve the read-only Task 4 boundary.
- Task 5 fix round 1/5 (`f1b5ed4..3475a72`): five Important and one Minor addressed except the hostile snapshot boundary remains open for transparent Proxy traps and top-level impact getters.
- Task 5 fix round 2/5: original implementer resumes; reject Proxy before reflection and snapshot all public impact/invalidation inputs before use.
- Task 5 fix round 2/5 (`3475a72..4f1752e`): Proxy/getter/symbol/cycle boundary closed; final independent review C0/I0/M0 APPROVE.
- Task 5: complete (commits `dcc4043..4f1752e`, public runtime freeze approved).
- Task 6: complete — Studio-only cutscene workflow skill, exact route, document-quality profile, and Career common-runtime/no-route parity delivered; forward fixes are recorded below.
- Task 6 skill baseline: without the new skill, current routing falls back to orchestration/general image skills. It safely performs zero unapproved calls but cannot expose the four cutscene waves, current per-wave cost approval, dialogue-only no-image overlay, failed-ID-only retry, or continuity gate. The new skill MUST close those exact observed gaps without weakening the existing fail-closed image boundaries.
- Task 6 review: C0/I2/M0. The skill incorrectly promises a new/subset estimate before retry although the v2 journal only supports the same still-current full-wave estimate/pricing and remaining reserve; it also over-triggers on generic `prompt`/`continuity` while the content skill description does not exclude cutscene work.
- Task 6 fix round 1/5: align retry guidance with the existing journal epoch and narrow positive/negative frontmatter triggers with executable corpus tests.
- Task 6 fix round 1/5 (`8b63f74..3715b97`): retry guidance and trigger corpus addressed; scoped code review C0/I0/M0 APPROVE.
- Task 6 forward-test finding: the repaired skill correctly stops an unavailable retry, but `runApprovedCutsceneImageWave` itself does not enforce that every predecessor wave is completed before a downstream paid dispatch. This is a load-bearing serial-wave runtime gap, not a wording issue.
- Task 6 fix round 2/5: add a no-I/O predecessor completion guard to the Task 4 public dispatch/retry boundary and prove keyframe/storyboard provider-zero/no-write behavior before declaring the skill deployable.
- Task 6 fix round 2/5 GREEN: `assertCurrent` now rejects every downstream dispatch and explicit retry unless each earlier wave has `state:"completed"` and an exact completed `completion.assetIds` set. The guard runs before plan authority resolution, journal reads/writes, artifact writes, or provider dispatch; the existing closed plan validator remains the source of full plan-shape validation.
- Task 6 fix round 2/5 validation: RED reproduced keyframes/reference-masters and storyboard/keyframes paid dispatches reaching the provider plus retry reading a malformed journal (3 expected guard failures). GREEN gives stable `cutscene.predecessor_wave_incomplete` paths with provider 0 and unchanged complete artifact snapshots; exact completed predecessors retain normal storyboard dispatch and the existing reference retry. Focused Task 4/6 plus Studio/Career contracts → 238 pass, 0 fail; no live provider call.
- Task 6 fix round 3/5 GREEN: `assertCurrent` snapshots `plan` through the existing hostile-input boundary before predecessor reflection, then uses only that snapshot for serial guard, authority, approval, and dispatch. Getter/Proxy/symbol/cycle/unsafe descriptor plans fail `cutscene.hostile_input` with whole-tree no-write; completion diagnostics distinguish missing (`/completion`), wrong kind (`/completion/kind`), and asset-set mismatch (`/completion/assetIds`).
- Task 6 fix round 4/5 RED: initial dispatch read raw `input.plan` and retry destructured/rest-spread raw input, so hostile outer getters or Proxies could write before the plan snapshot; outer symbols, non-enumerable fields, and accessors were also open. Deleted and `undefined` completion values lacked the stable missing diagnostic.
- Task 6 fix round 4/5 GREEN: both public entrypoints normalize one raw envelope first through proxy rejection plus an enumerable-data-descriptor allowlist. Hostile outer getter/Proxy/symbol/non-enumerable/accessor cases now return stable `cutscene.hostile_input` with zero traps/provider/journal writes and complete-tree equality; callbacks, capability, and receipt retain opaque data values. Deleted, `undefined`, and null completion now share `/completion`, while kind and asset mismatches remain precise. Focused Task 4/5/6 plus Studio/Career matrix → 240 pass, 0 fail; temp shared runtime/schema parity and no live calls retained.
- Task 6 fix round 5/5 RED: nested `undefined` support unintentionally admitted root `undefined`, so empty, own-undefined, missing-own, and inherited-only plans reached raw `plan.mode` TypeErrors through both public entrypoints.
- Task 6 fix round 5/5 GREEN: the normalized envelope now requires an own defined `plan` at `/plan`, while the shared snapshot again rejects root undefined but preserves nested undefined for predecessor completion diagnostics. Initial/retry root-plan matrix has provider 0 and whole-tree equality; relevant Task 4/5/6 plus Studio/Career matrix → 167 pass, 0 fail with temp package parity and no live calls.
- Task 5 fix round 2 GREEN: `snapshotCutscenePlainData` uses `node:util` `types.isProxy` before any Reflect/prototype/descriptor access, so transparent Proxy traps execute zero times. Public `findCutsceneImpact` and `invalidateCutsceneDependents` snapshot their full inputs before reading `plan`, `changedAssetIds`, or `reason`; top-level getter, symbol, and cycle inputs reject with stable hostile-input errors.
- Task 5 fix round 2 validation: RED reproduced transparent Proxy pass-through and top-level impact getter access (2 failing new public regressions); GREEN focused cutscene suite → 42 pass, 0 fail. Fresh Task 1–5 plus Task 4 matrix `node --test tests/unit/cutscene-visual-preproduction.test.mjs tests/unit/cutscene-generation-approval.test.mjs tests/unit/generate-openai-images.test.mjs tests/unit/image-asset-plan.test.mjs tests/unit/image-assets.test.mjs tests/unit/image-config.test.mjs tests/unit/image-prompts.test.mjs tests/unit/image-provider.test.mjs tests/unit/smoke-openai-image.test.mjs tests/products/studio/image-assets.test.mjs` → 195 pass, 0 fail; three runtime `node --check`, visual-plan/continuity/usage schema parse, temporary Studio/Career schema byte parity, and diff check passed. No live calls.
- Task 5 fix round 1 GREEN: direct seeds that are also reached downstream now invalidate their full wave; repeated invalidation appends the former record to `invalidationHistory` and returns a valid closed plan without erasing evidence. Overlay/review snapshot descriptor-only plain data before getters/proxies/symbols/cycles can execute. Completed wave completions bind exact wave asset sets; gate/lifecycle bind receipt cutscene IDs; duplicate observation `(shotId,kind)` pairs fail before receipt creation.
- Task 5 fix round 1 validation: RED reproduced all I1–I5/M1 conditions; GREEN matrix `node --test tests/unit/cutscene-visual-preproduction.test.mjs tests/unit/cutscene-generation-approval.test.mjs tests/unit/generate-openai-images.test.mjs tests/unit/image-asset-plan.test.mjs tests/unit/image-assets.test.mjs tests/unit/image-config.test.mjs tests/unit/image-prompts.test.mjs tests/unit/image-provider.test.mjs tests/unit/smoke-openai-image.test.mjs tests/products/studio/image-assets.test.mjs` → 193 pass, 0 fail. Three runtime `node --check`, visual-plan/continuity schema parse, Studio/Career plan+usage+continuity schema byte parity, and `git diff --check` passed. No provider/host/journal/artifact calls are introduced.
- Task 5: fix round 1 complete — one scoped commit follows.
- Task 5 GREEN: `buildVariantOverlay` is exported from the Task 2 planner as pure closed metadata; visual derivatives are deterministic per affected shot and dialogue-only overlays have no image IDs. Public impact remains exact `{waveIds,assetIds}` while a private per-wave projection powers evidence-preserving invalidation.
- Task 5 GREEN: continuity review binds a closed canonical receipt to the exact current plan/manifest and accepts only actual style/reference masters. The continuity digest includes workflow, identity/lineage, prompt/approval, generation, target/output/provider and receipts, while excluding later human review/rights/technical/gameplay data. Gate and lifecycle reject waves or unrelated manifests spliced onto a plan.
- Task 5 validation: targeted RED failures covered missing planner export, per-shot derivative coalescing, closed public impact, forged review manifest, and lifecycle splice. GREEN matrix `node --test tests/unit/cutscene-visual-preproduction.test.mjs tests/unit/cutscene-generation-approval.test.mjs tests/unit/generate-openai-images.test.mjs tests/unit/image-asset-plan.test.mjs tests/unit/image-assets.test.mjs tests/unit/image-config.test.mjs tests/unit/image-prompts.test.mjs tests/unit/image-provider.test.mjs tests/unit/smoke-openai-image.test.mjs tests/products/studio/image-assets.test.mjs` → 189 pass, 0 fail; schema parse, three modified-module `node --check`, temporary Studio/Career continuity-schema byte parity, and `git diff --check` passed. No provider, host, journal, or artifact I/O is reachable from overlay/review/gate.
- Task 5: complete — one scoped commit follows this ledger entry.
- Task 6: complete — Fix rounds 1–5 are recorded above; see Task 6 completion evidence.
- Task 7: source/docs complete — Korean How-to, exact inventories, lifecycle guides, humanize evidence, and the discovered Task 6→7 prompt-template integration repair are complete. Generated `plugins/*` snapshot refresh remains Task 8 ownership.
- Task 8: implementation complete; final contract review pending.

## Task 6 completion evidence

- RED: Studio routing was 13 routes / 22 routed skills and lacked the cutscene
  skill/profile. Generic image routing remained zero-call safe but did not
  expose four serial per-wave estimates/approvals, dialogue-only overlay,
  failed-stable-ID retry, or continuity closure.
- GREEN: initialized `design-cutscene-visual-preproduction` through the
  official skill creator; added its Studio-only route, closed top-level
  `cutsceneWorkflow`, quality profile/index, immutable planner/generator/review
  handoffs, and exact route/inventory/pressure/parity contracts. Studio is now
  routing 23, direct 16, installed 24; Career remains routing 22, direct 15,
  installed 23 with no Studio cutscene route or skill.
- Validation: official skill `quick_validate.py` passed; Task 6 product
  contracts passed 5/5; focused Task 1–6 source matrix passed 104/104; JSON
  parse and `git diff --check` passed. Temporary Studio/Career builds have
  byte-identical five cutscene runtime modules and five schema files.
- Broader product image matrix retains two pre-existing Career host-callback
  failures (`host unavailable`, `throw-secret-never-persist`) in
  `tests/products/career/image-assets.test.mjs`; Task 6 did not change that
  runtime or Career image skills. See `task-6-report.md`.
