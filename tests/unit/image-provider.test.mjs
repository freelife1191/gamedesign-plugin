import assert from "node:assert/strict";
import test from "node:test";

import { resolveImageProvider } from "../../shared/scripts/lib/image-provider.mjs";

test("resolveImageProvider applies the closed provider decision table", () => {
  const cases = [
    [{ mode: "prompt-only", apiKeyPresent: true, codexCapability: { available: true } }, { provider: "none", reason: "prompt-only" }],
    [{ mode: "select", apiKeyPresent: true, codexCapability: { available: true } }, { provider: "none", reason: "selection-required" }],
    [{ mode: "required", apiKeyPresent: true, codexCapability: { available: true } }, { provider: "openai", reason: "api-key-present" }],
    [{ mode: "all", apiKeyPresent: true, codexCapability: { available: false } }, { provider: "openai", reason: "api-key-present" }],
    [{ mode: "required", apiKeyPresent: false, codexCapability: { available: true } }, { provider: "codex", reason: "codex-capability-available" }],
    [{ mode: "all", apiKeyPresent: false, codexCapability: true }, { provider: "codex", reason: "codex-capability-available" }],
    [{ mode: "required", apiKeyPresent: false, codexCapability: { available: false } }, { provider: "unavailable", reason: "no-provider-available" }],
    [{ mode: "all", apiKeyPresent: false, codexCapability: undefined }, { provider: "unavailable", reason: "no-provider-available" }],
  ];

  for (const [input, expected] of cases) assert.deepEqual(resolveImageProvider(input), expected);
});

test("resolveImageProvider rejects unknown modes instead of guessing a provider", () => {
  assert.throws(
    () => resolveImageProvider({ mode: "unbounded", apiKeyPresent: false, codexCapability: { available: true } }),
    /mode/i,
  );
});
