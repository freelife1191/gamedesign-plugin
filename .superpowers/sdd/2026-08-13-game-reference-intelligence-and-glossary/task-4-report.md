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

## Fix round 2/5 — RED → GREEN

### RED

Command: `node --test --test-name-pattern='decision provenance|schema extension|terminology restores' tests/unit/game-design-glossary.test.mjs`

Output: `ERR_MODULE_NOT_FOUND` for `shared/scripts/lib/game-design-glossary-schema-evaluator.mjs`; `tests 1`, `pass 0`, `fail 1`.

Why expected: the prior implementation had no executable schema-extension evaluator for NFC/whole-document size constraints, no sensitive-decision rejection, and no dedicated recovered terminology diagnostic coverage.

### Non-vacuity evidence

- Removed the credential/path-sensitive predicate from the production capability issuer; `node --test --test-name-pattern='decision provenance rejects sensitive' tests/unit/game-design-glossary.test.mjs` failed with `Missing expected exception` for `password=SECRET-SENTINEL`.
- Removed the production `multiple-preferred-terms` branch; `node --test --test-name-pattern='terminology restores preferred-pair' tests/unit/game-design-glossary.test.mjs` failed because the expected blocking finding disappeared.

Both isolated source mutations were restored before final verification. Existing real-filesystem artifact tests retain symlink/special-leaf/no-write coverage; transaction staging remains private and exposes no failure-injection hook.

### Implementation and self-review

- Added a packaged production evaluator `game-design-glossary-schema-evaluator.mjs` that verifies an exact executable schema annotation and fail-closes missing, unknown, or altered extension contracts while enforcing NFC/control/2 MiB/effective-term constraints.
- Restored pre-Task4 reference-analysis text policy and introduced glossary-only stricter canonical checks; a reference-analysis tab regression now proves the unchanged legacy behavior.
- Rejected sensitive actor/reason strings both at issuing time and immediately before artifact serialization; findings now accept the three ledgered dedicated English writing codes.
- Restored token-bound bilingual preferred-pair blocking; explicit closed replacement-attempt evidence is the only path to `semantic-auto-replacement`; ordinary co-occurrence remains non-blocking.

### GREEN

- `node --test tests/unit/game-design-glossary.test.mjs tests/unit/reference-intelligence.test.mjs` → `tests 64`, `pass 64`, `fail 0`.
- `node --check shared/scripts/lib/game-design-glossary-schema-evaluator.mjs shared/scripts/lib/game-design-glossary-capabilities.mjs shared/scripts/manage-game-design-glossary.mjs shared/scripts/validate-game-design-writing-language.mjs shared/scripts/validate-reference-intelligence.mjs` → exit 0.
- JSON parse of `game-design-glossary.schema.json` and `glossary-receipt.schema.json` → exit 0.
- `git diff --check` → exit 0.

Remaining concern: package mirror layout is owned by the later packaging task; this round adds the source production evaluator and verifies it against the source schema contract.

## Fix round 3/5 — RED → GREEN

### RED

Command: `node --test tests/unit/game-design-glossary.test.mjs`

Output: `✖ schema extension and runtime fail closed for strict canonical effective glossary limits`; `AssertionError: true !== false` for an empty `effective` glossary; `tests 18`, `pass 17`, `fail 1`.

Why expected: the first declarative evaluator pass loaded the schema but the schema only made `shared` non-empty, so the required `effective` scope boundary still passed. The new test catches removal of the effective `allOf` condition; the 256/257 `examples` case catches removal of the evaluator's `maxItems` branch.

### Implementation and non-vacuity review

- Replaced the static JSON import and extension-only check with one packaged evaluator that safely resolves only the source/installed fixed paths, requires byte equality when both exist, and executes the schema's closed keyword set (`type`, object/array/string constraints, composition, conditionals, references, and extension). Unsupported keywords, unknown root keys/extensions, malformed UTF-8/JSON, missing/symlink/special leaves, and altered annotation/identity fail closed.
- Added the effective scope declarative condition. `validateGameDesignGlossary` now delegates structural bounds to that evaluator and retains only deterministic ordering, ambiguity, lifecycle, and graph semantics, avoiding duplicated structural constraints.
- Added a real temporary production-layout import smoke: copied evaluator/canonical helper/schema succeeds with source-only and equal installed mirrors, then fails for mismatch, invalid UTF-8/JSON, missing, symlink, and special schema leaves. It does not modify Task 6's product mirror.
- Added exact 256/257 array, exact 2 MiB/2 MiB+1 UTF-8, BOM/NUL/control/NFD/CR, empty effective, unknown schema key/order/duplicate, lifecycle cycle/missing replacement, and override hash/changed-ID regressions.
- Added literal one-case diagnostic assertions for abbreviation, forbidden/deprecated, translation, ambiguity, bilingual preferred pair, explicit semantic replacement/false-positive, case/plural drift, heading/fragment, and locale mix.
- Added a test-only copied-module harness that wraps the private safe writer dependency (no public hook), throws on the second final publish after all staged writes, and proves exact preexisting tree byte/path equality plus no leftover stage directory. This catches removal or corruption of production rollback behavior.

### GREEN

- `node --test tests/unit/game-design-glossary.test.mjs tests/unit/reference-intelligence.test.mjs` → `tests 67`, `pass 67`, `fail 0`.
- `node --check shared/scripts/lib/game-design-glossary-schema-evaluator.mjs`; `node --check shared/scripts/validate-reference-intelligence.mjs`; `node --check shared/scripts/manage-game-design-glossary.mjs`; `node --check tests/unit/game-design-glossary.test.mjs` → all exit 0.
- `node -e 'for (const file of ["shared/reference-intelligence/schema/game-design-glossary.schema.json"]) JSON.parse(require("node:fs").readFileSync(file,"utf8")); console.log("schema parse: ok")'` → `schema parse: ok`.
- `git diff --check` → exit 0.

### Files changed

- `shared/reference-intelligence/schema/game-design-glossary.schema.json`
- `shared/scripts/lib/game-design-glossary-schema-evaluator.mjs`
- `shared/scripts/manage-game-design-glossary.mjs`
- `shared/scripts/validate-reference-intelligence.mjs`
- `tests/unit/game-design-glossary.test.mjs`

### Concerns

The safe artifact boundary is function-level failure atomicity only, not crash-wide filesystem atomicity. The installed-layout proof is deliberately temporary; product Studio/Career packaging remains Task 6 ownership.

## Fix round 4/5 — RED → GREEN

### RED

- `node --test --test-name-pattern='declarative schema authority|terminology emits only explicit' tests/unit/game-design-glossary.test.mjs` → `tests 2`, `pass 0`, `fail 2`. The installed schema symlink leaf was silently filtered and source schema still loaded (`true !== false`); a valid effective glossary's unselected proposed term produced `stale-glossary-receipt` rather than `unapproved-term`.
- `node --test --test-name-pattern='terminology emits only explicit' tests/unit/game-design-glossary.test.mjs` → `Missing expected exception` for a copied mapping observation. This proved the new closed evidence test would catch acceptance of copied evidence.

### Implementation and self-review

- Fixed candidates now distinguish only `ENOENT` absence. Any present source or installed candidate verifies every bounded lexical ancestor and leaf through `lstat`/`realpath` identity checks; symlink, non-directory ancestor, special leaf, race-changed identity, invalid UTF-8/JSON, unknown schema, and byte-mismatched mirrors all produce the existing generic schema-unavailable result without path or byte disclosure.
- Replaced the count-based rollback harness with an exact-one source-transform test wrapper. It separates staging from the six exact final paths by canonical artifact root and relative path, allows the first final publish, then fails the second. The bounded 12-second child process proves byte/path restoration and no stage directory while avoiding a production test hook.
- Unselected proposed terms now issue `unapproved-term`; Korean documents issue value-minimal `unnecessary-english` only for English expressions absent from approved preferred/allowed labels. Optional frozen, exact-shape mapping observations issue `missing-bilingual-mapping` only for a selected concept; copied/proxied/unknown observations fail closed and selected-term mismatch is stale. No normal bilingual glossary infers the blocking code.

### GREEN

- `node --test tests/unit/game-design-glossary.test.mjs tests/unit/reference-intelligence.test.mjs` → `tests 68`, `pass 68`, `fail 0`.
- `node --check shared/scripts/lib/game-design-glossary-schema-evaluator.mjs`; `node --check shared/scripts/manage-game-design-glossary.mjs`; `node --check tests/unit/game-design-glossary.test.mjs` → all exit 0.
- JSON parse of `shared/reference-intelligence/schema/game-design-glossary.schema.json` → `schema parse: ok`.
- `git diff --check` → exit 0.

### Files changed

- `shared/scripts/lib/game-design-glossary-schema-evaluator.mjs`
- `shared/scripts/manage-game-design-glossary.mjs`
- `tests/unit/game-design-glossary.test.mjs`

### Concerns

The schema read checks identity before and after the bounded read, providing function-level TOCTOU detection rather than a cross-process filesystem lock. FIFO coverage is skipped only on Windows where `mkfifo` is unavailable.
