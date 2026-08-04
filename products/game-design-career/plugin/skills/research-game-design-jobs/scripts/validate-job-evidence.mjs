#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

function finding(code, message, path) {
  return { code, message, path };
}

const REQUIREMENT_FIELDS = new Set(["responsibilities", "requiredSkills", "preferredSkills"]);

function isIsoDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function normalizeRequirement(value) {
  return typeof value === "string"
    ? value.normalize("NFKC").toLocaleLowerCase("en-US").replace(/[^\p{L}\p{N}]+/gu, " ").trim()
    : "";
}

function exactStringSet(actual, expected) {
  return Array.isArray(actual)
    && actual.length === expected.length
    && new Set(actual).size === actual.length
    && actual.every((value) => expected.includes(value));
}

export function validateJobEvidenceCollection(records, { asOfDate } = {}) {
  if (!Array.isArray(records)) {
    return {
      valid: false,
      errors: [finding("collection-not-array", "Job evidence collection must be an array.", "$")],
    };
  }

  const errors = [];
  const sourceIdCounts = new Map();

  records.forEach((record, recordIndex) => {
    const sourceId = typeof record?.sourceId === "string" ? record.sourceId.trim() : "";
    if (!sourceId) {
      errors.push(finding("missing-source-id", "Every posting requires a non-empty sourceId.", `$[${recordIndex}].sourceId`));
      return;
    }
    sourceIdCounts.set(sourceId, (sourceIdCounts.get(sourceId) ?? 0) + 1);
  });

  for (const [sourceId, count] of sourceIdCounts) {
    if (count > 1) {
      errors.push(finding("duplicate-source-id", `Posting sourceId '${sourceId}' occurs ${count} times.`, "$"));
    }
  }

  const postingSourceIds = new Set(sourceIdCounts.keys());
  const denominator = postingSourceIds.size;
  const postingById = new Map(records.filter((record) => typeof record?.sourceId === "string")
    .map((record) => [record.sourceId.trim(), record]));
  const actualGeography = [...new Set(records.map((record) => record?.region).filter((region) => typeof region === "string" && region.length > 0))].sort();
  const hasRepeatedSignals = records.some((record) => Array.isArray(record?.repeatedSignals) && record.repeatedSignals.length > 0);
  const asOfIsValid = isIsoDate(asOfDate);
  if (hasRepeatedSignals && asOfDate === undefined) {
    errors.push(finding("missing-as-of-date", "Repeated signals require an explicit asOfDate.", "$"));
  } else if (hasRepeatedSignals && !asOfIsValid) {
    errors.push(finding("invalid-as-of-date", "asOfDate must be a real ISO calendar date.", "$"));
  }

  records.forEach((record, recordIndex) => {
    if (record?.sampleSize !== denominator) {
      errors.push(finding("sample-size-mismatch", `sampleSize must equal ${denominator} deduplicated postings.`, `$[${recordIndex}].sampleSize`));
    }
    if (!exactStringSet(record?.sampleGeography, actualGeography)) {
      errors.push(finding("sample-geography-mismatch", `sampleGeography must exactly match ${JSON.stringify(actualGeography)}.`, `$[${recordIndex}].sampleGeography`));
    }
  });

  const signalIds = new Set();

  records.forEach((record, recordIndex) => {
    const repeatedSignals = Array.isArray(record?.repeatedSignals) ? record.repeatedSignals : [];
    repeatedSignals.forEach((signal, signalIndex) => {
      const signalPath = `$[${recordIndex}].repeatedSignals[${signalIndex}]`;
      const sourceRefs = Array.isArray(signal?.sourceRefs) ? signal.sourceRefs : [];
      const refKeys = sourceRefs.map((ref) => `${ref?.sourceId}\u0000${ref?.field}\u0000${ref?.index}`);
      const uniqueRefKeys = new Set(refKeys);
      const uniqueSignalSourceIds = new Set(sourceRefs.map((ref) => ref?.sourceId));

      if (sourceRefs.length < 2) {
        errors.push(finding("signal-source-ref-minimum", "Repeated signals require at least two sourceRefs.", `${signalPath}.sourceRefs`));
      }

      if (typeof signal?.signalId !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u.test(signal.signalId)) {
        errors.push(finding("missing-signal-id", "Every repeated signal requires a stable signalId.", `${signalPath}.signalId`));
      } else if (signalIds.has(signal.signalId)) {
        errors.push(finding("duplicate-signal-id", `Repeated signalId '${signal.signalId}' must be unique.`, `${signalPath}.signalId`));
      } else {
        signalIds.add(signal.signalId);
      }
      if (uniqueRefKeys.size !== sourceRefs.length || uniqueSignalSourceIds.size !== sourceRefs.length) {
        errors.push(finding("duplicate-signal-source-ref", "Repeated-signal sourceRefs must identify distinct requirements in distinct postings.", `${signalPath}.sourceRefs`));
      }

      sourceRefs.forEach((ref, refIndex) => {
        const refPath = `${signalPath}.sourceRefs[${refIndex}]`;
        const source = postingById.get(ref?.sourceId);
        if (!source) {
          errors.push(finding("orphan-source-id", `Repeated signal references unknown sourceId '${ref?.sourceId}'.`, `${refPath}.sourceId`));
          return;
        }
        if (!REQUIREMENT_FIELDS.has(ref?.field)) {
          errors.push(finding("signal-source-field", "field must name responsibilities, requiredSkills, or preferredSkills.", `${refPath}.field`));
          return;
        }
        const requirements = source[ref.field];
        if (!Array.isArray(requirements) || !Number.isInteger(ref?.index) || ref.index < 0 || ref.index >= requirements.length) {
          errors.push(finding("signal-source-index", "index must address an existing item in the cited posting field.", `${refPath}.index`));
          return;
        }
        const statement = requirements[ref.index];
        if (ref.statement !== statement) {
          errors.push(finding("signal-statement-mismatch", "statement must byte-match the cited posting item.", `${refPath}.statement`));
        }
        const expectedRequirementId = `${ref.sourceId}:${ref.field}:${ref.index}`;
        if (ref.requirementId !== expectedRequirementId) {
          errors.push(finding("signal-requirement-id", `requirementId must equal '${expectedRequirementId}'.`, `${refPath}.requirementId`));
        }
        const normalized = normalizeRequirement(statement);
        if (ref.normalizedValue !== normalized || signal?.normalizedValue !== normalized || signal?.signal !== normalized) {
          errors.push(finding("signal-normalization-mismatch", "signal and ref normalizedValue must equal the deterministic normalization of the cited statement.", refPath));
        }
        if (source.sourceType !== "official-company-career-page") {
          errors.push(finding("signal-source-not-primary", "Repeated signals may cite only official company career postings.", `${refPath}.sourceId`));
        }
        let sourceUrl;
        try {
          sourceUrl = new URL(source.sourceUrl);
        } catch {
          sourceUrl = null;
        }
        if (!sourceUrl || sourceUrl.protocol !== "https:") {
          errors.push(finding("signal-source-url", "Repeated-signal sources require an HTTPS official career URL.", `${refPath}.sourceId`));
        }
        const datesValid = isIsoDate(source.postedDate) && isIsoDate(source.retrievalDate) && isIsoDate(source.reviewAfter);
        if (!datesValid) {
          errors.push(finding("signal-source-date", "Cited postings require real ISO postedDate, retrievalDate, and reviewAfter values.", `${refPath}.sourceId`));
        } else {
          if (source.postedDate > source.retrievalDate || source.retrievalDate > source.reviewAfter
            || (asOfIsValid && source.retrievalDate > asOfDate)) {
            errors.push(finding("signal-source-date-order", "Dates must satisfy postedDate <= retrievalDate <= asOfDate <= reviewAfter.", `${refPath}.sourceId`));
          }
          if (asOfIsValid && asOfDate > source.reviewAfter) {
            errors.push(finding("signal-source-stale", `Cited posting evidence expired after ${source.reviewAfter}.`, `${refPath}.sourceId`));
          }
        }
      });

      if (signal?.count !== uniqueSignalSourceIds.size) {
        errors.push(finding("signal-count-mismatch", `count must equal ${uniqueSignalSourceIds.size} distinct cited postings.`, `${signalPath}.count`));
      }
      if (signal?.denominator !== denominator) {
        errors.push(finding("signal-denominator-mismatch", `denominator must equal ${denominator} deduplicated postings.`, `${signalPath}.denominator`));
      }
      if (typeof signal?.count === "number" && typeof signal?.denominator === "number" && signal.count > signal.denominator) {
        errors.push(finding("signal-count-exceeds-denominator", "count must not exceed denominator.", signalPath));
      }
    });
  });

  return { valid: errors.length === 0, errors };
}

async function main() {
  const [collectionPath, ...args] = process.argv.slice(2);
  if (!collectionPath) {
    console.error("Usage: node validate-job-evidence.mjs <collection.json> [--as-of YYYY-MM-DD]");
    process.exitCode = 2;
    return;
  }

  const records = JSON.parse(await readFile(collectionPath, "utf8"));
  const asOfIndex = args.indexOf("--as-of");
  const asOfDate = asOfIndex >= 0 ? args[asOfIndex + 1] : undefined;
  const result = validateJobEvidenceCollection(records, { asOfDate });
  const output = `${JSON.stringify(result, null, 2)}\n`;
  (result.valid ? process.stdout : process.stderr).write(output);
  if (!result.valid) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
