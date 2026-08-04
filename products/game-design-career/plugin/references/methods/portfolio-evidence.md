# Portfolio evidence method

Use a portfolio case study to expose game-design competence through attributable decisions and inspectable evidence.

## Exact sequence

Follow this order exactly:

`target competency → problem/user → evidence → hypothesis/intent → rules/UI/data/content → constraints/alternatives → implementation/test → result/decision → retrospective`

Treat the shorthand as ten review checkpoints by checking the problem and affected user separately while keeping them in the single `problem/user` section. Do not reorder later evidence to make the story look cleaner than the record.

## Claim record

Create one record for every present or missing material claim:

| Field | Contract |
| --- | --- |
| `claimId` | Stable identifier used by prose, evidence index, and review findings. |
| `claim` | Bounded statement whose author, scope, and time are explicit. |
| `evidenceAddress` | Section anchor, URL, file/version, test record, image annotation, or `unavailable`. |
| `provenance` | Creator/source, date, project context, personal/team attribution, and rights or quotation note. |
| `strength` | `direct`, `corroborated`, `indirect`, or `none`. |
| `status` | `verified`, `partially-supported`, `unverified`, `contradicted`, or `missing`. |
| `recoveryOwner` | Named person or role responsible for closing the gap. |
| `recoveryAction` | Observable retrieval, test, annotation, reconstruction, or bounded rewrite. |
| `inspectabilityGate` | What a reviewer must be able to locate and verify without author explanation. |

A missing claim stays in the same record with `strength: none`, `status: missing`, an `evidenceAddress`, a `recoveryOwner`, and a `recoveryAction`. Never replace the record with a bare `[정보 없음]` placeholder.

## Evidence by sequence

1. `target competency`: name the reviewer-visible capability and decision standard.
2. `problem/user`: separate the observed problem from the affected player's or stakeholder's need.
3. `evidence`: link baseline behavior, source material, telemetry, playtest notes, constraints, or state that none exists.
4. `hypothesis/intent`: label the proposed causal explanation or intended experience as an inference until tested.
5. `rules/UI/data/content`: expose enough implementation-facing specification to reproduce or critique the design.
6. `constraints/alternatives`: show rejected options, dependencies, rights limits, scope, and tradeoffs.
7. `implementation/test`: attribute the handoff or implementation and preserve protocol, participants, build/version, and deviations.
8. `result/decision`: separate measured result, qualitative feedback, interpretation, and decision.
9. `retrospective`: state what changed, what remains uncertain, and the next falsifiable step.

## Inspectability completion gate

Complete a case only when a reviewer can locate every evidence address, trace provenance, distinguish personal from team contribution, reproduce the reasoning from constraint to alternative to decision, and verify the target competency without asking the author. Visual polish, a polished narrative, or artifact count cannot satisfy this gate.
