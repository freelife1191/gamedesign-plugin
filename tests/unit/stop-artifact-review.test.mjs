import assert from 'node:assert/strict';
import { cp, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../../shared/scripts/stop-artifact-review.mjs', import.meta.url));
const fixture = new URL('../fixtures/artifacts/valid/', import.meta.url);
const temporaryDirs = [];

afterEach(async () => {
  await Promise.all(temporaryDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function workspaceWithArtifact() {
  const workspace = await mkdtemp(join(tmpdir(), 'game-design-stop-'));
  temporaryDirs.push(workspace);
  const artifact = join(workspace, 'artifact');
  await cp(fixture, artifact, { recursive: true });
  return { workspace, artifact };
}

function runStop(cwd, input, env = {}) {
  const result = spawnSync(process.execPath, [script], {
    cwd,
    env: { PATH: process.env.PATH ?? '', ...env },
    input: typeof input === 'string' ? input : JSON.stringify(input),
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '');
  return JSON.parse(result.stdout);
}

test('ignores events without the game-design plugin marker', async () => {
  const { workspace } = await workspaceWithArtifact();
  const output = runStop(workspace, { artifact_path: 'artifact' });

  assert.deepEqual(output, { continue: true, status: 'ignored', warnings: [] });
});

test('passes a marked canonical artifact through the production validator', async () => {
  const { workspace } = await workspaceWithArtifact();
  const output = runStop(workspace, {
    plugin_marker: 'game-design-plugin-suite',
    artifact_path: 'artifact',
    requested_formats: ['md'],
  });

  assert.equal(output.continue, true);
  assert.equal(output.status, 'passed');
  assert.equal(output.validation.ok, true);
});

test('requests exactly one corrective pass for an invalid marked artifact', async () => {
  const { workspace, artifact } = await workspaceWithArtifact();
  await rm(join(artifact, 'evidence.yml'));

  const first = runStop(workspace, {
    plugin_marker: 'game-design-plugin-suite',
    artifact_path: 'artifact',
  });
  const retry = runStop(workspace, {
    plugin_marker: 'game-design-plugin-suite',
    artifact_path: 'artifact',
  }, { GAME_DESIGN_REVIEW_ATTEMPT: '1' });

  assert.equal(first.decision, 'block');
  assert.equal(first.status, 'corrective-pass-requested');
  assert.match(first.reason, /evidence\.yml/);
  assert.equal(retry.continue, true);
  assert.equal(retry.status, 'invalid-after-corrective-pass');
  assert.equal('decision' in retry, false);
});

test('fails closed with structured warnings for malformed input and unsafe paths', async () => {
  const { workspace, artifact } = await workspaceWithArtifact();
  const outside = await mkdtemp(join(tmpdir(), 'game-design-outside-'));
  temporaryDirs.push(outside);
  await symlink(artifact, join(workspace, 'linked-artifact'));

  const malformed = runStop(workspace, '{bad-json');
  assert.equal(malformed.continue, true);
  assert.equal(malformed.status, 'warning');
  assert.ok(malformed.warnings.some(({ code }) => code === 'input.invalid_json'));

  for (const artifactPath of ['../game-design-outside-', 'linked-artifact']) {
    const output = runStop(workspace, {
      plugin_marker: 'game-design-plugin-suite',
      artifact_path: artifactPath,
    });
    assert.equal(output.continue, true);
    assert.equal(output.status, 'warning');
    assert.ok(output.warnings.some(({ code }) => code === 'artifact.path_unsafe'));
  }
});

test('does not execute artifact paths as shell input', async () => {
  const { workspace } = await workspaceWithArtifact();
  const marker = join(workspace, 'injected');
  const output = runStop(workspace, {
    plugin_marker: 'game-design-plugin-suite',
    artifact_path: `artifact;touch ${marker}`,
  });

  assert.equal(output.status, 'warning');
  await assert.rejects(() => rm(marker), /ENOENT/);
});
