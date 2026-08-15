# Task 6 Report — Scheduled Maintainer Check and Archify 2.14

## Result

- Added the read-only aggregate maintainer audit: `npm run check:updates` emits deterministic JSON and uses exit `0` (all current), `2` (outdated), or `1` (unknown/invalid).
- Added `npm run validate:release:latest`, which requires a fresh aggregate-current result before invoking the existing release validator.
- Added the weekly, manually dispatchable GitHub workflow with `contents: read`; it writes the JSON to `$GITHUB_STEP_SUMMARY`, makes no update call, and never commits.
- Updated the trusted Archify vendor closure from `v2.13.0` to the verified `v2.14.0` release asset (`sha256:1b610a4d8ff5821cccd7a3dfe2d0943d11e64bda1d2fb0511944df190472f175`, immutable commit `a3bf80c25a824f5d5c46dfdbfdb96cc52dd4742a`, 62 files, MIT).
- Refreshed the active catalog origin paths and source digests, provenance notices, and the generated product snapshots needed for byte-identical vendor mirrors.

## TDD and update evidence

- RED: `node --test tests/unit/check-suite-updates.test.mjs` failed as expected before the aggregate checker and workflow existed.
- GREEN: the same test has four passing cases for current/outdated/unknown classification and the workflow contract.
- Update RED: before the trusted updater, `npm run check:updates` returned Archify `outdated`, installed `v2.13.0`, latest `v2.14.0`, and exit `2`.
- Trusted update: `npm run update:diagram-archify` reported `{"name":"archify","tag":"v2.14.0","verifiedFiles":62}`. The official release notes and exact v2.13.0..v2.14.0 tree diff were reviewed before regeneration; upstream added the visual checker/text-fitting support and updated renderer/template/runtime assets.
- Update GREEN: `npm run check:updates` now reports all three components current, including Archify `v2.14.0`.

## Integration scope ruling

The Task 5 shared inspector legitimately declares both product IDs in `const PLUGINS = new Set(["game-design-studio", "game-design-career"])`. That declaration blocked the authoritative snapshot build because tree-audit interpreted either literal as a cross-package reference. Task 6 adds a single exact-path, exact-declaration allowance only for `scripts/inspect-game-design-plugin-updates.mjs`.

- RED: the new fixture was rejected by tree-audit before that allowance.
- GREEN: both Studio and Career audits accept only the exact declaration; the same regression test appends `import sibling from "game-design-career"` and proves it is still rejected.

Per the approved scope ruling, Task 6 ran the authoritative snapshot build to restore source/generated parity after the lock update. This duplicates the final Task 7 snapshot build that will follow its README/version work; that duplicate cost is intentional and recorded here. No vendor mirror was hand-edited.

## Verification

- `node --test tests/unit/check-suite-updates.test.mjs tests/unit/diagram-skill-vendor.test.mjs tests/contracts/archify-catalog.test.mjs tests/isolation/no-cross-package-paths.test.mjs` — 73 passing, 0 failing.
- `npm run check:diagram-skills` — Skillstead 55-file and Archify v2.14.0 62-file closures verified.
- `npm run validate:archify-catalog` — PASS.
- `npm run build:curated-archify` and `npm run check:curated-archify` — staged and checked all four curated entries.
- `node tooling/build-archify-contact-sheets.mjs --check` — checked all seven contact-sheet outputs.
- `npm run validate:release:latest` — current aggregate JSON followed by release validation PASS.
- `git diff --check` — PASS.

## Visual gate

Changed PNG count: **0** (`git diff --name-only -- '*.png'`). Therefore there were no changed raster images to open at original resolution and no overlap, clipping, or tofu findings to correct. Curated structural/visual artifact checks and contact-sheet checks passed without publishing changed diagram PNGs.

## Concerns

- The official snapshot builder retains its recovery bundle at `/private/var/folders/99/kpfx0mdj3fvbczqpbncjl0bm0000gn/T/snapshot-recovery-p6UoaM` until its installed snapshots are accepted. It is outside the repository and was not modified further.
- No changes were made to the installed Codex cache, user marketplace, or `docs/LLM WIKI/`.

## Fix Round 1 — manifest parity and safe rejected-dependency evidence

### RED

- `node --test tests/unit/check-suite-updates.test.mjs tests/unit/validate-suite.test.mjs` failed before the fix: a true rejected diagram dependency emitted no stderr evidence, and the update-manifest stage was absent from the release suite.
- Before regeneration, central and generated plugin `installed-components.json` still declared Archify `v2.13.0`/`2c1f8ac2ca28a26d0b68043ec80c9554e20ff0e3` while the verified vendor lock declared v2.14.0.

### GREEN

- Ran the deterministic `node tooling/generate-update-manifest.mjs` first, then the authoritative `node tooling/build-snapshots.mjs`. The central manifest and both generated plugin manifests now declare Archify `v2.14.0` at `a3bf80c25a824f5d5c46dfdbfdb96cc52dd4742a`; both `BUILD-MANIFEST.json` files were regenerated.
- Added the mandatory `update manifest` release-suite stage: `node tooling/generate-update-manifest.mjs --check`. Its regression asserts the exact command, and the committed manifest check passes.
- A true dependency rejection now emits only closed evidence, one line per affected component: `UPDATE_CHECK_FAILED component=<known-id> code=DEPENDENCY_REJECTED`. The rejection regression proves result `unknown`, exit `1`, and absence of the synthetic raw `403`/token/path body.
- Focused suite: 85 passing, 0 failing. `check:diagram-skills`, manifest `--check`, catalog, curated stage/check, contact-sheet check, and clean snapshot build all pass. Changed PNG count remains **0**; consequently there are no original-resolution PNGs to inspect and no overlap, clipping, or tofu findings.

### External latest-check state

At the final live audit the GitHub REST core limit was exhausted (`403`, `x-ratelimit-remaining: 0`, reset `2026-08-15T11:39:00Z`). Therefore `npm run check:updates` and `npm run validate:release:latest` correctly fail closed with safe stderr evidence and the unchanged unknown JSON/exit-1 contract; no response body, path, token, or stack was exposed. This is an external rate-limit verification gap, not a manifest or closure mismatch. The earlier Task 6 live GREEN had already reported all components current, and the regenerated manifest proves the installed Archify value is now v2.14.0.
