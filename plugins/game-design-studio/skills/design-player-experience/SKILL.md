---
name: design-player-experience
description: Use when a game needs information hierarchy, interaction states, first-session learning, tutorial behavior, input design, cross-platform adaptation, performance targets, or accessibility decisions.
---

# Design Player Experience

## Overview

Design a learnable, responsive, and accessible path from first input to confident play. Keep measured facts, provisional targets, current requirements, and approval decisions distinct.

## Triggers

- A HUD, menu, tutorial, onboarding, input flow, feedback state, or first-session experience needs definition.
- Critical actions need accessibility, device, performance, or cross-platform review.

## Non-triggers

- Use `design-game-systems` for executable rules and authoritative state.
- Use `design-game-economy-and-liveops` for prices, probabilities, progression economy, or live experiments.
- Use `plan-game-production` for milestones, staffing, scope, and commitment decisions.

## Required input

Collect target experience, critical actions, target players, first-session goal, platforms, devices, input methods, UI surfaces, known performance measurements, current accessibility evidence, test participants, constraints, and decision owners. Record missing items rather than inventing thresholds.

## Assumption policy

Every unverified number remains provisional. Record its source or assumption, confidence, owner, validation gate, affected player path, and promotion criterion. Current platform and accessibility claims require shared Current evidence; an attractive target is not an approved fact.

## Workflow

1. Read [player-experience.md](../../references/methods/player-experience.md).
2. Trace information priority and every interaction/UI state for each critical action.
3. Define the first five minutes, first success, tutorial skip/revisit, failure feedback, and recovery.
4. Map input, performance, cross-platform, and accessibility differences without copying unsupported thresholds.
5. Attach validation tasks and apply hard No-Go conditions before recommending release.

## Output contract

Produce `ui-ux-flow-state` with stable sections for information priority, interaction and UI states, first five minutes, first success, tutorial skip and revisit, input, performance, cross-platform, accessibility, assumptions, evidence, validation gates, hard No-Go conditions, review findings, and owners.

## Responsible-design gates

Read [gates.json](../../references/shared/responsible-design/gates.json) as authority. Ask every gate's `applicability_questions`, collect its `evidence_fields`, and retain its approver. Cover `ai-rights-human-approval`, `accessibility`, `economy-transparency`, `liveops-experiment`, `ugc-safety`, `ai-npc-safety`, and `scope-control`. When applicable, initialize the gate as pending; otherwise record not applicable. Advance lifecycle only through `not-applicable`, `pending`, `blocked`, or `approved`. Missing evidence cannot become approval.

## Role reviewers

- `ux-accessibility-reviewer`: validate critical tasks, interaction states, learning, alternative modalities, input, performance, and platform evidence.
- `lead-game-designer`: validate alignment with the target experience and core loop.

## Completion checks

- Every critical action has visible states, feedback, recovery, input mappings, and an evidenced accessible alternative; otherwise record `inaccessible-critical-action` and block release.
- Current accessibility or platform requirements without fresh primary evidence record `unverified-current-accessibility` and cannot approve release.
- The first five minutes, first success, tutorial skip/revisit, device differences, performance evidence, owners, and validation gates are explicit.
