import assert from 'node:assert/strict';
import { cp, mkdtemp, mkdir, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { isAbsolute, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../../shared/scripts/stop-artifact-review.mjs', import.meta.url));
const fixture = new URL('../fixtures/artifacts/valid/', import.meta.url);
const temporaryDirs = [];
const { reviewStopEvent } = await import('../../shared/scripts/stop-artifact-review.mjs');

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

function sentinel(path = 'artifact', formats = ['md']) {
  return `<!-- game-design-plugin:artifact ${JSON.stringify({ path, formats })} -->`;
}

function officialPayload(workspace, overrides = {}) {
  return {
    session_id: 'session-task-7',
    transcript_path: '/redacted/transcript.jsonl',
    permission_mode: 'default',
    hook_event_name: 'Stop',
    cwd: workspace,
    turn_id: 'turn-task-7',
    stop_hook_active: false,
    last_assistant_message: `Canonical artifact ready.\n\n${sentinel()}`,
    ...overrides,
  };
}

function runStop(input, env = {}) {
  const result = spawnSync(process.execPath, [script], {
    cwd: fileURLToPath(new URL('../../', import.meta.url)),
    env: { PATH: process.env.PATH ?? '', ...env },
    input: typeof input === 'string' ? input : JSON.stringify(input),
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '');
  return { output: JSON.parse(result.stdout), stdout: result.stdout };
}

test('ignores an official Stop event without the final artifact sentinel', async () => {
  const { workspace } = await workspaceWithArtifact();
  const { output } = runStop(officialPayload(workspace, { last_assistant_message: 'Normal response.' }));

  assert.deepEqual(output, { continue: true, status: 'ignored', warnings: [] });
});

test('direct module API accepts the same official payload contract', async () => {
  const { workspace } = await workspaceWithArtifact();
  const output = await reviewStopEvent(officialPayload(workspace));

  assert.equal(output.status, 'passed');
  assert.equal(output.validation.ok, true);
});

test('passes a valid sentinel artifact and forwards requested formats', async () => {
  const { workspace } = await workspaceWithArtifact();
  const { output } = runStop(officialPayload(workspace, {
    last_assistant_message: `Ready.\n${sentinel('artifact', ['md', 'pdf'])}`,
  }));

  assert.equal(output.continue, true);
  assert.equal(output.status, 'passed');
  assert.equal(output.validation.ok, true);
  assert.deepEqual(output.validation.requestedFormats, ['md', 'pdf']);
});

test('uses stop_hook_active to request exactly one corrective pass', async () => {
  const { workspace, artifact } = await workspaceWithArtifact();
  await rm(join(artifact, 'evidence.yml'));
  const input = officialPayload(workspace);

  const first = runStop(input).output;
  const retry = runStop({ ...input, stop_hook_active: true }).output;

  assert.equal(first.decision, 'block');
  assert.equal(first.status, 'corrective-pass-requested');
  assert.match(first.reason, /evidence\.yml/);
  assert.equal(retry.continue, true);
  assert.equal(retry.status, 'invalid-after-corrective-pass');
  assert.equal('decision' in retry, false);
});

test('official stop_hook_active takes priority and env retry remains a compatibility fallback', async () => {
  const { workspace, artifact } = await workspaceWithArtifact();
  await rm(join(artifact, 'evidence.yml'));

  const officialRetry = runStop(officialPayload(workspace, { stop_hook_active: true }), {
    GAME_DESIGN_REVIEW_ATTEMPT: '0',
  }).output;
  const environmentRetry = runStop(officialPayload(workspace), {
    GAME_DESIGN_REVIEW_ATTEMPT: '1',
  }).output;

  assert.equal(officialRetry.status, 'invalid-after-corrective-pass');
  assert.equal(environmentRetry.status, 'invalid-after-corrective-pass');
  assert.equal('decision' in officialRetry, false);
  assert.equal('decision' in environmentRetry, false);
});

test('rejects malformed stdin and malformed, duplicate, non-final, or oversized sentinels without blocking', async () => {
  const { workspace } = await workspaceWithArtifact();
  const cases = [
    ['malformed JSON input', '{bad-json', 'input.invalid_json'],
    ['malformed sentinel JSON', officialPayload(workspace, { last_assistant_message: '<!-- game-design-plugin:artifact {bad} -->' }), 'marker.invalid'],
    ['duplicate sentinel', officialPayload(workspace, { last_assistant_message: `${sentinel()}\n${sentinel()}` }), 'marker.duplicate'],
    ['non-final sentinel', officialPayload(workspace, { last_assistant_message: `${sentinel()}\nMore text.` }), 'marker.not_final'],
    ['oversized message', officialPayload(workspace, { last_assistant_message: `${'x'.repeat(40_000)}\n${sentinel()}` }), 'marker.message_too_large'],
    ['oversized marker', officialPayload(workspace, { last_assistant_message: sentinel(`artifact-${'x'.repeat(5_000)}`) }), 'marker.too_large'],
    ['legacy top-level fields', { ...officialPayload(workspace), artifact_path: 'artifact' }, 'input.legacy_field'],
  ];

  for (const [name, input, code] of cases) {
    const { output } = runStop(input);
    assert.equal(output.continue, true, name);
    assert.equal('decision' in output, false, name);
    assert.ok(output.warnings.some((entry) => entry.code === code), `${name}: ${JSON.stringify(output)}`);
  }
});

test('rejects workspace roots, absolute paths, traversal, NUL, and symlink ancestors without leaking paths', async () => {
  const { workspace, artifact } = await workspaceWithArtifact();
  const outside = await mkdtemp(join(tmpdir(), 'game-design-outside-'));
  temporaryDirs.push(outside);
  await mkdir(join(workspace, 'nested'));
  await symlink(artifact, join(workspace, 'nested', 'linked-artifact'));
  const paths = ['.', artifact, '../outside', 'artifact\0tail', 'nested/linked-artifact'];

  for (const path of paths) {
    const { output, stdout } = runStop(officialPayload(workspace, {
      last_assistant_message: sentinel(path),
    }));
    assert.equal(output.continue, true, path);
    assert.equal(output.status, 'warning', path);
    assert.equal('decision' in output, false, path);
    assert.ok(output.warnings.some(({ code }) => code === 'artifact.path_unsafe'), path);
    assert.equal(stdout.includes(workspace), false);
    assert.equal(stdout.includes(outside), false);
    assert.equal(isAbsolute(output.artifact_path ?? ''), false);
  }
});

test('does not execute sentinel artifact paths as shell input', async () => {
  const { workspace } = await workspaceWithArtifact();
  const injected = join(workspace, 'injected');
  const { output } = runStop(officialPayload(workspace, {
    last_assistant_message: sentinel(`artifact;touch ${injected}`),
  }));

  assert.equal(output.status, 'warning');
  await assert.rejects(() => rm(injected), /ENOENT/);
});
