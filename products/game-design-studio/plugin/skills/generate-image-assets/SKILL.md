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

1. Read configuration through packaged `scripts/validate-image-config.mjs`; retain only public/redacted configuration. Run packaged `scripts/capability-probe.mjs` read-only to obtain the host image capability state. Do not probe a private endpoint or make a network request during preflight.
2. Validate the manifest with `scripts/validate-image-assets.mjs` and select finite jobs with `selectGenerationJobs`. `prompt-only` selects no jobs. `select` selects no jobs until the user explicitly supplies the exact stable asset IDs; reject unknown, duplicate, or non-prompt-ready IDs.
3. When `OPENAI_API_KEY` is present, route to OpenAI only through `scripts/generate-openai-images.mjs`. An API, authentication, quota, policy, invalid-request, or network failure must never trigger a Codex fallback; preserve prompts, placeholders, successful staged results, and explicit failed states.
4. When there is no key and the host image capability is available, use the host image capability only for the selected jobs. Preserve the returned evidence verbatim. Do not assert that a model or quality was applied unless the host actually returned that evidence; in particular, do not invent model/quality claims for the host path.
5. When there is no key and no available host image capability, make no generation call. Leave the Markdown/JSON prompts and placeholders available, mark the unavailable route truthfully, and provide a resumable handoff.
6. Keep provider result, prompt digest, output digest, and failure state separate from human review. Generated output remains `concept-draft`; send it to `review-image-assets` with its stable ID and artifact-local evidence paths.

## Output contract

Return the selected stable asset IDs, mode, redacted provider decision, per-asset generation result, preserved prompts/placeholders, and a named-human review handoff. Never log API keys, authorization headers, base64 data, or raw image bytes.
