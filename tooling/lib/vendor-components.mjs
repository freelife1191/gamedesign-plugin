import { readFileSync } from "node:fs";
import path from "node:path";

const COMPONENTS = Object.freeze([
  Object.freeze({
    id: "skillstead",
    module: "vendor",
    repository: "https://github.com/kyungseo/skillstead",
    destinationRoot: "skills/svg-infographic",
    tag: /^svg-infographic\/v(?<version>\d+\.\d+\.\d+)$/u,
    treeRoot: (version) => `svg-infographic/${version}`,
  }),
  Object.freeze({
    id: "archify",
    module: "archify",
    repository: "https://github.com/tt-a1i/archify",
    destinationRoot: "skills/archify",
    tag: /^v(?<version>\d+\.\d+\.\d+)$/u,
    treeRoot: (version) => `archify/${version}`,
  }),
  Object.freeze({
    id: "im-not-ai",
    module: "im-not-ai",
    repository: "https://github.com/epoko77-ai/im-not-ai",
    destinationRoot: "skills/humanize-korean",
    tag: /^v(?<version>\d+\.\d+\.\d+)$/u,
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

export function vendorMappings({ repoRoot } = {}) {
  const mappings = {};
  for (const component of loadVendorComponents({ repoRoot })) {
    const module = COMPONENTS.find((candidate) => candidate.id === component.id).module;
    mappings[module] = Object.freeze([Object.freeze([component.sourceRoot, component.destinationRoot])]);
  }
  return Object.freeze(mappings);
}
