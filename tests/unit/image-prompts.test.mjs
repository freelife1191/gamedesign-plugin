import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { buildImageAssetPlan } from "../../shared/scripts/build-image-asset-plan.mjs";
import { compileImagePrompts } from "../../shared/scripts/compile-image-prompts.mjs";

const patternDirectory = new URL("../../shared/image-assets/prompt-patterns/", import.meta.url);

const qualityProfile = {
  profile_id: "visual-brief",
  version: 1,
  artifact_types: ["design-document"],
  audiences: ["design"],
  required_sections: [{ id: "visuals", title: "Visual direction" }],
  required_tables: [{ id: "visual-table", section_id: "visuals", columns: ["Signal"] }],
  required_diagrams: [{ id: "visual-diagram", section_id: "visuals", purpose: "Explain state flow", alt_text: "Visual states" }],
  required_images: [{ id: "hero-sequence", section_id: "visuals", purpose: "Maintain a readable character action sequence", alt_text: "Character action sequence" }],
  recommended_images: [{ id: "ability-icon", section_id: "visuals", purpose: "Show an ability symbol", alt_text: "Ability icon" }],
  length_guidance: { min_words: 100, max_words: 500 },
  ppt_story_contract: {},
  acceptance_criteria: ["Visual signals remain readable without color alone."],
  export_rules: { required_formats: ["md"], forbidden_formats: [] },
  quality_checks: ["visual-readability"],
};

const artifact = {
  artifact_id: "visual-brief",
  image_needs: [
    {
      slot_id: "hero-sequence",
      type: "character",
      sequence: true,
      anchor: "approved-character-anchor-hero",
      scene: "A ruined observatory at dusk.",
      subject: "A practical explorer with a broad cloak silhouette.",
      composition: "Three-quarter action view with clear negative space.",
      visual_style: "Original painterly game concept art.",
      readability: "Readable at play distance through silhouette and gesture.",
      width: 1024,
      height: 1024,
    },
    {
      slot_id: "ability-icon",
      type: "ui-icon",
      transparency_required: true,
      scene: "An opaque neutral studio background for concept generation.",
      subject: "A simple compass ability symbol with a bold silhouette.",
      composition: "Centered icon composition.",
      visual_style: "Original game UI concept art.",
      readability: "Readable at small play-distance UI scale without color alone.",
      width: 1024,
      height: 1024,
    },
  ],
};

async function patternCatalog() {
  const names = ["base", "character", "skill-vfx", "environment", "ui-icon", "storyboard", "document-illustration"];
  return Object.fromEntries(await Promise.all(names.map(async (name) => [
    name,
    JSON.parse(await readFile(new URL(`${name}.json`, patternDirectory), "utf8")),
  ])));
}

test("compileImagePrompts emits semantically equivalent Markdown and JSON prompt packages without secrets or source identities", async () => {
  const { manifest } = buildImageAssetPlan({ artifact, qualityProfile });
  const compiled = compileImagePrompts({ manifest, patternCatalog: await patternCatalog() });
  const payload = JSON.parse(compiled.json);

  assert.equal(payload.schema_version, 1);
  assert.equal(payload.expected_count, 2);
  assert.equal(payload.mode_scope, "manifest-declared");
  assert.match(compiled.markdown, /Expected count: 2/);
  assert.match(compiled.markdown, /Mode scope: manifest-declared/);
  assert.deepEqual(compiled.promptDigests, payload.prompts.map(({ asset_id, prompt_digest }) => ({ asset_id, prompt_digest })));
  assert.deepEqual(payload.prompts.map(({ asset_id, slot, type, dimensions, generation_state, approval_state }) => ({
    asset_id, slot, type, dimensions, generation_state, approval_state,
  })), [
    {
      asset_id: "hero-sequence", slot: "hero-sequence", type: "character", dimensions: { width: 1024, height: 1024, aspect_ratio: "1:1" },
      generation_state: "prompt-ready", approval_state: "concept-draft",
    },
    {
      asset_id: "ability-icon", slot: "ability-icon", type: "ui-icon", dimensions: { width: 1024, height: 1024, aspect_ratio: "1:1" },
      generation_state: "prompt-ready", approval_state: "concept-draft",
    },
  ]);
  assert.ok(payload.prompts.every(({ preserve, exclude, prompt_digest }) => (
    Array.isArray(preserve) && preserve.length > 0 && Array.isArray(exclude) && exclude.length > 0
      && /^[a-f0-9]{64}$/u.test(prompt_digest)
  )));
  for (const entry of payload.prompts) {
    assert.match(compiled.markdown, new RegExp(`## ${entry.asset_id}`));
    assert.match(compiled.markdown, new RegExp(`- Slot: ${entry.slot}`));
    assert.match(compiled.markdown, new RegExp(`- Type: ${entry.type}`));
    assert.match(compiled.markdown, new RegExp(`- Dimensions: ${entry.dimensions.width}x${entry.dimensions.height} \\(${entry.dimensions.aspect_ratio}\\)`));
    assert.match(compiled.markdown, new RegExp(`- Generation state: ${entry.generation_state}`));
    assert.match(compiled.markdown, new RegExp(`- Approval state: ${entry.approval_state}`));
    assert.match(compiled.markdown, new RegExp(`- Preserve: ${entry.preserve.join("; ")}`));
    assert.match(compiled.markdown, new RegExp(`- Exclude: ${entry.exclude.join("; ")}`));
    assert.match(compiled.markdown, new RegExp(entry.prompt_digest));
    assert.ok(compiled.markdown.includes(entry.prompt));
    assert.ok(entry.prompt.includes("Purpose and medium:"));
  }
  assert.doesNotMatch(`${compiled.markdown}\n${compiled.json}`, /api[_ -]?key|authorization|base64|openai|preset|company/iu);
});

test("compiled prompts keep the required prompt order, character anchor, exclusions, and verified UI alpha postprocess", async () => {
  const { manifest } = buildImageAssetPlan({ artifact, qualityProfile });
  const { json } = compileImagePrompts({ manifest, patternCatalog: await patternCatalog() });
  const prompts = JSON.parse(json).prompts;
  const character = prompts.find(({ asset_id }) => asset_id === "hero-sequence");
  const icon = prompts.find(({ asset_id }) => asset_id === "ability-icon");

  const orderedLabels = [
    "Purpose and medium:", "Gameplay or narrative purpose:", "Scene and background:", "Subject and silhouette:",
    "View, composition, and camera:", "Palette, light, material, expression, and action:",
    "Play-distance readability:", "Size and variant:", "Preserve conditions:", "Exclusions:",
  ];
  let prior = -1;
  for (const label of orderedLabels) {
    const index = character.prompt.indexOf(label);
    assert.ok(index > prior, `${label} must follow the approved order`);
    prior = index;
  }
  assert.match(character.prompt, /anchor: approved-character-anchor-hero/i);
  assert.match(character.prompt, /preserve conditions:.*broad cloak silhouette/i);
  assert.match(character.prompt, /logo.*watermark.*unrequested text.*third-party intellectual property/i);
  assert.equal(icon.generation_background, "opaque");
  assert.deepEqual(icon.postprocess_requirements, ["verified alpha postprocess", "edge QA"]);
  assert.match(icon.prompt, /opaque generation/i);
  assert.match(icon.prompt, /verified alpha postprocess/i);
});
