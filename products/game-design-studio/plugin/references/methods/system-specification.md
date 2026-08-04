# Game System Specification Method

Use this method to make a system executable by design, engineering, UI, QA, analytics, and operations.

## Output schema

| Field | Required detail |
| --- | --- |
| Input | Actor, command/event, payload, source, validation, and authority |
| Preconditions | State, permissions, resources, cooldown, connectivity, and version |
| Rules | Stable rule ID, condition, effect, precedence, and rationale |
| State transitions | Source, trigger, guard, target, side effects, and emitted events |
| Output and feedback | Data result, player feedback, analytics event, and latency target |
| Exceptions | Boundary and invalid-input behavior |
| Priority and concurrency | Ordering, tie-break, idempotency, locking, and race resolution |
| Failure and recovery | Retry, rollback, reconnect, compensation, and player support path |
| Abuse cases | Exploit, spam, duplication, griefing, automation, and mitigation |
| UI states | Idle, loading, success, partial, empty, blocked, error, and recovery |
| Data schema | Entity, field, type, constraint, owner, retention, and migration |
| PK / FK | Identity, relationship, cascade policy, and referential integrity |
| Table/runtime mapping | Source table/config, runtime object, cache, event, and write-back path |

## Rule precedence

Number precedence from highest to lowest and define a deterministic tie-break. Rules without precedence are undefined when more than one rule can fire; mark the artifact `blocked`, add a decision owner, and create a test case before implementation.

For every transition, state whether evaluation is server-authoritative, client-predicted, or offline. Define concurrency using sequence IDs, idempotency keys, locks, conflict policy, and late-event handling as applicable.

## Provisional balance values

Treat timings, ratios, costs, probabilities, caps, cooldowns, and other balance values as provisional until user approval or evidence exists. For each value record:

- assumption and source;
- expected player/system effect;
- safe test range and guardrail;
- telemetry or playtest method;
- calibration owner and validation task;
- promotion criterion and rollback trigger.

## Adversarial example

**Reject:** “On death, revive after 5 seconds for 20% currency, except VIP revives instantly.” These rules have no precedence for simultaneous free-revive, VIP, disconnect, and insufficient-funds cases; both constants are falsely treated as approved.

**Repair:** Assign stable rule IDs and precedence, define tie-break and authority, enumerate failure/recovery states, and tag `5 seconds` and `20%` provisional with validation tasks and owners.

## Responsible-design gate record

Record each applicable gate as `pending`, `blocked`, or `approved`, or explain `not-applicable`; include evidence and owner. Evaluate `accessibility`, `scope-control`, and conditional `economy-transparency`, `ugc-safety`, and `ai-npc-safety`. Missing evidence is never approved.
