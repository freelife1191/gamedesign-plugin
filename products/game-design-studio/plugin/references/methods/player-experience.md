# Player Experience Method

## Output schema

| Field | Required content |
| --- | --- |
| Information priority | Now, next, and on-demand information mapped to player decisions |
| Interaction and UI states | Entry, focus, enabled, disabled, loading, success, error, recovery, and exit states |
| First five minutes | Observable sequence from launch through the first meaningful choice |
| First success | Action, feedback, reward, understanding check, and continuation |
| Tutorial skip and revisit | Skip effect, safe defaults, contextual reminder, replay path, and persistence |
| Input | Critical actions, mappings, remapping, hold/toggle choice, alternatives, and conflicts |
| Performance | Measured latency, frame pacing, loading, readability impact, target status, and owner |
| Cross-platform | Platform, screen, safe area, input, session, account, and entitlement differences |
| Accessibility | Modalities, alternatives, critical-task test results, limitations, and owner |

## Experience validation policy

An onboarding percentage, response time, device target, accessibility threshold, or platform threshold is a proposal until measured or supported by current authoritative evidence. If a critical action lacks an accessible alternative, the affected release scope is No-Go and blocked. Validate task success with affected players and record observation separately from interpretation.

## Estimate and claim policy

For every quantitative or approval-relevant claim, record `source`, `assumption`, `confidence`, `owner`, and `validation gate`. Unsupported claims remain provisional or blocked. Invented onboarding rates, timing targets, device limits, and success metrics presented as approved facts are forbidden.

## Current evidence routing

For platform policy, monetization, regulation, AI rights, and accessibility claims, read [2026-current-practices.md](../../../../../shared/knowledge/trends/2026-current-practices.md) and resolve its sources through [source-register.json](../../../../../shared/knowledge/trends/source-register.json). Create an evidence entry with `claimId`, `sourceIds`, `verifiedAt`, `reviewAfter`, `regionScope`, and `limitations`. When `reviewAfter` has expired, keep the claim pending or blocked until current primary evidence is reverified. Treat legal or regulatory material as a specialist review trigger, not a compliance verdict.

## Hard No-Go conditions

| Blocker ID | Blocking condition |
| --- | --- |
| inaccessible-critical-action | A critical path has no usable alternative modality, input, feedback, or recovery |
| unverified-current-accessibility | A current accessibility or platform threshold lacks fresh authoritative evidence and task testing |

## Responsible-design gates

Read [gates.json](../../../../../shared/responsible-design/gates.json) as authority. For `ai-rights-human-approval`, `accessibility`, `economy-transparency`, `liveops-experiment`, `ugc-safety`, `ai-npc-safety`, and `scope-control`, ask `applicability_questions`, collect `evidence_fields`, and retain the named approver. When applicable, initialize pending; otherwise record not applicable. Advance lifecycle only through `not-applicable`, `pending`, `blocked`, or `approved`. Missing evidence is never approved.

## Adversarial example

**Reject:** “Approve 95% tutorial completion, 100 ms response, and current platform accessibility compliance.” No research, build measurement, device evidence, standard version, affected-player test, or accountable owner exists.

**Repair:** Leave values provisional, trace each critical action and state, link current primary platform/accessibility claims, appoint owners, define task-based validation, and keep release blocked until the hard No-Go conditions clear.
