import assert from "node:assert/strict";
import { test } from "node:test";

import {
  calculateActualCost,
  estimateCutsceneImageCost,
} from "../../shared/scripts/estimate-cutscene-image-cost.mjs";
import {
  assertCutsceneHumanApproval,
  cutsceneApprovalBinding,
  issueCutsceneHumanApproval,
  requiresCutsceneReapproval,
  validateHostCutsceneApproval,
} from "../../shared/scripts/lib/cutscene-generation-approval.mjs";
import { validateCutsceneGenerationUsage } from "../../shared/scripts/validate-cutscene-visual-preproduction.mjs";

const PLAN_SHA = "1".repeat(64);
const PROMPT_SHA = "2".repeat(64);
const REFERENCE_SHA = "3".repeat(64);
const PRICE_SHA = "4".repeat(64);
const ESTIMATE_SHA = "5".repeat(64);
const ASSET_ID = "cutscene-escape-style-master-style-01";

const planFixture = () => ({
  sha256: PLAN_SHA,
  promptPackageSha256: PROMPT_SHA,
  referenceBindings: [{ assetId: ASSET_ID, sha256: REFERENCE_SHA }],
  waves: [{ id: "style-master", assetIds: [ASSET_ID] }],
});
const pricingSnapshotFixture = () => ({
  provider: "openai",
  model: "gpt-image-2",
  sourceUrl: "https://openai.com/api/pricing/",
  retrievedAt: "2026-08-13T00:00:00.000Z",
  currency: "USD",
  sha256: PRICE_SHA,
  units: { textInput: 5, cachedTextInput: 1.25, imageInput: 8, cachedImageInput: 2, imageOutput: 30 },
});
const estimateFixture = () => ({
  sha256: ESTIMATE_SHA,
  waveId: "style-master",
  assetIds: [ASSET_ID],
  planSha256: PLAN_SHA,
  pricingSnapshotSha256: PRICE_SHA,
  retryReserve: 1,
  minimumUsd: 0.25,
  expectedUsd: 0.75,
  maximumUsd: 1.25,
});
const approvalEvent = () => ({ eventId: "approve-style-01", actor: "Kim", reviewer: "Kim", decidedAt: "2026-08-13T00:00:00.000Z" });
const approvalBinding = ({ plan = planFixture(), pricingSnapshot = pricingSnapshotFixture(), estimate = estimateFixture() } = {}) => cutsceneApprovalBinding({ plan, pricingSnapshot, estimate });
const assertionContext = ({ binding = approvalBinding(), event = approvalEvent(), now = "2026-08-13T00:01:00.000Z" } = {}) => ({ ...event, now, ...binding });
const approvalRequest = (context = approvalBinding(), event = approvalEvent()) => ({ ...event, decision: "approved", context });
const expectedUsageUsd = (snapshot, usage) => ((usage.inputTextTokens - usage.cachedTextTokens) * snapshot.units.textInput
  + usage.cachedTextTokens * snapshot.units.cachedTextInput
  + (usage.inputImageTokens - usage.cachedImageTokens) * snapshot.units.imageInput
  + usage.cachedImageTokens * snapshot.units.cachedImageInput
  + usage.outputTokens * snapshot.units.imageOutput) / 1_000_000;

test("reconstructed receipt, cloned capability, role-like reviewer, and mismatched actor fail closed", () => {
  const binding = approvalBinding();
  const issued = issueCutsceneHumanApproval(approvalRequest(binding));
  assert.throws(() => assertCutsceneHumanApproval({ receipt: { ...issued.receipt }, capability: issued.capability, context: assertionContext({ binding }) }), { code: "cutscene.approval_capability_invalid", path: "/capability" });
  assert.throws(() => assertCutsceneHumanApproval({ receipt: issued.receipt, capability: { ...issued.capability }, context: assertionContext({ binding }) }), { code: "cutscene.approval_capability_invalid", path: "/capability" });
  assert.throws(() => issueCutsceneHumanApproval({ ...approvalRequest(binding), actor: "image agent", reviewer: "image agent" }), { code: "cutscene.reviewer_role_like", path: "/reviewer" });
  assert.throws(() => issueCutsceneHumanApproval({ ...approvalRequest(binding), actor: "Lee" }), { code: "cutscene.approval_actor_mismatch", path: "/actor" });
});

test("usage validity, cache completeness, and arithmetic use the supplied snapshot only", () => {
  assert.deepEqual(validateCutsceneGenerationUsage({ assetId: ASSET_ID, inputTokens: 8, inputTextTokens: 3, inputImageTokens: 4, outputTokens: 4, totalTokens: 12 }).errors.at(-1), { code: "cutscene.usage_input_mismatch", path: "/inputTokens" });
  assert.deepEqual(calculateActualCost({ pricingSnapshot: pricingSnapshotFixture(), usage: { inputTokens: 8, outputTokens: 4, totalTokens: 12, inputTextTokens: 3, inputImageTokens: 5 } }), { status: "unavailable", reason: "cached-token-breakdown-unavailable" });
  assert.deepEqual(calculateActualCost({ pricingSnapshot: { status: "unavailable", sha256: PRICE_SHA }, usage: { inputTokens: 10, inputTextTokens: 6, inputImageTokens: 4, cachedTextTokens: 2, cachedImageTokens: 1, outputTokens: 8, totalTokens: 18 } }), { status: "unavailable", reason: "pricing-snapshot-unavailable" });
  const usage = { inputTokens: 10, inputTextTokens: 6, inputImageTokens: 4, cachedTextTokens: 2, cachedImageTokens: 1, outputTokens: 8, totalTokens: 18 };
  assert.deepEqual(calculateActualCost({ pricingSnapshot: pricingSnapshotFixture(), usage }), { status: "known", usd: expectedUsageUsd(pricingSnapshotFixture(), usage) });
  assert.throws(() => calculateActualCost({ pricingSnapshot: pricingSnapshotFixture(), usage: { ...usage, inputTokens: 9 } }), { code: "cutscene.usage_input_mismatch", path: "/inputTokens" });
});

test("estimate is deterministic, wave-specific, and has no mutable price fallback", () => {
  const first = estimateCutsceneImageCost({ plan: planFixture(), waveId: "style-master", pricingSnapshot: pricingSnapshotFixture(), retryReserve: 2 });
  const second = estimateCutsceneImageCost({ plan: planFixture(), waveId: "style-master", pricingSnapshot: pricingSnapshotFixture(), retryReserve: 2 });
  assert.equal(first.sha256, second.sha256);
  assert.equal(first.planSha256, PLAN_SHA);
  assert.equal(first.pricingSnapshotSha256, PRICE_SHA);
  assert.deepEqual(first.assetIds, [ASSET_ID]);
  assert.equal(first.maximumUsd, 0);
  assert.throws(() => estimateCutsceneImageCost({ plan: planFixture(), waveId: "keyframes", pricingSnapshot: pricingSnapshotFixture(), retryReserve: 0 }), { code: "cutscene.wave_unknown", path: "/waveId" });
});

test("the exact issued pair rejects every stale binding at its literal path", () => {
  const binding = approvalBinding();
  const issued = issueCutsceneHumanApproval(approvalRequest(binding));
  for (const [mutateCurrent, path] of [
    [(current) => ({ ...current, waveId: "reference-masters" }), "/waveId"],
    [(current) => ({ ...current, assetIds: [...current.assetIds, "cutscene-escape-style-master-style-02"] }), "/assetIds"],
    [(current) => ({ ...current, maximumApprovedUsd: 1.26 }), "/maximumApprovedUsd"],
    [(current) => ({ ...current, retryReserve: 2 }), "/retryReserve"],
    [(current) => ({ ...current, planSha256: "6".repeat(64) }), "/planSha256"],
    [(current) => ({ ...current, promptPackageSha256: "6".repeat(64) }), "/promptPackageSha256"],
    [(current) => ({ ...current, referenceBindings: [{ assetId: ASSET_ID, sha256: "0".repeat(64) }] }), "/referenceBindings/0/sha256"],
    [(current) => ({ ...current, pricingSnapshotSha256: "0".repeat(64) }), "/pricingSnapshotSha256"],
    [(current) => ({ ...current, costEstimateSha256: "6".repeat(64) }), "/costEstimateSha256"],
  ]) assert.throws(() => assertCutsceneHumanApproval({ receipt: issued.receipt, capability: issued.capability, context: assertionContext({ binding: mutateCurrent(binding) }) }), { code: "cutscene.approval_binding_stale", path });
});

test("identity, ordering, and clock boundaries have deterministic failures", () => {
  const binding = approvalBinding();
  const issued = issueCutsceneHumanApproval(approvalRequest(binding));
  for (const [context, expected] of [
    [{ ...assertionContext({ binding }), eventId: "approve-style-02" }, { code: "cutscene.approval_event_mismatch", path: "/eventId" }],
    [{ ...assertionContext({ binding }), actor: "Lee" }, { code: "cutscene.approval_actor_mismatch", path: "/actor" }],
    [{ ...assertionContext({ binding }), reviewer: "Lee" }, { code: "cutscene.approval_reviewer_mismatch", path: "/reviewer" }],
    [{ ...assertionContext({ binding }), decidedAt: "2026-08-13T00:00:01.000Z" }, { code: "cutscene.approval_event_mismatch", path: "/decidedAt" }],
    [assertionContext({ binding, now: "2026-08-13T00:15:00.000Z" }), undefined],
    [assertionContext({ binding, now: "2026-08-13T00:15:00.001Z" }), { code: "cutscene.approval_receipt_stale", path: "/decidedAt" }],
  ]) {
    if (expected) assert.throws(() => assertCutsceneHumanApproval({ receipt: issued.receipt, capability: issued.capability, context }), expected);
    else assert.equal(assertCutsceneHumanApproval({ receipt: issued.receipt, capability: issued.capability, context }), issued.receipt);
  }
  assert.throws(() => issueCutsceneHumanApproval(approvalRequest({ ...binding, assetIds: ["cutscene-escape-style-master-style-02", ASSET_ID] })), { code: "cutscene.ids_unsorted_or_duplicate", path: "/assetIds" });
});

test("host validation checks current authority before a 24-hour snapshot boundary", () => {
  const pricingSnapshot = { ...pricingSnapshotFixture(), retrievedAt: "2026-08-12T00:00:00.000Z" };
  const binding = approvalBinding({ pricingSnapshot });
  const issued = issueCutsceneHumanApproval(approvalRequest(binding));
  assert.equal(validateHostCutsceneApproval({ receipt: issued.receipt, capability: issued.capability, approvalEvent: approvalEvent(), plan: planFixture(), pricingSnapshot, estimate: estimateFixture(), now: "2026-08-13T00:00:00.000Z" }), issued.receipt);
  assert.throws(() => validateHostCutsceneApproval({ receipt: issued.receipt, capability: issued.capability, approvalEvent: approvalEvent(), plan: planFixture(), pricingSnapshot, estimate: estimateFixture(), now: "2026-08-13T00:00:00.001Z" }), { code: "cutscene.pricing_snapshot_stale", path: "/retrievedAt" });
  assert.equal(requiresCutsceneReapproval({ receipt: issued.receipt, plan: planFixture(), pricingSnapshot: pricingSnapshotFixture(), estimate: estimateFixture() }), false);
  assert.equal(requiresCutsceneReapproval({ receipt: issued.receipt, plan: planFixture(), pricingSnapshot: pricingSnapshotFixture(), estimate: { ...estimateFixture(), retryReserve: 2 } }), true);
});

test("a wave wrapper maps a completely missing live pair to that wave approval path", () => {
  assert.throws(() => validateHostCutsceneApproval({
    receipt: undefined,
    capability: undefined,
    approvalEvent: approvalEvent(),
    plan: planFixture(),
    pricingSnapshot: pricingSnapshotFixture(),
    estimate: estimateFixture(),
    now: "2026-08-13T00:01:00.000Z",
  }), { code: "cutscene.approval_required", path: "/cutsceneWorkflow/waves/0/approval" });
});
