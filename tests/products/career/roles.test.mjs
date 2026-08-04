import assert from "node:assert/strict";
import { access, mkdtemp, readFile, rm, symlink } from "node:fs/promises";
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

test("decision identities structurally encode tuple boundaries and remain permutation-stable", async () => {
  const { mergeRoleFindings } = await loadMerger();
  const tupleFindings = [
    finding({ findingId: "f-1a", role: "career-strategist", evidenceGapId: "a", artifactSectionId: "b:c", findingType: "d", minimumRepair: "Repair 1A." }),
    finding({ findingId: "f-1b", role: "game-design-mentor", evidenceGapId: "a", artifactSectionId: "b:c", findingType: "d", minimumRepair: "Repair 1B." }),
    finding({ findingId: "f-2a", role: "portfolio-reviewer", evidenceGapId: "a:b", artifactSectionId: "c", findingType: "d", minimumRepair: "Repair 2A." }),
    finding({ findingId: "f-2b", role: "evidence-auditor", evidenceGapId: "a:b", artifactSectionId: "c", findingType: "d", minimumRepair: "Repair 2B." }),
    finding({ findingId: "f-3a", role: "career-strategist", evidenceGapId: "a/b", artifactSectionId: "c%d", findingType: "type-\"quoted\"", minimumRepair: "Repair 3A." }),
    finding({ findingId: "f-3b", role: "interview-coach", evidenceGapId: "a/b", artifactSectionId: "c%d", findingType: "type-\"quoted\"", minimumRepair: "Repair 3B." }),
    finding({ findingId: "f-4a", role: "reverse-design-critic", evidenceGapId: "경력", artifactSectionId: "섹션", findingType: "유형", minimumRepair: "Repair 4A." }),
    finding({ findingId: "f-4b", role: "evidence-auditor", evidenceGapId: "경력", artifactSectionId: "섹션", findingType: "유형", minimumRepair: "Repair 4B." }),
  ];
  const forward = mergeRoleFindings({ schemaVersion: 1, findings: tupleFindings });
  const reversed = mergeRoleFindings({ schemaVersion: 1, findings: [...tupleFindings].reverse() });
  assert.equal(forward.decisions.length, 4);
  assert.equal(new Set(forward.decisions.map(({ decisionId }) => decisionId)).size, 4);
  for (const { decisionId } of forward.decisions) {
    assert.match(decisionId, /^decision:sha256:[0-9a-f]{64}$/u);
  }
  assert.deepEqual(reversed, forward);
  assert.deepEqual(mergeRoleFindings(forward), forward);
});

test("every decision tuple component rejects an empty boundary", async () => {
  const { mergeRoleFindings } = await loadMerger();
  const base = finding({ findingId: "f-empty", role: "career-strategist" });
  for (const invalid of [
    { ...base, evidenceGapId: "" },
    { ...base, artifactSectionId: "" },
    { ...base, findingType: "" },
  ]) assert.throws(() => mergeRoleFindings({ schemaVersion: 1, findings: [invalid] }), /non-empty/iu);
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

test("duplicate finding IDs fail closed instead of leaving a comparator tie", async () => {
  const { mergeRoleFindings } = await loadMerger();
  const duplicates = [
    finding({ findingId: "duplicate-id", role: "career-strategist", evidenceIds: ["evidence-a"] }),
    finding({ findingId: "duplicate-id", role: "portfolio-reviewer", evidenceIds: ["evidence-b"] }),
  ];
  assert.throws(() => mergeRoleFindings({ schemaVersion: 1, findings: duplicates }), /duplicate.*findingId/iu);
  assert.throws(() => mergeRoleFindings({ schemaVersion: 1, findings: [...duplicates].reverse() }), /duplicate.*findingId/iu);
});

test("control characters cannot collide structural conflict tuples", async () => {
  const { mergeRoleFindings } = await loadMerger();
  const collision = [
    finding({
      findingId: "f-a",
      role: "career-strategist",
      evidenceGapId: "gap-a",
      artifactSectionId: "section-b\u0000type-c",
      findingType: "type-d",
    }),
    finding({
      findingId: "f-b",
      role: "portfolio-reviewer",
      evidenceGapId: "gap-a\u0000section-b",
      artifactSectionId: "type-c",
      findingType: "type-d",
      minimumRepair: "Preserve this distinct tuple.",
    }),
  ];
  assert.throws(
    () => mergeRoleFindings({ schemaVersion: 1, findings: collision }),
    /control character/iu,
  );
});

test("non-NFC identifiers and comparison strings fail closed", async () => {
  const { mergeRoleFindings } = await loadMerger();
  const nfd = "Cafe\u0301";
  assert.notEqual(nfd, nfd.normalize("NFC"));
  for (const invalid of [
    { ...finding({ findingId: "f-1", role: "career-strategist" }), evidenceGapId: nfd },
    { ...finding({ findingId: "f-1", role: "career-strategist" }), summary: nfd },
    { ...finding({ findingId: "f-1", role: "career-strategist" }), evidenceIds: [nfd] },
  ]) assert.throws(
    () => mergeRoleFindings({ schemaVersion: 1, findings: [invalid] }),
    /NFC/iu,
  );
});

test("provenance is generated by the merger and forged canonical provenance fails closed", async () => {
  const { mergeRoleFindings } = await loadMerger();
  const rawWithProvenance = {
    ...finding({ findingId: "forged", role: "evidence-auditor" }),
    provenance: [{ findingId: "forged", role: "career-strategist" }],
  };
  assert.throws(
    () => mergeRoleFindings({ schemaVersion: 1, findings: [rawWithProvenance] }),
    /provenance.*output/iu,
  );

  const valid = mergeRoleFindings({
    schemaVersion: 1,
    findings: [finding({ findingId: "f-1", role: "career-strategist" })],
  });
  const forgedOutput = structuredClone(valid);
  forgedOutput.findings[0].findingId = "forged-canonical";
  assert.throws(() => mergeRoleFindings(forgedOutput), /canonical|provenance/iu);
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

test("CLI executes through a symlinked non-ASCII ancestor and remains stdout-only", async () => {
  const script = path.join(pluginRoot, mergeRelativePath);
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "career-role-link-"));
  try {
    const alias = path.join(tempRoot, "검토 도구 링크.mjs");
    await symlink(script, alias);
    const payload = JSON.stringify({
      schemaVersion: 1,
      findings: [finding({ findingId: "f-1", role: "career-strategist" })],
    });
    const first = spawnSync(process.execPath, [alias], { input: payload, encoding: "utf8" });
    const second = spawnSync(process.execPath, [alias], { input: payload, encoding: "utf8" });
    for (const result of [first, second]) {
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stderr, "");
      assert.equal(JSON.parse(result.stdout).findings[0].findingId, "f-1");
    }
    assert.equal(first.stdout, second.stdout);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
