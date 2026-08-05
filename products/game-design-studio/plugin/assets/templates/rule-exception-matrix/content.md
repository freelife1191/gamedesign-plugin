---
title: Rule and Exception Matrix
artifact_id: rule-exception-matrix
quality_profile: rule-state-exception-matrix
version: 1
---
# Rule and Exception Matrix {#rule-exception-matrix}

## Rule and Exception Order {#rule-and-exception-order}

Give every rule-id and exception-id a deterministic priority, condition, authority, concurrency behavior, conflict resolution, failure state, recovery action, and test-case.

## Conflict Boundary {#conflict-boundary}

Never resolve contradictory rules by document order or unstated intuition. Unresolved precedence blocks implementation approval and becomes a decision record.

## Working Record {#working-record}

| Field ID | Current state | Evidence or next action | Owner |
| --- | --- | --- | --- |
| `rule-id` | not-observed | Record a project-specific value and evidence address before approval. | artifact-owner |
| `priority` | not-observed | Record a project-specific value and evidence address before approval. | artifact-owner |
| `condition` | not-observed | Record a project-specific value and evidence address before approval. | artifact-owner |
| `exception-id` | not-observed | Record a project-specific value and evidence address before approval. | artifact-owner |
| `concurrency` | not-observed | Record a project-specific value and evidence address before approval. | artifact-owner |
| `authority` | not-observed | Record a project-specific value and evidence address before approval. | artifact-owner |
| `failure` | not-observed | Record a project-specific value and evidence address before approval. | artifact-owner |
| `recovery` | not-observed | Record a project-specific value and evidence address before approval. | artifact-owner |
| `test-case` | not-observed | Record a project-specific value and evidence address before approval. | artifact-owner |

## Assumptions and Boundaries {#assumptions-and-boundaries}

Record each assumption with a stable ID, evidence status, owner, validation action, affected decision, and expiration or review date. An assumption is not an approved fact.

## Owners and Approvals {#owners-and-approvals}

Name the artifact owner, evidence reviewer, discipline approvers, player-safety or accessibility reviewer where applicable, approval status, approval date, and reopen condition. Automation cannot grant approval, rights, or consent.

## Evidence and Freshness {#evidence-and-freshness}

Link every material claim to `evidence.yml` and name its limitation. Current claims require a dated primary source, retrieval date, region or scope, review-after date, and named refresh owner. Third-party, AI-generated, performer-derived, or user-generated material requires source, creator or contributor, attribution, use purpose, rights or consent, privacy, approver, and revocation status.

## Applicable Safety Gates {#applicable-safety-gates}

Before release, identify applicable gates for accessibility, real-money price and probability disclosure, child or vulnerable-player protection, privacy and telemetry, AI or UGC rights and consent, platform policy, experiment guardrails, source and sink abuse risks, stop conditions, and rollback. A non-applicable gate requires a written rationale and human approver.

## Output Story Hints {#output-story-hints}

Markdown preserves the full design and decision record. PDF and DOCX keep the stable hierarchy, evidence addresses, tables, and approval states. PPTX is audience-specific and follows context and target experience, design decision and alternatives, then evidence, risks, and completion gate. Do not split Markdown mechanically by headings.

## Assets {#assets}

No diagram is approved in this seed. Add a diagram only when spatial structure materially improves understanding. Store relative local assets under `assets/`, require nonempty alt text, and record provenance, rights, consent, privacy, approval, and revocation in `assets/README.md`.

## Decisions {#decisions}

Record durable design, scope, safety, evidence, and release choices under `decisions/`. Each decision names alternatives, evidence IDs, rationale, consequences, owner, approval state, rollback, and reopen condition.

## Change History {#change-history}

| Version | Date | Owner | Change | Approval |
| --- | --- | --- | --- | --- |
| 1 | 2026-08-04 | artifact-owner | Created the reviewable production-design seed and its completion boundaries. | pending human review |
