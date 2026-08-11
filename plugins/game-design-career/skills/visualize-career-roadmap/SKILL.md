---
name: visualize-career-roadmap
description: Use when game-design roles, competencies, learning dependencies, portfolio structure, development processes, or career growth paths need a spatial explanation or an accessible SVG/PNG diagram.
---

# Visualize Career Roadmap

## Overview

Make relationships inspectable without turning assumptions into facts. Use a diagram only when hierarchy, dependency, sequence, or mapping is materially clearer than prose.

## Load Contracts

Read `../../references/visualization-presets.json` before selecting a diagram. Read the packaged `skills/svg-infographic/SKILL.md` and its required references before authoring SVG; invoke its immutable lint and canonical render implementations only through the product-owned `scripts/run-skillstead.mjs` wrapper without copying or replacing them.

## Select the Representation

1. Identify the audience, decision, source artifact, language, and output ratio.
2. Compare the source relationship with every preset's `relationship`, `selectionQuestion`, and `exclusionCondition`.
3. Emit `selectedPresetId`, `selectionRationale`, and `excludedPresets`. Each exclusion contains the preset ID and a concrete reason. Use `selectedPresetId: null` when prose or a table is clearer.
4. Route bar, line, scatter, heatmap, percentage, score, duration, or other quantitative statistics to a data-accurate chart workflow. Do not represent evidence-free statistics as an infographic.

## Evidence Boundary

For every number or statistical claim, record `source`, `baseline`, `owner`, and `validation`. Leave the value unset when any field is absent. Label a proposed duration or score provisional and do not personalize it until its source and baseline are known.

Do not infer role prevalence, hiring probability, competency level, progress percentage, schedule, or outcome from layout, area, color, or position. Qualitative ordering must say what evidence supports it.

## Optional Archify structural-diagram route

For architecture, workflow, sequence, dataflow, or lifecycle relationships, use the packaged `$archify` skill with a source-backed JSON spec, checked HTML, and receipt as separate evidence. This does not replace the packaged static asset lane or grant approval.

Use packaged `$svg-infographic` for Markdown-friendly SVG and 2× PNG output. Keep Archify HTML and Skillstead receipts distinct, and never auto-approve either diagram.

## Produce and Verify

Track these states independently:

| State | Meaning and required evidence |
| --- | --- |
| `requested` | The output was requested; no artifact exists yet. |
| `planned` | A preset, rationale, dimensions, and output path are recorded. |
| `generated` | The editable SVG file exists and its file path is recorded. |
| `linted` | The packaged SVG lint command, file, exit result, and warning disposition are recorded. |
| `rendered` | The packaged Chromium render command, SVG file, PNG file, browser identity, and exit result are recorded. |
| `verified` | Accessible alt text, visual QA, and exact 2× PNG dimensions are recorded. |

Never advance a state from intention. A command without its file and result is not evidence.

1. Delegate structural SVG authoring to packaged `skills/svg-infographic`.
2. Require canonical valid UTF-8 and the XML 1.0 Fifth Edition `Char` production before parsing structure: allow only `#x9`, `#xA`, `#xD`, `#x20-#xD7FF`, `#xE000-#xFFFD`, and `#x10000-#x10FFFF`; reject replacement decoding, NUL, forbidden C0 controls, surrogate encodings, `U+FFFE`, and `U+FFFF` while preserving valid Korean, C1, `U+FDD0`, and supplementary-plane characters. Reject every actual `<script>` or `<style>` element anywhere, including case and namespace local-name variants, before reading its contents; do not treat active-element text as raw XML. Inline presentation and `style` attributes remain subject to structural attribute checks and the packaged SVG lint. Then require exactly one non-empty `<title>` and one non-empty `<desc>` as direct children of the root `<svg>`. Bind `<title>` and root `aria-label` exactly to the user-facing alt text. Comments, CDATA, processing instructions, attributes, script/style text, escaped markup, nested elements, DTDs, and entities never satisfy this contract.
3. Run the packaged SVG lint. Preserve warnings and their disposition.
4. When Chromium is available, use the packaged renderer and verify exact 2× PNG dimensions plus visual quality.
5. When browser rendering is unavailable, preserve the linted editable SVG, set PNG availability to `unavailable`, and keep `rendered` and `verified` false. Do not claim PNG success.
6. Import `scripts/validate-visualization-state.mjs` and invoke its exported `validateVisualizationState` function before reporting artifact states.

## Output Contract

Return the selection record, quantitative-claim evidence records, SVG/PNG state record, artifact paths, exact commands and results, alt text, unresolved warnings, and a resumable next action. A planned fallback is not a generated artifact.

## Completion

Finish only when selection and exclusions are machine-checkable, every quantitative claim is sourced or unset, and every reported artifact state has command-and-file evidence.
