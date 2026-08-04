import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { validateArtifact } from '../../shared/scripts/validate-artifact.mjs';

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
