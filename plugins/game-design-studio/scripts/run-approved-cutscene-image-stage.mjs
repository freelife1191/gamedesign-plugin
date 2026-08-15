import { createHash, randomUUID } from "node:crypto";
import { lstat, mkdir, readdir, readFile, rmdir } from "node:fs/promises";
import path from "node:path";
import { types } from "node:util";

import { assertCurrentCutsceneEstimate, buildCutsceneDispatchSnapshot, calculateActualCost, resolveCutsceneGenerationAuthority } from "./estimate-cutscene-image-cost.mjs";
import { validateHostCutsceneApproval } from "./lib/cutscene-generation-approval.mjs";
import { isRfc3339DateTime } from "./lib/rfc3339.mjs";
import { ensureArtifactDirectories, safeWriteArtifactFile } from "./lib/safe-artifact-write.mjs";
import { cutsceneDocumentSha256, snapshotCutscenePlainData } from "./validate-cutscene-visual-preproduction.mjs";
import { runConfiguredSelectedImageAssetWorkflow } from "./run-image-asset-workflow.mjs";

const stableId = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u;
const opaqueId = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const hashPattern = /^[a-f0-9]{64}$/u;
const compareUtf8 = (left, right) => Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
const coded = (code, pathValue) => Object.assign(new Error(code), { code, path: pathValue });
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const withoutSha = ({ sha256: _sha256, ...content }) => content;
const recordSha256 = (record) => cutsceneDocumentSha256(withoutSha(record));
const sequenceName = (sequence) => String(sequence).padStart(8, "0");
const unavailableUsageReasons = new Set(["provider-not-called", "provider-usage-unavailable", "provider-usage-invalid"]);
const publicInputKeys = new Set(["apiKey", "approvalEvent", "artifactRoot", "attemptState", "authorizeProviderAttempt", "capability", "env", "estimate", "failedAssetIds", "fetchFn", "hostGenerate", "manifest", "now", "plan", "pricingSnapshot", "promptPackage", "receipt", "retry", "selectedAssetIds", "sleepFn", "waveId", "workspaceRoot"]);

function plain(value) { return value !== null && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype; }
function exact(value, keys) { return plain(value) && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key)); }
function deepFreeze(value) { if (value && typeof value === "object" && !Object.isFrozen(value)) { Object.freeze(value); for (const nested of Object.values(value)) deepFreeze(nested); } return value; }

function normalizePublicInput(rawInput) {
  const hostile = (pathValue = "") => { throw coded("cutscene.hostile_input", pathValue); };
  if (rawInput === null || typeof rawInput !== "object" || Array.isArray(rawInput)) hostile();
  try { if (types.isProxy(rawInput)) hostile(); } catch { hostile(); }
  let descriptors;
  try { descriptors = Object.getOwnPropertyDescriptors(rawInput); } catch { hostile(); }
  const output = {};
  for (const key of Reflect.ownKeys(descriptors)) {
    const descriptor = descriptors[key];
    const pathValue = `/${String(key)}`;
    if (typeof key !== "string" || !publicInputKeys.has(key) || !descriptor?.enumerable || !("value" in descriptor) || "get" in descriptor || "set" in descriptor) hostile(pathValue);
    Object.defineProperty(output, key, { value: descriptor.value, enumerable: true, writable: true, configurable: true });
  }
  return output;
}

function selectedWave(plan, waveId, selectedAssetIds, allowSubset = false) {
  const wave = plan.cutsceneWorkflow?.waves?.find((item) => item.id === waveId);
  if (!wave) throw coded("cutscene.wave_unknown", "/waveId");
  const sorted = Array.isArray(selectedAssetIds) ? [...selectedAssetIds].sort(compareUtf8) : [];
  const validSubset = sorted.length > 0 && same(sorted, selectedAssetIds) && new Set(sorted).size === sorted.length && sorted.every((assetId) => stableId.test(assetId) && wave.assetIds.includes(assetId));
  if (!validSubset || (!allowSubset && !same(sorted, [...wave.assetIds].sort(compareUtf8)))) throw coded("cutscene.selected_asset_ids_invalid", "/selectedAssetIds");
  return wave;
}

function assertCompletedPredecessors(plan, waveId) {
  const targetIndex = plan.cutsceneWorkflow.waves.findIndex(({ id }) => id === waveId);
  for (let index = 0; index < targetIndex; index += 1) {
    const wave = plan.cutsceneWorkflow.waves[index];
    if (wave.state !== "completed") throw coded("cutscene.predecessor_wave_incomplete", `/cutsceneWorkflow/waves/${index}/state`);
    if (wave.completion == null) throw coded("cutscene.predecessor_completion_missing", `/cutsceneWorkflow/waves/${index}/completion`);
    if (wave.completion.kind !== "completed") throw coded("cutscene.predecessor_completion_kind_invalid", `/cutsceneWorkflow/waves/${index}/completion/kind`);
    if (!same(wave.completion.assetIds, wave.assetIds)) throw coded("cutscene.predecessor_completion_asset_set_mismatch", `/cutsceneWorkflow/waves/${index}/completion/assetIds`);
  }
}

function journalRelativePath(record) {
  return `cutscene/usage-receipts/${record.waveId}/${record.assetId}/${sequenceName(record.attemptSequence)}-${record.attemptId}.${record.kind}.json`;
}

function validateAuthorization(record, waveId, assetId, name) {
  const keys = ["schemaVersion", "kind", "waveId", "assetId", "attemptId", "attemptSequence", "assetAttemptOrdinal", "requestSha256", "pricingSnapshotSha256", "costEstimateSha256", "authorizedMaximumUsd", "authorizedAt", "sha256"];
  if (!exact(record, keys) || record.schemaVersion !== 2 || record.kind !== "authorization" || record.waveId !== waveId || record.assetId !== assetId
    || !opaqueId.test(record.attemptId ?? "") || !Number.isInteger(record.attemptSequence) || record.attemptSequence < 1
    || !Number.isInteger(record.assetAttemptOrdinal) || record.assetAttemptOrdinal < 1 || !hashPattern.test(record.requestSha256 ?? "")
    || !hashPattern.test(record.pricingSnapshotSha256 ?? "") || !hashPattern.test(record.costEstimateSha256 ?? "")
    || !Number.isFinite(record.authorizedMaximumUsd) || record.authorizedMaximumUsd <= 0 || !isRfc3339DateTime(record.authorizedAt)
    || record.sha256 !== recordSha256(record) || name !== path.posix.basename(journalRelativePath(record))) throw coded("cutscene.usage_receipt_corrupt", `/cutscene/usage-receipts/${waveId}/${assetId}/${name}`);
}

function validUsage(value) {
  if (exact(value, ["status", "reason"])) return value.status === "unavailable" && unavailableUsageReasons.has(value.reason);
  const required = ["inputTokens", "inputTextTokens", "inputImageTokens", "outputTokens", "totalTokens"];
  const optional = ["cachedTextTokens", "cachedImageTokens"];
  return plain(value) && Object.keys(value).every((key) => [...required, ...optional].includes(key)) && required.every((key) => Number.isInteger(value[key]) && value[key] >= 0)
    && optional.every((key) => value[key] === undefined || Number.isInteger(value[key]) && value[key] >= 0)
    && value.inputTokens === value.inputTextTokens + value.inputImageTokens
    && value.totalTokens === value.inputTokens + value.outputTokens
    && (value.cachedTextTokens === undefined || value.cachedTextTokens <= value.inputTextTokens)
    && (value.cachedImageTokens === undefined || value.cachedImageTokens <= value.inputImageTokens);
}

function validActualCost(value) {
  return exact(value, ["status", "usd"]) && value.status === "known" && Number.isFinite(value.usd) && value.usd >= 0
    || exact(value, ["status", "reason"]) && value.status === "unavailable" && typeof value.reason === "string" && value.reason.length > 0;
}

function validateOutcome(record, waveId, assetId, name) {
  const keys = ["schemaVersion", "kind", "waveId", "assetId", "attemptId", "attemptSequence", "assetAttemptOrdinal", "authorizationSha256", "providerRequestId", "providerOutcome", "assetOutcome", "retryDisposition", "usage", "actualCost", "completedAt", "sha256"];
  if (!exact(record, keys) || record.schemaVersion !== 2 || record.kind !== "outcome" || record.waveId !== waveId || record.assetId !== assetId
    || !opaqueId.test(record.attemptId ?? "") || !Number.isInteger(record.attemptSequence) || record.attemptSequence < 1
    || !Number.isInteger(record.assetAttemptOrdinal) || record.assetAttemptOrdinal < 1 || !hashPattern.test(record.authorizationSha256 ?? "")
    || !opaqueId.test(record.providerRequestId ?? "") || !["success", "provider-failure", "transport-failure", "not-called"].includes(record.providerOutcome)
    || !["success", "retryable-failure", "terminal-failure", "not-attempted"].includes(record.assetOutcome)
    || !["retryable", "none"].includes(record.retryDisposition) || !validUsage(record.usage) || !validActualCost(record.actualCost)
    || !isRfc3339DateTime(record.completedAt) || record.sha256 !== recordSha256(record) || name !== path.posix.basename(journalRelativePath(record))
    || (record.providerOutcome === "not-called") !== (record.assetOutcome === "not-attempted")
    || (record.providerOutcome !== "not-called" && record.usage?.reason === "provider-not-called")
    || (record.retryDisposition === "retryable") !== (record.assetOutcome === "retryable-failure")) throw coded("cutscene.usage_receipt_corrupt", `/cutscene/usage-receipts/${waveId}/${assetId}/${name}`);
}

async function readJournal(artifactRoot, waveId, assetIds, { estimate, pricingSnapshot } = {}) {
  const base = path.join(artifactRoot, "cutscene", "usage-receipts", waveId);
  const expectedAssets = new Set(assetIds);
  const assetEntries = await readdir(base, { withFileTypes: true }).catch((error) => error?.code === "ENOENT" ? [] : Promise.reject(error));
  if (assetEntries.some((entry) => !entry.isDirectory() || !expectedAssets.has(entry.name))) throw coded("cutscene.usage_receipt_corrupt", `/cutscene/usage-receipts/${waveId}`);
  const authorizations = [];
  const outcomes = [];
  for (const assetId of assetIds) {
    const directory = path.join(base, assetId);
    const entries = await readdir(directory, { withFileTypes: true }).catch((error) => error?.code === "ENOENT" ? [] : Promise.reject(error));
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".json")) throw coded("cutscene.usage_receipt_corrupt", `/cutscene/usage-receipts/${waveId}/${assetId}`);
      let record;
      try { record = JSON.parse(await readFile(path.join(directory, entry.name), "utf8")); } catch { throw coded("cutscene.usage_receipt_corrupt", `/cutscene/usage-receipts/${waveId}/${assetId}/${entry.name}`); }
      if (record?.kind === "authorization") { validateAuthorization(record, waveId, assetId, entry.name); authorizations.push(record); }
      else if (record?.kind === "outcome") { validateOutcome(record, waveId, assetId, entry.name); outcomes.push(record); }
      else throw coded("cutscene.usage_receipt_corrupt", `/cutscene/usage-receipts/${waveId}/${assetId}/${entry.name}`);
    }
  }
  authorizations.sort((left, right) => left.attemptSequence - right.attemptSequence);
  const sequenceSet = new Set(); const attemptSet = new Set(); const ordinalByAsset = new Map();
  for (const [index, authorization] of authorizations.entries()) {
    if (authorization.attemptSequence !== index + 1 || sequenceSet.has(authorization.attemptSequence) || attemptSet.has(authorization.attemptId)) throw coded("cutscene.usage_receipt_corrupt", `/cutscene/usage-receipts/${waveId}`);
    sequenceSet.add(authorization.attemptSequence); attemptSet.add(authorization.attemptId);
    const expectedOrdinal = (ordinalByAsset.get(authorization.assetId) ?? 0) + 1;
    if (authorization.assetAttemptOrdinal !== expectedOrdinal) throw coded("cutscene.usage_receipt_corrupt", `/cutscene/usage-receipts/${waveId}/${authorization.assetId}`);
    ordinalByAsset.set(authorization.assetId, expectedOrdinal);
  }
  const authorizationById = new Map(authorizations.map((record) => [record.attemptId, record]));
  const ceilingByAsset = new Map(estimate?.attemptCeilings?.map((ceiling) => [ceiling.assetId, ceiling]) ?? []);
  for (const authorization of authorizations) {
    const ceiling = ceilingByAsset.get(authorization.assetId);
    if (!ceiling || authorization.requestSha256 !== ceiling.requestSha256 || authorization.pricingSnapshotSha256 !== pricingSnapshot?.sha256
      || authorization.costEstimateSha256 !== estimate?.sha256 || authorization.authorizedMaximumUsd !== ceiling.maximumUsd) throw coded("cutscene.usage_receipt_corrupt", `/cutscene/usage-receipts/${waveId}/${authorization.assetId}`);
  }
  const outcomeById = new Map();
  for (const outcome of outcomes) {
    const authorization = authorizationById.get(outcome.attemptId);
    if (!authorization || outcomeById.has(outcome.attemptId) || outcome.attemptSequence !== authorization.attemptSequence || outcome.assetAttemptOrdinal !== authorization.assetAttemptOrdinal
      || outcome.assetId !== authorization.assetId || outcome.authorizationSha256 !== authorization.sha256) throw coded("cutscene.usage_receipt_corrupt", `/cutscene/usage-receipts/${waveId}/${outcome.assetId}`);
    const expectedCost = outcome.providerOutcome === "not-called" ? { status: "known", usd: 0 }
      : outcome.usage?.status === "unavailable" ? { status: "unavailable", reason: outcome.usage.reason }
        : calculateActualCost({ pricingSnapshot, usage: outcome.usage });
    if (!same(outcome.actualCost, expectedCost)) throw coded("cutscene.usage_receipt_corrupt", `/cutscene/usage-receipts/${waveId}/${outcome.assetId}`);
    outcomeById.set(outcome.attemptId, outcome);
  }
  const physicalCounts = new Map(assetIds.map((assetId) => [assetId, 0]));
  const latest = new Map();
  let accountedUsd = 0;
  for (const authorization of authorizations) {
    const outcome = outcomeById.get(authorization.attemptId);
    const physical = !outcome || outcome.providerOutcome !== "not-called";
    if (physical) physicalCounts.set(authorization.assetId, physicalCounts.get(authorization.assetId) + 1);
    if (!outcome || outcome.actualCost.status === "unavailable") accountedUsd += authorization.authorizedMaximumUsd;
    else accountedUsd += outcome.actualCost.usd;
    if (outcome) latest.set(authorization.assetId, outcome);
  }
  const retryConsumed = [...physicalCounts.values()].reduce((total, count) => total + Math.max(count - 1, 0), 0);
  return { authorizations, outcomes, outcomeById, physicalCounts, latest, accountedUsd, retryConsumed, ordinalByAsset };
}

function assertCurrent(rawInput, explicitRetry = false) {
  const input = normalizePublicInput(rawInput);
  if (!Object.hasOwn(input, "plan") || input.plan === undefined) throw coded("cutscene.hostile_input", "/plan");
  const plan = snapshotCutscenePlainData(input.plan);
  if (plan.mode !== "generate-after-approval") throw coded("cutscene.mode_generation_forbidden", "/mode");
  if (Object.hasOwn(input, "authorizeProviderAttempt")) throw coded("cutscene.authorization_seam_forbidden", "/authorizeProviderAttempt");
  const wave = selectedWave(plan, input.waveId, input.selectedAssetIds, explicitRetry);
  assertCompletedPredecessors(plan, wave.id);
  const authority = resolveCutsceneGenerationAuthority({ plan, promptPackage: input.promptPackage });
  const estimate = assertCurrentCutsceneEstimate({ estimate: input.estimate, authority, pricingSnapshot: input.pricingSnapshot });
  if (estimate.costStatus !== "available") throw coded("cutscene.cost_estimate_unavailable", "/estimate/costStatus");
  const approved = validateHostCutsceneApproval({ receipt: input.receipt, capability: input.capability, approvalEvent: input.approvalEvent, plan, promptPackage: input.promptPackage, manifest: input.manifest, pricingSnapshot: input.pricingSnapshot, estimate, now: input.now });
  const dispatch = buildCutsceneDispatchSnapshot({ plan, promptPackage: input.promptPackage, manifest: input.manifest, waveId: input.waveId, pricingSnapshot: input.pricingSnapshot, selectedAssetIds: input.selectedAssetIds });
  const expectedRequests = new Map(estimate.attemptCeilings.map((ceiling) => [ceiling.assetId, ceiling]));
  for (const request of dispatch.requests) if (expectedRequests.get(request.assetId)?.requestSha256 !== request.requestSha256) throw coded("cutscene.cost_estimate_stale", "/estimate/attemptCeilings");
  return { input: { ...input, plan }, plan, wave, authority, estimate, approved, dispatch };
}

async function createAuthorizationLocked({ input, wave, request, ceiling }, root) {
  const ledger = await readJournal(input.artifactRoot, input.waveId, [...wave.assetIds].sort(compareUtf8), { estimate: input.estimate, pricingSnapshot: input.pricingSnapshot });
  const existingCount = ledger.physicalCounts.get(request.assetId) ?? 0;
  const latest = ledger.latest.get(request.assetId);
  if (latest?.assetOutcome === "success") throw coded("cutscene.asset_already_succeeded", "/selectedAssetIds");
  const retryCandidate = existingCount >= 1;
  if (ledger.retryConsumed + (retryCandidate ? 1 : 0) > input.estimate.retryReserve) throw coded("cutscene.retry_reserve_exhausted", `/cutsceneWorkflow/waves/${input.plan.cutsceneWorkflow.waves.findIndex(({ id }) => id === input.waveId)}/attempts/${ledger.authorizations.length}`);
  const remaining = input.estimate.attemptCeilings.reduce((total, item) => total + ((ledger.physicalCounts.get(item.assetId) ?? 0) === 0 && item.assetId !== request.assetId ? item.maximumUsd : 0), 0);
  if (ledger.accountedUsd + ceiling.maximumUsd + remaining > input.receipt.maximumApprovedUsd + Number.EPSILON) throw coded("cutscene.maximum_possible_cost_exceeded", `/cutsceneWorkflow/waves/${input.plan.cutsceneWorkflow.waves.findIndex(({ id }) => id === input.waveId)}/estimate/maximumUsd`);
  const authorization = {
    schemaVersion: 2, kind: "authorization", waveId: input.waveId, assetId: request.assetId, attemptId: randomUUID(),
    attemptSequence: ledger.authorizations.length + 1, assetAttemptOrdinal: (ledger.ordinalByAsset.get(request.assetId) ?? 0) + 1,
    requestSha256: request.requestSha256, pricingSnapshotSha256: input.pricingSnapshot.sha256, costEstimateSha256: input.estimate.sha256,
    authorizedMaximumUsd: ceiling.maximumUsd, authorizedAt: input.now,
  };
  authorization.sha256 = recordSha256(authorization);
  await safeWriteArtifactFile({ artifactRoot: root, relativePath: journalRelativePath(authorization), data: `${JSON.stringify(authorization, null, 2)}\n`, policy: "create-once" });
  return Object.freeze({ ...authorization, authorizationSha256: authorization.sha256 });
}

async function createAuthorization(args) {
  const { input, request } = args;
  const root = await ensureArtifactDirectories({
    artifactRoot: input.artifactRoot,
    directories: ["cutscene", "cutscene/usage-receipts", `cutscene/usage-receipts/${input.waveId}`, `cutscene/usage-receipts/${input.waveId}/${request.assetId}`, "cutscene/usage-receipt-locks"],
  });
  const lockPath = path.join(root, "cutscene", "usage-receipt-locks", `${input.waveId}.lock`);
  try {
    await mkdir(lockPath);
  } catch (error) {
    if (error?.code === "EEXIST") throw coded("cutscene.authorization_sequence_busy", `/cutscene/usage-receipts/${input.waveId}`);
    throw error;
  }
  try {
    return await createAuthorizationLocked(args, root);
  } finally {
    await rmdir(lockPath);
  }
}

async function createOutcome({ input, dispatch, providerRequestId = "no-request-id", providerOutcome, assetOutcome, retryDisposition, usage }) {
  const safeProviderRequestId = providerRequestId ?? "no-request-id";
  if (!opaqueId.test(safeProviderRequestId)) throw coded("cutscene.provider_request_id_invalid", "/providerRequestId");
  const usageRecord = providerOutcome === "not-called"
    ? { status: "unavailable", reason: "provider-not-called" }
    : !usage || !validUsage(usage)
      ? { status: "unavailable", reason: usage ? "provider-usage-invalid" : "provider-usage-unavailable" }
      : (() => {
        try { calculateActualCost({ pricingSnapshot: input.pricingSnapshot, usage }); return usage; } catch { return { status: "unavailable", reason: "provider-usage-invalid" }; }
      })();
  const actualCost = providerOutcome === "not-called" ? { status: "known", usd: 0 }
    : usageRecord.status === "unavailable" ? { status: "unavailable", reason: usageRecord.reason }
      : calculateActualCost({ pricingSnapshot: input.pricingSnapshot, usage: usageRecord });
  const outcome = {
    schemaVersion: 2, kind: "outcome", waveId: dispatch.waveId, assetId: dispatch.assetId, attemptId: dispatch.attemptId,
    attemptSequence: dispatch.attemptSequence, assetAttemptOrdinal: dispatch.assetAttemptOrdinal, authorizationSha256: dispatch.authorizationSha256,
    providerRequestId: safeProviderRequestId, providerOutcome, assetOutcome, retryDisposition, usage: usageRecord, actualCost, completedAt: input.now,
  };
  outcome.sha256 = recordSha256(outcome);
  const root = await ensureArtifactDirectories({ artifactRoot: input.artifactRoot, directories: ["cutscene", "cutscene/usage-receipts", `cutscene/usage-receipts/${input.waveId}`, `cutscene/usage-receipts/${input.waveId}/${dispatch.assetId}`] });
  await safeWriteArtifactFile({ artifactRoot: root, relativePath: journalRelativePath(outcome), data: `${JSON.stringify(outcome, null, 2)}\n`, policy: "create-once" });
  return outcome;
}

async function runApprovedCutsceneImageWaveInternal(rawInput, explicitRetry = false) {
  const current = assertCurrent(rawInput, explicitRetry);
  const currentInput = current.input;
  if (!explicitRetry) {
    const existing = await readJournal(currentInput.artifactRoot, currentInput.waveId, [...current.wave.assetIds].sort(compareUtf8), { estimate: currentInput.estimate, pricingSnapshot: currentInput.pricingSnapshot });
    if (current.dispatch.assetIds.some((assetId) => (existing.physicalCounts.get(assetId) ?? 0) > 0)) throw coded("cutscene.asset_already_attempted", "/selectedAssetIds");
  }
  const ceilingByAsset = new Map(current.estimate.attemptCeilings.map((ceiling) => [ceiling.assetId, ceiling]));
  let queue = Promise.resolve();
  const beforeProvider = ({ asset_id }) => {
    const task = queue.then(async () => {
      const revalidated = assertCurrent(currentInput, explicitRetry);
      const request = revalidated.dispatch.requests.find(({ assetId }) => assetId === asset_id);
      const ceiling = ceilingByAsset.get(asset_id);
      if (!request || !ceiling || request.requestSha256 !== ceiling.requestSha256) throw coded("cutscene.cost_estimate_stale", "/estimate/attemptCeilings");
      return createAuthorization({ input: currentInput, wave: current.wave, request, ceiling });
    });
    queue = task.catch(() => {});
    return task;
  };
  const afterProvider = (dispatch) => createOutcome({ input: currentInput, dispatch, ...dispatch });
  let executionDispatch = current.dispatch;
  if (explicitRetry) {
    let existing;
    try { existing = JSON.parse(await readFile(path.join(currentInput.artifactRoot, "assets", "image-assets.yml"), "utf8")); } catch { throw coded("cutscene.retry_state_invalid", "/assets/image-assets.yml"); }
    const existingById = new Map(existing.assets?.map((asset) => [asset.asset_id, asset]));
    const manifest = structuredClone(current.dispatch.manifest);
    manifest.assets = manifest.assets.map((asset) => {
      const prior = existingById.get(asset.asset_id);
      if (!prior) throw coded("cutscene.retry_state_invalid", "/assets/image-assets.yml");
      if (!currentInput.selectedAssetIds.includes(asset.asset_id)) return prior;
      return { ...asset, generation_state: prior.generation_state, ...(prior.generation_receipts ? { generation_receipts: prior.generation_receipts } : {}) };
    });
    executionDispatch = deepFreeze({ ...current.dispatch, manifest });
  }
  if (executionDispatch.requests.some(({ request }) => request.referenceDigests.length > 0)) {
    await ensureArtifactDirectories({ artifactRoot: currentInput.artifactRoot, directories: ["assets", "assets/receipts"] });
  }
  const result = await runConfiguredSelectedImageAssetWorkflow({
    artifactRoot: currentInput.artifactRoot, dispatchSnapshot: executionDispatch, apiKey: currentInput.apiKey ?? currentInput.env?.OPENAI_API_KEY,
    fetchFn: currentInput.fetchFn, hostGenerate: currentInput.hostGenerate, beforeProvider, afterProvider, now: () => currentInput.now, sleepFn: currentInput.sleepFn,
  });
  const ledger = await readJournal(currentInput.artifactRoot, currentInput.waveId, [...current.wave.assetIds].sort(compareUtf8), { estimate: currentInput.estimate, pricingSnapshot: currentInput.pricingSnapshot });
  return { ...result, journal: { accountedUsd: ledger.accountedUsd, retryConsumed: ledger.retryConsumed, latest: Object.fromEntries(ledger.latest) } };
}

export async function runApprovedCutsceneImageWave(rawInput = {}) {
  const input = normalizePublicInput(rawInput);
  return runApprovedCutsceneImageWaveInternal(input);
}

async function physicalSubsetDigest(artifactRoot, mutableAssetIds, manifest) {
  const excluded = new Set();
  for (const asset of manifest.assets) if (mutableAssetIds.includes(asset.asset_id)) {
    excluded.add(asset.output?.path);
    for (const receipt of asset.generation_receipts ?? []) excluded.add(receipt.path);
  }
  const entries = [];
  async function visit(directory, relative = "") {
    const children = await readdir(directory, { withFileTypes: true }).catch((error) => error?.code === "ENOENT" ? [] : Promise.reject(error));
    for (const child of children.sort((left, right) => compareUtf8(left.name, right.name))) {
      const childRelative = relative ? `${relative}/${child.name}` : child.name;
      if (childRelative.startsWith("cutscene/usage-receipts/") && mutableAssetIds.some((assetId) => childRelative.includes(`/${assetId}/`))) continue;
      if (excluded.has(childRelative) || childRelative.startsWith("assets/receipts/") && mutableAssetIds.some((assetId) => childRelative.includes(`-${assetId}-`))) continue;
      const absolute = path.join(directory, child.name);
      const stats = await lstat(absolute);
      if (stats.isSymbolicLink()) throw coded("cutscene.unrelated_tree_invalid", `/${childRelative}`);
      if (stats.isDirectory()) await visit(absolute, childRelative);
      else if (stats.isFile()) {
        let bytes = await readFile(absolute);
        if (childRelative.startsWith("assets/receipts/") && childRelative.endsWith(".json")) {
          try {
            const receipt = JSON.parse(bytes);
            if (mutableAssetIds.includes(receipt.asset_id) || receipt.asset_ids?.some((assetId) => mutableAssetIds.includes(assetId))) continue;
          } catch { throw coded("cutscene.unrelated_tree_invalid", `/${childRelative}`); }
        }
        if (childRelative === "assets/image-assets.yml") {
          try {
            const value = JSON.parse(bytes);
            value.assets = value.assets.filter(({ asset_id: assetId }) => !mutableAssetIds.includes(assetId));
            bytes = Buffer.from(JSON.stringify(value));
          } catch { throw coded("cutscene.unrelated_tree_invalid", "/assets/image-assets.yml"); }
        }
        entries.push({ path: childRelative, sha256: createHash("sha256").update(bytes).digest("hex") });
      }
    }
  }
  await visit(artifactRoot);
  return cutsceneDocumentSha256(entries);
}

export async function retryCutsceneFailedAssets(rawInput = {}) {
  const input = normalizePublicInput(rawInput);
  const failedAssetIds = input.failedAssetIds;
  const retryInput = { ...input, selectedAssetIds: failedAssetIds };
  const current = assertCurrent(retryInput, true);
  const safeInput = current.input;
  const ledger = await readJournal(safeInput.artifactRoot, safeInput.waveId, [...current.wave.assetIds].sort(compareUtf8), { estimate: safeInput.estimate, pricingSnapshot: safeInput.pricingSnapshot });
  if (!failedAssetIds.every((assetId) => ledger.latest.get(assetId)?.assetOutcome === "retryable-failure")) throw coded("cutscene.retry_asset_not_failed", "/failedAssetIds");
  const before = await physicalSubsetDigest(safeInput.artifactRoot, failedAssetIds, safeInput.manifest);
  const output = await runApprovedCutsceneImageWaveInternal(safeInput, true);
  const after = await physicalSubsetDigest(safeInput.artifactRoot, failedAssetIds, safeInput.manifest);
  if (before !== after) throw coded("cutscene.unrelated_tree_changed", "/failedAssetIds");
  return { retriedIds: [...failedAssetIds], unaffectedOutputSha256: after, output };
}
