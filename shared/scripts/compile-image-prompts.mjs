import { createHash } from "node:crypto";

import { validateImageAssetManifest } from "./validate-image-assets.mjs";

const patternNames = ["base", "character", "skill-vfx", "environment", "ui-icon", "storyboard", "document-illustration"];
const patternFields = ["schema_version", "id", "purpose_medium", "view"];
const allowedExclusions = new Set(["logo", "watermark", "unrequested text", "third-party intellectual property", "branded source identity"]);

function compilationError(code) {
  const error = new Error("Image prompt compilation rejected unsafe or invalid input.");
  error.code = code;
  return error;
}

function reject(code) {
  throw compilationError(code);
}

function safePatternText(value) {
  return typeof value === "string" && value.trim() !== "" && value.length <= 512 && !/[\u0000-\u001f\u007f]/u.test(value);
}

function assertPattern(pattern, name) {
  if (pattern === null || typeof pattern !== "object" || Array.isArray(pattern)
    || Object.keys(pattern).length !== patternFields.length || Object.keys(pattern).some((field) => !patternFields.includes(field))
    || pattern.schema_version !== 1 || pattern.id !== name || !safePatternText(pattern.purpose_medium) || !safePatternText(pattern.view)) reject("invalid_pattern_catalog");
  return pattern;
}

function assertPatternCatalog(catalog) {
  if (catalog === null || typeof catalog !== "object" || Array.isArray(catalog)
    || Object.keys(catalog).length !== patternNames.length || Object.keys(catalog).some((name) => !patternNames.includes(name))) {
    reject("invalid_pattern_catalog");
  }
  for (const name of patternNames) assertPattern(catalog[name], name);
}

function isAllowedExclusion(path, value) {
  return path.at(-1) === "exclude" && allowedExclusions.has(value);
}

function unsafeString(value) {
  return /\b(?:api[_ -]?key|authorization|bearer)\b/iu.test(value)
    || /\b(?:sk|rk|pk)_[A-Za-z0-9_-]{8,}\b/iu.test(value)
    || /[A-Za-z0-9+/]{80,}={0,2}/u.test(value)
    || /\b(?:logo|watermark|unrequested text|third[- ]party (?:ip|intellectual property))\b/iu.test(value)
    || /\b(?:source|company|project|preset|studio|brand)\b.{0,48}\b(?:identity|name|preset|source)\b/iu.test(value)
    || /\b(?:in the style of|style of|inspired by)\b/iu.test(value);
}

function assertSafeStrings(value, path = []) {
  if (typeof value === "string") {
    if (!isAllowedExclusion(path, value) && unsafeString(value)) reject("unsafe_prompt_content");
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((child) => assertSafeStrings(child, path));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) assertSafeStrings(child, [...path, key]);
  }
}

function patternName(type) {
  if (["character", "npc", "monster-boss", "item-equipment"].includes(type)) return "character";
  if (type === "skill-vfx") return "skill-vfx";
  if (type === "environment-landmark") return "environment";
  if (type === "ui-icon") return "ui-icon";
  if (type === "story-storyboard") return "storyboard";
  return "document-illustration";
}

function cleanPurpose(purpose) {
  return purpose.split(" Scene direction: ", 1)[0];
}

function scene(purpose) {
  return purpose.includes(" Scene direction: ")
    ? purpose.slice(purpose.indexOf(" Scene direction: ") + " Scene direction: ".length)
    : "A contextual background appropriate to the documented slot.";
}

function digest(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function alphaRequirements(asset) {
  return asset.type === "ui-icon" && asset.output.background === "transparent"
    ? ["verified alpha postprocess", "edge QA"]
    : [];
}

function promptFor(asset, catalog) {
  const base = assertPattern(catalog.base, "base");
  const pattern = assertPattern(catalog[patternName(asset.type)], patternName(asset.type));
  const alpha = alphaRequirements(asset);
  const size = `${asset.output.width}x${asset.output.height} (${asset.output.aspect_ratio})`;
  const variant = asset.requirement === "variant" ? "variant asset" : `${asset.requirement} asset`;
  const generation = alpha.length === 0 ? "Use the documented background treatment." : "Use opaque generation; transparent delivery requires verified alpha postprocess and edge QA.";
  return [
    `Purpose and medium: ${pattern.purpose_medium} ${base.purpose_medium}`,
    `Gameplay or narrative purpose: ${cleanPurpose(asset.purpose)}`,
    `Scene and background: ${scene(asset.purpose)} ${generation}`,
    `Subject and silhouette: ${asset.art_brief.subject}`,
    `View, composition, and camera: ${asset.art_brief.composition} ${pattern.view}`,
    `Palette, light, material, expression, and action: ${asset.art_brief.visual_style}`,
    `Play-distance readability: ${asset.readability}`,
    `Size and variant: ${size}; ${variant}.`,
    `Preserve conditions: ${asset.art_brief.preserve.join("; ")}`,
    `Exclusions: ${asset.art_brief.exclude.join("; ")}`,
  ].join("\n");
}

function markdownFor(entries) {
  const lines = ["# Image prompts", "", `Expected count: ${entries.length}`, "Mode scope: manifest-declared", ""];
  for (const entry of entries) {
    lines.push(`## ${entry.asset_id}`, "", `- Slot: ${entry.slot}`, `- Type: ${entry.type}`,
      `- Dimensions: ${entry.dimensions.width}x${entry.dimensions.height} (${entry.dimensions.aspect_ratio})`,
      `- Generation state: ${entry.generation_state}`, `- Approval state: ${entry.approval_state}`,
      `- Planning disposition: ${entry.planning_disposition}`, `- Generation background: ${entry.generation_background}`,
      `- Prompt digest: ${entry.prompt_digest}`, `- Preserve: ${entry.preserve.join("; ")}`,
      `- Exclude: ${entry.exclude.join("; ")}`);
    lines.push(`- Postprocess requirements: ${entry.postprocess_requirements.join("; ") || "none"}`);
    lines.push(`- Semantic record: ${JSON.stringify(entry)}`);
    lines.push("", entry.prompt, "");
  }
  return `${lines.join("\n")}\n`;
}

export function compileImagePrompts({ manifest, patternCatalog } = {}) {
  const validation = validateImageAssetManifest(manifest);
  if (!validation.ok) throw new Error(`Invalid image manifest: ${validation.errors.map(({ code }) => code).join(", ")}`);
  assertPatternCatalog(patternCatalog);
  assertSafeStrings(manifest);
  assertSafeStrings(patternCatalog);
  const prompts = manifest.assets.map((asset) => {
    const prompt = promptFor(asset, patternCatalog);
    const postprocessRequirements = alphaRequirements(asset);
    return {
      asset_id: asset.asset_id,
      slot: asset.planning.upstream_slot_id,
      type: asset.type,
      dimensions: { width: asset.output.width, height: asset.output.height, aspect_ratio: asset.output.aspect_ratio },
      preserve: [...asset.art_brief.preserve],
      exclude: [...asset.art_brief.exclude],
      generation_state: asset.generation_state,
      approval_state: asset.approval_state,
      planning_disposition: asset.planning.disposition,
      generation_background: postprocessRequirements.length === 0 ? asset.output.background : "opaque",
      postprocess_requirements: postprocessRequirements,
      prompt,
      prompt_digest: digest(prompt),
    };
  });
  const jsonValue = { schema_version: 1, expected_count: prompts.length, mode_scope: "manifest-declared", prompts };
  return {
    markdown: markdownFor(prompts),
    json: `${JSON.stringify(jsonValue, null, 2)}\n`,
    promptDigests: prompts.map(({ asset_id, prompt_digest }) => ({ asset_id, prompt_digest })),
  };
}
