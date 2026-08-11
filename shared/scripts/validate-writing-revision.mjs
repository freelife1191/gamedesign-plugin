import { createHash } from "node:crypto";

const PROTECTED_KINDS = Object.freeze([
  "code-span",
  "stable-id",
  "numeric-token-with-unit",
  "calendar-date",
  "markdown-link-destination",
  "table-semantic-row",
  "file-path",
  "url",
  "claim-boundary",
  "gate-state",
  "uncertainty",
  "prompt-injection-data",
]);

const CONTROL_CHARACTER = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u;
const CODE_SPAN = /`([^`\n]+)`/gu;
const STABLE_ID = /\b[A-Z][A-Z0-9]+(?:-[A-Z0-9]+)+\b/gu;
const NUMERIC_TOKEN_WITH_UNIT = /(?<![\d.])\d+(?:\.\d+)?\s?(?:FPS|fps|초|분|시간|일|주|개월|년|회|명|개|원|%|px|km)(?![\p{L}\d])/gu;
const CALENDAR_DATE = /\b\d{4}-\d{2}-\d{2}\b/gu;
const MARKDOWN_LINK_DESTINATION = /\[[^\]\n]+\]\((https?:\/\/[^\s)]+)\)/gu;
const URL = /(?<!\]\()https?:\/\/[^\s)]+/gu;
const FILE_PATH = /(?<![:/\w-])(?:[A-Za-z0-9._-]+\/)+(?:[A-Za-z0-9._-]+)(?:\.[A-Za-z0-9_-]+)?/gu;
const CLAIM = /^\s*-\s*(fact|inference|recommendation):\s*(.+)$/gmu;
const GATE = /^\s*-\s*gate:\s*(pending|blocked|approved)\s*$/gmu;
const UNCERTAINTY = /^\s*-\s*uncertainty:\s*(.+)$/gmu;
const EVIDENCE = /^\s*-\s*evidence:\s*(.+)$/gmu;
const DESIGN_FIELD = /^\s*-\s*(goal|mechanism):\s*(.+)$/gmu;

function digest(value) {
  return createHash("sha256").update(value).digest("hex");
}

function collectMatches(source, expression, group = 1) {
  expression.lastIndex = 0;
  return [...source.matchAll(expression)].map((match) => match[group]);
}

function collectTableRows(source) {
  return source.split("\n")
    .filter((line) => /^\s*\|.*\|\s*$/u.test(line) && !/^\s*\|\s*:?-{3,}/u.test(line))
    .map((line) => line.trim().slice(1, -1).split("|").map((cell) => cell.trim()).join("|"));
}

function collectClaims(source) {
  return collectMatches(source, CLAIM, 0).map((line) => {
    const match = line.match(/^\s*-\s*(fact|inference|recommendation):\s*(.+)$/u);
    return { kind: match[1], body: match[2] };
  });
}

function collectLabelValues(source, expression, label) {
  return collectMatches(source, expression, 0).map((line) => {
    const match = line.match(new RegExp(`^\\s*-\\s*${label}:\\s*(.+)$`, "u"));
    return match?.[1];
  });
}

function collectPromptInjectionData(source) {
  return [...source.matchAll(/(?:이전 지시를 무시[^"”\n]*|ignore (?:all )?previous instructions[^"”\n]*)/giu)].map((match) => match[0]);
}

function collectFilePaths(source) {
  const withoutUrls = source.replace(/https?:\/\/[^\s)]+/gu, "");
  return collectMatches(withoutUrls, FILE_PATH, 0);
}

function firstDifference(before, after) {
  const length = Math.max(before.length, after.length);
  for (let index = 0; index < length; index += 1) {
    if (before[index] !== after[index]) return { before: before[index] ?? null, after: after[index] ?? null };
  }
  return undefined;
}

function changed(code, kind, before, after) {
  return { code, detail: { kind, before, after } };
}

function invalidInput(source, name) {
  if (typeof source !== "string") return { code: "invalid-input", detail: { kind: name, before: null, after: null } };
  if (CONTROL_CHARACTER.test(source)) return { code: "control-character", detail: { kind: name, before: null, after: null } };
  if (source !== source.normalize("NFC")) return { code: "non-nfc-text", detail: { kind: name, before: null, after: null } };
  if (/\.{2}(?:\/|\\)/u.test(source)) return { code: "path-traversal", detail: { kind: name, before: null, after: null } };
  return undefined;
}

function sequenceError(source, revised, { expression, kind, code, group = 1 }) {
  const difference = firstDifference(collectMatches(source, expression, group), collectMatches(revised, expression, group));
  return difference ? changed(code, kind, difference.before, difference.after) : undefined;
}

function claimCategoryError(originalClaims, revisedClaims, kind) {
  const before = originalClaims.filter((claim) => claim.kind === kind).map((claim) => claim.body);
  const after = revisedClaims.filter((claim) => claim.kind === kind).map((claim) => claim.body);
  const difference = firstDifference(before, after);
  if (!difference) return undefined;
  const suffix = difference.before === null ? "added" : difference.after === null ? "removed" : "changed";
  return changed(`${kind}-claim-${suffix}`, kind, difference.before, difference.after);
}

function designFieldError(source, revised, field) {
  const before = collectLabelValues(source, DESIGN_FIELD, field);
  const after = collectLabelValues(revised, DESIGN_FIELD, field);
  const difference = firstDifference(before, after);
  if (difference?.before === null) return changed(`new-${field}-added`, field, null, difference.after);
  if (difference) return changed(`${field}-changed`, field, difference.before, difference.after);
  return undefined;
}

/**
 * Reject revisions that alter game-design facts, evidence, decisions, or approval states.
 * The validator deliberately checks only concrete protected tokens; it is not a truth engine.
 */
export function validateWritingRevision({ original, revised }) {
  const inputError = invalidInput(original, "original") ?? invalidInput(revised, "revised");
  if (inputError) return { valid: false, errors: [inputError], receipt: { status: "rejected", protectedKinds: PROTECTED_KINDS } };

  const reject = (error) => error ? { valid: false, errors: [error], receipt: { status: "rejected", protectedKinds: PROTECTED_KINDS, originalDigest: digest(original), revisedDigest: digest(revised) } } : undefined;
  const checks = [
    () => sequenceError(original, revised, { expression: CODE_SPAN, kind: "code-span", code: "code-span-changed" }),
    () => sequenceError(original, revised, { expression: STABLE_ID, kind: "stable-id", code: "stable-id-changed", group: 0 }),
    () => sequenceError(original, revised, { expression: NUMERIC_TOKEN_WITH_UNIT, kind: "numeric-token-with-unit", code: "numeric-token-with-unit-changed", group: 0 }),
    () => sequenceError(original, revised, { expression: CALENDAR_DATE, kind: "calendar-date", code: "calendar-date-changed", group: 0 }),
    () => sequenceError(original, revised, { expression: MARKDOWN_LINK_DESTINATION, kind: "markdown-link-destination", code: "markdown-link-destination-changed" }),
    () => {
      const difference = firstDifference(collectTableRows(original), collectTableRows(revised));
      return difference ? changed("table-semantic-row-changed", "table-semantic-row", difference.before, difference.after) : undefined;
    },
    () => {
      const difference = firstDifference(collectFilePaths(original), collectFilePaths(revised));
      return difference ? changed("file-path-changed", "file-path", difference.before, difference.after) : undefined;
    },
    () => sequenceError(original, revised, { expression: URL, kind: "url", code: "url-changed", group: 0 }),
  ];
  for (const check of checks) {
    const result = reject(check());
    if (result) return result;
  }

  const originalClaims = collectClaims(original);
  const revisedClaims = collectClaims(revised);
  const claimKinds = originalClaims.map((claim) => claim.kind);
  const revisedClaimKinds = revisedClaims.map((claim) => claim.kind);
  if (originalClaims.length === revisedClaims.length && originalClaims.every((claim, index) => claim.body === revisedClaims[index].body)) {
    const claimBoundary = firstDifference(claimKinds, revisedClaimKinds);
    const result = reject(claimBoundary ? changed("claim-boundary-changed", "claim-boundary", claimBoundary.before, claimBoundary.after) : undefined);
    if (result) return result;
  }

  const gateDifference = firstDifference(collectMatches(original, GATE, 1), collectMatches(revised, GATE, 1));
  if (gateDifference) {
    const code = gateDifference.after === "approved" && gateDifference.before !== "approved" ? "approval-state-escalation" : "gate-state-changed";
    return reject(changed(code, "gate-state", gateDifference.before, gateDifference.after));
  }
  const uncertaintyDifference = firstDifference(collectMatches(original, UNCERTAINTY, 1), collectMatches(revised, UNCERTAINTY, 1));
  if (uncertaintyDifference) {
    const code = uncertaintyDifference.after === null ? "uncertainty-removed" : "uncertainty-changed";
    return reject(changed(code, "uncertainty", uncertaintyDifference.before, uncertaintyDifference.after));
  }
  const injectionDifference = firstDifference(collectPromptInjectionData(original), collectPromptInjectionData(revised));
  if (injectionDifference) return reject(changed("prompt-injection-data-changed", "prompt-injection-data", injectionDifference.before, injectionDifference.after));

  for (const kind of ["fact", "inference", "recommendation"]) {
    const result = reject(claimCategoryError(originalClaims, revisedClaims, kind));
    if (result) return result;
  }

  const evidenceDifference = firstDifference(collectMatches(original, EVIDENCE, 1), collectMatches(revised, EVIDENCE, 1));
  if (evidenceDifference) {
    const code = evidenceDifference.before === null ? "invented-evidence" : evidenceDifference.after === null ? "evidence-removed" : "evidence-changed";
    return reject(changed(code, "evidence", evidenceDifference.before, evidenceDifference.after));
  }
  for (const field of ["goal", "mechanism"]) {
    const result = reject(designFieldError(original, revised, field));
    if (result) return result;
  }

  return {
    valid: true,
    errors: [],
    receipt: {
      status: "preserved",
      protectedKinds: PROTECTED_KINDS,
      originalDigest: digest(original),
      revisedDigest: digest(revised),
    },
  };
}
