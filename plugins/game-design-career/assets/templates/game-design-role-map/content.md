---
title: Game Design Role Map
artifact_id: game-design-role-map
version: 1
---
# Game Design Role Map {#game-design-role-map}

## Role Families and Tradeoffs {#role-families-and-tradeoffs}

For each role-family, record target-level, current-evidence, gap, tradeoff, learning task, feedback cadence, and proof-artifact.

## Provisional Paths {#provisional-paths}

Keep at least two plausible paths when the target is unclear. Never rank by age, education, major, or employment gap.

## Working Record {#working-record}

| Field ID | Current state | Evidence or next action | Owner |
| --- | --- | --- | --- |
| `role-family` | not-observed | Record a project-specific value and evidence address before approval. | artifact-owner |
| `current-evidence` | not-observed | Record a project-specific value and evidence address before approval. | artifact-owner |
| `target-level` | not-observed | Record a project-specific value and evidence address before approval. | artifact-owner |
| `gap` | not-observed | Record a project-specific value and evidence address before approval. | artifact-owner |
| `learning-task` | not-observed | Record a project-specific value and evidence address before approval. | artifact-owner |
| `feedback-cadence` | not-observed | Record a project-specific value and evidence address before approval. | artifact-owner |
| `proof-artifact` | not-observed | Record a project-specific value and evidence address before approval. | artifact-owner |
| `tradeoff` | not-observed | Record a project-specific value and evidence address before approval. | artifact-owner |

## Assumptions and Boundaries {#assumptions-and-boundaries}

Record each assumption with a stable ID, evidence status, owner, validation action, and the decision that remains blocked. An assumption is not an approved fact.

## Owners and Approvals {#owners-and-approvals}

Name the artifact owner, evidence reviewer, publication or privacy approver where applicable, approval status, approval date, and reopen condition. Automation cannot grant approval or rights.

## Evidence and Freshness {#evidence-and-freshness}

Link material claims to `evidence.yml`. Classify evidence as evergreen, contextual, or time-sensitive; current claims require a dated primary source, retrieval date, region or scope, review-after date, and named refresh owner. Third-party material also records source, attribution, use purpose, rights or quotation notes, and privacy disposition.

## Output Story Hints {#output-story-hints}

The Markdown source preserves the full decision record. PDF and DOCX keep the same hierarchy. PPTX tells a short audience-specific story: context and decision, evidence and alternatives, then result or unresolved verification work. Do not split Markdown mechanically by headings.

## Assets {#assets}

The first diagram may be added later after evidence is available. Store only relative local files under `assets/`, add nonempty alt text, and record source and rights in `assets/README.md`.

## Decisions {#decisions}

Record durable scope, evidence, and publication choices under `decisions/`. Each decision names alternatives, rationale, owner, approval state, and reopen condition.

## Change History {#change-history}

| Version | Date | Owner | Change | Approval |
| --- | --- | --- | --- | --- |
| 1 | 2026-08-04 | artifact-owner | Created the reviewable seed and its completion boundaries. | pending human review |
