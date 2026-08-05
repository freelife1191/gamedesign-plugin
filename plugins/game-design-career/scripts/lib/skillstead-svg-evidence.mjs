import { spawnSync } from "node:child_process";
import { lstat, readdir, realpath } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const WRAPPER_PATHS = Object.freeze([
  "skills/visualize-career-roadmap/scripts/run-skillstead.mjs",
  "skills/visualize-game-design/scripts/run-skillstead.mjs",
]);

function inside(root, target) {
  const relative = path.relative(root, target);
  return relative !== "" && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

async function canonicalRegularFile(root, relativePath) {
  const absoluteRoot = path.resolve(root);
  const absolutePath = path.resolve(absoluteRoot, ...relativePath.split("/"));
  if (!inside(absoluteRoot, absolutePath)) return null;
  let cursor = absoluteRoot;
  try {
    if ((await lstat(cursor)).isSymbolicLink()) return null;
    for (const part of relativePath.split("/")) {
      cursor = path.join(cursor, part);
      if ((await lstat(cursor)).isSymbolicLink()) return null;
    }
    const canonicalRoot = await realpath(absoluteRoot);
    const canonicalPath = await realpath(absolutePath);
    if (!inside(canonicalRoot, canonicalPath)) return null;
    return (await lstat(canonicalPath)).isFile() ? canonicalPath : null;
  } catch {
    return null;
  }
}

async function resolveOneProductWrapper(pluginRoot) {
  const wrappers = (await Promise.all(WRAPPER_PATHS.map(async (relativePath) => ({
    relativePath,
    wrapperPath: await canonicalRegularFile(pluginRoot, relativePath),
  })))).filter(({ wrapperPath }) => wrapperPath !== null);
  if (wrappers.length !== 1) {
    throw new Error("Exactly one canonical product-owned Skillstead wrapper is required");
  }
  return { pluginRoot: path.resolve(pluginRoot), ...wrappers[0] };
}

function sourceCheckoutPluginRoots(runtimeModulePath) {
  const moduleDirectory = path.dirname(runtimeModulePath);
  if (path.basename(moduleDirectory) !== "scripts" || path.basename(path.dirname(moduleDirectory)) !== "shared") return null;
  const repositoryRoot = path.resolve(moduleDirectory, "../..");
  return readdir(path.join(repositoryRoot, "products"), { withFileTypes: true }).then((entries) => {
    const roots = entries.filter((entry) => entry.isDirectory()).map((entry) => path.join(repositoryRoot, "products", entry.name, "plugin"));
    if (roots.length !== 2) throw new Error("Source checkout must contain exactly two product plugin roots");
    return roots.sort((left, right) => left.localeCompare(right));
  });
}

export async function resolveApprovedSkillsteadWrappers({ runtimeModulePath, pluginRoot } = {}) {
  if (pluginRoot !== undefined) {
    if (typeof pluginRoot !== "string" || pluginRoot.length === 0) throw new TypeError("pluginRoot must be a nonempty path");
    return [await resolveOneProductWrapper(pluginRoot)];
  }
  if (typeof runtimeModulePath !== "string" || runtimeModulePath.length === 0 || !path.isAbsolute(runtimeModulePath)) {
    throw new TypeError("runtimeModulePath must be an absolute module path");
  }
  const sourceRoots = sourceCheckoutPluginRoots(runtimeModulePath);
  if (sourceRoots) return Promise.all((await sourceRoots).map(resolveOneProductWrapper));
  return [await resolveOneProductWrapper(path.dirname(path.dirname(runtimeModulePath)))];
}

export async function lintWithApprovedSkillstead(svgPath, {
  runtimeModulePath,
  wrapperPath,
  spawnFn = spawnSync,
} = {}) {
  if (typeof svgPath !== "string" || svgPath.length === 0 || typeof spawnFn !== "function") {
    throw new TypeError("SVG path and spawnFn are required");
  }
  const wrappers = await resolveApprovedSkillsteadWrappers({ runtimeModulePath });
  const selected = wrapperPath === undefined
    ? wrappers
    : wrappers.filter((candidate) => candidate.wrapperPath === wrapperPath);
  if (selected.length !== (wrapperPath === undefined ? wrappers.length : 1)) {
    throw new Error("Skillstead wrapper must be a canonical approved product wrapper");
  }
  for (const wrapper of selected) {
    const result = spawnFn(process.execPath, [wrapper.wrapperPath, "lint", svgPath], {
      encoding: "utf8",
      cwd: path.dirname(wrapper.wrapperPath),
    });
    if (result?.error || result?.status !== 0) return { ok: false };
  }
  return { ok: true };
}
