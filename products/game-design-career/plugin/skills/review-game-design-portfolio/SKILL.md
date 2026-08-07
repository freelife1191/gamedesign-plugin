---
name: review-game-design-portfolio
description: Use when a game design portfolio, case study, or evidence package needs a hiring, mentorship, readiness, or revision review.
---

# Review Game Design Portfolio

## Overview

Review what the evidence makes observable, not what polished prose suggests. Treat evidence completeness and candidate ability as separate judgments.

## Load Reference

Read `../../references/methods/five-axis-review.md` before scoring or writing findings. Use its exact axes, finding types, observation states, and finding record.

## Review Workflow

1. Inventory stable section IDs and evidence IDs. Preserve unavailable or inaccessible items as explicit gaps.
2. Review all five axes independently. Record contradiction, unsupported certainty, duplication, unclear scope, and missing sources as separate finding types.
3. Mark each check as `not-observed`, `no-defect`, or `defect-observed`. Never convert missing observation into a clean bill of health.
4. Give an axis score only when the cited section and evidence IDs support it. A zero may describe evidence completeness; it must not imply zero ability.
5. Rank findings by reviewer impact and dependency. For every highest-impact finding, provide the smallest repair that makes the next review possible.
6. Report unresolved claims and the exact verification task or honest-answer pattern needed to close each one.

## Integrity Boundary

Do not invent team size, revenue, retention, personal ownership, implementation status, or result. Do not infer competence, authorship, or impact from visual polish. Missing evidence remains `not-observed` and becomes a verification task or honest-answer pattern.

## Output Contract

Return the `five-axis-review` output with the evidence inventory, five-axis records, typed findings, evidence-qualified scores, highest-impact repair queue, and unresolved verification tasks. Materialize that repair queue as the `portfolio-backlog` output when a resumable backlog is requested. Keep every score and finding linked to stable section and evidence IDs.

## Completion

Finish only when all five axes have an explicit observation state, every score is evidence-addressable, and the highest-impact findings each have a minimum repair.
