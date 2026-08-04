# Five-axis game design portfolio review

Use stable section and evidence IDs so each judgment is reproducible and repairable.

## Five review axes

| Axis ID | Review target |
| --- | --- |
| `problem-framing` | Observed problem, affected user or stakeholder, constraints, and success definition. |
| `design-reasoning` | Evidence, hypothesis, alternatives, tradeoffs, decision, and reflection. |
| `implementation-specificity` | Reproducible rules, states, data, content, handoff, build, and test boundaries. |
| `evidence-quality` | Provenance, attribution, rights, strength, status, and accessible evidence address. |
| `communication-inspectability` | Stable navigation, claim-to-evidence trace, scope clarity, and reviewer independence. |

Review all five axes. Do not substitute artifact count, visual polish, brand recognition, or narrative fluency for evidence.

## Finding types

| Finding type | Contract |
| --- | --- |
| `contradiction` | Two claims or a claim and evidence cannot both be true within the stated scope. |
| `unsupported-certainty` | Wording exceeds the strength, attribution, or status of cited evidence. |
| `duplication` | Repeated material obscures the decision chain or creates inconsistent versions. |
| `unclear-scope` | Author, team, time, build, audience, responsibility, or decision boundary is ambiguous. |
| `missing-sources` | A material claim lacks a locatable evidence address or provenance record. |

Keep these types separate even when one passage produces multiple findings.

## Observation state

| State | Machine-checkable rule |
| --- | --- |
| `not-observed` | The reviewer could not inspect the condition; `evidenceIds` is empty and no defect conclusion is allowed. |
| `no-defect` | The inspected condition did not expose the finding; `evidenceIds` is non-empty and identifies what was checked. |
| `defect-observed` | The cited evidence directly supports a typed finding; `evidenceIds` is non-empty. |

`not-observed` must not be interpreted as `no-defect`. An inaccessible page, missing source, or absent section remains unknown even if no contradiction can be seen.

## Finding record

| Field | Contract |
| --- | --- |
| `findingId` | Stable review identifier. |
| `axisId` | Exactly one approved five-axis ID. |
| `findingType` | One approved finding type, or `none` only for an evidence-backed no-defect record. |
| `observationState` | `not-observed`, `no-defect`, or `defect-observed`. |
| `sectionIds` | Stable portfolio sections inspected for the finding or score. |
| `evidenceIds` | Stable evidence records inspected; empty only for `not-observed`. |
| `score` | Evidence-qualified scale value, or `not-scored` when support is insufficient. |
| `impact` | Reviewer consequence and the decision blocked by the defect. |
| `minimumRepair` | Smallest source, attribution, rewrite, consolidation, or scope change that enables re-evaluation. |

Assign a score only when sectionIds and evidenceIds are both non-empty and the evidence is inspectable. Score evidence completeness separately from demonstrated ability. Do not average `not-scored` as zero.

## Repair priority

Order the queue by highest-impact finding first: blockers to source access and attribution, then contradictions and unsupported certainty, then reasoning or implementation inspectability, then duplication and presentation. Each priority includes one minimumRepair, its owner, and the evidence needed to re-evaluate it.

## Integrity gate

Do not infer team size, revenue, retention, personal ownership, implementation status, or result. Missing support becomes a verification task or an honest-answer pattern. State the limits of the review sample and never generalize beyond inspected sectionIds and evidenceIds.
