const stableIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const topLevelKeys = [
  "profile_id", "version", "artifact_types", "audiences", "required_sections", "required_tables",
  "required_diagrams", "required_images", "recommended_images", "length_guidance", "ppt_story_contract",
  "acceptance_criteria", "export_rules", "quality_checks",
];
const assetKeys = new Set(["id", "section_id", "title", "purpose", "alt_text", "columns"]);

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function add(errors, code, path, message) {
  errors.push({ code, path, message });
}

function validateClosedObject(value, allowed, path, errors) {
  if (!isObject(value)) {
    add(errors, "schema.type", path, "must be an object");
    return false;
  }
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) add(errors, "schema.additional_property", `${path}/${key}`, `unknown key: ${key}`);
  }
  return true;
}

function validateStringArray(value, path, errors, { nonEmpty = false, ids = false } = {}) {
  if (!Array.isArray(value)) {
    add(errors, "schema.type", path, "must be an array");
    return;
  }
  if (nonEmpty && value.length === 0) add(errors, "array.empty", path, "must not be empty");
  const seen = new Set();
  value.forEach((item, index) => {
    const itemPath = `${path}/${index}`;
    if (typeof item !== "string" || item.length === 0) add(errors, "schema.type", itemPath, "must be a non-empty string");
    else if (ids && !stableIdPattern.test(item)) add(errors, "id.invalid", itemPath, "must be a kebab-case stable ID");
    const key = typeof item === "string" ? item.normalize("NFC") : JSON.stringify(item);
    if (seen.has(key)) add(errors, "array.duplicate", itemPath, `duplicate value: ${String(item)}`);
    seen.add(key);
  });
}

function validateIdObjects(value, path, errors, { sectionIds, allowedKeys, requireTitle = false, nonEmpty = false } = {}) {
  if (!Array.isArray(value)) {
    add(errors, "schema.type", path, "must be an array");
    return new Set();
  }
  if (nonEmpty && value.length === 0) add(errors, "array.empty", path, "must not be empty");
  const ids = new Set();
  value.forEach((item, index) => {
    const itemPath = `${path}/${index}`;
    if (!validateClosedObject(item, allowedKeys, itemPath, errors)) return;
    if (typeof item.id !== "string" || !stableIdPattern.test(item.id)) add(errors, "id.invalid", `${itemPath}/id`, "must be a kebab-case stable ID");
    else if (ids.has(item.id)) add(errors, "id.duplicate", `${itemPath}/id`, `duplicate ID: ${item.id}`);
    else ids.add(item.id);
    if (requireTitle && (typeof item.title !== "string" || item.title.length === 0)) add(errors, "schema.required", `${itemPath}/title`, "must be a non-empty string");
    for (const key of ["title", "purpose", "alt_text"]) {
      if (Object.hasOwn(item, key) && (typeof item[key] !== "string" || item[key].length === 0)) {
        add(errors, "schema.type", `${itemPath}/${key}`, "must be a non-empty string");
      }
    }
    if (sectionIds && (typeof item.section_id !== "string" || !sectionIds.has(item.section_id))) {
      add(errors, "reference.unknown", `${itemPath}/section_id`, `unknown section ID: ${String(item.section_id)}`);
    }
    if (Object.hasOwn(item, "columns")) validateStringArray(item.columns, `${itemPath}/columns`, errors, { nonEmpty: true });
  });
  return ids;
}

function validateRange(value, minKey, maxKey, path, errors) {
  for (const key of [minKey, maxKey]) {
    if (Object.hasOwn(value, key) && (!Number.isInteger(value[key]) || value[key] < 0)) {
      add(errors, "schema.type", `${path}/${key}`, "must be a non-negative integer");
    }
  }
  if (Number.isInteger(value[minKey]) && Number.isInteger(value[maxKey]) && value[minKey] > value[maxKey]) {
    add(errors, "range.invalid", path, `${minKey} must not exceed ${maxKey}`);
  }
}

export function validateQualityProfile(value, { sourceName = "quality profile" } = {}) {
  const errors = [];
  if (!isObject(value)) {
    add(errors, "schema.type", "", `${sourceName} must be an object`);
    return { ok: false, errors };
  }
  const allowed = new Set(topLevelKeys);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) add(errors, "schema.additional_property", `/${key}`, `${sourceName} contains unknown key: ${key}`);
  }
  for (const key of topLevelKeys) {
    if (!Object.hasOwn(value, key)) add(errors, "schema.required", `/${key}`, `${sourceName} requires ${key}`);
  }
  if (typeof value.profile_id !== "string" || !stableIdPattern.test(value.profile_id)) add(errors, "id.invalid", "/profile_id", "must be a kebab-case stable ID");
  if (!Number.isInteger(value.version) || value.version < 1) add(errors, "version.invalid", "/version", "must be an integer of at least 1");
  validateStringArray(value.artifact_types, "/artifact_types", errors, { nonEmpty: true, ids: true });
  validateStringArray(value.audiences, "/audiences", errors, { nonEmpty: true, ids: true });
  const sectionIds = validateIdObjects(value.required_sections, "/required_sections", errors, {
    allowedKeys: new Set(["id", "title"]), requireTitle: true, nonEmpty: true,
  });
  validateIdObjects(value.required_tables, "/required_tables", errors, { allowedKeys: assetKeys, sectionIds, nonEmpty: true });
  const diagramIds = validateIdObjects(value.required_diagrams, "/required_diagrams", errors, { allowedKeys: assetKeys, sectionIds, nonEmpty: true });
  const imageIds = validateIdObjects(value.required_images, "/required_images", errors, { allowedKeys: assetKeys, sectionIds, nonEmpty: true });
  validateIdObjects(value.recommended_images, "/recommended_images", errors, { allowedKeys: assetKeys, sectionIds });

  if (validateClosedObject(value.length_guidance, new Set(["min_words", "max_words", "min_pages", "max_pages"]), "/length_guidance", errors)) {
    validateRange(value.length_guidance, "min_words", "max_words", "/length_guidance", errors);
    validateRange(value.length_guidance, "min_pages", "max_pages", "/length_guidance", errors);
  }

  const pptKeys = new Set([
    "min_slides", "max_slides", "required_diagram_ids", "required_image_ids", "story_rules",
    "audience_required", "decision_purpose_required", "one_message_per_slide", "required_slide_fields",
    "allowed_section_ids", "visual_bindings", "speaker_note_policy",
  ]);
  if (validateClosedObject(value.ppt_story_contract, pptKeys, "/ppt_story_contract", errors)) {
    validateRange(value.ppt_story_contract, "min_slides", "max_slides", "/ppt_story_contract", errors);
    for (const key of ["min_slides", "max_slides"]) {
      if (Number.isInteger(value.ppt_story_contract[key]) && value.ppt_story_contract[key] < 1) {
        add(errors, "story.slides", `/ppt_story_contract/${key}`, "must be at least 1");
      }
    }
    for (const [key, known] of [["required_diagram_ids", diagramIds], ["required_image_ids", imageIds]]) {
      if (Object.hasOwn(value.ppt_story_contract, key)) {
        validateStringArray(value.ppt_story_contract[key], `/ppt_story_contract/${key}`, errors, { ids: true });
      }
      if (Array.isArray(value.ppt_story_contract[key])) value.ppt_story_contract[key].forEach((id, index) => {
        if (typeof id === "string" && !known.has(id)) add(errors, "reference.unknown", `/ppt_story_contract/${key}/${index}`, `unknown slot ID: ${id}`);
      });
    }
    if (Object.hasOwn(value.ppt_story_contract, "story_rules")) {
      const rules = value.ppt_story_contract.story_rules;
      validateIdObjects(rules, "/ppt_story_contract/story_rules", errors, {
        allowedKeys: new Set(["id", "order", "section_id", "diagram_id", "image_id"]),
      });
      if (Array.isArray(rules)) {
        const orders = new Set();
        rules.forEach((rule, index) => {
          if (!isObject(rule)) return;
          if (!Number.isInteger(rule.order) || rule.order < 1) add(errors, "story.order", `/ppt_story_contract/story_rules/${index}/order`, "must be a positive integer");
          else if (orders.has(rule.order)) add(errors, "story.order_duplicate", `/ppt_story_contract/story_rules/${index}/order`, `duplicate order: ${rule.order}`);
          else orders.add(rule.order);
          for (const [key, known] of [["section_id", sectionIds], ["diagram_id", diagramIds], ["image_id", imageIds]]) {
            if (Object.hasOwn(rule, key) && !known.has(rule[key])) add(errors, "reference.unknown", `/ppt_story_contract/story_rules/${index}/${key}`, `unknown ${key}: ${String(rule[key])}`);
          }
        });
      }
    }
    const requiresPptPolicy = Array.isArray(value.export_rules?.required_formats)
      && value.export_rules.required_formats.includes("pptx");
    if (requiresPptPolicy) {
      const contract = value.ppt_story_contract;
      const policyFields = ["audience_required", "decision_purpose_required", "one_message_per_slide", "speaker_note_policy"];
      for (const field of policyFields) {
        if (!Object.hasOwn(contract, field)) add(errors, "story.policy_required", `/ppt_story_contract/${field}`, `PPTX profile requires ${field}`);
      }
      for (const field of ["audience_required", "decision_purpose_required", "one_message_per_slide"]) {
        if (Object.hasOwn(contract, field) && contract[field] !== true) add(errors, "story.policy", `/ppt_story_contract/${field}`, "must be true for PPTX profiles");
      }
      if (Object.hasOwn(contract, "speaker_note_policy") && contract.speaker_note_policy !== "required-for-every-slide") {
        add(errors, "story.policy", "/ppt_story_contract/speaker_note_policy", "must require speaker notes for every slide");
      }

      const requiredSlideFields = ["id", "title", "message", "purpose", "source_section_ids", "visual_slots", "speaker_notes_required"];
      if (!Object.hasOwn(contract, "required_slide_fields")) {
        add(errors, "story.policy_required", "/ppt_story_contract/required_slide_fields", "PPTX profile requires slide fields");
      } else {
        validateStringArray(contract.required_slide_fields, "/ppt_story_contract/required_slide_fields", errors, { nonEmpty: true });
        const actualFields = Array.isArray(contract.required_slide_fields) ? new Set(contract.required_slide_fields) : new Set();
        if (actualFields.size !== requiredSlideFields.length || requiredSlideFields.some((field) => !actualFields.has(field))) {
          add(errors, "story.slide_fields", "/ppt_story_contract/required_slide_fields", `must contain exactly: ${requiredSlideFields.join(", ")}`);
        }
      }

      if (!Object.hasOwn(contract, "allowed_section_ids")) {
        add(errors, "story.policy_required", "/ppt_story_contract/allowed_section_ids", "PPTX profile requires allowed section bindings");
      } else {
        validateStringArray(contract.allowed_section_ids, "/ppt_story_contract/allowed_section_ids", errors, { nonEmpty: true, ids: true });
        if (Array.isArray(contract.allowed_section_ids)) contract.allowed_section_ids.forEach((sectionId, index) => {
          if (typeof sectionId === "string" && !sectionIds.has(sectionId)) {
            add(errors, "reference.unknown", `/ppt_story_contract/allowed_section_ids/${index}`, `unknown section ID: ${sectionId}`);
          }
        });
      }

      const visualSections = new Map();
      for (const visual of [...(Array.isArray(value.required_diagrams) ? value.required_diagrams : []), ...(Array.isArray(value.required_images) ? value.required_images : [])]) {
        if (isObject(visual) && typeof visual.id === "string" && typeof visual.section_id === "string") visualSections.set(visual.id, visual.section_id);
      }
      if (!Object.hasOwn(contract, "visual_bindings")) {
        add(errors, "story.policy_required", "/ppt_story_contract/visual_bindings", "PPTX profile requires visual bindings");
      } else if (!Array.isArray(contract.visual_bindings)) {
        add(errors, "schema.type", "/ppt_story_contract/visual_bindings", "must be an array");
      } else {
        if (contract.visual_bindings.length === 0) add(errors, "array.empty", "/ppt_story_contract/visual_bindings", "must not be empty");
        const boundVisuals = new Set();
        contract.visual_bindings.forEach((binding, index) => {
          const bindingPath = `/ppt_story_contract/visual_bindings/${index}`;
          if (!validateClosedObject(binding, new Set(["visual_slot_id", "section_id"]), bindingPath, errors)) return;
          for (const field of ["visual_slot_id", "section_id"]) {
            if (typeof binding[field] !== "string" || !stableIdPattern.test(binding[field])) add(errors, "id.invalid", `${bindingPath}/${field}`, "must be a kebab-case stable ID");
          }
          if (typeof binding.visual_slot_id === "string") {
            if (!visualSections.has(binding.visual_slot_id)) add(errors, "reference.unknown", `${bindingPath}/visual_slot_id`, `unknown visual slot ID: ${binding.visual_slot_id}`);
            else {
              boundVisuals.add(binding.visual_slot_id);
              if (binding.section_id !== visualSections.get(binding.visual_slot_id)) {
                add(errors, "reference.mismatch", `${bindingPath}/section_id`, `visual slot ${binding.visual_slot_id} belongs to section ${visualSections.get(binding.visual_slot_id)}`);
              }
            }
          }
          if (typeof binding.section_id === "string" && !sectionIds.has(binding.section_id)) add(errors, "reference.unknown", `${bindingPath}/section_id`, `unknown section ID: ${binding.section_id}`);
          if (typeof binding.section_id === "string" && Array.isArray(contract.allowed_section_ids) && !contract.allowed_section_ids.includes(binding.section_id)) {
            add(errors, "story.section_not_allowed", `${bindingPath}/section_id`, `section is not allowed for slides: ${binding.section_id}`);
          }
        });
        for (const visualId of [...(Array.isArray(contract.required_diagram_ids) ? contract.required_diagram_ids : []), ...(Array.isArray(contract.required_image_ids) ? contract.required_image_ids : [])]) {
          if (typeof visualId === "string" && visualSections.has(visualId) && !boundVisuals.has(visualId)) {
            add(errors, "story.binding_required", "/ppt_story_contract/visual_bindings", `required visual slot lacks a binding: ${visualId}`);
          }
        }
      }
      if (!Array.isArray(value.artifact_types) || !value.artifact_types.includes("presentation")) {
        add(errors, "story.render_contract", "/artifact_types", "PPTX profile must use the presentation artifact type");
      }
    }
  }

  validateStringArray(value.acceptance_criteria, "/acceptance_criteria", errors, { nonEmpty: true });
  if (validateClosedObject(value.export_rules, new Set(["required_formats", "forbidden_formats"]), "/export_rules", errors)) {
    if (Object.hasOwn(value.export_rules, "required_formats")) {
      validateStringArray(value.export_rules.required_formats, "/export_rules/required_formats", errors, { ids: true });
    }
    if (Object.hasOwn(value.export_rules, "forbidden_formats")) {
      validateStringArray(value.export_rules.forbidden_formats, "/export_rules/forbidden_formats", errors, { ids: true });
    }
    const forbidden = new Set(Array.isArray(value.export_rules.forbidden_formats) ? value.export_rules.forbidden_formats : []);
    if (Array.isArray(value.export_rules.required_formats)) value.export_rules.required_formats.forEach((format, index) => {
      if (forbidden.has(format)) add(errors, "export.contradiction", `/export_rules/required_formats/${index}`, `format is both required and forbidden: ${format}`);
    });
  }
  validateStringArray(value.quality_checks, "/quality_checks", errors, { ids: true });

  errors.sort((left, right) => left.path.localeCompare(right.path) || left.code.localeCompare(right.code) || left.message.localeCompare(right.message));
  return { ok: errors.length === 0, errors };
}
