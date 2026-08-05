---
name: review-image-assets
description: Use when a Studio image asset needs evidence-backed visual, accessibility, rights, placement, or lifecycle review by a named human decision owner.
---

# Review Image Assets

## Boundary

Review agents discover issues and recommend actions; they cannot approve an asset or manufacture a human decision. A generated image is not approval, and `production-candidate` is not release or legal approval.

## Required input

Require the validated `assets/image-assets.yml`, stable asset ID, requested transition, actual user decision evidence, named human reviewer, review time, artifact-local evidence paths, scope, placement, alt text, technical fit, gameplay readability, and rights/provenance decision. Do not use an agent name, a timestamp alone, or generated-file existence as approval evidence.

## Workflow

1. Validate the manifest through packaged `scripts/validate-image-assets.mjs`. Keep findings tied to a stable asset ID and artifact-local evidence; report missing source, rights, placement, accessibility, or user-decision evidence as blockers rather than filling it in.
2. Ask `visual-asset-reviewer` for visual, accessibility, placement, rights, and provenance findings, and `art-brief-director` for purpose, readability, prompt, and variant findings. They may recommend a decision only; neither may approve or self-grant approval.
3. Accept an actual user decision from a named human reviewer, then invoke `applyImageReviewTransition` with reviewer, reviewed time, evidence paths, and rights decision. Preserve the strict order `concept-draft` → `document-approved` → `production-candidate`; reject skipped, direct, or timestamp-only promotion.
4. Require document approval evidence for placement, alt text, readability, named visual review, rights/provenance, and artifact-local evidence. Require technical fit, gameplay readability, active rights, and named human evidence for production candidacy.
5. Block a final derivative or document export binding any asset below `document-approved`. Record a recommendation or unresolved issue without altering approval state when the named human decision is absent.

Use `reviewImageAssetWorkflow` from packaged `scripts/run-image-asset-workflow.mjs` only after saving an artifact-local `host-user-image-decision` receipt. The receipt is host-user-input evidence, not identity authentication, and it must match the stable asset ID, state transition, reviewer, rights decision, and regular non-symlink evidence files.

## Output contract

Return stable asset ID, evidence-bounded findings, named human decision record, requested/accepted transition, lifecycle receipt, unresolved blockers, and derivative eligibility. Never treat reviewer inference, an agent recommendation, or output bytes as approval.
