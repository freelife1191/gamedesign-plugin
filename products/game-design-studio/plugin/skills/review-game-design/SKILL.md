---
name: review-game-design
description: Use when a canonical game design artifact needs critique, launch-readiness review, risk review, or blocker triage.
---

# Review Game Design

## Overview

Review only traceable claims and stable sections. Block a verdict when the source artifact is absent, and preserve genuine reviewer disagreement for an accountable decision owner.

## Triggers

- A canonical artifact needs design critique, readiness review, evidence audit, or risk prioritization.
- A decision owner needs minimal repairs rather than a rewritten design.

## Non-triggers

- Use a design skill to create or materially redesign the source artifact.
- Use `visualize-game-design` to clarify spatial structure after review.
- Use `export-game-design-documents` only after the canonical artifact and review state are valid.

## Required input

Collect the canonical artifact path, requested review questions, decision owner, review boundary, target stage, applicable responsible-design gates, and any role-review envelopes. Require stable section IDs and evidence locators for every reviewed claim.

## Assumption policy

Never reconstruct an absent source, invent evidence, or present illustrative content as source-derived material. Label a hypothetical example `illustrative` and `non-canonical`; exclude it from findings, severity, and readiness decisions.

## Workflow

1. Load [review-contract.md](references/review-contract.md) and the canonical [review-finding.md](../../../../../shared/templates/review-finding.md).
2. Validate the canonical artifact before reading claims. If unavailable or invalid, record `source-unavailable` and stop the substantive review.
3. Scope each review question to stable section IDs and evidence records. Select at most three role reviewers; run the same envelopes sequentially in declared role priority when parallel review is unavailable.
4. Normalize every actionable issue to the Finding contract. Keep unsupported concerns as questions, not findings.
5. Merge exact duplicates only. Preserve conflicting recommendations as decision items with alternatives, trade-offs, affected sections, evidence, and decision owner.
6. Order findings by severity, affected stable section ID, and role priority. Do not let formatting or export failures mutate the canonical artifact.

## Finding contract

Every finding contains `id`, `severity`, `evidence`, `impact`, `affectedSectionId`, `minimalFix`, `owner`, `status`, and `reviewerRole`. Evidence identifies a claim or source locator; impact states the player, product, production, safety, or decision consequence; the minimal fix is the smallest observable repair that resolves the finding.

## Output contract

Produce `game-design-review` with stable sections for review scope, findings, decision items, blockers, and review status.

## Role reviewers

- Select only roles relevant to the scoped questions, with a maximum of three.
- Use `lead-game-designer` for intent, coherence, meaningful choice, and design trade-offs.
- Use `production-feasibility-critic` for dependency, estimate, prototype, rights, and commitment risk.
- Use `ux-accessibility-reviewer` for comprehension, critical actions, alternatives, and player protection.
- Use `combat-encounter-reviewer` only for matching combat, boss, or encounter questions; it returns non-blocking findings only.
- Use `level-puzzle-reviewer` only for matching puzzle, level-design, route, reset, retry, or progression-block questions; it returns non-blocking findings only.
- Retain originating role and role priority on every finding and decision item.

## Completion checks

- Missing, unreadable, invalid, or unversioned canonical input records `source-unavailable`; review status remains blocked and no substantive finding is fabricated.
- Every finding has severity, direct evidence, impact, affected stable section ID, minimal fix, owner, reviewer role, and lifecycle status.
- Conflicting recommendations remain decision items until the named decision owner records a choice and rationale.
- Blockers remain visible; an unresolved blocker cannot become an approved readiness verdict.
- The review changes only the review package or decision log unless the user separately authorizes source edits.
