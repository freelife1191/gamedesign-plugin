#!/usr/bin/env node

import { access, lstat, readdir, realpath } from 'node:fs/promises';
import { constants } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
import { delimiter, isAbsolute, join, resolve, win32 as pathWin32 } from 'node:path';
import { fileURLToPath } from 'node:url';

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

export async function probeCapabilities({ platform = process.platform, env = process.env } = {}) {
  const capabilities = {
    node: { available: true, version: process.versions.node },
    chromium: await probeChromium({ platform, env }),
    soffice: await findBinary(BINARY_NAMES.soffice, env.SOFFICE_PATH, env),
    documents: await findBundledSkill('documents', env),
    pdf: await findBundledSkill('pdf', env),
    presentations: await findBundledSkill('presentations', env),
    image_generation: await probeImageGenerationCapability(env),
  };
  const warnings = [];
  for (const name of ['chromium', 'soffice', 'documents', 'pdf', 'presentations']) {
    if (!capabilities[name].available) {
      warnings.push(warning(`capability.${name}.absent`, `Optional ${name} capability is unavailable.`));
    }
  }
  return { capabilities, warnings };
}

export async function runCapabilityProbe() {
  const input = await readHookInput();
  const result = await probeCapabilities();
  const workspaceRoot = safeAbsoluteCandidate(input.value?.cwd) ?? process.cwd();
  const imageConfig = toPublicImageConfig(await loadImageConfig({ workspaceRoot }));
  if (input.warning) result.warnings.unshift(input.warning);
  return {
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: JSON.stringify({ capabilities: result.capabilities, imageConfig }),
    },
    imageConfig,
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
