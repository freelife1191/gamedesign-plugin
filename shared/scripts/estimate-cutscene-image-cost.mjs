import { createHash } from "node:crypto";

import { isRfc3339DateTime } from "./lib/rfc3339.mjs";
import { cutsceneDocumentSha256, validateCutsceneVisualPlan } from "./validate-cutscene-visual-preproduction.mjs";

const HASH = /^[a-f0-9]{64}$/u;
const WAVE_IDS = new Set(["style-master", "reference-masters", "keyframes", "storyboard"]);
const PRICING_KEYS = ["provider", "model", "sourceUrl", "retrievedAt", "currency", "units", "sha256"];
const ESTIMATE_KEYS = ["schemaVersion", "sha256", "waveId", "assetIds", "planSha256", "pricingSnapshotSha256", "retryReserve", "minimumUsd", "expectedUsd", "maximumUsd"];
const UNIT_KEYS = ["textInput", "cachedTextInput", "imageInput", "cachedImageInput", "imageOutput"];
const compareUtf8 = (left, right) => Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
const coded = (code, path) => Object.assign(new Error(code), { code, path });

function plain(value) { return value !== null && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype; }
function exact(value, keys) { return plain(value) && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key)); }
function sameJson(left, right) { return JSON.stringify(left) === JSON.stringify(right); }
function withoutDigest(value, field = "sha256") { const content = { ...value }; delete content[field]; return content; }
function canonicalDigest(value, field) { return cutsceneDocumentSha256(withoutDigest(value, field)); }
function isHash(value) { return typeof value === "string" && HASH.test(value); }

function sortedAssetIds(assetIds, path = "/assetIds") {
  if (!Array.isArray(assetIds) || assetIds.length === 0 || assetIds.some((id) => typeof id !== "string" || id.length === 0)) throw coded("cutscene.asset_ids_invalid", path);
  const sorted = [...assetIds].sort(compareUtf8);
  if (!sameJson(sorted, assetIds) || new Set(assetIds).size !== assetIds.length) throw coded("cutscene.ids_unsorted_or_duplicate", path);
  return sorted;
}

function sortedReferences(references) {
  if (!Array.isArray(references) || references.length === 0) throw coded("cutscene.prompt_package_invalid", "/promptPackage/references");
  const normalized = references.map((reference, index) => {
    if (!exact(reference, ["assetId", "sha256"]) || typeof reference.assetId !== "string" || !isHash(reference.sha256)) throw coded("cutscene.prompt_package_invalid", `/promptPackage/references/${index}`);
    return { assetId: reference.assetId, sha256: reference.sha256 };
  });
  if (new Set(normalized.map(({ assetId }) => assetId)).size !== normalized.length) throw coded("cutscene.ids_unsorted_or_duplicate", "/promptPackage/references");
  return normalized;
}

export function resolveCutsceneGenerationAuthority({ plan, promptPackage } = {}) {
  if (!validateCutsceneVisualPlan(plan).ok) throw coded("cutscene.plan_invalid", "/plan");
  const planSha256 = cutsceneDocumentSha256(plan);
  const expectedAssetIds = plan.cutsceneWorkflow.waves.flatMap((wave) => wave.assetIds);
  if (!exact(promptPackage, ["kind", "cutsceneId", "planSha256", "dagSha256", "references", "prompts", "promptPackageSha256"])
    || promptPackage.kind !== "generation-ready") throw coded("cutscene.prompt_package_invalid", "/promptPackage");
  if (promptPackage.cutsceneId !== plan.cutsceneId) throw coded("cutscene.prompt_package_stale", "/promptPackage/cutsceneId");
  if (promptPackage.planSha256 !== planSha256) throw coded("cutscene.prompt_package_plan_stale", "/promptPackage/planSha256");
  if (promptPackage.dagSha256 !== cutsceneDocumentSha256(plan.cutsceneWorkflow.downstream)) throw coded("cutscene.prompt_package_stale", "/promptPackage/dagSha256");
  if (!isHash(promptPackage.promptPackageSha256) || promptPackage.promptPackageSha256 !== canonicalDigest(promptPackage, "promptPackageSha256")) throw coded("cutscene.prompt_package_invalid", "/promptPackage/promptPackageSha256");
  const references = sortedReferences(promptPackage.references);
  if (references.some(({ assetId }) => !expectedAssetIds.includes(assetId))) throw coded("cutscene.prompt_package_stale", "/promptPackage/references");
  if (!Array.isArray(promptPackage.prompts) || promptPackage.prompts.length !== expectedAssetIds.length) throw coded("cutscene.prompt_package_stale", "/promptPackage/prompts");
  const prompts = promptPackage.prompts.map((prompt, index) => {
    if (!exact(prompt, ["assetId", "prompt", "promptSha256"]) || prompt.assetId !== expectedAssetIds[index] || typeof prompt.prompt !== "string"
      || !isHash(prompt.promptSha256) || prompt.promptSha256 !== createHash("sha256").update(prompt.prompt).digest("hex")) throw coded("cutscene.prompt_package_stale", `/promptPackage/prompts/${index}`);
    return prompt;
  });
  return { plan, planSha256, promptPackage, promptPackageSha256: promptPackage.promptPackageSha256, references, prompts, waves: plan.cutsceneWorkflow.waves };
}

export function assertClosedPricingSnapshot(pricingSnapshot) {
  if (!exact(pricingSnapshot, PRICING_KEYS)) throw coded("cutscene.pricing_snapshot_invalid", "/pricingSnapshot");
  if (!isRfc3339DateTime(pricingSnapshot.retrievedAt)) throw coded("cutscene.timestamp_invalid", "/retrievedAt");
  if (typeof pricingSnapshot.provider !== "string" || !pricingSnapshot.provider || typeof pricingSnapshot.model !== "string" || !pricingSnapshot.model
    || typeof pricingSnapshot.sourceUrl !== "string" || !pricingSnapshot.sourceUrl || pricingSnapshot.currency !== "USD" || !exact(pricingSnapshot.units, UNIT_KEYS)
    || UNIT_KEYS.some((key) => typeof pricingSnapshot.units[key] !== "number" || !Number.isFinite(pricingSnapshot.units[key]) || pricingSnapshot.units[key] < 0)
    || !isHash(pricingSnapshot.sha256) || pricingSnapshot.sha256 !== canonicalDigest(pricingSnapshot)) throw coded("cutscene.pricing_snapshot_invalid", "/pricingSnapshot/sha256");
  return { pricingSnapshot, pricingSnapshotSha256: pricingSnapshot.sha256 };
}

export function assertCurrentCutsceneEstimate({ estimate, authority, pricingSnapshot } = {}) {
  if (!exact(estimate, ESTIMATE_KEYS) || estimate.schemaVersion !== 1 || !isHash(estimate.sha256) || estimate.sha256 !== canonicalDigest(estimate)) throw coded("cutscene.cost_estimate_invalid", "/estimate/sha256");
  if (!WAVE_IDS.has(estimate.waveId)) throw coded("cutscene.cost_estimate_invalid", "/estimate/waveId");
  const wave = authority.waves.find(({ id }) => id === estimate.waveId);
  if (!wave || !sameJson(sortedAssetIds(estimate.assetIds, "/estimate/assetIds"), sortedAssetIds(wave.assetIds, "/estimate/assetIds"))) throw coded("cutscene.cost_estimate_stale", "/estimate/assetIds");
  if (estimate.planSha256 !== authority.planSha256) throw coded("cutscene.cost_estimate_stale", "/estimate/planSha256");
  if (estimate.pricingSnapshotSha256 !== pricingSnapshot.sha256) throw coded("cutscene.cost_estimate_stale", "/estimate/pricingSnapshotSha256");
  if (!Number.isInteger(estimate.retryReserve) || estimate.retryReserve < 0) throw coded("cutscene.cost_estimate_invalid", "/estimate/retryReserve");
  for (const field of ["minimumUsd", "expectedUsd", "maximumUsd"]) if (!Number.isFinite(estimate[field]) || estimate[field] < 0) throw coded("cutscene.cost_estimate_invalid", `/estimate/${field}`);
  if (estimate.minimumUsd > estimate.expectedUsd || estimate.expectedUsd > estimate.maximumUsd) throw coded("cutscene.cost_estimate_invalid", "/estimate/maximumUsd");
  return estimate;
}

export function estimateCutsceneImageCost({ plan, promptPackage, waveId, pricingSnapshot, retryReserve } = {}) {
  const authority = resolveCutsceneGenerationAuthority({ plan, promptPackage });
  const pricing = assertClosedPricingSnapshot(pricingSnapshot);
  const wave = authority.waves.find(({ id }) => id === waveId);
  if (!wave || !WAVE_IDS.has(waveId)) throw coded("cutscene.wave_unknown", "/waveId");
  if (!Number.isInteger(retryReserve) || retryReserve < 0) throw coded("cutscene.retry_reserve_invalid", "/retryReserve");
  const estimate = {
    schemaVersion: 1,
    waveId,
    assetIds: sortedAssetIds(wave.assetIds, "/estimate/assetIds"),
    planSha256: authority.planSha256,
    pricingSnapshotSha256: pricing.pricingSnapshotSha256,
    retryReserve,
    minimumUsd: 0,
    expectedUsd: 0,
    maximumUsd: 0,
  };
  return { ...estimate, sha256: cutsceneDocumentSha256(estimate) };
}

export function calculateActualCost({ pricingSnapshot, usage } = {}) {
  const read = (field) => { if (!Number.isInteger(usage?.[field]) || usage[field] < 0) throw coded("cutscene.usage_token_invalid", `/${field}`); return usage[field]; };
  const inputTokens = read("inputTokens"); const inputTextTokens = read("inputTextTokens"); const inputImageTokens = read("inputImageTokens"); const outputTokens = read("outputTokens"); const totalTokens = read("totalTokens");
  if (inputTokens !== inputTextTokens + inputImageTokens) throw coded("cutscene.usage_input_mismatch", "/inputTokens");
  if (totalTokens !== inputTokens + outputTokens) throw coded("cutscene.usage_total_mismatch", "/totalTokens");
  if (usage.cachedTextTokens === undefined || usage.cachedImageTokens === undefined) return { status: "unavailable", reason: "cached-token-breakdown-unavailable" };
  const cachedTextTokens = read("cachedTextTokens"); const cachedImageTokens = read("cachedImageTokens");
  if (cachedTextTokens > inputTextTokens) throw coded("cutscene.cached_text_exceeds_input", "/cachedTextTokens");
  if (cachedImageTokens > inputImageTokens) throw coded("cutscene.cached_image_exceeds_input", "/cachedImageTokens");
  const { units } = assertClosedPricingSnapshot(pricingSnapshot).pricingSnapshot;
  return { status: "known", usd: ((inputTextTokens - cachedTextTokens) * units.textInput + cachedTextTokens * units.cachedTextInput + (inputImageTokens - cachedImageTokens) * units.imageInput + cachedImageTokens * units.cachedImageInput + outputTokens * units.imageOutput) / 1_000_000 };
}
