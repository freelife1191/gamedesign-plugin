import { lstat, readFile } from "node:fs/promises";
import path from "node:path";

import { assertNoSymlinkPath, assertUniqueNormalizedPaths } from "./paths.mjs";

const allowedKeys = new Set([
  "schemaVersion",
  "name",
  "displayName",
  "description",
  "sharedModules",
  "sharedRuntime",
  "sourceRoots",
  "sourceDocuments",
  "sourceDocumentCategories",
]);
const allowedModules = new Set(["knowledge", "templates", "responsible-design", "export", "vendor", "archify", "im-not-ai", "document-quality", "image-assets", "memory"]);
const pluginNamePattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

function requireString(value, label) {
  if (typeof value !== "string" || value.length === 0) throw new Error(`${label} must be a non-empty string`);
}

function validateUniqueStrings(value, label) {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  const seen = new Set();
  for (const item of value) {
    requireString(item, label);
    const normalized = item.normalize("NFC");
    if (seen.has(normalized)) throw new Error(`Duplicate normalized value in ${label}: ${normalized}`);
    seen.add(normalized);
  }
  return [...seen];
}

export function validateProductContract(product) {
  if (product === null || typeof product !== "object" || Array.isArray(product)) {
    throw new Error("Product contract must be an object");
  }
  for (const key of Object.keys(product)) {
    if (!allowedKeys.has(key)) throw new Error(`Unknown product key: ${key}`);
  }
  if (product.schemaVersion !== 1) throw new Error("schemaVersion must be 1");
  if (typeof product.name !== "string" || !pluginNamePattern.test(product.name)) {
    throw new Error(`Invalid plugin name: ${String(product.name)}`);
  }
  requireString(product.displayName, "displayName");
  requireString(product.description, "description");
  if (!Array.isArray(product.sharedModules)) throw new Error("sharedModules must be an array");
  const sharedModules = validateUniqueStrings(product.sharedModules, "sharedModules");
  for (const moduleName of sharedModules) {
    if (!allowedModules.has(moduleName)) throw new Error(`Unknown shared module: ${moduleName}`);
  }
  if (product.sharedRuntime !== true) throw new Error("sharedRuntime must be true");
  if (!Array.isArray(product.sourceRoots) || product.sourceRoots.length === 0) {
    throw new Error("sourceRoots must be a non-empty array");
  }
  const sourceRoots = assertUniqueNormalizedPaths(product.sourceRoots, "sourceRoots");

  const hasDocuments = Object.hasOwn(product, "sourceDocuments");
  const hasCategories = Object.hasOwn(product, "sourceDocumentCategories");
  if (hasDocuments === hasCategories) {
    throw new Error("Exactly one of sourceDocuments or sourceDocumentCategories is required");
  }
  const sourceDocuments = hasDocuments ? validateUniqueStrings(product.sourceDocuments, "sourceDocuments") : undefined;
  const sourceDocumentCategories = hasCategories
    ? validateUniqueStrings(product.sourceDocumentCategories, "sourceDocumentCategories")
    : undefined;

  return {
    ...product,
    name: product.name.normalize("NFC"),
    sharedModules,
    sourceRoots,
    ...(hasDocuments ? { sourceDocuments } : { sourceDocumentCategories }),
  };
}

export async function loadProductContract({ repoRoot, productName }) {
  if (typeof productName !== "string" || !pluginNamePattern.test(productName)) {
    throw new Error(`Invalid plugin name: ${String(productName)}`);
  }
  const productPath = path.join(path.resolve(repoRoot), "products", productName, "product.json");
  await assertNoSymlinkPath(repoRoot, `products/${productName}/product.json`, "product contract");
  const stats = await lstat(productPath).catch((error) => {
    if (error.code === "ENOENT") throw new Error(`Missing product contract: products/${productName}/product.json`);
    throw error;
  });
  if (stats.isSymbolicLink()) throw new Error(`Symlink is not allowed: products/${productName}/product.json`);
  if (!stats.isFile()) throw new Error(`Product contract is not a file: products/${productName}/product.json`);

  let parsed;
  try {
    parsed = JSON.parse(await readFile(productPath, "utf8"));
  } catch (error) {
    throw new Error(`Invalid product JSON: ${error.message}`, { cause: error });
  }
  const product = validateProductContract(parsed);
  if (product.name !== productName) {
    throw new Error(`Product name mismatch: expected ${productName}, received ${product.name}`);
  }
  return product;
}
