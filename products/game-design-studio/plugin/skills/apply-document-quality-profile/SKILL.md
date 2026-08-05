---
name: apply-document-quality-profile
description: Use when a Studio game-design artifact, GDD, review report, presentation, PDF, DOCX, or PPTX needs a deterministic quality profile before content or asset planning.
---

# Apply Document Quality Profile

## Overview

Select and compose one validated Studio document-quality contract per canonical artifact. Produce its stable structural checklist before authoring; never convert generation, rendering, or self-attestation into approval.

## Contract

<!-- document-quality-contract:start -->
```json
{
  "product": "game-design-studio",
  "primaryNamespace": "profiles/studio",
  "selection": {
    "inputs": ["goal", "audience", "artifactType", "requestedFormat"],
    "precedence": ["known-explicit-override", "compatible-template-map-match", "artifact-type-match", "requested-format-match", "audience-overlap", "goal-overlap", "profile-id-lexical"],
    "primaryCount": 1,
    "unknownOverride": {
      "selected": false,
      "nearestTieBreak": "profile-id-lexical",
      "report": ["requestedProfileId", "nearestProfileId", "differences"],
      "fallbackRequiresExplicitRecord": true
    },
    "incompatibleDeliverables": "separate-selection-records"
  },
  "composition": {
    "overlays": "known-additive-only",
    "maxPresets": 1,
    "reject": ["removal", "identity-leakage", "scalar-contradiction", "unknown-id", "schema-invalid"]
  },
  "progressiveLoading": {
    "afterSelection": ["selected-primary", "requested-overlays", "optional-preset", "relevant-render-contract", "product-template-map"],
    "forbidden": ["bulk-catalog-load", "authoring-evidence"]
  },
  "output": {
    "selectionRecord": ["artifactId", "goal", "audience", "artifactType", "requestedFormat", "primaryProfileId", "overlayIds", "presetId", "renderContractId", "templateId", "selectionReason", "fallbackRecord"],
    "checklist": ["sections", "tables", "diagrams", "images", "acceptanceCriteria"],
    "stableIdsRequired": true,
    "diagrams": "skillstead-compatible-slots-unverified-until-render-qa"
  },
  "states": ["draft", "structurally-complete", "evidence-reviewed", "visual-reviewed", "document-approved"],
  "structuralBlockers": ["sections", "tables", "diagrams", "images", "acceptanceCriteria"],
  "neverAutoApproveFrom": ["generated-image", "rendered-file", "requested-diagram", "self-attestation"],
  "preservedGates": ["evidence", "image-rights", "human-approval", "renderer-qa", "responsible-design", "release"]
}
```
<!-- document-quality-contract:end -->

## Workflow

1. Split incompatible deliverables or formats into separate artifact records. Never combine two primary profiles.
2. Normalize `goal`, `audience`, `artifactType`, and `requestedFormat`. Read `../../references/document-quality/template-profile-map.json` only to resolve a known template candidate.
3. Accept an explicit override only when its ID exists under `../../references/shared/document-quality/profiles/studio/` and its export rules allow the requested format. For an unknown ID, compare Unicode-NFC lowercase kebab IDs by Levenshtein distance, break equal distances lexically, and report the nearest ID plus concrete artifact-type, audience, and format differences. Do not select it until an explicit fallback record names a known primary.
4. Otherwise rank compatible candidates by the declared precedence. Select exactly one primary and record every tie-break. If candidates remain incompatible, keep the artifact blocked.
5. After selection, read only the selected primary JSON, requested known overlays under `../../references/shared/document-quality/overlays/`, at most one known neutral preset under `../../references/shared/document-quality/presets/`, the relevant contract under `../../references/shared/document-quality/render-contracts/`, and the product template map. Never bulk-load either profile namespace or authoring-only evidence.
6. Compose additively. Reject removals, identity-bearing source material, scalar conflicts, unknown IDs, or any result that fails the packaged selection and profile schemas.
7. Copy every required section, table, diagram, image, and acceptance criterion into a checklist using its stable ID. Declare every diagram as a Skillstead-compatible slot; requested or generated visuals remain unverified until renderer QA.
8. Return the selection record, composed requirements, checklist status, conflicts, blockers, and current document state before content generation or asset planning.

## State Gates

Advance only `draft -> structurally-complete -> evidence-reviewed -> visual-reviewed -> document-approved`. Block `structurally-complete` while any required section, table, diagram slot, image slot, or acceptance criterion is missing. Require external evidence review, renderer QA, rights checks, and named human approval at their own stages; never skip a state or self-attest `document-approved`.
