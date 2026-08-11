# Economy and LiveOps Method

## Output schema

| Field | Required content |
| --- | --- |
| Sources | Currency or item, amount, trigger, cadence, cohort, cap, provenance, and owner |
| Sinks | Cost, purpose, trigger, cadence, eligibility, refund behavior, and owner |
| Target inventory | Cohort and timepoint target with observed baseline and acceptable range |
| Progression time | Goal, player segment, measured path, variance, friction, and validation status |
| Inflation | Supply-demand indicators, concentration, velocity, thresholds, response, and owner |
| Real price | Regional money conversion, tax/fee context, display, expiry, refund, and evidence |
| Probability | Exact odds, pool, eligibility, disclosure surface, version, and evidence |
| Pity | Counter scope, reset, carryover, guarantee, disclosure, and edge cases |
| Hypothesis | Causal statement, target population, expected change, and falsifier |
| Control | Eligibility, allocation, contamination protections, and baseline |
| Single variable | Precisely isolated treatment and conflicting experiment check |
| Sample | Unit, power or precision basis, exclusions, and representativeness limits |
| Duration | Start, stop, seasonality, ramp, observation window, and rationale |
| Success metrics | Primary outcome, baseline, direction, threshold status, and owner |
| Guardrail metrics | Harm, spend, access, reliability, support, fairness, and privacy signals |
| Stop criteria | Automatic and human stop triggers, monitoring cadence, and authority |
| Rollback plan | Tested mechanism, recovery time, data repair, player remedy, and owner |

## Economy and experiment approval policy

A price ladder, draw probability, pity rule, sample size, legal policy, rollback plan, or guardrail metric cannot be fabricated to complete an approval packet. Missing real price, probability, rollback, or guardrail evidence is a hard No-Go and blocked. AI or UGC without documented rights or consent is a hard No-Go and blocked. Never use revenue alone as the success signal; protect access, comprehension, vulnerable players, service health, support burden, fairness, and privacy.

## Estimate and claim policy

For every quantitative or approval-relevant claim, record `source`, `assumption`, `confidence`, `owner`, and `validation gate`. Unsupported prices, odds, pity counters, sample sizes, durations, thresholds, and forecasts remain provisional or blocked. Invented commercial or experimental values presented as approved facts are forbidden.

## Current evidence routing

For platform policy, monetization, regulation, AI rights, and accessibility claims, read [2026-current-practices.md](../../../../../shared/knowledge/trends/2026-current-practices.md) and resolve its sources through [source-register.json](../../../../../shared/knowledge/trends/source-register.json). Create an evidence entry with `claimId`, `sourceIds`, `verifiedAt`, `reviewAfter`, `regionScope`, and `limitations`. When `reviewAfter` has expired, keep the claim pending or blocked until current primary evidence is reverified. Platform and regulatory evidence triggers region-specific product/legal review; it does not prove compliance.

## Hard No-Go conditions

| Blocker ID | Blocking condition |
| --- | --- |
| missing-real-price | Paid value or multi-step currency conversion lacks a verified real-money price and disclosure path |
| missing-probability | Randomized reward odds, pool, eligibility, or material consequences are unknown or undisclosed |
| missing-rollback | The changed configuration, state, data, or player remedy cannot be restored through a tested plan |
| unsafe-liveops-experiment | Hypothesis, control, isolated variable, guardrails, treatment boundary, stop authority, or owner is missing |
| missing-ai-ugc-rights-consent | AI or UGC lacks provenance, rights or consent, required human approval, moderation, or appeal evidence |

## Responsible-design gates

Read [gates.json](../../../../../shared/responsible-design/gates.json) as authority. For `ai-rights-human-approval`, `accessibility`, `economy-transparency`, `liveops-experiment`, `ugc-safety`, `ai-npc-safety`, and `scope-control`, ask `applicability_questions`, collect `evidence_fields`, and retain the named approver. When applicable, initialize pending; otherwise record not applicable. Advance lifecycle only through `not-applicable`, `pending`, `blocked`, or `approved`. Missing evidence is never approved.

## Adversarial example

**Reject:** “Ship a five-tier shop and 1% draw with 80-pull pity; test on 10,000 users for two weeks and roll back manually if legal asks.” The request supplies none of those values, no regional evidence, no protection metrics, and no tested recovery.

**Repair:** Leave commercial and statistical values unset, model evidence-backed sources and sinks, obtain region-specific real-price and odds evidence, define a single-variable experiment with guardrails and stop authority, test rollback, and keep affected gates blocked until accountable humans approve.
