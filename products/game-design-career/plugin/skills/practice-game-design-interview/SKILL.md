---
name: practice-game-design-interview
description: Use when a game designer needs interview questions, answer practice, objection handling, or feedback grounded in a target posting and portfolio evidence.
---

# Practice Game Design Interview

## Overview

Run the interview as an evidence audit. Every posting-specific question and answer claim must remain traceable to stable posting and portfolio evidence IDs.

## Load Reference

Read `../../references/methods/interview.md` before creating questions or evaluating an answer. Use its exact question and feedback records.

## Practice Workflow

1. Inventory the supplied posting and portfolio records. Preserve their stable IDs; do not replace them with prose-only summaries.
2. Create `base`, `follow-up`, `objection`, and `situational` questions. Attach the exact posting and portfolio evidence IDs that justify each prompt.
3. If the posting is absent, keep every posting-specific claim blocked. Ask a role-general question only when it is labeled as such; create a verification task to obtain the posting.
4. Capture the answer as claim, evidence, choice, alternative, result, and reflection. Distinguish observed facts, attributed team outcomes, candidate interpretation, and unknowns.
5. Give feedback against the linked evidence. For a missing result or ownership boundary, provide an honest-answer pattern such as “I cannot verify X; my attributable decision was Y, supported by E-12.”
6. End with evidence gaps, verification tasks, and the next question set. Never turn an unsupported statement into a polished certainty.

## Integrity Boundary

Do not invent team size, revenue, retention, personal ownership, implementation status, or result. Do not assume a team result is the candidate's result. A missing fact becomes a verification task or honest-answer pattern.

## Output Contract

Return the `interview-question-answer-log` output with the evidence inventory, ordered question records, answer-feedback records, blocked claims, verification tasks, and honest-answer patterns. Keep stable evidence IDs visible in every posting-specific finding.

## Completion

Finish only when all four question types exist, every posting-specific claim has posting evidence, every answer claim has portfolio evidence or an explicit gap, and no blocked claim is presented as fact.
