#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const routing = JSON.parse(readFileSync(new URL("../../../references/routing.json", import.meta.url), "utf8"));
const rolePriority = routing.rolePriority;
if (!Array.isArray(rolePriority) || JSON.stringify(rolePriority) !== JSON.stringify(routing.roleIds)) {
  throw new Error("routing.json must define matching authoritative roleIds and rolePriority arrays.");
}

const severityOrder = ["blocker", "high", "medium", "low"];
const gateIds = new Set([
  "ai-rights-human-approval",
  "accessibility",
  "economy-transparency",
  "liveops-experiment",
  "ugc-safety",
  "ai-npc-safety",
  "scope-control",
]);
const blockerGateByRole = new Map([
  ["lead-game-designer", "scope-control"],
  ["system-economy-designer", "economy-transparency"],
  ["content-narrative-designer", "ai-rights-human-approval"],
  ["ux-accessibility-reviewer", "accessibility"],
  ["liveops-data-designer", "liveops-experiment"],
  ["production-feasibility-critic", "scope-control"],
]);
const roleRank = new Map(rolePriority.map((role, index) => [role, index]));
const severityRank = new Map(severityOrder.map((severity, index) => [severity, index]));
const inputKeys = ["schemaVersion", "findings"];
const outputKeys = ["schemaVersion", "findings", "decisions"];
const findingKeys = [
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
const mergedFindingKeys = [...findingKeys, "provenance"];
const provenanceKeys = ["findingId", "role"];

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function assertExactKeys(value, expectedKeys, label) {
  if (!isPlainObject(value)) throw new Error(`${label} must be a plain JSON object.`);
  const actual = Object.keys(value).sort(compareText);
  const expected = [...expectedKeys].sort(compareText);
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new Error(`${label} has an unknown or missing field.`);
  }
}

function assertNonEmptyString(value, label) {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${label} must be a non-empty string.`);
  if (/[\u0000-\u001f\u007f]/u.test(value)) throw new Error(`${label} must not contain a control character.`);
  if (value !== value.normalize("NFC")) throw new Error(`${label} must use Unicode NFC.`);
}

function validateStringArray(value, label) {
  if (!Array.isArray(value) || value.length === 0) throw new Error(`${label} must be a non-empty array.`);
  const seen = new Set();
  for (const [index, item] of value.entries()) {
    assertNonEmptyString(item, `${label}[${index}]`);
    if (seen.has(item)) throw new Error(`${label} must contain unique values.`);
    seen.add(item);
  }
}

function validateProvenance(value, label) {
  if (!Array.isArray(value) || value.length === 0) throw new Error(`${label} must be a non-empty array.`);
  const seen = new Set();
  for (const [index, source] of value.entries()) {
    assertExactKeys(source, provenanceKeys, `${label}[${index}]`);
    assertNonEmptyString(source.findingId, `${label}[${index}].findingId`);
    assertNonEmptyString(source.role, `${label}[${index}].role`);
    if (!roleRank.has(source.role)) throw new Error(`${label}[${index}].role is unknown.`);
    const identity = JSON.stringify([source.findingId, source.role]);
    if (seen.has(identity)) throw new Error(`${label} contains duplicate provenance.`);
    seen.add(identity);
  }
}

function validateFinding(value, index, { outputMode }) {
  const label = `findings[${index}]`;
  const hasProvenance = isPlainObject(value) && Object.hasOwn(value, "provenance");
  if (!outputMode && hasProvenance) throw new Error(`${label}.provenance is merger output only.`);
  if (outputMode && !hasProvenance) throw new Error(`${label}.provenance is required for canonical output.`);
  assertExactKeys(value, outputMode ? mergedFindingKeys : findingKeys, label);
  for (const key of [
    "findingId",
    "role",
    "severity",
    "affectedSectionId",
    "findingType",
    "summary",
    "impact",
    "applicableGate",
    "minimalFix",
  ]) assertNonEmptyString(value[key], `${label}.${key}`);
  if (!roleRank.has(value.role)) throw new Error(`${label}.role is unknown.`);
  if (!severityRank.has(value.severity)) throw new Error(`${label}.severity is unknown.`);
  if (value.applicableGate !== "none" && !gateIds.has(value.applicableGate)) {
    throw new Error(`${label}.applicableGate is unknown.`);
  }
  if (value.severity === "blocker" && blockerGateByRole.get(value.role) !== value.applicableGate) {
    throw new Error(`${label} exceeds the role's blocker authority.`);
  }
  validateStringArray(value.evidenceIds, `${label}.evidenceIds`);
  validateStringArray(value.assumptions, `${label}.assumptions`);
  if (outputMode) validateProvenance(value.provenance, `${label}.provenance`);
}

function normalizeStrings(values) {
  return [...values].sort(compareText);
}

function normalizedFinding(finding) {
  return {
    ...finding,
    evidenceIds: normalizeStrings(finding.evidenceIds),
    assumptions: normalizeStrings(finding.assumptions),
  };
}

function normalizedSources(finding) {
  const sources = finding.provenance ?? [{ findingId: finding.findingId, role: finding.role }];
  return [...sources].sort((left, right) => (
    roleRank.get(left.role) - roleRank.get(right.role)
    || compareText(left.findingId, right.findingId)
  ));
}

function duplicateKey(finding) {
  return JSON.stringify([
    finding.severity,
    finding.affectedSectionId,
    finding.findingType,
    finding.summary,
    finding.evidenceIds,
    finding.impact,
    finding.assumptions,
    finding.applicableGate,
    finding.minimalFix,
  ]);
}

function findingComparator(left, right) {
  return severityRank.get(left.severity) - severityRank.get(right.severity)
    || compareText(left.affectedSectionId, right.affectedSectionId)
    || roleRank.get(left.role) - roleRank.get(right.role)
    || compareText(left.findingType, right.findingType)
    || compareText(left.summary, right.summary)
    || compareText(left.impact, right.impact)
    || compareText(left.applicableGate, right.applicableGate)
    || compareText(left.minimalFix, right.minimalFix)
    || compareText(left.findingId, right.findingId);
}

function mergeDuplicates(findings) {
  const groups = new Map();
  for (const rawFinding of findings) {
    const finding = normalizedFinding(rawFinding);
    const key = duplicateKey(finding);
    const group = groups.get(key) ?? [];
    group.push(finding);
    groups.set(key, group);
  }

  const merged = [];
  for (const group of groups.values()) {
    const provenanceByIdentity = new Map();
    for (const finding of group) {
      for (const source of normalizedSources(finding)) {
        provenanceByIdentity.set(JSON.stringify([source.findingId, source.role]), source);
      }
    }
    const provenance = [...provenanceByIdentity.values()].sort((left, right) => (
      roleRank.get(left.role) - roleRank.get(right.role)
      || compareText(left.findingId, right.findingId)
    ));
    const source = provenance[0];
    const exemplar = group[0];
    merged.push({
      findingId: source.findingId,
      role: source.role,
      severity: exemplar.severity,
      affectedSectionId: exemplar.affectedSectionId,
      findingType: exemplar.findingType,
      summary: exemplar.summary,
      evidenceIds: exemplar.evidenceIds,
      impact: exemplar.impact,
      assumptions: exemplar.assumptions,
      applicableGate: exemplar.applicableGate,
      minimalFix: exemplar.minimalFix,
      provenance,
    });
  }
  return merged.sort(findingComparator);
}

function conflictTuple(finding) {
  return [finding.affectedSectionId, finding.findingType, finding.applicableGate];
}

function decisionId(tuple) {
  return `decision:sha256:${createHash("sha256").update(JSON.stringify(tuple), "utf8").digest("hex")}`;
}

function buildDecisions(findings) {
  const groups = new Map();
  for (const finding of findings) {
    const tuple = conflictTuple(finding);
    const key = JSON.stringify(tuple);
    const group = groups.get(key) ?? { tuple, findings: [] };
    group.findings.push(finding);
    groups.set(key, group);
  }

  const decisions = [];
  for (const { tuple, findings: group } of groups.values()) {
    const byRecommendation = new Map();
    for (const finding of group) {
      const key = JSON.stringify([finding.minimalFix, finding.assumptions]);
      const item = byRecommendation.get(key) ?? {
        minimalFix: finding.minimalFix,
        assumptions: finding.assumptions,
        provenance: [],
      };
      item.provenance.push(...finding.provenance);
      byRecommendation.set(key, item);
    }
    if (byRecommendation.size < 2) continue;
    const recommendations = [...byRecommendation.values()].map((recommendation) => ({
      ...recommendation,
      provenance: [...new Map(recommendation.provenance.map((source) => [
        JSON.stringify([source.findingId, source.role]),
        source,
      ])).values()].sort((left, right) => (
        roleRank.get(left.role) - roleRank.get(right.role)
        || compareText(left.findingId, right.findingId)
      )),
    })).sort((left, right) => (
      roleRank.get(left.provenance[0].role) - roleRank.get(right.provenance[0].role)
      || compareText(left.minimalFix, right.minimalFix)
      || compareText(JSON.stringify(left.assumptions), JSON.stringify(right.assumptions))
    ));
    decisions.push({
      decisionId: decisionId(tuple),
      affectedSectionId: tuple[0],
      findingType: tuple[1],
      applicableGate: tuple[2],
      status: "human-decision-required",
      assumptions: [...new Set(recommendations.flatMap(({ assumptions }) => assumptions))].sort(compareText),
      recommendations,
    });
  }
  return decisions.sort((left, right) => (
    compareText(left.affectedSectionId, right.affectedSectionId)
    || compareText(left.findingType, right.findingType)
    || compareText(left.applicableGate, right.applicableGate)
    || compareText(left.decisionId, right.decisionId)
  ));
}

export function mergeRoleFindings(input) {
  const outputMode = isPlainObject(input) && Object.hasOwn(input, "decisions");
  assertExactKeys(input, outputMode ? outputKeys : inputKeys, "input");
  if (input.schemaVersion !== 1) throw new Error("input.schemaVersion must be 1.");
  if (!Array.isArray(input.findings)) throw new Error("input.findings must be an array.");
  input.findings.forEach((finding, index) => validateFinding(finding, index, { outputMode }));

  const sourceIds = new Set();
  for (const finding of input.findings) {
    const sources = outputMode ? finding.provenance : [{ findingId: finding.findingId, role: finding.role }];
    for (const source of sources) {
      if (sourceIds.has(source.findingId)) throw new Error(`Duplicate findingId: ${source.findingId}`);
      sourceIds.add(source.findingId);
    }
  }

  const findings = mergeDuplicates(input.findings);
  const decisions = buildDecisions(findings);
  if (outputMode && JSON.stringify(input.findings) !== JSON.stringify(findings)) {
    throw new Error("input.findings is not canonical merger output or has forged provenance.");
  }
  if (outputMode && JSON.stringify(input.decisions) !== JSON.stringify(decisions)) {
    throw new Error("input.decisions does not match canonical decisions.");
  }
  return { schemaVersion: 1, findings, decisions };
}

async function runCli() {
  if (process.argv.length !== 2) throw new Error("This CLI accepts stdin JSON only; positional paths are not allowed.");
  let source = "";
  for await (const chunk of process.stdin) source += chunk;
  const result = mergeRoleFindings(JSON.parse(source));
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
let invokedDirectly = false;
if (invokedPath) {
  try {
    invokedDirectly = realpathSync(invokedPath) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    invokedDirectly = false;
  }
}
if (invokedDirectly) {
  runCli().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
