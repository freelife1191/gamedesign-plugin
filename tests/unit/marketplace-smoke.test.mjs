import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { lstat, mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  bridgeLocalAuth,
  buildProofCommand,
  captureFileIdentity,
  PACKAGED_SKILL_COUNT,
  parseExecJsonl,
  PROOF_HARNESS_PATH,
  redactFailure,
  validateCliJson,
} from "../../tooling/marketplace-smoke.mjs";
import { artifactTreeIdentity, runMarketplaceProof } from "../../tooling/lib/marketplace-proof-harness.mjs";

const product = "game-design-career";
const pluginId = `${product}@game-design-suite`;

test("marketplace smoke expects all fourteen product skills plus vendored Skillstead", () => {
  assert.equal(PACKAGED_SKILL_COUNT, 15);
});

async function traceFixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "marketplace-trace-"));
  const cacheRoot = path.join(root, "cache", product, "0.1.0");
  const skillPath = path.join(cacheRoot, "skills/orchestrate-game-design-career/SKILL.md");
  const validatorPath = path.join(cacheRoot, "scripts/validate-artifact.mjs");
  const artifactPath = path.join(root, "workspace/artifact");
  const workspaceProver = path.join(root, "workspace/prove-installed-skill.mjs");
  for (const file of [skillPath, validatorPath]) {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, "fixture\n");
  }
  await mkdir(artifactPath, { recursive: true });
  await writeFile(workspaceProver, "fixture proof\n");
  const skillSha256 = createHash("sha256").update("fixture\n").digest("hex");
  const validatorSha256 = skillSha256;
  const [proofIdentity, artifactIdentity, trustedShell] = await Promise.all([
    captureFileIdentity(PROOF_HARNESS_PATH), artifactTreeIdentity(artifactPath), realpath("/bin/sh"),
  ]);
  return {
    root, cacheRoot, workspaceRoot: path.dirname(artifactPath), skillPath, skillSha256,
    validatorPath, validatorSha256, artifactPath, proofIdentity, artifactSha256: artifactIdentity.sha256,
    trustedShellPaths: [trustedShell], workspaceProver,
  };
}

function proofArgs(fixture) {
  return [
    fixture.cacheRoot, fixture.workspaceRoot, fixture.skillPath, fixture.skillSha256,
    fixture.validatorPath, fixture.validatorSha256, fixture.artifactPath,
  ];
}

function events(fixture) {
  const receipt = {
    schemaVersion: 1,
    ok: true,
    skillSha256: fixture.skillSha256,
    validatorSha256: fixture.validatorSha256,
    artifactSha256: fixture.artifactSha256,
    requestedFormats: ["md"],
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
    assert.deepEqual(result, { completed: true, proofHarness: true });
  } finally { await rm(fixture.root, { recursive: true, force: true }); }
});

test("exec JSONL accepts the exact command inside the current shell wrapper", async () => {
  const fixture = await traceFixture();
  try {
    const source = events(fixture);
    source[2].item.command = `${fixture.trustedShellPaths[0]} -lc ${JSON.stringify(source[2].item.command)}`;
    const result = await parseExecJsonl(source.map(JSON.stringify).join("\n"), { ...fixture });
    assert.deepEqual(result, { completed: true, proofHarness: true });
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
      fixture.skillPath,
      fixture.skillSha256,
      fixture.validatorPath,
      createHash("sha256").update(await readFile(fixture.validatorPath)).digest("hex"),
      fixture.artifactPath,
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
      fixture.skillPath,
      fixture.skillSha256,
      fixture.validatorPath,
      createHash("sha256").update(await readFile(fixture.validatorPath)).digest("hex"),
      fixture.artifactPath,
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
      fixture.skillPath,
      fixture.skillSha256,
      fixture.validatorPath,
      createHash("sha256").update(await readFile(fixture.validatorPath)).digest("hex"),
      fixture.artifactPath,
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
  cacheRoot: "/temp/cache/game-design-career/0.1.0",
};
const cliSamples = {
  marketplaceAdd: { marketplaceName: "game-design-suite", installedRoot: "/repo", alreadyAdded: false },
  pluginAdd: { pluginId, name: product, marketplaceName: "game-design-suite", version: "0.1.0", installedPath: cliContext.cacheRoot, authPolicy: "ON_USE" },
  pluginList: { installed: [{ pluginId, name: product, marketplaceName: "game-design-suite", version: "0.1.0", installed: true, enabled: true, source: { source: "local", path: "/repo/plugins/game-design-career" }, marketplaceSource: { sourceType: "local", source: "/repo" }, installPolicy: "AVAILABLE", authPolicy: "ON_USE" }], available: [] },
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
