import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { access, lstat, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";

import { hashArchifySource, loadArchifyCatalog } from "../../tooling/lib/archify-catalog.mjs";
import { findStructuralDuplicates } from "../../tooling/lib/archify-signature.mjs";
import { stageCuratedArchify } from "../../tooling/lib/archify-delivery.mjs";
import { sha256 } from "../../tooling/lib/hash.mjs";
import { assertNoSymlinkPath, joinWithin } from "../../tooling/lib/paths.mjs";
import { validateArchifyDeliverReceipt } from "../../tooling/lib/archify-receipt.mjs";
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

async function validateInstalledSpec(spec, type) {
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
      type,
      filename,
      "--quality",
      "showcase",
      "--json",
    ]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

async function validateInstalledWorkflowSpec(spec) {
  return validateInstalledSpec(spec, "workflow");
}

async function installedValidationError(spec, type = "workflow") {
  try {
    await validateInstalledSpec(spec, type);
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

function assertFlow(spec, from, to) {
  assert.ok(spec.flows.some((flow) => flow.from === from && flow.to === to), `${from} -> ${to} is required`);
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

function assertCareerRouteAndReviewTopology(spec) {
  const ids = new Set(semanticNodeIds(spec));
  for (const id of [
    "portfolio_case",
    "growth_experiment",
    "human_review",
  ]) assert.ok(ids.has(id), `${id} is required`);
  const branch = (from, to) => {
    const edge = spec.edges.find((item) => item.from === from && item.to === to);
    assert.equal(edge?.role, "branch", `${from} -> ${to} must be a real branch`);
  };
  assertEdge(spec, "evidence_project", "portfolio_case");
  branch("evidence_project", "growth_experiment");
  assertEdge(spec, "portfolio_case", "human_review");
  branch("growth_experiment", "human_review");
  assertEdge(spec, "human_review", "export_prepare");
  const careerRoutes = spec.cards.find((card) => card.title === "Career routes");
  assert.ok(careerRoutes?.items.some((item) => /interview/u.test(item) && item.includes("evidence IDs")), "Interview route card is required");
  const reviewLayers = spec.cards.find((card) => card.title === "Review layers");
  assert.ok(reviewLayers, "Review layers card is required");
  for (const layer of ["Content", "Evidence", "Document quality"]) {
    assert.ok(reviewLayers.items.some((item) => item.includes(layer)), `${layer} review layer is required`);
  }
}

function assertCareerSafetyLanguage(spec) {
  const visibleText = JSON.stringify(spec);
  assert.match(visibleText, /does not guarantee a hiring outcome/i);
  assert.doesNotMatch(
    visibleText,
    /approval\s+is\s+automatic|automatic\s+approval|hiring\s+is\s+guaranteed|guaranteed\s+hiring|자동\s*승인|승인이\s*자동|채용\s*보장|채용이\s*보장/iu,
  );
}

function primaryNodeCount(spec) {
  return spec.nodes.length;
}

function hasNamedProductBoundary(spec, product) {
  return spec.nodes.some((node) => node.label === `${product} boundary`);
}

function containsCompleteProductGraph(spec, product) {
  const normalized = product.toLowerCase();
  const nodeIds = new Set(semanticNodeIds(spec));
  const completeGraphs = {
    studio: [
      "vision_approval", "canonical_artifact", "domain_design", "specialist_review",
      "finding_decision", "image_asset_plan", "image_asset_review", "format_qa_export",
    ],
    career: [
      "stage_diagnosis", "disclosure_approval", "evidence_research", "evidence_project",
      "portfolio_case", "growth_experiment", "human_review", "export_prepare",
    ],
  };
  return (completeGraphs[normalized] ?? []).every((id) => nodeIds.has(id));
}

function assertSuiteHandoffSemantics(spec) {
  const ids = new Set(semanticNodeIds(spec));
  for (const id of [
    "studio_boundary", "public_evidence_summary", "decision_owner", "career_boundary",
    "career_portfolio_input", "held_handoff", "resume_receipt",
  ]) assert.ok(ids.has(id), `${id} is required`);
  assertFlow(spec, "studio_boundary", "public_evidence_summary");
  assertFlow(spec, "public_evidence_summary", "decision_owner");
  assertFlow(spec, "decision_owner", "career_boundary");
  assertFlow(spec, "career_boundary", "career_portfolio_input");
  assert.equal(spec.nodes.find((node) => node.id === "decision_owner")?.type, "external");
  const hold = spec.flows.find((flow) => flow.from === "decision_owner" && flow.to === "held_handoff");
  assert.equal(hold?.classification, "hold");
  assertFlow(spec, "held_handoff", "resume_receipt");
  const resume = spec.flows.find((flow) => flow.from === "resume_receipt" && flow.to === "decision_owner");
  assert.deepEqual(resume && { to: resume.to, classification: resume.classification }, {
    to: "decision_owner",
    classification: "return",
  });
}

function assertSuiteSafetyLanguage(spec) {
  const visibleText = JSON.stringify(spec);
  for (const phrase of [
    "public/evidence-safe",
    "public-only",
    "Approval is not automatic",
    "does not guarantee a hiring outcome",
  ]) assert.ok(visibleText.includes(phrase), `${phrase} is required`);
  assert.doesNotMatch(
    visibleText,
    /approval\s+is\s+automatic|automatic\s+approval|hiring\s+is\s+guaranteed|guaranteed\s+hiring|자동\s*승인|승인이\s*자동|채용\s*보장|채용이\s*보장/iu,
  );
}

const suiteEvidenceDirectory = "guides/archify-diagrams/validation-evidence/suite-studio-career-handoff";

async function readEvidenceFile(relativePath, label) {
  const filename = joinWithin(repoRoot, relativePath, label);
  await assertNoSymlinkPath(repoRoot, relativePath, label);
  const stats = await lstat(filename);
  assert.ok(stats.isFile(), `${label} must be a regular file`);
  return readFile(filename);
}

function assertSuiteCliIdentity(manifest, installation) {
  assert.deepEqual(Object.keys(manifest.cli).sort(), ["bytes", "provider", "sha256", "version"]);
  assert.equal(manifest.cli.provider, installation.provider, "manifest cli provider must match resolver");
  assert.equal(manifest.cli.version, installation.version, "manifest cli version must match resolver");
  assert.equal(manifest.cli.sha256, installation.cli.sha256, "manifest cli sha256 must match resolver");
  assert.equal(manifest.cli.bytes, Number(installation.cli.size), "manifest cli bytes must match resolver");
}

function assertSuiteReceiptContract(receipt, entry, specification, artifact) {
  assert.equal(receipt.schemaVersion, 1, "receipt schemaVersion");
  assert.equal(receipt.ok, true, "receipt ok");
  assert.equal(receipt.command, "deliver", "receipt command");
  assert.equal(receipt.type, "dataflow", "receipt type");
  assert.equal(receipt.quality, "showcase", "receipt quality");
  assert.equal(receipt.input, entry.spec, "receipt input");
  assert.equal(receipt.output, entry.html, "receipt output");
  assert.deepEqual({ checksPassed: receipt.checksPassed, checkCount: receipt.checkCount, errors: receipt.errors, warnings: receipt.warnings }, {
    checksPassed: 9, checkCount: 9, errors: 0, warnings: 0,
  });
  assert.equal(receipt.compositionProfile, "showcase", "receipt compositionProfile");
  assert.equal(receipt.compositionStatus, "pass", "receipt compositionStatus");
  validateArchifyDeliverReceipt({
    ...receipt,
    validation: {
      checksPassed: receipt.checksPassed,
      checkCount: receipt.checkCount,
      errors: receipt.errors,
      warnings: receipt.warnings,
      compositionProfile: receipt.compositionProfile,
      compositionStatus: receipt.compositionStatus,
    },
  }, { specification, artifact });
}

async function stageSuiteArtifact(entry) {
  await stageCuratedArchify({ repoRoot, ids: [entry.id] });
  return readFile(path.join(repoRoot, ".tmp", "curated-archify", "current", entry.product, `${entry.id}.html`));
}

async function assertSuiteValidationEvidence(entry, spec) {
  const manifestPath = `${suiteEvidenceDirectory}/manifest.json`;
  const manifest = JSON.parse((await readEvidenceFile(manifestPath, "Suite validation manifest")).toString("utf8"));
  assert.deepEqual(Object.keys(manifest).sort(), ["cli", "entry_id", "final_receipt", "rounds", "schema_version", "stdout_path_normalization"]);
  assert.equal(manifest.schema_version, 1);
  assert.equal(manifest.entry_id, entry.id);
  assert.equal(manifest.stdout_path_normalization, "repo-root-relative");
  assert.equal(manifest.rounds.length, 1);
  const [round] = manifest.rounds;
  assert.deepEqual(round.argv, ["validate", "dataflow", entry.spec, "--quality", "showcase", "--json"]);
  assert.equal(round.exit_code, 0);
  assert.deepEqual(round.diagnostics, { errors: 0, warnings: 0 });
  assert.equal(round.candidate.path, entry.spec);
  const candidate = await readEvidenceFile(round.candidate.path, "Suite candidate");
  assert.deepEqual(JSON.parse(candidate.toString("utf8")), spec);
  assert.equal(round.candidate.sha256, sha256(candidate));
  assert.equal(round.candidate.bytes, candidate.byteLength);
  const stdout = JSON.parse((await readEvidenceFile(`${suiteEvidenceDirectory}/${round.stdout.path}`, "Suite validator stdout")).toString("utf8"));
  assert.equal(round.stdout.sha256, sha256(Buffer.from(`${JSON.stringify(stdout, null, 2)}\n`, "utf8")));
  assert.equal(round.stdout.bytes, Buffer.byteLength(`${JSON.stringify(stdout, null, 2)}\n`));
  assert.equal(stdout.ok, true);
  assert.equal(stdout.command, "validate");
  assert.equal(stdout.input, entry.spec);
  assert.equal(stdout.composition.summary.errors, round.diagnostics.errors);
  assert.equal(stdout.composition.summary.warnings, round.diagnostics.warnings);
  const stderr = await readEvidenceFile(`${suiteEvidenceDirectory}/${round.stderr.path}`, "Suite validator stderr");
  assert.equal(stderr.byteLength, 0);
  assert.deepEqual(round.stderr, {
    path: "final.validate.stderr.txt",
    bytes: 0,
    sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  });
  const receiptBytes = await readEvidenceFile(`${suiteEvidenceDirectory}/${manifest.final_receipt.path}`, "Suite final receipt");
  assert.equal(manifest.final_receipt.sha256, sha256(receiptBytes));
  assert.equal(manifest.final_receipt.bytes, receiptBytes.byteLength);
  const receipt = JSON.parse(receiptBytes.toString("utf8"));
  const installation = await (archifyInstallation ??= resolveArchifyInstallation(process.env));
  assert.equal(installation.status, "available");
  assertSuiteCliIdentity(manifest, installation);
  const artifact = await stageSuiteArtifact(entry);
  assertSuiteReceiptContract(receipt, entry, candidate, artifact);
  assert.deepEqual(receipt.specification, { sha256: round.candidate.sha256, bytes: round.candidate.bytes });
  assert.equal(receipt.artifact.sha256, sha256(artifact));
  assert.equal(receipt.artifact.bytes, artifact.byteLength);
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

test("Suite specs exist only for questions that cross both product boundaries", async () => {
  const catalog = await loadArchifyCatalog({ repoRoot });
  for (const entry of catalog.entries.filter((item) => item.decision === "selected" && item.product === "suite")) {
    assert.match(entry.decision_reason, /Studio/u);
    assert.match(entry.decision_reason, /Career/u);
    const spec = JSON.parse(await readFile(path.join(repoRoot, entry.spec), "utf8"));
    assert.ok(hasNamedProductBoundary(spec, "Studio"));
    assert.ok(hasNamedProductBoundary(spec, "Career"));
    assertSuiteHandoffSemantics(spec);
    assertSuiteSafetyLanguage(spec);
  }
});

test("Suite specs stay bounded and do not concatenate both product graphs", async () => {
  const { catalog, specsById } = await loadProductionSpecs(repoRoot, "suite");
  for (const entry of catalog.entries.filter((item) => item.decision === "selected" && item.product === "suite")) {
    const spec = specsById.get(entry.id);
    assert.ok(primaryNodeCount(spec) <= 12, entry.id);
    assert.equal(containsCompleteProductGraph(spec, "studio"), false, entry.id);
    assert.equal(containsCompleteProductGraph(spec, "career"), false, entry.id);
  }
});

test("Suite dataflow retains its portable validator evidence after visual approval", async () => {
  const { catalog, specsById } = await loadProductionSpecs(repoRoot, "suite");
  const entry = catalog.entries.find((item) => item.id === "suite-studio-career-handoff");
  const spec = specsById.get("suite-studio-career-handoff");
  assert.equal(entry?.delivery_status, "passed");
  assert.equal(entry?.visual_review, "passed");
  await assert.doesNotReject(() => validateInstalledSpec(spec, "dataflow"));
  await assertSuiteValidationEvidence(entry, spec);
});

test("Suite dataflow contract rejects schema, unsafe approval, and held-route mutations", async () => {
  const { specsById } = await loadProductionSpecs(repoRoot, "suite");
  const spec = specsById.get("suite-studio-career-handoff");
  const invalidSchema = { ...spec, diagram_type: "workflow" };
  const automaticApproval = structuredClone(spec);
  automaticApproval.cards[1].items.push("Approval is automatic");
  const wrongResume = {
    ...spec,
    flows: spec.flows.map((flow) => flow.from === "resume_receipt" ? { ...flow, to: "career_portfolio_input" } : flow),
  };
  const missingHeldReceipt = {
    ...spec,
    flows: spec.flows.filter((flow) => !(flow.from === "held_handoff" && flow.to === "resume_receipt")),
  };
  assert.match(await installedValidationError(invalidSchema, "dataflow"), /schema|diagram_type/u);
  assert.throws(() => assertSuiteSafetyLanguage(automaticApproval), /automatic/u);
  assert.throws(() => assertSuiteHandoffSemantics(wrongResume), /decision_owner/u);
  assert.throws(() => assertSuiteHandoffSemantics(missingHeldReceipt), /held_handoff/u);
});

test("Suite safety contract rejects removal and bilingual approval or hiring guarantees", async () => {
  const { specsById } = await loadProductionSpecs(repoRoot, "suite");
  const spec = specsById.get("suite-studio-career-handoff");
  const replaceVisibleText = (value, target, replacement) => {
    if (typeof value === "string") return value.replaceAll(target, replacement);
    if (Array.isArray(value)) return value.map((item) => replaceVisibleText(item, target, replacement));
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replaceVisibleText(item, target, replacement)]));
    return value;
  };
  for (const phrase of ["public/evidence-safe", "public-only", "Approval is not automatic", "does not guarantee a hiring outcome"]) {
    assert.throws(() => assertSuiteSafetyLanguage(replaceVisibleText(spec, phrase, "redacted")), new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));
  }
  for (const contradiction of ["Approval is automatic", "자동 승인", "Hiring is guaranteed", "채용 보장"]) {
    const mutated = structuredClone(spec);
    mutated.cards[1].items.push(contradiction);
    assert.throws(() => assertSuiteSafetyLanguage(mutated));
  }
});

test("Suite evidence rejects resolver identity and receipt provenance mutations", async () => {
  const { catalog, specsById } = await loadProductionSpecs(repoRoot, "suite");
  const entry = catalog.entries.find((item) => item.id === "suite-studio-career-handoff");
  const spec = specsById.get("suite-studio-career-handoff");
  const manifest = JSON.parse((await readEvidenceFile(`${suiteEvidenceDirectory}/manifest.json`, "Suite validation manifest")).toString("utf8"));
  const receipt = JSON.parse((await readEvidenceFile(`${suiteEvidenceDirectory}/final.receipt.json`, "Suite final receipt")).toString("utf8"));
  const candidate = await readEvidenceFile(entry.spec, "Suite candidate");
  const artifact = await stageSuiteArtifact(entry);
  const installation = await (archifyInstallation ??= resolveArchifyInstallation(process.env));
  for (const field of ["provider", "version", "sha256", "bytes"]) {
    const mutated = structuredClone(manifest);
    mutated.cli[field] = field === "bytes" ? 0 : "wrong";
    assert.throws(() => assertSuiteCliIdentity(mutated, installation), new RegExp(field, "u"));
  }
  for (const [field, value] of [
    ["command", "validate"], ["type", "workflow"], ["quality", "standard"],
    ["input", "wrong-input"], ["output", "wrong-output"], ["compositionProfile", "standard"],
    ["compositionStatus", "failed"], ["artifact", { sha256: "0".repeat(64), bytes: artifact.byteLength }],
  ]) {
    const mutated = { ...receipt, [field]: value };
    assert.throws(() => assertSuiteReceiptContract(mutated, entry, candidate, artifact), new RegExp(field === "artifact" ? "artifact" : field, "iu"));
  }
});

test("Suite specs remain source-bound and structurally distinct", async () => {
  const catalog = await loadArchifyCatalog({ repoRoot });
  const specsById = new Map();
  for (const entry of catalog.entries.filter((item) => item.decision === "selected")) {
    specsById.set(entry.id, JSON.parse(await readFile(path.join(repoRoot, entry.spec), "utf8")));
  }
  for (const entry of catalog.entries.filter((item) => item.decision === "selected" && item.product === "suite")) {
    assert.equal(await hashArchifySource(path.join(repoRoot, entry.source_document)), entry.source_digest);
    assert.equal(await markdownHasHeading(path.join(repoRoot, entry.source_document), entry.source_section), true);
    assert.notDeepEqual(semanticNodeIds(specsById.get(entry.id)), ["input", "skill", "artifact", "review", "result", "resume"]);
  }
  assert.deepEqual(findStructuralDuplicates({ catalog, specsById }), []);
});

test("selected Career workflow retains a schema-valid blocked-visual state after two unresolved correction rounds", async () => {
  const { catalog, specsById } = await loadProductionSpecs(repoRoot, "career");
  const entry = catalog.entries.find((item) => item.id === "career-evidence-workflow");
  const spec = careerWorkflowSpec(specsById);
  assertPrimaryNodeBound(spec);
  assert.equal(entry.delivery_status, "blocked-visual");
  assert.equal(entry.visual_review, "failed");
  assert.equal(entry.reviewer, "Codex Task 11 visual QA");
  assert.equal(entry.diagnostics.length, 1);
  assert.equal(entry.diagnostics[0].code, "visual-defect");
  assert.equal(entry.diagnostics[0].round, 2);
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
    "export_prepare",
    "held_context",
  ]) assert.ok(ids.has(id), `${id} is required`);
  assertEdge(spec, "stage_diagnosis", "disclosure_approval");
  assertEdge(spec, "disclosure_approval", "evidence_research");
  assertEdge(spec, "evidence_research", "evidence_project");
  assertCareerRouteAndReviewTopology(spec);
  assertCareerHoldResumesEvidenceResearch(spec);
  assert.equal(spec.nodes.find((node) => node.id === "human_review")?.type, "external");
  assertCareerSafetyLanguage(spec);
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

test("Career workflow contract rejects removal of growth or document-quality review", async () => {
  const { specsById } = await loadProductionSpecs(repoRoot, "career");
  const spec = careerWorkflowSpec(specsById);
  const withoutGrowth = {
    ...spec,
    nodes: spec.nodes.filter((node) => node.id !== "growth_experiment"),
    edges: spec.edges.filter((edge) => edge.from !== "growth_experiment" && edge.to !== "growth_experiment"),
    mainPath: spec.mainPath.filter((id) => id !== "growth_experiment"),
  };
  assert.throws(() => assertCareerRouteAndReviewTopology(withoutGrowth), /growth_experiment/u);
  const withoutDocumentQuality = structuredClone(spec);
  const reviewLayers = withoutDocumentQuality.cards.find((card) => card.title === "Review layers");
  reviewLayers.items = reviewLayers.items.filter((item) => !item.includes("Document quality"));
  assert.throws(() => assertCareerRouteAndReviewTopology(withoutDocumentQuality), /Document quality/u);
});

test("Career workflow contract rejects automatic approval and guaranteed hiring contradictions", async () => {
  const { specsById } = await loadProductionSpecs(repoRoot, "career");
  const spec = careerWorkflowSpec(specsById);
  for (const contradiction of ["Approval is automatic", "Hiring is guaranteed", "자동 승인", "채용 보장"]) {
    const mutated = structuredClone(spec);
    mutated.cards[1].items.push(contradiction);
    assert.throws(() => assertCareerSafetyLanguage(mutated));
  }
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
