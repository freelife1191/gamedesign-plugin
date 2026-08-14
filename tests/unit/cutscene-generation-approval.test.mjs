import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";

import { calculateActualCost, estimateCutsceneImageCost } from "../../shared/scripts/estimate-cutscene-image-cost.mjs";
import {
  assertCutsceneHumanApproval,
  cutsceneApprovalBinding,
  issueCutsceneHumanApproval,
  requiresCutsceneReapproval,
  validateHostCutsceneApproval,
} from "../../shared/scripts/lib/cutscene-generation-approval.mjs";
import { planCutsceneVisualPreproduction } from "../../shared/scripts/plan-cutscene-visual-preproduction.mjs";
import { cutsceneDocumentSha256 } from "../../shared/scripts/validate-cutscene-visual-preproduction.mjs";

const REFERENCE_SHA = "3".repeat(64);
const digest = (value) => cutsceneDocumentSha256(value);
const promptDigest = (prompt) => createHash("sha256").update(prompt).digest("hex");

function planFixture() {
  return planCutsceneVisualPreproduction({
    cutsceneId: "cutscene-escape",
    mode: "generate-after-approval",
    beats: [{ beatId: "BEAT-01" }],
    shots: [{ shotId: "SHOT-01", beatId: "BEAT-01" }],
  }).plan;
}

function promptPackageFixture(plan = planFixture()) {
  const assetIds = plan.cutsceneWorkflow.waves.flatMap((wave) => wave.assetIds);
  const promptPackage = {
    kind: "generation-ready",
    cutsceneId: plan.cutsceneId,
    planSha256: digest(plan),
    dagSha256: digest(plan.cutsceneWorkflow.downstream),
    references: [{ assetId: assetIds[0], sha256: REFERENCE_SHA }],
    prompts: assetIds.map((assetId) => {
      const prompt = `Cutscene asset: ${assetId}`;
      return { assetId, prompt, promptSha256: promptDigest(prompt) };
    }),
  };
  return { ...promptPackage, promptPackageSha256: digest(promptPackage) };
}

function pricingSnapshotFixture(overrides = {}) {
  const snapshot = {
    provider: "openai",
    model: "gpt-image-2",
    sourceUrl: "https://openai.com/api/pricing/",
    retrievedAt: "2026-08-13T00:00:00.000Z",
    currency: "USD",
    units: { textInput: 5, cachedTextInput: 1.25, imageInput: 8, cachedImageInput: 2, imageOutput: 30 },
    ...overrides,
  };
  const { sha256, ...content } = snapshot;
  return { ...content, sha256: digest(content) };
}

function authorityFixture({ plan = planFixture(), promptPackage = promptPackageFixture(plan), pricingSnapshot = pricingSnapshotFixture(), retryReserve = 1 } = {}) {
  const estimate = estimateCutsceneImageCost({ plan, promptPackage, waveId: "style-master", pricingSnapshot, retryReserve });
  return { plan, promptPackage, pricingSnapshot, estimate };
}

const approvalEvent = () => ({ eventId: "approve-style-01", actor: "Kim", reviewer: "Kim", decidedAt: "2026-08-13T00:00:00.000Z" });
const bindingFixture = (authority = authorityFixture()) => cutsceneApprovalBinding(authority);
const issue = (authority = authorityFixture()) => {
  const binding = bindingFixture(authority);
  return { authority, binding, issued: issueCutsceneHumanApproval({ ...approvalEvent(), decision: "approved", context: binding }) };
};
const context = (binding, overrides = {}) => ({ ...approvalEvent(), now: "2026-08-13T00:01:00.000Z", ...binding, ...overrides });

test("only the approval issuer mints a live capability", async () => {
  const module = await import("../../shared/scripts/lib/cutscene-generation-approval.mjs");
  assert.equal("createLiveCutsceneApproval" in module, false);
  const { binding, issued } = issue();
  assert.throws(() => assertCutsceneHumanApproval({ receipt: issued.receipt, capability: Object.freeze(Object.create(null)), context: context(binding) }), { code: "cutscene.approval_capability_invalid", path: "/capability" });
  assert.throws(() => assertCutsceneHumanApproval({ receipt: { ...issued.receipt }, capability: issued.capability, context: context(binding) }), { code: "cutscene.approval_capability_invalid", path: "/capability" });
});

test("approval and estimate reject digest wrappers and require a closed plan plus generation-ready package", () => {
  const { pricingSnapshot } = authorityFixture();
  assert.throws(() => estimateCutsceneImageCost({ plan: { sha256: "1".repeat(64), waves: [] }, promptPackage: {}, waveId: "style-master", pricingSnapshot, retryReserve: 1 }), { code: "cutscene.plan_invalid", path: "/plan" });
  assert.throws(() => cutsceneApprovalBinding({ plan: { sha256: "1".repeat(64), waves: [] }, promptPackage: {}, pricingSnapshot, estimate: {} }), { code: "cutscene.plan_invalid", path: "/plan" });
});

test("pricing and estimate canonical digests fail closed when one content field changes under the same caller sha", () => {
  const authority = authorityFixture();
  for (const mutate of [
    (snapshot) => { snapshot.units.textInput = 6; },
    (snapshot) => { snapshot.retrievedAt = "2026-08-13T00:01:00.000Z"; },
  ]) {
    const snapshot = structuredClone(authority.pricingSnapshot);
    mutate(snapshot);
    assert.throws(() => estimateCutsceneImageCost({ plan: authority.plan, promptPackage: authority.promptPackage, waveId: "style-master", pricingSnapshot: snapshot, retryReserve: 1 }), { code: "cutscene.pricing_snapshot_invalid", path: "/pricingSnapshot/sha256" });
  }
  for (const field of ["minimumUsd", "expectedUsd", "maximumUsd"]) {
    const estimate = structuredClone(authority.estimate);
    estimate[field] = 1;
    assert.throws(() => cutsceneApprovalBinding({ ...authority, estimate }), { code: "cutscene.cost_estimate_invalid", path: "/estimate/sha256" });
  }
});

test("a stale package cannot be newly approved and bindings use actual plan/package hashes", () => {
  const authority = authorityFixture();
  const changedPlan = structuredClone(authority.plan);
  changedPlan.beats[0].beatId = "BEAT-02";
  changedPlan.shots[0].beatId = "BEAT-02";
  assert.throws(() => cutsceneApprovalBinding({ ...authority, plan: changedPlan }), { code: "cutscene.prompt_package_plan_stale", path: "/promptPackage/planSha256" });
  const binding = bindingFixture(authority);
  assert.equal(binding.planSha256, digest(authority.plan));
  assert.equal(binding.promptPackageSha256, authority.promptPackage.promptPackageSha256);
});

test("package cutscene, DAG, and reference fields must remain current after canonical resealing", () => {
  const authority = authorityFixture();
  for (const [mutate, expected] of [
    [(pkg) => { pkg.cutsceneId = "cutscene-other"; }, { code: "cutscene.prompt_package_stale", path: "/promptPackage/cutsceneId" }],
    [(pkg) => { pkg.dagSha256 = "6".repeat(64); }, { code: "cutscene.prompt_package_stale", path: "/promptPackage/dagSha256" }],
    [(pkg) => { pkg.references[0].assetId = "cutscene-escape-unknown-01"; }, { code: "cutscene.prompt_package_stale", path: "/promptPackage/references" }],
  ]) {
    const promptPackage = structuredClone(authority.promptPackage);
    mutate(promptPackage);
    promptPackage.promptPackageSha256 = digest(Object.fromEntries(Object.entries(promptPackage).filter(([key]) => key !== "promptPackageSha256")));
    assert.throws(() => cutsceneApprovalBinding({ ...authority, promptPackage }), expected);
  }
});

test("role-like actor and reviewer variants reject after NFKC normalization while named humans pass", () => {
  const binding = bindingFixture();
  for (const identity of ["OpenAI", "ＯｐｅｎＡＩ", "Kim-Agent", "reviewer.bot", "MinaModel", "SYSTEM-01"]) {
    assert.throws(() => issueCutsceneHumanApproval({ ...approvalEvent(), actor: identity, reviewer: identity, decision: "approved", context: binding }), { code: "cutscene.actor_role_like", path: "/actor" });
  }
  assert.throws(() => issueCutsceneHumanApproval({ ...approvalEvent(), reviewer: "Jae Bot", decision: "approved", context: binding }), { code: "cutscene.reviewer_role_like", path: "/reviewer" });
  assert.doesNotThrow(() => issueCutsceneHumanApproval({ ...approvalEvent(), actor: "Minji Kim", reviewer: "Minji Kim", decision: "approved", context: binding }));
});

test("binding stale paths, timestamps, and freshness boundaries remain deterministic", () => {
  const { authority, binding, issued } = issue();
  for (const [mutate, path] of [
    [(value) => ({ ...value, waveId: "reference-masters" }), "/waveId"],
    [(value) => ({ ...value, assetIds: [...value.assetIds, "cutscene-escape-style-master-style-02"] }), "/assetIds"],
    [(value) => ({ ...value, maximumApprovedUsd: 1 }), "/maximumApprovedUsd"],
    [(value) => ({ ...value, retryReserve: 2 }), "/retryReserve"],
    [(value) => ({ ...value, planSha256: "6".repeat(64) }), "/planSha256"],
    [(value) => ({ ...value, promptPackageSha256: "6".repeat(64) }), "/promptPackageSha256"],
    [(value) => ({ ...value, referenceBindings: [{ ...value.referenceBindings[0], sha256: "6".repeat(64) }] }), "/referenceBindings/0/sha256"],
    [(value) => ({ ...value, pricingSnapshotSha256: "6".repeat(64) }), "/pricingSnapshotSha256"],
    [(value) => ({ ...value, costEstimateSha256: "6".repeat(64) }), "/costEstimateSha256"],
  ]) assert.throws(() => assertCutsceneHumanApproval({ receipt: issued.receipt, capability: issued.capability, context: context(mutate(binding)) }), { code: "cutscene.approval_binding_stale", path });
  assert.throws(() => issueCutsceneHumanApproval({ ...approvalEvent(), decision: "approved", decidedAt: "2026-08-13", context: binding }), { code: "cutscene.timestamp_invalid", path: "/decidedAt" });
  assert.throws(() => assertCutsceneHumanApproval({ receipt: issued.receipt, capability: issued.capability, context: context(binding, { now: "2026-08-13" }) }), { code: "cutscene.timestamp_invalid", path: "/now" });
  assert.throws(() => assertCutsceneHumanApproval({ receipt: issued.receipt, capability: issued.capability, context: context(binding, { now: "2026-08-13T00:15:00.001Z" }) }), { code: "cutscene.approval_receipt_stale", path: "/decidedAt" });
  assert.equal(assertCutsceneHumanApproval({ receipt: issued.receipt, capability: issued.capability, context: context(binding, { now: "2026-08-13T00:15:00.000Z" }) }), issued.receipt);
  assert.equal(requiresCutsceneReapproval({ receipt: issued.receipt, ...authority }), false);
});

test("host wrapper derives its exact wave path from the validated current plan and has a strict pricing boundary", () => {
  const authority = authorityFixture({ pricingSnapshot: pricingSnapshotFixture({ retrievedAt: "2026-08-12T00:00:00.000Z" }) });
  const { issued } = issue(authority);
  assert.throws(() => validateHostCutsceneApproval({ ...authority, receipt: undefined, capability: undefined, approvalEvent: approvalEvent(), now: "2026-08-13T00:00:00.000Z" }), { code: "cutscene.approval_required", path: "/cutsceneWorkflow/waves/0/approval" });
  assert.equal(validateHostCutsceneApproval({ ...authority, receipt: issued.receipt, capability: issued.capability, approvalEvent: approvalEvent(), now: "2026-08-13T00:00:00.000Z" }), issued.receipt);
  assert.throws(() => validateHostCutsceneApproval({ ...authority, receipt: issued.receipt, capability: issued.capability, approvalEvent: approvalEvent(), now: "2026-08-13T00:00:00.001Z" }), { code: "cutscene.pricing_snapshot_stale", path: "/retrievedAt" });
  const invalidTimestamp = structuredClone(authority.pricingSnapshot);
  invalidTimestamp.retrievedAt = "2026-08-12";
  assert.throws(() => estimateCutsceneImageCost({ plan: authority.plan, promptPackage: authority.promptPackage, waveId: "style-master", pricingSnapshot: invalidTimestamp, retryReserve: 1 }), { code: "cutscene.timestamp_invalid", path: "/retrievedAt" });
});

test("actual cost never invents cached usage", () => {
  const pricingSnapshot = pricingSnapshotFixture();
  const usage = { inputTokens: 10, inputTextTokens: 6, inputImageTokens: 4, outputTokens: 8, totalTokens: 18 };
  assert.deepEqual(calculateActualCost({ pricingSnapshot, usage }), { status: "unavailable", reason: "cached-token-breakdown-unavailable" });
});
