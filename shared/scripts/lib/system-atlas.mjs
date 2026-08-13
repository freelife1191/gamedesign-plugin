import { lstat, readFile, realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
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
const expectedSystemIds = Object.freeze([
  "core-play", "player-character", "progression", "collection-crafting",
  "economy", "rewards", "content", "social", "monetization", "retention",
  "meta-liveops", "ux-accessibility", "account-platform", "session-network",
  "failure-recovery", "operations-telemetry",
]);
const expectedSourceRegister = Object.freeze([
  ["steamworks-tags", "https://partner.steamgames.com/doc/store/tags?l=english&language=english"],
  ["gamerefinery-genres", "https://docs.gamerefinery.com/en/articles/2278730-what-are-categories-genres-and-subgenres"],
  ["gamerefinery-intelligence", "https://www.gamerefinery.com/game-intelligence-tools/"],
  ["gdc-postmortems", "https://gdcvault.com/browse/postmortem/?media=s"],
  ["game-ui-database", "https://www.gameuidatabase.com/"],
  ["interface-in-game", "https://interfaceingame.com/screenshots/"],
  ["steamdb-faq", "https://steamdb.info/faq/"],
  ["igdb-api", "https://api-docs.igdb.com/"],
]);
const invalidDataField = Symbol("invalid-data-field");

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
  try {
    if (!isRecord(value)) return undefined;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor && Object.hasOwn(descriptor, "value") ? descriptor.value : undefined;
  } catch {
    return invalidDataField;
  }
}

function nonEmptyText(value) {
  return typeof value === "string" && value.length > 0;
}

function sortedByUtf8(values) {
  return values.every((value, index) => index === 0 || byteCompare(values[index - 1], value) < 0);
}

function hasExactKeys(value, keys) {
  return isRecord(value)
    && Object.keys(value).length === keys.length
    && keys.every((key) => Object.hasOwn(value, key));
}

function validateQuestion(question, systemIds) {
  if (!hasExactKeys(question, ["questionId", "systemId", "applicability", "rationale", "conditions", "verificationPrompts"])
    || !nonEmptyText(question.questionId)
    || !nonEmptyText(question.systemId)
    || !allowedApplicability.has(question.applicability)
    || !nonEmptyText(question.rationale)
    || !Array.isArray(question.conditions)
    || !Array.isArray(question.verificationPrompts)
    || !question.conditions.every(nonEmptyText)
    || !question.verificationPrompts.every(nonEmptyText)) fail();
  if (!systemIds.has(question.systemId)) fail("unknown-system");
}

function validateOverlayList(overlays, systemIds, globalPairs) {
  if (!Array.isArray(overlays)) fail();
  const overlayIds = new Set();
  for (const overlay of overlays) {
    if (!hasExactKeys(overlay, ["overlayId", "questions"]) || !nonEmptyText(overlay.overlayId) || !Array.isArray(overlay.questions)) fail();
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
      if (pairs.has(pair) || globalPairs.has(pair)) fail("duplicate-question");
      pairs.add(pair);
      globalPairs.add(pair);
    }
  }
}

function validateAtlas(atlas) {
  if (!hasExactKeys(atlas, ["version", "systems", "questions", "overlays"]) || atlas.version !== 1 || !Array.isArray(atlas.systems) || !Array.isArray(atlas.questions) || !isRecord(atlas.overlays)) fail();
  if (!hasExactKeys(atlas.overlays, overlayDomains.map(([domain]) => domain))) fail();
  const systems = atlas.systems;
  const systemIds = new Set();
  for (const system of systems) {
    if (!hasExactKeys(system, ["systemId", "name"]) || !nonEmptyText(system.systemId) || !nonEmptyText(system.name) || systemIds.has(system.systemId)) fail();
    systemIds.add(system.systemId);
  }
  if (systemIds.size !== expectedSystemIds.length || expectedSystemIds.some((systemId) => !systemIds.has(systemId))) fail("system-set");
  const questionIds = atlas.questions.map(({ questionId } = {}) => questionId);
  if (!questionIds.every(nonEmptyText) || !sortedByUtf8(questionIds) || new Set(questionIds).size !== questionIds.length) fail("question-order");
  for (const question of atlas.questions) validateQuestion(question, systemIds);
  const globalPairs = new Set();
  for (const [domain] of overlayDomains) validateOverlayList(atlas.overlays[domain], systemIds, globalPairs);
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
  } else if (questions.length !== applicable.length) {
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

function staysWithin(root, path) {
  const pathToRoot = relative(root, path);
  return pathToRoot !== "" && !pathToRoot.startsWith("..") && !isAbsolute(pathToRoot);
}

async function checkedDirectory(path, root) {
  try {
    if (!staysWithin(root, path)) fail("catalog-load");
    const info = await lstat(path);
    if (!info.isDirectory() || info.isSymbolicLink()) fail("catalog-load");
    const resolved = await realpath(path);
    if (!staysWithin(root, resolved)) fail("catalog-load");
    return resolved;
  } catch {
    fail("catalog-load");
  }
}

async function checkedJson(root, parts) {
  const path = resolve(root, ...parts);
  try {
    if (!staysWithin(root, path)) fail("catalog-load");
    const before = await lstat(path);
    if (!before.isFile() || before.isSymbolicLink()) fail("catalog-load");
    const resolved = await realpath(path);
    if (!staysWithin(root, resolved)) fail("catalog-load");
    const contents = await readFile(path, "utf8");
    const after = await lstat(path);
    if (before.dev !== after.dev || before.ino !== after.ino || before.size !== after.size || !after.isFile() || after.isSymbolicLink()) fail("catalog-load");
    return JSON.parse(contents);
  } catch {
    fail("catalog-load");
  }
}

async function moduleRootPath(moduleRoot) {
  const root = moduleRoot === undefined ? fileURLToPath(new URL("../../reference-intelligence/", import.meta.url)) : moduleRoot;
  if (typeof root !== "string" || !isAbsolute(root)) fail("catalog-load");
  try {
    const info = await lstat(root);
    if (!info.isDirectory() || info.isSymbolicLink()) fail("catalog-load");
    return await realpath(root);
  } catch {
    fail("catalog-load");
  }
}

function validateCatalogDocument(document) {
  if (!hasExactKeys(document, ["version", "overlays"]) || document.version !== 1 || !Array.isArray(document.overlays)) fail("catalog-load");
}

function validateSourceRegister(sourceRegister) {
  if (!hasExactKeys(sourceRegister, ["version", "sources"]) || sourceRegister.version !== 1 || !Array.isArray(sourceRegister.sources) || sourceRegister.sources.length !== expectedSourceRegister.length) fail("catalog-load");
  for (const [index, source] of sourceRegister.sources.entries()) {
    const [id, url] = expectedSourceRegister[index];
    if (!hasExactKeys(source, ["id", "url", "required", "purpose"])
      || source.id !== id || source.url !== url || source.required !== false || !nonEmptyText(source.purpose)) fail("catalog-load");
  }
}

/**
 * Loads only bundled JSON. Optional sources are catalogued without network access, so offline use remains available.
 */
export async function loadBundledReferenceCatalog(input = {}) {
  const moduleRoot = dataField(input, "moduleRoot");
  if (moduleRoot === invalidDataField) fail("catalog-load");
  const root = await moduleRootPath(moduleRoot);
  const catalogRoot = await checkedDirectory(resolve(root, "catalog"), root);
  const overlaysRoot = await checkedDirectory(resolve(catalogRoot, "overlays"), root);
  const [base, genre, playMode, platform, businessModel, sourceRegister] = await Promise.all([
    checkedJson(root, ["catalog", "system-atlas.json"]),
    checkedJson(root, ["catalog", "overlays", "genre.json"]),
    checkedJson(root, ["catalog", "overlays", "play-mode.json"]),
    checkedJson(root, ["catalog", "overlays", "platform.json"]),
    checkedJson(root, ["catalog", "overlays", "business-model.json"]),
    checkedJson(root, ["catalog", "source-register.json"]),
  ]);
  void overlaysRoot;
  if (!hasExactKeys(base, ["version", "systems", "questions"]) || base.version !== 1) fail("catalog-load");
  for (const document of [genre, playMode, platform, businessModel]) validateCatalogDocument(document);
  validateSourceRegister(sourceRegister);
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
