import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../../shared/scripts/capability-probe.mjs', import.meta.url));
const temporaryDirs = [];

afterEach(async () => {
  await Promise.all(temporaryDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function temporaryWorkspace() {
  const dir = await mkdtemp(join(tmpdir(), 'game-design-capability-'));
  temporaryDirs.push(dir);
  await writeFile(join(dir, 'sentinel.txt'), 'unchanged\n');
  return dir;
}

function runProbe({ cwd, env = {}, input = {} }) {
  const result = spawnSync(process.execPath, [script], {
    cwd,
    env: { PATH: '', ...env },
    input: JSON.stringify(input),
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '');
  return JSON.parse(result.stdout);
}

test('reports deterministic capability presence and structured optional warnings', async () => {
  const cwd = await temporaryWorkspace();
  const first = runProbe({ cwd });
  const second = runProbe({ cwd, input: { ignored: 'input cannot enable capabilities' } });

  assert.deepEqual(first, second);
  assert.equal(first.hookSpecificOutput.hookEventName, 'SessionStart');
  assert.equal(first.capabilities.node.available, true);
  assert.equal(first.capabilities.chromium.available, false);
  assert.equal(first.capabilities.soffice.available, false);
  assert.ok(first.warnings.some(({ code }) => code === 'capability.chromium.absent'));
  assert.ok(first.warnings.some(({ code }) => code === 'capability.soffice.absent'));
});

test('is read-only and emits JSON only', async () => {
  const cwd = await temporaryWorkspace();
  const before = await readdir(cwd);

  const output = runProbe({ cwd });

  assert.equal(typeof output.hookSpecificOutput.additionalContext, 'string');
  assert.deepEqual(await readdir(cwd), before);
});

test('detects Codex bundled document, PDF, and presentation capability hints without fixed runtime paths', async () => {
  const cwd = await temporaryWorkspace();
  const codexHome = join(cwd, 'portable-codex-home');
  for (const capability of ['documents', 'pdf', 'presentations']) {
    const skillDir = join(codexHome, 'plugins', 'cache', 'openai-primary-runtime', capability, '1.2.3', 'skills', capability);
    await mkdir(skillDir, { recursive: true });
    await writeFile(join(skillDir, 'SKILL.md'), `# ${capability}\n`);
  }

  const output = runProbe({ cwd, env: { CODEX_HOME: codexHome } });

  for (const capability of ['documents', 'pdf', 'presentations']) {
    assert.deepEqual(output.capabilities[capability], { available: true, provider: 'codex-bundled' });
  }
});

test('rejects malformed stdin without failing the optional hook', async () => {
  const cwd = await temporaryWorkspace();
  const result = spawnSync(process.execPath, [script], {
    cwd,
    env: { PATH: '' },
    input: '{not-json',
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '');
  const output = JSON.parse(result.stdout);
  assert.ok(output.warnings.some(({ code }) => code === 'input.invalid_json'));
});
