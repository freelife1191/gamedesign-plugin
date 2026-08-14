import { createHash, randomUUID } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildImageAssetPlan, selectGenerationJobs } from "./build-image-asset-plan.mjs";
import { compileImagePrompts } from "./compile-image-prompts.mjs";
import { generateOpenAIImages } from "./generate-openai-images.mjs";
import { prepareImageOutput, promoteValidatedPng } from "./lib/image-file-validation.mjs";
import { loadSecureReferenceInputs, readSecureReferenceFile } from "./lib/image-reference-loader.mjs";
import { resolveImageProvider } from "./lib/image-provider.mjs";
import { canonicalArtifactRoot, ensureArtifactDirectories, safeWriteArtifactFile } from "./lib/safe-artifact-write.mjs";
import { applyImageReviewTransition, validateImageAssetManifest } from "./validate-image-assets.mjs";
import { loadImageConfig, toPublicImageConfig } from "./validate-image-config.mjs";
import { validateCutsceneManifestHandoff } from "./plan-cutscene-visual-preproduction.mjs";

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

function bindCompiledPrompts(manifest, prompts) {
  if (!Array.isArray(prompts) || !Array.isArray(manifest?.assets) || new Set(manifest.assets.map(({ asset_id }) => asset_id)).size !== manifest.assets.length) {
    throw new Error("Compiled prompt bindings must match unique planned asset IDs.");
  }
  const bindings = new Map();
  for (const entry of prompts) {
    if (!entry || typeof entry.asset_id !== "string" || typeof entry.prompt !== "string" || entry.prompt.trim() === ""
      || !digestPattern.test(entry.prompt_digest ?? "") || entry.prompt_digest !== sha256(entry.prompt) || bindings.has(entry.asset_id)) {
      throw new Error("Compiled prompt bindings are invalid.");
    }
    bindings.set(entry.asset_id, entry);
  }
  if (bindings.size !== manifest.assets.length || manifest.assets.some(({ asset_id }) => !bindings.has(asset_id))) {
    throw new Error("Compiled prompt bindings must cover exactly the planned asset IDs.");
  }
  const next = clone(manifest);
  for (const asset of next.assets) {
    const entry = bindings.get(asset.asset_id);
    asset.prompt = entry.prompt;
    asset.prompt_digest = entry.prompt_digest;
  }
  const validation = validateImageAssetManifest(next);
  if (!validation.ok) throw new Error(`Compiled prompt bindings produced an invalid manifest: ${validation.errors.map(({ code }) => code).join(", ")}`);
  return next;
}

function manifestForPromptCompilation(manifest) {
  const next = clone(manifest);
  for (const asset of next.assets) {
    asset.prompt = `Prompt package required for ${asset.asset_id}.`;
    delete asset.prompt_digest;
  }
  return next;
}

function assertCompiledPromptBindings(manifest) {
  if (!Array.isArray(manifest?.assets) || manifest.assets.some((asset) => !digestPattern.test(asset.prompt_digest ?? "") || asset.prompt_digest !== sha256(asset.prompt))) {
    throw new Error("Generation requires manifest prompts bound to the compiled prompt package.");
  }
}

function applyCompiledPromptDisposition(manifest, existingManifest) {
  if (existingManifest === null) return manifest;
  const existingById = new Map(existingManifest.assets.map((asset) => [asset.asset_id, asset]));
  const next = clone(manifest);
  for (const asset of next.assets) {
    const existing = existingById.get(asset.asset_id);
    if (existing && (existing.prompt !== asset.prompt || existing.prompt_digest !== asset.prompt_digest)) {
      asset.planning.disposition = "replan-review-required";
    }
  }
  const validation = validateImageAssetManifest(next);
  if (!validation.ok) throw new Error(`Compiled prompt comparison produced an invalid manifest: ${validation.errors.map(({ code }) => code).join(", ")}`);
  return next;
}

async function generateViaOpenAI({ jobs, apiKey, model, quality, stagingRoot, fetchFn, sleepFn, now, requestTimeoutMs, beforeProvider, afterProvider, generateOpenAIImagesFn }) {
  return generateOpenAIImagesFn({ jobs, apiKey, model, quality, stagingRoot, fetchFn, sleepFn, now, requestTimeoutMs, beforeProvider, afterProvider });
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
      if (generationReceipts.has(asset.asset_id)) asset.generation_receipts = [...(asset.generation_receipts ?? []), generationReceipts.get(asset.asset_id)];
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
      if (generationReceipts.has(asset.asset_id)) asset.generation_receipts = [...(asset.generation_receipts ?? []), generationReceipts.get(asset.asset_id)];
      if (provider === "openai") {
        asset.provider = { name: "openai", requested_model: config.model, requested_quality: config.quality, applied_model: null, applied_quality: null };
      }
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
    applied_model: isOpenAI && result ? config.model : provenance.applied_model ?? null,
    applied_quality: isOpenAI && result ? config.quality : provenance.applied_quality ?? null,
  };
}

function validateAttemptId(attemptId) {
  if (typeof attemptId !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(attemptId)) throw new Error("Generation attempt ID is invalid.");
  return attemptId;
}

async function reserveGenerationAttempt(root, jobs, provider, config, now, attemptId) {
  await ensureArtifactDirectories({ artifactRoot: root, directories: ["assets", "assets/receipts"] });
  const receipt = {
    schema_version: 1,
    kind: "image-generation-attempt",
    attempt_id: attemptId,
    asset_ids: jobs.map(({ asset_id }) => asset_id),
    prompt_digests: jobs.map(({ prompt }) => sha256(prompt)),
    provider,
    requested_model: config.model,
    requested_quality: config.quality,
    generated_at: receiptTimestamp(now),
    lineage: jobs.map(({ asset_id, asset_set_id, derivative_of, reference_images, prompt_lineage }) => ({
      asset_id, asset_set_id, derivative_of,
      reference_images: (reference_images ?? []).map(({ asset_id: reference_asset_id, path, sha256 }) => ({ asset_id: reference_asset_id, path, sha256 })),
      parent_prompt_digests: prompt_lineage?.parent_prompt_digests ?? [],
    })),
  };
  const path = `assets/receipts/image-generation-attempt-${attemptId}.json`;
  const bytes = Buffer.from(`${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  await safeWriteArtifactFile({ artifactRoot: root, relativePath: path, data: bytes, policy: "create-once" });
  return { path, sha256: sha256(bytes) };
}

async function writeGenerationReceipts(root, jobs, providerResult, provider, config, now, attemptId, reservation) {
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
      attempt_id: attemptId,
      reservation_path: reservation.path,
      reservation_sha256: reservation.sha256,
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
    if (job.derivative_of !== null && job.derivative_of !== undefined) Object.assign(receipt, {
      asset_set_id: job.asset_set_id,
      derivative_of: job.derivative_of,
      reference_images: (job.reference_images ?? []).map(({ asset_id, path, sha256 }) => ({ asset_id, path, sha256 })),
      parent_prompt_digests: job.prompt_lineage?.parent_prompt_digests ?? [],
    });
    const relativePath = `assets/receipts/image-generation-${job.asset_id}-${attemptId}.json`;
    const bytes = Buffer.from(`${JSON.stringify(receipt, null, 2)}\n`, "utf8");
    await safeWriteArtifactFile({ artifactRoot: root, relativePath, data: bytes, policy: "create-once" });
    receipts.set(job.asset_id, { attempt_id: attemptId, path: relativePath, sha256: sha256(bytes) });
  }
  return receipts;
}

function normalizeHostProvenance(value, { success }) {
  const allowed = success ? ["provider", "prompt_digest", "applied_model", "applied_quality"] : ["provider", "applied_model", "applied_quality"];
  if (!value || typeof value !== "object" || Array.isArray(value) || !Object.keys(value).every((key) => allowed.includes(key))
    || value.provider !== "codex-host" || (success && !digestPattern.test(value.prompt_digest ?? ""))
    || (value.applied_model !== undefined && (typeof value.applied_model !== "string" || !safeModelPattern.test(value.applied_model)))
    || (value.applied_quality !== undefined && !hostQualities.has(value.applied_quality))) {
    throw new Error("Host generation returned invalid provenance.");
  }
  const normalized = { provider: "codex-host" };
  if (success) Object.assign(normalized, { prompt_digest: value.prompt_digest });
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
  if (!exactKeys(value, ["asset_id", "generation_state", "bytes", "provenance"])
    || typeof value.asset_id !== "string" || !selected.has(value.asset_id) || value.generation_state !== "generated"
    || !Buffer.isBuffer(value.bytes)) {
    throw new Error("Host generation returned an invalid success record.");
  }
  return { asset_id: value.asset_id, generation_state: "generated", bytes: value.bytes, provenance: normalizeHostProvenance(value.provenance, { success: true }) };
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

async function hostJobsForCallback(root, jobs) {
  const loaded = await Promise.all(jobs.map(async ({ asset_id, prompt, output, asset_set_id, derivative_of, reference_images, consistency_profile, prompt_lineage }) => {
    const references = await loadSecureReferenceInputs({ artifactRoot: root, references: reference_images ?? [] });
    return {
      asset_id,
      prompt,
      output: {
        width: output.width, height: output.height, aspect_ratio: output.aspect_ratio, format: output.format, background: output.background,
      },
      asset_set_id,
      derivative_of,
      reference_images: clone(reference_images ?? []),
      consistency_profile: clone(consistency_profile ?? { style_anchor_asset_ids: [], character_anchor_asset_ids: [] }),
      prompt_lineage: clone(prompt_lineage ?? { parent_prompt_digests: [] }),
      reference_inputs: references.inputs
        .map(({ asset_id: referenceAssetId, path: referencePath, sha256: referenceDigest, bytes }) => ({
          asset_id: referenceAssetId, path: referencePath, sha256: referenceDigest, bytes,
        })),
      verifyReferences: references.verify,
    };
  }));
  return {
    jobs: loaded.map(({ verifyReferences, ...job }) => job),
    verify: async () => { for (const { verifyReferences } of loaded) await verifyReferences(); },
  };
}

async function bindDeclaredReferenceInputs(root, manifest, job) {
  if (!Array.isArray(job.reference_asset_ids)) return job;
  if (job.reference_asset_ids.length === 0) return job;
  const byId = new Map(manifest.assets.map((asset) => [asset.asset_id, asset]));
  const referenceImages = [];
  const parentPromptDigests = [];
  for (const assetId of job.reference_asset_ids) {
    const source = byId.get(assetId);
    if (!source || source.generation_state !== "generated" || !digestPattern.test(source.prompt_digest ?? "")) {
      throw new Error("Declared reference asset is not generated with a bound prompt.");
    }
    const file = await readSecureReferenceFile({ artifactRoot: root, path: source.output?.path });
    referenceImages.push({ asset_id: source.asset_id, path: source.output.path, sha256: file.digest });
    parentPromptDigests.push(source.prompt_digest);
  }
  return {
    ...clone(job),
    reference_images: referenceImages,
    prompt_lineage: { parent_prompt_digests: parentPromptDigests },
  };
}

async function prepareHostOutputs(root, jobs) {
  const prepared = new Map();
  for (const job of jobs) prepared.set(job.asset_id, await prepareImageOutput({ stagingRoot: root, output: job.output }));
  return prepared;
}

async function publishHostOutputs(value, jobs, prepared) {
  const byAssetId = new Map(jobs.map((job) => [job.asset_id, job]));
  const failures = value.failures.map((failure) => ({ asset_id: failure.asset_id, generation_state: failure.generation_state, reason: failure.reason, provenance: failure.provenance }));
  const results = [];
  for (const result of value.results) {
    const job = byAssetId.get(result.asset_id);
    try {
      if (result.provenance.prompt_digest !== sha256(job.prompt)) throw new Error("Host output prompt evidence does not match the selected job.");
      const image = await promoteValidatedPng({ prepared: prepared.get(result.asset_id), bytes: result.bytes });
      results.push({ asset_id: result.asset_id, generation_state: "generated", output: { ...job.output, digest: image.digest }, provenance: { ...result.provenance, output_digest: image.digest } });
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

async function generateHostWithRetries({ root, jobs, prepared, hostGenerate, beforeProvider, afterProvider }) {
  let outcome;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    let dispatches = [];
    let physicalDispatch = false;
    try {
      const callback = await hostJobsForCallback(root, jobs);
      dispatches = await Promise.all(jobs.map((job) => beforeProvider?.({ asset_id: job.asset_id, attempt_ordinal: attempt })));
      await callback.verify();
      physicalDispatch = true;
      const hostResult = await hostGenerate({ jobs: callback.jobs });
      outcome = await publishHostOutputs(validateHostResult(hostResult, jobs), jobs, prepared);
      await Promise.all(jobs.map((job, index) => afterProvider?.({ ...dispatches[index], asset_id: job.asset_id, attempt_ordinal: attempt, providerRequestId: "no-request-id", outcome: outcome.results.some(({ asset_id }) => asset_id === job.asset_id) ? "success" : "provider-failure", usage: undefined })));
    } catch (error) {
      if (physicalDispatch) await Promise.all(jobs.map((job, index) => afterProvider?.({ ...dispatches[index], asset_id: job.asset_id, attempt_ordinal: attempt, providerRequestId: "no-request-id", outcome: "provider-failure", usage: undefined })));
      if (error?.code) throw error;
      if (physicalDispatch) throw error;
      outcome = { results: [], failures: jobs.map(({ asset_id }) => ({ asset_id, generation_state: "generation-failed", reason: "host-callback-failed", provenance: { provider: "codex-host" } })) };
    }
    if (outcome.results.length > 0 || outcome.failures.some(({ generation_state }) => generation_state !== "generation-failed") || attempt === 3) return outcome;
  }
  return outcome;
}

export async function runImageAssetWorkflow(options = {}) {
  const planned = await planImageAssetWorkflow(options);
  const generated = await generateImageAssetWorkflow({ ...options, manifest: planned.manifest });
  return { ...generated, prompts: { promptDigests: planned.promptDigests } };
}

export async function runConfiguredImageAssetWorkflow({ workspaceRoot, env, ...options } = {}) {
  const config = await loadImageConfig({ workspaceRoot, env });
  const result = await runImageAssetWorkflow({ ...options, config });
  return { ...result, config: toPublicImageConfig(config) };
}

// Cutscene dispatch has already established its own closed human approval.
// It must not manufacture a second host-user selection receipt merely to use
// the shared provider adapter.
export async function runConfiguredSelectedImageAssetWorkflow({ workspaceRoot, env, manifest, selectedAssetIds, provider, apiKey, fetchFn, hostGenerate, beforeProvider, afterProvider, artifactRoot, now, sleepFn } = {}) {
  const loaded = await loadImageConfig({ workspaceRoot, env });
  if (!['openai', 'codex-host'].includes(provider)) throw new Error("Cutscene provider is not allowed.");
  const config = {
    ...loaded,
    mode: "select",
    apiKey: provider === "openai" ? apiKey : undefined,
    apiKeyPresent: provider === "openai",
  };
  return generateImageAssetWorkflow({ artifactRoot, manifest, config, selectedAssetIds, fetchFn, hostGenerate, beforeProvider, afterProvider, now, sleepFn, codexCapability: provider === "codex-host" ? true : undefined, internalSelection: true });
}

export async function planImageAssetWorkflow({ artifactRoot, artifact, qualityProfile, existingManifest = null, patternCatalog, cutsceneManifest } = {}) {
  const root = await ensureArtifactDirectories({ artifactRoot, directories: ["assets", "assets/prompts", "decisions"] });
  if (cutsceneManifest !== undefined) {
    const manifest = validateCutsceneManifestHandoff({ manifest: cutsceneManifest });
    await safeWriteArtifactFile({ artifactRoot: root, relativePath: "assets/image-assets.yml", data: `${JSON.stringify(manifest, null, 2)}\n` });
    return { manifest, summary: { required: 0, recommended: 0, variants: 0, total: manifest.assets.length }, promptDigests: [] };
  }
  const plan = buildImageAssetPlan({ artifact, qualityProfile, existingManifest });
  const catalog = patternCatalog ?? await defaultPatternCatalog();
  const initialPrompts = compileImagePrompts({ manifest: plan.manifest, patternCatalog: catalog });
  const withBindings = bindCompiledPrompts(plan.manifest, initialPrompts.prompts);
  const withDisposition = applyCompiledPromptDisposition(withBindings, existingManifest);
  const prompts = compileImagePrompts({ manifest: manifestForPromptCompilation(withDisposition), patternCatalog: catalog });
  const manifest = bindCompiledPrompts(withDisposition, prompts.prompts);
  await safeWriteArtifactFile({ artifactRoot: root, relativePath: "assets/prompts/image-prompts.md", data: prompts.markdown });
  await safeWriteArtifactFile({ artifactRoot: root, relativePath: "assets/prompts/image-prompts.json", data: prompts.json });
  await safeWriteArtifactFile({ artifactRoot: root, relativePath: "assets/image-assets.yml", data: `${JSON.stringify(manifest, null, 2)}\n` });
  return { manifest, summary: plan.summary, promptDigests: prompts.promptDigests };
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
  beforeProvider,
  afterProvider,
  generateOpenAIImagesFn = generateOpenAIImages,
  attemptIdFactory = randomUUID,
  internalSelection = false,
} = {}) {
  const root = (await canonicalArtifactRoot(artifactRoot)).path;
  if (!manifest || typeof manifest !== "object") throw new Error("A planned image manifest is required for generation.");
  if (!config || typeof config !== "object" || typeof config.mode !== "string" || typeof config.model !== "string"
    || typeof config.quality !== "string" || typeof config.apiKeyPresent !== "boolean") {
    throw new Error("A validated internal image config is required.");
  }
  const { apiKey, ...publicConfig } = config;
  assertCompiledPromptBindings(manifest);
  const sourceValidation = validateImageAssetManifest(manifest, { artifactRoot: root });
  if (!sourceValidation.ok) throw new Error(`Generation requires a current image manifest: ${sourceValidation.errors.map(({ code }) => code).join(", ")}`);
  const receipt = publicConfig.mode === "select" && !internalSelection ? validateSelectionReceipt(selectionReceipt, selectedAssetIds) : undefined;
  const jobs = selectGenerationJobs({ manifest, mode: publicConfig.mode, selectedAssetIds });
  const selection = internalSelection ? { mode: "select", asset_ids: [...selectedAssetIds], source: "cutscene-approved" } : selectionRecord(publicConfig.mode, selectedAssetIds, receipt);
  if (receipt) await safeWriteArtifactFile({
    artifactRoot: root, relativePath: `assets/prompts/image-generation-selection-${receipt.event_id}.json`, data: `${JSON.stringify(selection, null, 2)}\n`, policy: "create-once",
  });
  const decision = resolveImageProvider({ mode: publicConfig.mode, apiKeyPresent: publicConfig.apiKeyPresent, codexCapability });
  const preparedHostOutputs = jobs.length > 0 && decision.provider === "codex" ? await prepareHostOutputs(root, jobs) : undefined;
  let attemptId;
  let reservation;
  if (jobs.length > 0) {
    if (decision.provider === "openai" && (typeof apiKey !== "string" || apiKey.length === 0)) throw new Error("Internal API key is required for the OpenAI route.");
    attemptId = validateAttemptId(attemptIdFactory());
    reservation = await reserveGenerationAttempt(root, jobs, decision.provider, publicConfig, now, attemptId);
  }
  let providerResult = { results: [], failures: [] };
  let executionManifest = clone(manifest);
  const executedJobs = [];
  const hasDeclaredReferences = jobs.some((job) => Array.isArray(job.reference_asset_ids) && job.reference_asset_ids.length > 0);
  if (jobs.length > 0 && hasDeclaredReferences && ["openai", "codex"].includes(decision.provider)) {
    for (const job of jobs) {
      let boundJob;
      try {
        boundJob = await bindDeclaredReferenceInputs(root, executionManifest, job);
      } catch {
        providerResult.failures.push({ asset_id: job.asset_id, generation_state: "qa-failed", reason: "invalid-generation-reference", provenance: { provider: "codex-host" } });
        executedJobs.push(job);
        continue;
      }
      executedJobs.push(boundJob);
      let one;
      if (decision.provider === "openai") {
        one = await generateViaOpenAI({
          jobs: [boundJob], apiKey, model: publicConfig.model, quality: publicConfig.quality, stagingRoot: root, fetchFn, sleepFn, now,
          requestTimeoutMs: config.requestTimeoutMs ?? 30_000, beforeProvider, afterProvider, generateOpenAIImagesFn,
        });
      } else if (typeof hostGenerate !== "function") {
        one = { results: [], failures: [{ asset_id: boundJob.asset_id, generation_state: "generation-unavailable", reason: "host-generator-unavailable" }] };
      } else {
        one = await generateHostWithRetries({ root, jobs: [boundJob], prepared: preparedHostOutputs, hostGenerate, beforeProvider, afterProvider });
      }
      providerResult.results.push(...one.results);
      providerResult.failures.push(...one.failures);
      executionManifest = applyProviderResults(executionManifest, one, decision.provider, publicConfig);
      const sourceIndex = executionManifest.assets.findIndex(({ asset_id }) => asset_id === boundJob.asset_id);
      if (sourceIndex !== -1) {
        executionManifest.assets[sourceIndex].reference_images = clone(boundJob.reference_images ?? []);
        executionManifest.assets[sourceIndex].prompt_lineage = clone(boundJob.prompt_lineage ?? { parent_prompt_digests: [] });
      }
    }
  } else if (jobs.length > 0 && decision.provider === "openai") {
    providerResult = await generateViaOpenAI({
      jobs, apiKey, model: publicConfig.model, quality: publicConfig.quality, stagingRoot: root, fetchFn, sleepFn, now,
      requestTimeoutMs: config.requestTimeoutMs ?? 30_000, beforeProvider, afterProvider, generateOpenAIImagesFn,
    });
    executedJobs.push(...jobs);
  } else if (jobs.length > 0 && decision.provider === "codex") {
    if (typeof hostGenerate !== "function") {
      providerResult = { results: [], failures: jobs.map(({ asset_id }) => ({ asset_id, generation_state: "generation-unavailable", reason: "host-generator-unavailable" })) };
    } else {
      providerResult = await generateHostWithRetries({ root, jobs, prepared: preparedHostOutputs, hostGenerate, beforeProvider, afterProvider });
    }
    executedJobs.push(...jobs);
  } else if (jobs.length > 0 && decision.provider === "unavailable") {
    providerResult = { results: [], failures: jobs.map(({ asset_id }) => ({ asset_id, generation_state: "generation-unavailable", reason: "no-provider-available" })) };
    executedJobs.push(...jobs);
  }
  const generationReceipts = jobs.length > 0
    ? await writeGenerationReceipts(root, executedJobs, providerResult, decision.provider, publicConfig, now, attemptId, reservation)
    : new Map();
  const nextManifest = applyProviderResults(executionManifest, providerResult, decision.provider, publicConfig, generationReceipts);
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
    ...(asset.generation_receipts?.length ? [asset.output.path, asset.generation_receipts.at(-1).path] : []),
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
