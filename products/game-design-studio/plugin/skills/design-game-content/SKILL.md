---
name: design-game-content
description: Use when a quest, level, encounter, character, enemy, narrative unit, or repeatable activity needs a playable and production-aware specification.
---

# Design Game Content

## Overview

Specify a content unit as a playable expression of canonical systems. Connect player strategy and outcomes to explicit data dependencies and evidence-backed production resources.

## Triggers

- A quest, level, encounter, character, enemy, narrative beat, or repeatable activity needs detailed design.
- A content idea needs system inputs, player telegraphs, rewards, repeatability, or production feasibility.

## Non-triggers

- Use `define-game-vision` for the overall player promise or design pillars.
- Use `design-game-systems` when rules, state transitions, or schemas are not yet canonical.
- Use `plan-game-production` for portfolio-wide staffing, milestones, or scheduling.
- Use `design-cutscene-visual-preproduction` for 컷씬, 시네마틱, 스토리보드, master image, prompt, or continuity packages.

## Required input

Collect content purpose, target player state, canonical supporting system IDs, schema/table fields, production budget evidence, team and pipeline evidence, player strategy target, reward contract, repeatability target, accessibility needs, and owners.

## Assumption policy

Do not state person-day cost, team capacity, throughput, or schedule as fact without team and pipeline evidence. Tag estimates as `provisional`, show the observable unit count and rate basis, name an estimator and validation task, and attach every content dependency to a canonical system or data ID.

## Workflow

1. Read [content-specification.md](../../references/methods/content-specification.md).
2. Define the content purpose, player context, strategy, and intended repeatability.
3. Link system inputs, states, data fields, events, rewards, and failure behavior by canonical ID.
4. Specify setup, telegraph, decision points, outcomes, rewards, variation, and replay behavior.
5. Estimate production resources from observable content units and measured pipeline rates; otherwise keep the estimate provisional.
6. Apply responsible-design gates and obtain content, design, and production reviews.

## Output contract

Produce `narrative-quest-npc` with stable sections for purpose, system inputs, canonical system/data dependencies, production resources, player strategy, telegraph, decision points, outcomes, rewards, repeatability, variation, failure/recovery, accessibility, evidence, assumptions, validation tasks, gate states, review findings, and owners.

## Responsible-design gates

Read [gates.json](../../../../../shared/responsible-design/gates.json) as the authority before evaluating gates. Ask every gate's `applicability_questions`, gather its `evidence_fields`, and keep its declared approver. Cover `ai-rights-human-approval`, `accessibility`, `economy-transparency`, `liveops-experiment`, `ugc-safety`, `ai-npc-safety`, and `scope-control`. When a gate is applicable, initialize `pending`; otherwise use `not-applicable`. Only `not-applicable`, `pending`, `blocked`, and `approved` are lifecycle values. Missing evidence cannot become approval.

## Role reviewers

- `content-narrative-designer`: validate purpose, pacing, strategy, telegraph, outcomes, rewards, and repeatability.
- `lead-game-designer`: validate vision, pillar, loop, and meaningful-choice alignment.
- `production-feasibility-critic`: validate asset counts, dependencies, pipeline evidence, capacity, and scope.
- `combat-encounter-reviewer`: when the selected content intent matches its routing trigger, validate telegraphs, counterplay, recovery, dominant combinations, and boss trivialization as findings only.
- `level-puzzle-reviewer`: when the selected content intent matches its routing trigger, validate paths, feedback, reset/retry, recovery, progression blocks, and accessibility alternatives as findings only.

## Completion checks

- Every content behavior and reward links to a canonical system/data dependency ID.
- Content detached from production cost or system data is blocked, not treated as ready.
- Person-day claims are supported by team/pipeline evidence or marked provisional with validation tasks.
- Player strategy, telegraphs, outcomes, rewards, repeatability, reviews, and applicable gates are complete.
