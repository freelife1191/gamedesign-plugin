#!/usr/bin/env node

import { access, readdir, realpath } from 'node:fs/promises';
import { constants } from 'node:fs';
import { homedir } from 'node:os';
import { delimiter, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const MAX_STDIN_BYTES = 64 * 1024;
const MAX_PATH_ENTRIES = 64;
const BINARY_NAMES = Object.freeze({
  chromium: ['chromium', 'chromium-browser', 'google-chrome', 'google-chrome-stable', 'chrome'],
  soffice: ['soffice'],
});

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

async function findBinary(names, explicitCandidate) {
  const candidates = [];
  const safeExplicit = safeAbsoluteCandidate(explicitCandidate);
  if (safeExplicit) candidates.push(safeExplicit);
  const pathEntries = (process.env.PATH ?? '').split(delimiter)
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

async function directoryExists(path) {
  try {
    await access(path, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

async function findBundledSkill(capability) {
  const codexHome = safeAbsoluteCandidate(process.env.CODEX_HOME) ?? join(homedir(), '.codex');
  if (!codexHome) return { available: false };
  const capabilityRoot = join(codexHome, 'plugins', 'cache', 'openai-primary-runtime', capability);
  let versions;
  try {
    versions = (await readdir(capabilityRoot)).filter((name) => /^[0-9][0-9.]*$/.test(name)).sort();
  } catch {
    return { available: false };
  }
  for (const version of versions) {
    if (await directoryExists(join(capabilityRoot, version, 'skills', capability, 'SKILL.md'))) {
      return { available: true, provider: 'codex-bundled' };
    }
  }
  return { available: false };
}

export async function probeCapabilities() {
  const chromiumCandidate = process.env.CHROME_PATH ?? process.env.CHROMIUM_PATH;
  const capabilities = {
    node: { available: true, version: process.versions.node },
    chromium: await findBinary(BINARY_NAMES.chromium, chromiumCandidate),
    soffice: await findBinary(BINARY_NAMES.soffice, process.env.SOFFICE_PATH),
    documents: await findBundledSkill('documents'),
    pdf: await findBundledSkill('pdf'),
    presentations: await findBundledSkill('presentations'),
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
  if (input.warning) result.warnings.unshift(input.warning);
  return {
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: JSON.stringify({ capabilities: result.capabilities }),
    },
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
