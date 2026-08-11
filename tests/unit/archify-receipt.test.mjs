import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';

import {
  toPersistedArchifyReceipt,
  validateArchifyDeliverReceipt,
  validateArchifyValidateReceipt,
} from '../../tooling/lib/archify-receipt.mjs';

const SPECIFICATION = Buffer.from('{"meta":{"quality_profile":"showcase"}}\n');
const ARTIFACT = Buffer.from('<!doctype html><title>verified</title>\n');
const DIGEST = (value) => createHash('sha256').update(value).digest('hex');
const TYPES = ['architecture', 'workflow', 'sequence', 'dataflow', 'lifecycle'];
const CHECK_NAMES = [
  'single_svg',
  'finite_svg',
  'orthogonal_arrows',
  'label_route_clearance',
  'relationship_crossings',
  'relationship_corridors',
  'container_border_runs',
  'route_rhythm',
  'legend_clearance',
];

function validateReceipt(overrides = {}) {
  return {
    schemaVersion: 1,
    ok: true,
    command: 'validate',
    type: 'workflow',
    input: '/private/spec.json',
    checks: CHECK_NAMES.map((name) => ({ name, ok: true, details: [] })),
    composition: {
      schemaVersion: 1,
      profile: 'showcase',
      status: 'pass',
      summary: { errors: 0, warnings: 0 },
    },
    ...overrides,
  };
}

function deliverReceipt({ specification, artifact, validation, ...overrides } = {}) {
  return {
    schemaVersion: 1,
    ok: true,
    command: 'deliver',
    type: 'workflow',
    input: '/private/spec.json',
    output: '/private/out.html',
    specification: { sha256: DIGEST(SPECIFICATION), bytes: SPECIFICATION.byteLength, ...specification },
    artifact: { sha256: DIGEST(ARTIFACT), bytes: ARTIFACT.byteLength, ...artifact },
    validation: {
      checksPassed: 9,
      checkCount: 9,
      compositionProfile: 'showcase',
      compositionStatus: 'pass',
      errors: 0,
      warnings: 0,
      ...validation,
    },
    ...overrides,
  };
}

function fixtureFiles() {
  return { specification: SPECIFICATION, artifact: ARTIFACT };
}

function stablePaths() {
  return { input: 'guides/assets/archify/studio/example.workflow.json', output: 'guides/assets/archify/studio/example.workflow.html' };
}

test('accepts the exact actual Archify validate receipt contract', () => {
  assert.equal(validateArchifyValidateReceipt(validateReceipt()).type, 'workflow');
});

test('accepts the exact actual Archify deliver receipt contract', () => {
  assert.equal(validateArchifyDeliverReceipt(deliverReceipt(), fixtureFiles()).validation.checkCount, 9);
});

test('deliver and persisted receipts require independently supplied artifact bytes', () => {
  const receipt = deliverReceipt();
  assert.throws(() => validateArchifyDeliverReceipt(receipt), /evidence/u);
  assert.throws(() => toPersistedArchifyReceipt(receipt, stablePaths()), /evidence/u);
});

test('deliver receipt rejects self-reported identity evidence', () => {
  const receipt = deliverReceipt();
  const forgedIdentity = {
    specification: { sha256: receipt.specification.sha256, bytes: receipt.specification.bytes },
    artifact: { sha256: receipt.artifact.sha256, bytes: receipt.artifact.bytes },
  };
  assert.throws(() => validateArchifyDeliverReceipt(receipt, forgedIdentity), /bytes/u);
  assert.throws(() => toPersistedArchifyReceipt(receipt, stablePaths(), forgedIdentity), /bytes/u);
});

test('receipt validators reject each omitted top-level required value', () => {
  for (const key of ['schemaVersion', 'ok', 'command', 'type', 'input', 'checks', 'composition']) {
    const receipt = validateReceipt();
    delete receipt[key];
    assert.throws(() => validateArchifyValidateReceipt(receipt), new RegExp(key, 'u'));
  }
  for (const key of ['schemaVersion', 'ok', 'command', 'type', 'input', 'output', 'specification', 'artifact', 'validation']) {
    const receipt = deliverReceipt();
    delete receipt[key];
    assert.throws(() => validateArchifyDeliverReceipt(receipt, fixtureFiles()), new RegExp(key, 'u'));
  }
});

test('validate receipt rejects an omitted composition schema version', () => {
  const receipt = validateReceipt();
  delete receipt.composition.schemaVersion;
  assert.throws(() => validateArchifyValidateReceipt(receipt), /schemaVersion/u);
});

for (const [name, mutate, pattern] of [
  ['schemaVersion', (receipt) => { receipt.schemaVersion = 999; }, /schemaVersion/u],
  ['ok', (receipt) => { receipt.ok = false; }, /ok/u],
  ['command', (receipt) => { receipt.command = 'preview'; }, /command/u],
  ['type', (receipt) => { receipt.type = 'unknown'; }, /type/u],
  ['duplicate check', (receipt) => { receipt.checks[1].name = receipt.checks[0].name; }, /invalid artifact check/u],
  ['false check', (receipt) => { receipt.checks[0].ok = false; }, /artifact check/u],
  ['wrong check count', (receipt) => { receipt.checks.pop(); }, /9/u],
  ['errors', (receipt) => { receipt.composition.summary.errors = 1; }, /errors/u],
  ['warnings', (receipt) => { receipt.composition.summary.warnings = 1; }, /warnings/u],
  ['profile', (receipt) => { receipt.composition.profile = 'standard'; }, /showcase/u],
  ['status', (receipt) => { receipt.composition.status = 'fail'; }, /composition/u],
]) {
  test(`validate receipt rejects ${name}`, () => {
    const receipt = validateReceipt();
    mutate(receipt);
    assert.throws(() => validateArchifyValidateReceipt(receipt), pattern);
  });
}

for (const [name, mutate, pattern] of [
  ['wrong count', (receipt) => { receipt.validation.checkCount = 8; }, /9/u],
  ['errors', (receipt) => { receipt.validation.errors = 1; }, /errors/u],
  ['warnings', (receipt) => { receipt.validation.warnings = 1; }, /warnings/u],
  ['profile', (receipt) => { receipt.validation.compositionProfile = 'standard'; }, /showcase/u],
  ['status', (receipt) => { receipt.validation.compositionStatus = 'fail'; }, /pass/u],
  ['digest', (receipt) => { receipt.artifact.sha256 = '0'.repeat(64); }, /digest/u],
  ['bytes', (receipt) => { receipt.artifact.bytes += 1; }, /byte count/u],
]) {
  test(`deliver receipt rejects ${name}`, () => {
    const receipt = deliverReceipt();
    mutate(receipt);
    assert.throws(() => validateArchifyDeliverReceipt(receipt, fixtureFiles()), pattern);
  });
}

test('deliver receipt rejects omitted showcase status and strips nested extras', () => {
  assert.throws(() => validateArchifyDeliverReceipt(deliverReceipt({ validation: { compositionProfile: undefined } }), fixtureFiles()), /showcase/u);
  assert.throws(() => validateArchifyDeliverReceipt(deliverReceipt({ validation: { compositionStatus: undefined } }), fixtureFiles()), /pass/u);
  const saved = toPersistedArchifyReceipt(deliverReceipt({
    specification: { debugPath: 'file:///private/secret' },
  }), stablePaths(), fixtureFiles());
  assert.deepEqual(Object.keys(saved.specification).sort(), ['bytes', 'sha256']);
});

for (const leaked of [
  '/private/secret', 'C:\\secret\\file', 'file:///private/secret',
  '../../escape', '.curated-archify-temp/path',
]) {
  test(`persisted receipt omits unsafe extra ${leaked}`, () => {
    const receipt = deliverReceipt({ specification: { debugPath: leaked } });
    const saved = toPersistedArchifyReceipt(receipt, stablePaths(), fixtureFiles());
    assert.equal(JSON.stringify(saved).includes(leaked), false);
  });
}

test('persisted receipt has an exact allowlisted shape', () => {
  const saved = toPersistedArchifyReceipt(deliverReceipt(), stablePaths(), fixtureFiles());
  assert.deepEqual(saved, {
    schemaVersion: 1,
    ok: true,
    command: 'deliver',
    type: 'workflow',
    quality: 'showcase',
    checksPassed: 9,
    checkCount: 9,
    errors: 0,
    warnings: 0,
    compositionProfile: 'showcase',
    compositionStatus: 'pass',
    input: stablePaths().input,
    output: stablePaths().output,
    specification: { sha256: DIGEST(SPECIFICATION), bytes: SPECIFICATION.byteLength },
    artifact: { sha256: DIGEST(ARTIFACT), bytes: ARTIFACT.byteLength },
  });
  assert.equal(Object.isFrozen(saved), true);
});

test('persisted receipt rejects both wrong specification bytes and wrong artifact bytes', () => {
  assert.throws(() => toPersistedArchifyReceipt(deliverReceipt(), stablePaths(), {
    specification: Buffer.from('forged specification\n'),
    artifact: ARTIFACT,
  }), /digest|byte count/u);
  assert.throws(() => toPersistedArchifyReceipt(deliverReceipt(), stablePaths(), {
    specification: SPECIFICATION,
    artifact: Buffer.from('forged artifact\n'),
  }), /digest|byte count/u);
});

test('receipt validators reject unsupported diagram types', () => {
  for (const type of TYPES) {
    assert.equal(validateArchifyValidateReceipt(validateReceipt({ type })).type, type);
  }
  assert.throws(() => validateArchifyDeliverReceipt(deliverReceipt({ type: 'unknown' }), fixtureFiles()), /type/u);
});
