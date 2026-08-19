#!/usr/bin/env node

// Product-facing documents state the vendored upstream versions in prose, and until now every upstream
// bump meant finding those literals by hand across six files. Here the vendor locks are the source and
// the documents are written from them, so a bump moves one place and `--check` refuses to let the rest
// drift behind it.

import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

import { removeSourceOnlySkillsteadFallback } from "./lib/build-product.mjs";

export const repoRoot = fileURLToPath(new URL("..", import.meta.url));

const PRODUCTS = Object.freeze(["game-design-studio", "game-design-career"]);
const POLISH_SKILL = "skills/polish-game-design-writing/SKILL.md";

function referenceError(code, target) {
  const error = new Error(`${code}: ${target}`);
  error.code = code;
  error.path = target;
  return error;
}

function versionOf(tag) {
  const version = tag.split("/").at(-1).replace(/^v/u, "");
  if (!/^\d+\.\d+\.\d+$/u.test(version)) throw referenceError("VENDOR_REFERENCE_TAG_INVALID", tag);
  return version;
}

async function readLock(root, name) {
  const lock = JSON.parse(await readFile(path.join(root, "shared/vendor", name, "vendor.lock.json"), "utf8"));
  const tag = lock?.upstream?.tag;
  const commit = lock?.upstream?.commit;
  const files = lock?.tree?.files;
  if (typeof tag !== "string" || !/^[a-f0-9]{40}$/u.test(commit ?? "")) throw referenceError("VENDOR_REFERENCE_LOCK_INVALID", name);
  if (!Array.isArray(files) || files.length === 0) throw referenceError("VENDOR_REFERENCE_LOCK_INVALID", name);
  return { tag, commit, version: versionOf(tag), pathCount: files.length };
}

const ROOT_README = "README.md";
const SHARED_CONTRACTS_README = "shared/contracts/README.md";
const CAPABILITY_PROBE = "shared/scripts/capability-probe.mjs";
const ARCHITECTURE_SUITE = "architecture/plugin-suite.md";
const ARCHITECTURE_KNOWLEDGE = "architecture/knowledge-and-evidence.md";
const SKILLSTEAD_GUIDES = Object.freeze(PRODUCTS.map((product) => `guides/${product}/skills/svg-infographic.md`));
const DIAGRAM_MANIFEST = "guides/assets/diagram-manifest.json";
const ARCHIFY_CATALOG = "guides/archify-diagrams/catalog.json";
const STUDIO_VALIDATOR = "products/game-design-studio/plugin/skills/visualize-game-design/scripts/validate-visualization-evidence.mjs";
const STUDIO_WRAPPER = Object.freeze({
  product: "game-design-studio",
  source: "products/game-design-studio/plugin/skills/visualize-game-design/scripts/run-skillstead.mjs",
  relativePath: "skills/visualize-game-design/scripts/run-skillstead.mjs",
});

async function sha256Of(file) {
  return createHash("sha256").update(await readFile(file)).digest("hex");
}

// The Studio visualization validator refuses an injected test runtime whose bytes are not the packaged
// ones. Two of those three digests are Skillstead's own scripts, so they move with every upstream bump;
// the third is the packaged wrapper. Deriving all three here means the bump does not leave a validator
// pinning a runtime that no longer exists.
async function runtimeDigests(root, skillstead) {
  const treeRoot = `svg-infographic/${skillstead.version}`;
  const scripts = path.join(root, "shared/vendor/skillstead", treeRoot, "scripts");
  const [linter, renderer] = await Promise.all([
    sha256Of(path.join(scripts, "check-svg.mjs")),
    sha256Of(path.join(scripts, "render.mjs")),
  ]);
  // The packaged wrapper is the product source with its repository-only regions cut, which is exactly
  // what the build does to it. Applying the same transform here rather than reading the built package
  // keeps this out of a cycle: the digest feeds a file the build then packages.
  const packaged = removeSourceOnlySkillsteadFallback(
    { relativePath: STUDIO_WRAPPER.relativePath, bytes: await readFile(path.join(root, STUDIO_WRAPPER.source)) },
    STUDIO_WRAPPER.product,
    `shared/vendor/skillstead/${treeRoot}`,
  );
  return { linter, renderer, wrapper: createHash("sha256").update(packaged.bytes).digest("hex") };
}

export async function vendorReferenceState({ root = repoRoot } = {}) {
  const [skillstead, archify, imNotAi] = await Promise.all(["skillstead", "archify", "im-not-ai"].map((name) => readLock(root, name)));
  return { skillstead, archify, imNotAi, runtime: await runtimeDigests(root, skillstead) };
}

// Each rule names one line shape in one file. A rule that matches nothing is a defect, not a no-op: the
// document was restructured and the pin it used to carry is gone, so the run fails rather than
// reporting a clean sync over a document that no longer states a version at all.
function rulesFor(state) {
  const rules = [];
  for (const product of PRODUCTS) {
    const notices = `products/${product}/plugin/THIRD_PARTY_NOTICES.md`;
    rules.push(
      {
        file: notices,
        find: /^- Version: \d+\.\d+\.\d+ \(`svg-infographic\/v\d+\.\d+\.\d+`, `[a-f0-9]{40}`\)$/mu,
        write: `- Version: ${state.skillstead.version} (\`${state.skillstead.tag}\`, \`${state.skillstead.commit}\`)`,
      },
      {
        file: notices,
        find: /^- Version: \d+\.\d+\.\d+ \(`v\d+\.\d+\.\d+`, `[a-f0-9]{40}`\)$/mu,
        write: `- Version: ${state.archify.version} (\`${state.archify.tag}\`, \`${state.archify.commit}\`)`,
      },
      {
        file: notices,
        find: /^- Version: `v\d+\.\d+\.\d+` \(`[a-f0-9]{40}`\)$/mu,
        write: `- Version: \`${state.imNotAi.tag}\` (\`${state.imNotAi.commit}\`)`,
      },
      {
        file: `products/${product}/plugin/README.md`,
        find: /# vendored Archify \d+\.\d+\.\d+$/mu,
        write: `# vendored Archify ${state.archify.version}`,
      },
      {
        file: `products/${product}/plugin/README.md`,
        find: /# vendored Skillstead \d+\.\d+\.\d+$/mu,
        write: `# vendored Skillstead ${state.skillstead.version}`,
      },
      {
        file: `products/${product}/plugin/README.md`,
        all: true,
        find: /Skillstead `svg-infographic` \d+\.\d+\.\d+/gu,
        writeFor: () => `Skillstead \`svg-infographic\` ${state.skillstead.version}`,
      },
      {
        file: `products/${product}/plugin/${POLISH_SKILL}`,
        find: /"source": "bundled-im-not-ai-v\d+\.\d+\.\d+"/u,
        write: `"source": "bundled-im-not-ai-${state.imNotAi.tag}"`,
      },
    );
  }
  // The suite README names the bundled Skillstead release in the two skill tables, and the shared
  // contract README and the guide diagram manifest each pin it once more. None of these are generated,
  // so without a rule they lag a bump silently and tell a reader the wrong version.
  rules.push(
    {
      file: ROOT_README,
      all: true,
      find: /Skillstead \d+\.\d+\.\d+에서 번들된/gu,
      writeFor: () => `Skillstead ${state.skillstead.version}에서 번들된`,
    },
    {
      file: DIAGRAM_MANIFEST,
      find: /^  "skillsteadVersion": "\d+\.\d+\.\d+",$/mu,
      write: `  "skillsteadVersion": "${state.skillstead.version}",`,
    },
    {
      file: STUDIO_VALIDATOR,
      find: /^const LINTER_VERSION = "\d+\.\d+\.\d+";$/mu,
      write: `const LINTER_VERSION = "${state.skillstead.version}";`,
    },
  );
  // The architecture notes, the two Skillstead guide pages, the shared contract and the capability probe
  // each describe the bundled renderer in the present tense. Before these rules existed the three of them
  // had drifted to three different versions — 0.8.3, 0.9.0 and the real one — so a reader was told the
  // package carries a renderer it has not carried for two releases.
  rules.push(
    {
      file: ARCHITECTURE_KNOWLEDGE,
      all: true,
      find: /Skillstead `svg-infographic` \d+\.\d+\.\d+/gu,
      writeFor: () => `Skillstead \`svg-infographic\` ${state.skillstead.version}`,
    },
    {
      file: ARCHITECTURE_SUITE,
      all: true,
      find: /Skillstead \d+\.\d+\.\d+/gu,
      writeFor: () => `Skillstead ${state.skillstead.version}`,
    },
    ...[...SKILLSTEAD_GUIDES, SHARED_CONTRACTS_README, CAPABILITY_PROBE].map((file) => ({
      file,
      all: true,
      find: /vendored Skillstead \d+\.\d+\.\d+/gu,
      writeFor: () => `vendored Skillstead ${state.skillstead.version}`,
    })),
    // The reserved-destination clause promises the packaged skill tree equals the lock exactly. That
    // promise is only checkable if the number it quotes is the lock's own path count.
    {
      file: SHARED_CONTRACTS_README,
      find: /Skillstead lock의 \d+개 path/u,
      write: `Skillstead lock의 ${state.skillstead.pathCount}개 path`,
    },
  );
  // The Archify diagram catalog cites the vendored trees by path, and those paths carry the version. One
  // prefix rule rewrites every citation at once rather than naming each of the thirty-odd lines, and it
  // covers all three vendors so a citation that appears later is corrected without a new rule.
  const treeRoots = {
    skillstead: `svg-infographic/${state.skillstead.version}`,
    archify: `archify/${state.archify.version}`,
    "im-not-ai": `humanize-korean/${state.imNotAi.tag}`,
  };
  const vendorPathWrite = (match) => `shared/vendor/${match[1]}/${treeRoots[match[1]]}/`;
  rules.push(
    {
      file: ARCHIFY_CATALOG,
      all: true,
      find: /shared\/vendor\/(skillstead|archify|im-not-ai)\/[^"/]+\/v?\d+\.\d+\.\d+\//gu,
      writeFor: vendorPathWrite,
    },
    {
      file: SHARED_CONTRACTS_README,
      all: true,
      find: /shared\/vendor\/(skillstead|archify|im-not-ai)\/[^`/]+\/v?\d+\.\d+\.\d+\//gu,
      writeFor: vendorPathWrite,
    },
  );
  for (const [name, digest] of Object.entries(state.runtime)) {
    rules.push({
      file: STUDIO_VALIDATOR,
      find: new RegExp(`^  ${name}: "[a-f0-9]{64}",$`, "mu"),
      write: `  ${name}: "${digest}",`,
    });
  }
  return rules;
}

// The Archify catalog records a decision per Markdown document and pins the digest it decided against.
// Documents this tool writes change their digest whenever a lock moves, so the catalog has to follow the
// same source of truth rather than being re-transcribed by hand. Exposing the rule targets keeps the two
// tools reading one list instead of two that can disagree.
export async function vendorReferenceFiles({ root = repoRoot, state } = {}) {
  const resolved = state ?? await vendorReferenceState({ root });
  return [...new Set(rulesFor(resolved).map((rule) => rule.file))].sort();
}

export async function syncVendorReferences({ root = repoRoot, check = false, state } = {}) {
  const resolved = state ?? await vendorReferenceState({ root });
  const rules = rulesFor(resolved);
  const contents = new Map();
  const drifted = [];
  for (const rule of rules) {
    const absolute = path.join(root, rule.file);
    if (!contents.has(rule.file)) contents.set(rule.file, await readFile(absolute, "utf8"));
    const before = contents.get(rule.file);
    if (rule.all) {
      const matches = [...before.matchAll(rule.find)];
      if (matches.length === 0) throw referenceError("VENDOR_REFERENCE_ANCHOR_MISSING", `${rule.file}: ${rule.find.source}`);
      const stale = [...new Set(matches.filter((match) => match[0] !== rule.writeFor(match)).map((match) => `${match[0]}\u0000${rule.writeFor(match)}`))];
      if (stale.length === 0) continue;
      for (const pair of stale) {
        const [from, to] = pair.split("\u0000");
        drifted.push({ file: rule.file, from, to });
      }
      contents.set(rule.file, before.replace(rule.find, (...args) => rule.writeFor(args.slice(0, -2))));
      continue;
    }
    const match = rule.find.exec(before);
    if (!match) throw referenceError("VENDOR_REFERENCE_ANCHOR_MISSING", `${rule.file}: ${rule.find.source}`);
    if (match[0] === rule.write) continue;
    drifted.push({ file: rule.file, from: match[0], to: rule.write });
    contents.set(rule.file, `${before.slice(0, match.index)}${rule.write}${before.slice(match.index + match[0].length)}`);
  }
  if (drifted.length === 0) return { status: "current", rules: rules.length, drifted: [] };
  if (check) return { status: "drifted", rules: rules.length, drifted };
  for (const file of new Set(drifted.map(({ file: name }) => name))) {
    await writeFile(path.join(root, file), contents.get(file));
  }
  return { status: "written", rules: rules.length, drifted };
}

export function parseVendorReferenceArgs(args) {
  if (args.length === 0) return { check: false };
  if (args.length === 1 && args[0] === "--check") return { check: true };
  throw new Error("Usage: node tooling/sync-vendor-references.mjs [--check]");
}

async function main() {
  const { check } = parseVendorReferenceArgs(process.argv.slice(2));
  const result = await syncVendorReferences({ check });
  process.stdout.write(`${JSON.stringify(result)}\n`);
  if (result.status === "drifted") {
    for (const { file, from, to } of result.drifted) process.stderr.write(`VENDOR_REFERENCE_DRIFT ${file}\n  have: ${from}\n  want: ${to}\n`);
    process.stderr.write("Run `node tooling/sync-vendor-references.mjs` to rewrite them from the vendor locks.\n");
    process.exitCode = 1;
  }
}

const entry = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (entry && pathToFileURL(entry).href === import.meta.url) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
