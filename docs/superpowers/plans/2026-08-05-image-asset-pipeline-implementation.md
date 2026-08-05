# Image Asset Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add deterministic image asset planning, reusable prompt packages, four `IMAGE_GEN_MODE` policies, secure OpenAI/Codex provider routing, bounded generation, visual review, and the approved asset lifecycle to both plugins.

**Architecture:** A shared image-assets module owns schemas, prompt patterns, QA contracts, and `.env.example`. Shared scripts own configuration, manifest validation, prompt compilation, provider decisions, and OpenAI generation. Product skills orchestrate those scripts and the host Codex image capability; the local Node runtime never guesses a private Codex endpoint. Generated files remain staged until validated, and generation state is separate from human approval state.

**Tech Stack:** Node.js 18+ built-ins, native `fetch`, JSON/YAML contracts, OpenAI Images API `v1/images/generations`, Codex image-generation host capability, Codex `SKILL.md` packages, Markdown role prompts, Node test runner with injected network/clock/sleep adapters.

## Global Constraints

- Complete Task 1 of `2026-08-05-document-quality-profiles-implementation.md` before this plan so product shared-module contracts and build extension patterns are stable.
- Use `IMAGE_GEN_MODE=prompt-only` as the safe default. Allowed values are exactly `required`, `all`, `select`, and `prompt-only`.
- Default `IMAGE_MODEL` to `gpt-image-2` and `IMAGE_QUALITY` to `low`; allowed quality values are `low`, `medium`, `high`, and `auto`.
- If `OPENAI_API_KEY` is non-empty, attempt only the OpenAI Images API. Never fall back to Codex after API, authentication, quota, invalid-request, policy, or network failure.
- If no API key exists, the orchestration skill may use the available Codex image-generation capability. If unavailable, preserve prompts and placeholders. Local scripts must not call undocumented Codex endpoints.
- `prompt-only` performs zero external generation calls. `select` performs zero calls until explicit stable asset IDs are selected.
- Never serialize or log API keys, Authorization headers, base64 responses, secret-like environment values, or raw image bytes.
- Normal tests must not use real network calls. A live smoke is separate, opt-in, one-image, `gpt-image-2`/`low`, and never required for release.
- AI generation success is not approval. Only a named human review may move `concept-draft` to `document-approved` or `production-candidate`.
- Edit authoring sources only; regenerate `plugins/` snapshots through the build.

---

### Task 1: Add the image-assets module, `.env.example`, and secure configuration contract

**Files:**
- Create: `shared/image-assets/schema/image-config.schema.json`
- Create: `shared/image-assets/.env.example`
- Create: `shared/scripts/validate-image-config.mjs`
- Modify: `.gitignore`
- Modify: `shared/contracts/product.schema.json`
- Modify: `tooling/lib/product-contract.mjs`
- Modify: `tooling/lib/build-product.mjs`
- Modify: `products/game-design-studio/product.json`
- Modify: `products/game-design-career/product.json`
- Test: `tests/unit/image-config.test.mjs`
- Test: `tests/unit/build-product.test.mjs`
- Test: `tests/contracts/package-contents.test.mjs`
- Modify: `tests/products/studio/product-contract.test.mjs`
- Modify: `tests/products/career/product-contract.test.mjs`

- [ ] **Step 1: Write failing configuration tests**

Test process-environment precedence over workspace-root `.env`, `.env` over defaults, trimmed-empty values, all four modes, all four qualities, safe model IDs, legacy `IMAGE_GEN_ENABLE`/`IMAGE_GENERATOR` warnings, `.env` symlink rejection, POSIX group/other-readable warning, and strict workspace-root-only lookup.

Lock these public interfaces:

```js
loadImageConfig({ workspaceRoot, env = process.env, readFileFn, lstatFn })
// => { mode, model, quality, apiKey, apiKeyPresent, sources, warnings }

toPublicImageConfig(config)
// => { mode, model, quality, apiKeyPresent, sources, warnings }

validateImageConfig(value)
// => { ok, errors: Array<{ code, path, message }> }
```

The test must prove `JSON.stringify(toPublicImageConfig(config))` never contains the supplied key. Error messages may say that a key exists but may not include any substring of its value.

- [ ] **Step 2: Run the tests and confirm failure**

Run:

```bash
node --test tests/unit/image-config.test.mjs tests/unit/build-product.test.mjs tests/contracts/package-contents.test.mjs tests/products/studio/product-contract.test.mjs tests/products/career/product-contract.test.mjs
```

- [ ] **Step 3: Implement bounded `.env` parsing and validation**

Parse only simple `KEY=value` lines for the four supported keys; reject NUL bytes, oversized files, duplicate keys, command substitution, interpolation, and unsupported multiline syntax. Do not modify `process.env`. Resolve only `<workspaceRoot>/.env`, validate every path component, and reject symlinks.

Use defaults:

```js
{ mode: 'prompt-only', model: 'gpt-image-2', quality: 'low' }
```

Keep `apiKey` in the internal object only long enough to pass it directly to the OpenAI adapter. All status, hook, manifest, error, and user-visible objects use `toPublicImageConfig`.

- [ ] **Step 4: Add the exact `.env.example` policy**

Document every mode's generation scope, expected cost/time effect, selection requirement, provider routing, no-fallback rule, prompt/placeholder behavior, approval state, model/quality defaults, and the fact that a real key must never be committed. Use:

```dotenv
IMAGE_GEN_MODE=prompt-only
IMAGE_MODEL=gpt-image-2
IMAGE_QUALITY=low
OPENAI_API_KEY=
```

Update `.gitignore` to ignore `.env` and secret variants while explicitly allowing `.env.example`.

- [ ] **Step 5: Package the shared module and root example**

Add the `image-assets` shared module and map its directory to `references/shared/image-assets`. Add an explicit deterministic build entry that copies `shared/image-assets/.env.example` to plugin-root `.env.example` without removing the packaged reference copy. Extend collision, symlink, exact-content, and no-real-`.env` tests. Add `image-assets` to both product contracts.

- [ ] **Step 6: Verify and commit configuration**

Run:

```bash
node --test tests/unit/image-config.test.mjs tests/unit/build-product.test.mjs tests/contracts/package-contents.test.mjs tests/products/studio/product-contract.test.mjs tests/products/career/product-contract.test.mjs
```

Then commit:

```bash
git add .gitignore shared/image-assets shared/scripts/validate-image-config.mjs shared/contracts/product.schema.json tooling/lib/product-contract.mjs tooling/lib/build-product.mjs products/game-design-studio/product.json products/game-design-career/product.json tests/unit/image-config.test.mjs tests/unit/build-product.test.mjs tests/contracts/package-contents.test.mjs tests/products/studio/product-contract.test.mjs tests/products/career/product-contract.test.mjs
git commit -m "feat(images): add secure image generation config"
```

### Task 2: Define the image manifest, execution state, approval lifecycle, and rights contract

**Files:**
- Create: `shared/image-assets/schema/image-assets.schema.json`
- Create: `shared/image-assets/schema/image-review.schema.json`
- Create: `shared/image-assets/qa-contracts/generated-image.md`
- Create: `shared/image-assets/qa-contracts/production-candidate.md`
- Create: `shared/scripts/validate-image-assets.mjs`
- Create: `shared/templates/canonical-artifact/assets/README.md`
- Create: `shared/templates/canonical-artifact/assets/diagrams/.gitkeep`
- Create: `shared/templates/canonical-artifact/assets/generated/.gitkeep`
- Create: `shared/templates/canonical-artifact/assets/image-assets.yml`
- Create: `shared/templates/canonical-artifact/assets/prompts/image-prompts.md`
- Create: `shared/templates/canonical-artifact/assets/prompts/image-prompts.json`
- Test: `tests/unit/image-assets.test.mjs`
- Test: `tests/contracts/shared-contract.test.mjs`

- [ ] **Step 1: Write failing manifest and lifecycle tests**

Require stable unique `asset_id`, valid document slot and source-section bindings, closed asset types/requirements/status/approval enums, relative output/evidence paths, complete art brief, prompt, preserve/exclude constraints, dimensions/aspect/output/background, provider/model/quality, rights/provenance, and named review records.

Lock the API:

```js
validateImageAssetManifest(value, { artifactRoot } = {})
// => { ok, errors, warnings, counts }

applyImageReviewTransition(asset, {
  targetState,
  reviewer,
  reviewedAt,
  evidencePaths,
  rightsDecision,
})
// => new validated asset; input is not mutated
```

Test generation states separately from approval states. Reject skipped transitions, timestamp-only approvals without a reviewer, missing rights data, approval evidence outside the artifact, and any attempt to treat `production-candidate` as release/legal approval.

- [ ] **Step 2: Confirm failure**

Run:

```bash
node --test tests/unit/image-assets.test.mjs tests/contracts/shared-contract.test.mjs
```

- [ ] **Step 3: Implement the closed image asset schema**

Support the approved asset categories: character, NPC, monster/boss, skill/VFX, environment/landmark, item/equipment, UI icon, story/storyboard, key art/pitch concept, document illustration/cover, and Skillstead diagram.

Use these closed generation states:

```text
planned, prompt-ready, selected, generation-pending, generated,
generation-unavailable, generation-failed, policy-blocked, qa-failed
```

Use these closed approval states:

```text
concept-draft, document-approved, production-candidate
```

`document-approved` requires purpose, placement, alt text, readability, visual reviewer, and evidence. `production-candidate` additionally requires technical fit, gameplay readability, rights/provenance review, and named human approval.

- [ ] **Step 4: Extend the Canonical Artifact seed safely**

Add empty valid seeds for `image-assets.yml`, Markdown prompts, and JSON prompts. Keep prompt files present even when no generation occurs. Document `assets/diagrams`, `assets/generated`, `assets/prompts`, rights fields, revocation, placeholders, and the no-automatic-approval rule.

- [ ] **Step 5: Verify state and artifact contracts**

Run:

```bash
node --test tests/unit/image-assets.test.mjs tests/contracts/shared-contract.test.mjs
```

- [ ] **Step 6: Commit image manifest contracts**

```bash
git add shared/image-assets shared/scripts/validate-image-assets.mjs shared/templates/canonical-artifact tests/unit/image-assets.test.mjs tests/contracts/shared-contract.test.mjs
git commit -m "feat(images): define image asset lifecycle"
```

### Task 3: Implement asset planning and reusable prompt packages

**Files:**
- Create: `shared/image-assets/prompt-patterns/base.json`
- Create: `shared/image-assets/prompt-patterns/character.json`
- Create: `shared/image-assets/prompt-patterns/skill-vfx.json`
- Create: `shared/image-assets/prompt-patterns/environment.json`
- Create: `shared/image-assets/prompt-patterns/ui-icon.json`
- Create: `shared/image-assets/prompt-patterns/storyboard.json`
- Create: `shared/image-assets/prompt-patterns/document-illustration.json`
- Create: `shared/scripts/build-image-asset-plan.mjs`
- Create: `shared/scripts/compile-image-prompts.mjs`
- Test: `tests/unit/image-asset-plan.test.mjs`
- Test: `tests/unit/image-prompts.test.mjs`

- [ ] **Step 1: Write failing plan-scope tests**

Lock these interfaces:

```js
buildImageAssetPlan({ artifact, qualityProfile, existingManifest = null })
// => { manifest, summary: { required, recommended, variants, total } }

selectGenerationJobs({ manifest, mode, selectedAssetIds = [] })
// => finite ordered jobs; never mutates manifest

compileImagePrompts({ manifest, patternCatalog })
// => { markdown, json, promptDigests }
```

Test that `prompt-only` returns no jobs, `required` returns required assets only, `all` returns only finite manifest-declared required/recommended/variant assets, and `select` returns no jobs before explicit selection then only exact selected IDs. Reject unknown, duplicate, or non-prompt-ready selections.

- [ ] **Step 2: Write failing prompt quality tests**

Require every prompt to follow the approved order: purpose/medium, gameplay or narrative purpose, scene/background, subject/silhouette, view/composition/camera, palette/light/material/expression/action, play-distance readability, size/variant, preserve conditions, exclusions.

Require no logo, watermark, unsolicited text, third-party IP, or branded preset source. Character sequences must carry anchor/preserve instructions. UI/icon requests needing transparency must record opaque generation plus a separate verified alpha-postprocess requirement because `gpt-image-2` does not supply transparent backgrounds.

- [ ] **Step 3: Run and confirm failures**

Run:

```bash
node --test tests/unit/image-asset-plan.test.mjs tests/unit/image-prompts.test.mjs
```

- [ ] **Step 4: Implement deterministic planning**

Derive assets only from validated profile slots and explicit artifact needs. Preserve existing stable IDs and human decisions when replanning; add new assets deterministically; mark removed upstream slots for review rather than silently deleting generated files or provenance.

- [ ] **Step 5: Implement dual prompt output**

Generate semantically equivalent `image-prompts.md` for humans and `image-prompts.json` for machines. Include expected count, mode scope, prompt digest, slot, type, dimensions, preserve/exclude rules, and generation/approval state. Do not include an API key, base64 payload, authorization header, or source-company identity.

- [ ] **Step 6: Verify and commit planning**

Run:

```bash
node --test tests/unit/image-asset-plan.test.mjs tests/unit/image-prompts.test.mjs tests/unit/image-assets.test.mjs
```

Then commit:

```bash
git add shared/image-assets/prompt-patterns shared/scripts/build-image-asset-plan.mjs shared/scripts/compile-image-prompts.mjs tests/unit/image-asset-plan.test.mjs tests/unit/image-prompts.test.mjs
git commit -m "feat(images): add asset plans and prompt packages"
```

### Task 4: Implement provider routing and bounded OpenAI generation

**Files:**
- Create: `shared/scripts/generate-openai-images.mjs`
- Create: `shared/scripts/lib/image-provider.mjs`
- Create: `shared/scripts/lib/image-file-validation.mjs`
- Create: `shared/image-assets/qa-contracts/provider-routing.md`
- Test: `tests/unit/image-provider.test.mjs`
- Test: `tests/unit/generate-openai-images.test.mjs`
- Create: `tooling/smoke-openai-image.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write the complete provider decision-table test**

Lock:

```js
resolveImageProvider({ mode, apiKeyPresent, codexCapability })
// => { provider: 'none'|'openai'|'codex'|'unavailable', reason }

generateOpenAIImages({
  jobs,
  apiKey,
  model,
  quality,
  fetchFn = fetch,
  sleepFn,
  now,
  stagingRoot,
})
// => { results, failures, provider: 'openai' }
```

Test all rows from design-spec section 21.3. In particular, API-key failure invokes Codex zero times, policy block invokes fallback zero times, select-before-approval invokes all generators zero times, and prompt-only invokes all generators zero times.

- [ ] **Step 2: Write failing OpenAI adapter tests**

Use injected `fetchFn` fixtures. Assert `POST /v1/images/generations`, bearer auth, `model`, `quality`, prompt, size, and bounded count. Test successful base64 decode, PNG signature/dimensions, response-size bounds, corrupt/empty data, staging path traversal/symlink refusal, cleanup on failure, and atomic promotion only after file QA.

Test maximum three total attempts for 429/5xx with bounded `Retry-After`; no retry for 400/401/403, quota/billing/invalid request, or policy block. Assert captured logs/errors/public results contain no key, Authorization value, or base64 bytes.

- [ ] **Step 3: Run tests and confirm failure**

Run:

```bash
node --test tests/unit/image-provider.test.mjs tests/unit/generate-openai-images.test.mjs
```

- [ ] **Step 4: Implement the OpenAI-only local adapter**

Use native HTTPS through `fetch`; add no dependency. Preserve request ID, model, quality, generation time, prompt digest, and output digest in public provenance. Do not claim model/quality application for the Codex host path unless the host returns that evidence.

On partial failure, retain validated staged successes and prompt data, mark failed slots explicitly, and never overwrite prior approved files. A policy rejection remains `policy-blocked`; do not relabel it as unavailable or prompt-only.

- [ ] **Step 5: Add an opt-in live smoke command**

Add `npm run smoke:image:live` that exits with a clear skipped status when no key is present and otherwise generates exactly one low-quality `gpt-image-2` image into an OS temporary staging directory, validates it, prints redacted metadata, and deletes the temporary output. Do not add this script to `npm test` or `validate:release`.

- [ ] **Step 6: Verify and commit provider code**

Run:

```bash
node --test tests/unit/image-provider.test.mjs tests/unit/generate-openai-images.test.mjs
npm run test:unit
```

Then commit:

```bash
git add shared/scripts/generate-openai-images.mjs shared/scripts/lib shared/image-assets/qa-contracts/provider-routing.md tests/unit/image-provider.test.mjs tests/unit/generate-openai-images.test.mjs tooling/smoke-openai-image.mjs package.json
git commit -m "feat(images): add bounded image provider routing"
```

### Task 5: Add product image skills, specialist roles, and hook gates

**Files:**
- Create: `products/game-design-studio/plugin/skills/plan-image-assets/**`
- Create: `products/game-design-studio/plugin/skills/generate-image-assets/**`
- Create: `products/game-design-studio/plugin/skills/review-image-assets/**`
- Create: `products/game-design-career/plugin/skills/plan-image-assets/**`
- Create: `products/game-design-career/plugin/skills/generate-image-assets/**`
- Create: `products/game-design-career/plugin/skills/review-image-assets/**`
- Create: `products/game-design-studio/plugin/agents/art-brief-director.md`
- Create: `products/game-design-studio/plugin/agents/visual-asset-reviewer.md`
- Create: `products/game-design-career/plugin/agents/art-brief-director.md`
- Create: `products/game-design-career/plugin/agents/visual-asset-reviewer.md`
- Modify: `products/game-design-studio/plugin/references/routing.json`
- Modify: `products/game-design-career/plugin/references/routing.json`
- Modify: `products/game-design-studio/plugin/skills/orchestrate-game-design-project/SKILL.md`
- Modify: `products/game-design-career/plugin/skills/orchestrate-game-design-career/SKILL.md`
- Modify: `shared/scripts/capability-probe.mjs`
- Modify: `shared/scripts/stop-artifact-review.mjs`
- Modify: `shared/hooks/hooks.json`
- Test: `tests/products/studio/image-assets.test.mjs`
- Test: `tests/products/career/image-assets.test.mjs`
- Modify: `tests/products/studio/product-contract.test.mjs`
- Modify: `tests/products/career/product-contract.test.mjs`
- Test: `tests/unit/capability-probe.test.mjs`
- Test: `tests/unit/stop-artifact-review.test.mjs`
- Test: `tests/contracts/hooks.test.mjs`

- [ ] **Step 1: Write failing product workflow tests**

Require both plugins to plan all necessary character, NPC, monster/boss, skill/VFX, environment, item, UI, story, key-art, document, and Skillstead slots when the selected profile calls for them. Require prompts in every mode, explicit asset counts, select-mode user choice, provider truthfulness, review sheets, placeholders, and lifecycle evidence.

Assert the generation skill calls the OpenAI script only when a key is present; invokes the host image capability only when no key exists and capability is available; and leaves prompts/placeholders when no provider is available. The host path must never invent an applied model/quality claim.

- [ ] **Step 2: Write failing hook tests**

SessionStart must read configuration and capability state only: valid keys/modes, API-key presence boolean, Codex image capability presence, Skillstead, and document renderer capability. It must make no network or generation call.

Stop must validate active profile/image/diagram/approval/export gates, request at most one corrective pass, and never start image generation. It must block a final derivative that binds an asset below `document-approved` while preserving the existing marker/path/symlink safeguards.

- [ ] **Step 3: Implement the skills and roles**

`plan-image-assets` creates `image-assets.yml` plus both prompt files. `generate-image-assets` applies mode scope and provider routing. `review-image-assets` owns review evidence and lifecycle transitions. `art-brief-director` owns purpose/readability/prompt/variant findings; `visual-asset-reviewer` owns visual/accessibility/rights/placement findings and may recommend, but not self-grant, approval.

- [ ] **Step 4: Extend capability and Stop contracts**

Probe only discoverable installed skill/tool presence; report Codex image capability as available/unavailable/unknown without guessing an endpoint. Keep hook output redacted. Preserve the one-corrective-pass and fail-safe behavior of the existing Stop hook.

- [ ] **Step 5: Validate all skills and tests**

Run:

```bash
for product in game-design-studio game-design-career; do
  for skill in plan-image-assets generate-image-assets review-image-assets; do
    python3 /Users/freelife/.codex/skills/.system/skill-creator/scripts/quick_validate.py "products/$product/plugin/skills/$skill"
  done
done
node --test tests/products/studio/image-assets.test.mjs tests/products/career/image-assets.test.mjs tests/products/studio/product-contract.test.mjs tests/products/career/product-contract.test.mjs tests/unit/capability-probe.test.mjs tests/unit/stop-artifact-review.test.mjs tests/contracts/hooks.test.mjs
```

- [ ] **Step 6: Commit product integration**

```bash
git add products/game-design-studio/plugin products/game-design-career/plugin shared/scripts/capability-probe.mjs shared/scripts/stop-artifact-review.mjs shared/hooks/hooks.json tests/products/studio/image-assets.test.mjs tests/products/career/image-assets.test.mjs tests/products/studio/product-contract.test.mjs tests/products/career/product-contract.test.mjs tests/unit/capability-probe.test.mjs tests/unit/stop-artifact-review.test.mjs tests/contracts/hooks.test.mjs
git commit -m "feat(images): add product image workflows"
```

### Task 6: Package, document, and validate the image pipeline

**Files:**
- Modify: `README.md`
- Modify: `products/game-design-studio/plugin/README.md`
- Modify: `products/game-design-career/plugin/README.md`
- Modify: `tests/products/studio/readme.test.mjs`
- Modify: `tests/products/career/readme.test.mjs`
- Modify: `tests/contracts/package-contents.test.mjs`
- Modify: `tests/isolation/plugin-smoke.test.mjs`
- Modify: `tests/e2e/studio/studio-e2e.test.mjs`
- Modify: `tests/e2e/career/career-e2e.test.mjs`
- Generated by build: `plugins/game-design-studio/**`
- Generated by build: `plugins/game-design-career/**`
- Generated by build: `plugins/BUILD-MANIFEST.json`

- [ ] **Step 1: Add failing README, isolation, and E2E assertions**

Require exact `.env.example` values and detailed mode/provider comments, prompt-only behavior, OpenAI-only-with-key rule, Codex-without-key rule, lifecycle meaning, rights limits, Skillstead separation, live-smoke opt-in status, and the statement that `production-candidate` is not release/legal approval.

In each isolated plugin, run prompt-only planning from a representative artifact and confirm prompt files and placeholders are produced with no sibling/source dependency or network call.

- [ ] **Step 2: Update source documentation**

Add installation-safe `.env` instructions, four mode examples, provider/failure matrix, supported asset types, prompt package locations, review/approval flow, generated provenance, rights/privacy cautions, and troubleshooting for missing render/image capabilities. Never print or ask users to paste a key into a tracked file.

- [ ] **Step 3: Rebuild and inspect snapshots**

Run:

```bash
npm run build
npm run build -- --check
```

Assert each snapshot contains root `.env.example`, shared schema/prompt/QA files, scripts, three skills, and two roles; contains no `.env`, secret fixture, authoring source map, absolute host path, or sibling reference.

- [ ] **Step 4: Run the image feature validation slice**

Run:

```bash
npm run test:unit
npm run test:contracts
npm run test:products
npm run smoke:marketplace
node --test tests/e2e/studio/studio-e2e.test.mjs tests/e2e/career/career-e2e.test.mjs tests/isolation/plugin-smoke.test.mjs
```

- [ ] **Step 5: Commit the packaged image pipeline**

```bash
git add README.md products/game-design-studio/plugin/README.md products/game-design-career/plugin/README.md tests/products tests/contracts/package-contents.test.mjs tests/isolation/plugin-smoke.test.mjs tests/e2e plugins
git commit -m "docs(images): package and document image workflows"
```

### Plan completion gate

- [ ] All four modes and defaults pass deterministic tests.
- [ ] API-key presence selects OpenAI only; API failure never falls back to Codex.
- [ ] No-key sessions use Codex capability when available and prompts/placeholders otherwise.
- [ ] Markdown and JSON prompt packages exist regardless of generation mode.
- [ ] Secrets and base64 bytes are absent from logs, manifests, fixtures, snapshots, and errors.
- [ ] Generation status and approval status remain separate and every approval transition has named evidence.
- [ ] Both isolated plugins can plan/review assets and pass provider, hook, product, E2E, build, and isolation checks without a live API call.
