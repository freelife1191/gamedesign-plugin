import assert from "node:assert/strict";
import test from "node:test";

import {
  buildImageAssetPlan,
  selectGenerationJobs,
} from "../../shared/scripts/build-image-asset-plan.mjs";

const qualityProfile = {
  profile_id: "combat-brief",
  version: 1,
  artifact_types: ["design-document"],
  audiences: ["design"],
  required_sections: [{ id: "combat", title: "Combat readability" }],
  required_tables: [{ id: "combat-table", section_id: "combat", columns: ["Signal"] }],
  required_diagrams: [{ id: "combat-diagram", section_id: "combat", purpose: "Explain state flow", alt_text: "Combat states" }],
  required_images: [{ id: "boss-telegraph", section_id: "combat", purpose: "Explain the threat and safe response", alt_text: "Boss threat and safe response" }],
  recommended_images: [{ id: "combat-cover", section_id: "combat", purpose: "Set the document context", alt_text: "Combat document context" }],
  length_guidance: { min_words: 100, max_words: 500 },
  ppt_story_contract: {},
  acceptance_criteria: ["Signals remain readable without color alone."],
  export_rules: { required_formats: ["md"], forbidden_formats: [] },
  quality_checks: ["combat-readability"],
};

const artifact = {
  artifact_id: "combat-brief",
  image_needs: [
    {
      slot_id: "boss-telegraph",
      type: "skill-vfx",
      scene: "A circular arena with an unambiguous safe response lane.",
      subject: "A boss attack telegraph and a player silhouette.",
      composition: "Top-down play-space composition.",
      visual_style: "Clear game-design concept illustration.",
      readability: "Readable at play distance with shape and pattern cues beyond color.",
      width: 1536,
      height: 1024,
    },
    {
      slot_id: "combat-cover",
      type: "document-illustration-cover",
      scene: "A restrained combat planning workspace.",
      subject: "A neutral combat planning illustration.",
      composition: "Landscape cover composition.",
      visual_style: "Clear document illustration.",
      readability: "Readable at document-cover distance.",
      width: 1536,
      height: 1024,
    },
    {
      slot_id: "boss-telegraph",
      variant: "close-up",
      type: "skill-vfx",
      scene: "A circular arena detail.",
      subject: "The boss attack telegraph detail.",
      composition: "Top-down close detail.",
      visual_style: "Clear game-design concept illustration.",
      readability: "Readable at play distance with shape and pattern cues beyond color.",
      width: 1024,
      height: 1024,
    },
  ],
};

function plan() {
  return buildImageAssetPlan({ artifact, qualityProfile });
}

test("buildImageAssetPlan derives a deterministic closed manifest from validated profile slots and explicit needs", () => {
  const first = plan();
  const second = plan();

  assert.deepEqual(first, second);
  assert.deepEqual(first.manifest.assets.map(({ asset_id, requirement, generation_state, approval_state, planning }) => ({
    asset_id, requirement, generation_state, approval_state, planning,
  })), [
    { asset_id: "boss-telegraph", requirement: "required", generation_state: "prompt-ready", approval_state: "concept-draft", planning: { upstream_slot_id: "boss-telegraph", disposition: "active", target_output: { path: "assets/generated/boss-telegraph.png", width: 1536, height: 1024, aspect_ratio: "3:2", format: "png", background: "contextual" } } },
    { asset_id: "combat-cover", requirement: "recommended", generation_state: "prompt-ready", approval_state: "concept-draft", planning: { upstream_slot_id: "combat-cover", disposition: "active", target_output: { path: "assets/generated/combat-cover.png", width: 1536, height: 1024, aspect_ratio: "3:2", format: "png", background: "contextual" } } },
    { asset_id: "boss-telegraph-close-up", requirement: "variant", generation_state: "prompt-ready", approval_state: "concept-draft", planning: { upstream_slot_id: "boss-telegraph", disposition: "active", target_output: { path: "assets/generated/boss-telegraph-close-up.png", width: 1024, height: 1024, aspect_ratio: "1:1", format: "png", background: "contextual" } } },
  ]);
  assert.deepEqual(first.summary, { required: 1, recommended: 1, variants: 1, total: 3 });
});

test("buildImageAssetPlan preserves generated approved removed slots and requires planning review without altering lifecycle data", () => {
  const existing = plan().manifest;
  const preserved = structuredClone(existing.assets[0]);
  preserved.generation_state = "generated";
  preserved.approval_state = "document-approved";
  preserved.reviews = [{
    state: "document-approved",
    reviewer: "Minji Kim",
    reviewer_kind: "human",
    reviewer_role: "visual-reviewer",
    review_scope: "document-visual",
    reviewed_at: "2026-08-05T10:00:00Z",
    evidence_paths: ["evidence.yml"],
    rights_decision: "approved",
  }];
  const removed = structuredClone(existing.assets[1]);
  removed.asset_id = "retired-cover";
  removed.generation_state = "generated";
  removed.planning = { ...removed.planning, upstream_slot_id: "combat-cover", disposition: "active" };
  removed.approval_state = "production-candidate";
  removed.rights.effective_status = "active";
  removed.technical_fit = "Meets the recorded delivery specification.";
  removed.gameplay_readability = "Readable in the approved document placement.";
  removed.reviews = [...preserved.reviews, {
    state: "production-candidate",
    reviewer: "Jae Park",
    reviewer_kind: "human",
    reviewer_role: "rights-provenance-reviewer",
    review_scope: "production-rights-provenance",
    reviewed_at: "2026-08-05T11:00:00Z",
    evidence_paths: ["decisions/0001-image-rights.md"],
    rights_decision: "approved",
  }];
  removed.purpose = "A formerly generated cover.";
  removed.output.path = "assets/generated/retired-cover.png";
  const replanned = buildImageAssetPlan({
    artifact: { ...artifact, image_needs: artifact.image_needs.filter(({ slot_id }) => slot_id !== "combat-cover") },
    qualityProfile: { ...qualityProfile, recommended_images: [] },
    existingManifest: { schema_version: 1, assets: [preserved, removed] },
  });

  const retained = replanned.manifest.assets.find(({ asset_id }) => asset_id === "boss-telegraph");
  const review = replanned.manifest.assets.find(({ asset_id }) => asset_id === "retired-cover");
  assert.equal(retained.generation_state, "generated");
  assert.equal(retained.approval_state, "document-approved");
  assert.deepEqual(retained.reviews, preserved.reviews);
  assert.equal(review.generation_state, "generated");
  assert.equal(review.approval_state, "production-candidate");
  assert.deepEqual(review.planning, { ...removed.planning, disposition: "replan-review-required" });
  assert.equal(review.readability, removed.readability);
  assert.deepEqual(review.reviews, removed.reviews);
  assert.deepEqual(review.rights, removed.rights);
  assert.equal(review.output.path, "assets/generated/retired-cover.png");
  assert.deepEqual(selectGenerationJobs({ manifest: replanned.manifest, mode: "all" }).map(({ asset_id }) => asset_id), [
    "boss-telegraph-close-up",
  ]);
  assert.throws(() => selectGenerationJobs({ manifest: replanned.manifest, mode: "select", selectedAssetIds: ["retired-cover"] }), /replan/i);
});

test("buildImageAssetPlan recalculates current planning fields and marks changed generated assets stale without deleting lifecycle evidence", () => {
  const existing = plan().manifest;
  const generated = structuredClone(existing.assets[0]);
  generated.generation_state = "generated";
  generated.approval_state = "document-approved";
  generated.provider = { name: "recorded-provider", model: "recorded-model", quality: "high" };
  generated.rights = { ...generated.rights, provenance: "Recorded provenance remains attached." };
  generated.reviews = [{
    state: "document-approved",
    reviewer: "Minji Kim",
    reviewer_kind: "human",
    reviewer_role: "visual-reviewer",
    review_scope: "document-visual",
    reviewed_at: "2026-08-05T10:00:00Z",
    evidence_paths: ["evidence.yml"],
    rights_decision: "approved",
  }];
  const changedArtifact = structuredClone(artifact);
  changedArtifact.image_needs[0] = {
    ...changedArtifact.image_needs[0],
    type: "environment-landmark",
    subject: "A new landmark silhouette instead of the previous boss telegraph.",
    width: 1024,
    height: 1024,
  };
  const replanned = buildImageAssetPlan({
    artifact: changedArtifact,
    qualityProfile,
    existingManifest: { schema_version: 1, assets: [generated] },
  });
  const current = replanned.manifest.assets.find(({ asset_id }) => asset_id === "boss-telegraph");

  assert.equal(current.type, "environment-landmark");
  assert.equal(current.requirement, "required");
  assert.equal(current.art_brief.subject, "A new landmark silhouette instead of the previous boss telegraph.");
  assert.deepEqual(current.output, {
    path: "assets/generated/boss-telegraph.png", width: 1536, height: 1024, aspect_ratio: "3:2", format: "png", background: "contextual",
  });
  assert.equal(current.generation_state, "generated");
  assert.equal(current.approval_state, "document-approved");
  assert.deepEqual(current.provider, generated.provider);
  assert.deepEqual(current.rights, generated.rights);
  assert.deepEqual(current.reviews, generated.reviews);
  assert.deepEqual(current.planning, {
    upstream_slot_id: "boss-telegraph", disposition: "replan-review-required",
    target_output: { path: "assets/generated/boss-telegraph.png", width: 1024, height: 1024, aspect_ratio: "1:1", format: "png", background: "contextual" },
  });
  assert.throws(() => selectGenerationJobs({ manifest: replanned.manifest, mode: "select", selectedAssetIds: ["boss-telegraph"] }), /replan/i);
});

test("buildImageAssetPlan migrates a legacy v1 manifest and keeps the generated output separate from a changed target", () => {
  const legacy = structuredClone(plan().manifest);
  const generated = legacy.assets[0];
  delete generated.planning;
  generated.generation_state = "generated";
  generated.output = { path: "assets/generated/boss-telegraph.png", width: 100, height: 100, aspect_ratio: "1:1", format: "png", background: "opaque" };
  generated.provider = { name: "recorded-provider", model: "recorded-model", quality: "high" };
  generated.rights = { ...generated.rights, provenance: "Legacy generated provenance." };
  const changedArtifact = structuredClone(artifact);
  changedArtifact.image_needs[0] = { ...changedArtifact.image_needs[0], width: 200, height: 200 };
  const replanned = buildImageAssetPlan({
    artifact: changedArtifact,
    qualityProfile,
    existingManifest: { schema_version: 1, assets: [generated] },
  });
  const current = replanned.manifest.assets[0];

  assert.deepEqual(current.output, generated.output);
  assert.equal(current.generation_state, "generated");
  assert.deepEqual(current.provider, generated.provider);
  assert.deepEqual(current.rights, generated.rights);
  assert.deepEqual(current.planning, {
    upstream_slot_id: "boss-telegraph", disposition: "replan-review-required",
    target_output: { path: "assets/generated/boss-telegraph.png", width: 200, height: 200, aspect_ratio: "1:1", format: "png", background: "contextual" },
  });
  assert.equal(selectGenerationJobs({ manifest: replanned.manifest, mode: "all" }).some(({ asset_id }) => asset_id === "boss-telegraph"), false);
});

test("selectGenerationJobs applies only finite manifest-declared scope without mutating its manifest", () => {
  const manifest = plan().manifest;
  const before = structuredClone(manifest);

  assert.deepEqual(selectGenerationJobs({ manifest, mode: "prompt-only" }), []);
  assert.deepEqual(selectGenerationJobs({ manifest, mode: "required" }).map(({ asset_id }) => asset_id), ["boss-telegraph"]);
  assert.deepEqual(selectGenerationJobs({ manifest, mode: "all" }).map(({ asset_id }) => asset_id), [
    "boss-telegraph", "combat-cover", "boss-telegraph-close-up",
  ]);
  assert.deepEqual(selectGenerationJobs({ manifest, mode: "select" }), []);
  assert.deepEqual(selectGenerationJobs({
    manifest,
    mode: "select",
    selectedAssetIds: ["boss-telegraph-close-up", "combat-cover"],
  }).map(({ asset_id }) => asset_id), ["combat-cover", "boss-telegraph-close-up"]);
  assert.deepEqual(manifest, before);
});

test("selectGenerationJobs returns the planning target output without mutating a retained actual output", () => {
  const manifest = plan().manifest;
  manifest.assets[0].output = { path: "assets/generated/boss-telegraph.png", width: 100, height: 100, aspect_ratio: "1:1", format: "png", background: "opaque" };
  manifest.assets[0].planning.target_output = { path: "assets/generated/boss-telegraph-next.png", width: 200, height: 100, aspect_ratio: "2:1", format: "png", background: "contextual" };
  const before = structuredClone(manifest);

  const [job] = selectGenerationJobs({ manifest, mode: "required" });
  assert.deepEqual(job.output, manifest.assets[0].planning.target_output);
  assert.deepEqual(manifest, before);
});

test("selectGenerationJobs fails closed for valid legacy v1 manifests in generation modes without mutating them", () => {
  const legacy = plan().manifest;
  for (const asset of legacy.assets) delete asset.planning;
  const before = structuredClone(legacy);
  for (const options of [
    { mode: "required" },
    { mode: "all" },
    { mode: "select", selectedAssetIds: ["boss-telegraph"] },
  ]) {
    assert.throws(() => selectGenerationJobs({ manifest: legacy, ...options }), (error) => (
      error.code === "legacy_manifest_requires_replan" && !error.message.includes(legacy.assets[0].art_brief.subject)
        && !JSON.stringify(error).includes(legacy.assets[0].art_brief.subject)
    ));
  }
  assert.deepEqual(selectGenerationJobs({ manifest: legacy, mode: "prompt-only" }), []);
  assert.deepEqual(legacy, before);
});

test("selectGenerationJobs validates prompt-only manifests and rejects secret-like input before returning zero jobs", () => {
  const legacy = plan().manifest;
  for (const asset of legacy.assets) delete asset.planning;
  const secret = "OPENAI_API_KEY=opaque-secret-value";
  legacy.assets[0].art_brief.subject = secret;

  assert.throws(() => selectGenerationJobs({ manifest: legacy, mode: "prompt-only" }), (error) => (
    error.code === "unsafe_generation_manifest" && !error.message.includes(secret) && !JSON.stringify(error).includes(secret)
  ));
});

test("selectGenerationJobs rejects unknown, duplicate, and non-prompt-ready selections", () => {
  const manifest = plan().manifest;
  assert.throws(() => selectGenerationJobs({ manifest, mode: "select", selectedAssetIds: ["unknown"] }), /unknown/i);
  assert.throws(() => selectGenerationJobs({ manifest, mode: "select", selectedAssetIds: ["boss-telegraph", "boss-telegraph"] }), /duplicate/i);
  const nonReady = structuredClone(manifest);
  nonReady.assets[0].generation_state = "generated";
  assert.throws(() => selectGenerationJobs({ manifest: nonReady, mode: "select", selectedAssetIds: ["boss-telegraph"] }), /prompt-ready/i);
  assert.throws(() => selectGenerationJobs({ manifest, mode: "unbounded" }), /mode/i);
});
