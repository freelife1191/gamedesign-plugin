---
name: reverse-engineer-game-design
description: Use when a game designer needs to analyze an existing game's UI, rules, exceptions, data behavior, operations, economy, or production-facing system assumptions without access to authoritative internal design records.
---

# Reverse Engineer Game Design

## Overview

Build a falsifiable model of the game, not a user manual. Keep every material claim independently inspectable so a reviewer can tell what was seen, what was inferred, and what evidence could overturn it.

## Load References

1. Read `../../references/methods/reverse-design.md` before observing or structuring the analysis.
2. Read `../../references/fact-inference-schema.json` before creating claim records. Preserve its fields and zero-evidence condition exactly.

## Analyze

1. Bound the build/version, platform, account state, region, time window, player state, and accessible sources. Missing scope becomes uncertainty.
2. Inventory material claims across UI states, rules and exceptions, data behavior, operations, and uncertainty. Create one schema-valid record per claim; never group claims that could be disproved separately.
3. Treat observed behavior and cited material as facts only within their recorded scope. Record the evidence address in `observation`.
4. Keep internal intent, data structures, economy purpose, and production constraints as inferences until validated. Do not convert a plausible explanation into a fact.
5. For each inference, record confidence, a counterexample, at least one alternative, and a concrete `validationMethod`. Confidence describes evidence support, not rhetorical certainty.
6. Do not assign a “most likely” implementation when there is zero game-specific evidence. Use `confidence: unassessed` and `inference: null`; propose observations that could create a supported hypothesis.
7. Trace player action through UI state, rule or exception, visible data change, downstream operation, and unresolved uncertainty. Preserve contradictory observations rather than averaging them away.

## Output Contract

Return scope, claim records, state/rule/data/operation relationships, competing explanations, contradiction log, validation queue, and explicit unknowns. Keep product behavior separate from implementation or intent claims.

## Completion

Finish only when every material claim occupies its own record, every fact has observed or cited support, every non-null inference is falsifiable, and all confidence values can be traced to evidence. An explanation that only describes how to use the feature is incomplete.
