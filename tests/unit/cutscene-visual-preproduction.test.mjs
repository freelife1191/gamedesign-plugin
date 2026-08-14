import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rename, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import { deflateSync } from "node:zlib";

import { validateImageAssetManifest } from "../../shared/scripts/validate-image-assets.mjs";
import { isRfc3339DateTime } from "../../shared/scripts/lib/rfc3339.mjs";

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
import {
  bindCutscenePromptPackage,
  findCutsceneImpact,
  invalidateCutsceneDependents,
  planCutsceneVisualPreproduction,
  validateCutsceneManifestHandoff,
} from "../../shared/scripts/plan-cutscene-visual-preproduction.mjs";
import { planImageAssetWorkflow } from "../../shared/scripts/run-image-asset-workflow.mjs";

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
  plan.cutsceneWorkflow.waves[0].attempts = [{ schemaVersion: 1, waveId: "style-master", assetId: plan.cutsceneWorkflow.waves[0].assetIds[0], attemptId: "attempt-01", providerRequestId: "request-01", inputTokens: 1, inputTextTokens: 1, inputImageTokens: 0, cachedTextTokens: 0, cachedImageTokens: 0, outputTokens: 1, totalTokens: 2 }];
  const earlier = structuredClone(plan.cutsceneWorkflow.waves[0]);
  const changed = plan.cutsceneWorkflow.waves[1].assetIds[0];
  const impact = findCutsceneImpact({ plan, changedAssetIds: [changed] });
  const invalidated = invalidateCutsceneDependents({ plan, changedAssetIds: [changed], reason: "master-changed" });
  assert.deepEqual(impact.waveIds, ["reference-masters", "keyframes", "storyboard"]);
  assert.deepEqual(invalidated.cutsceneWorkflow.waves[0], earlier);
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

test("binding rejects symlink and identity-swapped master bytes", async (t) => {
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
  const replacement = path.join(root, "replacement.png");
  await writeFile(replacement, validPng());
  await assert.rejects(() => bindCutscenePromptPackage({ artifactRoot: root, plan: planned.plan, manifest, beforeReferenceVerification: async () => rename(replacement, destination) }), /reference identity changed/i);
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

const validContinuityReview = (overrides = {}) => ({
  schemaVersion: 1,
  cutsceneId: "cutscene-escape",
  planSha256: SHA,
  reviewedAt: "2026-08-13T00:00:00.000Z",
  findings: [],
  blockingFindingIds: [],
  ...overrides,
});

const currentPlan = () => validCutscenePlan();

function completedPlan() {
  const plan = validCutscenePlan();
  plan.mode = "generate-after-approval";
  for (const wave of plan.cutsceneWorkflow.waves) { wave.state = "completed"; wave.completion = null; }
  return plan;
}

function currentReceipt(plan, overrides = {}) {
  return validContinuityReview({ planSha256: cutsceneDocumentSha256(plan), ...overrides });
}

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

const schemaKeywords = new Set(["$schema", "$id", "$defs", "$ref", "type", "const", "enum", "required", "additionalProperties", "properties", "items", "pattern", "minLength", "minItems", "maxItems", "uniqueItems", "minimum", "maximum", "allOf", "anyOf", "oneOf", "not", "if", "then", "else", "format"]);
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
  if (schema.minimum !== undefined && (typeof value !== "number" || value < schema.minimum)) return false;
  if (schema.maximum !== undefined && (typeof value !== "number" || value > schema.maximum)) return false;
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
