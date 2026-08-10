import { createHash } from 'node:crypto';

const DIAGRAM_TYPES = new Set(['architecture', 'workflow', 'sequence', 'dataflow', 'lifecycle']);
const CHECK_NAMES = new Set([
  'single_svg',
  'finite_svg',
  'orthogonal_arrows',
  'label_route_clearance',
  'relationship_crossings',
  'relationship_corridors',
  'container_border_runs',
  'route_rhythm',
  'legend_clearance',
]);
const DIGEST_RE = /^[a-f0-9]{64}$/u;

function requireRecord(value, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value;
}

function requireExact(value, expected, label) {
  if (value !== expected) throw new Error(`${label} must be ${JSON.stringify(expected)}`);
}

function requireNonEmptyString(value, label) {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`${label} must be a non-empty string`);
}

function requireDiagramType(value) {
  if (!DIAGRAM_TYPES.has(value)) throw new Error(`type must be one of ${[...DIAGRAM_TYPES].join(', ')}`);
}

function requireDigest(value, label) {
  if (typeof value !== 'string' || !DIGEST_RE.test(value)) throw new Error(`${label} digest must be a lowercase SHA-256 hex digest`);
}

function requireByteCount(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label} byte count must be a non-negative safe integer`);
}

function validateReceiptHeader(receipt, command) {
  requireRecord(receipt, 'receipt');
  requireExact(receipt.schemaVersion, 1, 'schemaVersion');
  requireExact(receipt.ok, true, 'ok');
  requireExact(receipt.command, command, 'command');
  requireDiagramType(receipt.type);
}

function validateComposition(composition) {
  requireRecord(composition, 'composition');
  requireExact(composition.schemaVersion, 1, 'composition schemaVersion');
  requireExact(composition.profile, 'showcase', 'composition profile');
  requireExact(composition.status, 'pass', 'composition status');
  requireRecord(composition.summary, 'composition summary');
  requireExact(composition.summary.errors, 0, 'composition errors');
  requireExact(composition.summary.warnings, 0, 'composition warnings');
}

function validateArtifactChecks(checks) {
  if (!Array.isArray(checks) || checks.length !== CHECK_NAMES.size) throw new Error('Expected exactly 9 artifact checks');
  const names = new Set();
  for (const check of checks) {
    requireRecord(check, 'artifact check');
    if (typeof check.name !== 'string' || !CHECK_NAMES.has(check.name) || names.has(check.name)) {
      throw new Error('invalid artifact check');
    }
    requireExact(check.ok, true, `artifact check ${check.name}`);
    names.add(check.name);
  }
  if (names.size !== CHECK_NAMES.size) throw new Error('invalid artifact check');
}

function validateDeliverValidation(validation) {
  requireRecord(validation, 'validation');
  requireExact(validation.checksPassed, 9, 'validation checks passed');
  requireExact(validation.checkCount, 9, 'validation check count');
  requireExact(validation.errors, 0, 'validation errors');
  requireExact(validation.warnings, 0, 'validation warnings');
  requireExact(validation.compositionProfile, 'showcase', 'validation composition profile');
  requireExact(validation.compositionStatus, 'pass', 'validation composition status');
}

function validateDigestRecord(record, label) {
  requireRecord(record, label);
  requireDigest(record.sha256, label);
  requireByteCount(record.bytes, label);
}

function identityFrom(value, label) {
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
    const bytes = Buffer.from(value);
    return { sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.byteLength };
  }
  if (value && typeof value === 'object') {
    validateDigestRecord(value, label);
    return { sha256: value.sha256, bytes: value.bytes };
  }
  throw new Error(`${label} identity must provide bytes or sha256 and byte count`);
}

function assertIdentityMatches(receiptIdentity, actual, label) {
  if (actual === undefined) return;
  const expected = identityFrom(actual, label);
  if (receiptIdentity.sha256 !== expected.sha256) throw new Error(`${label} digest does not match bytes`);
  if (receiptIdentity.bytes !== expected.bytes) throw new Error(`${label} byte count does not match bytes`);
}

function stablePath(value, label) {
  if (typeof value !== 'string' || value.length === 0 || value.length > 4096 || value.includes('\0') || value.includes('\\')) {
    throw new Error(`${label} must be a safe relative POSIX path`);
  }
  const parts = value.split('/');
  if (value.startsWith('/') || /^[a-z][a-z0-9+.-]*:/iu.test(value) || parts.some((part) => part === '' || part === '.' || part === '..')
    || parts.some((part) => part.toLowerCase().includes('.curated-archify-temp'))) {
    throw new Error(`${label} must be a safe relative POSIX path`);
  }
  return value;
}

export function validateArchifyValidateReceipt(receipt) {
  validateReceiptHeader(receipt, 'validate');
  requireNonEmptyString(receipt.input, 'input');
  validateArtifactChecks(receipt.checks);
  validateComposition(receipt.composition);
  return receipt;
}

export function validateArchifyDeliverReceipt(receipt, files = undefined) {
  validateReceiptHeader(receipt, 'deliver');
  requireNonEmptyString(receipt.input, 'input');
  requireNonEmptyString(receipt.output, 'output');
  validateDigestRecord(receipt.specification, 'specification');
  validateDigestRecord(receipt.artifact, 'artifact');
  validateDeliverValidation(receipt.validation);
  if (files !== undefined) {
    requireRecord(files, 'receipt files');
    assertIdentityMatches(receipt.specification, files.specification, 'specification');
    assertIdentityMatches(receipt.artifact, files.artifact, 'artifact');
  }
  return receipt;
}

export function toPersistedArchifyReceipt(receipt, stablePaths, files = undefined) {
  validateArchifyDeliverReceipt(receipt, files);
  requireRecord(stablePaths, 'stable paths');
  const input = stablePath(stablePaths.input, 'input');
  const output = stablePath(stablePaths.output, 'output');
  return Object.freeze({
    schemaVersion: 1,
    ok: true,
    command: 'deliver',
    type: receipt.type,
    quality: 'showcase',
    checksPassed: 9,
    checkCount: 9,
    errors: 0,
    warnings: 0,
    compositionProfile: 'showcase',
    compositionStatus: 'pass',
    input,
    output,
    specification: { sha256: receipt.specification.sha256, bytes: receipt.specification.bytes },
    artifact: { sha256: receipt.artifact.sha256, bytes: receipt.artifact.bytes },
  });
}
