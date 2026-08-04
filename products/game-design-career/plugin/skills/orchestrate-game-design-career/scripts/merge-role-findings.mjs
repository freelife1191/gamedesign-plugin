#!/usr/bin/env node

import { readFileSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const registry = JSON.parse(readFileSync(
  new URL("../../../references/career-stages.json", import.meta.url),
  "utf8",
));
const rolePriority = registry.reviewDispatch.rolePriority;
const severityOrder = registry.reviewDispatch.severityOrder;
const roleRank = new Map(rolePriority.map((role, index) => [role, index]));
const severityRank = new Map(severityOrder.map((severity, index) => [severity, index]));
const inputKeys = ["schemaVersion", "findings"];
const outputKeys = ["schemaVersion", "findings", "decisions"];
const findingKeys = [
  "findingId",
  "role",
  "severity",
  "evidenceGapId",
  "artifactSectionId",
  "findingType",
  "summary",
  "evidenceIds",
  "minimumRepair",
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

function assertExactKeys(value, allowed, label) {
  if (!isPlainObject(value)) throw new Error(`${label} must be a plain JSON object.`);
  const actual = Object.keys(value).sort();
  const expected = [...allowed].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new Error(`${label} has an unknown or missing field.`);
  }
}

function assertNonEmptyString(value, label) {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${label} must be a non-empty string.`);
  if (/[\u0000-\u001f\u007f]/u.test(value)) throw new Error(`${label} must not contain a control character.`);
  if (value !== value.normalize("NFC")) throw new Error(`${label} must use Unicode NFC.`);
}

function validateProvenance(provenance, label) {
  if (!Array.isArray(provenance) || provenance.length === 0) {
    throw new Error(`${label} must be a non-empty array.`);
  }
  const seen = new Set();
  for (const [index, source] of provenance.entries()) {
    assertExactKeys(source, provenanceKeys, `${label}[${index}]`);
    assertNonEmptyString(source.findingId, `${label}[${index}].findingId`);
    assertNonEmptyString(source.role, `${label}[${index}].role`);
    if (!roleRank.has(source.role)) throw new Error(`${label}[${index}].role is unknown.`);
    const key = JSON.stringify([source.role, source.findingId]);
    if (seen.has(key)) throw new Error(`${label} contains duplicate provenance.`);
    seen.add(key);
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
    "evidenceGapId",
    "artifactSectionId",
    "findingType",
    "summary",
    "minimumRepair",
  ]) assertNonEmptyString(value[key], `${label}.${key}`);
  assertNonEmptyString(value.role, `${label}.role`);
  assertNonEmptyString(value.severity, `${label}.severity`);
  if (!roleRank.has(value.role)) throw new Error(`${label}.role is unknown.`);
  if (!severityRank.has(value.severity)) throw new Error(`${label}.severity is unknown.`);
  if (!Array.isArray(value.evidenceIds) || value.evidenceIds.length === 0) {
    throw new Error(`${label}.evidenceIds must be a non-empty array.`);
  }
  const evidenceIds = new Set();
  for (const [evidenceIndex, evidenceId] of value.evidenceIds.entries()) {
    assertNonEmptyString(evidenceId, `${label}.evidenceIds[${evidenceIndex}]`);
    if (evidenceIds.has(evidenceId)) throw new Error(`${label}.evidenceIds must be unique.`);
    evidenceIds.add(evidenceId);
  }
  if (outputMode) validateProvenance(value.provenance, `${label}.provenance`);
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
    finding.evidenceGapId,
    finding.artifactSectionId,
    finding.findingType,
    finding.summary,
    [...finding.evidenceIds].sort(compareText),
    finding.minimumRepair,
  ]);
}

function findingComparator(left, right) {
  return severityRank.get(left.severity) - severityRank.get(right.severity)
    || compareText(left.evidenceGapId, right.evidenceGapId)
    || compareText(left.artifactSectionId, right.artifactSectionId)
    || roleRank.get(left.role) - roleRank.get(right.role)
    || compareText(left.findingType, right.findingType)
    || compareText(left.summary, right.summary)
    || compareText(left.minimumRepair, right.minimumRepair)
    || compareText(left.findingId, right.findingId);
}

function mergeDuplicates(findings) {
  const groups = new Map();
  for (const finding of findings) {
    const key = duplicateKey(finding);
    const group = groups.get(key) ?? [];
    group.push(finding);
    groups.set(key, group);
  }
  const merged = [];
  for (const group of groups.values()) {
    const provenanceByKey = new Map();
    for (const finding of group) {
      for (const source of normalizedSources(finding)) {
        provenanceByKey.set(JSON.stringify([source.role, source.findingId]), source);
      }
    }
    const provenance = [...provenanceByKey.values()].sort((left, right) => (
      roleRank.get(left.role) - roleRank.get(right.role)
      || compareText(left.findingId, right.findingId)
    ));
    const canonicalSource = provenance[0];
    const exemplar = group[0];
    merged.push({
      findingId: canonicalSource.findingId,
      role: canonicalSource.role,
      severity: exemplar.severity,
      evidenceGapId: exemplar.evidenceGapId,
      artifactSectionId: exemplar.artifactSectionId,
      findingType: exemplar.findingType,
      summary: exemplar.summary,
      evidenceIds: [...exemplar.evidenceIds].sort(compareText),
      minimumRepair: exemplar.minimumRepair,
      provenance,
    });
  }
  return merged.sort(findingComparator);
}

function buildDecisions(findings) {
  const groups = new Map();
  for (const finding of findings) {
    const key = JSON.stringify([
      finding.evidenceGapId,
      finding.artifactSectionId,
      finding.findingType,
    ]);
    const group = groups.get(key) ?? [];
    group.push(finding);
    groups.set(key, group);
  }
  const decisions = [];
  for (const group of groups.values()) {
    const recommendations = new Map();
    for (const finding of group) {
      const sources = recommendations.get(finding.minimumRepair) ?? [];
      sources.push(...finding.provenance);
      recommendations.set(finding.minimumRepair, sources);
    }
    if (recommendations.size < 2) continue;
    const [first] = group;
    const options = [...recommendations.entries()].map(([minimumRepair, sources]) => ({
      minimumRepair,
      provenance: [...new Map(sources.map((source) => [
        JSON.stringify([source.role, source.findingId]),
        source,
      ])).values()].sort((left, right) => (
        roleRank.get(left.role) - roleRank.get(right.role)
        || compareText(left.findingId, right.findingId)
      )),
    })).sort((left, right) => (
      roleRank.get(left.provenance[0].role) - roleRank.get(right.provenance[0].role)
      || compareText(left.minimumRepair, right.minimumRepair)
    ));
    decisions.push({
      decisionId: `decision:${first.evidenceGapId}:${first.artifactSectionId}:${first.findingType}`,
      evidenceGapId: first.evidenceGapId,
      artifactSectionId: first.artifactSectionId,
      status: "human-decision-required",
      recommendations: options,
    });
  }
  return decisions.sort((left, right) => (
    compareText(left.evidenceGapId, right.evidenceGapId)
    || compareText(left.artifactSectionId, right.artifactSectionId)
    || compareText(left.decisionId, right.decisionId)
  ));
}

export function mergeRoleFindings(input) {
  const hasDecisions = isPlainObject(input) && Object.hasOwn(input, "decisions");
  assertExactKeys(input, hasDecisions ? outputKeys : inputKeys, "input");
  if (input.schemaVersion !== 1) throw new Error("input.schemaVersion must be 1.");
  if (!Array.isArray(input.findings)) throw new Error("input.findings must be an array.");
  input.findings.forEach((finding, index) => validateFinding(finding, index, { outputMode: hasDecisions }));

  const sourceIds = new Set();
  for (const finding of input.findings) {
    const sources = hasDecisions ? finding.provenance : [{ findingId: finding.findingId, role: finding.role }];
    for (const source of sources) {
      if (sourceIds.has(source.findingId)) throw new Error(`Duplicate findingId: ${source.findingId}`);
      sourceIds.add(source.findingId);
    }
  }

  const findings = mergeDuplicates(input.findings);
  const decisions = buildDecisions(findings);
  if (hasDecisions && JSON.stringify(input.findings) !== JSON.stringify(findings)) {
    throw new Error("input.findings is not canonical merger output or has forged provenance.");
  }
  if (hasDecisions && JSON.stringify(input.decisions) !== JSON.stringify(decisions)) {
    throw new Error("input.decisions does not match the deterministic finding decisions.");
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
