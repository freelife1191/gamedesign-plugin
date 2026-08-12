import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
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

async function runRetrievalTamper(mutationId, tamper) {
  const child = spawn(process.execPath, [retrievalHarness, mutationId, `--tamper=${tamper}`], { cwd: root, stdio: ["ignore", "pipe", "pipe"] }); const stdout = []; const stderr = [];
  return await new Promise((resolve, reject) => { child.stdout.on("data", (chunk) => stdout.push(chunk)); child.stderr.on("data", (chunk) => stderr.push(chunk)); child.once("error", reject); child.once("close", (code) => resolve({ code, stdout: Buffer.concat(stdout).toString("utf8"), stderr: Buffer.concat(stderr).toString("utf8") })); });
}

test("retrieval authority defenses emit one canonical assertion-specific fd record for every mutation", { timeout: 60_000 }, async () => {
  for (const mutationId of ["leak-complete", "local-path", "markdown-loader", "receipt-physical-count", "schema-code-points", "result-preflight", "receipt-observation-semantic"]) {
    const result = await runRetrievalTamper(mutationId, "normal"); assert.equal(result.code, 0, mutationId); assert.equal(result.stderr, "", mutationId);
    const evidence = JSON.parse(result.stdout); assert.equal(evidence.protocol, "fd-json-v2", mutationId); assert.equal(evidence.mutationId, mutationId); assert.equal(evidence.operator, "strictEqual", mutationId);
  }
});

test("retrieval mutation harness uses assertion-specific canonical fd evidence instead of TAP", async () => {
  const source = await readFile(retrievalHarness, "utf8");
  assert.match(source, /stdio: \["ignore", "pipe", "pipe", "pipe"\]/u); assert.equal(source.includes("fail 1"), false); assert.equal(source.includes("TAP"), false);
});

for (const tamper of ["unrelated-failure", "wrong-env", "wrong-operator", "wrong-message", "missing-evidence", "duplicate-evidence", "oversize-evidence"]) test(`retrieval mutation harness fails closed for ${tamper}`, { timeout: 35_000 }, async () => {
  const result = await runRetrievalTamper("leak-complete", tamper);
  assert.equal(result.code, 1); assert.equal(result.stdout, ""); const error = JSON.parse(result.stderr); assert.equal(error.code, "memory.mutation_evidence_failed"); assert.equal(error.mutationId, "leak-complete"); assert.equal(error.tamper, tamper);
});
