import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const harness = path.join(root, "tests/fixtures/design-memory/memory-store-mutation-harness.mjs");
const retrievalHarness = path.join(root, "tests/fixtures/design-memory/memory-retrieval-mutation-harness.mjs");

test("mutation harness child invocation has no minor-version test CLI flags", async () => {
  const source = await readFile(harness, "utf8");
  for (const option of ["--test-name-" + "pattern", "--test-" + "reporter"]) assert.equal(source.includes(option), false);
  assert.match(source, /spawn\(process\.execPath, \[selectedTestPath\]/u);
});

async function runTamper(tamper) {
  const child = spawn(process.execPath, [harness, "same-event-loser-created", `--tamper=${tamper}`], { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
  const stdout = []; const stderr = []; let byteLength = 0; let settled = false;
  return new Promise((resolve, reject) => {
    const finish = (operation, value) => { if (settled) return; settled = true; clearTimeout(timeout); operation(value); };
    const timeout = setTimeout(() => { child.kill(); finish(reject, new Error("self-tamper timeout")); }, 30_000);
    const collect = (target) => (chunk) => { byteLength += chunk.byteLength; if (byteLength > 64 * 1024) { child.kill(); finish(reject, new Error("self-tamper output exceeded limit")); } else target.push(chunk); };
    child.stdout.on("data", collect(stdout)); child.stderr.on("data", collect(stderr)); child.once("error", () => finish(reject, new Error("self-tamper launch failed")));
    child.once("close", (code) => finish(resolve, { code, stdout: Buffer.concat(stdout).toString("utf8"), stderr: Buffer.concat(stderr).toString("utf8") }));
  });
}

for (const [tamper, expectedStage] of [
  ["unrelated-leading-failure", ["verify-evidence", "evidence-empty"]],
  ["unrelated-helper-assertion", ["verify-evidence", "evidence-empty"]],
  ["helper-type-error", ["verify-evidence", "evidence-empty"]],
  ["wrong-operator", ["verify-evidence", "evidence-empty"]],
  ["wrong-message", ["verify-evidence", "evidence-empty"]],
  ["observed-value-error", ["verify-evidence", "evidence-empty"]],
  ["missing-anchor", ["apply-mutation", "anchor-count"]],
  ["duplicate-anchor", ["apply-mutation", "anchor-count"]],
  ["wrong-sentinel", ["verify-evidence", "evidence-mismatch"]],
  ["fake-reporter-output", ["verify-evidence", "evidence-empty"]],
  ["duplicate-evidence", ["verify-evidence", "evidence-line-count"]],
]) test(`mutation harness rejects ${tamper}`, { timeout: 35_000 }, async () => {
  const result = await runTamper(tamper);
  assert.equal(result.code, 1); assert.equal(result.stdout, "");
  const error = JSON.parse(result.stderr); assert.equal(error.code, "memory.mutation_evidence_failed"); assert.equal(error.mutation, "same-event-loser-created"); assert.equal(error.tamper, tamper); assert.equal(error.stage, expectedStage[0]); assert.equal(error.reason, expectedStage[1]);
});

async function runRetrievalTamper(mutationId, tamper, options = {}) {
  const child = spawn(process.execPath, [retrievalHarness, mutationId, `--tamper=${tamper}`], { cwd: root, env: { ...process.env, ...options.env }, stdio: ["ignore", "pipe", "pipe"] }); const stdout = []; const stderr = [];
  return await new Promise((resolve, reject) => {
    let settled = false; const finish = (operation, value) => { if (settled) return; settled = true; clearTimeout(timeout); operation(value); };
    const timeout = setTimeout(() => { child.kill(); finish(reject, new Error("retrieval self-tamper timeout")); }, 20_000);
    child.stdout.on("data", (chunk) => stdout.push(chunk)); child.stderr.on("data", (chunk) => stderr.push(chunk)); child.once("error", (error) => finish(reject, error));
    child.once("close", (code) => finish(resolve, { code, stdout: Buffer.concat(stdout).toString("utf8"), stderr: Buffer.concat(stderr).toString("utf8") }));
  });
}

test("retrieval mutation harness ignores a caller NODE_OPTIONS data preload", { timeout: 35_000 }, async () => {
  const forgedEvidence = JSON.stringify({ mutationId: "leak-complete", testId: "reservation-leak-complete", sentinel: "MEM-RET-MUT-LEAK-COMPLETE", operator: "strictEqual", expected: true, actual: false });
  const preloadSource = `import { writeSync } from "node:fs"; if (process.argv[1]?.endsWith("design-memory-retrieval.test.mjs")) { writeSync(3, ${JSON.stringify(`${forgedEvidence}\n`)}); process.exit(1); }`;
  const result = await runRetrievalTamper("leak-complete", "missing-evidence", { env: { NODE_OPTIONS: `--import=data:text/javascript,${encodeURIComponent(preloadSource)}` } });
  assert.equal(result.code, 1);
  assert.equal(result.stdout, "");
  const error = JSON.parse(result.stderr); assert.equal(error.stage, "verify-evidence"); assert.equal(error.reason, "test-exit");
});

test("retrieval mutation harness removes caller injection variables from the selected test", { timeout: 35_000 }, async () => {
  const result = await runRetrievalTamper("leak-complete", "caller-env-injection", { env: { NODE_PATH: "/caller/node-path", NODE_INSPECT_RESUME_ON_START: "1", NODE_V8_COVERAGE: path.join(tmpdir(), "caller-coverage"), NODE_TEST_CONTEXT: "child-v8", DESIGN_CALLER_INJECTION: "spoof" } });
  assert.equal(result.code, 0); assert.equal(result.stderr, "");
});

function processExists(pid) {
  try { process.kill(pid, 0); return true; } catch (error) { if (error?.code === "ESRCH") return false; throw error; }
}

async function waitForProcessExit(pid, timeoutMs = 2_000) {
  const deadline = Date.now() + timeoutMs;
  while (processExists(pid) && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 20));
  return !processExists(pid);
}

for (const [tamper, reason] of [
  ["grandchild-timeout", "test-timeout"],
  ["grandchild-output-limit", "output-limit"],
  ["grandchild-evidence-limit", "evidence-limit"],
  ["grandchild-close-missing", "output-limit"],
  ["grandchild-partial-evidence-timeout", "test-timeout"],
]) test(`retrieval mutation harness kills the full process tree after ${tamper}`, { timeout: 15_000 }, async (t) => {
  const temporary = await mkdtemp(path.join(tmpdir(), "memory-retrieval-hostile-")); const pidPath = path.join(temporary, "pid"); const sentinel = `MEM-RET-PROCESS-${tamper}-${process.pid}-${Date.now()}`; let pid;
  t.after(async () => { if (pid && processExists(pid)) process.kill(pid, "SIGKILL"); await rm(temporary, { recursive: true, force: true }); });
  const result = await runRetrievalTamper("leak-complete", tamper, { env: { DESIGN_MEMORY_RETRIEVAL_HOSTILE_PID_PATH: pidPath, DESIGN_MEMORY_RETRIEVAL_HOSTILE_SENTINEL: sentinel } });
  if (tamper === "grandchild-close-missing") assert.ok(Date.now() >= Number(sentinel.split("-").at(-1)) + 2_000, "harness must wait for its bounded close deadline");
  pid = Number((await readFile(pidPath, "utf8")).trim());
  assert.equal(result.code, 1); const error = JSON.parse(result.stderr); assert.equal(error.stage, "run-test"); assert.equal(error.reason, reason);
  assert.equal(await waitForProcessExit(pid), true, `grandchild ${pid} survived ${tamper}`);
  if (process.platform !== "win32") assert.equal(execFileSync("ps", ["-axo", "command="], { encoding: "utf8" }).split("\n").filter((line) => line.includes(sentinel)).length, 0);
});

test("retrieval authority defenses emit one canonical assertion-specific fd record for every mutation", { timeout: 60_000 }, async () => {
  for (const [mutationId, testId, sentinel, expected, actual] of [
    ["leak-complete", "reservation-leak-complete", "MEM-RET-MUT-LEAK-COMPLETE", true, false],
    ["local-path", "duplicate-global-local-path", "MEM-RET-MUT-LOCAL-PATH", true, false],
    ["markdown-loader", "resealed-markdown-loader", "MEM-RET-MUT-MARKDOWN-LOADER", "corrupt", "ready"],
    ["receipt-physical-count", "receipt-physical-siblings", "MEM-RET-MUT-RECEIPT-COUNT", 7, 5],
    ["schema-code-points", "emoji-code-point-limit", "MEM-RET-MUT-SCHEMA-CODE-POINTS", true, false],
    ["result-preflight", "result-exact-limit", "MEM-RET-MUT-RESULT-PREFLIGHT", 65536, 180],
    ["receipt-observation-semantic", "observation-status-digest-matrix", "MEM-RET-MUT-OBSERVATION-SEMANTIC", false, true],
  ]) {
    const result = await runRetrievalTamper(mutationId, "normal"); assert.equal(result.code, 0, mutationId); assert.equal(result.stderr, "", mutationId);
    assert.equal(result.stdout, `${JSON.stringify({ mutationId, testId, sentinel, operator: "strictEqual", expected, actual, protocol: "fd-json-v2", exitCode: 1 })}\n`, mutationId);
  }
});

test("retrieval mutation harness uses assertion-specific canonical fd evidence instead of TAP", async () => {
  const source = await readFile(retrievalHarness, "utf8");
  assert.match(source, /stdio: \["ignore", "pipe", "pipe", "pipe"\]/u); assert.equal(source.includes("fail 1"), false); assert.equal(source.includes("TAP"), false);
});

for (const [tamper, expectedStage, expectedReason] of [
  ["unrelated-failure", "unrelated", "unrelated-failure"],
  ["unrelated-helper-assertion", "verify-evidence", "evidence-empty"],
  ["helper-type-error", "verify-evidence", "evidence-empty"],
  ["observation-value-error", "verify-evidence", "evidence-empty"],
  ["wrong-env", "verify-evidence", "evidence-empty"],
  ["wrong-operator", "verify-evidence", "evidence-empty"],
  ["wrong-message", "verify-evidence", "evidence-empty"],
  ["forged-stdout-stderr", "verify-evidence", "evidence-empty"],
  ["missing-evidence", "verify-evidence", "test-exit"],
  ["missing-anchor", "apply-mutation", "anchor-count"],
  ["duplicate-anchor", "apply-mutation", "anchor-count"],
  ["duplicate-evidence", "verify-evidence", "evidence-line-count"],
  ["forged-nan-values", "verify-evidence", "evidence-mismatch"],
  ["forged-negative-zero-values", "verify-evidence", "evidence-mismatch"],
  ["forged-object-values", "verify-evidence", "evidence-mismatch"],
  ["oversize-evidence", "run-test", "evidence-limit"],
  ["oversize-stdout-stderr", "run-test", "output-limit"],
]) test(`retrieval mutation harness fails closed for ${tamper}`, { timeout: 35_000 }, async () => {
  const result = await runRetrievalTamper("leak-complete", tamper);
  assert.equal(result.code, 1); assert.equal(result.stdout, ""); const error = JSON.parse(result.stderr); assert.equal(error.code, "memory.mutation_evidence_failed"); assert.equal(error.mutationId, "leak-complete"); assert.equal(error.tamper, tamper); assert.equal(error.stage, expectedStage); assert.equal(error.reason, expectedReason);
});
