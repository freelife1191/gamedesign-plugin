---
name: orchestrate-game-design-project
description: Use when a game-design request spans multiple disciplines, has ambiguous scope, needs a project brief or roadmap, or requires launch-readiness coordination.
---

# Orchestrate a Game Design Project

## Overview

Turn mixed or ambiguous game-design intent into a bounded Canonical Artifact. Route only established intent, preserve assumptions and blockers, and finish with evidence-backed completion gates.

## Workflow

1. Read [intake.md](references/intake.md). Capture the brief, record safe assumptions, and ask only questions that can materially change the result.
2. Read [workflow.md](references/workflow.md). Select exact domain routes, artifacts, profiles, and no more than three relevant review roles.
3. Create or update the Canonical Artifact. Keep `content.md` authoritative and link evidence, decisions, reviews, and assets instead of scattering conclusions across chat.
4. Dispatch independent review envelopes when subagents exist. Otherwise execute the identical envelope list sequentially in declared role priority.
5. Merge findings deterministically. Preserve disagreements as decision items; never let completion timing determine order or resolution.
6. Read [completion-gates.md](references/completion-gates.md). Apply domain, responsible-design, Canonical Artifact, visualization, and requested-format gates before claiming completion.

## Operating Rules

- Route a direct single-domain request to its declared specialist skill.
- Keep unknown or ambiguous intent in this orchestrator; never guess a specialist.
- Treat profiles as additional questions and gates, not permission to invent facts.
- Select one to three roles for distinct review questions. Do not add a role merely to fill the limit.
- Preserve the canonical Markdown artifact when optional review, visualization, export, or host capabilities are absent.
- Report assumptions, unresolved questions, blocked gates, selected routes and roles, artifact paths, requested format status, and the next decision owner.

## Completion Signal

Stop only when the requested scope satisfies its completion criteria and every applicable gate is `approved` or visibly `blocked`. Never translate missing evidence, unavailable tooling, or an unresolved human decision into approval.
