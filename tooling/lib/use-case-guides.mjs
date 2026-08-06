import { lstat, readFile, realpath } from "node:fs/promises";
import path from "node:path";

export const USE_CASE_EXPECTED_COUNTS = Object.freeze({
  audiencePaths: 6,
  studioCases: 18,
  careerCases: 18,
  studioSkillCases: 15,
  careerSkillCases: 15,
});

const PRODUCT_IDS = new Set(["game-design-studio", "game-design-career"]);

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isNonemptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isSafeRelativePath(value) {
  if (!isNonemptyString(value)) return false;
  if (path.isAbsolute(value) || path.posix.isAbsolute(value) || path.win32.isAbsolute(value)) return false;
  return !value.split(/[\\/]+/).includes("..");
}

function entries(manifest) {
  return [
    ...manifest.audience_paths.map((entry, index) => ({ entry, label: `audience_paths[${index}]`, kind: "audience" })),
    ...manifest.cases.map((entry, index) => ({ entry, label: `cases[${index}]`, kind: "case" })),
    ...manifest.skill_cases.map((entry, index) => ({ entry, label: `skill_cases[${index}]`, kind: "skill" })),
  ];
}

function validateNonemptyString(entry, field, label, errors) {
  if (!isNonemptyString(entry[field])) errors.push(`${label}.${field} must be a nonempty string`);
}

function validateStringArray(entry, field, label, errors) {
  if (!Array.isArray(entry[field])) {
    errors.push(`${label}.${field} must be an array`);
    return;
  }
  if (entry[field].some((value) => !isNonemptyString(value))) {
    errors.push(`${label}.${field} must contain only nonempty strings`);
  }
}

function validatePath(value, label, errors) {
  if (!isSafeRelativePath(value)) errors.push(`${label} has unsafe path: ${value}`);
}

function validateDiagram(entry, label, errors) {
  if (!isObject(entry.diagram)) {
    errors.push(`${label}.diagram must be an object`);
    return;
  }
  for (const field of ["svg", "png"]) validatePath(entry.diagram[field], `${label}.diagram.${field}`, errors);
  validateNonemptyString(entry.diagram, "alt", `${label}.diagram`, errors);
}

function validateCommonFields(entry, label, errors) {
  validateNonemptyString(entry, "id", label, errors);
  validatePath(entry.document, `${label}.document`, errors);
  validateNonemptyString(entry, "anchor", label, errors);
  validateDiagram(entry, label, errors);
}

function validateProduct(entry, label, errors) {
  if (!PRODUCT_IDS.has(entry.product)) errors.push(`${label}.product is unknown: ${entry.product}`);
}

function validateAudienceEntry(entry, label, errors) {
  validateCommonFields(entry, label, errors);
  validateNonemptyString(entry, "slug", label, errors);
  validateNonemptyString(entry, "level", label, errors);
  validateStringArray(entry, "recommended_views", label, errors);
  validateStringArray(entry, "outputs", label, errors);
}

function validateCaseEntry(entry, label, errors) {
  validateCommonFields(entry, label, errors);
  validateProduct(entry, label, errors);
  validateNonemptyString(entry, "view", label, errors);
  for (const field of ["audiences", "level", "skills", "templates", "outputs"]) {
    validateStringArray(entry, field, label, errors);
  }
}

function validateSkillCaseEntry(entry, label, errors) {
  validateCommonFields(entry, label, errors);
  validateProduct(entry, label, errors);
  validateNonemptyString(entry, "skill", label, errors);
  for (const field of ["outputs", "next_skills"]) validateStringArray(entry, field, label, errors);
}

function validateEntryShapes(manifest, errors) {
  for (const { entry, label, kind } of entries(manifest)) {
    if (!isObject(entry)) {
      errors.push(`${label} must be an object`);
      continue;
    }
    if (kind === "audience") validateAudienceEntry(entry, label, errors);
    if (kind === "case") validateCaseEntry(entry, label, errors);
    if (kind === "skill") validateSkillCaseEntry(entry, label, errors);
  }
}

function validateUniqueIds(manifest, errors) {
  const ids = new Set();
  const anchors = new Set();
  for (const { entry, label } of entries(manifest)) {
    if (!isObject(entry)) continue;
    if (!isNonemptyString(entry.id)) {
      errors.push(`${label}.id must be a nonempty string`);
    } else if (ids.has(entry.id)) {
      errors.push(`${label} has duplicate id: ${entry.id}`);
    } else {
      ids.add(entry.id);
    }
    if (isNonemptyString(entry.anchor)) {
      if (anchors.has(entry.anchor)) errors.push(`${label} has duplicate anchor: ${entry.anchor}`);
      else anchors.add(entry.anchor);
    }
  }
}

function validateCatalogBindings(manifest, inventories, errors) {
  for (const { entry, label, kind } of entries(manifest)) {
    if (!isObject(entry) || !PRODUCT_IDS.has(entry.product)) continue;
    const inventory = inventories.get(entry.product);
    if (!inventory || !Array.isArray(inventory.skillIds) || !Array.isArray(inventory.templateIds)) {
      errors.push(`${label} has no usable inventory for product: ${entry.product}`);
      continue;
    }
    const skillIds = kind === "case"
      ? entry.skills
      : kind === "skill"
        ? [entry.skill, ...(Array.isArray(entry.next_skills) ? entry.next_skills : [])]
        : [];
    for (const skillId of skillIds) {
      if (isNonemptyString(skillId) && !inventory.skillIds.includes(skillId)) {
        errors.push(`${label} references unknown ${entry.product} skill: ${skillId}`);
      }
    }
    if (kind === "case" && Array.isArray(entry.templates)) {
      for (const templateId of entry.templates) {
        if (isNonemptyString(templateId) && !inventory.templateIds.includes(templateId)) {
          errors.push(`${label} references unknown ${entry.product} template: ${templateId}`);
        }
      }
    }
  }
}

function countEntries(manifest) {
  const countProduct = (list, product) => list.filter((entry) => entry?.product === product).length;
  return {
    audiencePaths: manifest.audience_paths.length,
    studioCases: countProduct(manifest.cases, "game-design-studio"),
    careerCases: countProduct(manifest.cases, "game-design-career"),
    studioSkillCases: countProduct(manifest.skill_cases, "game-design-studio"),
    careerSkillCases: countProduct(manifest.skill_cases, "game-design-career"),
  };
}

function validateCompleteCounts(counts, errors) {
  for (const [field, expected] of Object.entries(USE_CASE_EXPECTED_COUNTS)) {
    if (counts[field] !== expected) {
      errors.push(`complete manifest requires ${field}=${expected}, found ${counts[field]}`);
    }
  }
}

function isContained(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

async function assertRegularContainedFile(repoRoot, filename) {
  if (!isContained(repoRoot, filename)) throw new Error("path escapes repository");
  let current = repoRoot;
  for (const part of path.relative(repoRoot, filename).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    const entry = await lstat(current);
    if (entry.isSymbolicLink()) throw new Error("symlinked path is not allowed");
  }
  const entry = await lstat(filename);
  if (!entry.isFile() || entry.isSymbolicLink()) throw new Error(`expected regular file: ${filename}`);
}

export async function loadUseCaseManifest({ repoRoot }) {
  const resolvedRoot = await realpath(repoRoot);
  const manifestPath = path.join(resolvedRoot, "guides/use-cases/use-case-manifest.json");
  await assertRegularContainedFile(resolvedRoot, manifestPath);
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  if (!isObject(manifest)) throw new Error("use-case manifest must be an object");
  if (manifest.version !== 1) throw new Error("use-case manifest version must be 1");
  for (const field of ["audience_paths", "cases", "skill_cases"]) {
    if (!Array.isArray(manifest[field])) throw new Error("use-case manifest field must be an array: " + field);
  }
  return manifest;
}

export async function validateUseCaseGuides({ repoRoot, requireComplete = false, inventories }) {
  const errors = [];
  const manifest = await loadUseCaseManifest({ repoRoot });
  const counts = countEntries(manifest);
  validateUniqueIds(manifest, errors);
  validateEntryShapes(manifest, errors);
  if (inventories) validateCatalogBindings(manifest, inventories, errors);
  if (requireComplete) validateCompleteCounts(counts, errors);
  return { ok: errors.length === 0, errors, counts };
}
