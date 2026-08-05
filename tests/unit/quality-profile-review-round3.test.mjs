import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import * as workflow from "../../shared/scripts/resolve-quality-profile.mjs";

const qualityRoot = new URL("../../shared/document-quality/", import.meta.url);
const artifactA = "a".repeat(64);
const artifactB = "b".repeat(64);

async function json(relativePath) {
  return JSON.parse(await readFile(new URL(relativePath, qualityRoot), "utf8"));
}

async function text(relativePath) {
  return readFile(new URL(relativePath, qualityRoot), "utf8");
}

function digest(value) {
  const canonical = (item) => Array.isArray(item)
    ? `[${item.map(canonical).join(",")}]`
    : item && typeof item === "object"
      ? `{${Object.keys(item).sort().map((key) => `${JSON.stringify(key)}:${canonical(item[key])}`).join(",")}}`
      : JSON.stringify(item);
  return createHash("sha256").update(canonical(value), "utf8").digest("hex");
}

function signed(value) {
  return { ...value, receiptDigest: digest(value) };
}

function resigned(value) {
  const unsigned = structuredClone(value);
  delete unsigned.receiptDigest;
  return signed(unsigned);
}

async function appliedBrief(options = {}) {
  const index = await json("indexes/studio.json");
  const primaryText = await text("profiles/studio/game-design-brief.json");
  return workflow.applyDocumentQualityProfile({
    namespace: "studio",
    selectionIndex: index,
    testOnlyLoaders: true,
    profileLoader: async () => ({ sourceText: primaryText }),
    request: {
      artifactId: "brief",
      goal: "game design brief",
      audience: ["production"],
      artifactType: "design-document",
      requestedFormat: "md",
    },
    ...options,
  });
}

function inspectionReceipt(requirementManifest, artifactDigest = artifactA) {
  const unsigned = {
    schemaVersion: 1,
    artifactDigest,
    manifestDigest: requirementManifest.manifestDigest,
    contractDigest: requirementManifest.contractDigest,
    checklistDigest: requirementManifest.checklistDigest,
    observations: requirementManifest.requiredItemIds.map((itemId) => ({ itemId, observed: true, passed: true })),
    verifierIdentity: "artifact-inspector:qa-17",
  };
  return signed(unsigned);
}

function evidenceReceipt(requirementManifest, artifactDigest = artifactA) {
  return signed({
    schemaVersion: 1,
    reviewerRole: "evidence-auditor",
    verifierIdentity: "evidence-auditor:ea-4",
    status: "verified",
    evidenceIds: ["evidence-1"],
    artifactDigest,
    manifestDigest: requirementManifest.manifestDigest,
    contractDigest: requirementManifest.contractDigest,
    checklistDigest: requirementManifest.checklistDigest,
  });
}

function visualReceipt(composed, requirementManifest, artifactDigest = artifactA) {
  const skillsteadSlots = composed.profile.required_diagrams.map(({ id: slotId }) => signed({
    slotId,
    artifactDigest,
    verifierIdentity: "skillstead-renderer:sr-2",
  }));
  return signed({
    schemaVersion: 1,
    reviewerRole: "renderer-qa",
    verifierIdentity: "renderer-qa:rq-9",
    rendererStatus: "passed",
    qaStatus: "passed",
    artifactDigest,
    manifestDigest: requirementManifest.manifestDigest,
    contractDigest: requirementManifest.contractDigest,
    checklistDigest: requirementManifest.checklistDigest,
    skillsteadSlots,
  });
}

function approvalReceipt(requirementManifest, artifactDigest = artifactA) {
  const gateIds = [
    "ai-rights-human-approval", "accessibility", "economy-transparency", "liveops-experiment",
    "ugc-safety", "ai-npc-safety", "scope-control",
  ];
  const rightsApproval = signed({
    source_provenance: "recorded",
    rights_or_consent_record: "rights-1",
    human_approver: "rights-owner",
    approval_date: "2026-08-05",
    artifactDigest,
  });
  const responsibleGates = gateIds.map((gateId) => signed({
    gateId,
    state: "approved",
    evidenceIds: [`${gateId}-evidence`],
    human_approver: "producer",
    artifactDigest,
  }));
  const humanApprovalReceipt = signed({
    human_approver: "document-owner",
    approval_date: "2026-08-05",
    artifactDigest,
  });
  return signed({
    schemaVersion: 1,
    artifactDigest,
    manifestDigest: requirementManifest.manifestDigest,
    contractDigest: requirementManifest.contractDigest,
    checklistDigest: requirementManifest.checklistDigest,
    rightsApproval,
    responsibleGates,
    humanApprovalReceipt,
  });
}

test("structural completion requires an exact external artifact-inspection receipt", async () => {
  const applied = await appliedBrief();
  assert.ok(Object.isFrozen(applied.requirementManifest));
  assert.throws(() => workflow.createStructuralCompletionEvidence(applied.composed), /inspection|manifest|argument/i);
  assert.throws(() => workflow.createStructuralCompletionEvidence({ requirementManifest: applied.requirementManifest }), /inspection/i);

  const inspection = inspectionReceipt(applied.requirementManifest);
  const structuralReceipt = workflow.createStructuralCompletionEvidence({
    requirementManifest: applied.requirementManifest,
    inspectionReceipt: inspection,
  });
  assert.equal(workflow.verifyStructuralCompletionEvidence(applied.requirementManifest, structuralReceipt).ready, true);

  for (const mutate of [
    (value) => { value.observations = []; },
    (value) => { value.observations.pop(); },
    (value) => { value.observations[0].observed = false; },
    (value) => { value.observations[0].passed = false; },
    (value) => { value.observations[0].required = false; },
    (value) => { value.observations.push(value.observations[0]); },
    (value) => { value.artifactDigest = artifactB; },
  ]) {
    const candidate = structuredClone(inspection);
    mutate(candidate);
    assert.throws(() => workflow.createStructuralCompletionEvidence({ requirementManifest: applied.requirementManifest, inspectionReceipt: candidate }), /artifact|inspection|observation|receipt|field|digest|duplicate|missing|required/i);
  }
});

test("immutable state envelopes revalidate the complete ordered same-artifact receipt chain", async () => {
  const applied = await appliedBrief();
  const inspection = inspectionReceipt(applied.requirementManifest);
  const structuralReceipt = workflow.createStructuralCompletionEvidence({ requirementManifest: applied.requirementManifest, inspectionReceipt: inspection });
  const evidenceReview = evidenceReceipt(applied.requirementManifest);
  const visualReview = visualReceipt(applied.composed, applied.requirementManifest);
  const documentApproval = approvalReceipt(applied.requirementManifest);

  let stateEnvelope = workflow.createDocumentQualityStateEnvelope({ artifactDigest: artifactA, requirementManifest: applied.requirementManifest });
  assert.equal(stateEnvelope.state, "draft");
  assert.ok(Object.isFrozen(stateEnvelope));
  assert.throws(() => workflow.transitionDocumentQualityState({ currentState: "draft", targetState: "structurally-complete", requirementManifest: applied.requirementManifest, structuralReceipt }), /state envelope|currentState/i);
  assert.throws(() => workflow.transitionDocumentQualityState({ stateEnvelope, targetState: "visual-reviewed", requirementManifest: applied.requirementManifest, visualReview }), /exact next state/i);
  const crossStructural = workflow.createStructuralCompletionEvidence({
    requirementManifest: applied.requirementManifest,
    inspectionReceipt: inspectionReceipt(applied.requirementManifest, artifactB),
  });
  assert.throws(() => workflow.transitionDocumentQualityState({ stateEnvelope, targetState: "structurally-complete", requirementManifest: applied.requirementManifest, structuralReceipt: crossStructural }), /same artifact|artifact digest/i);

  const structuralEnvelope = workflow.transitionDocumentQualityState({ stateEnvelope, targetState: "structurally-complete", requirementManifest: applied.requirementManifest, structuralReceipt });
  const evidenceEnvelope = workflow.transitionDocumentQualityState({ stateEnvelope: structuralEnvelope, targetState: "evidence-reviewed", requirementManifest: applied.requirementManifest, evidenceReview });
  stateEnvelope = workflow.transitionDocumentQualityState({ stateEnvelope: evidenceEnvelope, targetState: "visual-reviewed", requirementManifest: applied.requirementManifest, composed: applied.composed, visualReview });

  for (const mutate of [
    (value) => { value.receipts.pop(); },
    (value) => { value.receipts[0] = value.receipts[1]; },
    (value) => { value.receipts.reverse(); },
    (value) => { value.receipts[0].extra = true; },
    (value) => { value.artifactDigest = artifactB; },
  ]) {
    const candidate = structuredClone(stateEnvelope);
    mutate(candidate);
    assert.throws(() => workflow.transitionDocumentQualityState({ stateEnvelope: candidate, targetState: "document-approved", requirementManifest: applied.requirementManifest, composed: applied.composed, documentApproval }), /envelope|receipt|artifact|ordered|field|digest|state/i);
  }
  for (const crossArtifactRecord of [
    evidenceReceipt(applied.requirementManifest, artifactB),
    visualReceipt(applied.composed, applied.requirementManifest, artifactB),
    approvalReceipt(applied.requirementManifest, artifactB),
  ]) {
    const targetState = crossArtifactRecord.reviewerRole === "evidence-auditor" ? "evidence-reviewed"
      : crossArtifactRecord.reviewerRole === "renderer-qa" ? "visual-reviewed" : "document-approved";
    const sourceEnvelope = targetState === "evidence-reviewed" ? structuralEnvelope
      : targetState === "visual-reviewed" ? evidenceEnvelope : stateEnvelope;
    const key = targetState === "evidence-reviewed" ? "evidenceReview" : targetState === "visual-reviewed" ? "visualReview" : "documentApproval";
    assert.throws(() => workflow.transitionDocumentQualityState({ stateEnvelope: sourceEnvelope, targetState, requirementManifest: applied.requirementManifest, composed: applied.composed, [key]: crossArtifactRecord }), /artifact.*digest|same artifact/i);
  }
  const approvalB = approvalReceipt(applied.requirementManifest, artifactB);
  for (const splice of [
    (value) => { value.rightsApproval = approvalB.rightsApproval; },
    (value) => { value.responsibleGates[0] = approvalB.responsibleGates[0]; },
    (value) => { value.humanApprovalReceipt = approvalB.humanApprovalReceipt; },
  ]) {
    const mixed = structuredClone(documentApproval);
    splice(mixed);
    assert.throws(() => workflow.transitionDocumentQualityState({
      stateEnvelope,
      targetState: "document-approved",
      requirementManifest: applied.requirementManifest,
      composed: applied.composed,
      documentApproval: resigned(mixed),
    }), /same artifact|artifact digest/i);
  }

  stateEnvelope = workflow.transitionDocumentQualityState({ stateEnvelope, targetState: "document-approved", requirementManifest: applied.requirementManifest, composed: applied.composed, documentApproval });
  assert.equal(stateEnvelope.state, "document-approved");
  assert.equal(stateEnvelope.receipts.length, 4);
});

test("upper apply loads only closed overlay and neutral preset IDs and fails on conflicts", async (t) => {
  const overlay = await json("overlays/mobile.json");
  const preset = await json("presets/function-first.json");
  const overlayText = await text("overlays/mobile.json");
  const presetText = await text("presets/function-first.json");
  const calls = [];
  const sourceLoader = async (request) => {
    calls.push(request);
    return { sourceText: request.sourceType === "overlay" ? overlayText : presetText };
  };
  const applied = await appliedBrief({ overlayIds: ["mobile"], presetId: "function-first", sourceLoader });
  assert.deepEqual(calls.map(({ sourceType, sourceId }) => [sourceType, sourceId]), [["overlay", "mobile"], ["preset", "function-first"]]);
  assert.deepEqual(applied.selection.overlayIds, ["mobile"]);
  assert.equal(applied.selection.presetId, "function-first");
  assert.equal(applied.composed.conflicts.length, 0);

  for (const raw of [
    { overlays: [overlay] },
    { preset: overlay },
    { referencePreset: preset },
  ]) await assert.rejects(() => appliedBrief(raw), /raw|closed|overlayIds|presetId/i);
  await assert.rejects(() => appliedBrief({ overlayIds: ["evil-overlay"], sourceLoader }), /unknown overlay/i);
  await assert.rejects(() => appliedBrief({ overlayIds: ["mobile", "mobile"], sourceLoader }), /duplicate overlay/i);
  await assert.rejects(() => appliedBrief({ presetId: "unknown-preset", sourceLoader }), /unknown preset/i);
  await assert.rejects(() => appliedBrief({ overlayIds: ["mobile"], sourceLoader: async () => ({ sourceText: JSON.stringify({ ...overlay, profile_id: "evil-overlay" }) }) }), /canonical.*bytes.*digest/i);
  await assert.rejects(() => appliedBrief({ presetId: "function-first", sourceLoader: async () => ({ sourceText: JSON.stringify({ ...preset, preset_id: "cinematic-narrative" }) }) }), /canonical.*bytes.*digest/i);
  await assert.rejects(() => appliedBrief({
    overlayIds: ["mobile"],
    sourceLoader: async () => ({ sourceText: JSON.stringify({ ...overlay, length_guidance: { min_words: 1, max_words: 2 } }) }),
  }), /canonical.*bytes.*digest/i);

  const pluginRoot = await mkdtemp(path.join(tmpdir(), "quality-source-plugin-"));
  t.after(() => rm(pluginRoot, { recursive: true, force: true }));
  const packagedRoot = path.join(pluginRoot, "references/shared/document-quality");
  await mkdir(path.join(packagedRoot, "profiles/studio"), { recursive: true });
  await mkdir(path.join(packagedRoot, "overlays"), { recursive: true });
  await mkdir(path.join(packagedRoot, "presets"), { recursive: true });
  const primaryText = await text("profiles/studio/game-design-brief.json");
  await writeFile(path.join(packagedRoot, "profiles/studio/game-design-brief.json"), primaryText);
  await writeFile(path.join(packagedRoot, "overlays/mobile.json"), overlayText);
  await writeFile(path.join(packagedRoot, "presets/function-first.json"), presetText);
  const packaged = await appliedBrief({
    profileLoader: undefined,
    pluginRoot,
    overlayIds: ["mobile"],
    presetId: "function-first",
  });
  assert.deepEqual(packaged.composed.provenance.overlays, ["mobile"]);

  const unsafeRoot = await mkdtemp(path.join(tmpdir(), "quality-source-symlink-"));
  t.after(() => rm(unsafeRoot, { recursive: true, force: true }));
  await mkdir(path.join(unsafeRoot, "overlays"), { recursive: true });
  await symlink(fileURLToPath(new URL("overlays/mobile.json", qualityRoot)), path.join(unsafeRoot, "overlays/mobile.json"));
  const unsafeLoader = workflow.createQualitySourceLoader({ documentQualityRoot: unsafeRoot });
  await assert.rejects(() => unsafeLoader({ sourceType: "overlay", sourceId: "mobile", purpose: "selected-overlay" }), /symlink/i);
  await assert.rejects(() => unsafeLoader({ sourceType: "overlay", sourceId: "..\/mobile", purpose: "selected-overlay" }), /invalid.*ID|normalized/i);
});

test("selection indexes are bound to exact namespace canonical data", async () => {
  const studio = await json("indexes/studio.json");
  const career = await json("indexes/career.json");
  assert.deepEqual(workflow.validateQualitySelectionIndex(studio), { ok: true, errors: [] });
  assert.deepEqual(workflow.validateQualitySelectionIndex(career), { ok: true, errors: [] });

  const mutations = [
    (() => { const value = structuredClone(studio); value.profiles.pop(); return value; })(),
    (() => { const value = structuredClone(studio); value.profiles.push(structuredClone(value.profiles[0])); value.profiles.at(-1).profile_id = "injected-profile"; return value; })(),
    (() => { const value = structuredClone(studio); value.profiles.reverse(); return value; })(),
    (() => { const value = structuredClone(studio); value.profiles[0].audiences[0] = "spoofed-audience"; return value; })(),
    (() => { const value = structuredClone(studio); value.profiles[0] = structuredClone(career.profiles[0]); return value; })(),
    (() => { const value = structuredClone(studio); value.profiles[0].profile_id = "name-spoof"; return value; })(),
    (() => { const value = structuredClone(studio); value.profiles[0] = null; return value; })(),
  ];
  for (const mutation of mutations) {
    const result = workflow.validateQualitySelectionIndex(mutation);
    assert.equal(result.ok, false);
    assert.match(result.errors.map(({ message }) => message).join("; "), /canonical|digest|count|namespace|profile/i);
    assert.throws(() => workflow.selectQualityProfiles({ selectionIndex: mutation, requests: [{ artifactId: "brief", goal: "brief", audience: ["production"], artifactType: "design-document", requestedFormat: "md" }] }), /invalid selection index/i);
  }
  await assert.rejects(() => appliedBrief({ selectionIndex: mutations[0] }), /invalid selection index/i);
});
