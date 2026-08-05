import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { validateQualityProfile } from "../../shared/scripts/validate-quality-profile.mjs";
import { composeQualityProfile, loadQualityProfile } from "../../shared/scripts/resolve-quality-profile.mjs";
import * as qualityWorkflow from "../../shared/scripts/resolve-quality-profile.mjs";

function profile(overrides = {}) {
  return {
    profile_id: "studio-default",
    version: 1,
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

function schemaAccepts(value, rootSchema, schema = rootSchema) {
  if (schema.$ref) {
    const target = schema.$ref.slice(2).split("/").reduce((current, segment) => current[segment], rootSchema);
    return schemaAccepts(value, rootSchema, target);
  }
  if (Object.hasOwn(schema, "const") && value !== schema.const) return false;
  if (schema.enum && !schema.enum.includes(value)) return false;
  if (schema.allOf && !schema.allOf.every((part) => schemaAccepts(value, rootSchema, part))) return false;
  if (schema.if && schemaAccepts(value, rootSchema, schema.if) && schema.then && !schemaAccepts(value, rootSchema, schema.then)) return false;
  if (schema.type === "object") {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
    if ((schema.required ?? []).some((key) => !Object.hasOwn(value, key))) return false;
    if (schema.additionalProperties === false && Object.keys(value).some((key) => !Object.hasOwn(schema.properties ?? {}, key))) return false;
    return Object.entries(value).every(([key, child]) => !schema.properties?.[key] || schemaAccepts(child, rootSchema, schema.properties[key]));
  }
  if (schema.type === "array") {
    if (!Array.isArray(value) || value.length < (schema.minItems ?? 0) || value.length > (schema.maxItems ?? Number.POSITIVE_INFINITY)) return false;
    if (schema.uniqueItems && new Set(value.map((item) => JSON.stringify(item))).size !== value.length) return false;
    if (schema.contains && !value.some((item) => schemaAccepts(item, rootSchema, schema.contains))) return false;
    if (!schema.items) return true;
    return value.every((item) => schemaAccepts(item, rootSchema, schema.items));
  }
  if (schema.type === "string") {
    return typeof value === "string"
      && value.length >= (schema.minLength ?? 0)
      && (!schema.pattern || new RegExp(schema.pattern, "u").test(value));
  }
  if (schema.type === "integer") return Number.isInteger(value) && value >= (schema.minimum ?? Number.NEGATIVE_INFINITY);
  if (schema.type === "boolean") return typeof value === "boolean";
  return true;
}

function errorCodes(value) {
  return validateQualityProfile(value).errors.map(({ code }) => code);
}

test("validates the closed quality-profile contract without mutating input", () => {
  const value = profile();
  const before = structuredClone(value);

  assert.deepEqual(validateQualityProfile(value), { ok: true, errors: [] });
  assert.deepEqual(value, before);
  assert.ok(errorCodes({ ...value, version: "1.0.0" }).includes("version.invalid"));
  assert.ok(errorCodes({ ...value, unknown: true }).includes("schema.additional_property"));
  assert.ok(errorCodes({ ...value, required_sections: [...value.required_sections, structuredClone(value.required_sections[0])] }).includes("id.duplicate"));
  assert.ok(errorCodes({ ...value, acceptance_criteria: [] }).includes("array.empty"));
});

test("runtime validator and JSON Schema agree on nested optional fields and asset strings", async () => {
  const schema = JSON.parse(await readFile(new URL("../../shared/document-quality/schema/quality-profile.schema.json", import.meta.url), "utf8"));
  const cases = [
    ["optional nested fields omitted", true, profile({
      required_tables: [{ id: "system-summary", section_id: "systems" }],
      required_diagrams: [{ id: "core-loop", section_id: "systems" }],
      required_images: [{ id: "hero-image", section_id: "overview" }],
      recommended_images: [],
      ppt_story_contract: {},
      export_rules: {},
    })],
    ["optional asset title is empty", false, profile({
      required_tables: [{ id: "system-summary", section_id: "systems", title: "" }],
    })],
    ["optional asset purpose has wrong type", false, profile({
      required_diagrams: [{ id: "core-loop", section_id: "systems", purpose: 42 }],
    })],
    ["optional asset alt text is empty", false, profile({
      required_images: [{ id: "hero-image", section_id: "overview", alt_text: "" }],
    })],
  ];

  for (const [name, expected, value] of cases) {
    assert.equal(schemaAccepts(value, schema), expected, `${name}: schema`);
    assert.equal(validateQualityProfile(value).ok, expected, `${name}: runtime`);
  }
});

test("runtime validator and JSON Schema both require the complete PPTX story policy", async () => {
  const schema = JSON.parse(await readFile(new URL("../../shared/document-quality/schema/quality-profile.schema.json", import.meta.url), "utf8"));
  const presentation = profile({
    artifact_types: ["presentation"],
    ppt_story_contract: {
      min_slides: 5,
      max_slides: 10,
      required_diagram_ids: ["core-loop"],
      required_image_ids: ["hero-image"],
      audience_required: true,
      decision_purpose_required: true,
      one_message_per_slide: true,
      required_slide_fields: ["id", "title", "message", "purpose", "source_section_ids", "visual_slots", "speaker_notes_required"],
      allowed_section_ids: ["overview", "systems"],
      visual_bindings: [
        { visual_slot_id: "core-loop", section_id: "systems" },
        { visual_slot_id: "hero-image", section_id: "overview" },
      ],
      speaker_note_policy: "required-for-every-slide",
    },
    export_rules: { required_formats: ["pptx", "pdf"], forbidden_formats: [] },
  });
  const falsePolicy = structuredClone(presentation);
  falsePolicy.ppt_story_contract.audience_required = false;
  const missingPolicy = structuredClone(presentation);
  delete missingPolicy.ppt_story_contract.speaker_note_policy;

  for (const [name, expected, value] of [
    ["complete PPTX story policy", true, presentation],
    ["false audience policy", false, falsePolicy],
    ["missing speaker-note policy", false, missingPolicy],
  ]) {
    assert.equal(schemaAccepts(value, schema), expected, `${name}: schema`);
    assert.equal(validateQualityProfile(value).ok, expected, `${name}: runtime`);
  }
});

test("runtime validator and JSON Schema both reject malformed optional story policy on non-PPTX profiles", async () => {
  const schema = JSON.parse(await readFile(new URL("../../shared/document-quality/schema/quality-profile.schema.json", import.meta.url), "utf8"));
  const cases = [
    ["audience policy has wrong type", { audience_required: "yes" }],
    ["slide field contract is incomplete", { required_slide_fields: ["id"] }],
    ["visual binding is not closed", { visual_bindings: [{ visual_slot_id: "core-loop", section_id: "systems", unknown: true }] }],
    ["visual binding is duplicated", { visual_bindings: [
      { visual_slot_id: "core-loop", section_id: "systems" },
      { visual_slot_id: "core-loop", section_id: "systems" },
    ] }],
    ["speaker-note policy is unsupported", { speaker_note_policy: "optional" }],
  ];

  for (const [name, pptStoryContract] of cases) {
    const value = profile({ ppt_story_contract: pptStoryContract });
    assert.equal(schemaAccepts(value, schema), false, `${name}: schema`);
    assert.equal(validateQualityProfile(value).ok, false, `${name}: runtime`);
  }
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

test("all seven real neutral presets adapt and reject removal, duplicate, contradiction, and unknown-ID mutations", async () => {
  const presetRoot = new URL("../../shared/document-quality/presets/", import.meta.url);
  const presetIds = [
    "cinematic-narrative", "competitive-live-service", "evolving-world", "function-first",
    "player-validated-small-team", "replayable-coop", "ugc-production-tooling",
  ];
  for (const presetId of presetIds) {
    const preset = JSON.parse(await readFile(new URL(`${presetId}.json`, presetRoot), "utf8"));
    const result = composeQualityProfile({ primary: profile(), referencePreset: preset });
    assert.equal(validateQualityProfile(result.profile).ok, true, presetId);
    assert.equal(result.guidance.presetId, presetId);
    assert.deepEqual(result.guidance.reviewQuestions, preset.review_questions);
    for (const mutation of [
      { ...preset, remove_sections: ["overview"] },
      { ...preset, emphasis: [...preset.emphasis, preset.emphasis[0]] },
      { ...preset, export_rules: { forbidden_formats: ["pdf"] } },
      { ...preset, preset_id: `unknown-${presetId}` },
    ]) {
      assert.throws(
        () => composeQualityProfile({ primary: profile(), referencePreset: mutation }),
        /preset|removal|unknown|duplicate/i,
        presetId,
      );
    }
  }
});

async function loadCatalog(namespace) {
  const routing = JSON.parse(await readFile(new URL(
    `../../products/game-design-${namespace === "studio" ? "studio" : "career"}/plugin/references/routing.json`,
    import.meta.url,
  ), "utf8"));
  const profiles = await Promise.all(routing.qualityWorkflow.profileIds.map(async (profileId) => JSON.parse(await readFile(
    new URL(`../../shared/document-quality/profiles/${namespace}/${profileId}.json`, import.meta.url),
    "utf8",
  ))));
  const templateMap = JSON.parse(await readFile(new URL(
    `../../products/game-design-${namespace === "studio" ? "studio" : "career"}/plugin/references/document-quality/template-profile-map.json`,
    import.meta.url,
  ), "utf8"));
  const selectionIndex = JSON.parse(await readFile(new URL(
    `../../shared/document-quality/indexes/${namespace}.json`, import.meta.url,
  ), "utf8"));
  return { profiles, templateMap, selectionIndex };
}

test("executable selector normalizes inputs and ranks actual catalogs deterministically", async () => {
  assert.equal(typeof qualityWorkflow.selectQualityProfiles, "function");
  const { selectionIndex, templateMap } = await loadCatalog("studio");
  const requests = [{
    artifactId: "brief", goal: "Game Design Brief", audience: ["Production"],
    artifactType: "DESIGN_DOCUMENT", requestedFormat: "MD", templateId: "game-design-brief",
  }];
  const forward = qualityWorkflow.selectQualityProfiles({ selectionIndex, templateMap, requests });
  assert.throws(
    () => qualityWorkflow.selectQualityProfiles({ selectionIndex: { ...selectionIndex, profiles: [...selectionIndex.profiles].reverse() }, templateMap, requests }),
    /invalid selection index.*canonical/i,
  );
  assert.equal(forward[0].primaryProfileId, "game-design-brief");
  assert.deepEqual(forward[0].score, {
    templateMatch: 1, artifactTypeMatch: 1, formatMatch: 1, audienceOverlap: 1, goalOverlap: 3,
  });

  const audienceMutation = qualityWorkflow.selectQualityProfiles({ selectionIndex, templateMap, requests: [{
    artifactId: "review", goal: "metrics report", audience: ["analytics"],
    artifactType: "review-report", requestedFormat: "pdf",
  }] });
  assert.equal(audienceMutation[0].primaryProfileId, "playtest-metrics-report");
});

test("selector validates overrides, reports one nearest candidate, and splits multi-artifact requests", async () => {
  const studio = await loadCatalog("studio");
  const selected = qualityWorkflow.selectQualityProfiles({ selectionIndex: studio.selectionIndex, templateMap: studio.templateMap, requests: [{
    artifactId: "pitch", goal: "executive pitch", audience: ["EXECUTIVE"], artifactType: "presentation",
    requestedFormat: "PPTX", explicitPrimaryId: "EXECUTIVE_PITCH",
  }] });
  assert.equal(selected[0].primaryProfileId, "executive-pitch");
  assert.throws(() => qualityWorkflow.selectQualityProfiles({ selectionIndex: studio.selectionIndex, templateMap: studio.templateMap, requests: [{
    artifactId: "bad", goal: "pitch", audience: ["executive"], artifactType: "presentation",
    requestedFormat: "pptx", explicitPrimaryId: "master-gdd",
  }] }), /incompatible/i);

  const unknown = qualityWorkflow.selectQualityProfiles({ selectionIndex: studio.selectionIndex, templateMap: studio.templateMap, requests: [{
    artifactId: "unknown", goal: "executive pitch", audience: ["executive"], artifactType: "presentation",
    requestedFormat: "pptx", explicitPrimaryId: "executive-pich",
  }] });
  assert.equal(unknown[0].status, "fallback-required");
  assert.equal(unknown[0].primaryProfileId, null);
  assert.equal(unknown[0].fallbackRecord.nearestProfileId, "executive-pitch");

  const resolvedFallback = qualityWorkflow.selectQualityProfiles({ selectionIndex: studio.selectionIndex, templateMap: studio.templateMap, requests: [{
    artifactId: "unknown", goal: "executive pitch", audience: ["executive"], artifactType: "presentation",
    requestedFormat: "pptx", explicitPrimaryId: "executive-pich", fallbackPrimaryId: "executive-pitch",
  }] });
  assert.equal(resolvedFallback[0].status, "selected");
  assert.equal(resolvedFallback[0].primaryProfileId, "executive-pitch");
  assert.deepEqual(resolvedFallback[0].fallbackRecord, {
    requestedProfileId: "executive-pich",
    nearestProfileId: "executive-pitch",
    differences: unknown[0].fallbackRecord.differences,
    selectedFallbackProfileId: "executive-pitch",
  });

  const career = await loadCatalog("career");
  const split = qualityWorkflow.selectQualityProfiles({ selectionIndex: career.selectionIndex, templateMap: career.templateMap, requests: [
    { artifactId: "reverse-doc", goal: "reverse design", audience: ["designer"], artifactType: "career-document", requestedFormat: "docx", templateId: "reverse-design-document" },
    { artifactId: "interview-deck", goal: "recruiter portfolio", audience: ["recruiter"], artifactType: "presentation", requestedFormat: "pptx", templateId: "introduction-motivation" },
  ] });
  assert.equal(split.length, 2);
  assert.deepEqual(split.map(({ artifactId, primaryProfileId }) => [artifactId, primaryProfileId]), [
    ["reverse-doc", "reverse-design-document"],
    ["interview-deck", "recruiter-portfolio-presentation"],
  ]);
});

test("checklist derives stable acceptance IDs and leaves every required type pending inspection", async () => {
  assert.equal(typeof qualityWorkflow.buildQualityChecklist, "function");
  const primary = JSON.parse(await readFile(new URL(
    "../../shared/document-quality/profiles/studio/master-gdd.json",
    import.meta.url,
  ), "utf8"));
  const overlay = JSON.parse(await readFile(new URL(
    "../../shared/document-quality/overlays/mobile.json",
    import.meta.url,
  ), "utf8"));
  const preset = JSON.parse(await readFile(new URL(
    "../../shared/document-quality/presets/function-first.json",
    import.meta.url,
  ), "utf8"));
  const composed = composeQualityProfile({ primary, overlays: [overlay], referencePreset: preset });
  const checklist = qualityWorkflow.buildQualityChecklist(composed);
  assert.equal(checklist.acceptanceCriteria[0].id, "master-gdd-acceptance-71a953f23b813d8b");
  const inserted = structuredClone(composed);
  inserted.acceptanceCriterionSources.splice(0, 0, { sourceId: "test-source", text: "Inserted criterion." });
  assert.equal(
    qualityWorkflow.buildQualityChecklist(inserted).acceptanceCriteria[1].id,
    "master-gdd-acceptance-71a953f23b813d8b",
  );

  for (const key of ["sections", "tables", "diagrams", "images", "acceptanceCriteria"]) {
    assert.equal(checklist[key].some(({ required, status }) => required === true && status === "missing"), true, key);
  }
  assert.throws(() => qualityWorkflow.createStructuralCompletionEvidence(composed), /manifest|inspection|plain object/i);
});

test("document quality state evaluator enforces all five transitions and rejects automation as approval", async () => {
  assert.equal(typeof qualityWorkflow.transitionDocumentQualityState, "function");
  assert.throws(
    () => qualityWorkflow.transitionDocumentQualityState({ currentState: "draft", targetState: "structurally-complete" }),
    /currentState.*forbidden|state envelope/i,
  );
});

test("composition validates the primary and rejects contradictions introduced by each source", () => {
  const contradictoryPrimary = profile({ export_rules: { required_formats: ["pdf"], forbidden_formats: ["pdf"] } });
  assert.throws(() => composeQualityProfile({ primary: contradictoryPrimary }), /invalid primary quality profile.*export\.contradiction/i);

  assert.throws(
    () => composeQualityProfile({
      primary: profile({ export_rules: { required_formats: ["pdf"], forbidden_formats: [] } }),
      overlays: [{ profile_id: "no-pdf", export_rules: { forbidden_formats: ["pdf"] } }],
    }),
    /invalid composed quality profile.*no-pdf.*export\.contradiction/i,
  );
});

test("loads a validated profile only from a safe non-symlink profile path", async (t) => {
  const root = await mkdtemp(path.join(await realpath(tmpdir()), "quality-profile-test-"));
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

  await writeFile(path.join(profilesRoot, "mismatch.json"), `${JSON.stringify(profile(), null, 2)}\n`);
  await assert.rejects(
    () => loadQualityProfile({ pluginRoot: root, profileId: "mismatch" }),
    /profile id mismatch/i,
  );
});
