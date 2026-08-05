import { snapshotDataOnly } from "./data-only-snapshot.mjs";

export const referencePresetContract = Object.freeze({
  expectedKeys: Object.freeze([
    "preset_id", "version", "emphasis", "review_questions", "recommended_diagrams", "story_hints",
    "additional_acceptance_criteria",
  ]),
  allowedIds: Object.freeze([
    "competitive-live-service", "replayable-coop", "evolving-world", "function-first",
    "player-validated-small-team", "cinematic-narrative", "ugc-production-tooling",
  ]),
  minimumVersion: 1,
  safeTextPattern: "^(?![\\s\\S]*(?:[A-Za-z][A-Za-z0-9+.-]*://|[Mm][Aa][Ii][Ll][Tt][Oo]:|[Dd][Aa][Tt][Aa]:|[Ff][Ii][Ll][Ee]:|//[^\\s/]|[Ww][Ww][Ww]\\.|(?:[Cc][Oo][Pp][Yy]|[Rr][Ee][Uu][Ss][Ee])[^\\r\\n]*(?:[Ss][Oo][Uu][Rr][Cc][Ee]|[Oo][Rr][Ii][Gg][Ii][Nn][Aa][Ll]|[Ll][Oo][Gg][Oo]|[Ll][Aa][Yy][Oo][Uu][Tt]|[Ii][Mm][Aa][Gg][Ee])|(?:[Ss][Oo][Uu][Rr][Cc][Ee]|[Oo][Rr][Ii][Gg][Ii][Nn][Aa][Ll])[^\\r\\n]*(?:[Nn][Aa][Mm][Ee]|[Uu][Rr][Ll]|[Cc][Oo][Mm][Pp][Aa][Nn][Yy]|[Pp][Rr][Oo][Jj][Ee][Cc][Tt]|[Tt][Rr][Aa][Dd][Ee][Mm][Aa][Rr][Kk]|[Ll][Oo][Gg][Oo]|[Ll][Aa][Yy][Oo][Uu][Tt]|[Ii][Mm][Aa][Gg][Ee]|[Cc][Ii][Tt][Aa][Tt][Ii][Oo][Nn])))[\\s\\S]+$",
  listMinItems: 1,
});
const expectedKeys = [...referencePresetContract.expectedKeys];
const allowedIds = new Set(referencePresetContract.allowedIds);
const safeTextPattern = new RegExp(referencePresetContract.safeTextPattern, "u");
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
  try {
    value = snapshotDataOnly(value, "reference preset");
  } catch (error) {
    issue(errors, "", "data.snapshot", error.message);
    return { ok: false, errors };
  }
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
  if (!Number.isInteger(value.version) || value.version < referencePresetContract.minimumVersion) {
    issue(errors, "/version", "version.invalid", "Reference preset version must be a positive integer.");
  }
  for (const key of listKeys) {
    const list = value[key];
    if (!Array.isArray(list) || list.length < referencePresetContract.listMinItems) {
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
