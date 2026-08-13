import { canonicalGlossary, canonicalJson, sha256Canonical, validateGameDesignGlossary, validateGlossaryReceipt } from "./validate-reference-intelligence.mjs";
import { assertGlossaryHumanDecision } from "./lib/game-design-glossary-capabilities.mjs";
import { ensureArtifactDirectories, safeWriteArtifactFile } from "./lib/safe-artifact-write.mjs";

const compare = (left, right) => Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
const id = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const termsPath = "reference-intelligence/glossary";
const allowedFiles = Object.freeze([`${termsPath}/terms.json`, `${termsPath}/glossary.ko.md`, `${termsPath}/glossary.en.md`, `${termsPath}/terminology-findings.md`, `${termsPath}/glossary-receipt.json`]);
const appliedDecisions = new WeakMap();
function fail() { throw new Error("Game design glossary is invalid."); }
function copy(value) { try { return JSON.parse(canonicalJson(value)); } catch { fail(); } }
function freeze(value) { if (value && typeof value === "object" && !Object.isFrozen(value)) { for (const child of Object.values(value)) freeze(child); Object.freeze(value); } return value; }
function valid(value) { return validateGameDesignGlossary(value).ok; }
function approved(term) { return term?.state === "approved"; }
function effectiveHash(value) { return sha256Canonical(value); }
function finding(code, termId = undefined) { return Object.freeze(termId ? { code, termId } : { code }); }
function contains(text, term) { return term.length > 0 && text.includes(term); }

export function mergeGameDesignGlossaries({ sharedGlossary, projectOverlay } = {}) {
  const shared = copy(sharedGlossary); const overlay = copy(projectOverlay);
  if (!valid(shared) || !valid(overlay) || shared.scope !== "shared" || overlay.scope !== "project-overlay") fail();
  const byId = new Map(shared.terms.map((item) => [item.termId, item]));
  for (const item of overlay.terms) {
    const previous = byId.get(item.termId);
    if (previous && canonicalJson(previous) !== canonicalJson(item)) {
      const changed = previous.koPreferred !== item.koPreferred || previous.enPreferred !== item.enPreferred || previous.definition !== item.definition;
      if (!changed || !approved(item) || item.decisionIds.length === 0 || item.definition === previous.definition && item.koPreferred === previous.koPreferred && item.enPreferred === previous.enPreferred) fail();
    }
    byId.set(item.termId, item);
  }
  const terms = [...byId.values()].sort((a, b) => compare(a.termId, b.termId));
  const labels = new Map();
  for (const item of terms) {
    if (item.state === "deprecated" && (!item.replacementTermId || !byId.has(item.replacementTermId) || !approved(byId.get(item.replacementTermId)))) fail();
    for (const label of [item.koPreferred, item.enPreferred]) { const prior = labels.get(`${item.scope}\0${label}`); if (prior && prior !== item.termId) fail(); labels.set(`${item.scope}\0${label}`, item.termId); }
  }
  for (const item of terms) { const visited = new Set(); let current = item; while (current?.replacementTermId) { if (visited.has(current.termId)) fail(); visited.add(current.termId); current = byId.get(current.replacementTermId); } }
  return freeze({ schemaVersion: 1, scope: "effective", version: Math.max(shared.version, overlay.version), terms });
}

export function applyGlossaryDecision({ glossary, receipt, capability } = {}) {
  const current = copy(glossary); if (!valid(current)) fail(); const decision = assertGlossaryHumanDecision(receipt, capability);
  const selected = new Set(decision.termIds); const byId = new Map(current.terms.map((item) => [item.termId, item]));
  if ([...selected].some((item) => !byId.has(item))) fail();
  if (decision.glossaryVersion !== current.version || decision.glossarySha256 !== sha256Canonical(current)) {
    if (appliedDecisions.get(receipt) === sha256Canonical(current)) return freeze(current);
    fail();
  }
  const replacement = decision.replacementTermId ? byId.get(decision.replacementTermId) : null;
  if ((decision.action === "deprecate" || decision.action === "replace") && (!replacement || !approved(replacement))) fail();
  const next = current.terms.map((item) => {
    if (!selected.has(item.termId)) return item;
    if (decision.action === "approve") { if (item.state === "approved" && item.decisionIds.includes(decision.eventId)) return item; if (item.state !== "proposed") fail(); return { ...item, state: "approved", approver: decision.actor, decisionIds: [...new Set([...item.decisionIds, decision.eventId])].sort(compare), changedAt: decision.changedAt, version: item.version + 1 }; }
    if (item.state !== "approved") fail();
    return { ...item, state: "deprecated", approver: decision.actor, replacementTermId: replacement.termId, decisionIds: [...new Set([...item.decisionIds, decision.eventId])].sort(compare), changedAt: decision.changedAt, version: item.version + 1 };
  }).sort((a, b) => compare(a.termId, b.termId));
  const result = { ...current, version: current.version + 1, terms: next };
  if (!valid(result)) fail();
  const frozen = freeze(result); appliedDecisions.set(receipt, sha256Canonical(frozen)); return frozen;
}

export function createGlossarySnapshot({ documentId, effectiveGlossary, termIds } = {}) {
  const glossary = copy(effectiveGlossary); if (!id.test(documentId ?? "") || glossary.scope !== "effective" || !valid({ ...glossary, scope: "shared" }) || !Array.isArray(termIds) || termIds.length === 0 || termIds.some((item, index) => typeof item !== "string" || index > 0 && compare(termIds[index - 1], item) >= 0)) fail();
  const byId = new Map(glossary.terms.map((item) => [item.termId, item])); if (termIds.some((item) => !approved(byId.get(item)))) fail();
  return freeze({ schemaVersion: 1, documentId, glossaryVersion: glossary.version, glossarySha256: effectiveHash(glossary), termIds: [...termIds] });
}

export function extractGlossaryCandidates({ documents, effectiveGlossary } = {}) {
  const glossary = copy(effectiveGlossary); if (!Array.isArray(documents) || glossary.scope !== "effective") fail();
  const known = new Set(glossary.terms.flatMap((item) => [item.koPreferred, item.enPreferred, ...item.allowedVariants])); const candidates = [];
  for (const document of documents) {
    if (!id.test(document?.documentId ?? "") || typeof document?.text !== "string") fail();
    for (const token of [...new Set(document.text.match(/[A-Za-z가-힣][A-Za-z가-힣 -]{1,40}/gu) ?? [])].map((item) => item.trim()).filter((item) => item.length > 1 && !known.has(item))) candidates.push({ candidateId: `candidate-${sha256Canonical({ documentId: document.documentId, token }).slice(0, 16)}`, documentId: document.documentId, term: token, state: "proposed", evidenceIds: [`document-${document.documentId}`] });
  }
  return freeze(candidates.sort((a, b) => compare(a.candidateId, b.candidateId)));
}

function receiptMatches(receipt, glossary) { return validateGlossaryReceipt(receipt, { glossary }).ok && receipt.glossaryVersion === glossary.version && receipt.glossarySha256 === sha256Canonical(glossary); }
export function validateDocumentTerminology({ text, language, effectiveGlossary, receipt } = {}) {
  if (typeof text !== "string" || !["ko", "en"].includes(language) || !effectiveGlossary || effectiveGlossary.scope !== "effective") fail(); const glossary = copy(effectiveGlossary); const blocking = []; const warnings = [];
  if (!receiptMatches(receipt, glossary)) blocking.push(finding("stale-glossary-receipt"));
  const labels = new Map();
  for (const item of glossary.terms) {
    const label = language === "ko" ? item.koPreferred : item.enPreferred; const previous = labels.get(label); if (previous && previous !== item.termId) blocking.push(finding("ambiguous-concept-label", item.termId)); labels.set(label, item.termId);
    if (!item.koPreferred || !item.enPreferred) blocking.push(finding("missing-bilingual-mapping", item.termId));
    if (contains(text, item.koPreferred) && contains(text, item.enPreferred)) blocking.push(finding("multiple-preferred-terms", item.termId));
    if (item.state === "proposed" && contains(text, label)) warnings.push(finding("unapproved-term", item.termId)); if (item.state === "deprecated" && contains(text, label)) warnings.push(finding("deprecated-term", item.termId));
    if ((language === "ko" && contains(text, item.enPreferred) && !contains(text, item.koPreferred)) || (language === "en" && contains(text, item.koPreferred) && !contains(text, item.enPreferred))) warnings.push(finding("translation-mismatch", item.termId));
    if (item.state === "deprecated" && item.replacementTermId && contains(text, label) && contains(text, glossary.terms.find(({ termId }) => termId === item.replacementTermId)?.[language === "ko" ? "koPreferred" : "enPreferred"] ?? "")) blocking.push(finding("semantic-auto-replacement", item.termId));
    if (item.forbiddenTerms.some((value) => contains(text, value))) warnings.push(finding("orthography-variant", item.termId));
    for (const abbreviation of item.abbreviations) if (contains(text, abbreviation) && !contains(text, label)) warnings.push(finding("unexplained-abbreviation", item.termId));
  }
  if (language === "ko" && /[A-Za-z]{4,}/u.test(text)) warnings.push(finding("unnecessary-english"));
  return freeze({ ok: blocking.length === 0, blocking: blocking.sort((a, b) => compare(a.code, b.code)), warnings: warnings.sort((a, b) => compare(`${a.code}${a.termId ?? ""}`, `${b.code}${b.termId ?? ""}`)) });
}

function markdown(title, terms, field) { return `# ${title}\n\n${terms.map((item) => `- ${item[field]} (${item.termId})`).join("\n")}\n`; }
export async function writeGameDesignGlossaryArtifacts({ artifactRoot, glossary, receipt, findings, decision, ...unknown } = {}) {
  if (Object.keys(unknown).length !== 0 || glossary?.scope !== "effective" || !decision || !id.test(decision.eventId ?? "") || !receiptMatches(receipt, glossary)) fail(); const value = copy(glossary); const safeFindings = copy(findings); const safeDecision = copy(decision.receipt);
  const outputs = new Map([[allowedFiles[0], `${canonicalGlossary({ ...value, scope: "shared" })}\n`], [allowedFiles[1], markdown("Game Design Glossary (Korean)", value.terms, "koPreferred")], [allowedFiles[2], markdown("Game Design Glossary (English)", value.terms, "enPreferred")], [allowedFiles[3], `# Terminology findings\n\n${canonicalJson(safeFindings)}\n`], [allowedFiles[4], `${canonicalJson(receipt)}\n`], [`reference-intelligence/decisions/glossary-${decision.eventId}.json`, `${canonicalJson(safeDecision)}\n`]]);
  if ([...outputs.values()].some((data) => Buffer.byteLength(data, "utf8") > 2 * 1024 * 1024)) fail(); const files = [...outputs.keys()].sort(compare);
  await ensureArtifactDirectories({ artifactRoot, directories: ["reference-intelligence", termsPath, "reference-intelligence/decisions"] }); for (const relativePath of files) await safeWriteArtifactFile({ artifactRoot, relativePath, data: outputs.get(relativePath) }); return freeze({ files });
}
