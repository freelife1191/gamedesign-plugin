# Document Quality Profiles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add closed, product-aware Document Quality Profiles, neutral reference presets, exact template mappings, and document-quality orchestration to both independently installable game-design plugins.

**Architecture:** Shared profile schemas, catalogs, overlays, neutral presets, render contracts, and validators live under `shared/document-quality/` and `shared/scripts/`. Product overlays contain only product routing, template mappings, skills, and role prompts. Build tooling packages the shared module byte-identically into both plugins while authoring-only research/source mappings remain outside snapshots.

**Tech Stack:** Node.js 18+ built-ins, JSON Schema 2020-12 documents with hand-written fail-closed validators, restricted YAML frontmatter, Codex `SKILL.md` packages, Markdown role prompts, deterministic product snapshot tooling, Node test runner.

## Global Constraints

- Treat `docs/superpowers/specs/2026-08-05-document-quality-and-image-pipeline-design.md` as the approved product contract.
- Edit only `shared/`, `products/`, `tests/`, `tooling/`, and authoring documentation. Never edit generated `plugins/` files directly; regenerate them with `npm run build`.
- Preserve the existing Canonical Artifact, responsible-design, Skillstead, export-preparation, source-rights, path, symlink, and deterministic-build contracts.
- A document has exactly one primary Quality Profile. Overlays and neutral presets may add requirements but may not delete or weaken primary requirements or safety gates.
- Neutral presets must not expose a company, project, trademark, source URL, copied wording, source layout, logo, or source image in packaged files or generated output.
- Keep the shared module byte-identical in both built plugins and ensure either plugin works without its sibling or the source repository.
- Write the focused failing test before each implementation slice. Commit only after the listed focused checks pass.
- This plan establishes the shared-module extension point used by the image and rendering plans. Complete Task 1 before starting the image plan; the remaining profile tasks may proceed independently from image-provider implementation.

---

### Task 1: Add the document-quality shared module and closed profile contract

**Files:**
- Create: `shared/document-quality/schema/quality-profile.schema.json`
- Create: `shared/document-quality/schema/quality-profile-selection.schema.json`
- Create: `shared/scripts/validate-quality-profile.mjs`
- Create: `shared/scripts/resolve-quality-profile.mjs`
- Modify: `shared/contracts/product.schema.json`
- Modify: `tooling/lib/product-contract.mjs`
- Modify: `tooling/lib/build-product.mjs`
- Modify: `products/game-design-studio/product.json`
- Modify: `products/game-design-career/product.json`
- Test: `tests/unit/quality-profile.test.mjs`
- Test: `tests/unit/build-product.test.mjs`
- Test: `tests/contracts/shared-contract.test.mjs`
- Modify: `tests/products/studio/product-contract.test.mjs`
- Modify: `tests/products/career/product-contract.test.mjs`

- [ ] **Step 1: Write failing schema and composition tests**

Create `tests/unit/quality-profile.test.mjs`. Require `validateQualityProfile(value, options)` to reject unknown keys, duplicate IDs, empty requirement lists, dangling diagram/image slot references, invalid PPT story rules, and contradictory export rules. Require `composeQualityProfile({ primary, overlays, preset })` to preserve all primary requirements, deduplicate additions in stable order, report conflicting scalar overrides, and reject any overlay or preset removal directive.

Lock these public interfaces:

```js
validateQualityProfile(value, { sourceName = 'quality profile' } = {})
// => { ok: boolean, errors: Array<{ code, path, message }> }

composeQualityProfile({ primary, overlays = [], preset = null })
// => { profile, provenance: { primary, overlays, preset }, conflicts: [] }

loadQualityProfile({ pluginRoot, profileId })
// => validated profile loaded from a safe, non-symlink path
```

- [ ] **Step 2: Run the tests and confirm the module is absent**

Run:

```bash
node --test tests/unit/quality-profile.test.mjs tests/unit/build-product.test.mjs tests/contracts/shared-contract.test.mjs tests/products/studio/product-contract.test.mjs tests/products/career/product-contract.test.mjs
```

Expected: the new module/schema/API assertions fail, while unrelated baseline assertions remain green.

- [ ] **Step 3: Implement the closed schemas and validators**

`quality-profile.schema.json` must allow only:

```text
profile_id, version, artifact_types, audiences,
required_sections, required_tables, required_diagrams,
required_images, recommended_images, length_guidance,
ppt_story_contract, acceptance_criteria, export_rules, quality_checks
```

Use kebab-case stable IDs, unique arrays, non-empty acceptance criteria, closed nested objects, and explicit references from tables/diagrams/images to valid section IDs. `quality-profile-selection.schema.json` must require one `primary_profile_id`, allow zero or more `overlay_ids`, and allow at most one `preset_id`.

Implement validation without a new dependency. Return deterministic error ordering by path then code. Never mutate caller input. Freeze or deep-clone composed output so later stages cannot weaken a validated profile in place.

- [ ] **Step 4: Package the new shared module**

Add `document-quality` to the allowed shared-module enum and product-contract validator. Map it in `tooling/lib/build-product.mjs` as:

```js
'document-quality': ['shared/document-quality', 'references/shared/document-quality']
```

Add `document-quality` to both product contracts. Extend build tests to prove deterministic copying, collision rejection, symlink rejection, and byte-identical shared files in both products.

- [ ] **Step 5: Run the focused contract checks**

Run:

```bash
node --test tests/unit/quality-profile.test.mjs tests/unit/build-product.test.mjs tests/contracts/shared-contract.test.mjs tests/products/studio/product-contract.test.mjs tests/products/career/product-contract.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit the shared profile contract**

```bash
git add shared/document-quality shared/scripts/validate-quality-profile.mjs shared/scripts/resolve-quality-profile.mjs shared/contracts/product.schema.json tooling/lib/product-contract.mjs tooling/lib/build-product.mjs products/game-design-studio/product.json products/game-design-career/product.json tests/unit/quality-profile.test.mjs tests/unit/build-product.test.mjs tests/contracts/shared-contract.test.mjs tests/products/studio/product-contract.test.mjs tests/products/career/product-contract.test.mjs
git commit -m "feat(quality): add document quality profile contract"
```

### Task 2: Build the complete Studio and Career profile catalogs

**Files:**
- Create: `shared/document-quality/profiles/studio/*.json`
- Create: `shared/document-quality/profiles/career/*.json`
- Create: `shared/document-quality/overlays/mobile.json`
- Create: `shared/document-quality/overlays/pc-console.json`
- Create: `shared/document-quality/overlays/live-service.json`
- Create: `shared/document-quality/render-contracts/long-form-document.json`
- Create: `shared/document-quality/render-contracts/review-report.json`
- Create: `shared/document-quality/render-contracts/presentation.json`
- Test: `tests/contracts/document-quality-catalog.test.mjs`

- [ ] **Step 1: Write the failing catalog test**

Assert exact profile IDs from design-spec sections 7.2 and 7.3: 17 Studio profiles and 13 Career profiles. Validate every file with `validateQualityProfile`, require at least one audience, section, acceptance criterion, export rule, and quality check, and verify each required table/diagram/image references a declared section and unique slot ID.

The test must also assert that profiles declaring PPTX output use the presentation render contract and declare a non-empty `ppt_story_contract` with audience, decision purpose, message-per-slide, source-section binding, visual-slot binding, and speaker-note policy.

- [ ] **Step 2: Confirm the catalog test fails**

Run:

```bash
node --test tests/contracts/document-quality-catalog.test.mjs
```

- [ ] **Step 3: Author the Studio profiles**

Create one JSON file per approved Studio profile ID:

```text
vision-one-pager, game-design-brief, master-gdd,
core-motivation-loop, system-feature-specification,
rule-state-exception-matrix, data-table-contract,
narrative-quest-npc-specification,
character-skill-combat-monster-specification,
ui-ux-flow-state-specification, economy-balance-specification,
liveops-event-experiment-plan, accessibility-platform-matrix,
production-scope-milestone-risk-plan, playtest-metrics-report,
design-review-decision-log, executive-pitch
```

Write original requirements grounded in the approved spec and repository knowledge, not copied company documents. Use Skillstead slot IDs for state, flow, loop, economy, roadmap, and dependency diagrams.

- [ ] **Step 4: Author the Career profiles**

Create one JSON file per approved Career profile ID:

```text
career-stage-role-map, competency-matrix, learning-roadmap,
job-posting-evidence, reverse-design-document, game-analysis-report,
portfolio-project-brief, portfolio-case-study, portfolio-review-backlog,
interview-question-answer-report, junior-growth-review,
transition-readiness, recruiter-portfolio-presentation
```

Keep facts, inference, evidence freshness, portfolio proof, and interview claims explicit. Presentation profiles must tell a decision-oriented story rather than copy Markdown headings.

- [ ] **Step 5: Add additive overlays and render contracts**

Overlays may add platform or service constraints only. Tests must mutate each overlay with a removal key and verify rejection. Render contracts must specify page/slide size, margins, type scale, cover/metadata, tables, callouts, diagram/image placement, captions/alt text, headers/footers, source notes, orphan/overflow/empty-page rules.

- [ ] **Step 6: Run and commit the catalog**

Run:

```bash
node --test tests/unit/quality-profile.test.mjs tests/contracts/document-quality-catalog.test.mjs
```

Then commit:

```bash
git add shared/document-quality tests/contracts/document-quality-catalog.test.mjs
git commit -m "feat(quality): add studio and career profile catalogs"
```

### Task 3: Map all 30 product templates to exactly one primary profile

**Files:**
- Create: `products/game-design-studio/plugin/references/document-quality/template-profile-map.json`
- Create: `products/game-design-career/plugin/references/document-quality/template-profile-map.json`
- Modify: `products/game-design-studio/plugin/assets/templates/*/content.md`
- Modify: `products/game-design-career/plugin/assets/templates/*/content.md`
- Modify: `shared/export/schema/artifact.schema.json`
- Modify: `shared/scripts/validate-artifact.mjs`
- Test: `tests/products/studio/templates.test.mjs`
- Test: `tests/products/career/templates.test.mjs`
- Test: `tests/unit/validate-artifact.test.mjs`

- [ ] **Step 1: Add failing template/profile mapping assertions**

Require every product template directory to appear exactly once in its product mapping. Require every mapped profile to exist in the packaged catalog and every `content.md` frontmatter block to declare the same `quality_profile` ID. Reject an array, duplicate primary, unknown profile, or a template omitted from the mapping.

Keep `quality_profile` optional in the generic shared Canonical Artifact schema so the neutral starter remains valid before routing, but require it whenever a product template or active profile-aware artifact is validated.

- [ ] **Step 2: Run the focused tests and confirm failure**

Run:

```bash
node --test tests/unit/validate-artifact.test.mjs tests/products/studio/templates.test.mjs tests/products/career/templates.test.mjs
```

- [ ] **Step 3: Extend canonical metadata validation**

Add optional `quality_profile` to the closed artifact schema with kebab-case validation. Extend `validateArtifact` with:

```js
validateArtifact(artifactDir, {
  requestedFormats = [],
  requireQualityProfile = false,
  profileCatalogRoot,
} = {})
```

When `requireQualityProfile` is true, missing or unknown profile IDs are errors. Preserve existing callers and result shape when it is false.

- [ ] **Step 4: Write deterministic mappings and update template frontmatter**

Map all 15 Studio and all 15 Career templates. Where two templates intentionally share one profile, record that explicitly; never create an undocumented pseudo-profile just to force one-to-one naming. Keep the mapping JSON closed with only `schema_version`, `product`, and `templates`.

- [ ] **Step 5: Prove all mappings and templates validate**

Run:

```bash
node --test tests/unit/validate-artifact.test.mjs tests/products/studio/templates.test.mjs tests/products/career/templates.test.mjs
```

Expected: PASS with exactly 30 validated template directories.

- [ ] **Step 6: Commit template mappings**

```bash
git add shared/export/schema/artifact.schema.json shared/scripts/validate-artifact.mjs products/game-design-studio/plugin/assets/templates products/game-design-career/plugin/assets/templates products/game-design-studio/plugin/references/document-quality products/game-design-career/plugin/references/document-quality tests/unit/validate-artifact.test.mjs tests/products/studio/templates.test.mjs tests/products/career/templates.test.mjs
git commit -m "feat(quality): map product templates to quality profiles"
```

### Task 4: Add neutral reference presets and a source-exclusion gate

**Files:**
- Create: `shared/document-quality/schema/reference-preset.schema.json`
- Create: `shared/document-quality/presets/competitive-live-service.json`
- Create: `shared/document-quality/presets/replayable-coop.json`
- Create: `shared/document-quality/presets/evolving-world.json`
- Create: `shared/document-quality/presets/function-first.json`
- Create: `shared/document-quality/presets/player-validated-small-team.json`
- Create: `shared/document-quality/presets/cinematic-narrative.json`
- Create: `shared/document-quality/presets/ugc-production-tooling.json`
- Create: `docs/research/2026-08-05-neutral-game-design-preset-evidence.md`
- Modify: `tests/contracts/document-quality-catalog.test.mjs`
- Modify: `tests/contracts/package-contents.test.mjs`
- Modify: `tests/contracts/reference-coverage.test.mjs`

- [ ] **Step 1: Write failing neutral-preset and leakage tests**

The preset schema must allow only `preset_id`, `version`, `emphasis`, `review_questions`, `recommended_diagrams`, `story_hints`, and `additional_acceptance_criteria`. Recursively reject keys or values that expose source names, company names, project names, trademarks, URLs, logos, copied layout identifiers, or image references.

Build both plugins in a temporary directory and assert the authoring evidence filename and its source URLs do not occur in any packaged path or file bytes. The only result-visible selector is a neutral preset ID.

- [ ] **Step 2: Confirm the new gate fails**

Run:

```bash
node --test tests/contracts/document-quality-catalog.test.mjs tests/contracts/package-contents.test.mjs tests/contracts/reference-coverage.test.mjs
```

- [ ] **Step 3: Write the authoring-only evidence map**

Summarize the public sources already cited by the approved design spec, the general principle extracted from each, paraphrase boundaries, rights considerations, and the neutral preset receiving that principle. Do not place this file in `shared/knowledge/reference-index.json`; it must remain build-excluded authoring evidence.

- [ ] **Step 4: Author seven original neutral presets**

Each preset adds emphasis, review questions, diagram suggestions, story hints, and acceptance criteria only. Do not encode company-specific layouts, branded terminology, colors, art styles, example images, names, or citations.

- [ ] **Step 5: Verify package exclusion and commit**

Run:

```bash
node --test tests/contracts/document-quality-catalog.test.mjs tests/contracts/package-contents.test.mjs tests/contracts/reference-coverage.test.mjs
```

Then commit:

```bash
git add shared/document-quality/schema/reference-preset.schema.json shared/document-quality/presets docs/research/2026-08-05-neutral-game-design-preset-evidence.md tests/contracts/document-quality-catalog.test.mjs tests/contracts/package-contents.test.mjs tests/contracts/reference-coverage.test.mjs
git commit -m "feat(quality): add neutral reference presets"
```

### Task 5: Add the document-quality skill, specialist role, and orchestration routing

**Files:**
- Create: `products/game-design-studio/plugin/skills/apply-document-quality-profile/SKILL.md`
- Create: `products/game-design-studio/plugin/skills/apply-document-quality-profile/agents/openai.yaml`
- Create: `products/game-design-career/plugin/skills/apply-document-quality-profile/SKILL.md`
- Create: `products/game-design-career/plugin/skills/apply-document-quality-profile/agents/openai.yaml`
- Create: `products/game-design-studio/plugin/agents/document-quality-editor.md`
- Create: `products/game-design-career/plugin/agents/document-quality-editor.md`
- Modify: `products/game-design-studio/plugin/references/routing.json`
- Modify: `products/game-design-career/plugin/references/routing.json`
- Modify: `products/game-design-studio/plugin/skills/orchestrate-game-design-project/SKILL.md`
- Modify: `products/game-design-career/plugin/skills/orchestrate-game-design-career/SKILL.md`
- Modify: `products/game-design-studio/plugin/skills/orchestrate-game-design-project/references/completion-gates.md`
- Modify: `products/game-design-career/plugin/references/completion-gates.md`
- Test: `tests/products/studio/document-quality.test.mjs`
- Test: `tests/products/career/document-quality.test.mjs`
- Test: `tests/products/studio/orchestrator.test.mjs`
- Test: `tests/products/career/orchestrator.test.mjs`
- Test: `tests/products/studio/roles.test.mjs`
- Test: `tests/products/career/roles.test.mjs`
- Modify: `tests/products/studio/product-contract.test.mjs`
- Modify: `tests/products/career/product-contract.test.mjs`

- [ ] **Step 1: Write failing skill, role, and routing tests**

Assert that each product can select one primary profile from goal, audience, and requested format; accept an explicit override; compose additive overlays/preset; report the nearest profile and differences for an unknown request; and block `structurally-complete` when required sections, tables, diagrams, image slots, or acceptance criteria are missing.

Require `document-quality-editor` findings to contain stable section/slot IDs, evidence, impact, and a minimal repair. It must not grant visual, rights, production, or release approval.

- [ ] **Step 2: Run the product tests and confirm failure**

Run:

```bash
node --test tests/products/studio/document-quality.test.mjs tests/products/career/document-quality.test.mjs tests/products/studio/orchestrator.test.mjs tests/products/career/orchestrator.test.mjs tests/products/studio/roles.test.mjs tests/products/career/roles.test.mjs tests/products/studio/product-contract.test.mjs tests/products/career/product-contract.test.mjs
```

- [ ] **Step 3: Implement both skills with progressive loading**

Each `SKILL.md` must read only the selected profile, requested overlays, optional preset, relevant render contract, and product template map. The output is a deterministic profile selection record plus a section/table/diagram/image/acceptance checklist. State transitions are:

```text
draft -> structurally-complete -> evidence-reviewed -> visual-reviewed -> document-approved
```

Do not let the skill skip a state or treat generated images/rendered files as automatic approval.

- [ ] **Step 4: Route both orchestrators and add the role**

Quality-profile application occurs before content generation and asset planning. Preserve existing maximum-reviewer and deterministic merge-order rules. The quality editor reviews only document structure and story contract.

- [ ] **Step 5: Validate skills and product contracts**

Run:

```bash
python3 /Users/freelife/.codex/skills/.system/skill-creator/scripts/quick_validate.py products/game-design-studio/plugin/skills/apply-document-quality-profile
python3 /Users/freelife/.codex/skills/.system/skill-creator/scripts/quick_validate.py products/game-design-career/plugin/skills/apply-document-quality-profile
node --test tests/products/studio/document-quality.test.mjs tests/products/career/document-quality.test.mjs tests/products/studio/orchestrator.test.mjs tests/products/career/orchestrator.test.mjs tests/products/studio/roles.test.mjs tests/products/career/roles.test.mjs tests/products/studio/product-contract.test.mjs tests/products/career/product-contract.test.mjs
```

- [ ] **Step 6: Commit the product workflow**

```bash
git add products/game-design-studio/plugin products/game-design-career/plugin tests/products/studio tests/products/career
git commit -m "feat(quality): add profile application workflows"
```

### Task 6: Rebuild snapshots, document the profile system, and run the profile release slice

**Files:**
- Modify: `products/game-design-studio/plugin/README.md`
- Modify: `products/game-design-career/plugin/README.md`
- Modify: `README.md`
- Modify: `tests/products/studio/readme.test.mjs`
- Modify: `tests/products/career/readme.test.mjs`
- Modify: `tests/isolation/plugin-smoke.test.mjs`
- Generated by build: `plugins/game-design-studio/**`
- Generated by build: `plugins/game-design-career/**`
- Generated by build: `plugins/BUILD-MANIFEST.json`

- [ ] **Step 1: Add failing documentation and isolation assertions**

Require both READMEs to explain profile selection, overlay/preset restrictions, document status gates, Skillstead diagram slots, authoring-source non-disclosure, and the installed paths. Extend isolated-plugin smoke tests to resolve and validate a profile without a sibling plugin or repository source path.

- [ ] **Step 2: Update source READMEs**

Document exact commands/intent examples, profile catalogs, template mapping behavior, output metadata, failure behavior, and where advanced users may inspect packaged schemas and render contracts. Do not claim a company-authored format or official studio endorsement.

- [ ] **Step 3: Rebuild generated snapshots**

Run:

```bash
npm run build
npm run build -- --check
```

Review `git diff -- plugins/` and confirm changes are generated consequences of `shared/` and `products/` only.

- [ ] **Step 4: Run the profile validation slice**

Run:

```bash
npm run test:unit
npm run test:contracts
npm run test:products
npm run smoke:marketplace
```

Expected: PASS with no real `.env`, source-map leakage, cross-plugin dependency, symlink, or build drift.

- [ ] **Step 5: Commit the verified profile feature**

```bash
git add README.md products/game-design-studio/plugin/README.md products/game-design-career/plugin/README.md tests/products/studio/readme.test.mjs tests/products/career/readme.test.mjs tests/isolation/plugin-smoke.test.mjs plugins
git commit -m "docs(quality): document and package quality profiles"
```

### Plan completion gate

- [ ] Every Studio and Career profile validates against the closed schema.
- [ ] All 30 product templates select exactly one known primary profile.
- [ ] Overlays/presets cannot delete primary requirements or safety gates.
- [ ] Seven neutral presets contain no source/company/project/trademark/URL/layout/image data.
- [ ] Authoring-only source mapping is absent from both plugin snapshots and generated results.
- [ ] Both plugins independently resolve profiles and pass unit, contract, product, build, and isolation checks.
