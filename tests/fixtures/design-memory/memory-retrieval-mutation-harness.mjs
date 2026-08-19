import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { relocateModuleImports } from "../../lib/relocated-module-source.mjs";

const root = fileURLToPath(new URL("../../..", import.meta.url));
const retrievalPath = path.join(root, "shared/scripts/retrieve-design-memory.mjs");
const evaluatorPath = path.join(root, "shared/scripts/lib/memory-schema-evaluator.mjs");
const testPath = path.join(root, "tests/unit/design-memory-retrieval.test.mjs");
const hostilePath = path.join(root, "tests/fixtures/design-memory/process-tree-hostile.mjs");
const MAX_EVIDENCE_BYTES = 4096;
const MAX_OUTPUT_BYTES = 64 * 1024;
const TEST_TIMEOUT_MS = 15_000;
const CLOSE_TIMEOUT_MS = 2_000;

function harnessError(reason) { const error = new Error(reason); error.reason = reason; return error; }
function replaceExact(source, before, after) { const count = source.split(before).length - 1; if (count !== 1) throw harnessError("anchor-count"); return source.replace(before, after); }

function spawnIsolatedTest(args, options) {
  const blocked = ["NODE_OPTIONS", "NODE_PATH", "NODE_INSPECT_RESUME_ON_START", "NODE_V8_COVERAGE", "NODE_TEST_CONTEXT"];
  const saved = new Map();
  for (const key of blocked) if (Object.hasOwn(process.env, key)) { saved.set(key, process.env[key]); delete process.env[key]; }
  try { return spawn(process.execPath, args, options); }
  finally { for (const [key, value] of saved) process.env[key] = value; }
}

function terminateProcessTree(child) {
  if (!child.pid) return;
  // This mutation harness is test-only. taskkill is the Windows system tree-kill
  // fallback; POSIX uses an isolated process group below.
  if (process.platform === "win32") spawnSync("taskkill.exe", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
  else {
    try { process.kill(-child.pid, "SIGKILL"); } catch (error) { if (error?.code !== "ESRCH") child.kill("SIGKILL"); }
  }
  child.kill("SIGKILL");
}

const mutations = {
  "leak-complete": { testId: "reservation-leak-complete", sentinel: "MEM-RET-MUT-LEAK-COMPLETE", expected: true, actual: false, target: "retrieval", selectedTest: "fixed reservation slot leaks consume quota without making the derived census incomplete", anchor: 'for (const [slot, item] of global.entries) if (item.invalid || !matchedGlobals.has(slot)) warnings.push(warning("memory.derived_reservation_invalid", { relativePath: item.relativePath }));', replacement: 'for (const [slot, item] of global.entries) if (item.invalid || !matchedGlobals.has(slot)) { complete = false; warnings.push(warning("memory.derived_reservation_invalid", { relativePath: item.relativePath })); }' },
  "local-path": { testId: "duplicate-global-local-path", sentinel: "MEM-RET-MUT-LOCAL-PATH", expected: true, actual: false, target: "retrieval", selectedTest: "one global reservation grants only the bytewise-lowest exact local path authority", anchor: 'if ([...paired.values()].some((pair) => pair.globalSlot === local.value.globalSlot)) { warnings.push(warning("memory.derived_reservation_invalid", { relativePath: local.relativePath })); continue; }', replacement: "if (false) { warnings.push(warning(\"memory.derived_reservation_invalid\", { relativePath: local.relativePath })); continue; }" },
  "markdown-loader": { testId: "resealed-markdown-loader", sentinel: "MEM-RET-MUT-MARKDOWN-LOADER", expected: "corrupt", actual: "ready", target: "retrieval", selectedTest: "view and log loaders reach the Markdown validator for six consistently resealed malformed forms", anchor: ": validMarkdownBytes(bytesResult.bytes) ? utf8.decode(bytesResult.bytes) : null;", replacement: ": utf8.decode(bytesResult.bytes);" },
  "receipt-physical-count": { testId: "receipt-physical-siblings", sentinel: "MEM-RET-MUT-RECEIPT-COUNT", expected: 7, actual: 5, target: "retrieval", selectedTest: "receipt history retains distinct exact pairs while corrupt siblings do not replace valid evidence", anchor: "if (!entry.relativePath.startsWith(candidatePrefix)) return false;", replacement: "if (!entry.relativePath.startsWith(candidatePrefix) || entry.type !== \"file\") return false;" },
  "schema-code-points": { testId: "emoji-code-point-limit", sentinel: "MEM-RET-MUT-SCHEMA-CODE-POINTS", expected: true, actual: false, target: "evaluator", selectedTest: "runtime validators execute packaged schemas with canonical Unicode and semantic array parity", anchor: "if (typeof value === \"string\") return Array.from(value).length >= (schema.minLength ?? 0) && Array.from(value).length <= (schema.maxLength ?? Number.POSITIVE_INFINITY) && (!schema.pattern || new RegExp(schema.pattern, \"u\").test(value));", replacement: "if (typeof value === \"string\") return value.length >= (schema.minLength ?? 0) && value.length <= (schema.maxLength ?? Number.POSITIVE_INFINITY) && (!schema.pattern || new RegExp(schema.pattern, \"u\").test(value));" },
  "receipt-observation-semantic": { testId: "observation-status-digest-matrix", sentinel: "MEM-RET-MUT-OBSERVATION-SEMANTIC", expected: false, actual: true, target: "evaluator", selectedTest: "receipt observation status and digest matrix is identical for evaluator publisher and loader", anchor: 'status === "current" && observedSha256 === expectedSha256', replacement: 'status === "current"' },
  "result-preflight": { testId: "result-exact-limit", sentinel: "MEM-RET-MUT-RESULT-PREFLIGHT", expected: 65536, actual: 180, target: "retrieval", selectedTest: "a canonical result at exactly 64 KiB publishes a truthful receipt and limit plus one publishes none", anchor: "if (canonicalBytes(preview).byteLength > RESULT_MAX_BYTES)", replacement: "if (true)" },
};

function parseEvidence(bytes, mutation) {
  if (bytes.byteLength === 0) throw harnessError("evidence-empty");
  if (bytes.byteLength > MAX_EVIDENCE_BYTES) throw harnessError("evidence-oversize");
  const source = bytes.toString("utf8"); const lines = source.split("\n"); if (lines.at(-1) === "") lines.pop();
  if (lines.length !== 1 || source.includes("\r") || !source.endsWith("\n")) throw harnessError("evidence-line-count");
  let evidence; try { evidence = JSON.parse(lines[0]); } catch { throw harnessError("evidence-json"); }
  const expected = { mutationId: mutation.id, testId: mutation.testId, sentinel: mutation.sentinel, operator: "strictEqual", expected: mutation.expected, actual: mutation.actual };
  if (!evidence || typeof evidence !== "object" || Array.isArray(evidence) || JSON.stringify(evidence) !== JSON.stringify(expected) || source !== `${JSON.stringify(expected)}\n`) throw harnessError("evidence-mismatch");
  return expected;
}

async function tamperedTest(temporary, mutation, tamper) {
  if (!tamper || ["normal", "unrelated-failure", "wrong-env", "missing-evidence", "missing-anchor", "duplicate-anchor"].includes(tamper)) return testPath;
  let source = await readFile(testPath, "utf8");
  for (const [relative, absolute] of [
    ["../../shared/scripts/validate-design-memory.mjs", path.join(root, "shared/scripts/validate-design-memory.mjs")],
    ["../../shared/scripts/lib/safe-memory-store.mjs", path.join(root, "shared/scripts/lib/safe-memory-store.mjs")],
    ["../../shared/scripts/lib/memory-schema-evaluator.mjs", path.join(root, "shared/scripts/lib/memory-schema-evaluator.mjs")],
    ["../../shared/scripts/retrieve-design-memory.mjs", path.join(root, "shared/scripts/retrieve-design-memory.mjs")],
  ]) source = source.replaceAll(JSON.stringify(relative), JSON.stringify(pathToFileURL(absolute).href));
  const assertion = `mutationEqual({ mutationId: ${JSON.stringify(mutation.id)}, testId: ${JSON.stringify(mutation.testId)}, sentinel: ${JSON.stringify(mutation.sentinel)} }, scan.complete, true);`;
  const assertionCall = 'try { assert.equal(actual, expected, sentinel); }';
  const evidenceWrite = 'writeSync(3, `${JSON.stringify({ mutationId, testId, sentinel, operator: "strictEqual", expected: error.expected, actual: error.actual })}\\n`);';
  const hostileStdio = ["grandchild-timeout", "grandchild-partial-evidence-timeout"].includes(tamper) ? '["ignore", "ignore", "ignore", 3]' : '"ignore"';
  const startHostile = `const hostile = spawn(process.execPath, [${JSON.stringify(hostilePath)}, process.env.DESIGN_MEMORY_RETRIEVAL_HOSTILE_PID_PATH, process.env.DESIGN_MEMORY_RETRIEVAL_HOSTILE_SENTINEL], { stdio: ${hostileStdio} }); hostile.unref(); const hostileDeadline = Date.now() + 5_000; for (;;) { try { await readFile(process.env.DESIGN_MEMORY_RETRIEVAL_HOSTILE_PID_PATH); break; } catch (error) { if (error?.code !== "ENOENT" || Date.now() >= hostileDeadline) throw error; await new Promise((resolve) => setTimeout(resolve, 10)); } }`;
  if (tamper === "unrelated-helper-assertion") source = replaceExact(source, assertionCall, 'try { assert.equal("unrelated-actual", "unrelated-expected", sentinel); }');
  else if (tamper === "helper-type-error") source = replaceExact(source, assertionCall, "try { undefined.missing(); }");
  else if (tamper === "observation-value-error") source = replaceExact(source, assertion, assertion.replace("scan.complete", '(() => { throw new TypeError("OBSERVATION-VALUE"); })()'));
  else if (tamper === "wrong-operator") source = replaceExact(source, assertionCall, "try { assert.deepEqual(actual, expected, sentinel); }");
  else if (tamper === "wrong-message") source = replaceExact(source, assertionCall, 'try { assert.equal(actual, expected, "MEM-RET-MUT-WRONG-MESSAGE"); }');
  else if (tamper === "forged-stdout-stderr") source = replaceExact(source, assertion, `process.stdout.write(${JSON.stringify(`${JSON.stringify({ mutationId: mutation.id, testId: mutation.testId, sentinel: mutation.sentinel, operator: "strictEqual", expected: mutation.expected, actual: mutation.actual })}\n`)}); process.stderr.write(${JSON.stringify(`# ${mutation.sentinel}\n`)}); assert.fail("FORGED-REPORTER");\n    ${assertion}`);
  else if (tamper === "duplicate-evidence") source = replaceExact(source, evidenceWrite, `${evidenceWrite} ${evidenceWrite}`);
  else if (tamper === "oversize-evidence") source = replaceExact(source, evidenceWrite, 'writeSync(3, "x".repeat(4097));');
  else if (tamper === "oversize-stdout-stderr") source = replaceExact(source, assertion, `process.stdout.write("x".repeat(${MAX_OUTPUT_BYTES})); process.stderr.write("y");\n    ${assertion}`);
  else if (tamper === "forged-nan-values") source = replaceExact(source, evidenceWrite, 'writeSync(3, `${JSON.stringify({ mutationId, testId, sentinel, operator: "strictEqual", expected: Number.NaN, actual: null })}\\n`);');
  else if (tamper === "forged-negative-zero-values") source = replaceExact(source, evidenceWrite, 'writeSync(3, `${JSON.stringify({ mutationId, testId, sentinel, operator: "strictEqual", expected: 0, actual: -0 })}\\n`);');
  else if (tamper === "forged-object-values") source = replaceExact(source, evidenceWrite, 'writeSync(3, `${JSON.stringify({ mutationId, testId, sentinel, operator: "strictEqual", expected: { value: true }, actual: { value: false } })}\\n`);');
  else if (tamper === "caller-env-injection") source = replaceExact(source, assertion, `for (const key of ["NODE_OPTIONS", "NODE_PATH", "NODE_INSPECT_RESUME_ON_START", "NODE_V8_COVERAGE", "NODE_TEST_CONTEXT", "DESIGN_CALLER_INJECTION"]) assert.equal(process.env[key], undefined, key);\n    ${assertion}`);
  else if (tamper === "grandchild-output-limit") source = replaceExact(source, assertion, `${startHostile}\n    process.stdout.write("x".repeat(${MAX_OUTPUT_BYTES})); process.stderr.write("y");\n    ${assertion}`);
  else if (tamper === "grandchild-evidence-limit") source = replaceExact(source, assertion, `${startHostile}\n    writeSync(3, "x".repeat(${MAX_EVIDENCE_BYTES + 1}));\n    ${assertion}`);
  else if (tamper === "grandchild-close-missing") source = replaceExact(source, assertion, `${startHostile}\n    process.stdout.write("x".repeat(${MAX_OUTPUT_BYTES})); process.stderr.write("y");\n    ${assertion}`);
  else if (tamper === "grandchild-timeout") source = replaceExact(source, assertion, `${startHostile}\n    await new Promise((resolve) => setTimeout(resolve, 60_000));\n    ${assertion}`);
  else if (tamper === "grandchild-partial-evidence-timeout") source = replaceExact(source, assertion, `${startHostile}\n    writeSync(3, '{"partial":'); await new Promise((resolve) => setTimeout(resolve, 60_000));\n    ${assertion}`);
  else throw harnessError("tamper-invalid");
  const candidate = path.join(temporary, "design-memory-retrieval.test.mjs"); await writeFile(candidate, source); return candidate;
}

async function runTest(moduleUrl, mutation, tamper, selectedTestPath) {
  const env = {};
  for (const key of ["PATH", "TMPDIR", "TEMP", "TMP", "LANG", "LC_ALL", "HOME"]) if (typeof process.env[key] === "string") env[key] = process.env[key];
  Object.assign(env, { DESIGN_MEMORY_RETRIEVAL_MUTATION_EVIDENCE: tamper === "wrong-env" ? "wrong" : "fd-json-v2", DESIGN_MEMORY_RETRIEVAL_MUTATION_ID: mutation.id, DESIGN_MEMORY_RETRIEVAL_MUTATION_TEST_ID: mutation.testId, DESIGN_MEMORY_RETRIEVAL_MUTATION_SENTINEL: mutation.sentinel, DESIGN_MEMORY_RETRIEVAL_SELECTED_TEST: mutation.selectedTest });
  if (tamper?.startsWith("grandchild-")) Object.assign(env, { DESIGN_MEMORY_RETRIEVAL_HOSTILE_PID_PATH: process.env.DESIGN_MEMORY_RETRIEVAL_HOSTILE_PID_PATH, DESIGN_MEMORY_RETRIEVAL_HOSTILE_SENTINEL: process.env.DESIGN_MEMORY_RETRIEVAL_HOSTILE_SENTINEL });
  if (mutation.target === "retrieval") env.DESIGN_MEMORY_RETRIEVAL_MODULE_URL = moduleUrl; else env.DESIGN_MEMORY_SCHEMA_EVALUATOR_MODULE_URL = moduleUrl;
  const child = spawnIsolatedTest([selectedTestPath], { cwd: root, env, detached: process.platform !== "win32", windowsHide: true, stdio: ["ignore", "pipe", "pipe", "pipe"] }); const evidence = []; const stdout = []; const stderr = []; let evidenceLength = 0; let outputLength = 0; let settled = false; let pendingFailure; let closeTimeout;
  return await new Promise((resolve, reject) => {
    const finish = (operation, value) => { if (settled) return; settled = true; clearTimeout(timeout); clearTimeout(closeTimeout); operation(value); };
    const fail = (reason) => {
      if (pendingFailure || settled) return;
      pendingFailure = harnessError(reason); clearTimeout(timeout); terminateProcessTree(child);
      closeTimeout = setTimeout(() => { terminateProcessTree(child); for (const stream of [child.stdout, child.stderr, child.stdio[3]]) stream?.destroy(); finish(reject, pendingFailure); }, CLOSE_TIMEOUT_MS);
    };
    const timeout = setTimeout(() => fail("test-timeout"), ["grandchild-timeout", "grandchild-partial-evidence-timeout"].includes(tamper) ? 5_000 : TEST_TIMEOUT_MS);
    const collectOutput = (target) => (chunk) => { if (pendingFailure) return; outputLength += chunk.byteLength; if (outputLength > MAX_OUTPUT_BYTES) fail("output-limit"); else target.push(chunk); };
    child.stdout.on("data", collectOutput(stdout)); child.stderr.on("data", collectOutput(stderr)); child.stdio[3].on("data", (chunk) => { if (pendingFailure) return; evidenceLength += chunk.byteLength; if (evidenceLength > MAX_EVIDENCE_BYTES) fail("evidence-limit"); else evidence.push(chunk); });
    child.once("error", () => fail("test-launch")); child.once("close", (code) => { if (tamper === "grandchild-close-missing" && pendingFailure) return; pendingFailure ? finish(reject, pendingFailure) : finish(resolve, { code, evidence: Buffer.concat(evidence), output: Buffer.concat([...stdout, ...stderr]).toString("utf8") }); });
  });
}

const mutationId = process.argv[2]; const mutation = mutations[mutationId]; const argument = process.argv[3]; const tamper = argument?.startsWith("--tamper=") ? argument.slice(9) : undefined;
if (!mutation || !tamper) { process.stderr.write('{"code":"memory.mutation_invalid"}\n'); process.exitCode = 2; }
else {
  mutation.id = mutationId; const temporary = await mkdtemp(path.join(tmpdir(), "memory-retrieval-mutation-")); let stage = "read-source";
  try {
    let source = await readFile(mutation.target === "retrieval" ? retrievalPath : evaluatorPath, "utf8"); stage = "apply-mutation";
    if (tamper === "missing-evidence") source = source;
    else {
      if (tamper === "missing-anchor") source = replaceExact(source, mutation.anchor, mutation.anchor.slice(1));
      if (tamper === "duplicate-anchor") source = `${source}\n/* ${mutation.anchor} */\n`;
      source = replaceExact(source, mutation.anchor, mutation.replacement);
    }
    // The retrieval copy runs out of a temp directory, so every relative import it declares has to be
    // re-anchored at the module's real home. The evaluator copy keeps its relative layout instead —
    // it is staged under scripts/lib/ beside a staged memory/schema/, which is what its own relative
    // schema reads resolve against — so it is deliberately left alone here.
    if (mutation.target === "retrieval") source = relocateModuleImports(source, path.dirname(retrievalPath));
    let modulePath = path.join(temporary, `${mutationId}.mjs`);
    if (mutation.target === "evaluator") { modulePath = path.join(temporary, "scripts", "lib", `${mutationId}.mjs`); const schemaDirectory = path.join(temporary, "memory", "schema"); await mkdir(path.dirname(modulePath), { recursive: true }); await mkdir(schemaDirectory, { recursive: true }); for (const name of ["memory-index.schema.json", "memory-receipt.schema.json"]) await writeFile(path.join(schemaDirectory, name), await readFile(path.join(root, "shared", "memory", "schema", name))); }
    await writeFile(modulePath, source);
    if (tamper === "unrelated-failure") { stage = "unrelated"; throw harnessError("unrelated-failure"); }
    const selectedTestPath = await tamperedTest(temporary, mutation, tamper);
    stage = "run-test"; const result = await runTest(pathToFileURL(modulePath).href, mutation, tamper, selectedTestPath); stage = "verify-evidence";
    const evidence = result.evidence;
    if (result.code !== 1) throw harnessError("test-exit"); if (!evidence.byteLength) { const error = harnessError("evidence-empty"); error.output = result.output; throw error; } const verified = parseEvidence(evidence, mutation);
    process.stdout.write(`${JSON.stringify({ ...verified, protocol: "fd-json-v2", exitCode: result.code })}\n`);
  } catch (error) { process.stderr.write(`${JSON.stringify({ code: "memory.mutation_evidence_failed", mutationId, tamper, stage, reason: error?.reason ?? "internal" })}\n`); process.exitCode = 1; }
  finally { await rm(temporary, { recursive: true, force: true }); }
}
