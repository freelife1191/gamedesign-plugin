import { cutsceneDocumentSha256 } from "./validate-cutscene-visual-preproduction.mjs";

const HASH = /^[a-f0-9]{64}$/u;
const WAVE_IDS = new Set(["style-master", "reference-masters", "keyframes", "storyboard"]);
const compareUtf8 = (left, right) => Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
const coded = (code, path) => Object.assign(new Error(code), { code, path });

function waveRecords(plan) {
  if (Array.isArray(plan?.cutsceneWorkflow?.waves)) return plan.cutsceneWorkflow.waves;
  return Array.isArray(plan?.waves) ? plan.waves : [];
}

function planSha256(plan) {
  if (plan?.cutsceneWorkflow && typeof plan === "object") return cutsceneDocumentSha256(plan);
  return plan?.sha256;
}

function sortedAssetIds(assetIds, path = "/assetIds") {
  if (!Array.isArray(assetIds) || assetIds.length === 0 || assetIds.some((id) => typeof id !== "string" || id.length === 0)) throw coded("cutscene.asset_ids_invalid", path);
  const sorted = [...assetIds].sort(compareUtf8);
  if (sorted.some((id, index) => id !== assetIds[index]) || new Set(assetIds).size !== assetIds.length) throw coded("cutscene.ids_unsorted_or_duplicate", path);
  return sorted;
}

function validPricingSnapshot(pricingSnapshot) {
  const units = pricingSnapshot?.units;
  if (pricingSnapshot?.status === "unavailable") return false;
  if (!pricingSnapshot || !HASH.test(pricingSnapshot.sha256 ?? "") || typeof pricingSnapshot.provider !== "string" || !pricingSnapshot.provider
    || typeof pricingSnapshot.model !== "string" || !pricingSnapshot.model || typeof pricingSnapshot.sourceUrl !== "string" || !pricingSnapshot.sourceUrl
    || typeof pricingSnapshot.retrievedAt !== "string" || !Number.isFinite(Date.parse(pricingSnapshot.retrievedAt)) || pricingSnapshot.currency !== "USD"
    || !units || ["textInput", "cachedTextInput", "imageInput", "cachedImageInput", "imageOutput"].some((name) => typeof units[name] !== "number" || !Number.isFinite(units[name]) || units[name] < 0)) throw coded("cutscene.pricing_snapshot_invalid", "/pricingSnapshot");
  return true;
}

function usageToken(usage, field) {
  if (!Number.isInteger(usage?.[field]) || usage[field] < 0) throw coded("cutscene.usage_token_invalid", `/${field}`);
  return usage[field];
}

/**
 * Produces a deterministic wave estimate. Token-priced snapshots alone do not
 * provide per-request token counts, so this intentionally reports a zero
 * declared range until a later dispatch layer supplies a request budget.
 */
export function estimateCutsceneImageCost({ plan, waveId, pricingSnapshot, retryReserve } = {}) {
  const waves = waveRecords(plan);
  const wave = waves.find(({ id }) => id === waveId);
  if (!wave || !WAVE_IDS.has(waveId)) throw coded("cutscene.wave_unknown", "/waveId");
  const assetIds = sortedAssetIds(wave.assetIds);
  const currentPlanSha256 = planSha256(plan);
  if (!HASH.test(currentPlanSha256 ?? "")) throw coded("cutscene.plan_hash_invalid", "/planSha256");
  if (!Number.isInteger(retryReserve) || retryReserve < 0) throw coded("cutscene.retry_reserve_invalid", "/retryReserve");
  if (!validPricingSnapshot(pricingSnapshot)) return {
    sha256: undefined, waveId, assetIds, planSha256: currentPlanSha256, pricingSnapshotSha256: pricingSnapshot?.sha256, retryReserve,
    totals: { minimumUsd: null, expectedUsd: null, maximumUsd: null, status: "unavailable" },
  };
  const estimate = {
    schemaVersion: 1,
    waveId,
    assetIds,
    planSha256: currentPlanSha256,
    pricingSnapshotSha256: pricingSnapshot.sha256,
    retryReserve,
    minimumUsd: 0,
    expectedUsd: 0,
    maximumUsd: 0,
  };
  return { sha256: cutsceneDocumentSha256(estimate), ...estimate };
}

export function calculateActualCost({ pricingSnapshot, usage } = {}) {
  const inputTokens = usageToken(usage, "inputTokens");
  const inputTextTokens = usageToken(usage, "inputTextTokens");
  const inputImageTokens = usageToken(usage, "inputImageTokens");
  const outputTokens = usageToken(usage, "outputTokens");
  const totalTokens = usageToken(usage, "totalTokens");
  if (inputTokens !== inputTextTokens + inputImageTokens) throw coded("cutscene.usage_input_mismatch", "/inputTokens");
  if (totalTokens !== inputTokens + outputTokens) throw coded("cutscene.usage_total_mismatch", "/totalTokens");
  if (usage?.cachedTextTokens === undefined || usage?.cachedImageTokens === undefined) return { status: "unavailable", reason: "cached-token-breakdown-unavailable" };
  const cachedTextTokens = usageToken(usage, "cachedTextTokens");
  const cachedImageTokens = usageToken(usage, "cachedImageTokens");
  if (cachedTextTokens > inputTextTokens) throw coded("cutscene.cached_text_exceeds_input", "/cachedTextTokens");
  if (cachedImageTokens > inputImageTokens) throw coded("cutscene.cached_image_exceeds_input", "/cachedImageTokens");
  if (!validPricingSnapshot(pricingSnapshot)) return { status: "unavailable", reason: "pricing-snapshot-unavailable" };
  const { textInput, cachedTextInput, imageInput, cachedImageInput, imageOutput } = pricingSnapshot.units;
  const usd = ((inputTextTokens - cachedTextTokens) * textInput + cachedTextTokens * cachedTextInput
    + (inputImageTokens - cachedImageTokens) * imageInput + cachedImageTokens * cachedImageInput + outputTokens * imageOutput) / 1_000_000;
  return { status: "known", usd };
}
