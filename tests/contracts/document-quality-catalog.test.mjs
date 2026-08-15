import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { composeQualityProfile } from "../../shared/scripts/resolve-quality-profile.mjs";
import { validateQualityProfile } from "../../shared/scripts/validate-quality-profile.mjs";
import { validateReferencePreset } from "../../shared/scripts/validate-reference-preset.mjs";
import {
  allStrings,
  findPolicyLeak,
  findPolicyLeakInBytes,
  parseNeutralPresetPolicy,
  readNeutralPresetPolicy,
} from "./neutral-preset-policy.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const qualityRoot = path.join(root, "shared/document-quality");
const presetIds = [
  "competitive-live-service",
  "replayable-coop",
  "evolving-world",
  "function-first",
  "player-validated-small-team",
  "cinematic-narrative",
  "ugc-production-tooling",
];
const presetFields = [
  "preset_id", "version", "emphasis", "review_questions", "recommended_diagrams",
  "story_hints", "additional_acceptance_criteria",
];
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
    "design-review-decision-log", "executive-pitch", "design-transfer-decision",
    "reference-comparison", "reference-system-analysis",
    "cutscene-visual-preproduction",
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

const supportedSchemaKeywords = new Set([
  "$schema", "$id", "title", "description", "$defs", "$ref", "type", "enum", "minimum",
  "required", "additionalProperties", "properties", "items", "minItems", "uniqueItems",
  "minLength", "pattern", "allOf", "if", "then", "contains", "minContains",
]);

function assertSupportedSchema(schema, seen = new Set()) {
  if (typeof schema === "boolean" || seen.has(schema)) return;
  if (schema === null || typeof schema !== "object" || Array.isArray(schema)) throw new Error("JSON Schema must be an object or boolean");
  seen.add(schema);
  for (const key of Object.keys(schema)) {
    if (!supportedSchemaKeywords.has(key)) throw new Error(`unsupported JSON Schema keyword: ${key}`);
  }
  for (const mapKey of ["$defs", "properties"]) {
    for (const child of Object.values(schema[mapKey] ?? {})) assertSupportedSchema(child, seen);
  }
  for (const childKey of ["additionalProperties", "items", "if", "then", "contains"]) {
    if (typeof schema[childKey] === "object") assertSupportedSchema(schema[childKey], seen);
  }
  for (const child of schema.allOf ?? []) assertSupportedSchema(child, seen);
}

function schemaAccepts(value, rootSchema, schema = rootSchema) {
  if (schema === rootSchema) assertSupportedSchema(rootSchema);
  if (typeof schema === "boolean") return schema;
  if (schema.$ref) {
    if (!schema.$ref.startsWith("#/")) throw new Error(`unsupported JSON Schema reference: ${schema.$ref}`);
    const target = schema.$ref.slice(2).split("/").reduce((current, segment) => current[segment.replaceAll("~1", "/").replaceAll("~0", "~")], rootSchema);
    return schemaAccepts(value, rootSchema, target);
  }
  if (schema.enum && !schema.enum.some((candidate) => JSON.stringify(candidate) === JSON.stringify(value))) return false;
  if (schema.allOf && !schema.allOf.every((part) => schemaAccepts(value, rootSchema, part))) return false;
  if (schema.if && schemaAccepts(value, rootSchema, schema.if) && schema.then && !schemaAccepts(value, rootSchema, schema.then)) return false;
  if (schema.type === "object") {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
    if ((schema.required ?? []).some((key) => !Object.hasOwn(value, key))) return false;
    if (schema.additionalProperties === false && Object.keys(value).some((key) => !Object.hasOwn(schema.properties ?? {}, key))) return false;
    return Object.entries(value).every(([key, child]) => {
      if (schema.properties?.[key]) return schemaAccepts(child, rootSchema, schema.properties[key]);
      if (schema.additionalProperties && typeof schema.additionalProperties === "object") return schemaAccepts(child, rootSchema, schema.additionalProperties);
      return true;
    });
  }
  if (schema.type === "array") {
    if (!Array.isArray(value) || value.length < (schema.minItems ?? 0)) return false;
    if (schema.uniqueItems && new Set(value.map((item) => JSON.stringify(item))).size !== value.length) return false;
    if (schema.contains) {
      const matches = value.filter((item) => schemaAccepts(item, rootSchema, schema.contains)).length;
      if (matches < (schema.minContains ?? 1)) return false;
    }
    return !schema.items || value.every((item) => schemaAccepts(item, rootSchema, schema.items));
  }
  if (schema.type === "string") {
    return typeof value === "string"
      && value.length >= (schema.minLength ?? 0)
      && (!schema.pattern || new RegExp(schema.pattern, "u").test(value));
  }
  if (schema.type === "integer") return Number.isInteger(value) && value >= (schema.minimum ?? Number.NEGATIVE_INFINITY);
  if (schema.type === "number") return typeof value === "number" && Number.isFinite(value) && value >= (schema.minimum ?? Number.NEGATIVE_INFINITY);
  if (schema.type === "boolean") return typeof value === "boolean";
  if (schema.type === "null") return value === null;
  if (schema.type !== undefined) throw new Error(`unsupported JSON Schema type: ${schema.type}`);
  return true;
}

test("reference preset schema evaluator honors enum, conditionals, contains, and unsupported-keyword failure", () => {
  assert.equal(schemaAccepts("a", { type: "string", enum: ["a"] }), true);
  assert.equal(schemaAccepts("b", { type: "string", enum: ["a"] }), false);
  assert.equal(schemaAccepts(["a", "b"], { type: "array", contains: { enum: ["a"] }, minContains: 1 }), true);
  assert.equal(schemaAccepts(["b"], { type: "array", contains: { enum: ["a"] }, minContains: 1 }), false);
  assert.equal(schemaAccepts({ enabled: true }, {
    type: "object",
    if: { type: "object", required: ["enabled"], properties: { enabled: { enum: [true] } } },
    then: { type: "object", required: ["value"] },
  }), false);
  assert.equal(schemaAccepts("https://example.invalid", { type: "string", pattern: "^https://" }), true);
  assert.equal(schemaAccepts("HTTPS://example.invalid", { type: "string", pattern: "^https://" }), false);
  assert.throws(() => schemaAccepts("a", { type: "string", unknownKeyword: true }), /unsupported JSON Schema keyword/);
  assert.throws(() => schemaAccepts("a", { type: "string", $defs: { unused: { unknownKeyword: true } } }), /unsupported JSON Schema keyword/);
});

test("authoring evidence policy rejects missing, duplicate, and non-NFC identity aliases", () => {
  const row = (label, alias) => `| [${label}](https://example.invalid/${label}) | ${alias} | principle | boundary | preset |`;
  assert.throws(() => parseNeutralPresetPolicy(row("one", "no structured alias")), /requires identity aliases/);
  assert.throws(() => parseNeutralPresetPolicy([
    row("one", "`Example Alias`"),
    row("two", "`example alias`"),
  ].join("\n")), /duplicate identity aliases/);
  assert.throws(() => parseNeutralPresetPolicy(row("one", "`Cafe\u0301`")), /must be NFC/);
  assert.throws(() => parseNeutralPresetPolicy(row("one", "` Leading`")), /must be trimmed/);
  assert.throws(() => parseNeutralPresetPolicy(row("one", "`Trailing `")), /must be trimmed/);
  assert.throws(() => parseNeutralPresetPolicy(row("one", "`   `")), /must be non-empty/);
});

test("authoring alias matching does not reject neutral words containing short aliases", async () => {
  const policy = await readNeutralPresetPolicy(root);
  for (const sentence of [
    "Supports player decisions",
    "The report supports iteration",
    "Population goals remain neutral",
  ]) {
    assert.equal(findPolicyLeak([sentence], policy), undefined, sentence);
  }
});

test("authoring alias matching uses Unicode letter and number token boundaries", () => {
  const policy = {
    evidenceFilename: "evidence.md",
    labels: ["Source Label"],
    urls: ["https://example.invalid/source"],
    aliases: ["RTS", "PoP", "Café"],
  };

  for (const text of ["Use RTS here.", "Review (pop), then continue.", "한국어(RTS) 문장", "Try CAFE\u0301!"]) {
    assert.ok(findPolicyLeak([text], policy), `expected alias boundary match: ${text}`);
    assert.ok(findPolicyLeakInBytes(Buffer.from(text), policy), `expected byte alias boundary match: ${text}`);
  }
  for (const text of ["supports", "report supports", "Population", "RTS2", "2RTS", "한국어RTS", "RTS전략"]) {
    assert.equal(findPolicyLeak([text], policy), undefined, `unexpected alias match: ${text}`);
    assert.equal(findPolicyLeakInBytes(Buffer.from(text), policy), undefined, `unexpected byte alias match: ${text}`);
  }

  assert.equal(findPolicyLeak(["prefix source labelsuffix"], policy), "Source Label", "full labels retain subsequence matching");
  assert.equal(findPolicyLeak(["see HTTPS://EXAMPLE.INVALID/SOURCE?view=1"], policy), policy.urls[0], "URLs retain folded subsequence matching");
});

test("neutral reference presets are closed, additive, schema-valid, and source-neutral", async () => {
  const schema = await json("schema/reference-preset.schema.json");
  const policy = await readNeutralPresetPolicy(root);
  assert.equal(policy.labels.length, 10);
  assert.equal(policy.urls.length, 10);
  assert.ok(policy.aliases.length >= 20);
  for (const reviewerExample of ["GDC", "Steam", "Overwatch", "Unreal Editor"]) {
    assert.ok(policy.aliases.includes(reviewerExample), `missing reviewer alias: ${reviewerExample}`);
  }
  const directory = path.join(qualityRoot, "presets");
  const filenames = (await readdir(directory)).filter((name) => name.endsWith(".json")).sort();
  assert.deepEqual(filenames, presetIds.map((id) => `${id}.json`).sort());
  assert.deepEqual(Object.keys(schema.properties), presetFields);
  assert.deepEqual(schema.required, presetFields);
  assert.equal(schema.additionalProperties, false);

  for (const id of presetIds) {
    const preset = await json(`presets/${id}.json`);
    assert.deepEqual(Object.keys(preset), presetFields, `${id}: exact additive fields`);
    assert.equal(preset.preset_id, id, `${id}: filename and preset ID`);
    assert.equal(schemaAccepts(preset, schema), true, `${id}: schema runtime`);
    assert.deepEqual(validateReferencePreset(preset), { ok: true, errors: [] }, `${id}: production runtime`);
    for (const field of presetFields.slice(2)) assert.ok(preset[field].length > 0, `${id}: non-empty ${field}`);

    assert.equal(findPolicyLeak(allStrings(preset), policy), undefined, `${id}: authoring identity gate`);
  }

  const valid = await json("presets/function-first.json");
  const unknownField = { ...valid, source_name: "example" };
  assert.equal(schemaAccepts(unknownField, schema), false, "unknown source field");
  assert.equal(schemaAccepts({ ...valid, preset_id: "not-approved" }, schema), false, "preset ID enum");
  const schemeSensitiveUrl = policy.urls.find((url) => !url.includes("www."));
  assert.ok(schemeSensitiveUrl, "evidence policy supplies a URL without a www prefix");
  for (const field of presetFields.slice(2)) {
    const identityCandidate = structuredClone(valid);
    identityCandidate[field][0] = policy.labels[0];
    assert.equal(schemaAccepts(identityCandidate, schema), true, `${field}: packaged schema stays identity-agnostic`);
    assert.equal(findPolicyLeak(allStrings(identityCandidate), policy), policy.labels[0], `${field}: authoring identity gate`);

    for (const alias of policy.aliases) {
      const aliasCandidate = structuredClone(valid);
      aliasCandidate[field][0] = alias;
      assert.equal(schemaAccepts(aliasCandidate, schema), true, `${field}: packaged schema stays alias-agnostic for ${alias}`);
      const detectedAlias = findPolicyLeak(allStrings(aliasCandidate), policy);
      assert.ok(detectedAlias && alias.toLowerCase().includes(detectedAlias.toLowerCase()), `${field}: authoring alias gate for ${alias}`);
    }

    for (const url of [schemeSensitiveUrl, schemeSensitiveUrl.replace(/^https:/u, "HTTPS:")]) {
      const urlCandidate = structuredClone(valid);
      urlCandidate[field][0] = url;
      assert.equal(schemaAccepts(urlCandidate, schema), false, `${field}: schema URL gate for ${url.slice(0, 8)}`);
    }
  }
  for (const [label, text] of [
    ["source logo reuse", "Reuse the source logo."],
    ["copied source layout", "Copy the original source layout."],
    ["reference image reuse", "Reuse the source image."],
  ]) assert.equal(schemaAccepts({ ...valid, story_hints: [text] }, schema), false, label);
  assert.equal(schemaAccepts({ ...valid, emphasis: [{ source_name: "example" }] }, schema), false, "nested source identity");
});

test("reference preset schema rejects URI forms in every additive string field with evaluator parity", async () => {
  const schema = await json("schema/reference-preset.schema.json");
  const valid = await json("presets/function-first.json");
  const standardPattern = new RegExp(schema.$defs.safeText.pattern, "u");
  const uriCases = [
    "https://example.invalid/preset",
    "ftp://example.invalid/preset",
    "mailto:designer@example.invalid",
    "data:text/plain,neutral-preset",
    "file:///tmp/neutral-preset",
    "//example.invalid/neutral-preset",
    "custom+scheme://example.invalid/neutral-preset",
    "www.example.invalid/preset",
    "Copy the original source layout.",
    "Reuse the source image.",
    "Source company citation must remain visible.",
    "Original project trademark and logo are required.",
  ];

  for (const field of presetFields.slice(2)) {
    for (const uri of uriCases) {
      const candidate = structuredClone(valid);
      candidate[field][0] = uri;
      assert.equal(standardPattern.test(uri), false, `${field}: standard pattern ${uri}`);
      assert.equal(schemaAccepts(candidate, schema), false, `${field}: evaluator ${uri}`);
      assert.equal(validateReferencePreset(candidate).ok, false, `${field}: production ${uri}`);
    }
  }
  const ordinaryText = "Project scope includes image readability.";
  assert.equal(standardPattern.test(ordinaryText), true);
  assert.equal(schemaAccepts({ ...valid, emphasis: [ordinaryText] }, schema), true);
});

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
