---
title: Game Design Competency Matrix
artifact_id: competency-matrix
quality_profile: competency-matrix
version: 1
---
# 기획 항목: Game Design Competency Matrix {#competency-matrix}

## 기획 항목: Requirement Matrix {#requirement-matrix}

Each requirement-id links to a stable evidence-id, observation state, scope, and reviewer. Use not-observed when evidence is unavailable.

## 기획 항목: Repair and Re-evaluation {#repair-and-re-evaluation}

Do not convert missing evidence into an ability score of zero. Record minimum-repair, owner, proof artifact, and re-evaluation date.

## 기획 항목: Working Record {#working-record}

| 항목 ID | 현재 상태 | 근거 또는 다음 작업 | 담당자 |
| --- | --- | --- | --- |
| `requirement-id` | not-observed | Record a project-specific value and evidence address before approval. | artifact-owner |
| `evidence-id` | not-observed | Record a project-specific value and evidence address before approval. | artifact-owner |
| `observation-state` | not-observed | Record a project-specific value and evidence address before approval. | artifact-owner |
| `target-level` | not-observed | Record a project-specific value and evidence address before approval. | artifact-owner |
| `gap` | not-observed | Record a project-specific value and evidence address before approval. | artifact-owner |
| `minimum-repair` | not-observed | Record a project-specific value and evidence address before approval. | artifact-owner |
| `owner` | not-observed | Record a project-specific value and evidence address before approval. | artifact-owner |
| `re-evaluation-date` | not-observed | Record a project-specific value and evidence address before approval. | artifact-owner |

## 기획 항목: Assumptions and Boundaries {#assumptions-and-boundaries}

Record each assumption with a stable ID, evidence status, owner, validation action, and the decision that remains blocked. An assumption is not an approved fact.

## 기획 항목: Owners and Approvals {#owners-and-approvals}

Name the artifact owner, evidence reviewer, publication or privacy approver where applicable, approval status, approval date, and reopen condition. Automation cannot grant approval or rights.

## 기획 항목: Evidence and Freshness {#evidence-and-freshness}

Link material claims to `evidence.yml`. Classify evidence as evergreen, contextual, or time-sensitive; current claims require a dated primary source, retrieval date, region or scope, review-after date, and named refresh owner. Third-party material also records source, attribution, use purpose, rights or quotation notes, and privacy disposition.

## 기획 항목: Output Story Hints {#output-story-hints}

The Markdown source preserves the full decision record. PDF and DOCX keep the same hierarchy. PPTX tells a short audience-specific story: context and decision, evidence and alternatives, then result or unresolved verification work. Do not split Markdown mechanically by headings.

## 기획 항목: Assets {#assets}

The first diagram may be added later after evidence is available. Store only relative local files under `assets/`, add nonempty alt text, and record source and rights in `assets/README.md`.

## 기획 항목: Decisions {#decisions}

Record durable scope, evidence, and publication choices under `decisions/`. Each decision names alternatives, rationale, owner, approval state, and reopen condition.

## 기획 항목: Change History {#change-history}

| 버전 | 날짜 | 담당자 | 변경 내용 | 승인 |
| --- | --- | --- | --- | --- |
| 1 | 2026-08-04 | artifact-owner | Created the reviewable seed and its completion boundaries. | pending human review |
