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
  assert.deepEqual(first.manifest.assets.map(({ asset_id, requirement, generation_state, approval_state }) => ({
    asset_id, requirement, generation_state, approval_state,
  })), [
    { asset_id: "boss-telegraph", requirement: "required", generation_state: "prompt-ready", approval_state: "concept-draft" },
    { asset_id: "combat-cover", requirement: "recommended", generation_state: "prompt-ready", approval_state: "concept-draft" },
    { asset_id: "boss-telegraph-close-up", requirement: "variant", generation_state: "prompt-ready", approval_state: "concept-draft" },
  ]);
  assert.deepEqual(first.summary, { required: 1, recommended: 1, variants: 1, total: 3 });
});

test("buildImageAssetPlan preserves stable IDs and human decisions while retaining removed upstream slots for review", () => {
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
  removed.purpose = "A formerly generated cover that needs a human replan decision.";
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
  assert.equal(review.generation_state, "qa-failed");
  assert.match(review.readability, /human replan review/i);
  assert.equal(review.output.path, "assets/generated/retired-cover.png");
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

test("selectGenerationJobs rejects unknown, duplicate, and non-prompt-ready selections", () => {
  const manifest = plan().manifest;
  assert.throws(() => selectGenerationJobs({ manifest, mode: "select", selectedAssetIds: ["unknown"] }), /unknown/i);
  assert.throws(() => selectGenerationJobs({ manifest, mode: "select", selectedAssetIds: ["boss-telegraph", "boss-telegraph"] }), /duplicate/i);
  const nonReady = structuredClone(manifest);
  nonReady.assets[0].generation_state = "generated";
  assert.throws(() => selectGenerationJobs({ manifest: nonReady, mode: "select", selectedAssetIds: ["boss-telegraph"] }), /prompt-ready/i);
  assert.throws(() => selectGenerationJobs({ manifest, mode: "unbounded" }), /mode/i);
});
