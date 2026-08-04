import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { lstat, mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const pluginRoot = path.join(repoRoot, "products/game-design-studio/plugin");
const skillRoot = path.join(pluginRoot, "skills");
const fixtureArtifact = path.join(repoRoot, "tests/fixtures/artifacts/valid");
const validatorPath = path.join(repoRoot, "shared/scripts/validate-artifact.mjs");
const prepareScript = path.join(skillRoot, "export-game-design-documents/scripts/prepare-studio-export.mjs");
const exportValidatorScript = path.join(skillRoot, "export-game-design-documents/scripts/validate-studio-export.mjs");
const visualizationValidatorScript = path.join(skillRoot, "visualize-game-design/scripts/validate-visualization-evidence.mjs");
const temporaryDirectories = [];

test.afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

async function temporaryDirectory(prefix) {
  const directory = await mkdtemp(path.join(tmpdir(), prefix));
  temporaryDirectories.push(directory);
  return directory;
}

async function readSkill(skillId, relativePath = "SKILL.md") {
  return readFile(path.join(skillRoot, skillId, relativePath), "utf8");
}

function section(markdown, heading) {
  const marker = `## ${heading}\n`;
  const start = markdown.indexOf(marker);
  assert.notEqual(start, -1, `${heading}: section missing`);
  const remainder = markdown.slice(start + marker.length);
  const end = remainder.indexOf("\n## ");
  return end === -1 ? remainder : remainder.slice(0, end);
}

function parseStableFields(outputContract, label) {
  const match = outputContract.match(/\bwith stable sections for ([^.]+)\./iu);
  assert.ok(match, `${label}: stable field declaration`);
  return match[1]
    .replace(/, and /iu, ", ")
    .split(",")
    .map((field) => field.trim().toLocaleLowerCase("en-US"));
}

async function loadPrepareModule() {
  return import(`${pathToFileURL(prepareScript).href}?test=${Date.now()}`);
}

async function loadModule(modulePath) {
  return import(`${pathToFileURL(modulePath).href}?test=${Date.now()}-${Math.random()}`);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function writePngHeader(filePath, width, height) {
  const bytes = Buffer.alloc(24);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(bytes, 0);
  bytes.writeUInt32BE(13, 8);
  bytes.write("IHDR", 12, "ascii");
  bytes.writeUInt32BE(width, 16);
  bytes.writeUInt32BE(height, 20);
  await writeFile(filePath, bytes);
  return bytes;
}

const skillContracts = {
  "review-game-design": {
    outputFields: ["review scope", "findings", "decision items", "blockers", "review status"],
    prompt: "review a canonical game design artifact and return evidence-linked minimal fixes",
  },
  "visualize-game-design": {
    outputFields: ["diagram decision", "source mapping", "preset", "accessibility", "execution evidence", "asset index", "fallback status"],
    prompt: "turn source-backed game design structure into an accessible verified diagram",
  },
  "export-game-design-documents": {
    outputFields: ["preflight", "recipe", "capability probe", "format jobs", "renderer evidence", "qa status", "artifact preservation"],
    prompt: "prepare fail-closed MD PDF DOCX and PPTX export jobs from a canonical artifact",
  },
};

test("output skills use trigger-only metadata and generated interfaces", async () => {
  for (const [skillId, contract] of Object.entries(skillContracts)) {
    const [skill, openai] = await Promise.all([readSkill(skillId), readSkill(skillId, "agents/openai.yaml")]);
    const frontmatter = skill.match(/^---\n([\s\S]*?)\n---/u)?.[1];
    assert.ok(frontmatter, `${skillId}: frontmatter`);
    assert.deepEqual(frontmatter.split("\n").map((line) => line.split(":", 1)[0]), ["name", "description"]);
    assert.match(frontmatter, new RegExp(`^name: ${skillId}$`, "mu"));
    assert.match(frontmatter, /^description: Use when /mu);
    assert.doesNotMatch(frontmatter, /workflow|step|produce|output/iu);
    assert.match(openai, /display_name: "[^"]+"/u);
    assert.match(openai, /short_description: "[^"]{25,64}"/u);
    assert.match(openai, new RegExp(`default_prompt: "Use \\$${skillId} ${contract.prompt}\\."`, "u"));
  }
});

test("review skill blocks absent source and emits independently actionable findings", async () => {
  const skill = await readSkill("review-game-design");
  for (const heading of [
    "Triggers", "Non-triggers", "Required input", "Assumption policy", "Workflow", "Output contract",
    "Role reviewers", "Completion checks",
  ]) section(skill, heading);

  assert.deepEqual(parseStableFields(section(skill, "Output contract"), "review output"), skillContracts["review-game-design"].outputFields);
  const contract = section(skill, "Finding contract");
  for (const field of ["severity", "evidence", "impact", "affectedSectionId", "minimalFix"]) {
    assert.match(contract, new RegExp(`\\b${field}\\b`, "u"));
  }
  assert.match(section(skill, "Completion checks"), /source-unavailable/iu);
  assert.match(section(skill, "Completion checks"), /conflicting recommendations.*decision items/iu);
  assert.match(section(skill, "Assumption policy"), /illustrative.*source-derived/iu);
});

test("visualization presets cover six game-design structures with packaged Skillstead evidence gates", async () => {
  const presets = JSON.parse(await readFile(path.join(pluginRoot, "references/visualization-presets.json"), "utf8"));
  assert.equal(presets.schemaVersion, 1);
  assert.equal(presets.skillstead.packagePath, "skills/svg-infographic");
  assert.deepEqual(presets.presets.map(({ id }) => id), [
    "core-motivation-loop",
    "state-rule-flow",
    "quest-content-progression",
    "economy-source-sink",
    "liveops-roadmap",
    "production-role-structure",
  ]);
  for (const preset of presets.presets) {
    assert.deepEqual(Object.keys(preset).sort(), [
      "accessibility", "archetype", "fallback", "id", "pngRender", "suitedInputs", "svgLint", "unsuitableInputs",
    ]);
    assert.ok(preset.suitedInputs.length > 0, `${preset.id}: suited inputs`);
    assert.ok(preset.unsuitableInputs.length > 0, `${preset.id}: unsuitable inputs`);
    assert.equal(preset.accessibility.altTextRequired, true);
    assert.equal(preset.svgLint.command, "node skills/svg-infographic/scripts/check-svg.mjs <svg-path>");
    assert.equal(preset.pngRender.command, "node skills/svg-infographic/scripts/render.mjs <svg-path> <png-path>");
    assert.equal(preset.pngRender.scale, 2);
    assert.equal(preset.fallback.preserveCanonicalArtifact, true);
  }

  const skill = await readSkill("visualize-game-design");
  assert.deepEqual(parseStableFields(section(skill, "Output contract"), "visualization output"), skillContracts["visualize-game-design"].outputFields);
  assert.match(section(skill, "Diagram decision"), /spatial structure materially improves understanding/iu);
  assert.match(section(skill, "Source integrity"), /illustrative placeholders.*non-canonical/isu);
  assert.match(section(skill, "Completion checks"), /requested.*generated.*linted.*rendered.*verified/isu);
  assert.match(section(skill, "Completion checks"), /command.*file evidence/isu);
});

test("plugin-owned visualization validator proves ordered same-file lint render and 2x verification", async () => {
  const artifactRoot = await temporaryDirectory("studio-visualization-evidence-");
  const assets = path.join(artifactRoot, "assets");
  await mkdir(assets);
  const svgPath = path.join(assets, "loop.svg");
  const pngPath = path.join(assets, "loop.png");
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 60"><title>Loop</title><desc>Source-backed loop</desc></svg>\n';
  await writeFile(svgPath, svg);
  const png = await writePngHeader(pngPath, 400, 120);
  const record = {
    schemaVersion: 1,
    presetId: "core-motivation-loop",
    requested: { svg: true, png: true },
    planned: {
      status: "passed", sourceSectionIds: ["core-loop"], altText: "Source-backed loop",
      svgPath: "assets/loop.svg", pngPath: "assets/loop.png",
    },
    generated: {
      status: "passed", svgPath: "assets/loop.svg", svgDigest: sha256(svg),
      evidence: [{ command: "author", exitCode: 0, svgPath: "assets/loop.svg", svgDigest: sha256(svg), sourceSectionIds: ["core-loop"] }],
    },
    linted: {
      status: "passed", svgPath: "assets/loop.svg", svgDigest: sha256(svg),
      evidence: [{ command: "node check-svg.mjs", exitCode: 0, log: "0 errors, 0 warnings", svgPath: "assets/loop.svg", svgDigest: sha256(svg) }],
    },
    rendered: {
      status: "passed", svgPath: "assets/loop.svg", svgDigest: sha256(svg), pngPath: "assets/loop.png",
      pngDigest: sha256(png), scale: 2, width: 400, height: 120, renderer: "Chromium", rendererVersion: "140",
      evidence: [{
        command: "node render.mjs", exitCode: 0, log: "rendered 400x120", renderer: "Chromium", rendererVersion: "140",
        svgPath: "assets/loop.svg", svgDigest: sha256(svg), pngPath: "assets/loop.png", pngDigest: sha256(png), width: 400, height: 120,
      }],
    },
    verified: {
      status: "passed", svgPath: "assets/loop.svg", svgDigest: sha256(svg), pngPath: "assets/loop.png",
      pngDigest: sha256(png), width: 400, height: 120, sourceSectionIds: ["core-loop"], altText: "Source-backed loop",
      checks: ["fit-to-page", "close-up", "alt-text", "source-fidelity"],
    },
  };
  const { validateVisualizationEvidence } = await loadModule(visualizationValidatorScript);
  const valid = await validateVisualizationEvidence(record, { artifactRoot });
  assert.equal(valid.ok, true, valid.errors.join("\n"));
  assert.deepEqual(valid.normalized, record);

  const mutations = [
    ["verified cannot skip lint", (value) => { value.linted.status = "pending"; }],
    ["all stages use the same SVG", (value) => { value.linted.svgPath = "assets/other.svg"; }],
    ["all render stages use the same PNG", (value) => { value.verified.pngPath = "assets/other.png"; }],
    ["PNG is exactly 2x the SVG viewBox", (value) => { value.rendered.width = 399; }],
    ["preset is one of the packaged registry IDs", (value) => { value.presetId = "invented-preset"; }],
    ["source section IDs are unique", (value) => { value.planned.sourceSectionIds.push("core-loop"); }],
    ["passed evidence requires exit zero", (value) => { value.linted.evidence[0].exitCode = 1; }],
    ["renderer name and version are independent", (value) => { value.rendered.rendererVersion = ""; }],
    ["source mapping evidence remains identical", (value) => { value.generated.evidence[0].sourceSectionIds = ["other-section"]; }],
    ["alt-text evidence remains identical", (value) => { value.verified.altText = "Different description"; }],
    ["QA checks are exact", (value) => { value.verified.checks.push("invented-check"); }],
    ["combined evidence attacks fail closed", (value) => { value.presetId = "invented-preset"; value.rendered.evidence[0].exitCode = 1; value.verified.altText = "forged"; }],
    ["asset traversal is rejected", (value) => { value.planned.svgPath = "../loop.svg"; }],
    ["unknown object keys fail closed", (value) => { value.rendered.untrusted = true; }],
    ["malformed QA arrays fail closed", (value) => { value.verified.checks = null; }],
    ["prototype-sensitive keys fail closed", (value) => { value.generated.evidence[0].constructor = "pollute"; }],
  ];
  for (const [label, mutate] of mutations) {
    const candidate = structuredClone(record);
    mutate(candidate);
    const result = await validateVisualizationEvidence(candidate, { artifactRoot });
    assert.equal(result.ok, false, label);
    assert.equal(result.normalized, null, label);
  }

  for (const stageName of ["generated", "linted", "rendered"]) {
    for (const malformed of [null, {}, "invalid"]) {
      const candidate = structuredClone(record);
      candidate[stageName].evidence = malformed;
      const result = await validateVisualizationEvidence(candidate, { artifactRoot });
      assert.equal(result.ok, false, `${stageName} malformed evidence container`);
      assert.ok(result.errors.includes(`${stageName}.evidence must be an array`), `${stageName} container error path`);
      assert.equal(result.normalized, null);
    }
    for (const [malformed, expectedError] of [
      [null, `${stageName}.evidence[0] must be an object`],
      ["invalid", `${stageName}.evidence[0] must be an object`],
      [JSON.parse('{"constructor":{"polluted":true}}'), `record.${stageName}.evidence.0.constructor is prohibited`],
    ]) {
      const candidate = structuredClone(record);
      candidate[stageName].evidence = [malformed];
      const result = await validateVisualizationEvidence(candidate, { artifactRoot });
      assert.equal(result.ok, false, `${stageName} malformed evidence item`);
      assert.ok(result.errors.includes(expectedError), `${stageName} item error path: ${expectedError}`);
      assert.equal(result.normalized, null);
    }
    const candidate = structuredClone(record);
    candidate[stageName].evidence = [Object.create({ polluted: true })];
    const result = await validateVisualizationEvidence(candidate, { artifactRoot });
    assert.equal(result.ok, false, `${stageName} unsafe evidence prototype`);
    assert.ok(result.errors.includes(`record.${stageName}.evidence.0 has an unsafe prototype`));
    assert.equal(result.normalized, null);
  }

  for (const [label, invalidSvg] of [
    ["actual SVG title is required", '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 60"><desc>Source-backed loop</desc></svg>\n'],
    ["actual SVG desc is required", '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 60"><title>Loop</title></svg>\n'],
  ]) {
    await writeFile(svgPath, invalidSvg);
    const candidate = structuredClone(record);
    const invalidDigest = sha256(invalidSvg);
    for (const stage of [candidate.generated, candidate.linted, candidate.rendered, candidate.verified]) stage.svgDigest = invalidDigest;
    candidate.generated.evidence[0].svgDigest = invalidDigest;
    candidate.linted.evidence[0].svgDigest = invalidDigest;
    candidate.rendered.evidence[0].svgDigest = invalidDigest;
    const result = await validateVisualizationEvidence(candidate, { artifactRoot });
    assert.equal(result.ok, false, label);
  }
  await writeFile(svgPath, svg);
});

test("visualization validator accepts a verified SVG fallback when PNG rendering fails", async () => {
  const artifactRoot = await temporaryDirectory("studio-visualization-fallback-");
  const assets = path.join(artifactRoot, "assets");
  await mkdir(assets);
  const svgPath = path.join(assets, "loop.svg");
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 60"><title>Loop</title><desc>Source-backed loop</desc></svg>\n';
  await writeFile(svgPath, svg);
  const svgDigest = sha256(svg);
  const record = {
    schemaVersion: 1,
    presetId: "core-motivation-loop",
    requested: { svg: true, png: true },
    planned: { status: "passed", sourceSectionIds: ["core-loop"], altText: "Source-backed loop", svgPath: "assets/loop.svg", pngPath: "assets/loop.png" },
    generated: {
      status: "passed", svgPath: "assets/loop.svg", svgDigest,
      evidence: [{ command: "author", exitCode: 0, svgPath: "assets/loop.svg", svgDigest, sourceSectionIds: ["core-loop"] }],
    },
    linted: {
      status: "passed", svgPath: "assets/loop.svg", svgDigest,
      evidence: [{ command: "node check-svg.mjs", exitCode: 0, log: "0 errors, 0 warnings", svgPath: "assets/loop.svg", svgDigest }],
    },
    rendered: {
      status: "failed", svgPath: "assets/loop.svg", svgDigest, pngPath: null, pngDigest: null,
      scale: 2, width: null, height: null, renderer: "Chromium", rendererVersion: "140",
      evidence: [{
        command: "node render.mjs", exitCode: 1, log: "renderer failed", renderer: "Chromium", rendererVersion: "140",
        svgPath: "assets/loop.svg", svgDigest, pngPath: null, pngDigest: null, width: null, height: null,
      }],
    },
    verified: {
      status: "unavailable", svgPath: "assets/loop.svg", svgDigest, pngPath: null, pngDigest: null,
      width: null, height: null, sourceSectionIds: ["core-loop"], altText: "Source-backed loop", checks: [],
    },
  };
  const { validateVisualizationEvidence } = await loadModule(visualizationValidatorScript);
  const result = await validateVisualizationEvidence(record, { artifactRoot });
  assert.equal(result.ok, true, result.errors.join("\n"));
});

test("export recipes are artifact-specific and presentations require an independent story", async () => {
  const recipes = await readFile(path.join(pluginRoot, "references/export-recipes.md"), "utf8");
  const ids = [...recipes.matchAll(/^### Recipe: `([a-z0-9-]+)`$/gmu)].map(([, id]) => id);
  assert.deepEqual(ids, [
    "gdd",
    "system-spec",
    "content-spec",
    "liveops-plan",
    "review-report",
    "executive-presentation",
  ]);
  assert.match(recipes, /audience.*purpose.*independent story outline/isu);
  assert.match(recipes, /must not split Markdown headings into slides/iu);

  const skill = await readSkill("export-game-design-documents");
  assert.deepEqual(parseStableFields(section(skill, "Output contract"), "export output"), skillContracts["export-game-design-documents"].outputFields);
  assert.match(section(skill, "Workflow"), /validate-artifact\.mjs/iu);
  assert.match(section(skill, "Workflow"), /capability-probe\.mjs/iu);
  assert.match(section(skill, "Completion checks"), /MD.*PDF.*DOCX.*PPTX.*actual.*QA/isu);
  assert.match(section(skill, "Completion checks"), /passed.*output path.*digest.*count.*evidence/isu);
});

test("export preparation emits a renderer-neutral pending manifest without fabricating outputs", async () => {
  const outputDir = await temporaryDirectory("studio-export-output-");
  const { prepareStudioExportJob } = await loadPrepareModule();
  const manifest = await prepareStudioExportJob({
    artifactDir: fixtureArtifact,
    outputDir,
    recipeId: "gdd",
    requestedFormats: ["md", "pdf", "docx", "pptx"],
    presentation: {
      audience: "studio leadership",
      purpose: "decide whether the combat brief advances",
      slideOutline: [
        { id: "decision", title: "Advance the combat direction", message: "The prototype evidence supports a bounded next gate.", purpose: "request a decision" },
        { id: "experience", title: "The intended play experience", message: "Timing and counterplay define the combat promise.", purpose: "align on experience" },
        { id: "proof", title: "What the evidence establishes", message: "The canonical brief separates facts from assumptions.", purpose: "show decision evidence" },
        { id: "next-gate", title: "Risks and the next gate", message: "Resolve the listed unknowns before production commitment.", purpose: "bound the investment" },
      ],
    },
    capabilities: {
      node: { available: true, version: process.versions.node },
      chromium: { available: true, command: "chromium" },
      soffice: { available: false },
      documents: { available: true, provider: "codex-bundled" },
      pdf: { available: true, provider: "codex-bundled" },
      presentations: { available: true, provider: "codex-bundled" },
    },
    validatorPath,
  });

  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.preflight.status, "passed");
  assert.equal(manifest.recipe.id, "gdd");
  assert.deepEqual(Object.keys(manifest.formats), ["md", "pdf", "docx", "pptx"]);
  const canonicalOutputDir = await realpath(outputDir);
  for (const [format, job] of Object.entries(manifest.formats)) {
    assert.equal(job.requested, true, format);
    assert.equal(job.status, "pending", format);
    assert.equal(job.extension, format, format);
    assert.deepEqual(job.statusHistory, ["pending"], format);
    assert.equal(job.outputPath, null, format);
    assert.equal(job.digest, null, format);
    assert.equal(job.pageOrSlideCount, null, format);
    assert.deepEqual(job.evidence, [], format);
    assert.ok(job.plannedOutputPath.startsWith(`${canonicalOutputDir}${path.sep}`), format);
  }
  assert.equal("renderer" in manifest, false);
  assert.equal("library" in manifest, false);
});

test("export preparation keeps unavailable capabilities distinct from renderer and QA evidence", async () => {
  const outputDir = await temporaryDirectory("studio-export-unavailable-");
  const { prepareStudioExportJob } = await loadPrepareModule();
  const manifest = await prepareStudioExportJob({
    artifactDir: fixtureArtifact,
    outputDir,
    recipeId: "review-report",
    requestedFormats: ["md", "pdf", "docx"],
    capabilities: {
      node: { available: true, version: process.versions.node },
      chromium: { available: false },
      soffice: { available: false },
      documents: { available: false },
      pdf: { available: false },
      presentations: { available: false },
    },
    validatorPath,
  });

  assert.equal(manifest.formats.md.status, "pending");
  assert.equal(manifest.formats.pdf.status, "unavailable");
  assert.equal(manifest.formats.docx.status, "unavailable");
  assert.equal(manifest.formats.pptx.status, "not-requested");
  assert.deepEqual(manifest.formats.pdf.evidence, []);
  assert.deepEqual(manifest.formats.docx.evidence, []);
});

test("export preparation fails closed before jobs when canonical preflight fails", async () => {
  const invalidArtifact = await temporaryDirectory("studio-invalid-artifact-");
  const outputDir = await temporaryDirectory("studio-invalid-output-");
  await mkdir(path.join(invalidArtifact, "assets"));
  await mkdir(path.join(invalidArtifact, "decisions"));
  await writeFile(path.join(invalidArtifact, "content.md"), "# Missing frontmatter and stable ID\n");

  const { prepareStudioExportJob } = await loadPrepareModule();
  const manifest = await prepareStudioExportJob({
    artifactDir: invalidArtifact,
    outputDir,
    recipeId: "gdd",
    requestedFormats: ["md", "pdf"],
    capabilities: { pdf: { available: true } },
    validatorPath,
  });

  assert.equal(manifest.preflight.status, "failed");
  assert.ok(manifest.preflight.errors.length > 0);
  assert.equal(manifest.formats.md.status, "blocked");
  assert.equal(manifest.formats.pdf.status, "blocked");
});

test("export preparation rejects PPTX without audience purpose and independent outline", async () => {
  const outputDir = await temporaryDirectory("studio-pptx-brief-");
  const { prepareStudioExportJob } = await loadPrepareModule();
  await assert.rejects(
    () => prepareStudioExportJob({
      artifactDir: fixtureArtifact,
      outputDir,
      recipeId: "executive-presentation",
      requestedFormats: ["pptx"],
      capabilities: { presentations: { available: true } },
      presentation: { audience: "executives", purpose: "approve direction", slideOutline: [] },
      validatorPath,
    }),
    /PPTX.*slide outline/iu,
  );
  await assert.rejects(
    () => prepareStudioExportJob({
      artifactDir: fixtureArtifact,
      outputDir,
      recipeId: "executive-presentation",
      requestedFormats: ["pptx"],
      capabilities: { presentations: { available: true } },
      presentation: { audience: "executives", purpose: "approve direction", slideOutline: ["# Player Experience"] },
      validatorPath,
    }),
    /PPTX.*slide outline/iu,
  );
});

test("export preparation rejects traversal symlinks and unsafe overwrites", async () => {
  const root = await temporaryDirectory("studio-export-security-");
  const outputDir = path.join(root, "output");
  const symlinkOutput = path.join(root, "symlink-output");
  await mkdir(outputDir);
  await symlink(outputDir, symlinkOutput);
  const { prepareStudioExportJob } = await loadPrepareModule();

  await assert.rejects(
    () => prepareStudioExportJob({
      artifactDir: fixtureArtifact,
      outputDir: symlinkOutput,
      recipeId: "gdd",
      requestedFormats: ["md"],
      capabilities: {},
      validatorPath,
    }),
    /symlink/iu,
  );

  await writeFile(path.join(outputDir, "combat-brief.md"), "existing owner content\n");
  await assert.rejects(
    () => prepareStudioExportJob({
      artifactDir: fixtureArtifact,
      outputDir,
      recipeId: "gdd",
      requestedFormats: ["md"],
      capabilities: {},
      validatorPath,
    }),
    /overwrite/iu,
  );

  const stat = await lstat(path.join(outputDir, "combat-brief.md"));
  assert.equal(stat.isFile(), true);
  assert.equal(await readFile(path.join(outputDir, "combat-brief.md"), "utf8"), "existing owner content\n");
});

test("plugin-owned export validator enforces derivatives terminal transitions and fail-closed normalization", async () => {
  const outputDir = await temporaryDirectory("studio-export-validator-");
  const { prepareStudioExportJob } = await loadPrepareModule();
  const { validateStudioExportManifest } = await loadModule(exportValidatorScript);
  const prepared = await prepareStudioExportJob({
    artifactDir: fixtureArtifact,
    outputDir,
    recipeId: "review-report",
    requestedFormats: ["md", "pptx"],
    capabilities: { presentations: { available: true, provider: "codex-bundled" } },
    presentation: {
      audience: "studio leadership",
      purpose: "decide the review outcome",
      slideOutline: [
        { id: "decision", title: "Choose the review outcome", message: "The evidence supports a bounded decision.", purpose: "request a decision" },
        { id: "risk", title: "Resolve the material risk", message: "One unknown remains before commitment.", purpose: "bound the next gate" },
      ],
    },
    validatorPath,
  });
  const derivativePath = prepared.formats.md.plannedOutputPath;
  const bytes = Buffer.from("# Review report\n", "utf8");
  await writeFile(derivativePath, bytes);
  prepared.formats.md = {
    ...prepared.formats.md,
    status: "passed",
    statusHistory: ["pending", "passed"],
    generationStatus: "passed",
    rendererStatus: "not-required",
    qaStatus: "passed",
    outputPath: derivativePath,
    digest: sha256(bytes),
    pageOrSlideCount: 1,
    evidence: [
      { stage: "generation", status: "passed", derivativePath, digest: sha256(bytes), command: "canonical Markdown copy", exitCode: 0 },
      { stage: "qa", status: "passed", derivativePath, digest: sha256(bytes), command: "Markdown QA", exitCode: 0, count: 1 },
    ],
  };

  const valid = await validateStudioExportManifest(prepared, { outputRoot: outputDir });
  assert.equal(valid.ok, true, valid.errors.join("\n"));
  assert.deepEqual(valid.normalized, prepared);

  const mutations = [
    ["extension must match format", (value) => { value.formats.md.extension = "pdf"; }],
    ["generation and QA use one derivative", (value) => { value.formats.md.evidence[1].derivativePath = path.join(outputDir, "other.md"); }],
    ["passed forbids failed evidence", (value) => { value.formats.md.evidence[1].status = "failed"; }],
    ["capability probe states are mutually exclusive", (value) => { value.capabilityProbe.status = "missing"; value.capabilityProbe.capabilities.pdf = { available: true }; }],
    ["requested and not-requested are exact", (value) => { value.formats.pdf.requested = false; value.formats.pdf.status = "pending"; value.formats.pdf.statusHistory = ["pending"]; }],
    ["terminal transitions cannot reopen", (value) => { value.formats.md.statusHistory = ["pending", "passed", "pending"]; value.formats.md.status = "pending"; }],
    ["terminal histories start at pending", (value) => { value.formats.md.statusHistory = ["passed"]; }],
    ["passed preflight matches exit code and errors", (value) => { value.preflight.exitCode = 1; value.preflight.errors = [{ code: "FORGED", file: "content.md", message: "forged" }]; }],
    ["passed evidence requires exit zero", (value) => { value.formats.md.evidence[0].exitCode = 1; }],
    ["pending jobs cannot claim derivatives", (value) => { value.formats.pptx.outputPath = value.formats.pptx.plannedOutputPath; value.formats.pptx.digest = "0".repeat(64); }],
    ["format capability identity is fixed", (value) => { value.formats.pptx.capability.name = "pdf"; }],
    ["format capability equals its probe snapshot", (value) => { value.formats.pptx.capability.provider = "forged-provider"; }],
    ["PPTX requests require presentation", (value) => { delete value.presentation; }],
    ["presentation slides are independent stories", (value) => { value.presentation.slideOutline[0].title = "# Review report"; }],
    ["presentation slides do not copy canonical headings", (value) => { value.presentation.slideOutline[0].title = "Player Experience"; }],
    ["failed terminals require failed evidence", (value) => { value.formats.md.status = "failed"; value.formats.md.statusHistory = ["pending", "failed"]; }],
    ["evidence count equals the derivative count", (value) => { value.formats.md.evidence[1].count = 2; }],
    ["evidence digest equals the derivative digest", (value) => { value.formats.md.evidence[0].digest = "0".repeat(64); }],
    ["evidence command is nonempty", (value) => { value.formats.md.evidence[0].command = ""; }],
    ["malformed evidence arrays fail closed", (value) => { value.formats.pptx.evidence = null; }],
    ["unknown object keys fail closed", (value) => { value.formats.md.untrusted = true; }],
    ["prototype-sensitive keys fail closed", (value) => { value.formats.md.evidence[0].__proto__ = { polluted: true }; }],
  ];
  for (const [label, mutate] of mutations) {
    const candidate = structuredClone(prepared);
    mutate(candidate);
    const result = await validateStudioExportManifest(candidate, { outputRoot: outputDir });
    assert.equal(result.ok, false, label);
    assert.equal(result.normalized, null, label);
  }


  for (const malformed of [null, {}, "invalid"]) {
    const candidate = structuredClone(prepared);
    candidate.capabilityProbe.evidence = malformed;
    const result = await validateStudioExportManifest(candidate, { outputRoot: outputDir });
    assert.equal(result.ok, false, "malformed capability evidence container");
    assert.ok(result.errors.includes("capabilityProbe.evidence must be an array"));
    assert.equal(result.normalized, null);
  }
  for (const [malformed, expectedError] of [
    [null, "capabilityProbe.evidence[0] must be an object"],
    ["invalid", "capabilityProbe.evidence[0] must be an object"],
    [JSON.parse('{"constructor":{"polluted":true}}'), "manifest.capabilityProbe.evidence.0.constructor is prohibited"],
  ]) {
    const candidate = structuredClone(prepared);
    candidate.capabilityProbe.evidence = [malformed];
    const result = await validateStudioExportManifest(candidate, { outputRoot: outputDir });
    assert.equal(result.ok, false, "malformed capability evidence item");
    assert.ok(result.errors.includes(expectedError), expectedError);
    assert.equal(result.normalized, null);
  }
  {
    const candidate = structuredClone(prepared);
    candidate.capabilityProbe.evidence = [Object.create({ polluted: true })];
    const result = await validateStudioExportManifest(candidate, { outputRoot: outputDir });
    assert.equal(result.ok, false, "unsafe capability evidence prototype");
    assert.ok(result.errors.includes("manifest.capabilityProbe.evidence.0 has an unsafe prototype"));
    assert.equal(result.normalized, null);
  }
  for (const format of ["md", "pdf", "docx", "pptx"]) {
    for (const malformed of [null, {}, "invalid"]) {
      const candidate = structuredClone(prepared);
      candidate.formats[format].evidence = malformed;
      const result = await validateStudioExportManifest(candidate, { outputRoot: outputDir });
      assert.equal(result.ok, false, `${format} malformed evidence container`);
      assert.ok(result.errors.includes(`formats.${format}.evidence must be an array`), `${format} container error path`);
      assert.equal(result.normalized, null);
    }
    for (const [malformed, expectedError] of [
      [null, `formats.${format}.evidence[0] must be an object`],
      ["invalid", `formats.${format}.evidence[0] must be an object`],
      [JSON.parse('{"constructor":{"polluted":true}}'), `manifest.formats.${format}.evidence.0.constructor is prohibited`],
    ]) {
      const candidate = structuredClone(prepared);
      candidate.formats[format].evidence = [malformed];
      const result = await validateStudioExportManifest(candidate, { outputRoot: outputDir });
      assert.equal(result.ok, false, `${format} malformed evidence item`);
      assert.ok(result.errors.includes(expectedError), `${format} item error path: ${expectedError}`);
      assert.equal(result.normalized, null);
    }
    const candidate = structuredClone(prepared);
    candidate.formats[format].evidence = [Object.create({ polluted: true })];
    const result = await validateStudioExportManifest(candidate, { outputRoot: outputDir });
    assert.equal(result.ok, false, `${format} unsafe evidence prototype`);
    assert.ok(result.errors.includes(`manifest.formats.${format}.evidence.0 has an unsafe prototype`));
    assert.equal(result.normalized, null);
  }
});
