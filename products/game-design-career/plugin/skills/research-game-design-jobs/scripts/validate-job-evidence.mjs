#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { readFileSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { types as utilTypes } from "node:util";

function finding(code, message, path) {
  return { code, message, path };
}

const REQUIREMENT_FIELDS = new Set(["responsibilities", "requiredSkills", "preferredSkills"]);
const FORBIDDEN_KEYS = new Set(["__proto__", "prototype", "constructor"]);
const jobEvidenceSchema = JSON.parse(readFileSync(
  new URL("../../../references/job-evidence-schema.json", import.meta.url),
  "utf8",
));
const collectionSchema = { type: "array", items: jobEvidenceSchema };
const optionsSchema = {
  type: "object",
  properties: { asOfDate: { type: "string", format: "date" } },
  additionalProperties: false,
};
const MAX_BOUNDARY_DEPTH = 32;
const MAX_BOUNDARY_NODES = 100_000;
const MAX_REGULAR_FINDINGS = 64;
const findingStates = new WeakMap();

function createFindingList() {
  const errors = [];
  findingStates.set(errors, { complexity: false, regular: 0, truncated: false });
  return errors;
}

function addError(errors, error) {
  const state = findingStates.get(errors);
  if (!state) return Array.prototype.push.call(errors, error);
  if (error.code === "boundary-complexity") {
    if (!state.complexity) {
      Array.prototype.push.call(errors, error);
      state.complexity = true;
    }
    return errors.length;
  }
  if (state.regular < MAX_REGULAR_FINDINGS) {
    Array.prototype.push.call(errors, error);
    state.regular += 1;
  } else if (!state.truncated) {
    Array.prototype.push.call(errors, finding(
      "boundary-findings-truncated",
      `Findings were truncated after ${MAX_REGULAR_FINDINGS} entries.`,
      "$",
    ));
    state.truncated = true;
  }
  return errors.length;
}

function consumeBoundaryOperations(state, errors, count, path) {
  if (state.exhausted) return false;
  if (!Number.isSafeInteger(count) || count < 0 || count > MAX_BOUNDARY_NODES - state.operations) {
    state.exhausted = true;
    addError(errors, finding(
      "boundary-complexity",
      `Job evidence exceeds the ${MAX_BOUNDARY_NODES}-operation boundary budget.`,
      path,
    ));
    return false;
  }
  state.operations += count;
  return true;
}

function isPlainRecord(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isArrayIndex(key, length) {
  if (!/^(?:0|[1-9]\d*)$/u.test(key)) return false;
  const index = Number(key);
  return Number.isSafeInteger(index) && index >= 0 && index < length && String(index) === key;
}

function schemaAllows(schema, type) {
  if (schema?.type === undefined) return true;
  const allowed = Array.isArray(schema.type) ? schema.type : [schema.type];
  return allowed.includes(type);
}

function snapshotData(value, path, errors, schema, state) {
  if (!consumeBoundaryOperations(state, errors, 1, path)) return undefined;
  if (state.depth > MAX_BOUNDARY_DEPTH) {
    addError(errors, finding("boundary-depth", `Job evidence exceeds depth ${MAX_BOUNDARY_DEPTH}.`, path));
    return undefined;
  }
  if (value === null) return null;
  const primitiveType = typeof value;
  if (primitiveType !== "object") {
    if (primitiveType === "string" || primitiveType === "boolean") return value;
    if (primitiveType === "number" && Number.isFinite(value)) return value;
    addError(errors, finding("boundary-primitive", "Only null, strings, booleans, and finite numbers are accepted as data values.", path));
    return undefined;
  }
  if (utilTypes.isProxy(value)) {
    addError(errors, finding("boundary-proxy", "Proxy values are not accepted at the job-evidence boundary.", path));
    return undefined;
  }
  if (state.seen.has(value)) {
    addError(errors, finding("boundary-cycle", "Cyclic values are not accepted at the job-evidence boundary.", path));
    return undefined;
  }
  state.seen.add(value);

  if (Array.isArray(value)) {
    if (!schemaAllows(schema, "array")) {
      addError(errors, finding("schema-type", "Expected a non-array value.", path));
      state.seen.delete(value);
      return undefined;
    }
    if (Object.getPrototypeOf(value) !== Array.prototype) {
      addError(errors, finding("boundary-prototype", "Arrays must use the standard Array prototype.", path));
      state.seen.delete(value);
      return undefined;
    }
    if (value.length > MAX_BOUNDARY_NODES - state.operations) {
      addError(errors, finding("boundary-complexity", `Array exceeds the ${MAX_BOUNDARY_NODES}-value boundary budget.`, path));
      state.exhausted = true;
      state.seen.delete(value);
      return undefined;
    }
    const keys = Reflect.ownKeys(value);
    if (!consumeBoundaryOperations(state, errors, keys.length * 2, path)) {
      state.seen.delete(value);
      return undefined;
    }
    const indexDescriptors = new Map();
    for (const key of keys) {
      if (typeof key === "symbol") {
        addError(errors, finding("boundary-symbol-key", "Symbol keys are not accepted.", path));
        continue;
      }
      if (key === "length") continue;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!isArrayIndex(key, value.length)) {
        addError(errors, finding("boundary-unknown-key", `Unexpected array key '${key}'.`, `${path}.${key}`));
      } else if (!descriptor || descriptor.get || descriptor.set || !Object.hasOwn(descriptor, "value")) {
        addError(errors, finding("boundary-accessor", "Array items must be own data properties.", `${path}[${key}]`));
      } else if (!descriptor.enumerable) {
        addError(errors, finding("boundary-non-enumerable", "Array items must be enumerable.", `${path}[${key}]`));
      } else {
        indexDescriptors.set(Number(key), descriptor);
      }
    }
    if (indexDescriptors.size !== value.length) {
      addError(errors, finding("boundary-array-hole", "Sparse arrays are not accepted.", path));
      state.seen.delete(value);
      return undefined;
    }
    const snapshot = [];
    for (let index = 0; index < value.length && !state.exhausted; index += 1) {
      const descriptor = indexDescriptors.get(index);
      if (descriptor && Object.hasOwn(descriptor, "value")) {
        state.depth += 1;
        snapshot.push(snapshotData(descriptor.value, `${path}[${index}]`, errors, schema?.items, state));
        state.depth -= 1;
      } else {
        snapshot.push(undefined);
      }
    }
    state.seen.delete(value);
    return snapshot;
  }

  if (!schemaAllows(schema, "object")) {
    addError(errors, finding("schema-type", "Expected a non-object value.", path));
    state.seen.delete(value);
    return undefined;
  }
  if (!isPlainRecord(value)) {
    addError(errors, finding("boundary-prototype", "Objects must use Object.prototype or a null prototype.", path));
    state.seen.delete(value);
    return undefined;
  }
  const snapshot = Object.create(null);
  const keys = Reflect.ownKeys(value);
  if (!consumeBoundaryOperations(state, errors, keys.length * 3, path)) {
    state.seen.delete(value);
    return undefined;
  }
  for (const key of keys) {
    if (typeof key === "symbol") {
      addError(errors, finding("boundary-symbol-key", "Symbol keys are not accepted.", path));
      continue;
    }
    if (FORBIDDEN_KEYS.has(key)) {
      addError(errors, finding("boundary-forbidden-key", `Forbidden key '${key}'.`, `${path}.${key}`));
      continue;
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || descriptor.get || descriptor.set || !Object.hasOwn(descriptor, "value")) {
      addError(errors, finding("boundary-accessor", "Object fields must be own data properties.", `${path}.${key}`));
    } else if (!descriptor.enumerable) {
      addError(errors, finding("boundary-non-enumerable", "Object fields must be enumerable.", `${path}.${key}`));
    } else {
      const childSchema = schema?.properties?.[key];
      if (schema?.additionalProperties === false && !Object.hasOwn(schema.properties ?? {}, key)) {
        addError(errors, finding("boundary-unknown-key", `Unexpected field '${key}'.`, `${path}.${key}`));
        continue;
      }
      state.depth += 1;
      snapshot[key] = snapshotData(descriptor.value, `${path}.${key}`, errors, childSchema, state);
      state.depth -= 1;
      if (state.exhausted) break;
    }
  }
  state.seen.delete(value);
  return snapshot;
}

function matchesType(value, type) {
  if (type === "null") return value === null;
  if (type === "object") return isPlainRecord(value);
  if (type === "array") return Array.isArray(value);
  if (type === "integer") return Number.isInteger(value);
  return typeof value === type;
}

function canonicalDataKey(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalDataKey).join(",")}]`;
  if (isPlainRecord(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalDataKey(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function validateSchema(value, schema, path, errors) {
  if (schema.type !== undefined) {
    const allowed = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!allowed.some((type) => matchesType(value, type))) {
      addError(errors, finding("schema-type", `Expected ${allowed.join(" or ")}.`, path));
      return;
    }
  }
  if (value === null) return;
  if (schema.enum && !schema.enum.includes(value)) {
    addError(errors, finding("schema-enum", "Value is not in the approved enum.", path));
  }
  if (typeof value === "string") {
    if (schema.minLength !== undefined && [...value].length < schema.minLength) {
      addError(errors, finding("schema-min-length", `String requires at least ${schema.minLength} characters.`, path));
    }
    if (schema.pattern && !(new RegExp(schema.pattern, "u")).test(value)) {
      addError(errors, finding("schema-pattern", "String does not match the required pattern.", path));
    }
    if (schema.format === "date" && !isIsoDate(value)) {
      addError(errors, finding("schema-format", "Value must be a real ISO calendar date.", path));
    }
    if (schema.format === "uri") {
      try {
        const url = new URL(value);
        if (!url.protocol) throw new Error("missing protocol");
      } catch {
        addError(errors, finding("schema-format", "Value must be an absolute URI.", path));
      }
    }
  }
  if (Number.isInteger(value) && schema.minimum !== undefined && value < schema.minimum) {
    addError(errors, finding("schema-minimum", `Value must be at least ${schema.minimum}.`, path));
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      addError(errors, finding("schema-min-items", `Array requires at least ${schema.minItems} items.`, path));
    }
    const itemErrorStart = errors.length;
    if (schema.items) {
      value.forEach((item, index) => validateSchema(item, schema.items, `${path}[${index}]`, errors));
    }
    if (schema.uniqueItems && errors.length === itemErrorStart
      && new Set(value.map(canonicalDataKey)).size !== value.length) {
      addError(errors, finding("schema-unique-items", "Array items must be unique.", path));
    }
  }
  if (isPlainRecord(value)) {
    const properties = schema.properties ?? {};
    for (const key of schema.required ?? []) {
      if (!Object.hasOwn(value, key)) {
        addError(errors, finding("schema-required", `Required field '${key}' is missing.`, `${path}.${key}`));
      }
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!Object.hasOwn(properties, key)) {
          addError(errors, finding("schema-additional-property", `Unexpected field '${key}'.`, `${path}.${key}`));
        }
      }
    }
    for (const [key, childSchema] of Object.entries(properties)) {
      if (Object.hasOwn(value, key)) validateSchema(value[key], childSchema, `${path}.${key}`, errors);
    }
  }
}

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

export function validateJobEvidenceCollection(inputRecords, inputOptions) {
  const boundaryErrors = createFindingList();
  const boundaryState = {
    depth: 0,
    exhausted: false,
    operations: 0,
    seen: new WeakSet(),
  };
  const records = snapshotData(inputRecords, "$", boundaryErrors, collectionSchema, boundaryState);
  const options = inputOptions === undefined
    ? Object.create(null)
    : boundaryState.exhausted
      ? undefined
      : snapshotData(inputOptions, "$options", boundaryErrors, optionsSchema, boundaryState);
  if (boundaryErrors.length > 0) return { valid: false, errors: boundaryErrors };
  if (!Array.isArray(records)) {
    return {
      valid: false,
      errors: [finding("collection-not-array", "Job evidence collection must be an array.", "$")],
    };
  }

  if (!isPlainRecord(options)) {
    return { valid: false, errors: [finding("boundary-options", "Options must be a plain data object.", "$options")] };
  }
  const { asOfDate } = options;

  const errors = createFindingList();
  validateSchema(options, optionsSchema, "$options", errors);
  records.forEach((record, recordIndex) => validateSchema(record, jobEvidenceSchema, `$[${recordIndex}]`, errors));
  if (errors.length > 0) return { valid: false, errors };
  const sourceIdCounts = new Map();

  records.forEach((record, recordIndex) => {
    const sourceId = typeof record?.sourceId === "string" ? record.sourceId.trim() : "";
    if (!sourceId) {
      addError(errors, finding("missing-source-id", "Every posting requires a non-empty sourceId.", `$[${recordIndex}].sourceId`));
      return;
    }
    sourceIdCounts.set(sourceId, (sourceIdCounts.get(sourceId) ?? 0) + 1);
  });

  for (const [sourceId, count] of sourceIdCounts) {
    if (count > 1) {
      addError(errors, finding("duplicate-source-id", `Posting sourceId '${sourceId}' occurs ${count} times.`, "$"));
    }
  }

  const postingSourceIds = new Set(sourceIdCounts.keys());
  const denominator = postingSourceIds.size;
  const postingById = new Map(records.filter((record) => typeof record?.sourceId === "string")
    .map((record) => [record.sourceId.trim(), record]));
  const actualGeography = [...new Set(records.map((record) => record?.region).filter((region) => typeof region === "string" && region.length > 0))].sort();
  const asOfIsValid = isIsoDate(asOfDate);
  if (records.length > 0 && asOfDate === undefined) {
    addError(errors, finding("missing-as-of-date", "Current job postings require an explicit asOfDate.", "$options.asOfDate"));
  } else if (records.length > 0 && !asOfIsValid) {
    addError(errors, finding("invalid-as-of-date", "asOfDate must be a real ISO calendar date.", "$"));
  }

  records.forEach((record, recordIndex) => {
    const recordPath = `$[${recordIndex}]`;
    if (record?.sourceType !== "official-company-career-page") {
      addError(errors, finding(
        "posting-source-not-primary",
        "Every current job posting must be an official company career page.",
        `${recordPath}.sourceType`,
      ));
    }
    let sourceUrl;
    try {
      sourceUrl = new URL(record?.sourceUrl);
    } catch {
      sourceUrl = null;
    }
    if (!sourceUrl || sourceUrl.protocol !== "https:") {
      addError(errors, finding(
        "posting-source-url",
        "Every current job posting requires an HTTPS official career URL.",
        `${recordPath}.sourceUrl`,
      ));
    }
    const datesValid = isIsoDate(record?.postedDate)
      && isIsoDate(record?.retrievalDate)
      && isIsoDate(record?.reviewAfter);
    if (!datesValid) {
      addError(errors, finding(
        "posting-source-date",
        "Every current job posting requires real ISO postedDate, retrievalDate, and reviewAfter values.",
        recordPath,
      ));
    } else if (asOfIsValid) {
      if (record.postedDate > record.retrievalDate || record.retrievalDate > asOfDate) {
        addError(errors, finding(
          "posting-source-date-order",
          "Posting dates must satisfy postedDate <= retrievalDate <= asOfDate.",
          recordPath,
        ));
      }
      if (asOfDate > record.reviewAfter) {
        addError(errors, finding(
          "posting-source-stale",
          `Posting evidence expired after ${record.reviewAfter}; re-retrieve it for ${asOfDate}.`,
          `${recordPath}.reviewAfter`,
        ));
      }
    }
    if (record?.sampleSize !== denominator) {
      addError(errors, finding("sample-size-mismatch", `sampleSize must equal ${denominator} deduplicated postings.`, `$[${recordIndex}].sampleSize`));
    }
    if (!exactStringSet(record?.sampleGeography, actualGeography)) {
      addError(errors, finding("sample-geography-mismatch", `sampleGeography must exactly match ${JSON.stringify(actualGeography)}.`, `$[${recordIndex}].sampleGeography`));
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
        addError(errors, finding("signal-source-ref-minimum", "Repeated signals require at least two sourceRefs.", `${signalPath}.sourceRefs`));
      }

      if (typeof signal?.signalId !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u.test(signal.signalId)) {
        addError(errors, finding("missing-signal-id", "Every repeated signal requires a stable signalId.", `${signalPath}.signalId`));
      } else if (signalIds.has(signal.signalId)) {
        addError(errors, finding("duplicate-signal-id", `Repeated signalId '${signal.signalId}' must be unique.`, `${signalPath}.signalId`));
      } else {
        signalIds.add(signal.signalId);
      }
      if (uniqueRefKeys.size !== sourceRefs.length || uniqueSignalSourceIds.size !== sourceRefs.length) {
        addError(errors, finding("duplicate-signal-source-ref", "Repeated-signal sourceRefs must identify distinct requirements in distinct postings.", `${signalPath}.sourceRefs`));
      }

      sourceRefs.forEach((ref, refIndex) => {
        const refPath = `${signalPath}.sourceRefs[${refIndex}]`;
        const source = postingById.get(ref?.sourceId);
        if (!source) {
          addError(errors, finding("orphan-source-id", `Repeated signal references unknown sourceId '${ref?.sourceId}'.`, `${refPath}.sourceId`));
          return;
        }
        if (!REQUIREMENT_FIELDS.has(ref?.field)) {
          addError(errors, finding("signal-source-field", "field must name responsibilities, requiredSkills, or preferredSkills.", `${refPath}.field`));
          return;
        }
        const requirements = source[ref.field];
        if (!Array.isArray(requirements) || !Number.isInteger(ref?.index) || ref.index < 0 || ref.index >= requirements.length) {
          addError(errors, finding("signal-source-index", "index must address an existing item in the cited posting field.", `${refPath}.index`));
          return;
        }
        const statement = requirements[ref.index];
        if (ref.statement !== statement) {
          addError(errors, finding("signal-statement-mismatch", "statement must byte-match the cited posting item.", `${refPath}.statement`));
        }
        const expectedRequirementId = `${ref.sourceId}:${ref.field}:${ref.index}`;
        if (ref.requirementId !== expectedRequirementId) {
          addError(errors, finding("signal-requirement-id", `requirementId must equal '${expectedRequirementId}'.`, `${refPath}.requirementId`));
        }
        const normalized = normalizeRequirement(statement);
        if (ref.normalizedValue !== normalized || signal?.normalizedValue !== normalized || signal?.signal !== normalized) {
          addError(errors, finding("signal-normalization-mismatch", "signal and ref normalizedValue must equal the deterministic normalization of the cited statement.", refPath));
        }
        if (source.sourceType !== "official-company-career-page") {
          addError(errors, finding("signal-source-not-primary", "Repeated signals may cite only official company career postings.", `${refPath}.sourceId`));
        }
        let sourceUrl;
        try {
          sourceUrl = new URL(source.sourceUrl);
        } catch {
          sourceUrl = null;
        }
        if (!sourceUrl || sourceUrl.protocol !== "https:") {
          addError(errors, finding("signal-source-url", "Repeated-signal sources require an HTTPS official career URL.", `${refPath}.sourceId`));
        }
        const datesValid = isIsoDate(source.postedDate) && isIsoDate(source.retrievalDate) && isIsoDate(source.reviewAfter);
        if (!datesValid) {
          addError(errors, finding("signal-source-date", "Cited postings require real ISO postedDate, retrievalDate, and reviewAfter values.", `${refPath}.sourceId`));
        } else {
          if (source.postedDate > source.retrievalDate || source.retrievalDate > source.reviewAfter
            || (asOfIsValid && source.retrievalDate > asOfDate)) {
            addError(errors, finding("signal-source-date-order", "Dates must satisfy postedDate <= retrievalDate <= asOfDate <= reviewAfter.", `${refPath}.sourceId`));
          }
          if (asOfIsValid && asOfDate > source.reviewAfter) {
            addError(errors, finding("signal-source-stale", `Cited posting evidence expired after ${source.reviewAfter}.`, `${refPath}.sourceId`));
          }
        }
      });

      if (signal?.count !== uniqueSignalSourceIds.size) {
        addError(errors, finding("signal-count-mismatch", `count must equal ${uniqueSignalSourceIds.size} distinct cited postings.`, `${signalPath}.count`));
      }
      if (signal?.denominator !== denominator) {
        addError(errors, finding("signal-denominator-mismatch", `denominator must equal ${denominator} deduplicated postings.`, `${signalPath}.denominator`));
      }
      if (typeof signal?.count === "number" && typeof signal?.denominator === "number" && signal.count > signal.denominator) {
        addError(errors, finding("signal-count-exceeds-denominator", "count must not exceed denominator.", signalPath));
      }
    });
  });

  return { valid: errors.length === 0, errors };
}

function cliFailure(code, message) {
  return { valid: false, errors: [finding(code, message, "$cli")] };
}

export async function main(argv = process.argv.slice(2)) {
  const validShape = Array.isArray(argv)
    && (argv.length === 1 || (argv.length === 3 && argv[1] === "--as-of"));
  if (!validShape) {
    process.stderr.write(`${JSON.stringify(cliFailure("cli.usage", "Usage: node validate-job-evidence.mjs <collection.json> [--as-of YYYY-MM-DD]"), null, 2)}\n`);
    return 2;
  }
  try {
    const records = JSON.parse(await readFile(argv[0], "utf8"));
    const result = validateJobEvidenceCollection(records, argv.length === 3 ? { asOfDate: argv[2] } : undefined);
    const output = `${JSON.stringify(result, null, 2)}\n`;
    (result.valid ? process.stdout : process.stderr).write(output);
    return result.valid ? 0 : 1;
  } catch (error) {
    process.stderr.write(`${JSON.stringify(cliFailure("cli.input", error instanceof Error ? error.message : String(error)), null, 2)}\n`);
    return 1;
  }
}

export function isMainModule(metaUrl = import.meta.url, argvPath = process.argv[1]) {
  if (typeof argvPath !== "string" || argvPath.length === 0) return false;
  try {
    return realpathSync(fileURLToPath(metaUrl)) === realpathSync(argvPath);
  } catch {
    return false;
  }
}

if (isMainModule()) process.exitCode = await main();
