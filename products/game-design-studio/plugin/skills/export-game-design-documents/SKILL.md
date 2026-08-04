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

Preserve missing capability, brief, renderer, output, digest, count, and QA evidence as explicit unknown or unavailable states. Never label a planned, queued, capability-available, or renderer-returned file `passed` without inspecting the actual output.

## Workflow

1. Run packaged `scripts/validate-artifact.mjs <artifact-dir> [formats...]`. Stop format work when canonical preflight fails; retain the validator command, exit code, result, artifact version, and source paths.
2. Load `../../references/export-recipes.md`; select one recipe whose source artifact and purpose match. Do not coerce a GDD outline into every artifact type.
3. Run packaged `scripts/capability-probe.mjs`; retain the probe result and evidence independently from generation, renderer, and QA evidence.
4. For PPTX, require audience, purpose, and an independent story outline before preparing a job. Never split Markdown headings into slides as a presentation strategy.
5. Run [prepare-studio-export.mjs](scripts/prepare-studio-export.mjs) with the artifact, recipe, formats, capability snapshot, and safe output directory. Use its renderer-neutral job manifest; do not add a renderer choice until execution.
6. Delegate actual PDF, DOCX, and PPTX creation only to detected packaged capabilities. Markdown remains a canonical text export. Keep each format's capability, generation, renderer, output, and QA status separate.
7. Inspect the format using packaged shared QA contracts. Only then attach output path, SHA-256 digest, page/slide count where applicable, validation evidence, limitations, and `passed` status.
8. Run [validate-studio-export.mjs](scripts/validate-studio-export.mjs) before handoff. It enforces exact object keys, terminal status transitions, extension/path/digest identity, actual derivative files, mutually exclusive probe states, and fail-closed normalized output.
9. Preserve the canonical artifact and all prior owner outputs on unavailable capabilities, failed generation, failed QA, or unsafe paths.

## Output contract

Produce `canonical-artifact` with stable sections for preflight, recipe, capability probe, format jobs, renderer evidence, QA status, and artifact preservation.

## Role reviewers

- `production-feasibility-critic`: verify delivery scope, dependencies, capability gaps, ownership, and failure recovery.
- Add `lead-game-designer` for an executive narrative or design-decision handoff.
- Add `ux-accessibility-reviewer` when document accessibility, reading order, alt text, or presentation comprehension is in scope.

## Completion checks

- MD, PDF, DOCX, and PPTX cannot be `passed` until actual generation and format-specific QA complete; capability availability alone is never success.
- Every passed format has an existing output path, SHA-256 digest, page or slide count when applicable, renderer or generator evidence, and QA evidence.
- PPTX requires audience, purpose, and a structured independent story. Every slide has a unique stable `id`, `title`, `message`, and `purpose`; Markdown heading syntax and copied canonical structural headings are prohibited.
- Capability identity is exact: MD is packaged `canonical-markdown`; PDF, DOCX, and PPTX equal the `pdf`, `documents`, and `presentations` probe snapshots.
- Unsafe traversal, symlink, or overwrite conditions fail closed without changing the canonical artifact or existing outputs.
- Failed and unavailable formats remain explicit in the manifest while successful formats retain independent evidence.
