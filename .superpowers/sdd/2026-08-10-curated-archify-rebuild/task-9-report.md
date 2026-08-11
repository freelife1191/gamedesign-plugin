# Task 9 — Suite Archify specification report

## Final status

- **Status:** complete (Fix2: resolver, receipt, re-delivery provenance, and safety mutation contracts)
- **Commit:** this commit (`test: verify Suite Archify delivery provenance`)
- **Selected entry:** `suite-studio-career-handoff` (the only selected Suite entry)
- **Catalog state:** `auto-validated` / `pending`; diagnostics are empty and reviewer is `null`.
- **Scope isolation:** the existing Studio `blocked-validation` and Career `auto-validated` states were not changed.

## Authored boundary

`guides/archify-diagrams/specs/suite/suite-studio-career-handoff.json` is a fresh seven-node `dataflow` specification. It names the exact `Studio boundary` and `Career boundary`, moves only a public/evidence-safe summary, keeps the artifacts separate, requires a named human decision owner, and returns a held handoff to that same public-only review after a receipt is available. It does not merge either product's internal graph.

## Validation evidence

The historical 8 → 6 → 1 repair candidates and their raw streams were not tracked. They are therefore not represented as preserved evidence and are not reconstructed or presented as raw output here.

The tracked, reproducible final evidence is under `guides/archify-diagrams/validation-evidence/suite-studio-career-handoff/`:

- `manifest.json` records a repo-relative validator argv, the exact resolved CLI `provider`, `version`, SHA-256, and bytes, source-spec hash/bytes, path-normalized stdout hash/bytes, empty stderr hash/bytes, and receipt digest binding.
- `final.validate.stdout.json` is the final validate stdout after replacing only the workspace-root prefix in `input` with the repo-relative candidate path; no host absolute path is persisted.
- `final.receipt.json` is the 9/9/0/0 delivery receipt bound to the same source-spec digest.

The final candidate passed the portable resolver with all nine artifact checks and a showcase composition result of `errors: 0`, `warnings: 0`.

Fix2 parses the tracked persisted receipt through the production delivery-receipt validator after restoring its validation envelope, verifies its stable input/output paths and every 9/9/0/0 showcase field, then re-delivers the tracked spec through the guarded per-ID staging builder and binds the actual staged HTML SHA-256 and bytes to the tracked receipt. The contract also fails provider/version/hash/bytes and receipt command/type/quality/input/output/composition/artifact-digest mutations.

The tracked final receipt is:

```json
{
  "ok": true,
  "command": "deliver",
  "checksPassed": 9,
  "checkCount": 9,
  "errors": 0,
  "warnings": 0,
  "specification": {
    "sha256": "9e83f69a5ea19e08c5e051f3cb8d48e13f90cac7b1c4857daa43a7e6b9fb7787",
    "bytes": 5255
  },
  "artifact": {
    "sha256": "39b2ca5d9fc35c6996a77dfd97e309b761ff76982aee8cd292e853acb6a0d693",
    "bytes": 610931
  }
}
```

## Tests and checks

- `node --test --test-name-pattern='Suite|state-aware materialization' tests/contracts/archify-specs.test.mjs tests/contracts/archify-catalog.test.mjs` — catalog integration and Suite contracts passed.
- `npm run build:curated-archify -- --product suite` — staged only `suite-studio-career-handoff`.
- `npm run build:curated-archify -- --id suite-studio-career-handoff` — staged the exact Suite entry only.
- `node --test tests/contracts/archify-specs.test.mjs tests/contracts/archify-catalog.test.mjs tests/unit/archify-signature.test.mjs tests/unit/archify-delivery.test.mjs` — 93 passed.
- `npm run validate:archify-catalog` — passed.
- `git diff --check` — passed.

## Concerns

- The generated HTML remains staged in `.tmp/`; publication and human visual review are intentionally out of scope, so the catalog remains `pending` rather than claiming a visual review.
- No browser, artifact opening, or preview command was used.
