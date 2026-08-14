import { canonicalReferenceAnalysis, canonicalJson, sha256Canonical, validateReferenceAnalysis } from "./validate-reference-intelligence.mjs";
import { deriveAvailableClaimKind, registerReferenceEvidence, validateClaimAgainstEvidence, validateEvidenceBindings } from "./lib/reference-evidence.mjs";
import { mergeSystemAtlas } from "./lib/system-atlas.mjs";
import { ensureArtifactDirectories, safeWriteArtifactFile } from "./lib/safe-artifact-write.mjs";
import { validateReferenceSystemMaps } from "./lib/reference-system-maps.mjs";
import { comparePriorityEntries, priorityDimensions, deriveComparisonPresentation, evidenceVerificationId, systemVerificationId, systemVerificationQuestion } from "./lib/reference-analysis-derivations.mjs";

const roles = Object.freeze(["direct-competitor", "core-system-exemplar", "operations-monetization-comparator"]);
const dimensions = priorityDimensions;
const artifactFiles = Object.freeze(["reference-intelligence/brief.md", "reference-intelligence/reference-set.yml", "reference-intelligence/evidence-register.yml", "reference-intelligence/system-inventory.json", "reference-intelligence/analysis-priority.md", "reference-intelligence/comparison-matrix.md", "reference-intelligence/transfer-decisions.md", "reference-intelligence/verification-queue.md"]);
const id = (value) => typeof value === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(value);
const text = (value) => typeof value === "string" && value.length > 0 && !value.includes("\0") && !value.includes("\r") && value === value.normalize("NFC");
const compare = (left, right) => Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));

function fail(code = "invalid") { const error = new Error("Reference analysis is invalid."); error.code = `reference-analysis.${code}`; throw error; }
function copy(value) { try { return JSON.parse(canonicalJson(value)); } catch { fail(); } }
function exact(value, keys) { return value !== null && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key)); }
function sorted(values, predicate = text, { allowEmpty = false } = {}) { return Array.isArray(values) && (allowEmpty || values.length > 0) && values.every(predicate) && values.every((value, index) => index === 0 || compare(values[index - 1], value) < 0); }
function freeze(value) { if (value && typeof value === "object" && !Object.isFrozen(value)) { for (const child of Object.values(value)) freeze(child); Object.freeze(value); } return value; }
function availability(value) { return (value.availability === "available" && value.limitation === null) || (value.availability === "unavailable" && text(value.limitation)); }

export function buildReferenceBrief(input = {}) {
  const value = copy(input);
  if (!exact(value, ["analysisId", "objective", "decisionQuestions"]) || !id(value.analysisId) || !text(value.objective) || !sorted(value.decisionQuestions)) fail("invalid-brief");
  return freeze({ objective: value.objective, decisionQuestions: value.decisionQuestions });
}

function normalizeReferences(input) {
  const values = copy(input);
  if (!Array.isArray(values) || values.length !== roles.length) fail("invalid-reference-set");
  const byRole = new Map();
  for (const value of values) {
    if (!exact(value, ["referenceId", "label", "role", "availability", "limitation"]) || !id(value.referenceId) || !text(value.label) || !roles.includes(value.role) || !availability(value) || byRole.has(value.role)) fail("invalid-reference-set");
    byRole.set(value.role, value);
  }
  if (roles.some((role) => !byRole.has(role))) fail("invalid-reference-set");
  return [...byRole.values()].sort((left, right) => compare(`${left.referenceId}\0${left.role}`, `${right.referenceId}\0${right.role}`));
}

function normalizeContexts(input, referenceSet) {
  const contexts = copy(input);
  const references = new Set(referenceSet.map(({ referenceId }) => referenceId));
  if (!Array.isArray(contexts) || !sorted(contexts.map(({ contextId } = {}) => contextId), id)) fail("invalid-context");
  for (const context of contexts) if (!exact(context, ["contextId", "referenceId", "version", "platform"]) || !id(context.contextId) || !id(context.referenceId) || !text(context.version) || !id(context.platform) || !references.has(context.referenceId)) fail("invalid-context");
  return contexts;
}

function compactAtlas(questions) {
  const groups = new Map();
  for (const question of questions) groups.set(question.systemId, [...(groups.get(question.systemId) ?? []), question.rationale]);
  return [...groups.entries()].map(([systemId, rationales]) => ({ systemId, rationale: [...new Set(rationales)].sort(compare).join(" ") })).sort((left, right) => compare(left.systemId, right.systemId));
}

function atlasNames(selection) {
  const atlas = copy(selection).atlas;
  if (!atlas || !Array.isArray(atlas.systems)) fail("invalid-atlas");
  return new Map(atlas.systems.map(({ systemId, name }) => [systemId, name]));
}

function validateClaims(claims, evidence) {
  const values = copy(claims);
  if (!Array.isArray(values)) fail("invalid-claim");
  const byId = new Map(evidence.map((record) => [record.evidenceId, record]));
  const claimIds = new Set();
  for (const claim of values) {
    const result = validateClaimAgainstEvidence({ claim, evidenceById: byId });
    if (!result.ok || claimIds.has(claim.claimId)) fail(result.code === "unsupported_claim_kind" ? "claim-kind-upgrade" : "invalid-claim");
    claimIds.add(claim.claimId);
  }
  return freeze(values.sort((left, right) => compare(left.claimId, right.claimId)));
}

/** Stage 4: records only the available evidence explicitly bound to each selected system. */
export function inventoryReferenceSystems({ brief, atlas, evidence, claims = [] } = {}) {
  const safeBrief = copy(brief); const selected = copy(atlas); const registered = registerReferenceEvidence({ records: evidence });
  if (!exact(safeBrief, ["objective", "decisionQuestions"]) || !text(safeBrief.objective) || !sorted(safeBrief.decisionQuestions) || !Array.isArray(selected)) fail("invalid-atlas");
  validateClaims(claims, registered);
  const systems = new Map();
  for (const entry of selected) {
    const question = exact(entry, ["questionId", "systemId", "applicability", "rationale", "conditions", "verificationPrompts"]) ? entry : exact(entry, ["systemId", "rationale"]) ? { ...entry, applicability: "unknown" } : undefined;
    if (!question || !id(question.systemId) || !text(question.rationale) || !["required-candidate", "conditional", "optional", "not-applicable", "unknown"].includes(question.applicability)) fail("invalid-atlas");
    systems.set(question.systemId, [...(systems.get(question.systemId) ?? []), question]);
  }
  return freeze([...systems.entries()].map(([systemId, questions]) => {
    const evidenceIds = registered.filter((record) => record.systemIds.includes(systemId)).map(({ evidenceId }) => evidenceId);
    const hasAvailableEvidence = registered.some((record) => record.availability === "available" && record.systemIds.includes(systemId));
    return { systemId, name: systemId.split("-").map((part) => part[0].toUpperCase() + part.slice(1)).join(" "), applicability: hasAvailableEvidence && !questions.some(({ applicability }) => applicability === "unknown") ? questions[0].applicability : "unknown", evidenceIds };
  }).sort((left, right) => compare(left.systemId, right.systemId)));
}

/** Stage 5: treats edges as structured map definitions and groups external loop definitions by mapId. */
export function buildSystemMaps({ inventory, edges, loops = [] } = {}) {
  const items = copy(inventory); const maps = copy(edges); const loopValues = copy(loops);
  if (!Array.isArray(items) || !Array.isArray(maps) || maps.length === 0 || !Array.isArray(loopValues)) fail("invalid-map");
  const systems = new Set(items.map(({ systemId }) => systemId)); const mapIds = new Set(); const groupedLoops = new Map();
  for (const loop of loopValues) {
    if (!exact(loop, ["loopId", "mapId", "kind", "nodeIds"]) || !id(loop.loopId) || !id(loop.mapId) || !["core", "session", "meta"].includes(loop.kind) || !Array.isArray(loop.nodeIds) || loop.nodeIds.length < 2 || !loop.nodeIds.every(id) || new Set(loop.nodeIds).size !== loop.nodeIds.length) fail("invalid-map");
    groupedLoops.set(loop.mapId, [...(groupedLoops.get(loop.mapId) ?? []), loop]);
  }
  const result = maps.map((map) => {
    if (!exact(map, ["mapId", "systemId", "nodes", "connections"]) || !id(map.mapId) || !systems.has(map.systemId) || mapIds.has(map.mapId) || !Array.isArray(map.nodes) || !Array.isArray(map.connections)) fail("invalid-map");
    mapIds.add(map.mapId);
    const declared = groupedLoops.get(map.mapId) ?? [];
    return { ...map, loops: declared.sort((left, right) => compare(left.loopId, right.loopId)).map(({ loopId, kind, nodeIds }) => ({ loopId, kind, nodeIds })) };
  });
  if ([...groupedLoops.keys()].some((mapId) => !mapIds.has(mapId))) fail("invalid-map");
  const sortedMaps = result.sort((left, right) => compare(left.mapId, right.mapId));
  if (!validateReferenceSystemMaps({ maps: sortedMaps, inventorySystemIds: [...systems].sort(compare) })) fail("invalid-map");
  return freeze(sortedMaps);
}

function completePriority(value) { return exact(value, dimensions) && dimensions.every((field) => Number.isInteger(value[field]) && value[field] >= 1 && value[field] <= 5); }

/** Stage 6: retains all seven scoring dimensions; research cost is an inverse deterministic tie-break. */
export function rankDeepDiveCandidates({ inventory, maps, questions = {} } = {}) {
  const items = copy(inventory); const mapValues = copy(maps); const scoring = copy(questions);
  if (!Array.isArray(items) || !Array.isArray(mapValues) || !scoring || typeof scoring !== "object" || Array.isArray(scoring)) fail("invalid-priority");
  const mapped = new Set(mapValues.map(({ systemId }) => systemId));
  return freeze(items.filter(({ systemId }) => mapped.has(systemId) && completePriority(scoring[systemId])).map((item) => ({ ...item, ...scoring[item.systemId] })).sort(comparePriorityEntries).map((item, index) => ({ systemId: item.systemId, rank: index + 1, rationale: "All seven priority dimensions are explicitly scored.", ...Object.fromEntries(dimensions.map((field) => [field, item[field]])) })));
}

function deepDives(priority, inventory, evidence) {
  const inventoryBySystem = new Map(inventory.map((item) => [item.systemId, item])); const evidenceById = new Map(evidence.map((item) => [item.evidenceId, item]));
  return priority.map(({ systemId }) => {
    const records = inventoryBySystem.get(systemId).evidenceIds.map((evidenceId) => evidenceById.get(evidenceId)).filter((record) => record?.systemIds.includes(systemId)).sort((left, right) => compare(left.evidenceId, right.evidenceId));
    const available = records.filter((record) => record.availability === "available");
    if (records.length === 0) return { systemId, claimKind: "unknown", finding: "Not observed; verification required.", evidenceIds: [], referenceIds: [], contextIds: [], coverageCount: 0 };
    if (available.length === 0) return { systemId, claimKind: "unknown", finding: "Not observed; verification required.", evidenceIds: records.map(({ evidenceId }) => evidenceId), referenceIds: [], contextIds: [], coverageCount: 0 };
    const claimKind = deriveAvailableClaimKind(records);
    const referenceIds = [...new Set(available.map(({ referenceId }) => referenceId))].sort(compare); const contextIds = [...new Set(available.map(({ contextId }) => contextId))].sort(compare);
    return { systemId, claimKind, finding: available[0].claim, evidenceIds: available.map(({ evidenceId }) => evidenceId), referenceIds, contextIds, coverageCount: referenceIds.length };
  });
}

function comparison(deepDiveValues) {
  return deepDiveValues.map((dive) => ({ comparisonId: `comparison-${dive.systemId}`, sourceSystemId: dive.systemId, claimKind: dive.claimKind, ...deriveComparisonPresentation(dive), evidenceIds: dive.evidenceIds, referenceIds: dive.referenceIds, contextIds: dive.contextIds, coverageCount: dive.coverageCount })).sort((left, right) => compare(left.comparisonId, right.comparisonId));
}

/** Stage 9: returns proposal-only transfers; no caller-supplied coverage or validation state is accepted. */
export function buildDesignTransfers({ deepDives, projectConstraints, evidence, referenceContexts, referenceSet, glossaryReceipt = null, ...unknown } = {}) {
  if (Object.keys(unknown).length !== 0 || glossaryReceipt !== null) fail("invalid-transfer");
  const dives = copy(deepDives); const constraints = copy(projectConstraints); const records = registerReferenceEvidence({ records: evidence }); const references = normalizeReferences(referenceSet); const contexts = normalizeContexts(referenceContexts, references);
  if (!Array.isArray(dives) || !Array.isArray(constraints) || constraints.length === 0 || !constraints.every(text) || new Set(constraints).size !== constraints.length) fail("invalid-transfer");
  const contextsById = new Map(contexts.map((context) => [context.contextId, context])); const referenceIds = new Set(references.map(({ referenceId }) => referenceId)); const evidenceById = new Map(records.map((record) => [record.evidenceId, record]));
  const sortedConstraints = [...constraints].sort(compare);
  return freeze(dives.map((dive) => {
    if (!exact(dive, ["systemId", "claimKind", "finding", "evidenceIds", "referenceIds", "contextIds", "coverageCount"]) || !id(dive.systemId) || !["observation", "inference", "hypothesis", "unknown"].includes(dive.claimKind) || !Array.isArray(dive.evidenceIds) || !dive.evidenceIds.every(id) || !sorted(dive.referenceIds, id, { allowEmpty: true }) || !sorted(dive.contextIds, id, { allowEmpty: true }) || !Number.isInteger(dive.coverageCount)) fail("invalid-transfer");
    const linked = dive.evidenceIds.map((evidenceId) => evidenceById.get(evidenceId));
    if (linked.some((record) => !record || !record.systemIds.includes(dive.systemId))) fail("invalid-transfer");
    const available = linked.filter(({ availability }) => availability === "available"); const computedReferenceIds = [...new Set(available.map(({ referenceId }) => referenceId))].sort(compare); const computedContextIds = [...new Set(available.map(({ contextId }) => contextId))].sort(compare);
    if (computedReferenceIds.some((referenceId) => !referenceIds.has(referenceId)) || computedContextIds.some((contextId) => !contextsById.has(contextId)) || computedContextIds.some((contextId) => contextsById.get(contextId).referenceId !== available.find((record) => record.contextId === contextId).referenceId) || dive.referenceIds.join("\0") !== computedReferenceIds.join("\0") || dive.contextIds.join("\0") !== computedContextIds.join("\0") || dive.coverageCount !== computedReferenceIds.length) fail("invalid-transfer");
    if (dive.claimKind !== deriveAvailableClaimKind(linked)) fail("invalid-transfer");
    const hold = computedReferenceIds.length < 2 || dive.claimKind === "unknown";
    return { transferId: `transfer-${dive.systemId}`, sourceSystemId: dive.systemId, decision: hold ? "hold" : "adapt", rationale: hold ? "Hold until independent reference coverage and verification are available." : "Adapt as a proposal subject to review.", evidenceIds: dive.evidenceIds, referenceIds: computedReferenceIds, contextIds: computedContextIds, coverageCount: computedReferenceIds.length, projectConstraints: sortedConstraints, risks: ["Evidence coverage must be independently verified."], validationSteps: ["Run a constrained prototype review."], validationState: "not-run", glossaryReceipt: null, reviewState: "pending-review" };
  }).sort((left, right) => compare(left.transferId, right.transferId)));
}

function verificationQueue(evidence, dives) {
  const entries = evidence.filter(({ availability }) => availability === "unavailable").map((record) => ({ verificationId: evidenceVerificationId(record.evidenceId), question: record.verificationQuestion, evidenceIds: [record.evidenceId], state: "open" }));
  for (const dive of dives.filter(({ coverageCount, claimKind }) => coverageCount < 2 || claimKind === "unknown")) entries.push({ verificationId: systemVerificationId(dive.systemId), question: systemVerificationQuestion(dive.systemId), evidenceIds: dive.evidenceIds, state: "open" });
  return entries.sort((left, right) => compare(left.verificationId, right.verificationId));
}

export function buildReferenceAnalysis(input = {}) {
  const value = copy(input); const analysisId = value.brief?.analysisId; const brief = buildReferenceBrief(value.brief); const referenceSet = normalizeReferences(value.referenceSet); const referenceContexts = normalizeContexts(value.referenceContexts, referenceSet);
  const atlasQuestions = mergeSystemAtlas(value.atlas); const atlasSelection = compactAtlas(atlasQuestions); const evidence = registerReferenceEvidence({ records: value.evidence });
  validateEvidenceBindings({ evidence, contexts: referenceContexts, systemIds: atlasSelection.map(({ systemId }) => systemId) });
  const claims = validateClaims(value.claims ?? [], evidence);
  const names = atlasNames(value.atlas); const systemInventory = inventoryReferenceSystems({ brief, atlas: atlasQuestions, evidence, claims }).map((item) => ({ ...item, name: names.get(item.systemId) ?? item.name }));
  const systemMaps = buildSystemMaps({ inventory: systemInventory, edges: value.edges, loops: value.loops ?? [] }); const priority = rankDeepDiveCandidates({ inventory: systemInventory, maps: systemMaps, questions: value.priorities ?? {} }); if (priority.length === 0) fail("unscored-priority");
  const deepDiveValues = deepDives(priority, systemInventory, evidence); const comparisonValues = comparison(deepDiveValues); const transfers = buildDesignTransfers({ deepDives: deepDiveValues, projectConstraints: value.projectConstraints, evidence, referenceContexts, referenceSet }); const queue = verificationQueue(evidence, deepDiveValues);
  const analysis = { schemaVersion: 1, analysisId, brief, referenceSet, referenceContexts, evidence, claims, atlasSelection, systemInventory, systemMaps, priority, deepDives: deepDiveValues, comparison: comparisonValues, transferDecisions: transfers, verificationQueue: queue };
  if (!validateReferenceAnalysis(analysis).ok) fail("invalid-output");
  return freeze(JSON.parse(canonicalReferenceAnalysis(analysis)));
}

function table(columns, records) { const escape = (value) => String(value).replaceAll("|", "\\|").replaceAll("\n", " "); const row = (values) => `| ${values.join(" | ")} |`; return `${row(columns)}\n${row(columns.map(() => "---"))}\n${records.map((record) => row(columns.map((column) => escape(record[column] ?? "")))).join("\n")}\n`; }
function markdown(title, columns, records) { return `# ${title}\n\n${table(columns, records)}`; }

/** Precomputes all bounded outputs before any directory creation or artifact write. */
export async function writeReferenceAnalysisWorkspace({ artifactRoot, analysis, ...unknown } = {}) {
  if (Object.keys(unknown).length !== 0) throw new Error("Unsafe artifact write path.");
  const safeAnalysis = JSON.parse(canonicalReferenceAnalysis(analysis));
  const outputs = new Map([
    [artifactFiles[0], markdown("Reference brief", ["objective", "decisionQuestions"], [{ objective: safeAnalysis.brief.objective, decisionQuestions: safeAnalysis.brief.decisionQuestions.join("; ") }])],
    [artifactFiles[1], canonicalJson(safeAnalysis.referenceSet)],
    [artifactFiles[2], canonicalJson({ referenceContexts: safeAnalysis.referenceContexts, evidence: safeAnalysis.evidence, claims: safeAnalysis.claims })],
    [artifactFiles[3], canonicalJson(safeAnalysis.systemInventory)],
    [artifactFiles[4], markdown("Analysis priority", ["rank", "systemId", ...dimensions, "rationale"], safeAnalysis.priority)],
    [artifactFiles[5], markdown("Comparison matrix", ["comparisonId", "sourceSystemId", "state", "subject", "claimKind", "coverageCount", "referenceIds", "contextIds", "finding", "evidenceIds"], safeAnalysis.comparison.map((item) => ({ ...item, evidenceIds: item.evidenceIds.join(", "), referenceIds: item.referenceIds.join(", "), contextIds: item.contextIds.join(", ") })))],
    [artifactFiles[6], markdown("Transfer decisions", ["transferId", "sourceSystemId", "decision", "coverageCount", "evidenceIds", "referenceIds", "contextIds", "projectConstraints", "risks", "validationSteps", "validationState", "reviewState", "rationale"], safeAnalysis.transferDecisions.map((item) => ({ ...item, evidenceIds: item.evidenceIds.join(", "), referenceIds: item.referenceIds.join(", "), contextIds: item.contextIds.join(", "), projectConstraints: item.projectConstraints.join(", "), risks: item.risks.join(", "), validationSteps: item.validationSteps.join(", ") })))],
    [artifactFiles[7], markdown("Verification queue", ["verificationId", "state", "question", "evidenceIds"], safeAnalysis.verificationQueue.map((item) => ({ ...item, evidenceIds: item.evidenceIds.join(", ") })))]
  ]);
  for (const map of safeAnalysis.systemMaps) outputs.set(`reference-intelligence/system-maps/${map.mapId}.json`, canonicalJson(map));
  for (const dive of safeAnalysis.deepDives) outputs.set(`reference-intelligence/deep-dives/${dive.systemId}.md`, markdown("Deep dive", ["systemId", "claimKind", "coverageCount", "referenceIds", "contextIds", "finding", "evidenceIds"], [{ ...dive, referenceIds: dive.referenceIds.join(", "), contextIds: dive.contextIds.join(", "), evidenceIds: dive.evidenceIds.join(", ") }]));
  if ([...outputs.values()].some((data) => Buffer.byteLength(data, "utf8") > 2 * 1024 * 1024)) throw new Error("Unsafe artifact write path.");
  const files = [...outputs.keys()].sort(compare);
  await ensureArtifactDirectories({ artifactRoot, directories: ["reference-intelligence", "reference-intelligence/system-maps", "reference-intelligence/deep-dives", "reference-intelligence/glossary", "reference-intelligence/decisions"] });
  for (const relativePath of files) await safeWriteArtifactFile({ artifactRoot, relativePath, data: outputs.get(relativePath) });
  return freeze({ analysisSha256: sha256Canonical(safeAnalysis), files });
}
