import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { canonicalJson } from "./reference-intelligence-canonical.mjs";

const overlayDomains = Object.freeze([
  ["genre", "genreIds"],
  ["play-mode", "playModeIds"],
  ["platform", "platformIds"],
  ["business-model", "businessModelIds"],
]);
const applicabilityRank = Object.freeze({
  unknown: 0,
  conditional: 1,
  optional: 2,
  "required-candidate": 3,
});
const allowedApplicability = new Set([...Object.keys(applicabilityRank), "not-applicable"]);

function fail(code = "invalid") {
  const error = new Error("reference atlas is invalid");
  error.code = `reference-atlas.${code}`;
  throw error;
}

function byteCompare(left, right) {
  return Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}

function canonicalCopy(value) {
  try {
    return JSON.parse(canonicalJson(value));
  } catch {
    fail();
  }
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function dataField(value, key) {
  if (!isRecord(value)) return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor && Object.hasOwn(descriptor, "value") ? descriptor.value : undefined;
}

function nonEmptyText(value) {
  return typeof value === "string" && value.length > 0;
}

function sortedByUtf8(values) {
  return values.every((value, index) => index === 0 || byteCompare(values[index - 1], value) < 0);
}

function validateQuestion(question, systemIds) {
  if (!isRecord(question)
    || !nonEmptyText(question.questionId)
    || !nonEmptyText(question.systemId)
    || !allowedApplicability.has(question.applicability)
    || !nonEmptyText(question.rationale)
    || !Array.isArray(question.conditions)
    || !Array.isArray(question.verificationPrompts)
    || !question.conditions.every(nonEmptyText)
    || !question.verificationPrompts.every(nonEmptyText)) fail();
  if (systemIds.size > 0 && !systemIds.has(question.systemId)) fail("unknown-system");
}

function validateOverlayList(overlays, systemIds) {
  if (!Array.isArray(overlays)) fail();
  const overlayIds = new Set();
  for (const overlay of overlays) {
    if (!isRecord(overlay) || !nonEmptyText(overlay.overlayId) || !Array.isArray(overlay.questions)) fail();
    if (overlayIds.has(overlay.overlayId)) fail("duplicate-overlay");
    overlayIds.add(overlay.overlayId);
    const questionIds = overlay.questions.map(({ questionId } = {}) => questionId);
    if (!questionIds.every(nonEmptyText)) fail("overlay-order");
    if (new Set(questionIds).size !== questionIds.length) fail("duplicate-question");
    if (!sortedByUtf8(questionIds)) fail("overlay-order");
    const pairs = new Set();
    for (const question of overlay.questions) {
      validateQuestion(question, systemIds);
      const pair = `${overlay.overlayId}\u0000${question.questionId}`;
      if (pairs.has(pair)) fail("duplicate-question");
      pairs.add(pair);
    }
  }
}

function validateAtlas(atlas) {
  if (!isRecord(atlas) || !Array.isArray(atlas.questions) || !isRecord(atlas.overlays)) fail();
  const systems = Array.isArray(atlas.systems) ? atlas.systems : [];
  const systemIds = new Set();
  for (const system of systems) {
    if (!isRecord(system) || !nonEmptyText(system.systemId) || !nonEmptyText(system.name) || systemIds.has(system.systemId)) fail();
    systemIds.add(system.systemId);
  }
  const questionIds = atlas.questions.map(({ questionId } = {}) => questionId);
  if (!questionIds.every(nonEmptyText) || !sortedByUtf8(questionIds) || new Set(questionIds).size !== questionIds.length) fail("question-order");
  for (const question of atlas.questions) validateQuestion(question, systemIds);
  for (const [domain] of overlayDomains) validateOverlayList(atlas.overlays[domain], systemIds);
  return systemIds;
}

function selectOverlays(overlays, ids) {
  if (!Array.isArray(ids)) fail("invalid-selection");
  if (!ids.every(nonEmptyText)) fail("invalid-selection");
  const sortedIds = [...ids].sort(byteCompare);
  if (new Set(sortedIds).size !== sortedIds.length) fail("duplicate-overlay");
  const byId = new Map(overlays.map((overlay) => [overlay.overlayId, overlay]));
  return sortedIds.map((id) => {
    const overlay = byId.get(id);
    if (!overlay) fail("unknown-overlay");
    return overlay;
  });
}

function sortedUniqueText(values) {
  return [...new Set(values)].sort(byteCompare);
}

function mergeQuestion(questionId, questions) {
  const systemIds = new Set(questions.map(({ systemId }) => systemId));
  if (systemIds.size !== 1) fail("conflicting-system");
  const applicable = questions.filter(({ applicability }) => applicability !== "not-applicable");
  let applicability;
  if (applicable.length === 0) {
    applicability = "not-applicable";
  } else if (questions.length !== applicable.length && questions.some((question) => question.applicability === "not-applicable" && question.conditions.length === 0)) {
    applicability = "unknown";
  } else {
    applicability = applicable.reduce((mostCautious, question) => (
      applicabilityRank[question.applicability] < applicabilityRank[mostCautious] ? question.applicability : mostCautious
    ), applicable[0].applicability);
  }
  return {
    questionId,
    systemId: questions[0].systemId,
    applicability,
    rationale: sortedUniqueText(questions.map(({ rationale }) => rationale)).join(" "),
    conditions: sortedUniqueText(questions.flatMap(({ conditions }) => conditions)),
    verificationPrompts: sortedUniqueText(questions.flatMap(({ verificationPrompts }) => verificationPrompts)),
  };
}

/**
 * Merges the common Atlas with selected overlay questions using bytewise ordering and cautious applicability.
 */
export function mergeSystemAtlas(selection = {}) {
  const copy = canonicalCopy(selection);
  if (!isRecord(copy)) fail("invalid-selection");
  validateAtlas(copy.atlas);
  const questions = [...copy.atlas.questions];
  for (const [domain, selectionKey] of overlayDomains) {
    for (const overlay of selectOverlays(copy.atlas.overlays[domain], copy[selectionKey] ?? [])) questions.push(...overlay.questions);
  }
  const byQuestionId = new Map();
  for (const question of questions) {
    const group = byQuestionId.get(question.questionId) ?? [];
    group.push(question);
    byQuestionId.set(question.questionId, group);
  }
  return [...byQuestionId.entries()]
    .map(([questionId, values]) => mergeQuestion(questionId, values))
    .sort((left, right) => byteCompare(left.questionId, right.questionId));
}

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    fail("catalog-load");
  }
}

function moduleRootPath(moduleRoot) {
  if (moduleRoot === undefined) return fileURLToPath(new URL("../../reference-intelligence/", import.meta.url));
  try {
    return moduleRoot instanceof URL ? fileURLToPath(moduleRoot) : String(moduleRoot);
  } catch {
    fail("catalog-load");
  }
}

/**
 * Loads only bundled JSON. Optional sources are catalogued without network access, so offline use remains available.
 */
export async function loadBundledReferenceCatalog(input = {}) {
  const moduleRoot = dataField(input, "moduleRoot");
  const root = moduleRootPath(moduleRoot);
  const [base, genre, playMode, platform, businessModel, sourceRegister] = await Promise.all([
    readJson(`${root}/catalog/system-atlas.json`),
    readJson(`${root}/catalog/overlays/genre.json`),
    readJson(`${root}/catalog/overlays/play-mode.json`),
    readJson(`${root}/catalog/overlays/platform.json`),
    readJson(`${root}/catalog/overlays/business-model.json`),
    readJson(`${root}/catalog/source-register.json`),
  ]);
  if (!isRecord(sourceRegister) || !Array.isArray(sourceRegister.sources)) fail("catalog-load");
  const sourceIds = new Set();
  for (const source of sourceRegister.sources) {
    if (!isRecord(source) || !nonEmptyText(source.id) || !nonEmptyText(source.url) || source.required !== false || sourceIds.has(source.id)) fail("catalog-load");
    sourceIds.add(source.id);
  }
  const atlas = canonicalCopy({
    ...base,
    overlays: {
      genre: genre.overlays,
      "play-mode": playMode.overlays,
      platform: platform.overlays,
      "business-model": businessModel.overlays,
    },
  });
  validateAtlas(atlas);
  return { atlas, sourceRegister: canonicalCopy(sourceRegister) };
}
