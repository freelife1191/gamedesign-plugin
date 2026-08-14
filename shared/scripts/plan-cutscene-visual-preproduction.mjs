import { createHash } from "node:crypto";

import { buildImageAssetPlan } from "./build-image-asset-plan.mjs";
import { readSecureReferenceFile } from "./lib/image-reference-loader.mjs";
import { ensureArtifactDirectories, safeWriteArtifactFile } from "./lib/safe-artifact-write.mjs";
import { canonicalCutsceneDocument, cutsceneDocumentSha256, snapshotCutscenePlainData, validateCutsceneVisualPlan } from "./validate-cutscene-visual-preproduction.mjs";
import { validateImageAssetManifest } from "./validate-image-assets.mjs";

const WAVE_IDS = ["style-master", "reference-masters", "keyframes", "storyboard"];
const HASH = /^[a-f0-9]{64}$/u;
const ASSET_ID = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u;
const RECORD_ID = /^[A-Za-z][A-Za-z0-9._:-]*$/u;
const VARIANT_VISUAL_KINDS = new Set(["expression", "blocking", "character-state", "costume", "prop-state", "environment-state", "lighting", "screen-direction"]);
const VARIANT_CHANGE_KINDS = new Set(["dialogue", ...VARIANT_VISUAL_KINDS]);

const hash = (value) => createHash("sha256").update(typeof value === "string" || Buffer.isBuffer(value) ? value : canonicalCutsceneDocument(value)).digest("hex");
const clone = (value) => structuredClone(value);
const compare = (left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right));

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

function plain(value) {
  try { return value !== null && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype; } catch { return false; }
}

function exact(value, keys) {
  try { return plain(value) && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key)); } catch { return false; }
}

function stable(value) {
  return typeof value === "string" && ASSET_ID.test(value);
}

function canonicalText(value) {
  return typeof value === "string" && value.length > 0 && value === value.normalize("NFC") && !/[\u0000-\u001f\u007f-\u009f]/u.test(value);
}

function fail(message) {
  throw new Error(`Invalid cutscene manifest handoff: ${message}`);
}

function normalizedRecordId(value, fallback) {
  const normalized = typeof value === "string" ? value.toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/^-|-$/gu, "") : "";
  return normalized || fallback;
}

function waveAssets(cutsceneId, beats, shots) {
  const keyframes = beats.map((beat, index) => `${cutsceneId}-keyframe-${normalizedRecordId(beat.beatId, `beat-${index + 1}`)}`);
  const storyboard = shots.map((shot, index) => `${cutsceneId}-storyboard-${normalizedRecordId(shot.shotId, `shot-${index + 1}`)}`);
  return [
    { id: "style-master", assetIds: [`${cutsceneId}-style-master-style-01`] },
    { id: "reference-masters", assetIds: [`${cutsceneId}-reference-master-environment-01`, `${cutsceneId}-reference-master-prop-01`] },
    { id: "keyframes", assetIds: keyframes },
    { id: "storyboard", assetIds: storyboard },
  ];
}

function forwardEdges() {
  return [
    { fromWaveId: "style-master", toWaveId: "reference-masters" },
    { fromWaveId: "reference-masters", toWaveId: "keyframes" },
    { fromWaveId: "keyframes", toWaveId: "storyboard" },
  ].sort((left, right) => compare(`${left.fromWaveId}\0${left.toWaveId}`, `${right.fromWaveId}\0${right.toWaveId}`));
}

function planWorkflow(cutsceneId, beats, shots) {
  const groups = waveAssets(cutsceneId, beats, shots);
  return {
    schemaVersion: 1,
    waves: groups.map((group, index) => ({
      id: group.id,
      state: index === 0 ? "template-ready" : "planned",
      assetIds: [...group.assetIds].sort(compare),
      estimate: null,
      approval: null,
      attempts: [],
      completion: index === 0 ? {
        kind: "template-ready",
        references: [{ assetId: group.assetIds[0], expectedPath: `assets/generated/${group.assetIds[0]}.png` }],
      } : null,
      invalidation: null,
      invalidationHistory: [],
    })),
    downstream: forwardEdges(),
    derived: {},
  };
}

function cutsceneProfile(assetIds) {
  return {
    profile_id: "cutscene-visual-preproduction", version: 1, artifact_types: ["design-document"], audiences: ["design"],
    required_sections: [{ id: "cutscene", title: "Cutscene visual preproduction" }],
    required_tables: [{ id: "cutscene-beats", section_id: "cutscene", columns: ["Beat"] }],
    required_diagrams: [{ id: "cutscene-dag", section_id: "cutscene", purpose: "Show cutscene generation dependencies.", alt_text: "Cutscene generation dependency graph." }],
    required_images: assetIds.map((id) => ({ id, section_id: "cutscene", purpose: `Cutscene asset ${id}.`, alt_text: `Cutscene asset ${id}.` })),
    recommended_images: [], length_guidance: { min_words: 0, max_words: 0 }, ppt_story_contract: {},
    acceptance_criteria: ["Cutscene prompts preserve approved master references."], export_rules: { required_formats: ["md"], forbidden_formats: [] }, quality_checks: ["cutscene-continuity"],
  };
}

function cutsceneArtifact(cutsceneId, assetIds) {
  return {
    artifact_id: cutsceneId,
    image_needs: assetIds.map((assetId) => ({
      slot_id: assetId, type: "story-storyboard", scene: "A planned cutscene frame with continuity controls.", subject: `Cutscene asset ${assetId}.`,
      composition: "Production storyboard framing with readable screen direction.", visual_style: "Original game-cinematic concept art.",
      readability: "The scene purpose, action, and continuity anchors remain readable.", width: 1024, height: 1024,
    })),
  };
}

function promptFor(asset) {
  return [
    `Cutscene asset: ${asset.asset_id}`,
    `Purpose: ${asset.purpose}`,
    `Preserve: ${asset.art_brief.preserve.join("; ")}`,
    "Keep camera direction, character state, environment landmarks, prop placement, lighting, and subtitle-safe space consistent.",
    `Exclude: ${asset.art_brief.exclude.join("; ")}`,
  ].join("\n");
}

function manifestWorkflow(plan, dagSha256) {
  return {
    schemaVersion: 1,
    dagSha256,
    waves: plan.cutsceneWorkflow.waves.map(({ id, assetIds }) => ({ id, assetIds: [...assetIds] })),
  };
}

function templatePackage(plan, manifest) {
  const references = manifest.assets.map((asset) => ({ assetId: asset.asset_id, expectedPath: asset.output.path }));
  return {
    kind: "template-ready",
    cutsceneId: plan.cutsceneId,
    planSha256: cutsceneDocumentSha256(plan),
    references,
    prompts: manifest.assets.map((asset) => ({ assetId: asset.asset_id, prompt: asset.prompt, promptSha256: asset.prompt_sha256 })),
  };
}

function derivedBindings(plan) {
  const assetIds = plan.cutsceneWorkflow.waves.flatMap((wave) => wave.assetIds);
  const general = buildImageAssetPlan({ artifact: cutsceneArtifact(plan.cutsceneId, assetIds), qualityProfile: cutsceneProfile(assetIds) });
  const dagSha256 = hash(plan.cutsceneWorkflow.downstream);
  const planSha256 = cutsceneDocumentSha256(plan);
  return {
    dagSha256,
    waves: plan.cutsceneWorkflow.waves.map(({ id, assetIds: waveAssetIds }) => ({ id, assetIds: [...waveAssetIds] })),
    assets: general.manifest.assets.map((asset) => {
      const prompt = promptFor(asset);
      const promptSha256 = hash(prompt);
      return { assetId: asset.asset_id, outputPath: asset.output.path, prompt, promptSha256, approvalBindingSha256: hash({ assetId: asset.asset_id, dagSha256, planSha256, promptSha256 }) };
    }),
  };
}

function assertPlanDerivedBindings(plan, manifest) {
  const expected = derivedBindings(plan);
  if (manifest.cutsceneWorkflow.dagSha256 !== expected.dagSha256
    || canonicalCutsceneDocument(manifest.cutsceneWorkflow.waves) !== canonicalCutsceneDocument(expected.waves)
    || manifest.assets.length !== expected.assets.length) throw new Error("Cutscene plan-derived binding mismatch.");
  const actual = new Map(manifest.assets.map((asset) => [asset.asset_id, asset]));
  for (const binding of expected.assets) {
    const asset = actual.get(binding.assetId);
    if (!asset || asset.output?.path !== binding.outputPath || asset.prompt !== binding.prompt || asset.prompt_sha256 !== binding.promptSha256
      || asset.approval_binding_sha256 !== binding.approvalBindingSha256) throw new Error("Cutscene plan-derived binding mismatch.");
  }
}

export function assertCutscenePlanManifestBinding({ plan, manifest } = {}) {
  if (!validateCutsceneVisualPlan(plan).ok) throw new TypeError("A valid cutscene plan is required.");
  validateCutsceneManifestHandoff({ manifest });
  if (!validateImageAssetManifest(manifest).ok) throw new TypeError("A valid cutscene manifest is required.");
  assertPlanDerivedBindings(plan, manifest);
}

function bindingAuthority(plan, manifest) {
  const snapshot = deepFreeze(JSON.parse(canonicalCutsceneDocument({ plan, manifest })));
  const planned = validateCutsceneVisualPlan(snapshot.plan);
  if (!planned.ok) throw new Error("Cannot bind an invalid cutscene plan.");
  validateCutsceneManifestHandoff({ manifest: snapshot.manifest });
  if (!validateImageAssetManifest(snapshot.manifest).ok) throw new Error("Cannot bind an invalid cutscene image manifest.");
  assertPlanDerivedBindings(snapshot.plan, snapshot.manifest);
  const bindings = derivedBindings(snapshot.plan);
  const byAssetId = new Map(bindings.assets.map((binding) => [binding.assetId, binding]));
  const sources = snapshot.manifest.assets.filter((asset) => asset.generation_state === "generated").map((asset) => byAssetId.get(asset.asset_id));
  if (sources.some((source) => source === undefined)) throw new Error("Cutscene plan-derived binding mismatch.");
  return { plan: snapshot.plan, bindings, sources };
}

export function validateCutsceneManifestHandoff({ manifest } = {}) {
  try {
    if (!exact(manifest, ["schema_version", "assets", "cutsceneWorkflow"]) || manifest.schema_version !== 1 || !Array.isArray(manifest.assets) || manifest.assets.length === 0) fail("root shape");
    if (!exact(manifest.cutsceneWorkflow, ["schemaVersion", "dagSha256", "waves"])
      || manifest.cutsceneWorkflow.schemaVersion !== 1 || !HASH.test(manifest.cutsceneWorkflow.dagSha256) || !Array.isArray(manifest.cutsceneWorkflow.waves)) fail("closed cutsceneWorkflow authority");
    const ids = new Set();
    for (const asset of manifest.assets) {
      if (!plain(asset) || !stable(asset.asset_id) || !HASH.test(asset.prompt_sha256) || !HASH.test(asset.approval_binding_sha256) || ids.has(asset.asset_id)
        || Object.hasOwn(asset, "mode")) fail("asset binding");
      ids.add(asset.asset_id);
    }
    if (manifest.assets.some((asset) => Object.hasOwn(asset, "type")) && !validateImageAssetManifest(manifest).ok) fail("image manifest");
    for (const wave of manifest.cutsceneWorkflow.waves) {
      if (!exact(wave, ["id", "assetIds"]) || !WAVE_IDS.includes(wave.id) || !Array.isArray(wave.assetIds)
        || wave.assetIds.length === 0 || wave.assetIds.some((id) => !ids.has(id))) fail("wave asset IDs");
    }
    return manifest;
  } catch (error) {
    if (error?.message?.startsWith("Invalid cutscene manifest handoff:")) throw error;
    fail("unsafe data");
  }
}

export function planCutsceneVisualPreproduction(input = {}) {
  if (!plain(input) || !stable(input.cutsceneId) || !["prompt-only", "estimate-only", "generate-after-approval"].includes(input.mode)
    || !Array.isArray(input.beats) || !Array.isArray(input.shots)) throw new Error("Cutscene planning requires a canonical cutscene ID, mode, beats, and shots.");
  const beats = clone(input.beats);
  const shots = clone(input.shots);
  const plan = { schemaVersion: 1, cutsceneId: input.cutsceneId, mode: input.mode, beats, shots, cutsceneWorkflow: planWorkflow(input.cutsceneId, beats, shots) };
  const planValidation = validateCutsceneVisualPlan(plan);
  if (!planValidation.ok) throw new Error(`Invalid cutscene plan: ${planValidation.errors.map(({ code }) => code).join(", ")}`);
  const assetIds = plan.cutsceneWorkflow.waves.flatMap((wave) => wave.assetIds);
  const general = buildImageAssetPlan({ artifact: cutsceneArtifact(plan.cutsceneId, assetIds), qualityProfile: cutsceneProfile(assetIds) });
  const dagSha256 = hash(plan.cutsceneWorkflow.downstream);
  const planSha256 = cutsceneDocumentSha256(plan);
  const assets = general.manifest.assets.map((asset) => {
    const prompt = promptFor(asset);
    const promptSha256 = hash(prompt);
    return {
      ...asset,
      prompt,
      prompt_sha256: promptSha256,
      approval_binding_sha256: hash({ assetId: asset.asset_id, dagSha256, planSha256, promptSha256 }),
    };
  });
  const manifest = { schema_version: 1, assets, cutsceneWorkflow: manifestWorkflow(plan, dagSha256) };
  const handoff = validateCutsceneManifestHandoff({ manifest: {
    schema_version: manifest.schema_version,
    assets: manifest.assets.map(({ asset_id, prompt_sha256, approval_binding_sha256 }) => ({ asset_id, prompt_sha256, approval_binding_sha256 })),
    cutsceneWorkflow: manifest.cutsceneWorkflow,
  } });
  if (!handoff) throw new Error("Cutscene manifest handoff validation failed.");
  return { plan, manifest, templatePromptPackage: templatePackage(plan, manifest) };
}

export async function bindCutscenePromptPackage({ artifactRoot, plan, manifest } = {}) {
  const authority = bindingAuthority(plan, manifest);
  const bound = [];
  const loaded = [];
  for (const source of authority.sources) {
    try {
      const reference = await readSecureReferenceFile({ artifactRoot, path: source.outputPath });
      loaded.push({ source, reference });
    } catch (error) {
      if (error?.message === "reference identity changed") throw error;
      throw new Error("unsafe reference input");
    }
  }
  for (const { source, reference } of loaded) { await reference.verify(); bound.push({ assetId: source.assetId, sha256: reference.digest }); }
  const result = {
    kind: "generation-ready", cutsceneId: authority.plan.cutsceneId, planSha256: cutsceneDocumentSha256(authority.plan), dagSha256: authority.bindings.dagSha256,
    references: bound,
    prompts: authority.bindings.assets.map(({ assetId, prompt, promptSha256 }) => ({ assetId, prompt, promptSha256 })),
  };
  return { ...result, promptPackageSha256: hash(result) };
}

export async function writeCutscenePromptPackage({ artifactRoot, promptPackage } = {}) {
  if (!plain(promptPackage) || !["template-ready", "generation-ready"].includes(promptPackage.kind)) throw new Error("A cutscene prompt package is required.");
  const root = await ensureArtifactDirectories({ artifactRoot, directories: ["cutscene", "cutscene/prompts"] });
  const lines = ["# Cutscene prompt package", "", `Kind: ${promptPackage.kind}`, "", "## Reference bindings", ""];
  for (const reference of promptPackage.references ?? []) lines.push(`- ${reference.assetId}: ${reference.sha256 ?? reference.expectedPath}`);
  await safeWriteArtifactFile({ artifactRoot: root, relativePath: "cutscene/prompts/prompt-manifest.json", data: `${JSON.stringify(promptPackage, null, 2)}\n` });
  await safeWriteArtifactFile({ artifactRoot: root, relativePath: "cutscene/prompts/README.md", data: `${lines.join("\n")}\n` });
}

export function buildVariantOverlay(input = {}) {
  const { basePlan, triggerState, changes } = snapshotCutscenePlainData(input);
  if (!validateCutsceneVisualPlan(basePlan).ok) throw new TypeError("A valid base plan is required.");
  if (!canonicalText(triggerState)) throw new TypeError("A canonical trigger state is required.");
  if (!Array.isArray(changes)) throw new TypeError("Variant changes must be an array.");
  const shots = new Set(basePlan.shots.map(({ shotId }) => shotId));
  const storyboard = new Map(basePlan.shots.map((shot, index) => [shot.shotId, basePlan.cutsceneWorkflow.waves[3].assetIds[index]]));
  const changeKinds = new Set();
  const copied = changes.map((change, index) => {
    if (!exact(change, ["shotId", "kind", "value"]) || !RECORD_ID.test(change.shotId ?? "") || !shots.has(change.shotId) || !VARIANT_CHANGE_KINDS.has(change.kind) || !canonicalText(change.value)) throw new TypeError(`Invalid variant change at index ${index}.`);
    const key = `${change.shotId}\0${change.kind}`;
    if (changeKinds.has(key)) throw new TypeError(`Duplicate variant change at index ${index}.`);
    changeKinds.add(key);
    return { shotId: change.shotId, kind: change.kind, value: change.value };
  });
  const visualByShot = new Map();
  for (const change of copied) if (VARIANT_VISUAL_KINDS.has(change.kind)) {
    const group = visualByShot.get(change.shotId) ?? [];
    group.push(change);
    visualByShot.set(change.shotId, group);
  }
  const sourceAssetIds = [...visualByShot.keys()].map((shotId) => storyboard.get(shotId)).sort(compare);
  const generatedAssetIds = [...visualByShot.entries()].map(([shotId, visualChanges]) => `${basePlan.cutsceneId}-variant-${hash({ triggerState, shotId, changes: [...visualChanges].sort((left, right) => compare(`${left.kind}\0${left.value}`, `${right.kind}\0${right.value}`)) }).slice(0, 16)}`).sort(compare);
  const baseIds = new Set(basePlan.cutsceneWorkflow.waves.flatMap((wave) => wave.assetIds));
  if (generatedAssetIds.some((id) => baseIds.has(id))) throw new TypeError("Variant derivative ID collides with a base asset.");
  return structuredClone({ schemaVersion: 1, cutsceneId: basePlan.cutsceneId, basePlanSha256: cutsceneDocumentSha256(basePlan), triggerState, changes: copied, sourceAssetIds, generatedAssetIds });
}

function cutsceneImpactWaves(input = {}) {
  const { plan, changedAssetIds = [] } = snapshotCutscenePlainData(input);
  if (!validateCutsceneVisualPlan(plan).ok || !Array.isArray(changedAssetIds) || !changedAssetIds.every(stable)) throw new Error("Cutscene impact requires a valid plan and stable changed asset IDs.");
  const changed = [...new Set(changedAssetIds)].sort(compare);
  const known = new Set(plan.cutsceneWorkflow.waves.flatMap((wave) => wave.assetIds));
  if (!changed.every((id) => known.has(id))) throw new Error("Cutscene impact requires known changed asset IDs.");
  const affected = new Set();
  const queue = [];
  for (const wave of plan.cutsceneWorkflow.waves) if (wave.assetIds.some((id) => changed.includes(id))) { affected.add(wave.id); queue.push(wave.id); }
  const downstream = new Map(WAVE_IDS.map((id) => [id, []]));
  for (const edge of plan.cutsceneWorkflow.downstream) downstream.get(edge.fromWaveId).push(edge.toWaveId);
  const downstreamReached = new Set();
  while (queue.length > 0) {
    const current = queue.shift();
    for (const next of downstream.get(current)) {
      downstreamReached.add(next);
      if (!affected.has(next)) { affected.add(next); queue.push(next); }
    }
  }
  const waveIds = WAVE_IDS.filter((id) => affected.has(id));
  const seedWaves = new Set(plan.cutsceneWorkflow.waves.filter((wave) => wave.assetIds.some((id) => changed.includes(id))).map((wave) => wave.id));
  const waves = plan.cutsceneWorkflow.waves.filter((wave) => affected.has(wave.id)).map((wave) => ({
    id: wave.id,
    assetIds: seedWaves.has(wave.id) && !downstreamReached.has(wave.id) ? wave.assetIds.filter((id) => changed.includes(id)) : [...wave.assetIds],
  }));
  return { waveIds, assetIds: waves.flatMap((wave) => wave.assetIds), waves };
}

export function findCutsceneImpact(input = {}) {
  const { waveIds, assetIds } = cutsceneImpactWaves(input);
  return { waveIds, assetIds };
}

export function invalidateCutsceneDependents(input = {}) {
  const { plan, changedAssetIds = [], reason = "master-changed" } = snapshotCutscenePlainData(input);
  const impact = cutsceneImpactWaves({ plan, changedAssetIds });
  const next = clone(plan);
  for (const wave of next.cutsceneWorkflow.waves) {
    const affected = impact.waves.find(({ id }) => id === wave.id);
    if (!affected) continue;
    const prior = wave.invalidation;
    if (prior !== null) wave.invalidationHistory.push(prior);
    const fromState = wave.state === "invalidated" ? prior?.fromState ?? "planned" : wave.state;
    wave.state = "invalidated";
    wave.completion = null;
    wave.invalidation = { fromState, toState: "invalidated", reason, affectedAssetIds: [...affected.assetIds] };
  }
  return next;
}
