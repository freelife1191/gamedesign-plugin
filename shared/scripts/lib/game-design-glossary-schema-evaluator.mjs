import { lstatSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalJson } from "./reference-intelligence-canonical.mjs";

const extensionKey = "x-game-design-glossary";
const expectedExtension = Object.freeze({ canonicalText: Object.freeze({ allowLf: true, forbidBom: true, forbidControlsExceptLf: true, requireNfc: true }), maxCanonicalUtf8Bytes: 2 * 1024 * 1024, requiredScopeTerms: Object.freeze({ effective: 1, shared: 1 }) });
const expectedSchemaUri = "https://json-schema.org/draft/2020-12/schema";
const expectedSchemaId = "https://game-design-plugin.local/schema/game-design-glossary.schema.json";
const schemaKeywords = new Set(["$ref", "additionalProperties", "allOf", "anyOf", "const", "else", "enum", "format", "if", "items", "maxItems", "maxLength", "minItems", "minLength", "minimum", "not", "oneOf", "pattern", "properties", "required", "then", "type", "uniqueItems"]);
const rootKeywords = new Set(["$defs", "$id", "$schema", "additionalProperties", "allOf", extensionKey, "properties", "required", "type"]);
const badControl = /[\u0000-\u0009\u000b-\u001f\u007f-\u009f\uFEFF\r]/u;
const evaluatorPath = fileURLToPath(import.meta.url);
const evaluatorDir = path.dirname(evaluatorPath);
const sourcePath = path.resolve(evaluatorDir, "../../reference-intelligence/schema/game-design-glossary.schema.json");
const installedPath = path.resolve(evaluatorDir, "../../references/shared/reference-intelligence/schema/game-design-glossary.schema.json");

function same(left, right) { try { return canonicalJson(left) === canonicalJson(right); } catch { return false; } }
function result(ok, code = "glossary-schema.invalid") { return ok ? { ok: true, errors: [] } : { ok: false, errors: [{ code }] }; }
function sameIdentity(left, right) { return left.dev === right.dev && left.ino === right.ino && left.size === right.size && left.mode === right.mode; }
function inspectSchemaCandidate(candidate) {
  try {
    const absolute = path.resolve(candidate); const parsed = path.parse(absolute); const segments = path.relative(parsed.root, absolute).split(path.sep).filter(Boolean);
    if (segments.length === 0 || segments.length > 32) return { status: "invalid" };
    let current = parsed.root;
    for (const [index, segment] of segments.entries()) {
      current = path.join(current, segment); const initial = lstatSync(current); const canonical = realpathSync(current); const resolved = lstatSync(canonical);
      if (initial.isSymbolicLink() || canonical !== current || !sameIdentity(initial, resolved) || index < segments.length - 1 && !initial.isDirectory() || index === segments.length - 1 && !initial.isFile()) return { status: "invalid" };
    }
    return { status: "present", stats: lstatSync(absolute) };
  } catch (error) { return error?.code === "ENOENT" ? { status: "absent" } : { status: "invalid" }; }
}
function readSchema(candidate, identity) {
  try {
    const bytes = readFileSync(candidate); const final = inspectSchemaCandidate(candidate);
    if (final.status !== "present" || !sameIdentity(identity, final.stats)) return null;
    const text = bytes.toString("utf8"); if (!Buffer.from(text, "utf8").equals(bytes) || text.includes("\0") || text.includes("\uFEFF")) return null;
    return { bytes, schema: JSON.parse(text) };
  } catch { return null; }
}

/** Resolves only fixed source/installed schema locations; when both exist they must be byte-identical. */
export function loadGameDesignGlossarySchema() {
  const source = inspectSchemaCandidate(sourcePath); const installed = inspectSchemaCandidate(installedPath);
  if (source.status === "invalid" || installed.status === "invalid" || source.status === "absent" && installed.status === "absent") return null;
  const sourceValue = source.status === "present" ? readSchema(sourcePath, source.stats) : null; const installedValue = installed.status === "present" ? readSchema(installedPath, installed.stats) : null;
  if (source.status === "present" && !sourceValue || installed.status === "present" && !installedValue || sourceValue && installedValue && !sourceValue.bytes.equals(installedValue.bytes)) return null;
  const schema = sourceValue?.schema ?? installedValue?.schema; return schema && validateSchemaShape(schema) ? schema : null;
}

function safeTree(value, seen = new Set()) {
  if (value === null || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "string") return value === value.normalize("NFC") && !badControl.test(value);
  if (!value || typeof value !== "object" || seen.has(value) || ![Object.prototype, Array.prototype].includes(Object.getPrototypeOf(value))) return false;
  seen.add(value); const valid = Array.isArray(value) ? value.every((item) => safeTree(item, seen)) : Reflect.ownKeys(value).every((key) => typeof key === "string" && safeTree(value[key], seen)); seen.delete(value); return valid;
}
function object(value) { return value !== null && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype; }
function schemaNode(value, root, seen = new Set()) {
  if (!object(value) || seen.has(value) || Reflect.ownKeys(value).some((key) => typeof key !== "string" || !schemaKeywords.has(key))) return false;
  seen.add(value);
  if (value.$ref !== undefined && (typeof value.$ref !== "string" || !/^#\/\$defs\/[A-Za-z][A-Za-z0-9]*$/u.test(value.$ref) || !object(root.$defs?.[value.$ref.slice("#/$defs/".length)]) || Object.keys(value).length !== 1)) return false;
  if (value.type !== undefined && !(["array", "boolean", "integer", "null", "number", "object", "string"].includes(value.type) || Array.isArray(value.type) && value.type.length > 0 && value.type.every((item) => ["array", "boolean", "integer", "null", "number", "object", "string"].includes(item)))) return false;
  if (value.required !== undefined && (!Array.isArray(value.required) || value.required.some((item) => typeof item !== "string") || new Set(value.required).size !== value.required.length)) return false;
  if (value.properties !== undefined && (!object(value.properties) || !Object.values(value.properties).every((item) => schemaNode(item, root, seen)))) return false;
  if (value.items !== undefined && !schemaNode(value.items, root, seen)) return false;
  if (value.additionalProperties !== undefined && value.additionalProperties !== false && value.additionalProperties !== true && !schemaNode(value.additionalProperties, root, seen)) return false;
  for (const key of ["allOf", "anyOf", "oneOf"]) if (value[key] !== undefined && (!Array.isArray(value[key]) || value[key].length === 0 || !value[key].every((item) => schemaNode(item, root, seen)))) return false;
  for (const key of ["if", "then", "else", "not"]) if (value[key] !== undefined && !schemaNode(value[key], root, seen)) return false;
  for (const key of ["minItems", "maxItems", "minLength", "maxLength", "minimum"]) if (value[key] !== undefined && (!Number.isInteger(value[key]) || value[key] < 0)) return false;
  if (value.pattern !== undefined && (typeof value.pattern !== "string" || (() => { try { new RegExp(value.pattern, "u"); return false; } catch { return true; } })())) return false;
  if (value.enum !== undefined && (!Array.isArray(value.enum) || value.enum.length === 0)) return false;
  if (value.uniqueItems !== undefined && typeof value.uniqueItems !== "boolean") return false;
  if (value.format !== undefined && value.format !== "date-time") return false;
  seen.delete(value); return true;
}
function validateSchemaShape(schema) {
  if (!object(schema) || schema.$schema !== expectedSchemaUri || schema.$id !== expectedSchemaId || Reflect.ownKeys(schema).some((key) => typeof key !== "string" || !rootKeywords.has(key)) || !same(schema[extensionKey], expectedExtension) || !object(schema.$defs) || !Object.values(schema.$defs).every((node) => schemaNode(node, schema))) return false;
  const node = { ...schema }; delete node.$defs; delete node.$schema; delete node.$id; delete node[extensionKey]; return schemaNode(node, schema);
}
function resolveRef(schema, ref) { return schema.$defs?.[ref.slice("#/$defs/".length)]; }
function typeMatches(value, expected) { const types = Array.isArray(expected) ? expected : [expected]; return types.some((type) => (type === "null" && value === null) || (type === "array" && Array.isArray(value)) || (type === "object" && object(value)) || (type === "string" && typeof value === "string") || (type === "boolean" && typeof value === "boolean") || (type === "number" && typeof value === "number" && Number.isFinite(value)) || (type === "integer" && Number.isInteger(value))); }
function validateDateTime(value) { return typeof value === "string" && !Number.isNaN(new Date(value).valueOf()) && new Date(value).toISOString() === value; }
function validateNode(value, node, schema) {
  if (node.$ref) return validateNode(value, resolveRef(schema, node.$ref), schema);
  if (node.type !== undefined && !typeMatches(value, node.type)) return false;
  if (node.const !== undefined && !same(value, node.const)) return false;
  if (node.enum !== undefined && !node.enum.some((item) => same(value, item))) return false;
  if (node.minimum !== undefined && (typeof value !== "number" || value < node.minimum)) return false;
  if (node.minLength !== undefined && typeof value === "string" && value.length < node.minLength) return false;
  if (node.maxLength !== undefined && typeof value === "string" && value.length > node.maxLength) return false;
  if (node.pattern !== undefined && typeof value === "string" && !new RegExp(node.pattern, "u").test(value)) return false;
  if (node.format !== undefined && node.format === "date-time" && typeof value === "string" && !validateDateTime(value)) return false;
  if (node.minItems !== undefined && Array.isArray(value) && value.length < node.minItems) return false;
  if (node.maxItems !== undefined && Array.isArray(value) && value.length > node.maxItems) return false;
  if (node.uniqueItems && (!Array.isArray(value) || new Set(value.map((item) => canonicalJson(item))).size !== value.length)) return false;
  if (node.items !== undefined && (!Array.isArray(value) || !value.every((item) => validateNode(item, node.items, schema)))) return false;
  if (node.required !== undefined && (!object(value) || node.required.some((key) => !Object.hasOwn(value, key)))) return false;
  if (node.properties !== undefined) { if (!object(value)) return false; for (const [key, child] of Object.entries(node.properties)) if (Object.hasOwn(value, key) && !validateNode(value[key], child, schema)) return false; }
  if (node.additionalProperties === false && object(value) && Reflect.ownKeys(value).some((key) => typeof key !== "string" || !Object.hasOwn(node.properties ?? {}, key))) return false;
  if (node.additionalProperties && node.additionalProperties !== true && node.additionalProperties !== false && object(value)) for (const [key, item] of Object.entries(value)) if (!Object.hasOwn(node.properties ?? {}, key) && !validateNode(item, node.additionalProperties, schema)) return false;
  if (node.allOf !== undefined && !node.allOf.every((child) => validateNode(value, child, schema))) return false;
  if (node.anyOf !== undefined && !node.anyOf.some((child) => validateNode(value, child, schema))) return false;
  if (node.oneOf !== undefined && node.oneOf.filter((child) => validateNode(value, child, schema)).length !== 1) return false;
  if (node.not !== undefined && validateNode(value, node.not, schema)) return false;
  if (node.if !== undefined) { const branch = validateNode(value, node.if, schema) ? node.then : node.else; if (branch !== undefined && !validateNode(value, branch, schema)) return false; }
  return true;
}

/** Single runtime authority for all declarative glossary-schema keywords plus its executable extension. */
export function evaluateGameDesignGlossarySchema(value, { schema = loadGameDesignGlossarySchema() } = {}) {
  try {
    if (!schema || !validateSchemaShape(schema)) return result(false, "glossary-schema.extension");
    if (!safeTree(value) || Buffer.byteLength(canonicalJson(value), "utf8") > expectedExtension.maxCanonicalUtf8Bytes) return result(false, "glossary-schema.canonical");
    return result(validateNode(value, schema, schema));
  } catch { return result(false, "glossary-schema.invalid"); }
}
