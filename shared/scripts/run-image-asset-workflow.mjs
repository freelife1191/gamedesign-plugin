import { lstat, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildImageAssetPlan, selectGenerationJobs } from "./build-image-asset-plan.mjs";
import { compileImagePrompts } from "./compile-image-prompts.mjs";
import { generateOpenAIImages } from "./generate-openai-images.mjs";
import { resolveImageProvider } from "./lib/image-provider.mjs";
import { applyImageReviewTransition, validateImageAssetManifest } from "./validate-image-assets.mjs";

const patternNames = ["base", "character", "skill-vfx", "environment", "ui-icon", "storyboard", "document-illustration"];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function safeRoot(value) {
  if (typeof value !== "string" || value.length === 0 || value.includes("\0") || !path.isAbsolute(value)) {
    throw new Error("artifactRoot must be an absolute artifact directory.");
  }
  return path.resolve(value);
}

async function defaultPatternCatalog() {
  const root = fileURLToPath(new URL("../image-assets/prompt-patterns/", import.meta.url));
  const entries = await Promise.all(patternNames.map(async (name) => [name, JSON.parse(await readFile(path.join(root, `${name}.json`), "utf8"))]));
  return Object.fromEntries(entries);
}

function selectionRecord(mode, selectedAssetIds, selectionSource) {
  return {
    mode,
    asset_ids: [...selectedAssetIds],
    source: mode === "select" ? selectionSource : "mode-scope",
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

async function readUserDecisionReceipt(root, receiptPath, { assetId, fromState, targetState, reviewer, reviewedAt, rightsDecision, evidencePaths }) {
  let receipt;
  try {
    receipt = JSON.parse(await readRegularArtifactFile(root, receiptPath));
  } catch {
    throw new Error("A readable artifact-local host user decision receipt is required.");
  }
  const required = ["schema_version", "kind", "capture", "asset_id", "from_state", "target_state", "decision", "reviewer", "decided_at", "rights_decision", "evidence_paths"];
  if (!exactKeys(receipt, required) || receipt.schema_version !== 1 || receipt.kind !== "host-user-image-decision"
    || !exactKeys(receipt.capture, ["channel", "event_id"]) || receipt.capture.channel !== "host-user-input"
    || typeof receipt.capture.event_id !== "string" || receipt.capture.event_id.trim() === ""
    || receipt.asset_id !== assetId || receipt.from_state !== fromState || receipt.target_state !== targetState || receipt.decision !== "approved"
    || receipt.reviewer !== reviewer || receipt.decided_at !== reviewedAt || Number.isNaN(Date.parse(receipt.decided_at))
    || receipt.rights_decision !== rightsDecision || JSON.stringify(receipt.evidence_paths) !== JSON.stringify(evidencePaths)) {
    throw new Error("Host user decision receipt does not match the requested image review transition.");
  }
  try {
    for (const evidencePath of evidencePaths) await readRegularArtifactFile(root, evidencePath);
  } catch {
    throw new Error("Host user decision receipt must reference readable artifact-local evidence.");
  }
  return receipt;
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
  return clone(value);
}

export async function runImageAssetWorkflow(options = {}) {
  const planned = await planImageAssetWorkflow(options);
  const generated = await generateImageAssetWorkflow({ ...options, manifest: planned.manifest });
  return { ...generated, prompts: { promptDigests: planned.promptDigests } };
}

export async function planImageAssetWorkflow({ artifactRoot, artifact, qualityProfile, existingManifest = null, patternCatalog } = {}) {
  const root = safeRoot(artifactRoot);
  const plan = buildImageAssetPlan({ artifact, qualityProfile, existingManifest });
  const prompts = compileImagePrompts({ manifest: plan.manifest, patternCatalog: patternCatalog ?? await defaultPatternCatalog() });
  await mkdir(path.join(root, "assets", "prompts"), { recursive: true });
  await writeFile(path.join(root, "assets", "image-assets.yml"), `${JSON.stringify(plan.manifest, null, 2)}\n`);
  await writeFile(path.join(root, "assets", "prompts", "image-prompts.md"), prompts.markdown);
  await writeFile(path.join(root, "assets", "prompts", "image-prompts.json"), prompts.json);
  return { manifest: plan.manifest, summary: plan.summary, promptDigests: prompts.promptDigests };
}

export async function generateImageAssetWorkflow({
  artifactRoot,
  manifest,
  config,
  codexCapability,
  selectedAssetIds = [],
  selectionSource,
  fetchFn,
  sleepFn,
  now,
  hostGenerate,
  generateOpenAIImagesFn = generateOpenAIImages,
} = {}) {
  const root = safeRoot(artifactRoot);
  if (!manifest || typeof manifest !== "object") throw new Error("A planned image manifest is required for generation.");
  if (!config || typeof config !== "object" || typeof config.mode !== "string" || typeof config.model !== "string"
    || typeof config.quality !== "string" || typeof config.apiKeyPresent !== "boolean") {
    throw new Error("A validated internal image config is required.");
  }
  const { apiKey, ...publicConfig } = config;
  const jobs = selectGenerationJobs({ manifest, mode: publicConfig.mode, selectedAssetIds });
  const selection = selectionRecord(publicConfig.mode, selectedAssetIds, selectionSource);
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
      providerResult = validateHostResult(await hostGenerate({ jobs: clone(jobs) }), jobs);
    }
  } else if (jobs.length > 0 && decision.provider === "unavailable") {
    providerResult = { results: [], failures: jobs.map(({ asset_id }) => ({ asset_id, generation_state: "generation-unavailable", reason: "no-provider-available" })) };
  }
  const nextManifest = applyProviderResults(manifest, providerResult, decision.provider, publicConfig);
  const validation = validateImageAssetManifest(nextManifest, { artifactRoot: root });
  if (!validation.ok) throw new Error(`Workflow produced an invalid image manifest: ${validation.errors.map(({ code }) => code).join(", ")}`);

  await mkdir(path.join(root, "assets", "prompts"), { recursive: true });
  await writeFile(path.join(root, "assets", "image-assets.yml"), `${JSON.stringify(nextManifest, null, 2)}\n`);
  await writeFile(path.join(root, "assets", "prompts", "image-generation-selection.json"), `${JSON.stringify(selection, null, 2)}\n`);
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
  decisionReceiptPath,
} = {}) {
  const root = safeRoot(artifactRoot);
  const validation = validateImageAssetManifest(manifest, { artifactRoot: root });
  if (!validation.ok) throw new Error("A valid image manifest is required before review.");
  const asset = manifest.assets.find(({ asset_id }) => asset_id === assetId);
  if (!asset) throw new Error("Review requires a known stable asset ID.");
  await readUserDecisionReceipt(root, decisionReceiptPath, {
    assetId, fromState: asset.approval_state, targetState, reviewer, reviewedAt, rightsDecision, evidencePaths,
  });
  const reviewedAsset = applyImageReviewTransition(asset, {
    targetState, reviewer, reviewedAt, evidencePaths: [...evidencePaths, decisionReceiptPath], rightsDecision,
  }, { artifactRoot: root });
  const next = clone(manifest);
  next.assets[next.assets.findIndex(({ asset_id }) => assetId === asset_id)] = reviewedAsset;
  const nextValidation = validateImageAssetManifest(next, { artifactRoot: root });
  if (!nextValidation.ok) throw new Error("Reviewed image manifest is invalid.");
  await writeFile(path.join(root, "assets", "image-assets.yml"), `${JSON.stringify(next, null, 2)}\n`);
  return { manifest: next, reviewedAsset };
}
