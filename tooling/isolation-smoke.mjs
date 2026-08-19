#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { homedir, tmpdir } from "node:os";
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

import { copyTree, collectTree } from "./lib/copy-tree.mjs";
import { buildProduct } from "./lib/build-product.mjs";
import { cleanupGuardedTempRoot, createGuardedTempRoot } from "./lib/guarded-temp.mjs";
import { sha256 } from "./lib/hash.mjs";
import { auditTree } from "./lib/tree-audit.mjs";
import { scanJavaScriptImports } from "./lib/js-import-scanner.mjs";
import { classifyInactiveReferenceIntelligenceSourcePaths, parseReferenceIntelligenceContract, referenceIntelligenceContractLayouts } from "./lib/reference-intelligence-contract.mjs";
import { loadVendorComponents, packagedBinaryFiles, vendorDestinationRoots } from "./lib/vendor-components.mjs";
import { applyVendorDescriptionOverlay, loadVendorDescriptionOverlays } from "./lib/vendor-description-overlay.mjs";

const TEMP_PREFIX = "game-design-isolation-";
const PRODUCT_NAMES = Object.freeze(["game-design-career", "game-design-studio"]);
const EXACT_SKILL_IDS = Object.freeze({
  "game-design-career": Object.freeze([
    "apply-document-quality-profile", "build-game-design-portfolio", "export-career-documents", "generate-image-assets", "humanize-korean",
    "map-game-design-career", "orchestrate-game-design-career", "plan-image-assets", "plan-junior-growth", "polish-game-design-writing",
    "practice-game-design-interview", "research-game-design-jobs", "reverse-engineer-game-design", "review-game-design-portfolio", "review-image-assets",
    "capture-game-design-memory", "maintain-game-design-memory", "retrieve-approved-design-memory",
    "analyze-game-design-references", "maintain-game-design-glossary",
    "svg-infographic", "archify", "visualize-career-roadmap",
    "upgrade-game-design-suite",
    "game-design-career",
  ].sort()),
  "game-design-studio": Object.freeze([
    "apply-document-quality-profile", "define-game-vision", "design-game-content", "design-game-economy-and-liveops", "design-game-systems",
    "design-cutscene-visual-preproduction", "design-player-experience", "export-game-design-documents", "generate-image-assets", "humanize-korean", "orchestrate-game-design-project",
    "plan-game-production", "plan-image-assets", "polish-game-design-writing", "review-game-design", "review-image-assets", "svg-infographic", "archify", "visualize-game-design",
    "capture-game-design-memory", "maintain-game-design-memory", "retrieve-approved-design-memory",
    "analyze-game-design-references", "maintain-game-design-glossary",
    "upgrade-game-design-suite",
    "game-design-studio",
  ].sort()),
});
const EXPECTED_HOOKS = Object.freeze({
  SessionStart: {
    command: 'node "${PLUGIN_ROOT}/scripts/capability-probe.mjs"',
    timeout: 25,
    statusMessage: "Detecting optional game-design and image capabilities",
  },
  Stop: {
    command: 'node "${PLUGIN_ROOT}/scripts/stop-artifact-review.mjs"',
    timeout: 30,
    statusMessage: "Reviewing canonical game-design artifact",
  },
});

function inside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative !== "" && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

async function canonicalDirectory(requested, label) {
  const absolute = path.resolve(requested);
  const stats = await lstat(absolute);
  if (stats.isSymbolicLink()) throw new Error(`${label} is a symlink: ${absolute}`);
  if (!stats.isDirectory()) throw new Error(`${label} is not a directory: ${absolute}`);
  return realpath(absolute);
}

export async function assertSafeTemporaryRoot({ requestedRoot, prefix = TEMP_PREFIX }) {
  if (typeof requestedRoot !== "string" || requestedRoot.length === 0 || typeof prefix !== "string" || prefix.length < 8) {
    throw new Error("unsafe temporary root arguments");
  }
  const absolute = path.resolve(requestedRoot);
  const parsed = path.parse(absolute);
  if (absolute === parsed.root || absolute === path.resolve(tmpdir())) {
    throw new Error(`unsafe temporary root: ${absolute}`);
  }
  const stats = await lstat(absolute);
  if (stats.isSymbolicLink()) throw new Error(`temporary root is a symlink: ${absolute}`);
  if (!stats.isDirectory()) throw new Error(`temporary root is not a directory: ${absolute}`);
  if (!path.basename(absolute).startsWith(prefix)) throw new Error(`unsafe temporary root: ${absolute}`);
  const canonical = await realpath(absolute);
  const canonicalTmp = await realpath(tmpdir());
  if (!inside(canonicalTmp, canonical) || !path.basename(canonical).startsWith(prefix)) {
    throw new Error(`unsafe temporary root: ${canonical}`);
  }
  return canonical;
}

function minimalEnvironment({ root, home, codexHome }) {
  return {
    HOME: home,
    CODEX_HOME: codexHome,
    TMPDIR: root,
    PATH: [path.dirname(process.execPath), "/usr/bin", "/bin"].join(path.delimiter),
  };
}

function runProcess(command, args, options) {
  const result = spawnSync(command, args, { encoding: "utf8", ...options });
  if (result.error) throw new Error(`process spawn failed: ${result.error.message}`);
  if (result.signal) throw new Error(`process terminated by ${result.signal}`);
  if (result.status !== 0) {
    throw new Error(`process exited ${result.status ?? "without status"}: ${result.stdout}${result.stderr}`);
  }
  return result;
}

function exactHookCommand(hooks, eventName) {
  const event = hooks?.hooks?.[eventName];
  if (!Array.isArray(event) || event.length !== 1 || Object.keys(event[0]).length !== 1 || !Array.isArray(event[0].hooks)
      || event[0].hooks.length !== 1) {
    throw new Error(`${eventName} hook contract mismatch`);
  }
  const hook = event[0].hooks[0];
  const expected = EXPECTED_HOOKS[eventName];
  if (!hook || Object.keys(hook).sort().join(",") !== "command,statusMessage,timeout,type"
      || hook.type !== "command" || hook.command !== expected.command || hook.timeout !== expected.timeout
      || hook.statusMessage !== expected.statusMessage) {
    throw new Error(`${eventName} hook contract mismatch`);
  }
  return hook;
}

async function inactiveReferenceIntelligenceSourceRuntimes(pluginRoot) {
  const inactive = [];
  for (const skillId of Object.keys(referenceIntelligenceContractLayouts)) {
    const relativeSkill = `skills/${skillId}/SKILL.md`;
    const skillPath = path.join(pluginRoot, relativeSkill);
    const stats = await lstat(skillPath);
    if (stats.isSymbolicLink() || !stats.isFile()) throw new Error(`${skillId} reference-intelligence skill identity mismatch`);
    const contract = parseReferenceIntelligenceContract(await readFile(skillPath, "utf8"));
    const installedCounterparts = new Set();
    for (const relativePath of Object.values(contract.layouts?.installed ?? {}).flat()) {
      const target = path.resolve(path.dirname(skillPath), relativePath);
      if (!inside(pluginRoot, target)) throw new Error(`${skillId} reference-intelligence installed contract escapes plugin root`);
      const targetStats = await lstat(target);
      if (targetStats.isSymbolicLink() || !targetStats.isFile()) throw new Error(`${skillId} reference-intelligence installed contract target is not a regular file`);
      installedCounterparts.add(target);
    }
    inactive.push(...classifyInactiveReferenceIntelligenceSourcePaths({ packageRoot: pluginRoot, skillPath, contract, installedCounterparts }));
  }
  return inactive;
}

// Every packaged byte of a vendored skill is the upstream byte, with one declared exception: the
// description overlay rewrites one frontmatter field as the build projects SKILL.md, because three
// upstream descriptions run past the router's catalog budget. The overlaid path is therefore checked
// against the source with that same overlay applied rather than against the lock digest, and the lock
// still governs the source it was applied to — `verifyDiagramSkillVendor` is what holds that end.
// Anything the overlay does not name is still compared to the lock byte for byte.
async function overlaidVendorFile({ component, repoRoot: sourceRepoRoot }) {
  const overlay = loadVendorDescriptionOverlays({ repoRoot: sourceRepoRoot }).get(component.module);
  if (!overlay) return null;
  const source = await readFile(path.join(sourceRepoRoot, component.sourceRoot, ...overlay.path.split("/")));
  const { bytes } = applyVendorDescriptionOverlay({ relativePath: overlay.path, bytes: source }, overlay);
  return { path: overlay.path, size: bytes.length, sha256: sha256(bytes) };
}

// The expected file count comes from the repository's vendor lock rather than a literal here, so an
// upstream bump does not have to be transcribed into this gate. What the gate proves is unchanged: the
// installed package carries exactly the closure the source lock declares, with nothing added or lost.
async function verifyVendor(pluginRoot, { component, repoRoot: sourceRepoRoot }) {
  const { id: name, destinationRoot, installedTag: tag, sourceRoot } = component;
  const skillId = path.posix.basename(destinationRoot);
  const treeRoot = sourceRoot.slice(`shared/vendor/${name}/`.length);
  const files = JSON.parse(await readFile(path.join(sourceRepoRoot, "shared/vendor", name, "vendor.lock.json"), "utf8")).tree.files.length;
  const lock = JSON.parse(await readFile(path.join(pluginRoot, `references/shared/vendor/${name}/vendor.lock.json`), "utf8"));
  if (lock?.upstream?.tag !== tag || lock?.tree?.root !== treeRoot || !Array.isArray(lock.tree.files)) {
    throw new Error(`${name} package-local vendor lock mismatch`);
  }
  const overlaid = await overlaidVendorFile({ component, repoRoot: sourceRepoRoot });
  const entries = await collectTree(path.join(pluginRoot, "skills", skillId), { label: `isolated ${name} skill` });
  const actual = new Map(entries.map((entry) => [entry.relativePath, entry.bytes]));
  if (lock.tree.files.length !== files || actual.size !== files) throw new Error(`${name} vendor file count mismatch: ${lock.tree.files.length}/${actual.size}`);
  for (const locked of lock.tree.files) {
    const expected = overlaid && overlaid.path === locked.path ? overlaid : locked;
    const bytes = actual.get(locked.path);
    if (!bytes) throw new Error(`missing vendored file: ${locked.path}`);
    if (bytes.length !== expected.size || sha256(bytes) !== expected.sha256) {
      throw new Error(`modified vendored file: ${locked.path}`);
    }
  }
  if ([...actual.keys()].some((relative) => !lock.tree.files.some(({ path: locked }) => locked === relative))) {
    throw new Error("unexpected vendored file");
  }
  return { name, files: actual.size };
}

async function verifyReferenceIntelligencePackage(pluginRoot, repoRoot, productName) {
  const expected = [];
  for (const [sourceRelative, destinationPrefix] of [
    ["shared/reference-intelligence/skills", "skills"],
    ["shared/reference-intelligence/schema", "references/shared/reference-intelligence/schema"],
    ["shared/reference-intelligence/catalog", "references/shared/reference-intelligence/catalog"],
    ["shared/reference-intelligence/references", "references/shared/reference-intelligence/references"],
    ["shared/reference-intelligence/templates", "references/shared/reference-intelligence/templates"],
  ]) {
    for (const entry of await collectTree(path.join(repoRoot, sourceRelative), { label: `${productName} reference-intelligence source` })) {
      expected.push({ bytes: entry.bytes, relativePath: `${destinationPrefix}/${entry.relativePath}` });
    }
  }
  const actual = [];
  for (const destinationRoot of [
    "references/shared/reference-intelligence/schema",
    "references/shared/reference-intelligence/catalog",
    "references/shared/reference-intelligence/references",
    "references/shared/reference-intelligence/templates",
  ]) {
    for (const entry of await collectTree(path.join(pluginRoot, destinationRoot), { label: `${productName} reference-intelligence package` })) {
      actual.push({ ...entry, relativePath: `${destinationRoot}/${entry.relativePath}` });
    }
  }
  for (const skillId of ["analyze-game-design-references", "maintain-game-design-glossary"]) {
    for (const entry of await collectTree(path.join(pluginRoot, "skills", skillId), { label: `${productName} ${skillId} package skill` })) {
      actual.push({ ...entry, relativePath: `skills/${skillId}/${entry.relativePath}` });
    }
  }
  assertExactReferenceFiles(actual, expected, productName);
}

async function addBuiltReferenceIntelligencePackage({ buildRoot, pluginRoot, productName }) {
  const entries = (await collectTree(buildRoot, { label: `${productName} reference-intelligence fixture build` })).filter(({ relativePath }) =>
    relativePath.startsWith("references/shared/reference-intelligence/")
    || relativePath.startsWith("skills/analyze-game-design-references/")
    || relativePath.startsWith("skills/maintain-game-design-glossary/"),
  );
  const runtimeEntries = await collectReferenceRuntimeEntries(buildRoot);
  const byPath = new Map([...entries, ...runtimeEntries].map((entry) => [entry.relativePath, entry]));
  for (const entry of byPath.values()) {
    const destination = path.join(pluginRoot, entry.relativePath);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, entry.bytes);
  }
}

async function collectReferenceRuntimeEntries(buildRoot) {
  const pending = [
    path.join(buildRoot, "scripts/analyze-game-design-references.mjs"),
    path.join(buildRoot, "scripts/manage-game-design-glossary.mjs"),
    path.join(buildRoot, "scripts/validate-game-design-writing-language.mjs"),
    path.join(buildRoot, "scripts/validate-reference-intelligence.mjs"),
  ];
  const entries = [];
  const seen = new Set();
  while (pending.length) {
    const current = pending.pop();
    if (seen.has(current)) continue;
    const relativePath = path.relative(buildRoot, current).split(path.sep).join("/");
    if (!relativePath.startsWith("scripts/") || path.isAbsolute(relativePath) || relativePath.includes("..")) throw new Error(`reference runtime escapes fixture build: ${current}`);
    const stats = await lstat(current);
    if (stats.isSymbolicLink() || !stats.isFile()) throw new Error(`reference runtime is not a regular file: ${relativePath}`);
    const bytes = await readFile(current);
    const source = bytes.toString("utf8");
    entries.push({ bytes, relativePath });
    seen.add(current);
    const scanned = scanJavaScriptImports(source);
    if (scanned.errors.length > 0) throw new Error(`reference runtime has an unresolved dynamic import: ${relativePath}`);
    const specifiers = scanned.specifiers.map(({ specifier }) => specifier);
    for (const specifier of specifiers) {
      if (specifier.startsWith("node:")) continue;
      if (!specifier.startsWith(".")) throw new Error(`reference runtime uses a non-Node bare specifier: ${specifier}`);
      pending.push(path.resolve(path.dirname(current), specifier));
    }
  }
  return entries;
}

function assertExactReferenceFiles(actual, expected, productName) {
  assert.equal(actual.length, expected.length, `${productName} reference-intelligence source inventory count`);
  assert.deepEqual(actual.map(({ relativePath }) => relativePath).sort(), expected.map(({ relativePath }) => relativePath).sort(), `${productName} reference-intelligence package inventory`);
  for (const { relativePath, bytes } of expected) {
    const packaged = actual.find((entry) => entry.relativePath === relativePath);
    if (!packaged || !packaged.bytes.equals(bytes)) throw new Error(`${productName} reference-intelligence package bytes mismatch: ${relativePath}`);
  }
}

// The official validator is written by a Codex installation, not shipped in this repository, so a
// machine without Codex has no way to run it. Callers that already account for that absence elsewhere
// pass allowMissing and get null; everyone else still gets the hard failure, because silently not
// validating a package is the failure mode this whole smoke exists to prevent.
async function officialValidatorPath({ allowMissing = false } = {}) {
  const codexHome = process.env.CODEX_HOME ? path.resolve(process.env.CODEX_HOME) : path.join(homedir(), ".codex");
  const validator = path.join(codexHome, "skills/.system/plugin-creator/scripts/validate_plugin.py");
  const stats = await lstat(validator).catch(() => null);
  if (!stats?.isFile() || stats.isSymbolicLink()) {
    if (allowMissing) return null;
    throw new Error(`official plugin validator unavailable: ${validator}`);
  }
  return realpath(validator);
}

async function discoverPython() {
  for (const candidate of ["/opt/homebrew/bin/python3", "/usr/local/bin/python3", "/usr/bin/python3"]) {
    const stats = await lstat(candidate).catch(() => null);
    if (stats?.isFile() || stats?.isSymbolicLink()) {
      const canonical = await realpath(candidate);
      if ((await lstat(canonical)).isFile()) return canonical;
    }
  }
  throw new Error("python3 unavailable for official plugin validation");
}

async function verifyOne({ repoRoot, productName, isolationRoot, mutateCopy, actualHome, allowMissingOfficialValidator }) {
  const build = await buildProduct({
    repoRoot,
    productName,
    stagingRoot: path.join(isolationRoot, "build"),
    sourceDateEpoch: 0,
  });
  const source = path.join(repoRoot, "plugins", productName);
  await canonicalDirectory(source, `${productName} source`);
  const pluginRoot = path.join(isolationRoot, "package", productName);
  await mkdir(pluginRoot, { recursive: true });
  await copyTree(source, pluginRoot, { label: `${productName} isolated extraction` });
  await addBuiltReferenceIntelligencePackage({ buildRoot: build.outputDir, pluginRoot, productName });
  await mutateCopy?.({ pluginRoot, productName, actualHome });

  const manifest = JSON.parse(await readFile(path.join(pluginRoot, ".codex-plugin/plugin.json"), "utf8"));
  if (manifest.name !== productName || manifest.version !== "0.2.0" || manifest.skills !== "./skills/") {
    throw new Error(`${productName} manifest mismatch`);
  }
  const skillEntries = await readdir(path.join(pluginRoot, "skills"), { withFileTypes: true });
  const skills = skillEntries.filter((entry) => entry.isDirectory()).map(({ name }) => name).sort();
  if (JSON.stringify(skills) !== JSON.stringify(EXACT_SKILL_IDS[productName])) throw new Error(`${productName} exact skill IDs mismatch: ${skills.join(",")}`);
  for (const skill of skills) await lstat(path.join(pluginRoot, "skills", skill, "SKILL.md"));
  const inactiveSourceRuntimes = await inactiveReferenceIntelligenceSourceRuntimes(pluginRoot);
  const inactiveSourceRuntimeTuples = new Set(inactiveSourceRuntimes.map(({ tuple }) => tuple));
  if (inactiveSourceRuntimeTuples.size !== 3) throw new Error("reference-intelligence inactive source tuple contract mismatch");
  await verifyReferenceIntelligencePackage(pluginRoot, repoRoot, productName);
  const sibling = PRODUCT_NAMES.find((name) => name !== productName);
  // pluginRoot is a copy under tmpdir(), so the case-fold half of the audit's path-collision gate
  // only fires where tmpdir() is case-sensitive. On macOS and Windows the copy above collapses a
  // colliding pair before auditTree ever sees it, which makes the Linux CI lane the one that
  // enforces this gate. Keep that lane green rather than trusting a local run.
  const audit = await auditTree({
    root: pluginRoot,
    packageName: productName,
    siblingNames: [sibling],
    forbiddenAbsolutePaths: [repoRoot, actualHome, process.env.CODEX_HOME ?? path.join(actualHome, ".codex")],
    inactiveRelativeReferenceTuples: inactiveSourceRuntimeTuples,
    binaryFiles: packagedBinaryFiles({ repoRoot, productName }),
    vendorRoots: vendorDestinationRoots({ repoRoot, productName }),
  });
  if (JSON.stringify(audit.usedInactiveRelativeReferenceTuples) !== JSON.stringify([...inactiveSourceRuntimeTuples].sort())) {
    throw new Error("reference-intelligence inactive source tuple consumption mismatch");
  }

  const vendorComponents = new Map(loadVendorComponents({ repoRoot }).map((component) => [component.id, component]));
  const vendors = await Promise.all([
    verifyVendor(pluginRoot, { component: vendorComponents.get("skillstead"), repoRoot }),
    verifyVendor(pluginRoot, { component: vendorComponents.get("archify"), repoRoot }),
  ]);
  const hooks = JSON.parse(await readFile(path.join(pluginRoot, "hooks/hooks.json"), "utf8"));
  exactHookCommand(hooks, "SessionStart");
  exactHookCommand(hooks, "Stop");

  const isolatedHome = path.join(isolationRoot, "home");
  const isolatedCodex = path.join(isolationRoot, "codex-home");
  const workspace = path.join(isolationRoot, "workspace");
  const artifact = path.join(workspace, "artifact");
  await Promise.all([mkdir(isolatedHome), mkdir(isolatedCodex), mkdir(workspace)]);
  await copyTree(path.join(pluginRoot, "assets/shared/templates/canonical-artifact"), artifact, { label: `${productName} canonical artifact` });
  const env = minimalEnvironment({ root: isolationRoot, home: isolatedHome, codexHome: isolatedCodex });

  const officialValidator = await officialValidatorPath({ allowMissing: allowMissingOfficialValidator });
  if (officialValidator === null) {
    process.stdout.write(`${productName}: SKIP official plugin validator (run locally before release)\n`);
  } else {
    const isolatedOfficialValidator = path.join(isolationRoot, "official-validate-plugin.py");
    await writeFile(isolatedOfficialValidator, await readFile(officialValidator));
    runProcess(await discoverPython(), [isolatedOfficialValidator, pluginRoot], { cwd: isolationRoot, env });
  }
  const session = runProcess(process.execPath, [path.join(pluginRoot, "scripts/capability-probe.mjs")], {
    cwd: isolationRoot,
    env,
    input: JSON.stringify({ hook_event_name: "SessionStart", cwd: workspace }),
  });
  const sessionOutput = JSON.parse(session.stdout);
  if (sessionOutput?.hookSpecificOutput?.hookEventName !== "SessionStart") throw new Error("SessionStart hook output mismatch");

  const validationProcess = runProcess(process.execPath, [path.join(pluginRoot, "scripts/validate-artifact.mjs"), artifact, "md"], {
    cwd: isolationRoot,
    env,
  });
  const validation = JSON.parse(validationProcess.stdout);
  if (validation.ok !== true || JSON.stringify(validation.requestedFormats) !== '["md"]') {
    throw new Error("canonical MD validation mismatch");
  }

  const qualityContract = productName === "game-design-studio"
    ? {
        namespace: "studio",
        profileId: "game-design-brief",
        request: { artifactId: "brief", goal: "game design brief", audience: ["production"], artifactType: "design-document", requestedFormat: "md", templateId: "game-design-brief" },
      }
    : {
        namespace: "career",
        profileId: "portfolio-case-study",
        request: { artifactId: "case-study", goal: "portfolio case study", audience: ["recruiter"], artifactType: "career-document", requestedFormat: "md", templateId: "creative-design-portfolio" },
      };
  const qualityRoot = path.join(pluginRoot, "references/shared/document-quality");
  const [qualityRuntime, qualityValidator, selectionIndex] = await Promise.all([
    import(`${pathToFileURL(path.join(pluginRoot, "scripts/resolve-quality-profile.mjs")).href}?isolation=${Date.now()}`),
    import(`${pathToFileURL(path.join(pluginRoot, "scripts/validate-quality-profile.mjs")).href}?isolation=${Date.now()}`),
    readFile(path.join(qualityRoot, `indexes/${qualityContract.namespace}.json`), "utf8").then(JSON.parse),
  ]);
  const application = await qualityRuntime.applyDocumentQualityProfile({
    namespace: qualityContract.namespace,
    selectionIndex,
    pluginRoot,
    request: qualityContract.request,
  });
  if (application.selection.primaryProfileId !== qualityContract.profileId) {
    throw new Error(`${productName} isolated quality-profile selection mismatch`);
  }
  const profileValidation = qualityValidator.validateQualityProfile(application.composed.profile, {
    sourceName: `${productName} isolated composed profile`,
  });
  if (!profileValidation.ok) throw new Error(`${productName} isolated quality-profile validation failed`);

  const imageWorkflow = await import(`${pathToFileURL(path.join(pluginRoot, "scripts/run-image-asset-workflow.mjs")).href}?isolation=${Date.now()}`);
  const imageProfile = {
    profile_id: "isolated-image-plan", version: 1, artifact_types: ["design-document"], audiences: ["design"],
    required_sections: [{ id: "visuals", title: "Visuals" }], required_tables: [{ id: "visual-table", section_id: "visuals", columns: ["Signal"] }],
    required_diagrams: [{ id: "diagram", section_id: "visuals", purpose: "Explain the documented visual direction.", alt_text: "Readable diagram." }], required_images: [{ id: "hero", section_id: "visuals", purpose: "Explain the documented visual direction.", alt_text: "Readable planning placeholder." }],
    recommended_images: [], length_guidance: { min_words: 1, max_words: 10 }, ppt_story_contract: {}, acceptance_criteria: ["Readable"],
    export_rules: { required_formats: ["md"], forbidden_formats: [] }, quality_checks: ["visual"],
  };
  const imageArtifact = {
    artifact_id: `${productName}-isolated-image-plan`,
    image_needs: [{ slot_id: "hero", type: "character", scene: "A readable neutral scene.", subject: "An original silhouette.", composition: "Centered.", visual_style: "Original illustration.", readability: "Readable at planning scale.", width: 1024, height: 1024 }],
  };
  let networkCalls = 0;
  let generationCalls = 0;
  const imagePlan = await imageWorkflow.runImageAssetWorkflow({
    artifactRoot: artifact, artifact: imageArtifact, qualityProfile: imageProfile,
    config: { mode: "prompt-only", model: "gpt-image-2", quality: "low", apiKeyPresent: true, apiKey: "isolation-test-key" },
    codexCapability: { status: "available" },
    generateOpenAIImagesFn: async () => { networkCalls += 1; return { results: [], failures: [] }; },
    hostGenerate: async () => { generationCalls += 1; return { results: [], failures: [] }; },
  });
  const [promptMarkdown, promptJson, persistedManifest] = await Promise.all([
    readFile(path.join(artifact, "assets/prompts/image-prompts.md"), "utf8"),
    readFile(path.join(artifact, "assets/prompts/image-prompts.json"), "utf8"),
    readFile(path.join(artifact, "assets/image-assets.yml"), "utf8").then(JSON.parse),
  ]);
  if (imagePlan.manifest.assets.length !== 1 || persistedManifest.assets[0]?.generation_state !== "prompt-ready"
      || persistedManifest.assets[0]?.approval_state !== "concept-draft" || !promptMarkdown.includes("Expected count: 1") || JSON.parse(promptJson).prompts?.length !== 1) {
    throw new Error(`${productName} isolated prompt-only image plan mismatch`);
  }
  if (networkCalls !== 0 || generationCalls !== 0) throw new Error(`${productName} isolation smoke attempted image generation or network access`);

  const sentinel = '<!-- game-design-plugin:artifact {"path":"artifact","formats":["md"]} -->';
  const stop = runProcess(process.execPath, [path.join(pluginRoot, "scripts/stop-artifact-review.mjs")], {
    cwd: workspace,
    env,
    input: JSON.stringify({ hook_event_name: "Stop", cwd: workspace, stop_hook_active: false, last_assistant_message: sentinel }),
  });
  const stopOutput = JSON.parse(stop.stdout);
  if (stopOutput.status !== "passed" || stopOutput.validation?.ok !== true
      || JSON.stringify(stopOutput.validation.requestedFormats) !== '["md"]') {
    throw new Error("Stop hook sentinel validation mismatch");
  }

  return {
    name: productName,
    skillCount: skills.length,
    vendorFiles: vendors,
    hooks: Object.keys(hooks.hooks).sort(),
    validation: { ok: validation.ok, requestedFormats: validation.requestedFormats },
    stopStatus: stopOutput.status,
    officialValidatorOrigin: "isolated-copy",
    symlinks: audit.symlinks,
    qualityProfile: {
      namespace: qualityContract.namespace,
      profileId: application.selection.primaryProfileId,
      selectionReason: application.selection.selectionReason,
      validationOk: profileValidation.ok,
    },
    imagePlan: {
      networkCalls,
      generationCalls,
      placeholders: imagePlan.manifest.assets.length,
      promptFiles: ["assets/prompts/image-prompts.json", "assets/prompts/image-prompts.md"],
    },
  };
}

export async function runIsolationSmoke({ repoRoot = fileURLToPath(new URL("..", import.meta.url)), mutateCopy, allowMissingOfficialValidator = false } = {}) {
  const requestedRepoRoot = path.resolve(repoRoot);
  if (requestedRepoRoot === path.parse(requestedRepoRoot).root) throw new Error(`unsafe repository root: ${requestedRepoRoot}`);
  const canonicalRepoRoot = await canonicalDirectory(requestedRepoRoot, "repository root");
  const actualHome = await realpath(homedir());
  const registration = await createGuardedTempRoot({ parent: tmpdir(), prefix: TEMP_PREFIX });
  const isolationRoot = registration.root;
  const reports = [];
  try {
    for (const productName of PRODUCT_NAMES) {
      const perPlugin = await mkdtemp(path.join(isolationRoot, `${TEMP_PREFIX}${productName}-`));
      reports.push(await verifyOne({ repoRoot: canonicalRepoRoot, productName, isolationRoot: perPlugin, mutateCopy, actualHome, allowMissingOfficialValidator }));
    }
    return reports;
  } finally {
    await cleanupGuardedTempRoot(registration);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const allowMissingOfficialValidator = args.includes("--allow-missing-official-validator");
  if (args.some((argument) => argument !== "--allow-missing-official-validator")) {
    throw new Error("Usage: node tooling/isolation-smoke.mjs [--allow-missing-official-validator]");
  }
  const report = await runIsolationSmoke({ allowMissingOfficialValidator });
  for (const result of report) {
    process.stdout.write(`${result.name}: PASS (${result.skillCount} exact skills, ${result.vendorFiles.map(({ name, files }) => `${name}:${files}`).join(", ")} vendor files, network:0, canonical MD + quality profile + hooks)\n`);
  }
}

const entry = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (entry && pathToFileURL(entry).href === import.meta.url) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
