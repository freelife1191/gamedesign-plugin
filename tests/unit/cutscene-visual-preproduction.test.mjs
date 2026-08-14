import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import { validateImageAssetManifest } from "../../shared/scripts/validate-image-assets.mjs";

import {
  canonicalCutsceneDocument,
  cutsceneDocumentSha256,
  deriveCutsceneLifecycle,
  validateCutsceneContinuityReview,
  validateCutsceneCostEstimate,
  validateCutsceneGenerationApproval,
  validateCutsceneGenerationUsage,
  validateCutsceneVisualPlan,
} from "../../shared/scripts/validate-cutscene-visual-preproduction.mjs";

const SHA = "a".repeat(64);
const WAVES = ["style-master", "reference-masters", "keyframes", "storyboard"];

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
    })),
    downstream: [],
    derived: {},
  },
});

const validEstimate = () => ({
  schemaVersion: 1,
  sha256: SHA,
  waveId: "style-master",
  assetIds: ["cutscene-escape-style-master-01"],
  planSha256: SHA,
  pricingSnapshotSha256: SHA,
  retryReserve: 1,
  minimumUsd: 0.25,
  expectedUsd: 0.5,
  maximumUsd: 0.75,
});

const validApproval = () => ({
  schemaVersion: 1,
  eventId: "approve-style-01",
  actor: "Kim",
  reviewer: "Kim",
  decision: "approved",
  decidedAt: "2026-08-13T00:00:00.000Z",
  waveId: "style-master",
  assetIds: ["cutscene-escape-style-master-01"],
  maximumApprovedUsd: 0.75,
  retryReserve: 1,
  planSha256: SHA,
  promptPackageSha256: SHA,
  referenceBindings: [{ assetId: "cutscene-escape-style-master-01", sha256: SHA }],
  pricingSnapshotSha256: SHA,
  costEstimateSha256: SHA,
});

const validUsage = () => ({
  schemaVersion: 1,
  waveId: "style-master",
  assetId: "cutscene-escape-style-master-01",
  attemptId: "attempt-01",
  providerRequestId: "request-01",
  inputTokens: 10,
  inputTextTokens: 6,
  inputImageTokens: 4,
  cachedTextTokens: 1,
  cachedImageTokens: 2,
  outputTokens: 8,
  totalTokens: 18,
});

const validContinuityReview = () => ({
  schemaVersion: 1,
  cutsceneId: "cutscene-escape",
  planSha256: SHA,
  reviewedAt: "2026-08-13T00:00:00.000Z",
  findings: [],
  blockingFindingIds: [],
});

const currentPlan = () => ({ sha256: SHA });

function approvedManifest() {
  return {
    schema_version: 1,
    assets: [{
      asset_id: "cutscene-escape-style-master-01", type: "story-storyboard", requirement: "required", generation_state: "generated", approval_state: "production-candidate",
      planning: { upstream_slot_id: "cutscene-escape", disposition: "active", target_output: { path: "assets/generated/cutscene-escape-style-master-01.png", width: 1024, height: 1024, aspect_ratio: "1:1", format: "png", background: "opaque" } },
      purpose: "Locks the cutscene visual style.", placement: { document_slot: "section", source_section: "content.md#cutscene" }, alt_text: "A cutscene style master.", readability: "Clear at storyboard size.",
      art_brief: { subject: "Escaping heroes.", visual_style: "Painterly fantasy.", composition: "Wide shot.", preserve: ["silhouette"], exclude: ["text"] }, prompt: "Painterly fantasy cutscene style master.",
      output: { path: "assets/generated/cutscene-escape-style-master-01.png", width: 1024, height: 1024, aspect_ratio: "1:1", format: "png", background: "opaque" }, provider: { name: "openai-images", model: "gpt-image-2", quality: "low" },
      rights: { provenance: "AI-generated.", rights_holder: "Game Design Team", license: "internal-production-use", effective_status: "active" },
      reviews: [
        { state: "document-approved", reviewer: "Minji Kim", reviewer_kind: "human", reviewer_role: "visual-reviewer", review_scope: "document-visual", reviewed_at: "2026-08-13T00:00:00.000Z", evidence_paths: ["evidence.yml"], rights_decision: "approved" },
        { state: "production-candidate", reviewer: "Jae Park", reviewer_kind: "human", reviewer_role: "rights-provenance-reviewer", review_scope: "production-rights-provenance", reviewed_at: "2026-08-13T00:01:00.000Z", evidence_paths: ["evidence.yml"], rights_decision: "approved" },
      ], technical_fit: "Fits the storyboard package.", gameplay_readability: "The focal action remains legible.",
    }],
  };
}

function schemaAccepts(value, rootSchema, schemas, schema = rootSchema) {
  if (schema.$ref) return schemaAccepts(value, rootSchema, schemas, schema.$ref.startsWith("#/")
    ? schema.$ref.slice(2).split("/").reduce((current, key) => current[key], rootSchema)
    : schemas.get(schema.$ref));
  if (Object.hasOwn(schema, "const") && value !== schema.const) return false;
  if (schema.enum && !schema.enum.includes(value)) return false;
  if (schema.not && schemaAccepts(value, rootSchema, schemas, schema.not)) return false;
  if (schema.allOf && !schema.allOf.every((part) => schemaAccepts(value, rootSchema, schemas, part))) return false;
  if (schema.anyOf && !schema.anyOf.some((part) => schemaAccepts(value, rootSchema, schemas, part))) return false;
  if (schema.oneOf && schema.oneOf.filter((part) => schemaAccepts(value, rootSchema, schemas, part)).length !== 1) return false;
  if (schema.if && schemaAccepts(value, rootSchema, schemas, schema.if) && schema.then && !schemaAccepts(value, rootSchema, schemas, schema.then)) return false;
  const types = schema.type === undefined ? undefined : Array.isArray(schema.type) ? schema.type : [schema.type];
  if (types?.includes("object") || schema.properties || schema.required || schema.additionalProperties !== undefined) {
    if (value === null || typeof value !== "object" || Array.isArray(value) || (types && !types.includes("object"))) return false;
    if ((schema.required ?? []).some((key) => !Object.hasOwn(value, key))) return false;
    if (schema.additionalProperties === false && Object.keys(value).some((key) => !Object.hasOwn(schema.properties ?? {}, key))) return false;
    return Object.entries(value).every(([key, child]) => !schema.properties?.[key] || schemaAccepts(child, rootSchema, schemas, schema.properties[key]));
  }
  if (types?.includes("array") || schema.items || schema.minItems !== undefined) {
    if (!Array.isArray(value) || value.length < (schema.minItems ?? 0) || (schema.maxItems !== undefined && value.length > schema.maxItems)) return false;
    if (schema.uniqueItems && new Set(value.map((item) => JSON.stringify(item))).size !== value.length) return false;
    return !schema.items || value.every((item) => schemaAccepts(item, rootSchema, schemas, schema.items));
  }
  if (types?.includes("string")) return typeof value === "string" && value.length >= (schema.minLength ?? 0) && (!schema.pattern || new RegExp(schema.pattern, "u").test(value));
  if (types?.includes("integer")) return Number.isInteger(value) && value >= (schema.minimum ?? Number.NEGATIVE_INFINITY);
  if (types?.includes("number")) return typeof value === "number" && Number.isFinite(value) && value >= (schema.minimum ?? Number.NEGATIVE_INFINITY);
  if (types?.includes("boolean")) return typeof value === "boolean";
  if (types?.includes("null")) return value === null;
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
  const usage = validUsage(); usage.inputTokens = 9;
  assert.deepEqual(firstError(validateCutsceneGenerationUsage(usage)), { code: "cutscene.usage_input_mismatch", path: "/inputTokens" });
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

test("derived root approval uses existing asset lifecycle, current receipt, and blockers only", () => {
  const candidate = {
    plan: currentPlan(), manifest: approvedManifest(),
    waves: [{ id: "storyboard", state: "completed" }],
    continuityReceipt: validContinuityReview(),
  };
  assert.deepEqual(deriveCutsceneLifecycle(candidate), {
    lifecycle: "completed",
    documentApproved: true,
    productionCandidate: true,
    blockerIds: [],
  });
  const blocked = structuredClone(candidate);
  blocked.continuityReceipt.blockingFindingIds = ["screen-direction"];
  assert.deepEqual(deriveCutsceneLifecycle(blocked), {
    lifecycle: "completed",
    documentApproved: false,
    productionCandidate: false,
    blockerIds: [],
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
  const input = { plan: currentPlan(), manifest: approvedManifest(), waves: [], continuityReceipt: validContinuityReview() };
  assert.equal(validateImageAssetManifest(input.manifest).ok, true);
  assert.equal(deriveCutsceneLifecycle(input).documentApproved, true);
  const incompleteManifest = structuredClone(input); incompleteManifest.manifest.assets[0].reviews = [];
  assert.equal(deriveCutsceneLifecycle(incompleteManifest).documentApproved, false);
  const staleReceipt = structuredClone(input); staleReceipt.continuityReceipt.planSha256 = "b".repeat(64);
  assert.equal(deriveCutsceneLifecycle(staleReceipt).productionCandidate, false);
  const mismatch = structuredClone(input); mismatch.continuityReceipt.findings = [{ findingId: "screen-direction", code: "continuity.break", path: "/shots/0", sourceMasterIds: ["cutscene-escape-style-master-01"], affectedAssetIds: ["cutscene-escape-style-master-01"], blocking: true }];
  assert.equal(deriveCutsceneLifecycle(mismatch).documentApproved, false);
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
  const invalidPlan = structuredClone(templatePlan); invalidPlan.cutsceneWorkflow.derived = { documentApproved: true };
  cases.push(["cutscene-visual-plan", invalidPlan, validateCutsceneVisualPlan, false]);
  const incompatibleCompletion = structuredClone(templatePlan); incompatibleCompletion.cutsceneWorkflow.waves[0].state = "planned";
  cases.push(["cutscene-visual-plan", incompatibleCompletion, validateCutsceneVisualPlan, false]);
  const illegalModeDispatch = structuredClone(templatePlan); illegalModeDispatch.cutsceneWorkflow.waves[0].state = "dispatching"; illegalModeDispatch.cutsceneWorkflow.waves[0].completion = null;
  cases.push(["cutscene-visual-plan", illegalModeDispatch, validateCutsceneVisualPlan, false]);
  const invalidUsage = validUsage(); invalidUsage.unknown = true;
  cases.push(["cutscene-generation-usage", invalidUsage, validateCutsceneGenerationUsage, false]);
  for (const [name, value, validate, expected] of cases) {
    assert.equal(validate(value).ok, expected, `${name} runtime`);
    assert.equal(schemaAccepts(value, byName.get(name), byFile), expected, `${name} schema`);
  }
  const crossArrayOnly = validContinuityReview(); crossArrayOnly.findings = [{ findingId: "screen-direction", code: "continuity.break", path: "/shots/0", sourceMasterIds: ["cutscene-escape-style-master-01"], affectedAssetIds: ["cutscene-escape-style-master-01"], blocking: true }];
  assert.equal(validateCutsceneContinuityReview(crossArrayOnly).ok, false, "runtime enforces blocker-set identity beyond JSON Schema vocabulary");
  assert.equal(schemaAccepts(crossArrayOnly, byName.get("cutscene-continuity-review"), byFile), true, "packaged JSON Schema still validates its expressible structural contract");
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
