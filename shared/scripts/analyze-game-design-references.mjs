import { canonicalReferenceAnalysis, canonicalJson, sha256Canonical, validateReferenceAnalysis } from "./validate-reference-intelligence.mjs";
import { registerReferenceEvidence, validateClaimAgainstEvidence, validateEvidenceBindings } from "./lib/reference-evidence.mjs";
import { mergeSystemAtlas } from "./lib/system-atlas.mjs";
import { ensureArtifactDirectories, safeWriteArtifactFile } from "./lib/safe-artifact-write.mjs";

const roles = Object.freeze(["direct-competitor", "core-system-exemplar", "operations-monetization-comparator"]);
const dimensions = Object.freeze(["relevance", "playerExperienceImpact", "economyProgressionImpact", "differentiationPotential", "evidenceStrength", "uncertainty", "researchCost"]);
const claimKindRank = Object.freeze({ observation: 3, inference: 2, hypothesis: 1, unknown: 0 });
const artifactFiles = Object.freeze(["reference-intelligence/brief.md", "reference-intelligence/reference-set.yml", "reference-intelligence/evidence-register.yml", "reference-intelligence/system-inventory.json", "reference-intelligence/analysis-priority.md", "reference-intelligence/comparison-matrix.md", "reference-intelligence/transfer-decisions.md", "reference-intelligence/verification-queue.md"]);
const id = (value) => typeof value === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(value);
const text = (value) => typeof value === "string" && value.length > 0 && !value.includes("\0") && !value.includes("\r") && value === value.normalize("NFC");
const compare = (left, right) => Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));

function fail(code = "invalid") { const error = new Error("Reference analysis is invalid."); error.code = `reference-analysis.${code}`; throw error; }
function copy(value) { try { return JSON.parse(canonicalJson(value)); } catch { fail(); } }
function exact(value, keys) { return value !== null && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key)); }
function sorted(values, predicate = text) { return Array.isArray(values) && values.length > 0 && values.every(predicate) && values.every((value, index) => index === 0 || compare(values[index - 1], value) < 0); }
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
  if (!Array.isArray(claims)) fail("invalid-claim");
  const byId = new Map(evidence.map((record) => [record.evidenceId, record]));
  for (const claim of claims) {
    const result = validateClaimAgainstEvidence({ claim, evidenceById: byId });
    if (!result.ok) fail(result.code === "unsupported_claim_kind" ? "claim-kind-upgrade" : "invalid-claim");
  }
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
    const evidenceIds = registered.filter((record) => record.availability === "available" && record.systemIds.includes(systemId)).map(({ evidenceId }) => evidenceId);
    return evidenceIds.length === 0 ? undefined : { systemId, name: systemId.split("-").map((part) => part[0].toUpperCase() + part.slice(1)).join(" "), applicability: questions.some(({ applicability }) => applicability === "unknown") ? "unknown" : questions[0].applicability, evidenceIds };
  }).filter(Boolean).sort((left, right) => compare(left.systemId, right.systemId)));
}

function loopKey(nodeIds) {
  const rotations = nodeIds.map((_, index) => [...nodeIds.slice(index), ...nodeIds.slice(0, index)].join("\0"));
  return rotations.sort(compare)[0];
}

function cycles(connections) {
  const next = new Map();
  for (const connection of connections) next.set(connection.fromNodeId, [...(next.get(connection.fromNodeId) ?? []), connection.toNodeId]);
  const found = new Set();
  for (const start of [...next.keys()].sort(compare)) {
    const visit = (node, path) => {
      for (const target of next.get(node) ?? []) {
        if (target === start && path.length >= 2) found.add(loopKey(path));
        else if (!path.includes(target)) visit(target, [...path, target]);
      }
    };
    visit(start, [start]);
  }
  return found;
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
    if (!sorted(map.nodes.map(({ nodeId } = {}) => nodeId), id) || !map.nodes.every((node) => exact(node, ["nodeId", "kind", "label"]) && id(node.nodeId) && ["input", "process", "output"].includes(node.kind) && text(node.label))) fail("invalid-map");
    const nodeIds = new Set(map.nodes.map(({ nodeId }) => nodeId));
    if (!sorted(map.connections.map(({ connectionId } = {}) => connectionId), id) || !map.connections.every((connection) => exact(connection, ["connectionId", "fromNodeId", "toNodeId", "connectedSystemIds"]) && id(connection.connectionId) && nodeIds.has(connection.fromNodeId) && nodeIds.has(connection.toNodeId) && sorted(connection.connectedSystemIds, id) && connection.connectedSystemIds.every((systemId) => systems.has(systemId)))) fail("invalid-map");
    const declared = groupedLoops.get(map.mapId) ?? [];
    if (declared.some((loop) => loop.nodeIds.some((nodeId) => !nodeIds.has(nodeId)))) fail("invalid-map");
    const pairs = new Set(map.connections.map(({ fromNodeId, toNodeId }) => `${fromNodeId}\0${toNodeId}`));
    for (const loop of declared) for (let index = 0; index < loop.nodeIds.length; index += 1) if (!pairs.has(`${loop.nodeIds[index]}\0${loop.nodeIds[(index + 1) % loop.nodeIds.length]}`)) fail("invalid-map");
    const referenced = new Set([...map.connections.flatMap(({ fromNodeId, toNodeId }) => [fromNodeId, toNodeId]), ...declared.flatMap(({ nodeIds }) => nodeIds)]);
    if ([...nodeIds].some((nodeId) => !referenced.has(nodeId))) fail("invalid-map");
    const declaredCycles = new Set(declared.map(({ nodeIds }) => loopKey(nodeIds)));
    if ([...cycles(map.connections)].some((key) => !declaredCycles.has(key))) fail("cycle");
    return { ...map, loops: declared.sort((left, right) => compare(left.loopId, right.loopId)) };
  });
  if ([...groupedLoops.keys()].some((mapId) => !mapIds.has(mapId))) fail("invalid-map");
  return freeze(result.sort((left, right) => compare(left.mapId, right.mapId)));
}

function completePriority(value) { return exact(value, dimensions) && dimensions.every((field) => Number.isInteger(value[field]) && value[field] >= 1 && value[field] <= 5); }

/** Stage 6: retains all seven scoring dimensions; research cost is an inverse deterministic tie-break. */
export function rankDeepDiveCandidates({ inventory, maps, questions = {} } = {}) {
  const items = copy(inventory); const mapValues = copy(maps); const scoring = copy(questions);
  if (!Array.isArray(items) || !Array.isArray(mapValues) || !scoring || typeof scoring !== "object" || Array.isArray(scoring)) fail("invalid-priority");
  const mapped = new Set(mapValues.map(({ systemId }) => systemId));
  return freeze(items.filter(({ systemId }) => mapped.has(systemId) && completePriority(scoring[systemId])).map((item) => ({ ...item, ...scoring[item.systemId] })).sort((left, right) => {
    const score = (value) => dimensions.slice(0, 6).reduce((sum, field) => sum + value[field], 0);
    return score(right) - score(left) || left.researchCost - right.researchCost || compare(left.systemId, right.systemId);
  }).map((item, index) => ({ systemId: item.systemId, rank: index + 1, rationale: "All seven priority dimensions are explicitly scored.", ...Object.fromEntries(dimensions.map((field) => [field, item[field]])) })));
}

function deepDives(priority, inventory, evidence) {
  const inventoryBySystem = new Map(inventory.map((item) => [item.systemId, item])); const evidenceById = new Map(evidence.map((item) => [item.evidenceId, item]));
  return priority.map(({ systemId }) => {
    const records = inventoryBySystem.get(systemId).evidenceIds.map((evidenceId) => evidenceById.get(evidenceId)).filter((record) => record?.availability === "available" && record.systemIds.includes(systemId)).sort((left, right) => compare(left.evidenceId, right.evidenceId));
    if (records.length === 0) fail("missing-evidence");
    const claimKind = records.reduce((lowest, record) => claimKindRank[record.claimKind] < claimKindRank[lowest] ? record.claimKind : lowest, records[0].claimKind);
    const referenceIds = [...new Set(records.map(({ referenceId }) => referenceId))].sort(compare); const contextIds = [...new Set(records.map(({ contextId }) => contextId))].sort(compare);
    return { systemId, claimKind, finding: records[0].claim, evidenceIds: records.map(({ evidenceId }) => evidenceId), referenceIds, contextIds, coverageCount: referenceIds.length };
  });
}

function comparison(deepDiveValues) {
  return deepDiveValues.map((dive) => ({ comparisonId: `comparison-${dive.systemId}`, subject: dive.systemId.split("-").join(" "), finding: dive.coverageCount < 2 || dive.claimKind === "unknown" ? "Hold comparison conclusion pending sufficient observed reference coverage." : "Comparison remains evidence-bounded and pending review.", evidenceIds: dive.evidenceIds, referenceIds: dive.referenceIds, contextIds: dive.contextIds, coverageCount: dive.coverageCount })).sort((left, right) => compare(left.comparisonId, right.comparisonId));
}

/** Stage 9: returns proposal-only transfers; no caller-supplied coverage or validation state is accepted. */
export function buildDesignTransfers({ deepDives, projectConstraints = [], glossaryReceipt = null, ...unknown } = {}) {
  if (Object.keys(unknown).length !== 0 || glossaryReceipt !== null) fail("invalid-transfer");
  const dives = copy(deepDives); const constraints = copy(projectConstraints);
  if (!Array.isArray(dives) || !Array.isArray(constraints) || !constraints.every(text) || new Set(constraints).size !== constraints.length) fail("invalid-transfer");
  const sortedConstraints = [...constraints].sort(compare);
  return freeze(dives.map((dive) => {
    if (!exact(dive, ["systemId", "claimKind", "finding", "evidenceIds", "referenceIds", "contextIds", "coverageCount"]) || !id(dive.systemId) || !["observation", "inference", "hypothesis", "unknown"].includes(dive.claimKind) || !sorted(dive.evidenceIds, id) || !sorted(dive.referenceIds, id) || !sorted(dive.contextIds, id) || dive.coverageCount !== dive.referenceIds.length) fail("invalid-transfer");
    const hold = dive.coverageCount < 2 || dive.claimKind === "unknown";
    return { transferId: `transfer-${dive.systemId}`, sourceSystemId: dive.systemId, decision: hold ? "hold" : "adapt", rationale: hold ? "Hold until independent reference coverage and verification are available." : "Adapt as a proposal subject to review.", evidenceIds: dive.evidenceIds, referenceIds: dive.referenceIds, contextIds: dive.contextIds, coverageCount: dive.coverageCount, projectConstraints: sortedConstraints, risks: ["Evidence coverage must be independently verified."], validationSteps: ["Run a constrained prototype review."], validationState: "not-run", glossaryReceipt: null, reviewState: "pending-review" };
  }).sort((left, right) => compare(left.transferId, right.transferId)));
}

function verificationQueue(evidence, dives) {
  const entries = evidence.filter(({ availability }) => availability === "unavailable").map((record) => ({ verificationId: `verify-${record.evidenceId}`, question: record.verificationQuestion, evidenceIds: [record.evidenceId], state: "open" }));
  for (const dive of dives.filter(({ coverageCount, claimKind }) => coverageCount < 2 || claimKind === "unknown")) entries.push({ verificationId: `verify-${dive.systemId}`, question: `What independent observation can verify ${dive.systemId}?`, evidenceIds: dive.evidenceIds, state: "open" });
  return entries.sort((left, right) => compare(left.verificationId, right.verificationId));
}

export function buildReferenceAnalysis(input = {}) {
  const value = copy(input); const analysisId = value.brief?.analysisId; const brief = buildReferenceBrief(value.brief); const referenceSet = normalizeReferences(value.referenceSet); const referenceContexts = normalizeContexts(value.referenceContexts, referenceSet);
  const atlasQuestions = mergeSystemAtlas(value.atlas); const atlasSelection = compactAtlas(atlasQuestions); const evidence = registerReferenceEvidence({ records: value.evidence });
  validateEvidenceBindings({ evidence, contexts: referenceContexts, systemIds: atlasSelection.map(({ systemId }) => systemId) });
  validateClaims(value.claims ?? [], evidence);
  const names = atlasNames(value.atlas); const systemInventory = inventoryReferenceSystems({ brief, atlas: atlasQuestions, evidence, claims: value.claims ?? [] }).map((item) => ({ ...item, name: names.get(item.systemId) ?? item.name }));
  const systemMaps = buildSystemMaps({ inventory: systemInventory, edges: value.edges, loops: value.loops ?? [] }); const priority = rankDeepDiveCandidates({ inventory: systemInventory, maps: systemMaps, questions: value.priorities ?? {} }); if (priority.length === 0) fail("unscored-priority");
  const deepDiveValues = deepDives(priority, systemInventory, evidence); const comparisonValues = comparison(deepDiveValues); const transfers = buildDesignTransfers({ deepDives: deepDiveValues, projectConstraints: value.projectConstraints ?? [] }); const queue = verificationQueue(evidence, deepDiveValues);
  const analysis = { schemaVersion: 1, analysisId, brief, referenceSet, referenceContexts, evidence, atlasSelection, systemInventory, systemMaps, priority, deepDives: deepDiveValues, comparison: comparisonValues, transferDecisions: transfers, verificationQueue: queue };
  if (!validateReferenceAnalysis(analysis).ok) fail("invalid-output");
  return freeze(JSON.parse(canonicalReferenceAnalysis(analysis)));
}

function table(columns, records) { const escape = (value) => String(value).replaceAll("|", "\\|").replaceAll("\n", " "); return `${columns.join(" | ")}\n${columns.map(() => "---").join(" | ")}\n${records.map((record) => columns.map((column) => escape(record[column] ?? "")).join(" | ")).join("\n")}\n`; }
function markdown(title, columns, records) { return `# ${title}\n\n${table(columns, records)}`; }

/** Precomputes all bounded outputs before any directory creation or artifact write. */
export async function writeReferenceAnalysisWorkspace({ artifactRoot, analysis, ...unknown } = {}) {
  if (Object.keys(unknown).length !== 0) throw new Error("Unsafe artifact write path.");
  const safeAnalysis = JSON.parse(canonicalReferenceAnalysis(analysis));
  const outputs = new Map([
    [artifactFiles[0], markdown("Reference brief", ["objective", "decisionQuestions"], [{ objective: safeAnalysis.brief.objective, decisionQuestions: safeAnalysis.brief.decisionQuestions.join("; ") }])],
    [artifactFiles[1], canonicalJson(safeAnalysis.referenceSet)],
    [artifactFiles[2], canonicalJson({ referenceContexts: safeAnalysis.referenceContexts, evidence: safeAnalysis.evidence })],
    [artifactFiles[3], canonicalJson(safeAnalysis.systemInventory)],
    [artifactFiles[4], markdown("Analysis priority", ["rank", "systemId", ...dimensions, "rationale"], safeAnalysis.priority)],
    [artifactFiles[5], markdown("Comparison matrix", ["comparisonId", "subject", "coverageCount", "referenceIds", "contextIds", "finding", "evidenceIds"], safeAnalysis.comparison.map((item) => ({ ...item, evidenceIds: item.evidenceIds.join(", "), referenceIds: item.referenceIds.join(", "), contextIds: item.contextIds.join(", ") })))],
    [artifactFiles[6], markdown("Transfer decisions", ["transferId", "decision", "coverageCount", "evidenceIds", "referenceIds", "contextIds", "projectConstraints", "risks", "validationSteps", "validationState", "reviewState", "rationale"], safeAnalysis.transferDecisions.map((item) => ({ ...item, evidenceIds: item.evidenceIds.join(", "), referenceIds: item.referenceIds.join(", "), contextIds: item.contextIds.join(", "), projectConstraints: item.projectConstraints.join(", "), risks: item.risks.join(", "), validationSteps: item.validationSteps.join(", ") })))],
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
