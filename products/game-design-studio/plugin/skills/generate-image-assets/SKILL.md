---
name: generate-image-assets
description: Use when a Studio image asset manifest and prompt package need bounded generation routing, stable-ID selection, or an honest unavailable-provider handoff.
---

# Generate Image Assets

## Boundary

Use the existing provider policy; do not recreate it or call an undocumented host endpoint. Generation changes generation state only. It never changes an asset from `concept-draft` and never creates approval evidence.

## Required input

Collect a validated artifact-local `assets/image-assets.yml`, its prompt package, `IMAGE_GEN_MODE`, redacted image configuration, capability snapshot, and—when mode is `select`—the actual user-provided stable asset IDs. Do not accept labels, ordinal positions, guessed IDs, or an agent's implied selection.

## Workflow

1. Run packaged `scripts/run-image-asset-workflow.mjs` through `runConfiguredImageAssetWorkflow({ workspaceRoot, ... })`. It loads private configuration internally and returns only `toPublicImageConfig` output; preflight may display that public configuration but must not discard the private configuration before the internal OpenAI call. Run packaged `scripts/capability-probe.mjs` read-only to obtain the host image capability state. Do not probe a private endpoint or make a network request during preflight.
2. Validate the manifest with `scripts/validate-image-assets.mjs` and select finite jobs with `selectGenerationJobs`. `prompt-only` selects no jobs. `select` selects no jobs until the user explicitly supplies the exact stable asset IDs; reject unknown, duplicate, or non-prompt-ready IDs.
3. When `OPENAI_API_KEY` is present, route to OpenAI only through `scripts/generate-openai-images.mjs`. An API, authentication, quota, policy, invalid-request, or network failure must never trigger a Codex fallback; preserve prompts, placeholders, successful staged results, and explicit failed states.
4. When there is no key and the host image capability is available, use the host image capability only for the selected jobs. Preserve the returned evidence verbatim. Do not assert that a model or quality was applied unless the host actually returned that evidence; in particular, do not invent model/quality claims for the host path.
5. When there is no key and no available host image capability, make no generation call. Leave the Markdown/JSON prompts and placeholders available, mark the unavailable route truthfully, and provide a resumable handoff.
6. Keep provider result, prompt digest, output digest, and failure state separate from human review. Generated output remains `concept-draft`; send it to `review-image-assets` with its stable ID and artifact-local evidence paths.

Use the packaged `scripts/run-image-asset-workflow.mjs` composition: `runConfiguredImageAssetWorkflow` invokes `planImageAssetWorkflow` and internally invokes `generateImageAssetWorkflow` with private configuration. Host callbacks receive only selected compiled jobs and return bounded PNG bytes plus closed provenance; no callback receives a final artifact path, workspace root, full configuration, or API key.

## Cutscene dispatch handoff

For `design-cutscene-visual-preproduction`, do not use this general workflow or its selection receipt as a legacy bypass. Dispatch only through `run-approved-cutscene-image-stage.mjs` after the current wave approval proves the current exact prompt, references, output request, cost estimate, and live host-user identity. Preserve successful assets and retry only current retryable stable IDs after a new per-wave estimate and approval.

For `select`, the host adapter supplies exactly `{kind:"host-user-image-selection",channel:"host-user-input",event_id,asset_ids}` with the nonempty ordered stable-ID selection. Reject duplicate/mismatched IDs, specialist/agent channels, prose `selectionSource`, and arbitrary files; persist and return only the event-addressed, secret-free selection record.

## Output contract

Return the selected stable asset IDs, mode, redacted provider decision, per-asset generation result, preserved prompts/placeholders, and a named-human review handoff. Never log API keys, authorization headers, base64 data, or raw image bytes.
