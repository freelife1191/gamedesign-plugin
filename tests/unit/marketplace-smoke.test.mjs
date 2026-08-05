import assert from "node:assert/strict";
import { lstat, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { bridgeLocalAuth, parseExecJsonl, redactFailure } from "../../tooling/marketplace-smoke.mjs";

const skill = "$game-design-career:orchestrate-game-design-career";
const artifact = "/tmp/workspace/career-artifact";

test("exec JSONL accepts only a completed turn with explicit installed skill provenance", () => {
  const result = parseExecJsonl([
    JSON.stringify({ type: "thread.started", thread_id: "redacted" }),
    JSON.stringify({ type: "turn.started" }),
    JSON.stringify({ type: "item.completed", item: { type: "agent_message", text: `SKILL_PROVENANCE=${skill}\nARTIFACT_PATH=${artifact}` } }),
    JSON.stringify({ type: "turn.completed", usage: { input_tokens: 1, output_tokens: 1 } }),
  ].join("\n"), { skillInvocation: skill, artifactPath: artifact });
  assert.deepEqual(result, { completed: true, provenance: true, artifactPathReported: true });
});

for (const [label, lines] of [
  ["turn failure", [{ type: "turn.failed", error: { message: "failed" } }]],
  ["401", [{ type: "error", message: "401 Unauthorized" }]],
  ["missing completion", [{ type: "thread.started" }]],
  ["missing provenance", [{ type: "turn.completed" }]],
]) {
  test(`exec JSONL rejects ${label}`, () => {
    assert.throws(() => parseExecJsonl(lines.map(JSON.stringify).join("\n"), { skillInvocation: skill, artifactPath: artifact }), /incomplete/u);
  });
}

test("local session auth is copied as an opaque regular 0600 file", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "auth-bridge-"));
  const source = path.join(root, "source-auth.json");
  const destination = path.join(root, "temp-home/auth.json");
  try {
    await writeFile(source, "dummy-secret-that-must-not-be-reported\n", { mode: 0o600 });
    const result = await bridgeLocalAuth({ source, destination });
    assert.deepEqual(result, { authSource: "local-session" });
    const stats = await lstat(destination);
    assert.equal(stats.isFile(), true);
    assert.equal(stats.mode & 0o777, 0o600);
    assert.equal(await readFile(destination, "utf8"), "dummy-secret-that-must-not-be-reported\n");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("failure redaction never reports environment secret material", () => {
  const secret = "DUMMY_CREDENTIAL_MATERIAL_NEVER_LOG";
  const redacted = redactFailure(`401 Unauthorized ${secret}`, { OPENAI_API_KEY: secret });
  assert.equal(redacted, "authentication failed (401)");
  assert.doesNotMatch(redacted, /DUMMY_CREDENTIAL|NEVER_LOG|OPENAI_API_KEY/u);
});
