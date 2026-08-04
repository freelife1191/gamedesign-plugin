import assert from "node:assert/strict";
import { access, mkdtemp, readFile, rm, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import { buildProduct } from "../../../tooling/lib/build-product.mjs";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const pluginRoot = path.join(repoRoot, "products/game-design-studio/plugin");
const mergerRelativePath = "skills/orchestrate-game-design-project/scripts/merge-role-findings.mjs";
const routing = JSON.parse(await readFile(path.join(pluginRoot, "references/routing.json"), "utf8"));
const roles = routing.roleIds;
const responsibleGates = JSON.parse(await readFile(path.join(repoRoot, "shared/responsible-design/gates.json"), "utf8"));
const gateIds = responsibleGates.gates.map(({ id }) => id);
const blockerGateByRole = {
  "lead-game-designer": "scope-control",
  "system-economy-designer": "economy-transparency",
  "content-narrative-designer": "ai-rights-human-approval",
  "ux-accessibility-reviewer": "accessibility",
  "liveops-data-designer": "liveops-experiment",
  "production-feasibility-critic": "scope-control",
};

const specializations = {
  "lead-game-designer": ["target experience", "core loop", "scope-control"],
  "system-economy-designer": ["rule precedence", "source and sink", "economy-transparency"],
  "content-narrative-designer": ["system dependency", "production resource", "ai-rights-human-approval"],
  "ux-accessibility-reviewer": ["critical action", "interaction state", "accessibility"],
  "liveops-data-designer": ["hypothesis", "guardrail", "liveops-experiment"],
  "production-feasibility-critic": ["dependency", "kill criterion", "scope-control"],
};

const findingFieldNames = [
  "findingId",
  "role",
  "severity",
  "affectedSectionId",
  "findingType",
  "summary",
  "evidenceIds",
  "impact",
  "assumptions",
  "applicableGate",
  "minimalFix",
];

async function readPlugin(relativePath) {
  return readFile(path.join(pluginRoot, relativePath), "utf8");
}

function section(markdown, heading) {
  const match = markdown.match(new RegExp(`## ${heading}\\n([\\s\\S]*?)(?=\\n## |$)`, "u"));
  assert.ok(match, `missing section: ${heading}`);
  assert.notEqual(match[1].trim(), "", `empty section: ${heading}`);
  return match[1];
}

function findingFields(markdown) {
  return section(markdown, "Finding Schema")
    .split("\n")
    .filter((line) => /^\| `[^`]+` \|/u.test(line))
    .map((line) => line.split("|")[1].trim().replaceAll("`", ""));
}

function assertRolePromptContract(role, markdown) {
  assert.match(markdown, new RegExp(`^# ${role}$`, "mu"));
  for (const heading of [
    "Responsibility",
    "Required Evidence and Input",
    "Review Questions",
    "Scope",
    "Out of Scope",
    "Forbidden Assumptions",
    "Evidence Requirements",
    "Blocker Authority",
    "Finding Schema",
    "Completion Signal",
  ]) section(markdown, heading);
  const requiredInput = section(markdown, "Required Evidence and Input");
  for (const envelopeField of ["artifact", "role", "questions", "findingsPath"]) {
    assert.match(requiredInput, new RegExp("`" + envelopeField + "`", "u"), `${role}: ${envelopeField}`);
  }
  assert.match(markdown, /write.*findingsPath/isu);
  assert.deepEqual(findingFields(markdown), findingFieldNames);
  assert.match(markdown, /`blocker` > `high` > `medium` > `low`/u);
  assert.match(markdown, /finding.*minimal fix/isu);
  assert.match(markdown, /do not rewrite.*artifact/isu);
  for (const phrase of specializations[role]) {
    assert.match(markdown, new RegExp(phrase, "iu"), `${role}: ${phrase}`);
  }
}

function finding({
  findingId,
  role,
  severity = "medium",
  affectedSectionId = "section-1",
  findingType = "missing-evidence",
  summary = "The claim is not inspectable.",
  evidenceIds = ["evidence-1"],
  impact = "The approval decision is unsupported.",
  assumptions = ["The cited artifact is the review source."],
  applicableGate = "scope-control",
  minimalFix = "Link the claim to inspectable evidence.",
}) {
  return {
    findingId,
    role,
    severity,
    affectedSectionId,
    findingType,
    summary,
    evidenceIds,
    impact,
    assumptions,
    applicableGate,
    minimalFix,
  };
}

function permutations(items) {
  if (items.length < 2) return [items];
  return items.flatMap((item, index) => permutations([
    ...items.slice(0, index),
    ...items.slice(index + 1),
  ]).map((tail) => [item, ...tail]));
}

async function loadMerger() {
  const url = pathToFileURL(path.join(pluginRoot, mergerRelativePath));
  return import(`${url.href}?test=${Date.now()}-${Math.random()}`);
}

test("all six bounded role prompts define exact review and blocker contracts", async () => {
  assert.equal(roles.length, 6);
  assert.deepEqual(routing.rolePriority, roles);
  for (const role of roles) {
    const markdown = await readPlugin(`agents/${role}.md`);
    assertRolePromptContract(role, markdown);
    assert.match(section(markdown, "Blocker Authority"), new RegExp("blocker.*only.*`" + blockerGateByRole[role] + "`", "isu"));
  }
});

test("role prompt mutation guard detects missing boundaries, fields, and specialization", async () => {
  for (const role of roles) {
    const markdown = await readPlugin(`agents/${role}.md`);
    for (const mutation of [
      markdown.replace("## Required Evidence and Input", "## Inputs"),
      markdown.replace("| `minimalFix` |", "| `repair` |"),
      markdown.replace(/do not rewrite.*artifact/iu, "rewrite the artifact"),
      markdown.replace(new RegExp(specializations[role][0], "giu"), "generic review"),
    ]) assert.throws(() => assertRolePromptContract(role, mutation), undefined, `${role} mutation survived`);
  }
});

test("merge script is bundled under orchestrator and cannot collide with shared top-level scripts", async () => {
  await assert.doesNotReject(access(path.join(pluginRoot, mergerRelativePath)));
  await assert.rejects(access(path.join(pluginRoot, "scripts/merge-role-findings.mjs")), { code: "ENOENT" });
  const stagingRoot = await mkdtemp(path.join(os.tmpdir(), "studio-roles-build-"));
  try {
    const build = await buildProduct({ repoRoot, productName: "game-design-studio", stagingRoot, sourceDateEpoch: 0 });
    assert.ok(build.files.includes(mergerRelativePath));
    assert.ok(!build.files.includes("scripts/merge-role-findings.mjs"));
  } finally {
    await rm(stagingRoot, { recursive: true, force: true });
  }
});

test("merge order is total across 720 completion orders and idempotent", async () => {
  const { mergeRoleFindings, verifyMergedRoleFindings } = await loadMerger();
  const input = [
    finding({ findingId: "f-low", role: "production-feasibility-critic", severity: "low", affectedSectionId: "z" }),
    finding({ findingId: "f-role-late", role: "content-narrative-designer", severity: "high", affectedSectionId: "a", summary: "Later role." }),
    finding({ findingId: "f-role-first", role: "lead-game-designer", severity: "high", affectedSectionId: "a" }),
    finding({ findingId: "f-section", role: "lead-game-designer", severity: "high", affectedSectionId: "b" }),
    finding({ findingId: "f-blocker", role: "system-economy-designer", severity: "blocker", affectedSectionId: "z", applicableGate: "economy-transparency" }),
    finding({ findingId: "f-tie-z", role: "lead-game-designer", severity: "medium", affectedSectionId: "m", summary: "Z summary" }),
  ];
  const extra = finding({ findingId: "f-tie-a", role: "lead-game-designer", severity: "medium", affectedSectionId: "m", summary: "A summary" });
  const expected = ["f-blocker", "f-role-first", "f-role-late", "f-section", "f-tie-a", "f-tie-z", "f-low"];
  const outputs = permutations(input).map((items) => mergeRoleFindings({ schemaVersion: 1, findings: [...items, extra] }));
  assert.equal(outputs.length, 720);
  for (const output of outputs) {
    assert.deepEqual(output.findings.map(({ findingId }) => findingId), expected);
    assert.deepEqual(output, outputs[0]);
  }
  assert.equal(typeof verifyMergedRoleFindings, "function");
  const verified = verifyMergedRoleFindings(outputs[0], { trustedSourceFindings: outputs[0].sourceFindings });
  assert.deepEqual(verified, outputs[0]);
  assert.deepEqual(verifyMergedRoleFindings(verified, { trustedSourceFindings: outputs[0].sourceFindings }), outputs[0]);
});

test("exact duplicates merge provenance and conflicting repairs remain explicit decisions", async () => {
  const { mergeRoleFindings } = await loadMerger();
  const first = finding({ findingId: "f-1", role: "lead-game-designer" });
  const duplicate = finding({ findingId: "f-2", role: "ux-accessibility-reviewer" });
  const conflict = finding({ findingId: "f-3", role: "production-feasibility-critic", minimalFix: "Remove the unsupported scope." });
  const result = mergeRoleFindings({ schemaVersion: 1, findings: [duplicate, conflict, first] });
  assert.equal(result.findings.length, 2);
  assert.deepEqual(result.findings[0].provenance, [
    { findingId: "f-1", role: "lead-game-designer" },
    { findingId: "f-2", role: "ux-accessibility-reviewer" },
  ]);
  assert.equal(result.decisions.length, 1);
  assert.equal(result.decisions[0].status, "human-decision-required");
  assert.equal(result.decisions[0].recommendations.length, 2);
  assert.deepEqual(result.decisions[0].assumptions, first.assumptions);
});

test("decision IDs encode structural tuples without colon-boundary collisions", async () => {
  const { mergeRoleFindings, verifyMergedRoleFindings } = await loadMerger();
  const tuples = [
    finding({ findingId: "a1", role: "lead-game-designer", affectedSectionId: "a:b", findingType: "c", applicableGate: "scope-control", minimalFix: "Repair A." }),
    finding({ findingId: "a2", role: "system-economy-designer", affectedSectionId: "a:b", findingType: "c", applicableGate: "scope-control", minimalFix: "Repair B." }),
    finding({ findingId: "b1", role: "content-narrative-designer", affectedSectionId: "a", findingType: "b:c", applicableGate: "scope-control", minimalFix: "Repair C." }),
    finding({ findingId: "b2", role: "ux-accessibility-reviewer", affectedSectionId: "a", findingType: "b:c", applicableGate: "scope-control", minimalFix: "Repair D." }),
    finding({ findingId: "c1", role: "liveops-data-designer", affectedSectionId: "한글/섹션", findingType: "type%quoted", applicableGate: "scope-control", minimalFix: "Repair E." }),
    finding({ findingId: "c2", role: "production-feasibility-critic", affectedSectionId: "한글/섹션", findingType: "type%quoted", applicableGate: "scope-control", minimalFix: "Repair F." }),
  ];
  const forward = mergeRoleFindings({ schemaVersion: 1, findings: tuples });
  const reverse = mergeRoleFindings({ schemaVersion: 1, findings: [...tuples].reverse() });
  assert.equal(forward.decisions.length, 3);
  assert.equal(new Set(forward.decisions.map(({ decisionId }) => decisionId)).size, 3);
  for (const { decisionId } of forward.decisions) assert.match(decisionId, /^decision:sha256:[0-9a-f]{64}$/u);
  assert.deepEqual(reverse, forward);
  assert.deepEqual(verifyMergedRoleFindings(forward, { trustedSourceFindings: tuples }), forward);
});

test("merger fails closed on unknown schema, role, severity, keys, identifiers, and provenance", async () => {
  const { mergeRoleFindings } = await loadMerger();
  const base = finding({ findingId: "f-1", role: "lead-game-designer" });
  const nfd = "Cafe\u0301";
  for (const invalid of [
    { ...base, role: "unknown-role" },
    { ...base, severity: "critical" },
    { ...base, applicableGate: "unknown-gate" },
    { ...base, severity: "blocker", applicableGate: "accessibility" },
    { ...base, affectedSectionId: "" },
    { ...base, evidenceIds: [""] },
    { ...base, assumptions: [""] },
    { ...base, summary: nfd },
    { ...base, affectedSectionId: "bad\u0000section" },
    { ...base, extra: true },
    { ...base, provenance: [{ findingId: "f-1", role: "lead-game-designer" }] },
  ]) assert.throws(() => mergeRoleFindings({ schemaVersion: 1, findings: [invalid] }));
  assert.throws(() => mergeRoleFindings({ schemaVersion: 2, findings: [] }));
  assert.throws(() => mergeRoleFindings(JSON.parse('{"schemaVersion":1,"findings":[],"__proto__":{}}')));
  assert.throws(() => mergeRoleFindings(null));
});

test("all responsible gates are recognized and blocker authority is exact per role", async () => {
  const { mergeRoleFindings } = await loadMerger();
  for (const [index, applicableGate] of gateIds.entries()) {
    assert.doesNotThrow(() => mergeRoleFindings({
      schemaVersion: 1,
      findings: [finding({ findingId: `gate-${index}`, role: "lead-game-designer", applicableGate })],
    }));
  }
  assert.doesNotThrow(() => mergeRoleFindings({
    schemaVersion: 1,
    findings: [finding({ findingId: "gate-none", role: "lead-game-designer", applicableGate: "none" })],
  }));
  for (const [index, role] of roles.entries()) {
    assert.doesNotThrow(() => mergeRoleFindings({
      schemaVersion: 1,
      findings: [finding({
        findingId: `blocker-${index}`,
        role,
        severity: "blocker",
        applicableGate: blockerGateByRole[role],
      })],
    }));
  }
});

test("source finding identity is globally unique and canonical provenance cannot be forged", async () => {
  const { mergeRoleFindings, verifyMergedRoleFindings } = await loadMerger();
  const duplicateId = [
    finding({ findingId: "same", role: "lead-game-designer" }),
    finding({ findingId: "same", role: "ux-accessibility-reviewer", evidenceIds: ["evidence-2"] }),
  ];
  assert.throws(() => mergeRoleFindings({ schemaVersion: 1, findings: duplicateId }), /duplicate.*findingId/iu);
  const valid = mergeRoleFindings({ schemaVersion: 1, findings: [finding({ findingId: "f-1", role: "lead-game-designer" })] });
  const forged = structuredClone(valid);
  forged.findings[0].findingId = "forged";
  assert.equal(typeof verifyMergedRoleFindings, "function");
  assert.throws(
    () => verifyMergedRoleFindings(forged, { trustedSourceFindings: valid.sourceFindings }),
    /canonical|provenance|trusted/iu,
  );
});

async function canonicalBlockerOutput() {
  const { mergeRoleFindings } = await loadMerger();
  return { mergeRoleFindings, valid: mergeRoleFindings({
    schemaVersion: 1,
    findings: [finding({
      findingId: "source-lead",
      role: "lead-game-designer",
      severity: "blocker",
      applicableGate: "scope-control",
    })],
  }) };
}

test("canonical re-input rejects appended fake provenance", async () => {
  const { mergeRoleFindings, valid } = await canonicalBlockerOutput();
  const { verifyMergedRoleFindings } = await loadMerger();
  const fake = structuredClone(valid);
  fake.findings[0].provenance.push({
    findingId: "fake-production",
    role: "production-feasibility-critic",
  });
  assert.throws(
    () => verifyMergedRoleFindings(fake, { trustedSourceFindings: valid.sourceFindings }),
    /source|canonical|provenance|trusted/iu,
  );
});

test("canonical re-input rejects a jointly replaced top finding and provenance", async () => {
  const { mergeRoleFindings, valid } = await canonicalBlockerOutput();
  const { verifyMergedRoleFindings } = await loadMerger();
  const replaced = structuredClone(valid);
  replaced.findings[0].findingId = "replacement";
  replaced.findings[0].provenance = [{ findingId: "replacement", role: "lead-game-designer" }];
  assert.throws(
    () => verifyMergedRoleFindings(replaced, { trustedSourceFindings: valid.sourceFindings }),
    /source|canonical|provenance|trusted/iu,
  );
});

test("canonical re-input rejects provenance whose role lacks blocker authority", async () => {
  const { mergeRoleFindings, valid } = await canonicalBlockerOutput();
  const { verifyMergedRoleFindings } = await loadMerger();
  const unauthorized = structuredClone(valid);
  unauthorized.findings[0].provenance.push({
    findingId: "fake-ux",
    role: "ux-accessibility-reviewer",
  });
  assert.throws(
    () => verifyMergedRoleFindings(unauthorized, { trustedSourceFindings: valid.sourceFindings }),
    /authority|source|canonical|provenance|trusted/iu,
  );
});

test("canonical re-input rejects missing provenance from an exact duplicate", async () => {
  const { mergeRoleFindings, verifyMergedRoleFindings } = await loadMerger();
  const valid = mergeRoleFindings({
    schemaVersion: 1,
    findings: [
      finding({ findingId: "duplicate-a", role: "lead-game-designer" }),
      finding({ findingId: "duplicate-b", role: "ux-accessibility-reviewer" }),
    ],
  });
  const missing = structuredClone(valid);
  missing.findings[0].provenance.pop();
  assert.throws(
    () => verifyMergedRoleFindings(missing, { trustedSourceFindings: valid.sourceFindings }),
    /source|canonical|provenance|trusted/iu,
  );
});

test("canonical re-input rejects finding identities crossed between semantic findings", async () => {
  const { mergeRoleFindings, verifyMergedRoleFindings } = await loadMerger();
  const valid = mergeRoleFindings({
    schemaVersion: 1,
    findings: [
      finding({ findingId: "section-a-source", role: "lead-game-designer", affectedSectionId: "section-a" }),
      finding({ findingId: "section-b-source", role: "lead-game-designer", affectedSectionId: "section-b" }),
    ],
  });
  const crossed = structuredClone(valid);
  const firstId = crossed.findings[0].findingId;
  crossed.findings[0].findingId = crossed.findings[1].findingId;
  crossed.findings[1].findingId = firstId;
  const firstProvenance = crossed.findings[0].provenance;
  crossed.findings[0].provenance = crossed.findings[1].provenance;
  crossed.findings[1].provenance = firstProvenance;
  assert.throws(
    () => verifyMergedRoleFindings(crossed, { trustedSourceFindings: valid.sourceFindings }),
    /source|canonical|provenance|trusted/iu,
  );
});

test("raw merger rejects candidate output instead of pretending self-authentication", async () => {
  const { mergeRoleFindings } = await loadMerger();
  const original = finding({ findingId: "trusted-original", role: "lead-game-designer" });
  const added = finding({ findingId: "caller-added", role: "production-feasibility-critic", affectedSectionId: "added" });
  const candidateWithAddedSource = mergeRoleFindings({ schemaVersion: 1, findings: [original, added] });
  const candidateWithRemovedSource = mergeRoleFindings({ schemaVersion: 1, findings: [] });
  assert.throws(() => mergeRoleFindings(candidateWithAddedSource), /raw|trusted|candidate|unknown/iu);
  assert.throws(() => mergeRoleFindings(candidateWithRemovedSource), /raw|trusted|candidate|unknown/iu);
});

test("trusted verification rejects self-consistent source addition removal and replacement", async () => {
  const { mergeRoleFindings, verifyMergedRoleFindings } = await loadMerger();
  assert.equal(typeof verifyMergedRoleFindings, "function");
  const original = finding({ findingId: "trusted-original", role: "lead-game-designer" });
  const trustedSourceFindings = [original];
  const valid = mergeRoleFindings({ schemaVersion: 1, findings: trustedSourceFindings });
  const added = mergeRoleFindings({
    schemaVersion: 1,
    findings: [original, finding({ findingId: "caller-added", role: "production-feasibility-critic", affectedSectionId: "added" })],
  });
  const removed = mergeRoleFindings({ schemaVersion: 1, findings: [] });
  const replaced = mergeRoleFindings({
    schemaVersion: 1,
    findings: [finding({ findingId: "caller-replacement", role: "lead-game-designer", summary: "Replaced source." })],
  });
  assert.deepEqual(verifyMergedRoleFindings(valid, { trustedSourceFindings }), valid);
  for (const candidate of [added, removed, replaced]) {
    assert.throws(
      () => verifyMergedRoleFindings(candidate, { trustedSourceFindings }),
      /trusted|source|candidate|canonical/iu,
    );
  }
});

test("trusted verification fails without trust or with the wrong trusted snapshot", async () => {
  const { mergeRoleFindings, verifyMergedRoleFindings } = await loadMerger();
  assert.equal(typeof verifyMergedRoleFindings, "function");
  const source = finding({ findingId: "trusted-original", role: "lead-game-designer" });
  const candidate = mergeRoleFindings({ schemaVersion: 1, findings: [source] });
  assert.throws(() => verifyMergedRoleFindings(candidate), /trusted|snapshot|options/iu);
  assert.throws(
    () => verifyMergedRoleFindings(candidate, { trustedSourceFindings: [
      finding({ findingId: "wrong-trust", role: "lead-game-designer" }),
    ] }),
    /trusted|source|candidate|canonical/iu,
  );
});

test("merge and trusted verification do not mutate caller-owned objects", async () => {
  const { mergeRoleFindings, verifyMergedRoleFindings } = await loadMerger();
  assert.equal(typeof verifyMergedRoleFindings, "function");
  const rawInput = { schemaVersion: 1, findings: [finding({ findingId: "immutable-source", role: "lead-game-designer" })] };
  const rawBefore = structuredClone(rawInput);
  const candidate = mergeRoleFindings(rawInput);
  assert.deepEqual(rawInput, rawBefore);
  const trustedEnvelope = { trustedSourceFindings: structuredClone(rawInput.findings) };
  const trustedBefore = structuredClone(trustedEnvelope);
  const candidateBefore = structuredClone(candidate);
  verifyMergedRoleFindings(candidate, trustedEnvelope);
  assert.deepEqual(trustedEnvelope, trustedBefore);
  assert.deepEqual(candidate, candidateBefore);
});

test("trusted verification validates the trusted snapshot at the raw-source boundary", async () => {
  const { mergeRoleFindings, verifyMergedRoleFindings } = await loadMerger();
  const source = finding({ findingId: "trusted-original", role: "lead-game-designer" });
  const candidate = mergeRoleFindings({ schemaVersion: 1, findings: [source] });
  const nfd = "Cafe\u0301";
  for (const invalid of [
    { ...source, extra: true },
    { ...source, summary: nfd },
    { ...source, affectedSectionId: "bad\u0000section" },
    { ...source, role: "unknown-role" },
    { ...source, severity: "blocker", applicableGate: "accessibility" },
    { ...source, provenance: [{ findingId: source.findingId, role: source.role }] },
    Object.assign(Object.create({ inherited: true }), source),
  ]) assert.throws(
    () => verifyMergedRoleFindings(candidate, { trustedSourceFindings: [invalid] }),
  );
  assert.throws(
    () => verifyMergedRoleFindings(candidate, { trustedSourceFindings: [source], extra: true }),
  );
});

test("trusted verification rejects decision objects that spoof JSON serialization", async () => {
  const { mergeRoleFindings, verifyMergedRoleFindings } = await loadMerger();
  const trustedSourceFindings = [
    finding({ findingId: "decision-a", role: "lead-game-designer", minimalFix: "Repair A." }),
    finding({ findingId: "decision-b", role: "production-feasibility-critic", minimalFix: "Repair B." }),
  ];
  const candidate = mergeRoleFindings({ schemaVersion: 1, findings: trustedSourceFindings });
  assert.equal(candidate.decisions.length, 1);
  const forged = structuredClone(candidate);
  const expectedDecision = forged.decisions[0];
  forged.decisions[0] = { toJSON: () => expectedDecision };
  assert.throws(
    () => verifyMergedRoleFindings(forged, { trustedSourceFindings }),
    /decision|plain|unknown|candidate/iu,
  );
});

test("trusted source accessor cannot swap snapshots across validation and derivation", async () => {
  const { mergeRoleFindings, verifyMergedRoleFindings } = await loadMerger();
  const trustedA = [finding({ findingId: "trusted-a", role: "lead-game-designer" })];
  const trustedB = [finding({ findingId: "trusted-b", role: "lead-game-designer" })];
  const candidate = mergeRoleFindings({ schemaVersion: 1, findings: trustedA });
  let reads = 0;
  const options = {};
  Object.defineProperty(options, "trustedSourceFindings", {
    enumerable: true,
    get() {
      reads += 1;
      return reads === 1 ? trustedA : trustedB;
    },
  });
  assert.throws(
    () => verifyMergedRoleFindings(candidate, options),
    /accessor|data-only|descriptor/iu,
  );
  assert.equal(reads, 0, "the trust-boundary getter must never execute");
});

test("raw finding getter cannot change medium into an unauthorized blocker after validation", async () => {
  const { mergeRoleFindings } = await loadMerger();
  const source = finding({
    findingId: "severity-swap",
    role: "ux-accessibility-reviewer",
    applicableGate: "scope-control",
  });
  let reads = 0;
  Object.defineProperty(source, "severity", {
    enumerable: true,
    get() {
      reads += 1;
      return reads < 4 ? "medium" : "blocker";
    },
  });
  assert.throws(
    () => mergeRoleFindings({ schemaVersion: 1, findings: [source] }),
    /accessor|data-only|descriptor/iu,
  );
  assert.equal(reads, 0, "nested finding getter must never execute");
});

test("all merge and verification inputs enforce a strict data-only JSON boundary", async () => {
  const { mergeRoleFindings, verifyMergedRoleFindings } = await loadMerger();
  const source = finding({ findingId: "data-boundary", role: "lead-game-designer" });
  const validRaw = { schemaVersion: 1, findings: [source] };
  const candidate = mergeRoleFindings(validRaw);

  const nonEnumerable = structuredClone(validRaw);
  Object.defineProperty(nonEnumerable, "hidden", { value: true, enumerable: false });

  const symbolKey = structuredClone(validRaw);
  symbolKey[Symbol("hidden")] = true;

  const nestedAccessor = structuredClone(validRaw);
  Object.defineProperty(nestedAccessor.findings[0], "summary", {
    enumerable: true,
    get: () => "Accessor summary.",
  });

  const customPrototype = structuredClone(validRaw);
  Object.setPrototypeOf(customPrototype.findings[0], { inherited: true });

  const sparseArray = structuredClone(validRaw);
  sparseArray.findings.length = 2;

  const extendedArray = structuredClone(validRaw);
  extendedArray.findings.extra = true;

  const recursive = structuredClone(validRaw);
  recursive.findings[0].impact = recursive;

  for (const invalid of [
    nonEnumerable,
    symbolKey,
    nestedAccessor,
    customPrototype,
    sparseArray,
    extendedArray,
    recursive,
  ]) assert.throws(
    () => mergeRoleFindings(invalid),
    /data-only|accessor|symbol|enumerable|prototype|sparse|array|recursive|reference/iu,
  );

  const candidateWithHidden = structuredClone(candidate);
  Object.defineProperty(candidateWithHidden, "hidden", { value: true, enumerable: false });
  assert.throws(
    () => verifyMergedRoleFindings(candidateWithHidden, { trustedSourceFindings: [source] }),
    /data-only|enumerable/iu,
  );
});

test("CLI is stdin-only and executes through a symlinked Korean and spaced path", async () => {
  const script = path.join(pluginRoot, mergerRelativePath);
  const payload = JSON.stringify({ schemaVersion: 1, findings: [finding({ findingId: "f-1", role: "lead-game-designer" })] });
  const direct = spawnSync(process.execPath, [script], { input: payload, encoding: "utf8" });
  assert.equal(direct.status, 0, direct.stderr);
  assert.equal(direct.stderr, "");
  assert.equal(JSON.parse(direct.stdout).findings[0].findingId, "f-1");
  const pathArg = spawnSync(process.execPath, [script, "../../artifact.json"], { input: payload, encoding: "utf8" });
  assert.equal(pathArg.status, 1);
  assert.equal(pathArg.stdout, "");
  assert.match(pathArg.stderr, /stdin JSON only/iu);

  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "studio-role-link-"));
  try {
    const alias = path.join(tempRoot, "검토 도구 링크.mjs");
    await symlink(script, alias);
    const linked = spawnSync(process.execPath, [alias], { input: payload, encoding: "utf8" });
    assert.equal(linked.status, 0, linked.stderr);
    assert.equal(linked.stderr, "");
    assert.equal(linked.stdout, direct.stdout);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
