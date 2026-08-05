import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { buildProduct } from "../../tooling/lib/build-product.mjs";

import {
  applyImageReviewTransition,
  validateImageAssetManifest,
} from "../../shared/scripts/validate-image-assets.mjs";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const generationStates = [
  "planned", "prompt-ready", "selected", "generation-pending", "generated",
  "generation-unavailable", "generation-failed", "policy-blocked", "qa-failed",
];
const approvalStates = ["concept-draft", "document-approved", "production-candidate"];
const assetTypes = [
  "character", "npc", "monster-boss", "skill-vfx", "environment-landmark", "item-equipment",
  "ui-icon", "story-storyboard", "key-art-pitch-concept", "document-illustration-cover", "skillstead-diagram",
];
const requirements = ["required", "recommended", "variant"];

function schemaAccepts(value, rootSchema, externalSchemas, schema = rootSchema) {
  if (schema.$ref) {
    if (schema.$ref.startsWith("#/")) {
      const target = schema.$ref.slice(2).split("/").reduce((current, segment) => current[segment], rootSchema);
      return schemaAccepts(value, rootSchema, externalSchemas, target);
    }
    return schemaAccepts(value, externalSchemas.get(schema.$ref), externalSchemas);
  }
  if (Object.hasOwn(schema, "const") && value !== schema.const) return false;
  if (schema.enum && !schema.enum.includes(value)) return false;
  if (schema.allOf && !schema.allOf.every((part) => schemaAccepts(value, rootSchema, externalSchemas, part))) return false;
  if (schema.if && schemaAccepts(value, rootSchema, externalSchemas, schema.if)
    && schema.then && !schemaAccepts(value, rootSchema, externalSchemas, schema.then)) return false;
  if (schema.type === "object" || schema.properties || schema.required || schema.additionalProperties !== undefined) {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
    if ((schema.required ?? []).some((key) => !Object.hasOwn(value, key))) return false;
    if (schema.additionalProperties === false && Object.keys(value).some((key) => !Object.hasOwn(schema.properties ?? {}, key))) return false;
    return Object.entries(value).every(([key, child]) => !schema.properties?.[key]
      || schemaAccepts(child, rootSchema, externalSchemas, schema.properties[key]));
  }
  if (schema.type === "array" || schema.items || schema.contains || schema.minContains !== undefined) {
    if (!Array.isArray(value) || value.length < (schema.minItems ?? 0)) return false;
    if (schema.contains) {
      const matches = value.filter((item) => schemaAccepts(item, rootSchema, externalSchemas, schema.contains)).length;
      if (matches < (schema.minContains ?? 1)) return false;
    }
    return !schema.items || value.every((item) => schemaAccepts(item, rootSchema, externalSchemas, schema.items));
  }
  if (schema.type === "string") return typeof value === "string" && value.length >= (schema.minLength ?? 0)
    && (!schema.pattern || new RegExp(schema.pattern, "u").test(value));
  if (schema.type === "integer") return Number.isInteger(value) && value >= (schema.minimum ?? Number.NEGATIVE_INFINITY)
    && value <= (schema.maximum ?? Number.POSITIVE_INFINITY);
  return true;
}

async function imageAssetSchema() {
  const [manifestSchema, reviewSchema] = await Promise.all([
    readFile(new URL("../../shared/image-assets/schema/image-assets.schema.json", import.meta.url), "utf8"),
    readFile(new URL("../../shared/image-assets/schema/image-review.schema.json", import.meta.url), "utf8"),
  ]);
  return {
    manifestSchema: JSON.parse(manifestSchema),
    externalSchemas: new Map([["image-review.schema.json", JSON.parse(reviewSchema)]]),
  };
}

async function artifactRoot(t) {
  const root = await mkdtemp(path.join(tmpdir(), "image-assets-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

function manifest(overrides = {}) {
  const { asset: assetOverrides = {}, ...manifestOverrides } = overrides;
  const asset = {
    asset_id: "hero-knight-001",
    type: "character",
    requirement: "required",
    generation_state: "planned",
    approval_state: "concept-draft",
    purpose: "Establish the playable knight in the player-experience section.",
    placement: { document_slot: "inline", source_section: "content.md#player-experience" },
    alt_text: "An armored knight standing beside a windswept banner.",
    readability: "Readable at document column width with a clear silhouette.",
    art_brief: {
      subject: "A practical fantasy knight for a cooperative action game.",
      visual_style: "Readable painterly concept art with restrained ornament.",
      composition: "Three-quarter character view with negative space for captions.",
      preserve: ["broad shield silhouette", "blue team color"],
      exclude: ["text", "logos"],
    },
    prompt: "Painterly concept art of a practical fantasy knight, three-quarter view, no text or logos.",
    output: {
      path: "assets/generated/hero-knight-001.png",
      width: 1024,
      height: 1024,
      aspect_ratio: "1:1",
      format: "png",
      background: "transparent",
    },
    provider: { name: "openai-images", model: "gpt-image-2", quality: "low" },
    rights: {
      provenance: "AI-generated from the recorded prompt.",
      rights_holder: "Game Design Team",
      license: "internal-production-use",
      effective_status: "unreviewed",
    },
    reviews: [],
    technical_fit: "Fits the intended 1024px PNG delivery.",
    gameplay_readability: "Silhouette distinguishes the knight from hostile units.",
  };
  return { schema_version: 1, assets: [{ ...asset, ...assetOverrides }], ...manifestOverrides };
}

function deepFreeze(value) {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

function productionCandidate(root) {
  const documentApproved = applyImageReviewTransition(manifest().assets[0], {
    targetState: "document-approved",
    reviewer: "Minji Kim",
    reviewedAt: "2026-08-05T10:00:00Z",
    evidencePaths: ["evidence.yml"],
    rightsDecision: "approved",
  }, { artifactRoot: root });
  return applyImageReviewTransition(documentApproved, {
    targetState: "production-candidate",
    reviewer: "Jae Park",
    reviewedAt: "2026-08-05T11:00:00Z",
    evidencePaths: ["decisions/0001-image-rights.md"],
    rightsDecision: "approved",
  }, { artifactRoot: root });
}

test("validates a complete planned manifest without changing its input", async (t) => {
  const root = await artifactRoot(t);
  const value = deepFreeze(manifest());
  const result = validateImageAssetManifest(value, { artifactRoot: root });

  assert.deepEqual(result, {
    ok: true,
    errors: [],
    warnings: [],
    counts: { assets: 1, generation: { planned: 1 }, approval: { "concept-draft": 1 } },
  });
  assert.equal(value.assets[0].output.path, "assets/generated/hero-knight-001.png");
});

test("accepts each closed generation state independently from approval state", async (t) => {
  const root = await artifactRoot(t);
  for (const generationState of generationStates) {
    const result = validateImageAssetManifest(manifest({ asset: { generation_state: generationState } }), { artifactRoot: root });
    assert.equal(result.ok, true, generationState);
  }
  const result = validateImageAssetManifest(manifest({ asset: { generation_state: "not-a-state" } }), { artifactRoot: root });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(({ code, path: errorPath }) => code === "invalid_generation_state" && errorPath === "assets[0].generation_state"));
});

test("accepts approved categories and requirements while rejecting unknown enum values", async (t) => {
  const root = await artifactRoot(t);
  for (const type of assetTypes) {
    for (const requirement of requirements) {
      const result = validateImageAssetManifest(manifest({ asset: { type, requirement } }), { artifactRoot: root });
      assert.equal(result.ok, true, `${type}/${requirement}`);
    }
  }
  const result = validateImageAssetManifest(manifest({ asset: { type: "portrait", requirement: "optional" } }), { artifactRoot: root });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(({ code }) => code === "invalid_asset_type"));
  assert.ok(result.errors.some(({ code }) => code === "invalid_requirement"));
});

test("rejects duplicate ids, incomplete briefs, unsafe output paths, and missing rights", async (t) => {
  const root = await artifactRoot(t);
  const value = manifest({
    assets: [
      manifest().assets[0],
      {
        ...manifest().assets[0],
        output: { ...manifest().assets[0].output, path: "../outside.png" },
        art_brief: { ...manifest().assets[0].art_brief, exclude: [] },
        rights: { provenance: "AI-generated" },
      },
    ],
  });
  const result = validateImageAssetManifest(value, { artifactRoot: root });
  assert.equal(result.ok, false);
  for (const code of ["duplicate_asset_id", "path_outside_artifact", "missing_art_brief_constraint", "missing_rights_data"]) {
    assert.ok(result.errors.some((error) => error.code === code), code);
  }
});

test("requires a valid document placement binding", async (t) => {
  const root = await artifactRoot(t);
  const result = validateImageAssetManifest(manifest({
    asset: { placement: { document_slot: "floating", source_section: "outside.md#unknown" } },
  }), { artifactRoot: root });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(({ code }) => code === "invalid_document_slot"));
  assert.ok(result.errors.some(({ code }) => code === "invalid_source_section"));
});

test("returns structured validation errors when an approved asset has no review collection", async (t) => {
  const root = await artifactRoot(t);
  const value = manifest({ asset: { approval_state: "document-approved", reviews: undefined } });
  assert.doesNotThrow(() => validateImageAssetManifest(value, { artifactRoot: root }));
  const result = validateImageAssetManifest(value, { artifactRoot: root });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(({ code }) => code === "invalid_reviews"));
  assert.ok(result.errors.some(({ code }) => code === "missing_document_approval"));
});

test("requires human reviewers with closed roles and scopes for each approval stage", async (t) => {
  const root = await artifactRoot(t);
  const { manifestSchema, externalSchemas } = await imageAssetSchema();
  const automationApproval = manifest({ asset: {
    approval_state: "document-approved",
    reviews: [{
      state: "document-approved",
      reviewer: "Image Automation",
      reviewer_kind: "automation",
      reviewer_role: "visual-reviewer",
      review_scope: "document-visual",
      reviewed_at: "2026-08-05T10:00:00Z",
      evidence_paths: ["evidence.yml"],
      rights_decision: "approved",
    }],
  } });
  assert.equal(validateImageAssetManifest(automationApproval, { artifactRoot: root }).ok, false);
  assert.equal(schemaAccepts(automationApproval, manifestSchema, externalSchemas), false);
  assert.throws(() => applyImageReviewTransition(manifest().assets[0], {
    targetState: "document-approved",
    reviewer: "Image Automation",
    reviewerKind: "automation",
    reviewedAt: "2026-08-05T10:00:00Z",
    evidencePaths: ["evidence.yml"],
    rightsDecision: "approved",
  }, { artifactRoot: root }), /human/i);
});

test("the latest human rights review invalidates a production candidate when restricted or revoked", async (t) => {
  const root = await artifactRoot(t);
  const candidate = productionCandidate(root);
  for (const [rightsDecision, effectiveStatus] of [["restricted", "restricted"], ["rejected", "revoked"]]) {
    const revoked = structuredClone(candidate);
    revoked.rights.effective_status = effectiveStatus;
    revoked.rights.status_reason = "Rights owner changed the permitted use.";
    revoked.reviews.push({
      state: "production-candidate",
      reviewer: "Jae Park",
      reviewer_kind: "human",
      reviewer_role: "rights-provenance-reviewer",
      review_scope: "production-rights-provenance",
      reviewed_at: "2026-08-05T12:00:00Z",
      evidence_paths: ["decisions/0002-rights-restriction.md"],
      rights_decision: rightsDecision,
    });
    const result = validateImageAssetManifest({ schema_version: 1, assets: [revoked] }, { artifactRoot: root });
    assert.equal(result.ok, false, rightsDecision);
    assert.ok(result.errors.some(({ code }) => code === "rights_not_effective"), rightsDecision);
  }
});

test("closes manifest and every nested object against release, legal, and unknown assertions", async (t) => {
  const root = await artifactRoot(t);
  const { manifestSchema, externalSchemas } = await imageAssetSchema();
  const cases = [
    ["manifest", (value) => { value.release_approved = true; }],
    ["asset", (value) => { value.assets[0].legal_approved = true; }],
    ["placement", (value) => { value.assets[0].placement.release_approved = true; }],
    ["art brief", (value) => { value.assets[0].art_brief.legal_approved = true; }],
    ["output", (value) => { value.assets[0].output.release_approved = true; }],
    ["provider", (value) => { value.assets[0].provider.legal_approved = true; }],
    ["rights", (value) => { value.assets[0].rights.release_approved = true; }],
    ["review", (value) => {
      value.assets[0].approval_state = "document-approved";
      value.assets[0].reviews = [{
        state: "document-approved", reviewer: "Minji Kim", reviewer_kind: "human", reviewer_role: "visual-reviewer",
        review_scope: "document-visual", reviewed_at: "2026-08-05T10:00:00Z", evidence_paths: ["evidence.yml"],
        rights_decision: "approved", legal_approved: true,
      }];
    }],
  ];
  for (const [name, mutate] of cases) {
    const value = manifest();
    mutate(value);
    assert.equal(validateImageAssetManifest(value, { artifactRoot: root }).ok, false, `${name}: runtime`);
    assert.equal(schemaAccepts(value, manifestSchema, externalSchemas), false, `${name}: schema`);
  }
});

test("schema and runtime both require approval reviews and normalized generated paths", async (t) => {
  const root = await artifactRoot(t);
  const { manifestSchema, externalSchemas } = await imageAssetSchema();
  const cases = [
    ["document approval review", manifest({ asset: { approval_state: "document-approved", reviews: [] } })],
    ["production approval review", manifest({ asset: { approval_state: "production-candidate", reviews: [], rights: {
      ...manifest().assets[0].rights, effective_status: "active",
    } } })],
    ["normalized generated output", manifest({ asset: { output: {
      ...manifest().assets[0].output,
      path: "assets/generated/../../outside.png",
    } } })],
  ];
  for (const [name, value] of cases) {
    assert.equal(validateImageAssetManifest(value, { artifactRoot: root }).ok, false, `${name}: runtime`);
    assert.equal(schemaAccepts(value, manifestSchema, externalSchemas), false, `${name}: schema`);
  }
});

test("applies approval states in order, keeps input immutable, and records named evidence", async (t) => {
  const root = await artifactRoot(t);
  const original = deepFreeze(manifest());
  assert.throws(() => applyImageReviewTransition(original.assets[0], {
    targetState: "production-candidate",
    reviewer: "Minji Kim",
    reviewedAt: "2026-08-05T10:00:00Z",
    evidencePaths: ["evidence.yml"],
    rightsDecision: "approved",
  }, { artifactRoot: root }), /skipped|transition/i);

  const documentApproved = applyImageReviewTransition(original.assets[0], {
    targetState: "document-approved",
    reviewer: "Minji Kim",
    reviewedAt: "2026-08-05T10:00:00Z",
    evidencePaths: ["evidence.yml"],
    rightsDecision: "approved",
  }, { artifactRoot: root });
  assert.equal(documentApproved.approval_state, "document-approved");
  assert.equal(documentApproved.reviews.at(-1).reviewer, "Minji Kim");
  assert.deepEqual(documentApproved.reviews.at(-1).reviewer_kind, "human");
  assert.deepEqual(documentApproved.reviews.at(-1).reviewer_role, "visual-reviewer");
  assert.deepEqual(documentApproved.reviews.at(-1).review_scope, "document-visual");
  assert.equal(original.assets[0].approval_state, "concept-draft");
  assert.deepEqual(validateImageAssetManifest({ schema_version: 1, assets: [documentApproved] }, { artifactRoot: root }).errors, []);

  const productionCandidate = applyImageReviewTransition(documentApproved, {
    targetState: "production-candidate",
    reviewer: "Jae Park",
    reviewedAt: "2026-08-05T11:00:00Z",
    evidencePaths: ["decisions/0001-image-rights.md"],
    rightsDecision: "approved",
  }, { artifactRoot: root });
  assert.equal(productionCandidate.approval_state, "production-candidate");
  assert.equal(productionCandidate.reviews.at(-1).state, "production-candidate");
  assert.equal(productionCandidate.rights.effective_status, "active");
  assert.deepEqual(productionCandidate.reviews.at(-1).reviewer_role, "rights-provenance-reviewer");
});

test("rejects approval records without reviewers, rights decisions, or in-artifact evidence", async (t) => {
  const root = await artifactRoot(t);
  const asset = manifest().assets[0];
  for (const transition of [
    { reviewer: "", rightsDecision: "approved", evidencePaths: ["evidence.yml"] },
    { reviewer: "Minji Kim", rightsDecision: undefined, evidencePaths: ["evidence.yml"] },
    { reviewer: "Minji Kim", rightsDecision: "approved", evidencePaths: ["../outside-evidence.md"] },
  ]) {
    assert.throws(() => applyImageReviewTransition(asset, {
      targetState: "document-approved",
      reviewedAt: "2026-08-05T10:00:00Z",
      ...transition,
    }, { artifactRoot: root }), /reviewer|rights|evidence|artifact/i);
  }
});

test("does not treat production-candidate as release or legal approval", async (t) => {
  const root = await artifactRoot(t);
  const documentApproved = applyImageReviewTransition(manifest().assets[0], {
    targetState: "document-approved",
    reviewer: "Minji Kim",
    reviewedAt: "2026-08-05T10:00:00Z",
    evidencePaths: ["evidence.yml"],
    rightsDecision: "approved",
  }, { artifactRoot: root });
  const candidate = applyImageReviewTransition(documentApproved, {
    targetState: "production-candidate",
    reviewer: "Jae Park",
    reviewedAt: "2026-08-05T11:00:00Z",
    evidencePaths: ["decisions/0001-image-rights.md"],
    rightsDecision: "approved",
  }, { artifactRoot: root });
  assert.equal(Object.hasOwn(candidate, "release_approved"), false);
  assert.equal(Object.hasOwn(candidate, "legal_approved"), false);
  assert.throws(() => applyImageReviewTransition(candidate, {
    targetState: "release-approved",
    reviewer: "Legal",
    reviewedAt: "2026-08-05T12:00:00Z",
    evidencePaths: ["evidence.yml"],
    rightsDecision: "approved",
  }, { artifactRoot: root }), /target state|transition/i);
});

test("built products include empty image manifest and prompt seeds with the public contracts", async (t) => {
  const stagingRoot = await artifactRoot(t);
  const build = await buildProduct({
    repoRoot,
    productName: "game-design-studio",
    stagingRoot,
    sourceDateEpoch: 0,
  });
  for (const requiredPath of [
    "references/shared/image-assets/schema/image-assets.schema.json",
    "references/shared/image-assets/schema/image-review.schema.json",
    "references/shared/image-assets/qa-contracts/generated-image.md",
    "references/shared/image-assets/qa-contracts/production-candidate.md",
    "scripts/validate-image-assets.mjs",
    "assets/shared/templates/canonical-artifact/assets/image-assets.yml",
    "assets/shared/templates/canonical-artifact/assets/prompts/image-prompts.md",
    "assets/shared/templates/canonical-artifact/assets/prompts/image-prompts.json",
  ]) assert.ok(build.files.includes(requiredPath), requiredPath);
  const prompts = JSON.parse(await readFile(path.join(
    build.outputDir,
    "assets/shared/templates/canonical-artifact/assets/prompts/image-prompts.json",
  ), "utf8"));
  assert.deepEqual(prompts, { schema_version: 1, prompts: [] });
  assert.deepEqual(validateImageAssetManifest({ schema_version: 1, assets: [] }), {
    ok: true,
    errors: [],
    warnings: [],
    counts: { assets: 0, generation: {}, approval: {} },
  });
});

test("the executable validator returns the public result without reading paths outside the artifact", async (t) => {
  const root = await artifactRoot(t);
  const script = path.join(repoRoot, "shared/scripts/validate-image-assets.mjs");
  const result = spawnSync(process.execPath, [script, "--artifact-root", root], {
    input: JSON.stringify(manifest()),
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), {
    ok: true,
    errors: [],
    warnings: [],
    counts: { assets: 1, generation: { planned: 1 }, approval: { "concept-draft": 1 } },
  });
});
