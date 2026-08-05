---
name: apply-document-quality-profile
description: Use when a career portfolio, reverse-design document, evidence review, presentation, PDF, DOCX, or PPTX needs a deterministic quality profile before content or asset planning.
---

# Apply Document Quality Profile

## Overview

Select and compose one validated Career document-quality contract per canonical artifact. Build the stable structural checklist before authoring while preserving evidence, rights, renderer, and human-decision boundaries.

## Contract

<!-- document-quality-contract:start -->
```json
{
  "product": "game-design-career",
  "primaryNamespace": "profiles/career",
  "selection": {
    "indexPath": "../../references/shared/document-quality/indexes/career.json",
    "inputs": ["goal", "audience", "artifactType", "requestedFormat"],
    "precedence": ["known-explicit-override", "compatible-template-map-match", "artifact-type-match", "requested-format-match", "audience-overlap", "goal-overlap", "profile-id-lexical"],
    "scoreTuple": ["templateMatch", "artifactTypeMatch", "formatMatch", "audienceOverlap", "goalOverlap"],
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
    "maxProfilePresets": 1,
    "maxReferencePresets": 1,
    "profilePreset": "optional-profile-shaped-additive",
    "referencePreset": "optional-validated-separate-guidance",
    "presetMode": "validated-separate-guidance",
    "reject": ["removal", "identity-leakage", "scalar-contradiction", "unknown-id", "schema-invalid"]
  },
  "progressiveLoading": {
    "preSelection": ["profile-id-index", "product-template-map"],
    "unknownComparison": ["nearest-profile-body"],
    "postSelection": ["selected-primary", "requested-overlays", "optional-profile-preset", "optional-reference-preset", "relevant-render-contract", "selection-and-profile-schemas"],
    "forbidden": ["bulk-catalog-load", "authoring-evidence"]
  },
  "output": {
    "selectionRecord": ["artifactId", "goal", "audience", "artifactType", "requestedFormat", "primaryProfileId", "overlayIds", "presetId", "renderContractId", "templateId", "selectionReason", "score", "tieBreak", "fallbackRecord"],
    "checklist": ["sections", "tables", "diagrams", "images", "acceptanceCriteria"],
    "stableIdsRequired": true,
    "acceptanceIdRule": "source-id-plus-normalized-sha256-16",
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

1. Split incompatible deliverables or formats into separate artifact records; never combine two primary profiles.
2. Before selection, read only `../../references/shared/document-quality/indexes/career.json` and `../../references/document-quality/template-profile-map.json`. Never preload profile bodies. Normalize IDs and inputs to Unicode NFC, lowercase, and kebab tokens.
3. Accept an explicit override only when its normalized ID is known and compatible with both artifact type and requested format. For an unknown ID, compute Levenshtein distance over normalized IDs, break equal distances lexically, load only the single nearest profile body, and report its artifact-type, audience, and format differences. Do not select it until an explicit fallback record names a known compatible primary.
4. Otherwise filter by artifact type and requested format. Score the exact tuple `templateMatch, artifactTypeMatch, formatMatch, audienceOverlap, goalOverlap` descending; compute audience overlap from normalized audience tokens and goal overlap from profile ID, artifact-type, and audience tokens. Break a remaining tie by lexical profile ID.
5. After selection, read only the selected primary JSON, requested known overlays, at most one known neutral preset, the relevant render contract, and the selection/profile schemas under `../../references/shared/document-quality/`. Never bulk-load profile bodies or authoring-only evidence.
6. Compose primary, overlays, and an optional profile-shaped additive preset through the public profile composer. Validate an optional neutral `referencePreset` through `validateReferencePreset` and keep its `emphasis`, review questions, recommended diagrams, story hints, and additional acceptance guidance separate from the closed profile. Reject removals, unsafe source or URL text, scalar conflicts, unknown IDs, or invalid results.
7. Copy every required section, table, diagram, image, and acceptance criterion into a checklist. Keep source IDs for structured items. Derive each string criterion ID as `<source-id>-acceptance-<first-16-hex-of-SHA-256>` over Unicode-NFC, trimmed, whitespace-collapsed, lowercase criterion text; insertion order must not alter it. Declare diagrams as Skillstead-compatible slots unverified until renderer QA.
8. Return the selection record, composed requirements, checklist status, conflicts, blockers, and current document state before content generation or asset planning.

## State Gates

Advance only `draft -> structurally-complete -> evidence-reviewed -> visual-reviewed -> document-approved`. Rebuild the trusted checklist and digest from the composed profile; caller-owned checklist flags cannot complete it. Require a closed evidence-auditor review record, passed renderer QA plus every Skillstead slot verification digest, approved rights and responsible-gate records, and an explicit named-human receipt at their own stages. Reject extra record keys, generated or rendered-file booleans, and self-attestation.
