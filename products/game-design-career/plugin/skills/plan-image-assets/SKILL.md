---
name: plan-image-assets
description: Use when a Career canonical artifact needs a profile-bound image asset manifest, reusable prompt package, placeholders, or a Skillstead diagram evidence handoff before any image generation.
---

# Plan Image Assets

## Boundary

Plan only. Do not create an image, call an image provider, or move an asset through approval. Keep canonical career evidence authoritative and preserve stable asset IDs, human decisions, generated outputs, and provenance when replanning.

## Required input

Collect the canonical artifact root, selected document-quality profile and selection record, explicit image needs, stable source section IDs, intended viewer, portfolio or document placement, accessibility intent, requested variants, and named downstream decision owner. Require an explicit asset count for each requested category. Keep missing counts as visible placeholders; never infer employer, project, character, or brand identity.

## Workflow

1. Run `apply-document-quality-profile` first. Resolve the selected profile's `required_images` and `recommended_images` before planning. Stop and surface a profile-slot mismatch instead of creating a plan that will fail later.
2. Bind every explicit need to a validated profile slot. Record a stable asset ID, category, count, source section, purpose, placement, alt text, dimensions, preserve/exclude constraints, and placeholder state. Cover character, NPC, monster/boss, skill/VFX, environment/landmark, item/equipment, UI icon, story/storyboard, key art/pitch concept, document illustration/cover, and Skillstead whenever the chosen profile calls for that slot.
3. Invoke the packaged `scripts/build-image-asset-plan.mjs` export with the validated artifact, quality profile, and any prior `assets/image-assets.yml`. Write `assets/image-assets.yml` and preserve the returned required/recommended/variant/total counts exactly.
4. Load the packaged prompt-pattern catalog and invoke the `scripts/compile-image-prompts.mjs` export. Always write `assets/prompts/image-prompts.md` and `assets/prompts/image-prompts.json`, including prompt-only work and unavailable-provider placeholders. Preserve stable asset IDs and explicit counts in both outputs.
5. Route each Skillstead diagram through a separate evidence authority: editable SVG is authoritative and a verified @2x PNG is derivative. Its handoff includes stable source mapping, nonempty title and desc, adjacent alt text, lint result, render result and renderer identity, plus two-pass visual QA. Use the visualization workflow for actual diagram work; planning creates no SVG or PNG bytes.
6. Keep planned assets in `concept-draft`. Planning cannot authorize a portfolio claim, document insertion, or production candidacy. Hand the manifest, prompt package, placeholders, selection record, and Skillstead checklist to `generate-image-assets` and `review-image-assets` for named-human evidence.

## Output contract

Produce or update these artifact-local files:

- `assets/image-assets.yml`
- `assets/prompts/image-prompts.md`
- `assets/prompts/image-prompts.json`

Return the profile-slot preflight, explicit required/recommended/variant/total counts, stable asset IDs, placeholders, missing inputs, and review/Skillstead QA handoffs. Do not disclose an external organization or source-project identity in prompts or manifest output.
