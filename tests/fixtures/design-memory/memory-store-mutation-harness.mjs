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

function replaceExact(source, before, after) {
  const first = source.indexOf(before);
  if (first < 0 || source.indexOf(before, first + before.length) >= 0) throw new Error("mutation target mismatch");
  return `${source.slice(0, first)}${after}${source.slice(first + before.length)}`;
}

function retryCreatesDebris(source) {
  let mutated = replaceExact(
    source,
    'if (existing?.bytes.equals(Buffer.from(eventDocument))) return { status: "present", eventId, relativePath, fileSha256: hash(eventDocument) };',
    'if (existing?.bytes.equals(Buffer.from(eventDocument))) {}',
  );
  return replaceExact(
    mutated,
    'if (duplicate?.bytes.equals(bytes)) return { status: "present", eventId, relativePath, fileSha256: hash(bytes) };',
    'if (duplicate?.bytes.equals(bytes)) return sealEvent(store, relativePath, eventId, bytes, "event");',
  );
}

const mutations = {
  "same-event-loser-created": {
    testName: "multiprocess same-event append commits one logical event with created and present statuses",
    assertion: "sorted statuses must be created,present",
    needle: "Expected values to be strictly deep-equal",
    apply(source) {
      const mutated = source.replaceAll('status: "present"', 'status: "created"');
      if (mutated === source) throw new Error("mutation target mismatch");
      return mutated;
    },
  },
  "concurrent-fold-authority": {
    testName: "concurrent transitions and resolutions remain physical conflicts until one current-head resolution",
    assertion: "multi-head fold must not return memory authority",
    needle: "true !== false",
    apply(source) {
      return replaceExact(
        source,
        'if (heads.length !== 1) { taint(memoryId, "memory.concurrent_conflict"); continue; }',
        'if (heads.length !== 1) { memories.set(memoryId, { record: heads[0].record, headEventId: heads[0].eventId, heads: heads.map((item) => item.eventId), now: new Date(now).toISOString() }); continue; }',
      );
    },
  },
  "unsealed-claim-authority": {
    testName: "unsealed failpoint states stay non-authoritative and canonical retry prevents approved resurrection",
    assertion: "unsealed event id must be absent before commit",
    needle: "true !== false",
    apply(source) {
      let mutated = replaceExact(
        source,
        'else if (item.isFile() && entry.name === "commit.json") state.commits.push(pathName);',
        'else if (item.isFile() && (entry.name === "commit.json" || entry.name.endsWith(".json") && pathName.includes("/claims/"))) state.commits.push(pathName);',
      );
      mutated = replaceExact(
        mutated,
        'const eventCommits = state.commits.filter((item) => item.startsWith("events/")).sort();',
        'const eventCommits = [...new Set(state.commits.filter((item) => item.startsWith("events/")).map((item) => item.includes("/claims/") ? item.replace(/\\/claims\\/[^/]+\\.json$/u, "/commit.json") : item))].sort();',
      );
      mutated = replaceExact(
        mutated,
        'if (eventCommits.length + markerCommits.length !== state.commits.length) { state.diagnostics.push({ code: "memory.unbound_seal" }); return closed(); }',
        'if (false) { state.diagnostics.push({ code: "memory.unbound_seal" }); return closed(); }',
      );
      return replaceExact(
        mutated,
        'const base = path.join(store.root, relativePath); const commitPath = path.join(base, "commit.json"); const commitStats = await safeFile(commitPath); if (!commitStats) return undefined;',
        'const base = path.join(store.root, relativePath); let commitPath = path.join(base, "commit.json"); let commitStats = await safeFile(commitPath); if (!commitStats) { const candidates = []; const claims = await opendir(path.join(base, "claims")).catch(() => undefined); if (!claims) return undefined; for await (const entry of claims) if (entry.isFile() && entry.name.endsWith(".json")) candidates.push(entry.name); const name = candidates.sort((left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right)))[0]; if (!name) return undefined; commitPath = path.join(base, "claims", name); commitStats = await safeFile(commitPath); }',
      );
    },
  },
  "scan-limit-partial-authority": {
    testName: "the 10001st source-tree entry cannot hide an approval-invalidating event",
    assertion: "folded memory count must remain zero after scan exhaustion",
    needle: "1 !== 0",
    apply(source) { return replaceExact(source, "if (!state.complete) return closed();", "if (!state.complete) state.complete = true;"); },
  },
  "retry-creates-debris": {
    testName: "sequential event and quarantine retry cardinality does not grow source files",
    assertion: "retry must preserve the exact source snapshot",
    needle: "Expected values to be strictly deep-equal",
    apply: retryCreatesDebris,
  },
  "marker-retry-creates-debris": {
    testName: "unsealed quarantine debris stays non-authoritative and canonical retry does not grow source files",
    assertion: "marker retry must preserve the exact source snapshot",
    needle: "Expected values to be strictly deep-equal",
    apply: retryCreatesDebris,
  },
};

async function runTest(moduleUrl, testName) {
  const child = spawn(process.execPath, ["--test", `--test-name-pattern=^${testName}$`, testPath], {
    cwd: root,
    env: { ...process.env, DESIGN_MEMORY_STORE_MODULE_URL: moduleUrl },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const chunks = []; let byteLength = 0; let settled = false;
  return new Promise((resolve, reject) => {
    const finish = (operation, value) => { if (settled) return; settled = true; clearTimeout(timeout); operation(value); };
    const timeout = setTimeout(() => { child.kill(); finish(reject, new Error("mutation test timeout")); }, 45_000);
    const collect = (chunk) => { byteLength += chunk.byteLength; if (byteLength > MAX_OUTPUT_BYTES) { child.kill(); finish(reject, new Error("mutation output exceeded limit")); } else chunks.push(chunk); };
    child.stdout.on("data", collect); child.stderr.on("data", collect); child.once("error", () => finish(reject, new Error("mutation test failed to launch")));
    child.once("close", (code) => finish(resolve, { code, output: Buffer.concat(chunks).toString("utf8") }));
  });
}

const mutationName = process.argv[2];
const mutation = mutations[mutationName];
if (!mutation) {
  process.stderr.write('{"code":"memory.mutation_invalid"}\n');
  process.exitCode = 2;
} else {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), "memory-store-mutation-"));
  let stage = "read-source"; let observed;
  try {
    const source = await readFile(storePath, "utf8");
    stage = "rewrite-import";
    const imported = replaceExact(source, '"../validate-design-memory.mjs"', JSON.stringify(validatorUrl));
    stage = "apply-mutation";
    const mutated = mutation.apply(imported); const temporaryModule = path.join(temporaryRoot, "safe-memory-store.mjs"); await writeFile(temporaryModule, mutated);
    stage = "run-test";
    const result = await runTest(pathToFileURL(temporaryModule).href, mutation.testName);
    stage = "verify-evidence";
    const count = (label) => Number(result.output.match(new RegExp(`ℹ ${label} (\\d+)`, "u"))?.[1] ?? -1);
    const evidence = { mutation: mutationName, test: mutation.testName, assertion: mutation.assertion, pass: count("pass"), fail: count("fail"), skipped: count("skipped"), exitCode: result.code };
    observed = { pass: evidence.pass, fail: evidence.fail, skipped: evidence.skipped, exitCode: evidence.exitCode, assertionMatched: result.output.includes(mutation.needle), comparison: ["true !== false", "false !== true", "1 !== 0", "0 !== 1"].find((value) => result.output.includes(value)) ?? "other", failureKind: ["AssertionError", "SyntaxError", "TypeError", "ReferenceError", "memory.scan_incomplete"].find((value) => result.output.includes(value)) ?? "other" };
    if (result.code !== 1 || evidence.pass !== 0 || evidence.fail !== 1 || evidence.skipped !== 0 || !observed.assertionMatched) throw new Error("mutation did not fail as expected");
    process.stdout.write(`${JSON.stringify(evidence)}\n`);
  } catch {
    process.stderr.write(`${JSON.stringify({ code: "memory.mutation_evidence_failed", mutation: mutationName, stage, observed })}\n`);
    process.exitCode = 1;
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}
