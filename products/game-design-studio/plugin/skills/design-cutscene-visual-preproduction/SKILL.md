---
name: design-cutscene-visual-preproduction
description: "Use when a Studio request needs 컷씬 or 시네마틱 visual preproduction: storyboard shots, master-image prompts, or cutscene continuity."
---

# Design Cutscene Visual Preproduction

Create the complete cutscene package before any paid image work. Keep the planner, cost estimator, live host-user approval, provider dispatch, and continuity review as separate authorities.

## Prepare the package

1. Read the content specification and collect the cutscene brief, beats, shots, game-state return, continuity constraints, visual references, requested variants, model, quality, size, and a finite USD cap.
2. Run `plan-cutscene-visual-preproduction.mjs` to produce the brief, beat sheet, shot list, continuity bible, master-reference plan, prompt package, immutable manifest, and generation guide. Keep stable IDs, DAG bindings, prompt lineage, and expected relative paths intact.
3. Use `apply-document-quality-profile` with `cutscene-visual-preproduction`; report its structural checklist separately from image approval.

## Choose provider and paid quality conservatively

For frames without Korean on-image text, try the available host `image_gen` capability first. An API key does not authorize paid generation. If the host result is unavailable, repeatedly fails, or is unsatisfactory, preserve the draft and propose `gpt-image-2` with a fresh cost estimate and named live approval; never auto-fallback to a paid call.

If Korean characters must be rendered inside the image, use `gpt-image-2` through the explicit OpenAI route. Keep dialogue/subtitles outside generated pixels when a composited text layer is acceptable. For paid generation, `low` is the default for most frames and variants. Use `medium` selectively for `style-master`, another approved master/key image, or an explicit high-fidelity need. Recommend `high` only as an exceptional choice for a justified video hero frame or production concept art, with its incremental cost disclosed and approved.

## Select one mode

### Prompt Only

Complete the brief, beats, shots, continuity bible, master plan, prompt package, expected output paths, and generation guide. Make provider calls: 0 and report USD 0. Do not invent reference hashes or advance an approval state.

### Estimate Only

Complete the same package and run `estimate-cutscene-image-cost.mjs` for the current wave. Disclose the exact asset IDs/count, provider/model/quality/size, reference assumptions, USD minimum, expected, maximum, finite cap, retry reserve, price source/time, and `costStatus`. Keep provider calls: 0. An unavailable costStatus or missing finite ceiling blocks generation.

### Generate After Approval

Generate only after the current exact wave discloses count, quality, size, USD minimum/expected/maximum, cap, and costStatus, then receives named live host-user approval. Keep the wave at `approval-pending` until that approval arrives; previous or general approval does not carry. Invoke `run-approved-cutscene-image-stage.mjs` only with its current wave approval; never call a provider automatically or treat host subscription cost as free.

## Execute waves serially

Run `style-master`, `reference-masters`, `keyframes`, then `storyboard`. For every wave, rebind the current prompt, references, and output request identity; make a per-wave estimate and obtain per-wave approval before dispatch. Stop the next wave when the predecessor lacks current approval or completion.

Preserve partial success, bytes, states, and receipts. Retry only the latest retryable failed stable IDs with the same still-current full-wave estimate, pricing snapshot, and request schedule; never create a subset estimate. If a prior receipt is stale, obtain fresh named live host-user approval bound to that same current estimate, then show the remaining approved worst-case and remaining retryReserve as the current cost status. If the estimate, pricing, or request schedule drifted or expired, fail closed with provider calls: 0: a new journal epoch or replan is unsupported by the current runtime, so do not promise a retry. Do not retry terminal failures or overwrite successful assets. Pass the continuity gate with `review-cutscene-continuity.mjs` before declaring `document-approved` or `production-candidate`; generation alone is neither state.

## Handle variants and handoffs

Keep a dialogue-only variant as an overlay: make no image, no provider, and no approval change. For visual changes, create new derivative IDs, use planner → estimate → approval, and never overwrite base assets.

Hand the immutable cutscene manifest to `plan-image-assets` only through `validateCutsceneManifestHandoff({manifest})`; it validates and hands off without replanning. Hand current-wave approved dispatch to `generate-image-assets` and continuity findings to `review-image-assets`; neither replaces the live host-user approval authority or offers a legacy bypass.
