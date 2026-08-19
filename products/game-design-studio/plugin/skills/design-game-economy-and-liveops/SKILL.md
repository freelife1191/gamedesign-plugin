---
name: design-game-economy-and-liveops
description: Use when a game needs currency flows, progression pacing, monetization, gacha pity rules, or liveops events.
---

# Design Game Economy and LiveOps

## Overview

Design transparent value flows and reversible live changes. Never turn missing commercial, probability, player-protection, rights, or rollback evidence into approval.

## Triggers

- A game needs sources, sinks, inventory targets, progression time, inflation controls, prices, probabilities, or pity behavior.
- An event, cohort rollout, segmentation, or live balance change needs an experiment contract.

## Non-triggers

- Use `design-game-systems` for a single mechanic's executable state and rule precedence.
- Use `design-player-experience` for input, tutorial, interaction states, and accessible critical actions.
- Use `plan-game-production` for team capacity, milestones, and scope commitments.

## Required input

Collect business model, currencies, sources, sinks, target inventory, progression target, inflation evidence, real-price policy, disclosed probability and pity data, regions and age paths, event goal, hypothesis, control, treatment, sample evidence, duration, success and guardrail metrics, stop criteria, rollback mechanism, AI/UGC provenance and consent, owners, and approvers. Preserve unknowns.

## Assumption policy

Tag each unverified number as provisional with source or assumption, confidence, owner, validation gate, and promotion criterion. Never invent a price ladder, probability, pity rule, sample, duration, legal position, guardrail, or rollback merely to complete the document.

## Workflow

1. Read [economy-liveops.md](../../references/methods/economy-liveops.md).
2. Model sources, sinks, target inventory, progression time, and inflation before monetization recommendations.
3. Trace real price, currency conversion, probability, pity, eligibility, expiry, and player consequences.
4. For live change, define one hypothesis, control, single variable, sample basis, duration, success metrics, guardrail metrics, stop criteria, and tested rollback.
5. Route current policy, regulation, accessibility, AI, UGC, and monetization claims through shared Current evidence; apply hard No-Go conditions.

## Output contract

Produce either `economy-balance` or `liveops-experiment-event` with stable sections for sources, sinks, target inventory, progression time, inflation, real price, probability, pity, hypothesis, control, single variable, sample, duration, success metrics, guardrail metrics, stop criteria, rollback plan, rights and consent, assumptions, evidence, gates, review findings, and owners.

## Responsible-design gates

Read [gates.json](../../../../../shared/responsible-design/gates.json) as authority. Ask every gate's `applicability_questions`, collect its `evidence_fields`, and retain its approver. Cover `ai-rights-human-approval`, `accessibility`, `economy-transparency`, `liveops-experiment`, `ugc-safety`, `ai-npc-safety`, and `scope-control`. When applicable, initialize pending; otherwise record not applicable. Advance lifecycle only through `not-applicable`, `pending`, `blocked`, or `approved`. Missing evidence cannot become approval.

## Role reviewers

- `system-economy-designer`: validate value flows, pacing, inflation, real-price conversion, probability, pity, and transparency.
- `liveops-data-designer`: validate hypothesis, control, single-variable isolation, sample basis, metrics, stop conditions, and rollback.
- `ux-accessibility-reviewer`: validate purchase comprehension, pressure, critical alternatives, age paths, and affected-player protections.

## Completion checks

- Unknown or undisclosed real price records `missing-real-price`; unknown randomized reward odds record `missing-probability`.
- An untested or absent rollback records `missing-rollback`; missing guardrails, treatment boundaries, stop criteria, or accountable ownership records `unsafe-liveops-experiment`.
- AI or UGC without provenance, rights, consent, moderation, and required human approval records `missing-ai-ugc-rights-consent`.
- Any listed blocker is a hard No-Go for the affected release or experiment, never a conditional approval.
