---
name: review-image-assets
description: Use when a Career image asset needs evidence-backed visual, accessibility, rights, placement, or lifecycle review by a named human decision owner.
---

# Review Image Assets

## Boundary

Review can identify gaps and recommend the smallest repair. It cannot turn an image into career evidence, approve a portfolio claim, or create a human decision. `production-candidate` is not release or legal approval.

## Required input

Collect the validated `assets/image-assets.yml`, stable asset ID, requested state, actual user decision evidence, named human reviewer, review time, artifact-local evidence paths, placement, alt text, scope, readability, technical fit, and rights/provenance decision. A generated file, agent conclusion, or timestamp without the named human decision is insufficient.

## Workflow

1. Validate the manifest with packaged `scripts/validate-image-assets.mjs`. Bind every finding to a stable asset ID and artifact-local evidence. Keep absent provenance, placement, accessibility, user-decision evidence, or rights data as visible blockers.
2. Use `visual-asset-reviewer` for visual, accessibility, placement, rights, and provenance findings, and `art-brief-director` for purpose, readability, prompt, and variant findings. Each can recommend a decision, but cannot approve or self-grant it.
3. Receive the actual user decision from a named human, then invoke `applyImageReviewTransition` with reviewer, reviewed time, evidence paths, and rights decision. Enforce `concept-draft` → `document-approved` → `production-candidate`; reject skipped, direct, agent-only, and timestamp-only transitions.
4. For document approval, require placement, alt text, readability, named visual review, rights/provenance, and artifact-local evidence. For production candidacy, additionally require technical fit, gameplay readability, active rights, and named human rights/provenance evidence.
5. Block a final derivative or document export that binds an asset below `document-approved`. When evidence is incomplete, retain only the recommendation and unresolved blockers; do not change approval state.

Use `reviewImageAssetWorkflow` from packaged `scripts/run-image-asset-workflow.mjs` only after saving an artifact-local `host-user-image-decision` receipt. This is host-user-input operating evidence, not authentication; it must match the stable asset ID, transition, reviewer, rights decision, and regular non-symlink evidence files.

## Output contract

Return the stable asset ID, evidence-bounded findings, named human decision record, requested and accepted lifecycle transition, receipt, blockers, and derivative eligibility. Never represent an agent recommendation, renderer output, or asset bytes as approval.
