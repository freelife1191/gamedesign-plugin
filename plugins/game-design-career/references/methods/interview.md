# Evidence-grounded game design interview method

Use stable evidence IDs to make interview practice specific without fabricating experience.

## Evidence preflight

Inventory posting records and portfolio claim/evidence records before writing questions. A posting evidence ID identifies one source-addressable requirement or responsibility. A portfolio evidence ID identifies one attributable artifact or verified claim. When a posting is absent, every posting-specific claim is blocked. Record a verification task instead of reconstructing the posting from memory or a job title.

## Question record

| Field | Contract |
| --- | --- |
| `questionId` | Stable identifier reused by answers and feedback. |
| `questionType` | Exactly one of `base`, `follow-up`, `objection`, or `situational`. |
| `postingEvidenceIds` | Stable posting evidence IDs that make the question role-specific; empty only for a labeled role-general question. |
| `portfolioEvidenceIds` | Stable portfolio evidence IDs the candidate may inspect and use. |
| `prompt` | One bounded question that does not presuppose an unsupported result. |
| `verificationStatus` | `grounded`, `role-general`, or `blocked`. |

The complete set contains `base`, `follow-up`, `objection`, and `situational` questions. Keep postingEvidenceIds and portfolioEvidenceIds as independent arrays. A role-general question cannot be relabeled as posting-specific.

## Answer-feedback record

| Field | Contract |
| --- | --- |
| `claim` | Bounded candidate statement with scope and attribution. |
| `evidence` | Stable portfolio evidence IDs, cited posting IDs, or an explicit missing-evidence marker. |
| `choice` | The attributable decision or action the candidate selected. |
| `alternative` | A credible option considered, including why it was not selected. |
| `result` | Verified outcome or `not-verified`; never a projected metric presented as actual. |
| `reflection` | What changed in the candidate's judgment and what they would verify next. |

Feedback connects all six fields and identifies the exact evidence gap. Missing support becomes a verification task or an honest-answer pattern, never invented context.

## Question construction

- `base`: establish the claim, responsibility boundary, and source evidence.
- `follow-up`: inspect the decision chain, constraints, alternative, and implementation handoff.
- `objection`: challenge unsupported certainty, attribution, tradeoffs, or contradictory evidence.
- `situational`: apply an approved posting requirement to a bounded hypothetical without claiming the candidate already achieved it.

## Integrity gate

Never infer team size, revenue, retention, personal ownership, implementation status, or result. Preserve team and individual attribution separately. If an essential posting or portfolio source is unavailable, keep the affected question or claim blocked and assign a verification owner and action.
