import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { calculateActualCost, estimateCutsceneImageCost } from "../../../shared/scripts/estimate-cutscene-image-cost.mjs";
import { planCutsceneVisualPreproduction, buildVariantOverlay } from "../../../shared/scripts/plan-cutscene-visual-preproduction.mjs";
import { reviewCutsceneContinuity } from "../../../shared/scripts/review-cutscene-continuity.mjs";
import { retryCutsceneFailedAssets, runApprovedCutsceneImageWave } from "../../../shared/scripts/run-approved-cutscene-image-stage.mjs";
import { assertCutsceneContinuityGate, deriveCutsceneLifecycle } from "../../../shared/scripts/validate-cutscene-visual-preproduction.mjs";
import { freshAuthority, generationInput, generationRuntime, imageResponse, makeFixture, makeRuntime, snapshotArtifactTree, validPng } from "../../fixtures/cutscene/cutscene-mutation-harness.mjs";

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const calls = (runtime) => runtime.calls.fetch + runtime.calls.host;

test("prompt-only produces template prompt guidance without bytes or provider calls", async (t) => {
  const artifactRoot = await mkdtemp(path.join(tmpdir(), "cutscene-prompt-only-")); t.after(() => rm(artifactRoot, { recursive: true, force: true })); const runtime = makeRuntime(); const before = await snapshotArtifactTree(artifactRoot);
  const result = planCutsceneVisualPreproduction({ cutsceneId: "cutscene-escape", mode: "prompt-only", beats: [{ beatId: "BEAT-01" }], shots: [{ shotId: "SHOT-01", beatId: "BEAT-01" }] });
  assert.equal(result.plan.mode, "prompt-only"); assert.ok(result.templatePromptPackage.references.length > 0); assert.equal(result.templatePromptPackage.references.every((reference) => reference.expectedPath && !Object.hasOwn(reference, "sha256")), true); assert.equal(calls(runtime), 0); assert.deepEqual(before, []); assert.deepEqual(await snapshotArtifactTree(artifactRoot), []);
});

test("estimate-only invokes the estimator against a complete fixture and never reaches a provider", async (t) => {
  const fixture = await makeFixture(t); const runtime = makeRuntime();
  const estimate = estimateCutsceneImageCost({ plan: fixture.input.plan, promptPackage: fixture.input.promptPackage, manifest: fixture.input.manifest, waveId: fixture.input.waveId, pricingSnapshot: fixture.input.pricingSnapshot, retryReserve: 1, attemptCeilings: fixture.input.selectedAssetIds.map((assetId) => ({ assetId, maximumUsd: 0.4 })) });
  assert.equal(estimate.costStatus, "available"); assert.equal(estimate.planSha256, fixture.input.promptPackage.planSha256); assert.equal(calls(runtime), 0);
});

test("host-unavailable quote remains unavailable and does not create a request", async (t) => {
  const fixture = await makeFixture(t); const runtime = makeRuntime();
  const estimate = estimateCutsceneImageCost({ plan: fixture.input.plan, promptPackage: fixture.input.promptPackage, manifest: fixture.input.manifest, waveId: fixture.input.waveId, pricingSnapshot: fixture.input.pricingSnapshot, retryReserve: 1 });
  assert.deepEqual({ costStatus: estimate.costStatus, minimumUsd: estimate.minimumUsd, expectedUsd: estimate.expectedUsd, maximumUsd: estimate.maximumUsd }, { costStatus: "unavailable", minimumUsd: null, expectedUsd: null, maximumUsd: null }); assert.equal(calls(runtime), 0);
});

test("style wave cannot dispatch until an approval authority is supplied", async (t) => {
  const fixture = await makeFixture(t); const runtime = makeRuntime();
  const { receipt: _receipt, capability: _capability, ...input } = fixture.input;
  await assert.rejects(() => runApprovedCutsceneImageWave({ ...generationInput(input), ...generationRuntime(runtime) }), { code: "cutscene.approval_required", path: "/cutsceneWorkflow/waves/0/approval" }); assert.equal(calls(runtime), 0);
});

test("reference masters reject a current package whose observed master binding drifted", async (t) => {
  const fixture = await makeFixture(t, { waveId: "reference-masters", actualMasterBinding: true }); const runtime = makeRuntime();
  const master = fixture.input.manifest.assets[0]; await (await import("node:fs/promises")).writeFile(`${fixture.artifactRoot}/${master.output.path}`, validPng(2, 2));
  const { bindCutscenePromptPackage } = await import("../../../shared/scripts/plan-cutscene-visual-preproduction.mjs");
  const currentPackage = await bindCutscenePromptPackage({ artifactRoot: fixture.artifactRoot, plan: fixture.input.plan, manifest: fixture.input.manifest });
  const currentEstimate = estimateCutsceneImageCost({ plan: fixture.input.plan, promptPackage: currentPackage, manifest: fixture.input.manifest, waveId: fixture.input.waveId, pricingSnapshot: fixture.input.pricingSnapshot, retryReserve: fixture.input.estimate.retryReserve, attemptCeilings: fixture.input.estimate.attemptCeilings.map(({ assetId, maximumUsd }) => ({ assetId, maximumUsd })) });
  const before = await snapshotArtifactTree(fixture.artifactRoot); assert.notEqual(currentPackage.references[0].sha256, fixture.input.promptPackage.references[0].sha256);
  await assert.rejects(() => runApprovedCutsceneImageWave({ ...generationInput(fixture.input), promptPackage: currentPackage, estimate: currentEstimate, ...generationRuntime(runtime) }), { code: "cutscene.approval_binding_stale", path: "/promptPackageSha256" }); assert.equal(calls(runtime), 0); assert.deepEqual(await snapshotArtifactTree(fixture.artifactRoot), before);
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

test("a valid re-bound prompt package with an old approval pair fails the exact approval binding", async (t) => {
  const fixture = await makeFixture(t, { actualMasterBinding: true }); const runtime = makeRuntime();
  const { bindCutscenePromptPackage } = await import("../../../shared/scripts/plan-cutscene-visual-preproduction.mjs");
  const master = fixture.input.manifest.assets[0]; await (await import("node:fs/promises")).writeFile(`${fixture.artifactRoot}/${master.output.path}`, validPng(3, 2));
  const currentPackage = await bindCutscenePromptPackage({ artifactRoot: fixture.artifactRoot, plan: fixture.input.plan, manifest: fixture.input.manifest });
  const currentEstimate = estimateCutsceneImageCost({ plan: fixture.input.plan, promptPackage: currentPackage, manifest: fixture.input.manifest, waveId: fixture.input.waveId, pricingSnapshot: fixture.input.pricingSnapshot, retryReserve: fixture.input.estimate.retryReserve, attemptCeilings: fixture.input.estimate.attemptCeilings.map(({ assetId, maximumUsd }) => ({ assetId, maximumUsd })) });
  const before = await snapshotArtifactTree(fixture.artifactRoot);
  await assert.rejects(() => runApprovedCutsceneImageWave({ ...generationInput(fixture.input), promptPackage: currentPackage, estimate: currentEstimate, ...generationRuntime(runtime) }), { code: "cutscene.approval_binding_stale", path: "/promptPackageSha256" }); assert.equal(calls(runtime), 0); assert.deepEqual(await snapshotArtifactTree(fixture.artifactRoot), before);
});

test("valid-journal retry reserve stops before provider dispatch or any tree write", async (t) => {
  const fixture = await makeFixture(t, { waveId: "reference-masters", retryReserve: 1 }); let request = 0;
  const initial = makeRuntime({ fetchFn: async () => { request += 1; if (request === 1) return imageResponse({ status: 500, requestId: "reserve-500" }); if (request === 2) return imageResponse({ requestId: "reserve-success" }); throw new Error("reserve transport failure"); } });
  const first = await runApprovedCutsceneImageWave({ ...generationInput(fixture.input), ...generationRuntime(initial) });
  const failedId = first.providerResult.failures[0].asset_id; const before = await snapshotArtifactTree(fixture.artifactRoot); const runtime = makeRuntime(); const authority = freshAuthority(fixture);
  await assert.rejects(() => retryCutsceneFailedAssets({ ...generationInput(fixture.input), ...generationRuntime(runtime), failedAssetIds: [failedId], ...authority, now: "2026-08-13T00:03:00.000Z" }), { code: "cutscene.retry_reserve_exhausted", path: "/cutsceneWorkflow/waves/1/attempts/3" });
  assert.equal(calls(runtime), 0); assert.deepEqual(await snapshotArtifactTree(fixture.artifactRoot), before);
  const capFixture = await makeFixture(t, { retryReserve: 3 }); let capRequest = 0;
  const expensiveFailure = { input_tokens: 100_000_000, output_tokens: 4, total_tokens: 100_000_004, input_tokens_details: { text_tokens: 50_000_000, image_tokens: 50_000_000, cached_text_tokens: 0, cached_image_tokens: 0 } };
  const seeded = await runApprovedCutsceneImageWave({ ...generationInput(capFixture.input), ...generationRuntime(makeRuntime({ fetchFn: async () => { capRequest += 1; return imageResponse({ status: 500, requestId: `cap-${capRequest}`, ...(capRequest === 3 ? { usage: expensiveFailure } : {}) }); } })) });
  const capFailedId = seeded.providerResult.failures[0].asset_id; const capBefore = await snapshotArtifactTree(capFixture.artifactRoot); const capRuntime = makeRuntime(); const capAuthority = freshAuthority(capFixture);
  await assert.rejects(() => retryCutsceneFailedAssets({ ...generationInput(capFixture.input), ...generationRuntime(capRuntime), failedAssetIds: [capFailedId], ...capAuthority, now: "2026-08-13T00:03:00.000Z" }), { code: "cutscene.maximum_possible_cost_exceeded", path: "/cutsceneWorkflow/waves/0/estimate/maximumUsd" });
  assert.equal(calls(capRuntime), 0); assert.deepEqual(await snapshotArtifactTree(capFixture.artifactRoot), capBefore);
});

test("failed-only reference retry preserves prior success receipts and unrelated files", async (t) => {
  const fixture = await makeFixture(t, { waveId: "reference-masters", retryReserve: 2 }); let request = 0;
  const initial = makeRuntime({ fetchFn: async () => { request += 1; if (request === 1) return imageResponse({ status: 500, requestId: "retryable-500" }); if (request === 2) return imageResponse({ requestId: "recovered-success" }); throw new Error("transport failure"); } });
  const first = await runApprovedCutsceneImageWave({ ...generationInput(fixture.input), ...generationRuntime(initial) });
  const succeededId = first.providerResult.results[0].asset_id; const failedId = first.providerResult.failures[0].asset_id;
  const succeededOutput = fixture.input.manifest.assets.find((asset) => asset.asset_id === succeededId).planning.target_output.path;
  const successBytes = await readFile(`${fixture.artifactRoot}/${succeededOutput}`); const before = await snapshotArtifactTree(fixture.artifactRoot);
  const authority = freshAuthority(fixture);
  const retried = await retryCutsceneFailedAssets({ ...generationInput(fixture.input), ...generationRuntime(makeRuntime({ fetchFn: async () => imageResponse({ requestId: "failed-only-retry" }) })), failedAssetIds: [failedId], ...authority, now: "2026-08-13T00:03:00.000Z" });
  const after = await snapshotArtifactTree(fixture.artifactRoot);
  assert.deepEqual(retried.retriedIds, [failedId]); assert.deepEqual(retried.output.providerResult.results.map((asset) => asset.asset_id), [failedId]); assert.deepEqual(await readFile(`${fixture.artifactRoot}/${succeededOutput}`), successBytes);
  assert.deepEqual(after.filter((entry) => entry.path.includes(succeededId)), before.filter((entry) => entry.path.includes(succeededId)));
  assert.deepEqual(after.filter((entry) => entry.path.startsWith("unaffected/")), before.filter((entry) => entry.path.startsWith("unaffected/")));
  const allowedRetryPaths = new Set(["assets/generated", "assets/image-assets.yml", "assets/receipts", "cutscene/usage-receipts/reference-masters", `cutscene/usage-receipts/reference-masters/${failedId}`, fixture.input.manifest.assets.find((asset) => asset.asset_id === failedId).planning.target_output.path]);
  const changedPaths = [...new Set([...before, ...after].map((entry) => entry.path).filter((entryPath) => JSON.stringify(before.find((entry) => entry.path === entryPath)) !== JSON.stringify(after.find((entry) => entry.path === entryPath))))];
  assert.equal(changedPaths.every((entryPath) => allowedRetryPaths.has(entryPath) || entryPath.startsWith("assets/receipts/image-generation-attempt-") || entryPath.includes(failedId)), true, `${failedId}: ${changedPaths.join(", ")}`);
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
  assert.equal(deriveCutsceneLifecycle({ plan: fixture.input.plan, manifest: fixture.input.manifest, waves: fixture.input.waves, continuityReceipt: receipt }).productionCandidate, false);
});

test("derived lifecycle becomes a candidate only for complete current evidence and turns false for a blocker", async (t) => {
  const fixture = await makeFixture(t, { completeAll: true });
  const baseline = deriveCutsceneLifecycle({ plan: fixture.input.plan, manifest: fixture.input.manifest, waves: fixture.input.waves, continuityReceipt: fixture.input.continuityReceipt });
  assert.equal(baseline.productionCandidate, true);
  const blocked = reviewCutsceneContinuity({ plan: fixture.input.plan, manifest: fixture.input.manifest, reviewedAt: "2026-08-13T00:00:00.000Z", observations: [{ shotId: "SHOT-01", finding: { kind: "screen-direction", blocking: true }, sourceMasterIds: [fixture.input.plan.cutsceneWorkflow.waves[0].assetIds[0]] }] });
  const lifecycle = deriveCutsceneLifecycle({ plan: fixture.input.plan, manifest: fixture.input.manifest, waves: fixture.input.waves, continuityReceipt: blocked });
  assert.equal(lifecycle.lifecycle, "blocked"); assert.equal(lifecycle.productionCandidate, false);
});

test("stage persists unavailable actual cost when cached usage detail is absent", async (t) => {
  const fixture = await makeFixture(t); const runtime = makeRuntime({ fetchFn: async () => imageResponse({ usage: { input_tokens: 8, output_tokens: 4, total_tokens: 12, input_tokens_details: { text_tokens: 3, image_tokens: 5 } } }) });
  fixture.input.manifest.assets[0].output = { ...fixture.input.manifest.assets[0].output, width: 768, height: 768 };
  assert.notDeepEqual(fixture.input.manifest.assets[0].output, fixture.input.manifest.assets[0].planning.target_output);
  const result = await runApprovedCutsceneImageWave({ ...generationInput(fixture.input), ...generationRuntime(runtime) });
  const outcome = result.journal.latest[fixture.input.selectedAssetIds[0]];
  assert.equal(outcome.actualCost.status, "unavailable"); assert.equal(outcome.actualCost.reason, "cached-token-breakdown-unavailable");
});
