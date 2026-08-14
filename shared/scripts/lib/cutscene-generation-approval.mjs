import { types } from "node:util";

import { assertClosedPricingSnapshot, assertCurrentCutsceneEstimate, buildCutsceneDispatchSnapshot, resolveCutsceneGenerationAuthority } from "../estimate-cutscene-image-cost.mjs";
import { isRfc3339DateTime } from "./rfc3339.mjs";
import { validateCutsceneVisualPlan } from "../validate-cutscene-visual-preproduction.mjs";

const liveApprovals = new WeakMap();
const APPROVAL_MAX_AGE_MS = 15 * 60_000;
const PRICING_MAX_AGE_MS = 24 * 60 * 60_000;
const HASH = /^[a-f0-9]{64}$/u;
const ROLE_TOKEN = /^(?:openai|chatgpt|ai|assistant|agent|reviewer|bot|model|system|specialist|designer)(?:\d+)?$/iu;
const ROLE_COMPOUND_SUFFIX = /(?:openai|chatgpt|assistant|agent|reviewer|bot|model|system|specialist|designer)(?:\d+)?$/iu;
const compareUtf8 = (left, right) => Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
const coded = (code, path) => Object.assign(new Error(code), { code, path });
const sameJson = (left, right) => JSON.stringify(left) === JSON.stringify(right);

function humanName(value, path, code) {
  if (typeof value !== "string") throw coded(code, path);
  const normalized = value.normalize("NFKC").trim();
  const compact = normalized.toLocaleLowerCase("und").replace(/[^\p{L}\p{N}]/gu, "");
  const tokens = normalized.toLocaleLowerCase("und").split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  if (!normalized || normalized.length > 128 || /[\u0000-\u001f\u007f-\u009f]/u.test(normalized) || ROLE_COMPOUND_SUFFIX.test(compact) || tokens.some((token) => ROLE_TOKEN.test(token))) throw coded(code, path);
  return normalized;
}

function sortedAssetIds(assetIds, path = "/assetIds") {
  if (!Array.isArray(assetIds) || assetIds.length === 0 || assetIds.some((id) => typeof id !== "string" || !id)) throw coded("cutscene.asset_ids_invalid", path);
  const sorted = [...assetIds].sort(compareUtf8);
  if (!sameJson(sorted, assetIds) || new Set(assetIds).size !== assetIds.length) throw coded("cutscene.ids_unsorted_or_duplicate", path);
  return sorted;
}

function sortedReferences(references, path = "/referenceBindings") {
  if (!Array.isArray(references) || references.length === 0) throw coded("cutscene.reference_bindings_empty", path);
  const normalized = references.map((reference) => ({ assetId: reference?.assetId, sha256: reference?.sha256 }));
  if (normalized.some(({ assetId, sha256 }) => typeof assetId !== "string" || !HASH.test(sha256 ?? ""))) throw coded("cutscene.reference_binding_invalid", path);
  if (new Set(normalized.map(({ assetId }) => assetId)).size !== normalized.length) throw coded("cutscene.ids_unsorted_or_duplicate", path);
  return normalized.sort((left, right) => compareUtf8(left.assetId, right.assetId));
}

function bindingFromCurrent({ plan, promptPackage, manifest, pricingSnapshot, estimate }) {
  const authority = resolveCutsceneGenerationAuthority({ plan, promptPackage });
  const pricing = assertClosedPricingSnapshot(pricingSnapshot).pricingSnapshot;
  const currentEstimate = assertCurrentCutsceneEstimate({ estimate, authority, pricingSnapshot: pricing });
  if (currentEstimate.costStatus !== "available") throw coded("cutscene.cost_estimate_unavailable", "/estimate/costStatus");
  const dispatch = buildCutsceneDispatchSnapshot({ plan, promptPackage, manifest, waveId: currentEstimate.waveId, pricingSnapshot });
  for (const [index, request] of dispatch.requests.entries()) {
    if (currentEstimate.attemptCeilings[index]?.assetId !== request.assetId || currentEstimate.attemptCeilings[index]?.requestSha256 !== request.requestSha256) throw coded("cutscene.cost_estimate_stale", `/estimate/attemptCeilings/${index}/requestSha256`);
  }
  return {
    waveId: currentEstimate.waveId,
    assetIds: sortedAssetIds(currentEstimate.assetIds),
    maximumApprovedUsd: currentEstimate.maximumUsd,
    retryReserve: currentEstimate.retryReserve,
    planSha256: authority.planSha256,
    promptPackageSha256: authority.promptPackageSha256,
    referenceBindings: sortedReferences(authority.references),
    pricingSnapshotSha256: pricing.sha256,
    costEstimateSha256: currentEstimate.sha256,
  };
}

function referenceMismatchPath(issued, current) {
  if (issued.length !== current.length) return "/referenceBindings";
  for (let index = 0; index < issued.length; index += 1) {
    if (issued[index].assetId !== current[index].assetId) return `/referenceBindings/${index}/assetId`;
    if (issued[index].sha256 !== current[index].sha256) return `/referenceBindings/${index}/sha256`;
  }
  return null;
}

export function cutsceneApprovalBinding(input = {}) { return bindingFromCurrent(input); }

export function issueCutsceneHumanApproval(input = {}) {
  if (Object.hasOwn(input, "context")) throw coded("cutscene.approval_context_forbidden", "/context");
  const { eventId, actor, reviewer, decision, decidedAt, plan, promptPackage, manifest, pricingSnapshot, estimate } = input;
  const actorName = humanName(actor, "/actor", "cutscene.actor_role_like");
  const reviewerName = humanName(reviewer, "/reviewer", "cutscene.reviewer_role_like");
  if (actorName !== reviewerName) throw coded("cutscene.approval_actor_mismatch", "/actor");
  if (decision !== "approved") throw coded("cutscene.approval_decision_invalid", "/decision");
  if (typeof eventId !== "string" || !eventId) throw coded("cutscene.approval_event_required", "/eventId");
  if (!isRfc3339DateTime(decidedAt)) throw coded("cutscene.timestamp_invalid", "/decidedAt");
  const binding = bindingFromCurrent({ plan, promptPackage, manifest, pricingSnapshot, estimate });
  const receipt = Object.freeze({ schemaVersion: 2, eventId, actor: actorName, reviewer: reviewerName, decision, decidedAt, waveId: binding.waveId, assetIds: Object.freeze(binding.assetIds), maximumApprovedUsd: binding.maximumApprovedUsd, retryReserve: binding.retryReserve, planSha256: binding.planSha256, promptPackageSha256: binding.promptPackageSha256, referenceBindings: Object.freeze(binding.referenceBindings.map((reference) => Object.freeze(reference))), pricingSnapshotSha256: binding.pricingSnapshotSha256, costEstimateSha256: binding.costEstimateSha256 });
  const capability = Object.freeze(Object.create(null));
  liveApprovals.set(capability, receipt);
  return Object.freeze({ receipt, capability });
}

export function assertCutsceneHumanApproval({ receipt, capability, context } = {}) {
  if (!receipt) throw coded("cutscene.approval_required", "/receipt");
  if (!capability || types.isProxy(receipt) || types.isProxy(capability) || liveApprovals.get(capability) !== receipt) throw coded("cutscene.approval_capability_invalid", "/capability");
  if (receipt.schemaVersion !== 2) throw coded("cutscene.approval_schema_invalid", "/schemaVersion");
  if (context?.eventId !== receipt.eventId) throw coded("cutscene.approval_event_mismatch", "/eventId");
  if (humanName(context?.actor, "/actor", "cutscene.approval_actor_mismatch") !== receipt.actor) throw coded("cutscene.approval_actor_mismatch", "/actor");
  if (humanName(context?.reviewer, "/reviewer", "cutscene.approval_reviewer_mismatch") !== receipt.reviewer) throw coded("cutscene.approval_reviewer_mismatch", "/reviewer");
  if (context?.decidedAt !== receipt.decidedAt) throw coded("cutscene.approval_event_mismatch", "/decidedAt");
  if (receipt.waveId !== context?.waveId) throw coded("cutscene.approval_binding_stale", "/waveId");
  if (!sameJson(receipt.assetIds, sortedAssetIds(context?.assetIds))) throw coded("cutscene.approval_binding_stale", "/assetIds");
  if (receipt.maximumApprovedUsd !== context?.maximumApprovedUsd) throw coded("cutscene.approval_binding_stale", "/maximumApprovedUsd");
  if (receipt.retryReserve !== context?.retryReserve) throw coded("cutscene.approval_binding_stale", "/retryReserve");
  if (receipt.planSha256 !== context?.planSha256) throw coded("cutscene.approval_binding_stale", "/planSha256");
  if (receipt.promptPackageSha256 !== context?.promptPackageSha256) throw coded("cutscene.approval_binding_stale", "/promptPackageSha256");
  const referencePath = referenceMismatchPath(receipt.referenceBindings, sortedReferences(context?.referenceBindings));
  if (referencePath) throw coded("cutscene.approval_binding_stale", referencePath);
  if (receipt.pricingSnapshotSha256 !== context?.pricingSnapshotSha256) throw coded("cutscene.approval_binding_stale", "/pricingSnapshotSha256");
  if (receipt.costEstimateSha256 !== context?.costEstimateSha256) throw coded("cutscene.approval_binding_stale", "/costEstimateSha256");
  if (!isRfc3339DateTime(context?.now)) throw coded("cutscene.timestamp_invalid", "/now");
  const age = Date.parse(context.now) - Date.parse(receipt.decidedAt);
  if (age < 0 || age > APPROVAL_MAX_AGE_MS) throw coded("cutscene.approval_receipt_stale", "/decidedAt");
  return receipt;
}

function currentWaveIndex(plan, waveId) {
  if (!validateCutsceneVisualPlan(plan).ok) return -1;
  return plan.cutsceneWorkflow.waves.findIndex((wave) => wave.id === waveId);
}

export function validateHostCutsceneApproval({ receipt, capability, approvalEvent, plan, promptPackage, manifest, pricingSnapshot, estimate, now } = {}) {
  if (!receipt && !capability) {
    const index = currentWaveIndex(plan, estimate?.waveId);
    if (index >= 0) throw coded("cutscene.approval_required", `/cutsceneWorkflow/waves/${index}/approval`);
  }
  const current = bindingFromCurrent({ plan, promptPackage, manifest, pricingSnapshot, estimate });
  const approved = assertCutsceneHumanApproval({ receipt, capability, context: { eventId: approvalEvent?.eventId, actor: approvalEvent?.actor, reviewer: approvalEvent?.reviewer, decidedAt: approvalEvent?.decidedAt, now, ...current } });
  if (!isRfc3339DateTime(pricingSnapshot?.retrievedAt)) throw coded("cutscene.timestamp_invalid", "/retrievedAt");
  const age = Date.parse(now) - Date.parse(pricingSnapshot.retrievedAt);
  if (age < 0 || age > PRICING_MAX_AGE_MS) throw coded("cutscene.pricing_snapshot_stale", "/retrievedAt");
  return approved;
}

export function requiresCutsceneReapproval({ receipt, plan, promptPackage, manifest, pricingSnapshot, estimate } = {}) {
  if (!receipt || receipt.schemaVersion !== 2) return true;
  try {
    const current = bindingFromCurrent({ plan, promptPackage, manifest, pricingSnapshot, estimate });
    return receipt.waveId !== current.waveId || !sameJson(receipt.assetIds, current.assetIds) || receipt.maximumApprovedUsd !== current.maximumApprovedUsd || receipt.retryReserve !== current.retryReserve || receipt.planSha256 !== current.planSha256 || receipt.promptPackageSha256 !== current.promptPackageSha256 || referenceMismatchPath(receipt.referenceBindings, current.referenceBindings) !== null || receipt.pricingSnapshotSha256 !== current.pricingSnapshotSha256 || receipt.costEstimateSha256 !== current.costEstimateSha256;
  } catch { return true; }
}
