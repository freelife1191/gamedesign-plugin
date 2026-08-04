---
name: orchestrate-game-design-career
description: Use when a game-design entrant, new graduate, junior, or transitioning designer needs career-stage diagnosis, workflow routing, portfolio or interview review coordination, or current job and employer research.
---

# Orchestrate Game Design Career

## Overview

Diagnose the career decision before selecting specialist work. Route evidence-centered work without promising outcomes, inventing experience, or prescribing one universally correct career.

## Load References

1. Read `../../references/intake.md` to normalize the request and decide whether one material question is required.
2. Read `../../references/career-stages.json` to select the stage, skills, roles, execution mode, and deterministic merge order.
3. Read `../../references/completion-gates.md` before approving a handoff.
4. Read `../../references/routing.json` only when expanding the selected route into its ordered skill chain.

## Orchestrate

1. Capture the intake fields. Record explicit safe assumptions and continue when they do not change the route, audience, evidence standard, or output type.
2. Ask one concise question only when the missing answer materially branches the work. Otherwise expose the assumption in the career-stage brief.
3. Diagnose `entry`, `new-hire`, `junior-growth`, or `transition`. If stage or target role remains unclear, select `unclear`, produce a role map with multiple provisional paths and tradeoffs, and define verification tasks. Do not declare one correct career.
4. Select the smallest ordered skill chain that satisfies the requested output. Select `research-game-design-jobs` before using current employer, project, posting, hiring, tool, or market facts.
5. Select at most three roles. For portfolio review, always select `portfolio-reviewer` and `evidence-auditor`.
6. Create one envelope per role using exactly this shape:

```json
{
  "artifact": "artifact-name/content.md",
  "role": "portfolio-reviewer",
  "questions": [],
  "findingsPath": "artifact-name/decisions/review-portfolio-reviewer.md"
}
```

7. In parallel mode, dispatch independent envelopes. In sequential fallback, filter the fixed `rolePriority` to the selected roles and run the same roles with the same `questionsByRole` entries. Do not rewrite or broaden questions between modes.
8. Merge findings by `severity`, `evidence-gap-id`, `artifact-section-id`, then `role-priority`. Preserve conflicting recommendations as explicit decisions.
9. Apply every applicable evidence and responsible-design gate. Missing evidence remains a visible gap and never becomes approval.

## Output Contract

Return a Career Stage & Goal Brief containing:

- normalized intake and explicit assumptions;
- diagnosed stage and rationale;
- provisional paths when stage or target role is unclear;
- selected ordered skill chain and no more than three roles;
- current-research tasks and evidence gaps;
- requested artifact, review envelopes, and completion gates;
- the next concrete action and any single material question.

Preserve a valid canonical artifact when optional review, visualization, or export capability is unavailable. Record the unavailable step and a resumable handoff instead of discarding source work.

## Completion

Finish only when the stage decision is explicit, the route is deterministic, assumptions and evidence gaps are visible, selected reviews use the shared envelope, applicable gates have a recorded state, and the next workflow can start without inventing candidate evidence.
