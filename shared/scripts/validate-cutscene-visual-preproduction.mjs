import { createHash } from "node:crypto";

import { validateImageAssetManifest } from "./validate-image-assets.mjs";
import { isRfc3339DateTime } from "./lib/rfc3339.mjs";

const WAVE_IDS = ["style-master", "reference-masters", "keyframes", "storyboard"];
const WAVE_STATES = ["planned", "template-ready", "generation-ready", "cost-estimated", "approval-pending", "approved", "dispatching", "completed", "blocked", "invalidated"];
const MODES = ["prompt-only", "estimate-only", "generate-after-approval"];
const SHA256 = /^[a-f0-9]{64}$/u;
const CUTSCENE_ID = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u;
const RECORD_ID = /^[A-Za-z][A-Za-z0-9._:-]*$/u;
const DISPATCH_STATES = new Set(["dispatching", "completed"]);
const MODE_STATES = Object.freeze({
  "prompt-only": new Set(["planned", "template-ready", "blocked", "invalidated"]),
  "estimate-only": new Set(["planned", "template-ready", "generation-ready", "cost-estimated", "approval-pending", "blocked", "invalidated"]),
  "generate-after-approval": new Set(WAVE_STATES),
});

const isText = (value) => typeof value === "string" && value.length > 0 && value === value.normalize("NFC") && !/[\0\r\n]/u.test(value);
const isHash = (value) => typeof value === "string" && SHA256.test(value);
const compareUtf8 = (left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right));

function plainObject(value) {
  try { return value !== null && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype; } catch { return false; }
}

function safeData(value, seen = new Set()) {
  if (value === null || typeof value !== "object") return true;
  if (seen.has(value)) return false;
  seen.add(value);
  try {
    const keys = Reflect.ownKeys(value);
    const descriptors = Object.getOwnPropertyDescriptors(value);
    if (Array.isArray(value)) {
      const length = descriptors.length;
      if (!length || "get" in length || "set" in length || !Number.isSafeInteger(length.value) || length.value < 0) return false;
      if (keys.length !== length.value + 1 || !keys.includes("length")) return false;
      for (let index = 0; index < length.value; index += 1) {
        const key = String(index); const descriptor = descriptors[key];
        if (!descriptor || !descriptor.enumerable || "get" in descriptor || "set" in descriptor || !safeData(descriptor.value, seen)) return false;
      }
      return true;
    }
    if (Object.getPrototypeOf(value) !== Object.prototype) return false;
    for (const key of keys) {
      if (typeof key !== "string") return false;
      const descriptor = descriptors[key];
      if (!descriptor || !descriptor.enumerable || "get" in descriptor || "set" in descriptor || !safeData(descriptor.value, seen)) return false;
    }
    return true;
  } catch { return false; } finally { seen.delete(value); }
}

function resultOf(value, validate) {
  const errors = [];
  const issue = (code, path) => errors.push({ code, path });
  if (!safeData(value)) issue("cutscene.hostile_input", "");
  else validate(issue);
  return { ok: errors.length === 0, errors };
}

function closed(value, keys, path, issue, { unknownCode = "cutscene.unknown_key", requiredCode = "cutscene.required" } = {}) {
  if (!plainObject(value)) { issue("cutscene.object_required", path); return false; }
  for (const key of keys) if (!Object.hasOwn(value, key)) issue(requiredCode, `${path}/${key}`);
  for (const key of Reflect.ownKeys(value)) if (typeof key !== "string" || !keys.includes(key)) issue(unknownCode, `${path}/${String(key)}`);
  return true;
}

function nonEmptySortedUnique(values, path, issue, { code = "cutscene.ids_unsorted_or_duplicate", emptyCode = "cutscene.array_empty", predicate = isText } = {}) {
  if (!Array.isArray(values) || values.length === 0) { issue(emptyCode, path); return false; }
  const valid = values.map((value, index) => {
    const accepted = typeof value === "string" && predicate(value);
    if (!accepted) issue("cutscene.id_invalid", `${path}/${index}`);
    return accepted;
  });
  for (let index = 1; index < values.length; index += 1) if (valid[index - 1] && valid[index] && compareUtf8(values[index - 1], values[index]) >= 0) { issue(code, path); break; }
  return true;
}

function validateTemplateReference(value, path, issue) {
  if (Object.hasOwn(value ?? {}, "sha256")) issue("cutscene.template_hash_forbidden", `${path}/sha256`);
  closed(value, ["assetId", "expectedPath"], path, issue, { unknownCode: "cutscene.template_reference_unknown_key", requiredCode: "cutscene.template_reference_required" });
  if (!CUTSCENE_ID.test(value?.assetId ?? "")) issue("cutscene.reference_asset_id_invalid", `${path}/assetId`);
  if (!isText(value?.expectedPath) || !value.expectedPath.startsWith("assets/")) issue("cutscene.expected_path_invalid", `${path}/expectedPath`);
}

function validateBoundReference(value, path, issue) {
  if (!isHash(value?.sha256)) issue("cutscene.bound_hash_required", `${path}/sha256`);
  closed(value, ["assetId", "sha256"], path, issue, { unknownCode: "cutscene.bound_reference_unknown_key", requiredCode: "cutscene.bound_reference_required" });
  if (!CUTSCENE_ID.test(value?.assetId ?? "")) issue("cutscene.reference_asset_id_invalid", `${path}/assetId`);
}

function validateCompletion(value, state, path, issue) {
  const requiredKind = state === "template-ready" || state === "generation-ready" ? state : undefined;
  if (value === null) { if (requiredKind) issue("cutscene.completion_required", path); return; }
  if (!plainObject(value)) { issue("cutscene.completion_invalid", path); return; }
  const kind = value.kind;
  if (kind === "template-ready" || kind === "generation-ready") {
    closed(value, ["kind", "references"], path, issue, { unknownCode: "cutscene.completion_unknown_key", requiredCode: "cutscene.completion_required" });
    if (!Array.isArray(value.references) || value.references.length === 0) issue("cutscene.references_empty", `${path}/references`);
    else value.references.forEach((reference, index) => (kind === "template-ready" ? validateTemplateReference : validateBoundReference)(reference, `${path}/references/${index}`, issue));
  } else if (kind === "completed") {
    closed(value, ["kind", "assetIds"], path, issue, { unknownCode: "cutscene.completion_unknown_key", requiredCode: "cutscene.completion_required" });
    nonEmptySortedUnique(value.assetIds, `${path}/assetIds`, issue, { emptyCode: "cutscene.completion_asset_ids_empty", predicate: (id) => CUTSCENE_ID.test(id ?? "") });
  } else issue("cutscene.completion_kind_invalid", `${path}/kind`);
  if (requiredKind && kind !== requiredKind) issue("cutscene.completion_kind_required", `${path}/kind`);
  if (!requiredKind && kind !== "completed") issue("cutscene.completion_state_incompatible", `${path}/kind`);
  if (kind === "completed" && state !== "completed") issue("cutscene.completion_state_incompatible", `${path}/kind`);
}

function validateTransition(value, state, path, issue) {
  if (value === null) { if (state === "invalidated") issue("cutscene.invalidation_required", path); return; }
  closed(value, ["fromState", "toState", "reason", "affectedAssetIds"], path, issue, { unknownCode: "cutscene.invalidation_unknown_key", requiredCode: "cutscene.invalidation_required" });
  if (!WAVE_STATES.includes(value?.fromState)) issue("cutscene.transition_invalid", `${path}/fromState`);
  if (value?.toState !== state) issue("cutscene.transition_invalid", `${path}/toState`);
  if (!isText(value?.reason)) issue("cutscene.invalidation_reason_invalid", `${path}/reason`);
  nonEmptySortedUnique(value?.affectedAssetIds, `${path}/affectedAssetIds`, issue, { emptyCode: "cutscene.invalidation_asset_ids_empty", predicate: (id) => CUTSCENE_ID.test(id ?? "") });
  const allowed = value?.fromState === "invalidated" && value?.toState === "cost-estimated"
    || value?.toState === "invalidated" && value?.fromState !== "invalidated";
  if (!allowed) issue("cutscene.transition_invalid", `${path}/toState`);
}

function validateWave(value, index, mode, issue) {
  const path = `/cutsceneWorkflow/waves/${index}`;
  if (!plainObject(value)) { issue("cutscene.wave_object_required", path); return; }
  const keys = ["id", "state", "assetIds", "estimate", "approval", "attempts", "completion", "invalidation"];
  for (const key of keys) if (!Object.hasOwn(value, key)) issue(key === "state" ? "cutscene.wave_state_required" : "cutscene.wave_required", `${path}/${key}`);
  for (const key of Reflect.ownKeys(value)) if (typeof key !== "string" || !keys.includes(key)) issue("cutscene.wave_unknown_key", `${path}/${String(key)}`);
  if (value.id !== WAVE_IDS[index]) issue("cutscene.wave_order_invalid", `${path}/id`);
  if (!WAVE_STATES.includes(value.state)) issue("cutscene.wave_state_invalid", `${path}/state`);
  if (MODES.includes(mode) && !MODE_STATES[mode].has(value.state)) issue("cutscene.mode_state_forbidden", `${path}/state`);
  nonEmptySortedUnique(value.assetIds, `${path}/assetIds`, issue, { emptyCode: "cutscene.wave_asset_ids_empty", predicate: (id) => CUTSCENE_ID.test(id ?? "") });
  if (value.estimate !== null && !validateCutsceneCostEstimate(value.estimate).ok) issue("cutscene.wave_estimate_invalid", `${path}/estimate`);
  if (value.approval !== null && !validateCutsceneGenerationApproval(value.approval).ok) issue("cutscene.wave_approval_invalid", `${path}/approval`);
  if (!Array.isArray(value.attempts)) issue("cutscene.wave_attempts_invalid", `${path}/attempts`);
  else value.attempts.forEach((attempt, attemptIndex) => { if (!validateCutsceneGenerationUsage(attempt).ok) issue("cutscene.wave_attempt_invalid", `${path}/attempts/${attemptIndex}`); });
  validateCompletion(value.completion, value.state, `${path}/completion`, issue);
  validateTransition(value.invalidation, value.state, `${path}/invalidation`, issue);
  if (mode === "prompt-only" && value.estimate !== null) issue("cutscene.mode_evidence_forbidden", `${path}/estimate`);
  if (mode === "prompt-only" && (value.approval !== null || value.attempts?.length > 0 || value.completion?.kind === "generation-ready" || value.completion?.kind === "completed")) issue("cutscene.mode_evidence_forbidden", `${path}/attempts`);
  if (mode === "estimate-only" && (value.approval !== null || value.attempts?.length > 0 || value.completion?.kind === "completed")) issue("cutscene.mode_evidence_forbidden", `${path}/attempts`);
}

function validateForwardDag(downstream, issue) {
  if (!Array.isArray(downstream)) { issue("cutscene.dag_invalid", "/cutsceneWorkflow/downstream"); return; }
  let previous = "";
  downstream.forEach((edge, index) => {
    const path = `/cutsceneWorkflow/downstream/${index}`;
    closed(edge, ["fromWaveId", "toWaveId"], path, issue, { unknownCode: "cutscene.dag_unknown_key", requiredCode: "cutscene.dag_required" });
    const from = WAVE_IDS.indexOf(edge?.fromWaveId); const to = WAVE_IDS.indexOf(edge?.toWaveId);
    if (from < 0) issue("cutscene.dag_reference_unknown", `${path}/fromWaveId`);
    if (to < 0) issue("cutscene.dag_reference_unknown", `${path}/toWaveId`);
    if (from >= 0 && to >= 0 && from >= to) issue("cutscene.dag_not_forward", `${path}/toWaveId`);
    const key = `${edge?.fromWaveId}\0${edge?.toWaveId}`;
    if (previous && compareUtf8(previous, key) >= 0) issue("cutscene.dag_unsorted_or_duplicate", "/cutsceneWorkflow/downstream");
    previous = key;
  });
}

export function validateCutsceneVisualPlan(value) {
  return resultOf(value, (issue) => {
    if (plainObject(value) && Object.hasOwn(value, "state")) issue("cutscene.root_state_forbidden", "/state");
    if (plainObject(value) && Array.isArray(value.assets)) value.assets.forEach((asset, index) => { if (plainObject(asset) && Object.hasOwn(asset, "mode")) issue("cutscene.manifest_asset_mode_forbidden", `/assets/${index}/mode`); });
    closed(value, ["schemaVersion", "cutsceneId", "mode", "beats", "shots", "cutsceneWorkflow"], "", issue);
    if (value?.schemaVersion !== 1) issue("cutscene.schema_version_invalid", "/schemaVersion");
    if (!CUTSCENE_ID.test(value?.cutsceneId ?? "")) issue("cutscene.cutscene_id_invalid", "/cutsceneId");
    if (!MODES.includes(value?.mode)) issue("cutscene.mode_invalid", "/mode");
    const beatIds = new Set();
    if (!Array.isArray(value?.beats) || value.beats.length === 0) issue("cutscene.beats_empty", "/beats");
    else value.beats.forEach((beat, index) => { closed(beat, ["beatId"], `/beats/${index}`, issue, { unknownCode: "cutscene.beat_unknown_key", requiredCode: "cutscene.beat_required" }); if (!RECORD_ID.test(beat?.beatId ?? "")) issue("cutscene.beat_id_invalid", `/beats/${index}/beatId`); beatIds.add(beat?.beatId); if (index > 0 && compareUtf8(value.beats[index - 1].beatId, beat.beatId) >= 0) issue("cutscene.ids_unsorted_or_duplicate", "/beats"); });
    if (!Array.isArray(value?.shots) || value.shots.length === 0) issue("cutscene.shots_empty", "/shots");
    else value.shots.forEach((shot, index) => { closed(shot, ["shotId", "beatId"], `/shots/${index}`, issue, { unknownCode: "cutscene.shot_unknown_key", requiredCode: "cutscene.shot_required" }); if (!RECORD_ID.test(shot?.shotId ?? "")) issue("cutscene.shot_id_invalid", `/shots/${index}/shotId`); if (!beatIds.has(shot?.beatId)) issue("cutscene.shot_beat_unknown", `/shots/${index}/beatId`); if (index > 0 && compareUtf8(value.shots[index - 1].shotId, shot.shotId) >= 0) issue("cutscene.ids_unsorted_or_duplicate", "/shots"); });
    closed(value?.cutsceneWorkflow, ["schemaVersion", "waves", "downstream", "derived"], "/cutsceneWorkflow", issue, { unknownCode: "cutscene.workflow_unknown_key", requiredCode: "cutscene.workflow_required" });
    if (value?.cutsceneWorkflow?.schemaVersion !== 1) issue("cutscene.workflow_schema_version_invalid", "/cutsceneWorkflow/schemaVersion");
    if (!Array.isArray(value?.cutsceneWorkflow?.waves) || value.cutsceneWorkflow.waves.length !== WAVE_IDS.length) issue("cutscene.wave_count_invalid", "/cutsceneWorkflow/waves");
    else value.cutsceneWorkflow.waves.forEach((wave, index) => validateWave(wave, index, value.mode, issue));
    validateForwardDag(value?.cutsceneWorkflow?.downstream, issue);
    closed(value?.cutsceneWorkflow?.derived, [], "/cutsceneWorkflow/derived", issue, { unknownCode: "cutscene.derived_unknown_key", requiredCode: "cutscene.derived_invalid" });
  });
}

function validateCost(value, issue) {
  closed(value, ["schemaVersion", "sha256", "waveId", "assetIds", "planSha256", "pricingSnapshotSha256", "retryReserve", "minimumUsd", "expectedUsd", "maximumUsd"], "", issue);
  if (value?.schemaVersion !== 1) issue("cutscene.schema_version_invalid", "/schemaVersion");
  for (const field of ["sha256", "planSha256", "pricingSnapshotSha256"]) if (!isHash(value?.[field])) issue("cutscene.hash_invalid", `/${field}`);
  if (!WAVE_IDS.includes(value?.waveId)) issue("cutscene.wave_id_invalid", "/waveId");
  nonEmptySortedUnique(value?.assetIds, "/assetIds", issue, { emptyCode: "cutscene.asset_ids_empty", predicate: (id) => CUTSCENE_ID.test(id ?? "") });
  if (!Number.isInteger(value?.retryReserve) || value.retryReserve < 0) issue("cutscene.retry_reserve_invalid", "/retryReserve");
  for (const field of ["minimumUsd", "expectedUsd", "maximumUsd"]) if (typeof value?.[field] !== "number" || !Number.isFinite(value[field]) || value[field] < 0) issue("cutscene.cost_invalid", `/${field}`);
  if (value?.minimumUsd > value?.expectedUsd || value?.expectedUsd > value?.maximumUsd) issue("cutscene.cost_range_invalid", "/maximumUsd");
}

export function validateCutsceneCostEstimate(value) { return resultOf(value, (issue) => validateCost(value, issue)); }

export function validateCutsceneGenerationApproval(value) {
  return resultOf(value, (issue) => {
    closed(value, ["schemaVersion", "eventId", "actor", "reviewer", "decision", "decidedAt", "waveId", "assetIds", "maximumApprovedUsd", "retryReserve", "planSha256", "promptPackageSha256", "referenceBindings", "pricingSnapshotSha256", "costEstimateSha256"], "", issue);
    if (value?.schemaVersion !== 1) issue("cutscene.schema_version_invalid", "/schemaVersion");
    for (const field of ["eventId", "actor", "reviewer"]) if (!isText(value?.[field])) issue("cutscene.text_invalid", `/${field}`);
    if (value?.decision !== "approved") issue("cutscene.approval_decision_invalid", "/decision");
    if (!isRfc3339DateTime(value?.decidedAt)) issue("cutscene.timestamp_invalid", "/decidedAt");
    if (!WAVE_IDS.includes(value?.waveId)) issue("cutscene.wave_id_invalid", "/waveId");
    nonEmptySortedUnique(value?.assetIds, "/assetIds", issue, { emptyCode: "cutscene.asset_ids_empty", predicate: (id) => CUTSCENE_ID.test(id ?? "") });
    if (typeof value?.maximumApprovedUsd !== "number" || !Number.isFinite(value.maximumApprovedUsd) || value.maximumApprovedUsd < 0) issue("cutscene.maximum_approved_usd_invalid", "/maximumApprovedUsd");
    if (!Number.isInteger(value?.retryReserve) || value.retryReserve < 0) issue("cutscene.retry_reserve_invalid", "/retryReserve");
    for (const field of ["planSha256", "promptPackageSha256", "pricingSnapshotSha256", "costEstimateSha256"]) if (!isHash(value?.[field])) issue("cutscene.hash_invalid", `/${field}`);
    if (!Array.isArray(value?.referenceBindings) || value.referenceBindings.length === 0) issue("cutscene.reference_bindings_empty", "/referenceBindings");
    else value.referenceBindings.forEach((binding, index) => { closed(binding, ["assetId", "sha256"], `/referenceBindings/${index}`, issue); if (!CUTSCENE_ID.test(binding?.assetId ?? "")) issue("cutscene.reference_asset_id_invalid", `/referenceBindings/${index}/assetId`); if (!isHash(binding?.sha256)) issue("cutscene.hash_invalid", `/referenceBindings/${index}/sha256`); if (index > 0 && compareUtf8(value.referenceBindings[index - 1].assetId, binding.assetId) >= 0) issue("cutscene.ids_unsorted_or_duplicate", "/referenceBindings"); });
  });
}

export function validateCutsceneGenerationUsage(value) {
  return resultOf(value, (issue) => {
    closed(value, ["schemaVersion", "waveId", "assetId", "attemptId", "providerRequestId", "inputTokens", "inputTextTokens", "inputImageTokens", "cachedTextTokens", "cachedImageTokens", "outputTokens", "totalTokens"], "", issue);
    if (value?.schemaVersion !== 1) issue("cutscene.schema_version_invalid", "/schemaVersion");
    if (!WAVE_IDS.includes(value?.waveId)) issue("cutscene.wave_id_invalid", "/waveId");
    if (!CUTSCENE_ID.test(value?.assetId ?? "")) issue("cutscene.asset_id_invalid", "/assetId");
    for (const field of ["attemptId", "providerRequestId"]) if (!isText(value?.[field])) issue("cutscene.text_invalid", `/${field}`);
    const fields = ["inputTokens", "inputTextTokens", "inputImageTokens", "cachedTextTokens", "cachedImageTokens", "outputTokens", "totalTokens"];
    for (const field of fields) if (!Number.isInteger(value?.[field]) || value[field] < 0) issue("cutscene.usage_token_invalid", `/${field}`);
    if (value?.inputTokens !== value?.inputTextTokens + value?.inputImageTokens) issue("cutscene.usage_input_mismatch", "/inputTokens");
    if (value?.totalTokens !== value?.inputTokens + value?.outputTokens) issue("cutscene.usage_total_mismatch", "/totalTokens");
    if (value?.cachedTextTokens > value?.inputTextTokens) issue("cutscene.cached_text_exceeds_input", "/cachedTextTokens");
    if (value?.cachedImageTokens > value?.inputImageTokens) issue("cutscene.cached_image_exceeds_input", "/cachedImageTokens");
  });
}

export function validateCutsceneContinuityReview(value) {
  return resultOf(value, (issue) => {
    closed(value, ["schemaVersion", "cutsceneId", "planSha256", "reviewedAt", "findings", "blockingFindingIds"], "", issue);
    if (value?.schemaVersion !== 1) issue("cutscene.schema_version_invalid", "/schemaVersion");
    if (!CUTSCENE_ID.test(value?.cutsceneId ?? "")) issue("cutscene.cutscene_id_invalid", "/cutsceneId");
    if (!isHash(value?.planSha256)) issue("cutscene.hash_invalid", "/planSha256");
    if (!isRfc3339DateTime(value?.reviewedAt)) issue("cutscene.timestamp_invalid", "/reviewedAt");
    const expectedBlockers = [];
    if (!Array.isArray(value?.findings)) issue("cutscene.findings_invalid", "/findings");
    else value.findings.forEach((finding, index) => { const path = `/findings/${index}`; closed(finding, ["findingId", "code", "path", "sourceMasterIds", "affectedAssetIds", "blocking"], path, issue); if (!RECORD_ID.test(finding?.findingId ?? "")) issue("cutscene.finding_id_invalid", `${path}/findingId`); if (!isText(finding?.code)) issue("cutscene.finding_code_invalid", `${path}/code`); if (!isText(finding?.path)) issue("cutscene.finding_path_invalid", `${path}/path`); nonEmptySortedUnique(finding?.sourceMasterIds, `${path}/sourceMasterIds`, issue, { predicate: (id) => CUTSCENE_ID.test(id ?? "") }); nonEmptySortedUnique(finding?.affectedAssetIds, `${path}/affectedAssetIds`, issue, { predicate: (id) => CUTSCENE_ID.test(id ?? "") }); if (typeof finding?.blocking !== "boolean") issue("cutscene.finding_blocking_invalid", `${path}/blocking`); if (finding?.blocking === true) expectedBlockers.push(finding.findingId); });
    if (!Array.isArray(value?.blockingFindingIds)) issue("cutscene.blockers_invalid", "/blockingFindingIds");
    else {
      value.blockingFindingIds.forEach((id, index) => { if (!RECORD_ID.test(id ?? "")) issue("cutscene.id_invalid", `/blockingFindingIds/${index}`); if (index > 0 && compareUtf8(value.blockingFindingIds[index - 1], id) >= 0) issue("cutscene.ids_unsorted_or_duplicate", "/blockingFindingIds"); });
      const actual = value.blockingFindingIds; const expected = [...new Set(expectedBlockers)].sort(compareUtf8);
      if (actual.length !== expected.length || actual.some((id, index) => id !== expected[index])) issue("cutscene.blocker_set_mismatch", "/blockingFindingIds");
    }
  });
}

function canonicalize(value, stack = new Set()) {
  if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") { if (!Number.isFinite(value)) throw new TypeError("Cutscene canonical document contains a non-finite number."); return JSON.stringify(value); }
  if (Array.isArray(value)) {
    if (stack.has(value)) throw new TypeError("Cutscene canonical document contains a cyclic array.");
    let keys; let descriptors;
    try { keys = Reflect.ownKeys(value); descriptors = Object.getOwnPropertyDescriptors(value); } catch { throw new TypeError("Cutscene canonical document contains hostile array state."); }
    const length = descriptors.length;
    if (!length || "get" in length || "set" in length || !Number.isSafeInteger(length.value) || keys.length !== length.value + 1 || !keys.includes("length")) throw new TypeError("Cutscene canonical document contains non-canonical array state.");
    const items = [];
    stack.add(value);
    for (let index = 0; index < length.value; index += 1) { const descriptor = descriptors[String(index)]; if (!descriptor || !descriptor.enumerable || "get" in descriptor || "set" in descriptor) throw new TypeError("Cutscene canonical document contains accessor array state."); items.push(canonicalize(descriptor.value, stack)); }
    stack.delete(value); return `[${items.join(",")}]`;
  }
  if (!plainObject(value) || stack.has(value)) throw new TypeError("Cutscene canonical document contains a non-plain or cyclic object.");
  let keys; let descriptors;
  try { keys = Reflect.ownKeys(value); descriptors = Object.getOwnPropertyDescriptors(value); } catch { throw new TypeError("Cutscene canonical document contains hostile object state."); }
  for (const key of keys) { const descriptor = descriptors[key]; if (typeof key !== "string" || !descriptor?.enumerable || "get" in descriptor || "set" in descriptor) throw new TypeError("Cutscene canonical document contains hidden object state."); }
  stack.add(value); const rendered = `{${Object.keys(descriptors).sort(compareUtf8).map((key) => `${JSON.stringify(key)}:${canonicalize(descriptors[key].value, stack)}`).join(",")}}`; stack.delete(value); return rendered;
}

export function canonicalCutsceneDocument(value) { return canonicalize(value); }
export function cutsceneDocumentSha256(value) { return createHash("sha256").update(canonicalCutsceneDocument(value)).digest("hex"); }

export function deriveCutsceneLifecycle({ plan, manifest, waves, continuityReceipt } = {}) {
  const planValid = validateCutsceneVisualPlan(plan).ok;
  const currentPlanSha256 = planValid ? cutsceneDocumentSha256(plan) : undefined;
  const listedWaves = Array.isArray(waves) && safeData(waves) ? waves : [];
  const wavesValid = planValid && validateCutsceneVisualPlan({ ...plan, cutsceneWorkflow: { ...plan.cutsceneWorkflow, waves: listedWaves } }).ok;
  const lifecycle = listedWaves.some((wave) => wave?.state === "blocked" || wave?.state === "invalidated") ? "blocked"
    : listedWaves.some((wave) => wave?.state === "dispatching") ? "dispatching"
      : listedWaves.length > 0 && listedWaves.every((wave) => wave?.state === "completed") ? "completed" : "planned";
  const manifestValid = safeData(manifest) && validateImageAssetManifest(manifest).ok;
  const receiptValid = validateCutsceneContinuityReview(continuityReceipt).ok;
  const receiptBound = receiptValid && currentPlanSha256 !== undefined && continuityReceipt.planSha256 === currentPlanSha256;
  const blockerIds = receiptBound ? [...continuityReceipt.blockingFindingIds] : [];
  const assets = manifestValid && Array.isArray(manifest.assets) ? manifest.assets : [];
  const documentApproved = manifestValid && wavesValid && receiptBound && blockerIds.length === 0 && assets.length > 0 && assets.every((asset) => ["document-approved", "production-candidate"].includes(asset.approval_state));
  const productionCandidate = documentApproved && assets.every((asset) => asset.approval_state === "production-candidate");
  return { lifecycle: blockerIds.length > 0 ? "blocked" : lifecycle, documentApproved, productionCandidate, blockerIds };
}
