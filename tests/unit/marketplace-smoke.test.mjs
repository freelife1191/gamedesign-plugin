import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { lstat, mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import * as marketplaceSmoke from "../../tooling/marketplace-smoke.mjs";
import {
  assertArtifactDirectory,
  bridgeLocalAuth,
  buildMarketplacePrompt,
  buildProofCommand,
  captureFileIdentity,
  createSmokeFailure,
  PACKAGED_SKILL_COUNTS,
  parseExecJsonl,
  preservePrimarySmokeFailure,
  PROOF_HARNESS_PATH,
  redactFailure,
  runArtifactValidation,
  validateCliJson,
} from "../../tooling/marketplace-smoke.mjs";
import { artifactTreeIdentity, runMarketplaceProof } from "../../tooling/lib/marketplace-proof-harness.mjs";

const product = "game-design-career";
const pluginId = `${product}@game-design-suite`;

test("codex exec uses the slow marketplace timeout through its runner seam", () => {
  const calls = [];
  const result = marketplaceSmoke.runCodexExec(
    "codex",
    ["exec", "--json"],
    { cwd: "/workspace", env: { CODEX_HOME: "/isolated" } },
    (...args) => {
      calls.push(args);
      return "jsonl";
    },
  );

  assert.equal(marketplaceSmoke.CODEX_EXEC_TIMEOUT_MS, 300_000);
  assert.equal(result, "jsonl");
  assert.deepEqual(calls, [[
    "codex",
    ["exec", "--json"],
    { cwd: "/workspace", env: { CODEX_HOME: "/isolated" }, timeout: 300_000 },
  ]]);
});

test("marketplace smoke expects each product's exact installed skill inventory", () => {
  assert.deepEqual(PACKAGED_SKILL_COUNTS, {
    "game-design-career": 23,
    "game-design-studio": 24,
  });
});

test("marketplace smoke starts from an ordinary Korean request without naming a skill", () => {
  const prompt = buildMarketplacePrompt({
    displayName: "Game Design Studio",
    request: "모바일 협동 RPG의 목표와 핵심 재미를 한 장으로 정리해 주세요.",
  }, "/tmp/artifact", "node proof.mjs");

  assert.match(prompt, /모바일 협동 RPG의 목표와 핵심 재미/u);
  assert.match(prompt, /스킬 이름이나 사례 ID를 모른다고 가정/u);
  assert.match(prompt, /assets\/shared\/templates\/canonical-artifact/u);
  assert.match(prompt, /기준 템플릿은 실행 도구가 결과물 루트에 미리 복사/u);
  assert.match(prompt, /content\.md의 본문만/u);
  assert.match(prompt, /artifact_id.*formats.*status/u);
  assert.match(prompt, /runner가 설치본에서 직접 수행/u);
  assert.doesNotMatch(prompt, /\$game-design|orchestrate-game-design|skillPath|skills\/orchestrate/u);
});

test("marketplace runner owns the canonical artifact scaffold and verifies a real content edit", async () => {
  assert.equal(typeof marketplaceSmoke.seedArtifactStarter, "function");
  assert.equal(typeof marketplaceSmoke.assertGeneratedContent, "function");
  const root = await mkdtemp(path.join(os.tmpdir(), "marketplace-starter-"));
  try {
    const cacheRoot = path.join(root, "cache");
    const templateRoot = path.join(cacheRoot, "assets/shared/templates/canonical-artifact");
    await mkdir(path.join(templateRoot, "assets"), { recursive: true });
    await mkdir(path.join(templateRoot, "decisions"), { recursive: true });
    const originalContent = "---\ntitle: 기준 결과물\nartifact_id: smoke-artifact\nversion: 1\n---\n# 기준 결과물 {#smoke-artifact}\n\n## 핵심 재미 {#core-fun}\n\n초기 본문\n";
    const editedContent = "---\ntitle: 기준 결과물\nartifact_id: smoke-artifact\nversion: 1\n---\n# 기준 결과물 {#smoke-artifact}\n\n## 핵심 재미 {#core-fun}\n\n모바일 협동 RPG의 핵심 재미를 정리했다.\n";
    await writeFile(path.join(templateRoot, "content.md"), originalContent);
    await writeFile(path.join(templateRoot, "evidence.yml"), "version: 1\nclaims: []\n");
    await writeFile(path.join(templateRoot, "export-manifest.yml"), "artifact_id: smoke-artifact\nformats:\n  md:\n    status: pending\n");
    const artifactPath = path.join(root, "artifact");
    const starter = await marketplaceSmoke.seedArtifactStarter(cacheRoot, artifactPath);
    await assert.rejects(
      marketplaceSmoke.assertGeneratedContent(artifactPath, {
        ...starter,
        requiredPatterns: [/모바일/u, /협동 RPG/u, /핵심 재미/u],
      }),
      /unchanged/u,
    );
    await writeFile(path.join(artifactPath, "content.md"), editedContent);
    await marketplaceSmoke.assertGeneratedContent(artifactPath, {
      ...starter,
      requiredPatterns: [/모바일/u, /협동 RPG/u, /핵심 재미/u],
    });

    await writeFile(path.join(artifactPath, "content.md"), editedContent.replace("artifact_id: smoke-artifact", "artifact_id: changed-artifact"));
    await assert.rejects(
      marketplaceSmoke.assertGeneratedContent(artifactPath, { ...starter, requiredPatterns: [/모바일/u] }),
      /protected content envelope changed/u,
    );

    await writeFile(path.join(artifactPath, "content.md"), editedContent.replace("{#core-fun}", "{#changed-heading}"));
    await assert.rejects(
      marketplaceSmoke.assertGeneratedContent(artifactPath, { ...starter, requiredPatterns: [/모바일/u] }),
      /protected content envelope changed/u,
    );

    await writeFile(path.join(artifactPath, "content.md"), editedContent);
    await writeFile(path.join(artifactPath, "evidence.yml"), "version: 1\nclaims:\n  - invented\n");
    await assert.rejects(
      marketplaceSmoke.assertGeneratedContent(artifactPath, { ...starter, requiredPatterns: [/모바일/u] }),
      /artifact scaffold changed/u,
    );

    await writeFile(path.join(artifactPath, "evidence.yml"), "version: 1\nclaims: []\n");
    await writeFile(path.join(artifactPath, "unexpected.md"), "extra\n");
    await assert.rejects(
      marketplaceSmoke.assertGeneratedContent(artifactPath, { ...starter, requiredPatterns: [/모바일/u] }),
      /artifact scaffold changed/u,
    );
    await rm(path.join(artifactPath, "unexpected.md"));

    await writeFile(path.join(artifactPath, "content.md"), originalContent.replace("초기 본문", "요청과 무관한 본문 변경"));
    await assert.rejects(
      marketplaceSmoke.assertGeneratedContent(artifactPath, { ...starter, requiredPatterns: [/기준 결과물/u] }),
      /request mismatch/u,
    );

    await writeFile(path.join(artifactPath, "content.md"), originalContent.replace("초기 본문", "모바일 게임 기획"));
    await assert.rejects(
      marketplaceSmoke.assertGeneratedContent(artifactPath, {
        ...starter,
        requiredPatterns: [/모바일/u, /협동 RPG/u, /핵심 재미/u],
      }),
      /request mismatch/u,
    );

    await writeFile(
      path.join(artifactPath, "content.md"),
      originalContent.replace("초기 본문", "요청과 무관한 본문\n\n```text\n```junk\n모바일 협동 RPG 핵심 재미\n```"),
    );
    await assert.rejects(
      marketplaceSmoke.assertGeneratedContent(artifactPath, {
        ...starter,
        requiredPatterns: [/모바일/u, /협동/u, /RPG/u, /핵심 재미/u],
      }),
      /request mismatch/u,
    );

    await writeFile(
      path.join(artifactPath, "content.md"),
      originalContent.replace("초기 본문", "요청과 무관한 본문\n\n<!--\n모바일 협동 RPG 핵심 재미"),
    );
    await assert.rejects(
      marketplaceSmoke.assertGeneratedContent(artifactPath, {
        ...starter,
        requiredPatterns: [/모바일/u, /협동/u, /RPG/u, /핵심 재미/u],
      }),
      /request mismatch/u,
    );
  } finally { await rm(root, { recursive: true, force: true }); }
});

async function traceFixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "marketplace-trace-"));
  const cacheRoot = path.join(root, "cache", product, "0.1.1");
  const skillPath = path.join(cacheRoot, "skills/orchestrate-game-design-career/SKILL.md");
  const validatorPath = path.join(cacheRoot, "scripts/validate-artifact.mjs");
  const routingPath = path.join(cacheRoot, "references/routing.json");
  const artifactPath = path.join(root, "workspace/artifact");
  const workspaceProver = path.join(root, "workspace/prove-installed-skill.mjs");
  await mkdir(path.dirname(skillPath), { recursive: true });
  await writeFile(skillPath, "fixture\n");
  await mkdir(path.dirname(validatorPath), { recursive: true });
  await writeFile(validatorPath, 'process.stdout.write(JSON.stringify({ ok: true, errors: [], warnings: [], files: [], requestedFormats: ["md"] }));\n');
  await mkdir(path.dirname(routingPath), { recursive: true });
  await writeFile(routingPath, JSON.stringify({ routes: [{ id: "entry-intake", skill: "orchestrate-game-design-career" }] }));
  await mkdir(artifactPath, { recursive: true });
  await writeFile(workspaceProver, "fixture proof\n");
  const skillSha256 = createHash("sha256").update("fixture\n").digest("hex");
  const validatorSha256 = createHash("sha256").update(await readFile(validatorPath)).digest("hex");
  const requestSha256 = createHash("sha256").update("ordinary Korean request\n").digest("hex");
  const bindingNonce = "a".repeat(64);
  await writeFile(path.join(artifactPath, "route-receipt.json"), JSON.stringify({
    schemaVersion: 1,
    requestSha256,
    bindingNonce,
    routeId: "entry-intake",
  }));
  const [proofIdentity, artifactIdentity, trustedShell] = await Promise.all([
    captureFileIdentity(PROOF_HARNESS_PATH), artifactTreeIdentity(artifactPath), realpath("/bin/sh"),
  ]);
  return {
    root, cacheRoot, workspaceRoot: path.dirname(artifactPath), skillPath, skillSha256,
    validatorPath, validatorSha256, artifactPath, proofIdentity, artifactSha256: artifactIdentity.sha256, requestSha256, bindingNonce,
    trustedShellPaths: [trustedShell], workspaceProver,
  };
}

function proofArgs(fixture) {
  return [
    fixture.cacheRoot, fixture.workspaceRoot, fixture.validatorPath, fixture.validatorSha256,
    fixture.artifactPath, fixture.requestSha256,
  ];
}

function events(fixture) {
  const receipt = {
    schemaVersion: 1,
    ok: true,
    validatorSha256: fixture.validatorSha256,
    artifactSha256: fixture.artifactSha256,
    requestedFormats: ["md"],
    routeReceipt: {
      schemaVersion: 1,
      requestSha256: fixture.requestSha256,
      bindingNonce: fixture.bindingNonce,
      routeId: "entry-intake",
      loadedInstruction: {
        relativePath: "skills/orchestrate-game-design-career/SKILL.md",
        sha256: fixture.skillSha256,
      },
    },
  };
  return [
    { type: "thread.started", thread_id: "redacted" },
    { type: "turn.started" },
    { type: "item.completed", item: {
      type: "command_execution",
      command: buildProofCommand(process.execPath, PROOF_HARNESS_PATH, ...proofArgs(fixture)),
      exit_code: 0, status: "completed", aggregated_output: `${JSON.stringify(receipt)}\n`,
    } },
    { type: "item.completed", item: { type: "agent_message", text: "self-report is supplemental only" } },
    { type: "turn.completed" },
  ];
}

test("exec JSONL requires one exact trusted proof-harness command and receipt", async () => {
  const fixture = await traceFixture();
  try {
    const result = await parseExecJsonl(events(fixture).map(JSON.stringify).join("\n"), {
      ...fixture,
    });
    assert.deepEqual(result, {
      completed: true,
      proofHarness: true,
      selectedSkill: "orchestrate-game-design-career",
      routeReceipt: {
        schemaVersion: 1,
        requestSha256: fixture.requestSha256,
        bindingNonce: fixture.bindingNonce,
        routeId: "entry-intake",
        loadedInstruction: {
          relativePath: "skills/orchestrate-game-design-career/SKILL.md",
          sha256: fixture.skillSha256,
        },
      },
    });
  } finally { await rm(fixture.root, { recursive: true, force: true }); }
});

test("exec JSONL accepts the exact command inside the current shell wrapper", async () => {
  const fixture = await traceFixture();
  try {
    const source = events(fixture);
    source[2].item.command = `${fixture.trustedShellPaths[0]} -lc ${JSON.stringify(source[2].item.command)}`;
    const result = await parseExecJsonl(source.map(JSON.stringify).join("\n"), { ...fixture });
    assert.equal(result.routeReceipt.routeId, "entry-intake");
    assert.equal(result.selectedSkill, "orchestrate-game-design-career");
  } finally { await rm(fixture.root, { recursive: true, force: true }); }
});

test("forged printf output cannot impersonate installed-skill and validator execution", async () => {
  const fixture = await traceFixture();
  try {
    const source = events(fixture);
    source[2].item.command = `printf forged ${PROOF_HARNESS_PATH} ${fixture.skillPath} ${fixture.validatorPath} ${fixture.artifactPath}`;
    await assert.rejects(parseExecJsonl(source.map(JSON.stringify).join("\n"), { ...fixture }), /unverifiable/u);
  } finally { await rm(fixture.root, { recursive: true, force: true }); }
});

test("workspace prover transient overwrite and restore cannot preserve trust", async () => {
  const fixture = await traceFixture();
  try {
    const original = await readFile(fixture.workspaceProver);
    await writeFile(fixture.workspaceProver, "forged prover\n");
    await writeFile(fixture.workspaceProver, original);
    const source = events(fixture);
    source[2].item.command = source[2].item.command.replace(PROOF_HARNESS_PATH, fixture.workspaceProver);
    await assert.rejects(parseExecJsonl(source.map(JSON.stringify).join("\n"), { ...fixture }), /unverifiable/u);
  } finally { await rm(fixture.root, { recursive: true, force: true }); }
});

test("an arbitrary executable named sh cannot impersonate a trusted shell wrapper", async () => {
  const fixture = await traceFixture();
  try {
    const fakeShell = path.join(fixture.root, "attacker/sh");
    await mkdir(path.dirname(fakeShell), { recursive: true });
    await writeFile(fakeShell, "#!/bin/sh\n", { mode: 0o700 });
    const source = events(fixture);
    source[2].item.command = `${fakeShell} -lc ${JSON.stringify(source[2].item.command)}`;
    await assert.rejects(parseExecJsonl(source.map(JSON.stringify).join("\n"), { ...fixture }), /unverifiable/u);
  } finally { await rm(fixture.root, { recursive: true, force: true }); }
});

test("proof harness accepts one request- and nonce-bound installed route receipt", async () => {
  const fixture = await traceFixture();
  try {
    const result = await runMarketplaceProof(proofArgs(fixture), { bindingNonce: fixture.bindingNonce });
    assert.equal(result.routeReceipt.routeId, "entry-intake");
    assert.equal(result.routeReceipt.loadedInstruction.sha256, fixture.skillSha256);
  } finally { await rm(fixture.root, { recursive: true, force: true }); }
});

for (const [mutation, expected] of [
  ["missing", /route receipt unavailable/u],
  ["wrong-request", /route receipt request-mismatch/u],
  ["wrong-nonce", /route receipt nonce-mismatch/u],
  ["null-route", /route receipt selected-route-mismatch/u],
  ["unknown-route", /route receipt selected-route-mismatch/u],
  ["extra-field", /route receipt contract-mismatch/u],
]) {
  test(`proof harness rejects the exact ${mutation} route receipt mutation`, async () => {
    const fixture = await traceFixture();
    try {
      const receiptPath = path.join(fixture.artifactPath, "route-receipt.json");
      const valid = JSON.parse(await readFile(receiptPath, "utf8"));
      if (mutation === "missing") await rm(receiptPath);
      else {
        if (mutation === "wrong-request") valid.requestSha256 = "0".repeat(64);
        if (mutation === "wrong-nonce") valid.bindingNonce = "b".repeat(64);
        if (mutation === "null-route") valid.routeId = null;
        if (mutation === "unknown-route") valid.routeId = "not-installed";
        if (mutation === "extra-field") valid.loadedInstruction = {};
        await writeFile(receiptPath, JSON.stringify(valid));
      }
      await assert.rejects(
        runMarketplaceProof(proofArgs(fixture), { bindingNonce: fixture.bindingNonce }),
        expected,
        mutation,
      );
    } finally { await rm(fixture.root, { recursive: true, force: true }); }
  });
}

test("proof harness rejects artifact file mutation performed by the validator", async () => {
  const fixture = await traceFixture();
  try {
    const contentPath = path.join(fixture.artifactPath, "content.md");
    await writeFile(contentPath, "A\n");
    await writeFile(fixture.validatorPath, [
      'import { writeFile } from "node:fs/promises";',
      `await writeFile(${JSON.stringify(contentPath)}, "B\\n");`,
      'process.stdout.write(JSON.stringify({ ok: true, errors: [], warnings: [], files: ["content.md"], requestedFormats: ["md"] }, null, 2));',
    ].join("\n"));
    await assert.rejects(runMarketplaceProof([
      fixture.cacheRoot,
      fixture.workspaceRoot,
      fixture.validatorPath,
      createHash("sha256").update(await readFile(fixture.validatorPath)).digest("hex"),
      fixture.artifactPath,
      fixture.requestSha256,
    ]), /artifact tree changed/u);
  } finally { await rm(fixture.root, { recursive: true, force: true }); }
});

test("proof harness rejects a structural hash-stream collision", async () => {
  const fixture = await traceFixture();
  try {
    const firstPath = path.join(fixture.artifactPath, "a");
    const secondPath = path.join(fixture.artifactPath, "b");
    await writeFile(firstPath, "A");
    await writeFile(secondPath, "B");
    const secondMode = (await lstat(secondPath)).mode;
    const forgedSuffix = `${JSON.stringify(["b", secondMode, "file"])}B`;
    await writeFile(fixture.validatorPath, [
      'import { rm, writeFile } from "node:fs/promises";',
      `await writeFile(${JSON.stringify(firstPath)}, ${JSON.stringify(`A${forgedSuffix}`)});`,
      `await rm(${JSON.stringify(secondPath)});`,
      'process.stdout.write(JSON.stringify({ ok: true, errors: [], warnings: [], files: ["a"], requestedFormats: ["md"] }));',
    ].join("\n"));
    await assert.rejects(runMarketplaceProof([
      fixture.cacheRoot,
      fixture.workspaceRoot,
      fixture.validatorPath,
      createHash("sha256").update(await readFile(fixture.validatorPath)).digest("hex"),
      fixture.artifactPath,
      fixture.requestSha256,
    ]), /artifact tree changed/u);
  } finally { await rm(fixture.root, { recursive: true, force: true }); }
});

test("proof harness rejects delete and recreate with identical bytes and mode", async () => {
  const fixture = await traceFixture();
  try {
    const contentPath = path.join(fixture.artifactPath, "content.md");
    await writeFile(contentPath, "same bytes\n");
    const permissions = (await lstat(contentPath)).mode & 0o777;
    await writeFile(fixture.validatorPath, [
      'import { readFile, rm, writeFile } from "node:fs/promises";',
      `const bytes = await readFile(${JSON.stringify(contentPath)});`,
      `await rm(${JSON.stringify(contentPath)});`,
      `await writeFile(${JSON.stringify(contentPath)}, bytes, { mode: ${permissions} });`,
      'process.stdout.write(JSON.stringify({ ok: true, errors: [], warnings: [], files: ["content.md"], requestedFormats: ["md"] }));',
    ].join("\n"));
    await assert.rejects(runMarketplaceProof([
      fixture.cacheRoot,
      fixture.workspaceRoot,
      fixture.validatorPath,
      createHash("sha256").update(await readFile(fixture.validatorPath)).digest("hex"),
      fixture.artifactPath,
      fixture.requestSha256,
    ]), /artifact tree changed/u);
  } finally { await rm(fixture.root, { recursive: true, force: true }); }
});

for (const invalid of ["prose", "array", "trailing-malformed", "duplicate-receipt"]) {
  test(`proof harness rejects ${invalid} output`, async () => {
    const fixture = await traceFixture();
    try {
      const source = events(fixture);
      if (invalid === "prose") source[2].item.aggregated_output = `noise\n${source[2].item.aggregated_output}`;
      if (invalid === "array") source[2].item.aggregated_output += "[]\n";
      if (invalid === "trailing-malformed") source[2].item.aggregated_output += "{\n";
      if (invalid === "duplicate-receipt") source[2].item.aggregated_output += source[2].item.aggregated_output;
      await assert.rejects(parseExecJsonl(source.map(JSON.stringify).join("\n"), { ...fixture }), /unverifiable/u);
    } finally { await rm(fixture.root, { recursive: true, force: true }); }
  });
}

test("echo-only completed turn is unverifiable", async () => {
  const fixture = await traceFixture();
  try {
    const echoOnly = [
      { type: "item.completed", item: { type: "command_execution", command: `echo ${fixture.skillPath}`, exit_code: 0, status: "completed" } },
      { type: "item.completed", item: { type: "agent_message", text: `SKILL_PROVENANCE=${fixture.skillPath}\nARTIFACT_PATH=${fixture.artifactPath}` } },
      { type: "turn.completed" },
    ];
    await assert.rejects(parseExecJsonl(echoOnly.map(JSON.stringify).join("\n"), {
      ...fixture,
    }), /unverifiable/u);
  } finally { await rm(fixture.root, { recursive: true, force: true }); }
});

for (const mutation of ["missing-route-receipt", "wrong-route-request", "wrong-route-skill", "wrong-route-hash"]) {
  test(`proof trace rejects ${mutation}`, async () => {
    const fixture = await traceFixture();
    try {
      const source = events(fixture);
      const receipt = JSON.parse(source[2].item.aggregated_output);
      if (mutation === "missing-route-receipt") delete receipt.routeReceipt;
      if (mutation === "wrong-route-request") receipt.routeReceipt.requestSha256 = "0".repeat(64);
      if (mutation === "wrong-route-skill") receipt.routeReceipt.loadedInstruction.relativePath = "skills/map-game-design-career/SKILL.md";
      if (mutation === "wrong-route-hash") receipt.routeReceipt.loadedInstruction.sha256 = "0".repeat(64);
      source[2].item.aggregated_output = `${JSON.stringify(receipt)}\n`;
      await assert.rejects(parseExecJsonl(source.map(JSON.stringify).join("\n"), { ...fixture }), /unverifiable/u);
    } finally { await rm(fixture.root, { recursive: true, force: true }); }
  });
}

for (const mutation of [
  "missing-proof", "failed-proof", "wrong-skill-hash", "prefix-trick", "extra-arg", "separator",
  "redirection", "workspace-proof", "wrong-proof-identity",
  "symlink-skill", "symlink-validator", "symlink-artifact", "outside-artifact", "modified-skill", "modified-validator",
]) {
  test(`proof trace rejects ${mutation}`, async () => {
    const fixture = await traceFixture();
    try {
      const source = events(fixture);
      if (mutation === "missing-proof") source.splice(2, 1);
      if (mutation === "failed-proof") source[2].item.exit_code = 1;
      if (mutation === "wrong-skill-hash") source[2].item.aggregated_output = source[2].item.aggregated_output.replace(fixture.skillSha256, "0".repeat(64));
      if (mutation === "prefix-trick") source[2].item.command = source[2].item.command.replace(PROOF_HARNESS_PATH, `${PROOF_HARNESS_PATH}-suffix`);
      if (mutation === "extra-arg") source[2].item.command += " extra";
      if (mutation === "separator") source[2].item.command += " ; printf forged";
      if (mutation === "redirection") source[2].item.command += " > receipt.json";
      if (mutation === "workspace-proof") source[2].item.command = source[2].item.command.replace(PROOF_HARNESS_PATH, fixture.workspaceProver);
      if (mutation === "wrong-proof-identity") fixture.proofIdentity = { ...fixture.proofIdentity, sha256: "0".repeat(64) };
      if (mutation === "modified-skill") await writeFile(fixture.skillPath, "modified skill\n");
      if (mutation === "modified-validator") await writeFile(fixture.validatorPath, "modified validator\n");
      if (mutation === "symlink-skill" || mutation === "symlink-validator") {
        const target = mutation === "symlink-skill" ? fixture.skillPath : fixture.validatorPath;
        const real = `${target}.real`;
        await writeFile(real, "fixture\n");
        await rm(target);
        await symlink(real, target);
      }
      if (mutation === "symlink-artifact") {
        const real = `${fixture.artifactPath}.real`;
        await mkdir(real);
        await rm(fixture.artifactPath, { recursive: true });
        await symlink(real, fixture.artifactPath);
      }
      if (mutation === "outside-artifact") {
        fixture.artifactPath = path.join(fixture.root, "outside-artifact");
        await mkdir(fixture.artifactPath);
      }
      await assert.rejects(parseExecJsonl(source.map(JSON.stringify).join("\n"), {
        ...fixture,
      }), /unverifiable/u);
    } finally { await rm(fixture.root, { recursive: true, force: true }); }
  });
}

const cliContext = {
  repoRoot: "/repo",
  productName: product,
  cacheRoot: "/temp/cache/game-design-career/0.1.1",
};
const cliSamples = {
  marketplaceAdd: { marketplaceName: "game-design-suite", installedRoot: "/repo", alreadyAdded: false },
  pluginAdd: { pluginId, name: product, marketplaceName: "game-design-suite", version: "0.1.1", installedPath: cliContext.cacheRoot, authPolicy: "ON_USE" },
  pluginList: { installed: [{ pluginId, name: product, marketplaceName: "game-design-suite", version: "0.1.1", installed: true, enabled: true, source: { source: "local", path: "/repo/plugins/game-design-career" }, marketplaceSource: { sourceType: "local", source: "/repo" }, installPolicy: "AVAILABLE", authPolicy: "ON_USE" }], available: [] },
  pluginRemove: { pluginId, name: product, marketplaceName: "game-design-suite" },
  marketplaceRemove: { marketplaceName: "game-design-suite", installedRoot: null },
  marketplaceList: { marketplaces: [] },
};

for (const [kind, sample] of Object.entries(cliSamples)) {
  test(`${kind} accepts only the exact current CLI JSON contract`, () => {
    assert.doesNotThrow(() => validateCliJson(kind, structuredClone(sample), cliContext));
    const missing = structuredClone(sample);
    delete missing[Object.keys(missing)[0]];
    assert.throws(() => validateCliJson(kind, missing, cliContext), /contract mismatch/u);
    assert.throws(() => validateCliJson(kind, { ...structuredClone(sample), unknown: true }, cliContext), /contract mismatch/u);
    const mutated = structuredClone(sample);
    const key = Object.keys(mutated).find((candidate) => typeof mutated[candidate] === "string");
    if (key) mutated[key] = "mutated";
    else if (kind === "pluginList") mutated.installed[0].enabled = false;
    else mutated.marketplaces = [{}];
    assert.throws(() => validateCliJson(kind, mutated, cliContext), /contract mismatch/u);
  });
}

test("local session auth is copied as an opaque regular 0600 file", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "auth-bridge-"));
  const source = path.join(root, "source-auth.json");
  const destination = path.join(root, "temp-home/auth.json");
  try {
    await writeFile(source, "dummy-secret-that-must-not-be-reported\n", { mode: 0o600 });
    assert.deepEqual(await bridgeLocalAuth({ source, destination }), { authSource: "local-session" });
    const stats = await lstat(destination);
    assert.equal(stats.isFile(), true);
    assert.equal(stats.mode & 0o777, 0o600);
    assert.equal(await readFile(destination, "utf8"), "dummy-secret-that-must-not-be-reported\n");
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("failure redaction never reports environment secret material", () => {
  const secret = "DUMMY_CREDENTIAL_MATERIAL_NEVER_LOG";
  const redacted = redactFailure(`401 Unauthorized ${secret}`, { OPENAI_API_KEY: secret });
  assert.equal(redacted, "authentication failed (401)");
  assert.doesNotMatch(redacted, /DUMMY_CREDENTIAL|NEVER_LOG|OPENAI_API_KEY/u);
});

test("marketplace smoke failure receipts expose only exact safe code, product, and stage", () => {
  const cases = [
    [new Error("spawnSync codex ETIMEDOUT"), { code: "natural-language-exec-timeout", product: "game-design-studio", stage: "natural-language-exec" }],
    [new Error("codex exec unverifiable: route receipt mismatch"), { code: "route-receipt-mismatch", product: "game-design-career", stage: "route-receipt" }],
    [new Error("game-design-career artifact validation failed"), { code: "artifact-validation-failed", product: "game-design-career", stage: "artifact-validation" }],
    [new Error("game-design-studio cache mismatch"), { code: "plugin-package-invalid", product: "game-design-studio", stage: "plugin-package" }],
  ];
  for (const [error, expected] of cases) {
    assert.deepEqual(createSmokeFailure(error, { product: expected.product, stage: expected.stage }), expected);
  }
  const receipt = createSmokeFailure(new Error("/private/secret/token=never"), {
    product: "game-design-studio",
    stage: "plugin-install",
  });
  assert.deepEqual(receipt, { code: "plugin-install-failed", product: "game-design-studio", stage: "plugin-install" });
  assert.equal(JSON.stringify(receipt).includes("secret"), false);
});

test("artifact absence is detected before route receipt inspection", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "marketplace-artifact-stage-"));
  try {
    await assert.rejects(assertArtifactDirectory(path.join(root, "missing")), /artifact missing/u);
    const regularFile = path.join(root, "artifact.txt");
    await writeFile(regularFile, "not a directory\n");
    await assert.rejects(assertArtifactDirectory(regularFile), /artifact missing/u);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("cleanup failure never overwrites the primary cause while state drift remains authoritative", () => {
  const primary = { code: "artifact-validation-failed", product: "game-design-studio", stage: "artifact-validation" };
  const cleanup = { code: "temporary-cleanup-failed", product: null, stage: "temporary-cleanup" };
  const stateDrift = { code: "production-state-changed", product: null, stage: "production-state" };

  assert.deepEqual(preservePrimarySmokeFailure(primary, cleanup), primary);
  assert.deepEqual(preservePrimarySmokeFailure(null, cleanup), cleanup);
  assert.deepEqual(preservePrimarySmokeFailure(primary, stateDrift, { override: true }), stateDrift);
});

test("artifact validation exposes only allowlisted diagnostic codes", () => {
  const output = JSON.stringify({ ok: false, requestedFormats: ["md"], errors: [
    { code: "artifact.required_file", message: "/private/secret.md TOKEN=never" },
    { code: "../escape", message: "ignored" },
    { code: "artifact.required_file", message: "duplicate" },
  ] });
  assert.throws(() => runArtifactValidation("validator", "artifact", {
    execute: () => ({ status: 1, stdout: output, stderr: "" }),
  }), (error) => {
    assert.deepEqual(error.diagnosticCodes, ["artifact.required_file"]);
    assert.doesNotMatch(JSON.stringify(error.diagnosticCodes), /secret|private|TOKEN/u);
    return true;
  });
  assert.throws(() => runArtifactValidation("validator", "artifact", {
    execute: () => ({ status: 1, stdout: "not-json", stderr: "" }),
  }), /invalid JSON/u);
});

test("failure redaction makes authentication-path failures generic", () => {
  assert.equal(
    redactFailure("command exited 1: unable to access /Users/example/.codex/auth.json", {}),
    "command failed (details redacted)",
  );
  assert.equal(
    redactFailure("unable to access C:\\Users\\example\\.codex\\auth.json", {}),
    "command failed (details redacted)",
  );
});

test("failure redaction replaces HOME, CODEX_HOME, and arbitrary encoded absolute paths", () => {
  const environment = {
    HOME: "/Users/게임 사용자",
    CODEX_HOME: "/Users/게임 사용자/Codex Home",
  };
  assert.equal(redactFailure(
    "failed at /Users/게임 사용자/Codex Home/plugins/cache; temp=/tmp/%EA%B2%8C%EC%9E%84%20%EA%B8%B0%ED%9A%8D/file.md; win=C:\\work space\\file.md",
    environment,
  ), "command failed (details redacted)");
});

test("failure redaction removes bracket-leading Korean POSIX paths and encoded user paths", () => {
  assert.equal(redactFailure(
    "failed [/tmp/게임 경로/file.md] and %2FUsers%2Fexample%2Fprivate%2Fplan.md",
    {},
  ), "command failed (details redacted)");
});

test("failure redaction makes credential-shaped failures generic", () => {
  for (const message of [
    "Authorization: Basic ZHVtbXk6c2VjcmV0",
    "Authorization Basic ZHVtbXk6c2VjcmV0",
    "request failed secret=dummy-private-value",
    "request failed password=dummy-private-value",
  ]) {
    assert.equal(redactFailure(message, {}), "command failed (details redacted)");
  }
});

test("failure redaction removes UNC paths", () => {
  assert.equal(redactFailure("failed at \\\\server\\share\\private\\file.md", {}), "command failed (details redacted)");
});

test("failure redaction is fail-closed for all non-allowlisted details", () => {
  for (const message of [
    "Cookie: session=dummy-private-value",
    "Auth: Basic dummy-private-value",
    "credential=dummy-private-value",
    "secret=dummy-private-value",
    "password=dummy-private-value",
    "/tmp/private/file.md",
    "C:\\private\\file.md",
    "file:///Users/example/private.md",
    "%252FUsers%252Fexample%252Fprivate.md",
    "ordinary command failure with internal details",
  ]) {
    assert.equal(redactFailure(message, {}), "command failed (details redacted)");
  }
  assert.equal(redactFailure("turn.failed: private detail", {}), "codex turn failed");
});
