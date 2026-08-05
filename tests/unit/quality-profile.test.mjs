import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { validateQualityProfile } from "../../shared/scripts/validate-quality-profile.mjs";
import { composeQualityProfile, loadQualityProfile } from "../../shared/scripts/resolve-quality-profile.mjs";

function profile(overrides = {}) {
  return {
    profile_id: "studio-default",
    version: "1.0.0",
    artifact_types: ["design-document"],
    audiences: ["production-team"],
    required_sections: [
      { id: "overview", title: "Overview" },
      { id: "systems", title: "Systems" },
    ],
    required_tables: [{ id: "system-summary", section_id: "systems" }],
    required_diagrams: [{ id: "core-loop", section_id: "systems" }],
    required_images: [{ id: "hero-image", section_id: "overview" }],
    recommended_images: [{ id: "system-detail", section_id: "systems" }],
    length_guidance: { min_words: 800, max_words: 1600 },
    ppt_story_contract: {
      min_slides: 5,
      max_slides: 10,
      required_diagram_ids: ["core-loop"],
      required_image_ids: ["hero-image"],
    },
    acceptance_criteria: ["Every required section is complete."],
    export_rules: { required_formats: ["md", "pdf"], forbidden_formats: ["pptx"] },
    quality_checks: ["section-completeness"],
    ...overrides,
  };
}

function errorCodes(value) {
  return validateQualityProfile(value).errors.map(({ code }) => code);
}

test("validates the closed quality-profile contract without mutating input", () => {
  const value = profile();
  const before = structuredClone(value);

  assert.deepEqual(validateQualityProfile(value), { ok: true, errors: [] });
  assert.deepEqual(value, before);
  assert.ok(errorCodes({ ...value, unknown: true }).includes("schema.additional_property"));
  assert.ok(errorCodes({ ...value, required_sections: [...value.required_sections, value.required_sections[0]] }).includes("id.duplicate"));
  assert.ok(errorCodes({ ...value, acceptance_criteria: [] }).includes("array.empty"));
});

test("rejects dangling section and PPT slot references", () => {
  const invalid = profile({
    required_tables: [{ id: "table", section_id: "missing" }],
    required_diagrams: [{ id: "diagram", section_id: "missing" }],
    required_images: [{ id: "image", section_id: "missing" }],
    ppt_story_contract: {
      min_slides: 2,
      max_slides: 1,
      required_diagram_ids: ["missing-diagram"],
      required_image_ids: ["missing-image"],
    },
  });

  assert.deepEqual(errorCodes(invalid), [
    "range.invalid",
    "reference.unknown",
    "reference.unknown",
    "reference.unknown",
    "reference.unknown",
    "reference.unknown",
  ]);
  assert.ok(errorCodes(profile({
    ppt_story_contract: {
      min_slides: 0,
      max_slides: 1,
      required_diagram_ids: ["core-loop"],
      required_image_ids: ["hero-image"],
    },
  })).includes("story.slides"));
});

test("rejects contradictory export rules", () => {
  const invalid = profile({ export_rules: { required_formats: ["pdf"], forbidden_formats: ["pdf"] } });

  assert.ok(errorCodes(invalid).includes("export.contradiction"));
});

test("rejects every empty required-content list", () => {
  for (const key of ["required_sections", "required_tables", "required_diagrams", "required_images"]) {
    const result = validateQualityProfile(profile({ [key]: [] }));
    assert.ok(
      result.errors.some(({ code, path: errorPath }) => code === "array.empty" && errorPath === `/${key}`),
      key,
    );
  }
});

test("composition preserves primary requirements, adds stable unique entries, and reports scalar conflicts", () => {
  const primary = profile();
  const overlay = {
    profile_id: "mobile-overlay",
    required_sections: [
      { id: "systems", title: "Ignored duplicate" },
      { id: "mobile", title: "Mobile" },
    ],
    acceptance_criteria: ["Every required section is complete.", "Touch targets are usable."],
    length_guidance: { max_words: 1200 },
  };
  const preset = {
    profile_id: "executive-preset",
    required_sections: [{ id: "summary", title: "Executive summary" }],
    acceptance_criteria: ["Touch targets are usable.", "The recommendation is explicit."],
  };
  const before = structuredClone({ primary, overlay, preset });

  const result = composeQualityProfile({ primary, overlays: [overlay], preset });

  assert.deepEqual(result.profile.required_sections.map(({ id }) => id), ["overview", "systems", "mobile", "summary"]);
  assert.deepEqual(result.profile.acceptance_criteria, [
    "Every required section is complete.",
    "Touch targets are usable.",
    "The recommendation is explicit.",
  ]);
  assert.deepEqual(result.profile.length_guidance, primary.length_guidance);
  assert.deepEqual(result.provenance, {
    primary: "studio-default",
    overlays: ["mobile-overlay"],
    preset: "executive-preset",
  });
  assert.deepEqual(result.conflicts, [{
    path: "/length_guidance/max_words",
    primary: 1600,
    incoming: 1200,
    source: "mobile-overlay",
  }]);
  assert.deepEqual({ primary, overlay, preset }, before);
  assert.equal(Object.isFrozen(result.profile), true);
  assert.equal(Object.isFrozen(result.profile.required_sections), true);
});

test("composition rejects removal directives from overlays and presets", () => {
  assert.throws(
    () => composeQualityProfile({ primary: profile(), overlays: [{ profile_id: "bad-overlay", remove: ["overview"] }] }),
    /removal directive/i,
  );
  assert.throws(
    () => composeQualityProfile({ primary: profile(), preset: { profile_id: "bad-preset", remove_sections: ["systems"] } }),
    /removal directive/i,
  );
});

test("loads a validated profile only from a safe non-symlink profile path", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "quality-profile-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const profilesRoot = path.join(root, "references/quality-profiles");
  await mkdir(profilesRoot, { recursive: true });
  await writeFile(path.join(profilesRoot, "studio-default.json"), `${JSON.stringify(profile(), null, 2)}\n`);

  assert.deepEqual(await loadQualityProfile({ pluginRoot: root, profileId: "studio-default" }), profile());
  await assert.rejects(() => loadQualityProfile({ pluginRoot: root, profileId: "../escape" }), /profile id/i);

  await writeFile(path.join(profilesRoot, "target.json"), `${JSON.stringify(profile({ profile_id: "linked" }), null, 2)}\n`);
  await symlink("target.json", path.join(profilesRoot, "linked.json"));
  await assert.rejects(() => loadQualityProfile({ pluginRoot: root, profileId: "linked" }), /symlink/i);

  const realPlugin = path.join(root, "real-plugin/plugin-dir");
  await mkdir(path.join(realPlugin, "references/quality-profiles"), { recursive: true });
  await writeFile(
    path.join(realPlugin, "references/quality-profiles/studio-default.json"),
    `${JSON.stringify(profile(), null, 2)}\n`,
  );
  await symlink("real-plugin", path.join(root, "plugin-alias"));
  await assert.rejects(
    () => loadQualityProfile({ pluginRoot: path.join(root, "plugin-alias/plugin-dir"), profileId: "studio-default" }),
    /symlink/i,
  );
});
