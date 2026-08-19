---
name: plan-game-production
description: Use when a game concept needs prototype gates, scope priorities, milestones, ownership, or kill criteria.
---

# Plan Game Production

## Overview

Convert design intent into staged, falsifiable commitments. Preserve concept exploration while blocking expensive promises that lack target-experience, prototype, capacity, dependency, or ownership evidence.

## Triggers

- A concept, feature, content set, platform, or service needs prototype, milestone, scope, effort, risk, or ownership planning.
- A team needs a commit, defer, reduce, outsource, license, or kill decision.

## Non-triggers

- Use `define-game-vision` to establish the target player and target experience.
- Use `design-game-systems` for executable mechanic rules and data contracts.
- Use `design-game-economy-and-liveops` for economy balance and live experiment safety.

## Required input

Collect target experience, core loop, approved scope, team and discipline capacity, measured throughput, schedule constraints, technology constraints, dependencies, maintenance horizon, licensing and outsource terms, prototype evidence, milestone intent, decision owners, and known risks. Record unknowns instead of filling them with industry defaults.

## Assumption policy

Every participant count, schedule, person-week, performance target, network target, success rate, cost, or capacity estimate requires source or assumption, confidence, owner, validation gate, and range basis. Unsupported values remain provisional and cannot authorize procurement, staffing, external work, or a large commitment.

## Workflow

1. Read [production.md](../../references/methods/production.md).
2. Trace every proposed scope item to its core-loop contribution and target-experience evidence.
3. Estimate observable units and effort ranges from team/pipeline evidence; map dependencies, maintenance burden, licensing risk, and outsource risk.
4. Define the cheapest prototype hypothesis, milestone, owner, definition of done, and kill criterion.
5. Classify scope with MoSCoW, record unresolved evidence, and apply hard No-Go conditions before approving commitments.

## Output contract

Produce `production-scope-risk` with stable sections for core-loop contribution, effort, dependencies, maintenance burden, licensing risk, outsource risk, prototype hypothesis, milestone, owner, definition of done, kill criterion, MoSCoW scope, assumptions, evidence, validation gates, review findings, decisions, and blockers.

## Responsible-design gates

Read [gates.json](../../../../../shared/responsible-design/gates.json) as authority. Ask every gate's `applicability_questions`, collect its `evidence_fields`, and retain its approver. Cover `ai-rights-human-approval`, `accessibility`, `economy-transparency`, `liveops-experiment`, `ugc-safety`, `ai-npc-safety`, and `scope-control`. When applicable, initialize pending; otherwise record not applicable. Advance lifecycle only through `not-applicable`, `pending`, `blocked`, or `approved`. Missing evidence cannot become approval.

## Role reviewers

- `production-feasibility-critic`: validate estimates, capacity, dependencies, maintenance, licensing, outsource terms, milestones, done criteria, and kill criteria.
- `lead-game-designer`: validate target-experience evidence, core-loop contribution, prototype hypothesis, and scope priority.

## Completion checks

- A large commitment without a stated target experience records `missing-target-experience`; without prototype evidence it records `missing-prototype-evidence`.
- A commitment using invented participants, schedule, person-weeks, performance/network targets, success rates, capacity, or cost records `unsupported-large-estimate`.
- Concept exploration may continue, but procurement, staffing, outsourcing, production approval, and irreversible scope expansion stay blocked while any hard No-Go remains.
