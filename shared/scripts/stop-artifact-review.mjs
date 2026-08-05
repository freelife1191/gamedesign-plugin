#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { lstat, readFile, realpath } from 'node:fs/promises';
import { isAbsolute, posix, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseRestrictedYaml, validateArtifact } from './validate-artifact.mjs';
import { inspectCompletePng } from './lib/complete-png-validation.mjs';
import { inspectRasterBuffer } from './lib/image-file-validation.mjs';
import { lintWithApprovedSkillstead } from './lib/skillstead-svg-evidence.mjs';
import { validateImageAssetManifest } from './validate-image-assets.mjs';

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

function imageGateError(code, message) {
  return { code, file: 'assets/image-assets.yml', message };
}

function markdownBindsAsset(content, assetPath) {
  return managedMarkdownImageReferences(content).some(({ path }) => path === assetPath);
}

function managedMarkdownImageReferences(content) {
  const references = [];
  for (const match of content.matchAll(/!\[[^\]\n]*\]\(\s*(?:<([^>\n]+)>|([^\s)]+))(?:\s+["'][^"']*["'])?\s*\)/gu)) {
    const raw = match[1] ?? match[2];
    if (raw.includes("?") || raw.includes("#") || raw.includes("\\") || raw.includes("\0")) continue;
    const normalized = posix.normalize(raw);
    if (!normalized.startsWith("assets/generated/") || !/\.(?:png|svg)$/iu.test(normalized)) continue;
    references.push({ raw, path: normalized, alias: raw !== normalized || raw !== raw.normalize("NFC") });
  }
  return references;
}

async function safeManagedArtifactFile(artifactPath, relativePath) {
  if (!isSafeRelativeArtifactPath(relativePath)) return false;
  let cursor = artifactPath;
  try {
    for (const part of relativePath.split("/")) {
      cursor = resolve(cursor, part);
      if ((await lstat(cursor)).isSymbolicLink()) return false;
    }
    const canonical = await realpath(cursor);
    return inside(artifactPath, canonical) && (await lstat(canonical)).isFile();
  } catch {
    return false;
  }
}

function exactKeys(value, required) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...required].sort());
}

function safeDigest(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);
}

async function hasBoundGenerationReceipt(artifactPath, asset) {
  const binding = asset.generation_receipts?.at(-1);
  if (!binding || !exactKeys(binding, ['attempt_id', 'path', 'sha256']) || !safeDigest(binding.sha256)
    || binding.path !== `assets/receipts/image-generation-${asset.asset_id}-${binding.attempt_id}.json`
    || !(await safeManagedArtifactFile(artifactPath, binding.path))) return false;
  try {
    const bytes = await readFile(resolve(artifactPath, binding.path));
    const receipt = JSON.parse(bytes.toString('utf8'));
    return digest(bytes) === binding.sha256
      && exactKeys(receipt, ['schema_version', 'kind', 'asset_id', 'attempt_id', 'reservation_path', 'reservation_sha256', 'provider', 'request_id', 'generated_at', 'prompt_digest', 'output_digest', 'requested_model', 'requested_quality', 'applied_model', 'applied_quality', 'failure_reason'])
      && receipt.schema_version === 1 && receipt.kind === 'image-generation-receipt' && receipt.asset_id === asset.asset_id && receipt.attempt_id === binding.attempt_id
      && receipt.reservation_path === `assets/receipts/image-generation-attempt-${binding.attempt_id}.json` && safeDigest(receipt.reservation_sha256)
      && (await safeManagedArtifactFile(artifactPath, receipt.reservation_path))
      && receipt.reservation_sha256 === digest(await readFile(resolve(artifactPath, receipt.reservation_path)))
      && typeof receipt.provider === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u.test(receipt.provider)
      && (receipt.request_id === null || typeof receipt.request_id === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u.test(receipt.request_id))
      && typeof receipt.generated_at === 'string' && !Number.isNaN(Date.parse(receipt.generated_at))
      && safeDigest(receipt.prompt_digest) && safeDigest(receipt.output_digest) && receipt.output_digest === digest(await readFile(resolve(artifactPath, asset.output.path)))
      && typeof receipt.requested_model === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u.test(receipt.requested_model)
      && ['low', 'medium', 'high', 'auto'].includes(receipt.requested_quality)
      && (receipt.applied_model === null || typeof receipt.applied_model === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u.test(receipt.applied_model))
      && (receipt.applied_quality === null || ['low', 'medium', 'high', 'auto'].includes(receipt.applied_quality))
      && receipt.failure_reason === null;
  } catch {
    return false;
  }
}

async function hasBoundDocumentApprovalReceipt(artifactPath, asset) {
  const review = [...asset.reviews].reverse().find(({ state }) => state === 'document-approved');
  const evidencePaths = review?.evidence_paths;
  const receiptPath = Array.isArray(evidencePaths) ? evidencePaths.at(-1) : undefined;
  const match = typeof receiptPath === 'string' && /^decisions\/image-review-([A-Za-z0-9][A-Za-z0-9._-]{0,127})\.json$/u.exec(receiptPath);
  if (!match || !(await safeManagedArtifactFile(artifactPath, receiptPath))) return false;
  try {
    const receipt = JSON.parse(await readFile(resolve(artifactPath, receiptPath), 'utf8'));
    if (!(exactKeys(receipt, ['schema_version', 'kind', 'capture', 'asset_id', 'from_state', 'target_state', 'decision', 'reviewer', 'decided_at', 'rights_decision', 'evidence_paths', 'evidence_digests'])
      && receipt.schema_version === 1 && receipt.kind === 'host-user-image-decision'
      && exactKeys(receipt.capture, ['channel', 'event_id']) && receipt.capture.channel === 'host-user-input' && receipt.capture.event_id === match[1]
      && receipt.asset_id === asset.asset_id && receipt.from_state === 'concept-draft' && receipt.target_state === 'document-approved' && receipt.decision === 'approved'
      && receipt.reviewer === review.reviewer && receipt.decided_at === review.reviewed_at && receipt.rights_decision === review.rights_decision
      && JSON.stringify(receipt.evidence_paths) === JSON.stringify(evidencePaths.slice(0, -1))
      && Array.isArray(receipt.evidence_digests) && receipt.evidence_digests.length === receipt.evidence_paths.length)) return false;
    if (asset.output.format !== 'svg' && (!(await hasBoundGenerationReceipt(artifactPath, asset))
      || !receipt.evidence_paths.includes(asset.output.path)
      || !receipt.evidence_paths.includes(asset.generation_receipts.at(-1).path))) return false;
    for (let index = 0; index < receipt.evidence_paths.length; index += 1) {
      const evidencePath = receipt.evidence_paths[index];
      const evidence = receipt.evidence_digests[index];
      if (!exactKeys(evidence, ['path', 'sha256']) || evidence.path !== evidencePath || typeof evidence.sha256 !== 'string' || !/^[a-f0-9]{64}$/u.test(evidence.sha256)
        || !(await safeManagedArtifactFile(artifactPath, evidencePath))) return false;
      if (digest(await readFile(resolve(artifactPath, evidencePath))) !== evidence.sha256) return false;
    }
    return true;
  } catch {
    return false;
  }
}

async function hasPassedSvgQa(artifactPath, asset, { runtimeModulePath, wrapperPath, spawnFn } = {}) {
  const evidencePath = `assets/qa/${asset.asset_id}.svg-qa.json`;
  if (!(await safeManagedArtifactFile(artifactPath, evidencePath)) || !(await safeManagedArtifactFile(artifactPath, asset.output.path))) return false;
  try {
    const value = JSON.parse(await readFile(resolve(artifactPath, evidencePath), 'utf8'));
    if (!exactSvgEvidence(value, asset) || !(await hasBoundDocumentApprovalReceipt(artifactPath, asset))) return false;
    const svg = await readFile(resolve(artifactPath, asset.output.path));
    const source = svg.toString('utf8');
    const metadata = svgMetadata(source);
    const svgDigest = digest(svg);
    if (!metadata || metadata.desc !== asset.alt_text || value.svg_sha256 !== svgDigest
      || value.lint.svg_sha256 !== svgDigest || value.render.svg_sha256 !== svgDigest || value.qa.svg_sha256 !== svgDigest
      || !(await lintWithApprovedSkillstead(resolve(artifactPath, asset.output.path), { runtimeModulePath, wrapperPath, spawnFn })).ok) return false;
    if (!(await safeManagedArtifactFile(artifactPath, value.render.png_path))) return false;
    const png = await readFile(resolve(artifactPath, value.render.png_path));
    const inspection = inspectCompletePng(png);
    const pngDigest = digest(png);
    return inspection.ok && inspection.width === metadata.width * 2 && inspection.height === metadata.height * 2
      && value.render.png_sha256 === pngDigest && value.qa.png_sha256 === pngDigest
      && value.render.width === inspection.width && value.render.height === inspection.height;
  } catch {
    return false;
  }
}

function digest(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function exactSvgEvidence(value, asset) {
  return exactKeys(value, ['schema_version', 'kind', 'asset_id', 'output_path', 'svg_sha256', 'lint', 'render', 'qa'])
    && value.schema_version === 1 && value.kind === 'skillstead-svg-evidence' && value.asset_id === asset.asset_id && value.output_path === asset.output.path
    && /^[a-f0-9]{64}$/u.test(value.svg_sha256)
    && exactKeys(value.lint, ['status', 'tool', 'version', 'svg_sha256']) && value.lint.status === 'passed'
    && value.lint.tool === 'Skillstead svg-infographic' && value.lint.version === '0.8.3' && /^[a-f0-9]{64}$/u.test(value.lint.svg_sha256)
    && exactKeys(value.render, ['status', 'renderer', 'svg_sha256', 'png_path', 'png_sha256', 'scale', 'width', 'height']) && value.render.status === 'passed'
    && typeof value.render.renderer === 'string' && /^Chromium(?:[ /]|$)/u.test(value.render.renderer)
    && typeof value.render.png_path === 'string' && /^[a-f0-9]{64}$/u.test(value.render.svg_sha256) && /^[a-f0-9]{64}$/u.test(value.render.png_sha256)
    && value.render.scale === 2 && Number.isInteger(value.render.width) && Number.isInteger(value.render.height)
    && exactKeys(value.qa, ['status', 'svg_sha256', 'png_sha256', 'checks']) && value.qa.status === 'passed'
    && /^[a-f0-9]{64}$/u.test(value.qa.svg_sha256) && /^[a-f0-9]{64}$/u.test(value.qa.png_sha256)
    && Array.isArray(value.qa.checks) && JSON.stringify([...value.qa.checks].sort()) === JSON.stringify(['alt-text', 'close-up', 'fit-to-page', 'source-fidelity']);
}

function svgMetadata(source) {
  if (/<(?:script|foreignObject)\b|<!DOCTYPE|<!ENTITY/iu.test(source)) return null;
  const root = /<svg(?:\s[^>]*)?>/iu.exec(source)?.[0];
  const viewBox = root && /\bviewBox\s*=\s*["']\s*[-+\d.eE]+\s+[-+\d.eE]+\s+([-+\d.eE]+)\s+([-+\d.eE]+)\s*["']/u.exec(root);
  const titles = [...source.matchAll(/<title(?:\s[^>]*)?>\s*([^<]+?)\s*<\/title>/giu)];
  const descriptions = [...source.matchAll(/<desc(?:\s[^>]*)?>\s*([^<]+?)\s*<\/desc>/giu)];
  const title = titles.length === 1 ? titles[0][1].trim() : undefined;
  const desc = descriptions.length === 1 ? descriptions[0][1].trim() : undefined;
  const width = Number(viewBox?.[1]);
  const height = Number(viewBox?.[2]);
  return title && desc && width > 0 && height > 0 ? { width, height, desc } : null;
}

function parseImageManifestYaml(source) {
  if (source.trimStart().startsWith("{")) return JSON.parse(source);
  const emptyArray = '__game_design_empty_array__';
  const normalized = source.replace(/^(\s*)(assets|reviews):\s*\[\]\s*$/gmu, `$1$2: "${emptyArray}"`);
  const manifest = parseRestrictedYaml(normalized, 'assets/image-assets.yml');
  if (manifest.assets === emptyArray) manifest.assets = [];
  if (Array.isArray(manifest.assets)) {
    for (const asset of manifest.assets) if (asset?.reviews === emptyArray) asset.reviews = [];
  }
  return manifest;
}

async function validateImageApprovalGate(artifactPath, requestedFormats, evidenceOptions) {
  let content;
  try {
    content = await readFile(resolve(artifactPath, 'content.md'), 'utf8');
  } catch {
    return [imageGateError('image.content_unreadable', 'Canonical content could not be read for image approval validation.')];
  }
  const references = managedMarkdownImageReferences(content);
  const referenceErrors = [];
  const seen = new Set();
  for (const reference of references) {
    if (reference.alias) referenceErrors.push(imageGateError('image.reference_alias', `Managed image reference must be canonical: ${reference.raw}`));
    if (seen.has(reference.path)) referenceErrors.push(imageGateError('image.reference_duplicate', `Managed image reference is duplicated: ${reference.path}`));
    seen.add(reference.path);
    if (!(await safeManagedArtifactFile(artifactPath, reference.path))) {
      referenceErrors.push(imageGateError('image.reference_unsafe', `Managed image reference is missing, non-regular, or traverses a symbolic link: ${reference.path}`));
    }
  }
  const manifestPath = resolve(artifactPath, 'assets', 'image-assets.yml');
  let source;
  try {
    if ((await lstat(manifestPath)).isSymbolicLink()) {
      return [...referenceErrors, imageGateError('image.manifest_unsafe', 'Image asset manifest must not be a symbolic link.')];
    }
    source = await readFile(manifestPath, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return references.length === 0 ? referenceErrors : [...referenceErrors, imageGateError('image.manifest_required', 'Managed generated image references require an image asset manifest.')];
    }
    return [...referenceErrors, imageGateError('image.manifest_unreadable', 'Image asset manifest could not be read.')];
  }

  let manifest;
  try {
    manifest = parseImageManifestYaml(source);
  } catch (error) {
    return [...referenceErrors, imageGateError('image.manifest_invalid', `Image asset manifest is not valid restricted YAML: ${error.message}`)];
  }
  const validation = validateImageAssetManifest(manifest, { artifactRoot: artifactPath });
  if (!validation.ok) {
    return [...referenceErrors, ...validation.errors.slice(0, 20).map(({ code, message }) => imageGateError(`image.${code}`, message))];
  }
  const outputIds = new Map();
  for (const asset of manifest.assets) {
    const ids = outputIds.get(asset.output.path) ?? [];
    ids.push(asset.asset_id);
    outputIds.set(asset.output.path, ids);
  }
  for (const [outputPath, ids] of outputIds) if (ids.length > 1) referenceErrors.push(imageGateError('image.manifest_duplicate_output', `Image manifest output is shared by multiple assets: ${outputPath}`));
  for (const reference of references) if (!outputIds.has(reference.path)) referenceErrors.push(imageGateError('image.reference_untracked', `Managed image reference is not tracked by the image manifest: ${reference.path}`));
  for (const asset of manifest.assets) {
    if (references.some(({ path }) => path === asset.output.path) && !(await hasBoundDocumentApprovalReceipt(artifactPath, asset))) {
      referenceErrors.push(imageGateError('image.approval_receipt_required', `Managed image requires a matching host-user document approval receipt: ${asset.asset_id}`));
    }
    if (asset.output.format === 'svg' && references.some(({ path }) => path === asset.output.path) && !(await hasPassedSvgQa(artifactPath, asset, evidenceOptions))) {
      referenceErrors.push(imageGateError('image.svg_qa_required', `Managed SVG requires passed Skillstead lint, render, and QA evidence: ${asset.asset_id}`));
    }
    if (asset.output.format !== 'svg' && references.some(({ path }) => path === asset.output.path)) {
      try {
        const raster = inspectRasterBuffer(await readFile(resolve(artifactPath, asset.output.path)), asset.output);
        if (!raster.ok) referenceErrors.push(imageGateError('image.raster_invalid', `Managed raster must be complete and match manifest dimensions: ${asset.asset_id}`));
      } catch {
        referenceErrors.push(imageGateError('image.raster_invalid', `Managed raster must be complete and match manifest dimensions: ${asset.asset_id}`));
      }
    }
  }
  if (!Array.isArray(requestedFormats) || requestedFormats.length === 0) return referenceErrors;
  return [...referenceErrors, ...manifest.assets
    .filter((asset) => markdownBindsAsset(content, asset.output.path) && asset.approval_state === 'concept-draft')
    .map(({ asset_id }) => imageGateError(
      'image.approval_required',
      `Final derivative binding requires document-approved image asset: ${asset_id}`,
    ))];
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

export async function reviewStopEvent(input, {
  reviewAttempt = process.env.GAME_DESIGN_REVIEW_ATTEMPT,
  wrapperPath,
  spawnFn,
  runtimeModulePath = fileURLToPath(import.meta.url),
} = {}) {
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
  validation.errors.push(...await validateImageApprovalGate(artifactPath, parsed.marker.formats, { runtimeModulePath, wrapperPath, spawnFn }));
  validation.ok = validation.errors.length === 0;
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
