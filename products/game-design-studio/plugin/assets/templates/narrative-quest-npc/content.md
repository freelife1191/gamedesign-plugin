---
title: Narrative Quest and NPC
artifact_id: narrative-quest-npc
quality_profile: narrative-quest-npc-specification
version: 1
---
# 기획 항목: Narrative Quest and NPC {#narrative-quest-npc}

## 기획 항목: Narrative Content Contract {#narrative-content-contract}

Connect each content-id to player purpose, system inputs, production resources, entry condition, choice and consequence, quest state, NPC state, telegraph, outcome, reward, repeatability, and owner.

## 기획 항목: AI and UGC Rights Boundary {#ai-and-ugc-rights-boundary}

When AI-generated, performer-derived, or user-generated material is used, record source, creator or contributor, attribution, use purpose, rights or consent, privacy, moderation, approver, and revocation path before release.

## 기획 항목: Working Record {#working-record}

| 항목 ID | 현재 상태 | 근거 또는 다음 작업 | 담당자 |
| --- | --- | --- | --- |
| `content-id` | not-observed | Record a project-specific value and evidence address before approval. | artifact-owner |
| `player-purpose` | not-observed | Record a project-specific value and evidence address before approval. | artifact-owner |
| `entry-condition` | not-observed | Record a project-specific value and evidence address before approval. | artifact-owner |
| `choice-consequence` | not-observed | Record a project-specific value and evidence address before approval. | artifact-owner |
| `quest-state` | not-observed | Record a project-specific value and evidence address before approval. | artifact-owner |
| `npc-state` | not-observed | Record a project-specific value and evidence address before approval. | artifact-owner |
| `telegraph` | not-observed | Record a project-specific value and evidence address before approval. | artifact-owner |
| `reward` | not-observed | Record a project-specific value and evidence address before approval. | artifact-owner |
| `repeatability` | not-observed | Record a project-specific value and evidence address before approval. | artifact-owner |
| `rights-consent` | not-observed | Record a project-specific value and evidence address before approval. | artifact-owner |

## 기획 항목: Assumptions and Boundaries {#assumptions-and-boundaries}

Record each assumption with a stable ID, evidence status, owner, validation action, affected decision, and expiration or review date. An assumption is not an approved fact.

## 기획 항목: Owners and Approvals {#owners-and-approvals}

Name the artifact owner, evidence reviewer, discipline approvers, player-safety or accessibility reviewer where applicable, approval status, approval date, and reopen condition. Automation cannot grant approval, rights, or consent.

## 기획 항목: Evidence and Freshness {#evidence-and-freshness}

Link every material claim to `evidence.yml` and name its limitation. Current claims require a dated primary source, retrieval date, region or scope, review-after date, and named refresh owner. Third-party, AI-generated, performer-derived, or user-generated material requires source, creator or contributor, attribution, use purpose, rights or consent, privacy, approver, and revocation status.

## 기획 항목: Applicable Safety Gates {#applicable-safety-gates}

Before release, identify applicable gates for accessibility, real-money price and probability disclosure, child or vulnerable-player protection, privacy and telemetry, AI or UGC rights and consent, platform policy, experiment guardrails, source and sink abuse risks, stop conditions, and rollback. A non-applicable gate requires a written rationale and human approver.

## 기획 항목: Output Story Hints {#output-story-hints}

Markdown preserves the full design and decision record. PDF and DOCX keep the stable hierarchy, evidence addresses, tables, and approval states. PPTX is audience-specific and follows context and target experience, design decision and alternatives, then evidence, risks, and completion gate. Do not split Markdown mechanically by headings.

## 기획 항목: Assets {#assets}

No diagram is approved in this seed. Add a diagram only when spatial structure materially improves understanding. Store relative local assets under `assets/`, require nonempty alt text, and record provenance, rights, consent, privacy, approval, and revocation in `assets/README.md`.

## 기획 항목: Decisions {#decisions}

Record durable design, scope, safety, evidence, and release choices under `decisions/`. Each decision names alternatives, evidence IDs, rationale, consequences, owner, approval state, rollback, and reopen condition.

## 기획 항목: Change History {#change-history}

| 버전 | 날짜 | 담당자 | 변경 내용 | 승인 |
| --- | --- | --- | --- | --- |
| 1 | 2026-08-04 | artifact-owner | Created the reviewable production-design seed and its completion boundaries. | pending human review |
