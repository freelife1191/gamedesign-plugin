import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rename, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { deflateSync } from "node:zlib";

import { validateImageAssetManifest } from "../../shared/scripts/validate-image-assets.mjs";
import { isRfc3339DateTime } from "../../shared/scripts/lib/rfc3339.mjs";

import {
  canonicalCutsceneDocument,
  cutsceneContinuityManifestSha256,
  cutsceneDocumentSha256,
  deriveCutsceneLifecycle,
  validateCutsceneContinuityReview,
  validateCutsceneCostEstimate,
  validateCutsceneGenerationApproval,
  validateCutsceneGenerationUsage,
  validateCutsceneVisualPlan,
} from "../../shared/scripts/validate-cutscene-visual-preproduction.mjs";
import {
  reviewCutsceneContinuity,
  assertCutsceneContinuityGate,
} from "../../shared/scripts/review-cutscene-continuity.mjs";
import {
  bindCutscenePromptPackage,
  buildVariantOverlay,
  findCutsceneImpact,
  invalidateCutsceneDependents,
  planCutsceneVisualPreproduction,
  validateCutsceneManifestHandoff,
} from "../../shared/scripts/plan-cutscene-visual-preproduction.mjs";
import { planImageAssetWorkflow } from "../../shared/scripts/run-image-asset-workflow.mjs";
import { readSecureReferenceFile } from "../../shared/scripts/lib/image-reference-loader.mjs";
import { buildProduct } from "../../tooling/lib/build-product.mjs";

const SHA = "a".repeat(64);
const WAVES = ["style-master", "reference-masters", "keyframes", "storyboard"];

const taskTwoInput = (overrides = {}) => ({
  cutsceneId: "cutscene-escape",
  mode: "prompt-only",
  beats: [{ beatId: "BEAT-01" }],
  shots: [{ shotId: "SHOT-01", beatId: "BEAT-01" }],
  ...overrides,
});

const generalArtifact = () => ({ artifact_id: "general-artifact", image_needs: [{
  slot_id: "cover", type: "story-storyboard", scene: "A general scene.", subject: "A general subject.", composition: "A wide readable frame.",
  visual_style: "Original illustrative concept art.", readability: "Readable.", width: 1024, height: 1024,
}] });
const generalProfile = () => ({
  profile_id: "general-profile", version: 1, artifact_types: ["design-document"], audiences: ["design"],
  required_sections: [{ id: "visuals", title: "Visuals" }], required_tables: [{ id: "signals", section_id: "visuals", columns: ["Signal"] }],
  required_diagrams: [{ id: "visual-flow", section_id: "visuals", purpose: "Explain flow.", alt_text: "Visual flow." }],
  required_images: [{ id: "cover", section_id: "visuals", purpose: "Explain the artifact.", alt_text: "General cover." }], recommended_images: [],
  length_guidance: { min_words: 1, max_words: 10 }, ppt_story_contract: {}, acceptance_criteria: ["Readable"], export_rules: { required_formats: ["md"], forbidden_formats: [] }, quality_checks: ["visual"],
});

async function patternCatalog() {
  const names = ["base", "character", "skill-vfx", "environment", "ui-icon", "storyboard", "document-illustration"];
  return Object.fromEntries(await Promise.all(names.map(async (name) => [name, JSON.parse(await readFile(new URL(`../../shared/image-assets/prompt-patterns/${name}.json`, import.meta.url), "utf8"))])));
}

const cutsceneManifestFixture = ({
  assetId = "cutscene-escape-style-master-style-01",
  promptSha256 = "2".repeat(64),
  dagSha256 = "3".repeat(64),
  approvalBindingSha256 = "4".repeat(64),
} = {}) => ({
  schema_version: 1,
  assets: [{ asset_id: assetId, prompt_sha256: promptSha256, approval_binding_sha256: approvalBindingSha256 }],
  cutsceneWorkflow: { schemaVersion: 1, dagSha256, waves: [] },
});

async function cutsceneArtifactRoot(t) {
  const root = await mkdtemp(path.join(tmpdir(), "cutscene-plan-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

function validPng() {
  const crc32 = (bytes) => {
    let crc = 0xffffffff;
    for (const byte of bytes) { crc ^= byte; for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); }
    return (crc ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const bytes = Buffer.alloc(12 + data.length);
    bytes.writeUInt32BE(data.length); bytes.write(type, 4, "ascii"); data.copy(bytes, 8); bytes.writeUInt32BE(crc32(bytes.subarray(4, 8 + data.length)), 8 + data.length);
    return bytes;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(1); header.writeUInt32BE(1, 4); header.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", header), chunk("IDAT", deflateSync(Buffer.alloc(5))), chunk("IEND", Buffer.alloc(0))]);
}

function markMasterGenerated(planned) {
  const manifest = structuredClone(planned.manifest);
  const asset = manifest.assets[0];
  asset.generation_state = "generated";
  return { manifest, asset };
}

test("prompt-only has expected references but no invented hashes", () => {
  const { plan, manifest, templatePromptPackage } = planCutsceneVisualPreproduction(taskTwoInput());
  assert.equal(plan.mode, "prompt-only");
  assert.equal(templatePromptPackage.kind, "template-ready");
  assert.equal(templatePromptPackage.references.length > 0 && templatePromptPackage.references.every((reference) => reference.expectedPath && reference.sha256 === undefined), true);
  assert.equal(manifest.assets[0].asset_id, "cutscene-escape-style-master-style-01");
  assert.equal(manifest.assets.every((asset) => asset.mode === undefined && /^[a-f0-9]{64}$/u.test(asset.prompt_sha256) && /^[a-f0-9]{64}$/u.test(asset.approval_binding_sha256)), true);
  assert.deepEqual(validateCutsceneManifestHandoff({ manifest }), manifest);
});

test("plan-image-assets validates cutscene handoff without mutation", () => {
  const manifest = cutsceneManifestFixture();
  assert.deepEqual(validateCutsceneManifestHandoff({ manifest }), manifest);
});

test("planImageAssetWorkflow preserves handed-off manifest bytes and skips general planning", async (t) => {
  const root = await cutsceneArtifactRoot(t);
  const manifest = cutsceneManifestFixture();
  const exact = `${JSON.stringify(manifest, null, 2)}\n`;
  const result = await planImageAssetWorkflow({ artifactRoot: root, artifact: { invalid: true }, qualityProfile: { invalid: true }, cutsceneManifest: manifest });
  assert.deepEqual(result.manifest, manifest);
  assert.equal(await readFile(path.join(root, "assets/image-assets.yml"), "utf8"), exact);
});

test("binding reads current master bytes and invalidation retains unrelated state", async (t) => {
  const root = await cutsceneArtifactRoot(t);
  const planned = planCutsceneVisualPreproduction(taskTwoInput({ mode: "generate-after-approval" }));
  const { manifest, asset } = markMasterGenerated(planned);
  const referenceBytes = validPng();
  await mkdir(path.dirname(path.join(root, asset.output.path)), { recursive: true });
  await writeFile(path.join(root, asset.output.path), referenceBytes);
  const bound = await bindCutscenePromptPackage({ artifactRoot: root, plan: planned.plan, manifest });
  assert.equal(bound.kind, "generation-ready");
  assert.deepEqual(bound.references, [{ assetId: asset.asset_id, sha256: createHash("sha256").update(referenceBytes).digest("hex") }]);
  const plan = structuredClone(planned.plan);
  plan.cutsceneWorkflow.waves[0].attempts = [validUsage({ assetId: plan.cutsceneWorkflow.waves[0].assetIds[0] })];
  const earlier = structuredClone(plan.cutsceneWorkflow.waves[0]);
  const changed = plan.cutsceneWorkflow.waves[1].assetIds[0];
  const impact = findCutsceneImpact({ plan, changedAssetIds: [changed] });
  const invalidated = invalidateCutsceneDependents({ plan, changedAssetIds: [changed], reason: "master-changed" });
  assert.deepEqual(impact.waveIds, ["reference-masters", "keyframes", "storyboard"]);
  assert.deepEqual(invalidated.cutsceneWorkflow.waves[0], earlier);
});

test("variant overlays are pure, closed, and preserve dialogue-only image identity", () => {
  const { plan } = planCutsceneVisualPreproduction(taskTwoInput());
  const original = canonicalCutsceneDocument(plan);
  const dialogue = buildVariantOverlay({
    basePlan: plan,
    triggerState: "QUEST-COMPANION-ABSENT",
    changes: [{ shotId: "SHOT-01", kind: "dialogue", value: "혼자 가야 해." }],
  });
  assert.deepEqual(Object.keys(dialogue).sort(), ["basePlanSha256", "changes", "cutsceneId", "generatedAssetIds", "schemaVersion", "sourceAssetIds", "triggerState"]);
  assert.deepEqual(dialogue.sourceAssetIds, []);
  assert.deepEqual(dialogue.generatedAssetIds, []);
  assert.equal(canonicalCutsceneDocument(plan), original);
  const visual = buildVariantOverlay({
    basePlan: plan,
    triggerState: "QUEST-COMPANION-ABSENT",
    changes: [{ shotId: "SHOT-01", kind: "lighting", value: "moonlit" }],
  });
  assert.equal(visual.generatedAssetIds.length, 1);
  assert.equal(plan.cutsceneWorkflow.waves.flatMap((wave) => wave.assetIds).includes(visual.generatedAssetIds[0]), false);
  assert.throws(() => buildVariantOverlay({ basePlan: plan, triggerState: "safe", changes: [
    { shotId: "SHOT-01", kind: "lighting", value: "day" }, { shotId: "SHOT-01", kind: "lighting", value: "night" },
  ] }));
  const multiVisual = buildVariantOverlay({ basePlan: plan, triggerState: "safe", changes: [
    { shotId: "SHOT-01", kind: "expression", value: "angry" }, { shotId: "SHOT-01", kind: "lighting", value: "night" },
  ] });
  const reordered = buildVariantOverlay({ basePlan: plan, triggerState: "safe", changes: [
    { shotId: "SHOT-01", kind: "lighting", value: "night" }, { shotId: "SHOT-01", kind: "expression", value: "angry" },
  ] });
  assert.equal(multiVisual.generatedAssetIds.length, 1);
  assert.deepEqual(reordered.generatedAssetIds, multiVisual.generatedAssetIds);
  assert.throws(() => buildVariantOverlay({ basePlan: plan, triggerState: "e\u0301", changes: [] }), /canonical/i);
  assert.throws(() => buildVariantOverlay({ basePlan: plan, triggerState: "safe", changes: [{ shotId: "SHOT-01", kind: "unknown", value: "x" }] }));
});

test("impact is seed-exact and invalidation preserves each untouched wave and evidence", () => {
  const { plan } = planCutsceneVisualPreproduction(taskTwoInput({ mode: "generate-after-approval" }));
  const changedAssetId = plan.cutsceneWorkflow.waves[1].assetIds[0];
  const untouched = canonicalCutsceneDocument(plan.cutsceneWorkflow.waves[0]);
  const historical = structuredClone(plan.cutsceneWorkflow.waves[1]);
  historical.state = "completed";
  historical.completion = { kind: "completed", assetIds: [...historical.assetIds] };
  historical.attempts = [validUsage({ assetId: historical.assetIds[0] })];
  plan.cutsceneWorkflow.waves[1] = historical;
  const impact = findCutsceneImpact({ plan, changedAssetIds: [changedAssetId] });
  assert.deepEqual(Object.keys(impact).sort(), ["assetIds", "waveIds"]);
  assert.deepEqual(impact.assetIds, [changedAssetId, ...plan.cutsceneWorkflow.waves[2].assetIds, ...plan.cutsceneWorkflow.waves[3].assetIds]);
  const invalidated = invalidateCutsceneDependents({ plan, changedAssetIds: [changedAssetId] });
  assert.equal(canonicalCutsceneDocument(invalidated.cutsceneWorkflow.waves[0]), untouched);
  assert.deepEqual(invalidated.cutsceneWorkflow.waves[1].attempts, historical.attempts);
  assert.deepEqual(invalidated.cutsceneWorkflow.waves[1].invalidation.affectedAssetIds, [changedAssetId]);
  assert.deepEqual(invalidated.cutsceneWorkflow.waves[2].invalidation.affectedAssetIds, plan.cutsceneWorkflow.waves[2].assetIds);
});

test("multi-seed impact gives a directly changed downstream wave its complete upstream-reached closure", () => {
  const { plan } = planCutsceneVisualPreproduction(taskTwoInput({ mode: "generate-after-approval" }));
  const [styleMaster] = plan.cutsceneWorkflow.waves[0].assetIds;
  const [directReference] = plan.cutsceneWorkflow.waves[1].assetIds;
  const impact = findCutsceneImpact({ plan, changedAssetIds: [styleMaster, directReference] });
  assert.deepEqual(impact.assetIds, [styleMaster, ...plan.cutsceneWorkflow.waves[1].assetIds, ...plan.cutsceneWorkflow.waves[2].assetIds, ...plan.cutsceneWorkflow.waves[3].assetIds]);
});

test("repeated invalidation preserves prior evidence and returns a valid plan", () => {
  const { plan } = planCutsceneVisualPreproduction(taskTwoInput({ mode: "generate-after-approval" }));
  const changed = plan.cutsceneWorkflow.waves[1].assetIds[0];
  const first = invalidateCutsceneDependents({ plan, changedAssetIds: [changed], reason: "first-master-change" });
  const second = invalidateCutsceneDependents({ plan: first, changedAssetIds: [changed], reason: "second-master-change" });
  const wave = second.cutsceneWorkflow.waves[1];
  assert.equal(validateCutsceneVisualPlan(second).ok, true);
  assert.equal(wave.invalidation.reason, "second-master-change");
  assert.deepEqual(wave.invalidationHistory, [{ fromState: "planned", toState: "invalidated", reason: "first-master-change", affectedAssetIds: [changed] }]);
});

test("overlay and continuity review reject hostile descriptors before executing getters", () => {
  const { plan, manifest } = planCutsceneVisualPreproduction(taskTwoInput({ mode: "generate-after-approval" }));
  const changes = [];
  let changeReads = 0;
  Object.defineProperty(changes, "0", { enumerable: true, get() { changeReads += 1; throw new Error("must not run"); } });
  assert.throws(() => buildVariantOverlay({ basePlan: plan, triggerState: "safe", changes }), { code: "cutscene.hostile_input", path: "/changes/0" });
  assert.equal(changeReads, 0);
  const observations = [];
  let observationReads = 0;
  Object.defineProperty(observations, "0", { enumerable: true, get() { observationReads += 1; throw new Error("must not run"); } });
  assert.throws(() => reviewCutsceneContinuity({ plan, manifest, observations, reviewedAt: "2026-08-13T00:00:00.000Z" }), { code: "cutscene.hostile_input", path: "/observations/0" });
  assert.equal(observationReads, 0);
});

test("all public cutscene snapshot boundaries reject transparent proxies without invoking traps", () => {
  const { plan, manifest } = planCutsceneVisualPreproduction(taskTwoInput({ mode: "generate-after-approval" }));
  const transparentProxy = (value) => {
    let traps = 0;
    const count = (operation) => (...args) => { traps += 1; return Reflect[operation](...args); };
    return {
      value: new Proxy(value, {
        get: count("get"),
        getOwnPropertyDescriptor: count("getOwnPropertyDescriptor"),
        getPrototypeOf: count("getPrototypeOf"),
        ownKeys: count("ownKeys"),
      }),
      trapCount: () => traps,
    };
  };
  const inputs = [
    [transparentProxy({ basePlan: plan, triggerState: "safe", changes: [] }), buildVariantOverlay],
    [transparentProxy({ plan, manifest, observations: [], reviewedAt: "2026-08-13T00:00:00.000Z" }), reviewCutsceneContinuity],
    [transparentProxy({ plan, changedAssetIds: [plan.cutsceneWorkflow.waves[0].assetIds[0]] }), findCutsceneImpact],
    [transparentProxy({ plan, changedAssetIds: [plan.cutsceneWorkflow.waves[0].assetIds[0]], reason: "safe" }), invalidateCutsceneDependents],
  ];
  for (const [input, api] of inputs) {
    assert.throws(() => api(input.value), { code: "cutscene.hostile_input", path: "" });
    assert.equal(input.trapCount(), 0);
  }
});

test("impact and invalidation snapshot top-level getters, symbols, and cycles before reading inputs", () => {
  const { plan } = planCutsceneVisualPreproduction(taskTwoInput({ mode: "generate-after-approval" }));
  const changedAssetIds = [plan.cutsceneWorkflow.waves[0].assetIds[0]];
  let planReads = 0;
  const getterInput = { changedAssetIds };
  Object.defineProperty(getterInput, "plan", { enumerable: true, get() { planReads += 1; return plan; } });
  assert.throws(() => findCutsceneImpact(getterInput), { code: "cutscene.hostile_input", path: "/plan" });
  assert.equal(planReads, 0);

  let reasonReads = 0;
  const reasonInput = { plan, changedAssetIds };
  Object.defineProperty(reasonInput, "reason", { enumerable: true, get() { reasonReads += 1; return "safe"; } });
  assert.throws(() => invalidateCutsceneDependents(reasonInput), { code: "cutscene.hostile_input", path: "/reason" });
  assert.equal(reasonReads, 0);

  const symbolInput = { plan, changedAssetIds };
  symbolInput[Symbol.for("cutscene-hostile")] = true;
  assert.throws(() => findCutsceneImpact(symbolInput), { code: "cutscene.hostile_input", path: "/Symbol(cutscene-hostile)" });

  const cyclicInput = { plan, changedAssetIds };
  cyclicInput.self = cyclicInput;
  assert.throws(() => invalidateCutsceneDependents(cyclicInput), { code: "cutscene.hostile_input", path: "/self" });
});

test("binding rejects plan-derived manifest mutations before reference I/O", async (t) => {
  const root = await cutsceneArtifactRoot(t);
  const planned = planCutsceneVisualPreproduction(taskTwoInput({ mode: "generate-after-approval" }));
  for (const mutate of [
    (manifest) => { manifest.assets[0].prompt_sha256 = "0".repeat(64); },
    (manifest) => { manifest.cutsceneWorkflow.dagSha256 = "0".repeat(64); },
    (manifest) => { manifest.cutsceneWorkflow.waves[0].assetIds = ["cutscene-escape-missing"]; },
    (manifest) => { manifest.assets[0].approval_binding_sha256 = "0".repeat(64); },
  ]) {
    const manifest = structuredClone(planned.manifest);
    mutate(manifest);
    await assert.rejects(() => bindCutscenePromptPackage({ artifactRoot: root, plan: planned.plan, manifest }), /Invalid cutscene manifest handoff|plan-derived binding/i);
  }
});

test("binding rejects symlink input and the secure loader detects an identity swap", async (t) => {
  const root = await cutsceneArtifactRoot(t);
  const planned = planCutsceneVisualPreproduction(taskTwoInput({ mode: "generate-after-approval" }));
  const { manifest, asset } = markMasterGenerated(planned);
  const destination = path.join(root, asset.output.path);
  const outside = path.join(root, "outside.png");
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(outside, validPng());
  await symlink(outside, destination);
  await assert.rejects(() => bindCutscenePromptPackage({ artifactRoot: root, plan: planned.plan, manifest }), /unsafe reference/i);
  await rm(destination);
  await writeFile(destination, validPng());
  const pinned = await readSecureReferenceFile({ artifactRoot: root, path: asset.output.path });
  const replacement = path.join(root, "replacement.png");
  await writeFile(replacement, validPng());
  await rename(replacement, destination);
  await assert.rejects(() => pinned.verify(), /reference identity changed/i);
});

test("binding snapshots authority and rejects an alternate artifact-local output path", async (t) => {
  const root = await cutsceneArtifactRoot(t);
  const planned = planCutsceneVisualPreproduction(taskTwoInput({ mode: "generate-after-approval" }));
  const { manifest, asset } = markMasterGenerated(planned);
  const destination = path.join(root, asset.output.path);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, validPng());
  const promise = bindCutscenePromptPackage({ artifactRoot: root, plan: planned.plan, manifest });
  manifest.assets[0].asset_id = "cutscene-escape-mutated-master";
  manifest.assets[0].prompt = "mutated after binding began";
  const bound = await promise;
  assert.equal(bound.references[0].assetId, "cutscene-escape-style-master-style-01");
  assert.equal(bound.prompts[0].assetId, "cutscene-escape-style-master-style-01");

  const alternate = structuredClone(planned.manifest);
  alternate.assets[0].generation_state = "generated";
  alternate.assets[0].output.path = "assets/generated/alternate-master.png";
  await writeFile(path.join(root, alternate.assets[0].output.path), validPng());
  await assert.rejects(() => bindCutscenePromptPackage({ artifactRoot: root, plan: planned.plan, manifest: alternate }), /plan-derived binding/i);
  const source = await readFile(new URL("../../shared/scripts/plan-cutscene-visual-preproduction.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(source, /beforeReferenceVerification/u);
});

test("general image planning remains byte-stable without a cutscene manifest", async (t) => {
  const root = await cutsceneArtifactRoot(t);
  const catalog = await patternCatalog();
  const first = await planImageAssetWorkflow({ artifactRoot: root, artifact: generalArtifact(), qualityProfile: generalProfile(), patternCatalog: catalog });
  const firstPrompts = await Promise.all([readFile(path.join(root, "assets/prompts/image-prompts.md"), "utf8"), readFile(path.join(root, "assets/prompts/image-prompts.json"), "utf8")]);
  const second = await planImageAssetWorkflow({ artifactRoot: root, artifact: generalArtifact(), qualityProfile: generalProfile(), existingManifest: first.manifest, patternCatalog: catalog });
  assert.deepEqual(second.manifest, first.manifest);
  assert.deepEqual(second.summary, first.summary);
  assert.deepEqual(await Promise.all([readFile(path.join(root, "assets/prompts/image-prompts.md"), "utf8"), readFile(path.join(root, "assets/prompts/image-prompts.json"), "utf8")]), firstPrompts);
});

const validCutscenePlan = () => ({
  schemaVersion: 1,
  cutsceneId: "cutscene-escape",
  mode: "prompt-only",
  beats: [{ beatId: "BEAT-01" }],
  shots: [{ shotId: "SHOT-01", beatId: "BEAT-01" }],
  cutsceneWorkflow: {
    schemaVersion: 1,
    waves: WAVES.map((id, index) => ({
      id,
      state: index === 0 ? "template-ready" : "planned",
      assetIds: [`cutscene-escape-${id}-01`],
      estimate: null,
      approval: null,
      attempts: [],
      completion: index === 0 ? { kind: "template-ready", references: [{ assetId: "cutscene-escape-reference-01", expectedPath: "assets/generated/reference-01.png" }] } : null,
      invalidation: null,
      invalidationHistory: [],
    })),
    downstream: [],
    derived: {},
  },
});

const validEstimate = () => ({
  schemaVersion: 2,
  sha256: SHA,
  waveId: "style-master",
  assetIds: ["cutscene-escape-style-master-01"],
  planSha256: SHA,
  pricingSnapshotSha256: SHA,
  retryReserve: 1,
  costStatus: "available",
  attemptCeilings: [{ assetId: "cutscene-escape-style-master-01", requestSha256: SHA, maximumUsd: 0.25 }],
  minimumUsd: 0.25,
  expectedUsd: 0.25,
  maximumUsd: 0.5,
});

const validApproval = () => ({
  schemaVersion: 2,
  eventId: "approve-style-01",
  actor: "Kim",
  reviewer: "Kim",
  decision: "approved",
  decidedAt: "2026-08-13T00:00:00.000Z",
  waveId: "style-master",
  assetIds: ["cutscene-escape-style-master-01"],
  maximumApprovedUsd: 0.5,
  retryReserve: 1,
  planSha256: SHA,
  promptPackageSha256: SHA,
  referenceBindings: [{ assetId: "cutscene-escape-style-master-01", sha256: SHA }],
  pricingSnapshotSha256: SHA,
  costEstimateSha256: SHA,
});

const validUsage = (overrides = {}) => {
  const record = {
  schemaVersion: 2,
  kind: "outcome",
  waveId: "style-master",
  assetId: "cutscene-escape-style-master-01",
  attemptId: "attempt-01",
  attemptSequence: 1,
  assetAttemptOrdinal: 1,
  authorizationSha256: SHA,
  providerRequestId: "request-01",
  providerOutcome: "success",
  assetOutcome: "success",
  retryDisposition: "none",
  usage: { inputTokens: 10, inputTextTokens: 6, inputImageTokens: 4, cachedTextTokens: 1, cachedImageTokens: 2, outputTokens: 8, totalTokens: 18 },
  actualCost: { status: "known", usd: 0.25 },
  completedAt: "2026-08-13T00:01:00.000Z",
  ...overrides,
  };
  return { ...record, sha256: cutsceneDocumentSha256(record) };
};

const validContinuityReview = (overrides = {}) => ({
  schemaVersion: 1,
  cutsceneId: "cutscene-escape",
  planSha256: SHA,
  manifestSha256: SHA,
  reviewedAt: "2026-08-13T00:00:00.000Z",
  findings: [],
  blockingFindingIds: [],
  ...overrides,
});

const currentPlan = () => validCutscenePlan();

function completedPlan() {
  const { plan } = planCutsceneVisualPreproduction(taskTwoInput({ mode: "generate-after-approval" }));
  for (const wave of plan.cutsceneWorkflow.waves) { wave.state = "completed"; wave.completion = { kind: "completed", assetIds: [...wave.assetIds] }; }
  return plan;
}

function currentReceipt(plan, manifestOrOverrides = {}, maybeOverrides = {}) {
  const manifest = Array.isArray(manifestOrOverrides.assets) ? manifestOrOverrides : approvedManifest(plan);
  const overrides = Array.isArray(manifestOrOverrides.assets) ? maybeOverrides : manifestOrOverrides;
  return validContinuityReview({ planSha256: cutsceneDocumentSha256(plan), manifestSha256: cutsceneContinuityManifestSha256(manifest), ...overrides });
}

function approvedManifest(plan = completedPlan()) {
  const { manifest } = planCutsceneVisualPreproduction(taskTwoInput({ mode: "generate-after-approval" }));
  const dagSha256 = cutsceneDocumentSha256(plan.cutsceneWorkflow.downstream);
  const planSha256 = cutsceneDocumentSha256(plan);
  for (const asset of manifest.assets) {
    asset.generation_state = "generated";
    asset.approval_state = "production-candidate";
    asset.technical_fit = "Fits the cutscene package.";
    asset.gameplay_readability = "The focal action remains legible.";
    asset.rights.effective_status = "active";
    asset.reviews = [
      { state: "document-approved", reviewer: "Minji Kim", reviewer_kind: "human", reviewer_role: "visual-reviewer", review_scope: "document-visual", reviewed_at: "2026-08-13T00:00:00.000Z", evidence_paths: ["evidence.yml"], rights_decision: "approved" },
      { state: "production-candidate", reviewer: "Jae Park", reviewer_kind: "human", reviewer_role: "rights-provenance-reviewer", review_scope: "production-rights-provenance", reviewed_at: "2026-08-13T00:01:00.000Z", evidence_paths: ["evidence.yml"], rights_decision: "approved" },
    ];
    asset.approval_binding_sha256 = cutsceneDocumentSha256({ assetId: asset.asset_id, dagSha256, planSha256, promptSha256: asset.prompt_sha256 });
  }
  return manifest;
}

const schemaKeywords = new Set(["$schema", "$id", "$defs", "$ref", "type", "const", "enum", "required", "additionalProperties", "properties", "items", "contains", "minContains", "maxContains", "pattern", "minLength", "minItems", "maxItems", "uniqueItems", "minimum", "exclusiveMinimum", "maximum", "allOf", "anyOf", "oneOf", "not", "if", "then", "else", "format"]);
const schemaType = (value, type) => type === "null" ? value === null : type === "object" ? value !== null && typeof value === "object" && !Array.isArray(value) : type === "array" ? Array.isArray(value) : type === "string" ? typeof value === "string" : type === "integer" ? Number.isInteger(value) : type === "number" ? typeof value === "number" && Number.isFinite(value) : type === "boolean" ? typeof value === "boolean" : false;
const schemaStructuralJson = (value) => value === null || typeof value !== "object" ? JSON.stringify(value) : Array.isArray(value) ? `[${value.map(schemaStructuralJson).join(",")}]` : `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${schemaStructuralJson(value[key])}`).join(",")}}`;

function resolveSchemaReference(reference, rootSchema, schemas) {
  if (typeof reference !== "string") return null;
  if (reference.startsWith("#/")) return { rootSchema, schema: reference.slice(2).split("/").reduce((current, key) => current?.[key], rootSchema) };
  const external = schemas.get(reference);
  return external === undefined ? null : { rootSchema: external, schema: external };
}

function schemaPreflight(rootSchema, schemas, schema = rootSchema, seen = new Set()) {
  if (typeof schema === "boolean") return true;
  if (schema === null || typeof schema !== "object" || seen.has(schema) || Object.keys(schema).some((key) => !schemaKeywords.has(key))) return false;
  seen.add(schema);
  const nested = [];
  if (schema.$ref) { const resolved = resolveSchemaReference(schema.$ref, rootSchema, schemas); if (!resolved || !schemaPreflight(resolved.rootSchema, schemas, resolved.schema, seen)) { seen.delete(schema); return false; } }
  if (schema.$defs) nested.push(...Object.values(schema.$defs));
  if (schema.properties) nested.push(...Object.values(schema.properties));
  if (schema.items !== undefined) nested.push(schema.items);
  if (schema.contains !== undefined) nested.push(schema.contains);
  if (schema.additionalProperties && typeof schema.additionalProperties === "object") nested.push(schema.additionalProperties);
  for (const key of ["allOf", "anyOf", "oneOf"]) if (schema[key]) { if (!Array.isArray(schema[key])) return false; nested.push(...schema[key]); }
  for (const key of ["not", "if", "then", "else"]) if (schema[key] !== undefined) nested.push(schema[key]);
  const accepted = nested.every((child) => schemaPreflight(rootSchema, schemas, child, seen));
  seen.delete(schema);
  return accepted;
}

function schemaAccepts(value, rootSchema, schemas, schema = rootSchema, preflight = true) {
  if (preflight && !schemaPreflight(rootSchema, schemas)) return false;
  if (typeof schema === "boolean") return schema;
  if (schema === null || typeof schema !== "object" || Object.keys(schema).some((key) => !schemaKeywords.has(key))) return false;
  if (schema.$ref) {
    if (Object.keys(schema).some((key) => !["$ref", "$schema", "$id"].includes(key))) return false;
    const resolved = resolveSchemaReference(schema.$ref, rootSchema, schemas);
    return resolved === null || resolved.schema === undefined ? false : schemaAccepts(value, resolved.rootSchema, schemas, resolved.schema, false);
  }
  if (Object.hasOwn(schema, "const") && !Object.is(value, schema.const)) return false;
  if (schema.enum && (!Array.isArray(schema.enum) || !schema.enum.some((candidate) => Object.is(candidate, value)))) return false;
  if (schema.type !== undefined) { const types = Array.isArray(schema.type) ? schema.type : [schema.type]; if (!types.some((type) => schemaType(value, type))) return false; }
  if (schema.minimum !== undefined && typeof value === "number" && value < schema.minimum) return false;
  if (schema.exclusiveMinimum !== undefined && typeof value === "number" && value <= schema.exclusiveMinimum) return false;
  if (schema.maximum !== undefined && typeof value === "number" && value > schema.maximum) return false;
  if (schema.minLength !== undefined && (typeof value !== "string" || value.length < schema.minLength)) return false;
  if (schema.pattern !== undefined && (typeof value !== "string" || !new RegExp(schema.pattern, "u").test(value))) return false;
  if (schema.format !== undefined && (schema.format !== "date-time" || !isRfc3339DateTime(value))) return false;
  if (schema.allOf && (!Array.isArray(schema.allOf) || !schema.allOf.every((part) => schemaAccepts(value, rootSchema, schemas, part)))) return false;
  if (schema.anyOf && (!Array.isArray(schema.anyOf) || !schema.anyOf.some((part) => schemaAccepts(value, rootSchema, schemas, part)))) return false;
  if (schema.oneOf && (!Array.isArray(schema.oneOf) || schema.oneOf.filter((part) => schemaAccepts(value, rootSchema, schemas, part)).length !== 1)) return false;
  if (schema.not && schemaAccepts(value, rootSchema, schemas, schema.not)) return false;
  if (schema.if) { const branch = schemaAccepts(value, rootSchema, schemas, schema.if) ? schema.then : schema.else; if (branch !== undefined && !schemaAccepts(value, rootSchema, schemas, branch)) return false; }
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    if (schema.required && (!Array.isArray(schema.required) || schema.required.some((key) => !Object.hasOwn(value, key)))) return false;
    for (const [key, child] of Object.entries(value)) {
      const property = schema.properties?.[key];
      if (property !== undefined) { if (!schemaAccepts(child, rootSchema, schemas, property, false)) return false; }
      else if (schema.additionalProperties === false) return false;
      else if (schema.additionalProperties !== undefined && !schemaAccepts(child, rootSchema, schemas, schema.additionalProperties, false)) return false;
    }
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems || schema.maxItems !== undefined && value.length > schema.maxItems) return false;
    if (schema.uniqueItems && new Set(value.map(schemaStructuralJson)).size !== value.length) return false;
    if (schema.items !== undefined && !value.every((item) => schemaAccepts(item, rootSchema, schemas, schema.items, false))) return false;
    if (schema.contains !== undefined) {
      const minContains = schema.minContains ?? 1;
      const maxContains = schema.maxContains;
      if (!Number.isInteger(minContains) || minContains < 0 || maxContains !== undefined && (!Number.isInteger(maxContains) || maxContains < minContains)) return false;
      const matches = value.filter((item) => schemaAccepts(item, rootSchema, schemas, schema.contains, false)).length;
      if (matches < minContains || maxContains !== undefined && matches > maxContains) return false;
    }
  }
  return true;
}

async function cutsceneSchemas() {
  const names = ["cutscene-visual-plan", "cutscene-cost-estimate", "cutscene-generation-approval", "cutscene-generation-usage", "cutscene-continuity-review"];
  const entries = await Promise.all(names.map(async (name) => [name, JSON.parse(await readFile(new URL(`../../shared/image-assets/schema/${name}.schema.json`, import.meta.url), "utf8"))]));
  const byFile = new Map(entries.map(([, schema]) => [schema.$id.split("/").at(-1), schema]));
  return { byName: new Map(entries), byFile };
}

function firstError(result) {
  return result.errors[0];
}

test("four waves own authority and root state is derived", () => {
  const plan = validCutscenePlan();
  assert.deepEqual(plan.cutsceneWorkflow.waves.map(({ id }) => id), WAVES);
  plan.state = "generation-approved";
  assert.deepEqual(firstError(validateCutsceneVisualPlan(plan)), { code: "cutscene.root_state_forbidden", path: "/state" });
  const wave = validCutscenePlan();
  delete wave.cutsceneWorkflow.waves[0].state;
  assert.deepEqual(firstError(validateCutsceneVisualPlan(wave)), { code: "cutscene.wave_state_required", path: "/cutsceneWorkflow/waves/0/state" });
});

test("plan validation rejects open root and wave shapes, a manifest asset mode, and incorrect wave order", () => {
  const openRoot = validCutscenePlan();
  openRoot.unrelated = true;
  assert.deepEqual(firstError(validateCutsceneVisualPlan(openRoot)), { code: "cutscene.unknown_key", path: "/unrelated" });
  const openWave = validCutscenePlan();
  openWave.cutsceneWorkflow.waves[0].unexpected = true;
  assert.deepEqual(firstError(validateCutsceneVisualPlan(openWave)), { code: "cutscene.wave_unknown_key", path: "/cutsceneWorkflow/waves/0/unexpected" });
  const assetMode = validCutscenePlan();
  assetMode.assets = [{ assetId: "cutscene-escape-style-master-01", mode: "prompt-only" }];
  assert.deepEqual(firstError(validateCutsceneVisualPlan(assetMode)), { code: "cutscene.manifest_asset_mode_forbidden", path: "/assets/0/mode" });
  const wrongOrder = validCutscenePlan();
  [wrongOrder.cutsceneWorkflow.waves[0], wrongOrder.cutsceneWorkflow.waves[1]] = [wrongOrder.cutsceneWorkflow.waves[1], wrongOrder.cutsceneWorkflow.waves[0]];
  assert.deepEqual(firstError(validateCutsceneVisualPlan(wrongOrder)), { code: "cutscene.wave_order_invalid", path: "/cutsceneWorkflow/waves/0/id" });
});

test("plan validation requires nonempty sorted unique IDs and a valid forward DAG", () => {
  const empty = validCutscenePlan();
  empty.cutsceneWorkflow.waves[0].assetIds = [];
  assert.deepEqual(firstError(validateCutsceneVisualPlan(empty)), { code: "cutscene.wave_asset_ids_empty", path: "/cutsceneWorkflow/waves/0/assetIds" });
  const duplicate = validCutscenePlan();
  duplicate.cutsceneWorkflow.waves[0].assetIds = ["cutscene-escape-style-master-02", "cutscene-escape-style-master-01", "cutscene-escape-style-master-01"];
  assert.deepEqual(firstError(validateCutsceneVisualPlan(duplicate)), { code: "cutscene.ids_unsorted_or_duplicate", path: "/cutsceneWorkflow/waves/0/assetIds" });
  const dangling = validCutscenePlan();
  dangling.cutsceneWorkflow.downstream = [{ fromWaveId: "style-master", toWaveId: "missing" }];
  assert.deepEqual(firstError(validateCutsceneVisualPlan(dangling)), { code: "cutscene.dag_reference_unknown", path: "/cutsceneWorkflow/downstream/0/toWaveId" });
  const backward = validCutscenePlan();
  backward.cutsceneWorkflow.downstream = [{ fromWaveId: "keyframes", toWaveId: "reference-masters" }];
  assert.deepEqual(firstError(validateCutsceneVisualPlan(backward)), { code: "cutscene.dag_not_forward", path: "/cutsceneWorkflow/downstream/0/toWaveId" });
});

test("prompt bindings distinguish templates without hashes from generation-ready current hashes", () => {
  const template = validCutscenePlan();
  template.cutsceneWorkflow.waves[0].completion = { kind: "template-ready", references: [{ assetId: "cutscene-escape-reference-01", expectedPath: "assets/generated/reference-01.png" }] };
  assert.equal(validateCutsceneVisualPlan(template).ok, true);
  const invented = structuredClone(template);
  invented.cutsceneWorkflow.waves[0].completion.references[0].sha256 = SHA;
  assert.deepEqual(firstError(validateCutsceneVisualPlan(invented)), { code: "cutscene.template_hash_forbidden", path: "/cutsceneWorkflow/waves/0/completion/references/0/sha256" });
  const bound = validCutscenePlan();
  bound.mode = "estimate-only";
  bound.cutsceneWorkflow.waves[0].state = "generation-ready";
  bound.cutsceneWorkflow.waves[0].completion = { kind: "generation-ready", references: [{ assetId: "cutscene-escape-reference-01", sha256: SHA }] };
  assert.equal(validateCutsceneVisualPlan(bound).ok, true);
  delete bound.cutsceneWorkflow.waves[0].completion.references[0].sha256;
  assert.deepEqual(firstError(validateCutsceneVisualPlan(bound)), { code: "cutscene.bound_hash_required", path: "/cutsceneWorkflow/waves/0/completion/references/0/sha256" });
});

test("five closed document contracts reject malformed derived binding and usage data", () => {
  assert.equal(validateCutsceneCostEstimate(validEstimate()).ok, true);
  const estimate = validEstimate(); estimate.maximumUsd = 0.1;
  assert.deepEqual(firstError(validateCutsceneCostEstimate(estimate)), { code: "cutscene.cost_range_invalid", path: "/maximumUsd" });
  assert.equal(validateCutsceneGenerationApproval(validApproval()).ok, true);
  const approval = validApproval(); approval.referenceBindings = [];
  assert.deepEqual(firstError(validateCutsceneGenerationApproval(approval)), { code: "cutscene.reference_bindings_empty", path: "/referenceBindings" });
  assert.equal(validateCutsceneGenerationUsage(validUsage()).ok, true);
  const usage = validUsage(); usage.usage.inputTokens = 9; usage.sha256 = cutsceneDocumentSha256(Object.fromEntries(Object.entries(usage).filter(([key]) => key !== "sha256")));
  assert.deepEqual(firstError(validateCutsceneGenerationUsage(usage)), { code: "cutscene.usage_input_mismatch", path: "/usage/inputTokens" });
  assert.equal(validateCutsceneContinuityReview(validContinuityReview()).ok, true);
  const review = validContinuityReview(); review.blockingFindingIds = ["missing-finding"];
  assert.deepEqual(firstError(validateCutsceneContinuityReview(review)), { code: "cutscene.blocker_set_mismatch", path: "/blockingFindingIds" });
});

test("canonical cutscene documents are deterministic and reject non-plain hidden state", () => {
  assert.equal(canonicalCutsceneDocument({ b: 1, a: [true, null] }), '{"a":[true,null],"b":1}');
  assert.equal(cutsceneDocumentSha256({ b: 1, a: [true, null] }), cutsceneDocumentSha256({ a: [true, null], b: 1 }));
  const withHiddenState = { value: "safe" };
  Object.defineProperty(withHiddenState, "hidden", { value: "not canonical" });
  assert.throws(() => canonicalCutsceneDocument(withHiddenState));
});

test("continuity review is canonical, source-bound, and excludes later human review fields from its manifest digest", () => {
  const { plan, manifest } = planCutsceneVisualPreproduction(taskTwoInput({ mode: "generate-after-approval" }));
  const sourceMasterId = plan.cutsceneWorkflow.waves[0].assetIds[0];
  const review = reviewCutsceneContinuity({
    plan,
    manifest,
    reviewedAt: "2026-08-13T00:00:00.000Z",
    observations: [{ shotId: "SHOT-01", finding: { kind: "screen-direction", blocking: true }, sourceMasterIds: [sourceMasterId] }],
  });
  assert.equal(validateCutsceneContinuityReview(review).ok, true);
  assert.deepEqual(review.findings[0], {
    findingId: "continuity-shot-01-screen-direction", code: "continuity.screen-direction", path: "/shots/0",
    sourceMasterIds: [sourceMasterId], affectedAssetIds: [plan.cutsceneWorkflow.waves[3].assetIds[0]], blocking: true,
  });
  const laterHumanReview = structuredClone(manifest);
  laterHumanReview.assets[0].reviews = [{ reviewer: "human" }];
  assert.equal(cutsceneContinuityManifestSha256(laterHumanReview), review.manifestSha256);
  const stale = structuredClone(manifest);
  stale.assets[0].provider.model = "other-model";
  assert.notEqual(cutsceneContinuityManifestSha256(stale), review.manifestSha256);
  const retried = structuredClone(manifest);
  retried.assets[0].generation_receipts = [{ receipt_id: "attempt-02" }];
  assert.notEqual(cutsceneContinuityManifestSha256(retried), review.manifestSha256);
  const forged = structuredClone(manifest);
  forged.assets[0].prompt = "forged prompt";
  assert.throws(() => reviewCutsceneContinuity({ plan, manifest: forged, reviewedAt: "2026-08-13T00:00:00.000Z", observations: [] }));
  assert.throws(() => reviewCutsceneContinuity({ plan, manifest, reviewedAt: "2026-08-13T00:00:00.000Z", observations: [{ shotId: "SHOT-01", finding: { kind: "lighting", blocking: false }, sourceMasterIds: ["cutscene-escape-storyboard-shot-01"] }] }));
  const referenceMasterId = plan.cutsceneWorkflow.waves[1].assetIds[0];
  assert.throws(() => reviewCutsceneContinuity({ plan, manifest, reviewedAt: "2026-08-13T00:00:00.000Z", observations: [
    { shotId: "SHOT-01", finding: { kind: "lighting", blocking: false }, sourceMasterIds: [sourceMasterId] },
    { shotId: "SHOT-01", finding: { kind: "lighting", blocking: false }, sourceMasterIds: [referenceMasterId] },
  ] }));
});

test("continuity gate rejects lifecycle and manifest splice exploits with deterministic currentness", () => {
  const plan = completedPlan();
  const manifest = approvedManifest(plan);
  const receipt = reviewCutsceneContinuity({ plan, manifest, reviewedAt: "2026-08-13T00:00:00.000Z", observations: [] });
  assert.doesNotThrow(() => assertCutsceneContinuityGate({ plan, manifest, waves: plan.cutsceneWorkflow.waves, continuityReceipt: receipt }));
  const splicedWaves = structuredClone(plan.cutsceneWorkflow.waves);
  splicedWaves[0].state = "approval-pending";
  assert.throws(() => assertCutsceneContinuityGate({ plan, manifest, waves: splicedWaves, continuityReceipt: receipt }), { code: "cutscene.waves_stale", path: "/waves" });
  const promptStale = structuredClone(manifest);
  promptStale.assets[0].prompt_sha256 = "0".repeat(64);
  assert.throws(() => assertCutsceneContinuityGate({ plan, manifest: promptStale, waves: plan.cutsceneWorkflow.waves, continuityReceipt: receipt }), { code: "cutscene.manifest_stale", path: "/manifest" });
  const approvalStale = structuredClone(manifest);
  approvalStale.assets[0].approval_binding_sha256 = "0".repeat(64);
  assert.throws(() => assertCutsceneContinuityGate({ plan, manifest: approvalStale, waves: plan.cutsceneWorkflow.waves, continuityReceipt: receipt }), { code: "cutscene.manifest_stale", path: "/manifest" });
  const differingOutput = structuredClone(manifest);
  differingOutput.assets[0].output.width = 768;
  differingOutput.assets[0].output.height = 768;
  differingOutput.assets[0].output.aspect_ratio = "1:1";
  const changedReceipt = reviewCutsceneContinuity({ plan, manifest: differingOutput, reviewedAt: "2026-08-13T00:00:00.000Z", observations: [] });
  assert.doesNotThrow(() => assertCutsceneContinuityGate({ plan, manifest: differingOutput, waves: plan.cutsceneWorkflow.waves, continuityReceipt: changedReceipt }));
  const wrongCutscene = structuredClone(receipt);
  wrongCutscene.cutsceneId = "cutscene-other";
  assert.throws(() => assertCutsceneContinuityGate({ plan, manifest, waves: plan.cutsceneWorkflow.waves, continuityReceipt: wrongCutscene }), { code: "cutscene.continuity_cutscene_stale", path: "/continuityReceipt/cutsceneId" });
  assert.equal(deriveCutsceneLifecycle({ plan, manifest, waves: plan.cutsceneWorkflow.waves, continuityReceipt: wrongCutscene }).productionCandidate, false);
});

test("completed waves require exact completion asset sets in runtime and gate", () => {
  const plan = completedPlan();
  plan.cutsceneWorkflow.waves[1].completion = { kind: "completed", assetIds: [plan.cutsceneWorkflow.waves[1].assetIds[0]] };
  assert.equal(validateCutsceneVisualPlan(plan).ok, false);
});

test("derived lifecycle refuses completed waves spliced onto a current partial plan", () => {
  const { plan } = planCutsceneVisualPreproduction(taskTwoInput({ mode: "generate-after-approval" }));
  const manifest = approvedManifest(plan);
  const receipt = currentReceipt(plan, manifest);
  const spliced = structuredClone(plan.cutsceneWorkflow.waves);
  for (const wave of spliced) { wave.state = "completed"; wave.completion = null; }
  assert.equal(deriveCutsceneLifecycle({ plan, manifest, waves: spliced, continuityReceipt: receipt }).documentApproved, false);
});

test("derived root approval uses existing asset lifecycle, current receipt, and blockers only", () => {
  const plan = completedPlan();
  const candidate = {
    plan, manifest: approvedManifest(),
    waves: plan.cutsceneWorkflow.waves,
    continuityReceipt: currentReceipt(plan),
  };
  assert.deepEqual(deriveCutsceneLifecycle(candidate), {
    lifecycle: "completed",
    documentApproved: true,
    productionCandidate: true,
    blockerIds: [],
  });
  const blocked = structuredClone(candidate);
  blocked.continuityReceipt = currentReceipt(plan, { findings: [{ findingId: "screen-direction", code: "continuity.break", path: "/shots/0", sourceMasterIds: ["cutscene-escape-style-master-01"], affectedAssetIds: ["cutscene-escape-style-master-01"], blocking: true }], blockingFindingIds: ["screen-direction"] });
  assert.deepEqual(deriveCutsceneLifecycle(blocked), {
    lifecycle: "blocked",
    documentApproved: false,
    productionCandidate: false,
    blockerIds: ["screen-direction"],
  });
  const noReceipt = structuredClone(candidate);
  noReceipt.continuityReceipt.planSha256 = "b".repeat(64);
  assert.deepEqual(deriveCutsceneLifecycle(noReceipt), {
    lifecycle: "completed",
    documentApproved: false,
    productionCandidate: false,
    blockerIds: [],
  });
});

test("lifecycle fails closed for incomplete image manifests, stale receipts, and blocker-set mismatch", () => {
  const plan = completedPlan();
  const input = { plan, manifest: approvedManifest(), waves: plan.cutsceneWorkflow.waves, continuityReceipt: currentReceipt(plan) };
  assert.equal(validateImageAssetManifest(input.manifest).ok, true);
  assert.equal(deriveCutsceneLifecycle(input).documentApproved, true);
  const incompleteManifest = structuredClone(input); incompleteManifest.manifest.assets[0].reviews = [];
  assert.equal(deriveCutsceneLifecycle(incompleteManifest).documentApproved, false);
  const staleReceipt = structuredClone(input); staleReceipt.continuityReceipt.planSha256 = "b".repeat(64);
  assert.equal(deriveCutsceneLifecycle(staleReceipt).productionCandidate, false);
  const mismatch = structuredClone(input); mismatch.continuityReceipt.findings = [{ findingId: "screen-direction", code: "continuity.break", path: "/shots/0", sourceMasterIds: ["cutscene-escape-style-master-01"], affectedAssetIds: ["cutscene-escape-style-master-01"], blocking: true }];
  assert.equal(deriveCutsceneLifecycle(mismatch).documentApproved, false);
});

test("lifecycle hashes the actual plan and never authorizes a caller-provided hash field", () => {
  const plan = completedPlan();
  const receipt = currentReceipt(plan);
  assert.equal(deriveCutsceneLifecycle({ plan, manifest: approvedManifest(), waves: plan.cutsceneWorkflow.waves, continuityReceipt: receipt }).documentApproved, true);
  const forged = structuredClone(plan);
  forged.sha256 = receipt.planSha256;
  assert.equal(deriveCutsceneLifecycle({ plan: forged, manifest: approvedManifest(), waves: forged.cutsceneWorkflow.waves, continuityReceipt: receipt }).documentApproved, false);
  assert.equal(deriveCutsceneLifecycle({ manifest: approvedManifest(), waves: plan.cutsceneWorkflow.waves, continuityReceipt: receipt }).documentApproved, false);
});

test("state evidence is closed, mode-bound, and records only permitted invalidated-to-cost re-entry", () => {
  const missingTemplate = validCutscenePlan();
  missingTemplate.cutsceneWorkflow.waves[0].completion = null;
  assert.deepEqual(firstError(validateCutsceneVisualPlan(missingTemplate)), { code: "cutscene.completion_required", path: "/cutsceneWorkflow/waves/0/completion" });
  const illegalDispatch = validCutscenePlan();
  illegalDispatch.cutsceneWorkflow.waves[0].state = "dispatching";
  illegalDispatch.cutsceneWorkflow.waves[0].attempts = [validUsage()];
  assert.deepEqual(firstError(validateCutsceneVisualPlan(illegalDispatch)), { code: "cutscene.mode_state_forbidden", path: "/cutsceneWorkflow/waves/0/state" });
  const nestedUnknown = validCutscenePlan();
  nestedUnknown.cutsceneWorkflow.waves[0].completion = { kind: "template-ready", references: [{ assetId: "cutscene-escape-reference-01", expectedPath: "assets/generated/reference-01.png", injected: true }] };
  assert.deepEqual(firstError(validateCutsceneVisualPlan(nestedUnknown)), { code: "cutscene.template_reference_unknown_key", path: "/cutsceneWorkflow/waves/0/completion/references/0/injected" });
  const reentry = validCutscenePlan();
  reentry.mode = "estimate-only";
  reentry.cutsceneWorkflow.waves[0].state = "cost-estimated";
  reentry.cutsceneWorkflow.waves[0].estimate = validEstimate();
  reentry.cutsceneWorkflow.waves[0].completion = null;
  reentry.cutsceneWorkflow.waves[0].invalidation = { fromState: "invalidated", toState: "cost-estimated", reason: "master-changed", affectedAssetIds: ["cutscene-escape-style-master-01"] };
  assert.equal(validateCutsceneVisualPlan(reentry).ok, true);
  reentry.cutsceneWorkflow.waves[0].invalidation.toState = "approved";
  assert.deepEqual(firstError(validateCutsceneVisualPlan(reentry)), { code: "cutscene.transition_invalid", path: "/cutsceneWorkflow/waves/0/invalidation/toState" });
});

test("runtime and packaged JSON Schema agree on valid and rejected closed fixtures", async () => {
  const { byName, byFile } = await cutsceneSchemas();
  const templatePlan = validCutscenePlan();
  templatePlan.cutsceneWorkflow.waves[0].completion = { kind: "template-ready", references: [{ assetId: "cutscene-escape-reference-01", expectedPath: "assets/generated/reference-01.png" }] };
  const cases = [
    ["cutscene-visual-plan", templatePlan, validateCutsceneVisualPlan, true],
    ["cutscene-cost-estimate", validEstimate(), validateCutsceneCostEstimate, true],
    ["cutscene-generation-approval", validApproval(), validateCutsceneGenerationApproval, true],
    ["cutscene-generation-usage", validUsage(), validateCutsceneGenerationUsage, true],
    ["cutscene-continuity-review", validContinuityReview(), validateCutsceneContinuityReview, true],
  ];
  const unavailableEstimate = validEstimate();
  unavailableEstimate.costStatus = "unavailable";
  unavailableEstimate.attemptCeilings[0].maximumUsd = null;
  unavailableEstimate.minimumUsd = null;
  unavailableEstimate.expectedUsd = null;
  unavailableEstimate.maximumUsd = null;
  cases.push(["cutscene-cost-estimate", unavailableEstimate, validateCutsceneCostEstimate, true]);
  const invalidPlan = structuredClone(templatePlan); invalidPlan.cutsceneWorkflow.derived = { documentApproved: true };
  cases.push(["cutscene-visual-plan", invalidPlan, validateCutsceneVisualPlan, false]);
  const incompatibleCompletion = structuredClone(templatePlan); incompatibleCompletion.cutsceneWorkflow.waves[0].state = "planned";
  cases.push(["cutscene-visual-plan", incompatibleCompletion, validateCutsceneVisualPlan, false]);
  const illegalModeDispatch = structuredClone(templatePlan); illegalModeDispatch.cutsceneWorkflow.waves[0].state = "dispatching"; illegalModeDispatch.cutsceneWorkflow.waves[0].completion = null;
  cases.push(["cutscene-visual-plan", illegalModeDispatch, validateCutsceneVisualPlan, false]);
  const invalidUsage = validUsage(); invalidUsage.unknown = true;
  cases.push(["cutscene-generation-usage", invalidUsage, validateCutsceneGenerationUsage, false]);
  const availableWithoutCeiling = validEstimate(); availableWithoutCeiling.attemptCeilings[0].maximumUsd = null;
  cases.push(["cutscene-cost-estimate", availableWithoutCeiling, validateCutsceneCostEstimate, false]);
  const unavailableWithoutCeiling = validEstimate(); unavailableWithoutCeiling.costStatus = "unavailable"; unavailableWithoutCeiling.minimumUsd = null; unavailableWithoutCeiling.expectedUsd = null; unavailableWithoutCeiling.maximumUsd = null;
  cases.push(["cutscene-cost-estimate", unavailableWithoutCeiling, validateCutsceneCostEstimate, false]);
  const contradictoryOutcome = validUsage({ providerOutcome: "not-called" });
  cases.push(["cutscene-generation-usage", contradictoryOutcome, validateCutsceneGenerationUsage, false]);
  const hostileNotCalledUsage = validUsage({
    usage: { status: "unavailable", reason: "provider-not-called" },
    actualCost: { status: "unavailable", reason: "provider-usage-unavailable" },
  });
  cases.push(["cutscene-generation-usage", hostileNotCalledUsage, validateCutsceneGenerationUsage, false]);
  const normalNotCalledUsage = validUsage({
    providerOutcome: "not-called",
    assetOutcome: "not-attempted",
    usage: { status: "unavailable", reason: "provider-not-called" },
    actualCost: { status: "known", usd: 0 },
  });
  cases.push(["cutscene-generation-usage", normalNotCalledUsage, validateCutsceneGenerationUsage, true]);
  const unavailableUsage = validUsage({ usage: { status: "unavailable", reason: "provider-usage-invalid" }, actualCost: { status: "unavailable", reason: "provider-usage-invalid" } });
  cases.push(["cutscene-generation-usage", unavailableUsage, validateCutsceneGenerationUsage, true]);
  const mismatchedUnavailableUsage = structuredClone(unavailableUsage); mismatchedUnavailableUsage.actualCost.reason = "provider-usage-unavailable"; mismatchedUnavailableUsage.sha256 = cutsceneDocumentSha256(Object.fromEntries(Object.entries(mismatchedUnavailableUsage).filter(([key]) => key !== "sha256")));
  cases.push(["cutscene-generation-usage", mismatchedUnavailableUsage, validateCutsceneGenerationUsage, false]);
  for (const [name, value, validate, expected] of cases) {
    assert.equal(validate(value).ok, expected, `${name} runtime`);
    assert.equal(schemaAccepts(value, byName.get(name), byFile), expected, `${name} schema`);
  }
  const crossArrayOnly = validContinuityReview(); crossArrayOnly.findings = [{ findingId: "screen-direction", code: "continuity.break", path: "/shots/0", sourceMasterIds: ["cutscene-escape-style-master-01"], affectedAssetIds: ["cutscene-escape-style-master-01"], blocking: true }];
  assert.equal(validateCutsceneContinuityReview(crossArrayOnly).ok, false, "runtime enforces blocker-set identity beyond JSON Schema vocabulary");
  assert.equal(schemaAccepts(crossArrayOnly, byName.get("cutscene-continuity-review"), byFile), true, "packaged JSON Schema still validates its expressible structural contract");
});

test("temporary Studio and Career builds preserve exact cutscene plan, usage, and continuity schema bytes", async (t) => {
  const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
  for (const schemaName of ["cutscene-visual-plan.schema.json", "cutscene-generation-usage.schema.json", "cutscene-continuity-review.schema.json"]) for (const productName of ["game-design-studio", "game-design-career"]) {
    const source = await readFile(new URL(`../../shared/image-assets/schema/${schemaName}`, import.meta.url));
    const stagingRoot = await mkdtemp(path.join(tmpdir(), `cutscene-${productName}-`));
    t.after(() => rm(stagingRoot, { recursive: true, force: true }));
    const build = await buildProduct({ repoRoot, productName, stagingRoot, sourceDateEpoch: 0 });
    const packaged = await readFile(path.join(build.outputDir, "references/shared/image-assets/schema", schemaName));
    assert.deepEqual(packaged, source, `${productName}:${schemaName}`);
  }
});

test("schema evaluator fails closed for unsupported keywords, dates, and references", () => {
  assert.equal(schemaAccepts("x", { type: "string", unsupported: true }, new Map()), false);
  assert.equal(schemaAccepts("2026-02-30T00:00:00.000Z", { type: "string", format: "date-time" }, new Map()), false);
  assert.equal(schemaAccepts("x", { $ref: "missing.schema.json" }, new Map()), false);
  assert.equal(schemaAccepts(null, { type: ["string", "null"] }, new Map()), true);
});

test("schema evaluator preflights unused properties, definitions, and both conditional branches", () => {
  assert.equal(schemaAccepts({ used: "safe" }, { type: "object", properties: { used: { type: "string" }, unused: { unsupported: true } } }, new Map()), false);
  assert.equal(schemaAccepts({ mode: "selected" }, { type: "object", properties: { mode: { const: "selected" } }, $defs: { unreachable: { $ref: "missing.schema.json" } } }, new Map()), false);
  assert.equal(schemaAccepts({ mode: "selected" }, { type: "object", properties: { mode: { const: "selected" } }, if: { properties: { mode: { const: "selected" } } }, then: { type: "object" }, else: { unsupported: true } }, new Map()), false);
});

test("continuity findings reject structural duplicates independent of object key order in runtime and schema", async () => {
  const first = { findingId: "non-blocking", code: "continuity.note", path: "/shots/0", sourceMasterIds: ["cutscene-escape-style-master-01"], affectedAssetIds: ["cutscene-escape-style-master-01"], blocking: false };
  const second = { blocking: false, affectedAssetIds: ["cutscene-escape-style-master-01"], sourceMasterIds: ["cutscene-escape-style-master-01"], path: "/shots/0", code: "continuity.note", findingId: "non-blocking" };
  const review = validContinuityReview({ findings: [first, second] });
  const { byName, byFile } = await cutsceneSchemas();
  assert.equal(validateCutsceneContinuityReview(review).ok, false);
  assert.equal(schemaAccepts(review, byName.get("cutscene-continuity-review"), byFile), false);
});

test("continuity findings validate closed JSON-compatible shape before canonical duplicate keys", () => {
  const malformedFindings = [
    undefined,
    null,
    Symbol("finding"),
    Number.NaN,
    {},
    { findingId: "non-blocking", code: Symbol("code"), path: "/shots/0", sourceMasterIds: ["cutscene-escape-style-master-01"], affectedAssetIds: ["cutscene-escape-style-master-01"], blocking: false },
    { findingId: "non-blocking", code: "continuity.note", path: Number.NaN, sourceMasterIds: ["cutscene-escape-style-master-01"], affectedAssetIds: ["cutscene-escape-style-master-01"], blocking: false },
    { findingId: "non-blocking", code: "continuity.note", path: "/shots/0", sourceMasterIds: [Symbol("master")], affectedAssetIds: ["cutscene-escape-style-master-01"], blocking: false },
  ];
  for (const finding of malformedFindings) {
    const review = validContinuityReview({ findings: [finding] });
    let result;
    assert.doesNotThrow(() => { result = validateCutsceneContinuityReview(review); });
    assert.equal(result.ok, false);
    assert.deepEqual(validateCutsceneContinuityReview(review), result);
  }
});

test("lifecycle fails closed when continuity findings contain safe malformed runtime values", () => {
  const plan = completedPlan();
  const base = { plan, manifest: approvedManifest(), waves: plan.cutsceneWorkflow.waves };
  for (const finding of [undefined, null, Symbol("finding"), Number.NaN, { findingId: "incomplete" }]) {
    const continuityReceipt = currentReceipt(plan, { findings: [finding] });
    let result;
    assert.doesNotThrow(() => { result = deriveCutsceneLifecycle({ ...base, continuityReceipt }); });
    assert.deepEqual(result, { lifecycle: "completed", documentApproved: false, productionCandidate: false, blockerIds: [] });
  }
});

test("every expressible ID, collection, closed-shape, and timestamp rule has schema/runtime parity", async () => {
  const { byName, byFile } = await cutsceneSchemas();
  const cases = [
    ["cutscene-visual-plan", () => { const value = validCutscenePlan(); value.cutsceneId = "UPPER"; return value; }, validateCutsceneVisualPlan],
    ["cutscene-cost-estimate", () => { const value = validEstimate(); value.assetIds = []; return value; }, validateCutsceneCostEstimate],
    ["cutscene-cost-estimate", () => { const value = validEstimate(); value.assetIds = ["cutscene-escape-style-master-01", "cutscene-escape-style-master-01"]; return value; }, validateCutsceneCostEstimate],
    ["cutscene-generation-approval", () => { const value = validApproval(); value.assetIds = ["UPPER"]; return value; }, validateCutsceneGenerationApproval],
    ["cutscene-generation-approval", () => { const value = validApproval(); value.decidedAt = "not-a-date"; return value; }, validateCutsceneGenerationApproval],
    ["cutscene-generation-usage", () => { const value = validUsage(); value.assetId = "UPPER"; return value; }, validateCutsceneGenerationUsage],
    ["cutscene-generation-usage", () => validUsage({ attemptId: "invalid attempt" }), validateCutsceneGenerationUsage],
    ["cutscene-generation-usage", () => { const value = validUsage(); value.providerRequestId = ""; return value; }, validateCutsceneGenerationUsage],
    ["cutscene-continuity-review", () => { const value = validContinuityReview(); value.reviewedAt = "2026-02-30T00:00:00.000Z"; return value; }, validateCutsceneContinuityReview],
    ["cutscene-continuity-review", () => { const value = validContinuityReview(); value.unknown = true; return value; }, validateCutsceneContinuityReview],
  ];
  for (const [name, create, validate] of cases) { const value = create(); assert.equal(validate(value).ok, false, `${name} runtime`); assert.equal(schemaAccepts(value, byName.get(name), byFile), false, `${name} schema`); }
});

test("canonical documents reject accessor arrays before observing their values", () => {
  const values = ["first"];
  let reads = 0;
  Object.defineProperty(values, "0", { enumerable: true, get() { reads += 1; return reads === 1 ? "first" : "second"; } });
  assert.throws(() => canonicalCutsceneDocument(values));
  assert.equal(reads, 0);
});

test("runtime validators reject hostile accessor input without executing it", () => {
  const plan = validCutscenePlan();
  let reads = 0;
  Object.defineProperty(plan.beats, "0", { enumerable: true, get() { reads += 1; throw new Error("must not execute"); } });
  assert.deepEqual(firstError(validateCutsceneVisualPlan(plan)), { code: "cutscene.hostile_input", path: "" });
  assert.equal(reads, 0);
});

test("malformed IDs and hostile Proxy input return deterministic errors without TypeError", () => {
  for (const assetIds of [[1, 2], ["cutscene-escape-style-master-01", {}]]) {
    const estimate = validEstimate(); estimate.assetIds = assetIds;
    assert.doesNotThrow(() => validateCutsceneCostEstimate(estimate));
    assert.equal(validateCutsceneCostEstimate(estimate).ok, false);
  }
  const proxy = new Proxy(validCutscenePlan(), { ownKeys() { throw new Error("hostile"); } });
  assert.deepEqual(firstError(validateCutsceneVisualPlan(proxy)), { code: "cutscene.hostile_input", path: "" });
});

test("every sorted comparison rejects malformed beat, shot, reference, blocker, and DAG IDs without TypeError", () => {
  const plans = [];
  const beats = validCutscenePlan(); beats.beats = [{ beatId: 1 }, { beatId: 2 }]; plans.push(beats);
  const shots = validCutscenePlan(); shots.shots = [{ shotId: 1, beatId: "BEAT-01" }, { shotId: 2, beatId: "BEAT-01" }]; plans.push(shots);
  const dag = validCutscenePlan(); dag.cutsceneWorkflow.downstream = [{ fromWaveId: 1, toWaveId: "reference-masters" }]; plans.push(dag);
  for (const plan of plans) { assert.doesNotThrow(() => validateCutsceneVisualPlan(plan)); assert.equal(validateCutsceneVisualPlan(plan).ok, false); }
  const approval = validApproval(); approval.referenceBindings = [{ assetId: 1, sha256: SHA }, { assetId: 2, sha256: SHA }];
  assert.doesNotThrow(() => validateCutsceneGenerationApproval(approval)); assert.equal(validateCutsceneGenerationApproval(approval).ok, false);
  const review = validContinuityReview({ blockingFindingIds: [1, 2] });
  assert.doesNotThrow(() => validateCutsceneContinuityReview(review)); assert.equal(validateCutsceneContinuityReview(review).ok, false);
  const malformedFindings = validContinuityReview({ findings: [
    { findingId: 1, code: "continuity.note", path: "/shots/0", sourceMasterIds: ["cutscene-escape-style-master-01"], affectedAssetIds: ["cutscene-escape-style-master-01"], blocking: true },
    { findingId: 2, code: "continuity.note", path: "/shots/1", sourceMasterIds: ["cutscene-escape-style-master-01"], affectedAssetIds: ["cutscene-escape-style-master-01"], blocking: true },
  ], blockingFindingIds: [] });
  assert.doesNotThrow(() => validateCutsceneContinuityReview(malformedFindings)); assert.equal(validateCutsceneContinuityReview(malformedFindings).ok, false);
});

test("programmer errors inside the validator are not swallowed as input errors", async (t) => {
  const source = await readFile(new URL("../../shared/scripts/validate-cutscene-visual-preproduction.mjs", import.meta.url), "utf8");
  const root = await mkdtemp(path.join(tmpdir(), "cutscene-validator-mutation-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const filename = path.join(root, "validate-cutscene-visual-preproduction.mjs");
  const imageValidator = new URL("../../shared/scripts/validate-image-assets.mjs", import.meta.url).href;
  const rfc3339 = new URL("../../shared/scripts/lib/rfc3339.mjs", import.meta.url).href;
  const mutated = source.replace('from "./validate-image-assets.mjs"', `from ${JSON.stringify(imageValidator)}`).replace('from "./lib/rfc3339.mjs"', `from ${JSON.stringify(rfc3339)}`).replace("function validateCost(value, issue) {", "function validateCost(value, issue) { throw new Error(\"intentional programmer error\");");
  await writeFile(filename, mutated);
  const api = await import(`${pathToFileURL(filename).href}?mutation=1`);
  assert.throws(() => api.validateCutsceneCostEstimate(validEstimate()), /intentional programmer error/u);
});
