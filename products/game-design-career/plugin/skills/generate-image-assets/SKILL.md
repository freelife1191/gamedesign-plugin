---
name: generate-image-assets
description: Use when a Career image asset manifest and prompt package need bounded generation routing, stable-ID selection, or an honest unavailable-provider handoff.
---

# Generate Image Assets

## Boundary

Apply the packaged policy rather than inventing a provider path. Generation changes only generation state; it never upgrades `concept-draft`, proves portfolio ownership, or approves document use.

## Required input

Require a validated artifact-local `assets/image-assets.yml`, both prompt files, `IMAGE_GEN_MODE`, `IMAGE_PROVIDER`, `IMAGE_EMBEDDED_TEXT_LOCALE`, redacted configuration, capability snapshot, and actual user stable asset IDs when the mode is `select`. Names, positions, inferred intent, and agent selections are not stable user choices.

## Workflow

1. Run `scripts/run-image-asset-workflow.mjs` through `runConfiguredImageAssetWorkflow({ workspaceRoot, ... })`. It loads the private configuration internally and returns only `toPublicImageConfig` output; preflight may display that public configuration but must not discard the private configuration before the internal OpenAI call. Run `scripts/capability-probe.mjs` read-only to check the host image capability; neither preflight may call a network service or guess a private endpoint.
2. Validate the manifest with `scripts/validate-image-assets.mjs` and choose jobs through `selectGenerationJobs`. `prompt-only` always has zero jobs. In `select`, require the user's explicit stable asset IDs and reject unknown, duplicate, or non-prompt-ready choices.
3. `IMAGE_PROVIDER=codex-first` is the default. Use the available host `image_gen` capability for selected jobs even when `OPENAI_API_KEY` exists. API key presence does not grant paid consent. Record only returned provider evidence.
4. If host generation is unavailable, repeatedly fails, or the result is unsatisfactory, preserve it and propose an explicit paid OpenAI attempt. Do not change provider automatically.
5. Use `IMAGE_PROVIDER=openai` only after the user explicitly chooses the paid route for the finite jobs. Call it only through `scripts/generate-openai-images.mjs`, and never auto-fallback after failure.
6. Korean characters inside the image require `IMAGE_EMBEDDED_TEXT_LOCALE=ko-KR`, `IMAGE_PROVIDER=openai`, and `IMAGE_MODEL=gpt-image-2`. Korean prose describing an image is not by itself an on-image text declaration.
7. Paid quality stays `low` by default. Reserve `medium` for a selected master/key image or explicit fidelity need. Recommend `high` only as an exceptional justified choice for a video hero frame or production concept art after cost disclosure and current approval.
8. Keep provider, prompt/output digest, and failure evidence separate from named-human review. A resulting image remains `concept-draft`; hand its stable ID and artifact-local evidence paths to `review-image-assets`.

Use the packaged `scripts/run-image-asset-workflow.mjs` composition: `runConfiguredImageAssetWorkflow` invokes `planImageAssetWorkflow` and internally invokes `generateImageAssetWorkflow` with private configuration. Host callbacks receive only the selected compiled jobs and return bounded PNG bytes plus closed provenance; they never receive a final artifact path, workspace root, full configuration, or API key.

For `select`, require the host adapter to supply exactly `{kind:"host-user-image-selection",channel:"host-user-input",event_id,asset_ids}`. IDs must be the nonempty ordered stable-ID selection with no duplicates; do not accept a prose `selectionSource`, an agent/specialist channel, or an arbitrary selection file. The workflow returns and creates an event-addressed selection record without secrets.

## Output contract

Return the selected stable asset IDs, mode, redacted provider decision, per-asset result, preserved prompts/placeholders, and named-human review handoff. Never emit a key, authorization header, base64 payload, or raw image bytes.
