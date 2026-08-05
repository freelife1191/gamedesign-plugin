import assert from "node:assert/strict";
import { lstat, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { generateOpenAIImages, maximumResponseBytes } from "../../shared/scripts/generate-openai-images.mjs";
import { prepareImageOutput, promoteValidatedPng } from "../../shared/scripts/lib/image-file-validation.mjs";

const key = "sk-test-key-never-public";
const now = () => "2026-08-06T00:00:00.000Z";

function png(width = 1024, height = 1024) {
  const buffer = Buffer.alloc(33);
  buffer.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  buffer.set([8, 6, 0, 0, 0], 24);
  return buffer;
}

function response({ status = 200, body, requestId = "req-safe-id", retryAfter, contentLength, chunks, onRead } = {}) {
  const source = chunks ?? [Buffer.from(JSON.stringify(body))];
  const length = contentLength === undefined ? String(source.reduce((total, chunk) => total + Buffer.byteLength(chunk), 0)) : contentLength;
  return {
    status,
    headers: { get(name) {
      if (name.toLowerCase() === "x-request-id") return requestId;
      if (name.toLowerCase() === "retry-after") return retryAfter ?? null;
      if (name.toLowerCase() === "content-length") return length ?? null;
      return null;
    } },
    body: { async *[Symbol.asyncIterator]() { for (const chunk of source) { onRead?.(); yield chunk; } } },
  };
}

function successResponse(width = 1024, height = 1024) {
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
    output: { path: "assets/generated/hero-image.png", width: 1024, height: 1024, format: "png" },
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
    model: "gpt-image-2", quality: "low", prompt: "A safe original hero image.", size: "1024x1024", n: 1,
  });
  const output = await readFile(path.join(root, "assets/generated/hero-image.png"));
  assert.deepEqual(output, png());
  assert.deepEqual(result.results[0], {
    asset_id: "hero-image",
    generation_state: "generated",
    output: { path: "assets/generated/hero-image.png", width: 1024, height: 1024, format: "png", bytes: 33, digest: result.results[0].output.digest },
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

test("generateOpenAIImages forwards every config-safe model and quality to the request and provenance", async (t) => {
  const root = await staging(t);
  const calls = [];
  const result = await generateOpenAIImages({
    jobs: [job({ output: { path: "assets/generated/other-model.png", width: 16, height: 16, format: "png" } })],
    apiKey: key, model: "other-model", quality: "high", now, stagingRoot: root,
    fetchFn: async (url, options) => { calls.push({ url, options }); return successResponse(16, 16); }, sleepFn: async () => {},
  });
  assert.deepEqual(JSON.parse(calls[0].options.body), { model: "other-model", quality: "high", prompt: "A safe original hero image.", size: "16x16", n: 1 });
  assert.equal(result.results[0].provenance.model, "other-model");
  assert.equal(result.results[0].provenance.quality, "high");
});

test("generateOpenAIImages rejects empty or unsafe model and quality without a network call or secret echo", async (t) => {
  const root = await staging(t);
  let calls = 0;
  for (const invalid of [{ model: "" }, { model: "model/../../secret" }, { quality: "" }, { quality: "ultra" }]) {
    await assert.rejects(() => generateOpenAIImages({
      jobs: [job()], apiKey: key, model: invalid.model ?? "gpt-image-2", quality: invalid.quality ?? "low", now, stagingRoot: root,
      fetchFn: async () => { calls += 1; return successResponse(); }, sleepFn: async () => {},
    }), (error) => error.code === "invalid_generation_request" && !error.message.includes(key) && !JSON.stringify(error).includes(key));
  }
  assert.equal(calls, 0);
});

test("generateOpenAIImages validates gpt-image-2 dimensions before network at documented boundaries", async (t) => {
  const root = await staging(t);
  const valid = [
    { asset_id: "minimum", output: { path: "assets/generated/minimum.png", width: 640, height: 1024, format: "png" } },
    { asset_id: "maximum", output: { path: "assets/generated/maximum.png", width: 3840, height: 2160, format: "png" } },
  ];
  const calls = [];
  const result = await generateOpenAIImages({
    jobs: valid.map((entry) => job(entry)), apiKey: key, model: "gpt-image-2", quality: "low", now, stagingRoot: root,
    fetchFn: async (url, options) => { calls.push(JSON.parse(options.body)); const { width, height } = /(?<width>\d+)x(?<height>\d+)/u.exec(JSON.parse(options.body).size).groups; return successResponse(Number(width), Number(height)); }, sleepFn: async () => {},
  });
  assert.deepEqual(calls.map(({ size }) => size), ["640x1024", "3840x2160"]);
  assert.equal(result.results.length, 2);
  assert.deepEqual(result.failures, []);

  for (const [assetId, width, height] of [
    ["too-small", 16, 16], ["too-wide", 3856, 1024], ["not-multiple", 1025, 1024], ["bad-aspect", 3840, 1024],
  ]) {
    let invalidCalls = 0;
    const invalid = await generateOpenAIImages({
      jobs: [job({ asset_id: assetId, output: { path: `assets/generated/${assetId}.png`, width, height, format: "png" } })],
      apiKey: key, model: "gpt-image-2", quality: "low", now, stagingRoot: root,
      fetchFn: async () => { invalidCalls += 1; return successResponse(); }, sleepFn: async () => {},
    });
    assert.equal(invalidCalls, 0);
    assert.deepEqual(invalid.failures, [{ asset_id: assetId, generation_state: "qa-failed", reason: "invalid-generation-size", attempts: 0 }]);
  }
});

test("generateOpenAIImages requires exactly one image entry and streams JSON without response.json", async (t) => {
  const root = await staging(t);
  const streamResult = await generateOpenAIImages({
    jobs: [job()], apiKey: key, model: "gpt-image-2", quality: "low", now, stagingRoot: root,
    fetchFn: async () => response({ contentLength: null, chunks: [Buffer.from('{"created":1,'), Buffer.from(`"data":[{"b64_json":"${png().toString("base64")}"}],"usage":{}}`)] }), sleepFn: async () => {},
  });
  assert.equal(streamResult.results.length, 1);

  const multiple = await generateOpenAIImages({
    jobs: [job({ asset_id: "multiple", output: { path: "assets/generated/multiple.png", width: 1024, height: 1024, format: "png" } })], apiKey: key, model: "gpt-image-2", quality: "low", now, stagingRoot: root,
    fetchFn: async () => response({ body: { created: 1, data: [{ b64_json: png().toString("base64") }, { b64_json: png().toString("base64") }], usage: {} } }), sleepFn: async () => {},
  });
  assert.deepEqual(multiple.failures, [{ asset_id: "multiple", generation_state: "qa-failed", reason: "invalid-provider-response", attempts: 1 }]);
});

test("generateOpenAIImages bounds streamed response bytes for declared, missing, and lying content lengths", async (t) => {
  const root = await staging(t);
  let declaredReads = 0;
  const declared = await generateOpenAIImages({
    jobs: [job({ asset_id: "declared", output: { path: "assets/generated/declared.png", width: 1024, height: 1024, format: "png" } })], apiKey: key, model: "gpt-image-2", quality: "low", now, stagingRoot: root,
    fetchFn: async () => response({ contentLength: String(maximumResponseBytes + 1), chunks: [Buffer.alloc(1)], onRead: () => { declaredReads += 1; } }), sleepFn: async () => {},
  });
  assert.equal(declaredReads, 0);
  assert.deepEqual(declared.failures, [{ asset_id: "declared", generation_state: "qa-failed", reason: "invalid-provider-response", attempts: 1 }]);

  const lying = await generateOpenAIImages({
    jobs: [job({ asset_id: "lying", output: { path: "assets/generated/lying.png", width: 1024, height: 1024, format: "png" } })], apiKey: key, model: "gpt-image-2", quality: "low", now, stagingRoot: root,
    fetchFn: async () => response({ contentLength: "1", chunks: [Buffer.alloc(maximumResponseBytes + 1)] }), sleepFn: async () => {},
  });
  assert.deepEqual(lying.failures, [{ asset_id: "lying", generation_state: "qa-failed", reason: "invalid-provider-response", attempts: 1 }]);
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
    [{ status: 429, code: "rate_limit_exceeded", type: "image_generation_user_error" }, "generation-failed"],
    [{ status: 401, code: "invalid_api_key" }, "generation-failed"],
    [{ status: 403, code: "billing_hard_limit_reached" }, "generation-failed"],
    [{ status: 429, code: "insufficient_quota" }, "generation-failed"],
    [{ status: 400, code: "moderation_blocked" }, "policy-blocked"],
  ];
  for (const [index, [{ status, code, type = "invalid_request_error" }, expectedState]] of failures.entries()) {
    const assetId = `slot-${index}`;
    let calls = 0;
    const result = await generateOpenAIImages({
      jobs: [job({ asset_id: assetId, output: { path: `assets/generated/${assetId}.png`, width: 1024, height: 1024, format: "png" } })],
      apiKey: key, model: "gpt-image-2", quality: "low", now, stagingRoot: root,
      fetchFn: async () => { calls += 1; return response({ status, body: { error: { message: "sensitive provider detail", type, param: null, code } } }); },
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
    jobs: [job(), job({ asset_id: "broken", output: { path: "assets/generated/broken.png", width: 1024, height: 1024, format: "png" } })],
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
      jobs: [job({ asset_id: assetId, output: { path: `assets/generated/${assetId}.png`, width: 1024, height: 1024, format: "png" } })],
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
    job({ asset_id: "traversal", output: { path: "assets/generated/../../escape.png", width: 1024, height: 1024, format: "png" } }),
    job({ asset_id: "symlink", output: { path: "assets/generated/linked.png", width: 1024, height: 1024, format: "png" } }),
    job({ asset_id: "existing", output: { path: "assets/generated/existing.png", width: 1024, height: 1024, format: "png" } }),
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

test("promoteValidatedPng preserves a destination created after preflight and cleans its temporary file", async (t) => {
  const root = await staging(t);
  const prepared = await prepareImageOutput({ stagingRoot: root, output: job().output });
  await assert.rejects(
    () => promoteValidatedPng({
      prepared, bytes: png(),
      afterTemporaryWritten: async () => writeFile(prepared.destination, "prior-approved-bytes"),
    }),
    /validation|publish/i,
  );
  assert.equal(await readFile(prepared.destination, "utf8"), "prior-approved-bytes");
  assert.equal((await readdir(path.dirname(prepared.destination))).some((name) => name.includes(".tmp-")), false);
});
