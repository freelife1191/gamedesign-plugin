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
    statusMessage: "Detecting optional game-design capabilities",
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
  if (lock?.package?.name !== "svg-infographic" || lock.package.version !== "0.8.3" || !Array.isArray(lock.files)) {
    throw new Error("package-local vendor lock mismatch");
  }
  const entries = await collectTree(path.join(pluginRoot, "skills/svg-infographic"), { label: "isolated Skillstead skill" });
  const actual = new Map(entries.map((entry) => [entry.relativePath, entry.bytes]));
  if (lock.files.length !== 48 || actual.size !== 48) throw new Error(`vendor file count mismatch: ${lock.files.length}/${actual.size}`);
  for (const expected of lock.files) {
    const bytes = actual.get(expected.path);
    if (!bytes) throw new Error(`missing vendored file: ${expected.path}`);
    if (bytes.length !== expected.size || sha256(bytes) !== expected.sha256) {
      throw new Error(`modified vendored file: ${expected.path}`);
    }
  }
  if ([...actual.keys()].some((relative) => !lock.files.some(({ path: locked }) => locked === relative))) {
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
  if (skills.length !== 11) throw new Error(`${productName} skill count mismatch: ${skills.length}`);
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
    process.stdout.write(`${result.name}: PASS (${result.skillCount} skills, ${result.vendorFileCount} vendor files, canonical MD + hooks)\n`);
  }
}

const entry = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (entry && pathToFileURL(entry).href === import.meta.url) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
