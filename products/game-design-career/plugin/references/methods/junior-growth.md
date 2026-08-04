# Evidence-bound junior game designer growth method

Use current target-role requirements to select observable work, then use project events and feedback to produce inspectable evidence.

## Target requirement register

Each approved target-role requirement has a stable `requirementId`, current primary posting evidence IDs, retrieval date, target depth or breadth, and approval owner. A desired competency without current posting support is a provisional requirement and cannot be reported as a market requirement.

## Requirement status

| Status | Contract |
| --- | --- |
| `approved` | The requirement is backed by current target-role source evidence and an approval owner. |
| `provisional` | The requirement is a hypothesis awaiting source or stakeholder verification. |

When no approved target-role requirementId exists, create a stable provisional requirementId, set `requirementStatus: provisional`, and assign a verification task. Never leave a goal unbound.

## Project-event evidence

Convert each material project event into evidence rather than a memory-based success story. Record an `eventId`, date, project/build scope, observation, decision or contribution, personal/team attribution, source address, verification status, feedback received, and resulting change. An implementation, result, metric, or ownership claim without a source remains unverified.

## Quarterly goal record

| Field | Contract |
| --- | --- |
| `goalId` | Stable quarterly goal identifier. |
| `requirementId` | Stable approved or provisional target-role requirement identifier. |
| `requirementStatus` | Exactly `approved` or `provisional`. |
| `observableProject` | Bounded deliverable or decision surface a reviewer can inspect. |
| `owner` | Person responsible for execution and evidence capture. |
| `feedbackCadence` | Recurring review frequency, reviewer, input artifact, and next review date. |
| `proofArtifact` | Stable evidence address for the planned output, decision, test, or feedback record. |
| `reEvaluationDecision` | At review choose `continue`, `revise`, `replace`, `approve-ready`, or `retire`. |

Every quarterly goal must point to an approved target-role requirement or be marked provisional. Every goal includes all eight fields; an activity list without an observable project and proof artifact is not a goal.

## Depth, breadth, and cadence

Use approved requirements to name target depth: complexity, decision autonomy, ambiguity, or implementation specificity. Use separate approved requirements to name breadth across systems, content, UX, economy, analytics, production, or collaboration. Schedule feedback at the cadence required to inspect work in progress, not only at quarter end.

## Re-evaluation

At each cadence date, inspect the proof artifact and project-event evidence. Record what was observed, which requirement remains supported, what changed, and one reEvaluationDecision. If the role evidence changed or the project cannot expose the requirement, revise or replace the goal instead of manufacturing a result.

## Integrity gate

Do not infer team size, revenue, retention, personal ownership, implementation status, or result. Convert missing support into a verification task or an honest-answer pattern. Readiness remains provisional until required evidence is inspectable and reviewed.
