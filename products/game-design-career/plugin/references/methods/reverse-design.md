# Falsifiable reverse-design method

Reverse design is not a user manual. Its unit of analysis is one bounded, disprovable claim.

## Scope and surfaces

Record build/version, platform, region, account and player state, observation date, and source access. Cover these domains explicitly:

- `UI`: UI states, transitions, affordances, disabled/error states, and feedback;
- `rules`: triggers, preconditions, outcomes, limits, and exceptions;
- `data`: visible values, changes, timing, relationships, and unknown storage or computation;
- `operations`: schedules, resets, rotations, grants, moderation, live changes, and dependencies;
- `uncertainty`: missing access, contradictory behavior, alternative explanations, and validation limits.

## Claim-level contract

Create one material claim per record using `../fact-inference-schema.json`. Every record carries:

- `observation`: scoped behavior or cited material with a stable evidence address;
- `inference`: a bounded explanation that may be null;
- `confidence`: `unassessed`, `low`, `medium`, or `high`, justified by the observations;
- `counterexample`: an observation that contradicts or narrows the claim;
- `alternative`: a competing explanation consistent with current evidence;
- `validationMethod`: the next observation, comparison, experiment, source, or instrumentation needed to distinguish explanations.

Do not group claims under a shared confidence or validation label. If two statements can fail independently, split them into two records.

## Fact and inference boundary

Facts require directly observed game behavior or cited material and remain bounded to the recorded build, state, and source. Internal intent, hidden data structures, economy purpose, production constraints, causal explanations, and implementation choices remain inferences until validated by appropriate evidence.

When `observation` is empty, the schema requires `inference: null` and `confidence: unassessed`. Do not rank alternatives or call one “most likely” with zero game-specific evidence. Record the alternatives as questions and define a validation method instead.

## System trace

Trace each interaction as:

`player action → UI state → rule/exception → visible data effect → operation/dependency → uncertainty`

Use the trace to find missing claims, not to merge them. Retain surprising cases and counterexamples, because they may reveal state-dependent rules or invalidate the proposed model.

## Completion audit

- Can every observation be reopened at its evidence address?
- Can observation and inference be read separately?
- Does every inference have a counterexample, alternative, and validation method?
- Are UI states, rules and exceptions, data, operations, and uncertainty covered or marked inaccessible?
- Is unsupported likelihood absent when there is no game-specific evidence?
