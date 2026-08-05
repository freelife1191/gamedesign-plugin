import assert from "node:assert/strict";
import test from "node:test";

import { buildImageAssetPlan, selectGenerationJobs } from "../../shared/scripts/build-image-asset-plan.mjs";
import { resolveImageProvider } from "../../shared/scripts/lib/image-provider.mjs";

test("resolveImageProvider applies the closed provider decision table", () => {
  const cases = [
    [{ mode: "prompt-only", apiKeyPresent: true, codexCapability: { available: true } }, { provider: "none", reason: "prompt-only" }],
    [{ mode: "select", apiKeyPresent: true, codexCapability: { available: true } }, { provider: "openai", reason: "api-key-present" }],
    [{ mode: "required", apiKeyPresent: true, codexCapability: { available: true } }, { provider: "openai", reason: "api-key-present" }],
    [{ mode: "all", apiKeyPresent: true, codexCapability: { available: false } }, { provider: "openai", reason: "api-key-present" }],
    [{ mode: "required", apiKeyPresent: false, codexCapability: { available: true } }, { provider: "codex", reason: "codex-capability-available" }],
    [{ mode: "all", apiKeyPresent: false, codexCapability: true }, { provider: "codex", reason: "codex-capability-available" }],
    [{ mode: "select", apiKeyPresent: false, codexCapability: true }, { provider: "codex", reason: "codex-capability-available" }],
    [{ mode: "required", apiKeyPresent: false, codexCapability: { available: false } }, { provider: "unavailable", reason: "no-provider-available" }],
    [{ mode: "all", apiKeyPresent: false, codexCapability: undefined }, { provider: "unavailable", reason: "no-provider-available" }],
  ];

  for (const [input, expected] of cases) assert.deepEqual(resolveImageProvider(input), expected);
});

test("resolveImageProvider normalizes capability-probe tri-state values without treating unknown as available", () => {
  assert.deepEqual(
    resolveImageProvider({ mode: "required", apiKeyPresent: false, codexCapability: { status: "available", provider: "codex-system-skill" } }),
    { provider: "codex", reason: "codex-capability-available" },
  );
  for (const status of ["unavailable", "unknown"]) {
    assert.deepEqual(
      resolveImageProvider({ mode: "all", apiKeyPresent: false, codexCapability: { status } }),
      { provider: "unavailable", reason: status === "unknown" ? "codex-capability-unknown" : "no-provider-available" },
    );
  }
  assert.throws(
    () => resolveImageProvider({ mode: "required", apiKeyPresent: false, codexCapability: { status: "invented" } }),
    /capability/i,
  );
});

test("select pre-selection returns no jobs before any provider or generator is invoked", () => {
  const qualityProfile = {
    profile_id: "provider-test", version: 1, artifact_types: ["design-document"], audiences: ["design"],
    required_sections: [{ id: "visuals", title: "Visuals" }], required_tables: [{ id: "table", section_id: "visuals", columns: ["Signal"] }],
    required_diagrams: [{ id: "diagram", section_id: "visuals", purpose: "Explain", alt_text: "Diagram" }],
    required_images: [{ id: "hero", section_id: "visuals", purpose: "Explain", alt_text: "Hero" }], recommended_images: [],
    length_guidance: { min_words: 1, max_words: 10 }, ppt_story_contract: {}, acceptance_criteria: ["Readable"],
    export_rules: { required_formats: ["md"], forbidden_formats: [] }, quality_checks: ["visual"],
  };
  const artifact = { artifact_id: "provider-test", image_needs: [{
    slot_id: "hero", type: "character", scene: "A clear scene.", subject: "A safe silhouette.", composition: "Centered.",
    visual_style: "Original illustration.", readability: "Readable.", width: 1024, height: 1024,
  }] };
  const manifest = buildImageAssetPlan({ artifact, qualityProfile }).manifest;
  const jobs = selectGenerationJobs({ manifest, mode: "select", selectedAssetIds: [] });
  let providerCalls = 0;
  let generatorCalls = 0;
  if (jobs.length > 0) {
    providerCalls += 1;
    resolveImageProvider({ mode: "select", apiKeyPresent: true, codexCapability: { available: true } });
    generatorCalls += 1;
  }
  assert.deepEqual(jobs, []);
  assert.equal(providerCalls, 0);
  assert.equal(generatorCalls, 0);
});

test("resolveImageProvider rejects unknown modes instead of guessing a provider", () => {
  assert.throws(
    () => resolveImageProvider({ mode: "unbounded", apiKeyPresent: false, codexCapability: { available: true } }),
    /mode/i,
  );
});
