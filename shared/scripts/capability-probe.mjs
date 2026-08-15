#!/usr/bin/env node

import { access, lstat, open, readFile, readdir, realpath } from 'node:fs/promises';
import { constants } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { delimiter, isAbsolute, join, relative, resolve, sep, win32 as pathWin32 } from 'node:path';
import { fileURLToPath } from 'node:url';

import { checkGameDesignUpdates } from './check-game-design-updates.mjs';
import { loadImageConfig, toPublicImageConfig } from './validate-image-config.mjs';

const MAX_STDIN_BYTES = 64 * 1024;
const MAX_PATH_ENTRIES = 64;
const BINARY_NAMES = Object.freeze({
  soffice: ['soffice'],
});
const CHROMIUM_VERSION_RE = /\b(google chrome|chromium|microsoft edge)\b/iu;
const CHROMIUM_BASENAME_RE = /^(chrome|chromium(-browser)?|google-chrome(-stable)?|msedge|microsoft edge)(\.exe)?$/iu;

function warning(code, message) {
  return { code, message };
}

async function readHookInput() {
  let source = '';
  try {
    for await (const chunk of process.stdin) {
      source += chunk;
      if (Buffer.byteLength(source) > MAX_STDIN_BYTES) {
        return { warning: warning('input.too_large', 'Hook input exceeded 64 KiB and was ignored.') };
      }
    }
  } catch {
    return { warning: warning('input.unreadable', 'Hook input could not be read and was ignored.') };
  }
  if (source.trim() === '') return {};
  try {
    const parsed = JSON.parse(source);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new TypeError();
    return { value: parsed };
  } catch {
    return { warning: warning('input.invalid_json', 'Hook input was not a JSON object and was ignored.') };
  }
}

function safeAbsoluteCandidate(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= 4096
    && !value.includes('\0') && isAbsolute(value) ? value : null;
}

async function executable(path) {
  try {
    await access(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

async function findBinary(names, explicitCandidate, env = process.env) {
  const candidates = [];
  const safeExplicit = safeAbsoluteCandidate(explicitCandidate);
  if (safeExplicit) candidates.push(safeExplicit);
  const pathEntries = (env.PATH ?? '').split(delimiter)
    .filter((entry) => entry.length > 0 && entry.length <= 4096)
    .slice(0, MAX_PATH_ENTRIES);
  for (const name of names) {
    for (const entry of pathEntries) candidates.push(join(entry, name));
  }
  for (const candidate of candidates) {
    if (await executable(candidate)) return { available: true, command: names[0] };
  }
  return { available: false };
}

// Keep this order byte-for-byte equivalent to the vendored Skillstead 0.8.3
// renderer. The probe must never advertise a browser that the renderer would
// not select first.
export function browserCandidates(platform = process.platform, env = process.env) {
  const names = ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'msedge', 'chrome'];
  const paths = [];
  if (platform === 'darwin') {
    paths.push(
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
    );
  } else if (platform === 'win32') {
    const programFiles = env.ProgramFiles ?? 'C:\\Program Files';
    const programFilesX86 = env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)';
    paths.push(
      pathWin32.join(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      pathWin32.join(programFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      pathWin32.join(programFilesX86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      pathWin32.join(programFiles, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    );
  }
  return { names, paths };
}

function pathCandidates(name, env, platform) {
  const pathVariable = env.PATH ?? env.Path ?? '';
  const extensions = platform === 'win32' ? (env.PATHEXT ?? '.COM;.EXE;.BAT;.CMD').split(';') : [''];
  const joinPath = platform === 'win32' ? pathWin32.join : join;
  const separator = platform === 'win32' ? ';' : delimiter;
  const directories = pathVariable.split(separator)
    .filter((entry) => entry.length > 0 && entry.length <= 4096)
    .slice(0, MAX_PATH_ENTRIES);
  const candidates = [];
  for (const directory of directories) {
    for (const extension of extensions) candidates.push(joinPath(directory, name + extension.toLowerCase()));
  }
  return candidates;
}

async function candidateExists(candidate) {
  if (typeof candidate !== 'string' || candidate.length === 0 || candidate.length > 4096 || candidate.includes('\0')) return false;
  try {
    await lstat(candidate);
    return true;
  } catch {
    return false;
  }
}

export function verifyChromiumIdentity(executablePath, versionOutput, {
  platform = process.platform,
  documentedPaths = [],
} = {}) {
  const version = (versionOutput ?? '').trim();
  if (version && CHROMIUM_VERSION_RE.test(version)) return { ok: true, version };
  const base = executablePath.split(/[\\/]/u).pop() ?? '';
  if (platform === 'win32' && /^(chrome|msedge)\.exe$/iu.test(base) && documentedPaths.includes(executablePath)) {
    return {
      ok: true,
      version: version
        ? `identity from documented install path; unrecognized/localized --version output: "${version}"`
        : 'identity from documented install path; no --version output',
    };
  }
  if (!version && CHROMIUM_BASENAME_RE.test(base)) {
    return { ok: true, version: 'version unavailable from --version (identity from executable name)' };
  }
  return { ok: false };
}

async function inspectChromiumCandidate(candidate, via, { platform, env, spawnSyncFn }) {
  let canonical;
  try {
    canonical = await realpath(candidate);
    const stats = await lstat(canonical);
    if (!stats.isFile()) return { available: false };
    await access(canonical, constants.X_OK);
  } catch {
    return { available: false };
  }
  let versionProbe;
  try {
    versionProbe = spawnSyncFn(canonical, ['--version'], { encoding: 'utf8', timeout: 15000 });
  } catch {
    return { available: false };
  }
  if (versionProbe.error || (versionProbe.status !== 0 && !versionProbe.stdout)) return { available: false };
  const identity = verifyChromiumIdentity(candidate, versionProbe.stdout, {
    platform,
    documentedPaths: browserCandidates(platform, env).paths,
  });
  if (!identity.ok) return { available: false };
  return { available: true, command: canonical, version: identity.version, via };
}

export async function probeChromium({
  platform = process.platform,
  env = process.env,
  spawnSyncFn = spawnSync,
} = {}) {
  const override = env.SVG_INFOGRAPHIC_BROWSER;
  if (override) {
    if (!(await candidateExists(override))) return { available: false };
    return inspectChromiumCandidate(override, 'SVG_INFOGRAPHIC_BROWSER override', { platform, env, spawnSyncFn });
  }
  const { names, paths } = browserCandidates(platform, env);
  for (const name of names) {
    for (const candidate of pathCandidates(name, env, platform)) {
      if (await candidateExists(candidate)) {
        return inspectChromiumCandidate(candidate, `PATH (${name})`, { platform, env, spawnSyncFn });
      }
    }
  }
  for (const candidate of paths) {
    if (await candidateExists(candidate)) {
      return inspectChromiumCandidate(candidate, 'documented known path', { platform, env, spawnSyncFn });
    }
  }
  return { available: false };
}

function isAbsentPathError(error) {
  return error?.code === 'ENOENT' || error?.code === 'ENOTDIR';
}

async function readableRegularFile(path, { lstatFn = lstat, accessFn = access } = {}) {
  try {
    const stats = await lstatFn(path);
    if (!stats.isFile() || stats.isSymbolicLink()) return { available: false };
    await accessFn(path, constants.R_OK);
    return { available: true };
  } catch (error) {
    if (isAbsentPathError(error)) return { available: false };
    return { available: false, unknown: true };
  }
}

async function findBundledSkill(capability, env = process.env, { readdirFn = readdir, lstatFn = lstat, accessFn = access } = {}) {
  const codexHome = safeAbsoluteCandidate(env.CODEX_HOME) ?? join(homedir(), '.codex');
  if (!codexHome) return { available: false };
  const capabilityRoot = join(codexHome, 'plugins', 'cache', 'openai-primary-runtime', capability);
  let versions;
  try {
    versions = (await readdirFn(capabilityRoot)).filter((name) => /^[0-9][0-9.]*$/.test(name)).sort();
  } catch (error) {
    if (!isAbsentPathError(error)) return { available: false, unknown: true };
    return { available: false };
  }
  for (const version of versions) {
    const versionDirectory = join(capabilityRoot, version);
    let versionStats;
    try {
      versionStats = await lstatFn(versionDirectory);
      if (!versionStats.isDirectory() || versionStats.isSymbolicLink()) continue;
      await accessFn(versionDirectory, constants.R_OK);
    } catch (error) {
      if (isAbsentPathError(error)) continue;
      return { available: false, unknown: true };
    }
    const skill = await readableRegularFile(join(versionDirectory, 'skills', capability, 'SKILL.md'), { lstatFn, accessFn });
    if (skill.unknown) return { available: false, unknown: true };
    if (skill.available) {
      return { available: true, provider: 'codex-bundled' };
    }
  }
  return { available: false };
}

export async function probeImageGenerationCapability(env = process.env, { lstatFn = lstat, findBundledSkillFn = findBundledSkill } = {}) {
  const codexHome = safeAbsoluteCandidate(env.CODEX_HOME) ?? join(homedir(), '.codex');
  if (!codexHome) return { status: 'unknown' };
  const systemSkill = join(codexHome, 'skills', '.system', 'imagegen', 'SKILL.md');
  try {
    const stats = await lstatFn(systemSkill);
    if (stats.isFile() && !stats.isSymbolicLink()) return { status: 'available', provider: 'codex-system-skill' };
  } catch (error) {
    if (!isAbsentPathError(error)) return { status: 'unknown' };
  }
  const bundled = await findBundledSkillFn('imagegen', env, { lstatFn });
  if (bundled.available) return { status: 'available', provider: 'codex-bundled-skill' };
  if (bundled.unknown) return { status: 'unknown' };
  return { status: 'unavailable' };
}

function parseArchifyVersion(source) {
  let metadata;
  try {
    metadata = JSON.parse(source);
  } catch {
    return null;
  }
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata) || typeof metadata.version !== 'string') return null;
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/u.exec(metadata.version);
  if (!match) return null;
  const prerelease = match[4]?.split('.') ?? [];
  if (prerelease.some((identifier) => /^\d+$/u.test(identifier) && identifier.length > 1 && identifier.startsWith('0'))) return null;
  return {
    version: metadata.version,
    major: BigInt(match[1]),
    minor: BigInt(match[2]),
    patch: BigInt(match[3]),
    prerelease,
  };
}

function supportedArchifyVersion(version) {
  if (version.major !== 2n) return false;
  if (version.minor > 13n) return true;
  if (version.minor < 13n) return false;
  if (version.patch > 0n) return true;
  return version.prerelease.length === 0;
}

function containedIn(base, candidate) {
  const pathFromBase = relative(base, candidate);
  return pathFromBase === '' || (!pathFromBase.startsWith(`..${sep}`) && pathFromBase !== '..' && !isAbsolute(pathFromBase));
}

function pinnedCliStats(stats) {
  return stats?.isFile?.() && !stats.isSymbolicLink() && typeof stats.dev === 'bigint' && typeof stats.ino === 'bigint'
    && typeof stats.size === 'bigint' && typeof stats.mtimeNs === 'bigint' && typeof stats.ctimeNs === 'bigint';
}

function samePinnedCliStats(left, right) {
  return pinnedCliStats(left) && pinnedCliStats(right) && left.dev === right.dev && left.ino === right.ino
    && left.size === right.size && left.mtimeNs === right.mtimeNs && left.ctimeNs === right.ctimeNs;
}

async function inspectArchifyPath(path, expectedType, { lstatFn, accessFn, realpathFn, base }) {
  try {
    const stats = await lstatFn(path);
    if (stats.isSymbolicLink() || (expectedType === 'file' ? !stats.isFile() : !stats.isDirectory())) return { status: 'unknown' };
    await accessFn(path, expectedType === 'directory' ? constants.R_OK | constants.X_OK : constants.R_OK);
    const canonical = await realpathFn(path);
    if (base && !containedIn(base, canonical)) return { status: 'unknown' };
    return { status: 'available', canonical };
  } catch (error) {
    return { status: isAbsentPathError(error) ? 'unavailable' : 'unknown' };
  }
}

async function inspectArchifyCandidate(base, components, { lstatFn, accessFn, readFileFn, realpathFn }) {
  const inspectedBase = await inspectArchifyPath(base, 'directory', {
    lstatFn, accessFn, realpathFn, base: null,
  });
  if (inspectedBase.status !== 'available') {
    return inspectedBase.status === 'unavailable' ? { status: 'unavailable', candidateAbsent: true } : inspectedBase;
  }

  let currentPath = inspectedBase.canonical;
  let packagePath;
  let cliPath;
  for (const [name, expectedType, allowsCandidateAbsence] of components) {
    const inspected = await inspectArchifyPath(join(currentPath, name), expectedType, {
      lstatFn, accessFn, realpathFn, base: inspectedBase.canonical,
    });
    if (inspected.status !== 'available') {
      if (inspected.status === 'unavailable' && allowsCandidateAbsence) return { status: 'unavailable', candidateAbsent: true };
      return { status: 'unknown' };
    }
    if (name === 'package.json') packagePath = inspected.canonical;
    if (name === 'archify.mjs') cliPath = inspected.canonical;
    if (expectedType === 'directory') currentPath = inspected.canonical;
  }
  let packageJson;
  try {
    packageJson = await readFileFn(packagePath, 'utf8');
  } catch {
    return { status: 'unknown' };
  }
  const version = parseArchifyVersion(packageJson);
  if (!version) return { status: 'unknown' };
  if (!supportedArchifyVersion(version)) return { status: 'unavailable' };
  return {
    status: 'available',
    provider: 'host-archify-skill',
    version: version.version,
    cliPath,
    cliBase: inspectedBase.canonical,
  };
}

async function inspectConfiguredArchifyCandidates(env = process.env, {
  home = homedir(),
  lstatFn = lstat,
  accessFn = access,
  readFileFn = readFile,
  realpathFn = realpath,
} = {}) {
  const codexHome = safeAbsoluteCandidate(env.CODEX_HOME) ?? join(home, '.codex');
  const candidates = [
    [codexHome, [
      ['skills', 'directory', true],
      ['archify', 'directory', true],
      ['SKILL.md', 'file', false],
      ['package.json', 'file', false],
      ['bin', 'directory', false],
      ['archify.mjs', 'file', false],
    ]],
    [home, [
      ['.agents', 'directory', true],
      ['skills', 'directory', true],
      ['archify', 'directory', true],
      ['SKILL.md', 'file', false],
      ['package.json', 'file', false],
      ['bin', 'directory', false],
      ['archify.mjs', 'file', false],
    ]],
  ];
  for (const [base, components] of candidates) {
    const result = await inspectArchifyCandidate(base, components, { lstatFn, accessFn, readFileFn, realpathFn });
    if (result.status === 'unavailable' && result.candidateAbsent) continue;
    if (result.status === 'available') return result;
    return { status: result.status };
  }
  return { status: 'unavailable' };
}

export async function resolveArchifyInstallation(env = process.env, options = {}) {
  const {
    lstatFn = lstat,
    openFn = open,
    readFileFn = readFile,
    realpathFn = realpath,
  } = options;
  const result = await inspectConfiguredArchifyCandidates(env, options);
  if (result.status !== 'available') return { status: result.status };

  let handle;
  let bytes;
  let beforeStats;
  let afterStats;
  let pathnameStats;
  let finalPathnameStats;
  let firstCanonical;
  let canonical;
  let failure;
  try {
    handle = await openFn(result.cliPath, constants.O_RDONLY | constants.O_NOFOLLOW);
    beforeStats = await handle.stat({ bigint: true });
    bytes = await handle.readFile();
    afterStats = await handle.stat({ bigint: true });
    firstCanonical = await realpathFn(result.cliPath);
    pathnameStats = await lstatFn(result.cliPath, { bigint: true });
    canonical = await realpathFn(result.cliPath);
    // The final pathname operation is lstat: no later pathname lookup can
    // replace the regular file after its canonical path has been checked.
    finalPathnameStats = await lstatFn(result.cliPath, { bigint: true });
    if (!Buffer.isBuffer(bytes) || !samePinnedCliStats(beforeStats, afterStats) || !samePinnedCliStats(beforeStats, pathnameStats)
      || !samePinnedCliStats(beforeStats, finalPathnameStats)
      || beforeStats.size !== BigInt(bytes.byteLength) || firstCanonical !== canonical || !containedIn(result.cliBase, canonical)) {
      failure = new Error('Archify CLI identity changed while it was read.');
    }
  } catch (error) {
    failure = error;
  }
  if (handle) {
    try {
      await handle.close();
    } catch (error) {
      failure = failure ? new AggregateError([failure, error], 'Archify CLI inspection and close both failed.') : error;
    }
  }
  if (failure) {
    return { status: 'unknown' };
  }
  return {
    status: 'available',
    provider: result.provider,
    version: result.version,
    cli: Object.freeze({
      path: result.cliPath,
      realpath: canonical,
      dev: beforeStats.dev,
      ino: beforeStats.ino,
      size: beforeStats.size,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    }),
  };
}

export async function probeArchifyCapability(env = process.env, options = {}) {
  const result = await resolveArchifyInstallation(env, options);
  if (result.status !== 'available') return result;
  return { status: result.status, provider: result.provider, version: result.version };
}

export async function probeCapabilities({ platform = process.platform, env = process.env, home = homedir() } = {}) {
  const capabilities = {
    node: { available: true, version: process.versions.node },
    chromium: await probeChromium({ platform, env }),
    soffice: await findBinary(BINARY_NAMES.soffice, env.SOFFICE_PATH, env),
    documents: await findBundledSkill('documents', env),
    pdf: await findBundledSkill('pdf', env),
    presentations: await findBundledSkill('presentations', env),
    image_generation: await probeImageGenerationCapability(env),
    archify: await probeArchifyCapability(env, { home }),
  };
  const warnings = [];
  for (const name of ['chromium', 'soffice', 'documents', 'pdf', 'presentations']) {
    if (!capabilities[name].available) {
      warnings.push(warning(`capability.${name}.absent`, `Optional ${name} capability is unavailable.`));
    }
  }
  return { capabilities, warnings };
}

function closedUnknownUpdates() {
  return {
    schemaVersion: 1,
    checkedAt: new Date().toISOString(),
    cache: 'miss',
    status: 'unknown',
    components: [],
    notification: null,
  };
}

async function safelyCheckGameDesignUpdates(updateOptions) {
  try {
    return await checkGameDesignUpdates(updateOptions);
  } catch {
    return closedUnknownUpdates();
  }
}

export async function runCapabilityProbe({ updateOptions } = {}) {
  const input = await readHookInput();
  const workspaceRoot = safeAbsoluteCandidate(input.value?.cwd) ?? process.cwd();
  const [result, imageConfig, updates] = await Promise.all([
    probeCapabilities(),
    loadImageConfig({ workspaceRoot }).then(toPublicImageConfig),
    safelyCheckGameDesignUpdates(updateOptions),
  ]);
  if (input.warning) result.warnings.unshift(input.warning);
  return {
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: JSON.stringify({ capabilities: result.capabilities, imageConfig, updates }),
    },
    imageConfig,
    updates,
    ...result,
  };
}

async function isDirectInvocation() {
  if (!process.argv[1]) return false;
  try {
    return await realpath(process.argv[1]) === await realpath(fileURLToPath(import.meta.url));
  } catch {
    return resolve(process.argv[1]) === fileURLToPath(import.meta.url);
  }
}

if (await isDirectInvocation()) {
  console.log(JSON.stringify(await runCapabilityProbe()));
}
