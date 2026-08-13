# Cutscene Visual Preproduction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 컷씬의 beat·shot·연속성·마스터 레퍼런스와 이미지 프롬프트를 구조화하고, 프롬프트만 제공하거나 단계별 비용 승인 뒤 안전하게 이미지를 생성한다.

**Architecture:** Studio 전용 `design-cutscene-visual-preproduction` 스킬이 중립 컷씬 계약과 생성 DAG를 만들고, 공통 이미지 런타임이 프롬프트·비용·승인·usage receipt를 검증한다. 실제 생성은 승인 receipt를 현재 prompt package, reference SHA-256, 모델·품질·크기와 비용 한도에 다시 결속한 뒤 기존 image workflow의 선택 생성 경로만 호출한다.

**Tech Stack:** Node.js `>=18` ESM, JSON Schema 2020-12, SHA-256, `node:test`, 기존 image asset manifest·provider routing·safe artifact writer

**Spec:** `docs/superpowers/specs/2026-08-13-cutscene-visual-preproduction-design.md`

## Global Constraints

- 1차 범위는 마스터 레퍼런스, 주요 키프레임과 전체 storyboard package이며 완성 영상·음성·엔진 timeline은 제외한다.
- 컷씬 기획은 이미지 생성 전에 intent, beat, shot, continuity, variant와 게임 복귀 상태를 확정한다.
- 마스터 승인 순서는 style → character/environment/prop → keyframe → connective/variant shot이다.
- `prompt-only`, `estimate-only`, `generate-after-approval`을 분리한다.
- `prompt-only`와 `estimate-only`는 이미지 provider 호출이 0회다.
- 실제 생성은 master, keyframe, storyboard 단계별 비용·범위 승인 뒤에만 실행한다.
- prompt, reference SHA-256, asset ID, 모델, 품질, 크기, 비용 한도 또는 variant 범위 변경 시 재승인한다.
- 비용을 알 수 없는 host 경로는 무료라고 표시하지 않고 `unavailable`로 기록한다.
- 가격은 실행 시점의 공식 출처 snapshot을 입력으로 받으며 코드에 금액을 영구 상수로 두지 않는다.
- 부분 실패는 성공 자산을 보존하고 실패한 안정 asset ID만 재시도한다.
- 생성 성공은 사람의 문서 승인이나 production candidacy가 아니다.
- 기존 이미지 자산 스키마, rights review와 artifact 안전 경계를 우회하지 않는다.

## File Structure

### New contracts and runtime

- `shared/image-assets/schema/cutscene-visual-plan.schema.json`: brief, beat, shot, continuity, masters, variants, DAG와 상태
- `shared/image-assets/schema/cutscene-cost-estimate.schema.json`: 단계별 가격 snapshot과 최소·예상·최대 비용
- `shared/image-assets/schema/cutscene-generation-approval.schema.json`: host-user 승인 결속
- `shared/image-assets/schema/cutscene-generation-usage.schema.json`: provider usage·실제 비용 또는 산정 불가 사유
- `shared/image-assets/schema/cutscene-continuity-review.schema.json`: shot·variant 연속성 finding
- `shared/image-assets/references/cutscene-generation-policy.md`: prompt-only·estimate·approval·retry 정책
- `shared/image-assets/templates/cutscene/`: prompt-only seed와 generation guide
- `shared/scripts/validate-cutscene-visual-preproduction.mjs`: schema/runtime parity validator
- `shared/scripts/plan-cutscene-visual-preproduction.mjs`: plan, image manifest, prompt package와 DAG
- `shared/scripts/estimate-cutscene-image-cost.mjs`: 공식 가격 snapshot 기반 estimate
- `shared/scripts/lib/cutscene-generation-approval.mjs`: approval receipt 검증과 binding hash
- `shared/scripts/run-approved-cutscene-image-stage.mjs`: provider preflight와 단계별 생성 wrapper
- `shared/scripts/review-cutscene-continuity.mjs`: continuity finding과 invalidation

### Existing image runtime changes

- `shared/scripts/run-image-asset-workflow.mjs`: 이미 계획된 manifest의 configured selected generation export
- `shared/scripts/generate-openai-images.mjs`: bounded provider usage 정규화
- `shared/image-assets/schema/image-assets.schema.json`: 컷씬 stage·shot lineage의 선택 필드
- `shared/image-assets/prompt-patterns/storyboard.json`: 컷씬 shot camera·blocking·continuity 목적 명시
- `shared/templates/canonical-artifact/assets/image-assets.yml`: 새 선택 필드를 쓰지 않는 기존 seed 호환 유지

### Studio integration and guides

- `products/game-design-studio/plugin/skills/design-cutscene-visual-preproduction/SKILL.md`
- `products/game-design-studio/plugin/skills/design-cutscene-visual-preproduction/agents/openai.yaml`
- `products/game-design-studio/plugin/skills/design-game-content/SKILL.md`
- `products/game-design-studio/plugin/skills/plan-image-assets/SKILL.md`
- `products/game-design-studio/plugin/skills/generate-image-assets/SKILL.md`
- `products/game-design-studio/plugin/skills/review-image-assets/SKILL.md`
- `products/game-design-studio/plugin/references/routing.json`
- `shared/document-quality/indexes/studio.json`
- `shared/document-quality/profiles/studio/cutscene-visual-preproduction.json`
- `guides/game-design-studio/cutscene-visual-preproduction.md`
- `guides/game-design-studio/README.md`, `README.md`

### Tests

- `tests/unit/cutscene-visual-preproduction.test.mjs`
- `tests/unit/cutscene-generation-approval.test.mjs`
- `tests/products/studio/cutscene-visual-preproduction.test.mjs`
- `tests/e2e/suite/cutscene-visual-preproduction.e2e.test.mjs`
- `tests/fixtures/cutscene/cutscene-mutation-harness.mjs`
- `tests/unit/cutscene-mutation-harness.test.mjs`
- existing image-assets, build, product, isolation, lifecycle and guide tests

---

### Task 1: Closed cutscene plan and review contracts

**Files:**
- Create: `shared/image-assets/schema/cutscene-visual-plan.schema.json`
- Create: `shared/image-assets/schema/cutscene-cost-estimate.schema.json`
- Create: `shared/image-assets/schema/cutscene-generation-approval.schema.json`
- Create: `shared/image-assets/schema/cutscene-generation-usage.schema.json`
- Create: `shared/image-assets/schema/cutscene-continuity-review.schema.json`
- Create: `shared/scripts/validate-cutscene-visual-preproduction.mjs`
- Create: `tests/unit/cutscene-visual-preproduction.test.mjs`

**Interfaces:**
- Produces: `validateCutsceneVisualPlan(value): ValidationResult`
- Produces: `validateCutsceneCostEstimate(value): ValidationResult`
- Produces: `validateCutsceneGenerationApproval(value): ValidationResult`
- Produces: `validateCutsceneGenerationUsage(value): ValidationResult`
- Produces: `validateCutsceneContinuityReview(value): ValidationResult`
- Produces: `canonicalCutsceneDocument(value): string`, `cutsceneDocumentSha256(value): string`

- [ ] **Step 1: Write failing closed-schema parity tests**

```js
test("cutscene plan closes state, beat, shot, master, variant and DAG fields", () => {
  assert.equal(validateCutsceneVisualPlan(validCutscenePlan()).ok, true);
  for (const mutate of [
    (value) => { value.mode = "auto-generate"; },
    (value) => { value.state = "approved"; },
    (value) => { value.shots[0].camera.size = "whatever"; },
    (value) => { value.variants[0].baseShotIds = ["SHOT-MISSING"]; },
    (value) => { value.generationDag.edges.push({ from: "SHOT-2", to: "MASTER-STYLE" }); },
    (value) => { value.unknown = true; },
  ]) {
    const candidate = structuredClone(validCutscenePlan());
    mutate(candidate);
    assert.equal(validateCutsceneVisualPlan(candidate).ok, false);
  }
});

test("host cost cannot be represented as free when pricing is unavailable", () => {
  const estimate = validCostEstimate({ provider: "codex-host", pricingStatus: "unavailable" });
  assert.equal(validateCutsceneCostEstimate(estimate).ok, true);
  estimate.totals.expectedUsd = 0;
  assert.equal(validateCutsceneCostEstimate(estimate).ok, false);
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test tests/unit/cutscene-visual-preproduction.test.mjs`

Expected: FAIL because the schemas and validator module do not exist.

- [ ] **Step 3: Define the plan schema exactly**

Use these enums and required collections:

```json
{
  "mode": ["prompt-only", "estimate-only", "generate-after-approval"],
  "state": ["planned", "prompt-ready", "cost-estimated", "approval-pending", "generation-approved", "generated", "continuity-review", "document-approved", "production-candidate"],
  "stage": ["masters", "keyframes", "storyboard"],
  "masterKind": ["style", "character", "environment", "prop", "lighting-color", "expression", "scale"],
  "variantChange": ["dialogue", "expression", "blocking", "character-state", "quest-state", "prop-state", "environment-state"],
  "required": ["schemaVersion", "cutsceneId", "mode", "state", "brief", "beats", "shots", "continuity", "masters", "variants", "generationDag", "budget"]
}
```

Each shot requires `sceneId`, `beatId`, `shotId`, purpose, characters/state, camera size/angle/movement/focus, blocking, eyeline, screenDirection, environment, lighting, color, subtitleSafeArea, durationSeconds, transition, soundCues, continuity and returnStateImpact.

- [ ] **Step 4: Implement runtime graph and semantic validation**

```js
export function validateCutsceneVisualPlan(value) {
  const errors = validateClosedShape(value);
  validateUniqueIds(errors, value);
  validateReferences(errors, value);
  validateAcyclicGenerationDag(errors, value.generationDag);
  validateStageOrder(errors, value);
  validateVariantOverlays(errors, value);
  return { ok: errors.length === 0, errors };
}
```

Reject CR, NUL, non-NFC, duplicate or unsorted semantic arrays, unknown references, cyclic DAGs, variant base duplication, master after derivative, invalid state jumps and `document-approved` without a continuity review.

- [ ] **Step 5: Run schema parse and GREEN**

Run: `node --test tests/unit/cutscene-visual-preproduction.test.mjs`

Run: `node -e 'for (const p of process.argv.slice(1)) JSON.parse(require("fs").readFileSync(p,"utf8"))' shared/image-assets/schema/cutscene-*.schema.json`

Expected: all schema/runtime parity tests pass.

- [ ] **Step 6: Commit Task 1**

```bash
git add shared/image-assets/schema/cutscene-visual-plan.schema.json shared/image-assets/schema/cutscene-cost-estimate.schema.json shared/image-assets/schema/cutscene-generation-approval.schema.json shared/image-assets/schema/cutscene-generation-usage.schema.json shared/image-assets/schema/cutscene-continuity-review.schema.json shared/scripts/validate-cutscene-visual-preproduction.mjs tests/unit/cutscene-visual-preproduction.test.mjs
git commit -m "feat: define cutscene visual contracts"
```

### Task 2: Deterministic preproduction plan, prompts and generation DAG

**Files:**
- Create: `shared/image-assets/references/cutscene-generation-policy.md`
- Create: `shared/image-assets/templates/cutscene/cutscene-brief.md`
- Create: `shared/image-assets/templates/cutscene/beat-sheet.yml`
- Create: `shared/image-assets/templates/cutscene/shot-list.yml`
- Create: `shared/image-assets/templates/cutscene/continuity-bible.yml`
- Create: `shared/image-assets/templates/cutscene/master-reference-plan.yml`
- Create: `shared/image-assets/templates/cutscene/generation-guide.md`
- Create: `shared/scripts/plan-cutscene-visual-preproduction.mjs`
- Modify: `shared/image-assets/schema/image-assets.schema.json`
- Modify: `shared/image-assets/prompt-patterns/storyboard.json`
- Modify: `shared/scripts/validate-image-assets.mjs`
- Modify: `tests/unit/cutscene-visual-preproduction.test.mjs`
- Modify: `tests/unit/image-assets.test.mjs`

**Interfaces:**
- Consumes: Task 1 validators and existing `validateImageAssetManifest`
- Produces: `planCutsceneVisualPreproduction(input): {plan,manifest,promptPackage}`
- Produces: `compileCutscenePrompts({plan,manifest}): {markdown,json,promptPackageSha256}`
- Produces: `writeCutscenePromptPackage({artifactRoot,plan,manifest,promptPackage}): Promise<{files,promptPackageSha256}>`
- Produces: `invalidateCutsceneDependents({plan,changedAssetIds}): {plan,invalidatedAssetIds}`

- [ ] **Step 1: Add RED prompt-only and DAG tests**

```js
test("prompt-only writes complete prompts and guide without image bytes", async (t) => {
  const root = await artifactRoot(t);
  const result = await writeCutscenePromptPackage({
    artifactRoot: root,
    ...planCutsceneVisualPreproduction(cutsceneInput({ mode: "prompt-only" })),
  });
  assert.deepEqual(result.files, expectedPromptOnlyFiles);
  assert.equal(await countGeneratedImages(root), 0);
  assert.match(await readFile(path.join(root, "cutscene/generation-guide.md"), "utf8"),
    /스타일 마스터[\s\S]*캐릭터·환경·소품[\s\S]*키프레임[\s\S]*연결 shot/u);
});

test("every derivative follows its approved master in the DAG", () => {
  const { plan } = planCutsceneVisualPreproduction(cutsceneInput());
  assert.deepEqual(topologicalAssetIds(plan.generationDag), expectedTopologicalAssetIds);
  assert.equal(plan.shots.every(({ referenceAssetIds }) => referenceAssetIds.length > 0), true);
});
```

- [ ] **Step 2: Run focused tests and verify RED**

Run: `node --test --test-name-pattern='prompt-only|every derivative' tests/unit/cutscene-visual-preproduction.test.mjs`

Expected: FAIL because the planner and templates are absent.

- [ ] **Step 3: Implement stable IDs and asset stages**

```js
const stageOrder = Object.freeze(["masters", "keyframes", "storyboard"]);

function assetId({ cutsceneId, stage, sourceId, variantId }) {
  return [cutsceneId, stage, sourceId, variantId].filter(Boolean).join("-").toLowerCase();
}

function masterReferences(plan, shot) {
  return [...new Set([plan.styleMasterId, ...shot.characterMasterIds, shot.environmentMasterId, ...shot.propMasterIds])];
}
```

Map every asset into the existing image manifest as `type: "story-storyboard"`, `approval_state: "concept-draft"`, stage-specific `requirement`, stable `asset_set_id`, `derivative_of`, ordered `reference_asset_ids`, empty pre-generation `reference_images`, consistency anchors and parent prompt digests.

- [ ] **Step 4: Compile full shot prompts in a fixed field order**

```js
function shotPrompt(shot, references) {
  return [
    `Shot purpose: ${shot.purpose}`,
    `Reference masters: ${references.map(({ assetId, sha256 }) => `${assetId}@${sha256}`).join(", ")}`,
    `Preserve: ${shot.preserve.join("; ")}`,
    `Camera: ${shot.camera.size}; ${shot.camera.angle}; ${shot.camera.movement}; focus ${shot.camera.focus}`,
    `Blocking and action: ${shot.blocking}`,
    `Eyeline and screen direction: ${shot.eyeline}; ${shot.screenDirection}`,
    `Lighting, color, depth: ${shot.lighting}; ${shot.color}; ${shot.depth}`,
    `Continuity: ${shot.continuity.join("; ")}`,
    `Exclude: ${shot.exclude.join("; ")}`,
    `Output: ${shot.output.width}x${shot.output.height}; ${shot.output.aspectRatio}; subtitle-safe ${shot.subtitleSafeArea}`,
  ].join("\n");
}
```

Master prompts omit reference hash only when they are roots. All derivative prompts require current references before becoming `prompt-ready`.

- [ ] **Step 5: Write the exact Prompt Only package**

Write these files through `safeWriteArtifactFile`:

```text
cutscene/cutscene-brief.md
cutscene/beat-sheet.yml
cutscene/shot-list.yml
cutscene/continuity-bible.yml
cutscene/master-reference-plan.yml
cutscene/generation-dag.json
cutscene/prompts/01-style-master.md
cutscene/prompts/02-character-masters.md
cutscene/prompts/03-environment-masters.md
cutscene/prompts/04-keyframes.md
cutscene/prompts/05-storyboard-shots.md
cutscene/prompts/prompt-manifest.json
cutscene/generation-guide.md
assets/image-assets.yml
```

- [ ] **Step 6: Run GREEN and existing image regression**

Run: `node --test tests/unit/cutscene-visual-preproduction.test.mjs tests/unit/image-assets.test.mjs`

Expected: prompt package, DAG, lineage and legacy image manifest tests pass.

- [ ] **Step 7: Commit Task 2**

```bash
git add shared/image-assets/references/cutscene-generation-policy.md shared/image-assets/templates/cutscene shared/scripts/plan-cutscene-visual-preproduction.mjs shared/image-assets/schema/image-assets.schema.json shared/image-assets/prompt-patterns/storyboard.json shared/scripts/validate-image-assets.mjs tests/unit/cutscene-visual-preproduction.test.mjs tests/unit/image-assets.test.mjs
git commit -m "feat: plan cutscene image prompts"
```

### Task 3: Cost estimation and host-user approval binding

**Files:**
- Create: `shared/scripts/estimate-cutscene-image-cost.mjs`
- Create: `shared/scripts/lib/cutscene-generation-approval.mjs`
- Create: `tests/unit/cutscene-generation-approval.test.mjs`
- Modify: `tests/unit/cutscene-visual-preproduction.test.mjs`

**Interfaces:**
- Consumes: Task 1 schemas, Task 2 prompt package hash and stage assets
- Produces: `estimateCutsceneImageCost({plan,stage,pricingSnapshot,retryReserve}): CostEstimate`
- Produces: `cutsceneApprovalBinding({plan,estimate}): ApprovalBinding`
- Produces: `validateHostCutsceneApproval({approval,plan,estimate,hostEvent}): ApprovalReceipt`
- Produces: `requiresCutsceneReapproval({approval,plan,estimate}): boolean`

- [ ] **Step 1: Add RED tests for three modes and reapproval**

```js
test("prompt-only and estimate-only never authorize generation", () => {
  for (const mode of ["prompt-only", "estimate-only"]) {
    const estimate = estimateCutsceneImageCost({ plan: planFixture({ mode }), stage: "masters", pricingSnapshot: officialPricingFixture(), retryReserve: 1 });
    assert.equal(estimate.generationAuthorized, false);
  }
});

test("approval is stale after prompt, reference, model, quality, size, cap or variant change", () => {
  const { plan, estimate, approval } = approvedStageFixture();
  for (const mutate of approvalInvalidatingMutations) {
    const next = structuredClone(plan);
    mutate(next);
    assert.equal(requiresCutsceneReapproval({ approval, plan: next, estimate }), true);
  }
});
```

- [ ] **Step 2: Run approval tests and verify RED**

Run: `node --test tests/unit/cutscene-generation-approval.test.mjs`

Expected: FAIL because estimate and approval modules do not exist.

- [ ] **Step 3: Implement a provider-neutral pricing snapshot**

```js
const pricingSnapshot = {
  schemaVersion: 1,
  provider: "openai",
  model: "gpt-image-2",
  sourceUrl: "https://openai.com/api/pricing/",
  retrievedAt: "2026-08-13T00:00:00.000Z",
  currency: "USD",
  units: {
    textInputPerMillionTokens: 5,
    cachedTextInputPerMillionTokens: 1.25,
    imageInputPerMillionTokens: 8,
    cachedImageInputPerMillionTokens: 2,
    imageOutputPerMillionTokens: 30
  }
};
```

The values above are a test fixture, not runtime defaults. Runtime accepts only a host-provided official `https://openai.com/` or `https://developers.openai.com/` snapshot with timestamp and computes `minimumUsd`, `expectedUsd`, `maximumUsd` from per-asset token ranges. Host pricing uses `pricingStatus: "unavailable"` and all totals `null`.

- [ ] **Step 4: Implement exact approval receipt validation**

```js
const requiredApprovalFields = Object.freeze([
  "schemaVersion", "kind", "capture", "cutsceneId", "stage", "assetIds",
  "promptPackageSha256", "referenceBindings", "provider", "model", "quality",
  "outputs", "costEstimateSha256", "maximumApprovedUsd", "retryReserve",
  "decision", "reviewer", "decidedAt"
]);

export function validateHostCutsceneApproval({ approval, plan, estimate, hostEvent }) {
  assertExactKeys(approval, requiredApprovalFields);
  if (approval.kind !== "host-user-cutscene-generation-approval"
    || approval.capture.channel !== "host-user-input"
    || approval.capture.eventId !== hostEvent.eventId
    || approval.decision !== "approved") throw new Error("Explicit host-user generation approval is required.");
  if (canonicalCutsceneDocument(cutsceneApprovalBinding({ plan, estimate }))
    !== canonicalCutsceneDocument(bindingFromApproval(approval))) throw new Error("Cutscene approval binding is stale.");
  return Object.freeze(structuredClone(approval));
}
```

Reject specialist names, agent-generated channels, prose-only approval, duplicate asset IDs, mismatched stage and approval with a lower maximum than the estimate maximum. An official price snapshot must match provider and model, must not be future-dated and must be at most 24 hours old at approval and provider preflight; otherwise re-estimate and request approval again.

- [ ] **Step 5: Run cost, unknown-host-cost and reapproval GREEN**

Run: `node --test tests/unit/cutscene-generation-approval.test.mjs tests/unit/cutscene-visual-preproduction.test.mjs`

Expected: official pricing, host-unavailable pricing, three modes and every invalidating mutation pass.

- [ ] **Step 6: Commit Task 3**

```bash
git add shared/scripts/estimate-cutscene-image-cost.mjs shared/scripts/lib/cutscene-generation-approval.mjs tests/unit/cutscene-generation-approval.test.mjs tests/unit/cutscene-visual-preproduction.test.mjs
git commit -m "feat: gate cutscene generation by cost approval"
```

### Task 4: Approved stage generation and actual usage receipts

**Files:**
- Create: `shared/scripts/run-approved-cutscene-image-stage.mjs`
- Modify: `shared/scripts/run-image-asset-workflow.mjs`
- Modify: `shared/scripts/generate-openai-images.mjs`
- Modify: `tests/unit/cutscene-generation-approval.test.mjs`
- Modify: `tests/products/studio/image-assets.test.mjs`

**Interfaces:**
- Consumes: Task 3 approval, existing `generateImageAssetWorkflow`
- Produces: `runConfiguredSelectedImageAssetWorkflow(options): Promise<ImageWorkflowResult>`
- Produces: `runApprovedCutsceneImageStage(options): Promise<CutsceneStageResult>`
- Produces: normalized provider usage `{inputTokens,outputTokens,totalTokens,inputTextTokens,inputImageTokens}|null`
- Produces: artifact `cutscene/usage-receipts/<stage>-<attempt-id>.json`

- [ ] **Step 1: Add RED provider-call boundary tests**

```js
test("provider is unreachable before exact stage approval", async () => {
  let calls = 0;
  for (const approval of [undefined, forgedApproval(), stalePromptApproval(), overBudgetApproval()]) {
    await assert.rejects(() => runApprovedCutsceneImageStage({
      ...generationFixture(), approval,
      hostGenerate: async () => { calls += 1; return validHostResult(); },
    }), /approval|cost|binding/iu);
  }
  assert.equal(calls, 0);
});

test("masters approval cannot generate keyframes", async () => {
  let selected;
  await runApprovedCutsceneImageStage({
    ...approvedGenerationFixture({ stage: "masters" }),
    beforeProvider: ({ assetIds }) => { selected = assetIds; },
  });
  assert.deepEqual(selected, masterAssetIds);
});
```

- [ ] **Step 2: Run provider-boundary tests and verify RED**

Run: `node --test --test-name-pattern='provider is unreachable|cannot generate keyframes' tests/unit/cutscene-generation-approval.test.mjs`

Expected: FAIL because the wrapper does not exist.

- [ ] **Step 3: Add configured selected-generation entrypoint**

```js
export async function runConfiguredSelectedImageAssetWorkflow({ workspaceRoot, env, ...options } = {}) {
  const config = await loadImageConfig({ workspaceRoot, env });
  if (config.mode !== "select") throw new Error("Approved staged generation requires IMAGE_GEN_MODE=select.");
  const result = await generateImageAssetWorkflow({ ...options, config });
  return { ...result, config: toPublicImageConfig(config) };
}
```

This export does not plan or rewrite prompts. It accepts a validated current manifest and exact selected IDs only.

- [ ] **Step 4: Validate approval immediately before provider dispatch**

```js
export async function runApprovedCutsceneImageStage(options) {
  const current = await readCurrentCutscenePackage(options.artifactRoot);
  const estimate = validateCurrentEstimate(options.estimate, current);
  const approval = validateHostCutsceneApproval({ approval: options.approval, plan: current.plan, estimate, hostEvent: options.hostEvent });
  assertStagePrerequisites(current, approval.stage);
  assertCostWithinApproval(estimate, approval);
  const selectionReceipt = {
    kind: "host-user-image-selection", channel: "host-user-input",
    event_id: approval.capture.eventId, asset_ids: [...approval.assetIds],
  };
  return runConfiguredSelectedImageAssetWorkflow({ ...options, manifest: current.manifest, selectedAssetIds: approval.assetIds, selectionReceipt });
}
```

Re-read prompt package, references and hashes from safe artifact paths after approval validation and once more through the existing image workflow before any provider callback.

- [ ] **Step 5: Capture bounded OpenAI usage and compute actual cost**

Accept only these optional nonnegative integer fields from provider JSON:

```js
{
  inputTokens: usage.input_tokens,
  outputTokens: usage.output_tokens,
  totalTokens: usage.total_tokens,
  inputTextTokens: usage.input_tokens_details?.text_tokens,
  inputImageTokens: usage.input_tokens_details?.image_tokens
}
```

Unknown or oversized usage objects become `usage: null` and `actualCostStatus: "unavailable"`; they never fail a successfully validated image. Compute actual USD only when the provider reports every token category needed by the approved price snapshot; otherwise keep it unavailable. The usage receipt binds attempt ID, stage, asset IDs, approval SHA-256, provider request IDs, normalized usage and computed actual USD or a closed unavailable reason.

- [ ] **Step 6: Run generation and existing image regression GREEN**

Run: `node --test tests/unit/cutscene-generation-approval.test.mjs tests/products/studio/image-assets.test.mjs tests/unit/image-assets.test.mjs`

Expected: no-call boundaries, approved exact selection, host unknown-cost and OpenAI usage receipts pass without breaking existing selection/retry behavior.

- [ ] **Step 7: Commit Task 4**

```bash
git add shared/scripts/run-approved-cutscene-image-stage.mjs shared/scripts/run-image-asset-workflow.mjs shared/scripts/generate-openai-images.mjs tests/unit/cutscene-generation-approval.test.mjs tests/products/studio/image-assets.test.mjs
git commit -m "feat: run approved cutscene image stages"
```

### Task 5: Variant overlays, dependency invalidation and continuity QA

**Files:**
- Create: `shared/scripts/review-cutscene-continuity.mjs`
- Modify: `shared/scripts/plan-cutscene-visual-preproduction.mjs`
- Modify: `shared/scripts/run-approved-cutscene-image-stage.mjs`
- Modify: `tests/unit/cutscene-visual-preproduction.test.mjs`
- Modify: `tests/unit/cutscene-generation-approval.test.mjs`

**Interfaces:**
- Consumes: Task 2 DAG, Task 4 generation receipts
- Produces: `buildVariantOverlay({basePlan,triggerState,changes}): CutsceneVariant`
- Produces: `findCutsceneImpact({plan,changedAssetIds}): string[]`
- Produces: `reviewCutsceneContinuity({plan,manifest,observations}): ContinuityReview`
- Produces: `applyCutsceneContinuityDecision({plan,review,humanReceipt}): CutscenePlan`

- [ ] **Step 1: Add RED variant and partial-failure tests**

```js
test("dialogue-only variant reuses the base image", () => {
  const variant = buildVariantOverlay({
    basePlan: planFixture(), triggerState: "QUEST-COMPANION-ABSENT",
    changes: [{ shotId: "SHOT-04", kind: "dialogue", value: "혼자 가야 해." }],
  });
  assert.deepEqual(variant.generatedAssetIds, []);
});

test("master change invalidates descendants but preserves unrelated success", () => {
  const result = findCutsceneImpact({ plan: generatedPlanFixture(), changedAssetIds: ["cutscene-escape-masters-character-lyra"] });
  assert.deepEqual(result, ["cutscene-escape-keyframes-kf-02", "cutscene-escape-storyboard-shot-04"]);
  assert.equal(result.includes("cutscene-escape-storyboard-shot-01"), false);
});
```

- [ ] **Step 2: Run variant tests and verify RED**

Run: `node --test --test-name-pattern='dialogue-only|master change' tests/unit/cutscene-visual-preproduction.test.mjs`

Expected: FAIL because variant and impact functions are absent.

- [ ] **Step 3: Implement overlay and impact rules**

```js
const visualChangeKinds = new Set(["expression", "blocking", "character-state", "quest-state", "prop-state", "environment-state"]);

export function buildVariantOverlay({ basePlan, triggerState, changes }) {
  const affectedShotIds = changes.filter(({ kind }) => visualChangeKinds.has(kind)).map(({ shotId }) => shotId);
  return validateVariant({ triggerState, baseCutsceneId: basePlan.cutsceneId, changes, generatedAssetIds: assetIdsForShots(basePlan, affectedShotIds) });
}
```

Impact traversal follows DAG edges forward, preserves success bytes outside the closure and resets only affected stage state to `cost-estimated`.

- [ ] **Step 4: Implement continuity finding categories**

```js
const continuityCodes = Object.freeze([
  "character-identity-drift", "wardrobe-state-drift", "environment-layout-drift",
  "prop-position-drift", "lighting-direction-drift", "screen-direction-break",
  "eyeline-break", "subtitle-safe-area-obstruction", "beat-information-missing",
  "variant-preservation-mismatch"
]);
```

Every finding names `shotId`, optional `variantId`, evidence paths, severity, expected continuity, observed difference, source master IDs and affected asset IDs. The review never edits images or prompts.

- [ ] **Step 5: Test partial failure and approved review transition**

Run: `node --test tests/unit/cutscene-visual-preproduction.test.mjs tests/unit/cutscene-generation-approval.test.mjs`

Expected: dialogue-only reuse, visual variant generation, partial retry, impact invalidation, continuity failures and named-human `document-approved` transition pass.

- [ ] **Step 6: Commit Task 5**

```bash
git add shared/scripts/review-cutscene-continuity.mjs shared/scripts/plan-cutscene-visual-preproduction.mjs shared/scripts/run-approved-cutscene-image-stage.mjs tests/unit/cutscene-visual-preproduction.test.mjs tests/unit/cutscene-generation-approval.test.mjs
git commit -m "feat: review cutscene image continuity"
```

### Task 6: Studio skill, route and document profile

**Files:**
- Create: `products/game-design-studio/plugin/skills/design-cutscene-visual-preproduction/SKILL.md`
- Create: `products/game-design-studio/plugin/skills/design-cutscene-visual-preproduction/agents/openai.yaml`
- Create: `shared/document-quality/profiles/studio/cutscene-visual-preproduction.json`
- Modify: `shared/document-quality/indexes/studio.json`
- Modify: `products/game-design-studio/plugin/references/routing.json`
- Modify: `products/game-design-studio/plugin/skills/design-game-content/SKILL.md`
- Modify: `products/game-design-studio/plugin/skills/plan-image-assets/SKILL.md`
- Modify: `products/game-design-studio/plugin/skills/generate-image-assets/SKILL.md`
- Modify: `products/game-design-studio/plugin/skills/review-image-assets/SKILL.md`
- Create: `tests/products/studio/cutscene-visual-preproduction.test.mjs`

**Interfaces:**
- Consumes: Tasks 1–5 public runtime
- Produces: Studio skill `design-cutscene-visual-preproduction`
- Produces: route `cutscene-visual-preproduction`
- Produces: output types `cutscene-brief`, `cutscene-shot-package`, `cutscene-prompt-package`, `cutscene-cost-estimate`, `cutscene-continuity-review`

- [ ] **Step 1: Add RED Studio route and boundary tests**

```js
test("Studio exposes cutscene preproduction before image planning", async () => {
  const routing = await readRouting();
  const route = routing.routes.find(({ id }) => id === "cutscene-visual-preproduction");
  assert.equal(route.skill, "design-cutscene-visual-preproduction");
  assert.deepEqual(route.downstreamSkills,
    ["plan-image-assets", "generate-image-assets", "review-image-assets"]);
  assert.equal(route.generationApproval, "stage-by-stage-host-user");
});
```

- [ ] **Step 2: Run product test and verify RED**

Run: `node --test tests/products/studio/cutscene-visual-preproduction.test.mjs`

Expected: FAIL because the skill and route are absent.

- [ ] **Step 3: Author the skill workflow and completion contract**

The skill must present these three choices before any generation action:

```text
1. Prompt Only — 이미지 호출 없이 전체 프롬프트와 순차 생성 가이드 제공
2. Estimate Only — 이미지 호출 없이 단계별 비용과 최대 한도 제공
3. Generate After Approval — 마스터, 키프레임, 스토리보드를 각각 견적·승인 후 생성
```

The skill must explicitly say no image generation call occurs while `approval-pending`; it may prepare prompts in that state.

- [ ] **Step 4: Add the Studio route and profile**

```json
{
  "id": "cutscene-visual-preproduction",
  "triggerIntents": ["컷씬 기획", "스토리보드", "시네마틱 이미지", "마스터 이미지", "컷씬 프롬프트"],
  "skill": "design-cutscene-visual-preproduction",
  "downstreamSkills": ["plan-image-assets", "generate-image-assets", "review-image-assets"],
  "generationApproval": "stage-by-stage-host-user"
}
```

Add the skill to `skillIds` and `plannedPaths.skills`; assign `content-narrative-designer` and `art-brief-director` as review owners without approval authority. The profile requires a beat table, shot table, continuity table, master dependency diagram, cost/approval section and production handoff.

- [ ] **Step 5: Update adjacent skill handoffs**

- `design-game-content`: route cutscene visual requests after narrative purpose and game-state return are defined.
- `plan-image-assets`: accept the cutscene prompt manifest and preserve stable IDs/DAG order.
- `generate-image-assets`: accept only exact stage IDs with current cutscene approval.
- `review-image-assets`: run visual QA plus cutscene continuity QA; neither self-approves.

- [ ] **Step 6: Run product and profile GREEN**

Run: `node --test tests/products/studio/cutscene-visual-preproduction.test.mjs tests/products/studio/image-assets.test.mjs tests/products/studio/core-design-skills.test.mjs`

Expected: new route and all existing image/content routes pass.

- [ ] **Step 7: Commit Task 6**

```bash
git add products/game-design-studio/plugin/skills/design-cutscene-visual-preproduction products/game-design-studio/plugin/skills/design-game-content/SKILL.md products/game-design-studio/plugin/skills/plan-image-assets/SKILL.md products/game-design-studio/plugin/skills/generate-image-assets/SKILL.md products/game-design-studio/plugin/skills/review-image-assets/SKILL.md products/game-design-studio/plugin/references/routing.json shared/document-quality/indexes/studio.json shared/document-quality/profiles/studio/cutscene-visual-preproduction.json tests/products/studio/cutscene-visual-preproduction.test.mjs
git commit -m "feat: add Studio cutscene preproduction skill"
```

### Task 7: User guide, package lifecycle and inventory parity

**Files:**
- Create: `guides/game-design-studio/cutscene-visual-preproduction.md`
- Modify: `guides/game-design-studio/README.md`
- Modify: `README.md`
- Modify: `tooling/isolation-smoke.mjs`
- Modify: `tooling/lib/user-guides.mjs`
- Modify: `tests/unit/user-guides.test.mjs`
- Modify: `tests/contracts/shared-contract.test.mjs`
- Modify: `tests/e2e/suite/memory-install-lifecycle.e2e.test.mjs`
- Modify: `tests/unit/build-product.test.mjs`

**Interfaces:**
- Consumes: Task 6 Studio skill and common image contracts
- Produces: copyable prompt-only and approved-generation guides
- Produces: installed Studio package containing the skill and five cutscene schemas

- [ ] **Step 1: Add RED guide and package tests**

```js
test("cutscene guide explains prompt-only and stage approvals", async () => {
  const guide = await readFile("guides/game-design-studio/cutscene-visual-preproduction.md", "utf8");
  for (const phrase of ["Prompt Only", "Estimate Only", "Generate After Approval", "스타일 마스터", "키프레임", "스토리보드", "generation-guide.md", "비용 확인 불가"]) assert.match(guide, new RegExp(phrase, "u"));
});

test("Studio package includes cutscene skill and public schemas", async () => {
  const build = await buildStudioFixture();
  assert.equal(build.files.includes("skills/design-cutscene-visual-preproduction/SKILL.md"), true);
  assert.equal(build.files.includes("references/shared/image-assets/schema/cutscene-generation-approval.schema.json"), true);
});
```

- [ ] **Step 2: Run guide/package tests and verify RED**

Run: `node --test tests/unit/user-guides.test.mjs tests/unit/build-product.test.mjs tests/contracts/shared-contract.test.mjs`

Expected: FAIL because guide discovery, skill inventory and package expectations are missing.

- [ ] **Step 3: Write the sequential user guide**

Provide exact copyable request blocks for:

```text
컷씬 brief와 beat만 작성
shot list와 continuity bible 작성
마스터 프롬프트 패키지만 작성
마스터 단계 비용만 계산
승인한 마스터 asset ID만 생성
선택한 마스터로 keyframe 프롬프트 재계산
keyframe 비용 승인 후 생성
연결 shot과 variant 비용 승인 후 생성
continuity contact sheet 검토
실패한 asset ID만 재시도
```

Every generation example first asks for asset count, quality, size, estimated USD range, maximum cap and approval receipt. State that host cost may be unavailable and direct socket/network use is provider-dependent.

- [ ] **Step 4: Replace fixed counts with routing-derived inventory where touched**

The Studio installed skill set must equal `routing.skillIds` exactly, be NFC-normalized and unique. Do not assert a numeric count that depends on whether the independently approved Reference Intelligence plan has already landed. Career inventory must remain unchanged by this plan.

- [ ] **Step 5: Run lifecycle and guide GREEN**

Run: `node --test tests/unit/user-guides.test.mjs tests/unit/build-product.test.mjs tests/contracts/shared-contract.test.mjs tests/e2e/suite/memory-install-lifecycle.e2e.test.mjs`

Run: `node tooling/isolation-smoke.mjs`

Expected: fresh build install/replace/remove preserves project memory, `.git/info/exclude`, sibling bytes and contains exact Studio routing skills.

- [ ] **Step 6: Commit Task 7**

```bash
git add guides/game-design-studio/cutscene-visual-preproduction.md guides/game-design-studio/README.md README.md tooling/isolation-smoke.mjs tooling/lib/user-guides.mjs tests/unit/user-guides.test.mjs tests/contracts/shared-contract.test.mjs tests/e2e/suite/memory-install-lifecycle.e2e.test.mjs tests/unit/build-product.test.mjs
git commit -m "docs: guide approved cutscene image generation"
```

### Task 8: End-to-end and hostile mutation verification

**Files:**
- Create: `tests/e2e/suite/cutscene-visual-preproduction.e2e.test.mjs`
- Create: `tests/fixtures/cutscene/cutscene-mutation-harness.mjs`
- Create: `tests/unit/cutscene-mutation-harness.test.mjs`
- Create: `.superpowers/sdd/2026-08-13-cutscene-visual-preproduction/task-report.md`
- Generated by build only: `plugins/game-design-studio/**`

**Interfaces:**
- Consumes: public cutscene and image APIs only
- Produces: executable proof for no-call, approval, cost, DAG, variants, retries and package parity

- [ ] **Step 1: Write direct public-API E2E scenarios**

```js
const scenarios = [
  "prompt-only writes the full package with zero provider calls and zero image API cost",
  "estimate-only writes current official pricing evidence with zero provider calls",
  "host unknown pricing is never labeled free",
  "masters require their own host-user approval before generation",
  "keyframes cannot use unapproved or stale masters",
  "storyboard approval cannot expand to unapproved variant asset IDs",
  "prompt or reference hash change requires reapproval",
  "maximum cost breach stops before provider dispatch",
  "partial failure preserves successful images and retries only failed IDs",
  "dialogue-only variant creates no duplicate image",
  "visual variant regenerates only affected shots",
  "continuity review catches character, prop, light and screen-direction drift",
  "generated assets remain concept-draft until named-human review",
  "generation guide order matches the topological generation DAG",
];
```

Use temporary artifact roots, a bounded fake host provider and a fake OpenAI `fetchFn`; no live paid call belongs in automated tests.

- [ ] **Step 2: Run E2E and fix production defects**

Run: `node --test tests/e2e/suite/cutscene-visual-preproduction.e2e.test.mjs`

Expected: exactly 14 tests pass, no skip, provider call counters match each scenario.

- [ ] **Step 3: Add assertion-bound mutation evidence**

Mutate one production guard at a time:

```text
approval-channel: accept agent-generated approval
approval-binding: ignore prompt package SHA-256
reference-binding: ignore master SHA-256
stage-selection: allow extra asset ID
cost-cap: dispatch above maximumApprovedUsd
mode-boundary: generate in prompt-only
variant-overlay: duplicate every base shot
partial-retry: overwrite successful asset
continuity-gate: ignore screen-direction drift
```

Use exact assertion evidence on a dedicated FD, bounded output, timeout, environment allowlist and process-tree cleanup. Forged stdout/stderr, duplicate/partial/oversize evidence and inside-wrapper unrelated errors must fail closed.

- [ ] **Step 4: Run mutation and functional suites**

Run: `node --test tests/unit/cutscene-mutation-harness.test.mjs`

Run: `node --test tests/unit/cutscene-visual-preproduction.test.mjs tests/unit/cutscene-generation-approval.test.mjs tests/products/studio/cutscene-visual-preproduction.test.mjs tests/e2e/suite/cutscene-visual-preproduction.e2e.test.mjs`

Expected: all nine mutations are detected and all functional tests pass.

- [ ] **Step 5: Build Studio snapshot and validate installed runtime**

Run: `npm run build`

Run: `npm run build -- --check`

Run: `node tooling/validate-packages.mjs plugins/game-design-studio plugins/game-design-career`

Expected: Studio contains the new skill, schemas, policy and runtime; Career keeps common image runtime compatibility without exposing the Studio-only skill.

- [ ] **Step 6: Run final gates**

Run: `node --check shared/scripts/validate-cutscene-visual-preproduction.mjs shared/scripts/plan-cutscene-visual-preproduction.mjs shared/scripts/estimate-cutscene-image-cost.mjs shared/scripts/lib/cutscene-generation-approval.mjs shared/scripts/run-approved-cutscene-image-stage.mjs shared/scripts/review-cutscene-continuity.mjs shared/scripts/run-image-asset-workflow.mjs shared/scripts/generate-openai-images.mjs`

Run: `node --test tests/unit/image-assets.test.mjs tests/products/studio/image-assets.test.mjs tests/products/career/image-assets.test.mjs`

Run: `npm run test:unit`

Run: `npm run test:contracts`

Run: `npm run test:products`

Run: `git diff --check`

Expected: zero failures; no live image generation, credentials, local events or generated project images enter the committed package snapshot.

- [ ] **Step 7: Commit Task 8**

Record provider call counts, pricing evidence, usage availability, test counts, build hashes and remaining gaps in the task report before staging:

```bash
git add tests/e2e/suite/cutscene-visual-preproduction.e2e.test.mjs tests/fixtures/cutscene/cutscene-mutation-harness.mjs tests/unit/cutscene-mutation-harness.test.mjs plugins/game-design-studio plugins/game-design-career
git add -f .superpowers/sdd/2026-08-13-cutscene-visual-preproduction/task-report.md
git commit -m "test: verify cutscene visual lifecycle"
```

## Final Review Checklist

- Every spec section maps to one of Tasks 1–8.
- Prompt Only and Estimate Only have executable zero-call proofs.
- Every provider call is preceded by current plan, prompt, reference, price, cap and host-user approval checks.
- Approval is stage-specific and cannot select asset IDs from a later stage.
- Price fixtures are tests only; runtime prices come from timestamped official snapshots.
- Unknown host cost remains unknown and still requires explicit approval.
- Successful assets survive partial failure and are not regenerated by retry.
- Variant overlays preserve base shots and regenerate only visual differences.
- Continuity review remains separate from image generation and named-human document approval.
- Studio package contains the new skill; Career does not gain a Studio-only route.
- Final report records provider call counts, estimate assumptions, actual usage availability, tests, build hashes and remaining external gaps.
