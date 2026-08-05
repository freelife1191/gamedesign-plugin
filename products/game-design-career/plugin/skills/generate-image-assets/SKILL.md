---
name: generate-image-assets
description: Use when a Career image asset manifest and prompt package need bounded generation routing, stable-ID selection, or an honest unavailable-provider handoff.
---

# Generate Image Assets

## Boundary

Apply the packaged policy rather than inventing a provider path. Generation changes only generation state; it never upgrades `concept-draft`, proves portfolio ownership, or approves document use.

## Required input

Require a validated artifact-local `assets/image-assets.yml`, both prompt files, `IMAGE_GEN_MODE`, redacted configuration, capability snapshot, and actual user stable asset IDs when the mode is `select`. Names, positions, inferred intent, and agent selections are not stable user choices.

## Workflow

1. Use packaged `scripts/validate-image-config.mjs` for configuration and retain only its public/redacted result. Run `scripts/capability-probe.mjs` read-only to check the host image capability; neither preflight may call a network service or guess a private endpoint.
2. Validate the manifest with `scripts/validate-image-assets.mjs` and choose jobs through `selectGenerationJobs`. `prompt-only` always has zero jobs. In `select`, require the user's explicit stable asset IDs and reject unknown, duplicate, or non-prompt-ready choices.
3. When `OPENAI_API_KEY` is present, use OpenAI only through `scripts/generate-openai-images.mjs`. Never use a Codex fallback after an API, authentication, quota, policy, invalid-request, or network failure. Keep prompts, placeholders, staged successes, and truthful per-asset failure states.
4. With no key and an available host image capability, send only selected jobs to that host capability. Record only returned provider evidence. Do not claim a model or quality applied to the host path unless it was returned as evidence.
5. With no key and no available host image capability, call no generator. Preserve prompts and placeholders and report the unavailable provider decision with a resumable handoff.
6. Keep provider, prompt/output digest, and failure evidence separate from named-human review. A resulting image remains `concept-draft`; hand its stable ID and artifact-local evidence paths to `review-image-assets`.

## Output contract

Return the selected stable asset IDs, mode, redacted provider decision, per-asset result, preserved prompts/placeholders, and named-human review handoff. Never emit a key, authorization header, base64 payload, or raw image bytes.
