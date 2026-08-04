---
name: export-game-design-documents
description: Use when a validated canonical game design artifact must be prepared for Markdown, PDF, DOCX, PPTX, an executive presentation, or a renderer-neutral multi-format delivery package.
---

# Export Game Design Documents

## Overview

Prepare deterministic export jobs without mistaking capability availability or a planned path for a generated and verified document. Canonical validation is the first gate and source preservation is unconditional.

## Triggers

- A canonical game-design artifact needs MD, PDF, DOCX, PPTX, or a multi-format handoff.
- A GDD, system spec, content spec, LiveOps plan, review report, or executive presentation needs format-specific preparation and QA.

## Non-triggers

- Use a design skill when source content is incomplete.
- Use `visualize-game-design` when a diagram must be authored or verified before embedding.
- Do not use this skill to convert arbitrary unstructured notes into an approved design artifact.

## Required input

Collect the canonical artifact directory and version, requested formats, recipe ID, output directory, capability-probe result and evidence, renderer constraints, audience, purpose, presentation story outline, accessibility needs, locale, theme, delivery deadline, and overwrite policy. Existing outputs are owner data and are never replaced implicitly.

## Assumption policy

Preserve missing capability, brief, renderer, output, digest, count, and QA evidence as explicit unknown or unavailable states. This skill is a preparation boundary: it never accepts or emits format-level `passed`, `failed`, renderer, output, digest, count, or QA evidence.

## Workflow

1. Run packaged `scripts/validate-artifact.mjs <artifact-dir> [formats...]`. Stop format work when canonical preflight fails; retain the validator command, exit code, result, artifact version, and source paths.
2. Load `../../references/export-recipes.md`; select one recipe whose source artifact and purpose match. Do not coerce a GDD outline into every artifact type.
3. Run packaged `scripts/capability-probe.mjs`; retain the probe result and evidence independently from generation, renderer, and QA evidence.
4. For PPTX, require audience, purpose, and an independent story outline before preparing a job. Never split Markdown headings into slides as a presentation strategy.
5. Run [prepare-studio-export.mjs](scripts/prepare-studio-export.mjs) with the artifact, recipe, formats, capability snapshot, and safe output directory. Use its renderer-neutral job manifest; do not add a renderer choice until execution.
6. Run [validate-studio-export.mjs](scripts/validate-studio-export.mjs) before handoff. It accepts only `not-requested`, `blocked`, `unavailable`, or `pending` format jobs with `not-run` execution stages, null derivative fields, and empty format evidence. Format-level `passed` or `failed` claims are downstream-only and rejected even when accompanied by plausible files or evidence.
7. Hand the normalized renderer-neutral preparation manifest to a separately trusted renderer-and-QA workflow. That downstream workflow owns generation, actual-file inspection, digests, counts, evidence, and terminal outcomes; it must not feed a terminal manifest back into this preparation validator.
8. Preserve the canonical artifact and all prior owner outputs on unavailable capabilities, failed preflight, or unsafe paths.

## Output contract

Produce `canonical-artifact` with stable sections for preflight, recipe, capability probe, format jobs, renderer evidence, QA status, and artifact preservation.

## Role reviewers

- `production-feasibility-critic`: verify delivery scope, dependencies, capability gaps, ownership, and failure recovery.
- Add `lead-game-designer` for an executive narrative or design-decision handoff.
- Add `ux-accessibility-reviewer` when document accessibility, reading order, alt text, or presentation comprehension is in scope.

## Completion checks

- The preparation manifest never contains format-level `passed` or `failed`; supported requested jobs remain `pending`, missing capabilities are `unavailable`, and failed preflight jobs are `blocked`.
- Every format execution stage remains `not-run`; output path, digest, and page or slide count remain null; format evidence remains empty.
- PPTX requires audience, purpose, and a structured independent story. Every slide has a unique stable `id`, `title`, `message`, and `purpose`; Markdown heading syntax and copied canonical structural headings are prohibited.
- Capability identity is exact: MD is packaged `canonical-markdown`; PDF, DOCX, and PPTX equal the `pdf`, `documents`, and `presentations` probe snapshots.
- Unsafe traversal, symlink, or overwrite conditions fail closed without changing the canonical artifact or existing outputs.
- Failed canonical preflight evidence remains intact at the preflight boundary without being converted into a format-level terminal claim.
