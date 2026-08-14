import { randomUUID } from "node:crypto";

import { calculateActualCost, resolveCutsceneGenerationAuthority } from "./estimate-cutscene-image-cost.mjs";
import { validateHostCutsceneApproval } from "./lib/cutscene-generation-approval.mjs";
import { ensureArtifactDirectories, safeWriteArtifactFile } from "./lib/safe-artifact-write.mjs";
import { validateCutsceneManifestHandoff } from "./plan-cutscene-visual-preproduction.mjs";
import { runConfiguredSelectedImageAssetWorkflow } from "./run-image-asset-workflow.mjs";

const id = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u;
const requestId = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const coded = (code, path) => Object.assign(new Error(code), { code, path });
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);

function selectedWave(plan, waveId, selectedAssetIds) {
  const wave = plan.cutsceneWorkflow?.waves?.find((item) => item.id === waveId);
  if (!wave) throw coded("cutscene.wave_unknown", "/waveId");
  if (!Array.isArray(selectedAssetIds) || !same(selectedAssetIds, wave.assetIds)) throw coded("cutscene.selected_asset_ids_invalid", "/selectedAssetIds");
  return wave;
}

function assertAttemptState(state, estimate, receipt, attemptOrdinal) {
  if (!state || !Number.isInteger(state.failedAttempts) || state.failedAttempts < 0) throw coded("cutscene.attempt_state_invalid", "/attemptState/failedAttempts");
  if (!Number.isFinite(state.accumulatedUsd) || state.accumulatedUsd < 0) throw coded("cutscene.attempt_state_invalid", "/attemptState/accumulatedUsd");
  if (state.failedAttempts + attemptOrdinal - 1 > estimate.retryReserve) throw coded("cutscene.retry_reserve_exhausted", "/cutsceneWorkflow/waves/0/attempts/1");
  if (state.accumulatedUsd + estimate.maximumUsd > receipt.maximumApprovedUsd) throw coded("cutscene.maximum_possible_cost_exceeded", "/cutsceneWorkflow/waves/0/estimate/maximumUsd");
}

function assertCurrent(input) {
  if (input.plan?.mode !== "generate-after-approval") throw coded("cutscene.mode_generation_forbidden", "/mode");
  validateCutsceneManifestHandoff({ manifest: input.manifest });
  selectedWave(input.plan, input.waveId, input.selectedAssetIds);
  const authority = resolveCutsceneGenerationAuthority({ plan: input.plan, promptPackage: input.promptPackage });
  const approved = validateHostCutsceneApproval({ receipt: input.receipt, capability: input.capability, approvalEvent: input.approvalEvent, plan: input.plan, promptPackage: input.promptPackage, pricingSnapshot: input.pricingSnapshot, estimate: input.estimate, now: input.now });
  // The immutable Task 2 manifest must still agree with the currently sealed
  // generation package, not merely with a caller-provided hash wrapper.
  for (const assetId of input.selectedAssetIds) {
    const asset = input.manifest.assets.find((item) => item.asset_id === assetId);
    const prompt = authority.prompts.find((item) => item.assetId === assetId);
    if (!asset || !prompt || asset.prompt_sha256 !== prompt.promptSha256 || asset.prompt !== prompt.prompt) throw coded("cutscene.prompt_package_stale", "/promptPackage/prompts");
  }
  return approved;
}

function providerFrom(input) {
  if (input.provider === "codex-host") return "codex-host";
  return "openai";
}

export async function writeCutsceneUsageReceipt({ artifactRoot, waveId, assetId, attemptId, providerRequestId, usage, pricingSnapshot } = {}) {
  if (!id.test(assetId ?? "")) throw coded("cutscene.asset_id_invalid", "/assetId");
  if (typeof waveId !== "string" || !waveId) throw coded("cutscene.wave_id_invalid", "/waveId");
  if (typeof attemptId !== "string" || !requestId.test(attemptId)) throw coded("cutscene.attempt_id_invalid", "/attemptId");
  const safeProviderRequestId = providerRequestId === undefined ? "no-request-id" : providerRequestId;
  if (safeProviderRequestId !== "no-request-id" && !requestId.test(safeProviderRequestId)) throw coded("cutscene.provider_request_id_invalid", "/providerRequestId");
  const actualCost = calculateActualCost({ pricingSnapshot, usage });
  const receipt = { schemaVersion: 1, waveId, assetId, attemptId, providerRequestId: safeProviderRequestId, ...usage, actualCost };
  if (artifactRoot) {
    const root = await ensureArtifactDirectories({ artifactRoot, directories: ["cutscene", "cutscene/usage-receipts", `cutscene/usage-receipts/${waveId}`, `cutscene/usage-receipts/${waveId}/${assetId}`] });
    const relativePath = `cutscene/usage-receipts/${waveId}/${assetId}/${attemptId}-${safeProviderRequestId}.json`;
    await safeWriteArtifactFile({ artifactRoot: root, relativePath, data: `${JSON.stringify(receipt, null, 2)}\n`, policy: "create-once" });
  }
  return { actualCost, receipt };
}

export async function runApprovedCutsceneImageWave(input = {}) {
  // This guard intentionally precedes every filesystem operation and every
  // authority check: prompt/estimate-only is a zero-provider, zero-write mode.
  assertCurrent(input);
  const provider = providerFrom(input);
  const attemptIds = new Map();
  const beforeProvider = async ({ asset_id, attempt_ordinal }) => {
    const approved = assertCurrent(input);
    assertAttemptState(input.attemptState, input.estimate, approved, attempt_ordinal);
    if (!attemptIds.has(`${asset_id}:${attempt_ordinal}`)) attemptIds.set(`${asset_id}:${attempt_ordinal}`, randomUUID());
  };
  const result = await runConfiguredSelectedImageAssetWorkflow({
    workspaceRoot: input.workspaceRoot ?? input.artifactRoot, env: input.env ?? {}, artifactRoot: input.artifactRoot,
    manifest: input.manifest, selectedAssetIds: input.selectedAssetIds, provider,
    apiKey: input.apiKey ?? input.env?.OPENAI_API_KEY, fetchFn: input.fetchFn, hostGenerate: input.hostGenerate,
    beforeProvider, now: () => input.now, sleepFn: input.sleepFn,
  });
  return { ...result, attemptIds: [...attemptIds.values()] };
}

export async function retryCutsceneFailedAssets({ failedAssetIds, ...input } = {}) {
  const output = await runApprovedCutsceneImageWave({ ...input, selectedAssetIds: failedAssetIds });
  return { retriedIds: [...failedAssetIds], unaffectedOutputSha256: null, output };
}
