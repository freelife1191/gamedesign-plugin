import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { lstat, mkdir, mkdtemp, readFile, readdir, rename, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { deflateSync } from "node:zlib";

import { generateOpenAIImages, maximumResponseBytes } from "../../shared/scripts/generate-openai-images.mjs";
import { prepareImageOutput, promoteValidatedPng } from "../../shared/scripts/lib/image-file-validation.mjs";

const key = "sk-test-key-never-public";
const now = () => "2026-08-06T00:00:00.000Z";

function png(width = 1024, height = 1024) {
  const crc32 = (bytes) => {
    let crc = 0xffffffff;
    for (const byte of bytes) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
    return (crc ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const bytes = Buffer.alloc(12 + data.length);
    bytes.writeUInt32BE(data.length, 0); bytes.write(type, 4, "ascii"); data.copy(bytes, 8);
    bytes.writeUInt32BE(crc32(bytes.subarray(4, 8 + data.length)), 8 + data.length);
    return bytes;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4); header.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", header), chunk("IDAT", deflateSync(Buffer.alloc(height * (width * 4 + 1)))), chunk("IEND", Buffer.alloc(0))]);
}

function response({ status = 200, body, requestId = "req-safe-id", retryAfter, contentLength, chunks, onRead, bodyStream } = {}) {
  const source = chunks ?? [Buffer.from(JSON.stringify(body ?? {}))];
  const length = contentLength === undefined ? String(source.reduce((total, chunk) => total + Buffer.byteLength(chunk), 0)) : contentLength;
  return {
    status,
    headers: { get(name) {
      if (name.toLowerCase() === "x-request-id") return requestId;
      if (name.toLowerCase() === "retry-after") return retryAfter ?? null;
      if (name.toLowerCase() === "content-length") return length ?? null;
      return null;
    } },
    body: bodyStream ?? { async *[Symbol.asyncIterator]() { for (const chunk of source) { onRead?.(); yield chunk; } } },
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

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function derivativeJob(overrides = {}) {
  const master = png();
  return job({
    asset_id: "hero-derivative",
    output: { path: "assets/generated/hero-derivative.png", width: 1024, height: 1024, format: "png" },
    asset_set_id: "wind-island",
    derivative_of: "hero-master",
    reference_images: [{ asset_id: "hero-master", path: "assets/generated/hero-master.png", sha256: sha256(master) }],
    consistency_profile: { style_anchor_asset_ids: ["hero-master"], character_anchor_asset_ids: ["hero-master"] },
    prompt_lineage: { parent_prompt_digests: [sha256("Master character prompt.")] },
    ...overrides,
  });
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
    output: { path: "assets/generated/hero-image.png", width: 1024, height: 1024, format: "png", bytes: png().length, digest: result.results[0].output.digest },
    provenance: {
      provider: "openai", model: "gpt-image-2", quality: "low", request_id: "req-safe-id",
      generated_at: "2026-08-06T00:00:00.000Z", prompt_digest: result.results[0].provenance.prompt_digest,
      output_digest: result.results[0].output.digest,
    },
  });
  assert.match(result.results[0].output.digest, /^[a-f0-9]{64}$/u);
  assert.match(result.results[0].provenance.prompt_digest, /^[a-f0-9]{64}$/u);
});

test("generateOpenAIImages authorizes every retried provider attempt immediately before fetch", async (t) => {
  const root = await staging(t);
  const authorizations = [];
  let fetches = 0;
  const result = await generateOpenAIImages({
    jobs: [job()], apiKey: key, model: "gpt-image-2", quality: "low", now, stagingRoot: root, sleepFn: async () => {},
    beforeProvider: ({ asset_id, attempt_ordinal }) => authorizations.push([asset_id, attempt_ordinal]),
    fetchFn: async () => {
      fetches += 1;
      return fetches === 1 ? response({ status: 500, body: { error: {} } }) : successResponse();
    },
  });
  assert.deepEqual(authorizations, [["hero-image", 1], ["hero-image", 2]]);
  assert.equal(fetches, 2);
  assert.equal(result.results[0].asset_id, "hero-image");
});

test("promoteValidatedPng rejects truncated, corrupt, and incomplete PNG structures before publishing", async (t) => {
  const root = await staging(t);
  const valid = png();
  const idatType = valid.indexOf(Buffer.from("IDAT"));
  const idatStart = idatType - 4;
  const idatEnd = idatType + 4 + valid.readUInt32BE(idatStart) + 4;
  const badCrc = Buffer.from(valid); badCrc[29] ^= 1;
  const corruptZlib = Buffer.from(valid); corruptZlib[idatType + 4] ^= 1;
  const malformed = [
    valid.subarray(0, valid.length - 1), badCrc, Buffer.concat([valid.subarray(0, idatStart), valid.subarray(idatEnd)]),
    valid.subarray(0, valid.length - 12), corruptZlib,
  ];
  for (const bytes of malformed) {
    const prepared = await prepareImageOutput({ stagingRoot: root, output: job().output });
    await assert.rejects(() => promoteValidatedPng({ prepared, bytes }), (error) => error.code === "invalid-image-output");
  }
  await assert.rejects(readFile(path.join(root, job().output.path)));
  assert.equal((await readdir(path.join(root, "assets", "generated"))).length, 0);
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

test("generateOpenAIImages sends master-referenced gpt-image-2 jobs as ordered multipart edits without input_fidelity", async (t) => {
  const root = await staging(t);
  await mkdir(path.join(root, "assets", "generated"), { recursive: true });
  await writeFile(path.join(root, "assets", "generated", "hero-master.png"), png());
  const calls = [];
  const result = await generateOpenAIImages({
    jobs: [derivativeJob()], apiKey: key, model: "gpt-image-2", quality: "low", now, stagingRoot: root,
    fetchFn: async (url, options) => { calls.push({ url, options }); return successResponse(); }, sleepFn: async () => {},
  });

  assert.equal(result.failures.length, 0);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://api.openai.com/v1/images/edits");
  assert.equal(calls[0].options.method, "POST");
  assert.equal(calls[0].options.headers.Authorization, `Bearer ${key}`);
  assert.ok(calls[0].options.body instanceof FormData);
  assert.equal(calls[0].options.body.get("model"), "gpt-image-2");
  assert.equal(calls[0].options.body.get("quality"), "low");
  assert.equal(calls[0].options.body.get("size"), "1024x1024");
  assert.equal(calls[0].options.body.get("prompt"), "A safe original hero image.");
  assert.equal(calls[0].options.body.has("input_fidelity"), false);
  assert.deepEqual(calls[0].options.body.getAll("image[]").map((file) => file.name), ["hero-master.png"]);
  assert.deepEqual(Buffer.from(await calls[0].options.body.getAll("image[]")[0].arrayBuffer()), png());
});

test("generateOpenAIImages pins root-to-leaf identities and rejects deterministic root or parent swaps before provider delivery", async (t) => {
  for (const swap of ["root", "parent-symlink"]) {
    const root = await staging(t);
    await mkdir(path.join(root, "assets", "generated"), { recursive: true });
    await writeFile(path.join(root, "assets", "generated", "hero-master.png"), png());
    let calls = 0;
    let hooks = 0;
    const result = await generateOpenAIImages({
      jobs: [derivativeJob()], apiKey: key, model: "gpt-image-2", quality: "low", now, stagingRoot: root,
      beforeProvider: async () => {
        hooks += 1;
        if (swap === "root") {
          await rename(root, `${root}-moved`);
          await mkdir(root, { recursive: true });
          t.after(() => rm(`${root}-moved`, { recursive: true, force: true }));
        } else {
          await rename(path.join(root, "assets"), path.join(root, "assets-moved"));
          await symlink(path.join(root, "assets-moved"), path.join(root, "assets"));
        }
      },
      fetchFn: async () => { calls += 1; return successResponse(); }, sleepFn: async () => {},
    });
    assert.equal(hooks, 1, swap);
    assert.equal(calls, 0, swap);
    assert.deepEqual(result.failures, [{ asset_id: "hero-derivative", generation_state: "qa-failed", reason: "invalid-generation-reference", attempts: 0 }], swap);
  }
});

test("generateOpenAIImages rejects excess reference inputs before any provider request", async (t) => {
  const root = await staging(t);
  await mkdir(path.join(root, "assets", "generated"), { recursive: true });
  const bytes = png();
  const reference_images = await Promise.all(Array.from({ length: 9 }, async (_value, index) => {
    const asset_id = `reference-${index}`;
    const referencePath = `assets/generated/${asset_id}.png`;
    await writeFile(path.join(root, referencePath), bytes);
    return { asset_id, path: referencePath, sha256: sha256(bytes) };
  }));
  let calls = 0;
  const result = await generateOpenAIImages({
    jobs: [job({ asset_id: "too-many-references", output: { path: "assets/generated/too-many-references.png", width: 1024, height: 1024, format: "png" }, reference_images })],
    apiKey: key, model: "gpt-image-2", quality: "low", now, stagingRoot: root,
    fetchFn: async () => { calls += 1; return successResponse(); }, sleepFn: async () => {},
  });
  assert.equal(calls, 0);
  assert.deepEqual(result.failures, [{ asset_id: "too-many-references", generation_state: "qa-failed", reason: "invalid-generation-reference", attempts: 0 }]);
});

test("generateOpenAIImages rebuilds ordered edit multipart data for every retry", async (t) => {
  const root = await staging(t);
  await mkdir(path.join(root, "assets", "generated"), { recursive: true });
  const master = png();
  await writeFile(path.join(root, "assets", "generated", "hero-master.png"), master);
  const bodies = [];
  let attempts = 0;
  const result = await generateOpenAIImages({
    jobs: [derivativeJob()], apiKey: key, model: "gpt-image-2", quality: "low", now, stagingRoot: root,
    fetchFn: async (_url, options) => {
      bodies.push(options.body);
      attempts += 1;
      return attempts === 1
        ? response({ status: 503, body: { error: { type: "server_error", code: "server_error" } } })
        : successResponse();
    },
    sleepFn: async () => {},
  });
  assert.equal(result.failures.length, 0);
  assert.equal(bodies.length, 2);
  assert.notEqual(bodies[0], bodies[1]);
  for (const body of bodies) assert.deepEqual(body.getAll("image[]").map((file) => file.name), ["hero-master.png"]);
});

test("generateOpenAIImages aborts a never-resolving OpenAI request, writes no PNG, and does not fall back", async (t) => {
  const root = await staging(t);
  let aborts = 0;
  let calls = 0;
  const result = await generateOpenAIImages({
    jobs: [job({ asset_id: "timed-out", output: { path: "assets/generated/timed-out.png", width: 1024, height: 1024, format: "png" } })],
    apiKey: key, model: "gpt-image-2", quality: "low", now, stagingRoot: root, requestTimeoutMs: 5,
    fetchFn: async (_url, options) => {
      calls += 1;
      assert.ok(options.signal instanceof AbortSignal, "OpenAI requests must receive an AbortSignal");
      return new Promise((_resolve, reject) => {
        options.signal.addEventListener("abort", () => { aborts += 1; reject(options.signal.reason); }, { once: true });
      });
    },
    sleepFn: async () => assert.fail("a timed-out request must not retry or switch providers"),
  });
  assert.equal(calls, 1);
  assert.equal(aborts, 1);
  assert.deepEqual(result.failures, [{ asset_id: "timed-out", generation_state: "generation-failed", reason: "provider-timeout", attempts: 1 }]);
  await assert.rejects(lstat(path.join(root, "assets", "generated", "timed-out.png")));
});

test("generateOpenAIImages keeps its timeout active until a streamed response body finishes decoding", async (t) => {
  const root = await staging(t);
  let calls = 0;
  let cancels = 0;
  const result = await Promise.race([
    generateOpenAIImages({
      jobs: [job({ asset_id: "body-timeout", output: { path: "assets/generated/body-timeout.png", width: 1024, height: 1024, format: "png" } })],
      apiKey: key, model: "gpt-image-2", quality: "low", now, stagingRoot: root, requestTimeoutMs: 5,
      fetchFn: async (_url, options) => {
        calls += 1;
        return {
          status: 200,
          headers: { get: () => null },
          body: {
            getReader() {
              return {
                read() { return new Promise((_resolve, reject) => options.signal.addEventListener("abort", () => reject(options.signal.reason), { once: true })); },
                async cancel() { cancels += 1; },
                releaseLock() {},
              };
            },
          },
        };
      },
      sleepFn: async () => assert.fail("timed out response decoding must not retry"),
    }),
    new Promise((_resolve, reject) => setTimeout(() => reject(new Error("response decode timeout remained unbounded")), 100)),
  ]);
  assert.equal(calls, 1);
  assert.equal(cancels, 1);
  assert.deepEqual(result.failures, [{ asset_id: "body-timeout", generation_state: "generation-failed", reason: "provider-timeout", attempts: 1 }]);
});

test("generateOpenAIImages times out body readers and async iterators that ignore AbortSignal without publishing partial output", async (t) => {
  for (const [kind, body] of [
    ["reader", { getReader() { return { read() { return new Promise(() => {}); }, cancel() {}, releaseLock() {} }; } }],
    ["iterator", { [Symbol.asyncIterator]() { return { next() { return new Promise(() => {}); }, return() {} }; }, cancel() {} }],
  ]) {
    const root = await staging(t);
    let calls = 0;
    const result = await Promise.race([
      generateOpenAIImages({
        jobs: [job({ asset_id: `ignored-${kind}`, output: { path: `assets/generated/ignored-${kind}.png`, width: 1024, height: 1024, format: "png" } })],
        apiKey: key, model: "gpt-image-2", quality: "low", now, stagingRoot: root, requestTimeoutMs: 5,
        fetchFn: async () => { calls += 1; return { status: 200, headers: { get: () => null }, body }; }, sleepFn: async () => {},
      }),
      new Promise((_resolve, reject) => setTimeout(() => reject(new Error(`${kind} body ignored deadline`)), 1000)),
    ]);
    assert.equal(calls, 1, kind);
    assert.deepEqual(result.failures, [{ asset_id: `ignored-${kind}`, generation_state: "generation-failed", reason: "provider-timeout", attempts: 1 }], kind);
    await assert.rejects(lstat(path.join(root, "assets", "generated", `ignored-${kind}.png`)), kind);
  }
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

test("generateOpenAIImages cancels an oversized declared response before reading its body", async (t) => {
  const root = await staging(t);
  let reads = 0;
  let cancels = 0;
  const result = await generateOpenAIImages({
    jobs: [job({ asset_id: "cancel-declared", output: { path: "assets/generated/cancel-declared.png", width: 1024, height: 1024, format: "png" } })], apiKey: key, model: "gpt-image-2", quality: "low", now, stagingRoot: root,
    fetchFn: async () => response({
      contentLength: String(maximumResponseBytes + 1),
      bodyStream: {
        async cancel() { cancels += 1; throw new Error("cancellation detail must not escape"); },
        async *[Symbol.asyncIterator]() { reads += 1; yield Buffer.alloc(1); },
      },
    }), sleepFn: async () => {},
  });
  assert.equal(reads, 0);
  assert.equal(cancels, 1);
  assert.deepEqual(result.failures, [{ asset_id: "cancel-declared", generation_state: "qa-failed", reason: "invalid-provider-response", attempts: 1 }]);
  assert.equal(JSON.stringify(result).includes("cancellation detail"), false);
});

test("generateOpenAIImages cancels and releases a reader when a chunk exceeds the byte ceiling", async (t) => {
  const root = await staging(t);
  let cancels = 0;
  let releases = 0;
  let reads = 0;
  const reader = {
    async read() { reads += 1; return { done: false, value: Buffer.alloc(maximumResponseBytes + 1) }; },
    async cancel() { cancels += 1; throw new Error("reader cancellation detail must not escape"); },
    releaseLock() { releases += 1; },
  };
  const result = await generateOpenAIImages({
    jobs: [job({ asset_id: "cancel-reader", output: { path: "assets/generated/cancel-reader.png", width: 1024, height: 1024, format: "png" } })], apiKey: key, model: "gpt-image-2", quality: "low", now, stagingRoot: root,
    fetchFn: async () => response({ contentLength: "1", bodyStream: { getReader() { return reader; } } }), sleepFn: async () => {},
  });
  assert.equal(reads, 1);
  assert.equal(cancels, 1);
  assert.equal(releases, 1);
  assert.deepEqual(result.failures, [{ asset_id: "cancel-reader", generation_state: "qa-failed", reason: "invalid-provider-response", attempts: 1 }]);
  assert.equal(JSON.stringify(result).includes("reader cancellation detail"), false);
});

test("generateOpenAIImages redacts hostile reader, iterator, cancellation, and release failures", async (t) => {
  const root = await staging(t);
  const cases = [
    ["reader-sync-read", () => ({ contentLength: "1", bodyStream: { getReader() { return { read() { throw new Error("reader-sync-read-marker"); }, async cancel() {}, releaseLock() {} }; } } })],
    ["reader-async-read", () => ({ contentLength: "1", bodyStream: { getReader() { return { async read() { throw new Error("reader-async-read-marker"); }, async cancel() {}, releaseLock() {} }; } } })],
    ["iterator-sync-next", () => ({ bodyStream: { async cancel() {}, [Symbol.asyncIterator]() { return { next() { throw new Error("iterator-sync-next-marker"); } }; } } })],
    ["iterator-async-next", () => ({ bodyStream: { async cancel() {}, [Symbol.asyncIterator]() { return { async next() { throw new Error("iterator-async-next-marker"); } }; } } })],
    ["body-cancel-sync", () => ({ contentLength: String(maximumResponseBytes + 1), bodyStream: { cancel() { throw new Error("body-cancel-sync-marker"); } } })],
    ["body-cancel-value", () => ({ contentLength: String(maximumResponseBytes + 1), bodyStream: { cancel() { return undefined; } } })],
    ["body-cancel-reject", () => ({ contentLength: String(maximumResponseBytes + 1), bodyStream: { async cancel() { throw new Error("body-cancel-reject-marker"); } } })],
    ["reader-cancel-sync", () => ({ contentLength: "1", bodyStream: { getReader() { return { async read() { return { done: false, value: Buffer.alloc(maximumResponseBytes + 1) }; }, cancel() { throw new Error("reader-cancel-sync-marker"); }, releaseLock() {} }; } } })],
    ["reader-cancel-value", () => ({ contentLength: "1", bodyStream: { getReader() { return { async read() { return { done: false, value: Buffer.alloc(maximumResponseBytes + 1) }; }, cancel() { return undefined; }, releaseLock() {} }; } } })],
    ["reader-cancel-reject", () => ({ contentLength: "1", bodyStream: { getReader() { return { async read() { return { done: false, value: Buffer.alloc(maximumResponseBytes + 1) }; }, async cancel() { throw new Error("reader-cancel-reject-marker"); }, releaseLock() {} }; } } })],
    ["release-sync", () => ({ contentLength: "1", bodyStream: { getReader() { return { async read() { return { done: false, value: Buffer.alloc(maximumResponseBytes + 1) }; }, async cancel() {}, releaseLock() { throw new Error("release-sync-marker"); } }; } } })],
    ["release-value", () => ({ contentLength: "1", bodyStream: { getReader() { return { async read() { return { done: false, value: Buffer.alloc(maximumResponseBytes + 1) }; }, async cancel() {}, releaseLock() { return undefined; } }; } } })],
  ];
  for (const [name, fixture] of cases) {
    const result = await generateOpenAIImages({
      jobs: [job({ asset_id: `hostile-${name}`, output: { path: `assets/generated/hostile-${name}.png`, width: 1024, height: 1024, format: "png" } })], apiKey: key, model: "gpt-image-2", quality: "low", now, stagingRoot: root,
      fetchFn: async () => response(fixture()), sleepFn: async () => {},
    });
    assert.deepEqual(result.failures, [{ asset_id: `hostile-${name}`, generation_state: "qa-failed", reason: "invalid-provider-response", attempts: 1 }]);
    assert.equal(JSON.stringify(result).includes(`${name}-marker`), false);
  }
});

test("generateOpenAIImages absorbs a rejected reader release without an unhandled rejection", async (t) => {
  const root = await staging(t);
  const unhandledRejections = [];
  const observeUnhandledRejection = (reason) => unhandledRejections.push(reason);
  process.on("unhandledRejection", observeUnhandledRejection);
  t.after(() => process.off("unhandledRejection", observeUnhandledRejection));

  const result = await generateOpenAIImages({
    jobs: [job({ asset_id: "release-reject", output: { path: "assets/generated/release-reject.png", width: 1024, height: 1024, format: "png" } })], apiKey: key, model: "gpt-image-2", quality: "low", now, stagingRoot: root,
    fetchFn: async () => response({ contentLength: "1", bodyStream: { getReader() { return {
      async read() { return { done: false, value: Buffer.alloc(maximumResponseBytes + 1) }; },
      async cancel() {},
      releaseLock() { return Promise.reject(new Error("release-reject-marker")); },
    }; } } }), sleepFn: async () => {},
  });
  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(result.failures, [{ asset_id: "release-reject", generation_state: "qa-failed", reason: "invalid-provider-response", attempts: 1 }]);
  assert.deepEqual(unhandledRejections, []);
  assert.equal(JSON.stringify(result).includes("release-reject-marker"), false);
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

test("promoteValidatedPng publishes one concurrent winner without callbacks or clobbering", async (t) => {
  const root = await staging(t);
  const prepared = [
    await prepareImageOutput({ stagingRoot: root, output: job().output }),
    await prepareImageOutput({ stagingRoot: root, output: job().output }),
  ];
  const first = png();
  const second = png();
  second[32] = 1;
  const outcomes = await Promise.allSettled(prepared.map((entry, index) => promoteValidatedPng({ prepared: entry, bytes: index === 0 ? first : second })));
  assert.equal(outcomes.filter(({ status }) => status === "fulfilled").length, 1);
  assert.equal(outcomes.filter(({ status }) => status === "rejected").length, 1);
  const winner = outcomes[0].status === "fulfilled" ? first : second;
  assert.deepEqual(await readFile(prepared[0].destination), winner);
  assert.equal((await readdir(path.dirname(prepared[0].destination))).some((name) => name.includes(".tmp-")), false);
});

test("promoteValidatedPng ignores arbitrary post-QA callback properties", async (t) => {
  const root = await staging(t);
  const prepared = await prepareImageOutput({ stagingRoot: root, output: job().output });
  let invoked = false;
  await promoteValidatedPng({ prepared, bytes: png(), beforePublish: async () => { invoked = true; }, afterTemporaryWritten: async () => { invoked = true; } });
  assert.equal(invoked, false);
  assert.deepEqual(await readFile(prepared.destination), png());
});
