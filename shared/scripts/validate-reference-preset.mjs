import { readFileSync } from "node:fs";

const schema = JSON.parse(readFileSync(
  new URL("../document-quality/schema/reference-preset.schema.json", import.meta.url),
  "utf8",
));
const expectedKeys = [...schema.required];
const allowedIds = new Set(schema.properties.preset_id.enum);
const safeTextPattern = new RegExp(schema.$defs.safeText.pattern, "u");
const listKeys = expectedKeys.filter((key) => key !== "preset_id" && key !== "version");

function issue(errors, path, code, message) {
  errors.push({ path, code, message });
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

export function validateReferencePreset(value) {
  const errors = [];
  if (!isPlainObject(value)) {
    issue(errors, "", "schema.type", "Reference preset must be a plain object.");
    return { ok: false, errors };
  }
  const keys = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) {
    issue(errors, "", "schema.keys", "Reference preset has an unknown or missing field.");
  }
  if (!allowedIds.has(value.preset_id)) {
    issue(errors, "/preset_id", "preset.enum", "Reference preset ID is not approved.");
  }
  if (!Number.isInteger(value.version) || value.version < schema.properties.version.minimum) {
    issue(errors, "/version", "version.invalid", "Reference preset version must be a positive integer.");
  }
  for (const key of listKeys) {
    const list = value[key];
    if (!Array.isArray(list) || list.length < schema.$defs.safeTextList.minItems) {
      issue(errors, `/${key}`, "list.empty", `${key} must be a non-empty array.`);
      continue;
    }
    const seen = new Set();
    for (const [index, item] of list.entries()) {
      const itemPath = `/${key}/${index}`;
      if (typeof item !== "string" || item.trim() === "") {
        issue(errors, itemPath, "text.empty", "Reference preset text must be non-empty.");
        continue;
      }
      if (item !== item.normalize("NFC")) {
        issue(errors, itemPath, "text.nfc", "Reference preset text must use Unicode NFC.");
      }
      if (!safeTextPattern.test(item)) {
        issue(errors, itemPath, "text.pattern", "Reference preset text violates the packaged safe-text pattern.");
      }
      if (seen.has(item)) issue(errors, itemPath, "list.duplicate", `${key} must contain unique strings.`);
      seen.add(item);
    }
  }
  return { ok: errors.length === 0, errors };
}

export function assertValidReferencePreset(value) {
  const result = validateReferencePreset(value);
  if (!result.ok) {
    const detail = result.errors.map(({ path, code, message }) => `${path || "/"} [${code}] ${message}`).join("; ");
    throw new Error(`Invalid reference preset: ${detail}`);
  }
  return value;
}
