import { createHash } from "node:crypto";
import { Buffer } from "node:buffer";

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
const STABLE_ID = /\b(?:[A-Z][A-Z0-9]+(?:-[A-Z0-9]+)+|[a-z][a-z0-9]*(?:-[a-z0-9]+)+)\b/gu;
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
const CHANGE_RATE_REVIEW_THRESHOLD = 0.3;
const CHANGE_RATE_ABORT_THRESHOLD = 0.5;
const CHANGE_RATE_COMPARISON_LIMIT = 1_000_000;
const CHANGE_RATE_UTF8_BYTE_LIMIT = 131_072;
const CHANGE_RATE_CODEPOINT_LIMIT = 65_536;

function digest(value) {
  return createHash("sha256").update(value).digest("hex");
}

function sequencePositions(sequence) {
  const positions = new Map();
  for (let index = 0; index < sequence.length; index += 1) {
    const values = positions.get(sequence[index]) ?? [];
    values.push(index);
    positions.set(sequence[index], values);
  }
  return positions;
}

function changeRateComputationLimitError(comparisons) {
  const error = new RangeError("writing change-rate comparison limit exceeded");
  error.code = "writing-change-rate-computation-limit";
  error.limit = CHANGE_RATE_COMPARISON_LIMIT;
  error.comparisons = comparisons;
  return error;
}

function changeRateInputLimitError(code, kind, limit, observed) {
  const error = new RangeError(`${kind} limit exceeded`);
  error.code = code;
  error.kind = kind;
  error.limit = limit;
  error.observed = observed;
  return error;
}

function assertWritingChangeRateInputLimit(value) {
  const utf8Bytes = Buffer.byteLength(value, "utf8");
  if (utf8Bytes > CHANGE_RATE_UTF8_BYTE_LIMIT) {
    throw changeRateInputLimitError(
      "writing-change-rate-utf8-byte-limit",
      "writing-change-rate-utf8-bytes",
      CHANGE_RATE_UTF8_BYTE_LIMIT,
      utf8Bytes,
    );
  }
  let codepoints = 0;
  for (const _codepoint of value) {
    codepoints += 1;
    if (codepoints > CHANGE_RATE_CODEPOINT_LIMIT) {
      throw changeRateInputLimitError(
        "writing-change-rate-codepoint-limit",
        "writing-change-rate-codepoints",
        CHANGE_RATE_CODEPOINT_LIMIT,
        codepoints,
      );
    }
  }
}

function longestSequenceMatch(left, rightPositions, leftStart, leftEnd, rightStart, rightEnd, budget) {
  let bestLeft = leftStart;
  let bestRight = rightStart;
  let bestSize = 0;
  let previousLengths = new Map();
  for (let leftIndex = leftStart; leftIndex < leftEnd; leftIndex += 1) {
    const currentLengths = new Map();
    for (const rightIndex of rightPositions.get(left[leftIndex]) ?? []) {
      budget.comparisons += 1;
      if (budget.comparisons > CHANGE_RATE_COMPARISON_LIMIT) throw changeRateComputationLimitError(budget.comparisons);
      if (rightIndex < rightStart) continue;
      if (rightIndex >= rightEnd) break;
      const size = (previousLengths.get(rightIndex - 1) ?? 0) + 1;
      currentLengths.set(rightIndex, size);
      if (size > bestSize) {
        bestLeft = leftIndex - size + 1;
        bestRight = rightIndex - size + 1;
        bestSize = size;
      }
    }
    previousLengths = currentLengths;
  }
  return { left: bestLeft, right: bestRight, size: bestSize };
}

function sequenceMatchCount(left, right) {
  const rightPositions = sequencePositions(right);
  const pending = [[0, left.length, 0, right.length]];
  const matches = [];
  const budget = { comparisons: 0 };
  while (pending.length > 0) {
    const [leftStart, leftEnd, rightStart, rightEnd] = pending.pop();
    const match = longestSequenceMatch(left, rightPositions, leftStart, leftEnd, rightStart, rightEnd, budget);
    if (match.size === 0) continue;
    matches.push(match);
    if (leftStart < match.left && rightStart < match.right) {
      pending.push([leftStart, match.left, rightStart, match.right]);
    }
    const nextLeft = match.left + match.size;
    const nextRight = match.right + match.size;
    if (nextLeft < leftEnd && nextRight < rightEnd) pending.push([nextLeft, leftEnd, nextRight, rightEnd]);
  }
  return matches.reduce((total, match) => total + match.size, 0);
}

function calculateWritingChangeMetrics(original, revised, { onSequenceMatcherStart } = {}) {
  assertWritingChangeRateInputLimit(original);
  assertWritingChangeRateInputLimit(revised);
  if (original === revised) return { matches: 0, total: 0 };
  const left = Array.from(original);
  const right = Array.from(revised);
  const total = left.length + right.length;
  if (total === 0) return { matches: 0, total: 0 };
  if (typeof onSequenceMatcherStart === "function") onSequenceMatcherStart();
  return { matches: sequenceMatchCount(left, right), total };
}

function rawChangeRate({ matches, total }) {
  return total === 0 ? 0 : 1 - (2 * matches) / total;
}

function displayedChangeRate(rawRate) {
  return Number(rawRate.toFixed(6));
}

function exceedsReviewThreshold({ matches, total }) {
  return total !== 0 && (total - (2 * matches)) * 10 > total * 3;
}

function exceedsAbortThreshold({ matches, total }) {
  return total !== 0 && (total - (2 * matches)) * 2 > total;
}

/** Match the bundled im-not-ai character SequenceMatcher change-rate contract. */
export function calculateWritingChangeRate(original, revised, options) {
  return rawChangeRate(calculateWritingChangeMetrics(original, revised, options));
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

function collectStableIds(source) {
  const withoutUrls = source.replace(/https?:\/\/[^\s)]+/gu, "");
  const withoutPaths = withoutUrls.replace(FILE_PATH, " ");
  return collectMatches(withoutPaths, STABLE_ID, 0);
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

function validateProtectedStrings(value, label) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || item.length === 0 || item !== item.normalize("NFC"))) {
    throw new TypeError(`${label} must be an NFC string array`);
  }
  return [...new Set(value)];
}

function validateProtectedSpans(value) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((item) => item === null || Object.getPrototypeOf(item) !== Object.prototype || typeof item.id !== "string" || typeof item.text !== "string" || item.id.length === 0 || item.text.length === 0)) {
    throw new TypeError("protectedSpans must contain plain { id, text } records");
  }
  return value;
}

function occurrences(source, text) {
  const positions = [];
  for (let index = source.indexOf(text); index !== -1; index = source.indexOf(text, index + text.length)) positions.push(index);
  return positions;
}

function manifestEntries(source, protectedTerms, protectedSpans) {
  const entries = [];
  for (const term of protectedTerms) {
    for (const start of occurrences(source, term)) entries.push({ kind: "protected-term", id: term, text: term, start });
  }
  for (const span of protectedSpans) {
    for (const start of occurrences(source, span.text)) entries.push({ kind: "protected-span", id: span.id, text: span.text, start });
  }
  return entries.sort((left, right) => left.start - right.start || left.kind.localeCompare(right.kind) || left.id.localeCompare(right.id));
}

/** Build the source-bound manifest required by the writing-polish runner. */
export function createProtectedWritingManifest({ source, protectedTerms, protectedSpans } = {}) {
  const inputError = invalidInput(source, "source");
  if (inputError) throw new TypeError(`source is invalid: ${inputError.code}`);
  const terms = validateProtectedStrings(protectedTerms, "protectedTerms");
  const spans = validateProtectedSpans(protectedSpans);
  for (const span of spans) if (!source.includes(span.text)) throw new TypeError(`protected span is absent from source: ${span.id}`);
  return {
    schemaVersion: 1,
    sourceDigest: digest(source),
    protectedTerms: terms,
    protectedSpans: spans.map(({ id, text }) => ({ id, text })),
    entries: manifestEntries(source, terms, spans).map((entry) => ({ ...entry, positionDigest: digest(`${entry.start}:${entry.text}`) })),
  };
}

function validateProtectedManifest(source, revised, manifest) {
  if (manifest === undefined) return undefined;
  if (manifest === null || Object.getPrototypeOf(manifest) !== Object.prototype || manifest.schemaVersion !== 1 || typeof manifest.sourceDigest !== "string" || !Array.isArray(manifest.entries)) {
    throw new TypeError("protectedManifest must be a source-bound manifest");
  }
  if (manifest.sourceDigest !== digest(source)) return changed("protected-manifest-source-mismatch", "protected-manifest", manifest.sourceDigest, digest(source));
  const terms = validateProtectedStrings(manifest.protectedTerms, "protectedManifest.protectedTerms");
  const spans = validateProtectedSpans(manifest.protectedSpans);
  const expected = manifestEntries(source, terms, spans).map((entry) => ({ ...entry, positionDigest: digest(`${entry.start}:${entry.text}`) }));
  if (JSON.stringify(manifest.entries) !== JSON.stringify(expected)) throw new TypeError("protectedManifest entries must exactly describe the source");
  for (const entry of expected) {
    const revisedStart = revised.indexOf(entry.text, entry.start);
    if (revisedStart !== entry.start || digest(`${revisedStart}:${entry.text}`) !== entry.positionDigest) {
      return changed("protected-manifest-occurrence-changed", entry.kind, entry.text, revisedStart === -1 ? null : entry.text);
    }
  }
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
export function validateWritingRevision({ original, revised, protectedTerms, protectedSpans, protectedManifest }) {
  const inputError = invalidInput(original, "original") ?? invalidInput(revised, "revised");
  if (inputError) return { valid: false, errors: [inputError], receipt: { status: "rejected", protectedKinds: PROTECTED_KINDS } };

  const reject = (error) => error ? { valid: false, errors: [error], receipt: { status: "rejected", protectedKinds: PROTECTED_KINDS, originalDigest: digest(original), revisedDigest: digest(revised) } } : undefined;
  const manifestDifference = validateProtectedManifest(original, revised, protectedManifest);
  const manifestRejected = reject(manifestDifference);
  if (manifestRejected) return manifestRejected;
  for (const term of validateProtectedStrings(protectedTerms, "protectedTerms")) {
    if (!revised.includes(term)) return reject(changed("protected-term-changed", "protected-term", term, null));
  }
  for (const span of validateProtectedSpans(protectedSpans)) {
    if (!original.includes(span.text)) throw new TypeError(`protected span is absent from original: ${span.id}`);
    if (!revised.includes(span.text)) return reject(changed("protected-span-changed", "protected-span", span.text, null));
  }
  const checks = [
    () => sequenceError(original, revised, { expression: CODE_SPAN, kind: "code-span", code: "code-span-changed" }),
    () => {
      const difference = firstDifference(collectStableIds(original), collectStableIds(revised));
      return difference ? changed("stable-id-changed", "stable-id", difference.before, difference.after) : undefined;
    },
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

  let changeMetrics;
  try {
    changeMetrics = calculateWritingChangeMetrics(original, revised);
  } catch (error) {
    if (![
      "writing-change-rate-computation-limit",
      "writing-change-rate-utf8-byte-limit",
      "writing-change-rate-codepoint-limit",
    ].includes(error?.code)) throw error;
    return {
      valid: false,
      errors: [changed(error.code, error.kind ?? "writing-change-rate", error.limit, error.observed ?? error.comparisons)],
      receipt: {
        status: "rejected",
        protectedKinds: PROTECTED_KINDS,
        originalDigest: digest(original),
        revisedDigest: digest(revised),
        changeRateStatus: "rejected",
      },
    };
  }
  const rawRate = rawChangeRate(changeMetrics);
  const changeRate = displayedChangeRate(rawRate);
  const changeRateStatus = changeMetrics.total === 0
    ? "unchanged"
    : exceedsReviewThreshold(changeMetrics)
      ? "review-required"
      : "within-limit";
  if (exceedsAbortThreshold(changeMetrics)) {
    return {
      valid: false,
      errors: [changed("over-polish-change-rate", "writing-change-rate", CHANGE_RATE_ABORT_THRESHOLD, rawRate)],
      receipt: {
        status: "rejected",
        protectedKinds: PROTECTED_KINDS,
        originalDigest: digest(original),
        revisedDigest: digest(revised),
        changeRate,
        changeRateStatus: "rejected",
      },
    };
  }

  return {
    valid: true,
    errors: [],
    receipt: {
      status: "preserved",
      protectedKinds: PROTECTED_KINDS,
      originalDigest: digest(original),
      revisedDigest: digest(revised),
      changeRate,
      changeRateStatus,
    },
  };
}
