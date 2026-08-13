import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { canonicalJson, sha256Canonical, validateGameDesignGlossary, validateGlossaryReceipt } from "../../shared/scripts/validate-reference-intelligence.mjs";
import { assertGlossaryHumanDecision, issueGlossaryHumanDecision } from "../../shared/scripts/lib/game-design-glossary-capabilities.mjs";
import { applyGlossaryDecision, createGlossarySnapshot, extractGlossaryCandidates, mergeGameDesignGlossaries, validateDocumentTerminology, writeGameDesignGlossaryArtifacts } from "../../shared/scripts/manage-game-design-glossary.mjs";
import { validateGameDesignWritingLanguage } from "../../shared/scripts/validate-game-design-writing-language.mjs";

const changedAt = "2026-08-13T00:00:00.000Z";
const termFields = ["termId", "koPreferred", "enPreferred", "definition", "scope", "contexts", "abbreviations", "allowedVariants", "forbiddenTerms", "deprecatedTerms", "untranslatedExpressions", "grammar", "examples", "confusedConceptIds", "decisionIds", "evidenceIds", "state", "approver", "replacementTermId", "version", "changedAt"];

function term(overrides = {}) {
  return {
    termId: "TERM-PLAYER-POWER", koPreferred: "플레이어 파워", enPreferred: "Player Power", definition: "A measure of player strength.", scope: "combat", contexts: ["combat"], abbreviations: [], allowedVariants: [], forbiddenTerms: ["전투력"], deprecatedTerms: [], untranslatedExpressions: [], grammar: { ko: "명사", en: "noun" }, examples: [], confusedConceptIds: [], decisionIds: [], evidenceIds: [], state: "proposed", approver: null, replacementTermId: null, version: 1, changedAt,
    ...overrides,
  };
}

function glossary(overrides = {}) { return { schemaVersion: 1, scope: "shared", version: 1, terms: [term()], ...overrides }; }
function approvedGlossary(overrides = {}) { return glossary({ terms: [term({ state: "approved", approver: "Lead Designer", decisionIds: ["decision-player-power"] })], ...overrides }); }
function decision(input = {}) { return issueGlossaryHumanDecision({ action: "approve", termIds: ["TERM-PLAYER-POWER"], actor: "Lead Designer", eventId: "decision-player-power", glossarySha256: sha256Canonical(glossary()), glossaryVersion: 1, changedAt, ...input }); }
function approvedEffective() { return mergeGameDesignGlossaries({ sharedGlossary: approvedGlossary(), projectOverlay: { schemaVersion: 1, scope: "project-overlay", version: 1, terms: [] } }); }

test("v1 glossary terms have exact runtime field parity and reject noncanonical values", () => {
  const valid = glossary();
  assert.equal(validateGameDesignGlossary(valid).ok, true);
  assert.deepEqual(Object.keys(valid.terms[0]).sort(), [...termFields].sort());
  for (const mutate of [
    (value) => { value.terms[0].unknown = true; },
    (value) => { value.terms[0].termId = "term-player-power"; },
    (value) => { value.terms[0].koPreferred = "e\u0301"; },
    (value) => { value.terms[0].enPreferred = "bad\rtext"; },
    (value) => { value.terms[0].definition = "bad\0text"; },
    (value) => { value.terms[0].contexts = ["combat", "combat"]; },
    (value) => { value.terms[0].contexts = ["z", "a"]; },
    (value) => { value.terms[0].definition = "x".repeat(2 * 1024 * 1024); },
  ]) { const value = structuredClone(valid); mutate(value); assert.equal(validateGameDesignGlossary(value).ok, false); }
});

test("glossary JSON schema has the exact closed term field contract", async () => {
  const schema = JSON.parse(await readFile(new URL("../../shared/reference-intelligence/schema/game-design-glossary.schema.json", import.meta.url), "utf8"));
  assert.equal(schema.additionalProperties, false);
  assert.deepEqual(schema.properties.terms.items.required, termFields);
  assert.equal(schema.properties.terms.items.additionalProperties, false);
});

test("live human authority rejects copies, proxies, role actors, duplicates, stale receipts and unsupported actions", () => {
  const issued = decision();
  assert.doesNotThrow(() => assertGlossaryHumanDecision(issued.receipt, issued.capability));
  for (const [receipt, capability] of [
    [structuredClone(issued.receipt), issued.capability], [issued.receipt, structuredClone(issued.capability)], [issued.receipt, new Proxy(issued.capability, {})], [{ ...issued.receipt, action: "publish" }, issued.capability],
  ]) assert.throws(() => assertGlossaryHumanDecision(receipt, capability), /human glossary decision/i);
  for (const input of [
    { actor: "ChatGPT" }, { actor: "assistant" }, { actor: "agent" }, { actor: "bot" }, { actor: "model" }, { actor: "system" }, { termIds: ["TERM-PLAYER-POWER", "TERM-PLAYER-POWER"] }, { action: "publish" },
  ]) assert.throws(() => issueGlossaryHumanDecision({ ...decisionInput(), ...input }), /human glossary decision/i);
});

function decisionInput() { return { action: "approve", termIds: ["TERM-PLAYER-POWER"], actor: "Lead Designer", eventId: "decision-player-power", glossarySha256: sha256Canonical(glossary()), glossaryVersion: 1, changedAt }; }

test("approval transition matrix and exact retry fail closed", () => {
  const proposed = glossary();
  const approve = decision();
  const approved = applyGlossaryDecision({ glossary: proposed, ...approve });
  assert.equal(approved.terms[0].state, "approved");
  assert.deepEqual(applyGlossaryDecision({ glossary: approved, ...approve }), approved);
  assert.throws(() => applyGlossaryDecision({ glossary: { ...approved, version: 3 }, ...approve }), /glossary/i);
  assert.throws(() => applyGlossaryDecision({ glossary: approved, ...decision({ action: "approve", glossarySha256: sha256Canonical(approved), eventId: "decision-again" }) }), /glossary/i);
  assert.throws(() => applyGlossaryDecision({ glossary: proposed, ...decision({ action: "deprecate", glossarySha256: sha256Canonical(proposed), replacementTermId: "TERM-PLAYER-POWER" }) }), /glossary/i);
});

test("replacement and deprecation require a distinct approved replacement and reject cycles", () => {
  const current = glossary({ terms: [term({ termId: "TERM-COMBAT-POWER", koPreferred: "전투 파워", enPreferred: "Combat Power", state: "approved", approver: "Lead", decisionIds: ["new"] }), term({ state: "approved", approver: "Lead", decisionIds: ["old"] })] });
  const issued = issueGlossaryHumanDecision({ action: "deprecate", termIds: ["TERM-PLAYER-POWER"], replacementTermId: "TERM-COMBAT-POWER", actor: "Lead", eventId: "deprecate-power", glossarySha256: sha256Canonical(current), glossaryVersion: 1, changedAt });
  const deprecated = applyGlossaryDecision({ glossary: current, ...issued });
  assert.equal(deprecated.terms.find(({ termId }) => termId === "TERM-PLAYER-POWER").replacementTermId, "TERM-COMBAT-POWER");
  assert.throws(() => applyGlossaryDecision({ glossary: current, ...issueGlossaryHumanDecision({ ...issued.receipt, replacementTermId: "TERM-PLAYER-POWER", eventId: "bad-replacement" }) }), /glossary/i);
});

test("effective glossary merge is deterministic and rejects unapproved shared overrides and bilingual ambiguity", () => {
  const shared = approvedGlossary(); const overlay = { schemaVersion: 1, scope: "project-overlay", version: 2, terms: [term({ termId: "TERM-COMBAT-POWER", koPreferred: "전투 파워", enPreferred: "Combat Power", state: "approved", approver: "Lead", decisionIds: ["d2"] })] };
  assert.deepEqual(mergeGameDesignGlossaries({ sharedGlossary: shared, projectOverlay: overlay }), mergeGameDesignGlossaries({ sharedGlossary: shared, projectOverlay: overlay }));
  assert.throws(() => mergeGameDesignGlossaries({ sharedGlossary: shared, projectOverlay: { ...overlay, terms: [term({ state: "proposed", enPreferred: "Power" })] } }), /glossary/i);
  assert.throws(() => mergeGameDesignGlossaries({ sharedGlossary: shared, projectOverlay: { ...overlay, terms: [term({ termId: "TERM-OTHER", state: "approved", approver: "Lead", decisionIds: ["d3"] })] } }), /glossary/i);
});

test("candidate extraction is deterministic, evidence-bearing, and cannot mutate inputs", () => {
  const effective = approvedEffective(); const documents = [{ documentId: "combat-v1", text: "플레이어 파워와 신규 용어" }]; const before = canonicalJson(documents);
  const candidates = extractGlossaryCandidates({ documents, effectiveGlossary: effective });
  assert.equal(candidates.length > 0, true); assert.deepEqual(candidates, [...candidates].sort((a, b) => a.candidateId.localeCompare(b.candidateId, "en"))); assert.equal(candidates.every((candidate) => candidate.state === "proposed" && candidate.evidenceIds.length > 0), true); assert.equal(canonicalJson(documents), before);
});

test("snapshot binds exact document, glossary hash/version, sorted approved term ids", () => {
  const effective = approvedEffective(); const receipt = createGlossarySnapshot({ documentId: "combat-v1", effectiveGlossary: effective, termIds: ["TERM-PLAYER-POWER"] });
  assert.equal(validateGlossaryReceipt(receipt, { glossary: effective }).ok, true);
  for (const value of [{ ...receipt, glossarySha256: "f".repeat(64) }, { ...receipt, glossaryVersion: 99 }, { ...receipt, termIds: ["TERM-MISSING"] }]) assert.equal(validateGlossaryReceipt(value, { glossary: effective }).ok, false);
});

test("terminology finds stale receipt and never rewrites caller text", () => {
  const effective = approvedEffective(); const text = "Player Power를 전투력이라고도 부른다."; const before = Buffer.from(text, "utf8");
  const result = validateDocumentTerminology({ text, language: "ko", effectiveGlossary: effective, receipt: { ...createGlossarySnapshot({ documentId: "combat-v1", effectiveGlossary: effective, termIds: ["TERM-PLAYER-POWER"] }), glossarySha256: "f".repeat(64) } });
  assert.equal(result.revisedText, undefined); assert.equal(Buffer.compare(before, Buffer.from(text, "utf8")), 0); assert.equal(result.blocking.some(({ code }) => code === "stale-glossary-receipt"), true);
});

test("Korean and English language validators return findings-only handoffs", () => {
  const effective = approvedEffective(); const receipt = createGlossarySnapshot({ documentId: "combat-v1", effectiveGlossary: effective, termIds: ["TERM-PLAYER-POWER"] });
  const ko = validateGameDesignWritingLanguage({ text: "플레이어 파워 PP", language: "ko", locale: "ko-KR", effectiveGlossary: effective, receipt });
  assert.equal(ko.handoff, "polish-game-design-writing");
  const us = validateGameDesignWritingLanguage({ text: "# heading\nThe player customises gear. player powers are shown.", language: "en", locale: "en-US", effectiveGlossary: effective, receipt });
  assert.equal(us.handoff, "named-human-english-writing-review"); assert.equal(us.warnings.some(({ code }) => code === "orthography-variant"), true);
  assert.throws(() => validateGameDesignWritingLanguage({ text: "text", language: "en", locale: "en-AU", effectiveGlossary: effective, receipt }), /writing validation/i);
});

test("findings stay value-minimal and never leak source text or secret-like input", () => {
  const effective = approvedEffective(); const receipt = createGlossarySnapshot({ documentId: "combat-v1", effectiveGlossary: effective, termIds: ["TERM-PLAYER-POWER"] }); const secret = "SECRET-TERMINOLOGY-SENTINEL";
  const result = validateDocumentTerminology({ text: `${secret} Player Power`, language: "ko", effectiveGlossary: effective, receipt });
  assert.equal(JSON.stringify(result).includes(secret), false);
  assert.equal(JSON.stringify(result).includes("/Users/"), false);
});

test("artifact projection permits only fixed paths and leaves a failed batch untouched", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "glossary-")); t.after(() => rm(root, { recursive: true, force: true })); const effective = approvedEffective(); const receipt = createGlossarySnapshot({ documentId: "combat-v1", effectiveGlossary: effective, termIds: ["TERM-PLAYER-POWER"] });
  const output = await writeGameDesignGlossaryArtifacts({ artifactRoot: root, glossary: effective, receipt, findings: { ok: true, blocking: [], warnings: [] }, decision: { eventId: "decision-player-power", receipt: decision().receipt } });
  assert.deepEqual(output.files, [...output.files].sort()); assert.deepEqual((await readdir(join(root, "reference-intelligence", "glossary"))).sort(), ["glossary.en.md", "glossary.ko.md", "glossary-receipt.json", "terms.json", "terminology-findings.md"].sort());
  const bytes = await readFile(join(root, "reference-intelligence", "glossary", "terms.json")); assert.equal(JSON.parse(bytes).terms[0].termId, "TERM-PLAYER-POWER");
  const blocked = await mkdtemp(join(tmpdir(), "glossary-link-")); await symlink(blocked, join(root, "reference-intelligence-link")); await assert.rejects(() => writeGameDesignGlossaryArtifacts({ artifactRoot: join(root, "reference-intelligence-link"), glossary: effective, receipt, findings: { ok: true, blocking: [], warnings: [] }, decision: { eventId: "bad", receipt: decision().receipt } }), /unsafe/i); assert.deepEqual(await readdir(blocked), []); await rm(blocked, { recursive: true, force: true });
  const emptyRoot = await mkdtemp(join(tmpdir(), "glossary-oversized-")); t.after(() => rm(emptyRoot, { recursive: true, force: true })); const oversized = { ...effective, terms: [{ ...effective.terms[0], definition: "x".repeat(2 * 1024 * 1024) }] }; await assert.rejects(() => writeGameDesignGlossaryArtifacts({ artifactRoot: emptyRoot, glossary: oversized, receipt, findings: { ok: true, blocking: [], warnings: [] }, decision: { eventId: "oversized", receipt: decision().receipt } }), /glossary/i); assert.deepEqual(await readdir(emptyRoot), []);
});
