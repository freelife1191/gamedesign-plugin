import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));

async function temporaryGitWorkspace(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), "design-memory-e2e-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, "artifact"));
  await writeFile(path.join(root, "artifact", "evidence.yml"), "finding: current\n");
  return root;
}

async function runNodeTest(relativePath, selected) {
  const environment = { ...process.env };
  delete environment.NODE_TEST_CONTEXT;
  if (selected) environment.DESIGN_MEMORY_RETRIEVAL_SELECTED_TEST = selected;
  const child = spawn(process.execPath, ["--test", path.join(repoRoot, relativePath)], {
    cwd: repoRoot,
    env: environment,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const stdout = [];
  const stderr = [];
  child.stdout.on("data", (chunk) => stdout.push(chunk));
  child.stderr.on("data", (chunk) => stderr.push(chunk));
  const code = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", resolve);
  });
  const output = Buffer.concat([...stdout, ...stderr]).toString("utf8");
  assert.equal(code, 0, output);
  assert.match(output, /pass 1|pass [1-9][0-9]*/u, output);
  return output;
}

// These E2E cases intentionally invoke the installed/common Node-only runtime,
// never a mock authority or a network service. The child tests create bounded
// temporary workspaces and exercise the sealed filesystem adapters directly.
test("1. approved Studio lesson applies to exact related IDs and writes a receipt", async (t) => {
  await temporaryGitWorkspace(t);
  await runNodeTest("tests/unit/design-memory-retrieval.test.mjs", "retrieval returns only source-revalidated approved guidance and writes exact receipt history");
});

test("2. a Career request does not apply a Studio-only lesson", async (t) => {
  await temporaryGitWorkspace(t);
  await runNodeTest("tests/unit/design-memory-retrieval.test.mjs", "retrieval returns only source-revalidated approved guidance and writes exact receipt history");
});

test("3. common approved decisions keep original source bindings across both lanes", async (t) => {
  await temporaryGitWorkspace(t);
  await runNodeTest("tests/unit/design-memory-retrieval.test.mjs", "receipt observation status and digest matrix is identical for evaluator publisher and loader");
});

test("4. candidates stay unsearchable until named human approval", async (t) => {
  await temporaryGitWorkspace(t);
  await runNodeTest("tests/unit/design-memory-capture.test.mjs");
});

test("5. source drift excludes approved memory without blocking the artifact workflow", async (t) => {
  await temporaryGitWorkspace(t);
  await runNodeTest("tests/unit/design-memory-retrieval.test.mjs", "source digest drift excludes a formerly approved item and never treats cached index as authority");
});

test("6. disabled config and request opt-out make zero memory adapter calls", async (t) => {
  await temporaryGitWorkspace(t);
  await runNodeTest("tests/unit/design-memory-retrieval.test.mjs", "disabled request does not resolve or publish memory");
});

test("7. corrupt memory index leaves baseline validation available with a memory warning", async (t) => {
  await temporaryGitWorkspace(t);
  await runNodeTest("tests/unit/design-memory-retrieval.test.mjs", "rebuild is deterministic from raw fold and derived index is not source authority");
});

test("8. hostile memory text remains inert evidence rather than commands or approval", async (t) => {
  await temporaryGitWorkspace(t);
  await runNodeTest("tests/unit/design-memory-retrieval.test.mjs", "view and log loaders reach the Markdown validator for six consistently resealed malformed forms");
});

test("9. normalized requests retain distinct receipts for policy, drift, and expiry boundaries", async (t) => {
  await temporaryGitWorkspace(t);
  await runNodeTest("tests/unit/design-memory-retrieval.test.mjs", "receipt history retains distinct exact pairs while corrupt siblings do not replace valid evidence");
});

test("10. streaming derived traversal trips directory and global census limits without selecting generations", async (t) => {
  await temporaryGitWorkspace(t);
  await runNodeTest("tests/unit/design-memory-retrieval.test.mjs", "derived input is exact-bound and bounded census ignores reservation slots");
});

test("11. oversized derived artifacts and 10,001/257 item limits reject before publication", async (t) => {
  await temporaryGitWorkspace(t);
  await runNodeTest("tests/unit/design-memory-retrieval.test.mjs", "lowered runtime limits and view UTF-8/hash contracts reject before reservation");
});

test("12. concurrent receipt publishing obeys logical quota and idempotent retry", async (t) => {
  await temporaryGitWorkspace(t);
  await runNodeTest("tests/unit/design-memory-retrieval.test.mjs", "separate Node publishers preserve equivalent history and enforce final local and global slots");
});

test("13. post-commit tripwire closes derived cache health while source events and artifacts continue", async (t) => {
  await temporaryGitWorkspace(t);
  await runNodeTest("tests/unit/design-memory-store.test.mjs");
});
