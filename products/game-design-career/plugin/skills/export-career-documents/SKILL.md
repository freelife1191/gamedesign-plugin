---
name: export-career-documents
description: Use when a game-design career artifact, portfolio, review, or interview report needs MD, PDF, DOCX, or PPTX export.
---

# Export Career Documents

## Overview

Treat export requests as jobs, not successful files. This skill prepares non-terminal jobs only. Preserve the canonical artifact and fail closed until trusted downstream document, PDF, or presentation workflows generate and verify each derivative.

## Load Contracts

Read `../../references/export-recipes.md` before preparing a job. Read the installed shared canonical-artifact schema and the MD, PDF, DOCX, and PPTX QA contracts for the requested formats.

## Workflow

1. Identify the document type, audience, purpose, requested formats, artifact root, and canonical artifact ID.
2. Validate the canonical artifact before any derivative preparation. Stop on a failed, pending, or unevidenced canonical validation.
3. Probe renderer capability separately for each requested format. Keep `unknown`, `available`, and `unavailable` distinct.
4. For PPTX, author an audience-specific independent story outline with a message per slide. Do not split Markdown headings into slides.
5. Create the renderer-neutral non-terminal job manifest and run `node scripts/prepare-career-export.mjs input.json output.json` from this skill directory, or invoke the installed equivalent path.
6. Hand the prepared job to a trusted downstream document, PDF, or presentation workflow. The preparation script never accepts or emits format status `passed` or `failed`, generation evidence, QA evidence, or derivative file claims.
7. Only that downstream workflow may generate a derivative, run the format QA contract, and promote the format to a terminal result.

## State Rules

- Keep `requested` false exactly when status is `not-requested`; every other status is requested.
- Keep `unknown` with no evidence for `blocked`, or for `pending` before a probe.
- Keep `available` only with one passed probe and status `pending`.
- Set `unavailable` only with one failed probe and no generation or QA.
- Reject all preparation-time `passed` and `failed` statuses and all generation or QA evidence, even when a derivative file looks structurally valid.

Unknown capability is not unavailable capability. A requested format is not a generated format. A generated file is not a verified file.

## Format Boundary

- MD: verify canonical frontmatter, one H1, stable heading IDs, NFC, and relative assets with alt text.
- PDF: compare extracted semantics and render every page for visual inspection.
- DOCX: validate OOXML relationships, compare extracted semantics, and render every page for visual inspection.
- PPTX: require audience, purpose, and a nonempty independent story outline; check every slide for overflow and render every slide for visual inspection.

## Output Contract

Return the prepared job manifest, per-format non-terminal `availability`, `status`, capability-probe evidence, and resumable next actions. Do not return generated file paths or terminal verification claims, and do not overwrite the canonical artifact.

## Completion

Finish preparation only when canonical validation passed and each requested format is `blocked`, `pending`, or probe-evidenced `unavailable`. Terminal success or failure belongs exclusively to trusted downstream generation and verification workflows.
