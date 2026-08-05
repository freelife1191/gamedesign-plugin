# Image provider routing

Provider selection is closed and records only a provider decision; it never discovers or guesses a private Codex endpoint.

| Condition | Decision | Result |
| --- | --- | --- |
| `prompt-only` | `none` | Preserve prompts and placeholders; make zero generation calls. |
| `select` before explicit stable IDs | no resolver call | `selectGenerationJobs` returns no jobs; make zero generation calls. |
| `select` after explicit stable IDs | Same as `required`/`all` | Route to OpenAI, Codex capability, or unavailable. |
| Non-empty `OPENAI_API_KEY` | `openai` | Use only `POST /v1/images/generations`; never fall back to Codex. |
| No key, available Codex image capability | `codex` | The host may generate only through its declared capability. |
| No key, no Codex capability | `unavailable` | Preserve prompts and placeholders. |

The local OpenAI adapter forwards every Task 1 configuration-safe model identifier and quality (`low`, `medium`, `high`, or `auto`) to one output per declared job, with 64 jobs per invocation and at most three total attempts per output. The opt-in live smoke alone is fixed to `gpt-image-2` and `low`. For `gpt-image-2`, generation sizes must be 16-pixel multiples, each edge no greater than 3840, aspect ratio from 1:3 through 3:1, and 655,360 through 8,294,400 pixels. Each request explicitly declares `n: 1`, and a success response must contain exactly one image entry.

Only actual transient rate-limit HTTP 429 responses and 5xx responses retry. `Retry-After` is capped at two seconds. Authentication, quota, billing, credit, spend, usage, invalid-request, `image_generation_user_error`, and policy/moderation responses never retry or change provider. Response bodies are read from the response stream, never through `response.json()`: a 20 MiB ceiling is checked from `Content-Length` when available and enforced again for every received chunk. Oversized declared bodies are cancelled before reading; non-EOF reader failures cancel and release their lock without replacing the redacted primary failure. This accommodates a bounded 12 MiB PNG base64 payload plus JSON metadata without unbounded reads.

Each successful PNG is decoded in memory, bounded, signature- and dimension-checked, written to a private temporary file, and atomically promoted only after QA using no-clobber publication. Output paths must be non-symlink regular paths immediately under `assets/generated/`; existing files are never overwritten, including when a file appears after preflight. Public provenance records provider, model, quality, request ID, generation time, prompt digest, and output digest only. API keys, authorization values, base64 payloads, and raw bytes are never emitted.

Partial completion keeps validated files and reports every failed asset explicitly. Moderation or policy rejection is `policy-blocked`; it is never relabeled as `prompt-only` or `unavailable`.
