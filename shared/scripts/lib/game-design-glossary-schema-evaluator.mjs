import bundledSchema from "../../reference-intelligence/schema/game-design-glossary.schema.json" with { type: "json" };
import { canonicalJson } from "./reference-intelligence-canonical.mjs";

const extensionKey = "x-game-design-glossary";
const expectedExtension = Object.freeze({ canonicalText: Object.freeze({ allowLf: true, forbidBom: true, forbidControlsExceptLf: true, requireNfc: true }), maxCanonicalUtf8Bytes: 2 * 1024 * 1024, requiredScopeTerms: Object.freeze({ effective: 1, shared: 1 }) });
const expectedRootKeys = Object.freeze(["$defs", "$id", "$schema", "additionalProperties", "allOf", extensionKey, "properties", "required", "type"]);
const badControl = /[\u0000-\u0009\u000b-\u001f\u007f-\u009f\uFEFF\r]/u;

function same(left, right) { try { return canonicalJson(left) === canonicalJson(right); } catch { return false; } }
function safeTree(value, seen = new Set()) {
  if (value === null || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "string") return value === value.normalize("NFC") && !badControl.test(value);
  if (!value || typeof value !== "object" || seen.has(value)) return false;
  seen.add(value);
  const ok = Array.isArray(value) ? value.every((item) => safeTree(item, seen)) : Object.values(value).every((item) => safeTree(item, seen));
  seen.delete(value); return ok;
}

/** Evaluates this schema's executable canonical-text extension; regular JSON Schema remains declarative. */
export function evaluateGameDesignGlossarySchema(value, { schema = bundledSchema } = {}) {
  try {
    if (!schema || typeof schema !== "object" || Object.keys(schema).sort().join("\0") !== [...expectedRootKeys].sort().join("\0") || !same(schema[extensionKey], expectedExtension)) return { ok: false, errors: [{ code: "glossary-schema.extension" }] };
    if (!safeTree(value) || Buffer.byteLength(canonicalJson(value), "utf8") > expectedExtension.maxCanonicalUtf8Bytes) return { ok: false, errors: [{ code: "glossary-schema.canonical" }] };
    const minimum = expectedExtension.requiredScopeTerms[value?.scope]; if (minimum && (!Array.isArray(value?.terms) || value.terms.length < minimum)) return { ok: false, errors: [{ code: "glossary-schema.required-terms" }] };
    return { ok: true, errors: [] };
  } catch { return { ok: false, errors: [{ code: "glossary-schema.canonical" }] }; }
}
