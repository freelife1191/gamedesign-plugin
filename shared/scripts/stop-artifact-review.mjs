#!/usr/bin/env node

import { lstat, realpath } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { validateArtifact } from './validate-artifact.mjs';

const MAX_STDIN_BYTES = 64 * 1024;
const PLUGIN_MARKER = 'game-design-plugin-suite';

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

function hasPluginMarker(input) {
  return input.plugin_marker === PLUGIN_MARKER
    || input.game_design_plugin === true
    || input.artifact?.plugin_marker === PLUGIN_MARKER;
}

function artifactPathFrom(input) {
  return input.artifact_path ?? input.artifact?.path;
}

function requestedFormatsFrom(input) {
  return input.requested_formats ?? input.artifact?.requested_formats ?? [];
}

function inside(root, candidate) {
  const path = relative(root, candidate);
  return path === '' || (!isAbsolute(path) && path !== '..' && !path.startsWith(`..${sep}`));
}

async function safeArtifactDirectory(value) {
  if (typeof value !== 'string' || value.length === 0 || value.length > 4096 || value.includes('\0')) return null;
  const workspace = await realpath(process.cwd());
  const candidate = resolve(workspace, value);
  if (!inside(workspace, candidate)) return null;
  const relativeCandidate = relative(workspace, candidate);
  let cursor = workspace;
  for (const part of relativeCandidate.split(sep).filter(Boolean)) {
    cursor = resolve(cursor, part);
    let stat;
    try {
      stat = await lstat(cursor);
    } catch {
      return null;
    }
    if (stat.isSymbolicLink()) return null;
  }
  const canonical = await realpath(candidate);
  if (!inside(workspace, canonical)) return null;
  const stat = await lstat(canonical);
  return stat.isDirectory() ? canonical : null;
}

function correctiveReason(validation) {
  const findings = validation.errors.slice(0, 20)
    .map(({ code, file, message }) => `${code}${file ? ` (${file})` : ''}: ${message}`)
    .join('\n');
  return [
    'Canonical game-design artifact validation failed. Correct the artifact once, then retry with GAME_DESIGN_REVIEW_ATTEMPT=1.',
    findings,
  ].filter(Boolean).join('\n');
}

export async function reviewStopEvent(input, { reviewAttempt = process.env.GAME_DESIGN_REVIEW_ATTEMPT } = {}) {
  if (!hasPluginMarker(input)) return { continue: true, status: 'ignored', warnings: [] };
  const artifactPath = await safeArtifactDirectory(artifactPathFrom(input));
  if (!artifactPath) {
    return warningResponse(warning('artifact.path_unsafe', 'Artifact path is missing, unreadable, outside the workspace, or contains a symlink.'));
  }
  const requestedFormats = requestedFormatsFrom(input);
  if (!Array.isArray(requestedFormats) || requestedFormats.some((format) => typeof format !== 'string')) {
    return warningResponse(warning('artifact.formats_invalid', 'requested_formats must be an array of strings.'));
  }

  const validation = await validateArtifact(artifactPath, { requestedFormats });
  if (validation.ok) return { continue: true, status: 'passed', warnings: validation.warnings, validation };
  if (reviewAttempt === '1') {
    return {
      continue: true,
      status: 'invalid-after-corrective-pass',
      warnings: [warning('artifact.invalid_after_retry', 'Artifact remains invalid; the Stop hook will not request another pass.')],
      validation,
    };
  }
  return {
    decision: 'block',
    status: 'corrective-pass-requested',
    reason: correctiveReason(validation),
    warnings: validation.warnings,
    validation,
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

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(await main()));
}
