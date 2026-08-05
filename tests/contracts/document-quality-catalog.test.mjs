import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { composeQualityProfile } from "../../shared/scripts/resolve-quality-profile.mjs";
import { validateQualityProfile } from "../../shared/scripts/validate-quality-profile.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const qualityRoot = path.join(root, "shared/document-quality");
const requiredSlideFields = [
  "id", "title", "message", "purpose", "source_section_ids", "visual_slots", "speaker_notes_required",
];

const catalogs = {
  studio: [
    "vision-one-pager", "game-design-brief", "master-gdd", "core-motivation-loop",
    "system-feature-specification", "rule-state-exception-matrix", "data-table-contract",
    "narrative-quest-npc-specification", "character-skill-combat-monster-specification",
    "ui-ux-flow-state-specification", "economy-balance-specification",
    "liveops-event-experiment-plan", "accessibility-platform-matrix",
    "production-scope-milestone-risk-plan", "playtest-metrics-report",
    "design-review-decision-log", "executive-pitch",
  ],
  career: [
    "career-stage-role-map", "competency-matrix", "learning-roadmap", "job-posting-evidence",
    "reverse-design-document", "game-analysis-report", "portfolio-project-brief",
    "portfolio-case-study", "portfolio-review-backlog", "interview-question-answer-report",
    "junior-growth-review", "transition-readiness", "recruiter-portfolio-presentation",
  ],
};

async function json(relativePath) {
  return JSON.parse(await readFile(path.join(qualityRoot, relativePath), "utf8"));
}

test("Studio and Career catalogs contain exactly the approved validated profiles", async () => {
  for (const [catalog, expectedIds] of Object.entries(catalogs)) {
    const directory = path.join(qualityRoot, "profiles", catalog);
    const filenames = (await readdir(directory)).filter((name) => name.endsWith(".json")).sort();
    assert.deepEqual(filenames, expectedIds.map((id) => `${id}.json`).sort(), `${catalog} catalog IDs`);

    for (const id of expectedIds) {
      const profile = await json(`profiles/${catalog}/${id}.json`);
      assert.equal(profile.profile_id, id, `${id}: filename and profile ID`);
      assert.deepEqual(validateQualityProfile(profile, { sourceName: id }), { ok: true, errors: [] }, `${id}: validator`);
      assert.ok(profile.audiences.length > 0, `${id}: audience`);
      assert.ok(profile.required_sections.length > 0, `${id}: section`);
      assert.ok(profile.acceptance_criteria.length > 0, `${id}: acceptance criterion`);
      assert.ok(Object.values(profile.export_rules).some((formats) => formats.length > 0), `${id}: export rule`);
      assert.ok(profile.quality_checks.length > 0, `${id}: quality check`);

      const sectionIds = new Set(profile.required_sections.map(({ id: sectionId }) => sectionId));
      const slots = [...profile.required_tables, ...profile.required_diagrams, ...profile.required_images];
      assert.equal(new Set(slots.map(({ id: slotId }) => slotId)).size, slots.length, `${id}: unique required slot IDs`);
      for (const slot of slots) assert.ok(sectionIds.has(slot.section_id), `${id}: ${slot.id} section reference`);

      if (profile.export_rules.required_formats?.includes("pptx")) assertPresentationContract(profile);
    }
  }
});

function assertPresentationContract(profile) {
  const { profile_id: id, ppt_story_contract: contract } = profile;
  const sectionIds = new Set(profile.required_sections.map((section) => section.id));
  const visualSections = new Map(
    [...profile.required_diagrams, ...profile.required_images].map((visual) => [visual.id, visual.section_id]),
  );
  assert.ok(profile.artifact_types.includes("presentation"), `${id}: presentation render contract binding`);
  assert.equal(contract.audience_required, true, `${id}: audience is required`);
  assert.equal(contract.decision_purpose_required, true, `${id}: decision purpose is required`);
  assert.equal(contract.one_message_per_slide, true, `${id}: one message per slide`);
  assert.deepEqual(contract.required_slide_fields, requiredSlideFields, `${id}: exact required slide fields`);
  assert.equal(contract.speaker_note_policy, "required-for-every-slide", `${id}: speaker-note policy`);
  assert.ok(contract.allowed_section_ids.length > 0, `${id}: allowed sections`);
  assert.ok(contract.visual_bindings.length > 0, `${id}: visual bindings`);
  for (const sectionId of contract.allowed_section_ids) assert.ok(sectionIds.has(sectionId), `${id}: declared section ${sectionId}`);
  for (const binding of contract.visual_bindings) {
    assert.ok(visualSections.has(binding.visual_slot_id), `${id}: declared visual ${binding.visual_slot_id}`);
    assert.equal(binding.section_id, visualSections.get(binding.visual_slot_id), `${id}: visual section ownership`);
    assert.ok(contract.allowed_section_ids.includes(binding.section_id), `${id}: visual section is allowed`);
  }
}

test("PPT story policy rejects weakened fields and invalid section or visual bindings", async () => {
  const profile = await json("profiles/studio/executive-pitch.json");
  profile.ppt_story_contract = {
    min_slides: 7,
    max_slides: 12,
    required_diagram_ids: ["skillstead-pitch-dependency-diagram"],
    required_image_ids: ["pitch-key-art-image"],
    audience_required: true,
    decision_purpose_required: true,
    one_message_per_slide: true,
    required_slide_fields: [...requiredSlideFields],
    allowed_section_ids: ["decision-case", "delivery-case"],
    visual_bindings: [
      { visual_slot_id: "skillstead-pitch-dependency-diagram", section_id: "delivery-case" },
      { visual_slot_id: "pitch-key-art-image", section_id: "decision-case" },
    ],
    speaker_note_policy: "required-for-every-slide",
  };
  const expectIssue = (mutate, code, errorPath) => {
    const candidate = structuredClone(profile);
    mutate(candidate.ppt_story_contract);
    const result = validateQualityProfile(candidate, { sourceName: "mutated executive pitch" });
    assert.ok(result.errors.some((error) => error.code === code && error.path === errorPath), `${code} at ${errorPath}: ${JSON.stringify(result.errors)}`);
  };

  for (const field of ["audience_required", "decision_purpose_required", "one_message_per_slide", "speaker_note_policy"]) {
    expectIssue((contract) => delete contract[field], "story.policy_required", `/ppt_story_contract/${field}`);
  }
  for (const field of ["message", "purpose", "speaker_notes_required"]) {
    expectIssue(
      (contract) => { contract.required_slide_fields = contract.required_slide_fields.filter((item) => item !== field); },
      "story.slide_fields",
      "/ppt_story_contract/required_slide_fields",
    );
  }
  expectIssue((contract) => { contract.unknown_policy = true; }, "schema.additional_property", "/ppt_story_contract/unknown_policy");
  expectIssue((contract) => { contract.allowed_section_ids[0] = "undeclared-section"; }, "reference.unknown", "/ppt_story_contract/allowed_section_ids/0");
  expectIssue((contract) => { contract.visual_bindings[0].visual_slot_id = "undeclared-visual"; }, "reference.unknown", "/ppt_story_contract/visual_bindings/0/visual_slot_id");
  expectIssue((contract) => { contract.visual_bindings[0].section_id = "decision-case"; }, "reference.mismatch", "/ppt_story_contract/visual_bindings/0/section_id");
});

test("non-PPTX profiles still reject undeclared and mismatched optional story bindings", async () => {
  const profile = await json("profiles/studio/game-design-brief.json");
  const expectIssue = (pptStoryContract, code, errorPath) => {
    const result = validateQualityProfile({ ...profile, ppt_story_contract: pptStoryContract }, { sourceName: "non-PPTX binding mutation" });
    assert.ok(result.errors.some((error) => error.code === code && error.path === errorPath), `${code} at ${errorPath}: ${JSON.stringify(result.errors)}`);
  };

  expectIssue({ allowed_section_ids: ["undeclared-section"] }, "reference.unknown", "/ppt_story_contract/allowed_section_ids/0");
  expectIssue(
    { visual_bindings: [{ visual_slot_id: "undeclared-visual", section_id: "scope" }] },
    "reference.unknown",
    "/ppt_story_contract/visual_bindings/0/visual_slot_id",
  );
  expectIssue(
    { allowed_section_ids: ["scope", "design"], visual_bindings: [{ visual_slot_id: "skillstead-design-flow-diagram", section_id: "scope" }] },
    "reference.mismatch",
    "/ppt_story_contract/visual_bindings/0/section_id",
  );
});

test("platform and service overlays compose additively and reject removal directives", async () => {
  const primary = await json("profiles/studio/game-design-brief.json");
  for (const id of ["mobile", "pc-console", "live-service"]) {
    const overlay = await json(`overlays/${id}.json`);
    const composed = composeQualityProfile({ primary, overlays: [overlay] });
    for (const key of ["required_sections", "required_tables", "required_diagrams", "required_images", "acceptance_criteria", "quality_checks"]) {
      for (const requirement of primary[key]) assert.ok(composed.profile[key].some((entry) => JSON.stringify(entry) === JSON.stringify(requirement)), `${id}: preserves ${key}`);
    }
    assert.throws(() => composeQualityProfile({ primary, overlays: [{ ...overlay, remove_sections: ["scope"] }] }), /removal directive/i);
  }
});

test("render contracts define the complete layout and pagination behavior", async () => {
  for (const id of ["long-form-document", "review-report", "presentation"]) {
    const contract = await json(`render-contracts/${id}.json`);
    assert.equal(contract.contract_id, id);
    assert.ok(Number.isInteger(contract.version) && contract.version >= 1);
    for (const key of ["canvas", "margins", "type_scale", "cover_metadata", "tables", "callouts", "diagram_placement", "image_placement", "captions_alt_text", "headers_footers", "source_notes", "pagination"]) {
      assert.equal(typeof contract[key], "object", `${id}: ${key}`);
      assert.ok(contract[key] !== null && Object.keys(contract[key]).length > 0, `${id}: non-empty ${key}`);
    }
    for (const key of ["orphan_control", "overflow_policy", "empty_page_policy"]) {
      assert.equal(typeof contract.pagination[key], "string", `${id}: ${key}`);
      assert.ok(contract.pagination[key].length > 0, `${id}: non-empty ${key}`);
    }
  }
  const presentation = await json("render-contracts/presentation.json");
  assert.equal(presentation.artifact_type, "presentation");
  assert.ok(presentation.formats.includes("pptx"));
  assert.equal(presentation.canvas.kind, "slide");
});
