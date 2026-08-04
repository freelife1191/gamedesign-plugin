---
name: define-game-vision
description: Use when a game concept needs a target-player definition, experience intent, core fun, design pillars, motivation loops, or measurable vision criteria.
---

# Define Game Vision

## Overview

Convert game intent into a testable vision artifact. Preserve uncertainty so unsupported audience, emotion, fun, and success claims cannot masquerade as facts.

## Triggers

- A concept needs game vision, design pillars, core fun, desired emotion, meaningful choices, or a motivation loop.
- A team needs measurable criteria for deciding whether a feature supports the intended experience.

## Non-triggers

- Use `design-game-systems` for executable rules, state transitions, or schemas.
- Use `design-game-content` for a quest, character, level, enemy, or other content unit.
- Keep mixed or ambiguous multi-domain work in `orchestrate-game-design-project`.

## Required input

Collect target-player evidence, experience intent, desired emotion, concept constraints, known player research, business/platform constraints, and the decision owner. Record missing items rather than inventing them.

## Assumption policy

Label each material claim as `provided`, `sourced`, `assumption`, or `provisional`. An unsupported age/demographic band or success target requires a source, baseline, calibration owner, validation plan, and a task that states how evidence changes the artifact.

## Workflow

1. Read [vision.md](../../references/methods/vision.md).
2. Separate user evidence, external evidence, assumptions, and unresolved questions.
3. Define the target player and experience intent without inferring identity from genre or platform.
4. Operationalize desired emotion and core fun through player verbs, decisions, tension, feedback, and variation.
5. Define pillars, core and motivation loops, meaningful choices, success metrics, assumptions, and non-goals.
6. Apply applicable responsible-design gates and send the artifact to the declared reviewers.

## Output contract

Produce `vision-pillars` with stable sections for target player, experience intent, desired emotion, core fun, design pillars, core loop, motivation loop, meaningful choice, success metrics, assumptions, non-goals, evidence links, validation tasks, gate status, review findings, and decision owners.

## Responsible-design gates

Evaluate `accessibility` and `scope-control` for every vision. Evaluate `ugc-safety`, `ai-npc-safety`, and `economy-transparency` when their applicability questions are true. Record evidence, owner, and one of `not-applicable`, `pending`, `blocked`, or `approved`; missing evidence cannot become approval.

## Role reviewers

- `lead-game-designer`: test coherence, differentiation, choices, and falsifiability.
- `content-narrative-designer`: test emotional progression, player motivation, and content implications.

## Completion checks

- Every required output section exists and every quantitative claim names its evidence or provisional status.
- Core fun is executable and observable, never only an unsupported fun adjective.
- Applicable gates are `approved` or visibly `blocked`; assumptions and non-goals have owners.
- Review findings are resolved or retained as explicit decisions.
