---
name: generate-image-assets
description: Use when a Studio image asset manifest and prompt package need bounded generation routing, stable-ID selection, or an honest unavailable-provider handoff.
---

# Generate Image Assets

## Boundary

Use the existing provider policy; do not recreate it or call an undocumented host endpoint. Generation changes generation state only. It never changes an asset from `concept-draft` and never creates approval evidence.

## Required input

Collect a validated artifact-local `assets/image-assets.yml`, its prompt package, `IMAGE_GEN_MODE`, `IMAGE_PROVIDER`, `IMAGE_EMBEDDED_TEXT_LOCALE`, redacted image configuration, capability snapshot, and—when mode is `select`—the actual user-provided stable asset IDs. Do not accept labels, ordinal positions, guessed IDs, or an agent's implied selection.

## Workflow

1. Run packaged `scripts/run-image-asset-workflow.mjs` through `runConfiguredImageAssetWorkflow({ workspaceRoot, ... })`. It loads private configuration internally and returns only `toPublicImageConfig` output; preflight may display that public configuration but must not discard the private configuration before the internal OpenAI call. Run packaged `scripts/capability-probe.mjs` read-only to obtain the host image capability state. Do not probe a private endpoint or make a network request during preflight.
2. Validate the manifest with `scripts/validate-image-assets.mjs` and select finite jobs with `selectGenerationJobs`. `prompt-only` selects no jobs. `select` selects no jobs until the user explicitly supplies the exact stable asset IDs; reject unknown, duplicate, or non-prompt-ready IDs.
3. `IMAGE_PROVIDER=codex-first` is the default. Use the available host `image_gen` capability for selected jobs even when `OPENAI_API_KEY` exists. An API key does not provide paid approval; key presence is credential availability, not consent. Preserve returned evidence verbatim and do not invent an applied model or quality.
4. If the host route is unavailable, repeatedly fails, or produces an unsatisfactory draft, stop. Preserve the result and propose an explicit paid OpenAI attempt with cost and quality choices; do not switch providers automatically.
5. Use `IMAGE_PROVIDER=openai` only after the user explicitly selects the paid route for the finite jobs. Route only through `scripts/generate-openai-images.mjs`. OpenAI failure must not trigger an automatic Codex fallback.
6. If Korean characters must appear inside the pixels, require `IMAGE_EMBEDDED_TEXT_LOCALE=ko-KR`, `IMAGE_PROVIDER=openai`, and `IMAGE_MODEL=gpt-image-2`. Do not infer this from a Korean-language descriptive prompt. Missing or contradictory routing makes zero provider calls.
7. Keep paid `IMAGE_QUALITY=low` as the default for drafts, storyboard frames, variants, and most working images. Use `medium` only for a selected master/key image or explicit high-fidelity need. Recommend `high` only as an exceptional, justified choice for a video hero frame or production concept art; disclose the added cost and obtain current approval instead of broadly upgrading assets.
8. Keep provider result, prompt digest, output digest, and failure state separate from human review. Generated output remains `concept-draft`; send it to `review-image-assets` with its stable ID and artifact-local evidence paths.

Use the packaged `scripts/run-image-asset-workflow.mjs` composition: `runConfiguredImageAssetWorkflow` invokes `planImageAssetWorkflow` and internally invokes `generateImageAssetWorkflow` with private configuration. Host callbacks receive only selected compiled jobs and return bounded PNG bytes plus closed provenance; no callback receives a final artifact path, workspace root, full configuration, or API key.

## Cutscene dispatch handoff

For `design-cutscene-visual-preproduction`, do not use this general workflow or its selection receipt as a legacy bypass. Dispatch only through `run-approved-cutscene-image-stage.mjs` after the current wave approval proves the current exact prompt, references, output request, cost estimate, and live host-user identity. Preserve successful assets. An explicit retry uses only the same still-current full-wave estimate, pricing snapshot, and request schedule, never a subset estimate; if its prior receipt is stale, obtain fresh named live host-user approval bound to that same current estimate, then show the remaining approved worst-case and remaining retryReserve as current cost status. If the estimate, pricing, or request schedule drifted or expired, fail closed with provider calls: 0: a new journal epoch or replan is unsupported by the current runtime, so do not promise a retry.

For `select`, the host adapter supplies exactly `{kind:"host-user-image-selection",channel:"host-user-input",event_id,asset_ids}` with the nonempty ordered stable-ID selection. Reject duplicate/mismatched IDs, specialist/agent channels, prose `selectionSource`, and arbitrary files; persist and return only the event-addressed, secret-free selection record.

## Output contract

Return the selected stable asset IDs, mode, redacted provider decision, per-asset generation result, preserved prompts/placeholders, and a named-human review handoff. Never log API keys, authorization headers, base64 data, or raw image bytes.
