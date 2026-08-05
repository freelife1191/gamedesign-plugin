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
    "indexPath": "../../references/shared/document-quality/indexes/studio.json",
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
    "upperApply": {
      "overlays": "closed-overlayIds-only",
      "preset": "closed-neutral-presetId-or-null",
      "loader": "packaged-pluginRoot-exact-non-symlink-paths",
      "sourceBodies": "canonical-version-semantic-and-raw-byte-digest-bound",
      "rawObjects": "rejected",
      "scalarConflicts": "fail-closed"
    },
    "reject": ["removal", "identity-leakage", "scalar-contradiction", "unknown-id", "schema-invalid"]
  },
  "progressiveLoading": {
    "preSelection": ["profile-id-index", "product-template-map"],
    "unknownComparison": ["nearest-profile-body"],
    "postSelection": ["selected-primary", "requested-overlays", "optional-neutral-preset", "relevant-render-contract", "selection-and-profile-schemas"],
    "forbidden": ["bulk-catalog-load", "authoring-evidence"]
  },
  "output": {
    "selectionRecord": ["artifactId", "goal", "audience", "artifactType", "requestedFormat", "primaryProfileId", "overlayIds", "presetId", "renderContractId", "templateId", "selectionReason", "score", "tieBreak", "fallbackRecord"],
    "checklist": ["sections", "tables", "diagrams", "images", "acceptanceCriteria"],
    "requirementManifest": ["schemaVersion", "sourceBindings", "contractDigest", "checklistDigest", "requiredItemIds", "manifestDigest"],
    "stableIdsRequired": true,
    "acceptanceIdRule": "source-id-plus-normalized-sha256-16",
    "diagrams": "skillstead-compatible-slots-unverified-until-render-qa"
  },
  "stateEnvelope": {
    "binding": ["artifactDigest", "manifestDigest", "contractDigest", "checklistDigest"],
    "receipts": "exact-ordered-cumulative-revalidated",
    "callerStateStrings": "rejected"
  },
  "structuralCompletion": "external-artifact-inspection-receipt-only",
  "states": ["draft", "structurally-complete", "evidence-reviewed", "visual-reviewed", "document-approved"],
  "structuralBlockers": ["sections", "tables", "diagrams", "images", "acceptanceCriteria"],
  "neverAutoApproveFrom": ["generated-image", "rendered-file", "requested-diagram", "self-attestation"],
  "preservedGates": ["evidence", "image-rights", "human-approval", "renderer-qa", "responsible-design", "release"]
}
```
<!-- document-quality-contract:end -->

## Workflow

1. Split incompatible deliverables or formats into separate artifact records. Never combine two primary profiles.
2. Before selection, read only `../../references/shared/document-quality/indexes/studio.json` and `../../references/document-quality/template-profile-map.json`. Never preload profile bodies. Normalize IDs and inputs to Unicode NFC, lowercase, and kebab tokens.
3. Accept an explicit override only when its normalized ID is known and compatible with both artifact type and requested format. For an unknown ID, compute Levenshtein distance over normalized IDs, break equal distances lexically, load only the single nearest profile body, and report its artifact-type, audience, and format differences. Do not select it until an explicit fallback record names a known compatible primary.
4. Otherwise filter by artifact type and requested format. Score the exact tuple `templateMatch, artifactTypeMatch, formatMatch, audienceOverlap, goalOverlap` descending; compute audience overlap from normalized audience tokens and goal overlap from profile ID, artifact-type, and audience tokens. Break a remaining tie by lexical profile ID.
5. After selection, pass only known `overlayIds` (`mobile`, `live-service`, `pc-console`) and at most one known neutral `presetId`; production upper apply loads those exact bodies from the packaged `pluginRoot` through exact non-symlink paths. Bind the selected primary, every overlay, and the neutral preset to the compiled canonical version and source-body digest. Reject a known ID with substituted bytes or data. The upper apply API rejects raw overlay, profile-preset, and reference-preset objects. Never bulk-load profile bodies or authoring-only evidence.
6. Keep the public low-level profile composer compatible with raw profile-shaped additive overlays/presets and its conflict report. An explicitly injectable test loader must return the closed `{ "sourceText": "<canonical JSON bytes decoded as UTF-8>" }` shape; upper apply verifies its raw-byte digest before parsing and then verifies the same semantic/version anchors as packaged loading. At the upper apply boundary, validate the loaded neutral preset separately, reject ID/body mismatch, symlink or path escape, and fail closed when the low-level composition reports any scalar conflict.
7. Copy every required section, table, diagram, image, and acceptance criterion into a checklist. Keep source IDs for structured items. Derive each string criterion ID as `<source-id>-acceptance-<first-16-hex-of-SHA-256>` over Unicode-NFC, trimmed, whitespace-collapsed, lowercase criterion text; insertion order must not alter it. Declare diagrams as Skillstead-compatible slots unverified until renderer QA.
8. Return one trusted immutable upper-apply application containing the selection record, composed requirements, checklist, and requirement manifest before content generation or asset planning. Re-derive the manifest from that exact application at every structural/state boundary. Its digest covers ordered canonical source bindings, contract digest, checklist digest, and the complete ordered required-ID set. A caller-supplied or cloned/shrunk manifest is never authority. Remain in `draft` until an external artifact-inspection adapter supplies an exact manifest- and artifact-digest-bound receipt for the actual artifact.

## State Gates

Advance only `draft -> structurally-complete -> evidence-reviewed -> visual-reviewed -> document-approved` through an immutable state envelope; reject caller state strings. Recursively capture each public data input once, rejecting Proxy/accessor, custom-prototype, repeated-reference, symbol, hidden-property, unsafe-Unicode, and cyclic inputs before validation or use. Bind one artifact digest to the full manifest, contract, and checklist digests and preserve exact ordered cumulative receipts. Structural completion requires the external inspection receipt to report every canonical required ID as observed and passed; requirements alone never synthesize completion. Revalidate every prior receipt against the trusted application on every transition. Evidence audit, renderer QA plus every Skillstead slot receipt, rights, all responsible gates, and the named-human receipt must bind to the same artifact and carry valid receipt digests. Reject missing, replaced, reordered, duplicate, or extra fields, generated/rendered claims, self-attestation, and cross-artifact receipt splicing.
