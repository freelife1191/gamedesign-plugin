import path from "node:path";
import { pathToFileURL } from "node:url";

const assetTypes = new Set([
  "character", "npc", "monster-boss", "skill-vfx", "environment-landmark", "item-equipment",
  "ui-icon", "story-storyboard", "key-art-pitch-concept", "document-illustration-cover", "skillstead-diagram",
]);
const requirements = new Set(["required", "recommended", "variant"]);
const generationStates = new Set([
  "planned", "prompt-ready", "selected", "generation-pending", "generated",
  "generation-unavailable", "generation-failed", "policy-blocked", "qa-failed",
]);
const approvalStates = new Set(["concept-draft", "document-approved", "production-candidate"]);
const documentSlots = new Set(["cover", "hero", "inline", "section", "appendix", "diagram"]);
const qualities = new Set(["low", "medium", "high", "auto"]);
const outputFormats = new Set(["png", "jpeg", "webp", "svg"]);
const backgrounds = new Set(["transparent", "opaque", "contextual"]);
const rightsDecisions = new Set(["approved", "restricted", "rejected", "needs-review"]);
const assetIdPattern = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u;
const safeIdentifierPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const sourceSectionPattern = /^content\.md#[a-z][a-z0-9-]*$/u;

function error(code, pathName, message) {
  return { code, path: pathName, message };
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function nonEmptyString(value) {
  return typeof value === "string" && value.trim() !== "";
}

function safeRelativePath(value, artifactRoot) {
  if (!nonEmptyString(value) || value.includes("\0") || value.includes("\\") || path.isAbsolute(value) || path.posix.isAbsolute(value)) return false;
  const normalized = path.posix.normalize(value);
  if (normalized === "." || normalized === ".." || normalized.startsWith("../") || normalized !== value) return false;
  if (artifactRoot !== undefined) {
    if (!nonEmptyString(artifactRoot)) return false;
    const root = path.resolve(artifactRoot);
    const resolved = path.resolve(root, ...normalized.split("/"));
    const relative = path.relative(root, resolved);
    if (relative === "" || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) return false;
  }
  return true;
}

function pushRequiredString(errors, value, pathName, code = "missing_required") {
  if (!nonEmptyString(value)) errors.push(error(code, pathName, "A non-empty value is required."));
}

function validateEvidencePaths(errors, evidencePaths, pathName, artifactRoot) {
  if (!Array.isArray(evidencePaths) || evidencePaths.length === 0) {
    errors.push(error("missing_review_evidence", pathName, "At least one in-artifact evidence path is required."));
    return;
  }
  for (let index = 0; index < evidencePaths.length; index += 1) {
    if (!safeRelativePath(evidencePaths[index], artifactRoot)) {
      errors.push(error("path_outside_artifact", `${pathName}[${index}]`, "Evidence paths must stay inside the artifact."));
    }
  }
}

function validateReviewRecord(errors, review, index, artifactRoot) {
  const reviewPath = `reviews[${index}]`;
  if (!isObject(review)) {
    errors.push(error("invalid_review_record", reviewPath, "Review records must be objects."));
    return;
  }
  if (!approvalStates.has(review.state) || review.state === "concept-draft") {
    errors.push(error("invalid_review_state", `${reviewPath}.state`, "Review records must name an approval state."));
  }
  pushRequiredString(errors, review.reviewer, `${reviewPath}.reviewer`, "missing_reviewer");
  if (!nonEmptyString(review.reviewed_at) || Number.isNaN(Date.parse(review.reviewed_at))) {
    errors.push(error("invalid_review_timestamp", `${reviewPath}.reviewed_at`, "Review timestamps must be valid dates."));
  }
  validateEvidencePaths(errors, review.evidence_paths, `${reviewPath}.evidence_paths`, artifactRoot);
  if (!rightsDecisions.has(review.rights_decision)) {
    errors.push(error("missing_rights_decision", `${reviewPath}.rights_decision`, "A closed rights decision is required."));
  }
}

function hasApprovedReview(asset, state) {
  return Array.isArray(asset.reviews) && asset.reviews.some((review) => review?.state === state && review.rights_decision === "approved"
    && nonEmptyString(review.reviewer) && Array.isArray(review.evidence_paths) && review.evidence_paths.length > 0);
}

function validateAsset(asset, index, artifactRoot) {
  const errors = [];
  const assetPath = `assets[${index}]`;
  if (!isObject(asset)) return [error("invalid_asset", assetPath, "Assets must be objects.")];
  if (!assetIdPattern.test(asset.asset_id ?? "")) errors.push(error("invalid_asset_id", `${assetPath}.asset_id`, "Asset IDs must be stable kebab-case identifiers."));
  if (!assetTypes.has(asset.type)) errors.push(error("invalid_asset_type", `${assetPath}.type`, "Asset type is not approved."));
  if (!requirements.has(asset.requirement)) errors.push(error("invalid_requirement", `${assetPath}.requirement`, "Asset requirement is not approved."));
  if (!generationStates.has(asset.generation_state)) errors.push(error("invalid_generation_state", `${assetPath}.generation_state`, "Generation state is not approved."));
  if (!approvalStates.has(asset.approval_state)) errors.push(error("invalid_approval_state", `${assetPath}.approval_state`, "Approval state is not approved."));

  pushRequiredString(errors, asset.purpose, `${assetPath}.purpose`);
  if (!isObject(asset.placement)) {
    errors.push(error("invalid_placement", `${assetPath}.placement`, "A document placement binding is required."));
  } else {
    if (!documentSlots.has(asset.placement.document_slot)) errors.push(error("invalid_document_slot", `${assetPath}.placement.document_slot`, "Document slot is not approved."));
    if (!sourceSectionPattern.test(asset.placement.source_section ?? "")) errors.push(error("invalid_source_section", `${assetPath}.placement.source_section`, "Source section must bind to a content.md heading."));
  }
  pushRequiredString(errors, asset.alt_text, `${assetPath}.alt_text`);
  pushRequiredString(errors, asset.readability, `${assetPath}.readability`);

  if (!isObject(asset.art_brief)) {
    errors.push(error("invalid_art_brief", `${assetPath}.art_brief`, "A complete art brief is required."));
  } else {
    for (const field of ["subject", "visual_style", "composition"]) pushRequiredString(errors, asset.art_brief[field], `${assetPath}.art_brief.${field}`);
    for (const field of ["preserve", "exclude"]) {
      if (!Array.isArray(asset.art_brief[field]) || asset.art_brief[field].length === 0 || !asset.art_brief[field].every(nonEmptyString)) {
        errors.push(error("missing_art_brief_constraint", `${assetPath}.art_brief.${field}`, "Art briefs need named preserve and exclude constraints."));
      }
    }
  }
  pushRequiredString(errors, asset.prompt, `${assetPath}.prompt`);

  if (!isObject(asset.output)) {
    errors.push(error("invalid_output", `${assetPath}.output`, "Output details are required."));
  } else {
    if (!safeRelativePath(asset.output.path, artifactRoot) || !asset.output.path.startsWith("assets/generated/")) {
      errors.push(error("path_outside_artifact", `${assetPath}.output.path`, "Generated output must be a relative path under assets/generated/."));
    }
    for (const field of ["width", "height"]) {
      if (!Number.isInteger(asset.output[field]) || asset.output[field] < 1 || asset.output[field] > 8192) {
        errors.push(error("invalid_dimensions", `${assetPath}.output.${field}`, "Output dimensions must be bounded positive integers."));
      }
    }
    if (!nonEmptyString(asset.output.aspect_ratio) || !/^\d{1,4}:\d{1,4}$/u.test(asset.output.aspect_ratio)) errors.push(error("invalid_aspect_ratio", `${assetPath}.output.aspect_ratio`, "Aspect ratio is required."));
    if (!outputFormats.has(asset.output.format)) errors.push(error("invalid_output_format", `${assetPath}.output.format`, "Output format is not approved."));
    if (!backgrounds.has(asset.output.background)) errors.push(error("invalid_background", `${assetPath}.output.background`, "Output background is not approved."));
  }

  if (!isObject(asset.provider)) {
    errors.push(error("invalid_provider", `${assetPath}.provider`, "Provider, model, and quality are required."));
  } else {
    if (!safeIdentifierPattern.test(asset.provider.name ?? "")) errors.push(error("invalid_provider_name", `${assetPath}.provider.name`, "Provider name is not safe."));
    if (!safeIdentifierPattern.test(asset.provider.model ?? "")) errors.push(error("invalid_provider_model", `${assetPath}.provider.model`, "Provider model is not safe."));
    if (!qualities.has(asset.provider.quality)) errors.push(error("invalid_provider_quality", `${assetPath}.provider.quality`, "Provider quality is not approved."));
  }

  if (!isObject(asset.rights)) {
    errors.push(error("missing_rights_data", `${assetPath}.rights`, "Rights and provenance data are required."));
  } else {
    for (const field of ["provenance", "rights_holder", "license"]) {
      if (!nonEmptyString(asset.rights[field])) errors.push(error("missing_rights_data", `${assetPath}.rights.${field}`, "Rights and provenance data are required."));
    }
  }

  if (!Array.isArray(asset.reviews)) {
    errors.push(error("invalid_reviews", `${assetPath}.reviews`, "Reviews must be an array."));
  } else {
    asset.reviews.forEach((review, reviewIndex) => validateReviewRecord(errors, review, reviewIndex, artifactRoot));
  }

  if (asset.approval_state === "document-approved" || asset.approval_state === "production-candidate") {
    if (!hasApprovedReview(asset, "document-approved")) {
      errors.push(error("missing_document_approval", `${assetPath}.reviews`, "Document approval needs a named visual reviewer and evidence."));
    }
  }
  if (asset.approval_state === "production-candidate") {
    pushRequiredString(errors, asset.technical_fit, `${assetPath}.technical_fit`, "missing_production_readiness");
    pushRequiredString(errors, asset.gameplay_readability, `${assetPath}.gameplay_readability`, "missing_production_readiness");
    if (!hasApprovedReview(asset, "production-candidate")) {
      errors.push(error("missing_production_approval", `${assetPath}.reviews`, "Production candidacy needs named human rights/provenance approval and evidence."));
    }
  }
  return errors;
}

export function validateImageAssetManifest(value, { artifactRoot } = {}) {
  const errors = [];
  const warnings = [];
  if (!isObject(value)) {
    return { ok: false, errors: [error("invalid_manifest", "", "Image asset manifest must be an object.")], warnings, counts: { assets: 0, generation: {}, approval: {} } };
  }
  if (value.schema_version !== 1) errors.push(error("invalid_schema_version", "schema_version", "Schema version 1 is required."));
  if (!Array.isArray(value.assets)) errors.push(error("invalid_assets", "assets", "Assets must be an array."));
  const assets = Array.isArray(value.assets) ? value.assets : [];
  const ids = new Set();
  const generation = {};
  const approval = {};
  assets.forEach((asset, index) => {
    errors.push(...validateAsset(asset, index, artifactRoot));
    if (isObject(asset)) {
      if (ids.has(asset.asset_id)) errors.push(error("duplicate_asset_id", `assets[${index}].asset_id`, "Asset IDs must be unique."));
      ids.add(asset.asset_id);
      if (generationStates.has(asset.generation_state)) generation[asset.generation_state] = (generation[asset.generation_state] ?? 0) + 1;
      if (approvalStates.has(asset.approval_state)) approval[asset.approval_state] = (approval[asset.approval_state] ?? 0) + 1;
    }
  });
  return { ok: errors.length === 0, errors, warnings, counts: { assets: assets.length, generation, approval } };
}

function cloneAsset(asset) {
  return JSON.parse(JSON.stringify(asset));
}

function transitionError(message) {
  throw new Error(`Invalid image review transition: ${message}`);
}

export function applyImageReviewTransition(asset, {
  targetState,
  reviewer,
  reviewedAt,
  evidencePaths,
  rightsDecision,
} = {}, { artifactRoot } = {}) {
  if (!isObject(asset)) transitionError("asset must be an object");
  if (!approvalStates.has(targetState) || targetState === "concept-draft") transitionError("target state is not an approval transition");
  const currentState = asset.approval_state;
  const expectedTarget = currentState === "concept-draft" ? "document-approved"
    : currentState === "document-approved" ? "production-candidate" : undefined;
  if (targetState !== expectedTarget) transitionError("skipped or invalid approval transition");
  if (!nonEmptyString(reviewer)) transitionError("reviewer is required");
  if (!nonEmptyString(reviewedAt) || Number.isNaN(Date.parse(reviewedAt))) transitionError("reviewedAt must be a valid timestamp");
  if (!rightsDecisions.has(rightsDecision)) transitionError("rights decision is required");
  if (rightsDecision !== "approved") transitionError("approval requires an approved rights decision");
  const evidenceErrors = [];
  validateEvidencePaths(evidenceErrors, evidencePaths, "evidencePaths", artifactRoot);
  if (evidenceErrors.length > 0) transitionError("evidence must stay inside the artifact");

  const sourceValidation = validateImageAssetManifest({ schema_version: 1, assets: [asset] }, { artifactRoot });
  if (!sourceValidation.ok) transitionError(sourceValidation.errors.map(({ code }) => code).join(", "));
  const next = cloneAsset(asset);
  next.approval_state = targetState;
  next.reviews = [...next.reviews, {
    state: targetState,
    reviewer: reviewer.trim(),
    reviewed_at: reviewedAt,
    evidence_paths: [...evidencePaths],
    rights_decision: rightsDecision,
  }];
  const validation = validateImageAssetManifest({ schema_version: 1, assets: [next] }, { artifactRoot });
  if (!validation.ok) transitionError(validation.errors.map(({ code }) => code).join(", "));
  return next;
}

async function main() {
  const args = process.argv.slice(2);
  let artifactRoot;
  if (args.length === 2 && args[0] === "--artifact-root") artifactRoot = args[1];
  else if (args.length !== 0) throw new Error("Usage: validate-image-assets.mjs [--artifact-root <path>]");
  const input = await new Promise((resolve, reject) => {
    const chunks = [];
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => chunks.push(chunk));
    process.stdin.once("end", () => resolve(chunks.join("")));
    process.stdin.once("error", reject);
  });
  const result = validateImageAssetManifest(JSON.parse(input), { artifactRoot });
  process.stdout.write(`${JSON.stringify(result)}\n`);
  if (!result.ok) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((cause) => {
    process.stderr.write(`Image asset validation failed: ${cause.message}\n`);
    process.exitCode = 1;
  });
}
