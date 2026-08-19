import assert, { AssertionError } from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

import { calculateActualCost, estimateCutsceneImageCost } from "../../../shared/scripts/estimate-cutscene-image-cost.mjs";
import { issueCutsceneHumanApproval } from "../../../shared/scripts/lib/cutscene-generation-approval.mjs";
import { bindCutscenePromptPackage, planCutsceneVisualPreproduction } from "../../../shared/scripts/plan-cutscene-visual-preproduction.mjs";
import { reviewCutsceneContinuity } from "../../../shared/scripts/review-cutscene-continuity.mjs";
import { retryCutsceneFailedAssets, runApprovedCutsceneImageWave } from "../../../shared/scripts/run-approved-cutscene-image-stage.mjs";
import { assertCutsceneContinuityGate, cutsceneDocumentSha256 } from "../../../shared/scripts/validate-cutscene-visual-preproduction.mjs";
import { CHILD_ENVIRONMENT_KEYS, CHILD_DEADLINE_SCALE } from "../../lib/platform-support.mjs";

const root = fileURLToPath(new URL("../../..", import.meta.url));
const SHA = "3".repeat(64);
const MAX_EVIDENCE_BYTES = 4 * 1024;
const MAX_OUTPUT_BYTES = 64 * 1024;
const TEST_TIMEOUT_MS = 4_000 * CHILD_DEADLINE_SCALE;
const CLOSE_TIMEOUT_MS = 1_000 * CHILD_DEADLINE_SCALE;
const compare = (left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right));
const digest = (value) => cutsceneDocumentSha256(value);

export const MUTATIONS = [
  "approval-authority", "approval-binding", "reference-binding", "stage-selection", "cost-cap", "retry-reserve", "mode-boundary", "usage-completeness", "continuity-wave-splice", "continuity-unrelated-manifest", "continuity-receipt-stale",
];

export function validPng(width = 1, height = 1) {
  const crc32 = (bytes) => { let crc = 0xffffffff; for (const byte of bytes) { crc ^= byte; for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); } return (crc ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const bytes = Buffer.alloc(12 + data.length); bytes.writeUInt32BE(data.length); bytes.write(type, 4, "ascii"); data.copy(bytes, 8); bytes.writeUInt32BE(crc32(bytes.subarray(4, 8 + data.length)), 8 + data.length); return bytes; };
  const header = Buffer.alloc(13); header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", header), chunk("IDAT", deflateSync(Buffer.alloc(height * (width * 4 + 1)))), chunk("IEND", Buffer.alloc(0))]);
}

export function imageResponse({ status = 200, requestId = "req-cutscene", usage } = {}) {
  const body = status >= 200 && status < 300
    ? { data: [{ b64_json: validPng(1024, 1024).toString("base64") }], usage: usage ?? { input_tokens: 8, output_tokens: 4, total_tokens: 12, input_tokens_details: { text_tokens: 3, image_tokens: 5, cached_text_tokens: 0, cached_image_tokens: 0 } } }
    : { error: { type: "server_error" }, ...(usage ? { usage } : {}) };
  const bytes = Buffer.from(JSON.stringify(body));
  return { status, headers: { get: (name) => name.toLowerCase() === "x-request-id" ? requestId : name.toLowerCase() === "content-length" ? String(bytes.length) : null }, body: { async *[Symbol.asyncIterator]() { yield bytes; } } };
}

export function makeRuntime(overrides = {}) {
  const calls = { fetch: 0, host: 0 };
  return {
    calls,
    env: {},
    fetchFn: async () => { calls.fetch += 1; throw new Error("live network forbidden"); },
    hostGenerate: async () => { calls.host += 1; throw new Error("live host forbidden"); },
    sleepFn: async () => {},
    ...overrides,
  };
}

function markPredecessorsCompleted(plan, waveId) {
  const index = plan.cutsceneWorkflow.waves.findIndex((wave) => wave.id === waveId);
  for (const wave of plan.cutsceneWorkflow.waves.slice(0, index)) {
    wave.state = "completed";
    wave.completion = { kind: "completed", assetIds: [...wave.assetIds] };
  }
}

function pricingSnapshot(provider = "openai") {
  const value = { provider, model: "gpt-image-2", sourceUrl: "https://openai.com/api/pricing/", retrievedAt: "2026-08-13T00:00:00.000Z", currency: "USD", units: { textInput: 5, cachedTextInput: 1.25, imageInput: 8, cachedImageInput: 2, imageOutput: 30 } };
  return { ...value, sha256: digest(value) };
}

function promptPackage(plan, manifest, waveId) {
  const ids = plan.cutsceneWorkflow.waves.flatMap((wave) => wave.assetIds);
  const targetIndex = plan.cutsceneWorkflow.waves.findIndex((wave) => wave.id === waveId);
  const requiredReferences = plan.cutsceneWorkflow.waves.slice(0, targetIndex).flatMap((wave) => wave.assetIds);
  const assets = new Map(manifest.assets.map((asset) => [asset.asset_id, asset]));
  const references = [{ assetId: ids[0], sha256: SHA }, { assetId: ids[1], sha256: "4".repeat(64) }];
  for (const assetId of requiredReferences) if (!references.some((reference) => reference.assetId === assetId)) {
    references.push({ assetId, sha256: createHash("sha256").update(`fixture-reference:${assetId}`).digest("hex") });
  }
  const value = {
    kind: "generation-ready", cutsceneId: plan.cutsceneId, planSha256: digest(plan), dagSha256: digest(plan.cutsceneWorkflow.downstream),
    references,
    prompts: ids.map((assetId) => ({ assetId, prompt: assets.get(assetId).prompt, promptSha256: assets.get(assetId).prompt_sha256 })),
  };
  return { ...value, promptPackageSha256: digest(value) };
}

function bindManifest(plan, manifest) {
  const planSha256 = digest(plan); const dagSha256 = digest(plan.cutsceneWorkflow.downstream);
  for (const asset of manifest.assets) asset.approval_binding_sha256 = digest({ assetId: asset.asset_id, dagSha256, planSha256, promptSha256: asset.prompt_sha256 });
  return manifest;
}

export async function snapshotArtifactTree(artifactRoot) {
  const entries = [];
  async function walk(directory, parent = "") {
    const children = await readdir(directory, { withFileTypes: true }).catch((error) => error?.code === "ENOENT" ? [] : Promise.reject(error));
    for (const child of children.sort((left, right) => compare(left.name, right.name))) {
      const relative = parent ? `${parent}/${child.name}` : child.name; const absolute = path.join(directory, child.name); const stats = await lstat(absolute);
      if (stats.isSymbolicLink()) { entries.push({ path: relative, type: "symlink", sha256: null, size: stats.size, failMarker: "symlink-forbidden" }); continue; }
      if (stats.isDirectory()) { entries.push({ path: relative, type: "directory", sha256: null, size: stats.size }); await walk(absolute, relative); continue; }
      if (!stats.isFile()) { entries.push({ path: relative, type: "special", sha256: null, size: stats.size, failMarker: "special-entry-forbidden" }); continue; }
      const hash = createHash("sha256"); let size = 0; for await (const chunk of createReadStream(absolute)) { hash.update(chunk); size += chunk.length; }
      entries.push({ path: relative, type: "file", sha256: hash.digest("hex"), size });
    }
  }
  await walk(artifactRoot);
  return entries.sort((left, right) => compare(left.path, right.path));
}

export async function makeFixture(t, { waveId = "style-master", retryReserve = 1, completeAll = false, actualMasterBinding = false } = {}) {
  const artifactRoot = await mkdtemp(path.join(tmpdir(), "cutscene-e2e-"));
  if (t?.after) t.after(() => rm(artifactRoot, { recursive: true, force: true }));
  const planned = planCutsceneVisualPreproduction({ cutsceneId: "cutscene-escape", mode: "generate-after-approval", beats: [{ beatId: "BEAT-01" }], shots: [{ shotId: "SHOT-01", beatId: "BEAT-01" }] });
  const plan = structuredClone(planned.plan); markPredecessorsCompleted(plan, waveId);
  if (completeAll) for (const wave of plan.cutsceneWorkflow.waves) { wave.state = "completed"; wave.completion = { kind: "completed", assetIds: [...wave.assetIds] }; }
  const manifest = bindManifest(plan, structuredClone(planned.manifest));
  if (actualMasterBinding) {
    const targetIndex = plan.cutsceneWorkflow.waves.findIndex((wave) => wave.id === waveId);
    const sourceIds = plan.cutsceneWorkflow.waves.slice(0, targetIndex).flatMap((wave) => wave.assetIds);
    if (sourceIds.length === 0) sourceIds.push(plan.cutsceneWorkflow.waves[0].assetIds[0]);
    for (const sourceId of sourceIds) {
      const master = manifest.assets.find((asset) => asset.asset_id === sourceId); master.generation_state = "generated";
      await mkdir(path.dirname(path.join(artifactRoot, master.output.path)), { recursive: true }); await writeFile(path.join(artifactRoot, master.output.path), validPng());
    }
  }
  const packageValue = actualMasterBinding ? await bindCutscenePromptPackage({ artifactRoot, plan, manifest }) : promptPackage(plan, manifest, waveId); const pricing = pricingSnapshot();
  const assetIds = [...plan.cutsceneWorkflow.waves.find((wave) => wave.id === waveId).assetIds].sort(compare);
  const estimate = estimateCutsceneImageCost({ plan, promptPackage: packageValue, manifest, waveId, pricingSnapshot: pricing, retryReserve, attemptCeilings: assetIds.map((assetId) => ({ assetId, maximumUsd: 0.4 })) });
  const approvalEvent = { eventId: `approve-${waveId}`, actor: "Kim", reviewer: "Kim", decidedAt: "2026-08-13T00:00:00.000Z" };
  const issued = issueCutsceneHumanApproval({ ...approvalEvent, decision: "approved", plan, promptPackage: packageValue, manifest, pricingSnapshot: pricing, estimate });
  const outputPath = path.join(artifactRoot, "unaffected", "storyboard.png"); await mkdir(path.dirname(outputPath), { recursive: true }); await writeFile(outputPath, "unaffected storyboard bytes\n");
  const observations = [{ shotId: "SHOT-01", finding: { kind: "screen-direction", blocking: false }, sourceMasterIds: [plan.cutsceneWorkflow.waves[0].assetIds[0]] }];
  if (completeAll) {
    const evidencePath = "evidence/review.txt"; await mkdir(path.join(artifactRoot, "evidence"), { recursive: true }); await writeFile(path.join(artifactRoot, evidencePath), "human review evidence\n");
    for (const asset of manifest.assets) {
      asset.generation_state = "generated"; asset.approval_state = "production-candidate"; asset.technical_fit = "Fits the cutscene package."; asset.gameplay_readability = "The focal action remains legible."; asset.rights.effective_status = "active";
      asset.reviews = [
        { state: "document-approved", reviewer: "Minji Kim", reviewer_kind: "human", reviewer_role: "visual-reviewer", review_scope: "document-visual", reviewed_at: "2026-08-13T00:00:00.000Z", evidence_paths: [evidencePath], rights_decision: "approved" },
        { state: "production-candidate", reviewer: "Jae Park", reviewer_kind: "human", reviewer_role: "rights-provenance-reviewer", review_scope: "production-rights-provenance", reviewed_at: "2026-08-13T00:01:00.000Z", evidence_paths: [evidencePath], rights_decision: "approved" },
      ];
    }
  }
  const continuityReceipt = reviewCutsceneContinuity({ plan, manifest, observations, reviewedAt: "2026-08-13T00:00:00.000Z" });
  const input = { artifactRoot, waveId, selectedAssetIds: assetIds, attemptState: { failedAttempts: 0, accumulatedUsd: 0 }, plan, manifest, promptPackage: packageValue, pricingSnapshot: pricing, estimate, approvalEvent, receipt: issued.receipt, capability: issued.capability, now: "2026-08-13T00:01:00.000Z", env: {}, apiKey: "sk-local-test", continuityReceipt, waves: plan.cutsceneWorkflow.waves };
  return { artifactRoot, outputPath, input, authority: { receipt: issued.receipt, capability: issued.capability } };
}

export function generationInput(input) {
  const { continuityReceipt: _continuityReceipt, waves: _waves, ...approved } = input;
  return approved;
}

export function generationRuntime(runtime) {
  return { env: runtime.env, fetchFn: runtime.fetchFn, hostGenerate: runtime.hostGenerate, sleepFn: runtime.sleepFn };
}

export function freshAuthority(fixture, { eventId = "approve-cutscene-retry-02", decidedAt = "2026-08-13T00:02:00.000Z" } = {}) {
  const approvalEvent = { ...fixture.input.approvalEvent, eventId, decidedAt };
  const issued = issueCutsceneHumanApproval({ ...approvalEvent, decision: "approved", plan: fixture.input.plan, promptPackage: fixture.input.promptPackage, manifest: fixture.input.manifest, pricingSnapshot: fixture.input.pricingSnapshot, estimate: fixture.input.estimate });
  return { approvalEvent, receipt: issued.receipt, capability: issued.capability };
}

export async function runCutsceneMutationHarness({ name, fixture }) {
  assert.ok(MUTATIONS.includes(name), `unknown mutation: ${name}`);
  const input = structuredClone(fixture.input); const authority = { ...fixture.authority }; const runtime = makeRuntime();
  let error;
  let before;
  try {
    if (name === "approval-authority") authority.capability = {};
    else if (name === "approval-binding" || name === "reference-binding") {
      const master = input.manifest.assets[0]; await writeFile(path.join(fixture.artifactRoot, master.output.path), validPng(2, 2));
      input.promptPackage = await bindCutscenePromptPackage({ artifactRoot: fixture.artifactRoot, plan: input.plan, manifest: input.manifest });
      input.estimate = estimateCutsceneImageCost({ plan: input.plan, promptPackage: input.promptPackage, manifest: input.manifest, waveId: input.waveId, pricingSnapshot: input.pricingSnapshot, retryReserve: input.estimate.retryReserve, attemptCeilings: input.estimate.attemptCeilings.map(({ assetId, maximumUsd }) => ({ assetId, maximumUsd })) });
    }
    else if (name === "stage-selection") input.selectedAssetIds.push("cutscene-escape-storyboard-shot-99");
    else if (name === "cost-cap") {
      let request = 0; const expensiveUsage = { input_tokens: 100_000_000, output_tokens: 4, total_tokens: 100_000_004, input_tokens_details: { text_tokens: 50_000_000, image_tokens: 50_000_000, cached_text_tokens: 0, cached_image_tokens: 0 } };
      const seeded = await runApprovedCutsceneImageWave({ ...generationInput(input), ...authority, ...generationRuntime(makeRuntime({ fetchFn: async () => { request += 1; return imageResponse({ status: 500, requestId: `mutation-cap-${request}`, ...(request === 3 ? { usage: expensiveUsage } : {}) }); } })) });
      const failedAssetIds = [seeded.providerResult.failures[0].asset_id]; const fresh = freshAuthority({ input }); before = await snapshotArtifactTree(fixture.artifactRoot);
      await retryCutsceneFailedAssets({ ...generationInput(input), ...fresh, ...generationRuntime(runtime), failedAssetIds, now: "2026-08-13T00:03:00.000Z" });
    } else if (name === "retry-reserve") {
      let request = 0; const seeded = await runApprovedCutsceneImageWave({ ...generationInput(input), ...authority, ...generationRuntime(makeRuntime({ fetchFn: async () => { request += 1; if (request === 1) return imageResponse({ status: 500, requestId: "mutation-reserve-500" }); if (request === 2) return imageResponse({ requestId: "mutation-reserve-success" }); throw new Error("mutation reserve transport"); } })) });
      const failedAssetIds = [seeded.providerResult.failures[0].asset_id]; const fresh = freshAuthority({ input }); before = await snapshotArtifactTree(fixture.artifactRoot);
      await retryCutsceneFailedAssets({ ...generationInput(input), ...fresh, ...generationRuntime(runtime), failedAssetIds, now: "2026-08-13T00:03:00.000Z" });
    }
    else if (name === "mode-boundary") input.plan.mode = "prompt-only";
    else if (name === "usage-completeness") calculateActualCost({ pricingSnapshot: input.pricingSnapshot, usage: { inputTokens: 8, inputTextTokens: 3, inputImageTokens: 4, outputTokens: 4, totalTokens: 12 } });
    else if (name === "continuity-wave-splice") input.waves = [{ id: "style-master", state: "completed", assetIds: [...input.plan.cutsceneWorkflow.waves[0].assetIds], completion: { kind: "completed", assetIds: [...input.plan.cutsceneWorkflow.waves[0].assetIds] } }];
    else if (name === "continuity-unrelated-manifest") input.manifest.assets[0].asset_id = "unrelated-asset";
    else if (name === "continuity-receipt-stale") input.continuityReceipt.manifestSha256 = "0".repeat(64);
    if (name.startsWith("continuity-")) assertCutsceneContinuityGate({ plan: input.plan, manifest: input.manifest, waves: input.waves, continuityReceipt: input.continuityReceipt });
    else if (!new Set(["cost-cap", "retry-reserve"]).has(name)) await runApprovedCutsceneImageWave({ ...generationInput(input), ...authority, ...generationRuntime(runtime) });
  } catch (caught) { error = caught; }
  if (!error) throw new Error(`${name} unexpectedly completed`);
  before ??= await snapshotArtifactTree(fixture.artifactRoot);
  const after = await snapshotArtifactTree(fixture.artifactRoot);
  const unaffected = createHash("sha256").update(await readFile(fixture.outputPath)).digest("hex");
  return { error: { code: error.code, path: error.path }, providerCalls: runtime.calls.fetch + runtime.calls.host, writeObserved: JSON.stringify(before) !== JSON.stringify(after), artifactTreeBefore: before, artifactTreeAfter: after, unaffectedOutputSha256: unaffected };
}

function harnessError(reason) { const error = new Error("cutscene mutation evidence failed"); error.reason = reason; return error; }
function allowlistedEnvironment(extra = {}) { const env = {}; for (const key of CHILD_ENVIRONMENT_KEYS) if (typeof process.env[key] === "string") env[key] = process.env[key]; return { ...env, ...extra }; }
function terminateTree(child) { try { if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" }); else process.kill(-child.pid, "SIGKILL"); } catch {} try { child.kill("SIGKILL"); } catch {} }

function parseEvidence(text, name) {
  if (!text.endsWith("\n") || text.slice(0, -1).includes("\n")) throw harnessError("evidence-line-count");
  let record;
  try { record = JSON.parse(text); } catch { throw harnessError("evidence-json"); }
  const keys = ["code", "name", "path", "protocol", "providerCalls", "writeObserved"];
  if (!record || typeof record !== "object" || Array.isArray(record) || JSON.stringify(Object.keys(record).sort()) !== JSON.stringify(keys)) throw harnessError("evidence-shape");
  if (record.name !== name || record.protocol !== "fd-json-v1" || typeof record.code !== "string" || typeof record.path !== "string" || record.providerCalls !== 0 || record.writeObserved !== false) throw harnessError("evidence-mismatch");
  return record;
}

export async function launchMutationEvidence(name, { tamper = "normal", orphanPidPath } = {}) {
  if (!MUTATIONS.includes(name)) throw harnessError("unknown-mutation");
  const child = spawn(process.execPath, [fileURLToPath(import.meta.url), name, "--worker", tamper], { cwd: root, env: allowlistedEnvironment(orphanPidPath ? { CUTSCENE_MUTATION_ORPHAN_PID_PATH: orphanPidPath } : {}), detached: process.platform !== "win32", stdio: ["ignore", "pipe", "pipe", "pipe"] });
  const evidence = []; const stdout = []; const stderr = []; let evidenceBytes = 0; let outputBytes = 0;
  return await new Promise((resolve, reject) => {
    let done = false; let closeTimer; let pendingReason;
    const finish = (fn, value) => { if (done) return; done = true; clearTimeout(timer); clearTimeout(closeTimer); fn(value); };
    const fail = (reason) => { if (done || pendingReason) return; pendingReason = reason; terminateTree(child); closeTimer = setTimeout(() => { for (const stream of [child.stdout, child.stderr, child.stdio[3]]) stream?.destroy(); finish(reject, harnessError(reason)); }, CLOSE_TIMEOUT_MS); };
    const timer = setTimeout(() => fail("test-timeout"), TEST_TIMEOUT_MS);
    const collectOutput = (target) => (chunk) => { if (done) return; outputBytes += chunk.byteLength; if (outputBytes > MAX_OUTPUT_BYTES) fail("output-limit"); else target.push(chunk); };
    child.stdout.on("data", collectOutput(stdout)); child.stderr.on("data", collectOutput(stderr));
    child.stdio[3].on("data", (chunk) => { if (done) return; evidenceBytes += chunk.byteLength; if (evidenceBytes > MAX_EVIDENCE_BYTES) fail("evidence-limit"); else evidence.push(chunk); });
    child.once("error", () => fail("test-launch")); child.once("close", (code) => {
      if (done) return;
      if (pendingReason) return finish(reject, harnessError(pendingReason));
      if (code !== 0) return finish(reject, harnessError("test-exit"));
      try { finish(resolve, { code, output: { stdout: Buffer.concat(stdout).toString("utf8"), stderr: Buffer.concat(stderr).toString("utf8") }, evidence: parseEvidence(Buffer.concat(evidence).toString("utf8"), name) }); } catch (error) { finish(reject, error); }
    });
  });
}

if (process.argv[2] && process.argv[3] === "--worker") {
  const fixture = await makeFixture(null, process.argv[2] === "retry-reserve" ? { waveId: "reference-masters", retryReserve: 1, actualMasterBinding: true } : process.argv[2] === "cost-cap" ? { retryReserve: 3 } : ["approval-binding", "reference-binding"].includes(process.argv[2]) ? { actualMasterBinding: true } : undefined);
  const tamper = process.argv[4] ?? "normal";
  try {
    if (tamper === "inside-wrapper-unrelated-error") throw new TypeError("unrelated wrapper error");
    if (tamper === "timeout-orphan" || tamper === "unclosed-evidence-fd") {
      const orphan = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { detached: false, stdio: tamper === "unclosed-evidence-fd" ? ["ignore", "ignore", "ignore", 3] : "ignore" }); orphan.unref();
      if (process.env.CUTSCENE_MUTATION_ORPHAN_PID_PATH) await writeFile(process.env.CUTSCENE_MUTATION_ORPHAN_PID_PATH, `${orphan.pid}\n`);
      if (tamper === "timeout-orphan") await new Promise(() => setInterval(() => {}, 1_000));
    }
    const outcome = await runCutsceneMutationHarness({ name: process.argv[2], fixture });
    assert.equal(outcome.providerCalls, 0); assert.equal(outcome.writeObserved, false); assert.deepEqual(outcome.artifactTreeAfter, outcome.artifactTreeBefore);
    const record = `${JSON.stringify({ name: process.argv[2], code: outcome.error.code, path: outcome.error.path, providerCalls: outcome.providerCalls, writeObserved: outcome.writeObserved, protocol: "fd-json-v1" })}\n`;
    if (tamper === "normal") { process.stdout.write("ignored TAP-like success text\n"); process.stderr.write("ignored stderr text\n"); }
    if (tamper === "oversize-output") process.stdout.write("x".repeat(MAX_OUTPUT_BYTES + 1));
    if (tamper === "forged-stdout-stderr") { process.stdout.write(record); process.stderr.write(record); }
    else if (tamper === "misleading-output") process.stdout.write("PASS: mutation detected\n");
    else if (tamper === "missing-evidence" || tamper === "wrong-env") { /* deliberately no FD record */ }
    const { writeSync } = await import("node:fs");
    if (tamper === "duplicate-evidence") { writeSync(3, record); writeSync(3, record); }
    else if (tamper === "partial-evidence") writeSync(3, '{"partial":');
    else if (tamper === "oversize-evidence") writeSync(3, "x".repeat(MAX_EVIDENCE_BYTES + 1));
    else if (tamper === "unclosed-evidence-fd") { /* inherited FD keeps pipe open */ }
    else if (!new Set(["forged-stdout-stderr", "misleading-output", "missing-evidence", "wrong-env"]).has(tamper)) writeSync(3, record);
  } catch (error) { process.stderr.write(`${JSON.stringify({ code: "cutscene.mutation-evidence-failed", reason: error?.code ?? error?.message })}\n`); process.exitCode = 1; }
  finally { await rm(fixture.artifactRoot, { recursive: true, force: true }); }
}
