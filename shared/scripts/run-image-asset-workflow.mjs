import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildImageAssetPlan, selectGenerationJobs } from "./build-image-asset-plan.mjs";
import { compileImagePrompts } from "./compile-image-prompts.mjs";
import { generateOpenAIImages } from "./generate-openai-images.mjs";
import { validatePngBuffer } from "./lib/image-file-validation.mjs";
import { resolveImageProvider } from "./lib/image-provider.mjs";
import { canonicalArtifactRoot, ensureArtifactDirectories, safeWriteArtifactFile } from "./lib/safe-artifact-write.mjs";
import { applyImageReviewTransition, validateImageAssetManifest } from "./validate-image-assets.mjs";

const patternNames = ["base", "character", "skill-vfx", "environment", "ui-icon", "storyboard", "document-illustration"];
const specialistReviewerIds = new Set([
  "art-brief-director", "career-strategist", "content-narrative-designer", "document-quality-editor", "evidence-auditor",
  "game-design-mentor", "interview-coach", "lead-game-designer", "liveops-data-designer", "portfolio-reviewer",
  "production-feasibility-critic", "reverse-design-critic", "system-economy-designer", "ux-accessibility-reviewer", "visual-asset-reviewer",
]);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

async function defaultPatternCatalog() {
  const root = fileURLToPath(new URL("../image-assets/prompt-patterns/", import.meta.url));
  const entries = await Promise.all(patternNames.map(async (name) => [name, JSON.parse(await readFile(path.join(root, `${name}.json`), "utf8"))]));
  return Object.fromEntries(entries);
}

function selectionRecord(mode, selectedAssetIds, selectionReceipt) {
  return {
    mode,
    asset_ids: [...selectedAssetIds],
    source: mode === "select" ? clone(selectionReceipt) : "mode-scope",
  };
}

function exactKeys(value, keys) {
  return value && typeof value === "object" && !Array.isArray(value)
    && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());
}

function safeArtifactRelativePath(value) {
  return typeof value === "string" && value.length > 0 && !value.includes("\0") && !value.includes("\\")
    && value === value.normalize("NFC") && !path.posix.isAbsolute(value) && path.posix.normalize(value) === value && !value.startsWith("../") && value !== ".";
}

async function readRegularArtifactFile(root, relativePath) {
  if (!safeArtifactRelativePath(relativePath)) throw new Error("Receipt path must be a normalized artifact-relative path.");
  let cursor = root;
  for (const segment of relativePath.split("/")) {
    cursor = path.resolve(cursor, segment);
    const stats = await lstat(cursor);
    if (stats.isSymbolicLink()) throw new Error("Receipt and evidence files must not traverse symbolic links.");
  }
  const stats = await lstat(cursor);
  if (!stats.isFile()) throw new Error("Receipt and evidence paths must identify regular files.");
  return readFile(cursor, "utf8");
}

async function readRegularArtifactBytes(root, relativePath) {
  if (!safeArtifactRelativePath(relativePath)) throw new Error("Host output path must be a normalized artifact-relative path.");
  let cursor = root;
  for (const segment of relativePath.split("/")) {
    cursor = path.resolve(cursor, segment);
    const stats = await lstat(cursor);
    if (stats.isSymbolicLink()) throw new Error("Host output must not traverse symbolic links.");
  }
  const stats = await lstat(cursor);
  if (!stats.isFile()) throw new Error("Host output path must identify a regular file.");
  return readFile(cursor);
}

function hostEventId(value) {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(value) ? value : undefined;
}

function validateSelectionReceipt(receipt, selectedAssetIds) {
  if (!exactKeys(receipt, ["kind", "channel", "event_id", "asset_ids"])
    || receipt.kind !== "host-user-image-selection" || receipt.channel !== "host-user-input" || !hostEventId(receipt.event_id)
    || !Array.isArray(receipt.asset_ids) || receipt.asset_ids.length === 0 || new Set(receipt.asset_ids).size !== receipt.asset_ids.length
    || !receipt.asset_ids.every((assetId) => typeof assetId === "string")
    || JSON.stringify(receipt.asset_ids) !== JSON.stringify(selectedAssetIds)) {
    throw new Error("Select generation requires closed host-user selection evidence matching the selected stable asset IDs.");
  }
  return clone(receipt);
}

async function readUserDecisionReceipt(root, receipt, { assetId, fromState, targetState, reviewer, reviewedAt, rightsDecision, evidencePaths }) {
  const required = ["schema_version", "kind", "capture", "asset_id", "from_state", "target_state", "decision", "reviewer", "decided_at", "rights_decision", "evidence_paths"];
  const canonicalReviewer = canonicalHumanReviewer(reviewer);
  if (specialistReviewerIds.has(canonicalReviewer.toLowerCase())) {
    throw new Error("Host user decision reviewer must be a named human, not a product specialist.");
  }
  if (!exactKeys(receipt, required) || receipt.schema_version !== 1 || receipt.kind !== "host-user-image-decision"
    || !exactKeys(receipt.capture, ["channel", "event_id"]) || receipt.capture.channel !== "host-user-input"
    || !hostEventId(receipt.capture.event_id)
    || receipt.asset_id !== assetId || receipt.from_state !== fromState || receipt.target_state !== targetState || receipt.decision !== "approved"
    || receipt.reviewer !== canonicalReviewer || receipt.decided_at !== reviewedAt || Number.isNaN(Date.parse(receipt.decided_at))
    || receipt.rights_decision !== rightsDecision || JSON.stringify(receipt.evidence_paths) !== JSON.stringify(evidencePaths)) {
    throw new Error("Host user decision receipt does not match the requested image review transition.");
  }
  try {
    for (const evidencePath of evidencePaths) await readRegularArtifactFile(root, evidencePath);
  } catch {
    throw new Error("Host user decision receipt must reference readable artifact-local evidence.");
  }
  return { ...receipt, reviewer: canonicalReviewer };
}

function canonicalHumanReviewer(value) {
  if (typeof value !== "string") throw new Error("Host user decision reviewer must be a named human.");
  const canonical = value.normalize("NFKC").trim();
  if (canonical.length === 0 || canonical.length > 128 || /[\u0000-\u001f\u007f-\u009f]/u.test(canonical)
    || /^[A-Za-z][A-Za-z0-9]*(?:-[A-Za-z0-9]+)+$/u.test(canonical)) {
    throw new Error("Host user decision reviewer must be a named human, not a role-like identifier.");
  }
  return canonical;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function generateViaOpenAI({ jobs, apiKey, model, quality, stagingRoot, fetchFn, sleepFn, now, generateOpenAIImagesFn }) {
  return generateOpenAIImagesFn({ jobs, apiKey, model, quality, stagingRoot, fetchFn, sleepFn, now });
}

function applyProviderResults(manifest, providerResult, provider, config) {
  const next = clone(manifest);
  const results = new Map((providerResult?.results ?? []).map((result) => [result.asset_id, result]));
  const failures = new Map((providerResult?.failures ?? []).map((failure) => [failure.asset_id, failure]));
  for (const asset of next.assets) {
    const result = results.get(asset.asset_id);
    const failure = failures.get(asset.asset_id);
    if (result) {
      asset.generation_state = result.generation_state;
      if (result.output) {
        const { path: outputPath, width, height, aspect_ratio: aspectRatio, format, background } = result.output;
        asset.output = {
          ...asset.output,
          ...(outputPath === undefined ? {} : { path: outputPath }),
          ...(width === undefined ? {} : { width }),
          ...(height === undefined ? {} : { height }),
          ...(aspectRatio === undefined ? {} : { aspect_ratio: aspectRatio }),
          ...(format === undefined ? {} : { format }),
          ...(background === undefined ? {} : { background }),
        };
      }
      if (provider === "openai") {
        asset.provider = { name: "openai", model: result.provenance.model, quality: result.provenance.quality };
      } else {
        asset.provider = {
          name: result.provenance?.provider ?? "codex-host",
          requested_model: config.model,
          requested_quality: config.quality,
          applied_model: result.provenance?.applied_model ?? null,
          applied_quality: result.provenance?.applied_quality ?? null,
        };
      }
    } else if (failure) {
      asset.generation_state = failure.generation_state;
      if (provider === "codex" && failure.provenance) {
        asset.provider = {
          name: failure.provenance.provider ?? "codex-host",
          requested_model: config.model,
          requested_quality: config.quality,
          applied_model: failure.provenance.applied_model ?? null,
          applied_quality: failure.provenance.applied_quality ?? null,
        };
      }
    }
  }
  return next;
}

function validateHostResult(value, jobs) {
  if (!exactKeys(value, ["results", "failures"]) || !Array.isArray(value.results) || !Array.isArray(value.failures)) {
    throw new Error("Host generation must return results and failures arrays.");
  }
  const selected = new Set(jobs.map(({ asset_id }) => asset_id));
  const seen = new Set();
  for (const item of [...value.results, ...value.failures]) {
    if (!item || typeof item !== "object" || typeof item.asset_id !== "string" || !selected.has(item.asset_id) || seen.has(item.asset_id)) {
      throw new Error("Host generation result must contain each selected stable asset ID at most once.");
    }
    seen.add(item.asset_id);
  }
  for (const result of value.results) {
    if (result.generation_state !== "generated" || !result.provenance || typeof result.provenance !== "object") {
      throw new Error("Host generation success requires generated state and provider provenance.");
    }
  }
  for (const failure of value.failures) {
    if (!["generation-unavailable", "generation-failed", "policy-blocked", "qa-failed"].includes(failure.generation_state)) {
      throw new Error("Host generation failure must use an explicit non-generated failure state.");
    }
  }
  return clone(value);
}

async function validateHostOutputs(value, jobs, root) {
  const byAssetId = new Map(jobs.map((job) => [job.asset_id, job]));
  const failures = value.failures.map((failure) => ({
    ...failure,
    provenance: failure.provenance ?? { provider: "codex-host" },
  }));
  const results = [];
  for (const result of value.results) {
    const job = byAssetId.get(result.asset_id);
    try {
      const output = result.output;
      if (!exactKeys(output, ["path", "width", "height", "aspect_ratio", "format", "background", "digest"])
        || !exactKeys(result.provenance, ["provider", "prompt_digest", "output_digest"])
        || JSON.stringify({ path: output.path, width: output.width, height: output.height, aspect_ratio: output.aspect_ratio, format: output.format, background: output.background })
          !== JSON.stringify(job.output)) throw new Error("Host output does not match its selected job.");
      const inspected = validatePngBuffer(await readRegularArtifactBytes(root, output.path), job.output);
      if (output.digest !== inspected.digest || result.provenance.prompt_digest !== sha256(job.prompt) || result.provenance.output_digest !== inspected.digest) {
        throw new Error("Host output digest evidence does not match the generated file.");
      }
      results.push(result);
    } catch {
      failures.push({ asset_id: result.asset_id, generation_state: "qa-failed", reason: "invalid-host-output", provenance: result.provenance });
    }
  }
  const handled = new Set([...results, ...failures].map(({ asset_id }) => asset_id));
  for (const { asset_id } of jobs) {
    if (!handled.has(asset_id)) {
      failures.push({ asset_id, generation_state: "generation-failed", reason: "host-result-omitted", provenance: { provider: "codex-host" } });
    }
  }
  return { results, failures };
}

export async function runImageAssetWorkflow(options = {}) {
  const planned = await planImageAssetWorkflow(options);
  const generated = await generateImageAssetWorkflow({ ...options, manifest: planned.manifest });
  return { ...generated, prompts: { promptDigests: planned.promptDigests } };
}

export async function planImageAssetWorkflow({ artifactRoot, artifact, qualityProfile, existingManifest = null, patternCatalog } = {}) {
  const root = await ensureArtifactDirectories({ artifactRoot, directories: ["assets", "assets/prompts", "decisions"] });
  const plan = buildImageAssetPlan({ artifact, qualityProfile, existingManifest });
  const prompts = compileImagePrompts({ manifest: plan.manifest, patternCatalog: patternCatalog ?? await defaultPatternCatalog() });
  await safeWriteArtifactFile({ artifactRoot: root, relativePath: "assets/prompts/image-prompts.md", data: prompts.markdown });
  await safeWriteArtifactFile({ artifactRoot: root, relativePath: "assets/prompts/image-prompts.json", data: prompts.json });
  await safeWriteArtifactFile({ artifactRoot: root, relativePath: "assets/image-assets.yml", data: `${JSON.stringify(plan.manifest, null, 2)}\n` });
  return { manifest: plan.manifest, summary: plan.summary, promptDigests: prompts.promptDigests };
}

export async function generateImageAssetWorkflow({
  artifactRoot,
  manifest,
  config,
  codexCapability,
  selectedAssetIds = [],
  selectionReceipt,
  fetchFn,
  sleepFn,
  now,
  hostGenerate,
  generateOpenAIImagesFn = generateOpenAIImages,
} = {}) {
  const root = (await canonicalArtifactRoot(artifactRoot)).path;
  if (!manifest || typeof manifest !== "object") throw new Error("A planned image manifest is required for generation.");
  if (!config || typeof config !== "object" || typeof config.mode !== "string" || typeof config.model !== "string"
    || typeof config.quality !== "string" || typeof config.apiKeyPresent !== "boolean") {
    throw new Error("A validated internal image config is required.");
  }
  const { apiKey, ...publicConfig } = config;
  const receipt = publicConfig.mode === "select" ? validateSelectionReceipt(selectionReceipt, selectedAssetIds) : undefined;
  const jobs = selectGenerationJobs({ manifest, mode: publicConfig.mode, selectedAssetIds });
  const selection = selectionRecord(publicConfig.mode, selectedAssetIds, receipt);
  if (receipt) await safeWriteArtifactFile({
    artifactRoot: root, relativePath: `assets/prompts/image-generation-selection-${receipt.event_id}.json`, data: `${JSON.stringify(selection, null, 2)}\n`, policy: "create-once",
  });
  const decision = resolveImageProvider({ mode: publicConfig.mode, apiKeyPresent: publicConfig.apiKeyPresent, codexCapability });
  let providerResult = { results: [], failures: [] };
  if (jobs.length > 0 && decision.provider === "openai") {
    if (typeof apiKey !== "string" || apiKey.length === 0) throw new Error("Internal API key is required for the OpenAI route.");
    providerResult = await generateViaOpenAI({
      jobs, apiKey, model: publicConfig.model, quality: publicConfig.quality, stagingRoot: root, fetchFn, sleepFn, now, generateOpenAIImagesFn,
    });
  } else if (jobs.length > 0 && decision.provider === "codex") {
    if (typeof hostGenerate !== "function") {
      providerResult = { results: [], failures: jobs.map(({ asset_id }) => ({ asset_id, generation_state: "generation-unavailable", reason: "host-generator-unavailable" })) };
    } else {
      providerResult = await validateHostOutputs(validateHostResult(await hostGenerate({ jobs: clone(jobs) }), jobs), jobs, root);
    }
  } else if (jobs.length > 0 && decision.provider === "unavailable") {
    providerResult = { results: [], failures: jobs.map(({ asset_id }) => ({ asset_id, generation_state: "generation-unavailable", reason: "no-provider-available" })) };
  }
  const nextManifest = applyProviderResults(manifest, providerResult, decision.provider, publicConfig);
  const validation = validateImageAssetManifest(nextManifest, { artifactRoot: root });
  if (!validation.ok) throw new Error(`Workflow produced an invalid image manifest: ${validation.errors.map(({ code }) => code).join(", ")}`);

  await safeWriteArtifactFile({ artifactRoot: root, relativePath: "assets/image-assets.yml", data: `${JSON.stringify(nextManifest, null, 2)}\n` });
  return { manifest: nextManifest, selection, decision, providerResult };
}

export async function reviewImageAssetWorkflow({
  artifactRoot,
  manifest,
  assetId,
  targetState,
  reviewer,
  reviewedAt,
  rightsDecision,
  evidencePaths,
  decisionReceipt,
} = {}) {
  const root = (await canonicalArtifactRoot(artifactRoot)).path;
  const validation = validateImageAssetManifest(manifest, { artifactRoot: root });
  if (!validation.ok) throw new Error("A valid image manifest is required before review.");
  const asset = manifest.assets.find(({ asset_id }) => asset_id === assetId);
  if (!asset) throw new Error("Review requires a known stable asset ID.");
  const receipt = await readUserDecisionReceipt(root, decisionReceipt, {
    assetId, fromState: asset.approval_state, targetState, reviewer, reviewedAt, rightsDecision, evidencePaths,
  });
  const decisionReceiptPath = `decisions/image-review-${receipt.capture.event_id}.json`;
  await safeWriteArtifactFile({ artifactRoot: root, relativePath: decisionReceiptPath, data: `${JSON.stringify(receipt, null, 2)}\n`, policy: "create-once" });
  const reviewedAsset = applyImageReviewTransition(asset, {
    targetState, reviewer, reviewedAt, evidencePaths: [...evidencePaths, decisionReceiptPath], rightsDecision,
  }, { artifactRoot: root });
  const next = clone(manifest);
  next.assets[next.assets.findIndex(({ asset_id }) => assetId === asset_id)] = reviewedAsset;
  const nextValidation = validateImageAssetManifest(next, { artifactRoot: root });
  if (!nextValidation.ok) throw new Error("Reviewed image manifest is invalid.");
  await safeWriteArtifactFile({ artifactRoot: root, relativePath: "assets/image-assets.yml", data: `${JSON.stringify(next, null, 2)}\n` });
  return { manifest: next, reviewedAsset, decisionReceiptPath };
}
