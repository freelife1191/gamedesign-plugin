import assert from 'node:assert/strict';
import { cp, mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
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

function draftImageManifest() {
  return `schema_version: 1
assets:
  - asset_id: boss-telegraph
    type: skill-vfx
    requirement: required
    generation_state: generated
    approval_state: concept-draft
    planning:
      upstream_slot_id: boss-telegraph
      disposition: active
      target_output:
        path: assets/generated/boss-telegraph.png
        width: 1024
        height: 1024
        aspect_ratio: "1:1"
        format: png
        background: opaque
    purpose: Explain a boss attack warning.
    placement:
      document_slot: inline
      source_section: content.md#player-experience
    alt_text: A boss attack warning.
    readability: Readable at document size.
    art_brief:
      subject: Boss attack warning.
      visual_style: Clear concept art.
      composition: Top-down view.
      preserve:
        - silhouette
      exclude:
        - logos
    prompt: Clear boss attack warning, no logos.
    output:
      path: assets/generated/boss-telegraph.png
      width: 1024
      height: 1024
      aspect_ratio: "1:1"
      format: png
      background: opaque
    provider:
      name: openai-images
      model: gpt-image-2
      quality: low
    rights:
      provenance: Recorded prompt.
      rights_holder: Design team.
      license: internal-use
      effective_status: unreviewed
    reviews: []
`;
}

function documentApprovedImageManifest() {
  return draftImageManifest()
    .replace('approval_state: concept-draft', 'approval_state: document-approved')
    .replace('    reviews: []', `    reviews:
      - state: document-approved
        reviewer: Minji Kim
        reviewer_kind: human
        reviewer_role: visual-reviewer
        review_scope: document-visual
        reviewed_at: "2026-08-06T00:00:00Z"
        evidence_paths:
          - evidence.yml
        rights_decision: approved`);
}

function passedSvgQa(assetId = 'boss-telegraph', outputPath = 'assets/generated/boss-telegraph.svg') {
  return JSON.stringify({
    schema_version: 1, kind: 'skillstead-svg-qa', asset_id: assetId, output_path: outputPath,
    lint_status: 'passed', render_status: 'passed', qa_status: 'passed',
  });
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

test('blocks a final derivative that binds a concept-draft image and never starts generation', async () => {
  const { workspace, artifact } = await workspaceWithArtifact();
  await mkdir(join(artifact, 'assets', 'generated'));
  await writeFile(join(artifact, 'assets', 'generated', 'boss-telegraph.png'), 'placeholder');
  await writeFile(join(artifact, 'assets', 'image-assets.yml'), draftImageManifest());
  const content = await readFile(join(artifact, 'content.md'), 'utf8');
  await writeFile(join(artifact, 'content.md'), `${content}\n![Boss warning](assets/generated/boss-telegraph.png)\n`);

  const { output } = runStop(officialPayload(workspace));

  assert.equal(output.decision, 'block');
  assert.equal(output.status, 'corrective-pass-requested');
  assert.ok(output.validation.errors.some(({ code }) => code === 'image.approval_required'), JSON.stringify(output));
  assert.doesNotMatch(JSON.stringify(output), /generate-openai-images|imagegen|authorization/i);
});

test('fails closed for normalized aliases and missing manifests on managed generated image bindings', async () => {
  const { workspace, artifact } = await workspaceWithArtifact();
  await mkdir(join(artifact, 'assets', 'generated'));
  await writeFile(join(artifact, 'assets', 'generated', 'boss-telegraph.png'), 'placeholder');
  const content = await readFile(join(artifact, 'content.md'), 'utf8');
  await writeFile(join(artifact, 'content.md'), `${content}\n![Boss warning](./assets//generated/boss-telegraph.png)\n`);

  const { output } = runStop(officialPayload(workspace));

  assert.equal(output.decision, 'block');
  assert.ok(output.validation.errors.some(({ code }) => code === 'image.manifest_required'), JSON.stringify(output));
  assert.ok(output.validation.errors.some(({ code }) => code === 'image.reference_alias'), JSON.stringify(output));
});

test('requires canonical unique tracked regular generated image references while allowing approved assets', async () => {
  const { workspace, artifact } = await workspaceWithArtifact();
  await mkdir(join(artifact, 'assets', 'generated'));
  await writeFile(join(artifact, 'assets', 'generated', 'boss-telegraph.png'), 'placeholder');
  await writeFile(join(artifact, 'assets', 'generated', 'untracked.png'), 'placeholder');
  await writeFile(join(artifact, 'assets', 'image-assets.yml'), documentApprovedImageManifest());
  const content = await readFile(join(artifact, 'content.md'), 'utf8');
  await writeFile(join(artifact, 'content.md'), `${content}\n![Boss warning](assets/generated/boss-telegraph.png)\n![Again](assets/generated/boss-telegraph.png)\n![Untracked](assets/generated/untracked.png)\n`);

  const { output } = runStop(officialPayload(workspace));

  assert.equal(output.decision, 'block');
  assert.ok(output.validation.errors.some(({ code }) => code === 'image.reference_duplicate'), JSON.stringify(output));
  assert.ok(output.validation.errors.some(({ code }) => code === 'image.reference_untracked'), JSON.stringify(output));
  assert.equal(output.validation.errors.some(({ code }) => code === 'image.approval_required'), false, JSON.stringify(output));
});

test('fails closed when a managed generated image crosses a symbolic link', async () => {
  const { workspace, artifact } = await workspaceWithArtifact();
  const outside = await mkdtemp(join(tmpdir(), 'game-design-image-outside-'));
  temporaryDirs.push(outside);
  await mkdir(join(artifact, 'assets', 'generated'));
  await writeFile(join(outside, 'boss-telegraph.png'), 'placeholder');
  await symlink(join(outside, 'boss-telegraph.png'), join(artifact, 'assets', 'generated', 'boss-telegraph.png'));
  await writeFile(join(artifact, 'assets', 'image-assets.yml'), draftImageManifest());
  const content = await readFile(join(artifact, 'content.md'), 'utf8');
  await writeFile(join(artifact, 'content.md'), `${content}\n![Boss warning](assets/generated/boss-telegraph.png)\n`);

  const { output } = runStop(officialPayload(workspace));

  assert.equal(output.decision, 'block');
  assert.ok(output.validation.errors.some(({ code }) => code === 'image.reference_unsafe'), JSON.stringify(output));
});

test('blocks a manifest-declared concept-draft SVG while preserving unmanaged SVG compatibility', async () => {
  const { workspace, artifact } = await workspaceWithArtifact();
  await mkdir(join(artifact, 'assets', 'generated'));
  await writeFile(join(artifact, 'assets', 'generated', 'boss-telegraph.svg'), '<svg xmlns="http://www.w3.org/2000/svg"></svg>');
  await writeFile(join(artifact, 'assets', 'image-assets.yml'), draftImageManifest()
    .replaceAll('boss-telegraph.png', 'boss-telegraph.svg')
    .replaceAll('format: png', 'format: svg'));
  const content = await readFile(join(artifact, 'content.md'), 'utf8');
  await writeFile(join(artifact, 'content.md'), `${content}\n![Managed vector](assets/generated/boss-telegraph.svg)\n`);

  const { output } = runStop(officialPayload(workspace));

  assert.equal(output.decision, 'block');
  assert.ok(output.validation.errors.some(({ code }) => code === 'image.approval_required'), JSON.stringify(output));
  assert.ok(output.validation.errors.some(({ code }) => code === 'image.svg_qa_required'), JSON.stringify(output));
});

test('requires a manifest for a canonical managed SVG reference', async () => {
  const { workspace, artifact } = await workspaceWithArtifact();
  await mkdir(join(artifact, 'assets', 'generated'));
  await writeFile(join(artifact, 'assets', 'generated', 'missing-manifest.svg'), '<svg xmlns="http://www.w3.org/2000/svg"></svg>');
  const content = await readFile(join(artifact, 'content.md'), 'utf8');
  await writeFile(join(artifact, 'content.md'), `${content}\n![Managed vector](assets/generated/missing-manifest.svg)\n`);

  const { output } = runStop(officialPayload(workspace));

  assert.equal(output.decision, 'block');
  assert.ok(output.validation.errors.some(({ code }) => code === 'image.manifest_required'), JSON.stringify(output));
});

test('accepts a canonical document-approved managed SVG only with passed lint, render, and QA evidence', async () => {
  const { workspace, artifact } = await workspaceWithArtifact();
  await mkdir(join(artifact, 'assets', 'generated'));
  await mkdir(join(artifact, 'assets', 'qa'));
  await writeFile(join(artifact, 'assets', 'generated', 'boss-telegraph.svg'), '<svg xmlns="http://www.w3.org/2000/svg"></svg>');
  await writeFile(join(artifact, 'assets', 'image-assets.yml'), documentApprovedImageManifest()
    .replaceAll('boss-telegraph.png', 'boss-telegraph.svg')
    .replaceAll('format: png', 'format: svg'));
  await writeFile(join(artifact, 'assets', 'qa', 'boss-telegraph.svg-qa.json'), passedSvgQa());
  const content = await readFile(join(artifact, 'content.md'), 'utf8');
  await writeFile(join(artifact, 'content.md'), `${content}\n![Managed vector](assets/generated/boss-telegraph.svg)\n`);

  const { output } = runStop(officialPayload(workspace));

  assert.equal(output.status, 'passed');
  assert.equal(output.validation.ok, true);
});

test('fails closed for SVG aliases, untracked outputs, and symbolic links', async () => {
  const { workspace, artifact } = await workspaceWithArtifact();
  const outside = await mkdtemp(join(tmpdir(), 'game-design-svg-outside-'));
  temporaryDirs.push(outside);
  await mkdir(join(artifact, 'assets', 'generated'));
  await mkdir(join(artifact, 'assets', 'qa'));
  await writeFile(join(artifact, 'assets', 'image-assets.yml'), documentApprovedImageManifest()
    .replaceAll('boss-telegraph.png', 'boss-telegraph.svg')
    .replaceAll('format: png', 'format: svg'));
  await writeFile(join(artifact, 'assets', 'qa', 'boss-telegraph.svg-qa.json'), passedSvgQa());
  await writeFile(join(outside, 'untracked.svg'), '<svg></svg>');
  await symlink(join(outside, 'untracked.svg'), join(artifact, 'assets', 'generated', 'untracked.svg'));
  const content = await readFile(join(artifact, 'content.md'), 'utf8');
  await writeFile(join(artifact, 'content.md'), `${content}\n![Alias](./assets//generated/boss-telegraph.svg)\n![Untracked](assets/generated/untracked.svg)\n`);

  const { output } = runStop(officialPayload(workspace));

  assert.equal(output.decision, 'block');
  for (const code of ['image.reference_alias', 'image.reference_untracked', 'image.reference_unsafe']) {
    assert.ok(output.validation.errors.some((entry) => entry.code === code), `${code}: ${JSON.stringify(output)}`);
  }
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
