import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

test("OpenAI image smoke uses validated gpt-image-2 settings and a bounded request timeout without printing the API key", async () => {
  const [smoke, example] = await Promise.all([
    readFile(path.join(repoRoot, "tooling", "smoke-openai-image.mjs"), "utf8"),
    readFile(path.join(repoRoot, ".env.example"), "utf8"),
  ]);

  assert.match(smoke, /model:\s*config\.model/u);
  assert.match(smoke, /quality:\s*config\.quality/u);
  assert.match(smoke, /requestTimeoutMs:\s*config\.requestTimeoutMs/u);
  assert.match(smoke, /OPENAI_API_KEY is not set/u);
  assert.doesNotMatch(smoke, /console\.(?:log|error)\([^\n]*config\.apiKey/u);
  assert.match(example, /^IMAGE_MODEL=gpt-image-2$/mu);
  assert.match(example, /^IMAGE_REQUEST_TIMEOUT_MS=\d+$/mu);
  assert.match(example, /cost|비용|billing/i);
});
