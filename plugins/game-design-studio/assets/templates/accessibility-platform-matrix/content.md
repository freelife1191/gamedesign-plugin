---
title: Accessibility and Platform Matrix
artifact_id: accessibility-platform-matrix
version: 1
---
# Accessibility and Platform Matrix {#accessibility-platform-matrix}

## Platform Access Matrix {#platform-access-matrix}

For every platform and critical action record input method, remapping, focus navigation, visual alternative, audio alternative, text scale, motion or haptic option, performance budget, safe area, offline or interruption behavior, and verification.

## Accessibility Completion Gate {#accessibility-completion-gate}

A critical action is not complete when a required state, cue, input path, recovery path, or equivalent sensory alternative is missing or unverified on a supported platform.

## Working Record {#working-record}

| Field ID | Current state | Evidence or next action | Owner |
| --- | --- | --- | --- |
| `platform` | not-observed | Record a project-specific value and evidence address before approval. | artifact-owner |
| `critical-action` | not-observed | Record a project-specific value and evidence address before approval. | artifact-owner |
| `input-method` | not-observed | Record a project-specific value and evidence address before approval. | artifact-owner |
| `focus-navigation` | not-observed | Record a project-specific value and evidence address before approval. | artifact-owner |
| `visual-alternative` | not-observed | Record a project-specific value and evidence address before approval. | artifact-owner |
| `audio-alternative` | not-observed | Record a project-specific value and evidence address before approval. | artifact-owner |
| `text-scale` | not-observed | Record a project-specific value and evidence address before approval. | artifact-owner |
| `performance` | not-observed | Record a project-specific value and evidence address before approval. | artifact-owner |
| `offline-interruption` | not-observed | Record a project-specific value and evidence address before approval. | artifact-owner |
| `verification` | not-observed | Record a project-specific value and evidence address before approval. | artifact-owner |

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
