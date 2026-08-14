import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const harness = path.join(root, "tests/fixtures/reference-intelligence/reference-intelligence-mutation-harness.mjs");

const mutations = [
  ["evidence-tier", "discovery-causal-claim", "RI-MUT-EVIDENCE-TIER", false, true],
  ["fact-inference", "zero-evidence-remains-unknown", "RI-MUT-FACT-INFERENCE", "unknown", "inference"],
  ["atlas-obligation", "overlay-remains-candidate", "RI-MUT-ATLAS-OBLIGATION", "required-candidate", "mandatory"],
  ["transfer-approval", "transfer-remains-pending-review", "RI-MUT-TRANSFER-APPROVAL", "pending-review", "approved"],
  ["transfer-trace", "transfer-preserves-evidence-ids", "RI-MUT-TRANSFER-TRACE", '["ev-alpha"]', "[]"],
  ["glossary-capability", "forged-approval-remains-rejected", "RI-MUT-GLOSSARY-CAPABILITY", false, true],
  ["glossary-rewrite", "terminology-validation-does-not-rewrite", "RI-MUT-GLOSSARY-REWRITE", "플레이어 파워", "전투력"],
];

function allowedOuterEnvironment(additions = {}) {
  const env = {};
  for (const key of ["PATH", "TMPDIR", "TEMP", "TMP", "LANG", "LC_ALL", "HOME"]) if (typeof process.env[key] === "string") env[key] = process.env[key];
  return { ...env, ...additions };
}

async function capture(args, additions = {}) {
  const child = spawn(process.execPath, [harness, ...args], { cwd: root, env: allowedOuterEnvironment(additions), stdio: ["ignore", "pipe", "pipe"] });
  const stdout = []; const stderr = []; let length = 0;
  return await new Promise((resolve, reject) => {
    let settled = false;
    const finish = (operation, value) => { if (settled) return; settled = true; clearTimeout(timer); operation(value); };
    const timer = setTimeout(() => { child.kill("SIGKILL"); finish(reject, new Error("mutation self-test timeout")); }, 25_000);
    const collect = (target) => (chunk) => { length += chunk.byteLength; if (length > 128 * 1024) { child.kill("SIGKILL"); finish(reject, new Error("mutation self-test output limit")); } else target.push(chunk); };
    child.stdout.on("data", collect(stdout)); child.stderr.on("data", collect(stderr)); child.once("error", (error) => finish(reject, error));
    child.once("close", (code) => finish(resolve, { code, stdout: Buffer.concat(stdout).toString("utf8"), stderr: Buffer.concat(stderr).toString("utf8") }));
  });
}

function processExists(pid) {
  try { process.kill(pid, 0); return true; } catch (error) { if (error?.code === "ESRCH") return false; throw error; }
}

async function waitForProcessExit(pid, timeoutMs = 2_000) {
  const deadline = Date.now() + timeoutMs;
  while (processExists(pid) && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 20));
  return !processExists(pid);
}

test("seven reference intelligence mutations emit exact assertion-bound FD evidence", { timeout: 60_000 }, async () => {
  for (const [mutationId, testId, message, expected, actual] of mutations) {
    const result = await capture([mutationId, "--tamper=normal"]);
    assert.equal(result.code, 0, mutationId);
    assert.equal(result.stderr, "", mutationId);
    const evidence = JSON.parse(result.stdout);
    assert.deepEqual({ mutationId: evidence.mutationId, testId: evidence.testId, message: evidence.message.split("\n")[0], operator: evidence.operator, expected: evidence.expected, actual: evidence.actual, protocol: evidence.protocol, exitCode: evidence.exitCode }, { mutationId, testId, message, operator: "strictEqual", expected, actual, protocol: "fd-json-v3", exitCode: 1 });
  }
});

for (const [tamper, expectedStage, expectedReason] of [
  ["inside-wrapper-unrelated-error", "verify-evidence", "evidence-empty"],
  ["forged-stdout-stderr", "verify-evidence", "evidence-empty"],
  ["missing-evidence", "verify-evidence", "evidence-empty"],
  ["duplicate-evidence", "verify-evidence", "evidence-line-count"],
  ["partial-evidence", "verify-evidence", "evidence-line-count"],
  ["oversize-evidence", "run-test", "evidence-limit"],
  ["oversize-output", "run-test", "output-limit"],
  ["misleading-output", "verify-evidence", "test-exit"],
  ["wrong-env", "verify-evidence", "evidence-empty"],
]) test(`mutation harness fails closed for ${tamper}`, { timeout: 25_000 }, async () => {
  const result = await capture(["evidence-tier", `--tamper=${tamper}`]);
  assert.equal(result.code, 1); assert.equal(result.stdout, "");
  const error = JSON.parse(result.stderr);
  assert.deepEqual(error, { code: "reference-intelligence.mutation-evidence-failed", mutationId: "evidence-tier", tamper, stage: expectedStage, reason: expectedReason });
});

test("mutation harness strips caller injection variables from the selected test", { timeout: 25_000 }, async () => {
  const result = await capture(["evidence-tier", "--tamper=env-injection"], { REFERENCE_INTELLIGENCE_CALLER_INJECTION: "forged" });
  assert.equal(result.code, 0);
  assert.equal(result.stderr, "");
});

for (const tamper of ["timeout-orphan", "unclosed-evidence-fd"]) test(`mutation harness kills the full process tree after ${tamper}`, { timeout: 25_000 }, async (t) => {
  const temporary = await mkdtemp(path.join(tmpdir(), "ri-mutation-hostile-"));
  const pidPath = path.join(temporary, "pid");
  const sentinel = `RI-MUTATION-PROCESS-${tamper}-${process.pid}-${Date.now()}`;
  let pid;
  t.after(async () => { if (pid && processExists(pid)) process.kill(pid, "SIGKILL"); await rm(temporary, { recursive: true, force: true }); });
  const result = await capture(["evidence-tier", `--tamper=${tamper}`], { REFERENCE_INTELLIGENCE_HOSTILE_PID_PATH: pidPath, REFERENCE_INTELLIGENCE_HOSTILE_SENTINEL: sentinel });
  pid = Number((await readFile(pidPath, "utf8")).trim());
  assert.equal(result.code, 1);
  const error = JSON.parse(result.stderr);
  assert.equal(error.stage, "run-test");
  assert.equal(error.reason, "test-timeout");
  assert.equal(await waitForProcessExit(pid), true, "orphan process survived bounded cleanup");
  if (process.platform !== "win32") assert.equal(execFileSync("ps", ["-axo", "command="], { encoding: "utf8" }).split("\n").filter((line) => line.includes(sentinel)).length, 0);
});
