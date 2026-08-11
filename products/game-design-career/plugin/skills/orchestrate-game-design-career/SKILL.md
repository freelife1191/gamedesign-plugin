---
name: orchestrate-game-design-career
description: Use when a game-design entrant, new graduate, junior, or transitioning designer needs career-stage diagnosis, workflow routing, portfolio or interview review coordination, or current job and employer research.
---

# Orchestrate Game Design Career

## Overview

Diagnose the career decision before selecting specialist work. Route evidence-centered work without promising outcomes, inventing experience, or prescribing one universally correct career.

Users do not need to name a skill or case ID. Read an ordinary natural-language request, infer the career goal and requested result, and choose the smallest evidence-safe route that can produce it.

## Load References

1. Read `../../references/intake.md` to normalize the request and decide whether one material question is required.
2. Read `../../references/career-stages.json` to select the stage, skills, roles, execution mode, and deterministic merge order.
3. Read `../../references/completion-gates.md` before approving a handoff.
4. Read `../../references/routing.json` only when expanding the selected route into its ordered skill chain.

## Orchestrate

1. Capture the intake fields. Record explicit safe assumptions and continue when they do not change the route, audience, evidence standard, or output type.
2. Ask one concise question only when the missing answer materially branches the work. Otherwise expose the assumption in the career-stage brief.
3. Diagnose `entry`, `new-hire`, `junior-growth`, or `transition`. If stage or target role remains unclear, select `unclear`, produce a role map with multiple provisional paths and tradeoffs, and define verification tasks. Do not declare one correct career.
4. Select the smallest ordered skill chain that satisfies the requested output. Apply `apply-document-quality-profile` independently to every canonical artifact before content generation and asset planning. When the selected profile or explicit brief requires imagery, run `plan-image-assets` next; use `generate-image-assets` only for configured provider work and `review-image-assets` only with named-human lifecycle evidence. Preserve each selection record and stable checklist. Select `research-game-design-jobs` before using current employer, project, posting, hiring, tool, or market facts. Load the selected scenario's `asOfDate` from `routing.json`, require the request and result snapshot to match it exactly, and pass only that registry-bound date to job-evidence validation.
5. Select at most three total review roles, including `document-quality-editor` whenever an authored artifact needs its structural quality check. Select no more than two domain roles in that case. For portfolio review, preserve both required roles `portfolio-reviewer` and `evidence-auditor`, then add `document-quality-editor` as the third role. Use the same selected role set and registered questions in parallel and sequential modes.
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
9. After content and domain review, use `polish-game-design-writing` only when a Korean readability pass is requested or useful. It runs the bundled `humanize-korean` skill and protected-content validator as a separate specialist pass, creates a draft and receipt, and waits for a named person. It is outside the three-role review limit and never changes the Canonical Artifact in place.
10. Apply every applicable evidence and responsible-design gate. Missing evidence remains a visible gap and never becomes approval.

## Natural-Language Routing Rules

- Route a clear single-output request directly to its specialist skill.
- Route mixed, multi-stage, or unclear requests through this orchestrator.
- Honor an explicit user-selected skill when it is compatible with the requested result and all safety, rights, evidence, and human-approval boundaries.
- Report the selected skills, selected review roles, artifact paths, and remaining decisions.
- Automatic route selection is not automatic approval. A named person still approves, revises, or holds every applicable result and derivative.

## Optional Archify structural-diagram route

For architecture, workflow, sequence, dataflow, or lifecycle relationships, inspect `capabilities.archify.status` before dispatching visualization. When the status is `available`, use the host Archify lane with a source-backed JSON spec, checked HTML, and receipt as separate evidence; that lane never replaces the packaged asset lane.

Always provide the packaged Skillstead SVG and 2× PNG fallback for Markdown, with its own lint, render, and verification evidence. If the status is `unavailable`, record `archify-unavailable`; if the status is `unknown`, record `archify-unknown`. A nonzero host execution or failed receipt records `archify-failed`. Never label the Skillstead fallback as Archify output, and never auto-approve either asset: each requires its own stated evidence and applicable review.

## Output Contract

Return a Career Stage & Goal Brief as the `career-stage-goal` output containing:

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
