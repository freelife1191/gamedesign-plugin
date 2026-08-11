import { createHash } from "node:crypto";

import { decodeOpenAIImage, prepareImageOutput, promoteValidatedPng } from "./lib/image-file-validation.mjs";
import { loadSecureReferenceInputs } from "./lib/image-reference-loader.mjs";

const generationEndpoint = "https://api.openai.com/v1/images/generations";
const editEndpoint = "https://api.openai.com/v1/images/edits";
const maximumAttempts = 3;
const maximumJobs = 64;
const retryDelayCeilingMs = 2_000;
const safeRequestId = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const safeModel = /^[A-Za-z0-9](?:[A-Za-z0-9._:-]{0,127})$/u;
const qualities = new Set(["low", "medium", "high", "auto"]);
const defaultRequestTimeoutMs = 30_000;
const minimumRequestTimeoutMs = 1;
const maximumRequestTimeoutMs = 120_000;

// A 20 MiB JSON response admits a 12 MiB PNG encoded as base64 plus normal
// Images API metadata, while bounding both declared and streamed responses.
export const maximumResponseBytes = 20 * 1024 * 1024;

function digest(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function failure(assetId, generationState, reason, attempts) {
  return { asset_id: assetId, generation_state: generationState, reason, attempts };
}

function requestError() {
  const error = new Error("Invalid bounded OpenAI image generation request.");
  error.code = "invalid_generation_request";
  return error;
}

function validJob(job) {
  return job && typeof job === "object" && typeof job.asset_id === "string" && /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u.test(job.asset_id)
    && typeof job.prompt === "string" && job.prompt.trim() !== "" && job.output && typeof job.output === "object";
}

function isReferenceJob(job) {
  return Array.isArray(job?.reference_images) && job.reference_images.length > 0;
}

async function readReferenceInputs(job, stagingRoot) {
  if (!isReferenceJob(job)) return { ok: true, inputs: [] };
  try {
    return { ok: true, inputs: await loadSecureReferenceInputs({ artifactRoot: stagingRoot, references: job.reference_images }) };
  } catch {
    return { ok: false };
  }
}

function gptImageSizeIsValid(output) {
  const { width, height } = output ?? {};
  if (!Number.isInteger(width) || !Number.isInteger(height) || width % 16 !== 0 || height % 16 !== 0
    || width > 3840 || height > 3840) return false;
  const pixels = width * height;
  const ratio = width / height;
  return pixels >= 655_360 && pixels <= 8_294_400 && ratio >= 1 / 3 && ratio <= 3;
}

function retryDelay(response, attempt, now) {
  const value = response?.headers?.get?.("retry-after");
  let milliseconds;
  if (typeof value === "string" && /^\d+(?:\.\d+)?$/u.test(value.trim())) milliseconds = Number(value) * 1_000;
  else if (typeof value === "string") {
    const until = Date.parse(value);
    const current = Date.parse(typeof now === "function" ? now() : new Date().toISOString());
    if (!Number.isNaN(until) && !Number.isNaN(current)) milliseconds = Math.max(0, until - current);
  }
  return Math.min(retryDelayCeilingMs, Number.isFinite(milliseconds) ? milliseconds : attempt * 250);
}

function headerValue(response, name) {
  const value = response?.headers?.get?.(name);
  return typeof value === "string" ? value : null;
}

function declaredLength(response) {
  const value = headerValue(response, "content-length");
  if (value === null) return undefined;
  if (!/^\d+$/u.test(value) || Number(value) > maximumResponseBytes) return null;
  return Number(value);
}

async function cancelQuietly(target) {
  try {
    await target?.cancel?.();
  } catch {
    // Stream cleanup must not alter the redacted provider result.
  }
}

async function releaseQuietly(reader) {
  try {
    await reader?.releaseLock?.();
  } catch {
    // A hostile lock implementation must not alter the redacted provider result.
  }
}

function parseBufferedJson(chunks, total) {
  try {
    const value = JSON.parse(Buffer.concat(chunks, total).toString("utf8"));
    return value && typeof value === "object" && !Array.isArray(value) ? { ok: true, value } : { ok: false };
  } catch {
    return { ok: false };
  }
}

async function readAsyncIterableJson(body) {
  const chunks = [];
  let total = 0;
  let normal = false;
  try {
    for await (const chunk of body) {
      if (!(chunk instanceof Uint8Array) || total + chunk.byteLength > maximumResponseBytes) return { ok: false };
      chunks.push(Buffer.from(chunk));
      total += chunk.byteLength;
    }
    const parsed = parseBufferedJson(chunks, total);
    normal = parsed.ok;
    return parsed;
  } catch {
    return { ok: false };
  } finally {
    if (!normal) await cancelQuietly(body);
  }
}

async function readReaderJson(body) {
  let reader;
  try {
    reader = body.getReader();
  } catch {
    return { ok: false };
  }
  const chunks = [];
  let total = 0;
  let normal = false;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!(value instanceof Uint8Array) || total + value.byteLength > maximumResponseBytes) return { ok: false };
      chunks.push(Buffer.from(value));
      total += value.byteLength;
    }
    const parsed = parseBufferedJson(chunks, total);
    normal = parsed.ok;
    return parsed;
  } catch {
    return { ok: false };
  } finally {
    if (!normal) await cancelQuietly(reader);
    await releaseQuietly(reader);
  }
}

async function readBoundedJson(response) {
  const body = response?.body;
  if (declaredLength(response) === null) {
    await cancelQuietly(body);
    return { ok: false };
  }
  if (body && typeof body.getReader === "function") return readReaderJson(body);
  if (body && typeof body[Symbol.asyncIterator] === "function") return readAsyncIterableJson(body);
  return { ok: false };
}

function providerErrorClass(body) {
  const code = typeof body?.error?.code === "string" ? body.error.code.toLowerCase() : "";
  const type = typeof body?.error?.type === "string" ? body.error.type.toLowerCase() : "";
  const policy = /(?:moderation|policy)[_-]?blocked/iu.test(code) || /(?:moderation|policy)[_-]?blocked/iu.test(type);
  const noRetry = type === "image_generation_user_error" || /(?:quota|billing|credit|spend|usage|invalid)/iu.test(code)
    || /(?:quota|billing|credit|spend|usage|invalid)/iu.test(type);
  return { policy, noRetry };
}

function requestBody(job, model, quality, referenceInputs) {
  if (referenceInputs.length === 0) {
    return {
      endpoint: generationEndpoint,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, quality, prompt: job.prompt, size: `${job.output.width}x${job.output.height}`, n: 1 }),
    };
  }
  const body = new FormData();
  body.set("model", model);
  body.set("quality", quality);
  body.set("prompt", job.prompt);
  body.set("size", `${job.output.width}x${job.output.height}`);
  body.set("n", "1");
  for (const reference of referenceInputs) body.append("image[]", new Blob([reference.bytes], { type: "image/png" }), reference.filename);
  return { endpoint: editEndpoint, headers: {}, body };
}

async function requestImage({ job, apiKey, model, quality, fetchFn, sleepFn, now, referenceInputs, requestTimeoutMs }) {
  let attempts = 0;
  while (attempts < maximumAttempts) {
    attempts += 1;
    let response;
    let timedOut = false;
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, requestTimeoutMs);
    try {
      const request = requestBody(job, model, quality, referenceInputs);
      response = await fetchFn(request.endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, ...request.headers },
        body: request.body,
        signal: controller.signal,
      });
    } catch {
      clearTimeout(timeout);
      if (timedOut) return { ok: false, attempts, generationState: "generation-failed", reason: "provider-timeout" };
      return { ok: false, attempts, generationState: "generation-failed", reason: "provider-request-failed" };
    }
    const parsed = await readBoundedJson(response);
    clearTimeout(timeout);
    if (timedOut) return { ok: false, attempts, generationState: "generation-failed", reason: "provider-timeout" };
    if (!parsed.ok) {
      if (response?.status >= 500 && attempts < maximumAttempts) {
        await sleepFn(retryDelay(response, attempts, now));
        continue;
      }
      return { ok: false, attempts, generationState: "qa-failed", reason: "invalid-provider-response" };
    }
    if (response?.status >= 200 && response.status < 300) {
      if (!Array.isArray(parsed.value.data) || parsed.value.data.length !== 1 || typeof parsed.value.data[0]?.b64_json !== "string") {
        return { ok: false, attempts, generationState: "qa-failed", reason: "invalid-provider-response" };
      }
      const requestId = headerValue(response, "x-request-id");
      return { ok: true, attempts, b64: parsed.value.data[0].b64_json, requestId: requestId && safeRequestId.test(requestId) ? requestId : undefined };
    }
    const classified = providerErrorClass(parsed.value);
    if (classified.policy) return { ok: false, attempts, generationState: "policy-blocked", reason: "policy-blocked" };
    if (classified.noRetry || ![429].includes(response?.status) && !(response?.status >= 500)) {
      return { ok: false, attempts, generationState: "generation-failed", reason: "provider-request-failed" };
    }
    if (attempts < maximumAttempts) {
      await sleepFn(retryDelay(response, attempts, now));
      continue;
    }
    return { ok: false, attempts, generationState: "generation-failed", reason: "provider-request-failed" };
  }
  return { ok: false, attempts: maximumAttempts, generationState: "generation-failed", reason: "provider-request-failed" };
}

function timestamp(now) {
  const value = typeof now === "function" ? now() : new Date().toISOString();
  return typeof value === "string" && !Number.isNaN(Date.parse(value)) ? new Date(value).toISOString() : new Date().toISOString();
}

export async function generateOpenAIImages({
  jobs,
  apiKey,
  model = "gpt-image-2",
  quality = "low",
  fetchFn = fetch,
  sleepFn = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  now = () => new Date().toISOString(),
  stagingRoot,
  requestTimeoutMs = defaultRequestTimeoutMs,
} = {}) {
  if (!Array.isArray(jobs) || jobs.length > maximumJobs || typeof apiKey !== "string" || apiKey.length === 0
    || !safeModel.test(model) || !qualities.has(quality) || typeof fetchFn !== "function" || typeof sleepFn !== "function"
    || !Number.isInteger(requestTimeoutMs) || requestTimeoutMs < minimumRequestTimeoutMs || requestTimeoutMs > maximumRequestTimeoutMs) throw requestError();
  const results = [];
  const failures = [];
  for (const job of jobs) {
    const assetId = typeof job?.asset_id === "string" ? job.asset_id : "invalid-asset";
    if (!validJob(job)) {
      failures.push(failure(assetId, "qa-failed", "invalid-generation-job", 0));
      continue;
    }
    if (model === "gpt-image-2" && !gptImageSizeIsValid(job.output)) {
      failures.push(failure(job.asset_id, "qa-failed", "invalid-generation-size", 0));
      continue;
    }
    let prepared;
    try {
      prepared = await prepareImageOutput({ stagingRoot, output: job.output });
    } catch {
      failures.push(failure(job.asset_id, "qa-failed", "unsafe-output-path", 0));
      continue;
    }
    const references = await readReferenceInputs(job, stagingRoot);
    if (!references.ok) {
      failures.push(failure(job.asset_id, "qa-failed", "invalid-generation-reference", 0));
      continue;
    }
    const requested = await requestImage({ job, apiKey, model, quality, fetchFn, sleepFn, now, referenceInputs: references.inputs, requestTimeoutMs });
    if (!requested.ok) {
      failures.push(failure(job.asset_id, requested.generationState, requested.reason, requested.attempts));
      continue;
    }
    try {
      const image = await promoteValidatedPng({ prepared, bytes: decodeOpenAIImage(requested.b64) });
      const output = { ...prepared.output, bytes: image.bytes, digest: image.digest };
      results.push({
        asset_id: job.asset_id,
        generation_state: "generated",
        output,
        provenance: {
          provider: "openai", model, quality, request_id: requested.requestId,
          generated_at: timestamp(now), prompt_digest: digest(job.prompt), output_digest: image.digest,
        },
      });
    } catch {
      failures.push(failure(job.asset_id, "qa-failed", "invalid-image-output", requested.attempts));
    }
  }
  return { provider: "openai", results, failures };
}
