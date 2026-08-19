---
name: design-game-systems
description: Use when a game mechanic needs executable rules, state transitions, precedence, failure behavior, or UI states.
---

# Design Game Systems

## Overview

Turn a mechanic into an implementable, testable system specification. Make rule order, state, feedback, data ownership, and provisional balance values explicit.

## Triggers

- A mechanic needs rules, state transitions, failure/recovery behavior, priority, concurrency, or abuse analysis.
- Design and engineering need a shared data schema or table/runtime mapping.

## Non-triggers

- Use `define-game-vision` for player promise, core fun, or design pillars.
- Use `design-game-content` for individual quests, levels, characters, enemies, or encounters.
- Use `design-game-economy-and-liveops` for a cross-system economy or LiveOps cadence.

## Required input

Collect the system purpose, actors, inputs, constraints, current rules, failure expectations, authoritative data source, network model, UI surface, known balance evidence, decision owners, and any `analyze-game-design-references` transfer proposal. Treat every reference transfer as `pending-review`; do not turn it into an approved rule or mutate the Canonical Artifact directly.

## Assumption policy

Tag unapproved timings, ratios, costs, probabilities, limits, and other balance values as `provisional`. Attach the source or assumption, risk, calibration owner, validation task, and promotion criterion before treating a value as approved.

## Workflow

1. Read [system-specification.md](../../references/methods/system-specification.md).
2. Define boundaries, actors, input, preconditions, authoritative state, and outputs.
3. Specify ordered rules, priority and concurrency, state transitions, exceptions, failure and recovery, and abuse cases.
4. Map every player-visible state to UI states, feedback, and accessible alternatives.
5. Define the data schema with PK/FK ownership and table/runtime mapping.
6. Convert every provisional balance constant into a validation task; apply gates and reviewer checks.
7. Preserve reference claim and evidence bindings when a reference analysis informs this specification, and keep the transfer proposal separate until human review.

## Output contract

Produce `system-specification` with stable sections for purpose, input, preconditions, rules and precedence, state transitions, output and feedback, exceptions, priority and concurrency, failure and recovery, abuse cases, UI states, data schema, PK, FK, table/runtime mapping, provisional constants, validation tasks, gates, review findings, and owners.

## Responsible-design gates

Read [gates.json](../../references/shared/responsible-design/gates.json) as the authority before evaluating gates. Ask every gate's `applicability_questions`, gather its `evidence_fields`, and keep its declared approver. Cover `ai-rights-human-approval`, `accessibility`, `economy-transparency`, `liveops-experiment`, `ugc-safety`, `ai-npc-safety`, and `scope-control`. When a gate is applicable, initialize `pending`; otherwise use `not-applicable`. Only `not-applicable`, `pending`, `blocked`, and `approved` are lifecycle values. Missing evidence cannot become approval.

## Role reviewers

- `system-economy-designer`: validate rule completeness, precedence, balance assumptions, and data/runtime mapping.
- `ux-accessibility-reviewer`: validate UI states, feedback, error recovery, and accessible alternatives.

## Completion checks

- Every transition has a trigger, guard, source state, target state, side effects, and observable feedback.
- Rules without precedence are undefined and block completion when simultaneous outcomes can differ.
- Every balance constant is evidenced or provisional with a validation task and owner.
- Data ownership, PK/FK, runtime mapping, failure recovery, and applicable gate states are complete.
