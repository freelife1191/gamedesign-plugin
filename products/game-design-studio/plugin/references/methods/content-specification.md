# Game Content Specification Method

Use this method for quests, levels, encounters, enemies, characters, narrative units, and repeatable activities.

## Output schema

| Field | Required detail |
| --- | --- |
| Purpose | Player-facing intent, pillar, loop position, and non-goals |
| System inputs | Canonical system ID, state, rule/event ID, data field, and version |
| Production resources | Content units, disciplines, dependencies, pipeline stage, evidence, and owner |
| Player strategy | Information, options, trade-offs, viable approaches, and counterplay |
| Telegraph | Signal, channel, lead time, accessibility alternative, and comprehension check |
| Outcomes | Success, partial success, failure, recovery, persistence, and analytics event |
| Rewards | Reward ID, source system, amount/range, eligibility, economy effect, and fallback |
| Repeatability | Cadence, variation, mastery, fatigue guardrail, reset, and expiry behavior |

## Canonical dependency map

Give every dependency a stable identifier: `systemId`, `ruleId`, `stateId`, `eventId`, `table.field`, `assetId`, and `pipelineStageId` as applicable. A prose-only dependency is unresolved. Record source version, owner, readiness, compatibility risk, and fallback.

Content disconnected or detached from canonical system data cannot be implementation-ready. Block the affected scope when a required rule, state, event, table field, or reward contract is missing.

## Observable production estimate

Build estimates from observable production evidence:

- count the content and asset units by complexity class;
- cite measured throughput, comparable completed work, named team capacity, pipeline stages, review/rework rate, and integration dependencies;
- show range, confidence, estimator, date, assumptions, and excluded work;
- add a spike or sample-production validation task when the basis is missing.

Never state a person-day cost as fact from intuition alone. Without team/pipeline evidence, label person-days provisional and do not use them as a committed schedule or capacity claim.

## Adversarial example

**Reject:** “Create 30 quests for 62–93 person-days.” It has no team or pipeline evidence, no canonical system/data IDs, and no explanation of production units, player strategy, telegraph, outcomes, or reward behavior.

**Repair:** Link each quest archetype to its system, rule, event, schema, and reward IDs. Estimate unit counts by complexity using measured pipeline throughput; otherwise mark the range provisional, assign a sample-production task, and block schedule commitment.

## Responsible-design gate record

Record `applicable`, `not-applicable`, `pending`, `blocked`, or `approved`, evidence, and owner for `accessibility`, `scope-control`, and conditional `ugc-safety`, `ai-npc-safety`, and `economy-transparency`. Missing evidence is never approved.
