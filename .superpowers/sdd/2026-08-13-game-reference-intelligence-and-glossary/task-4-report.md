# Task 4 report — glossary lifecycle and terminology validation

## Implementation summary

- Added module-private `WeakMap` human-decision capabilities; copied, frozen, plain, proxied, altered, role-like, duplicate-ID, channel, and unsupported-action decisions fail closed.
- Extended unreleased v1 glossary schema/runtime parity to the exact 21-field term contract, canonical ordering, closed nested grammar, NFC/LF/control/size checks, and approved-only snapshot selection.
- Added deterministic shared/project merge, decision transitions with exact retry binding, proposal-only candidates, snapshot-bound terminology findings, Korean/English handoffs, and fixed-path safe artifact projection.
- Findings are minimal `{code,termId?}` values; no source text or rewritten text is returned.

## RED evidence

Command: `node --test tests/unit/game-design-glossary.test.mjs`

Output: `ERR_MODULE_NOT_FOUND` for `shared/scripts/lib/game-design-glossary-capabilities.mjs`; `tests 1`, `pass 0`, `fail 1`.

Why expected: the new required public capability/lifecycle modules did not exist before production implementation.

## Non-vacuity mutation evidence

- Removed the receipt-to-capability `WeakMap` binding; `node --test --test-name-pattern='live human authority' tests/unit/game-design-glossary.test.mjs` failed with `Missing expected exception` at the copied-receipt assertion.
- Removed the glossary hash/version guard; `node --test --test-name-pattern='approval transition matrix' tests/unit/game-design-glossary.test.mjs` failed because replay incremented version `2` to `3`.
- Added a forbidden `revisedText`; `node --test --test-name-pattern='terminology finds stale receipt' tests/unit/game-design-glossary.test.mjs` failed because the field was present.

All three mutations were restored before GREEN verification.

## GREEN evidence

- `node --test tests/unit/game-design-glossary.test.mjs tests/unit/reference-intelligence.test.mjs` → `tests 57`, `pass 57`, `fail 0`.
- `node --check shared/scripts/lib/game-design-glossary-capabilities.mjs shared/scripts/manage-game-design-glossary.mjs shared/scripts/validate-game-design-writing-language.mjs shared/scripts/validate-reference-intelligence.mjs` → exit 0.
- `node -e 'for (const p of process.argv.slice(1)) JSON.parse(require("fs").readFileSync(p,"utf8"))' shared/reference-intelligence/schema/game-design-glossary.schema.json shared/reference-intelligence/schema/glossary-receipt.schema.json` → exit 0.
- `git diff --check` → exit 0.

## Files changed

- `shared/scripts/lib/game-design-glossary-capabilities.mjs`
- `shared/scripts/manage-game-design-glossary.mjs`
- `shared/scripts/validate-game-design-writing-language.mjs`
- `shared/scripts/validate-reference-intelligence.mjs`
- `shared/reference-intelligence/schema/game-design-glossary.schema.json`
- `tests/unit/game-design-glossary.test.mjs`

## Self-review and concerns

Reviewed all Task 4 diffs for closed input handling, hash/capability replay rules, deterministic UTF-8 order, safe artifact paths, input immutability, and diagnostics leakage. The fix round now requires `documentId` at terminology-validation time and compares it to the snapshot receipt.

## Fix round 1/5 — RED → GREEN

### RED

Command: `node --test --test-name-pattern='shared semantic overrides|lifecycle, document selection' tests/unit/game-design-glossary.test.mjs`

Output: `SyntaxError: ... does not provide an export named 'assertGlossaryOverrideDecision'`; `tests 1`, `pass 0`, `fail 1`.

Why expected: the existing two-argument merge had no live, hash-bound override provenance API and did not carry document selection binding.

### Implementation and self-review

- Added separate WeakMap-backed override provenance binding shared/overlay hashes, exact override IDs, reason, actor, timestamp, and event; colliding semantic overlays require it while add-only overlays remain pure.
- Enforced lifecycle state invariants, replacement graph checks, effective v1 scope parity, document/selected-term receipt binding, closed findings, sensitive persisted-value rejection, canonical size/control limits, and token-aware terminology scanning.
- Reworked projection into a function-level staged transaction with preflight leaf validation, rollback of file bytes/new targets, and cleanup of created directories. This is function-level failure atomicity; it deliberately does not claim crash-wide filesystem atomicity.
- Reviewed final diff for receipt hash/scope parity: `terms.json` stores the exact `effective` object and a fresh parsed terms/receipt pair validates successfully.

### GREEN

- `node --test tests/unit/game-design-glossary.test.mjs tests/unit/reference-intelligence.test.mjs` → `tests 60`, `pass 60`, `fail 0`.
- `node --check shared/scripts/lib/game-design-glossary-capabilities.mjs shared/scripts/manage-game-design-glossary.mjs shared/scripts/validate-game-design-writing-language.mjs shared/scripts/validate-reference-intelligence.mjs` → exit 0.
- JSON parse of `game-design-glossary.schema.json` and `glossary-receipt.schema.json` → exit 0.
- `git diff --check` → exit 0.

Remaining concern: none identified within Task 4 scope.
