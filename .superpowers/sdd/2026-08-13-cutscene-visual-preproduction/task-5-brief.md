### Task 5: Overlay, shared invalidation, continuity and derived lifecycle

**Depends on:** Task 4. Task 6 begins after this public runtime freeze.

**Files:** Create `shared/scripts/review-cutscene-continuity.mjs`; modify `shared/scripts/{plan-cutscene-visual-preproduction,validate-cutscene-visual-preproduction}.mjs`, `shared/image-assets/schema/cutscene-continuity-review.schema.json`, and `tests/unit/cutscene-visual-preproduction.test.mjs`.

**Interfaces:** consume Task 1 `deriveCutsceneLifecycle` and Task 2 `findCutsceneImpact`/`invalidateCutsceneDependents`; produce pure `buildVariantOverlay({basePlan,triggerState,changes}):CutsceneVariant`, read-only `reviewCutsceneContinuity({plan,manifest,observations,reviewedAt}):ContinuityReview`, and `assertCutsceneContinuityGate({plan,manifest,waves,continuityReceipt}):void`.

- [ ] **RED — preservation/derived tests.**

```js
const generatedFixture = () => planCutsceneVisualPreproduction({ cutsceneId: "cutscene-escape", mode: "generate-after-approval", beats: [{ beatId: "BEAT-01" }], shots: [{ shotId: "SHOT-01", beatId: "BEAT-01" }] });
const fixture = ({ blockers }) => { const { plan, manifest } = completedCurrentFixture(); return { plan, manifest, waves: plan.cutsceneWorkflow.waves, continuityReceipt: currentContinuityReceipt(plan, manifest, { blockingFindingIds: blockers }) }; };
test("dialogue overlay preserves base bytes and creates no image", () => {
  const base = generatedFixture();
  const before = canonicalCutsceneDocument(base.plan);
  assert.deepEqual(buildVariantOverlay({ basePlan: base.plan, triggerState: "QUEST-COMPANION-ABSENT", changes: [{ shotId: "SHOT-04", kind: "dialogue", value: "혼자 가야 해." }] }).generatedAssetIds, []);
  assert.equal(canonicalCutsceneDocument(base.plan), before);
});
test("blockers prevent derived document approval", () => assert.equal(deriveCutsceneLifecycle(fixture({ blockers: ["continuity-shot-01-screen-direction"] })).documentApproved, false));
```

- [ ] **Run RED.** `node --test --test-name-pattern='dialogue|derived' tests/unit/cutscene-visual-preproduction.test.mjs tests/unit/cutscene-generation-approval.test.mjs` → FAIL: APIs absent.
- [ ] **GREEN — implement.** Dialogue-only has no derivative; visual changes create deterministic IDs disjoint from base storyboard IDs. Impact seeds are exact while downstream waves contain all assets; invalidation preserves history and records only each wave's affected intersection. Receipts bind current plan and continuity-manifest digests; review observations are closed `{shotId,finding:{kind,blocking},sourceMasterIds}` records using real style/reference masters. The gate requires exact current plan, manifest, waves, receipt and production-candidate readiness without any approval, provider, journal, or artifact mutation.
- [ ] **Run GREEN.** `node --test tests/unit/cutscene-visual-preproduction.test.mjs tests/unit/cutscene-generation-approval.test.mjs` → PASS.
- [ ] **Commit.** `git add shared/scripts/review-cutscene-continuity.mjs shared/scripts/plan-cutscene-visual-preproduction.mjs shared/scripts/validate-cutscene-visual-preproduction.mjs shared/image-assets/schema/cutscene-continuity-review.schema.json tests/unit/cutscene-visual-preproduction.test.mjs && git commit -m "feat: derive cutscene continuity lifecycle"`
