import { createHash } from "node:crypto";

function fail() {
  const error = new Error("canonical JSON input is invalid");
  error.code = "reference-intelligence.noncanonical";
  throw error;
}

function snapshot(value, seen = new Set()) {
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value.includes("\0") || value.includes("\r") || value !== value.normalize("NFC")) fail();
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) fail();
    return value;
  }
  if (Array.isArray(value)) {
    if (seen.has(value)) fail();
    seen.add(value);
    const copy = value.map((item) => snapshot(item, seen));
    seen.delete(value);
    return copy;
  }
  if (value === null || typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype || seen.has(value)) fail();
  seen.add(value);
  const copy = {};
  for (const key of Object.keys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !Object.hasOwn(descriptor, "value")) fail();
    copy[key] = snapshot(descriptor.value, seen);
  }
  seen.delete(value);
  return copy;
}

function serialize(value) {
  if (Array.isArray(value)) return `[${value.map(serialize).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${serialize(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function canonicalJson(value) {
  try {
    return serialize(snapshot(value));
  } catch {
    fail();
  }
}

export function sha256Canonical(value) {
  return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
}
