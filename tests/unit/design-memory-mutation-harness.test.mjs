import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const harness = path.join(root, "tests/fixtures/design-memory/memory-store-mutation-harness.mjs");

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
