import { canonicalJson, sha256Canonical } from "./lib/reference-intelligence-canonical.mjs";

export { canonicalJson, sha256Canonical };

const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const termIdPattern = /^TERM-[A-Z0-9]+(?:-[A-Z0-9]+)*$/u;
const sha256Pattern = /^[a-f0-9]{64}$/u;
const compareUtf8 = (left, right) => Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
const isSafeText = (value) => typeof value === "string" && value.length > 0 && !value.includes("\0") && !value.includes("\r") && value === value.normalize("NFC");
const isId = (value) => isSafeText(value) && idPattern.test(value);
const isTermId = (value) => isSafeText(value) && termIdPattern.test(value);
const isHash = (value) => isSafeText(value) && sha256Pattern.test(value);
const referenceRoles = ["direct-competitor", "core-system-exemplar", "operations-monetization-comparator"];

function resultOf(validate) {
  const errors = [];
  const issue = (path, code) => errors.push({ code, path });
  try { validate(issue); } catch { issue("", "input.invalid"); }
  return { ok: errors.length === 0, errors };
}

function closedObject(value, keys, path, issue) {
  if (!isObject(value)) { issue(path, "schema.type"); return false; }
  for (const key of keys) if (!Object.hasOwn(value, key)) issue(`${path}/${key}`, "schema.required");
  let unknownIndex = 0;
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key === "string" && keys.includes(key)) continue;
    issue(`${path}/$unknown/${unknownIndex}`, "schema.unknown-key");
    unknownIndex += 1;
  }
  return true;
}

function nonEmptyText(value, path, issue) { if (!isSafeText(value)) issue(path, "text.invalid"); }
function safeId(value, path, issue) { if (!isId(value)) issue(path, "id.invalid"); }
function safeTermId(value, path, issue) { if (!isTermId(value)) issue(path, "term-id.invalid"); }
function enumValue(value, allowed, path, issue) { if (!allowed.includes(value)) issue(path, "enum.invalid"); }

function sortedUnique(values, path, issue, predicate = isSafeText) {
  if (!Array.isArray(values) || values.length === 0) { issue(path, "array.empty"); return; }
  for (const [index, value] of values.entries()) if (!predicate(value)) issue(`${path}/${index}`, "array.item-invalid");
  for (let index = 1; index < values.length; index += 1) if (typeof values[index - 1] !== "string" || typeof values[index] !== "string" || compareUtf8(values[index - 1], values[index]) >= 0) {
    issue(path, "array.unsorted-or-duplicate"); break;
  }
}

function sortedRecords(records, path, issue, key, validate) {
  if (!Array.isArray(records) || records.length === 0) { issue(path, "array.empty"); return; }
  let previous;
  for (const [index, record] of records.entries()) {
    validate(record, `${path}/${index}`, issue);
    const value = isObject(record) ? (typeof key === "function" ? key(record) : record[key]) : undefined;
    if (typeof value !== "string" || (previous !== undefined && compareUtf8(previous, value) >= 0)) issue(path, "array.unsorted-or-duplicate");
    previous = value;
  }
}

function requireKnownIds(records, path, issue, knownIds, field = "evidenceIds") {
  for (const [index, record] of (records ?? []).entries()) {
    for (const [itemIndex, id] of (record?.[field] ?? []).entries()) if (!knownIds.has(id)) issue(`${path}/${index}/${field}/${itemIndex}`, "reference.dangling");
  }
}

function requireKnownRecordIds(records, path, issue, knownIds, field) {
  for (const [index, record] of (records ?? []).entries()) if (!knownIds.has(record?.[field])) issue(`${path}/${index}/${field}`, "reference.dangling");
}

function validateReceiptShape(value, path, issue, { includeSchemaVersion = false } = {}) {
  closedObject(value, includeSchemaVersion ? ["schemaVersion", "documentId", "glossaryVersion", "glossarySha256", "termIds"] : ["documentId", "glossaryVersion", "glossarySha256", "termIds"], path, issue);
  safeId(value?.documentId, `${path}/documentId`, issue);
  if (!Number.isInteger(value?.glossaryVersion) || value.glossaryVersion < 1) issue(`${path}/glossaryVersion`, "version.invalid");
  if (!isHash(value?.glossarySha256)) issue(`${path}/glossarySha256`, "hash.invalid");
  sortedUnique(value?.termIds, `${path}/termIds`, issue, isTermId);
}

export function validateReferenceAnalysis(value) {
  return resultOf((issue) => {
    const rootKeys = ["schemaVersion", "analysisId", "brief", "referenceSet", "evidence", "atlasSelection", "systemInventory", "systemMaps", "priority", "deepDives", "comparison", "transferDecisions", "verificationQueue"];
    closedObject(value, rootKeys, "", issue);
    if (value?.schemaVersion !== 1) issue("/schemaVersion", "schema-version.invalid");
    safeId(value?.analysisId, "/analysisId", issue);
    closedObject(value?.brief, ["objective", "decisionQuestions"], "/brief", issue);
    nonEmptyText(value?.brief?.objective, "/brief/objective", issue);
    sortedUnique(value?.brief?.decisionQuestions, "/brief/decisionQuestions", issue);
    sortedRecords(value?.referenceSet, "/referenceSet", issue, (record) => `${record.referenceId}\0${record.role}`, (record, path, add) => {
      closedObject(record, ["referenceId", "label", "role", "availability", "limitation"], path, add);
      safeId(record?.referenceId, `${path}/referenceId`, add); nonEmptyText(record?.label, `${path}/label`, add);
      enumValue(record?.role, referenceRoles, `${path}/role`, add); enumValue(record?.availability, ["available", "unavailable"], `${path}/availability`, add);
      if (record?.availability === "available" && record?.limitation !== null) add(`${path}/limitation`, "availability.limitation-invalid");
      if (record?.availability === "unavailable") nonEmptyText(record?.limitation, `${path}/limitation`, add);
    });
    sortedRecords(value?.evidence, "/evidence", issue, "evidenceId", (record, path, add) => {
      closedObject(record, ["evidenceId", "referenceId", "tier", "claimKind", "claim"], path, add);
      safeId(record?.evidenceId, `${path}/evidenceId`, add); safeId(record?.referenceId, `${path}/referenceId`, add);
      enumValue(record?.tier, ["primary", "supporting", "discovery"], `${path}/tier`, add);
      enumValue(record?.claimKind, ["observation", "inference", "hypothesis", "unknown"], `${path}/claimKind`, add);
      nonEmptyText(record?.claim, `${path}/claim`, add);
    });
    sortedRecords(value?.atlasSelection, "/atlasSelection", issue, "systemId", (record, path, add) => {
      closedObject(record, ["systemId", "rationale"], path, add); safeId(record?.systemId, `${path}/systemId`, add); nonEmptyText(record?.rationale, `${path}/rationale`, add);
    });
    sortedRecords(value?.systemInventory, "/systemInventory", issue, "systemId", (record, path, add) => {
      closedObject(record, ["systemId", "name", "applicability", "evidenceIds"], path, add);
      safeId(record?.systemId, `${path}/systemId`, add); nonEmptyText(record?.name, `${path}/name`, add);
      enumValue(record?.applicability, ["required-candidate", "conditional", "optional", "not-applicable", "unknown"], `${path}/applicability`, add);
      sortedUnique(record?.evidenceIds, `${path}/evidenceIds`, add, isId);
    });
    sortedRecords(value?.systemMaps, "/systemMaps", issue, "mapId", (record, path, add) => {
      closedObject(record, ["mapId", "systemId", "nodes", "edges"], path, add);
      safeId(record?.mapId, `${path}/mapId`, add); safeId(record?.systemId, `${path}/systemId`, add);
      sortedUnique(record?.nodes, `${path}/nodes`, add); sortedUnique(record?.edges, `${path}/edges`, add);
    });
    sortedRecords(value?.priority, "/priority", issue, "systemId", (record, path, add) => {
      closedObject(record, ["systemId", "rank", "rationale"], path, add); safeId(record?.systemId, `${path}/systemId`, add);
      if (!Number.isInteger(record?.rank) || record.rank < 1) add(`${path}/rank`, "rank.invalid"); nonEmptyText(record?.rationale, `${path}/rationale`, add);
    });
    sortedRecords(value?.deepDives, "/deepDives", issue, "systemId", (record, path, add) => {
      closedObject(record, ["systemId", "claimKind", "finding", "evidenceIds"], path, add); safeId(record?.systemId, `${path}/systemId`, add);
      enumValue(record?.claimKind, ["observation", "inference", "hypothesis", "unknown"], `${path}/claimKind`, add); nonEmptyText(record?.finding, `${path}/finding`, add);
      sortedUnique(record?.evidenceIds, `${path}/evidenceIds`, add, isId);
    });
    sortedRecords(value?.comparison, "/comparison", issue, "comparisonId", (record, path, add) => {
      closedObject(record, ["comparisonId", "subject", "finding", "evidenceIds"], path, add); safeId(record?.comparisonId, `${path}/comparisonId`, add);
      nonEmptyText(record?.subject, `${path}/subject`, add); nonEmptyText(record?.finding, `${path}/finding`, add); sortedUnique(record?.evidenceIds, `${path}/evidenceIds`, add, isId);
    });
    sortedRecords(value?.transferDecisions, "/transferDecisions", issue, "transferId", (record, path, add) => {
      closedObject(record, ["transferId", "sourceSystemId", "decision", "rationale", "evidenceIds", "glossaryReceipt", "reviewState"], path, add);
      safeId(record?.transferId, `${path}/transferId`, add); safeId(record?.sourceSystemId, `${path}/sourceSystemId`, add);
      enumValue(record?.decision, ["adopt", "adapt", "reject", "hold"], `${path}/decision`, add); nonEmptyText(record?.rationale, `${path}/rationale`, add);
      sortedUnique(record?.evidenceIds, `${path}/evidenceIds`, add, isId); validateReceiptShape(record?.glossaryReceipt, `${path}/glossaryReceipt`, add);
      enumValue(record?.reviewState, ["pending-review"], `${path}/reviewState`, add);
    });
    sortedRecords(value?.verificationQueue, "/verificationQueue", issue, "verificationId", (record, path, add) => {
      closedObject(record, ["verificationId", "question", "evidenceIds", "state"], path, add); safeId(record?.verificationId, `${path}/verificationId`, add);
      nonEmptyText(record?.question, `${path}/question`, add); sortedUnique(record?.evidenceIds, `${path}/evidenceIds`, add, isId); enumValue(record?.state, ["open"], `${path}/state`, add);
    });
    const roleSet = new Set((value?.referenceSet ?? []).map(({ role }) => role));
    for (const role of referenceRoles) if (!roleSet.has(role)) issue("/referenceSet", "reference.role-missing");
    const referenceIds = new Set((value?.referenceSet ?? []).map(({ referenceId }) => referenceId));
    const evidenceIds = new Set((value?.evidence ?? []).map(({ evidenceId }) => evidenceId));
    const systemIds = new Set((value?.systemInventory ?? []).map(({ systemId }) => systemId));
    requireKnownRecordIds(value?.evidence, "/evidence", issue, referenceIds, "referenceId");
    requireKnownRecordIds(value?.atlasSelection, "/atlasSelection", issue, systemIds, "systemId");
    requireKnownIds(value?.systemInventory, "/systemInventory", issue, evidenceIds);
    requireKnownRecordIds(value?.systemMaps, "/systemMaps", issue, systemIds, "systemId");
    requireKnownRecordIds(value?.priority, "/priority", issue, systemIds, "systemId");
    requireKnownRecordIds(value?.deepDives, "/deepDives", issue, systemIds, "systemId");
    requireKnownIds(value?.deepDives, "/deepDives", issue, evidenceIds);
    requireKnownIds(value?.comparison, "/comparison", issue, evidenceIds);
    requireKnownRecordIds(value?.transferDecisions, "/transferDecisions", issue, systemIds, "sourceSystemId");
    requireKnownIds(value?.transferDecisions, "/transferDecisions", issue, evidenceIds);
    requireKnownIds(value?.verificationQueue, "/verificationQueue", issue, evidenceIds);
  });
}

export function validateGameDesignGlossary(value) {
  return resultOf((issue) => {
    closedObject(value, ["schemaVersion", "scope", "version", "terms"], "", issue);
    if (value?.schemaVersion !== 1) issue("/schemaVersion", "schema-version.invalid");
    enumValue(value?.scope, ["shared", "project-overlay"], "/scope", issue);
    if (!Number.isInteger(value?.version) || value.version < 1) issue("/version", "version.invalid");
    sortedRecords(value?.terms, "/terms", issue, "termId", (term, path, add) => {
      closedObject(term, ["termId", "conceptId", "preferredTerm", "translations", "state"], path, add);
      safeTermId(term?.termId, `${path}/termId`, add); safeId(term?.conceptId, `${path}/conceptId`, add); nonEmptyText(term?.preferredTerm, `${path}/preferredTerm`, add);
      enumValue(term?.state, ["proposed", "approved", "deprecated"], `${path}/state`, add);
      sortedRecords(term?.translations, `${path}/translations`, add, "locale", (translation, translationPath, translationIssue) => {
        closedObject(translation, ["locale", "term"], translationPath, translationIssue); safeId(translation?.locale, `${translationPath}/locale`, translationIssue); nonEmptyText(translation?.term, `${translationPath}/term`, translationIssue);
      });
    });
    const concepts = value?.terms?.map((term) => term?.conceptId) ?? [];
    if (new Set(concepts).size !== concepts.length) issue("/terms", "concept.ambiguous");
  });
}

export function validateGlossaryReceipt(value, { glossary } = {}) {
  return resultOf((issue) => {
    if (value?.schemaVersion !== 1) issue("/schemaVersion", "schema-version.invalid");
    validateReceiptShape(value, "", issue, { includeSchemaVersion: true });
    const glossaryResult = validateGameDesignGlossary(glossary);
    if (!glossaryResult.ok) { issue("/glossary", "glossary.invalid"); return; }
    if (value?.glossaryVersion !== glossary.version) issue("/glossaryVersion", "glossary-version.mismatch");
    if (value?.glossarySha256 !== sha256Canonical(glossary)) issue("/glossarySha256", "glossary-hash.mismatch");
    const termIds = new Set(glossary.terms.map(({ termId }) => termId));
    for (const [index, termId] of (value?.termIds ?? []).entries()) if (!termIds.has(termId)) issue(`/termIds/${index}`, "term.unknown");
  });
}

export function canonicalReferenceAnalysis(value) {
  const result = validateReferenceAnalysis(value);
  if (!result.ok) throw new Error("reference analysis invalid");
  return canonicalJson(value);
}

export function canonicalGlossary(value) {
  const result = validateGameDesignGlossary(value);
  if (!result.ok) throw new Error("game design glossary invalid");
  return canonicalJson(value);
}
