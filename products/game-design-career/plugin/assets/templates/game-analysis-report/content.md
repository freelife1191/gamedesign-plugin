---
title: 게임 분석 보고서
artifact_id: game-analysis-report
quality_profile: game-analysis-report
version: 1
---
# 게임 분석 보고서 {#game-analysis-report}

## Analysis Claims {#analysis-claims}

For each stable claim, record observation, source-address, source type, scope, inference, confidence, counterexample, alternative, and validation-method.

## Decision Use {#decision-use}

State what a designer may learn, what remains unknown, and which evidence would change the analysis. Avoid reconstructing undocumented internal intent as fact.

## 작업 기록 {#working-record}

| 항목 ID | 현재 상태 | 근거 또는 다음 작업 | 담당자 |
| --- | --- | --- | --- |
| `claim-id` | not-observed | Record a project-specific value and evidence address before approval. | artifact-owner |
| `observation` | not-observed | Record a project-specific value and evidence address before approval. | artifact-owner |
| `source-address` | not-observed | Record a project-specific value and evidence address before approval. | artifact-owner |
| `source-type` | not-observed | Record a project-specific value and evidence address before approval. | artifact-owner |
| `scope` | not-observed | Record a project-specific value and evidence address before approval. | artifact-owner |
| `inference` | not-observed | Record a project-specific value and evidence address before approval. | artifact-owner |
| `confidence` | not-observed | Record a project-specific value and evidence address before approval. | artifact-owner |
| `counterexample` | not-observed | Record a project-specific value and evidence address before approval. | artifact-owner |
| `alternative` | not-observed | Record a project-specific value and evidence address before approval. | artifact-owner |
| `validation-method` | not-observed | Record a project-specific value and evidence address before approval. | artifact-owner |

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
