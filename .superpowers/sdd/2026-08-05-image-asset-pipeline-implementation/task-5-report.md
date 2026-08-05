# Task 5 Report — Product Image Workflows

## RED evidence

- `node --test tests/products/studio/image-assets.test.mjs` initially failed because `skills/plan-image-assets/SKILL.md` did not exist; each Studio plan, generate, and review contract was added and failed before its skill implementation.
- `node --test tests/products/career/image-assets.test.mjs` likewise failed first for each missing Career workflow, then for missing role/routing integration.
- `node --test tests/unit/capability-probe.test.mjs` failed because `capabilities.image_generation` and redacted `imageConfig` were absent.
- `node --test tests/unit/stop-artifact-review.test.mjs` failed because a final Markdown derivative could bind a `concept-draft` image without an `image.approval_required` gate.
- `node --test tests/contracts/hooks.test.mjs` failed because SessionStart did not announce read-only image capability probing.

## Changes and design

- Added plan/generate/review image workflow skills for Studio and Career, each with concise `Use when...` triggers and skill UI metadata.
- Planning performs profile-slot preflight, preserves explicit quantities/placeholders/stable IDs, emits manifest and dual prompt-package paths, and hands Skillstead SVG/@2x PNG accessibility/lint/render/QA evidence to the separate visualization authority.
- Generation delegates selection and provider policy to the existing shared scripts: explicit stable IDs for `select`, OpenAI-only with a key and no fallback, host-only without a key when available, otherwise prompts/placeholders; host model/quality is never invented.
- Review requires actual named-human user decision evidence and artifact-local evidence, preserves `concept-draft -> document-approved -> production-candidate`, and blocks final derivatives below document approval.
- Added specialist roles, routing registration, and orchestrator handoffs without granting either role approval authority.
- SessionStart remains read-only/no-network while publishing redacted image configuration and discoverable host capability status. Stop validates image manifests, preserves existing marker/path/symlink protections, requests at most one corrective pass, and never invokes image generation.

## GREEN evidence

```text
for product in game-design-studio game-design-career; do
  for skill in plan-image-assets generate-image-assets review-image-assets; do
    python3 /Users/freelife/.codex/skills/.system/skill-creator/scripts/quick_validate.py "products/$product/plugin/skills/$skill"
  done
done
# Skill is valid! (6/6)

node --test tests/products/studio/image-assets.test.mjs tests/products/career/image-assets.test.mjs tests/products/studio/product-contract.test.mjs tests/products/career/product-contract.test.mjs tests/unit/capability-probe.test.mjs tests/unit/stop-artifact-review.test.mjs tests/contracts/hooks.test.mjs
# 49 tests passed, 0 failed
```

## Remaining risks

- Normal verification intentionally performs no live provider or host-image call. The workflows retain prompts/placeholders and require a separate opt-in live smoke for external generation.
- The Stop gate validates final Markdown bindings against the image manifest; downstream renderers must preserve the same approval boundary when producing non-Markdown derivatives.

## Review fix round 1

### RED / GREEN

- RED: the original product contracts verified workflow prose but did not execute a shared plan-to-generation-to-review composition. New Studio and Career tests first exercised the missing composition boundary, capability tri-state, host provenance, Stop alias/manifest gate, and artifact-local review receipt behavior.
- GREEN: the shared composition now has separate `planImageAssetWorkflow`, `generateImageAssetWorkflow`, and `reviewImageAssetWorkflow` exports. Product tests execute the OpenAI route with one mocked request and the host route with one callback; no live network provider is called.

### Changes

- Capability routing accepts the public `{ status: "available" | "unavailable" | "unknown" }` contract as well as the legacy resolver shape. `unknown` never calls the host generator.
- The manifest provider schema/runtime accepts exactly one of two provenance forms: legacy OpenAI `{name, model, quality}` or host `{name, requested_model, requested_quality, applied_model, applied_quality}`. Unreported host-applied values are stored as `null`, never copied from requested values.
- Generation writes a planned manifest, prompt package, and explicit selected-ID provenance before provider results update the manifest. The OpenAI key is only given to the OpenAI adapter; host callbacks receive cloned jobs only.
- Review requires the closed artifact-local `host-user-image-decision` receipt shape, matching transition inputs and timestamp, plus regular non-symlink receipt/evidence files contained under the artifact root. It then invokes the locked Task 2 `applyImageReviewTransition` API without adding authentication or authority APIs.
- Stop canonicalizes managed inline raster references and fails closed on aliases, duplicate/untracked references, missing manifests, duplicate manifest outputs, and symlink/non-regular targets. Legacy non-managed SVG bindings still pass without an image manifest.

### Verification

- Six product skills: `quick_validate.py` → 6/6 valid.
- Task 5 product/hook/capability/Stop command → 57 passed, 0 failed (the prior report's 49 became 57 after eight review regressions).
- Task 1–4 image unit command → 93 passed, 0 failed.
- `node --check` for the changed scripts and `git diff --check` → passed.
- `npm test` → only two known generated snapshot-integrity failures (Career and Studio). The Task 6-owned `plugins/**` rebuild has not yet incorporated these source/skill changes; no generated snapshot was modified here.

### Remaining risk

- Normal verification remains fully mocked/read-only for providers. The opt-in live image smoke is intentionally not run.

## Review fix round 2

### RED / GREEN

- RED: the direct hostile run had 19 passing and 5 failing tests. It proved that a selected host call accepted absent/agent/empty/duplicate/mismatched selection input, metadata writes followed `assets` and manifest symlinks, host provenance alone promoted an absent output to `generated`, product specialist IDs could approve, and manifest-declared SVG draft bindings bypassed Stop.
- A second focused RED proved that a host call with invalid output evidence retained `image-provider-unresolved` rather than recording the actual host attempt.
- GREEN: the final hostile run passed 37/37, including root/parent/target symlinks, target and parent pre-publish swaps, external sentinel preservation, closed selection/decision receipts, missing/corrupt/wrong-path/wrong-digest host outputs, specialist reviewer IDs, and managed SVG approval/QA boundaries.

### Changes

- Added `safe-artifact-write.mjs`: canonical non-symlink artifact-root/ancestor checks, same-directory private temporary files, `O_NOFOLLOW`, `O_EXCL`, create-once hard-link publish for receipts/selections, atomic replacement for regular metadata targets, and pre/post dev/inode identity rechecks. Plan, generation, and review metadata writes use it; recursive workflow `mkdir` writes are removed.
- `select` now requires an exact host-user selection receipt (`kind`, `channel`, `event_id`, ordered `asset_ids`) before job/provider routing. The event-addressed, secret-free receipt is returned and written create-once.
- Review consumes a host-supplied decision object rather than reading an arbitrary disk receipt, rejects all registered product specialist IDs as human reviewers, persists the validated receipt under its host event ID, and continues to call the locked Task 2 transition API.
- Host successes require an artifact-local regular non-symlink PNG at the selected output, exact output fields/dimensions, SHA-256 output digest, and prompt/output digest provenance. Invalid host results become `qa-failed` while preserving truthful host provider provenance.
- Stop now covers all schema-approved managed output formats, including SVG. Managed SVG references require manifest tracking, document approval, and a closed passed Skillstead lint/render/QA record; unmanaged legacy SVG remains outside this gate.

### Verification

- Six product skills: `quick_validate.py` → 6/6 valid.
- Task 5 exact seven-file command → 67 passed, 0 failed.
- Task 1–4 image unit suites plus safe-writer unit tests → 95 passed, 0 failed.
- Hostile workflow/Stop/safe-writer command → 36 passed, 0 failed.
- `node --check`, `git diff --check`, and `git show --check` → passed.
- `npm test` → only the two established Task 6-owned generated snapshot-integrity failures (Career and Studio); `plugins/**` was not rebuilt or edited.

### Remaining risk

- Node 18 exposes no portable directory-fd `openat`/`renameat` CAS. The writer uses same-directory `O_NOFOLLOW` temporary files, hard-link/rename publishing, and identity checks immediately before/after publishing, which fails closed for the tested swaps. A same-user adversary that swaps an ancestor in the final syscall interval cannot be mathematically excluded without a native helper or stronger filesystem isolation, which is outside this no-dependency task scope.
- Provider verification remains mocked/read-only; no live host or OpenAI image call was made.

## Review fix round 3

### RED / GREEN

- RED: six hostile regressions proved selection events could replay concurrent host calls, omitted host jobs stayed `prompt-ready`, host failures could claim `generated`, whitespace/case specialist reviewer aliases could self-approve, an empty root could not initialize workflow directories, and a self-written SVG QA JSON could pass Stop.
- GREEN: the focused hostile command passed 36/36, the Task 5 seven-file command passed 73/73, and the Task 1–4 image-unit plus safe-writer command passed 87/87.

### Changes

- `select` now reserves its exact secret-free receipt with create-once publication before any provider call. A provider failure retains that immutable attempted selection; concurrent or replayed events make zero additional host calls.
- Host output validation rejects success states in `failures`, rejects duplicate/unselected IDs, and turns every omitted selected job into explicit `generation-failed` provenance with the requested host model/quality and null applied values.
- Human reviewers are NFKC-normalized and trimmed before persistence; control characters, role-like IDs, and normalized specialist aliases are rejected.
- Empty regular artifact roots now create `assets`, `assets/prompts`, and `decisions` one path component at a time with identity/symlink rechecks. The writer still avoids unsafe external cleanup.
- Stop now binds managed SVG evidence to actual regular artifact-local SVG/PNG bytes: SHA-256 values, one title/desc, safe XML subset, actual packaged Skillstead lint, complete CRC/zlib-checked PNG at 2x SVG dimensions, canonical renderer identity, and the four QA checks. The lint and complete-PNG validators are packaged shared runtime modules, so built hook commands do not depend on repository-only paths.

### Verification

- Six product skills: `quick_validate.py` → 6/6 valid.
- Task 5 exact seven-file command → 73 passed, 0 failed.
- Task 1–4 image unit suites plus safe-writer tests → 87 passed, 0 failed.
- Hook build and Stop SVG command → 22 passed, 0 failed.
- `node --check` for all changed runtime modules and `git diff --check` → passed.
- `npm test` → only the established two Task 6-owned generated snapshot-integrity failures (Career and Studio); generated `plugins/**` files remain untouched.

### Remaining risk

- The PNG/manifest/lint evidence boundary is verified locally and deterministically; normal validation does not perform an external host or OpenAI generation request.

## Review fix round 4

### RED / GREEN

- RED: a new supplier-boundary test failed 0/1 because `shared/scripts/lib/skillstead-svg-lint.mjs` was a byte-for-byte copied `check-svg.mjs`. The first real managed-SVG positive then failed 16/17 because the source Studio wrapper could not resolve its approved source checkout vendor. A receipt-mismatch regression also failed 16/17 before Stop bound the persisted human-decision receipt to the manifest review.
- GREEN: the wrapper-boundary and Stop suites passed 21/21; the exact Task 5 seven-file suite passed 74/74; the Task 1–4 image, safe-writer, shared-contract, and SVG-wrapper suite passed 92/92. No provider or network call was made.

### Changes

- Deleted the copied shared linter. The new small shared evidence runner discovers only the two fixed product wrapper locations, requires exactly one canonical regular non-symlink wrapper per plugin root, and invokes `node <wrapper> lint <svg>` with argument arrays (no shell). Source checkout resolution validates both products; a built product resolves only its own wrapper. Missing, duplicate, alias, symlink, and raw-vendor wrapper paths fail closed.
- Added the Studio source-checkout fallback already used by Career, and moved source-only sibling/vendor path stripping into the clean product build for both wrappers. The package test proves the product-owned wrapper remains while the fallback is absent.
- Stop now runs the approved wrapper for every managed SVG rather than a copied implementation. Its passed SVG evidence additionally requires a matching persisted `host-user-image-decision` receipt bound to the `document-approved` review and artifact-local evidence.
- Added an executable positive fixture with title/description, fresh SVG digest, actual wrapper lint, complete CRC/zlib-valid 2x PNG, Chromium renderer identity, exact QA checks, and matching review receipt. Negative coverage keeps aliases, symlinks, incomplete/self-written JSON, stale receipt, missing manifest, and unsafe output paths fail-closed while unmanaged legacy SVG remains compatible.
- Updated the shared-contract hook expectation to include the pre-existing Task 5 public `imageConfig` and image-generation capability contract.

### Verification

- Product skills: `quick_validate.py` → 6/6 valid.
- Task 5 exact seven-file command → 74 passed, 0 failed.
- Task 1–4 image/safe-writer/shared-contract/SVG-wrapper command → 92 passed, 0 failed.
- Studio output-skill/wrapper regression command → 18 passed, 0 failed.
- `node --check` changed runtime modules; `git diff --check`; `git diff --cached --check` → passed.
- `npm test` → only the established Task 6 snapshot-integrity pair (Career and Studio) failed; no other failure was emitted before the runner stopped.
- `npm run build -- --check` → expected Task 6 snapshot drift only; no runtime/build diagnostic was emitted.

### Remaining risk

- Normal verification deliberately does not render through a local Chromium or call a host/OpenAI provider. The Stop positive fixture validates the approved lint subprocess and independent complete-PNG/evidence boundary with deterministic local bytes.

## Review fix round 5

### RED / GREEN

- RED: five new hostile probes failed as expected: a document-approved raster final binding had no host-user receipt, separator/case aliases of `visual-asset-reviewer` could approve, host result records preserved untrusted fields and host exceptions escaped, and permission-denied capability paths collapsed to `unavailable`. The pre-existing Studio generic-role suite also failed 4 assertions because image specialists had been added to generic merger role lists.
- GREEN: the focused Task 5/Studio/Career/Stop/capability suite passed 120/120. It includes a valid raster receipt positive followed by stale-evidence rejection, closed host record/no-secret assertions, applied-model/quality reporting, callback exception persistence, alias permutations, capability available/unavailable/unknown, and restored generic role/orchestrator contracts.

### Changes

- Stop now requires every final managed raster or SVG binding to have a closed, matching `host-user-image-decision` receipt. Receipt and document-approved review values must agree; receipt, all evidence paths, and current SHA-256 evidence bytes must be artifact-local regular non-symlink files.
- Reviewer comparison uses NFKC, Unicode case fold, and separator removal for reserved specialist rejection while persisting the normalized named-human form.
- Codex-host generation accepts only exact closed success/failure/provenance records and reconstructs output/provenance fields. Applied model/quality are optional safe values, are retained when reported, and remain `null` when unreported. Unknown/raw fields cannot enter returned state or manifests.
- A thrown or rejected selected host callback is recorded as a redacted `generation-failed` result for every selected job, with requested host settings and null applied settings; the already-reserved selection remains non-replayable.
- Image capability probing preserves `unknown` for EACCES/EPERM both at system-skill and bundled-cache discovery boundaries.
- Image specialists moved to an explicit `imageSpecialistIds`/`plannedPaths.imageSpecialists` registry. Generic Studio reviewer priority, merger authority, and six-role contracts retain only bounded generic review roles.

### Verification

- Six product skills: `quick_validate.py` → 6/6 valid.
- Task 5/Studio/Career/Stop/capability/orchestrator/role command → 120 passed, 0 failed.
- Task 1–4 image, safe writer, shared-contract, hooks, wrapper, and product-contract command → initially 127 passed, 2 stale role-registry expectations; after the explicit generic/image registry contract update, Studio/Career product and orchestrator/roles command → 81 passed, 0 failed.
- `npm test` → only Task 6 generated snapshot-integrity failures for Career and Studio.
- `npm run build -- --check` → only Task 6 generated snapshot drift (both image workflow package snapshots are intentionally not regenerated here).
- `node --check`, JSON parsing, and `git diff --check` → passed.

### Remaining risk

- Provider and host execution remain mocked and local by design; no live OpenAI request, host image call, or Chromium render was made.
