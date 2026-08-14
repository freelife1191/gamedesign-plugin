import { createHash } from "node:crypto";

import { validateImageAssetManifest } from "./validate-image-assets.mjs";
import { hasCredentialOrEncodedPayload } from "./lib/image-input-safety.mjs";

const patternNames = ["base", "character", "skill-vfx", "environment", "ui-icon", "storyboard", "document-illustration"];
const patternFields = ["schema_version", "id", "purpose_medium", "view"];
const allowedExclusions = new Set(["logo", "watermark", "unrequested text", "third-party intellectual property", "branded source identity"]);
const canonicalPatternDigests = Object.freeze({
  base: "0803cc6d7949a0ce2e67e630a389aec7db4117f2e2423319a430c633bdf7fe6e",
  character: "5dbe8097fce4f9c7ca58f38f8d85faf419a7d40a6da0229efd6c4f5500699362",
  "document-illustration": "d469fc17ec50ff57e8ff8ae818db898b1efe80a7625243ccf11d9804c0f53d40",
  environment: "02aa48b3f37565f16b8ae592d5e6bd897bcb4d6d65d93e543706a3e5891885a4",
  "skill-vfx": "16ba9a2c2b50786d232449652e88451a75ebd89eb753fe6a3583b18d14439b2e",
  storyboard: "2ba10d794f08ca27ac01ab7fdde2344d2d255f5c0b481632193d6927f8daf642",
  "ui-icon": "20be4075de5bf78d87deac0c9a3f7268d25567fb9632a1b9faa83aac4ae6af97",
});

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

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

function assertCanonicalPatternCatalog(catalog) {
  for (const name of patternNames) {
    if (digest(canonicalJson(catalog[name])) !== canonicalPatternDigests[name]) reject("noncanonical_pattern_catalog");
  }
}

function isAllowedExclusion(path, value) {
  return path.at(-1) === "exclude" && allowedExclusions.has(value);
}

function unsafeString(value) {
  return hasCredentialOrEncodedPayload(value)
    || /\b(?:logo|watermark|unrequested text|third[- ]party (?:ip|intellectual property))\b/iu.test(value)
    || /\b(?:source|company|project|preset|studio|brand)\b.{0,48}\b(?:identity|name|preset|source)\b/iu.test(value)
    || /\b(?:house|branded?)\s+(?:visual|art)\s+(?:language|style)\b/iu.test(value)
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

function cloneTarget(value) {
  return {
    path: value.path,
    width: value.width,
    height: value.height,
    aspect_ratio: value.aspect_ratio,
    format: value.format,
    background: value.background,
  };
}

function targetOutput(asset) {
  if (!asset.planning || !asset.planning.target_output) reject("missing_planning_target");
  return asset.planning.target_output;
}

function alphaRequirements(asset) {
  return asset.type === "ui-icon" && targetOutput(asset).background === "transparent"
    ? ["verified alpha postprocess", "edge QA"]
    : [];
}

function promptFor(asset, catalog) {
  const base = assertPattern(catalog.base, "base");
  const pattern = assertPattern(catalog[patternName(asset.type)], patternName(asset.type));
  const alpha = alphaRequirements(asset);
  const target = targetOutput(asset);
  const size = `${target.width}x${target.height} (${target.aspect_ratio})`;
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
  assertSafeStrings(manifest);
  const validation = validateImageAssetManifest(manifest);
  if (!validation.ok) throw new Error(`Invalid image manifest: ${validation.errors.map(({ code }) => code).join(", ")}`);
  assertPatternCatalog(patternCatalog);
  assertSafeStrings(patternCatalog);
  assertCanonicalPatternCatalog(patternCatalog);
  const prompts = manifest.assets.map((asset) => {
    const target = targetOutput(asset);
    const prompt = promptFor(asset, patternCatalog);
    const postprocessRequirements = alphaRequirements(asset);
    return {
      asset_id: asset.asset_id,
      slot: asset.planning.upstream_slot_id,
      type: asset.type,
      dimensions: { width: target.width, height: target.height, aspect_ratio: target.aspect_ratio },
      target_output: cloneTarget(target),
      preserve: [...asset.art_brief.preserve],
      exclude: [...asset.art_brief.exclude],
      generation_state: asset.generation_state,
      approval_state: asset.approval_state,
      planning_disposition: asset.planning.disposition,
      generation_background: postprocessRequirements.length === 0 ? target.background : "opaque",
      postprocess_requirements: postprocessRequirements,
      prompt,
      prompt_digest: digest(prompt),
    };
  });
  const jsonValue = { schema_version: 1, expected_count: prompts.length, mode_scope: "manifest-declared", prompts };
  return {
    markdown: markdownFor(prompts),
    json: `${JSON.stringify(jsonValue, null, 2)}\n`,
    prompts: prompts.map((entry) => ({ ...entry, dimensions: { ...entry.dimensions }, target_output: { ...entry.target_output }, preserve: [...entry.preserve], exclude: [...entry.exclude], postprocess_requirements: [...entry.postprocess_requirements] })),
    promptDigests: prompts.map(({ asset_id, prompt_digest }) => ({ asset_id, prompt_digest })),
  };
}
