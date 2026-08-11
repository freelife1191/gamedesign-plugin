import { validateImageAssetManifest } from "./validate-image-assets.mjs";
import { validateQualityProfile } from "./validate-quality-profile.mjs";
import { hasCredentialOrEncodedPayload } from "./lib/image-input-safety.mjs";

const assetTypes = new Set([
  "character", "npc", "monster-boss", "skill-vfx", "environment-landmark", "item-equipment",
  "ui-icon", "story-storyboard", "key-art-pitch-concept", "document-illustration-cover", "skillstead-diagram",
]);
const modes = new Set(["required", "all", "select", "prompt-only"]);
const stableId = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u;
const selectorAllowedExclusions = new Set(["logo", "watermark", "unrequested text", "third-party intellectual property", "branded source identity"]);

function selectorError(code) {
  const error = new Error("Image generation selection rejected unsafe or legacy manifest input.");
  error.code = code;
  return error;
}

function selectorUnsafeString(value) {
  return hasCredentialOrEncodedPayload(value);
}

function assertSafeSelectionStrings(value, path = []) {
  if (typeof value === "string") {
    if (!(path.at(-1) === "exclude" && selectorAllowedExclusions.has(value)) && selectorUnsafeString(value)) throw selectorError("unsafe_generation_manifest");
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => assertSafeSelectionStrings(item, path));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) assertSafeSelectionStrings(item, [...path, key]);
  }
}

function assertObject(value, name) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error(`${name} must be an object.`);
  return value;
}

function assertText(value, name) {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${name} must be a non-empty string.`);
  return value.trim();
}

function clone(value) {
  return structuredClone(value);
}

function generationJob(asset) {
  const job = clone(asset);
  job.output = clone(asset.planning.target_output);
  return job;
}

function orderGenerationJobs(jobs, manifestAssets = jobs) {
  const byId = new Map(jobs.map((job) => [job.asset_id, job]));
  const manifestById = new Map(manifestAssets.map((asset) => [asset.asset_id, asset]));
  const ordered = [];
  const visiting = new Set();
  const visited = new Set();
  const visit = (job) => {
    if (visited.has(job.asset_id)) return;
    if (visiting.has(job.asset_id)) throw new Error("Image generation lineage contains a cycle.");
    visiting.add(job.asset_id);
    const parent = typeof job.derivative_of === "string" ? byId.get(job.derivative_of) : undefined;
    if (parent) visit(parent);
    else if (typeof job.derivative_of === "string" && manifestById.has(job.derivative_of)
      && manifestById.get(job.derivative_of).generation_state !== "generated") {
      throw new Error(`Derivative ${job.asset_id} requires its master ${job.derivative_of} to be generated or selected.`);
    }
    visiting.delete(job.asset_id);
    visited.add(job.asset_id);
    ordered.push(job);
  };
  for (const job of jobs) visit(job);
  return ordered;
}

function aspectRatio(width, height) {
  let left = width;
  let right = height;
  while (right !== 0) [left, right] = [right, left % right];
  return `${width / left}:${height / left}`;
}

function assetIdFor(need) {
  const slot = assertText(need.slot_id, "image need slot_id");
  const variant = need.variant === undefined ? "" : `-${assertText(need.variant, "image need variant")}`;
  const assetId = `${slot}${variant}`;
  if (!stableId.test(assetId)) throw new Error("Image need slot_id and variant must form a stable asset ID.");
  return assetId;
}

function lineageAssetIds(value, name, fallback = []) {
  const ids = value === undefined ? fallback : value;
  if (!Array.isArray(ids) || new Set(ids).size !== ids.length || !ids.every((id) => typeof id === "string" && stableId.test(id))) {
    throw new Error(`${name} must be an ordered list of unique stable asset IDs.`);
  }
  return [...ids];
}

function lineageForNeed(need, assetId) {
  const derivativeOf = need.derivative_of === undefined || need.derivative_of === null ? null : assertText(need.derivative_of, `image need ${assetId} derivative_of`);
  if (derivativeOf !== null && !stableId.test(derivativeOf)) throw new Error(`Image need ${assetId} derivative_of must be a stable asset ID.`);
  const referenceAssetIds = lineageAssetIds(need.reference_asset_ids, `image need ${assetId} reference_asset_ids`, derivativeOf === null ? [] : [derivativeOf]);
  if (derivativeOf !== null && !referenceAssetIds.includes(derivativeOf)) {
    throw new Error(`Image need ${assetId} must declare its derivative_of asset in reference_asset_ids.`);
  }
  const anchors = need.consistency_anchors;
  if (anchors !== undefined && (!anchors || typeof anchors !== "object" || Array.isArray(anchors)
    || JSON.stringify(Object.keys(anchors).sort()) !== JSON.stringify(["character_anchor_asset_ids", "style_anchor_asset_ids"]))) {
    throw new Error(`Image need ${assetId} consistency_anchors must declare style and character anchor IDs.`);
  }
  const style = lineageAssetIds(anchors?.style_anchor_asset_ids ?? need.style_anchor_asset_ids, `image need ${assetId} style_anchor_asset_ids`);
  const character = lineageAssetIds(anchors?.character_anchor_asset_ids ?? need.character_anchor_asset_ids, `image need ${assetId} character_anchor_asset_ids`);
  if (![...style, ...character].every((anchor) => referenceAssetIds.includes(anchor))) {
    throw new Error(`Image need ${assetId} consistency anchors must be declared reference asset IDs.`);
  }
  return {
    derivative_of: derivativeOf,
    reference_asset_ids: referenceAssetIds,
    reference_images: [],
    consistency_profile: { style_anchor_asset_ids: style, character_anchor_asset_ids: character },
    prompt_lineage: { parent_prompt_digests: [] },
  };
}

function sceneDirection(purpose) {
  const marker = " Scene direction: ";
  const index = purpose.indexOf(marker);
  return index === -1 ? "A contextual background appropriate to the documented slot." : purpose.slice(index + marker.length);
}

function documentedPurpose(purpose) {
  return purpose.split(" Scene direction: ", 1)[0];
}

function planAsset(need, slot, requirement, assetSetId) {
  assertObject(need, "image need");
  const assetId = assetIdFor(need);
  const type = assertText(need.type, `image need ${assetId} type`);
  if (!assetTypes.has(type)) throw new Error(`Image need ${assetId} has an unsupported asset type.`);
  const width = need.width;
  const height = need.height;
  if (!Number.isInteger(width) || width < 1 || width > 8192 || !Number.isInteger(height) || height < 1 || height > 8192) {
    throw new Error(`Image need ${assetId} dimensions must be finite manifest dimensions.`);
  }
  const scene = assertText(need.scene, `image need ${assetId} scene`);
  const subject = assertText(need.subject, `image need ${assetId} subject`);
  const composition = assertText(need.composition, `image need ${assetId} composition`);
  const visualStyle = assertText(need.visual_style, `image need ${assetId} visual_style`);
  const readability = assertText(need.readability, `image need ${assetId} readability`);
  const preserve = ["slot purpose and placement", subject];
  if (need.sequence === true || type === "character") {
    if (need.sequence === true && (typeof need.anchor !== "string" || need.anchor.trim() === "")) {
      throw new Error(`Character sequence ${assetId} requires an approved anchor.`);
    }
    if (need.anchor) preserve.push(`anchor: ${need.anchor.trim()}`);
  }
  const transparent = type === "ui-icon" && need.transparency_required === true;
  if (transparent) preserve.push("opaque generation followed by verified alpha postprocess and edge QA");
  const output = {
    path: `assets/generated/${assetId}.png`,
    width,
    height,
    aspect_ratio: aspectRatio(width, height),
    format: "png",
    background: transparent ? "transparent" : "contextual",
  };
  return {
    asset_id: assetId,
    asset_set_id: assetSetId,
    ...lineageForNeed(need, assetId),
    type,
    requirement,
    generation_state: "prompt-ready",
    approval_state: "concept-draft",
    planning: { upstream_slot_id: slot.id, disposition: "active", target_output: clone(output) },
    purpose: `${slot.purpose} Scene direction: ${scene}`,
    placement: { document_slot: requirement === "recommended" ? "cover" : "inline", source_section: `content.md#${slot.section_id}` },
    alt_text: slot.alt_text,
    readability,
    art_brief: {
      subject,
      visual_style: visualStyle,
      composition,
      preserve,
      exclude: ["logo", "watermark", "unrequested text", "third-party intellectual property", "branded source identity"],
    },
    prompt: `Prompt package required for ${assetId}: ${documentedPurpose(`${slot.purpose} Scene direction: ${scene}`)} ${sceneDirection(`${slot.purpose} Scene direction: ${scene}`)}`,
    output,
    provider: { name: "image-provider-unresolved", model: "gpt-image-2", quality: "low" },
    rights: {
      provenance: "AI generation is planned from the recorded prompt package.",
      rights_holder: "Artifact owner",
      license: "internal-planning-use",
      effective_status: "unreviewed",
    },
    reviews: [],
  };
}

function validationError(result, label) {
  return `${label}: ${result.errors.map(({ code, path }) => `${path} (${code})`).join(", ")}`;
}

function markForReplanReview(asset) {
  const retained = clone(asset);
  retained.planning = {
    upstream_slot_id: retained.planning?.upstream_slot_id ?? retained.asset_id,
    disposition: "replan-review-required",
    target_output: clone(retained.planning?.target_output ?? retained.output),
  };
  return retained;
}

function planningFieldsChanged(existing, planned) {
  const fields = ["type", "requirement", "purpose", "placement", "alt_text", "readability", "art_brief"];
  return fields.some((field) => JSON.stringify(existing[field]) !== JSON.stringify(planned[field]))
    || JSON.stringify(existing.planning?.target_output ?? existing.output) !== JSON.stringify(planned.output);
}

function mergeExistingAsset(existing, planned) {
  const changed = planningFieldsChanged(existing, planned);
  const disposition = changed || existing.planning?.disposition === "replan-review-required"
    ? "replan-review-required"
    : "active";
  const next = {
    ...planned,
    planning: { upstream_slot_id: planned.planning.upstream_slot_id, disposition, target_output: clone(planned.output) },
    generation_state: existing.generation_state,
    approval_state: existing.approval_state,
    provider: clone(existing.provider),
    rights: clone(existing.rights),
    reviews: clone(existing.reviews),
  };
  if (Object.hasOwn(existing, "generation_receipts")) next.generation_receipts = clone(existing.generation_receipts);
  for (const field of ["asset_set_id", "derivative_of", "reference_asset_ids", "reference_images", "consistency_profile", "prompt_lineage"]) {
    if (Object.hasOwn(existing, field)) next[field] = clone(existing[field]);
  }
  if (existing.generation_state === "generated") next.output = clone(existing.output);
  if (Object.hasOwn(existing, "technical_fit")) next.technical_fit = existing.technical_fit;
  if (Object.hasOwn(existing, "gameplay_readability")) next.gameplay_readability = existing.gameplay_readability;
  return next;
}

export function buildImageAssetPlan({ artifact, qualityProfile, existingManifest = null } = {}) {
  assertObject(artifact, "artifact");
  const profileValidation = validateQualityProfile(qualityProfile);
  if (!profileValidation.ok) throw new Error(validationError(profileValidation, "Invalid quality profile"));
  const needs = artifact.image_needs;
  if (!Array.isArray(needs)) throw new Error("artifact.image_needs must be an array of explicit image needs.");
  const assetSetId = assertText(artifact.artifact_id, "artifact artifact_id");
  if (!stableId.test(assetSetId)) throw new Error("artifact artifact_id must be a stable asset-set identifier.");
  const slots = new Map();
  for (const slot of qualityProfile.required_images) slots.set(slot.id, { ...slot, requirement: "required" });
  for (const slot of qualityProfile.recommended_images) slots.set(slot.id, { ...slot, requirement: "recommended" });

  const planned = [];
  const seenIds = new Set();
  for (const need of needs) {
    assertObject(need, "image need");
    const slot = slots.get(assertText(need.slot_id, "image need slot_id"));
    if (!slot) throw new Error(`Image need references an unknown quality-profile slot: ${need.slot_id}`);
    const assetId = assetIdFor(need);
    if (seenIds.has(assetId)) throw new Error(`Duplicate image asset ID: ${assetId}`);
    seenIds.add(assetId);
    planned.push(planAsset(need, slot, need.variant === undefined ? slot.requirement : "variant", assetSetId));
  }

  const existingById = new Map();
  if (existingManifest !== null) {
    const existingValidation = validateImageAssetManifest(existingManifest);
    if (!existingValidation.ok) throw new Error(validationError(existingValidation, "Invalid existing image manifest"));
    for (const asset of existingManifest.assets) existingById.set(asset.asset_id, clone(asset));
  }
  const assets = planned.map((asset) => {
    const existing = existingById.get(asset.asset_id);
    return existing ? mergeExistingAsset(existing, asset) : asset;
  });
  const plannedIds = new Set(planned.map(({ asset_id }) => asset_id));
  for (const asset of existingById.values()) if (!plannedIds.has(asset.asset_id)) assets.push(markForReplanReview(asset));
  const manifest = { schema_version: 1, assets };
  const manifestValidation = validateImageAssetManifest(manifest);
  if (!manifestValidation.ok) throw new Error(validationError(manifestValidation, "Planned image manifest is invalid"));
  const summary = { required: 0, recommended: 0, variants: 0, total: assets.length };
  for (const asset of assets) {
    if (asset.requirement === "required") summary.required += 1;
    else if (asset.requirement === "recommended") summary.recommended += 1;
    else if (asset.requirement === "variant") summary.variants += 1;
  }
  return { manifest, summary };
}

export function selectGenerationJobs({ manifest, mode, selectedAssetIds = [] } = {}) {
  if (!modes.has(mode)) throw new Error("Image generation mode is not allowed.");
  const validation = validateImageAssetManifest(manifest);
  if (!validation.ok) throw new Error(validationError(validation, "Invalid image manifest"));
  if (!Array.isArray(selectedAssetIds)) throw new Error("selectedAssetIds must be an array.");
  assertSafeSelectionStrings(manifest);
  if (mode === "prompt-only") return [];
  if (manifest.assets.some((asset) => asset.planning === undefined)) throw selectorError("legacy_manifest_requires_replan");
  if (mode === "required") return orderGenerationJobs(manifest.assets.filter(({ requirement, generation_state, planning }) => requirement === "required" && generation_state === "prompt-ready" && planning.disposition === "active").map(generationJob), manifest.assets);
  if (mode === "all") return orderGenerationJobs(manifest.assets.filter(({ generation_state, planning }) => generation_state === "prompt-ready" && planning.disposition === "active").map(generationJob), manifest.assets);
  const selected = new Set();
  for (const assetId of selectedAssetIds) {
    if (selected.has(assetId)) throw new Error(`Duplicate selected asset ID: ${assetId}`);
    selected.add(assetId);
    const asset = manifest.assets.find(({ asset_id }) => asset_id === assetId);
    if (!asset) throw new Error(`Unknown selected asset ID: ${assetId}`);
    if (asset.planning.disposition !== "active") throw new Error(`Selected asset requires replan review: ${assetId}`);
    if (!(asset.generation_state === "prompt-ready" || ["generation-unavailable", "generation-failed", "policy-blocked", "qa-failed"].includes(asset.generation_state))) throw new Error(`Selected asset is not prompt-ready or retryable: ${assetId}`);
  }
  return orderGenerationJobs(manifest.assets.filter(({ asset_id }) => selected.has(asset_id)).map(generationJob), manifest.assets);
}
