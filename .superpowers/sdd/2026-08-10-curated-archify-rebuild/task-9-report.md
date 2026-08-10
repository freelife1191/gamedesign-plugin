# Task 9 — Suite Archify specification report

## Final status

- **Status:** complete
- **Commit:** this commit (`docs: author evidence-backed Suite Archify specs`)
- **Selected entry:** `suite-studio-career-handoff` (the only selected Suite entry)
- **Catalog state:** `auto-validated` / `pending`; diagnostics are empty and reviewer is `null`.
- **Scope isolation:** the existing Studio `blocked-validation` and Career `auto-validated` states were not changed.

## Authored boundary

`guides/archify-diagrams/specs/suite/suite-studio-career-handoff.json` is a fresh seven-node `dataflow` specification. It names the exact `Studio boundary` and `Career boundary`, moves only a public/evidence-safe summary, keeps the artifacts separate, requires a named human decision owner, and returns a held handoff to that same public-only review after a receipt is available. It does not merge either product's internal graph.

## Validation evidence

The first portable-resolver validation was retained as a raw failure record before repair:

```text
{ "ok": false, "command": "validate", "stage": "render", "type": "dataflow" }
Data-flow layout validation failed:
- public-evidence and owner labels/sublabels exceeded their available node width
- the return route crossed the held-handoff node
- same-stage hold/resume segments were below the showcase micro-segment floor
- flow labels overlapped their endpoints and one another
- stages exceeded the original viewBox width
```

Focused repairs reduced the multi-error first run to 8, 6, and then 1 remaining error before the final route-label clearance adjustment. The frozen final candidate passed the portable resolver with all nine artifact checks and a showcase composition result of `errors: 0`, `warnings: 0`.

The staged delivery receipt is present at `.tmp/curated-archify/current/suite/suite-studio-career-handoff.receipt.json`:

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

- `node --test --test-name-pattern='Suite' tests/contracts/archify-specs.test.mjs` — 3 passed.
- `npm run build:curated-archify -- --product suite` — staged only `suite-studio-career-handoff`.
- `node --test tests/contracts/archify-specs.test.mjs tests/unit/archify-signature.test.mjs` — 44 passed.
- `npm run validate:archify-catalog` — passed.
- `git diff --check` — passed.

## Concerns

- The generated HTML and receipt remain staged in `.tmp/`; publication and human visual review are intentionally out of scope, so the catalog remains `pending` rather than claiming a visual review.
- No browser, artifact opening, or preview command was used.
