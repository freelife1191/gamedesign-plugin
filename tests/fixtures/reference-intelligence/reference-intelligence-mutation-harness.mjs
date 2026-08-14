import assert, { AssertionError } from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("../../..", import.meta.url));
const MAX_EVIDENCE_BYTES = 4 * 1024;
const MAX_OUTPUT_BYTES = 64 * 1024;
const TEST_TIMEOUT_MS = 15_000;
const CLOSE_TIMEOUT_MS = 2_000;
const hostilePath = path.join(root, "tests/fixtures/design-memory/process-tree-hostile.mjs");

const mutations = {
  "evidence-tier": {
    target: "shared/scripts/lib/reference-evidence.mjs",
    anchor: 'if (safeClaim.causal && positive.every(({ tier }) => tier === "discovery")) {',
    replacement: 'if (false && safeClaim.causal && positive.every(({ tier }) => tier === "discovery")) {',
    testId: "discovery-causal-claim",
    message: "RI-MUT-EVIDENCE-TIER",
    expected: false,
    actual: true,
    scenario(moduleUrl) {
      return `const api = await import(${JSON.stringify(moduleUrl)}); const provenance = { build: "1.0.0", region: "kr", accountState: "guest", observedAt: "2026-08-13T00:00:00.000Z", locator: { kind: "project-relative", value: "evidence/lead.png" }, screen: "lead", action: "observe", result: "lead", transformations: [{ from: "original", to: "capture" }, { from: "capture", to: "summary" }], rights: { copyright: "reference-owner", use: "analysis", publication: "private" }, conflictState: "none", counterexampleOf: null }; const records = api.registerReferenceEvidence({ records: [{ evidenceId: "ev-lead", referenceId: "ref-alpha", contextId: "ctx-alpha", systemIds: ["retention"], sourceType: "community", claimKind: "observation", claim: "Discovery lead.", availability: "available", limitation: null, verificationQuestion: null, ...provenance }] }); const evidenceById = new Map(records.map((item) => [item.evidenceId, item])); const result = api.validateClaimAgainstEvidence({ claim: { claimId: "claim-retention", systemIds: ["retention"], evidenceIds: ["ev-lead"], kind: "observation", category: "retention", causal: true }, evidenceById }); mutationEqual(result.ok, false);`;
    },
  },
  "fact-inference": {
    target: "shared/scripts/lib/reference-evidence.mjs",
    anchor: 'if (available.length === 0) return "unknown";',
    replacement: 'if (available.length === 0) return "inference";',
    testId: "zero-evidence-remains-unknown",
    message: "RI-MUT-FACT-INFERENCE",
    expected: "unknown",
    actual: "inference",
    scenario(moduleUrl) { return `const api = await import(${JSON.stringify(moduleUrl)}); mutationEqual(api.deriveAvailableClaimKind([]), "unknown");`; },
  },
  "atlas-obligation": {
    target: "shared/scripts/lib/system-atlas.mjs",
    anchor: "    applicability,\n    rationale: sortedUniqueText(questions.map(({ rationale }) => rationale)).join(\" \"),",
    replacement: '    applicability: applicability === "required-candidate" ? "mandatory" : applicability,\n    rationale: sortedUniqueText(questions.map(({ rationale }) => rationale)).join(" "),',
    testId: "overlay-remains-candidate",
    message: "RI-MUT-ATLAS-OBLIGATION",
    expected: "required-candidate",
    actual: "mandatory",
    scenario(moduleUrl) { return `const api = await import(${JSON.stringify(moduleUrl)}); const { atlas } = await api.loadBundledReferenceCatalog(); const question = api.mergeSystemAtlas({ atlas, genreIds: ["action-rpg"] }).find((item) => item.questionId === "core-play-action-rpg-loop"); mutationEqual(question.applicability, "required-candidate");`; },
  },
  "transfer-approval": {
    target: "shared/scripts/analyze-game-design-references.mjs",
    anchor: 'glossaryReceipt: null, reviewState: "pending-review"',
    replacement: 'glossaryReceipt: null, reviewState: "approved"',
    testId: "transfer-remains-pending-review",
    message: "RI-MUT-TRANSFER-APPROVAL",
    expected: "pending-review",
    actual: "approved",
    scenario(moduleUrl) { return `${transferScenarioPrelude(moduleUrl)} mutationEqual(result[0].reviewState, "pending-review");`; },
  },
  "transfer-trace": {
    target: "shared/scripts/analyze-game-design-references.mjs",
    anchor: 'rationale: hold ? "Hold until independent reference coverage and verification are available." : "Adapt as a proposal subject to review.", evidenceIds: dive.evidenceIds, referenceIds:',
    replacement: 'rationale: hold ? "Hold until independent reference coverage and verification are available." : "Adapt as a proposal subject to review.", evidenceIds: [], referenceIds:',
    testId: "transfer-preserves-evidence-ids",
    message: "RI-MUT-TRANSFER-TRACE",
    expected: '["ev-alpha"]',
    actual: "[]",
    scenario(moduleUrl) { return `${transferScenarioPrelude(moduleUrl)} mutationEqual(JSON.stringify(result[0].evidenceIds), JSON.stringify(["ev-alpha"]));`; },
  },
  "glossary-capability": {
    target: "shared/scripts/lib/game-design-glossary-capabilities.mjs",
    anchor: "decisionReceipts.get(receipt) !== capability || decisionCapabilities.get(capability) !== sha256Canonical(receipt)",
    replacement: "false",
    testId: "forged-approval-remains-rejected",
    message: "RI-MUT-GLOSSARY-CAPABILITY",
    expected: false,
    actual: true,
    scenario(moduleUrl) {
      return `const api = await import(${JSON.stringify(moduleUrl)}); const issued = api.issueGlossaryHumanDecision({ action: "approve", termIds: ["TERM-PLAYER-POWER"], actor: "Lead Designer", eventId: "decision-player-power", glossarySha256: "f".repeat(64), glossaryVersion: 1, changedAt: "2026-08-13T00:00:00.000Z" }); let accepted = false; try { api.assertGlossaryHumanDecision(structuredClone(issued.receipt), issued.capability); accepted = true; } catch {} mutationEqual(accepted, false);`;
    },
  },
  "glossary-rewrite": {
    target: "shared/scripts/manage-game-design-glossary.mjs",
    anchor: "export function validateDocumentTerminology({ text, language, documentId, effectiveGlossary, receipt, replacementAttempt: attempt, mappingObservation: observation, mappingCapability } = {}) {",
    replacement: 'export function validateDocumentTerminology(input = {}) {\n  input.text = "전투력";\n  const { text, language, documentId, effectiveGlossary, receipt, replacementAttempt: attempt, mappingObservation: observation, mappingCapability } = input;',
    testId: "terminology-validation-does-not-rewrite",
    message: "RI-MUT-GLOSSARY-REWRITE",
    expected: "플레이어 파워",
    actual: "전투력",
    scenario(moduleUrl) {
      return `const api = await import(${JSON.stringify(moduleUrl)}); const term = { termId: "TERM-PLAYER-POWER", koPreferred: "플레이어 파워", enPreferred: "Player Power", definition: "Strength.", scope: "combat", contexts: ["combat"], abbreviations: [], allowedVariants: [], forbiddenTerms: ["전투력"], deprecatedTerms: [], untranslatedExpressions: [], grammar: { ko: "명사", en: "noun" }, examples: [], confusedConceptIds: [], decisionIds: ["decision-player-power"], evidenceIds: [], state: "approved", approver: "Lead Designer", replacementTermId: null, version: 1, changedAt: "2026-08-13T00:00:00.000Z" }; const effectiveGlossary = { schemaVersion: 1, scope: "effective", version: 1, terms: [term] }; const receipt = api.createGlossarySnapshot({ documentId: "combat-v1", effectiveGlossary, termIds: ["TERM-PLAYER-POWER"] }); const request = { text: "플레이어 파워", language: "ko", documentId: "combat-v1", effectiveGlossary, receipt }; api.validateDocumentTerminology(request); mutationEqual(request.text, "플레이어 파워");`;
    },
  },
};

function transferScenarioPrelude(moduleUrl) {
  return `const api = await import(${JSON.stringify(moduleUrl)}); const provenance = { build: "1.0.0", region: "kr", accountState: "guest", observedAt: "2026-08-13T00:00:00.000Z", locator: { kind: "project-relative", value: "evidence/alpha.png" }, screen: "loop", action: "observe", result: "choice", transformations: [{ from: "original", to: "capture" }, { from: "capture", to: "summary" }], rights: { copyright: "reference-owner", use: "analysis", publication: "private" }, conflictState: "none", counterexampleOf: null }; const evidence = [{ evidenceId: "ev-alpha", referenceId: "ref-alpha", contextId: "ctx-alpha", systemIds: ["core-play"], sourceType: "direct-play", claimKind: "observation", claim: "Observed loop.", availability: "available", limitation: null, verificationQuestion: null, ...provenance }]; const result = api.buildDesignTransfers({ deepDives: [{ systemId: "core-play", claimKind: "observation", finding: "Observed loop.", evidenceIds: ["ev-alpha"], referenceIds: ["ref-alpha"], contextIds: ["ctx-alpha"], coverageCount: 1 }], projectConstraints: ["short-session"], evidence, referenceContexts: [{ contextId: "ctx-alpha", referenceId: "ref-alpha", version: "1", platform: "pc" }], referenceSet: [{ referenceId: "ref-alpha", label: "Alpha", role: "core-system-exemplar", decisionQuestionIds: ["question-loop"], availability: "available", limitation: null }, { referenceId: "ref-alpha", label: "Alpha", role: "direct-competitor", decisionQuestionIds: ["question-loop"], availability: "available", limitation: null }, { referenceId: "ref-alpha", label: "Alpha", role: "operations-monetization-comparator", decisionQuestionIds: ["question-loop"], availability: "available", limitation: null }] });`;
}

function harnessError(reason) { const error = new Error("mutation evidence failed"); error.reason = reason; return error; }

function replaceExact(source, anchor, replacement) {
  const count = source.split(anchor).length - 1;
  if (count !== 1) throw harnessError("anchor-count");
  return source.replace(anchor, replacement);
}

function assertionMessage(actual, expected, message) {
  try { assert.equal(actual, expected, message); } catch (error) { return error.message; }
  throw harnessError("mutation-not-detectable");
}

function selectedTestSource(mutation, moduleUrl, tamper) {
  const expectedRecord = { mutationId: mutation.id, testId: mutation.testId, message: assertionMessage(mutation.actual, mutation.expected, mutation.message), operator: "strictEqual", expected: mutation.expected, actual: mutation.actual, environment: { protocol: "fd-json-v3", mutationId: mutation.id, testId: mutation.testId, message: mutation.message } };
  const recordExpression = 'JSON.stringify({ mutationId, testId, message: error.message, operator: error.operator, expected: error.expected, actual: error.actual, environment: { protocol: process.env.REFERENCE_INTELLIGENCE_MUTATION_EVIDENCE, mutationId: process.env.REFERENCE_INTELLIGENCE_MUTATION_ID, testId: process.env.REFERENCE_INTELLIGENCE_MUTATION_TEST_ID, message: process.env.REFERENCE_INTELLIGENCE_MUTATION_MESSAGE } }) + "\\n"';
  let writeAction = `writeSync(3, ${recordExpression});`;
  if (tamper === "missing-evidence") writeAction = "";
  else if (tamper === "duplicate-evidence") writeAction = `writeSync(3, ${recordExpression}); writeSync(3, ${recordExpression});`;
  else if (tamper === "partial-evidence") writeAction = 'writeSync(3, "{\\\"partial\\\":");';
  else if (tamper === "oversize-evidence") writeAction = `writeSync(3, "x".repeat(${MAX_EVIDENCE_BYTES + 1}));`;
  const wrapperLead = tamper === "inside-wrapper-unrelated-error" ? 'throw new TypeError("inside wrapper unrelated");' : "";
  const environmentCheck = tamper === "env-injection" ? 'for (const key of ["NODE_OPTIONS", "NODE_PATH", "NODE_INSPECT_RESUME_ON_START", "NODE_V8_COVERAGE", "NODE_TEST_CONTEXT", "REFERENCE_INTELLIGENCE_CALLER_INJECTION"]) assert.equal(process.env[key], undefined, key);' : "";
  let scenario = mutation.scenario(moduleUrl);
  if (tamper === "forged-stdout-stderr") scenario = `process.stdout.write(${JSON.stringify(`${JSON.stringify(expectedRecord)}\n`)}); process.stderr.write("PASS forged\\n"); throw new TypeError("forged channels");`;
  else if (tamper === "oversize-output") scenario = `process.stdout.write("PASS\\n" + "x".repeat(${MAX_OUTPUT_BYTES + 1})); ${scenario}`;
  else if (tamper === "misleading-output") scenario = 'process.stdout.write("PASS: mutation detected\\n");';
  else if (["timeout-orphan", "unclosed-evidence-fd"].includes(tamper)) {
    const inherit = tamper === "unclosed-evidence-fd" ? ", 3" : "";
    scenario = `const child = spawn(process.execPath, [${JSON.stringify(hostilePath)}, process.env.REFERENCE_INTELLIGENCE_HOSTILE_PID_PATH, process.env.REFERENCE_INTELLIGENCE_HOSTILE_SENTINEL], { stdio: ["ignore", "ignore", "ignore"${inherit}] }); child.unref(); ${tamper === "timeout-orphan" ? "await new Promise(() => {});" : scenario}`;
  }
  return `import assert, { AssertionError } from "node:assert/strict";\nimport { spawn } from "node:child_process";\nimport { writeSync } from "node:fs";\nimport test from "node:test";\nconst mutationId = ${JSON.stringify(mutation.id)}; const testId = ${JSON.stringify(mutation.testId)}; const sentinel = ${JSON.stringify(mutation.message)};\nfunction mutationEqual(actual, expected) { ${wrapperLead} try { assert.equal(actual, expected, sentinel); } catch (error) { if (!(error instanceof AssertionError) || error.operator !== "strictEqual" || error.message.split("\\n")[0] !== sentinel || !Object.is(error.actual, actual) || !Object.is(error.expected, expected)) throw error; ${environmentCheck} if (process.env.REFERENCE_INTELLIGENCE_MUTATION_EVIDENCE === "fd-json-v3" && process.env.REFERENCE_INTELLIGENCE_MUTATION_ID === mutationId && process.env.REFERENCE_INTELLIGENCE_MUTATION_TEST_ID === testId && process.env.REFERENCE_INTELLIGENCE_MUTATION_MESSAGE === sentinel) { ${writeAction} } throw error; } }\ntest(testId, async () => { ${scenario} });\n`;
}

function allowlistedEnvironment(mutation, tamper) {
  const env = {};
  for (const key of ["PATH", "TMPDIR", "TEMP", "TMP", "LANG", "LC_ALL", "HOME"]) if (typeof process.env[key] === "string") env[key] = process.env[key];
  Object.assign(env, {
    REFERENCE_INTELLIGENCE_MUTATION_EVIDENCE: tamper === "wrong-env" ? "wrong" : "fd-json-v3",
    REFERENCE_INTELLIGENCE_MUTATION_ID: mutation.id,
    REFERENCE_INTELLIGENCE_MUTATION_TEST_ID: mutation.testId,
    REFERENCE_INTELLIGENCE_MUTATION_MESSAGE: mutation.message,
  });
  if (["timeout-orphan", "unclosed-evidence-fd"].includes(tamper)) {
    env.REFERENCE_INTELLIGENCE_HOSTILE_PID_PATH = process.env.REFERENCE_INTELLIGENCE_HOSTILE_PID_PATH;
    env.REFERENCE_INTELLIGENCE_HOSTILE_SENTINEL = process.env.REFERENCE_INTELLIGENCE_HOSTILE_SENTINEL;
  }
  return env;
}

function terminateProcessTree(child) {
  if (!child?.pid) return;
  try {
    if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
    else process.kill(-child.pid, "SIGKILL");
  } catch {}
  try { child.kill("SIGKILL"); } catch {}
}

async function runSelectedTest(selectedTestPath, mutation, tamper) {
  const child = spawn(process.execPath, [selectedTestPath], { cwd: root, env: allowlistedEnvironment(mutation, tamper), detached: process.platform !== "win32", windowsHide: true, stdio: ["ignore", "pipe", "pipe", "pipe"] });
  const evidence = []; const stdout = []; const stderr = [];
  let evidenceLength = 0; let outputLength = 0; let pendingFailure; let settled = false; let closeTimer;
  return await new Promise((resolve, reject) => {
    const finish = (operation, value) => { if (settled) return; settled = true; clearTimeout(timeout); clearTimeout(closeTimer); operation(value); };
    const fail = (reason) => {
      if (pendingFailure || settled) return;
      pendingFailure = harnessError(reason); clearTimeout(timeout); terminateProcessTree(child);
      closeTimer = setTimeout(() => { terminateProcessTree(child); for (const stream of [child.stdout, child.stderr, child.stdio[3]]) stream?.destroy(); finish(reject, pendingFailure); }, CLOSE_TIMEOUT_MS);
    };
    const timeout = setTimeout(() => fail("test-timeout"), TEST_TIMEOUT_MS);
    const collectOutput = (target) => (chunk) => { if (pendingFailure) return; outputLength += chunk.byteLength; if (outputLength > MAX_OUTPUT_BYTES) fail("output-limit"); else target.push(chunk); };
    child.stdout.on("data", collectOutput(stdout)); child.stderr.on("data", collectOutput(stderr));
    child.stdio[3].on("data", (chunk) => { if (pendingFailure) return; evidenceLength += chunk.byteLength; if (evidenceLength > MAX_EVIDENCE_BYTES) fail("evidence-limit"); else evidence.push(chunk); });
    child.once("error", () => fail("test-launch"));
    child.once("close", (code) => pendingFailure ? finish(reject, pendingFailure) : finish(resolve, { code, evidence: Buffer.concat(evidence), output: Buffer.concat([...stdout, ...stderr]).toString("utf8") }));
  });
}

function parseEvidence(bytes, mutation) {
  const text = bytes.toString("utf8");
  if (!text.endsWith("\n") || text.slice(0, -1).includes("\n")) throw harnessError("evidence-line-count");
  let record;
  try { record = JSON.parse(text); } catch { throw harnessError("evidence-json"); }
  const keys = ["actual", "environment", "expected", "message", "mutationId", "operator", "testId"];
  if (!record || typeof record !== "object" || Array.isArray(record) || JSON.stringify(Object.keys(record).sort()) !== JSON.stringify(keys)) throw harnessError("evidence-shape");
  const expectedMessage = assertionMessage(mutation.actual, mutation.expected, mutation.message);
  const expectedEnvironment = { protocol: "fd-json-v3", mutationId: mutation.id, testId: mutation.testId, message: mutation.message };
  if (record.mutationId !== mutation.id || record.testId !== mutation.testId || record.operator !== "strictEqual" || record.message !== expectedMessage || !Object.is(record.expected, mutation.expected) || !Object.is(record.actual, mutation.actual) || JSON.stringify(record.environment) !== JSON.stringify(expectedEnvironment)) throw harnessError("evidence-mismatch");
  return record;
}

const mutationId = process.argv[2];
const argument = process.argv[3];
const tamper = argument?.startsWith("--tamper=") ? argument.slice(9) : undefined;
const mutation = mutations[mutationId];
if (!mutation || !tamper) {
  process.stderr.write('{"code":"reference-intelligence.mutation-invalid"}\n');
  process.exitCode = 2;
} else {
  mutation.id = mutationId;
  const temporary = await mkdtemp(path.join(tmpdir(), "reference-intelligence-mutation-"));
  let stage = "copy-source";
  try {
    await cp(path.join(root, "shared"), path.join(temporary, "shared"), { recursive: true });
    stage = "apply-mutation";
    const target = path.join(temporary, mutation.target);
    const source = replaceExact(await readFile(target, "utf8"), mutation.anchor, mutation.replacement);
    await writeFile(target, source);
    const selectedTestPath = path.join(temporary, "selected-mutation.test.mjs");
    await mkdir(path.dirname(selectedTestPath), { recursive: true });
    await writeFile(selectedTestPath, selectedTestSource(mutation, pathToFileURL(target).href, tamper));
    stage = "run-test";
    const result = await runSelectedTest(selectedTestPath, mutation, tamper);
    stage = "verify-evidence";
    if (result.code !== 1) throw harnessError("test-exit");
    if (result.evidence.byteLength === 0) throw harnessError("evidence-empty");
    const verified = parseEvidence(result.evidence, mutation);
    process.stdout.write(`${JSON.stringify({ ...verified, protocol: "fd-json-v3", exitCode: result.code })}\n`);
  } catch (error) {
    process.stderr.write(`${JSON.stringify({ code: "reference-intelligence.mutation-evidence-failed", mutationId, tamper, stage, reason: error?.reason ?? "internal" })}\n`);
    process.exitCode = 1;
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}
