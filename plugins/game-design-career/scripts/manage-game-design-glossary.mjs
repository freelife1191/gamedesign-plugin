import { lstat, mkdir, readFile, rename, rm, rmdir, unlink } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { canonicalJson, sha256Canonical, validateGameDesignGlossary, validateGlossaryReceipt } from "./validate-reference-intelligence.mjs";
import { assertGlossaryHumanDecision, assertGlossaryMappingObservation, assertGlossaryOverrideDecision } from "./lib/game-design-glossary-capabilities.mjs";
import { canonicalArtifactRoot, ensureArtifactDirectories, safeWriteArtifactFile } from "./lib/safe-artifact-write.mjs";

const compare = (left, right) => Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
const id = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const termId = /^TERM-[A-Z0-9]+(?:-[A-Z0-9]+)*$/u;
const control = /[\u0000-\u0009\u000b-\u001f\u007f-\u009f\uFEFF\r]/u;
const sensitive = [/(?:sk|pk)_(?:live|test)_[A-Za-z0-9_-]+/iu, /(?:api[_-]?key|password|secret|token)\s*[=:]/iu, /(?:^|\s)\/[\w./-]+/u];
const findingCodes = new Set(["multiple-preferred-terms", "ambiguous-concept-label", "missing-bilingual-mapping", "stale-glossary-receipt", "semantic-auto-replacement", "unapproved-term", "deprecated-term", "unexplained-abbreviation", "orthography-variant", "unnecessary-english", "translation-mismatch", "mixed-english-locale", "heading-style-drift", "sentence-fragment"]);
const glossaryDirectory = "reference-intelligence/glossary";
const fixedPaths = Object.freeze([`${glossaryDirectory}/terms.json`, `${glossaryDirectory}/glossary.ko.md`, `${glossaryDirectory}/glossary.en.md`, `${glossaryDirectory}/terminology-findings.md`, `${glossaryDirectory}/glossary-receipt.json`]);
const applied = new WeakMap();
const publicationBindings = new WeakMap();

function fail() { throw new Error("Game design glossary is invalid."); }
function freeze(value) { if (value && typeof value === "object" && !Object.isFrozen(value)) { for (const child of Object.values(value)) freeze(child); Object.freeze(value); } return value; }
function copy(value) { try { return JSON.parse(canonicalJson(value)); } catch { fail(); } }
function valid(value) { return validateGameDesignGlossary(value).ok; }
function safeText(value, max = 65536) { return typeof value === "string" && value.length > 0 && Buffer.byteLength(value, "utf8") <= max && value === value.normalize("NFC") && !control.test(value) && !sensitive.some((pattern) => pattern.test(value)); }
function canonicalText(value, max = 65536) { return typeof value === "string" && value.length > 0 && Buffer.byteLength(value, "utf8") <= max && value === value.normalize("NFC") && !control.test(value); }
function persistedSafe(value, seen = new Set()) { if (value === null || typeof value === "boolean" || typeof value === "number") return true; if (typeof value === "string") return safeText(value, 2 * 1024 * 1024); if (!value || typeof value !== "object" || seen.has(value)) return false; seen.add(value); const result = Array.isArray(value) ? value.every((item) => persistedSafe(item, seen)) : Object.values(value).every((item) => persistedSafe(item, seen)); seen.delete(value); return result; }
function approved(value) { return value?.state === "approved"; }
function bindPublication(glossary, bindings) { if (bindings.size > 0) publicationBindings.set(glossary, bindings); }
function finding(code, termIdValue = undefined) { return Object.freeze(termIdValue ? { code, termId: termIdValue } : { code }); }
function sortFindings(values) { return freeze(values.sort((left, right) => compare(`${left.code}\0${left.termId ?? ""}`, `${right.code}\0${right.termId ?? ""}`))); }
function exactTermChanges(shared, overlay) { return overlay.terms.filter((item) => shared.terms.some(({ termId: existing }) => existing === item.termId) && canonicalJson(item) !== canonicalJson(shared.terms.find(({ termId: existing }) => existing === item.termId))).map(({ termId: value }) => value).sort(compare); }

export function mergeGameDesignGlossaries({ sharedGlossary, projectOverlay, overrideReceipt, overrideCapability, changeReason } = {}) {
  const inheritedBindings = publicationBindings.get(sharedGlossary);
  const shared = copy(sharedGlossary); const overlay = copy(projectOverlay);
  if (!valid(shared) || !valid(overlay) || shared.scope !== "shared" || overlay.scope !== "project-overlay") fail();
  const overrides = exactTermChanges(shared, overlay);
  if (overrides.length > 0) {
    if (!safeText(changeReason, 1024)) fail();
    try { assertGlossaryOverrideDecision(overrideReceipt, overrideCapability, { sharedGlossary: shared, projectOverlay: overlay, termIds: overrides, reason: changeReason }); } catch { fail(); }
  } else if (overrideReceipt !== undefined || overrideCapability !== undefined || changeReason !== undefined) fail();
  const byId = new Map(shared.terms.map((item) => [item.termId, item])); for (const item of overlay.terms) byId.set(item.termId, item);
  const result = { schemaVersion: 1, scope: "effective", version: Math.max(shared.version, overlay.version), terms: [...byId.values()].sort((left, right) => compare(left.termId, right.termId)) };
  if (!valid(result)) fail(); const frozen = freeze(result);
  if (inheritedBindings) {
    const byId = new Map(frozen.terms.map((item) => [item.termId, item])); const bindings = new Map();
    for (const [receipt, binding] of inheritedBindings) if (binding.termBytes.every(([termIdValue, bytes]) => canonicalJson(byId.get(termIdValue)) === bytes)) bindings.set(receipt, { glossarySha256: sha256Canonical(frozen), termBytes: binding.termBytes });
    bindPublication(frozen, bindings);
  }
  return frozen;
}

export function applyGlossaryDecision({ glossary, receipt, capability } = {}) {
  const current = copy(glossary); if (!valid(current) || !["shared", "project-overlay"].includes(current.scope)) fail();
  let decision; try { decision = assertGlossaryHumanDecision(receipt, capability); } catch { fail(); }
  const currentHash = sha256Canonical(current); if (decision.glossaryVersion !== current.version || decision.glossarySha256 !== currentHash) {
    if (applied.get(receipt) !== currentHash) fail();
    const binding = publicationBindings.get(glossary)?.get(decision); if (!binding || binding.glossarySha256 !== currentHash) fail();
    const frozen = freeze(current); bindPublication(frozen, new Map([[decision, binding]])); return frozen;
  }
  const byId = new Map(current.terms.map((item) => [item.termId, item])); if (decision.termIds.some((value) => !byId.has(value))) fail(); const replacement = decision.replacementTermId ? byId.get(decision.replacementTermId) : null;
  if (decision.action !== "approve" && (!approved(replacement) || decision.termIds.includes(replacement.termId))) fail();
  const terms = current.terms.map((item) => {
    if (!decision.termIds.includes(item.termId)) return item;
    if (decision.action === "approve") { if (item.state !== "proposed") fail(); return { ...item, state: "approved", approver: decision.actor, decisionIds: [...new Set([...item.decisionIds, decision.eventId])].sort(compare), changedAt: decision.changedAt, version: item.version + 1 }; }
    if (item.state !== "approved") fail(); return { ...item, state: "deprecated", approver: decision.actor, replacementTermId: replacement.termId, decisionIds: [...new Set([...item.decisionIds, decision.eventId])].sort(compare), changedAt: decision.changedAt, version: item.version + 1 };
  }).sort((left, right) => compare(left.termId, right.termId));
  const result = { ...current, version: current.version + 1, terms }; if (!valid(result)) fail(); const frozen = freeze(result); applied.set(receipt, sha256Canonical(frozen));
  const finalTerms = new Map(frozen.terms.map((item) => [item.termId, item])); bindPublication(frozen, new Map([[decision, { glossarySha256: sha256Canonical(frozen), termBytes: decision.termIds.map((termIdValue) => [termIdValue, canonicalJson(finalTerms.get(termIdValue))]) }]]));
  return frozen;
}

export function createGlossarySnapshot({ documentId, effectiveGlossary, termIds } = {}) {
  const glossary = copy(effectiveGlossary); if (!id.test(documentId ?? "") || !valid(glossary) || glossary.scope !== "effective" || !Array.isArray(termIds) || termIds.length === 0 || termIds.some((value, index) => !termId.test(value) || index > 0 && compare(termIds[index - 1], value) >= 0)) fail();
  const byId = new Map(glossary.terms.map((item) => [item.termId, item])); if (termIds.some((value) => !approved(byId.get(value)))) fail(); return freeze({ schemaVersion: 1, documentId, glossaryVersion: glossary.version, glossarySha256: sha256Canonical(glossary), termIds: [...termIds] });
}

export function extractGlossaryCandidates({ documents, effectiveGlossary } = {}) {
  const glossary = copy(effectiveGlossary); if (!valid(glossary) || glossary.scope !== "effective" || !Array.isArray(documents)) fail(); const known = new Set(glossary.terms.flatMap((item) => [item.koPreferred, item.enPreferred, ...item.allowedVariants])); const candidates = [];
  for (const document of documents) { if (!id.test(document?.documentId ?? "") || !canonicalText(document?.text, 2 * 1024 * 1024)) fail(); for (const value of [...new Set(document.text.match(/[A-Za-z가-힣][A-Za-z가-힣 -]{1,40}/gu) ?? [])].map((item) => item.trim()).filter((item) => item.length > 1 && !known.has(item) && safeText(item))) candidates.push({ candidateId: `candidate-${sha256Canonical({ documentId: document.documentId, value }).slice(0, 16)}`, documentId: document.documentId, term: value, state: "proposed", evidenceIds: [`document-${document.documentId}`] }); }
  return freeze(candidates.sort((left, right) => compare(left.candidateId, right.candidateId)));
}

/** Reports only stable document and term IDs; source text is never persisted in an impact artifact. */
export function analyzeGlossaryImpact({ documents, effectiveGlossary, transition } = {}) {
  const glossary = copy(effectiveGlossary); if (!valid(glossary) || glossary.scope !== "effective" || !Array.isArray(documents)) fail();
  let affected = glossary.terms.filter((item) => item.state === "deprecated" && item.replacementTermId !== null);
  if (transition !== undefined) {
    const scoped = copy(transition);
    if (!scoped || Object.keys(scoped).sort().join("\0") !== "replacementTermId\0termIds" || !termId.test(scoped.replacementTermId) || !Array.isArray(scoped.termIds) || scoped.termIds.length === 0 || scoped.termIds.some((termIdValue, index) => !termId.test(termIdValue) || index > 0 && compare(scoped.termIds[index - 1], termIdValue) >= 0)) fail();
    const selected = new Set(scoped.termIds); affected = affected.filter((item) => selected.has(item.termId) && item.replacementTermId === scoped.replacementTermId);
    if (affected.length !== scoped.termIds.length) fail();
  }
  const results = [];
  for (const document of documents) {
    if (!id.test(document?.documentId ?? "") || !canonicalText(document?.text, 2 * 1024 * 1024)) fail();
    const termIds = affected.filter((item) => termMatch(document.text, item.koPreferred, "ko") || termMatch(document.text, item.enPreferred, "en", true) || item.deprecatedTerms.some((value) => termMatch(document.text, value, "en", true)) || item.forbiddenTerms.some((value) => termMatch(document.text, value, "ko"))).map(({ termId: value }) => value).sort(compare);
    if (termIds.length > 0) results.push({ documentId: document.documentId, termIds, status: "deprecated-replacement", reason: "approved-replacement" });
  }
  return freeze(results.sort((left, right) => compare(left.documentId, right.documentId)));
}

function receiptMatches(receipt, documentId, glossary) { return id.test(documentId ?? "") && receipt?.documentId === documentId && validateGlossaryReceipt(receipt, { glossary }).ok && receipt.glossaryVersion === glossary.version && receipt.glossarySha256 === sha256Canonical(glossary); }
function escaped(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function termMatch(text, value, language, insensitive = false) { if (!value) return false; const flags = `${insensitive ? "iu" : "u"}`; return new RegExp(`(?<![\\p{L}\\p{N}])${escaped(value)}(?![\\p{L}\\p{N}])`, flags).test(text); }
function replacementAttempt(value, terms) { if (value === undefined) return false; const copyValue = copy(value); if (!copyValue || Object.keys(copyValue).sort().join("\0") !== "action\0fromTermId\0toTermId" || copyValue.action !== "replace" || !termId.test(copyValue.fromTermId) || !termId.test(copyValue.toTermId) || copyValue.fromTermId === copyValue.toTermId || !terms.has(copyValue.fromTermId) || !terms.has(copyValue.toTermId)) fail(); return true; }
function mappingObservation(observation, capability, { documentId, glossary, termIds, language }) { if (observation === undefined && capability === undefined) return null; if (observation === undefined || capability === undefined) fail(); try { return assertGlossaryMappingObservation(observation, capability, { documentId, effectiveGlossary: glossary, termIds, targetLanguage: language === "ko" ? "en" : "ko" }); } catch { fail(); } }
function hasUnnecessaryEnglish(text, glossary) { const known = new Set(glossary.terms.filter(approved).flatMap((item) => [item.enPreferred, ...item.allowedVariants]).filter((value) => /[A-Za-z]/u.test(value)).map((value) => value.toLocaleLowerCase("en-US"))); return [...text.matchAll(/\b[A-Za-z][A-Za-z'’-]*(?:[ \t]+[A-Za-z][A-Za-z'’-]*){0,5}\b/gu)].some(([value]) => !known.has(value.toLocaleLowerCase("en-US"))); }

export function validateDocumentTerminology({ text, language, documentId, effectiveGlossary, receipt, replacementAttempt: attempt, mappingObservation: observation, mappingCapability } = {}) {
  if (!canonicalText(text, 2 * 1024 * 1024) || !["ko", "en"].includes(language) || !id.test(documentId ?? "")) fail(); const glossary = copy(effectiveGlossary); if (!valid(glossary) || glossary.scope !== "effective") fail(); const blocking = []; const warnings = []; const receiptOk = receiptMatches(receipt, documentId, glossary); if (!receiptOk) blocking.push(finding("stale-glossary-receipt")); const selected = new Set(receipt?.termIds ?? []);
  const terms = new Map(glossary.terms.map((item) => [item.termId, item])); const hasReplacementAttempt = replacementAttempt(attempt, terms); const mapping = mappingObservation(observation, mappingCapability, { documentId, glossary, termIds: receipt?.termIds, language });
  const labels = new Map();
  for (const item of glossary.terms.filter(({ termId: value }) => selected.has(value))) for (const label of [language === "ko" ? item.koPreferred : item.enPreferred, ...item.allowedVariants]) if (termMatch(text, label, language, language === "en")) { const key = language === "en" ? label.toLocaleLowerCase("en-US") : label; const matches = labels.get(key) ?? new Set(); matches.add(item.termId); labels.set(key, matches); }
  for (const matches of labels.values()) if (matches.size > 1) for (const value of matches) blocking.push(finding("ambiguous-concept-label", value));
  for (const item of glossary.terms) {
    const preferred = language === "ko" ? item.koPreferred : item.enPreferred; const alternative = language === "ko" ? item.enPreferred : item.koPreferred; const usedPreferred = termMatch(text, preferred, language, language === "en"); const usedAllowed = item.allowedVariants.some((value) => termMatch(text, value, language, language === "en"));
    if ((usedPreferred || usedAllowed) && !selected.has(item.termId)) { if (item.state === "proposed") warnings.push(finding("unapproved-term", item.termId)); else blocking.push(finding("stale-glossary-receipt")); }
    if (!selected.has(item.termId)) continue;
    if (termMatch(text, item.koPreferred, language, language === "en") && termMatch(text, item.enPreferred, language, language === "en")) blocking.push(finding("multiple-preferred-terms", item.termId));
    if (item.state === "proposed" && (usedPreferred || usedAllowed)) warnings.push(finding("unapproved-term", item.termId));
    if (item.state === "deprecated" && (usedPreferred || usedAllowed)) warnings.push(finding("deprecated-term", item.termId));
    if (item.forbiddenTerms.some((value) => termMatch(text, value, language, language === "en")) || item.deprecatedTerms.some((value) => termMatch(text, value, language, language === "en"))) warnings.push(finding("deprecated-term", item.termId));
    if (language === "en" && termMatch(text, preferred, language, true) && !termMatch(text, preferred, language, false) && !usedAllowed) warnings.push(finding("orthography-variant", item.termId));
    if (language === "en" && termMatch(text, `${preferred}s`, language, true) && !termMatch(text, `${preferred}s`, language, false) && !usedAllowed) warnings.push(finding("orthography-variant", item.termId));
    if (termMatch(text, alternative, language, language === "en") && !usedPreferred) warnings.push(finding("translation-mismatch", item.termId));
    for (const abbreviation of item.abbreviations) if (termMatch(text, abbreviation, language, false) && !usedPreferred && !usedAllowed) warnings.push(finding("unexplained-abbreviation", item.termId));
  }
  if (language === "ko" && hasUnnecessaryEnglish(text, glossary)) warnings.push(finding("unnecessary-english"));
  if (mapping) blocking.push(finding("missing-bilingual-mapping", mapping.termId));
  if (hasReplacementAttempt) blocking.push(finding("semantic-auto-replacement"));
  return freeze({ ok: blocking.length === 0, blocking: sortFindings(blocking), warnings: sortFindings(warnings) });
}

function validateFindings(value) { const copyValue = copy(value); if (!copyValue || typeof copyValue.ok !== "boolean" || !Array.isArray(copyValue.blocking) || !Array.isArray(copyValue.warnings) || Object.keys(copyValue).sort().join("\0") !== "blocking\0ok\0warnings") fail(); for (const item of [...copyValue.blocking, ...copyValue.warnings]) if (!item || typeof item !== "object" || Object.keys(item).some((key) => !["code", "termId"].includes(key)) || !findingCodes.has(item.code) || item.termId !== undefined && !termId.test(item.termId)) fail(); return copyValue; }
function markdown(title, terms, key) { return `# ${title}\n\n${terms.map((item) => `- ${item[key]} (${item.termId})`).join("\n")}\n`; }
async function targetState(root, relativePath) { const target = path.join(root, relativePath); const stats = await lstat(target).catch((error) => error?.code === "ENOENT" ? null : Promise.reject(error)); if (stats && (!stats.isFile() || stats.isSymbolicLink())) fail(); return stats ? await readFile(target) : null; }
async function cleanupEmpty(root, directories) { for (const directory of [...directories].sort((a, b) => b.length - a.length)) await rmdir(path.join(root, directory)).catch(() => {}); }

/** Function-level transaction: failures roll back targets and newly created directories; crash-wide atomicity is intentionally not claimed. */
export async function writeGameDesignGlossaryArtifacts({ artifactRoot, glossary, receipt, findings, decision, documents = [], ...unknown } = {}) {
  if (Object.keys(unknown).length !== 0 || glossary?.scope !== "effective" || !receiptMatches(receipt, receipt?.documentId, glossary) || !decision || decision.eventId !== decision.receipt?.eventId) fail();
  let liveDecision; try { liveDecision = assertGlossaryHumanDecision(decision.receipt, decision.capability); } catch { fail(); }
  const value = copy(glossary); if (!valid(value) || !persistedSafe(value) || Buffer.byteLength(canonicalJson(value), "utf8") > 2 * 1024 * 1024) fail();
  const publication = publicationBindings.get(glossary)?.get(liveDecision); if (!publication || publication.glossarySha256 !== sha256Canonical(value)) fail();
  const selected = new Set(liveDecision.termIds); const termsById = new Map(value.terms.map((item) => [item.termId, item])); const replacement = liveDecision.replacementTermId === null ? null : termsById.get(liveDecision.replacementTermId);
  if (liveDecision.action === "approve" ? [...selected].some((termIdValue) => termsById.get(termIdValue)?.state !== "approved") : !replacement || replacement.state !== "approved" || [...selected].some((termIdValue) => { const item = termsById.get(termIdValue); return !item || item.state !== "deprecated" || item.replacementTermId !== replacement.termId; })) fail();
  const safeFindings = validateFindings(findings); const safeDecision = copy(liveDecision); if (!persistedSafe(safeDecision)) fail();
  const transition = liveDecision.action === "approve" ? null : { termIds: liveDecision.termIds, replacementTermId: liveDecision.replacementTermId };
  const computedImpact = transition === null ? [] : analyzeGlossaryImpact({ documents, effectiveGlossary: value, transition });
  const safeImpact = { schemaVersion: 1, glossaryVersion: value.version, glossarySha256: sha256Canonical(value), decisionEventId: liveDecision.eventId, decisionSha256: sha256Canonical(liveDecision), items: computedImpact };
  const decisionPath = `reference-intelligence/decisions/glossary-${decision.eventId}.json`; const impactPath = `${glossaryDirectory}/impact-list.json`;
  const outputs = new Map([[fixedPaths[0], `${canonicalJson(value)}\n`], [fixedPaths[1], markdown("Game Design Glossary (Korean)", value.terms, "koPreferred")], [fixedPaths[2], markdown("Game Design Glossary (English)", value.terms, "enPreferred")], [fixedPaths[3], `# Terminology findings\n\n${canonicalJson(safeFindings)}\n`], [fixedPaths[4], `${canonicalJson(receipt)}\n`], [impactPath, `${canonicalJson(safeImpact)}\n`], [decisionPath, `${canonicalJson(safeDecision)}\n`]]);
  if ([...outputs.entries()].some(([relativePath, data]) => !fixedPaths.includes(relativePath) && relativePath !== decisionPath && relativePath !== impactPath || Buffer.byteLength(data, "utf8") > 2 * 1024 * 1024)) fail(); const files = [...outputs.keys()].sort(compare);
  const root = await canonicalArtifactRoot(artifactRoot); const before = new Map(); for (const relativePath of files) before.set(relativePath, await targetState(root.path, relativePath));
  const directories = ["reference-intelligence", glossaryDirectory, "reference-intelligence/decisions"]; const created = new Set(); for (const directory of directories) if (!await lstat(path.join(root.path, directory)).catch(() => null)) created.add(directory);
  const stage = `.glossary-stage-${randomUUID()}`;
  const published = [];
  try {
    await ensureArtifactDirectories({ artifactRoot: root.path, directories: [stage, ...directories, `${stage}/reference-intelligence`, `${stage}/${glossaryDirectory}`, `${stage}/reference-intelligence/decisions`] });
    for (const [relativePath, data] of outputs) await safeWriteArtifactFile({ artifactRoot: root.path, relativePath: `${stage}/${relativePath}`, data });
    for (const relativePath of files) { await safeWriteArtifactFile({ artifactRoot: root.path, relativePath, data: await readFile(path.join(root.path, stage, relativePath)) }); published.push(relativePath); }
    await rm(path.join(root.path, stage), { recursive: true, force: true }); return freeze({ files });
  } catch (error) {
    const rollbackFailures = [];
    for (const relativePath of [...published].reverse()) {
      const prior = before.get(relativePath);
      try { if (prior === null) await unlink(path.join(root.path, relativePath)).catch((rollbackError) => rollbackError?.code === "ENOENT" ? undefined : Promise.reject(rollbackError)); else await safeWriteArtifactFile({ artifactRoot: root.path, relativePath, data: prior }); }
      catch (rollbackError) { rollbackFailures.push(new Error(`rollback.${prior === null ? "unlink" : "restore"}:${relativePath}`)); }
    }
    await rm(path.join(root.path, stage), { recursive: true, force: true }); await cleanupEmpty(root.path, created);
    if (rollbackFailures.length > 0) throw new AggregateError([error, ...rollbackFailures], "Glossary artifact publish and rollback failed.");
    throw error;
  }
}
