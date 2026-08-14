import { lstat, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import {
  collectMarkdownHeadings,
  scanVisibleMarkdown,
} from "./markdown-visibility.mjs";

export const USE_CASE_EXPECTED_COUNTS = Object.freeze({
  audiencePaths: 6,
  studioCases: 18,
  careerCases: 18,
  studioSkillCases: 15,
  careerSkillCases: 15,
});
const MINIMUM_FAQ_COUNT = 50;
const FAQ_PATHS = Object.freeze([
  "guides/use-cases/README.md",
  "guides/game-design-studio/faq.md",
  "guides/game-design-career/faq.md",
]);
const DIAGRAM_EXPECTED_SCOPE_COUNTS = Object.freeze({
  shared: 6,
  "game-design-studio": 6,
  "game-design-career": 6,
  "use-case-audience": 6,
  "game-design-studio-use-case": 18,
  "game-design-studio-skill": 15,
  "game-design-career-use-case": 18,
  "game-design-career-skill": 15,
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

function parseVisibleMarkdown(markdown) {
  const lines = scanVisibleMarkdown(markdown);
  const headings = collectMarkdownHeadings(markdown).map(({ anchor, level, line, label }) => ({
    anchor,
    level,
    lineIndex: lines.findIndex((candidate) => candidate.line === line),
    text: label,
  }));
  const sections = new Map(headings.map((heading, index) => {
    const next = headings.slice(index + 1).find((candidate) => candidate.level <= heading.level);
    return [heading.anchor, lines.slice(heading.lineIndex, next?.lineIndex ?? lines.length).map(({ text }) => text).join("\n")];
  }));
  return {
    headings,
    headingsByAnchor: new Map(headings.map((heading) => [heading.anchor, heading])),
    sections,
  };
}

function ownerSection(parsed, anchor, kind) {
  if (kind !== "skill") return parsed.sections.get(anchor);
  const anchorHeading = parsed.headingsByAnchor.get(anchor);
  if (!anchorHeading) return undefined;
  const anchorIndex = parsed.headings.indexOf(anchorHeading);
  const rootIndex = parsed.headings.findIndex((heading) => heading.level === 1);
  if (rootIndex === -1 || anchorIndex <= rootIndex) return undefined;
  const nextRoot = parsed.headings.slice(rootIndex + 1).find((heading) => heading.level === 1);
  if (nextRoot && anchorHeading.lineIndex >= nextRoot.lineIndex) return undefined;
  return parsed.sections.get(parsed.headings[rootIndex].anchor);
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
      ? (Array.isArray(entry.skills) ? entry.skills : [])
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
  if (counts.faq < MINIMUM_FAQ_COUNT) {
    errors.push(`complete guides require faq>=${MINIMUM_FAQ_COUNT}, found ${counts.faq}`);
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

function declaredTargetPaths(manifest) {
  return entries(manifest).flatMap(({ entry, label }) => {
    if (!isObject(entry)) return [];
    const targets = [{ field: "document", value: entry.document }];
    if (isObject(entry.diagram)) {
      targets.push(
        { field: "diagram.svg", value: entry.diagram.svg },
        { field: "diagram.png", value: entry.diagram.png },
      );
    }
    return targets
      .filter(({ value }) => isSafeRelativePath(value))
      .map(({ field, value }) => ({ label: `${label}.${field}`, value }));
  });
}

async function validateDeclaredTargets(repoRoot, manifest, errors) {
  for (const target of declaredTargetPaths(manifest)) {
    const filename = path.resolve(repoRoot, target.value);
    try {
      await assertRegularContainedFile(repoRoot, filename);
    } catch (error) {
      errors.push(`${target.label} must be an existing regular non-symlink file: ${target.value} (${error.message})`);
    }
  }
}

async function validateDocumentContracts(repoRoot, manifest, errors) {
  const cache = new Map();
  const requestMarkers = {
    audience: { app: /^\*\*App 요청:\*\*/mu, cli: /^\*\*CLI 요청:\*\*/mu },
    case: { app: /^### Codex App 요청문$/mu, cli: /^### Codex CLI 요청문$/mu },
    skill: { app: /^## Codex App 요청 예시$/mu, cli: /^## Codex CLI 요청 예시$/mu },
  };
  for (const { entry, label, kind } of entries(manifest)) {
    if (!isObject(entry) || !isSafeRelativePath(entry.document) || !isNonemptyString(entry.anchor)) continue;
    const filename = path.resolve(repoRoot, entry.document);
    try {
      if (!cache.has(filename)) {
        const markdown = await readFile(filename, "utf8");
        cache.set(filename, parseVisibleMarkdown(markdown));
      }
      const section = ownerSection(cache.get(filename), entry.anchor, kind);
      if (!section) {
        errors.push(`${label}.anchor is missing from ${entry.document}: ${entry.anchor}`);
        continue;
      }
      if (!requestMarkers[kind].app.test(section)) {
        errors.push(`${label} document is missing its App request marker: ${entry.document}#${entry.anchor}`);
      }
      if (!requestMarkers[kind].cli.test(section)) {
        errors.push(`${label} document is missing its CLI request marker: ${entry.document}#${entry.anchor}`);
      }
    } catch (error) {
      errors.push(`${label}.document could not be read for anchor and request validation: ${entry.document} (${error.message})`);
    }
  }
}

async function countFaqHeadings(repoRoot, errors) {
  let count = 0;
  for (const relativePath of FAQ_PATHS) {
    const filename = path.resolve(repoRoot, relativePath);
    try {
      await assertRegularContainedFile(repoRoot, filename);
      const markdown = await readFile(filename, "utf8");
      count += scanVisibleMarkdown(markdown).filter(
        ({ text }) => /^ {0,3}###\s+Q\d{2}\.\s+\S.+$/u.test(text),
      ).length;
    } catch (error) {
      errors.push(`FAQ source must be an existing regular non-symlink file: ${relativePath} (${error.message})`);
    }
  }
  return count;
}

async function validateDiagramManifestBindings(repoRoot, manifest, errors) {
  const relativePath = "guides/assets/diagram-manifest.json";
  const filename = path.resolve(repoRoot, relativePath);
  let diagramManifest;
  try {
    await assertRegularContainedFile(repoRoot, filename);
    diagramManifest = JSON.parse(await readFile(filename, "utf8"));
  } catch (error) {
    errors.push(`diagram manifest must be an existing regular non-symlink JSON file: ${relativePath} (${error.message})`);
    return;
  }
  if (!isObject(diagramManifest) || !Array.isArray(diagramManifest.diagrams)) {
    errors.push("diagram manifest diagrams must be an array");
    return;
  }

  const diagramsById = new Map();
  const scopeCounts = new Map();
  for (const [index, diagram] of diagramManifest.diagrams.entries()) {
    const label = `diagram-manifest.diagrams[${index}]`;
    if (!isObject(diagram) || !isNonemptyString(diagram.id)) {
      errors.push(`${label}.id must be a nonempty string`);
      continue;
    }
    if (diagramsById.has(diagram.id)) errors.push(`${label} has duplicate id: ${diagram.id}`);
    else diagramsById.set(diagram.id, diagram);
    if (isNonemptyString(diagram.scope)) {
      scopeCounts.set(diagram.scope, (scopeCounts.get(diagram.scope) ?? 0) + 1);
    }
  }
  const expectedTotal = Object.values(DIAGRAM_EXPECTED_SCOPE_COUNTS).reduce((total, count) => total + count, 0);
  if (diagramManifest.diagrams.length !== expectedTotal) {
    errors.push(`complete diagram manifest requires diagrams=${expectedTotal}, found ${diagramManifest.diagrams.length}`);
  }
  for (const [scope, expected] of Object.entries(DIAGRAM_EXPECTED_SCOPE_COUNTS)) {
    const actual = scopeCounts.get(scope) ?? 0;
    if (actual !== expected) errors.push(`complete diagram manifest requires scope ${scope}=${expected}, found ${actual}`);
  }
  for (const [scope, actual] of scopeCounts) {
    if (!(scope in DIAGRAM_EXPECTED_SCOPE_COUNTS)) {
      errors.push(`complete diagram manifest has unknown scope ${scope}=${actual}`);
    }
  }

  for (const { entry, label, kind } of entries(manifest)) {
    if (!isObject(entry) || !isNonemptyString(entry.id) || !isObject(entry.diagram)) continue;
    const diagram = diagramsById.get(entry.id.toLowerCase());
    if (!diagram) {
      errors.push(`${label}.diagram has no diagram manifest entry for id: ${entry.id.toLowerCase()}`);
      continue;
    }
    const expectedScope = kind === "audience"
      ? "use-case-audience"
      : `${entry.product}-${kind === "case" ? "use-case" : "skill"}`;
    if (diagram.scope !== expectedScope) {
      errors.push(`${label}.diagram scope does not match: expected ${expectedScope}, found ${diagram.scope}`);
    }
    for (const field of ["svg", "png"]) {
      const declaredPath = entry.diagram[field]?.replace(/^guides\/assets\//u, "");
      if (declaredPath !== diagram[field]) {
        errors.push(`${label}.diagram.${field} does not match diagram manifest: expected ${diagram[field]}, found ${declaredPath}`);
      }
    }
    if (entry.diagram.alt !== diagram.alt) {
      errors.push(`${label}.diagram.alt does not match diagram manifest`);
    }
  }
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

export async function validateUseCaseGuides({ repoRoot, requireComplete = false, validateTargets = requireComplete, inventories }) {
  const errors = [];
  const manifest = await loadUseCaseManifest({ repoRoot });
  const counts = countEntries(manifest);
  validateEntryShapes(manifest, errors);
  const shapesAreValid = errors.length === 0;
  validateUniqueIds(manifest, errors);
  if (validateTargets && shapesAreValid) await validateDeclaredTargets(await realpath(repoRoot), manifest, errors);
  const hasInventories = inventories instanceof Map;
  if (requireComplete && !hasInventories) errors.push("complete validation requires inventories Map");
  if (hasInventories) validateCatalogBindings(manifest, inventories, errors);
  if (requireComplete) {
    const resolvedRoot = await realpath(repoRoot);
    if (shapesAreValid) {
      await validateDocumentContracts(resolvedRoot, manifest, errors);
      await validateDiagramManifestBindings(resolvedRoot, manifest, errors);
    }
    counts.faq = await countFaqHeadings(resolvedRoot, errors);
    validateCompleteCounts(counts, errors);
  }
  return {
    ok: errors.length === 0,
    errors,
    counts,
    targetValidation: validateTargets ? "required" : "deferred",
    deferredTargetPaths: validateTargets ? [] : declaredTargetPaths(manifest).map(({ value }) => value),
  };
}
