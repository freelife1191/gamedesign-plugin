import { readFileSync } from "node:fs";
import path from "node:path";

const SEMVER_NUMBER = "(?:0|[1-9]\\d*)";
const STABLE_SEMVER = `${SEMVER_NUMBER}\\.${SEMVER_NUMBER}\\.${SEMVER_NUMBER}`;
const COMPONENTS = Object.freeze([
  Object.freeze({
    id: "skillstead",
    module: "vendor",
    repository: "https://github.com/kyungseo/skillstead",
    destinationRoot: "skills/svg-infographic",
    tag: new RegExp(`^svg-infographic\\/v(?<version>${STABLE_SEMVER})$`, "u"),
    treeRoot: (version) => `svg-infographic/${version}`,
  }),
  Object.freeze({
    id: "archify",
    module: "archify",
    repository: "https://github.com/tt-a1i/archify",
    destinationRoot: "skills/archify",
    tag: new RegExp(`^v(?<version>${STABLE_SEMVER})$`, "u"),
    treeRoot: (version) => `archify/${version}`,
  }),
  Object.freeze({
    id: "im-not-ai",
    module: "im-not-ai",
    repository: "https://github.com/epoko77-ai/im-not-ai",
    destinationRoot: "skills/humanize-korean",
    tag: new RegExp(`^v(?<version>${STABLE_SEMVER})$`, "u"),
    treeRoot: (version) => `humanize-korean/v${version}`,
  }),
]);

function componentError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function lockPath(repoRoot, component) {
  return path.join(repoRoot, "shared", "vendor", component.id, "vendor.lock.json");
}

function parseLock(repoRoot, component) {
  try {
    return JSON.parse(readFileSync(lockPath(repoRoot, component), "utf8"));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw componentError("VENDOR_COMPONENT_LOCK_INVALID", `${component.id} vendor lock must be valid JSON`);
    }
    throw error;
  }
}

function containedTreeRoot(component, treeRoot) {
  const vendorRoot = path.resolve("/vendor-root", component.id);
  if (typeof treeRoot !== "string" || treeRoot.length === 0 || path.isAbsolute(treeRoot) || treeRoot.includes("\\")) {
    throw componentError("VENDOR_COMPONENT_TREE_ROOT_INVALID", `${component.id} tree root must be contained`);
  }
  const resolved = path.resolve(vendorRoot, treeRoot);
  if (!resolved.startsWith(`${vendorRoot}${path.sep}`)) {
    throw componentError("VENDOR_COMPONENT_TREE_ROOT_INVALID", `${component.id} tree root must be contained`);
  }
  return treeRoot.split(path.sep).join("/");
}

function componentFromLock(repoRoot, component) {
  const lock = parseLock(repoRoot, component);
  if (!lock || typeof lock !== "object" || Array.isArray(lock)) {
    throw componentError("VENDOR_COMPONENT_LOCK_INVALID", `${component.id} vendor lock must be an object`);
  }
  if (lock.upstream?.repository !== component.repository) {
    throw componentError("VENDOR_COMPONENT_REPOSITORY_INVALID", `${component.id} repository must be official`);
  }
  const tag = typeof lock.upstream?.tag === "string" ? lock.upstream.tag.match(component.tag) : null;
  if (!tag) {
    throw componentError("VENDOR_COMPONENT_TAG_INVALID", `${component.id} tag must be stable`);
  }
  if (!/^[a-f0-9]{40}$/u.test(lock.upstream?.commit ?? "")) {
    throw componentError("VENDOR_COMPONENT_COMMIT_INVALID", `${component.id} commit must be a 40-character SHA`);
  }
  const treeRoot = containedTreeRoot(component, lock.tree?.root);
  if (treeRoot !== component.treeRoot(tag.groups.version)) {
    throw componentError("VENDOR_COMPONENT_TREE_ROOT_INVALID", `${component.id} tree root must match its stable tag`);
  }
  return Object.freeze({
    id: component.id,
    repository: component.repository,
    installedTag: lock.upstream.tag,
    commit: lock.upstream.commit,
    sourceRoot: `shared/vendor/${component.id}/${treeRoot}`,
    destinationRoot: component.destinationRoot,
  });
}

export function loadVendorComponents({ repoRoot } = {}) {
  if (typeof repoRoot !== "string" || repoRoot.length === 0) {
    throw new TypeError("repoRoot must be a non-empty path");
  }
  return Object.freeze(COMPONENTS.map((component) => componentFromLock(path.resolve(repoRoot), component)));
}

// The packaging audit reads every shipped byte as UTF-8. A vendored upstream may ship a font or an
// image, and the only trustworthy statement about those files is the vendor lock, which the sync
// verified against the upstream tag. This turns the locks into the register the audit checks them
// against: exact package path, declared size, declared digest. Nothing is registered by directory or
// by guesswork, so a new binary in a future upstream release arrives here automatically, and a text
// file can never reach the lane no matter where it sits.
export const VENDOR_BINARY_EXTENSIONS = Object.freeze([
  ".ttf", ".otf", ".ttc", ".woff", ".woff2",
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico",
  ".pdf",
]);

const binaryExtensions = new Set(VENDOR_BINARY_EXTENSIONS);

export function isVendorBinaryPath(relativePath) {
  const name = relativePath.split("/").at(-1) ?? "";
  const dot = name.lastIndexOf(".");
  return dot > 0 && binaryExtensions.has(name.slice(dot).toLowerCase());
}

// A product that does not bundle a vendor must not carry that vendor's files in its register: the audit
// treats a registered path it never meets as a disagreement and fails. Naming the product reads its
// shared-module list and keeps the register to what the package actually contains.
function productSharedModules(repoRoot, productName) {
  if (productName === undefined) return null;
  const contract = JSON.parse(readFileSync(path.join(repoRoot, "products", productName, "product.json"), "utf8"));
  if (!Array.isArray(contract.sharedModules)) {
    throw componentError("VENDOR_COMPONENT_PRODUCT_INVALID", `${productName} must declare sharedModules`);
  }
  return new Set(contract.sharedModules);
}

export function vendorDestinationRoots({ repoRoot, productName } = {}) {
  const modules = productSharedModules(path.resolve(repoRoot ?? ""), productName);
  return loadVendorComponents({ repoRoot })
    .filter((component) => !modules || modules.has(COMPONENTS.find((candidate) => candidate.id === component.id).module))
    .map((component) => component.destinationRoot)
    .sort();
}

export function packagedBinaryFiles({ repoRoot, productName } = {}) {
  const absoluteRepoRoot = path.resolve(repoRoot ?? "");
  const modules = productSharedModules(absoluteRepoRoot, productName);
  const register = new Map();
  for (const component of loadVendorComponents({ repoRoot })) {
    const definition = COMPONENTS.find((candidate) => candidate.id === component.id);
    if (modules && !modules.has(definition.module)) continue;
    const lock = parseLock(absoluteRepoRoot, definition);
    const files = lock.tree?.files;
    if (!Array.isArray(files)) {
      throw componentError("VENDOR_COMPONENT_LOCK_INVALID", `${component.id} vendor lock must list tree files`);
    }
    for (const file of files) {
      if (!file || typeof file.path !== "string" || !Number.isInteger(file.size) || file.size < 0 || !/^[a-f0-9]{64}$/u.test(file.sha256 ?? "")) {
        throw componentError("VENDOR_COMPONENT_LOCK_INVALID", `${component.id} vendor lock file entry is malformed`);
      }
      if (!isVendorBinaryPath(file.path)) continue;
      register.set(`${component.destinationRoot}/${file.path}`, { size: file.size, sha256: file.sha256 });
    }
  }
  return register;
}

export function vendorMappings({ repoRoot } = {}) {
  const mappings = {};
  for (const component of loadVendorComponents({ repoRoot })) {
    const module = COMPONENTS.find((candidate) => candidate.id === component.id).module;
    mappings[module] = Object.freeze([Object.freeze([component.sourceRoot, component.destinationRoot])]);
  }
  return Object.freeze(mappings);
}
