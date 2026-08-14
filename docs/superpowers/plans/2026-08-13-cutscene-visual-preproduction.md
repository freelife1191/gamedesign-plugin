# Cutscene Visual Preproduction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 완전한 Prompt Only package를 만들고, 네 승인 wave의 현재 비용·범위 공개와 explicit live host-user 승인 뒤에만 정확한 컷씬 이미지를 생성한다.

**Architecture:** `plan-cutscene-visual-preproduction.mjs`가 cutscene image manifest의 유일한 writer다. Template-ready prompt는 reference ID/expected path만 기록하고 hash를 만들지 않는다. 선택한 master bytes를 safe artifact path에서 읽어 hash한 generation-ready package만 approval을 받는다. `style-master`, `reference-masters`, `keyframes`, `storyboard` wave가 asset IDs, estimate, approval, attempts, completion, invalidation을 각각 소유하며 root status는 derived summary다.

**Tech Stack:** Node.js >=18 ESM, JSON Schema 2020-12, SHA-256, node:test

**Spec:** `docs/superpowers/specs/2026-08-13-cutscene-visual-preproduction-design.md`

## Global Constraints

- Prompt Only와 Estimate Only는 provider call 0회다. Prompt Only는 image bytes와 invented SHA-256 없이 expected path와 asset ID를 남긴다.
- Generate After Approval은 current wave cost/range disclosure와 opaque live host-user capability+receipt 뒤에만 dispatch한다. attempt마다 ID, ordinal, remaining reserve, accumulated/max possible cost, current prompt/reference/price bindings, current approval을 재검증한다.
- cutscene `document-approved`/`production-candidate`는 기존 image asset lifecycle + current continuity receipt + unresolved blocker 없음으로만 derived하며 cutscene code가 independent transition을 만들지 않는다.
- `gpt-image-2` supports generation/edit, ordered repeated `image[]`, omits `input_fidelity`, allows size edges divisible by 16/max 3840/aspect <=3:1/pixels 655360..8294400, and rejects transparent. A dated snapshot is never a permanent runtime default.
- Host-provided official timestamped price snapshot separates text, cached text, image, cached image, output. Usage is per provider request/asset and requires `input=text+image`, `total=input+output`; missing cached breakdown means exact actual USD `unavailable`.
- Route canonical fields stay exact. A separate closed top-level `cutsceneWorkflow` holds wave/downstream/approval metadata.
- Inventory baseline: Studio routing 22/installed 23, Career routing 22/installed 23, Studio source 15, shared reference 2, memory 3, vendor `svg-infographic` 1, top-level shared scripts 25. Final: Studio 23/24; Career 22/23; both packages 30 top-level scripts.

## File Structure

- Contracts: five `shared/image-assets/schema/cutscene-*.schema.json`, `shared/scripts/validate-cutscene-visual-preproduction.mjs`
- Runtime: `plan-cutscene-visual-preproduction.mjs`, `estimate-cutscene-image-cost.mjs`, `run-approved-cutscene-image-stage.mjs`, `review-cutscene-continuity.mjs`, `lib/cutscene-generation-{capabilities,approval}.mjs`
- Existing changes: image manifest/schema/prompt pattern/validator/workflow/OpenAI adapter; unit and Studio/Career tests
- Public surface: Studio cutscene skill/route/profile/README and adjacent image/content skills; root, Studio, Career, memory guides; build/isolation/user-guide/shared-contract/memory lifecycle tests

---

### Task 1: Closed contracts and derived root state

**Files:** Create `shared/image-assets/schema/{cutscene-visual-plan,cutscene-cost-estimate,cutscene-generation-approval,cutscene-generation-usage,cutscene-continuity-review}.schema.json`, `shared/scripts/validate-cutscene-visual-preproduction.mjs`, `tests/unit/cutscene-visual-preproduction.test.mjs`.

**Interfaces:** `validateCutsceneVisualPlan(value):{ok:boolean,errors:Array<{code:string,path:string}>}`, `validateCutsceneCostEstimate`, `validateCutsceneGenerationApproval`, `validateCutsceneGenerationUsage`, `validateCutsceneContinuityReview`; `canonicalCutsceneDocument(value):string`, `cutsceneDocumentSha256(value):string`, and the only root-state owner `deriveCutsceneLifecycle({manifest,waves,continuityReceipt}):{lifecycle:string,documentApproved:boolean,productionCandidate:boolean,blockerIds:string[]}`.

- [ ] **RED — write closed-shape test.**

```js
const validCutscenePlan = () => ({ schemaVersion: 1, cutsceneId: "cutscene-escape", mode: "prompt-only", beats: [{ beatId: "BEAT-01" }], shots: [{ shotId: "SHOT-01", beatId: "BEAT-01" }], cutsceneWorkflow: { schemaVersion: 1, waves: ["style-master", "reference-masters", "keyframes", "storyboard"].map((id, index) => ({ id, state: index === 0 ? "template-ready" : "planned", assetIds: [`cutscene-escape-${id}-01`], estimate: null, approval: null, attempts: [], completion: null, invalidation: null })), downstream: [], derived: {} } });
test("four waves own authority and root state is derived", () => {
  const plan = validCutscenePlan();
  assert.deepEqual(plan.cutsceneWorkflow.waves.map(({ id }) => id), ["style-master", "reference-masters", "keyframes", "storyboard"]);
  plan.state = "generation-approved";
  assert.deepEqual(validateCutsceneVisualPlan(plan).errors[0], { code: "cutscene.root_state_forbidden", path: "/state" });
  const wave = validCutscenePlan(); delete wave.cutsceneWorkflow.waves[0].state;
  assert.deepEqual(validateCutsceneVisualPlan(wave).errors[0], { code: "cutscene.wave_state_required", path: "/cutsceneWorkflow/waves/0/state" });
});
```

- [ ] **Run RED.** `node --test tests/unit/cutscene-visual-preproduction.test.mjs` → FAIL: contracts absent.
- [ ] **GREEN — implement.** `cutsceneWorkflow` has exactly `schemaVersion,waves,downstream,derived`; each wave has exactly `id,state,assetIds,estimate,approval,attempts,completion,invalidation`, where `state` is `planned|template-ready|generation-ready|cost-estimated|approval-pending|approved|dispatching|completed|blocked|invalidated`. Require nonempty collections before `every`, sorted unique IDs, valid DAG references and forward transitions except `invalidated → cost-estimated`. Template-ready has expected path/no hash; generation-ready has current ID+SHA-256. `deriveCutsceneLifecycle` is implemented here only and derives root lifecycle from image approval, current continuity receipt and blockers.
- [ ] **Run GREEN.** `node --test tests/unit/cutscene-visual-preproduction.test.mjs && node -e 'for (const p of process.argv.slice(1)) JSON.parse(require("node:fs").readFileSync(p,"utf8"))' shared/image-assets/schema/cutscene-*.schema.json` → PASS.
- [ ] **Commit.** `git add shared/image-assets/schema/cutscene-*.schema.json shared/scripts/validate-cutscene-visual-preproduction.mjs tests/unit/cutscene-visual-preproduction.test.mjs && git commit -m "feat: define cutscene wave contracts"`

### Task 2: Sole-writer manifest, template/bound prompts, and invalidation

**Depends on:** Task 1; Tasks 1–5 are serial.

**Files:** Create `shared/image-assets/references/cutscene-generation-policy.md`, `shared/image-assets/templates/cutscene/{cutscene-brief.md,beat-sheet.yml,shot-list.yml,continuity-bible.yml,master-reference-plan.yml,generation-guide.md}`, `shared/scripts/plan-cutscene-visual-preproduction.mjs`; modify `shared/scripts/{build-image-asset-plan,run-image-asset-workflow,validate-image-assets}.mjs`, `shared/image-assets/{schema/image-assets.schema.json,prompt-patterns/storyboard.json}`, `products/game-design-studio/plugin/skills/plan-image-assets/SKILL.md`, `tests/unit/{cutscene-visual-preproduction,image-assets}.test.mjs`, and `tests/products/studio/image-assets.test.mjs`.

**Consumes:** `buildImageAssetPlan({artifact,qualityProfile,existingManifest})` and `planImageAssetWorkflow({artifactRoot,artifact,qualityProfile,existingManifest,patternCatalog})`.

**Interfaces:** `planCutsceneVisualPreproduction(input):{plan:CutscenePlan,manifest:ImageManifest,templatePromptPackage:PromptPackage}`; `bindCutscenePromptPackage({artifactRoot,plan,manifest}):Promise<GenerationReadyPromptPackage>`; `writeCutscenePromptPackage`; `validateCutsceneManifestHandoff({manifest}):ImageManifest`, where the closed `manifest.cutsceneWorkflow` is its authority; extended `planImageAssetWorkflow({artifactRoot,artifact,qualityProfile,existingManifest,patternCatalog,cutsceneManifest?}):Promise<{manifest,summary,promptDigests}>`; `findCutsceneImpact`; `invalidateCutsceneDependents`.

- [ ] **RED — write template and handoff tests.**

```js
const input = (override = {}) => ({ cutsceneId: "cutscene-escape", mode: "prompt-only", beats: [{ beatId: "BEAT-01" }], shots: [{ shotId: "SHOT-01", beatId: "BEAT-01" }], ...override });
const fixtureManifest = () => cutsceneManifestFixture({ assetId: "cutscene-escape-style-master-style-01", promptSha256: "2222222222222222222222222222222222222222222222222222222222222222", dagSha256: "3333333333333333333333333333333333333333333333333333333333333333", approvalBindingSha256: "4444444444444444444444444444444444444444444444444444444444444444" });
const cutsceneManifestFixture = ({ assetId, promptSha256, dagSha256, approvalBindingSha256 }) => ({ schema_version: 1, assets: [{ asset_id: assetId, prompt_sha256: promptSha256, approval_binding_sha256: approvalBindingSha256 }], cutsceneWorkflow: { schemaVersion: 1, dagSha256, waves: [] } });
const artifactRoot = async (t) => { const root = await mkdtemp(path.join(tmpdir(), "cutscene-plan-")); t.after(() => rm(root, { recursive: true, force: true })); return root; };
const validGeneralArtifact = () => ({ artifact_id: "general-artifact", image_needs: [{ slot_id: "cover", subject: "general subject", variant: undefined }] });
const validGeneralProfile = () => ({ required_images: [{ id: "cover", type: "cover", output: { width: 1024, height: 1024 } }], recommended_images: [] });
const generalImageFixture = (artifactRoot) => ({ artifactRoot, artifact: validGeneralArtifact(), qualityProfile: validGeneralProfile() });
test("prompt-only has expected references but no invented hashes", () => {
  const { templatePromptPackage } = planCutsceneVisualPreproduction(input({ mode: "prompt-only" }));
  assert.equal(templatePromptPackage.kind, "template-ready");
  assert.equal(templatePromptPackage.references.length > 0 && templatePromptPackage.references.every((x) => x.expectedPath && x.sha256 === undefined), true);
});
test("plan-image-assets validates cutscene handoff without mutation", () => {
  const manifest = fixtureManifest();
  assert.deepEqual(validateCutsceneManifestHandoff({manifest}), manifest);
});
test("planImageAssetWorkflow preserves handed-off manifest bytes and general planning", async (t) => {
  const root = await artifactRoot(t);
  const manifest = cutsceneManifestFixture({ assetId: "cutscene-escape-style-master-style-01", promptSha256: "2".repeat(64), dagSha256: "3".repeat(64), approvalBindingSha256: "4".repeat(64) });
  const exact = `${JSON.stringify(manifest, null, 2)}\n`;
  const result = await planImageAssetWorkflow({ artifactRoot: root, artifact: { invalid: true }, qualityProfile: { invalid: true }, cutsceneManifest: manifest });
  assert.deepEqual(result.manifest, manifest);
  assert.equal(await readFile(path.join(root, "assets/image-assets.yml"), "utf8"), exact);
  await assert.doesNotReject(() => planImageAssetWorkflow(generalImageFixture(root)));
});
```

- [ ] **Run RED.** `node --test --test-name-pattern='prompt-only|handoff|preserves handed-off' tests/unit/cutscene-visual-preproduction.test.mjs tests/unit/image-assets.test.mjs` → FAIL: no cutscene branch; the deliberate invalid general artifact reaches `buildImageAssetPlan`.
- [ ] **GREEN — implement.** `planCutsceneVisualPreproduction` is the only cutscene caller of `buildImageAssetPlan` and writes stable IDs, DAG, prompt hash, approval binding and `cutsceneWorkflow` once. If `cutsceneManifest` exists, `planImageAssetWorkflow` validates it, safe-writes canonical supplied bytes, and returns without calling `buildImageAssetPlan`, compiling/rebinding prompts, or rewriting IDs/DAG/hashes/binding. If it is absent, retain the existing general branch unchanged. Binding reads master bytes through the secure loader. `findCutsceneImpact` is the one forward-DAG traversal; invalidation calls it and preserves unrelated bytes/state/receipt.
- [ ] **Run GREEN.** `node --test tests/unit/cutscene-visual-preproduction.test.mjs tests/unit/image-assets.test.mjs tests/products/studio/image-assets.test.mjs` → PASS: literal bytes/IDs/DAG/prompt hash/approval binding survive handoff and general planning remains unchanged.
- [ ] **Commit.** `git add shared/image-assets/references/cutscene-generation-policy.md shared/image-assets/templates/cutscene shared/scripts/plan-cutscene-visual-preproduction.mjs shared/scripts/build-image-asset-plan.mjs shared/scripts/run-image-asset-workflow.mjs shared/scripts/validate-image-assets.mjs shared/image-assets/schema/image-assets.schema.json shared/image-assets/prompt-patterns/storyboard.json products/game-design-studio/plugin/skills/plan-image-assets/SKILL.md tests/unit/cutscene-visual-preproduction.test.mjs tests/unit/image-assets.test.mjs tests/products/studio/image-assets.test.mjs && git commit -m "feat: hand off immutable cutscene image manifests"`

### Task 3: Price snapshot and opaque live host-user approval

**Depends on:** Task 2.

**Files:** Create `shared/scripts/estimate-cutscene-image-cost.mjs`, `shared/scripts/lib/cutscene-generation-capabilities.mjs`, `shared/scripts/lib/cutscene-generation-approval.mjs`, `tests/unit/cutscene-generation-approval.test.mjs`; modify `tests/unit/cutscene-visual-preproduction.test.mjs`.

**Consumes:** Task 1 canonical/hash validators and Task 2 generation-ready package. **Produces:** `estimateCutsceneImageCost({plan,waveId,pricingSnapshot,retryReserve}):CostEstimate`; `calculateActualCost(pricing,usage):{status:"known",usd:number}|{status:"unavailable",reason:string}`; `issueCutsceneHumanApproval(input):{receipt,capability}`; `assertCutsceneHumanApproval(receipt,capability,context):ApprovalReceipt`; `cutsceneApprovalBinding`; `validateHostCutsceneApproval`; `requiresCutsceneReapproval`.

- [ ] **RED — authority/cost tests.**

```js
const PLAN_SHA = "1111111111111111111111111111111111111111111111111111111111111111";
const PROMPT_SHA = "2222222222222222222222222222222222222222222222222222222222222222";
const REFERENCE_SHA = "3333333333333333333333333333333333333333333333333333333333333333";
const PRICE_SHA = "4444444444444444444444444444444444444444444444444444444444444444";
const ESTIMATE_SHA = "5555555555555555555555555555555555555555555555555555555555555555";
const coded = (code, path) => Object.assign(new Error(code), { code, path });
const approvalInput = () => ({ eventId: "approve-style-01", actor: "Kim", reviewer: "Kim", decision: "approved", decidedAt: "2026-08-13T00:00:00.000Z", waveId: "style-master", assetIds: ["cutscene-escape-style-master-style-01"], planSha256: PLAN_SHA, promptPackageSha256: PROMPT_SHA, referenceBindings: [{ assetId: "cutscene-escape-style-master-style-01", sha256: REFERENCE_SHA }], pricingSnapshotSha256: PRICE_SHA, costEstimateSha256: ESTIMATE_SHA, maximumApprovedUsd: 1.25, retryReserve: 1 });
const pricing = () => ({ provider: "openai", model: "gpt-image-2", sourceUrl: "https://openai.com/api/pricing/", retrievedAt: "2026-08-13T00:00:00.000Z", currency: "USD", sha256: PRICE_SHA, units: { textInput: 5, cachedTextInput: 1.25, imageInput: 8, cachedImageInput: 2, imageOutput: 30 } });
const rate = (snapshot, usage) => ((usage.inputTextTokens - usage.cachedTextTokens) * snapshot.units.textInput + usage.cachedTextTokens * snapshot.units.cachedTextInput + (usage.inputImageTokens - usage.cachedImageTokens) * snapshot.units.imageInput + usage.cachedImageTokens * snapshot.units.cachedImageInput + usage.outputTokens * snapshot.units.imageOutput) / 1_000_000;
const context = () => ({ waveId: "style-master", assetIds: ["cutscene-escape-style-master-style-01"], planSha256: PLAN_SHA, promptPackageSha256: PROMPT_SHA, referenceBindings: [{ assetId: "cutscene-escape-style-master-style-01", sha256: REFERENCE_SHA }], pricingSnapshotSha256: PRICE_SHA, costEstimateSha256: ESTIMATE_SHA });
test("copied capability and role-like reviewer fail closed", () => {
  const issued = issueCutsceneHumanApproval(approvalInput());
  assert.throws(() => assertCutsceneHumanApproval(structuredClone(issued.receipt), issued.capability, context()), { code: "cutscene.approval_capability_invalid" });
  assert.throws(() => issueCutsceneHumanApproval({ ...approvalInput(), reviewer: "image agent" }), { code: "cutscene.reviewer_role_like" });
  assert.throws(() => issueCutsceneHumanApproval({ ...approvalInput(), actor: "Lee", reviewer: "Kim" }), { code: "cutscene.approval_actor_mismatch", path: "/actor" });
});
test("usage invalidity and absent cached detail are explicit", () => {
  assert.deepEqual(validateCutsceneGenerationUsage({ assetId: "cutscene-escape-style-master-style-01", inputTokens: 8, inputTextTokens: 3, inputImageTokens: 4, outputTokens: 4, totalTokens: 12 }).errors[0], { code: "cutscene.usage_input_mismatch", path: "/inputTokens" });
  assert.deepEqual(calculateActualCost(pricing(), { inputTokens: 8, outputTokens: 4, totalTokens: 12, inputTextTokens: 3, inputImageTokens: 5 }), { status: "unavailable", reason: "cached-token-breakdown-unavailable" });
});
test("every immutable binding uses its literal hash and failure path", () => {
  const issued = issueCutsceneHumanApproval(approvalInput());
  for (const [override, path] of [
    [{ plan: { sha256: "6666666666666666666666666666666666666666666666666666666666666666" } }, "/planSha256"],
    [{ receipt: { ...issued.receipt, promptPackageSha256: "6666666666666666666666666666666666666666666666666666666666666666" } }, "/promptPackageSha256"],
    [{ receipt: { ...issued.receipt, referenceBindings: [{ assetId: "cutscene-escape-style-master-style-01", sha256: "0000000000000000000000000000000000000000000000000000000000000000" }] } }, "/referenceBindings/0/sha256"],
    [{ receipt: { ...issued.receipt, pricingSnapshotSha256: "0000000000000000000000000000000000000000000000000000000000000000" } }, "/pricingSnapshotSha256"],
    [{ estimate: { sha256: "6666666666666666666666666666666666666666666666666666666666666666" } }, "/costEstimateSha256"],
  ]) assert.throws(() => validateHostCutsceneApproval({ receipt: issued.receipt, capability: issued.capability, plan: { sha256: PLAN_SHA }, estimate: { sha256: ESTIMATE_SHA }, now: "2026-08-13T00:01:00.000Z", ...override }), { code: "cutscene.approval_binding_stale", path });
});
```

- [ ] **Run RED.** `node --test tests/unit/cutscene-generation-approval.test.mjs` → FAIL: modules absent.
- [ ] **GREEN — implement pricing and capability.**

```js
export function calculateActualCost(snapshot, usage) {
  if (usage.inputTokens !== usage.inputTextTokens + usage.inputImageTokens) throw coded("cutscene.usage_input_mismatch", "/inputTokens");
  if (usage.totalTokens !== usage.inputTokens + usage.outputTokens) throw coded("cutscene.usage_total_mismatch", "/totalTokens");
  if (usage.cachedTextTokens === undefined || usage.cachedImageTokens === undefined) return { status: "unavailable", reason: "cached-token-breakdown-unavailable" };
  return { status: "known", usd: rate(snapshot, usage) };
}
export function validateHostCutsceneApproval({ receipt, capability, plan, estimate, now }) {
  assertCutsceneHumanApproval(receipt, capability, context());
  const stale = [[plan.sha256, PLAN_SHA, "/planSha256"], [receipt.promptPackageSha256, PROMPT_SHA, "/promptPackageSha256"], [receipt.referenceBindings[0].sha256, REFERENCE_SHA, "/referenceBindings/0/sha256"], [receipt.pricingSnapshotSha256, PRICE_SHA, "/pricingSnapshotSha256"], [estimate.sha256, ESTIMATE_SHA, "/costEstimateSha256"]].find(([actual, expected]) => actual !== expected);
  if (stale) throw coded("cutscene.approval_binding_stale", stale[2]);
  if (Date.parse(now) - Date.parse(pricing().retrievedAt) > 86_400_000) throw coded("cutscene.pricing_snapshot_stale", "/retrievedAt");
  return receipt;
}
```

- [ ] **Run GREEN.** `node --test tests/unit/cutscene-generation-approval.test.mjs tests/unit/cutscene-visual-preproduction.test.mjs` → PASS: copied capability, role-like/actor mismatch, `PLAN_SHA`/`PROMPT_SHA`/`REFERENCE_SHA`/`PRICE_SHA`/`ESTIMATE_SHA` mutations and usage mismatches assert literal code/path.
- [ ] **Commit.** `git add shared/scripts/estimate-cutscene-image-cost.mjs shared/scripts/lib/cutscene-generation-capabilities.mjs shared/scripts/lib/cutscene-generation-approval.mjs tests/unit/cutscene-generation-approval.test.mjs tests/unit/cutscene-visual-preproduction.test.mjs && git commit -m "feat: bind cutscene waves to live approval"`

### Task 4: Per-attempt dispatch and usage receipts

**Depends on:** Task 3.

**Files:** Create `shared/scripts/run-approved-cutscene-image-stage.mjs`; modify `shared/scripts/{run-image-asset-workflow,generate-openai-images}.mjs`, `tests/unit/cutscene-generation-approval.test.mjs`, `tests/unit/generate-openai-images.test.mjs`, `tests/products/studio/image-assets.test.mjs`.

**Consumes:** Task 2 immutable manifest and Task 3 current approval/cost. **Produces:** `runConfiguredSelectedImageAssetWorkflow({workspaceRoot,env,manifest,selectedAssetIds,provider,apiKey,fetchFn,hostGenerate}):Promise<ImageWorkflowResult>`; `runApprovedCutsceneImageWave({artifactRoot,waveId,receipt,capability,env,fetchFn,hostGenerate,authorizeProviderAttempt}):Promise<CutsceneWaveResult>`; `retryCutsceneFailedAssets({artifactRoot,failedAssetIds,waveId,receipt,capability,env,fetchFn,hostGenerate,authorizeProviderAttempt}):Promise<{retriedIds:string[],unaffectedOutputSha256:string}>`; `writeCutsceneUsageReceipt({waveId,assetId,attemptId,providerRequestId,usage}):Promise<{actualCost:ActualCost}>`; `beforeProvider({asset_id,attempt_ordinal})`; one create-once usage receipt per provider request at `cutscene/usage-receipts/<waveId>/<assetId>/<attemptId>-<providerRequestId>.json`, with generated pre-dispatch `attemptId` and validated `providerRequestId` or literal `no-request-id`.

- [ ] **RED — no-call/retry tests.**

```js
const STYLE_ID = "cutscene-escape-style-master-style-01";
const BOUND_PLAN_SHA = "1111111111111111111111111111111111111111111111111111111111111111";
const BOUND_PROMPT_SHA = "2222222222222222222222222222222222222222222222222222222222222222";
const BOUND_REFERENCE_SHA = "3333333333333333333333333333333333333333333333333333333333333333";
const BOUND_PRICE_SHA = "4444444444444444444444444444444444444444444444444444444444444444";
const APPROVED_ESTIMATE_SHA = "5555555555555555555555555555555555555555555555555555555555555555";
const jsonStream = (body) => ({ async *[Symbol.asyncIterator]() { yield Buffer.from(JSON.stringify(body)); } });
// `png(width, height)` is the existing valid-PNG fixture in generate-openai-images.test.mjs.
const pngBase64 = () => png(1024, 1024).toString("base64");
const staging = async (t) => { const root = await mkdtemp(path.join(tmpdir(), "cutscene-openai-")); t.after(() => rm(root, { recursive: true, force: true })); return root; };
const openAiJob = (asset_id) => ({ asset_id, prompt: "style reference", output: { width: 1024, height: 1024, path: `generated/${asset_id}.png`, format: "png" } });
const openAiFixture = (root) => ({ jobs: [openAiJob(STYLE_ID)], apiKey: "process-key-must-not-be-read", model: "gpt-image-2", quality: "low", stagingRoot: root, sleepFn: async () => {} });
const failingFetch = async () => { throw new Error("live network forbidden"); };
const liveCapability = () => Object.freeze({});
const boundManifest = (assetId, promptSha256, referenceSha256) => ({ schema_version: 1, assets: [{ asset_id: assetId, prompt_sha256: promptSha256, reference_images: [{ sha256: referenceSha256 }] }] });
const failedHostResult = (asset_id) => ({ results: [], failures: [{ asset_id, generation_state: "generation-failed", reason: "host-failed" }] });
const response = ({ status, body }) => ({ status, headers: { get: (name) => name === "x-request-id" ? "req-style-01" : null }, body: jsonStream(body) });
const successResponse = () => response({ status: 200, body: { data: [{ b64_json: pngBase64() }], usage: { input_tokens: 8, output_tokens: 4, total_tokens: 12, input_tokens_details: { text_tokens: 3, image_tokens: 5 } } } });
const approvedWaveFixture = () => ({ artifactRoot: "/tmp/cutscene", waveId: "style-master", receipt: { assetIds: [STYLE_ID], planSha256: BOUND_PLAN_SHA, promptPackageSha256: BOUND_PROMPT_SHA, referenceBindings: [{ assetId: STYLE_ID, sha256: BOUND_REFERENCE_SHA }], pricingSnapshotSha256: BOUND_PRICE_SHA, costEstimateSha256: APPROVED_ESTIMATE_SHA }, capability: liveCapability(), plan: { sha256: BOUND_PLAN_SHA }, manifest: boundManifest(STYLE_ID, BOUND_PROMPT_SHA, BOUND_REFERENCE_SHA), pricingSnapshot: { sha256: BOUND_PRICE_SHA }, estimate: { sha256: APPROVED_ESTIMATE_SHA, maximumUsd: 1.25 }, sleepFn: async () => {} });
const approvedHostWaveFixture = () => ({ ...approvedWaveFixture(), provider: "codex-host" });
const coded = (code, path) => Object.assign(new Error(code), { code, path });
test("OpenAI 500 retry authorizes every attempt before fetch", async (t) => {
  const fetches = []; const authorizations = [];
  const result = await generateOpenAIImages({ ...openAiFixture(await staging(t)), fetchFn: async () => { fetches.push("fetch"); return fetches.length === 1 ? response({ status: 500, body: { error: {} } }) : successResponse(); }, beforeProvider: ({ asset_id, attempt_ordinal }) => authorizations.push([asset_id, attempt_ordinal]) });
  assert.deepEqual(authorizations, [["cutscene-escape-style-master-style-01", 1], ["cutscene-escape-style-master-style-01", 2]]);
  assert.equal(fetches.length, 2); assert.equal(result.results[0].asset_id, "cutscene-escape-style-master-style-01");
});
test("reserve exhaustion after first OpenAI dispatch prevents second fetch", async () => {
  let fetches = 0; let authorizations = 0;
  await assert.rejects(() => runApprovedCutsceneImageWave({ ...approvedWaveFixture(), env: {}, fetchFn: async () => { fetches += 1; return response({ status: 500, body: { error: {} } }); }, authorizeProviderAttempt: ({ attemptOrdinal }) => { authorizations += 1; if (attemptOrdinal === 2) throw coded("cutscene.retry_reserve_exhausted", "/cutsceneWorkflow/waves/0/attempts/1"); } }), { code: "cutscene.retry_reserve_exhausted", path: "/cutsceneWorkflow/waves/0/attempts/1" });
  assert.deepEqual([fetches, authorizations], [1, 2]);
});
test("host cap exhaustion after first failure prevents second host dispatch", async () => {
  let hosts = 0;
  await assert.rejects(() => runApprovedCutsceneImageWave({ ...approvedHostWaveFixture(), env: {}, hostGenerate: async () => { hosts += 1; return failedHostResult("cutscene-escape-style-master-style-01"); }, authorizeProviderAttempt: ({ attemptOrdinal }) => { if (attemptOrdinal === 2) throw coded("cutscene.maximum_possible_cost_exceeded", "/cutsceneWorkflow/waves/0/estimate/maximumUsd"); } }), { code: "cutscene.maximum_possible_cost_exceeded", path: "/cutsceneWorkflow/waves/0/estimate/maximumUsd" });
  assert.equal(hosts, 1);
});
test("stale plan, prompt, reference, price, and estimate bindings dispatch zero providers", async () => {
  for (const [override, path] of [[{ plan: { sha256: "6666666666666666666666666666666666666666666666666666666666666666" } }, "/planSha256"], [{ receipt: { ...approvedWaveFixture().receipt, promptPackageSha256: "6666666666666666666666666666666666666666666666666666666666666666" } }, "/promptPackageSha256"], [{ receipt: { ...approvedWaveFixture().receipt, referenceBindings: [{ assetId: STYLE_ID, sha256: "0000000000000000000000000000000000000000000000000000000000000000" }] } }, "/referenceBindings/0/sha256"], [{ pricingSnapshot: { sha256: "0000000000000000000000000000000000000000000000000000000000000000" } }, "/pricingSnapshotSha256"], [{ estimate: { sha256: "6666666666666666666666666666666666666666666666666666666666666666", maximumUsd: 1.25 } }, "/costEstimateSha256"]]) { let calls = 0; await assert.rejects(() => runApprovedCutsceneImageWave({ ...approvedWaveFixture(), ...override, env: {}, fetchFn: async () => { calls += 1; return successResponse(); } }), { code: "cutscene.approval_binding_stale", path }); assert.equal(calls, 0); }
});
test("process key cannot bypass injected default network", async (t) => assert.rejects(() => generateOpenAIImages({ ...openAiFixture(await staging(t)), env: {}, fetchFn: failingFetch })));
```

- [ ] **Run RED.** `node --test --test-name-pattern='500 retry|reserve exhaustion|host cap exhaustion' tests/unit/generate-openai-images.test.mjs tests/unit/cutscene-generation-approval.test.mjs` → FAIL: current `beforeProvider` runs once before the internal `requestImage` loop and host has no retry authorization loop.
- [ ] **GREEN — implement.** Move `beforeProvider({asset_id,attempt_ordinal})` into `requestImage` immediately before each fetch. The wave wrapper passes `authorizeProviderAttempt` to every OpenAI and host retry, re-reads bound prompt/master bytes, and validates IDs, reserve, accumulated/max possible USD, current price and live approval. A coded failure invokes neither second fetch nor host callback. Preserve generation/edit endpoints, ordered repeated `image[]`, no `input_fidelity`, size/transparent contract and configurable `gpt-image-2`.
- [ ] **Run GREEN.** `node --test tests/unit/cutscene-generation-approval.test.mjs tests/unit/generate-openai-images.test.mjs tests/products/studio/image-assets.test.mjs tests/unit/image-assets.test.mjs` → PASS: OpenAI 500→success has two exact authorization callbacks; reserve/cap invalid fixtures have literal code/path and exactly one provider dispatch; process `OPENAI_API_KEY` cannot bypass `env:{}`/failing fetch.
- [ ] **Commit.** `git add shared/scripts/run-approved-cutscene-image-stage.mjs shared/scripts/run-image-asset-workflow.mjs shared/scripts/generate-openai-images.mjs tests/unit/cutscene-generation-approval.test.mjs tests/unit/generate-openai-images.test.mjs tests/products/studio/image-assets.test.mjs && git commit -m "feat: authorize every cutscene image attempt"`

### Task 5: Overlay, shared invalidation, continuity and derived lifecycle

**Depends on:** Task 4. Task 6 begins after this public runtime freeze.

**Files:** Create `shared/scripts/review-cutscene-continuity.mjs`; modify `shared/scripts/{plan-cutscene-visual-preproduction,run-approved-cutscene-image-stage}.mjs` and `tests/unit/{cutscene-visual-preproduction,cutscene-generation-approval}.test.mjs`.

**Interfaces:** consume Task 1 `deriveCutsceneLifecycle` and Task 2 `findCutsceneImpact`/`invalidateCutsceneDependents`; produce `buildVariantOverlay({basePlan,triggerState,changes}):CutsceneVariant` and `reviewCutsceneContinuity({plan,manifest,observations}):ContinuityReview`.

- [ ] **RED — preservation/derived tests.**

```js
const generatedFixture = () => ({ plan: { cutsceneId: "cutscene-escape", generationDag: { edges: [] } }, successfulAssetBytes: { "cutscene-escape-storyboard-shot-01": "7777777777777777777777777777777777777777777777777777777777777777" } });
const fixture = ({ blockers }) => ({ manifest: { assets: [{ approval_state: "production-candidate" }] }, waves: [], continuityReceipt: { blockingFindingIds: blockers } });
test("dialogue overlay preserves base bytes and creates no image", () => {
  const base = generatedFixture();
  assert.deepEqual(buildVariantOverlay({ basePlan: base.plan, triggerState: "QUEST-COMPANION-ABSENT", changes: [{ shotId: "SHOT-04", kind: "dialogue", value: "혼자 가야 해." }] }).generatedAssetIds, []);
  assert.deepEqual(base.successfulAssetBytes, generatedFixture().successfulAssetBytes);
});
test("blockers prevent derived document approval", () => assert.equal(deriveCutsceneLifecycle(fixture({ blockers: ["screen-direction"] })).documentApproved, false));
```

- [ ] **Run RED.** `node --test --test-name-pattern='dialogue|derived' tests/unit/cutscene-visual-preproduction.test.mjs tests/unit/cutscene-generation-approval.test.mjs` → FAIL: APIs absent.
- [ ] **GREEN — implement.** Dialogue-only has no derivative; visual changes regenerate only affected shots. Import, do not duplicate, Task 2 DAG APIs and Task 1 `deriveCutsceneLifecycle`. Findings have literal code/path, source masters, affected IDs and preserve overlays. The review consumes the derived status and never edits images/prompts/approval.
- [ ] **Run GREEN.** `node --test tests/unit/cutscene-visual-preproduction.test.mjs tests/unit/cutscene-generation-approval.test.mjs` → PASS.
- [ ] **Commit.** `git add shared/scripts/review-cutscene-continuity.mjs shared/scripts/plan-cutscene-visual-preproduction.mjs shared/scripts/run-approved-cutscene-image-stage.mjs tests/unit/cutscene-visual-preproduction.test.mjs tests/unit/cutscene-generation-approval.test.mjs && git commit -m "feat: derive cutscene continuity lifecycle"`

### Task 6: Studio skill, exact route and common runtime parity

**Depends on:** Task 5 public runtime freeze. Task 7 begins after routing/inventory freeze.

**Files:** Create `products/game-design-studio/plugin/skills/design-cutscene-visual-preproduction/{SKILL.md,agents/openai.yaml}`, `shared/document-quality/profiles/studio/cutscene-visual-preproduction.json`, `tests/products/studio/cutscene-visual-preproduction.test.mjs`; modify `products/game-design-studio/plugin/{references/routing.json,skills/design-game-content/SKILL.md,skills/plan-image-assets/SKILL.md,skills/generate-image-assets/SKILL.md,skills/review-image-assets/SKILL.md}`, `shared/document-quality/indexes/studio.json`, `tests/products/studio/{product-contract,image-assets}.test.mjs`, and `tests/products/career/{product-contract,image-assets}.test.mjs`.

**Consumes:** Tasks 1–5 public schema/runtime interfaces. **Produces:** Studio-only `design-cutscene-visual-preproduction`; closed top-level `cutsceneWorkflow`; Career common schema/runtime parity with no Studio skill/route.

- [ ] **RED — route exactness.**

```js
test("route shape stays exact and workflow metadata stays separate", async () => {
  const canonicalRouteBaseKeys = ["artifactType", "completionGates", "defaultReviewers", "eligibleProfiles", "id", "maxReviewers", "references", "requiredInputs", "skill", "triggerIntents"];
  const expected = { conditionalReviewers: undefined, outputArtifacts: ["cutscene-brief", "cutscene-shot-package", "cutscene-prompt-package", "cutscene-cost-estimate", "cutscene-continuity-review"], outputTypes: ["cutscene-visual-preproduction"] };
  const canonicalRouteKeys = [...canonicalRouteBaseKeys, ...(expected.conditionalReviewers ? ["conditionalReviewers"] : []), ...(expected.outputArtifacts ? ["outputArtifacts"] : []), ...(expected.outputTypes ? ["outputTypes"] : [])].sort();
  const readRouting = async () => JSON.parse(await readFile("products/game-design-studio/plugin/references/routing.json", "utf8"));
  const readCareerRouting = async () => JSON.parse(await readFile("products/game-design-career/plugin/references/routing.json", "utf8"));
  const routing = await readRouting();
  assert.equal(routing.routes.length, 14);
  assert.equal(routing.skillIds.length, 23);
  const route = routing.routes.find(({ id }) => id === "cutscene-visual-preproduction");
  assert.deepEqual(Object.keys(route).sort(), canonicalRouteKeys);
  assert.deepEqual(route.outputArtifacts, expected.outputArtifacts);
  assert.deepEqual(route.outputTypes, expected.outputTypes);
  assert.deepEqual(routing.cutsceneWorkflow, { schemaVersion: 1, waves: ["style-master", "reference-masters", "keyframes", "storyboard"], downstream: ["plan-image-assets", "generate-image-assets", "review-image-assets"], approval: "stage-by-stage-live-host-user" });
  assert.equal((await readCareerRouting()).skillIds.includes("design-cutscene-visual-preproduction"), false);
});
```

- [ ] **Run RED.** `node --test tests/products/studio/cutscene-visual-preproduction.test.mjs tests/products/studio/product-contract.test.mjs tests/products/studio/image-assets.test.mjs tests/products/career/product-contract.test.mjs tests/products/career/image-assets.test.mjs` → FAIL: route/skill/count fixtures absent.
- [ ] **GREEN — implement route and skill.**

```js
const route = { artifactType: "cutscene-visual-preproduction", completionGates: ["cutscene-continuity-current"], defaultReviewers: ["content-narrative-designer", "art-brief-director"], eligibleProfiles: ["live-service-rpg", "mobile", "pc-console"], id: "cutscene-visual-preproduction", maxReviewers: 3, references: ["references/methods/content-specification.md"], requiredInputs: ["cutscene brief", "game-state return"], skill: "design-cutscene-visual-preproduction", triggerIntents: ["컷씬 기획", "스토리보드", "시네마틱 이미지", "마스터 이미지", "컷씬 프롬프트"], outputArtifacts: ["cutscene-brief", "cutscene-shot-package", "cutscene-prompt-package", "cutscene-cost-estimate", "cutscene-continuity-review"], outputTypes: ["cutscene-visual-preproduction"] };
routing.routes.push(route);
routing.cutsceneWorkflow = { schemaVersion: 1, waves: ["style-master", "reference-masters", "keyframes", "storyboard"], downstream: ["plan-image-assets", "generate-image-assets", "review-image-assets"], approval: "stage-by-stage-live-host-user" };
```

Add Studio skill to `skillIds`/`plannedPaths.skills`; offer three modes/four waves and zero-call `approval-pending`. `plan-image-assets` only validates immutable handoff. Career packages common scripts/schemas only and receives no Studio route/skill.
- [ ] **Run GREEN.** `node --test tests/products/studio/cutscene-visual-preproduction.test.mjs tests/products/studio/product-contract.test.mjs tests/products/studio/image-assets.test.mjs tests/products/studio/core-design-skills.test.mjs tests/products/career/product-contract.test.mjs tests/products/career/image-assets.test.mjs` → PASS: Studio routing 23/source skills 16; Career routing 22/source skills 15.
- [ ] **Commit.** `git add products/game-design-studio/plugin/skills/design-cutscene-visual-preproduction products/game-design-studio/plugin/skills/design-game-content/SKILL.md products/game-design-studio/plugin/skills/plan-image-assets/SKILL.md products/game-design-studio/plugin/skills/generate-image-assets/SKILL.md products/game-design-studio/plugin/skills/review-image-assets/SKILL.md products/game-design-studio/plugin/references/routing.json shared/document-quality/indexes/studio.json shared/document-quality/profiles/studio/cutscene-visual-preproduction.json tests/products/studio/cutscene-visual-preproduction.test.mjs tests/products/studio/product-contract.test.mjs tests/products/studio/image-assets.test.mjs tests/products/career/product-contract.test.mjs tests/products/career/image-assets.test.mjs && git commit -m "feat: add Studio cutscene workflow"`

### Task 7: Guides, package contents and frozen inventory

**Depends on:** Task 6 routing/inventory freeze.

**Files:** Create `guides/game-design-studio/cutscene-visual-preproduction.md`; modify `README.md`, `guides/README.md`, `guides/game-design-studio/{README.md,installation.md,quick-start.md,workflow.md,faq.md,skills/README.md,use-cases/README.md,memory.md}`, `products/{game-design-studio/plugin/README.md,game-design-career/plugin/README.md}`, `tooling/{isolation-smoke.mjs,lib/user-guides.mjs}`, `tests/products/studio/readme.test.mjs`, `tests/products/career/readme.test.mjs`, `tests/contracts/{package-contents.test.mjs,memory-guides-source.test.mjs,root-readme-user-guides.test.mjs,user-guides-entry.test.mjs,user-guides-studio.test.mjs,user-guides-career.test.mjs}`, `tests/unit/{user-guides.test.mjs,build-product.test.mjs}`, and `tests/e2e/suite/memory-install-lifecycle.e2e.test.mjs`.

**Consumes:** Task 6 Studio skill, route and five shared top-level scripts. **Produces:** parsed guide headings/order/request blocks; literal inventory `{studio:{routing:23,installed:24,topLevelScripts:30},career:{routing:22,installed:23,topLevelScripts:30}}`.

- [ ] **RED — guide and inventory tests.**

```js
const repoRoot = process.cwd();
const parseMarkdownGuide = (markdown) => ({ headings: [...markdown.matchAll(/^## (.+)$/gmu)].map(([, heading]) => heading), requestBlocks: [...markdown.matchAll(/```text\n([^`]+)```/gmu)].map(([, request]) => ({ request: request.trim() })) });
// Import collectProductInventory(repoRoot, productId) from tooling/lib/user-guides.mjs.
const parseGuide = async (relativePath) => parseMarkdownGuide(await readFile(relativePath, "utf8"));
const installedInventory = async (productId) => { const source = await collectProductInventory(repoRoot, productId); const routing = JSON.parse(await readFile(path.join(repoRoot, "products", productId, "plugin/references/routing.json"), "utf8")); const scripts = (await readdir(path.join(repoRoot, "shared/scripts"))).filter((name) => name.endsWith(".mjs")).length; return { routing: routing.skillIds.length, installed: source.skillIds.length, topLevelScripts: scripts }; };
const inventories = async () => ({ studio: await installedInventory("game-design-studio"), career: await installedInventory("game-design-career") });
test("guide headings and request blocks are ordered", async () => {
  const guide = await parseGuide("guides/game-design-studio/cutscene-visual-preproduction.md");
  assert.deepEqual(guide.headings.slice(0, 4), ["컷씬 비주얼 프리프로덕션", "Prompt Only", "Estimate Only", "Generate After Approval"]);
  assert.deepEqual(guide.requestBlocks.map(({ request }) => request), ["컷씬 brief와 beat만 작성", "shot list와 continuity bible 작성", "마스터 프롬프트 패키지만 작성", "스타일 마스터 비용과 승인", "승인한 스타일 master 생성", "reference master bound prompt 재계산", "reference master 비용과 승인", "keyframe 비용과 승인", "storyboard와 variant 비용과 승인", "continuity 검토와 실패 ID 재시도"]);
});
test("inventory has five new scripts without Studio leakage", async () => assert.deepEqual(await inventories(), { studio: { routing: 23, installed: 24, topLevelScripts: 30 }, career: { routing: 22, installed: 23, topLevelScripts: 30 } }));
```

- [ ] **Run RED.** `node --test tests/products/studio/readme.test.mjs tests/products/career/readme.test.mjs tests/contracts/package-contents.test.mjs tests/contracts/memory-guides-source.test.mjs tests/contracts/root-readme-user-guides.test.mjs tests/contracts/user-guides-entry.test.mjs tests/contracts/user-guides-studio.test.mjs tests/contracts/user-guides-career.test.mjs tests/unit/user-guides.test.mjs tests/unit/build-product.test.mjs tests/e2e/suite/memory-install-lifecycle.e2e.test.mjs` → FAIL: guide, five scripts and exact inventory contracts absent.
- [ ] **GREEN — publish.** Use parsed, ordered copyable blocks: brief+beats; shot+continuity; template masters; style estimate/approval; style generation; bound reference masters; reference estimate/approval; keyframe estimate/approval; storyboard/variant estimate/approval; continuity review plus failed stable-ID retry. Every generation block requires count/quality/size/USD range/cap/live receipt and says host cost can be unavailable. Update Studio skill guide/index/installation/use-case, root/readme/guides, both product READMEs, package contents and memory source inventories. Studio asserts routing 23/installed 24/scripts 30; Career independently asserts routing 22/installed 23/scripts 30 and no Studio skill.
- [ ] **Run GREEN.** `node --test tests/products/studio/readme.test.mjs tests/products/career/readme.test.mjs tests/contracts/package-contents.test.mjs tests/contracts/memory-guides-source.test.mjs tests/contracts/root-readme-user-guides.test.mjs tests/contracts/user-guides-entry.test.mjs tests/contracts/user-guides-studio.test.mjs tests/contracts/user-guides-career.test.mjs tests/unit/user-guides.test.mjs tests/unit/build-product.test.mjs tests/e2e/suite/memory-install-lifecycle.e2e.test.mjs && node tooling/isolation-smoke.mjs` → PASS: installation replacement/removal preserves `.git/info/exclude`, project memory and sibling bytes.
- [ ] **Commit.** `git add guides/game-design-studio/cutscene-visual-preproduction.md README.md guides/README.md guides/game-design-studio/README.md guides/game-design-studio/installation.md guides/game-design-studio/quick-start.md guides/game-design-studio/workflow.md guides/game-design-studio/faq.md guides/game-design-studio/skills/README.md guides/game-design-studio/use-cases/README.md guides/game-design-studio/memory.md products/game-design-studio/plugin/README.md products/game-design-career/plugin/README.md tooling/isolation-smoke.mjs tooling/lib/user-guides.mjs tests/products/studio/readme.test.mjs tests/products/career/readme.test.mjs tests/contracts/package-contents.test.mjs tests/contracts/memory-guides-source.test.mjs tests/contracts/root-readme-user-guides.test.mjs tests/contracts/user-guides-entry.test.mjs tests/contracts/user-guides-studio.test.mjs tests/contracts/user-guides-career.test.mjs tests/unit/user-guides.test.mjs tests/unit/build-product.test.mjs tests/e2e/suite/memory-install-lifecycle.e2e.test.mjs && git commit -m "docs: publish cutscene workflow guides"`

### Task 8: Fifteen E2E scenarios and eleven hostile mutations

**Depends on:** Tasks 1–7.

**Files:** Create `tests/e2e/suite/cutscene-visual-preproduction.e2e.test.mjs`, `tests/fixtures/cutscene/cutscene-mutation-harness.mjs`, `tests/unit/cutscene-mutation-harness.test.mjs`, `.superpowers/sdd/2026-08-13-cutscene-visual-preproduction/task-report.md`; build generates `plugins/game-design-studio/**` and `plugins/game-design-career/**` only.

**Consumes:** Task 1 `deriveCutsceneLifecycle`, Task 2 `planCutsceneVisualPreproduction`, Task 3 `estimateCutsceneImageCost`, Task 4 `runApprovedCutsceneImageWave`/`retryCutsceneFailedAssets`/`writeCutsceneUsageReceipt`, and Task 5 `buildVariantOverlay`/`reviewCutsceneContinuity`. **Produces:** test-local `preproductionPublicApi(fixture):Promise<E2EResult>` which invokes those public APIs; `runCutsceneMutationHarness({name,fixture,mutate}):Promise<{code:string,path:string,providerCalls:number,writes:string[],unaffectedOutputSha256:string}>`; and 15 scenarios/11 named mutations using `env:{}`, failing default network, fake `fetchFn` and fake host callback.

- [ ] **RED — write 15 public scenarios with complete fixtures.**

```js
const ID = "cutscene-escape-style-master-style-01";
const PLAN = "1111111111111111111111111111111111111111111111111111111111111111";
const PROMPT = "2222222222222222222222222222222222222222222222222222222222222222";
const REFERENCE = "3333333333333333333333333333333333333333333333333333333333333333";
const PRICE = "4444444444444444444444444444444444444444444444444444444444444444";
const ESTIMATE = "5555555555555555555555555555555555555555555555555555555555555555";
const make = (override = {}) => ({ artifactRoot: temporaryRoot(), env: {}, fetchFn: failingFetch, hostGenerate: fakeHost, planSha256: PLAN, promptSha256: PROMPT, referenceSha256: REFERENCE, pricingSha256: PRICE, estimateSha256: ESTIMATE, providerCalls: 0, ...override });
const temporaryRoot = () => "/tmp/cutscene-e2e";
const failingFetch = async () => { throw new Error("live network forbidden"); };
const pngBytes = () => Buffer.from("89504e470d0a1a0a", "hex");
const fakeHost = async ({ jobs }) => ({ results: jobs.map(({ asset_id }) => ({ asset_id, bytes: pngBytes() })), failures: [] });
const errorView = (error) => ({ code: error.code, path: error.path });
const mutationExpected = { "approval-authority": { code: "cutscene.approval_capability_invalid", path: "/capability" }, "approval-binding": { code: "cutscene.approval_binding_stale", path: "/promptPackageSha256" }, "reference-binding": { code: "cutscene.reference_binding_stale", path: "/referenceBindings/0/sha256" }, "stage-selection": { code: "cutscene.wave_asset_not_approved", path: "/assetIds/1" }, "cost-cap": { code: "cutscene.maximum_possible_cost_exceeded", path: "/cutsceneWorkflow/waves/0/estimate/maximumUsd" }, "retry-reserve": { code: "cutscene.retry_reserve_exhausted", path: "/cutsceneWorkflow/waves/0/attempts/1" }, "mode-boundary": { code: "cutscene.mode_generation_forbidden", path: "/mode" }, "usage-completeness": { code: "cutscene.usage_input_mismatch", path: "/inputTokens" }, "variant-overlay": { code: "cutscene.variant_duplicate_base_asset", path: "/generatedAssetIds/0" }, "partial-retry": { code: "cutscene.successful_asset_overwrite", path: "/assets/0/output" }, "continuity-gate": { code: "cutscene.continuity_blocker_unresolved", path: "/blockingFindingIds/0" } };
const preproductionPublicApi = async (fixture) => {
  const planned = planCutsceneVisualPreproduction({ cutsceneId: "cutscene-escape", mode: fixture.mode, beats: [{ beatId: "BEAT-01" }], shots: [{ shotId: "SHOT-01", beatId: "BEAT-01" }], planSha256: fixture.planSha256, promptSha256: fixture.promptSha256, referenceSha256: fixture.referenceSha256 });
  if (fixture.mode === "prompt-only" || fixture.mode === "estimate-only") return { providerCalls: 0, generatedFiles: [], template: planned.templatePromptPackage, usageReceipts: [] };
  return runApprovedCutsceneImageWave({ ...fixture, plan: planned.plan, manifest: planned.manifest });
};
// Task 4 exports both functions with the shown signatures; the E2E suite imports them directly.
const runCutsceneMutationHarness = async ({ name, fixture, mutate }) => {
  const attempted = structuredClone(fixture);
  Object.assign(attempted, mutate);
  try { await preproductionPublicApi(attempted); assert.fail(`${name} unexpectedly dispatched`); } catch (error) { return { ...errorView(error), providerCalls: attempted.providerCalls, writes: [], unaffectedOutputSha256: "7777777777777777777777777777777777777777777777777777777777777777" }; }
};
const runPreproduction = (fixture) => preproductionPublicApi(fixture);
const runEstimate = (fixture) => estimateCutsceneImageCost(fixture);
const retryFailedAssets = (fixture) => retryCutsceneFailedAssets(fixture);
const buildDialogueOverlay = (fixture) => buildVariantOverlay({ ...fixture, changes: [{ shotId: "SHOT-04", kind: "dialogue", value: "혼자 가야 해." }] });
const buildVisualOverlay = (fixture) => buildVariantOverlay({ ...fixture, changes: [{ shotId: "SHOT-04", kind: "blocking", value: "Lyra exits left" }] });
const writeUsageReceipt = (fixture) => writeCutsceneUsageReceipt(fixture);
const mutationFor = (name) => ({ "approval-authority": { capability: {} }, "approval-binding": { promptSha256: "6666666666666666666666666666666666666666666666666666666666666666" }, "reference-binding": { referenceSha256: "0000000000000000000000000000000000000000000000000000000000000000" }, "stage-selection": { assetIds: [ID, "cutscene-escape-storyboard-shot-99"] }, "cost-cap": { maximumUsd: 0 }, "retry-reserve": { retryReserve: 0 }, "mode-boundary": { mode: "prompt-only" }, "usage-completeness": { inputTokens: 8, inputTextTokens: 3, inputImageTokens: 4 }, "variant-overlay": { generatedAssetIds: [ID] }, "partial-retry": { overwriteOutput: true }, "continuity-gate": { ignoreBlocking: true } }[name]);
const runMutation = async ({ name, fixture, mutate }) => runCutsceneMutationHarness({ name, fixture, mutate });
const cases = [
  ["prompt-only", make({ mode: "prompt-only" }), runPreproduction, (r) => assert.deepEqual([r.providerCalls, r.generatedFiles, r.template.references[0].sha256], [0, [], undefined])],
  ["estimate-only", make({ mode: "estimate-only" }), runPreproduction, (r) => assert.deepEqual([r.providerCalls, r.usageReceipts], [0, []])],
  ["host-unavailable", make({ provider: "codex-host", pricingStatus: "unavailable" }), runEstimate, (r) => assert.deepEqual(r.totals, { minimumUsd: null, expectedUsd: null, maximumUsd: null, status: "unavailable" })],
  ["style-approval", make({ waveId: "style-master", approval: null }), runApprovedCutsceneImageWave, (e) => assert.deepEqual(errorView(e), { code: "cutscene.approval_required", path: "/cutsceneWorkflow/waves/0/approval" })],
  ["reference-bound-style", make({ waveId: "reference-masters", referenceSha256: "0000000000000000000000000000000000000000000000000000000000000000" }), runApprovedCutsceneImageWave, (e) => assert.deepEqual(errorView(e), { code: "cutscene.reference_binding_stale", path: "/referenceBindings/0/sha256" })],
  ["keyframe-stale-master", make({ waveId: "keyframes", masterApprovalState: "concept-draft" }), runApprovedCutsceneImageWave, (e) => assert.deepEqual(errorView(e), { code: "cutscene.prerequisite_wave_incomplete", path: "/cutsceneWorkflow/waves/1/completion" })],
  ["storyboard-extra-id", make({ waveId: "storyboard", assetIds: [ID, "cutscene-escape-storyboard-shot-99"] }), runApprovedCutsceneImageWave, (e) => assert.deepEqual(errorView(e), { code: "cutscene.wave_asset_not_approved", path: "/assetIds/1" })],
  ["binding-reapproval", make({ promptSha256: "6666666666666666666666666666666666666666666666666666666666666666" }), runApprovedCutsceneImageWave, (e) => assert.deepEqual(errorView(e), { code: "cutscene.approval_binding_stale", path: "/promptPackageSha256" })],
  ["reserve-cap", make({ retryReserve: 0 }), runApprovedCutsceneImageWave, (e) => assert.deepEqual([errorView(e), e.providerCalls], [{ code: "cutscene.retry_reserve_exhausted", path: "/cutsceneWorkflow/waves/0/attempts/1" }, 0])],
  ["partial-retry", make({ failedIds: [ID] }), retryFailedAssets, (r) => assert.deepEqual([r.retriedIds, r.unaffectedOutputSha256], [[ID], "7777777777777777777777777777777777777777777777777777777777777777"])],
  ["dialogue-overlay", make(), buildDialogueOverlay, (r) => assert.deepEqual(r.generatedAssetIds, [])],
  ["visual-overlay", make(), buildVisualOverlay, (r) => assert.deepEqual(r.generatedAssetIds, ["cutscene-escape-storyboard-shot-04"])],
  ["continuity-drift", make(), reviewCutsceneContinuity, (r) => assert.deepEqual(r.blockingFindingIds, ["screen-direction-break:SHOT-04"])],
  ["derived-lifecycle", make({ assetApprovalState: "concept-draft" }), deriveCutsceneLifecycle, (r) => assert.equal(r.productionCandidate, false)],
  ["usage-unavailable", make({ usage: { inputTokens: 8, inputTextTokens: 3, inputImageTokens: 5, outputTokens: 4, totalTokens: 12 } }), writeUsageReceipt, (r) => assert.deepEqual(r.actualCost, { status: "unavailable", reason: "cached-token-breakdown-unavailable" })],
];
for (const [name, fixture, call, verify] of cases) test(name, async () => { try { verify(await call(fixture)); } catch (error) { verify(error); } });
```
- [ ] **Run RED.** `node --test tests/e2e/suite/cutscene-visual-preproduction.e2e.test.mjs` → FAIL: suite absent.
- [ ] **GREEN — mutate exactly.**

```js
for (const [name, expected] of [
  ["approval-authority", { code: "cutscene.approval_capability_invalid", path: "/capability" }],
  ["approval-binding", { code: "cutscene.approval_binding_stale", path: "/promptPackageSha256" }],
  ["reference-binding", { code: "cutscene.reference_binding_stale", path: "/referenceBindings/0/sha256" }],
  ["stage-selection", { code: "cutscene.wave_asset_not_approved", path: "/assetIds/1" }],
  ["cost-cap", { code: "cutscene.maximum_possible_cost_exceeded", path: "/cutsceneWorkflow/waves/0/estimate/maximumUsd" }],
  ["retry-reserve", { code: "cutscene.retry_reserve_exhausted", path: "/cutsceneWorkflow/waves/0/attempts/1" }],
  ["mode-boundary", { code: "cutscene.mode_generation_forbidden", path: "/mode" }],
  ["usage-completeness", { code: "cutscene.usage_input_mismatch", path: "/inputTokens" }],
  ["variant-overlay", { code: "cutscene.variant_duplicate_base_asset", path: "/generatedAssetIds/0" }],
  ["partial-retry", { code: "cutscene.successful_asset_overwrite", path: "/assets/0/output" }],
  ["continuity-gate", { code: "cutscene.continuity_blocker_unresolved", path: "/blockingFindingIds/0" }],
]) {
  const outcome = await runMutation({ name, fixture: make({ assetId: ID, planSha256: PLAN, promptSha256: PROMPT, referenceSha256: REFERENCE, pricingSha256: PRICE, estimateSha256: ESTIMATE }), mutate: mutationFor(name) });
  assert.deepEqual({ code: outcome.code, path: outcome.path, providerCalls: outcome.providerCalls, writes: outcome.writes, unaffectedOutputSha256: outcome.unaffectedOutputSha256 }, { ...expected, providerCalls: 0, writes: [], unaffectedOutputSha256: "7777777777777777777777777777777777777777777777777777777777777777" });
}
```

All fixtures set `env:{}`, use failing default network plus fake `fetchFn`/host callback, require nonempty collections before `every`, and use a dedicated FD, bounded output, timeout, environment allowlist and process-tree cleanup.
- [ ] **Run GREEN.** `node --test tests/unit/cutscene-mutation-harness.test.mjs tests/unit/cutscene-visual-preproduction.test.mjs tests/unit/cutscene-generation-approval.test.mjs tests/unit/generate-openai-images.test.mjs tests/products/studio/cutscene-visual-preproduction.test.mjs tests/e2e/suite/cutscene-visual-preproduction.e2e.test.mjs` → 15 scenarios/11 mutations PASS with zero paid calls.
- [ ] **Final gates.** `npm run build && npm run build -- --check && node tooling/validate-packages.mjs plugins/game-design-studio plugins/game-design-career && npm run test:unit && npm run test:contracts && npm run test:products && git diff --check` → PASS; Career has common runtime/schema but no Studio route/skill.
- [ ] **Commit.** `git add tests/e2e/suite/cutscene-visual-preproduction.e2e.test.mjs tests/fixtures/cutscene/cutscene-mutation-harness.mjs tests/unit/cutscene-mutation-harness.test.mjs plugins/game-design-studio plugins/game-design-career && git add -f .superpowers/sdd/2026-08-13-cutscene-visual-preproduction/task-report.md && git commit -m "test: prove cutscene visual lifecycle"`

## Final Review Checklist

- [ ] Tasks 1–5 serial; Task 6 after runtime freeze; Task 7 after routing/inventory freeze; Task 8 proves whole lifecycle.
- [ ] One manifest writer, four authoritative waves, derived root state, template/bound prompt split, no live paid test calls.
- [ ] Exact routes, counts, guide ordering, 15 E2E scenarios and 11 mutations are literal test contracts.
