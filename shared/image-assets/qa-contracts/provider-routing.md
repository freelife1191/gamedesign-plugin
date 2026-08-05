# Image provider routing

Provider selection is closed and records only a provider decision; it never discovers or guesses a private Codex endpoint.

| Condition | Decision | Result |
| --- | --- | --- |
| `prompt-only` | `none` | Preserve prompts and placeholders; make zero generation calls. |
| `select` before explicit stable IDs | `none` | Require explicit selection; make zero generation calls. |
| Non-empty `OPENAI_API_KEY` | `openai` | Use only `POST /v1/images/generations`; never fall back to Codex. |
| No key, available Codex image capability | `codex` | The host may generate only through its declared capability. |
| No key, no Codex capability | `unavailable` | Preserve prompts and placeholders. |

The local OpenAI adapter is limited to `gpt-image-2`, `low`, one output per declared job, 64 jobs per invocation, and at most three total attempts per output. Only HTTP 429 and 5xx responses retry. `Retry-After` is capped at two seconds. Authentication, quota, billing, invalid-request, `image_generation_user_error`, and policy/moderation responses never retry or change provider.

Each successful PNG is decoded in memory, bounded, signature- and dimension-checked, written to a private temporary file, and atomically promoted only after QA. Output paths must be non-symlink regular paths immediately under `assets/generated/`; existing files are never overwritten. Public provenance records provider, model, quality, request ID, generation time, prompt digest, and output digest only. API keys, authorization values, base64 payloads, and raw bytes are never emitted.

Partial completion keeps validated files and reports every failed asset explicitly. Moderation or policy rejection is `policy-blocked`; it is never relabeled as `prompt-only` or `unavailable`.
