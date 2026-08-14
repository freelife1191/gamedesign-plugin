import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
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
import { cutsceneDocumentSha256, validateCutsceneCostEstimate, validateCutsceneGenerationApproval, validateCutsceneGenerationUsage } from "../../shared/scripts/validate-cutscene-visual-preproduction.mjs";
import { retryCutsceneFailedAssets, runApprovedCutsceneImageWave } from "../../shared/scripts/run-approved-cutscene-image-stage.mjs";

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

function validPng(width = 1, height = 1) {
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
  header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", header), chunk("IDAT", deflateSync(Buffer.alloc(height * (width * 4 + 1)))), chunk("IEND", Buffer.alloc(0))]);
}

function planFixture() {
  return planCutsceneVisualPreproduction({
    cutsceneId: "cutscene-escape",
    mode: "generate-after-approval",
    beats: [{ beatId: "BEAT-01" }],
    shots: [{ shotId: "SHOT-01", beatId: "BEAT-01" }],
  }).plan;
}

function manifestFixture(plan = planFixture()) {
  return planCutsceneVisualPreproduction({
    cutsceneId: plan.cutsceneId,
    mode: plan.mode,
    beats: plan.beats,
    shots: plan.shots,
  }).manifest;
}

function promptPackageFixture(plan = planFixture()) {
  const assetIds = plan.cutsceneWorkflow.waves.flatMap((wave) => wave.assetIds);
  const manifest = manifestFixture(plan);
  const manifestById = new Map(manifest.assets.map((asset) => [asset.asset_id, asset]));
  const promptPackage = {
    kind: "generation-ready",
    cutsceneId: plan.cutsceneId,
    planSha256: digest(plan),
    dagSha256: digest(plan.cutsceneWorkflow.downstream),
    // Task 2 preserves manifest order (style then reference), which is not UTF-8 order.
    references: [{ assetId: assetIds[0], sha256: REFERENCE_SHA }, { assetId: assetIds[1], sha256: "4".repeat(64) }],
    prompts: assetIds.map((assetId) => ({ assetId, prompt: manifestById.get(assetId).prompt, promptSha256: manifestById.get(assetId).prompt_sha256 })),
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

function authorityFixture({ plan = planFixture(), manifest = manifestFixture(plan), promptPackage = promptPackageFixture(plan), pricingSnapshot = pricingSnapshotFixture(), retryReserve = 1, attemptCeilings } = {}) {
  const waveId = "style-master";
  const assetIds = plan.cutsceneWorkflow.waves.find(({ id }) => id === waveId).assetIds;
  const quotes = attemptCeilings ?? assetIds.map((assetId) => ({ assetId, maximumUsd: 0.4 }));
  const estimate = estimateCutsceneImageCost({ plan, promptPackage, manifest, waveId, pricingSnapshot, retryReserve, attemptCeilings: quotes });
  return { plan, manifest, promptPackage, pricingSnapshot, estimate };
}

const approvalEvent = () => ({ eventId: "approve-style-01", actor: "Kim", reviewer: "Kim", decidedAt: "2026-08-13T00:00:00.000Z" });
const bindingFixture = (authority = authorityFixture()) => cutsceneApprovalBinding(authority);
const issue = (authority = authorityFixture()) => {
  const binding = bindingFixture(authority);
  return { authority, binding, issued: issueCutsceneHumanApproval({ ...approvalEvent(), decision: "approved", ...authority }) };
};
const context = (binding, overrides = {}) => ({ ...approvalEvent(), now: "2026-08-13T00:01:00.000Z", ...binding, ...overrides });

function stageFixture({ waveId = "style-master", retryReserve = 1, provider = "openai", ceilings } = {}) {
  const plan = planFixture();
  const manifest = manifestFixture(plan);
  const promptPackage = promptPackageFixture(plan);
  const pricingSnapshot = pricingSnapshotFixture({ provider });
  const assetIds = [...plan.cutsceneWorkflow.waves.find(({ id }) => id === waveId).assetIds].sort();
  const attemptCeilings = assetIds.map((assetId, index) => ({ assetId, maximumUsd: ceilings?.[index] ?? 0.4 }));
  const estimate = estimateCutsceneImageCost({ plan, promptPackage, manifest, waveId, pricingSnapshot, retryReserve, attemptCeilings });
  const event = approvalEvent();
  const issued = issueCutsceneHumanApproval({ ...event, decision: "approved", plan, promptPackage, manifest, pricingSnapshot, estimate });
  return { waveId, selectedAssetIds: assetIds, plan, manifest, promptPackage, pricingSnapshot, estimate, approvalEvent: event, receipt: issued.receipt, capability: issued.capability, now: "2026-08-13T00:01:00.000Z", env: {}, apiKey: "sk-local-test", sleepFn: async () => {} };
}

async function journalRecords(artifactRoot, waveId) {
  const base = path.join(artifactRoot, "cutscene", "usage-receipts", waveId);
  const assetIds = await readdir(base);
  const records = [];
  for (const assetId of assetIds.sort()) {
    for (const name of (await readdir(path.join(base, assetId))).sort()) records.push(JSON.parse(await readFile(path.join(base, assetId, name), "utf8")));
  }
  return records.sort((left, right) => left.attemptSequence - right.attemptSequence || left.kind.localeCompare(right.kind));
}

function imageResponse({ status = 200, requestId = "req-cutscene", corrupt = false, usage } = {}) {
  const body = status >= 200 && status < 300
    ? { data: [{ b64_json: corrupt ? Buffer.from("not-png").toString("base64") : validPng(1024, 1024).toString("base64") }], usage: usage ?? { input_tokens: 8, output_tokens: 4, total_tokens: 12, input_tokens_details: { text_tokens: 3, image_tokens: 5, cached_text_tokens: 0, cached_image_tokens: 0 } } }
    : { error: { type: "server_error" } };
  const bytes = Buffer.from(JSON.stringify(body));
  return { status, headers: { get: (name) => name.toLowerCase() === "x-request-id" ? requestId : name.toLowerCase() === "content-length" ? String(bytes.length) : null }, body: { async *[Symbol.asyncIterator]() { yield bytes; } } };
}

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

test("cost estimate v2 binds heterogeneous per-asset request ceilings and exact total identity", () => {
  const plan = planFixture();
  const manifest = manifestFixture(plan);
  const promptPackage = promptPackageFixture(plan);
  const pricingSnapshot = pricingSnapshotFixture();
  const waveId = "reference-masters";
  const assetIds = plan.cutsceneWorkflow.waves.find(({ id }) => id === waveId).assetIds;
  const quotes = assetIds.map((assetId, index) => ({ assetId, maximumUsd: [0.17, 0.31, 0.23, 0.29][index] }));
  const estimate = estimateCutsceneImageCost({ plan, promptPackage, manifest, waveId, pricingSnapshot, retryReserve: 2, attemptCeilings: quotes });
  const baseline = quotes.reduce((total, quote) => total + quote.maximumUsd, 0);
  const expectedMaximum = baseline + 2 * Math.max(...quotes.map(({ maximumUsd }) => maximumUsd));

  assert.equal(estimate.schemaVersion, 2);
  assert.equal(estimate.costStatus, "available");
  assert.deepEqual(estimate.assetIds, [...assetIds].sort());
  assert.deepEqual(estimate.attemptCeilings.map(({ assetId, maximumUsd }) => ({ assetId, maximumUsd })), [...quotes].sort((left, right) => left.assetId.localeCompare(right.assetId)));
  assert.equal(estimate.minimumUsd, baseline);
  assert.equal(estimate.expectedUsd, baseline);
  assert.equal(estimate.maximumUsd, expectedMaximum);
  assert.equal(estimate.attemptCeilings.every(({ requestSha256 }) => /^[a-f0-9]{64}$/u.test(requestSha256)), true);
  assert.equal(validateCutsceneCostEstimate(estimate).ok, true);
});

test("missing or invented-zero attempt ceilings produce an unavailable v2 estimate that cannot be approved", () => {
  const plan = planFixture();
  const manifest = manifestFixture(plan);
  const promptPackage = promptPackageFixture(plan);
  const pricingSnapshot = pricingSnapshotFixture();
  for (const attemptCeilings of [undefined, [{ assetId: "cutscene-escape-style-master-style-01", maximumUsd: 0 }]]) {
    const estimate = estimateCutsceneImageCost({ plan, promptPackage, manifest, waveId: "style-master", pricingSnapshot, retryReserve: 1, attemptCeilings });
    assert.equal(estimate.schemaVersion, 2);
    assert.equal(estimate.costStatus, "unavailable");
    assert.equal(estimate.maximumUsd, null);
    assert.equal(validateCutsceneCostEstimate(estimate).ok, true);
    assert.throws(() => issueCutsceneHumanApproval({ ...approvalEvent(), decision: "approved", plan, promptPackage, pricingSnapshot, estimate }), { code: "cutscene.cost_estimate_unavailable", path: "/estimate/costStatus" });
  }
});

test("legacy v1 estimates and approvals fail closed and v2 approval binds the full estimate digest", () => {
  const authority = authorityFixture();
  const legacyEstimate = { schemaVersion: 1, sha256: "0".repeat(64), waveId: "style-master", assetIds: authority.estimate.assetIds, planSha256: authority.estimate.planSha256, pricingSnapshotSha256: authority.estimate.pricingSnapshotSha256, retryReserve: 1, minimumUsd: 0, expectedUsd: 0, maximumUsd: 0 };
  assert.throws(() => cutsceneApprovalBinding({ ...authority, estimate: legacyEstimate }), { code: "cutscene.cost_estimate_invalid", path: "/estimate/sha256" });
  const issued = issueCutsceneHumanApproval({ ...approvalEvent(), decision: "approved", ...authority });
  assert.equal(issued.receipt.schemaVersion, 2);
  assert.equal(issued.receipt.costEstimateSha256, authority.estimate.sha256);
  assert.equal(validateCutsceneGenerationApproval(issued.receipt).ok, true);
  const legacyApproval = { ...issued.receipt, schemaVersion: 1 };
  assert.throws(() => assertCutsceneHumanApproval({ receipt: legacyApproval, capability: issued.capability, context: context(bindingFixture(authority)) }), { code: "cutscene.approval_capability_invalid", path: "/capability" });
  assert.equal(requiresCutsceneReapproval({ receipt: legacyApproval, ...authority }), true);
});

test("approval issuance rejects a canonically resealed estimate whose request schedule no longer matches the immutable Task 2 manifest", () => {
  const authority = authorityFixture();
  const estimate = structuredClone(authority.estimate);
  estimate.attemptCeilings[0].requestSha256 = "f".repeat(64);
  estimate.sha256 = digest(Object.fromEntries(Object.entries(estimate).filter(([key]) => key !== "sha256")));
  assert.throws(() => issueCutsceneHumanApproval({ ...approvalEvent(), decision: "approved", ...authority, estimate }), { code: "cutscene.cost_estimate_stale", path: "/estimate/attemptCeilings/0/requestSha256" });
});

test("pricing and estimate canonical digests fail closed when one content field changes under the same caller sha", () => {
  const authority = authorityFixture();
  for (const mutate of [
    (snapshot) => { snapshot.units.textInput = 6; },
    (snapshot) => { snapshot.retrievedAt = "2026-08-13T00:01:00.000Z"; },
  ]) {
    const snapshot = structuredClone(authority.pricingSnapshot);
    mutate(snapshot);
    assert.throws(() => estimateCutsceneImageCost({ plan: authority.plan, promptPackage: authority.promptPackage, manifest: authority.manifest, waveId: "style-master", pricingSnapshot: snapshot, retryReserve: 1, attemptCeilings: authority.estimate.attemptCeilings.map(({ assetId, maximumUsd }) => ({ assetId, maximumUsd })) }), { code: "cutscene.pricing_snapshot_invalid", path: "/pricingSnapshot/sha256" });
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
  assert.throws(() => estimateCutsceneImageCost({ plan: authority.plan, promptPackage: authority.promptPackage, manifest: authority.manifest, waveId: "style-master", pricingSnapshot: invalidTimestamp, retryReserve: 1, attemptCeilings: authority.estimate.attemptCeilings.map(({ assetId, maximumUsd }) => ({ assetId, maximumUsd })) }), { code: "cutscene.timestamp_invalid", path: "/retrievedAt" });
});

test("actual cost never invents cached usage", () => {
  const pricingSnapshot = pricingSnapshotFixture();
  const usage = { inputTokens: 10, inputTextTokens: 6, inputImageTokens: 4, outputTokens: 8, totalTokens: 18 };
  assert.deepEqual(calculateActualCost({ pricingSnapshot, usage }), { status: "unavailable", reason: "cached-token-breakdown-unavailable" });
});

test("v2 journal keeps a wave-global sequence across internal and explicit retries without resetting spent reserve", async (t) => {
  const artifactRoot = await mkdtemp(path.join(tmpdir(), "cutscene-journal-"));
  t.after(() => rm(artifactRoot, { recursive: true, force: true }));
  const fixture = stageFixture({ waveId: "reference-masters", retryReserve: 2, ceilings: [0.3, 0.5] });
  let calls = 0;
  const first = await runApprovedCutsceneImageWave({
    ...fixture, artifactRoot, workspaceRoot: artifactRoot,
    fetchFn: async () => {
      calls += 1;
      if (calls === 1) return imageResponse({ status: 500, requestId: "req-500" });
      if (calls === 2) return imageResponse({ requestId: "req-recovered" });
      throw new Error("transport-down");
    },
  });
  assert.equal(first.providerResult.results.length, 1);
  assert.equal(first.providerResult.failures.length, 1);
  const failedAssetId = first.providerResult.failures[0].asset_id;
  await mkdir(path.join(artifactRoot, "unrelated"), { recursive: true });
  await writeFile(path.join(artifactRoot, "unrelated", "keep.txt"), "unchanged\n");
  const retried = await retryCutsceneFailedAssets({ ...fixture, artifactRoot, workspaceRoot: artifactRoot, failedAssetIds: [failedAssetId], fetchFn: async () => imageResponse({ requestId: "req-explicit" }) });
  assert.match(retried.unaffectedOutputSha256, /^[a-f0-9]{64}$/u);
  assert.equal(retried.output.journal.retryConsumed, 2);
  assert.equal(await readFile(path.join(artifactRoot, "unrelated", "keep.txt"), "utf8"), "unchanged\n");

  const records = await journalRecords(artifactRoot, fixture.waveId);
  const authorizations = records.filter(({ kind }) => kind === "authorization");
  const outcomes = records.filter(({ kind }) => kind === "outcome");
  assert.deepEqual(authorizations.map(({ attemptSequence }) => attemptSequence), [1, 2, 3, 4]);
  assert.deepEqual(outcomes.map(({ attemptSequence }) => attemptSequence), [1, 2, 3, 4]);
  assert.deepEqual(authorizations.map(({ assetAttemptOrdinal }) => assetAttemptOrdinal), [1, 2, 1, 2]);
  assert.equal(new Set(authorizations.map(({ attemptId }) => attemptId)).size, 4);
  assert.deepEqual(outcomes.map(({ providerOutcome }) => providerOutcome), ["provider-failure", "success", "transport-failure", "success"]);
  assert.deepEqual(outcomes.map(({ retryDisposition }) => retryDisposition), ["retryable", "none", "retryable", "none"]);
  assert.equal(outcomes.filter(({ assetOutcome }) => assetOutcome === "success").length, 2);
  assert.equal(records.every(({ schemaVersion, sha256 }) => schemaVersion === 2 && /^[a-f0-9]{64}$/u.test(sha256)), true);
  assert.equal(records.every((record) => validateCutsceneGenerationUsage(record).ok), true);
});

test("authorization without outcome consumes its full ceiling and blocks ordinary reentry while legacy records fail closed", async (t) => {
  const artifactRoot = await mkdtemp(path.join(tmpdir(), "cutscene-pending-"));
  t.after(() => rm(artifactRoot, { recursive: true, force: true }));
  const fixture = stageFixture({ retryReserve: 1, ceilings: [0.4] });
  const assetId = fixture.selectedAssetIds[0];
  const attemptId = "crashed-before-outcome";
  const authorization = {
    schemaVersion: 2, kind: "authorization", waveId: fixture.waveId, assetId, attemptId, attemptSequence: 1, assetAttemptOrdinal: 1,
    requestSha256: fixture.estimate.attemptCeilings[0].requestSha256, pricingSnapshotSha256: fixture.pricingSnapshot.sha256,
    costEstimateSha256: fixture.estimate.sha256, authorizedMaximumUsd: 0.4, authorizedAt: fixture.now,
  };
  authorization.sha256 = digest(authorization);
  const directory = path.join(artifactRoot, "cutscene", "usage-receipts", fixture.waveId, assetId);
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, "00000001-crashed-before-outcome.authorization.json"), `${JSON.stringify(authorization, null, 2)}\n`);
  let calls = 0;
  await assert.rejects(() => runApprovedCutsceneImageWave({ ...fixture, artifactRoot, workspaceRoot: artifactRoot, fetchFn: async () => { calls += 1; return imageResponse(); } }), { code: "cutscene.asset_already_attempted", path: "/selectedAssetIds" });
  assert.equal(calls, 0);

  await rm(directory, { recursive: true });
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, "legacy.json"), JSON.stringify({ schemaVersion: 1 }));
  calls = 0;
  await assert.rejects(() => runApprovedCutsceneImageWave({ ...fixture, artifactRoot, workspaceRoot: artifactRoot, fetchFn: async () => { calls += 1; return imageResponse(); } }), { code: "cutscene.usage_receipt_corrupt" });
  assert.equal(calls, 0);
});

test("latest retry eligibility follows the highest outcome ordinal even when no provider call occurred", async (t) => {
  const artifactRoot = await mkdtemp(path.join(tmpdir(), "cutscene-latest-outcome-"));
  t.after(() => rm(artifactRoot, { recursive: true, force: true }));
  const fixture = stageFixture({ retryReserve: 2, ceilings: [0.4] });
  const assetId = fixture.selectedAssetIds[0];
  const directory = path.join(artifactRoot, "cutscene", "usage-receipts", fixture.waveId, assetId);
  await mkdir(directory, { recursive: true });
  for (const [attemptSequence, providerOutcome, assetOutcome, retryDisposition] of [
    [1, "transport-failure", "retryable-failure", "retryable"],
    [2, "not-called", "not-attempted", "none"],
  ]) {
    const attemptId = `latest-${attemptSequence}`;
    const authorization = {
      schemaVersion: 2, kind: "authorization", waveId: fixture.waveId, assetId, attemptId, attemptSequence, assetAttemptOrdinal: attemptSequence,
      requestSha256: fixture.estimate.attemptCeilings[0].requestSha256, pricingSnapshotSha256: fixture.pricingSnapshot.sha256,
      costEstimateSha256: fixture.estimate.sha256, authorizedMaximumUsd: 0.4, authorizedAt: fixture.now,
    };
    authorization.sha256 = digest(authorization);
    const outcome = {
      schemaVersion: 2, kind: "outcome", waveId: fixture.waveId, assetId, attemptId, attemptSequence, assetAttemptOrdinal: attemptSequence,
      authorizationSha256: authorization.sha256, providerRequestId: `request-${attemptSequence}`, providerOutcome, assetOutcome, retryDisposition,
      usage: { status: "unavailable", reason: providerOutcome === "not-called" ? "provider-not-called" : "provider-usage-unavailable" },
      actualCost: providerOutcome === "not-called" ? { status: "known", usd: 0 } : { status: "unavailable", reason: "provider-usage-unavailable" },
      completedAt: fixture.now,
    };
    outcome.sha256 = digest(outcome);
    const sequence = String(attemptSequence).padStart(8, "0");
    await writeFile(path.join(directory, `${sequence}-${attemptId}.authorization.json`), `${JSON.stringify(authorization, null, 2)}\n`);
    await writeFile(path.join(directory, `${sequence}-${attemptId}.outcome.json`), `${JSON.stringify(outcome, null, 2)}\n`);
  }
  await assert.rejects(
    () => retryCutsceneFailedAssets({ ...fixture, artifactRoot, failedAssetIds: [assetId], fetchFn: async () => imageResponse() }),
    { code: "cutscene.retry_asset_not_failed", path: "/failedAssetIds" },
  );
});

test("concurrent wave invocations reserve distinct wave-global attempt sequences", async (t) => {
  const artifactRoot = await mkdtemp(path.join(tmpdir(), "cutscene-concurrent-sequence-"));
  t.after(() => rm(artifactRoot, { recursive: true, force: true }));
  const fixture = stageFixture({ retryReserve: 1, ceilings: [0.4] });
  let calls = 0;
  await Promise.allSettled(Array.from({ length: 6 }, () => runApprovedCutsceneImageWave({
    ...fixture,
    artifactRoot,
    fetchFn: async () => { calls += 1; return imageResponse({ requestId: `request-concurrent-${calls}` }); },
  })));
  const authorizations = (await journalRecords(artifactRoot, fixture.waveId)).filter(({ kind }) => kind === "authorization");
  assert.equal(calls <= 2, true);
  assert.deepEqual(authorizations.map(({ attemptSequence }) => attemptSequence), authorizations.map((_, index) => index + 1));
  assert.equal(new Set(authorizations.map(({ assetAttemptOrdinal }) => assetAttemptOrdinal)).size, authorizations.length);
});

test("journal path, canonical hash, and contiguous global sequence corruption fail before network", async (t) => {
  const fixture = stageFixture({ retryReserve: 2, ceilings: [0.4] });
  for (const corruption of ["path", "hash", "sequence", "ceiling"]) {
    const artifactRoot = await mkdtemp(path.join(tmpdir(), `cutscene-corrupt-${corruption}-`));
    t.after(() => rm(artifactRoot, { recursive: true, force: true }));
    const assetId = fixture.selectedAssetIds[0];
    const authorization = {
      schemaVersion: 2, kind: "authorization", waveId: fixture.waveId, assetId, attemptId: `corrupt-${corruption}`,
      attemptSequence: corruption === "sequence" ? 2 : 1, assetAttemptOrdinal: 1,
      requestSha256: fixture.estimate.attemptCeilings[0].requestSha256, pricingSnapshotSha256: fixture.pricingSnapshot.sha256,
      costEstimateSha256: fixture.estimate.sha256, authorizedMaximumUsd: corruption === "ceiling" ? 0.01 : 0.4, authorizedAt: fixture.now,
    };
    authorization.sha256 = corruption === "hash" ? "0".repeat(64) : digest(authorization);
    const directory = path.join(artifactRoot, "cutscene", "usage-receipts", fixture.waveId, assetId);
    await mkdir(directory, { recursive: true });
    const sequence = String(authorization.attemptSequence).padStart(8, "0");
    const name = corruption === "path" ? `00000001-wrong.authorization.json` : `${sequence}-${authorization.attemptId}.authorization.json`;
    await writeFile(path.join(directory, name), `${JSON.stringify(authorization, null, 2)}\n`);
    let calls = 0;
    await assert.rejects(() => runApprovedCutsceneImageWave({ ...fixture, artifactRoot, fetchFn: async () => { calls += 1; return imageResponse(); } }), { code: "cutscene.usage_receipt_corrupt" });
    assert.equal(calls, 0);
  }
});

test("immutable Task 2 manifest is adapted only inside a frozen dispatch snapshot with exact provider request binding", async (t) => {
  const artifactRoot = await mkdtemp(path.join(tmpdir(), "cutscene-adapter-"));
  t.after(() => rm(artifactRoot, { recursive: true, force: true }));
  const fixture = stageFixture({ ceilings: [0.4] });
  const asset = fixture.manifest.assets.find(({ asset_id }) => asset_id === fixture.selectedAssetIds[0]);
  asset.output = { ...asset.output, width: 768, height: 768 };
  const before = {
    plan: JSON.stringify(fixture.plan), promptPackage: JSON.stringify(fixture.promptPackage), manifest: JSON.stringify(fixture.manifest),
    estimate: JSON.stringify(fixture.estimate), receipt: JSON.stringify(fixture.receipt),
  };
  let request;
  await runApprovedCutsceneImageWave({
    ...fixture, artifactRoot,
    fetchFn: async (_url, options) => { request = JSON.parse(options.body); return imageResponse({ requestId: "req-adapter" }); },
  });
  const target = asset.planning.target_output;
  const expectedRequestSha256 = digest({ provider: "openai", model: "gpt-image-2", quality: "low", promptDigest: asset.prompt_sha256, referenceDigests: [], output: { path: target.path, width: target.width, height: target.height, aspectRatio: target.aspect_ratio, format: target.format, background: target.background } });
  assert.deepEqual(request, { model: "gpt-image-2", quality: "low", prompt: asset.prompt, size: "1024x1024", n: 1 });
  assert.equal(fixture.estimate.attemptCeilings[0].requestSha256, expectedRequestSha256);
  assert.equal(Object.hasOwn(asset, "prompt_digest"), false);
  assert.deepEqual({ plan: JSON.stringify(fixture.plan), promptPackage: JSON.stringify(fixture.promptPackage), manifest: JSON.stringify(fixture.manifest), estimate: JSON.stringify(fixture.estimate), receipt: JSON.stringify(fixture.receipt) }, before);
  let calls = 0;
  const seamRoot = await mkdtemp(path.join(tmpdir(), "cutscene-seam-"));
  t.after(() => rm(seamRoot, { recursive: true, force: true }));
  await assert.rejects(() => runApprovedCutsceneImageWave({ ...fixture, artifactRoot: seamRoot, authorizeProviderAttempt: () => {}, fetchFn: async () => { calls += 1; return imageResponse(); } }), { code: "cutscene.authorization_seam_forbidden", path: "/authorizeProviderAttempt" });
  assert.equal(calls, 0);
});

test("host journal records final success, explicit transient retry, throw, malformed response, and publication failure truthfully", async (t) => {
  const cases = [
    { name: "success", expectedCalls: 1, expected: [["success", "success", "none"]] },
    { name: "transient", expectedCalls: 2, expected: [["provider-failure", "retryable-failure", "retryable"], ["success", "success", "none"]] },
    { name: "throw", expectedCalls: 1, rejects: /host-throw-marker/u, expected: [["transport-failure", "terminal-failure", "none"]] },
    { name: "malformed", expectedCalls: 1, rejects: /results and failures/u, expected: [["provider-failure", "terminal-failure", "none"]] },
    { name: "publication", expectedCalls: 1, expected: [["success", "terminal-failure", "none"]] },
  ];
  for (const fixture of cases) {
    const artifactRoot = await mkdtemp(path.join(tmpdir(), `cutscene-host-${fixture.name}-`));
    t.after(() => rm(artifactRoot, { recursive: true, force: true }));
    const authority = stageFixture({ provider: "codex-host", retryReserve: fixture.name === "transient" ? 1 : 0, ceilings: [0.4] });
    let calls = 0;
    const invoke = () => runApprovedCutsceneImageWave({
      ...authority, artifactRoot,
      hostGenerate: async ({ jobs }) => {
        calls += 1;
        if (fixture.name === "throw") throw new Error("host-throw-marker");
        if (fixture.name === "malformed") return {};
        if (fixture.name === "transient" && calls === 1) return { results: [], failures: [{ asset_id: jobs[0].asset_id, generation_state: "generation-failed", reason: "transient-provider-failure", provenance: { provider: "codex-host" } }] };
        return { results: [{ asset_id: jobs[0].asset_id, generation_state: "generated", bytes: fixture.name === "publication" ? Buffer.from("corrupt") : validPng(1024, 1024), provenance: { provider: "codex-host", prompt_digest: promptDigest(jobs[0].prompt) } }], failures: [] };
      },
    });
    if (fixture.rejects) await assert.rejects(invoke, fixture.rejects);
    else await invoke();
    assert.equal(calls, fixture.expectedCalls, fixture.name);
    const outcomes = (await journalRecords(artifactRoot, authority.waveId)).filter(({ kind }) => kind === "outcome");
    assert.deepEqual(outcomes.map(({ providerOutcome, assetOutcome, retryDisposition }) => [providerOutcome, assetOutcome, retryDisposition]), fixture.expected, fixture.name);
  }
});

test("real Task 2 manifest and generation-ready package bind Task 3 approval through Task 4 dispatch and v2 journal", async (t) => {
  const artifactRoot = await mkdtemp(path.join(tmpdir(), "cutscene-real-matrix-"));
  t.after(() => rm(artifactRoot, { recursive: true, force: true }));
  const planned = planCutsceneVisualPreproduction({
    cutsceneId: "cutscene-escape", mode: "generate-after-approval", beats: [{ beatId: "BEAT-01" }], shots: [{ shotId: "SHOT-01", beatId: "BEAT-01" }],
  });
  const manifest = structuredClone(planned.manifest);
  const styleId = planned.plan.cutsceneWorkflow.waves.find(({ id }) => id === "style-master").assetIds[0];
  const style = manifest.assets.find(({ asset_id }) => asset_id === styleId);
  style.generation_state = "generated";
  await mkdir(path.dirname(path.join(artifactRoot, style.output.path)), { recursive: true });
  await writeFile(path.join(artifactRoot, style.output.path), validPng(1024, 1024));
  const promptPackage = await bindCutscenePromptPackage({ artifactRoot, plan: planned.plan, manifest });
  const waveId = "reference-masters";
  const assetIds = [...planned.plan.cutsceneWorkflow.waves.find(({ id }) => id === waveId).assetIds].sort();
  const pricingSnapshot = pricingSnapshotFixture();
  const estimate = estimateCutsceneImageCost({ plan: planned.plan, promptPackage, manifest, waveId, pricingSnapshot, retryReserve: 1, attemptCeilings: assetIds.map((assetId, index) => ({ assetId, maximumUsd: index === 0 ? 0.31 : 0.47 })) });
  const event = approvalEvent();
  const issued = issueCutsceneHumanApproval({ ...event, decision: "approved", plan: planned.plan, promptPackage, manifest, pricingSnapshot, estimate });
  const immutableBefore = JSON.stringify({ plan: planned.plan, promptPackage, manifest, estimate, receipt: issued.receipt });
  let calls = 0;
  const output = await runApprovedCutsceneImageWave({
    artifactRoot, waveId, selectedAssetIds: assetIds, plan: planned.plan, promptPackage, manifest, pricingSnapshot, estimate,
    approvalEvent: event, receipt: issued.receipt, capability: issued.capability, now: "2026-08-13T00:01:00.000Z", env: {}, apiKey: "sk-local-test", sleepFn: async () => {},
    fetchFn: async () => { calls += 1; return imageResponse({ requestId: `req-real-${calls}` }); },
  });
  assert.equal(calls, 2);
  assert.equal(output.providerResult.results.length, 2);
  assert.equal(JSON.stringify({ plan: planned.plan, promptPackage, manifest, estimate, receipt: issued.receipt }), immutableBefore);
  const records = await journalRecords(artifactRoot, waveId);
  assert.deepEqual(records.filter(({ kind }) => kind === "authorization").map(({ attemptSequence, assetAttemptOrdinal }) => [attemptSequence, assetAttemptOrdinal]), [[1, 1], [2, 1]]);
  assert.deepEqual(records.filter(({ kind }) => kind === "outcome").map(({ providerOutcome, assetOutcome }) => [providerOutcome, assetOutcome]), [["success", "success"], ["success", "success"]]);
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
  const estimate = estimateCutsceneImageCost({
    plan: planned.plan, promptPackage, manifest, waveId: "reference-masters", pricingSnapshot, retryReserve: 1,
    attemptCeilings: planned.plan.cutsceneWorkflow.waves.find(({ id }) => id === "reference-masters").assetIds.map((assetId) => ({ assetId, maximumUsd: 0.4 })),
  });
  const event = approvalEvent();
  const issued = issueCutsceneHumanApproval({ ...event, decision: "approved", plan: planned.plan, promptPackage, manifest, pricingSnapshot, estimate });
  const binding = cutsceneApprovalBinding({ plan: planned.plan, promptPackage, manifest, pricingSnapshot, estimate });
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
  assert.equal(validateHostCutsceneApproval({ receipt: issued.receipt, capability: issued.capability, approvalEvent: event, plan: planned.plan, promptPackage, manifest, pricingSnapshot, estimate, now: "2026-08-13T00:01:00.000Z" }), issued.receipt);
});

test("output target mutations invalidate the approved attempt schedule before provider dispatch or writes", async (t) => {
  const fields = [
    ["path", "assets/generated/cutscene-escape-style-master-01-mutated.png"],
    ["width", 1152],
    ["height", 1152],
    ["aspect_ratio", "16:9"],
    ["format", "svg"],
    ["background", "transparent"],
  ];
  for (const [field, replacement] of fields) {
    const artifactRoot = await mkdtemp(path.join(tmpdir(), `cutscene-output-${field}-`));
    t.after(() => rm(artifactRoot, { recursive: true, force: true }));
    const fixture = stageFixture({ ceilings: [0.4] });
    const manifest = structuredClone(fixture.manifest);
    const asset = manifest.assets.find(({ asset_id: assetId }) => assetId === fixture.selectedAssetIds[0]);
    asset.planning.target_output[field] = replacement;
    if (field === "format") {
      asset.planning.target_output.path = "assets/generated/cutscene-escape-style-master-01.svg";
    }
    let calls = 0;
    await assert.rejects(
      () => runApprovedCutsceneImageWave({ ...fixture, artifactRoot, manifest, fetchFn: async () => { calls += 1; return imageResponse(); } }),
      { code: "cutscene.cost_estimate_stale" },
      field,
    );
    assert.equal(calls, 0, field);
    assert.deepEqual(await readdir(artifactRoot), [], field);
  }
});

test("contradictory provider usage preserves one successful physical outcome with conservative unavailable accounting", async (t) => {
  const artifactRoot = await mkdtemp(path.join(tmpdir(), "cutscene-contradictory-usage-"));
  t.after(() => rm(artifactRoot, { recursive: true, force: true }));
  const fixture = stageFixture({ ceilings: [0.4] });
  const result = await runApprovedCutsceneImageWave({
    ...fixture,
    artifactRoot,
    fetchFn: async () => imageResponse({ usage: { input_tokens: 8, output_tokens: 4, total_tokens: 11, input_tokens_details: { text_tokens: 3, image_tokens: 5, cached_text_tokens: 4, cached_image_tokens: 0 } } }),
  });
  assert.equal(result.providerResult.results.length, 1);
  const records = await journalRecords(artifactRoot, fixture.waveId);
  assert.equal(records.filter(({ kind }) => kind === "authorization").length, 1);
  const outcome = records.find(({ kind }) => kind === "outcome");
  assert.deepEqual(outcome.usage, { status: "unavailable", reason: "provider-usage-invalid" });
  assert.deepEqual(outcome.actualCost, { status: "unavailable", reason: "provider-usage-invalid" });
  const mismatchedReason = structuredClone(outcome);
  mismatchedReason.actualCost.reason = "provider-usage-unavailable";
  mismatchedReason.sha256 = digest(Object.fromEntries(Object.entries(mismatchedReason).filter(([key]) => key !== "sha256")));
  assert.deepEqual(validateCutsceneGenerationUsage(mismatchedReason).errors[0], { code: "cutscene.usage_cost_reason_mismatch", path: "/actualCost/reason" });
  assert.equal(result.journal.accountedUsd, 0.4);
  assert.equal((await readFile(path.join(artifactRoot, fixture.manifest.assets.find(({ asset_id: assetId }) => assetId === fixture.selectedAssetIds[0]).output.path))).subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), true);
});

test("ordinary wave reentry never redispatches an asset with a terminal physical outcome", async (t) => {
  const artifactRoot = await mkdtemp(path.join(tmpdir(), "cutscene-terminal-reentry-"));
  t.after(() => rm(artifactRoot, { recursive: true, force: true }));
  const fixture = stageFixture({ ceilings: [0.4] });
  let calls = 0;
  await runApprovedCutsceneImageWave({ ...fixture, artifactRoot, fetchFn: async () => { calls += 1; return imageResponse({ status: 400, requestId: "req-terminal" }); } });
  assert.equal(calls, 1);
  await assert.rejects(
    () => runApprovedCutsceneImageWave({ ...fixture, artifactRoot, fetchFn: async () => { calls += 1; return imageResponse(); } }),
    { code: "cutscene.asset_already_attempted", path: "/selectedAssetIds" },
  );
  assert.equal(calls, 1);
  assert.equal((await journalRecords(artifactRoot, fixture.waveId)).filter(({ kind }) => kind === "outcome").length, 1);
});

test("public retry flag cannot bypass ordinary reentry dispatch protection", async (t) => {
  const artifactRoot = await mkdtemp(path.join(tmpdir(), "cutscene-public-retry-"));
  t.after(() => rm(artifactRoot, { recursive: true, force: true }));
  const fixture = stageFixture({ ceilings: [0.4] });
  let calls = 0;
  await runApprovedCutsceneImageWave({ ...fixture, artifactRoot, fetchFn: async () => { calls += 1; return imageResponse({ status: 400, requestId: "req-terminal" }); } });
  await assert.rejects(
    () => runApprovedCutsceneImageWave({ ...fixture, artifactRoot, retry: true, fetchFn: async () => { calls += 1; return imageResponse(); } }),
    { code: "cutscene.asset_already_attempted", path: "/selectedAssetIds" },
  );
  assert.equal(calls, 1);
});
