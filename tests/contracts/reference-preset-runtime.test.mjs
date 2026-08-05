import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("production reference preset validator enforces the packaged schema safeText policy", async () => {
  const { validateReferencePreset } = await import("../../shared/scripts/validate-reference-preset.mjs");
  const valid = JSON.parse(await readFile(new URL("../../shared/document-quality/presets/function-first.json", import.meta.url), "utf8"));
  assert.deepEqual(validateReferencePreset(valid), { ok: true, errors: [] });
  for (const text of [
    "https://example.invalid", "//example.invalid", "www.example.invalid", "mailto:a@example.invalid",
    "data:text/plain,x", "file:///tmp/x", "Copy source logo", "Reuse original image",
    "Source company", "Original project", "Source trademark", "Original layout", "Source citation",
  ]) {
    const candidate = structuredClone(valid); candidate.story_hints[0] = text;
    assert.equal(validateReferencePreset(candidate).ok, false, text);
  }
  for (const candidate of [
    { ...valid, extra: true }, { ...valid, preset_id: "unknown" }, { ...valid, version: 0 },
    { ...valid, emphasis: [] }, { ...valid, emphasis: [...valid.emphasis, valid.emphasis[0]] },
    { ...valid, emphasis: ["Cafe\u0301"] },
  ]) assert.equal(validateReferencePreset(candidate).ok, false);
});
