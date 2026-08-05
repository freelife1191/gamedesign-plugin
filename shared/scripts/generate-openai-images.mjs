import { createHash } from "node:crypto";

import { decodeOpenAIImage, prepareImageOutput, promoteValidatedPng } from "./lib/image-file-validation.mjs";

const endpoint = "https://api.openai.com/v1/images/generations";
const maximumAttempts = 3;
const maximumJobs = 64;
const retryDelayCeilingMs = 2_000;
const safeRequestId = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;

function digest(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function failure(assetId, generationState, reason, attempts) {
  return { asset_id: assetId, generation_state: generationState, reason, attempts };
}

function validJob(job) {
  return job && typeof job === "object" && typeof job.asset_id === "string" && /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u.test(job.asset_id)
    && typeof job.prompt === "string" && job.prompt.trim() !== "" && job.output && typeof job.output === "object";
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

function policyBlocked(responseBody) {
  const code = responseBody?.error?.code;
  return typeof code === "string" && /(?:moderation|policy)[_-]?blocked/iu.test(code);
}

async function requestImage({ job, apiKey, model, quality, fetchFn, sleepFn, now }) {
  let attempts = 0;
  while (attempts < maximumAttempts) {
    attempts += 1;
    let response;
    try {
      response = await fetchFn(endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, quality, prompt: job.prompt, size: `${job.output.width}x${job.output.height}` }),
      });
    } catch {
      return { ok: false, attempts, generationState: "generation-failed", reason: "provider-request-failed" };
    }
    let body;
    try {
      body = await response.json();
    } catch {
      body = undefined;
    }
    if (response?.status >= 200 && response.status < 300) {
      const image = body?.data?.[0]?.b64_json;
      if (typeof image !== "string") return { ok: false, attempts, generationState: "qa-failed", reason: "invalid-image-output" };
      const requestId = response.headers?.get?.("x-request-id");
      return { ok: true, attempts, b64: image, requestId: typeof requestId === "string" && safeRequestId.test(requestId) ? requestId : undefined };
    }
    if (policyBlocked(body)) return { ok: false, attempts, generationState: "policy-blocked", reason: "policy-blocked" };
    if ((response?.status === 429 || response?.status >= 500) && attempts < maximumAttempts) {
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
} = {}) {
  if (!Array.isArray(jobs) || jobs.length > maximumJobs || typeof apiKey !== "string" || apiKey.length === 0
    || model !== "gpt-image-2" || quality !== "low" || typeof fetchFn !== "function" || typeof sleepFn !== "function") {
    throw new Error("Invalid bounded OpenAI image generation request.");
  }
  const results = [];
  const failures = [];
  for (const job of jobs) {
    const assetId = typeof job?.asset_id === "string" ? job.asset_id : "invalid-asset";
    if (!validJob(job)) {
      failures.push(failure(assetId, "qa-failed", "invalid-generation-job", 0));
      continue;
    }
    let prepared;
    try {
      prepared = await prepareImageOutput({ stagingRoot, output: job.output });
    } catch {
      failures.push(failure(job.asset_id, "qa-failed", "unsafe-output-path", 0));
      continue;
    }
    const requested = await requestImage({ job, apiKey, model, quality, fetchFn, sleepFn, now });
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
