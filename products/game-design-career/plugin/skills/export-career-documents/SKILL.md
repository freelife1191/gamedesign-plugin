---
name: export-career-documents
description: Use when a game-design career artifact, learning plan, portfolio, reverse-design study, review, interview report, or transition report needs MD, PDF, DOCX, or PPTX preparation and verification.
---

# Export Career Documents

## Overview

Treat export requests as jobs, not successful files. Preserve the canonical artifact and fail closed until each derivative has generation and format-appropriate QA evidence.

## Load Contracts

Read `../../references/export-recipes.md` before preparing a job. Read the installed shared canonical-artifact schema and the MD, PDF, DOCX, and PPTX QA contracts for the requested formats.

## Workflow

1. Identify the document type, audience, purpose, requested formats, artifact root, and canonical artifact ID.
2. Validate the canonical artifact before any derivative preparation. Stop on a failed, pending, or unevidenced canonical validation.
3. Probe renderer capability separately for each requested format. Keep `unknown`, `available`, and `unavailable` distinct.
4. For PPTX, author an audience-specific independent story outline with a message per slide. Do not split Markdown headings into slides.
5. Create the renderer-neutral job manifest and run `node scripts/prepare-career-export.mjs input.json output.json` from this skill directory, or invoke the installed equivalent path.
6. Generate with an available renderer, then run the format's QA contract. Record exact command, file, result, and verification evidence.
7. Set `passed` only after the requested file exists and both generation and format-appropriate QA passed.

## State Rules

- `availability: unknown`: no capability probe has run. Do not convert it to unavailable or passed.
- `availability: available`: a recorded probe passed; generation may proceed.
- `availability: unavailable`: a recorded probe failed or proved the renderer absent. Preserve the probe evidence.
- `status: pending`: preparation or verification remains unfinished.
- `status: blocked`: a prerequisite such as canonical validation, capability, or PPTX brief is missing.
- `status: passed`: capability, generation, file, and QA evidence all passed.
- `status: failed`: generation or QA ran and reported a defect.
- `status: unavailable`: capability was probed and proved unavailable.

Unknown capability is not unavailable capability. A requested format is not a generated format. A generated file is not a verified file.

## Format Boundary

- MD: verify canonical frontmatter, one H1, stable heading IDs, NFC, and relative assets with alt text.
- PDF: compare extracted semantics and render every page for visual inspection.
- DOCX: validate OOXML relationships, compare extracted semantics, and render every page for visual inspection.
- PPTX: require audience, purpose, and a nonempty independent story outline; check every slide for overflow and render every slide for visual inspection.

## Output Contract

Return the prepared job manifest, per-format `availability`, `status`, and `evidence`, generated file paths, exact verification commands, failures, and resumable next actions. Do not overwrite the canonical artifact.

## Completion

Finish only when canonical validation passed and each requested format is honestly `passed`, `failed`, or probe-evidenced `unavailable`. Otherwise keep it pending or blocked.
