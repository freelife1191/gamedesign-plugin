import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

import * as workflow from "../../shared/scripts/resolve-quality-profile.mjs";

const qualityRoot = new URL("../../shared/document-quality/", import.meta.url);

async function json(relativePath) {
  return JSON.parse(await readFile(new URL(relativePath, qualityRoot), "utf8"));
}

async function text(relativePath) {
  return readFile(new URL(relativePath, qualityRoot), "utf8");
}

async function catalog(namespace) {
  const index = await json(`indexes/${namespace}.json`);
  const entries = await Promise.all(index.profiles.map(async ({ profile_id: id }) => ({
    profile: await json(`profiles/${namespace}/${id}.json`),
    sourceText: await text(`profiles/${namespace}/${id}.json`),
  })));
  const profiles = entries.map(({ profile }) => profile);
  return {
    index,
    profiles,
    byId: new Map(profiles.map((profile) => [profile.profile_id, profile])),
    sourceTextById: new Map(entries.map(({ profile, sourceText }) => [profile.profile_id, sourceText])),
  };
}

function baseRequest(overrides = {}) {
  return {
    artifactId: "pitch", goal: "executive pitch", audience: ["executive"],
    artifactType: "presentation", requestedFormat: "pptx", ...overrides,
  };
}

test("Task 1 profile-shaped preset composition remains source compatible", async () => {
  const primary = await json("profiles/studio/game-design-brief.json");
  const preset = { profile_id: "executive-preset", required_sections: [{ id: "summary", title: "Executive summary" }], acceptance_criteria: ["The recommendation is explicit."] };
  const result = workflow.composeQualityProfile({ primary, preset });
  assert.ok(result.profile.required_sections.some(({ id }) => id === "summary"));
  assert.equal(result.provenance.preset, "executive-preset");
  assert.equal(Object.hasOwn(result, "guidance"), false);
});

test("neutral reference preset is separate and production-safeText rejects every source/URL family", async () => {
  const primary = await json("profiles/studio/game-design-brief.json");
  const referencePreset = await json("presets/function-first.json");
  const result = workflow.composeQualityProfile({ primary, referencePreset });
  assert.equal(result.provenance.preset, null);
  assert.deepEqual(result.referencePresetProvenance, { preset: "function-first" });
  for (const text of [
    "https://example.invalid", "//example.invalid/x", "www.example.invalid", "mailto:a@example.invalid",
    "data:text/plain,x", "file:///tmp/x", "Copy the original source layout.", "Reuse the source image.",
    "Source company citation is required.", "Original project trademark and logo are required.",
  ]) {
    const candidate = structuredClone(referencePreset);
    candidate.emphasis[0] = text;
    assert.throws(() => workflow.composeQualityProfile({ primary, referencePreset: candidate }), /reference preset|pattern|safe text/i, text);
  }
});

test("closed indexes match bodies exactly and selector refuses body preloading", async () => {
  for (const namespace of ["studio", "career"]) {
    const { index, profiles } = await catalog(namespace);
    assert.deepEqual(workflow.validateQualitySelectionIndex(index), { ok: true, errors: [] });
    assert.deepEqual(index.profiles, profiles.map((profile) => ({
      profile_id: profile.profile_id,
      artifact_types: profile.artifact_types,
      audiences: profile.audiences,
      required_formats: profile.export_rules.required_formats,
      forbidden_formats: profile.export_rules.forbidden_formats,
    })).sort((left, right) => left.profile_id.localeCompare(right.profile_id, "en-US")));
  }
  const { index, profiles } = await catalog("studio");
  assert.throws(() => workflow.selectQualityProfiles({ profiles, requests: [baseRequest()] }), /selection index|preload/i);
  assert.equal(workflow.selectQualityProfiles({ selectionIndex: index, requests: [baseRequest()] })[0].primaryProfileId, "executive-pitch");
});

test("selection records are complete and fallback is permitted only for an unknown override", async () => {
  const { index } = await catalog("studio");
  const unresolved = workflow.selectQualityProfiles({ selectionIndex: index, requests: [baseRequest({ explicitPrimaryId: "executive-pich" })] })[0];
  assert.equal(unresolved.status, "fallback-required");
  assert.equal(unresolved.fallbackRecord.nearestProfileId, "executive-pitch");
  const resolved = workflow.selectQualityProfiles({ selectionIndex: index, requests: [baseRequest({ explicitPrimaryId: "executive-pich", fallbackPrimaryId: "executive-pitch" })] })[0];
  assert.equal(resolved.primaryProfileId, "executive-pitch");
  assert.equal(resolved.fallbackRecord.nearestProfileId, "executive-pitch");
  assert.deepEqual(resolved.fallbackRecord.differences, unresolved.fallbackRecord.differences);
  for (const key of ["overlayIds", "presetId", "selectionReason", "score", "tieBreak"]) assert.ok(Object.hasOwn(resolved, key), key);
  assert.throws(() => workflow.selectQualityProfiles({ selectionIndex: index, requests: [baseRequest({ fallbackPrimaryId: "executive-pitch" })] }), /fallback.*unknown explicit override/i);
  assert.throws(() => workflow.selectQualityProfiles({ selectionIndex: index, requests: [baseRequest({ explicitPrimaryId: "executive-pich", fallbackPrimaryId: "missing" })] }), /unknown fallback/i);
});

test("upper apply API proves bounded lazy loading and returns composed guidance plus checklist", async () => {
  const { index, sourceTextById } = await catalog("studio");
  const calls = [];
  const profileLoader = async (request) => {
    calls.push(request);
    return { sourceText: sourceTextById.get(request.profileId) };
  };
  const referencePresetText = await text("presets/function-first.json");
  const overlayText = await text("overlays/mobile.json");
  const sourceLoader = async ({ sourceType }) => ({ sourceText: sourceType === "overlay" ? overlayText : referencePresetText });
  const applied = await workflow.applyDocumentQualityProfile({
    namespace: "studio", selectionIndex: index, testOnlyLoaders: true, profileLoader, sourceLoader,
    request: { artifactId: "brief", goal: "game design brief", audience: ["production"], artifactType: "design-document", requestedFormat: "md" },
    overlayIds: ["mobile"], presetId: "function-first",
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].purpose, "selected-primary");
  assert.deepEqual(applied.selection.overlayIds, ["mobile"]);
  assert.equal(applied.selection.presetId, "function-first");
  assert.equal(applied.composed.referencePresetProvenance.preset, "function-first");
  assert.ok(applied.checklist.sections.length > 0);
  assert.equal(applied.requirementManifest.requiredItemIds.length > 0, true);

  calls.length = 0;
  const unresolved = await workflow.applyDocumentQualityProfile({ namespace: "studio", selectionIndex: index, testOnlyLoaders: true, profileLoader, request: baseRequest({ explicitPrimaryId: "executive-pich" }) });
  assert.equal(unresolved.selection.status, "fallback-required");
  assert.deepEqual(calls.map(({ purpose }) => purpose), ["nearest-comparison"]);
  calls.length = 0;
  await workflow.applyDocumentQualityProfile({ namespace: "studio", selectionIndex: index, testOnlyLoaders: true, profileLoader, request: baseRequest({ explicitPrimaryId: "executive-pich", fallbackPrimaryId: "executive-pitch" }) });
  assert.deepEqual(calls.map(({ purpose }) => purpose), ["nearest-comparison", "selected-primary"]);

  const pathCalls = [];
  const packagedLoader = workflow.createQualityProfileBodyLoader({
    documentQualityRoot: fileURLToPath(qualityRoot),
    onLoad: (record) => pathCalls.push(record),
  });
  await workflow.applyDocumentQualityProfile({ namespace: "studio", selectionIndex: index, testOnlyLoaders: true, profileLoader: packagedLoader, request: baseRequest() });
  assert.deepEqual(pathCalls, [{
    namespace: "studio", profileId: "executive-pitch", purpose: "selected-primary",
    relativePath: "profiles/studio/executive-pitch.json",
  }]);
});

test("structural completion cannot be synthesized from composed requirements", async () => {
  const composed = workflow.composeQualityProfile({ primary: await json("profiles/studio/game-design-brief.json") });
  assert.throws(() => workflow.createStructuralCompletionEvidence(composed), /manifest|inspection|plain object/i);
});

test("caller-provided state strings cannot bypass the receipt-chain envelope", () => {
  assert.throws(() => workflow.transitionDocumentQualityState({ currentState: "visual-reviewed", targetState: "document-approved" }), /currentState.*forbidden|state envelope/i);
});

test("same-source normalization-equivalent criteria fail before duplicate stable IDs", async () => {
  const base = await json("profiles/studio/game-design-brief.json");
  for (const pair of [
    ["Criterion text.", " criterion   text. "],
    ["Criterion text.", "CRITERION TEXT."],
    ["Café is readable.", "Cafe\u0301 is readable."],
  ]) assert.throws(() => workflow.composeQualityProfile({ primary: { ...base, acceptance_criteria: pair } }), /duplicate.*acceptance|normalization/i);
});
