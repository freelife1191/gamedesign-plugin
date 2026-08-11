---
name: orchestrate-game-design-project
description: Use when a game-design request spans multiple disciplines, has ambiguous scope, needs a project brief or roadmap, or requires launch-readiness coordination.
---

# Orchestrate a Game Design Project

## Overview

Turn mixed or ambiguous game-design intent into a bounded Canonical Artifact. Route only established intent, preserve assumptions and blockers, and finish with evidence-backed completion gates.

Users do not need to name a skill or case ID. Read an ordinary natural-language request, infer the goal and requested result, and choose the smallest safe route that can produce it.

## Workflow

1. Read [intake.md](references/intake.md). Capture the brief, record safe assumptions, and ask only questions that can materially change the result.
2. Read [workflow.md](references/workflow.md). Select exact domain routes, artifacts, profiles, and no more than three relevant review roles.
3. Apply `apply-document-quality-profile` independently to every canonical artifact before content generation and asset planning. Preserve its selection record and stable checklist.
4. When the selected profile or explicit brief requires imagery, run `plan-image-assets` after profile selection and before any generation. Keep image planning, generation, and approval separate: `generate-image-assets` routes only configured provider work, and `review-image-assets` requires a named human decision before any lifecycle transition.
5. Create or update the Canonical Artifact. Keep `content.md` authoritative and link evidence, decisions, reviews, and assets instead of scattering conclusions across chat.
6. Dispatch independent review envelopes when subagents exist. Otherwise execute the identical envelope list sequentially in declared role priority.
7. Merge findings deterministically. Preserve disagreements as decision items; never let completion timing determine order or resolution.
8. After content and domain review, use `polish-game-design-writing` only when a Korean readability pass is requested or useful. It runs the bundled `humanize-korean` skill and protected-content validator as a separate specialist pass, creates a draft and receipt, and waits for a named person. It is outside the three-role review limit and never changes the Canonical Artifact in place.
9. Read [completion-gates.md](references/completion-gates.md). Apply document-quality, domain, responsible-design, Canonical Artifact, visualization, image approval, and requested-format gates before claiming completion.

## Optional Archify structural-diagram route

For component boundaries, workflow, sequence, dataflow, or lifecycle relationships, use the packaged `$archify` skill with a source-backed JSON specification. Preserve its checked HTML and receipt as separate evidence; an architecture diagram never replaces the Canonical Artifact or grants approval.

Use the packaged `$svg-infographic` skill for document-friendly static flows, comparisons, and 2× PNG fallback. Keep Archify HTML and Skillstead SVG/PNG receipts distinct, and never auto-approve either diagram.

## Operating Rules

- Route a clear single-domain request directly to its specialist skill.
- Route mixed, cross-domain, or unclear requests through this orchestrator.
- Honor an explicit user-selected skill when it is compatible with the requested result and all safety, rights, evidence, and human-approval boundaries.
- Keep unknown or ambiguous intent in this orchestrator; never guess a specialist.
- Treat profiles as additional questions and gates, not permission to invent facts.
- Select one to three roles for distinct review questions. Apply a route's conditional reviewers only when the normalized intent is listed in that condition's `triggerIntents`; deduplicate the final reviewer set and do not add a role merely to fill the limit.
- Preserve the canonical Markdown artifact when optional review, visualization, export, or host capabilities are absent.
- Report the selected skills, selected review roles, artifact paths, and remaining decisions. Also report assumptions, unresolved questions, blocked gates, requested format status, and the next decision owner.
- Automatic route selection is not automatic approval. A named human still approves, revises, or holds every applicable result and derivative.

## Completion Signal

Stop only when the requested scope satisfies its completion criteria and every applicable gate is `approved` or visibly `blocked`. Never translate missing evidence, unavailable tooling, or an unresolved human decision into approval.
