import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { composeQualityProfile } from "../../shared/scripts/resolve-quality-profile.mjs";
import { validateQualityProfile } from "../../shared/scripts/validate-quality-profile.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const qualityRoot = path.join(root, "shared/document-quality");

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

      if (profile.export_rules.required_formats?.includes("pptx")) {
        assert.ok(profile.artifact_types.includes("presentation"), `${id}: presentation render contract binding`);
        const rules = profile.ppt_story_contract.story_rules ?? [];
        assert.ok(rules.length > 0, `${id}: non-empty PPT story contract`);
        const byId = new Map(rules.map((rule) => [rule.id, rule]));
        for (const ruleId of ["audience", "decision-purpose", "message-per-slide", "source-section-binding", "visual-slot-binding", "speaker-note-policy"]) {
          assert.ok(byId.has(ruleId), `${id}: ${ruleId}`);
        }
        assert.ok(byId.get("source-section-binding").section_id, `${id}: source section is bound`);
        assert.ok(byId.get("visual-slot-binding").diagram_id || byId.get("visual-slot-binding").image_id, `${id}: visual slot is bound`);
      }
    }
  }
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
