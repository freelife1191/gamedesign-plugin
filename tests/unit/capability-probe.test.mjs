import assert from 'node:assert/strict';
import { chmod, lstat, mkdir, mkdtemp, open, readFile, readdir, realpath, rename, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  browserCandidates,
  probeArchifyCapability,
  probeChromium,
  probeImageGenerationCapability,
  resolveArchifyInstallation,
} from '../../shared/scripts/capability-probe.mjs';

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

async function writeArchifySkill(root, version = '2.13.0') {
  await mkdir(join(root, 'bin'), { recursive: true });
  await writeFile(join(root, 'SKILL.md'), '---\nname: archify\n---\n');
  await writeFile(join(root, 'package.json'), JSON.stringify({ version }));
  await writeFile(join(root, 'bin', 'archify.mjs'), '#!/usr/bin/env node\n');
}

test('detects a regular host Archify skill without exposing its path', async () => {
  const home = await temporaryWorkspace();
  const root = join(home, '.agents', 'skills', 'archify');
  await writeArchifySkill(root);

  assert.deepEqual(await probeArchifyCapability({}, { home }), {
    status: 'available',
    provider: 'host-archify-skill',
    version: '2.13.0',
  });
});

test('execution resolver pins regular CLI bytes while public probe hides paths', async () => {
  const home = await temporaryWorkspace();
  const root = join(home, '.agents', 'skills', 'archify');
  await writeArchifySkill(root);

  const installation = await resolveArchifyInstallation({}, { home });
  assert.equal(installation.status, 'available');
  assert.equal(installation.provider, 'host-archify-skill');
  assert.equal(installation.version, '2.13.0');
  assert.equal(installation.cli.path, await realpath(join(root, 'bin', 'archify.mjs')));
  assert.equal(installation.cli.realpath, await realpath(join(root, 'bin', 'archify.mjs')));
  assert.equal(typeof installation.cli.dev, 'bigint');
  assert.equal(typeof installation.cli.ino, 'bigint');
  assert.equal(typeof installation.cli.size, 'bigint');
  assert.match(installation.cli.sha256, /^[a-f0-9]{64}$/u);

  const publicResult = await probeArchifyCapability({}, { home });
  assert.deepEqual(Object.keys(publicResult).sort(), ['provider', 'status', 'version']);
  assert.equal(JSON.stringify(publicResult).includes(home), false);
});

test('execution resolver rejects a same-size CLI replacement while reading its pinned file handle', async () => {
  const home = await temporaryWorkspace();
  const root = join(home, '.agents', 'skills', 'archify');
  await writeArchifySkill(root);
  const cli = join(root, 'bin', 'archify.mjs');
  const replacement = join(root, 'bin', 'replacement.mjs');
  const original = await readFile(cli);
  await writeFile(replacement, Buffer.alloc(original.byteLength, 0x78));

  const result = await resolveArchifyInstallation({}, {
    home,
    openFn: async (path, flags) => {
      const handle = await open(path, flags);
      return {
        stat: (...args) => handle.stat(...args),
        readFile: async (...args) => {
          await rename(replacement, path);
          return handle.readFile(...args);
        },
        close: () => handle.close(),
      };
    },
  });

  assert.deepEqual(result, { status: 'unknown' });
});

test('execution resolver rejects a same-size CLI replacement after its final realpath', async () => {
  const home = await temporaryWorkspace();
  const root = join(home, '.agents', 'skills', 'archify');
  await writeArchifySkill(root);
  const cli = join(root, 'bin', 'archify.mjs');
  const replacement = join(root, 'bin', 'replacement.mjs');
  const original = await readFile(cli);
  await writeFile(replacement, Buffer.alloc(original.byteLength, 0x79));
  let cliRealpathCalls = 0;

  const result = await resolveArchifyInstallation({}, {
    home,
    realpathFn: async (path) => {
      const canonical = await realpath(path);
      if (path.endsWith('/bin/archify.mjs') && ++cliRealpathCalls === 3) {
        await rename(replacement, path);
      }
      return canonical;
    },
  });

  assert.equal(cliRealpathCalls, 3);
  assert.deepEqual(result, { status: 'unknown' });
});

test('execution resolver closes the pinned file handle and fails closed on close errors', async () => {
  const home = await temporaryWorkspace();
  const root = join(home, '.agents', 'skills', 'archify');
  await writeArchifySkill(root);
  let closeCalls = 0;

  const result = await resolveArchifyInstallation({}, {
    home,
    openFn: async (path, flags) => {
      const handle = await open(path, flags);
      return {
        stat: (...args) => handle.stat(...args),
        readFile: (...args) => handle.readFile(...args),
        close: async () => {
          closeCalls += 1;
          await handle.close();
          throw new Error('close failed after releasing the handle');
        },
      };
    },
  });

  assert.equal(closeCalls, 1);
  assert.deepEqual(result, { status: 'unknown' });
});

test('execution resolver preserves higher-priority Archify terminal outcomes', async () => {
  const home = await temporaryWorkspace();
  const codexHome = join(home, 'portable-codex-home');
  await writeArchifySkill(join(home, '.agents', 'skills', 'archify'));

  assert.deepEqual(await resolveArchifyInstallation({ CODEX_HOME: codexHome }, { home }), {
    status: 'available',
    provider: 'host-archify-skill',
    version: '2.13.0',
    cli: await resolveArchifyInstallation({}, { home }).then((result) => result.cli),
  });

  await writeArchifySkill(join(codexHome, 'skills', 'archify'), '2.12.9');
  assert.deepEqual(await resolveArchifyInstallation({ CODEX_HOME: codexHome }, { home }), { status: 'unavailable' });

  await writeFile(join(codexHome, 'skills', 'archify', 'package.json'), '{');
  assert.deepEqual(await resolveArchifyInstallation({ CODEX_HOME: codexHome }, { home }), { status: 'unknown' });
});

test('continues after an absent higher Archify root but not after malformed higher metadata', async () => {
  const home = await temporaryWorkspace();
  const codexHome = join(home, 'portable-codex-home');
  const lowerRoot = join(home, '.agents', 'skills', 'archify');
  await writeArchifySkill(lowerRoot);

  assert.deepEqual(await probeArchifyCapability({ CODEX_HOME: codexHome }, { home }), {
    status: 'available',
    provider: 'host-archify-skill',
    version: '2.13.0',
  });

  await mkdir(join(codexHome, 'skills', 'archify'), { recursive: true });
  await writeFile(join(codexHome, 'skills', 'archify', 'SKILL.md'), '---\nname: archify\n---\n');
  assert.deepEqual(await probeArchifyCapability({ CODEX_HOME: codexHome }, { home }), { status: 'unknown' });
});

test('does not fall through an unsupported higher Archify version', async () => {
  const home = await temporaryWorkspace();
  const codexHome = join(home, 'portable-codex-home');
  await writeArchifySkill(join(codexHome, 'skills', 'archify'), '2.12.9');
  await writeArchifySkill(join(home, '.agents', 'skills', 'archify'), '2.13.0');

  assert.deepEqual(await probeArchifyCapability({ CODEX_HOME: codexHome }, { home }), { status: 'unavailable' });
});

test('reports unavailable when neither Archify candidate is present', async () => {
  const home = await temporaryWorkspace();
  assert.deepEqual(await probeArchifyCapability({}, { home }), { status: 'unavailable' });
});

test('rejects symlinked Archify metadata as unknown', async () => {
  const home = await temporaryWorkspace();
  const root = join(home, '.agents', 'skills', 'archify');
  await writeArchifySkill(root);
  await writeFile(join(home, 'other-skill.md'), '---\nname: archify\n---\n');
  await rm(join(root, 'SKILL.md'));
  await symlink(join(home, 'other-skill.md'), join(root, 'SKILL.md'));

  assert.deepEqual(await probeArchifyCapability({}, { home }), { status: 'unknown' });
});

test('reports malformed, unsupported, and inaccessible Archify metadata as unknown or unavailable', async () => {
  const home = await temporaryWorkspace();
  const root = join(home, '.agents', 'skills', 'archify');
  await writeArchifySkill(root, 'not-semver');
  assert.deepEqual(await probeArchifyCapability({}, { home }), { status: 'unknown' });

  await writeFile(join(root, 'package.json'), JSON.stringify({ version: '2.12.9' }));
  assert.deepEqual(await probeArchifyCapability({}, { home }), { status: 'unavailable' });

  assert.deepEqual(await probeArchifyCapability({}, {
    home,
    lstatFn: async () => { throw Object.assign(new Error('permission denied'), { code: 'EACCES' }); },
  }), { status: 'unknown' });
});

test('rejects symlinked Archify parent paths and external escapes as unknown', async () => {
  const home = await temporaryWorkspace();
  const outside = await temporaryWorkspace();
  const externalSkill = join(outside, 'skills');
  await writeArchifySkill(join(externalSkill, 'archify'));
  await mkdir(join(home, '.agents'), { recursive: true });
  await symlink(externalSkill, join(home, '.agents', 'skills'), 'dir');

  assert.deepEqual(await probeArchifyCapability({}, { home }), { status: 'unknown' });

  const codexHome = join(home, 'portable-codex-home');
  await mkdir(codexHome, { recursive: true });
  await symlink(externalSkill, join(codexHome, 'skills'), 'dir');
  assert.deepEqual(await probeArchifyCapability({ CODEX_HOME: codexHome }, { home }), { status: 'unknown' });

  const isolatedHome = await temporaryWorkspace();
  await symlink(join(outside, 'agents'), join(isolatedHome, '.agents'), 'dir');
  assert.deepEqual(await probeArchifyCapability({}, { home: isolatedHome }), { status: 'unknown' });
});

test('accepts only supported exact SemVer Archify versions', async () => {
  const home = await temporaryWorkspace();
  const root = join(home, '.agents', 'skills', 'archify');
  await writeArchifySkill(root);

  for (const version of ['2.13.0', '2.13.0+build-1', '2.13.1-preview.1', '2.14.0-rc.1']) {
    await writeFile(join(root, 'package.json'), JSON.stringify({ version }));
    assert.deepEqual(await probeArchifyCapability({}, { home }), {
      status: 'available', provider: 'host-archify-skill', version,
    }, version);
  }

  for (const version of ['2.13.0-preview.1', '2.12.9', '3.0.0']) {
    await writeFile(join(root, 'package.json'), JSON.stringify({ version }));
    assert.deepEqual(await probeArchifyCapability({}, { home }), { status: 'unavailable' }, version);
  }

  for (const version of ['2.13.1-01', 'v2.13.0', '2.13.0.1', '2.13', '2.13.0-', '2.13.0+']) {
    await writeFile(join(root, 'package.json'), JSON.stringify({ version }));
    assert.deepEqual(await probeArchifyCapability({}, { home }), { status: 'unknown' }, version);
  }
});

test('prefers CODEX_HOME Archify over the legacy host candidate', async () => {
  const home = await temporaryWorkspace();
  const codexHome = join(home, 'portable-codex-home');
  await writeArchifySkill(join(codexHome, 'skills', 'archify'), '2.14.0');
  await writeArchifySkill(join(home, '.agents', 'skills', 'archify'), '2.13.0');

  assert.deepEqual(await probeArchifyCapability({ CODEX_HOME: codexHome }, { home }), {
    status: 'available',
    provider: 'host-archify-skill',
    version: '2.14.0',
  });
});

test('SessionStart includes Archify capability without an absolute host path', async () => {
  const cwd = await temporaryWorkspace();
  const codexHome = join(cwd, 'portable-codex-home');
  await writeArchifySkill(join(codexHome, 'skills', 'archify'));

  const output = runProbe({ cwd, env: { CODEX_HOME: codexHome, HOME: cwd } });
  const context = JSON.parse(output.hookSpecificOutput.additionalContext);

  assert.deepEqual(context.capabilities.archify, {
    status: 'available',
    provider: 'host-archify-skill',
    version: '2.13.0',
  });
  assert.equal(JSON.stringify(context).includes(codexHome), false);
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

test('reports only a redacted image configuration and discoverable host image capability state', async () => {
  const cwd = await temporaryWorkspace();
  const codexHome = join(cwd, 'portable-codex-home');
  const imageSkill = join(codexHome, 'skills', '.system', 'imagegen');
  await mkdir(imageSkill, { recursive: true });
  await writeFile(join(imageSkill, 'SKILL.md'), '# image generation\n');

  const output = runProbe({
    cwd,
    env: { CODEX_HOME: codexHome, IMAGE_GEN_MODE: 'select', OPENAI_API_KEY: 'never-expose-this-key' },
  });
  const context = JSON.parse(output.hookSpecificOutput.additionalContext);

  assert.deepEqual(output.capabilities.image_generation, { status: 'available', provider: 'codex-system-skill' });
  assert.deepEqual(context.imageConfig, {
    mode: 'select',
    model: 'gpt-image-2',
    quality: 'low',
    apiKeyPresent: true,
    sources: { mode: 'environment', model: 'default', quality: 'default', apiKey: 'environment' },
    warnings: [],
  });
  assert.equal(JSON.stringify(output).includes('never-expose-this-key'), false);
  assert.equal(JSON.stringify(output).includes('http'), false);
});

test('distinguishes readable absence from permission-unknown image capability paths', async () => {
  const cwd = await temporaryWorkspace();
  const codexHome = join(cwd, 'portable-codex-home');
  assert.deepEqual(await probeImageGenerationCapability({ CODEX_HOME: codexHome }), { status: 'unavailable' });
  assert.deepEqual(await probeImageGenerationCapability({ CODEX_HOME: codexHome }, {
    lstatFn: async () => { throw Object.assign(new Error('permission denied'), { code: 'EACCES' }); },
  }), { status: 'unknown' });
  assert.deepEqual(await probeImageGenerationCapability({ CODEX_HOME: codexHome }, {
    lstatFn: async () => ({ isFile: () => true, isSymbolicLink: () => false }),
  }), { status: 'available', provider: 'codex-system-skill' });
});

test('reports unknown when a bundled image SKILL.md cannot be inspected', async () => {
  const cwd = await temporaryWorkspace();
  const codexHome = join(cwd, 'portable-codex-home');
  const skill = join(codexHome, 'plugins', 'cache', 'openai-primary-runtime', 'imagegen', '1.2.3', 'skills', 'imagegen', 'SKILL.md');
  await mkdir(join(skill, '..'), { recursive: true });
  await writeFile(skill, '# image generation\n');

  for (const code of ['EACCES', 'EPERM', 'EIO']) {
    assert.deepEqual(await probeImageGenerationCapability({ CODEX_HOME: codexHome }, {
      lstatFn: async (candidate) => {
        if (candidate === skill) throw Object.assign(new Error('cannot inspect bundled skill'), { code });
        return lstat(candidate);
      },
    }), { status: 'unknown' });
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
