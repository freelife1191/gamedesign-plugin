import { spawn } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("../../..", import.meta.url));
const retrievalPath = path.join(root, "shared/scripts/retrieve-design-memory.mjs");
const evaluatorPath = path.join(root, "shared/scripts/lib/memory-schema-evaluator.mjs");
const testPath = path.join(root, "tests/unit/design-memory-retrieval.test.mjs");
const MAX_EVIDENCE_BYTES = 4096;

function harnessError(reason) { const error = new Error(reason); error.reason = reason; return error; }
function replaceExact(source, before, after) { const count = source.split(before).length - 1; if (count !== 1) throw harnessError("anchor-count"); return source.replace(before, after); }

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

async function runTest(moduleUrl, mutation, tamper) {
  const env = { ...process.env, DESIGN_MEMORY_RETRIEVAL_MUTATION_EVIDENCE: tamper === "wrong-env" ? "wrong" : "fd-json-v2", DESIGN_MEMORY_RETRIEVAL_MUTATION_ID: mutation.id, DESIGN_MEMORY_RETRIEVAL_MUTATION_TEST_ID: mutation.testId, DESIGN_MEMORY_RETRIEVAL_MUTATION_SENTINEL: mutation.sentinel, DESIGN_MEMORY_RETRIEVAL_SELECTED_TEST: mutation.selectedTest }; delete env.NODE_TEST_CONTEXT;
  if (mutation.target === "retrieval") env.DESIGN_MEMORY_RETRIEVAL_MODULE_URL = moduleUrl; else env.DESIGN_MEMORY_SCHEMA_EVALUATOR_MODULE_URL = moduleUrl;
  const child = spawn(process.execPath, [testPath], { cwd: root, env, stdio: ["ignore", "pipe", "pipe", "pipe"] }); const evidence = []; const stdout = []; const stderr = []; let evidenceLength = 0;
  const result = await new Promise((resolve, reject) => { child.stdout.on("data", (chunk) => stdout.push(chunk)); child.stderr.on("data", (chunk) => stderr.push(chunk)); child.stdio[3].on("data", (chunk) => { evidenceLength += chunk.byteLength; evidence.push(chunk); }); child.once("error", reject); child.once("close", (code) => resolve({ code, evidence: Buffer.concat(evidence), evidenceLength, output: Buffer.concat([...stdout, ...stderr]).toString("utf8") })); });
  return result;
}

const mutationId = process.argv[2]; const mutation = mutations[mutationId]; const argument = process.argv[3]; const tamper = argument?.startsWith("--tamper=") ? argument.slice(9) : undefined;
if (!mutation || !tamper) { process.stderr.write('{"code":"memory.mutation_invalid"}\n'); process.exitCode = 2; }
else {
  mutation.id = mutationId; const temporary = await mkdtemp(path.join(tmpdir(), "memory-retrieval-mutation-")); let stage = "read-source";
  try {
    let source = await readFile(mutation.target === "retrieval" ? retrievalPath : evaluatorPath, "utf8"); stage = "apply-mutation";
    if (tamper === "missing-evidence") source = source;
    else source = replaceExact(source, mutation.anchor, mutation.replacement);
    if (mutation.target === "retrieval") source = source.replace('"./lib/safe-memory-store.mjs"', JSON.stringify(new URL("../../../shared/scripts/lib/safe-memory-store.mjs", import.meta.url).href)).replace('"./lib/memory-schema-evaluator.mjs"', JSON.stringify(new URL("../../../shared/scripts/lib/memory-schema-evaluator.mjs", import.meta.url).href)).replace('"./validate-design-memory.mjs"', JSON.stringify(new URL("../../../shared/scripts/validate-design-memory.mjs", import.meta.url).href));
    let modulePath = path.join(temporary, `${mutationId}.mjs`);
    if (mutation.target === "evaluator") { modulePath = path.join(temporary, "scripts", "lib", `${mutationId}.mjs`); const schemaDirectory = path.join(temporary, "memory", "schema"); await mkdir(path.dirname(modulePath), { recursive: true }); await mkdir(schemaDirectory, { recursive: true }); for (const name of ["memory-index.schema.json", "memory-receipt.schema.json"]) await writeFile(path.join(schemaDirectory, name), await readFile(path.join(root, "shared", "memory", "schema", name))); }
    await writeFile(modulePath, source);
    if (tamper === "unrelated-failure") { stage = "unrelated"; throw harnessError("unrelated-failure"); }
    stage = "run-test"; const result = await runTest(pathToFileURL(modulePath).href, mutation, tamper); stage = "verify-evidence";
    let evidence = result.evidence;
    if (tamper === "missing-evidence") evidence = Buffer.alloc(0);
    if (tamper === "wrong-operator") evidence = Buffer.from(`${JSON.stringify({ mutationId, testId: mutation.testId, sentinel: mutation.sentinel, operator: "deepStrictEqual", expected: mutation.expected, actual: mutation.actual })}\n`);
    if (tamper === "wrong-message") evidence = Buffer.from(`${JSON.stringify({ mutationId, testId: mutation.testId, sentinel: "WRONG", operator: "strictEqual", expected: mutation.expected, actual: mutation.actual })}\n`);
    if (tamper === "duplicate-evidence") evidence = Buffer.concat([evidence, evidence]);
    if (tamper === "oversize-evidence") evidence = Buffer.alloc(MAX_EVIDENCE_BYTES + 1, 0x78);
    if (result.code !== 1) throw harnessError("test-exit"); if (!evidence.byteLength) { const error = harnessError("evidence-empty"); error.output = result.output; throw error; } const verified = parseEvidence(evidence, mutation);
    process.stdout.write(`${JSON.stringify({ ...verified, protocol: "fd-json-v2", exitCode: result.code })}\n`);
  } catch (error) { process.stderr.write(`${JSON.stringify({ code: "memory.mutation_evidence_failed", mutationId, tamper, stage, reason: error?.reason ?? "internal" })}\n`); process.exitCode = 1; }
  finally { await rm(temporary, { recursive: true, force: true }); }
}
