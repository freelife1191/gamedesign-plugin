# Cutscene Visual Preproduction Implementation Plan

> **For agentic workers:** Execute Tasks 1–8 in order with TDD and a review gate after each commit.

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

**Interfaces:** `validateCutsceneVisualPlan`, `validateCutsceneCostEstimate`, `validateCutsceneGenerationApproval`, `validateCutsceneGenerationUsage`, `validateCutsceneContinuityReview` return `{ok,errors:[{code,path}]}`; `canonicalCutsceneDocument`, `cutsceneDocumentSha256`, `deriveCutsceneLifecycle` are exported.

- [ ] **RED — write closed-shape test.**

```js
test("four waves own authority and root state is derived", () => {
  const plan = validCutscenePlan();
  assert.deepEqual(plan.cutsceneWorkflow.waves.map(({ id }) => id), ["style-master", "reference-masters", "keyframes", "storyboard"]);
  plan.state = "generation-approved";
  assert.deepEqual(validateCutsceneVisualPlan(plan).errors[0], { code: "cutscene.root_state_forbidden", path: "/state" });
});
```

- [ ] **Run RED.** `node --test tests/unit/cutscene-visual-preproduction.test.mjs` → FAIL: contracts absent.
- [ ] **GREEN — implement.** `cutsceneWorkflow` has exactly `schemaVersion,waves,downstream,derived`; each wave has exactly `id,assetIds,estimate,approval,attempts,completion,invalidation`. Require nonempty collections before `every`, sorted unique IDs, valid DAG references and four-wave order. Template-ready has expected path/no hash; generation-ready has current ID+SHA-256. Root lifecycle enum is derived only.
- [ ] **Run GREEN.** `node --test tests/unit/cutscene-visual-preproduction.test.mjs && node -e 'for (const p of process.argv.slice(1)) JSON.parse(require("node:fs").readFileSync(p,"utf8"))' shared/image-assets/schema/cutscene-*.schema.json` → PASS.
- [ ] **Commit.** `git add shared/image-assets/schema/cutscene-*.schema.json shared/scripts/validate-cutscene-visual-preproduction.mjs tests/unit/cutscene-visual-preproduction.test.mjs && git commit -m "feat: define cutscene wave contracts"`

### Task 2: Sole-writer manifest, template/bound prompts, and invalidation

**Depends on:** Task 1; Tasks 1–5 are serial.

**Files:** Create `shared/image-assets/references/cutscene-generation-policy.md`, `shared/image-assets/templates/cutscene/{cutscene-brief.md,beat-sheet.yml,shot-list.yml,continuity-bible.yml,master-reference-plan.yml,generation-guide.md}`, `shared/scripts/plan-cutscene-visual-preproduction.mjs`; modify image-assets schema/prompt-pattern/validator and `tests/unit/{cutscene-visual-preproduction,image-assets}.test.mjs`.

**Interfaces:** `planCutsceneVisualPreproduction(input):{plan,manifest,templatePromptPackage}`; `bindCutscenePromptPackage({artifactRoot,plan,manifest}):Promise<GenerationReadyPromptPackage>`; `writeCutscenePromptPackage`; `validateCutsceneManifestHandoff({manifest}):manifest`; `findCutsceneImpact`; `invalidateCutsceneDependents`.

- [ ] **RED — write template and handoff tests.**

```js
test("prompt-only has expected references but no invented hashes", () => {
  const { templatePromptPackage } = planCutsceneVisualPreproduction(input({ mode: "prompt-only" }));
  assert.equal(templatePromptPackage.kind, "template-ready");
  assert.equal(templatePromptPackage.references.length > 0 && templatePromptPackage.references.every((x) => x.expectedPath && x.sha256 === undefined), true);
});
test("plan-image-assets validates cutscene handoff without mutation", () => {
  const manifest = fixtureManifest();
  assert.deepEqual(validateCutsceneManifestHandoff({ manifest }), manifest);
});
```

- [ ] **Run RED.** `node --test --test-name-pattern='prompt-only|handoff' tests/unit/cutscene-visual-preproduction.test.mjs tests/unit/image-assets.test.mjs` → FAIL: planner absent.
- [ ] **GREEN — implement.** The planner writes `assets/image-assets.yml` once with stable IDs, DAG, prompt digest, `concept-draft`, and a separate `cutsceneWorkflow`. `plan-image-assets` validates/returns handed-off bytes and never replans IDs, DAG, hashes, or bindings; general planning is unchanged. Binding reads master bytes via secure loader. `findCutsceneImpact` is the only forward-DAG traversal; invalidation calls it and preserves unrelated bytes/state/receipt.
- [ ] **Run GREEN.** `node --test tests/unit/cutscene-visual-preproduction.test.mjs tests/unit/image-assets.test.mjs` → PASS.
- [ ] **Commit.** `git add shared/image-assets/references/cutscene-generation-policy.md shared/image-assets/templates/cutscene shared/scripts/plan-cutscene-visual-preproduction.mjs shared/image-assets/schema/image-assets.schema.json shared/image-assets/prompt-patterns/storyboard.json shared/scripts/validate-image-assets.mjs tests/unit/cutscene-visual-preproduction.test.mjs tests/unit/image-assets.test.mjs && git commit -m "feat: plan bound cutscene prompts"`

### Task 3: Price snapshot and opaque live host-user approval

**Depends on:** Task 2.

**Files:** Create `shared/scripts/estimate-cutscene-image-cost.mjs`, `shared/scripts/lib/cutscene-generation-capabilities.mjs`, `shared/scripts/lib/cutscene-generation-approval.mjs`, `tests/unit/cutscene-generation-approval.test.mjs`; modify `tests/unit/cutscene-visual-preproduction.test.mjs`.

**Interfaces:** `estimateCutsceneImageCost({plan,waveId,pricingSnapshot,retryReserve})`; `calculateActualCost(pricing,usage)`; `issueCutsceneHumanApproval(input):{receipt,capability}`; `assertCutsceneHumanApproval(receipt,capability,context)`; `cutsceneApprovalBinding`; `validateHostCutsceneApproval`; `requiresCutsceneReapproval`.

- [ ] **RED — authority/cost tests.**

```js
test("copied capability and role-like reviewer fail closed", () => {
  const issued = issueCutsceneHumanApproval(approvalInput());
  assert.throws(() => assertCutsceneHumanApproval(structuredClone(issued.receipt), issued.capability, context()), { code: "cutscene.approval_capability_invalid" });
  assert.throws(() => issueCutsceneHumanApproval({ ...approvalInput(), reviewer: "image agent" }), { code: "cutscene.reviewer_role_like" });
});
test("missing cached token detail leaves actual USD unavailable", () => assert.deepEqual(calculateActualCost(pricing(), { inputTokens: 8, outputTokens: 4, inputTextTokens: 3, inputImageTokens: 5 }), { status: "unavailable", reason: "cached-token-breakdown-unavailable" }));
```

- [ ] **Run RED.** `node --test tests/unit/cutscene-generation-approval.test.mjs` → FAIL: modules absent.
- [ ] **GREEN — implement.** Accept only current (<24h, nonfuture) official OpenAI host snapshot with five categories. Test fixtures alone have rates. Validate integer identities. Issue WeakMap-backed opaque capability after closed, non-Proxy, nonblank named-human receipt validation. Reject copied/proxied/stale capability, blank/agent/specialist reviewer, event actor mismatch, prose-only decision, duplicate IDs, stale exact binding.
- [ ] **Run GREEN.** `node --test tests/unit/cutscene-generation-approval.test.mjs tests/unit/cutscene-visual-preproduction.test.mjs` → PASS.
- [ ] **Commit.** `git add shared/scripts/estimate-cutscene-image-cost.mjs shared/scripts/lib/cutscene-generation-capabilities.mjs shared/scripts/lib/cutscene-generation-approval.mjs tests/unit/cutscene-generation-approval.test.mjs tests/unit/cutscene-visual-preproduction.test.mjs && git commit -m "feat: bind cutscene waves to live approval"`

### Task 4: Per-attempt dispatch and usage receipts

**Depends on:** Task 3.

**Files:** Create `shared/scripts/run-approved-cutscene-image-stage.mjs`; modify `shared/scripts/{run-image-asset-workflow,generate-openai-images}.mjs`, `tests/unit/cutscene-generation-approval.test.mjs`, `tests/unit/generate-openai-images.test.mjs`, `tests/products/studio/image-assets.test.mjs`.

**Interfaces:** `runConfiguredSelectedImageAssetWorkflow({workspaceRoot,env,manifest,selectedAssetIds,...options})`; `runApprovedCutsceneImageWave({artifactRoot,waveId,receipt,capability,env,fetchFn,hostGenerate})`; one `cutscene/usage-receipts/<waveId>-<attemptId>.json` per provider request/asset.

- [ ] **RED — no-call/retry tests.**

```js
test("each retry checks reserve and cap before dispatch", async () => {
  const calls = [];
  await assert.rejects(() => runApprovedCutsceneImageWave({ ...fixture(), env: {}, fetchFn: failingFetch, hostGenerate: () => calls.push("called"), retryOrdinal: 2, retryReserveRemaining: 0 }), { code: "cutscene.retry_reserve_exhausted" });
  assert.deepEqual(calls, []);
});
test("process key cannot bypass injected default network", async () => assert.rejects(() => generateOpenAIImages({ ...openAiFixture(), env: {}, fetchFn: failingFetch })));
```

- [ ] **Run RED.** `node --test tests/unit/cutscene-generation-approval.test.mjs tests/unit/generate-openai-images.test.mjs` → FAIL: wrapper absent.
- [ ] **GREEN — implement.** Before each host/OpenAI attempt reread bound package/master bytes and validate current wave IDs, ordinal, reserve, accumulated and maximum possible USD, current price, binding and capability. A rejection calls neither fetch nor host callback. The selected workflow never replans/re-writes. Preserve generation/edit endpoints, ordered repeated `image[]`, no `input_fidelity`, contract size validation, transparent rejection, and configurable `gpt-image-2`. Normalized usage is per request/asset; incomplete categories produce closed unavailable actual cost.
- [ ] **Run GREEN.** `node --test tests/unit/cutscene-generation-approval.test.mjs tests/unit/generate-openai-images.test.mjs tests/products/studio/image-assets.test.mjs tests/unit/image-assets.test.mjs` → PASS.
- [ ] **Commit.** `git add shared/scripts/run-approved-cutscene-image-stage.mjs shared/scripts/run-image-asset-workflow.mjs shared/scripts/generate-openai-images.mjs tests/unit/cutscene-generation-approval.test.mjs tests/unit/generate-openai-images.test.mjs tests/products/studio/image-assets.test.mjs && git commit -m "feat: dispatch approved cutscene attempts"`

### Task 5: Overlay, shared invalidation, continuity and derived lifecycle

**Depends on:** Task 4. Task 6 begins after this public runtime freeze.

**Files:** Create `shared/scripts/review-cutscene-continuity.mjs`; modify `shared/scripts/{plan-cutscene-visual-preproduction,run-approved-cutscene-image-stage}.mjs` and `tests/unit/{cutscene-visual-preproduction,cutscene-generation-approval}.test.mjs`.

**Interfaces:** import Task 2 `findCutsceneImpact`/`invalidateCutsceneDependents`; produce `buildVariantOverlay`, `reviewCutsceneContinuity`, `deriveCutsceneLifecycle`.

- [ ] **RED — preservation/derived tests.**

```js
test("dialogue overlay preserves base bytes and creates no image", () => {
  const base = generatedFixture();
  assert.deepEqual(buildVariantOverlay({ basePlan: base.plan, triggerState: "QUEST-COMPANION-ABSENT", changes: [{ shotId: "SHOT-04", kind: "dialogue", value: "혼자 가야 해." }] }).generatedAssetIds, []);
  assert.deepEqual(base.successfulAssetBytes, generatedFixture().successfulAssetBytes);
});
test("blockers prevent derived document approval", () => assert.equal(deriveCutsceneLifecycle(fixture({ blockers: ["screen-direction"] })).documentApproved, false));
```

- [ ] **Run RED.** `node --test --test-name-pattern='dialogue|derived' tests/unit/cutscene-visual-preproduction.test.mjs tests/unit/cutscene-generation-approval.test.mjs` → FAIL: APIs absent.
- [ ] **GREEN — implement.** Dialogue-only has no derivative; visual changes regenerate only affected shots. Do not duplicate Task 2 DAG API. Findings have literal code/path, source masters, affected IDs and preserve overlays. Derive document/production only from existing asset lifecycle, current receipt and no blocker; review never edits images/prompts/approval.
- [ ] **Run GREEN.** `node --test tests/unit/cutscene-visual-preproduction.test.mjs tests/unit/cutscene-generation-approval.test.mjs` → PASS.
- [ ] **Commit.** `git add shared/scripts/review-cutscene-continuity.mjs shared/scripts/plan-cutscene-visual-preproduction.mjs shared/scripts/run-approved-cutscene-image-stage.mjs tests/unit/cutscene-visual-preproduction.test.mjs tests/unit/cutscene-generation-approval.test.mjs && git commit -m "feat: derive cutscene continuity lifecycle"`

### Task 6: Studio skill, exact route and common runtime parity

**Depends on:** Task 5 public runtime freeze. Task 7 begins after routing/inventory freeze.

**Files:** Create `products/game-design-studio/plugin/skills/design-cutscene-visual-preproduction/{SKILL.md,agents/openai.yaml}`, `shared/document-quality/profiles/studio/cutscene-visual-preproduction.json`, `tests/products/studio/cutscene-visual-preproduction.test.mjs`; modify `products/game-design-studio/plugin/{references/routing.json,README.md,skills/design-game-content/SKILL.md,skills/plan-image-assets/SKILL.md,skills/generate-image-assets/SKILL.md,skills/review-image-assets/SKILL.md}`, `shared/document-quality/indexes/studio.json`, `tests/products/{studio/image-assets.test.mjs,career/image-assets.test.mjs}`.

**Interfaces:** Studio-only `design-cutscene-visual-preproduction`; closed top-level `cutsceneWorkflow`; Career common schema/runtime parity with no Studio skill/route.

- [ ] **RED — route exactness.**

```js
test("route shape stays exact and workflow metadata stays separate", async () => {
  const routing = await readRouting();
  const route = routing.routes.find(({ id }) => id === "cutscene-visual-preproduction");
  assert.deepEqual(Object.keys(route), canonicalRouteKeys);
  assert.deepEqual(Object.keys(routing.cutsceneWorkflow), ["schemaVersion", "waves", "downstream", "approval"]);
  assert.equal(readCareerRouting().skillIds.includes("design-cutscene-visual-preproduction"), false);
});
```

- [ ] **Run RED.** `node --test tests/products/studio/cutscene-visual-preproduction.test.mjs tests/products/studio/image-assets.test.mjs tests/products/career/image-assets.test.mjs` → FAIL: route absent.
- [ ] **GREEN — integrate.** Add Studio skill to `skillIds`/`plannedPaths.skills`; offer three modes/four waves and state `approval-pending` has zero calls. `plan-image-assets` only validates handoff. Existing route canonical keys remain unchanged; `cutsceneWorkflow` owns extra metadata. Update skill guide/index/installation/use-case/product contracts. Career packages common scripts/schemas only.
- [ ] **Run GREEN.** `node --test tests/products/studio/cutscene-visual-preproduction.test.mjs tests/products/studio/image-assets.test.mjs tests/products/studio/core-design-skills.test.mjs tests/products/career/image-assets.test.mjs` → PASS.
- [ ] **Commit.** `git add products/game-design-studio/plugin/skills/design-cutscene-visual-preproduction products/game-design-studio/plugin/skills/design-game-content/SKILL.md products/game-design-studio/plugin/skills/plan-image-assets/SKILL.md products/game-design-studio/plugin/skills/generate-image-assets/SKILL.md products/game-design-studio/plugin/skills/review-image-assets/SKILL.md products/game-design-studio/plugin/references/routing.json products/game-design-studio/plugin/README.md shared/document-quality/indexes/studio.json shared/document-quality/profiles/studio/cutscene-visual-preproduction.json tests/products/studio/cutscene-visual-preproduction.test.mjs tests/products/studio/image-assets.test.mjs tests/products/career/image-assets.test.mjs && git commit -m "feat: add Studio cutscene workflow"`

### Task 7: Guides, package contents and frozen inventory

**Depends on:** Task 6 routing/inventory freeze.

**Files:** Create `guides/game-design-studio/cutscene-visual-preproduction.md`; modify `guides/game-design-studio/{README.md,memory.md}`, `README.md`, `products/{game-design-studio/plugin/README.md,game-design-career/plugin/README.md}`, `tooling/{isolation-smoke.mjs,lib/user-guides.mjs}`, `tests/{unit/user-guides.test.mjs,unit/build-product.test.mjs,contracts/shared-contract.test.mjs,e2e/suite/memory-install-lifecycle.e2e.test.mjs}`.

**Interfaces:** parsed guide headings/order/request blocks; literal inventory `{studio:{routing:23,installed:24,topLevelScripts:30},career:{routing:22,installed:23,topLevelScripts:30}}`.

- [ ] **RED — guide and inventory tests.**

```js
test("guide headings and request blocks are ordered", async () => {
  const guide = await parseGuide("guides/game-design-studio/cutscene-visual-preproduction.md");
  assert.deepEqual(guide.headings.slice(0, 4), ["컷씬 비주얼 프리프로덕션", "Prompt Only", "Estimate Only", "Generate After Approval"]);
  assert.deepEqual(guide.requestBlocks.map(({ request }) => request), expectedCutsceneRequests);
});
test("inventory has five new scripts without Studio leakage", async () => assert.deepEqual(await inventories(), { studio: { routing: 23, installed: 24, topLevelScripts: 30 }, career: { routing: 22, installed: 23, topLevelScripts: 30 } }));
```

- [ ] **Run RED.** `node --test tests/unit/user-guides.test.mjs tests/unit/build-product.test.mjs tests/contracts/shared-contract.test.mjs tests/e2e/suite/memory-install-lifecycle.e2e.test.mjs` → FAIL: guide/inventory absent.
- [ ] **GREEN — publish.** Use ordered copyable blocks: brief+beats, shot+continuity, master template, style estimate/approval, style generation, bind reference masters, reference estimate/approval, keyframe estimate/approval, storyboard/variant estimate/approval, continuity review plus failed-ID retry. Every generation block requires count/quality/size/USD range/cap/live receipt and says host cost can be unavailable. Update package contents, installation, root, memory guide/source inventory, and isolation tests.
- [ ] **Run GREEN.** `node --test tests/unit/user-guides.test.mjs tests/unit/build-product.test.mjs tests/contracts/shared-contract.test.mjs tests/e2e/suite/memory-install-lifecycle.e2e.test.mjs && node tooling/isolation-smoke.mjs` → PASS.
- [ ] **Commit.** `git add guides/game-design-studio/cutscene-visual-preproduction.md guides/game-design-studio/README.md guides/game-design-studio/memory.md README.md products/game-design-studio/plugin/README.md products/game-design-career/plugin/README.md tooling/isolation-smoke.mjs tooling/lib/user-guides.mjs tests/unit/user-guides.test.mjs tests/unit/build-product.test.mjs tests/contracts/shared-contract.test.mjs tests/e2e/suite/memory-install-lifecycle.e2e.test.mjs && git commit -m "docs: publish cutscene workflow guides"`

### Task 8: Fifteen E2E scenarios and eleven hostile mutations

**Depends on:** Tasks 1–7.

**Files:** Create `tests/e2e/suite/cutscene-visual-preproduction.e2e.test.mjs`, `tests/fixtures/cutscene/cutscene-mutation-harness.mjs`, `tests/unit/cutscene-mutation-harness.test.mjs`, `.superpowers/sdd/2026-08-13-cutscene-visual-preproduction/task-report.md`; build generates `plugins/game-design-studio/**` and `plugins/game-design-career/**` only.

**Interfaces:** public APIs only; `env:{}`, failing default network, fake `fetchFn` and fake host callback; 15 scenarios and 11 named mutations.

- [ ] **RED — declare 15 scenarios.** `prompt-only no bytes/calls/hashes`; `estimate-only no calls`; `host unavailable not free`; `style approval`; `reference bound style`; `keyframe stale master`; `storyboard ID expansion`; `prompt/reference/price reapproval`; `reserve/cap no dispatch`; `partial retry preservation`; `dialogue overlay`; `visual overlay`; `continuity drift`; `derived lifecycle`; `usage receipt actual-cost-unavailable`.
- [ ] **Run RED.** `node --test tests/e2e/suite/cutscene-visual-preproduction.e2e.test.mjs` → FAIL: suite absent.
- [ ] **GREEN — mutate exactly:** `approval-authority`, `approval-binding`, `reference-binding`, `stage-selection`, `cost-cap`, `retry-reserve`, `mode-boundary`, `usage-completeness`, `variant-overlay`, `partial-retry`, `continuity-gate`. Assert literal IDs/hashes/error code/path, nonempty collections before `every`, dedicated FD, bounded output, timeout, env allowlist and process-tree cleanup.
- [ ] **Run GREEN.** `node --test tests/unit/cutscene-mutation-harness.test.mjs tests/unit/cutscene-visual-preproduction.test.mjs tests/unit/cutscene-generation-approval.test.mjs tests/unit/generate-openai-images.test.mjs tests/products/studio/cutscene-visual-preproduction.test.mjs tests/e2e/suite/cutscene-visual-preproduction.e2e.test.mjs` → 15 scenarios/11 mutations PASS with zero paid calls.
- [ ] **Final gates.** `npm run build && npm run build -- --check && node tooling/validate-packages.mjs plugins/game-design-studio plugins/game-design-career && npm run test:unit && npm run test:contracts && npm run test:products && git diff --check` → PASS; Career has common runtime/schema but no Studio route/skill.
- [ ] **Commit.** `git add tests/e2e/suite/cutscene-visual-preproduction.e2e.test.mjs tests/fixtures/cutscene/cutscene-mutation-harness.mjs tests/unit/cutscene-mutation-harness.test.mjs plugins/game-design-studio plugins/game-design-career && git add -f .superpowers/sdd/2026-08-13-cutscene-visual-preproduction/task-report.md && git commit -m "test: prove cutscene visual lifecycle"`

## Final Review Checklist

- [ ] Tasks 1–5 serial; Task 6 after runtime freeze; Task 7 after routing/inventory freeze; Task 8 proves whole lifecycle.
- [ ] One manifest writer, four authoritative waves, derived root state, template/bound prompt split, no live paid test calls.
- [ ] Exact routes, counts, guide ordering, 15 E2E scenarios and 11 mutations are literal test contracts.
