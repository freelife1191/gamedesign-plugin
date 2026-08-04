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
  const { mergeRoleFindings } = await loadMerger();
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
  assert.deepEqual(mergeRoleFindings(outputs[0]), outputs[0]);
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
  const { mergeRoleFindings } = await loadMerger();
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
  const { mergeRoleFindings } = await loadMerger();
  const duplicateId = [
    finding({ findingId: "same", role: "lead-game-designer" }),
    finding({ findingId: "same", role: "ux-accessibility-reviewer", evidenceIds: ["evidence-2"] }),
  ];
  assert.throws(() => mergeRoleFindings({ schemaVersion: 1, findings: duplicateId }), /duplicate.*findingId/iu);
  const valid = mergeRoleFindings({ schemaVersion: 1, findings: [finding({ findingId: "f-1", role: "lead-game-designer" })] });
  const forged = structuredClone(valid);
  forged.findings[0].findingId = "forged";
  assert.throws(() => mergeRoleFindings(forged), /canonical|provenance/iu);
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
