import assert from "node:assert/strict";
import { lstat, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { generateOpenAIImages } from "../../shared/scripts/generate-openai-images.mjs";

const key = "sk-test-key-never-public";
const now = () => "2026-08-06T00:00:00.000Z";

function png(width = 16, height = 16) {
  const buffer = Buffer.alloc(33);
  buffer.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  buffer.set([8, 6, 0, 0, 0], 24);
  return buffer;
}

function response({ status = 200, body, requestId = "req-safe-id", retryAfter } = {}) {
  return {
    status,
    headers: { get(name) { return name.toLowerCase() === "x-request-id" ? requestId : name.toLowerCase() === "retry-after" ? retryAfter ?? null : null; } },
    async json() { return body; },
  };
}

function successResponse(width = 16, height = 16) {
  return response({
    body: {
      created: 1_770_000_000,
      data: [{ b64_json: png(width, height).toString("base64"), revised_prompt: "A complete fixture response." }],
      usage: { input_tokens: 12, output_tokens: 34, total_tokens: 46 },
    },
  });
}

function job(overrides = {}) {
  return {
    asset_id: "hero-image",
    prompt: "A safe original hero image.",
    output: { path: "assets/generated/hero-image.png", width: 16, height: 16, format: "png" },
    ...overrides,
  };
}

async function staging(t) {
  const root = await mkdtemp(path.join(tmpdir(), "openai-image-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

test("generateOpenAIImages posts one bounded OpenAI request and atomically promotes a validated PNG", async (t) => {
  const root = await staging(t);
  const calls = [];
  const result = await generateOpenAIImages({
    jobs: [job()], apiKey: key, model: "gpt-image-2", quality: "low", now, stagingRoot: root,
    fetchFn: async (url, options) => { calls.push({ url, options }); return successResponse(); },
    sleepFn: async () => assert.fail("successful request must not sleep"),
  });

  assert.equal(result.provider, "openai");
  assert.equal(result.failures.length, 0);
  assert.equal(result.results.length, 1);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://api.openai.com/v1/images/generations");
  assert.equal(calls[0].options.method, "POST");
  assert.equal(calls[0].options.headers.Authorization, `Bearer ${key}`);
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    model: "gpt-image-2", quality: "low", prompt: "A safe original hero image.", size: "16x16",
  });
  const output = await readFile(path.join(root, "assets/generated/hero-image.png"));
  assert.deepEqual(output, png());
  assert.deepEqual(result.results[0], {
    asset_id: "hero-image",
    generation_state: "generated",
    output: { path: "assets/generated/hero-image.png", width: 16, height: 16, format: "png", bytes: 33, digest: result.results[0].output.digest },
    provenance: {
      provider: "openai", model: "gpt-image-2", quality: "low", request_id: "req-safe-id",
      generated_at: "2026-08-06T00:00:00.000Z", prompt_digest: result.results[0].provenance.prompt_digest,
      output_digest: result.results[0].output.digest,
    },
  });
  assert.match(result.results[0].output.digest, /^[a-f0-9]{64}$/u);
  assert.match(result.results[0].provenance.prompt_digest, /^[a-f0-9]{64}$/u);
});

test("generateOpenAIImages makes zero requests for an empty prompt-only or unapproved-select job list", async (t) => {
  const root = await staging(t);
  let calls = 0;
  const result = await generateOpenAIImages({
    jobs: [], apiKey: key, model: "gpt-image-2", quality: "low", now, stagingRoot: root,
    fetchFn: async () => { calls += 1; throw new Error("network must not be called"); }, sleepFn: async () => {},
  });
  assert.deepEqual(result, { provider: "openai", results: [], failures: [] });
  assert.equal(calls, 0);
});

test("generateOpenAIImages locks the local adapter to gpt-image-2 and low quality", async (t) => {
  const root = await staging(t);
  let calls = 0;
  for (const invalid of [{ model: "other-model" }, { quality: "high" }]) {
    await assert.rejects(
      () => generateOpenAIImages({
        jobs: [job()], apiKey: key, model: invalid.model ?? "gpt-image-2", quality: invalid.quality ?? "low", now, stagingRoot: root,
        fetchFn: async () => { calls += 1; return successResponse(); }, sleepFn: async () => {},
      }),
      /invalid bounded/i,
    );
  }
  assert.equal(calls, 0);
});

test("generateOpenAIImages retries only transient 429 and 5xx responses for at most three total attempts", async (t) => {
  const root = await staging(t);
  const sleeps = [];
  let attempts = 0;
  const result = await generateOpenAIImages({
    jobs: [job()], apiKey: key, model: "gpt-image-2", quality: "low", now, stagingRoot: root,
    fetchFn: async () => {
      attempts += 1;
      if (attempts < 3) return response({ status: attempts === 1 ? 429 : 503, retryAfter: attempts === 1 ? "999999" : undefined, body: { error: { message: "hidden", type: "rate_limit_error", param: null, code: "rate_limit_exceeded" } } });
      return successResponse();
    },
    sleepFn: async (milliseconds) => sleeps.push(milliseconds),
  });
  assert.equal(attempts, 3);
  assert.deepEqual(sleeps, [2_000, 500]);
  assert.equal(result.results.length, 1);
  assert.equal(result.failures.length, 0);
});

test("generateOpenAIImages keeps partial successes and never retries client, quota, or policy failures", async (t) => {
  const root = await staging(t);
  const failures = [
    [{ status: 400, code: "image_generation_user_error" }, "generation-failed"],
    [{ status: 401, code: "invalid_api_key" }, "generation-failed"],
    [{ status: 403, code: "billing_hard_limit_reached" }, "generation-failed"],
    [{ status: 400, code: "moderation_blocked" }, "policy-blocked"],
  ];
  for (const [index, [{ status, code }, expectedState]] of failures.entries()) {
    const assetId = `slot-${index}`;
    let calls = 0;
    const result = await generateOpenAIImages({
      jobs: [job({ asset_id: assetId, output: { path: `assets/generated/${assetId}.png`, width: 16, height: 16, format: "png" } })],
      apiKey: key, model: "gpt-image-2", quality: "low", now, stagingRoot: root,
      fetchFn: async () => { calls += 1; return response({ status, body: { error: { message: "sensitive provider detail", type: "invalid_request_error", param: null, code } } }); },
      sleepFn: async () => assert.fail("non-transient status must not sleep"),
    });
    assert.equal(calls, 1);
    assert.deepEqual(result.results, []);
    assert.deepEqual(result.failures, [{ asset_id: assetId, generation_state: expectedState, reason: expectedState === "policy-blocked" ? "policy-blocked" : "provider-request-failed", attempts: 1 }]);
    const publicText = JSON.stringify(result);
    for (const secret of [key, "sensitive provider detail", "Authorization", "base64"]) assert.equal(publicText.includes(secret), false);
  }
});

test("generateOpenAIImages stops after three transient failures", async (t) => {
  const root = await staging(t);
  let attempts = 0;
  const result = await generateOpenAIImages({
    jobs: [job()], apiKey: key, model: "gpt-image-2", quality: "low", now, stagingRoot: root,
    fetchFn: async () => {
      attempts += 1;
      return response({ status: 503, body: { error: { message: "unavailable", type: "server_error", param: null, code: "server_error" } } });
    }, sleepFn: async () => {},
  });
  assert.equal(attempts, 3);
  assert.deepEqual(result.failures, [{ asset_id: "hero-image", generation_state: "generation-failed", reason: "provider-request-failed", attempts: 3 }]);
});

test("generateOpenAIImages does not retry a transport exception", async (t) => {
  const root = await staging(t);
  let attempts = 0;
  const result = await generateOpenAIImages({
    jobs: [job()], apiKey: key, model: "gpt-image-2", quality: "low", now, stagingRoot: root,
    fetchFn: async () => { attempts += 1; throw new Error("network detail must not escape"); },
    sleepFn: async () => assert.fail("transport exceptions must not retry"),
  });
  assert.equal(attempts, 1);
  assert.deepEqual(result.failures, [{ asset_id: "hero-image", generation_state: "generation-failed", reason: "provider-request-failed", attempts: 1 }]);
  assert.equal(JSON.stringify(result).includes("network detail"), false);
});

test("generateOpenAIImages retains a validated slot when another response is corrupt and removes failed temporary output", async (t) => {
  const root = await staging(t);
  let calls = 0;
  const result = await generateOpenAIImages({
    jobs: [job(), job({ asset_id: "broken", output: { path: "assets/generated/broken.png", width: 16, height: 16, format: "png" } })],
    apiKey: key, model: "gpt-image-2", quality: "low", now, stagingRoot: root,
    fetchFn: async () => {
      calls += 1;
      return calls === 1 ? successResponse() : response({ body: { created: 1, data: [{ b64_json: "not-a-png" }], usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 } } });
    }, sleepFn: async () => {},
  });
  assert.equal(result.results.length, 1);
  assert.deepEqual(result.failures, [{ asset_id: "broken", generation_state: "qa-failed", reason: "invalid-image-output", attempts: 1 }]);
  assert.deepEqual(await readFile(path.join(root, "assets/generated/hero-image.png")), png());
  await assert.rejects(lstat(path.join(root, "assets/generated/broken.png")));
});

test("generateOpenAIImages rejects empty or oversized response data without writing output", async (t) => {
  const root = await staging(t);
  for (const [assetId, b64] of [
    ["empty", ""],
    ["oversized", "A".repeat(16 * 1024 * 1024 + 4)],
  ]) {
    const result = await generateOpenAIImages({
      jobs: [job({ asset_id: assetId, output: { path: `assets/generated/${assetId}.png`, width: 16, height: 16, format: "png" } })],
      apiKey: key, model: "gpt-image-2", quality: "low", now, stagingRoot: root,
      fetchFn: async () => response({ body: { created: 1, data: [{ b64_json: b64 }], usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 } } }), sleepFn: async () => {},
    });
    assert.deepEqual(result.failures, [{ asset_id: assetId, generation_state: "qa-failed", reason: "invalid-image-output", attempts: 1 }]);
    await assert.rejects(lstat(path.join(root, `assets/generated/${assetId}.png`)));
  }
});

test("generateOpenAIImages refuses traversal, symlinks, and existing approved output before network use", async (t) => {
  const root = await staging(t);
  await mkdir(path.join(root, "assets/generated"), { recursive: true });
  await writeFile(path.join(root, "approved.png"), "approved");
  await symlink(path.join(root, "approved.png"), path.join(root, "assets/generated/linked.png"));
  await writeFile(path.join(root, "assets/generated/existing.png"), "approved");
  const invalidJobs = [
    job({ asset_id: "traversal", output: { path: "assets/generated/../../escape.png", width: 16, height: 16, format: "png" } }),
    job({ asset_id: "symlink", output: { path: "assets/generated/linked.png", width: 16, height: 16, format: "png" } }),
    job({ asset_id: "existing", output: { path: "assets/generated/existing.png", width: 16, height: 16, format: "png" } }),
  ];
  let calls = 0;
  const result = await generateOpenAIImages({
    jobs: invalidJobs, apiKey: key, model: "gpt-image-2", quality: "low", now, stagingRoot: root,
    fetchFn: async () => { calls += 1; return successResponse(); }, sleepFn: async () => {},
  });
  assert.equal(calls, 0);
  assert.equal(result.failures.find(({ asset_id }) => asset_id === "traversal").generation_state, "qa-failed");
  assert.equal(result.failures.find(({ asset_id }) => asset_id === "symlink").generation_state, "qa-failed");
  assert.equal(result.failures.find(({ asset_id }) => asset_id === "existing").generation_state, "qa-failed");
  assert.equal(await readFile(path.join(root, "approved.png"), "utf8"), "approved");
});
