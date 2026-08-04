import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

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
