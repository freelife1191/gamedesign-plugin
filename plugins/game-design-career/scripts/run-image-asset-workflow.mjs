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
const specialistReviewerKeys = new Set([...specialistReviewerIds].map((value) => canonicalReviewerKey(value)));
const hostFailureStates = new Set(["generation-unavailable", "generation-failed", "policy-blocked", "qa-failed"]);
const hostQualities = new Set(["low", "medium", "high", "auto"]);
const safeModelPattern = /^[A-Za-z0-9](?:[A-Za-z0-9._:-]{0,127})$/u;
const digestPattern = /^[a-f0-9]{64}$/u;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

async function defaultPatternCatalog() {
  const root = fileURLToPath(new URL("../references/shared/image-assets/prompt-patterns/", import.meta.url));
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

async function evidenceDigests(root, evidencePaths) {
  const digests = [];
  for (const evidencePath of evidencePaths) {
    const bytes = await readRegularArtifactBytes(root, evidencePath);
    digests.push({ path: evidencePath, sha256: sha256(bytes) });
  }
  return digests;
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

async function readUserDecisionReceipt(root, receipt, { assetId, fromState, targetState, reviewer, reviewedAt, rightsDecision, evidencePaths, evidenceDigests: requestedEvidenceDigests }) {
  const required = ["schema_version", "kind", "capture", "asset_id", "from_state", "target_state", "decision", "reviewer", "decided_at", "rights_decision", "evidence_paths", "evidence_digests"];
  const canonicalReviewer = canonicalHumanReviewer(reviewer);
  if (specialistReviewerKeys.has(canonicalReviewerKey(canonicalReviewer))) {
    throw new Error("Host user decision reviewer must be a named human, not a product specialist.");
  }
  if (!exactKeys(receipt, required) || receipt.schema_version !== 1 || receipt.kind !== "host-user-image-decision"
    || !exactKeys(receipt.capture, ["channel", "event_id"]) || receipt.capture.channel !== "host-user-input"
    || !hostEventId(receipt.capture.event_id)
    || receipt.asset_id !== assetId || receipt.from_state !== fromState || receipt.target_state !== targetState || receipt.decision !== "approved"
    || receipt.reviewer !== canonicalReviewer || receipt.decided_at !== reviewedAt || Number.isNaN(Date.parse(receipt.decided_at))
    || receipt.rights_decision !== rightsDecision || JSON.stringify(receipt.evidence_paths) !== JSON.stringify(evidencePaths)
    || !Array.isArray(receipt.evidence_digests) || receipt.evidence_digests.length !== evidencePaths.length
    || !receipt.evidence_digests.every((entry, index) => exactKeys(entry, ["path", "sha256"])
      && entry.path === evidencePaths[index] && typeof entry.sha256 === "string" && digestPattern.test(entry.sha256))) {
    throw new Error("Host user decision receipt does not match the requested image review transition.");
  }
  try {
    const currentEvidenceDigests = await evidenceDigests(root, evidencePaths);
    if (JSON.stringify(receipt.evidence_digests) !== JSON.stringify(currentEvidenceDigests)
      || (requestedEvidenceDigests !== undefined && JSON.stringify(requestedEvidenceDigests) !== JSON.stringify(currentEvidenceDigests))) {
      throw new Error("stale evidence");
    }
  } catch {
    throw new Error("Host user decision receipt must reference readable artifact-local evidence.");
  }
  return {
    schema_version: 1, kind: "host-user-image-decision", capture: { channel: "host-user-input", event_id: receipt.capture.event_id },
    asset_id: assetId, from_state: fromState, target_state: targetState, decision: "approved", reviewer: canonicalReviewer,
    decided_at: reviewedAt, rights_decision: rightsDecision, evidence_paths: [...evidencePaths], evidence_digests: clone(receipt.evidence_digests),
  };
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

function canonicalReviewerKey(value) {
  return value.normalize("NFKC").toLocaleLowerCase("und").replace(/[^\p{L}\p{N}]/gu, "");
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function generateViaOpenAI({ jobs, apiKey, model, quality, stagingRoot, fetchFn, sleepFn, now, generateOpenAIImagesFn }) {
  return generateOpenAIImagesFn({ jobs, apiKey, model, quality, stagingRoot, fetchFn, sleepFn, now });
}

function applyProviderResults(manifest, providerResult, provider, config, generationReceipts = new Map()) {
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
          path: outputPath ?? asset.output.path, width: width ?? asset.output.width, height: height ?? asset.output.height,
          aspect_ratio: aspectRatio ?? asset.output.aspect_ratio, format: format ?? asset.output.format, background: background ?? asset.output.background,
        };
      }
      if (generationReceipts.has(asset.asset_id)) asset.generation_receipt = generationReceipts.get(asset.asset_id);
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
      if (generationReceipts.has(asset.asset_id)) asset.generation_receipt = generationReceipts.get(asset.asset_id);
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

function receiptTimestamp(now) {
  const value = typeof now === "function" ? now() : new Date().toISOString();
  return typeof value === "string" && !Number.isNaN(Date.parse(value)) ? new Date(value).toISOString() : new Date().toISOString();
}

function receiptFailureReason(value) {
  return typeof value === "string" && /^[a-z][a-z0-9-]{0,127}$/u.test(value) ? value : "generation-failed";
}

function receiptProvenance(provider, config, result, failure) {
  const provenance = result?.provenance ?? failure?.provenance ?? {};
  const isOpenAI = provider === "openai";
  return {
    provider: typeof provenance.provider === "string" && safeModelPattern.test(provenance.provider)
      ? provenance.provider : isOpenAI ? "openai" : provider === "codex" ? "codex-host" : "unavailable",
    request_id: typeof provenance.request_id === "string" && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u.test(provenance.request_id) ? provenance.request_id : null,
    applied_model: isOpenAI ? config.model : provenance.applied_model ?? null,
    applied_quality: isOpenAI ? config.quality : provenance.applied_quality ?? null,
  };
}

async function writeGenerationReceipts(root, jobs, providerResult, provider, config, now) {
  await ensureArtifactDirectories({ artifactRoot: root, directories: ["assets", "assets/receipts"] });
  const results = new Map((providerResult?.results ?? []).map((value) => [value.asset_id, value]));
  const failures = new Map((providerResult?.failures ?? []).map((value) => [value.asset_id, value]));
  const receipts = new Map();
  for (const job of jobs) {
    const result = results.get(job.asset_id);
    const failure = failures.get(job.asset_id);
    const provenance = receiptProvenance(provider, config, result, failure);
    const receipt = {
      schema_version: 1,
      kind: "image-generation-receipt",
      asset_id: job.asset_id,
      provider: provenance.provider,
      request_id: provenance.request_id,
      generated_at: receiptTimestamp(now),
      prompt_digest: digestPattern.test(result?.provenance?.prompt_digest ?? "") ? result.provenance.prompt_digest : sha256(job.prompt),
      output_digest: digestPattern.test(result?.provenance?.output_digest ?? "") ? result.provenance.output_digest
        : digestPattern.test(result?.output?.digest ?? "") ? result.output.digest : null,
      requested_model: config.model,
      requested_quality: config.quality,
      applied_model: provenance.applied_model,
      applied_quality: provenance.applied_quality,
      failure_reason: result ? null : receiptFailureReason(failure?.reason),
    };
    const relativePath = `assets/receipts/image-generation-${job.asset_id}.json`;
    const bytes = Buffer.from(`${JSON.stringify(receipt, null, 2)}\n`, "utf8");
    await safeWriteArtifactFile({ artifactRoot: root, relativePath, data: bytes, policy: "create-once" });
    receipts.set(job.asset_id, { path: relativePath, sha256: sha256(bytes) });
  }
  return receipts;
}

function normalizeHostProvenance(value, { success }) {
  const allowed = success ? ["provider", "prompt_digest", "output_digest", "applied_model", "applied_quality"] : ["provider", "applied_model", "applied_quality"];
  if (!value || typeof value !== "object" || Array.isArray(value) || !Object.keys(value).every((key) => allowed.includes(key))
    || value.provider !== "codex-host" || (success && (!digestPattern.test(value.prompt_digest ?? "") || !digestPattern.test(value.output_digest ?? "")))
    || (value.applied_model !== undefined && (typeof value.applied_model !== "string" || !safeModelPattern.test(value.applied_model)))
    || (value.applied_quality !== undefined && !hostQualities.has(value.applied_quality))) {
    throw new Error("Host generation returned invalid provenance.");
  }
  const normalized = { provider: "codex-host" };
  if (success) Object.assign(normalized, { prompt_digest: value.prompt_digest, output_digest: value.output_digest });
  if (value.applied_model !== undefined) normalized.applied_model = value.applied_model;
  if (value.applied_quality !== undefined) normalized.applied_quality = value.applied_quality;
  return normalized;
}

function normalizeHostFailure(value, selected) {
  if (!exactKeys(value, ["asset_id", "generation_state", "reason", "provenance"])
    || typeof value.asset_id !== "string" || !selected.has(value.asset_id) || !hostFailureStates.has(value.generation_state)
    || typeof value.reason !== "string" || value.reason.length > 128 || !/^[a-z][a-z0-9-]*$/u.test(value.reason)) {
    throw new Error("Host generation returned an invalid failure record.");
  }
  return { asset_id: value.asset_id, generation_state: value.generation_state, reason: "host-reported-failure", provenance: normalizeHostProvenance(value.provenance, { success: false }) };
}

function normalizeHostSuccess(value, selected) {
  if (!exactKeys(value, ["asset_id", "generation_state", "output", "provenance"])
    || typeof value.asset_id !== "string" || !selected.has(value.asset_id) || value.generation_state !== "generated"
    || !exactKeys(value.output, ["path", "width", "height", "aspect_ratio", "format", "background", "digest"])
    || typeof value.output.path !== "string" || !Number.isInteger(value.output.width) || !Number.isInteger(value.output.height)
    || typeof value.output.aspect_ratio !== "string" || typeof value.output.format !== "string" || typeof value.output.background !== "string" || !digestPattern.test(value.output.digest ?? "")) {
    throw new Error("Host generation returned an invalid success record.");
  }
  return { asset_id: value.asset_id, generation_state: "generated", output: {
    path: value.output.path, width: value.output.width, height: value.output.height, aspect_ratio: value.output.aspect_ratio,
    format: value.output.format, background: value.output.background, digest: value.output.digest,
  }, provenance: normalizeHostProvenance(value.provenance, { success: true }) };
}

function validateHostResult(value, jobs) {
  if (!exactKeys(value, ["results", "failures"]) || !Array.isArray(value.results) || !Array.isArray(value.failures)) {
    throw new Error("Host generation must return results and failures arrays.");
  }
  const selected = new Set(jobs.map(({ asset_id }) => asset_id));
  const seen = new Set();
  const results = value.results.map((item) => normalizeHostSuccess(item, selected));
  const failures = value.failures.map((item) => normalizeHostFailure(item, selected));
  for (const item of [...results, ...failures]) {
    if (seen.has(item.asset_id)) {
      throw new Error("Host generation result must contain each selected stable asset ID at most once.");
    }
    seen.add(item.asset_id);
  }
  return { results, failures };
}

async function validateHostOutputs(value, jobs, root) {
  const byAssetId = new Map(jobs.map((job) => [job.asset_id, job]));
  const failures = value.failures.map((failure) => ({ asset_id: failure.asset_id, generation_state: failure.generation_state, reason: failure.reason, provenance: failure.provenance }));
  const results = [];
  for (const result of value.results) {
    const job = byAssetId.get(result.asset_id);
    try {
      const output = result.output;
      if (!exactKeys(output, ["path", "width", "height", "aspect_ratio", "format", "background", "digest"])
        || !Object.keys(result.provenance).every((key) => ["provider", "prompt_digest", "output_digest", "applied_model", "applied_quality"].includes(key))
        || JSON.stringify({ path: output.path, width: output.width, height: output.height, aspect_ratio: output.aspect_ratio, format: output.format, background: output.background })
          !== JSON.stringify(job.output)) throw new Error("Host output does not match its selected job.");
      const inspected = validatePngBuffer(await readRegularArtifactBytes(root, output.path), job.output);
      if (output.digest !== inspected.digest || result.provenance.prompt_digest !== sha256(job.prompt) || result.provenance.output_digest !== inspected.digest) {
        throw new Error("Host output digest evidence does not match the generated file.");
      }
      results.push({ asset_id: result.asset_id, generation_state: "generated", output: result.output, provenance: result.provenance });
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
      try {
        providerResult = await validateHostOutputs(validateHostResult(await hostGenerate({ jobs: clone(jobs) }), jobs), jobs, root);
      } catch (error) {
        if (error?.message?.startsWith("Host generation")) throw error;
        providerResult = { results: [], failures: jobs.map(({ asset_id }) => ({ asset_id, generation_state: "generation-failed", reason: "host-callback-failed", provenance: { provider: "codex-host" } })) };
      }
    }
  } else if (jobs.length > 0 && decision.provider === "unavailable") {
    providerResult = { results: [], failures: jobs.map(({ asset_id }) => ({ asset_id, generation_state: "generation-unavailable", reason: "no-provider-available" })) };
  }
  const generationReceipts = jobs.length > 0
    ? await writeGenerationReceipts(root, jobs, providerResult, decision.provider, publicConfig, now)
    : new Map();
  const nextManifest = applyProviderResults(manifest, providerResult, decision.provider, publicConfig, generationReceipts);
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
  evidenceDigests,
  decisionReceipt,
} = {}) {
  const root = (await canonicalArtifactRoot(artifactRoot)).path;
  const validation = validateImageAssetManifest(manifest, { artifactRoot: root });
  if (!validation.ok) throw new Error("A valid image manifest is required before review.");
  const asset = manifest.assets.find(({ asset_id }) => asset_id === assetId);
  if (!asset) throw new Error("Review requires a known stable asset ID.");
  const requiredEvidencePaths = [...new Set([
    ...(Array.isArray(evidencePaths) ? evidencePaths : []),
    ...(asset.generation_receipt ? [asset.output.path, asset.generation_receipt.path] : []),
  ])];
  const receipt = await readUserDecisionReceipt(root, decisionReceipt, {
    assetId, fromState: asset.approval_state, targetState, reviewer, reviewedAt, rightsDecision, evidencePaths: requiredEvidencePaths, evidenceDigests,
  });
  const decisionReceiptPath = `decisions/image-review-${receipt.capture.event_id}.json`;
  await safeWriteArtifactFile({ artifactRoot: root, relativePath: decisionReceiptPath, data: `${JSON.stringify(receipt, null, 2)}\n`, policy: "create-once" });
  const reviewedAsset = applyImageReviewTransition(asset, {
    targetState, reviewer, reviewedAt, evidencePaths: [...requiredEvidencePaths, decisionReceiptPath], rightsDecision,
  }, { artifactRoot: root });
  const next = clone(manifest);
  next.assets[next.assets.findIndex(({ asset_id }) => assetId === asset_id)] = reviewedAsset;
  const nextValidation = validateImageAssetManifest(next, { artifactRoot: root });
  if (!nextValidation.ok) throw new Error("Reviewed image manifest is invalid.");
  await safeWriteArtifactFile({ artifactRoot: root, relativePath: "assets/image-assets.yml", data: `${JSON.stringify(next, null, 2)}\n` });
  return { manifest: next, reviewedAsset, decisionReceiptPath };
}
