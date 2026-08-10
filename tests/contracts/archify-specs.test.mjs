import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";

import { hashArchifySource, loadArchifyCatalog } from "../../tooling/lib/archify-catalog.mjs";
import { findStructuralDuplicates } from "../../tooling/lib/archify-signature.mjs";
import { resolveArchifyInstallation } from "../../shared/scripts/capability-probe.mjs";

const repoRoot = path.resolve(import.meta.dirname, "../..");
const execFile = promisify(execFileCallback);
let archifyInstallation;

function semanticNodeIds(spec) {
  return spec.nodes.map((node) => node.id).sort();
}

async function markdownHasHeading(filename, heading) {
  const source = await readFile(filename, "utf8");
  return new RegExp(`^#{1,6}\\s+${heading.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}\\s*$`, "mu").test(source);
}

async function loadProductionSpecs(repoRoot, product) {
  const catalog = await loadArchifyCatalog({ repoRoot });
  const specsById = new Map();
  for (const entry of catalog.entries.filter((item) => item.decision === "selected" && item.product === product)) {
    specsById.set(entry.id, JSON.parse(await readFile(path.join(repoRoot, entry.spec), "utf8")));
  }
  return { catalog, specsById };
}

async function validateInstalledWorkflowSpec(spec) {
  const directory = await mkdtemp(path.join(tmpdir(), "studio-archify-spec-"));
  const filename = path.join(directory, "candidate.json");
  try {
    await writeFile(filename, `${JSON.stringify(spec, null, 2)}\n`, "utf8");
    const installation = await (archifyInstallation ??= resolveArchifyInstallation(process.env));
    assert.equal(installation.status, "available", `Archify is required for this production contract (resolver status: ${installation.status}).`);
    assert.equal(typeof installation.cli?.realpath, "string", "The resolved Archify installation must provide a pinned CLI path.");
    return await execFile(process.execPath, [
      installation.cli.realpath,
      "validate",
      "workflow",
      filename,
      "--quality",
      "showcase",
      "--json",
    ]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

async function installedValidationError(spec) {
  try {
    await validateInstalledWorkflowSpec(spec);
  } catch (error) {
    return `${error.stdout ?? ""}\n${error.stderr ?? ""}`;
  }
  assert.fail("the installed workflow validator accepted an invalid candidate");
}

function studioWorkflowSpec(specsById) {
  const spec = specsById.get("studio-project-workflow");
  assert.ok(spec, "studio-project-workflow spec is required");
  return spec;
}

function careerWorkflowSpec(specsById) {
  const spec = specsById.get("career-evidence-workflow");
  assert.ok(spec, "career-evidence-workflow spec is required");
  return spec;
}

function assertEdge(spec, from, to) {
  assert.ok(spec.edges.some((edge) => edge.from === from && edge.to === to), `${from} -> ${to} is required`);
}

function assertPrimaryNodeBound(spec) {
  assert.ok(spec.nodes.length <= 12, `workflow has ${spec.nodes.length} primary nodes; at most 12 are allowed`);
}

function assertResumeReturnsToBlockedImageReview(spec) {
  const branch = spec.edges.find((edge) => edge.from === "image_asset_review" && edge.to === "resume_context");
  assert.deepEqual(branch && { role: branch.role, label: branch.label }, { role: "branch", label: "blocked" });
  const resume = spec.edges.find((edge) => edge.from === "resume_context");
  assert.deepEqual(resume && { to: resume.to, role: resume.role, label: resume.label }, {
    to: "image_asset_review",
    role: "return",
    label: "resume",
  });
  assert.equal(spec.edges.some((edge) => edge.from === "resume_context" && edge.to === "canonical_artifact"), false);
}

function assertCareerHoldResumesEvidenceResearch(spec) {
  const hold = spec.edges.find((edge) => edge.from === "evidence_research" && edge.to === "held_context");
  assert.deepEqual(hold && { role: hold.role, label: hold.label }, { role: "branch", label: "blocked" });
  const resume = spec.edges.find((edge) => edge.from === "held_context");
  assert.deepEqual(resume && { to: resume.to, role: resume.role, label: resume.label }, {
    to: "evidence_research",
    role: "return",
    label: "resume",
  });
}

test("every selected Studio entry owns one exact fresh showcase spec", async () => {
  const catalog = await loadArchifyCatalog({ repoRoot });
  const studio = catalog.entries.filter((entry) => entry.decision === "selected" && entry.product === "studio");
  for (const entry of studio) {
    const spec = JSON.parse(await readFile(path.join(repoRoot, entry.spec), "utf8"));
    assert.equal(spec.diagram_type, entry.diagram_type);
    assert.equal(spec.meta.quality_profile, "showcase");
    assert.equal(entry.visual_system, "studio");
    assert.ok(entry.composition_rationale.length >= 20);
  }
});

test("every selected Career entry owns one exact fresh showcase spec", async () => {
  const catalog = await loadArchifyCatalog({ repoRoot });
  const career = catalog.entries.filter((entry) => entry.decision === "selected" && entry.product === "career");
  for (const entry of career) {
    const spec = JSON.parse(await readFile(path.join(repoRoot, entry.spec), "utf8"));
    assert.equal(spec.diagram_type, entry.diagram_type);
    assert.equal(spec.meta.quality_profile, "showcase");
    assert.equal(entry.visual_system, "career");
    assert.match(entry.composition_rationale, /증거|검토|학습|승인|재개/u);
  }
});

test("selected Career workflow records a real schema-valid auto-validation state", async () => {
  const { catalog, specsById } = await loadProductionSpecs(repoRoot, "career");
  const entry = catalog.entries.find((item) => item.id === "career-evidence-workflow");
  const spec = careerWorkflowSpec(specsById);
  assertPrimaryNodeBound(spec);
  assert.equal(entry.delivery_status, "auto-validated");
  assert.equal(entry.visual_review, "pending");
  assert.deepEqual(entry.diagnostics, []);
  await assert.doesNotReject(() => validateInstalledWorkflowSpec(spec));
});

test("Career workflow preserves evidence, human review, disclosure, and the actual resume target", async () => {
  const { specsById } = await loadProductionSpecs(repoRoot, "career");
  const spec = careerWorkflowSpec(specsById);
  const ids = new Set(semanticNodeIds(spec));
  for (const id of [
    "stage_diagnosis",
    "disclosure_approval",
    "evidence_research",
    "evidence_project",
    "career_routes",
    "human_review",
    "export_prepare",
    "held_context",
  ]) assert.ok(ids.has(id), `${id} is required`);
  assertEdge(spec, "stage_diagnosis", "disclosure_approval");
  assertEdge(spec, "disclosure_approval", "evidence_research");
  assertEdge(spec, "evidence_research", "evidence_project");
  assertEdge(spec, "evidence_project", "career_routes");
  assertEdge(spec, "career_routes", "human_review");
  assertEdge(spec, "human_review", "export_prepare");
  assertCareerHoldResumesEvidenceResearch(spec);
  const visibleText = JSON.stringify(spec);
  assert.equal(spec.nodes.find((node) => node.id === "human_review")?.type, "external");
  assert.match(visibleText, /does not guarantee a hiring outcome/i);
  assert.doesNotMatch(visibleText, /자동\s*승인|auto\s*approval|채용\s*(결과\s*)?보장/u);
});

test("Career workflow contract rejects a resume mutation that changes the held work", async () => {
  const { specsById } = await loadProductionSpecs(repoRoot, "career");
  const spec = careerWorkflowSpec(specsById);
  const wrongResume = {
    ...spec,
    edges: spec.edges.map((edge) => edge.from === "held_context" ? { ...edge, to: "evidence_project" } : edge),
  };
  assert.throws(() => assertCareerHoldResumesEvidenceResearch(wrongResume), /evidence_research/u);
});

test("selected Studio workflow records either a validated spec or a truthful validator block", async () => {
  const { catalog, specsById } = await loadProductionSpecs(repoRoot, "studio");
  const entry = catalog.entries.find((item) => item.id === "studio-project-workflow");
  const spec = studioWorkflowSpec(specsById);
  assertPrimaryNodeBound(spec);
  if (entry.delivery_status === "auto-validated") {
    assert.equal(entry.visual_review, "pending");
    assert.deepEqual(entry.diagnostics, []);
    await assert.doesNotReject(() => validateInstalledWorkflowSpec(spec));
    return;
  }
  assert.equal(entry.delivery_status, "blocked-validation");
  assert.equal(entry.visual_review, "not-applicable");
  assert.ok(entry.diagnostics.length > 0);
  assert.match(await installedValidationError(spec), /resume_context|blocked/u);
});

test("Studio workflow preserves the source-backed vision, review, asset, export, and resume sequence", async () => {
  const { specsById } = await loadProductionSpecs(repoRoot, "studio");
  const spec = studioWorkflowSpec(specsById);
  const ids = new Set(semanticNodeIds(spec));
  for (const id of [
    "vision_approval",
    "canonical_artifact",
    "domain_design",
    "specialist_review",
    "finding_decision",
    "image_asset_plan",
    "image_asset_review",
    "format_qa_export",
    "resume_context",
  ]) assert.ok(ids.has(id), `${id} is required`);
  assertEdge(spec, "vision_approval", "canonical_artifact");
  assertEdge(spec, "canonical_artifact", "domain_design");
  assertEdge(spec, "domain_design", "specialist_review");
  assertEdge(spec, "specialist_review", "finding_decision");
  assertEdge(spec, "finding_decision", "image_asset_plan");
  assertEdge(spec, "image_asset_plan", "image_asset_review");
  assertEdge(spec, "image_asset_review", "format_qa_export");
  assertEdge(spec, "image_asset_review", "resume_context");
  assertResumeReturnsToBlockedImageReview(spec);
});

test("Studio workflow contract rejects a resume mutation that restarts the canonical document", async () => {
  const { specsById } = await loadProductionSpecs(repoRoot, "studio");
  const spec = studioWorkflowSpec(specsById);
  const wrongResume = {
    ...spec,
    edges: spec.edges.map((edge) => edge.from === "resume_context" ? { ...edge, to: "canonical_artifact" } : edge),
  };
  assert.throws(() => assertResumeReturnsToBlockedImageReview(wrongResume), /image_asset_review/u);
});

test("Studio workflow contract rejects invalid-schema and thirteen-node mutations", async () => {
  const { specsById } = await loadProductionSpecs(repoRoot, "studio");
  const spec = studioWorkflowSpec(specsById);
  const invalidSchema = { ...spec, diagram_type: "architecture" };
  const overflow = {
    ...spec,
    nodes: [
      ...spec.nodes,
      ...["a", "b", "c", "d"].map((suffix) => ({
        id: `overflow_${suffix}`,
        lane: "studio",
        col: 5,
        type: "backend",
        label: `Overflow ${suffix}`,
      })),
    ],
  };
  assert.match(await installedValidationError(invalidSchema), /schema|diagram_type/u);
  assert.throws(() => assertPrimaryNodeBound(overflow), /at most 12/u);
});

test("blocked Studio entry leaves no stale current-stage HTML or receipt", async () => {
  const catalog = await loadArchifyCatalog({ repoRoot });
  const entry = catalog.entries.find((item) => item.id === "studio-project-workflow");
  assert.equal(entry.delivery_status, "blocked-validation");
  const currentDirectory = path.join(repoRoot, ".tmp", "curated-archify", "current", entry.product);
  for (const extension of ["html", "receipt.json"]) {
    await assert.rejects(access(path.join(currentDirectory, `${entry.id}.${extension}`)), { code: "ENOENT" });
  }
});

test("Studio specs remain source-bound and do not recreate the retired six-node template", async () => {
  const { catalog, specsById } = await loadProductionSpecs(repoRoot, "studio");
  for (const entry of catalog.entries.filter((item) => item.decision === "selected" && item.product === "studio")) {
    assert.equal(await hashArchifySource(path.join(repoRoot, entry.source_document)), entry.source_digest);
    assert.equal(await markdownHasHeading(path.join(repoRoot, entry.source_document), entry.source_section), true);
    assert.notDeepEqual(semanticNodeIds(specsById.get(entry.id)), ["input", "skill", "artifact", "review", "result", "resume"]);
  }
  assert.deepEqual(findStructuralDuplicates({ catalog, specsById }), []);
});

test("Career specs remain source-bound and do not recreate the retired six-node template", async () => {
  const { catalog, specsById } = await loadProductionSpecs(repoRoot, "career");
  for (const entry of catalog.entries.filter((item) => item.decision === "selected" && item.product === "career")) {
    assert.equal(await hashArchifySource(path.join(repoRoot, entry.source_document)), entry.source_digest);
    assert.equal(await markdownHasHeading(path.join(repoRoot, entry.source_document), entry.source_section), true);
    assert.notDeepEqual(semanticNodeIds(specsById.get(entry.id)), ["input", "skill", "artifact", "review", "result", "resume"]);
  }
  assert.deepEqual(findStructuralDuplicates({ catalog, specsById }), []);
});
