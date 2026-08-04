#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

function finding(code, message, path) {
  return { code, message, path };
}

export function validateJobEvidenceCollection(records) {
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

  records.forEach((record, recordIndex) => {
    const repeatedSignals = Array.isArray(record?.repeatedSignals) ? record.repeatedSignals : [];
    repeatedSignals.forEach((signal, signalIndex) => {
      const signalPath = `$[${recordIndex}].repeatedSignals[${signalIndex}]`;
      const sourceIds = Array.isArray(signal?.sourceIds) ? signal.sourceIds : [];
      const uniqueSignalSourceIds = new Set(sourceIds);

      if (uniqueSignalSourceIds.size !== sourceIds.length) {
        errors.push(finding("duplicate-signal-source-id", "Repeated-signal sourceIds must be unique.", `${signalPath}.sourceIds`));
      }

      for (const sourceId of uniqueSignalSourceIds) {
        if (!postingSourceIds.has(sourceId)) {
          errors.push(finding("orphan-source-id", `Repeated signal references unknown sourceId '${sourceId}'.`, `${signalPath}.sourceIds`));
        }
      }

      if (signal?.count !== uniqueSignalSourceIds.size) {
        errors.push(finding("signal-count-mismatch", `count must equal ${uniqueSignalSourceIds.size} unique sourceIds.`, `${signalPath}.count`));
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
  const [collectionPath] = process.argv.slice(2);
  if (!collectionPath) {
    console.error("Usage: node validate-job-evidence.mjs <collection.json>");
    process.exitCode = 2;
    return;
  }

  const records = JSON.parse(await readFile(collectionPath, "utf8"));
  const result = validateJobEvidenceCollection(records);
  const output = `${JSON.stringify(result, null, 2)}\n`;
  (result.valid ? process.stdout : process.stderr).write(output);
  if (!result.valid) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
