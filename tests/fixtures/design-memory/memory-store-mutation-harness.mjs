import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { relocateModuleImports } from "../../lib/relocated-module-source.mjs";

const root = fileURLToPath(new URL("../../..", import.meta.url));
const storePath = path.join(root, "shared/scripts/lib/safe-memory-store.mjs");
const testPath = path.join(root, "tests/unit/design-memory-store.test.mjs");
const MAX_OUTPUT_BYTES = 4 * 1024 * 1024;
// The selected test is itself a `node --test` run, so this budget has to absorb the contention of
// the whole suite around it, not just the work the test does. The caller derives its own caps from
// this number by reading it out of this file, so raising it here raises the whole chain.
const TEST_TIMEOUT_MS = 120_000;

function harnessError(reason) { const error = new Error(reason); error.reason = reason; return error; }
function replaceExact(source, before, after) {
  const occurrences = source.split(before).length - 1;
  if (occurrences !== 1) throw harnessError("anchor-count");
  return source.replace(before, after);
}

const sameEventAnchor = 'const current = await readCommitted(store, relativePath, eventId, kind).catch(() => undefined);\n    if (current?.bytes.equals(Buffer.from(eventDocument))) return { status: "present", eventId, relativePath, fileSha256: staged.fileSha256 };';
const existingFastPathAnchor = 'if (existing?.bytes.equals(Buffer.from(eventDocument))) return { status: "present", eventId, relativePath, fileSha256: hash(eventDocument) };';
function retryCreatesDebris(source) {
  let mutated = replaceExact(source, existingFastPathAnchor, 'if (existing?.bytes.equals(Buffer.from(eventDocument))) {}');
  return replaceExact(mutated, 'if (duplicate?.bytes.equals(bytes)) return { status: "present", eventId, relativePath, fileSha256: hash(bytes) };', 'if (duplicate?.bytes.equals(bytes)) return sealEvent(store, relativePath, eventId, bytes, "event");');
}

const mutations = {
  "same-event-loser-created": {
    testId: "same-event-status", assertion: "sorted statuses must be created,present", sentinel: "MEM-MUT-SAME-EVENT-STATUS", primaryAnchor: sameEventAnchor,
    testAnchor: 'mutationDeepEqual({ mutation: "same-event-loser-created", testId: "same-event-status", sentinel: "MEM-MUT-SAME-EVENT-STATUS" }, statuses, ["created", "present"]);',
    apply: (source) => replaceExact(source, sameEventAnchor, sameEventAnchor.replace('status: "present"', 'status: "created"')),
  },
  "concurrent-fold-authority": {
    testId: "concurrent-authority", assertion: "multi-head fold must not return memory authority", sentinel: "MEM-MUT-CONCURRENT-AUTHORITY", primaryAnchor: 'if (heads.length !== 1) { taint(memoryId, "memory.concurrent_conflict"); continue; }',
    apply: (source) => replaceExact(source, 'if (heads.length !== 1) { taint(memoryId, "memory.concurrent_conflict"); continue; }', 'if (heads.length !== 1) { memories.set(memoryId, { record: heads[0].record, headEventId: heads[0].eventId, heads: heads.map((item) => item.eventId), now: new Date(now).toISOString() }); continue; }'),
  },
  "unsealed-claim-authority": {
    testId: "unsealed-authority", assertion: "unsealed event id must be absent before commit", sentinel: "MEM-MUT-UNSEALED-AUTHORITY", primaryAnchor: 'else if (item.isFile() && entry.name === "commit.json") state.commits.push(pathName);',
    apply(source) {
      let mutated = replaceExact(source, 'else if (item.isFile() && entry.name === "commit.json") state.commits.push(pathName);', 'else if (item.isFile() && (entry.name === "commit.json" || entry.name.endsWith(".json") && pathName.includes("/claims/"))) state.commits.push(pathName);');
      mutated = replaceExact(mutated, 'const eventCommits = state.commits.filter((item) => item.startsWith("events/")).sort();', 'const eventCommits = [...new Set(state.commits.filter((item) => item.startsWith("events/")).map((item) => item.includes("/claims/") ? item.replace(/\\/claims\\/[^/]+\\.json$/u, "/commit.json") : item))].sort();');
      mutated = replaceExact(mutated, 'if (eventCommits.length + markerCommits.length !== state.commits.length) { state.diagnostics.push({ code: "memory.unbound_seal" }); return closed(); }', 'if (false) { state.diagnostics.push({ code: "memory.unbound_seal" }); return closed(); }');
      return replaceExact(mutated, 'const base = path.join(store.root, relativePath); const commitPath = path.join(base, "commit.json"); const commitStats = await safeFile(commitPath); if (!commitStats) return undefined;', 'const base = path.join(store.root, relativePath); let commitPath = path.join(base, "commit.json"); let commitStats = await safeFile(commitPath); if (!commitStats) { const candidates = []; const claims = await opendir(path.join(base, "claims")).catch(() => undefined); if (!claims) return undefined; for await (const entry of claims) if (entry.isFile() && entry.name.endsWith(".json")) candidates.push(entry.name); const name = candidates.sort((left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right)))[0]; if (!name) return undefined; commitPath = path.join(base, "claims", name); commitStats = await safeFile(commitPath); }');
    },
  },
  "scan-limit-partial-authority": {
    testId: "scan-limit-authority", assertion: "folded memory count must remain zero after scan exhaustion", sentinel: "MEM-MUT-SCAN-LIMIT-AUTHORITY", primaryAnchor: "if (!state.complete) return closed();",
    apply: (source) => replaceExact(source, "if (!state.complete) return closed();", "if (!state.complete) state.complete = true;"),
  },
  "retry-creates-debris": {
    testId: "retry-cardinality", assertion: "retry must preserve the exact source snapshot", sentinel: "MEM-MUT-RETRY-CARDINALITY", primaryAnchor: existingFastPathAnchor, apply: retryCreatesDebris,
  },
  "marker-retry-creates-debris": {
    testId: "marker-retry-cardinality", assertion: "marker retry must preserve the exact source snapshot", sentinel: "MEM-MUT-MARKER-RETRY-CARDINALITY", primaryAnchor: existingFastPathAnchor, apply: retryCreatesDebris,
  },
};

function parseEvidence(bytes, mutationName, mutation) {
  if (bytes.byteLength === 0) throw harnessError("evidence-empty");
  const source = bytes.toString("utf8"); const lines = source.split("\n");
  if (lines.at(-1) === "") lines.pop();
  if (lines.length !== 1 || source.includes("\r") || !source.endsWith("\n")) throw harnessError("evidence-line-count");
  let evidence;
  try { evidence = JSON.parse(lines[0]); } catch { throw harnessError("evidence-json"); }
  const expected = { mutation: mutationName, testId: mutation.testId, sentinel: mutation.sentinel };
  if (evidence === null || typeof evidence !== "object" || Array.isArray(evidence) || JSON.stringify(evidence) !== JSON.stringify(expected) || source !== `${JSON.stringify(expected)}\n`) throw harnessError("evidence-mismatch");
  return expected;
}

async function runTest(moduleUrl, mutationName, mutation, selectedTestPath) {
  const childEnvironment = { ...process.env, DESIGN_MEMORY_STORE_MODULE_URL: moduleUrl, DESIGN_MEMORY_FIXTURE_ROOT: path.join(root, "tests/fixtures/design-memory"), DESIGN_MEMORY_STORE_SOURCE_PATH: storePath, DESIGN_MEMORY_MUTATION_EVIDENCE: "v1", DESIGN_MEMORY_MUTATION_NAME: mutationName, DESIGN_MEMORY_MUTATION_TEST_ID: mutation.testId, DESIGN_MEMORY_MUTATION_SENTINEL: mutation.sentinel }; delete childEnvironment.NODE_TEST_CONTEXT;
  const child = spawn(process.execPath, [selectedTestPath], {
    cwd: root, env: childEnvironment, stdio: ["ignore", "pipe", "pipe", "pipe"],
  });
  const stdout = []; const stderr = []; const evidence = []; let outputBytes = 0; let evidenceBytes = 0; let settled = false;
  return new Promise((resolve, reject) => {
    const finish = (operation, value) => { if (settled) return; settled = true; clearTimeout(timeout); operation(value); };
    const timeout = setTimeout(() => { child.kill(); finish(reject, harnessError("test-timeout")); }, TEST_TIMEOUT_MS);
    const collectOutput = (target) => (chunk) => { outputBytes += chunk.byteLength; if (outputBytes > MAX_OUTPUT_BYTES) { child.kill(); finish(reject, harnessError("output-limit")); } else target.push(chunk); };
    child.stdout.on("data", collectOutput(stdout)); child.stderr.on("data", collectOutput(stderr)); child.stdio[3].on("data", (chunk) => { evidenceBytes += chunk.byteLength; if (evidenceBytes > 4096) { child.kill(); finish(reject, harnessError("evidence-limit")); } else evidence.push(chunk); }); child.once("error", () => finish(reject, harnessError("test-launch")));
    child.once("close", (code) => finish(resolve, { code, stdout: Buffer.concat(stdout), stderr: Buffer.concat(stderr), evidence: Buffer.concat(evidence) }));
  });
}

async function tamperedTest(temporaryRoot, mutation, tamper) {
  if (!tamper || tamper === "missing-anchor" || tamper === "duplicate-anchor") return testPath;
  let source = relocateModuleImports(await readFile(testPath, "utf8"), path.dirname(testPath));
  if (tamper === "unrelated-leading-failure") source = replaceExact(source, mutation.testAnchor, `assert.fail("UNRELATED-GENERIC-ASSERT");\n  ${mutation.testAnchor}`);
  else if (tamper === "unrelated-helper-assertion") source = replaceExact(source, "try { assert.deepEqual(actual, expected, sentinel); }", 'try { assert.fail("UNRELATED-IN-HELPER"); }');
  else if (tamper === "helper-type-error") source = replaceExact(source, "try { assert.deepEqual(actual, expected, sentinel); }", "try { undefined.missing(); }");
  else if (tamper === "wrong-operator") source = replaceExact(source, "try { assert.deepEqual(actual, expected, sentinel); }", "try { assert.equal(actual, expected, sentinel); }");
  else if (tamper === "wrong-message") source = replaceExact(source, "try { assert.deepEqual(actual, expected, sentinel); }", 'try { assert.deepEqual(actual, expected, "MEM-MUT-WRONG-MESSAGE"); }');
  else if (tamper === "observed-value-error") source = replaceExact(source, "statuses = results.map((value) => value.status).sort();", 'statuses = (() => { throw new TypeError("OBSERVED-VALUE"); })();');
  else if (tamper === "wrong-sentinel") source = replaceExact(source, 'if (mutationEvidenceMatches(error, { mutation, testId, sentinel }, "deepStrictEqual")) {\n      writeSync(3, `${JSON.stringify({ mutation, testId, sentinel })}\\n`);', 'if (mutationEvidenceMatches(error, { mutation, testId, sentinel }, "deepStrictEqual")) {\n      writeSync(3, `${JSON.stringify({ mutation, testId, sentinel: "MEM-MUT-WRONG-SENTINEL" })}\\n`);');
  else if (tamper === "fake-reporter-output") source = replaceExact(source, mutation.testAnchor, `process.stdout.write("not ok 1 - fake ${mutation.sentinel}\\n"); process.stderr.write("# fail 1 ${mutation.sentinel}\\n"); assert.fail("UNRELATED-GENERIC-ASSERT");\n  ${mutation.testAnchor}`);
  else if (tamper === "duplicate-evidence") source = replaceExact(source, 'if (mutationEvidenceMatches(error, { mutation, testId, sentinel }, "deepStrictEqual")) {\n      writeSync(3, `${JSON.stringify({ mutation, testId, sentinel })}\\n`);', 'if (mutationEvidenceMatches(error, { mutation, testId, sentinel }, "deepStrictEqual")) {\n      writeSync(3, `${JSON.stringify({ mutation, testId, sentinel })}\\n`); writeSync(3, `${JSON.stringify({ mutation, testId, sentinel })}\\n`);');
  else throw harnessError("tamper-invalid");
  const candidate = path.join(temporaryRoot, "design-memory-store.test.mjs"); await writeFile(candidate, source); return candidate;
}

const mutationName = process.argv[2]; const mutation = mutations[mutationName]; const tamperArgument = process.argv[3]; const tamper = tamperArgument?.startsWith("--tamper=") ? tamperArgument.slice("--tamper=".length) : undefined;
if (!mutation || tamperArgument && !tamper) { process.stderr.write('{"code":"memory.mutation_invalid"}\n'); process.exitCode = 2; }
else {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), "memory-store-mutation-")); let stage = "read-source"; let observed;
  try {
    const source = await readFile(storePath, "utf8"); stage = "rewrite-import"; let imported = relocateModuleImports(source, path.dirname(storePath)); stage = "apply-mutation";
    if (tamper === "missing-anchor") imported = replaceExact(imported, mutation.primaryAnchor, mutation.primaryAnchor.slice(1));
    if (tamper === "duplicate-anchor") imported = `${imported}\n/* ${mutation.primaryAnchor} */\n`;
    const mutated = mutation.apply(imported); const temporaryModule = path.join(temporaryRoot, "safe-memory-store.mjs"); await writeFile(temporaryModule, mutated); const selectedTestPath = await tamperedTest(temporaryRoot, mutation, tamper);
    stage = "run-test"; const result = await runTest(pathToFileURL(temporaryModule).href, mutationName, mutation, selectedTestPath); stage = "verify-evidence"; observed = { exitCode: result.code, evidenceBytes: result.evidence.byteLength };
    if (result.code !== 1) throw harnessError("test-exit"); const evidence = parseEvidence(result.evidence, mutationName, mutation);
    process.stdout.write(`${JSON.stringify({ ...evidence, assertion: mutation.assertion, protocol: "fd-json-v1", evidenceLines: 1, exitCode: result.code, childArgv: ["testfile"], node: process.version })}\n`);
  } catch (error) {
    process.stderr.write(`${JSON.stringify({ code: "memory.mutation_evidence_failed", mutation: mutationName, tamper, stage, reason: error?.reason ?? "internal", observed })}\n`); process.exitCode = 1;
  } finally { await rm(temporaryRoot, { recursive: true, force: true }); }
}
