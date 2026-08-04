import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { parseRestrictedYaml, validateArtifact } from '../../shared/scripts/validate-artifact.mjs';

const fixtureDir = new URL('../fixtures/artifacts/valid/', import.meta.url);
const temporaryDirs = [];

afterEach(async () => {
  await Promise.all(temporaryDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function temporaryArtifact() {
  const dir = await mkdtemp(join(tmpdir(), 'game-design-artifact-'));
  temporaryDirs.push(dir);
  await cp(fixtureDir, dir, { recursive: true });
  return dir;
}

async function replaceIn(dir, relativePath, before, after) {
  const path = join(dir, relativePath);
  const source = await readFile(path, 'utf8');
  assert.ok(source.includes(before), `fixture must contain ${JSON.stringify(before)}`);
  await writeFile(path, source.replace(before, after));
}

function messages(result) {
  return result.errors.map((error) => error.message).join('\n');
}

test('accepts a complete canonical artifact', async () => {
  const result = await validateArtifact(new URL('../fixtures/artifacts/valid/', import.meta.url), {
    requestedFormats: ['md', 'pdf', 'docx', 'pptx'],
  });

  assert.equal(result.ok, true, messages(result));
  assert.deepEqual(result.requestedFormats, ['md', 'pdf', 'docx', 'pptx']);
  assert.deepEqual(result.files, [
    'assets/system-map.svg',
    'content.md',
    'decisions/0001-core-loop.md',
    'evidence.yml',
    'export-manifest.yml',
  ]);
  assert.deepEqual(result.errors, []);
});

test('rejects content without frontmatter', async () => {
  const dir = await temporaryArtifact();
  await replaceIn(dir, 'content.md', '---\ntitle: Canonical Combat Brief\nartifact_id: combat-brief\nversion: 1\n---\n', '');

  const result = await validateArtifact(dir);

  assert.equal(result.ok, false);
  assert.match(messages(result), /frontmatter/i);
});

test('rejects content with more than one H1', async () => {
  const dir = await temporaryArtifact();
  await replaceIn(dir, 'content.md', '## Evidence {#evidence}', '# Evidence {#evidence}');

  const result = await validateArtifact(dir);

  assert.equal(result.ok, false);
  assert.match(messages(result), /exactly one H1/i);
});

test('rejects headings without stable explicit IDs', async () => {
  const dir = await temporaryArtifact();
  await replaceIn(dir, 'content.md', '## Evidence {#evidence}', '## Evidence');

  const result = await validateArtifact(dir);

  assert.equal(result.ok, false);
  assert.match(messages(result), /stable heading ID/i);
});

test('rejects absolute asset paths', async () => {
  const dir = await temporaryArtifact();
  await replaceIn(dir, 'content.md', 'assets/system-map.svg', '/tmp/system-map.svg');

  const result = await validateArtifact(dir);

  assert.equal(result.ok, false);
  assert.match(messages(result), /relative local asset/i);
});

test('rejects images with empty alt text', async () => {
  const dir = await temporaryArtifact();
  await replaceIn(dir, 'content.md', '![Combat system map]', '![]');

  const result = await validateArtifact(dir);

  assert.equal(result.ok, false);
  assert.match(messages(result), /nonempty alt text/i);
});

test('rejects non-NFC Markdown', async () => {
  const dir = await temporaryArtifact();
  await replaceIn(dir, 'content.md', 'Player', 'Cafe\u0301 Player');

  const result = await validateArtifact(dir);

  assert.equal(result.ok, false);
  assert.match(messages(result), /NFC/i);
});

test('rejects evidence claims without claim_type', async () => {
  const dir = await temporaryArtifact();
  await replaceIn(dir, 'evidence.yml', '    claim_type: playtest\n', '');

  const result = await validateArtifact(dir);

  assert.equal(result.ok, false);
  assert.match(messages(result), /claim_type/i);
});

for (const [field, line] of [
  ['audience', '    audience: studio review panel\n'],
  ['purpose', '    purpose: explain the combat loop and its evidence\n'],
  ['slide_outline', '    slide_outline:\n      - title: Design goal\n      - title: Core loop\n      - title: Evidence and risks\n'],
]) {
  test(`rejects a requested PPTX without ${field}`, async () => {
    const dir = await temporaryArtifact();
    await replaceIn(dir, 'export-manifest.yml', line, '');

    const result = await validateArtifact(dir, { requestedFormats: ['pptx'] });

    assert.equal(result.ok, false);
    assert.match(messages(result), new RegExp(field));
  });
}

test('rejects unsupported YAML features instead of guessing', async () => {
  const dir = await temporaryArtifact();
  await replaceIn(dir, 'evidence.yml', 'version: 1', 'version: &version 1');

  const result = await validateArtifact(dir);

  assert.equal(result.ok, false);
  assert.match(messages(result), /unsupported YAML.*anchor/i);
});

test('accepts YAML punctuation inside a quoted scalar', async () => {
  const dir = await temporaryArtifact();
  await replaceIn(
    dir,
    'evidence.yml',
    'claim: Players understood the risk-reward loop after one encounter.',
    'claim: "Players saw: risk # reward &recovery."',
  );

  const result = await validateArtifact(dir);

  assert.equal(result.ok, true, messages(result));
});

for (const traversal of ['assets/../content.md', 'assets/sub/../../content.md']) {
  test(`rejects asset traversal outside assets/: ${traversal}`, async () => {
    const dir = await temporaryArtifact();
    await replaceIn(dir, 'content.md', 'assets/system-map.svg', traversal);

    const result = await validateArtifact(dir);

    assert.equal(result.ok, false);
    assert.match(messages(result), /inside assets/i);
  });
}

test('does not interpret literal block payload as YAML anchors', async () => {
  const dir = await temporaryArtifact();
  await replaceIn(
    dir,
    'evidence.yml',
    '      Results do not yet represent new players.',
    '      Results do not yet represent new players &recovery.',
  );

  const result = await validateArtifact(dir);

  assert.equal(result.ok, true, messages(result));
});

for (const indicator of ['|-', '|+', '|2']) {
  test(`rejects unsupported literal block indicator ${indicator}`, async () => {
    const dir = await temporaryArtifact();
    await replaceIn(dir, 'evidence.yml', 'limitations: |', `limitations: ${indicator}`);

    const result = await validateArtifact(dir);

    assert.equal(result.ok, false);
    assert.match(messages(result), /unsupported YAML.*block scalar indicator/i);
  });
}

test('rejects an unescaped quote inside a single-quoted scalar', async () => {
  const dir = await temporaryArtifact();
  await replaceIn(
    dir,
    'evidence.yml',
    'claim: Players understood the risk-reward loop after one encounter.',
    "claim: 'Players' recovery'",
  );

  const result = await validateArtifact(dir);

  assert.equal(result.ok, false);
  assert.match(messages(result), /invalid single-quoted scalar/i);
});

test('accepts doubled apostrophes inside a single-quoted scalar', async () => {
  const dir = await temporaryArtifact();
  await replaceIn(
    dir,
    'evidence.yml',
    'claim: Players understood the risk-reward loop after one encounter.',
    "claim: 'Players'' recovery'",
  );

  const result = await validateArtifact(dir);

  assert.equal(result.ok, true, messages(result));
});

test('parses every YAML mapping with a null prototype', () => {
  const parsed = parseRestrictedYaml('root:\n  - child:\n      value: safe\n');

  assert.equal(Object.getPrototypeOf(parsed), null);
  assert.equal(Object.getPrototypeOf(parsed.root[0]), null);
  assert.equal(Object.getPrototypeOf(parsed.root[0].child), null);
});

for (const key of ['__proto__', 'prototype', 'constructor']) {
  test(`rejects prototype-sensitive YAML key ${key}`, () => {
    assert.throws(
      () => parseRestrictedYaml(`${key}: polluted\n`),
      /unsafe mapping key/i,
    );
  });
}

test('counts a CommonMark-indented H1', async () => {
  const dir = await temporaryArtifact();
  await replaceIn(dir, 'content.md', '## Evidence {#evidence}', '   # Evidence {#evidence}');

  const result = await validateArtifact(dir);

  assert.equal(result.ok, false);
  assert.match(messages(result), /exactly one H1/i);
});

test('requires stable IDs on CommonMark-indented headings', async () => {
  const dir = await temporaryArtifact();
  await replaceIn(dir, 'content.md', '## Evidence {#evidence}', '   ## Evidence');

  const result = await validateArtifact(dir);

  assert.equal(result.ok, false);
  assert.match(messages(result), /stable heading ID/i);
});

test('ignores heading-like lines inside fenced code blocks', async () => {
  const dir = await temporaryArtifact();
  await replaceIn(
    dir,
    'content.md',
    'The design is grounded in the linked playtest evidence.',
    'The design is grounded in the linked playtest evidence.\n\n```md\n# Example without ID\n## Also not a heading\n```',
  );

  const result = await validateArtifact(dir);

  assert.equal(result.ok, true, messages(result));
});

test('rejects reference-style images when they cannot be validated', async () => {
  const dir = await temporaryArtifact();
  await replaceIn(
    dir,
    'content.md',
    '![Combat system map](assets/system-map.svg)',
    '![Combat system map][system-map]\n\n[system-map]: assets/system-map.svg',
  );

  const result = await validateArtifact(dir);

  assert.equal(result.ok, false);
  assert.match(messages(result), /unsupported.*reference-style image/i);
});

test('rejects angle-bracket image destinations when they cannot be validated', async () => {
  const dir = await temporaryArtifact();
  await replaceIn(dir, 'content.md', 'assets/system-map.svg', '<assets/system-map.svg>');

  const result = await validateArtifact(dir);

  assert.equal(result.ok, false);
  assert.match(messages(result), /unsupported.*angle-bracket image destination/i);
});

test('rejects HTML images even when Markdown images are also present', async () => {
  const dir = await temporaryArtifact();
  await replaceIn(
    dir,
    'content.md',
    '![Combat system map](assets/system-map.svg)',
    '![Combat system map](assets/system-map.svg)\n\n<img src="assets/system-map.svg" alt="duplicate">',
  );

  const result = await validateArtifact(dir);

  assert.equal(result.ok, false);
  assert.match(messages(result), /HTML images are unsupported/i);
});

for (const [location, before, extra] of [
  ['evidence top level', 'claims:\n', 'unknown: value\nclaims:\n'],
  ['claim', '    claim_type: playtest\n', '    claim_type: playtest\n    unknown: value\n'],
  ['source', '      title: Internal combat prototype playtest\n', '      title: Internal combat prototype playtest\n      unknown: value\n'],
]) {
  test(`rejects schema-unknown keys at ${location}`, async () => {
    const dir = await temporaryArtifact();
    await replaceIn(dir, 'evidence.yml', before, extra);

    const result = await validateArtifact(dir);

    assert.equal(result.ok, false);
    assert.match(messages(result), /unknown key/i);
  });
}

test('rejects schema-unknown frontmatter keys', async () => {
  const dir = await temporaryArtifact();
  await replaceIn(dir, 'content.md', 'version: 1\n---', 'version: 1\nunknown: value\n---');

  const result = await validateArtifact(dir);

  assert.equal(result.ok, false);
  assert.match(messages(result), /unknown key/i);
});

test('rejects non-kebab-case artifact IDs', async () => {
  const dir = await temporaryArtifact();
  await replaceIn(dir, 'content.md', 'artifact_id: combat-brief', 'artifact_id: Combat_Brief');

  const result = await validateArtifact(dir);

  assert.equal(result.ok, false);
  assert.match(messages(result), /artifact_id.*kebab-case/i);
});

test('rejects non-kebab-case claim IDs', async () => {
  const dir = await temporaryArtifact();
  await replaceIn(dir, 'evidence.yml', 'id: claim-core-loop-clarity', 'id: Claim_Core_Loop');

  const result = await validateArtifact(dir);

  assert.equal(result.ok, false);
  assert.match(messages(result), /claims\[0\]\.id.*kebab-case/i);
});

test('rejects malformed source URIs when url is present', async () => {
  const dir = await temporaryArtifact();
  await replaceIn(
    dir,
    'evidence.yml',
    '      locator: decisions/0001-core-loop.md\n',
    '      locator: decisions/0001-core-loop.md\n      url: not-a-uri\n',
  );

  const result = await validateArtifact(dir);

  assert.equal(result.ok, false);
  assert.match(messages(result), /source\.url.*URI/i);
});

test('rejects impossible ISO calendar dates', async () => {
  const dir = await temporaryArtifact();
  await replaceIn(dir, 'evidence.yml', 'accessed_at: 2026-08-04', 'accessed_at: 2026-02-30');

  const result = await validateArtifact(dir);

  assert.equal(result.ok, false);
  assert.match(messages(result), /source\.accessed_at.*calendar date/i);
});
