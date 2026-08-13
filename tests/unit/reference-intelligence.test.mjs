import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
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

function validReferenceAnalysis() {
  return {
    schemaVersion: 1,
    analysisId: "cutscene-reference-v1",
    brief: {
      objective: "Identify reusable cutscene pacing patterns.",
      decisionQuestions: ["Which pacing loop supports player agency?"],
    },
    referenceSet: [
      { referenceId: "ref-cinematic-sample", label: "Cinematic sample", role: "core-system-exemplar", availability: "available", limitation: null },
      { referenceId: "ref-cinematic-sample", label: "Cinematic sample", role: "direct-competitor", availability: "available", limitation: null },
      { referenceId: "ref-cinematic-sample", label: "Cinematic sample", role: "operations-monetization-comparator", availability: "unavailable", limitation: "No comparable operations evidence is available." },
    ],
    evidence: [{
      evidenceId: "evidence-cinematic-loop",
      referenceId: "ref-cinematic-sample",
      tier: "primary",
      sourceType: "direct-play",
      availability: "available",
      limitation: null,
      verificationQuestion: null,
      claimKind: "observation",
      claim: "The player receives a movement choice after the reveal.",
    }],
    atlasSelection: [{ systemId: "system-reveal-loop", rationale: "Supports the decision question." }],
    systemInventory: [{
      systemId: "system-reveal-loop",
      name: "Reveal loop",
      applicability: "required-candidate",
      evidenceIds: ["evidence-cinematic-loop"],
    }],
    systemMaps: [{
      mapId: "map-reveal-loop",
      systemId: "system-reveal-loop",
      nodes: ["choice", "reveal"],
      edges: ["reveal-to-choice"],
    }],
    priority: [{ systemId: "system-reveal-loop", rank: 1, rationale: "Directly answers the brief." }],
    deepDives: [{
      systemId: "system-reveal-loop",
      claimKind: "inference",
      finding: "A choice after a reveal preserves agency.",
      evidenceIds: ["evidence-cinematic-loop"],
    }],
    comparison: [{
      comparisonId: "comparison-reveal-loop",
      subject: "Reveal loop",
      finding: "Choice timing is the differentiator.",
      evidenceIds: ["evidence-cinematic-loop"],
    }],
    transferDecisions: [{
      transferId: "transfer-reveal-loop",
      sourceSystemId: "system-reveal-loop",
      decision: "adapt",
      rationale: "Keep the agency beat while changing fiction.",
      evidenceIds: ["evidence-cinematic-loop"],
      glossaryReceipt: {
        documentId: "reference-analysis-cutscene-reference-v1",
        glossaryVersion: 1,
        glossarySha256: "0".repeat(64),
        termIds: ["TERM-PLAYER-AGENCY"],
      },
      reviewState: "pending-review",
    }],
    verificationQueue: [{
      verificationId: "verify-reveal-loop",
      question: "Does the choice remain legible in a playable prototype?",
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
const bundledReferenceRoot = fileURLToPath(new URL("../../shared/reference-intelligence/", import.meta.url));

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
    (value) => { value.systemMaps[0].nodes = ["reveal", "choice"]; },
    (value) => { value.systemMaps[0].edges = ["reveal-to-choice", "reveal-to-choice"]; },
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
  if (schema.allOf && !schema.allOf.every((part) => schemaAccepts(value, part, root))) return false;
  if (schema.if && schemaAccepts(value, schema.if, root) && schema.then && !schemaAccepts(value, schema.then, root)) return false;
  if (schema.const !== undefined && !equalsJson(value, schema.const)) return false;
  if (schema.enum && !schema.enum.some((candidate) => equalsJson(value, candidate))) return false;
  if (schema.type === "object" && (value === null || typeof value !== "object" || Array.isArray(value))) return false;
  if (schema.type === "array" && !Array.isArray(value)) return false;
  if (schema.type === "string" && typeof value !== "string") return false;
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
    (value) => { value.transferDecisions[0].glossaryReceipt.termIds = ["bad term"]; },
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
    claim: { claimId: "claim-bm-1", kind: "observation", category: "monetization", causal: true, evidenceIds: ["ev-community-1"] },
    evidenceById: new Map([["ev-community-1", { tier: "discovery", sourceType: "community", availability: "available", limitation: null, verificationQuestion: null, claimKind: "observation" }]]),
  });
  assert.deepEqual(result, { ok: false, code: "unsupported_causal_claim" });
});

test("evidence registry derives and preserves source tiers without trusting supplied tiers", () => {
  assert.deepEqual(registerReferenceEvidence({ records: [
    { evidenceId: "ev-video", sourceType: "video", availability: "available", limitation: null, verificationQuestion: null },
    { evidenceId: "ev-patch", sourceType: "official-patch-note", availability: "available", limitation: null, verificationQuestion: null },
    { evidenceId: "ev-talk", sourceType: "developer-talk", availability: "available", limitation: null, verificationQuestion: null },
  ] }).map(({ evidenceId, tier }) => [evidenceId, tier]), [
    ["ev-patch", "primary"],
    ["ev-talk", "supporting"],
    ["ev-video", "discovery"],
  ]);
  assert.throws(
    () => registerReferenceEvidence({ records: [{ evidenceId: "ev-mismatched", sourceType: "community", tier: "primary", availability: "available", limitation: null, verificationQuestion: null }] }),
    { code: "reference-evidence.tier" },
  );
  assert.throws(
    () => registerReferenceEvidence({ records: [
      { evidenceId: "ev-duplicate", sourceType: "official-site", availability: "available", limitation: null, verificationQuestion: null },
      { evidenceId: "ev-duplicate", sourceType: "official-site", availability: "available", limitation: null, verificationQuestion: null },
    ] }),
    { code: "reference-evidence.duplicate-id" },
  );
});

test("bundled catalog preserves optional source fallbacks and exact registered URLs", async () => {
  const { sourceRegister } = await loadBundledReferenceCatalog({ moduleRoot: bundledReferenceRoot });
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
  assert.deepEqual(registerReferenceEvidence({ records: [{
    evidenceId: "ev-offline-source",
    sourceType: "official-site",
    availability: "unavailable",
    limitation: "Offline source unavailable; direct verification remains open.",
    verificationQuestion: "Which official source can verify this when access returns?",
  }] }), [{
    evidenceId: "ev-offline-source",
    sourceType: "official-site",
    availability: "unavailable",
    limitation: "Offline source unavailable; direct verification remains open.",
    verificationQuestion: "Which official source can verify this when access returns?",
    tier: "primary",
  }]);
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
  assert.throws(() => registerReferenceEvidence({ records: [{ evidenceId: "ev-open", sourceType: "official-site" }] }), { code: "reference-evidence.availability" });
  assert.deepEqual(registerReferenceEvidence({ records: [{
    evidenceId: "ev-unavailable", sourceType: "official-site", availability: "unavailable",
    limitation: "No access.", verificationQuestion: "What official page can verify this?",
  }] })[0].availability, "unavailable");
  const unavailable = { tier: "primary", sourceType: "official-site", availability: "unavailable", limitation: "No access.", verificationQuestion: "What official page can verify this?", claimKind: "observation" };
  const claim = { claimId: "claim-unavailable", kind: "observation", category: "general", causal: false, evidenceIds: ["ev-unavailable"] };
  assert.deepEqual(validateClaimAgainstEvidence({ claim, evidenceById: new Map([["ev-unavailable", unavailable]]) }), { ok: false, code: "evidence_unavailable" });
  const analysis = validReferenceAnalysis();
  analysis.evidence[0] = {
    ...registerReferenceEvidence({ records: [{
      evidenceId: "evidence-cinematic-loop", referenceId: "ref-cinematic-sample", sourceType: "official-site", availability: "unavailable",
      limitation: "The official page is unavailable offline.", verificationQuestion: "Which official patch note confirms the movement choice?",
      claimKind: "observation", claim: "The player receives a movement choice after the reveal.",
    }] })[0],
  };
  const schema = JSON.parse(await readFile(new URL("../../shared/reference-intelligence/schema/reference-analysis.schema.json", import.meta.url), "utf8"));
  assert.deepEqual([schemaAccepts(analysis, schema, schema), validateReferenceAnalysis(analysis).ok], [true, true]);
});

test("claim support closes shape, certainty escalation, causal omission, and discovery mixing", () => {
  const hypothesis = { tier: "primary", sourceType: "official-site", availability: "available", limitation: null, verificationQuestion: null, claimKind: "hypothesis" };
  const observation = { tier: "primary", sourceType: "official-site", availability: "available", limitation: null, verificationQuestion: null, claimKind: "observation" };
  const discovery = { tier: "discovery", sourceType: "community", availability: "available", limitation: null, verificationQuestion: null, claimKind: "observation" };
  assert.deepEqual(validateClaimAgainstEvidence({
    claim: { claimId: "claim-observation", kind: "observation", category: "general", causal: false, evidenceIds: ["ev-hypothesis"] },
    evidenceById: new Map([["ev-hypothesis", hypothesis]]),
  }), { ok: false, code: "unsupported_claim_kind" });
  for (const claim of [
    { claimId: "claim-no-category", kind: "observation", causal: false, evidenceIds: ["ev-observation"] },
    { claimId: "claim-no-causal", kind: "observation", category: "general", evidenceIds: ["ev-observation"] },
    { claimId: "claim-unsorted", kind: "observation", category: "general", causal: false, evidenceIds: ["ev-z", "ev-a"] },
  ]) assert.deepEqual(validateClaimAgainstEvidence({ claim, evidenceById: new Map([["ev-observation", observation], ["ev-z", observation], ["ev-a", observation]]) }), { ok: false, code: "invalid_claim" });
  const causal = { claimId: "claim-causal", kind: "observation", category: "general", causal: true, evidenceIds: ["ev-discovery"] };
  assert.deepEqual(validateClaimAgainstEvidence({ claim: causal, evidenceById: new Map([["ev-discovery", discovery]]) }), { ok: false, code: "unsupported_causal_claim" });
  assert.deepEqual(validateClaimAgainstEvidence({
    claim: { ...causal, evidenceIds: ["ev-discovery", "ev-primary"] },
    evidenceById: new Map([["ev-discovery", discovery], ["ev-primary", observation]]),
  }), { ok: true, code: "supported" });
});

test("claim evidence rejects Map subclasses and proxies without exposing thrown data", () => {
  class DerivedMap extends Map {}
  const claim = { claimId: "claim-map", kind: "observation", category: "general", causal: false, evidenceIds: ["ev-map"] };
  const evidence = { tier: "primary", sourceType: "official-site", availability: "available", limitation: null, verificationQuestion: null, claimKind: "observation" };
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
  const root = await mkdtemp(join(tmpdir(), "reference-atlas-"));
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
