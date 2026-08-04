import assert from "node:assert/strict";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { pathToFileURL, fileURLToPath } from "node:url";

import { buildProduct } from "../../../tooling/lib/build-product.mjs";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const pluginRoot = path.join(repoRoot, "products/game-design-career/plugin");
const mergeRelativePath = "skills/orchestrate-game-design-career/scripts/merge-role-findings.mjs";
const roles = [
  "career-strategist",
  "game-design-mentor",
  "portfolio-reviewer",
  "reverse-design-critic",
  "interview-coach",
  "evidence-auditor",
];

const roleSpecialization = {
  "career-strategist": ["tradeoff", "non-generalization"],
  "game-design-mentor": ["learning", "artifact"],
  "portfolio-reviewer": ["inspectable", "competency evidence"],
  "reverse-design-critic": ["fact", "inference"],
  "interview-coach": ["unsupported claim", "honest answer"],
  "evidence-auditor": ["stale", "missing", "generalized", "non-primary"],
};

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
    "Finding Schema",
    "Completion Signal",
  ]) section(markdown, heading);
  const requiredInput = section(markdown, "Required Evidence and Input");
  for (const envelopeField of ["artifact", "role", "questions", "findingsPath"]) {
    assert.match(requiredInput, new RegExp(`\`${envelopeField}\``, "u"), `${role}: missing envelope ${envelopeField}`);
  }
  assert.match(markdown, /write.*findingsPath/isu);
  assert.deepEqual(findingFields(markdown), [
    "findingId",
    "role",
    "severity",
    "evidenceGapId",
    "artifactSectionId",
    "findingType",
    "summary",
    "evidenceIds",
    "minimumRepair",
  ]);
  assert.match(markdown, /`blocker` > `high` > `medium` > `low`/u);
  assert.match(markdown, /stable.*evidenceGapId.*artifactSectionId/isu);
  assert.match(markdown, /finding.*minimum repair/isu);
  assert.match(markdown, /do not rewrite.*portfolio/isu);
  assert.match(markdown, /do not invent.*candidate narrative/isu);
  for (const phrase of roleSpecialization[role]) {
    assert.match(markdown, new RegExp(phrase, "iu"), `${role}: missing specialization ${phrase}`);
  }
}

async function loadMerger() {
  const url = pathToFileURL(path.join(pluginRoot, mergeRelativePath));
  return import(`${url.href}?test=${Date.now()}-${Math.random()}`);
}

function finding({
  findingId,
  role,
  severity = "medium",
  evidenceGapId = "gap-1",
  artifactSectionId = "section-1",
  findingType = "unsupported-claim",
  summary = "Claim is not inspectable.",
  evidenceIds = ["evidence-1"],
  minimumRepair = "Link the claim to evidence.",
}) {
  return {
    findingId,
    role,
    severity,
    evidenceGapId,
    artifactSectionId,
    findingType,
    summary,
    evidenceIds,
    minimumRepair,
  };
}

function permutations(items) {
  if (items.length < 2) return [items];
  return items.flatMap((item, index) => permutations([
    ...items.slice(0, index),
    ...items.slice(index + 1),
  ]).map((tail) => [item, ...tail]));
}

test("all six bounded role prompts define the exact review contract", async () => {
  for (const role of roles) {
    assertRolePromptContract(role, await readPlugin(`agents/${role}.md`));
  }
});

test("role prompt mutation guard detects missing contract sections, fields, and boundaries", async () => {
  for (const role of roles) {
    const markdown = await readPlugin(`agents/${role}.md`);
    for (const mutation of [
      markdown.replace("## Required Evidence and Input", "## Inputs"),
      markdown.replace("| `minimumRepair` |", "| `repair` |"),
      markdown.replace(/do not rewrite.*portfolio/iu, "improve the portfolio"),
      markdown.replace(new RegExp(roleSpecialization[role][0], "giu"), "generic review"),
    ]) assert.throws(() => assertRolePromptContract(role, mutation), undefined, `${role} mutation survived`);
  }
});

test("merge script is bundled with the orchestrator and never occupies reserved top-level scripts", async () => {
  await assert.doesNotReject(access(path.join(pluginRoot, mergeRelativePath)));
  await assert.rejects(access(path.join(pluginRoot, "scripts/merge-role-findings.mjs")), { code: "ENOENT" });

  const stagingRoot = await mkdtemp(path.join(os.tmpdir(), "career-roles-build-"));
  try {
    const build = await buildProduct({
      repoRoot,
      productName: "game-design-career",
      stagingRoot,
      sourceDateEpoch: 0,
    });
    assert.ok(build.files.includes(mergeRelativePath));
    assert.ok(!build.files.includes("scripts/merge-role-findings.mjs"));
  } finally {
    await rm(stagingRoot, { recursive: true, force: true });
  }
});

test("merge order is total, deterministic across permutations, and idempotent", async () => {
  const { mergeRoleFindings } = await loadMerger();
  const input = [
    finding({ findingId: "f-low", role: "evidence-auditor", severity: "low", evidenceGapId: "gap-z" }),
    finding({ findingId: "f-role-late", role: "portfolio-reviewer", severity: "high", evidenceGapId: "gap-a", artifactSectionId: "section-a", summary: "Late role summary." }),
    finding({ findingId: "f-role-first", role: "career-strategist", severity: "high", evidenceGapId: "gap-a", artifactSectionId: "section-a" }),
    finding({ findingId: "f-section", role: "career-strategist", severity: "high", evidenceGapId: "gap-a", artifactSectionId: "section-b" }),
    finding({ findingId: "f-blocker", role: "game-design-mentor", severity: "blocker", evidenceGapId: "gap-z" }),
    finding({ findingId: "f-stable-z", role: "career-strategist", severity: "medium", evidenceGapId: "gap-m", artifactSectionId: "section-m", summary: "Z summary" }),
    finding({ findingId: "f-stable-a", role: "career-strategist", severity: "medium", evidenceGapId: "gap-m", artifactSectionId: "section-m", summary: "A summary" }),
  ];
  const expectedIds = [
    "f-blocker",
    "f-role-first",
    "f-role-late",
    "f-section",
    "f-stable-a",
    "f-stable-z",
    "f-low",
  ];
  const selected = input.slice(0, 6);
  const outputs = permutations(selected).map((items) => mergeRoleFindings({ schemaVersion: 1, findings: [...items, input[6]] }));
  assert.equal(outputs.length, 720);
  for (const output of outputs) {
    assert.deepEqual(output.findings.map(({ findingId }) => findingId), expectedIds);
    assert.deepEqual(output, outputs[0]);
  }
  assert.deepEqual(mergeRoleFindings(outputs[0]), outputs[0]);
});

test("exact duplicates merge provenance while conflicting repairs remain explicit decisions", async () => {
  const { mergeRoleFindings } = await loadMerger();
  const duplicateA = finding({ findingId: "f-1", role: "portfolio-reviewer" });
  const duplicateB = finding({ findingId: "f-2", role: "evidence-auditor" });
  const conflict = finding({
    findingId: "f-3",
    role: "career-strategist",
    minimumRepair: "Remove the claim until evidence exists.",
  });
  const result = mergeRoleFindings({ schemaVersion: 1, findings: [duplicateB, conflict, duplicateA] });
  assert.equal(result.findings.length, 2);
  const merged = result.findings.find(({ minimumRepair }) => minimumRepair === duplicateA.minimumRepair);
  assert.deepEqual(merged.provenance, [
    { findingId: "f-1", role: "portfolio-reviewer" },
    { findingId: "f-2", role: "evidence-auditor" },
  ]);
  assert.equal(result.decisions.length, 1);
  assert.deepEqual(result.decisions[0].recommendations, [
    {
      minimumRepair: "Remove the claim until evidence exists.",
      provenance: [{ findingId: "f-3", role: "career-strategist" }],
    },
    {
      minimumRepair: "Link the claim to evidence.",
      provenance: [
        { findingId: "f-1", role: "portfolio-reviewer" },
        { findingId: "f-2", role: "evidence-auditor" },
      ],
    },
  ]);
});

test("different findings in one section are not mislabeled as conflicting recommendations", async () => {
  const { mergeRoleFindings } = await loadMerger();
  const result = mergeRoleFindings({
    schemaVersion: 1,
    findings: [
      finding({ findingId: "f-1", role: "portfolio-reviewer", findingType: "missing-evidence" }),
      finding({
        findingId: "f-2",
        role: "evidence-auditor",
        findingType: "stale-evidence",
        summary: "The cited source is stale.",
        minimumRepair: "Refresh the primary source.",
      }),
    ],
  });
  assert.deepEqual(result.decisions, []);
});

test("merger fails closed on unknown roles, severities, malformed records, and dangerous keys", async () => {
  const { mergeRoleFindings } = await loadMerger();
  const base = finding({ findingId: "f-1", role: "career-strategist" });
  for (const invalid of [
    { ...base, role: "unknown-role" },
    { ...base, severity: "critical" },
    { ...base, evidenceGapId: "" },
    { ...base, evidenceIds: [""] },
    { ...base, extra: true },
    { ...base, minimumRepair: "" },
  ]) assert.throws(() => mergeRoleFindings({ schemaVersion: 1, findings: [invalid] }));
  assert.throws(() => mergeRoleFindings(JSON.parse('{"schemaVersion":1,"findings":[],"__proto__":{}}')));
  assert.throws(() => mergeRoleFindings({ schemaVersion: 2, findings: [] }));
  assert.throws(() => mergeRoleFindings(null));
});

test("CLI accepts stdin JSON only and rejects path-like positional arguments", async () => {
  const script = path.join(pluginRoot, mergeRelativePath);
  const payload = JSON.stringify({
    schemaVersion: 1,
    findings: [finding({ findingId: "f-1", role: "career-strategist" })],
  });
  const success = spawnSync(process.execPath, [script], { input: payload, encoding: "utf8" });
  assert.equal(success.status, 0, success.stderr);
  assert.equal(success.stderr, "");
  assert.deepEqual(JSON.parse(success.stdout).findings.map(({ findingId }) => findingId), ["f-1"]);

  const pathArgument = spawnSync(process.execPath, [script, "../../portfolio.json"], {
    input: payload,
    encoding: "utf8",
  });
  assert.equal(pathArgument.status, 1);
  assert.equal(pathArgument.stdout, "");
  assert.match(pathArgument.stderr, /stdin JSON only/iu);
});
