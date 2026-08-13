import assert from "node:assert/strict";
import { test } from "node:test";

import {
  canonicalJson,
  canonicalReferenceAnalysis,
  sha256Canonical,
  validateReferenceAnalysis,
} from "../../shared/scripts/validate-reference-intelligence.mjs";

function validReferenceAnalysis() {
  return {
    schemaVersion: 1,
    analysisId: "cutscene-reference-v1",
    brief: {
      objective: "Identify reusable cutscene pacing patterns.",
      decisionQuestions: ["Which pacing loop supports player agency?"],
    },
    referenceSet: [{ referenceId: "ref-cinematic-sample", label: "Cinematic sample" }],
    evidence: [{
      evidenceId: "evidence-cinematic-loop",
      referenceId: "ref-cinematic-sample",
      tier: "primary",
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

test("canonical JSON has stable key ordering and a stable SHA-256 digest", () => {
  assert.equal(canonicalJson({ b: 1, a: [true, null] }), '{"a":[true,null],"b":1}');
  assert.equal(sha256Canonical({ b: 1, a: [true, null] }), sha256Canonical({ a: [true, null], b: 1 }));
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
