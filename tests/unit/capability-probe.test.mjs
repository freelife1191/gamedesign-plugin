import assert from 'node:assert/strict';
import { chmod, mkdir, mkdtemp, readFile, readdir, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { browserCandidates, probeChromium } from '../../shared/scripts/capability-probe.mjs';

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
  assert.equal(first.capabilities.soffice.available, false);
  assert.equal(typeof first.capabilities.chromium.available, 'boolean');
  assert.equal(
    first.warnings.some(({ code }) => code === 'capability.chromium.absent'),
    !first.capabilities.chromium.available,
  );
  assert.ok(first.warnings.some(({ code }) => code === 'capability.soffice.absent'));
});

test('uses the exact portable Skillstead browser candidate order', () => {
  assert.deepEqual(browserCandidates('linux', {}), {
    names: ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'msedge', 'chrome'],
    paths: [],
  });
  assert.deepEqual(browserCandidates('darwin', {}).paths, [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ]);
  assert.deepEqual(browserCandidates('win32', {
    ProgramFiles: 'D:\\Program Files',
    'ProgramFiles(x86)': 'D:\\Program Files (x86)',
  }).paths, [
    'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'D:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'D:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'D:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ]);
});

test('normalizes the Skillstead browser override to a verified real executable identity', async () => {
  const cwd = await temporaryWorkspace();
  const browser = join(cwd, 'Google Chrome');
  const alias = join(cwd, 'browser alias');
  await writeFile(browser, '#!/bin/sh\nprintf "Google Chrome 151.0.7922.71\\n"\n');
  await chmod(browser, 0o755);
  await symlink(browser, alias);

  const capability = await probeChromium({
    platform: process.platform,
    env: { PATH: '', SVG_INFOGRAPHIC_BROWSER: alias },
  });
  assert.deepEqual(capability, {
    available: true,
    command: await realpath(browser),
    version: 'Google Chrome 151.0.7922.71',
    via: 'SVG_INFOGRAPHIC_BROWSER override',
  });
});

test('uses Skillstead PATH precedence and reports the selected command name', async () => {
  const cwd = await temporaryWorkspace();
  const bin = join(cwd, 'bin');
  const browser = join(bin, 'google-chrome');
  await mkdir(bin);
  await writeFile(browser, '#!/bin/sh\nprintf "Chromium 151.0.0.0\\n"\n');
  await chmod(browser, 0o755);

  assert.deepEqual(await probeChromium({ platform: 'linux', env: { PATH: bin } }), {
    available: true,
    command: await realpath(browser),
    version: 'Chromium 151.0.0.0',
    via: 'PATH (google-chrome)',
  });
});

test('rejects non-files, non-executables, and non-Chromium version identities', async () => {
  const cwd = await temporaryWorkspace();
  const directory = join(cwd, 'chrome-directory');
  const nonExecutable = join(cwd, 'google-chrome');
  const wrongIdentity = join(cwd, 'fake-browser');
  await mkdir(directory);
  await writeFile(nonExecutable, '#!/bin/sh\nprintf "Google Chrome 1\\n"\n');
  await writeFile(wrongIdentity, '#!/bin/sh\nprintf "Firefox 1\\n"\n');
  await chmod(wrongIdentity, 0o755);

  for (const candidate of [directory, nonExecutable, wrongIdentity]) {
    assert.deepEqual(
      await probeChromium({ platform: process.platform, env: { PATH: '', SVG_INFOGRAPHIC_BROWSER: candidate } }),
      { available: false },
    );
  }
  assert.equal(await readFile(nonExecutable, 'utf8'), '#!/bin/sh\nprintf "Google Chrome 1\\n"\n');
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
