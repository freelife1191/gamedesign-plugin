# Trusted Document Rendering and Asset Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn validated Canonical Artifacts into trustworthy MD, PDF, DOCX, and PPTX derivatives with approved Skillstead/generated assets, independent presentation stories, atomic output commits, actual-file inspection, and full-page/full-slide QA.

**Architecture:** Existing product export skills remain renderer-neutral preparation boundaries. A new downstream skill composes layouts from the selected Quality Profile, binds only approved assets, calls available document/PDF/presentation capabilities, and validates terminal evidence. Reusable production inspectors are extracted from the proven format-test patterns into the packaged shared export runtime; tests and runtime then use the same bounded archive, digest, render-binding, and transaction rules.

**Tech Stack:** Node.js 18+ built-ins, packaged shared export runtime, host `documents`, `pdf`, and `presentations` skills, existing Skillstead SVG/Chromium 2× PNG path, OOXML ZIP inspection, PDF signature/text/page inspection, Quick Look/Chromium render QA where available, Node test runner.

## Global Constraints

- Complete the Document Quality Profiles plan and Image Asset Pipeline plan before final integration. Task 1 may begin once their schemas and lifecycle contracts are committed.
- Keep `export-game-design-documents` and `export-career-documents` preparation-only. Do not hide renderer execution inside their current manifest preparation functions.
- The new downstream path must consume Canonical Artifact content, selected profile, asset registry, prompt/provenance records, and export-preparation manifest; it must never treat a derivative as upstream source.
- Bind only Skillstead outputs that passed SVG/PNG QA and image assets at `document-approved` or above. `concept-draft`, failed, unavailable, revoked, or missing-rights assets remain placeholders.
- PPTX is a separate audience/decision story. Do not mechanically turn each Markdown heading into a slide.
- Generate into a fresh staging directory, inspect real files, bind digests/counts/full renders, then atomically promote passing formats. A failing format must not overwrite a prior approved derivative or Canonical Artifact.
- Preserve path traversal, symlink, archive bomb, CRC, relationship, external-link, source-set, Unicode/glyph, overflow, crop, empty-page/slide, and deterministic manifest safeguards.
- Use representative deterministic fixtures; do not place nondeterministic AI output in normal golden tests.
- Edit `shared/` and `products/` sources, then regenerate `plugins/`. Never patch snapshots manually.

---

### Task 1: Add layout composition, asset binding, and terminal render-job contracts

**Files:**
- Create: `shared/document-quality/schema/render-job.schema.json`
- Create: `shared/document-quality/schema/render-result.schema.json`
- Create: `shared/scripts/compose-document-layout.mjs`
- Create: `shared/scripts/bind-assets-to-exports.mjs`
- Create: `shared/scripts/lib/render-job-contract.mjs`
- Modify: `shared/export/schema/export-manifest.schema.json`
- Test: `tests/unit/document-layout.test.mjs`
- Test: `tests/unit/asset-binding.test.mjs`
- Test: `tests/unit/render-job-contract.test.mjs`
- Test: `tests/unit/validate-artifact.test.mjs`

- [ ] **Step 1: Write failing layout-composition tests**

Lock:

```js
composeDocumentLayout({ artifact, qualityProfile, requestedFormats, theme })
// => { documentPlan, presentationPlan, warnings }

validateRenderJob(value)
// => { ok, errors: Array<{ code, path, message }> }

validateRenderResult(value, { artifactRoot, outputRoot })
// => { ok, errors, warnings, verifiedFiles }
```

Require document plans to include cover/metadata, section order, table/callout rules, diagram/image slots, captions/alt text, header/footer/page numbering, source notes, appendix, margins/type scale, and overflow/orphan/empty-page policies from the chosen render contract.

- [ ] **Step 2: Write failing asset-binding tests**

Lock:

```js
bindAssetsToExports({ artifactRoot, documentPlan, imageManifest, diagramManifest })
// => { bindings, placeholders, rejected, sourceSet }
```

Test relative canonical paths, stable slot/asset IDs, digest and approval-evidence binding, revocation, duplicate slot conflict, missing alt/caption, missing rights, stale digests, Skillstead SVG/PNG evidence, and rejection of every image below `document-approved`.

- [ ] **Step 3: Run focused tests and confirm failure**

Run:

```bash
node --test tests/unit/document-layout.test.mjs tests/unit/asset-binding.test.mjs tests/unit/render-job-contract.test.mjs tests/unit/validate-artifact.test.mjs
```

- [ ] **Step 4: Implement closed render job/result schemas**

A render job must contain artifact/profile IDs, canonical input digest, requested formats, document/presentation plans, approved bindings/placeholders, isolated staging/destination roots, capability snapshot, and preparation-manifest digest. A terminal result must contain per-format requested/attempted/renderer/QA/status history, output path/digest/count, source set, asset bindings, semantic evidence, visual evidence, failure evidence, and atomic-commit status.

Reject terminal `passed` without a real regular file, matching digest/count, complete source set, and required visual evidence. Reject absolute manifest paths, symlinks, unrequested formats, duplicate status transitions, or result evidence created before the current input digest.

- [ ] **Step 5: Implement composition and approval-aware binding**

Use profile render contracts rather than hard-coded product layouts. Emit placeholders with prompt-package links for missing/unapproved generated images. Bind Skillstead SVG as canonical visual and its verified 2× PNG as a format-dependent derivative; never replace structural diagrams with generative art.

- [ ] **Step 6: Verify and commit contracts**

Run:

```bash
node --test tests/unit/document-layout.test.mjs tests/unit/asset-binding.test.mjs tests/unit/render-job-contract.test.mjs tests/unit/validate-artifact.test.mjs
```

Then commit:

```bash
git add shared/document-quality/schema shared/scripts/compose-document-layout.mjs shared/scripts/bind-assets-to-exports.mjs shared/scripts/lib/render-job-contract.mjs shared/export/schema/export-manifest.schema.json tests/unit/document-layout.test.mjs tests/unit/asset-binding.test.mjs tests/unit/render-job-contract.test.mjs tests/unit/validate-artifact.test.mjs
git commit -m "feat(render): add layout and asset binding contracts"
```

### Task 2: Promote proven format inspectors into the packaged runtime

**Files:**
- Create: `shared/export/runtime/hash.mjs`
- Create: `shared/export/runtime/zip.mjs`
- Create: `shared/export/runtime/ooxml.mjs`
- Create: `shared/export/runtime/pdf.mjs`
- Create: `shared/export/runtime/png.mjs`
- Create: `shared/export/runtime/render-bindings.mjs`
- Create: `shared/export/runtime/transaction.mjs`
- Modify: `tests/formats/lib/inspectors.mjs`
- Modify: `tests/formats/lib/ooxml.mjs`
- Modify: `tests/formats/lib/render-bindings.mjs`
- Modify: `tests/formats/generator-transaction.test.mjs`
- Modify: `tests/formats/archive-inspection.test.mjs`
- Modify: `tests/formats/render-binding.test.mjs`
- Test: `tests/unit/export-runtime.test.mjs`

- [ ] **Step 1: Add characterization tests around current format helpers**

Before moving logic, lock current behavior for SHA-256, bounded ZIP members/uncompressed totals/CRC, OOXML relationships and external targets, PDF signature/page count/text source set, PNG signature/dimensions/emptiness, artifact-to-QA digest binding, fresh rerender evidence, symlink/path rejection, staged cleanup, and atomic destination replacement.

- [ ] **Step 2: Run characterization tests**

Run:

```bash
node --test tests/formats/archive-inspection.test.mjs tests/formats/render-binding.test.mjs tests/formats/generator-transaction.test.mjs tests/unit/export-runtime.test.mjs
```

Expected: new runtime-import assertions fail before extraction; existing behavior remains green.

- [ ] **Step 3: Extract one responsibility at a time**

Move the smallest reusable implementations into `shared/export/runtime/` without changing behavior. Keep format-test modules as thin compatibility re-exports where useful so fixture generators and validators do not diverge. Do not import `tests/` from production code.

Public runtime exports must include:

```js
sha256(bytes)
inspectZipArchive(path, limits)
inspectOoxml(path, expectedType)
inspectPdf(path, options)
inspectPng(path, options)
validateRenderBindingManifest(value)
verifyFreshRenderBindings(options)
commitGeneratedTrees(options)
```

- [ ] **Step 4: Preserve fail-closed limits and evidence shape**

Keep all current archive/path/render constraints. Return deterministic public error objects; do not expose raw document bytes. Ensure transaction recovery leaves the former approved destination intact after renderer, inspection, or commit failure.

- [ ] **Step 5: Run the full format helper regression set**

Run:

```bash
node --test tests/unit/export-runtime.test.mjs tests/formats/archive-inspection.test.mjs tests/formats/render-binding.test.mjs tests/formats/generator-transaction.test.mjs tests/formats/runtime-resolver.test.mjs tests/formats/docx-qa.test.mjs tests/formats/pptx-qa.test.mjs
```

- [ ] **Step 6: Commit the runtime extraction**

```bash
git add shared/export/runtime tests/unit/export-runtime.test.mjs tests/formats
git commit -m "refactor(render): package trusted format inspectors"
```

### Task 3: Implement the downstream render-and-verify workflow in both products

**Files:**
- Create: `shared/scripts/render-and-verify-documents.mjs`
- Create: `products/game-design-studio/plugin/skills/render-and-verify-documents/SKILL.md`
- Create: `products/game-design-studio/plugin/skills/render-and-verify-documents/agents/openai.yaml`
- Create: `products/game-design-studio/plugin/skills/render-and-verify-documents/references/runtime-contract.md`
- Create: `products/game-design-career/plugin/skills/render-and-verify-documents/SKILL.md`
- Create: `products/game-design-career/plugin/skills/render-and-verify-documents/agents/openai.yaml`
- Create: `products/game-design-career/plugin/skills/render-and-verify-documents/references/runtime-contract.md`
- Modify: `products/game-design-studio/plugin/skills/export-game-design-documents/SKILL.md`
- Modify: `products/game-design-career/plugin/skills/export-career-documents/SKILL.md`
- Modify: `products/game-design-studio/plugin/references/routing.json`
- Modify: `products/game-design-career/plugin/references/routing.json`
- Modify: `shared/scripts/capability-probe.mjs`
- Test: `tests/products/studio/render-documents.test.mjs`
- Test: `tests/products/career/render-documents.test.mjs`
- Test: `tests/products/studio/output-skills.test.mjs`
- Test: `tests/products/career/output-skills.test.mjs`
- Test: `tests/products/studio/capability-renderer-alignment.test.mjs`
- Modify: `tests/products/studio/product-contract.test.mjs`
- Modify: `tests/products/career/product-contract.test.mjs`

- [ ] **Step 1: Write failing responsibility-boundary tests**

Assert existing prepare functions still stop at renderer-neutral jobs with no generated files or terminal QA claims. Assert only the new skill owns capability invocation, staging, real-file inspection, asset binding, status transitions, and atomic promotion.

Lock the script orchestration API:

```js
renderAndVerifyDocuments({
  job,
  renderers,
  inspectors,
  stagingRoot,
  destinationRoot,
  now,
})
// => validated terminal render result
```

`renderers` are injected adapters for tests. Product `SKILL.md` instructions map available host `documents`, `pdf`, and `presentations` capabilities to the contract; the Node script itself does not assume those tools exist.

- [ ] **Step 2: Run the product tests and confirm failure**

Run:

```bash
node --test tests/products/studio/render-documents.test.mjs tests/products/career/render-documents.test.mjs tests/products/studio/output-skills.test.mjs tests/products/career/output-skills.test.mjs tests/products/studio/capability-renderer-alignment.test.mjs tests/products/studio/product-contract.test.mjs tests/products/career/product-contract.test.mjs
```

- [ ] **Step 3: Implement renderer orchestration**

The script validates the Canonical Artifact, profile, image/diagram registries, preparation manifest, job, and capability snapshot before creating staging. For each requested format, it executes one injected renderer, inspects the resulting regular file, records semantic and visual evidence, and promotes only passed outputs.

MD must preserve local relative assets, alt text, Unicode, section IDs, and profile structure. PDF/DOCX are review-oriented long-form derivatives. PPTX consumes only the independent presentation plan. Unsupported capability results in explicit `unavailable` without damaging other formats.

- [ ] **Step 4: Write both downstream skills**

Each skill must state triggers/non-triggers, prerequisites, preparation handoff, capability routing, per-format renderer contract, QA evidence, partial-failure behavior, prior-output preservation, and terminal completion gates. It must tell the host to use installed artifact skills rather than shell-convert office files when richer capabilities exist.

- [ ] **Step 5: Validate skill and boundary tests**

Run:

```bash
python3 /Users/freelife/.codex/skills/.system/skill-creator/scripts/quick_validate.py products/game-design-studio/plugin/skills/render-and-verify-documents
python3 /Users/freelife/.codex/skills/.system/skill-creator/scripts/quick_validate.py products/game-design-career/plugin/skills/render-and-verify-documents
node --test tests/products/studio/render-documents.test.mjs tests/products/career/render-documents.test.mjs tests/products/studio/output-skills.test.mjs tests/products/career/output-skills.test.mjs tests/products/studio/capability-renderer-alignment.test.mjs
```

- [ ] **Step 6: Commit downstream rendering**

```bash
git add shared/scripts/render-and-verify-documents.mjs shared/scripts/capability-probe.mjs products/game-design-studio/plugin products/game-design-career/plugin tests/products/studio tests/products/career
git commit -m "feat(render): add trusted document rendering workflow"
```

### Task 4: Enforce an independent PPTX story contract

**Files:**
- Modify: `shared/export/schema/export-manifest.schema.json`
- Modify: `shared/scripts/validate-artifact.mjs`
- Modify: `products/game-design-studio/plugin/skills/export-game-design-documents/scripts/prepare-studio-export.mjs`
- Modify: `products/game-design-studio/plugin/skills/export-game-design-documents/scripts/validate-studio-export.mjs`
- Modify: `products/game-design-career/plugin/skills/export-career-documents/scripts/prepare-career-export.mjs`
- Modify: `products/game-design-studio/plugin/references/export-recipes.md`
- Modify: `products/game-design-career/plugin/references/export-recipes.md`
- Modify: `shared/templates/canonical-artifact/export-manifest.yml`
- Modify: `products/game-design-studio/plugin/assets/templates/*/export-manifest.yml`
- Modify: `products/game-design-career/plugin/assets/templates/*/export-manifest.yml`
- Test: `tests/unit/validate-artifact.test.mjs`
- Test: `tests/products/studio/render-documents.test.mjs`
- Test: `tests/products/career/render-documents.test.mjs`
- Test: `tests/formats/pptx-qa.test.mjs`

- [ ] **Step 1: Write failing closed-schema story tests**

Require every planned slide to have exactly:

```text
id, title, message, purpose, source_section_ids,
visual_slots, speaker_notes_required
```

Require kebab-case unique IDs, one non-empty main message, explicit decision purpose, known source sections, known visual slots or an empty array, and a boolean notes policy. Reject canonical Markdown heading lists disguised as slide outlines, duplicate messages, unknown source sections, missing notes, and unknown slide keys.

- [ ] **Step 2: Confirm failures**

Run:

```bash
node --test tests/unit/validate-artifact.test.mjs tests/products/studio/render-documents.test.mjs tests/products/career/render-documents.test.mjs tests/formats/pptx-qa.test.mjs
```

- [ ] **Step 3: Extend preparation while keeping it renderer-neutral**

Studio already validates `id/title/message/purpose`; add the three new fields without weakening its exact-key validation. Add the same closed story validation to Career preparation. Preparation continues to report pending/unavailable/blocked with renderer and QA `not-run`.

- [ ] **Step 4: Update seed manifests and recipes**

Use small representative story outlines appropriate to each template or leave PPTX unavailable where no presentation is requested. Never mechanically repeat every content heading. Recipes must explain audience, decision ask, source binding, visual slots, notes, overflow split, source notes, and full-slide QA.

- [ ] **Step 5: Run and commit PPTX contract checks**

Run:

```bash
node --test tests/unit/validate-artifact.test.mjs tests/products/studio/render-documents.test.mjs tests/products/career/render-documents.test.mjs tests/formats/pptx-qa.test.mjs
```

Then commit:

```bash
git add shared/export/schema/export-manifest.schema.json shared/scripts/validate-artifact.mjs shared/templates/canonical-artifact/export-manifest.yml products/game-design-studio/plugin products/game-design-career/plugin tests/unit/validate-artifact.test.mjs tests/products/studio/render-documents.test.mjs tests/products/career/render-documents.test.mjs tests/formats/pptx-qa.test.mjs
git commit -m "feat(render): enforce presentation story contracts"
```

### Task 5: Extend representative format fixtures with approved diagrams and images

**Files:**
- Modify: `tests/formats/fixtures/studio-live-service-rpg-economy/**`
- Modify: `tests/formats/fixtures/career-entry-12-week-roadmap/**`
- Create: `tests/formats/fixtures/assets/document-approved-concept.png`
- Create: `tests/formats/fixtures/assets/document-approved-concept.provenance.json`
- Modify: `tests/formats/generate-formats.mjs`
- Modify: `tests/formats/verify-formats.mjs`
- Modify: `tests/formats/render-binding.test.mjs`
- Modify: `tests/formats/docx-qa.test.mjs`
- Modify: `tests/formats/pptx-qa.test.mjs`
- Modify: `tests/formats/verify-formats.test.mjs`
- Generated by format gate: `tests/formats/output/**`
- Generated by format gate: `tests/formats/qa/**`

- [ ] **Step 1: Add failing representative visual assertions**

Studio fixture must bind a Skillstead economy diagram and a deterministic document-approved concept image. Career fixture must bind a Skillstead roadmap and a deterministic document-approved portfolio illustration. Use a repository-created, rights-declared, fixed PNG fixture rather than live AI output.

Require MD, PDF, DOCX, and PPTX source sets to contain the approved asset digest and exclude a paired concept-draft/revoked fixture. Require alt text/caption, profile slot, asset ID, approval evidence, and prompt/provenance link.

- [ ] **Step 2: Confirm format failures before fixture generation**

Run:

```bash
npm run test:formats
```

- [ ] **Step 3: Extend generation with approval-aware bindings**

Update fixture generation to call the shared binding/runtime code. Render every PDF page, DOCX page, and PPTX slide; record semantic hashes, source sets, page/slide counts, screenshots, glyph/overflow/crop/empty checks, and visual attestations. Keep Skillstead SVG editable and validate its 2× PNG dimensions.

- [ ] **Step 4: Add hostile binding and stale-render cases**

Test unapproved, revoked, rights-missing, corrupt, wrong-dimension, stale-digest, path-traversal, symlink, and substituted-after-QA assets. Every case must fail before atomic commit and leave prior outputs intact.

- [ ] **Step 5: Regenerate and verify deterministic format evidence**

Run:

```bash
node tests/formats/generate-formats.mjs
npm run test:formats
```

Inspect generated manifests and confirm each output digest is bound to current artifact, profile, diagram/image sources, and full-render evidence.

- [ ] **Step 6: Commit format integration**

```bash
git add tests/formats
git commit -m "test(render): verify approved assets in all formats"
```

### Task 6: Complete product documentation, isolation, E2E, and release validation

**Files:**
- Modify: `README.md`
- Modify: `products/game-design-studio/plugin/README.md`
- Modify: `products/game-design-career/plugin/README.md`
- Modify: `tests/products/studio/readme.test.mjs`
- Modify: `tests/products/career/readme.test.mjs`
- Modify: `tests/e2e/studio/studio-e2e.test.mjs`
- Modify: `tests/e2e/career/career-e2e.test.mjs`
- Modify: `tests/isolation/plugin-smoke.test.mjs`
- Modify: `tests/isolation/no-cross-package-paths.test.mjs`
- Modify: `tooling/validate-suite.mjs`
- Generated by build: `plugins/game-design-studio/**`
- Generated by build: `plugins/game-design-career/**`
- Generated by build: `plugins/BUILD-MANIFEST.json`

- [ ] **Step 1: Add failing end-to-end and release assertions**

For each product, start from a mapped template, apply a Quality Profile, build prompt assets, use deterministic approved image/Skillstead fixtures, prepare exports, render MD/PDF/DOCX/PPTX, run structural/semantic/visual QA, and verify terminal manifests. Run the scenario in an isolated copied plugin without sibling/source paths.

Extend `validate:release` to include profile, image/provider, asset approval, format/visual, snapshot drift, source leakage, secret, and isolation gates. Keep live OpenAI smoke excluded.

- [ ] **Step 2: Update all READMEs with the final architecture**

Document plugin directory structure, shared vs product responsibilities, five new skills, three new roles, hooks/scripts, profile selection, neutral preset boundary, four image modes, provider routing, lifecycle, Skillstead lane, renderer preparation/downstream separation, format-specific output behavior, QA evidence, installation, `.env`, usage examples, and failure recovery.

Include a small Mermaid flow using neutral component names. Do not expose reference-company/source mapping in product README or generated plugin output.

- [ ] **Step 3: Rebuild clean snapshots**

Run:

```bash
npm run build
npm run build -- --check
```

Review generated file lists and shared hashes. Confirm both plugins include every required schema, profile, preset, prompt pattern, QA contract, script, `.env.example`, skill, role, and render runtime while remaining independently installable.

- [ ] **Step 4: Run the full release gate**

Run:

```bash
npm test
npm run test:formats
npm run validate:release
npm run smoke:marketplace
```

Expected: every command exits 0. If a renderer capability is legitimately unavailable, the fixture/runtime contract must report `unavailable` without a false pass; committed representative QA still proves supported outputs.

- [ ] **Step 5: Review repository state and commit release integration**

Run:

```bash
git status --short
git diff --check
git diff --stat
```

Then commit:

```bash
git add README.md products tests tooling/validate-suite.mjs plugins
git commit -m "feat(render): complete trusted document output pipeline"
```

### Plan completion gate

- [ ] Existing export skills remain preparation-only and the new downstream skill owns terminal generation/QA.
- [ ] Only `document-approved` or stronger assets and verified Skillstead diagrams enter final derivatives.
- [ ] MD, PDF, DOCX, and PPTX outputs bind current canonical/profile/asset digests and actual-file QA evidence.
- [ ] PPTX uses independent message/purpose/source/visual/notes stories, not copied Markdown headings.
- [ ] All outputs use staging and atomic promotion; failures preserve canonical and prior approved files.
- [ ] Full-page/full-slide semantic and visual QA catches stale, corrupt, cropped, empty, overflowing, substituted, or unapproved content.
- [ ] Both plugins pass clean build, isolation, E2E, format, release, and marketplace smoke validation.
