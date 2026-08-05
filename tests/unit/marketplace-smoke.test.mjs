import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { lstat, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  bridgeLocalAuth,
  parseExecJsonl,
  redactFailure,
  validateCliJson,
} from "../../tooling/marketplace-smoke.mjs";

const product = "game-design-career";
const pluginId = `${product}@game-design-suite`;

async function traceFixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "marketplace-trace-"));
  const cacheRoot = path.join(root, "cache", product, "0.1.0");
  const skillPath = path.join(cacheRoot, "skills/orchestrate-game-design-career/SKILL.md");
  const validatorPath = path.join(cacheRoot, "scripts/validate-artifact.mjs");
  const artifactPath = path.join(root, "workspace/artifact");
  const proofPath = path.join(root, "workspace/prove-installed-skill.mjs");
  for (const file of [skillPath, validatorPath]) {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, "fixture\n");
  }
  await mkdir(artifactPath, { recursive: true });
  await writeFile(proofPath, "fixture proof\n");
  const skillSha256 = createHash("sha256").update("fixture\n").digest("hex");
  return { root, cacheRoot, skillPath, skillSha256, validatorPath, artifactPath, proofPath };
}

function events(fixture) {
  return [
    { type: "thread.started", thread_id: "redacted" },
    { type: "turn.started" },
    { type: "item.completed", item: {
      type: "command_execution",
      command: `/bin/zsh -lc 'node "${fixture.proofPath}" "${fixture.skillPath}"'`,
      exit_code: 0, status: "completed", aggregated_output: `${JSON.stringify({ ok: true, sha256: fixture.skillSha256 })}\n`,
    } },
    { type: "item.completed", item: {
      type: "command_execution",
      command: `/bin/zsh -lc 'node "${fixture.validatorPath}" "${fixture.artifactPath}" md'`,
      exit_code: 0, status: "completed", aggregated_output: `${JSON.stringify({ ok: true, errors: [], warnings: [], files: ["content.md"], requestedFormats: ["md"] }, null, 2)}\n`,
    } },
    { type: "item.completed", item: { type: "agent_message", text: "self-report is supplemental only" } },
    { type: "turn.completed" },
  ];
}

test("exec JSONL requires successful installed SKILL.md digest and artifact-validator traces", async () => {
  const fixture = await traceFixture();
  try {
    const result = await parseExecJsonl(events(fixture).map(JSON.stringify).join("\n"), {
      ...fixture,
    });
    assert.deepEqual(result, { completed: true, installedSkillDigest: true, artifactValidatorTrace: true });
  } finally { await rm(fixture.root, { recursive: true, force: true }); }
});

test("exec JSONL accepts both required commands batched into one successful shell trace", async () => {
  const fixture = await traceFixture();
  try {
    const source = events(fixture);
    source[2].item.command = `${source[2].item.command} && node "${fixture.validatorPath}" "${fixture.artifactPath}" md`;
    source[2].item.aggregated_output += source[3].item.aggregated_output;
    source.splice(3, 1);
    const result = await parseExecJsonl(source.map(JSON.stringify).join("\n"), { ...fixture });
    assert.deepEqual(result, { completed: true, installedSkillDigest: true, artifactValidatorTrace: true });
  } finally { await rm(fixture.root, { recursive: true, force: true }); }
});

for (const missing of ["validator-path", "validator-output"]) {
  test(`batched exec trace rejects missing ${missing}`, async () => {
    const fixture = await traceFixture();
    try {
      const source = events(fixture);
      source[2].item.command = `${source[2].item.command} && node "${fixture.validatorPath}" "${fixture.artifactPath}" md`;
      source[2].item.aggregated_output += source[3].item.aggregated_output;
      source.splice(3, 1);
      if (missing === "validator-path") source[2].item.command = source[2].item.command.replace(fixture.validatorPath, "missing-validator.mjs");
      else source[2].item.aggregated_output = source[2].item.aggregated_output.split("\n")[0];
      await assert.rejects(parseExecJsonl(source.map(JSON.stringify).join("\n"), { ...fixture }), /unverifiable/u);
    } finally { await rm(fixture.root, { recursive: true, force: true }); }
  });
}

for (const invalid of ["prose", "array", "trailing-malformed", "duplicate-validator"]) {
  test(`batched exec trace rejects ${invalid} output`, async () => {
    const fixture = await traceFixture();
    try {
      const source = events(fixture);
      source[2].item.command = `${source[2].item.command} && node "${fixture.validatorPath}" "${fixture.artifactPath}" md`;
      source[2].item.aggregated_output += source[3].item.aggregated_output;
      source.splice(3, 1);
      if (invalid === "prose") source[2].item.aggregated_output = `noise\n${source[2].item.aggregated_output}`;
      if (invalid === "array") source[2].item.aggregated_output += "[]\n";
      if (invalid === "trailing-malformed") source[2].item.aggregated_output += "{\n";
      if (invalid === "duplicate-validator") source[2].item.aggregated_output += `${JSON.stringify({ ok: true, errors: [], warnings: [], files: ["content.md"], requestedFormats: ["md"] })}\n`;
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

for (const mutation of ["missing-skill-trace", "failed-skill", "wrong-skill-hash", "prefix-trick", "failed-validator", "validator-lies", "symlink-proof", "symlink-skill", "symlink-validator"]) {
  test(`exec trace rejects ${mutation}`, async () => {
    const fixture = await traceFixture();
    try {
      const source = events(fixture);
      if (mutation === "missing-skill-trace") source.splice(2, 1);
      if (mutation === "failed-skill") source[2].item.exit_code = 1;
      if (mutation === "wrong-skill-hash") source[2].item.aggregated_output = `${JSON.stringify({ ok: true, sha256: "0".repeat(64) })}\n`;
      if (mutation === "prefix-trick") source[2].item.command = source[2].item.command.replace(fixture.skillPath, `${fixture.skillPath}-suffix`);
      if (mutation === "failed-validator") source[3].item.status = "failed";
      if (mutation === "validator-lies") source[3].item.aggregated_output = `${JSON.stringify({ ok: false, errors: [], warnings: [], files: ["content.md"], requestedFormats: ["md"] })}\n`;
      if (mutation === "symlink-skill") {
        const real = `${fixture.skillPath}.real`;
        await writeFile(real, "fixture\n");
        await rm(fixture.skillPath);
        await symlink(real, fixture.skillPath);
      }
      if (mutation === "symlink-proof") {
        const real = `${fixture.proofPath}.real`;
        await writeFile(real, "fixture\n");
        await rm(fixture.proofPath);
        await symlink(real, fixture.proofPath);
      }
      if (mutation === "symlink-validator") {
        const real = `${fixture.validatorPath}.real`;
        await writeFile(real, "fixture\n");
        await rm(fixture.validatorPath);
        await symlink(real, fixture.validatorPath);
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
