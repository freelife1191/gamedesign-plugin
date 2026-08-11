#!/usr/bin/env node

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
import { cleanupGuardedTempRoot, createGuardedTempRoot } from "./lib/guarded-temp.mjs";
import { sha256 } from "./lib/hash.mjs";
import { auditTree } from "./lib/tree-audit.mjs";

const TEMP_PREFIX = "game-design-isolation-";
const PRODUCT_NAMES = Object.freeze(["game-design-career", "game-design-studio"]);
const EXPECTED_HOOKS = Object.freeze({
  SessionStart: {
    command: 'node "${PLUGIN_ROOT}/scripts/capability-probe.mjs"',
    timeout: 10,
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

async function verifyVendor(pluginRoot) {
  const lock = JSON.parse(await readFile(path.join(pluginRoot, "references/shared/vendor/skillstead/vendor.lock.json"), "utf8"));
  if (lock?.upstream?.tag !== "svg-infographic/v0.9.0" || lock?.tree?.root !== "svg-infographic/0.9.0" || !Array.isArray(lock.tree.files)) {
    throw new Error("package-local vendor lock mismatch");
  }
  const entries = await collectTree(path.join(pluginRoot, "skills/svg-infographic"), { label: "isolated Skillstead skill" });
  const actual = new Map(entries.map((entry) => [entry.relativePath, entry.bytes]));
  if (lock.tree.files.length !== 55 || actual.size !== 55) throw new Error(`vendor file count mismatch: ${lock.tree.files.length}/${actual.size}`);
  for (const expected of lock.tree.files) {
    const bytes = actual.get(expected.path);
    if (!bytes) throw new Error(`missing vendored file: ${expected.path}`);
    if (bytes.length !== expected.size || sha256(bytes) !== expected.sha256) {
      throw new Error(`modified vendored file: ${expected.path}`);
    }
  }
  if ([...actual.keys()].some((relative) => !lock.tree.files.some(({ path: locked }) => locked === relative))) {
    throw new Error("unexpected vendored file");
  }
  return actual.size;
}

async function officialValidatorPath() {
  const codexHome = process.env.CODEX_HOME ? path.resolve(process.env.CODEX_HOME) : path.join(homedir(), ".codex");
  const validator = path.join(codexHome, "skills/.system/plugin-creator/scripts/validate_plugin.py");
  const stats = await lstat(validator).catch(() => null);
  if (!stats?.isFile() || stats.isSymbolicLink()) throw new Error(`official plugin validator unavailable: ${validator}`);
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

async function verifyOne({ repoRoot, productName, isolationRoot, mutateCopy, actualHome }) {
  const source = path.join(repoRoot, "plugins", productName);
  await canonicalDirectory(source, `${productName} source`);
  const pluginRoot = path.join(isolationRoot, "package", productName);
  await mkdir(pluginRoot, { recursive: true });
  await copyTree(source, pluginRoot, { label: `${productName} isolated extraction` });
  await mutateCopy?.({ pluginRoot, productName, actualHome });

  const sibling = PRODUCT_NAMES.find((name) => name !== productName);
  const audit = await auditTree({
    root: pluginRoot,
    packageName: productName,
    siblingNames: [sibling],
    forbiddenAbsolutePaths: [repoRoot, actualHome, process.env.CODEX_HOME ?? path.join(actualHome, ".codex")],
  });

  const manifest = JSON.parse(await readFile(path.join(pluginRoot, ".codex-plugin/plugin.json"), "utf8"));
  if (manifest.name !== productName || manifest.version !== "0.1.0" || manifest.skills !== "./skills/") {
    throw new Error(`${productName} manifest mismatch`);
  }
  const skillEntries = await readdir(path.join(pluginRoot, "skills"), { withFileTypes: true });
  const skills = skillEntries.filter((entry) => entry.isDirectory()).map(({ name }) => name).sort();
  if (skills.length !== 18) throw new Error(`${productName} skill count mismatch: ${skills.length}`);
  for (const skill of skills) await lstat(path.join(pluginRoot, "skills", skill, "SKILL.md"));

  const vendorFileCount = await verifyVendor(pluginRoot);
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

  const isolatedOfficialValidator = path.join(isolationRoot, "official-validate-plugin.py");
  await writeFile(isolatedOfficialValidator, await readFile(await officialValidatorPath()));
  runProcess(await discoverPython(), [isolatedOfficialValidator, pluginRoot], { cwd: isolationRoot, env });
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
    vendorFileCount,
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

export async function runIsolationSmoke({ repoRoot = fileURLToPath(new URL("..", import.meta.url)), mutateCopy } = {}) {
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
      reports.push(await verifyOne({ repoRoot: canonicalRepoRoot, productName, isolationRoot: perPlugin, mutateCopy, actualHome }));
    }
    return reports;
  } finally {
    await cleanupGuardedTempRoot(registration);
  }
}

async function main() {
  const report = await runIsolationSmoke();
  for (const result of report) {
    process.stdout.write(`${result.name}: PASS (${result.skillCount} skills, ${result.vendorFileCount} vendor files, canonical MD + quality profile + hooks)\n`);
  }
}

const entry = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (entry && pathToFileURL(entry).href === import.meta.url) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
