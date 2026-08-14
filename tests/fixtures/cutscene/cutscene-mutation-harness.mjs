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
import { planCutsceneVisualPreproduction } from "../../../shared/scripts/plan-cutscene-visual-preproduction.mjs";
import { reviewCutsceneContinuity } from "../../../shared/scripts/review-cutscene-continuity.mjs";
import { retryCutsceneFailedAssets, runApprovedCutsceneImageWave } from "../../../shared/scripts/run-approved-cutscene-image-stage.mjs";
import { assertCutsceneContinuityGate, cutsceneDocumentSha256 } from "../../../shared/scripts/validate-cutscene-visual-preproduction.mjs";

const root = fileURLToPath(new URL("../../..", import.meta.url));
const SHA = "3".repeat(64);
const compare = (left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right));
const digest = (value) => cutsceneDocumentSha256(value);

export const MUTATIONS = [
  "approval-authority", "approval-binding", "reference-binding", "stage-selection", "cost-cap", "retry-reserve", "mode-boundary", "usage-completeness", "continuity-wave-splice", "continuity-unrelated-manifest", "continuity-receipt-stale",
];

function validPng(width = 1, height = 1) {
  const crc32 = (bytes) => { let crc = 0xffffffff; for (const byte of bytes) { crc ^= byte; for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); } return (crc ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const bytes = Buffer.alloc(12 + data.length); bytes.writeUInt32BE(data.length); bytes.write(type, 4, "ascii"); data.copy(bytes, 8); bytes.writeUInt32BE(crc32(bytes.subarray(4, 8 + data.length)), 8 + data.length); return bytes; };
  const header = Buffer.alloc(13); header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", header), chunk("IDAT", deflateSync(Buffer.alloc(height * (width * 4 + 1)))), chunk("IEND", Buffer.alloc(0))]);
}

export function imageResponse({ status = 200, requestId = "req-cutscene", usage } = {}) {
  const body = status >= 200 && status < 300
    ? { data: [{ b64_json: validPng(1024, 1024).toString("base64") }], usage: usage ?? { input_tokens: 8, output_tokens: 4, total_tokens: 12, input_tokens_details: { text_tokens: 3, image_tokens: 5, cached_text_tokens: 0, cached_image_tokens: 0 } } }
    : { error: { type: "server_error" } };
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

function promptPackage(plan, manifest) {
  const ids = plan.cutsceneWorkflow.waves.flatMap((wave) => wave.assetIds);
  const assets = new Map(manifest.assets.map((asset) => [asset.asset_id, asset]));
  const value = {
    kind: "generation-ready", cutsceneId: plan.cutsceneId, planSha256: digest(plan), dagSha256: digest(plan.cutsceneWorkflow.downstream),
    references: [{ assetId: ids[0], sha256: SHA }, { assetId: ids[1], sha256: "4".repeat(64) }],
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

export async function makeFixture(t, { waveId = "style-master", retryReserve = 1, completeAll = false } = {}) {
  const artifactRoot = await mkdtemp(path.join(tmpdir(), "cutscene-e2e-"));
  if (t?.after) t.after(() => rm(artifactRoot, { recursive: true, force: true }));
  const planned = planCutsceneVisualPreproduction({ cutsceneId: "cutscene-escape", mode: "generate-after-approval", beats: [{ beatId: "BEAT-01" }], shots: [{ shotId: "SHOT-01", beatId: "BEAT-01" }] });
  const plan = structuredClone(planned.plan); markPredecessorsCompleted(plan, waveId);
  if (completeAll) for (const wave of plan.cutsceneWorkflow.waves) { wave.state = "completed"; wave.completion = { kind: "completed", assetIds: [...wave.assetIds] }; }
  const manifest = bindManifest(plan, structuredClone(planned.manifest));
  const packageValue = promptPackage(plan, manifest); const pricing = pricingSnapshot();
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

function expectedMutation(name) {
  return {
    "approval-authority": { code: "cutscene.approval_capability_invalid", path: "/capability" },
    "approval-binding": { code: "cutscene.plan_invalid", path: "/plan" },
    "reference-binding": { code: "cutscene.prompt_package_invalid", path: "/promptPackage/promptPackageSha256" },
    "stage-selection": { code: "cutscene.selected_asset_ids_invalid", path: "/selectedAssetIds" },
    "cost-cap": { code: "cutscene.cost_estimate_invalid", path: "/estimate/sha256" },
    "retry-reserve": { code: "cutscene.cost_estimate_invalid", path: "/estimate/sha256" },
    "mode-boundary": { code: "cutscene.mode_generation_forbidden", path: "/mode" },
    "usage-completeness": { code: "cutscene.usage_input_mismatch", path: "/inputTokens" },
    "continuity-wave-splice": { code: "cutscene.waves_stale", path: "/waves" },
    "continuity-unrelated-manifest": { code: "cutscene.manifest_stale", path: "/manifest" },
    "continuity-receipt-stale": { code: "cutscene.continuity_manifest_stale", path: "/continuityReceipt/manifestSha256" },
  }[name];
}

export async function runCutsceneMutationHarness({ name, fixture }) {
  assert.ok(MUTATIONS.includes(name), `unknown mutation: ${name}`);
  const input = structuredClone(fixture.input); const authority = { ...fixture.authority }; const runtime = makeRuntime();
  let error;
  const before = await snapshotArtifactTree(fixture.artifactRoot);
  try {
    if (name === "approval-authority") authority.capability = {};
    else if (name === "approval-binding") input.plan.beats[0].beatId = "BEAT-99";
    else if (name === "reference-binding") input.promptPackage.references[0].sha256 = "0".repeat(64);
    else if (name === "stage-selection") input.selectedAssetIds.push("cutscene-escape-storyboard-shot-99");
    else if (name === "cost-cap") input.estimate.maximumUsd = 0;
    else if (name === "retry-reserve") { input.estimate.retryReserve = 0; }
    else if (name === "mode-boundary") input.plan.mode = "prompt-only";
    else if (name === "usage-completeness") calculateActualCost({ pricingSnapshot: input.pricingSnapshot, usage: { inputTokens: 8, inputTextTokens: 3, inputImageTokens: 4, outputTokens: 4, totalTokens: 12 } });
    else if (name === "continuity-wave-splice") input.waves = [{ id: "style-master", state: "completed", assetIds: [...input.plan.cutsceneWorkflow.waves[0].assetIds], completion: { kind: "completed", assetIds: [...input.plan.cutsceneWorkflow.waves[0].assetIds] } }];
    else if (name === "continuity-unrelated-manifest") input.manifest.assets[0].asset_id = "unrelated-asset";
    else if (name === "continuity-receipt-stale") input.continuityReceipt.manifestSha256 = "0".repeat(64);
    if (name.startsWith("continuity-")) assertCutsceneContinuityGate({ plan: input.plan, manifest: input.manifest, waves: input.waves, continuityReceipt: input.continuityReceipt });
    else await runApprovedCutsceneImageWave({ ...generationInput(input), ...authority, ...generationRuntime(runtime) });
  } catch (caught) { error = caught; }
  if (!error) throw new Error(`${name} unexpectedly completed`);
  const after = await snapshotArtifactTree(fixture.artifactRoot);
  const unaffected = createHash("sha256").update(await readFile(fixture.outputPath)).digest("hex");
  return { error: { code: error.code, path: error.path }, expected: expectedMutation(name), providerCalls: runtime.calls.fetch + runtime.calls.host, writeObserved: JSON.stringify(before) !== JSON.stringify(after), artifactTreeBefore: before, artifactTreeAfter: after, unaffectedOutputSha256: unaffected };
}

function allowlistedEnvironment() { const env = {}; for (const key of ["PATH", "TMPDIR", "TEMP", "TMP", "LANG", "LC_ALL", "HOME"]) if (typeof process.env[key] === "string") env[key] = process.env[key]; return env; }
function terminateTree(child) { try { if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" }); else process.kill(-child.pid, "SIGKILL"); } catch {} try { child.kill("SIGKILL"); } catch {} }

export async function launchMutationEvidence(name) {
  const child = spawn(process.execPath, [new URL(import.meta.url).pathname, name, "--worker"], { cwd: root, env: allowlistedEnvironment(), detached: process.platform !== "win32", stdio: ["ignore", "pipe", "pipe", "pipe"] });
  const evidence = []; const output = []; let evidenceBytes = 0; let outputBytes = 0;
  return await new Promise((resolve, reject) => {
    let done = false; const finish = (fn, value) => { if (done) return; done = true; clearTimeout(timer); fn(value); };
    const fail = (reason) => { terminateTree(child); finish(reject, Object.assign(new Error(reason), { reason })); };
    const timer = setTimeout(() => fail("timeout"), 15_000);
    const collect = (target, limit, count) => (chunk) => { if (done) return; if (count === "e") evidenceBytes += chunk.byteLength; else outputBytes += chunk.byteLength; if ((count === "e" ? evidenceBytes : outputBytes) > limit) fail(`${count}-limit`); else target.push(chunk); };
    child.stdout.on("data", collect(output, 64 * 1024, "o")); child.stderr.on("data", collect(output, 64 * 1024, "o")); child.stdio[3].on("data", collect(evidence, 4 * 1024, "e"));
    child.once("error", () => fail("launch")); child.once("close", (code) => finish(resolve, { code, output: Buffer.concat(output).toString("utf8"), evidence: Buffer.concat(evidence).toString("utf8") }));
  });
}

if (process.argv[2] && process.argv[3] === "--worker") {
  const fixture = await makeFixture(null);
  try {
    const outcome = await runCutsceneMutationHarness({ name: process.argv[2], fixture });
    assert.deepEqual(outcome.error, outcome.expected); assert.equal(outcome.providerCalls, 0); assert.equal(outcome.writeObserved, false); assert.deepEqual(outcome.artifactTreeAfter, outcome.artifactTreeBefore);
    process.stdout.write("ignored TAP-like success text\n");
    process.stderr.write("ignored stderr text\n");
    process.write ? undefined : undefined;
    process.stderr; // retain an explicit non-evidence channel boundary.
    const { writeSync } = await import("node:fs");
    writeSync(3, `${JSON.stringify({ name: process.argv[2], code: outcome.error.code, path: outcome.error.path, providerCalls: outcome.providerCalls, writeObserved: outcome.writeObserved, protocol: "fd-json-v1" })}\n`);
  } catch (error) { process.stderr.write(`${JSON.stringify({ code: "cutscene.mutation-evidence-failed", reason: error?.code ?? error?.message })}\n`); process.exitCode = 1; }
  finally { await rm(fixture.artifactRoot, { recursive: true, force: true }); }
}
