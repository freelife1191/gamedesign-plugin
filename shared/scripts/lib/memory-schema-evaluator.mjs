import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

function packagedSchemaBytes(name) {
  const candidates = ["../../memory/schema/", "../../references/shared/memory/schema/"]
    .map((relative) => new URL(name, new URL(relative, import.meta.url)));
  const found = [];
  for (const candidate of candidates) {
    try { found.push(readFileSync(fileURLToPath(candidate))); } catch (error) { if (error?.code !== "ENOENT") throw error; }
  }
  if (!found.length || found.some((bytes) => !bytes.equals(found[0]))) throw new Error("memory schema unavailable");
  return found[0];
}
const indexSchema = JSON.parse(packagedSchemaBytes("memory-index.schema.json").toString("utf8"));
const receiptSchema = JSON.parse(packagedSchemaBytes("memory-receipt.schema.json").toString("utf8"));
const observationRelationKey = "x-memory-observation-digest-relation";
if (receiptSchema?.properties?.observations?.items?.[observationRelationKey] !== true) throw new Error("memory schema unavailable");

function equalJson(left, right) {
  if (left === right) return true;
  if (!left || !right || typeof left !== "object" || typeof right !== "object" || Array.isArray(left) !== Array.isArray(right)) return false;
  if (Array.isArray(left)) return left.length === right.length && left.every((item, index) => equalJson(item, right[index]));
  const keys = Object.keys(left); return keys.length === Object.keys(right).length && keys.every((key) => Object.hasOwn(right, key) && equalJson(left[key], right[key]));
}
function matchesType(value, type) {
  return type === "object" ? value !== null && typeof value === "object" && !Array.isArray(value)
    : type === "array" ? Array.isArray(value)
      : type === "string" ? typeof value === "string"
        : type === "null" ? value === null
          : type === "integer" ? Number.isInteger(value)
            : false;
}
function schemaAccepts(value, schema) {
  if (typeof schema === "boolean") return schema;
  if (Object.hasOwn(schema, observationRelationKey) && (schema[observationRelationKey] !== true || !observationStatusMatches(value))) return false;
  if (schema.allOf && !schema.allOf.every((part) => schemaAccepts(value, part))) return false;
  if (schema.anyOf && !schema.anyOf.some((part) => schemaAccepts(value, part))) return false;
  if (schema.oneOf && schema.oneOf.filter((part) => schemaAccepts(value, part)).length !== 1) return false;
  if (schema.not && schemaAccepts(value, schema.not)) return false;
  if (schema.if && schemaAccepts(value, schema.if) && schema.then && !schemaAccepts(value, schema.then)) return false;
  if (schema.if && !schemaAccepts(value, schema.if) && schema.else && !schemaAccepts(value, schema.else)) return false;
  if (Object.hasOwn(schema, "const") && !equalJson(value, schema.const)) return false;
  if (schema.enum && !schema.enum.some((item) => equalJson(value, item))) return false;
  const types = schema.type === undefined ? [] : Array.isArray(schema.type) ? schema.type : [schema.type];
  if (types.length && !types.some((type) => matchesType(value, type))) return false;
  if (typeof value === "string") return Array.from(value).length >= (schema.minLength ?? 0) && Array.from(value).length <= (schema.maxLength ?? Number.POSITIVE_INFINITY) && (!schema.pattern || new RegExp(schema.pattern, "u").test(value));
  if (Array.isArray(value)) return value.length >= (schema.minItems ?? 0) && value.length <= (schema.maxItems ?? Number.POSITIVE_INFINITY) && (!schema.uniqueItems || value.every((item, index) => !value.slice(0, index).some((prior) => equalJson(prior, item)))) && (!schema.items || value.every((item) => schemaAccepts(item, schema.items)));
  if (value !== null && typeof value === "object") {
    if ((schema.required ?? []).some((key) => !Object.hasOwn(value, key))) return false;
    return Object.entries(value).every(([key, item]) => Object.hasOwn(schema.properties ?? {}, key) ? schemaAccepts(item, schema.properties[key]) : schema.additionalProperties !== false);
  }
  return (schema.minimum === undefined || value >= schema.minimum) && (schema.maximum === undefined || value <= schema.maximum);
}

const id = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const utf8Compare = (left, right) => Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
const canonicalString = (value) => typeof value === "string" && value === value.normalize("NFC") && !value.includes("\0") && !value.includes("\uFEFF") && !value.includes("\r");
const safeId = (value) => canonicalString(value) && id.test(value);
const safeRelative = (value) => canonicalString(value) && !value.includes("\\") && !value.startsWith("/") && !value.startsWith("../") && !value.split("/").includes("..");
const sortedUniqueIds = (values) => Array.isArray(values) && values.every(safeId) && values.every((item, index) => index === 0 || utf8Compare(values[index - 1], item) < 0);
const safeLocator = (value) => canonicalString(value) && safeRelative(value.split("#", 1)[0]);
function observationStatusMatches({ expectedSha256, observedSha256, status }) { return (status === "current" && observedSha256 === expectedSha256)
  || (status === "drift" && typeof observedSha256 === "string" && observedSha256 !== expectedSha256)
  || (["missing", "symlink", "unreadable"].includes(status) && observedSha256 === null); }

export function validateMemoryIndexSchema(value) {
  return schemaAccepts(value, indexSchema) && value.entries.every((entry, index) => safeId(entry.memoryId) && safeRelative(entry.headEventPath) && (!index || utf8Compare(value.entries[index - 1].memoryId, entry.memoryId) < 0) && [entry.artifactTypes, entry.relatedIds, entry.tags].every(sortedUniqueIds));
}
export function validateMemoryReceiptSchema(value) {
  return schemaAccepts(value, receiptSchema)
    && safeId(value.projectId)
    && value.observations.every((item, index) => safeId(item.memoryId) && safeId(item.artifactId) && safeLocator(item.locator) && observationStatusMatches(item) && (!index || utf8Compare(`${value.observations[index - 1].memoryId}\0${value.observations[index - 1].artifactId}\0${value.observations[index - 1].locator}`, `${item.memoryId}\0${item.artifactId}\0${item.locator}`) < 0))
    && value.applied.every((item, index) => safeId(item.memoryId) && (!index || utf8Compare(value.applied[index - 1].memoryId, item.memoryId) < 0))
    && value.excluded.every((item, index) => safeId(item.memoryId) && canonicalString(item.reason) && (!index || utf8Compare(value.excluded[index - 1].memoryId, item.memoryId) < 0));
}
export function memorySchemaDefinitions() { return { index: structuredClone(indexSchema), receipt: structuredClone(receiptSchema) }; }
