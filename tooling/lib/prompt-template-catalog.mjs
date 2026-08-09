import { readFile, realpath } from "node:fs/promises";

import { loadUseCaseManifest } from "./use-case-guides.mjs";
import { collectProductInventory } from "./user-guides.mjs";
import {
  assertNoSymlinkPath,
  assertUniqueNormalizedPaths,
  joinWithin,
  normalizeRelativePath,
} from "./paths.mjs";

export const PROMPT_LEVELS = Object.freeze(["beginner", "standard", "advanced"]);
export const PROMPT_KIND_COUNTS = Object.freeze({
  "skill-template": 90,
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
const PRODUCT_CLI_NAMESPACES = Object.freeze({
  studio: "$game-design-studio:",
  career: "$game-design-career:",
});
const PRODUCT_REPOSITORY_IDS = Object.freeze({
  studio: "game-design-studio",
  career: "game-design-career",
});
const ENTRY_KEYS = new Set([
  "id", "kind", "product", "title", "purpose", "audiences", "intents", "level",
  "when_to_use", "when_not_to_use", "required_inputs", "optional_inputs", "placeholders",
  "app_prompt", "cli_prompt", "skill", "skill_chain", "specialist_roles",
  "intermediate_artifacts", "minimum_outputs", "optional_outputs", "extended_outputs",
  "expected_file_tree", "read_order", "human_review_boundary", "hold_conditions",
  "resume_prompt", "safety_boundary", "diagram_binding", "related_use_cases",
  "related_recipes", "source_references",
]);
const INDEX_KEYS = new Set(["version", "sources"]);
const SENSITIVE_INPUT = /(?:api[ _-]?key|secret(?:s)?|password|access[ _-]?token|personal(?:[ _-]?data|[ _-]?information)|개인\s*정보|비공개\s*(?:자료|회사\s*자료))/iu;

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
    if (SENSITIVE_INPUT.test(prompt)) errors.push(`${label}.${field} must not request credentials or personal/private data`);
  }
}

function validateDiagramBinding(value, label, errors) {
  if (!isObject(value)) {
    errors.push(`${label} must be an object`);
    return;
  }
  const allowed = new Set(["id", "svg", "png", "alt"]);
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
  if (!PRODUCT_IDS.includes(entry.product)) errors.push(`${label}.product is unknown: ${String(entry.product)}`);
  requireString(entry.title, `${label}.title`, errors);
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
  }
  for (const [field, values] of Object.entries({
    required_inputs: entry.required_inputs,
    optional_inputs: entry.optional_inputs,
    placeholders: entry.placeholders,
  })) {
    if (Array.isArray(values) && values.some((value) => isNonemptyString(value) && SENSITIVE_INPUT.test(value))) {
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

function validateReferences(entries, inventories, useCaseManifest, rolesByProduct, errors) {
  const manifestIds = useCaseManifest && isObject(useCaseManifest)
    ? new Set([
      ...(Array.isArray(useCaseManifest.audience_paths) ? useCaseManifest.audience_paths : []),
      ...(Array.isArray(useCaseManifest.cases) ? useCaseManifest.cases : []),
      ...(Array.isArray(useCaseManifest.skill_cases) ? useCaseManifest.skill_cases : []),
    ].map((entry) => entry?.id).filter(isNonemptyString))
    : undefined;
  for (const [index, entry] of entries.entries()) {
    if (!isObject(entry) || !PRODUCT_IDS.includes(entry.product)) continue;
    const label = entryLabel(index);
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
    if (entry.product !== "suite" && isObject(entry.app_prompt) && isObject(entry.cli_prompt)) {
      const expectedApp = `@${PRODUCT_NAMES[entry.product]}`;
      const expectedCli = PRODUCT_CLI_NAMESPACES[entry.product];
      for (const field of ["example", "template"]) {
        if (isNonemptyString(entry.app_prompt[field]) && !entry.app_prompt[field].includes(expectedApp)) {
          errors.push(`${label}.app_prompt.${field} must use ${expectedApp}`);
        }
        if (isNonemptyString(entry.cli_prompt[field]) && !entry.cli_prompt[field].includes(expectedCli)) {
          errors.push(`${label}.cli_prompt.${field} must use ${expectedCli}`);
        }
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
  if (requireComplete) validateCompleteCounts(counts, errors);
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
  return catalog.entries.filter((entry) => entry.product === product || entry.product === "suite");
}
