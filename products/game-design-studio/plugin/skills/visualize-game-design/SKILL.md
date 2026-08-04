---
name: visualize-game-design
description: Use when a validated game design artifact contains loops, state transitions, progression, value flows, timelines, dependencies, roles, or other spatial structure that may be clearer as an accessible diagram.
---

# Visualize Game Design

## Overview

Create a diagram only when its spatial encoding clarifies a source-backed relationship. Treat the packaged Skillstead SVG as the editable authority and distinguish every requested, generated, linted, rendered, and verified state.

## Triggers

- A canonical artifact contains loops, rule flow, progression, sources and sinks, a roadmap, or role/dependency structure.
- A document or presentation needs an accessible SVG and verified 2× PNG asset.

## Non-triggers

- Keep prose when ordering, grouping, or spatial relationships add no material understanding.
- Use a chart capability for data-accurate statistical charts.
- Do not use this skill for character art, marketing illustration, mascots, or logos.

## Required input

Collect the validated canonical artifact path and version, source stable section IDs, relationship to clarify, audience, visual intent, language, aspect ratio, output directory, requested assets, and acceptance criteria. Record whether the request is brief-first, source-first, or research-first.

## Assumption policy

Never invent a node, edge, statistic, loop, state, sequence, date, or role and present it as artifact evidence. An illustrative placeholder must be labeled `illustrative` and `non-canonical`, excluded from source mapping, and prohibited from verified completion.

## Diagram decision

Proceed only when spatial structure materially improves understanding over concise prose. Record the relationship, source stable sections, selected preset, rejected alternatives, and the reason a diagram earns its place. Otherwise return `diagram-not-warranted` and preserve the artifact.

## Source integrity

Map every generated node, connector, label, date, and numeric annotation to a source locator. Keep illustrative placeholders explicitly non-canonical; never allow illustrative placeholders to become source-derived content through layout, captions, or export.

## Workflow

1. Load `../../references/visualization-presets.json` and select exactly one suitable preset.
2. Load the packaged `skills/svg-infographic/SKILL.md`, then its required archetype and authoring references. Follow its preflight, numeric layout, SVG authoring, lint, render, and two-pass visual QA contract.
3. Write editable SVG into the canonical artifact `assets/` directory with nonempty `<title>`, `<desc>`, stable source mapping, and adjacent alt text.
4. Run the preset's product-owned `run-skillstead.mjs lint` wrapper and retain command, exit code, stdout/stderr, exact linter identity/digest, input path, and source digest. The wrapper resolves the vendored CLI by canonical realpath; never invoke the vendored CLI path directly. `generated` is not `linted`.
5. Run `run-skillstead.mjs render` at 2×. Retain renderer executable/version and vendored renderer digest, command, exit code, SVG and PNG paths/digests, viewBox, actual PNG dimensions, and render log. `rendered` is not `verified`.
6. Inspect fit-to-page and close-up pixels. Record text, CJK, containment, connector, contrast, reading-order, source-fidelity, and alt-text results before marking verified.
7. Run [validate-visualization-evidence.mjs](scripts/validate-visualization-evidence.mjs) against the evidence record and artifact root. It independently executes the canonical-realpath vendored linter and validates one of the six packaged preset IDs, stable unique source IDs, SVG `<title>`/`<desc>`, ordered predecessors, exact runtime identities/digests, same-file paths and digests, renderer name/version, exact QA checks, and a CRC-valid complete PNG whose IEND is exactly at EOF and dimensions are actual 2×.
8. Index only proven assets. On any failure, keep the canonical artifact and source SVG, record the exact fallback state, and never claim a successful PNG.

## Output contract

Produce `canonical-artifact` with stable sections for diagram decision, source mapping, preset, accessibility, execution evidence, asset index, and fallback status.

## Role reviewers

- `lead-game-designer`: verify that the visual emphasizes the intended decision and preserves game-design meaning.
- Add `ux-accessibility-reviewer` only when comprehension, modality, color, input, or critical-path accessibility is in scope.
- Add at most one domain reviewer when system, economy, content, LiveOps, or production semantics need verification.

## Completion checks

- Track `requested`, `generated`, `linted`, `rendered`, and `verified` as separate evidence states; never infer one from another.
- Never mark linted, rendered, or verified without the actual command and file evidence, including exit status, paths, digests, and dimensions where applicable.
- Require alt text, SVG `<title>`/`<desc>`, source mapping, successful packaged SVG lint, exact 2× PNG dimensions, renderer identity, and two-pass visual QA for verified SVG+PNG completion.
- A missing browser, failed lint, failed render, or failed pixel review records its precise fallback and preserves the canonical artifact.
- A failed PNG render preserves the passed, linted SVG and its source/alt-text evidence, records rendering as `failed`, and records PNG verification as `unavailable` without PNG success evidence.
