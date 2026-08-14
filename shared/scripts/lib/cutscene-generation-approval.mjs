import { createHash } from "node:crypto";

import { createLiveCutsceneApproval, isLiveCutsceneApprovalPair } from "./cutscene-generation-capabilities.mjs";
import { canonicalCutsceneDocument, cutsceneDocumentSha256, validateCutsceneVisualPlan } from "../validate-cutscene-visual-preproduction.mjs";

const HASH = /^[a-f0-9]{64}$/u;
const APPROVAL_MAX_AGE_MS = 15 * 60_000;
const PRICING_MAX_AGE_MS = 24 * 60 * 60_000;
const compareUtf8 = (left, right) => Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
const coded = (code, path) => Object.assign(new Error(code), { code, path });
const sameJson = (left, right) => JSON.stringify(left) === JSON.stringify(right);

function sortedUniqueAssetIds(assetIds, path = "/assetIds") {
  if (!Array.isArray(assetIds) || assetIds.length === 0 || assetIds.some((id) => typeof id !== "string" || id.length === 0)) throw coded("cutscene.asset_ids_invalid", path);
  const sorted = [...assetIds].sort(compareUtf8);
  if (new Set(assetIds).size !== assetIds.length || !sameJson(sorted, assetIds)) throw coded("cutscene.ids_unsorted_or_duplicate", path);
  return sorted;
}

function sortedUniqueReferences(referenceBindings, path = "/referenceBindings") {
  if (!Array.isArray(referenceBindings) || referenceBindings.length === 0) throw coded("cutscene.reference_bindings_empty", path);
  const sorted = referenceBindings.map((binding) => {
    if (!binding || typeof binding.assetId !== "string" || !HASH.test(binding.sha256 ?? "")) throw coded("cutscene.reference_binding_invalid", path);
    return { assetId: binding.assetId, sha256: binding.sha256 };
  }).sort((left, right) => compareUtf8(left.assetId, right.assetId));
  if (sorted.some((binding, index) => binding.assetId !== referenceBindings[index]?.assetId) || new Set(sorted.map(({ assetId }) => assetId)).size !== sorted.length) throw coded("cutscene.ids_unsorted_or_duplicate", path);
  return sorted;
}

function legacyPlanAuthority(plan) {
  if (!Array.isArray(plan?.waves) || !HASH.test(plan?.sha256 ?? "") || !HASH.test(plan?.promptPackageSha256 ?? "")) return null;
  return {
    planSha256: plan.sha256,
    promptPackageSha256: plan.promptPackageSha256,
    referenceBindings: sortedUniqueReferences(plan.referenceBindings),
    waves: plan.waves,
  };
}

function generationReadyAuthority(plan) {
  if (!plan || typeof plan !== "object" || !plan.plan || !plan.promptPackage) return null;
  const actualPlan = plan.plan;
  const promptPackage = plan.promptPackage;
  if (!validateCutsceneVisualPlan(actualPlan).ok || promptPackage?.kind !== "generation-ready") throw coded("cutscene.approval_authority_invalid", "/plan");
  const actualPlanSha256 = cutsceneDocumentSha256(actualPlan);
  const { promptPackageSha256, ...packageWithoutDigest } = promptPackage;
  const actualPromptSha256 = createHash("sha256").update(canonicalCutsceneDocument(packageWithoutDigest)).digest("hex");
  if (promptPackageSha256 !== actualPromptSha256) throw coded("cutscene.approval_authority_invalid", "/promptPackageSha256");
  return {
    planSha256: actualPlanSha256,
    promptPackageSha256: actualPromptSha256,
    referenceBindings: sortedUniqueReferences(promptPackage.references),
    waves: actualPlan.cutsceneWorkflow.waves,
  };
}

function planAuthority(plan) {
  const generationReady = generationReadyAuthority(plan);
  if (generationReady) return generationReady;
  const legacy = legacyPlanAuthority(plan);
  if (legacy) return legacy;
  if (validateCutsceneVisualPlan(plan).ok) throw coded("cutscene.prompt_package_required", "/promptPackage");
  throw coded("cutscene.approval_authority_invalid", "/plan");
}

function referenceMismatchPath(issued, current) {
  if (issued.length !== current.length) return "/referenceBindings";
  for (let index = 0; index < issued.length; index += 1) {
    if (issued[index].assetId !== current[index].assetId) return `/referenceBindings/${index}/assetId`;
    if (issued[index].sha256 !== current[index].sha256) return `/referenceBindings/${index}/sha256`;
  }
  return null;
}

function isHash(value) { return typeof value === "string" && HASH.test(value); }

function currentWaveIndex(plan, waveId) {
  const waves = Array.isArray(plan?.cutsceneWorkflow?.waves) ? plan.cutsceneWorkflow.waves : plan?.waves;
  return Array.isArray(waves) ? waves.findIndex((wave) => wave?.id === waveId) : -1;
}

export function cutsceneApprovalBinding({ plan, pricingSnapshot, estimate } = {}) {
  const authority = planAuthority(plan);
  if (!estimate || typeof estimate !== "object") throw coded("cutscene.cost_estimate_invalid", "/estimate");
  const wave = authority.waves.find(({ id }) => id === estimate.waveId);
  if (!wave) throw coded("cutscene.wave_unknown", "/waveId");
  const assetIds = sortedUniqueAssetIds(estimate.assetIds);
  if (!sameJson(assetIds, sortedUniqueAssetIds(wave.assetIds))) throw coded("cutscene.cost_estimate_stale", "/assetIds");
  if (!Number.isFinite(estimate.maximumUsd) || estimate.maximumUsd < 0) throw coded("cutscene.cost_estimate_invalid", "/maximumUsd");
  if (!Number.isInteger(estimate.retryReserve) || estimate.retryReserve < 0) throw coded("cutscene.retry_reserve_invalid", "/retryReserve");
  if (!isHash(pricingSnapshot?.sha256)) throw coded("cutscene.pricing_snapshot_invalid", "/pricingSnapshotSha256");
  if (!isHash(estimate.sha256)) throw coded("cutscene.cost_estimate_invalid", "/costEstimateSha256");
  return {
    waveId: estimate.waveId,
    assetIds,
    maximumApprovedUsd: estimate.maximumUsd,
    retryReserve: estimate.retryReserve,
    planSha256: authority.planSha256,
    promptPackageSha256: authority.promptPackageSha256,
    referenceBindings: authority.referenceBindings,
    pricingSnapshotSha256: pricingSnapshot.sha256,
    costEstimateSha256: estimate.sha256,
  };
}

export function issueCutsceneHumanApproval({ eventId, actor, reviewer, decision, decidedAt, context } = {}) {
  if (actor !== reviewer) throw coded("cutscene.approval_actor_mismatch", "/actor");
  if (typeof reviewer !== "string" || !reviewer.trim() || /\b(?:ai|agent|specialist|reviewer|designer|assistant)\b/iu.test(reviewer)) throw coded("cutscene.reviewer_role_like", "/reviewer");
  if (decision !== "approved") throw coded("cutscene.approval_decision_invalid", "/decision");
  if (typeof eventId !== "string" || !eventId) throw coded("cutscene.approval_event_required", "/eventId");
  if (typeof decidedAt !== "string" || !Number.isFinite(Date.parse(decidedAt))) throw coded("cutscene.timestamp_invalid", "/decidedAt");
  const assetIds = sortedUniqueAssetIds(context?.assetIds);
  const referenceBindings = sortedUniqueReferences(context?.referenceBindings);
  for (const field of ["planSha256", "promptPackageSha256", "pricingSnapshotSha256", "costEstimateSha256"]) if (!isHash(context?.[field])) throw coded("cutscene.hash_invalid", `/${field}`);
  if (typeof context?.waveId !== "string" || !Number.isFinite(context?.maximumApprovedUsd) || context.maximumApprovedUsd < 0 || !Number.isInteger(context?.retryReserve) || context.retryReserve < 0) throw coded("cutscene.approval_context_invalid", "/context");
  const receipt = Object.freeze({
    schemaVersion: 1,
    eventId,
    actor,
    reviewer,
    decision,
    decidedAt,
    waveId: context.waveId,
    assetIds: Object.freeze(assetIds),
    maximumApprovedUsd: context.maximumApprovedUsd,
    retryReserve: context.retryReserve,
    planSha256: context.planSha256,
    promptPackageSha256: context.promptPackageSha256,
    referenceBindings: Object.freeze(referenceBindings.map((binding) => Object.freeze(binding))),
    pricingSnapshotSha256: context.pricingSnapshotSha256,
    costEstimateSha256: context.costEstimateSha256,
  });
  const capability = createLiveCutsceneApproval(receipt);
  return Object.freeze({ receipt, capability });
}

export function assertCutsceneHumanApproval({ receipt, capability, context } = {}) {
  if (!receipt) throw coded("cutscene.approval_required", "/receipt");
  if (!isLiveCutsceneApprovalPair(receipt, capability)) throw coded("cutscene.approval_capability_invalid", "/capability");
  for (const [actual, expected, code, path] of [
    [context?.eventId, receipt.eventId, "cutscene.approval_event_mismatch", "/eventId"],
    [context?.actor, receipt.actor, "cutscene.approval_actor_mismatch", "/actor"],
    [context?.reviewer, receipt.reviewer, "cutscene.approval_reviewer_mismatch", "/reviewer"],
    [context?.decidedAt, receipt.decidedAt, "cutscene.approval_event_mismatch", "/decidedAt"],
  ]) if (actual !== expected) throw coded(code, path);
  if (receipt.waveId !== context?.waveId) throw coded("cutscene.approval_binding_stale", "/waveId");
  const currentAssetIds = sortedUniqueAssetIds(context?.assetIds);
  if (!sameJson(receipt.assetIds, currentAssetIds)) throw coded("cutscene.approval_binding_stale", "/assetIds");
  if (receipt.maximumApprovedUsd !== context?.maximumApprovedUsd) throw coded("cutscene.approval_binding_stale", "/maximumApprovedUsd");
  if (receipt.retryReserve !== context?.retryReserve) throw coded("cutscene.approval_binding_stale", "/retryReserve");
  if (receipt.planSha256 !== context?.planSha256) throw coded("cutscene.approval_binding_stale", "/planSha256");
  if (receipt.promptPackageSha256 !== context?.promptPackageSha256) throw coded("cutscene.approval_binding_stale", "/promptPackageSha256");
  const referencePath = referenceMismatchPath(receipt.referenceBindings, sortedUniqueReferences(context?.referenceBindings));
  if (referencePath) throw coded("cutscene.approval_binding_stale", referencePath);
  if (receipt.pricingSnapshotSha256 !== context?.pricingSnapshotSha256) throw coded("cutscene.approval_binding_stale", "/pricingSnapshotSha256");
  if (receipt.costEstimateSha256 !== context?.costEstimateSha256) throw coded("cutscene.approval_binding_stale", "/costEstimateSha256");
  const age = Date.parse(context?.now) - Date.parse(receipt.decidedAt);
  if (!Number.isFinite(age) || age < 0 || age > APPROVAL_MAX_AGE_MS) throw coded("cutscene.approval_receipt_stale", "/decidedAt");
  return receipt;
}

export function validateHostCutsceneApproval({ receipt, capability, approvalEvent, plan, pricingSnapshot, estimate, now } = {}) {
  if (!receipt && !capability) {
    const index = currentWaveIndex(plan, estimate?.waveId);
    if (index >= 0) throw coded("cutscene.approval_required", `/cutsceneWorkflow/waves/${index}/approval`);
  }
  const current = cutsceneApprovalBinding({ plan, pricingSnapshot, estimate });
  const context = { eventId: approvalEvent?.eventId, actor: approvalEvent?.actor, reviewer: approvalEvent?.reviewer, decidedAt: approvalEvent?.decidedAt, now, ...current };
  const approved = assertCutsceneHumanApproval({ receipt, capability, context });
  const age = Date.parse(now) - Date.parse(pricingSnapshot?.retrievedAt);
  if (!Number.isFinite(age) || age < 0 || age > PRICING_MAX_AGE_MS) throw coded("cutscene.pricing_snapshot_stale", "/retrievedAt");
  return approved;
}

export function requiresCutsceneReapproval({ receipt, plan, pricingSnapshot, estimate } = {}) {
  if (!receipt) return true;
  try {
    const current = cutsceneApprovalBinding({ plan, pricingSnapshot, estimate });
    return receipt.waveId !== current.waveId
      || !sameJson(receipt.assetIds, current.assetIds)
      || receipt.maximumApprovedUsd !== current.maximumApprovedUsd
      || receipt.retryReserve !== current.retryReserve
      || receipt.planSha256 !== current.planSha256
      || receipt.promptPackageSha256 !== current.promptPackageSha256
      || referenceMismatchPath(receipt.referenceBindings, current.referenceBindings) !== null
      || receipt.pricingSnapshotSha256 !== current.pricingSnapshotSha256
      || receipt.costEstimateSha256 !== current.costEstimateSha256;
  } catch {
    return true;
  }
}
