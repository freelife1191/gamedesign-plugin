import { types } from "node:util";

const forbiddenControlPattern = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/u;
const forbiddenBidiPattern = /[\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069]/u;
const unpairedSurrogatePattern = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u;

function assertSafeString(value, label) {
  if (value !== value.normalize("NFC")) throw new Error(`${label} failed Unicode NFC normalization`);
  if (forbiddenControlPattern.test(value)) throw new Error(`${label} contains a forbidden control character`);
  if (forbiddenBidiPattern.test(value)) throw new Error(`${label} contains a forbidden bidirectional control character`);
  if (unpairedSurrogatePattern.test(value)) throw new Error(`${label} contains an unpaired surrogate`);
}

export function snapshotDataOnly(value, label = "public input") {
  const seen = new WeakSet();

  function capture(current, currentLabel) {
    if (current === null || typeof current === "boolean") return current;
    if (typeof current === "string") {
      assertSafeString(current, currentLabel);
      return current;
    }
    if (typeof current === "number") {
      if (!Number.isFinite(current)) throw new Error(`${currentLabel} must be a finite number`);
      return current;
    }
    if (typeof current !== "object") throw new Error(`${currentLabel} must contain data only`);
    if (types.isProxy(current)) throw new Error(`${currentLabel} must not be a Proxy`);
    if (seen.has(current)) throw new Error(`${currentLabel} contains a cycle or repeated object reference`);
    seen.add(current);

    const isArray = Array.isArray(current);
    const prototype = Object.getPrototypeOf(current);
    if ((!isArray && prototype !== Object.prototype) || (isArray && prototype !== Array.prototype)) {
      throw new Error(`${currentLabel} must use a standard data-only prototype`);
    }
    const ownKeys = Reflect.ownKeys(current);
    if (ownKeys.some((key) => typeof key === "symbol")) throw new Error(`${currentLabel} must not contain symbol keys`);
    const descriptors = Object.getOwnPropertyDescriptors(current);

    if (isArray) {
      if (current.length > 100_000) throw new Error(`${currentLabel} exceeds the data-only array limit`);
      const expectedNames = Array.from({ length: current.length }, (_, index) => String(index));
      const actualNames = ownKeys.filter((key) => key !== "length");
      if (actualNames.length !== expectedNames.length || actualNames.some((key, index) => key !== expectedNames[index])) {
        throw new Error(`${currentLabel} must be a dense data-only array`);
      }
      const result = [];
      for (let index = 0; index < current.length; index += 1) {
        const descriptor = descriptors[index];
        if (!descriptor || descriptor.get || descriptor.set || descriptor.enumerable !== true || !("value" in descriptor)) {
          throw new Error(`${currentLabel}[${index}] must not be an accessor or non-enumerable property`);
        }
        result.push(capture(descriptor.value, `${currentLabel}[${index}]`));
      }
      return result;
    }

    const result = {};
    for (const key of ownKeys) {
      const descriptor = descriptors[key];
      if (!descriptor || descriptor.get || descriptor.set || descriptor.enumerable !== true || !("value" in descriptor)) {
        throw new Error(`${currentLabel}.${key} must not be an accessor or non-enumerable property`);
      }
      Object.defineProperty(result, key, {
        value: capture(descriptor.value, `${currentLabel}.${key}`),
        enumerable: true,
        configurable: true,
        writable: true,
      });
    }
    return result;
  }

  return capture(value, label);
}
