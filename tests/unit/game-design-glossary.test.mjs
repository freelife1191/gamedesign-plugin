import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, readdir, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "node:test";

import { canonicalJson, sha256Canonical, validateGameDesignGlossary, validateGlossaryReceipt } from "../../shared/scripts/validate-reference-intelligence.mjs";
import { assertGlossaryHumanDecision, assertGlossaryOverrideDecision, issueGlossaryHumanDecision, issueGlossaryMappingObservation, issueGlossaryOverrideDecision } from "../../shared/scripts/lib/game-design-glossary-capabilities.mjs";
import { analyzeGlossaryImpact, applyGlossaryDecision, createGlossarySnapshot, extractGlossaryCandidates, mergeGameDesignGlossaries, validateDocumentTerminology, writeGameDesignGlossaryArtifacts } from "../../shared/scripts/manage-game-design-glossary.mjs";
import { validateGameDesignWritingLanguage } from "../../shared/scripts/validate-game-design-writing-language.mjs";
import { evaluateGameDesignGlossarySchema } from "../../shared/scripts/lib/game-design-glossary-schema-evaluator.mjs";

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
async function runNode(file, timeout = 12_000) {
  const child = spawn(process.execPath, [file], { stdio: ["ignore", "pipe", "pipe"] }); let stdout = ""; let stderr = ""; const limit = 8_192;
  const collect = (name) => (chunk) => { const next = `${name === "stdout" ? stdout : stderr}${chunk}`; if (next.length > limit) child.kill("SIGKILL"); if (name === "stdout") stdout = next.slice(0, limit); else stderr = next.slice(0, limit); };
  child.stdout.on("data", collect("stdout")); child.stderr.on("data", collect("stderr")); const timer = setTimeout(() => child.kill("SIGKILL"), timeout);
  const [code, signal] = await once(child, "exit"); clearTimeout(timer); return { code, signal, stdout, stderr };
}

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
  const replaced = applyGlossaryDecision({ glossary: current, ...issueGlossaryHumanDecision({ action: "replace", termIds: ["TERM-PLAYER-POWER"], replacementTermId: "TERM-COMBAT-POWER", actor: "Lead", eventId: "replace-power", glossarySha256: sha256Canonical(current), glossaryVersion: 1, changedAt }) });
  assert.equal(replaced.terms.find(({ termId }) => termId === "TERM-PLAYER-POWER").state, "deprecated");
  const missing = structuredClone(current); missing.terms[1].replacementTermId = "TERM-MISSING"; missing.terms[1].state = "deprecated"; assert.equal(validateGameDesignGlossary(missing).errors.some(({ code }) => code === "lifecycle.invalid"), true);
  const cycle = structuredClone(current); cycle.terms[0] = { ...cycle.terms[0], state: "deprecated", replacementTermId: "TERM-COMBAT-POWER" }; cycle.terms[1] = { ...cycle.terms[1], state: "deprecated", replacementTermId: "TERM-PLAYER-POWER" }; assert.equal(validateGameDesignGlossary(cycle).errors.some(({ code }) => code === "lifecycle.cycle"), true);
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

test("deprecated and replacement terms yield a value-minimal deterministic impact list", () => {
  const effective = mergeGameDesignGlossaries({
    sharedGlossary: glossary({ terms: [
      term({ termId: "TERM-COMBAT-POWER", koPreferred: "전투 파워", enPreferred: "Combat Power", state: "approved", approver: "Lead", decisionIds: ["new"] }),
      term({ state: "deprecated", approver: "Lead", decisionIds: ["old"], replacementTermId: "TERM-COMBAT-POWER" }),
    ] }),
    projectOverlay: { schemaVersion: 1, scope: "project-overlay", version: 1, terms: [] },
  });
  const impact = analyzeGlossaryImpact({
    documents: [{ documentId: "combat-v1", text: "플레이어 파워" }, { documentId: "other-v1", text: "unrelated" }],
    effectiveGlossary: effective,
  });
  assert.deepEqual(impact, [{ documentId: "combat-v1", termIds: ["TERM-PLAYER-POWER"], status: "deprecated-replacement", reason: "approved-replacement" }]);
  assert.equal(JSON.stringify(impact).includes("플레이어 파워"), false);
});

test("impact publication recomputes a receipt-bound deprecated replacement result", async (t) => {
  const current = glossary({ terms: [
    term({ termId: "TERM-COMBAT-POWER", koPreferred: "전투 파워", enPreferred: "Combat Power", state: "approved", approver: "Lead", decisionIds: ["new"] }),
    term({ state: "approved", approver: "Lead", decisionIds: ["old"] }),
  ] });
  const issued = issueGlossaryHumanDecision({ action: "deprecate", termIds: ["TERM-PLAYER-POWER"], replacementTermId: "TERM-COMBAT-POWER", actor: "Lead", eventId: "deprecate-player-power", glossarySha256: sha256Canonical(current), glossaryVersion: current.version, changedAt });
  const effective = mergeGameDesignGlossaries({ sharedGlossary: applyGlossaryDecision({ glossary: current, ...issued }), projectOverlay: { schemaVersion: 1, scope: "project-overlay", version: 1, terms: [] } });
  const receipt = createGlossarySnapshot({ documentId: "combat-v1", effectiveGlossary: effective, termIds: ["TERM-COMBAT-POWER"] });
  const root = await mkdtemp(join(tmpdir(), "glossary-impact-authority-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await assert.rejects(() => writeGameDesignGlossaryArtifacts({ artifactRoot: root, glossary: effective, receipt, findings: { ok: true, blocking: [], warnings: [] }, decision: { eventId: issued.receipt.eventId, receipt: issued.receipt, capability: issued.capability }, documents: [{ documentId: "combat-v1", text: "플레이어 파워" }], impact: [] }), /glossary/i);
  await writeGameDesignGlossaryArtifacts({ artifactRoot: root, glossary: effective, receipt, findings: { ok: true, blocking: [], warnings: [] }, decision: { eventId: issued.receipt.eventId, receipt: issued.receipt, capability: issued.capability }, documents: [{ documentId: "combat-v1", text: "플레이어 파워" }] });
  const stored = JSON.parse(await readFile(join(root, "reference-intelligence", "glossary", "impact-list.json"), "utf8"));
  assert.deepEqual(stored.items, [{ documentId: "combat-v1", termIds: ["TERM-PLAYER-POWER"], status: "deprecated-replacement", reason: "approved-replacement" }]);
  assert.equal(stored.glossarySha256, sha256Canonical(effective));
  assert.equal(stored.decisionEventId, issued.receipt.eventId);
  assert.equal(JSON.stringify(stored).includes("플레이어 파워"), false);
});

test("impact publication rejects a caller-forged post-transition glossary without writing", async (t) => {
  const current = glossary({ terms: [
    term({ termId: "TERM-COMBAT-POWER", koPreferred: "전투 파워", enPreferred: "Combat Power", state: "approved", approver: "Lead", decisionIds: ["new"] }),
    term({ state: "approved", approver: "Lead", decisionIds: ["old"] }),
  ] });
  const issued = issueGlossaryHumanDecision({ action: "deprecate", termIds: ["TERM-PLAYER-POWER"], replacementTermId: "TERM-COMBAT-POWER", actor: "Lead", eventId: "deprecate-player-power", glossarySha256: sha256Canonical(current), glossaryVersion: current.version, changedAt });
  const effective = mergeGameDesignGlossaries({ sharedGlossary: applyGlossaryDecision({ glossary: current, ...issued }), projectOverlay: { schemaVersion: 1, scope: "project-overlay", version: 1, terms: [] } });
  const forged = structuredClone(effective);
  forged.version += 1;
  const selected = forged.terms.find(({ termId }) => termId === "TERM-PLAYER-POWER");
  Object.assign(selected, { koPreferred: "조작된 플레이어 파워", definition: "Forged definition.", approver: "Forged Lead", decisionIds: ["forged-decision"], version: selected.version + 1, changedAt: "2026-08-14T00:00:00.000Z" });
  const receipt = createGlossarySnapshot({ documentId: "combat-v1", effectiveGlossary: forged, termIds: ["TERM-COMBAT-POWER"] });
  const root = await mkdtemp(join(tmpdir(), "glossary-post-transition-forgery-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, "reference-intelligence", "glossary"), { recursive: true });
  await writeFile(join(root, "reference-intelligence", "glossary", "impact-list.json"), "[]\n");
  const before = await readFile(join(root, "reference-intelligence", "glossary", "impact-list.json"), "utf8");
  await assert.rejects(() => writeGameDesignGlossaryArtifacts({ artifactRoot: root, glossary: forged, receipt, findings: { ok: true, blocking: [], warnings: [] }, decision: { eventId: issued.receipt.eventId, receipt: issued.receipt, capability: issued.capability }, documents: [{ documentId: "combat-v1", text: "조작된 플레이어 파워" }] }), /glossary/i);
  assert.equal(await readFile(join(root, "reference-intelligence", "glossary", "impact-list.json"), "utf8"), before);
  assert.equal((await readdir(join(root, "reference-intelligence", "glossary"))).length, 1);
});

test("exact decision retry rebinds only the live post-transition glossary for publication", async (t) => {
  const current = glossary({ terms: [
    term({ termId: "TERM-COMBAT-POWER", koPreferred: "전투 파워", enPreferred: "Combat Power", state: "approved", approver: "Lead", decisionIds: ["new"] }),
    term({ state: "approved", approver: "Lead", decisionIds: ["old"] }),
  ] });
  const issued = issueGlossaryHumanDecision({ action: "deprecate", termIds: ["TERM-PLAYER-POWER"], replacementTermId: "TERM-COMBAT-POWER", actor: "Lead", eventId: "deprecate-player-power", glossarySha256: sha256Canonical(current), glossaryVersion: current.version, changedAt });
  const transitioned = applyGlossaryDecision({ glossary: current, ...issued });
  const retried = applyGlossaryDecision({ glossary: transitioned, ...issued });
  assert.notStrictEqual(retried, transitioned);
  assert.deepEqual(retried, transitioned);
  for (const value of [structuredClone(transitioned), new Proxy(transitioned, {}), { ...transitioned, version: transitioned.version + 1 }]) assert.throws(() => applyGlossaryDecision({ glossary: value, ...issued }), /glossary/i);
  const effective = mergeGameDesignGlossaries({ sharedGlossary: retried, projectOverlay: { schemaVersion: 1, scope: "project-overlay", version: 1, terms: [] } });
  const receipt = createGlossarySnapshot({ documentId: "combat-v1", effectiveGlossary: effective, termIds: ["TERM-COMBAT-POWER"] });
  const root = await mkdtemp(join(tmpdir(), "glossary-exact-retry-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeGameDesignGlossaryArtifacts({ artifactRoot: root, glossary: effective, receipt, findings: { ok: true, blocking: [], warnings: [] }, decision: { eventId: issued.receipt.eventId, receipt: issued.receipt, capability: issued.capability }, documents: [{ documentId: "combat-v1", text: "플레이어 파워" }] });
  const stored = JSON.parse(await readFile(join(root, "reference-intelligence", "glossary", "impact-list.json"), "utf8"));
  assert.equal(stored.glossarySha256, sha256Canonical(effective));
  assert.deepEqual(stored.items, [{ documentId: "combat-v1", termIds: ["TERM-PLAYER-POWER"], status: "deprecated-replacement", reason: "approved-replacement" }]);
});

test("removing the exact-retry publication binding makes retry publication fail closed", async (t) => {
  const moduleRoot = await mkdtemp(join(tmpdir(), "glossary-retry-binding-mutation-"));
  const artifactRoot = await mkdtemp(join(tmpdir(), "glossary-retry-binding-artifact-"));
  t.after(() => Promise.all([rm(moduleRoot, { recursive: true, force: true }), rm(artifactRoot, { recursive: true, force: true })]));
  await Promise.all([
    cp(new URL("../../shared/scripts/", import.meta.url), join(moduleRoot, "scripts"), { recursive: true }),
    cp(new URL("../../shared/reference-intelligence/schema/", import.meta.url), join(moduleRoot, "reference-intelligence", "schema"), { recursive: true }),
  ]);
  await writeFile(join(moduleRoot, "package.json"), '{"type":"module"}\n');
  const managePath = join(moduleRoot, "scripts", "manage-game-design-glossary.mjs");
  const source = await readFile(managePath, "utf8");
  const anchor = "const frozen = freeze(current); bindPublication(frozen, new Map([[decision, binding]])); return frozen;";
  assert.equal(source.split(anchor).length - 1, 1);
  await writeFile(managePath, source.replace(anchor, "const frozen = freeze(current); return frozen;"));
  const [api, capability] = await Promise.all([
    import(`${pathToFileURL(managePath).href}?retry-binding-mutation`),
    import(pathToFileURL(join(moduleRoot, "scripts", "lib", "game-design-glossary-capabilities.mjs")).href),
  ]);
  const current = glossary({ terms: [
    term({ termId: "TERM-COMBAT-POWER", koPreferred: "전투 파워", enPreferred: "Combat Power", state: "approved", approver: "Lead", decisionIds: ["new"] }),
    term({ state: "approved", approver: "Lead", decisionIds: ["old"] }),
  ] });
  const issued = capability.issueGlossaryHumanDecision({ action: "deprecate", termIds: ["TERM-PLAYER-POWER"], replacementTermId: "TERM-COMBAT-POWER", actor: "Lead", eventId: "deprecate-player-power", glossarySha256: sha256Canonical(current), glossaryVersion: current.version, changedAt });
  const transitioned = api.applyGlossaryDecision({ glossary: current, ...issued });
  const retried = api.applyGlossaryDecision({ glossary: transitioned, ...issued });
  const effective = api.mergeGameDesignGlossaries({ sharedGlossary: retried, projectOverlay: { schemaVersion: 1, scope: "project-overlay", version: 1, terms: [] } });
  const receipt = api.createGlossarySnapshot({ documentId: "combat-v1", effectiveGlossary: effective, termIds: ["TERM-COMBAT-POWER"] });
  await assert.rejects(() => api.writeGameDesignGlossaryArtifacts({ artifactRoot, glossary: effective, receipt, findings: { ok: true, blocking: [], warnings: [] }, decision: { eventId: issued.receipt.eventId, receipt: issued.receipt, capability: issued.capability }, documents: [{ documentId: "combat-v1", text: "플레이어 파워" }] }), /glossary/i);
  assert.deepEqual(await readdir(artifactRoot), []);
});

test("impact publication excludes unrelated historical deprecated transitions", async (t) => {
  const current = glossary({ terms: [
    term({ termId: "TERM-COMBAT-POWER", koPreferred: "전투 파워", enPreferred: "Combat Power", state: "approved", approver: "Lead", decisionIds: ["new-player"] }),
    term({ termId: "TERM-HISTORICAL-NEW", koPreferred: "신규 용어", enPreferred: "Historical New", state: "approved", approver: "Lead", decisionIds: ["new-history"] }),
    term({ termId: "TERM-HISTORICAL-OLD", koPreferred: "이전 용어", enPreferred: "Historical Old", state: "deprecated", approver: "Lead", decisionIds: ["old-history"], replacementTermId: "TERM-HISTORICAL-NEW" }),
    term({ state: "approved", approver: "Lead", decisionIds: ["old-player"] }),
  ].sort((left, right) => left.termId.localeCompare(right.termId, "en")) });
  const issued = issueGlossaryHumanDecision({ action: "deprecate", termIds: ["TERM-PLAYER-POWER"], replacementTermId: "TERM-COMBAT-POWER", actor: "Lead", eventId: "deprecate-player-power", glossarySha256: sha256Canonical(current), glossaryVersion: current.version, changedAt });
  const effective = mergeGameDesignGlossaries({ sharedGlossary: applyGlossaryDecision({ glossary: current, ...issued }), projectOverlay: { schemaVersion: 1, scope: "project-overlay", version: 1, terms: [] } });
  const receipt = createGlossarySnapshot({ documentId: "combat-v1", effectiveGlossary: effective, termIds: ["TERM-COMBAT-POWER"] });
  const root = await mkdtemp(join(tmpdir(), "glossary-impact-transition-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeGameDesignGlossaryArtifacts({ artifactRoot: root, glossary: effective, receipt, findings: { ok: true, blocking: [], warnings: [] }, decision: { eventId: issued.receipt.eventId, receipt: issued.receipt, capability: issued.capability }, documents: [{ documentId: "combat-v1", text: "플레이어 파워. 이전 용어." }] });
  const stored = JSON.parse(await readFile(join(root, "reference-intelligence", "glossary", "impact-list.json"), "utf8"));
  assert.deepEqual(stored.items, [{ documentId: "combat-v1", termIds: ["TERM-PLAYER-POWER"], status: "deprecated-replacement", reason: "approved-replacement" }]);
  assert.equal(JSON.stringify(stored).includes("이전 용어"), false);
});

test("snapshot binds exact document, glossary hash/version, sorted approved term ids", () => {
  const effective = approvedEffective(); const receipt = createGlossarySnapshot({ documentId: "combat-v1", effectiveGlossary: effective, termIds: ["TERM-PLAYER-POWER"] });
  assert.equal(validateGlossaryReceipt(receipt, { glossary: effective }).ok, true);
  for (const value of [{ ...receipt, glossarySha256: "f".repeat(64) }, { ...receipt, glossaryVersion: 99 }, { ...receipt, termIds: ["TERM-MISSING"] }]) assert.equal(validateGlossaryReceipt(value, { glossary: effective }).ok, false);
});

test("terminology finds stale receipt and never rewrites caller text", () => {
  const effective = approvedEffective(); const text = "Player Power를 전투력이라고도 부른다."; const before = Buffer.from(text, "utf8");
  const result = validateDocumentTerminology({ text, language: "ko", documentId: "combat-v1", effectiveGlossary: effective, receipt: { ...createGlossarySnapshot({ documentId: "combat-v1", effectiveGlossary: effective, termIds: ["TERM-PLAYER-POWER"] }), glossarySha256: "f".repeat(64) } });
  assert.equal(result.revisedText, undefined); assert.equal(Buffer.compare(before, Buffer.from(text, "utf8")), 0); assert.equal(result.blocking.some(({ code }) => code === "stale-glossary-receipt"), true);
});

test("Korean and English language validators return findings-only handoffs", () => {
  const effective = approvedEffective(); const receipt = createGlossarySnapshot({ documentId: "combat-v1", effectiveGlossary: effective, termIds: ["TERM-PLAYER-POWER"] });
  const ko = validateGameDesignWritingLanguage({ text: "플레이어 파워 PP", language: "ko", locale: "ko-KR", documentId: "combat-v1", effectiveGlossary: effective, receipt });
  assert.equal(ko.handoff, "polish-game-design-writing");
  const us = validateGameDesignWritingLanguage({ text: "# heading\nThe player customises gear. player powers are shown.", language: "en", locale: "en-US", documentId: "combat-v1", effectiveGlossary: effective, receipt });
  assert.equal(us.handoff, "named-human-english-writing-review"); assert.equal(us.warnings.some(({ code }) => code === "orthography-variant"), true);
  assert.throws(() => validateGameDesignWritingLanguage({ text: "text", language: "en", locale: "en-AU", effectiveGlossary: effective, receipt }), /writing validation/i);
});

test("findings stay value-minimal and never leak source text or secret-like input", () => {
  const effective = approvedEffective(); const receipt = createGlossarySnapshot({ documentId: "combat-v1", effectiveGlossary: effective, termIds: ["TERM-PLAYER-POWER"] }); const secret = "SECRET-TERMINOLOGY-SENTINEL";
  const result = validateDocumentTerminology({ text: `${secret} Player Power`, language: "ko", documentId: "combat-v1", effectiveGlossary: effective, receipt });
  assert.equal(JSON.stringify(result).includes(secret), false);
  assert.equal(JSON.stringify(result).includes("/Users/"), false);
});

test("artifact projection permits only fixed paths and leaves a failed batch untouched", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "glossary-")); t.after(() => rm(root, { recursive: true, force: true })); const issued = decision(); const effective = mergeGameDesignGlossaries({ sharedGlossary: applyGlossaryDecision({ glossary: glossary(), ...issued }), projectOverlay: { schemaVersion: 1, scope: "project-overlay", version: 1, terms: [] } }); const receipt = createGlossarySnapshot({ documentId: "combat-v1", effectiveGlossary: effective, termIds: ["TERM-PLAYER-POWER"] });
  const output = await writeGameDesignGlossaryArtifacts({ artifactRoot: root, glossary: effective, receipt, findings: { ok: true, blocking: [], warnings: [] }, decision: { eventId: "decision-player-power", receipt: issued.receipt, capability: issued.capability } });
  assert.deepEqual(output.files, [...output.files].sort()); assert.deepEqual((await readdir(join(root, "reference-intelligence", "glossary"))).sort(), ["glossary.en.md", "glossary.ko.md", "glossary-receipt.json", "impact-list.json", "terms.json", "terminology-findings.md"].sort());
  const bytes = await readFile(join(root, "reference-intelligence", "glossary", "terms.json")); assert.equal(JSON.parse(bytes).terms[0].termId, "TERM-PLAYER-POWER");
  const blocked = await mkdtemp(join(tmpdir(), "glossary-link-")); await symlink(blocked, join(root, "reference-intelligence-link")); await assert.rejects(() => writeGameDesignGlossaryArtifacts({ artifactRoot: join(root, "reference-intelligence-link"), glossary: effective, receipt, findings: { ok: true, blocking: [], warnings: [] }, decision: { eventId: "decision-player-power", receipt: issued.receipt, capability: issued.capability } }), /unsafe/i); assert.deepEqual(await readdir(blocked), []); await rm(blocked, { recursive: true, force: true });
  const emptyRoot = await mkdtemp(join(tmpdir(), "glossary-oversized-")); t.after(() => rm(emptyRoot, { recursive: true, force: true })); const oversized = { ...effective, terms: [{ ...effective.terms[0], definition: "x".repeat(2 * 1024 * 1024) }] }; await assert.rejects(() => writeGameDesignGlossaryArtifacts({ artifactRoot: emptyRoot, glossary: oversized, receipt, findings: { ok: true, blocking: [], warnings: [] }, decision: { eventId: "decision-player-power", receipt: issued.receipt, capability: issued.capability } }), /glossary/i); assert.deepEqual(await readdir(emptyRoot), []);
});

test("shared semantic overrides require live hash-bound human provenance and a matching reason", () => {
  const shared = approvedGlossary();
  const overlay = { schemaVersion: 1, scope: "project-overlay", version: 2, terms: [term({ definition: "A project-specific combat strength measure.", state: "approved", approver: "Lead", decisionIds: ["override-power"] })] };
  assert.throws(() => mergeGameDesignGlossaries({ sharedGlossary: shared, projectOverlay: overlay }), /glossary/i);
  const issued = issueGlossaryOverrideDecision({ sharedGlossary: shared, projectOverlay: overlay, termIds: ["TERM-PLAYER-POWER"], reason: "Project combat terminology differs.", actor: "Lead", eventId: "override-power", changedAt });
  assert.doesNotThrow(() => assertGlossaryOverrideDecision(issued.receipt, issued.capability));
  assert.equal(mergeGameDesignGlossaries({ sharedGlossary: shared, projectOverlay: overlay, overrideReceipt: issued.receipt, overrideCapability: issued.capability, changeReason: "Project combat terminology differs." }).terms[0].definition, overlay.terms[0].definition);
  assert.throws(() => mergeGameDesignGlossaries({ sharedGlossary: shared, projectOverlay: overlay, overrideReceipt: structuredClone(issued.receipt), overrideCapability: issued.capability, changeReason: "Project combat terminology differs." }), /glossary/i);
  assert.throws(() => mergeGameDesignGlossaries({ sharedGlossary: shared, projectOverlay: overlay, overrideReceipt: issued.receipt, overrideCapability: issued.capability, changeReason: "Different reason." }), /glossary/i);
  assert.throws(() => mergeGameDesignGlossaries({ sharedGlossary: { ...shared, version: 2 }, projectOverlay: overlay, overrideReceipt: issued.receipt, overrideCapability: issued.capability, changeReason: "Project combat terminology differs." }), /glossary/i);
  assert.throws(() => mergeGameDesignGlossaries({ sharedGlossary: shared, projectOverlay: { ...overlay, terms: [{ ...overlay.terms[0], definition: "Tampered definition." }] }, overrideReceipt: issued.receipt, overrideCapability: issued.capability, changeReason: "Project combat terminology differs." }), /glossary/i);
  const extraShared = approvedGlossary({ terms: [shared.terms[0], term({ termId: "TERM-COMBAT-POWER", koPreferred: "전투 파워", enPreferred: "Combat Power", state: "approved", approver: "Lead", decisionIds: ["combat"] })] }); const extraOverlay = { ...overlay, terms: [...overlay.terms, term({ termId: "TERM-COMBAT-POWER", koPreferred: "전투 파워", enPreferred: "Combat Power", definition: "Override", state: "approved", approver: "Lead", decisionIds: ["combat"] })].sort((left, right) => left.termId.localeCompare(right.termId)) };
  assert.throws(() => mergeGameDesignGlossaries({ sharedGlossary: extraShared, projectOverlay: extraOverlay, overrideReceipt: issued.receipt, overrideCapability: issued.capability, changeReason: "Project combat terminology differs." }), /glossary/i);
});

test("lifecycle, document selection, and persisted receipt bindings fail closed", async (t) => {
  const invalid = approvedGlossary({ terms: [term({ state: "approved", approver: null })] }); assert.equal(validateGameDesignGlossary(invalid).ok, false);
  const issued = decision(); const effective = mergeGameDesignGlossaries({ sharedGlossary: applyGlossaryDecision({ glossary: glossary(), ...issued }), projectOverlay: { schemaVersion: 1, scope: "project-overlay", version: 1, terms: [] } }); const receipt = createGlossarySnapshot({ documentId: "combat-v1", effectiveGlossary: effective, termIds: ["TERM-PLAYER-POWER"] });
  assert.equal(validateDocumentTerminology({ text: "플레이어 파워", language: "ko", documentId: "other-v1", effectiveGlossary: effective, receipt }).blocking.some(({ code }) => code === "stale-glossary-receipt"), true);
  const root = await mkdtemp(join(tmpdir(), "glossary-persist-")); t.after(() => rm(root, { recursive: true, force: true })); await writeGameDesignGlossaryArtifacts({ artifactRoot: root, glossary: effective, receipt, findings: { ok: true, blocking: [], warnings: [] }, decision: { eventId: "decision-player-power", receipt: issued.receipt, capability: issued.capability } });
  assert.equal((await readdir(root)).length > 0, true);
  const [storedGlossary, storedReceipt] = await Promise.all([readFile(join(root, "reference-intelligence", "glossary", "terms.json"), "utf8").then(JSON.parse), readFile(join(root, "reference-intelligence", "glossary", "glossary-receipt.json"), "utf8").then(JSON.parse)]);
  assert.equal(validateGlossaryReceipt(storedReceipt, { glossary: storedGlossary }).ok, true);
});

test("receipt selection and locale-aware terminology boundaries avoid false positives", () => {
  const effective = mergeGameDesignGlossaries({ sharedGlossary: approvedGlossary(), projectOverlay: { schemaVersion: 1, scope: "project-overlay", version: 1, terms: [term({ termId: "TERM-POWER-CAP", koPreferred: "파워 캡", enPreferred: "Power Cap", state: "approved", approver: "Lead", decisionIds: ["cap"] })] } }); const receipt = createGlossarySnapshot({ documentId: "combat-v1", effectiveGlossary: effective, termIds: ["TERM-PLAYER-POWER"] });
  assert.equal(validateDocumentTerminology({ text: "파워 캡", language: "ko", documentId: "combat-v1", effectiveGlossary: effective, receipt }).blocking.some(({ code }) => code === "stale-glossary-receipt"), true);
  const gb = validateGameDesignWritingLanguage({ text: "# Combat Terms\n# combat terms\nThe player customizes gear\n| Fragment |", language: "en", locale: "en-GB", documentId: "combat-v1", effectiveGlossary: effective, receipt });
  assert.equal(gb.handoff, "named-human-english-writing-review"); assert.deepEqual(gb.warnings.map(({ code }) => code).sort(), ["heading-style-drift", "mixed-english-locale", "sentence-fragment"]);
  assert.equal(validateDocumentTerminology({ text: "플레이어 파워업", language: "ko", documentId: "combat-v1", effectiveGlossary: effective, receipt }).warnings.length, 0);
});

test("decision provenance rejects sensitive persisted actor and override reason values", () => {
  assert.throws(() => issueGlossaryHumanDecision({ ...decisionInput(), actor: "password=SECRET-SENTINEL" }), /human glossary decision/i);
  assert.throws(() => issueGlossaryOverrideDecision({ sharedGlossary: approvedGlossary(), projectOverlay: { schemaVersion: 1, scope: "project-overlay", version: 1, terms: [] }, termIds: ["TERM-PLAYER-POWER"], reason: "/Users/private/SECRET-SENTINEL", actor: "Lead", eventId: "override-secret", changedAt }), /human glossary decision/i);
});

test("schema extension and runtime fail closed for strict canonical effective glossary limits", async () => {
  const schema = JSON.parse(await readFile(new URL("../../shared/reference-intelligence/schema/game-design-glossary.schema.json", import.meta.url), "utf8"));
  assert.equal(evaluateGameDesignGlossarySchema(approvedEffective(), { schema }).ok, true);
  for (const mutate of [
    (value) => { value.terms[0].definition = "\uFEFFbad"; },
    (value) => { value.terms[0].definition = "bad\u0001"; },
    (value) => { value.terms[0].definition = "bad\ttext"; },
    (value) => { value.terms[0].definition = "e\u0301"; },
    (value) => { value.terms = []; },
  ]) { const value = structuredClone(approvedEffective()); mutate(value); assert.equal(evaluateGameDesignGlossarySchema(value, { schema }).ok, false); assert.equal(validateGameDesignGlossary(value).ok, false); }
  for (const badSchema of [{ ...schema, "x-game-design-glossary": undefined }, { ...schema, "x-game-design-glossary": { ...schema["x-game-design-glossary"], maxCanonicalUtf8Bytes: 1 } }, { ...schema, "$id": "tampered" }, { ...schema, "x-unknown": true }]) assert.equal(evaluateGameDesignGlossarySchema(approvedEffective(), { schema: badSchema }).ok, false);
});

test("declarative schema authority enforces every glossary boundary and fixed installed resolution", async (t) => {
  const schema = JSON.parse(await readFile(new URL("../../shared/reference-intelligence/schema/game-design-glossary.schema.json", import.meta.url), "utf8"));
  const atLimit = structuredClone(approvedEffective()); atLimit.terms[0].examples = Array.from({ length: 256 }, (_, index) => `example-${String(index).padStart(3, "0")}`);
  const aboveLimit = structuredClone(atLimit); aboveLimit.terms[0].examples.push("example-over-limit");
  assert.equal(evaluateGameDesignGlossarySchema(atLimit, { schema }).ok, true);
  assert.equal(validateGameDesignGlossary(atLimit).ok, true);
  assert.equal(evaluateGameDesignGlossarySchema(aboveLimit, { schema }).ok, false);
  assert.equal(validateGameDesignGlossary(aboveLimit).ok, false);
  const totalLimit = structuredClone(approvedEffective()); totalLimit.terms.push({ ...structuredClone(totalLimit.terms[0]), termId: "TERM-Z-POWER", koPreferred: "제트 파워", enPreferred: "Z Power", decisionIds: ["z-power"] }); totalLimit.terms.sort((left, right) => left.termId.localeCompare(right.termId)); totalLimit.terms[0].definition = ""; totalLimit.terms[1].definition = "";
  const remaining = 2 * 1024 * 1024 - Buffer.byteLength(canonicalJson(totalLimit), "utf8"); totalLimit.terms[0].definition = "x".repeat(Math.min(1024 * 1024, remaining - 1)); totalLimit.terms[1].definition = "x".repeat(remaining - totalLimit.terms[0].definition.length);
  assert.equal(Buffer.byteLength(canonicalJson(totalLimit), "utf8"), 2 * 1024 * 1024); assert.equal(evaluateGameDesignGlossarySchema(totalLimit, { schema }).ok, true); assert.equal(validateGameDesignGlossary(totalLimit).ok, true);
  totalLimit.terms[1].definition += "x"; assert.equal(evaluateGameDesignGlossarySchema(totalLimit, { schema }).ok, false); assert.equal(validateGameDesignGlossary(totalLimit).ok, false);
  const root = await mkdtemp(join(tmpdir(), "glossary-schema-layout-")); t.after(() => rm(root, { recursive: true, force: true }));
  const lib = join(root, "scripts", "lib"); const source = join(root, "reference-intelligence", "schema"); const installed = join(root, "references", "shared", "reference-intelligence", "schema");
  await mkdir(lib, { recursive: true }); await mkdir(source, { recursive: true }); await writeFile(join(root, "package.json"), '{"type":"module"}\n');
  await Promise.all([
    cp(new URL("../../shared/scripts/lib/game-design-glossary-schema-evaluator.mjs", import.meta.url), join(lib, "game-design-glossary-schema-evaluator.mjs")),
    cp(new URL("../../shared/scripts/lib/reference-intelligence-canonical.mjs", import.meta.url), join(lib, "reference-intelligence-canonical.mjs")),
    cp(new URL("../../shared/reference-intelligence/schema/game-design-glossary.schema.json", import.meta.url), join(source, "game-design-glossary.schema.json")),
  ]);
  const imported = await import(`${pathToFileURL(join(lib, "game-design-glossary-schema-evaluator.mjs")).href}?source-only`);
  assert.equal(imported.evaluateGameDesignGlossarySchema(atLimit).ok, true);
  await mkdir(installed, { recursive: true }); await cp(join(source, "game-design-glossary.schema.json"), join(installed, "game-design-glossary.schema.json"));
  const mirrored = await import(`${pathToFileURL(join(lib, "game-design-glossary-schema-evaluator.mjs")).href}?equal-mirror`);
  assert.equal(mirrored.evaluateGameDesignGlossarySchema(atLimit).ok, true);
  await rm(join(installed, "game-design-glossary.schema.json")); await symlink(join(source, "game-design-glossary.schema.json"), join(installed, "game-design-glossary.schema.json"));
  const symlinkLeaf = (await import(`${pathToFileURL(join(lib, "game-design-glossary-schema-evaluator.mjs")).href}?installed-symlink-leaf`)).evaluateGameDesignGlossarySchema(atLimit); assert.deepEqual(symlinkLeaf, { ok: false, errors: [{ code: "glossary-schema.extension" }] }); assert.equal(JSON.stringify(symlinkLeaf).includes(root), false);
  await rm(join(installed, "game-design-glossary.schema.json")); await symlink(join(root, "absent-installed-leaf"), join(installed, "game-design-glossary.schema.json"));
  const danglingLeaf = (await import(`${pathToFileURL(join(lib, "game-design-glossary-schema-evaluator.mjs")).href}?installed-dangling-leaf`)).evaluateGameDesignGlossarySchema(atLimit); assert.deepEqual(danglingLeaf, { ok: false, errors: [{ code: "glossary-schema.extension" }] }); assert.equal(JSON.stringify(danglingLeaf).includes(root), false);
  await rm(join(root, "references"), { recursive: true }); await mkdir(join(root, "references")); await symlink(join(root, "absent-installed-ancestor"), join(root, "references", "shared"));
  const danglingAncestor = (await import(`${pathToFileURL(join(lib, "game-design-glossary-schema-evaluator.mjs")).href}?installed-dangling-ancestor`)).evaluateGameDesignGlossarySchema(atLimit); assert.deepEqual(danglingAncestor, { ok: false, errors: [{ code: "glossary-schema.extension" }] }); assert.equal(JSON.stringify(danglingAncestor).includes(root), false);
  await rm(join(root, "references"), { recursive: true }); await mkdir(installed, { recursive: true }); await cp(join(source, "game-design-glossary.schema.json"), join(installed, "game-design-glossary.schema.json"));
  const sourceSchema = join(source, "game-design-glossary.schema.json"); await rm(sourceSchema); await symlink(join(root, "absent-source-leaf"), sourceSchema);
  const danglingSource = (await import(`${pathToFileURL(join(lib, "game-design-glossary-schema-evaluator.mjs")).href}?source-dangling-leaf`)).evaluateGameDesignGlossarySchema(atLimit); assert.deepEqual(danglingSource, { ok: false, errors: [{ code: "glossary-schema.extension" }] }); assert.equal(JSON.stringify(danglingSource).includes(root), false);
  await rm(sourceSchema); await cp(join(installed, "game-design-glossary.schema.json"), sourceSchema);
  await rm(join(installed, "game-design-glossary.schema.json")); await mkdir(join(installed, "game-design-glossary.schema.json"));
  assert.equal((await import(`${pathToFileURL(join(lib, "game-design-glossary-schema-evaluator.mjs")).href}?installed-directory-leaf`)).evaluateGameDesignGlossarySchema(atLimit).ok, false);
  await rm(join(installed, "game-design-glossary.schema.json"), { recursive: true });
  if (process.platform !== "win32") {
    const fifo = spawn("mkfifo", [join(installed, "game-design-glossary.schema.json")]); await once(fifo, "exit");
    assert.equal((await import(`${pathToFileURL(join(lib, "game-design-glossary-schema-evaluator.mjs")).href}?installed-fifo-leaf`)).evaluateGameDesignGlossarySchema(atLimit).ok, false);
    await rm(join(installed, "game-design-glossary.schema.json"));
  }
  await rm(join(root, "references"), { recursive: true }); const mirrorRoot = join(root, "mirror-shared"); await mkdir(join(mirrorRoot, "reference-intelligence", "schema"), { recursive: true }); await cp(join(source, "game-design-glossary.schema.json"), join(mirrorRoot, "reference-intelligence", "schema", "game-design-glossary.schema.json")); await mkdir(join(root, "references")); await symlink(mirrorRoot, join(root, "references", "shared"));
  assert.equal((await import(`${pathToFileURL(join(lib, "game-design-glossary-schema-evaluator.mjs")).href}?installed-symlink-ancestor`)).evaluateGameDesignGlossarySchema(atLimit).ok, false);
  await rm(join(root, "references"), { recursive: true }); await mkdir(installed, { recursive: true }); await cp(join(source, "game-design-glossary.schema.json"), join(installed, "game-design-glossary.schema.json"));
  await writeFile(join(installed, "game-design-glossary.schema.json"), "{}\n");
  const tampered = await import(`${pathToFileURL(join(lib, "game-design-glossary-schema-evaluator.mjs")).href}?tampered-mirror`);
  assert.equal(tampered.evaluateGameDesignGlossarySchema(atLimit).ok, false);
  const schemaPath = join(source, "game-design-glossary.schema.json"); await rm(join(installed, "game-design-glossary.schema.json")); await writeFile(schemaPath, Buffer.from([0xff, 0xfe]));
  assert.equal((await import(`${pathToFileURL(join(lib, "game-design-glossary-schema-evaluator.mjs")).href}?invalid-utf8`)).evaluateGameDesignGlossarySchema(atLimit).ok, false);
  await writeFile(schemaPath, "{not-json}\n"); assert.equal((await import(`${pathToFileURL(join(lib, "game-design-glossary-schema-evaluator.mjs")).href}?invalid-json`)).evaluateGameDesignGlossarySchema(atLimit).ok, false);
  await rm(schemaPath); assert.equal((await import(`${pathToFileURL(join(lib, "game-design-glossary-schema-evaluator.mjs")).href}?missing`)).evaluateGameDesignGlossarySchema(atLimit).ok, false);
  await symlink(join(root, "absent"), schemaPath); assert.equal((await import(`${pathToFileURL(join(lib, "game-design-glossary-schema-evaluator.mjs")).href}?symlink`)).evaluateGameDesignGlossarySchema(atLimit).ok, false);
  await rm(schemaPath); await mkdir(schemaPath); assert.equal((await import(`${pathToFileURL(join(lib, "game-design-glossary-schema-evaluator.mjs")).href}?special`)).evaluateGameDesignGlossarySchema(atLimit).ok, false);
});

test("mid-publish filesystem failure rolls every artifact byte and path back", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "glossary-rollback-root-")); const moduleRoot = await mkdtemp(join(tmpdir(), "glossary-rollback-module-"));
  t.after(() => Promise.all([rm(root, { recursive: true, force: true }), rm(moduleRoot, { recursive: true, force: true })]));
  const current = glossary(); const initial = decision(); const effective = mergeGameDesignGlossaries({ sharedGlossary: applyGlossaryDecision({ glossary: current, ...initial }), projectOverlay: { schemaVersion: 1, scope: "project-overlay", version: 1, terms: [] } }); const receipt = createGlossarySnapshot({ documentId: "combat-v1", effectiveGlossary: effective, termIds: ["TERM-PLAYER-POWER"] });
  await writeGameDesignGlossaryArtifacts({ artifactRoot: root, glossary: effective, receipt, findings: { ok: true, blocking: [], warnings: [] }, decision: { eventId: initial.receipt.eventId, receipt: initial.receipt, capability: initial.capability } });
  const tree = async (directory, prefix = "") => {
    const entries = await readdir(directory, { withFileTypes: true }); const result = {};
    for (const entry of entries) { const relative = prefix ? `${prefix}/${entry.name}` : entry.name; if (entry.isDirectory()) Object.assign(result, await tree(join(directory, entry.name), relative)); else result[relative] = (await readFile(join(directory, entry.name))).toString("base64"); }
    return result;
  };
  const before = await tree(root);
  await cp(new URL("../../shared/scripts/", import.meta.url), join(moduleRoot, "scripts"), { recursive: true }); await mkdir(join(moduleRoot, "reference-intelligence"), { recursive: true }); await cp(new URL("../../shared/reference-intelligence/schema/", import.meta.url), join(moduleRoot, "reference-intelligence", "schema"), { recursive: true }); await writeFile(join(moduleRoot, "package.json"), '{"type":"module"}\n');
  const managePath = join(moduleRoot, "scripts", "manage-game-design-glossary.mjs"); const source = await readFile(managePath, "utf8"); const anchor = 'import { canonicalArtifactRoot, ensureArtifactDirectories, safeWriteArtifactFile } from "./lib/safe-artifact-write.mjs";'; const replacement = 'import { canonicalArtifactRoot, ensureArtifactDirectories, safeWriteArtifactFile } from "./lib/safe-artifact-write-test-wrapper.mjs";';
  const transform = (value) => { const occurrences = value.split(anchor).length - 1; if (occurrences !== 1) throw new Error("rollback source anchor unavailable"); return value.replace(anchor, replacement); };
  assert.throws(() => transform(source.replace(anchor, "")), /anchor unavailable/); assert.throws(() => transform(`${source}\n${anchor}`), /anchor unavailable/); await writeFile(managePath, transform(source));
  const finalPaths = ["reference-intelligence/glossary/terms.json", "reference-intelligence/glossary/glossary.ko.md", "reference-intelligence/glossary/glossary.en.md", "reference-intelligence/glossary/terminology-findings.md", "reference-intelligence/glossary/glossary-receipt.json", "reference-intelligence/decisions/glossary-decision-player-power.json"];
  const canonicalRoot = await realpath(root); await writeFile(join(moduleRoot, "scripts", "lib", "safe-artifact-write-test-wrapper.mjs"), `import * as base from "./safe-artifact-write.mjs";\nexport const canonicalArtifactRoot = base.canonicalArtifactRoot;\nexport const ensureArtifactDirectories = base.ensureArtifactDirectories;\nconst artifactRoot = ${JSON.stringify(canonicalRoot)}; const finalPaths = new Set(${JSON.stringify(finalPaths)}); let finalPublishes = 0;\nexport async function safeWriteArtifactFile(value) { if (value?.artifactRoot === artifactRoot && finalPaths.has(value?.relativePath) && ++finalPublishes === 2) throw new Error("final publish failure"); return base.safeWriteArtifactFile(value); }\n`);
  const payload = { artifactRoot: root, glossary: current, decisionInput: decisionInput() }; await writeFile(join(moduleRoot, "payload.json"), `${JSON.stringify(payload)}\n`);
  await writeFile(join(moduleRoot, "rollback-driver.mjs"), 'import { readFile } from "node:fs/promises";\nimport { issueGlossaryHumanDecision } from "./scripts/lib/game-design-glossary-capabilities.mjs";\nimport { applyGlossaryDecision, createGlossarySnapshot, mergeGameDesignGlossaries, writeGameDesignGlossaryArtifacts } from "./scripts/manage-game-design-glossary.mjs";\nconst payload = JSON.parse(await readFile(new URL("./payload.json", import.meta.url), "utf8")); const issued = issueGlossaryHumanDecision(payload.decisionInput); const glossary = mergeGameDesignGlossaries({ sharedGlossary: applyGlossaryDecision({ glossary: payload.glossary, ...issued }), projectOverlay: { schemaVersion: 1, scope: "project-overlay", version: 1, terms: [] } }); const receipt = createGlossarySnapshot({ documentId: "combat-v1", effectiveGlossary: glossary, termIds: ["TERM-PLAYER-POWER"] });\ntry { await writeGameDesignGlossaryArtifacts({ artifactRoot: payload.artifactRoot, glossary, receipt, findings: { ok: true, blocking: [], warnings: [] }, decision: { eventId: issued.receipt.eventId, receipt: issued.receipt, capability: issued.capability } }); process.exitCode = 1; } catch (error) { if (error?.message !== "final publish failure") { console.error("unexpected rollback failure"); process.exitCode = 2; } }\n');
  const processResult = await runNode(join(moduleRoot, "rollback-driver.mjs")); assert.equal(processResult.code, 0, `${processResult.stdout}\n${processResult.stderr}`); assert.equal(processResult.signal, null);
  assert.deepEqual(await tree(root), before);
  assert.equal((await readdir(root)).some((entry) => entry.startsWith(".glossary-stage-")), false);
  await writeFile(join(moduleRoot, "scripts", "lib", "safe-artifact-write-test-wrapper.mjs"), `import * as base from "./safe-artifact-write.mjs";\nexport const canonicalArtifactRoot = base.canonicalArtifactRoot;\nexport const ensureArtifactDirectories = base.ensureArtifactDirectories;\nconst artifactRoot = ${JSON.stringify(canonicalRoot)}; const finalPaths = new Set(${JSON.stringify(finalPaths)}); let finalPublishes = 0; let publishFailed = false;\nexport async function safeWriteArtifactFile(value) { if (value?.artifactRoot === artifactRoot && finalPaths.has(value?.relativePath)) { finalPublishes += 1; if (!publishFailed && finalPublishes === 2) { publishFailed = true; throw new Error("final publish failure"); } if (publishFailed && value?.relativePath === "reference-intelligence/decisions/glossary-decision-player-power.json") throw new Error("restore failure"); } return base.safeWriteArtifactFile(value); }\n`);
  await writeFile(join(moduleRoot, "rollback-driver.mjs"), 'import { readFile } from "node:fs/promises";\nimport { issueGlossaryHumanDecision } from "./scripts/lib/game-design-glossary-capabilities.mjs";\nimport { applyGlossaryDecision, createGlossarySnapshot, mergeGameDesignGlossaries, writeGameDesignGlossaryArtifacts } from "./scripts/manage-game-design-glossary.mjs";\nconst payload = JSON.parse(await readFile(new URL("./payload.json", import.meta.url), "utf8")); const issued = issueGlossaryHumanDecision(payload.decisionInput); const glossary = mergeGameDesignGlossaries({ sharedGlossary: applyGlossaryDecision({ glossary: payload.glossary, ...issued }), projectOverlay: { schemaVersion: 1, scope: "project-overlay", version: 1, terms: [] } }); const receipt = createGlossarySnapshot({ documentId: "combat-v1", effectiveGlossary: glossary, termIds: ["TERM-PLAYER-POWER"] });\ntry { await writeGameDesignGlossaryArtifacts({ artifactRoot: payload.artifactRoot, glossary, receipt, findings: { ok: true, blocking: [], warnings: [] }, decision: { eventId: issued.receipt.eventId, receipt: issued.receipt, capability: issued.capability } }); process.exitCode = 1; } catch (error) { if (!(error instanceof AggregateError) || error.errors?.[0]?.message !== "final publish failure" || !error.errors?.slice(1).every((item) => /^rollback\\.(?:restore|unlink):reference-intelligence\\//u.test(item.message))) { console.error("unexpected aggregate rollback failure"); process.exitCode = 2; } else process.stdout.write(JSON.stringify({ name: error.name, message: error.message, errors: error.errors.map((item) => item.message) })); }\n');
  const aggregate = await runNode(join(moduleRoot, "rollback-driver.mjs")); assert.equal(aggregate.code, 0, `${aggregate.stdout}\n${aggregate.stderr}`); const diagnostics = JSON.parse(aggregate.stdout); assert.equal(diagnostics.name, "AggregateError"); assert.equal(diagnostics.message, "Glossary artifact publish and rollback failed."); assert.equal(diagnostics.errors.some((value) => value.includes(canonicalRoot)), false);
  const afterHostile = await tree(root); for (const [relativePath, bytes] of Object.entries(before)) if (relativePath !== "reference-intelligence/decisions/glossary-decision-player-power.json") assert.equal(afterHostile[relativePath], bytes);
});

test("terminology restores preferred-pair and dedicated English writing diagnostics", () => {
  const effective = approvedEffective(); const receipt = createGlossarySnapshot({ documentId: "combat-v1", effectiveGlossary: effective, termIds: ["TERM-PLAYER-POWER"] });
  const pair = validateDocumentTerminology({ text: "플레이어 파워(Player Power)", language: "ko", documentId: "combat-v1", effectiveGlossary: effective, receipt });
  assert.equal(pair.blocking.some(({ code }) => code === "multiple-preferred-terms"), true);
  const goodPlural = validateDocumentTerminology({ text: "Player Powers", language: "en", documentId: "combat-v1", effectiveGlossary: effective, receipt });
  assert.equal(goodPlural.warnings.some(({ code }) => code === "orthography-variant"), false);
  const writing = validateGameDesignWritingLanguage({ text: "# Combat Terms\n# combat terms\nThe armour is blue\nFragment", language: "en", locale: "en-US", documentId: "combat-v1", effectiveGlossary: effective, receipt });
  assert.deepEqual([...new Set(writing.warnings.map(({ code }) => code))].sort(), ["heading-style-drift", "mixed-english-locale", "sentence-fragment"]);
  const addition = term({ termId: "TERM-COMBAT-POWER", koPreferred: "전투 파워", enPreferred: "Combat Power", state: "approved", approver: "Lead", decisionIds: ["combat"] }); const expanded = mergeGameDesignGlossaries({ sharedGlossary: approvedGlossary(), projectOverlay: { schemaVersion: 1, scope: "project-overlay", version: 1, terms: [addition] } }); const expandedReceipt = createGlossarySnapshot({ documentId: "combat-v1", effectiveGlossary: expanded, termIds: ["TERM-COMBAT-POWER", "TERM-PLAYER-POWER"] });
  assert.equal(validateDocumentTerminology({ text: "플레이어 파워와 전투 파워", language: "ko", documentId: "combat-v1", effectiveGlossary: expanded, receipt: expandedReceipt }).blocking.some(({ code }) => code === "semantic-auto-replacement"), false);
  assert.equal(validateDocumentTerminology({ text: "플레이어 파워", language: "ko", documentId: "combat-v1", effectiveGlossary: expanded, receipt: expandedReceipt, replacementAttempt: { action: "replace", fromTermId: "TERM-PLAYER-POWER", toTermId: "TERM-COMBAT-POWER" } }).blocking.some(({ code }) => code === "semantic-auto-replacement"), true);
});

test("terminology diagnostic matrix emits each literal code without co-occurrence inference", () => {
  const effective = structuredClone(approvedEffective()); effective.terms[0].abbreviations = ["PP"]; effective.terms[0].deprecatedTerms = ["Old Power"];
  const receipt = createGlossarySnapshot({ documentId: "combat-v1", effectiveGlossary: effective, termIds: ["TERM-PLAYER-POWER"] });
  const warningCodes = (text, language) => validateDocumentTerminology({ text, language, documentId: "combat-v1", effectiveGlossary: effective, receipt }).warnings.map(({ code }) => code);
  assert.deepEqual(warningCodes("PP", "en"), ["unexplained-abbreviation"]);
  assert.deepEqual(warningCodes("전투력", "ko"), ["deprecated-term"]);
  assert.deepEqual(warningCodes("Old Power", "en"), ["deprecated-term"]);
  assert.deepEqual(warningCodes("Player Power", "ko"), ["translation-mismatch"]);
  assert.deepEqual(warningCodes("player power", "en"), ["orthography-variant"]);
  assert.deepEqual(warningCodes("player powers", "en"), ["orthography-variant"]);
  const pair = validateDocumentTerminology({ text: "플레이어 파워 Player Power", language: "ko", documentId: "combat-v1", effectiveGlossary: effective, receipt });
  assert.deepEqual(pair.blocking.map(({ code }) => code), ["multiple-preferred-terms"]);
  const overlap = term({ termId: "TERM-COMBAT-POWER", koPreferred: "전투 파워", enPreferred: "Combat Power", allowedVariants: ["Player Power"], state: "approved", approver: "Lead", decisionIds: ["combat"] }); const expanded = mergeGameDesignGlossaries({ sharedGlossary: approvedGlossary(), projectOverlay: { schemaVersion: 1, scope: "project-overlay", version: 1, terms: [overlap] } }); const expandedReceipt = createGlossarySnapshot({ documentId: "combat-v1", effectiveGlossary: expanded, termIds: ["TERM-COMBAT-POWER", "TERM-PLAYER-POWER"] });
  assert.deepEqual(validateDocumentTerminology({ text: "Player Power", language: "en", documentId: "combat-v1", effectiveGlossary: expanded, receipt: expandedReceipt }).blocking.map(({ code }) => code), ["ambiguous-concept-label", "ambiguous-concept-label"]);
  assert.deepEqual(validateDocumentTerminology({ text: "플레이어 파워와 전투 파워", language: "ko", documentId: "combat-v1", effectiveGlossary: expanded, receipt: expandedReceipt }).blocking, []);
  assert.deepEqual(validateDocumentTerminology({ text: "플레이어 파워", language: "ko", documentId: "combat-v1", effectiveGlossary: expanded, receipt: expandedReceipt, replacementAttempt: { action: "replace", fromTermId: "TERM-PLAYER-POWER", toTermId: "TERM-COMBAT-POWER" } }).blocking.map(({ code }) => code), ["semantic-auto-replacement"]);
  const writing = validateGameDesignWritingLanguage({ text: "# Combat Terms\n# combat terms\nThe armour is blue\nFragment", language: "en", locale: "en-US", documentId: "combat-v1", effectiveGlossary: effective, receipt });
  assert.deepEqual(writing.warnings.map(({ code }) => code).sort(), ["heading-style-drift", "mixed-english-locale", "sentence-fragment"]);
});

test("terminology accepts only live issued mapping observation provenance", () => {
  const proposed = term({ termId: "TERM-EXPERIMENTAL-POWER", koPreferred: "실험 파워", enPreferred: "Experimental Power" });
  const effective = structuredClone(approvedEffective()); effective.terms.push(proposed); effective.terms.sort((left, right) => left.termId.localeCompare(right.termId));
  const receipt = createGlossarySnapshot({ documentId: "combat-v1", effectiveGlossary: effective, termIds: ["TERM-PLAYER-POWER"] });
  const unapproved = validateDocumentTerminology({ text: "실험 파워", language: "ko", documentId: "combat-v1", effectiveGlossary: effective, receipt });
  assert.deepEqual(unapproved.blocking, []); assert.deepEqual(unapproved.warnings, [{ code: "unapproved-term", termId: "TERM-EXPERIMENTAL-POWER" }]);
  const unnecessary = validateDocumentTerminology({ text: "플레이어 파워와 roguelike", language: "ko", documentId: "combat-v1", effectiveGlossary: effective, receipt });
  assert.deepEqual(unnecessary.warnings, [{ code: "unnecessary-english" }]); assert.equal(JSON.stringify(unnecessary).includes("roguelike"), false); assert.equal(Object.hasOwn(unnecessary, "revisedText"), false);
  const issued = issueGlossaryMappingObservation({ documentId: "combat-v1", glossarySha256: sha256Canonical(effective), termIds: ["TERM-PLAYER-POWER"], termId: "TERM-PLAYER-POWER", targetLanguage: "en", status: "missing" });
  const missing = validateDocumentTerminology({ text: "플레이어 파워", language: "ko", documentId: "combat-v1", effectiveGlossary: effective, receipt, mappingObservation: issued.observation, mappingCapability: issued.capability });
  assert.deepEqual(missing.blocking, [{ code: "missing-bilingual-mapping", termId: "TERM-PLAYER-POWER" }]);
  for (const [observation, capability] of [[structuredClone(issued.observation), issued.capability], [Object.freeze(structuredClone(issued.observation)), issued.capability], [issued.observation, structuredClone(issued.capability)], [new Proxy(issued.observation, {}), issued.capability], [{ ...issued.observation, targetLanguage: "ko" }, issued.capability]]) assert.throws(() => validateDocumentTerminology({ text: "플레이어 파워", language: "ko", documentId: "combat-v1", effectiveGlossary: effective, receipt, mappingObservation: observation, mappingCapability: capability }), /glossary/i);
  const differentDocument = createGlossarySnapshot({ documentId: "other-v1", effectiveGlossary: effective, termIds: ["TERM-PLAYER-POWER"] });
  assert.throws(() => validateDocumentTerminology({ text: "플레이어 파워", language: "ko", documentId: "other-v1", effectiveGlossary: effective, receipt: differentDocument, mappingObservation: issued.observation, mappingCapability: issued.capability }), /glossary/i);
  const differentGlossary = structuredClone(effective); differentGlossary.version = 2;
  const changedReceipt = createGlossarySnapshot({ documentId: "combat-v1", effectiveGlossary: differentGlossary, termIds: ["TERM-PLAYER-POWER"] });
  assert.throws(() => validateDocumentTerminology({ text: "플레이어 파워", language: "ko", documentId: "combat-v1", effectiveGlossary: differentGlossary, receipt: changedReceipt, mappingObservation: issued.observation, mappingCapability: issued.capability }), /glossary/i);
  const unselectedReceipt = createGlossarySnapshot({ documentId: "combat-v1", effectiveGlossary: effective, termIds: ["TERM-PLAYER-POWER"] });
  const unselected = issueGlossaryMappingObservation({ documentId: "combat-v1", glossarySha256: sha256Canonical(effective), termIds: ["TERM-EXPERIMENTAL-POWER"], termId: "TERM-EXPERIMENTAL-POWER", targetLanguage: "en", status: "missing" });
  assert.throws(() => validateDocumentTerminology({ text: "플레이어 파워", language: "ko", documentId: "combat-v1", effectiveGlossary: effective, receipt: unselectedReceipt, mappingObservation: unselected.observation, mappingCapability: unselected.capability }), /glossary/i);
  assert.throws(() => issueGlossaryMappingObservation({ documentId: "combat-v1", glossarySha256: sha256Canonical(effective), termIds: ["TERM-PLAYER-POWER"], termId: "TERM-PLAYER-POWER", targetLanguage: "en", status: "missing", unknown: true }), /glossary/i);
  assert.throws(() => validateDocumentTerminology({ text: "Player Power", language: "en", documentId: "combat-v1", effectiveGlossary: effective, receipt, mappingObservation: issued.observation, mappingCapability: issued.capability }), /glossary/i);
  assert.deepEqual(validateDocumentTerminology({ text: "플레이어 파워", language: "ko", documentId: "combat-v1", effectiveGlossary: effective, receipt }).blocking, []);
});
