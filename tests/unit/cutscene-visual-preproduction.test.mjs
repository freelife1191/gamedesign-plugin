import assert from "node:assert/strict";
import { test } from "node:test";

import {
  canonicalCutsceneDocument,
  cutsceneDocumentSha256,
  deriveCutsceneLifecycle,
  validateCutsceneContinuityReview,
  validateCutsceneCostEstimate,
  validateCutsceneGenerationApproval,
  validateCutsceneGenerationUsage,
  validateCutsceneVisualPlan,
} from "../../shared/scripts/validate-cutscene-visual-preproduction.mjs";

const SHA = "a".repeat(64);
const WAVES = ["style-master", "reference-masters", "keyframes", "storyboard"];

const validCutscenePlan = () => ({
  schemaVersion: 1,
  cutsceneId: "cutscene-escape",
  mode: "prompt-only",
  beats: [{ beatId: "BEAT-01" }],
  shots: [{ shotId: "SHOT-01", beatId: "BEAT-01" }],
  cutsceneWorkflow: {
    schemaVersion: 1,
    waves: WAVES.map((id, index) => ({
      id,
      state: index === 0 ? "template-ready" : "planned",
      assetIds: [`cutscene-escape-${id}-01`],
      estimate: null,
      approval: null,
      attempts: [],
      completion: null,
      invalidation: null,
    })),
    downstream: [],
    derived: {},
  },
});

const validEstimate = () => ({
  schemaVersion: 1,
  sha256: SHA,
  waveId: "style-master",
  assetIds: ["cutscene-escape-style-master-01"],
  planSha256: SHA,
  pricingSnapshotSha256: SHA,
  retryReserve: 1,
  minimumUsd: 0.25,
  expectedUsd: 0.5,
  maximumUsd: 0.75,
});

const validApproval = () => ({
  schemaVersion: 1,
  eventId: "approve-style-01",
  actor: "Kim",
  reviewer: "Kim",
  decision: "approved",
  decidedAt: "2026-08-13T00:00:00.000Z",
  waveId: "style-master",
  assetIds: ["cutscene-escape-style-master-01"],
  maximumApprovedUsd: 0.75,
  retryReserve: 1,
  planSha256: SHA,
  promptPackageSha256: SHA,
  referenceBindings: [{ assetId: "cutscene-escape-style-master-01", sha256: SHA }],
  pricingSnapshotSha256: SHA,
  costEstimateSha256: SHA,
});

const validUsage = () => ({
  schemaVersion: 1,
  waveId: "style-master",
  assetId: "cutscene-escape-style-master-01",
  attemptId: "attempt-01",
  providerRequestId: "request-01",
  inputTokens: 10,
  inputTextTokens: 6,
  inputImageTokens: 4,
  cachedTextTokens: 1,
  cachedImageTokens: 2,
  outputTokens: 8,
  totalTokens: 18,
});

const validContinuityReview = () => ({
  schemaVersion: 1,
  cutsceneId: "cutscene-escape",
  planSha256: SHA,
  reviewedAt: "2026-08-13T00:00:00.000Z",
  findings: [],
  blockingFindingIds: [],
});

function firstError(result) {
  return result.errors[0];
}

test("four waves own authority and root state is derived", () => {
  const plan = validCutscenePlan();
  assert.deepEqual(plan.cutsceneWorkflow.waves.map(({ id }) => id), WAVES);
  plan.state = "generation-approved";
  assert.deepEqual(firstError(validateCutsceneVisualPlan(plan)), { code: "cutscene.root_state_forbidden", path: "/state" });
  const wave = validCutscenePlan();
  delete wave.cutsceneWorkflow.waves[0].state;
  assert.deepEqual(firstError(validateCutsceneVisualPlan(wave)), { code: "cutscene.wave_state_required", path: "/cutsceneWorkflow/waves/0/state" });
});

test("plan validation rejects open root and wave shapes, a manifest asset mode, and incorrect wave order", () => {
  const openRoot = validCutscenePlan();
  openRoot.unrelated = true;
  assert.deepEqual(firstError(validateCutsceneVisualPlan(openRoot)), { code: "cutscene.unknown_key", path: "/unrelated" });
  const openWave = validCutscenePlan();
  openWave.cutsceneWorkflow.waves[0].unexpected = true;
  assert.deepEqual(firstError(validateCutsceneVisualPlan(openWave)), { code: "cutscene.wave_unknown_key", path: "/cutsceneWorkflow/waves/0/unexpected" });
  const assetMode = validCutscenePlan();
  assetMode.assets = [{ assetId: "cutscene-escape-style-master-01", mode: "prompt-only" }];
  assert.deepEqual(firstError(validateCutsceneVisualPlan(assetMode)), { code: "cutscene.manifest_asset_mode_forbidden", path: "/assets/0/mode" });
  const wrongOrder = validCutscenePlan();
  [wrongOrder.cutsceneWorkflow.waves[0], wrongOrder.cutsceneWorkflow.waves[1]] = [wrongOrder.cutsceneWorkflow.waves[1], wrongOrder.cutsceneWorkflow.waves[0]];
  assert.deepEqual(firstError(validateCutsceneVisualPlan(wrongOrder)), { code: "cutscene.wave_order_invalid", path: "/cutsceneWorkflow/waves/0/id" });
});

test("plan validation requires nonempty sorted unique IDs and a valid forward DAG", () => {
  const empty = validCutscenePlan();
  empty.cutsceneWorkflow.waves[0].assetIds = [];
  assert.deepEqual(firstError(validateCutsceneVisualPlan(empty)), { code: "cutscene.wave_asset_ids_empty", path: "/cutsceneWorkflow/waves/0/assetIds" });
  const duplicate = validCutscenePlan();
  duplicate.cutsceneWorkflow.waves[0].assetIds = ["cutscene-escape-style-master-02", "cutscene-escape-style-master-01", "cutscene-escape-style-master-01"];
  assert.deepEqual(firstError(validateCutsceneVisualPlan(duplicate)), { code: "cutscene.ids_unsorted_or_duplicate", path: "/cutsceneWorkflow/waves/0/assetIds" });
  const dangling = validCutscenePlan();
  dangling.cutsceneWorkflow.downstream = [{ fromWaveId: "style-master", toWaveId: "missing" }];
  assert.deepEqual(firstError(validateCutsceneVisualPlan(dangling)), { code: "cutscene.dag_reference_unknown", path: "/cutsceneWorkflow/downstream/0/toWaveId" });
  const backward = validCutscenePlan();
  backward.cutsceneWorkflow.downstream = [{ fromWaveId: "keyframes", toWaveId: "reference-masters" }];
  assert.deepEqual(firstError(validateCutsceneVisualPlan(backward)), { code: "cutscene.dag_not_forward", path: "/cutsceneWorkflow/downstream/0/toWaveId" });
});

test("prompt bindings distinguish templates without hashes from generation-ready current hashes", () => {
  const template = validCutscenePlan();
  template.cutsceneWorkflow.waves[0].completion = { kind: "template-ready", references: [{ assetId: "cutscene-escape-reference-01", expectedPath: "assets/generated/reference-01.png" }] };
  assert.equal(validateCutsceneVisualPlan(template).ok, true);
  const invented = structuredClone(template);
  invented.cutsceneWorkflow.waves[0].completion.references[0].sha256 = SHA;
  assert.deepEqual(firstError(validateCutsceneVisualPlan(invented)), { code: "cutscene.template_hash_forbidden", path: "/cutsceneWorkflow/waves/0/completion/references/0/sha256" });
  const bound = validCutscenePlan();
  bound.cutsceneWorkflow.waves[0].state = "generation-ready";
  bound.cutsceneWorkflow.waves[0].completion = { kind: "generation-ready", references: [{ assetId: "cutscene-escape-reference-01", sha256: SHA }] };
  assert.equal(validateCutsceneVisualPlan(bound).ok, true);
  delete bound.cutsceneWorkflow.waves[0].completion.references[0].sha256;
  assert.deepEqual(firstError(validateCutsceneVisualPlan(bound)), { code: "cutscene.bound_hash_required", path: "/cutsceneWorkflow/waves/0/completion/references/0/sha256" });
});

test("five closed document contracts reject malformed derived binding and usage data", () => {
  assert.equal(validateCutsceneCostEstimate(validEstimate()).ok, true);
  const estimate = validEstimate(); estimate.maximumUsd = 0.1;
  assert.deepEqual(firstError(validateCutsceneCostEstimate(estimate)), { code: "cutscene.cost_range_invalid", path: "/maximumUsd" });
  assert.equal(validateCutsceneGenerationApproval(validApproval()).ok, true);
  const approval = validApproval(); approval.referenceBindings = [];
  assert.deepEqual(firstError(validateCutsceneGenerationApproval(approval)), { code: "cutscene.reference_bindings_empty", path: "/referenceBindings" });
  assert.equal(validateCutsceneGenerationUsage(validUsage()).ok, true);
  const usage = validUsage(); usage.inputTokens = 9;
  assert.deepEqual(firstError(validateCutsceneGenerationUsage(usage)), { code: "cutscene.usage_input_mismatch", path: "/inputTokens" });
  assert.equal(validateCutsceneContinuityReview(validContinuityReview()).ok, true);
  const review = validContinuityReview(); review.blockingFindingIds = ["missing-finding"];
  assert.deepEqual(firstError(validateCutsceneContinuityReview(review)), { code: "cutscene.blocker_finding_unknown", path: "/blockingFindingIds/0" });
});

test("canonical cutscene documents are deterministic and reject non-plain hidden state", () => {
  assert.equal(canonicalCutsceneDocument({ b: 1, a: [true, null] }), '{"a":[true,null],"b":1}');
  assert.equal(cutsceneDocumentSha256({ b: 1, a: [true, null] }), cutsceneDocumentSha256({ a: [true, null], b: 1 }));
  const withHiddenState = { value: "safe" };
  Object.defineProperty(withHiddenState, "hidden", { value: "not canonical" });
  assert.throws(() => canonicalCutsceneDocument(withHiddenState));
});

test("derived root approval uses existing asset lifecycle, current receipt, and blockers only", () => {
  const candidate = {
    manifest: { assets: [{ approval_state: "production-candidate" }] },
    waves: [{ id: "storyboard", state: "completed" }],
    continuityReceipt: { current: true, blockingFindingIds: [] },
  };
  assert.deepEqual(deriveCutsceneLifecycle(candidate), {
    lifecycle: "completed",
    documentApproved: true,
    productionCandidate: true,
    blockerIds: [],
  });
  const blocked = structuredClone(candidate);
  blocked.continuityReceipt.blockingFindingIds = ["screen-direction"];
  assert.deepEqual(deriveCutsceneLifecycle(blocked), {
    lifecycle: "blocked",
    documentApproved: false,
    productionCandidate: false,
    blockerIds: ["screen-direction"],
  });
  const noReceipt = structuredClone(candidate);
  noReceipt.continuityReceipt.current = false;
  assert.deepEqual(deriveCutsceneLifecycle(noReceipt), {
    lifecycle: "completed",
    documentApproved: false,
    productionCandidate: false,
    blockerIds: [],
  });
});
