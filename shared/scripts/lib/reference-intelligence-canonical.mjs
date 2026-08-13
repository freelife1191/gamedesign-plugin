import { createHash } from "node:crypto";

function fail() {
  const error = new Error("canonical JSON input is invalid");
  error.code = "reference-intelligence.noncanonical";
  throw error;
}

function safeKey(key) {
  return typeof key === "string" && !key.includes("\0") && !key.includes("\r") && key === key.normalize("NFC");
}

function dataDescriptor(value, key) {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (!descriptor || !descriptor.enumerable || !Object.hasOwn(descriptor, "value")) fail();
  return descriptor.value;
}

function snapshot(value, seen = new Set()) {
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value.includes("\0") || value.includes("\r") || value !== value.normalize("NFC")) fail();
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value) || Object.is(value, -0)) fail();
    return value;
  }
  if (Array.isArray(value)) {
    if (seen.has(value)) fail();
    seen.add(value);
    const keys = Reflect.ownKeys(value);
    if (keys.length !== value.length + 1 || !keys.includes("length")) fail();
    const copy = [];
    for (let index = 0; index < value.length; index += 1) {
      const key = String(index);
      if (!keys.includes(key)) fail();
      copy.push(snapshot(dataDescriptor(value, key), seen));
    }
    seen.delete(value);
    return copy;
  }
  if (value === null || typeof value !== "object" || ![Object.prototype, null].includes(Object.getPrototypeOf(value)) || seen.has(value)) fail();
  seen.add(value);
  const copy = Object.create(null);
  for (const key of Reflect.ownKeys(value)) {
    if (!safeKey(key)) fail();
    Object.defineProperty(copy, key, {
      configurable: true,
      enumerable: true,
      writable: true,
      value: snapshot(dataDescriptor(value, key), seen),
    });
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
