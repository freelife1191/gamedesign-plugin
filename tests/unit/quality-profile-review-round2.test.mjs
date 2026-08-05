import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

import * as workflow from "../../shared/scripts/resolve-quality-profile.mjs";

const qualityRoot = new URL("../../shared/document-quality/", import.meta.url);

async function json(relativePath) {
  return JSON.parse(await readFile(new URL(relativePath, qualityRoot), "utf8"));
}

async function catalog(namespace) {
  const index = await json(`indexes/${namespace}.json`);
  const profiles = await Promise.all(index.profiles.map(({ profile_id: id }) => json(`profiles/${namespace}/${id}.json`)));
  return { index, profiles, byId: new Map(profiles.map((profile) => [profile.profile_id, profile])) };
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
  const { index, byId } = await catalog("studio");
  const calls = [];
  const profileLoader = async (request) => {
    calls.push(request);
    return structuredClone(byId.get(request.profileId));
  };
  const referencePreset = await json("presets/function-first.json");
  const overlay = await json("overlays/mobile.json");
  const applied = await workflow.applyDocumentQualityProfile({
    namespace: "studio", selectionIndex: index, profileLoader,
    request: { artifactId: "brief", goal: "game design brief", audience: ["production"], artifactType: "design-document", requestedFormat: "md" },
    overlays: [overlay], preset: { profile_id: "decision-preset", acceptance_criteria: ["Decision is explicit."] }, referencePreset,
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].purpose, "selected-primary");
  assert.deepEqual(applied.selection.overlayIds, ["mobile"]);
  assert.equal(applied.selection.presetId, "decision-preset");
  assert.equal(applied.composed.referencePresetProvenance.preset, "function-first");
  assert.ok(applied.checklist.sections.length > 0);

  calls.length = 0;
  const unresolved = await workflow.applyDocumentQualityProfile({ namespace: "studio", selectionIndex: index, profileLoader, request: baseRequest({ explicitPrimaryId: "executive-pich" }) });
  assert.equal(unresolved.selection.status, "fallback-required");
  assert.deepEqual(calls.map(({ purpose }) => purpose), ["nearest-comparison"]);
  calls.length = 0;
  await workflow.applyDocumentQualityProfile({ namespace: "studio", selectionIndex: index, profileLoader, request: baseRequest({ explicitPrimaryId: "executive-pich", fallbackPrimaryId: "executive-pitch" }) });
  assert.deepEqual(calls.map(({ purpose }) => purpose), ["nearest-comparison", "selected-primary"]);

  const pathCalls = [];
  const packagedLoader = workflow.createQualityProfileBodyLoader({
    documentQualityRoot: fileURLToPath(qualityRoot),
    onLoad: (record) => pathCalls.push(record),
  });
  await workflow.applyDocumentQualityProfile({ namespace: "studio", selectionIndex: index, profileLoader: packagedLoader, request: baseRequest() });
  assert.deepEqual(pathCalls, [{
    namespace: "studio", profileId: "executive-pitch", purpose: "selected-primary",
    relativePath: "profiles/studio/executive-pitch.json",
  }]);
});

test("trusted structural evidence cannot be emptied, weakened, replaced, or duplicated", async () => {
  const composed = workflow.composeQualityProfile({ primary: await json("profiles/studio/game-design-brief.json") });
  const evidence = workflow.createStructuralCompletionEvidence(composed);
  assert.equal(workflow.verifyStructuralCompletionEvidence(composed, evidence).ready, true);
  for (const mutate of [
    (value) => { value.completedItemIds = []; },
    (value) => { value.completedItemIds.pop(); },
    (value) => { value.completedItemIds[0] = "replacement"; },
    (value) => { value.completedItemIds.push(value.completedItemIds[0]); },
    (value) => { value.required = false; },
  ]) {
    const candidate = structuredClone(evidence); mutate(candidate);
    assert.throws(() => workflow.verifyStructuralCompletionEvidence(composed, candidate), /completion|structural|field|duplicate|missing/i);
  }
});

test("five states require closed evidence, renderer/Skillstead, rights/gates, and human records", async () => {
  const composed = workflow.composeQualityProfile({ primary: await json("profiles/studio/game-design-brief.json") });
  const completionEvidence = workflow.createStructuralCompletionEvidence(composed);
  const digest = "a".repeat(64);
  const evidenceReview = { schemaVersion: 1, reviewerRole: "evidence-auditor", status: "verified", evidenceIds: ["evidence-1"], artifactDigest: digest };
  const visualReview = { schemaVersion: 1, reviewerRole: "renderer-qa", rendererStatus: "passed", qaStatus: "passed", artifactDigest: digest, skillsteadSlots: composed.profile.required_diagrams.map(({ id }) => ({ slotId: id, verificationDigest: digest })) };
  const gateIds = ["ai-rights-human-approval", "accessibility", "economy-transparency", "liveops-experiment", "ugc-safety", "ai-npc-safety", "scope-control"];
  const documentApproval = {
    schemaVersion: 1,
    rightsApproval: { source_provenance: "recorded", rights_or_consent_record: "rights-1", human_approver: "rights-owner", approval_date: "2026-08-05" },
    responsibleGates: gateIds.map((gateId) => ({ gateId, state: "approved", evidenceIds: [`${gateId}-evidence`], human_approver: "producer" })),
    humanApprovalReceipt: { human_approver: "document-owner", approval_date: "2026-08-05", artifact_digest: digest },
  };
  let state = workflow.transitionDocumentQualityState({ currentState: "draft", targetState: "structurally-complete", composed, completionEvidence });
  for (const forged of ["evidence-auditor", true, { selfAttested: true }, { ...evidenceReview, generated: true }]) assert.throws(() => workflow.transitionDocumentQualityState({ currentState: state, targetState: "evidence-reviewed", composed, completionEvidence, evidenceReview: forged }), /evidence|record|field/i);
  state = workflow.transitionDocumentQualityState({ currentState: state, targetState: "evidence-reviewed", composed, completionEvidence, evidenceReview });
  for (const forged of ["renderer-qa", { renderedFile: true }, { ...visualReview, skillsteadSlots: [] }]) assert.throws(() => workflow.transitionDocumentQualityState({ currentState: state, targetState: "visual-reviewed", composed, completionEvidence, visualReview: forged }), /visual|renderer|skillstead|record|field/i);
  state = workflow.transitionDocumentQualityState({ currentState: state, targetState: "visual-reviewed", composed, completionEvidence, visualReview });
  for (const forged of ["human", { selfAttested: true }, { ...documentApproval, responsibleGates: documentApproval.responsibleGates.map((gate, index) => index === 0 ? { ...gate, state: "pending" } : gate) }, { ...documentApproval, responsibleGates: documentApproval.responsibleGates.slice(1) }]) assert.throws(() => workflow.transitionDocumentQualityState({ currentState: state, targetState: "document-approved", composed, completionEvidence, documentApproval: forged }), /approval|rights|responsible|human|record|field/i);
  assert.equal(workflow.transitionDocumentQualityState({ currentState: state, targetState: "document-approved", composed, completionEvidence, documentApproval }), "document-approved");
});

test("same-source normalization-equivalent criteria fail before duplicate stable IDs", async () => {
  const base = await json("profiles/studio/game-design-brief.json");
  for (const pair of [
    ["Criterion text.", " criterion   text. "],
    ["Criterion text.", "CRITERION TEXT."],
    ["Café is readable.", "Cafe\u0301 is readable."],
  ]) assert.throws(() => workflow.composeQualityProfile({ primary: { ...base, acceptance_criteria: pair } }), /duplicate.*acceptance|normalization/i);
});
