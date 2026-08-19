import path from "node:path";
import { pathToFileURL } from "node:url";

// A mutation harness copies a module out of its own directory so it can run a modified version of it.
// The copy's relative imports would then resolve against the temporary directory and fail, so each one
// is rewritten to an absolute file URL anchored at the module's real home. Rewriting every relative
// specifier, rather than the one or two a harness happens to name, is what keeps a new sibling import
// from breaking the harness on the day it is added — the failure that shape produces is a bare
// ERR_MODULE_NOT_FOUND from a temporary path, which says nothing about the harness that caused it.
const RELATIVE_SPECIFIER = /(?<prefix>\bfrom\s*)(?<quote>["'])(?<specifier>\.{1,2}\/[^"']*)\k<quote>/gu;

export function relocateModuleImports(source, moduleDirectory) {
  let rewritten = 0;
  const relocated = source.replace(RELATIVE_SPECIFIER, (match, prefix, quote, specifier) => {
    rewritten += 1;
    return `${prefix}${JSON.stringify(pathToFileURL(path.resolve(moduleDirectory, specifier)).href)}`;
  });
  if (rewritten === 0) throw new Error("Relocated module source declares no relative imports to rewrite.");
  if (/\bfrom\s*["']\.{1,2}\//u.test(relocated)) throw new Error("Relocated module source still declares a relative import.");
  // A dynamic `import("./x")` is not rewritten — the specifier may be built at runtime, and guessing at
  // it would be worse than refusing. None exists today; this is what says so if one appears.
  if (/\bimport\s*\(\s*["']\.{1,2}\//u.test(relocated)) throw new Error("Relocated module source declares a relative dynamic import.");
  return relocated;
}
