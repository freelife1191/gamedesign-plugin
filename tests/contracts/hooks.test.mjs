import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { buildProduct } from '../../tooling/lib/build-product.mjs';

const root = new URL('../../', import.meta.url);

test('hooks component declares only SessionStart and Stop command hooks', async () => {
  const config = JSON.parse(await readFile(new URL('shared/hooks/hooks.json', root), 'utf8'));

  assert.deepEqual(Object.keys(config), ['hooks']);
  assert.deepEqual(Object.keys(config.hooks).sort(), ['SessionStart', 'Stop']);
  for (const event of ['SessionStart', 'Stop']) {
    assert.equal(config.hooks[event].length, 1);
    assert.equal(config.hooks[event][0].hooks.length, 1);
    assert.equal(config.hooks[event][0].hooks[0].type, 'command');
    assert.match(config.hooks[event][0].hooks[0].command, /^node /);
    assert.match(config.hooks[event][0].hooks[0].command, /\$\{PLUGIN_ROOT\}\/scripts\//);
    assert.doesNotMatch(config.hooks[event][0].hooks[0].command, /\/shared\/scripts\//);
  }
});

test('SessionStart announces read-only image capability configuration probing', async () => {
  const config = JSON.parse(await readFile(new URL('shared/hooks/hooks.json', root), 'utf8'));
  const sessionStart = config.hooks.SessionStart[0].hooks[0];

  assert.match(sessionStart.statusMessage, /image capabilities/i);
  assert.match(sessionStart.command, /capability-probe\.mjs/u);
  assert.doesNotMatch(sessionStart.command, /generate|openai|imagegen/u);
});

test('production build emits runnable SessionStart and Stop hook commands', async (t) => {
  const repoRoot = await mkdtemp(join(tmpdir(), 'game-design-hook-build-repo-'));
  const stagingRoot = await mkdtemp(join(tmpdir(), 'game-design-hook-build-output-'));
  t.after(() => Promise.all([
    rm(repoRoot, { recursive: true, force: true }),
    rm(stagingRoot, { recursive: true, force: true }),
  ]));
  await cp(new URL('shared/', root), join(repoRoot, 'shared'), { recursive: true });
  await mkdir(join(repoRoot, 'products/game-design-studio/plugin/.codex-plugin'), { recursive: true });
  await writeFile(join(repoRoot, 'products/game-design-studio/product.json'), `${JSON.stringify({
    schemaVersion: 1,
    name: 'game-design-studio',
    displayName: 'Game Design Studio',
    description: 'Hook build regression fixture',
    sharedModules: ['knowledge', 'templates', 'responsible-design', 'export', 'vendor'],
    sharedRuntime: true,
    sourceRoots: ['plugin'],
    sourceDocuments: [],
  }, null, 2)}\n`);
  await writeFile(join(repoRoot, 'products/game-design-studio/plugin/.codex-plugin/plugin.json'), JSON.stringify({
    name: 'game-design-studio',
    version: '0.1.0',
    description: 'Hook build regression fixture',
  }));

  const built = await buildProduct({ repoRoot, stagingRoot, productName: 'game-design-studio' });
  const hooks = JSON.parse(await readFile(join(built.outputDir, 'hooks/hooks.json'), 'utf8'));
  for (const event of ['SessionStart', 'Stop']) {
    const configured = hooks.hooks[event][0].hooks[0].command;
    const command = configured.replaceAll('${PLUGIN_ROOT}', built.outputDir);
    const result = spawnSync(command, {
      cwd: built.outputDir,
      env: {
        PATH: process.env.PATH ?? '',
        HOME: join(stagingRoot, 'hook-home'),
        XDG_CACHE_HOME: join(stagingRoot, 'hook-cache'),
        GAME_DESIGN_UPDATE_CHECKS: 'false',
      },
      input: event === 'Stop' ? JSON.stringify({
        cwd: built.outputDir,
        turn_id: 'build-smoke',
        stop_hook_active: false,
        last_assistant_message: 'No artifact sentinel.',
      }) : '{}',
      encoding: 'utf8',
      shell: true,
    });
    assert.equal(result.status, 0, `${event}: ${result.stderr}`);
    assert.equal(result.stderr, '');
    assert.notEqual(result.stdout, '', `${event}: command produced no JSON: ${command}`);
    assert.doesNotThrow(() => JSON.parse(result.stdout), `${event}: ${result.stdout}`);
  }
});

test('plugin manifests do not declare the unsupported hooks field', async () => {
  for (const plugin of ['game-design-studio', 'game-design-career']) {
    const manifest = JSON.parse(await readFile(new URL(`plugins/${plugin}/.codex-plugin/plugin.json`, root), 'utf8'));
    assert.equal(Object.hasOwn(manifest, 'hooks'), false);
  }
});

test('responsible-design gates expose the required operational contract', async () => {
  const document = JSON.parse(await readFile(new URL('shared/responsible-design/gates.json', root), 'utf8'));
  const expected = [
    'accessibility',
    'ai-npc-safety',
    'ai-rights-human-approval',
    'economy-transparency',
    'liveops-experiment',
    'scope-control',
    'ugc-safety',
  ];

  assert.deepEqual(document.gates.map(({ id }) => id).sort(), expected);
  for (const gate of document.gates) {
    assert.ok(gate.applicability_questions.length > 0, `${gate.id}: applicability_questions`);
    assert.ok(gate.blocking_findings.length > 0, `${gate.id}: blocking_findings`);
    assert.ok(gate.evidence_fields.length > 0, `${gate.id}: evidence_fields`);
    assert.equal(typeof gate.approver, 'string');
    assert.deepEqual(gate.allowed_states, ['not-applicable', 'pending', 'blocked', 'approved']);
  }
});

test('canonical starter template validates with the production API', async () => {
  const { validateArtifact } = await import(new URL('shared/scripts/validate-artifact.mjs', root));
  const result = await validateArtifact(new URL('shared/templates/canonical-artifact/', root));

  assert.equal(result.ok, true, result.errors.map(({ message }) => message).join('\n'));
  assert.ok(result.files.includes('decisions/0001-decision.md'));
  assert.ok(result.files.includes('assets/.gitkeep'));
});
