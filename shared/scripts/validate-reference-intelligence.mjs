import { canonicalJson, sha256Canonical } from "./lib/reference-intelligence-canonical.mjs";
import { evidenceSourceTypes, tierForSourceType } from "./lib/reference-evidence-contract.mjs";
import { validateReferenceSystemMaps } from "./lib/reference-system-maps.mjs";

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

function sortedUnique(values, path, issue, predicate = isSafeText, { allowEmpty = false } = {}) {
  if (!Array.isArray(values) || (!allowEmpty && values.length === 0)) { issue(path, "array.empty"); return; }
  for (const [index, value] of values.entries()) if (!predicate(value)) issue(`${path}/${index}`, "array.item-invalid");
  for (let index = 1; index < values.length; index += 1) if (typeof values[index - 1] !== "string" || typeof values[index] !== "string" || compareUtf8(values[index - 1], values[index]) >= 0) {
    issue(path, "array.unsorted-or-duplicate"); break;
  }
}

function sortedRecords(records, path, issue, key, validate, { allowEmpty = false } = {}) {
  if (!Array.isArray(records) || (!allowEmpty && records.length === 0)) { issue(path, "array.empty"); return; }
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
    const rootKeys = ["schemaVersion", "analysisId", "brief", "referenceSet", "referenceContexts", "evidence", "atlasSelection", "systemInventory", "systemMaps", "priority", "deepDives", "comparison", "transferDecisions", "verificationQueue"];
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
    sortedRecords(value?.referenceContexts, "/referenceContexts", issue, "contextId", (record, path, add) => {
      closedObject(record, ["contextId", "referenceId", "version", "platform"], path, add);
      safeId(record?.contextId, `${path}/contextId`, add); safeId(record?.referenceId, `${path}/referenceId`, add); nonEmptyText(record?.version, `${path}/version`, add); safeId(record?.platform, `${path}/platform`, add);
    });
    sortedRecords(value?.evidence, "/evidence", issue, "evidenceId", (record, path, add) => {
      closedObject(record, ["evidenceId", "referenceId", "contextId", "systemIds", "tier", "sourceType", "availability", "limitation", "verificationQuestion", "claimKind", "claim"], path, add);
      safeId(record?.evidenceId, `${path}/evidenceId`, add); safeId(record?.referenceId, `${path}/referenceId`, add); safeId(record?.contextId, `${path}/contextId`, add); sortedUnique(record?.systemIds, `${path}/systemIds`, add, isId);
      enumValue(record?.tier, ["primary", "supporting", "discovery"], `${path}/tier`, add);
      enumValue(record?.sourceType, evidenceSourceTypes, `${path}/sourceType`, add);
      if (tierForSourceType(record?.sourceType) !== record?.tier) add(`${path}/tier`, "evidence.tier-source-mismatch");
      enumValue(record?.availability, ["available", "unavailable"], `${path}/availability`, add);
      if (record?.availability === "available" && (record?.limitation !== null || record?.verificationQuestion !== null)) add(`${path}/availability`, "availability.detail-invalid");
      if (record?.availability === "unavailable") {
        nonEmptyText(record?.limitation, `${path}/limitation`, add);
        nonEmptyText(record?.verificationQuestion, `${path}/verificationQuestion`, add);
      }
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
      sortedUnique(record?.evidenceIds, `${path}/evidenceIds`, add, isId, { allowEmpty: true });
    });
    sortedRecords(value?.systemMaps, "/systemMaps", issue, "mapId", (record, path, add) => {
      closedObject(record, ["mapId", "systemId", "nodes", "connections", "loops"], path, add);
      safeId(record?.mapId, `${path}/mapId`, add); safeId(record?.systemId, `${path}/systemId`, add);
      sortedRecords(record?.nodes, `${path}/nodes`, add, "nodeId", (node, nodePath, nodeIssue) => { closedObject(node, ["nodeId", "kind", "label"], nodePath, nodeIssue); safeId(node?.nodeId, `${nodePath}/nodeId`, nodeIssue); enumValue(node?.kind, ["input", "process", "output"], `${nodePath}/kind`, nodeIssue); nonEmptyText(node?.label, `${nodePath}/label`, nodeIssue); });
      sortedRecords(record?.connections, `${path}/connections`, add, "connectionId", (connection, connectionPath, connectionIssue) => { closedObject(connection, ["connectionId", "fromNodeId", "toNodeId", "connectedSystemIds"], connectionPath, connectionIssue); safeId(connection?.connectionId, `${connectionPath}/connectionId`, connectionIssue); safeId(connection?.fromNodeId, `${connectionPath}/fromNodeId`, connectionIssue); safeId(connection?.toNodeId, `${connectionPath}/toNodeId`, connectionIssue); sortedUnique(connection?.connectedSystemIds, `${connectionPath}/connectedSystemIds`, connectionIssue, isId); });
      if (!Array.isArray(record?.loops)) add(`${path}/loops`, "schema.type"); else for (const [loopIndex, loop] of record.loops.entries()) { const loopPath = `${path}/loops/${loopIndex}`; closedObject(loop, ["loopId", "kind", "nodeIds"], loopPath, add); safeId(loop?.loopId, `${loopPath}/loopId`, add); enumValue(loop?.kind, ["core", "session", "meta"], `${loopPath}/kind`, add); if (!Array.isArray(loop?.nodeIds) || loop.nodeIds.length < 2 || loop.nodeIds.some((nodeId) => !isId(nodeId)) || new Set(loop.nodeIds).size !== loop.nodeIds.length) add(`${loopPath}/nodeIds`, "loop.invalid"); if (loopIndex > 0 && compareUtf8(record.loops[loopIndex - 1]?.loopId, loop?.loopId) >= 0) add(`${path}/loops`, "array.unsorted-or-duplicate"); }
    });
    sortedRecords(value?.priority, "/priority", issue, "systemId", (record, path, add) => {
      closedObject(record, ["systemId", "rank", "rationale", "relevance", "playerExperienceImpact", "economyProgressionImpact", "differentiationPotential", "evidenceStrength", "uncertainty", "researchCost"], path, add); safeId(record?.systemId, `${path}/systemId`, add);
      if (!Number.isInteger(record?.rank) || record.rank < 1) add(`${path}/rank`, "rank.invalid"); nonEmptyText(record?.rationale, `${path}/rationale`, add);
      for (const key of ["relevance", "playerExperienceImpact", "economyProgressionImpact", "differentiationPotential", "evidenceStrength", "uncertainty", "researchCost"]) if (!Number.isInteger(record?.[key]) || record[key] < 1 || record[key] > 5) add(`${path}/${key}`, "priority.invalid");
    });
    sortedRecords(value?.deepDives, "/deepDives", issue, "systemId", (record, path, add) => {
      closedObject(record, ["systemId", "claimKind", "finding", "evidenceIds", "referenceIds", "contextIds", "coverageCount"], path, add); safeId(record?.systemId, `${path}/systemId`, add);
      enumValue(record?.claimKind, ["observation", "inference", "hypothesis", "unknown"], `${path}/claimKind`, add); nonEmptyText(record?.finding, `${path}/finding`, add);
      sortedUnique(record?.evidenceIds, `${path}/evidenceIds`, add, isId, { allowEmpty: true }); sortedUnique(record?.referenceIds, `${path}/referenceIds`, add, isId, { allowEmpty: true }); sortedUnique(record?.contextIds, `${path}/contextIds`, add, isId, { allowEmpty: true }); if (!Number.isInteger(record?.coverageCount) || record.coverageCount !== record?.referenceIds?.length) add(`${path}/coverageCount`, "coverage.invalid");
    });
    sortedRecords(value?.comparison, "/comparison", issue, "comparisonId", (record, path, add) => {
      closedObject(record, ["comparisonId", "subject", "finding", "evidenceIds", "referenceIds", "contextIds", "coverageCount"], path, add); safeId(record?.comparisonId, `${path}/comparisonId`, add);
      nonEmptyText(record?.subject, `${path}/subject`, add); nonEmptyText(record?.finding, `${path}/finding`, add); sortedUnique(record?.evidenceIds, `${path}/evidenceIds`, add, isId, { allowEmpty: true }); sortedUnique(record?.referenceIds, `${path}/referenceIds`, add, isId, { allowEmpty: true }); sortedUnique(record?.contextIds, `${path}/contextIds`, add, isId, { allowEmpty: true }); if (!Number.isInteger(record?.coverageCount) || record.coverageCount !== record?.referenceIds?.length) add(`${path}/coverageCount`, "coverage.invalid");
    });
    sortedRecords(value?.transferDecisions, "/transferDecisions", issue, "transferId", (record, path, add) => {
      closedObject(record, ["transferId", "sourceSystemId", "decision", "rationale", "evidenceIds", "referenceIds", "contextIds", "coverageCount", "projectConstraints", "risks", "validationSteps", "validationState", "glossaryReceipt", "reviewState"], path, add);
      safeId(record?.transferId, `${path}/transferId`, add); safeId(record?.sourceSystemId, `${path}/sourceSystemId`, add);
      enumValue(record?.decision, ["adopt", "adapt", "reject", "hold"], `${path}/decision`, add); nonEmptyText(record?.rationale, `${path}/rationale`, add);
      sortedUnique(record?.evidenceIds, `${path}/evidenceIds`, add, isId, { allowEmpty: true }); sortedUnique(record?.referenceIds, `${path}/referenceIds`, add, isId, { allowEmpty: true }); sortedUnique(record?.contextIds, `${path}/contextIds`, add, isId, { allowEmpty: true }); if (!Number.isInteger(record?.coverageCount) || record.coverageCount !== record?.referenceIds?.length) add(`${path}/coverageCount`, "coverage.invalid"); sortedUnique(record?.projectConstraints, `${path}/projectConstraints`, add); sortedUnique(record?.risks, `${path}/risks`, add); sortedUnique(record?.validationSteps, `${path}/validationSteps`, add); enumValue(record?.validationState, ["not-run"], `${path}/validationState`, add); if (record?.glossaryReceipt !== null) validateReceiptShape(record?.glossaryReceipt, `${path}/glossaryReceipt`, add);
      enumValue(record?.reviewState, ["pending-review"], `${path}/reviewState`, add);
    });
    sortedRecords(value?.verificationQueue, "/verificationQueue", issue, "verificationId", (record, path, add) => {
      closedObject(record, ["verificationId", "question", "evidenceIds", "state"], path, add); safeId(record?.verificationId, `${path}/verificationId`, add);
      nonEmptyText(record?.question, `${path}/question`, add); sortedUnique(record?.evidenceIds, `${path}/evidenceIds`, add, isId, { allowEmpty: true }); enumValue(record?.state, ["open"], `${path}/state`, add);
    }, { allowEmpty: true });
    for (const role of referenceRoles) if ((value?.referenceSet ?? []).filter((entry) => entry?.role === role).length !== 1) issue("/referenceSet", "reference.role-cardinality");
    const referenceIds = new Set((value?.referenceSet ?? []).map(({ referenceId }) => referenceId));
    const contextsById = new Map((value?.referenceContexts ?? []).map((context) => [context.contextId, context]));
    const evidenceIds = new Set((value?.evidence ?? []).map(({ evidenceId }) => evidenceId));
    const systemIds = new Set((value?.systemInventory ?? []).map(({ systemId }) => systemId));
    const selectedSystemIds = new Set((value?.atlasSelection ?? []).map(({ systemId }) => systemId));
    requireKnownRecordIds(value?.referenceContexts, "/referenceContexts", issue, referenceIds, "referenceId"); requireKnownRecordIds(value?.evidence, "/evidence", issue, referenceIds, "referenceId");
    for (const [index, record] of (value?.evidence ?? []).entries()) { const context = contextsById.get(record?.contextId); if (!context || context.referenceId !== record?.referenceId) issue(`/evidence/${index}/contextId`, "reference.dangling"); for (const [systemIndex, systemId] of (record?.systemIds ?? []).entries()) if (!selectedSystemIds.has(systemId)) issue(`/evidence/${index}/systemIds/${systemIndex}`, "reference.dangling"); }
    for (const [index, record] of (value?.systemInventory ?? []).entries()) for (const [evidenceIndex, evidenceId] of (record?.evidenceIds ?? []).entries()) { const evidence = (value?.evidence ?? []).find((item) => item?.evidenceId === evidenceId); if (!evidence || !evidence.systemIds.includes(record.systemId)) issue(`/systemInventory/${index}/evidenceIds/${evidenceIndex}`, "reference.dangling"); }
    requireKnownRecordIds(value?.systemMaps, "/systemMaps", issue, systemIds, "systemId");
    requireKnownRecordIds(value?.priority, "/priority", issue, systemIds, "systemId");
    requireKnownRecordIds(value?.deepDives, "/deepDives", issue, systemIds, "systemId");
    requireKnownIds(value?.deepDives, "/deepDives", issue, evidenceIds);
    requireKnownIds(value?.comparison, "/comparison", issue, evidenceIds);
    requireKnownRecordIds(value?.transferDecisions, "/transferDecisions", issue, systemIds, "sourceSystemId");
    requireKnownIds(value?.transferDecisions, "/transferDecisions", issue, evidenceIds);
    requireKnownIds(value?.verificationQueue, "/verificationQueue", issue, evidenceIds);
    const evidenceById = new Map((value?.evidence ?? []).map((record) => [record.evidenceId, record]));
    for (const [collection, systemField] of [[value?.deepDives, "systemId"], [value?.comparison, undefined], [value?.transferDecisions, "sourceSystemId"]]) for (const [index, record] of (collection ?? []).entries()) {
      const linked = (record?.evidenceIds ?? []).map((evidenceId) => evidenceById.get(evidenceId)); const systemId = systemField ? record?.[systemField] : undefined;
      if (linked.some((evidence) => !evidence || systemId && !evidence.systemIds.includes(systemId))) { issue(`/${systemField === "systemId" ? "deepDives" : systemField === "sourceSystemId" ? "transferDecisions" : "comparison"}/${index}/evidenceIds`, "reference.dangling"); continue; }
      const available = linked.filter((evidence) => evidence.availability === "available"); const expectedReferences = [...new Set(available.map(({ referenceId }) => referenceId))].sort(compareUtf8); const expectedContexts = [...new Set(available.map(({ contextId }) => contextId))].sort(compareUtf8);
      if ((record?.referenceIds ?? []).join("\0") !== expectedReferences.join("\0") || (record?.contextIds ?? []).join("\0") !== expectedContexts.join("\0") || record?.coverageCount !== expectedReferences.length) issue(`/${systemField === "systemId" ? "deepDives" : systemField === "sourceSystemId" ? "transferDecisions" : "comparison"}/${index}/coverageCount`, "coverage.invalid");
    }
    for (const [index, record] of (value?.transferDecisions ?? []).entries()) if (record?.coverageCount < 2 && record?.decision !== "hold") issue(`/transferDecisions/${index}/decision`, "coverage.hold-required");
    if (!validateReferenceSystemMaps({ maps: value?.systemMaps, inventorySystemIds: [...systemIds].sort(compareUtf8) })) issue("/systemMaps", "map.invalid");
    for (const [index, map] of (value?.systemMaps ?? []).entries()) { const nodes = new Set((map?.nodes ?? []).map(({ nodeId }) => nodeId)); for (const [connectionIndex, connection] of (map?.connections ?? []).entries()) { if (!nodes.has(connection?.fromNodeId) || !nodes.has(connection?.toNodeId)) issue(`/systemMaps/${index}/connections/${connectionIndex}`, "reference.dangling"); for (const [systemIndex, systemId] of (connection?.connectedSystemIds ?? []).entries()) if (!systemIds.has(systemId)) issue(`/systemMaps/${index}/connections/${connectionIndex}/connectedSystemIds/${systemIndex}`, "reference.dangling"); } }
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
