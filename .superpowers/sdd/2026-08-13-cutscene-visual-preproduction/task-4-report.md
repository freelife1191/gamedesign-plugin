# Task 4 — Per-attempt dispatch and usage receipts

## Delivered

- OpenAI `beforeProvider` now runs once per physical provider attempt with a
  one-based `attempt_ordinal`; a retry cannot inherit prior authorization.
- The cutscene stage rejects every non-`generate-after-approval` mode before
  authority validation, provider use, or artifact writes.
- The stage rebuilds its authorization from the current Task 2 plan/manifest
  and generation-ready package, Task 3 approval pair, pricing snapshot,
  estimate, attempt state, and supplied clock.  The public
  `authorizeProviderAttempt` input is intentionally ignored.
- Host generation retries transient generation failures and executes the same
  per-attempt callback and reference revalidation before each host delivery.
- Usage receipt creation uses create-once safe artifact writes beneath the
  wave/asset/attempt/request path and calculates USD only from a complete
  cached-token breakdown.

## Validation

`node --test tests/unit/cutscene-generation-approval.test.mjs tests/unit/generate-openai-images.test.mjs tests/products/studio/image-assets.test.mjs tests/unit/image-assets.test.mjs`

Result: 83 passing, 0 failing.

`node --check` passed for all three changed runtime modules; `git diff --check`
passed.

## Fix round 1

- Provider dispatch callbacks now carry an opaque per-attempt record from
  preflight through response handling. OpenAI records request ID, normalized
  usage when supplied, and a truthful unavailable usage status otherwise.
- Usage records are immutable, create-once artifact receipts. A repeated
  attempt/request path is rejected rather than overwritten.
- Attempt preflight reads the existing per-wave receipt ledger and treats
  caller `attemptState` as a stale-detection expectation only.
- Retry input is a sorted failed-ID subset and unknown providers fail closed.

Validation after Fix round 1: 84 passing, 0 failing across the Task 4 four
suite command; syntax checks and `git diff --check` passed.

## Fix round 2

- Receipt ledger scanning now spans the complete current wave, including
  non-selected assets during a retry.
- A malformed OpenAI 2xx image payload is recorded as a provider failure, not
  a successful provider attempt.
- Host physical dispatches persist an unavailable-usage receipt before
  propagating malformed/publication errors; those errors are not retried.

Validation after Fix round 2: 84 passing, 0 failing; syntax and diff checks
passed.

## Fix round 4 — v2 cost authority and attempt journal

- Cost estimates are now closed v2 documents with UTF-8 ordered per-asset
  request hashes and caller-supplied finite attempt ceilings. Heterogeneous
  totals use `baseline + retryReserve * max(ceiling)`. Missing, zero, malformed,
  or incomplete quote evidence produces `costStatus: "unavailable"` with null
  totals and blocks approval and paid dispatch.
- Task 3 approval issuance rebuilds the immutable Task 2 dispatch snapshot and
  binds the complete v2 estimate digest. A canonically resealed estimate with
  a request schedule that differs from the current manifest is stale. The
  existing live receipt/capability identity remains the only approval authority.
- Each attempt now has create-once v2 authorization and outcome records with a
  wave-global sequence, per-asset ordinal, canonical hash, path binding, exact
  request/pricing/estimate/ceiling binding, and truthful provider-versus-asset
  outcome. An artifact-local atomic sequence lock prevents concurrent wave
  invocations from reserving the same global sequence. Pending or
  unavailable-cost physical attempts charge their full ceiling; `not-called`
  records charge zero and do not consume retry reserve.
- Ledger state preserves retry consumption across fail-to-success transitions,
  uses the highest outcome ordinal for current retry eligibility, and includes
  maximum remaining unattempted work in every candidate budget check.
- The provider adapter consumes one frozen ephemeral snapshot and adds
  `prompt_digest = prompt_sha256` only to that snapshot. It no longer loads a
  second workspace configuration or rewrites the Task 2 manifest. The obsolete
  public authorization callback is rejected before dispatch.
- OpenAI and host paths persist final outcomes after transport, response,
  image validation, and publication are known. Only explicit transient provider
  failures retry. Host batch authorization closes already-created
  authorizations as `not-called` when a later authorization fails.
- Explicit failed-subset retry accepts only assets whose latest outcome is
  retryable and proves the canonical physical digest of unrelated outputs,
  state, and receipts is unchanged.

### Migration and reapproval

There is no compatibility fallback or cost backfill. Existing v1 estimates,
approval receipts, and usage records fail closed. Regeneration requires a new
v2 estimate from the current closed Task 2 plan, generation-ready package,
immutable manifest, current pricing snapshot, and exact finite per-asset quote
ceilings, followed by a new named-human v2 approval/live capability pair. Old
journal artifacts cannot be mixed with v2 records; generation must use a fresh
v2 journal root after the old evidence is retained outside the active artifact
root according to the caller's retention policy.

### TDD and validation evidence

Focused RED/GREEN stages covered estimate/schema v2, journal sequence and cost
math, the Task 2 adapter, OpenAI outcomes, host outcomes, the real
Task 2 → Task 3 → Task 4 path, unrelated-tree retry hashing, forged ceiling and
partial-host-authorization cases, latest-outcome eligibility, and v1 reapproval.

`node --test tests/unit/cutscene-visual-preproduction.test.mjs tests/unit/cutscene-generation-approval.test.mjs tests/unit/generate-openai-images.test.mjs tests/unit/image-asset-plan.test.mjs tests/unit/image-assets.test.mjs tests/products/studio/image-assets.test.mjs`

Result: 140 passing, 0 failing. All provider calls in this matrix use injected
fixtures; no live provider or network call is made.

The three changed JSON schemas parse successfully. `node --check` passes for
all six changed runtime modules, and staged diff checks pass.
