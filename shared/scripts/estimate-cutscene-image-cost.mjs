import { createHash } from "node:crypto";

import { isRfc3339DateTime } from "./lib/rfc3339.mjs";
import { validateCutsceneManifestHandoff } from "./plan-cutscene-visual-preproduction.mjs";
import { cutsceneDocumentSha256, validateCutsceneVisualPlan } from "./validate-cutscene-visual-preproduction.mjs";

const HASH = /^[a-f0-9]{64}$/u;
const WAVE_IDS = new Set(["style-master", "reference-masters", "keyframes", "storyboard"]);
const PRICING_KEYS = ["provider", "model", "sourceUrl", "retrievedAt", "currency", "units", "sha256"];
const ESTIMATE_KEYS = ["schemaVersion", "sha256", "waveId", "assetIds", "planSha256", "pricingSnapshotSha256", "retryReserve", "costStatus", "attemptCeilings", "minimumUsd", "expectedUsd", "maximumUsd"];
const UNIT_KEYS = ["textInput", "cachedTextInput", "imageInput", "cachedImageInput", "imageOutput"];
const compareUtf8 = (left, right) => Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
const coded = (code, path) => Object.assign(new Error(code), { code, path });

function plain(value) { return value !== null && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype; }
function exact(value, keys) { return plain(value) && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key)); }
function sameJson(left, right) { return JSON.stringify(left) === JSON.stringify(right); }
function withoutDigest(value, field = "sha256") { const content = { ...value }; delete content[field]; return content; }
function canonicalDigest(value, field) { return cutsceneDocumentSha256(withoutDigest(value, field)); }
function isHash(value) { return typeof value === "string" && HASH.test(value); }
function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value)) deepFreeze(nested);
  }
  return value;
}

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
  if (!exact(estimate, ESTIMATE_KEYS) || estimate.schemaVersion !== 2 || !isHash(estimate.sha256) || estimate.sha256 !== canonicalDigest(estimate)) throw coded("cutscene.cost_estimate_invalid", "/estimate/sha256");
  if (!WAVE_IDS.has(estimate.waveId)) throw coded("cutscene.cost_estimate_invalid", "/estimate/waveId");
  const wave = authority.waves.find(({ id }) => id === estimate.waveId);
  if (!wave || !sameJson(sortedAssetIds(estimate.assetIds, "/estimate/assetIds"), sortedAssetIds(wave.assetIds, "/estimate/assetIds"))) throw coded("cutscene.cost_estimate_stale", "/estimate/assetIds");
  if (estimate.planSha256 !== authority.planSha256) throw coded("cutscene.cost_estimate_stale", "/estimate/planSha256");
  if (estimate.pricingSnapshotSha256 !== pricingSnapshot.sha256) throw coded("cutscene.cost_estimate_stale", "/estimate/pricingSnapshotSha256");
  if (!Number.isInteger(estimate.retryReserve) || estimate.retryReserve < 0) throw coded("cutscene.cost_estimate_invalid", "/estimate/retryReserve");
  if (!Array.isArray(estimate.attemptCeilings) || estimate.attemptCeilings.length !== estimate.assetIds.length) throw coded("cutscene.cost_estimate_invalid", "/estimate/attemptCeilings");
  for (let index = 0; index < estimate.attemptCeilings.length; index += 1) {
    const ceiling = estimate.attemptCeilings[index];
    if (!exact(ceiling, ["assetId", "requestSha256", "maximumUsd"]) || ceiling.assetId !== estimate.assetIds[index] || !isHash(ceiling.requestSha256)
      || !(ceiling.maximumUsd === null || Number.isFinite(ceiling.maximumUsd) && ceiling.maximumUsd > 0)) throw coded("cutscene.cost_estimate_invalid", `/estimate/attemptCeilings/${index}`);
  }
  if (estimate.costStatus === "available") {
    if (estimate.attemptCeilings.some(({ maximumUsd }) => maximumUsd === null)) throw coded("cutscene.cost_estimate_invalid", "/estimate/costStatus");
    for (const field of ["minimumUsd", "expectedUsd", "maximumUsd"]) if (!Number.isFinite(estimate[field]) || estimate[field] <= 0) throw coded("cutscene.cost_estimate_invalid", `/estimate/${field}`);
    const baseline = estimate.attemptCeilings.reduce((total, { maximumUsd }) => total + maximumUsd, 0);
    const maximum = baseline + estimate.retryReserve * Math.max(...estimate.attemptCeilings.map(({ maximumUsd }) => maximumUsd));
    if (estimate.minimumUsd !== baseline || estimate.expectedUsd !== baseline || estimate.maximumUsd !== maximum) throw coded("cutscene.cost_estimate_invalid", "/estimate/maximumUsd");
  } else if (estimate.costStatus !== "unavailable" || [estimate.minimumUsd, estimate.expectedUsd, estimate.maximumUsd].some((value) => value !== null)
    || !estimate.attemptCeilings.some(({ maximumUsd }) => maximumUsd === null)) throw coded("cutscene.cost_estimate_invalid", "/estimate/costStatus");
  return estimate;
}

function manifestProvider(asset, pricingSnapshot) {
  const provider = asset?.provider;
  const model = provider?.model ?? provider?.requested_model;
  const quality = provider?.quality ?? provider?.requested_quality;
  if (!plain(provider) || !["openai", "codex-host"].includes(pricingSnapshot.provider) || !model || !quality
    || !["image-provider-unresolved", pricingSnapshot.provider].includes(provider.name) || model !== pricingSnapshot.model) throw coded("cutscene.dispatch_binding_invalid", "/manifest/assets/provider");
  return { provider: pricingSnapshot.provider, model, quality };
}

function requestForAsset(asset, prompt, pricingSnapshot, manifestAssets, referenceBindings) {
  const routing = manifestProvider(asset, pricingSnapshot);
  if (asset.prompt !== prompt.prompt || asset.prompt_sha256 !== prompt.promptSha256 || createHash("sha256").update(asset.prompt).digest("hex") !== asset.prompt_sha256) throw coded("cutscene.prompt_package_stale", "/promptPackage/prompts");
  const declaredReferenceIds = asset.reference_asset_ids ?? [];
  const derivedReferences = declaredReferenceIds.map((referenceAssetId, index) => {
    const source = manifestAssets.get(referenceAssetId);
    const sha256 = referenceBindings.get(referenceAssetId);
    if (!source || !isHash(sha256) || typeof source.output?.path !== "string") throw coded("cutscene.dispatch_binding_invalid", `/manifest/assets/reference_asset_ids/${index}`);
    return { asset_id: referenceAssetId, path: source.output.path, sha256 };
  });
  const references = derivedReferences.length > 0 ? derivedReferences : asset.reference_images ?? [];
  if (derivedReferences.length > 0 && Array.isArray(asset.reference_images) && asset.reference_images.length > 0 && !sameJson(asset.reference_images, derivedReferences)) throw coded("cutscene.dispatch_binding_invalid", "/manifest/assets/reference_images");
  const referenceDigests = references.map((reference, index) => {
    if (!plain(reference) || !isHash(reference.sha256)) throw coded("cutscene.dispatch_binding_invalid", `/manifest/assets/reference_images/${index}`);
    return reference.sha256;
  });
  const parentPromptDigests = references.map((reference, index) => {
    const source = manifestAssets.get(reference.asset_id);
    const promptDigest = source?.prompt_digest ?? source?.prompt_sha256;
    if (!isHash(promptDigest)) throw coded("cutscene.dispatch_binding_invalid", `/manifest/assets/reference_images/${index}`);
    return promptDigest;
  });
  const output = asset.planning?.target_output;
  if (!plain(output) || !Number.isInteger(output.width) || !Number.isInteger(output.height) || typeof output.path !== "string"
    || typeof output.aspect_ratio !== "string" || typeof output.format !== "string" || typeof output.background !== "string") throw coded("cutscene.dispatch_binding_invalid", "/manifest/assets/planning/target_output");
  const request = {
    provider: routing.provider,
    model: routing.model,
    quality: routing.quality,
    promptDigest: asset.prompt_sha256,
    referenceDigests,
    output: {
      path: output.path,
      width: output.width,
      height: output.height,
      aspectRatio: output.aspect_ratio,
      format: output.format,
      background: output.background,
    },
  };
  return {
    ...routing,
    requestSha256: cutsceneDocumentSha256(request),
    request,
    output: { ...output },
    referenceImages: references.map((reference) => ({ ...reference })),
    promptLineage: { parent_prompt_digests: parentPromptDigests },
  };
}

export function buildCutsceneDispatchSnapshot({ plan, promptPackage, manifest, waveId, pricingSnapshot, selectedAssetIds } = {}) {
  const authority = resolveCutsceneGenerationAuthority({ plan, promptPackage });
  const pricing = assertClosedPricingSnapshot(pricingSnapshot).pricingSnapshot;
  const wave = authority.waves.find(({ id }) => id === waveId);
  if (!wave || !WAVE_IDS.has(waveId)) throw coded("cutscene.wave_unknown", "/waveId");
  validateCutsceneManifestHandoff({ manifest });
  const ids = selectedAssetIds === undefined ? sortedAssetIds(wave.assetIds) : sortedAssetIds(selectedAssetIds, "/selectedAssetIds");
  if (ids.some((assetId) => !wave.assetIds.includes(assetId))) throw coded("cutscene.selected_asset_ids_invalid", "/selectedAssetIds");
  const sourceAssets = new Map(manifest.assets.map((asset) => [asset.asset_id, asset]));
  const prompts = new Map(authority.prompts.map((prompt) => [prompt.assetId, prompt]));
  const referenceBindings = new Map(authority.references.map(({ assetId, sha256 }) => [assetId, sha256]));
  const referenceImagesByAsset = new Map();
  const promptLineageByAsset = new Map();
  const requests = ids.map((assetId) => {
    const asset = sourceAssets.get(assetId);
    const prompt = prompts.get(assetId);
    if (!asset || !prompt) throw coded("cutscene.dispatch_binding_invalid", "/manifest/assets");
    const bound = requestForAsset(asset, prompt, pricing, sourceAssets, referenceBindings);
    referenceImagesByAsset.set(assetId, bound.referenceImages);
    promptLineageByAsset.set(assetId, bound.promptLineage);
    const { referenceImages: _referenceImages, promptLineage: _promptLineage, ...request } = bound;
    return { assetId, ...request };
  });
  const routing = new Set(requests.map(({ provider, model, quality }) => `${provider}\0${model}\0${quality}`));
  if (routing.size !== 1) throw coded("cutscene.dispatch_binding_invalid", "/manifest/assets/provider");
  const ephemeralManifest = structuredClone(manifest);
  for (const asset of ephemeralManifest.assets) {
    asset.prompt_digest = asset.prompt_sha256;
    const referenceImages = referenceImagesByAsset.get(asset.asset_id);
    if (referenceImages?.length > 0) {
      asset.reference_images = referenceImages.map((reference) => ({ ...reference }));
      asset.prompt_lineage = structuredClone(promptLineageByAsset.get(asset.asset_id));
    }
  }
  return deepFreeze({ schemaVersion: 1, waveId, assetIds: ids, provider: requests[0].provider, model: requests[0].model, quality: requests[0].quality, requests, manifest: ephemeralManifest });
}

export function estimateCutsceneImageCost({ plan, promptPackage, manifest, waveId, pricingSnapshot, retryReserve, attemptCeilings } = {}) {
  const authority = resolveCutsceneGenerationAuthority({ plan, promptPackage });
  const pricing = assertClosedPricingSnapshot(pricingSnapshot);
  const wave = authority.waves.find(({ id }) => id === waveId);
  if (!wave || !WAVE_IDS.has(waveId)) throw coded("cutscene.wave_unknown", "/waveId");
  if (!Number.isInteger(retryReserve) || retryReserve < 0) throw coded("cutscene.retry_reserve_invalid", "/retryReserve");
  const dispatch = buildCutsceneDispatchSnapshot({ plan, promptPackage, manifest, waveId, pricingSnapshot });
  const quoteMap = new Map();
  let usable = Array.isArray(attemptCeilings) && attemptCeilings.length === dispatch.assetIds.length;
  for (const quote of attemptCeilings ?? []) {
    if (!exact(quote, ["assetId", "maximumUsd"]) || !dispatch.assetIds.includes(quote.assetId) || quoteMap.has(quote.assetId) || !Number.isFinite(quote.maximumUsd) || quote.maximumUsd <= 0) usable = false;
    else quoteMap.set(quote.assetId, quote.maximumUsd);
  }
  const schedule = dispatch.requests.map(({ assetId, requestSha256 }) => ({ assetId, requestSha256, maximumUsd: usable && quoteMap.has(assetId) ? quoteMap.get(assetId) : null }));
  const baseline = usable ? schedule.reduce((total, { maximumUsd }) => total + maximumUsd, 0) : null;
  const maximum = usable ? baseline + retryReserve * Math.max(...schedule.map(({ maximumUsd }) => maximumUsd)) : null;
  const estimate = {
    schemaVersion: 2,
    waveId,
    assetIds: dispatch.assetIds,
    planSha256: authority.planSha256,
    pricingSnapshotSha256: pricing.pricingSnapshotSha256,
    retryReserve,
    costStatus: usable ? "available" : "unavailable",
    attemptCeilings: schedule,
    minimumUsd: baseline,
    expectedUsd: baseline,
    maximumUsd: maximum,
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
