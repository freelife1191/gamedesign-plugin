import { canonicalReferenceAnalysis, canonicalJson, sha256Canonical, validateReferenceAnalysis } from "./validate-reference-intelligence.mjs";
import { registerReferenceEvidence, validateClaimAgainstEvidence } from "./lib/reference-evidence.mjs";
import { mergeSystemAtlas } from "./lib/system-atlas.mjs";
import { ensureArtifactDirectories, safeWriteArtifactFile } from "./lib/safe-artifact-write.mjs";

const roles = Object.freeze(["direct-competitor", "core-system-exemplar", "operations-monetization-comparator"]);
const claimKindRank = Object.freeze({ observation: 3, inference: 2, hypothesis: 1, unknown: 0 });
const priorityDimensions = Object.freeze([
  "relevance",
  "playerExperienceImpact",
  "economyProgressionImpact",
  "differentiationPotential",
  "evidenceStrength",
  "uncertainty",
  "researchCost",
]);
const artifactFiles = Object.freeze([
  "reference-intelligence/brief.md",
  "reference-intelligence/reference-set.yml",
  "reference-intelligence/evidence-register.yml",
  "reference-intelligence/system-inventory.json",
  "reference-intelligence/analysis-priority.md",
  "reference-intelligence/comparison-matrix.md",
  "reference-intelligence/transfer-decisions.md",
  "reference-intelligence/verification-queue.md",
]);
const safeId = (value) => typeof value === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(value);
const safeText = (value) => typeof value === "string" && value.length > 0 && !value.includes("\0") && !value.includes("\r") && value === value.normalize("NFC");
const byteCompare = (left, right) => Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));

function fail(code = "invalid") {
  const error = new Error("Reference analysis is invalid.");
  error.code = `reference-analysis.${code}`;
  throw error;
}

function copy(value) {
  try {
    return JSON.parse(canonicalJson(value));
  } catch {
    fail();
  }
}

function exactObject(value, keys) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function sortedUnique(values, validator = safeText) {
  return Array.isArray(values) && values.length > 0 && values.every(validator)
    && values.every((value, index) => index === 0 || byteCompare(values[index - 1], value) < 0);
}

function freeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

function validAvailability(record) {
  return (record.availability === "available" && record.limitation === null)
    || (record.availability === "unavailable" && safeText(record.limitation));
}

/** Builds the stage-0 brief while retaining its analysis identifier only internally. */
export function buildReferenceBrief(input = {}) {
  const value = copy(input);
  if (!exactObject(value, ["analysisId", "objective", "decisionQuestions"])
    || !safeId(value.analysisId) || !safeText(value.objective) || !sortedUnique(value.decisionQuestions)) fail("invalid-brief");
  return freeze({ objective: value.objective, decisionQuestions: value.decisionQuestions });
}

function analysisIdFromBrief(input) {
  const value = copy(input);
  if (!safeId(value.analysisId)) fail("invalid-brief");
  return value.analysisId;
}

function normalizeReferenceSet(input) {
  const values = copy(input);
  if (!Array.isArray(values) || values.length !== roles.length) fail("invalid-reference-set");
  const byRole = new Map();
  for (const value of values) {
    if (!exactObject(value, ["referenceId", "label", "role", "availability", "limitation"])
      || !safeId(value.referenceId) || !safeText(value.label) || !roles.includes(value.role) || !validAvailability(value)) fail("invalid-reference-set");
    if (byRole.has(value.role)) fail("invalid-reference-set");
    byRole.set(value.role, value);
  }
  if (roles.some((role) => !byRole.has(role))) fail("invalid-reference-set");
  return freeze([...byRole.values()].sort((left, right) => byteCompare(`${left.referenceId}\0${left.role}`, `${right.referenceId}\0${right.role}`)));
}

function validateReferenceContexts(contexts, referenceSet) {
  if (contexts === undefined) return;
  const values = copy(contexts);
  if (!Array.isArray(values)) fail("invalid-context");
  const references = new Set(referenceSet.map(({ referenceId }) => referenceId));
  const seenVersion = new Map();
  for (const value of values) {
    if (!exactObject(value, ["referenceId", "platform", "version"]) || !safeId(value.referenceId) || !safeId(value.platform) || !safeText(value.version) || !references.has(value.referenceId)) fail("invalid-context");
    const key = `${value.referenceId}\0${value.version}`;
    const platform = seenVersion.get(key);
    if (platform !== undefined && platform !== value.platform) fail("conflicting-claim");
    seenVersion.set(key, value.platform);
  }
}

function compactAtlasSelection(questions) {
  const bySystem = new Map();
  for (const question of questions) {
    const previous = bySystem.get(question.systemId) ?? [];
    previous.push(question.rationale);
    bySystem.set(question.systemId, previous);
  }
  return [...bySystem.entries()].map(([systemId, rationales]) => ({
    systemId,
    rationale: [...new Set(rationales)].sort(byteCompare).join(" "),
  })).sort((left, right) => byteCompare(left.systemId, right.systemId));
}

function atlasSystemNames(selection) {
  const atlas = copy(selection).atlas;
  if (!atlas || !Array.isArray(atlas.systems)) fail("invalid-atlas");
  return new Map(atlas.systems.map(({ systemId, name }) => [systemId, name]));
}

/** Inventories the selected atlas systems without assigning an evaluation. */
export function inventoryReferenceSystems({ brief, atlas, evidence, claims = [] } = {}) {
  const safeBrief = copy(brief);
  if (!exactObject(safeBrief, ["objective", "decisionQuestions"]) || !safeText(safeBrief.objective) || !sortedUnique(safeBrief.decisionQuestions)) fail("invalid-brief");
  const selected = copy(atlas);
  const registered = registerReferenceEvidence({ records: evidence });
  const evidenceIds = registered.map(({ evidenceId }) => evidenceId);
  if (evidenceIds.length === 0) fail("missing-evidence");
  validateClaims(claims, registered);
  const bySystem = new Map();
  for (const item of selected) {
    const question = exactObject(item, ["questionId", "systemId", "applicability", "rationale", "conditions", "verificationPrompts"])
      ? item
      : exactObject(item, ["systemId", "rationale"])
        ? { ...item, applicability: "unknown" }
        : undefined;
    if (!question || !safeId(question.systemId) || !["required-candidate", "conditional", "optional", "not-applicable", "unknown"].includes(question.applicability)
      || !safeText(question.rationale)) fail("invalid-atlas");
    const existing = bySystem.get(question.systemId) ?? [];
    existing.push(question);
    bySystem.set(question.systemId, existing);
  }
  return freeze([...bySystem.entries()].map(([systemId, questions]) => ({
    systemId,
    name: systemId.split("-").map((word) => word[0].toUpperCase() + word.slice(1)).join(" "),
    applicability: questions.some(({ applicability }) => applicability === "unknown") ? "unknown" : questions[0].applicability,
    evidenceIds,
  })).sort((left, right) => byteCompare(left.systemId, right.systemId)));
}

function validateClaims(claims, evidence) {
  if (!Array.isArray(claims)) fail("invalid-claim");
  const evidenceById = new Map(evidence.map((record) => [record.evidenceId, record]));
  for (const claim of claims) {
    const result = validateClaimAgainstEvidence({ claim, evidenceById });
    if (!result.ok) fail(result.code === "unsupported_claim_kind" ? "claim-kind-upgrade" : "invalid-claim");
  }
}

/** Validates system maps and rejects unknown systems, invalid IDs, and unverified cycles. */
export function buildSystemMaps({ inventory, edges, loops = [] } = {}) {
  const systems = copy(inventory);
  const maps = copy(edges);
  const loopValues = copy(loops);
  if (!Array.isArray(systems) || !Array.isArray(maps) || maps.length === 0 || !Array.isArray(loopValues)) fail("invalid-map");
  const systemIds = new Set(systems.map(({ systemId }) => systemId));
  const mapIds = new Set();
  for (const map of maps) {
    if (!exactObject(map, ["mapId", "systemId", "nodes", "edges"])
      || !safeId(map.mapId) || !systemIds.has(map.systemId) || !sortedUnique(map.nodes) || !sortedUnique(map.edges) || mapIds.has(map.mapId)) fail("invalid-map");
    mapIds.add(map.mapId);
  }
  for (const loop of loopValues) {
    if (!exactObject(loop, ["mapId", "nodes"]) || !safeId(loop.mapId) || !mapIds.has(loop.mapId) || !sortedUnique(loop.nodes)) fail("invalid-map");
    fail("cycle");
  }
  return freeze(maps.sort((left, right) => byteCompare(left.mapId, right.mapId)));
}

function completePriority(value) {
  return exactObject(value, priorityDimensions)
    && priorityDimensions.every((dimension) => Number.isInteger(value[dimension]) && value[dimension] >= 1 && value[dimension] <= 5);
}

/** Ranks only candidates with all seven explicit 1–5 dimensions. */
export function rankDeepDiveCandidates({ inventory, maps, questions = {} } = {}) {
  const items = copy(inventory);
  const mapValues = copy(maps);
  const dimensions = copy(questions);
  if (!Array.isArray(items) || !Array.isArray(mapValues) || dimensions === null || typeof dimensions !== "object" || Array.isArray(dimensions)) fail("invalid-priority");
  const mapped = new Set(mapValues.map(({ systemId }) => systemId));
  const candidates = items.filter(({ systemId }) => mapped.has(systemId) && completePriority(dimensions[systemId]));
  return freeze(candidates.map((item) => ({ ...item, dimensions: dimensions[item.systemId] }))
    .sort((left, right) => {
      const leftScore = priorityDimensions.slice(0, 6).reduce((sum, dimension) => sum + left.dimensions[dimension], 0);
      const rightScore = priorityDimensions.slice(0, 6).reduce((sum, dimension) => sum + right.dimensions[dimension], 0);
      return rightScore - leftScore || left.dimensions.researchCost - right.dimensions.researchCost || byteCompare(left.systemId, right.systemId);
    })
    .map(({ systemId }, index) => ({ systemId, rank: index + 1, rationale: "All seven priority dimensions are explicitly scored." })));
}

function buildDeepDives({ priority, inventory, evidence }) {
  const bySystem = new Map(inventory.map((item) => [item.systemId, item]));
  const byId = new Map(evidence.map((item) => [item.evidenceId, item]));
  return priority.map(({ systemId }) => {
    const item = bySystem.get(systemId);
    const supported = item.evidenceIds.map((id) => byId.get(id)).filter(({ availability }) => availability === "available");
    const source = supported.sort((left, right) => byteCompare(left.evidenceId, right.evidenceId))[0] ?? byId.get(item.evidenceIds[0]);
    return {
      systemId,
      claimKind: source.availability === "available" ? source.claimKind : "unknown",
      finding: source.availability === "available" ? source.claim : "Not observed; verification required.",
      evidenceIds: [source.evidenceId],
    };
  });
}

function compareReferenceSolutions({ referenceSet, deepDives }) {
  const uniqueReferences = new Set(referenceSet.map(({ referenceId }) => referenceId)).size;
  return deepDives.map((dive) => ({
    comparisonId: `comparison-${dive.systemId}`,
    subject: dive.systemId.split("-").join(" "),
    finding: uniqueReferences < 2 || dive.claimKind === "unknown"
      ? "Hold comparison conclusion pending sufficient observed reference coverage."
      : "Comparison remains evidence-bounded and pending review.",
    evidenceIds: dive.evidenceIds,
  })).sort((left, right) => byteCompare(left.comparisonId, right.comparisonId));
}

/** Produces proposal-only transfers; this function never changes a system specification. */
export function buildDesignTransfers({ deepDives, projectConstraints = [], uniqueReferenceCount = 2 } = {}) {
  const dives = copy(deepDives);
  const constraints = copy(projectConstraints);
  if (!Array.isArray(dives) || !Array.isArray(constraints) || !constraints.every(safeText) || !Number.isInteger(uniqueReferenceCount)) fail("invalid-transfer");
  return freeze(dives.map((dive) => ({
    transferId: `transfer-${dive.systemId}`,
    sourceSystemId: dive.systemId,
    decision: uniqueReferenceCount < 2 || dive.claimKind === "unknown" ? "hold" : "adapt",
    rationale: uniqueReferenceCount < 2 || dive.claimKind === "unknown"
      ? "Hold until independent reference coverage and verification are available."
      : `Adapt as a proposal within constraints: ${[...constraints].sort(byteCompare).join(", ")}.`,
    evidenceIds: dive.evidenceIds,
    glossaryReceipt: {
      documentId: "reference-analysis-transfer",
      glossaryVersion: 1,
      glossarySha256: "0".repeat(64),
      termIds: ["TERM-REFERENCE-ANALYSIS"],
    },
    reviewState: "pending-review",
  })).sort((left, right) => byteCompare(left.transferId, right.transferId)));
}

function collectVerificationQueue({ evidence, deepDives }) {
  const entries = evidence.filter(({ availability }) => availability === "unavailable").map((record) => ({
    verificationId: `verify-${record.evidenceId}`,
    question: record.verificationQuestion,
    evidenceIds: [record.evidenceId],
    state: "open",
  }));
  for (const dive of deepDives.filter(({ claimKind }) => claimKind === "unknown")) entries.push({
    verificationId: `verify-${dive.systemId}`,
    question: `What direct observation can verify ${dive.systemId}?`,
    evidenceIds: dive.evidenceIds,
    state: "open",
  });
  if (entries.length === 0 && deepDives.length > 0) entries.push({
    verificationId: "verify-reference-coverage",
    question: "Which independent reference can verify this comparison?",
    evidenceIds: deepDives[0].evidenceIds,
    state: "open",
  });
  return entries.sort((left, right) => byteCompare(left.verificationId, right.verificationId));
}

/** Runs the fixed 0–9 reference-analysis sequence and returns a validated immutable analysis. */
export function buildReferenceAnalysis(input = {}) {
  const value = copy(input);
  const analysisId = analysisIdFromBrief(value.brief);
  const brief = buildReferenceBrief(value.brief);
  const referenceSet = normalizeReferenceSet(value.referenceSet);
  validateReferenceContexts(value.referenceContexts, referenceSet);
  const evidence = registerReferenceEvidence({ records: value.evidence });
  const atlasQuestions = mergeSystemAtlas(value.atlas);
  const names = atlasSystemNames(value.atlas);
  const systemInventory = inventoryReferenceSystems({ brief, atlas: atlasQuestions, evidence, claims: value.claims ?? [] })
    .map((item) => ({ ...item, name: names.get(item.systemId) ?? item.name }));
  const atlasSelection = compactAtlasSelection(atlasQuestions);
  const systemMaps = buildSystemMaps({ inventory: systemInventory, edges: value.edges, loops: value.loops ?? [] });
  const priority = rankDeepDiveCandidates({ inventory: systemInventory, maps: systemMaps, questions: value.priorities ?? {} });
  if (priority.length === 0) fail("unscored-priority");
  const deepDives = buildDeepDives({ priority, inventory: systemInventory, evidence });
  const comparison = compareReferenceSolutions({ referenceSet, deepDives });
  const transferDecisions = buildDesignTransfers({
    deepDives,
    projectConstraints: value.projectConstraints ?? [],
    uniqueReferenceCount: new Set(referenceSet.map(({ referenceId }) => referenceId)).size,
  });
  const verificationQueue = collectVerificationQueue({ evidence, deepDives });
  const analysis = {
    schemaVersion: 1,
    analysisId,
    brief,
    referenceSet,
    evidence,
    atlasSelection,
    systemInventory,
    systemMaps,
    priority,
    deepDives,
    comparison,
    transferDecisions,
    verificationQueue,
  };
  if (!validateReferenceAnalysis(analysis).ok) fail("invalid-output");
  return freeze(JSON.parse(canonicalReferenceAnalysis(analysis)));
}

function markdownTable(columns, records) {
  const escape = (value) => String(value).replaceAll("|", "\\|").replaceAll("\n", " ");
  return `${columns.map(escape).join(" | ")}\n${columns.map(() => "---").join(" | ")}\n${records.map((record) => columns.map((column) => escape(record[column] ?? "")).join(" | ")).join("\n")}\n`;
}

function markdown(title, columns, records) {
  return `# ${title}\n\n${markdownTable(columns, records)}`;
}

/** Safely projects one canonical analysis into its fixed workspace artifact paths. */
export async function writeReferenceAnalysisWorkspace({ artifactRoot, analysis, ...unknown } = {}) {
  if (Object.keys(unknown).length !== 0) throw new Error("Unsafe artifact write path.");
  const safeAnalysis = JSON.parse(canonicalReferenceAnalysis(analysis));
  await ensureArtifactDirectories({ artifactRoot, directories: [
    "reference-intelligence",
    "reference-intelligence/system-maps",
    "reference-intelligence/deep-dives",
    "reference-intelligence/glossary",
    "reference-intelligence/decisions",
  ] });
  const outputs = new Map([
    [artifactFiles[0], markdown("Reference brief", ["objective", "decisionQuestions"], [{ objective: safeAnalysis.brief.objective, decisionQuestions: safeAnalysis.brief.decisionQuestions.join("; ") }])],
    [artifactFiles[1], canonicalJson(safeAnalysis.referenceSet)],
    [artifactFiles[2], canonicalJson(safeAnalysis.evidence)],
    [artifactFiles[3], canonicalJson(safeAnalysis.systemInventory)],
    [artifactFiles[4], markdown("Analysis priority", ["rank", "systemId", "rationale"], safeAnalysis.priority)],
    [artifactFiles[5], markdown("Comparison matrix", ["comparisonId", "subject", "finding", "evidenceIds"], safeAnalysis.comparison.map((item) => ({ ...item, evidenceIds: item.evidenceIds.join(", ") })))],
    [artifactFiles[6], markdown("Transfer decisions", ["transferId", "sourceSystemId", "decision", "reviewState", "rationale"], safeAnalysis.transferDecisions)],
    [artifactFiles[7], markdown("Verification queue", ["verificationId", "state", "question", "evidenceIds"], safeAnalysis.verificationQueue.map((item) => ({ ...item, evidenceIds: item.evidenceIds.join(", ") })))],
  ]);
  for (const map of safeAnalysis.systemMaps) outputs.set(`reference-intelligence/system-maps/${map.mapId}.json`, canonicalJson(map));
  for (const dive of safeAnalysis.deepDives) outputs.set(`reference-intelligence/deep-dives/${dive.systemId}.md`, markdown("Deep dive", ["systemId", "claimKind", "finding", "evidenceIds"], [{ ...dive, evidenceIds: dive.evidenceIds.join(", ") }]));
  const files = [...outputs.keys()].sort(byteCompare);
  for (const relativePath of files) await safeWriteArtifactFile({ artifactRoot, relativePath, data: outputs.get(relativePath) });
  return freeze({ analysisSha256: sha256Canonical(safeAnalysis), files });
}
