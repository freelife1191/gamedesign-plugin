import { createHash } from "node:crypto";

import { validateImageAssetManifest } from "./validate-image-assets.mjs";
import { isRfc3339DateTime } from "./lib/rfc3339.mjs";

const WAVE_IDS = ["style-master", "reference-masters", "keyframes", "storyboard"];
const WAVE_STATES = ["planned", "template-ready", "generation-ready", "cost-estimated", "approval-pending", "approved", "dispatching", "completed", "blocked", "invalidated"];
const MODES = ["prompt-only", "estimate-only", "generate-after-approval"];
const SHA256 = /^[a-f0-9]{64}$/u;
const CUTSCENE_ID = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u;
const RECORD_ID = /^[A-Za-z][A-Za-z0-9._:-]*$/u;
const OPAQUE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
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

export function snapshotCutscenePlainData(value) {
  const hostile = (path) => { throw Object.assign(new TypeError("Cutscene input must be plain data."), { code: "cutscene.hostile_input", path }); };
  const copy = (current, path, stack = new Set()) => {
    if (current === null || typeof current === "boolean" || typeof current === "string") return current;
    if (typeof current === "number") return Number.isFinite(current) ? current : hostile(path);
    if (typeof current !== "object" || stack.has(current)) hostile(path);
    let keys; let descriptors; let prototype;
    try { keys = Reflect.ownKeys(current); descriptors = Object.getOwnPropertyDescriptors(current); prototype = Object.getPrototypeOf(current); } catch { hostile(path); }
    if (Array.isArray(current)) {
      const length = descriptors.length;
      if (!length || "get" in length || "set" in length || !Number.isSafeInteger(length.value) || length.value < 0 || keys.length !== length.value + 1 || !keys.includes("length")) hostile(path);
      const output = [];
      stack.add(current);
      for (let index = 0; index < length.value; index += 1) {
        const descriptor = descriptors[String(index)];
        if (!descriptor || !descriptor.enumerable || "get" in descriptor || "set" in descriptor) hostile(`${path}/${index}`);
        output.push(copy(descriptor.value, `${path}/${index}`, stack));
      }
      stack.delete(current);
      return output;
    }
    if (prototype !== Object.prototype) hostile(path);
    const output = {};
    stack.add(current);
    for (const key of keys) {
      const descriptor = descriptors[key];
      if (typeof key !== "string" || !descriptor?.enumerable || "get" in descriptor || "set" in descriptor) hostile(`${path}/${String(key)}`);
      Object.defineProperty(output, key, { value: copy(descriptor.value, `${path}/${key}`, stack), enumerable: true, writable: true, configurable: true });
    }
    stack.delete(current);
    return output;
  };
  return copy(value, "");
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

function validateCompletion(value, state, path, issue, expectedAssetIds) {
  const requiredKind = state === "template-ready" || state === "generation-ready" ? state : state === "completed" ? "completed" : undefined;
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
    if (!Array.isArray(value.assetIds) || !Array.isArray(expectedAssetIds) || value.assetIds.length !== expectedAssetIds.length || value.assetIds.some((id, index) => id !== expectedAssetIds[index])) issue("cutscene.completion_asset_set_mismatch", `${path}/assetIds`);
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

function validateInvalidationHistory(value, path, issue) {
  if (!Array.isArray(value)) { issue("cutscene.invalidation_history_invalid", path); return; }
  value.forEach((entry, index) => {
    validateTransition(entry, entry?.toState, `${path}/${index}`, issue);
    if (entry?.toState !== "invalidated") issue("cutscene.transition_invalid", `${path}/${index}/toState`);
  });
}

function validateWave(value, index, mode, issue) {
  const path = `/cutsceneWorkflow/waves/${index}`;
  if (!plainObject(value)) { issue("cutscene.wave_object_required", path); return; }
  const keys = ["id", "state", "assetIds", "estimate", "approval", "attempts", "completion", "invalidation", "invalidationHistory"];
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
  validateCompletion(value.completion, value.state, `${path}/completion`, issue, value.assetIds);
  validateTransition(value.invalidation, value.state, `${path}/invalidation`, issue);
  validateInvalidationHistory(value.invalidationHistory, `${path}/invalidationHistory`, issue);
  if (mode === "prompt-only" && value.estimate !== null) issue("cutscene.mode_evidence_forbidden", `${path}/estimate`);
  if (mode === "prompt-only" && (value.approval !== null || value.attempts?.length > 0 || value.completion?.kind === "generation-ready" || value.completion?.kind === "completed")) issue("cutscene.mode_evidence_forbidden", `${path}/attempts`);
  if (mode === "estimate-only" && (value.approval !== null || value.attempts?.length > 0 || value.completion?.kind === "completed")) issue("cutscene.mode_evidence_forbidden", `${path}/attempts`);
}

function validateForwardDag(downstream, issue) {
  if (!Array.isArray(downstream)) { issue("cutscene.dag_invalid", "/cutsceneWorkflow/downstream"); return; }
  let previous;
  downstream.forEach((edge, index) => {
    const path = `/cutsceneWorkflow/downstream/${index}`;
    closed(edge, ["fromWaveId", "toWaveId"], path, issue, { unknownCode: "cutscene.dag_unknown_key", requiredCode: "cutscene.dag_required" });
    const from = WAVE_IDS.indexOf(edge?.fromWaveId); const to = WAVE_IDS.indexOf(edge?.toWaveId);
    if (from < 0) issue("cutscene.dag_reference_unknown", `${path}/fromWaveId`);
    if (to < 0) issue("cutscene.dag_reference_unknown", `${path}/toWaveId`);
    if (from >= 0 && to >= 0 && from >= to) issue("cutscene.dag_not_forward", `${path}/toWaveId`);
    const sortable = typeof edge?.fromWaveId === "string" && typeof edge?.toWaveId === "string" && from >= 0 && to >= 0;
    if (sortable) {
      const key = `${edge.fromWaveId}\0${edge.toWaveId}`;
      if (previous !== undefined && compareUtf8(previous, key) >= 0) issue("cutscene.dag_unsorted_or_duplicate", "/cutsceneWorkflow/downstream");
      previous = key;
    }
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
    else value.beats.forEach((beat, index) => { closed(beat, ["beatId"], `/beats/${index}`, issue, { unknownCode: "cutscene.beat_unknown_key", requiredCode: "cutscene.beat_required" }); const current = beat?.beatId; const previous = index > 0 ? value.beats[index - 1]?.beatId : undefined; const valid = typeof current === "string" && RECORD_ID.test(current); if (!valid) issue("cutscene.beat_id_invalid", `/beats/${index}/beatId`); if (valid) beatIds.add(current); if (index > 0 && typeof previous === "string" && RECORD_ID.test(previous) && valid && compareUtf8(previous, current) >= 0) issue("cutscene.ids_unsorted_or_duplicate", "/beats"); });
    if (!Array.isArray(value?.shots) || value.shots.length === 0) issue("cutscene.shots_empty", "/shots");
    else value.shots.forEach((shot, index) => { closed(shot, ["shotId", "beatId"], `/shots/${index}`, issue, { unknownCode: "cutscene.shot_unknown_key", requiredCode: "cutscene.shot_required" }); const current = shot?.shotId; const previous = index > 0 ? value.shots[index - 1]?.shotId : undefined; const valid = typeof current === "string" && RECORD_ID.test(current); if (!valid) issue("cutscene.shot_id_invalid", `/shots/${index}/shotId`); if (!beatIds.has(shot?.beatId)) issue("cutscene.shot_beat_unknown", `/shots/${index}/beatId`); if (index > 0 && typeof previous === "string" && RECORD_ID.test(previous) && valid && compareUtf8(previous, current) >= 0) issue("cutscene.ids_unsorted_or_duplicate", "/shots"); });
    closed(value?.cutsceneWorkflow, ["schemaVersion", "waves", "downstream", "derived"], "/cutsceneWorkflow", issue, { unknownCode: "cutscene.workflow_unknown_key", requiredCode: "cutscene.workflow_required" });
    if (value?.cutsceneWorkflow?.schemaVersion !== 1) issue("cutscene.workflow_schema_version_invalid", "/cutsceneWorkflow/schemaVersion");
    if (!Array.isArray(value?.cutsceneWorkflow?.waves) || value.cutsceneWorkflow.waves.length !== WAVE_IDS.length) issue("cutscene.wave_count_invalid", "/cutsceneWorkflow/waves");
    else value.cutsceneWorkflow.waves.forEach((wave, index) => validateWave(wave, index, value.mode, issue));
    validateForwardDag(value?.cutsceneWorkflow?.downstream, issue);
    closed(value?.cutsceneWorkflow?.derived, [], "/cutsceneWorkflow/derived", issue, { unknownCode: "cutscene.derived_unknown_key", requiredCode: "cutscene.derived_invalid" });
  });
}

function validateCost(value, issue) {
  closed(value, ["schemaVersion", "sha256", "waveId", "assetIds", "planSha256", "pricingSnapshotSha256", "retryReserve", "costStatus", "attemptCeilings", "minimumUsd", "expectedUsd", "maximumUsd"], "", issue);
  if (value?.schemaVersion !== 2) issue("cutscene.schema_version_invalid", "/schemaVersion");
  for (const field of ["sha256", "planSha256", "pricingSnapshotSha256"]) if (!isHash(value?.[field])) issue("cutscene.hash_invalid", `/${field}`);
  if (!WAVE_IDS.includes(value?.waveId)) issue("cutscene.wave_id_invalid", "/waveId");
  nonEmptySortedUnique(value?.assetIds, "/assetIds", issue, { emptyCode: "cutscene.asset_ids_empty", predicate: (id) => CUTSCENE_ID.test(id ?? "") });
  if (!Number.isInteger(value?.retryReserve) || value.retryReserve < 0) issue("cutscene.retry_reserve_invalid", "/retryReserve");
  if (!["available", "unavailable"].includes(value?.costStatus)) issue("cutscene.cost_status_invalid", "/costStatus");
  if (!Array.isArray(value?.attemptCeilings) || value.attemptCeilings.length !== value?.assetIds?.length) issue("cutscene.attempt_ceilings_invalid", "/attemptCeilings");
  else value.attemptCeilings.forEach((ceiling, index) => {
    closed(ceiling, ["assetId", "requestSha256", "maximumUsd"], `/attemptCeilings/${index}`, issue);
    if (ceiling?.assetId !== value.assetIds[index]) issue("cutscene.attempt_ceiling_asset_mismatch", `/attemptCeilings/${index}/assetId`);
    if (!isHash(ceiling?.requestSha256)) issue("cutscene.hash_invalid", `/attemptCeilings/${index}/requestSha256`);
    if (!(ceiling?.maximumUsd === null || typeof ceiling.maximumUsd === "number" && Number.isFinite(ceiling.maximumUsd) && ceiling.maximumUsd > 0)) issue("cutscene.cost_invalid", `/attemptCeilings/${index}/maximumUsd`);
  });
  if (value?.costStatus === "available") {
    for (const field of ["minimumUsd", "expectedUsd", "maximumUsd"]) if (typeof value?.[field] !== "number" || !Number.isFinite(value[field]) || value[field] <= 0) issue("cutscene.cost_invalid", `/${field}`);
    if (value?.attemptCeilings?.some(({ maximumUsd }) => maximumUsd === null)) issue("cutscene.cost_status_invalid", "/costStatus");
    if (Array.isArray(value?.attemptCeilings) && value.attemptCeilings.length > 0 && value.attemptCeilings.every(({ maximumUsd }) => typeof maximumUsd === "number" && Number.isFinite(maximumUsd) && maximumUsd > 0)) {
      const baseline = value.attemptCeilings.reduce((total, { maximumUsd }) => total + maximumUsd, 0);
      const maximum = baseline + value.retryReserve * Math.max(...value.attemptCeilings.map(({ maximumUsd }) => maximumUsd));
      if (value.minimumUsd !== baseline || value.expectedUsd !== baseline || value.maximumUsd !== maximum) issue("cutscene.cost_range_invalid", "/maximumUsd");
    }
  } else if (value?.costStatus === "unavailable") {
    for (const field of ["minimumUsd", "expectedUsd", "maximumUsd"]) if (value?.[field] !== null) issue("cutscene.cost_invalid", `/${field}`);
    if (Array.isArray(value?.attemptCeilings) && !value.attemptCeilings.some(({ maximumUsd }) => maximumUsd === null)) issue("cutscene.cost_status_invalid", "/costStatus");
  }
}

export function validateCutsceneCostEstimate(value) { return resultOf(value, (issue) => validateCost(value, issue)); }

export function validateCutsceneGenerationApproval(value) {
  return resultOf(value, (issue) => {
    closed(value, ["schemaVersion", "eventId", "actor", "reviewer", "decision", "decidedAt", "waveId", "assetIds", "maximumApprovedUsd", "retryReserve", "planSha256", "promptPackageSha256", "referenceBindings", "pricingSnapshotSha256", "costEstimateSha256"], "", issue);
    if (value?.schemaVersion !== 2) issue("cutscene.schema_version_invalid", "/schemaVersion");
    for (const field of ["eventId", "actor", "reviewer"]) if (!isText(value?.[field])) issue("cutscene.text_invalid", `/${field}`);
    if (value?.decision !== "approved") issue("cutscene.approval_decision_invalid", "/decision");
    if (!isRfc3339DateTime(value?.decidedAt)) issue("cutscene.timestamp_invalid", "/decidedAt");
    if (!WAVE_IDS.includes(value?.waveId)) issue("cutscene.wave_id_invalid", "/waveId");
    nonEmptySortedUnique(value?.assetIds, "/assetIds", issue, { emptyCode: "cutscene.asset_ids_empty", predicate: (id) => CUTSCENE_ID.test(id ?? "") });
    if (typeof value?.maximumApprovedUsd !== "number" || !Number.isFinite(value.maximumApprovedUsd) || value.maximumApprovedUsd <= 0) issue("cutscene.maximum_approved_usd_invalid", "/maximumApprovedUsd");
    if (!Number.isInteger(value?.retryReserve) || value.retryReserve < 0) issue("cutscene.retry_reserve_invalid", "/retryReserve");
    for (const field of ["planSha256", "promptPackageSha256", "pricingSnapshotSha256", "costEstimateSha256"]) if (!isHash(value?.[field])) issue("cutscene.hash_invalid", `/${field}`);
    if (!Array.isArray(value?.referenceBindings) || value.referenceBindings.length === 0) issue("cutscene.reference_bindings_empty", "/referenceBindings");
    else value.referenceBindings.forEach((binding, index) => { closed(binding, ["assetId", "sha256"], `/referenceBindings/${index}`, issue); const current = binding?.assetId; const previous = index > 0 ? value.referenceBindings[index - 1]?.assetId : undefined; const valid = typeof current === "string" && CUTSCENE_ID.test(current); if (!valid) issue("cutscene.reference_asset_id_invalid", `/referenceBindings/${index}/assetId`); if (!isHash(binding?.sha256)) issue("cutscene.hash_invalid", `/referenceBindings/${index}/sha256`); if (index > 0 && typeof previous === "string" && CUTSCENE_ID.test(previous) && valid && compareUtf8(previous, current) >= 0) issue("cutscene.ids_unsorted_or_duplicate", "/referenceBindings"); });
  });
}

export function validateCutsceneGenerationUsage(value) {
  return resultOf(value, (issue) => {
    const authorization = value?.kind === "authorization";
    const keys = authorization
      ? ["schemaVersion", "kind", "waveId", "assetId", "attemptId", "attemptSequence", "assetAttemptOrdinal", "requestSha256", "pricingSnapshotSha256", "costEstimateSha256", "authorizedMaximumUsd", "authorizedAt", "sha256"]
      : ["schemaVersion", "kind", "waveId", "assetId", "attemptId", "attemptSequence", "assetAttemptOrdinal", "authorizationSha256", "providerRequestId", "providerOutcome", "assetOutcome", "retryDisposition", "usage", "actualCost", "completedAt", "sha256"];
    closed(value, keys, "", issue);
    if (value?.schemaVersion !== 2) issue("cutscene.schema_version_invalid", "/schemaVersion");
    if (!authorization && value?.kind !== "outcome") issue("cutscene.journal_kind_invalid", "/kind");
    if (!WAVE_IDS.includes(value?.waveId)) issue("cutscene.wave_id_invalid", "/waveId");
    if (!CUTSCENE_ID.test(value?.assetId ?? "")) issue("cutscene.asset_id_invalid", "/assetId");
    if (!OPAQUE_ID.test(value?.attemptId ?? "")) issue("cutscene.text_invalid", "/attemptId");
    for (const field of ["attemptSequence", "assetAttemptOrdinal"]) if (!Number.isInteger(value?.[field]) || value[field] < 1) issue("cutscene.attempt_ordinal_invalid", `/${field}`);
    if (!isHash(value?.sha256) || value?.sha256 !== cutsceneDocumentSha256(Object.fromEntries(Object.entries(value ?? {}).filter(([key]) => key !== "sha256")))) issue("cutscene.hash_invalid", "/sha256");
    if (authorization) {
      for (const field of ["requestSha256", "pricingSnapshotSha256", "costEstimateSha256"]) if (!isHash(value?.[field])) issue("cutscene.hash_invalid", `/${field}`);
      if (typeof value?.authorizedMaximumUsd !== "number" || !Number.isFinite(value.authorizedMaximumUsd) || value.authorizedMaximumUsd <= 0) issue("cutscene.cost_invalid", "/authorizedMaximumUsd");
      if (!isRfc3339DateTime(value?.authorizedAt)) issue("cutscene.timestamp_invalid", "/authorizedAt");
      return;
    }
    if (!isHash(value?.authorizationSha256)) issue("cutscene.hash_invalid", "/authorizationSha256");
    if (!OPAQUE_ID.test(value?.providerRequestId ?? "")) issue("cutscene.text_invalid", "/providerRequestId");
    if (!["success", "provider-failure", "transport-failure", "not-called"].includes(value?.providerOutcome)) issue("cutscene.provider_outcome_invalid", "/providerOutcome");
    if (!["success", "retryable-failure", "terminal-failure", "not-attempted"].includes(value?.assetOutcome)) issue("cutscene.asset_outcome_invalid", "/assetOutcome");
    if (!["retryable", "none"].includes(value?.retryDisposition)) issue("cutscene.retry_disposition_invalid", "/retryDisposition");
    if ((value?.providerOutcome === "not-called") !== (value?.assetOutcome === "not-attempted")) issue("cutscene.provider_asset_outcome_mismatch", "/assetOutcome");
    if ((value?.assetOutcome === "retryable-failure") !== (value?.retryDisposition === "retryable")) issue("cutscene.retry_disposition_mismatch", "/retryDisposition");
    if (!plainObject(value?.usage)) issue("cutscene.usage_invalid", "/usage");
    else if (value.usage.status === "unavailable") {
      closed(value.usage, ["status", "reason"], "/usage", issue);
      if (!["provider-not-called", "provider-usage-unavailable", "provider-usage-invalid"].includes(value.usage.reason)) issue("cutscene.usage_invalid", "/usage/reason");
    } else {
      const required = ["inputTokens", "inputTextTokens", "inputImageTokens", "outputTokens", "totalTokens"];
      const optional = ["cachedTextTokens", "cachedImageTokens"];
      for (const key of Reflect.ownKeys(value.usage)) if (typeof key !== "string" || ![...required, ...optional].includes(key)) issue("cutscene.unknown_key", `/usage/${String(key)}`);
      for (const field of required) if (!Number.isInteger(value.usage[field]) || value.usage[field] < 0) issue("cutscene.usage_token_invalid", `/usage/${field}`);
      for (const field of optional) if (value.usage[field] !== undefined && (!Number.isInteger(value.usage[field]) || value.usage[field] < 0)) issue("cutscene.usage_token_invalid", `/usage/${field}`);
      if (value.usage.inputTokens !== value.usage.inputTextTokens + value.usage.inputImageTokens) issue("cutscene.usage_input_mismatch", "/usage/inputTokens");
      if (value.usage.totalTokens !== value.usage.inputTokens + value.usage.outputTokens) issue("cutscene.usage_total_mismatch", "/usage/totalTokens");
      if (value.usage.cachedTextTokens > value.usage.inputTextTokens) issue("cutscene.cached_text_exceeds_input", "/usage/cachedTextTokens");
      if (value.usage.cachedImageTokens > value.usage.inputImageTokens) issue("cutscene.cached_image_exceeds_input", "/usage/cachedImageTokens");
    }
    if (!plainObject(value?.actualCost) || !["known", "unavailable"].includes(value.actualCost.status)) issue("cutscene.cost_invalid", "/actualCost");
    else if (value.actualCost.status === "known") {
      closed(value.actualCost, ["status", "usd"], "/actualCost", issue);
      if (typeof value.actualCost.usd !== "number" || !Number.isFinite(value.actualCost.usd) || value.actualCost.usd < 0) issue("cutscene.cost_invalid", "/actualCost/usd");
    } else {
      closed(value.actualCost, ["status", "reason"], "/actualCost", issue);
      if (!["provider-usage-unavailable", "provider-usage-invalid", "cached-token-breakdown-unavailable"].includes(value.actualCost.reason)) issue("cutscene.cost_invalid", "/actualCost/reason");
    }
    if (value?.providerOutcome !== "not-called" && value?.usage?.status === "unavailable"
      && (value?.actualCost?.status !== "unavailable" || value.actualCost.reason !== value.usage.reason)) issue("cutscene.usage_cost_reason_mismatch", "/actualCost/reason");
    if (value?.providerOutcome !== "not-called" && value?.usage?.reason === "provider-not-called") issue("cutscene.provider_not_called_usage_forbidden", "/usage/reason");
    if (value?.providerOutcome === "not-called" && value?.usage?.reason !== "provider-not-called") issue("cutscene.not_called_usage_invalid", "/usage/reason");
    if (value?.providerOutcome === "not-called" && (value?.actualCost?.status !== "known" || value.actualCost.usd !== 0)) issue("cutscene.not_called_cost_invalid", "/actualCost");
    if (!isRfc3339DateTime(value?.completedAt)) issue("cutscene.timestamp_invalid", "/completedAt");
  });
}

export function validateCutsceneContinuityReview(value) {
  return resultOf(value, (issue) => {
    closed(value, ["schemaVersion", "cutsceneId", "planSha256", "manifestSha256", "reviewedAt", "findings", "blockingFindingIds"], "", issue);
    if (value?.schemaVersion !== 1) issue("cutscene.schema_version_invalid", "/schemaVersion");
    if (!CUTSCENE_ID.test(value?.cutsceneId ?? "")) issue("cutscene.cutscene_id_invalid", "/cutsceneId");
    if (!isHash(value?.planSha256)) issue("cutscene.hash_invalid", "/planSha256");
    if (!isHash(value?.manifestSha256)) issue("cutscene.hash_invalid", "/manifestSha256");
    if (!isRfc3339DateTime(value?.reviewedAt)) issue("cutscene.timestamp_invalid", "/reviewedAt");
    const expectedBlockers = [];
    const findingDocuments = new Set();
    if (!Array.isArray(value?.findings)) issue("cutscene.findings_invalid", "/findings");
    else value.findings.forEach((finding, index) => {
      const path = `/findings/${index}`;
      const keys = ["findingId", "code", "path", "sourceMasterIds", "affectedAssetIds", "blocking"];
      const findingObject = closed(finding, keys, path, issue);
      const closedShape = findingObject && Reflect.ownKeys(finding).length === keys.length && keys.every((key) => Object.hasOwn(finding, key));
      const validFindingId = typeof finding?.findingId === "string" && RECORD_ID.test(finding.findingId);
      const validCode = isText(finding?.code);
      const validPath = isText(finding?.path);
      const sourceMasterIdsAreStrings = Array.isArray(finding?.sourceMasterIds) && finding.sourceMasterIds.every((id) => typeof id === "string");
      const affectedAssetIdsAreStrings = Array.isArray(finding?.affectedAssetIds) && finding.affectedAssetIds.every((id) => typeof id === "string");
      const validBlocking = typeof finding?.blocking === "boolean";
      if (!validFindingId) issue("cutscene.finding_id_invalid", `${path}/findingId`);
      if (!validCode) issue("cutscene.finding_code_invalid", `${path}/code`);
      if (!validPath) issue("cutscene.finding_path_invalid", `${path}/path`);
      nonEmptySortedUnique(finding?.sourceMasterIds, `${path}/sourceMasterIds`, issue, { predicate: (id) => CUTSCENE_ID.test(id ?? "") });
      nonEmptySortedUnique(finding?.affectedAssetIds, `${path}/affectedAssetIds`, issue, { predicate: (id) => CUTSCENE_ID.test(id ?? "") });
      if (!validBlocking) issue("cutscene.finding_blocking_invalid", `${path}/blocking`);
      if (closedShape && typeof finding.findingId === "string" && typeof finding.code === "string" && typeof finding.path === "string" && sourceMasterIdsAreStrings && affectedAssetIdsAreStrings && validBlocking) {
        const document = canonicalCutsceneDocument(finding);
        if (findingDocuments.has(document)) issue("cutscene.findings_duplicate", path);
        findingDocuments.add(document);
      }
      if (finding?.blocking === true && validFindingId) expectedBlockers.push(finding.findingId);
    });
    if (!Array.isArray(value?.blockingFindingIds)) issue("cutscene.blockers_invalid", "/blockingFindingIds");
    else {
      value.blockingFindingIds.forEach((id, index) => { const previous = index > 0 ? value.blockingFindingIds[index - 1] : undefined; const valid = typeof id === "string" && RECORD_ID.test(id); if (!valid) issue("cutscene.id_invalid", `/blockingFindingIds/${index}`); if (index > 0 && typeof previous === "string" && RECORD_ID.test(previous) && valid && compareUtf8(previous, id) >= 0) issue("cutscene.ids_unsorted_or_duplicate", "/blockingFindingIds"); });
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

function continuityAssetProjection(asset) {
  return {
    assetId: asset.asset_id,
    assetSetId: asset.asset_set_id,
    derivativeOf: asset.derivative_of,
    referenceAssetIds: asset.reference_asset_ids,
    referenceImages: asset.reference_images,
    consistencyProfile: asset.consistency_profile,
    promptLineage: asset.prompt_lineage,
    promptSha256: asset.prompt_sha256,
    approvalBindingSha256: asset.approval_binding_sha256,
    generationState: asset.generation_state,
    planningTargetOutput: asset.planning?.target_output,
    output: asset.output,
    provider: asset.provider,
    generationReceipts: asset.generation_receipts ?? [],
  };
}

export function cutsceneContinuityManifestSha256(manifest) {
  if (!safeData(manifest) || !plainObject(manifest) || !Array.isArray(manifest.assets) || !plainObject(manifest.cutsceneWorkflow)) throw new TypeError("A canonical cutscene manifest is required.");
  return cutsceneDocumentSha256({
    schemaVersion: manifest.schema_version,
    cutsceneWorkflow: manifest.cutsceneWorkflow,
    assets: manifest.assets.map(continuityAssetProjection),
  });
}

function sameDocument(left, right) {
  try { return canonicalCutsceneDocument(left) === canonicalCutsceneDocument(right); } catch { return false; }
}

function manifestMatchesCurrentPlan(plan, manifest) {
  if (!safeData(manifest) || !validateImageAssetManifest(manifest).ok || !plainObject(manifest.cutsceneWorkflow)) return false;
  const expectedWaves = plan.cutsceneWorkflow.waves.map(({ id, assetIds }) => ({ id, assetIds }));
  if (!sameDocument(manifest.cutsceneWorkflow.waves, expectedWaves)) return false;
  if (manifest.cutsceneWorkflow.dagSha256 !== cutsceneDocumentSha256(plan.cutsceneWorkflow.downstream)) return false;
  const expectedIds = plan.cutsceneWorkflow.waves.flatMap((wave) => wave.assetIds).sort(compareUtf8);
  const actualIds = manifest.assets.map((asset) => asset?.asset_id).sort(compareUtf8);
  if (!sameDocument(actualIds, expectedIds)) return false;
  const planSha256 = cutsceneDocumentSha256(plan);
  const dagSha256 = cutsceneDocumentSha256(plan.cutsceneWorkflow.downstream);
  return manifest.assets.every((asset) => {
    const promptSha256 = typeof asset?.prompt === "string" ? createHash("sha256").update(asset.prompt).digest("hex") : undefined;
    return asset?.asset_set_id === plan.cutsceneId && promptSha256 === asset?.prompt_sha256
      && asset?.approval_binding_sha256 === cutsceneDocumentSha256({ assetId: asset.asset_id, dagSha256, planSha256, promptSha256 });
  });
}

export function assertCutsceneContinuityGate({ plan, manifest, waves, continuityReceipt } = {}) {
  const failure = (message, code, path) => { throw Object.assign(new Error(message), { code, path }); };
  if (!validateCutsceneVisualPlan(plan).ok) failure("Cutscene plan is invalid.", "cutscene.plan_invalid", "/plan");
  if (!sameDocument(waves, plan.cutsceneWorkflow.waves)) failure("Cutscene waves are stale.", "cutscene.waves_stale", "/waves");
  if (!manifestMatchesCurrentPlan(plan, manifest)) failure("Cutscene manifest is stale.", "cutscene.manifest_stale", "/manifest");
  if (!validateCutsceneContinuityReview(continuityReceipt).ok) failure("Cutscene continuity receipt is invalid.", "cutscene.continuity_receipt_invalid", "/continuityReceipt");
  if (continuityReceipt.cutsceneId !== plan.cutsceneId) failure("Cutscene continuity receipt belongs to another cutscene.", "cutscene.continuity_cutscene_stale", "/continuityReceipt/cutsceneId");
  if (continuityReceipt.planSha256 !== cutsceneDocumentSha256(plan)) failure("Cutscene continuity receipt plan is stale.", "cutscene.continuity_plan_stale", "/continuityReceipt/planSha256");
  if (continuityReceipt.manifestSha256 !== cutsceneContinuityManifestSha256(manifest)) failure("Cutscene continuity receipt manifest is stale.", "cutscene.continuity_manifest_stale", "/continuityReceipt/manifestSha256");
  if (continuityReceipt.blockingFindingIds.length > 0) failure("Cutscene continuity has blocking findings.", "cutscene.continuity_blocking_findings", "/continuityReceipt/blockingFindingIds");
  const unfinished = waves.findIndex((wave) => wave.state !== "completed");
  if (unfinished >= 0) failure("Cutscene wave is incomplete.", "cutscene.wave_not_completed", `/waves/${unfinished}/state`);
  const incomplete = waves.findIndex((wave) => wave.completion?.kind !== "completed" || !sameDocument(wave.completion.assetIds, wave.assetIds));
  if (incomplete >= 0) failure("Cutscene completion asset set is stale.", "cutscene.wave_completion_asset_set_stale", `/waves/${incomplete}/completion/assetIds`);
  const notCandidate = manifest.assets.findIndex((asset) => asset.approval_state !== "production-candidate");
  if (notCandidate >= 0) failure("Cutscene asset is not production-candidate.", "cutscene.asset_not_production_candidate", `/manifest/assets/${notCandidate}/approval_state`);
}

export function deriveCutsceneLifecycle({ plan, manifest, waves, continuityReceipt } = {}) {
  const planValid = validateCutsceneVisualPlan(plan).ok;
  const currentPlanSha256 = planValid ? cutsceneDocumentSha256(plan) : undefined;
  const listedWaves = Array.isArray(waves) && safeData(waves) ? waves : [];
  const wavesValid = planValid && sameDocument(listedWaves, plan.cutsceneWorkflow.waves)
    && validateCutsceneVisualPlan({ ...plan, cutsceneWorkflow: { ...plan.cutsceneWorkflow, waves: listedWaves } }).ok;
  const lifecycle = listedWaves.some((wave) => wave?.state === "blocked" || wave?.state === "invalidated") ? "blocked"
    : listedWaves.some((wave) => wave?.state === "dispatching") ? "dispatching"
      : listedWaves.length > 0 && listedWaves.every((wave) => wave?.state === "completed") ? "completed" : "planned";
  const manifestValid = planValid && manifestMatchesCurrentPlan(plan, manifest);
  const receiptValid = validateCutsceneContinuityReview(continuityReceipt).ok;
  const receiptBound = receiptValid && currentPlanSha256 !== undefined && continuityReceipt.planSha256 === currentPlanSha256
    && continuityReceipt.cutsceneId === plan?.cutsceneId && manifestValid && continuityReceipt.manifestSha256 === cutsceneContinuityManifestSha256(manifest);
  const blockerIds = receiptBound ? [...continuityReceipt.blockingFindingIds] : [];
  const assets = manifestValid && Array.isArray(manifest.assets) ? manifest.assets : [];
  const documentApproved = manifestValid && wavesValid && receiptBound && blockerIds.length === 0 && listedWaves.every((wave) => wave.state === "completed") && assets.length > 0 && assets.every((asset) => ["document-approved", "production-candidate"].includes(asset.approval_state));
  const productionCandidate = documentApproved && assets.every((asset) => asset.approval_state === "production-candidate");
  return { lifecycle: blockerIds.length > 0 ? "blocked" : lifecycle, documentApproved, productionCandidate, blockerIds };
}
