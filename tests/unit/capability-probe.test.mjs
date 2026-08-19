import assert from 'node:assert/strict';
import { chmod, lstat, mkdir, mkdtemp, open, readFile, readdir, realpath, rename, rm, symlink, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  browserCandidates,
  probeArchifyCapability,
  probeChromium,
  probeImageGenerationCapability,
  resolveArchifyInstallation,
} from '../../shared/scripts/capability-probe.mjs';
import { spawnProgramSync, writeNonExecutableProgram, writeSpawnableProgram } from '../lib/platform-support.mjs';

const script = fileURLToPath(new URL('../../shared/scripts/capability-probe.mjs', import.meta.url));
const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const temporaryDirs = [];
const UPDATE_CHECKED_AT = Date.parse('2026-08-15T00:00:00.000Z');
// The probe under test reads the repository's real installed-components manifest, so the stubbed
// release feed has to answer with the tags that manifest actually carries. Copying them here meant every
// vendor upgrade broke this test for a reason unrelated to what it covers.
const UPDATE_COMPONENTS = JSON.parse(readFileSync(join(repoRoot, 'shared/updates/installed-components.json'), 'utf8')).components;
const INSTALLED_ARCHIFY_TAG = UPDATE_COMPONENTS.find(({ id }) => id === 'archify').installedTag;
const NEWER_ARCHIFY_TAG = `v${INSTALLED_ARCHIFY_TAG.slice(1).split('.').map((part, index) => (index === 1 ? Number(part) + 1 : part)).join('.')}`;

afterEach(async () => {
  await Promise.all(temporaryDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function temporaryWorkspace() {
  const dir = await temporaryDirectory('game-design-capability-');
  await writeFile(join(dir, 'sentinel.txt'), 'unchanged\n');
  return dir;
}

async function temporaryDirectory(prefix) {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  temporaryDirs.push(dir);
  return dir;
}

async function snapshotTree(root) {
  const entries = [];
  async function visit(current, relativePath) {
    const stats = await lstat(current);
    if (stats.isDirectory()) {
      entries.push({ relativePath, type: 'directory' });
      const children = await readdir(current);
      for (const child of children.sort()) await visit(join(current, child), join(relativePath, child));
      return;
    }
    if (stats.isFile()) {
      entries.push({ relativePath, type: 'file', contents: (await readFile(current)).toString('base64') });
      return;
    }
    entries.push({ relativePath, type: 'other' });
  }
  await visit(root, '.');
  return entries;
}

function runProbe({ cwd, env = {}, input = {} }) {
  const { GAME_DESIGN_UPDATE_CHECKS: _checks, HOME: _home, PATH: _path, XDG_CACHE_HOME: _xdgCache, ...safeEnv } = env;
  const result = spawnSync(process.execPath, [script], {
    cwd,
    env: {
      ...safeEnv,
      PATH: '',
      HOME: `${cwd}-home`,
      XDG_CACHE_HOME: `${cwd}-cache`,
      GAME_DESIGN_UPDATE_CHECKS: 'false',
    },
    input: JSON.stringify(input),
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '');
  return JSON.parse(result.stdout);
}

function runInjectedProbe({
  home,
  workspace,
  now = UPDATE_CHECKED_AT,
  archifyTag = NEWER_ARCHIFY_TAG,
  offline = false,
  neverResolving = false,
  optOut = false,
  processEnv = {},
  timeout,
} = {}) {
  const result = spawnSync(process.execPath, ['--input-type=module', '--eval', `
    import { runCapabilityProbe } from ${JSON.stringify(pathToFileURL(script).href)};
    const components = ${JSON.stringify(UPDATE_COMPONENTS)};
    const endpoints = {
      skillstead: 'https://api.github.com/repos/kyungseo/skillstead/releases',
      archify: 'https://api.github.com/repos/tt-a1i/archify/releases',
      'im-not-ai': 'https://api.github.com/repos/epoko77-ai/im-not-ai/releases',
      'game-design-suite': 'https://api.github.com/repos/freelife1191/gamedesign-plugin/releases',
    };
    process.stdin.push(null);
    globalThis.fetch = () => { throw new Error('live network is forbidden in this test'); };
    const output = await runCapabilityProbe({ updateOptions: {
      pluginRoot: ${JSON.stringify(repoRoot)},
      home: ${JSON.stringify(home)},
      now: ${JSON.stringify(now)},
      env: ${JSON.stringify(optOut ? { GAME_DESIGN_UPDATE_CHECKS: 'false' } : {})},
      fetchFn: async (url) => {
        if (${JSON.stringify(offline)}) throw new Error('offline');
        if (${JSON.stringify(neverResolving)}) return new Promise(() => undefined);
        const component = components.find(({ id }) => endpoints[id] === url);
        if (!component) throw new Error('unexpected update endpoint');
        const tag = component.id === 'archify' ? ${JSON.stringify(archifyTag)} : component.installedTag;
        return {
          ok: true,
          status: 200,
          url,
          async json() {
            return [{
              tag_name: tag,
              draft: false,
              prerelease: false,
              html_url: component.repository + '/releases/tag/' + tag.split('/').map(encodeURIComponent).join('/'),
            }];
          },
        };
      },
    } });
    process.stdout.write(JSON.stringify(output));
  `], {
    cwd: workspace,
    env: { PATH: '', HOME: home, XDG_CACHE_HOME: join(home, 'cache'), ...processEnv },
    encoding: 'utf8',
    timeout,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '');
  return JSON.parse(result.stdout);
}

test('reports deterministic capability presence and structured optional warnings', async () => {
  const cwd = await temporaryWorkspace();
  const first = runProbe({ cwd });
  const second = runProbe({ cwd, input: { ignored: 'input cannot enable capabilities' } });

  const { updates: firstUpdates } = first;
  const { updates: secondUpdates } = second;
  assert.deepEqual(first.capabilities, second.capabilities);
  assert.deepEqual(first.imageConfig, second.imageConfig);
  assert.deepEqual(first.warnings, second.warnings);
  assert.equal(first.hookSpecificOutput.hookEventName, second.hookSpecificOutput.hookEventName);
  assert.deepEqual(Object.keys(first).sort(), [
    'capabilities', 'hookSpecificOutput', 'imageConfig', 'updates', 'warnings',
  ]);
  assert.deepEqual(JSON.parse(first.hookSpecificOutput.additionalContext).updates, first.updates);
  for (const updates of [firstUpdates, secondUpdates]) {
    assert.equal(updates.cache, 'disabled');
    assert.equal(updates.status, 'disabled');
    assert.deepEqual(updates.components, []);
    assert.equal(updates.notification, null);
  }
  assert.equal(first.capabilities.node.available, true);
  assert.equal(first.capabilities.soffice.available, false);
  assert.equal(typeof first.capabilities.chromium.available, 'boolean');
  assert.equal(
    first.warnings.some(({ code }) => code === 'capability.chromium.absent'),
    !first.capabilities.chromium.available,
  );
  assert.ok(first.warnings.some(({ code }) => code === 'capability.soffice.absent'));
});

test('SessionStart surfaces injected update advisories without changing capability context', async () => {
  const workspace = await temporaryWorkspace();
  const home = await temporaryDirectory('game-design-update-home-');
  const before = await snapshotTree(workspace);
  const first = runInjectedProbe({ home, workspace });
  assert.deepEqual(Object.keys(first).sort(), [
    'capabilities', 'hookSpecificOutput', 'imageConfig', 'updates', 'warnings',
  ]);
  assert.deepEqual(JSON.parse(first.hookSpecificOutput.additionalContext).updates, first.updates);
  assert.deepEqual(first.updates.notification, {
    kind: 'update-available',
    prompt: '플러그인 업데이트를 확인해 줘',
    componentIds: ['archify'],
  });
  assert.deepEqual(await snapshotTree(workspace), before);

  const cached = runInjectedProbe({
    home,
    workspace,
    now: UPDATE_CHECKED_AT + 1,
    offline: true,
  });
  assert.equal(cached.updates.cache, 'hit');
  assert.equal(cached.updates.notification, null);
  assert.deepEqual(await snapshotTree(workspace), before);

  const currentHome = await temporaryDirectory('game-design-current-home-');
  const current = runInjectedProbe({
    home: currentHome,
    workspace,
    archifyTag: INSTALLED_ARCHIFY_TAG,
  });
  assert.equal(current.updates.status, 'current');
  assert.equal(current.updates.notification, null);

  const newer = runInjectedProbe({
    home: currentHome,
    workspace,
    now: UPDATE_CHECKED_AT + (7 * 24 * 60 * 60 * 1000),
    archifyTag: NEWER_ARCHIFY_TAG,
  });
  assert.deepEqual(newer.updates.notification, {
    kind: 'update-available',
    prompt: '플러그인 업데이트를 확인해 줘',
    componentIds: ['archify'],
  });

  const offline = runInjectedProbe({
    home: await temporaryDirectory('game-design-offline-home-'),
    workspace,
    offline: true,
  });
  assert.equal(offline.updates.status, 'unknown');
  assert.equal(offline.updates.notification, null);
  assert.deepEqual(await snapshotTree(workspace), before);

  const optOut = runInjectedProbe({
    home: await temporaryDirectory('game-design-opt-out-home-'),
    workspace,
    optOut: true,
  });
  assert.deepEqual(optOut.updates, {
    schemaVersion: 1,
    checkedAt: '2026-08-15T00:00:00.000Z',
    cache: 'disabled',
    status: 'disabled',
    components: [],
    notification: null,
  });
});

test('SessionStart emits JSON within its 25-second 15-second capability and 5-second update budget', async () => {
  const workspace = await temporaryWorkspace();
  const home = await temporaryDirectory('game-design-bounded-home-');
  // The probe here is a real child process, so the browser it spawns has to be a real program. On Windows
  // that program is a .cmd, which the product's own spawn refuses without a shell — so there the browser
  // fails fast instead of hanging, and this test falls back to proving the other half of the budget, the
  // update fetch that never resolves. Both halves run on POSIX.
  const browser = await writeSpawnableProgram(
    await temporaryDirectory('game-design-slow-browser-'),
    'google-chrome',
    'await new Promise((resolve) => setTimeout(resolve, 15_000));\nprocess.stdout.write("Google Chrome 151.0.0.0\\n");',
  );

  const startedAt = Date.now();
  const output = runInjectedProbe({
    home,
    workspace,
    neverResolving: true,
    processEnv: { PATH: '/usr/bin:/bin', SVG_INFOGRAPHIC_BROWSER: browser },
    timeout: 25_000,
  });

  assert.ok(Date.now() - startedAt < 25_000);
  assert.equal(output.updates.status, 'unknown');
});

test('SessionStart returns closed unknown updates when checker initialization throws', async () => {
  const output = runInjectedProbe({
    home: await temporaryDirectory('game-design-invalid-update-home-'),
    workspace: await temporaryWorkspace(),
    now: 'not-a-timestamp',
  });

  assert.deepEqual(output.updates, {
    schemaVersion: 1,
    checkedAt: output.updates.checkedAt,
    cache: 'miss',
    status: 'unknown',
    components: [],
    notification: null,
  });
  assert.doesNotThrow(() => new Date(output.updates.checkedAt).toISOString());
  assert.deepEqual(JSON.parse(output.hookSpecificOutput.additionalContext).updates, output.updates);
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

  const output = runProbe({ cwd, env: { CODEX_HOME: codexHome } });
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
  const browser = await writeSpawnableProgram(cwd, 'Google Chrome', 'process.stdout.write("Google Chrome 151.0.7922.71\\n");');
  const alias = join(cwd, 'browser alias');
  await symlink(browser, alias);

  const capability = await probeChromium({
    platform: process.platform,
    env: { PATH: '', SVG_INFOGRAPHIC_BROWSER: alias },
    spawnSyncFn: spawnProgramSync,
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
  await mkdir(bin);
  const browser = await writeSpawnableProgram(bin, 'google-chrome', 'process.stdout.write("Chromium 151.0.0.0\\n");');

  // The host's own platform, not a hardcoded 'linux'. PATH parsing is one of the things that differs —
  // the separator and the extension list both come from the platform — so naming a foreign one here would
  // hand the resolver a PATH string it splits on the wrong character.
  assert.deepEqual(await probeChromium({ platform: process.platform, env: { PATH: bin }, spawnSyncFn: spawnProgramSync }), {
    available: true,
    command: await realpath(browser),
    version: 'Chromium 151.0.0.0',
    via: 'PATH (google-chrome)',
  });
});

test('rejects non-files, non-executables, and non-Chromium version identities', async () => {
  const cwd = await temporaryWorkspace();
  const directory = join(cwd, 'chrome-directory');
  const nonExecutableBody = 'process.stdout.write("Google Chrome 1\\n");\n';
  await mkdir(directory);
  // Only two of the three rejections are expressible everywhere. "Not executable" is a POSIX permission
  // fact, and Windows grants X_OK to anything it can read, so there is no file there that exists and is
  // refused for that reason — the helper returns null rather than fabricating one that proves nothing.
  const nonExecutable = await writeNonExecutableProgram(cwd, 'google-chrome', nonExecutableBody);
  const wrongIdentity = await writeSpawnableProgram(cwd, 'fake-browser', 'process.stdout.write("Firefox 1\\n");');

  for (const candidate of [directory, nonExecutable, wrongIdentity].filter((entry) => entry !== null)) {
    assert.deepEqual(
      await probeChromium({ platform: process.platform, env: { PATH: '', SVG_INFOGRAPHIC_BROWSER: candidate }, spawnSyncFn: spawnProgramSync }),
      { available: false },
    );
  }
  if (nonExecutable !== null) assert.equal(await readFile(nonExecutable, 'utf8'), nonExecutableBody);
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
    providerPreference: 'codex-first',
    embeddedTextLocale: 'none',
    model: 'gpt-image-2',
    quality: 'low',
    apiKeyPresent: true,
    sources: { mode: 'environment', providerPreference: 'default', embeddedTextLocale: 'default', model: 'default', quality: 'default', apiKey: 'environment' },
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
    env: {
      PATH: '',
      HOME: `${cwd}-home`,
      XDG_CACHE_HOME: `${cwd}-cache`,
      GAME_DESIGN_UPDATE_CHECKS: 'false',
    },
    input: '{not-json',
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '');
  const output = JSON.parse(result.stdout);
  assert.ok(output.warnings.some(({ code }) => code === 'input.invalid_json'));
});
