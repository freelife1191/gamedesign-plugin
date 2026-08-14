import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { deflateSync } from "node:zlib";

import { calculateActualCost, estimateCutsceneImageCost } from "../../shared/scripts/estimate-cutscene-image-cost.mjs";
import {
  assertCutsceneHumanApproval,
  cutsceneApprovalBinding,
  issueCutsceneHumanApproval,
  requiresCutsceneReapproval,
  validateHostCutsceneApproval,
} from "../../shared/scripts/lib/cutscene-generation-approval.mjs";
import { bindCutscenePromptPackage, planCutsceneVisualPreproduction } from "../../shared/scripts/plan-cutscene-visual-preproduction.mjs";
import { cutsceneDocumentSha256 } from "../../shared/scripts/validate-cutscene-visual-preproduction.mjs";
import { runApprovedCutsceneImageWave } from "../../shared/scripts/run-approved-cutscene-image-stage.mjs";

const REFERENCE_SHA = "3".repeat(64);
const TASK2_MASTER_SOURCE_IDS = [
  "cutscene-escape-style-master-style-01",
  "cutscene-escape-reference-master-environment-01",
];
const TASK3_CANONICAL_RECEIPT_IDS = [
  "cutscene-escape-reference-master-environment-01",
  "cutscene-escape-style-master-style-01",
];
const digest = (value) => cutsceneDocumentSha256(value);
const promptDigest = (prompt) => createHash("sha256").update(prompt).digest("hex");

function assertReceiptMutationRejected(receipt, mutate) {
  const bytes = JSON.stringify(receipt);
  assert.throws(mutate, TypeError);
  assert.equal(JSON.stringify(receipt), bytes);
}

function validPng() {
  const crc32 = (bytes) => {
    let crc = 0xffffffff;
    for (const byte of bytes) { crc ^= byte; for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); }
    return (crc ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const bytes = Buffer.alloc(12 + data.length);
    bytes.writeUInt32BE(data.length); bytes.write(type, 4, "ascii"); data.copy(bytes, 8); bytes.writeUInt32BE(crc32(bytes.subarray(4, 8 + data.length)), 8 + data.length);
    return bytes;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(1); header.writeUInt32BE(1, 4); header.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", header), chunk("IDAT", deflateSync(Buffer.alloc(5))), chunk("IEND", Buffer.alloc(0))]);
}

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
    // Task 2 preserves manifest order (style then reference), which is not UTF-8 order.
    references: [{ assetId: assetIds[0], sha256: REFERENCE_SHA }, { assetId: assetIds[1], sha256: "4".repeat(64) }],
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
  return { authority, binding, issued: issueCutsceneHumanApproval({ ...approvalEvent(), decision: "approved", ...authority }) };
};
const context = (binding, overrides = {}) => ({ ...approvalEvent(), now: "2026-08-13T00:01:00.000Z", ...binding, ...overrides });

test("only the approval issuer mints a live capability", async () => {
  const module = await import("../../shared/scripts/lib/cutscene-generation-approval.mjs");
  assert.equal("createLiveCutsceneApproval" in module, false);
  const { binding, issued } = issue();
  assert.throws(() => assertCutsceneHumanApproval({ receipt: issued.receipt, capability: Object.freeze(Object.create(null)), context: context(binding) }), { code: "cutscene.approval_capability_invalid", path: "/capability" });
  assert.throws(() => assertCutsceneHumanApproval({ receipt: { ...issued.receipt }, capability: issued.capability, context: context(binding) }), { code: "cutscene.approval_capability_invalid", path: "/capability" });
});

test("issuance rejects caller hash context and invalid current authority before minting a pair", () => {
  const authority = authorityFixture();
  const forgedContext = { waveId: "style-master", assetIds: ["forged"], maximumApprovedUsd: 0, retryReserve: 0, planSha256: "0".repeat(64), promptPackageSha256: "0".repeat(64), referenceBindings: [{ assetId: "forged", sha256: "0".repeat(64) }], pricingSnapshotSha256: "0".repeat(64), costEstimateSha256: "0".repeat(64) };
  assert.throws(() => issueCutsceneHumanApproval({ ...approvalEvent(), decision: "approved", ...authority, context: forgedContext }), { code: "cutscene.approval_context_forbidden", path: "/context" });
  const invalidPlan = { ...authority, plan: { sha256: "0".repeat(64), waves: [] } };
  assert.throws(() => issueCutsceneHumanApproval({ ...approvalEvent(), decision: "approved", ...invalidPlan }), { code: "cutscene.plan_invalid", path: "/plan" });
  assert.throws(() => issueCutsceneHumanApproval({ ...approvalEvent(), decision: "approved", ...authority, pricingSnapshot: { ...authority.pricingSnapshot, sha256: "0".repeat(64) } }), { code: "cutscene.pricing_snapshot_invalid", path: "/pricingSnapshot/sha256" });
  assert.throws(() => issueCutsceneHumanApproval({ ...approvalEvent(), decision: "approved", ...authority, estimate: { ...authority.estimate, sha256: "0".repeat(64) } }), { code: "cutscene.cost_estimate_invalid", path: "/estimate/sha256" });
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

test("role-like actor and reviewer variants reject after NFKC normalization while real names pass", () => {
  const authority = authorityFixture();
  for (const identity of ["OpenAI", "ＯｐｅｎＡＩ", "Kim-Agent", "reviewer.bot", "MinaModel", "SYSTEM-01"]) {
    assert.throws(() => issueCutsceneHumanApproval({ ...approvalEvent(), actor: identity, reviewer: identity, decision: "approved", ...authority }), { code: "cutscene.actor_role_like", path: "/actor" });
  }
  for (const name of ["Kai", "Mai", "Mihai", "Minji Kim"]) assert.doesNotThrow(() => issueCutsceneHumanApproval({ ...approvalEvent(), actor: name, reviewer: name, decision: "approved", ...authority }));
  assert.throws(() => issueCutsceneHumanApproval({ ...approvalEvent(), reviewer: "Jae Bot", decision: "approved", ...authority }), { code: "cutscene.reviewer_role_like", path: "/reviewer" });
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
    [(value) => ({ ...value, referenceBindings: [{ ...value.referenceBindings[0], sha256: "6".repeat(64) }, value.referenceBindings[1]] }), "/referenceBindings/0/sha256"],
    [(value) => ({ ...value, pricingSnapshotSha256: "6".repeat(64) }), "/pricingSnapshotSha256"],
    [(value) => ({ ...value, costEstimateSha256: "6".repeat(64) }), "/costEstimateSha256"],
  ]) assert.throws(() => assertCutsceneHumanApproval({ receipt: issued.receipt, capability: issued.capability, context: context(mutate(binding)) }), { code: "cutscene.approval_binding_stale", path });
  assert.throws(() => issueCutsceneHumanApproval({ ...approvalEvent(), decision: "approved", decidedAt: "2026-08-13", ...authority }), { code: "cutscene.timestamp_invalid", path: "/decidedAt" });
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

test("non-generation modes reject before authority, provider dispatch, or artifact writes", async (t) => {
  const artifactRoot = await mkdtemp(path.join(tmpdir(), "cutscene-mode-"));
  t.after(() => rm(artifactRoot, { recursive: true, force: true }));
  const authority = authorityFixture();
  const issued = issueCutsceneHumanApproval({ ...approvalEvent(), decision: "approved", ...authority });
  let calls = 0;
  const plan = structuredClone(authority.plan);
  plan.mode = "prompt-only";
  await assert.rejects(() => runApprovedCutsceneImageWave({
    artifactRoot, waveId: "style-master", selectedAssetIds: authority.estimate.assetIds, attemptState: { failedAttempts: 0, accumulatedUsd: 0 },
    plan, promptPackage: authority.promptPackage, manifest: planCutsceneVisualPreproduction({ cutsceneId: "cutscene-escape", mode: "prompt-only", beats: [{ beatId: "BEAT-01" }], shots: [{ shotId: "SHOT-01", beatId: "BEAT-01" }] }).manifest,
    pricingSnapshot: authority.pricingSnapshot, estimate: authority.estimate, approvalEvent: approvalEvent(), receipt: issued.receipt, capability: issued.capability,
    now: "2026-08-13T00:01:00.000Z", env: {}, fetchFn: async () => { calls += 1; throw new Error("must not fetch"); },
  }), { code: "cutscene.mode_generation_forbidden", path: "/mode" });
  assert.equal(calls, 0);
  assert.deepEqual(await (await import("node:fs/promises")).readdir(artifactRoot), []);
});

test("a two-reference Task 2 package issues and validates with an internally canonical receipt binding", () => {
  const { authority, binding, issued } = issue();
  assert.equal(authority.promptPackage.references[0].assetId > authority.promptPackage.references[1].assetId, true);
  assert.deepEqual(issued.receipt.referenceBindings.map(({ assetId }) => assetId), [...binding.referenceBindings].map(({ assetId }) => assetId).sort());
  assert.equal(assertCutsceneHumanApproval({ receipt: issued.receipt, capability: issued.capability, context: context(binding) }), issued.receipt);
});

test("Task 2 bound package with two generated masters issues a canonical live approval", async (t) => {
  const artifactRoot = await mkdtemp(path.join(tmpdir(), "cutscene-task3-integration-"));
  t.after(() => rm(artifactRoot, { recursive: true, force: true }));
  const planned = planCutsceneVisualPreproduction({
    cutsceneId: "cutscene-escape",
    mode: "generate-after-approval",
    beats: [{ beatId: "BEAT-01" }],
    shots: [{ shotId: "SHOT-01", beatId: "BEAT-01" }],
  });
  const manifest = structuredClone(planned.manifest);
  const sourceMasters = manifest.assets.slice(0, TASK2_MASTER_SOURCE_IDS.length);
  assert.deepEqual(sourceMasters.map(({ asset_id: assetId }) => assetId), TASK2_MASTER_SOURCE_IDS);
  assert.notDeepEqual(TASK2_MASTER_SOURCE_IDS, TASK3_CANONICAL_RECEIPT_IDS);
  for (const asset of sourceMasters) {
    asset.generation_state = "generated";
    const outputPath = path.join(artifactRoot, asset.output.path);
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, validPng());
  }
  const promptPackage = await bindCutscenePromptPackage({ artifactRoot, plan: planned.plan, manifest });
  const pricingSnapshot = pricingSnapshotFixture();
  const estimate = estimateCutsceneImageCost({ plan: planned.plan, promptPackage, waveId: "reference-masters", pricingSnapshot, retryReserve: 1 });
  const event = approvalEvent();
  const issued = issueCutsceneHumanApproval({ ...event, decision: "approved", plan: planned.plan, promptPackage, pricingSnapshot, estimate });
  const binding = cutsceneApprovalBinding({ plan: planned.plan, promptPackage, pricingSnapshot, estimate });
  assert.equal(promptPackage.references.length, 2);
  assert.deepEqual(promptPackage.references.map(({ assetId }) => assetId), TASK2_MASTER_SOURCE_IDS);
  assert.deepEqual(issued.receipt.referenceBindings, [...binding.referenceBindings]);
  assert.deepEqual(issued.receipt.referenceBindings.map(({ assetId }) => assetId), TASK3_CANONICAL_RECEIPT_IDS);
  assert.notDeepEqual(promptPackage.references.map(({ assetId }) => assetId), issued.receipt.referenceBindings.map(({ assetId }) => assetId));
  assert.equal(Object.isFrozen(issued.receipt.assetIds), true);
  assert.equal(Object.isFrozen(issued.receipt.referenceBindings), true);
  assert.equal(issued.receipt.referenceBindings.every(Object.isFrozen), true);

  for (const index of issued.receipt.assetIds.keys()) {
    assertReceiptMutationRejected(issued.receipt, () => { issued.receipt.assetIds[index] = "cutscene-escape-tampered"; });
  }
  assertReceiptMutationRejected(issued.receipt, () => { issued.receipt.assetIds.push("cutscene-escape-tampered"); });
  for (const [index, reference] of issued.receipt.referenceBindings.entries()) {
    assertReceiptMutationRejected(issued.receipt, () => { reference.assetId = "cutscene-escape-tampered"; });
    assertReceiptMutationRejected(issued.receipt, () => { reference.sha256 = "0".repeat(64); });
    assertReceiptMutationRejected(issued.receipt, () => { issued.receipt.referenceBindings[index] = { assetId: "cutscene-escape-tampered", sha256: "0".repeat(64) }; });
  }
  assertReceiptMutationRejected(issued.receipt, () => { issued.receipt.referenceBindings.push({ assetId: "cutscene-escape-tampered", sha256: "0".repeat(64) }); });

  assert.equal(assertCutsceneHumanApproval({ receipt: issued.receipt, capability: issued.capability, context: context(binding) }), issued.receipt);
  assert.equal(validateHostCutsceneApproval({ receipt: issued.receipt, capability: issued.capability, approvalEvent: event, plan: planned.plan, promptPackage, pricingSnapshot, estimate, now: "2026-08-13T00:01:00.000Z" }), issued.receipt);
});
