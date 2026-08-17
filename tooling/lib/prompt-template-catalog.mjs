import { readFile, realpath } from "node:fs/promises";

import { loadUseCaseManifest } from "./use-case-guides.mjs";
import { collectProductInventory, SOURCE_BOUND_MEMORY_SKILL_IDS, SOURCE_BOUND_REFERENCE_INTELLIGENCE_SKILL_IDS, SOURCE_BOUND_SUITE_UPDATE_SKILL_IDS } from "./user-guides.mjs";
import {
  assertNoSymlinkPath,
  assertUniqueNormalizedPaths,
  joinWithin,
  normalizeRelativePath,
} from "./paths.mjs";

export const PROMPT_LEVELS = Object.freeze(["beginner", "standard", "advanced"]);
export const PROMPT_KIND_COUNTS = Object.freeze({
  "skill-template": 105,
  "use-case": 36,
  recipe: 12,
  "suite-case": 8,
});

const PROMPT_KINDS = Object.freeze(Object.keys(PROMPT_KIND_COUNTS));
const PRODUCT_IDS = Object.freeze(["studio", "career", "suite"]);
const PRODUCT_NAMES = Object.freeze({
  studio: "Game Design Studio",
  career: "Game Design Career",
});
const PRODUCT_REPOSITORY_IDS = Object.freeze({
  studio: "game-design-studio",
  career: "game-design-career",
});
// These installed skills use source-bound product guides instead of the generic
// prompt-template catalog. They remain part of the package inventory, but
// deliberately have no generated prompt-template entries.
const BUNDLED_DEPENDENCY_SKILL_IDS = new Set([
  "archify",
  "humanize-korean",
  ...SOURCE_BOUND_MEMORY_SKILL_IDS,
  ...SOURCE_BOUND_REFERENCE_INTELLIGENCE_SKILL_IDS,
  // The upgrade skill changes an installation rather than producing a design artifact, so it has
  // no beginner, standard, or advanced prompt to template.
  ...SOURCE_BOUND_SUITE_UPDATE_SKILL_IDS,
]);
const ENTRY_KEYS = new Set([
  "id", "kind", "product", "title", "display_title", "sample_result_excerpt", "purpose", "audiences", "intents", "level",
  "source_case_id",
  "when_to_use", "when_not_to_use", "required_inputs", "optional_inputs", "placeholders",
  "app_prompt", "cli_prompt", "skill", "skill_chain", "specialist_roles",
  "intermediate_artifacts", "minimum_outputs", "optional_outputs", "extended_outputs",
  "expected_file_tree", "read_order", "human_review_boundary", "hold_conditions",
  "resume_prompt", "safety_boundary", "diagram_binding", "related_use_cases",
  "related_recipes", "source_references",
]);
const INDEX_KEYS = new Set(["version", "sources"]);
const SENSITIVE_CATEGORIES = Object.freeze([
  { name: "credentials", pattern: /(?:api[ _-]?keys?|secret(?:s)?|credential(?:s)?|password|access[ _-]?tokens?)/iu },
  { name: "personal data", pattern: /(?:personal(?:[ _-]?data|[ _-]?information)|개인\s*정보)/iu },
  { name: "private materials", pattern: /(?:private(?:[ _-]?(?:materials?|data|information))?|비공개\s*(?:자료|회사\s*자료))/iu },
]);
const DIRECT_PROHIBITION_START = /^(?:(?:do not|don't|never|must not)\s+(?:request|ask(?:\s+for)?|require|provide|enter|share|submit|upload|paste|use|collect|input|store|process|disclose|reveal|give)|not request|not required|not needed|금지|요청하지|입력하지|제공하지|불필요|요구하지 않음|입력하지 않음)\s+/iu;
const DIRECT_PROHIBITION_SUFFIX = /(?:not required|not needed|prohibited|금지|요청하지 않음|입력하지 않음|제공하지 않음|불필요)/iu;
const POSITIVE_INPUT_REQUEST = /(?:request|ask(?:\s+for)?|require|provide|share|enter|submit|upload|paste|input|give|disclose|reveal|제공|공유|입력|업로드)\s+(?:(?:your|the)\s+)?/iu;
const CLI_MENTION = /\$(game-design-studio|game-design-career):([a-z-]+)/gu;

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isNonemptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function entryLabel(index) {
  return `prompt template entry[${index}]`;
}

function requireString(value, label, errors) {
  if (!isNonemptyString(value)) errors.push(`${label} must be a non-empty string`);
}

function textClauses(value) {
  return value.split(/[.;!?。！？\n]+/u).map((clause) => clause.trim()).filter(Boolean);
}

function isPureSensitiveCategoryList(value) {
  let remainder = value;
  for (const category of SENSITIVE_CATEGORIES) {
    remainder = remainder.replace(new RegExp(category.pattern.source, "giu"), "§");
  }
  return /^[\s,]*(?:§)(?:[\s,]*(?:and|or)?[\s,]*§)*[\s,]*$/iu.test(remainder);
}

function clauseProhibitsCategory(clause, category) {
  if (!category.pattern.test(clause)) return false;
  const prohibition = DIRECT_PROHIBITION_START.exec(clause);
  const target = prohibition ? clause.slice(prohibition[0].length).trim() : "";
  const directTarget = target.replace(/^(?:your|the)\s+/iu, "");
  const prohibitedAfter = new RegExp(
    `${category.pattern.source}(?:\\s+(?:is|are|was|were|은|는|이|가))?\\s+${DIRECT_PROHIBITION_SUFFIX.source}(?:$|[\\s,])`,
    "iu",
  );
  const withoutCategory = new RegExp(`\\bwithout\\s+(?:any\\s+)?${category.pattern.source}`, "iu");
  const KoreanExplicitListProhibition = /^(?<list>.+?)(?:을|를)?\s*(?:요청(?:·공개)?하지 않는다|입력하지 않는다)$/u;
  const koreanMatch = KoreanExplicitListProhibition.exec(clause);
  const koreanList = typeof koreanMatch?.groups?.list === "string"
    ? SENSITIVE_CATEGORIES.reduce(
      (value, item) => value.replace(new RegExp(item.pattern.source, "giu"), "§"),
      koreanMatch.groups.list.replace(/\(PII\)/giu, "").replace(/회사\s*자산/gu, "§"),
    )
    : undefined;
  const koreanPureList = koreanList !== undefined
    && /^[\s,·]*(?:§)(?:[\s,·]*(?:또는|및|and|or)?[\s,·]*§)*[\s,·]*$/iu.test(koreanList);
  const koreanDirectCategoryProhibition = koreanCategoryOccurrencesAreExplicitlyProhibited(clause, category);
  return (
    (prohibition !== null && isPureSensitiveCategoryList(directTarget))
    || prohibitedAfter.test(clause)
    || withoutCategory.test(clause)
    || koreanPureList
    || koreanDirectCategoryProhibition
  );
}

function clauseIsPureSensitiveInputProhibition(clause) {
  const prohibition = DIRECT_PROHIBITION_START.exec(clause);
  if (prohibition !== null) {
    const target = clause.slice(prohibition[0].length).trim().replace(/^(?:your|the)\s+/iu, "");
    return isPureSensitiveCategoryList(target);
  }
  return SENSITIVE_CATEGORIES.some((category) => new RegExp(
    `^${category.pattern.source}(?:\\s+(?:is|are|was|were|은|는|이|가))?\\s+${DIRECT_PROHIBITION_SUFFIX.source}$`,
    "iu",
  ).test(clause));
}

function koreanCategoryTail(clause, category) {
  const match = new RegExp(category.pattern.source, "iu").exec(clause);
  return match ? clause.slice(match.index + match[0].length) : undefined;
}

function koreanCategoryHasExplicitProhibition(tail) {
  if (typeof tail !== "string") return false;
  const negative = /(?:요청(?:·공개)?|제공|입력|공유|업로드|전달|제출|알려|기입)(?:하지\s*(?:(?:마|말)(?:라|세요|고)?|않는다)|\s*금지|하면\s*안\s*된다)/u.exec(tail);
  if (!negative) return false;
  return !/(?:제공|입력|공유|업로드|요청|전달|제출|알려|기입)/u.test(tail.slice(negative.index + negative[0].length));
}

function koreanCategoryHasPositiveRequest(tail) {
  if (typeof tail !== "string" || koreanCategoryHasExplicitProhibition(tail)) return false;
  return /(?:을|를|은|는|이|가)?(?:\s+[\p{L}\p{N}-]+){0,4}\s*(?:제공|입력|공유|업로드|요청|전달|제출|알려|기입)/u.test(tail);
}

function koreanSensitiveOccurrences(clause) {
  return SENSITIVE_CATEGORIES.flatMap((category) => {
    const pattern = new RegExp(category.pattern.source, "giu");
    return [...clause.matchAll(pattern)].map((match) => ({
      category,
      start: match.index,
      end: match.index + match[0].length,
    }));
  }).sort((left, right) => left.start - right.start);
}

function koreanCategoryOccurrencesAreExplicitlyProhibited(clause, category) {
  const occurrences = koreanSensitiveOccurrences(clause);
  const matching = occurrences.filter((occurrence) => occurrence.category === category);
  if (matching.length === 0) return false;
  const explicitlyProhibited = matching.every((occurrence) => {
    const index = occurrences.indexOf(occurrence);
    return koreanCategoryHasExplicitProhibition(clause.slice(occurrence.end, occurrences[index + 1]?.start));
  });
  if (explicitlyProhibited) return true;
  if (koreanSensitiveInputHasPositiveRequest(clause)) return false;
  return matching.every((occurrence) => {
    const index = occurrences.indexOf(occurrence);
    return occurrences.slice(index).some((later) => {
      const laterIndex = occurrences.indexOf(later);
      return koreanCategoryHasExplicitProhibition(clause.slice(later.end, occurrences[laterIndex + 1]?.start));
    });
  });
}

function koreanSensitiveInputHasPositiveRequest(clause) {
  const occurrences = koreanSensitiveOccurrences(clause);
  return occurrences.some((occurrence, index) => {
    const next = occurrences[index + 1];
    return koreanCategoryHasPositiveRequest(clause.slice(occurrence.end, next?.start));
  });
}

function requestsSensitiveInput(value) {
  if (!isNonemptyString(value)) return false;
  return textClauses(value).some((clause) => {
    const requestsInput = SENSITIVE_CATEGORIES.some((category) => new RegExp(
      `${POSITIVE_INPUT_REQUEST.source}${category.pattern.source}`,
      "iu",
    ).test(clause));
    const koreanPositiveRequest = koreanSensitiveInputHasPositiveRequest(clause);
    return (requestsInput && !clauseIsPureSensitiveInputProhibition(clause)) || koreanPositiveRequest;
  });
}

function missingSafetyProhibitions(value) {
  if (!isNonemptyString(value)) return SENSITIVE_CATEGORIES.map(({ name }) => name);
  const clauses = textClauses(value);
  return SENSITIVE_CATEGORIES
    .filter((category) => !clauses.some((clause) => clauseProhibitsCategory(clause, category)))
    .map(({ name }) => name);
}

function validateStringArray(value, label, errors, { nonempty = true, safePaths = false } = {}) {
  if (!Array.isArray(value)) {
    errors.push(`${label} must be an array`);
    return;
  }
  if (nonempty && value.length === 0) errors.push(`${label} must not be empty`);
  const seen = new Set();
  for (const item of value) {
    if (!isNonemptyString(item)) {
      errors.push(`${label} must contain only non-empty strings`);
      continue;
    }
    const normalized = item.normalize("NFC");
    if (seen.has(normalized)) errors.push(`${label} has duplicate normalized value: ${normalized}`);
    seen.add(normalized);
    if (safePaths) {
      try {
        normalizeRelativePath(item, label);
      } catch {
        errors.push(`${label} has unsafe path: ${item}`);
      }
    }
  }
}

function validatePromptPair(value, label, errors, texts) {
  if (!isObject(value)) {
    errors.push(`${label} must be an object`);
    return;
  }
  for (const key of Object.keys(value)) {
    if (key !== "example" && key !== "template") errors.push(`${label} has unknown field: ${key}`);
  }
  for (const field of ["example", "template"]) {
    const prompt = value[field];
    requireString(prompt, `${label}.${field}`, errors);
    if (!isNonemptyString(prompt)) continue;
    const normalized = prompt.normalize("NFC");
    if (texts.has(normalized)) errors.push(`duplicate prompt text: ${label}.${field}`);
    texts.add(normalized);
    if (requestsSensitiveInput(prompt)) errors.push(`${label}.${field} must not request credentials or personal/private data`);
  }
}

function validateDiagramBinding(value, label, errors) {
  if (!isObject(value)) {
    errors.push(`${label} must be an object`);
    return;
  }
  const allowed = new Set(["id", "svg", "png", "html", "alt"]);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) errors.push(`${label} has unknown field: ${key}`);
  }
  requireString(value.id, `${label}.id`, errors);
  requireString(value.alt, `${label}.alt`, errors);
  for (const field of ["svg", "png"]) {
    requireString(value[field], `${label}.${field}`, errors);
    if (!isNonemptyString(value[field])) continue;
    try {
      normalizeRelativePath(value[field], `${label}.${field}`);
    } catch {
      errors.push(`${label}.${field} has unsafe path: ${value[field]}`);
    }
  }
  if (value.html !== undefined) {
    requireString(value.html, `${label}.html`, errors);
    if (isNonemptyString(value.html)) {
      try {
        normalizeRelativePath(value.html, `${label}.html`);
        if (!value.html.startsWith("guides/assets/archify/") || !value.html.endsWith(".html")) {
          errors.push(`${label}.html must be a managed Archify HTML path`);
        }
      } catch {
        errors.push(`${label}.html has unsafe path: ${value.html}`);
      }
    }
  }
}

function validateEntry(entry, index, errors, ids, texts) {
  const label = entryLabel(index);
  if (!isObject(entry)) {
    errors.push(`${label} must be an object`);
    return;
  }
  for (const key of Object.keys(entry)) {
    if (!ENTRY_KEYS.has(key)) errors.push(`${label} has unknown prompt template field: ${key}`);
  }
  requireString(entry.id, `${label}.id`, errors);
  if (isNonemptyString(entry.id)) {
    const id = entry.id.normalize("NFC");
    if (ids.has(id)) errors.push(`duplicate prompt template id: ${id}`);
    ids.add(id);
  }
  if (!PROMPT_KINDS.includes(entry.kind)) errors.push(`${label}.kind is unknown: ${String(entry.kind)}`);
  if (entry.kind === "use-case") {
    requireString(entry.source_case_id, `${label}.source_case_id`, errors);
  } else if (Object.hasOwn(entry, "source_case_id")) {
    errors.push(`${label}.source_case_id is allowed only for use-case entries`);
  }
  if (!PRODUCT_IDS.includes(entry.product)) errors.push(`${label}.product is unknown: ${String(entry.product)}`);
  if (entry.kind === "skill-template" && entry.product === "suite") {
    errors.push(`${label}.suite product cannot define a skill-template`);
  }
  requireString(entry.title, `${label}.title`, errors);
  requireString(entry.display_title, `${label}.display_title`, errors);
  requireString(entry.sample_result_excerpt, `${label}.sample_result_excerpt`, errors);
  if (isNonemptyString(entry.display_title) && !/[가-힣]/u.test(entry.display_title)) errors.push(`${label}.display_title must be Korean-first`);
  if (isNonemptyString(entry.sample_result_excerpt)) {
    const expectedPath = entry.expected_file_tree?.[0];
    if (!/[가-힣]/u.test(entry.sample_result_excerpt) || !entry.sample_result_excerpt.includes(entry.id) || !isNonemptyString(expectedPath) || !entry.sample_result_excerpt.includes(expectedPath)) {
      errors.push(`${label}.sample_result_excerpt must be a Korean source-bound example`);
    }
    if (/\b(?:target player|pillar|tutorial skip\/revisit|ordered rule|content purpose)\b/iu.test(entry.sample_result_excerpt)
      || /\b[A-Za-z][A-Za-z /-]*(?:을|를|은|는|이|가)\b/u.test(entry.sample_result_excerpt)
      || /\s예:\s*`/u.test(entry.sample_result_excerpt)) {
      errors.push(`${label}.sample_result_excerpt must not use an English-first particle or repeated example skeleton`);
    }
  }
  requireString(entry.purpose, `${label}.purpose`, errors);
  for (const field of ["audiences", "intents", "required_inputs", "intermediate_artifacts", "minimum_outputs", "expected_file_tree", "read_order", "hold_conditions", "source_references"]) {
    validateStringArray(entry[field], `${label}.${field}`, errors, {
      safePaths: ["expected_file_tree", "read_order", "source_references"].includes(field),
    });
  }
  for (const field of ["optional_inputs", "placeholders", "optional_outputs", "extended_outputs", "related_use_cases", "related_recipes"]) {
    validateStringArray(entry[field], `${label}.${field}`, errors, { nonempty: false });
  }
  for (const field of ["when_to_use", "when_not_to_use", "skill", "human_review_boundary", "resume_prompt", "safety_boundary"]) {
    requireString(entry[field], `${label}.${field}`, errors);
  }
  if (!PROMPT_LEVELS.includes(entry.level)) errors.push(`${label}.level is unknown: ${String(entry.level)}`);
  validatePromptPair(entry.app_prompt, `${label}.app_prompt`, errors, texts);
  validatePromptPair(entry.cli_prompt, `${label}.cli_prompt`, errors, texts);
  validateStringArray(entry.skill_chain, `${label}.skill_chain`, errors);
  validateStringArray(entry.specialist_roles, `${label}.specialist_roles`, errors);
  validateDiagramBinding(entry.diagram_binding, `${label}.diagram_binding`, errors);
  if (isNonemptyString(entry.resume_prompt)) {
    const normalized = entry.resume_prompt.normalize("NFC");
    if (texts.has(normalized)) errors.push(`duplicate prompt text: ${label}.resume_prompt`);
    texts.add(normalized);
    if (requestsSensitiveInput(entry.resume_prompt)) {
      errors.push(`${label}.resume_prompt must not request credentials or personal/private data`);
    }
  }
  if (!isNonemptyString(entry.safety_boundary) || !entry.safety_boundary.includes("미정")) {
    errors.push(`${label}.safety_boundary must preserve unknown information as 미정`);
  }
  if (requestsSensitiveInput(entry.safety_boundary)) {
    errors.push(`${label}.safety_boundary must not request credentials or personal/private data`);
  }
  for (const category of missingSafetyProhibitions(entry.safety_boundary)) {
    errors.push(`${label}.safety_boundary must explicitly prohibit ${category} requests`);
  }
  for (const [field, values] of Object.entries({
    required_inputs: entry.required_inputs,
    optional_inputs: entry.optional_inputs,
    placeholders: entry.placeholders,
  })) {
    if (Array.isArray(values) && values.some(requestsSensitiveInput)) {
      errors.push(`${label}.${field} must not request credentials or personal/private data`);
    }
  }
}

function countEntries(entries) {
  const byKind = Object.fromEntries(PROMPT_KINDS.map((kind) => [kind, 0]));
  for (const entry of entries) if (isObject(entry) && PROMPT_KINDS.includes(entry.kind)) byKind[entry.kind] += 1;
  const total = entries.length;
  return {
    skillTemplates: byKind["skill-template"],
    useCases: byKind["use-case"],
    recipes: byKind.recipe,
    suiteCases: byKind["suite-case"],
    total,
    appPrompts: total,
    cliPrompts: total,
  };
}

function inventoryFor(inventories, product) {
  if (!(inventories instanceof Map) || product === "suite") return undefined;
  return inventories.get(product) ?? inventories.get(PRODUCT_REPOSITORY_IDS[product]);
}

function rolesFor(rolesByProduct, product) {
  if (!(rolesByProduct instanceof Map) || product === "suite") return undefined;
  return rolesByProduct.get(product) ?? rolesByProduct.get(PRODUCT_REPOSITORY_IDS[product]);
}

function productForCliNamespace(namespace) {
  return namespace === "game-design-studio" ? "studio" : "career";
}

function validateAppPromptPath(value, label, product, errors) {
  const allowedApps = product === "suite" ? Object.values(PRODUCT_NAMES) : [PRODUCT_NAMES[product]];
  if (!allowedApps.some((app) => value.includes(`@${app}`))) {
    errors.push(`${product} App prompt ${label} must mention an allowed product App`);
  }
}

function validateCliPromptPath(value, label, product, inventories, errors) {
  const mentions = [...value.matchAll(CLI_MENTION)];
  if (mentions.length === 0) {
    errors.push(`${product} CLI prompt ${label} must contain a product namespace command`);
    return;
  }
  for (const [, namespace, skill] of mentions) {
    const targetProduct = productForCliNamespace(namespace);
    if (product !== "suite" && targetProduct !== product) {
      errors.push(`${product} CLI prompt ${label} must use the ${product} namespace`);
      continue;
    }
    if (!skill) {
      errors.push(`${product} CLI prompt ${label} must name a registered skill`);
      continue;
    }
    const inventory = inventoryFor(inventories, targetProduct);
    if (inventory && !inventory.skillIds.includes(skill)) {
      errors.push(`unknown ${targetProduct} CLI skill in ${label}: ${skill}`);
    }
  }
}

function validatePromptPaths(entry, label, inventories, errors) {
  for (const field of ["example", "template"]) {
    if (isNonemptyString(entry.app_prompt?.[field])) {
      validateAppPromptPath(entry.app_prompt[field], `${label}.app_prompt.${field}`, entry.product, errors);
    }
    if (isNonemptyString(entry.cli_prompt?.[field])) {
      validateCliPromptPath(entry.cli_prompt[field], `${label}.cli_prompt.${field}`, entry.product, inventories, errors);
    }
  }
}

function validateSuiteReferences(entry, label, inventories, rolesByProduct, errors) {
  if (!(inventories instanceof Map)) return;
  const installedSkills = new Set(
    ["studio", "career"].flatMap((product) => inventoryFor(inventories, product)?.skillIds ?? []),
  );
  for (const skill of [entry.skill, ...(Array.isArray(entry.skill_chain) ? entry.skill_chain : [])]) {
    if (isNonemptyString(skill) && !installedSkills.has(skill)) errors.push(`${label} references unknown suite skill: ${skill}`);
  }
  if (!(rolesByProduct instanceof Map)) return;
  const installedRoles = new Set(
    ["studio", "career"].flatMap((product) => [...(rolesFor(rolesByProduct, product) ?? [])]),
  );
  for (const role of Array.isArray(entry.specialist_roles) ? entry.specialist_roles : []) {
    if (isNonemptyString(role) && !installedRoles.has(role)) errors.push(`${label} references unknown suite role: ${role}`);
  }
}

function validateReferences(entries, inventories, useCaseManifest, rolesByProduct, errors) {
  const manifestIds = useCaseManifest && isObject(useCaseManifest)
    ? new Set([
      ...(Array.isArray(useCaseManifest.audience_paths) ? useCaseManifest.audience_paths : []),
      ...(Array.isArray(useCaseManifest.cases) ? useCaseManifest.cases : []),
      ...(Array.isArray(useCaseManifest.skill_cases) ? useCaseManifest.skill_cases : []),
    ].map((entry) => entry?.id).filter(isNonemptyString))
    : undefined;
  const manifestCases = useCaseManifest && isObject(useCaseManifest)
    ? new Map((Array.isArray(useCaseManifest.cases) ? useCaseManifest.cases : [])
      .filter((entry) => isObject(entry) && isNonemptyString(entry.id))
      .map((entry) => [entry.id, entry]))
    : undefined;
  for (const [index, entry] of entries.entries()) {
    if (!isObject(entry) || !PRODUCT_IDS.includes(entry.product)) continue;
    const label = entryLabel(index);
    validatePromptPaths(entry, label, inventories, errors);
    if (entry.kind === "use-case" && manifestCases) {
      const sourceCase = manifestCases.get(entry.source_case_id);
      if (!sourceCase) {
        errors.push(`${label}.source_case_id references an unknown source case: ${String(entry.source_case_id)}`);
      } else if (sourceCase.product !== PRODUCT_REPOSITORY_IDS[entry.product]) {
        errors.push(`${label}.source_case_id product must match the entry product`);
      }
    }
    if (entry.product === "suite") {
      validateSuiteReferences(entry, label, inventories, rolesByProduct, errors);
      continue;
    }
    const inventory = inventoryFor(inventories, entry.product);
    if (inventory) {
      const skillIds = new Set(inventory.skillIds);
      for (const skill of [entry.skill, ...(Array.isArray(entry.skill_chain) ? entry.skill_chain : [])]) {
        if (isNonemptyString(skill) && !skillIds.has(skill)) errors.push(`${label} references unknown ${entry.product} skill: ${skill}`);
      }
      const templateIds = new Set(inventory.templateIds);
      for (const templateId of Array.isArray(entry.intermediate_artifacts) ? entry.intermediate_artifacts : []) {
        if (isNonemptyString(templateId) && !templateIds.has(templateId)) {
          errors.push(`${label} references unknown ${entry.product} template: ${templateId}`);
        }
      }
    }
    const roles = rolesFor(rolesByProduct, entry.product);
    if (roles) {
      for (const role of Array.isArray(entry.specialist_roles) ? entry.specialist_roles : []) {
        if (isNonemptyString(role) && !roles.has(role)) errors.push(`${label} references unknown ${entry.product} role: ${role}`);
      }
    }
    if (manifestIds) {
      for (const id of Array.isArray(entry.related_use_cases) ? entry.related_use_cases : []) {
        if (isNonemptyString(id) && !manifestIds.has(id)) errors.push(`${label} references unknown use case: ${id}`);
      }
    }
  }
}

function validateCompleteCounts(counts, errors) {
  const actual = {
    "skill-template": counts.skillTemplates,
    "use-case": counts.useCases,
    recipe: counts.recipes,
    "suite-case": counts.suiteCases,
  };
  for (const [kind, expected] of Object.entries(PROMPT_KIND_COUNTS)) {
    if (actual[kind] !== expected) errors.push(`complete prompt catalog requires ${kind}=${expected}, found ${actual[kind]}`);
  }
}

function validateSkillTemplateCardinality(entries, inventories, errors) {
  if (!(inventories instanceof Map)) {
    errors.push("complete prompt catalog requires product inventories");
    return;
  }
  for (const product of ["studio", "career"]) {
    const inventory = inventoryFor(inventories, product);
    if (!inventory || !Array.isArray(inventory.skillIds)) {
      errors.push(`complete prompt catalog requires ${product} skill inventory`);
      continue;
    }
    for (const skill of inventory.skillIds.filter((skill) => !BUNDLED_DEPENDENCY_SKILL_IDS.has(skill))) {
      for (const level of PROMPT_LEVELS) {
        const count = entries.filter((entry) => (
          entry?.kind === "skill-template"
          && entry.product === product
          && entry.skill === skill
          && entry.level === level
        )).length;
        if (count !== 1) {
          errors.push(`skill-template cardinality ${product}/${skill}/${level} must be exactly one, found ${count}`);
        }
      }
    }
  }
}

export function validatePromptTemplateCatalog({ entries, inventories, useCaseManifest, rolesByProduct, requireComplete = false } = {}) {
  const errors = [];
  if (!Array.isArray(entries)) {
    return { ok: false, errors: ["prompt template catalog entries must be an array"], counts: countEntries([]) };
  }
  const ids = new Set();
  const texts = new Set();
  entries.forEach((entry, index) => validateEntry(entry, index, errors, ids, texts));
  validateReferences(entries, inventories, useCaseManifest, rolesByProduct, errors);
  const counts = countEntries(entries);
  if (requireComplete) {
    validateCompleteCounts(counts, errors);
    validateSkillTemplateCardinality(entries, inventories, errors);
  }
  return { ok: errors.length === 0, errors, counts };
}

function validateIndex(index) {
  if (!isObject(index)) throw new Error("prompt catalog index must be an object");
  for (const key of Object.keys(index)) {
    if (!INDEX_KEYS.has(key)) throw new Error(`unknown prompt catalog index field: ${key}`);
  }
  if (index.version !== 1) throw new Error("prompt catalog index version must be 1");
  if (!Array.isArray(index.sources) || index.sources.length === 0) throw new Error("prompt catalog index sources must be a non-empty array");
  return assertUniqueNormalizedPaths(index.sources, "prompt catalog sources");
}

async function assertCatalogPath(root, relative, label) {
  try {
    return await assertNoSymlinkPath(root, relative, label);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Symlink is not allowed")) {
      throw new Error(error.message.replace("Symlink", "symlink"), { cause: error });
    }
    throw error;
  }
}

async function loadRoleIds(root, product) {
  const repositoryId = PRODUCT_REPOSITORY_IDS[product];
  const relative = `products/${repositoryId}/plugin/references/routing.json`;
  await assertCatalogPath(root, relative, `${product} role registry`);
  const parsed = JSON.parse(await readFile(joinWithin(root, relative), "utf8"));
  if (!isObject(parsed) || !Array.isArray(parsed.roleIds) || !Array.isArray(parsed.imageSpecialistIds)) {
    throw new Error(`invalid ${product} role registry`);
  }
  return new Set([...parsed.roleIds, ...parsed.imageSpecialistIds]);
}

async function loadValidationReferences(root) {
  const [studioInventory, careerInventory, useCaseManifest, studioRoles, careerRoles] = await Promise.all([
    collectProductInventory(root, PRODUCT_REPOSITORY_IDS.studio),
    collectProductInventory(root, PRODUCT_REPOSITORY_IDS.career),
    loadUseCaseManifest({ repoRoot: root }),
    loadRoleIds(root, "studio"),
    loadRoleIds(root, "career"),
  ]);
  return {
    inventories: new Map([["studio", studioInventory], ["career", careerInventory]]),
    useCaseManifest,
    rolesByProduct: new Map([["studio", studioRoles], ["career", careerRoles]]),
  };
}

export async function loadPromptTemplateCatalog({ repoRoot } = {}) {
  const root = await realpath(repoRoot);
  const indexRelative = "guides/prompt-templates/catalog.json";
  await assertCatalogPath(root, indexRelative, "prompt catalog index");
  let index;
  try {
    index = JSON.parse(await readFile(joinWithin(root, indexRelative), "utf8"));
  } catch (error) {
    throw new Error(`invalid prompt catalog index JSON: ${error.message}`, { cause: error });
  }
  const sources = validateIndex(index);
  const entries = [];
  for (const source of sources) {
    if (!source.startsWith("catalog/")) throw new Error("prompt catalog source must stay under catalog/");
    const relative = `guides/prompt-templates/${source}`;
    await assertCatalogPath(root, relative, "prompt catalog shard");
    let shard;
    try {
      shard = JSON.parse(await readFile(joinWithin(root, relative), "utf8"));
    } catch (error) {
      throw new Error(`invalid prompt catalog shard JSON: ${error.message}`, { cause: error });
    }
    if (!Array.isArray(shard)) throw new Error("prompt catalog shard must be an array");
    entries.push(...shard);
  }
  const shapeResult = validatePromptTemplateCatalog({ entries });
  if (!shapeResult.ok) throw new Error(shapeResult.errors.join("\n"));
  const references = await loadValidationReferences(root);
  const result = validatePromptTemplateCatalog({ entries, ...references, requireComplete: true });
  if (!result.ok) throw new Error(result.errors.join("\n"));
  return { entries, byId: new Map(entries.map((entry) => [entry.id, entry])), counts: result.counts };
}

export function productPromptProjection(catalog, productId) {
  const product = productId === "game-design-studio" ? "studio" : productId === "game-design-career" ? "career" : productId;
  if (product !== "studio" && product !== "career") throw new Error(`unknown prompt catalog product: ${String(productId)}`);
  if (!catalog || !Array.isArray(catalog.entries)) throw new Error("prompt catalog must contain an entries array");
  // A packaged product must stay self-contained. Suite examples remain in the
  // repository-wide guide library; copying them into each package would embed
  // sibling product commands and fail the package isolation contract.
  return catalog.entries.filter((entry) => entry.product === product);
}
