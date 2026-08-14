import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, readdir, realpath, rename, rm, symlink, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";

import {
  canonicalJson,
  canonicalReferenceAnalysis,
  sha256Canonical,
  validateReferenceAnalysis,
} from "../../shared/scripts/validate-reference-intelligence.mjs";
import {
  registerReferenceEvidence,
  validateClaimAgainstEvidence,
} from "../../shared/scripts/lib/reference-evidence.mjs";
import {
  loadBundledReferenceCatalog,
  mergeSystemAtlas,
} from "../../shared/scripts/lib/system-atlas.mjs";
import {
  buildDesignTransfers,
  buildReferenceAnalysis,
  buildReferenceBrief,
  buildSystemMaps,
  inventoryReferenceSystems,
  rankDeepDiveCandidates,
  writeReferenceAnalysisWorkspace,
} from "../../shared/scripts/analyze-game-design-references.mjs";

function validReferenceAnalysis() {
  return {
    schemaVersion: 1,
    analysisId: "cutscene-reference-v1",
    brief: {
      objective: "Identify reusable cutscene pacing patterns.",
      decisionQuestions: ["question-agency-loop"],
      playerExperiencePromise: "Each reveal leads to a legible player choice.",
      differentiationHypotheses: ["choice-first"], genreHypotheses: ["action-rpg"], platformHypotheses: ["pc"], businessModelHypotheses: ["premium"],
      researchScope: ["observable-loop"], exclusionScope: ["private-metrics"], constraints: { time: "two-hours", materials: ["local-notes"], languages: ["ko"], regions: ["kr"] },
      forbiddenConclusions: ["revenue-causality"], completionCriteria: ["human-review"], humanReviewer: "Lead Designer",
    },
    referenceSet: [
      { referenceId: "ref-cinematic-sample", label: "Cinematic sample", role: "core-system-exemplar", decisionQuestionIds: ["question-agency-loop"], availability: "available", limitation: null },
      { referenceId: "ref-cinematic-sample", label: "Cinematic sample", role: "direct-competitor", decisionQuestionIds: ["question-agency-loop"], availability: "available", limitation: null },
      { referenceId: "ref-cinematic-sample", label: "Cinematic sample", role: "operations-monetization-comparator", decisionQuestionIds: ["question-agency-loop"], availability: "unavailable", limitation: "No comparable operations evidence is available." },
    ],
    referenceContexts: [{ contextId: "ctx-cinematic-v1", referenceId: "ref-cinematic-sample", version: "1", platform: "pc" }],
    evidence: [{
      evidenceId: "evidence-cinematic-loop",
      referenceId: "ref-cinematic-sample",
      contextId: "ctx-cinematic-v1",
      systemIds: ["system-reveal-loop"],
      tier: "primary",
      sourceType: "direct-play",
      availability: "available",
      limitation: null,
      verificationQuestion: null,
      claimKind: "observation",
      claim: "The player receives a movement choice after the reveal.",
      build: "1.0.0", region: "kr", accountState: "guest", observedAt: "2026-08-13T00:00:00.000Z", locator: { kind: "project-relative", value: "evidence/reveal.png" }, screen: "reveal", action: "move", result: "choice", transformations: [{ from: "original", to: "capture" }, { from: "capture", to: "summary" }], rights: { copyright: "reference-owner", use: "analysis", publication: "private" }, conflictState: "none", counterexampleOf: null,
    }],
    claims: [],
    atlasSelection: [{ questionId: "question-reveal-loop", systemId: "system-reveal-loop", applicability: "required-candidate", rationale: "Supports the decision question.", conditions: ["if-reveal"], verificationPrompts: ["verify-reveal"] }],
    systemInventory: [{
      systemId: "system-reveal-loop",
      name: "Reveal loop",
      applicability: "required-candidate",
      evidenceIds: ["evidence-cinematic-loop"],
    }],
    systemMaps: [{
      mapId: "map-reveal-loop",
      systemId: "system-reveal-loop",
      nodes: [{ nodeId: "choice", kind: "output", label: "Choice" }, { nodeId: "process", kind: "process", label: "Process" }, { nodeId: "reveal", kind: "input", label: "Reveal" }],
      connections: [{ connectionId: "process-to-choice", fromNodeId: "process", toNodeId: "choice", connectedSystemIds: ["system-reveal-loop"] }, { connectionId: "reveal-to-process", fromNodeId: "reveal", toNodeId: "process", connectedSystemIds: ["system-reveal-loop"] }],
      loops: [],
    }],
    priority: [{ systemId: "system-reveal-loop", rank: 1, rationale: "Directly answers the brief.", relevance: 5, playerExperienceImpact: 5, economyProgressionImpact: 1, differentiationPotential: 3, evidenceStrength: 5, uncertainty: 1, researchCost: 1 }],
    deepDives: [{
      systemId: "system-reveal-loop",
      claimKind: "observation",
      finding: "A choice after a reveal preserves agency.",
      evidenceIds: ["evidence-cinematic-loop"],
      referenceIds: ["ref-cinematic-sample"], contextIds: ["ctx-cinematic-v1"], coverageCount: 1,
    }],
    comparison: [{
      comparisonId: "comparison-system-reveal-loop",
      sourceSystemId: "system-reveal-loop",
      state: "hold",
      subject: "system reveal loop",
      claimKind: "observation",
      finding: "Hold comparison conclusion pending sufficient observed reference coverage.",
      evidenceIds: ["evidence-cinematic-loop"],
      referenceIds: ["ref-cinematic-sample"], contextIds: ["ctx-cinematic-v1"], coverageCount: 1,
    }],
    transferDecisions: [{
      transferId: "transfer-reveal-loop",
      sourceSystemId: "system-reveal-loop",
      decision: "hold",
      rationale: "Keep the agency beat while changing fiction.",
      evidenceIds: ["evidence-cinematic-loop"],
      referenceIds: ["ref-cinematic-sample"], contextIds: ["ctx-cinematic-v1"], coverageCount: 1,
      projectConstraints: ["ten-minute-session"], risks: ["Evidence coverage must be independently verified."], validationSteps: ["Run a constrained prototype review."], validationState: "not-run", glossaryReceipt: null,
      reviewState: "pending-review",
    }],
    verificationQueue: [{
      verificationId: "verify-system-system-reveal-loop",
      question: "What independent observation can verify system-reveal-loop?",
      evidenceIds: ["evidence-cinematic-loop"],
      state: "open",
    }],
  };
}

const referenceSystemIds = [
  "core-play", "player-character", "progression", "collection-crafting",
  "economy", "rewards", "content", "social", "monetization", "retention",
  "meta-liveops", "ux-accessibility", "account-platform", "session-network",
  "failure-recovery", "operations-telemetry",
];
const bundledReferenceRoot = await realpath(fileURLToPath(new URL("../../shared/reference-intelligence/", import.meta.url)));

function atlasQuestion(questionId, applicability, conditions = []) {
  return {
    questionId,
    systemId: "economy",
    applicability,
    rationale: "Test question.",
    conditions,
    verificationPrompts: ["Verify this question."],
  };
}

function strictAtlas(overlays) {
  return {
    version: 1,
    systems: referenceSystemIds.map((systemId) => ({ systemId, name: `${systemId} system` })),
    questions: [],
    overlays: {
      genre: [],
      "play-mode": [],
      platform: [],
      "business-model": [],
      ...overlays,
    },
  };
}

function registryEvidence(overrides = {}) {
  return {
    evidenceId: "ev-default",
    referenceId: "ref-cinematic-sample",
    contextId: "ctx-cinematic-v1",
    systemIds: ["system-reveal-loop"],
    sourceType: "official-site",
    claimKind: "observation",
    claim: "A direct evidence record for registry validation.",
    availability: "available",
    limitation: null,
    verificationQuestion: null,
    build: "1.0.0", region: "kr", accountState: "guest", observedAt: "2026-08-13T00:00:00.000Z", locator: { kind: "project-relative", value: "evidence/registry.png" }, screen: "loop", action: "observe", result: "choice", transformations: [{ from: "original", to: "capture" }, { from: "capture", to: "summary" }], rights: { copyright: "reference-owner", use: "analysis", publication: "private" }, conflictState: "none", counterexampleOf: null,
    ...overrides,
  };
}

test("canonical JSON has stable key ordering and a stable SHA-256 digest", () => {
  assert.equal(canonicalJson({ b: 1, a: [true, null] }), '{"a":[true,null],"b":1}');
  assert.equal(sha256Canonical({ b: 1, a: [true, null] }), sha256Canonical({ a: [true, null], b: 1 }));
});

test("canonical JSON rejects hidden object and array state while preserving an own __proto__ key", () => {
  const withSymbol = { value: "safe" };
  withSymbol[Symbol("hidden")] = "secret";
  const withNonEnumerable = { value: "safe" };
  Object.defineProperty(withNonEnumerable, "hidden", { value: "secret" });
  const withAccessor = { value: "safe" };
  Object.defineProperty(withAccessor, "hidden", { enumerable: true, get: () => "secret" });
  const sparse = ["safe"];
  sparse[2] = "later";
  const arrayWithExtra = ["safe"];
  arrayWithExtra.hidden = "secret";
  for (const value of [withSymbol, withNonEnumerable, withAccessor, sparse, arrayWithExtra]) {
    assert.throws(() => canonicalJson(value), /canonical JSON input is invalid/u);
  }
  for (const key of ["bad\0key", "bad\rkey", "e\u0301key"]) {
    const value = Object.create(null);
    Object.defineProperty(value, key, { enumerable: true, configurable: true, writable: true, value: "safe" });
    assert.throws(() => canonicalJson(value), /canonical JSON input is invalid/u);
  }
  const protoKey = Object.create(null);
  Object.defineProperty(protoKey, "__proto__", { enumerable: true, configurable: true, writable: true, value: "data" });
  assert.equal(canonicalJson(protoKey), '{"__proto__":"data"}');
  assert.notEqual(sha256Canonical(protoKey), sha256Canonical({}));
});

test("reference analysis keeps fact, inference, unknown and transfer state closed", () => {
  const result = validateReferenceAnalysis(validReferenceAnalysis());
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  for (const mutate of [
    (value) => { value.evidence[0].tier = "trusted"; },
    (value) => { value.systemInventory[0].applicability = "mandatory"; },
    (value) => { value.transferDecisions[0].decision = "copy"; },
    (value) => { value.transferDecisions[0].reviewState = "approved"; },
    (value) => { value.unknownField = true; },
  ]) {
    const value = structuredClone(validReferenceAnalysis());
    mutate(value);
    assert.equal(validateReferenceAnalysis(value).ok, false);
  }
});

test("Reference Brief roles and evidence preserve their closed decision and provenance contracts", () => {
  const brief = buildReferenceBrief({
    analysisId: "brief-contract",
    objective: "Test the complete reference boundary.",
    decisionQuestions: ["question-loop"],
    playerExperiencePromise: "A legible choice follows each reveal.",
    differentiationHypotheses: ["choice-first"],
    genreHypotheses: ["action-rpg"],
    platformHypotheses: ["pc"],
    businessModelHypotheses: ["premium"],
    researchScope: ["observable-loop"],
    exclusionScope: ["private-metrics"],
    constraints: { languages: ["ko"], materials: ["local-notes"], regions: ["kr"], time: "two-hours" },
    forbiddenConclusions: ["revenue-causality"],
    completionCriteria: ["human-review"],
    humanReviewer: "Lead Designer",
  });
  assert.deepEqual(brief.decisionQuestions, ["question-loop"]);
  assert.throws(() => buildReferenceAnalysis({ ...validReferenceAnalysis(), brief: { ...brief, analysisId: "cutscene-reference-v1" }, referenceSet: validReferenceAnalysis().referenceSet.map((entry) => ({ ...entry, decisionQuestionIds: entry.role === "direct-competitor" ? ["question-missing"] : ["question-loop"] })) }), /invalid/u);
  const registered = registerReferenceEvidence({ records: [{
    ...registryEvidence(), build: "1.0.0", region: "kr", accountState: "guest", observedAt: "2026-08-13T00:00:00.000Z",
    locator: { kind: "project-relative", value: "evidence/loop.png" }, screen: "loop", action: "complete", result: "choice",
    transformations: [{ from: "original", to: "capture" }, { from: "capture", to: "summary" }],
    rights: { copyright: "reference-owner", use: "analysis", publication: "private" }, conflictState: "none", counterexampleOf: null,
  }] });
  assert.equal(registered[0].locator.value, "evidence/loop.png");
  assert.throws(() => registerReferenceEvidence({ records: [{ ...registered[0], locator: { kind: "project-relative", value: "../secret" } }] }), /reference evidence/u);
});

test("analysis preserves full Atlas questions and conservatively summarizes systems", () => {
  const atlas = strictAtlas({ genre: [{ overlayId: "genre-action", questions: [atlasQuestion("economy-question", "required-candidate", ["if economy exists"]) ] }] });
  const merged = mergeSystemAtlas({ atlas, genreIds: ["genre-action"] });
  assert.deepEqual(merged[0].verificationPrompts, ["Verify this question."]);
});

test("reference analysis rejects dangling references instead of treating fake evidence as support", () => {
  for (const mutate of [
    (value) => { value.evidence[0].referenceId = "ref-missing"; },
    (value) => { value.systemInventory[0].evidenceIds = ["evidence-missing"]; },
    (value) => { value.systemMaps[0].systemId = "system-missing"; },
    (value) => { value.priority[0].systemId = "system-missing"; },
    (value) => { value.deepDives[0].evidenceIds = ["evidence-missing"]; },
    (value) => { value.transferDecisions[0].evidenceIds = ["evidence-missing"]; },
    (value) => { value.verificationQueue[0].evidenceIds = ["evidence-missing"]; },
  ]) {
    const value = structuredClone(validReferenceAnalysis());
    mutate(value);
    const result = validateReferenceAnalysis(value);
    assert.equal(result.ok, false);
    assert.equal(result.errors.some(({ code }) => code === "reference.dangling"), true);
  }
});

test("reference analysis diagnostics redact unknown field names and unsafe keys", () => {
  const value = validReferenceAnalysis();
  const secret = "/Users/private/credential\0\r";
  Object.defineProperty(value, secret, { enumerable: true, configurable: true, writable: true, value: true });
  const serialized = JSON.stringify(validateReferenceAnalysis(value).errors);
  assert.equal(serialized.includes("Users"), false);
  assert.equal(serialized.includes("private"), false);
  assert.equal(serialized.includes("credential"), false);
  assert.equal(serialized.includes("\0"), false);
  assert.equal(serialized.includes("\r"), false);
  assert.match(serialized, /\$unknown\/0/u);
});

test("reference roles stay closed and cover every default decision lens", () => {
  assert.equal(validateReferenceAnalysis(validReferenceAnalysis()).ok, true);
  for (const mutate of [
    (value) => { value.referenceSet.pop(); },
    (value) => { value.referenceSet[0].role = "market-leader"; },
    (value) => { value.referenceSet[2].availability = "available"; },
    (value) => { value.referenceSet[2].limitation = null; },
  ]) {
    const value = structuredClone(validReferenceAnalysis());
    mutate(value);
    assert.equal(validateReferenceAnalysis(value).ok, false);
  }
});

test("reference analysis fails closed for unsafe text and unsupported evidence claims", () => {
  for (const mutate of [
    (value) => { value.evidence[0].claim = "secret\0value"; },
    (value) => { value.evidence[0].claim = "e\u0301vidence"; },
    (value) => { value.deepDives[0].evidenceIds = []; },
    (value) => { value.transferDecisions[0].evidenceIds = []; },
    (value) => { value.systemMaps[0].nodes = [{ nodeId: "reveal", kind: "input", label: "Reveal" }]; },
    (value) => { value.systemMaps[0].connections[0].connectedSystemIds = ["system-reveal-loop", "system-reveal-loop"]; },
  ]) {
    const value = structuredClone(validReferenceAnalysis());
    mutate(value);
    const result = validateReferenceAnalysis(value);
    assert.equal(result.ok, false);
    assert.equal(JSON.stringify(result.errors).includes("secret\0value"), false);
  }
});

test("canonical reference analysis serializes only a validated contract", () => {
  const analysis = validReferenceAnalysis();
  assert.equal(canonicalReferenceAnalysis(analysis), canonicalJson(analysis));
  analysis.evidence[0].tier = "trusted";
  assert.throws(() => canonicalReferenceAnalysis(analysis), /reference analysis invalid/u);
});

function equalsJson(left, right) {
  if (left === right) return true;
  if (!left || !right || typeof left !== "object" || typeof right !== "object" || Array.isArray(left) !== Array.isArray(right)) return false;
  if (Array.isArray(left)) return left.length === right.length && left.every((item, index) => equalsJson(item, right[index]));
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length && keys.every((key) => Object.hasOwn(right, key) && equalsJson(left[key], right[key]));
}

function schemaAccepts(value, schema, root) {
  if (schema.$ref) return schemaAccepts(value, schema.$ref.replace("#/$defs/", "").split(".").reduce((node, key) => node[key], root.$defs), root);
  if (schema.anyOf && !schema.anyOf.some((part) => schemaAccepts(value, part, root))) return false;
  if (schema.allOf && !schema.allOf.every((part) => schemaAccepts(value, part, root))) return false;
  if (schema.if && schemaAccepts(value, schema.if, root) && schema.then && !schemaAccepts(value, schema.then, root)) return false;
  if (schema.const !== undefined && !equalsJson(value, schema.const)) return false;
  if (schema.enum && !schema.enum.some((candidate) => equalsJson(value, candidate))) return false;
  if (Array.isArray(schema.type)) return schema.type.some((type) => schemaAccepts(value, { ...schema, type }, root));
  if (schema.type === "object" && (value === null || typeof value !== "object" || Array.isArray(value))) return false;
  if (schema.type === "array" && !Array.isArray(value)) return false;
  if (schema.type === "string" && typeof value !== "string") return false;
  if (schema.type === "null" && value !== null) return false;
  if (schema.type === "null" && value !== null) return false;
  if (schema.type === "integer" && !Number.isInteger(value)) return false;
  if (typeof value === "string" && schema.pattern && !new RegExp(schema.pattern, "u").test(value)) return false;
  if (Array.isArray(value)) {
    if (value.length < (schema.minItems ?? 0)) return false;
    if (schema.uniqueItems && value.some((item, index) => value.slice(0, index).some((previous) => equalsJson(item, previous)))) return false;
    if (schema.items && !value.every((item) => schemaAccepts(item, schema.items, root))) return false;
    if (schema.contains) {
      const count = value.filter((item) => schemaAccepts(item, schema.contains, root)).length;
      if (count < (schema.minContains ?? 1) || count > (schema.maxContains ?? Number.POSITIVE_INFINITY)) return false;
    }
  }
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    if ((schema.required ?? []).some((key) => !Object.hasOwn(value, key))) return false;
    for (const [key, item] of Object.entries(value)) {
      if (Object.hasOwn(schema.properties ?? {}, key) && !schemaAccepts(item, schema.properties[key], root)) return false;
      if (!Object.hasOwn(schema.properties ?? {}, key) && schema.additionalProperties === false) return false;
    }
  }
  return true;
}

function assertClosedObjects(schema) {
  if (!schema || typeof schema !== "object") return;
  if (schema.type === "object") assert.equal(schema.additionalProperties, false);
  for (const value of Object.values(schema)) {
    if (Array.isArray(value)) value.forEach(assertClosedObjects);
    else assertClosedObjects(value);
  }
}

test("reference analysis schema and runtime reject the same hand-authored ID contract mutations", async () => {
  const schema = JSON.parse(await readFile(new URL("../../shared/reference-intelligence/schema/reference-analysis.schema.json", import.meta.url), "utf8"));
  assertClosedObjects(schema);
  assert.deepEqual(schema.properties.referenceSet.items.$ref, "#/$defs/reference");
  assert.deepEqual(schema.$defs.reference.properties.role.enum, ["direct-competitor", "core-system-exemplar", "operations-monetization-comparator"]);
  assert.deepEqual(schema.$defs.reference.properties.availability.enum, ["available", "unavailable"]);
  assert.equal(schemaAccepts(validReferenceAnalysis(), schema, schema), true);
  for (const mutate of [
    (value) => { value.systemInventory[0].evidenceIds = ["bad evidence"]; },
    (value) => { value.deepDives[0].evidenceIds = ["bad evidence"]; },
    (value) => { value.comparison[0].evidenceIds = ["bad evidence"]; },
    (value) => { value.verificationQueue[0].evidenceIds = ["bad evidence"]; },
    (value) => { value.transferDecisions[0].evidenceIds = ["bad evidence"]; },
    (value) => { value.transferDecisions[0].glossaryReceipt = { documentId: "receipt", glossaryVersion: 1, glossarySha256: "0".repeat(64), termIds: ["bad term"] }; },
  ]) {
    const value = structuredClone(validReferenceAnalysis());
    mutate(value);
    assert.equal(schemaAccepts(value, schema, schema), false);
    assert.equal(validateReferenceAnalysis(value).ok, false);
  }
});

test("reference analysis permits exactly one entry for each default role", async () => {
  const schema = JSON.parse(await readFile(new URL("../../shared/reference-intelligence/schema/reference-analysis.schema.json", import.meta.url), "utf8"));
  const value = validReferenceAnalysis();
  value.referenceSet.push({
    referenceId: "ref-second-sample",
    label: "Second cinematic sample",
    role: "direct-competitor",
    availability: "available",
    limitation: null,
  });
  assert.deepEqual([schemaAccepts(value, schema, schema), validateReferenceAnalysis(value).ok], [false, false]);
});

test("Atlas merge is order-independent and genre convention is not a requirement", async () => {
  const { atlas } = await loadBundledReferenceCatalog({ moduleRoot: bundledReferenceRoot });
  const selection = {
    atlas,
    genreIds: ["action-rpg", "survival-crafting"],
    playModeIds: ["cooperative", "single-player"],
    platformIds: ["pc-console"],
    businessModelIds: ["premium"],
  };
  const left = mergeSystemAtlas(selection);
  const right = mergeSystemAtlas({
    ...selection,
    genreIds: [...selection.genreIds].reverse(),
    playModeIds: [...selection.playModeIds].reverse(),
  });
  assert.deepEqual(left, right);
  assert.equal(left.every(({ applicability }) => applicability !== "mandatory"), true);
  assert.equal(left.some(({ questionId }) => questionId === "core-play-action-rpg-loop"), true);
});

test("discovery evidence cannot independently prove monetization causality", () => {
  const result = validateClaimAgainstEvidence({
    claim: { claimId: "claim-bm-1", kind: "observation", category: "monetization", causal: true, evidenceIds: ["ev-community-1"], systemIds: ["system-reveal-loop"] },
    evidenceById: new Map([
      ["ev-community-1", registerReferenceEvidence({ records: [registryEvidence({ evidenceId: "ev-community-1", sourceType: "community" })] })[0]],
    ]),
  });
  assert.deepEqual(result, { ok: false, code: "unsupported_causal_claim" });
});

test("evidence registry derives and preserves source tiers without trusting supplied tiers", () => {
  assert.deepEqual(registerReferenceEvidence({ records: [
    registryEvidence({ evidenceId: "ev-video", sourceType: "video" }),
    registryEvidence({ evidenceId: "ev-patch", sourceType: "official-patch-note" }),
    registryEvidence({ evidenceId: "ev-talk", sourceType: "developer-talk" }),
  ] }).map(({ evidenceId, tier }) => [evidenceId, tier]), [
    ["ev-patch", "primary"],
    ["ev-talk", "supporting"],
    ["ev-video", "discovery"],
  ]);
  assert.throws(
    () => registerReferenceEvidence({ records: [registryEvidence({ evidenceId: "ev-mismatched", sourceType: "community", tier: "primary" })] }),
    { code: "reference-evidence.tier" },
  );
  assert.throws(
    () => registerReferenceEvidence({ records: [
      registryEvidence({ evidenceId: "ev-duplicate" }),
      registryEvidence({ evidenceId: "ev-duplicate" }),
    ] }),
    { code: "reference-evidence.duplicate-id" },
  );
});

test("bundled catalog preserves optional source fallbacks and exact registered URLs", async () => {
  const { sourceRegister } = await loadBundledReferenceCatalog({ moduleRoot: bundledReferenceRoot });
  assert.equal((await loadBundledReferenceCatalog()).sourceRegister.sources.length, 8);
  assert.deepEqual(sourceRegister.sources.map(({ id, url, required }) => [id, url, required]), [
    ["steamworks-tags", "https://partner.steamgames.com/doc/store/tags?l=english&language=english", false],
    ["gamerefinery-genres", "https://docs.gamerefinery.com/en/articles/2278730-what-are-categories-genres-and-subgenres", false],
    ["gamerefinery-intelligence", "https://www.gamerefinery.com/game-intelligence-tools/", false],
    ["gdc-postmortems", "https://gdcvault.com/browse/postmortem/?media=s", false],
    ["game-ui-database", "https://www.gameuidatabase.com/", false],
    ["interface-in-game", "https://interfaceingame.com/screenshots/", false],
    ["steamdb-faq", "https://steamdb.info/faq/", false],
    ["igdb-api", "https://api-docs.igdb.com/", false],
  ]);
  const unavailable = registerReferenceEvidence({ records: [registryEvidence({
    evidenceId: "ev-offline-source",
    availability: "unavailable",
    limitation: "Offline source unavailable; direct verification remains open.",
    verificationQuestion: "Which official source can verify this when access returns?",
  })] });
  assert.deepEqual(unavailable.map(({ evidenceId, tier, conflictState }) => [evidenceId, tier, conflictState]), [["ev-offline-source", "primary", "none"]]);
});

test("Atlas rejects unknown and duplicate overlay selections", async () => {
  const { atlas } = await loadBundledReferenceCatalog({ moduleRoot: bundledReferenceRoot });
  assert.throws(() => mergeSystemAtlas({ atlas, genreIds: ["unknown-genre"] }), { code: "reference-atlas.unknown-overlay" });
  assert.throws(() => mergeSystemAtlas({ atlas, genreIds: ["action-rpg", "action-rpg"] }), { code: "reference-atlas.duplicate-overlay" });
});

test("Atlas conflicts preserve cautious applicability and bytewise question order", () => {
  const atlas = strictAtlas({
    genre: [{
        overlayId: "alpha",
        questions: [
          atlasQuestion("a-question", "not-applicable"),
          atlasQuestion("z-question", "required-candidate"),
        ],
      }],
    "play-mode": [{
        overlayId: "beta",
        questions: [atlasQuestion("a-question", "optional")],
      }],
  });
  const merged = mergeSystemAtlas({ atlas, genreIds: ["alpha"], playModeIds: ["beta"] });
  assert.deepEqual(merged.map(({ questionId }) => questionId), ["a-question", "z-question"]);
  assert.equal(merged[0].applicability, "unknown");
});

test("Atlas rejects duplicate catalog question pairs before selecting an overlay", () => {
  const atlas = strictAtlas({
    genre: [{
        overlayId: "duplicate-pair",
        questions: [
          atlasQuestion("duplicate-question", "optional"),
          atlasQuestion("duplicate-question", "optional"),
        ],
      }],
  });
  assert.throws(() => mergeSystemAtlas({ atlas }), { code: "reference-atlas.duplicate-question" });
});

test("evidence closes availability, preserves unavailable limitations, and excludes unavailable support", async () => {
  assert.throws(() => registerReferenceEvidence({ records: [registryEvidence({ evidenceId: "ev-open", availability: undefined })] }), { code: "reference-evidence.invalid" });
  assert.deepEqual(registerReferenceEvidence({ records: [registryEvidence({
    evidenceId: "ev-unavailable", availability: "unavailable",
    limitation: "No access.", verificationQuestion: "What official page can verify this?",
  })] })[0].availability, "unavailable");
  const unavailable = registerReferenceEvidence({ records: [registryEvidence({ evidenceId: "ev-unavailable", availability: "unavailable", limitation: "No access.", verificationQuestion: "What official page can verify this?" })] })[0];
  const claim = { claimId: "claim-unavailable", kind: "observation", category: "general", causal: false, evidenceIds: ["ev-unavailable"], systemIds: ["system-reveal-loop"] };
  assert.deepEqual(validateClaimAgainstEvidence({ claim, evidenceById: new Map([["ev-unavailable", unavailable]]) }), { ok: false, code: "evidence_unavailable" });
  const analysis = validReferenceAnalysis();
  analysis.evidence[0] = {
    ...registerReferenceEvidence({ records: [registryEvidence({
      evidenceId: "evidence-cinematic-loop", availability: "unavailable",
      limitation: "The official page is unavailable offline.", verificationQuestion: "Which official patch note confirms the movement choice?",
      claim: "The player receives a movement choice after the reveal.",
    })] })[0],
  };
  const schema = JSON.parse(await readFile(new URL("../../shared/reference-intelligence/schema/reference-analysis.schema.json", import.meta.url), "utf8"));
  assert.deepEqual([schemaAccepts(analysis, schema, schema), validateReferenceAnalysis(analysis).ok], [true, false]);
});

test("claim support closes shape, certainty escalation, causal omission, and discovery mixing", () => {
  const hypothesis = registryEvidence({ evidenceId: "ev-hypothesis", claimKind: "hypothesis" });
  const observation = registryEvidence({ evidenceId: "ev-primary" });
  const discovery = registryEvidence({ evidenceId: "ev-discovery", sourceType: "community" });
  assert.deepEqual(validateClaimAgainstEvidence({
    claim: { claimId: "claim-observation", kind: "observation", category: "general", causal: false, evidenceIds: ["ev-hypothesis"], systemIds: ["system-reveal-loop"] },
    evidenceById: new Map([
      ["ev-hypothesis", registerReferenceEvidence({ records: [hypothesis] })[0]],
    ]),
  }), { ok: false, code: "unsupported_claim_kind" });
  for (const claim of [
    { claimId: "claim-no-category", kind: "observation", causal: false, evidenceIds: ["ev-observation"], systemIds: ["system-reveal-loop"] },
    { claimId: "claim-no-causal", kind: "observation", category: "general", evidenceIds: ["ev-observation"], systemIds: ["system-reveal-loop"] },
    { claimId: "claim-unsorted", kind: "observation", category: "general", causal: false, evidenceIds: ["ev-z", "ev-a"], systemIds: ["system-reveal-loop"] },
  ]) assert.deepEqual(validateClaimAgainstEvidence({ claim, evidenceById: new Map([
    ["ev-observation", registerReferenceEvidence({ records: [registryEvidence({ evidenceId: "ev-observation" })] })[0]],
    ["ev-z", registerReferenceEvidence({ records: [registryEvidence({ evidenceId: "ev-z" })] })[0]],
    ["ev-a", registerReferenceEvidence({ records: [registryEvidence({ evidenceId: "ev-a" })] })[0]],
  ]) }), { ok: false, code: "invalid_claim" });
  const causal = { claimId: "claim-causal", kind: "observation", category: "general", causal: true, evidenceIds: ["ev-discovery"], systemIds: ["system-reveal-loop"] };
  assert.deepEqual(validateClaimAgainstEvidence({ claim: causal, evidenceById: new Map([["ev-discovery", registerReferenceEvidence({ records: [discovery] })[0]]]) }), { ok: false, code: "unsupported_causal_claim" });
  assert.deepEqual(validateClaimAgainstEvidence({
    claim: { ...causal, evidenceIds: ["ev-discovery", "ev-primary"] },
    evidenceById: new Map([["ev-discovery", registerReferenceEvidence({ records: [discovery] })[0]], ["ev-primary", registerReferenceEvidence({ records: [observation] })[0]]]),
  }), { ok: true, code: "supported" });
});

test("counterexample and conflicting-only evidence cannot support a claim or promote analysis", async () => {
  const positive = registryEvidence({ evidenceId: "ev-positive", systemIds: ["system-reveal-loop"] });
  const counterexample = registryEvidence({ evidenceId: "ev-counterexample", systemIds: ["system-reveal-loop"], conflictState: "conflicting", counterexampleOf: "ev-positive" });
  const conflicting = registryEvidence({ evidenceId: "ev-conflicting", systemIds: ["system-reveal-loop"], conflictState: "conflicting" });
  const records = registerReferenceEvidence({ records: [positive, counterexample, conflicting] });
  const evidenceById = new Map(records.map((record) => [record.evidenceId, record]));
  for (const evidenceId of ["ev-counterexample", "ev-conflicting"]) assert.deepEqual(
    validateClaimAgainstEvidence({ claim: { claimId: `claim-${evidenceId}`, systemIds: ["system-reveal-loop"], evidenceIds: [evidenceId], kind: "observation", category: "general", causal: true }, evidenceById }),
    { ok: false, code: "evidence_nonpositive" },
  );
  const catalog = await loadBundledReferenceCatalog();
  const input = await analysisInputFixture({ evidence: [
    { ...analysisEvidenceFixture()[0], evidenceId: "ev-alpha-conflicting", conflictState: "conflicting" },
    { ...analysisEvidenceFixture()[0], evidenceId: "ev-beta-conflicting", referenceId: "ref-beta", contextId: "ctx-beta-v1", conflictState: "conflicting" },
  ] });
  input.atlas.atlas = catalog.atlas;
  const analysis = buildReferenceAnalysis(input);
  assert.equal(analysis.deepDives[0].claimKind, "unknown");
  assert.equal(analysis.comparison[0].state, "hold");
  assert.equal(analysis.transferDecisions[0].decision, "hold");
  assert.equal(analysis.verificationQueue.some(({ verificationId }) => verificationId === "verify-system-core-play"), true);
});

test("claim evidence rejects Map subclasses and proxies without exposing thrown data", () => {
  class DerivedMap extends Map {}
  const claim = { claimId: "claim-map", kind: "observation", category: "general", causal: false, evidenceIds: ["ev-map"], systemIds: ["system-reveal-loop"] };
  const evidence = registerReferenceEvidence({ records: [registryEvidence({ evidenceId: "ev-map" })] })[0];
  for (const evidenceById of [
    new DerivedMap([["ev-map", evidence]]),
    new Proxy(new Map([["ev-map", evidence]]), {}),
    new Proxy(new Map([["ev-map", evidence]]), { getPrototypeOf() { throw new Error("/Users/private/credential"); } }),
  ]) {
    const result = validateClaimAgainstEvidence({ claim, evidenceById });
    assert.deepEqual(result, { ok: false, code: "invalid_evidence" });
    assert.equal(JSON.stringify(result).includes("Users"), false);
    assert.equal(JSON.stringify(result).includes("credential"), false);
  }
});

test("Atlas closes exact systems, object keys, and cross-axis duplicate pairs", () => {
  const atlas = strictAtlas();
  for (const mutate of [
    (value) => { value.systems.pop(); },
    (value) => { value.systems[0].systemId = "unknown-system"; },
    (value) => { value.extra = true; },
    (value) => { value.systems[0].extra = true; },
    (value) => { value.overlays.extra = []; },
    (value) => { value.questions.push({ ...atlasQuestion("a-question", "optional"), extra: true }); },
    (value) => { value.overlays.genre.push({ overlayId: "extra", questions: [], extra: true }); },
    (value) => { value.overlays.genre.push({ overlayId: "cross-axis", questions: [atlasQuestion("cross-axis-question", "optional")] }); value.overlays.platform.push({ overlayId: "cross-axis", questions: [atlasQuestion("cross-axis-question", "optional")] }); },
  ]) {
    const value = structuredClone(atlas);
    mutate(value);
    assert.throws(() => mergeSystemAtlas({ atlas: value }), (error) => error?.code?.startsWith("reference-atlas.") === true);
  }
});

test("not-applicable requires unanimous contributors regardless of conditions", () => {
  for (const conditions of [[], ["Condition is asserted but cannot be selected."]]) {
    const atlas = strictAtlas({
      genre: [{ overlayId: "na", questions: [atlasQuestion("na-question", "not-applicable", conditions)] }],
      platform: [{ overlayId: "other", questions: [atlasQuestion("na-question", "optional")] }],
    });
    assert.equal(mergeSystemAtlas({ atlas, genreIds: ["na"], platformIds: ["other"] })[0].applicability, "unknown");
  }
  const atlas = strictAtlas({ genre: [{ overlayId: "all-na", questions: [atlasQuestion("all-na-question", "not-applicable")] }] });
  assert.equal(mergeSystemAtlas({ atlas, genreIds: ["all-na"] })[0].applicability, "not-applicable");
});

test("catalog loader rejects coercion, source mutation, and symlink leaves", async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), "reference-atlas-")));
  const rootLink = `${root}-link`;
  try {
    await cp(bundledReferenceRoot, root, { recursive: true });
    assert.equal((await loadBundledReferenceCatalog({ moduleRoot: root })).sourceRegister.sources.length, 8);
    await symlink(root, rootLink);
    await assert.rejects(() => loadBundledReferenceCatalog({ moduleRoot: rootLink }), { code: "reference-atlas.catalog-load" });
    await assert.rejects(() => loadBundledReferenceCatalog({ moduleRoot: { toString: () => root } }), { code: "reference-atlas.catalog-load" });
    await assert.rejects(() => loadBundledReferenceCatalog(new Proxy({}, { getOwnPropertyDescriptor() { throw new Error("/Users/private/credential"); } })), { code: "reference-atlas.catalog-load" });
    const sourceRegisterPath = join(root, "catalog/source-register.json");
    const sourceRegister = JSON.parse(await readFile(sourceRegisterPath, "utf8"));
    sourceRegister.sources[0].url = "https://example.invalid/tampered";
    await writeFile(sourceRegisterPath, JSON.stringify(sourceRegister));
    await assert.rejects(() => loadBundledReferenceCatalog({ moduleRoot: root }), { code: "reference-atlas.catalog-load" });
    await cp(bundledReferenceRoot, root, { recursive: true, force: true });
    await rm(join(root, "catalog/source-register.json"));
    await symlink(join(bundledReferenceRoot, "catalog/source-register.json"), join(root, "catalog/source-register.json"));
    await assert.rejects(() => loadBundledReferenceCatalog({ moduleRoot: root }), { code: "reference-atlas.catalog-load" });
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(rootLink, { recursive: true, force: true });
  }
});

test("registry emits exact EvidenceRecord values that immediately compose with claim validation", () => {
  const record = registryEvidence({ evidenceId: "ev-registry-observation", claim: "The official page lists the observed movement choice." });
  const [registered] = registerReferenceEvidence({ records: [record] });
  assert.equal(Object.keys(registered).includes("counterexampleOf"), true);
  const claim = { claimId: "claim-registry-observation", kind: "observation", category: "general", causal: false, evidenceIds: ["ev-registry-observation"], systemIds: ["system-reveal-loop"] };
  assert.deepEqual(validateClaimAgainstEvidence({ claim, evidenceById: new Map([[registered.evidenceId, registered]]) }), { ok: true, code: "supported" });
  assert.throws(() => registerReferenceEvidence({ records: [{ ...record, extra: true }] }), { code: "reference-evidence.invalid" });
  assert.throws(() => registerReferenceEvidence({ records: [{ ...record, claimKind: "fact" }] }), { code: "reference-evidence.invalid" });
});

test("reference analysis schema and runtime reject persisted source tier spoofing", async () => {
  const schema = JSON.parse(await readFile(new URL("../../shared/reference-intelligence/schema/reference-analysis.schema.json", import.meta.url), "utf8"));
  for (const mutate of [
    (value) => { value.evidence[0].sourceType = "community"; value.evidence[0].tier = "primary"; },
    (value) => { value.evidence[0].sourceType = "official-site"; value.evidence[0].tier = "discovery"; },
  ]) {
    const value = structuredClone(validReferenceAnalysis());
    mutate(value);
    assert.deepEqual([schemaAccepts(value, schema, schema), validateReferenceAnalysis(value).ok], [false, false]);
  }
});

test("catalog loader rejects ancestor symlinks and swapped catalog directories", async () => {
  const container = await realpath(await mkdtemp(join(tmpdir(), "reference-atlas-ancestor-")));
  const installed = join(container, "installed");
  const link = join(container, "linked-parent");
  const movedCatalog = join(container, "catalog-before-swap");
  try {
    await cp(bundledReferenceRoot, installed, { recursive: true });
    const canonicalInstalled = await realpath(installed);
    assert.equal((await loadBundledReferenceCatalog({ moduleRoot: canonicalInstalled })).atlas.systems.length, 16);
    await symlink(container, link);
    await assert.rejects(() => loadBundledReferenceCatalog({ moduleRoot: join(link, "installed") }), { code: "reference-atlas.catalog-load" });
    await rename(join(installed, "catalog"), movedCatalog);
    await symlink(join(bundledReferenceRoot, "catalog"), join(installed, "catalog"));
    await assert.rejects(() => loadBundledReferenceCatalog({ moduleRoot: canonicalInstalled }), { code: "reference-atlas.catalog-load" });
  } finally {
    await rm(container, { recursive: true, force: true });
  }
});

function analysisBriefFixture(overrides = {}) {
  return {
    analysisId: "reference-analysis-fixture",
    objective: "Identify transferable session-loop patterns.",
    decisionQuestions: ["question-session-loop"], playerExperiencePromise: "A short loop leaves the next choice clear.", differentiationHypotheses: ["choice-first"], genreHypotheses: ["action-rpg"], platformHypotheses: ["pc"], businessModelHypotheses: ["premium"], researchScope: ["observable-loop"], exclusionScope: ["private-metrics"], constraints: { time: "two-hours", materials: ["local-notes"], languages: ["ko"], regions: ["kr"] }, forbiddenConclusions: ["revenue-causality"], completionCriteria: ["human-review"], humanReviewer: "Lead Designer",
    ...overrides,
  };
}

function analysisReferenceSetFixture({ singleGame = false } = {}) {
  const shared = { referenceId: "ref-alpha", label: "Alpha", decisionQuestionIds: ["question-session-loop"], availability: "available", limitation: null };
  return [
    { ...shared, role: "direct-competitor" },
    singleGame ? { ...shared, role: "core-system-exemplar" } : { referenceId: "ref-beta", label: "Beta", role: "core-system-exemplar", decisionQuestionIds: ["question-session-loop"], availability: "available", limitation: null },
    singleGame
      ? { ...shared, role: "operations-monetization-comparator" }
      : { referenceId: "ref-gamma", label: "Gamma", role: "operations-monetization-comparator", decisionQuestionIds: ["question-session-loop"], availability: "unavailable", limitation: "Offline source is unavailable." },
  ];
}

function analysisEvidenceFixture(overrides = {}) {
  return [
    {
      evidenceId: "ev-alpha-loop",
      referenceId: "ref-alpha",
      contextId: "ctx-alpha-v1",
      systemIds: ["core-play"],
      sourceType: "direct-play",
      claimKind: "observation",
      claim: "The player completes a short loop before choosing a reward.",
      availability: "available",
      limitation: null,
      verificationQuestion: null,
      build: "1.0.0", region: "kr", accountState: "guest", observedAt: "2026-08-13T00:00:00.000Z", locator: { kind: "project-relative", value: "evidence/alpha.png" }, screen: "loop", action: "complete", result: "reward", transformations: [{ from: "original", to: "capture" }, { from: "capture", to: "summary" }], rights: { copyright: "reference-owner", use: "analysis", publication: "private" }, conflictState: "none", counterexampleOf: null,
    },
    {
      evidenceId: "ev-beta-offline",
      referenceId: "ref-gamma",
      contextId: "ctx-gamma-v1",
      systemIds: ["core-play"],
      sourceType: "official-site",
      claimKind: "observation",
      claim: "The unavailable source may describe operations offers.",
      availability: "unavailable",
      limitation: "Offline source is unavailable.",
      verificationQuestion: "Which official page can verify the offer?",
      build: "1.0.0", region: "kr", accountState: "guest", observedAt: "2026-08-13T00:00:00.000Z", locator: { kind: "url", value: "https://example.invalid/offer" }, screen: "offer", action: "inspect", result: "unavailable", transformations: [{ from: "original", to: "capture" }, { from: "capture", to: "summary" }], rights: { copyright: "reference-owner", use: "analysis", publication: "private" }, conflictState: "none", counterexampleOf: null,
    },
    ...(overrides.records ?? []),
  ];
}

function analysisMapFixture(overrides = {}) {
  return [{
    mapId: "map-core-play-loop",
    systemId: "core-play",
    nodes: [{ nodeId: "action", kind: "input", label: "Action" }, { nodeId: "resolve", kind: "process", label: "Resolve" }, { nodeId: "reward", kind: "output", label: "Reward" }],
    connections: [{ connectionId: "action-to-resolve", fromNodeId: "action", toNodeId: "resolve", connectedSystemIds: ["core-play"] }, { connectionId: "resolve-to-reward", fromNodeId: "resolve", toNodeId: "reward", connectedSystemIds: ["core-play"] }],
    ...overrides,
  }];
}

async function analysisInputFixture(overrides = {}) {
  const { atlas } = await loadBundledReferenceCatalog({ moduleRoot: bundledReferenceRoot });
  const referenceSet = overrides.referenceSet ?? analysisReferenceSetFixture();
  const referenceContexts = overrides.referenceContexts ?? [...new Set(referenceSet.map(({ referenceId }) => referenceId))].sort().map((referenceId) => ({ contextId: `ctx-${referenceId.slice(4)}-v1`, referenceId, version: "1", platform: "pc" }));
  return {
    brief: analysisBriefFixture(),
    referenceSet,
    referenceContexts,
    atlas: { atlas },
    evidence: analysisEvidenceFixture(),
    claims: [],
    edges: analysisMapFixture(),
    loops: [],
    projectConstraints: ["ten-minute-session"],
    priorities: { "core-play": { relevance: 5, playerExperienceImpact: 5, economyProgressionImpact: 3, differentiationPotential: 4, evidenceStrength: 5, uncertainty: 2, researchCost: 2 } },
    ...overrides,
  };
}

async function analysisArtifactRoot(t) {
  const root = await mkdtemp(join(tmpdir(), "reference-analysis-artifacts-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

test("analysis stages preserve evidence and never auto-approve transfer", async (t) => {
  const analysis = structuredClone(buildReferenceAnalysis(await analysisInputFixture()));
  assert.equal(validateReferenceAnalysis(analysis).ok, true, JSON.stringify(validateReferenceAnalysis(analysis).errors));
  assert.equal(analysis.referenceSet.map(({ role }) => role).join(","), "direct-competitor,core-system-exemplar,operations-monetization-comparator");
  assert.equal(analysis.transferDecisions.every(({ reviewState }) => reviewState === "pending-review"), true);
  assert.equal(analysis.verificationQueue.some(({ question }) => question.includes("official page")), true);
  const written = await writeReferenceAnalysisWorkspace({ artifactRoot: await analysisArtifactRoot(t), analysis });
  assert.match(written.analysisSha256, /^[a-f0-9]{64}$/u);
  assert.equal(written.files.includes("reference-intelligence/system-maps/map-core-play-loop.json"), true);
  assert.equal(written.files.includes("reference-intelligence/deep-dives/core-play.md"), true);
});

test("analysis persists exact claim-to-evidence bindings in the evidence register", async (t) => {
  const claim = { claimId: "claim-core-loop", systemIds: ["core-play"], evidenceIds: ["ev-alpha-loop"], kind: "observation", category: "general", causal: false };
  const analysis = buildReferenceAnalysis(await analysisInputFixture({ claims: [claim] }));
  const root = await analysisArtifactRoot(t);
  await writeReferenceAnalysisWorkspace({ artifactRoot: root, analysis });
  const persisted = JSON.parse(await readFile(join(root, "reference-intelligence", "evidence-register.yml"), "utf8"));
  assert.deepEqual(analysis.claims, [claim]);
  assert.deepEqual(persisted.claims, [claim]);
});

test("workspace persists the complete canonical brief and merged Atlas selection", async (t) => {
  const analysis = buildReferenceAnalysis(await analysisInputFixture());
  const root = await analysisArtifactRoot(t);
  const written = await writeReferenceAnalysisWorkspace({ artifactRoot: root, analysis });
  const [brief, atlas] = await Promise.all([
    readFile(join(root, "reference-intelligence", "brief.json"), "utf8").then(JSON.parse),
    readFile(join(root, "reference-intelligence", "atlas-selection.json"), "utf8").then(JSON.parse),
  ]);
  assert.deepEqual(brief, analysis.brief);
  assert.deepEqual(atlas, analysis.atlasSelection);
  assert.equal(written.files.includes("reference-intelligence/brief.json"), true);
  assert.equal(written.files.includes("reference-intelligence/atlas-selection.json"), true);
});

test("locators and non-positive evidence fail closed for comparison and transfer", () => {
  for (const value of ["/private/evidence.png", "C:\\private\\evidence.png", "\\\\server\\share\\evidence.png", "\\\\?\\C:\\private\\evidence.png", "file:///private/evidence.png", "https:relative"]) {
    assert.throws(() => registerReferenceEvidence({ records: [registryEvidence({ locator: { kind: "project-relative", value } })] }), /reference evidence/u);
  }
  assert.throws(() => registerReferenceEvidence({ records: [registryEvidence({ evidenceId: "ev-self", counterexampleOf: "ev-self" })] }), /reference evidence/u);
  const positive = registryEvidence({ evidenceId: "ev-positive", referenceId: "ref-cinematic-sample", contextId: "ctx-cinematic-v1", systemIds: ["system-reveal-loop"] });
  const counterexample = registryEvidence({ evidenceId: "ev-counterexample", referenceId: "ref-other", contextId: "ctx-other", systemIds: ["system-reveal-loop"], conflictState: "conflicting", counterexampleOf: "ev-positive" });
  const records = registerReferenceEvidence({ records: [positive, counterexample] });
  const transfers = buildDesignTransfers({
    deepDives: [{ systemId: "system-reveal-loop", claimKind: "observation", finding: "Observed.", evidenceIds: records.map(({ evidenceId }) => evidenceId), referenceIds: ["ref-cinematic-sample"], contextIds: ["ctx-cinematic-v1"], coverageCount: 1 }],
    projectConstraints: ["ten-minute-session"], evidence: records,
    referenceContexts: [{ contextId: "ctx-cinematic-v1", referenceId: "ref-cinematic-sample", version: "1", platform: "pc" }, { contextId: "ctx-other", referenceId: "ref-other", version: "1", platform: "pc" }],
    referenceSet: [{ referenceId: "ref-cinematic-sample", label: "Sample", role: "direct-competitor", decisionQuestionIds: ["question-loop"], availability: "available", limitation: null }, { referenceId: "ref-other", label: "Other", role: "core-system-exemplar", decisionQuestionIds: ["question-loop"], availability: "available", limitation: null }, { referenceId: "ref-third", label: "Third", role: "operations-monetization-comparator", decisionQuestionIds: ["question-loop"], availability: "unavailable", limitation: "Unavailable." }],
  });
  assert.equal(transfers[0].decision, "hold");
  assert.equal(transfers[0].coverageCount, 1);
});

test("reference analysis schema and runtime close persisted claim bindings", async () => {
  const schema = JSON.parse(await readFile(new URL("../../shared/reference-intelligence/schema/reference-analysis.schema.json", import.meta.url), "utf8"));
  const value = validReferenceAnalysis();
  value.claims = [{ claimId: "claim-cinematic-loop", systemIds: ["system-reveal-loop"], evidenceIds: ["evidence-cinematic-loop"], kind: "observation", category: "general", causal: false }];
  assert.deepEqual([schemaAccepts(value, schema, schema), validateReferenceAnalysis(value).ok], [true, true]);
  for (const mutate of [
    (candidate) => { candidate.claims[0].claimId = "claim drift"; },
    (candidate) => { candidate.claims[0].extra = true; },
  ]) {
    const candidate = structuredClone(value);
    mutate(candidate);
    assert.deepEqual([schemaAccepts(candidate, schema, schema), validateReferenceAnalysis(candidate).ok], [false, false]);
  }
  for (const mutate of [
    (candidate) => { candidate.claims[0].evidenceIds = ["evidence-missing"]; },
    (candidate) => { candidate.claims[0].systemIds = ["system-missing"]; },
  ]) {
    const candidate = structuredClone(value);
    mutate(candidate);
    assert.deepEqual([schemaAccepts(candidate, schema, schema), validateReferenceAnalysis(candidate).ok], [true, false]);
  }
});

test("analysis holds comparison and transfer decisions for a single unique reference", async () => {
  const input = await analysisInputFixture({ referenceSet: analysisReferenceSetFixture({ singleGame: true }), evidence: analysisEvidenceFixture({ records: [] }).filter(({ referenceId }) => referenceId === "ref-alpha") });
  const analysis = buildReferenceAnalysis(input);
  assert.equal(analysis.comparison.every(({ finding }) => finding.includes("Hold")), true);
  assert.equal(analysis.transferDecisions.every(({ decision }) => decision === "hold"), true);
});

test("analysis keeps unavailable evidence in verification instead of inventing a finding", async () => {
  const analysis = buildReferenceAnalysis(await analysisInputFixture());
  assert.equal(analysis.deepDives.every(({ evidenceIds }) => !evidenceIds.includes("ev-beta-offline")), true);
  assert.equal(analysis.verificationQueue.some(({ evidenceIds }) => evidenceIds.includes("ev-beta-offline")), true);
});

test("analysis preserves version or platform contexts and rejects invalid map relationships", async () => {
  const input = await analysisInputFixture({
    referenceContexts: [
      { contextId: "ctx-alpha-console-v1", referenceId: "ref-alpha", platform: "console", version: "1.0" },
      { contextId: "ctx-alpha-pc-v1", referenceId: "ref-alpha", platform: "pc", version: "1.0" },
      { contextId: "ctx-beta-pc-v1", referenceId: "ref-beta", platform: "pc", version: "1.0" },
      { contextId: "ctx-gamma-pc-v1", referenceId: "ref-gamma", platform: "pc", version: "1.0" },
    ],
  });
  input.evidence[0].contextId = "ctx-alpha-pc-v1";
  input.evidence[1].contextId = "ctx-gamma-pc-v1";
  assert.equal(buildReferenceAnalysis(input).referenceContexts.length, 4);
  const inventory = [{ systemId: "core-play", name: "Core play", applicability: "unknown", evidenceIds: ["ev-alpha-loop"] }];
  for (const edges of [
    [{ mapId: "map-orphan", systemId: "unknown-system", nodes: ["action"], edges: ["action-loop"] }],
    [{ mapId: "invalid map", systemId: "core-play", nodes: ["action"], edges: ["action-loop"] }],
  ]) assert.throws(() => buildSystemMaps({ inventory, edges, loops: [] }), { code: "reference-analysis.invalid-map" });
  assert.throws(() => buildSystemMaps({ inventory, edges: analysisMapFixture(), loops: [{ loopId: "loop-core", mapId: "map-core-play-loop", kind: "core", nodeIds: ["action", "reward"] }] }), { code: "reference-analysis.invalid-map" });
});

test("priority leaves a missing dimension unscored and artifact paths fail closed", async (t) => {
  const inventory = [{ systemId: "core-play", name: "Core play", applicability: "unknown", evidenceIds: ["ev-alpha-loop"] }];
  const maps = buildSystemMaps({ inventory, edges: analysisMapFixture(), loops: [] });
  assert.deepEqual(rankDeepDiveCandidates({ inventory, maps, questions: { "core-play": { relevance: 5 } } }), []);
  const analysis = buildReferenceAnalysis(await analysisInputFixture());
  const root = await analysisArtifactRoot(t);
  await assert.rejects(() => writeReferenceAnalysisWorkspace({ artifactRoot: root, analysis, relativePath: "../outside" }), /unsafe/i);
  const link = `${root}-link`;
  t.after(() => rm(link, { recursive: true, force: true }));
  await symlink(root, link);
  await assert.rejects(() => writeReferenceAnalysisWorkspace({ artifactRoot: link, analysis }), /unsafe/i);
  const transfers = buildDesignTransfers({ deepDives: analysis.deepDives, projectConstraints: ["ten-minute-session"], evidence: analysis.evidence, referenceContexts: analysis.referenceContexts, referenceSet: analysis.referenceSet });
  assert.equal(transfers.every(({ reviewState }) => reviewState === "pending-review"), true);
  assert.deepEqual(buildReferenceBrief(analysisBriefFixture()), analysis.brief);
  assert.equal(inventoryReferenceSystems({ brief: analysis.brief, atlas: analysis.atlasSelection, evidence: analysis.evidence, claims: [] }).length > 0, true);
});

test("reference analysis machine templates, catalog, and schema parse as JSON", async () => {
  const files = [
    "../../shared/reference-intelligence/templates/atlas-selection.json",
    "../../shared/reference-intelligence/templates/brief.json",
    "../../shared/reference-intelligence/templates/reference-set.yml",
    "../../shared/reference-intelligence/templates/evidence-register.yml",
    "../../shared/reference-intelligence/templates/system-inventory.json",
    "../../shared/reference-intelligence/catalog/system-atlas.json",
    "../../shared/reference-intelligence/catalog/source-register.json",
    "../../shared/reference-intelligence/schema/reference-analysis.schema.json",
  ];
  for (const file of files) {
    const contents = await readFile(new URL(file, import.meta.url), "utf8");
    assert.doesNotThrow(() => JSON.parse(contents));
  }
});

test("fix1 preserves evidence context bindings, structured loops, priority trace, and transfer audit", () => {
  const [evidence] = registerReferenceEvidence({ records: [{
    ...registryEvidence(),
    contextId: "ctx-cinematic-v1",
    systemIds: ["core-play"],
  }] });
  assert.equal(Object.keys(evidence).includes("counterexampleOf"), true);
  const inventory = [{ systemId: "core-play", name: "Core play", applicability: "unknown", evidenceIds: ["ev-default"] }];
  const maps = buildSystemMaps({
    inventory,
    edges: [{
      mapId: "map-core-play-loop",
      systemId: "core-play",
      nodes: [{ nodeId: "action", kind: "input", label: "Action" }, { nodeId: "resolve", kind: "process", label: "Resolve" }, { nodeId: "reward", kind: "output", label: "Reward" }],
      connections: [
        { connectionId: "action-to-resolve", fromNodeId: "action", toNodeId: "resolve", connectedSystemIds: ["core-play"] },
        { connectionId: "resolve-to-reward", fromNodeId: "resolve", toNodeId: "reward", connectedSystemIds: ["core-play"] },
        { connectionId: "reward-to-action", fromNodeId: "reward", toNodeId: "action", connectedSystemIds: ["core-play"] },
      ],
    }],
    loops: [{ loopId: "loop-core-play", mapId: "map-core-play-loop", kind: "core", nodeIds: ["action", "resolve", "reward"] }],
  });
  assert.equal(maps[0].loops[0].kind, "core");
  const priority = rankDeepDiveCandidates({ inventory, maps, questions: {
    "core-play": { relevance: 5, playerExperienceImpact: 5, economyProgressionImpact: 4, differentiationPotential: 4, evidenceStrength: 5, uncertainty: 2, researchCost: 1 },
  } });
  assert.equal(priority[0].researchCost, 1);
  const transferContexts = [{ contextId: "ctx-cinematic-v1", referenceId: "ref-cinematic-sample", version: "1", platform: "pc" }];
  const transfers = buildDesignTransfers({ deepDives: [{ systemId: "core-play", claimKind: "observation", finding: "Observed.", evidenceIds: ["ev-default"], referenceIds: ["ref-cinematic-sample"], contextIds: ["ctx-cinematic-v1"], coverageCount: 1 }], projectConstraints: ["ten-minute-session"], evidence: [evidence], referenceContexts: transferContexts, referenceSet: validReferenceAnalysis().referenceSet });
  assert.deepEqual(transfers[0].glossaryReceipt, null);
  assert.equal(transfers[0].validationState, "not-run");
});

test("fix1 binds only related available evidence and preserves contexts in canonical artifacts", async (t) => {
  const input = await analysisInputFixture({ evidence: analysisEvidenceFixture({ records: [{
    ...analysisEvidenceFixture()[0], evidenceId: "ev-alpha-progression", systemIds: ["progression"], claim: "A separate progression observation.",
  }] }) });
  const analysis = buildReferenceAnalysis(input);
  assert.deepEqual(analysis.deepDives[0].evidenceIds, ["ev-alpha-loop"]);
  assert.equal(analysis.transferDecisions[0].decision, "hold");
  const root = await analysisArtifactRoot(t);
  await writeReferenceAnalysisWorkspace({ artifactRoot: root, analysis });
  const register = JSON.parse(await readFile(join(root, "reference-intelligence", "evidence-register.yml"), "utf8"));
  assert.deepEqual(register.referenceContexts, analysis.referenceContexts);
  assert.equal(register.evidence.some(({ evidenceId }) => evidenceId === "ev-alpha-progression"), true);
  assert.match(await readFile(join(root, "reference-intelligence", "transfer-decisions.md"), "utf8"), /ev-alpha-loop/u);
  const mismatchedContext = structuredClone(input);
  mismatchedContext.evidence[0].contextId = "ctx-gamma-v1";
  assert.throws(() => buildReferenceAnalysis(mismatchedContext), { code: "reference-evidence.binding" });
});

test("fix1 rejects orphan, dangling, undeclared-cycle, and noncycle-loop maps", () => {
  const inventory = [{ systemId: "core-play", name: "Core play", applicability: "unknown", evidenceIds: ["ev-default"] }];
  const nodes = [{ nodeId: "action", kind: "input", label: "Action" }, { nodeId: "reward", kind: "output", label: "Reward" }];
  const connection = { connectionId: "action-to-reward", fromNodeId: "action", toNodeId: "reward", connectedSystemIds: ["core-play"] };
  const map = (nodesValue, connections = [connection]) => [{ mapId: "map-core-play", systemId: "core-play", nodes: nodesValue, connections }];
  assert.throws(() => buildSystemMaps({ inventory, edges: map([...nodes, { nodeId: "unused", kind: "process", label: "Unused" }]), loops: [] }), { code: "reference-analysis.invalid-map" });
  assert.throws(() => buildSystemMaps({ inventory, edges: map(nodes, [{ ...connection, toNodeId: "missing" }]), loops: [] }), { code: "reference-analysis.invalid-map" });
  const cycleConnections = [...map(nodes)[0].connections, { connectionId: "reward-to-action", fromNodeId: "reward", toNodeId: "action", connectedSystemIds: ["core-play"] }];
  assert.throws(() => buildSystemMaps({ inventory, edges: map(nodes, cycleConnections), loops: [] }), { code: "reference-analysis.invalid-map" });
  assert.throws(() => buildSystemMaps({ inventory, edges: map(nodes), loops: [{ loopId: "loop-core", mapId: "map-core-play", kind: "core", nodeIds: ["action", "reward"] }] }), { code: "reference-analysis.invalid-map" });
});

test("fix1 priority keeps seven dimensions with inverse-cost and UTF-8 tie breaks", () => {
  const inventory = ["alpha-system", "zeta-system"].map((systemId) => ({ systemId, name: systemId, applicability: "unknown", evidenceIds: ["ev-default"] }));
  const maps = inventory.map(({ systemId }) => ({ mapId: `map-${systemId}`, systemId, nodes: [], connections: [], loops: [] }));
  const score = (researchCost) => ({ relevance: 4, playerExperienceImpact: 4, economyProgressionImpact: 4, differentiationPotential: 4, evidenceStrength: 4, uncertainty: 2, researchCost });
  assert.deepEqual(rankDeepDiveCandidates({ inventory, maps, questions: { "alpha-system": score(2), "zeta-system": score(1) } }).map(({ systemId }) => systemId), ["zeta-system", "alpha-system"]);
  assert.deepEqual(rankDeepDiveCandidates({ inventory, maps, questions: { "alpha-system": score(1), "zeta-system": score(1) } }).map(({ systemId }) => systemId), ["alpha-system", "zeta-system"]);
});

test("fix1 rejects oversized projection before creating an artifact tree", async (t) => {
  const root = await analysisArtifactRoot(t);
  const analysis = structuredClone(buildReferenceAnalysis(await analysisInputFixture()));
  analysis.brief.objective = "x".repeat(2 * 1024 * 1024);
  await assert.rejects(() => writeReferenceAnalysisWorkspace({ artifactRoot: root, analysis }), /unsafe/i);
  assert.deepEqual(await readdir(root), []);
});

test("fix2 recomputes transfer coverage from authoritative evidence instead of caller trace", () => {
  const evidence = registerReferenceEvidence({ records: [{
    ...registryEvidence({ evidenceId: "ev-authoritative", contextId: "ctx-authoritative", referenceId: "ref-cinematic-sample" }),
    systemIds: ["system-reveal-loop"],
  }] });
  assert.throws(() => buildDesignTransfers({
    deepDives: [{ systemId: "system-reveal-loop", claimKind: "observation", finding: "Observed.", evidenceIds: ["ev-authoritative"], referenceIds: ["fake-reference", "ref-cinematic-sample"], contextIds: ["ctx-authoritative"], coverageCount: 2 }],
    projectConstraints: ["ten-minute-session"],
    evidence,
    referenceContexts: [{ contextId: "ctx-authoritative", referenceId: "ref-cinematic-sample", version: "1", platform: "pc" }],
    referenceSet: validReferenceAnalysis().referenceSet,
  }), { code: "reference-analysis.invalid-transfer" });
  const transfers = buildDesignTransfers({
    deepDives: [{ systemId: "system-reveal-loop", claimKind: "observation", finding: "Observed.", evidenceIds: ["ev-authoritative"], referenceIds: ["ref-cinematic-sample"], contextIds: ["ctx-authoritative"], coverageCount: 1 }],
    projectConstraints: ["ten-minute-session"], evidence,
    referenceContexts: [{ contextId: "ctx-authoritative", referenceId: "ref-cinematic-sample", version: "1", platform: "pc" }], referenceSet: validReferenceAnalysis().referenceSet,
  });
  assert.equal(transfers[0].decision, "hold");
  assert.deepEqual(transfers[0].referenceIds, ["ref-cinematic-sample"]);
});

test("fix2 holds unavailable-only systems but allows two observed references to clear the queue", async (t) => {
  const observed = analysisEvidenceFixture()[0];
  const sufficient = buildReferenceAnalysis(await analysisInputFixture({ evidence: [
    observed,
    { ...observed, evidenceId: "ev-beta-loop", referenceId: "ref-beta", contextId: "ctx-beta-v1", claim: "A second reference observes the same core loop." },
  ] }));
  assert.equal(sufficient.transferDecisions[0].decision, "adapt");
  assert.deepEqual(sufficient.verificationQueue, []);
  assert.equal(validateReferenceAnalysis(sufficient).ok, true);
  const root = await analysisArtifactRoot(t);
  await writeReferenceAnalysisWorkspace({ artifactRoot: root, analysis: sufficient });
  for (const relativePath of ["comparison-matrix.md", "transfer-decisions.md"]) {
    const outputLines = (await readFile(join(root, "reference-intelligence", relativePath), "utf8")).trim().split("\n");
    const templateLines = (await readFile(new URL(`../../shared/reference-intelligence/templates/${relativePath}`, import.meta.url), "utf8")).trim().split("\n");
    assert.equal(outputLines[2], templateLines[2]);
    const cellCount = (line) => line.split("|").length - 2;
    const expectedColumns = relativePath === "comparison-matrix.md" ? 10 : 13;
    assert.equal([templateLines[2], templateLines[3], templateLines[4], ...outputLines.slice(2)].every((line) => cellCount(line) === expectedColumns), true);
  }
  const unavailableOnly = buildReferenceAnalysis(await analysisInputFixture({ evidence: [{
    ...analysisEvidenceFixture()[0], evidenceId: "ev-alpha-offline", sourceType: "official-site", claim: "Unavailable core-loop source.", availability: "unavailable", limitation: "Offline.", verificationQuestion: "Which official page can verify the loop?",
  }] }));
  assert.equal(unavailableOnly.systemInventory.some(({ systemId, evidenceIds }) => systemId === "core-play" && evidenceIds.includes("ev-alpha-offline")), true);
  assert.deepEqual(unavailableOnly.deepDives[0].referenceIds, []);
  assert.equal(unavailableOnly.transferDecisions[0].decision, "hold");
  assert.equal(unavailableOnly.verificationQueue.length > 0, true);
  assert.equal(validateReferenceAnalysis(unavailableOnly).ok, true);
});

test("fix2 closes partial claim bindings, context references, availability branches, and empty constraints", async () => {
  const evidence = registerReferenceEvidence({ records: [registryEvidence({ evidenceId: "ev-core", systemIds: ["core-play"] })] })[0];
  assert.deepEqual(validateClaimAgainstEvidence({
    claim: { claimId: "claim-partial", kind: "observation", category: "general", causal: false, evidenceIds: ["ev-core"], systemIds: ["core-play", "progression"] },
    evidenceById: new Map([["ev-core", evidence]]),
  }), { ok: false, code: "evidence_system_mismatch" });
  assert.throws(() => buildDesignTransfers({ deepDives: [], projectConstraints: [], evidence: [evidence], referenceContexts: [], referenceSet: [] }), /Reference analysis is invalid/u);
  const schema = JSON.parse(await readFile(new URL("../../shared/reference-intelligence/schema/reference-analysis.schema.json", import.meta.url), "utf8"));
  const contextValue = structuredClone(validReferenceAnalysis());
  contextValue.referenceContexts[0].referenceId = "missing-reference";
  assert.deepEqual([schemaAccepts(contextValue, schema, schema), validateReferenceAnalysis(contextValue).ok], [true, false]);
  for (const mutate of [
    (value) => { value.referenceSet[0].limitation = "available cannot carry a limitation"; },
    (value) => { value.referenceSet[2].limitation = null; },
    (value) => { value.evidence[0].verificationQuestion = "available cannot carry a verification question"; },
    (value) => { value.evidence[0].availability = "unavailable"; value.evidence[0].limitation = null; value.evidence[0].verificationQuestion = null; },
  ]) {
    const value = structuredClone(validReferenceAnalysis());
    mutate(value);
    assert.deepEqual([schemaAccepts(value, schema, schema), validateReferenceAnalysis(value).ok], [false, false]);
  }
});

test("fix2 accepts declared core, session, and meta cycles but rejects a missing process path", () => {
  const inventory = ["core-play", "progression", "rewards"].map((systemId) => ({ systemId, name: systemId, applicability: "unknown", evidenceIds: [] }));
  const nodes = [{ nodeId: "action", kind: "input", label: "Action" }, { nodeId: "resolve", kind: "process", label: "Resolve" }, { nodeId: "reward", kind: "output", label: "Reward" }];
  const map = (mapId, systemId, loopId, kind) => ({ mapId, systemId, nodes, connections: [
    { connectionId: "action-to-resolve", fromNodeId: "action", toNodeId: "resolve", connectedSystemIds: [systemId] },
    { connectionId: "resolve-to-reward", fromNodeId: "resolve", toNodeId: "reward", connectedSystemIds: [systemId] },
    { connectionId: "reward-to-action", fromNodeId: "reward", toNodeId: "action", connectedSystemIds: [systemId] },
  ], loopId, kind });
  const definitions = [map("map-core", "core-play", "loop-core", "core"), map("map-progression", "progression", "loop-session", "session"), map("map-rewards", "rewards", "loop-meta", "meta")];
  const maps = buildSystemMaps({ inventory, edges: definitions.map(({ loopId, kind, ...definition }) => definition), loops: definitions.map(({ mapId, loopId, kind }) => ({ mapId, loopId, kind, nodeIds: ["action", "resolve", "reward"] })) });
  assert.deepEqual(maps.flatMap(({ loops }) => loops.map(({ kind }) => kind)), ["core", "session", "meta"]);
  assert.throws(() => buildSystemMaps({ inventory: [inventory[0]], edges: [{ mapId: "map-missing-process", systemId: "core-play", nodes: [{ nodeId: "action", kind: "input", label: "Action" }, { nodeId: "reward", kind: "output", label: "Reward" }], connections: [{ connectionId: "action-to-reward", fromNodeId: "action", toNodeId: "reward", connectedSystemIds: ["core-play"] }] }], loops: [] }), { code: "reference-analysis.invalid-map" });
});

test("fix3 public APIs reject self-cycles and certainty or transfer trace downgrades", () => {
  const inventory = [{ systemId: "core-play", name: "Core play", applicability: "unknown", evidenceIds: [] }];
  assert.throws(() => buildSystemMaps({ inventory, edges: [{
    mapId: "map-self-edge", systemId: "core-play",
    nodes: [{ nodeId: "action", kind: "input", label: "Action" }, { nodeId: "resolve", kind: "process", label: "Resolve" }, { nodeId: "reward", kind: "output", label: "Reward" }],
    connections: [{ connectionId: "action-to-resolve", fromNodeId: "action", toNodeId: "resolve", connectedSystemIds: ["core-play"] }, { connectionId: "resolve-to-reward", fromNodeId: "resolve", toNodeId: "reward", connectedSystemIds: ["core-play"] }, { connectionId: "reward-to-reward", fromNodeId: "reward", toNodeId: "reward", connectedSystemIds: ["core-play"] }],
  }], loops: [] }), { code: "reference-analysis.invalid-map" });
  const certaintyUpgrade = structuredClone(validReferenceAnalysis());
  certaintyUpgrade.evidence[0].claimKind = "hypothesis";
  certaintyUpgrade.deepDives[0].claimKind = "observation";
  assert.equal(validateReferenceAnalysis(certaintyUpgrade).ok, false);
  const [evidence] = registerReferenceEvidence({ records: [registryEvidence({ evidenceId: "ev-fix3", systemIds: ["system-reveal-loop"] })] });
  assert.throws(() => buildDesignTransfers({
    deepDives: [{ systemId: "system-reveal-loop", claimKind: "unknown", finding: "Observed.", evidenceIds: ["ev-fix3"], referenceIds: ["ref-cinematic-sample"], contextIds: ["ctx-cinematic-v1"], coverageCount: 1 }],
    projectConstraints: ["ten-minute-session"], evidence: [evidence], referenceContexts: [{ contextId: "ctx-cinematic-v1", referenceId: "ref-cinematic-sample", version: "1", platform: "pc" }], referenceSet: validReferenceAnalysis().referenceSet,
  }), { code: "reference-analysis.invalid-transfer" });
  const selfEdge = structuredClone(validReferenceAnalysis());
  selfEdge.systemMaps[0].connections.push({ connectionId: "z-choice-loop", fromNodeId: "choice", toNodeId: "choice", connectedSystemIds: ["system-reveal-loop"] });
  assert.equal(validateReferenceAnalysis(selfEdge).ok, false);
});

test("fix3 keeps priority and deep dives in rank order and requires every real verification entry", async () => {
  const { atlas } = await loadBundledReferenceCatalog({ moduleRoot: bundledReferenceRoot });
  const coreMap = analysisMapFixture()[0];
  const progressionMap = {
    ...coreMap,
    mapId: "map-progression-loop",
    systemId: "progression",
    connections: coreMap.connections.map((connection) => ({ ...connection, connectedSystemIds: ["progression"] })),
  };
  const coreEvidence = analysisEvidenceFixture()[0];
  const analysis = buildReferenceAnalysis(await analysisInputFixture({
    atlas: { atlas, genreIds: ["action-rpg"] },
    evidence: [...analysisEvidenceFixture(), { ...coreEvidence, evidenceId: "ev-alpha-progression", systemIds: ["progression"], claim: "The player advances through a distinct progression loop." }],
    edges: [coreMap, progressionMap],
    priorities: {
      "core-play": { relevance: 4, playerExperienceImpact: 4, economyProgressionImpact: 3, differentiationPotential: 4, evidenceStrength: 5, uncertainty: 2, researchCost: 2 },
      progression: { relevance: 5, playerExperienceImpact: 5, economyProgressionImpact: 5, differentiationPotential: 5, evidenceStrength: 5, uncertainty: 1, researchCost: 1 },
    },
  }));
  assert.deepEqual(analysis.priority.map(({ systemId, rank }) => [systemId, rank]), [["progression", 1], ["core-play", 2]]);
  assert.deepEqual(analysis.deepDives.map(({ systemId }) => systemId), ["progression", "core-play"]);
  assert.equal(validateReferenceAnalysis(analysis).ok, true);
  const reordered = structuredClone(analysis);
  reordered.priority.reverse();
  assert.equal(validateReferenceAnalysis(reordered).ok, false);
  const downgraded = structuredClone(buildReferenceAnalysis(await analysisInputFixture({ evidence: [
    coreEvidence,
    { ...coreEvidence, evidenceId: "ev-beta-loop", referenceId: "ref-beta", contextId: "ctx-beta-v1", claim: "A second reference observes the same core loop." },
  ] })));
  downgraded.deepDives[0].claimKind = "unknown";
  downgraded.transferDecisions[0].decision = "hold";
  assert.equal(validateReferenceAnalysis(downgraded).ok, false);
  const missingQueue = structuredClone(buildReferenceAnalysis(await analysisInputFixture()));
  missingQueue.verificationQueue.pop();
  assert.equal(validateReferenceAnalysis(missingQueue).ok, false);
});

test("fix4 final validator rejects a score order that contradicts contiguous ranks", async () => {
  const { atlas } = await loadBundledReferenceCatalog({ moduleRoot: bundledReferenceRoot });
  const coreMap = analysisMapFixture()[0];
  const progressionMap = { ...coreMap, mapId: "map-progression-loop", systemId: "progression", connections: coreMap.connections.map((connection) => ({ ...connection, connectedSystemIds: ["progression"] })) };
  const coreEvidence = analysisEvidenceFixture()[0];
  const analysis = buildReferenceAnalysis(await analysisInputFixture({
    atlas: { atlas, genreIds: ["action-rpg"] },
    evidence: [...analysisEvidenceFixture(), { ...coreEvidence, evidenceId: "ev-fix4-progression", systemIds: ["progression"], claim: "A progression loop is observed." }],
    edges: [coreMap, progressionMap],
    priorities: {
      "core-play": { relevance: 4, playerExperienceImpact: 4, economyProgressionImpact: 3, differentiationPotential: 4, evidenceStrength: 5, uncertainty: 2, researchCost: 2 },
      progression: { relevance: 5, playerExperienceImpact: 5, economyProgressionImpact: 5, differentiationPotential: 5, evidenceStrength: 5, uncertainty: 1, researchCost: 1 },
    },
  }));
  const contradictory = structuredClone(analysis);
  contradictory.priority[0].evidenceStrength = 1;
  contradictory.priority[0].relevance = 1;
  assert.equal(validateReferenceAnalysis(contradictory).ok, false);
  const reordered = structuredClone(analysis);
  reordered.priority.reverse().forEach((entry, index) => { entry.rank = index + 1; });
  reordered.deepDives.reverse();
  assert.equal(validateReferenceAnalysis(reordered).ok, false);
  const substitutedComparison = structuredClone(analysis);
  const coreComparison = substitutedComparison.comparison.find(({ sourceSystemId }) => sourceSystemId === "core-play");
  const progressionDive = substitutedComparison.deepDives.find(({ systemId }) => systemId === "progression");
  coreComparison.evidenceIds = progressionDive.evidenceIds;
  coreComparison.referenceIds = progressionDive.referenceIds;
  coreComparison.contextIds = progressionDive.contextIds;
  coreComparison.coverageCount = progressionDive.coverageCount;
  assert.equal(validateReferenceAnalysis(substitutedComparison).ok, false);
  const queued = buildReferenceAnalysis(await analysisInputFixture());
  assert.equal(queued.verificationQueue.some(({ verificationId }) => verificationId === "verify-evidence-ev-beta-offline"), true);
  assert.equal(queued.verificationQueue.some(({ verificationId }) => verificationId === "verify-system-core-play"), true);
  const alteredQuestion = structuredClone(queued);
  alteredQuestion.verificationQueue.find(({ verificationId }) => verificationId === "verify-evidence-ev-beta-offline").question = "Arbitrary pending question.";
  assert.equal(validateReferenceAnalysis(alteredQuestion).ok, false);
});

test("fix5 derives comparison state and rejects contradictory comparison presentation", async () => {
  const observed = analysisEvidenceFixture()[0];
  const coverageOne = buildReferenceAnalysis(await analysisInputFixture());
  assert.equal(coverageOne.comparison[0].state, "hold");
  const coverageZeroUnknown = buildReferenceAnalysis(await analysisInputFixture({ evidence: [{
    ...observed, evidenceId: "ev-fix5-offline", availability: "unavailable", limitation: "Offline.", verificationQuestion: "Which official page can verify the loop?",
  }] }));
  assert.deepEqual([coverageZeroUnknown.comparison[0].coverageCount, coverageZeroUnknown.comparison[0].claimKind, coverageZeroUnknown.comparison[0].state], [0, "unknown", "hold"]);
  const unknownCoverageOne = buildReferenceAnalysis(await analysisInputFixture({ evidence: [{ ...observed, claimKind: "unknown", claim: "The available source remains unknown." }] }));
  assert.deepEqual([unknownCoverageOne.comparison[0].coverageCount, unknownCoverageOne.comparison[0].claimKind, unknownCoverageOne.comparison[0].state], [1, "unknown", "hold"]);
  const ready = buildReferenceAnalysis(await analysisInputFixture({ evidence: [observed, { ...observed, evidenceId: "ev-fix5-beta", referenceId: "ref-beta", contextId: "ctx-beta-v1", claim: "A second reference observes the same loop." }] }));
  assert.equal(ready.comparison[0].state, "ready");
  for (const mutate of [
    (value) => { value.comparison[0].state = "hold"; },
    (value) => { value.comparison[0].subject = "Contradictory subject"; },
    (value) => { value.comparison[0].finding = "Hold comparison conclusion pending sufficient observed reference coverage."; },
  ]) {
    const value = structuredClone(ready);
    mutate(value);
    assert.equal(validateReferenceAnalysis(value).ok, false);
  }
  const wrongTrace = structuredClone(coverageOne);
  wrongTrace.comparison[0].evidenceIds = [];
  const diagnostic = validateReferenceAnalysis(wrongTrace);
  assert.equal(diagnostic.ok, false);
  assert.equal(diagnostic.errors.some(({ path }) => path === "/comparison/0/coverageCount"), true);
  const wrongTransfer = structuredClone(coverageOne);
  wrongTransfer.transferDecisions[0].evidenceIds = [];
  const transferDiagnostic = validateReferenceAnalysis(wrongTransfer);
  assert.equal(transferDiagnostic.ok, false);
  assert.equal(transferDiagnostic.errors.some(({ path }) => path === "/transferDecisions/0/coverageCount"), true);
});

test("reference analysis retains its pre-glossary tab-safe text contract", () => {
  const value = validReferenceAnalysis();
  value.brief.objective = "Identify\tusable pacing patterns.";
  assert.equal(validateReferenceAnalysis(value).ok, true);
});
