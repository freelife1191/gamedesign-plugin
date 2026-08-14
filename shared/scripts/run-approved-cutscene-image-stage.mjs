import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { calculateActualCost, resolveCutsceneGenerationAuthority } from "./estimate-cutscene-image-cost.mjs";
import { validateHostCutsceneApproval } from "./lib/cutscene-generation-approval.mjs";
import { ensureArtifactDirectories, safeWriteArtifactFile } from "./lib/safe-artifact-write.mjs";
import { validateCutsceneManifestHandoff } from "./plan-cutscene-visual-preproduction.mjs";
import { runConfiguredSelectedImageAssetWorkflow } from "./run-image-asset-workflow.mjs";

const id = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u;
const requestId = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const coded = (code, path) => Object.assign(new Error(code), { code, path });
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);

function selectedWave(plan, waveId, selectedAssetIds, allowSubset = false) {
  const wave = plan.cutsceneWorkflow?.waves?.find((item) => item.id === waveId);
  if (!wave) throw coded("cutscene.wave_unknown", "/waveId");
  const validSubset = Array.isArray(selectedAssetIds) && selectedAssetIds.length > 0 && [...selectedAssetIds].every((assetId, index) => id.test(assetId) && wave.assetIds.includes(assetId) && (index === 0 || selectedAssetIds[index - 1] < assetId));
  if (!validSubset || (!allowSubset && !same(selectedAssetIds, wave.assetIds))) throw coded("cutscene.selected_asset_ids_invalid", "/selectedAssetIds");
  return wave;
}

function assertAttemptState(state, estimate, receipt) {
  if (!state || !Number.isInteger(state.failedAttempts) || state.failedAttempts < 0) throw coded("cutscene.attempt_state_invalid", "/attemptState/failedAttempts");
  if (!Number.isFinite(state.accumulatedUsd) || state.accumulatedUsd < 0) throw coded("cutscene.attempt_state_invalid", "/attemptState/accumulatedUsd");
  if (state.failedAttempts > estimate.retryReserve) throw coded("cutscene.retry_reserve_exhausted", "/cutsceneWorkflow/waves/0/attempts/1");
  if (state.accumulatedUsd + estimate.maximumUsd > receipt.maximumApprovedUsd) throw coded("cutscene.maximum_possible_cost_exceeded", "/cutsceneWorkflow/waves/0/estimate/maximumUsd");
}

async function receiptLedger(artifactRoot, waveId, assetIds) {
  const result = { failedAttempts: 0, accumulatedUsd: 0, unavailableAttempts: 0, failedAssetIds: new Set(), latest: new Map() };
  const base = path.join(artifactRoot, "cutscene", "usage-receipts", waveId);
  for (const assetId of assetIds) {
    const directory = path.join(base, assetId);
    const names = await readdir(directory).catch((error) => error?.code === "ENOENT" ? [] : Promise.reject(error));
    const ordinals = new Set();
    for (const name of names) {
      if (!name.endsWith(".json")) throw coded("cutscene.usage_receipt_corrupt", `/cutscene/usage-receipts/${waveId}/${assetId}`);
      let record;
      try { record = JSON.parse(await readFile(path.join(directory, name), "utf8")); } catch { throw coded("cutscene.usage_receipt_corrupt", `/cutscene/usage-receipts/${waveId}/${assetId}/${name}`); }
      if (!record || record.schemaVersion !== 1 || record.waveId !== waveId || record.assetId !== assetId || !requestId.test(record.attemptId ?? "") || !Number.isInteger(record.attemptOrdinal) || record.attemptOrdinal < 1 || !["success", "provider-failure", "transport-failure"].includes(record.outcome) || !requestId.test(record.providerRequestId ?? "")) throw coded("cutscene.usage_receipt_corrupt", `/cutscene/usage-receipts/${waveId}/${assetId}/${name}`);
      if (name !== `${record.attemptId}-${record.providerRequestId}.json` || ordinals.has(record.attemptOrdinal)) throw coded("cutscene.usage_receipt_corrupt", `/cutscene/usage-receipts/${waveId}/${assetId}/${name}`);
      ordinals.add(record.attemptOrdinal);
      const prior = result.latest.get(assetId);
      if (!prior || prior.attemptOrdinal < record.attemptOrdinal) result.latest.set(assetId, record);
      if (record.actualCost?.status === "known" && Number.isFinite(record.actualCost.usd)) result.accumulatedUsd += record.actualCost.usd;
      else result.unavailableAttempts += 1;
    }
    const latest = result.latest.get(assetId);
    if (latest && latest.outcome !== "success") { result.failedAttempts += 1; result.failedAssetIds.add(assetId); }
  }
  return result;
}

function assertCurrent(input) {
  if (input.plan?.mode !== "generate-after-approval") throw coded("cutscene.mode_generation_forbidden", "/mode");
  validateCutsceneManifestHandoff({ manifest: input.manifest });
  selectedWave(input.plan, input.waveId, input.selectedAssetIds, input.retry === true);
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
  if (input.provider === undefined || input.provider === "openai") return "openai";
  throw coded("cutscene.provider_forbidden", "/provider");
}

export async function writeCutsceneUsageReceipt({ artifactRoot, waveId, assetId, attemptId, attemptOrdinal, providerRequestId, outcome, usage, pricingSnapshot } = {}) {
  if (!id.test(assetId ?? "")) throw coded("cutscene.asset_id_invalid", "/assetId");
  if (typeof waveId !== "string" || !waveId) throw coded("cutscene.wave_id_invalid", "/waveId");
  if (typeof attemptId !== "string" || !requestId.test(attemptId)) throw coded("cutscene.attempt_id_invalid", "/attemptId");
  if (!Number.isInteger(attemptOrdinal) || attemptOrdinal < 1) throw coded("cutscene.attempt_ordinal_invalid", "/attemptOrdinal");
  const safeProviderRequestId = providerRequestId === undefined ? "no-request-id" : providerRequestId;
  if (safeProviderRequestId !== "no-request-id" && !requestId.test(safeProviderRequestId)) throw coded("cutscene.provider_request_id_invalid", "/providerRequestId");
  if (!["success", "provider-failure", "transport-failure"].includes(outcome)) throw coded("cutscene.attempt_outcome_invalid", "/outcome");
  const usageRecord = usage ?? { status: "unavailable", reason: "provider-usage-unavailable" };
  const actualCost = usage ? calculateActualCost({ pricingSnapshot, usage }) : { status: "unavailable", reason: "provider-usage-unavailable" };
  const receipt = Object.freeze({ schemaVersion: 1, waveId, assetId, attemptId, attemptOrdinal, providerRequestId: safeProviderRequestId, outcome, usage: Object.freeze({ ...usageRecord }), actualCost: Object.freeze({ ...actualCost }) });
  if (artifactRoot) {
    const root = await ensureArtifactDirectories({ artifactRoot, directories: ["cutscene", "cutscene/usage-receipts", `cutscene/usage-receipts/${waveId}`, `cutscene/usage-receipts/${waveId}/${assetId}`] });
    const relativePath = `cutscene/usage-receipts/${waveId}/${assetId}/${attemptId}-${safeProviderRequestId}.json`;
    await safeWriteArtifactFile({ artifactRoot: root, relativePath, data: `${JSON.stringify(receipt, null, 2)}\n`, policy: "create-once" });
  }
  return Object.freeze({ actualCost, receipt });
}

export async function runApprovedCutsceneImageWave(input = {}) {
  // This guard intentionally precedes every filesystem operation and every
  // authority check: prompt/estimate-only is a zero-provider, zero-write mode.
  assertCurrent(input);
  const provider = providerFrom(input);
  const wave = selectedWave(input.plan, input.waveId, input.selectedAssetIds, input.retry === true);
  const attempts = new Map();
  let callerStateValidated = false;
  const beforeProvider = async ({ asset_id, attempt_ordinal }) => {
    const approved = assertCurrent(input);
    const ledger = await receiptLedger(input.artifactRoot, input.waveId, wave.assetIds);
    if (!callerStateValidated && input.attemptState && (input.attemptState.failedAttempts !== ledger.failedAttempts || input.attemptState.accumulatedUsd !== ledger.accumulatedUsd)) throw coded("cutscene.attempt_state_stale", "/attemptState");
    callerStateValidated = true;
    const perAttemptWorstCase = input.estimate.maximumUsd / (wave.assetIds.length * (input.estimate.retryReserve + 1));
    assertAttemptState({ failedAttempts: ledger.failedAttempts, accumulatedUsd: ledger.accumulatedUsd + ledger.unavailableAttempts * perAttemptWorstCase }, input.estimate, approved);
    const key = `${asset_id}:${attempt_ordinal}`;
    if (!attempts.has(key)) attempts.set(key, Object.freeze({ waveId: input.waveId, assetId: asset_id, attemptId: randomUUID(), attemptOrdinal: attempt_ordinal }));
    return attempts.get(key);
  };
  const afterProvider = async (dispatch) => writeCutsceneUsageReceipt({ artifactRoot: input.artifactRoot, pricingSnapshot: input.pricingSnapshot, ...dispatch });
  const result = await runConfiguredSelectedImageAssetWorkflow({
    workspaceRoot: input.workspaceRoot ?? input.artifactRoot, env: input.env ?? {}, artifactRoot: input.artifactRoot,
    manifest: input.manifest, selectedAssetIds: input.selectedAssetIds, provider,
    apiKey: input.apiKey ?? input.env?.OPENAI_API_KEY, fetchFn: input.fetchFn, hostGenerate: input.hostGenerate,
    beforeProvider, afterProvider, now: () => input.now, sleepFn: input.sleepFn,
  });
  return { ...result, attempts: [...attempts.values()] };
}

export async function retryCutsceneFailedAssets({ failedAssetIds, ...input } = {}) {
  const wave = selectedWave(input.plan, input.waveId, failedAssetIds, true);
  const ledger = await receiptLedger(input.artifactRoot, input.waveId, wave.assetIds);
  if (!failedAssetIds.every((assetId) => ledger.failedAssetIds.has(assetId))) throw coded("cutscene.retry_asset_not_failed", "/failedAssetIds");
  const output = await runApprovedCutsceneImageWave({ ...input, retry: true, selectedAssetIds: failedAssetIds });
  return { retriedIds: [...failedAssetIds], unaffectedOutputSha256: null, output };
}
