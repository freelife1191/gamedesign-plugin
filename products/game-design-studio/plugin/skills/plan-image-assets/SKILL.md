---
name: plan-image-assets
description: Use when a Studio canonical artifact needs a profile-bound image asset manifest, reusable prompt package, placeholders, or a Skillstead diagram evidence handoff before any image generation.
---

# Plan Image Assets

## Boundary

Plan only. Do not create an image, call an image provider, or advance an approval state. Keep the canonical artifact authoritative and retain existing stable asset IDs, human decisions, generated outputs, and provenance when replanning.

## Required input

Collect the canonical artifact root, its selected document-quality profile and selection record, explicit image needs, stable source section IDs, audience, placement, accessibility intent, requested variants, and the named downstream decision owner. Require an explicit asset count for each requested category. Unknown counts stay as visible placeholders; do not infer a company, project, character, or brand identity.

## Workflow

1. Run `apply-document-quality-profile` first. Resolve the selected profile's `required_images` and `recommended_images` before creating a plan. Reject an image need whose slot is not in that profile instead of writing a manifest that later fails preflight.
2. Match every explicit need to a profile slot and record its stable asset ID, category, quantity, source section, purpose, placement, alt text, dimensions, preserve/exclude constraints, and placeholder state. Cover character, NPC, monster/boss, skill/VFX, environment/landmark, item/equipment, UI icon, story/storyboard, key art/pitch concept, document illustration/cover, and Skillstead slots whenever the chosen profile requires them.
3. Invoke the packaged `scripts/build-image-asset-plan.mjs` export with the validated artifact, quality profile, and any existing `assets/image-assets.yml` manifest. Write its manifest to `assets/image-assets.yml`; record the required, recommended, variant, and total counts exactly as returned.
4. Load the packaged image prompt-pattern catalog and invoke the `scripts/compile-image-prompts.mjs` export. Write both `assets/prompts/image-prompts.md` and `assets/prompts/image-prompts.json` on every run, including prompt-only work and placeholders. Preserve the explicit counts and stable asset IDs in both outputs.
5. For a Skillstead diagram slot, create a separate diagram authority handoff: editable SVG is the authority, a verified `@2x` PNG is a derivative, and the handoff includes source mapping, nonempty SVG `<title>` and `<desc>`, adjacent alt text, lint command/result, renderer identity/result, and two-stage visual QA evidence. Hand it to the visualization workflow; planning does not generate SVG or PNG bytes.
6. Record that all new assets remain `concept-draft`, that planning is not human approval, and that named review plus artifact-local evidence are required before document insertion or production candidacy. Hand the manifest, prompt package, placeholders, selection record, and Skillstead evidence checklist to `generate-image-assets` and `review-image-assets`.

## Cutscene handoff

When `design-cutscene-visual-preproduction` supplies a cutscene manifest, treat its closed
`cutsceneWorkflow` as the sole authority. Invoke
`validateCutsceneManifestHandoff({manifest})`, then safe-write the supplied manifest to
`assets/image-assets.yml` without changing stable IDs, DAG hash, prompt hash, approval binding,
wave records, or any asset bytes. Do not call the general image planner, compile general prompts,
or bind template references in this branch. The cutscene planner owns those operations.

Prompt Only still delivers a complete cutscene package: brief, beat sheet, shot list, continuity
bible, master-reference plan, expected artifact-relative paths, prompts, and generation guide.
Template references never invent image hashes; only generation-ready binding reads current regular
files under `assets/generated/` through the secure reference loader.

## Output contract

Produce or update exactly these artifact-local files:

- `assets/image-assets.yml`
- `assets/prompts/image-prompts.md`
- `assets/prompts/image-prompts.json`

Return the profile-slot preflight result, explicit required/recommended/variant/total counts, stable asset IDs, placeholder list, unfilled inputs, and downstream human-review and Skillstead QA handoffs. Never expose a reference organization or source-project identity in a manifest or prompt package.
