#!/usr/bin/env node

import { lstat, realpath } from 'node:fs/promises';
import { isAbsolute, posix, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { validateArtifact } from './validate-artifact.mjs';

const MAX_STDIN_BYTES = 64 * 1024;
const MAX_MESSAGE_BYTES = 32 * 1024;
const MAX_MARKER_BYTES = 4 * 1024;
const MAX_ARTIFACT_PATH_BYTES = 512;
const MARKER_PREFIX = '<!-- game-design-plugin:artifact ';
const FORBIDDEN_LEGACY_FIELDS = ['plugin_marker', 'artifact_path', 'requested_formats', 'game_design_plugin', 'artifact'];
const FORMATS = new Set(['md', 'pdf', 'docx', 'pptx']);

function warning(code, message) {
  return { code, message };
}

function warningResponse(...warnings) {
  return { continue: true, status: 'warning', warnings };
}

async function readHookInput() {
  let source = '';
  try {
    for await (const chunk of process.stdin) {
      source += chunk;
      if (Buffer.byteLength(source) > MAX_STDIN_BYTES) {
        return { error: warning('input.too_large', 'Hook input exceeded 64 KiB.') };
      }
    }
  } catch {
    return { error: warning('input.unreadable', 'Hook input could not be read.') };
  }
  if (source.trim() === '') return { error: warning('input.missing', 'Stop hook input is required.') };
  try {
    const value = JSON.parse(source);
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError();
    return { value };
  } catch {
    return { error: warning('input.invalid_json', 'Stop hook input must be a JSON object.') };
  }
}

function parseMarker(input) {
  const legacyField = FORBIDDEN_LEGACY_FIELDS.find((field) => Object.hasOwn(input, field));
  if (legacyField) {
    return { error: warning('input.legacy_field', 'Artifact metadata must be carried only by the final assistant-message sentinel.') };
  }
  if (!Object.hasOwn(input, 'last_assistant_message')) return { absent: true };
  if (typeof input.last_assistant_message !== 'string') {
    return { error: warning('input.last_assistant_message_invalid', 'last_assistant_message must be text.') };
  }
  const message = input.last_assistant_message;
  if (Buffer.byteLength(message) > MAX_MESSAGE_BYTES) {
    return { error: warning('marker.message_too_large', 'Assistant message exceeded the artifact-review limit.') };
  }
  const starts = [];
  let searchFrom = 0;
  while (true) {
    const index = message.indexOf(MARKER_PREFIX, searchFrom);
    if (index === -1) break;
    starts.push(index);
    searchFrom = index + MARKER_PREFIX.length;
  }
  if (starts.length === 0) return { absent: true };
  if (starts.length > 1) return { error: warning('marker.duplicate', 'Exactly one artifact sentinel is allowed.') };
  const start = starts[0];
  const close = message.indexOf('-->', start + MARKER_PREFIX.length);
  if (close === -1) return { error: warning('marker.invalid', 'Artifact sentinel is not closed.') };
  if (message.slice(close + 3).trim() !== '') {
    return { error: warning('marker.not_final', 'Artifact sentinel must be the final assistant-message content.') };
  }
  const markerSource = message.slice(start + MARKER_PREFIX.length, close).trim();
  if (Buffer.byteLength(markerSource) > MAX_MARKER_BYTES) {
    return { error: warning('marker.too_large', 'Artifact sentinel exceeded 4 KiB.') };
  }
  let marker;
  try {
    marker = JSON.parse(markerSource);
  } catch {
    return { error: warning('marker.invalid', 'Artifact sentinel JSON is invalid.') };
  }
  if (!marker || typeof marker !== 'object' || Array.isArray(marker)
      || Object.keys(marker).some((key) => !['path', 'formats'].includes(key))) {
    return { error: warning('marker.invalid', 'Artifact sentinel must contain only path and formats.') };
  }
  if (!Array.isArray(marker.formats) || marker.formats.some((format) => typeof format !== 'string' || !FORMATS.has(format))
      || new Set(marker.formats).size !== marker.formats.length) {
    return { error: warning('marker.invalid', 'Artifact formats must be unique canonical format names.') };
  }
  return { marker };
}

function isSafeRelativeArtifactPath(value) {
  if (typeof value !== 'string' || value.length === 0 || Buffer.byteLength(value) > MAX_ARTIFACT_PATH_BYTES) return false;
  if (value.includes('\0') || value.includes('\\') || value !== value.normalize('NFC') || isAbsolute(value)) return false;
  if (value === '.' || posix.normalize(value) !== value) return false;
  const segments = value.split('/');
  return segments.every((segment) => segment !== '' && segment !== '.' && segment !== '..');
}

function inside(root, candidate) {
  const path = relative(root, candidate);
  return path !== '' && !isAbsolute(path) && path !== '..' && !path.startsWith(`..${sep}`);
}

async function safeArtifactDirectory(cwd, artifactPath) {
  if (typeof cwd !== 'string' || cwd.length === 0 || cwd.length > 4096 || cwd.includes('\0') || !isAbsolute(cwd)) return null;
  if (!isSafeRelativeArtifactPath(artifactPath)) return null;
  let workspace;
  try {
    workspace = await realpath(cwd);
    if (!(await lstat(workspace)).isDirectory()) return null;
  } catch {
    return null;
  }
  const candidate = resolve(workspace, ...artifactPath.split('/'));
  if (!inside(workspace, candidate)) return null;
  let cursor = workspace;
  for (const part of artifactPath.split('/')) {
    cursor = resolve(cursor, part);
    let stat;
    try {
      stat = await lstat(cursor);
    } catch {
      return null;
    }
    if (stat.isSymbolicLink()) return null;
  }
  try {
    const canonical = await realpath(candidate);
    if (!inside(workspace, canonical)) return null;
    return (await lstat(canonical)).isDirectory() ? canonical : null;
  } catch {
    return null;
  }
}

function sanitizeValidation(validation) {
  return {
    ok: validation.ok,
    errors: validation.errors,
    warnings: validation.warnings,
    requestedFormats: validation.requestedFormats,
  };
}

function correctiveReason(validation) {
  const findings = validation.errors.slice(0, 20)
    .map(({ code, file, message }) => `${code}${file ? ` (${file})` : ''}: ${message}`)
    .join('\n');
  return [
    'Canonical game-design artifact validation failed. Correct the artifact once; Stop hook re-entry will not block again.',
    findings,
  ].filter(Boolean).join('\n');
}

export async function reviewStopEvent(input, { reviewAttempt = process.env.GAME_DESIGN_REVIEW_ATTEMPT } = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return warningResponse(warning('input.invalid', 'Stop hook input must be an object.'));
  }
  const parsed = parseMarker(input);
  if (parsed.absent) return { continue: true, status: 'ignored', warnings: [] };
  if (parsed.error) return warningResponse(parsed.error);
  const artifactPath = await safeArtifactDirectory(input.cwd, parsed.marker.path);
  if (!artifactPath) {
    return warningResponse(warning('artifact.path_unsafe', 'Artifact path must identify a safe relative directory inside cwd without symlinks.'));
  }

  const validation = await validateArtifact(artifactPath, { requestedFormats: parsed.marker.formats });
  const publicValidation = sanitizeValidation(validation);
  if (validation.ok) return { continue: true, status: 'passed', warnings: validation.warnings, validation: publicValidation };
  if (input.stop_hook_active === true || reviewAttempt === '1') {
    return {
      continue: true,
      status: 'invalid-after-corrective-pass',
      warnings: [warning('artifact.invalid_after_retry', 'Artifact remains invalid; the Stop hook will not request another pass.')],
      validation: publicValidation,
    };
  }
  return {
    decision: 'block',
    status: 'corrective-pass-requested',
    reason: correctiveReason(validation),
    warnings: validation.warnings,
    validation: publicValidation,
  };
}

async function main() {
  const parsed = await readHookInput();
  if (parsed.error) return warningResponse(parsed.error);
  try {
    return await reviewStopEvent(parsed.value);
  } catch {
    return warningResponse(warning('review.unavailable', 'Artifact review could not run; the hook will not permanently block completion.'));
  }
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
  console.log(JSON.stringify(await main()));
}
