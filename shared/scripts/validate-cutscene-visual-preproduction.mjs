import { createHash } from "node:crypto";

const WAVE_IDS = ["style-master", "reference-masters", "keyframes", "storyboard"];
const WAVE_STATES = ["planned", "template-ready", "generation-ready", "cost-estimated", "approval-pending", "approved", "dispatching", "completed", "blocked", "invalidated"];
const MODES = ["prompt-only", "estimate-only", "generate-after-approval"];
const SHA256 = /^[a-f0-9]{64}$/u;
const CUTSCENE_ID = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u;
const RECORD_ID = /^[A-Za-z][A-Za-z0-9._:-]*$/u;

const isPlainObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
const isText = (value) => typeof value === "string" && value.length > 0 && value === value.normalize("NFC") && !/[\0\r\n]/u.test(value);
const isHash = (value) => typeof value === "string" && SHA256.test(value);
const compareUtf8 = (left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right));

function resultOf(validate) {
  const errors = [];
  const issue = (code, path) => errors.push({ code, path });
  try { validate(issue); } catch { issue("cutscene.input_invalid", ""); }
  return { ok: errors.length === 0, errors };
}

function closed(value, keys, path, issue, { unknownCode = "cutscene.unknown_key", requiredCode = "cutscene.required" } = {}) {
  if (!isPlainObject(value)) { issue("cutscene.object_required", path); return false; }
  for (const key of keys) if (!Object.hasOwn(value, key)) issue(requiredCode, `${path}/${key}`);
  for (const key of Reflect.ownKeys(value)) if (typeof key !== "string" || !keys.includes(key)) issue(unknownCode, `${path}/${String(key)}`);
  return true;
}

function nonEmptySortedUnique(values, path, issue, { code = "cutscene.ids_unsorted_or_duplicate", emptyCode = "cutscene.array_empty", predicate = isText } = {}) {
  if (!Array.isArray(values) || values.length === 0) { issue(emptyCode, path); return false; }
  for (const [index, value] of values.entries()) if (!predicate(value)) issue("cutscene.id_invalid", `${path}/${index}`);
  for (let index = 1; index < values.length; index += 1) if (typeof values[index - 1] !== "string" || typeof values[index] !== "string" || compareUtf8(values[index - 1], values[index]) >= 0) { issue(code, path); break; }
  return true;
}

function nullableRecord(value, path, issue, code) {
  if (value !== null && !isPlainObject(value)) issue(code, path);
}

function validateReference(value, path, issue, kind) {
  if (kind === "template-ready") {
    if (Object.hasOwn(value ?? {}, "sha256")) issue("cutscene.template_hash_forbidden", `${path}/sha256`);
    closed(value, ["assetId", "expectedPath"], path, issue, { unknownCode: "cutscene.template_reference_unknown_key", requiredCode: "cutscene.template_reference_required" });
    if (!CUTSCENE_ID.test(value?.assetId ?? "")) issue("cutscene.reference_asset_id_invalid", `${path}/assetId`);
    if (!isText(value?.expectedPath) || !value.expectedPath.startsWith("assets/")) issue("cutscene.expected_path_invalid", `${path}/expectedPath`);
    return;
  }
  if (!isHash(value?.sha256)) issue("cutscene.bound_hash_required", `${path}/sha256`);
  closed(value, ["assetId", "sha256"], path, issue, { unknownCode: "cutscene.bound_reference_unknown_key", requiredCode: "cutscene.bound_reference_required" });
  if (!CUTSCENE_ID.test(value?.assetId ?? "")) issue("cutscene.reference_asset_id_invalid", `${path}/assetId`);
}

function validateCompletion(value, state, path, issue) {
  if (value === null) return;
  if (!isPlainObject(value)) { issue("cutscene.completion_invalid", path); return; }
  const kind = value.kind;
  if (kind !== "template-ready" && kind !== "generation-ready") { issue("cutscene.completion_kind_invalid", `${path}/kind`); return; }
  closed(value, ["kind", "references"], path, issue, { unknownCode: "cutscene.completion_unknown_key", requiredCode: "cutscene.completion_required" });
  if (!Array.isArray(value.references) || value.references.length === 0) { issue("cutscene.references_empty", `${path}/references`); return; }
  value.references.forEach((reference, index) => validateReference(reference, `${path}/references/${index}`, issue, kind));
  if (state === "template-ready" && kind !== "template-ready") issue("cutscene.template_completion_required", `${path}/kind`);
  if (state === "generation-ready" && kind !== "generation-ready") issue("cutscene.bound_completion_required", `${path}/kind`);
}

function validateWave(value, index, issue) {
  const path = `/cutsceneWorkflow/waves/${index}`;
  if (!isPlainObject(value)) { issue("cutscene.wave_object_required", path); return; }
  const keys = ["id", "state", "assetIds", "estimate", "approval", "attempts", "completion", "invalidation"];
  for (const key of keys) if (!Object.hasOwn(value, key)) issue(key === "state" ? "cutscene.wave_state_required" : "cutscene.wave_required", `${path}/${key}`);
  for (const key of Reflect.ownKeys(value)) if (typeof key !== "string" || !keys.includes(key)) issue("cutscene.wave_unknown_key", `${path}/${String(key)}`);
  if (value.id !== WAVE_IDS[index]) issue("cutscene.wave_order_invalid", `${path}/id`);
  if (!WAVE_STATES.includes(value.state)) issue("cutscene.wave_state_invalid", `${path}/state`);
  nonEmptySortedUnique(value.assetIds, `${path}/assetIds`, issue, { emptyCode: "cutscene.wave_asset_ids_empty", predicate: (id) => CUTSCENE_ID.test(id ?? "") });
  nullableRecord(value.estimate, `${path}/estimate`, issue, "cutscene.wave_estimate_invalid");
  nullableRecord(value.approval, `${path}/approval`, issue, "cutscene.wave_approval_invalid");
  if (!Array.isArray(value.attempts)) issue("cutscene.wave_attempts_invalid", `${path}/attempts`);
  validateCompletion(value.completion, value.state, `${path}/completion`, issue);
  nullableRecord(value.invalidation, `${path}/invalidation`, issue, "cutscene.wave_invalidation_invalid");
  if (value.state === "invalidated" && value.invalidation === null) issue("cutscene.invalidation_required", `${path}/invalidation`);
  if (value.state !== "invalidated" && value.invalidation !== null) issue("cutscene.invalidation_unexpected", `${path}/invalidation`);
}

function validateForwardDag(downstream, issue) {
  if (!Array.isArray(downstream)) { issue("cutscene.dag_invalid", "/cutsceneWorkflow/downstream"); return; }
  let prior = "";
  const edges = new Set();
  downstream.forEach((edge, index) => {
    const path = `/cutsceneWorkflow/downstream/${index}`;
    closed(edge, ["fromWaveId", "toWaveId"], path, issue, { unknownCode: "cutscene.dag_unknown_key", requiredCode: "cutscene.dag_required" });
    const fromIndex = WAVE_IDS.indexOf(edge?.fromWaveId);
    const toIndex = WAVE_IDS.indexOf(edge?.toWaveId);
    if (fromIndex < 0) issue("cutscene.dag_reference_unknown", `${path}/fromWaveId`);
    if (toIndex < 0) issue("cutscene.dag_reference_unknown", `${path}/toWaveId`);
    if (fromIndex >= 0 && toIndex >= 0 && fromIndex >= toIndex) issue("cutscene.dag_not_forward", `${path}/toWaveId`);
    const key = `${edge?.fromWaveId}\0${edge?.toWaveId}`;
    if (prior && compareUtf8(prior, key) >= 0) issue("cutscene.dag_unsorted_or_duplicate", "/cutsceneWorkflow/downstream");
    prior = key;
    if (edges.has(key)) issue("cutscene.dag_unsorted_or_duplicate", "/cutsceneWorkflow/downstream");
    edges.add(key);
  });
}

export function validateCutsceneVisualPlan(value) {
  return resultOf((issue) => {
    if (isPlainObject(value) && Object.hasOwn(value, "state")) issue("cutscene.root_state_forbidden", "/state");
    if (isPlainObject(value) && Array.isArray(value.assets)) {
      value.assets.forEach((asset, index) => { if (isPlainObject(asset) && Object.hasOwn(asset, "mode")) issue("cutscene.manifest_asset_mode_forbidden", `/assets/${index}/mode`); });
    }
    const rootKeys = ["schemaVersion", "cutsceneId", "mode", "beats", "shots", "cutsceneWorkflow"];
    closed(value, rootKeys, "", issue, { unknownCode: "cutscene.unknown_key", requiredCode: "cutscene.required" });
    if (value?.schemaVersion !== 1) issue("cutscene.schema_version_invalid", "/schemaVersion");
    if (!CUTSCENE_ID.test(value?.cutsceneId ?? "")) issue("cutscene.cutscene_id_invalid", "/cutsceneId");
    if (!MODES.includes(value?.mode)) issue("cutscene.mode_invalid", "/mode");
    const beatIds = new Set();
    if (!Array.isArray(value?.beats) || value.beats.length === 0) issue("cutscene.beats_empty", "/beats");
    else value.beats.forEach((beat, index) => { closed(beat, ["beatId"], `/beats/${index}`, issue, { unknownCode: "cutscene.beat_unknown_key", requiredCode: "cutscene.beat_required" }); if (!RECORD_ID.test(beat?.beatId ?? "")) issue("cutscene.beat_id_invalid", `/beats/${index}/beatId`); beatIds.add(beat?.beatId); if (index > 0 && compareUtf8(value.beats[index - 1]?.beatId ?? "", beat?.beatId ?? "") >= 0) issue("cutscene.ids_unsorted_or_duplicate", "/beats"); });
    if (!Array.isArray(value?.shots) || value.shots.length === 0) issue("cutscene.shots_empty", "/shots");
    else value.shots.forEach((shot, index) => { closed(shot, ["shotId", "beatId"], `/shots/${index}`, issue, { unknownCode: "cutscene.shot_unknown_key", requiredCode: "cutscene.shot_required" }); if (!RECORD_ID.test(shot?.shotId ?? "")) issue("cutscene.shot_id_invalid", `/shots/${index}/shotId`); if (!beatIds.has(shot?.beatId)) issue("cutscene.shot_beat_unknown", `/shots/${index}/beatId`); if (index > 0 && compareUtf8(value.shots[index - 1]?.shotId ?? "", shot?.shotId ?? "") >= 0) issue("cutscene.ids_unsorted_or_duplicate", "/shots"); });
    closed(value?.cutsceneWorkflow, ["schemaVersion", "waves", "downstream", "derived"], "/cutsceneWorkflow", issue, { unknownCode: "cutscene.workflow_unknown_key", requiredCode: "cutscene.workflow_required" });
    if (value?.cutsceneWorkflow?.schemaVersion !== 1) issue("cutscene.workflow_schema_version_invalid", "/cutsceneWorkflow/schemaVersion");
    if (!Array.isArray(value?.cutsceneWorkflow?.waves) || value.cutsceneWorkflow.waves.length === 0) issue("cutscene.waves_empty", "/cutsceneWorkflow/waves");
    else {
      value.cutsceneWorkflow.waves.forEach((wave, index) => validateWave(wave, index, issue));
      if (value.cutsceneWorkflow.waves.length !== WAVE_IDS.length) issue("cutscene.wave_count_invalid", "/cutsceneWorkflow/waves");
      for (let index = 1; index < value.cutsceneWorkflow.waves.length; index += 1) {
        const current = value.cutsceneWorkflow.waves[index];
        const previous = value.cutsceneWorkflow.waves[index - 1];
        if (["generation-ready", "cost-estimated", "approval-pending", "approved", "dispatching", "completed"].includes(current?.state) && !["approved", "dispatching", "completed"].includes(previous?.state)) issue("cutscene.wave_prerequisite_unmet", `/cutsceneWorkflow/waves/${index}/state`);
      }
    }
    validateForwardDag(value?.cutsceneWorkflow?.downstream, issue);
    if (!isPlainObject(value?.cutsceneWorkflow?.derived)) issue("cutscene.derived_invalid", "/cutsceneWorkflow/derived");
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

export function validateCutsceneCostEstimate(value) { return resultOf((issue) => validateCost(value, issue)); }

export function validateCutsceneGenerationApproval(value) {
  return resultOf((issue) => {
    closed(value, ["schemaVersion", "eventId", "actor", "reviewer", "decision", "decidedAt", "waveId", "assetIds", "maximumApprovedUsd", "retryReserve", "planSha256", "promptPackageSha256", "referenceBindings", "pricingSnapshotSha256", "costEstimateSha256"], "", issue);
    if (value?.schemaVersion !== 1) issue("cutscene.schema_version_invalid", "/schemaVersion");
    for (const field of ["eventId", "actor", "reviewer"]) if (!isText(value?.[field])) issue("cutscene.text_invalid", `/${field}`);
    if (value?.decision !== "approved") issue("cutscene.approval_decision_invalid", "/decision");
    if (!isText(value?.decidedAt) || Number.isNaN(Date.parse(value.decidedAt))) issue("cutscene.timestamp_invalid", "/decidedAt");
    if (!WAVE_IDS.includes(value?.waveId)) issue("cutscene.wave_id_invalid", "/waveId");
    nonEmptySortedUnique(value?.assetIds, "/assetIds", issue, { emptyCode: "cutscene.asset_ids_empty", predicate: (id) => CUTSCENE_ID.test(id ?? "") });
    if (typeof value?.maximumApprovedUsd !== "number" || !Number.isFinite(value.maximumApprovedUsd) || value.maximumApprovedUsd < 0) issue("cutscene.maximum_approved_usd_invalid", "/maximumApprovedUsd");
    if (!Number.isInteger(value?.retryReserve) || value.retryReserve < 0) issue("cutscene.retry_reserve_invalid", "/retryReserve");
    for (const field of ["planSha256", "promptPackageSha256", "pricingSnapshotSha256", "costEstimateSha256"]) if (!isHash(value?.[field])) issue("cutscene.hash_invalid", `/${field}`);
    if (!Array.isArray(value?.referenceBindings) || value.referenceBindings.length === 0) issue("cutscene.reference_bindings_empty", "/referenceBindings");
    else value.referenceBindings.forEach((binding, index) => { closed(binding, ["assetId", "sha256"], `/referenceBindings/${index}`, issue); if (!CUTSCENE_ID.test(binding?.assetId ?? "")) issue("cutscene.reference_asset_id_invalid", `/referenceBindings/${index}/assetId`); if (!isHash(binding?.sha256)) issue("cutscene.hash_invalid", `/referenceBindings/${index}/sha256`); if (index > 0 && compareUtf8(value.referenceBindings[index - 1]?.assetId ?? "", binding?.assetId ?? "") >= 0) issue("cutscene.ids_unsorted_or_duplicate", "/referenceBindings"); });
  });
}

export function validateCutsceneGenerationUsage(value) {
  return resultOf((issue) => {
    closed(value, ["schemaVersion", "waveId", "assetId", "attemptId", "providerRequestId", "inputTokens", "inputTextTokens", "inputImageTokens", "cachedTextTokens", "cachedImageTokens", "outputTokens", "totalTokens"], "", issue);
    if (value?.schemaVersion !== 1) issue("cutscene.schema_version_invalid", "/schemaVersion");
    if (!WAVE_IDS.includes(value?.waveId)) issue("cutscene.wave_id_invalid", "/waveId");
    for (const field of ["assetId", "attemptId", "providerRequestId"]) if (!isText(value?.[field])) issue("cutscene.text_invalid", `/${field}`);
    const fields = ["inputTokens", "inputTextTokens", "inputImageTokens", "cachedTextTokens", "cachedImageTokens", "outputTokens", "totalTokens"];
    for (const field of fields) if (!Number.isInteger(value?.[field]) || value[field] < 0) issue("cutscene.usage_token_invalid", `/${field}`);
    if (value?.inputTokens !== value?.inputTextTokens + value?.inputImageTokens) issue("cutscene.usage_input_mismatch", "/inputTokens");
    if (value?.totalTokens !== value?.inputTokens + value?.outputTokens) issue("cutscene.usage_total_mismatch", "/totalTokens");
    if (value?.cachedTextTokens > value?.inputTextTokens) issue("cutscene.cached_text_exceeds_input", "/cachedTextTokens");
    if (value?.cachedImageTokens > value?.inputImageTokens) issue("cutscene.cached_image_exceeds_input", "/cachedImageTokens");
  });
}

export function validateCutsceneContinuityReview(value) {
  return resultOf((issue) => {
    closed(value, ["schemaVersion", "cutsceneId", "planSha256", "reviewedAt", "findings", "blockingFindingIds"], "", issue);
    if (value?.schemaVersion !== 1) issue("cutscene.schema_version_invalid", "/schemaVersion");
    if (!CUTSCENE_ID.test(value?.cutsceneId ?? "")) issue("cutscene.cutscene_id_invalid", "/cutsceneId");
    if (!isHash(value?.planSha256)) issue("cutscene.hash_invalid", "/planSha256");
    if (!isText(value?.reviewedAt) || Number.isNaN(Date.parse(value.reviewedAt))) issue("cutscene.timestamp_invalid", "/reviewedAt");
    const findings = new Set();
    if (!Array.isArray(value?.findings)) issue("cutscene.findings_invalid", "/findings");
    else value.findings.forEach((finding, index) => { const path = `/findings/${index}`; closed(finding, ["findingId", "code", "path", "sourceMasterIds", "affectedAssetIds", "blocking"], path, issue); if (!RECORD_ID.test(finding?.findingId ?? "")) issue("cutscene.finding_id_invalid", `${path}/findingId`); else findings.add(finding.findingId); if (!isText(finding?.code)) issue("cutscene.finding_code_invalid", `${path}/code`); if (!isText(finding?.path)) issue("cutscene.finding_path_invalid", `${path}/path`); nonEmptySortedUnique(finding?.sourceMasterIds, `${path}/sourceMasterIds`, issue, { predicate: (id) => CUTSCENE_ID.test(id ?? "") }); nonEmptySortedUnique(finding?.affectedAssetIds, `${path}/affectedAssetIds`, issue, { predicate: (id) => CUTSCENE_ID.test(id ?? "") }); if (typeof finding?.blocking !== "boolean") issue("cutscene.finding_blocking_invalid", `${path}/blocking`); });
    if (!Array.isArray(value?.blockingFindingIds)) issue("cutscene.blockers_invalid", "/blockingFindingIds");
    else value.blockingFindingIds.forEach((id, index) => { if (!findings.has(id)) issue("cutscene.blocker_finding_unknown", `/blockingFindingIds/${index}`); if (index > 0 && compareUtf8(value.blockingFindingIds[index - 1] ?? "", id ?? "") >= 0) issue("cutscene.ids_unsorted_or_duplicate", "/blockingFindingIds"); });
  });
}

function canonicalize(value, stack = new Set()) {
  if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") { if (!Number.isFinite(value)) throw new TypeError("Cutscene canonical document contains a non-finite number."); return JSON.stringify(value); }
  if (Array.isArray(value)) {
    if (stack.has(value) || Reflect.ownKeys(value).some((key) => key !== "length" && (!/^0$|^[1-9][0-9]*$/u.test(String(key)) || !Object.prototype.propertyIsEnumerable.call(value, key))) || Object.keys(value).length !== value.length) throw new TypeError("Cutscene canonical document contains non-canonical array state.");
    stack.add(value); const rendered = `[${value.map((item) => canonicalize(item, stack)).join(",")}]`; stack.delete(value); return rendered;
  }
  if (!isPlainObject(value) || stack.has(value)) throw new TypeError("Cutscene canonical document contains a non-plain or cyclic object.");
  const descriptors = Object.getOwnPropertyDescriptors(value);
  for (const key of Reflect.ownKeys(value)) if (typeof key !== "string" || !Object.prototype.propertyIsEnumerable.call(value, key) || descriptors[key].get || descriptors[key].set) throw new TypeError("Cutscene canonical document contains hidden object state.");
  stack.add(value); const rendered = `{${Object.keys(value).sort(compareUtf8).map((key) => `${JSON.stringify(key)}:${canonicalize(value[key], stack)}`).join(",")}}`; stack.delete(value); return rendered;
}

export function canonicalCutsceneDocument(value) { return canonicalize(value); }
export function cutsceneDocumentSha256(value) { return createHash("sha256").update(canonicalCutsceneDocument(value)).digest("hex"); }

export function deriveCutsceneLifecycle({ manifest, waves, continuityReceipt } = {}) {
  const blockerIds = Array.isArray(continuityReceipt?.blockingFindingIds) ? [...new Set(continuityReceipt.blockingFindingIds.filter(isText))].sort(compareUtf8) : [];
  const listedWaves = Array.isArray(waves) ? waves : [];
  const lifecycle = blockerIds.length > 0 || listedWaves.some((wave) => wave?.state === "blocked" || wave?.state === "invalidated") ? "blocked"
    : listedWaves.some((wave) => wave?.state === "dispatching") ? "dispatching"
      : listedWaves.length > 0 && listedWaves.every((wave) => wave?.state === "completed") ? "completed" : "planned";
  const assets = Array.isArray(manifest?.assets) ? manifest.assets : [];
  const receiptCurrent = continuityReceipt?.current === true || (continuityReceipt?.current === undefined && continuityReceipt !== undefined);
  const documentApproved = assets.length > 0 && receiptCurrent && blockerIds.length === 0 && assets.every((asset) => ["document-approved", "production-candidate"].includes(asset?.approval_state));
  const productionCandidate = documentApproved && assets.every((asset) => asset?.approval_state === "production-candidate");
  return { lifecycle, documentApproved, productionCandidate, blockerIds };
}
