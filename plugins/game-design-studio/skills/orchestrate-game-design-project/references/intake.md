# Project intake

Capture the smallest complete brief before routing work.

## Intake fields

Record each field as supplied, safely assumed, unknown, or not applicable:

- target player
- target experience
- platform
- genre
- business model
- online mode
- development stage
- team constraint
- schedule constraint
- technology constraint
- scope
- non-goals
- requested artifact formats
- completion criteria

Also record the decision owner, source material, relevant existing Canonical Artifact, and known deadlines or approval boundaries.

## Memory normalization

Add these normalized fields without changing the selected design route:

```json
{
  "projectId": "existing-artifact-or-explicit-user-id",
  "memoryDisabledForRequest": false
}
```

Normalize an explicit request such as “do not use previous memory for this work” to `memoryDisabledForRequest = true`. It skips retrieval and candidate capture for this request only. When there is no project ID, skip memory as `skipped-project-id-missing`; ask for an ID only if it materially changes the design route, and continue the baseline workflow. Memory unavailability never blocks the Canonical Artifact.

## Assumption policy

Make a safe assumption only when it is reversible, low impact, clearly labeled, and does not determine a responsible-design or release decision. Record every safe assumption with its affected section, validation owner, and replacement question.

Ask only when the missing answer materially changes the result: route selection, target experience, architecture, committed scope, schedule, cost, safety, legal exposure, approval, or requested deliverable. Otherwise proceed with a visible safe assumption.

Do not assume rights, consent, human approval, real price or odds, accessibility coverage, experiment guardrails, rollback, ownership, evidence, or a specialist identity. Leave the affected field unknown and expose the resulting gate.

## Intake result

Return:

1. normalized brief fields;
2. assumptions and unresolved questions;
3. selected direct route or orchestration fallback;
4. requested Canonical Artifact and output formats;
5. applicable responsible-design questions and decision owners.
