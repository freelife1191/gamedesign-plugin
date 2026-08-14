import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { calculateActualCost, estimateCutsceneImageCost } from "../../../shared/scripts/estimate-cutscene-image-cost.mjs";
import { planCutsceneVisualPreproduction, buildVariantOverlay } from "../../../shared/scripts/plan-cutscene-visual-preproduction.mjs";
import { reviewCutsceneContinuity } from "../../../shared/scripts/review-cutscene-continuity.mjs";
import { retryCutsceneFailedAssets, runApprovedCutsceneImageWave } from "../../../shared/scripts/run-approved-cutscene-image-stage.mjs";
import { assertCutsceneContinuityGate, deriveCutsceneLifecycle } from "../../../shared/scripts/validate-cutscene-visual-preproduction.mjs";
import { generationInput, generationRuntime, imageResponse, makeFixture, makeRuntime, snapshotArtifactTree } from "../../fixtures/cutscene/cutscene-mutation-harness.mjs";

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const calls = (runtime) => runtime.calls.fetch + runtime.calls.host;

test("prompt-only produces template prompt guidance without bytes or provider calls", async (t) => {
  const fixture = await makeFixture(t); const runtime = makeRuntime();
  const result = planCutsceneVisualPreproduction({ cutsceneId: fixture.input.plan.cutsceneId, mode: "prompt-only", beats: fixture.input.plan.beats, shots: fixture.input.plan.shots });
  assert.equal(fixture.input.plan.mode, "generate-after-approval");
  assert.equal(result.plan.mode, "prompt-only"); assert.ok(result.templatePromptPackage.references.length > 0); assert.equal(calls(runtime), 0);
});

test("estimate-only invokes the estimator against a complete fixture and never reaches a provider", async (t) => {
  const fixture = await makeFixture(t); const runtime = makeRuntime();
  const estimate = estimateCutsceneImageCost({ plan: fixture.input.plan, promptPackage: fixture.input.promptPackage, manifest: fixture.input.manifest, waveId: fixture.input.waveId, pricingSnapshot: fixture.input.pricingSnapshot, retryReserve: 1, attemptCeilings: fixture.input.selectedAssetIds.map((assetId) => ({ assetId, maximumUsd: 0.4 })) });
  assert.equal(estimate.costStatus, "available"); assert.equal(estimate.planSha256, fixture.input.promptPackage.planSha256); assert.equal(calls(runtime), 0);
});

test("host-unavailable quote remains unavailable and does not create a request", async (t) => {
  const fixture = await makeFixture(t); const runtime = makeRuntime();
  const estimate = estimateCutsceneImageCost({ plan: fixture.input.plan, promptPackage: fixture.input.promptPackage, manifest: fixture.input.manifest, waveId: fixture.input.waveId, pricingSnapshot: fixture.input.pricingSnapshot, retryReserve: 1 });
  assert.deepEqual({ costStatus: estimate.costStatus, maximumUsd: estimate.maximumUsd }, { costStatus: "unavailable", maximumUsd: null }); assert.equal(calls(runtime), 0);
});

test("style wave cannot dispatch until an approval authority is supplied", async (t) => {
  const fixture = await makeFixture(t); const runtime = makeRuntime();
  const { receipt: _receipt, capability: _capability, ...input } = fixture.input;
  await assert.rejects(() => runApprovedCutsceneImageWave({ ...generationInput(input), ...generationRuntime(runtime) }), { code: "cutscene.approval_required", path: "/cutsceneWorkflow/waves/0/approval" }); assert.equal(calls(runtime), 0);
});

test("reference masters retain the approval-bound style reference before any provider call", async (t) => {
  const fixture = await makeFixture(t, { waveId: "reference-masters" }); const runtime = makeRuntime();
  fixture.input.promptPackage.references[0].sha256 = "0".repeat(64);
  await assert.rejects(() => runApprovedCutsceneImageWave({ ...generationInput(fixture.input), ...generationRuntime(runtime) }), { code: "cutscene.prompt_package_invalid", path: "/promptPackage/promptPackageSha256" }); assert.equal(calls(runtime), 0);
});

test("keyframes reject an incomplete master predecessor before journal or provider activity", async (t) => {
  const fixture = await makeFixture(t, { waveId: "keyframes" }); const runtime = makeRuntime();
  fixture.input.plan.cutsceneWorkflow.waves[0].state = "planned";
  const before = await snapshotArtifactTree(fixture.artifactRoot);
  await assert.rejects(() => runApprovedCutsceneImageWave({ ...generationInput(fixture.input), ...generationRuntime(runtime) }), { code: "cutscene.predecessor_wave_incomplete", path: "/cutsceneWorkflow/waves/0/state" });
  assert.equal(calls(runtime), 0); assert.deepEqual(await snapshotArtifactTree(fixture.artifactRoot), before);
});

test("storyboard selection rejects an extra stable id before provider dispatch", async (t) => {
  const fixture = await makeFixture(t, { waveId: "storyboard" }); const runtime = makeRuntime();
  fixture.input.selectedAssetIds.push("cutscene-escape-storyboard-shot-99");
  await assert.rejects(() => runApprovedCutsceneImageWave({ ...generationInput(fixture.input), ...generationRuntime(runtime) }), { code: "cutscene.selected_asset_ids_invalid", path: "/selectedAssetIds" }); assert.equal(calls(runtime), 0);
});

test("a plan change makes the existing approval binding stale and requires a new approval", async (t) => {
  const fixture = await makeFixture(t); const runtime = makeRuntime(); fixture.input.plan.beats[0].beatId = "BEAT-99";
  await assert.rejects(() => runApprovedCutsceneImageWave({ ...generationInput(fixture.input), ...generationRuntime(runtime) }), { code: "cutscene.plan_invalid", path: "/plan" }); assert.equal(calls(runtime), 0);
});

test("reserve and cap boundaries stop an unaffordable wave before provider dispatch", async (t) => {
  const fixture = await makeFixture(t); const runtime = makeRuntime();
  fixture.input.estimate.retryReserve = 0;
  await assert.rejects(() => runApprovedCutsceneImageWave({ ...generationInput(fixture.input), ...generationRuntime(runtime) }), (error) => error?.code === "cutscene.cost_estimate_invalid" || error?.code === "cutscene.cost_estimate_stale"); assert.equal(calls(runtime), 0);
});

test("failed-only retry keeps unrelated artifacts byte-identical across a partial retry", async (t) => {
  const fixture = await makeFixture(t, { retryReserve: 2 }); let request = 0;
  const runtime = makeRuntime({ fetchFn: async () => { request += 1; return imageResponse({ status: 500, requestId: `retry-${request}` }); } });
  await runApprovedCutsceneImageWave({ ...generationInput(fixture.input), ...generationRuntime(runtime) });
  const before = await readFile(fixture.outputPath); const treeBefore = await snapshotArtifactTree(fixture.artifactRoot);
  await assert.rejects(() => retryCutsceneFailedAssets({ ...generationInput(fixture.input), ...generationRuntime(runtime), failedAssetIds: [...fixture.input.selectedAssetIds] }), { code: "cutscene.retry_reserve_exhausted" });
  const after = await snapshotArtifactTree(fixture.artifactRoot);
  assert.equal(sha256(await readFile(fixture.outputPath)), sha256(before)); assert.ok(request >= 2);
  assert.deepEqual(after.filter((entry) => entry.path.startsWith("unaffected/")), treeBefore.filter((entry) => entry.path.startsWith("unaffected/")));
});

test("dialogue-only overlay produces no image asset id", async (t) => {
  const fixture = await makeFixture(t);
  const overlay = buildVariantOverlay({ basePlan: fixture.input.plan, triggerState: "QUEST-COMPANION-ABSENT", changes: [{ shotId: "SHOT-01", kind: "dialogue", value: "혼자 가야 해." }] });
  assert.deepEqual(overlay.generatedAssetIds, []);
});

test("visual overlay produces a deterministic derivative id outside base waves", async (t) => {
  const fixture = await makeFixture(t);
  const overlay = buildVariantOverlay({ basePlan: fixture.input.plan, triggerState: "QUEST-COMPANION-ABSENT", changes: [{ shotId: "SHOT-01", kind: "blocking", value: "Lyra exits left" }] });
  assert.equal(overlay.generatedAssetIds.length, 1); assert.equal(fixture.input.plan.cutsceneWorkflow.waves.flatMap((wave) => wave.assetIds).includes(overlay.generatedAssetIds[0]), false);
});

test("continuity drift creates a blocking receipt that the gate rejects", async (t) => {
  const fixture = await makeFixture(t);
  const receipt = reviewCutsceneContinuity({ plan: fixture.input.plan, manifest: fixture.input.manifest, reviewedAt: "2026-08-13T00:00:00.000Z", observations: [{ shotId: "SHOT-01", finding: { kind: "screen-direction", blocking: true }, sourceMasterIds: [fixture.input.plan.cutsceneWorkflow.waves[0].assetIds[0]] }] });
  await assert.rejects(async () => assertCutsceneContinuityGate({ plan: fixture.input.plan, manifest: fixture.input.manifest, waves: fixture.input.waves, continuityReceipt: receipt }), { code: "cutscene.continuity_blocking_findings", path: "/continuityReceipt/blockingFindingIds" });
});

test("derived lifecycle becomes a candidate only for complete current evidence and turns false for a blocker", async (t) => {
  const fixture = await makeFixture(t, { completeAll: true });
  const baseline = deriveCutsceneLifecycle({ plan: fixture.input.plan, manifest: fixture.input.manifest, waves: fixture.input.waves, continuityReceipt: fixture.input.continuityReceipt });
  assert.equal(baseline.productionCandidate, true);
  const blocked = reviewCutsceneContinuity({ plan: fixture.input.plan, manifest: fixture.input.manifest, reviewedAt: "2026-08-13T00:00:00.000Z", observations: [{ shotId: "SHOT-01", finding: { kind: "screen-direction", blocking: true }, sourceMasterIds: [fixture.input.plan.cutsceneWorkflow.waves[0].assetIds[0]] }] });
  const lifecycle = deriveCutsceneLifecycle({ plan: fixture.input.plan, manifest: fixture.input.manifest, waves: fixture.input.waves, continuityReceipt: blocked });
  assert.equal(lifecycle.lifecycle, "blocked"); assert.equal(lifecycle.productionCandidate, false);
});

test("incomplete provider token detail yields unavailable actual cost rather than a guessed cost", async (t) => {
  const fixture = await makeFixture(t);
  assert.deepEqual(calculateActualCost({ pricingSnapshot: fixture.input.pricingSnapshot, usage: { inputTokens: 8, inputTextTokens: 3, inputImageTokens: 5, outputTokens: 4, totalTokens: 12 } }), { status: "unavailable", reason: "cached-token-breakdown-unavailable" });
});
