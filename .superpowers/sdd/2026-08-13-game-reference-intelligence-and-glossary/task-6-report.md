# Task 6 report — package reference intelligence safely

## Status

Implemented and verified. The source contracts now append the canonical `reference-intelligence` module after the existing ten shared modules; a fresh Studio or Career build contains exactly 23 skills (15 direct + 8 shared).

## RED / GREEN evidence

### RED

`node --test tests/unit/build-product.test.mjs tests/contracts/reference-intelligence-package.test.mjs`

- The new package test failed before implementation with `Unknown shared module: reference-intelligence` from the closed product-contract allowlist.
- The negative fixtures consequently could not yet reach the package guard; this established that the module mapping and allowlist were both absent.

### GREEN

- Step 5 command: `node --test tests/unit/build-product.test.mjs tests/contracts/shared-contract.test.mjs tests/contracts/reference-intelligence-package.test.mjs tests/e2e/suite/memory-install-lifecycle.e2e.test.mjs` → 56 pass, 0 fail.
- `node --test tests/isolation/plugin-smoke.test.mjs tests/products/studio/product-contract.test.mjs tests/products/career/product-contract.test.mjs` → 30 pass, 0 fail.
- `node tooling/isolation-smoke.mjs` → Studio and Career both PASS with 23 exact skills.
- `node --check` for every changed MJS, parse of every repository JSON document, and `git diff --check 026f1d2` → exit 0.

## Delivered contract

- `reference-intelligence` maps only its two skills plus frozen schema, catalog, references, and template roots. Each root has an exact source inventory; unexpected files, environment files, credentials-by-inventory, symlinks, special files, and product collisions fail before the output directory is created.
- Fresh Studio/Career builds prove byte identity for both skills and the reference package; their compilerless source and installed graphs permit only `node:*` or contained relative imports. The smoke imports both public skill runtimes and the Task 4 glossary evaluator with empty `PATH` and invalid `CC`/`CXX`.
- Lifecycle builds/install/replace/remove preserve `.game-design`, `.git/info/exclude`, unrelated plugin siblings, and create no private reference cache paths.
- Isolation keeps committed generated plugins untouched, layers the reference package from a temporary build fixture, validates the closed installed/source skill contracts before classifying the three source-runtime declarations as inactive, and keeps any other escape fail-closed.

## Scope note

`tooling/lib/product-contract.mjs` received the approved one-item allowlist extension. `tooling/lib/user-guides.mjs`, the two product contract suites, and the isolation suite update only the exact installed 21→23 inventory; Task 5’s ordered 22 route IDs and Studio’s 13 route shapes remain unchanged. No generated `plugins/` output was modified.
