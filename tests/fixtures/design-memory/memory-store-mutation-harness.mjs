import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("../../..", import.meta.url));
const storePath = path.join(root, "shared/scripts/lib/safe-memory-store.mjs");
const validatorUrl = pathToFileURL(path.join(root, "shared/scripts/validate-design-memory.mjs")).href;
const testPath = path.join(root, "tests/unit/design-memory-store.test.mjs");
const MAX_OUTPUT_BYTES = 4 * 1024 * 1024;

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
    testName: "multiprocess same-event append commits one logical event with created and present statuses", assertion: "sorted statuses must be created,present", sentinel: "MEM-MUT-SAME-EVENT-STATUS", primaryAnchor: sameEventAnchor,
    testAnchor: 'assert.deepEqual(results.map((_, index) => parsed[index].status).sort(), ["created", "present"], "MEM-MUT-SAME-EVENT-STATUS");',
    apply: (source) => replaceExact(source, sameEventAnchor, sameEventAnchor.replace('status: "present"', 'status: "created"')),
  },
  "concurrent-fold-authority": {
    testName: "concurrent transitions and resolutions remain physical conflicts until one current-head resolution", assertion: "multi-head fold must not return memory authority", sentinel: "MEM-MUT-CONCURRENT-AUTHORITY", primaryAnchor: 'if (heads.length !== 1) { taint(memoryId, "memory.concurrent_conflict"); continue; }',
    apply: (source) => replaceExact(source, 'if (heads.length !== 1) { taint(memoryId, "memory.concurrent_conflict"); continue; }', 'if (heads.length !== 1) { memories.set(memoryId, { record: heads[0].record, headEventId: heads[0].eventId, heads: heads.map((item) => item.eventId), now: new Date(now).toISOString() }); continue; }'),
  },
  "unsealed-claim-authority": {
    testName: "unsealed failpoint states stay non-authoritative and canonical retry prevents approved resurrection", assertion: "unsealed event id must be absent before commit", sentinel: "MEM-MUT-UNSEALED-AUTHORITY", primaryAnchor: 'else if (item.isFile() && entry.name === "commit.json") state.commits.push(pathName);',
    apply(source) {
      let mutated = replaceExact(source, 'else if (item.isFile() && entry.name === "commit.json") state.commits.push(pathName);', 'else if (item.isFile() && (entry.name === "commit.json" || entry.name.endsWith(".json") && pathName.includes("/claims/"))) state.commits.push(pathName);');
      mutated = replaceExact(mutated, 'const eventCommits = state.commits.filter((item) => item.startsWith("events/")).sort();', 'const eventCommits = [...new Set(state.commits.filter((item) => item.startsWith("events/")).map((item) => item.includes("/claims/") ? item.replace(/\\/claims\\/[^/]+\\.json$/u, "/commit.json") : item))].sort();');
      mutated = replaceExact(mutated, 'if (eventCommits.length + markerCommits.length !== state.commits.length) { state.diagnostics.push({ code: "memory.unbound_seal" }); return closed(); }', 'if (false) { state.diagnostics.push({ code: "memory.unbound_seal" }); return closed(); }');
      return replaceExact(mutated, 'const base = path.join(store.root, relativePath); const commitPath = path.join(base, "commit.json"); const commitStats = await safeFile(commitPath); if (!commitStats) return undefined;', 'const base = path.join(store.root, relativePath); let commitPath = path.join(base, "commit.json"); let commitStats = await safeFile(commitPath); if (!commitStats) { const candidates = []; const claims = await opendir(path.join(base, "claims")).catch(() => undefined); if (!claims) return undefined; for await (const entry of claims) if (entry.isFile() && entry.name.endsWith(".json")) candidates.push(entry.name); const name = candidates.sort((left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right)))[0]; if (!name) return undefined; commitPath = path.join(base, "claims", name); commitStats = await safeFile(commitPath); }');
    },
  },
  "scan-limit-partial-authority": {
    testName: "the 10001st source-tree entry cannot hide an approval-invalidating event", assertion: "folded memory count must remain zero after scan exhaustion", sentinel: "MEM-MUT-SCAN-LIMIT-AUTHORITY", primaryAnchor: "if (!state.complete) return closed();",
    apply: (source) => replaceExact(source, "if (!state.complete) return closed();", "if (!state.complete) state.complete = true;"),
  },
  "retry-creates-debris": {
    testName: "sequential event and quarantine retry cardinality does not grow source files", assertion: "retry must preserve the exact source snapshot", sentinel: "MEM-MUT-RETRY-CARDINALITY", primaryAnchor: existingFastPathAnchor, apply: retryCreatesDebris,
  },
  "marker-retry-creates-debris": {
    testName: "unsealed quarantine debris stays non-authoritative and canonical retry does not grow source files", assertion: "marker retry must preserve the exact source snapshot", sentinel: "MEM-MUT-MARKER-RETRY-CARDINALITY", primaryAnchor: existingFastPathAnchor, apply: retryCreatesDebris,
  },
};

function parseTap(output, testName, sentinel) {
  if (!output.startsWith("TAP version 13\n")) throw harnessError("tap-protocol");
  const results = [...output.matchAll(/^(not ok|ok) \d+ - (.+)$/gmu)].map((match) => ({ status: match[1], name: match[2].replace(/ # (?:SKIP|TODO).*$/u, ""), index: match.index }));
  const selected = results.filter((item) => item.name === testName); const failures = results.filter((item) => item.status === "not ok");
  if (selected.length !== 1 || selected[0].status !== "not ok" || failures.length !== 1) throw harnessError("tap-selection");
  const next = results.find((item) => item.index > selected[0].index); const block = output.slice(selected[0].index, next?.index ?? output.length); const sentinelCount = block.split(sentinel).length - 1;
  if (sentinelCount !== 1 || output.split(sentinel).length - 1 !== 1) throw harnessError("tap-sentinel");
  return { selectedNotOk: 1, otherNotOk: 0, sentinelCount };
}

async function runTest(moduleUrl, testName, selectedTestPath) {
  const childEnvironment = { ...process.env, DESIGN_MEMORY_STORE_MODULE_URL: moduleUrl, DESIGN_MEMORY_FIXTURE_ROOT: path.join(root, "tests/fixtures/design-memory") }; delete childEnvironment.NODE_TEST_CONTEXT;
  const child = spawn(process.execPath, ["--test", "--test-reporter=tap", `--test-name-pattern=^${testName}$`, selectedTestPath], {
    cwd: root, env: childEnvironment, stdio: ["ignore", "pipe", "pipe"],
  });
  const chunks = []; let byteLength = 0; let settled = false;
  return new Promise((resolve, reject) => {
    const finish = (operation, value) => { if (settled) return; settled = true; clearTimeout(timeout); operation(value); };
    const timeout = setTimeout(() => { child.kill(); finish(reject, harnessError("test-timeout")); }, 45_000);
    const collect = (chunk) => { byteLength += chunk.byteLength; if (byteLength > MAX_OUTPUT_BYTES) { child.kill(); finish(reject, harnessError("output-limit")); } else chunks.push(chunk); };
    child.stdout.on("data", collect); child.stderr.on("data", collect); child.once("error", () => finish(reject, harnessError("test-launch")));
    child.once("close", (code) => finish(resolve, { code, output: Buffer.concat(chunks).toString("utf8") }));
  });
}

async function tamperedTest(temporaryRoot, mutation, tamper) {
  if (!tamper || tamper === "missing-anchor" || tamper === "duplicate-anchor") return testPath;
  let source = await readFile(testPath, "utf8"); source = replaceExact(source, '"../../shared/scripts/validate-design-memory.mjs"', JSON.stringify(validatorUrl));
  if (tamper === "unrelated-leading-failure") source = replaceExact(source, mutation.testAnchor, `assert.fail("UNRELATED-GENERIC-ASSERT");\n  ${mutation.testAnchor}`);
  else if (tamper === "wrong-sentinel") source = replaceExact(source, mutation.sentinel, "MEM-MUT-WRONG-SENTINEL");
  else throw harnessError("tamper-invalid");
  const candidate = path.join(temporaryRoot, "design-memory-store.test.mjs"); await writeFile(candidate, source); return candidate;
}

const mutationName = process.argv[2]; const mutation = mutations[mutationName]; const tamperArgument = process.argv[3]; const tamper = tamperArgument?.startsWith("--tamper=") ? tamperArgument.slice("--tamper=".length) : undefined;
if (!mutation || tamperArgument && !tamper) { process.stderr.write('{"code":"memory.mutation_invalid"}\n'); process.exitCode = 2; }
else {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), "memory-store-mutation-")); let stage = "read-source"; let observed;
  try {
    const source = await readFile(storePath, "utf8"); stage = "rewrite-import"; let imported = replaceExact(source, '"../validate-design-memory.mjs"', JSON.stringify(validatorUrl)); stage = "apply-mutation";
    if (tamper === "missing-anchor") imported = replaceExact(imported, mutation.primaryAnchor, mutation.primaryAnchor.slice(1));
    if (tamper === "duplicate-anchor") imported = `${imported}\n/* ${mutation.primaryAnchor} */\n`;
    const mutated = mutation.apply(imported); const temporaryModule = path.join(temporaryRoot, "safe-memory-store.mjs"); await writeFile(temporaryModule, mutated); const selectedTestPath = await tamperedTest(temporaryRoot, mutation, tamper);
    stage = "run-test"; const result = await runTest(pathToFileURL(temporaryModule).href, mutation.testName, selectedTestPath); stage = "verify-evidence"; observed = { exitCode: result.code, tapHeader: result.output.startsWith("TAP version 13\n"), selectedName: result.output.includes(mutation.testName) };
    if (result.code !== 1) throw harnessError("tap-exit"); const tap = parseTap(result.output, mutation.testName, mutation.sentinel);
    process.stdout.write(`${JSON.stringify({ mutation: mutationName, test: mutation.testName, assertion: mutation.assertion, sentinel: mutation.sentinel, reporter: "tap", ...tap, exitCode: result.code, node: process.version })}\n`);
  } catch (error) {
    process.stderr.write(`${JSON.stringify({ code: "memory.mutation_evidence_failed", mutation: mutationName, tamper, stage, reason: error?.reason ?? "internal", observed })}\n`); process.exitCode = 1;
  } finally { await rm(temporaryRoot, { recursive: true, force: true }); }
}
