---
name: game-design-career
description: Use when a game-design career request is broad, mixed, or ambiguous, names a Career case ID, or the user does not know which skill to call, and it has to become one owning product, one route, and one published routing receipt.
---

# Game Design Career

## Overview

Turn an ordinary career request into one owner, one route, and one receipt. This skill produces no career artifact of its own. It normalizes intake, picks the smallest evidence-safe route, publishes what it picked, and hands the work to the skill or orchestrator that owns it.

## Triggers

- A request is broad, mixed, or ambiguous and no single skill obviously owns it.
- The user names a case ID such as `CA-C07` instead of a skill.
- The user does not know which skill to call.
- A request needs evidence from both products and an owner has to be chosen.

## Non-triggers

- A request with one clear result belongs to the specialist skill that owns it. Call that skill directly.
- Career-stage diagnosis that already has its evidence belongs to `orchestrate-game-design-career`.
- Game-design production requests belong to the Studio product's entry skill.

## What this skill owns

1. Intake normalization.
2. Route decision.
3. Case ID resolution.
4. Routing receipt publication.

Nothing else. Every safety, evidence, and approval rule belongs to the receiving skill and is applied there unchanged. Automatic routing is not automatic approval. This skill never promises an outcome, never invents experience the user does not have, and never declares one universally correct career.

## Intake normalization

Record five fields before routing: the desired final result, the materials the user already has, the publication scope, the human decision owner, and the output format. Leave a field the user did not give as `미정` and continue. Never fill a field with a guess, and never ask more than one round of questions before routing.

## Route decision

- One clear result: route straight to the specialist skill that owns it.
- Mixed, broad, or ambiguous: delegate to `orchestrate-game-design-career`.
- Needs Studio evidence: this product stays the owner only when it produces the final artifact, which is the usual case for career work. Otherwise the Studio entry skill owns the request and this product supplies evidence. Read `references/handoff.md` before starting either direction.

Route only to a skill listed in [routing.json](../../references/routing.json) `skillIds`. A skill outside that list is not a routing target.

## Case ID resolution

A case ID such as `CA-C07` is not a runtime skill ID and must never be passed to a skill as one. Look the ID up in the prompt template catalog and convert it into the route it names. When the ID does not exist, do not guess a neighbouring case: ask once for the missing input, or fall back to normal natural-language routing and say which one you did.

## Routing receipt

Publish this before starting the work:

- the owning product
- the actual skill or orchestrator ID that was selected
- whether a cross-product handoff is required
- the artifact paths that will be created or updated
- current facts, assumptions, and blockers
- the next step that needs a human decision

When the workspace carries a `route-receipt.json`, keep its `schemaVersion`, `requestSha256`, and `bindingNonce` exactly as written and fill `routeId` with the id of a route that exists in [routing.json](../../references/routing.json) `routes`. Never claim a skill ran that did not run.

## Cross-product handoff

One request carries at most one handoff, and only the owner starts it. The supplier returns the requested evidence and nothing else: it does not conclude, approve, or start a handoff of its own. Re-check returned evidence against this product's own rules before using it. Read `references/handoff.md` for the request and return envelopes and for what to do when the other product is not installed.

## Operating rules

- Never relax a specialist skill's approval, evidence, or safety rule.
- Never route to a skill that is absent from `skillIds`.
- Never invent a value the user did not give. Unknown stays `미정`.
- Never report a skill, an artifact, or a validation that did not actually run.

## Completion report

Report the skill that actually ran, the artifact paths it produced, the validation result, and the decisions still open.
