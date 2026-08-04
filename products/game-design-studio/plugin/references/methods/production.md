# Production Planning Method

## Output schema

| Field | Required content |
| --- | --- |
| Core-loop contribution | Scope item, player action, target-experience link, expected learning, and non-goal |
| Effort | Observable units, disciplines, throughput evidence, range, assumptions, confidence, and owner |
| Dependencies | Upstream, downstream, external, sequencing, availability, fallback, and owner |
| Maintenance burden | Recurring operations, content, support, moderation, data, platform, and deprecation cost |
| Licensing risk | Asset, technology, data, territory, term, restriction, renewal, evidence, and approver |
| Outsource risk | Deliverable, vendor dependency, acceptance, security, rights, rework, handoff, and contingency |
| Prototype hypothesis | Riskiest falsifiable belief, cheapest valid prototype, observation, and decision rule |
| Milestone | Intended maturity, evidence gate, entry criteria, exit criteria, date status, and dependencies |
| Owner | Accountable role, decision authority, review cadence, escalation, and backup |
| Definition of done | Observable behavior, quality evidence, integration, documentation, and accepted limitations |
| Kill criterion | Failure signal, observation window, decision owner, stop action, salvage, and communication |
| MoSCoW scope | Must, Should, Could, Won't item with rationale, dependency, evidence, and approver |

## Commitment policy

A participant count, schedule, person-week, performance target, network target, or success rate cannot become a committed baseline without project evidence. A large commitment without both target experience and prototype evidence is a hard No-Go and blocked. A concept draft is allowed to continue while production approval or commitment remains blocked. Separate reversible learning work from staffing, procurement, licensing, outsourcing, platform, and release obligations.

## Estimate and claim policy

For every quantitative or approval-relevant claim, record `source`, `assumption`, `confidence`, `owner`, and `validation gate`. Build ranges from observable work units, measured throughput, discipline availability, integration/rework allowance, dependencies, and maintenance. Unsupported estimates remain provisional or blocked. Invented schedules, person-weeks, team sizes, targets, and success rates presented as approved or committed facts are forbidden.

## Current evidence routing

For platform policy, monetization, regulation, AI rights, and accessibility claims, read [2026-current-practices.md](../shared/knowledge/trends/2026-current-practices.md) and resolve its sources through [source-register.json](../shared/knowledge/trends/source-register.json). Create an evidence entry with `claimId`, `sourceIds`, `verifiedAt`, `reviewAfter`, `regionScope`, and `limitations`. When `reviewAfter` has expired, keep the claim pending or blocked until current primary evidence is reverified. Market or industry surveys are contextual planning signals, not a project capacity estimate or demand forecast.

## Hard No-Go conditions

| Blocker ID | Blocking condition |
| --- | --- |
| missing-target-experience | A large commitment has no stated, approved, and traceable target experience |
| missing-prototype-evidence | The riskiest player or technology hypothesis has no fit-for-purpose prototype result and decision record |
| unsupported-large-estimate | Staffing, schedule, procurement, outsource, licensing, platform, or release commitment relies on invented or unvalidated estimates |

## Responsible-design gates

Read [gates.json](../shared/responsible-design/gates.json) as authority. For `ai-rights-human-approval`, `accessibility`, `economy-transparency`, `liveops-experiment`, `ugc-safety`, `ai-npc-safety`, and `scope-control`, ask `applicability_questions`, collect `evidence_fields`, and retain the named approver. When applicable, initialize pending; otherwise record not applicable. Advance lifecycle only through `not-applicable`, `pending`, `blocked`, or `approved`. Missing evidence is never approved.

## Adversarial example

**Reject:** “Approve a 24-person, 18-month production for 40 person-weeks of prototyping, 60 fps, 80 ms networking, and 75% test success.” The target experience, team, pipeline, prototype, device, network, and research evidence are absent.

**Repair:** Keep a concept draft, state the missing target experience, isolate the riskiest hypothesis, build the cheapest valid prototype, estimate observable units from measured capacity, assign owners and kill criteria, and keep the large commitment blocked.
