---
name: game-design-studio
description: Use when a game-design request is broad, mixed, or ambiguous, names a Studio case ID, or the user does not know which skill to call, and it has to become one owning product, one route, and one published routing receipt.
---

# Game Design Studio

## Overview

Turn an ordinary request into one owner, one route, and one receipt. This skill produces no design artifact of its own. It normalizes intake, picks the smallest safe route, publishes what it picked, and hands the work to the skill or orchestrator that owns it.

## Triggers

- A request is broad, mixed, or ambiguous and no single skill obviously owns it.
- The user names a case ID such as `ST-G04` instead of a skill.
- The user does not know which skill to call.
- A request needs evidence from both products and an owner has to be chosen.

## Non-triggers

- A request with one clear result belongs to the specialist skill that owns it. Call that skill directly.
- Multi-discipline project coordination that already has a bounded brief belongs to `orchestrate-game-design-project`.
- Career-domain requests belong to the Career product's entry skill.

## What this skill owns

1. Intake normalization.
2. Route decision.
3. Case ID resolution.
4. Routing receipt publication.

Nothing else. Every safety, evidence, and approval rule belongs to the receiving skill and is applied there unchanged. Automatic routing is not automatic approval. Image generation, glossary approval, memory approval, and document publication still stop for a human.

## Intake normalization

Record five fields before routing: the desired final result, the materials the user already has, the publication scope, the human decision owner, and the output format. Leave a field the user did not give as `미정` and continue. Never fill a field with a guess, and never ask more than one round of questions before routing.

## Route decision

- One clear result: route straight to the specialist skill that owns it.
- Mixed, broad, or ambiguous: delegate to `orchestrate-game-design-project`.
- Needs Career evidence: this product stays the owner only when it produces the final artifact. Otherwise the Career entry skill owns the request and this product supplies evidence. Read `references/handoff.md` before starting either direction.

Route only to a skill listed in [routing.json](../../references/routing.json) `skillIds`. A skill outside that list is not a routing target.

## Case ID resolution

A case ID such as `ST-G04` is not a runtime skill ID and must never be passed to a skill as one. Look the ID up in the prompt template catalog and convert it into the route it names. When the ID does not exist, do not guess a neighbouring case: ask once for the missing input, or fall back to normal natural-language routing and say which one you did.

## Routing receipt

Publish this before starting the work:

- the owning product
- the actual skill or orchestrator ID that was selected
- whether a cross-product handoff is required — never write that one is required until the counterpart lookup in `references/handoff.md` has actually run; an unrun lookup makes this line a guess
- the artifact paths that will be created or updated
- current facts, assumptions, and blockers
- the next step that needs a human decision

When the workspace carries a `route-receipt.json`, keep its `schemaVersion`, `requestSha256`, and `bindingNonce` exactly as written and fill `routeId` with the id of a route that exists in [routing.json](../../references/routing.json) `routes`. Never claim a skill ran that did not run.

## Cross-product handoff

One request carries at most one handoff, and only the owner starts it. The supplier returns the requested evidence and nothing else: it does not conclude, approve, or start a handoff of its own. Re-check returned evidence against this product's own rules before using it. Read `references/handoff.md` before you answer whether a handoff is needed, not after: it holds the request and return envelopes and the counterpart lookup you have to run first. Running that lookup is not optional. The counterpart being absent does not shrink the request — it changes what you may claim about it. Folding the supplier's step into this product's own plan, so the reader never learns the evidence has no source, is the exact failure this contract exists to prevent.

## Operating rules

- Never relax a specialist skill's approval, evidence, or safety rule.
- Never route to a skill that is absent from `skillIds`.
- Never invent a value the user did not give. Unknown stays `미정`.
- Never report a skill, an artifact, or a validation that did not actually run.

## Completion report

Report the skill that actually ran, the artifact paths it produced, the validation result, and the decisions still open.
